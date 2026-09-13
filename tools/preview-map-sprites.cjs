#!/usr/bin/env node
// Renders every board sprite frame of mapart.js at 6× onto a grass-green sheet (artifacts/map-sprites.png)
// so the pixel maps can be reviewed without a browser. Node built-ins only.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib');
const ROOT = path.join(__dirname, '..');
const scope = vm.createContext({ document: { createElement: () => ({ getContext: () => ({}) }) } });
const src = fs.readFileSync(path.join(ROOT, 'mapart.js'), 'utf8');
vm.runInContext(src.replace(/^const MAPSPR[\s\S]*$/m, '').replace(/^'use strict';/m, ''), scope);
const SPR = vm.runInContext('MAP_SPRITES', scope), PAL = vm.runInContext('MAP_PAL', scope);
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const Z = parseInt(process.env.PK_ZOOM || '6'), CELL = 16 * Z + 8; const nums = Object.keys(SPR); const cols = 2 * nums.length;
const w = cols * CELL + 8, h = CELL + 8; const data = Buffer.alloc(w * h * 4);
const put = (x, y, c) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; };
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, ((x >> 4) + (y >> 4)) & 1 ? rgb('#63b84c') : rgb('#5aae47'));
nums.forEach((n, i) => SPR[n].forEach((rows, f) => { const ox = 8 + (i * 2 + f) * CELL, oy = 8; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.') return; const c = PAL[n][ch]; if (!c) return; for (let j = 0; j < Z; j++) for (let k = 0; k < Z; k++) put(ox + x * Z + k, oy + y * Z + j, rgb(c)); })); }));
function crc(b) { let n = 0xffffffff; for (const v of b) { n ^= v; for (let j = 0; j < 8; j++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; }
const chunk = (name, body) => { const b = Buffer.concat([Buffer.from(name), body]), size = Buffer.alloc(4), sum = Buffer.alloc(4); size.writeUInt32BE(body.length); sum.writeUInt32BE(crc(b)); return Buffer.concat([size, b, sum]); };
const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6;
const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
const out = path.join(ROOT, 'artifacts', 'map-sprites.png');
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(out + ' ' + nums.join(',') + ' frames at ' + Z + 'x');
