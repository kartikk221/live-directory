# LiveFile
Below is a breakdown of the `LiveFile` component which is an extended `EventEmitter` instance for events support.
* See [`> [EventEmitter]`](https://nodejs.org/api/events.html#class-eventemitter) for more information on additional methods and properties available.

### Live Directory Instance Properties
| Property  | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `path` | `String` | The system path of this file. |
| `etag` | `String` | The unique E-Tag of this file. |
| `stats` | `fs.Stats` | The filesystem stats of this file. |
| `cached` | `Boolean` | Whether this file is cached in memory or not. |
| `content` | `Buffer OR stream.Readable` | The file content as `Buffer` if cached or `stream.Readable` otherwise. |

### Live Directory Instance Methods
* `reload(fs.Stats?: stats, Boolean?: cache)`: Manually reload and cache new stats/content for this file.
    * **Returns** a `Promise`
* `stream(fs.ReadableStreamOptions?: options)`: Creates a `Readable` stream of the file content.
    * **See** [`> [fs.createReadStream()]`](https://nodejs.org/api/fs.html#filehandlecreatereadstreamoptions) for more information on the `options` object.

### Live Directory Instance Events
* See [`> [EventEmitter]`](https://nodejs.org/api/events.html#class-eventemitter) for how to **subscribe** and listen to the emitted events.
    * **Event** `'update'`: Emitted whenever this file's `stats` and `content` are reloaded upon changes.
