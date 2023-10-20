const MemoryCache = require('./memoryCache')
const got = require('got').default
const safeJSONStringify = require('json-stringify-safe')
const CONFIG_ERROR_MSG = 'Persistent context plugin cannot be used outside of FlowForge EE environment'

/**
 * @typedef {Object} FFContextStorageConfig - The configuration object for the FlowForge Context Storage
 * @property {string} projectID - The FlowForge project ID
 * @property {string} token - The FlowForge project token
 * @property {string} [url='http://127.0.0.1:3001'] - The FlowForge File Store URL
 * @property {number} [requestTimeout=3000] - The number of milliseconds to wait before timing out a request
 * @property {number} [pageSize=20] - The number of context items/rows to fetch per page
 * @property {number} [flushInterval=30] - The number of seconds to wait before flushing pending writes
 * @property {boolean} [cache=true] - Whether to cache context items in memory (required for synchronous get/set)
 */

class FFContextStorage {
    constructor (/** @type {FFContextStorageConfig} */ config) {
        // Ensure sane config
        config = config || {}
        config.pageSize = Math.max(1, config.pageSize || 20)
        config.requestTimeout = Math.max(500, config.requestTimeout || 3000)
        config.flushInterval = Math.max(0, config.flushInterval || 30) * 1000
        config.cache = Object.hasOwn(config, 'cache') ? config.cache : true
        config.projectID = config?.projectID || (process.env.FF_FS_TEST_CONFIG ? process.env.FLOWFORGE_PROJECT_ID : null)
        config.token = config?.token || (process.env.FF_FS_TEST_CONFIG ? process.env.FLOWFORGE_PROJECT_TOKEN : null)
        config.url = config?.url || 'http://127.0.0.1:3001'

        // setup class vars
        this.validSetup = false
        /** @type {FFContextStorageConfig} */
        this.config = config
        if (config.cache) {
            this.cache = MemoryCache({})
        }
        this.pendingWrites = {}
        this.knownCircularRefs = {}
        this.writePromise = Promise.resolve()
        this._flushPendingWrites = function () { return Promise.resolve() } // place holder for later
        this.validSetup = config.projectID && config.token && config.url?.startsWith('http')
        if (!this.validSetup) {
            console.warn(CONFIG_ERROR_MSG)
        }

        // create HTTP client instance for this project
        /** @type {import('got').Got} */
        this.client = got.extend({
            prefixUrl: `${config.url}/v1/context/${config.projectID}`,
            headers: {
                'user-agent': 'FlowForge Node-RED File Nodes for Storage Server',
                authorization: 'Bearer ' + config.token
            },
            timeout: {
                request: config.requestTimeout
            },
            retry: {
                limit: 0
            }
        })
    }

    async open () {
        const self = this
        if (!self.validSetup) {
            return Promise.reject(new Error(CONFIG_ERROR_MSG))
        }
        if (!self.cache) {
            self._flushPendingWrites = function () { return Promise.resolve() }
            return Promise.resolve()
        }
        const opts = {
            responseType: 'json'
        }
        self.nextActiveCursor = null
        const limit = self.config.pageSize
        let cursor = null
        let result = await getNext(cursor, limit)
        while (result) {
            updateCache(result)
            cursor = result.meta?.next_cursor
            if (cursor) {
                result = await getNext(cursor, limit)
            } else {
                result = null
            }
        }

        async function getNext (cursor, limit) {
            const path = paginateUrl('cache', cursor, limit)
            const response = await self.client.get(path, opts)
            return response?.body
        }

        function updateCache (result) {
            const rows = result?.data || []
            for (let index = 0; index < rows.length; index++) {
                const row = rows[index]
                if (typeof row !== 'object') { continue }
                const scope = row.scope
                if (!scope) { continue }
                const values = row?.values
                if (typeof values !== 'object') { continue }
                Object.keys(values).forEach(function (key) {
                    self.cache.set(scope, key, values[key])
                })
            }
        }
        // update _flushPendingWrites to a real function
        self._flushPendingWrites = function () {
            const scopes = Object.keys(self.pendingWrites)
            self.pendingWrites = {}
            const promises = []
            const newContext = self.cache._export()
            scopes.forEach(function (scope) {
                const context = newContext[scope] || {}
                const stringifiedContext = stringify(context)
                if (stringifiedContext.circular && !self.knownCircularRefs[scope]) {
                    console.warn('context.flowforge.error-circular', scope)
                    self.knownCircularRefs[scope] = true
                } else {
                    delete self.knownCircularRefs[scope]
                }
                promises.push(self._writeCache(scope, stringifiedContext.json))
            })
            delete self._pendingWriteTimeout
            return Promise.all(promises)
        }
    }

