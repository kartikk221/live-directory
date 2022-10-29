# LiveDirectory: Dynamic File Content Manager

<div align="left">

[![NPM version](https://img.shields.io/npm/v/live-directory.svg?style=flat)](https://www.npmjs.com/package/live-directory)
[![NPM downloads](https://img.shields.io/npm/dm/live-directory.svg?style=flat)](https://www.npmjs.com/package/live-directory)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/kartikk221/live-directory.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kartikk221/live-directory/context:javascript)
[![GitHub issues](https://img.shields.io/github/issues/kartikk221/live-directory)](https://github.com/kartikk221/live-directory/issues)
[![GitHub stars](https://img.shields.io/github/stars/kartikk221/live-directory)](https://github.com/kartikk221/live-directory/stargazers)
[![GitHub license](https://img.shields.io/github/license/kartikk221/live-directory)](https://github.com/kartikk221/live-directory/blob/master/LICENSE)

</div>

## Motivation
Implementing your own template/file management system which consistently reads/updates file content can be tedious. LiveDirectory aims to solve that by acting as an automated file content store making a directory truly come alive. Powered by the efficient file watching library chokidar, LiveDirectory can be an efficient solution for fast and iterative web development.

## Features
- Simple-to-use API
- Sub-Directory Support
- Asynchronous By Nature
- Instantaneous Hot Reloading
- Memory Efficient
- Supports Windows, Linux & MacOS

## Installation
LiveDirectory can be installed using node package manager (`npm`)
```
npm i live-directory
```

## Table Of Contents
- [LiveDirectory: Dynamic File Content Manager](#livedirectory-dynamic-file-content-manager)
  - [Motivation](#motivation)
  - [Features](#features)
  - [Installation](#installation)
  - [Table Of Contents](#table-of-contents)
  - [Examples](#examples)
      - [Serving a basic HTML page](#serving-a-basic-html-page)
      - [Customized Dashboard User Page With Compiled Renderer](#customized-dashboard-user-page-with-compiled-renderer)
  - [LiveDirectory](#livedirectory)
      - [Constructor Options](#constructor-options)
      - [LiveDirectory Properties](#livedirectory-properties)
      - [LiveDirectory Methods](#livedirectory-methods)
  - [LiveFile](#livefile)
      - [LiveFile Properties](#livefile-properties)
      - [LiveFile Methods](#livefile-methods)
  - [License](#license)

## Examples
Below are varios examples that make use of most classes and methods in LiveDirectory. The [`micromustache`](https://www.npmjs.com/package/micromustache) template renderer is used in the examples below but you can use any other renderer/framework.

#### Serving a basic HTML page
```javascript
const LiveDirectory = require('live-directory');

// Create LiveDirectory instance
const live_templates = new LiveDirectory({
    path: './templates/html'
});

// Create server route for dashboard user page
some_server.get('/dashboard/user', (request, response) => {
    // Some processing done here which generates some user_options for rendering page uniquely

    // Retrieve template LiveFile instance
    // Below relative path is translated under the hood to './templates/html/dashboard/user.html'
    let template = live_templates.get('/dashboard/user.html');

    // Send html string as response body
    return response.type('html').send(template.content);
});
```

#### Customized Dashboard User Page With Compiled Renderer
```javascript
const MicroMustache = require('micromustache');
const LiveDirectory = require('live-directory');

// Create LiveDirectory instance
const live_templates = new LiveDirectory({
    path: './templates/html'
});

// Handle 'reload' event from LiveDirectory so we can re-generate a new compiled micromustache instance on each file content update
live_templates.on('file_reload', (file) => {
    // We can attach our own properties to the LiveFile object
    // Using this, we can recompile a micromustache renderer and attach onto LiveFile
    const compiled = MicroMustache.compile(file.content);
    compiled_templates[file.path].render = compiled.render;
});

// Create server route for dashboard user page
some_server.get('/dashboard/user', (request, response) => {
    // Some processing done here which generates some user_options for rendering page uniquely

    // Retrieve template LiveFile instance
    // Below relative path is translated under the hood to './templates/html/dashboard/user.html'
    let template = live_templates.get('/dashboard/user.html');

    // Generate rendered template code
    let html = template.render(user_options);

    // Send rendered html code in response
    return response.type('html').send(html);
});
```

## LiveDirectory
Below is a breakdown of the `LiveDirectory` class generated when creating a new LiveDirectory instance.

#### Constructor Options
* `path` [`String`]: Path to the directory.
  * **Example**: `./templates/`
  * **Required** for a LiveDirectory Instance.
* `keep` [`Object`|`Function`]: Whitelist filter that can either be an object or a function.
  * **Object Schema**:
    * `names` [`Array`]: List of file names to keep.
    * `extensions` [`Array`]: List of file extensions to keep.
  * **Function Schema**: `(String: path, FS.stats: stats) => { /* Return true to keep */}`
  * **Note!** If you provide your own function, the first execution will be without the `stats` parameter and the second will be with the `stats` parameter.
  * **Note!** the `keep` filter is like a whitelist and is applied **before** the `ignore` filter.
* `ignore` [`Object`|`Function`]: Blacklist filter that can either be an object or a function.
  * **Object Schema**:
    * `names` [`Array`]: List of file/directory names to ignore.
    * `extensions` [`Array`]: List of file extensions to ignore.
  * **Function Schema**: `(String: path, FS.stats: stats) => { /* Return true to ignore */}`
  * **Note!** If you provide your own function, the first execution will be without the `stats` parameter and the second will be with the `stats` parameter.
  * **Note!** the `ignore` filter is like a global blacklist and thus is applied after the `keep` filter.
* `retry` [`Object`]: File content reading retry policy.
  * `every` [`Number`]: Delay between retries in **milliseconds**.
  * `max` [`Number`]: Maximum number of retries.
* `hot_reload` [`boolean`]: Whether to listen for files changes or not. Defaults to `true`.

#### LiveDirectory Properties
| Property  | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `path` | `String` | Root directory path. |
| `watcher` | `FS.Watcher` | Underlying Chokidar watcher instance. |
| `tree` | `Object` | Directory tree with heirarchy. |
| `files` | `Object` | All loaded files with their relative paths. |

#### LiveDirectory Methods
* `ready()`: Returns a `Promise` which is then resolved once instance is fully ready.
* `get(String: path)`: Returns [`LiveFile`](#livefile) instance for file at specified path.
  * **Returns** a [`LiveFile`](#livefile) instance or `undefined`
  * **Supported Formats**: When root path is `/root/var/www/webserver/templates`.
    * **System Path**: `/root/var/www/webserver/templates/dashboard/index.html`
    * **Relative Path**: `/dashboard/index.html`
    * **Simple Path**: `dashboard/index.html`
* `on(String: type, Function: handler)`: Binds a handler for `LiveDirectory` events.
  * Event `'directory_create'`: Reports newly created directories.
    * `handler`: `(String: path) => {}`
  * Event `'directory_destroy'`: Reports when a directory is deleted.
    * `handler`: `(String: path) => {}`
  * Event `'file_reload'`: Reports when a file is created/is reloaded.
    * `handler`: `(LiveFile: file) => {}`
    * See [`LiveFile`](#livefile) documentation for available properties and methods.
  * Event `'file_destroy'`: Reports when a file is destroyed.
    * `handler`: `(LiveFile: file) => {}`
    * See [`LiveFile`](#livefile) documentation for available properties and methods.
  * Event `'file_error'`: Reports FileSystem errors for a file.
    * `handler`: `(LiveFile: file, Error: error) => {}`
    * See [`LiveFile`](#livefile) documentation for available properties and methods.
  * Event `'error'`: Reports `LiveDirectory` instance errors.
    * `handler`: `(Error: error) => {}`

## LiveFile
Below is a breakdown of the `LiveFile` instance class that represents all files.

#### LiveFile Properties
| Property  | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `path` | `String` | System file path. |
| `name` | `String` | File name. |
| `extension` | `String` | File extension. |
| `etag` | `String` | Unique etag compatible file hash. |
| `content` | `String` | File text content. |
| `buffer` | `Buffer` | File raw content. |
| `last_update` | `Number` | Last file text content update timestamp in **milliseconds** |

#### LiveFile Methods
* `ready()`: Returns a `Promise` which is resolved once file is ready with initial content.
* `reload()`: Returns a `Promise` which is resolved once the File's content is reloaded.

## License
[MIT](./LICENSE)