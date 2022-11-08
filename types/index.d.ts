import { Stats } from 'fs';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import { FSWatcher, WatchOptions } from 'chokidar';

interface LiveDirectoryOptions {
    static?: boolean;
    cache?: {
        max_file_count?: number;
        max_file_size?: number;
    };
    watcher?: WatchOptions;
}

interface FileStats {
    path: string;
    etag: string;
    stats: Stats;
    cached: boolean;
    _content?: Buffer | Readable;
}

export default class LiveDirectory extends EventEmitter {
    constructor(path: string, options?: LiveDirectoryOptions): LiveDirectory;

    /**
     * Returns the file stats for the provided relative path.
     * @param path
     */
    file(path: string): FileStats | undefined;

    /**
     * Returns the file content for the provided relative path.
     * @param path
     */
    content(path: string): Buffer | Readable | undefined;

    /**
     * Destroys this instance.
     */
    destory() {}

    /**
     * Returns the root path.
     */
    get path(): string;

    /**
     * Whether this instance will watch and reload on changes.
     */
    get static(): boolean;

    /**
     * Returns a map of all files identified by their relative path to the root path.
     */
    get files(): Map<string, FileStats>;

    /**
     * Returns a map of all cached files identified by their absolute path.
     */
    get cached(): Map<string, boolean>;

    /**
     * Returns the chokidar watcher.
     */
    get watcher(): FSWatcher;
}
