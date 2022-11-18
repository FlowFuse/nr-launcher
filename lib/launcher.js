const fs = require('fs')
const path = require('path')
const got = require('got')
const childProcess = require('child_process')
const LogBuffer = require('./logBuffer')
const { getSettingsFile } = require('./runtimeSettings')

const MIN_RESTART_TIME = 10000 // 10 seconds
const MAX_RESTART_COUNT = 5

const States = {
    STOPPED: 'stopped',
    INSTALLING: 'installing',
    STARTING: 'starting',
    RUNNING: 'running',
    SAFE: 'safe',
    CRASHED: 'crashed',
    STOPPING: 'stopping'
}
/**
 * options:
 *  - logBufferMax
 *  - forgeURL
 *  - project
 *  - token
 *  - execPath
 */
class Launcher {
    constructor (options) {
        this.options = options
        this.state = States.STOPPED
        // Assume we want to start NR unless told otherwise via loadSettings
        this.targetState = States.RUNNING
        this.env = {
            PATH: process.env.PATH
        }
        this.settings = null
        this.startTime = []
        this.restartCount = 0
        this.logBuffer = new LogBuffer(this.options.logBufferMax || 1000)
        this.logBuffer.add({ level: 'system', msg: 'Launcher Started' })
    }

    async loadSettings () {
        this.state = States.INSTALLING
        this.logBuffer.add({ level: 'system', msg: 'Loading project settings' })
        const settingsURL = `${this.options.forgeURL}/api/v1/projects/${this.options.project}/settings`
        let newSettings
        try {
            newSettings = await got(settingsURL, {
                headers: {
                    authorization: `Bearer ${this.options.token}`
                }
            }).json()
        } catch (err) {
            // what to do when forge is down?
            console.log(`Unable to get settings from ${settingsURL} with error ${err.toString()}`)
            this.settings = null
            return
        }

        this.settings = newSettings
        this.settings.projectToken = this.options.token
        this.settings.clientID = process.env.FORGE_CLIENT_ID
        this.settings.teamID = process.env.FORGE_TEAM_ID
        this.settings.clientSecret = process.env.FORGE_CLIENT_SECRET
        this.settings.credentialSecret = process.env.FORGE_NR_SECRET
        this.settings.allowInboundTcp = this.options?.allowInboundTcp
        this.settings.allowInboundUdp = this.options?.allowInboundUdp
        this.settings.licenseType = process.env.FORGE_LICENSE_TYPE
        this.settings.broker = this.options.broker
        this.settings.launcherVersion = this.options?.versions?.launcher || ''

        // setup nodeDir to include the path to additional nodes and plugins
        const nodesDir = []
        if (Array.isArray(this.settings.nodesDir) && this.settings.nodesDir.length) {
            nodesDir.push(...this.settings.nodesDir)
        } else if (this.settings.nodesDir && typeof this.settings.nodesDir === 'string') {
            nodesDir.push(this.settings.nodesDir)
        }
        nodesDir.push(path.join(require.main.path, 'node_modules', '@flowforge', 'nr-theme').replace(/\\/g, '/')) // MVP: fixed to loading FF theme
        nodesDir.push(path.join(require.main.path, '..', 'nr-theme').replace(/\\/g, '/')) // MVP: fixed to loading FF theme
        nodesDir.push(path.join(require.main.path, 'node_modules', '@flowforge', 'nr-project-nodes').replace(/\\/g, '/'))
        nodesDir.push(path.join(require.main.path, '..', 'nr-project-nodes').replace(/\\/g, '/'))
        nodesDir.push(path.join(require.main.path, 'node_modules', '@flowforge', 'nr-file-nodes').replace(/\\/g, '/'))
        nodesDir.push(path.join(require.main.path, '..', 'nr-file-nodes').replace(/\\/g, '/'))

        this.settings.nodesDir = nodesDir

        const settingsFileContent = getSettingsFile(this.settings)
        const settingsPath = path.join(this.settings.rootDir, this.settings.userDir, 'settings.js')
        fs.writeFileSync(settingsPath, settingsFileContent)

        await this.updatePackage()
        this.targetState = this.settings.state || States.RUNNING
        this.logBuffer.add({ level: 'system', msg: `Target state is '${this.targetState}'` })
    }

