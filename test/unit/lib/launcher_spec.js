const should = require('should')
const sinon = require('sinon')
const got = require('got')
const fs = require('fs')
const launcher = require('../../../lib/launcher.js')

describe('Launcher', function () {
    it('should create a new launcher', async function () {
        const l = new launcher.Launcher({})
        should.exist(l)
    })
    this.afterEach(function () {
        sinon.restore()
    })
    describe('health check', function () {
        it('has a default value', async function () {
            const l = new launcher.Launcher({})
            l.should.have.property('healthCheckInterval', 7499)
        })
        it('can be set by user', async function () {
            const l = new launcher.Launcher({})
            l.should.have.property('healthCheckInterval', 7499) // initial/default value is 7499
            sinon.stub(fs, 'writeFileSync').callsFake(() => {})
            sinon.stub(l, 'updatePackage').callsFake(() => {})
            sinon.stub(got, 'get').callsFake(() => {
                return {
                    json () {
                        return {
                            forgeURL: 'http://localhost:1880',
                            rootDir: '/path/to/node-red',
                            userDir: '/path/to/.node-red',
                            settings: {
                                palette: {}
                            },
                            healthCheckInterval: 1234
                        }
                    }
                }
            })
            await l.loadSettings()
            l.should.have.property('healthCheckInterval', 1234) // when loaded from API, it should now be updated
        })
        it('cannot be less than 1 second', async function () {
            const l = new launcher.Launcher({})
            sinon.stub(fs, 'writeFileSync').callsFake(() => {})
            sinon.stub(l, 'updatePackage').callsFake(() => {})
            sinon.stub(got, 'get').callsFake(() => {
                return {
                    json () {
                        return {
                            forgeURL: 'http://localhost:1880',
                            rootDir: '/path/to/node-red',
                            userDir: '/path/to/.node-red',
                            settings: {
                                palette: {}
                            },
                            healthCheckInterval: 999
                        }
                    }
                }
            })
            await l.loadSettings()
            // returns the default value when the user sets the value out of range
            l.should.have.property('healthCheckInterval', 7499)
        })
    })

    describe('disable auto safe mode', function () {
        it('is disabled by default', async function () {
            const l = new launcher.Launcher({})
            l.should.have.property('disableAutoSafeMode', false)
        })
        it('can be set by user', async function () {
            const l = new launcher.Launcher({})
            sinon.stub(fs, 'writeFileSync').callsFake(() => {})
            sinon.stub(l, 'updatePackage').callsFake(() => {})
            sinon.stub(got, 'get').callsFake(() => {
                return {
                    json () {
                        return {
                            forgeURL: 'http://localhost:1880',
                            rootDir: '/path/to/node-red',
                            userDir: '/path/to/.node-red',
                            settings: {
                                palette: {}
                            },
                            disableAutoSafeMode: true
                        }
                    }
                }
            })

            await l.loadSettings()
            l.should.have.property('disableAutoSafeMode', true)
        })
    })

    describe('launcher state', function () {
        it('should start with a stopped state', () => {
            const l = new launcher.Launcher({})

            l.should.have.property('state', 'stopped')
        })

        it('should be changeable', () => {
            const l = new launcher.Launcher({})

            l.should.have.property('state', 'stopped')

            l.state = 'running'

            l.should.have.property('state', 'running')
        })

        it('should be reported each time it changes', () => {
            const l = new launcher.Launcher({})
            const reportStateStub = sinon.stub(l, 'reportStateChange')

            l.state = 'running'
            sinon.assert.calledOnce(reportStateStub)
            sinon.assert.calledWith(reportStateStub, 'running')

            l.state = 'starting'
            sinon.assert.calledTwice(reportStateStub)
            sinon.assert.calledWith(reportStateStub, 'starting')
        })
    })

    describe('reportStateChange', function () {
        it('should not report non-definitive states', () => {
            const options = {
                forgeURL: 'http://example.com',
                project: 'test-project',
                token: 'test-token'
            }
            const nonDefinitiveStates = [
                'loading',
                'installing',
                'starting',
                'stopping'
            ]

            const l = new launcher.Launcher(options)

            const postStub = sinon.stub(got, 'post').callsFake(() => { })

            nonDefinitiveStates.forEach(state => l.reportStateChange(state))

            sinon.assert.notCalled(postStub)
        })

        it('should not report the previously reported state', () => {
            const options = {
                forgeURL: 'http://example.com',
                project: 'test-project',
                token: 'test-token'
            }

            const l = new launcher.Launcher(options)
            l._lastReportedState = 'crashed'

            const postStub = sinon.stub(got, 'post').callsFake(() => { })

            l.reportStateChange('crashed')

            sinon.assert.notCalled(postStub)
        })

        it('should report definitive states and updates its lastReportedState', async () => {
            const options = {
                forgeURL: 'http://example.com',
                project: 'test-project',
                token: 'test-token'
            }

            const definitiveStates = [
                'stopped',
                'running',
                'safe',
                'crashed'
            ]

            const l = new launcher.Launcher(options)

            const postStub = sinon.stub(got, 'post').callsFake(() => { })

            for (let i = 0; i <= definitiveStates.length - 1; i++) {
                const state = definitiveStates[i]
                await l.reportStateChange(state)
                sinon.assert.calledWith(postStub, `${options.forgeURL}/api/v1/projects/${options.project}/update-state`, {
                    headers: {
                        authorization: `Bearer ${options.token}`
                    },
                    json: {
                        state
                    }
                })
                l._lastReportedState.should.equal(state)
            }

            sinon.assert.callCount(postStub, definitiveStates.length)
        })

        it('should throw an unauthorized error when receiving a 401 response', async () => {
            const options = {
                forgeURL: 'http://example.com',
                project: 'test-project',
                token: 'test-token'
            }

            const l = new launcher.Launcher(options)
            sinon.stub(got, 'post').throws({
                response: { statusCode: 401 }
            })

            try {
                await l.reportStateChange('running')
                should.fail('Expected an Unauthorized error to be thrown')
            } catch (err) {
                err.should.be.an.Error()
                err.message.should.match(/Unauthorized/)
            }
        })
    })
})
