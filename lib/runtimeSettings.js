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
        console: { level: 'info', metric: false, audit: false },
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
        }
    }
}`
    return settingsTemplate
}

module.exports = {
    getSettingsFile,
}
