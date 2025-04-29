const os = require('node:os')
const {
    appendFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    renameSync,
    rmSync,
    statSync
} = require('node:fs')
const { readdir, readFile } = require('node:fs/promises')
const path = require('path')
const crypto = require('crypto')

const instanceId = crypto.createHash('md5').update(os.hostname()).digest('hex').substring(0, 4)

/** Format the provided Date object as YYYY-MM-DD */
const getDateString = date => date.toISOString().split('T')[0]

/** Get the YYYY-MM-DD string for today's date */
const getToday = () => getDateString(new Date())

/** Get epoch time for the start of the specified day string */
const getStartDateOfDay = dayString => {
    const d = new Date(dayString)
    return d.getTime()
}

/**
 * Increment the provided timestamp
 *
 * Timestamps have two components - <epoch time> + <4 digit counter>
 * To increment, the 4 digit counter can be incremented. If it is 9999, then
 * increment the epoch time by 1 and set counter to 0000
*/
function incrementTimestamp (timestamp) {
    const ts = timestamp.substring(0, timestamp.length - 4)
    const count = Number.parseInt(timestamp.substring(timestamp.length - 4))
    if (count < 9999) {
        return ts + (count + 1).toString().padStart(4, '0')
    } else {
        return (Number.parseInt(ts) + 1) + '0000'
    }
}

