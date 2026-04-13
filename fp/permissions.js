const PermissionsFingerprint = {
    async collect() {
        const [perms, media, storage] = await Promise.allSettled([
            this.queryPermissions(),
            this.getMediaDevices(),
            this.getStorageAccess()
        ])

        return {
            permissions: perms.value ?? 'error',
            mediaDevices: media.value ?? 'error',
            storage: storage.value ?? 'error',
            apis: this.detectAPIs()
        }
    },

    async queryPermissions() {
        const permList = [
            'camera', 'microphone', 'geolocation', 'notifications',
            'clipboard-read', 'clipboard-write', 'accelerometer',
            'gyroscope', 'magnetometer', 'ambient-light-sensor',
            'midi', 'payment-handler', 'background-sync', 'persistent-storage'
        ]

        const results = {}
        for (const perm of permList) {
            try {
                const status = await navigator.permissions.query({ name: perm })
                results[perm] = status.state
            } catch {
                results[perm] = 'unsupported'
            }
        }
        return results
    },

    async getMediaDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const grouped = { audioinput: [], audiooutput: [], videoinput: [] }

            for (const d of devices) {
                if (grouped[d.kind] !== undefined) {
                    grouped[d.kind].push({
                        id: d.deviceId === 'default' ? 'default' : d.deviceId.slice(0, 8),
                        label: d.label || 'hidden',
                        group: d.groupId.slice(0, 8)
                    })
                }
            }

            return {
                micCount: grouped.audioinput.length,
                speakerCount: grouped.audiooutput.length,
                cameraCount: grouped.videoinput.length,
                devices: grouped
            }
        } catch { return 'blocked' }
    },

    async getStorageAccess() {
        const result = {}

        result.localStorage = (() => {
            try { localStorage.setItem('_fp', '1'); localStorage.removeItem('_fp'); return true }
            catch { return false }
        })()

        result.sessionStorage = (() => {
            try { sessionStorage.setItem('_fp', '1'); sessionStorage.removeItem('_fp'); return true }
            catch { return false }
        })()

        result.indexedDB = !!window.indexedDB
        result.cookies = navigator.cookieEnabled
        result.cacheAPI = 'caches' in window

        try {
            result.persisted = await navigator.storage.persisted()
        } catch { result.persisted = 'unsupported' }

        return result
    },

    detectAPIs() {
        return {
            bluetooth: 'bluetooth' in navigator,
            usb: 'usb' in navigator,
            serial: 'serial' in navigator,
            hid: 'hid' in navigator,
            nfc: 'nfc' in navigator,
            wakeLock: 'wakeLock' in navigator,
            share: 'share' in navigator,
            contacts: 'contacts' in navigator,
            xr: 'xr' in navigator,
            virtualKeyboard: 'virtualKeyboard' in navigator,
            ink: 'ink' in navigator,
            windowControls: 'windowControlsOverlay' in navigator,
            gpu: 'gpu' in navigator,
            ml: 'ml' in navigator,
            presentation: 'presentation' in navigator,
            credentials: 'credentials' in navigator,
            payment: 'PaymentRequest' in window,
            speechRecog: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
            speechSynth: 'speechSynthesis' in window,
            gamepad: 'getGamepads' in navigator,
            midi: 'requestMIDIAccess' in navigator,
            eyeDropper: 'EyeDropper' in window,
            fileSystem: 'showOpenFilePicker' in window
        }
    }
}