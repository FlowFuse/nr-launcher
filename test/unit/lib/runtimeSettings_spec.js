const should = require('should') // eslint-disable-line
const runtimeSettings = require('../../../lib/runtimeSettings')
const fs = require('fs/promises')
const path = require('path')
const os = require('os')

describe('Runtime Settings', function () {
    let TMPDIR
    before(async function () {
        TMPDIR = await fs.mkdtemp(path.join(os.tmpdir(), 'fflauncher-'))
    })
    after(async function () {
        await fs.rm(TMPDIR, { recursive: true, force: true })
    })

    async function loadSettings (content) {
        // Need to fix the node path inside the content to ensure it can find
        // the @flowfuse/nr- modules it tries to load
        // nmPath - when nr-auth is installed in our local node_modules
        const nmPath = path.normalize(path.join(__dirname, '../../../node_modules')).split(path.sep).join('/')
        // nmPath2 - when running inside flowforge-dev-env, need to go higher in the tree
        const nmPath2 = path.normalize(path.join(__dirname, '../../../../../node_modules')).split(path.sep).join('/')
        // Rewrite any requires for exports of this module
        content = content.replace(/'(@flowfuse\/nr-launcher\/.*)'/g, (match, p1) => {
            return `'${require.resolve(p1).split(path.sep).join('/')}'`
        })
        content = `module.paths.unshift('${nmPath}', '${nmPath2}'); ${content}`
        const fn = path.normalize(path.join(TMPDIR, `${Math.random().toString(36).substring(2)}.js`)).split(path.sep).join('/')
        await fs.writeFile(fn, content)
        return require(fn)
    }

    describe('getSettingsFile', function () {
        it('default settings are valid', async function () {
            const result = runtimeSettings.getSettingsFile({
                baseURL: 'https://BASEURL',
                forgeURL: 'https://FORGEURL'
            })
            const settings = await loadSettings(result)
            settings.should.not.have.property('credentialSecret')
            settings.should.not.have.property('httpAdminRoot')
            settings.should.not.have.property('ui') // dashboardUI
            settings.should.not.have.property('disableEditor')
            settings.should.not.have.property('nodesDir')
            settings.should.have.property('editorTheme')
            settings.editorTheme.should.have.property('theme', 'forge-light')
            settings.editorTheme.should.have.property('page')
            settings.editorTheme.page.should.have.property('title', 'FlowFuse')
            settings.editorTheme.page.should.not.have.property('favicon')
            settings.editorTheme.should.have.property('header')
            settings.editorTheme.header.should.have.property('title', 'FlowFuse')
            settings.editorTheme.header.should.have.property('url')
            settings.editorTheme.should.have.property('logout')
            settings.editorTheme.logout.should.have.property('redirect')
            settings.editorTheme.should.have.property('codeEditor')
            settings.editorTheme.codeEditor.should.have.property('lib', 'monaco')

            settings.should.have.property('nodesExcludes', [])
            settings.should.have.property('externalModules')
            settings.externalModules.should.not.have.property('autoInstall')
            settings.externalModules.should.have.property('palette')
            settings.externalModules.palette.should.have.property('allowInstall', true)
            settings.externalModules.palette.should.have.property('allowUpload', false)
            settings.externalModules.palette.should.have.property('denyList', [])
            settings.externalModules.palette.should.have.property('allowList', ['*'])
            settings.externalModules.should.have.property('modules')
            settings.externalModules.modules.should.have.property('allowInstall', true)
            settings.externalModules.modules.should.have.property('denyList', [])
            settings.externalModules.modules.should.have.property('allowList', ['*'])
            settings.should.have.property('functionExternalModules', true)

            // Default should not have editorTheme.library as it is an EE feature
            settings.editorTheme.should.not.have.property('library')

            settings.should.have.property('flowforge')
            settings.flowforge.should.have.property('forgeURL')
            settings.flowforge.should.have.property('teamID')
            settings.flowforge.should.have.property('projectID')
            settings.flowforge.should.not.have.property('projectLink')

            settings.should.not.have.property('httpNodeAuth')
            settings.should.not.have.property('httpNodeMiddleware')
            settings.should.not.have.property('apiMaxLength')
            settings.should.not.have.property('debugMaxLength')
        })
        it('includes ee-only settings when license applied', async function () {
            const result = runtimeSettings.getSettingsFile({
                licenseType: 'ee',
                credentialSecret: 'foo',
                nodesDir: ['a', 'b'],
                baseURL: 'https://BASEURL',
                forgeURL: 'https://FORGEURL',
                auditURL: 'AUDITURL',
                teamID: 'TEAMID',
                clientID: 'CLIENTID',
                clientSecret: 'CLIENTSECRET',
                projectID: 'PROJECTID',
                projectToken: 'PROJECTTOKEN',
                storageURL: 'STORAGEURL',
                broker: {
                    url: 'BROKERURL',
                    username: 'BROKERUSERNAME',
                    password: 'BROKERPASSWORD'
                },
                settings: {
                    httpAdminRoot: '/red',
                    dashboardUI: '/dash',
                    disableEditor: true,
                    codeEditor: 'ace',
                    theme: 'forge-dark',
                    apiMaxLength: '123',
                    debugMaxLength: '456',
                    page: {
                        title: 'PAGE_TITLE',
                        favicon: 'PAGE_FAVICON'
                    },
                    header: {
                        title: 'HEADER_TITLE',
                        url: 'url: "HEADER_URL",'
                    },
                    palette: {
                        allowInstall: false,
                        nodesExcludes: 'abc,def',
                        allowList: ['a', 'b', 'c'],
                        denyList: ['1', '2', '3']
                    },
                    modules: {
                        allowInstall: false,
                        allowList: ['ma', 'mb', 'mc'],
                        denyList: ['m1', 'm2', 'm3']
                    }
                }
            })

            const settings = await loadSettings(result)
            settings.should.have.property('credentialSecret', 'foo')
            settings.should.have.property('httpAdminRoot', '/red')
            settings.should.have.property('ui', { path: '/dash', maxHttpBufferSize: 123 })
            settings.should.have.property('disableEditor', true)
            settings.should.have.property('apiMaxLength', '123')
            settings.should.have.property('debugMaxLength', 456)

            settings.should.have.property('httpStorage', {
                projectID: 'PROJECTID',
                baseURL: 'STORAGEURL',
                token: 'PROJECTTOKEN'
            })

            settings.logging.should.have.property('auditLogger')
            settings.logging.auditLogger.should.have.property('loggingURL', 'AUDITURL')
            settings.logging.auditLogger.should.have.property('projectID', 'PROJECTID')
            settings.logging.auditLogger.should.have.property('token', 'PROJECTTOKEN')

            settings.should.have.property('nodesDir', ['a', 'b'])
            settings.should.have.property('editorTheme')
            settings.editorTheme.should.have.property('theme', 'forge-dark')
            settings.editorTheme.should.have.property('page')
            settings.editorTheme.page.should.have.property('title', 'PAGE_TITLE')
            settings.editorTheme.page.should.have.property('favicon', 'PAGE_FAVICON')
            settings.editorTheme.should.have.property('header')
            settings.editorTheme.header.should.have.property('title', 'HEADER_TITLE')
            settings.editorTheme.header.should.have.property('url', 'HEADER_URL')
            settings.editorTheme.should.have.property('logout')
            settings.editorTheme.logout.should.have.property('redirect')
            settings.editorTheme.should.have.property('codeEditor')
            settings.editorTheme.codeEditor.should.have.property('lib', 'ace')

            // Should not have editorTheme.library as it is an EE feature but the feature flag wasn't set
            settings.editorTheme.should.not.have.property('library')

            settings.should.have.property('nodesExcludes', ['abc', 'def'])

            settings.should.have.property('externalModules')
            settings.externalModules.should.not.have.property('autoInstall')

            settings.externalModules.should.have.property('palette')
            settings.externalModules.palette.should.have.property('allowInstall', false)
            settings.externalModules.palette.should.have.property('allowUpload', false)
            settings.externalModules.palette.should.have.property('allowList', ['a', 'b', 'c'])
            settings.externalModules.palette.should.have.property('denyList', ['1', '2', '3'])

            settings.externalModules.should.have.property('modules')
            settings.externalModules.modules.should.have.property('allowInstall', false)
            settings.externalModules.modules.should.have.property('allowList', ['ma', 'mb', 'mc'])
            settings.externalModules.modules.should.have.property('denyList', ['m1', 'm2', 'm3'])
            settings.should.have.property('functionExternalModules', false)

            settings.should.have.property('flowforge')
            settings.flowforge.should.have.property('forgeURL', 'https://FORGEURL')
            settings.flowforge.should.have.property('teamID', 'TEAMID')
            settings.flowforge.should.have.property('projectID', 'PROJECTID')

            // Should not have projectLink as it is an EE feature but the feature flag wasn't set
            settings.flowforge.should.not.have.property('projectLink')
        })
        it('does not include projectLink if licenseType not ee', async function () {
            const result = runtimeSettings.getSettingsFile({
                // licenseType: 'ee', << no license type
                credentialSecret: 'foo',
                nodesDir: ['a', 'b'],
                baseURL: 'https://BASEURL',
                forgeURL: 'https://FORGEURL',
                auditURL: 'AUDITURL',
                teamID: 'TEAMID',
                clientID: 'CLIENTID',
                clientSecret: 'CLIENTSECRET',
                projectID: 'PROJECTID',
                projectToken: 'PROJECTTOKEN',
                storageURL: 'STORAGEURL',
                broker: {
                    url: 'BROKERURL',
                    username: 'BROKERUSERNAME',
                    password: 'BROKERPASSWORD'
                },
                settings: {
                    httpAdminRoot: '/red',
                    disableEditor: true,
                    codeEditor: 'ace',
                    theme: 'forge-dark',
                    page: {
                        title: 'PAGE_TITLE',
                        favicon: 'PAGE_FAVICON'
                    },
                    header: {
                        title: 'HEADER_TITLE',
                        url: 'url: "HEADER_URL",'
                    },
                    palette: {
                        allowInstall: false,
                        nodesExcludes: 'abc,def',
                        allowList: ['a', 'b', 'c'],
                        denyList: ['1', '2', '3']
                    },
                    modules: {
                        allowInstall: false,
                        allowList: ['ma', 'mb', 'mc'],
                        denyList: ['m1', 'm2', 'm3']
                    }
                }
            })

            const settings = await loadSettings(result)

            settings.should.have.property('flowforge')
            settings.flowforge.should.have.property('forgeURL', 'https://FORGEURL')
            settings.flowforge.should.have.property('teamID', 'TEAMID')
            settings.flowforge.should.have.property('projectID', 'PROJECTID')
            settings.flowforge.should.not.have.property('projectLink')
        })
    })
    it('includes httpNodeAuth if user/pass provided', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            settings: {
                httpNodeAuth: { user: 'fred', pass: 'secret' }
            }
        })
        const settings = await loadSettings(result)
        settings.should.have.property('httpNodeAuth')
        settings.httpNodeAuth.should.eql({ user: 'fred', pass: 'secret' })
        settings.should.not.have.property('httpNodeMiddleware')
    })
    it('includes httpNodeMiddleware if flowforge-user auth type set', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            settings: {
                httpNodeAuth: { type: 'flowforge-user' }
            }
        })
        try {
            const settings = await loadSettings(result)
            settings.should.not.have.property('httpNodeAuth')
            settings.should.have.property('httpNodeMiddleware')
            settings.httpNodeMiddleware.should.be.an.Array()
            ;(typeof settings.httpNodeMiddleware[0]).should.equal('function')
            ;(typeof settings.httpNodeMiddleware[1]).should.equal('function')
            settings.should.have.property('ui')
            settings.ui.should.not.have.property('path')
            settings.ui.should.have.property('middleware')
            console.log(settings.ui.middleware)
            settings.ui.middleware.should.be.an.Array()
            ;(typeof settings.ui.middleware[0]).should.equal('function')
            ;(typeof settings.ui.middleware[1]).should.equal('function')
        } catch (err) {
            console.log(err)
            // Temporary fix as this module will not be found when running in CI
            // until we publish the release of the new nr-auth module.
            err.toString().should.match(/Cannot find module '@flowfuse\/nr-auth\/middleware'/)
        }
    })
    it('includes httpNodeMiddleware if flowforge-user auth type set and dashboard ui set', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            settings: {
                dashboardUI: '/foo',
                httpNodeAuth: { type: 'flowforge-user' }
            }
        })
        try {
            const settings = await loadSettings(result)
            settings.should.have.property('ui')
            settings.ui.should.have.property('path', '/foo')
            settings.ui.should.have.property('middleware')
            settings.ui.middleware.should.be.an.Array()
            ;(typeof settings.ui.middleware[0]).should.equal('function')
            ;(typeof settings.ui.middleware[1]).should.equal('function')
        } catch (err) {
            // Temporary fix as this module will not be found when running in CI
            // until we publish the release of the new nr-auth module.
            err.toString().should.match(/Cannot find module '@flowfuse\/nr-auth\/middleware'/)
        }
    })
    it('includes httpNodeMiddleware and dashboard iFrame middleware if flowforge-user auth type set and dashboard ui set to be loaded into iFrame', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            settings: {
                dashboardUI: '/foo',
                httpNodeAuth: { type: 'flowforge-user' },
                dashboardIFrame: true
            }
        })

        const settings = await loadSettings(result)
        settings.should.have.property('ui')
        settings.ui.should.have.property('path', '/foo')
        settings.ui.should.have.property('middleware')
        settings.ui.middleware.should.be.an.Array().and.have.length(3)
        ;(typeof settings.ui.middleware[0]).should.equal('function')
        ;(typeof settings.ui.middleware[1]).should.equal('function')
        ;(typeof settings.ui.middleware[2]).should.equal('function') // iFrame middleware
        // calling the middleware function should add the CSP header & call next
        const headers = {}
        let nextCalled = false
        const res = {
            set: function (header, value) {
                headers[header] = value
            }
        }
        const next = function () {
            nextCalled = true
        }
        settings.ui.middleware[2]({}, res, next)
        headers.should.have.property('Content-Security-Policy', 'frame-ancestors *')
        nextCalled.should.equal(true)
    })
    it('includes only dashboard iFrame middleware if flowforge-user auth type is not set and dashboard ui set to be loaded into iFrame', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            settings: {
                dashboardUI: '/foo',
                dashboardIFrame: true
            }
        })

        const settings = await loadSettings(result)
        settings.should.have.property('ui')
        settings.ui.should.have.property('path', '/foo')
        settings.ui.should.have.property('middleware')
        settings.ui.middleware.should.be.an.Array().and.have.length(1)
        ;(typeof settings.ui.middleware[0]).should.equal('function') // iFrame middleware
        // calling the middleware function should add the CSP header & call next
        const headers = {}
        let nextCalled = false
        const res = {
            set: function (header, value) {
                headers[header] = value
            }
        }
        const next = function () {
            nextCalled = true
        }
        settings.ui.middleware[0]({}, res, next)
        headers.should.have.property('Content-Security-Policy', 'frame-ancestors *')
        nextCalled.should.equal(true)
    })
    it('includes HA settings when enabled', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            licenseType: 'ee',
            broker: {
                url: 'BROKERURL',
                username: 'BROKERUSERNAME',
                password: 'BROKERPASSWORD'
            },
            features: {
                projectComms: true
            },
            settings: {
                ha: {
                    replicas: 2
                }
            }
        })
        const settings = await loadSettings(result)
        settings.should.have.property('disableEditor', true)
        settings.flowforge.should.have.property('projectLink')
        settings.flowforge.projectLink.should.have.property('useSharedSubscriptions', true)
    })
    it('includes shared library when feature flag set', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            features: {
                'shared-library': true
            },
            settings: {}
        })
        const settings = await loadSettings(result)
        settings.editorTheme.should.have.property('library')
    })
    it('includes project comms when feature flag set', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            projectToken: 'PROJECTTOKEN',
            broker: {
                url: 'BROKERURL',
                username: 'BROKERUSERNAME',
                password: 'BROKERPASSWORD'
            },
            features: {
                projectComms: true
            },
            settings: {}
        })
        const settings = await loadSettings(result)
        settings.flowforge.should.have.property('projectLink')
        settings.flowforge.projectLink.should.have.property('token', 'PROJECTTOKEN')
        settings.flowforge.projectLink.should.have.property('broker')
        settings.flowforge.projectLink.broker.should.have.property('url', 'BROKERURL')
        settings.flowforge.projectLink.broker.should.have.property('username', 'BROKERUSERNAME')
        settings.flowforge.projectLink.broker.should.have.property('password', 'BROKERPASSWORD')
        settings.flowforge.projectLink.should.not.have.property('useSharedSubscriptions')
    })
    it('sets catalogue when EE and setting is present', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            licenseType: 'ee',
            settings: {
                palette: {
                    catalogue: ['foo', 'bar', 'baz']
                }
            }
        })
        const settings = await loadSettings(result)
        settings.editorTheme.should.have.property('palette')
        settings.editorTheme.palette.should.have.property('catalogues').and.be.an.Array()
        settings.editorTheme.palette.catalogues.should.have.length(3)
        settings.editorTheme.palette.catalogues[0].should.eql('foo')
        settings.editorTheme.palette.catalogues[1].should.eql('bar')
        settings.editorTheme.palette.catalogues[2].should.eql('baz')
    })
    it('ignores catalogue entries when NOT EE and setting is present', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            // licenseType: 'ee', << no license type
            settings: {
                palette: {
                    catalogue: ['foo', 'bar', 'baz']
                }
            }
        })
        const settings = await loadSettings(result)
        settings.editorTheme.should.have.property('palette')
        settings.editorTheme.palette.should.have.property('catalogues').and.be.an.Array()
        settings.editorTheme.palette.catalogues.should.have.length(1)
        settings.editorTheme.palette.catalogues[0].should.not.eql('foo') // will be NR default catalogue
    })
    it('includes assistant settings when enabled', async function () {
        const result = runtimeSettings.getSettingsFile({
            baseURL: 'https://BASEURL',
            forgeURL: 'https://FORGEURL',
            projectToken: 'ffxxx_1234567890',
            settings: {
                palette: {
                    catalogue: ['foo', 'bar', 'baz']
                }
            },
            assistant: {
                enabled: true,
                requestTimeout: 12345
            }
        })
        const settings = await loadSettings(result)
        settings.should.have.property('flowforge').and.be.an.Object()
        settings.flowforge.should.have.property('assistant')
        settings.flowforge.assistant.should.have.property('enabled', true)
        settings.flowforge.assistant.should.have.property('url', 'https://FORGEURL/api/v1/assistant/')
        settings.flowforge.assistant.should.have.property('token', 'ffxxx_1234567890')
        settings.flowforge.assistant.should.have.property('requestTimeout', 12345)
    })
})
