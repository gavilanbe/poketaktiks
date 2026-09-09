// ============================================================================
// scenes.js — title, starter pick, chapter card, story dialogue, prep (party &
// bag), results, credits. The battle scene lives in battle.js.
// ============================================================================
'use strict';
const SC = { name: 'loading', t: 0, i: 0, hits: [], dialog: null, data: null };
function goScene(name, data) { SC.name = name; SC.t = 0; SC.i = 0; SC.hits = []; SC.data = data || null; SC.scroll = 0; if (name === 'title') { Audio.playMusic('title'); } }
function hit(x, y, w, h, run, label) { SC.hits.push({ x, y, w, h, run, label }); }
function hitAt(px2, py) { for (const h of SC.hits) if (px2 >= h.x && py >= h.y && px2 < h.x + h.w && py < h.y + h.h) return h; return null; }
function bigButton(x, y, w, h, label, run, opt = {}) {
  const hot = (INPUT.x >= x && INPUT.y >= y && INPUT.x < x + w && INPUT.y < y + h && !VIEW.touch) || opt.hot; const col = opt.col || UI.panel2; const base = hot ? shade(col, .25) : col;
  rrect(x + 1, y + 2, w, h, UI.shadow, 2); rrect(x, y, w, h, hot ? UI.gold : UI.border, 2); rrect(x + 1, y + 1, w - 2, h - 2, base, 1);
  hline(x + 2, y + 1, w - 4, shade(base, .3)); hline(x + 2, y + h - 2, w - 4, shade(base, -.35)); vline(x + 1, y + 2, h - 4, shade(base, .12));
  if (hot && !opt.small) pointerHand(x - 10, y + h / 2 - 3, SC.t * 1000);
  if (opt.small) textC(label, x + w / 2, y + (h - 7) / 2, opt.ink || UI.ink, { shadow: UI.shadow }); else bigC(label, x + w / 2, y + (h - 9) / 2, opt.ink || UI.ink, { outline: UI.shadow });
  hit(x, y, w, h, run, label); }

// ---------------------------------------------------------------- shared: draw a map definition as a backdrop
let BACKDROP = null;
function makeBackdrop(mapDef) { const m = parseMap(mapDef); const c = document.createElement('canvas'); c.width = m.w * TILE; c.height = m.h * TILE; const g = c.getContext('2d'); for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) drawTerrain(g, m, x, y, x * TILE, y * TILE, 0); return { canvas: c, map: m }; }
function drawBackdrop(bd, ox, oy, dim = .45) { const bw = bd.canvas.width, bh = bd.canvas.height; for (let y = Math.round(oy) % bh - (Math.round(oy) % bh > 0 ? bh : 0); y < VIEW.h; y += bh) for (let x = Math.round(ox) % bw - (Math.round(ox) % bw > 0 ? bw : 0); x < VIEW.w; x += bw) ctx.drawImage(bd.canvas, x, y); if (dim > 0) { ctx.globalAlpha = dim; rect(0, 0, VIEW.w, VIEW.h, '#080a14'); ctx.globalAlpha = 1; } }

