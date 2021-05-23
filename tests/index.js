const LiveDirectory = require('../index.js');
const test_directory = new LiveDirectory({
    root_path: './test_directory',
    file_extensions: ['.html', '.js', '.css'],
});

test_directory.handle('reload', (file) => {
    console.log('PATH: ', file.path);
    console.log('CONTENT: ' + file.content);
});
