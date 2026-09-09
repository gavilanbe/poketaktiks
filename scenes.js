// ============================================================================
// scenes.js — title, starter pick, chapter card, story dialogue, prep (party &
// bag), results, credits. The battle scene lives in battle.js.
// ============================================================================
'use strict';
const SC = { name: 'loading', t: 0, i: 0, hits: [], dialog: null, data: null };
function goScene(name, data) { SC.name = name; SC.t = 0; SC.i = 0; SC.hits = []; SC.data = data || null; SC.scroll = 0; if (name === 'title') { Audio.playMusic('title'); } }
function hit(x, y, w, h, run, label) { SC.hits.push({ x, y, w, h, run, label }); }
function hitAt(px2, py) { for (const h of SC.hits) if (px2 >= h.x && py >= h.y && px2 < h.x + h.w && py < h.y + h.h) return h; return null; }
function bigButton(x, y, w, h, label, run, opt = {}) { const hot = (INPUT.x >= x && INPUT.y >= y && INPUT.x < x + w && INPUT.y < y + h && !VIEW.touch) || opt.hot; rrect(x + 2, y + 2, w, h, UI.shadow, 2); rrect(x, y, w, h, hot ? '#5a7ac0' : (opt.col || UI.panel2), 2); rrect(x + 1, y + 1, w - 2, h - 2, hot ? '#6d8fd6' : shade(opt.col || UI.panel2, .12), 1); rrect(x + 2, y + 2, w - 4, h - 4, hot ? '#5a7ac0' : (opt.col || UI.panel2), 1); outline(x, y, w, h, UI.border); if (hot) pointerHand(x - 10, y + h / 2 - 3, SC.t * 1000); bigC(label, x + w / 2, y + (h - 9) / 2, opt.ink || UI.ink, { outline: UI.shadow }); hit(x, y, w, h, run, label); }

// ---------------------------------------------------------------- shared: draw a map definition as a backdrop
let BACKDROP = null;
function makeBackdrop(mapDef) { const m = parseMap(mapDef); const c = document.createElement('canvas'); c.width = m.w * TILE; c.height = m.h * TILE; const g = c.getContext('2d'); for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) drawTerrain(g, m, x, y, x * TILE, y * TILE, 0); return { canvas: c, map: m }; }
function drawBackdrop(bd, ox, oy, dim = .45) { const bw = bd.canvas.width, bh = bd.canvas.height; for (let y = Math.round(oy) % bh - (Math.round(oy) % bh > 0 ? bh : 0); y < VIEW.h; y += bh) for (let x = Math.round(ox) % bw - (Math.round(ox) % bw > 0 ? bw : 0); x < VIEW.w; x += bw) ctx.drawImage(bd.canvas, x, y); if (dim > 0) { ctx.globalAlpha = dim; rect(0, 0, VIEW.w, VIEW.h, '#080a14'); ctx.globalAlpha = 1; } }

