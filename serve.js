// CardVault — Local HTTP Server
// Usage: node serve.js
// Opens at http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const SRC_DIR = path.join(__dirname, 'src');
const ASSETS_DIR = path.join(__dirname, 'assets');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Default to index.html for SPA
  if (urlPath === '/') urlPath = '/index.html';

  // Try src/ first, then assets/ (for ../assets/ references)
  let filePath = path.join(SRC_DIR, urlPath);
  if (!fs.existsSync(filePath)) {
    // Handle ../assets/ paths from src/
    const assetsPath = path.join(ASSETS_DIR, urlPath.replace(/^\/assets\//, '/'));
    if (urlPath.startsWith('/assets/') && fs.existsSync(assetsPath)) {
      filePath = assetsPath;
    } else {
      // SPA fallback — serve index.html for all unmatched routes
      filePath = path.join(SRC_DIR, 'index.html');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  CardVault running at:\n`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  Press Ctrl+C to stop.\n`);
});
