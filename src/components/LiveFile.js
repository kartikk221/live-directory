const EventEmitter = require('events');
const FileSystem = require('fs/promises');
const FileSystemSync = require('fs');

const { md5_hash } = require('../shared/operators.js');

class LiveFile extends EventEmitter {
    #path;
    #etag;
    #stats;
    #content;

    /**
     * @param {string} path
     */
    constructor(path) {
        super();
        this.#path = path;
    }

    /**
     * Reloads the file stats and content from the file system.
     * @param {import('fs').Stats} [stats]
     * @param {boolean} [cache]
     */
    async reload(stats, cache = false) {
        // Read file stats if not provided
        if (!stats) stats = await FileSystem.stat(this.#path);

        // Update local stats
        this.#stats = stats;

        // Determine if this reload should cache the file
        if (cache) {
            // Read file content and cache it
            this.#content = await FileSystem.readFile(this.#path);

            // Calculate the strong ETag
            this.#etag = `"${md5_hash(this.#content)}"`;
        } else {
            // Calculate a weak etag based on size, ctime, and mtime
            const { size, ctimeMs, mtimeMs } = stats;
            this.#etag = `W/"${md5_hash([size, ctimeMs, mtimeMs].join(','))}"`;
        }

        // Emit the 'update' event to notify listeners of the change
        this.emit('update', this);
    }

    /**
     * Returns the file system path.
     * @returns {string}
     */
    get path() {
        return this.#path;
    }

    /**
     * Returns the file's system stats.
     * @returns {import('fs').Stats}
     */
    get stats() {
        return this.#stats;
    }

    /**
     * Returns a unique ETag for the file.
     * @returns {string}
     */
    get etag() {
        return this.#etag;
    }

    /**
     * Returns the file's content as a cached Buffer or ReadableStream.
     * @returns {Buffer|import('stream').Readable}
     */
    get content() {
        return this.#content || FileSystemSync.createReadStream(this.#path);
    }

    /**
     * Whether this file is cached in memory or not.
     * @returns {boolean}
     */
    get cached() {
        return this.#content !== undefined;
    }
}

module.exports = LiveFile;
