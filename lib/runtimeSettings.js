function getSettingsFile (settings) {
    const projectSettings = {
        credentialSecret: '',
        httpAdminRoot: '',
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
            allowList: ['*']
        },
        modules: {
            allowInstall: true,
            denyList: [],
            allowList: ['*']
        },
        broker: {
            url: '',
            username: null,
            password: null,
            clientID: null
        }
    }

    if (settings.settings) {
        // Template/project supplied settings
        if (settings.credentialSecret !== undefined) {
            projectSettings.credentialSecret = `credentialSecret: '${settings.credentialSecret}',`
        }
        if (settings.settings.httpAdminRoot !== undefined) {
            projectSettings.httpAdminRoot = `httpAdminRoot: '${settings.settings.httpAdminRoot}',`
        }
        if (settings.settings.disableEditor !== undefined) {
            projectSettings.disableEditor = `disableEditor: ${settings.settings.disableEditor},`
        }
        if (settings.settings.codeEditor) {
            projectSettings.codeEditor = settings.settings.codeEditor
        }
        if (settings.settings.theme) {
            projectSettings.theme = settings.settings.theme
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
            projectSettings.palette.allowList = settings.settings.palette.allowList
        }
        if (settings.settings.palette?.denyList !== undefined) {
            projectSettings.palette.denyList = settings.settings.palette.denyList
        }
        if (settings.settings.modules?.allowList !== undefined) {
            projectSettings.modules.allowList = settings.settings.modules.allowList
        }
        if (settings.settings.modules?.denyList !== undefined) {
            projectSettings.modules.denyList = settings.settings.modules.denyList
        }
        // project link broker settings
        if (settings.settings.broker?.url) {
            projectSettings.broker.url = settings.settings.broker.url
        }
        if (settings.settings.broker?.username !== undefined) {
            projectSettings.broker.username = settings.settings.broker.username
        }
        if (settings.settings.broker?.password !== undefined) {
            projectSettings.broker.password = settings.settings.broker.password
        }
        if (settings.settings.broker?.clientID !== undefined) {
            projectSettings.broker.clientID = settings.settings.broker.clientID
        } else if (projectSettings.broker.username) {
            projectSettings.broker.clientID = projectSettings.broker.username + ':n'
        }
    }

    if (projectSettings.theme) {
        projectSettings.theme = `theme: '${projectSettings.theme}',`
    }

    let nodesDir = ''
    if (settings.nodesDir && settings.nodesDir.length) {
        nodesDir = `nodesDir: ${JSON.stringify(settings.nodesDir)},`
    }
    const settingsTemplate = `
module.exports = {
    flowFile: 'flows.json',
    flowFilePretty: true,
    adminAuth: require('@flowforge/nr-auth')({
        baseURL: '${settings.baseURL}',
        forgeURL: '${settings.forgeURL}',
        clientID: '${settings.clientID}',
        clientSecret: '${settings.clientSecret}'
    }),
    ${projectSettings.credentialSecret}
    ${projectSettings.httpAdminRoot}
    ${projectSettings.disableEditor}
    httpServerOptions: {
        "trust proxy": true
    },
    storageModule: require('@flowforge/nr-storage'),
    httpStorage: {
        projectID: '${settings.projectID}',
        baseURL: '${settings.storageURL}',
        token: '${settings.projectToken}'
    },
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
            level: 'off', audit: true, handler: require('@flowforge/nr-audit-logger'),
            loggingURL: '${settings.auditURL}',
            projectID: '${settings.projectID}',
            token: '${settings.projectToken}'
        }
    },
    ${nodesDir}
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
        }
    },
    nodesExcludes: ${JSON.stringify(projectSettings.palette.nodesExcludes)},
    externalModules: {
        autoInstall: true,
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
        projectLink: {
            token: '${settings.projectToken}',
            broker: {
                url: '${projectSettings.broker.url}',
                username: ${projectSettings.broker.username ? '"' + projectSettings.broker.username + '"' : null},
                password: ${projectSettings.broker.password ? '"' + projectSettings.broker.password + '"' : null},
                clientID: ${projectSettings.broker.clientID ? '"' + projectSettings.broker.clientID + '"' : null}
            }
        }
    }
}`
    return settingsTemplate
}

module.exports = {
    getSettingsFile
}
