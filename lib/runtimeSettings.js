function getSettingsFile(settings) {
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
            lib: "monaco"
        }
    }
}`
    return settingsTemplate
}

module.exports = {
    getSettingsFile,
}
