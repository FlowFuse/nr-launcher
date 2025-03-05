const util = require('util')
const url = require('url')
const OAuth2Strategy = require('passport-oauth2')

const Roles = {
    None: 0,
    Dashboard: 5,
    Viewer: 10,
    Member: 30,
    Owner: 50,
    Admin: 99
}
const RoleNames = {
    [Roles.None]: 'none',
    [Roles.Dashboard]: 'dashboard',
    [Roles.Viewer]: 'viewer',
    [Roles.Member]: 'member',
    [Roles.Owner]: 'owner',
    [Roles.Admin]: 'admin'
}

function Strategy (options, verify) {
    this.options = options
    this._base = Object.getPrototypeOf(Strategy.prototype)
    this._base.constructor.call(this, this.options, verify)
    this.name = 'FlowFuse'
    this.isSecure = /^https:/.test(options.authorizationURL)
    this.isRelativeCallback = !/^https?:/.test(options.callbackURL)
}

util.inherits(Strategy, OAuth2Strategy)

/**
 * Patch the authenticate function so we can do per-request generation of the
 * callback uri
 */
Strategy.prototype.__authenticate = Strategy.prototype.authenticate

Strategy.prototype.authenticate = function (req, options) {
    const strategyOptions = { ...options }

    if (this.isRelativeCallback) {
        // Get the base url of the request

        // This logic comes from passport_oauth2/lib/utils - but we use our
        // own check for whether to redirect to https or http based on the
        // authorizationURL we've been provided
        const app = req.app
        let trustProxy = this._trustProxy
        if (app && app.get && app.get('trust proxy')) {
            trustProxy = true
        }
        const protocol = this.isSecure ? 'https' : 'http'
        const host = (trustProxy && req.headers['x-forwarded-host']) || req.headers.host
        const path = req.url || ''
        const base = protocol + '://' + host + path
        strategyOptions.callbackURL = (new url.URL(this.options.callbackURL, base)).toString()
    }

    return this.__authenticate(req, strategyOptions)
}

Strategy.prototype.sendAPIRequest = function (url, accessToken, done) {
    this._oauth2.useAuthorizationHeaderforGET(true)
    this._oauth2.get(url, accessToken, (err, body) => {
        if (err) {
            return done(err)
        }
        try {
            const json = JSON.parse(body)
            done(null, json)
        } catch (e) {
            done(e)
        }
    })
}
Strategy.prototype.userProfile = function (accessToken, done) {
    console.log('userProfile check')
    this._oauth2.useAuthorizationHeaderforGET(true)
    this.sendAPIRequest(this.options.userInfoURL, accessToken, (err, userProfile) => {
        if (err) {
            console.log('Authentication error:', err)
            return done(err)
        }
        this.sendAPIRequest(this.options.userTeamRoleURL, accessToken, (err, userTeamRole) => {
            if (err) {
                console.log('Authentication error:', err)
                return done(err)
            }
            done(null, {
                username: userProfile.username,
                email: userProfile.email,
                image: userProfile.avatar,
                name: userProfile.name,
                userId: userProfile.id,
                role: RoleNames[userTeamRole.role] || ''
            })
        })
    })
}

module.exports = { Strategy }
