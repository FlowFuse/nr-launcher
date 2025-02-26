const client = require('prom-client')

module.exports = (RED) => {
    RED.plugins.registerPlugin('ff-nr-metrics', {
        settings: {
            '*': { exportable: true }
        },
        onadd: function () {
            const collectDefaultMetrics = client.collectDefaultMetrics
            const Registry = client.Registry
            const register = new Registry()
            collectDefaultMetrics({ register })
            RED.httpAdmin.get('/ff/metrics', async function (req, res) {
                try {
                    const metrics = await register.metrics()
                    res.send(metrics)
                } catch (err) {
                    res.status(500).send({ error: err.toString() })
                }
            })
            RED.log.info('FlowFuse Metrics Plugin loaded')
        }
    })
}
