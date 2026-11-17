/*
 * Mostarly Guide: map data for the globe and the Herzegovina route maps.
 *
 *   npm pack world-atlas@2.0.2 && tar -xzf world-atlas-2.0.2.tgz
 *   node scripts/geo-pack.mjs package
 *
 * Input: TopoJSON from the npm package world-atlas@2 (Natural Earth data, public domain).
 * Output (committed, the package itself is not):
 *   src/geo/world.json   land outlines for the small globe   { land: [[lon,lat,lon,lat,...], ...] }
 *   src/geo/region.json  countries around Herzegovina         { bbox, land, bih, borders }
 * Coordinates are rounded and simplified so both files stay small.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
if (!SRC) { console.error('Usage: node scripts/geo-pack.mjs <world-atlas package folder>'); process.exit(1); }
const readTopo = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));

function decodeArcs(topo) {
  const t = topo.transform;
  return topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map((p) => { if (!t) return [p[0], p[1]]; x += p[0]; y += p[1]; return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]]; }); });
}
function ringFrom(arcs, ids) {
  const out = [];
  for (const id of ids) { const a = id < 0 ? arcs[~id].slice().reverse() : arcs[id]; for (let i = out.length ? 1 : 0; i < a.length; i++) out.push(a[i]); }
  return out;
}
function ringsOf(arcs, g) {
  const rings = [];
  const walk = (g) => {
    if (g.type === 'GeometryCollection') g.geometries.forEach(walk);
    else if (g.type === 'Polygon') g.arcs.forEach((r) => rings.push(ringFrom(arcs, r)));
    else if (g.type === 'MultiPolygon') g.arcs.forEach((p) => p.forEach((r) => rings.push(ringFrom(arcs, r))));
  };
  walk(g);
  return rings;
}
function simplify(pts, tol) { // Douglas-Peucker, longitude scaled by cos(latitude)
  if (pts.length < 4) return pts;
  const f = pts[0], l = pts[pts.length - 1];
  if (f[0] === l[0] && f[1] === l[1]) { // closed ring: split at the point farthest from the start
    let m = 1, md = -1;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.hypot(pts[i][0] - f[0], pts[i][1] - f[1]); if (d > md) { md = d; m = i; } }
    return simplify(pts.slice(0, m + 1), tol).concat(simplify(pts.slice(m), tol).slice(1));
  }
  const k = Math.cos((pts[0][1] * Math.PI) / 180);
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let md = 0, mi = -1;
    const ax = pts[a][0] * k, ay = pts[a][1], bx = pts[b][0] * k, by = pts[b][1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * (pts[i][0] * k - ax) - dx * (pts[i][1] - ay)) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const flat = (pts, dec) => pts.flatMap(([x, y]) => [+x.toFixed(dec), +y.toFixed(dec)]);
const inBox = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];

// world: coarse land for the globe
const land110 = readTopo('land-110m.json');
const world = { land: ringsOf(decodeArcs(land110), land110.objects.land).map((r) => flat(simplify(r, 0.25), 1)).filter((r) => r.length >= 8) };

// region: countries-10m around Herzegovina, cut to a box with a margin
const BOX = [16.6, 42.4, 19.2, 44.4];
const c10 = readTopo('countries-10m.json');
const arcs = decodeArcs(c10);
const land = [], bih = [];
for (const g of c10.objects.countries.geometries) {
  for (const r of ringsOf(arcs, g)) {
    if (!r.some((p) => inBox(p, BOX))) continue;
    const s = flat(simplify(r, 0.002), 4);
    if (s.length < 8) continue;
    (g.properties && /bosnia/i.test(g.properties.name) ? bih : land).push(s);
  }
}
const owners = new Map();
c10.objects.countries.geometries.forEach((g, gi) => {
  const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
  for (const p of polys) for (const r of p) for (const id of r) { const k = id < 0 ? ~id : id; if (!owners.has(k)) owners.set(k, new Set()); owners.get(k).add(gi); }
});
const borders = [];
for (const [k, set] of owners) if (set.size > 1 && arcs[k].some((p) => inBox(p, BOX))) borders.push(flat(simplify(arcs[k], 0.002), 4));
const region = { bbox: BOX, land, bih, borders };

const OUT = path.join(ROOT, 'src/geo');
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'world.json'), JSON.stringify(world));
fs.writeFileSync(path.join(OUT, 'region.json'), JSON.stringify(region));
console.log('world.json', fs.statSync(path.join(OUT, 'world.json')).size, 'B · region.json', fs.statSync(path.join(OUT, 'region.json')).size, 'B · bih rings', bih.length);
