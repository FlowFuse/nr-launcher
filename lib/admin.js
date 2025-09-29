const http = require('http')
const express = require('express')
const expressWs = require('express-ws')
const bodyParser = require('body-parser')
const { States } = require('./launcher')

class AdminInterface {
    /**
     * @param {Object} options Options
     * @param {import ('./launcher').Launcher} launcher The launcher instance
     */
    constructor (options, launcher) {
        this.options = options
        this.launcher = launcher

        const app = express()
        this.app = app
        this.server = http.createServer(app)
        expressWs(this.app, this.server)

        app.use(bodyParser.json({}))
        app.use(bodyParser.text({}))

        app.get('/flowforge/info', (request, response) => {
            const info = {
                id: this.options.project,
                state: this.launcher.getState(),
                lastStartTime: this.launcher.getLastStartTime(),
                versions: options.versions
            }
            response.send(info)
        })

        app.get('/flowforge/logs', async (request, response) => {
            // This endpoint is deprecated, but kept for backwards compatibility
            // until the core platform is updated to use the `/logs/entries` endpoint
            // defined below.
            if (request.query?.start) {
                try {
                    response.send(await this.launcher.logBuffer.getLogFile(request.query.start))
                } catch (err) {
                    if (err.message === 'NotFound') {
                        response.status(404).send({ error: 'ENOTFOUND', message: 'Not Found' })
                    }
                }
            } else {
                response.send(this.launcher.getLog().toArray())
            }
        })
        app.get('/flowforge/logs/entries', async (request, response) => {
            try {
                response.send(await this.launcher.getLog().getLogEntries(request.query.cursor, request.query.limit))
            } catch (err) {
                console.log(err)
                response.send({ meta: {}, logs: [] })
            }
        })
        app.get('/flowforge/resources', (request, response) => {
            const resources = this.launcher.getResources().toArray()
            const values = {
                meta: {},
                resources,
                count: resources.length
            }
            response.send(values)
        })

        /**
         * WebSocket endpoint for real-time resource updates.
         *
         * Connection details:
         * - Endpoint: /flowforge/resources
         * - Protocol: WebSocket
         *
         * Message format:
         * - Messages sent by the server: JSON objects representing resource updates.
         * - Messages sent by the client: Not applicable (this is a one-way communication from server to client).
         *
         * Lifecycle:
         * - On connection: The server will immediately start sending resource updates to the client.
         * - On disconnection: The server will stop sending updates to the client.
         */
        app.ws('/flowforge/resources', (ws, request) => {
            this.launcher.getResources().addWebSocket(ws)
        })

        app.get('/flowforge/health-check', (request, response) => {
            if (this.launcher.isHealthy()) {
                response.sendStatus(200)
            } else {
                response.sendStatus(500)
            }
        })

        app.get('/flowforge/startup', (request, response) => {
            response.setHeader('Content-Type', 'application/openmetrics-text')
            let metrics = '# HELP nr_created_timestamp Unix timestamp when the NR instance was created\n' +
                '# TYPE nr_created_timestamp gauge\n' +
                `nr_created_timestamp ${this.launcher.timing.created}\n`
            if (Object.hasOwn(this.launcher.timing, 'loading')) {
                metrics += '# HELP nr_loading_duration_ms Time spent loading settings from forge app\n' +
                    '# TYPE nr_loading_duration_ms gauge\n' +
                    `nr_loading_duration_ms ${this.launcher.timing.loading}\n`
            }

            if (Object.hasOwn(this.launcher.timing, 'installing')) {
                metrics += '# HELP nr_installing_duration_ms Time spent installing extra npm packages\n' +
                            '# TYPE nr_installing_duration_ms gauge\n' +
                            `nr_installing_duration_ms ${this.launcher.timing.installing}\n`
            }

            if (Object.hasOwn(this.launcher.timing, 'NRstartUp')) {
                metrics += '# HELP nr_startup_duration_ms Elapsed time from NR exec to answering first health check\n' +
                            '# TYPE nr_startup_duration_ms gauge\n' +
                            `nr_startup_duration_ms ${this.launcher.timing.NRstartUp}\n`
            }
            metrics += '# EOF\n'
            response.send(metrics)
        })

        app.post('/flowforge/command', async (request, response) => {
            if (request.body.cmd === 'stop') {
                launcher.stop()
                response.send({})
                // } else {
                //     response.status(409).send({err: "Not running"})
                // }
            } else if (request.body.cmd === 'restart') {
                if (launcher.state === States.RUNNING ||
                    launcher.state === States.CRASHED ||
                    launcher.state === States.SAFE
                ) {
                    await launcher.stop()
                    setTimeout(async () => {
                        // Update the settings
                        try {
                            await launcher.loadSettings()
                            await launcher.start(request.body.safe ? States.SAFE : States.RUNNING)
                        } catch (error) {
                            await launcher.logAuditEvent('start-failed', { error })
                        }
                        response.send({})
                    }, 2000)
                } else if (launcher.state === States.STOPPED) {
                    try {
                        await launcher.loadSettings()
                        await launcher.start(request.body.safe ? States.SAFE : States.RUNNING)
                    } catch (error) {
                        await launcher.logAuditEvent('start-failed', { error })
                    }
                    response.send({})
                } else {
                    // Might need a different response
                    response.send({})
                }
            } else if (request.body.cmd === 'start') {
                if (launcher.getState() === States.RUNNING) {
                    response.status(409).send({ err: 'Already running' })
                } else {
                    try {
                        await launcher.loadSettings()
                        await launcher.start(request.body.safe ? States.SAFE : States.RUNNING)
                    } catch (error) {
                        // delay error audit entry to allow the start command to return and be logged first
                        setTimeout(() => {
                            launcher?.logAuditEvent && launcher.logAuditEvent('start-failed', { error })
                        }, 100)
                    }
                    response.send({})
                }
            } else if (request.body.cmd === 'logout') { // logout:nodered(step-4)
                await launcher.revokeUserToken(request.body.token) // logout:nodered(step-5)
                response.send({})
            } else if (request.body.cmd === 'shutdown') {
                await launcher.stop()
                response.send({})
                process.exit(0)
            } else {
                response.status(404).send({})
            }
        })
    }

    start () {
        this.server.listen(this.options.port)
    }
}

module.exports = { AdminInterface }