/**
 * Decrement the provided timestamp
 *
 * Timestamps have two components - <epoch time> + <4 digit counter>
 * To decrement, the 4 digit counter can be decremented. If it is 0000, then
 * decrement the epoch time by 1 and set count to 9999
*/
function decrementTimestamp (timestamp) {
    const ts = timestamp.substring(0, timestamp.length - 4)
    const count = Number.parseInt(timestamp.substring(timestamp.length - 4))
    if (count > 0) {
        return ts + (count - 1).toString().padStart(4, '0')
    } else {
        return (Number.parseInt(ts) - 1) + '9999'
    }
}
class LogBuffer {
    constructor (size = 1000) {
        this.size = size
        this.buffer = new Array(this.size)
        this.head = 0
        this.wrapped = false
        this.firstLogTimestamp = 0
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
                    if (lastDay.getDate() !== new Date(logEntry.ts).getDate()) {
                        // rotate logs
                        const day = getDateString(lastDay)
                        if (existsSync(this.currentLogFile)) {
                            renameSync(this.currentLogFile, path.join(this.logPath, `${day}.log`))
                        }
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
                        // Async update our view on what the earliest log entry is
                        this.updateFirstLogTimestamp().catch(err => {
                            console.error('Error getting first log timestamp:', err)
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
                appendFileSync(this.currentLogFile, `${JSON.stringify(logEntry)}\n`)
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

    async setLogPath (logPath) {
        try {
            // check if directory exists, if not create it
            if (!existsSync(logPath)) {
                mkdirSync(logPath)
            }
            this.logPath = logPath
            this.currentLogFile = path.join(logPath, 'node-red.log')
            // Flush any existing buffer entries to the log
            for (let i = 0; i < this.head; i++) {
                appendFileSync(this.currentLogFile, `${JSON.stringify(this.buffer[i])}\n`)
            }
            // Async update of what our approximate earliest known log entry is
            this.updateFirstLogTimestamp().catch(err => {
                console.error('Error getting first log timestamp:', err)
            })
        } catch (err) {
            console.error(err)
            // don't set the path if we fail so only buffers
        }
    }

    // Called when we need to reexamine the log files to see what the earliest
    // entry is. Rather than read the files, we base it on the date in the filename
    async updateFirstLogTimestamp () {
        const logFiles = await this.getLogFileList()
        if (logFiles.length === 0) {
            // getLogFileList only returns the *dated* files - it doesn't include node-red.log
            // So if no files returned, then use today's date
            this.firstLogTimestamp = getStartDateOfDay(getToday())
        } else {
            this.firstLogTimestamp = getStartDateOfDay(logFiles[0].split('.')[0])
        }
    }

    /**
     * Get the log file contents that covers the specified start time
     * @param {*} startTime
     * @returns {Promise<string>} log file contents
     */
    getLogFile (startTime) {
        const date = new Date(Number.parseInt(startTime))
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        let day = getDateString(date)
        if (startTime > today) {
            day = 'node-red'
        }
        const file = path.join(this.logPath, `${day}.log`)
        if (existsSync(file)) {
            return readFile(file)
        } else {
            throw new Error('NotFound')
        }
    }

    /**
     * Return a list of dated log files
     * @returns a list of log files
     */
    async getLogFileList () {
        return (await readdir(this.logPath)).filter(file => /^\d\d\d\d-\d\d-\d\d\.log$/.test(file)).sort()
    }

    /**
     * Get log entries for the provided cursor
     * The cursor is an epoch timestamp + 4 digit counter.
     * This will return 100 entries after the cursor time stamp (inclusive)
     *
     * If the cursor starts with a '-' then it is a 'previous' cursor. This means
     * we need to get 100 entries *before* the cursor (inclusive).
     *
     * If no cursor is provided, then we will return the last 100 entries
     * @param {string} cursor epoch + 4 digit counter
     * @param {number} limit number of entries to return - defaults 100. Constrained to 1-500
     * @returns a log collection object
     */
    async getLogEntries (cursor, limit = 100) {
        // If cursor is provided, validate its format
        if (cursor && !/^-?\d{17}$/.test(cursor)) {
            // Invalid cursor - return empty
            return {
                meta: {},
                logs: []
            }
        }

        // Ensure limit is within the valid range 1 - 500
        limit = Math.min(500, Math.max(Number.parseInt(limit) || 100, 1))

        let startTimestamp = cursor
        let cursorDirection = false // true = forward, false = backward
        if (!cursor) {
            // No cursor so use the current time as the anchor
            startTimestamp = Date.now() + '0000'
        } else if (cursor[0] === '-') {
            // This is a backward-looking cursor
            cursorDirection = false
            startTimestamp = cursor.substring(1)
        } else {
            // This is a forward-looking cursor
            cursorDirection = true
        }
        // startTime: epoch timestamp of the cursor
        let startTime = Number.parseInt(startTimestamp.substring(0, startTimestamp.length - 4))

        // Clamp the start time to the earliest known log entry
        if (startTime < this.firstLogTimestamp) {
            startTime = this.firstLogTimestamp
        }
        if (startTime > Date.now()) {
            if (cursorDirection) {
                // Start time in the future and is forward-looking
                return {
                    meta: {},
                    logs: []
                }
            } else {
                // Start time in the future, but backward-looking - clamp to current time
                startTime = Date.now()
            }
        }

        // Work out which log files we'll need to pull from
        const startTimeDate = getDateString(new Date(startTime))
        const today = getToday()

        const logFiles = await this.getLogFileList()
        logFiles.push('node-red.log')
        if (!cursorDirection) {
            // Reverse the order of the log files
            logFiles.reverse()
        }
        // Loop through the list of files until we hit the one containing our start time
        do {
            const logFile = logFiles[0]
            if (logFile === 'node-red.log') {
                // Special case for current log file
                if (startTimeDate === today) {
                    break
                }
            } else {
                const fileDate = logFile.substring(0, 10)
                if (fileDate === startTimeDate) {
                    // We are in the right file
                    break
                }
            }
            // This file is not in range - remove it from the list
            logFiles.shift()
        } while (logFiles.length > 0)

        let foundStart = false
        const result = []
        let entryCount = 0
        // Read each file, find the start time, then spool results until we have
        // run out or reached the limit
        while (logFiles.length > 0 && entryCount < limit) {
            const file = logFiles.shift()
            const filePath = path.join(this.logPath, file)
            const contents = await readFile(filePath, { encoding: 'utf8' })
            const lines = contents.split('\n')
            const start = cursorDirection ? 0 : lines.length - 1
            const end = cursorDirection ? lines.length - 1 : 0
            const delta = cursorDirection ? 1 : -1
            // Loop through the lines in the direction according to cursorDirection
            for (let i = start; cursorDirection ? i <= end : i >= end; i += delta) {
                const line = lines[i]
                if (line.length === 0) {
                    continue
                }
                const entry = JSON.parse(line)
                if (!foundStart) {
                    // We have not yet found the start point; need to scan the file
                    // line by line to find the cursor
                    if (cursorDirection && entry.ts >= startTimestamp) {
                        foundStart = true
                    } else if (!cursorDirection && entry.ts <= startTimestamp) {
                        foundStart = true
                    }
                }
                if (foundStart) {
                    // We are in range of the desired entries. Add to the result array
                    // in the correct order
                    if (cursorDirection) {
                        result.push(entry)
                    } else {
                        result.unshift(entry)
                    }
                    entryCount++
                }
                if (entryCount >= limit) {
                    // We have gathered enough entries to satisfy the request
                    break
                }
            }
        }

        let nextCursor
        let previousCursor
        if (result.length > 0) {
            // Calculate the next and previous cursors based on the first/last entries
            nextCursor = incrementTimestamp(result[result.length - 1].ts)
            previousCursor = '-' + decrementTimestamp(result[0].ts)
        }
        return {
            meta: {
                first_entry: this.firstLogTimestamp + '0000',
                next_cursor: nextCursor,
                previous_cursor: previousCursor
            },
            logs: result
        }
    }
}

module.exports = LogBuffer
