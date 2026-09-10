// ============================================================================
// battle.js — the tactics board: camera, cursor, ranges, path arrow, menus,
// combat forecast, animation sequencer (moves, strikes, KO, level up, evolve,
// capture), enemy phase playback, HUD.
// ============================================================================
'use strict';
const CAM = { x: 0, y: 0, tx: 0, ty: 0 };
const BT = {  // battle scene UI state
  mode: 'idle',      // idle | move | menu | target | forecast | item | itemTarget | anim | enemy | banner | end | help | unitinfo
  cx: 0, cy: 0,      // cursor tile
  sel: null, reach: null, atk: null, path: [], menu: null, targets: [], tIdx: 0, item: null, hover: null,
  time: 0, anim: null, queue: [], danger: false, showDanger: false, msg: null, banner: null, endTimer: 0, fast: false, skipAnim: false,
  dragStart: null, dragged: false, pinch: 0, lastTap: 0, undo: null, log: [], helpPage: 0, info: null,
  zoom: 1,           // board magnification: 1 (32 px tiles) or .5 (16 px tiles, for maps that do not fit)
  hoverAnchor: null, // pointer position when the last overlay closed: hover ignores the pointer until it moves away
  lastMode: 'idle',
};
// Board space: world pixels minus the camera (shake included). The board layer is drawn under ctx.scale(BT.zoom),
// so tileX/tileY are board coordinates; screen = board × BT.zoom. bvW/bvH are the view size in board pixels.
function tileX(x) { return Math.round(x * TILE - CAM.x + FX.shakeX); }
function tileY(y) { return Math.round(y * TILE - CAM.y + FX.shakeY); }
function bvW() { return VIEW.w / BT.zoom; }
function bvH() { return VIEW.h / BT.zoom; }
function boardH() { return VIEW.h; }
function toScreenX(bx) { return Math.round(bx * BT.zoom); }
function toScreenY(by) { return Math.round(by * BT.zoom); }
// Screen point → world tile (the inverse of tileX/tileY, ignoring shake).
function screenToTile(sx, sy) { return { x: Math.floor((sx / BT.zoom + CAM.x) / TILE), y: Math.floor((sy / BT.zoom + CAM.y) / TILE) }; }
// Which team the person holding the controls plays right now (0 in campaign; 0 or 1 in Versus).
function isHuman(t) { return B && B.humans ? B.humans.includes(t) : t === 0; }
function HT() { return B && B.humans && B.humans.includes(B.phase) ? B.phase : (B && B.humans ? B.humans[0] : 0); }
function teamName(t) { return B && B.versus ? (t === 0 ? 'PLAYER 1' : t === 1 ? 'PLAYER 2' : t === 2 ? 'WILD' : 'ALLY') : (t === 0 ? 'PLAYER' : t === 1 ? 'ENEMY' : t === 2 ? 'WILD' : 'ALLY'); }
function phaseLabel(t) { return teamName(t) + ' PHASE'; }
// Screen bands the HUD keeps for itself (in board pixels): the turn card on top and, on narrow portrait screens,
// the context/forecast area and the button bar at the bottom. A board that fits is centred between them.
function hudReserve() { const z = BT.zoom; if (B && B.territory) return { top: 52 / z, bottom: (narrowView() && portraitView() ? (['target', 'skillTarget'].includes(BT.mode) ? 170 : 118) : 40) / z }; if (narrowView() && portraitView()) return { top: 30 / z, bottom: (BT.mode === 'target' || BT.mode === 'catchTarget' || BT.mode === 'skillTarget' ? 170 : 118) / z }; return { top: 30 / z, bottom: 40 / z }; }
// Range of camera positions: a board that fits sits centred (between the HUD bands vertically); a bigger board can
// be panned edge to edge, and far enough past its top and bottom rows for them to clear the HUD bands.
function camRange() {
  const mw = B.map.w * TILE, mh = B.map.h * TILE, W = bvW(), H = bvH(), R = hudReserve(); const free = Math.max(TILE * 2, H - R.top - R.bottom);
  const xr = mw <= W ? [(mw - W) / 2, (mw - W) / 2] : [0, mw - W];
  const cy = -(R.top + (free - mh) / 2); const yr = mh <= free ? [cy, cy] : [-R.top, mh - H + R.bottom];
  return { x: xr, y: yr };
}
function centerCam(x, y, snap) { const r = camRange(); CAM.tx = clamp(x * TILE + TILE / 2 - bvW() / 2, r.x[0], r.x[1]); CAM.ty = clamp(y * TILE + TILE / 2 - bvH() / 2, r.y[0], r.y[1]); if (snap) { CAM.x = CAM.tx; CAM.y = CAM.ty; } }
// Keep the cursor's tile inside the view with a margin, clear of the HUD bands.
function keepCursorVisible() { const m = TILE, R = hudReserve(); const sx = BT.cx * TILE - CAM.tx, sy = BT.cy * TILE - CAM.ty; if (sx < m) CAM.tx -= m - sx; if (sx > bvW() - m - TILE) CAM.tx += sx - (bvW() - m - TILE); if (sy < m + R.top) CAM.ty -= m + R.top - sy; if (sy > bvH() - m - TILE - R.bottom) CAM.ty += sy - (bvH() - m - TILE - R.bottom); clampCam(); }
function clampCam() { const r = camRange(); CAM.tx = clamp(CAM.tx, r.x[0], r.x[1]); CAM.ty = clamp(CAM.ty, r.y[0], r.y[1]); }
// Is a unit's tile fully inside the view, clear of the HUD bands?
function unitVisible(u) { const R = hudReserve(); const sx = u.x * TILE - CAM.tx, sy = u.y * TILE - CAM.ty; return sx >= 0 && sx + TILE <= bvW() && sy >= R.top && sy + TILE <= bvH() - R.bottom; }
// Zoom: .5 shows twice the map. Available whenever the board does not fit at 1; zoomToFit picks the level that shows the whole map if one does.
function boardFits(z) { const R = { top: 30 / z, bottom: (narrowView() && portraitView() ? 118 : 40) / z }; return B.map.w * TILE <= VIEW.w / z && B.map.h * TILE <= VIEW.h / z - R.top - R.bottom; }
function canZoom() { return B && !boardFits(1); }
function setZoom(z) { if (z === BT.zoom || (z < 1 && !canZoom())) return false; const cx = CAM.tx + bvW() / 2, cy = CAM.ty + bvH() / 2; BT.zoom = z; CAM.tx = cx - bvW() / 2; CAM.ty = cy - bvH() / 2; clampCam(); CAM.x = CAM.tx; CAM.y = CAM.ty; return true; }
function zoomToFit() { return setZoom(boardFits(1) || !boardFits(.5) ? 1 : .5); }
function toggleZoom() { return setZoom(BT.zoom === 1 ? .5 : 1); }

// ---------------------------------------------------------------- battle setup
function startBattle(mapDef, party, bag, opts = {}) {
  seedRng(opts.seed || (Date.now() & 0xffff));
  const map = parseMap(mapDef); UID = 1;
  B = { map, units: [], turn: 1, phase: 0, bag: bag, result: null, seized: false, captured: [], kills: 0, chapter: opts.chapter != null ? opts.chapter : null, log: [], seed: opts.seed || 1, skirmish: !!opts.skirmish, turnsUsed: 0, versus: !!opts.versus, humans: opts.humans || [0], bags: opts.versus ? [bag, Object.assign({}, opts.bag2 || bag)] : null, setup: opts.setup || null };
  // enemies / wild / allies from the map definition
  for (const d of mapDef.units) { const u = makeUnit(d.mon, d.level, d.team == null ? 1 : d.team, { x: d.x, y: d.y, ai: d.ai, boss: d.boss, nick: d.nick }); if (d.hp) u.hp = Math.max(1, Math.floor(u.maxHp * d.hp)); u.provoked = false; B.units.push(u); }
  // player party on deploy tiles: the campaign party keeps its HP edge, Versus trainers are built identically
  // id: 0 drops the id a serialized party member carried from an earlier battle so restoreUnit assigns a fresh
  // one: enemies were just numbered 1..N, and a duplicate id would make the duel scene overlay both sides.
  if (opts.territory) territoryInit();
  const fresh = { acted: false, status: null, recharge: 0, cd: 0, brace: 0, root: 0, id: 0 }; // battle-temporary state never crosses encounters (suspend keeps it)
  party.forEach((p, i) => { const slot = map.deploy[i]; if (!slot) return; const u = restoreUnit(Object.assign({}, p, fresh, { team: 0, x: slot.x, y: slot.y, hpBonus: opts.versus ? 1 : BOND_HP })); u.hp = u.maxHp; u.leader = i === 0; B.units.push(u); });
  if (opts.party2) opts.party2.forEach((p, i) => { const slot = (map.deploy2 || [])[i]; if (!slot) return; const u = restoreUnit(Object.assign({}, p, fresh, { team: 1, x: slot.x, y: slot.y, hpBonus: 1 })); u.hp = u.maxHp; u.leader = i === 0; u.fx.facing = -1; B.units.push(u); });
  BT.mode = 'idle'; BT.sel = null; BT.queue = []; BT.anim = null; BT.autoEnd = 0; BT.dart = false; BT.log = []; BT.showDanger = false; BT.hpShow.clear();
  for (const u of B.units) requestBigSprite(u.num); // warm the duel scene's sprites; nothing waits on them
  const first = alive(0)[0]; BT.cx = first ? first.x : 0; BT.cy = first ? first.y : 0; BT.zoom = 1; if (narrowView() && canZoom()) setZoom(.5); centerCam(BT.cx, BT.cy, true); // phones open zoomed out: six 32 px tiles across is too little context
  BT.hoverAnchor = null; BT.lastMode = BT.mode; FX.parts = []; FX.texts = []; FX.sprites = [];
  Audio.playMusic(map.music);
  if (!opts.defer) beginPhase(0, true);
}
// first: the battle's opening phase (no turn increment). resumed: the phase comes from a suspend save,
// which was written after upkeep already ran, so heals, ticks and recharges must not apply again.
function beginPhase(team, first, resumed = false) {
  B.phase = team;
  if (B.territory && team === 0 && !first && !resumed) B.turn++;
  const ev = resumed ? [] : upkeep(team);
  if (B.territory && !resumed) { territoryUpkeep(team); if (checkObjective()) { endBattle(); return; } if (!isHuman(team)) for (const u of territoryAiDeploy(team)) ev.push({ type: 'spawn', unit: u }); }
  if (team === 0 && !first && !B.territory) { B.turn++; if (checkObjective()) { endBattle(); return; } }
  if (team === 0 && !B.versus && !resumed) { saveSuspend(); }
  if (B.versus && B.bags && isHuman(team)) B.bag = B.bags[team];
  const teamsPresent = [0, 1, 2, 3].filter(t => alive(t).length);
  if (!teamsPresent.includes(team) && team !== 0 && !(B.territory && team === 1)) { nextPhase(); return; }
  // reinforcements at the start of the enemy phase
  if (team === 1) for (const u of spawnReinforcements()) ev.push({ type: 'spawn', unit: u });
  const label = phaseLabel(team);
  BT.banner = { text: label, t: 0, team, sub: isHuman(team) ? 'Turn ' + B.turn + (B.map.turnLimit && B.map.objective.type !== 'survive' ? ' / ' + B.map.turnLimit : '') + (B.map.objective.type === 'survive' ? ' / ' + B.map.objective.turns : '') : null };
  BT.mode = 'banner'; Audio.sfx(isHuman(team) ? 'phase' : 'enemyphase');
  Audio.playMusic(isHuman(team) ? (B.units.some(u => u.boss && u.hp > 0 && u.provoked) ? 'boss' : B.map.music) : 'enemy');
  if (B.versus && isHuman(team)) { BT.mode = 'handoff'; BT.handoff = { team, t: 0 }; }
  BT.queue = ev.map(e => ({ kind: 'event', ev: e }));
  BT.afterBanner = () => { playQueue(() => { if (isHuman(team)) { const f = alive(team).find(u => !u.acted); if (f) { BT.cx = f.x; BT.cy = f.y; keepCursorVisible(); } BT.mode = B.territory && BT.territoryGuide ? 'territoryGuide' : 'idle'; } else runEnemyPhase(team); }); };
}
function spawnReinforcements() { const out = []; for (const r of B.map.reinforce) if (r.turn === B.turn && !r.done) { r.done = true; for (const d of r.units) { if (unitAt(d.x, d.y)) continue; const u = makeUnit(d.mon, d.level, d.team == null ? 1 : d.team, { x: d.x, y: d.y, ai: d.ai || 'aggro', boss: d.boss }); B.units.push(u); out.push(u); requestBigSprite(u.num); } } return out; }
function nextPhase() {
  if (checkObjective()) { endBattle(); return; }
  let t = B.phase; for (let i = 0; i < 4; i++) { t = (t + 1) % 4; if (t === 0 || alive(t).length || (B.territory && t === 1)) break; }
  beginPhase(t, false);
}
function endBattle() { BT.mode = 'end'; BT.endTimer = 0; Audio.stopMusic(); const won = B.result === 'win' || B.result === 'p1' || B.result === 'p2'; Audio.sfx(won ? 'win' : 'lose'); if (won) Audio.playMusic('win'); }

