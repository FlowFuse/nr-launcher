const util = require('@node-red/util').util

function Memory (config) {
    this.data = config.data || {}
}

Memory.prototype.open = function () {
    return Promise.resolve()
}

Memory.prototype.close = function () {
    return Promise.resolve()
}

Memory.prototype._getOne = function (scope, key) {
    let value
    if (this.data[scope]) {
        try {
            value = util.getObjectProperty(this.data[scope], key)
        } catch (err) {
            if (err.code === 'INVALID_EXPR') {
                throw err
            }
            value = undefined
        }
    }
    return value
}

Memory.prototype.get = function (scope, key, callback) {
    let value
    let error
    if (!Array.isArray(key)) {
        try {
            value = this._getOne(scope, key)
        } catch (err) {
            if (!callback) {
                throw err
            }
            error = err
        }
        if (callback) {
            callback(error, value)
            return
        } else {
            return value
        }
    }

    value = []
    for (let i = 0; i < key.length; i++) {
        try {
            value.push(this._getOne(scope, key[i]))
        } catch (err) {
            if (!callback) {
                throw err
            } else {
                callback(err)
                return
            }
        }
    }
    if (callback) {
        callback.apply(null, [undefined].concat(value))
    } else {
        return value
    }
}

Memory.prototype.set = function (scope, key, value, callback) {
    if (!this.data[scope]) {
        this.data[scope] = {}
    }
    let error
    if (!Array.isArray(key)) {
        key = [key]
        value = [value]
    } else if (!Array.isArray(value)) {
        // key is an array, but value is not - wrap it as an array
        value = [value]
    }
    try {
        for (let i = 0; i < key.length; i++) {
            let v = null
            if (i < value.length) {
                v = value[i]
            }
            util.setObjectProperty(this.data[scope], key[i], v)
        }
    } catch (err) {
        if (callback) {
            error = err
        } else {
            throw err
        }
    }
    if (callback) {
        callback(error)
    }
}

Memory.prototype.keys = function (scope, callback) {
    let values = []
    let error
    try {
        if (this.data[scope]) {
            if (scope !== 'global') {
                values = Object.keys(this.data[scope])
            } else {
                values = Object.keys(this.data[scope]).filter(function (key) {
                    return key !== 'set' && key !== 'get' && key !== 'keys'
                })
            }
        }
    } catch (err) {
        if (callback) {
            error = err
        } else {
            throw err
        }
    }
    if (callback) {
        if (error) {
            callback(error)
        } else {
            callback(null, values)
        }
    } else {
        return values
    }
}

Memory.prototype.delete = function (scope) {
    delete this.data[scope]
    return Promise.resolve()
}

Memory.prototype.clean = function (activeNodes) {
    for (const id in this.data) {
        if (Object.hasOwn(this.data, id) && id !== 'global') {
            const idParts = id.split(':')
            if (activeNodes.indexOf(idParts[0]) === -1) {
                delete this.data[id]
            }
        }
    }
    return Promise.resolve()
}

Memory.prototype._export = function () {
    return this.data
}

module.exports = function (config) {
    return new Memory(config)
}
