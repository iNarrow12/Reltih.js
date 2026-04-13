const BrowserFingerprint = {
    collect() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            screen: {
                width: screen.width,
                height: screen.height,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                colorDepth: screen.colorDepth,
                pixelRatio: devicePixelRatio
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            canvas: this.getCanvasHash(),
            fonts: this.detectFonts()
        }
    },

    getCanvasHash() {
        try {
            const c = document.createElement('canvas')
            const ctx = c.getContext('2d')
            ctx.textBaseline = 'top'
            ctx.font = '14px Arial'
            ctx.fillStyle = '#f60'
            ctx.fillRect(125, 1, 62, 20)
            ctx.fillStyle = '#069'
            ctx.fillText('fingerprint.js 🔍', 2, 15)
            ctx.fillStyle = 'rgba(102,204,0,0.7)'
            ctx.fillText('fingerprint.js 🔍', 4, 17)
            return c.toDataURL().slice(-50)
        } catch {
            return 'blocked'
        }
    },

    detectFonts() {
        const testFonts = [
            'Arial', 'Courier New', 'Georgia', 'Times New Roman',
            'Verdana', 'Comic Sans MS', 'Impact', 'Tahoma',
            'Trebuchet MS', 'Calibri', 'Cambria', 'Consolas'
        ]
        const base = 'monospace'
        const testStr = 'mmmmmmmmmmlli'
        const c = document.createElement('canvas')
        const ctx = c.getContext('2d')

        ctx.font = `72px ${base}`
        const baseWidth = ctx.measureText(testStr).width

        return testFonts.filter(font => {
            ctx.font = `72px ${font}, ${base}`
            return ctx.measureText(testStr).width !== baseWidth
        })
    }
}