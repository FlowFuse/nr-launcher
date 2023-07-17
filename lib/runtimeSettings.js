function getSettingsFile (settings) {
    const projectSettings = {
        credentialSecret: '',
        httpAdminRoot: '',
        dashboardUI: '',
        disableEditor: '',
        codeEditor: 'monaco',
        theme: 'forge-light',
        page_title: 'FlowForge',
        page_favicon: '',
        header_title: 'FlowForge',
        header_url: `url: '${settings.forgeURL}/project/${settings.projectID}'`,
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
        httpNodeAuth: '',
        setupAuthMiddleware: '',
        httpNodeMiddleware: '',
        tcpInAllowInboundConnections: '',
        udpInAllowInboundConnections: '',
        tours: true,
        libraries: ''
    }
    let authMiddlewareRequired = false
    if (settings.settings) {
        // Template/project supplied settings
        if (settings.settings.httpNodeAuth?.user && settings.settings.httpNodeAuth?.pass) {
            projectSettings.httpNodeAuth = `httpNodeAuth: ${JSON.stringify(settings.settings.httpNodeAuth)},`
        } else if (settings.settings.httpNodeAuth?.type === 'flowforge-user') {
            authMiddlewareRequired = true
            projectSettings.setupAuthMiddleware = `const flowforgeAuthMiddleware = require('@flowforge/nr-launcher/authMiddleware').init({
    type: 'flowforge-user',
    baseURL: '${settings.baseURL}',
    forgeURL: '${settings.forgeURL}',
    clientID: '${settings.clientID}',
    clientSecret: '${settings.clientSecret}'
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
            if (authMiddlewareRequired) {
                dashboardSettings.push('middleware: flowforgeAuthMiddleware')
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
    }

    if (settings.licenseType === 'ee' && settings.broker) {
        // Enable the projectLink nodes if a broker configuration is provided
        projectSettings.projectLink = {
            token: settings.projectToken,
            broker: { ...settings.broker }
        }
        if (settings.settings.ha?.replicas >= 2) {
            projectSettings.projectLink.useSharedSubscriptions = true
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
                    module: require("@flowforge/nr-persistent-context"),
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
            projectURL: `${settings.forgeURL}/project/${settings.projectID}`
        }
        projectSettings.themeSettings = `"${projectSettings.theme}": ${JSON.stringify(themeSettings)},`
        projectSettings.theme = `theme: '${projectSettings.theme}',`
    }

    let nodesDir = ''
    if (settings.nodesDir && settings.nodesDir.length) {
        nodesDir = `nodesDir: ${JSON.stringify(settings.nodesDir)},`
    }

    if (settings.licenseType === 'ee') {
        const sharedLibraryConfig = {
            id: 'flowforge-team-library',
            type: 'flowforge-team-library',
            label: 'Team Library',
            icon: 'font-awesome/fa-users',
            baseURL: settings.storageURL,
            projectID: settings.projectID,
            libraryID: settings.teamID,
            token: settings.projectToken
        }
        projectSettings.libraries = `library: { sources: [ ${JSON.stringify(sharedLibraryConfig)} ] },`

        if (settings.settings.palette?.catalogues !== undefined) {
            projectSettings.palette.catalogues = settings.settings.palette.catalogues
        }
    }

    const settingsTemplate = `
${projectSettings.setupAuthMiddleware}
module.exports = {
    flowFile: 'flows.json',
    flowFilePretty: true,
    adminAuth: require('@flowforge/nr-launcher/adminAuth')({
        baseURL: '${settings.baseURL}',
        forgeURL: '${settings.forgeURL}',
        clientID: '${settings.clientID}',
        clientSecret: '${settings.clientSecret}'
    }),
    ${projectSettings.credentialSecret}
    ${projectSettings.httpAdminRoot}
    ${projectSettings.dashboardUI}
    ${projectSettings.disableEditor}
    ${projectSettings.httpNodeAuth}
    ${projectSettings.httpNodeMiddleware}
    ${projectSettings.tcpInAllowInboundConnections}
    ${projectSettings.udpInAllowInboundConnections}
    httpServerOptions: {
        "trust proxy": true
    },
    storageModule: require('@flowforge/nr-launcher/storage'),
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
            level: 'off', audit: true, handler: require('@flowforge/nr-launcher/auditLogger'),
            loggingURL: '${settings.auditURL}',
            projectID: '${settings.projectID}',
            token: '${settings.projectToken}'
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
            redirect: '${settings.forgeURL}/project/${settings.projectID}'
        },
        codeEditor: {
            lib: '${projectSettings.codeEditor}'
        },
        ${projectSettings.libraries}
        tours: ${projectSettings.tours}
    },
    nodesExcludes: ${JSON.stringify(projectSettings.palette.nodesExcludes)},
    externalModules: {
        // autoInstall: true,
        palette: {
            allowInstall: ${projectSettings.palette.allowInstall},
            allowUpload: false,
            denyList: ${JSON.stringify(projectSettings.palette.denyList)},
            allowList: ${JSON.stringify(projectSettings.palette.allowList)},
            catalogues: ${JSON.stringify(projectSettings.palette.catalogues)}
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
        ${projectSettings.projectLink ? 'projectLink: ' + JSON.stringify(projectSettings.projectLink) : ''}
    },
    runtimeState: {
        enabled: true,
        ui: true
    }
}`
    return settingsTemplate
}

module.exports = {
    getSettingsFile
}
