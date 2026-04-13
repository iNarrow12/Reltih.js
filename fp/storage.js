const StorageFingerprint = {

    KEY: '_fpsid',

    async collect() {
        const id = this._generateId()
        const result = {
            existing: {},
            written: {},
            survived: [],
            persistentId: null,
            crossMatch: false
        }

        result.existing = await this._readAll()

        const existingIds = Object.values(result.existing).filter(Boolean)
        if (existingIds.length > 0) {
            const freq = {}
            existingIds.forEach(v => freq[v] = (freq[v] || 0) + 1)
            const winner = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
            result.persistentId = winner[0]
            result.survived = Object.entries(result.existing)
                .filter(([, v]) => v === winner[0])
                .map(([k]) => k)
            result.crossMatch = winner[1] >= 2
        }

        result.written = await this._writeAll(id)
        return result
    },

    async _readAll() {
        const out = {}
        try { out.localStorage = localStorage.getItem(this.KEY) } catch { out.localStorage = null }
        try { out.sessionStorage = sessionStorage.getItem(this.KEY) } catch { out.sessionStorage = null }
        out.indexedDB = await this._idbRead()
        out.cacheAPI = await this._cacheRead()
        out.cookie = this._cookieRead()
        return out
    },

    async _writeAll(id) {
        const w = {}
        try { localStorage.setItem(this.KEY, id); w.localStorage = true } catch { w.localStorage = false }
        try { sessionStorage.setItem(this.KEY, id); w.sessionStorage = true } catch { w.sessionStorage = false }
        w.indexedDB = await this._idbWrite(id)
        w.cacheAPI = await this._cacheWrite(id)
        w.cookie = this._cookieWrite(id)
        return w
    },

    _idbRead() {
        return new Promise(resolve => {
            try {
                const req = indexedDB.open('_fpdb', 1)
                req.onupgradeneeded = e => e.target.result.createObjectStore('fp')
                req.onsuccess = e => {
                    const tx = e.target.result.transaction('fp', 'readonly')
                    const get = tx.objectStore('fp').get(this.KEY)
                    get.onsuccess = () => resolve(get.result || null)
                    get.onerror = () => resolve(null)
                }
                req.onerror = () => resolve(null)
            } catch { resolve(null) }
        })
    },

    _idbWrite(id) {
        return new Promise(resolve => {
            try {
                const req = indexedDB.open('_fpdb', 1)
                req.onupgradeneeded = e => e.target.result.createObjectStore('fp')
                req.onsuccess = e => {
                    const tx = e.target.result.transaction('fp', 'readwrite')
                    tx.objectStore('fp').put(id, this.KEY)
                    tx.oncomplete = () => resolve(true)
                    tx.onerror = () => resolve(false)
                }
                req.onerror = () => resolve(false)
            } catch { resolve(false) }
        })
    },

    async _cacheRead() {
        try {
            const cache = await caches.open('_fpc')
            const res = await cache.match('/_fpid')
            return res ? await res.text() : null
        } catch { return null }
    },

    async _cacheWrite(id) {
        try {
            const cache = await caches.open('_fpc')
            await cache.put('/_fpid', new Response(id))
            return true
        } catch { return false }
    },

    _cookieRead() {
        try {
            const m = document.cookie.match(new RegExp(`${this.KEY}=([^;]+)`))
            return m ? m[1] : null
        } catch { return null }
    },

    _cookieWrite(id) {
        try {
            const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
            document.cookie = `${this.KEY}=${id};expires=${exp};path=/;SameSite=Strict`
            return true
        } catch { return false }
    },

    _generateId() {
        const arr = new Uint8Array(16)
        crypto.getRandomValues(arr)
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
    }
}