// ---------------------------------------------------------------- title
const TITLE_MONS = [25, 4, 7, 1, 133, 39, 54, 143, 94, 6, 130, 150];
const CLOUDS = [{ x: 40, y: 22, r: 36 }, { x: 260, y: 150, r: 48 }, { x: 420, y: 70, r: 30 }, { x: 150, y: 230, r: 42 }, { x: 330, y: 10, r: 26 }];
function drawCloudShadows(t) { ctx.globalAlpha = .14; for (const c of CLOUDS) { const x = ((c.x + t * 9) % (VIEW.w + 140)) - 70, y = c.y; ellipse(x, y, c.r, Math.round(c.r * .42), '#000'); ellipse(x - Math.round(c.r * .5), y + 4, Math.round(c.r * .6), Math.round(c.r * .28), '#000'); ellipse(x + Math.round(c.r * .5), y + 3, Math.round(c.r * .55), Math.round(c.r * .26), '#000'); } ctx.globalAlpha = 1; }
// Chunky three-layer logo: long shadow, outline, fill and a top highlight, drawn with the big pixel font scaled up.
function drawLogo(cx, y, t) {
  const s = 3; const layer = (str, x, yy, fill, hi, out, sh) => {
    ctx.save(); ctx.translate(x, yy); ctx.scale(s, s); for (let k = 3; k >= 1; k--) bigC(str, k, k, sh, {}); bigC(str, 0, 0, fill, { outline: out }); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x - 200, yy, 400, 3 * s); ctx.clip(); ctx.translate(x, yy); ctx.scale(s, s); bigC(str, 0, 0, hi, {}); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x - 200, yy + 3 * s, 400, 1 * s); ctx.clip(); ctx.translate(x, yy); ctx.scale(s, s); bigC(str, 0, 0, mix(fill, hi, .5), {}); ctx.restore();
  };
  const w1 = textWidth('POKÉ', BIG) * s, w2 = textWidth('TAKTIKS', BIG) * s;
  ctx.globalAlpha = .38; ellipse(cx, y + 30, Math.round(w2 / 2 + 30), 40, '#050a18'); ctx.globalAlpha = 1;
  // Poké Ball badge beside the first word
  ctx.save(); ctx.translate(cx - w1 / 2 - 22, y + 13 + Math.round(Math.sin(t * 2) * 1.5)); ctx.scale(3, 3); drawBall(0, 0, '#f04848', 5); ctx.restore();
  layer('POKÉ', cx + 10, y, UI.gold, '#fff3b0', '#4a2800', '#2a1600');
  layer('TAKTIKS', cx, y + 31, '#eef3ff', '#ffffff', '#1c2a4a', '#0b1020');
  rect(cx - w2 / 2, y + 31 + 9 * s + 4, w2, 2, UI.gold); rect(cx - w2 / 2 + 2, y + 31 + 9 * s + 6, w2 - 4, 1, '#4a2800');
  // twinkles
  for (let i = 0; i < 4; i++) { const ph = (t * 1.3 + i * .7) % 2; if (ph > 1) continue; const sz = Math.round(Math.sin(ph * Math.PI) * 3); const px0 = cx + [-w2 / 2 - 4, w2 / 2 + 6, -w1 / 2 + 30, w2 / 2 - 10][i], py0 = y + [12, 40, -6, 66][i]; rect(px0 - sz, py0, 2 * sz + 1, 1, '#ffffff'); rect(px0, py0 - sz, 1, 2 * sz + 1, '#ffffff'); }
  // subtitle ribbon
  const sub = 'A PIXEL TACTICS ADVENTURE  ·  GEN I'; const sw = textWidth(sub) + 16; const sy = y + 31 + 9 * s + 12;
  rrect(cx - sw / 2 + 1, sy + 1, sw, 12, UI.shadow, 1); rrect(cx - sw / 2, sy, sw, 12, '#182640', 1); outline(cx - sw / 2, sy, sw, 12, UI.border2); textC(sub, cx, sy + 2, UI.border);
}
// Menu card: icon box, big label, small hint; the hot one lifts, glows gold and gets the pointer hand.
function menuCard(x, y, w, h, label, sub, icon, hot, run, opt = {}) {
  const fill = hot ? '#2c4784' : (opt.fill || '#16223e'); const lift = hot ? 1 : 0; y -= lift;
  rrect(x + 2, y + 2 + lift, w, h, UI.shadow, 2); rrect(x, y, w, h, hot ? UI.gold : UI.border2, 2); rrect(x + 1, y + 1, w - 2, h - 2, fill, 1);
  hline(x + 2, y + 1, w - 4, shade(fill, .25)); hline(x + 2, y + h - 2, w - 4, shade(fill, -.3));
  rrect(x + 4, y + 4, h - 8, h - 8, hot ? '#1a2a50' : '#0f1830', 1); outline(x + 4, y + 4, h - 8, h - 8, hot ? UI.gold : '#3a4a70'); if (icon) iconAt(icon, x + 4 + (h - 8 - 9) / 2, y + 4 + (h - 8 - 9) / 2, hot ? '#ffffff' : '#d8dce8');
  bigText(label, x + h + 2, y + (h - 9) / 2 - (sub ? 3 : 0), hot ? '#ffffff' : UI.ink, { outline: hot ? '#1a2a50' : UI.shadow });
  if (sub) { let s = sub; const avail = w - h - 6; while (textWidth(s) > avail && s.length > 4) s = s.slice(0, -1); if (s !== sub) s = s.replace(/[ ·]+$/, '') + '…'; text(s, x + h + 2, y + h / 2 + 2, hot ? '#ffe9a0' : UI.muted); }
  if (hot) pointerHand(x - 11, y + h / 2 - 4, SC.t * 1000);
  hit(x, y + lift, w, h, run, label);
}
function titleDraw() {
  const W = VIEW.w, H = VIEW.h; if (!BACKDROP) BACKDROP = makeBackdrop(CHAPTERS[3].map);
  const ox = -((SC.t * 8) % (BACKDROP.canvas.width - W + 1)), oy = Math.min(0, (H - BACKDROP.canvas.height) / 2); drawBackdrop(BACKDROP, ox, oy, .3);
  drawCloudShadows(SC.t);
  // parade of mons walking along the road
  TITLE_MONS.forEach((n, i) => { const x = ((SC.t * 22 + i * 46) % (W + 60)) - 30, y = H * .8 + Math.round(Math.sin(SC.t * 8 + i) * 2); ellipse(x, y + 1, 10, 3, '#00000060'); drawMon(n, x, y, {}); });
  // top and bottom vignette bands so the UI sits on something calm
  ctx.globalAlpha = .45; rect(0, 0, W, 8, '#05070f'); rect(0, H - 22, W, 22, '#05070f'); ctx.globalAlpha = 1;
  const portrait = H > W, compact = !portrait && H < 260; const ly = (compact ? 4 : portrait ? Math.round(H * .17) : 22) + Math.round(Math.sin(SC.t * 2) * 1.5);
  if (compact) { ctx.save(); ctx.translate(W / 2, ly); ctx.scale(.65, .65); drawLogo(0, 0, SC.t); ctx.restore(); } else drawLogo(W / 2, ly, SC.t);
  SC.hits = []; const bw = Math.min(196, compact && W >= 320 ? (W - 24) / 2 : W - 40), bh = 22, gap = 4; const bx = W / 2 - bw / 2; let by = ly + 31 + 27 + 30;
  const save = loadSave(), susp = !!loadSuspend();
  const items = [];
  if (susp) items.push(['RESUME BATTLE', 'Pick up the suspended fight', 'play', () => resumeSuspend()]);
  if (save) items.push(['CONTINUE', save.beaten ? 'Campaign complete · replay' : 'Chapter ' + (Math.min(save.chapter, CHAPTERS.length - 1) + 1) + ' · ' + CHAPTERS[Math.min(save.chapter, CHAPTERS.length - 1)].title, 'flag', () => continueCampaign()]);
  items.push(['NEW GAME', 'Campaign · eight chapters', 'map', () => { if (save && !confirm('Start a new game? Your campaign save will be replaced.')) return; startNewGame(); }]);
  items.push(['SKIRMISH', 'Random maps · catch wild Pokémon', 'dice', () => startSkirmishSetup()]);
  items.push(['TERRITORY', 'Centers · income · reserves', 'flag', () => startTerritorySetup()]);
  items.push(['VERSUS', 'Two trainers · one device', 'vs', () => startVersusSetup()]);
  if (portrait) by = ly + 31 + 27 + 44; const total = items.length * (bh + gap); if (by + total > H - 26) by = Math.max(ly + 96, H - 26 - total);
  const cols = !portrait && W >= 320 && (compact || items.length > 4) ? 2 : 1; if (compact) by = 75; const firstY = by;
  items.forEach((it, i) => { const xx = cols === 2 ? W / 2 - bw - 4 + (i % 2) * (bw + 8) : bx; const yy = cols === 2 ? firstY + Math.floor(i / 2) * (bh + gap) : by; menuCard(xx, yy, bw, bh, it[0], it[1], it[2], SC.i === i, () => { Audio.sfx('ok'); it[3](); }); by += bh + gap; });
  SC.menuLen = items.length;
  text(Audio.muted ? '♪ off  (M)' : '♪ on  (M)', 6, H - 12, UI.muted); if (!narrowView()) textR('Sprites: Pokémon Showdown · PokeAPI', W - 6, H - 12, UI.muted);
  if (Math.floor(SC.t * 2) % 2) textC(VIEW.touch ? 'tap a card' : 'arrows + Z  ·  or click', W / 2, H - (narrowView() ? 24 : 12), UI.muted, { outline: UI.shadow });
}
function titleInput(ev) {
  if (ev.type === 'key') { if (ev.key === 'up') { SC.i = (SC.i - 1 + SC.menuLen) % SC.menuLen; Audio.sfx('menu'); } else if (ev.key === 'down') { SC.i = (SC.i + 1) % SC.menuLen; Audio.sfx('menu'); } else if (ev.key === 'ok') { const h = SC.hits[SC.i]; if (h) h.run(); } else if (ev.key === 'mute') Audio.toggle(); return; }
  if (ev.type === 'move' && !ev.touch) { const h = hitAt(ev.x, ev.y); if (h) { const i = SC.hits.indexOf(h); if (i >= 0 && i !== SC.i) { SC.i = i; Audio.sfx('menu'); } } return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- versus setup (draft two teams, pick an arena)
function vsPick(S, n) {
  const picks = S.teams[0].length + S.teams[1].length; if (picks >= S.size * 2) { Audio.sfx('error'); return; }
  if (S.teams[0].includes(n) || S.teams[1].includes(n)) { Audio.sfx('error'); return; }
  const t = S.order[picks]; S.teams[t].push(n); Audio.sfx(picks + 1 >= S.size * 2 ? 'select' : 'ok');
}
function vsUndo(S) { const picks = S.teams[0].length + S.teams[1].length; if (!picks) return false; S.teams[S.order[picks - 1]].pop(); Audio.sfx('cancel'); return true; }
function vsRandom(S) { const free = VS_ROSTER.filter(n => !S.teams[0].includes(n) && !S.teams[1].includes(n)); while (S.teams[0].length + S.teams[1].length < S.size * 2 && free.length) { const i = Math.floor(Math.random() * free.length); vsPick(S, free.splice(i, 1)[0]); } Audio.sfx('select'); }
function versusDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data; rect(0, 0, W, H, '#0e0c10');
  if (!S.bd || S.bdSeed !== S.seed || S.bdWild !== S.wild) { S.map = versusMap(S.seed, 18, 11, { wild: S.wild, level: S.level }); S.bd = makeBackdrop(S.map); S.bdSeed = S.seed; S.bdWild = S.wild; }
  drawBackdrop(S.bd, (W - S.bd.canvas.width) / 2, (H - S.bd.canvas.height) / 2, .8); SC.hits = [];
  const picks = S.teams[0].length + S.teams[1].length, full = picks >= S.size * 2; const cur = full ? -1 : S.order[picks]; S.cur = cur;
  bigC('VERSUS', W / 2, 4, UI.gold, { outline: '#3a2000' });
  textC(full ? 'Both teams are ready!' : 'PLAYER ' + (cur + 1) + ' picks  ·  ' + (picks + 1) + ' / ' + S.size * 2, W / 2, 16, full ? UI.green : cur === 0 ? '#8ab4ff' : '#ff9a9a', { outline: UI.shadow });
  const narrow = narrowView(); const bh = btnH(), sbh = narrow ? 16 : 13; let gy;
  if (narrow) { // phones: two compact team strips, no arena preview, a four-column roster
    const pw = Math.floor((W - 16) / 2), ph = 40, py = 28;
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
    const mw = p2x - (p1x + pw) - 12; const sc = Math.min(mw / S.bd.canvas.width, (ph - 4) / S.bd.canvas.height); const pwid = Math.round(S.bd.canvas.width * sc), phei = Math.round(S.bd.canvas.height * sc); const mx = Math.round(W / 2 - pwid / 2), my = py + Math.round((ph - phei) / 2);
    ctx.drawImage(S.bd.canvas, mx, my, pwid, phei); outline(mx - 1, my - 1, pwid + 2, phei + 2, UI.border); for (const d of S.map.deploy) rect(mx + d.x * TILE * sc, my + d.y * TILE * sc, Math.ceil(TILE * sc), Math.ceil(TILE * sc), '#3d7dff90'); for (const d of S.map.deploy2) rect(mx + d.x * TILE * sc, my + d.y * TILE * sc, Math.ceil(TILE * sc), Math.ceil(TILE * sc), '#ff4b4b90');
    gy = py + ph + 8;
  }
  // roster grid
  const cols = vsCols(), cw = 40, chh = 30; const rows = Math.ceil(VS_ROSTER.length / cols); const gx = Math.round(W / 2 - cols * cw / 2);
  rrect(gx - 3, gy - 3, cols * cw + 6, rows * chh + 6, '#0b1020c0', 2); outline(gx - 3, gy - 3, cols * cw + 6, rows * chh + 6, UI.border2);
  VS_ROSTER.forEach((n, i) => { const x = gx + (i % cols) * cw, y = gy + Math.floor(i / cols) * chh; const hot = SC.i === i; const t = S.teams[0].includes(n) ? 0 : S.teams[1].includes(n) ? 1 : -1;
    rrect(x + 1, y + 1, cw - 2, chh - 2, hot ? '#2c4784' : t >= 0 ? teamColorD(t) : '#141c30', 1); if (hot) outline(x + 1, y + 1, cw - 2, chh - 2, UI.gold);
    if (t >= 0) ctx.globalAlpha = .45; drawMon(n, x + cw / 2, y + chh - 2 + (hot ? Math.round(Math.sin(SC.t * 8)) : 0), {}); ctx.globalAlpha = 1;
    if (t >= 0) { rrect(x + cw - 13, y + 2, 11, 8, teamColor(t), 1); textC('P' + (t + 1), x + cw - 8, y + 2, '#ffffff'); }
    hit(x, y, cw, chh, () => { SC.i = i; vsPick(S, n); }); });
  const d = DEX[VS_ROSTER[SC.i]]; if (d) { const iy = gy + rows * chh + 5; const u = makeUnit(d.num, S.level, 0); text(d.name, gx, iy, UI.ink, { outline: UI.shadow }); d.types.forEach((tp, j) => typeBadge(tp, gx + textWidth(d.name) + 6 + j * 26, iy - 1, 24)); const mv = u.moves.slice(0, 3).map(m => m.name).join(' / '); const R = ROLES[u.role]; if (narrow) text(mv, gx, iy + 10, '#98d8f8', { outline: UI.shadow }); else { textR(mv, gx + cols * cw, iy, '#98d8f8', { outline: UI.shadow }); text('HP ' + u.maxHp + '  ATK ' + u.atk + '  DEF ' + u.def + '  SPA ' + u.spa + '  SPE ' + u.spe + '  MOV ' + u.mov, gx, iy + 10, UI.muted, { outline: UI.shadow }); const rx0 = gx + textWidth(d.name) + 6 + d.types.length * 26 + 4; let rs = R.name + ': ' + (u.skill ? u.skill.blurb.replace(/^[^:]+: /, '') : 'plain attacker'); while (textWidth(rs) > gx + cols * cw - textWidth(mv) - 8 - rx0 && rs.length > 8) rs = rs.slice(0, -1); text(rs, rx0, iy, R.col, { outline: UI.shadow }); } }
  // settings and the bottom row: one row each on wide screens, two rows each on phones
  // a setting is label, [-], value, [+]; on phones the two settings share one row at 84 px each so the [+] stays inside 180 px
  const sy = narrow ? H - 2 * (bh + 4) - sbh - 8 : H - 44; const o = narrow ? { m: 28, v: 55, p: 64 } : { m: 34, v: 64, p: 76 };
  const setting = (x, label, val, dec, inc) => { text(label, x, sy + (sbh - 7) / 2, UI.muted, { outline: UI.shadow }); bigButton(x + o.m, sy, 18, sbh, '-', dec, { small: true }); textC(String(val), x + o.v, sy + (sbh - 7) / 2, UI.gold, { outline: UI.shadow }); bigButton(x + o.p, sy, 18, sbh, '+', inc, { small: true }); };
  setting(6, 'Arena', S.seed, () => { S.seed = (S.seed + 999) % 1000; Audio.sfx('menu'); }, () => { S.seed = (S.seed + 1) % 1000; Audio.sfx('menu'); });
  setting(narrow ? Math.min(92, W - 88) : 112, 'Level', S.level, () => { S.level = Math.max(5, S.level - 5); Audio.sfx('menu'); }, () => { S.level = Math.min(50, S.level + 5); Audio.sfx('menu'); });
  const wildBtn = (x, y, w, h) => bigButton(x, y, w, h, S.wild ? 'WILD: ON' : 'WILD: OFF', () => { S.wild = !S.wild; Audio.sfx('menu'); }, { small: true, col: S.wild ? '#2a6a3a' : '#3a3a4a' });
  if (!narrow) { wildBtn(216, sy, 70, sbh); if (W > 470) text('Snake draft · click a picked slot to drop it', 296, sy + 4, UI.muted, { outline: UI.shadow }); }
  const go = () => { if (!full) { Audio.sfx('error'); return; } Audio.sfx('select'); S.go(); }; const goOpt = { col: full ? '#8a2c2c' : '#3a3a4a', ink: full ? '#ffffff' : UI.muted };
  if (narrow) { const r1 = H - 2 * (bh + 4), r2 = H - bh - 4, cw3 = Math.floor((W - 20) / 3);
    bigButton(6, r1, cw3, bh, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { col: '#5a4a30' }); bigButton(10 + cw3, r1, cw3, bh, 'RANDOM', () => vsRandom(S)); wildBtn(14 + 2 * cw3, r1, cw3, bh);
    bigButton(6, r2, cw3, bh, 'CLEAR', () => { S.teams = [[], []]; Audio.sfx('cancel'); }, { col: '#3a3a4a' }); bigButton(10 + cw3, r2, W - 16 - cw3, bh, 'BATTLE!', go, goOpt);
  } else { const by = H - 24;
    bigButton(6, by, 60, 18, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { col: '#5a4a30' }); bigButton(72, by, 70, 18, 'RANDOM', () => vsRandom(S)); bigButton(148, by, 60, 18, 'CLEAR', () => { S.teams = [[], []]; Audio.sfx('cancel'); }, { col: '#3a3a4a' }); bigButton(W - 96, by, 90, 18, 'BATTLE!', go, goOpt); }
}
function vsCols() { return VIEW.w < 300 ? 4 : VIEW.w < 330 ? 6 : 7; }
function versusInput(ev) {
  const S = SC.data; const cols = vsCols();
  if (ev.type === 'key') { const n = VS_ROSTER.length; if (ev.key === 'left') SC.i = (SC.i + n - 1) % n; else if (ev.key === 'right') SC.i = (SC.i + 1) % n; else if (ev.key === 'up') SC.i = (SC.i + n - cols) % n; else if (ev.key === 'down') SC.i = (SC.i + cols) % n; else if (ev.key === 'ok') vsPick(S, VS_ROSTER[SC.i]); else if (ev.key === 'back') { if (!vsUndo(S)) goScene('title'); } else if (ev.key === 'next') { if (S.teams[0].length + S.teams[1].length >= S.size * 2) S.go(); else vsRandom(S); } else if (ev.key === 'mute') Audio.toggle(); if (['left', 'right', 'up', 'down'].includes(ev.key)) Audio.sfx('cursor'); return; }
  if (ev.type === 'move' && !ev.touch) { const h = hitAt(ev.x, ev.y); if (h) { const i = VS_ROSTER.findIndex((n, j) => SC.hits.indexOf(h) >= 0 && h.run && h.label == null && false); } return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- starter pick
function starterDraw() {
  const W = VIEW.w, H = VIEW.h; drawBackdrop(BACKDROP, 0, 0, .6);
  const title = W < 200 ? 'YOUR PARTNER' : 'CHOOSE YOUR PARTNER'; bigC(title, W / 2, 14, UI.gold, { outline: '#3a2000' });
  const quote = wrap('Prof. Oak: "Take one. They are all good, I checked."', W - 12); quote.forEach((l, i) => textC(l, W / 2, 28 + i * 9, UI.ink, { outline: UI.shadow }));
  SC.hits = []; const cw = 96, gap = 10; const x0 = W / 2 - (cw * 3 + gap * 2) / 2; const top = 28 + quote.length * 9 + 7;
  if (W < cw * 3 + gap * 2 + 8) { // phones: three wide, short cards stacked down the screen; stats on two short rows
    const w = W - 12, h = Math.min(56, Math.floor((H - top - 26) / 3) - 6);
    STARTERS.forEach((n, i) => {
      const d = DEX[n]; const x = 6, y = top + i * (h + 6); const sel = SC.i === i; panel(x, y, w, h, { fill: sel ? '#2a3d6a' : UI.panel, border: sel ? UI.gold : UI.border });
      const bob = sel ? Math.round(Math.abs(Math.sin(SC.t * 6)) * -3) : 0; rect(x + 6, y + 6, 40, h - 12, teamColorD(0)); drawMon(n, x + 26, y + h - 8 + bob, {});
      const tx = x + 52, tw = w - 58; text(d.name, tx, y + 6, sel ? UI.gold : UI.ink); d.types.forEach((t, j) => typeBadge(t, tx + textWidth(d.name) + 6 + j * 26, y + 5, 24));
      const u = makeUnit(n, 5, 0, { hpBonus: BOND_HP }); const fit = s => { while (textWidth(s) > tw && s.length > 4) s = s.slice(0, -1); return s; };
      text(fit('HP ' + u.maxHp + ' · ATK ' + u.atk + ' · DEF ' + u.def), tx, y + 17, UI.muted); text(fit('SPA ' + u.spa + ' · SPD ' + u.spd + ' · SPE ' + u.spe + ' · MOV ' + u.mov), tx, y + 27, UI.muted);
      text(fit(u.moves.map(m => m.name).join(' / ')), tx, y + 37, '#98d8f8');
      if (h >= 54) text(sel ? (VIEW.touch ? 'tap again to choose' : 'Z to choose') : '', tx, y + 47, UI.gold);
      hit(x, y, w, h, () => { if (SC.i === i) { Audio.sfx('select'); pickStarter(n); } else { SC.i = i; Audio.sfx('cursor'); } });
    });
    textC(VIEW.touch ? 'tap twice to choose' : 'click / Z to choose', W / 2, H - 14, UI.muted, { outline: UI.shadow }); return;
  }
  STARTERS.forEach((n, i) => {
    const d = DEX[n]; const x = x0 + i * (cw + gap), y = 44, h = 150; const sel = SC.i === i; panel(x, y, cw, h, { fill: sel ? '#2a3d6a' : UI.panel, border: sel ? UI.gold : UI.border });
    const bob = sel ? Math.round(Math.abs(Math.sin(SC.t * 6)) * -4) : 0; rect(x + 8, y + 8, cw - 16, 36, teamColorD(0)); drawMon(n, x + cw / 2, y + 42 + bob, { sy: 1 + (sel ? Math.sin(SC.t * 8) * .05 : 0) });
    textC(d.name, x + cw / 2, y + 48, sel ? UI.gold : UI.ink); d.types.forEach((t, j) => typeBadge(t, x + cw / 2 - (d.types.length * 26) / 2 + j * 26 + 1, y + 58, 24));
    const u = makeUnit(n, 5, 0, { hpBonus: BOND_HP }); const st = [['HP', u.maxHp, 40], ['ATK', u.atk, 20], ['DEF', u.def, 20], ['SPA', u.spa, 20], ['SPD', u.spd, 20], ['SPE', u.spe, 20]];
    st.forEach((s, j) => { const sy = y + 70 + j * 9; text(s[0], x + 8, sy, UI.muted); bar(x + 30, sy + 1, cw - 40, 5, s[1] / s[2], sel ? UI.gold : UI.blue); });
    text('MOV ' + u.mov + ' · ' + u.moves.map(m => m.name).join('/'), x + 8, y + h - 10, UI.muted);
    hit(x, y, cw, h, () => { if (SC.i === i) { Audio.sfx('select'); pickStarter(n); } else { SC.i = i; Audio.sfx('cursor'); } });
  });
  textC(VIEW.touch ? 'tap twice to choose' : 'click / Z to choose', W / 2, H - 14, UI.muted, { outline: UI.shadow });
}
function starterInput(ev) {
  if (ev.type === 'key') { if (ev.key === 'left') { SC.i = (SC.i + 2) % 3; Audio.sfx('cursor'); } else if (ev.key === 'right') { SC.i = (SC.i + 1) % 3; Audio.sfx('cursor'); } else if (ev.key === 'ok') { Audio.sfx('select'); pickStarter(STARTERS[SC.i]); } else if (ev.key === 'back') goScene('title'); return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- chapter card
function cardDraw() { const W = VIEW.w, H = VIEW.h; const ch = SC.data.chapter; rect(0, 0, W, H, '#0e0c10'); const k = Math.min(1, SC.t / .5); const y = H / 2 - 20; const ts = textWidth(ch.title.toUpperCase(), BIG) * 2 > W - 8 ? 1 : 2; ctx.globalAlpha = k; hline(0, y - 6, W, UI.border2); hline(0, y + 30, W, UI.border2); bigC(ch.num ? 'CHAPTER ' + ch.num : 'SKIRMISH', W / 2, y, UI.muted, { outline: UI.shadow }); ctx.save(); ctx.translate(W / 2, y + 12 + (ts === 1 ? 4 : 0)); ctx.scale(ts, ts); bigC(ch.title, 0, 0, UI.gold, { outline: '#3a2000' }); ctx.restore(); ctx.globalAlpha = 1; wrap(objectiveTextFor(ch.map.objective), W - 12).forEach((l, i) => textC(l, W / 2, y + 40 + i * 9, UI.ink)); if (SC.t > 2.2 || (SC.t > .6 && SC.skip)) { SC.skip = false; SC.data.next(); } }
function objectiveTextFor(o) { switch (o.type) { case 'rout': return 'Objective: defeat all enemies'; case 'boss': return 'Objective: defeat ' + (o.bossName || 'the boss'); case 'survive': return 'Objective: survive ' + o.turns + ' turns'; case 'seize': return 'Objective: seize the ' + (o.what || 'gym'); case 'versus': return 'Objective: defeat the other trainer'; } return ''; }
function cardInput(ev) { if (ev.type === 'up' || (ev.type === 'key' && ev.key === 'ok')) SC.skip = true; }

// ---------------------------------------------------------------- story dialogue (drawn over the battle board)
function startDialog(lines, done) { SC.dialog = { lines, i: 0, chars: 0, t: 0, done }; goScene('story'); }
function storyUpdate(dt) { const d = SC.dialog; if (!d) return; d.t += dt; const line = d.lines[d.i]; const total = line.text.length; if (d.chars < total) { const before = d.chars; d.chars = Math.min(total, d.chars + dt * 45); if (Math.floor(d.chars) !== Math.floor(before) && Math.floor(d.chars) % 2 === 0) Audio.sfx('text'); } CAM.x += (CAM.tx - CAM.x) * Math.min(1, dt * 6); CAM.y += (CAM.ty - CAM.y) * Math.min(1, dt * 6); for (const u of B.units) { u.fx.sx += (1 - u.fx.sx) * dt * 10; u.fx.sy += (1 - u.fx.sy) * dt * 10; } updateFX(dt); Audio.tick(); BT.time += dt; }
function storyDraw() {
  battleDraw(); const d = SC.dialog; if (!d) return; const W = VIEW.w, H = VIEW.h; const line = d.lines[d.i];
  ctx.globalAlpha = .35; rect(0, 0, W, H, '#000'); ctx.globalAlpha = 1;
  const bh = 58, by = H - bh - 6, bx = 6, bw = W - 12; panel(bx, by, bw, bh, { fill: '#182640' });
  if (line.mon) { rect(bx + 6, by + 8, 44, 40, '#0e1628'); outline(bx + 6, by + 8, 44, 40, UI.border2); drawMon(line.mon, bx + 28, by + 46 + Math.round(Math.sin(d.t * 6) * (d.chars < line.text.length ? 1 : 0)), { flip: false }); }
  const tx = bx + (line.mon ? 58 : 10); rrect(tx - 2, by - 5, textWidth(line.who) + 10, 11, UI.gold, 1); text(line.who, tx + 3, by - 3, '#3a2000');
  const lines = wrap(line.text, bw - (line.mon ? 70 : 22)); let shown = Math.floor(d.chars); lines.forEach((l, i) => { if (shown <= 0) return; const s = l.slice(0, shown); shown -= l.length + 1; text(s, tx, by + 12 + i * 11, UI.ink); });
  if (d.chars >= line.text.length && Math.floor(d.t * 3) % 2) { const ax = bx + bw - 12, ay = by + bh - 9; rect(ax - 3, ay, 7, 1, UI.gold); rect(ax - 2, ay + 1, 5, 1, UI.gold); rect(ax - 1, ay + 2, 3, 1, UI.gold); px(ax, ay + 3, UI.gold); }
  textR((d.i + 1) + '/' + d.lines.length + '  · X: skip', bx + bw - 4, by - 3, UI.muted, { outline: UI.shadow });
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
  bigC((ch.num ? 'CHAPTER ' + ch.num + ' · ' : '') + ch.title.toUpperCase(), W / 2, 6, UI.gold, { outline: '#3a2000' }); textC(narrow ? 'Deploy up to ' + ch.slots : objectiveTextFor(ch.map.objective) + ' · deploy up to ' + ch.slots, W / 2, 18, UI.ink, { outline: UI.shadow });
  // party grid (left)
  const cols = narrow ? 1 : W < 420 ? 2 : 3; const cw = narrow ? W - 12 : 118, chh = 30; const gx = 6, gy = 30; const rowsVisible = Math.floor((H - gy - foot) / (chh + 3));
  const party = P.party; const total = Math.ceil(party.length / cols); SC.scroll = clamp(SC.scroll, 0, Math.max(0, total - rowsVisible));
  ctx.save(); ctx.beginPath(); ctx.rect(0, gy - 2, cols * (cw + 4) + 8, rowsVisible * (chh + 3) + 2); ctx.clip();
  party.forEach((p, i) => {
    const r = Math.floor(i / cols) - SC.scroll, c = i % cols; if (r < 0 || r >= rowsVisible) return; const x = gx + c * (cw + 4), y = gy + r * (chh + 3); const slot = P.deploy.indexOf(i); const on = slot >= 0; const hot = SC.i === i;
    panel(x, y, cw, chh, { fill: on ? '#24406a' : UI.panel, border: hot ? UI.gold : on ? '#8fb4ff' : UI.border2, flat: true });
    const u = restoreUnit(p); ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 3, 30, chh - 6); ctx.clip(); rect(x + 3, y + 3, 30, chh - 6, on ? '#1c3a8a' : '#101a30'); drawMon(u.num, x + 18, y + chh - 3 + (on ? Math.round(Math.sin(SC.t * 6 + i) * 1) : 0), { sy: 1 }); ctx.restore();
    text(u.name.slice(0, 12), x + 36, y + 4, UI.ink); textR('Lv' + u.level, x + cw - 4, y + 4, UI.gold); u.types.forEach((t, j) => typeBadge(t, x + 36 + j * 26, y + 13, 24)); hpBar(x + 36, y + 24, cw - 42, u.hp, u.maxHp);
    if (on) { rrect(x + cw - 14, y + 12, 11, 9, UI.gold, 1); textC(String(slot + 1), x + cw - 9, y + 13, '#3a2000'); }
    hit(x, y, cw, chh, () => { SC.i = i; toggleDeploy(P, i); });
  });
  ctx.restore();
  if (total > rowsVisible) { textC('▲▼ scroll', gx + cols * (cw + 4) / 2, gy + rowsVisible * (chh + 3), UI.muted); }
  // right column: bag + start
  const rx = Math.min(W - 128, gx + cols * (cw + 4) + 6), ry = gy; const rw = W - rx - 6; if (rx > gx + 200) {
    panel(rx, ry, rw, 62, { title: 'BAG' }); let i = 0; for (const k in P.bag) { if (P.bag[k] <= 0) continue; const y = ry + 6 + i * 10; drawBall(rx + 9, y + 4, ITEMS[k].col, 3); text(ITEMS[k].name, rx + 16, y + 1, UI.ink); textR('×' + P.bag[k], rx + rw - 5, y + 1, UI.gold); i++; if (i >= 5) break; }
    if (!i) text('empty', rx + 8, ry + 8, UI.muted);
  }
  const sel = party[SC.i]; if (sel && rx > gx + 200) { const u = restoreUnit(sel); panel(rx, ry + 68, rw, 48, { title: u.name.toUpperCase() }); const st = [['ATK', u.atk], ['DEF', u.def], ['SPA', u.spa], ['SPD', u.spd], ['SPE', u.spe], ['MOV', u.mov]]; st.forEach((s, j) => { const sx = rx + 6 + (j % 3) * 38, sy = ry + 74 + Math.floor(j / 3) * 10; text(s[0], sx, sy, UI.muted); textR(String(s[1]), sx + 34, sy, UI.ink); }); text(u.moves.map(m => m.name).join(', ').slice(0, 28), rx + 6, ry + 96, '#98d8f8'); const ev = u.dex.evos.length ? 'Evolves Lv' + Math.min(...u.dex.evos.map(e => e[1])) : 'Final form'; let rl = ROLES[u.role].name + ' · ' + ev; while (textWidth(rl) > rw - 12 && rl.length > 6) rl = rl.slice(0, -1); text(rl, rx + 6, ry + 106, UI.green); }
  const start = () => { if (!P.deploy.length) { Audio.sfx('error'); return; } Audio.sfx('select'); P.start(); }, auto = () => { Audio.sfx('ok'); autoDeploy(P); }, back = () => { Audio.sfx('cancel'); goScene('title'); };
  if (narrow) { const r1 = H - 2 * (bh + 4), r2 = H - bh - 4; text('Deployed ' + P.deploy.length + '/' + ch.slots + ' · tap a card · first leads', 6, r1 - 10, UI.muted, { outline: UI.shadow });
    bigButton(6, r1, 60, bh, 'BACK', back, { col: '#5a4a30' }); bigButton(72, r1, W - 78, bh, 'AUTO PICK', auto); bigButton(6, r2, W - 12, bh, 'START', start, { col: '#2a6a3a' }); return; }
  const by = H - 24; bigButton(W - 96, by, 90, 18, 'START', start, { col: '#2a6a3a' });
  bigButton(W - 190, by, 88, 18, 'AUTO PICK', auto);
  bigButton(6, by, 70, 18, 'BACK', back, { col: '#5a4a30' });
  text('Deployed ' + P.deploy.length + '/' + ch.slots + '  ·  click a card to toggle  ·  first slot leads', 82, by + 5, UI.muted, { outline: UI.shadow });
}
function toggleDeploy(P, i) { const k = P.deploy.indexOf(i); if (k >= 0) { P.deploy.splice(k, 1); Audio.sfx('cancel'); } else if (P.deploy.length < P.chapter.slots) { P.deploy.push(i); Audio.sfx('ok'); } else Audio.sfx('error'); }
function autoDeploy(P) { const idx = P.party.map((p, i) => i).sort((a, b) => P.party[b].level - P.party[a].level); P.deploy = idx.slice(0, P.chapter.slots); }
function prepInput(ev) {
  const P = SC.data; const cols = narrowView() ? 1 : VIEW.w < 420 ? 2 : 3;
  if (ev.type === 'key') { if (ev.key === 'left') SC.i = Math.max(0, SC.i - 1); else if (ev.key === 'right') SC.i = Math.min(P.party.length - 1, SC.i + 1); else if (ev.key === 'up') SC.i = Math.max(0, SC.i - cols); else if (ev.key === 'down') SC.i = Math.min(P.party.length - 1, SC.i + cols); else if (ev.key === 'ok') toggleDeploy(P, SC.i); else if (ev.key === 'next') { if (P.deploy.length) P.start(); } else if (ev.key === 'back') goScene('title'); else if (ev.key === 'mute') Audio.toggle(); if (['left', 'right', 'up', 'down'].includes(ev.key)) { Audio.sfx('cursor'); const r = Math.floor(SC.i / cols); if (r < SC.scroll) SC.scroll = r; const rowsVisible = Math.floor((VIEW.h - 30 - (narrowView() ? 2 * (btnH() + 4) + 12 : 30)) / 33); if (r >= SC.scroll + rowsVisible) SC.scroll = r - rowsVisible + 1; } return; }
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
    text('Turns ' + R.turns + '   ·   KOs ' + R.kills, x + 8, y + 44, UI.ink);
    [0, 1].forEach(tm => { const yy = y + 58 + tm * 32; rrect(x + 6, yy, w - 12, 28, teamColorD(tm), 1); text('P' + (tm + 1), x + 10, yy + 3, teamColorL(tm)); R.rosters[tm].forEach((n, i) => { const cx = x + 40 + i * 34; const alive = R.teams[tm].includes(n); if (!alive) ctx.globalAlpha = .3; drawMon(n, cx, yy + 27, { flip: tm === 1 }); ctx.globalAlpha = 1; if (!alive) text('KO', cx - 5, yy + 4, UI.red, { shadow: '#000' }); }); textR(R.teams[tm].length + ' left', x + w - 10, yy + 3, UI.ink); });
    const bh = btnH();
    if (W < 280) { bigButton(6, H - 2 * (bh + 4), (W - 16) / 2, bh, 'REMATCH', () => { Audio.sfx('select'); R.rematch(); }, { col: '#8a2c2c' }); bigButton(10 + (W - 16) / 2, H - 2 * (bh + 4), (W - 16) / 2, bh, 'NEW TEAMS', () => { Audio.sfx('ok'); R.setup(); }); bigButton(6, H - bh - 4, W - 12, bh, 'TITLE', () => { Audio.sfx('cancel'); R.next(); }, { col: '#5a4a30' }); return; }
    bigButton(W / 2 - 132, H - 28, 80, 18, 'REMATCH', () => { Audio.sfx('select'); R.rematch(); }, { col: '#8a2c2c' });
    bigButton(W / 2 - 44, H - 28, 88, 18, 'NEW TEAMS', () => { Audio.sfx('ok'); R.setup(); });
    bigButton(W / 2 + 52, H - 28, 80, 18, 'TITLE', () => { Audio.sfx('cancel'); R.next(); }, { col: '#5a4a30' });
    return;
  }
  const rc = Math.max(1, Math.floor((w - 16) / 96)), cc = Math.max(1, Math.floor((w - 16) / 70)); // rewards / catches per row
  const nRew = R.rewards ? Object.keys(R.rewards).length : 0, nC = R.caught ? R.caught.length : 0, nT = R.trained ? Math.min(6, R.trained.length) : 0, nE = R.evolved ? R.evolved.length : 0;
  const lose = wrap('The team limps back to the Poké Center. Everyone is fine. Mostly.', w - 16);
  const ph = 24 + (win ? 0 : (lose.length - 1) * 9) + (nRew ? 14 + Math.ceil(nRew / rc) * 10 : 0) + (nC ? 14 + Math.ceil(nC / cc) * 26 : 0) + (nT ? 12 + nT * 9 : 0) + nE * 9 + 8;
  panel(x, y, w, Math.min(H - 44, Math.max(60, ph)), { title: win ? (R.skirmish ? 'SKIRMISH WON' : 'CHAPTER CLEAR') : 'RETREAT' });
  y += 8; if (win) { text('Turns ' + R.turns + (R.par ? ' (par ' + R.par + ')' : '') + '   KOs ' + R.kills, x + 8, y, UI.ink); if (R.par && R.turns <= R.par) textR('★ UNDER PAR', x + w - 8, y, UI.gold); y += 12; }
  else { lose.forEach(l => { text(l, x + 8, y, UI.ink); y += 9; }); y += 3; }
  if (R.rewards && Object.keys(R.rewards).length) { text('Rewards', x + 8, y, UI.gold); y += 10; let i = 0; for (const k in R.rewards) { const cx = x + 10 + (i % rc) * 96; const cy = y + Math.floor(i / rc) * 10; drawBall(cx + 4, cy + 4, ITEMS[k].col, 3); text(ITEMS[k].name + ' ×' + R.rewards[k], cx + 12, cy + 1, UI.ink); i++; } y += Math.ceil(i / rc) * 10 + 4; }
  if (R.caught && R.caught.length) { text('New team members', x + 8, y, UI.gold); y += 10; R.caught.forEach((c, i) => { const cx = x + 10 + (i % cc) * 70; const cy = y + Math.floor(i / cc) * 26; drawMon(c.num, cx + 16, cy + 22 + Math.round(Math.sin(SC.t * 6 + i) * 2), {}); text(DEX[c.num].name, cx + 32, cy + 6, UI.ink); text('Lv' + c.level, cx + 32, cy + 14, UI.gold); }); y += Math.ceil(R.caught.length / cc) * 26 + 4; }
  if (R.trained && R.trained.length) { text('Training at the Center', x + 8, y, UI.gold); y += 10; R.trained.forEach((t, i) => { if (i > 5) return; let s = t; while (textWidth(s) > w - 20 && s.length > 8) s = s.slice(0, -1); text(s, x + 10, y, '#98d8f8'); y += 9; }); y += 2; }
  if (R.evolved && R.evolved.length) { R.evolved.forEach(e => { let s = e; while (textWidth(s) > w - 20 && s.length > 8) s = s.slice(0, -1); text(s, x + 10, y, UI.gold); y += 9; }); }
  bigButton(W / 2 - 50, H - 28, 100, btnH(), R.nextLabel || 'CONTINUE', () => { Audio.sfx('ok'); R.next(); }, { col: '#2a6a3a' });
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
  SC.hits = []; bigC('SKIRMISH', W / 2, 6, UI.gold, { outline: '#3a2000' }); textC(narrow ? S.map.name : S.map.name + '  ·  random map, wild Pokémon to catch, a Rival to beat', W / 2, 18, UI.muted, { outline: UI.shadow });
  const sc = Math.max(.25, Math.min(1, Math.floor(Math.min((W - 20) / S.bd.canvas.width, (H - (narrow ? 150 : 110)) / S.bd.canvas.height) * 4) / 4)); const pw = S.bd.canvas.width * sc, ph = S.bd.canvas.height * sc; const px0 = W / 2 - pw / 2, py0 = 30; rrect(px0 - 4, py0 - 4, pw + 8, ph + 8, '#0b1020', 2); ctx.drawImage(S.bd.canvas, px0, py0, pw, ph); outline(px0 - 1, py0 - 1, pw + 2, ph + 2, UI.border); outline(px0 - 3, py0 - 3, pw + 6, ph + 6, UI.border2);
  for (const u of S.map.units) { const d = DEX[u.mon]; const ux = px0 + (u.x + .5) * TILE * sc, uy = py0 + (u.y + 1) * TILE * sc; ellipse(ux, uy, 6, 2, teamColor(u.team == null ? 1 : u.team)); ctx.drawImage(monIcon(d.num, true), Math.round(ux - 10), Math.round(uy - 15), 20, 15); }
  for (const d of S.map.deploy) { const ux = px0 + d.x * TILE * sc, uy = py0 + d.y * TILE * sc; outline(ux, uy, TILE * sc, TILE * sc, teamColor(0)); }
  const by = py0 + ph + 10; const setting = (x, y, label, val, dec, inc) => { text(label, x, y + (sbh - 7) / 2, UI.muted, { outline: UI.shadow }); bigButton(x + 58, y, 18, sbh, '-', dec, { small: true }); textC(String(val), x + 88, y + (sbh - 7) / 2, UI.gold, { outline: UI.shadow }); bigButton(x + 100, y, 18, sbh, '+', inc, { small: true }); };
  setting(10, by, 'Map seed', S.seed, () => { S.seed = (S.seed + 999) % 1000; Audio.sfx('menu'); }, () => { S.seed = (S.seed + 1) % 1000; Audio.sfx('menu'); });
  setting(10, by + sbh + 5, 'Enemy level', S.level, () => { S.level = Math.max(3, S.level - 2); Audio.sfx('menu'); }, () => { S.level = Math.min(48, S.level + 2); Audio.sfx('menu'); });
  const px1 = narrow ? 10 : 150, py1 = narrow ? by + 2 * (sbh + 5) + 2 : by; text('Party: ' + S.party.length + ' Pokémon' + (S.preset ? ' (loaner team)' : ' (campaign save)'), px1, py1 + 4, UI.ink, { outline: UI.shadow }); if (S.party.length) S.party.slice(0, 8).forEach((p, i) => { ctx.drawImage(monIcon(p.num), Math.round(px1 + i * 22), py1 + 12, 24, 18); });
  bigButton(W - 96, H - bh - 6, 90, bh, 'PREPARE', () => { Audio.sfx('select'); S.go(); }, { col: '#2a6a3a' }); bigButton(6, H - bh - 6, 70, bh, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { col: '#5a4a30' });
}
function skirmishInput(ev) { const S = SC.data; if (ev.type === 'key') { if (ev.key === 'left') S.seed = (S.seed + 999) % 1000; else if (ev.key === 'right') S.seed = (S.seed + 1) % 1000; else if (ev.key === 'up') S.level = Math.min(48, S.level + 2); else if (ev.key === 'down') S.level = Math.max(3, S.level - 2); else if (ev.key === 'ok') S.go(); else if (ev.key === 'back') goScene('title'); return; } if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); } }
