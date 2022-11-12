import LiveFile from './LiveFile';
import { Stats } from 'fs';
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

export default class LiveDirectory extends EventEmitter {
    constructor(path: string, options?: LiveDirectoryOptions): LiveDirectory;

    /**
     * Returns the live file at the provided path if it exists.
     * @param path
     */
    get(path: string): LiveFile | undefined;

    /**
     * Destroys this instance.
     */
    destory(): void;

    /**
     * Returns the root directory system path.
     */
    get path(): string;

    /**
     * Whether this instance will watch and reload on changes.
     */
    get static(): boolean;

    /**
     * Returns the chokidar watcher.
     */
    get watcher(): FSWatcher | undefined;

    /**
     * Returns a map of all files identified by their relative path to the root path.
     */
    get files(): Map<string, LiveFile>;

    /**
     * Returns a map of all cached files identified by their relative path to the last update timestamp.
     */
    get cached(): Map<string, number>;
}
