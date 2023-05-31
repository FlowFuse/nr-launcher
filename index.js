#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const commandLineArgs = require('command-line-args')

const NODE_MAJOR_VERSION = process.versions.node.split('.')[0]
if (NODE_MAJOR_VERSION > 14) {
    const dns = require('node:dns')
    dns.setDefaultResultOrder('ipv4first')
}

const { Launcher } = require('./lib/launcher')
const { AdminInterface } = require('./lib/admin')

const cmdLineOptions = [
    { name: 'port', alias: 'p', type: Number },
    { name: 'forgeURL', type: String },
    { name: 'team', alias: 't', type: String },
    { name: 'project', type: String },
    { name: 'token', type: String },
    { name: 'buffer', alias: 'b', type: Number },
    { name: 'nodeRedPath', alias: 'n', type: String },
    { name: 'credentialSecret', type: String },
    { name: 'no-tcp-in', alias: 'T', type: Boolean },
    { name: 'no-udp-in', alias: 'U', type: Boolean }
]

const options = commandLineArgs(cmdLineOptions)

options.forgeURL = options.forgeURL || process.env.FORGE_URL
options.team = options.team || process.env.FORGE_TEAM_ID
options.project = options.project || process.env.FORGE_PROJECT_ID
options.token = options.token || process.env.FORGE_PROJECT_TOKEN
options.logBufferMax = options.logBufferMax || 1000
options.nodeRedPath = options.nodeRedPath || process.env.FORGE_NR_PATH

// Boolean Options
const parseBoolean = (val, _default) => {
    if (val === true || val === false) { return val }
    if (val === 'true' || val === 'TRUE') { return true }
    if (val === 'false' || val === 'FALSE') { return false }
    return _default
}
const noTcp = parseBoolean(options['no-tcp-in'], parseBoolean(process.env.FORGE_NR_NO_TCP_IN), undefined)
const noUdp = parseBoolean(options['no-udp-in'], parseBoolean(process.env.FORGE_NR_NO_UDP_IN), undefined)
options.allowInboundTcp = noTcp === undefined ? undefined : !noTcp
options.allowInboundUdp = noUdp === undefined ? undefined : !noTcp

if (process.env.FORGE_BROKER_URL && process.env.FORGE_BROKER_USERNAME && process.env.FORGE_BROKER_PASSWORD) {
    options.broker = {
        url: process.env.FORGE_BROKER_URL,
        username: process.env.FORGE_BROKER_USERNAME,
        password: process.env.FORGE_BROKER_PASSWORD
    }
}

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

// Gather versions numbers for reporting to the platform
options.versions = {
    node: process.version.replace(/^v/, ''),
    launcher: require('./package.json').version
}

// Go find Node-RED's package.json
const nrModulePath = path.relative(__dirname, path.join(path.dirname(options.execPath), '..', 'node-red', 'package.json'))
try {
    const nrPkg = require(nrModulePath)
    options.versions['node-red'] = nrPkg.version
} catch (err) {
    options.versions['node-red'] = err.toString()
}

async function main () {
    const launcher = new Launcher(options)
    const adminInterface = new AdminInterface(options, launcher)
    adminInterface.start()

    process.on('SIGTERM', async () => {
        await launcher.stop()
        process.exit(0)
    })
    try {
        await launcher.loadSettings()
        await launcher.start()
    } catch (error) {
        await launcher.logAuditEvent('start-failed', { error })
    }

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
