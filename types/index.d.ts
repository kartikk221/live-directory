import { Stats } from 'fs';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import { FSWatcher, WatchOptions } from 'chokidar';

type FilterFunction = (path: string, stats: Stats) => boolean;
interface FilterProperties {
    names?: string[];
    extensions?: string[];
}

interface LiveDirectoryOptions {
    static?: boolean;
    watcher?: WatchOptions;
    cache?: {
        max_file_count?: number;
        max_file_size?: number;
    };
    filter?: {
        keep?: FilterFunction | FilterProperties;
        ignore?: FilterFunction | FilterProperties;
    };
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
     * Returns the file information for the provided relative path if it exists.
     * @param path
     */
    info(path: string): FileStats | undefined;

    /**
     * Returns the file content for the provided relative path.
     * @param path
     */
    content(path: string): Buffer | Readable | undefined;

    /**
     * Destroys this instance.
     */
    destory(): void;

    /**
     * Returns the root path.
     */
    get path(): string;

    /**
     * Whether this instance will watch and reload on changes.
     */
    get static(): boolean;

    /**
     * Returns the chokidar watcher.
     */
    get watcher(): FSWatcher;

    /**
     * Returns a map of all files identified by their relative path to the root path.
     */
    get files(): Map<string, FileStats>;

    /**
     * Returns a map of all cached files identified by their relative path to the last update timestamp.
     */
    get cached(): Map<string, number>;
}
