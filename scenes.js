// ============================================================================
// scenes.js — title, starter pick, chapter card, story dialogue, prep (party &
// bag), results, credits. The battle scene lives in battle.js.
// ============================================================================
'use strict';
const SC = { name: 'loading', t: 0, i: 0, hits: [], dialog: null, data: null };
function goScene(name, data) { SC.name = name; SC.t = 0; SC.i = 0; SC.hits = []; SC.data = data || null; SC.scroll = 0; if (name === 'title') { initTitle(); Audio.playMusic('title'); } }
function hit(x, y, w, h, run, label) { SC.hits.push({ x, y, w, h, run, label }); }
function hitAt(px2, py) { for (const h of SC.hits) if (px2 >= h.x && py >= h.y && px2 < h.x + h.w && py < h.y + h.h) return h; return null; }
function bigButton(x, y, w, h, label, run, opt = {}) {
  const hot = (INPUT.x >= x && INPUT.y >= y && INPUT.x < x + w && INPUT.y < y + h && !VIEW.touch) || opt.hot;
  uiButton(x, y, w, h, label, { hot, col: opt.col, variant: opt.variant, ink: opt.ink, big: !opt.small, disabled: opt.disabled, icon: opt.icon });
  hit(x, y, w, h, run, label); }

// ---------------------------------------------------------------- shared: draw a map definition as a backdrop
let BACKDROP = null;
function makeBackdrop(mapDef) { const m = parseMap(mapDef); const c = document.createElement('canvas'); c.width = m.w * TILE; c.height = m.h * TILE; const g = c.getContext('2d'); for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) drawTerrain(g, m, x, y, x * TILE, y * TILE, 0); return { canvas: c, map: m }; }
function drawBackdrop(bd, ox, oy, dim = .45) { const bw = bd.canvas.width, bh = bd.canvas.height; for (let y = Math.round(oy) % bh - (Math.round(oy) % bh > 0 ? bh : 0); y < VIEW.h; y += bh) for (let x = Math.round(ox) % bw - (Math.round(ox) % bw > 0 ? bw : 0); x < VIEW.w; x += bw) ctx.drawImage(bd.canvas, x, y); if (dim > 0) { ctx.globalAlpha = dim; rect(0, 0, VIEW.w, VIEW.h, '#080a14'); ctx.globalAlpha = 1; } }

