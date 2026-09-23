// ============================================================================
// scenes.js — title, starter pick, chapter card, story dialogue, prep (party &
// bag), results, credits. The battle scene lives in battle.js.
// ============================================================================
'use strict';
const SC = { name: 'loading', t: 0, i: 0, hits: [], dialog: null, data: null };
// Scene changes wipe through a Poké Ball, except between the board and the dialogue drawn over it.
const NO_WIPE = new Set(['story>battle', 'battle>story', 'loading>title']);
function goScene(name, data) { if (!NO_WIPE.has(SC.name + '>' + name) && SC.name !== name) captureTransition(); SC.name = name; SC.t = 0; SC.i = 0; SC.hits = []; SC.data = data || null; SC.scroll = 0; if (name === 'title') { initTitle(); Audio.playMusic('title'); } }
function hit(x, y, w, h, run, label) { SC.hits.push({ x, y, w, h, run, label }); }
function hitAt(px2, py) { for (const h of SC.hits) if (px2 >= h.x && py >= h.y && px2 < h.x + h.w && py < h.y + h.h) return h; return null; }
function bigButton(x, y, w, h, label, run, opt = {}) {
  const over = INPUT.x >= x && INPUT.y >= y && INPUT.x < x + w && INPUT.y < y + h, hot = (over && !VIEW.touch) || opt.hot;
  uiButton(x, y, w, h, label, { hot, pressed: over && INPUT.down, col: opt.col, variant: opt.variant, ink: opt.ink, big: !opt.small, disabled: opt.disabled, icon: opt.icon });
  hit(x, y, w, h, run, label); }

// ---------------------------------------------------------------- shared: draw a map definition as a backdrop
let BACKDROP = null;
function makeBackdrop(mapDef) { const m = parseMap(mapDef); const c = document.createElement('canvas'); c.width = m.w * TILE; c.height = m.h * TILE; const g = c.getContext('2d'); for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) drawTerrain(g, m, x, y, x * TILE, y * TILE, 0); return { canvas: c, map: m }; }
function drawBackdrop(bd, ox, oy, dim = .45) { const bw = bd.canvas.width, bh = bd.canvas.height; for (let y = Math.round(oy) % bh - (Math.round(oy) % bh > 0 ? bh : 0); y < VIEW.h; y += bh) for (let x = Math.round(ox) % bw - (Math.round(ox) % bw > 0 ? bw : 0); x < VIEW.w; x += bw) ctx.drawImage(bd.canvas, x, y); if (dim > 0) { ctx.globalAlpha = dim; rect(0, 0, VIEW.w, VIEW.h, '#080a14'); ctx.globalAlpha = 1; } }

