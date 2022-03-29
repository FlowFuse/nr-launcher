#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const commandLineArgs = require('command-line-args')

const { Launcher } = require('./lib/launcher')
const { AdminInterface } = require('./lib/admin')

const cmdLineOptions = [
    { name: 'port', alias: 'p', type: Number },
    { name: 'forgeURL', type: String },
    { name: 'project', type: String },
    { name: 'token', type: String },
    { name: 'buffer', alias: 'b', type: Number },
    { name: 'nodeRedPath', alias: 'n', type: String }
]

const options = commandLineArgs(cmdLineOptions)

options.forgeURL = options.forgeURL || process.env.FORGE_URL
options.project = options.project || process.env.FORGE_PROJECT_ID
options.token = options.token || process.env.FORGE_PROJECT_TOKEN
options.logBufferMax = options.logBufferMax || 1000
options.nodeRedPath = options.nodeRedPath || process.env.FORGE_NR_PATH

const ext = process.platform === 'win32' ? '.cmd' : ''

options.execPath = undefined
if (options.nodeRedPath) {
    options.execPath = path.join(options.nodeRedPath, 'node_modules', '.bin', `node-red${ext}`)
    if (!fs.existsSync(options.execPath)) {
        options.execPath = undefined
    }
}
if (!options.execPath) {
    // Find the bundled version
    for (let i = 0; i < require.main.paths.length; i++) {
        const execPath = path.join(require.main.paths[i], '.bin', `node-red${ext}`)
        if (fs.existsSync(execPath)) {
            options.execPath = execPath
            break
        }
    }
}

if (!options.execPath) {
    console.log(require.main.paths)
    console.log('executable not found')
    process.exit(1)
}

async function main () {
    const launcher = new Launcher(options)
    const adminInterface = new AdminInterface(options, launcher)
    adminInterface.start()

    process.on('SIGTERM', async () => {
        await launcher.stop()
        process.exit(0)
    })

    await launcher.loadSettings()
    await launcher.start()

    // const wss = new ws.Server({ clientTracking: false, noServer: true })
    //
    // server.on('upgrade', (req, socket, head) => {
    //   if (req.url === '/flowforge/logs') {
    //     wss.handleUpgrade(req, socket, head, (ws) => {
    //       wss.emit('connection', ws, req)
    //     })
    //   }
    // })
    //
    //
    // wss.on('connection', (ws, req) => {
    //   logBuffer.forEach(log => {
    //     if (log) {
    //       ws.send(log)
    //     }
    //   })
    //
    //   function wsLogSend(msg) {
    //     ws.send(msg)
    //   }
    //
    //   logEmmiter.on('log', wsLogSend)
    //
    //   ws.on('close', () => {
    //     logEmmiter.removeListener('log',wsLogSend)
    //   })
    // })
    //
    //
    // let settings = await getSettings()
    // await start(settings)
}

main()
