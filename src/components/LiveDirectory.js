const FileSystem = require('fs');
const DirectoryWatcher = require('./DirectoryWatcher.js');
const LiveFile = require('./LiveFile.js');

class LiveDirectory {
    #root_watcher;
    #files_tree = {};
    #default_renderer = (content, options) => content;
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

        // Verify provided directory actually exists and throw error on problem
        let reference = this;
        FileSystem.access(root_path, (error) => {
            if (error) throw error;

            // Create root directory watcher
            reference.#root_watcher = new DirectoryWatcher(
                root_path,
                file_extensions,
                watcher_delay
            );

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
    file(relative_path) {
        // Convert relative path to absolute path
        relative_path = this.#root_watcher.root + relative_path;
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
     * INTERNAL METHOD!
     * This method verifies provided constructor types.
     *
     * @param {Object} data
     */
    _verify_types({
        root_path,
        file_extensions,
        ignore_files,
        ignore_directories,
        watcher_delay,
    }) {
        // Verify root_path
        if (typeof root_path !== 'string')
            throw new Error(
                'LiveDirectory: constructor.options.root_path must be a String.'
            );

        // Verify watcher_delay
        if (typeof watcher_delay !== 'number')
            throw new Error(
                'LiveDirectory: constructor.options.watcher_delay must be a Number.'
            );

        // Verify file_extensions
        if (!Array.isArray(file_extensions))
            throw new Error(
                'LiveDirectory: constructor.options.file_extensions must be an Array.'
            );

        // Verify ignore_files
        if (!Array.isArray(ignore_files))
            throw new Error(
                'LiveDirectory: constructor.options.ignore_files must be an Array.'
            );

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
        this.#root_watcher.handle('file_remove', (path) =>
            this._remove_file(path)
        );
    }

    /**
     * INTERNAL METHOD!
     * Creates/Adds LiveFile instance for specified path
     *
     * @param {String} path
     */
    _add_file(path) {
        if (this.#files_tree[path] == undefined) {
            this.#files_tree[path] = new LiveFile({
                path: path,
                watcher_delay: this.#root_watcher.watcher_delay,
                renderer: this.#default_renderer,
            });

            // Bind Error Handler
            this.#files_tree[path].handle('error', (error) =>
                this.#handlers.error(path, error)
            );

            // Bind Reload Handler
            this.#files_tree[path].handle('reload', () =>
                this.#handlers.reload(this.#files_tree[path])
            );
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
