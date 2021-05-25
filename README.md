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
Implementing your own template management system which consistently reads/updates template content can be tedious. LiveDirectory aims to solve that by acting as an automated file content store making a directory truly come alive. Built solely on the Node.js FileWatcher API with no external dependencies, LiveDirectory can be an efficient solution for fast and iterative web development.

## Features
- Simple-to-use API
- Sub-Directory Support
- Asynchronous By Nature
- Custom Renderer Support
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
      - [Customized Dashboard User Page](#customized-dashboard-user-page)
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

#### Customized Dashboard User Page
```javascript
const MicroMustache = require('micromustache');
const LiveDirectory = require('live-directory');

// Create LiveDirectory instance
const live_templates = new LiveDirectory({
    root_path: './templates/html'
});

// Set default renderer which will render files using MicroMustache.render method
live_templates.set_default_renderer((path, content, options) => {
    return MicroMustache.render(content, options);
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
    return response.send(html);
});
```

#### Customized Dashboard User Page With Compiled Renderer
```javascript
const MicroMustache = require('micromustache');
const LiveDirectory = require('live-directory');

// Create LiveDirectory instance
const live_templates = new LiveDirectory({
    root_path: './templates/html'
});

// Store compiled micromustache template instances in this object
const compiled_templates = {};

// Handle 'reload' event from LiveDirectory so we can re-generate a new compiled micromustache instance on each file content update
live_templates.handle('reload', (file) => {
    // Generate a compiled micromustache template instance
    let compiled = MicroMustache.compile(file.content);

    // Store compiled micromustache template instance in compiled_templates identified by file path
    compiled_templates[file.path] = compiled;
});

// Set default renderer which will render files using compiled micromustache instance
live_templates.set_default_renderer((path, content, options) => {
    // use || operator as a fallback in the scenario compiled is not available for whatever reason
    return (compiled_templates[path] || MicroMustache).render(options);
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
    return response.send(html);
});
```

## LiveDirectory
Below is a breakdown of the `LiveDirectory` class generated when creating a new LiveDirectory instance.

#### Constructor Options
* `root_path` [`String`]: Path to the directory.
  * **Example**: `./templates/`
  * **Required** for a LiveDirectory Instance.
* `file_extensions` [`Array`]: Which file extensions to load.
  * **Example**: `['.html', '.css', '.js']`
  * **Default**: `[]`
  * **Note**: Setting this parameter to `[]` will enable all files with any extension.
* `ignore_files` [`Array`]: Specific file names to ignore.
  * **Example**: `['secret.js']`
  * **Default**: `[]`
* `ignore_directories` [`Array`]: Specific directory names to ignore.
  * **Example**: `['.git', 'private']`
  * **Default**: `[]`
* `watcher_delay` [`Number`]: Specify delay between processing new FileWatcher events in **milliseconds**.
  * **Default**: `250`

#### LiveDirectory Properties
| Property  | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `files` | `Object` | Currently loaded `LiveFile` instances. |
| `tree` | `Object` | Underlying root directory hierarchy tree. |
| `path_prefix` | `String` | Path prefix for path property key in hierarchy tree. |

#### LiveDirectory Methods
* `get(String: relative_path)`: Returns [`LiveFile`](#livefile) instance for file at specified relative path.
  * **Returns** a [`LiveFile`](#livefile) instance or `undefined`
  * **Note** a relative path must start with `/` as the root which is then translated automatically into the raw system path.
* `set_default_renderer(Function: renderer)`: Sets default renderer method for all files in current instance.
  * **Handler Example**: `(String: path, String: content, Object: options) => {}`
    * `path`: System path of file being rendered.
    * `content`: File content as a string type.
    * `options`: Parameter options from `render(options)` method.
* `handle(String: type, Function: handler)`: Binds a handler for `LiveDirectory` events.
  * Event `'error'`: Reports framework errors.
    * `handler`: `(String: path, Error: error) => {}`
  * Event `'reload'`: Reports file content reloads and can be useful for doing post processing on new file content.
    * `handler`: `(LiveFile: file) => {}`
    * See [`LiveFile`](#livefile) documentation for available properties and methods.

## LiveFile
Below is a breakdown of the `LiveFile` instance class that represents all files.

#### LiveFile Properties
| Property  | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `path` | `String` | System file path. |
| `content` | `String` | File text content. |
| `last_update` | `Number` | Last file text content update timestamp in **milliseconds** |

#### LiveFile Methods
* `set_content(String: content)`: Overwrites/Sets file content. Useful for writing processed file content from `reload` events.
* `set_renderer(Function: renderer)`: Sets renderer method. Useful for setting custom renderer method from compiled template render instances.
  * **Renderer Example**: `(String: path, String: content, Object: options) => {}`
* `render(Object: options)`: Renders file content by calling renderer with provided options parameter.
  * **Default**: `{}`

## License
[MIT](./LICENSE)