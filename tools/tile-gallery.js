// Browser-side tile gallery for tools/cdp.cjs tiles: every terrain tile in its four variants at 3x, then two sample
// maps drawn through drawTerrain (autotiled shores, road edges, walls) at 2x. Evaluated in the page; returns the size.
(function(){
  const Z = +(window.__GZ || 3), T = 32;
  const chars = Object.keys(TERRAIN);
  const sample = window.__GMAP || [
    'TTT..,,..tttt....MM',
    'TT...,,.tttt..^^.MM',
    'T..HH....tt..^^^...',
    '..#####C######.....',
    '..#..............sss',
    '..#..~~~~~.......sss',
    '..#..~~~~~==###..sss',
    'Q.#..~~~~~......G..',
    '..#......,,..TT....',
  ];
  const cave = window.__GMAP2 || [
    'WWWWWWWWWWWWW',
    'WcccccrcccccW',
    'WccwwwcccLLcW',
    'WccwwwcccLLcW',
    'WcKccccrcccWW',
    'bbbbbbbbbbbbb',
    'bfffpfffxfffb',
    'bfffffffffffb',
    'bbbbbbbbbbbbb',
  ];
  const cv = document.createElement('canvas'); const cols = 16;
  const rowsTiles = Math.ceil(chars.length * 4 / cols);
  const mw = Math.max(...sample.map(r => r.length)), mh = sample.length, cw2 = Math.max(...cave.map(r => r.length)), ch2 = cave.length;
  cv.width = Math.max(cols * (T * Z + 4), (mw + cw2 + 1) * T * 2) + 8; cv.height = rowsTiles * (T * Z + 14) + Math.max(mh, ch2) * T * 2 + 40;
  cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#202020;image-rendering:pixelated;width:' + cv.width + 'px;height:' + cv.height + 'px';
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#202020'; g.fillRect(0, 0, cv.width, cv.height);
  let i = 0;
  for (const c of chars) for (let v = 0; v < 4; v++) { const x = 4 + (i % cols) * (T * Z + 4), y = 4 + Math.floor(i / cols) * (T * Z + 14); const img = tileImg(c, v, 0); g.drawImage(img, x, y, T * Z, T * Z); g.fillStyle = '#fff'; g.font = '10px monospace'; g.fillText(c + v, x, y + T * Z + 10); i++; }
  const mk = (rows) => { const h = rows.length, w = Math.max(...rows.map(r => r.length)); const tiles = [], variants = []; for (let y = 0; y < h; y++) { tiles.push([]); variants.push([]); for (let x = 0; x < w; x++) { const c = rows[y][x] || '.'; tiles[y].push(TERRAIN[c]); variants[y].push((x * 7 + y * 13 + ((x * y) % 5)) % 4); } } return { w, h, tiles, variants, items: [] }; };
  const drawMap = (rows, ox, oy) => { const m = mk(rows); const tmp = document.createElement('canvas'); tmp.width = m.w * T; tmp.height = m.h * T; const tg = tmp.getContext('2d'); tg.imageSmoothingEnabled = false; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) drawTerrain(tg, m, x, y, x * T, y * T, 0, 0); g.drawImage(tmp, ox, oy, m.w * T * 2, m.h * T * 2); return m; };
  const oy = 4 + rowsTiles * (T * Z + 14) + 10;
  drawMap(sample, 4, oy); drawMap(cave, 4 + (mw + 1) * T * 2, oy);
  document.body.appendChild(cv);
  return cv.width + 'x' + cv.height;
})()
