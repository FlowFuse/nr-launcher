module.exports = function (RED) {
    RED.plugins.registerPlugin('flowfuse-common', {
        settings: {
            launcherVersion: { exportable: true },
            projectURL: { exportable: true }
        }
    })
}
