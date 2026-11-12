/*
 * Mostarly Guide: satellite images for the Herzegovina maps.
 *
 *   node scripts/sat-pack.mjs            (needs curl and ffmpeg)
 *
 * Source: EOxCloudless 2016 (Sentinel-2 cloudless) by EOX IT Services GmbH, https://cloudless.eox.at
 * Contains modified Copernicus Sentinel data 2016. Licence: CC BY 4.0, so the images may be stored
 * and served with the site as long as the credit is shown (the map shows it in the corner).
 * Only the 2016 layer has this licence: later years are CC BY-NC-SA, do not switch the layer.
 *
 * Web Mercator tiles are stitched into a few JPEGs; maps.js uses the same projection, so each image
 * is placed by the longitude/latitude of its outer tile edges (written to src/geo/sat.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/geo');
const TMP = path.join(ROOT, '.sat-tiles');
const URL = (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`;

// name, zoom, box [west, south, east, north]
const LAYERS = [
  ['sat-base', 10, [16.0, 42.1, 19.9, 44.7]],       // everything the camera can show
  ['sat-core', 12, [17.45, 42.98, 18.08, 43.45]],   // Mostar, Blagaj, Počitelj, Kravice, Stolac
  ['sat-north', 12, [17.62, 43.55, 18.05, 43.78]],  // Jablanica Lake
  ['sat-sarajevo', 12, [18.25, 43.78, 18.55, 43.93]],
  ['sat-mostar', 13, [17.74, 43.29, 17.9, 43.385]],    // the city itself, sharper
];

const tx = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const ty = (lat, z) => Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z);
const lonOf = (x, z) => (x / 2 ** z) * 360 - 180;
const latOf = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

fs.mkdirSync(TMP, { recursive: true });
const manifest = { credit: 'EOxCloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0', layers: [] };
for (const [name, z, [w, s, e, n]] of LAYERS) {
  const x0 = tx(w, z), x1 = tx(e, z), y0 = ty(n, z), y1 = ty(s, z), cols = x1 - x0 + 1, rows = y1 - y0 + 1;
  const files = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const f = path.join(TMP, `${z}-${x}-${y}.jpg`);
    if (!fs.existsSync(f) || fs.statSync(f).size < 500) {
      for (let k = 0; k < 4; k++) { try { execFileSync('curl', ['-sSf', '--max-time', '30', '-o', f, URL(z, x, y)]); break; } catch (err) { if (k === 3) throw err; } }
    }
    files.push(f);
  }
  // stitch: one row at a time, then the rows on top of each other
  const rowFiles = [];
  for (let r = 0; r < rows; r++) {
    const rf = path.join(TMP, `${name}-row${r}.png`), ins = files.slice(r * cols, r * cols + cols);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...ins.flatMap((f) => ['-i', f]), '-filter_complex', cols > 1 ? `hstack=inputs=${cols}` : 'null', rf]);
    rowFiles.push(rf);
  }
  const out = path.join(OUT, name + '.jpg');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...rowFiles.flatMap((f) => ['-i', f]), '-filter_complex', (rows > 1 ? `vstack=inputs=${rows},` : '') + 'eq=saturation=1.08:contrast=1.04', '-q:v', '6', out]);
  manifest.layers.push({ file: name + '.jpg', z, bbox: [+lonOf(x0, z).toFixed(6), +latOf(y1 + 1, z).toFixed(6), +lonOf(x1 + 1, z).toFixed(6), +latOf(y0, z).toFixed(6)], px: [cols * 256, rows * 256] });
  console.log(name, `${cols}x${rows} tiles`, Math.round(fs.statSync(out).size / 1024) + ' KB');
}
fs.writeFileSync(path.join(OUT, 'sat.json'), JSON.stringify(manifest, null, 1));
fs.rmSync(TMP, { recursive: true, force: true });