// ---------------------------------------------------------------- title
const TITLE_MONS = [25, 4, 7, 1, 133, 39, 54, 143, 94, 6, 130, 150];
function titleDraw() {
  const W = VIEW.w, H = VIEW.h; if (!BACKDROP) BACKDROP = makeBackdrop(CHAPTERS[3].map);
  const ox = -((SC.t * 8) % (BACKDROP.canvas.width - W + 1)), oy = Math.min(0, (H - BACKDROP.canvas.height) / 2); drawBackdrop(BACKDROP, ox, oy, .35);
  // parade of mons walking along the road
  TITLE_MONS.forEach((n, i) => { const x = ((SC.t * 22 + i * 46) % (W + 60)) - 30, y = H * .78 + Math.round(Math.sin(SC.t * 8 + i) * 2); ellipse(x, y + 1, 10, 3, '#00000060'); drawMon(n, x, y, {}); });
  // logo
  const ly = 30 + Math.round(Math.sin(SC.t * 2) * 2);
  ctx.save(); ctx.translate(W / 2, ly); ctx.scale(3, 3); bigC('POKÉ', 0, 0, UI.gold, { outline: '#3a2000' }); ctx.restore();
  ctx.save(); ctx.translate(W / 2, ly + 30); ctx.scale(3, 3); bigC('TAKTIKS', 0, 0, '#ffffff', { outline: '#1c2a4a' }); ctx.restore();
  textC('a pixel tactics adventure · Gen I', W / 2, ly + 62, UI.muted, { outline: UI.shadow });
  SC.hits = []; const bw = 132, bx = W / 2 - bw / 2; let by = ly + 80;
  const has = !!loadSave(), susp = !!loadSuspend();
  const items = [];
  if (susp) items.push(['RESUME BATTLE', () => resumeSuspend()]);
  if (has) items.push(['CONTINUE', () => continueCampaign()]);
  items.push(['NEW GAME', () => { if (has && !confirm('Start a new game? Your campaign save will be replaced.')) return; startNewGame(); }]);
  items.push(['SKIRMISH', () => startSkirmishSetup()]);
  items.forEach((it, i) => { bigButton(bx, by, bw, 18, it[0], () => { Audio.sfx('ok'); it[1](); }, { hot: SC.i === i && !VIEW.touch && INPUT.x < 0 }); by += 22; });
  SC.menuLen = items.length;
  text(Audio.muted ? '♪ off  (M)' : '♪ on  (M)', 6, H - 12, UI.muted); textR('Sprites: Pokémon Showdown', W - 6, H - 12, UI.muted);
  if (Math.floor(SC.t * 2) % 2) textC(VIEW.touch ? 'tap a button' : 'arrows + Z · or click', W / 2, by + 4, UI.muted, { outline: UI.shadow });
}
function titleInput(ev) {
  if (ev.type === 'key') { if (ev.key === 'up') { SC.i = (SC.i - 1 + SC.menuLen) % SC.menuLen; Audio.sfx('menu'); INPUT.x = -1; } else if (ev.key === 'down') { SC.i = (SC.i + 1) % SC.menuLen; Audio.sfx('menu'); INPUT.x = -1; } else if (ev.key === 'ok') { const h = SC.hits[SC.i]; if (h) h.run(); } else if (ev.key === 'mute') Audio.toggle(); return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- starter pick
function starterDraw() {
  const W = VIEW.w, H = VIEW.h; drawBackdrop(BACKDROP, 0, 0, .6);
  bigC('CHOOSE YOUR PARTNER', W / 2, 14, UI.gold, { outline: '#3a2000' }); textC('Prof. Oak: "Take one. They are all good, I checked."', W / 2, 28, UI.ink, { outline: UI.shadow });
  SC.hits = []; const cw = 96, gap = 10; const x0 = W / 2 - (cw * 3 + gap * 2) / 2;
  STARTERS.forEach((n, i) => {
    const d = DEX[n]; const x = x0 + i * (cw + gap), y = 44, h = 150; const sel = SC.i === i; panel(x, y, cw, h, { fill: sel ? '#2a3d6a' : UI.panel, border: sel ? UI.gold : UI.border });
    const bob = sel ? Math.round(Math.abs(Math.sin(SC.t * 6)) * -4) : 0; rect(x + 8, y + 8, cw - 16, 36, teamColorD(0)); drawMon(n, x + cw / 2, y + 42 + bob, { sy: 1 + (sel ? Math.sin(SC.t * 8) * .05 : 0) });
    textC(d.name, x + cw / 2, y + 48, sel ? UI.gold : UI.ink); d.types.forEach((t, j) => typeBadge(t, x + cw / 2 - (d.types.length * 26) / 2 + j * 26 + 1, y + 58, 24));
    const u = makeUnit(n, 5, 0); const st = [['HP', u.maxHp, 40], ['ATK', u.atk, 20], ['DEF', u.def, 20], ['SPA', u.spa, 20], ['SPD', u.spd, 20], ['SPE', u.spe, 20]];
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
function cardDraw() { const W = VIEW.w, H = VIEW.h; const ch = SC.data.chapter; rect(0, 0, W, H, '#0e0c10'); const k = Math.min(1, SC.t / .5); const y = H / 2 - 20; ctx.globalAlpha = k; hline(0, y - 6, W, UI.border2); hline(0, y + 30, W, UI.border2); bigC(ch.num ? 'CHAPTER ' + ch.num : 'SKIRMISH', W / 2, y, UI.muted, { outline: UI.shadow }); ctx.save(); ctx.translate(W / 2, y + 12); ctx.scale(2, 2); bigC(ch.title, 0, 0, UI.gold, { outline: '#3a2000' }); ctx.restore(); ctx.globalAlpha = 1; textC(objectiveTextFor(ch.map.objective), W / 2, y + 40, UI.ink); if (SC.t > 2.2 || (SC.t > .6 && SC.skip)) { SC.skip = false; SC.data.next(); } }
function objectiveTextFor(o) { switch (o.type) { case 'rout': return 'Objective: defeat all enemies'; case 'boss': return 'Objective: defeat ' + (o.bossName || 'the boss'); case 'survive': return 'Objective: survive ' + o.turns + ' turns'; case 'seize': return 'Objective: seize the ' + (o.what || 'gym'); } return ''; }
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
  bigC((ch.num ? 'CHAPTER ' + ch.num + ' · ' : '') + ch.title.toUpperCase(), W / 2, 6, UI.gold, { outline: '#3a2000' }); textC(objectiveTextFor(ch.map.objective) + ' · deploy up to ' + ch.slots, W / 2, 18, UI.ink, { outline: UI.shadow });
  // party grid (left)
  const cols = W < 420 ? 2 : 3; const cw = 118, chh = 30; const gx = 6, gy = 30; const rowsVisible = Math.floor((H - gy - 30) / (chh + 3));
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
  const sel = party[SC.i]; if (sel && rx > gx + 200) { const u = restoreUnit(sel); panel(rx, ry + 68, rw, 48, { title: u.name.toUpperCase() }); const st = [['ATK', u.atk], ['DEF', u.def], ['SPA', u.spa], ['SPD', u.spd], ['SPE', u.spe], ['MOV', u.mov]]; st.forEach((s, j) => { const sx = rx + 6 + (j % 3) * 38, sy = ry + 74 + Math.floor(j / 3) * 10; text(s[0], sx, sy, UI.muted); textR(String(s[1]), sx + 34, sy, UI.ink); }); text(u.moves.map(m => m.name).join(', ').slice(0, 28), rx + 6, ry + 96, '#98d8f8'); const ev = u.dex.evos.length ? 'Evolves Lv' + Math.min(...u.dex.evos.map(e => e[1])) : 'Final form'; text(ev, rx + 6, ry + 106, UI.green); }
  const by = H - 24; bigButton(W - 96, by, 90, 18, 'START', () => { if (!P.deploy.length) { Audio.sfx('error'); return; } Audio.sfx('select'); P.start(); }, { col: '#2a6a3a' });
  bigButton(W - 190, by, 88, 18, 'AUTO PICK', () => { Audio.sfx('ok'); autoDeploy(P); });
  bigButton(6, by, 70, 18, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { col: '#5a4a30' });
  text('Deployed ' + P.deploy.length + '/' + ch.slots + '  ·  click a card to toggle  ·  first slot leads', 82, by + 5, UI.muted, { outline: UI.shadow });
}
function toggleDeploy(P, i) { const k = P.deploy.indexOf(i); if (k >= 0) { P.deploy.splice(k, 1); Audio.sfx('cancel'); } else if (P.deploy.length < P.chapter.slots) { P.deploy.push(i); Audio.sfx('ok'); } else Audio.sfx('error'); }
function autoDeploy(P) { const idx = P.party.map((p, i) => i).sort((a, b) => P.party[b].level - P.party[a].level); P.deploy = idx.slice(0, P.chapter.slots); }
function prepInput(ev) {
  const P = SC.data; const cols = VIEW.w < 420 ? 2 : 3;
  if (ev.type === 'key') { if (ev.key === 'left') SC.i = Math.max(0, SC.i - 1); else if (ev.key === 'right') SC.i = Math.min(P.party.length - 1, SC.i + 1); else if (ev.key === 'up') SC.i = Math.max(0, SC.i - cols); else if (ev.key === 'down') SC.i = Math.min(P.party.length - 1, SC.i + cols); else if (ev.key === 'ok') toggleDeploy(P, SC.i); else if (ev.key === 'next') { if (P.deploy.length) P.start(); } else if (ev.key === 'back') goScene('title'); else if (ev.key === 'mute') Audio.toggle(); if (['left', 'right', 'up', 'down'].includes(ev.key)) { Audio.sfx('cursor'); const r = Math.floor(SC.i / cols); if (r < SC.scroll) SC.scroll = r; const rowsVisible = Math.floor((VIEW.h - 30 - 30) / 33); if (r >= SC.scroll + rowsVisible) SC.scroll = r - rowsVisible + 1; } return; }
  if (ev.type === 'wheel') { SC.scroll += ev.dy > 0 ? 1 : -1; return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- results
function resultsDraw() {
  const W = VIEW.w, H = VIEW.h; const R = SC.data; rect(0, 0, W, H, '#0e0c10'); if (BACKDROP) drawBackdrop(BACKDROP, -((SC.t * 6) % 200), 0, .7);
  SC.hits = []; const win = R.win; const w = Math.min(300, W - 12), x = W / 2 - w / 2; let y = 10;
  const nRew = R.rewards ? Object.keys(R.rewards).length : 0, nC = R.caught ? R.caught.length : 0, nT = R.trained ? Math.min(6, R.trained.length) : 0, nE = R.evolved ? R.evolved.length : 0;
  const ph = 24 + (nRew ? 14 + Math.ceil(nRew / 3) * 10 : 0) + (nC ? 14 + Math.ceil(nC / 4) * 26 : 0) + (nT ? 12 + nT * 9 : 0) + nE * 9 + 8;
  panel(x, y, w, Math.min(H - 44, Math.max(60, ph)), { title: win ? (R.skirmish ? 'SKIRMISH WON' : 'CHAPTER CLEAR') : 'RETREAT' });
  y += 8; if (win) { text('Turns ' + R.turns + (R.par ? ' (par ' + R.par + ')' : '') + '   KOs ' + R.kills, x + 8, y, UI.ink); if (R.par && R.turns <= R.par) textR('★ UNDER PAR', x + w - 8, y, UI.gold); y += 12; }
  else { text('The team limps back to the Poké Center. Everyone is fine. Mostly.', x + 8, y, UI.ink); y += 12; }
  if (R.rewards && Object.keys(R.rewards).length) { text('Rewards', x + 8, y, UI.gold); y += 10; let i = 0; for (const k in R.rewards) { const cx = x + 10 + (i % 3) * 96; const cy = y + Math.floor(i / 3) * 10; drawBall(cx + 4, cy + 4, ITEMS[k].col, 3); text(ITEMS[k].name + ' ×' + R.rewards[k], cx + 12, cy + 1, UI.ink); i++; } y += Math.ceil(i / 3) * 10 + 4; }
  if (R.caught && R.caught.length) { text('New team members', x + 8, y, UI.gold); y += 10; R.caught.forEach((c, i) => { const cx = x + 10 + (i % 4) * 70; const cy = y + Math.floor(i / 4) * 26; drawMon(c.num, cx + 16, cy + 22 + Math.round(Math.sin(SC.t * 6 + i) * 2), {}); text(DEX[c.num].name, cx + 32, cy + 6, UI.ink); text('Lv' + c.level, cx + 32, cy + 14, UI.gold); }); y += Math.ceil(R.caught.length / 4) * 26 + 4; }
  if (R.trained && R.trained.length) { text('Training at the Center', x + 8, y, UI.gold); y += 10; R.trained.forEach((t, i) => { if (i > 5) return; text(t, x + 10, y, '#98d8f8'); y += 9; }); y += 2; }
  if (R.evolved && R.evolved.length) { R.evolved.forEach(e => { text(e, x + 10, y, UI.gold); y += 9; }); }
  bigButton(W / 2 - 50, H - 28, 100, 18, R.nextLabel || 'CONTINUE', () => { Audio.sfx('ok'); R.next(); }, { col: '#2a6a3a' });
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
  SC.hits = []; bigC('SKIRMISH', W / 2, 8, UI.gold, { outline: '#3a2000' });
  const sc = Math.max(.5, Math.min(1, Math.floor(Math.min((W - 20) / S.bd.canvas.width, (H - 100) / S.bd.canvas.height) * 2) / 2)); const pw = S.bd.canvas.width * sc, ph = S.bd.canvas.height * sc; const px0 = W / 2 - pw / 2, py0 = 24; ctx.drawImage(S.bd.canvas, px0, py0, pw, ph); outline(px0 - 1, py0 - 1, pw + 2, ph + 2, UI.border);
  for (const u of S.map.units) { const d = DEX[u.mon]; const ux = px0 + (u.x + .5) * TILE * sc, uy = py0 + (u.y + 1) * TILE * sc; ellipse(ux, uy, 6, 2, teamColor(u.team == null ? 1 : u.team)); ctx.drawImage(monIcon(d.num, true), Math.round(ux - 10), Math.round(uy - 15), 20, 15); }
  for (const d of S.map.deploy) { const ux = px0 + d.x * TILE * sc, uy = py0 + d.y * TILE * sc; outline(ux, uy, TILE * sc, TILE * sc, teamColor(0)); }
  const by = py0 + ph + 8; text('Map seed', 10, by + 4, UI.muted); bigButton(70, by, 22, 14, '-', () => { S.seed = (S.seed + 999) % 1000; Audio.sfx('menu'); }); text(String(S.seed), 100, by + 3, UI.gold); bigButton(126, by, 22, 14, '+', () => { S.seed = (S.seed + 1) % 1000; Audio.sfx('menu'); });
  text('Enemy level', 10, by + 22, UI.muted); bigButton(70, by + 18, 22, 14, '-', () => { S.level = Math.max(3, S.level - 2); Audio.sfx('menu'); }); text(String(S.level), 100, by + 21, UI.gold); bigButton(126, by + 18, 22, 14, '+', () => { S.level = Math.min(48, S.level + 2); Audio.sfx('menu'); });
  text('Party: ' + S.party.length + ' Pokémon' + (S.preset ? ' (loaner team)' : ' (campaign save)'), 170, by + 4, UI.ink); text('Random map, defeat the Rival boss. Wild ones can be caught.', 170, by + 21, UI.muted);
  bigButton(W - 96, H - 24, 90, 18, 'PREPARE', () => { Audio.sfx('select'); S.go(); }, { col: '#2a6a3a' }); bigButton(6, H - 24, 70, 18, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { col: '#5a4a30' });
}
function skirmishInput(ev) { const S = SC.data; if (ev.type === 'key') { if (ev.key === 'left') S.seed = (S.seed + 999) % 1000; else if (ev.key === 'right') S.seed = (S.seed + 1) % 1000; else if (ev.key === 'up') S.level = Math.min(48, S.level + 2); else if (ev.key === 'down') S.level = Math.max(3, S.level - 2); else if (ev.key === 'ok') S.go(); else if (ev.key === 'back') goScene('title'); return; } if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); } }
