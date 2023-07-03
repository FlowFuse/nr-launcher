const { existsSync } = require('fs')

module.exports = function (RED) {
    let headerImage = 'resources/@flowforge/nr-theme/ff-nr.png' // file path for nr-theme installation
    let favicon = 'resources/@flowforge/nr-theme/favicon-16x16.png' // file path for nr-theme installation
    if (!existsSync(headerImage)) {
        headerImage = 'resources/@flowforge/nr-launcher/ff-nr.png' // file path for when embedded in nr-launcher
    }
    if (!existsSync(favicon)) {
        favicon = 'resources/@flowforge/nr-launcher/favicon-16x16.png' // file path for when embedded in nr-launcher
    }

    RED.plugins.registerPlugin('forge-dark', {
        type: 'node-red-theme',
        scripts: [
            'lib/theme/common/forge-common.js'
            // /* optional */ 'lib/theme/forge-dark/forge-dark-custom.js'
        ],
        css: [
            'lib/theme/common/forge-common.css',
            'lib/theme/forge-dark/forge-dark-theme.css'
            // /* optional */ 'lib/theme/forge-light/forge-light-custom.css'
        ],
        settings: {
            theme: {
                value: 'forge-dark',
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
        },
        monacoOptions: {
            theme: require('./forge-dark-monaco.json'),
            fontSize: 14,
            fontLigatures: true,
            fontFamily: "Cascadia Code, Fira Code, Consolas, 'Courier New', monospace",
            fontWeight: '300',
            colorDecorators: true,
            dragAndDrop: true,
            linkedEditing: true,
            showFoldingControls: 'always',
            'bracketPairColorization.enabled': true
        }
    })

    console.log('FlowForge Dark Theme Plugin loaded')
}
