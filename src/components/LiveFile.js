const etag = require('etag');
const FileSystem = require('fs');
const { async_wait, wrap_object } = require('../shared/operators');

class LiveFile {
    #name;
    #etag;
    #extension;
    #buffer;
    #content;
    #last_update;
    #options = {
        path: '',
        retry: {
            every: 300,
            max: 3,
        },
    };

    constructor(options = this.#options) {
        // Wrap options object with provided object
        wrap_object(this.#options, options);

        // Determine the name of the file
        const chunks = options.path.split('/');
        this.#name = chunks[chunks.length - 1];

        // Determine the extension of the file
        this.#extension = this.#options.path.split('.');
        this.#extension = this.#extension[this.#extension.length - 1];
    }

    #reload_promise;
    #reload_resolve;
    #reload_reject;

    /**
     * Reloads buffer/content for file asynchronously with retry policy.
     *
     * @param {Boolean} fresh
     * @param {Number} count
     * @returns {Promise}
     */
    reload(fresh = true, count = 0) {
        const reference = this;
        if (fresh) {
            // Reuse promise if there if one pending
            if (this.#reload_promise instanceof Promise) return this.#reload_promise;

            // Create a new promise for fresh lookups
            this.#reload_promise = new Promise((resolve, reject) => {
                reference.#reload_resolve = resolve;
                reference.#reload_reject = reject;
            });
        }

        // Perform filesystem lookup query
        FileSystem.readFile(this.#options.path, async (error, buffer) => {
            // Pipe filesystem error through promise
            if (error) {
                reference._flush_ready();
                return reference.#reload_reject(error);
            }

            // Perform retries in accordance with retry policy
            // This is to prevent empty reads on atomicity based modifications from third-party programs
            const { every, max } = reference.#options.retry;
            if (buffer.length == 0 && count < max) {
                await async_wait(every);
                return reference.reload(false, count + 1);
            }

            // Update instance buffer/content/etag/last_update variables
            reference.#buffer = buffer;
            reference.#content = buffer.toString();
            reference.#etag = etag(buffer);
            reference.#last_update = Date.now();

            // Cleanup reload promises and methods
            reference.#reload_resolve();
            reference._flush_ready();
            reference.#reload_resolve = null;
            reference.#reload_reject = null;
            reference.#reload_promise = null;
        });

        return this.#reload_promise;
    }

    #ready_promise;
    #ready_resolve;

    /**
     * Flushes pending ready promise.
     * @private
     */
    _flush_ready() {
        if (typeof this.#ready_resolve == 'function') {
            this.#ready_resolve();
            this.#ready_resolve = null;
        }
        this.#ready_promise = true;
    }

    /**
     * Returns a promise which resolves once first reload is complete.
     *
     * @returns {Promise}
     */
    ready() {
        // Return true if no ready promise exists
        if (this.#ready_promise === true) return Promise.resolve();

        // Create a Promise if one does not exist for ready event
        if (this.#ready_promise === undefined)
            this.#ready_promise = new Promise((resolve) => (this.#ready_resolve = resolve));

        return this.#ready_promise;
    }

    /* LiveFile Getters */
    get name() {
        return this.#name;
    }

    get path() {
        return this.#options.path;
    }

    get extension() {
        return this.#extension;
    }

    get etag() {
        return this.#etag;
    }

    get content() {
        return this.#content;
    }

    get buffer() {
        return this.#buffer;
    }

    get last_update() {
        return this.#last_update;
    }
}

module.exports = LiveFile;