    async updatePackage () {
        this.state = States.INSTALLING
        const pkgFilePath = path.join(this.settings.rootDir, this.settings.userDir, 'package.json')
        const packageContent = fs.readFileSync(pkgFilePath, { encoding: 'utf8' })
        const pkg = JSON.parse(packageContent)
        const existingDependencies = pkg.dependencies || {}
        const wantedDependencies = this.settings.settings.palette?.modules || {}

        const existingModules = Object.keys(existingDependencies)
        const wantedModules = Object.keys(wantedDependencies)

        let changed = false
        if (existingModules.length !== wantedModules.length) {
            changed = true
        } else {
            existingModules.sort()
            wantedModules.sort()
            for (let i = 0; i < existingModules.length; i++) {
                if (existingModules[i] !== wantedModules[i]) {
                    changed = true
                    break
                }
                if (existingDependencies[existingModules[i]] !== wantedDependencies[wantedModules[i]]) {
                    changed = true
                    break
                }
            }
        }

        if (changed) {
            this.logBuffer.add({ level: 'system', msg: 'Updating project dependencies' })
            pkg.dependencies = wantedDependencies
            fs.writeFileSync(pkgFilePath, JSON.stringify(pkg, null, 2))
            const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
            return new Promise((resolve, reject) => {
                const child = childProcess.spawn(
                    npmCommand,
                    ['install', '--production', '--no-audit', '--no-update-notifier', '--no-fund'],
                    { windowsHide: true, cwd: path.join(this.settings.rootDir, this.settings.userDir) })
                child.stdout.on('data', (data) => {
                    this.logBuffer.add({ level: 'system', msg: '[npm] ' + data })
                })
                child.stderr.on('data', (data) => {
                    this.logBuffer.add({ level: 'system', msg: '[npm] ' + data })
                })
                child.on('error', (err) => {
                    this.logBuffer.add({ level: 'system', msg: '[npm] ' + err.toString() })
                })
                child.on('close', (code) => {
                    if (code === 0) {
                        resolve()
                    } else {
                        reject(new Error('Failed to install project dependencies'))
                    }
                })
            }).catch(err => {
                // Revert the package file to the previous content. That ensures
                // it will try to install again the next time it attempts to run
                fs.writeFileSync(pkgFilePath, packageContent)
                throw err
            })
        }
    }

    async logAuditEvent (event) {
        return got.post(this.options.forgeURL + '/logging/' + this.options.project + '/audit', {
            json: {
                timestamp: Date.now(),
                event
            },
            headers: {
                authorization: 'Bearer ' + this.options.token
            }
        }).catch(_err => {})
    }

    getState () {
        return this.state
    }

    getLastStartTime () {
        return this.startTime.length !== 0 ? this.startTime[this.startTime.length - 1] : -1
    }

    getLog () {
        return this.logBuffer
    }

    isHealthy () {
        return this.proc && this.proc.exitCode === null
    }

