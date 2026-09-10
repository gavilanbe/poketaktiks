// ============================================================================
// art.js — hand-tuned procedural pixel art: terrain tiles with autotiling
// (shorelines, road edges, wall faces), decorations, FE-style path arrow,
// cursor, range overlays, type-flavoured battle effects and small icons.
//
// Everything is drawn once into offscreen canvases and cached, so the per
// frame cost is a drawImage per tile.
// ============================================================================
'use strict';
const TILESET = {}; // key ch+variant+frame → canvas (base tiles)
const VARIANTS = 4, WATER_FRAMES = 4;
function tileCanvas(w = TILE, h = TILE) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
// Mini drawing API bound to an offscreen context.
function painter(g) {
  const P = {
    g,
    R: (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); },
    P: (x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); },
    H: (x, y, w, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, 1); },
    V: (x, y, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, h | 0); },
    C: (cx, cy, r, c) => { g.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y) + .5); g.fillRect(cx - w, cy + y, 2 * w + 1, 1); } },
    E: (cx, cy, rx, ry, c) => { g.fillStyle = c; for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + .5); g.fillRect(cx - w, cy + y, 2 * w + 1, 1); } },
    TRI: (x0, y0, w, h, c) => { g.fillStyle = c; for (let j = 0; j < h; j++) { const ww = Math.round(w * (j + 1) / h); g.fillRect(x0 + Math.round((w - ww) / 2), y0 + j, ww, 1); } },
    // Stamp a pixel map (array of strings) with a char→color palette; '.' is transparent.
    S: (x, y, rows, pal) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.' || ch === ' ') continue; const c = pal[ch]; if (!c) continue; g.fillStyle = c; g.fillRect(x + i, y + j, 1, 1); } },
    // Outline the opaque pixels of the canvas (1px, only where transparent neighbours exist).
    CLEAR: (x, y, w, h) => g.clearRect(x, y, w, h),
  };
  return P;
}
// ---------------------------------------------------------------- palette (hue-shifted ramps)
const PAL = {
  grass: { dd: '#347436', d: '#4a9a40', dm: '#5aae47', m: '#63b84c', l: '#7ecf5e', ll: '#a3e07c' },
  tall: { dd: '#2b6a32', d: '#3f8a3c', m: '#54a646', l: '#74c45c', ll: '#9ad878' },
  tree: { dd: '#1c4a2c', d: '#2a6b38', m: '#3d9046', l: '#5ab258', ll: '#88d06c', out: '#143622' },
  trunk: { d: '#4a2c16', m: '#7a4f2c', l: '#a0703e' },
  rock: { dd: '#463c46', d: '#665858', m: '#8a7c74', l: '#ada090', ll: '#cfc4b2', out: '#2e2630' },
  snow: { d: '#b9c9de', m: '#e2eaf4', l: '#f8fafd' },
  cliff: { dd: '#3a333c', d: '#55494e', m: '#6f625f', l: '#8b7d74', ll: '#a89a8c' },
  water: { dd: '#1e4b96', d: '#2a66c0', m: '#3b87e0', l: '#62acf0', ll: '#a2d8ff', foam: '#edf9ff' },
  cwater: { dd: '#122448', d: '#1b396a', m: '#264d88', l: '#3a6ba8', ll: '#6c9bd4', foam: '#b8d6f4' },
  road: { d: '#b08f5a', m: '#ccae78', l: '#dec792', ll: '#ecdcaa', earth: '#8a6638', earthD: '#5c4224' },
  sand: { d: '#cfb266', m: '#e6cf86', l: '#f2e2a4', ll: '#fbf0c6' },
  cave: { dd: '#382e40', d: '#4a3f54', dm: '#54485e', m: '#5c5066', l: '#6e6278', ll: '#867a90' },
  cwall: { top: '#26202e', topL: '#332b3c', face: '#3a3044', faceL: '#52465c', faceLL: '#6a5e74', faceD: '#221b28', out: '#120e16' },
  floor: { d: '#7a7286', m: '#8f889a', l: '#a29bad', ll: '#b8b2c0', grout: '#5e566a', plate: '#6f6880' },
  bwall: { top: '#34334a', topL: '#43425c', face: '#4c4a64', faceL: '#5e5c78', faceLL: '#72708c', mortar: '#2e2d42', out: '#1a1a28' },
  lava: { dd: '#4e1206', d: '#96260c', m: '#e04e1a', l: '#ff8a2c', ll: '#ffd25a', w: '#fff5c0' },
  ice: { d: '#8cc2e2', m: '#bde4f8', l: '#dcf2ff', ll: '#ffffff' },
  plank: { d: '#845430', m: '#b47f48', l: '#d2a266', ll: '#e8c088', nail: '#4e3220' },
  metal: { d: '#4a4a58', m: '#7a7a8a', l: '#a8a8b8', ll: '#d8d8e4' },
  out: '#1a2418', outW: '#2a1a10',
};
// Which terrain ids count as "grassy land" for edge blending.
const GRASSY = new Set(['plain', 'flower', 'tall', 'forest', 'mountain', 'center', 'gym', 'house']);
const OPEN = new Set(['plain', 'flower', 'tall', 'road', 'sand', 'cave', 'floor', 'snow', 'ice', 'bridge', 'rubble', 'crate', 'forest', 'mountain', 'center', 'gym', 'water', 'lava']);
const LIQUID = new Set(['water', 'lava']);

// ---------------------------------------------------------------- shared stamps
const ST = {
  tuftL: ['L..L', '.LL.'], tuftD: ['D.D', '.D.'], blade: ['H', 'L', 'L'],
  flower: ['.P.', 'PYP', '.P.', '.S.'],
  stone: ['.LL.', 'LMMD', '.DD.'],
  mushroom: ['.RR.', 'RWRR', '.SS.', '.SS.'],
  crownGold: ['O.O.O', 'OYOYO', 'OYYYO', 'OOOOO'],
  skull: ['.OOO.', 'OWWWO', 'OWOWO', 'OWWWO', '.OWO.', '.OOO.'],
  hand: ['..OO....', '.OWWO...', '.OWWOOO.', 'OOWWWWWO', 'OWWWWWWO', 'OWWWWWWO', '.OWWWWO.', '..OOOO..'],
  heart: ['.P.P.', 'PLPPP', 'PPPPP', '.PPP.', '..P..'],
  pokeEmblem: ['.OOO.', 'ORRRO', 'OOWOO', 'OWWWO', '.OOO.'],
};

