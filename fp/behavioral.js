const BehavioralFingerprint = {
    data: {
        mouse: [],
        keys: [],
        scroll: [],
        clicks: []
    },

    start() {
        document.addEventListener('mousemove', e => {
            this.data.mouse.push({
                x: e.clientX, y: e.clientY,
                t: performance.now()
            })
            if (this.data.mouse.length > 50) this.data.mouse.shift()
        })

        document.addEventListener('keydown', e => {
            this.data.keys.push({ key: e.code, t: performance.now(), type: 'down' })
        })
        document.addEventListener('keyup', e => {
            this.data.keys.push({ key: e.code, t: performance.now(), type: 'up' })
            if (this.data.keys.length > 100) this.data.keys.shift()
        })

        document.addEventListener('scroll', () => {
            this.data.scroll.push({
                y: window.scrollY,
                t: performance.now()
            })
            if (this.data.scroll.length > 50) this.data.scroll.shift()
        })

        document.addEventListener('click', e => {
            this.data.clicks.push({
                x: e.clientX, y: e.clientY,
                t: performance.now(),
                button: e.button
            })
        })
    },

    collect() {
        return {
            mouseSpeed: this.calcMouseSpeed(),
            keystrokeDwell: this.calcKeystrokeDwell(),
            scrollPattern: this.data.scroll.slice(-10),
            clickCount: this.data.clicks.length,
            clicks: this.data.clicks.slice(-5)
        }
    },

    calcMouseSpeed() {
        const pts = this.data.mouse
        if (pts.length < 2) return 0
        let totalDist = 0
        for (let i = 1; i < pts.length; i++) {
            const dx = pts[i].x - pts[i - 1].x
            const dy = pts[i].y - pts[i - 1].y
            totalDist += Math.sqrt(dx * dx + dy * dy)
        }
        const timeSpan = pts[pts.length - 1].t - pts[0].t
        return timeSpan > 0 ? (totalDist / timeSpan).toFixed(3) : 0
    },

    calcKeystrokeDwell() {
        const downs = {}
        const dwells = []
        for (const k of this.data.keys) {
            if (k.type === 'down') downs[k.key] = k.t
            else if (k.type === 'up' && downs[k.key]) {
                dwells.push(k.t - downs[k.key])
                delete downs[k.key]
            }
        }
        if (!dwells.length) return 0
        return (dwells.reduce((a, b) => a + b, 0) / dwells.length).toFixed(2)
    }
}