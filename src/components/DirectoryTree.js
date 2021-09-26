const LiveFile = require('./LiveFile.js');

class DirectoryTree {
    #structure = {};
    #files = {};

    constructor() {}

    /**
     * @private
     * Traverses and fills missing branches along tree structure.
     * Executes callback with focus branch and descriptor once traversing has completed.
     *
     * @param {String} path
     * @param {function(Object,String):void} callback
     */
    _traverse(path, callback) {
        // Break path into chunks and proceed if sufficient chunks are available
        const chunks = path.split('/').filter((c) => c.length > 0);
        if (chunks.length == 0) return;

        let cursor = this.#structure;
        for (let i = 0; i < chunks.length; i++) {
            let current = chunks[i];
            if (i !== chunks.length - 1) {
                // Fill missing branch if it does not exist
                if (cursor[current] == undefined) break;
                cursor = cursor[current];
            } else {
                callback(cursor, current);
            }
        }
    }

    /**
     * Adds provided livefile to tree
     *
     * @param {String} path
     * @param {LiveFile} file
     */
    add(path, file) {
        const reference = this;
        this._traverse(path, (branch, descriptor) => {
            branch[descriptor] = file;
            if (file instanceof LiveFile) reference.#files[path] = file;
        });
    }

    /**
     * Removes directory/file at provided path
     *
     * @param {String} path
     */
    remove(path) {
        delete this.#files[path];
        this._traverse(path, (branch, descriptor) => {
            delete branch[descriptor];
        });
    }

    /* DirectoryTree Getters */
    get structure() {
        return this.#structure;
    }

    get files() {
        return this.#files;
    }
}

module.exports = DirectoryTree;
