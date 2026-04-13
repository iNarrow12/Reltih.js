const MurmurHash = {

    h32(str, seed = 0) {
        let h = seed
        let i = 0
        const len = str.length

        while (i < len - 3) {
            let k = (str.charCodeAt(i) & 0xff) |
                ((str.charCodeAt(i + 1) & 0xff) << 8) |
                ((str.charCodeAt(i + 2) & 0xff) << 16) |
                ((str.charCodeAt(i + 3) & 0xff) << 24)

            k = Math.imul(k, 0xcc9e2d51)
            k = (k << 15) | (k >>> 17)
            k = Math.imul(k, 0x1b873593)

            h ^= k
            h = (h << 13) | (h >>> 19)
            h = (Math.imul(h, 5) + 0xe6546b64) | 0
            i += 4
        }

        // tail
        let k = 0
        switch (len & 3) {
            case 3: k ^= (str.charCodeAt(i + 2) & 0xff) << 16
            case 2: k ^= (str.charCodeAt(i + 1) & 0xff) << 8
            case 1: k ^= (str.charCodeAt(i) & 0xff)
                k = Math.imul(k, 0xcc9e2d51)
                k = (k << 15) | (k >>> 17)
                k = Math.imul(k, 0x1b873593)
                h ^= k
        }

        // finalize
        h ^= len
        h ^= h >>> 16
        h = Math.imul(h, 0x85ebca6b)
        h ^= h >>> 13
        h = Math.imul(h, 0xc2b2ae35)
        h ^= h >>> 16

        return (h >>> 0).toString(16).padStart(8, '0')
    },

    hash(value, seed = 0) {
        return this.h32(JSON.stringify(value), seed)
    },

    combine(...values) {
        let seed = 0x9747b28c
        let result = ''
        for (const v of values) {
            const h = this.h32(JSON.stringify(v), seed)
            seed = parseInt(h, 16)
            result += h
        }

        return this.h32(result, 0x9747b28c).padStart(8, '0') +
            this.h32(result.split('').reverse().join(''), 0x9747b28c).padStart(8, '0')
    },

    deviceId(fp) {
        const safe = (obj, path) => {
            return path.split('.').reduce((v, k) =>
                v && typeof v === 'object' ? v[k] : null, obj)
        }

        return this.combine(
            safe(fp, 'browser.canvas') ?? '',
            safe(fp, 'hardware.gpu.renderer') ?? '',
            safe(fp, 'hardware.webgl') ?? '',
            JSON.stringify(safe(fp, 'browser.fonts') ?? []).split('').sort().join(''),
            safe(fp, 'os.rendering') ?? '',
            safe(fp, 'hardware.cpu.cores') ?? 0,
            safe(fp, 'browser.screen.width') ?? 0,
            safe(fp, 'browser.screen.height') ?? 0,
        )
    }
}