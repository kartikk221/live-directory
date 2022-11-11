import { Stats } from 'fs';
import { Readable } from 'stream';
import EventEmitter from 'events';

export default class LiveFile extends EventEmitter {
    constructor(path: string);

    /**
     * Reloads the file stats and content from the file system.
     * @param stats 
     * @param cache 
     */
    async reload(stats?: Stats, cache = false): Promise<LiveFile>;

    
    /**
     * Returns the file system path.
     */
    get path(): string;

    /**
     * Returns the file's system stats.
     */
    get stats(): Stats;

    /**
     * Returns a unique ETag for the file.
     */
    get etag(): string;

    /**
     * Returns the file's content as a cached Buffer or ReadableStream.
     */
    get content(): Buffer | Readable;

    /**
     * Whether this file is cached in memory or not.
     */
    get cached(): boolean;
}