// ---------------------------------------------------------------- terrain bases
function drawTile(ch, variant, frame, g) {
  const p = painter(g), r = mulberry32(ch.charCodeAt(0) * 977 + variant * 131 + 7); const rr = (a, b) => a + Math.floor(r() * (b - a + 1));
  const G = PAL.grass;
  // Grass: flat base, one soft darker patch, a few light tufts on a jittered grid, a rare darker tuft.
  // Kept sparse and low-contrast so a field of it reads as one calm surface under the Pokémon.
  const grassBase = (tone = 0) => {
    p.R(0, 0, 32, 32, G.m);
    { const x = rr(-3, 26), y = rr(-2, 27), w = rr(6, 10), h = rr(3, 4); p.E(x + w / 2, y + h / 2, w / 2, h / 2, G.dm); }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { if (r() < .74) continue; const x = i * 8 + rr(0, 3), y = j * 8 + rr(0, 3); p.S(x, y, ST.tuftL, { L: G.l }); }
    if (r() < .5) p.S(rr(0, 28), rr(0, 29), ST.tuftD, { D: G.dd });
    if (tone === 0 && variant === 3 && r() < .4) p.S(rr(2, 26), rr(4, 26), ST.stone, { L: PAL.rock.ll, M: PAL.rock.l, D: PAL.rock.d });
  };
  const caveBase = () => {
    const C = PAL.cave; p.R(0, 0, 32, 32, C.m);
    { const x = rr(-3, 26), y = rr(-2, 27), w = rr(6, 10), h = rr(3, 4); p.E(x + w / 2, y + h / 2, w / 2, h / 2, C.dm); }
    for (let i = 0; i < 2; i++) { const x = rr(1, 28), y = rr(1, 28); p.R(x, y, 2, 1, C.l); p.P(x + 2, y + 1, C.dd); }
    if (r() < .6) { const x = rr(0, 26), y = rr(0, 30); p.H(x, y, rr(3, 5), C.dd); }
  };
  // Tiled floor: a 2×2 checker of near-identical tones with a thin grout that sits close to the tile
  // colour, so the grid is a texture rather than a lattice competing with the range overlays and units.
  const floorBase = () => {
    const F = PAL.floor; const grout = mix(F.m, F.grout, .45); p.R(0, 0, 32, 32, grout);
    for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) {
      const alt = ((x + y) / 16) % 2; const base = alt ? F.m : mix(F.m, F.l, .4);
      p.R(x + 1, y + 1, 15, 15, base); p.H(x + 1, y + 1, 15, mix(base, F.ll, .35)); p.V(x + 1, y + 1, 15, mix(base, F.ll, .2));
      if (r() < .12) { p.P(x + rr(3, 12), y + rr(3, 12), F.d); }
    }
    if (variant === 2) { p.R(4, 4, 8, 8, mix(F.plate, F.m, .4)); p.H(4, 4, 8, F.l); p.V(4, 4, 8, F.l); for (let j = 0; j < 3; j++) p.H(6, 6 + j * 2, 4, grout); }
  };
  const waterBase = (f, W) => {
    p.R(0, 0, 32, 32, W.m); const w = mulberry32(variant * 5 + 1);
    for (let i = 0; i < 3; i++) { const x = Math.floor(w() * 30), y = Math.floor(w() * 30); p.E(x, y, 6 + Math.floor(w() * 4), 2, W.d); }
    // wave crests: thin bright dashes drifting right, a soft lighter tail and a dark pixel tucked under the left end
    for (let i = 0; i < 3; i++) { const bx = Math.floor(w() * 28), by = 2 + Math.floor(w() * 27); const len = 3 + Math.floor(w() * 3); const x = (bx + f * 2 + i * 7) % 30, y = by; p.H(x, y, len, W.ll); p.P(x + len, y + 1, W.l); p.P(x + len + 1, y + 1, W.l); p.P(x - 1, y + 1, W.dd); }
    for (let i = 0; i < 3; i++) { const x = Math.floor(w() * 30), y = Math.floor(w() * 30); p.H((x + f) % 30, y, 2, W.l); }
  };
  // Round tree: overlapping lobes, five tones, leaf-clump highlights, dark outline, trunk with ground shadow.
  const tree = (cx, cy, rad) => {
    const T = PAL.tree, K = PAL.trunk; const base = cy + rad + 3;
    p.E(cx, base, rad + 1, 3, G.dd);
    p.R(cx - 2, base - 4, 4, 5, K.d); p.R(cx - 1, base - 5, 2, 5, K.m); p.P(cx - 1, base - 4, K.l);
    const lobes = [[cx, cy - 1, rad], [cx - 3, cy + 2, rad - 2], [cx + 3, cy + 2, rad - 2], [cx, cy + 3, rad - 3]];
    for (const [x, y, rd] of lobes) p.C(x, y, rd + 1, T.out);
    for (const [x, y, rd] of lobes) p.C(x, y, rd, T.d);
    for (const [x, y, rd] of lobes) p.C(x - 1, y - 1, Math.max(1, rd - 2), T.m);
    p.C(cx - 2, cy - 3, Math.max(1, rad - 4), T.l);
    p.R(cx - 3, cy - rad + 2, 3, 2, T.ll); p.R(cx - 5, cy - rad + 4, 2, 1, T.ll); p.R(cx + 1, cy - rad + 3, 2, 1, T.ll); p.P(cx - 6, cy - 1, T.ll);
    // clump texture: little dark "leaf lines" on the shadow side
    p.R(cx + 2, cy + 2, 3, 1, T.dd); p.R(cx + 4, cy - 1, 2, 1, T.dd); p.R(cx - 1, cy + rad - 2, 3, 1, T.dd); p.R(cx - 4, cy + 3, 2, 1, T.dd);
    p.R(cx - rad + 1, cy + 1, 1, 2, T.m);
  };
  const bush = (cx, cy, rad) => { const T = PAL.tree; p.E(cx, cy + rad, rad + 1, 2, G.dd); p.C(cx, cy, rad + 1, T.out); p.C(cx, cy, rad, T.d); p.C(cx - 1, cy - 1, rad - 1, T.m); p.C(cx - 1, cy - 2, Math.max(1, rad - 3), T.l); p.P(cx - 2, cy - rad + 1, T.ll); p.R(cx + 1, cy + 1, 2, 1, T.dd); };
  // Buildings share a body: outlined walls with a baseline shadow, and a two-tone tiled roof.
  const building = (o) => {
    const { roof, roofD, roofL, wall, wallD, x0 = 3, w = 26, wallTop = 13, wallH = 14, ridge = 4 } = o; const y1 = wallTop + wallH;
    p.E(16, y1 + 1, w / 2 + 2, 2, G.dd);
    p.R(x0 - 1, wallTop - 1, w + 2, wallH + 2, PAL.out); p.R(x0, wallTop, w, wallH, wall); p.H(x0, y1 - 1, w, wallD); p.V(x0 + w - 1, wallTop, wallH, wallD);
    // roof: overhang 2px, lit left slope, darker right slope, tile rows
    const rw = w + 4, rx = x0 - 2; const rh = wallTop - ridge;
    for (let j = 0; j < rh; j++) { const ww = Math.round(rw * (j + 1) / rh); const xs = rx + Math.round((rw - ww) / 2); p.H(xs, ridge + j, ww, roof); p.H(xs, ridge + j, Math.max(1, Math.round(ww * .55)), roofL); if (j % 3 === 2) { p.H(xs, ridge + j, ww, roofD); } p.P(xs, ridge + j, PAL.out); p.P(xs + ww - 1, ridge + j, PAL.out); }
    p.H(rx, wallTop - 1, rw, PAL.out); p.H(rx, wallTop, rw, roofD); p.H(rx + Math.round(rw / 2) - 1, ridge - 1, 3, PAL.out); p.P(rx + Math.round(rw / 2), ridge - 1, roofL);
  };
  const win = (x, y, lit) => { p.R(x - 1, y - 1, 6, 6, PAL.out); p.R(x, y, 4, 4, lit ? '#ffe28a' : '#8fd0ff'); p.P(x, y, '#ffffff'); p.H(x, y + 2, 4, PAL.out); p.V(x + 2, y, 4, PAL.out); };
  const door = (x, y, w, h, col) => { p.R(x - 1, y - 1, w + 2, h + 1, PAL.out); p.R(x, y, w, h, col); p.H(x, y, w, shade(col, .25)); p.P(x + w - 2, y + Math.floor(h / 2), '#ffd24a'); };
  const boulder = (x, y, w, h) => { const R = PAL.rock; p.E(x + w / 2, y + h / 2 + 1, w / 2 + 1, h / 2 + 1, R.out); p.E(x + w / 2, y + h / 2, w / 2, h / 2, R.m); p.E(x + w / 2 - 1, y + h / 2 - 1, Math.max(1, w / 2 - 1), Math.max(1, h / 2 - 1), R.l); p.P(x + 1, y + 1, R.ll); p.H(x + 2, y + h - 1, w - 3, R.d); p.P(x + w - 2, y + h - 2, R.dd); };
  const crate = (x, y, s) => { const K = PAL.plank; p.R(x + 1, y + 1, s, s, PAL.outW); p.R(x, y, s, s, K.m); p.H(x, y, s, K.ll); p.V(x, y, s, K.l); p.H(x, y + s - 1, s, K.d); p.V(x + s - 1, y, s, K.d); p.H(x + 1, y + Math.floor(s / 2), s - 2, K.d); p.V(x + Math.floor(s / 2), y + 1, s - 2, K.d); p.H(x + 1, y + Math.floor(s / 2) + 1, s - 2, K.l); for (const [nx, ny] of [[1, 1], [s - 3, 1], [1, s - 3], [s - 3, s - 3]]) { p.R(x + nx, y + ny, 2, 2, PAL.metal.m); p.P(x + nx, y + ny, PAL.metal.ll); } };
  const grassEdgeNoise = () => { for (let i = 0; i < 3; i++) p.S(rr(0, 28), rr(0, 29), ST.tuftD, { D: PAL.tall.dd }); };

  switch (ch) {
    case '.': grassBase(); break;
    case ',': grassBase(); for (let i = 0; i < 2 + (variant & 1); i++) { const x = rr(1, 27), y = rr(1, 25); const c = vpick(['#ffffff', '#ffb8d8', '#fff08a', '#ff9a9a', '#c8b0ff']); p.S(x, y, ST.flower, { P: c, Y: '#ffd24a', S: G.dd }); p.P(x - 1, y + 3, G.dd); } break;
    case 't': { const T = PAL.tall; p.R(0, 0, 32, 32, T.m); for (let i = 0; i < 2; i++) { const x = rr(-4, 26), y = rr(-2, 26); p.E(x + 6, y + 3, 6, 3, T.d); }
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const x = i * 8 + (j & 1) * 4 + rr(-1, 1), y = j * 8 + rr(0, 1);
        // a tuft: three blades, dark roots, a slightly lighter tip. Dense enough to read as tall grass
        // (an evasion tile), light on contrast so a big field stays calm behind the units.
        p.S(x, y, ['..H..', 'L.L.L', '.LDL.', '.D.D.'], { H: T.l, L: mix(T.m, T.l, .55), D: mix(T.m, T.dd, .7) }); } break; }
    case 'T': grassBase(1); if (variant === 0) { tree(15, 12, 10); bush(27, 26, 4); } else if (variant === 1) { tree(10, 11, 9); tree(23, 18, 8); } else if (variant === 2) { tree(17, 13, 11); } else { tree(20, 11, 9); bush(7, 24, 5); bush(28, 27, 3); } break;
    case 'M': grassBase(1); { const R = PAL.rock, S = PAL.snow; const w = 30 - (variant & 1) * 2, h = 26 - (variant >> 1) * 2, x0 = 1 + (variant & 1), y0 = 4 + (variant >> 1) * 2; p.E(16, 30, 15, 3, G.dd);
      for (let j = 0; j < h; j++) { const ww = Math.round(w * (j + 1) / h); const xs = x0 + Math.round((w - ww) / 2); p.H(xs - 1, y0 + j, ww + 2, R.out); const lit = Math.max(1, Math.round(ww * .42)), dk = Math.max(1, Math.round(ww * .3)); p.H(xs, y0 + j, ww, R.m); p.H(xs, y0 + j, lit, R.l); p.H(xs + ww - dk, y0 + j, dk, R.d); if (j > h - 4) p.H(xs, y0 + j, ww, R.d); }
      // ridge line and crevices
      for (let j = 3; j < h - 2; j++) p.P(x0 + 15 + Math.floor(j / 6), y0 + j, R.dd); p.R(8, 16, 3, 1, R.dd); p.R(7, 17, 2, 1, R.dd); p.R(21, 19, 3, 1, R.dd); p.R(23, 20, 2, 1, R.dd); p.R(12, 22, 2, 1, R.dd); p.P(6, 21, R.ll); p.P(10, 13, R.ll); p.P(19, 24, R.ll);
      // snow cap with a jagged hem
      p.TRI(x0 + Math.round((w - 9) / 2), y0, 9, 6, S.m); p.TRI(x0 + Math.round((w - 5) / 2), y0, 5, 4, S.l); p.R(13, y0 + 6, 3, 1, S.m); p.P(19, y0 + 6, S.m); p.P(12, y0 + 7, S.d); p.R(17, y0 + 7, 2, 1, S.d); p.P(15, y0 + 8, S.d);
      boulder(2, 25, 6, 4); boulder(25, 24, 5, 4); } break;
    case '^': { const C = PAL.cliff; p.R(0, 0, 32, 32, C.m); for (let i = 0; i < 5; i++) { const x = rr(-2, 22), y = rr(-2, 22), w = rr(8, 13), h = rr(6, 10); p.R(x, y, w, h, C.l); p.H(x, y, w, C.ll); p.V(x, y, h, C.ll); p.H(x, y + h - 1, w, C.d); p.V(x + w - 1, y, h, C.d); p.P(x + w - 1, y + h - 1, C.dd); } for (let i = 0; i < 5; i++) { const x = rr(0, 26), y = rr(0, 31); p.H(x, y, rr(2, 5), C.dd); } break; }
    case '~': waterBase(frame, PAL.water); break;
    case 'w': waterBase(frame, PAL.cwater); break;
    case '=': { waterBase(frame, PAL.water); const K = PAL.plank; p.R(0, 4, 32, 24, K.m); for (let x = 0; x < 32; x += 5) { p.V(x, 4, 24, K.d); p.V(x + 1, 4, 24, K.l); } p.H(0, 4, 32, K.ll); p.H(0, 27, 32, K.d); p.H(0, 28, 32, PAL.outW); p.H(0, 3, 32, PAL.outW);
      // railings: rail bar + posts
      p.H(0, 1, 32, K.l); p.H(0, 2, 32, K.d); p.H(0, 29, 32, K.l); p.H(0, 30, 32, K.d); for (let x = 3; x < 32; x += 8) { p.R(x, 0, 2, 5, K.ll); p.V(x + 1, 0, 5, K.d); p.R(x, 27, 2, 5, K.ll); p.V(x + 1, 27, 5, K.d); } break; }
    case '#': { const R = PAL.road; p.R(0, 0, 32, 32, R.m); for (let i = 0; i < 2; i++) { const x = rr(-4, 26), y = rr(-2, 26); p.E(x + 6, y + 3, rr(4, 7), rr(2, 3), R.l); } for (let i = 0; i < 3; i++) { const x = rr(0, 29), y = rr(0, 30); p.H(x, y, rr(2, 3), mix(R.m, R.d, .7)); p.P(x + 1, y + 1, R.ll); } if (variant & 1) { const x = rr(1, 28), y = rr(1, 28); p.R(x, y, 2, 1, R.ll); p.P(x, y + 1, R.d); } break; }
    case 's': { const S = PAL.sand; p.R(0, 0, 32, 32, S.m); for (let i = 0; i < 2; i++) { const x = rr(-4, 26), y = rr(-2, 26); p.E(x + 6, y + 3, rr(5, 8), 2, S.l); } for (let i = 0; i < 2; i++) { const x = rr(0, 22), y = rr(2, 30); for (let k = 0; k < rr(4, 8); k++) p.P(x + k, y + (k > 2 ? 1 : 0), mix(S.m, S.d, .7)); } if (variant & 1) p.P(rr(0, 31), rr(0, 31), S.ll); break; }
    case 'C': grassBase(1); building({ roof: '#e04848', roofD: '#a82c2c', roofL: '#ff6a60', wall: '#f6f1e6', wallD: '#c8bfae', wallTop: 13, wallH: 14, ridge: 5 });
      p.S(14, 0, ST.pokeEmblem, { O: PAL.out, R: '#ff5a5a', W: '#ffffff' });
      p.R(11, 15, 10, 5, '#ffffff'); p.R(10, 14, 12, 7, PAL.out); p.R(11, 15, 10, 5, '#fff4d0'); p.R(13, 16, 2, 3, '#e04848'); p.P(15, 16, '#e04848'); p.P(15, 17, '#e04848'); p.R(17, 16, 3, 1, '#e04848'); p.P(17, 17, '#e04848'); p.P(17, 18, '#e04848');
      door(13, 22, 6, 5, '#8fd0ff'); p.V(16, 22, 5, PAL.out); win(6, 17, false); win(23, 17, false); break;
    case 'G': grassBase(1); building({ roof: '#3f6fd6', roofD: '#2a4a9a', roofL: '#5f8ff0', wall: '#d8dce8', wallD: '#a8adbf', wallTop: 12, wallH: 15, ridge: 4 });
      // columns, a GYM sign and a banner pole
      p.R(5, 13, 3, 13, '#eef0f6'); p.V(7, 13, 13, '#a8adbf'); p.R(24, 13, 3, 13, '#eef0f6'); p.V(26, 13, 13, '#a8adbf'); p.H(4, 12, 5, PAL.out); p.H(23, 12, 5, PAL.out);
      p.R(10, 14, 12, 6, PAL.out); p.R(11, 15, 10, 4, '#ffd24a'); p.H(12, 16, 2, '#3a2000'); p.V(12, 16, 3, '#3a2000'); p.P(13, 18, '#3a2000'); p.V(15, 16, 3, '#3a2000'); p.P(16, 16, '#3a2000'); p.V(17, 16, 3, '#3a2000'); p.V(19, 16, 3, '#3a2000'); p.P(18, 17, '#3a2000');
      door(13, 22, 6, 5, '#6a4a30'); p.V(30, 1, 14, '#eef0f6'); p.V(31, 1, 14, '#7a7f90'); p.R(24, 2, 6, 4, '#ffd24a'); p.R(25, 3, 4, 2, '#e0a020'); p.P(30, 0, '#ffd24a'); break;
    case 'H': grassBase(1); { const roofs = [['#8a5a3a', '#5c3a22', '#a8744a'], ['#5a6a8a', '#38455e', '#7a8aa8'], ['#6a8a4a', '#45602e', '#8aa866'], ['#9a5a6a', '#6a3a48', '#b87a8a']][variant]; building({ roof: roofs[0], roofD: roofs[1], roofL: roofs[2], wall: '#efe6d0', wallD: '#c0b49a', x0: 5, w: 22, wallTop: 14, wallH: 13, ridge: 5 });
      door(variant % 2 ? 9 : 17, 21, 5, 6, '#7a4a28'); win(variant % 2 ? 18 : 8, 17, variant > 1); p.R(22, 6, 3, 6, '#8a7a70'); p.R(22, 6, 1, 6, '#a89a90'); p.H(21, 5, 5, PAL.out); p.H(22, 6, 3, '#6a5a50'); if (variant === 2) { p.R(3, 25, 3, 4, '#c8c8d0'); p.R(4, 24, 1, 5, '#9a9aa8'); } } break;
    case 'c': caveBase(); break;
    case 'r': caveBase(); boulder(3, 4, 12, 9); boulder(17, 9, 9, 7); boulder(8, 17, 10, 8); boulder(20, 20, 8, 6); p.P(6, 27, PAL.rock.l); p.P(27, 5, PAL.rock.l); p.R(24, 28, 3, 1, PAL.rock.d); break;
    case 'W': { const C = PAL.cwall; p.R(0, 0, 32, 32, C.top);
      // dense rock mass seen from above: small bumps lit from the top-left, hairline cracks
      for (let i = 0; i < 5; i++) { const x = rr(0, 27), y = rr(0, 27), w = rr(3, 5), h = rr(2, 4); p.E(x + w / 2, y + h / 2, w / 2, h / 2, C.topL); p.P(x + 1, y, C.face); p.P(x + w - 1, y + h, C.out); }
      for (let i = 0; i < 2; i++) { const x = rr(0, 26), y = rr(0, 30); p.H(x, y, rr(2, 5), C.out); p.P(x + rr(2, 5), y + 1, C.out); } break; }
    case 'f': floorBase(); break;
    case 'b': { const B = PAL.bwall; p.R(0, 0, 32, 32, B.top); for (let y = 0; y < 32; y += 8) for (let x = ((y / 8) & 1) * 8 - 8; x < 32; x += 16) { p.R(x + 1, y + 1, 14, 6, mix(B.top, B.topL, .7)); p.H(x + 1, y + 1, 14, B.topL); } break; }
    case 'L': { const L = PAL.lava; p.R(0, 0, 32, 32, L.m); const w = mulberry32(variant * 9 + 3);
      for (let i = 0; i < 4; i++) { const x = Math.floor(w() * 28), y = Math.floor(w() * 28); p.E(x + 4, y + 3, 5 + Math.floor(w() * 3), 3, L.d); p.E(x + 4, y + 3, 3, 2, L.dd); }
      for (let i = 0; i < 5; i++) { const bx = Math.floor(w() * 30), by = Math.floor(w() * 30); const x = (bx + frame * 2 + i * 3) % 30; p.H(x, by, 3 + Math.floor(w() * 4), 2, L.l); p.H(x + 1, by, 3, 1, L.ll); }
      for (let i = 0; i < 3; i++) { const x = Math.floor(w() * 30), y = Math.floor(w() * 30); if ((i + frame) % 2) { p.P(x, y, L.w); p.P(x + 1, y, L.ll); } } break; }
    case 'p': floorBase(); { const M = PAL.metal; p.R(9, 1, 14, 30, PAL.out); p.R(10, 2, 12, 28, M.m); p.R(10, 2, 3, 28, M.l); p.V(10, 2, 28, M.ll); p.R(19, 2, 3, 28, M.d); p.V(21, 2, 28, shade(M.d, -.3)); p.R(7, 0, 18, 4, PAL.out); p.R(8, 0, 16, 3, M.l); p.H(8, 0, 16, M.ll); p.R(7, 27, 18, 5, PAL.out); p.R(8, 28, 16, 3, M.m); p.H(8, 28, 16, M.l); p.E(16, 31, 11, 2, '#00000060'); } break;
    case 'x': floorBase(); crate(3, 14, 13); crate(17, 16, 12); crate(9, 3, 12); break;
    case 'i': { const I = PAL.ice; p.R(0, 0, 32, 32, I.m); for (let i = 0; i < 2; i++) { const x = rr(-2, 24), y = rr(-2, 24); p.E(x + 6, y + 3, rr(5, 8), rr(2, 3), I.l); } for (let i = 0; i < 2; i++) { const x = rr(2, 22), y = rr(2, 22), len = rr(4, 9); for (let k = 0; k < len; k++) p.P(x + k, y + Math.floor(k / 2), I.d); p.P(x + len, y + Math.floor(len / 2) + 1, I.d); } for (let i = 0; i < 2; i++) { const x = rr(0, 26), y = rr(0, 30); p.H(x, y, rr(3, 6), I.ll); } break; }
    case 'S': { const S = PAL.snow; p.R(0, 0, 32, 32, S.m); for (let i = 0; i < 2; i++) { const x = rr(-2, 24), y = rr(-2, 24); p.E(x + 6, y + 3, rr(5, 8), rr(2, 3), S.l); } for (let i = 0; i < 2; i++) { const x = rr(0, 28), y = rr(0, 30); p.H(x, y, rr(2, 4), S.d); } if (variant & 1) p.P(rr(0, 31), rr(0, 31), '#ffffff'); break; }
    default: p.R(0, 0, 32, 32, '#ff00ff');
  }
}
function buildTileset() {
  for (const ch in TERRAIN) for (let v = 0; v < VARIANTS; v++) {
    const frames = (ch === '~' || ch === 'w' || ch === '=' || ch === 'L') ? WATER_FRAMES : 1;
    for (let f = 0; f < frames; f++) { const c = tileCanvas(); drawTile(ch, v, f, c.getContext('2d')); TILESET[ch + v + f] = c; }
  }
}
function tileImg(ch, v, f) { const frames = (ch === '~' || ch === 'w' || ch === '=' || ch === 'L') ? WATER_FRAMES : 1; return TILESET[ch + (v % VARIANTS) + (f % frames)] || TILESET['.00']; }

