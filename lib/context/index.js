const { FFContextStorage } = require('./FFContextStorage')
/**
 * Create a New FFContextStorage
 * @param {FFContextStorageConfig} config Config options (see FFContextStorageConfig typedef)
 * @returns {FFContextStorage} A new FFContextStorage instance
 */
module.exports = function (config) {
    return new FFContextStorage(config)
}
