const http = require('http')
const YAML = require('yaml')

// setup mock app with authentication endpoint
// that provides auth token validation for testing
function authServer (config = {}) {
    const host = config.host || '127.0.0.1'
    const port = config.port || 3002
    const authConfig = config.authConfig || [
        { token: 'test-token-1', projectId: 'test-project-1' }
    ]
    const requestListener = function (req, res) {
        try {
            let authToken
            const urlParts = req.url.split('/')
            const projectId = urlParts.pop()
            const route = urlParts.join('/')
            switch (route) {
                case '/account/check/project':
                    authToken = authConfig.find(auth => auth.projectId === projectId)
                    if (req.headers.authorization === ('Bearer ' + authToken.token)) {
                        res.writeHead(200)
                        res.end('{}')
                        return
                    }
                    throw new Error('Unknown request')
                default:
                    res.writeHead(404)
                    res.end(JSON.stringify({ error: 'Resource not found' }))
            }
        } catch (error) {
            res.writeHead(401)
            res.end(JSON.stringify({ error: 'unauthorised' }))
        }
    }

    const authServer = http.createServer(requestListener)
    authServer.listen(port, host, () => {
        // listening for requests
    })
    return authServer
}

/**
 * Setup a test file server app
 * @param {Object} config test settings
 * @param {string} [config.home] (optional) path to flowforge home directory
 * @param {string} config.projectId project id
 * @param {string} config.teamId team id
 * @param {string} config.host host
 * @param {number} config.port port
 * @param {string} config.base_url base url
 * @param {Object} config.context context settings
 * @param {'memory'|'sequelize'|'redis'} config.context.type context type
 * @param {number} config.context.quota context quota (max size in MB)
 * @param {Object} config.context.options context options (depends on context type)
 * @param {'sqlite'|'postgres'} config.context.options.type context options type
 * @returns @flowfuse/file-server
 */
async function setupFileServerApp (config = {}) {
    const FF_FS_TEST_CONFIG = {
        FLOWFORGE_HOME: config.home || process.cwd(),
        FLOWFORGE_PROJECT_ID: config.projectId,
        FLOWFORGE_TEAM_ID: config.teamId,
        host: config.host,
        port: config.port,
        base_url: config.base_url,
        driver: {
            type: 'memory',
            options: {
                root: 'var/root'
            }
        },
        context: {
            type: config.context?.type,
            quota: config.context?.quota || 1000,
            options: {
                type: 'sqlite',
                storage: 'ff-context.db'
            }
        }
    }
    if (config.context?.options?.type === 'postgres') {
        FF_FS_TEST_CONFIG.context.options.storage = { ...config.context?.options }
    }
    process.env.FF_FS_TEST_CONFIG = YAML.stringify(FF_FS_TEST_CONFIG)
    const app = await require('@flowforge/file-server')
    return app
}

module.exports = {
    authServer,
    setupFileServerApp
}