// ---------------------------------------------------------------- autotile overlays
const EDGES = new Map();
function edgeCanvas(key, fn) { let c = EDGES.get(key); if (c) return c; c = tileCanvas(); fn(painter(c.getContext('2d')), c.getContext('2d')); EDGES.set(key, c); return c; }
// Land colours used for the bank of a liquid tile bordering it.
function bankOf(t) {
  if (!t) return null; const id = t.id;
  if (GRASSY.has(id)) return { lip: PAL.grass.d, earth: PAL.road.earth, earthD: PAL.road.earthD };
  if (id === 'sand') return { lip: PAL.sand.d, earth: '#c8a860', earthD: '#9a7a40' };
  if (id === 'road') return { lip: PAL.road.d, earth: PAL.road.earth, earthD: PAL.road.earthD };
  if (id === 'cave' || id === 'rubble' || id === 'wall') return { lip: PAL.cave.l, earth: PAL.cave.dd, earthD: '#241c2a' };
  if (id === 'floor' || id === 'bwall' || id === 'pillar' || id === 'crate') return { lip: PAL.floor.d, earth: '#4e4858', earthD: '#332e3c' };
  if (id === 'snow' || id === 'ice') return { lip: PAL.snow.d, earth: '#8ea2bc', earthD: '#63768f' };
  if (id === 'rock') return { lip: PAL.cliff.l, earth: PAL.cliff.d, earthD: PAL.cliff.dd };
  return { lip: PAL.grass.d, earth: PAL.road.earth, earthD: PAL.road.earthD };
}
// Neighbour helper over a parsed map (tiles[y][x]); outside the map counts as the same tile (no edge).
function nb(m, x, y, dx, dy) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= m.w || Y >= m.h) return null; return m.tiles[Y][X]; }
// Draws base tile + context-aware overlays for tile (x,y) at screen (X,Y).
function drawTerrain(g, m, x, y, X, Y, frame, time = 0) {
  const t = m.tiles[y][x]; const v = m.variants[y][x]; const id = t.id;
  g.drawImage(tileImg(t.ch, v, frame), X, Y);
  const N = nb(m, x, y, 0, -1), S = nb(m, x, y, 0, 1), W = nb(m, x, y, -1, 0), E = nb(m, x, y, 1, 0);
  if (id === 'water' || id === 'lava') {
    const isLand = n => n && !LIQUID.has(n.id) && n.id !== 'bridge';
    const sides = [isLand(N), isLand(E), isLand(S), isLand(W)]; const diag = [nb(m, x, y, 1, -1), nb(m, x, y, 1, 1), nb(m, x, y, -1, 1), nb(m, x, y, -1, -1)].map(isLand);
    const mask = sides.reduce((a, b, i) => a | (b ? 1 << i : 0), 0) | diag.reduce((a, b, i) => a | (b ? 16 << i : 0), 0);
    if (mask) {
      const lava = id === 'lava'; const banks = [N, E, S, W].map(n => bankOf(n)); const bk = banks.map(b => b ? b.lip : '-').join('');
      const key = 'sh' + t.ch + mask + frame + bk + (lava ? 'L' : '');
      g.drawImage(edgeCanvas(key, p => drawShoreOverlay(p, sides, diag, banks, frame, lava, t.ch === 'w')), X, Y);
    }
  } else if (id === 'road' || id === 'sand') {
    const isG = n => n && GRASSY.has(n.id); const sides = [isG(N), isG(E), isG(S), isG(W)];
    const mask = sides.reduce((a, b, i) => a | (b ? 1 << i : 0), 0);
    if (mask) g.drawImage(edgeCanvas('rd' + t.ch + mask + v, p => drawGrassLip(p, sides, v, t.ch)), X, Y);
  } else if (id === 'wall' || id === 'bwall' || id === 'rock') {
    const open = n => n && n.id !== id && OPEN.has(n.id) || (n && n.id !== id && (n.id === 'house' || n.id === 'pillar'));
    const sides = [open(N), open(E), open(S), open(W)]; const mask = sides.reduce((a, b, i) => a | (b ? 1 << i : 0), 0);
    if (mask) g.drawImage(edgeCanvas('wl' + t.ch + mask + v, p => drawWallFace(p, sides, v, id)), X, Y);
  } else if (id === 'tall') {
    const isT = n => !n || n.id === 'tall' || n.id === 'forest'; const sides = [!isT(N), !isT(E), !isT(S), !isT(W)]; const mask = sides.reduce((a, b, i) => a | (b ? 1 << i : 0), 0);
    if (mask) g.drawImage(edgeCanvas('tg' + mask + v, p => drawTallEdge(p, sides, v)), X, Y);
  }
  // soft ground shadow cast south by tall things
  if ((id === 'forest' || id === 'mountain' || id === 'house' || id === 'center' || id === 'gym' || id === 'wall' || id === 'bwall' || id === 'rock' || id === 'pillar') && S && OPEN.has(S.id) && S.id !== 'water' && S.id !== 'lava' && S.id !== id) {
    g.globalAlpha = .22; g.fillStyle = '#000000'; g.fillRect(X, Y + TILE, TILE, 3); g.globalAlpha = .1; g.fillRect(X, Y + TILE + 3, TILE, 2); g.globalAlpha = 1;
  }
}
// Shoreline drawn on the liquid tile: a lip of the land colour, an earth bank, a foam line and a dithered wet band.
function drawShoreOverlay(p, sides, diag, banks, frame, lava, cave) {
  const foam = lava ? PAL.lava.ll : cave ? PAL.cwater.foam : PAL.water.foam, wet = lava ? PAL.lava.l : cave ? PAL.cwater.ll : PAL.water.ll;
  const ph = frame % 2;
  const bank = (i, fn) => { const b = banks[i] || banks.find(Boolean) || bankOf({ id: 'plain' }); fn(lava ? { lip: '#2a1a14', earth: '#1a100c', earthD: '#0a0604' } : b); };
  // N
  if (sides[0]) bank(0, b => { p.H(0, 0, 32, b.lip); p.H(0, 1, 32, b.earth); p.H(0, 2, 32, b.earthD); p.H(0, 3, 32, foam); for (let x = ph; x < 32; x += 2) p.P(x, 4, wet); for (let x = 1 - ph; x < 32; x += 4) p.P(x, 5, wet); });
  if (sides[2]) bank(2, b => { p.H(0, 31, 32, b.lip); p.H(0, 30, 32, b.earth); p.H(0, 29, 32, foam); for (let x = ph; x < 32; x += 2) p.P(x, 28, wet); for (let x = 1 - ph; x < 32; x += 4) p.P(x, 27, wet); });
  if (sides[3]) bank(3, b => { p.V(0, 0, 32, b.lip); p.V(1, 0, 32, b.earth); p.V(2, 0, 32, foam); for (let y = ph; y < 32; y += 2) p.P(3, y, wet); for (let y = 1 - ph; y < 32; y += 4) p.P(4, y, wet); });
  if (sides[1]) bank(1, b => { p.V(31, 0, 32, b.lip); p.V(30, 0, 32, b.earth); p.V(29, 0, 32, foam); for (let y = ph; y < 32; y += 2) p.P(28, y, wet); for (let y = 1 - ph; y < 32; y += 4) p.P(27, y, wet); });
  // outer corners rounded where two banks meet, inner corner nubs where only the diagonal is land
  const corner = (cx, cy, dx, dy, i) => bank(i, b => { p.P(cx, cy, b.lip); p.P(cx + dx, cy, b.earth); p.P(cx, cy + dy, b.earth); p.P(cx + dx, cy + dy, b.earth); p.P(cx + 2 * dx, cy + dy, foam); p.P(cx + dx, cy + 2 * dy, foam); p.P(cx + 2 * dx, cy + 2 * dy, foam); });
  if (!sides[0] && !sides[1] && diag[0]) corner(31, 0, -1, 1, 1);
  if (!sides[1] && !sides[2] && diag[1]) corner(31, 31, -1, -1, 1);
  if (!sides[2] && !sides[3] && diag[2]) corner(0, 31, 1, -1, 3);
  if (!sides[3] && !sides[0] && diag[3]) corner(0, 0, 1, 1, 3);
  if (sides[0] && sides[3]) { p.P(3, 3, foam); p.P(4, 4, wet); } if (sides[0] && sides[1]) { p.P(28, 3, foam); p.P(27, 4, wet); }
  if (sides[2] && sides[3]) { p.P(3, 29, foam); p.P(4, 28, wet); } if (sides[2] && sides[1]) { p.P(28, 29, foam); p.P(27, 28, wet); }
  if (lava) { // glow on the bank
    const gl = PAL.lava.ll; if (sides[0]) for (let x = 0; x < 32; x += 3) p.P(x + (frame % 3), 3, gl); if (sides[2]) for (let x = 0; x < 32; x += 3) p.P(x + (frame % 3), 29, gl); }
}
// Scalloped grass overhang on the edge of a road/sand tile.
function drawGrassLip(p, sides, v, ch) {
  const G = PAL.grass; const r = mulberry32(v * 61 + ch.charCodeAt(0)); const rr = (a, b) => a + Math.floor(r() * (b - a + 1));
  const lip = (len, at) => { // at(k, depth) paints pixel k along the edge at the given depth
    let x = 0; while (x < len) { const w = rr(2, 5), d = rr(1, 3); for (let k = 0; k < w && x + k < len; k++) { for (let q = 0; q < d; q++) at(x + k, q, q === d - 1 ? G.dd : q === 0 ? G.l : G.m); } x += w; if (r() < .35) { at(x, 0, G.m); at(x, 1, G.dd); x++; } } };
  if (sides[0]) lip(32, (k, q, c) => p.P(k, q, c));
  if (sides[2]) lip(32, (k, q, c) => p.P(k, 31 - q, c));
  if (sides[3]) lip(32, (k, q, c) => p.P(q, k, c));
  if (sides[1]) lip(32, (k, q, c) => p.P(31 - q, k, c));
  const cornerFill = (cx, cy, dx, dy) => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4 - j; i++) p.P(cx + i * dx, cy + j * dy, i + j === 3 ? G.dd : G.m); };
  if (sides[0] && sides[3]) cornerFill(0, 0, 1, 1); if (sides[0] && sides[1]) cornerFill(31, 0, -1, 1); if (sides[2] && sides[3]) cornerFill(0, 31, 1, -1); if (sides[2] && sides[1]) cornerFill(31, 31, -1, -1);
}
// Tall grass fades into plain grass with a ragged blade edge.
function drawTallEdge(p, sides, v) {
  const T = PAL.tall, r = mulberry32(v * 17 + 3); const rr = (a, b) => a + Math.floor(r() * (b - a + 1));
  const frill = at => { for (let k = 0; k < 32; k += 2) { const h = rr(0, 2); for (let q = 0; q <= h; q++) at(k + (q & 1), q, q === h ? T.ll : T.l); } };
  if (sides[0]) frill((k, q, c) => p.P(k, q, c)); if (sides[2]) frill((k, q, c) => p.P(k, 31 - q, c)); if (sides[3]) frill((k, q, c) => p.P(q, k, c)); if (sides[1]) frill((k, q, c) => p.P(31 - q, k, c));
}
// Walls: a lit rim on open sides, and a full front face when the tile south is open.
function drawWallFace(p, sides, v, id) {
  const r = mulberry32(v * 29 + 11); const rr = (a, b) => a + Math.floor(r() * (b - a + 1));
  if (id === 'wall') { const C = PAL.cwall;
    if (sides[2]) { // rocky face: rounded boulders packed in rows, lit from above, darker toward the floor
      p.R(0, 12, 32, 20, C.face); p.H(0, 12, 32, C.faceLL); p.H(0, 13, 32, C.faceL);
      for (let j = 0; j < 3; j++) { const y = 15 + j * 5 + rr(0, 1); let x = rr(-4, 0); while (x < 32) { const w = rr(5, 10), h = rr(3, 4); p.E(x + w / 2, y + h / 2, w / 2, h / 2, C.faceD); p.E(x + w / 2, y + h / 2 - 1, w / 2 - 1, h / 2, C.faceL); p.H(x + 2, y, Math.max(1, w - 4), C.faceLL); x += w + rr(0, 2); } }
      p.R(0, 27, 32, 3, C.faceD); for (let x = rr(0, 3); x < 32; x += rr(4, 7)) p.P(x, 28, C.face);
      p.H(0, 30, 32, C.out); p.H(0, 31, 32, C.out); p.H(0, 11, 32, C.out);
      if (!sides[3]) p.V(0, 12, 20, C.faceD); if (!sides[1]) p.V(31, 12, 20, C.faceD);
    }
    if (sides[0]) { p.H(0, 0, 32, C.out); p.H(0, 1, 32, C.faceLL); p.H(0, 2, 32, C.faceL); }
    if (sides[3]) { p.V(0, 0, 32, C.out); p.V(1, 0, sides[2] ? 12 : 32, C.faceL); }
    if (sides[1]) { p.V(31, 0, 32, C.out); p.V(30, 0, sides[2] ? 12 : 32, C.topL); }
  } else if (id === 'bwall') { const B = PAL.bwall;
    if (sides[2]) { // brick face in running bond with mortar
      p.R(0, 10, 32, 22, B.mortar); for (let y = 10; y < 32; y += 6) { const off = ((y - 10) / 6 & 1) * 8; for (let x = off - 16; x < 32; x += 16) { p.R(x + 1, y + 1, 14, 4, B.face); p.H(x + 1, y + 1, 14, B.faceL); p.P(x + 1, y + 1, B.faceLL); p.H(x + 1, y + 4, 14, shade(B.face, -.25)); } }
      p.H(0, 9, 32, B.out); p.H(0, 10, 32, B.faceLL); p.H(0, 31, 32, B.out); p.H(0, 30, 32, shade(B.mortar, -.3));
      if (!sides[3]) p.V(0, 10, 22, shade(B.mortar, -.3)); if (!sides[1]) p.V(31, 10, 22, shade(B.mortar, -.3));
    }
    if (sides[0]) { p.H(0, 0, 32, B.out); p.H(0, 1, 32, B.faceLL); }
    if (sides[3]) { p.V(0, 0, 32, B.out); p.V(1, 0, sides[2] ? 10 : 32, B.faceL); }
    if (sides[1]) { p.V(31, 0, 32, B.out); p.V(30, 0, sides[2] ? 10 : 32, B.top); }
  } else { const C = PAL.cliff; // cliff
    if (sides[2]) { p.R(0, 14, 32, 18, C.d); p.H(0, 14, 32, C.ll); p.H(0, 15, 32, C.l); for (let j = 0; j < 3; j++) { const y = 18 + j * 4 + rr(0, 1); let x = rr(-3, 0); while (x < 32) { const w = rr(5, 10); p.H(x, y, w, C.m); p.H(x, y + 1, w, C.dd); x += w + rr(1, 2); } } p.H(0, 30, 32, C.dd); p.H(0, 31, 32, '#241e26'); p.H(0, 13, 32, '#241e26'); }
    if (sides[0]) { p.H(0, 0, 32, '#241e26'); p.H(0, 1, 32, C.ll); } if (sides[3]) { p.V(0, 0, 32, '#241e26'); p.V(1, 0, sides[2] ? 14 : 32, C.l); } if (sides[1]) { p.V(31, 0, 32, '#241e26'); p.V(30, 0, sides[2] ? 14 : 32, C.dd); }
  }
}

