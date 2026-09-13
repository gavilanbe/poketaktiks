#!/usr/bin/env node
// Export the title's existing pixel lettering as a reusable transparent SVG.
// No font download, image service, or package dependencies are required.
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./model-tests.cjs');
const T = loadGame(), font = T.G('BIG');
const width = word => [...word].reduce((n, c) => n + font[c].w + 1, -1);
function lettering(word, center, y) {
  let x = Math.round(center - width(word) / 2), d = '';
  for (const c of word) {
    const glyph = font[c];
    glyph.rows.forEach((row, j) => [...row].forEach((v, i) => {
      if (v === '1') d += `M${x + i},${y + glyph.off + j}h1v1h-1z`;
    }));
    x += glyph.w + 1;
  }
  return d;
}
const svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="720" height="280" viewBox="-35 -2 72 28" shape-rendering="crispEdges" role="img" aria-labelledby="title"><title id="title">POKÉTAKTIKS</title>'];
const rect = (x, y, w, h, color) => svg.push(`<path fill="${color}" d="M${x},${y}h${w}v${h}h${-w}z"/>`);
function circle(x, y, r, color) {
  for (let j = -r; j <= r; j++) {
    const w = Math.floor(Math.sqrt(r * r - j * j) + .5);
    rect(x - w, y + j, 2 * w + 1, 1, color);
  }
}
const bx = -width('POKÉ') / 2 - 3, by = 5;
circle(bx, by, 4, '#080b14'); circle(bx, by, 3, '#f6f2e6');
for (let j = -3; j < 0; j++) {
  const w = Math.floor(Math.sqrt(9 - j * j) + .5);
  rect(Math.trunc(bx - w), by + j, 2 * w + 1, 1, '#ed765d');
}
rect(Math.trunc(bx - 3), by, 7, 1, '#080b14'); rect(Math.trunc(bx), by, 1, 1, '#ffffff'); rect(Math.trunc(bx - 1), by - 2, 1, 1, '#f6bbae');
for (const [word, x, y, fill, hi] of [['POKÉ', 6, 0, '#f4c563', '#fff0ba'], ['TAKTIKS', 0, 12, '#f4f1d9', '#fffdf0']]) {
  const d = lettering(word, x, y), clip = `top-${y}`;
  for (let k = 3; k > 0; k--) svg.push(`<path d="${d}" transform="translate(${k} ${k})" fill="#06181d"/>`);
  svg.push(`<path d="${d}" stroke="#142e32" stroke-width="2" fill="${fill}" paint-order="stroke"/>`);
  svg.push(`<defs><clipPath id="${clip}"><path d="M-100,${y}h200v3h-200z"/></clipPath></defs><path d="${d}" fill="${hi}" clip-path="url(#${clip})"/>`);
}
svg.push('</svg>');
const out = path.join(__dirname, '../assets/title/poketaktiks-logo-v1.svg');
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, svg.join('\n') + '\n');
console.log(path.relative(path.join(__dirname, '..'), out));
