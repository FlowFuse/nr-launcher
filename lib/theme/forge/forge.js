const { existsSync } = require('fs')

module.exports = function (RED) {
    let headerImage = 'resources/@flowfuse/nr-theme/ff-nr.png'
    let favicon = 'resources/@flowfuse/nr-theme/favicon-16x16.png'
    if (!existsSync(headerImage)) {
        headerImage = 'resources/@flowfuse/nr-launcher/ff-nr.png'
    }
    if (!existsSync(favicon)) {
        favicon = 'resources/@flowfuse/nr-launcher/favicon-16x16.png'
    }

    RED.plugins.registerPlugin('forge', {
        type: 'node-red-theme',
        schemes: ['light', 'dark'],
        scripts: [
            'lib/theme/forge/forge-common.js'
        ],
        css: [
            'lib/theme/forge/forge.css'
        ],
        settings: {
            theme: {
                value: 'forge',
                exportable: true
            },
            headerImage: {
                value: headerImage,
                exportable: true
            },
            favicon: {
                value: favicon,
                exportable: true
            },
            launcherVersion: {
                exportable: true
            },
            forgeURL: {
                exportable: true
            },
            projectURL: {
                exportable: true
            }
        }
    })

    RED.log.info('FlowFuse Theme Plugin loaded')
}
