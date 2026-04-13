const TimingFingerprint = {

    async collect() {
        const [cpu, gpu, crypto, mem] = await Promise.allSettled([
            this.cpuTiming(),
            this.gpuTiming(),
            this.cryptoTiming(),
            this.memoryTiming()
        ])

        return {
            cpu: cpu.value ?? 'error',
            gpu: gpu.value ?? 'error',
            crypto: crypto.value ?? 'error',
            memory: mem.value ?? 'error',
            timerRes: this.timerResolution()
        }
    },

    // ── CPU timing ────────────────────────────────────────────────────────────
    // different CPU architectures produce different scores
    // Intel vs AMD vs ARM have different FP unit speeds

    async cpuTiming() {
        const results = {}

        results.integer = this._time(() => {
            let n = 0
            for (let i = 0; i < 1_000_000; i++) n ^= i * 1234567
            return n
        })

        results.float = this._time(() => {
            let n = 1.0
            for (let i = 0; i < 500_000; i++) n += Math.sqrt(i) * 0.000001
            return n
        })

        results.trig = this._time(() => {
            let n = 0
            for (let i = 0; i < 200_000; i++) n += Math.sin(i) * Math.cos(i)
            return n
        })

        const arr = Array.from({ length: 10000 }, (_, i) => (i * 2654435761) >>> 0)
        results.sort = this._time(() => [...arr].sort((a, b) => a - b))

        results.string = this._time(() => {
            let s = ''
            for (let i = 0; i < 5000; i++) s += String.fromCharCode(65 + (i % 26))
            return s.length
        })

        return results
    },

    // ── GPU timing ────────────────────────────────────────────────────────────
    // canvas + WebGL operation timing reveals GPU generation

    async gpuTiming() {
        const results = {}

        try {
            const c = document.createElement('canvas')
            c.width = 512; c.height = 512
            const ctx = c.getContext('2d')
            results.canvas2d = this._time(() => {
                for (let i = 0; i < 100; i++) {
                    ctx.fillStyle = `rgb(${i},${i},${i})`
                    ctx.fillRect(0, 0, 512, 512)
                }
            })
        } catch { results.canvas2d = 'error' }

        try {
            const c = document.createElement('canvas')
            c.width = 512; c.height = 512
            const gl = c.getContext('webgl')
            if (gl) {
                results.webglClear = this._time(() => {
                    for (let i = 0; i < 200; i++) {
                        gl.clearColor(i / 200, 0, 0, 1)
                        gl.clear(gl.COLOR_BUFFER_BIT)
                    }
                })

                const tex = gl.createTexture()
                const data = new Uint8Array(256 * 256 * 4).fill(128)
                results.texUpload = this._time(() => {
                    gl.bindTexture(gl.TEXTURE_2D, tex)
                    for (let i = 0; i < 20; i++) {
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0,
                            gl.RGBA, gl.UNSIGNED_BYTE, data)
                    }
                })
                gl.deleteTexture(tex)
            }
        } catch { results.webglClear = 'error' }

        return results
    },

    // ── Crypto timing ─────────────────────────────────────────────────────────
    // hardware crypto acceleration differs per CPU generation
    // AES-NI support changes timing dramatically

    async cryptoTiming() {
        const results = {}

        try {
            const data = new Uint8Array(1024 * 1024)
            crypto.getRandomValues(data)
            const t0 = performance.now()
            for (let i = 0; i < 10; i++) {
                await crypto.subtle.digest('SHA-256', data)
            }
            results.sha256_10x_1mb = parseFloat((performance.now() - t0).toFixed(3))
        } catch { results.sha256 = 'error' }

        try {
            const key = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
            )
            const iv = crypto.getRandomValues(new Uint8Array(12))
            const data = new Uint8Array(1024 * 64)
            const t0 = performance.now()
            for (let i = 0; i < 20; i++) {
                await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
            }
            results.aesGcm_20x_64kb = parseFloat((performance.now() - t0).toFixed(3))
        } catch { results.aesGcm = 'error' }

        try {
            const pass = new TextEncoder().encode('test')
            const salt = crypto.getRandomValues(new Uint8Array(16))
            const key = await crypto.subtle.importKey('raw', pass, 'PBKDF2', false, ['deriveBits'])
            const t0 = performance.now()
            await crypto.subtle.deriveBits(
                { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256
            )
            results.pbkdf2_100k = parseFloat((performance.now() - t0).toFixed(3))
        } catch { results.pbkdf2 = 'error' }

        return results
    },

    // ── Memory timing ─────────────────────────────────────────────────────────
    // cache size + memory bandwidth differs per CPU

    async memoryTiming() {
        const results = {}

        const sizes = [
            { name: 'l1_likely', bytes: 32 * 1024 },
            { name: 'l2_likely', bytes: 256 * 1024 },
            { name: 'l3_likely', bytes: 4 * 1024 * 1024 },
            { name: 'ram', bytes: 32 * 1024 * 1024 }
        ]

        for (const { name, bytes } of sizes) {
            try {
                const buf = new Float64Array(bytes / 8)
                const t0 = performance.now()
                let sum = 0
                for (let i = 0; i < buf.length; i++) sum += buf[i]
                results[name] = parseFloat((performance.now() - t0).toFixed(3))
                if (sum < 0) results[name] = 0
            } catch { results[name] = 'error' }
        }

        results.sharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined'
        results.wasmSimd = await this._detectWasmSimd()

        return results
    },

    async _detectWasmSimd() {
        try {
            const simdTest = new Uint8Array([
                0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3,
                2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
            ])
            await WebAssembly.validate(simdTest)
            return true
        } catch { return false }
    },

    // ── helpers ───────────────────────────────────────────────────────────────

    _time(fn) {
        const t0 = performance.now()
        fn()
        return parseFloat((performance.now() - t0).toFixed(3))
    },

    timerResolution() {
        const samples = []
        for (let i = 0; i < 100; i++) samples.push(performance.now())
        const deltas = samples.slice(1).map((v, i) => v - samples[i]).filter(d => d > 0)
        return {
            min: deltas.length ? parseFloat(Math.min(...deltas).toFixed(6)) : 0,
            avg: deltas.length ? parseFloat((deltas.reduce((a, b) => a + b) / deltas.length).toFixed(6)) : 0
        }
    }
}