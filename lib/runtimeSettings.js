const path = require('path')
const bytes = require('bytes')
function getSettingsFile (settings) {
    const projectSettings = {
        credentialSecret: '',
        httpAdminRoot: '',
        dashboardUI: '',
        disableEditor: '',
        codeEditor: 'monaco',
        theme: 'forge-light',
        page_title: 'FlowFuse',
        page_favicon: '',
        header_title: 'FlowFuse',
        header_url: `url: '${settings.forgeURL}/instance/${settings.projectID}'`,
        palette: {
            allowInstall: true,
            nodesExcludes: [],
            denyList: [],
            allowList: ['*'],
            catalogues: ['https://catalogue.nodered.org/catalogue.json']
        },
        modules: {
            allowInstall: true,
            denyList: [],
            allowList: ['*']
        },
        fileStore: null,
        projectLink: null,
        assistant: null,
        httpNodeAuth: '',
        setupAuthMiddleware: '',
        httpNodeMiddleware: '',
        apiMaxLength: '',
        tcpInAllowInboundConnections: '',
        udpInAllowInboundConnections: '',
        tours: true,
        debugMaxLength: '',
        libraries: ''
    }
    let authMiddlewareRequired = false
    if (settings.settings) {
        // Template/project supplied settings
        if (settings.settings.httpNodeAuth?.user && settings.settings.httpNodeAuth?.pass) {
            projectSettings.httpNodeAuth = `httpNodeAuth: ${JSON.stringify(settings.settings.httpNodeAuth)},`
        } else if (settings.settings.httpNodeAuth?.type === 'flowforge-user') {
            authMiddlewareRequired = true
            projectSettings.setupAuthMiddleware = `const flowforgeAuthMiddleware = require('@flowfuse/nr-launcher/authMiddleware').init({
    type: 'flowforge-user',
    baseURL: '${settings.baseURL}',
    forgeURL: '${settings.forgeURL}',
    clientID: '${settings.clientID}',
    clientSecret: '${settings.clientSecret}',
    teamID: '${settings.teamID}',
    projectId: '${settings.projectID}'
})`
            projectSettings.httpNodeMiddleware = 'httpNodeMiddleware: flowforgeAuthMiddleware,'
        }
        if (settings.credentialSecret !== undefined) {
            projectSettings.credentialSecret = `credentialSecret: '${settings.credentialSecret}',`
        }
        if (settings.settings.httpAdminRoot !== undefined) {
            projectSettings.httpAdminRoot = `httpAdminRoot: '${settings.settings.httpAdminRoot}',`
        }
        if (settings.settings.dashboardUI !== undefined || authMiddlewareRequired) {
            const dashboardSettings = []
            if (settings.settings.dashboardUI !== undefined) {
                dashboardSettings.push(`path: '${settings.settings.dashboardUI}'`)
            }
            if (authMiddlewareRequired && settings.settings.dashboardIFrame) {
                dashboardSettings.push('middleware: flowforgeAuthMiddleware.concat(DashboardIFrameMiddleware)')
            } else if (authMiddlewareRequired && !settings.settings.dashboardIFrame) {
                dashboardSettings.push('middleware: flowforgeAuthMiddleware')
            } else if (!authMiddlewareRequired && settings.settings.dashboardIFrame) {
                dashboardSettings.push('middleware: [ DashboardIFrameMiddleware ]')
            }
            if (settings.settings.apiMaxLength) {
                try {
                    dashboardSettings.push(`maxHttpBufferSize: ${bytes(settings.settings.apiMaxLength)}`)
                } catch (err) {
                    // failed to parse
                }
            }
            projectSettings.dashboardUI = `ui: { ${dashboardSettings.join(', ')}},`
        }
        if (settings.settings.disableEditor !== undefined) {
            projectSettings.disableEditor = `disableEditor: ${settings.settings.disableEditor},`
        }
        if (settings.settings.ha?.replicas >= 2) {
            projectSettings.disableEditor = 'disableEditor: true,'
        }
        if (settings.settings.codeEditor) {
            projectSettings.codeEditor = settings.settings.codeEditor
        }
        if (typeof settings.settings.theme === 'string') {
            if (settings.settings.theme === '' || settings.settings.theme === 'node-red') {
                projectSettings.theme = '' // use default node-red theme
            } else {
                projectSettings.theme = settings.settings.theme
            }
        }
        if (settings.settings.page?.title) {
            projectSettings.page_title = settings.settings.page.title
        }
        projectSettings.page_favicon = 'favicon: "/theme/css/favicon.ico",' // TODO: get from theme
        if (settings.settings.page?.favicon) {
            projectSettings.page_favicon = `favicon: "${settings.settings.page.favicon}",`
        }
        if (settings.settings.header?.title) {
            projectSettings.header_title = settings.settings.header.title
        }
        if (settings.settings.header?.url) {
            projectSettings.header_url = settings.settings.header.url
        }
        if (settings.settings.palette?.allowInstall !== undefined) {
            projectSettings.palette.allowInstall = settings.settings.palette.allowInstall
        }
        if (settings.settings.palette?.nodesExcludes !== undefined) {
            projectSettings.palette.nodesExcludes = settings.settings.palette.nodesExcludes.split(',').map(fn => fn.trim()).filter(fn => fn.length > 0)
        }
        if (settings.settings.modules?.allowInstall !== undefined) {
            projectSettings.modules.allowInstall = settings.settings.modules.allowInstall
        }
        if (settings.settings.palette?.allowList !== undefined) {
            projectSettings.palette.allowList = settings.settings.palette.allowList || ['*']
        }
        if (settings.settings.palette?.denyList !== undefined) {
            projectSettings.palette.denyList = settings.settings.palette.denyList || []
        }
        if (settings.settings.modules?.allowList !== undefined) {
            projectSettings.modules.allowList = settings.settings.modules.allowList || ['*']
        }
        if (settings.settings.modules?.denyList !== undefined) {
            projectSettings.modules.denyList = settings.settings.modules.denyList || []
        }
        if (settings.allowInboundTcp === true || settings.allowInboundTcp === false) {
            projectSettings.tcpInAllowInboundConnections = `tcpInAllowInboundConnections: ${settings.allowInboundTcp},`
        }
        if (settings.allowInboundUdp === true || settings.allowInboundUdp === false) {
            projectSettings.udpInAllowInboundConnections = `udpInAllowInboundConnections: ${settings.allowInboundUdp},`
        }
        if (settings.settings.disableTours) {
            projectSettings.tours = false
        }
        if (settings.settings.apiMaxLength) {
            projectSettings.apiMaxLength = `apiMaxLength: "${settings.settings.apiMaxLength}",`
        }
        if (settings.settings.debugMaxLength) {
            projectSettings.debugMaxLength = `debugMaxLength: ${settings.settings.debugMaxLength},`
        }
    }

    if (settings.features?.projectComms && settings.broker) {
        // Enable the projectLink nodes if a broker configuration is provided
        projectSettings.projectLink = {
            token: settings.projectToken,
            broker: { ...settings.broker }
        }
        if (settings.features?.teamBroker) {
            projectSettings.projectLink.teamBrokerEnabled = true
        }
        if (settings.settings.ha?.replicas >= 2) {
            projectSettings.projectLink.useSharedSubscriptions = true
        }
    }

    if (settings.assistant) {
        let mcp = { enabled: true } // default to enabled
        if (typeof settings.assistant.mcp === 'object') {
            mcp = { ...settings.assistant.mcp }
        }

        let completions = { enabled: true } // default to enabled
        if (settings.assistant.completions) {
            completions = { ...settings.assistant.completions }
        }

        // Enable the nr-assistant nodes when configured
        projectSettings.assistant = {
            enabled: settings.assistant.enabled, // overall enable/disable
            url: `${settings.forgeURL}/api/v1/assistant/`, // URL for the assistant service
            token: settings.projectToken,
            requestTimeout: settings.assistant.requestTimeout || 60000, // timeout for assistant requests
            mcp,
            completions
        }
    }

    // all current drivers add settings.rootDir and settings.userDir
    if (settings.rootDir) {
        const uibRoot = path.join(settings.storageDir, 'uibuilder').split(path.sep).join(path.posix.sep)
        projectSettings.uibuilder = { uibRoot }
    }

    if (settings.settings?.httpStatic) {
        // This is an array of httpStatic properties - however their path setting
        // will currently be relative to cwd. For safety, map them to absolute paths
        // and validate they are not traversing out of the storageDir
        const httpStatic = []
        settings.settings.httpStatic.forEach(staticSetting => {
            staticSetting.path = path.normalize(path.join(settings.storageDir, staticSetting.path))
            if (staticSetting.path.startsWith(settings.storageDir) && staticSetting.root) {
                httpStatic.push('{' +
                    'path: ' + JSON.stringify(staticSetting.path) + ',' +
                    'root: ' + JSON.stringify(staticSetting.root) +
                    (authMiddlewareRequired ? ', middleware: flowforgeAuthMiddleware' : '') +
                    '}')
            }
        })
        if (httpStatic.length > 0) {
            projectSettings.httpStatic = '[' + httpStatic.join(', ') + ']'
        }
    }

    let contextStorage = ''
    if (settings.fileStore?.url) {
        // file nodes settings
        projectSettings.fileStore = { ...settings.fileStore }
        projectSettings.fileStore.token ||= settings.projectToken
        if (settings.licenseType === 'ee') {
            // context storage settings
            contextStorage = `contextStorage: {
                default: "memory",
                memory: { module: 'memory' },
                persistent: {
                    module: require("@flowfuse/nr-launcher/context"),
                    config: {
                        projectID: '${settings.projectID}',
                        url: '${settings.fileStore.url}',
                        token: '${settings.projectToken}'
                    }
                }
            },`
        }
    }
    if (projectSettings.theme) {
        const themeSettings = {
            launcherVersion: settings.launcherVersion,
            forgeURL: settings.forgeURL,
            projectURL: `${settings.forgeURL}/instance/${settings.projectID}`
        }
        projectSettings.themeSettings = `"${projectSettings.theme}": ${JSON.stringify(themeSettings)},`
        projectSettings.theme = `theme: '${projectSettings.theme}',`
    }

    let nodesDir = ''
    if (settings.nodesDir && settings.nodesDir.length) {
        nodesDir = `nodesDir: ${JSON.stringify(settings.nodesDir)},`
    }
    const librarySources = []
    if (settings.features?.['shared-library']) {
        librarySources.push({
            id: 'flowforge-team-library',
            type: 'flowforge-team-library',
            label: 'Team Library',
            icon: 'font-awesome/fa-users',
            baseURL: settings.storageURL,
            projectID: settings.projectID,
            libraryID: settings.teamID,
            token: settings.projectToken
        })
    }
    if (settings.licenseType === 'ee') {
        librarySources.push({
            id: 'flowfuse-blueprint-library',
            type: 'flowfuse-blueprint-library',
            label: 'Blueprints',
            icon: 'font-awesome/fa-map-o',
            types: ['flows'],
            readOnly: true,
            forgeURL: settings.forgeURL,
            teamID: settings.teamID,
            token: settings.projectToken
        })
    }
    if (librarySources.length > 0) {
        projectSettings.libraries = `library: { sources: ${JSON.stringify(librarySources)} },`
    }

    if (settings.licenseType === 'ee') {
        if (settings.settings.palette?.catalogue !== undefined) {
            projectSettings.palette.catalogues = settings.settings.palette.catalogue
        }
    }

    const httpAdminCookieOptions = { }

    if (settings.forgeURL.includes('https://')) {
        httpAdminCookieOptions.name = 'nr-ff-auth'
        httpAdminCookieOptions.sameSite = 'None'
        httpAdminCookieOptions.secure = true
        httpAdminCookieOptions.partitioned = true
    }

    const settingsTemplate = `
${projectSettings.setupAuthMiddleware}
const DashboardIFrameMiddleware = async function(req,res,next) {
    res.set("Content-Security-Policy", "frame-ancestors *");
    next()
}
module.exports = {
    flowFile: 'flows.json',
    flowFilePretty: true,
    adminAuth: require('@flowfuse/nr-launcher/adminAuth')({
        baseURL: '${settings.baseURL}',
        forgeURL: '${settings.forgeURL}',
        teamID: '${settings.teamID}',
        clientID: '${settings.clientID}',
        clientSecret: '${settings.clientSecret}'
    }),
    ${projectSettings.credentialSecret}
    ${projectSettings.httpAdminRoot}
    ${projectSettings.dashboardUI}
    ${projectSettings.disableEditor}
    ${projectSettings.httpNodeAuth}
    ${projectSettings.httpNodeMiddleware}
    ${projectSettings.apiMaxLength}
    ${projectSettings.debugMaxLength}
    ${projectSettings.tcpInAllowInboundConnections}
    ${projectSettings.udpInAllowInboundConnections}
    httpServerOptions: {
        "trust proxy": true
    },
    storageModule: require('@flowfuse/nr-launcher/storage'),
    httpStorage: {
        projectID: '${settings.projectID}',
        baseURL: '${settings.storageURL}',
        token: '${settings.projectToken}'
    },
    ${contextStorage}
    logging: {
        console: { level: 'info', metric: false, audit: false, handler: () => {
                const levelNames = {
                    10: "fatal",
                    20: "error",
                    30: "warn",
                    40: "info",
                    50: "debug",
                    60: "trace",
                    98: "audit",
                    99: "metric"
                }
                return (msg) => {
                    let message = msg.msg;
                    try {
                        if (typeof message === 'object' && message !== null && message.toString() === '[object Object]' && message.message) {
                            message = message.message;
                        }
                    } catch(e){
                        message = 'Exception trying to log: '+util.inspect(message);
                    }
                    console.log(JSON.stringify({
                        ts: Date.now(),
                        level: levelNames[msg.level],
                        type: msg.type,
                        name: msg.name,
                        id:msg.id,
                        msg: message
                    }))
                }
            }

        },
        auditLogger: {
            level: 'off', audit: true, handler: require('@flowfuse/nr-launcher/auditLogger'),
            loggingURL: '${settings.auditURL}',
            projectID: '${settings.projectID}',
            token: '${settings.projectToken}'
        },
        metricsLogger: {
            level: 'off', metrics: true, handler: require('@flowfuse/nr-launcher/metricsLogger').logger,
        }
    },
    ${nodesDir}
    ${projectSettings.themeSettings || ''}
    editorTheme: {
        ${projectSettings.theme}
        page: {
            title: '${projectSettings.page_title}',
            ${projectSettings.page_favicon}
        },
        header: {
            title: '${projectSettings.header_title}',
            ${projectSettings.header_url}
        },
        logout: {
            redirect: '${settings.forgeURL}/instance/${settings.projectID}'
        },
        codeEditor: {
            lib: '${projectSettings.codeEditor}'
        },
        ${projectSettings.libraries}
        tours: ${projectSettings.tours},
        palette: {
            catalogues: ${JSON.stringify(projectSettings.palette.catalogues)}
        },
        multiplayer: {
            enabled: true
        }
    },
    nodesExcludes: ${JSON.stringify(projectSettings.palette.nodesExcludes)},
    externalModules: {
        // autoInstall: true,
        palette: {
            allowInstall: ${projectSettings.palette.allowInstall},
            allowUpload: false,
            denyList: ${JSON.stringify(projectSettings.palette.denyList)},
            allowList: ${JSON.stringify(projectSettings.palette.allowList)}
        },
        modules: {
            allowInstall: ${projectSettings.modules.allowInstall},
            denyList: ${JSON.stringify(projectSettings.modules.denyList)},
            allowList: ${JSON.stringify(projectSettings.modules.allowList)}
        }
    },
    functionExternalModules: ${projectSettings.modules.allowInstall},
    flowforge: {
        forgeURL: '${settings.forgeURL}',
        teamID:  '${settings.teamID}',
        projectID: '${settings.projectID}',
        launcherVersion: '${settings.launcherVersion}',
        ${projectSettings.fileStore ? 'fileStore: ' + JSON.stringify(projectSettings.fileStore) + ',' : ''}
        ${projectSettings.projectLink ? 'projectLink: ' + JSON.stringify(projectSettings.projectLink) + ',' : ''}
        ${projectSettings.assistant ? 'assistant: ' + JSON.stringify(projectSettings.assistant) + ',' : ''}
        ${settings.features?.tables ? `tables: {token: '${settings.projectToken}'}` : ''}
    },
    runtimeState: {
        enabled: true,
        ui: true
    },
    telemetry: {
        enabled: true
    },
    httpAdminMiddleware: function(req,res,next) {
        res.set("Content-Security-Policy", "frame-ancestors 'self' ${settings.forgeURL}");
        next()
    },
    httpAdminCookieOptions: ${JSON.stringify(httpAdminCookieOptions)},
    ${projectSettings.uibuilder ? 'uibuilder: ' + JSON.stringify(projectSettings.uibuilder) + ',' : ''}
    ${projectSettings.httpStatic ? 'httpStatic: ' + projectSettings.httpStatic : ''}
}
`
    return settingsTemplate
}

module.exports = {
    getSettingsFile
}
