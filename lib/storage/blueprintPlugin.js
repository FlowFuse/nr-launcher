/*
 * IMPORTANT
    * This plugin is a duplicate of the one in device-agent/lib/plugins/node_modules/@flowfuse/flowfuse-blueprint-plugin/blueprintPlugin.js
      Any changes made to either should be made to both.
*/

const got = require('got')

module.exports = function (RED) {
    const PLUGIN_TYPE_ID = 'flowfuse-blueprint-library'

    // We do not retrieve the blueprint list on every request; we get it once and cache the result.
    // The cache is expired after 2 minutes. Most interactions with the library will be short-lived
    // and within this interval - so this is the right balance between performance and freshness.
    let blueprintCache = {}
    let cacheLastRefreshedAt = 0
    const CACHE_EXPIRY_PERIOD = 2 * 60 * 1000 // 2 minutes in milliseconds

    // global-config support for imported modules was added in 4.1.
    const versionParts = RED.version().split('.')
    const globalConfigSupported = (versionParts[0] === '4' && versionParts[1] >= '1') || (versionParts[0] > '4')

    class FFBlueprintLibraryPlugin {
        constructor (config) {
            this.type = PLUGIN_TYPE_ID
            this.id = config.id
            this.label = config.label
            const { forgeURL, teamID, token } = config
            if (!teamID) {
                throw new Error('Missing required configuration property: teamID')
            }
            this.teamID = teamID
            if (!forgeURL) {
                throw new Error('Missing required configuration property: forgeURL')
            }
            if (!token) {
                throw new Error('Missing required configuration property: token')
            }
            this._client = got.extend({
                prefixUrl: config.forgeURL + '/api/v1/flow-blueprints/',
                headers: {
                    'user-agent': 'FlowFuse Blueprint Library Plugin v0.1',
                    authorization: 'Bearer ' + token
                },
                timeout: {
                    request: 10000
                }
            })
        }

        /**
         * Initialise the store.
         */
        async init () {
        }

        /**
         * Get an entry from the store
         * @param {string} type The type of entry - this library only supports 'flow'
         * @param {string} path The path to the library entry
         * @return if 'path' resolves to a single entry, it returns the contents
         *         of that entry.
         *         if 'path' resolves to a 'directory', it returns a listing of
         *         the contents of the directory
         *         if 'path' is not valid, it should throw a suitable error
         */
        async getEntry (type, name) {
            if (type !== 'flows') {
                // This should not happen as the library is registred with `types: ['flows']` to restrict
                // where it is exposed in Node-RED.
                throw new Error(`FlowFuse Blueprint Library Plugin: Unsupported type '${type}' - only 'flow' is supported`)
            }
            await this.loadBlueprints()
            if (!name) {
                const categories = Object.keys(blueprintCache)
                categories.sort()
                return categories
            }
            if (name.endsWith('/')) {
                // If the name ends with a slash, return the contents of that directory
                const category = name.slice(0, -1) // Remove the trailing slash
                const blueprints = blueprintCache[category] || []
                return blueprints.map(blueprint => {
                    return {
                        fn: blueprint.name
                    }
                })
            } else {
                // A blueprint name was provided: <category>/<blueprint-name>
                const [category, blueprintName] = name.split(/\/(.*)/s)
                if (blueprintCache[category]) {
                    const blueprint = blueprintCache[category].find(b => b.name === blueprintName)
                    if (blueprint) {
                        const blueprintRequest = await this._client.get(blueprint.id)
                        const blueprintDetails = JSON.parse(blueprintRequest.body)
                        const flows = blueprintDetails.flows.flows || []
                        if (globalConfigSupported) {
                            // Add/update the `global-config` node with module information
                            // This will allow Node-RED 4.1+ to notify the user about what modules
                            // are required.
                            let globalConfig = flows.find(node => node.type === 'global-config')
                            if (!globalConfig) {
                                globalConfig = {
                                    type: 'global-config',
                                    id: RED.util.generateId(),
                                    env: [],
                                    modules: {}
                                }
                                flows.unshift(globalConfig)
                            } else {
                                globalConfig.modules = globalConfig.modules || {}
                            }
                            for (const moduleName of Object.keys(blueprintDetails.modules || {})) {
                                if (moduleName !== 'node-red') {
                                    globalConfig.modules[moduleName] = globalConfig.modules[moduleName] || blueprintDetails.modules[moduleName]
                                }
                            }
                        }
                        return flows || []
                    } else {
                        throw new Error(`Blueprint ${blueprintName} not found in category ${category}`)
                    }
                }
            }
            return []
        }

        async loadBlueprints () {
            if (Date.now() - cacheLastRefreshedAt < CACHE_EXPIRY_PERIOD) {
                return
            }
            try {
                const result = await this._client.get('', {
                    searchParams: {
                        filter: 'active',
                        team: this.teamID
                    }
                })
                blueprintCache = {}
                const blueprints = JSON.parse(result.body)
                for (const blueprint of blueprints.blueprints) {
                    blueprintCache[blueprint.category || 'blueprints'] = blueprintCache[blueprint.category || 'blueprints'] || []
                    blueprintCache[blueprint.category || 'blueprints'].push(blueprint)
                }
                cacheLastRefreshedAt = Date.now()
            } catch (err) {
                RED.log.error(`FlowFuse Blueprint Plugin: failed to load blueprints: ${err}`)
            }
        }
    }

    RED.plugins.registerPlugin(PLUGIN_TYPE_ID, {
        type: 'node-red-library-source',
        class: FFBlueprintLibraryPlugin,
        onadd: () => {
            RED.log.info('FlowFuse Blueprint Library Plugin loaded')
        }
    })
}
