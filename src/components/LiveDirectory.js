const FileSystem = require('fs');
const DirectoryWatcher = require('./DirectoryWatcher.js');
const LiveFile = require('./LiveFile.js');

class LiveDirectory {
    #root_watcher;
    #files_tree = {};
    #default_renderer = (path, content, options) => content;
    #handlers = {
        error: (path, error) => {},
        reload: (file) => {},
    };

    constructor({
        root_path,
        file_extensions = [],
        ignore_files = [],
        ignore_directories = [],
        watcher_delay = 250,
    }) {
        // Verify provided constructor parameter types
        this._verify_types({
            root_path: root_path,
            file_extensions: file_extensions,
            ignore_files: ignore_files,
            ignore_directories: ignore_directories,
            watcher_delay: watcher_delay,
        });

        // Ensure root_path has a trailing slash for parsing purposes
        root_path = DirectoryWatcher._ensure_trailing_slash(root_path);

        // Verify provided directory actually exists and throw error on problem
        let reference = this;
        FileSystem.access(root_path, (error) => {
            if (error) throw error;

            // Create root directory watcher
            reference.#root_watcher = new DirectoryWatcher({
                path: root_path,
                extensions: file_extensions,
                ignore_files: ignore_files,
                ignore_directories: ignore_directories,
                delay: watcher_delay,
            });

            // Bind root methods for powering file tree
            reference._bind_root_handlers();
        });
    }

    /**
     * Returns LiveFile instance for specified relative path if one exists
     *
     * @param {String} relative_path
     * @returns {LiveFile} LiveFile
     */
    get(relative_path) {
        return this.#files_tree[relative_path];
    }

    /**
     * Binds handler for specified type event.
     *
     * @param {String} type
     * @param {Function} handler
     */
    handle(type, handler) {
        if (this.#handlers[type] == undefined)
            throw new Error(`${type} event is not supported on LiveDirectory.`);

        this.#handlers[type] = handler;
    }

    /**
     * This method can be used to set a default renderer for all files.
     *
     * @param {Function} renderer
     */
    set_default_renderer(renderer) {
        this.#default_renderer = renderer;
    }

    /**
     * INTERNAL METHOD!
     * This method converts absolute path into a relative path by converting root path into a '/'
     *
     * @param {String} path
     * @returns {String} String
     */
    _get_relative_path(path) {
        return path.replace(this.#root_watcher.root, '/');
    }

    /**
     * INTERNAL METHOD!
     * This method verifies provided constructor types.
     *
     * @param {Object} data
     */
    _verify_types({ root_path, file_extensions, ignore_files, ignore_directories, watcher_delay }) {
        // Verify root_path
        if (typeof root_path !== 'string')
            throw new Error('LiveDirectory: constructor.options.root_path must be a String.');

        // Verify watcher_delay
        if (typeof watcher_delay !== 'number')
            throw new Error('LiveDirectory: constructor.options.watcher_delay must be a Number.');

        // Verify file_extensions
        if (!Array.isArray(file_extensions))
            throw new Error('LiveDirectory: constructor.options.file_extensions must be an Array.');

        // Verify ignore_files
        if (!Array.isArray(ignore_files))
            throw new Error('LiveDirectory: constructor.options.ignore_files must be an Array.');

        // Verify ignore_directories
        if (!Array.isArray(ignore_directories))
            throw new Error(
                'LiveDirectory: constructor.options.ignore_directories must be an Array.'
            );
    }

    /**
     * INTERNAL METHOD!
     * Binds appropriate file handlers to root directory watcher.
     */
    _bind_root_handlers() {
        // Bind file_add event handler
        this.#root_watcher.handle('file_add', (path) => this._add_file(path));

        // Bind file_remove event handler
        this.#root_watcher.handle('file_remove', (path) => this._remove_file(path));
    }

    /**
     * INTERNAL METHOD!
     * Creates/Adds LiveFile instance for specified path
     *
     * @param {String} path
     */
    _add_file(path) {
        let relative_path = this._get_relative_path(path);
        if (this.#files_tree[relative_path] == undefined) {
            this.#files_tree[relative_path] = new LiveFile({
                path: path,
                watcher_delay: this.#root_watcher.watcher_delay,
                renderer: this.#default_renderer,
            });

            // Bind Error Handler
            this.#files_tree[relative_path]._handle('error', (error) =>
                this.#handlers.error(path, error)
            );

            // Bind Reload Handler
            const reference = this;
            this.#files_tree[relative_path]._handle('reload', () => {
                const live_file = reference.#files_tree[relative_path];
                if (typeof live_file.content == 'string')
                    reference.#handlers.reload(reference.#files_tree[relative_path]);
            });
        }
    }

    /**
     * INTERNAL METHOD!
     * Destroys/Removes LiveFile instance for specified path
     *
     * @param {String} path
     */
    _remove_file(path) {
        if (this.#files_tree[path]) {
            this.#files_tree[path]._destroy();
            delete this.#files_tree[path];
        }
    }

    /* LiveDirectory Getters */
    get files() {
        return this.#files_tree;
    }

    get path_prefix() {
        return this.#root_watcher.path_prefix;
    }

    get tree() {
        return this.#root_watcher.tree;
    }
}

module.exports = LiveDirectory;