    async start (targetState) {
        if (targetState) {
            this.targetState = targetState
        }
        if (!this.settings) {
            throw new Error('Failed to load settings')
        }
        if (this.state === States.RUNNING || this.state === States.STARTING) {
            // Already running or starting - no need to start again
            return
        }
        if (this.targetState === States.STOPPED) {
            // Target state is stopped - don't start
            return
        }
        this.logBuffer.add({ level: 'system', msg: 'Starting Node-RED' })
        const appEnv = Object.assign({}, this.env, this.settings.env)

        if (this.targetState === States.SAFE) {
            appEnv.NODE_RED_ENABLE_SAFE_MODE = true
        }

        appEnv.NODE_PATH = [
            path.join(require.main.path, 'node_modules'),
            path.join(require.main.path, '..', '..')
        ].join(path.delimiter)

        appEnv.LAUNCHER_VERSION = this.settings.launcherVersion

        const processOptions = {
            windowsHide: true,
            env: appEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: path.join(this.settings.rootDir, this.settings.userDir)
        }

        const processArguments = [
            '-u',
            path.join(this.settings.rootDir, this.settings.userDir),
            '-p',
            this.settings.port
        ]

        if (this.settings.stack?.memory && /^[1-9]\d*$/.test(this.settings.stack.memory)) {
            const memLimit = Math.round(this.settings.stack.memory * 0.75)
            processArguments.push(`--max-old-space-size=${memLimit}`)
        }
        this.options.execPathJs = path.join(this.options.nodeRedPath, 'node_modules', 'node-red', 'red.js')
        processArguments.unshift(this.options.execPathJs)
        this.options.execPath = process.execPath
        this.proc = childProcess.spawn(
            this.options.execPath,
            processArguments,
            processOptions
        )

        this.state = States.STARTING

        this.proc.on('spawn', () => {
            // only works at NodeJS 16+
            // this.proc.pid
            this.startTime.push(Date.now())
            if (this.startTime.length > MAX_RESTART_COUNT) {
                this.startTime.shift()
            }
        })

        const statusPoll = async () => {
            if (this.targetState === States.STOPPED) {
                return Promise.resolve(States.STOPPED)
            }
            if (this.state !== States.STARTING) {
                return Promise.resolve(this.state)
            }
            let statusCode = 0
            try {
                const opts = {
                    headers: {
                        pragma: 'no-cache',
                        'Cache-Control': 'max-age=0, must-revalidate, no-cache'
                    },
                    timeout: { request: 500 },
                    retry: { limit: 0 }
                }
                const res = await got.get(this.settings.baseURL, opts)
                statusCode = res.statusCode || 500
            } catch (error) {
                statusCode = error.response?.statusCode || 500
            }
            if (statusCode >= 200 && statusCode < 500) {
                return Promise.resolve(States.RUNNING)
            }
            return Promise.reject(new Error())
        }

        setTimeout((_launcher) => {
            // Make 15 attempts to get good response from node-red
            //   over 3min, starting with 5s delays, ramping up to
            //   16s starting from the 3rd retry apply a factor of
            //   1.28 for each back off
            // 1st TRY     :  delay 5s
            // RETRY       :  1   2   3   4   5   6   ...  13    14
            // DELAY (sec) :  5   5   6   8   10  13  ...  16    16
            // TOTAL DELAY :  10  15  21  29  39  52  ...  164   180
            promiseWithRetry(statusPoll, 14, 5000, 16000, 3, 1.28, 0.02)
                .then(status => {
                    _launcher.state = status
                }).catch(() => {
                    if (_launcher.isHealthy()) {
                        _launcher.state = States.RUNNING
                    }
                })
        }, 100, this)

        this.proc.on('close', (code, signal) => {
            // console.log("node-red closed with", {code,signal})
        })

        this.proc.on('exit', async (code, signal) => {
            this.logBuffer.add({ level: 'system', msg: `Node-RED exited rc=${code} signal=${signal}` })
            // When childProcess.kill() is executed on windows, the exit code is null and the signal is 'SIGTERM'.
            // So long as the process was instructed to STOP and its state is STOPPED, consider this a clean exit
            if (process.platform === 'win32' && code === null && signal === 'SIGTERM' && this.targetState === States.STOPPED && this.state === States.STOPPED) {
                code = 0
            }
            if (code === 0) {
                this.state = States.STOPPED
                await this.logAuditEvent('stopped')
            } else {
                this.state = States.CRASHED
                await this.logAuditEvent('crashed')

                if (this.startTime.length === MAX_RESTART_COUNT) {
                    // check restart interval
                    let avg = 0
                    for (let i = this.startTime.length - 1; i > 0; i--) {
                        avg += (this.startTime[i] - this.startTime[i - 1])
                    }
                    avg /= MAX_RESTART_COUNT
                    if (avg < MIN_RESTART_TIME) {
                        // restarting too fast - go to safe mode
                        // reset the startTime list
                        this.startTime = []
                        if (this.targetState === States.SAFE) {
                            this.logBuffer.add({ level: 'system', msg: 'Node-RED restart loop detected whilst in safe mode. Stopping.' })
                            this.targetState = States.STOPPED
                        } else {
                            this.logBuffer.add({ level: 'system', msg: 'Node-RED restart loop detected. Restarting in safe mode' })
                            this.targetState = States.SAFE
                            this.start()
                        }
                    } else {
                        this.start()
                    }
                } else {
                    this.start()
                }
            }
        })

        this.proc.on('error', (err) => {
            this.logBuffer.add({ level: 'system', msg: `Error with Node-RED process: ${err.toString()}` })
            console.log('Process error: ' + err.toString())
        })

        let stdoutBuffer = ''
        this.proc.stdout.on('data', (data) => {
            // Do not assume `data` is a complete log record.
            // Parse until newline
            stdoutBuffer = stdoutBuffer + data
            let linebreak = stdoutBuffer.indexOf('\n')
            while (linebreak > -1) {
                const line = stdoutBuffer.substring(0, linebreak)
                if (line.length > 0) {
                    if (line[0] === '{' && line[line.length - 1] === '}') {
                        // In case something console.log's directly, we can't assume the line is JSON
                        // from our logger
                        try {
                            this.logBuffer.add(JSON.parse(line))
                        } catch (err) {
                            this.logBuffer.add({ msg: line })
                        }
                    } else {
                        this.logBuffer.add({ msg: line })
                    }
                }
                stdoutBuffer = stdoutBuffer.substring(linebreak + 1)
                linebreak = stdoutBuffer.indexOf('\n')
            }
        })
    }