// ---------------------------------------------------------------- range / cursor / arrow overlays
function rangeOverlay(cells, inSet, sx, sy, col, edgeCol, phase) {
  ctx.globalAlpha = .34;
  for (const c of cells) rect(sx + c.x * TILE, sy + c.y * TILE, TILE, TILE, col);
  // slow diagonal shimmer (very quiet)
  ctx.globalAlpha = .06; ctx.fillStyle = '#ffffff';
  for (const c of cells) { const X = sx + c.x * TILE, Y = sy + c.y * TILE; for (let j = 0; j < TILE; j++) { const i0 = (j + phase * 2) % 16; for (let i = i0; i < TILE; i += 16) ctx.fillRect(X + i, Y + j, 3, 1); } }
  ctx.globalAlpha = 1;
  // crisp outer edge (light) with a darker inner line
  const dark = shade(col, -.35);
  for (const c of cells) {
    const X = sx + c.x * TILE, Y = sy + c.y * TILE;
    if (!inSet(c.x, c.y - 1)) { rect(X, Y, TILE, 1, edgeCol); ctx.globalAlpha = .5; rect(X, Y + 1, TILE, 1, dark); ctx.globalAlpha = 1; }
    if (!inSet(c.x, c.y + 1)) { rect(X, Y + TILE - 1, TILE, 1, edgeCol); ctx.globalAlpha = .5; rect(X, Y + TILE - 2, TILE, 1, dark); ctx.globalAlpha = 1; }
    if (!inSet(c.x - 1, c.y)) { rect(X, Y, 1, TILE, edgeCol); ctx.globalAlpha = .5; rect(X + 1, Y, 1, TILE, dark); ctx.globalAlpha = 1; }
    if (!inSet(c.x + 1, c.y)) { rect(X + TILE - 1, Y, 1, TILE, edgeCol); ctx.globalAlpha = .5; rect(X + TILE - 2, Y, 1, TILE, dark); ctx.globalAlpha = 1; }
  }
}
// Pixel ellipse ring (outer radius rx/ry, `th` pixels thick) — used for unit bases and selection pulses.
function ellipseRing(cx, cy, rx, ry, th, c) {
  ctx.fillStyle = c; cx |= 0; cy |= 0;
  for (let y = -ry; y <= ry; y++) {
    const wo = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + .5);
    const ry2 = ry - th, rx2 = rx - th; const wi = (ry2 > 0 && Math.abs(y) <= ry2) ? Math.floor(rx2 * Math.sqrt(Math.max(0, 1 - (y * y) / (ry2 * ry2))) + .5) : -1;
    if (wi < 0) ctx.fillRect(cx - wo, cy + y, 2 * wo + 1, 1); else { ctx.fillRect(cx - wo, cy + y, wo - wi, 1); ctx.fillRect(cx + wi + 1, cy + y, wo - wi, 1); }
  }
}
// Bracket cursor: four L-shaped corners that snap in from wide when the cursor lands on a new tile, then breathe.
const CUR = { x: null, y: null, t0: 0 };
function drawCursorGlow(x, y, t) {
  const k = .5 + .5 * Math.sin(t / 220); ctx.globalAlpha = .08 + .07 * k; rect(x, y, TILE, TILE, '#ffffff');
  ctx.globalAlpha = .18 + .12 * k; outline(x, y, TILE, TILE, '#ffffff'); ctx.globalAlpha = 1;
}
function drawCursor(x, y, t, col = '#ffffff', col2 = '#ffd24a') {
  if (CUR.x !== x || CUR.y !== y) { CUR.x = x; CUR.y = y; CUR.t0 = t; }
  const snap = REDUCED ? 0 : Math.max(0, 1 - (t - CUR.t0) / 130); // 1 → just landed
  const o = 2 + Math.round(Math.sin(t / 180) * 1.5 + snap * snap * 7); const L = 9, T2 = 3;
  const corners = [[x - o, y - o, 1, 1], [x + TILE + o, y - o, -1, 1], [x - o, y + TILE + o, 1, -1], [x + TILE + o, y + TILE + o, -1, -1]];
  const Lshape = (cx, cy, dx, dy, len, th, c, inset) => {
    const x0 = dx > 0 ? cx + inset : cx - inset - len + 1, y0 = dy > 0 ? cy + inset : cy - inset - th + 1; rect(x0, y0, len, th, c);
    const x1 = dx > 0 ? cx + inset : cx - inset - th + 1, y1 = dy > 0 ? cy + inset : cy - inset - len + 1; rect(x1, y1, th, len, c);
  };
  const dark = shade(col2, -.6);
  for (const [cx, cy, dx, dy] of corners) {
    ctx.globalAlpha = .45; Lshape(cx + 1, cy + 2, dx, dy, L + 1, T2 + 2, '#000000', -1); ctx.globalAlpha = 1; // soft drop shadow
    Lshape(cx, cy, dx, dy, L + 1, T2 + 2, UI.shadow, -1); // outline
    Lshape(cx, cy, dx, dy, L, T2, col, 0); // body
    Lshape(cx, cy, dx, dy, L - 1, 1, col2, T2 - 1); // inner accent
    Lshape(cx, cy, dx, dy, L - 2, 1, dark, T2 - 1); ctx.globalAlpha = .35; Lshape(cx, cy, dx, dy, L - 2, 1, col2, T2 - 1); ctx.globalAlpha = 1; // accent shading
    px(cx, cy, col2); // rounded outer corner: coloured tip pixel
    px(cx + dx * (L - 1), cy, col2); px(cx, cy + dy * (L - 1), col2); // bright tips on the bracket ends
  }
  if (snap > .5 && !REDUCED) { ctx.globalAlpha = (snap - .5) * 2 * .6; outline(x - 1, y - 1, TILE + 2, TILE + 2, col); ctx.globalAlpha = 1; }
}
// FE-style path arrow. Each cell is one piece (tail, straight, corner, head), built once from a silhouette mask and
// shaded per pixel (light from the top-left) so the shaft reads as a bevelled tube with a crisp dark outline.
const ARROW = {};
const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const ARROW_PAL = { OUT: '#4a1e00', DK: '#d0601a', MID: '#ff9f2e', LT: '#ffd45a', LT2: '#ffbf42', GL: '#fff2b0' };
function arrowMask(din, dout) {
  const C = 16, hw = 4, inD = din !== '-' ? opp(din) : null; const dirs = []; if (inD) dirs.push(inD); if (dout !== '-') dirs.push(dout);
  const m = new Uint8Array(32 * 32); const set = (x, y) => { if (x >= 0 && y >= 0 && x < 32 && y < 32) m[y * 32 + x] = 1; };
  const inBar = (d, x, y) => { const [dx, dy] = DIRS[d]; const ax = x - C, ay = y - C; if (dx) return Math.sign(ax) === dx || ax === 0 ? Math.abs(ay) <= hw : false; return Math.sign(ay) === dy || ay === 0 ? Math.abs(ax) <= hw : false; };
  const isHead = dout === '-' && din !== '-';
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    let on = false;
    if (isHead) { // shaft from the entering edge to the head base, then a chevron
      const d = din, [dx, dy] = DIRS[d]; const s = dx ? (x - C) * dx : (y - C) * dy, w = dx ? Math.abs(y - C) : Math.abs(x - C);
      const base = -3, tip = 9, HW = 9; if (s <= base && w <= hw) on = true; if (s >= base && s <= tip) { const ww = Math.round(HW * (1 - (s - base) / (tip - base))); if (w <= ww) on = true; }
    } else {
      for (const d of dirs) if (inBar(d, x, y)) on = true;
      if (din === '-') { const dd = (x - C) * (x - C) + (y - C) * (y - C); if (dd <= (hw + 1.5) * (hw + 1.5)) on = true; } // tail knob
      if (dirs.length === 2 && inD !== dout) { // round the outer elbow of a corner
        const [ax, ay] = DIRS[inD], [bx, by] = DIRS[dout]; const ex = -(ax + bx), ey = -(ay + by);
        if (Math.sign(x - C) === ex && Math.sign(y - C) === ey) { const dd = (x - C) * (x - C) + (y - C) * (y - C); if (dd > (hw + .5) * (hw + .5)) on = false; }
      }
    }
    if (on) set(x, y);
  }
  return m;
}
function arrowPiece(din, dout, variant = '') {
  const key = din + dout + variant; if (ARROW[key]) return ARROW[key];
  const c = tileCanvas(); const g = c.getContext('2d'); const m = arrowMask(din, dout); const P = ARROW_PAL;
  const ex = new Set(); if (din !== '-') ex.add(opp(din)); if (dout !== '-') ex.add(dout); // sides where the shaft leaves the cell
  const at = (x, y) => x >= 0 && y >= 0 && x < 32 && y < 32 ? m[y * 32 + x] : ((x < 0 && ex.has('W') || x >= 32 && ex.has('E')) && Math.abs(y - 16) <= 4 || (y < 0 && ex.has('N') || y >= 32 && ex.has('S')) && Math.abs(x - 16) <= 4 ? 1 : 0);
  const isOut = (x, y) => !at(x, y) && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1));
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (variant === 'shadow') { if (at(x, y) || isOut(x, y)) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y, 1, 1); } continue; }
    if (variant === 'shine') { if (at(x, y)) { g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1); } continue; }
    if (!at(x, y)) { if (isOut(x, y)) { g.fillStyle = P.OUT; g.fillRect(x, y, 1, 1); } continue; }
    let col = P.MID;
    if (!at(x, y - 1)) col = P.LT; else if (!at(x, y - 2)) col = P.LT2; else if (!at(x - 1, y)) col = P.LT; else if (!at(x - 2, y)) col = P.LT2;
    else if (!at(x, y + 1)) col = P.DK; else if (!at(x + 1, y)) col = P.DK;
    if (!at(x, y - 1) && !at(x - 1, y)) col = P.GL; // top-left corner glint
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  if (variant === '' && din === '-') { const p = painter(g); p.C(16, 16, 2, P.OUT); p.P(16, 16, P.GL); p.P(15, 15, P.GL); } // tail knob ring
  ARROW[key] = c; return c;
}
function opp(d) { return d === 'N' ? 'S' : d === 'S' ? 'N' : d === 'E' ? 'W' : 'E'; }
function dirOf(a, b) { return b.x > a.x ? 'E' : b.x < a.x ? 'W' : b.y > a.y ? 'S' : 'N'; }
const ARROW_ST = { sig: '', t0: 0 };
function drawArrow(path, sx, sy, t = performance.now()) {
  if (path.length < 2) return;
  const n = path.length; const last = path[n - 1]; const sig = n + ':' + last.x + ',' + last.y; if (sig !== ARROW_ST.sig) { ARROW_ST.sig = sig; ARROW_ST.t0 = t; }
  const pop = REDUCED ? 0 : Math.max(0, 1 - (t - ARROW_ST.t0) / 110);
  const kinds = []; for (let i = 0; i < n; i++) kinds.push([i > 0 ? dirOf(path[i - 1], path[i]) : '-', i < n - 1 ? dirOf(path[i], path[i + 1]) : '-']);
  for (let i = 0; i < n; i++) ctx.drawImage(arrowPiece(kinds[i][0], kinds[i][1], 'shadow'), sx + path[i].x * TILE + 1, sy + path[i].y * TILE + 2);
  for (let i = 0; i < n; i++) {
    const X = sx + path[i].x * TILE, Y = sy + path[i].y * TILE;
    if (i === n - 1 && pop > 0) { const sc = 1 + pop * .35; ctx.drawImage(arrowPiece(kinds[i][0], kinds[i][1]), Math.round(X - (sc - 1) * 16), Math.round(Y - (sc - 1) * 16), Math.round(32 * sc), Math.round(32 * sc)); }
    else ctx.drawImage(arrowPiece(kinds[i][0], kinds[i][1]), X, Y);
  }
  if (!REDUCED) { // a soft light pulse runs from the tail to the head
    const pos = ((t / 1000) * 7) % (n + 4) - 1;
    for (let i = 0; i < n; i++) { const a = Math.max(0, 1 - Math.abs(i - pos) / 1.5) * .45; if (a <= 0) continue; ctx.globalAlpha = a; ctx.drawImage(arrowPiece(kinds[i][0], kinds[i][1], 'shine'), sx + path[i].x * TILE, sy + path[i].y * TILE); }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- particles, sprites & floaters
const FX = { parts: [], texts: [], sprites: [], shake: 0, shakeX: 0, shakeY: 0, flash: 0, flashCol: '#ffffff', zoom: 0, hitstop: 0, slow: 0 };
function spawnParts(x, y, n, col, opt = {}) {
  if (REDUCED) n = Math.min(n, 4);
  for (let i = 0; i < n; i++) { const a = vrnd() * Math.PI * 2, sp = (opt.speed || 60) * (0.4 + vrnd()); FX.parts.push({ x, y, vx: Math.cos(a) * sp + (opt.vx || 0), vy: Math.sin(a) * sp * (opt.flat ? .4 : 1) + (opt.vy || 0), life: (opt.life || .5) * (0.6 + vrnd() * .6), t: 0, col: Array.isArray(col) ? vpick(col) : col, size: opt.size || 2, grav: opt.grav == null ? 120 : opt.grav, shape: opt.shape || 'sq' }); }
}
// Shaped effect sprite. kinds: burst flash slash flame drop bolt leaf bubble shard rock wisp psy poof spark heart wind star
function spawnSprite(kind, x, y, o = {}) {
  if (REDUCED && FX.sprites.length > 12) return null;
  const s = { kind, x, y, vx: o.vx || 0, vy: o.vy || 0, t: -(o.delay || 0), life: o.life || .5, col: o.col || '#ffffff', col2: o.col2 || '#ffffff', size: o.size || 6, grav: o.grav || 0, rot: o.rot || 0, spin: o.spin || 0, seed: Math.floor(vrnd() * 1e6), arc: o.arc || 0, x0: x, y0: y, tx: o.tx, ty: o.ty, trail: o.trail || null, len: o.len || 0, orbit: o.orbit || null, dir: o.dir || 1 };
  FX.sprites.push(s); return s;
}
function floatText(x, y, s, col = '#ffffff', opt = {}) { FX.texts.push({ x, y, s, col, t: 0, life: opt.life || 1, big: !!opt.big, outline: opt.outline || UI.shadow, vy: opt.vy == null ? -26 : opt.vy, delay: opt.delay || 0, pop: opt.pop !== false }); }
function updateFX(dt) {
  for (const p of FX.parts) { p.t += dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  FX.parts = FX.parts.filter(p => p.t < p.life);
  for (const s of FX.sprites) { s.t += dt; if (s.t < 0) continue; if (s.orbit) { const o = s.orbit, k = Math.min(1, s.t / s.life), a = o.a0 + s.t * o.speed, r = o.r * (o.shrink ? 1 - k * .8 : 1); s.x = s.x0 + Math.cos(a) * r; s.y = s.y0 + Math.sin(a) * r * (o.squash || .45); } else if (s.tx != null) { const k = Math.min(1, s.t / s.life); s.x = lerp(s.x0, s.tx, k); s.y = lerp(s.y0, s.ty, k) - Math.sin(k * Math.PI) * s.arc; } else { s.vy += s.grav * dt; s.x += s.vx * dt; s.y += s.vy * dt; } s.rot += s.spin * dt; if (s.trail && vrnd() < .6) spawnParts(s.x, s.y, 1, s.trail, { speed: 12, life: .25, grav: 0, size: 2 }); }
  FX.sprites = FX.sprites.filter(s => s.t < s.life);
  for (const f of FX.texts) { if (f.delay > 0) { f.delay -= dt; continue; } f.t += dt; f.y += f.vy * dt * (f.t < .25 ? 1 : .25); }
  FX.texts = FX.texts.filter(f => f.t < f.life);
  if (FX.shake > 0) { FX.shake = Math.max(0, FX.shake - dt * 30); const m = REDUCED ? 0 : FX.shake; FX.shakeX = Math.round((vrnd() * 2 - 1) * m); FX.shakeY = Math.round((vrnd() * 2 - 1) * m); } else { FX.shakeX = FX.shakeY = 0; }
  if (FX.flash > 0) FX.flash = Math.max(0, FX.flash - dt * 4);
  if (FX.zoom > 0) FX.zoom = Math.max(0, FX.zoom - dt * 3);
}
// pixel line (Bresenham) for effect strokes
function pline(x0, y0, x1, y1, c, w = 1) { ctx.fillStyle = c; x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy; for (let n = 0; n < 400; n++) { ctx.fillRect(x0 - (w >> 1), y0 - (w >> 1), w, w); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } }
function drawSprite(s, ox, oy) {
  const k = Math.max(0, s.t / s.life), x = Math.round(s.x + ox), y = Math.round(s.y + oy); const fade = k > .6 ? 1 - (k - .6) / .4 : 1; const R = mulberry32(s.seed);
  ctx.globalAlpha = fade;
  switch (s.kind) {
    case 'burst': { const L = Math.round(s.size * easeOut(k)); for (let d = 0; d < 8; d++) { const a = d * Math.PI / 4; const dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a)); const l0 = Math.round(L * .35 * k); for (let i = l0; i < L; i++) { ctx.fillStyle = i < l0 + 2 ? '#ffffff' : s.col; ctx.fillRect(x + dx * i, y + dy * i, 1, 1); } } break; }
    case 'flash': { const L = Math.round(s.size * (1 - k * .6)); ctx.fillStyle = s.col; ctx.fillRect(x - L, y - 1, 2 * L + 1, 3); ctx.fillRect(x - 1, y - L, 3, 2 * L + 1); const D = Math.round(L * .55); for (let i = -D; i <= D; i++) { ctx.fillRect(x + i, y + i, 1, 1); ctx.fillRect(x + i, y - i, 1, 1); } ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 5, 5); break; }
    case 'star': { const L = Math.max(1, Math.round(s.size * (1 - k))); ctx.fillStyle = s.col; ctx.fillRect(x - L, y, 2 * L + 1, 1); ctx.fillRect(x, y - L, 1, 2 * L + 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); break; }
    case 'slash': { const L = s.size; const off = Math.round((k - .5) * 8); for (let n = 0; n < 3; n++) { const o = (n - 1) * 3; pline(x - L + off + o, y + L - off, x + L + off + o, y - L - off, n === 1 ? '#ffffff' : s.col, n === 1 ? 2 : 1); } break; }
    case 'flame': { const r = Math.max(1, Math.round(s.size * (1 - k * .7))); const fl = (Math.floor(s.t * 30) + s.seed) % 2; circle(x, y, r, s.col2); circle(x - (fl ? 1 : 0), y - 1, Math.max(1, r - 1), s.col); circle(x, y - 2, Math.max(0, r - 2), '#ffef9a'); ctx.fillStyle = s.col; ctx.fillRect(x - 1 + fl, y - r - 2, 2, 3); ctx.fillRect(x + (fl ? -2 : 1), y - r - 1, 1, 2); break; }
    case 'drop': { ctx.fillStyle = s.col; ctx.fillRect(x, y - 3, 1, 1); ctx.fillRect(x - 1, y - 2, 3, 3); ctx.fillRect(x, y + 1, 1, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 1, 1); break; }
    case 'bolt': { if ((Math.floor(s.t * 40) + s.seed) % 3 === 2) break; let px0 = x, py0 = y - s.size; const segs = 5; for (let i = 0; i < segs; i++) { const nx = x + Math.round((R() - .5) * 10), ny = y - s.size + Math.round((i + 1) * s.size * 2 / segs); pline(px0, py0, nx, ny, s.col, 3); pline(px0, py0, nx, ny, '#ffffff', 1); px0 = nx; py0 = ny; } break; }
    case 'spark': { if ((Math.floor(s.t * 30) + s.seed) % 2) break; ctx.fillStyle = s.col; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); break; }
    case 'leaf': { const f = Math.floor(s.rot) & 3; ctx.fillStyle = s.col; if (f === 0) { ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x - 2, y - 1, 5, 3); ctx.fillStyle = s.col2; ctx.fillRect(x - 2, y, 4, 1); } else if (f === 1) { ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillRect(x - 2, y - 2, 2, 2); ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillStyle = s.col2; ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x, y, 1, 1); } else if (f === 2) { ctx.fillRect(x, y - 3, 1, 7); ctx.fillRect(x - 1, y - 2, 3, 5); ctx.fillStyle = s.col2; ctx.fillRect(x, y - 2, 1, 4); } else { ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillRect(x + 1, y - 2, 2, 2); ctx.fillRect(x - 2, y + 1, 2, 2); ctx.fillStyle = s.col2; ctx.fillRect(x + 1, y - 1, 1, 1); ctx.fillRect(x, y, 1, 1); } break; }
    case 'bubble': { const r = Math.max(1, Math.round(s.size * Math.min(1, k * 3 + .3))); ctx.fillStyle = s.col; for (let a = 0; a < 16; a++) ctx.fillRect(x + Math.round(Math.cos(a * Math.PI / 8) * r), y + Math.round(Math.sin(a * Math.PI / 8) * r), 1, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - Math.round(r * .5), y - Math.round(r * .5), 1, 1); if (k > .85) { ctx.fillStyle = s.col2; ctx.fillRect(x - r - 1, y, 1, 1); ctx.fillRect(x + r + 1, y, 1, 1); ctx.fillRect(x, y - r - 1, 1, 1); ctx.fillRect(x, y + r + 1, 1, 1); } break; }
    case 'shard': { const f = Math.floor(s.rot) & 1; ctx.fillStyle = s.col; if (f) { ctx.fillRect(x, y - 3, 1, 7); ctx.fillRect(x - 1, y - 1, 3, 3); } else { ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x - 1, y - 1, 3, 3); } ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y - 1, 1, 1); break; }
    case 'rock': { const sz = s.size; ctx.fillStyle = s.col2; ctx.fillRect(x - (sz >> 1), y - (sz >> 1), sz, sz); ctx.fillStyle = s.col; ctx.fillRect(x - (sz >> 1), y - (sz >> 1), sz - 1, sz - 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - (sz >> 1), y - (sz >> 1), 1, 1); break; }
    case 'wisp': { const r = Math.max(1, Math.round(s.size * (1 - k * .5))); const wob = Math.round(Math.sin(s.t * 14 + s.seed) * 2); circle(x + wob, y, r, s.col); circle(x + wob - 1, y - 1, Math.max(0, r - 2), s.col2); circle(x + wob - Math.sign(s.vx || 1) * (r + 1), y + 2, Math.max(0, r - 2), s.col); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + wob - 1, y - 1, 1, 1); break; }
    case 'psy': { const r = Math.max(1, Math.round(s.size * easeOut(k))); ctx.fillStyle = s.col; for (let a = 0; a < 48; a++) ctx.fillRect(x + Math.round(Math.cos(a * Math.PI / 24) * r), y + Math.round(Math.sin(a * Math.PI / 24) * r * .7), 1, 1); if (r > 4) { ctx.fillStyle = s.col2; for (let a = 0; a < 32; a++) ctx.fillRect(x + Math.round(Math.cos(a * Math.PI / 16) * (r - 3)), y + Math.round(Math.sin(a * Math.PI / 16) * (r - 3) * .7), 1, 1); } break; }
    case 'poof': { const r = Math.max(1, Math.round(s.size * (0.5 + k * .8))); ctx.globalAlpha = fade * .85; circle(x, y, r, s.col); circle(x - r, y + 1, Math.max(1, r - 2), s.col); circle(x + r, y + 1, Math.max(1, r - 2), s.col); circle(x - 1, y - 1, Math.max(0, r - 2), s.col2); break; }
    case 'heart': { const sc = k < .2 ? 1 : 1; ctx.fillStyle = s.col; const rows = ST.heart; for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] !== '.') { ctx.fillStyle = rows[j][i] === 'L' ? '#ffffff' : s.col; ctx.fillRect(x - 2 + i, y - 2 + j, 1, 1); } break; }
    case 'wind': { const L = s.size; ctx.fillStyle = s.col; for (let n = 0; n < 3; n++) { const o = (n - 1) * 3, len = L - n * 2; ctx.fillRect(x - len + Math.round(k * 6), y + o, len, 1); } ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y, 3, 1); break; }
    // ---- scene-sized effects for the lateral battle
    // fireball: a layered ball (dark rim, orange, yellow, white core) with a flickering tail behind its heading
    case 'fireball': { const r = s.size, fl = (Math.floor(s.t * 24) + s.seed) % 2, d = -s.dir; circle(x, y, r + 1, '#7a1a08'); circle(x, y, r, s.col2); circle(x + d * -1, y - 1, Math.max(1, r - 2), s.col); circle(x + d * -1, y - 1, Math.max(0, r - 4), '#fff3a0'); for (let i = 1; i <= 3; i++) { const tr = Math.max(1, r - i - (fl ? 1 : 0)); circle(x + d * (r + i * 4), y + (i % 2 ? -1 : 1) * fl, tr, i === 1 ? s.col2 : '#c83a10'); if (i === 1) circle(x + d * (r + 4), y, Math.max(0, tr - 2), s.col); } break; }
    // blast: a bright ball that bursts into a ring of flame tongues, then thins away
    case 'blast': { const r = Math.round(s.size * easeOut(Math.min(1, k * 1.4))); if (k < .3) { circle(x, y, r, s.col2); circle(x, y, Math.max(0, r - 3), '#ffffff'); } else { for (let n = 0; n < 12; n++) { const a = n * Math.PI / 6 + s.seed, rr = r + ((n + Math.floor(s.t * 20)) % 3) * 2; const bx = x + Math.round(Math.cos(a) * rr), by2 = y + Math.round(Math.sin(a) * rr * .8); circle(bx, by2, Math.max(1, Math.round(s.size * .22 * (1 - k))), n % 2 ? s.col : s.col2); } ctx.globalAlpha = fade * .5; circle(x, y, Math.max(0, r - 4), s.col); ctx.globalAlpha = fade; } break; }
    // ring: an expanding shock ellipse
    case 'ring': { const r = Math.max(1, Math.round(s.size * easeOut(k))); ctx.fillStyle = s.col; for (let a = 0; a < 72; a++) { const px2 = x + Math.round(Math.cos(a * Math.PI / 36) * r), py2 = y + Math.round(Math.sin(a * Math.PI / 36) * r * .55); ctx.fillRect(px2 - 1, py2 - 1, 3, 2); } break; }
    // impact: a twelve-point starburst that pops out then shrinks
    case 'impact': { const R0 = s.size * (k < .25 ? easeOut(k / .25) : 1 - (k - .25) / .75 * .6), pts = []; for (let n = 0; n < 24; n++) { const a = n * Math.PI / 12 + s.rot; const rr = n % 2 ? R0 : R0 * .42; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } ctx.fillStyle = s.col; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(Math.round(p[0]), Math.round(p[1])) : ctx.moveTo(Math.round(p[0]), Math.round(p[1]))); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); pts.forEach((p, i) => { const qx = x + (p[0] - x) * .6, qy = y + (p[1] - y) * .6; i ? ctx.lineTo(Math.round(qx), Math.round(qy)) : ctx.moveTo(Math.round(qx), Math.round(qy)); }); ctx.closePath(); ctx.fill(); break; }
    // lightning: a thick bolt striking down from `size` pixels above (x,y), with a branch, flickering
    case 'lightning': { if ((Math.floor(s.t * 30) + s.seed) % 4 === 3) break; let px0 = x + Math.round((R() - .5) * 16), py0 = y - s.size; const segs = 7; for (let i = 0; i < segs; i++) { const last = i === segs - 1; const nx = last ? x : x + Math.round((R() - .5) * 22), ny = y - s.size + Math.round((i + 1) * s.size / segs); pline(px0, py0, nx, ny, shade(s.col, -.3), 5); pline(px0, py0, nx, ny, s.col, 3); pline(px0, py0, nx, ny, '#ffffff', 1); if (i === 2 || i === 4) { const bx = nx + Math.round((R() - .5) * 40), by2 = ny + 10 + Math.round(R() * 14); pline(nx, ny, bx, by2, s.col, 2); pline(nx, ny, bx, by2, '#ffffff', 1); } px0 = nx; py0 = ny; } circle(x, y, 6, '#ffffff'); break; }
    // wave: a crest of water sweeping in `dir`, growing then breaking into foam
    case 'wave': { const r = Math.max(2, Math.round(s.size * Math.min(1, k * 1.6))); const foam = k > .55; for (let i = -r; i <= r; i++) { const h = Math.round(Math.sqrt(Math.max(0, r * r - i * i)) * .9); const cx2 = x + i * -s.dir; ctx.fillStyle = s.col; ctx.fillRect(cx2, y - h, 1, Math.max(1, h)); if (h > 2) { ctx.fillStyle = s.col2; ctx.fillRect(cx2, y - h, 1, 2); } } if (foam) { ctx.fillStyle = '#ffffff'; for (let n = 0; n < 6; n++) ctx.fillRect(x + s.dir * (r - n * 3) + Math.round((R() - .5) * 4), y - r + Math.round(R() * 6), 2, 2); } break; }
    // speed lines: streaks trailing behind a lunge
    case 'speed': { ctx.fillStyle = s.col; for (let n = 0; n < 5; n++) { const len = Math.round((s.size - n * 3) * (1 - k * .5)); const oy2 = (n - 2) * 6 + Math.round((R() - .5) * 3); ctx.fillRect(s.dir > 0 ? x - len : x, y + oy2, len, 1); } break; }
    // crystal: an ice shard that grows out of the ground and shatters
    case 'crystal': { const h = Math.round(s.size * (k < .4 ? easeOut(k / .4) : 1)); if (k > .75 && (Math.floor(s.t * 30) + s.seed) % 2) break; for (let j = 0; j < h; j++) { const w = Math.max(1, Math.round((1 - j / h) * s.size * .4)); ctx.fillStyle = s.col; ctx.fillRect(x - (w >> 1), y - j, w, 1); ctx.fillStyle = s.col2; ctx.fillRect(x - (w >> 1), y - j, Math.max(1, w >> 2), 1); } ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - h + 1, 1, 2); break; }
    // horizontal beam of signed length `len` from (x,y): grows out fast, holds, then thins away
    case 'beam': { const len = Math.round(s.len * Math.min(1, k * 2.5)); const th = Math.max(1, Math.round(s.size * (k < .25 ? k / .25 : k > .7 ? (1 - k) / .3 : 1))); const x0 = Math.min(x, x + len), w = Math.abs(len); const fl = (Math.floor(s.t * 40) + s.seed) % 2; ctx.fillStyle = s.col; ctx.fillRect(x0, y - th - fl, w, 2 * th + 1 + fl); ctx.fillStyle = s.col2; ctx.fillRect(x0, y - (th >> 1), w, (th >> 1) * 2 + 1); break; }
  }
  ctx.globalAlpha = 1;
}
// Particles and effect sprites in world space (offset by ox, oy). Floating texts are drawn separately by
// drawFXTexts so the board can draw them unscaled when it is zoomed out.
function drawFX(ox, oy, texts = true) {
  for (const p of FX.parts) { const k = 1 - p.t / p.life; const s = Math.max(1, Math.round(p.size * (k < .4 ? k / .4 : 1))); ctx.fillStyle = p.col; if (p.shape === 'ring') { const r = Math.round(p.size * (1 - k) * 3) + 2; ctx.globalAlpha = k; outline(p.x + ox - r, p.y + oy - r, 2 * r, 2 * r, p.col); ctx.globalAlpha = 1; } else ctx.fillRect(Math.round(p.x + ox - s / 2), Math.round(p.y + oy - s / 2), s, s); }
  for (const s of FX.sprites) if (s.t >= 0) drawSprite(s, ox, oy);
  if (texts) drawFXTexts(ox, oy);
}
// Floating texts: world position (x + ox, y + oy) times `sc` gives the screen position; the text itself keeps its pixel size.
function drawFXTexts(ox, oy, sc = 1) {
  for (const f of FX.texts) { if (f.delay > 0) continue; const k = f.t / f.life; ctx.globalAlpha = k > .7 ? 1 - (k - .7) / .3 : 1; const pop = f.pop && f.t < .15 ? 1 + (1 - f.t / .15) * .5 : 1; const x = (f.x + ox) * sc, y = (f.y + oy) * sc - (pop - 1) * 6; if (f.big) bigC(f.s, x, y, f.col, { outline: f.outline }); else textC(f.s, x, y, f.col, { outline: f.outline }); ctx.globalAlpha = 1; }
}
function shake(n) { FX.shake = Math.max(FX.shake, n); }
function flashScreen(col = '#ffffff', a = 1) { FX.flash = a; FX.flashCol = col; }

