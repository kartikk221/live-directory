const Crypto = require('crypto');
const Chokidar = require('chokidar');
const FileSystem = require('fs/promises');
const LiveDirectory = require('../index.js');
const { resolve_path, forward_slashes } = require('../src/shared/operators.js');

function log(logger = 'SYSTEM', message) {
    let dt = new Date();
    let timeStamp = dt.toLocaleString([], { hour12: true, timeZone: 'America/New_York' }).replace(', ', ' ').split(' ');
    timeStamp[1] += ':' + dt.getMilliseconds().toString().padStart(3, '0') + 'ms';
    timeStamp = timeStamp.join(' ');
    console.log(`[${timeStamp}][${logger}] ${message}`);
}

async function assert_log(group, target, assertion) {
    try {
        if ((await assertion()) === true) {
            log(group, 'Verified ' + target);
        } else {
            throw new Error('ASSERTION_FAILED');
        }
    } catch (error) {
        console.error(error);
        throw new Error('Failed To Verify ' + target + ' @ ' + group + ' -> ' + assertion.toString());
    }
}

const RootPath = forward_slashes(resolve_path(`${__dirname}/root`));

/**
 * Tests the instance of the LiveDirectory class
 * @param {LiveDirectory.LiveDirectoryOptions} options
 */
async function test_instance(options) {
    // Create a new instance of the LiveDirectory class
    const group = 'LiveDirectory';
    const instance = new LiveDirectory(RootPath, options);
    log(
        group,
        'Testing LiveDirectory with options: ' +
            JSON.stringify(options, (_, value) => (typeof value === 'function' ? value.toString() : value), 2)
    );

    // Track the add event files
    const added = new Map();
    instance.on('add', (path, stats) => added.set(path, stats));

    // Wait for the instance to be ready
    await new Promise((resolve) => instance.once('ready', resolve));

    // Assert the max file count of the cache works if enabled
    if (options?.cache?.max_file_count)
        await assert_log(
            group,
            'options.cache.max_file_count parameter',
            () => instance.cached.size <= options.cache.max_file_count
        );

    // Assert the max file size of the cache works if enabled
    if (options?.cache?.max_file_size)
        await assert_log(group, 'options.cache.max_file_size parameter', () => {
            for (const [path, file] of instance.files) {
                if (file.cached && file.stats.size > options.cache.max_file_size) return false;
            }
            return true;
        });

    // Assert that no ignored files exist in the files map
    const ignored = new Map();
    if (options?.filter?.ignore)
        await assert_log(group, 'options.filter.ignore parameter', () => {
            let raw, names, extensions;
            if (typeof options.filter.ignore === 'function') {
                raw = options.filter.ignore;
            } else {
                names = options.filter.ignore.names;
                extensions = options.filter.ignore.extensions;
            }

            for (const [path, file] of instance.files) {
                const name = path.split('/').pop();
                const extension = name.split('.').pop();
                const a = raw && raw(path, file.stats);
                const b = names && names.includes(name);
                const c = extensions && extensions.includes(extension);
                if (a || b || c) {
                    ignored.set(path, true);
                    return false;
                }
            }
            return true;
        });

    // Assert that only keep files exist in the files map
    let only;
    if (options?.filter?.keep) {
        only = new Map();
        await assert_log(group, 'options.filter.keep parameter', () => {
            let raw, names, extensions;
            if (typeof options.filter.keep === 'function') {
                raw = options.filter.keep;
            } else {
                names = options.filter.keep.names;
                extensions = options.filter.keep.extensions;
            }

            for (const [path, file] of instance.files) {
                const name = path.split('/').pop();
                const extension = name.split('.').pop();
                const a = raw && raw(path, file.stats);
                const b = names && names.includes(name);
                const c = extensions && extensions.includes(extension);
                if (!a && !b && !c) return false;
                only.set(path, true);
            }
            return true;
        });
    }

    // Assert the 'path' property
    await assert_log(group, '.path property', () => instance.path === RootPath);

    // Assert the 'static' property
    await assert_log(group, '.static property', () => instance.static === options.static);

    // Assert the 'watcher' property
    await assert_log(group, '.watcher property', () => (instance.static ? !instance.watcher : !!instance.watcher));

    // Assert that all files are in the files map
    await assert_log(group, '.files property', async () => {
        // Load expected files
        const expected = new Map();
        await new Promise((resolve) =>
            Chokidar.watch(RootPath)
                .on('add', (path) => {
                    path = forward_slashes(path).replace(RootPath, '');
                    if (!ignored.has(path)) expected.set(path, true);
                })
                .once('ready', resolve)
        );

        // Assert only expected and allowed files are in the files map
        for (const [path, file] of instance.files) {
            if (!expected.has(path) || (only && !only.has(path))) return false;
        }

        // Assert all expected files are in the files map
        for (const [path] of expected) {
            if (!instance.get(path) && !ignored.has(path) && (!only || only.has(path))) return false;
        }

        return true;
    });

    // Assert that all cached files are also in the cached map
    await assert_log(group, '.cached property', async () => {
        for (const [relative_path, file] of instance.files) {
            // Only check cached files
            if (file.cached) {
                // Assert the file is in the cached map
                if (!instance.cached.has(relative_path)) return false;

                // Ensure the in-memory content matches the file content
                const raw = await FileSystem.readFile(file.path);
                if (!file?.content?.equals?.(raw)) return false;
            }
        }
        return true;
    });

    // Test emitted events if instance is not static
    if (!instance.static) {
        // Create a random file in the root directory
        const random_path = instance.files.values().next().value.path;
        const random_content = Crypto.randomBytes(10).toString('hex');
        log(group, `Testing Events With File @ ${random_path}`);

        // Test the 'add' event listener
        await assert_log(group, 'properly emit "add" events', async () => {
            // Create the random file and wait for the 'update' event
            const file = instance.get(random_path);
            await Promise.all([
                new Promise((resolve) => file.once('update', resolve)),
                FileSystem.writeFile(random_path, random_content),
            ]);

            // Assert all added files are in the live directory
            for (const [path] of instance.files) {
                if (!added.has(path)) return false;
            }

            // Assert that the content of the random file matches the content of the file in the live directory
            const random_file = instance.get(random_path);
            if (random_file.content === random_content) return false;

            return true;
        });

        // Test the 'update' event listener
        const random_content_2 = Crypto.randomBytes(10).toString('hex');
        await assert_log(group, 'properly emit "update" events', async () => {
            // Update the random file and wait for the 'update' event
            const file = instance.get(random_path);
            await Promise.all([
                new Promise((resolve) => file.once('update', resolve)),
                FileSystem.writeFile(random_path, random_content_2),
            ]);

            // Assert that the content of the random file matches the content of the file in the live directory
            const random_file = instance.get(random_path);
            if (random_file.content === random_content_2) return false;

            return true;
        });

        // Test the 'delete' event listener
        await assert_log(group, 'properly emit "delete" events', async () => {
            // Delete the random file and wait for the 'delete' event
            const [deleted] = await Promise.all([
                new Promise((resolve) => instance.once('delete', (path) => resolve(random_path.endsWith(path)))),
                FileSystem.unlink(random_path),
            ]);
            return deleted;
        });

        // Create the random file again for future tests
        await FileSystem.writeFile(random_path, random_content);
    }

    // Print new lines
    log(group, 'Successfully finished tested LiveDirectory instance.\n');
}

(async () => {
    // Test the instance with static mode enabled
    await test_instance({
        static: true,
        cache: {
            max_file_count: 2,
            max_file_size: 100,
        },
        filter: {
            ignore: {
                names: ['file4.js'],
                extensions: ['html'],
            },
            keep: {
                extensions: ['js'],
            },
        },
    });

    // Test the instance with symbolic links
    await test_instance({
        static: true,
        follow_symbolic_link: true,
        cache: {
            max_file_count: 5,
            max_file_size: 100,
        },
        filter: {
            ignore: {
                names: ['file3.js'],
                extensions: ['html'],
            },
            keep: {
                extensions: ['js'],
            },
        },
    });

    // Test the instance with static mode disabled
    await test_instance({
        static: false,
        cache: {
            max_file_count: 4,
            max_file_size: 50,
        },
        filter: {
            ignore: (path, stats) => path.endsWith('.js'), // Ignore all .js files
            keep: (path, stats) => path.endsWith('.html'), // Keep all .html files
        },
    });

    // Exit the process
    process.exit(0);
})();