// ---------------------------------------------------------------- animation queue
// Queue items: {kind:'move', unit, path} | {kind:'strike', ...} | {kind:'event', ev} | {kind:'wait', t} | {kind:'fn', fn} | {kind:'msg', text}
function playQueue(done) { BT.queueDone = done; BT.mode = 'anim'; nextAnim(); }
function nextAnim() {
  const q = BT.queue.shift();
  if (!q) { BT.anim = null; const d = BT.queueDone; BT.queueDone = null; if (d) d(); return; }
  BT.anim = q; q.t = 0;
  if (q.kind === 'event') { setupEvent(q); }
  if (q.kind === 'duel') { startDuel(q); }
  if (q.kind === 'move') { q.unit.fx.dx = 0; q.unit.fx.dy = 0; q.i = 0; q.dur = (BT.fast ? .05 : .11); if (q.path.length > 1) { const l = q.path[q.path.length - 1]; if (!unitVisible(q.unit) || !unitVisible(l)) centerCam((q.path[0].x + l.x) / 2, (q.path[0].y + l.y) / 2); } }
  if (q.kind === 'strike') { q.dur = BT.fast ? .35 : .62; centerCamBetween(q.att, q.def); }
  if (q.kind === 'msg') { q.dur = BT.fast ? .5 : 1.1; }
  if (q.kind === 'wait') { q.dur = BT.fast ? q.t2 * .3 : q.t2; }
  if (q.kind === 'fn') { q.fn(); nextAnim(); }
}
// Bring both units of an exchange into view; the camera only moves when one of them is outside the safe area.
function centerCamBetween(a, b) { if (unitVisible(a) && unitVisible(b)) return; centerCam((a.x + b.x) / 2, (a.y + b.y) / 2); }
function setupEvent(q) {
  const e = q.ev; q.dur = BT.fast ? .35 : .7;
  const ux = u => u.x * TILE + TILE / 2, uy = u => u.y * TILE + 4;
  switch (e.type) {
    case 'ko': q.dur = BT.fast ? .5 : .9; Audio.sfx('ko'); shake(4); spawnParts(ux(e.unit), uy(e.unit) + 8, 18, ['#ffffff', '#ffd24a', '#c0c0c0'], { speed: 90, life: .7, grav: 60 }); noteKo(e); floatText(ux(e.unit), uy(e.unit) - 14, e.unit.team === 0 ? 'FAINTED!' : 'KO!', e.unit.team === 0 ? UI.red : UI.gold, { big: true, life: 1.3 }); break;
    case 'xp': q.dur = BT.fast ? .5 : 1.0; q.from = e.unit.xp - e.amount; break;
    case 'levelup': q.dur = BT.fast ? .9 : 2.1; Audio.sfx('levelup'); spawnParts(ux(e.unit), uy(e.unit), 24, ['#ffd24a', '#ffffff', '#5ee06a'], { speed: 70, life: .9, grav: -30, shape: 'ring' }); break;
    case 'evolve': q.dur = BT.fast ? 1.4 : 3.2; Audio.sfx('evolve'); requestBigSprite(e.to.num); break;
    case 'heal': Audio.sfx('heal'); floatText(ux(e.unit), uy(e.unit), '+' + e.amount, UI.green, { outline: '#0a3a10' }); spawnParts(ux(e.unit), uy(e.unit) + 10, 10, ['#5ee06a', '#ffffff'], { speed: 30, grav: -60, life: .8 }); break;
    case 'cure': floatText(ux(e.unit), uy(e.unit) - 8, e.kind === 'frz' ? 'Thawed!' : e.kind === 'par' ? 'Recovered!' : 'Cured!', '#98d8f8'); break;
    case 'thaw': floatText(ux(e.unit), uy(e.unit) - 8, 'Thawed!', '#98d8f8'); break;
    case 'recharge': q.dur = BT.fast ? .3 : .6; if (e.done && !unitVisible(e.unit)) centerCam(e.unit.x, e.unit.y); floatText(ux(e.unit), uy(e.unit) - 8, e.done ? 'Recharging...' : 'Must recharge!', RECHARGE_COL, { outline: '#000' }); break;
    case 'dot': Audio.sfx(e.kind === 'brn' ? 'burn' : 'poison'); shake(1); floatText(ux(e.unit), uy(e.unit), '-' + e.amount, e.kind === 'psn' ? '#d080ff' : '#ff9040'); spawnParts(ux(e.unit), uy(e.unit) + 8, 8, e.kind === 'psn' ? ['#b050d0', '#7030a0'] : ['#ff8030', '#ffd040'], { speed: 30, grav: -50, life: .7 }); if (!unitVisible(e.unit)) centerCam(e.unit.x, e.unit.y); break;
    case 'spawn': q.dur = BT.fast ? .3 : .6; centerCam(e.unit.x, e.unit.y); Audio.sfx('select'); spawnParts(ux(e.unit), uy(e.unit) + 8, 12, ['#ffffff', '#ff4b4b'], { speed: 50, life: .5, grav: 0 }); floatText(ux(e.unit), uy(e.unit) - 10, 'Reinforcements!', UI.red); break;
    case 'capture': q.dur = BT.fast ? 1.6 : 2.6 + e.shakes * .5; Audio.sfx('catch'); break;
    case 'miss': q.dur = BT.fast ? .3 : .55; break;
    case 'status': floatText(ux(e.unit), uy(e.unit) - 6, STATUS[e.status].text.toUpperCase() + '!', STATUS[e.status].col, { outline: '#000' }); Audio.sfx(e.status === 'par' ? 'para' : e.status === 'brn' ? 'burn' : 'poison'); break;
    // role skills: a short card names the skill, then its effect floats over the target
    case 'skill': q.dur = BT.fast ? .4 : .8; Audio.sfx('select'); if (!unitVisible(e.unit) || !unitVisible(e.target)) centerCamBetween(e.unit, e.target); spawnParts(ux(e.unit), uy(e.unit) + 8, 10, [ROLES[e.unit.role].col, '#ffffff'], { speed: 40, life: .5, grav: -30 }); break;
    case 'brace': Audio.sfx('shake'); floatText(ux(e.unit), uy(e.unit) - 8, 'BRACED!', BRACE_COL, { outline: '#000' }); e.unit.fx.sy = .8; e.unit.fx.sx = 1.2; break;
    case 'root': Audio.sfx('grass'); shake(1); floatText(ux(e.unit), uy(e.unit) - 8, 'ROOTED!', ROOT_COL, { outline: '#000' }); spawnParts(ux(e.unit), uy(e.unit) + 12, 12, ['#2a6b38', '#c8f0a0'], { speed: 30, grav: 40, life: .6 }); break;
    case 'blocked': q.dur = BT.fast ? .4 : .7; if (!unitVisible(e.unit)) centerCam(e.unit.x, e.unit.y); floatText(ux(e.unit), uy(e.unit) - 8, e.kind === 'frz' ? 'Frozen solid!' : 'Fully paralyzed!', STATUS[e.kind].col, { outline: '#000' }); break;
    case 'property': q.dur = BT.fast ? .4 : .8; floatText(ux(e.unit), uy(e.unit) - 10, e.done ? 'CAPTURED!' : e.progress + '/20', UI.gold, { outline: '#000' }); Audio.sfx('select'); break;
    case 'unroot': q.dur = BT.fast ? .2 : .4; floatText(ux(e.unit), uy(e.unit) - 8, 'Free!', ROOT_COL, { outline: '#000' }); break;
  }
}
function updateAnim(dt) {
  const q = BT.anim; if (!q) return;
  if (q.kind === 'duel') { updateDuel(q, dt); if (q.done) nextAnim(); return; }
  q.t += dt;
  if (q.kind === 'move') {
    const p = q.path; if (p.length < 2) { q.unit.x = p[0].x; q.unit.y = p[0].y; nextAnim(); return; }
    const total = (p.length - 1) * q.dur; const k = Math.min(1, q.t / total); const seg = Math.min(p.length - 2, Math.floor(k * (p.length - 1))); const f = k * (p.length - 1) - seg;
    const a = p[seg], b = p[seg + 1]; const h = Math.abs(Math.sin(f * Math.PI)); q.unit.x = a.x; q.unit.y = a.y; q.unit.fx.dx = (b.x - a.x) * f * TILE; q.unit.fx.air = h * 6; q.unit.fx.dy = (b.y - a.y) * f * TILE - h * 6; q.unit.fx.sy = 1 + h * .14; q.unit.fx.sx = 1 - h * .1; q.unit.fx.facing = b.x - a.x !== 0 ? Math.sign(b.x - a.x) : q.unit.fx.facing;
    if (seg !== q.i) { q.i = seg; Audio.sfx('step'); spawnParts(a.x * TILE + TILE / 2, a.y * TILE + TILE - 4, 3, ['#d8c8a0', '#ffffff'], { speed: 20, life: .35, grav: -10, flat: true }); }
    if (k >= 1) { const l = p[p.length - 1]; q.unit.x = l.x; q.unit.y = l.y; q.unit.fx.dx = 0; q.unit.fx.dy = 0; q.unit.fx.air = 0; q.unit.fx.sy = .78; q.unit.fx.sx = 1.24; Audio.sfx('step'); for (let i = 0; i < 3; i++) spawnSprite('poof', l.x * TILE + TILE / 2 + (i - 1) * 9, l.y * TILE + TILE - 5, { size: 3, life: .3, col: '#e8e0d0', col2: '#ffffff', vx: (i - 1) * 24, vy: -8, delay: 0 }); nextAnim(); }
    return;
  }
  if (q.kind === 'strike') {
    const A = q.att, D = q.def, k = q.t / q.dur; const dx = Math.sign(D.x - A.x) || 0, dy = Math.sign(D.y - A.y) || 0; if (dx) A.fx.facing = dx;
    // wind-up (0-.3), lunge (.3-.45), impact at .45, recoil (.45-1)
    let off = 0; if (k < .3) off = -easeOut(k / .3) * 4; else if (k < .45) off = lerp(-4, 14, easeIn((k - .3) / .15)); else off = lerp(14, 0, easeOut((k - .45) / .55));
    if (q.ranged) off = k < .3 ? -easeOut(k / .3) * 3 : k < .45 ? lerp(-3, 6, (k - .3) / .15) : lerp(6, 0, easeOut((k - .45) / .55));
    A.fx.dx = dx * off; A.fx.dy = dy * off; A.fx.sx = k < .3 ? 1 - k * .3 : 1; A.fx.sy = k < .3 ? 1 + k * .3 : 1;
    if (!q.hitDone && k >= .45) { q.hitDone = true; impact(q); }
    if (q.ranged && k >= .3 && k < .45 && !q.projDone) { q.projDone = true; spawnProjectile(A, D, q.move); }
    if (k >= 1) { A.fx.dx = A.fx.dy = 0; A.fx.sx = A.fx.sy = 1; D.fx.dx = D.fx.dy = 0; nextAnim(); }
    return;
  }
  if (q.kind === 'event') {
    const e = q.ev;
    if (e.type === 'ko') { const k = q.t / q.dur; e.unit.fx.flash = k < .4 ? (Math.floor(k * 20) % 2) : 0; e.unit.fx.alpha = k < .4 ? 1 : Math.max(0, 1 - (k - .4) / .5); e.unit.fx.dy = k > .4 ? -(k - .4) * 20 : 0; if (k >= .4 && !q.poofed) { q.poofed = true; const cx = e.unit.x * TILE + TILE / 2, cy = e.unit.y * TILE + TILE - 6; for (let i = 0; i < 4; i++) spawnSprite('poof', cx + (i - 1.5) * 7, cy - 2, { size: 5, life: .55, col: '#e8e0d0', col2: '#ffffff', vy: -14, vx: (i - 1.5) * 10, delay: i * .03 }); } if (k >= 1) { e.unit.fx.alpha = 1; e.unit.fx.flash = 0; e.unit.fx.dy = 0; } }
    if (e.type === 'evolve') { const k = q.t / q.dur; e.unit.fx.flash = k > .15 && k < .8 ? (Math.floor(k * 14) % 2 ? 1 : 0) : 0; e.unit.fx.showNum = k < .5 ? e.from.num : e.to.num; e.unit.fx.sx = e.unit.fx.sy = k > .15 && k < .8 ? 1 + Math.sin(k * 30) * .12 : 1; if (k > .8 && !q.popped) { q.popped = true; spawnParts(e.unit.x * TILE + TILE / 2, e.unit.y * TILE + 8, 40, ['#ffffff', '#ffd24a', '#98d8f8', '#f85888'], { speed: 120, life: 1, grav: 20 }); flashScreen('#ffffff', .8); shake(3); Audio.sfx('caught'); } if (k >= 1) { e.unit.fx.flash = 0; e.unit.fx.showNum = null; e.unit.fx.sx = e.unit.fx.sy = 1; } }
    if (e.type === 'capture') captureAnim(q);
    if (e.type === 'levelup' && !q.shown && q.t > .2) { q.shown = true; }
    if (q.t >= q.dur) nextAnim();
    return;
  }
  if (q.kind === 'msg' || q.kind === 'wait') { if (q.t >= q.dur) nextAnim(); return; }
}
function spawnProjectile(A, D, move) { const ax = A.x * TILE + TILE / 2, ay = A.y * TILE + 12, bx = D.x * TILE + TILE / 2, by = D.y * TILE + 12; projectileFX(move.type, ax, ay, bx, by, (BT.fast ? .5 : 1) * .15 * .9); }
function impact(q) {
  const A = q.att, D = q.def, e = q.ev; const cx = D.x * TILE + TILE / 2, cy = D.y * TILE + 10; const col = TYPE_COL[q.move.type];
  if (e.type === 'miss') { Audio.sfx('miss'); floatText(cx, cy - 10, 'MISS', '#c0c0c0', { big: true }); D.fx.dx = (D.x - A.x) * 6; D.fx.dodge = .25; return; }
  D.fx.flash = 1; D.fx.dx = Math.sign(D.x - A.x) * 5; D.fx.dy = Math.sign(D.y - A.y) * 5 - 2; D.fx.hit = .3;
  Audio.sfx(e.crit ? 'crit' : e.eff > 1 ? 'hit2' : 'hit'); shake(e.crit ? 7 : e.eff > 1 ? 5 : 3); if (!BT.fast) FX.hitstop = e.crit ? .12 : .05;
  hitEffect(q.move.type, cx, cy, e.crit, e.eff);
  if (e.crit) { flashScreen('#ffffff', .5); FX.zoom = 1; spawnSprite('burst', cx, cy, { size: 24, life: .4, col: UI.gold, delay: .05 }); }
  floatText(cx, cy - 12, String(e.dmg), e.crit ? UI.gold : '#ffffff', { big: true, life: 1.1 });
  const pop = e.crit ? 'CRITICAL!' : MOVE_POP[q.move.type]; floatText(cx + 14, cy - 26, pop, e.crit ? UI.gold : col, { life: .9, delay: .05, outline: '#000', vy: -14 });
  if (e.eff > 1) floatText(cx, cy + 4, e.eff >= 2 ? 'SUPER EFFECTIVE!!' : 'Super effective!', '#ffd24a', { delay: .25, life: 1.2, outline: '#402000', vy: -10 });
  else if (e.eff === 0) floatText(cx, cy + 4, 'No effect...', '#c0c0c0', { delay: .25, life: 1.2, vy: -10 });
  else if (e.eff < 1) floatText(cx, cy + 4, 'Not very effective', '#a0d0ff', { delay: .25, life: 1.1, vy: -10 });
  if (e.status) { floatText(cx, cy + 14, STATUS[e.status].text.toUpperCase() + '!', STATUS[e.status].col, { delay: .5, life: 1.2, outline: '#000', vy: -10 }); }
  if (e.drain) floatText(A.x * TILE + TILE / 2, A.y * TILE, '+' + e.drain, UI.green, { delay: .3 });
  BT.hpShow.set(D.id, { from: e.hpAfter + e.dmg, to: e.hpAfter, t: 0 }); if (e.drain) BT.hpShow.set(A.id, { from: e.attHpAfter - e.drain, to: e.attHpAfter, t: 0 });
}
function captureAnim(q) {
  const e = q.ev, k = q.t / q.dur, T = e.unit; const cx = T.x * TILE + TILE / 2, cy = T.y * TILE + 8;
  // phases: throw (0-.2) → mon sucked in (.2-.3) → shakes → result
  if (k < .2) { q.ball = { x: lerp(e.from.x * TILE + TILE / 2, cx, easeOut(k / .2)), y: lerp(e.from.y * TILE + 8, cy, k / .2) - Math.sin(k / .2 * Math.PI) * 24 }; T.fx.alpha = 1; }
  else if (k < .3) { q.ball = { x: cx, y: cy }; T.fx.alpha = 1 - (k - .2) / .1; T.fx.sx = T.fx.sy = 1 - (k - .2) / .1 * .8; if (!q.suck) { q.suck = true; spawnParts(cx, cy, 10, ['#ffffff', '#ff8080'], { speed: 40, life: .3, grav: 0 }); } }
  else {
    T.fx.alpha = 0; const sh = Math.floor((k - .3) / (.5 / q.dur)); const shakes = e.shakes;
    const shakeT = (k - .3) * q.dur / .5; const cur = Math.floor(shakeT); const f = shakeT - cur;
    q.ball = { x: cx + (cur < shakes ? Math.round(Math.sin(f * Math.PI * 2) * 3) : 0), y: cy + 12 };
    if (cur !== q.lastShake && cur < shakes) { q.lastShake = cur; Audio.sfx('shake'); }
    if (cur >= shakes && !q.resolved) {
      q.resolved = true;
      if (e.ok) { Audio.sfx('caught'); floatText(cx, cy - 14, 'GOTCHA!', UI.gold, { big: true, life: 1.6 }); spawnParts(cx, cy + 8, 26, ['#ffd24a', '#ffffff', '#ff8080', '#5ee06a'], { speed: 90, life: .9, grav: 40 }); T.fx.alpha = 0; T.caught = true; }
      else { Audio.sfx('escape'); floatText(cx, cy - 14, 'It broke free!', '#ffffff', { life: 1.3 }); T.fx.alpha = 1; T.fx.sx = T.fx.sy = 1; spawnParts(cx, cy, 12, ['#ffffff', '#ff4040'], { speed: 60, life: .4, grav: 0 }); }
    }
    if (q.resolved && !e.ok) { T.fx.alpha = 1; q.ball = null; }
  }
  if (k >= 1) { if (e.ok) { T.fx.alpha = 1; if (!B.versus) { T.hp = 0; T.captured = true; } } else T.fx.alpha = 1; T.fx.sx = T.fx.sy = 1; q.ball = null; }
}
BT.hpShow = new Map();

