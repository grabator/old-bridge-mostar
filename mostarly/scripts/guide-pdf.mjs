// The free guide as a PDF: node scripts/guide-pdf.mjs
// Prints the guide page (/guide/mostar-herzegovina-tips/, from content/site.json "guide") to
// src/guide/mostarly-mostar-herzegovina-guide.pdf, which build.mjs copies to dist/guide/.
// Run it again after the guide text changes. Needs Playwright with Chromium (only on your computer,
// not on Cloudflare): npm i -g playwright && npx playwright install chromium
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const OUT = path.join(ROOT, 'src', (S.guide && S.guide.pdf) || '/guide/mostarly-mostar-herzegovina-guide.pdf');

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('Playwright is missing: npm i -g playwright && npx playwright install chromium'); process.exit(1); }

// the PDF is made without the yellow draft notes
execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { stdio: 'inherit', env: Object.assign({}, process.env, { MOSTARLY_DRAFT: '0' }) });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(DIST, '.' + path.posix.normalize(p));
  if (!file.startsWith(DIST + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'light' });
await ctx.addInitScript(() => { try { localStorage.setItem('mly-theme', 'day'); } catch (e) {} });
const page = await ctx.newPage();
await page.goto(`http://localhost:${port}/guide/mostar-herzegovina-tips/`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: 'print' });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await page.pdf({
  path: OUT, format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;font:8px Arial,sans-serif;color:#8a847c;padding:0 14mm;display:flex;justify-content:space-between"><span>Mostarly Guide · mostarlyguide.com</span><span class="pageNumber"></span></div>',
  margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' }
});
await browser.close();
server.close();
// build again with the normal settings (draft notes come back if the site is still a draft)
execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { stdio: 'inherit' });
console.log('PDF: ' + path.relative(ROOT, OUT) + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