const CLOUDS = [{ x: 40, y: 22, r: 36 }, { x: 260, y: 150, r: 48 }, { x: 420, y: 70, r: 30 }, { x: 150, y: 230, r: 42 }, { x: 330, y: 10, r: 26 }];
function drawCloudShadows(t) { ctx.globalAlpha = .14; for (const c of CLOUDS) { const x = ((c.x + t * 9) % (VIEW.w + 140)) - 70, y = c.y; ellipse(x, y, c.r, Math.round(c.r * .42), '#000'); ellipse(x - Math.round(c.r * .5), y + 4, Math.round(c.r * .6), Math.round(c.r * .28), '#000'); ellipse(x + Math.round(c.r * .5), y + 3, Math.round(c.r * .55), Math.round(c.r * .26), '#000'); } ctx.globalAlpha = 1; }

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
  { k: 'seed', label: 'MAP', vals: null, show: v => 'Arena #' + v },
  { k: 'fog', label: 'FOG', vals: [false, true], show: v => v ? 'On' : 'Off' },
  { k: 'cap0', label: 'P1 CAPTAIN', vals: [4, 7, 1], show: v => CAPTAINS[v].name },
  { k: 'cap1', label: 'P2 CAPTAIN', vals: [4, 7, 1], show: v => CAPTAINS[v].name },
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
  const mapKey = [S.seed, S.mode, S.arena, S.fog].join('|'); if (!S.bd || S.bdKey !== mapKey) { S.map = vsMapFor(S); S.bd = makeBackdrop(S.map); S.bdKey = mapKey; }
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
      const sw = Math.floor((pw - 10) / S.size); for (let i = 0; i < S.size; i++) { const sx = x + 5 + i * sw; portraitBg(sx, py + 7, sw - 2, 22, t); const n = S.teams[t][i]; if (n != null) { ctx.drawImage(monIcon(n, t === 1), sx + Math.round((sw - 2 - 24) / 2), py + 10, 24, 18); if (i === 0) drawCrown(sx + 1, py + 8); hit(sx, py + 7, sw - 2, 22, () => { S.teams[t].splice(i, 1); Audio.sfx('cancel'); }); } else if (cur === t && i === S.teams[t].length) { if (Math.floor(SC.t * 3) % 2) outline(sx, py + 7, sw - 2, 22, UI.gold); } else textC('?', sx + (sw - 2) / 2, py + 14, '#ffffff40'); }
      textC(S.teams[t].length >= S.size ? 'READY' : cur === t ? 'PICKING…' : S.teams[t].length + '/' + S.size, x + pw / 2, py + ph - 9, S.teams[t].length >= S.size ? UI.green : cur === t ? UI.gold : UI.muted); };
    strip(0, 6); strip(1, W - 6 - pw); gy = py + ph + 8;
  } else {
    // team panels left / right, arena preview in the middle
    const pw = Math.min(140, Math.floor((W - 110) / 2) - 8), ph = 56, py = 28; const p1x = 6, p2x = W - pw - 6;
    const teamPanel = (t, x) => { panel(x, py, pw, ph, { title: 'PLAYER ' + (t + 1), fill: t === 0 ? '#17264a' : '#3a1a22', border: cur === t ? UI.gold : UI.border });
      const sw = Math.floor((pw - 12) / S.size); for (let i = 0; i < S.size; i++) { const sx = x + 6 + i * sw; portraitBg(sx, py + 8, sw - 2, 34, t); const n = S.teams[t][i]; if (n != null) { drawMon(n, sx + (sw - 2) / 2, py + 40, { flip: t === 1, outline: i === 0 ? UI.gold : null }); if (i === 0) drawCrown(sx + 2, py + 10); hit(sx, py + 8, sw - 2, 34, () => { S.teams[t].splice(i, 1); Audio.sfx('cancel'); }); } else if (cur === t && i === S.teams[t].length) { if (Math.floor(SC.t * 3) % 2) outline(sx, py + 8, sw - 2, 34, UI.gold); } else textC('?', sx + (sw - 2) / 2, py + 22, '#ffffff40'); }
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
    const r1 = H - 2 * (bh + 4), r2 = H - bh - 4, cw3 = Math.floor((W - 20) / 3); const rulesY = iy + 12, phoneRules = VS_RULES, rh = clamp(Math.floor((r1 - 6 - rulesY) / phoneRules.length), 14, 16);
    vsRuleRows(S, 6, rulesY, W - 12, rh, phoneRules);
    footerBand(2 * (bh + 4) + 4);
    bigButton(6, r1, cw3, bh, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { variant: 'ghost' }); bigButton(10 + cw3, r1, cw3, bh, 'RANDOM', () => vsRandom(S)); bigButton(14 + 2 * cw3, r1, cw3, bh, 'CLEAR', () => { S.teams = [[], []]; Audio.sfx('cancel'); }, { variant: 'dark' });
    bigButton(6, r2, W - 12, bh, 'BATTLE!', go, goOpt);
  } else {
    const rx = gx + cols * cw + 10, rw = W - 6 - rx, ry = gy; const fy = footerBand(28); const rh = 14, lines = wrap(VS_MODES[S.mode].blurb + (S.fog ? ' Fog of war hides foes beyond your Pokémon\'s sight.' : '') + ' Your first pick is your captain.', rw - 16); const nl = Math.min(lines.length, Math.max(1, Math.floor((fy - 6 - ry - 21 - VS_RULES.length * rh - 10) / 9)));
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
  if (ev.type === 'key') { if (ev.key === 'left' || ev.key === 'up') starterFocus((SC.i + 2) % 3); else if (ev.key === 'right' || ev.key === 'down') starterFocus((SC.i + 1) % 3); else if (ev.key === 'ok') confirmStarter(); else if (ev.key === 'back') goScene('title'); return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- chapter card
// Between the preparation and the board: letterbox bars close in over the map, a gold ribbon slides in with the chapter
// number, the name drops in letter by letter, the goal follows; on boss maps the boss slides in from the right.
function cardDraw() {
  const W = VIEW.w, H = VIEW.h, ch = SC.data.chapter, t = SC.t; rect(0, 0, W, H, '#0e0c10');
  if (!SC.data.bd) SC.data.bd = makeBackdrop(ch.map); const bd = SC.data.bd; drawBackdrop(bd, (W - bd.canvas.width) / 2 - t * 8, (H - bd.canvas.height) / 2, .7);
  const bars = Math.round(H * .2 * easeOut(clamp(t / .35, 0, 1))); rect(0, 0, W, bars, '#05040f'); rect(0, H - bars, W, bars, '#05040f'); hline(0, bars, W, UI.goldDark); hline(0, H - bars - 1, W, UI.goldDark);
  const cy = Math.round(H * .46), label = ch.num ? 'CHAPTER ' + ch.num : 'SKIRMISH';
  const rib = REDUCED ? 0 : Math.round((1 - easeOut(clamp((t - .15) / .3, 0, 1))) * -W * .6), rw = textWidth(label) + 16; ribbonTab(label, Math.round(W / 2 - rw / 2) + rib, cy - 34);
  const tw = textWidth(ch.title.toUpperCase(), BIG), scale = W >= tw * 3 + 24 ? 3 : W >= tw * 2 + 16 ? 2 : 1;
  drawStampWordAt(ch.title, W / 2, cy - Math.round(4.5 * scale) - 4, t - .25, UI.gold, UI.goldDark, scale);
  const landed = [...ch.title].filter((c2, i) => c2 !== ' ' && t - .25 >= i * .06 + .2).length; if (landed > (SC.data.stamped || 0)) { SC.data.stamped = landed; if (!REDUCED) Audio.sfx(landed === [...ch.title].filter(c2 => c2 !== ' ').length ? 'hit' : 'stamp'); }
  if (t > .9) { ctx.globalAlpha = clamp((t - .9) / .3, 0, 1); const goal = objectiveTextFor(ch.map.objective).replace('Objective: ', ''); const gl = goal[0].toUpperCase() + goal.slice(1), gw = textWidth(gl) + 14; iconAt('flag', Math.round(W / 2 - gw / 2), cy + Math.round(4.5 * scale) + 5, UI.gold); text(gl, Math.round(W / 2 - gw / 2) + 14, cy + Math.round(4.5 * scale) + 6, UI.ink, { outline: UI.inset });
    const foes = (ch.map.units || []).filter(u => u.team == null || u.team === 1), wild = (ch.map.units || []).filter(u => u.team === 2); if (foes.length) textC(foes.length + ' foes' + (wild.length ? ' · ' + wild.length + ' wild' : '') + ' · Lv ' + Math.min(...foes.map(u => u.level)) + '-' + Math.max(...foes.map(u => u.level)), W / 2, cy + Math.round(4.5 * scale) + 18, UI.muted, { outline: UI.inset }); ctx.globalAlpha = 1; }
  // the boss slides in from the right on boss maps
  const boss = (ch.map.units || []).find(u => u.boss && (u.team == null || u.team === 1)); if (boss && H >= 200) { requestAnim(boss.mon); const bx = Math.round(W - 44 + (REDUCED ? 0 : (1 - easeOut(clamp((t - .6) / .4, 0, 1))) * 80)), by = H - bars - 6; if (bx < W + 40) { ctx.globalAlpha = .5; ellipse(bx, by, 16, 3, '#000'); ctx.globalAlpha = 1; if (animReady(boss.mon)) drawAnim(boss.mon, bx, by, t); else drawMon(boss.mon, bx, by, { flip: true }); if (t > 1.1) { const mh = typeof ANIM_META !== 'undefined' && ANIM_META[boss.mon] ? ANIM_META[boss.mon].b : 30; textC('BOSS', bx, Math.max(bars + 2, by - mh - 10), UI.red, { outline: UI.inset }); } } }
  if (SC.t > 2.6 || (SC.t > .6 && SC.skip)) { SC.skip = false; SC.data.next(); }
}
// drawStampWord with an explicit time (the chapter card starts its letters later than the end screen).
function drawStampWordAt(word, cx, y, t, col, dark, scale) { return drawStampWord(word, cx, y, t + END_BEATS.letters, col, dark, scale); }
function objectiveTextFor(o) { switch (o.type) { case 'rout': return 'Objective: defeat all enemies'; case 'boss': return 'Objective: defeat ' + (o.bossName || 'the boss'); case 'survive': return 'Objective: survive ' + o.turns + ' turns'; case 'seize': return 'Objective: seize the ' + (o.what || 'gym'); case 'versus': return 'Objective: defeat the other trainer'; } return ''; }
function cardInput(ev) { if (ev.type === 'up' || (ev.type === 'key' && ev.key === 'ok')) SC.skip = true; }

// ---------------------------------------------------------------- story dialogue (drawn over the battle board)
function startDialog(lines, done) { SC.dialog = { lines, i: 0, chars: 0, t: 0, done }; goScene('story'); }
function storyUpdate(dt) { const d = SC.dialog; if (!d) return; d.t += dt; const line = d.lines[d.i]; const total = line.text.length; if (d.chars < total) { const before = d.chars; d.chars = Math.min(total, d.chars + dt * 45); if (Math.floor(d.chars) !== Math.floor(before) && Math.floor(d.chars) % 2 === 0) Audio.sfx('text'); } CAM.x += (CAM.tx - CAM.x) * Math.min(1, dt * 6); CAM.y += (CAM.ty - CAM.y) * Math.min(1, dt * 6); for (const u of B.units) { u.fx.sx += (1 - u.fx.sx) * dt * 10; u.fx.sy += (1 - u.fx.sy) * dt * 10; } updateFX(dt); Audio.tick(); BT.time += dt; }
function storyDraw() {
  battleDraw(); const d = SC.dialog; if (!d) return; const W = VIEW.w, H = VIEW.h, line = d.lines[d.i], t = d.t;
  ctx.globalAlpha = .35; rect(0, 0, W, H, '#05041a'); ctx.globalAlpha = 1;
  const bh = 60, by = H - bh - 6, bx = 6, bw = W - 12, rise = REDUCED ? 0 : Math.round((1 - easeOutBack(clamp(appear('story') / .3, 0, 1), 2)) * 30);
  panel(bx, by + rise, bw, bh, { fill: '#1c2254' });
  if (line.mon) { requestAnim(line.mon); requestBigSprite(line.mon); const pw = 46, ph = bh - 14, px0 = bx + 7, py0 = by + 7 + rise; ctx.save(); ctx.beginPath(); ctx.rect(px0, py0, pw, ph); ctx.clip(); portraitBg(px0, py0, pw, ph, 0);
    const talk = d.chars < line.text.length && !REDUCED ? Math.round(Math.abs(Math.sin(t * 10))) : 0; if (animReady(line.mon)) drawAnim(line.mon, px0 + pw / 2, py0 + ph + 6 - talk, BT.time); else if (bigReady(line.mon)) drawBig(line.mon, px0 + pw / 2, py0 + ph + 14 - talk, { flip: true }); else drawMon(line.mon, px0 + pw / 2, py0 + ph - 2 - talk, {}); ctx.restore(); outline(px0 - 1, py0 - 1, pw + 2, ph + 2, UI.inset); }
  const tx = bx + (line.mon ? 60 : 10); ribbonTab(line.who, tx - 4, by - 9 + rise);
  const lines = wrap(line.text, bw - (line.mon ? 72 : 22)); let shown = Math.floor(d.chars); lines.forEach((l, i) => { if (shown <= 0) return; const s2 = l.slice(0, shown); shown -= l.length + 1; text(s2, tx, by + 10 + i * 11 + rise, UI.ink); });
  if (d.chars >= line.text.length) { const ax = bx + bw - 12, ay = by + bh - 11 + rise + (REDUCED ? 0 : Math.round(Math.abs(Math.sin(t * 6)) * 2)); rect(ax - 3, ay, 7, 1, UI.gold); rect(ax - 2, ay + 1, 5, 1, UI.gold); rect(ax - 1, ay + 2, 3, 1, UI.gold); px(ax, ay + 3, UI.gold); }
  hintLine([(d.i + 1) + ' / ' + d.lines.length, ['X', 'skip']], bx + bw - 4, by - 12 + rise, { right: true });
  // focus the camera on the speaker's Pokémon if it is on the board
  const spk = B.units.find(u => u.num === line.mon && u.hp > 0); if (spk && !d.focused) { d.focused = true; centerCam(spk.x, spk.y); spk.fx.sy = .8; spk.fx.sx = 1.2; }
}
function storyInput(ev) { const d = SC.dialog; if (!d) return; if (ev.type === 'key' && ev.key === 'back') { finishDialog(); return; } if (ev.type === 'up' || (ev.type === 'key' && ev.key === 'ok')) { const line = d.lines[d.i]; if (d.chars < line.text.length) { d.chars = line.text.length; return; } d.i++; d.chars = 0; d.t = 0; d.focused = false; Audio.sfx('ok'); if (d.i >= d.lines.length) finishDialog(); } }
function finishDialog() { const d = SC.dialog; SC.dialog = null; if (d && d.done) d.done(); }

// ---------------------------------------------------------------- prep: choose who deploys
// Layout: the headline, a TEAM bar with one box per slot (captain first, crowned), the collection as cards, and on wide
// screens a MISSION column (goal, foes, the battlefield with deploy tiles and foes) with the focused Pokémon under it.
function prepLayout(P) {
  const W = VIEW.w, H = VIEW.h, narrow = narrowView(), bh = btnH(), foot = narrow ? 2 * (bh + 4) + 12 : bh + 12, side = W >= 400 && H >= 200;
  const top = 4 + (H >= 240 && !narrow ? 28 : 16), sideW = side ? Math.min(170, Math.floor(W * .34)) : 0, lw = W - 12 - (side ? sideW + 6 : 0);
  const slots = { x: 6, y: top, w: lw, h: narrow ? 30 : 32 };
  const cols = narrow ? 1 : lw >= 380 ? 3 : 2, gap = 4, cw = Math.floor((lw - gap * (cols - 1)) / cols), ch = 30, gy = slots.y + slots.h + 6;
  const rowsVisible = Math.max(1, Math.floor((H - foot - gy + 2) / (ch + 3)));
  return { W, H, narrow, bh, foot, side, top, sideW, lw, slots, cols, gap, cw, ch, gx: 6, gy, rowsVisible, sideX: W - 6 - sideW };
}
function prepDraw() {
  const P = SC.data, ch = P.chapter, L = prepLayout(P), W = L.W, H = L.H, t = SC.t; rect(0, 0, W, H, UI.bg); if (!P.bd) P.bd = makeBackdrop(ch.map); drawBackdrop(P.bd, (W - P.bd.canvas.width) / 2 - t * 3, (H - P.bd.canvas.height) / 2, .8);
  SC.hits = []; const cap = prepCaptain(P);
  screenTitle((ch.num ? 'CHAPTER ' + ch.num + ' · ' : '') + ch.title.toUpperCase(), H >= 240 && !L.narrow ? objectiveTextFor(ch.map.objective) : null, 4);
  // TEAM bar: one box per slot, filled in deploy order
  const S = L.slots, bw = Math.max(20, Math.min(34, Math.floor((S.w - 60) / ch.slots) - 3));
  panel(S.x, S.y, S.w, S.h, { fill: UI.panelDark, flat: true }); text('TEAM', S.x + 7, S.y + Math.round(S.h / 2) - 4, UI.gold); text(P.deploy.length + '/' + ch.slots, S.x + 7, S.y + Math.round(S.h / 2) + 4, P.deploy.length ? UI.ink : UI.muted);
  for (let k = 0; k < ch.slots; k++) {
    const bx = S.x + 44 + k * (bw + 3), by = S.y + 4, bhh = S.h - 8, pid = P.deploy[k]; if (bx + bw > S.x + S.w - 4) break;
    if (pid == null) { for (let q = 0; q < bw; q += 3) { px(bx + q, by, UI.border2); px(bx + q, by + bhh - 1, UI.border2); } for (let q = 0; q < bhh; q += 3) { px(bx, by + q, UI.border2); px(bx + bw - 1, by + q, UI.border2); } textC('+', bx + bw / 2, by + Math.round(bhh / 2) - 4, UI.dim); continue; }
    const u = P.party[pid], pop = easeOutBack(clamp(appear('slot' + k + ':' + pid) / .25, 0, 1), 2.5); rrect(bx, by, bw, bhh, pid === cap ? '#4a3a10' : '#1c3a8a', 1); outline(bx, by, bw, bhh, pid === cap ? UI.gold : '#6a9aff');
    ctx.save(); ctx.beginPath(); ctx.rect(bx + 1, by + 1, bw - 2, bhh - 2); ctx.clip(); const sc = Math.max(.3, pop); drawMon(u.num, bx + bw / 2, by + bhh + 2 - Math.round((1 - Math.min(1, pop)) * 6), { sx: .8 * sc, sy: .8 * sc }); ctx.restore();
    if (pid === cap) drawCrown(bx + 1, by + 1);
  }
  // the collection: one card per Pokémon, deployed ones lit and numbered, the captain locked in with its crown
  const party = P.party, total = Math.ceil(party.length / L.cols); SC.scroll = clamp(SC.scroll, 0, Math.max(0, total - L.rowsVisible));
  ctx.save(); ctx.beginPath(); ctx.rect(0, L.gy - 2, L.lw + 12, L.rowsVisible * (L.ch + 3) + 2); ctx.clip();
  party.forEach((p, i) => {
    const r = Math.floor(i / L.cols) - SC.scroll, c = i % L.cols; if (r < 0 || r >= L.rowsVisible) return; const x = L.gx + c * (L.cw + L.gap), y = L.gy + r * (L.ch + 3), slot = P.deploy.indexOf(i), on = slot >= 0, hot = SC.i === i;
    const u = restoreUnit(p), lift = hot && !REDUCED ? -1 : 0; rrect(x + 1, y + 2, L.cw, L.ch, UI.shadow, 1);
    rrect(x, y + lift, L.cw, L.ch, hot ? UI.gold : on ? '#6a9aff' : UI.inset, 1); rrect(x + 1, y + 1 + lift, L.cw - 2, L.ch - 2, on ? '#223f86' : UI.panel, 1); hline(x + 2, y + 1 + lift, L.cw - 4, on ? '#3a5eb0' : shade(UI.panel, .25));
    ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2 + lift, 30, L.ch - 4); ctx.clip(); rect(x + 2, y + 2 + lift, 30, L.ch - 4, on ? '#17306e' : '#141736'); drawMon(u.num, x + 17, y + L.ch - 2 + lift - (on && !REDUCED ? Math.round(Math.abs(Math.sin(t * 5 + i)) * 1) : 0), { outline: on ? teamColor(0) : null }); ctx.restore();
    const nx = x + 35, lv = 'Lv' + u.level, avail = L.cw - 39 - textWidth(lv) - (on || i === cap ? 14 : 0); text(fitLabel(u.name, avail), nx, y + 4 + lift, UI.ink); textR(lv, x + L.cw - 5 - (on || i === cap ? 14 : 0), y + 4 + lift, UI.gold);
    let bx = nx; for (const tp of u.types) { if (bx + 24 > x + L.cw - 4) break; bx += typeBadge(tp, bx, y + 13 + lift, 24) + 2; } hpBar(nx, y + L.ch - 7 + lift, L.cw - 40, u.hp, u.maxHp);
    if (i === cap) { rrect(x + L.cw - 15, y + 3 + lift, 12, 10, UI.gold, 1); drawCrown(x + L.cw - 13, y + 5 + lift); } else if (on) { circle(x + L.cw - 9, y + 8 + lift, 5, UI.inset); circle(x + L.cw - 9, y + 8 + lift, 4, '#6a9aff'); textC(String(slot + 1), x + L.cw - 8, y + 5 + lift, '#ffffff'); }
    hit(x, y, L.cw, L.ch, () => { SC.i = i; toggleDeploy(P, i); });
  });
  ctx.restore();
  if (total > L.rowsVisible) { const sy = L.gy + L.rowsVisible * (L.ch + 3) - 1; textC((SC.scroll > 0 ? '▲ ' : '') + 'more' + (SC.scroll < total - L.rowsVisible ? ' ▼' : ''), L.gx + L.lw / 2, Math.min(sy, H - L.foot - 9), UI.muted); }
  // MISSION column: goal, foes and the battlefield, then the focused Pokémon
  if (L.side) {
    const x = L.sideX, w = L.sideW; let y = L.slots.y; const foes = (ch.map.units || []).filter(u => u.team == null || u.team === 1), wild = (ch.map.units || []).filter(u => u.team === 2), lv = foes.map(u => u.level);
    const bd = P.bd, previewH = Math.max(0, Math.min(Math.round(w * bd.canvas.height / bd.canvas.width), H - L.foot - y - 110)), mh = 34 + (previewH > 24 ? previewH + 6 : 0);
    const mp = panel(x, y, w, mh, { header: 'MISSION', headerRight: foes.length + ' foes' + (lv.length ? ' · Lv' + Math.min(...lv) : ''), headerRightCol: UI.red });
    const goal = objectiveTextFor(ch.map.objective).replace('Objective: ', ''); iconAt('flag', x + 6, mp.cy - 1, UI.gold); text(fitLabel(goal[0].toUpperCase() + goal.slice(1), w - 22), x + 17, mp.cy, UI.ink);
    if (previewH > 24) { const sc = previewH / bd.canvas.height, pw = Math.round(bd.canvas.width * sc), px0 = x + Math.round((w - pw) / 2), py0 = mp.cy + 11; rect(px0 - 1, py0 - 1, pw + 2, previewH + 2, UI.inset); ctx.drawImage(bd.canvas, px0, py0, pw, previewH); const cell = TILE * sc;
      for (const d of bd.map.deploy) { const X = px0 + d.x * cell, Y = py0 + d.y * cell; rect(X, Y, Math.ceil(cell), Math.ceil(cell), '#3d7dff70'); outline(X, Y, Math.ceil(cell), Math.ceil(cell), teamColor(0)); }
      for (const u of ch.map.units || []) { const team = u.team == null ? 1 : u.team, ux = px0 + (u.x + .5) * cell, uy = py0 + (u.y + 1) * cell; ctx.drawImage(monIcon(u.mon, true), Math.round(ux - 8), Math.round(uy - 12), 16, 12); if (u.boss) drawSkull(Math.round(ux - 2), Math.round(uy - 18)); else { rect(Math.round(ux) - 1, Math.round(uy), 3, 2, teamColor(team)); } } }
    y += mh + 6;
    const sel = party[SC.i]; if (sel && y + 60 <= H - L.foot - 4) { const u = restoreUnit(sel), R = ROLES[u.role], hh = Math.min(H - L.foot - 4 - y, 96); const up = panel(x, y, w, hh, { header: fitLabel(u.name, w - 50), headerRight: 'Lv' + u.level, headerRightCol: UI.gold, headerFill: '#1c3a8a' });
      let yy = up.cy; iconAt(R.icon, x + 6, yy - 1, R.col); text(R.name, x + 17, yy, R.col); textR('MOVE ' + u.mov, x + w - 6, yy, UI.ink); yy += 10;
      for (const m of u.moves.slice(0, 3)) { if (yy + 9 > y + hh - 4) break; typeBadge(m.type, x + 6, yy - 1, 24); text(fitLabel(m.name + ' ' + m.pow, w - 40), x + 33, yy, UI.ink); yy += 10; }
      if (yy + 7 <= y + hh - 4) { const ev = u.dex.evos.length ? 'Evolves Lv' + Math.min(...u.dex.evos.map(e => e[1])) : 'Final form'; text(fitLabel(ev, w - 12), x + 6, yy, UI.info); } }
  }
  const start = () => { if (!P.deploy.length) { Audio.sfx('error'); return; } Audio.sfx('select'); P.start(); }, auto = () => { Audio.sfx('ok'); autoDeploy(P); }, back = () => { Audio.sfx('cancel'); if (P.back) P.back(); else goScene('title'); };
  if (L.narrow) { footerBand(L.foot); const r1 = H - 2 * (L.bh + 4), r2 = H - L.bh - 4;
    bigButton(6, r1, 60, L.bh, 'BACK', back, { variant: 'ghost' }); bigButton(72, r1, W - 78, L.bh, 'AUTO PICK', auto); bigButton(6, r2, W - 12, L.bh, 'START', start, P.deploy.length ? { variant: 'primary' } : { disabled: true }); return; }
  const by = footerBand(L.foot) + 6; bigButton(W - 96, by, 90, L.bh, 'START', start, P.deploy.length ? { variant: 'primary' } : { disabled: true });
  bigButton(W - 190, by, 88, L.bh, 'AUTO PICK', auto); bigButton(6, by, 70, L.bh, 'BACK', back, { variant: 'ghost' });
  if (W - 278 > 60) text(fitLabel(VIEW.touch ? 'Tap a Pokémon to add or remove it' : 'Z add / remove · Tab start', W - 278), 82, by + Math.round((L.bh - 7) / 2), UI.muted);
}
function toggleDeploy(P, i) { if (i === prepCaptain(P)) { Audio.sfx('error'); return; } const k = P.deploy.indexOf(i); if (k >= 0) { P.deploy.splice(k, 1); Audio.sfx('cancel'); } else if (P.deploy.length < P.chapter.slots) { P.deploy.push(i); Audio.sfx('ok'); } else Audio.sfx('error'); }
function autoDeploy(P) {
  const captain = prepCaptain(P), idx = P.party.map((p, i) => i).filter(i => i !== captain).sort((a, b) => P.party[b].level - P.party[a].level);
  P.deploy = (captain == null ? idx : [captain].concat(idx)).slice(0, P.chapter.slots);
}

function prepInput(ev) {
  const P = SC.data; const cols = prepLayout(P).cols;
  if (ev.type === 'key') { if (ev.key === 'left') SC.i = Math.max(0, SC.i - 1); else if (ev.key === 'right') SC.i = Math.min(P.party.length - 1, SC.i + 1); else if (ev.key === 'up') SC.i = Math.max(0, SC.i - cols); else if (ev.key === 'down') SC.i = Math.min(P.party.length - 1, SC.i + cols); else if (ev.key === 'ok') toggleDeploy(P, SC.i); else if (ev.key === 'next') { if (P.deploy.length) P.start(); } else if (ev.key === 'back') { Audio.sfx('cancel'); if (P.back) P.back(); else goScene('title'); } else if (ev.key === 'mute') Audio.toggle(); if (['left', 'right', 'up', 'down'].includes(ev.key)) { Audio.sfx('cursor'); const r = Math.floor(SC.i / cols); if (r < SC.scroll) SC.scroll = r; const rowsVisible = prepLayout(P).rowsVisible; if (r >= SC.scroll + rowsVisible) SC.scroll = r - rowsVisible + 1; } return; }
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
  const nRew = R.rewards ? Object.keys(R.rewards).length : 0, nC = R.caught ? R.caught.length : 0, nT = R.trained ? Math.min(6, R.trained.length) : 0, nE = R.evolved ? R.evolved.length : 0, stars = win && R.stars != null;
  const lose = wrap('The team limps back to the Poké Center. Everyone is fine. Mostly.', w - 16);
  const ph = 36 + (stars ? 30 : 0) + (win ? 10 : (lose.length - 1) * 9) + (nRew ? 14 + Math.ceil(nRew / rc) * 10 : (win && !R.skirmish ? 12 : 0)) + (nC ? 14 + Math.ceil(nC / cc) * 26 : 0) + (nT ? 12 + nT * 9 : 0) + nE * 9 + 8;
  const phh = Math.min(H - 44, Math.max(60, ph)); y = Math.max(8, Math.round((H - 30 - phh) / 2));
  const tok = unfold('results', x, y, w, phh, .25);
  const p = panel(x, y, w, phh, { header: win ? (R.skirmish ? 'SKIRMISH WON!' : 'CHAPTER CLEAR!') : 'RETREAT', headerRight: stars && R.stars > (R.best || 0) && !R.skirmish ? 'NEW BEST' : null, headerRightCol: UI.gold, headerFill: win ? '#2a2470' : '#4a1626' });
  y = p.cy;
  if (stars) { // three stars pop in one after another, then the goals they stand for
    for (let s2 = 0; s2 < 3; s2++) { const t0 = appear('res:star' + s2) - .25 - s2 * .3, u = clamp(t0 / .25, 0, 1), on = s2 < R.stars && u > 0, sc = on ? 1 + Math.round((1 - easeOutBack(u, 3)) * 1.5) : 1; drawBigStar(x + w / 2 + (s2 - 1) * 20, y + 7, sc, on); }
    y += 18; textC('win  ·  ' + (R.turns <= (R.par || 10) ? 'under par' : 'over par') + '  ·  ' + (R.faints ? R.faints + ' fainted' : 'nobody fainted'), x + w / 2, y, UI.muted); y += 12;
  }
  if (win) { const tv = countUp('res:turns', R.turns, .5, .2), kv = countUp('res:kos', R.kills, .5, .35); text('Turns ' + tv + (R.par ? ' / par ' + R.par : ''), x + 8, y, R.par && R.turns <= R.par ? UI.green : UI.ink); textR('KOs ' + kv, x + w - 8, y, UI.ink); y += 12; }
  else { lose.forEach(l => { text(l, x + 8, y, UI.ink); y += 9; }); y += 3; }
  if (nRew) { sectionLabel('Rewards', x + 8, y, w - 16, UI.gold); y += 10; let i = 0; for (const k in R.rewards) { const cx = x + 10 + (i % rc) * 96; const cy = y + Math.floor(i / rc) * 10; drawBall(cx + 4, cy + 4, (ITEMS[k] || ITEMS.pokeball).col, 3); text((ITEMS[k] || ITEMS.pokeball).name + ' ×' + countUp('res:rew' + k, R.rewards[k], .4, .6), cx + 12, cy + 1, UI.ink); i++; } y += Math.ceil(i / rc) * 10 + 4; }
  else if (win && !R.skirmish) { text('Replay: rewards come with the first clear', x + 8, y, UI.dim); y += 12; }
  if (nC) { sectionLabel('New team members', x + 8, y, w - 16, UI.gold); y += 10; R.caught.forEach((c, i) => { const cx = x + 10 + (i % cc) * 70; const cy = y + Math.floor(i / cc) * 26; drawMon(c.num, cx + 16, cy + 22 + Math.round(Math.abs(Math.sin(SC.t * 6 + i)) * -3), { outline: teamColor(0) }); text(DEX[c.num].name, cx + 32, cy + 6, UI.ink); text('Lv' + c.level, cx + 32, cy + 14, UI.gold); }); y += Math.ceil(R.caught.length / cc) * 26 + 4; }
  if (R.trained && R.trained.length) { sectionLabel('Training at the Center', x + 8, y, w - 16, UI.gold); y += 10; R.trained.forEach((t, i) => { if (i > 5) return; let s2 = t; while (textWidth(s2) > w - 20 && s2.length > 8) s2 = s2.slice(0, -1); text(s2, x + 10, y, '#98d8f8'); y += 9; }); y += 2; }
  if (R.evolved && R.evolved.length) { R.evolved.forEach(e => { let s2 = e; while (textWidth(s2) > w - 20 && s2.length > 8) s2 = s2.slice(0, -1); text(s2, x + 10, y, UI.gold); y += 9; }); }
  unfoldEnd(tok);
  { const fy = footerBand(30) + 6; if (R.route) { const bw = Math.min(100, Math.floor((W - 18) / 2)); bigButton(W / 2 - bw - 4, fy, bw, 18, 'ROUTE', () => { Audio.sfx('cancel'); R.route(); }, { variant: 'ghost' }); bigButton(W / 2 + 4, fy, bw, 18, R.nextLabel || 'CONTINUE', () => { Audio.sfx('ok'); R.next(); }, { variant: 'primary' }); } else bigButton(W / 2 - 50, fy, 100, 18, R.nextLabel || 'CONTINUE', () => { Audio.sfx('ok'); R.next(); }, { variant: 'primary' }); }
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

// ---------------------------------------------------------------- quick battle: pick a mode against the CPU
const QUICK_MODES = [
  { id: 'skirmish', label: 'SKIRMISH', tag: 'ROUT', lines: ['A random map every time.', 'Beat the Rival and catch', 'wild Pokémon on the way.'], goal: 'Defeat the Rival', run: () => startSkirmishSetup() },
  { id: 'conquest', label: 'CONQUEST', tag: 'CENTERS', lines: ['Three bridges, six teammates.', 'Capture centers to earn points', 'and call reserves.'], goal: 'Take the HQ or hold 2 centers', run: () => startTerritorySetup() },
];
function quickPreview(m) { const S = SC.data || (SC.data = {}); if (!S[m.id]) S[m.id] = makeBackdrop(m.id === 'conquest' ? TERRITORY_MAP : skirmishMap(412, 16, 11, 12)); return S[m.id]; }
function quickDraw() {
  const W = VIEW.w, H = VIEW.h, narrow = narrowView() || portraitView(), bh = btnH(); rect(0, 0, W, H, UI.bg); SC.hits = [];
  const bd = quickPreview(QUICK_MODES[SC.i]); drawBackdrop(bd, (W - bd.canvas.width) / 2 - SC.t * 5, (H - bd.canvas.height) / 2, .78);
  const top = screenTitle('QUICK BATTLE', 'Battle the CPU · your captain leads', 5);
  const foot = footerBand(bh + 12), gap = 8, n = QUICK_MODES.length;
  const cw = narrow ? W - 16 : Math.min(200, Math.floor((W - 24 - gap) / 2)), ch = narrow ? Math.floor((foot - top - 8 - gap) / 2) : Math.min(foot - top - 14, 170);
  const x0 = narrow ? 8 : Math.round(W / 2 - (cw * 2 + gap) / 2), y0 = narrow ? top + 4 : top + Math.max(4, Math.round((foot - top - ch) / 2) - 4);
  QUICK_MODES.forEach((m, i) => {
    const sel = SC.i === i, x = narrow ? x0 : x0 + i * (cw + gap), y = narrow ? y0 + i * (ch + gap) : y0, lift = sel && !REDUCED ? -2 : 0;
    const tok = unfold('quick' + i, x, y, cw, ch, .22 + i * .06);
    const p = panel(x, y + lift, cw, ch, { header: m.label, headerRight: m.tag, headerRightCol: sel ? UI.gold : UI.muted, fill: sel ? UI.panel2 : UI.panel, border: sel ? UI.gold : UI.border });
    const pv = quickPreview(m), room = ch - 76, sc = Math.min((cw - 16) / pv.canvas.width, room / pv.canvas.height);
    const pw = Math.floor(pv.canvas.width * sc), ph = Math.floor(pv.canvas.height * sc), px0 = x + Math.round((cw - pw) / 2), py0 = p.cy;
    if (ph >= 18) { rect(px0 - 2, py0 - 2, pw + 4, ph + 4, UI.inset); ctx.drawImage(pv.canvas, px0, py0, pw, ph); outline(px0 - 1, py0 - 1, pw + 2, ph + 2, sel ? UI.gold : UI.border2); }
    const tx = x + 8, ty = py0 + (ph >= 18 ? ph + 6 : 0), tw = x + cw - 8 - tx;
    let ly = ty; for (const l of m.lines) { if (ly + 8 > y + lift + ch - 16) break; text(fitLabel(l, tw), tx, ly, UI.ink); ly += 9; }
    const gy = y + lift + ch - 15; iconAt('flag', x + 8, gy - 1, sel ? UI.gold : UI.muted); text(fitLabel(m.goal, cw - 28), x + 20, gy, sel ? UI.gold : UI.muted);
    unfoldEnd(tok);
    if (sel && !REDUCED) { const k = SC.t * 2.2; sparkle(x + cw - 6, y + lift + 3 + Math.round(Math.sin(k) * 1), Math.round(1 + (Math.sin(k * 1.7) + 1)), '#fff2b0'); }
    hit(x, y, cw, ch, () => { if (SC.i === i) quickGo(); else { SC.i = i; Audio.sfx('cursor'); } }, m.label);
  });
  const fy = foot + 6; bigButton(6, fy, 70, bh, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { variant: 'ghost' });
  bigButton(W - 96, fy, 90, bh, 'CHOOSE', quickGo, { variant: 'primary' });
  if (!narrow && W > 330) hintLine(VIEW.touch ? ['tap a card twice'] : [['◂▸', 'mode'], ['Z', 'choose']], W / 2, fy + (bh - 7) / 2, { pill: false });
}
function quickGo() { Audio.sfx('select'); QUICK_MODES[SC.i].run(); }
function quickInput(ev) {
  if (ev.type === 'key') { if (['left', 'right', 'up', 'down'].includes(ev.key)) { SC.i = 1 - SC.i; Audio.sfx('cursor'); } else if (ev.key === 'ok') quickGo(); else if (ev.key === 'back') { Audio.sfx('cancel'); goScene('title'); } else if (ev.key === 'mute') Audio.toggle(); return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- skirmish setup
// Skirmish setup: the random map framed on the left with a dice to roll another, the Rival (the boss) on the right with
// the foe and wild counts and the foe level, then your team. The map regenerates when the seed or the level changes.
function skirmishDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data, t = SC.t; rect(0, 0, W, H, UI.bg);
  if (!S.bd || S.bdSeed !== S.seed || S.bdLevel !== S.level) { S.map = skirmishMap(S.seed, 16, 11, S.level); S.bd = makeBackdrop(S.map); S.bdSeed = S.seed; S.bdLevel = S.level; S.rolledAt = SC.t; }
  drawBackdrop(S.bd, (W - S.bd.canvas.width) / 2 + 40 - t * 4, (H - S.bd.canvas.height) / 2 + 30, .84); drawCloudShadows(t);
  const narrow = narrowView() || portraitView(), bh = btnH(), sbh = narrow ? 18 : 15; SC.hits = [];
  const top = screenTitle('SKIRMISH', narrow ? null : 'A random map · beat the Rival · catch wild Pokémon', 4), fy = footerBand(bh + 12) + 6;
  const sideW = narrow ? W - 12 : Math.min(170, Math.floor(W * .34)), mapW = narrow ? W - 12 : W - 18 - sideW, mapH = narrow ? Math.round((fy - 12 - top) * .46) : fy - 12 - top;
  // the map, framed, with the deploy tiles and every Pokémon on it; a dice to reroll
  const sc = Math.min((mapW - 8) / S.bd.canvas.width, (mapH - 8) / S.bd.canvas.height), pw = Math.floor(S.bd.canvas.width * sc), ph = Math.floor(S.bd.canvas.height * sc), px0 = 6 + Math.floor((mapW - pw) / 2), py0 = top + 2 + Math.floor((mapH - ph) / 2);
  const shake = REDUCED ? 0 : Math.round(Math.sin(clamp((t - (S.rolledAt || 0)) / .3, 0, 1) * Math.PI * 3) * 2 * (1 - clamp((t - (S.rolledAt || 0)) / .3, 0, 1)));
  rrect(px0 - 5, py0 - 5 + shake, pw + 10, ph + 10, UI.inset, 2); rect(px0 - 3, py0 - 3 + shake, pw + 6, ph + 6, UI.border2); ctx.drawImage(S.bd.canvas, px0, py0 + shake, pw, ph); outline(px0 - 1, py0 - 1 + shake, pw + 2, ph + 2, UI.border);
  const cell = TILE * sc; for (const d of S.map.deploy) { const ux = px0 + d.x * cell, uy = py0 + d.y * cell + shake; rect(ux, uy, Math.ceil(cell), Math.ceil(cell), '#3d7dff50'); outline(ux, uy, Math.ceil(cell), Math.ceil(cell), teamColor(0)); }
  for (const u of S.map.units) { const d = DEX[u.mon], ux = px0 + (u.x + .5) * cell, uy = py0 + (u.y + 1) * cell + shake, iw = Math.max(14, Math.round(cell * 1.1)); ellipse(Math.round(ux), Math.round(uy), Math.round(iw / 3), 2, teamColor(u.team == null ? 1 : u.team)); ctx.drawImage(monIcon(d.num, true), Math.round(ux - iw / 2), Math.round(uy - iw * .75), iw, Math.round(iw * .75)); if (u.boss) drawSkull(Math.round(ux - 2), Math.round(uy - iw * .75 - 6)); }
  const dz = 18; bigButton(px0 + pw - dz - 2, py0 + 3 + shake, dz, dz, '', () => { S.seed = (S.seed + 1 + Math.floor(Math.random() * 97)) % 1000; Audio.sfx('shake'); }, { small: true, variant: 'dark', icon: 'dice' }); SC.hits[SC.hits.length - 1].label = 'REROLL';
  { const nw = textWidth(S.map.name) + 8; ctx.globalAlpha = .8; rrect(px0 + 3, py0 + ph - 14 + shake, nw, 11, UI.inset, 2); ctx.globalAlpha = 1; text(S.map.name, px0 + 7, py0 + ph - 12 + shake, UI.ink); }
  // the Rival and the settings
  const sx = narrow ? 6 : 12 + mapW, sy = narrow ? top + mapH + 6 : top + 2, sh = fy - 8 - sy, boss = S.map.units.find(u => u.boss), foes = S.map.units.filter(u => u.team == null || u.team === 1), wild = S.map.units.filter(u => u.team === 2);
  const pnl = panel(sx, sy, sideW, sh, { header: 'RIVAL', headerRight: foes.length + ' foes · ' + wild.length + ' wild', headerRightCol: UI.muted, headerFill: '#5a1d2e' }); let y = pnl.cy;
  if (boss) { const bnum = boss.mon, room = narrow ? 30 : 46; requestAnim(bnum); ctx.save(); ctx.beginPath(); ctx.rect(sx + 6, y, 44, room); ctx.clip(); portraitBg(sx + 6, y, 44, room, 1); if (animReady(bnum) && room >= 40) drawAnim(bnum, sx + 28, y + room - 3, t); else drawMon(bnum, sx + 28, y + room - 2, { flip: true }); ctx.restore(); outline(sx + 5, y - 1, 46, room + 2, UI.border2);
    text(fitLabel(DEX[bnum].name, sideW - 64), sx + 56, y + 2, UI.ink); text('Lv ' + boss.level, sx + 56, y + 12, UI.gold); let bx = sx + 56; for (const tp of DEX[bnum].types) { if (bx + 24 > sx + sideW - 6) break; bx += typeBadge(tp, bx, y + 22, 24) + 2; } y += room + 6; }
  const setting = (label, val, dec, inc) => { text(label, sx + 8, y + Math.round((sbh - 7) / 2), UI.muted); bigButton(sx + sideW - 62, y, 18, sbh, '-', dec, { small: true }); textC(String(val), sx + sideW - 32, y + Math.round((sbh - 7) / 2), UI.gold); bigButton(sx + sideW - 24, y, 18, sbh, '+', inc, { small: true }); y += sbh + 4; };
  if (y + sbh < sy + sh - 4) setting('Foe level', S.level, () => { S.level = Math.max(3, S.level - 2); Audio.sfx('menu'); }, () => { S.level = Math.min(48, S.level + 2); Audio.sfx('menu'); });
  if (y + 20 < sy + sh - 4) { sectionLabel(S.preset ? 'Loaner team' : 'Your team', sx + 8, y, sideW - 16, UI.gold); y += 10; const per = Math.max(1, Math.floor((sideW - 12) / 22)); S.party.slice(0, per * 2).forEach((p, i) => { const ix = sx + 8 + (i % per) * 22, iy = y + Math.floor(i / per) * 18; if (iy + 16 > sy + sh - 3) return; ctx.drawImage(monIcon(p.num), ix - 2, iy, 24, 18); }); }
  bigButton(W - 96, fy, 90, bh, 'PREPARE', () => { Audio.sfx('select'); S.go(); }, { variant: 'primary' }); bigButton(6, fy, 70, bh, 'BACK', () => { Audio.sfx('cancel'); goScene('quick'); }, { variant: 'ghost' });
  if (!narrow) hintLine([['◂▸', 'map'], ['▲▼', 'level'], ['Z', 'prepare']], W / 2, fy + (bh - 7) / 2, { pill: false });
}
function skirmishInput(ev) { const S = SC.data; if (ev.type === 'key') { if (ev.key === 'left') S.seed = (S.seed + 999) % 1000; else if (ev.key === 'right') S.seed = (S.seed + 1) % 1000; else if (ev.key === 'up') S.level = Math.min(48, S.level + 2); else if (ev.key === 'down') S.level = Math.max(3, S.level - 2); else if (ev.key === 'ok') S.go(); else if (ev.key === 'back') goScene('quick'); return; } if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); } }
