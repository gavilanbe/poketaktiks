// Browser-side panorama gallery for tools/cdp.cjs scenes: every battle-screen panorama (scenery.js) at the desktop
// field size, its layers composited, at 2x. Evaluated in the page; returns the size.
(function(){
  const kinds = [['field', 'plain'], ['meadow', 'flower'], ['tall', 'tall'], ['forest', 'forest'], ['mountain', 'mountain'], ['road', 'road'], ['beach', 'sand'], ['sea', 'water'], ['bridge', 'bridge'], ['town', 'center'], ['town', 'gym'], ['town', 'hq'], ['cave', 'cave'], ['pool', 'water'], ['base', 'floor'], ['volcano', 'cave'], ['volcano', 'lava'], ['snow', 'snow']];
  const W = 320, H = 180, hz = 118, gy = 158, Z = 2, cols = 3;
  const cv = document.createElement('canvas'); cv.width = cols * (W * Z + 6); cv.height = Math.ceil(kinds.length / cols) * (H * Z + 18);
  cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#202020;image-rendering:pixelated;width:' + cv.width + 'px;height:' + cv.height + 'px';
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#202020'; g.fillRect(0, 0, cv.width, cv.height);
  kinds.forEach(([k, tile], i) => {
    const S = sceneFor(k, W, H, hz, gy, i, tile), tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tg = tmp.getContext('2d');
    for (const l of [S.sky, S.far, S.mid, S.ground]) tg.drawImage(l, -SCENE_PAD, 0);
    tg.fillStyle = 'rgba(0,0,0,.3)'; tg.beginPath(); tg.ellipse(W * .27, gy + 1, 14, 3, 0, 0, 7); tg.fill(); tg.fillStyle = '#ff00ff'; tg.fillRect(W * .27 - 1, gy - 40, 2, 40);
    if (S.front) tg.drawImage(S.front, -SCENE_PAD, 0);
    const x = (i % cols) * (W * Z + 6), y = Math.floor(i / cols) * (H * Z + 18); g.drawImage(tmp, x, y, W * Z, H * Z); g.fillStyle = '#fff'; g.font = '12px monospace'; g.fillText(k + ' / ' + tile, x + 4, y + H * Z + 13);
  });
  document.body.appendChild(cv); return cv.width + 'x' + cv.height;
})()
