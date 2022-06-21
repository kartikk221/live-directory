import type { FSWatcher } from 'chokidar';
import type { Matcher } from 'anymatch';
import type { EventEmitter } from 'events';

export interface Filter {
    names?: string[];
    extensions?: string[];
}

export interface LiveDirectoryOptions {
    path: string;
    keep: Filter | Matcher;
    ignore: Filter | Matcher;
}

export default class LiveDirectory extends EventEmitter {
    constructor(options: Partial<LiveDirectoryOptions>);

    ready(): Promise<void>;
    get(name: string): LiveFile | undefined;

    get path(): string;
    get watcher(): FSWatcher;
    get tree(): DirectoryTree;
    get files(): Record<string, unknown>;
}
