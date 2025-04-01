const os = require('node:os')
const {
    appendFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    renameSync,
    rmSync,
    statSync, 
    readFileSync} = require('node:fs')
const path = require('path')
const crypto = require('crypto')

const instanceId = crypto.createHash('md5').update(os.hostname()).digest('hex').substring(0, 4)
class LogBuffer {
    constructor (size = 1000) {
        this.size = size
        this.buffer = new Array(this.size)
        this.head = 0
        this.wrapped = false
        this.lastLogTimestamp = 0
        this.lastLogTimestampCount = 0
        this.passThroughLogging = false
    }

    add (logEntry) {
        if (!logEntry.ts) {
            logEntry.ts = Date.now()
        }

        if (this.logPath) {
            try {
                if (this.lastLogTimestamp !== 0) {
                    const lastDay = new Date(this.lastLogTimestamp)
                    if ( lastDay.getDate() !== new Date(logEntry.ts).getDate()) {
                        // rotate logs
                        const day = lastDay.toISOString().split('T')[0]
                        renameSync(path.join(this.logPath, 'node-red.log'), path.join(this.logPath, `${day}.log`))
                        // remove files over 5 days old
                        readdirSync(this.logPath).forEach(file => {
                            if (file.startsWith('.')) {
                                return
                            }
                            const stats = statSync(path.join(this.logPath, file))
                            if (Date.now() - stats.mtime > (3600 * 1000 * 24 * 7)) {
                                // console.log(`${path.join(this.logPath, file)} too old, should be deleted`)
                                rmSync(path.join(this.logPath, file))
                            }
                        })
                    }
                }
            } catch (e) {
                console.error(e)
            }
        }

        if (logEntry.ts === this.lastLogTimestamp) {
            this.lastLogTimestampCount++
        } else {
            this.lastLogTimestamp = logEntry.ts
            this.lastLogTimestampCount = 0
        }
        logEntry.ts = logEntry.ts + ('' + this.lastLogTimestampCount).padStart(4, '0')
        if (logEntry.level === 'system') {
            console.log(logEntry.msg)
        } else if (process.env.FORGE_LOG_PASSTHROUGH) {
            console.log(JSON.stringify(logEntry))
        }
        if (!logEntry.src) {
            logEntry.src = instanceId
        }
        if (this.logPath) {
            try {
                appendFileSync(path.join(this.logPath, 'node-red.log'), `${JSON.stringify(logEntry)}\n`)
            } catch (err) {
                console.error(err)
            }
        }
        this.buffer[this.head++] = logEntry
        if (this.head === this.size) {
            this.head = 0
            this.wrapped = true
        }
        return logEntry
    }

    clear () {
        this.buffer = new Array(this.size)
        this.head = 0
        this.wrapped = false
    }

    toArray () {
        if (!this.wrapped) {
            return this.buffer.slice(0, this.head)
        } else {
            const result = this.buffer.slice(this.head, this.size)
            result.push(...this.buffer.slice(0, this.head))
            return result
        }
    }

    setLogPath (logPath) {
        try {
            // check if directory exists, if not create it
            if (!existsSync(logPath)) {
                mkdirSync(logPath)
            }
            this.logPath = logPath
            const file = path.join(logPath, 'node-red.log')
            for (let i = 0; i < this.head; i++) {
                appendFileSync(file, `${JSON.stringify(this.buffer[i])}\n`)
            }
        } catch (err) {
            console.error(err)
            // don't set the path if we fail so only buffers
        }
    }

    getLogFile (startTime) {
        const date = new Date(Number.parseInt(startTime))
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        let day = date.toISOString().split('T')[0]
        if (startTime > today) {
            day = 'node-red'
        }
        const file = path.join(this.logPath, `${day}.log`)
        if (existsSync(file)) {
            return readFileSync(file)
        } else {
            throw new Error('NotFound')
        }
    }
}

module.exports = LogBuffer
