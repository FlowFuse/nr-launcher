/**
 *
 */

const got = require('got')

module.exports = (settings) => {
    const baseURL = settings.loggingURL
    const projectID = settings.projectID
    const token = settings.token

    const logger = function (msg) {
        if (/^(comms\.|.*\.get$)/.test(msg.event)) {
        // Ignore comms events and any .get event that is just reading data
            return
        }
        if (/^auth/.test(msg.event) && !/^auth.log/.test(msg.event)) {
            return
        }
        if (msg.user) {
            msg.user = msg.user.userId
        }
        delete msg.username
        delete msg.level

        got.post(baseURL + '/' + projectID + '/audit', {
            json: msg,
            responseType: 'json',
            headers: {
                'user-agent': 'FlowForge Audit Logging v0.1',
                authorization: 'Bearer ' + token
            }
        })
            .catch(err => {
                // ignore errors for now
                console.log(err)
            })
    }

    return logger
}