    close () {
        const self = this
        if (this.cache && this._pendingWriteTimeout) {
            clearTimeout(this._pendingWriteTimeout)
            delete this._pendingWriteTimeout
            this.config.flushInterval = 0
            self.writePromise = self.writePromise.then(function () {
                return self._flushPendingWrites().catch(function (err) {
                    console.error('Error flushing pending context writes:' + err.toString())
                })
            })
        }
        return this.writePromise
    }

    /**
     * Get one or more values from the context store
     * @param {'context'|'flow'|'global'} scope - The scope of the context to get keys for
     * @param {string|Array<string>} key - The key to get the value for
     * @param {Function} callback - The callback to call when the value has been retrieved
     * @example
     *     // get a single value
     *     http://localhost:3001/v1/context/project-id/flow?key=hello
     * @example
     *     // get multiple values
     *     http://localhost:3001/v1/context/project-id/global?key=hello&key=nested.object.property
     */
    get (scope, key, callback) {
        if (!this.validSetup) {
            return eeRejectOrCallback(!callback, callback)
        }
        if (this.cache) {
            return this.cache.get(scope, key, callback)
        } else if (typeof callback !== 'function') {
            throw new Error('This context store must be called asynchronously')
        } else {
            const path = `${scope}`
            const keys = Array.isArray(key) ? key : [key]
            const opts = {
                search: new URLSearchParams(keys.map(k => ['key', k])),
                responseType: 'json'
            }
            this.client.get(path, opts).then(res => {
                callback(null, ...reviver(keys, res.body))
            }).catch(error => {
                callback(normaliseError(error))
            })
        }
    }

    /**
     * Set one or more values in the context store
     * @param {'context'|'flow'|'global'} scope - The scope of the context to set
     * @param {string|Array<string>} key - The key(s) to set the value for
     * @param {string|Array<string>} value - The value(s) to set for the given scope + key(s)
     * @param {Function} callback - The callback to call when the value(s) have been set
     * @example
     *    // set a single value
     *    http://localhost:3001/v1/context/project-id/flow
     *    // body
     *    [{ "key": "hello", "value": "world" }]
     * @example
     *    // set multiple values
     *    http://localhost:3001/v1/context/project-id/flow
     *    // body
     *    [{ "key": "hello", "value": "world" }, { "key": "nested.object.property", "value": "value" }]
     */
    set (scope, key, value, callback) {
        const self = this
        if (!self.validSetup) {
            return eeRejectOrCallback(!callback, callback)
        }
        if (self.cache) {
            self.cache.set(scope, key, value, callback)
            self.pendingWrites[scope] = true
            if (self._pendingWriteTimeout) {
                // there's a pending write which will handle this
            } else {
                self._pendingWriteTimeout = setTimeout(function () {
                    self.writePromise = self.writePromise.then(function () {
                        return self._flushPendingWrites().catch(function (err) {
                            console.error('Error flushing pending context writes:' + err.toString())
                        })
                    })
                }, self.flushInterval)
            }
        } else if (typeof callback !== 'function') {
            throw new Error('This context store must be called asynchronously')
        } else {
            const path = `${scope}`
            const data = Array.isArray(key) ? key.map((k, i) => ({ key: k, value: value[i] })) : [{ key, value }]
            const stringifiedContext = stringify(data)
            const opts = {
                responseType: 'json',
                body: stringifiedContext.json,
                headers: { 'Content-Type': 'application/json;charset=utf-8' }
            }
            self.client.post(path, opts).then(res => {
                callback(null)
            }).catch(error => {
                callback(normaliseError(error))
            })
        }
    }

    /**
     * Get a list of keys for a given scope
     * @param {'context'|'flow'|'global'} scope - The scope of the context to get keys for
     * @param {Function} callback - The callback to call when the keys have been retrieved
     * @example
     *     http://localhost:3001/v1/context/project-id/global/keys
     */
    keys (scope, callback) {
        if (!this.validSetup) {
            if (callback) {
                callback(null, []) // quietly return empty key list
            } else {
                return Promise.resolve([]) // quietly return empty key list
            }
        }
        if (this.cache) {
            return this.cache.keys(scope, callback)
        }
        if (typeof callback !== 'function') {
            throw new Error('This context store must be called asynchronously')
        }

        const path = `${scope}/keys`
        const opts = {
            responseType: 'json',
            headers: {
                'Content-Type': 'application/json;charset=utf-8',
                Accept: 'application/json'
            }
        }
        this.client.get(path, opts).then(res => {
            callback(null, res.body || [])
        }).catch(error => {
            callback(normaliseError(error))
        })
    }