    async stop () {
        this.logBuffer.add({ level: 'system', msg: 'Stopping Node-RED' })
        this.targetState = States.STOPPED
        if (this.proc) {
            this.state = States.STOPPED
            this.proc.kill()
            // TODO: block until proc has actually stopped
            this.proc.unref()
            this.proc = undefined
        } else {
            this.state = States.STOPPED
        }
    }

    async revokeUserToken (token) { // logout:nodered(step-5)
        this.logBuffer.add({ level: 'system', msg: 'Node-RED logout requested' })
        if (this.state !== States.RUNNING) {
            // not running
            return
        }
        try {
            const adminAPI = `${this.settings.baseURL}/auth/revoke`
            const json = { token, noRedirect: true }
            const headers = {
                authorization: 'Bearer ' + token,
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                'node-red-api-version': 'v2',
                pragma: 'no-cache',
                Referer: this.settings.baseURL
            }
            await got.post(adminAPI, { json, headers })
        } catch (error) {
            this.logBuffer.add({ level: 'system', msg: `Error logging out Node-RED: ${error.toString()}` })
        }
    }
}

/**
 * Async wait
 * @param {number} milliseconds How long to wait before yielding
 */
function wait (milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/**
 * Returns a value with the percentage of jitter specified
 * @param {Number} [value = 1]  The value to jitter
 * @param {Number} [jitter = 0.01]  Percentage of jitter to apply (i.e. 0.01 = 1%,  1 = 100%)
 * @return {Number} The input value with jitter applied
 */
function jitter (value, jitter = 0.01) {
    const max = value * (1 + jitter)
    const min = value * (1 - jitter)
    return Math.floor(Math.random() * (max - min)) + min
}

/**
 * Execute a promise and retry with custom back-off and jitter
 * @param {Promise} promise promise to be executed
 * @param {number} [maxRetries] The maximum number of retries to be attempted  (defaults to 2)
 * @param {number} [delay] The initial ms delay (defaults to 1000ms)
 * @param {number} [maxDelay] The maximum ms delay after back-off (defaults to unlimited)
 * @param {number} [backOffAt] The retry number to start ramping the delay (defaults to 0)
 * @param {number} [factor] The delay increase factor. A value of 2 would effectively double the delay with each retry (defaults to 2)
 * @param {number} [jitterPercent] The percentage of jitter to apply (defaults to 0.02 [2%])
 * @returns {Promise} The result of the given promise passed in
 */
function promiseWithRetry (promise, maxRetries, delay, maxDelay, backOffAt, factor, jitterPercent) {
    // sanitise defaults
    maxRetries = maxRetries == null ? 2 : Math.max(maxRetries, 0)
    delay = delay == null ? 1000 : Math.max(delay, 1)
    maxDelay = maxDelay == null ? 0 : Math.max(maxDelay, 0)
    backOffAt = backOffAt == null ? 0 : Math.max(backOffAt, 0)
    factor = factor == null ? 2 : Math.max(factor, 0.1)
    jitterPercent = jitterPercent == null ? 0.02 : Math.max(jitterPercent, 0)
    let waitTime = delay // initial delay
    let backOffCount = 0
    async function _execPromise (retryNo) {
        try {
            if (retryNo && retryNo >= backOffAt) {
                waitTime = parseInt(factor ** ++backOffCount * delay)
                if (maxDelay && waitTime > maxDelay) {
                    waitTime = maxDelay
                }
            }
            const _waitTime = parseInt(jitter(waitTime, jitterPercent)) // add jitter
            await wait(_waitTime)
            return await promise()
        } catch (e) {
            if (retryNo < maxRetries) {
                return _execPromise(retryNo + 1)
            }
            throw e
        }
    }
    return _execPromise(0)
}

module.exports = { Launcher, States }
