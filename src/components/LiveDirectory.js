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

    constructor({ root_path, file_extensions = [], watcher_delay = 250 }) {
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

        // Create root directory watcher
        this.#root_watcher = new DirectoryWatcher(
            root_path,
            file_extensions,
            watcher_delay
        );

        // Bind root methods for powering file tree
        this._bind_root_handlers();
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
}

module.exports = LiveDirectory;
