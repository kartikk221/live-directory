const Crypto = require('crypto');
const Chokidar = require('chokidar');
const EventEmitter = require('events');
const FileSystemSync = require('fs');
const FileSystem = require('fs/promises');
const { forward_slashes, resolve_path, is_accessible_path } = require('./operators.js');

/**
 * @typedef {function(string, import('fs').Stats):boolean} FilterFunction Return `true` to filter the file.
 */

/**
 * @typedef {Object} FilterProperties
 * @property {string[]=} names The names of the files to filter.
 * @property {string[]=} extensions The extensions of the files to filter.
 */

/**
 * @typedef {Object} LiveDirectoryOptions
 * @property {boolean} [static=false] Whether the instance should automatically reload on changes.
 * @property {Chokidar.WatchOptions} [watcher] The options for the chokidar watcher.
 * @property {Object} [cache] The options for internal caching of file contents.
 * @property {number=} cache.max_file_count The maximum number of files to cache.
 * @property {number=} cache.max_file_size The maximum size of a file to cache in `bytes`.
 * @property {Object} [filter] The options for filtering files.
 * @property {FilterProperties|FilterFunction} [filter.keep] The files to ONLY keep.
 * @property {FilterProperties|FilterFunction} [filter.ignore] The files to ALWAYS ignore.
 */

/**
 * @typedef {Object} FileStats
 * @property {string} path The system path of the file.
 * @property {string} etag The etag of the file.
 * @property {import('fs').Stats} stats The stats of the file.
 * @property {boolean} cached Whether the file is cached in memory.
 * @property {Buffer} [_content] The raw content of the file if cached in memory.
 */

