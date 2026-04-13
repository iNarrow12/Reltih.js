const EnvironmentDetector = {

    async collect() {
        const [hardware, vm, bot, sandbox] = await Promise.allSettled([
            this.probeHardwareDevices(),
            this.detectVM(),
            this.detectBot(),
            this.detectSandbox()
        ])

        const result = {
            hardware: hardware.value ?? 'error',
            vm: vm.value ?? 'error',
            bot: bot.value ?? 'error',
            sandbox: sandbox.value ?? 'error',
        }

        result.verdict = this.buildVerdict(result)
        return result
    },

    // ─── HARDWARE DEVICE PROBING ────────────────────────────────────────────────

    async probeHardwareDevices() {
        const devices = {}

        devices.keyboard = await this.probeKeyboard()
        devices.pointer = this.probePointer()
        devices.touch = this.probeTouch()
        devices.gamepad = this.probeGamepad()
        devices.printer = this.probePrinter()
        devices.camera = this.probeCamera()
        devices.battery = await this.probeBattery()
        devices.usb = await this.probeUSB()
        devices.hid = await this.probeHID()
        devices.bluetooth = await this.probeBluetooth()
        devices.displays = this.probeDisplays()
        devices.audio = await this.probeAudioDevices()

        return devices
    },

    async probeKeyboard() {
        const result = { present: false, layoutMap: null, type: 'unknown' }

        // method 1: keyboard API layout map
        if (navigator.keyboard) {
            try {
                const map = await navigator.keyboard.getLayoutMap()
                result.present = true
                result.layoutMap = Object.fromEntries(map)
                result.type = 'physical'
                // layout map key count — virtual keyboards have fewer
                result.keyCount = map.size
            } catch { result.layoutMap = 'blocked' }
        }

        // method 2: maxTouchPoints = 0 + no virtual keyboard API = physical keyboard likely
        if (navigator.maxTouchPoints === 0) {
            result.present = true
            result.touchScreen = false
            if (result.type === 'unknown') result.type = 'physical_inferred'
        }

        // method 3: virtualKeyboard API presence = touch device
        if ('virtualKeyboard' in navigator) {
            result.virtualKeyboardAPI = true
            if (navigator.maxTouchPoints > 0) result.type = 'virtual'
        }

        // method 4: navigator.keyboard available = Chrome desktop
        result.keyboardAPI = 'keyboard' in navigator

        return result
    },

    probePointer() {
        return {
            pointerType: window.matchMedia('(pointer: fine)').matches ? 'fine (mouse)' :
                window.matchMedia('(pointer: coarse)').matches ? 'coarse (touch)' : 'none',
            anyPointer: window.matchMedia('(any-pointer: fine)').matches ? 'fine' :
                window.matchMedia('(any-pointer: coarse)').matches ? 'coarse' : 'none',
            hover: window.matchMedia('(hover: hover)').matches,
            anyHover: window.matchMedia('(any-hover: hover)').matches,
            maxTouchPoints: navigator.maxTouchPoints,
            mouseLikely: window.matchMedia('(pointer: fine)').matches &&
                window.matchMedia('(hover: hover)').matches
        }
    },

    probeTouch() {
        return {
            maxTouchPoints: navigator.maxTouchPoints,
            touchEvent: 'ontouchstart' in window,
            touchForce: 'ontouchforcechange' in window,  // Apple Pencil pressure
            pointerEvents: 'onpointerdown' in window,
            isTouchDevice: navigator.maxTouchPoints > 0
        }
    },

    probeGamepad() {
        try {
            const pads = navigator.getGamepads()
            const connected = Array.from(pads).filter(Boolean)
            return {
                api: 'getGamepads' in navigator,
                connected: connected.length,
                devices: connected.map(g => ({
                    id: g.id,
                    buttons: g.buttons.length,
                    axes: g.axes.length
                }))
            }
        } catch { return { api: false } }
    },

    probePrinter() {
        return {
            // print media query available = system has print subsystem
            printMedia: window.matchMedia('print').media === 'print',
            // color print capability
            colorPrint: window.matchMedia('(color)').matches,
            // monochrome
            mono: window.matchMedia('(monochrome)').matches
        }
    },

    probeCamera() {
        // basic check — full count is in permissions module
        return {
            mediaDevices: 'mediaDevices' in navigator,
            getUserMedia: 'getUserMedia' in navigator ||
                'getUserMedia' in (navigator.mediaDevices || {})
        }
    },

    async probeBattery() {
        try {
            const b = await navigator.getBattery()
            return {
                present: true,
                level: b.level,
                charging: b.charging,
                chargingTime: b.chargingTime,
                dischargingTime: b.dischargingTime,
                // always charging + level=1 + chargingTime=0 = desktop or VM
                likelyDesktopOrVM: b.charging && b.level === 1 && b.chargingTime === 0
            }
        } catch { return { present: false } }
    },

    async probeUSB() {
        try {
            if (!navigator.usb) return { api: false }
            const devices = await navigator.usb.getDevices()
            return {
                api: true,
                count: devices.length,
                devices: devices.map(d => ({
                    vendor: d.vendorId,
                    product: d.productId,
                    name: d.productName || 'unknown',
                    mfg: d.manufacturerName || 'unknown'
                }))
            }
        } catch { return { api: true, count: 'permission_denied' } }
    },

    async probeHID() {
        try {
            if (!navigator.hid) return { api: false }
            const devices = await navigator.hid.getDevices()
            return {
                api: true,
                count: devices.length,
                devices: devices.map(d => ({
                    vendor: d.vendorId,
                    product: d.productId,
                    name: d.productName || 'unknown'
                }))
            }
        } catch { return { api: true, count: 'permission_denied' } }
    },

    async probeBluetooth() {
        try {
            if (!navigator.bluetooth) return { api: false }
            const available = await navigator.bluetooth.getAvailability()
            return {
                api: true,
                available,
                // getDevices() only returns previously paired devices
                devices: await navigator.bluetooth.getDevices()
                    .then(d => d.length)
                    .catch(() => 'permission_denied')
            }
        } catch { return { api: false } }
    },

    probeDisplays() {
        return {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            // taskbar/dock size
            taskbarH: screen.height - screen.availHeight,
            taskbarW: screen.width - screen.availWidth,
            colorDepth: screen.colorDepth,
            pixelRatio: devicePixelRatio,
            // orientation
            orientation: screen.orientation?.type || 'unknown',
            // multiple displays — if availWidth > single monitor width
            multiDisplay: screen.availWidth > screen.width
        }
    },

    async probeAudioDevices() {
        try {
            const ctx = new AudioContext()
            const devices = await navigator.mediaDevices.enumerateDevices()
            const audio = devices.filter(d => d.kind === 'audiooutput')
            ctx.close()
            return {
                outputCount: audio.length,
                sampleRate: ctx.sampleRate,
                sampleRateClass: ctx.sampleRate >= 96000 ? 'high_end' :
                    ctx.sampleRate >= 48000 ? 'standard' : 'consumer',
                baseLatency: ctx.baseLatency
            }
        } catch { return 'blocked' }
    },

    // ─── VM DETECTION ───────────────────────────────────────────────────────────

    async detectVM() {
        const flags = []
        let score = 0

        const gpu = await this.getGPUString()

        const vmGPUs = [
            'vmware', 'virtualbox', 'virtual', 'llvmpipe',
            'softpipe', 'swiftshader', 'microsoft basic render',
            'parallels', 'qemu', 'bochs', 'hyper-v'
        ]
        if (vmGPUs.some(v => gpu.toLowerCase().includes(v))) {
            flags.push('vm_gpu_string')
            score += 0.6
        }

        if (gpu.toLowerCase().includes('swiftshader')) {
            flags.push('swiftshader_renderer')
            score += 0.4
        }

        try {
            const b = await navigator.getBattery()
            if (b.charging && b.level === 1 && b.chargingTime === 0 && b.dischargingTime === null) {
                flags.push('battery_always_full')
                score += 0.2
            }
        } catch { }

        const cores = navigator.hardwareConcurrency
        if (cores <= 2) { flags.push('low_cpu_cores'); score += 0.15 }

        const vmRes = ['800x600', '1024x768', '1280x800', '1280x1024']
        const res = `${screen.width}x${screen.height}`
        if (vmRes.includes(res)) { flags.push('vm_screen_resolution'); score += 0.2 }

        if (navigator.maxTouchPoints === 0 &&
            !navigator.bluetooth &&
            navigator.hardwareConcurrency <= 2) {
            flags.push('no_peripheral_apis')
            score += 0.1
        }

        const timerRes = this.measureTimerRes()
        if (timerRes > 1.0) { flags.push('coarse_timer'); score += 0.15 }

        return {
            flags,
            score: parseFloat(Math.min(score, 1).toFixed(2)),
            likely: score >= 0.4,
            gpuStr: gpu
        }
    },

    // ─── BOT DETECTION ──────────────────────────────────────────────────────────

    async detectBot() {
        const flags = []
        let score = 0

        if (navigator.webdriver) {
            flags.push('webdriver_flag')
            score += 0.9
        }

        if (window.chrome?.app?.isInstalled === false ||
            document.documentElement.getAttribute('webdriver')) {
            flags.push('automation_attribute')
            score += 0.5
        }

        const botProps = [
            '__playwright', '__pw_manual', '__selenium_evaluate',
            '__webdriverFunc', '_phantom', '__nightmare',
            'callPhantom', '_selenium', 'domAutomation'
        ]
        for (const p of botProps) {
            if (p in window) { flags.push(`bot_prop_${p}`); score += 0.7 }
        }

        if (!window.chrome && navigator.userAgent.includes('Chrome')) {
            flags.push('missing_chrome_object')
            score += 0.3
        }

        try {
            const n = await navigator.permissions.query({ name: 'notifications' })
            if (n.state === 'denied' && !navigator.webdriver) {
                flags.push('notifications_denied_no_user')
                score += 0.15
            }
        } catch { }

        if (navigator.plugins.length === 0) {
            flags.push('no_plugins')
            score += 0.2
        }

        if (!navigator.languages || navigator.languages.length === 0) {
            flags.push('no_languages')
            score += 0.3
        }

        if (window._fpBehavioral && window._fpBehavioral.mouseSpeed < 0.001) {
            flags.push('zero_mouse_movement')
            score += 0.2
        }

        const rafJitter = await this.measureRAFJitter()
        if (rafJitter < 0.1) { flags.push('zero_raf_jitter'); score += 0.2 }

        return {
            flags,
            score: parseFloat(Math.min(score, 1).toFixed(2)),
            likely: score >= 0.4
        }
    },

    // ─── SANDBOX / PRIVACY BROWSER DETECTION ───────────────────────────────────

    async detectSandbox() {
        const flags = []
        let score = 0

        const isBrave = await this.detectBrave()
        if (isBrave) { flags.push('brave_browser'); score += 0.4 }

        const isRFP = this.detectRFP()
        if (isRFP) { flags.push('firefox_rfp'); score += 0.5 }

        const isTor = this.detectTor()
        if (isTor) { flags.push('tor_browser'); score += 0.8 }

        if (!navigator.deviceMemory || navigator.deviceMemory <= 0.25) {
            flags.push('device_memory_capped')
            score += 0.2
        }

        const canvasBlocked = this.detectCanvasBlock()
        if (canvasBlocked) { flags.push('canvas_blocked'); score += 0.3 }

        const tzMismatch = this.detectTimezoneMismatch()
        if (tzMismatch) { flags.push('timezone_locale_mismatch'); score += 0.2 }

        if (navigator.hardwareConcurrency === 2 && navigator.deviceMemory >= 4) {
            flags.push('cpu_count_spoofed')
            score += 0.2
        }

        try {
            const c = document.createElement('canvas')
            const gl = c.getContext('webgl')
            if (!gl) { flags.push('webgl_blocked'); score += 0.25 }
        } catch { flags.push('webgl_blocked'); score += 0.25 }

        return {
            flags,
            score: parseFloat(Math.min(score, 1).toFixed(2)),
            likely: score >= 0.3,
            isBrave,
            isRFP,
            isTor
        }
    },

    // ─── HELPERS ────────────────────────────────────────────────────────────────

    async getGPUString() {
        try {
            const c = document.createElement('canvas')
            const gl = c.getContext('webgl')
            const ex = gl?.getExtension('WEBGL_debug_renderer_info')
            return ex ? gl.getParameter(ex.UNMASKED_RENDERER_WEBGL) : 'unknown'
        } catch { return 'unknown' }
    },

    measureTimerRes() {
        const s = []
        for (let i = 0; i < 50; i++) s.push(performance.now())
        const d = s.slice(1).map((v, i) => v - s[i]).filter(d => d > 0)
        return d.length ? Math.min(...d) : 0
    },

    async measureRAFJitter() {
        return new Promise(resolve => {
            const times = []
            let last = 0
            let frames = 0
            const tick = t => {
                if (last) times.push(t - last)
                last = t
                if (++frames < 10) requestAnimationFrame(tick)
                else {
                    const avg = times.reduce((a, b) => a + b, 0) / times.length
                    const jitter = times.reduce((a, b) => a + Math.abs(b - avg), 0) / times.length
                    resolve(parseFloat(jitter.toFixed(4)))
                }
            }
            requestAnimationFrame(tick)
        })
    },

    async detectBrave() {
        try {
            if (navigator.brave && await navigator.brave.isBrave()) return true
        } catch { }
        const pluginNames = Array.from(navigator.plugins).map(p => p.name)
        const hasRandom = pluginNames.some(n => /^[A-Z][a-z]{5,9}$/.test(n))
        return hasRandom
    },

    detectRFP() {
        return navigator.userAgent.includes('Firefox') &&
            screen.width === 1920 &&
            screen.height === 1080 &&
            navigator.hardwareConcurrency === 2
    },

    detectTor() {
        return navigator.userAgent.includes('Firefox') &&
            window.innerWidth === 1000 &&
            window.innerHeight === 900
    },

    detectCanvasBlock() {
        try {
            const c = document.createElement('canvas')
            const ctx = c.getContext('2d')
            ctx.fillStyle = 'red'
            ctx.fillRect(0, 0, 10, 10)
            const d = ctx.getImageData(0, 0, 1, 1).data
            return d[0] === 0 && d[1] === 0 && d[2] === 0 && d[3] === 0
        } catch { return true }
    },

    detectTimezoneMismatch() {
        const lang = navigator.language || ''
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (lang.startsWith('en-US') && !tz.startsWith('America/')) return true
        return false
    },

    // ─── VERDICT ────────────────────────────────────────────────────────────────

    buildVerdict(result) {
        const vm = result.vm?.score || 0
        const bot = result.bot?.score || 0
        const sandbox = result.sandbox?.score || 0

        const combined = Math.min(vm * 0.4 + bot * 0.4 + sandbox * 0.2, 1)

        let label
        if (bot >= 0.6) label = 'bot'
        else if (vm >= 0.5) label = 'vm'
        else if (sandbox >= 0.5) label = 'privacy_browser'
        else if (combined >= 0.3) label = 'suspicious'
        else label = 'real_device'

        return {
            label,
            confidence: parseFloat((1 - combined).toFixed(2)),
            scores: { vm, bot, sandbox, combined: parseFloat(combined.toFixed(2)) },
            flags: [
                ...(result.vm?.flags || []),
                ...(result.bot?.flags || []),
                ...(result.sandbox?.flags || [])
            ]
        }
    }

}