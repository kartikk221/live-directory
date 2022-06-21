export interface LiveFileOptions {
    path: string;
    retry: {
        every: number;
        max: number;
    }
}

export default class LiveFile {
    constructor(options: Partial<LiveFileOptions>);

    reload(refresh: boolean, count: number): Promise<unknown>;
    ready(): Promise<void>;

    get name(): string;
    get path(): string;
    get extension(): string;
    get etag(): string;
    get content(): string;
    get buffer(): Buffer;
    get last_update(): number;
}
