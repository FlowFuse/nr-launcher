const should = require('should') // eslint-disable-line
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
})
