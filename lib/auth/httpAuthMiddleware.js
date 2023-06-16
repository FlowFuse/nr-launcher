const { Passport } = require('passport')
const { Strategy } = require('./strategy')

let options
let passport

module.exports = {
    init (_options) {
        options = _options
        return (req, res, next) => {
            try {
                if (req.session.ffSession) {
                    next()
                } else {
                    req.session.redirectTo = req.originalUrl
                    passport.authenticate('FlowForge', { session: false })(req, res, next)
                }
            } catch (err) {
                console.log(err.stack)
                throw err
            }
        }
    },

    setupAuthRoutes (app) {
        if (!options) {
            // If `init` has not been called, then the flowforge-user auth type
            // has not been selected. No need to setup any further routes.
            return
        }
        // 'app' is RED.httpNode - the express app that handles all http routes
        // exposed by the flows.

        passport = new Passport()
        app.use(passport.initialize())

        const callbackURL = `${options.baseURL}/_ffAuth/callback`
        const authorizationURL = `${options.forgeURL}/account/authorize`
        const tokenURL = `${options.forgeURL}/account/token`
        const userInfoURL = `${options.forgeURL}/api/v1/user`
        const version = require('../../package.json').version

        passport.use('FlowForge', new Strategy({
            authorizationURL,
            tokenURL,
            callbackURL,
            userInfoURL,
            scope: `httpAuth-${version}`,
            clientID: options.clientID,
            clientSecret: options.clientSecret,
            pkce: true,
            state: true
        }, function (accessToken, refreshToken, params, profile, done) {
            done(null, profile)
        }))

        app.get('/_ffAuth/callback', passport.authenticate('FlowForge', {
            session: false
        }), (req, res) => {
            req.session.user = req.user
            req.session.ffSession = true
            if (req.session?.redirectTo) {
                const redirectTo = req.session.redirectTo
                delete req.session.redirectTo
                res.redirect(redirectTo)
            } else {
                res.redirect('/')
            }
        })
    }
}