// ---------------------------------------------------------------- title
// Title illustrations load independently of the sprite atlas. A missing image never blocks play.
const TITLE_ART = { image: null, ready: false };
const TITLE_SHEETS = {};
let TITLE_COMPOSITE = null;
function titleSheet(kind) {
  if (!TITLE_SHEETS[kind]) {
    const sheet = TITLE_SHEETS[kind] = { image: new Image(), ready: false };
    sheet.image.onload = () => { sheet.ready = true; };
    sheet.image.onerror = () => { sheet.ready = false; };
    sheet.image.src = 'assets/title/sprites/' + kind + '.png';
  }
  return TITLE_SHEETS[kind];
}
function titleSprite(kind, id, frame, x, y, w, h) {
  const sheet = titleSheet(kind), def = TITLE_SPRITES[kind][id];
  if (!sheet.ready || !def) return false;
  const f = def.frames[Math.max(0, Math.floor(frame)) % def.frames.length];
  ctx.drawImage(sheet.image, ...f, Math.round(x), Math.round(y), w == null ? f[2] : w, h == null ? f[3] : h);
  return true;
}
function titleButtonSprite(state, x, y, w, h) {
  const sheet = titleSheet('buttons'); if (!sheet.ready) return false;
  const def = TITLE_SPRITES.buttons[state], f = def.frames[0], cap = def.cap;
  const edge = Math.min(Math.round(h * cap / f[3]), Math.floor(w / 3));
  // Stretch only the quiet middle; the handmade end caps retain their proportions.
  ctx.drawImage(sheet.image, f[0], f[1], cap, f[3], x, y, edge, h);
  ctx.drawImage(sheet.image, f[0] + cap, f[1], f[2] - 2 * cap, f[3], x + edge, y, w - 2 * edge, h);
  ctx.drawImage(sheet.image, f[0] + f[2] - cap, f[1], cap, f[3], x + w - edge, y, edge, h);
  return true;
}
function titleBurst(x, y, count = 9) {
  const fx = SC.titleFx; if (!fx || REDUCED) return;
  for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * 2 / count, speed = 16 + i % 4 * 8;
    fx.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 9, age: 0, life: .35 + i % 3 * .12, kind: i % 2 ? 'spark' : 'diamond' });
  }
  fx.particles = fx.particles.slice(-64);
}
function titleSelect(i) {
  if (SC.titleFx?.action || i === SC.i) return;
  SC.i = i; SC.titleFx.focusAt = SC.t; Audio.sfx('titleFocus');
  const b = SC.hits[i]; if (b) titleBurst(b.x + b.w - 5, b.y + b.h / 2, 5);
}
function titleActivate(i) {
  const fx = SC.titleFx, item = SC.titleItems[i]; if (!fx || fx.action || !item) return;
  SC.i = i; fx.down = null; Audio.sfx('titleConfirm');
  if (REDUCED) { item.run(); return; }
  const b = SC.hits[i]; if (b) titleBurst(b.x + b.w - 10, b.y + b.h / 2, 16);
  fx.action = { i, t: 0, run: item.run };
}
function titleUpdate(dt) {
  const fx = SC.titleFx; if (!fx) return;
  SC.titleItems.forEach((item, i) => { item.hover = REDUCED ? +(i === SC.i) : lerp(item.hover, +(i === SC.i), 1 - Math.exp(-dt * 19)); });
  for (const p of fx.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 24 * dt; }
  fx.particles = fx.particles.filter(p => p.age < p.life);
  if (fx.action) {
    fx.action.t += dt;
    if (fx.action.t >= .2) { const run = fx.action.run; fx.action = null; run(); }
  }
}
const CLOUDS = [{ x: 40, y: 22, r: 36 }, { x: 260, y: 150, r: 48 }, { x: 420, y: 70, r: 30 }, { x: 150, y: 230, r: 42 }, { x: 330, y: 10, r: 26 }];
function drawCloudShadows(t) { ctx.globalAlpha = .14; for (const c of CLOUDS) { const x = ((c.x + t * 9) % (VIEW.w + 140)) - 70, y = c.y; ellipse(x, y, c.r, Math.round(c.r * .42), '#000'); ellipse(x - Math.round(c.r * .5), y + 4, Math.round(c.r * .6), Math.round(c.r * .28), '#000'); ellipse(x + Math.round(c.r * .5), y + 3, Math.round(c.r * .55), Math.round(c.r * .26), '#000'); } ctx.globalAlpha = 1; }
function titleArt() {
  if (!TITLE_ART.image) {
    const asset = TITLE_ART; asset.image = new Image();
    asset.image.onload = () => { asset.ready = true; TITLE_COMPOSITE = null; };
    asset.image.onerror = () => { asset.ready = false; };
    asset.image.src = 'assets/title/kanto-landscape-v1.webp';
  }
  return TITLE_ART;
}
function initTitle() {
  // Save state is a scene snapshot, not a localStorage read on every animation frame.
  const save = loadSave(), suspended = loadSuspend();
  const items = [];
  if (suspended) items.push({ label: 'RESUME BATTLE', sub: 'Return to your last turn', icon: 'play', run: resumeSuspend });
  if (save) {
    const chapter = CHAPTERS[clamp(save.chapter || 0, 0, CHAPTERS.length - 1)];
    items.push({ label: 'CONTINUE', sub: save.beaten ? 'Campaign complete · play again' : 'Chapter ' + chapter.num + ' · ' + chapter.title, icon: 'flag', run: continueCampaign });
  }
  items.push({ label: 'NEW GAME', sub: 'Campaign · 8 chapters', icon: 'map', run: () => { if (save && !confirm('Start a new game? Your campaign save will be replaced.')) return; startNewGame(); } });
  items.push({ label: 'SKIRMISH', sub: 'Random maps · wild Pokémon', icon: 'dice', run: startSkirmishSetup });
  items.push({ label: 'TERRITORY', sub: 'Capture · earn · deploy', icon: 'flag', run: startTerritorySetup });
  items.push({ label: 'VERSUS', sub: 'Local two-player battles', icon: 'vs', run: startVersusSetup });
  items.forEach((item, i) => { item.hover = i === 0 ? 1 : 0; });
  SC.titleItems = items; SC.menuLen = items.length;
  SC.titleFx = { particles: [], focusAt: -10, logoAt: -10, down: null, action: null };
  for (const kind of ['letters', 'icons', 'buttons', 'effects']) titleSheet(kind);
  titleArt();
}
function titleLayout(count) {
  const W = VIEW.w, H = VIEW.h;
  const portrait = H > W || W < 320, compact = !portrait && H < 245;
  const shortPortrait = portrait && H < 360 && count > 4;
  const gap = compact ? 2 : portrait ? 4 : 5, cols = compact && H < 190 && count > 4 ? 2 : 1;
  const w = portrait ? Math.min(250, W - 28) : cols === 2 ? Math.floor((W - 44) / 2) : Math.min(216, Math.floor(W * .4));
  const x = portrait ? Math.floor((W - w) / 2) : Math.max(16, Math.floor(W * .05));
  const logoY = shortPortrait ? 8 : portrait ? Math.max(14, Math.floor(H * .035)) : compact ? 8 : Math.max(12, Math.min(26, Math.floor(H * .07)));
  const logoH = shortPortrait ? 44 : compact ? (count > 4 ? 28 : 44) : portrait ? Math.min(69, W * .35) : count > 4 ? 58 : 70;
  const rows = Math.ceil(count / cols), endY = H - (compact ? 29 : 34);
  let rowH, menuY;
  if (portrait) {
    rowH = Math.min(count > 4 ? 28 : 34, Math.floor((endY - Math.max(H * .53, logoY + logoH + 32) - (rows - 1) * gap) / rows));
    rowH = Math.max(20, rowH);
    menuY = endY - rows * rowH - (rows - 1) * gap;
  } else {
    menuY = logoY + logoH + (compact ? 8 : 22);
    rowH = Math.min(compact ? 30 : 36, Math.floor((endY - menuY - (rows - 1) * gap) / rows));
    rowH = Math.max(18, rowH);
  }
  return { portrait, compact, shortPortrait, cols, x, w, logoY, logoH, menuY, rowH, gap };
}
function titleBackground(L) {
  const W = VIEW.w, H = VIEW.h, art = titleArt();
  const cacheKey = [W, H, L.portrait, L.logoH, L.menuY, art.ready].join(':');
  if (!TITLE_COMPOSITE || TITLE_COMPOSITE.key !== cacheKey) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#102a2b'; g.fillRect(0, 0, W, H);
    let imageTop = 0, imageBottom = H;
    if (art.ready) {
      const im = art.image;
      if (L.portrait) {
        // Frame the team's bounding band above the menu, preserving the illustration's proportions.
        const top = L.logoY + L.logoH + (L.shortPortrait ? 9 : 20), bottom = L.menuY - 20;
        const scale = Math.min(W / (im.naturalWidth * .56), Math.max(28, bottom - top) / (im.naturalHeight * .4));
        const dw = Math.ceil(im.naturalWidth * scale), dh = Math.ceil(im.naturalHeight * scale);
        imageTop = Math.round(top + (bottom - top - dh * .4) / 2 - dh * .43); imageBottom = imageTop + dh;
        g.drawImage(im, W - dw, imageTop, dw, dh);
      } else {
        const scale = Math.max(W / im.naturalWidth, H / im.naturalHeight);
        const dw = Math.ceil(im.naturalWidth * scale), dh = Math.ceil(im.naturalHeight * scale);
        g.drawImage(im, W - dw, Math.round((H - dh) / 2), dw, dh);
      }
    } else {
      const bd = makeBackdrop(CHAPTERS[3].map);
      const scale = Math.max(W / bd.canvas.width, H / bd.canvas.height);
      g.drawImage(bd.canvas, 0, 0, bd.canvas.width * scale, bd.canvas.height * scale);
      g.fillStyle = '#09262bd9'; g.fillRect(0, 0, W, H);
    }
    // Bake the legibility scrims once at the game's native pixel resolution.
    g.fillStyle = '#071e23';
    if (L.portrait) {
      for (let y = 0; y < H; y++) {
        const edge = art.ready ? Math.max(clamp((imageTop + 24 - y) / 24, 0, 1), clamp((y - imageBottom + 24) / 24, 0, 1)) : 0;
        g.globalAlpha = Math.max(edge, .08, .34 * Math.max(0, 1 - y / (H * .25)), .6 * clamp((y - L.menuY + 16) / 30, 0, 1));
        g.fillRect(0, y, W, 1);
      }
    } else {
      for (let x = 0; x < W; x++) {
        g.globalAlpha = .83 * Math.pow(clamp(1 - x / (W * .64), 0, 1), 1.1);
        g.fillRect(x, 0, 1, H);
      }
    }
    for (let y = Math.floor(H * .83); y < H; y++) {
      g.globalAlpha = .56 * (y / H - .83) / .17; g.fillRect(0, y, W, 1);
    }
    g.globalAlpha = 1;
    TITLE_COMPOSITE = { key: cacheKey, canvas: c };
  }
  ctx.drawImage(TITLE_COMPOSITE.canvas, 0, 0);
  if (REDUCED) return;
  // Quiet floating motes, away from the controls; no camera movement or flashing logo.
  for (let i = 0; i < 12; i++) {
    const x = (L.portrait ? VIEW.w * .12 : VIEW.w * .49) + ((i * 43 + Math.sin(SC.t * .25 + i) * 8) % (VIEW.w * (L.portrait ? .8 : .46)));
    const y = VIEW.h * (L.portrait ? .24 : .23) + ((i * 29 - SC.t * (2 + i % 3)) % (VIEW.h * .35) + VIEW.h * .35) % (VIEW.h * .35);
    ctx.globalAlpha = .2 + .25 * (1 + Math.sin(SC.t * .7 + i)) / 2;
    rect(x, y, i % 4 === 0 ? 2 : 1, 1, '#fff0ad');
  }
  ctx.globalAlpha = 1;
}
// The wordmark is assembled from independent letter sprites, never a flattened logo.
function drawLogo(cx, y, w, h) {
  SC.titleLetters = [];
  const sheet = titleSheet('letters');
  if (!sheet.ready) { // Keep the menu usable before the local sprite atlases finish decoding.
    const scale = Math.min(h / 24, (w - 12) / (textWidth('TAKTIKS', BIG) + 6));
    ctx.save(); ctx.translate(Math.round(cx), Math.round(y)); ctx.scale(scale, scale);
    bigC('POKÉ', 6, 0, '#f4c563', { outline: '#142e32' });
    bigC('TAKTIKS', 0, 12, '#f4f1d9', { outline: '#142e32' }); ctx.restore(); return;
  }
  const scale = Math.min(w / 174, h / 77), fx = SC.titleFx;
  const line = (word, palette, rowY, row) => {
    const letters = [...word], advance = letters.reduce((n, c) => n + TITLE_SPRITES.letters[palette + '-' + c].advance, 0) - 3;
    let x = cx - advance * scale / 2 + (row === 0 ? 8 * scale : 0);
    letters.forEach((c, i) => {
      const id = palette + '-' + c, def = TITLE_SPRITES.letters[id];
      const delay = .05 * i + row * .14, u = REDUCED ? 1 : clamp((SC.t - delay) / .48, 0, 1);
      const back = 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2);
      const lift = REDUCED ? 0 : Math.sin(SC.t * 1.8 + i * .45 + row) * .65;
      const wave = REDUCED ? 0 : Math.sin(clamp((SC.t - fx.logoAt - delay) / .4, 0, 1) * Math.PI) * 4;
      const yy = y + rowY * scale + (1 - back) * -9 + lift - wave;
      const gx = x - def.anchor[0] * scale, gy = yy - def.anchor[1] * scale;
      const bw = (def.advance - 3) * scale, bh = def.bodyHeight * scale;
      const hot = !VIEW.touch && INPUT.x >= x && INPUT.x < x + bw && INPUT.y >= yy && INPUT.y < yy + bh;
      const gleam = (SC.t - i * .075 - row * .2) % 4.8;
      const frame = REDUCED ? 0 : hot ? 3 : gleam >= .85 && gleam < 1.25 ? 1 + Math.floor((gleam - .85) * 10) : 0;
      ctx.save(); ctx.globalAlpha = u;
      // A small per-letter squash on arrival, with independent timing and glint frames.
      const sy = REDUCED ? 1 : .78 + .22 * back;
      ctx.translate(gx, gy + bh * (1 - sy)); ctx.scale(1, sy);
      titleSprite('letters', id, frame, 0, 0, 40 * scale, 42 * scale); ctx.restore();
      SC.titleLetters.push({ x, y: yy, w: bw, h: bh });
      x += def.advance * scale;
    });
  };
  line('POKÉ', 'gold', 4, 0); line('TAKTIKS', 'ivory', 42, 1);
  const ballX = cx - 70 * scale, ballY = y + 4 * scale + (REDUCED ? 0 : Math.sin(SC.t * 2.2) * 1.2);
  titleSprite('icons', 'ball', REDUCED ? 0 : SC.t * 5, ballX, ballY, 28 * scale, 28 * scale);
  const underlineY = y + 75 * scale;
  hline(cx - 65 * scale, underlineY, 130 * scale, '#ac803c');
  hline(cx - 60 * scale, underlineY - 1, 120 * scale, '#ffe3a0');
}
function titleFitText(s, w) {
  if (textWidth(s) <= w) return s;
  while (s.length && textWidth(s + '…') > w) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}