// ---------------------------------------------------------------- player actions
function selectUnit(u) {
  if (!canTakeAction(u)) { Audio.sfx('error'); return false; }
  BT.sel = u; BT.reach = reachable(u); BT.atk = attackCells(u, BT.reach); BT.path = [{ x: u.x, y: u.y }]; BT.mode = 'move'; Audio.sfx('select');
  u.fx.sy = .75; u.fx.sx = 1.25; BT.quip = { text: quipFor(u.num), t: 0, unit: u };
}
function extendPath(x, y) {
  const u = BT.sel; const k = key(x, y); if (!BT.reach.has(k)) return; const p = BT.path;
  const i = p.findIndex(c => c.x === x && c.y === y); if (i >= 0) { BT.path = p.slice(0, i + 1); return; }
  const last = p[p.length - 1]; const adj = Math.abs(last.x - x) + Math.abs(last.y - y) === 1;
  if (adj) { let cost = 0; for (let j = 1; j < p.length; j++) cost += moveCost(terrAt(p[j].x, p[j].y), u); cost += moveCost(terrAt(x, y), u); if (cost <= effMov(u)) { BT.path = p.concat([{ x, y }]); return; } }
  BT.path = pathTo(BT.reach, x, y) || p;
}
function confirmMove() {
  const u = BT.sel; const dest = BT.path[BT.path.length - 1]; if (!canStand(u, dest.x, dest.y)) { Audio.sfx('error'); return; }
  if (BT.dart) { BT.dart = false; Audio.sfx('ok'); BT.queue = [{ kind: 'move', unit: u, path: BT.path.slice() }]; playQueue(() => { pickupAt(u); finishUnit(u); }); return; }
  BT.undo = { unit: u, x: u.x, y: u.y }; Audio.sfx('ok');
  BT.queue = [{ kind: 'move', unit: u, path: BT.path.slice() }];
  playQueue(() => { u.moved = true; pickupAt(u); openActionMenu(u); });
}
// Items lying on the board are picked up by the player unit that ends its move on them.
function pickupAt(u) {
  if (!isHuman(u.team)) return; const it = B.map.items.find(i => !i.taken && i.x === u.x && i.y === u.y); if (!it || !ITEMS[it.item]) return;
  it.taken = true; B.bag[it.item] = (B.bag[it.item] || 0) + 1; Audio.sfx('item');
  floatText(u.x * TILE + TILE / 2, u.y * TILE - 6, 'Got ' + ITEMS[it.item].name + '!', UI.gold, { outline: '#402000', life: 1.4 });
  spawnParts(u.x * TILE + TILE / 2, u.y * TILE + 10, 14, ['#ffd24a', '#ffffff', ITEMS[it.item].col], { speed: 50, life: .6, grav: -20 });
}
function openActionMenu(u) {
  const items = []; const tg = targetsFrom(u, u.x, u.y); if (tg.length) items.push({ id: 'attack', label: 'Attack', icon: 'sword', sub: tg.length + (tg.length > 1 ? ' targets' : ' target') });
  const wildAdj = B.units.filter(v => v.hp > 0 && v.team === 2 && dist(v, u) === 1); const hasBall = Object.keys(B.bag).some(k => ITEMS[k].kind === 'ball' && B.bag[k] > 0);
  if (wildAdj.length && hasBall) items.push({ id: 'catch', label: 'Catch', icon: 'ball', sub: 'Throw a ball' });
  if (B.map.objective.type === 'seize' && B.map.seize && u.x === B.map.seize.x && u.y === B.map.seize.y) items.unshift({ id: 'seize', label: 'Seize', icon: 'flag', sub: 'Win the map!' });
  if (B.territory && !territoryCaptureBlock(u)) { const p = territoryProperty(u.x, u.y); items.unshift({ id: 'property', label: 'Capture', icon: 'flag', sub: p.name + ': ' + (p.captor === u.id ? p.progress : 0) + '/20 + ' + territoryCaptureGain(u) + ' · leaving resets progress' }); }
  // the role skill: always listed so the player learns it exists; greyed with the reason when it cannot be used now
  if (u.skill && !u.skill.passive) { const why = skillBlock(u); const n = why ? 0 : skillTargetsAt(u).length; items.push({ id: 'skill', label: u.skill.name, icon: 'skill', off: !!why, sub: why ? u.skill.menu + ' (' + why + ')' : u.skill.menu + (u.skill.target === 'self' ? '' : ' · ' + n + (n > 1 ? ' targets' : ' target')) + (u.skill.cd ? ' · ' + cooldownText(u.skill) : '') }); }
  if (Object.keys(B.bag).some(k => ITEMS[k].kind !== 'ball' && B.bag[k] > 0)) items.push({ id: 'item', label: 'Bag', icon: 'bag', sub: 'Use an item' });
  items.push({ id: 'wait', label: 'Wait', icon: 'wait', sub: 'End this unit\'s turn' });
  BT.menu = { items, i: 0 }; BT.mode = 'menu'; BT.cx = u.x; BT.cy = u.y;
}
function menuChoose(id) {
  const u = BT.sel;
  if (id === 'property') { const e = territoryCapture(u); if (!e) { Audio.sfx('error'); return; } BT.queue = [{ kind: 'event', ev: e }]; playQueue(() => finishUnit(u)); return; }
  if (id === 'skill') { if (skillBlock(u)) { Audio.sfx('error'); return; } Audio.sfx('ok'); BT.targets = skillTargetsAt(u); BT.tIdx = 0; BT.mode = 'skillTarget'; setTargetCursor(); return; }
  Audio.sfx('ok');
  if (id === 'wait') finishUnit(u);
  else if (id === 'attack') { BT.targets = targetsFrom(u, u.x, u.y); BT.tIdx = 0; BT.moveIdx = 0; BT.mode = 'target'; setTargetCursor(); }
  else if (id === 'catch') { BT.targets = B.units.filter(v => v.hp > 0 && v.team === 2 && dist(v, u) === 1); BT.tIdx = 0; BT.mode = 'catchTarget'; setTargetCursor(); }
  else if (id === 'seize') { B.seized = true; Audio.sfx('win'); floatText(u.x * TILE + TILE / 2, u.y * TILE - 8, 'SEIZED!', UI.gold, { big: true, life: 1.5 }); spawnParts(u.x * TILE + TILE / 2, u.y * TILE + 8, 30, ['#ffd24a', '#ffffff', '#3d7dff'], { speed: 100, life: 1, grav: 40 }); BT.queue = [{ kind: 'wait', t2: 1.2 }]; playQueue(() => { u.acted = true; checkObjective(); endBattle(); }); }
  else if (id === 'item') { BT.itemList = Object.keys(B.bag).filter(k => ITEMS[k].kind !== 'ball' && B.bag[k] > 0); BT.menu = { items: BT.itemList.map(k => ({ id: k, label: ITEMS[k].name + ' ×' + B.bag[k], sub: ITEMS[k].desc })), i: 0, back: 'menu' }; BT.mode = 'item'; }
}
function setTargetCursor() { const t = BT.targets[BT.tIdx]; if (t) { BT.cx = t.x; BT.cy = t.y; keepCursorVisible(); } }
function currentForecast() { const u = BT.sel, t = BT.targets[BT.tIdx]; if (!t) return null; const d = dist(u, t); const ms = usableMoves(u, d); if (!ms.length) return null; BT.moveIdx = BT.moveIdx % ms.length; const m = ms[BT.moveIdx]; return { fc: forecast(u, t, m, u), move: m, moves: ms, target: t }; }
function confirmAttack() {
  const cf = currentForecast(); if (!cf) return; const u = BT.sel, t = cf.target; Audio.sfx('ok');
  if (t.team === 1 && t.ai !== 'aggro') t.provoked = true; if (t.boss) t.provoked = true;
  for (const e of B.units) if (e.team === 1 && e.hp > 0 && e.ai === 'boss' && dist(e, t) <= 3) e.provoked = true;
  BT.queue = combatQueue(u, t, cf.move, u); BT.mode = 'anim';
  playQueue(() => { afterAttack(u); });
}
// After an attack a scout that is still standing may dart; everyone else is spent. The map's objective is checked
// first so a winning blow ends the battle without a pointless dart.
function afterAttack(u) { if (checkObjective()) { finishUnit(u); return; } if (canDart(u)) startDart(u); else finishUnit(u); }
// Dart: a second, short move with no menu afterwards. Reuses the move mode (blue tiles, arrow, BACK) with BT.dart set;
// confirming a tile or pressing back/OK on the unit's own tile ends the unit's turn. There is no undo of the attack.
function startDart(u) {
  BT.sel = u; BT.reach = reachable(u, u.x, u.y, dartMov(u)); BT.atk = []; BT.path = [{ x: u.x, y: u.y }]; BT.mode = 'move'; BT.dart = true; BT.undo = null; BT.cx = u.x; BT.cy = u.y; keepCursorVisible();
  Audio.sfx('select'); floatText(u.x * TILE + TILE / 2, u.y * TILE - 6, 'DART!', ROLES.scout.col, { outline: '#000', life: .9 });
}
// The player's skill: apply it, play the events, spend the unit.
function confirmSkill() {
  const u = BT.sel, t = BT.targets[BT.tIdx]; if (!u || !t || skillCheck(u, u.skill, t) !== null) { Audio.sfx('error'); return; } Audio.sfx('ok');
  const ev = useSkill(u, u.skill, t); if (!ev) { Audio.sfx('error'); return; } BT.queue = ev.map(e => ({ kind: 'event', ev: e })); BT.mode = 'anim';
  playQueue(() => { finishUnit(u); });
}
function skillQueue(u, sk, t) { return (useSkill(u, sk, t) || []).map(e => ({ kind: 'event', ev: e })); }
// Cooldown wording that matches the timing: cd 2 = use now, ready again two turns on = every other turn.
function cooldownText(sk) { return sk.cd === 2 ? 'every other turn' : 'again in ' + sk.cd + ' turns'; }
// The one place an exchange is resolved for display: snapshot both HP values, roll the combat once, and
// hand the same event list to whichever presentation is active (duel scene or strikes on the board).
// The resolver also levels up, evolves and inflicts statuses before any of it is shown, so the scene works from
// immutable snapshots of what both units looked like beforehand (duelView) and the board keeps drawing the
// pre-evolution form until the evolution event plays.
function combatQueue(att, def, move, from) {
  const hp0 = { [att.id]: att.hp, [def.id]: def.hp }, view = duelView([att, def]); const ev = resolveCombat(att, def, move, from);
  for (const e of ev) if (e.type === 'evolve' && !e.unit.fx.showNum) e.unit.fx.showNum = e.from.num;
  return eventsToQueue(ev, att, def, { hp0, view });
}
const DUEL_EVENTS = new Set(['hit', 'miss', 'ko', 'thaw']);
function eventsToQueue(ev, u, t, snap) {
  const q = [];
  if (snap && PREF.battle !== 'map') { // the strikes and KOs play in the scene; recharge, XP, level ups and evolutions follow on the board
    const scene = ev.filter(e => DUEL_EVENTS.has(e.type)); if (scene.length) q.push({ kind: 'duel', att: u, def: t, events: scene, hp0: snap.hp0, view: snap.view });
    for (const e of ev) if (!DUEL_EVENTS.has(e.type)) q.push({ kind: 'event', ev: e });
    return q;
  }
  for (const e of ev) {
    if (e.type === 'hit' || e.type === 'miss') { const d = dist(e.att, e.def); q.push({ kind: 'strike', att: e.att, def: e.def, move: e.move, ev: e, ranged: d > 1 }); }
    else q.push({ kind: 'event', ev: e });
  }
  return q;
}
// KO bookkeeping for the results screen, done once per KO event whichever presentation shows it.
function noteKo(e) { if (e.noted) return; e.noted = true; if (e.unit.team !== 0) B.kills++; if (e.unit.leader) BT.leaderDown = true; }
function confirmCatch() {
  const u = BT.sel, t = BT.targets[BT.tIdx]; const ball = BT.ball; if (!t || !ball) return;
  B.bag[ball]--; if (B.bag[ball] <= 0) delete B.bag[ball]; const r = tryCapture(t, ITEMS[ball]);
  BT.queue = [{ kind: 'event', ev: { type: 'capture', unit: t, ok: r.ok, shakes: r.shakes, from: { x: u.x, y: u.y }, ball } }];
  if (r.ok) BT.queue.push({ kind: 'fn', fn: () => {
    if (B.versus) { t.team = u.team; t.acted = true; t.moved = true; t.ai = null; t.boss = false; t.status = null; t.hp = Math.max(1, Math.floor(t.maxHp * .5)); t.fx.alpha = 1; t.fx.sx = t.fx.sy = 1; floatText(t.x * TILE + TILE / 2, t.y * TILE - 6, 'Joined ' + teamName(u.team) + '!', teamColor(u.team), { outline: UI.shadow, life: 1.6 }); }
    else { t.hp = 0; t.captured = true; B.captured.push(serializeUnit(Object.assign({}, t, { team: 0, hp: Math.max(1, Math.floor(t.maxHp * .5)) }))); } } });
  playQueue(() => { finishUnit(u); });
}
function finishUnit(u) {
  u.acted = true; u.moved = true; BT.sel = null; BT.reach = null; BT.atk = null; BT.undo = null; BT.menu = null; BT.dart = false; BT.hpShow.clear();
  for (const v of B.units) { v.fx.dx = v.fx.dy = 0; v.fx.sx = v.fx.sy = 1; v.fx.alpha = 1; v.fx.flash = 0; v.fx.showNum = null; }
  if (checkObjective()) { endBattle(); return; }
  if (!B.territory && alive(HT()).every(v => v.acted)) { BT.mode = 'idle'; BT.autoEnd = .6; return; }
  BT.mode = 'idle'; const f = alive(HT()).find(v => !v.acted); if (f && !VIEW.touch) { /* keep the cursor where it is; the player picks the next unit */ }
}
function cancel() {
  if (BT.mode === 'move' && BT.dart) { const u = BT.sel; BT.cx = u.x; BT.cy = u.y; Audio.sfx('cancel'); finishUnit(u); } // staying put ends the darting unit's turn
  else if (BT.mode === 'move') { BT.sel.fx.sx = BT.sel.fx.sy = 1; BT.cx = BT.sel.x; BT.cy = BT.sel.y; BT.sel = null; BT.reach = null; BT.atk = null; BT.mode = 'idle'; Audio.sfx('cancel'); }
  else if (BT.mode === 'menu') { const u = BT.sel; if (BT.undo && BT.undo.unit === u) { u.x = BT.undo.x; u.y = BT.undo.y; u.moved = false; BT.undo = null; } BT.menu = null; selectUnit(u); BT.cx = u.x; BT.cy = u.y; Audio.sfx('cancel'); }
  else if (BT.mode === 'target' || BT.mode === 'catchTarget' || BT.mode === 'skillTarget' || BT.mode === 'item') { BT.mode = 'menu'; BT.cx = BT.sel.x; BT.cy = BT.sel.y; openActionMenu(BT.sel); Audio.sfx('cancel'); }
  else if (BT.mode === 'ballPick') { BT.mode = 'catchTarget'; Audio.sfx('cancel'); }
  else if (BT.mode === 'itemTarget') { BT.mode = 'item'; Audio.sfx('cancel'); }
  else if (BT.mode === 'help' || BT.mode === 'unitinfo' || BT.mode === 'endmenu') { BT.mode = 'idle'; Audio.sfx('cancel'); }
  else if (BT.mode === 'idle') { openEndMenu(); Audio.sfx('menu'); }
}
const BATTLE_PREF_LABEL = { full: 'Full duel', quick: 'Quick duel', map: 'Map only' };
function openEndMenu(keepIndex = 0) {
  BT.mode = 'endmenu';
  BT.menu = { items: [{ id: 'endturn', label: 'End Turn', icon: 'end', sub: B.versus ? 'Pass to the other trainer' : 'Pass to the enemy' }, { id: 'danger', label: (BT.showDanger ? 'Hide' : 'Show') + ' Danger', icon: 'skull', sub: 'Enemy attack range' }, { id: 'scene', label: 'Battle: ' + BATTLE_PREF_LABEL[PREF.battle], icon: 'vs', sub: 'Attack scene: full, quick or on the map' }, { id: 'help', label: 'Help', icon: 'help', sub: 'Controls & rules' }, { id: 'mute', label: Audio.muted ? 'Unmute' : 'Mute', icon: 'note', sub: 'Sound on/off' }, { id: 'retreat', label: B.versus ? 'Forfeit' : 'Retreat', icon: 'run', sub: B.versus ? 'Concede the arena' : 'Give up this map' }, { id: 'close', label: 'Close', icon: 'x', sub: '' }], i: keepIndex };
  if (B.territory) BT.menu.items.splice(1, 0, { id: 'reserves', label: 'Reserves', icon: 'ball', sub: B.territory.points[HT()] + ' CP · choose an owned center' });
}
function endTurn() { BT.mode = 'anim'; BT.sel = null; BT.autoEnd = 0; for (const u of alive(HT())) u.acted = true; nextPhase(); }

// ---------------------------------------------------------------- enemy phase playback
function runEnemyPhase(team) {
  const order = alive(team).filter(u => u.hp > 0 && !u.acted).sort((a, b) => b.level - a.level); // acted: spent the turn recharging
  const step = () => {
    if (checkObjective()) { endBattle(); return; }
    const u = order.shift(); if (!u) { nextPhase(); return; }
    if (u.hp <= 0) { step(); return; }
    if (!canTakeAction(u)) { step(); return; }
    const d = aiDecide(u);
    if (!d) { step(); return; }
    BT.queue = [];
    if (d.x !== u.x || d.y !== u.y) { const reach = reachable(u); const p = pathTo(reach, d.x, d.y); if (p) BT.queue.push({ kind: 'fn', fn: () => { centerCam(u.x, u.y); } }, { kind: 'wait', t2: .25 }, { kind: 'move', unit: u, path: p }); }
    if (d.capture) { BT.queue.push({ kind: 'fn', fn: () => { const e = territoryCapture(u); if (e) BT.queue.unshift({ kind: 'event', ev: e }); } }); }
    else if (d.skill) { BT.queue.push({ kind: 'fn', fn: () => { BT.queue.unshift(...skillQueue(u, d.skill, d.target)); } }); }
    else if (d.target) {
      BT.queue.push({ kind: 'fn', fn: () => { BT.queue.unshift(...combatQueue(u, d.target, d.move, { x: d.x, y: d.y })); } });
      // a scout darts once the exchange has played out (the queue item runs after the duel, so the outcome is known)
      BT.queue.push({ kind: 'fn', fn: () => { const c = aiDart(u); if (!c) return; const p = pathTo(reachable(u, u.x, u.y, dartMov(u)), c.x, c.y); if (p) BT.queue.unshift({ kind: 'fn', fn: () => floatText(u.x * TILE + TILE / 2, u.y * TILE - 6, 'DART!', ROLES.scout.col, { outline: '#000', life: .9 }) }, { kind: 'move', unit: u, path: p }); } });
    }
    BT.queue.push({ kind: 'wait', t2: .15 });
    playQueue(() => { u.acted = true; step(); });
  };
  step();
}

