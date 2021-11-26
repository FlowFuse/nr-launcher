#!/usr/bin/env node
const fs = require('fs')
const ws = require('ws')
const got = require('got')
const path = require('path')
const http = require('http')
const express = require('express')
const EventEmitter = require('events')
const bodyParser = require('body-parser')
const childProcess = require('child_process')
const commandLineArgs = require('command-line-args')

const cmdLineOptions = [
  { name: "port", alias: "p", type: Number },
  { name: "forgeURL", type: String },
  { name: "project", type: String },
  { name: "token", type: String },
  { name: "buffer", alias: "b", type: Number}
]

const options = commandLineArgs(cmdLineOptions)

options.forgeURL = options.forgeURL || process.env["FORGE_URL"]
options.project = options.project || process.env["FORGE_PROJECT_ID"]
options.token = options.token || process.env["FORGE_PROJECT_TOKEN"]
options.logBufferMax = options.logBufferMax || 1000

options.execPath = undefined
for (let i=0; i<process.mainModule.paths.length; i++) {
  let execPath = path.join(process.mainModule.paths[i], '.bin', 'node-red')
  if (fs.existsSync(execPath)) {
    options.execPath = execPath
    break
  }
}

if (!options.execPath) {
  console.log(process.mainModule.paths)
  console.log("executable not found")
  process.exit(1)
}

const settingsURL = `${options.forgeURL}/api/v1/project/${options.project}/settings`
console.log(settingsURL)

var proc
const logEmmiter = new EventEmitter();
var logBuffer = []

var running = false
var state = "stopped"
var startTime = []
const minRestartTime = 10000 //10 seconds
const maxRestartCount = 5
var restartCount = 0

async function getSettings() {
  let settigns = {}

  try {
    settings = await got(settingsURL,{
      headers:{
        authorization: `Bearer ${options.token}`
      }
    }).json()
    //console.log("getSettings", settings)
  } catch (exp) {
    console.log("Failed to get settings\n",exp);
    // process.exit(1);
  }

  return settings
}

async function start(settings){

  //console.log(settings)
  if (settings.settings) {
    //should write a settings file
    let settingsPath = path.join(settings.rootDir, settings.userDir, "settings.js")
    //console.log(settingsPath)
    fs.writeFileSync(settingsPath, settings.settings)
  }

  let env = {}

  if (settings.env) {
    Object.assign(env, settings.env)
  }

  let processOptions = {
    windowsHide: true,
    cwd: settings.rootDir,
    //env: env,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.join(settings.rootDir, settings.userDir)
  }

  proc = childProcess.spawn(options.execPath, [
      "-u",
      path.join(settings.rootDir,settings.userDir),
      "-p",
      settings.port
    ],
    processOptions)

  state = "starting"

  proc.on('spawn', () => {
    //only works at NodeJS 16+
    console.log("node-red spawned, ", proc.pid)
    running = true
    state = "started"
    startTime.push(Date.now())
    if (startTime.length > maxRestartCount) {
      startTime.shift()
    }
  })

  proc.on('close', (code, signal)=> {
    console.log("node-red closed with", code)
    //console.log(proc)
  })

  proc.on('exit', async (code, signal) =>{
    console.log("node-red exited with", code)
    running = false;
    if (code == 0) {
      state = "stopped"
    } else {
      state = "crashed"
      if (startTime.length == maxRestartCount) {
        //check restart interval
        let avg = 0
        for (var i = startTime.length-1; i>0; i--) {
          avg += (startTime[i] - startTime[i-1])
        }
        avg /= maxRestartCount
        console.log("restart average", avg)
        if (avg < minRestartTime) {
          //too fast
          console.log("restarting too quickly")
          state="crashed (restart loop)"
        } else {
          //restart
          let newSettings = await getSettings()
          start(newSettings)
        }
      } else {
        //restart
        let newSettings = await getSettings()
        start(newSettings)
      }
    } 

  })

  proc.on('error', (err) => {
    console.log("error", err)
    running = false
  })

  proc.stdout.on('data', (data) => {
    logBuffer.push(data.toString());
    if (logBuffer.length > options.logBufferMax) {
      logBuffer.shift()
    }
    logEmmiter.emit('log', data.toString());
  })

}

async function stop() {
  if (proc) {
    proc.kill()
  }

  proc.unref()
  proc = undefined
}

function exitWhenStopped() {
  stop()
}

async function main() {

  process.on('SIGTERM', exitWhenStopped);

  console.log(options)

  const app = express();
  const server = http.createServer(app);

  app.use(bodyParser.json({}))
  app.use(bodyParser.text({}))

  app.get('/flowforge/info', (request, response) => {
    let info = {
      id: options.project,
      status: state,
      lastStartTime: startTime.length != 0 ? startTime[startTime.length-1] : -1
    }

    response.send(info)
  })

  app.get('/flowforge/logs', (request, response) => {
    response.send(logBuffer);
  })

  app.get('/flowforge/health-check', (request, response) => {
    if (proc.exitCode === null) {
      response.sendStatus(200);
    } else {
      response.sendStatus(500);
    }
  })

  app.post('/flowforge/command', async (request, response) => {
    console.log(request.body)
    if (request.body.cmd == "stop") {
      if (running) {
        stop()
        response.send({})
      } else {
        response.status(409).send({err: "Not running"})
      }
    } else if (request.body.cmd == "restart") {
      if (running) {
        await stop();
      } 

      setTimeout(async ()=> {
        let settings = await getSettings()
        if (request.body.safe) {
          console.log("safemode")
          settings.settings = settings.settings.replace(/ }$/, ', "safeMode": true }')
          console.log(settings)
        }
        await start(settings);
        response.send({})
      }, 2000);

    } else if (request.body.cmd == "start") {
      if (running) {
        response.status(409).send({err: "Already running"})
      } else {
        //let settings = await getSettings()

        await start({
          rootDir: "rootDir",
          userDir: 'userDir',
          port: 1880,
          settings: "module.exports = { flowFile: 'flows.json', flowFilePretty: true }"
        })
        response.send({})
      }
    } else if (request.body.cmd == "shutdown") {
      stop();
      process.exit(0);
    } else {
      response.status(404).send({})
    }
  })

  server.listen(options.port)

  const wss = new ws.Server({ clientTracking: false, noServer: true })

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/flowforge/logs') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    }
  })


  wss.on('connection', (ws, req) => {
    logBuffer.forEach(log => {
      if (log) {
        ws.send(log)
      }
    })

    function wsLogSend(msg) {
      ws.send(msg)
    }

    logEmmiter.on('log', wsLogSend)

    ws.on('close', () => {
      logEmmiter.removeListener('log',wsLogSend)
    })
  })


  let settings = await getSettings()
  await start(settings)
}


main()