// Local preview: node dev.mjs  ->  builds the site and serves it at http://localhost:8090
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.argv[2]) || 8090;
execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { stdio: 'inherit' });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain', '.yml': 'text/yaml' };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // the mail function only runs on Cloudflare; locally the form falls back to the email app
  if (p === '/api/enquiry') { res.writeHead(501, { 'content-type': 'application/json' }); return res.end('{"ok":false}'); }
  if (p.endsWith('/')) p += 'index.html';
  let file = path.resolve(DIST, '.' + path.posix.normalize(p));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) { res.writeHead(403); return res.end(); }
  if (!path.extname(file) && fs.existsSync(path.join(file, 'index.html'))) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': TYPES['.html'] }); return res.end(fs.readFileSync(path.join(DIST, '404.html'))); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log('Mostarly: http://localhost:' + PORT));
