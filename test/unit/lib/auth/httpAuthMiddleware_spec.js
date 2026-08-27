const should = require('should') // eslint-disable-line
const express = require('express')
const got = require('got')

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
