const should = require('should') // eslint-disable-line no-unused-vars
const sinon = require('sinon')
const got = require('got')
const { AdminInterface } = require('../../../lib/admin.js')
const { States } = require('../../../lib/launcher.js')

describe('AdminInterface command endpoint', function () {
    let admin
    let launcher
    let baseURL

    beforeEach(function (done) {
        launcher = {
            state: States.STOPPED,
            getState () { return this.state },
            loadSettings: sinon.stub().resolves(),
            start: sinon.stub().resolves(),
            stop: sinon.stub().resolves(),
            logAuditEvent: sinon.stub().resolves()
        }
        admin = new AdminInterface({ port: 0, project: 'test-project' }, launcher)
        admin.server.listen(0, () => {
            baseURL = `http://localhost:${admin.server.address().port}`
            done()
        })
    })

    afterEach(function (done) {
        sinon.restore()
        admin.server.close(done)
    })

    function sendCommand (cmd) {
        return got.post(`${baseURL}/flowforge/command`, {
            json: { cmd },
            throwHttpErrors: false
        })
    }

    describe('restart of a stopped instance', function () {
        it('responds 500 when the launcher fails to start', async function () {
            launcher.start.rejects(new Error('boom'))
            const res = await sendCommand('restart')
            res.statusCode.should.equal(500)
        })

        it('responds 200 when the launcher starts successfully', async function () {
            const res = await sendCommand('restart')
            res.statusCode.should.equal(200)
        })
    })
})