// ---------------------------------------------------------------- type-flavoured battle effects
const TYPE_FX = {
  Normal: { proj: 'star', parts: ['#ffffff', '#ffe9a0'] }, Fighting: { proj: null, parts: ['#ffb07a', '#ffffff'] },
  Fire: { proj: 'flame', parts: ['#ff8a2c', '#ffd25a', '#ff4a20'] }, Water: { proj: 'drop', parts: ['#62acf0', '#edf9ff'] },
  Electric: { proj: 'spark', parts: ['#ffe94a', '#ffffff'] }, Grass: { proj: 'leaf', parts: ['#7ecf5e', '#a3e07c'] },
  Ice: { proj: 'shard', parts: ['#bde4f8', '#ffffff'] }, Poison: { proj: 'bubble', parts: ['#b060d0', '#e0a0ff'] },
  Ground: { proj: 'rock', parts: ['#c0a060', '#8a6a3a'] }, Rock: { proj: 'rock', parts: ['#ada090', '#665858'] },
  Flying: { proj: 'wind', parts: ['#ffffff', '#c8e0ff'] }, Psychic: { proj: 'psy', parts: ['#ff80c0', '#ffffff'] },
  Bug: { proj: 'leaf', parts: ['#a8b820', '#e0e860'] }, Ghost: { proj: 'wisp', parts: ['#a070e0', '#6040a0'] },
  Dragon: { proj: 'flame', parts: ['#7060ff', '#a0c0ff'] }, Dark: { proj: 'wisp', parts: ['#504060', '#a080c0'] },
  Steel: { proj: 'star', parts: ['#c0c0d0', '#ffffff'] }, Fairy: { proj: 'heart', parts: ['#ffb0e0', '#ffffff'] },
};
function fxFor(type) { return TYPE_FX[type] || TYPE_FX.Normal; }
// Hit effect at (x,y) in world pixels.
function hitEffect(type, x, y, crit, eff) {
  const F = fxFor(type), col = TYPE_COL[type] || '#ffffff', c1 = F.parts[0], c2 = F.parts[1]; const big = crit ? 1.5 : 1;
  spawnSprite('flash', x, y, { size: Math.round(7 * big), life: crit ? .18 : .12, col: crit ? '#ffd24a' : '#ffffff' });
  switch (type) {
    case 'Fire': case 'Dragon': for (let i = 0; i < 5 * big; i++) spawnSprite('flame', x + (vrnd() - .5) * 22, y + 8 + (vrnd() - .5) * 10, { size: 2 + Math.round(vrnd() * 3), life: .4 + vrnd() * .3, col: c1, col2: type === 'Fire' ? '#ff4a20' : '#4a3ad0', vy: -30 - vrnd() * 30, vx: (vrnd() - .5) * 16, delay: vrnd() * .16 }); break;
    case 'Water': for (let i = 0; i < 10 * big; i++) { const a = vrnd() * Math.PI * 2, sp = 50 + vrnd() * 60; spawnSprite('drop', x, y + 2, { life: .45 + vrnd() * .2, col: c1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, grav: 260 }); } spawnSprite('psy', x, y + 8, { size: 12, life: .35, col: c2, col2: c1 }); break;
    case 'Electric': for (let i = 0; i < 3 * big; i++) spawnSprite('bolt', x + (vrnd() - .5) * 14, y - 4, { size: 12, life: .28, col: c1, delay: i * .05 }); for (let i = 0; i < 6 * big; i++) spawnSprite('spark', x + (vrnd() - .5) * 24, y + (vrnd() - .5) * 20, { life: .3 + vrnd() * .2, col: c1, delay: vrnd() * .15 }); break;
    case 'Grass': case 'Bug': for (let i = 0; i < 9 * big; i++) { const a = vrnd() * Math.PI * 2, sp = 40 + vrnd() * 50; spawnSprite('leaf', x, y, { life: .55 + vrnd() * .3, col: type === 'Grass' ? '#2a6b38' : '#6a7a10', col2: type === 'Grass' ? '#c8f0a0' : '#f0f080', vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, grav: 90, rot: vrnd() * 4, spin: 10 + vrnd() * 10 }); } spawnSprite('burst', x, y, { size: 12 * big, life: .25, col: '#e8ffd0' }); break;
    case 'Ice': for (let i = 0; i < 7 * big; i++) { const a = vrnd() * Math.PI * 2, sp = 50 + vrnd() * 40; spawnSprite('shard', x, y, { life: .5, col: c1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, grav: 160, rot: vrnd() * 2, spin: 6 }); } spawnSprite('psy', x, y, { size: 12, life: .3, col: '#ffffff', col2: c1 }); break;
    case 'Poison': for (let i = 0; i < 7 * big; i++) spawnSprite('bubble', x + (vrnd() - .5) * 18, y + (vrnd() - .5) * 10, { size: 2 + Math.round(vrnd() * 2), life: .5 + vrnd() * .3, col: c1, col2: c2, vy: -20 - vrnd() * 20, vx: (vrnd() - .5) * 10, delay: vrnd() * .15 }); break;
    case 'Ground': case 'Rock': for (let i = 0; i < 8 * big; i++) { const a = -Math.PI * (0.15 + vrnd() * .7), sp = 60 + vrnd() * 70; spawnSprite('rock', x, y + 6, { size: 2 + Math.round(vrnd() * 2), life: .55, col: c1, col2: c2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 300 }); } for (let i = 0; i < 3; i++) spawnSprite('poof', x + (i - 1) * 8, y + 10, { size: 4, life: .45, col: '#d8c8a0', col2: '#f0e6c8', vy: -10, delay: i * .04 }); break;
    case 'Flying': for (let i = 0; i < 5 * big; i++) spawnSprite('wind', x + (vrnd() - .5) * 10, y + (vrnd() - .5) * 20, { size: 10 + Math.round(vrnd() * 6), life: .3 + vrnd() * .2, col: c2, vx: 120 + vrnd() * 60, delay: vrnd() * .1 }); spawnSprite('slash', x, y, { size: 9, life: .22, col: '#ffffff' }); break;
    case 'Psychic': for (let i = 0; i < 3; i++) spawnSprite('psy', x, y, { size: 14 + i * 3, life: .5, col: c1, col2: c2, delay: i * .1 }); break;
    case 'Ghost': case 'Dark': for (let i = 0; i < 6 * big; i++) { const a = vrnd() * Math.PI * 2; spawnSprite('wisp', x, y, { size: 3 + Math.round(vrnd() * 2), life: .6, col: c1, col2: c2, vx: Math.cos(a) * 40, vy: Math.sin(a) * 30 - 20, delay: vrnd() * .12 }); } break;
    case 'Fairy': for (let i = 0; i < 6 * big; i++) spawnSprite('heart', x + (vrnd() - .5) * 20, y + (vrnd() - .5) * 10, { life: .6, col: c1, vy: -30 - vrnd() * 20, delay: vrnd() * .15 }); spawnSprite('psy', x, y, { size: 12, life: .4, col: c1, col2: '#ffffff' }); break;
    case 'Fighting': spawnSprite('slash', x, y, { size: 10, life: .22, col: c1 }); spawnSprite('burst', x, y, { size: 14 * big, life: .3, col: '#ffffff' }); break;
    default: spawnSprite('burst', x, y, { size: 13 * big, life: .3, col: c1 }); for (let i = 0; i < 4; i++) spawnSprite('star', x + (vrnd() - .5) * 22, y + (vrnd() - .5) * 18, { size: 3, life: .3, col: c2, delay: vrnd() * .15 });
  }
  if (eff > 1) spawnSprite('burst', x, y, { size: 18 * big, life: .35, col: '#ffd24a', delay: .04 });
  spawnParts(x, y, crit ? 18 : 10, [col, c1, c2, '#ffffff'], { speed: crit ? 110 : 70, life: .5, grav: 80 });
}
// Projectile from (ax,ay) to (bx,by); returns the sprite so callers can time the impact.
function projectileFX(type, ax, ay, bx, by, dur) {
  const F = fxFor(type); const col = TYPE_COL[type] || '#ffffff'; const kind = F.proj || 'star'; const c1 = F.parts[0], c2 = F.parts[1];
  const o = { tx: bx, ty: by, life: dur, arc: kind === 'rock' || kind === 'drop' ? 14 : 6, col: c1, col2: c2, size: kind === 'flame' ? 4 : kind === 'psy' ? 6 : kind === 'wind' ? 12 : 3, spin: 14, trail: kind === 'spark' ? ['#ffe94a', '#ffffff'] : kind === 'flame' ? [c1, c2] : kind === 'wisp' ? [c1] : kind === 'drop' ? [c1] : null };
  if (kind === 'wind') o.vx = 0;
  if (kind === 'spark') { for (let i = 0; i < 4; i++) spawnSprite('bolt', ax + (bx - ax) * (i + 1) / 5, ay + (by - ay) * (i + 1) / 5 - 10, { size: 10, life: .16, col: c1, delay: i * dur / 4 }); return null; }
  if (kind === 'flame' || kind === 'drop' || kind === 'leaf' || kind === 'star' || kind === 'rock' || kind === 'shard' || kind === 'bubble') { for (let i = 0; i < 3; i++) spawnSprite(kind, ax, ay, { tx: bx + (vrnd() - .5) * 6, ty: by + (vrnd() - .5) * 6, life: dur, arc: o.arc + i * 3, col: c1, col2: c2, size: o.size, spin: 12, rot: i, trail: o.trail, delay: i * .03 }); return null; }
  return spawnSprite(kind, ax, ay, o);
}