// ---------------------------------------------------------------- input handling
function battleInput(ev) {
  if (ev.type === 'key' && ev.key === 'mute') { Audio.toggle(); return; }
  if (ev.type === 'key' && ev.key === 'fast') { BT.fast = !BT.fast; const d = duelActive(); floatText(d ? VIEW.w / 2 : bvW() / 2 + CAM.x, d ? 40 : CAM.y + 40 / BT.zoom, BT.fast ? 'FAST MODE' : 'NORMAL SPEED', UI.gold); return; }
  if (BT.mode === 'territoryGuide') { if (ev.type === 'key' && (ev.key === 'ok' || ev.key === 'back')) closeTerritoryGuide(); else if (ev.type === 'up') hudHit(ev.x, ev.y); return; }
  if (duelActive()) { duelInput(BT.anim, ev); return; }
  if (ev.type === 'key' && (ev.key === 'zoomin' || ev.key === 'zoomout')) { if (setZoom(ev.key === 'zoomin' ? 1 : .5)) Audio.sfx('menu'); return; }
  if (BT.mode === 'banner') { if (ev.type === 'down' || (ev.type === 'key' && ev.key === 'ok')) BT.banner.t = Math.max(BT.banner.t, 1.1); return; }
  if (BT.mode === 'handoff') { if (BT.handoff.t > .4 && (ev.type === 'up' || (ev.type === 'key' && ev.key === 'ok'))) { BT.mode = 'banner'; BT.banner.t = 0; Audio.sfx('phase'); } return; }
  if (BT.mode === 'anim') { if (ev.type === 'down' || ev.type === 'key') { BT.fastTap = .4; } return; }
  if (BT.mode === 'end') { if (BT.endTimer > 1.2 && (ev.type === 'down' || (ev.type === 'key' && ev.key === 'ok'))) { BT.endTimer = 99; } return; }
  if (BT.mode === 'help') { if (ev.type === 'down' || (ev.type === 'key')) { if (ev.type === 'key' && (ev.key === 'right' || ev.key === 'ok') || ev.type === 'down') { const r = helpRect(); if (r.next != null) BT.helpOffset = r.next; else { BT.helpOffset = 0; BT.helpPage++; if (BT.helpPage >= HELP_PAGES.length) { BT.helpPage = 0; BT.mode = 'idle'; } } } else if (ev.key === 'left') { if (BT.helpOffset) BT.helpOffset = Math.max(0, BT.helpOffset - helpRect().limit); else BT.helpPage = Math.max(0, BT.helpPage - 1); } else if (ev.key === 'back' || ev.key === 'help') { BT.mode = 'idle'; BT.helpPage = 0; BT.helpOffset = 0; } } return; }
  if (BT.mode === 'unitinfo') { if (ev.type === 'down' || ev.type === 'key') { if (ev.type === 'key' && (ev.key === 'left' || ev.key === 'right' || ev.key === 'prev' || ev.key === 'next')) { const list = B.units.filter(u => u.hp > 0); let i = list.indexOf(BT.info); i = (i + (ev.key === 'left' || ev.key === 'prev' ? -1 : 1) + list.length) % list.length; BT.info = list[i]; BT.cx = BT.info.x; BT.cy = BT.info.y; keepCursorVisible(); Audio.sfx('cursor'); } else { BT.mode = 'idle'; Audio.sfx('cancel'); } } return; }
  if (ev.type === 'key') { keyInput(ev.key); return; }
  if (ev.type === 'wheel') { CAM.tx += ev.dx / BT.zoom; CAM.ty += ev.dy / BT.zoom; clampCam(); return; }
  pointerInput(ev);
}
function menuNav(dir) { const m = BT.menu; if (!m) return; m.i = (m.i + dir + m.items.length) % m.items.length; Audio.sfx('menu'); }
function keyInput(k) {
  const m = BT.mode;
  if (m === 'menu' || m === 'item' || m === 'endmenu' || m === 'ballPick') { if (k === 'up') menuNav(-1); else if (k === 'down') menuNav(1); else if (k === 'ok') activateMenu(); else if (k === 'back') cancel(); return; }
  if (m === 'target' || m === 'catchTarget' || m === 'skillTarget') { if (k === 'left' || k === 'up' || k === 'prev') { BT.tIdx = (BT.tIdx - 1 + BT.targets.length) % BT.targets.length; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } else if (k === 'right' || k === 'down' || k === 'next') { BT.tIdx = (BT.tIdx + 1) % BT.targets.length; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } else if (k === 'info') { BT.moveIdx++; Audio.sfx('menu'); } else if (k === 'ok') { if (m === 'target') confirmAttack(); else if (m === 'skillTarget') confirmSkill(); else pickBall(); } else if (k === 'back') cancel(); return; }
  if (m === 'itemTarget') { if (k === 'ok') useItemOn(BT.sel); else if (k === 'back') cancel(); return; }
  if (k === 'help') { BT.mode = 'help'; BT.helpPage = 0; BT.helpOffset = 0; return; }
  const dx = k === 'left' ? -1 : k === 'right' ? 1 : 0, dy = k === 'up' ? -1 : k === 'down' ? 1 : 0;
  if (dx || dy) { const nx = clamp(BT.cx + dx, 0, B.map.w - 1), ny = clamp(BT.cy + dy, 0, B.map.h - 1); if (nx !== BT.cx || ny !== BT.cy) { BT.cx = nx; BT.cy = ny; keepCursorVisible(); Audio.sfx('cursor'); if (m === 'move') extendPath(nx, ny); } return; }
  if (k === 'ok') { tileAction(BT.cx, BT.cy); return; }
  if (k === 'back') { cancel(); return; }
  if (k === 'next' || k === 'prev') { const list = alive(HT()).filter(u => !u.acted); if (list.length && m === 'idle') { const cur = list.findIndex(u => u.x === BT.cx && u.y === BT.cy); const n = list[(cur + (k === 'next' ? 1 : -1) + list.length) % list.length]; BT.cx = n.x; BT.cy = n.y; keepCursorVisible(); Audio.sfx('cursor'); } return; }
  if (k === 'info') { const u = unitAt(BT.cx, BT.cy); if (u && m === 'idle') { BT.info = u; BT.mode = 'unitinfo'; Audio.sfx('ok'); } return; }
}
function activateMenu() {
  const m = BT.menu; const it = m.items[m.i]; if (!it) return;
  if (territoryMenuAction(it)) return;
  if (it.off) { Audio.sfx('error'); return; }
  if (BT.mode === 'menu') menuChoose(it.id);
  else if (BT.mode === 'item') { BT.item = it.id; BT.mode = 'itemTarget'; Audio.sfx('ok'); }
  else if (BT.mode === 'ballPick') { BT.ball = it.id; confirmCatch(); }
  else if (BT.mode === 'endmenu') { Audio.sfx('ok'); if (it.id === 'endturn') endTurn(); else if (it.id === 'danger') { BT.showDanger = !BT.showDanger; BT.mode = 'idle'; } else if (it.id === 'scene') { cyclePref('battle'); openEndMenu(m.i); } else if (it.id === 'help') { BT.mode = 'help'; BT.helpPage = 0; BT.helpOffset = 0; } else if (it.id === 'mute') { Audio.toggle(); BT.mode = 'idle'; } else if (it.id === 'retreat') { B.result = B.versus ? (HT() === 0 ? 'p2' : 'p1') : 'retreat'; endBattle(); } else BT.mode = 'idle'; }
}
function pickBall() { const balls = Object.keys(B.bag).filter(k => ITEMS[k].kind === 'ball' && B.bag[k] > 0); if (!balls.length) { Audio.sfx('error'); return; } const t = BT.targets[BT.tIdx]; BT.menu = { items: balls.map(k => ({ id: k, label: ITEMS[k].name + ' ×' + B.bag[k], sub: Math.round(clamp((.22 + .68 * (1 - t.hp / t.maxHp)) * ITEMS[k].rate * (t.status ? 1.3 : 1) * (t.boss ? .5 : 1), .05, .97) * 100) + '% chance' })), i: 0 }; BT.mode = 'ballPick'; Audio.sfx('ok'); }
function useItemOn(u) { const it = BT.item; B.bag[it]--; if (B.bag[it] <= 0) delete B.bag[it]; Audio.sfx('item'); const ev = useItem(u, it); BT.queue = ev.map(e => ({ kind: 'event', ev: e })); playQueue(() => finishUnit(u)); }
function tileAction(x, y) {
  const m = BT.mode; const u = unitAt(x, y);
  if (m === 'idle') {
    if (B.territory && !u) { const p = territoryProperty(x, y); if (p && p.owner === HT()) { openTerritoryReserves(p); return; } }
    if (u && u.team === HT() && !u.acted) { selectUnit(u); return; }
    if (u) { BT.info = u; BT.mode = 'unitinfo'; Audio.sfx('ok'); return; }
    cancel(); return; // empty tile → end-turn menu
  }
  if (m === 'move') {
    if (u && u === BT.sel) { BT.path = [{ x: u.x, y: u.y }]; confirmMove(); return; }
    if (u && u.team === HT() && !u.acted) { cancel(); selectUnit(u); return; } // during a dart this ends the darting unit first
    if (!BT.dart && (u && hostile(u.team, HT()) && BT.atk.some(c => c.x === x && c.y === y) || (u && hostile(u.team, HT()) && BT.reach.has(key(x, y))))) { // quick-attack: move next to it and attack
      const spots = [...BT.reach.values()].filter(n => canStand(BT.sel, n.x, n.y) && usableMoves(BT.sel, Math.abs(n.x - u.x) + Math.abs(n.y - u.y)).length);
      if (spots.length) { spots.sort((a, b) => (terrainDef(terrAt(b.x, b.y), BT.sel) - terrainDef(terrAt(a.x, a.y), BT.sel)) || (dist(a, BT.sel) - dist(b, BT.sel))); const s = spots[0]; BT.path = pathTo(BT.reach, s.x, s.y); BT.pendingTarget = u; confirmMoveThenAttack(); return; }
    }
    if (BT.reach.has(key(x, y)) && canStand(BT.sel, x, y)) { extendPath(x, y); confirmMove(); return; }
    Audio.sfx('error'); return;
  }
}
function confirmMoveThenAttack() { const u = BT.sel; BT.undo = { unit: u, x: u.x, y: u.y }; Audio.sfx('ok'); BT.queue = [{ kind: 'move', unit: u, path: BT.path.slice() }]; playQueue(() => { u.moved = true; pickupAt(u); openActionMenu(u); const t = BT.pendingTarget; BT.pendingTarget = null; const tg = targetsFrom(u, u.x, u.y); if (t && tg.includes(t)) { BT.targets = tg; BT.tIdx = tg.indexOf(t); BT.moveIdx = 0; BT.mode = 'target'; setTargetCursor(); } }); }
// A pointer that has not moved since an overlay closed under it must not drive the cursor: the hover anchor is
// set on every mode change and released once the pointer travels a few pixels.
function hoverLocked(ev) { const a = BT.hoverAnchor; if (!a) return false; if (Math.abs(ev.x - a.x) + Math.abs(ev.y - a.y) <= 4) return true; BT.hoverAnchor = null; return false; }
function pointerInput(ev) {
  const m = BT.mode;
  if (ev.type === 'down') { BT.dragStart = { x: ev.x, y: ev.y, cx: CAM.tx, cy: CAM.ty }; BT.dragged = false; if (ev.btn === 2) { cancel(); BT.dragStart = null; return; } }
  if (ev.type === 'move') {
    if (BT.dragStart && INPUT.down) { const dx = ev.x - BT.dragStart.x, dy = ev.y - BT.dragStart.y; if (BT.dragged || Math.abs(dx) + Math.abs(dy) > 6) { BT.dragged = true; CAM.tx = BT.dragStart.cx - dx / BT.zoom; CAM.ty = BT.dragStart.cy - dy / BT.zoom; clampCam(); CAM.x = CAM.tx; CAM.y = CAM.ty; } return; }
    if (ev.touch || hoverLocked(ev)) return;
    const { x: tx, y: ty } = screenToTile(ev.x, ev.y);
    if (m === 'menu' || m === 'item' || m === 'endmenu' || m === 'ballPick') { const h = menuHit(ev.x, ev.y); if (h >= 0 && h !== BT.menu.i) { BT.menu.i = h; Audio.sfx('menu'); } return; }
    if (m === 'target' || m === 'catchTarget' || m === 'skillTarget') { const ti = BT.targets.findIndex(t => t.x === tx && t.y === ty); if (ti >= 0 && ti !== BT.tIdx) { BT.tIdx = ti; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } return; }
    if (hudCovers(ev.x, ev.y)) return; // pointer over a HUD panel: the board underneath is not being pointed at
    if (inMap(tx, ty) && (tx !== BT.cx || ty !== BT.cy) && (m === 'idle' || m === 'move')) { BT.cx = tx; BT.cy = ty; if (m === 'move') extendPath(tx, ty); }
    return;
  }
  if (ev.type === 'up') {
    if (BT.dragged) { BT.dragged = false; BT.dragStart = null; return; } BT.dragStart = null;
    const { x: tx, y: ty } = screenToTile(ev.x, ev.y);
    if (hudHit(ev.x, ev.y)) return;
    if (m === 'menu' || m === 'item' || m === 'endmenu' || m === 'ballPick') { const h = menuHit(ev.x, ev.y); if (h >= 0) { BT.menu.i = h; activateMenu(); } else cancel(); return; }
    if (m === 'target' || m === 'catchTarget' || m === 'skillTarget') { const go = () => { if (m === 'target') confirmAttack(); else if (m === 'skillTarget') confirmSkill(); else pickBall(); }; const ti = BT.targets.findIndex(t => t.x === tx && t.y === ty); if (ti >= 0) { if (ti === BT.tIdx) go(); else { BT.tIdx = ti; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } } else if (forecastHit(ev.x, ev.y)) go(); else if (m === 'target' && moveSwitchHit(ev.x, ev.y)) { BT.moveIdx++; Audio.sfx('menu'); } else cancel(); return; }
    if (m === 'itemTarget') { useItemOn(BT.sel); return; }
    if (hudCovers(ev.x, ev.y)) return; // a tap on a card is not a tap on the tile under it
    if (!inMap(tx, ty)) { if (m === 'move') cancel(); return; }
    if (ev.touch && (tx !== BT.cx || ty !== BT.cy) && m === 'move') { BT.cx = tx; BT.cy = ty; extendPath(tx, ty); keepCursorVisible(); Audio.sfx('cursor'); const u = unitAt(tx, ty); if (!u || u === BT.sel) return; }
    if (ev.touch && m === 'idle' && (tx !== BT.cx || ty !== BT.cy)) { BT.cx = tx; BT.cy = ty; keepCursorVisible(); const u = unitAt(tx, ty); if (!u) { Audio.sfx('cursor'); return; } }
    BT.cx = tx; BT.cy = ty; tileAction(tx, ty);
  }
}

// ---------------------------------------------------------------- update
function battleUpdate(dt) {
  BT.time += dt;
  if (BT.mode !== BT.lastMode) { BT.lastMode = BT.mode; BT.hoverAnchor = { x: INPUT.x, y: INPUT.y }; }
  if (FX.hitstop > 0) { FX.hitstop -= dt; dt *= .15; }
  if (BT.fastTap > 0) { BT.fastTap -= dt; dt *= 2.2; }
  const cs = BT.mode === 'anim' || BT.mode === 'banner' ? 10 : 14; CAM.x += (CAM.tx - CAM.x) * Math.min(1, dt * cs); CAM.y += (CAM.ty - CAM.y) * Math.min(1, dt * cs); if (Math.abs(CAM.tx - CAM.x) < .5) CAM.x = CAM.tx; if (Math.abs(CAM.ty - CAM.y) < .5) CAM.y = CAM.ty;
  for (const u of B.units) { const f = u.fx; f.sx += (1 - f.sx) * Math.min(1, dt * 12); f.sy += (1 - f.sy) * Math.min(1, dt * 12); if (f.hit > 0) { f.hit -= dt; if (f.hit <= 0) { f.flash = 0; f.dx = f.dy = 0; } } if (f.dodge > 0) { f.dodge -= dt; if (f.dodge <= 0) f.dx = 0; } }
  for (const [id, h] of BT.hpShow) { if (h.hold) continue; h.t += dt * 2.5; if (h.t >= 1) BT.hpShow.delete(id); }
  if (BT.quip) { BT.quip.t += dt; if (BT.quip.t > 1.6) BT.quip = null; }
  if (BT.mode === 'handoff') BT.handoff.t += dt;
  if (BT.mode === 'banner') { BT.banner.t += dt; if (BT.banner.t > (BT.fast ? .9 : 1.5)) { BT.mode = 'anim'; const f = BT.afterBanner; BT.afterBanner = null; f(); } }
  if (BT.mode === 'anim') updateAnim(dt);
  if (BT.mode === 'end') { BT.endTimer += dt; if (BT.endTimer > 3.5 || BT.endTimer >= 99) { BT.endTimer = 0; onBattleEnd(B.result); } }
  if (BT.autoEnd > 0 && BT.mode === 'idle') { BT.autoEnd -= dt; if (BT.autoEnd <= 0) endTurn(); }
  if (!B.territory && BT.mode === 'idle' && isHuman(B.phase) && !alive(B.phase).some(u => !u.acted) && !BT.autoEnd && !B.result) BT.autoEnd = .4;
  updateFX(dt); Audio.tick();
}

