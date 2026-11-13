/*
 * One-time Cloudflare setup for the admin. Run from the mostarly folder after `npx wrangler login`:
 *
 *   node scripts/cf-setup.mjs
 *
 * 1. creates the D1 database "mostarly" (or finds it) and writes its id into wrangler.jsonc
 * 2. creates the R2 bucket "mostarly-media" for photos (R2 must be enabled once in the dashboard)
 * 3. creates the tables (migrations/)
 * Safe to run again.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, quiet) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
const W = path.join(ROOT, 'wrangler.jsonc');

console.log('1/3 Database (D1)');
let id = '';
try {
  const list = JSON.parse(run('npx wrangler d1 list --json', true));
  const db = list.find((d) => d.name === 'mostarly');
  if (db) id = db.uuid;
} catch { /* first run, or older wrangler */ }
if (!id) {
  const outText = run('npx wrangler d1 create mostarly', true);
  const m = /"database_id":\s*"([0-9a-f-]{36})"|database_id\s*=\s*"([0-9a-f-]{36})"/.exec(outText);
  id = m && (m[1] || m[2]);
  if (!id) { console.log(outText); throw new Error('Could not read the database id. Copy it from the text above into wrangler.jsonc.'); }
}
let conf = fs.readFileSync(W, 'utf8');
conf = conf.replace(/"database_id":\s*"[^"]*"/, `"database_id": "${id}"`);
fs.writeFileSync(W, conf);
console.log('   database id:', id);

console.log('2/3 Photo storage (R2)');
try { run('npx wrangler r2 bucket create mostarly-media', true); console.log('   created mostarly-media'); }
catch (e) {
  const msg = String(e.stdout || '') + String(e.stderr || '');
  if (/already exists|10004/i.test(msg)) console.log('   mostarly-media already exists');
  else { console.log(msg); console.log('   If R2 is not enabled yet: Cloudflare dashboard > R2 > enable, then run this again.'); }
}

console.log('3/3 Tables');
run('npx wrangler d1 migrations apply mostarly --remote');

console.log('\nDone. Next: node build.mjs && npx wrangler deploy');
console.log('Then protect /admin with Cloudflare Access (see README, section "Admin").');