// ---------------------------------------------------------------- icons
function drawBall(x, y, col = '#f04848', r = 5) {
  if (r >= 5) { const rows = ['...OOOOO...', '..ORRRRRO..', '.ORHRRRRRO.', 'ORHHRRRRRRO', 'ORRRRRRRRRO', 'OOOOOWOOOOO', 'OWWWOWOWWWO', 'OWWWWOWWWWO', '.OWWWWWWWO.', '..OSSSSSO..', '...OOOOO...'];
    const pal = { O: UI.shadow, R: col, H: shade(col, .5), W: '#f8f4ea', S: '#c8c0b4' }; for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.') continue; ctx.fillStyle = pal[ch]; ctx.fillRect(x - 5 + i, y - 5 + j, 1, 1); }
    ctx.fillStyle = UI.shadow; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); return; }
  circle(x, y, r, UI.shadow); circle(x, y, r - 1, '#f6f2e6'); ctx.fillStyle = col; for (let j = -r + 1; j < 0; j++) { const w = Math.floor(Math.sqrt((r - 1) * (r - 1) - j * j) + .5); ctx.fillRect(x - w, y + j, 2 * w + 1, 1); } hline(x - r + 1, y, 2 * r - 1, UI.shadow); px(x, y, '#ffffff'); px(x - 1, y - 2, shade(col, .5));
}
const TYPE_ABBR = { Normal: 'NRM', Fire: 'FIR', Water: 'WTR', Electric: 'ELC', Grass: 'GRS', Ice: 'ICE', Fighting: 'FGT', Poison: 'PSN', Ground: 'GRD', Flying: 'FLY', Psychic: 'PSY', Bug: 'BUG', Rock: 'RCK', Ghost: 'GHO', Dragon: 'DRG', Dark: 'DRK', Steel: 'STL', Fairy: 'FRY' };
function typeBadge(t, x, y, w = 24) { const c = TYPE_COL[t] || '#888'; rrect(x, y, w, 9, shade(c, -.55), 1); rrect(x + 1, y + 1, w - 2, 7, c, 0); hline(x + 2, y + 1, w - 4, shade(c, .3)); hline(x + 2, y + 7, w - 4, shade(c, -.25)); textC(w >= 40 ? t.toUpperCase() : TYPE_ABBR[t] || t.slice(0, 3).toUpperCase(), x + w / 2, y + 1, '#ffffff', { shadow: shade(c, -.5) }); }
function miniBadge(label, col, x, y) { rrect(x, y, 15, 8, shade(col, -.55), 1); rrect(x + 1, y + 1, 13, 6, col, 0); hline(x + 2, y + 1, 11, shade(col, .3)); textC(label, x + 8, y + 1, '#ffffff', { shadow: shade(col, -.5) }); }
function statusBadge(st, x, y) { const s = STATUS[st]; if (s) miniBadge(s.name, s.col, x, y); }
function teamColor(team) { return team === 0 ? '#3d7dff' : team === 1 ? '#ff4b4b' : team === 2 ? '#e0c040' : '#40d060'; }
function teamColorD(team) { return team === 0 ? '#1c3a8a' : team === 1 ? '#8a1c1c' : team === 2 ? '#7a6010' : '#1a6a30'; }
function teamColorL(team) { return team === 0 ? '#8ab4ff' : team === 1 ? '#ff9a9a' : team === 2 ? '#fff0a0' : '#a0f0b0'; }
function stampAt(x, y, rows, pal) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.') continue; const c = pal[ch]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1); } }
function pointerHand(x, y, t) { const b = Math.round(Math.sin(t / 120)); x += b; stampAt(x, y - 1, ST.hand, { O: UI.shadow, W: '#ffffff' }); px(x + 2, y + 3, '#e0d8c8'); px(x + 3, y + 5, '#e0d8c8'); }
function drawCrown(x, y) { stampAt(x, y, ST.crownGold, { O: '#5a3a00', Y: UI.gold }); px(x + 2, y + 2, '#ff5a5a'); px(x + 1, y + 1, '#fff0a0'); }
function drawSkull(x, y) { stampAt(x, y, ST.skull, { O: '#3a1020', W: '#f0e8f0' }); px(x + 1, y + 2, '#ff5a5a'); px(x + 3, y + 2, '#ff5a5a'); }
// Unit base: a translucent team plate with a glossy rim, and a soft ground shadow that shrinks while the unit is airborne.
// The rim's shape also tells the side apart from the colour: the controlling team's units stand on a plain
// ring, enemy trainers on a ring with four spikes, wild Pokémon on a dashed ring, allies on a ring with a bar.
// `lit` brightens the rim (a unit that can still act); `dim` greys it (a unit that has acted).
function drawStand(cx, by, team, a = 1, air = 0, o = {}) {
  const sh = Math.max(.4, 1 - air / 18); const col = o.dim ? '#7a7f8c' : teamColor(team), colD = o.dim ? '#3a3e48' : teamColorD(team), colL = o.dim ? '#b8bcc8' : teamColorL(team);
  ctx.globalAlpha = (o.dim ? .1 : .22) * a; ellipse(cx, by, 11, 3, col);
  ctx.globalAlpha = .3 * a * sh; ellipse(cx, by, Math.round(8 * sh), Math.max(1, Math.round(2.5 * sh)), '#000000');
  ctx.globalAlpha = a; ellipseRing(cx, by + 1, 13, 5, 1, '#0b1020'); ellipseRing(cx, by, 13, 5, 1, colD); ellipseRing(cx, by, 12, 4, 1, col);
  const shape = teamShape(team);
  if (shape === 'spiked') { for (const [dx, dy, w, h] of [[-15, -1, 3, 3], [12, -1, 3, 3], [-1, -7, 3, 3], [-1, 4, 3, 3]]) { rect(cx + dx, by + dy, w, h, colD); px(cx + dx + 1, by + dy + 1, col); } }
  else if (shape === 'dashed') { ctx.globalAlpha = .85 * a; for (const [dx, dy] of [[-9, -3], [-4, -4], [1, -4], [6, -3], [-9, 2], [-4, 3], [1, 3], [6, 2]]) rect(cx + dx, by + dy, 2, 1, '#0b1020'); ctx.globalAlpha = a; }
  else if (shape === 'barred') { rect(cx - 6, by + 4, 12, 1, colL); rect(cx - 6, by + 5, 12, 1, colD); }
  ctx.globalAlpha = .9 * a; hline(cx - 5, by - 4, 8, colL); px(cx - 8, by - 3, colL); px(cx - 10, by - 2, colL); px(cx + 4, by - 4, '#ffffff');
  if (o.lit) { ctx.globalAlpha = o.lit * a; ellipseRing(cx, by, 12, 4, 1, '#ffffff'); }
  ctx.globalAlpha = 1;
}
// Side of a team relative to whoever holds the controls: 'ring' (own), 'spiked' (hostile trainer), 'dashed' (wild), 'barred' (ally).
function teamShape(team) { const me = typeof HT === 'function' && B ? HT() : 0; if (team === me) return 'ring'; if (team === 2) return 'dashed'; if (!hostile(team, me)) return 'barred'; return 'spiked'; }
// 5×5 team glyph used on HP plates and cards: ● own, ▲ hostile trainer, ◇ wild, + ally.
function teamGlyph(x, y, team, col) {
  const s = teamShape(team); const rows = s === 'ring' ? ['.OOO.', 'OOOOO', 'OOOOO', 'OOOOO', '.OOO.'] : s === 'spiked' ? ['..O..', '..O..', '.OOO.', '.OOO.', 'OOOOO'] : s === 'dashed' ? ['..O..', '.O.O.', 'O...O', '.O.O.', '..O..'] : ['..O..', '..O..', 'OOOOO', '..O..', '..O..'];
  stampAt(x, y, rows, { O: col });
}
// Portrait window background used by cards: team colour, diagonal light band, inner frame.
function portraitBg(x, y, w, h, team) {
  rect(x, y, w, h, teamColorD(team)); ctx.globalAlpha = .18; ctx.fillStyle = '#ffffff'; for (let j = 0; j < h; j++) { const i0 = Math.max(0, w - 10 - j); ctx.fillRect(x + i0, y + j, Math.min(6, w - i0), 1); } ctx.globalAlpha = .35; ctx.fillStyle = '#000000'; for (let j = 0; j < h; j++) { const wdt = Math.max(0, 6 - j); if (wdt) ctx.fillRect(x, y + j, wdt, 1); } ctx.globalAlpha = 1;
  outline(x, y, w, h, shade(teamColorD(team), -.4)); hline(x + 1, y + 1, w - 2, shade(teamColorD(team), .25)); vline(x + 1, y + 1, h - 2, shade(teamColorD(team), .15));
}

