const FP = {
    async collect() {
        BehavioralFingerprint.start()

        const [browser, hardware, os, network, extensions, permissions, environment,
            storage, timing, codecs] =
            await Promise.allSettled([
                Promise.resolve(BrowserFingerprint.collect()),
                HardwareFingerprint.collect(),
                OSFingerprint.collect(),
                NetworkFingerprint.collect(),
                ExtensionFingerprint.collect(),
                PermissionsFingerprint.collect(),
                EnvironmentDetector.collect(),
                StorageFingerprint.collect(),
                TimingFingerprint.collect(),
                CodecsFingerprint.collect()
            ])

        const data = {
            timestamp: new Date().toISOString(),
            browser: browser.value ?? 'error',
            hardware: hardware.value ?? 'error',
            os: os.value ?? 'error',
            network: network.value ?? 'error',
            extensions: extensions.value ?? 'error',
            permissions: permissions.value ?? 'error',
            environment: environment.value ?? 'error',
            storage: storage.value ?? 'error',
            timing: timing.value ?? 'error',
            codecs: codecs.value ?? 'error',
            behavioral: BehavioralFingerprint.collect()
        }

        data.stableHash = await this.hash(
            JSON.stringify(data.browser.canvas) +
            JSON.stringify(data.browser.fonts) +
            JSON.stringify(data.hardware?.gpu) +
            JSON.stringify(data.hardware?.webgl) +
            JSON.stringify(data.hardware?.audio) +
            JSON.stringify(data.hardware?.codecs) +
            JSON.stringify(data.hardware?.display) +
            JSON.stringify(data.hardware?.cpu) +
            JSON.stringify(data.os?.rendering) +
            JSON.stringify(data.os?.fonts) +
            JSON.stringify(data.os?.timerRes)
        )

        data.fullHash = await this.hash(JSON.stringify(data))
        data.verdict = data.environment?.verdict ?? null

        return data
    },

    async hash(str) {
        const buf = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(str)
        )
        return Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    },

    async run(logEndpoint = '/log') {
        const data = await this.collect()

        fetch(logEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
            .then(r => console.log('logged:', r.status))
            .catch(e => console.error('log error:', e))

        return data
    }
}
