const should = require('should') // eslint-disable-line
const express = require('express')
const got = require('got')
const sinon = require('sinon')

const httpAuth = require('../../../../lib/auth/httpAuthMiddleware')

async function getHandshakeSetCookie (baseURL) {
    const middleware = httpAuth.init({
        baseURL,
        forgeURL: 'https://forge.example.com',
        clientID: 'client-id',
        clientSecret: 'client-secret',
        teamID: 'team-1',
        projectId: 'project-1'
    })
    const app = express()
    app.set('trust proxy', true)
    httpAuth.setupAuthRoutes(app)
    app.use(middleware)
    app.get('/dashboard', (req, res) => res.send('ok'))

    const server = app.listen(0)
    await new Promise(resolve => server.once('listening', resolve))
    const port = server.address().port
    try {
        const res = await got(`http://127.0.0.1:${port}/dashboard`, {
            headers: { 'x-forwarded-proto': 'https' },
            followRedirect: false,
            throwHttpErrors: false
        })
        return (res.headers['set-cookie'] || []).join('\n')
    } finally {
        server.close()
    }
}

describe('httpAuthMiddleware handshake session cookie', function () {
    it('is SameSite=None; Secure; Partitioned when the instance is https', async function () {
        const cookie = await getHandshakeSetCookie('https://instance.flowfuse.cloud')
        cookie.should.match(/connect\.sid/)
        cookie.should.match(/SameSite=None/i)
        cookie.should.match(/Secure/)
        cookie.should.match(/Partitioned/i)
    })

    it('uses default (Lax) cookie when the instance is http', async function () {
        const cookie = await getHandshakeSetCookie('http://localhost:1880')
        cookie.should.match(/connect\.sid/)
        cookie.should.not.match(/SameSite=None/i)
        cookie.should.not.match(/Partitioned/i)
    })
})

describe('httpAuthMiddleware session secret', function () {
    it('is stable across restarts for the same instance', function () {
        httpAuth.deriveSessionSecret('cred-secret-1').should.equal(httpAuth.deriveSessionSecret('cred-secret-1'))
    })

    it('differs between instances', function () {
        httpAuth.deriveSessionSecret('cred-secret-1').should.not.equal(httpAuth.deriveSessionSecret('cred-secret-2'))
    })

    it('produces a 64-char hex digest, not the raw credentialSecret', function () {
        const secret = httpAuth.deriveSessionSecret('cred-secret-1')
        secret.should.match(/^[0-9a-f]{64}$/)
        secret.should.not.equal('cred-secret-1')
    })

    it('falls back to a random secret when credentialSecret is absent', function () {
        httpAuth.deriveSessionSecret('').should.not.equal(httpAuth.deriveSessionSecret(''))
    })
})

describe('httpAuthMiddleware bearer token cache', function () {
    let forge, forgePort, tokenChecks, clock

    beforeEach(async function () {
        // A stand-in for the platform's token check endpoint that counts how often it is asked
        tokenChecks = 0
        const forgeApp = express()
        forgeApp.get('/account/check/http/:projectId', (req, res) => {
            tokenChecks++
            res.send({})
        })
        forge = forgeApp.listen(0)
        await new Promise(resolve => forge.once('listening', resolve))
        forgePort = forge.address().port
        // Only fake Date, so the servers and sockets keep working
        clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] })
    })

    afterEach(function () {
        clock.restore()
        forge.close()
    })

    async function withProtectedApp (fn) {
        const middleware = httpAuth.init({
            baseURL: 'http://127.0.0.1',
            forgeURL: `http://127.0.0.1:${forgePort}`,
            clientID: 'client-id',
            clientSecret: 'client-secret',
            teamID: 'team-1',
            projectId: 'project-1'
        })
        const app = express()
        httpAuth.setupAuthRoutes(app)
        app.use(middleware)
        app.get('/endpoint', (req, res) => res.send('ok'))
        const server = app.listen(0)
        await new Promise(resolve => server.once('listening', resolve))
        const request = () => got(`http://127.0.0.1:${server.address().port}/endpoint`, {
            headers: { authorization: 'Bearer cache-test-token' },
            throwHttpErrors: false
        })
        try {
            await fn(request)
        } finally {
            server.close()
        }
    }

    it('rechecks an accepted token with the platform once it is a minute old', async function () {
        await withProtectedApp(async (request) => {
            (await request()).statusCode.should.equal(200)
            tokenChecks.should.equal(1)

            clock.tick(59 * 1000)
            ;(await request()).statusCode.should.equal(200)
            tokenChecks.should.equal(1)

            clock.tick(2 * 1000)
            ;(await request()).statusCode.should.equal(200)
            tokenChecks.should.equal(2)
        })
    })
})