    /**
     * Delete the context of the given node/flow/global
     * @param {String} scope - the scope to delete
     */
    delete (scope) {
        const self = this
        if (!self.validSetup) {
            return Promise.resolve() // quietly ignore
        }
        let cachePromise
        if (self.cache) {
            cachePromise = self.cache.delete(scope)
        } else {
            cachePromise = Promise.resolve()
        }
        delete self.pendingWrites[scope]
        return cachePromise.then(function () {
            return self.client.delete(scope)
        })
    }

    /**
     * Delete any contexts that are no longer in use
     * @param {Array<string>} _activeNodes - a list of nodes still active
     */
    clean (_activeNodes) {
        const self = this
        if (!self.validSetup) {
            return Promise.resolve() // quietly ignore
        }
        const activeNodes = _activeNodes || []
        const opts = { json: activeNodes }
        let cachePromise
        if (self.cache) {
            cachePromise = self.cache.clean(activeNodes)
        } else {
            cachePromise = Promise.resolve()
        }
        self.knownCircularRefs = {}
        return cachePromise.then(function () {
            return self.client.post('clean', opts)
        }).then(() => {
            // done
        }).catch(error => {
            error.code ||= 'unexpected_error'
            // TODO: log error?
        })
    }

    _export () {
        // TODO: needed? I think not looking through @node-red/runtime/lib/nodes/context/index.js
        return []
    }

    async _writeCache (scope, jsonData) {
        const self = this
        const path = `cache/${scope}`
        const opts = {
            responseType: 'json',
            body: jsonData,
            headers: { 'Content-Type': 'application/json;charset=utf-8' }
        }
        await self.client.post(path, opts)
    }
}

// #region helpers
function stringify (value) {
    let hasCircular
    const result = safeJSONStringify(value, null, null, function (k, v) { hasCircular = true })
    return { json: result, circular: hasCircular }
}

const reviver = (keys, data) => {
    const result = keys.map(key => {
        const el = data.find(e => e.key === key)
        return el?.value
    })
    return result
}

function eeRejectOrCallback (reject, callback) {
    if (callback) {
        callback(new Error(CONFIG_ERROR_MSG))
    } else if (reject) {
        return Promise.reject(new Error(CONFIG_ERROR_MSG))
    }
}

function normaliseError (err) {
    let niceError = new Error('Unexpected error.')
    let statusCode = null
    let childErr = {}
    niceError.code ||= 'unexpected_error'
    if (typeof err === 'string') {
        niceError = new Error(err)
    } else if (err?._normalised) {
        return err // already normalised
    }
    if (err?.response) {
        statusCode = err.response.statusCode
        if (err.response.body) {
            try {
                if (err.response.body && typeof err.response.body === 'object') {
                    childErr = err.response.body
                } else {
                    childErr = { ...JSON.parse(err.response.body.toString()) }
                }
            } catch (_error) { /* do nothing */ }
            if (!childErr || typeof childErr !== 'object') {
                childErr = {}
            }
            Object.assign(niceError, childErr)
            niceError.message = childErr.error || childErr.message || niceError.message
            niceError.code = childErr.code || niceError.code
            niceError.stack = childErr.stack || niceError.stack
        }
    }
    if (statusCode === 413) {
        niceError.message = 'Quota exceeded.'
        if (childErr && childErr.limit) {
            niceError.message += ` The current limit is ${childErr.limit} bytes.`
        }
        niceError.code = 'quota_exceeded'
    }
    niceError.stack = niceError.stack || err.stack
    niceError.code = niceError.code || err.code
    niceError._normalised = true // prevent double processing
    return niceError
}

function paginateUrl (url, cursor, limit, query) {
    const queryString = new URLSearchParams()
    if (cursor) {
        queryString.append('cursor', cursor)
    }
    if (limit) {
        queryString.append('limit', limit)
    }
    if (query) {
        queryString.append('query', query)
    }
    const qs = queryString.toString()
    if (qs === '') {
        return url
    }
    return `${url}?${qs}`
}
// #endregion helpers

exports.FFContextStorage = FFContextStorage
