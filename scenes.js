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
  { k: 'co0', label: 'P1 COMMANDER', vals: CO_ORDER.slice(1), show: v => COS[v].name },
  { k: 'co1', label: 'P2 COMMANDER', vals: CO_ORDER.slice(1), show: v => COS[v].name },
  { k: 'funds', label: 'FUNDS', vals: VS_FUNDS, show: v => money(v) },
  { k: 'weather', label: 'WEATHER', vals: SKIRMISH.weather, show: v => v === 'none' ? 'Clear' : v === 'random' ? 'Random' : WEATHER[v].name },
];
function vsCycle(S, rule, dir) { const vals = typeof rule.vals === 'function' ? rule.vals(S) : rule.vals; if (vals) { const i = vals.indexOf(S[rule.k]); S[rule.k] = vals[(Math.max(0, i) + dir + vals.length) % vals.length]; } else S.seed = (S.seed + dir + 1000) % 1000; Audio.sfx('menu'); }
function vsRuleRows(S, x, y, w, rh, rules, focus = -1) {
  rules.forEach((rule, i) => { const ry = y + i * rh; const val = rule.show(S[rule.k], S); const bw = 16, bhh = rh - 2;
    if (i % 2) { ctx.globalAlpha = .18; rect(x, ry, w, rh, '#ffffff'); ctx.globalAlpha = 1; }
    if (i === focus) { rect(x, ry, 2, rh, UI.gold); outline(x, ry, w, rh, UI.goldDark); }
    text(rule.label, x + 4, ry + (rh - 7) / 2, i === focus ? UI.gold : UI.muted);
    bigButton(x + w - bw, ry + 1, bw, bhh, '▸', () => vsCycle(S, rule, 1), { small: true, variant: 'dark' }); bigButton(x + w - 2 * bw - 3, ry + 1, bw, bhh, '◂', () => vsCycle(S, rule, -1), { small: true, variant: 'dark' });
    // the test harness and screen readers see the arrows as LABEL- / LABEL+
    SC.hits[SC.hits.length - 1].label = rule.label + '-'; SC.hits[SC.hits.length - 2].label = rule.label + '+';
    textR(val, x + w - 2 * bw - 7, ry + (rh - 7) / 2, rule.k === 'mode' ? UI.gold : UI.ink); hit(x, ry, w - 2 * bw - 4, rh, () => vsCycle(S, rule, 1), rule.label); });
}
// Phones: the rules as a two-column grid of cells, label over value; a tap cycles the value.
function vsRuleGrid(S, x, y, w, rh, rules) {
  const cw = Math.floor((w - 3) / 2); rules.forEach((rule, i) => { const cx = x + (i % 2) * (cw + 3), cy = y + Math.floor(i / 2) * (rh + 2), val = rule.show(S[rule.k], S);
    rrect(cx, cy, cw, rh, '#141c30', 1); outline(cx, cy, cw, rh, UI.border2); text(fitLabel(rule.label, cw - 6), cx + 3, cy + 2, UI.muted); textR(fitLabel(val, cw - 6), cx + cw - 3, cy + rh - 9, rule.k === 'mode' ? UI.gold : UI.ink);
    hit(cx, cy, cw, rh, () => vsCycle(S, rule, 1), rule.label + '+'); }); // a tap is the row's [+]
}
function versusDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data; rect(0, 0, W, H, '#0e0c10');
  const mapKey = [S.seed, S.mode, S.arena, S.fog, S.weather].join('|'); if (!S.bd || S.bdKey !== mapKey) { S.map = vsMapFor(S); S.bd = makeBackdrop(S.map); S.bdKey = mapKey; }
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
    const teamPanel = (t, x) => { const coId = t === 0 ? S.co0 : S.co1, co = COS[coId]; panel(x, py, pw, ph, { title: 'PLAYER ' + (t + 1) + (co ? ' · ' + co.name.toUpperCase() : ''), fill: t === 0 ? '#17264a' : '#3a1a22', border: cur === t ? UI.gold : UI.border });
      { const face = co && trainerFace(co.tr); if (face) { const fx = x + pw - 22, fy = py - 9; rect(fx - 1, fy - 1, 20, 20, co.col); ctx.drawImage(face, fx, fy); outline(fx - 2, fy - 2, 22, 22, UI.inset); hit(fx - 2, fy - 2, 22, 22, () => vsCycle(S, VS_RULES.find(r => r.k === (t === 0 ? 'co0' : 'co1')), 1), 'P' + (t + 1) + ' CO'); } }
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
    const r1 = H - 2 * (bh + 4), r2 = H - bh - 4, cw3 = Math.floor((W - 20) / 3); const rulesY = iy + 12, rows = Math.ceil(VS_RULES.length / 2), rh = clamp(Math.floor((r1 - 6 - rulesY) / rows) - 2, 14, 20);
    vsRuleGrid(S, 6, rulesY, W - 12, rh, VS_RULES);
    footerBand(2 * (bh + 4) + 4);
    bigButton(6, r1, cw3, bh, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { variant: 'ghost' }); bigButton(10 + cw3, r1, cw3, bh, 'RANDOM', () => vsRandom(S)); bigButton(14 + 2 * cw3, r1, cw3, bh, 'CLEAR', () => { S.teams = [[], []]; Audio.sfx('cancel'); }, { variant: 'dark' });
    bigButton(6, r2, W - 12, bh, 'BATTLE!', go, goOpt);
  } else {
    const rx = gx + cols * cw + 10, rw = W - 6 - rx, ry = gy; const fy = footerBand(28); const rh = 14, lines = wrap(VS_MODES[S.mode].blurb + (S.fog ? ' Fog of war hides foes beyond your Pokémon\'s sight.' : '') + ' Each commander\'s Ace joins the team.', rw - 16); const nl = Math.min(lines.length, Math.max(0, Math.floor((fy - 6 - ry - 21 - VS_RULES.length * rh - 10) / 9)));
    const p = panel(rx, ry, rw, Math.min(fy - 6 - ry, 21 + VS_RULES.length * rh + 8 + nl * 9 + 6), { header: 'MATCH RULES', headerRight: VS_MODES[S.mode].short + (S.fog ? ' · FOG' : '') });
    vsRuleRows(S, rx + 4, p.cy - 2, rw - 8, rh, VS_RULES);
    const by0 = p.cy - 2 + VS_RULES.length * rh + 3; if (nl) { hline(rx + 5, by0, rw - 10, UI.inset); lines.slice(0, nl).forEach((l, i) => text(l, rx + 8, by0 + 4 + i * 9, UI.muted)); }
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
  const cy = Math.round(H * .46), label = ch.num ? 'FRONT ' + ch.num : ch.label || 'SKIRMISH';
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
function objectiveTextFor(o) { switch (o.type) { case 'rout': return 'Objective: defeat all enemies'; case 'war': return 'Objective: rout the foe or take their HQ'; case 'safari': return 'Objective: out-catch Blue in ' + o.days + ' days'; case 'boss': return 'Objective: defeat ' + (o.bossName || 'the boss'); case 'survive': return 'Objective: survive ' + o.turns + ' turns'; case 'seize': return 'Objective: seize the ' + (o.what || 'gym'); case 'versus': return 'Objective: defeat the other trainer'; } return ''; }
function cardInput(ev) { if (ev.type === 'up' || (ev.type === 'key' && ev.key === 'ok')) SC.skip = true; }

// ---------------------------------------------------------------- story dialogue (drawn over the battle board)
// Who speaks: a trainer sprite (assets/trainers/<tr>.png), the side they stand on (allies left, opponents right),
// their colour and the pitch of their voice; a Pokémon speaks through its battle sprite with an aura.
const SPEAKERS = {
  'Prof. Oak': { tr: 'oak', side: 0, col: '#d8b878', voice: 170 }, 'You': { tr: 'red', side: 0, col: '#e04848', voice: 330 }, 'Bill': { tr: 'bill', side: 0, col: '#8ab4ff', voice: 300 }, 'Nurse Joy': { tr: 'nurse', side: 0, col: '#ff9ac0', voice: 520 },
  'Youngster Joey': { tr: 'youngster', side: 1, col: '#ff9a3c', voice: 560 }, 'Bug Catcher Timmy': { tr: 'bugcatcher', side: 1, col: '#8cd058', voice: 500 }, 'Rocket Grunt': { tr: 'rocketgrunt', side: 1, col: '#e05050', voice: 240 },
  'Engineer Watt': { tr: 'scientist', side: 1, col: '#ffd24a', voice: 280 }, 'Swimmer Ana': { tr: 'swimmer', side: 1, col: '#5aa8f0', voice: 460 }, 'Hiker': { tr: 'hiker', side: 1, col: '#c89858', voice: 150 },
  'Blue': { tr: 'blue', side: 1, col: '#5a8af0', voice: 360 }, 'Giovanni': { tr: 'giovanni', side: 1, col: '#b8a078', voice: 120 }, 'Brock': { tr: 'brock', side: 1, col: '#c89858', voice: 200 }, 'Misty': { tr: 'misty', side: 1, col: '#5aa8f0', voice: 480 },
  'Lt. Surge': { tr: 'ltsurge', side: 1, col: '#ffd24a', voice: 180 }, 'Erika': { tr: 'erika', side: 1, col: '#8cd058', voice: 440 }, 'Koga': { tr: 'koga', side: 1, col: '#b070d0', voice: 210 }, 'Sabrina': { tr: 'sabrina', side: 1, col: '#ff70b0', voice: 400 }, 'Blaine': { tr: 'blaine', side: 1, col: '#ff7040', voice: 190 },
  'Mewtwo': { mon: 150, side: 1, col: '#c890f0', voice: 90, cry: true }, 'Moltres': { mon: 146, side: 1, col: '#ff8a2c', voice: 130, cry: true },
};
function speakerOf(line) { const S = SPEAKERS[line.who] || (line.mon ? { mon: line.mon, side: 1, col: UI.gold, voice: 300 } : { side: 0, col: UI.gold, voice: 300 }); return line.side != null && line.side !== S.side ? Object.assign({}, S, { side: line.side }) : S; } // a line may put its speaker on the other side
const TRAINERS = { img: {}, state: {}, cache: {} };
function trainerImg(tr) {
  if (!TRAINERS.state[tr] && typeof Image !== 'undefined') { TRAINERS.state[tr] = 'loading'; const img = new Image(); img.onload = () => { TRAINERS.img[tr] = img; TRAINERS.state[tr] = 'ok'; }; img.onerror = () => { TRAINERS.state[tr] = 'fail'; }; img.src = 'assets/trainers/' + tr + '.png'; }
  return TRAINERS.img[tr] || null;
}
// A trainer's 80×80 sprite, mirrored for the right-hand side and darkened while they listen. Cached.
function trainerCanvas(tr, flip, dim) {
  const img = trainerImg(tr); if (!img) return null; const key = tr + (flip ? 'f' : '') + (dim ? 'd' : ''); let c = TRAINERS.cache[key]; if (c) return c;
  c = document.createElement('canvas'); c.width = 80; c.height = 80; const g = c.getContext('2d'); if (flip) { g.translate(80, 0); g.scale(-1, 1); } g.drawImage(img, 0, 0);
  if (dim) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(10,12,34,.55)'; g.fillRect(0, 0, 80, 80); }
  TRAINERS.cache[key] = c; return c;
}
// A trainer's face for small badges (the power meter, the power menu): an 18×18 crop around the head. The head
// positions were measured from the sprites' opaque pixels (a canvas cannot read them back on file://). Cached.
const TRAINER_HEADS = { beauty: [37, 4], biker: [42, 1], bill: [38, 6], birdkeeper: [37, 8], blackbelt: [39, 9], blaine: [42, 6], blue: [37, 2], brock: [34, 14], bugcatcher: [44, 20], burglar: [40, 6], camper: [38, 23], erika: [41, 6], fisherman: [44, 16], gentleman: [35, 6], giovanni: [42, 8], hiker: [39, 4], juggler: [33, 5], koga: [37, 6], lass: [31, 8], ltsurge: [38, 6], misty: [34, 5], nurse: [33, 8], oak: [41, 6], psychic: [41, 6], red: [38, 8], rocketgrunt: [45, 9], rocketgruntf: [32, 9], sabrina: [41, 5], scientist: [42, 5], supernerd: [50, 17], swimmer: [36, 34], teamrocket: [41, 1], youngster: [41, 23] };
function trainerFace(tr) {
  const key = 'face:' + tr; if (TRAINERS.cache[key]) return TRAINERS.cache[key]; const img = trainerImg(tr); if (!img) return null;
  const [cx, top] = TRAINER_HEADS[tr] || [40, 6], f = document.createElement('canvas'); f.width = 18; f.height = 18; f.getContext('2d').drawImage(img, cx - 9, Math.max(0, top - 1), 18, 18, 0, 0, 18, 18); TRAINERS.cache[key] = f; return f;
}
// A trainer's bust for commander cards: a 48×48 crop around the head and shoulders, mirrored to face left. Cached.
function trainerBust(tr, flip) {
  const key = 'bust:' + tr + (flip ? 'f' : ''); if (TRAINERS.cache[key]) return TRAINERS.cache[key]; const img = trainerImg(tr); if (!img) return null;
  const [cx, top] = TRAINER_HEADS[tr] || [40, 6], c = document.createElement('canvas'); c.width = 48; c.height = 48; const g = c.getContext('2d'); if (flip) { g.translate(48, 0); g.scale(-1, 1); }
  const sx = clamp(cx - 24, 0, 32), sy = clamp(top - 3, 0, 32); g.drawImage(img, sx, sy, 48, 48, 0, 0, 48, 48); TRAINERS.cache[key] = c; return c;
}
// A commander card, Advance Wars style: the trainer's bust over bands of their colour, the name on a strip below;
// side 1 faces left. Tapping it runs `run` (cycling the choice on setup screens).
function coCard(x, y, w, h, id, side, run, opt = {}) {
  const co = opt.as || COS[id] || COS.you, col = opt.col || co.col, t = SC.t; trainerImg(co.tr); // opt.as: any trainer { tr, name, col }
  rrect(x, y, w, h, opt.hot ? UI.gold : UI.inset, 2); ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip();
  rect(x + 1, y + 1, w - 2, h - 2, shade(col, -.62)); ctx.fillStyle = shade(col, -.35); const drift = REDUCED ? 0 : Math.floor(t * 8) % 12;
  for (let k = -h - 12 + (side ? -drift : drift); k < w + 12; k += 12) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.lineTo(x + k + h + 5, y); ctx.lineTo(x + k + 5, y + h); ctx.fill(); }
  const bust = trainerBust(co.tr, side === 1), by = y + h - 10 - 48 + (opt.pop ? Math.round((1 - easeOutBack(clamp(opt.pop / .25, 0, 1), 2)) * 10) : 0);
  if (bust) { ctx.globalAlpha = .5; ctx.drawImage(bust, x + Math.round((w - 48) / 2) + (side ? 2 : -2), by + 1); ctx.globalAlpha = 1; ctx.drawImage(bust, x + Math.round((w - 48) / 2), by); }
  ctx.restore(); rect(x + 1, y + h - 10, w - 2, 9, '#07061ae0'); hline(x + 1, y + h - 11, w - 2, col);
  textC(fitLabel(id === 'you' && !opt.as ? 'TACTICIAN' : co.name.toUpperCase(), w - 6), x + w / 2, y + h - 9, opt.hot ? UI.gold : '#ffffff');
  if (opt.tag) { const tw = textWidth(opt.tag) + 6, tx = side ? x + w - tw - 2 : x + 2; rrect(tx, y + 2, tw, 9, side ? teamColorD(1) : teamColorD(0), 1); text(opt.tag, tx + 3, y + 3, '#ffffff'); }
  if (run) hit(x, y, w, h, run, opt.label || (side ? 'FOE CO' : 'YOUR CO'));
}
// A line's text with its *emphasis* resolved: the plain text and which letters to colour.
function richLine(line) { if (line._rich) return line._rich; const em = []; let plain = '', on = false; for (const c of line.text) { if (c === '*') { on = !on; continue; } if (on) em[plain.length] = true; plain += c; } return (line._rich = { plain, em }); }
// opt.stage: draws the scene behind the dialogue when there is no battle board (the prologue)
function startDialog(lines, done, opt = {}) { for (const l of lines) { const Sp = SPEAKERS[l.who]; if (Sp && Sp.tr) trainerImg(Sp.tr); } SC.dialog = { lines, i: 0, chars: 0, t: 0, T: 0, pause: 0, done, cast: [null, null], since: [0, 0], stage: opt.stage || null }; goScene('story'); }
function storyUpdate(dt) {
  const d = SC.dialog; if (!d) return; d.t += dt; d.T += dt; const line = d.lines[d.i], R = richLine(line), S = speakerOf(line), total = R.plain.length;
  if (d.cast[S.side] !== line.who) { d.cast[S.side] = line.who; d.since[S.side] = d.T; if (d.T > .1) Audio.sfx('whoosh'); }
  // the text types out, pausing after a sentence and briefly after a comma, the speaker's voice on every other letter
  if (d.pause > 0) d.pause -= dt;
  else if (d.chars < total) { const before = Math.floor(d.chars); d.chars = Math.min(total, d.chars + dt * 48); const now = Math.floor(d.chars);
    if (now !== before) { const c = R.plain[now - 1]; if ('.!?'.includes(c) && R.plain[now] === ' ') d.pause = .2; else if (c === ',' || c === ':') d.pause = .08; if (now % 2 === 0 && c !== ' ') Audio.voice(S.voice, S.cry); } }
  if (d.stage || !B) { Audio.tick(); BT.time += dt; return; }
  CAM.x += (CAM.tx - CAM.x) * Math.min(1, dt * 6); CAM.y += (CAM.ty - CAM.y) * Math.min(1, dt * 6); for (const u of B.units) { u.fx.sx += (1 - u.fx.sx) * dt * 10; u.fx.sy += (1 - u.fx.sy) * dt * 10; } updateFX(dt); Audio.tick(); BT.time += dt;
}
// One speaker on their side, behind the box (the box hides their legs): they slide in when they first speak, bob while
// talking, jump on a shout and darken while they listen. A Pokémon speaker glows in its colour.
function drawSpeaker(who, side, active, since, d, line, sc, box) {
  const Sp = SPEAKERS[who] || (active ? speakerOf(line) : null); if (!Sp) return; const size = 80 * sc, t = d.t;
  const enter = REDUCED ? 1 : easeOutBack(clamp(since / .3, 0, 1), 1.5), talking = active && d.chars < richLine(line).plain.length;
  const x0 = side === 0 ? box.x + 2 : box.x + box.w - 2 - size, slide = Math.round((1 - enter) * (side === 0 ? -size : size) * .7);
  const bob = talking && !REDUCED ? Math.round(Math.abs(Math.sin(t * 12)) * sc) : 0, shout = active && line.text.trim().endsWith('!') && t < .3 && !REDUCED ? Math.round(Math.sin(t * 70) * 2 * sc) : 0;
  const y0 = Math.round(box.y + box.h * .55 - size + (active ? 0 : 3 * sc) - bob - (shout ? Math.abs(shout) : 0));
  if (Sp.tr) { const img = trainerCanvas(Sp.tr, side === 1, !active); if (img) { if (active && !REDUCED) { ctx.globalAlpha = .18; ellipse(Math.round(x0 + slide + size / 2), Math.round(box.y + 2), Math.round(size * .42), Math.round(10 * sc), Sp.col); ctx.globalAlpha = 1; } ctx.drawImage(img, x0 + slide + shout, y0, size, size); return; } }
  const num = Sp.mon || line.mon; if (!num) return; requestAnim(num); requestBigSprite(num); const cx = x0 + slide + size / 2, by = box.y + Math.round(box.h * .5);
  if (Sp.cry && !REDUCED) { const r = Math.round(size * .42 + Math.sin(t * 4) * 3 * sc), ay = by - Math.round(size * .45); ctx.globalAlpha = .22; circle(cx, ay, r, Sp.col); ctx.globalAlpha = .12; circle(cx, ay, r + 6 * sc, Sp.col); ctx.globalAlpha = 1; }
  if (!active) ctx.globalAlpha = .55; if (animReady(num)) drawAnim(num, cx + shout, by - bob, BT.time, { flip: side === 0, sx: sc, sy: sc }); else if (bigReady(num)) drawBig(num, cx + shout, by + 8 - bob, { flip: side === 0, sx: sc, sy: sc }); else drawMon(num, cx, by - bob, { flip: side === 0, sx: sc, sy: sc }); ctx.globalAlpha = 1;
}
function storyDraw() {
  const d = SC.dialog; if (d && d.stage) d.stage(d); else battleDraw(); if (!d) return; const W = VIEW.w, H = VIEW.h, line = d.lines[d.i], t = d.t, R = richLine(line), S = speakerOf(line), wide = W >= 480 && H >= 280, sc = wide ? 2 : 1;
  // cinematic: the board dims and black bars close in from the top and the bottom
  const intro = REDUCED ? 1 : easeOut(clamp(d.T / .3, 0, 1)); ctx.globalAlpha = .3 * intro; rect(0, 0, W, H, '#05041a'); ctx.globalAlpha = 1; const bar = Math.round((wide ? 14 : 8) * intro); rect(0, 0, W, bar, '#000000'); rect(0, H - bar, W, bar, '#000000');
  const bh = wide ? 64 : 62, rise = REDUCED ? 0 : Math.round((1 - easeOutBack(clamp(appear('story') / .3, 0, 1), 2)) * 30), box = { x: 6, y: H - bar - bh - 4 + rise, w: W - 12, h: bh };
  for (const side of [0, 1]) if (d.cast[side]) drawSpeaker(d.cast[side], side, d.cast[side] === line.who, d.T - d.since[side], d, line, sc, box);
  panel(box.x, box.y, box.w, box.h, { fill: '#1a1f4e' }); rect(box.x + 3, box.y + box.h - 14, box.w - 6, 11, '#171b44');
  const bandX = S.side === 0 ? box.x + 3 : box.x + box.w - 6; rect(bandX, box.y + 3, 3, box.h - 6, S.col); rect(S.side === 0 ? bandX + 3 : bandX - 1, box.y + 3, 1, box.h - 6, shade(S.col, -.45)); // the speaker's colour down their side
  // the name on a ribbon in the speaker's colour, beside their portrait
  const size = 80 * sc, nameW = textWidth(line.who || '') + 12, nx = S.side === 0 ? box.x + Math.min(size + 2, box.w * .4) : box.x + box.w - Math.min(size + 2, box.w * .4) - nameW; if (line.who) ribbonTab(line.who, nx, box.y - 9, S.col);
  // the text, typed out, with *emphasis* in gold riding a little wave
  const tx = box.x + 12, tw = box.w - 26, lines = wrap(R.plain, tw); let shown = Math.floor(d.chars), gi = 0;
  lines.forEach((l, li) => { let cx = tx; const y = box.y + 12 + li * 12; for (let i = 0; i < l.length; i++, gi++) { if (gi >= shown) return; const c = l[i], em = R.em[gi], fresh = !REDUCED && shown - gi <= 2 && shown < R.plain.length ? -1 : 0; if (c !== ' ') text(c, cx, y + fresh + (em && !REDUCED ? Math.round(Math.sin(t * 7 + gi * .6)) : 0), em ? UI.gold : UI.ink, em ? { outline: '#3a2000' } : { shadow: '#0a0c26' }); cx += c === ' ' ? 3 : glyph(c, FONT).w + 1; } gi++; });
  if (d.chars >= R.plain.length) { const ax = box.x + box.w - 12, ay = box.y + box.h - 11 + (REDUCED ? 0 : Math.round(Math.abs(Math.sin(t * 6)) * 2)); if (d.i < d.lines.length - 1) { rect(ax - 3, ay, 7, 1, UI.gold); rect(ax - 2, ay + 1, 5, 1, UI.gold); rect(ax - 1, ay + 2, 3, 1, UI.gold); px(ax, ay + 3, UI.gold); } else { rect(ax - 2, ay, 5, 5, UI.gold); rect(ax - 1, ay + 1, 3, 3, '#fff2b0'); } }
  const hint = [(d.i + 1) + ' / ' + d.lines.length, ['X', 'skip']], hw = hintWidth(hint), nameR = line.who ? nx + nameW : -1, nameL = line.who ? nx : 1e9;
  if (S.side === 0 && box.x + box.w - 4 - hw > nameR + 4) hintLine(hint, box.x + box.w - 4, box.y - 12, { right: true }); else if (S.side === 1 && box.x + 8 + hw < nameL - 4) hintLine(hint, box.x + 8, box.y - 12, { left: true }); else textR((d.i + 1) + '/' + d.lines.length, box.x + box.w - 20, box.y + box.h - 11, UI.muted);
  // focus the camera on the speaker's Pokémon if it is on the board
  const spk = !d.stage && B && B.units.find(u => u.num === line.mon && u.hp > 0); if (spk && !d.focused) { d.focused = true; centerCam(spk.x, spk.y); spk.fx.sy = .8; spk.fx.sx = 1.2; }
}
function storyInput(ev) { const d = SC.dialog; if (!d) return; if (ev.type === 'key' && ev.key === 'back') { finishDialog(); return; } if (ev.type === 'up' || (ev.type === 'key' && ev.key === 'ok')) { const line = d.lines[d.i]; if (d.chars < richLine(line).plain.length) { d.chars = richLine(line).plain.length; d.pause = 0; return; } d.i++; d.chars = 0; d.t = 0; d.pause = 0; d.focused = false; Audio.sfx('ok'); if (d.i >= d.lines.length) finishDialog(); } }
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
  screenTitle((ch.num ? 'FRONT ' + ch.num + ' · ' : '') + ch.title.toUpperCase(), H >= 240 && !L.narrow ? objectiveTextFor(ch.map.objective) : null, 4);
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
    if (p.loaner && bx + 28 <= x + L.cw - 4) textR('LOAN', x + L.cw - 5, y + 14 + lift, UI.info);
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
  const nRew = R.rewards ? Object.keys(R.rewards).length : 0, nC = R.caught ? R.caught.length : 0, nT = R.trained ? Math.min(6, R.trained.length) : 0, nE = R.evolved ? R.evolved.length : 0, nCo = R.newCos ? R.newCos.length : 0, stars = win && R.stars != null;
  const lose = wrap('The team limps back to the Poké Center. Everyone is fine. Mostly.', w - 16);
  const ph = 36 + (stars ? 30 : 0) + (win ? 10 : (lose.length - 1) * 9) + (nRew ? 14 + Math.ceil(nRew / rc) * 10 : (win && !R.skirmish ? 12 : 0)) + (nC ? 14 + Math.ceil(nC / cc) * 26 : 0) + (nT ? 12 + nT * 9 : 0) + nE * 9 + (nCo ? 12 + nCo * 22 : 0) + (R.war ? 11 : 0) + 8;
  const phh = Math.min(H - 44, Math.max(60, ph)); y = Math.max(8, Math.round((H - 30 - phh) / 2));
  const tok = unfold('results', x, y, w, phh, .25);
  const p = panel(x, y, w, phh, { header: win ? (R.skirmish ? 'SKIRMISH WON!' : 'FRONT CLEARED!') : 'RETREAT', headerRight: stars && R.stars > (R.best || 0) && !R.skirmish ? 'NEW BEST' : null, headerRightCol: UI.gold, headerFill: win ? '#2a2470' : '#4a1626' });
  y = p.cy;
  if (stars) { // three stars pop in one after another, then the goals they stand for
    for (let s2 = 0; s2 < 3; s2++) { const t0 = appear('res:star' + s2) - .25 - s2 * .3, u = clamp(t0 / .25, 0, 1), on = s2 < R.stars && u > 0, sc = on ? 1 + Math.round((1 - easeOutBack(u, 3)) * 1.5) : 1; drawBigStar(x + w / 2 + (s2 - 1) * 20, y + 7, sc, on); if (u > 0 && CLOCK.frame && (R.starSfx || 0) <= s2) { R.starSfx = s2 + 1; Audio.sfx(s2 < R.stars ? 'chime' : 'tick'); } }
    y += 18; textC('win  ·  ' + (R.turns <= (R.par || 10) ? 'under par' : 'over par') + '  ·  ' + (R.faints ? R.faints + ' fainted' : 'nobody fainted'), x + w / 2, y, UI.muted); y += 12;
  }
  if (win) { const tv = countUp('res:turns', R.turns, .5, .2), kv = countUp('res:kos', R.kills, .5, .35); text('Turns ' + tv + (R.par ? ' / par ' + R.par : ''), x + 8, y, R.par && R.turns <= R.par ? UI.green : UI.ink); textR('KOs ' + kv, x + w - 8, y, UI.ink); y += 12; }
  if (R.war) { text(fitLabel('Captured ' + R.war.captures + ' · deployed ' + R.war.deployments + ' · left ' + money(R.war.funds) + (R.war.reason ? ' · ' + R.war.reason : ''), w - 16), x + 8, y, UI.info); y += 11; }
  else { lose.forEach(l => { text(l, x + 8, y, UI.ink); y += 9; }); y += 3; }
  if (nRew) { sectionLabel('Rewards', x + 8, y, w - 16, UI.gold); y += 10; let i = 0; for (const k in R.rewards) { const cx = x + 10 + (i % rc) * 96; const cy = y + Math.floor(i / rc) * 10; drawBall(cx + 4, cy + 4, (ITEMS[k] || ITEMS.pokeball).col, 3); text((ITEMS[k] || ITEMS.pokeball).name + ' ×' + countUp('res:rew' + k, R.rewards[k], .4, .6), cx + 12, cy + 1, UI.ink); i++; } y += Math.ceil(i / rc) * 10 + 4; }
  else if (win && !R.skirmish) { text('Replay: rewards come with the first clear', x + 8, y, UI.dim); y += 12; }
  if (nC) { sectionLabel('New team members', x + 8, y, w - 16, UI.gold); y += 10; R.caught.forEach((c, i) => { const cx = x + 10 + (i % cc) * 70; const cy = y + Math.floor(i / cc) * 26; drawMon(c.num, cx + 16, cy + 22 + Math.round(Math.abs(Math.sin(SC.t * 6 + i)) * -3), { outline: teamColor(0) }); text(DEX[c.num].name, cx + 32, cy + 6, UI.ink); text('Lv' + c.level, cx + 32, cy + 14, UI.gold); }); y += Math.ceil(R.caught.length / cc) * 26 + 4; }
  if (R.trained && R.trained.length) { sectionLabel('Training at the Center', x + 8, y, w - 16, UI.gold); y += 10; R.trained.forEach((t, i) => { if (i > 5) return; let s2 = t; while (textWidth(s2) > w - 20 && s2.length > 8) s2 = s2.slice(0, -1); text(s2, x + 10, y, '#98d8f8'); y += 9; }); y += 2; }
  if (R.evolved && R.evolved.length) { R.evolved.forEach(e => { let s2 = e; while (textWidth(s2) > w - 20 && s2.length > 8) s2 = s2.slice(0, -1); text(s2, x + 10, y, UI.gold); y += 9; }); }
  if (nCo) { sectionLabel(nCo > 1 ? 'New commanders' : 'New commander', x + 8, y + 2, w - 16, UI.gold); y += 12; R.newCos.forEach((id, i) => { const co = COS[id], face = trainerFace(co.tr), a = clamp((appear('res:co' + i) - .6 - i * .2) / .25, 0, 1); if (a <= 0) { y += 22; return; } ctx.globalAlpha = a;
      rect(x + 10, y, 20, 20, shade(co.col, -.4)); if (face) ctx.drawImage(face, x + 11, y + 1); outline(x + 9, y - 1, 22, 22, co.col); text(co.name.toUpperCase() + ' JOINS YOU!', x + 36, y + 2, co.col, { outline: UI.inset }); text(fitLabel(co.passive.text, w - 48), x + 36, y + 11, UI.muted); ctx.globalAlpha = 1;
      if (!R['coSfx' + i] && a > 0) { R['coSfx' + i] = true; Audio.sfx('levelup'); } y += 22; }); }
  unfoldEnd(tok);
  { const fy = footerBand(30) + 6; if (R.route) { const bw = Math.min(100, Math.floor((W - 18) / 2)); bigButton(W / 2 - bw - 4, fy, bw, 18, 'ROUTE', () => { Audio.sfx('cancel'); R.route(); }, { variant: 'ghost' }); bigButton(W / 2 + 4, fy, bw, 18, R.nextLabel || 'CONTINUE', () => { Audio.sfx('ok'); R.next(); }, { variant: 'primary' }); } else bigButton(W / 2 - 50, fy, 100, 18, R.nextLabel || 'CONTINUE', () => { Audio.sfx('ok'); R.next(); }, { variant: 'primary' }); }
}
function resultsInput(ev) { if (ev.type === 'key' && (ev.key === 'ok' || ev.key === 'back')) { Audio.sfx('ok'); SC.data.next(); return; } if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); } }

