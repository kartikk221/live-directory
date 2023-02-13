import { Stats, BufferEncodingOption } from 'fs';
import { Readable, ReadableOptions } from 'stream';
import EventEmitter from 'events';

declare class LiveFile extends EventEmitter {
    constructor(path: string);

    /**
     * Reloads the file stats and content from the file system.
     * @param stats
     * @param cache
     */
    reload(stats?: Stats, cache?: boolean): Promise<LiveFile>;

    /**
     * Returns a Readable stream of the file's content.
     * @param options
     */
    stream(options?: BufferEncodingOption | ReadableOptions): Readable;

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
    get content(): Buffer;

    /**
     * Whether this file is cached in memory or not.
     */
    get cached(): boolean;
}

export = LiveFile;