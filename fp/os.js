const OSFingerprint = {
    async collect() {
        return {
            basic: this.getBasic(),
            highEntropy: await this.getHighEntropy(),
            fonts: this.detectOSFonts(),
            timerRes: this.getTimerResolution(),
            rendering: this.getRenderingDiffs(),
            keyboard: this.getKeyboardHints(),
            speech: this.getSpeechVoices()
        }
    },

    getBasic() {
        return {
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            appVersion: navigator.appVersion,
            vendor: navigator.vendor,
            language: navigator.language,
            languages: Array.from(navigator.languages || []),
            doNotTrack: navigator.doNotTrack,
            cookieEnabled: navigator.cookieEnabled,
            pdfViewer: navigator.pdfViewerEnabled || false,
            maxTouchPoints: navigator.maxTouchPoints
        }
    },

    async getHighEntropy() {
        try {
            if (!navigator.userAgentData) return 'unsupported'
            const h = await navigator.userAgentData.getHighEntropyValues([
                'platform',
                'platformVersion',
                'architecture',
                'bitness',
                'model',
                'uaFullVersion',
                'fullVersionList'
            ])
            return {
                platform: h.platform,
                platformVersion: h.platformVersion,
                architecture: h.architecture,
                bitness: h.bitness,
                model: h.model,
                uaFullVersion: h.uaFullVersion,
                fullVersionList: h.fullVersionList,
                osVersion: this.parseOSVersion(h.platform, h.platformVersion),
                brands: navigator.userAgentData.brands,
                mobile: navigator.userAgentData.mobile
            }
        } catch { return 'blocked' }
    },

    parseOSVersion(platform, version) {
        if (!platform || !version) return 'unknown'
        if (platform === 'Windows') {
            const major = parseInt(version.split('.')[0])
            if (major >= 13) return 'Windows 11'
            if (major >= 1) return 'Windows 10'
            return 'Windows (old)'
        }
        if (platform === 'macOS') return `macOS ${version}`
        if (platform === 'Linux') return 'Linux'
        if (platform === 'Android') return `Android ${version}`
        return `${platform} ${version}`
    },

    detectOSFonts() {
        const fontMap = {
            windows: [
                'Segoe UI', 'Segoe UI Light', 'Segoe UI Semibold',
                'Calibri', 'Consolas', 'Cambria', 'Candara',
                'MS Gothic', 'MS PGothic', 'MS UI Gothic',
                'Marlett', 'Webdings', 'Wingdings'
            ],
            macos: [
                'Helvetica Neue', 'Lucida Grande', 'Monaco',
                'Menlo', 'Optima', 'Futura', 'Gill Sans',
                'Baskerville', 'Hoefler Text', 'Didot'
            ],
            linux: [
                'Ubuntu', 'Ubuntu Mono', 'DejaVu Sans',
                'DejaVu Serif', 'Liberation Sans', 'Liberation Mono',
                'Noto Sans', 'Noto Serif', 'FreeSans', 'FreeSerif'
            ],
            android: [
                'Roboto', 'Roboto Condensed', 'Noto Serif',
                'Droid Sans', 'Droid Serif', 'Droid Sans Mono'
            ]
        }

        const base = 'monospace'
        const c = document.createElement('canvas')
        const ctx = c.getContext('2d')
        const str = 'mmmmmmmmmmlli'
        ctx.font = `72px ${base}`
        const bw = ctx.measureText(str).width

        const detected = {}
        for (const [os, fonts] of Object.entries(fontMap)) {
            detected[os] = fonts.filter(f => {
                ctx.font = `72px "${f}", ${base}`
                return ctx.measureText(str).width !== bw
            })
        }

        const scores = Object.entries(detected).map(([os, hits]) => ({ os, score: hits.length }))
        scores.sort((a, b) => b.score - a.score)

        return {
            detected,
            probableOS: scores[0]?.score > 0 ? scores[0].os : 'unknown'
        }
    },

    getTimerResolution() {
        const samples = []
        for (let i = 0; i < 100; i++) samples.push(performance.now())
        const deltas = samples.slice(1)
            .map((v, i) => v - samples[i])
            .filter(d => d > 0)
        return {
            minDelta: deltas.length ? parseFloat(Math.min(...deltas).toFixed(6)) : 'unknown',
            avgDelta: deltas.length ? parseFloat((deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(6)) : 'unknown'
        }
    },

    getRenderingDiffs() {
        try {
            const c = document.createElement('canvas')
            c.width = 500
            c.height = 60
            const ctx = c.getContext('2d')
            ctx.textBaseline = 'alphabetic'
            ctx.font = '16px Arial, sans-serif'
            ctx.fillStyle = '#069'
            ctx.fillRect(100, 1, 80, 30)
            ctx.fillStyle = 'rgba(102,204,0,0.8)'
            ctx.fillText('OS render test Ag gy', 10, 40)
            return c.toDataURL('image/png').slice(-100)
        } catch { return 'blocked' }
    },

    getKeyboardHints() {
        return {
            keyboard: navigator.keyboard ? 'available' : 'unavailable',
        }
    },

    getSpeechVoices() {
        try {
            const voices = speechSynthesis.getVoices()
            if (!voices.length) {
                return new Promise(resolve => {
                    speechSynthesis.onvoiceschanged = () => {
                        const v = speechSynthesis.getVoices()
                        resolve(this.parseVoices(v))
                    }
                    setTimeout(() => resolve('timeout'), 1000)
                })
            }
            return this.parseVoices(voices)
        } catch { return 'unsupported' }
    },

    parseVoices(voices) {
        return {
            count: voices.length,
            voices: voices.map(v => ({
                name: v.name,
                lang: v.lang,
                local: v.localService,
                default: v.default
            })).slice(0, 20)
        }
    }
}
