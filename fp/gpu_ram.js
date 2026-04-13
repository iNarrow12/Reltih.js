const GPURamProber = {

    START_MB: 128,
    STEP_MB: 128,
    MAX_MB: 8192,
    TIMEOUT_MS: 8000,

    async probe() {
        if (!navigator.gpu) return { supported: false, reason: 'WebGPU unavailable' }

        let adapter, device
        try {
            adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
            if (!adapter) return { supported: false, reason: 'no adapter' }
            device = await adapter.requestDevice()
        } catch (e) {
            return { supported: false, reason: e.message }
        }

        const maxAllowed = device.limits.maxBufferSize
        const result = {
            supported: true,
            reportedRAM_GB: navigator.deviceMemory || 'unknown',
            gpuMaxBuffer_GB: +(maxAllowed / 1024 ** 3).toFixed(2),
            probeSteps: [],
            oomThreshold_MB: null,
            estimatedVRAM_MB: null,
            farbling: false,
            confidence: 1.0
        }

        const start = performance.now()
        const buffers = []

        let lastSuccess = 0
        let mb = this.START_MB

        while (mb <= this.MAX_MB) {
            if (performance.now() - start > this.TIMEOUT_MS) {
                result.probeSteps.push({ mb, status: 'timeout' })
                break
            }

            const bytes = mb * 1024 * 1024
            if (bytes > maxAllowed) {
                result.probeSteps.push({ mb, status: 'exceeds_device_limit' })
                break
            }

            device.pushErrorScope('out-of-memory')

            let buf
            try {
                buf = device.createBuffer({
                    size: bytes,
                    usage: GPUBufferUsage.STORAGE
                })
            } catch (e) {
                await device.popErrorScope()
                result.probeSteps.push({ mb, status: 'hard_fail', error: e.message })
                result.oomThreshold_MB = mb
                break
            }

            const err = await device.popErrorScope()

            if (err) {
                result.probeSteps.push({ mb, status: 'oom', error: err.message })
                result.oomThreshold_MB = mb
                buf?.destroy()
                break
            } else {
                result.probeSteps.push({ mb, status: 'ok' })
                lastSuccess = mb
                buffers.push(buf)
                mb += this.STEP_MB
            }
        }

        for (const b of buffers) {
            try { b.destroy() } catch { }
        }
        device.destroy()

        result.estimatedVRAM_MB = lastSuccess
        result.estimatedVRAM_GB = +(lastSuccess / 1024).toFixed(2)

        result.farbling = this.detectFarbling(result)
        result.confidence = this.scoreConfidence(result)
        result.discrepancy = this.buildDiscrepancy(result)

        return result
    },

    detectFarbling(r) {
        const reported = r.reportedRAM_GB
        if (reported === 'unknown' || !r.estimatedVRAM_GB) return false

        const ratio = r.estimatedVRAM_GB / reported
        return ratio >= 1.8
    },

    scoreConfidence(r) {
        let score = 1.0

        if (!r.oomThreshold_MB && r.estimatedVRAM_MB < 512) score -= 0.3
        if (!r.supported) score -= 0.5
        if (r.farbling) score -= 0.2
        if (r.probeSteps.some(s => s.status === 'timeout')) score -= 0.15

        return parseFloat(Math.max(0, score).toFixed(2))
    },

    buildDiscrepancy(r) {
        const reported = r.reportedRAM_GB
        if (reported === 'unknown') return null

        const diff = r.estimatedVRAM_GB - reported
        return {
            reportedGB: reported,
            probedGB: r.estimatedVRAM_GB,
            diffGB: parseFloat(diff.toFixed(2)),
            ratio: parseFloat((r.estimatedVRAM_GB / reported).toFixed(2)),
            nextBin: this.nextPowerOf2(reported),
            matchesNextBin: Math.abs(r.estimatedVRAM_GB - this.nextPowerOf2(reported)) < 0.5
        }
    },

    nextPowerOf2(n) {
        return Math.pow(2, Math.ceil(Math.log2(n + 0.01)))
    }

}