const http = require('http')
const express = require('express')
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

        app.get('/flowforge/logs', (request, response) => {
            response.send(this.launcher.getLog().toArray())
        })

        app.get('/flowforge/resources', (request, response) => {
            response.send(this.launcher.getResources().toArray())
        })

        app.get('/flowforge/health-check', (request, response) => {
            if (this.launcher.isHealthy()) {
                response.sendStatus(200)
            } else {
                response.sendStatus(500)
            }
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
