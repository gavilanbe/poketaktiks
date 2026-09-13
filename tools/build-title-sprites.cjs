#!/usr/bin/env node
// Editable, deterministic pixel art. Run `node tools/build-title-sprites.cjs`.
// Each letter, icon animation, button state and particle has its own atlas frames.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'assets/title/sprites');
const scope = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'font.js'), 'utf8'), scope);
const FONT = vm.runInContext('BIG', scope);
fs.mkdirSync(OUT, { recursive: true });
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
function surface(w, h) {
  const data = Buffer.alloc(w * h * 4);
  const p = {
    w, h, data,
    pixel(x, y, color) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= w || y >= h) return; const c = Array.isArray(color) ? color : rgb(color); for (let i = 0; i < 4; i++) data[(y * w + x) * 4 + i] = c[i]; },
    rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) p.pixel(x + i, y + j, c); },
    line(x, y, xx, yy, c) { const n = Math.max(Math.abs(xx - x), Math.abs(yy - y)); for (let i = 0; i <= n; i++) p.pixel(x + (xx - x) * i / Math.max(1, n), y + (yy - y) * i / Math.max(1, n), c); },
    circle(x, y, r, c) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r * .3) p.pixel(x + i, y + j, c); },
    stamp(x, y, rows, pal) { rows.forEach((r, j) => [...r].forEach((v, i) => { if (pal[v]) p.pixel(x + i, y + j, pal[v]); })); },
    blit(src, x, y) { for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) { const k = (j * src.w + i) * 4; if (src.data[k + 3]) p.pixel(x + i, y + j, [...src.data.subarray(k, k + 4)]); } },
  }; return p;
}
function crc(b) { let n = 0xffffffff; for (const v of b) { n ^= v; for (let j = 0; j < 8; j++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; }
function png(p) {
  const chunk = (name, body) => { const b = Buffer.concat([Buffer.from(name), body]), size = Buffer.alloc(4), sum = Buffer.alloc(4); size.writeUInt32BE(body.length); sum.writeUInt32BE(crc(b)); return Buffer.concat([size, b, sum]); };
  const head = Buffer.alloc(13); head.writeUInt32BE(p.w, 0); head.writeUInt32BE(p.h, 4); head[8] = 8; head[9] = 6;
  const rows = Buffer.alloc((p.w * 4 + 1) * p.h);
  for (let y = 0; y < p.h; y++) p.data.copy(rows, y * (p.w * 4 + 1) + 1, y * p.w * 4, (y + 1) * p.w * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const META = { letters: {}, icons: {}, buttons: {}, effects: {} };
function atlas(kind, groups, cw, ch, cols) {
  const n = groups.reduce((n, g) => n + g.frames.length, 0), sheet = surface(cw * cols, Math.ceil(n / cols) * ch);
  let i = 0;
  for (const group of groups) {
    const frames = group.frames.map(f => { const x = i % cols * cw, y = Math.floor(i / cols) * ch; sheet.blit(f, x, y); i++; return [x, y, f.w, f.h]; });
    META[kind][group.id] = { frames, ...group.meta };
    // Separate strips make each piece easy to inspect and replace in a pixel editor.
    const strip = surface(cw * group.frames.length, ch); group.frames.forEach((f, j) => strip.blit(f, j * cw, 0));
    const dir = path.join(OUT, kind); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, group.id + '.png'), png(strip));
  }
  fs.writeFileSync(path.join(OUT, kind + '.png'), png(sheet));
}
const C = { out: '#091b30', edge: '#346c7d', blue: '#3d92b5', cyan: '#97e9e2', gold: '#e6b858', light: '#fff1b5', brass: '#8f6534', cream: '#f2edce', red: '#f47f61', redD: '#b44942', dark: '#153b4a' };
function letter(c, palette, frame) {
  const f = FONT[c], p = surface(40, 42), ox = 5, oy = 4;
  const points = new Set(); f.rows.forEach((r, y) => [...r].forEach((v, x) => { if (v === '1') for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) points.add((ox + x * 3 + i) + ',' + (oy + y * 3 + j)); }));
  const xy = [...points].map(k => k.split(',').map(Number));
  for (const [x, y] of xy) for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { p.pixel(x + i + 2, y + j + 5, '#060f24'); p.pixel(x + i, y + j, '#091b30'); }
  for (const [x, y] of xy) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) p.pixel(x + i, y + j, '#39758a');
  for (const [x, y] of xy) {
    let color = palette === 'gold' ? (y < 13 ? '#ffe58b' : y < 22 ? '#f7c35b' : '#dd943e') : (y < 13 ? '#fffce1' : y < 23 ? '#dff2e7' : '#a7d5d6');
    if (!points.has(x + ',' + (y - 1))) color = palette === 'gold' ? '#fff7c9' : '#ffffff';
    else if (!points.has((x + 1) + ',' + y) || !points.has(x + ',' + (y + 1))) color = palette === 'gold' ? '#b86c2f' : '#6c9fba';
    if (frame && Math.abs(x + y * .34 - (frame * 10 - 3)) < 2.5) color = '#fffef1';
    p.pixel(x, y, color);
  }
  return p;
}
const letters = [];
for (const palette of ['gold', 'ivory']) for (const c of [...new Set('POKÉTAKTIKS')]) letters.push({ id: palette + '-' + c, frames: Array.from({ length: 5 }, (_, frame) => letter(c, palette, frame)), meta: { advance: (FONT[c].w + 1) * 3, anchor: [5, 4], bodyHeight: 27 } });
atlas('letters', letters, 40, 42, 10);
function icon(id, f) {
  const p = surface(24, 24), bob = [0, -1, 0, 1][f];
  if (id === 'ball') {
    p.circle(12, 12 + bob, 9, C.out); p.circle(12, 11 + bob, 7, C.cream);
    for (let y = -6; y < 0; y++) { const w = Math.floor(Math.sqrt(49 - y * y)); p.rect(12 - w, 11 + y + bob, w * 2 + 1, 1, y < -3 ? C.red : C.redD); }
    p.rect(5, 10 + bob, 15, 3, C.out); p.circle(12, 11 + bob, 3, C.out); p.circle(12, 11 + bob, 1, '#ffffff');
    p.rect(8 + f, 6 + bob, 3, 1, '#ffd9b0'); p.rect(8, 7 + bob, 1, 2, '#ffd9b0');
  } else if (id === 'map') {
    p.stamp(3, 5 + bob, ['..OOO...OOOOOO....','OOYYYOOOYLLLLLOO.','OYYYLOOYYYLLLLOO.','OYYYLOOYYLLLLLOO.','OYYYLOOYYLLLLLOO.','OYYYLOOYYLLLLLOO.','OYYYLOOYYLLLLLOO.','OYYLLOOYYLLLLLOO.','OYYLLOOYYLLLLLOO.','OYYLLOOYYLLLLLOO.','OOYLLOOYYYLLLLOO.','..OOO...OOOOOO...'], { O: C.out, Y: '#dfb966', L: '#fff0b1' });
    p.line(7, 13 + bob, 12, 8 + bob, '#7c9d65'); p.line(12, 8 + bob, 17, 11 + bob, '#7c9d65');
    p.rect(15, 10 + bob, 3, 3, f % 2 ? '#ffad67' : C.redD); p.pixel(16, 11 + bob, C.light);
    p.line(18 - [0, 1, 2, 1][f], 6 + bob, 18 - [0, 1, 2, 1][f], 15 + bob, '#d4ab63');
  } else if (id === 'dice') {
    const dx = [0, 1, 0, -1][f], dy = bob;
    p.rect(5 + dx, 6 + dy, 14, 14, C.out); p.rect(4 + dx, 5 + dy, 14, 13, C.gold); p.rect(5 + dx, 4 + dy, 12, 13, C.cream); p.rect(6 + dx, 5 + dy, 10, 1, '#ffffff');
    for (const [x, y] of [[7, 7], [14, 7], [10, 10], [7, 13], [14, 13]]) p.rect(x + dx, y + dy, 2, 2, C.dark);
    p.rect(18 + dx, 8 + dy, 1, 3, C.brass); if (f === 1 || f === 3) { p.pixel(2, 3, C.light); p.pixel(21, 19, C.gold); }
    if (f === 2) { p.rect(7, 5, 5, 1, '#fff7c9'); p.pixel(16, 15, C.brass); }
  } else if (id === 'flag') {
    p.rect(5, 3, 3, 19, C.out); p.rect(6, 4, 1, 16, C.gold); p.rect(3, 20, 9, 2, C.out); p.rect(4, 20, 7, 1, C.brass); p.circle(6, 3, 2, C.out); p.pixel(6, 2, C.light);
    for (let x = 8; x < 21; x++) { const yy = 5 + Math.round(Math.sin(x * .48 + f * Math.PI / 2)); const h = 7 - Math.floor((x - 8) / 4); p.rect(x, yy - 1, 1, h + 2, C.out); p.rect(x, yy, 1, h, x < 13 ? C.gold : '#efcb71'); p.pixel(x, yy, C.light); }
  } else if (id === 'vs') {
    const d = [1, 0, -1, 0][f];
    p.line(4, 3 + d, 19, 18 - d, C.out); p.line(5, 3 + d, 20, 18 - d, C.out); p.line(4, 4 + d, 18, 18 - d, C.cream); p.line(5, 4 + d, 19, 18 - d, C.cyan);
    p.line(19, 3 + d, 4, 18 - d, C.out); p.line(18, 3 + d, 3, 18 - d, C.out); p.line(18, 4 + d, 4, 18 - d, C.cream); p.line(17, 4 + d, 3, 18 - d, C.blue);
    p.line(2, 14, 8, 20, C.gold); p.line(15, 20, 21, 14, C.gold); p.line(3, 19, 5, 17, C.brass); p.line(18, 17, 20, 19, C.brass);
    if (f === 2) { p.rect(11, 6, 1, 10, C.light); p.rect(8, 10, 7, 1, '#ffffff'); }
    if (f === 3) { p.pixel(15, 5, '#ffffff'); p.pixel(16, 4, '#ffffff'); }
  } else if (id === 'play') {
    p.circle(12, 12, 10, C.out); p.circle(12, 11, 8, C.brass); p.circle(12, 10, 7, '#255367'); p.line(8, 4, 15, 4, C.light);
    for (let x = 0; x < 7; x++) p.rect(9 + x, 6 + x / 2, 1, 9 - x, f === 2 ? '#fffdea' : C.gold);
    const glints = [[16, 5], [19, 9], [16, 16], [6, 14]]; p.pixel(...glints[f], C.light);
  } else if (id === 'music') {
    const left = [0, -1, 0, 1][f], right = [0, 0, -1, -1][f];
    p.rect(8, 4, 2, 13, C.out); p.rect(17, 3, 2, 12, C.out); p.line(9, 4, 18, 2, C.gold); p.line(9, 5, 18, 3, C.gold); p.circle(6, 17 + left, 3, C.out); p.circle(6, 16 + left, 2, C.gold); p.circle(15, 15 + right, 3, C.out); p.circle(15, 14 + right, 2, C.gold); p.rect(8, 5, 1, 12, C.light); p.rect(17, 4, 1, 11, C.light);
  }
  return p;
}
atlas('icons', ['ball', 'map', 'dice', 'flag', 'vs', 'play', 'music'].map(id => ({ id, frames: [0, 1, 2, 3].map(f => icon(id, f)), meta: { fps: id === 'vs' ? 7 : 6 } })), 24, 24, 8);
function button(state) {
  const p = surface(80, 32), hot = state !== 'idle', down = state === 'pressed', y = down ? 2 : 0;
  const step = (x, y, w, h, color) => { p.rect(x + 3, y, w - 6, h, color); p.rect(x + 1, y + 2, w - 2, h - 4, color); p.rect(x, y + 4, w, h - 8, color); };
  step(0, 4, 80, 28, '#071326'); step(0, y, 80, 28, C.out); step(1, y + 1, 78, 26, hot ? '#e0ad49' : '#8b815c'); step(2, y + 2, 76, 24, hot ? '#fff0ad' : '#b9c6a6');
  step(4, y + 4, 72, 20, hot ? '#1e4350' : '#16333e');
  p.rect(7, y + 5, 66, 1, hot ? '#548280' : '#345a61'); p.rect(7, y + 6, 66, 1, hot ? '#2f5860' : '#20414b');
  p.rect(7, y + 23, 66, 1, '#0b2134'); p.rect(7, y + 25, 66, 1, hot ? '#a66b30' : '#615d45');
  for (const x of [3, 73]) { p.rect(x, y + 6, 4, 16, C.out); p.rect(x + 1, y + 7, 2, 14, hot ? C.gold : '#778878'); p.pixel(x + 1, y + 7, hot ? '#fffad3' : '#c6d5b6'); p.rect(x, y + 12, 4, 4, hot ? '#f5d47d' : '#6b958f'); }
  if (hot) { p.rect(13, y + 1, 54, 1, '#fff7c9'); p.pixel(2, y + 5, '#ffffff'); p.pixel(77, y + 5, '#ffffff'); }
  return p;
}
atlas('buttons', ['idle', 'focus', 'pressed'].map(id => ({ id, frames: [button(id)], meta: { cap: 12, content: [10, 4, 60, 20] } })), 80, 32, 3);
const sparks = ['spark', 'diamond', 'ring'].map(id => ({ id, frames: [0, 1, 2, 3].map(f => {
  const p = surface(16, 16), r = [2, 4, 3, 1][f];
  if (id === 'ring') { for (let i = 0; i < 16; i++) p.pixel(8 + Math.cos(i * Math.PI / 8) * (f + 2), 8 + Math.sin(i * Math.PI / 8) * (f + 2), C.light); }
  else { p.rect(8, 8 - r, 1, 2 * r + 1, C.light); p.rect(8 - r, 8, 2 * r + 1, 1, C.light); p.pixel(8, 8, '#ffffff'); if (id === 'diamond' && f < 3) for (const [x, y] of [[7, 7], [9, 7], [7, 9], [9, 9]]) p.pixel(x, y, C.gold); }
  return p;
}) }));
atlas('effects', sparks, 16, 16, 8);
fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify(META, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'titlemeta.js'), '// Generated by tools/build-title-sprites.cjs. Coordinates are [x, y, width, height].\nconst TITLE_SPRITES = ' + JSON.stringify(META) + ';\n');
console.log('Title sprites: 80 letter frames, 28 icon frames, 3 button states, 12 effect frames.');
