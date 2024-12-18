const fs = require('fs')
const path = require('path')
const got = require('got')
const childProcess = require('child_process')
const LogBuffer = require('./logBuffer')
const { getSettingsFile } = require('./runtimeSettings')
const SampleBuffer = require('./resources/sampleBuffer')
const resourceSample = require('./resources/sample')
const hasProperty = (object, property) => !!(object && Object.prototype.hasOwnProperty.call(object, property))

/** The point at which we check to see if we are in a boot loop */
const MAX_RESTART_COUNT = 5

/** The minimum run time we we expect when determining if we are in a boot loop
 * - Run duration is measured from the time node-red is spawned to the time it crashes
*/
const MIN_RUNTIME = 30000

/** If the distribution of run durations are less than this, we are likely in a boot loop
 * - Run duration is measured from the time node-red is spawned to the time it crashes.
*/
const MIN_RUNTIME_DEVIATION = 2000 // 2 seconds either side of the mean

/** How long wait for Node-RED to cleanly stop before killing */
const NODE_RED_STOP_TIMEOUT = 10000

/** Default interval between status polls of Node-RED used to detect a hung runtime */
const HEALTH_POLL_INTERVAL_DEFAULT = 7499 // A prime number (to minimise syncing with other processes)

/** The number of consecutive timeouts during startup phase before considering a NR hang */
const HEALTH_POLL_MAX_STARTUP_ERROR_COUNT = 10

/** The number of consecutive timeouts before considering a NR hang */
const HEALTH_POLL_MAX_ERROR_COUNT = 3

/** The number of seconds between resource polling */
const RESOURCE_POLL_INTERVAL = 10
const RESOURCE_ALERT_SAMPLES = 30
const RESOURCE_ALERT_THRESHOLD = 0.75
const CPU_LIMIT = process.env.FORGE_CPU_LIMIT
const MEMORY_LIMIT = process.env.FORGE_MEMORY_LIMIT

