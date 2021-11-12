const RED = require('node-red');
const http = require('http');
const express = require('express');
const got = require('got');
const ws = require('ws');
const EventEmitter = require('events');


const FORGE_URL = process.env["FORGE_URL"];
const FORGE_PROJECT_ID = process.env["FORGE_PROJECT_ID"];
const FORGE_PROJECT_TOKEN = process.env["FORGE_PROJECT_TOKEN"];

const settingsURL = `${FORGE_URL}/api/v1/project/${FORGE_PROJECT_ID}/settings`

const logEmmiter = new EventEmitter();
var logBuffer = []
const logBufferMaxSize = 1000

function logger(settings){
  //console.log("setup logging", settings)
  return function (msg) {
    logBuffer.push(msg);
    if (logBuffer.length > logBufferMaxSize) {
      logBuffer.shift()
    }
    logEmmiter.emit('log', msg);
  }
}

async function setup() {

  let settings = {};

  try {
    settings = await got(settingsURL,{
      headers:{
        authorization: `Bearer ${FORGE_PROJECT_TOKEN}`
      }
    }).json()
  } catch (exp) {
    console.log("Failed to get settings\n",exp);
    // process.exit(1);

  }

  console.log(settings);

  const app = express();
  const server = http.createServer(app);

  var defaultSettings = {
    // storageModule: require('@flowforge/nr-storage'),
    // httpStorage: {
    //   projectID: `${FORGE_PROJECT_ID}`,
    //   baseURL: process.env['FORGE_STORAGE_URL'],
    //   token: process.env['FORGE_STORAGE_TOKEN'],
    // },
    httpAdminRoot: '/',
    httpNodeRoot: '/',
    userDir: 'userDir',
    flowFilePretty: true,
    // adminAuth: require("@flowforge/nr-auth")({
    //   baseURL: process.env["BASE_URL"],//'http://localhost:1880',
    //   forgeURL: process.env["FORGE_URL"],//'http://localhost:3000',
    //   clientID: process.env["FORGE_CLIENT_ID"],//'ffp_c3Q_9joF21JiAEUopN9RKc4sJbGZbkmFOM13mT3nlEg',
    //   clientSecret: process.env["FORGE_CLIENT_SECRET"]//'XjS2D7fYYhFW2yUj5mdDm0Oys8zVRVd0EKIla2iEpgP-vXSBkSy6-qEujLqIf7Og'
    // }),
    functionGlobalContext: {},
    logging: {
      // console:{
      //   level: "info",
      //   metrics: false,
      //   audit: false
      // },
      defaultLogger: {
        level: "info",
        metrics: false,
        audit: false,
        handler: logger
      },
      auditLogger: {
        level: "off",
        audit: true,
        handler: require('@flowforge/nr-logger'),
        loggingURL: process.env['FORGE_AUDIT_URL'],
        projectID: process.env['FORGE_PROJECT_ID'],
        token: process.env['FORGE_PROJECT_TOKEN'],
      }
    },
    editorTheme: {
      palette: {
        catalogues: [
        "http://catalogue.nodered.org/catalogue.json", //default catalogue
        // "http://manager.example.com/catalogue.json"
        ]
      }
    }
  };

  Object.assign(defaultSettings, settings)

  RED.init(server,defaultSettings);
  app.use(defaultSettings.httpAdminRoot,RED.httpAdmin);
  app.use(defaultSettings.httpNodeRoot,RED.httpNode);

  app.get('/flowforge/logs', (request, response) => {
    response.send(logBuffer);
  })

  app.get('/flowforge/health-check', (request, response) => {
    response.sendStatus(200);
  })


  server.listen(8000);

  const wss = new ws.Server({ clientTracking: false, noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/flowforge/logs'){
      // if (req.headers["authorization"]) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        })
      // } else {
      //should check for a auth header here or deny with
      // socket.write('HTTP/1.1 401 Web Socket Protocol Handshake\r\n' +
      //           'Upgrade: WebSocket\r\n' +
      //           'Connection: Upgrade\r\n' +
      //           '\r\n');
      //           socket.close();
      //           socket.destroy();
      //           return;
      // }
    }
  });

  wss.on('connection', (ws, req) => {
    logBuffer.forEach(log => {
      if (log) {
        ws.send(JSON.stringify(log))
      }
    })

    function wsLogSend(msg) {
      ws.send(JSON.stringify(msg))
    }

    logEmmiter.on('log', wsLogSend)

    ws.on('close',()=> {
      logEmmiter.removeListener('log',wsLogSend);
    })

  })

  RED.start();
}


setup();