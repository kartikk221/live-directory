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
        ignore: undefined,
        retry: {
            every: 250,
            max: 2,
        },
    };

    /**
     * LiveDirectory constructor options
     *
     * @param {Object} options
     * @param {String} options.path Path of the desired directory
     * @param {function(string):Boolean} options.ignore Ignore function that prevents a file from being loaded when returned true.
     */
    constructor(options = this.#options) {
        super();

        // Enforce object only options type
        if (options == null || typeof options !== 'object')
            throw new Error('LiveDirectory options must be an object.');

        // Resolve user provided path to absolute path and wrap local options object
        options.path = resolve_path(options.path);
        wrap_object(this.#options, options);

        // Create a empty directory tree for root path
        this.#tree = new DirectoryTree();

        // Initiate watcher
        this._initiate_watcher();
    }

    /**
     * @private
     * Initiates chokidar watcher instance for root library.
     */
    async _initiate_watcher() {
        const { path, ignore } = this.#options;

        // Ensure provided root path by user is accessible
        if (!(await is_accessible_path(path)))
            throw new Error(
                'LiveDirectory.path is inaccessible or invalid. Please provide a valid path to a directory that exists.'
            );

        // Initiate chokidar watcher instance for root path
        this.#watcher = chokidar.watch(path + '/', {
            ignored: ignore,
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
