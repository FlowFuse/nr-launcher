class LogBuffer {
    constructor(size = 1000) {
        this.size = size;
        this.buffer = new Array(this.size);
        this.head = 0;
        this.wrapped = false
        this.lastLogTimestamp = 0;
        this.lastLogTimestampCount = 0;
    }

    add(logEntry) {

        let now = Date.now();
        if (now == this.lastLogTimestamp) {
            this.lastLogTimestampCount++
        } else {
            this.lastLogTimestamp = now
            this.lastLogTimestampCount = 0
        }
        const entry = { ts: now+(""+this.lastLogTimestampCount).padStart(4,"0"), msg: logEntry}

        this.buffer[this.head++] = entry;
        if (this.head === this.size) {
            this.head = 0
            this.wrapped = true;
        }
        return entry;
    }

    clear() {
        this.buffer = new Array(this.size);
        this.head = 0;
        this.wrapped = false;
    }

    toArray() {
        if (!this.wrapped) {
            return this.buffer.slice(0,this.head)
        } else {
            const result = this.buffer.slice(this.head, this.size);
            result.push( ... this.buffer.slice(0,this.head) )
            return result;
        }
    }
}

module.exports = LogBuffer
