const CodecsFingerprint = {

    async collect() {
        return {
            video: this.videoCodecs(),
            audio: this.audioCodecs(),
            media: this.mediaCapabilities(),
            drm: await this.drmSupport(),
            mse: this.mseSupport(),
            webrtcCodecs: await this.webrtcCodecs()
        }
    },

    videoCodecs() {
        const v = document.createElement('video')
        const tests = [
            ['h264_baseline', 'video/mp4; codecs="avc1.42E01E"'],
            ['h264_main', 'video/mp4; codecs="avc1.4D401E"'],
            ['h264_high', 'video/mp4; codecs="avc1.64001E"'],
            ['h265_main', 'video/mp4; codecs="hev1.1.6.L93.B0"'],
            ['h265_main10', 'video/mp4; codecs="hev1.2.4.L120.B0"'],
            ['vp8', 'video/webm; codecs="vp8"'],
            ['vp9', 'video/webm; codecs="vp9"'],
            ['vp9_profile2', 'video/webm; codecs="vp9.2"'],
            ['av1', 'video/mp4; codecs="av01.0.05M.08"'],
            ['av1_10bit', 'video/mp4; codecs="av01.0.05M.10"'],
            ['theora', 'video/ogg; codecs="theora"'],
            ['mp4v', 'video/mp4; codecs="mp4v.20.8"'],
        ]
        return this._testMedia(v, tests)
    },

    audioCodecs() {
        const a = document.createElement('audio')
        const tests = [
            ['mp3', 'audio/mpeg'],
            ['mp3_layer3', 'audio/mpeg; codecs="mp3"'],
            ['aac_lc', 'audio/mp4; codecs="mp4a.40.2"'],
            ['aac_he', 'audio/mp4; codecs="mp4a.40.5"'],
            ['aac_he2', 'audio/mp4; codecs="mp4a.40.29"'],
            ['opus', 'audio/ogg; codecs="opus"'],
            ['opus_mp4', 'audio/mp4; codecs="opus"'],
            ['vorbis', 'audio/ogg; codecs="vorbis"'],
            ['flac', 'audio/flac'],
            ['flac_ogg', 'audio/ogg; codecs="flac"'],
            ['wav_pcm', 'audio/wav; codecs="1"'],
            ['wav_float', 'audio/wav; codecs="3"'],
            ['ac3', 'audio/mp4; codecs="ac-3"'],
            ['ec3', 'audio/mp4; codecs="ec-3"'],
            ['dtsx', 'audio/mp4; codecs="dtsx"'],
        ]
        return this._testMedia(a, tests)
    },

    _testMedia(el, tests) {
        const result = {}
        for (const [name, mime] of tests) {
            const r = el.canPlayType(mime)
            result[name] = r === '' ? 'no' : r
        }
        return result
    },

    async mediaCapabilities() {
        if (!navigator.mediaCapabilities) return 'unsupported'

        const tests = [
            {
                name: 'h264_1080p_hw',
                config: {
                    type: 'file',
                    video: {
                        contentType: 'video/mp4; codecs="avc1.4D4028"',
                        width: 1920, height: 1080, bitrate: 8000000, framerate: 30
                    }
                }
            },
            {
                name: 'h265_4k_hw',
                config: {
                    type: 'file',
                    video: {
                        contentType: 'video/mp4; codecs="hev1.1.6.L150.B0"',
                        width: 3840, height: 2160, bitrate: 20000000, framerate: 60
                    }
                }
            },
            {
                name: 'av1_1080p',
                config: {
                    type: 'file',
                    video: {
                        contentType: 'video/mp4; codecs="av01.0.08M.08"',
                        width: 1920, height: 1080, bitrate: 4000000, framerate: 30
                    }
                }
            },
            {
                name: 'vp9_4k',
                config: {
                    type: 'file',
                    video: {
                        contentType: 'video/webm; codecs="vp09.00.10.08"',
                        width: 3840, height: 2160, bitrate: 12000000, framerate: 30
                    }
                }
            }
        ]

        const results = {}
        for (const { name, config } of tests) {
            try {
                const r = await navigator.mediaCapabilities.decodingInfo(config)
                results[name] = {
                    supported: r.supported,
                    smooth: r.smooth,
                    powerEfficient: r.powerEfficient
                }
            } catch { results[name] = 'error' }
        }
        return results
    },

    async drmSupport() {
        const systems = [
            {
                name: 'widevine',
                keySystem: 'com.widevine.alpha',
                configs: [{
                    initDataTypes: ['cenc'],
                    videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: 'SW_SECURE_CRYPTO' }]
                }]
            },
            {
                name: 'playready',
                keySystem: 'com.microsoft.playready',
                configs: [{
                    initDataTypes: ['cenc'],
                    videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: 'SW_SECURE_CRYPTO' }]
                }]
            },
            {
                name: 'clearkey',
                keySystem: 'org.w3.clearkey',
                configs: [{
                    initDataTypes: ['webm'],
                    videoCapabilities: [{ contentType: 'video/webm; codecs="vp8"' }]
                }]
            }
        ]

        const results = {}
        for (const { name, keySystem, configs } of systems) {
            try {
                const access = await navigator.requestMediaKeySystemAccess(keySystem, configs)
                const config = access.getConfiguration()
                results[name] = {
                    supported: true,
                    sessionTypes: config.sessionTypes || [],
                    robustness: (config.videoCapabilities?.[0]?.robustness) || 'unknown'
                }
            } catch {
                results[name] = { supported: false }
            }
        }

        results.widevinelevel = await this._widevineLevel()
        return results
    },

    async _widevineLevel() {
        const levels = [
            { level: 'L1', robustness: 'HW_SECURE_ALL' },
            { level: 'L2', robustness: 'HW_SECURE_DECODE' },
            { level: 'L3', robustness: 'SW_SECURE_DECODE' },
        ]
        for (const { level, robustness } of levels) {
            try {
                await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{
                    initDataTypes: ['cenc'],
                    videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"', robustness }]
                }])
                return level
            } catch { }
        }
        return 'unsupported'
    },

    mseSupport() {
        if (!window.MediaSource) return { supported: false }
        const types = [
            'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
            'video/webm; codecs="vp9,opus"',
            'video/mp4; codecs="av01.0.05M.08,opus"',
        ]
        return {
            supported: true,
            types: Object.fromEntries(
                types.map(t => [t.split('"')[1].split(',')[0], MediaSource.isTypeSupported(t)])
            )
        }
    },

    async webrtcCodecs() {
        try {
            if (!window.RTCRtpSender?.getCapabilities) return 'unsupported'
            const video = RTCRtpSender.getCapabilities('video')
            const audio = RTCRtpSender.getCapabilities('audio')
            return {
                video: video?.codecs?.map(c => ({
                    mime: c.mimeType,
                    clockRate: c.clockRate,
                    channels: c.channels,
                    sdpFmtpLine: c.sdpFmtpLine
                })) || [],
                audio: audio?.codecs?.map(c => ({
                    mime: c.mimeType,
                    clockRate: c.clockRate,
                    channels: c.channels
                })) || []
            }
        } catch { return 'error' }
    }
}
