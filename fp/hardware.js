const HardwareFingerprint = {
    async collect() {
        return {
            cpu: this.getCPU(),
            memory: this.getMemory(),
            gpu: this.getGPU(),
            audio: this.getAudioHash(),
            battery: await this.getBattery(),
            network: this.getNetwork(),
            webgl: this.getWebGLParams()
        }
    },

    getCPU() {
        return {
            cores: navigator.hardwareConcurrency || 'unknown'
        }
    },

    getMemory() {
        return navigator.deviceMemory || 'unknown'
    },

    getGPU() {
        try {
            const c = document.createElement('canvas')
            const gl = c.getContext('webgl') || c.getContext('experimental-webgl')
            if (!gl) return 'blocked'
            const ext = gl.getExtension('WEBGL_debug_renderer_info')
            if (!ext) return 'no_ext'
            return {
                vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
                renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
            }
        } catch {
            return 'blocked'
        }
    },

    getAudioHash() {
        try {
            const ctx = new OfflineAudioContext(1, 44100, 44100)
            const osc = ctx.createOscillator()
            const comp = ctx.createDynamicsCompressor()
            osc.type = 'triangle'
            osc.frequency.value = 10000
            comp.threshold.value = -50
            comp.knee.value = 40
            comp.ratio.value = 12
            comp.attack.value = 0
            comp.release.value = 0.25
            osc.connect(comp)
            comp.connect(ctx.destination)
            osc.start(0)
            // returns a promise — resolved in core.js
            return ctx.startRendering().then(buf => {
                const data = buf.getChannelData(0).slice(4500, 5000)
                return data.reduce((a, b) => a + Math.abs(b), 0).toString()
            })
        } catch {
            return Promise.resolve('blocked')
        }
    },

    async getBattery() {
        try {
            const b = await navigator.getBattery()
            return {
                level: b.level,
                charging: b.charging,
                chargingTime: b.chargingTime,
                dischargingTime: b.dischargingTime
            }
        } catch {
            return 'unsupported'
        }
    },

    getNetwork() {
        const c = navigator.connection
        if (!c) return 'unsupported'
        return {
            effectiveType: c.effectiveType,
            downlink: c.downlink,
            rtt: c.rtt,
            saveData: c.saveData
        }
    },

    getWebGLParams() {
        try {
            const c = document.createElement('canvas')
            const gl = c.getContext('webgl')
            if (!gl) return 'blocked'
            return {
                maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
                shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                vendor: gl.getParameter(gl.VENDOR),
                version: gl.getParameter(gl.VERSION)
            }
        } catch {
            return 'blocked'
        }
    }
}