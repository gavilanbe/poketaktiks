// ============================================================================
// route.js — the campaign route map: an overworld built from the board's own tiles, the eight chapters as stops on
// one road, stars per chapter, the captain walking between stops, and the reveal that opens the next stretch of road.
// ============================================================================
'use strict';
const ROUTE_W = 24, ROUTE_H = 13;
// One stop per chapter (tile coordinates) and the road that leads from each stop to the next (waypoints, walked in
// straight lines). Stars: 1 for the win, 1 for winning within par, 1 when no Pokémon of yours fainted.
const ROUTE_NODES = [{ x: 2, y: 10 }, { x: 5, y: 6 }, { x: 8, y: 2 }, { x: 12, y: 5 }, { x: 16, y: 9 }, { x: 19, y: 6 }, { x: 22, y: 2 }, { x: 22, y: 10 }];
const ROUTE_ROADS = [
  [[2, 10], [2, 8], [5, 8], [5, 6]],
  [[5, 6], [5, 4], [8, 4], [8, 2]],
  [[8, 2], [10, 2], [10, 5], [12, 5]],
  [[12, 5], [14, 5], [14, 9], [16, 9]],
  [[16, 9], [18, 9], [18, 6], [19, 6]],
  [[19, 6], [19, 4], [22, 4], [22, 2]],
  [[22, 2], [22, 4], [23, 4], [23, 10], [22, 10]],
];
// Every cell a road segment walks through, in order (duplicates at corners removed).
function routeCells(seg) { const out = []; const pts = ROUTE_ROADS[seg]; for (let i = 0; i + 1 < pts.length; i++) { let [x, y] = pts[i]; const [x1, y1] = pts[i + 1]; const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y); while (true) { if (!out.length || out[out.length - 1].x !== x || out[out.length - 1].y !== y) out.push({ x, y }); if (x === x1 && y === y1) break; x += dx; y += dy; } } return out; }
// The overworld as an ASCII map in the board's terrain alphabet, painted region by region, then the roads on top.
function routeWorldDef() {
  const W = ROUTE_W, H = ROUTE_H, g = Array.from({ length: H }, () => Array(W).fill('.')), r = mulberry32(2026);
  const set = (x, y, ch) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = ch; };
  const fill = (x0, y0, x1, y1, ch, p = 1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (r() < p) set(x, y, ch); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = r(); if (v < .1) g[y][x] = ','; else if (v < .15) g[y][x] = 't'; }
  fill(0, 0, 1, 1, '~'); set(2, 0, '~');                                   // a pond in the north-west
  fill(0, 3, 1, 7, 'T', .8); fill(3, 3, 7, 8, 'T', .72); fill(6, 5, 7, 7, 'T');  // Viridian Forest
  fill(0, 9, 4, 12, ',', .6); set(0, 11, 'H'); set(4, 11, 'H'); set(1, 12, 'H'); set(3, 9, 'C');   // Pallet: flowers and houses
  fill(6, 0, 10, 3, 'M', .75); fill(9, 0, 10, 1, 'M'); set(7, 3, 'r');                           // Mt. Moon
  for (let y = 0; y < H; y++) { const wob = Math.round(Math.sin(y * .9) * .6); set(12 + wob, y, '~'); set(13 + wob, y, '~'); if (y % 3 === 1) set(14 + wob, y, 's'); }  // the river
  fill(15, 10, 18, 12, '.', 1); set(15, 11, 'H'); set(17, 11, 'H'); set(18, 11, 'H'); set(16, 12, 'H'); set(15, 8, 'C');   // a town with a dark basement
  fill(18, 7, 20, 8, 'b'); set(20, 6, 'x'); set(20, 5, 'p');                                     // the Power Plant
  fill(19, 0, 23, 3, 'M', .85); fill(20, 0, 21, 1, 'L'); set(23, 3, 'r');                        // Cinnabar volcano: a lava pool in the peaks
  fill(20, 9, 23, 12, 'W', .9); fill(21, 10, 22, 11, 'c'); set(20, 11, 'w');                          // Cerulean Cave
  fill(10, 9, 11, 12, 'T', .6); fill(0, 12, 0, 12, 'T');
  for (let s = 0; s < ROUTE_ROADS.length; s++) for (const c of routeCells(s)) { const cur = g[c.y][c.x]; set(c.x, c.y, cur === '~' || cur === '=' ? '=' : cur === 'c' || cur === 'W' ? 'c' : '#'); }
  for (const n of ROUTE_NODES) { const cur = g[n.y][n.x]; if (cur !== '=' && cur !== 'c') set(n.x, n.y, '#'); }
  return { name: 'Kanto Route', seed: 404, rows: g.map(row => row.join('')), units: [], deploy: [] };
}
const ROUTE = { roads: null, bare: null, def: null };
// Two bakes of the same world: with every road, and with the roads replaced by the ground around them. Unlocked
// stretches are copied cell by cell from the first onto the second, so a new stretch can appear one tile at a time.
function routeCanvases() {
  if (ROUTE.roads) return ROUTE;
  const def = routeWorldDef(); ROUTE.def = def; ROUTE.roads = makeBackdrop(def).canvas;
  const bareRows = def.rows.map((row, y) => row.split('').map((ch, x) => ch === '#' ? (routeTreeless(def, x, y)) : ch === '=' ? '~' : ch).join(''));
  const bareDef = Object.assign({}, def, { rows: bareRows }); ROUTE.bare = makeBackdrop(bareDef).canvas; ROUTE.m = parseMap(bareDef);
  ROUTE.water = []; for (let y = 0; y < ROUTE.m.h; y++) for (let x = 0; x < ROUTE.m.w; x++) if (LIQUID.has(ROUTE.m.tiles[y][x].id)) ROUTE.water.push({ x, y }); return ROUTE;
}
function routeTreeless(def, x, y) { const n = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => (def.rows[y + dy] || '')[x + dx]).filter(c => c && '#='.indexOf(c) < 0); return n.includes('c') || n.includes('W') ? 'c' : ','; }
// Stars a chapter has earned (0-3) and whether it is open to play.
function routeStars(i) { const ch = CHAPTERS[i]; return SAVE && SAVE.rating ? SAVE.rating[ch.id] || 0 : 0; }
function routeUnlocked() { return SAVE ? clamp(SAVE.chapter || 0, 0, CHAPTERS.length - 1) : 0; }
function openRoute(opts = {}) {
  if (!SAVE) SAVE = loadSave(); if (!SAVE) { startNewGame(); return; }
  const open = routeUnlocked(), sel = clamp(opts.sel != null ? opts.sel : open, 0, open);
  const S = { sel, reveal: opts.reveal || null, cam: null, walk: null, t0: 0, hop: 0 };
  if (S.reveal) S.sel = S.reveal.cleared; // the reveal starts on the stop just cleared and walks on afterwards
  goScene('route', S); Audio.playMusic('route');
}
// Layout: the map fills the screen; the stop card docks right on wide screens and at the bottom on tall ones.
function routeLayout() {
  const W = VIEW.w, H = VIEW.h, side = W >= 380 && W > H * 1.1, bh = btnH();
  const card = side ? { x: W - 162, y: 30, w: 156, h: Math.min(H - 60, 212) } : { x: 6, y: H - Math.min(150, Math.round(H * .4)) - bh - 12, w: W - 12, h: Math.min(150, Math.round(H * .4)) };
  const view = side ? { x: 0, y: 0, w: card.x - 4, h: H } : { x: 0, y: 26, w: W, h: card.y - 30 };
  return { W, H, side, card, view, bh };
}
function routeNodePx(i) { const n = ROUTE_NODES[i]; return { x: n.x * TILE + TILE / 2, y: n.y * TILE + TILE / 2 }; }
function routeCamTarget(S, L, i) { const p = S.walk ? S.walk.pos : routeNodePx(i), ww = ROUTE_W * TILE, wh = ROUTE_H * TILE; const cx = ww <= L.view.w ? (ww - L.view.w) / 2 : clamp(p.x - L.view.w / 2, 0, ww - L.view.w), cy = wh <= L.view.h ? (wh - L.view.h) / 2 : clamp(p.y - L.view.h / 2, 0, wh - L.view.h); return { x: cx - L.view.x, y: cy - L.view.y }; }
// Select another open stop: the captain walks the road there, cell by cell.
function routeSelect(i) {
  const S = SC.data, open = routeUnlocked(); if (i < 0 || i > open || i === S.sel || S.reveal) return;
  const cells = []; const a = Math.min(S.sel, i), b = Math.max(S.sel, i); for (let s = a; s < b; s++) { const c = routeCells(s); cells.push(...(cells.length ? c.slice(1) : c)); }
  if (i < S.sel) cells.reverse(); S.walk = { cells, k: 0, pos: routeNodePx(S.sel), to: i }; S.sel = i; Audio.sfx('cursor');
}
function routePlay() { const S = SC.data; if (S.reveal || S.walk) return; Audio.sfx('select'); briefChapter(S.sel); }
function routeUpdate(dt) {
  const S = SC.data; if (!S) return; S.t0 += dt;
  if (S.walk) { const w = S.walk; w.k += dt * 11; const i = Math.min(w.cells.length - 1, Math.floor(w.k)), f = w.k - i, a = w.cells[i], b = w.cells[Math.min(w.cells.length - 1, i + 1)]; w.pos = { x: (a.x + (b.x - a.x) * f) * TILE + TILE / 2, y: (a.y + (b.y - a.y) * f) * TILE + TILE / 2 }; if (Math.floor(w.k) !== Math.floor(w.k - dt * 11)) Audio.sfx('step'); if (w.k >= w.cells.length - 1) { S.walk = null; S.hop = .35; Audio.sfx('ok'); } }
  if (S.hop > 0) S.hop = Math.max(0, S.hop - dt);
  // the reveal: stars pop one by one on the cleared stop, the next stretch of road appears, the new stop opens
  const R = S.reveal; if (R) { R.t = (R.t || 0) + dt; const starAt = k => .45 + k * .32;
    for (let k = 0; k < 3; k++) if (!R['s' + k] && R.t >= starAt(k)) { R['s' + k] = true; if (k < R.stars) { Audio.sfx('levelup'); routeBurst(routeNodePx(R.cleared), UI.gold); } else Audio.sfx('cursor'); }
    const roadT = starAt(3) + .2, cells = R.unlocked != null ? routeCells(R.cleared).length : 0; R.road = R.unlocked != null ? clamp((R.t - roadT) / (cells * .07), 0, 1) : 0;
    if (R.unlocked != null && R.road > 0 && !R.roadSfx) { R.roadSfx = true; Audio.sfx('select'); }
    if (R.unlocked != null && R.road >= 1 && !R.popped) { R.popped = true; Audio.sfx('caught'); routeBurst(routeNodePx(R.unlocked), '#8ad8ff'); S.newAt = S.t0; }
    if (R.t >= roadT + cells * .07 + .5 || (R.unlocked == null && R.t > starAt(3) + .3)) { const next = R.unlocked; S.reveal = null; if (next != null) routeSelect(next); }
  }
  for (const p of S.parts || []) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; }
  if (S.parts) S.parts = S.parts.filter(p => p.age < p.life);
  Audio.tick();
}
function routeBurst(at, col) { const S = SC.data; if (!S || REDUCED) return; S.parts = S.parts || []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, sp = 30 + (i % 4) * 14; S.parts.push({ x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, age: 0, life: .5 + (i % 3) * .15, col: i % 3 ? col : '#ffffff' }); } }
function drawRouteStar(x, y, on, big) { stampAt(Math.round(x), Math.round(y), big ? ['...O...', '..OYO..', 'OOYWYOO', 'OYYYYYO', '.OYYYO.', 'OYOOOYO', 'OO...OO'] : ['..O..', '.OYO.', 'OYYYO', '.OYO.', '..O..'], on ? { O: '#3a2400', Y: UI.gold, W: '#fff6c8' } : { O: '#1a1834', Y: '#4a4a70', W: '#5a5a80' }); }
function routeDraw() {
  const S = SC.data, L = routeLayout(), W = L.W, H = L.H, C = routeCanvases(), open = routeUnlocked(), t = SC.t; SC.hits = [];
  rect(0, 0, W, H, '#10142a');
  const tgt = routeCamTarget(S, L, S.sel); if (!S.cam) S.cam = { x: tgt.x, y: tgt.y }; else { const k = Math.min(1, (CLOCK.dt || .016) * 6); S.cam.x += (tgt.x - S.cam.x) * k; S.cam.y += (tgt.y - S.cam.y) * k; }
  const ox = -Math.round(S.cam.x), oy = -Math.round(S.cam.y);
  ctx.save(); ctx.beginPath(); ctx.rect(L.view.x, L.view.y, L.view.w, L.view.h); ctx.clip();
  ctx.drawImage(C.bare, ox, oy);
  if (!REDUCED) { const f = Math.floor(t * 3) % WATER_FRAMES; for (const c of C.water) { const X = ox + c.x * TILE, Y = oy + c.y * TILE; if (X > L.view.x + L.view.w || Y > L.view.y + L.view.h || X + TILE < L.view.x || Y + TILE < L.view.y) continue; drawTerrain(ctx, C.m, c.x, c.y, X, Y, f); } for (const h of mapHouses(C.m)) drawChimneySmoke(ox + h.x * TILE + h.cx, oy + h.y * TILE, t, h.x * .13 + h.y * .07); }
  // roads: every stretch up to the furthest open stop, and the one being revealed tile by tile
  const R = S.reveal; const roadsOpen = R && R.unlocked != null ? R.cleared : open;
  for (let s = 0; s < ROUTE_ROADS.length; s++) { const cells = routeCells(s); let n = s < roadsOpen ? cells.length : 0; if (R && R.unlocked != null && s === R.cleared) n = Math.floor(cells.length * (R.road || 0)); for (let i = 0; i < cells.length; i++) { const c = cells[i]; if (i < n) ctx.drawImage(C.roads, c.x * TILE, c.y * TILE, TILE, TILE, ox + c.x * TILE, oy + c.y * TILE, TILE, TILE); else if (i % 2 === 0) { ctx.globalAlpha = .45; rect(ox + c.x * TILE + 14, oy + c.y * TILE + 14, 4, 4, '#1a1426'); ctx.globalAlpha = 1; } } }
  // stops: a pad the captain stands on, a numbered badge, three stars under it; locked stops are grey with a padlock
  for (let i = 0; i < CHAPTERS.length; i++) {
    const p = routeNodePx(i), x = ox + p.x, y = oy + p.y + 3, unlocked = i <= open && !(R && R.unlocked === i && !R.popped), stars = R && R.cleared === i ? [0, 1, 2].filter(k => R['s' + k] && k < R.stars).length : routeStars(i), sel = S.sel === i;
    const fresh = unlocked && i === open && !stars, pulse = fresh && !REDUCED ? (Math.sin(t * 5) + 1) / 2 : 0, pop = S.newAt != null && i === open ? easeOutBack(clamp((S.t0 - S.newAt) / .4, 0, 1)) : 1;
    const col = !unlocked ? '#3c3a56' : stars ? '#2f66d0' : '#d23c30', rx = Math.max(2, Math.round(11 * pop)), ry = Math.max(1, Math.round(5 * pop));
    ctx.globalAlpha = .45; ellipse(x, y + 3, rx + 1, ry, '#000'); ctx.globalAlpha = 1;
    if (fresh && !REDUCED) { ctx.globalAlpha = .5 * (1 - pulse); ellipseRing(x, y, rx + 3 + Math.round(pulse * 4), ry + 2 + Math.round(pulse * 2), 1, UI.gold); ctx.globalAlpha = 1; }
    ellipse(x, y, rx + 1, ry + 1, UI.inset); ellipse(x, y, rx, ry, shade(col, -.35)); ellipse(x, y - 1, rx, ry - 1, col); hline(x - rx + 3, y - ry + 1, 2 * rx - 6, shade(col, .45));
    if (sel) ellipseRing(x, y, rx + 2, ry + 2, 1, UI.gold);
    // the badge: chapter number (or a padlock) in a small plate up and to the left of the pad
    const bx = x - rx - 6, by = y - 14; rrect(bx, by, 11, 11, UI.inset, 1); rrect(bx + 1, by + 1, 9, 9, unlocked ? (sel ? UI.gold : UI.border) : '#6a6888', 1);
    const inView = bx >= L.view.x && bx + 11 <= L.view.x + L.view.w && by >= L.view.y && by + 11 <= L.view.y + L.view.h; // numbers only on badges fully in view (the clip hides the rest)
    if (unlocked) { if (inView) textC(String(i + 1), bx + 6, by + 2, sel ? UI.goldDark : '#1b1834'); } else { rect(bx + 3, by + 5, 5, 4, '#1b1834'); outline(bx + 4, by + 2, 3, 4, '#1b1834'); }
    if (unlocked) for (let k = 0; k < 3; k++) drawRouteStar(x - 11 + k * 8, y + ry + 3, k < stars, true);
    if (unlocked && x >= L.view.x && x < L.view.x + L.view.w && y >= L.view.y && y < L.view.y + L.view.h) hit(x - 14, y - 16, 28, 30, () => { if (S.sel === i) routePlay(); else routeSelect(i); }, 'STOP ' + (i + 1));
  }
  // the captain: walks the road, hops on arrival, idles with a bob; a bouncing marker over the selected stop
  const cap = SAVE && SAVE.party && SAVE.party[SAVE.captainPid || 0], ap = S.walk ? S.walk.pos : routeNodePx(S.sel), hop = S.hop > 0 ? Math.round(Math.sin((1 - S.hop / .35) * Math.PI) * 6) : 0;
  const bob = S.walk ? Math.round(Math.abs(Math.sin(t * 16)) * 2) : REDUCED ? 0 : Math.round(Math.abs(Math.sin(t * 3)) * 1);
  if (cap) { drawMon(cap.num, ox + ap.x, oy + ap.y + 3 - bob - hop, { flip: S.walk ? S.walk.cells.length > 1 && S.walk.cells[S.walk.cells.length - 1].x < S.walk.cells[0].x : false }); }
  if (!S.walk) { const p = routeNodePx(S.sel), ay = oy + p.y - 36 - (REDUCED ? 0 : Math.round(Math.abs(Math.sin(t * 4)) * 3)); stampAt(ox + p.x - 3, ay, ['OOOOOOO', 'OYYYYYO', '.OYYYO.', '..OYO..', '...O...'], { O: UI.inset, Y: UI.gold }); }
  for (const q of S.parts || []) { ctx.globalAlpha = 1 - q.age / q.life; rect(Math.round(ox + q.x) - 1, Math.round(oy + q.y) - 1, 2, 2, q.col); } ctx.globalAlpha = 1;
  if (S.newAt != null && S.t0 - S.newAt < 1.8) { const p = routeNodePx(open), k = (S.t0 - S.newAt) / 1.8, nx = clamp(ox + p.x, L.view.x + 34, L.view.x + L.view.w - 34); ctx.globalAlpha = k > .8 ? (1 - k) / .2 : 1; bigC('NEW AREA!', nx, oy + p.y - 48 - Math.round(k * 10), UI.gold, { outline: UI.goldDark }); ctx.globalAlpha = 1; }
  ctx.restore();
  // header ribbon: the journey so far
  const total = CHAPTERS.reduce((n, c, i) => n + routeStars(i), 0);
  ctx.globalAlpha = .85; rect(0, 0, L.side ? L.view.w : W, 24, '#08071a'); ctx.globalAlpha = 1; hline(0, 24, L.side ? L.view.w : W, UI.goldDark);
  bigText('ROUTE', 8, 8, UI.gold, { shadow: UI.goldDark }); const sx = 8 + textWidth('ROUTE', BIG) + 10; drawRouteStar(sx, 8, true, false); text(total + '/' + CHAPTERS.length * 3, sx + 8, 9, UI.ink);
  if (SAVE && SAVE.party) { const list = SAVE.party.slice(0, L.side ? 6 : 4); list.forEach((p, i) => drawMon(p.num, (L.side ? L.view.w : W) - 14 - i * 20, 23, { flip: true })); }
  drawRouteCard(S, L);
  const fy = H - L.bh - 6; bigButton(6, fy, 64, L.bh, 'TITLE', () => { Audio.sfx('cancel'); goScene('title'); }, { variant: 'ghost' });
  if (!L.side || W > 420) hintLine(VIEW.touch ? ['tap a stop · tap again to play'] : [['◂▸', 'stop'], ['Z', 'play'], ['X', 'title']], L.side ? L.view.w / 2 + 30 : W / 2 + 30, fy + (L.bh - 7) / 2, { pill: true });
}
// The card for the selected stop: chapter, place, objective, the three star goals, the first-clear reward, PLAY.
function drawRouteCard(S, L) {
  const c = L.card, i = S.sel, ch = CHAPTERS[i], o = ch.map.objective, stars = routeStars(i), cleared = SAVE && (SAVE.chapter > i), tok = unfold('routecard' + i, c.x, c.y, c.w, c.h, .18);
  const p = panel(c.x, c.y, c.w, c.h, { title: 'FRONT ' + ch.num, fill: UI.panel });
  let y = p.cy + 2; const x = c.x + 8, w = c.w - 16;
  bigText(fitLabel(ch.title.toUpperCase(), w), x, y, UI.gold, { shadow: UI.goldDark }); y += 13;
  const goal = objectiveTextFor(o).replace('Objective: ', ''); iconAt('flag', x, y - 1, UI.gold); text(fitLabel(goal[0].toUpperCase() + goal.slice(1), w - 12), x + 12, y, UI.ink); y += 11;
  text('Foes Lv ' + ch.level + ' · Deploy ' + ch.slots, x, y, UI.muted); y += 12;
  // who holds the front (a Gym Leader shown as freed once the front is cleared)
  { const co = ch.co ? COS[ch.co] : null, sp = ch.foe ? SPEAKERS[ch.foe] : null, tr = co ? co.tr : sp && sp.tr, face = tr && trainerFace(tr), col = co ? co.col : sp ? sp.col : UI.red, freed = cleared && co && CO_UNLOCK[ch.co]; if (face) { rect(x, y - 3, 14, 14, shade(col, -.4)); ctx.save(); ctx.beginPath(); ctx.rect(x, y - 3, 14, 14); ctx.clip(); ctx.drawImage(face, x - 2, y - 4); ctx.restore(); outline(x - 1, y - 4, 16, 16, col); } text(fitLabel((freed ? 'Freed: ' : 'Held by ') + (co ? co.name : ch.foe || 'Team Rocket'), w - 20), x + 19, y, freed ? UI.green : col); y += 15; }
  const goals = [['Win the battle', stars >= 1], ['Win within ' + ch.par + ' turns', stars >= 2], ['Nobody faints', stars >= 3]];
  if (c.h - (y - c.y) > 60 || L.side) { sectionLabel('Stars', x, y, w, UI.muted); y += 10; goals.forEach(([g, on], k) => { drawRouteStar(x, y - 1, on, true); text(g, x + 10, y, on ? UI.ink : UI.muted); y += 10; }); y += 2; }
  else { goals.forEach(([, on], k) => drawRouteStar(x + k * 9, y - 1, on, true)); text(stars + '/3 stars', x + 30, y, UI.muted); y += 11; }
  if (!cleared && (c.h - (y - c.y) > 40)) { drawBall(x + 3, y + 3, ITEMS.pokeball.col, 3); text('First clear: ×' + (ch.rewards.pokeball || 0), x + 10, y, UI.muted); y += 11; }
  const bh = L.bh + 4, by = c.y + c.h - bh - 7;
  // the battlefield: where you deploy (blue), every foe (red), wild Pokémon (yellow) and the boss (skull)
  const room = by - y - 6; if (room >= 34) { ROUTE.previews = ROUTE.previews || {}; const bd = ROUTE.previews[i] || (ROUTE.previews[i] = makeBackdrop(ch.map)); const sc = Math.min(w / bd.canvas.width, room / bd.canvas.height), pw = Math.floor(bd.canvas.width * sc), ph = Math.floor(bd.canvas.height * sc), px0 = c.x + Math.round((c.w - pw) / 2), py0 = y + Math.round((room - ph) / 2);
    rect(px0 - 2, py0 - 2, pw + 4, ph + 4, UI.inset); ctx.drawImage(bd.canvas, px0, py0, pw, ph); outline(px0 - 1, py0 - 1, pw + 2, ph + 2, UI.border2); const cell = TILE * sc;
    for (const d of ch.map.deploy || []) rect(px0 + d.x * cell, py0 + d.y * cell, Math.ceil(cell), Math.ceil(cell), '#3d7dffa0');
    for (const u of ch.map.units || []) { const ux = Math.round(px0 + (u.x + .5) * cell), uy = Math.round(py0 + (u.y + .5) * cell); if (u.boss) drawSkull(ux - 2, uy - 3); else { rect(ux - 1, uy - 1, 3, 3, UI.inset); px(ux, uy, u.team === 2 ? '#ffe070' : '#ff5a5a'); } } }
  bigButton(c.x + 7, by, c.w - 14, bh, cleared ? 'REPLAY' : 'PLAY', routePlay, { variant: cleared ? 'neutral' : 'primary', disabled: !!(S.reveal || S.walk) });
  unfoldEnd(tok);
}
function routeInput(ev) {
  const S = SC.data; if (!S) return;
  if (S.reveal) { if (ev.type === 'key' && (ev.key === 'ok' || ev.key === 'back') || ev.type === 'up') S.reveal.t = Math.max(S.reveal.t || 0, 99); return; }
  if (ev.type === 'key') { if (ev.key === 'left' || ev.key === 'up' || ev.key === 'prev') routeSelect(S.sel - 1); else if (ev.key === 'right' || ev.key === 'down' || ev.key === 'next') routeSelect(S.sel + 1); else if (ev.key === 'ok') routePlay(); else if (ev.key === 'back') { Audio.sfx('cancel'); goScene('title'); } else if (ev.key === 'mute') Audio.toggle(); return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}