// ---------------------------------------------------------------- drawing
function battleDraw() {
  const d = duelActive(); if (d) { drawDuelFrame(d); return; }
  drawBoard(); drawHUD();
}
// The board layer is drawn in board space under ctx.scale(BT.zoom); floating texts and the screen flash are
// drawn afterwards at screen scale so they stay legible when zoomed out.
function drawBoard() {
  ctx.save(); ctx.scale(BT.zoom, BT.zoom); drawBoardLayer(); ctx.restore();
  drawFXTexts(-CAM.x + FX.shakeX, -CAM.y + FX.shakeY, BT.zoom);
  if (FX.flash > 0) { ctx.globalAlpha = FX.flash * .7; rect(0, 0, VIEW.w, VIEW.h, FX.flashCol); ctx.globalAlpha = 1; }
}
function drawBoardLayer() {
  const m = B.map; const f = Math.floor(BT.time * 3) % WATER_FRAMES;
  drawVoid();
  const x0 = Math.max(0, Math.floor(CAM.x / TILE)), y0 = Math.max(0, Math.floor(CAM.y / TILE)), x1 = Math.min(m.w - 1, Math.ceil((CAM.x + bvW()) / TILE)), y1 = Math.min(m.h - 1, Math.ceil((CAM.y + bvH()) / TILE));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    drawTerrain(ctx, m, x, y, tileX(x), tileY(y), f, BT.time);
  }
  // items on the floor
  for (const it of m.items) if (!it.taken) { const X = tileX(it.x) + TILE / 2, Y = tileY(it.y) + TILE / 2 + Math.round(Math.sin(BT.time * 4 + it.x) * 2); drawBall(X, Y, ITEMS[it.item] ? ITEMS[it.item].col : '#f04848', 5); if (Math.floor(BT.time * 6 + it.x) % 5 === 0) px(X + 6, Y - 6, '#ffffff'); }
  // seize target marker
  if (m.seize) { const X = tileX(m.seize.x), Y = tileY(m.seize.y); const k = Math.floor(BT.time * 4) % 2; outline(X + 2 + k, Y + 2 + k, TILE - 4 - 2 * k, TILE - 4 - 2 * k, UI.gold); bigC('!', X + TILE / 2, Y - 8 + Math.round(Math.sin(BT.time * 5) * 2), UI.gold, { outline: '#000' }); }
  // danger zone: wild threats in yellow underneath, trainer threats in red on top
  if (BT.showDanger && (BT.mode === 'idle' || BT.mode === 'move')) {
    const dz = dangerZones(HT()); const toCells = set => [...set].map(k => { const [x, y] = k.split(',').map(Number); return { x, y }; });
    rangeOverlay(toCells(dz.wild), (x, y) => dz.wild.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, DANGER.wild[0], DANGER.wild[1], Math.floor(BT.time * 6));
    rangeOverlay(toCells(dz.trainer), (x, y) => dz.trainer.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, DANGER.trainer[0], DANGER.trainer[1], Math.floor(BT.time * 6));
  }
  // move / attack ranges
  if (BT.sel && (BT.mode === 'move' || BT.mode === 'anim' && BT.anim && BT.anim.kind === 'move' && BT.anim.unit === BT.sel)) {
    const cells = [...BT.reach.values()].filter(n => canStand(BT.sel, n.x, n.y));
    rangeOverlay(cells, (x, y) => BT.reach.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#3060e0', '#a0c0ff', Math.floor(BT.time * 6));
    rangeOverlay(BT.atk, (x, y) => BT.reach.has(key(x, y)) || BT.atk.some(c => c.x === x && c.y === y), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e03030', '#ffa0a0', Math.floor(BT.time * 6));
  }
  if (BT.mode === 'unitinfo' && BT.info && BT.info.team !== HT()) { const r = reachable(BT.info); const cells = [...r.values()].filter(n => canStand(BT.info, n.x, n.y)); rangeOverlay(cells, (x, y) => r.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e03030', '#ffa0a0', Math.floor(BT.time * 6)); const ac = attackCells(BT.info, r); rangeOverlay(ac, (x, y) => r.has(key(x, y)) || ac.some(c => c.x === x && c.y === y), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e07030', '#ffc0a0', Math.floor(BT.time * 6)); }
  if (B.territory) drawTerritoryProperties();
  // target highlights: red for foes, green for allies and self (skills), the chosen one white
  if (BT.mode === 'target' || BT.mode === 'catchTarget' || BT.mode === 'skillTarget') for (const t of BT.targets) { const X = tileX(t.x), Y = tileY(t.y); const k = Math.floor(BT.time * 8) % 2; const friendly = !hostile(t.team, HT()); outline(X + 1 + k, Y + 1 + k, TILE - 2 - 2 * k, TILE - 2 - 2 * k, t === BT.targets[BT.tIdx] ? '#ffffff' : friendly ? '#60e070' : '#ff6060'); }
  if (BT.mode === 'skillTarget' && BT.sel && BT.sel.skill && BT.sel.skill.rng[1] > 0) { const rc = ring(BT.sel.x, BT.sel.y, BT.sel.skill.rng[0], BT.sel.skill.rng[1]); rangeOverlay(rc, (x, y) => rc.some(c => c.x === x && c.y === y), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, BT.sel.skill.target === 'foe' ? '#e03030' : '#30a050', BT.sel.skill.target === 'foe' ? '#ffa0a0' : '#a0ffb0', Math.floor(BT.time * 6)); }
  if (BT.mode === 'move' && BT.path.length > 1) drawArrow(BT.path, -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, BT.time * 1000);
  if (['idle', 'move', 'target', 'catchTarget', 'skillTarget', 'unitinfo'].includes(BT.mode)) drawCursorGlow(tileX(BT.cx), tileY(BT.cy), BT.time * 1000);
  // units (sorted by y so southern sprites overlap northern ones)
  // a unit whose KO the duel scene has not shown yet stays on the board (its HP bar is held at the pre-exchange value)
  const held = u => { const h = BT.hpShow.get(u.id); return h && h.hold; };
  const units = B.units.filter(u => u.hp > 0 || (BT.anim && BT.anim.kind === 'event' && (BT.anim.ev.unit === u)) || held(u)).sort((a, b) => (a.y + a.fx.dy / TILE) - (b.y + b.fx.dy / TILE));
  for (const u of units) drawUnit(u);
  // cursor
  if (['idle', 'move', 'target', 'catchTarget', 'skillTarget', 'unitinfo'].includes(BT.mode)) { const hostileCur = unitAt(BT.cx, BT.cy) && hostile(unitAt(BT.cx, BT.cy).team, HT()); drawCursor(tileX(BT.cx), tileY(BT.cy), BT.time * 1000, '#ffffff', (BT.mode === 'target' || hostileCur) ? '#ff5a5a' : BT.mode === 'skillTarget' ? '#60e070' : '#ffd24a'); }
  if (BT.anim && BT.anim.ball) { const b = BT.anim.ball; drawBall(Math.round(b.x - CAM.x), Math.round(b.y - CAM.y), ITEMS[BT.anim.ev.ball].col, 5); }
  drawFX(-CAM.x + FX.shakeX, -CAM.y + FX.shakeY, false);
}
// The land outside the board: the map's own border terrain, dimmed, so the world seems to continue past the frame.
const VOID = { key: null, canvas: null };
function voidPattern() {
  const m = B.map; const counts = {}; for (let x = 0; x < m.w; x++) { for (const t of [m.tiles[0][x], m.tiles[m.h - 1][x]]) counts[t.ch] = (counts[t.ch] || 0) + 1; } for (let y = 0; y < m.h; y++) { for (const t of [m.tiles[y][0], m.tiles[y][m.w - 1]]) counts[t.ch] = (counts[t.ch] || 0) + 1; }
  let ch = '.', best = -1; for (const k in counts) if (counts[k] > best && !['~', 'w', 'L', '='].includes(k)) { best = counts[k]; ch = k; }
  if (ch === 'W' || ch === 'b') ch = ch === 'W' ? 'c' : 'f'; if (ch === 'T' || ch === 'M' || ch === 'H' || ch === 'C' || ch === 'G') ch = '.';
  const key = m.name + ch; if (VOID.key === key) return VOID.canvas;
  const c = document.createElement('canvas'); c.width = TILE * 4; c.height = TILE * 4; const g = c.getContext('2d');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.drawImage(tileImg(ch, (x * 3 + y * 5) % VARIANTS, 0), x * TILE, y * TILE);
  g.fillStyle = 'rgba(8,10,20,.68)'; g.fillRect(0, 0, c.width, c.height);
  VOID.key = key; VOID.canvas = c; return c;
}
function drawVoid() {
  const W = bvW(), H = bvH(); rect(0, 0, W, H, '#101219');
  const pat = voidPattern(); const pw = pat.width; const ox = ((tileX(0) % pw) + pw) % pw - pw, oy = ((tileY(0) % pw) + pw) % pw - pw;
  for (let y = oy; y < H; y += pw) for (let x = ox; x < W; x += pw) ctx.drawImage(pat, x, y);
  const mx = tileX(0), my = tileY(0), mw = B.map.w * TILE, mh = B.map.h * TILE;
  // drop shadow, then a bevelled wooden frame around the board
  ctx.globalAlpha = .55; rect(mx - 2, my - 2, mw + 12, mh + 12, '#000000'); ctx.globalAlpha = 1;
  rect(mx - 6, my - 6, mw + 12, mh + 12, '#5c4224'); rect(mx - 5, my - 5, mw + 10, mh + 10, '#a8744a'); rect(mx - 4, my - 4, mw + 8, mh + 8, '#7a4f2c');
  hline(mx - 5, my - 5, mw + 10, '#d2a266'); vline(mx - 5, my - 5, mh + 10, '#d2a266'); hline(mx - 5, my + mh + 4, mw + 10, '#4a2c16'); vline(mx + mw + 4, my - 5, mh + 10, '#4a2c16');
  outline(mx - 2, my - 2, mw + 4, mh + 4, '#2a1a10'); outline(mx - 1, my - 1, mw + 2, mh + 2, '#0b1020');
  for (const [cx, cy] of [[mx - 5, my - 5], [mx + mw + 2, my - 5], [mx - 5, my + mh + 2], [mx + mw + 2, my + mh + 2]]) { rect(cx, cy, 3, 3, '#d2a266'); px(cx + 1, cy + 1, '#5c4224'); }
}
// How a unit presents on the board. `grey` follows the model alone (a unit that has acted this phase is greyed
// whatever the mode, and one that has not is never greyed, even while another animation plays); `ready` is the
// controlling team's unit that can still act; `busy` is a unit taking part in the current animation.
function unitLook(u) {
  const mine = u.team === HT() && isHuman(B.phase) && !B.result;
  const q = BT.anim; const busy = !!q && BT.mode === 'anim' && (q.unit === u || q.att === u || q.def === u || (q.ev && q.ev.unit === u));
  const grey = mine && u.acted && !busy;
  const ready = mine && !u.acted && BT.mode !== 'anim' && BT.mode !== 'banner' && BT.mode !== 'end';
  const sel = BT.sel === u && (BT.mode === 'move' || BT.mode === 'target' || BT.mode === 'skillTarget' || BT.mode === 'menu');
  const hovered = BT.cx === u.x && BT.cy === u.y && (BT.mode === 'idle' || BT.mode === 'unitinfo');
  return { grey, ready, sel, hovered, busy };
}
function drawUnit(u) {
  const f = u.fx; const X = tileX(u.x) + f.dx, Y = tileY(u.y) + f.dy; const cx = X + TILE / 2, by = Y + TILE - 3;
  const { ready, grey, sel, hovered } = unitLook(u);
  // idle life: ready units breathe with a slow hop; the hovered one perks up; the selected one bounces
  let hop = 0, bsx = 1, bsy = 1;
  if (sel) { const p = Math.abs(Math.sin(BT.time * 9)); hop = p * 3; bsy = 1 + p * .08; bsx = 1 - p * .05; }
  else if (hovered && !REDUCED) { const p = Math.abs(Math.sin(BT.time * 7 + u.id)); hop = p * 2; bsy = 1 + p * .06; bsx = 1 - p * .04; }
  else if (ready && !REDUCED) { const p = Math.abs(Math.sin(BT.time * 3 + u.id * 1.7)); hop = p * 1.5; bsy = 1 + p * .05; bsx = 1 - p * .03; }
  else if (!REDUCED && !grey) { const p = .5 + .5 * Math.sin(BT.time * 2.2 + u.id * 2.1); bsy = 1 - p * .035; bsx = 1 + p * .02; }
  const bob = -Math.round(hop); const air = (f.air || 0) + hop; const gy = by + 1 + (f.air || 0); // ground baseline
  // ground shadow + team plate (+ boss halo, + selection pulse). A ready unit's rim glints; an acted unit's plate goes grey with it.
  if (u.boss) { ctx.globalAlpha = f.alpha * .9; const k = Math.floor(BT.time * 4) % 2; ellipseRing(cx, gy, 15 + k, 6, 2, '#ffd24a'); ctx.globalAlpha = 1; }
  drawStand(cx, gy, u.team, f.alpha, air, { dim: grey, lit: ready && !REDUCED ? .35 + .35 * Math.sin(BT.time * 4 + u.id) : 0 });
  if (sel && !REDUCED) { const k = (BT.time * 1.4) % 1; ctx.globalAlpha = (1 - k) * .8 * f.alpha; ellipseRing(cx, gy, Math.round(12 + k * 8), Math.round(4 + k * 3), 1, teamColorL(u.team)); ctx.globalAlpha = 1; }
  const num = f.showNum || u.num; const flip = u.team === 1 || u.team === 2 ? f.facing !== 1 : f.facing === -1;
  let tint = null; if (f.flash) tint = '#ffffff';
  const sx = f.sx * bsx, sy = f.sy * bsy;
  if (f.alpha > 0) {
    if (grey) { ctx.globalAlpha = .9 * f.alpha; drawMon(num, cx, by + bob, { flip, sx, sy, tint: 'grey' }); ctx.globalAlpha = 1; }
    else drawMon(num, cx, by + bob, { flip, sx, sy, tint, alpha: f.alpha });
    if (f.flash === 1 && !grey) { ctx.globalAlpha = f.alpha; drawMon(num, cx, by + bob, { flip, sx, sy, tint: '#ffffff' }); ctx.globalAlpha = 1; }
  }
  // HP plate below the feet with the team glyph on its left; marks sit in the tile's top corners, off the sprite:
  // top-left: crown (leader) or skull (boss), with a CHG tag under it while recharging; top-right: status.
  const show = BT.hpShow.get(u.id); let hp = u.hp; if (show) hp = Math.round(lerp(show.from, show.to, Math.min(1, show.t)));
  if (f.alpha > 0 && hp > 0) {
    ctx.globalAlpha = f.alpha; const bw = 18, bx = cx - bw / 2 + 3, byy = gy + 4; const pc = grey ? '#2e323c' : teamColorD(u.team);
    ctx.globalAlpha = .85 * f.alpha; rrect(bx - 8, byy - 1, bw + 10, 7, UI.inset, 1); ctx.globalAlpha = f.alpha; rect(bx - 7, byy, 6, 5, pc); rect(bx, byy + 1, bw, 3, '#1c1c24');
    teamGlyph(bx - 7, byy, u.team, grey ? '#9a9eaa' : teamColorL(u.team));
    const ratio = clamp(hp / u.maxHp, 0, 1); const w = Math.round(bw * ratio);
    if (w) { const hc = hpColor(ratio); rect(bx, byy + 1, w, 3, hc); hline(bx, byy + 1, w, shade(hc, .45)); ctx.globalAlpha = .35 * f.alpha; for (let i = 4; i < w; i += 4) vline(bx + i, byy + 1, 3, '#000000'); ctx.globalAlpha = f.alpha; }
    if (show && show.t < 1 && show.from > show.to) { const w0 = Math.round(bw * clamp(show.from / u.maxHp, 0, 1)); if (w0 > w) { ctx.globalAlpha = f.alpha * (Math.floor(BT.time * 16) % 2 ? .9 : .4); rect(bx + w, byy + 1, w0 - w, 3, '#ffffff'); ctx.globalAlpha = f.alpha; } }
    const k = Math.round(Math.sin(BT.time * 5) * 1); let tl = Y - 3;
    if (u.leader) { drawCrown(X - 1, tl + k); tl += 6; } else if (u.boss) { drawSkull(X - 1, tl + k); tl += 8; }
    if (u.recharge) miniBadge('CHG', RECHARGE_COL, X - 1, tl);
    let tr = Y - 3; if (u.status) { statusBadge(u.status, X + TILE - 15, tr); tr += 7; }
    if (u.brace) { miniBadge('BRC', BRACE_COL, X + TILE - 15, tr); tr += 7; } if (u.root) miniBadge('RT', ROOT_COL, X + TILE - 15, tr);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- HUD
const HUD = { hits: [], panels: [] };
function hudHit(x, y) { for (const h of HUD.hits) if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) { h.run(); return true; } return false; }
// Is the point over a HUD panel or button drawn this frame (so the board under it is not being pointed at)?
function hudCovers(x, y) { for (const r of HUD.hits.concat(HUD.panels)) if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return true; return false; }
function hudPanel(x, y, w, h, opt) { const p = panel(x, y, w, h, opt); HUD.panels.push({ x, y, w, h }); return p; }
function button(x, y, w, h, label, run, opt = {}) { const hot = INPUT.x >= x && INPUT.y >= y && INPUT.x < x + w && INPUT.y < y + h && !VIEW.touch; uiButton(x, y, w, h, label, { hot, col: opt.col, variant: opt.variant, ink: opt.ink, icon: opt.icon, disabled: opt.disabled, on: opt.on }); HUD.hits.push({ x, y, w, h, run, label }); }
// Screen rectangle of the board (the map itself, not the void around it).
function boardRect() { const z = BT.zoom; return { x: toScreenX(tileX(0) - FX.shakeX), y: toScreenY(tileY(0) - FX.shakeY), w: Math.round(B.map.w * TILE * z), h: Math.round(B.map.h * TILE * z) }; }
// Where the HUD goes. Portrait phones stack everything under the board: context cards, then a two-row button bar.
// Wider screens keep the turn card top-left, the buttons top-right and the context cards at the bottom, on the
// side away from the cursor, hugging the board's lower edge when the board leaves room.
function hudLayout() {
  const W = VIEW.w, H = VIEW.h, bh = btnH(), stack = narrowView() && portraitView(); const br = boardRect();
  const L = { W, H, stack, bh, top: { x: 4, y: 4, w: stack ? W - 8 : W >= 320 ? Math.min(W - 8, 152) : Math.min(W - 8, B.versus ? 128 : 118), h: stack ? 26 : W < 320 ? 24 : 36 } };
  if (B.territory) { L.top.h = 46; if (!stack) L.top.w = Math.min(202, W - 72); }
  if (stack) {
    L.bar = { x: 4, y: H - 2 * bh - 8, w: W - 8, rows: 2 }; L.ctxY = L.bar.y - 52; L.ctxH = 48;
    L.ctx = { x: 4, y: L.ctxY, w: W - 8, h: L.ctxH, unit: true, terrain: true, combined: true };
  } else {
    const cursorLeft = toScreenX(tileX(BT.cx) - FX.shakeX) + TILE * BT.zoom / 2 < W / 2; const ch = 46;
    const y = Math.min(H - ch - 4, Math.max(L.top.y + L.top.h + 4, br.y + br.h + 6)); // under the board when it fits, else at the bottom
    const uw = 136, tw = 96; const x = cursorLeft ? W - 4 - uw - 4 - tw : 4;
    L.ctx = { x, y, w: uw + 4 + tw, h: ch, unitX: x, terrX: x + uw + 4, unitW: uw, terrW: tw, combined: false };
    L.buttons = { x: W - 4 - 58, y: 4, w: 58 };
  }
  return L;
}
function drawHUD() {
  HUD.hits = []; HUD.panels = []; const W = VIEW.w, H = VIEW.h; const L = hudLayout();
  if (BT.mode === 'end') { drawEndScreen(); return; }
  const boardModes = ['idle', 'move', 'target', 'catchTarget', 'skillTarget', 'unitinfo', 'menu'];
  // turn / objective / ready-count card (top-left)
  drawTurnCard(L.top);
  // context cards: the hovered unit and its terrain, side by side or as one strip on portrait phones
  const hov = unitAt(BT.cx, BT.cy); const t = terrAt(BT.cx, BT.cy);
  if (boardModes.includes(BT.mode) && BT.mode !== 'target' && BT.mode !== 'catchTarget' && BT.mode !== 'skillTarget') {
    const ref = hov || BT.sel || { fly: false, swim: false }; const showUnit = hov && BT.mode !== 'menu';
    if (L.stack) { const c = L.ctx; hudPanel(c.x, c.y, c.w, c.h); if (showUnit) { unitCardBody(hov, c.x, c.y, c.w - 62); vline(c.x + c.w - 60, c.y + 4, c.h - 8, UI.border2); terrainCardBody(t, ref, c.x + c.w - 56, c.y, 54, true); } else terrainCardBody(t, ref, c.x, c.y, c.w, false); }
    else { const c = L.ctx; hudPanel(c.terrX, c.y + 10, c.terrW, 36); terrainCardBody(t, ref, c.terrX, c.y + 12, c.terrW, false); if (showUnit) { hudPanel(c.unitX, c.y, c.unitW, c.h); unitCardBody(hov, c.unitX, c.y, c.unitW); } }
  }
  if (BT.mode === 'move' && BT.sel) { const c = BT.sel; textC(c.name + (BT.dart ? '  DART ' + dartMov(c) + ' · X: stay' : '  MOV ' + effMov(c)) + (BT.path.length > 1 ? '  →' + (BT.path.length - 1) : ''), W / 2, L.top.y + L.top.h + 4, BT.dart ? ROLES.scout.col : UI.ink, { outline: UI.shadow }); }
  if (BT.quip && BT.quip.unit.hp > 0) { const u = BT.quip.unit; const x = toScreenX(tileX(u.x) + TILE / 2) + 16, y = toScreenY(tileY(u.y)) - 12 - Math.min(6, BT.quip.t * 30); const tw = textWidth(BT.quip.text) + 8; rrect(x - 2, y - 2, tw, 11, UI.shadow, 1); rrect(x - 3, y - 3, tw, 11, '#ffffff', 1); text(BT.quip.text, x + 1, y - 1, '#202030'); px(x, y + 8, '#ffffff'); px(x - 1, y + 9, '#ffffff'); }
  if (BT.mode === 'menu' || BT.mode === 'item' || BT.mode === 'endmenu' || BT.mode === 'ballPick') drawMenu();
  if (BT.mode === 'target') drawForecast();
  if (BT.mode === 'catchTarget') drawCatchCard();
  if (BT.mode === 'skillTarget') drawSkillCard();
  if (BT.mode === 'itemTarget') { const w = Math.min(160, W - 12); hudPanel(W / 2 - w / 2, H / 2 - 16, w, 32); textC('Use ' + ITEMS[BT.item].name + ' on ' + BT.sel.name + '?', W / 2, H / 2 - 10, UI.ink); hintLine([['Z', 'confirm'], ['X', 'cancel']], W / 2, H / 2 + 2, { pill: false }); }
  if (BT.mode === 'unitinfo' && BT.info) { dimScreen(.3); drawUnitSheet(BT.info); }
  if (BT.mode === 'help') drawHelp();
  if (BT.mode === 'territoryGuide') drawTerritoryGuide();
  if (BT.mode === 'handoff') drawHandoff();
  if (BT.mode === 'banner') drawBanner();
  if (BT.mode === 'anim' && BT.anim && BT.anim.kind === 'event') drawEventCard(BT.anim);
  if (BT.mode === 'anim' && BT.anim && BT.anim.kind === 'strike') drawDuelCard(BT.anim);
  if (BT.mode === 'anim' && BT.anim && BT.anim.kind === 'msg') { const w = Math.min(160, W - 12); hudPanel(W / 2 - w / 2, 30, w, 20); textC(BT.anim.text, W / 2, 36, UI.ink); }
  drawButtons(L);
}
// TURN n · objective · READY x/y, with the two teams' head counts.
function drawTurnCard(r) {
  if (B.territory) { drawTerritoryTurn(r); return; }
  const mine = alive(HT()), ready = mine.filter(u => !u.acted).length; const turn = 'TURN ' + B.turn + (B.map.turnLimit && B.map.objective.type !== 'survive' ? '/' + B.map.turnLimit : B.map.objective.type === 'survive' ? '/' + B.map.objective.turns : '');
  hudPanel(r.x, r.y, r.w, r.h, { border: B.versus ? teamColor(HT()) : UI.border }); const tall = r.h >= 32;
  let x = r.x + 6; if (B.versus) { rrect(x, r.y + 5, 15, 8, teamColor(HT()), 1); textC('P' + (HT() + 1), x + 7, r.y + 5, '#ffffff'); x += 18; }
  text(turn, x, r.y + 5, UI.gold); const readyCol = ready ? UI.green : UI.muted; const rs = 'READY ' + ready + '/' + mine.length; textR(rs, r.x + r.w - 6, r.y + 5, readyCol);
  // head counts: a coloured dot per side (wild too when any is left), right-aligned on the last row
  const counts = [[0, alive(0).length], [1, alive(1).length]]; if (alive(2).length) counts.push([2, alive(2).length]); if (alive(3).length) counts.push([3, alive(3).length]);
  const cy = tall ? r.y + 24 : r.y + 14; let cx = r.x + r.w - 6; counts.reverse().forEach(([team, n]) => { cx -= textWidth(String(n)); text(String(n), cx, cy, UI.ink); cx -= 8; circle(cx + 2, cy + 3, 3, UI.inset); circle(cx + 2, cy + 3, 2, teamColor(team)); cx -= 8; });
  let ob = objectiveText(); const avail = tall ? r.w - 12 : cx - r.x - 10; while (textWidth(ob) > avail && ob.length > 4) ob = ob.slice(0, -1); text(ob, r.x + 6, r.y + 14, UI.muted);
  if (tall) { hline(r.x + 5, r.y + 22, r.w - 10, UI.inset); hline(r.x + 5, r.y + 23, r.w - 10, shade(UI.panel, .15)); text('UNITS', r.x + 6, r.y + 24, UI.dim); }
}
function drawButtons(L) {
  const W = VIEW.w, bh = L.bh, m = BT.mode;
  const idle = m === 'idle', acting = m === 'move' || m === 'target' || m === 'catchTarget' || m === 'skillTarget' || m === 'menu', enemyAnim = m === 'anim' && !isHuman(B.phase);
  if (enemyAnim) textC(phaseLabel(B.phase) + (BT.fast ? ' · FAST' : ''), W / 2, L.top.y + L.top.h + 4, UI.red, { outline: UI.shadow });
  const items = [];
  if (idle) items.push({ label: 'END TURN', variant: 'danger', run: () => { Audio.sfx('ok'); endTurn(); } }, { label: 'DANGER', on: BT.showDanger, run: () => { BT.showDanger = !BT.showDanger; Audio.sfx('menu'); } });
  if (acting) items.push({ label: m === 'move' && BT.dart ? 'STAY' : 'BACK', variant: 'ghost', run: () => cancel() });
  if (enemyAnim) items.push({ label: 'FAST', on: BT.fast, run: () => { BT.fast = !BT.fast; } });
  if (idle || acting) { if (canZoom()) items.push({ label: BT.zoom === 1 ? 'ZOOM -' : 'ZOOM +', run: () => { toggleZoom(); Audio.sfx('menu'); } }); }
  if (idle && B.territory) items.push({ label: 'RESERVE', run: () => openTerritoryReserves() });
  if (idle) items.push({ label: 'HELP', half: true, run: () => { BT.mode = 'help'; BT.helpPage = 0; BT.helpOffset = 0; Audio.sfx('menu'); } }, { label: '♪', on: !Audio.muted, half: true, run: () => { Audio.toggle(); Audio.sfx('menu'); } });
  if (B.territory && L.stack && idle) { const mute = items.findIndex(it => it.label.startsWith('♪')); if (mute >= 0) items.splice(mute, 1); }
  if (!items.length) return;
  if (L.stack) { // two rows across the bottom: row 1 = the two main actions, row 2 = the rest
    const b = L.bar; const row1 = items.slice(0, 2), row2 = items.slice(2); const lay = (row, y) => { if (!row.length) return; const gap = 4, w = Math.floor((b.w - gap * (row.length - 1)) / row.length); row.forEach((it, i) => button(b.x + i * (w + gap), y, w, bh, it.label, it.run, { col: it.col, variant: it.variant, on: it.on })); };
    lay(row1, b.y); lay(row2, b.y + bh + 4);
  } else {
    const bx = L.buttons.x, bw = L.buttons.w; let y = 4; for (let i = 0; i < items.length; i++) { const it = items[i]; if (it.half && items[i + 1] && items[i + 1].half) { button(bx, y, bw / 2 - 1, bh, it.label, it.run, { col: it.col, variant: it.variant, on: it.on }); button(bx + bw / 2 + 1, y, bw / 2 - 1, bh, items[i + 1].label, items[i + 1].run, { col: items[i + 1].col, variant: items[i + 1].variant, on: items[i + 1].on }); i++; } else button(bx, y, bw, bh, it.label, it.run, { col: it.col, variant: it.variant, on: it.on }); y += bh + 2; }
    if (BT.showDanger && (idle || m === 'move')) drawDangerLegend(bx, y + 2);
  }
  if (L.stack && BT.showDanger && (idle || m === 'move')) drawDangerLegend(4, L.top.y + L.top.h + 2);
}
// Danger overlay colours [fill, edge] per threat kind, and the recharge marker colour.
const DANGER = { trainer: ['#b03030', '#ff8080'], wild: ['#b08a20', '#ffd24a'] };
const RECHARGE_COL = '#a0a0ff';
const BRACE_COL = '#8090b0', ROOT_COL = '#50a040';
function drawDangerLegend(x, y) {
  const wild = B.units.some(u => u.hp > 0 && u.team === 2 && hostile(2, HT())); const w = wild ? 58 : 34;
  panel(x, y, w, 13, { fill: UI.panelDark, flat: true }); rect(x + 4, y + 4, 5, 5, DANGER.trainer[1]); text('foe', x + 11, y + 3, UI.ink);
  if (wild) { rect(x + 30, y + 4, 5, 5, DANGER.wild[1]); text('wild', x + 37, y + 3, UI.ink); }
}
// Unit card contents (portrait, name, level, HP, types, status/boss/recharge) inside a panel drawn by the caller.
function unitCardBody(u, x, y, w) {
  ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 3, 40, 36); ctx.clip(); portraitBg(x + 3, y + 3, 40, 36, u.team); drawMon(u.num, x + 23, y + 36, { flip: u.team !== 0 }); ctx.restore();
  teamGlyph(x + 5, y + 5, u.team, teamColorL(u.team));
  text(u.name, x + 46, y + 5, UI.ink); textR('Lv' + u.level, x + w - 5, y + 5, UI.gold);
  hpBar(x + 46, y + 15, w - 52, u.hp, u.maxHp); text(u.hp + '/' + u.maxHp, x + 46, y + 22, UI.ink);
  u.types.forEach((t, i) => typeBadge(t, x + 46 + i * 26, y + 31, 24)); if (u.status) statusBadge(u.status, x + w - 20, y + 22);
  // role badge (SCT/DEF/AMP/CTL/RNG/SUP/STK), then whichever of brace/root is on the unit
  const R = ROLES[u.role]; miniBadge(R.abbr, R.col, x + w - (u.status ? 38 : 20), y + 22); if (u.brace) miniBadge('BRC', BRACE_COL, x + w - 56, y + 22); else if (u.root) miniBadge('RT', ROOT_COL, x + w - 56, y + 22);
  if (u.boss) text('BOSS', x + w - 28, y + 31, UI.red); else if (u.recharge) miniBadge('CHG', RECHARGE_COL, x + w - 20, y + 31);
  else if (u.team === HT() && isHuman(B.phase)) textR(u.acted ? 'DONE' : 'READY', x + w - 5, y + 31, u.acted ? UI.muted : UI.green);
}
// Terrain card contents: tile swatch, name, DEF/AVO and the move cost (or heal/burn). `tall` stacks the numbers under the swatch.
function terrainCardBody(t, ref, x, y, w, tall) {
  const mv = inMap(BT.cx, BT.cy) ? B.map.variants[BT.cy][BT.cx] : 0; const sw = tall ? 12 : 20;
  rect(x + 4, y + 3, sw, sw, UI.shadow); ctx.drawImage(tileImg(t.ch, mv, 0), 0, 0, 32, 32, x + 5, y + 4, sw - 2, sw - 2); outline(x + 4, y + 3, sw, sw, UI.border2);
  const property = B.territory && territoryProperty(BT.cx, BT.cy);
  const healText = property && property.owner !== (ref.team == null ? HT() : ref.team) ? ['NO HEAL', UI.muted] : ['HEALS 30%', UI.green];
  const extra = t.heal ? healText : t.burn ? ['BURNS', UI.red] : [moveCost(t, ref) >= 99 ? 'NO ENTRY' : 'MOVE ' + moveCost(t, ref), UI.muted];
  if (tall) { let name = t.name; while (textWidth(name) > w - 22 && name.length > 3) name = name.slice(0, -1); text(name, x + 20, y + 4, UI.gold); text('DEF ' + terrainDef(t, ref) + '%', x + 16, y + 13, UI.ink); text('AVO ' + terrainEva(t, ref), x + 4, y + 22, UI.ink); text(extra[0], x + 4, y + 31, extra[1]); }
  else { text(t.name, x + 27, y + 4, UI.gold); text('DEF ' + terrainDef(t, ref) + '% AVO ' + terrainEva(t, ref), x + 27, y + 13, UI.ink); text(extra[0], x + 27, y + 22, extra[1]); }
}
// Menu geometry: a header band (the unit's name, BAG, BALLS or the menu title), one row per item and, when any item
// carries a description, a footer strip that explains the highlighted one.
function menuTitle() { const m = BT.menu; return m.title || (BT.mode === 'item' ? 'BAG' : BT.mode === 'ballPick' ? 'BALLS' : BT.mode === 'endmenu' ? 'MENU' : BT.sel ? BT.sel.name.toUpperCase() : 'ACTION'); }
function menuRect() {
  const m = BT.menu, rh = rowH(); const w = Math.min(VIEW.w - 8, m.items.some(it => it.icon) ? 134 : 120), top = 21;
  const subLines = m.items.reduce((n, it) => Math.max(n, it.sub ? Math.min(2, wrap(it.sub, w - 14).length) : 0), 0); const foot = subLines ? subLines * 9 + 6 : 0;
  const h = top + m.items.length * rh + foot + 4; const tx = toScreenX(tileX(BT.cx) - FX.shakeX), ty = toScreenY(tileY(BT.cy) - FX.shakeY), ts = TILE * BT.zoom; let x = tx + ts + 6, y = ty - 4;
  if (BT.mode === 'endmenu') { x = VIEW.w / 2 - w / 2; y = VIEW.h / 2 - h / 2; } if (x + w > VIEW.w - 4) x = tx - w - 6; if (x < 4) x = 4; y = clamp(y, 30, VIEW.h - h - 4); return { x, y, w, h, top, foot, subLines };
}
function menuHit(px2, py) { const r = menuRect(); if (px2 < r.x || px2 >= r.x + r.w || py < r.y || py >= r.y + r.h) return -1; return clamp(Math.floor((py - r.y - r.top) / rowH()), 0, BT.menu.items.length - 1); }
function drawMenu() {
  const m = BT.menu, rh = rowH(), ty = (rh - 7) >> 1; if (BT.mode === 'endmenu') dimScreen(.4);
  // a freshly opened menu rises and fades in over 120 ms
  const key = BT.mode + ':' + menuTitle() + ':' + m.items.length; if (BT.menuKey !== key) { BT.menuKey = key; BT.menuT0 = BT.time; } const ko = REDUCED ? 1 : Math.min(1, (BT.time - BT.menuT0) / .12); const r = menuRect(); r.y += Math.round((1 - easeOut(ko)) * 6); ctx.globalAlpha = ko;
  hudPanel(r.x, r.y, r.w, r.h, { header: menuTitle(), headerRight: m.items.length > 4 ? (m.i + 1) + '/' + m.items.length : null });
  m.items.forEach((it, i) => { const y = r.y + r.top + i * rh; const hot = i === m.i; const ink = it.off ? UI.dim : hot ? UI.hi : UI.ink; if (hot) selRow(r.x + 4, y, r.w - 8, rh - 1);
    const lx = r.x + (it.icon ? 22 : 11); if (it.icon) iconAt(it.icon, r.x + 9, y + ty - 1, it.off ? UI.dim : hot ? '#ffffff' : '#c8cddc'); text(it.label, lx, y + ty, ink, hot ? { shadow: shade(UI.sel, -.6) } : {}); });
  if (r.foot) { const fy = r.y + r.h - 4 - r.foot; rect(r.x + 4, fy, r.w - 8, r.foot, UI.panelDark); hline(r.x + 4, fy, r.w - 8, UI.inset); const it = m.items[m.i]; const lines = it && it.sub ? wrap(it.sub, r.w - 14).slice(0, 2) : []; lines.forEach((l, i) => text(l, r.x + 7, fy + 4 + i * 9, it.off ? '#d8a0a0' : UI.muted)); }
  ctx.globalAlpha = 1;
}
// The forecast sits on the side away from the cursor on wide screens and spans the bottom on portrait phones.
function forecastRect() {
  const W = VIEW.w, H = VIEW.h, L = hudLayout();
  if (L.stack) { const h = 118; return { x: 4, y: L.bar.y - h - 4, w: W - 8, h, stack: true }; }
  const w = Math.min(220, W - 12), h = 112; const left = toScreenX(tileX(BT.cx) - FX.shakeX) + TILE * BT.zoom / 2 > W / 2; const bb = 4 + (canZoom() ? 2 : 1) * (btnH() + 2); // under the BACK / ZOOM buttons on the right
  return { x: left ? 6 : W - w - 6, y: Math.min(Math.max(L.top.y + L.top.h + 14, left ? 0 : bb + 4), Math.max(4, H - h - 24)), w, h, stack: false };
}
function forecastHit(x, y) { const r = forecastRect(); return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h - 16; }
// The move selector strip along the bottom of the forecast (and the hint line under it) switches moves.
function moveSwitchHit(x, y) { const r = forecastRect(); return x >= r.x && y >= r.y + r.h - 16 && x < r.x + r.w && y < r.y + r.h + 12; }
// HP bar that previews the damage: the part about to be lost is hatched in red.
function hpBarPredict(x, y, w, cur, after, max) {
  rect(x, y, w, 6, UI.hpBack); const fw = Math.round(clamp(cur / max, 0, 1) * (w - 2)), aw = Math.round(clamp(after / max, 0, 1) * (w - 2));
  if (aw > 0) { const c = hpColor(after / max); rect(x + 1, y + 1, aw, 4, c); hline(x + 1, y + 1, aw, shade(c, .35)); }
  if (fw > aw) { rect(x + 1 + aw, y + 1, fw - aw, 4, '#c02828'); dither(x + 1 + aw, y + 1, fw - aw, 4, '#ff8080', Math.floor(BT.time * 8) % 2); }
  outline(x, y, w, 6, UI.shadow);
}
// One line summing up the ordered exchange: who answers, who doubles, who drops first.
function exchangeSummary(fc) {
  const hits = side => fc.strikes.filter(s => s.side === side && s.nominal).length;
  if (!fc.c) return { text: fc.noCounter === 'frozen' ? 'frozen · no counter' : fc.noCounter === 'recharging' ? 'recharging · no counter' : 'no counter', col: UI.green };
  if (!hits('c')) return { text: 'KO first · counters on miss', col: UI.gold };
  let t = 'counters' + (fc.c.eff > 1 ? ' hard' : ''); if (fc.koA) t += ' · KOs you!'; else if (hits('a') > 1) t += ' · you hit ×2'; else if (hits('c') > 1) t += ' ×2';
  return { text: t, col: fc.koA ? UI.red : fc.c.eff > 1 ? '#ffa0a0' : UI.muted };
}
// One text line per strike of the ordered exchange, for the forecast: who strikes, with what, the damage and the
// odds, whether it would KO, and the condition when it only happens if an earlier strike misses. Pure.
function forecastLines(fc, att, def) {
  let hpA = att.hp, hpD = def.hp; const out = [];
  for (const s of fc.strikes) {
    const mine = s.side === 'a'; let ko = false;
    if (s.nominal) { if (mine) { hpD = Math.max(0, hpD - s.dmg); hpA += s.drain; ko = hpD <= 0; } else { hpA = Math.max(0, hpA - s.dmg); hpD += s.drain; ko = hpA <= 0; } }
    const eff = s.eff === 0 ? 'no effect' : s.eff >= 2 ? '×2.25' : s.eff > 1 ? '×1.5' : s.eff < 1 ? '×' + s.eff : '';
    // critKo: the normal hit leaves the target standing but a critical (crit% odds) would not; never hidden behind the nominal numbers
    out.push({ side: s.side, nominal: s.nominal, ko, name: s.move.name.toUpperCase(), dmg: s.dmg, hit: s.hit, crit: s.crit, critDmg: s.critDmg, critKo: !!s.critKo && !ko, braced: !!s.braced, eff, cond: s.cond, drain: s.drain, counter: !mine });
  }
  return out;
}
// Fit one forecast line into `avail` pixels without losing what matters. The damage, the hit odds, the crit odds (with
// its KO tag when a critical would KO) and the "only if X survives" condition are essential and are never dropped;
// the optional parts (braced, effectiveness, drain) go first, then the move name shortens, the condition compacts
// to "if X alive" and "if alive", and "crit" to "c". Returns the text, the head (for the KO tag) and the x offset
// of the crit KO tag, if any. Pure.
function fitForecastLine(l, avail) {
  const arrow = l.side === 'a' ? '▸ ' : '◂ ', dmg = ' ' + l.dmg + (l.ko ? ' KO' : '');
  let name = l.name, critWord = 'crit ', cond = l.cond; const opt = [l.braced ? 'braced' : null, l.eff || null, l.drain ? '+' + l.drain : null].filter(Boolean);
  const build = () => { const head = arrow + name + dmg; const crit = critWord + l.crit + '%' + (l.critKo ? ' KO' : ''); const parts = [l.hit + '%', crit].concat(opt); if (cond) parts.push(cond); const text = head + '  ' + parts.join(' · '); const pre = head + '  ' + l.hit + '% · ' + critWord + l.crit + '% '; return { text, head, critKoAt: l.critKo ? textWidth(pre) + 1 : null }; };
  let f = build(); const fits = () => textWidth(f.text) <= avail;
  while (!fits() && opt.length) { opt.pop(); f = build(); }
  if (!fits() && cond) { const who = cond.replace(/^only if (.*) survives$/, '$1'); cond = 'if ' + who + ' alive'; f = build(); }
  while (!fits() && name.length > 6) { name = name.slice(0, -1); f = build(); }
  if (!fits() && cond) { cond = 'if alive'; f = build(); }
  if (!fits()) { critWord = 'c'; f = build(); }
  while (!fits() && name.length > 3) { name = name.slice(0, -1); f = build(); }
  return f;
}
function drawForecast() {
  const cf = currentForecast(); if (!cf) return; const { fc, move, moves, target } = cf; const r = forecastRect(); const u = BT.sel; const a = fc.a, c = fc.c;
  hudPanel(r.x, r.y, r.w, r.h, { title: 'FORECAST · NORMAL HITS' }); const half = Math.floor(r.w / 2); // HP after assumes hits land and none is critical
  // both sides: portrait with the team glyph, name and level; then the HP bar with the loss hatched, and the HP after in the big face
  const side = (x, unit, after, right) => {
    const px0 = right ? x + half - 6 - 34 : x + 6; ctx.save(); ctx.beginPath(); ctx.rect(px0, r.y + 7, 34, 28); ctx.clip(); portraitBg(px0, r.y + 7, 34, 28, unit.team); drawMon(unit.num, px0 + 17, r.y + 34, { flip: right }); ctx.restore(); teamGlyph(px0 + 2, r.y + 9, unit.team, teamColorL(unit.team));
    let name = unit.name; while (textWidth(name) > half - 52 && name.length > 3) name = name.slice(0, -1);
    if (right) { textR(name, px0 - 4, r.y + 8, UI.ink); textR('Lv' + unit.level, px0 - 4, r.y + 17, UI.gold); } else { text(name, px0 + 38, r.y + 8, UI.ink); text('Lv' + unit.level, px0 + 38, r.y + 17, UI.gold); }
    hpBarPredict(x + 6, r.y + 38, half - 12, unit.hp, after, unit.maxHp);
    const col = after <= 0 ? UI.red : after < unit.hp ? UI.gold : UI.ink; const big = after <= 0 ? 'KO' : String(after); const bw = textWidth(big, BIG);
    if (right) { bigText(big, x + half - 6 - bw, r.y + 46, col, { outline: '#000' }); textR(unit.hp + ' →', x + half - 9 - bw, r.y + 48, UI.muted); } else { text(unit.hp + ' →', x + 6, r.y + 48, UI.muted); bigText(big, x + 9 + textWidth(unit.hp + ' →'), r.y + 46, col, { outline: '#000' }); }
  };
  side(r.x, u, fc.hpA, false); side(r.x + half, target, fc.hpD, true);
  vline(r.x + half, r.y + 8, 48, UI.border2);
  // the ordered exchange, one line per strike; optional parts are dropped from the right until the line fits
  const lines = forecastLines(fc, u, target); const ly = r.y + 58;
  lines.slice(0, 3).forEach((l, i) => {
    const y = ly + i * 9; const col = !l.nominal ? UI.muted : l.side === 'a' ? '#8ab4ff' : '#ff9a9a'; const f = fitForecastLine(l, r.w - 12);
    text(f.text, r.x + 6, y, col); const tag = (kx, colr) => { rect(kx - 1, y - 1, textWidth('KO') + 2, 9, colr); text('KO', kx, y, '#ffffff'); };
    if (l.ko) tag(r.x + 6 + textWidth(f.head) - textWidth('KO'), l.side === 'a' ? '#2a6a3a' : '#8a2c2c');
    if (f.critKoAt != null) tag(r.x + 6 + f.critKoAt, l.side === 'a' ? '#2a6a3a' : '#8a2c2c');
  });
  // summary of the exchange, then the moves' side effects (never counted in the numbers above)
  const sum = exchangeSummary(fc); const ea = a.eff === 0 ? [] : moveEffects(move), ec = c && c.eff !== 0 ? moveEffects(c.move) : [];
  const fxText = (ea.length ? '▸ ' + ea.join(' · ') : '') + (ea.length && ec.length ? '  ' : '') + (ec.length ? '◂ ' + ec.join(' · ') : '');
  let foot = sum.text + (fxText ? '  ·  ' + fxText : ''); while (textWidth(foot) > r.w - 12 && foot.length > 8) foot = foot.slice(0, -1);
  text(foot, r.x + 6, r.y + r.h - 27, fxText && ea.some(t => t === 'must recharge') ? RECHARGE_COL : sum.col);
  // move selector: a strip along the bottom, tappable; arrows and the C key switch moves
  const sy = r.y + r.h - 16; rrect(r.x + 3, sy, r.w - 6, 13, UI.panelDark, 1); outline(r.x + 3, sy, r.w - 6, 13, moves.length > 1 ? UI.gold : UI.border2);
  let mx = r.x + 6; if (moves.length > 1) { text('◂', mx, sy + 3, UI.gold); mx += 8; } typeBadge(move.type, mx, sy + 2, 24); mx += 27;
  const idx = (moves.indexOf(move) + 1) + '/' + moves.length; const tail = moves.length > 1 ? idx + ' ▸' : ''; const tw = textWidth(tail);
  let ms = move.name + '  ' + move.pow + 'pw · rng ' + move.rng[0] + (move.rng[1] > move.rng[0] ? '-' + move.rng[1] : ''); while (textWidth(ms) > r.x + r.w - 8 - tw - mx && ms.length > 6) ms = ms.slice(0, -1);
  text(ms, mx, sy + 3, UI.ink); if (tail) textR(tail, r.x + r.w - 6, sy + 3, UI.gold);
  hintLine(VIEW.touch ? ['tap target: attack', 'X: back', moves.length > 1 ? 'tap bar: move' : null] : [['Z', 'attack'], ['X', 'back'], moves.length > 1 ? ['C', 'move'] : null], r.x + r.w / 2, r.y + r.h + 5);
}
// The skill card: what the chosen skill does to the highlighted target, with the exact numbers, and how to confirm or back out.
function drawSkillCard() {
  const u = BT.sel, sk = u && u.skill, t = BT.targets[BT.tIdx]; if (!sk || !t) return; const r = skillCardRect(); hudPanel(r.x, r.y, r.w, r.h, { title: sk.name.toUpperCase() });
  ctx.save(); ctx.beginPath(); ctx.rect(r.x + 6, r.y + 8, 34, 28); ctx.clip(); portraitBg(r.x + 6, r.y + 8, 34, 28, t.team); drawMon(t.num, r.x + 23, r.y + 35, { flip: t.team !== HT() }); ctx.restore(); teamGlyph(r.x + 8, r.y + 10, t.team, teamColorL(t.team));
  let name = (t === u ? 'itself' : t.name) + '  Lv' + t.level; while (textWidth(name) > r.w - 52 && name.length > 4) name = name.slice(0, -1); text(name, r.x + 46, r.y + 8, UI.ink);
  r.effect.forEach((l, i) => text(l, r.x + 46, r.y + 18 + i * 9, i === 0 ? UI.green : UI.ink));
  // the cost footer spans the full width under the portrait, wrapped, never truncated
  r.cost.forEach((l, i) => text(l, r.x + 6, r.y + 40 + i * 9, UI.muted));
  hintLine(VIEW.touch ? ['tap target: confirm', 'X: back'] : [['Z', 'confirm'], ['X', 'back']], r.x + r.w / 2, r.y + r.h + 5);
}
// Skill card geometry: the forecast's slot, with the effect (two lines beside the portrait) and the wrapped cost footer
// ("uses the action · +12 XP · every other turn") sized in, so nothing is clipped on a 172-px phone card.
function skillCardRect() {
  const u = BT.sel, sk = u && u.skill, t = BT.targets[BT.tIdx]; const r = forecastRect();
  const effect = sk && t ? wrap(skillPreview(u, sk, t), r.w - 52).slice(0, 2) : [];
  const cost = sk ? wrap('uses the action' + (sk.xp && !B.territory ? ' · +' + sk.xp + ' XP' : '') + (sk.cd ? ' · ' + cooldownText(sk) : ''), r.w - 12) : [];
  return { x: r.x, y: r.y, w: r.w, h: 40 + cost.length * 9 + 4, effect, cost };
}
function drawCatchCard() {
  const t = BT.targets[BT.tIdx]; if (!t) return; const r = forecastRect(); hudPanel(r.x, r.y, r.w, 50, { title: 'CATCH' });
  drawMon(t.num, r.x + 24, r.y + 36, { flip: true }); text(t.name + '  Lv' + t.level, r.x + 48, r.y + 8, UI.ink); hpBar(r.x + 48, r.y + 18, r.w - 56, t.hp, t.maxHp); text(t.hp + '/' + t.maxHp + ' HP', r.x + 48, r.y + 26, UI.ink);
  const p = clamp(.22 + .68 * (1 - t.hp / t.maxHp), .05, .97); text('Base chance ' + Math.round(p * 100) + '%', r.x + 48, r.y + 36, p > .6 ? UI.green : p > .35 ? UI.gold : UI.red);
  hintLine(VIEW.touch ? ['tap: pick a ball', 'X: back'] : [['Z', 'pick a ball'], ['X', 'back']], r.x + r.w / 2, r.y + 55);
}
function drawDuelCard(q) {
  // a compact "who is hitting whom" strip at the top
  const W = VIEW.w; const A = q.att, D = q.def; const w = 170, x = W / 2 - w / 2, y = 4; panel(x, y, w, 22);
  const hpA = BT.hpShow.get(A.id), hpD = BT.hpShow.get(D.id); const show = (u, h) => h ? Math.round(lerp(h.from, h.to, Math.min(1, h.t))) : u.hp;
  text(A.name, x + 6, y + 4, teamColor(A.team) === '#3d7dff' ? '#a0c0ff' : '#ffa0a0'); hpBar(x + 6, y + 13, 50, show(A, hpA), A.maxHp);
  textC(q.move.name, x + w / 2, y + 4, TYPE_COL[q.move.type], { shadow: '#000' }); textC(q.ev.counter ? 'counter' : '→', x + w / 2, y + 12, UI.muted);
  textR(D.name, x + w - 6, y + 4, D.team === 0 ? '#a0c0ff' : '#ffa0a0'); hpBar(x + w - 56, y + 13, 50, show(D, hpD), D.maxHp);
}
function drawEventCard(q) {
  const e = q.ev, W = VIEW.w, H = VIEW.h;
  if (e.type === 'xp') { const u = e.unit; const w = 120, x = W / 2 - w / 2, y = H - 40; panel(x, y, w, 24); const k = Math.min(1, q.t / q.dur); const shown = Math.min(100, q.from + e.amount * k); text(u.name, x + 6, y + 4, UI.ink); textR('+' + e.amount + ' EXP', x + w - 6, y + 4, UI.gold); bar(x + 6, y + 14, w - 12, 6, (shown % 100) / 100, '#6ad0ff'); }
  if (e.type === 'levelup') { const u = e.unit; const w = Math.min(176, W - 12), h = 70, x = W / 2 - w / 2; const uy = toScreenY(tileY(u.y)), ts = TILE * BT.zoom; const y = uy < H / 2 ? Math.min(H - h - 8, uy + ts + 10) : Math.max(28, uy - h - 12); const k = Math.min(1, q.t / .25); const yy = y + (1 - easeOut(k)) * -20; panel(x, yy, w, h, { title: 'LEVEL UP!' }); drawMon(u.fx.showNum || u.num, x + 26, yy + 40, {}); bigText('LV ' + e.level, x + 50, yy + 8, UI.gold, { outline: '#402000' }); const g = e.gains; const stats = [['HP', g.maxHp], ['ATK', g.atk], ['DEF', g.def], ['SPA', g.spa], ['SPD', g.spd], ['SPE', g.spe]]; const cw = Math.floor((w - 56) / 3); stats.forEach((s, i) => { const sx = x + 50 + (i % 3) * cw, sy = yy + 24 + Math.floor(i / 3) * 12; const showAt = .3 + i * .12; if (q.t > showAt) { text(s[0], sx, sy, UI.muted); text((s[1] >= 0 ? '+' : '') + s[1], sx + 20, sy, s[1] > 0 ? UI.green : UI.ink); } }); if (q.t > 1.1) { const nm = u.moves.map(m => m.name); let s = 'Moves: ' + nm.join(', '); while (textWidth(s) > w - 12 && s.length > 8) s = s.slice(0, -1); text(s, x + 6, yy + 52, UI.ink); } }
  if (e.type === 'evolve') { const k = q.t / q.dur; const msg = k < .5 ? 'What? ' + e.from.name + ' is evolving!' : e.from.name + ' evolved into ' + e.to.name + '!'; const w = Math.min(W - 12, Math.max(160, textWidth(msg) + 16)), x = W / 2 - w / 2, y = 30; panel(x, y, w, 20); textC(msg, W / 2, y + 6, k < .5 ? UI.ink : UI.gold); if (k > .15 && k < .8 && Math.floor(q.t * 14) % 2) { ctx.globalAlpha = .25; rect(0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; } }
  if (e.type === 'capture' && q.t > q.dur - .8 && e.ok) { const w = Math.min(150, W - 12), x = W / 2 - w / 2, y = 30; panel(x, y, w, 20); textC(e.unit.name + ' was caught!', W / 2, y + 6, UI.gold); }
  if (e.type === 'skill') { const msg = e.unit.name + ' uses ' + e.skill.name + (e.target && e.target !== e.unit ? ' on ' + e.target.name : '') + '!'; const w = Math.min(W - 12, Math.max(120, textWidth(msg) + 16)), x = W / 2 - w / 2, y = 30; panel(x, y, w, 20, { border: ROLES[e.unit.role].col }); let s = msg; while (textWidth(s) > w - 12 && s.length > 6) s = s.slice(0, -1); textC(s, W / 2, y + 6, UI.ink); }
}
function drawBanner() {
  const b = BT.banner, W = VIEW.w, H = VIEW.h; const t = b.t; const dur = BT.fast ? .9 : 1.5;
  const k = t < .3 ? easeOut(t / .3) : t > dur - .3 ? 1 - easeIn((t - (dur - .3)) / .3) : 1;
  const col = b.team === 0 ? '#2a4a9a' : b.team === 1 ? '#9a2a2a' : b.team === 2 ? '#8a7a20' : '#2a7a3a';
  ctx.globalAlpha = .85 * k; rect(0, H / 2 - 22, W, 44, col); ctx.globalAlpha = 1; hline(0, H / 2 - 22, W, UI.border); hline(0, H / 2 + 21, W, UI.border);
  const x = W / 2 + (1 - k) * (b.team === 0 ? -W : W) * .6; bigC(b.text, x, H / 2 - 12, '#ffffff', { outline: UI.shadow }); if (b.sub) textC(b.sub, x, H / 2 + 8, UI.gold, { outline: UI.shadow });
  // little party of icons running across
  const list = alive(b.team).slice(0, 6); list.forEach((u, i) => { const ux = x - 60 + i * 24 + (b.team === 0 ? 1 : -1) * (1 - k) * 50; ctx.globalAlpha = k; drawMon(u.num, ux, H / 2 + 44 + Math.round(Math.sin(t * 12 + i) * 2), { flip: b.team !== 0 }); ctx.globalAlpha = 1; });
}
// The unit sheet: two columns on wide screens (stats + evolution | traits + moves), one taller column on narrow ones.
function sheetRect() { const W = VIEW.w, H = VIEW.h; const narrow = W < 250; const w = narrow ? W - 12 : Math.min(260, W - 12), h = narrow ? 194 : 134; return { x: W / 2 - w / 2, y: Math.max(12, H / 2 - h / 2), w, h, narrow }; }
function drawUnitSheet(u) {
  const W = VIEW.w; const r = sheetRect(), { x, y, w, h, narrow } = r; hudPanel(x, y, w, h, { title: B.versus ? (u.team === 2 ? 'WILD POKÉMON' : teamName(u.team)) : u.team === 0 ? 'YOUR POKÉMON' : u.team === 2 ? 'WILD POKÉMON' : u.team === 3 ? 'ALLY' : 'ENEMY' });
  portraitBg(x + 6, y + 8, 48, 40, u.team); drawMon(u.num, x + 30, y + 44, { flip: u.team !== 0, sy: 1 + Math.sin(BT.time * 4) * .03 }); teamGlyph(x + 9, y + 11, u.team, teamColorL(u.team));
  text(u.name, x + 60, y + 8, UI.ink); textR('Lv' + u.level + (isHuman(u.team) && !B.territory && !narrow ? '  ' + u.xp + '/100xp' : ''), x + w - 6, y + 8, UI.gold); if (u.boss) text('BOSS', x + 60 + textWidth(u.name) + 6, y + 8, UI.red);
  u.types.forEach((t, i) => typeBadge(t, x + 60 + i * 26, y + 18, 24)); if (u.status) statusBadge(u.status, x + w - 22, y + 18);
  hpBar(x + 60, y + 30, w - 66, u.hp, u.maxHp); text('HP ' + u.hp + '/' + u.maxHp, x + 60, y + 37, UI.ink);
  const stats = [['ATK', u.atk], ['DEF', u.def], ['SPA', u.spa], ['SPD', u.spd], ['SPE', u.spe], ['MOV', effMov(u)]]; const cw = narrow ? Math.floor((w - 12) / 3) : 44; stats.forEach((s, i) => { const sx = x + 6 + (i % 3) * cw, sy = y + 54 + Math.floor(i / 3) * 10; text(s[0], sx, sy, UI.muted); textR(String(s[1]), sx + cw - 6, sy, UI.ink); });
  // role first (the badge colour matches the unit card), then the terrain traits; the skill line at the bottom says what the role does
  const R = ROLES[u.role]; const traits = [R.name.toUpperCase()]; if (u.fly) traits.push('FLIES'); if (u.swim) traits.push('SWIMS'); if (u.climb) traits.push('CLIMBS'); if (u.forester) traits.push('WOODS');
  const ev = u.dex.evos.length && isHuman(u.team) ? 'Evolves at Lv' + Math.min(...u.dex.evos.map(e => e[1])) : '';
  const mx = narrow ? x + 6 : x + 140, my = narrow ? y + 88 : y + 54; const tw = narrow ? (ev ? w - 12 - textWidth(ev) - 6 : w - 12) : w - 146;
  let tr = traits.join(' · '); while (textWidth(tr) > tw && traits.length > 1) { traits.pop(); tr = traits.join(' · '); } miniBadge(R.abbr, R.col, mx, my - 1); text(tr, mx + 20, my, UI.green); if (narrow && ev) textR(ev, x + w - 6, my, '#98d8f8'); else if (ev) text(ev, x + 6, y + 76, '#98d8f8');
  sectionLabel('Moves', mx, my + 10, narrow ? w - 12 : w - 146 - (x + 140 - mx)); u.moves.slice(0, 4).forEach((m, i) => { typeBadge(m.type, mx, my + 19 + i * 10, 24); text(m.name + ' ' + m.pow + (m.rng[1] > 1 ? ' R' + m.rng[0] + '-' + m.rng[1] : ''), mx + 29, my + 20 + i * 10, UI.ink); });
  if (u.recharge && !u.boss) text('RECHARGING', x + 60 + textWidth(u.name) + 6, y + 8, RECHARGE_COL);
  // type matchup hints
  const weak = TYPES.filter(t => effRaw(t, u.types) >= 2).slice(0, 4), res = TYPES.filter(t => effRaw(t, u.types) < 1).slice(0, 4);
  const wy = narrow ? y + 150 : y + 88; text('Weak:', x + 6, wy, UI.muted); weak.forEach((t, i) => typeBadge(t, x + 36 + i * 25, wy - 1, 24)); text('Resist:', x + 6, wy + 11, UI.muted); res.forEach((t, i) => typeBadge(t, x + 36 + i * 25, wy + 10, 24));
  // what the role does right now: the skill, its state (cooldown, braced, rooted) or the plain-striker note
  // the state (cooldown, braced, rooted) leads so it survives the truncation on narrow sheets
  const st = []; if (u.skill && !u.skill.passive && u.cd > 0) st.push('ready in ' + u.cd + (u.cd > 1 ? ' turns' : ' turn')); if (u.brace) st.push('BRACED'); if (u.root) st.push('ROOTED');
  let sk = (st.length ? st.join(' · ') + ' · ' : '') + (u.skill ? u.skill.blurb : 'Striker: plain attacker, strikes twice when 10+ SPE faster');
  while (textWidth(sk) > w - 12 && sk.length > 8) sk = sk.slice(0, -1); hline(x + 5, y + h - 16, w - 10, UI.inset); text(sk, x + 6, y + h - 13, R.col);
  hintLine([['◂▸', 'browse'], ['X', 'close']], W / 2, y + h + 5);
}
const HELP_PAGES = [
  ['CONTROLS', 'Arrows/WASD: cursor · Z/Enter/Space: OK · X/Esc: back. Mouse: hover + click; right click or an empty tile opens the menu. Touch: tap to move the cursor, tap again to confirm.', 'Q/E: next unit · C: unit info / switch move · F: fast · +/-: zoom · M: mute · H: help. Drag or wheel to pan.', 'Attack scene: any key speeds it up, X skips. The menu switches between full, quick and map-only battles.'],
  ['RULES', 'Pick a unit, walk the yellow arrow, then Attack, Catch, use its Skill, the Bag or Wait. Blue = move, red = attack. Greyed units have acted.', 'Defenders counter if you are in their move range and still standing. Only Scouts and Strikers strike twice, when 10+ SPE faster. The forecast lists the strikes in order; a greyed one only happens if an earlier strike misses.', 'Crits: 4% (24% for high-crit moves), ×1.5 damage. The forecast HP is for normal hits; a strike whose crit would KO says so. Terrain gives DEF% and AVO. Poké Centers heal 30%/turn and cure. Danger: red = foe reach, yellow = wild reach. Hyper Beam: no counter after it, next turn recharging.'],
  ['ROLES', 'Types say whom you beat; the role (badge on the unit card) says how to use it. One role per evolution line.', 'SCT Scout: Dart, moves 2 tiles after attacking. DEF Defender: Brace, 40% less damage until its next turn. AMP Amphibious: DEF 20% and AVO 20 on water. CTL Controller: Root a foe within 2, it cannot move on its next turn (fliers immune). RNG Ranged: ranged moves reach 1 tile further. SUP Support: Mend an adjacent ally 30% HP and cure it. STK Striker: plain attacker.', 'Brace, Root and Mend use the action, like Attack. Root and Mend earn XP outside Territory and work every other turn (the unit sheet counts the turns); Brace can be used every turn and earns nothing. A Poké Center or Full Heal also frees a rooted unit.'],
  ['TYPES & CATCHING', 'Super effective ×1.5 (×2.25 double), resisted ×0.67. STAB: a move of your own type deals +25%.', 'Burn halves ATK, Poison ticks, Paralysis cuts MOV and has a 25% chance to spend the action at phase start. Frozen skips a phase unless it thaws; crits on it are guaranteed. Cures never refund spent actions.', 'Wild Pokémon (dashed ring) can be caught when weak: stand next to them, choose Catch and throw a ball. Trainer Pokémon (spiked ring) cannot be stolen. Level ups can evolve!'],
  ['TERRITORY', 'Take the enemy HQ, or own 2 of the 3 contested centers at the start of 3 of your turns. Losing the majority resets your hold counter. After 40 turns, more contested centers wins; a tie is a draw.', 'Any ready Pokemon on another center can Capture. Reach 20 points: a full-HP unit adds 10 per action, damaged units add less. Leaving or fainting resets progress; damage slows the next capture. Root does not stop capture.', 'Only owned centers heal and cure your team. Each owned center earns 2 command points at the start of your turn (bank limit 30).'],
  ['RESERVES', 'Tap RESERVE or an empty owned center to deploy a teammate. Choose the center and Pokemon. Costs are shown before spending. The arrival has already acted. Maximum 5 on the map, from your finite team of 6.', 'Fainted teammates recover after 2 of your turn starts. Pay their cost to send them out again. Occupied centers cannot deploy. With reserves left, an empty battlefield does not lose the match.', 'Both teams stay at Lv12 with equal stats and no XP in this mode. End your turn manually, after moving and deploying. Campaign progress is separate.'],
];
function helpRect() { const W = VIEW.w, H = VIEW.h, w = Math.min(280, W - 12); const all = helpLines(BT.helpPage, w - 16), limit = Math.max(1, Math.floor((H - 64) / 10)), start = Math.min(BT.helpOffset || 0, Math.max(0, all.length - 1)); const lines = all.slice(start, start + limit), h = 50 + lines.length * 10; return { x: W / 2 - w / 2, y: Math.max(6, H / 2 - h / 2), w, h, lines, limit, next: start + limit < all.length ? start + limit : null }; }
function helpLines(page, width) { const p = HELP_PAGES[page]; const out = []; p.slice(1).forEach((para, i) => { if (i) out.push(''); out.push(...wrap(para, width)); }); return out; }
function drawHelp() {
  const W = VIEW.w; const r = helpRect(); dimScreen(.5); const p = hudPanel(r.x, r.y, r.w, r.h, { header: 'HELP' + (BT.helpOffset ? ' · CONTINUED' : ''), headerRight: (BT.helpPage + 1) + ' / ' + HELP_PAGES.length });
  sectionLabel(HELP_PAGES[BT.helpPage][0], r.x + 8, p.cy, r.w - 16, UI.gold); r.lines.forEach((l, i) => text(l, r.x + 8, p.cy + 12 + i * 10, UI.ink));
  rect(r.x + 4, r.y + r.h - 18, r.w - 8, 14, UI.panelDark); hline(r.x + 4, r.y + r.h - 18, r.w - 8, UI.inset);
  hintLine(VIEW.touch ? ['tap: next page', 'X: close'] : [['Z', 'next page'], ['X', 'close']], W / 2, r.y + r.h - 14, { pill: false });
}
function drawHandoff() {
  const W = VIEW.w, H = VIEW.h, h = BT.handoff; const t = h.team; const k = Math.min(1, h.t / .3); ctx.globalAlpha = .78 * k; rect(0, 0, W, H, '#05070f'); ctx.globalAlpha = 1;
  const col = teamColor(t); const y = H / 2 - 52 + (1 - easeOut(k)) * 20; ctx.globalAlpha = k; const w = Math.min(224, W - 12);
  panel(W / 2 - w / 2, y, w, 96, { fill: t === 0 ? '#17264a' : '#3a1a22', border: col });
  ctx.save(); ctx.translate(W / 2, y + 12); ctx.scale(2, 2); bigC(teamName(t), 0, 0, teamColorL(t), { outline: '#000' }); ctx.restore();
  textC('Turn ' + B.turn + (B.map.turnLimit ? ' / ' + B.map.turnLimit : '') + '  ·  ' + alive(t).length + ' Pokémon ready', W / 2, y + 36, UI.ink);
  const list = alive(t).slice(0, 6); list.forEach((u, i) => drawMon(u.num, W / 2 - (list.length - 1) * 12 + i * 24, y + 78 + Math.round(Math.sin(BT.time * 8 + i) * 1), { flip: t === 1 }));
  if (h.t > .4 && Math.floor(BT.time * 2) % 2) hintLine(VIEW.touch ? ['pass the device', 'tap to start'] : ['pass the controls', ['Z', 'start']], W / 2, y + 102, { col: UI.gold }); ctx.globalAlpha = 1;
}
function drawEndScreen() {
  if (B.territory) { const w = Math.min(VIEW.w - 16, 240), x = (VIEW.w - w) / 2, y = VIEW.h / 2 - 45; hudPanel(x, y, w, 90); bigC(B.result === 'win' ? 'VICTORY!' : B.result === 'draw' ? 'DRAW' : B.result === 'retreat' ? 'RETREAT' : 'DEFEAT', VIEW.w / 2, y + 10, UI.gold); wrap(B.territory.reason || 'Battle ended', w - 12).forEach((l, i) => textC(l, VIEW.w / 2, y + 32 + i * 10, UI.ink)); if (BT.endTimer > 1.2) hintLine(VIEW.touch ? ['tap to continue'] : [['Z', 'continue']], VIEW.w / 2, y + 72, { pill: false }); return; }
  const W = VIEW.w, H = VIEW.h; const k = Math.min(1, BT.endTimer / .6); const vs = B.versus; const vt = B.result === 'p1' ? 0 : B.result === 'p2' ? 1 : -1; const win = vs ? vt >= 0 : B.result === 'win';
  ctx.globalAlpha = .6 * k; rect(0, 0, W, H, '#000'); ctx.globalAlpha = 1;
  const w = Math.min(200, W - 12), x = W / 2 - w / 2; const y = H / 2 - 30 + (1 - easeOut(k)) * -30; panel(x, y, w, 60, { fill: vs ? (vt === 0 ? '#17264a' : vt === 1 ? '#3a1a22' : '#2a2a3a') : win ? '#1c3a2a' : '#3a1c1c', border: vs && vt >= 0 ? teamColor(vt) : UI.border });
  if (vs) { bigC(vt < 0 ? 'DRAW' : teamName(vt) + ' WINS!', W / 2, y + 10, vt < 0 ? UI.muted : teamColorL(vt), { outline: '#000' }); textC('Turns: ' + B.turn + '   KOs: ' + B.kills, W / 2, y + 32, UI.ink); textC(vt < 0 ? 'Everyone fainted at once.' : 'The arena falls silent.', W / 2, y + 44, UI.muted); if (BT.endTimer > 1.2) hintLine(VIEW.touch ? ['tap to continue'] : [['Z', 'continue']], W / 2, y + 68); if (win && k >= 1 && Math.random() < .25) spawnParts(vrnd() * bvW() + CAM.x, CAM.y - 5, 1, [teamColor(vt), teamColorL(vt), '#ffd24a', '#ffffff'], { speed: 10, vy: 40, life: 2.5, grav: 20, size: 3 }); return; }
  bigC(win ? 'VICTORY!' : B.result === 'retreat' ? 'RETREAT' : 'DEFEAT...', W / 2, y + 10, win ? UI.gold : '#ff8080', { outline: '#000' });
  if (win) { textC('Turns ' + B.turn + '  ·  KOs ' + B.kills + '  ·  Caught ' + B.captured.length, W / 2, y + 32, UI.ink); if (B.turn <= (B.map.par || 8)) textC('★ Speedy! Under par ' + (B.map.par || 8), W / 2, y + 44, UI.gold); else textC('Par: ' + (B.map.par || 8) + ' turns', W / 2, y + 44, UI.muted); }
  else wrap(B.result === 'retreat' ? 'Your team runs back to the Poké Center.' : 'Everyone fainted. Try a different plan!', w - 12).forEach((l, i) => textC(l, W / 2, y + 34 + i * 9, UI.ink));
  if (BT.endTimer > 1.2) hintLine(VIEW.touch ? ['tap to continue'] : [['Z', 'continue']], W / 2, y + 68);
  if (win && k >= 1 && Math.random() < .25) spawnParts(vrnd() * bvW() + CAM.x, CAM.y - 5, 1, ['#ffd24a', '#5ee06a', '#3d7dff', '#ff5a5a', '#ffffff'], { speed: 10, vy: 40, life: 2.5, grav: 20, size: 3 });
}
