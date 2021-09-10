const FileSystem = require('fs');

class LiveFile {
    #path;
    #extension = '';
    #buffer;
    #content;
    #watcher;
    #watcher_delay;
    #last_update;
    #renderer;
    #handlers = {
        reload: (content) => {},
        error: (error) => {},
    };

    constructor({ path, watcher_delay, renderer }) {
        this.#path = path;
        const path_chunks = this.#path.split('.');

        this.#extension = path_chunks[path_chunks.length - 1];
        this.#watcher_delay = watcher_delay;
        this.#last_update = Date.now() - watcher_delay;
        this.#renderer = renderer;

        this._init_watcher();
        this._reload_content();
    }

    /**
     * This method can be used to set/update the render function for current live file.
     *
     * @param {Function} renderer
     */
    set_renderer(renderer) {
        if (typeof renderer !== 'function')
            throw new Error(
                'set_renderer(renderer) -> renderer must be a Function -> (content, options) => {}'
            );

        this.#renderer = renderer;
    }

    /**
     * This method can be used to render content by passing in appropriate options to the renderer.
     *
     * @param {Object} options
     * @returns {String} String - Rendered Content
     */
    render(options = {}) {
        return this.#renderer(this.#path, this.#content, options);
    }

    /**
     * INTERNAL METHOD
     * Binds handler for specified type event.
     *
     * @param {String} type
     * @param {Function} handler
     */
    _handle(type, handler) {
        if (this.#handlers[type] == undefined)
            throw new Error(`${type} event is not supported on LiveFile.`);

        this.#handlers[type] = handler;
    }

    /**
     * INTERNAL METHOD!
     * This method performs a check against last_update timestamp
     * to ensure sufficient time has passed since last watcher update.
     *
     * @param {Boolean} touch
     * @returns {Boolean} Boolean
     */
    _delay_check(touch = true) {
        let last_update = this.#last_update;
        let watcher_delay = this.#watcher_delay;
        let result = Date.now() - last_update > watcher_delay;
        if (result && touch) this.#last_update = Date.now();
        return result;
    }

    /**
     * INTERNAL METHOD!
     * This method initiates the FileWatcher used for current live file.
     */
    _init_watcher() {
        let reference = this;

        // Create FileWatcher For File
        this.#watcher = FileSystem.watch(this.#path, (event, file_name) => {
            if (reference._delay_check()) reference._reload_content();
        });

        // Bind FSWatcher Error Handler To Prevent Execution Halt
        this.#watcher.on('error', (error) => this.#handlers.error(error));
    }

    /**
     * INTERNAL METHOD!
     * This method reads/updates content for current live file.
     */
    _reload_content() {
        let reference = this;
        FileSystem.readFile(this.#path, (error, buffer) => {
            // Report error through error handler
            if (error) return reference.#handlers.error(error);

            // Update content and trigger reload event
            reference.#buffer = buffer;
            reference.#content = buffer.toString();
            reference.#handlers.reload(content);
        });
    }

    /**
     * INTERNAL METHOD!
     * This method can be used to destroy current live file and its watcher.
     */
    _destroy() {
        this.#watcher.close();
        this.#content = '';
        this.#buffer = Buffer.from('');
    }

    /* LiveFile Getters */
    get path() {
        return this.#path;
    }

    get extension() {
        return this.#extension;
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
