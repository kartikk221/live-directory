const Path = require('path');
const FileSystem = require('fs');

/**
 * Returns a promise which is resolved after provided delay in milliseconds.
 *
 * @param {Number} delay
 * @returns {Promise}
 */
function async_wait(delay) {
    return new Promise((resolve, reject) => setTimeout((res) => res(), delay, resolve));
}

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
 * Writes values from focus object onto base object.
 *
 * @param {Object} obj1 Base Object
 * @param {Object} obj2 Focus Object
 */
function wrap_object(original, target) {
    Object.keys(target).forEach((key) => {
        if (typeof target[key] == 'object') {
            if (Array.isArray(target[key])) return (original[key] = target[key]); // lgtm [js/prototype-pollution-utility]
            if (original[key] === null || typeof original[key] !== 'object') original[key] = {};
            wrap_object(original[key], target[key]);
        } else {
            original[key] = target[key];
        }
    });
}

/**
 * Determines whether a path is accessible or not by FileSystem package.
 *
 * @param {String} path
 * @returns {Promise}
 */
function is_accessible_path(path) {
    return new Promise((resolve, reject) => {
        // Destructure constants for determine read & write codes
        const CONSTANTS = FileSystem.constants;
        const IS_VALID = CONSTANTS.F_OK;
        const HAS_PERMISSION = CONSTANTS.W_OK;
        FileSystem.access(path, IS_VALID | HAS_PERMISSION, (error) => {
            if (error) return resolve(false);
            resolve(true);
        });
    });
}

module.exports = {
    async_wait,
    resolve_path,
    forward_slashes,
    wrap_object,
    is_accessible_path,
};
