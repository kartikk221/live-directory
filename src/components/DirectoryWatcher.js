const FileSystem = require('fs');
const {
    async_for_each,
    throttled_for_each,
} = require('../shared/operators.js');

class DirectoryWatcher {
    #root_path;
    #watcher_delay;
    #extensions = [];
    #ignore_directories = [];
    #ignore_files = [];
    #watchers = {};
    #tree = {
        normal: {},
        flat: {},
    };

    #path_prefix = `_${Math.random().toString(35).substring(3)}_path`;
    #handlers = {
        file_add: (path) => {},
        file_remove: (path) => {},
        directory_remove: (path) => {},
        directory_add: (path) => {},
        error: (path, error) => {},
    };

    // Create Root Watcher On Construction
    constructor({ path, extensions, delay, ignore_files, ignore_directories }) {
        this.#root_path = path;
        this.#extensions = extensions;
        this.#watcher_delay = delay;
        this.#ignore_files = ignore_files;
        this.#ignore_directories = ignore_directories;
        this._watch(path);
        this._recalibrate_tree();
    }

    /**
     * Handles events for directory tree
     *
     * @param {String} event
     * @param {Function} handler
     */
    handle(event, handler) {
        if (this.#handlers[event] == undefined)
            throw new Error('Unsupported Event');
        this.#handlers[event] = handler;
    }

    /**
     * INTERNAL METHOD!
     * This method creates and stores a watcher for specified path.
     *
     * @param {String} path
     */
    _watch(path) {
        if (this.#watchers[path] !== undefined)
            throw new Error(`${path} directory watcher already exists`);

        this.#watchers[path] = {
            last_update: Date.now() - this.#watcher_delay,
            reference: FileSystem.watch(path, (e, f) =>
                this._on_event(e, path)
            ),
        };

        // Bind an error handler for FSWatcher errors
        this.#watchers[path].reference.on('error', (error) =>
            this.#handlers.error(path, error)
        );
    }

    /**
     * INTERNAL METHOD!
     * This method closes and deletes watcher for specified path.
     *
     * @param {String} path
     */
    _unwatch(path) {
        if (this.#watchers[path]) {
            this.#watchers[path].reference.close();
            delete this.#watchers[path];
        }
    }

    /**
     * INTERNAL METHOD!
     * This method checks if a FileWatcher event passes delay requirements.
     *
     * @param {String} path
     * @param {Boolean} touch
     * @returns {Boolean} Boolean
     */
    _delay_check(path, touch = true) {
        let watcher = this.#watchers[path];
        let last_update = watcher.last_update;
        let safe_delay = this.#watcher_delay;
        let delay_check = Date.now() - last_update > safe_delay;
        if (delay_check && touch) watcher.last_update = Date.now();
        return delay_check;
    }

    /**
     * INTERNAL METHOD!
     * This method handles FileWatcher events.
     *
     * @param {String} event
     * @param {String} path
     */
    _on_event(event, path) {
        let delay_check = this._delay_check(path);
        if (delay_check && event === 'rename') this._recalibrate_tree();
    }

    /**
     * INTERNAL METHOD!
     * This method ensures parameter path has a trailing slash
     *
     * @param {String} path
     * @returns {String} String
     */
    static _ensure_trailing_slash(path) {
        // Prevent double slashing on '/' path scenario
        if (path.length < 2) return path;

        // Add trailing slash if not available
        let has_trailing_slash = path.substr(path.length - 1) === '/';
        return has_trailing_slash ? path : path + '/';
    }

    /**
     * INTERNAL METHOD!
     *
     * @param {String} path
     * @param {Array} extensions
     * @returns {Promise} Promise -> Object
     */
    _generate_tree(path, flat_tree = {}, top_level = true) {
        let tree = {};
        let reference = this;

        // Ensure path has a trailing slash for recursion & store current path in each layer
        path = DirectoryWatcher._ensure_trailing_slash(path);
        tree[this.#path_prefix] = path;

        // Asynchronously read directory to process into a tree
        return new Promise((resolve, reject) => {
            FileSystem.readdir(
                path,
                {
                    encoding: 'utf8',
                    withFileTypes: true,
                },
                async (error, files) => {
                    // Reject any errors
                    if (error) return reject(error);

                    // Asynchronously process each file
                    await async_for_each(files, async (file, next) => {
                        let file_name = file.name;

                        // Recursively generate further directory tree for directories
                        if (file.isDirectory()) {
                            // Filter directories based on ignore_directories
                            let filter_items = reference.#ignore_directories;
                            let should_filter = filter_items.length > 0;
                            let filter_check = !should_filter
                                ? true
                                : !filter_items.includes(file_name);

                            if (filter_check) {
                                let subpath = path + file_name;
                                let subtree = await reference._generate_tree(
                                    subpath,
                                    flat_tree,
                                    false
                                );

                                flat_tree[subpath] = 'directory:' + file_name;
                                tree[file_name] = subtree;
                            }
                        }

                        // Store files in tree by matching against extensions
                        if (file.isFile()) {
                            // Filter based on extensions if specified
                            let file_extensions = reference.#extensions;
                            let should_check = file_extensions.length > 0;
                            let extension_check = !should_check
                                ? true
                                : file_extensions.filter((n) =>
                                      file_name.endsWith(n)
                                  ).length > 0;

                            if (extension_check) {
                                // Filter files based on ignore_files
                                let filter_items = reference.#ignore_files;
                                let should_filter = filter_items.length > 0;
                                let filter_check = !should_filter
                                    ? true
                                    : !filter_items.includes(file_name);

                                // Add file to tree if it passes extension and filter check
                                if (filter_check) {
                                    tree[file_name] = path + file_name;
                                    flat_tree[tree[file_name]] =
                                        'file:' + file_name;
                                }
                            }
                        }

                        next();
                    });

                    return resolve(
                        top_level
                            ? {
                                  normal: tree,
                                  flat: flat_tree,
                              }
                            : tree
                    );
                }
            );
        });
    }

    /**
     * INTERNAL METHOD!
     * This method recalibrates DirectoryWatcher tree hierarchy and add/removes directories/files from tree structure.
     *
     * @param {Object} tree Optional
     */
    async _recalibrate_tree(tree) {
        // Generate initial tree if none provided through recursion
        let reference = this;
        if (tree == undefined)
            tree = await this._generate_tree(this.#root_path);

        // Parse current flat tree keys to iterate over
        let current_tree = this.#tree;
        let current_keys = Object.keys(current_tree.flat);

        // Emit folder_remove and file_remove events by comparing old flat tree against new flat tree
        await throttled_for_each(current_keys, 100, (path) => {
            // Check if current path does not exist in new flat tree
            if (tree.flat[path] == undefined) {
                // Emit directory_remove event if current key is a directory type
                if (current_tree.flat[path].startsWith('directory:')) {
                    reference._unwatch(path); // Unwatch existing directory watcher
                    reference.#handlers.directory_remove(path);
                }

                // Emit file_remove event if current key is a file type
                if (current_tree.flat[path].startsWith('file:'))
                    reference.#handlers.file_remove(path);
            }
        });

        // Emit folder_add and file_add events by comparing old flat tree against new flat tree
        let new_keys = Object.keys(tree.flat);
        await throttled_for_each(new_keys, 100, (path) => {
            // Check if current path does not exist in old flat tree
            if (current_tree.flat[path] == undefined) {
                // Emit directory_add event if current key is a directory type
                if (tree.flat[path].startsWith('directory:')) {
                    reference._watch(path); // Create a watcher for subdirectory
                    reference.#handlers.directory_add(path);
                }

                // Emit file_add event if current key is a file type
                if (tree.flat[path].startsWith('file:'))
                    reference.#handlers.file_add(path);
            }
        });

        // Overwrite old tree
        this.#tree = tree;
    }

    /* DirectoryWatcher Getters */
    get root() {
        return this.#root_path;
    }

    get tree() {
        return this.#tree;
    }

    get path_prefix() {
        return this.#path_prefix;
    }

    get watcher_delay() {
        return this.#watcher_delay;
    }
}

module.exports = DirectoryWatcher;
