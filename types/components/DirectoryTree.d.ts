export default class DirectoryTree {
    add(path: string, file: LiveFile): void;
    remove(path: string): void;

    get structure(): unknown;
    get file(): unknown;
}