// ---------------------------------------------------------------- credits
// The end of the journey: the title's dusk landscape with your own team on the knoll, fireworks over the lake, the credits
// rising through the sky, and the wordmark dropping in letter by letter at the end.
function creditsDraw() {
  const W = VIEW.w, H = VIEW.h, t = SC.t, party = (SC.data && SC.data.party || []).slice(0, 6); SC.titleFx = SC.titleFx || { particles: [], hop: [], landed: {} };
  const L = titleLayout(3); if (party.length) { L.team = party.map(p => p.num); L.teamGap = Math.min(L.teamGap, Math.floor((L.portrait ? W - 30 : W * .4) / Math.max(1, party.length - 1))); L.teamX = Math.round(Math.min(L.knollX - L.teamGap * (party.length - 1) / 2, W - 26 - L.teamGap * (party.length - 1))); }
  if (!REDUCED && Math.floor(t * 1.4) !== Math.floor((t - (CLOCK.dt || .016)) * 1.4)) { const i = Math.floor(t * 1.4); SC.titleFx.hop[i % Math.max(1, L.team.length)] = SC.t + .45; }
  titleScene(L);
  ctx.globalAlpha = .45; rect(0, 0, W, Math.round(L.horizon * .9), '#07051c'); ctx.globalAlpha = 1;
  // fireworks
  if (!REDUCED && Math.random() < .045) { const fx0 = W * (.15 + Math.random() * .7), fy = L.horizon * (.15 + Math.random() * .45), cols = [['#ffd24a', '#ffffff'], ['#ff6a8a', '#ffd0e0'], ['#6ab0ff', '#e0f0ff'], ['#62e58d', '#e8ffe8']][Math.floor(Math.random() * 4)]; spawnParts(fx0, fy, 30, cols, { speed: 70, life: 1.2, grav: 22, size: 2 }); spawnSprite('burst', fx0, fy, { size: 16, life: .45, col: cols[0] }); spawnSprite('flash', fx0, fy, { size: 6, life: .25, col: cols[1] }); Audio.sfx('boom'); }
  updateFX(CLOCK.dt || 1 / 60); drawFX(0, 0);
  // the credits rise through the sky
  const stars = SAVE && SAVE.rating ? Object.values(SAVE.rating).reduce((a, b) => a + b, 0) : 0;
  const lines = [['KANTO IS FREE!', UI.gold, true], ['', UI.ink], [party.length + ' Pokémon fought beside you.', UI.ink], ['Stars earned: ' + stars + ' / ' + CHAPTERS.length * 3, UI.gold], ['', UI.ink], ['Every Gym Leader now commands for you.', UI.muted], ['Climb the Battle Tower, race Blue', UI.muted], ['in the Safari Zone, or replay a front.', UI.muted], ['', UI.ink], ['Sprites: Pokémon Showdown icons', UI.muted], ['and trainers, PokeAPI Black/White', UI.muted], ['Pokémon © Nintendo / Game Freak / Creatures', UI.muted], ['Made with pixels and WebAudio', UI.muted], ['', UI.ink], ['THANK YOU FOR PLAYING', UI.gold, true]];
  const top = L.horizon * .9, y0 = top - 8 - (t - .3) * 18; lines.forEach(([l, col, big], i) => { const y = y0 + i * 14; if (y < 4 || y > top - 8) return; ctx.globalAlpha = clamp(Math.min(y - 4, top - 8 - y) / 16, 0, 1); if (big) bigC(l, W / 2, y, col, { outline: UI.inset }); else textC(l, W / 2, y, col, { outline: UI.inset }); ctx.globalAlpha = 1; });
  // the wordmark lands once the credits have passed
  const endAt = .3 + (top - 12 + (lines.length - 1) * 14) / 18 + .6; if (t > endAt) { const saved = SC.t; SC.t = t - endAt; const cell = logoCell(W, H, W - 24); drawLogo(W / 2, Math.max(8, Math.round(top * .25)), cell); SC.t = saved; if (t > endAt + 1.6) { ctx.globalAlpha = clamp((t - endAt - 1.6) / .5, 0, 1); bigC('THE END', W / 2, Math.round(top * .25) + logoMetrics(cell).h + 8, UI.ink, { outline: UI.inset }); ctx.globalAlpha = 1; } }
  if (t > endAt + 2.4 || (t > 4 && SC.skip)) goScene('title');
  else if (t > 3) hintLine(VIEW.touch ? ['tap to skip'] : [['Z', 'skip']], W / 2, H - 14);
}
function creditsInput(ev) { if (ev.type === 'up' || ev.type === 'key') SC.skip = true; }