class LiveDirectory extends EventEmitter {
    #path;
    #filter;
    #watcher;
    #files = new Map();
    #cached = new Map();
    #options = {
        static: false,
        watcher: {
            awaitWriteFinish: {
                pollInterval: 100,
                stabilityThreshold: 500,
            },
        },
        cache: {
            max_file_count: 250, // 250 MB total cache size
            max_file_size: 1024 * 1024, // 1 MB per file
        },
    };

    /**
     *
     * @param {string} path The path of the directory to make live.
     * @param {LiveDirectoryOptions} options
     */
    constructor(path, options = {}) {
        super();

        // Strip trailing slash from the path and conert it to a system path
        path = forward_slashes(resolve_path(path.replace(/\/$/, '')));

        // Merge the provided options while maintaining the default options
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
                // Compile a filter function if we have either keep or ignore filters
                const { keep = () => true, ignore = () => false } = this.#options.filter || {};
                if (keep || ignore) {
                    const satisfies_keep = typeof keep == 'function' ? keep : this._to_lookup_function(keep);
                    const satisfies_ignore = typeof ignore == 'function' ? ignore : this._to_lookup_function(ignore);
                    this.#filter = (path, stats) => !satisfies_keep(path, stats) || satisfies_ignore(path, stats);
                }

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
     * Returns a lookup function that asserts the provided path against the provided filter properties.
     * @private
     * @param {FilterProperties} properties
     * @returns {FilterFunction}
     */
    _to_lookup_function(properties) {
        // Convert Array properties to Maps for faster lookup
        const maps = {};
        ['names', 'extensions'].forEach((key) => {
            const map = new Map();
            (properties[key] || []).forEach((value) => map.set(value, true));
            maps[key] = map;
        });

        // Return a filter function that checks the provided path and stats
        const { names, extensions } = maps;
        return (path) => {
            // Parse the name and extension of the provided path
            const name = path.split('/').pop();
            const extension = name.split('.').pop();
            return extensions.has(extension) || names.has(name);
        };
    }

    /**
     * Asserts instance filters against the provided path and stats.
     * @private
     * @param {string} path
     * @param {import('fs').Stats} stats
     */
    _should_ignore(path, stats) {
        return this.#filter ? this.#filter(path, stats) : false;
    }

    /**
     * Converts loose or absolute paths to a relative path.
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
     * Returns an MD5 hash of the provided string.
     * @private
     * @param {string} string
     * @returns {string}
     */
    _md5_hash(string) {
        return Crypto.createHash('md5').update(string).digest('hex');
    }

    /**
     * Initializes the directory map contents for the provided path.
     * @private
     * @param {string} root
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
                // Assert the filter after stats are retrieved
                promises.push(
                    new Promise((resolve) =>
                        FileSystem.stat(path).then((stats) =>
                            this._should_ignore(path, stats)
                                ? resolve()
                                : this._modify('add', path, stats).then(resolve)
                        )
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
        // Inject forced properties for live directory specific behavior
        this.#options.watcher.alwaysStat = true;
        this.#options.watcher.ignoreInitial = true;
        this.#options.watcher.ignored = (path, stats) => this._should_ignore(path, stats);

        // Initialize the chokidar watcher
        this.#watcher = Chokidar.watch(root, this.#options.watcher);

        // Add event listeners for the chokidar watcher files only
        this.#watcher.on('add', (path, stats) => this._modify('add', forward_slashes(path), stats));
        this.#watcher.on('change', (path, stats) => this._modify('update', forward_slashes(path), stats));
        this.#watcher.on('unlink', (path) => this._modify('delete', forward_slashes(path)));
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

        // Determine the relative uri and whether the file should be cached
        const relative_uri = this._to_relative_path(path);
        const should_be_cached = size <= max_file_size && this.#cached.size < max_file_count;

        // Generate the tag and content for the file if it is cached
        let etag, content;
        if (should_be_cached) {
            // Read fresh content, cache the current time and create a strong etag from the content
            this.#cached.set(relative_uri, Date.now());
            content = await FileSystem.readFile(path);
            etag = `"${this._md5_hash(content)}"`;
        } else {
            // Create a weak etag from the file stats size, created and modified timestamps
            etag = `W/"${this._md5_hash([size, stats.ctimeMs, stats.mtimeMs].join(','))}"`;
        }

        return {
            path,
            etag,
            stats,
            cached: should_be_cached,
            _content: content,
        };
    }

    /**
     * Modifies the directory map contents for the provided path.
     * @private
     * @param {('add'|'update'|'delete')} action
     * @param {string} path
     * @param {import('fs').Stats} [stats]
     */
    async _modify(action, path, stats) {
        // Generate a relative path for the content
        const relative_uri = this._to_relative_path(path);
        if (action === 'delete') {
            // Delete file stats and cache records
            this.#files.delete(relative_uri);
            this.#cached.delete(relative_uri);
        } else {
            // Override the raw stats with a file stats object
            stats = await this._create_stats(path, stats);

            // Update the file stats record
            this.#files.set(relative_uri, stats);
        }

        // Emit an event to alert listeners of the change
        this.emit(action, relative_uri, stats);
    }

    /**
     * Returns the file information for the provided relative path if it exists.
     * @param {string} path
     * @returns {FileStats=}
     */
    info(path) {
        return this.#files.get(this._to_relative_path(path));
    }

    /**
     * Returns the file content for the provided relative path if it exists.
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
        // Close the chokidar watcher if it exists
        if (this.#watcher) this.#watcher.close();

        // Clear the stats and cache maps
        this.#files.clear();
        this.#cached.clear();

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
     * Returns the chokidar watcher.
     * @returns {import('chokidar').FSWatcher}
     */
    get watcher() {
        return this.#watcher;
    }

    /**
     * Returns a map of all files identified by their relative path to the root path.
     * @returns {Map<string, FileStats>}
     */
    get files() {
        return this.#files;
    }

    /**
     * Returns a map of all cached files identified by their relative path to the last update timestamp.
     * @returns {Map<string, number>}
     */
    get cached() {
        return this.#cached;
    }
}

module.exports = LiveDirectory;
