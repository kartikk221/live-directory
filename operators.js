const Path = require('path');
const FileSystem = require('fs');

/**
 * Returns provided path into absolute system path with forward slashes.
 *
 * @param {String} path
 * @returns {String}
 */
function resolve_path(path) {
    return forward_slashes(Path.resolve(path));
}

/**
 * Returns provided path with forward slashes.
 *
 * @param {String} path
 * @returns {String}
 */
function forward_slashes(path) {
    return path.split('\\').join('/');
}

/**
 * Determines whether a path is accessible or not by FileSystem package.
 *
 * @param {String} path
 * @returns {Promise}
 */
function is_accessible_path(path) {
    return new Promise((resolve) => {
        const IS_VALID = FileSystem.constants.F_OK; // File exists
        const HAS_PERMISSION = FileSystem.constants.R_OK; // Read permission
        FileSystem.access(path, IS_VALID | HAS_PERMISSION, (error) => resolve(!error));
    });
}

module.exports = {
    resolve_path,
    forward_slashes,
    is_accessible_path,
};
