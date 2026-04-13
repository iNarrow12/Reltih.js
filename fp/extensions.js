const ExtensionFingerprint = {
    async collect() {
        return {
            adblock: await this.detectAdblock(),
            domInjections: this.detectDOMInjections(),
            avDetection: await this.detectAV(),
            knownExtensions: await this.probeKnownExtensions()
        }
    },

    detectAdblock() {
        return new Promise(resolve => {
            const bait = document.createElement('div')
            bait.className = 'ad-banner pub_300x250 pub_300x250m adsbox'
            bait.style.cssText = 'width:1px;height:1px;position:absolute;left:-9999px'
            document.body.appendChild(bait)
            setTimeout(() => {
                const blocked = bait.offsetHeight === 0 ||
                    bait.offsetWidth === 0 ||
                    window.getComputedStyle(bait).display === 'none'
                document.body.removeChild(bait)
                resolve(blocked)
            }, 100)
        })
    },

    detectDOMInjections() {
        const detected = []

        if (document.querySelector('[data-grammarly-shadow-root]') ||
            document.querySelector('grammarly-desktop-integration'))
            detected.push('grammarly')

        if (document.querySelector('[data-lpignore]') ||
            document.querySelector('[data-lastpass-icon-root]'))
            detected.push('lastpass')

        if (document.querySelector('[data-dashlane-rid]'))
            detected.push('dashlane')

        if (document.querySelector('[data-1p-id]'))
            detected.push('1password')

        if (document.querySelector('[data-bwi-id]'))
            detected.push('bitwarden')

        return detected
    },

    async detectAV() {
        try {
            const res = await fetch('https://secure.eicar.org/eicar.com.txt', {
                signal: AbortSignal.timeout(3000)
            })
            const txt = await res.text()
            return txt.includes('EICAR') ? 'no_av_detected' : 'possible_av'
        } catch (e) {
            if (e.name === 'TimeoutError') return 'timeout'
            return 'blocked_by_av_or_firewall'
        }
    },

    probeKnownExtensions() {
        const extensions = [
            { name: 'Adblock Plus', id: 'cfhdojbkjhnklbpkdaibdccddilifddb', res: 'icons/icon16.png' },
            { name: 'uBlock Origin', id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm', res: 'img/icon16.png' },
            { name: 'Privacy Badger', id: 'pkehgijcmpdhfbdbbnkijodmdjhbjlgp', res: 'icons/badger16.png' }
        ]

        const probes = extensions.map(ext => {
            return new Promise(resolve => {
                const img = new Image()
                const timer = setTimeout(() => resolve({ name: ext.name, detected: false }), 500)
                img.onload = () => { clearTimeout(timer); resolve({ name: ext.name, detected: true }) }
                img.onerror = () => { clearTimeout(timer); resolve({ name: ext.name, detected: false }) }
                img.src = `chrome-extension://${ext.id}/${ext.res}`
            })
        })

        return Promise.all(probes).then(results =>
            results.filter(r => r.detected).map(r => r.name)
        )
    }
}