// ---------------------------------------------------------------- UI icons (9×9 stamps)
const ICONS = {
  sword: ['......OO.', '.....OWWO', '....OWWO.', 'O..OWWO..', 'OO.OWO...', '.OOWO....', '..OOO....', '.OO.OO...', 'OO...O...'],
  ball: ['..OOOOO..', '.ORRRRRO.', 'ORRHRRRRO', 'ORRRRRRRO', 'OOOOWOOOO', 'OWWWOWWWO', 'OWWWWWWWO', '.OWWWWWO.', '..OOOOO..'],
  bag: ['...OOO...', '..O...O..', '.OOOOOOO.', '.OBBBBBO.', '.OBOOOBO.', '.OBBBBBO.', '.OBBBBBO.', '.OBBBBBO.', '.OOOOOOO.'],
  wait: ['OOOOOOOOO', '.OWWWWWO.', '.OWWWWWO.', '..OWWWO..', '...OWO...', '..OW.WO..', '.OW...WO.', '.OWWWWWO.', 'OOOOOOOOO'],
  flag: ['OO.......', 'OYYYYO...', 'OYYYYYYO.', 'OYYYYYYYO', 'OYYYYYYO.', 'OYYYYO...', 'OO.......', 'OO.......', 'OO.......'],
  end: ['..OOOOO..', '.OWWWWWO.', 'OWO...OWO', 'OO.....OO', '........O', 'OO....OWO', 'OWO..OWO.', '.OWOOWO..', '..OOOO...'],
  skull: ['..OOOOO..', '.OWWWWWO.', 'OWWWWWWWO', 'OWOWWWOWO', 'OWWWOWWWO', '.OWWWWWO.', '..OWOWO..', '..OWWWO..', '..OOOOO..'],
  help: ['..OOOOO..', '.OWWWWWO.', 'OWWOOOWWO', 'OOO..OWWO', '....OWWO.', '...OWWO..', '...OWO...', '...OO....', '...OO....'],
  note: ['....OOO..', '....OWWO.', '....OWOO.', '....OW...', '....OW...', '..OOOW...', '.OWWOW...', '.OWWWO...', '..OOO....'],
  run: ['...OOO...', '..OWWWO..', '..OWWWO..', 'OOOOWOOOO', 'OWWOWOWWO', 'OOOOWOOOO', '..OWOWO..', '.OWO.OWO.', 'OOO...OOO'],
  x: ['OO.....OO', 'OWO...OWO', '.OWO.OWO.', '..OWOWO..', '...OWO...', '..OWOWO..', '.OWO.OWO.', 'OWO...OWO', 'OO.....OO'],
  play: ['OO.......', 'OWOO.....', 'OWWWOO...', 'OWWWWWOO.', 'OWWWWWWWO', 'OWWWWWOO.', 'OWWWOO...', 'OWOO.....', 'OO.......'],
  map: ['OOOOOOOOO', 'OYYOGGOYO', 'OYYOGGOYO', 'OYYOGGOYO', 'OGGOYYOGO', 'OGGOYYOGO', 'OGGOYYOGO', 'OGGOYYOGO', 'OOOOOOOOO'],
  dice: ['.OOOOOOO.', 'OWOWWWWWO', 'OWWWWWOWO', 'OWWWWWWWO', 'OWWWOWWWO', 'OWWWWWWWO', 'OWOWWWWWO', 'OWWWWWOWO', '.OOOOOOO.'],
  vs: ['OO.....OO', 'OWO...OWO', '.OWO.OWO.', '..OWOWO..', '...OWO...', '..OWOWO..', '.OWOYOWO.', 'OWO.Y.OWO', 'OO..Y..OO'],
  crown: ['O...O...O', 'OO.OYO.OO', 'OYOYYYOYO', 'OYYYYYYYO', 'OYYYYYYYO', '.OYYYYYO.', '.OOOOOOO.', '.OYYYYYO.', '.OOOOOOO.'],
  book: ['.OOOOOOO.', 'OWWWOWWWO', 'OWLWOWLWO', 'OWWWOWWWO', 'OWLWOWLWO', 'OWWWOWWWO', 'OWLWOWLWO', 'OWWWOWWWO', '.OOOOOOO.'],
  skill: ['....O....', '...OWO...', '...OWO...', 'OOOOWOOOO', 'OWWWYWWWO', 'OOOOWOOOO', '...OWO...', '...OWO...', '....O....'],
};
// Draw a UI icon; `col` overrides the main (W) colour.
function iconAt(id, x, y, col) {
  const rows = ICONS[id]; if (!rows) return;
  stampAt(x, y, rows, { O: '#101828', W: col || '#f6f2e6', Y: UI.gold, R: '#ff5a5a', H: '#ffb0b0', B: '#c48a4a', G: '#6cbe4e', L: '#a6b0c8' });
}