function titleCard(x, y, w, h, item, selected, run, index) {
  const fx = SC.titleFx, confirming = fx.action?.i === index;
  const held = INPUT.down && fx.down === index, pressed = held || confirming;
  const u = REDUCED ? 1 : clamp((SC.t - .16 - index * .045) / .34, 0, 1);
  const slide = REDUCED ? 0 : Math.round(item.hover * 2 - Math.pow(1 - u, 3) * 7);
  const down = REDUCED ? 0 : pressed ? 1 : -Math.round(item.hover);
  const pressScale = REDUCED || !pressed ? 1 : confirming ? 1 - .035 * Math.sin(clamp(fx.action.t / .15, 0, 1) * Math.PI) : .97;
  ctx.save(); ctx.translate(x + slide + w * (1 - pressScale) / 2, y + down); ctx.scale(pressScale, 1); ctx.globalAlpha = .3 + .7 * u;
  if (!titleButtonSprite(pressed ? 'pressed' : selected ? 'focus' : 'idle', 0, 0, w, h + 3)) {
    rrect(0, 2, w, h, '#051c23', 2); rrect(0, 0, w, h, selected ? '#e3bd69' : '#5c817a', 2);
    rrect(2, 2, w - 4, h - 4, '#123442', 1);
  }
  const size = Math.min(23, h - 4), cy = (h - size) / 2;
  const iconFrame = REDUCED || !selected ? 0 : Math.floor(SC.t * TITLE_SPRITES.icons[item.icon].fps);
  if (!titleSprite('icons', item.icon, iconFrame, 8, cy, size, size)) iconAt(item.icon, 10, (h - 9) / 2, '#f8dd8e');
  const sub = h >= 28, ty = sub ? (h >= 34 ? 7 : 6) : Math.round((h - 9) / 2) - 1;
  bigText(item.label, 34, ty, selected ? '#fff0b6' : '#e0ebdd', { shadow: '#081a2b' });
  if (sub) text(titleFitText(item.sub, w - 47), 34, h >= 34 ? 19 : 17, selected ? '#b5d9cd' : '#a1b8b3');
  if (selected && !REDUCED) {
    const sweep = (SC.t - fx.focusAt) / .5;
    if (sweep >= 0 && sweep < 1) {
      ctx.save(); ctx.beginPath(); ctx.rect(6, 3, w - 12, h - 5); ctx.clip();
      ctx.globalAlpha *= .18 * Math.sin(sweep * Math.PI);
      for (let k = 0; k < 5; k++) rect(sweep * (w + 20) - 20 + k, 3, 1, h - 5, '#fff6c9');
      ctx.restore();
    }
    titleSprite('effects', 'spark', SC.t * 7, w - 15, 0, 13, 13);
  }
  ctx.restore();
  if (selected) {
    const bob = REDUCED ? 0 : Math.sin(SC.t * 4) * 1;
    if (!titleSprite('icons', 'ball', REDUCED ? 0 : SC.t * 6, x - 10 + bob, y + (h - 13) / 2, 13, 13)) text('▸', x - 7, y + (h - 7) / 2, '#ffdf8d');
  }
  // Hit targets remain stable during squash, entrance and focus effects.
  hit(x, y, w, h, run, item.label);
}
function titleDraw() {
  if (!SC.titleItems) initTitle();
  const items = SC.titleItems, W = VIEW.w, H = VIEW.h, L = titleLayout(items.length);
  SC.i = clamp(SC.i, 0, items.length - 1); SC.titleCols = L.cols;
  titleBackground(L);
  drawLogo(L.x + L.w / 2, L.logoY, L.w, L.logoH);
  if (!L.compact && !L.shortPortrait) {
    const captionY = L.logoY + L.logoH + 6;
    textC('A PIXEL TACTICS ADVENTURE', L.x + L.w / 2, captionY, '#e1dfbe', { shadow: '#09262b' });
  }
  if (L.portrait) textC('CHOOSE YOUR ADVENTURE', W / 2, L.menuY - 15, '#c4d1ac');
  SC.hits = [];
  items.forEach((item, i) => {
    const x = L.cols === 2 ? 18 + (i % 2) * (L.w + 8) : L.x;
    const y = L.menuY + Math.floor(i / L.cols) * (L.rowH + L.gap);
    titleCard(x, y, L.w, L.rowH, item, SC.i === i, () => titleActivate(i), i);
  });
  // The sound control is a real touch target, separate from keyboard menu navigation.
  const sound = Audio.muted ? 'SOUND OFF' : 'SOUND ON', sw = textWidth(sound) + 22;
  SC.titleSound = { x: 8, y: H - 27, w: sw, h: 23 };
  const soundHot = !VIEW.touch && INPUT.x >= 8 && INPUT.x < 8 + sw && INPUT.y >= H - 27;
  if (soundHot) rrect(8, H - 25, sw, 20, '#345449b3', 2);
  if (!titleSprite('icons', 'music', REDUCED || Audio.muted ? 0 : SC.t * 4, 10, H - 23, 17, 17)) text('♪', 14, H - 18, '#f2d382');
  text(sound, 29, H - 18, '#c9d4bb');
  if (!L.portrait) {
    hintLine(VIEW.touch ? ['tap to begin'] : [['↑↓', 'select'], ['Z', 'confirm']], W / 2, H - 18, { pill: false, col: '#c9d4bb' });
    textR('GEN I · FAN GAME', W - 14, H - 18, '#b6c8ab');
  } else textR('GEN I · FAN GAME', W - 12, H - 18, '#b6c8ab');
  if (!REDUCED) for (const p of SC.titleFx.particles) {
    ctx.globalAlpha = 1 - p.age / p.life;
    titleSprite('effects', p.kind, p.age * 9, p.x - 6, p.y - 6, 12, 12);
  }
  ctx.globalAlpha = 1;
  const action = SC.titleFx.action;
  if (action && !REDUCED && action.t > .12) {
    ctx.globalAlpha = clamp((action.t - .12) / .08, 0, 1) * .75;
    rect(0, 0, W, H, '#08192a'); ctx.globalAlpha = 1;
  }
}
function titleInput(ev) {
  const n = SC.menuLen || 0, fx = SC.titleFx;
  if (!n || !fx || fx.action) return;
  if (ev.type === 'key') {
    const cols = SC.titleCols || 1;
    if (ev.key === 'up' || ev.key === 'down' || ev.key === 'left' || ev.key === 'right' || ev.key === 'next') {
      const delta = ev.key === 'up' ? -cols : ev.key === 'down' ? cols : ev.key === 'left' ? -1 : 1;
      titleSelect((SC.i + delta + n) % n);
    } else if (ev.key === 'ok') titleActivate(SC.i);
    else if (ev.key === 'mute') Audio.toggle();
    return;
  }
  if (ev.type === 'down' && (ev.btn == null || ev.btn === 0)) {
    const b = hitAt(ev.x, ev.y); fx.down = b ? SC.hits.indexOf(b) : -1;
    if (fx.down >= 0) titleSelect(fx.down); return;
  }
  if (ev.type === 'move' && !ev.touch && !INPUT.down) {
    const b = hitAt(ev.x, ev.y); if (b) titleSelect(SC.hits.indexOf(b)); return;
  }
  if (ev.type === 'up' && (ev.btn == null || ev.btn === 0)) {
    const from = fx.down; fx.down = null;
    const s = SC.titleSound;
    if (s && ev.x >= s.x && ev.x < s.x + s.w && ev.y >= s.y && ev.y < s.y + s.h) { Audio.toggle(); return; }
    const b = hitAt(ev.x, ev.y), i = b ? SC.hits.indexOf(b) : -1;
    if (i >= 0 && (from == null || from === i)) { titleActivate(i); return; }
    if (SC.titleLetters?.some(l => ev.x >= l.x && ev.x <= l.x + l.w && ev.y >= l.y && ev.y <= l.y + l.h)) {
      fx.logoAt = SC.t; titleBurst(ev.x, ev.y, 12); Audio.sfx('titleFocus');
    }
  }
}

