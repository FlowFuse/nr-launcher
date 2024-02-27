const crypto = require('crypto')
const session = require('express-session')
const MemoryStore = require('memorystore')(session)
const { Passport } = require('passport')
const { Strategy } = require('./strategy')

let options
let passport
let httpNodeApp

module.exports = {
    init (_options) {
        options = _options
        return (req, res, next) => {
            try {
                if (req.session.ffSession) {
                    next()
                } else {
                    req.session.redirectTo = req.originalUrl
                    passport.authenticate('FlowFuse', { session: false })(req, res, next)
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
        httpNodeApp = app

        httpNodeApp.use(session({
        // As the session is only used across the life-span of an auth
        // hand-shake, we can use a instance specific random string
            secret: crypto.randomBytes(20).toString('hex'),
            resave: false,
            saveUninitialized: false,
            store: new MemoryStore({
                checkPeriod: 86400000 // prune expired entries every 24h
            })
        }))

        app.use(passport.initialize())

        // Need to map `options.baseURL` (the editor url) to the node root url.
        // We do not support moving node root off / - so we just need to strip off
        // any path

        const nodeUrl = new URL(options.baseURL)
        const callbackURL = `${nodeUrl.origin}/_ffAuth/callback`
        const authorizationURL = `${options.forgeURL}/account/authorize`
        const tokenURL = `${options.forgeURL}/account/token`
        const userInfoURL = `${options.forgeURL}/api/v1/user`
        const version = require('../../package.json').version

        passport.use('FlowFuse', new Strategy({
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

        app.get('/_ffAuth/callback', passport.authenticate('FlowFuse', {
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
