const EventEmitter = require('events');
const DirectoryTree = require('./DirectoryTree.js');
const chokidar = require('chokidar');
const {
    resolve_path,
    forward_slashes,
    wrap_object,
    is_accessible_path,
} = require('../shared/operators.js');
const LiveFile = require('./LiveFile.js');

class LiveDirectory extends EventEmitter {
    #watcher;
    #tree;
    #options = {
        path: '',
        keep: null,
        ignore: null,
        retry: {
            every: 250,
            max: 2,
        },
        hot_reload: true,
    };

    /**
     * LiveDirectory constructor options
     *
     * @param {Object} options
     * @param {String} options.path Path of the desired directory
     * @param {Object} options.keep Keep/Whitelist filter.
     * @param {Array} options.keep.names List of files/directories to keep/whitelist.
     * @param {Array} options.keep.extensions List of file extensions to keep/whitelist.
     * @param {Object} options.ignore Ignore/Blacklist filter
     * @param {Array} options.ignore.names List of files/directories to ignore/blacklist.
     * @param {Array} options.ignore.extensions List of file extensions to ignore/blacklist.
     */
    constructor(options) {
        super();

        // Enforce object only options type
        if (options == null || typeof options !== 'object')
            throw new Error('LiveDirectory options must be an object.');

        // Resolve user provided path to absolute path and wrap local options object
        options.path = resolve_path(options.path);
        wrap_object(this.#options, options);

        // Parse user provided filters into methods
        this._parse_keep_filters();
        this._parse_ignore_filters();

        // Create a empty directory tree for root path
        this.#tree = new DirectoryTree();

        // Initiate watcher
        this._initiate_watcher();
    }

    #filters = {
        keep: null,
        ignore: null,
    };

    /**
     * Parses user provided keep filters into a application method for fast checking.
     * @private
     */
    _parse_keep_filters() {
        const keep = this.#options.keep;

        // Parse keep filters if defined
        if (keep) {
            // If user provided a function, we simply passthrough that function to the apply method
            if (typeof keep == 'function') {
                this.#filters.keep = keep;
            } else if (typeof keep == 'object') {
                // Destructure and store the keep filters into key
                const { names, extensions } = this.#options.keep;
                const verify_names = Array.isArray(names) && names.length > 0;
                const verify_extensions = Array.isArray(extensions) && extensions.length > 0;

                // Create and bind an apply filter for enforcing key comparisons
                if (verify_names || verify_extensions)
                    this.#filters.keep = (path, stats) => {
                        // Only apply keep filters on files as full tree traversal is neccessary to retrieve all files
                        if (stats == undefined || stats.isDirectory()) return true;

                        // Apply names whitelist if a names array is provided
                        if (verify_names) {
                            let verdict = false;
                            for (let i = 0; i < names.length; i++) {
                                let current = names[i];
                                if (path.endsWith(current)) {
                                    verdict = true;
                                    break;
                                }
                            }

                            // Return false for keeping if matching against names fails
                            if (!verdict) return false;
                        }

                        // Apply extensions whitelist to files only
                        if (verify_extensions) {
                            let verdict = false;
                            for (let i = 0; i < extensions.length; i++) {
                                let current = extensions[i];
                                if (path.endsWith(current)) verdict = true;
                            }

                            // Return false for keeping if matching against file extension fails
                            if (!verdict) return false;
                        }

                        return true;
                    };
            }
        }
    }

    /**
     * Parses user provided keep filters into a application method for fast checking.
     * @private
     */
    _parse_ignore_filters() {
        const ignore = this.#options.ignore;

        // Parse keep filters if defined
        if (ignore) {
            // If user provided a function, we simply passthrough that function to the apply method
            if (typeof ignore == 'function') {
                this.#filters.ignore = ignore;
            } else if (typeof ignore == 'object') {
                // Destructure and store the keep filters into key
                const { names, extensions } = ignore;
                const verify_names = Array.isArray(names) && names.length > 0;
                const verify_extensions = Array.isArray(extensions) && extensions.length > 0;

                // Create and bind an apply filter for enforcing key comparisons
                if (verify_names || verify_extensions)
                    this.#filters.ignore = (path, stats) => {
                        // Apply names blacklist if a names array is provided
                        if (verify_names) {
                            let verdict = false;
                            for (let i = 0; i < names.length; i++) {
                                let current = names[i];
                                if (path.endsWith(current)) {
                                    verdict = true;
                                    break;
                                }
                            }

                            // Return true to filter current item if name is matched against blacklist
                            if (verdict) return true;
                        }

                        // Apply extensions blacklist to files only
                        if (verify_extensions && stats && stats.isFile()) {
                            let verdict = false;
                            for (let i = 0; i < extensions.length; i++) {
                                let current = extensions[i];
                                if (path.endsWith(current)) verdict = true;
                            }

                            // Return false for keeping if matching against file extension fails
                            if (verdict) return true;
                        }

                        return false;
                    };
            }
        }
    }

    /**
     * Applies instance filters on provided path to return a verdict to ignore.
     *
     * @private
     * @param {String} path
     * @returns {Boolean}
     */
    _ignore_path(path, stats) {
        // Apply keep/whitelist filter if available
        if (this.#filters.keep && !this.#filters.keep(path, stats)) return true;

        // Apply ignore/blacklist filter if available
        if (this.#filters.ignore && this.#filters.ignore(path, stats)) return true;

        return false;
    }

    /**
     * @private
     * Initiates chokidar watcher instance for root library.
     */
    async _initiate_watcher() {
        const { path } = this.#options;

        // Ensure provided root path by user is accessible
        if (!(await is_accessible_path(path)))
            throw new Error(
                'LiveDirectory.path is inaccessible or invalid. Please provide a valid path to a directory that exists.'
            );

        // Initiate chokidar watcher instance for root path
        this.#watcher = chokidar.watch(path, {
            ignored: (path, stats) => this._ignore_path(path, stats),
            awaitWriteFinish: {
                pollInterval: 100,
                stabilityThreshold: 500,
            },
        });

        // Bind watch handlers for chokidar instance
        this._bind_watch_handlers();
    }

    /**
     * Returns relative path based on root path with forward slashes.
     *
     * @private
     * @param {String} path
     */
    _relative_path(path) {
        return forward_slashes(path).replace(this.#options.path, '');
    }

    /**
     * @private
     * Binds watch handlers for chokidar watch instance.
     */
    _bind_watch_handlers() {
        const reference = this;

        // Bind 'addDir' for when a directory is created
        this.#watcher.on('addDir', (path) => {
            // Add directory to tree and emit directory_create event
            const relative = reference._relative_path(path);
            reference.#tree.add(relative, {});
            reference.emit('directory_create', relative);
        });

        // Bind 'unlinkDir' for when a directory is deleted
        this.#watcher.on('unlinkDir', (path) => {
            // Remove directory from tree and emit directory_create event
            const relative = reference._relative_path(path);
            reference.#tree.remove(relative);
            reference.emit('directory_destroy', relative);
        });

        // Bind 'add' for when a file is created
        this.#watcher.on('add', async (path) => {
            // Create new LiveFile instance
            const relative = reference._relative_path(path);
            const file = new LiveFile({
                path: forward_slashes(path),
                retry: reference.#options.retry,
            });

            // Add file to directory tree
            reference.#tree.add(relative, file);

            // Perform initial reload for file content readiness
            try {
                await file.reload();
            } catch (error) {
                reference.emit('file_error', file, error);
            }

            // Emit file_reload event for user processing
            reference.emit('file_reload', file);
        });

        // Bind 'change' for when a file is changed
        this.#watcher.on('change', async (path) => {
            const relative = reference._relative_path(path);
            const file = reference.#tree.files[relative];
            if (file) {
                // Reload file content since file has changed
                try {
                    await file.reload();
                } catch (error) {
                    reference.emit('file_error', file, error);
                }

                // Emit file_reload event for user processing
                reference.emit('file_reload', file);
            }
        });

        // Bind 'unlink' for when a file is deleted
        this.#watcher.on('unlink', (path) => {
            const relative = reference._relative_path(path);
            const file = reference.#tree.files[relative];
            if (file) {
                // Remove file from tree and emit file_destroy event
                reference.#tree.remove(relative);
                reference.emit('file_destroy', file);
            }
        });

        // Bind 'ready' for when all files have been loaded
        this.#watcher.once('ready', async () => {
            // Wait for all pending reload operations to finish
            try {
                const files = reference.#tree.files;
                const promises = [];

                // If we don't want to watch the files, let's stop the watcher as soon as the initial list of files
                // is fetched.
                if (this.#options.hot_reload === false) {
                    promises.push(this.#watcher.close());
                }

                Object.keys(files).forEach((path) => {
                    // If no buffer exists for file then it is still being read
                    const current = files[path];
                    if (current.buffer == undefined) promises.push(current.ready());
                });

                // Wait for all pending files to have their content read
                await Promise.all(promises);
            } catch (error) {
                reference.emit('error', error);
            }

            // Resolve pending promise if one exists
            if (typeof reference.#ready_resolve == 'function') {
                reference.#ready_resolve();
                reference.#ready_resolve = null;
            }

            // Mark instance as ready
            reference.#ready_promise = true;
        });
    }

    #ready_promise;
    #ready_resolve;

    /**
     * Returns a promise which resolves to true once LiveDirectory instance is ready with all files/directories loaded.
     *
     * @returns {Promise}
     */
    ready() {
        // Resolve with true if ready is not a promise
        if (this.#ready_promise === true) return Promise.resolve(true);

        // Create a promise if one does not exist for ready event
        if (this.#ready_promise === undefined)
            this.#ready_promise = new Promise((resolve) => (this.#ready_resolve = resolve));

        return this.#ready_promise;
    }

    /**
     * Resolves a LiveFile based on absolute, relative, or url based path string.
     * ASSUME Root is: /var/www/webserver/template
     * Path can be: /var/www/webserver/template/dashboard.html
     * Path can be: /dashboard.html
     * Path can be: dashboard.html
     *
     * @param {String} path
     * @returns {LiveFile|undefined}
     */
    get(path) {
        // Ensure path is a string
        if (typeof path !== 'string')
            throw new Error('LiveDirectory.get(path) -> path must be a String.');

        // Strip root from path if exists
        const root = this.#options.path;
        if (path.startsWith(root)) path = path.replace(root, '');

        // Add a leading slash if one does not exist
        if (!path.startsWith('/')) path = '/' + path;

        return this.#tree.files[path];
    }

    /* LiveDirectory Getters */
    get path() {
        return this.#options.path;
    }

    get watcher() {
        return this.#watcher;
    }

    get tree() {
        return this.#tree;
    }

    get files() {
        return this.#tree.files;
    }
}

module.exports = LiveDirectory;
