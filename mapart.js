// ============================================================================
// mapart.js — board sprites drawn for the tactics grid. Each species is a
// 16×16 pixel map shown at 2× on the 32-px tiles (the Advance Wars unit
// scale), with two frames: idle and step. Species without a sheet fall back
// to the Showdown mini icon in drawUnit. Frames are rasterized once into
// cached canvases (per frame, facing and tint) so drawing is one drawImage.
// ============================================================================
'use strict';
const MAP_PAL = {
  16: { O: '#3a2416', B: '#b3703c', D: '#7d4a28', L: '#d9a26a', C: '#f6e6c4', K: '#1c1a1a', W: '#ffffff', P: '#e88b7d', R: '#5a3220' },
  74: { O: '#2c2a30', G: '#8d8a92', D: '#5f5c66', L: '#b8b5bd', W: '#ffffff', K: '#1c1a1a', M: '#3a2c30' },
  7: { O: '#1f3a52', B: '#78c2ea', D: '#4b93c2', L: '#b2e2f8', S: '#8a5a34', T: '#5e3a20', U: '#b48660', C: '#f4e8c8', K: '#1a1a1a', W: '#ffffff' },
  1: { O: '#1e3a3a', B: '#63b6a2', D: '#3c8a78', L: '#a0dcc8', G: '#5aa54a', H: '#3a7a30', I: '#8ad070', K: '#c03a3a', W: '#ffffff', M: '#2a4a48' },
  63: { O: '#5a3a14', Y: '#f2d24c', D: '#c9a02e', L: '#fff0a0', B: '#7a4a26', N: '#5a3218', K: '#2a2010' },
  35: { O: '#6a3048', P: '#f6b3c8', D: '#d98aa6', L: '#ffe0ea', B: '#8a4a3a', K: '#1a1a1a', W: '#ffffff', R: '#e05a7a' },
};
// Rows are 16 characters; '.' is transparent. Every sprite faces right (team 0); the others are mirrored.
const MAP_SPRITES = {
  // Pidgey: a plump brown bird with a cream face and belly, a dark crest and a pink beak. Step = wing lifted, hop.
  16: [[
    '................',
    '.......OO.......',
    '......ODRO......',
    '.....OBBBBO.....',
    '....OBBBWKO.....',
    '....OBDDBKBOP...',
    '...OBBBCCCOPP...',
    '...OBBBCCCCO....',
    '..OBLBBBCCCCO...',
    '.OBDBLBBBCCCO...',
    'OBDDBBBBBCCO....',
    'OBDBBBBBBCCO....',
    '.OOBBBBBBCO.....',
    '...OOBBBBO......',
    '.....OPOPO......',
    '.....PP.PP......',
  ], [
    '.......OO.......',
    '......ODRO......',
    '.....OBBBBO.....',
    '....OBBBWKO.....',
    '....OBDDBKBOP...',
    '...OBBBCCCOPP...',
    '...OBLLCCCCO....',
    '..OBLBBBCCCCO...',
    '.OBDBBBBBCCCO...',
    'OBDDBBBBBCCO....',
    'OBDBBBBBBCCO....',
    '.OOBBBBBBCO.....',
    '...OOBBBBO......',
    '.....OPPPO......',
    '......P.P.......',
    '................',
  ]],
  // Geodude: a grey boulder with two heavy arms; step = arms raised in a flex.
  74: [[
    '................',
    '.....OOOOOO.....',
    '....OGGLLGGO....',
    '...OGGGGGGGGO...',
    '..OGWWGGGGWWGO..',
    '..OGKWGGGGKWGO..',
    '..OGGGGGGGGGGO..',
    '.OOGGGOOOOGGGOO.',
    'OGGOGGGGGGGGOGGO',
    'OGDOGDGGGGDGOGDO',
    'OGGOOGGGGGGOOGGO',
    'OLGO.OGDDDGO.OLO',
    '.OO...OOOO...OO.',
    '................',
    '................',
    '................',
  ], [
    'OOO..........OOO',
    'OGLO.OOOOOO.OLGO',
    'OGGOOGGLLGGOOGGO',
    'OGDGOGGGGGGOGDGO',
    '.OGGGWWGGGGWWGO.',
    '..OOGKWGGGGKWO..',
    '...OGGGGGGGGGO..',
    '...OGGGOOOOGGO..',
    '...OGGGGGGGGGO..',
    '...OGDGGGGGGDO..',
    '....OGGGGGGGGO..',
    '.....OGDDDDGO...',
    '......OOOOOO....',
    '................',
    '................',
    '................',
  ]],
  // Squirtle: a light-blue turtle standing upright, brown shell behind, cream plastron, curly tail. Step = legs swapped.
  7: [[
    '................',
    '......OOOO......',
    '.....OBBBBO.....',
    '....OBBWKBBO....',
    '....OBBKKBBBO...',
    '....OBBBBBOBO...',
    '.....OBBOOBO....',
    '..OOOOBBBBBO....',
    '.OSTSOBCCCBO....',
    'OSTTTSOBCCBO....',
    'OSUUUTOBCCBO....',
    '.OSTTSOBBBBO....',
    '..OOOOBBOBBO....',
    '....OBBOOBBO....',
    '....OBBO.OBBO...',
    '.....OOO..OOO...',
  ], [
    '......OOOO......',
    '.....OBBBBO.....',
    '....OBBWKBBO....',
    '....OBBKKBBBO...',
    '....OBBBBBOBO...',
    '.....OBBOOBO....',
    '..OOOOBBBBBO....',
    '.OSTSOBCCCBO....',
    'OSTTTSOBCCBO....',
    'OSUUUTOBCCBO....',
    '.OSTTSOBBBBO....',
    '..OOOOBBOBBO....',
    '.....OBBOOBO....',
    '....OBBO..OBO...',
    '...OBBO...OBBO..',
    '....OOO....OOO..',
  ]],
  // Bulbasaur: a teal quadruped with darker spots and a green bulb on its back; red eyes. Step = legs shifted.
  1: [[
    '......OOOO......',
    '.....OIGGHO.....',
    '....OGIGGGHO....',
    '...OGGGGHHHOOO..',
    '..OHGGGHHHOBBBO.',
    '..OHHHHHOBBBWKBO',
    '.OBBOOOOBBBBKKBO',
    '.OBMBBBBBBBBBBBO',
    'OBBBBBMBBBBBOBBO',
    'OBMBBBBBBMBBBOOO',
    'OBBBBBBBBBBBBBBO',
    '.OBBOBBBBOBBBBO.',
    '.OBBOBBBBOBBBBO.',
    '..OBO.OBBO.OBBO.',
    '..OOO.OOO..OOO..',
    '................',
  ], [
    '......OOOO......',
    '.....OIGGHO.....',
    '....OGIGGGHO....',
    '...OGGGGHHHOOO..',
    '..OHGGGHHHOBBBO.',
    '..OHHHHHOBBBWKBO',
    '.OBBOOOOBBBBKKBO',
    '.OBMBBBBBBBBBBBO',
    'OBBBBBMBBBBBOBBO',
    'OBMBBBBBBMBBBOOO',
    'OBBBBBBBBBBBBBBO',
    '.OBBBBBBBBBBBBO.',
    '.OBBOBBBBOBBBBO.',
    'OBBO..OBBO..OBBO',
    '.OOO..OOO...OOO.',
    '................',
  ]],
  // Abra: a yellow fox sitting cross-legged with closed eyes, a brown chest plate and long ears; it floats. Step = hover higher, tail up.
  63: [[
    '.OO..........OO.',
    'OYYO........OYYO',
    'OYDYO......OYDYO',
    '.OYYYOOOOOOYYYO.',
    '..OYYYYYYYYYYO..',
    '..OYKKYYYYKKYYO.',
    '..OYYYYYYYYYYYYO',
    '...OYYYOOYYYYYO.',
    '....OYYYYYOOOO..',
    '...OYOBBBBBOYO..',
    '..OYYOBNNNBOYYO.',
    '..OYYYOBBBOYYYO.',
    '.OYOYYYOOOYYYOYO',
    'OYYOOOOOOOOOOYYO',
    '.OOO........OOO.',
    '................',
  ], [
    'OYYO........OYYO',
    'OYDYO......OYDYO',
    '.OYYYOOOOOOYYYO.',
    '..OYYYYYYYYYYO..',
    '..OYKKYYYYKKYYO.',
    '..OYYYYYYYYYYYYO',
    '...OYYYOOYYYYYO.',
    '....OYYYYYOOOO..',
    '...OYOBBBBBOYO..',
    '..OYYOBNNNBOYYO.',
    '..OYYYOBBBOYYYO.',
    '.OYOYYYOOOYYYOYO',
    'OYYOOOOOOOOOOYYO',
    '.OOO........OOO.',
    '.OOO...OO...OOO.',
    '.......OYO......',
  ]],
  // Clefairy: a round pink body, curled ears with brown tips, a forehead curl, small wings and stubby limbs. Step = arm up, legs swapped.
  35: [[
    '................',
    '.OO.......OO....',
    'OBPO.....OPBO...',
    'OPPPO.O.OPPPO...',
    '.OPPPOPOPPPO....',
    '..OPPPPPPPPPO...',
    '..OPPWKPPPWKO...',
    '.OOPPKKPPPKKPO..',
    'OLLOPPPPPPPPPO..',
    'OLLOPPPRPPPPPO..',
    '.OOPPPPPPPPPPPO.',
    '..OPPOPPPPPOPPO.',
    '..OPPO.PPP.OPPO.',
    '...OPPOPPPOPPO..',
    '....OOPPPPPOO...',
    '.....OOO.OOO....',
  ], [
    '.OO.......OO....',
    'OBPO.....OPBO...',
    'OPPPO.O.OPPPO...',
    '.OPPPOPOPPPO....',
    '..OPPPPPPPPPO...',
    '..OPPWKPPPWKO...',
    '.OOPPKKPPPKKPO..',
    'OLLOPPPPPPPPPOO.',
    'OLLOPPPRPPPPPPO.',
    '.OOPPPPPPPPPPOPO',
    '..OPPOPPPPPOPPO.',
    '..OPPO.PPP.OOO..',
    '...OPPOPPPOPPO..',
    '....OOPPPPPPPO..',
    '.....OOO..OOO...',
    '................',
  ]],
};
const MAPSPR = { cache: {}, scale: 2 };
function hasMapSprite(num) { return !!MAP_SPRITES[num]; }
// Offscreen 32×32 canvas of frame `i` (0 idle, 1 step), mirrored when `flip`, optionally tinted ('grey' or a colour). Null when the species has no sheet.
function mapSprite(num, i = 0, flip = false, tint = null) {
  const frames = MAP_SPRITES[num]; if (!frames) return null;
  const key = num + ':' + i + (flip ? 'f' : '') + (tint || ''); let c = MAPSPR.cache[key]; if (c) return c;
  const rows = frames[i % frames.length], pal = MAP_PAL[num], s = MAPSPR.scale; c = document.createElement('canvas'); c.width = 16 * s; c.height = 16 * s; const g = c.getContext('2d');
  if (flip) { g.translate(16 * s, 0); g.scale(-1, 1); }
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < 16; x++) { const ch = rows[y][x]; if (!ch || ch === '.') continue; const col = pal[ch]; if (!col) continue; g.fillStyle = col; g.fillRect(x * s, y * s, s, s); }
  if (tint === 'grey') { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'destination-in'; g.drawImage(mapSprite(num, i, flip, null), 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(10,12,30,.4)'; g.fillRect(0, 0, c.width, c.height); }
  else if (tint) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); }
  MAPSPR.cache[key] = c; return c;
}
// Draw a board sprite standing on baseline `by` (the feet row), centred on cx. o: frame, flip, tint, alpha.
function drawMapSprite(num, cx, by, o = {}) {
  const img = mapSprite(num, o.frame || 0, !!o.flip, o.tint || null); if (!img) return false;
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(img, Math.round(cx - img.width / 2), Math.round(by - img.height), img.width, img.height);
  if (o.alpha != null) ctx.globalAlpha = 1; return true;
}
// Sanity: every frame is 16 rows of 16 characters (a malformed row would silently shift the art).
for (const n in MAP_SPRITES) for (const f of MAP_SPRITES[n]) { if (f.length !== 16) throw new Error('map sprite ' + n + ': ' + f.length + ' rows'); for (const r of f) if (r.length !== 16) throw new Error('map sprite ' + n + ': row "' + r + '" is ' + r.length + ' wide'); }