// ---------------------------------------------------------------- versus setup (draft two teams, pick an arena)
function vsPick(S, n) {
  const picks = S.teams[0].length + S.teams[1].length; if (picks >= S.size * 2) { Audio.sfx('error'); return; }
  if (S.teams[0].includes(n) || S.teams[1].includes(n)) { Audio.sfx('error'); return; }
  const t = S.order[picks]; S.teams[t].push(n); Audio.sfx(picks + 1 >= S.size * 2 ? 'select' : 'ok');
}
function vsUndo(S) { const picks = S.teams[0].length + S.teams[1].length; if (!picks) return false; S.teams[S.order[picks - 1]].pop(); Audio.sfx('cancel'); return true; }
function vsRandom(S) { const free = VS_ROSTER.filter(n => !S.teams[0].includes(n) && !S.teams[1].includes(n)); while (S.teams[0].length + S.teams[1].length < S.size * 2 && free.length) { const i = Math.floor(Math.random() * free.length); vsPick(S, free.splice(i, 1)[0]); } Audio.sfx('select'); }
// Match rules shown beside the roster: each row cycles with its arrows (or a tap on the value).
const VS_RULES = [
  { k: 'mode', label: 'MODE', vals: ['elim', 'ctf', 'hill'], show: v => VS_MODES[v].name },
  { k: 'arena', label: 'ARENA', vals: ['s', 'm', 'l'], show: v => VS_ARENAS[v].name + ' ' + VS_ARENAS[v].w + '×' + VS_ARENAS[v].h },
  { k: 'fog', label: 'FOG', vals: [false, true], show: v => v ? 'On' : 'Off' },
  { k: 'wild', label: 'WILD', vals: [false, true], show: v => v ? 'On' : 'Off' },
  { k: 'level', label: 'LEVEL', vals: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50], show: v => 'Lv ' + v },
  { k: 'turns', label: 'TURNS', vals: [20, 30, 40, 0], show: v => v ? String(v) : 'No limit' },
  { k: 'seed', label: 'SEED', vals: null, show: v => '#' + v },
];
function vsCycle(S, rule, dir) { if (rule.vals) { const i = rule.vals.indexOf(S[rule.k]); S[rule.k] = rule.vals[(Math.max(0, i) + dir + rule.vals.length) % rule.vals.length]; } else S.seed = (S.seed + dir + 1000) % 1000; Audio.sfx('menu'); }
function vsRuleRows(S, x, y, w, rh, rules) {
  rules.forEach((rule, i) => { const ry = y + i * rh; const val = rule.show(S[rule.k]); const bw = 16, bhh = rh - 2;
    if (i % 2) { ctx.globalAlpha = .18; rect(x, ry, w, rh, '#ffffff'); ctx.globalAlpha = 1; }
    text(rule.label, x + 4, ry + (rh - 7) / 2, UI.muted);
    bigButton(x + w - bw, ry + 1, bw, bhh, '▸', () => vsCycle(S, rule, 1), { small: true, variant: 'dark' }); bigButton(x + w - 2 * bw - 3, ry + 1, bw, bhh, '◂', () => vsCycle(S, rule, -1), { small: true, variant: 'dark' });
    // the test harness and screen readers see the arrows as LABEL- / LABEL+
    SC.hits[SC.hits.length - 1].label = rule.label + '-'; SC.hits[SC.hits.length - 2].label = rule.label + '+';
    textR(val, x + w - 2 * bw - 7, ry + (rh - 7) / 2, rule.k === 'mode' ? UI.gold : UI.ink); hit(x, ry, w - 2 * bw - 4, rh, () => vsCycle(S, rule, 1), rule.label); });
}
function versusDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data; rect(0, 0, W, H, '#0e0c10');
  const mapKey = [S.seed, S.wild, S.mode, S.arena, S.fog, S.level].join('|'); if (!S.bd || S.bdKey !== mapKey) { S.map = vsMapFor(S); S.bd = makeBackdrop(S.map); S.bdKey = mapKey; }
  drawBackdrop(S.bd, (W - S.bd.canvas.width) / 2, (H - S.bd.canvas.height) / 2, .8); SC.hits = [];
  const picks = S.teams[0].length + S.teams[1].length, full = picks >= S.size * 2; const cur = full ? -1 : S.order[picks]; S.cur = cur;
  screenTitle('VERSUS', null, 3);
  textC(full ? 'Both teams are ready!' : 'PLAYER ' + (cur + 1) + ' picks  ·  ' + (picks + 1) + ' / ' + S.size * 2, W / 2, 18, full ? UI.green : cur === 0 ? '#8ab4ff' : '#ff9a9a', { outline: UI.shadow });
  const narrow = narrowView(); const bh = btnH(); let gy;
  // arena preview with the mode furniture (flag bases, the hill, deploy zones)
  const preview = (mx, my, pwid, phei) => { const sc = pwid / S.bd.canvas.width; ctx.drawImage(S.bd.canvas, mx, my, pwid, phei); outline(mx - 1, my - 1, pwid + 2, phei + 2, UI.border);
    const cell = Math.ceil(TILE * sc); for (const d of S.map.deploy) rect(mx + d.x * TILE * sc, my + d.y * TILE * sc, cell, cell, '#3d7dff90'); for (const d of S.map.deploy2) rect(mx + d.x * TILE * sc, my + d.y * TILE * sc, cell, cell, '#ff4b4b90');
    if (S.map.hill) { const h = S.map.hill; outline(mx + (h.x - 1) * TILE * sc, my + (h.y - 1) * TILE * sc, cell * 3, cell * 3, UI.gold); }
    if (S.map.flags) for (const f of S.map.flags) rect(mx + f.x * TILE * sc, my + f.y * TILE * sc, cell, cell, teamColorL(f.team));
    if (S.fog) { ctx.globalAlpha = .35; rect(mx, my, pwid, phei, '#060a16'); ctx.globalAlpha = 1; textC('FOG', mx + pwid / 2, my + phei / 2 - 3, UI.ink, { outline: '#000' }); } };
  if (narrow) { // phones: two compact team strips, no arena preview, a four-column roster
    const pw = Math.floor((W - 16) / 2), ph = 40, py = 38;
    const strip = (t, x) => { panel(x, py, pw, ph, { title: 'P' + (t + 1), fill: t === 0 ? '#17264a' : '#3a1a22', border: cur === t ? UI.gold : UI.border });
      const sw = Math.floor((pw - 10) / S.size); for (let i = 0; i < S.size; i++) { const sx = x + 5 + i * sw; portraitBg(sx, py + 7, sw - 2, 22, t); const n = S.teams[t][i]; if (n != null) { ctx.drawImage(monIcon(n, t === 1), sx + Math.round((sw - 2 - 24) / 2), py + 10, 24, 18); hit(sx, py + 7, sw - 2, 22, () => { S.teams[t].splice(i, 1); Audio.sfx('cancel'); }); } else if (cur === t && i === S.teams[t].length) { if (Math.floor(SC.t * 3) % 2) outline(sx, py + 7, sw - 2, 22, UI.gold); } else textC('?', sx + (sw - 2) / 2, py + 14, '#ffffff40'); }
      textC(S.teams[t].length >= S.size ? 'READY' : cur === t ? 'PICKING…' : S.teams[t].length + '/' + S.size, x + pw / 2, py + ph - 9, S.teams[t].length >= S.size ? UI.green : cur === t ? UI.gold : UI.muted); };
    strip(0, 6); strip(1, W - 6 - pw); gy = py + ph + 8;
  } else {
    // team panels left / right, arena preview in the middle
    const pw = Math.min(140, Math.floor((W - 110) / 2) - 8), ph = 56, py = 28; const p1x = 6, p2x = W - pw - 6;
    const teamPanel = (t, x) => { panel(x, py, pw, ph, { title: 'PLAYER ' + (t + 1), fill: t === 0 ? '#17264a' : '#3a1a22', border: cur === t ? UI.gold : UI.border });
      const sw = Math.floor((pw - 12) / S.size); for (let i = 0; i < S.size; i++) { const sx = x + 6 + i * sw; portraitBg(sx, py + 8, sw - 2, 34, t); const n = S.teams[t][i]; if (n != null) { drawMon(n, sx + (sw - 2) / 2, py + 40, { flip: t === 1 }); hit(sx, py + 8, sw - 2, 34, () => { S.teams[t].splice(i, 1); Audio.sfx('cancel'); }); } else if (cur === t && i === S.teams[t].length) { if (Math.floor(SC.t * 3) % 2) outline(sx, py + 8, sw - 2, 34, UI.gold); } else textC('?', sx + (sw - 2) / 2, py + 22, '#ffffff40'); }
      text(S.teams[t].length + '/' + S.size + ' picked', x + 6, py + ph - 10, UI.muted); textR(S.teams[t].length >= S.size ? 'READY' : cur === t ? 'PICKING…' : 'waiting', x + pw - 6, py + ph - 10, S.teams[t].length >= S.size ? UI.green : cur === t ? UI.gold : UI.muted); };
    teamPanel(0, p1x); teamPanel(1, p2x);
    const mw = p2x - (p1x + pw) - 12; const sc = Math.min(mw / S.bd.canvas.width, (ph - 4) / S.bd.canvas.height); const pwid = Math.round(S.bd.canvas.width * sc), phei = Math.round(S.bd.canvas.height * sc); preview(Math.round(W / 2 - pwid / 2), py + Math.round((ph - phei) / 2), pwid, phei);
    gy = py + ph + 8;
  }
  // roster grid (left on wide screens, centred on phones) and the match rules beside / under it
  const cols = vsCols(), cw = 40, chh = narrow ? 22 : 30; const rows = Math.ceil(VS_ROSTER.length / cols); const gx = narrow ? Math.round(W / 2 - cols * cw / 2) : 6;
  rrect(gx - 3, gy - 3, cols * cw + 6, rows * chh + 6, '#0b1020c0', 2); outline(gx - 3, gy - 3, cols * cw + 6, rows * chh + 6, UI.border2);
  VS_ROSTER.forEach((n, i) => { const x = gx + (i % cols) * cw, y = gy + Math.floor(i / cols) * chh; const hot = SC.i === i; const t = S.teams[0].includes(n) ? 0 : S.teams[1].includes(n) ? 1 : -1;
    rrect(x + 1, y + 1, cw - 2, chh - 2, hot ? '#2c4784' : t >= 0 ? teamColorD(t) : '#141c30', 1); if (hot) outline(x + 1, y + 1, cw - 2, chh - 2, UI.gold);
    if (t >= 0) ctx.globalAlpha = .45; drawMon(n, x + cw / 2, y + chh - 2 + (hot ? Math.round(Math.sin(SC.t * 8)) : 0), {}); ctx.globalAlpha = 1;
    if (t >= 0) { rrect(x + cw - 13, y + 2, 11, 8, teamColor(t), 1); textC('P' + (t + 1), x + cw - 8, y + 2, '#ffffff'); }
    hit(x, y, cw, chh, () => { SC.i = i; vsPick(S, n); }); });
  const d = DEX[VS_ROSTER[SC.i]]; const iy = gy + rows * chh + 5;
  if (d) { const u = makeUnit(d.num, S.level, 0); text(d.name, gx, iy, UI.ink, { outline: UI.shadow }); d.types.forEach((tp, j) => typeBadge(tp, gx + textWidth(d.name) + 6 + j * 26, iy - 1, 24)); const mv = u.moves.slice(0, 3).map(m => m.name).join(' / '); const R = ROLES[u.role]; if (narrow) { let s = mv; const avail = gx + cols * cw - (gx + textWidth(d.name) + 6 + d.types.length * 26 + 4); while (textWidth(s) > avail && s.length > 4) s = s.slice(0, -1); textR(s, gx + cols * cw, iy, UI.info, { outline: UI.shadow }); } else { textR(mv, gx + cols * cw, iy, UI.info, { outline: UI.shadow }); text('HP ' + u.maxHp + '  ATK ' + u.atk + '  DEF ' + u.def + '  SPA ' + u.spa + '  SPE ' + u.spe + '  MOV ' + u.mov, gx, iy + 10, UI.muted, { outline: UI.shadow }); const rx0 = gx + textWidth(d.name) + 6 + d.types.length * 26 + 4; let rs = R.name + ': ' + (u.skill ? u.skill.blurb.replace(/^[^:]+: /, '') : 'plain attacker'); while (textWidth(rs) > gx + cols * cw - textWidth(mv) - 8 - rx0 && rs.length > 8) rs = rs.slice(0, -1); text(rs, rx0, iy, R.col, { outline: UI.shadow }); } }
  const go = () => { if (!full) { Audio.sfx('error'); return; } Audio.sfx('select'); S.go(); }; const goOpt = full ? { variant: 'danger' } : { disabled: true };
  if (narrow) {
    const r1 = H - 2 * (bh + 4), r2 = H - bh - 4, cw3 = Math.floor((W - 20) / 3); const rulesY = iy + 12, phoneRules = VS_RULES.filter(r => r.k !== 'turns'), rh = clamp(Math.floor((r1 - 6 - rulesY) / phoneRules.length), 14, 16);
    vsRuleRows(S, 6, rulesY, W - 12, rh, phoneRules);
    footerBand(2 * (bh + 4) + 4);
    bigButton(6, r1, cw3, bh, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { variant: 'ghost' }); bigButton(10 + cw3, r1, cw3, bh, 'RANDOM', () => vsRandom(S)); bigButton(14 + 2 * cw3, r1, cw3, bh, 'CLEAR', () => { S.teams = [[], []]; Audio.sfx('cancel'); }, { variant: 'dark' });
    bigButton(6, r2, W - 12, bh, 'BATTLE!', go, goOpt);
  } else {
    const rx = gx + cols * cw + 10, rw = W - 6 - rx, ry = gy; const fy = footerBand(28); const rh = 14, lines = wrap(VS_MODES[S.mode].blurb + (S.fog ? ' Fog of war hides foes beyond your Pokémon\'s sight.' : ''), rw - 16); const nl = Math.min(lines.length, Math.max(1, Math.floor((fy - 6 - ry - 21 - VS_RULES.length * rh - 10) / 9)));
    const p = panel(rx, ry, rw, Math.min(fy - 6 - ry, 21 + VS_RULES.length * rh + 8 + nl * 9 + 6), { header: 'MATCH RULES', headerRight: VS_MODES[S.mode].short + (S.fog ? ' · FOG' : '') });
    vsRuleRows(S, rx + 4, p.cy - 2, rw - 8, rh, VS_RULES);
    const by0 = p.cy - 2 + VS_RULES.length * rh + 3; hline(rx + 5, by0, rw - 10, UI.inset); lines.slice(0, nl).forEach((l, i) => text(l, rx + 8, by0 + 4 + i * 9, UI.muted));
    const by = fy + 5; bigButton(6, by, 60, 18, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { variant: 'ghost' }); bigButton(72, by, 70, 18, 'RANDOM', () => vsRandom(S)); bigButton(148, by, 60, 18, 'CLEAR', () => { S.teams = [[], []]; Audio.sfx('cancel'); }, { variant: 'dark' });
    if (W > 470) hintLine(['Snake draft', 'click a picked slot to drop it'], 216, by + 5, { left: true, pill: false }); bigButton(W - 96, by, 90, 18, 'BATTLE!', go, goOpt);
  }
}
function vsCols() { return VIEW.w < 300 ? 4 : VIEW.w < 330 ? 6 : 7; }
function versusInput(ev) {
  const S = SC.data; const cols = vsCols();
  if (ev.type === 'key') { const n = VS_ROSTER.length; if (ev.key === 'left') SC.i = (SC.i + n - 1) % n; else if (ev.key === 'right') SC.i = (SC.i + 1) % n; else if (ev.key === 'up') SC.i = (SC.i + n - cols) % n; else if (ev.key === 'down') SC.i = (SC.i + cols) % n; else if (ev.key === 'ok') vsPick(S, VS_ROSTER[SC.i]); else if (ev.key === 'back') { if (!vsUndo(S)) goScene('title'); } else if (ev.key === 'next') { if (S.teams[0].length + S.teams[1].length >= S.size * 2) S.go(); else vsRandom(S); } else if (ev.key === 'mute') Audio.toggle(); if (['left', 'right', 'up', 'down'].includes(ev.key)) Audio.sfx('cursor'); return; }
  if (ev.type === 'move' && !ev.touch) { const h = hitAt(ev.x, ev.y); if (h) { const i = VS_ROSTER.findIndex((n, j) => SC.hits.indexOf(h) >= 0 && h.run && h.label == null && false); } return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- starter pick
function starterDraw() { captainChoiceDraw(); }

function starterInput(ev) {
  if (ev.type === 'key') { if (ev.key === 'left' || ev.key === 'up') { SC.i = (SC.i + 2) % 3; Audio.sfx('cursor'); } else if (ev.key === 'right' || ev.key === 'down') { SC.i = (SC.i + 1) % 3; Audio.sfx('cursor'); } else if (ev.key === 'ok') { Audio.sfx('select'); pickStarter(STARTERS[SC.i]); } else if (ev.key === 'back') goScene('title'); return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- chapter card
// Chapter title card: the map itself, dimmed, behind a letterboxed band; the title grows in and the rules follow.
function cardDraw() {
  const W = VIEW.w, H = VIEW.h; const ch = SC.data.chapter; rect(0, 0, W, H, '#0e0c10');
  if (!SC.data.bd) SC.data.bd = makeBackdrop(ch.map); const bd = SC.data.bd; drawBackdrop(bd, (W - bd.canvas.width) / 2 - SC.t * 4, (H - bd.canvas.height) / 2, .78);
  const k = Math.min(1, SC.t / .5), y = Math.round(H / 2 - 22); const ts = textWidth(ch.title.toUpperCase(), BIG) * 2 > W - 8 ? 1 : 2;
  const bandH = 64; rect(0, 0, W, Math.max(0, y - 14 - Math.round(H * .18)), '#070a14'); rect(0, y - 14 + bandH + Math.round(H * .18), W, H, '#070a14');
  ctx.globalAlpha = .82 * k; rect(0, y - 14, W, bandH, '#070a14'); ctx.globalAlpha = k; hline(0, y - 14, W, UI.gold); hline(0, y - 13, W, UI.goldDark); hline(0, y - 14 + bandH, W, UI.gold); hline(0, y - 15 + bandH, W, UI.goldDark);
  bigC(ch.num ? 'CHAPTER ' + ch.num : 'SKIRMISH', W / 2, y - 6, UI.muted, { outline: UI.shadow });
  const grow = easeOut(k); ctx.save(); ctx.translate(W / 2, y + 8 + (ts === 1 ? 4 : 0)); ctx.scale(ts * (.6 + .4 * grow), ts * (.6 + .4 * grow)); bigC(ch.title, 0, 0, UI.gold, { outline: '#3a2000' }); ctx.restore();
  if (SC.t > .35) { ctx.globalAlpha = Math.min(1, (SC.t - .35) / .3); wrap(objectiveTextFor(ch.map.objective), W - 12).forEach((l, i) => textC(l, W / 2, y + 34 + i * 9, UI.ink)); }
  ctx.globalAlpha = 1; if (SC.t > 2.4 || (SC.t > .6 && SC.skip)) { SC.skip = false; SC.data.next(); }
}
function objectiveTextFor(o) { switch (o.type) { case 'rout': return 'Objective: defeat all enemies'; case 'boss': return 'Objective: defeat ' + (o.bossName || 'the boss'); case 'survive': return 'Objective: survive ' + o.turns + ' turns'; case 'seize': return 'Objective: seize the ' + (o.what || 'gym'); case 'versus': return 'Objective: defeat the other trainer'; } return ''; }
function cardInput(ev) { if (ev.type === 'up' || (ev.type === 'key' && ev.key === 'ok')) SC.skip = true; }

// ---------------------------------------------------------------- story dialogue (drawn over the battle board)
function startDialog(lines, done) { SC.dialog = { lines, i: 0, chars: 0, t: 0, done }; goScene('story'); }
function storyUpdate(dt) { const d = SC.dialog; if (!d) return; d.t += dt; const line = d.lines[d.i]; const total = line.text.length; if (d.chars < total) { const before = d.chars; d.chars = Math.min(total, d.chars + dt * 45); if (Math.floor(d.chars) !== Math.floor(before) && Math.floor(d.chars) % 2 === 0) Audio.sfx('text'); } CAM.x += (CAM.tx - CAM.x) * Math.min(1, dt * 6); CAM.y += (CAM.ty - CAM.y) * Math.min(1, dt * 6); for (const u of B.units) { u.fx.sx += (1 - u.fx.sx) * dt * 10; u.fx.sy += (1 - u.fx.sy) * dt * 10; } updateFX(dt); Audio.tick(); BT.time += dt; }
function storyDraw() {
  battleDraw(); const d = SC.dialog; if (!d) return; const W = VIEW.w, H = VIEW.h; const line = d.lines[d.i];
  ctx.globalAlpha = .35; rect(0, 0, W, H, '#000'); ctx.globalAlpha = 1;
  const bh = 58, by = H - bh - 6, bx = 6, bw = W - 12; panel(bx, by, bw, bh, { fill: '#182640' });
  if (line.mon) { requestBigSprite(line.mon); ctx.save(); ctx.beginPath(); ctx.rect(bx + 6, by + 8, 44, 40); ctx.clip(); portraitBg(bx + 6, by + 8, 44, 40, 0);
    const talk = d.chars < line.text.length ? Math.round(Math.sin(d.t * 8)) : 0; if (bigReady(line.mon)) drawBig(line.mon, bx + 28, by + 8 + 40 + 14 + talk, { flip: true }); else drawMon(line.mon, bx + 28, by + 46 + talk, { flip: false }); ctx.restore(); outline(bx + 6, by + 8, 44, 40, UI.inset); }
  const tx = bx + (line.mon ? 58 : 10); { const tw = textWidth(line.who) + 12; rrect(tx - 4, by - 9, tw, 12, UI.inset, 1); rect(tx - 3, by - 8, tw - 2, 10, UI.gold); hline(tx - 2, by - 8, tw - 4, '#fff0b0'); text(line.who, tx + 2, by - 7, UI.goldDark); }
  const lines = wrap(line.text, bw - (line.mon ? 70 : 22)); let shown = Math.floor(d.chars); lines.forEach((l, i) => { if (shown <= 0) return; const s = l.slice(0, shown); shown -= l.length + 1; text(s, tx, by + 12 + i * 11, UI.ink); });
  if (d.chars >= line.text.length && Math.floor(d.t * 3) % 2) { const ax = bx + bw - 12, ay = by + bh - 9; rect(ax - 3, ay, 7, 1, UI.gold); rect(ax - 2, ay + 1, 5, 1, UI.gold); rect(ax - 1, ay + 2, 3, 1, UI.gold); px(ax, ay + 3, UI.gold); }
  hintLine([(d.i + 1) + ' / ' + d.lines.length, ['X', 'skip']], bx + bw - 4, by - 12, { right: true });
  // focus the camera on the speaker's Pokémon if it is on the board
  const spk = B.units.find(u => u.num === line.mon && u.hp > 0); if (spk && !d.focused) { d.focused = true; centerCam(spk.x, spk.y); spk.fx.sy = .8; spk.fx.sx = 1.2; }
}
function storyInput(ev) { const d = SC.dialog; if (!d) return; if (ev.type === 'key' && ev.key === 'back') { finishDialog(); return; } if (ev.type === 'up' || (ev.type === 'key' && ev.key === 'ok')) { const line = d.lines[d.i]; if (d.chars < line.text.length) { d.chars = line.text.length; return; } d.i++; d.chars = 0; d.t = 0; d.focused = false; Audio.sfx('ok'); if (d.i >= d.lines.length) finishDialog(); } }
function finishDialog() { const d = SC.dialog; SC.dialog = null; if (d && d.done) d.done(); }

// ---------------------------------------------------------------- prep: party + bag
function prepDraw() {
  const W = VIEW.w, H = VIEW.h; const P = SC.data; const ch = P.chapter; rect(0, 0, W, H, '#0e0c10'); if (!P.bd) P.bd = makeBackdrop(ch.map); drawBackdrop(P.bd, (W - P.bd.canvas.width) / 2, (H - P.bd.canvas.height) / 2, .75);
  SC.hits = [];
  const narrow = narrowView(), bh = btnH(); const foot = narrow ? 2 * (bh + 4) + 12 : 30;
  screenTitle((ch.num ? 'CHAPTER ' + ch.num + ' · ' : '') + ch.title.toUpperCase(), narrow ? 'Deploy up to ' + ch.slots : objectiveTextFor(ch.map.objective) + ' · deploy up to ' + ch.slots, 4);
  // party grid (left)
  const cols = narrow ? 1 : W < 420 ? 2 : 3; const cw = narrow ? W - 12 : 118, chh = 30; const gx = 6, gy = 38; const rowsVisible = Math.floor((H - gy - foot) / (chh + 3));
  const party = P.party; const total = Math.ceil(party.length / cols); SC.scroll = clamp(SC.scroll, 0, Math.max(0, total - rowsVisible));
  ctx.save(); ctx.beginPath(); ctx.rect(0, gy - 2, cols * (cw + 4) + 8, rowsVisible * (chh + 3) + 2); ctx.clip();
  party.forEach((p, i) => {
    const r = Math.floor(i / cols) - SC.scroll, c = i % cols; if (r < 0 || r >= rowsVisible) return; const x = gx + c * (cw + 4), y = gy + r * (chh + 3); const slot = P.deploy.indexOf(i); const on = slot >= 0; const hot = SC.i === i;
    panel(x, y, cw, chh, { fill: on ? '#24406a' : UI.panel, border: hot ? UI.gold : on ? '#8fb4ff' : UI.border2, flat: true });
    const u = restoreUnit(p); ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 3, 30, chh - 6); ctx.clip(); rect(x + 3, y + 3, 30, chh - 6, on ? '#1c3a8a' : '#101a30'); drawMon(u.num, x + 18, y + chh - 3 + (on ? Math.round(Math.sin(SC.t * 6 + i) * 1) : 0), { sy: 1 }); ctx.restore();
    text(u.name.slice(0, 12), x + 36, y + 4, UI.ink); textR('Lv' + u.level, x + cw - 4, y + 4, UI.gold); u.types.forEach((t, j) => typeBadge(t, x + 36 + j * 26, y + 13, 24)); hpBar(x + 36, y + 24, cw - 42, u.hp, u.maxHp);
    if (on) { rrect(x + cw - 14, y + 12, 11, 9, UI.gold, 1); textC(i === prepCaptain(P) ? 'C' : String(slot + 1), x + cw - 9, y + 13, '#3a2000'); }
    hit(x, y, cw, chh, () => { SC.i = i; toggleDeploy(P, i); });
  });
  ctx.restore();
  if (total > rowsVisible) { textC('▲▼ scroll', gx + cols * (cw + 4) / 2, gy + rowsVisible * (chh + 3), UI.muted); }
  // right column: bag + start
  const rx = Math.min(W - 128, gx + cols * (cw + 4) + 6), ry = gy; const rw = W - rx - 6; if (rx > gx + 200) {
    panel(rx, ry, rw, 62, { title: 'BAG' }); let i = 0; for (const k in P.bag) { if (P.bag[k] <= 0) continue; const y = ry + 6 + i * 10; drawBall(rx + 9, y + 4, ITEMS[k].col, 3); text(ITEMS[k].name, rx + 16, y + 1, UI.ink); textR('×' + P.bag[k], rx + rw - 5, y + 1, UI.gold); i++; if (i >= 5) break; }
    if (!i) text('empty', rx + 8, ry + 8, UI.muted);
  }
  const sel = party[SC.i]; if (sel && rx > gx + 200) { const u = restoreUnit(sel); panel(rx, ry + 68, rw, 48, { title: u.name.toUpperCase() }); const st = [['ATK', u.atk], ['DEF', u.def], ['SPA', u.spa], ['SPD', u.spd], ['SPE', u.spe], ['MOV', u.mov]]; st.forEach((s, j) => { const sx = rx + 6 + (j % 3) * 38, sy = ry + 74 + Math.floor(j / 3) * 10; text(s[0], sx, sy, UI.muted); textR(String(s[1]), sx + 34, sy, UI.ink); }); text(fitLabel(u.moves.map(m => m.name).join(', '), rw - 12), rx + 6, ry + 96, '#98d8f8'); const ev = u.dex.evos.length ? 'Evolves Lv' + Math.min(...u.dex.evos.map(e => e[1])) : 'Final form'; let rl = ROLES[u.role].name + ' · ' + ev; while (textWidth(rl) > rw - 12 && rl.length > 6) rl = rl.slice(0, -1); text(rl, rx + 6, ry + 106, UI.green); }
  // battlefield preview under the stats: deploy slots, every foe (and the boss) where it starts, the seize target
  if (rx > gx + 200) { const py = ry + 122, avail = H - foot - py - 4; const bd = P.bd; const sc = Math.min((rw - 12) / bd.canvas.width, (avail - 27) / bd.canvas.height);
    if (sc >= .22) { const pw2 = Math.round(bd.canvas.width * sc), ph2 = Math.round(bd.canvas.height * sc); const foes = (ch.map.units || []).filter(u => u.team == null || u.team === 1), wild = (ch.map.units || []).filter(u => u.team === 2); const lv = foes.map(u => u.level);
      const p = panel(rx, py, rw, ph2 + 27, { header: fitLabel(foes.length + ' foes' + (wild.length ? ' · ' + wild.length + ' wild' : '') + (lv.length ? ' · Lv' + Math.min(...lv) : ''), rw - 16) });
      const px0 = rx + Math.round((rw - pw2) / 2), py0 = p.cy; ctx.drawImage(bd.canvas, px0, py0, pw2, ph2); outline(px0 - 1, py0 - 1, pw2 + 2, ph2 + 2, UI.border2);
      for (const d of bd.map.deploy) { const X = px0 + d.x * TILE * sc, Y = py0 + d.y * TILE * sc; rect(X, Y, Math.ceil(TILE * sc), Math.ceil(TILE * sc), '#3d7dff70'); outline(X, Y, Math.ceil(TILE * sc), Math.ceil(TILE * sc), teamColor(0)); }
      if (bd.map.seize) { const X = px0 + bd.map.seize.x * TILE * sc, Y = py0 + bd.map.seize.y * TILE * sc; outline(X, Y, Math.ceil(TILE * sc), Math.ceil(TILE * sc), UI.gold); }
      for (const u of ch.map.units || []) { const team = u.team == null ? 1 : u.team; const ux = px0 + (u.x + .5) * TILE * sc, uy = py0 + (u.y + 1) * TILE * sc; ellipse(ux, uy, 5, 2, teamColor(team)); ctx.drawImage(monIcon(u.mon, true), Math.round(ux - 8), Math.round(uy - 13), 16, 12); if (u.boss) drawSkull(Math.round(ux - 2), Math.round(uy - 19)); }
    } }
  const start = () => { if (!P.deploy.length) { Audio.sfx('error'); return; } Audio.sfx('select'); P.start(); }, auto = () => { Audio.sfx('ok'); autoDeploy(P); }, back = () => { Audio.sfx('cancel'); goScene('title'); };
  if (narrow) { footerBand(foot); const r1 = H - 2 * (bh + 4), r2 = H - bh - 4; text('Deployed ' + P.deploy.length + '/' + ch.slots + ' · C: captain locked', 6, r1 - 10, UI.muted);
    bigButton(6, r1, 60, bh, 'BACK', back, { variant: 'ghost' }); bigButton(72, r1, W - 78, bh, 'AUTO PICK', auto); bigButton(6, r2, W - 12, bh, 'START', start, P.deploy.length ? { variant: 'primary' } : { disabled: true }); return; }
  const by = footerBand(28) + 5; bigButton(W - 96, by, 90, 18, 'START', start, P.deploy.length ? { variant: 'primary' } : { disabled: true });
  bigButton(W - 190, by, 88, 18, 'AUTO PICK', auto);
  bigButton(6, by, 70, 18, 'BACK', back, { variant: 'ghost' });
  text(fitLabel(P.deploy.length + '/' + ch.slots + ' · ' + (prepCaptain(P) == null ? 'Z: toggle' : 'C locked · Z: toggle'), W - 278), 82, by + 5, UI.muted);
}
function toggleDeploy(P, i) { if (i === prepCaptain(P)) { Audio.sfx('error'); return; } const k = P.deploy.indexOf(i); if (k >= 0) { P.deploy.splice(k, 1); Audio.sfx('cancel'); } else if (P.deploy.length < P.chapter.slots) { P.deploy.push(i); Audio.sfx('ok'); } else Audio.sfx('error'); }
function autoDeploy(P) {
  const captain = prepCaptain(P), idx = P.party.map((p, i) => i).filter(i => i !== captain).sort((a, b) => P.party[b].level - P.party[a].level);
  P.deploy = (captain == null ? idx : [captain].concat(idx)).slice(0, P.chapter.slots);
}

function prepInput(ev) {
  const P = SC.data; const cols = narrowView() ? 1 : VIEW.w < 420 ? 2 : 3;
  if (ev.type === 'key') { if (ev.key === 'left') SC.i = Math.max(0, SC.i - 1); else if (ev.key === 'right') SC.i = Math.min(P.party.length - 1, SC.i + 1); else if (ev.key === 'up') SC.i = Math.max(0, SC.i - cols); else if (ev.key === 'down') SC.i = Math.min(P.party.length - 1, SC.i + cols); else if (ev.key === 'ok') toggleDeploy(P, SC.i); else if (ev.key === 'next') { if (P.deploy.length) P.start(); } else if (ev.key === 'back') goScene('title'); else if (ev.key === 'mute') Audio.toggle(); if (['left', 'right', 'up', 'down'].includes(ev.key)) { Audio.sfx('cursor'); const r = Math.floor(SC.i / cols); if (r < SC.scroll) SC.scroll = r; const rowsVisible = Math.floor((VIEW.h - 38 - (narrowView() ? 2 * (btnH() + 4) + 12 : 30)) / 33); if (r >= SC.scroll + rowsVisible) SC.scroll = r - rowsVisible + 1; } return; }
  if (ev.type === 'wheel') { SC.scroll += ev.dy > 0 ? 1 : -1; return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- results
function resultsDraw() {
  const W = VIEW.w, H = VIEW.h; const R = SC.data; rect(0, 0, W, H, '#0e0c10'); if (BACKDROP) drawBackdrop(BACKDROP, -((SC.t * 6) % 200), 0, .7);
  SC.hits = []; const win = R.win; const w = Math.min(300, W - 12), x = W / 2 - w / 2; let y = 10;
  if (R.versus) {
    const t = R.result === 'p1' ? 0 : R.result === 'p2' ? 1 : -1; const ph2 = 128; y = Math.max(10, H / 2 - ph2 / 2 - 16);
    panel(x, y, w, ph2, { title: t < 0 ? 'DRAW' : 'PLAYER ' + (t + 1) + ' WINS!', fill: t === 0 ? '#17264a' : t === 1 ? '#3a1a22' : UI.panel, border: t >= 0 ? teamColor(t) : UI.border });
    if (t >= 0) { ctx.save(); ctx.translate(x + w / 2, y + 10); ctx.scale(2, 2); bigC('PLAYER ' + (t + 1), 0, 0, teamColorL(t), { outline: '#000' }); ctx.restore(); bigC('WINS THE ARENA!', x + w / 2, y + 30, UI.gold, { outline: '#3a2000' }); } else bigC('NOBODY IS LEFT STANDING', x + w / 2, y + 16, UI.muted, { outline: UI.shadow });
    const tl = 'Turns ' + R.turns + '   ·   KOs ' + R.kills; text(tl, x + 8, y + 44, UI.ink); if (R.reason && textWidth(R.reason) <= w - 24 - textWidth(tl)) textR(R.reason, x + w - 8, y + 44, UI.muted); // the end screen already said it in full
    [0, 1].forEach(tm => { const yy = y + 58 + tm * 32; rrect(x + 6, yy, w - 12, 28, teamColorD(tm), 1); text('P' + (tm + 1), x + 10, yy + 3, teamColorL(tm)); R.rosters[tm].forEach((n, i) => { const cx = x + 40 + i * 34; const alive = R.teams[tm].includes(n); if (!alive) ctx.globalAlpha = .3; drawMon(n, cx, yy + 27, { flip: tm === 1 }); ctx.globalAlpha = 1; if (!alive) text('KO', cx - 5, yy + 4, UI.red, { shadow: '#000' }); }); textR(R.teams[tm].length + ' left', x + w - 10, yy + 3, UI.ink); });
    const bh = btnH();
    if (W < 280) { footerBand(2 * (bh + 4) + 4); bigButton(6, H - 2 * (bh + 4), (W - 16) / 2, bh, 'REMATCH', () => { Audio.sfx('select'); R.rematch(); }, { variant: 'danger' }); bigButton(10 + (W - 16) / 2, H - 2 * (bh + 4), (W - 16) / 2, bh, 'NEW TEAMS', () => { Audio.sfx('ok'); R.setup(); }); bigButton(6, H - bh - 4, W - 12, bh, 'TITLE', () => { Audio.sfx('cancel'); R.next(); }, { variant: 'ghost' }); return; }
    const fy = footerBand(30) + 6; bigButton(W / 2 - 132, fy, 80, 18, 'REMATCH', () => { Audio.sfx('select'); R.rematch(); }, { variant: 'danger' });
    bigButton(W / 2 - 44, fy, 88, 18, 'NEW TEAMS', () => { Audio.sfx('ok'); R.setup(); });
    bigButton(W / 2 + 52, fy, 80, 18, 'TITLE', () => { Audio.sfx('cancel'); R.next(); }, { variant: 'ghost' });
    return;
  }
  const rc = Math.max(1, Math.floor((w - 16) / 96)), cc = Math.max(1, Math.floor((w - 16) / 70)); // rewards / catches per row
  const nRew = R.rewards ? Object.keys(R.rewards).length : 0, nC = R.caught ? R.caught.length : 0, nT = R.trained ? Math.min(6, R.trained.length) : 0, nE = R.evolved ? R.evolved.length : 0;
  const lose = wrap('The team limps back to the Poké Center. Everyone is fine. Mostly.', w - 16);
  const ph = 36 + (win ? 0 : (lose.length - 1) * 9) + (nRew ? 14 + Math.ceil(nRew / rc) * 10 : 0) + (nC ? 14 + Math.ceil(nC / cc) * 26 : 0) + (nT ? 12 + nT * 9 : 0) + nE * 9 + 8;
  const phh = Math.min(H - 44, Math.max(60, ph)); y = Math.max(8, Math.round((H - 30 - phh) / 2));
  const p = panel(x, y, w, phh, { header: win ? (R.skirmish ? 'SKIRMISH WON' : 'CHAPTER CLEAR') : 'RETREAT', headerRight: win && R.par && R.turns <= R.par ? '★ UNDER PAR' : null, headerRightCol: UI.gold });
  y = p.cy; if (win) { text('Turns ' + R.turns + (R.par ? ' (par ' + R.par + ')' : '') + '   ·   KOs ' + R.kills, x + 8, y, UI.ink); y += 12; }
  else { lose.forEach(l => { text(l, x + 8, y, UI.ink); y += 9; }); y += 3; }
  if (R.rewards && Object.keys(R.rewards).length) { sectionLabel('Rewards', x + 8, y, w - 16, UI.gold); y += 10; let i = 0; for (const k in R.rewards) { const cx = x + 10 + (i % rc) * 96; const cy = y + Math.floor(i / rc) * 10; drawBall(cx + 4, cy + 4, ITEMS[k].col, 3); text(ITEMS[k].name + ' ×' + R.rewards[k], cx + 12, cy + 1, UI.ink); i++; } y += Math.ceil(i / rc) * 10 + 4; }
  if (R.caught && R.caught.length) { sectionLabel('New team members', x + 8, y, w - 16, UI.gold); y += 10; R.caught.forEach((c, i) => { const cx = x + 10 + (i % cc) * 70; const cy = y + Math.floor(i / cc) * 26; drawMon(c.num, cx + 16, cy + 22 + Math.round(Math.sin(SC.t * 6 + i) * 2), {}); text(DEX[c.num].name, cx + 32, cy + 6, UI.ink); text('Lv' + c.level, cx + 32, cy + 14, UI.gold); }); y += Math.ceil(R.caught.length / cc) * 26 + 4; }
  if (R.trained && R.trained.length) { sectionLabel('Training at the Center', x + 8, y, w - 16, UI.gold); y += 10; R.trained.forEach((t, i) => { if (i > 5) return; let s = t; while (textWidth(s) > w - 20 && s.length > 8) s = s.slice(0, -1); text(s, x + 10, y, '#98d8f8'); y += 9; }); y += 2; }
  if (R.evolved && R.evolved.length) { R.evolved.forEach(e => { let s = e; while (textWidth(s) > w - 20 && s.length > 8) s = s.slice(0, -1); text(s, x + 10, y, UI.gold); y += 9; }); }
  { const fy = footerBand(30) + 6; bigButton(W / 2 - 50, fy, 100, 18, R.nextLabel || 'CONTINUE', () => { Audio.sfx('ok'); R.next(); }, { variant: 'primary' }); }
}
function resultsInput(ev) { if (ev.type === 'key' && (ev.key === 'ok' || ev.key === 'back')) { Audio.sfx('ok'); SC.data.next(); return; } if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); } }

// ---------------------------------------------------------------- credits
function creditsDraw() {
  const W = VIEW.w, H = VIEW.h; rect(0, 0, W, H, '#0e0c10'); if (BACKDROP) drawBackdrop(BACKDROP, -((SC.t * 6) % 200), 0, .8);
  const lines = ['POKÉTAKTIKS', '', 'You beat the campaign!', '', 'Every Pokémon on your team', 'says thank you.', '', 'Skirmish mode is waiting on the title screen', 'with fresh random maps.', '', 'Sprites: Pokémon Showdown mini icons', 'Pokémon © Nintendo / Game Freak', 'Made with pixels and WebAudio', '', 'THE END'];
  const y0 = H - SC.t * 18; lines.forEach((l, i) => { const y = y0 + i * 16; if (y < -10 || y > H) return; if (l === 'POKÉTAKTIKS' || l === 'THE END') bigC(l, W / 2, y, UI.gold, { outline: '#3a2000' }); else textC(l, W / 2, y, UI.ink, { outline: UI.shadow }); });
  const party = SC.data.party || []; party.slice(0, 10).forEach((p, i) => { const x = ((SC.t * 20 + i * 44) % (W + 60)) - 30; drawMon(p.num, x, H - 8 + Math.round(Math.sin(SC.t * 8 + i) * 2), {}); });
  if (y0 + lines.length * 16 < H / 2 || SC.t > 4 && SC.skip) { goScene('title'); }
  if (Math.random() < .3) spawnParts(vrnd() * W, -4, 1, ['#ffd24a', '#5ee06a', '#3d7dff', '#ff5a5a', '#ffffff'], { speed: 5, vy: 30, life: 4, grav: 10, size: 3 }); updateFX(1 / 60); drawFX(0, 0);
}
function creditsInput(ev) { if (ev.type === 'up' || ev.type === 'key') SC.skip = true; }

// ---------------------------------------------------------------- skirmish setup
function skirmishDraw() {
  const W = VIEW.w, H = VIEW.h; const S = SC.data; rect(0, 0, W, H, '#0e0c10'); if (!S.bd || S.bdSeed !== S.seed) { S.map = skirmishMap(S.seed, 16, 11, S.level); S.bd = makeBackdrop(S.map); S.bdSeed = S.seed; }
  drawBackdrop(S.bd, (W - S.bd.canvas.width) / 2 + 40, (H - S.bd.canvas.height) / 2 + 30, .82); drawCloudShadows(SC.t);
  const narrow = narrowView(), bh = btnH(), sbh = narrow ? 16 : 13;
  SC.hits = []; screenTitle('SKIRMISH', narrow ? S.map.name : S.map.name + '  ·  random map, wild Pokémon to catch, a Rival to beat', 4);
  const sc = Math.max(.25, Math.min(1, Math.floor(Math.min((W - 20) / S.bd.canvas.width, (H - (narrow ? 156 : 116)) / S.bd.canvas.height) * 4) / 4)); const pw = S.bd.canvas.width * sc, ph = S.bd.canvas.height * sc; const px0 = W / 2 - pw / 2, py0 = 36; rrect(px0 - 4, py0 - 4, pw + 8, ph + 8, '#0b1020', 2); ctx.drawImage(S.bd.canvas, px0, py0, pw, ph); outline(px0 - 1, py0 - 1, pw + 2, ph + 2, UI.border); outline(px0 - 3, py0 - 3, pw + 6, ph + 6, UI.border2);
  for (const u of S.map.units) { const d = DEX[u.mon]; const ux = px0 + (u.x + .5) * TILE * sc, uy = py0 + (u.y + 1) * TILE * sc; ellipse(ux, uy, 6, 2, teamColor(u.team == null ? 1 : u.team)); ctx.drawImage(monIcon(d.num, true), Math.round(ux - 10), Math.round(uy - 15), 20, 15); }
  for (const d of S.map.deploy) { const ux = px0 + d.x * TILE * sc, uy = py0 + d.y * TILE * sc; outline(ux, uy, TILE * sc, TILE * sc, teamColor(0)); }
  const by = py0 + ph + 10; const setting = (x, y, label, val, dec, inc) => { text(label, x, y + (sbh - 7) / 2, UI.muted, { outline: UI.shadow }); bigButton(x + 58, y, 18, sbh, '-', dec, { small: true }); textC(String(val), x + 88, y + (sbh - 7) / 2, UI.gold, { outline: UI.shadow }); bigButton(x + 100, y, 18, sbh, '+', inc, { small: true }); };
  setting(10, by, 'Map seed', S.seed, () => { S.seed = (S.seed + 999) % 1000; Audio.sfx('menu'); }, () => { S.seed = (S.seed + 1) % 1000; Audio.sfx('menu'); });
  setting(10, by + sbh + 5, 'Enemy level', S.level, () => { S.level = Math.max(3, S.level - 2); Audio.sfx('menu'); }, () => { S.level = Math.min(48, S.level + 2); Audio.sfx('menu'); });
  const px1 = narrow ? 10 : 150, py1 = narrow ? by + 2 * (sbh + 5) + 2 : by; text('Party: ' + S.party.length + ' Pokémon' + (S.preset ? ' (loaner team)' : ' (campaign save)'), px1, py1 + 4, UI.ink, { outline: UI.shadow }); if (S.party.length) S.party.slice(0, 8).forEach((p, i) => { ctx.drawImage(monIcon(p.num), Math.round(px1 + i * 22), py1 + 12, 24, 18); });
  { const fy = footerBand(bh + 12) + 6; bigButton(W - 96, fy, 90, bh, 'PREPARE', () => { Audio.sfx('select'); S.go(); }, { variant: 'primary' }); bigButton(6, fy, 70, bh, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { variant: 'ghost' }); if (!narrow) hintLine([['◂▸', 'seed'], ['▲▼', 'level'], ['Z', 'prepare']], W / 2, fy + (bh - 7) / 2, { pill: false }); }
}
function skirmishInput(ev) { const S = SC.data; if (ev.type === 'key') { if (ev.key === 'left') S.seed = (S.seed + 999) % 1000; else if (ev.key === 'right') S.seed = (S.seed + 1) % 1000; else if (ev.key === 'up') S.level = Math.min(48, S.level + 2); else if (ev.key === 'down') S.level = Math.max(3, S.level - 2); else if (ev.key === 'ok') S.go(); else if (ev.key === 'back') goScene('title'); return; } if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); } }