// ---------------------------------------------------------------- quick battle: pick a mode against the CPU
const QUICK_MODES = [
  { id: 'skirmish', label: 'SKIRMISH', tag: 'HQ vs HQ', lines: ['A random battlefield.', 'Earn funds, deploy your Box,', 'catch wild Pokémon mid-war.'], goal: 'Rout them or take their HQ', run: () => startSkirmishSetup() },
  { id: 'conquest', label: 'CONQUEST', tag: 'CENTERS', lines: ['Three bridges, six teammates.', 'Capture centers to earn points', 'and call reserves.'], goal: 'Take the HQ or hold 2 centers', run: () => startTerritorySetup() },
  { id: 'tower', label: 'BATTLE TOWER', tag: 'RANKED', lines: ['Ten floors, a commander on each.', 'Rental armies, equal terms:', 'climb for an S rank.'], goal: 'Rank S on every floor', run: () => startTower() },
  { id: 'safari', label: 'SAFARI ZONE', tag: 'CATCH RACE', lines: ['Eight days, twelve Safari Balls.', 'Weaken, never knock out:', 'rare ones score more.'], goal: 'Out-catch Blue', run: () => startSafari() },
];
function quickPreview(m) { const S = SC.data || (SC.data = {}); if (!S[m.id]) S[m.id] = makeBackdrop(m.id === 'conquest' ? TERRITORY_MAP : m.id === 'tower' ? towerMap(4) : m.id === 'safari' ? safariMap(21, 16) : skirmishMap(412, 16, 11, 12)); return S[m.id]; }
function quickCols() { return narrowView() || portraitView() ? 1 : 2; }
function quickDraw() {
  const W = VIEW.w, H = VIEW.h, narrow = narrowView() || portraitView(), bh = btnH(); rect(0, 0, W, H, UI.bg); SC.hits = [];
  const bd = quickPreview(QUICK_MODES[SC.i]); drawBackdrop(bd, (W - bd.canvas.width) / 2 - SC.t * 5, (H - bd.canvas.height) / 2, .78);
  const top = screenTitle('QUICK BATTLE', 'Battle the CPU · four ways to play', 5);
  const foot = footerBand(bh + 12), gap = narrow ? 5 : 8, n = QUICK_MODES.length, cols = quickCols(), rows = Math.ceil(n / cols);
  const cw = narrow ? W - 16 : Math.min(230, Math.floor((W - 24 - gap) / 2)), ch = Math.min(narrow ? 999 : 150, Math.floor((foot - top - 8 - gap * (rows - 1)) / rows));
  const x0 = narrow ? 8 : Math.round(W / 2 - (cw * 2 + gap) / 2), y0 = top + Math.max(4, Math.round((foot - top - (ch * rows + gap * (rows - 1))) / 2) - 2);
  QUICK_MODES.forEach((m, i) => {
    const sel = SC.i === i, x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap), lift = sel && !REDUCED ? -2 : 0;
    const tok = unfold('quick' + i, x, y, cw, ch, .22 + i * .06);
    const p = panel(x, y + lift, cw, ch, { header: m.label, headerRight: m.tag, headerRightCol: sel ? UI.gold : UI.muted, fill: sel ? UI.panel2 : UI.panel, border: sel ? UI.gold : UI.border });
    const pv = quickPreview(m), room = ch - (narrow ? 66 : 70), sc = Math.min((cw - 16) / pv.canvas.width, room / pv.canvas.height);
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
  if (ev.type === 'key') { const n = QUICK_MODES.length, cols = quickCols(); if (['left', 'right', 'up', 'down'].includes(ev.key)) { const d = ev.key === 'left' ? -1 : ev.key === 'right' ? 1 : ev.key === 'up' ? -cols : cols; SC.i = (SC.i + d + n) % n; Audio.sfx('cursor'); } else if (ev.key === 'ok') quickGo(); else if (ev.key === 'back') { Audio.sfx('cancel'); goScene('title'); } else if (ev.key === 'mute') Audio.toggle(); return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- skirmish setup
// Skirmish setup: the battlefield framed on the left (a dice rolls another) with both HQs, the centers and the foe's
// squad; on the right the two commanders face each other over the rules. Arrows pick a row, ◂▸ change it.
const SK_RULES = [
  { k: 'co', label: 'YOU', vals: S => S.cos, show: v => v === 'you' ? 'Tactician' : COS[v].name },
  { k: 'foe', label: 'FOE', vals: CO_FOES, show: v => COS[v].name },
  { k: 'level', label: 'LEVEL', vals: SKIRMISH.levels, show: v => 'Lv ' + v },
  { k: 'funds', label: 'FUNDS', vals: SKIRMISH.funds, show: v => money(v) + ' each' },
  { k: 'weather', label: 'WEATHER', vals: SKIRMISH.weather, show: v => v === 'none' ? 'Clear' : v === 'random' ? 'Random' : WEATHER[v].name },
  { k: 'biome', label: 'LAND', vals: SKIRMISH.biomes, show: (v, S) => v === 'random' ? 'Random · ' + BIOMES[skirmishBiome(S)].name : BIOMES[v].name },
  { k: 'seed', label: 'MAP', vals: null, show: v => '#' + v },
];
function skirmishRoot() { return typeof SAVE !== 'undefined' && SAVE && SAVE.starter && !(SC.data && SC.data.preset) ? SAVE.starter : 4; }
// The battlefield in miniature: deploy tiles, each property under its owner's colour (HQs flagged), every Pokémon.
function drawWarPreview(map, bd, px0, py0, pw, ph, centers = -1) {
  const cell = pw / bd.canvas.width * TILE, c = Math.max(3, Math.ceil(cell)), owners = (map.war && map.war.owners) || {}, W = bd.map.w;
  for (const d of map.deploy) { const ux = Math.round(px0 + d.x * cell), uy = Math.round(py0 + d.y * cell); ctx.globalAlpha = .22; rect(ux, uy, c, c, '#8ab4ff'); ctx.globalAlpha = .8; outline(ux + 1, uy + 1, c - 2, c - 2, teamColor(0)); ctx.globalAlpha = 1; }
  map.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (!PROP_KIND[ch]) continue; const k = x + ',' + y, owner = owners[k] != null ? owners[k] : ch === 'Q' ? (x < W / 2 ? 0 : 1) : centers, col = owner < 0 ? '#d8d8e8' : teamColor(owner);
    const ux = Math.round(px0 + x * cell), uy = Math.round(py0 + y * cell); outline(ux, uy, c, c, col); outline(ux + 1, uy + 1, c - 2, c - 2, UI.inset);
    if (ch === 'Q') { const fx = ux + Math.round(c / 2), fy = uy - 5; vline(fx, fy, 7, '#e8e0d0'); rect(fx + 1, fy, 4, 3, col); } } });
  for (const u of map.units) { const d = DEX[u.mon], ux = px0 + (u.x + .5) * cell, uy = py0 + (u.y + 1) * cell, iw = Math.max(12, Math.round(cell * 1.1)); ellipse(Math.round(ux), Math.round(uy), Math.round(iw / 3), 2, teamColor(u.team == null ? 1 : u.team)); ctx.drawImage(monIcon(d.num, true), Math.round(ux - iw / 2), Math.round(uy - iw * .75), iw, Math.round(iw * .75)); }
}
function skirmishDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data, t = SC.t; rect(0, 0, W, H, UI.bg);
  const mapKey = [S.seed, S.level, S.foe, S.biome].join('|'); if (!S.bd || S.bdKey !== mapKey) { S.map = skirmishMap(S.seed, 16, 11, S.level, { foe: S.foe, biome: skirmishBiome(S) }); S.bd = makeBackdrop(S.map); if (S.bdKey && S.bdKey.split('|')[0] !== String(S.seed)) S.rolledAt = SC.t; S.bdKey = mapKey; }
  drawBackdrop(S.bd, (W - S.bd.canvas.width) / 2 + 40 - t * 4, (H - S.bd.canvas.height) / 2 + 30, .84); drawCloudShadows(t);
  const narrow = narrowView() || portraitView(), bh = btnH(); SC.hits = []; S.focus = clamp(S.focus || 0, 0, SK_RULES.length - 1);
  const top = screenTitle('SKIRMISH', narrow ? null : 'Random battlefield · rout the foe or take their HQ', 4), foot = footerBand(bh + 12), fy = foot + 6;
  const rh = narrow ? 16 : 14, cardH = narrow ? 58 : clamp(foot - top - 8 - 22 - SK_RULES.length * rh - 40, 50, 66), sideH = 22 + cardH + 14 + SK_RULES.length * rh + 28;
  const sideW = narrow ? W - 12 : Math.min(190, Math.floor(W * .36)), mapW = narrow ? W - 12 : W - 18 - sideW, mapH = narrow ? Math.max(60, foot - 8 - top - sideH) : foot - 10 - top;
  // the map, framed, with a dice to reroll it; it shakes when rolled
  const sc = Math.min((mapW - 8) / S.bd.canvas.width, (mapH - 8) / S.bd.canvas.height), pw = Math.floor(S.bd.canvas.width * sc), ph = Math.floor(S.bd.canvas.height * sc), px0 = 6 + Math.floor((mapW - pw) / 2), py0 = top + 2 + Math.floor((mapH - ph) / 2);
  const k = clamp((t - (S.rolledAt || -9)) / .3, 0, 1), shake = REDUCED ? 0 : Math.round(Math.sin(k * Math.PI * 3) * 2 * (1 - k));
  rrect(px0 - 5, py0 - 5 + shake, pw + 10, ph + 10, UI.inset, 2); rect(px0 - 3, py0 - 3 + shake, pw + 6, ph + 6, UI.border2); ctx.drawImage(S.bd.canvas, px0, py0 + shake, pw, ph); outline(px0 - 1, py0 - 1 + shake, pw + 2, ph + 2, UI.border);
  if (S.weather !== 'none' && S.weather !== 'random' && !REDUCED) { ctx.save(); ctx.beginPath(); ctx.rect(px0, py0 + shake, pw, ph); ctx.clip(); ctx.translate(px0, py0 + shake); drawWeather(S.weather, pw, ph, t); ctx.restore(); }
  drawWarPreview(S.map, S.bd, px0, py0 + shake, pw, ph);
  const dz = 18; bigButton(px0 + pw - dz - 2, py0 + 3 + shake, dz, dz, '', () => { S.seed = (S.seed + 1 + Math.floor(Math.random() * 97)) % 1000; Audio.sfx('shake'); }, { small: true, variant: 'dark', icon: 'dice' }); SC.hits[SC.hits.length - 1].label = 'REROLL';
  { const nw = textWidth(S.map.name) + 8; ctx.globalAlpha = .8; rrect(px0 + 3, py0 + ph - 14 + shake, nw, 11, UI.inset, 2); ctx.globalAlpha = 1; text(S.map.name, px0 + 7, py0 + ph - 12 + shake, UI.ink); }
  // the commanders face to face, then the rules
  const sx = narrow ? 6 : 12 + mapW, sy = narrow ? top + mapH + 4 : top + 2, pnl = panel(sx, sy, sideW, Math.min(foot - 6 - sy, sideH), { header: 'COMMANDERS', headerRight: S.preset ? 'loaner team' : null, headerRightCol: UI.muted });
  let y = pnl.cy; const cw = Math.floor((sideW - 30) / 2), cycle = (k, dir) => vsCycle(S, SK_RULES.find(r => r.k === k), dir);
  coCard(sx + 6, y, cw, cardH, S.co, 0, () => { S.focus = 0; cycle('co', 1); S.coAt = SC.t; }, { hot: S.focus === 0, tag: 'YOU', pop: SC.t - (S.coAt || -9), col: S.co === 'you' ? CAPTAINS[skirmishRoot()].col : null });
  coCard(sx + sideW - 6 - cw, y, cw, cardH, S.foe, 1, () => { S.focus = 1; cycle('foe', 1); S.foeAt = SC.t; }, { hot: S.focus === 1, tag: 'FOE', pop: SC.t - (S.foeAt || -9) });
  { const vx = sx + sideW / 2, vy = y + Math.round(cardH / 2) - 6, pulse = REDUCED ? 0 : Math.round(Math.sin(t * 5)); circle(Math.round(vx), vy + 5, 9 + pulse, UI.inset); circle(Math.round(vx), vy + 5, 8 + pulse, '#2a1646'); bigC('VS', vx, vy + 1, UI.gold, { shadow: '#000' }); }
  y += cardH + 3; { const a = coOf({ co: S.co, root: skirmishRoot() }), b = coOf({ co: S.foe }); text(fitLabel(a.power.name, cw), sx + 6, y, UI.info); textR(fitLabel(b.power.name, cw), sx + sideW - 6, y, UI.info); } y += 11;
  vsRuleRows(S, sx + 4, y, sideW - 8, rh, SK_RULES, S.focus); y += SK_RULES.length * rh + 4;
  if (y + 18 <= pnl.y + pnl.h) { const box = SKIRMISH.slots, rest = Math.max(SKIRMISH.slots + SKIRMISH.box, S.party.length) - box; text(fitLabel('You: ' + box + ' on the map · ' + rest + ' in the Box', sideW - 12), sx + 6, y, UI.muted); text(fitLabel(COS[S.foe].name + ': squad + Ace · 8 in the Box', sideW - 12), sx + 6, y + 9, UI.muted); }
  bigButton(W - 96, fy, 90, bh, 'PREPARE', () => { Audio.sfx('select'); S.go(); }, { variant: 'primary' }); bigButton(6, fy, 70, bh, 'BACK', () => { Audio.sfx('cancel'); goScene('quick'); }, { variant: 'ghost' });
  if (!narrow && W > 360) hintLine([['▲▼', 'rule'], ['◂▸', 'change'], ['Z', 'prepare']], W / 2, fy + (bh - 7) / 2, { pill: false });
}
function skirmishInput(ev) {
  const S = SC.data; if (ev.type === 'key') { const n = SK_RULES.length; S.focus = S.focus || 0;
    if (ev.key === 'up') { S.focus = (S.focus + n - 1) % n; Audio.sfx('cursor'); } else if (ev.key === 'down') { S.focus = (S.focus + 1) % n; Audio.sfx('cursor'); }
    else if (ev.key === 'left' || ev.key === 'right') { const rule = SK_RULES[S.focus]; vsCycle(S, rule, ev.key === 'left' ? -1 : 1); if (rule.k === 'co') S.coAt = SC.t; if (rule.k === 'foe') S.foeAt = SC.t; }
    else if (ev.key === 'ok' || ev.key === 'next') { Audio.sfx('select'); S.go(); } else if (ev.key === 'back') { Audio.sfx('cancel'); goScene('quick'); } else if (ev.key === 'mute') Audio.toggle(); return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}
