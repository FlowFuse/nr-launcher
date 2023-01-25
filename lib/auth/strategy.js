const util = require('util')
const OAuth2Strategy = require('passport-oauth2')

function Strategy (options, verify) {
    this.options = options
    this._base = Object.getPrototypeOf(Strategy.prototype)
    this._base.constructor.call(this, this.options, verify)
    this.name = 'FlowForge'
}

util.inherits(Strategy, OAuth2Strategy)

Strategy.prototype.userProfile = function (accessToken, done) {
    this._oauth2.useAuthorizationHeaderforGET(true)
    this._oauth2.get(this.options.userInfoURL, accessToken, (err, body) => {
        if (err) {
            return done(err)
        }
        try {
            const json = JSON.parse(body)
            done(null, {
                username: json.username,
                image: json.avatar,
                name: json.name,
                userId: json.id
            })
        } catch (e) {
            done(e)
        }
    })
}

module.exports = { Strategy }
