const Crypto = require('crypto');
const Chokidar = require('chokidar');
const EventEmitter = require('events');
const FileSystemSync = require('fs');
const FileSystem = require('fs/promises');
const { forward_slashes, resolve_path, is_accessible_path } = require('./operators.js');

class LiveDirectory extends EventEmitter {
    #path;
    #watcher;
    #files = new Map();
    #cached = new Map();
    #options = {
        static: false,
        cache: {
            max_file_count: 250, // 250 MB cache size
            max_file_size: 1024 * 1024, // 1 MB per file
        },
        watcher: {
            awaitWriteFinish: {
                pollInterval: 100,
                stabilityThreshold: 500,
            },
        },
    };

    /**
     * @param {string} path The path to the directory to be mapped.
     * @param {Object} options The options for the directory map.
     * @param {boolean} [options.static=false] Whether the directory map should automatically reload on changes.
     * @param {Chokidar.WatchOptions} options.watcher The options for the chokidar watcher.
     * @param {Object} options.cache The options for internal caching of file contents.
     * @param {number} options.cache.max_file_count The maximum number of files to cache.
     * @param {number} options.cache.max_file_size The maximum size of a file to cache in `bytes`.
     */
    constructor(path, options = {}) {
        super();

        // Strip trailing slash from the path and conert it to a system path
        path = forward_slashes(resolve_path(path.replace(/\/$/, '')));

        // Merge the provided options with the default options while maintaing default properties that are objects
        this.#options = {
            ...this.#options,
            ...options,
            cache: {
                ...this.#options.cache,
                ...options.cache,
            },
            watcher: {
                ...this.#options.watcher,
                ...options.watcher,
            },
        };

        // Ensure the provided path is accessible
        is_accessible_path(path).then((accessible) => {
            if (accessible) {
                // Initialize the directory map with the provided root path
                this.#path = path;
                this._initialize(path).then(() => {
                    // Emit the ready event when the directory map is initialized
                    this.emit('ready');

                    // Watch the directory map for changes if static is enabled
                    if (!this.#options.static) this._watch(path);
                });
            } else {
                throw new Error(`LiveDirectory: Provided path '${path}' is not accessible.`);
            }
        });
    }

    /**
     * @typedef {Object} FileStats
     * @property {string} path The system path of the file.
     * @property {string} etag The etag of the file.
     * @property {import('fs').Stats} stats The stats of the file.
     * @property {boolean} cached Whether the file is cached in memory.
     * @property {Buffer} [_content] The raw content of the file if cached in memory.
     */

    /**
     * Returns the relative version of the provided path to the directory map root.
     * @private
     * @param {string} path
     * @returns {string}
     */
    _relative_uri(path) {
        return path.replace(this.#path, '');
    }

    /**
     * Creates a new directory map stats object.
     * @private
     * @param {string} path
     * @param {import('fs').Stats} stats
     * @returns {Promise<FileStats>}
     */
    async _create_stats(path, stats) {
        const { size } = stats;
        const { max_file_count, max_file_size } = this.#options.cache;

        // Determine if this file should be cached in memory
        const cached = size <= max_file_size && this.#cached.size < max_file_count;

        // Generate the tag and content for the file if it is cached
        let etag, content;
        if (cached) {
            // Mark this file as cached
            this.#cached.set(path, true);

            // Read the file content into memory
            content = await FileSystem.readFile(path);

            // Create an Etag from the file content
            etag = `"${Crypto.createHash('md5').update(content).digest('hex')}"`;
        } else {
            // Create an Etag from the file stats size, created and modified times
            etag = `W/"${Crypto.createHash('md5')
                .update([size, stats.ctimeMs, stats.mtimeMs].join(','))
                .digest('hex')}"`;
        }

        return {
            path,
            etag,
            stats,
            cached,
            _content: content,
        };
    }

    /**
     * Adds content to the directory map.
     * @private
     * @param {String} path
     * @param {import('fs').Stats} stats
     */
    async _add(path, stats) {
        // Create the file stats
        stats = await this._create_stats(path, stats);

        // Store the file in the files map
        this.#files.set(this._relative_uri(path), stats);

        // Emit the 'add' event
        this.emit('add', path, stats);
    }

    /**
     * Updates content in the directory map.
     * @private
     * @param {String} path
     * @param {import('fs').Stats} stats
     */
    async _update(path, stats) {
        // Create the file stats
        stats = await this._create_stats(path, stats);

        // Update the file in the files map
        this.#files.set(this._relative_uri(path), file_stats);

        // Emit the 'update' event
        this.emit('update', path, stats);
    }

    /**
     * Deletes content from the directory map.
     * @private
     * @param {String} path
     */
    _delete(path) {
        // Delete the file from the files map
        this.#files.delete(this._relative_uri(path));

        // Delete any cached record of the file
        this.#cached.delete(path);

        // Emit the 'delete' event
        this.emit('delete', path);
    }

    /**
     * Initializes the directory map contents for the provided path.
     * @private
     * @param {string} root The path to the directory to be mapped.
     */
    async _initialize(root) {
        const promises = [];
        const contents = await FileSystem.readdir(root, { withFileTypes: true });
        for (const content of contents) {
            // Retrieve the name and path of the content item
            const name = content.name;
            const path = `${root}/${name}`;
            if (content.isDirectory()) {
                // Recursively initialize the sub directory
                promises.push(this._initialize(path));
            } else {
                promises.push(
                    new Promise((resolve) =>
                        FileSystem.stat(path).then((stats) => this._add(path, stats).then(resolve))
                    )
                );
            }
        }
        await Promise.all(promises);
    }

    /**
     * Begins watching the directory map for changes.
     * @private
     * @param {string} root
     */
    _watch(root) {
        // Force chokidar to ignore initial events and always stat files
        this.#options.watcher.alwaysStat = true;
        this.#options.watcher.ignoreInitial = true;

        // Initialize the chokidar watcher
        this.#watcher = Chokidar.watch(root, this.#options.watcher);

        // Add event listeners for the chokidar watcher files only
        this.#watcher.on('add', (path, stats) => this._add(forward_slashes(path), stats));
        this.#watcher.on('change', (path, stats) => this._update(forward_slashes(path), stats));
        this.#watcher.on('unlink', (path) => this._delete(forward_slashes(path)));
    }

    /**
     * Converts the provided path to a relative path.
     * @private
     * @param {string} path
     * @returns {string}
     */
    _to_relative_path(path) {
        // Remove root path from the provided path if it exists
        if (path.startsWith(this.#path)) path = path.replace(this.#path, '');

        // Add leading slash if missing
        if (!path.startsWith('/')) path = `/${path}`;

        // Return processed path
        return path;
    }

    /**
     * Returns the file stats for the provided relative path.
     * @param {string} path
     * @returns {FileStats=}
     */
    file(path) {
        return this.#files.get(this._to_relative_path(path));
    }

    /**
     * Returns the file content for the provided relative path.
     * @param {string} path
     * @returns {(Buffer|ReadableStream)=} Cached `Buffer` content or a readable stream for the file content.
     */
    content(path) {
        // Lookup the file stats
        const file = this.#files.get(this._to_relative_path(path));
        if (file) {
            // Return the file content if it is cached
            if (file && file.cached) return file._content;

            // Return a readable stream for the file content
            return FileSystemSync.createReadStream(file.path);
        }
    }

    /**
     * Destroys this instance.
     */
    destory() {
        // Close the chokidar watcher
        if (this.#watcher) this.#watcher.close();

        // Clear the directory map
        this.#files.clear();

        // Emit the destory event
        this.emit('destory');
    }

    /**
     * Returns the root path.
     * @returns {string}
     */
    get path() {
        return this.#path;
    }

    /**
     * Whether this instance will watch and reload on changes.
     * @returns {boolean}
     */
    get static() {
        return this.#options.static;
    }

    /**
     * Returns a map of all files identified by their relative path to the root path.
     * @returns {Map<string, FileStats>}
     */
    get files() {
        return this.#files;
    }

    /**
     * Returns a map of all cached files identified by their absolute path.
     * @returns {Map<string, boolean>}
     */
    get cached() {
        return this.#cached;
    }

    /**
     * Returns the chokidar watcher.
     * @returns {import('chokidar').FSWatcher}
     */
    get watcher() {
        return this.#watcher;
    }
}

module.exports = LiveDirectory;
