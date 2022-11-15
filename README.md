# LiveDirectory: High Performance File Content Manager

<div align="left">

[![NPM version](https://img.shields.io/npm/v/live-directory.svg?style=flat)](https://www.npmjs.com/package/live-directory)
[![NPM downloads](https://img.shields.io/npm/dm/live-directory.svg?style=flat)](https://www.npmjs.com/package/live-directory)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/kartikk221/live-directory.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/kartikk221/live-directory/context:javascript)
[![GitHub issues](https://img.shields.io/github/issues/kartikk221/live-directory)](https://github.com/kartikk221/live-directory/issues)
[![GitHub stars](https://img.shields.io/github/stars/kartikk221/live-directory)](https://github.com/kartikk221/live-directory/stargazers)
[![GitHub license](https://img.shields.io/github/license/kartikk221/live-directory)](https://github.com/kartikk221/live-directory/blob/master/LICENSE)

</div>

## Motivation
Implementing your own template / file management system which consistently reads and updates file content can be tedious. LiveDirectory aims to solve that by acting as an automated file content store making a directory truly come alive. Powered by the efficient file watching library chokidar, LiveDirectory can be an efficient solution for fast and iterative web development.

## Features
- Etag Support
- Memory Efficient
- Simple-to-use API
- Sub-Directory Support
- Asynchronous By Nature
- Instantaneous Hot Reloading
- Supports Windows, Linux & MacOS

## Documentation
LiveDirectory can be installed using Node Package Manager (`npm`).
```
npm i live-directory
```

- See [`> [Examples & Snippets]`](./docs/Examples.md) for small and **easy-to-use snippets** with LiveDirectory.
- See [`> [LiveDirectory]`](./docs/LiveDirectory.md) for creating and working with the **LiveDirectory** component.
- See [`> [LiveFile]`](./docs/LiveFile.md) for working with loaded **files** from live directory instances.

## Testing Changes
To run LiveDirectory functionality tests locally on your machine, you must follow the steps below.
1. Clone the LiveDirectory repository to your machine.
3. Run `npm install` in the root directory.
5. Run `npm test` to run all tests with your local changes.

## License
[MIT](./LICENSE)