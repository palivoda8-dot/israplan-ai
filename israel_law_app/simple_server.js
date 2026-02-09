const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const DIRECTORY = 'C:\\Users\\paliv\\.openclaw\\workspace\\israel_law_app';

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
};

http.createServer((req, res) => {
    let filePath = path.join(DIRECTORY, req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}).listen(PORT, '127.0.0.1');

console.log(`Server running at http://127.0.0.1:${PORT}/`);
