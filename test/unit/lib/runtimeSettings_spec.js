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
        // the @flowforge/nr- modules it tries to load
        const nmPath = path.normalize(path.join(__dirname, '../../../node_modules')).split(path.sep).join('/')
        content = `module.paths.unshift('${nmPath}'); ${content}`
        const fn = path.normalize(path.join(TMPDIR, `${Math.random().toString(36).substring(2)}.js`)).split(path.sep).join('/')
        await fs.writeFile(fn, content)
        return require(fn)
    }

    describe('getSettingsFile', function () {
        it('default settings are valid', async function () {
            const result = runtimeSettings.getSettingsFile({})
            const settings = await loadSettings(result)
            settings.should.not.have.property('credentialSecret')
            settings.should.not.have.property('httpAdminRoot')
            settings.should.not.have.property('disableEditor')
            settings.should.not.have.property('nodesDir')
            settings.should.have.property('editorTheme')
            settings.editorTheme.should.have.property('theme', 'forge-light')
            settings.editorTheme.should.have.property('page')
            settings.editorTheme.page.should.have.property('title', 'FlowForge')
            settings.editorTheme.page.should.not.have.property('favicon')
            settings.editorTheme.should.have.property('header')
            settings.editorTheme.header.should.have.property('title', 'FlowForge')
            settings.editorTheme.header.should.have.property('url')
            settings.editorTheme.should.have.property('logout')
            settings.editorTheme.logout.should.have.property('redirect')
            settings.editorTheme.should.have.property('codeEditor')
            settings.editorTheme.codeEditor.should.have.property('lib', 'monaco')

            settings.should.have.property('nodesExcludes', [])
            settings.should.have.property('externalModules')
            settings.externalModules.should.have.property('autoInstall', true)
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
        })
        it('allows settings are set by project', async function () {
            const result = runtimeSettings.getSettingsFile({
                credentialSecret: 'foo',
                nodesDir: ['a', 'b'],
                baseURL: 'BASEURL',
                forgeURL: 'FORGEURL',
                auditURL: 'AUDITURL',
                clientID: 'CLIENTID',
                clientSecret: 'CLIENTSECRET',
                projectID: 'PROJECTID',
                projectToken: 'PROJECTTOKEN',
                storageURL: 'STORAGEURL',
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
            settings.should.have.property('credentialSecret', 'foo')
            settings.should.have.property('httpAdminRoot', '/red')
            settings.should.have.property('disableEditor', true)

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

            settings.should.have.property('nodesExcludes', ['abc', 'def'])

            settings.should.have.property('externalModules')
            settings.externalModules.should.have.property('autoInstall', true)

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
        })
    })
})
