const NetworkFingerprint = {
    async collect() {
        const [webrtc, geoip] = await Promise.allSettled([
            this.getWebRTC(),
            this.getGeoIP()
        ])

        return {
            connection: this.getConnection(),
            webrtc: webrtc.value ?? 'error',
            geoip: geoip.value ?? 'error',
            timing: await this.getNetworkTiming()
        }
    },

    getConnection() {
        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection
        if (!c) return 'unsupported'
        return {
            effectiveType: c.effectiveType,
            downlink: c.downlink,
            rtt: c.rtt,
            saveData: c.saveData,
            type: c.type
        }
    },

    getWebRTC() {
        return new Promise(resolve => {
            try {
                const ips = { local: [], public: [] }
                const pc = new RTCPeerConnection({ iceServers: [] })
                const timer = setTimeout(() => {
                    pc.close()
                    resolve(ips.local.length ? ips : 'timeout')
                }, 3000)

                pc.createDataChannel('')
                pc.createOffer()
                    .then(o => pc.setLocalDescription(o))
                    .catch(() => { clearTimeout(timer); resolve('offer_failed') })

                pc.onicecandidate = e => {
                    if (!e || !e.candidate) return

                    const cand = e.candidate.candidate
                    const ipv4 = cand.match(/(\d{1,3}\.){3}\d{1,3}/g) || []
                    const ipv6 = cand.match(/([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}/gi) || []

                    for (const ip of ipv4) {
                        if (ip.startsWith('192.168') ||
                            ip.startsWith('10.') ||
                            ip.startsWith('172.')) ips.local.push(ip)
                        else if (!ip.startsWith('0.') && ip !== '0.0.0.0') ips.public.push(ip)
                    }
                    for (const ip of ipv6) ips.local.push(ip)

                    ips.local = [...new Set(ips.local)]
                    ips.public = [...new Set(ips.public)]

                    if (ips.local.length) {
                        clearTimeout(timer)
                        pc.close()
                        resolve({
                            local: ips.local,
                            public: ips.public,
                            subnet: this.getSubnetClass(ips.local[0]),
                            networkType: this.guessNetworkType(ips.local[0])
                        })
                    }
                }
            } catch (e) { resolve('blocked') }
        })
    },

    getSubnetClass(ip) {
        if (!ip) return 'unknown'
        if (ip.startsWith('192.168.')) return '192.168.x.x (home/office)'
        if (ip.startsWith('10.')) return '10.x.x.x (corporate/vpn)'
        if (ip.match(/^172\.(1[6-9]|2\d|3[01])\./)) return '172.16-31.x.x (vpn/docker)'
        if (ip.startsWith('169.254.')) return '169.254.x.x (link-local, no DHCP)'
        return 'other'
    },

    guessNetworkType(ip) {
        if (!ip) return 'unknown'
        if (ip.startsWith('10.')) return 'corporate or vpn'
        if (ip.startsWith('192.168.')) return 'home or office wifi'
        if (ip.match(/^172\.(1[6-9]|2\d|3[01])\./)) return 'vpn or container'
        return 'unknown'
    },

    async getGeoIP() {
        try {
            const res = await fetch('https://ipapi.co/json/', {
                signal: AbortSignal.timeout(5000)
            })
            if (!res.ok) throw new Error('fetch failed')
            const d = await res.json()
            return {
                ip: d.ip,
                city: d.city,
                region: d.region,
                country: d.country_name,
                countryCode: d.country_code,
                latitude: d.latitude,
                longitude: d.longitude,
                isp: d.org,
                asn: d.asn,
                timezone: d.timezone,
                currency: d.currency,
                callingCode: d.country_calling_code
            }
        } catch { return 'failed' }
    },

    async getNetworkTiming() {
        const endpoints = [
            { name: 'cloudflare', url: 'https://1.1.1.1/favicon.ico' },
            { name: 'google', url: 'https://www.google.com/favicon.ico' }
        ]

        const results = {}
        for (const ep of endpoints) {
            try {
                const t0 = performance.now()
                await fetch(ep.url, {
                    mode: 'no-cors',
                    cache: 'no-store',
                    signal: AbortSignal.timeout(3000)
                })
                results[ep.name] = parseFloat((performance.now() - t0).toFixed(2))
            } catch { results[ep.name] = 'timeout' }
        }
        return results
    }
}