const States = {
    STOPPED: 'stopped',
    LOADING: 'loading',
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

        // Array of times and run durations for monitoring boot loops
        this.startTimes = []
        this.runDurations = []

        this.logBuffer = new LogBuffer(this.options.logBufferMax || 1000)
        this.logBuffer.add({ level: 'system', msg: `Launcher version: ${this.options?.versions?.launcher || 'unknown'}` })

        // A callback function that will be set if the launcher is waiting
        // for Node-RED to exit
        this.exitCallback = null

        this.healthPoll = null
        this.resourcePoll = null

        // defaults to the last 3.5 hours of samples at 5 second intervals
        this.sampleBuffer = new SampleBuffer(this.options.sampleBufferMax || 2520)
        this.cpuAuditLogged = 0
        this.memoryAuditLogged = 0

        this.disableAutoSafeMode = false
    }

    /** @type {Number} */
    get healthCheckInterval () {
        const parsed = parseInt(this.settings?.healthCheckInterval)
        const value = isNaN(parsed) ? 0 : parsed
        return value > 1000 ? value : HEALTH_POLL_INTERVAL_DEFAULT
    }

    async loadSettings () {
        this.state = States.LOADING
        this.logBuffer.add({ level: 'system', msg: 'Loading project settings' })
        const settingsURL = `${this.options.forgeURL}/api/v1/projects/${this.options.project}/settings`
        let newSettings
        try {
            newSettings = await got.get(settingsURL, {
                headers: {
                    authorization: `Bearer ${this.options.token}`
                }
            }).json()
        } catch (err) {
            this.settings = null
            this.state = States.STOPPED
            // if launcher failed to restart it will have old token
            if (err?.response?.statusCode === 401) {
                // throwing error will cause call to `start` to fail and an audit event will be logged
                throw new Error('Unauthorized')
            }
            // what to do when forge is down?
            console.log(`Unable to get settings from ${settingsURL} with error ${err.toString()}`)
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

        this.settings.storageDir = path.normalize(path.join(this.settings.rootDir, this.settings.userDir, 'storage'))

        // setup nodeDir to include the path to additional nodes and plugins
        const nodesDir = []
        if (Array.isArray(this.settings.nodesDir) && this.settings.nodesDir.length) {
            nodesDir.push(...this.settings.nodesDir)
        } else if (this.settings.nodesDir && typeof this.settings.nodesDir === 'string') {
            nodesDir.push(this.settings.nodesDir)
        }
        nodesDir.push(path.join(require.main.path, 'node_modules', '@flowfuse', 'nr-project-nodes').replace(/\\/g, '/'))
        nodesDir.push(path.join(require.main.path, '..', '..', '@flowfuse', 'nr-project-nodes').replace(/\\/g, '/'))
        nodesDir.push(path.join(require.main.path, 'node_modules', '@flowfuse', 'nr-file-nodes').replace(/\\/g, '/'))
        nodesDir.push(path.join(require.main.path, '..', '..', '@flowfuse', 'nr-file-nodes').replace(/\\/g, '/'))
        nodesDir.push(path.join(require.main.path, 'node_modules', '@flowfuse', 'nr-assistant').replace(/\\/g, '/'))
        nodesDir.push(path.join(require.main.path, '..', '..', '@flowfuse', 'nr-assistant').replace(/\\/g, '/'))
        nodesDir.push(require.main.path)

        this.settings.nodesDir = nodesDir
        if (hasProperty(this.settings, 'disableAutoSafeMode') && typeof this.settings.disableAutoSafeMode === 'boolean') {
            this.disableAutoSafeMode = this.settings.disableAutoSafeMode
        }
        if (this.disableAutoSafeMode === true) {
            this.logBuffer.add({ level: 'system', msg: 'Auto Safe Mode is disabled.' })
        }
        const settingsFileContent = getSettingsFile(this.settings)
        const settingsPath = path.join(this.settings.rootDir, this.settings.userDir, 'settings.js')
        this.targetState = this.settings.state || States.RUNNING
        try {
            fs.writeFileSync(settingsPath, settingsFileContent)
        } catch (error) {
            this.state = States.STOPPED
            this.logBuffer.add({ level: 'system', msg: 'Unable to write package file' })
            throw error
        }
        const npmrcPath = path.join(this.settings.rootDir, this.settings.userDir, '.npmrc')
        if (this.settings.settings.palette.npmrc) {
            try {
                fs.writeFileSync(npmrcPath, this.settings.settings.palette.npmrc)
            } catch (error) {
                this.state = States.STOPPED
                this.logBuffer.add({ level: 'system', msg: 'Unable to write .npmrc file' })
                throw error
            }
        } else {
            if (fs.existsSync(npmrcPath)) {
                try {
                    fs.unlinkSync(npmrcPath)
                } catch (error) {
                    this.state = States.STOPPED
                    this.logBuffer.add({ level: 'system', msg: 'Unable to remove old .npmrc file' })
                    throw error
                }
            }
        }

        try {
            await this.updatePackage()
        } catch (error) {
            this.state = States.STOPPED
            this.logBuffer.add({ level: 'system', msg: 'Unable to install or update packages' })
            throw error
        }
        this.logBuffer.add({ level: 'system', msg: `Target state is '${this.targetState}'` })
    }

    async updatePackage () {
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
            this.state = States.INSTALLING
            this.logBuffer.add({ level: 'system', msg: 'Updating project dependencies' })
            pkg.dependencies = wantedDependencies
            fs.writeFileSync(pkgFilePath, JSON.stringify(pkg, null, 2))
            const npmEnv = Object.assign({}, process.env, this.settings.env)
            const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
            return new Promise((resolve, reject) => {
                const child = childProcess.spawn(
                    npmCommand,
                    ['install', '--omit=dev', '--no-audit', '--no-update-notifier', '--no-fund'],
                    { windowsHide: true, cwd: path.join(this.settings.rootDir, this.settings.userDir), env: npmEnv, shell: true })
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
                        reject(new Error(`Failed to install project dependencies ret code: ${code} signal ${child.signalCode}`))
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

    async logAuditEvent (event, body) {
        const data = {
            timestamp: Date.now(),
            event
        }
        if (body && typeof body === 'object') {
            if (body.error) {
                data.error = {
                    code: body.error.code || 'unexpected_error',
                    error: body.error.error || body.error.message || 'Unexpected error'
                }
            } else {
                Object.assign(data, body)
            }
        }
        return got.post(this.options.forgeURL + '/logging/' + this.options.project + '/audit', {
            json: data,
            headers: {
                authorization: 'Bearer ' + this.options.token
            }
        }).catch(_err => {
            console.error('Failed to log audit event', _err, event)
        })
    }

    getState () {
        return this.state
    }

    getLastStartTime () {
        return this.startTimes.length !== 0 ? this.startTimes[this.startTimes.length - 1] : -1
    }

    getLog () {
        return this.logBuffer
    }

    getResources () {
        return this.sampleBuffer
    }

    isHealthy () {
        return this.proc && this.proc.exitCode === null
    }

    async start (targetState) {
        if (this.deferredStop) {
            await this.deferredStop
        }
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
        const filterEnv = (env) =>
            Object.entries(env).reduce((acc, [key, value]) =>
                key.startsWith('FORGE') ? acc : { ...acc, [key]: value }, {})

        // According to https://github.com/flowforge/flowforge-nr-launcher/pull/145,
        // setting FORGE_EXPOSE_HOST_ENV on the container unlocks the host env propagation.
        const appEnv = Object.assign({},
            process.env.FORGE_EXPOSE_HOST_ENV ? filterEnv(process.env) : {},
            this.env,
            this.settings.env)
        appEnv.TZ = this.settings.settings.timeZone

        if (this.targetState === States.SAFE) {
            appEnv.NODE_RED_ENABLE_SAFE_MODE = true
        }

        if (process.env.NODE_EXTRA_CA_CERTS) {
            appEnv.NODE_EXTRA_CA_CERTS = process.env.NODE_EXTRA_CA_CERTS
        }

        if (process.env.HOME) {
            appEnv.HOME = process.env.HOME
        }

        if (appEnv.NODE_RED_ENABLE_PROJECTS) {
            delete appEnv.NODE_RED_ENABLE_PROJECTS
        }

        const nodePaths = [
            path.join(require.main.path, 'node_modules'),
            path.join(require.main.path, '..', '..')
        ]

        // Check to see if we're in the dev-env - in which case, we need to add the right
        // path to NODE_PATH so that the settings file can load `@flowfuse/nr-launcher/*`
        // We have to point at the driver-localfs node_modules as that will have the right paths
        // in place to load this module.
        const devEnvPath = path.join(require.main.path, '..', 'driver-localfs', 'node_modules')
        if (fs.existsSync(devEnvPath)) {
            nodePaths.push(devEnvPath)
        }

        appEnv.NODE_PATH = nodePaths.join(path.delimiter)
        appEnv.LAUNCHER_VERSION = this.settings.launcherVersion

        const processOptions = {
            windowsHide: true,
            env: appEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: this.settings.storageDir
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
            this.startTimes.push(Date.now())
            if (this.startTimes.length > MAX_RESTART_COUNT) {
                this.startTimes.shift()
            }
        })

        /**
         * Performs an HTTP HEAD to the baseURL of Node-RED to check its liveness.
         */
        const statusPoll = async () => {
            if (this.targetState === States.STOPPED) {
                return States.STOPPED
            }
            const parsedUrl = new URL(this.settings.baseURL)
            parsedUrl.protocol = 'http:'
            parsedUrl.host = '127.0.0.1'
            parsedUrl.port = this.settings.port
            const pollUrl = parsedUrl.toString()

            let statusCode = 0
            try {
                const opts = {
                    headers: {
                        pragma: 'no-cache',
                        'Cache-Control': 'max-age=0, must-revalidate, no-cache'
                    },
                    timeout: { request: this.healthCheckInterval - 500 },
                    retry: { limit: 0 }
                }
                if (this.settings.settings.disableEditor) {
                    opts.throwHttpErrors = false
                }
                // Use a HEAD request to minimise data transfer
                const res = await got.head(pollUrl, opts)
                statusCode = res.statusCode || 500
            } catch (error) {
                if (this.state === States.STARTING) {
                    this.logBuffer.add({ level: 'system', msg: 'Node-RED health check: waiting for Node-RED to start' })
                } else {
                    this.logBuffer.add({ level: 'system', msg: `Node-RED health check failed: ${error.toString()} (${pollUrl})` })
                }
                console.log('Failed to poll NR on ', pollUrl, error)
                statusCode = error.response?.statusCode || 500
            }
            if (statusCode >= 200 && statusCode < 500) {
                return States.RUNNING
            }
            throw new Error()
        }

        /**
         * Called after Node-RED exits unexpectedly. It calculates the runtime
         * duration and decides if we've detected a crash loop.
         * If a loop is detected, restarts in safe mode.
         * If a loop is detected and we're already in safe mode, stops Node-RED
         * Otherwise, restarts normally
         */
        const restartAfterUnexpectedExit = async () => {
            const lastStartTime = this.startTimes[this.startTimes.length - 1]
            const duration = Math.abs(Date.now() - lastStartTime)
            this.runDurations.push(duration)
            if (this.runDurations.length > MAX_RESTART_COUNT) {
                this.runDurations.shift()
            }

            this.logBuffer.add({ level: 'system', msg: `Node-RED unexpectedly stopped after: ${Math.round(duration / 1000)}s` })

            // if auto-safe-mode is not disabled && start count == MAX_RESTART_COUNT, then check for boot loop
            if (this.disableAutoSafeMode !== true && this.startTimes.length === MAX_RESTART_COUNT) {
                // calculate the average runtime
                const avg = this.runDurations.reduce((a, b) => a + b, 0) / this.runDurations.length

                // calculate the mean deviation of runtime durations
                const meanDeviation = this.runDurations.reduce((a, b) => a + Math.abs(b - avg), 0) / this.runDurations.length

                // if the deviation is small (i.e. crashing at a consistent rate)
                // or the average runtime is low, then it is likely we in a boot loop
                if (meanDeviation < MIN_RUNTIME_DEVIATION || avg < MIN_RUNTIME) {
                    // go to safe mode (or stop if already in safe mode)
                    this.startTimes = []
                    this.runDurations = []
                    if (this.targetState === States.SAFE) {
                        this.logBuffer.add({ level: 'system', msg: 'Node-RED restart loop detected whilst in safe mode. Stopping.' })
                        this.targetState = States.STOPPED
                    } else {
                        this.logBuffer.add({ level: 'system', msg: 'Node-RED restart loop detected. Restarting in safe mode.' })
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

        if (this.healthPoll) {
            clearInterval(this.healthPoll)
        }
        let errorCount = 0
        this.logBuffer.add({ level: 'system', msg: `Starting health check monitor  (${(this.healthCheckInterval / 1000).toFixed(1)}s)` })
        this.healthPoll = setInterval(() => {
            if (this.state === States.STARTING || this.state === States.RUNNING) {
                statusPoll().then(() => {
                    // A healthy result
                    errorCount = 0
                    if (this.state === States.STARTING) {
                        this.state = States.RUNNING
                    }
                }).catch(async _ => {
                    // Error polling Node-RED settings page
                    errorCount++
                    if ((this.state === States.STARTING && errorCount === HEALTH_POLL_MAX_STARTUP_ERROR_COUNT) ||
                        (this.state === States.RUNNING && errorCount === HEALTH_POLL_MAX_ERROR_COUNT)) {
                        this.logBuffer.add({ level: 'system', msg: 'Node-RED hang detected.' })
                        const targetState = this.state

                        // Calling stop will clear the health poll interval
                        await this.stop()
                        this.targetState = targetState
                        // Restart via restartAfterUnexpectedExit as it will check
                        // for a restart loop
                        restartAfterUnexpectedExit()
                    }
                })
            }
        }, this.healthCheckInterval)

        if (this.resourcePoll) {
            clearInterval(this.resourcePoll)
        }

        this.resourcePoll = setInterval(async () => {
            const parsedUrl = new URL(this.settings.baseURL)
            parsedUrl.protocol = 'http:'
            parsedUrl.host = '127.0.0.1'
            parsedUrl.port = this.settings.port
            parsedUrl.pathname = '/ff/metrics'
            const pollUrl = parsedUrl.toString()

            const sample = await resourceSample(pollUrl, RESOURCE_POLL_INTERVAL)
            this.sampleBuffer.add(sample)

            // avg over the last minute for alerts
            if (CPU_LIMIT || MEMORY_LIMIT) {
                const avg = this.sampleBuffer.avgLastX(RESOURCE_ALERT_SAMPLES)
                if (avg.count === RESOURCE_ALERT_SAMPLES) {
                    if (CPU_LIMIT) {
                        if (avg.cpu > (CPU_LIMIT * 0.75)) {
                            if (this.cpuAuditLogged === 0) {
                                await this.logAuditEvent('resource.cpu', {
                                    interval: (RESOURCE_POLL_INTERVAL * RESOURCE_ALERT_SAMPLES),
                                    threshold: (RESOURCE_ALERT_THRESHOLD * 100)
                                })
                                this.cpuAuditLogged = RESOURCE_ALERT_SAMPLES
                            }
                        } else {
                            if (this.cpuAuditLogged > 0) {
                                this.cpuAuditLogged -= 1
                            }
                        }
                    }
                    if (MEMORY_LIMIT) {
                        if (avg.ps > (MEMORY_LIMIT * 0.75)) {
                            if (this.memoryAuditLogged === 0) {
                                await this.logAuditEvent('resource.memory', {
                                    interval: (RESOURCE_POLL_INTERVAL * RESOURCE_ALERT_SAMPLES),
                                    threshold: (RESOURCE_ALERT_THRESHOLD * 100)
                                })
                                this.memoryAuditLogged = RESOURCE_ALERT_SAMPLES
                            }
                        } else {
                            if (this.memoryAuditLogged > 0) {
                                this.memoryAuditLogged -= 1
                            }
                        }
                    }
                }
            }
        }, RESOURCE_POLL_INTERVAL * 1000)

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
                // get last 20 lines of log
                // NOTE: the log is added to the body in a specific property that should not actually
                // be logged but rather extrated and examined to provide better reporting
                // NOTE: 20 is typically enough to see the likes of Out Of Memory errors entries
                const __launcherLog = this.getLog()?.toArray()?.slice(-20) || []
                const body = { __launcherLog, info: { code, signal, info: 'Node-RED exited with non zero exit code' } }
                await this.logAuditEvent('crashed', body)

                // Only restart if our target state is not stopped
                if (this.targetState !== States.STOPPED) {
                    restartAfterUnexpectedExit()
                }
            }
            if (this.exitCallback) {
                this.exitCallback()
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
        let stderrBuffer = ''
        this.proc.stderr.on('data', (data) => {
            // Do not assume `data` is a complete log record.
            // Parse until newline
            stderrBuffer = stderrBuffer + data
            let linebreak = stderrBuffer.indexOf('\n')
            while (linebreak > -1) {
                const line = stderrBuffer.substring(0, linebreak)
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
                stderrBuffer = stderrBuffer.substring(linebreak + 1)
                linebreak = stderrBuffer.indexOf('\n')
            }
        })
    }

    async stop () {
        this.logBuffer.add({ level: 'system', msg: 'Stopping Node-RED' })
        // Stop the health poll - do not want to mistake a stopping/stopped Node-RED
        // for an unhealthly one
        clearInterval(this.healthPoll)
        clearInterval(this.resourcePoll)
        this.targetState = States.STOPPED
        if (this.deferredStop) {
            // A stop request is already inflight - return the existing deferred object
            return this.deferredStop
        }
        if (this.proc) {
            // Setup a promise that will resolve once the process has really exited
            this.deferredStop = new Promise((resolve, reject) => {
                // Setup a timeout so we can more forcefully kill Node-RED
                // if it has hung
                this.exitTimeout = setTimeout(() => {
                    this.logBuffer.add({ level: 'system', msg: 'Node-RED stop timed-out. Sending SIGKILL' })
                    if (this.proc) {
                        this.proc.kill('SIGKILL')
                    }
                }, NODE_RED_STOP_TIMEOUT)
                // Setup a callback for when the process has actually exited
                this.exitCallback = () => {
                    clearTimeout(this.exitTimeout)
                    this.exitCallback = null
                    this.deferredStop = null
                    this.exitTimeout = null
                    this.proc.unref()
                    this.proc = undefined
                    resolve()
                }
                // Send a kill signal. On Linux this will be a SIGTERM and
                // allow Node-RED to shutdown cleanly. Windows looks like it does
                // it more forcefully by default.
                this.proc.kill()
                this.state = States.STOPPED
            })
            return this.deferredStop
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

module.exports = { Launcher, States }
