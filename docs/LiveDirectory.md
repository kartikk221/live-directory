# LiveDirectory
Below is a breakdown of the `LiveDirectory` component which is an extended `EventEmitter` instance for events support.
* See [`> [EventEmitter]`](https://nodejs.org/api/events.html#class-eventemitter) for more information on additional methods and properties available.

### Live Directory Constructor Options
* `static` [`Boolean`]: Whether the instance will watch and automatically reload files on changes.
    * **Default**: `false`
* `watcher` [`Chokidar.WatchOptions`]: Watcher constructor options for the `chokidar` instance.
    * See [`> [Chokidar]`](https://www.npmjs.com/package/chokidar) for all available constructor options.
* `cache` [`Object`]: The options for internal caching of file contents.
    * `max_file_count` [`Number`]: The maximum number of files to cache. **Default:** `250`.
    * `max_file_size` [`Number`]: The maximum size of a file to cache in `bytes`. **Default:** `1024 * 1024 aka. 1 mb`.
    * **Note** you can calculate the **maximum** cache memory by multipliying the `count * size` options above.
* `filter` [`Object`]: The options for filtering files.
    * `keep` [`Function | Object`]: The **ONLY** files you would like to include.
    * `ignore` [`Function | Object`]: The files to **ALWAYS** ignore and not include.
    * **Function Example**: `(string, fs.stats) => boolean`.
        * See [`> [fs.Stats]`](https://nodejs.org/api/fs.html#class-fsstats) for all available properties.
        * **Note** you must return a **boolean** of `true` to ignore a value and vice versa.
    * **Object Schema**: You can specify the below properties as an object.
        * `names` [`Array`]: The names of the files to filter.
        * `extensions` [`Array`]: The extensions of the files to filter.

### Live Directory Instance Properties
| Property  | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `path` | `String` | The system path of this instance directory. |
| `static` | `Boolean` | Whether this instance will watch and reload on changes. |
| `watcher` | `Chokidar.FSWatcher` | The underlying chokidar instance. (Only available when not static) |
| `files` | `Map<string, LiveFile>` | Map of all files identified by their relative path. |
| `cached` | `Map<string, number>` | Map of all cached files identified by their relative path and last updated timestamp. |

### Live Directory Instance Methods
* `get(String: path)`: Returns the live file at the provided path if it exists.
    * **Returns** a `LiveFile` instance of `undefined`.
    * **See** [`> [LiveFile]`](../docs/LiveFile.md) for more information on the returned component.
    * **Note** The path can be a relative or absolute.
        * **Examples:** `assets/test.js`, `/assets/test.js`, `C:/projects/something/assets/test.js`, etc etc.
* `destroy()`: Destroys the `LiveDirectory` instance.

### Live Directory Instance Events
* See [`> [EventEmitter]`](https://nodejs.org/api/events.html#class-eventemitter) for how to **subscribe** and listen to the emitted events.
    * **Event** `'ready'`: Emitted once the instance has **loaded** all files from the directory / sub-directories.
    * **Event** `'destroy'`: Emitted once this instance has been destroyed.
    * **Event(s)** `'add', 'update'`: Emitted when a file is created or updated in the directory / sub-directories.
        * **Example Handler**: `(String: path, LiveFile: file) => void`
        * **Note** the `path` will be a relative path and you can view the absolute / system path with `LiveFile.path`.
    * **Event** `'delete'`: Emitted when a file is deleted in the directory / sub-directories.
        * **Example Handler**: `(String: path) => void`
        * **Note** the `path` will be a relative path and you can view the absolute / system path with `LiveFile.path`.
