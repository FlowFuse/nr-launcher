function getSettingsFile(settings) {

    const projectSettings = {
        httpAdminRoot: '',
        disableEditor: '',
        codeEditor: 'monaco',
        palette: {
            allowInstall: true,
            nodesExcludes: []
        },
        modules: {
            allowInstall: true
        }
    }

    if (settings.settings) {
        // Template/project supplied settings
        if (settings.settings.httpAdminRoot !== undefined) {
            projectSettings.httpAdminRoot = `    httpAdminRoot: '${settings.settings.httpAdminRoot}',`
        }
        if (settings.settings.disableEditor !== undefined) {
            projectSettings.disableEditor = `    disableEditor: ${settings.settings.disableEditor},`
        }
        if (settings.settings.codeEditor) {
            projectSettings.codeEditor = settings.settings.codeEditor
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
    ${projectSettings.httpAdminRoot}
    ${projectSettings.disableEditor}
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
    editorTheme: {
        page: {
            title: 'FlowForge'
        },
        header: {
            title: 'FlowForge'
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
            allowUpload: false
        },
        modules: {
            allowInstall: ${projectSettings.modules.allowInstall}
        }
    },
    functionExternalModules: ${projectSettings.modules.allowInstall}
}`
    return settingsTemplate
}

module.exports = {
    getSettingsFile,
}
