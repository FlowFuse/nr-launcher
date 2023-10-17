const os = require('node:os')
const crypto = require('crypto')

const instanceId = crypto.createHash('md5').update(os.hostname()).digest('hex').substring(0, 4)
class SampleBuffer {
    constructor (size = 1000) {
        this.size = size
        this.buffer = new Array(this.size)
        this.head = 0
        this.wrapped = false
        this.lastTimestamp = 0
        this.lastTimestampCount = 0
    }

    add (sample) {
        if (!sample.ts) {
            sample.ts = Date.now()
        }
        this.buffer[this.head++] = sample
        if (this.head == this.size) {
            this.head = 0
            this.wrapped = true
        }
        return sample
    }

    clear () {
        this.buffer = new Array(this.size)
        this.head = 0
        this.wrapped = false
    }

    toArray () {
        if (!this.wrapped) {
            return this.buffer.slice(0, this.head)
        } else  {
            const result = this.buffer.slice(this.head, this.size)
            result.push(...this.buffer.slice(0,this.head))
            return result
        }
    }
}

module.exports = SampleBuffer