const { setupAuthRoutes } = require('./httpAuthMiddleware')

module.exports = (RED) => {
    RED.plugins.registerPlugin('ff-auth-plugin', {
        onadd: () => {
            RED.log.info('FlowForge HTTP Authentication Plugin loaded')
            setupAuthRoutes(RED.httpNode)
        }
    })
}
