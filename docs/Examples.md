# Examples & Snippets
Below are various examples and snippets that make use of most components in LiveDirectory.

#### Simple LiveDirectory Implementation
```javascript
const LiveDirectory = require('live-directory');
const LocalFiles = new LiveDirectory('./local', {
    filter: {
        keep: {
            extensions: ['js'] // We only want to load .js files
        }
    }
});

LocalFiles.get('hello.js'); // This will return the LiveFile for "./local/hello.js"
LocalFiles.get('/something/else/file.js'); // This will return the LiveFile for "./local/something/else/file.js"
```

#### Advaned Webserver Assets Serving Endpoint With Caching
```javascript
const LiveDirectory = require('live-directory');
const AssetsDirectory = new LiveDirectory('./assets', {
    static: true, // Set this to true in production so that no files are watched for changes hence more performance efficient
    cache: {
        max_file_count: 200, // 2.5 MB * 200 = 250 MB - This means you won't go over 250 MB of cached memory for your assets 
        max_file_size: 1024 * 1024 * 2.5, // 2.5 MB - Most assets will be under 2.5 MB hence they can be cached
    },
    filter: {
        ignore: {
            names: ['security.json'],
            extensions: ['xml'] // Assume you have sensitive data in xml files hence you do not want them loaded as assets
        }
    }
});

// Assume this is a webserver like Express.js that allows for wildcard routes
webserver.get('/assets/*', (request, response) => {
    // Strip away the "/assets" from the path to map it to the assets folder of the AssetsDirectory
    const path = request.path.replace('/assets', '');
    
    // Retrieve the LiveFile instance for this asset
    const asset = AssetsDirectory.get(path);
    if (!asset) return response.status(404).send('Not Found');
    
    // Send the asset content as response depending on if the file is cached
    if (asset.cached) {
        // Simply send the Buffer returned by asset.content as the response
        // You can convert a Buffer to a string using Buffer.toString() if your webserver requires string response body
        return response.send(asset.content);
    } else {
        // For files that are not cached, you must create a stream and pipe it as the response for memory efficiency
        const readable = asset.stream();
        return readable.pipe(response);
    }
});
```