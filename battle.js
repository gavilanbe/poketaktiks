// ============================================================================
// battle.js — the tactics board: camera, cursor, ranges, path arrow, menus,
// combat forecast, animation sequencer (moves, strikes, KO, level up, evolve,
// capture), enemy phase playback, HUD.
// ============================================================================
'use strict';
const CAM = { x: 0, y: 0, tx: 0, ty: 0 };
const BT = {  // battle scene UI state
  mode: 'idle',      // idle | move | menu | target | catchTarget | skillTarget | anim | banner | end | help | unitinfo | endmenu | power
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
function teamName(t) { return TR(B && B.versus ? (t === 0 ? 'PLAYER 1' : t === 1 ? 'PLAYER 2' : t === 2 ? 'WILD' : 'ALLY') : (t === 0 ? 'PLAYER' : t === 1 ? 'ENEMY' : t === 2 ? 'WILD' : 'ALLY')); }
function phaseLabel(t) { return TR(B && B.versus ? (t === 0 ? 'PLAYER 1 PHASE' : t === 1 ? 'PLAYER 2 PHASE' : t === 2 ? 'WILD PHASE' : 'ALLY PHASE') : (t === 0 ? 'PLAYER PHASE' : t === 1 ? 'ENEMY PHASE' : t === 2 ? 'WILD PHASE' : 'ALLY PHASE')); }
// Screen bands the HUD keeps for itself (in board pixels): the turn card on top and, on narrow portrait screens,
// the context/forecast area and the button bar at the bottom. A board that fits is centred between them.
const STACK_BOTTOM = 96, STACK_TARGET = 176; // portrait phones: context card + button bar, or the forecast + bar
function baseHudReserve() { const z = BT.zoom, stack = narrowView() && portraitView(); const top = B && B.territory ? (stack ? 40 : 50) : (stack ? 34 : 30); const bottom = stack ? (['target', 'catchTarget', 'skillTarget'].includes(BT.mode) ? STACK_TARGET : STACK_BOTTOM) : 40; return { top: top / z, bottom: bottom / z }; }
function hudReserve() { const r = baseHudReserve(); r.top += powerRibbonHeight() / BT.zoom; return r; }
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
// Zoom levels: 1 (32-px tiles), .75 (24 px) and .5 (16 px). Zooming out is offered whenever the board does not fit at 1.
const ZOOMS = [1, .75, .5];
function boardFits(z) { const stack = narrowView() && portraitView(); const R = { top: ((B && B.territory ? (stack ? 40 : 50) : (stack ? 34 : 30)) + powerRibbonHeight()) / z, bottom: (stack ? STACK_BOTTOM : 40) / z }; return B.map.w * TILE <= VIEW.w / z && B.map.h * TILE <= VIEW.h / z - R.top - R.bottom; }
function boardHeightFits(z) { const stack = narrowView() && portraitView(); const R = { top: ((B && B.territory ? (stack ? 40 : 50) : (stack ? 34 : 30)) + powerRibbonHeight()) / z, bottom: (stack ? STACK_BOTTOM : 40) / z }; return B.map.h * TILE <= VIEW.h / z - R.top - R.bottom; }
function canZoom() { return B && !boardFits(1); }
function setZoom(z) { if (z === BT.zoom || !ZOOMS.includes(z) || (z < 1 && !canZoom())) return false; const cx = CAM.tx + bvW() / 2, cy = CAM.ty + bvH() / 2; BT.zoom = z; CAM.tx = cx - bvW() / 2; CAM.ty = cy - bvH() / 2; clampCam(); CAM.x = CAM.tx; CAM.y = CAM.ty; return true; }
// Phones open at the largest reduced zoom whose map height fits between the HUD bands: 24-px tiles when the map is
// short enough to show every row, 16-px tiles for tall maps. Wide screens open at 1.
function phoneZoom() { return boardHeightFits(.75) ? .75 : .5; }
function zoomToFit() { return setZoom(boardFits(1) ? 1 : boardFits(.75) ? .75 : .5); }
// ZOOM cycles 1 → .75 → .5 → 1 (the button says which way it goes next).
function toggleZoom() { return setZoom(BT.zoom === 1 ? .75 : BT.zoom === .75 ? .5 : 1); }

// ---------------------------------------------------------------- battle setup
function startBattle(mapDef, party, bag, opts = {}) {
  seedRng(opts.seed || (Date.now() & 0xffff));
  const map = parseMap(mapDef); UID = 1;
  B = { map, units: [], turn: 1, phase: 0, bag: normalizeBag(bag), result: null, seized: false, captured: [], kills: 0, chapter: opts.chapter != null ? opts.chapter : null, log: [], seed: opts.seed || 1, skirmish: !!opts.skirmish, tower: opts.tower != null ? opts.tower : null, safari: opts.safari || null, turnsUsed: 0, versus: !!opts.versus, humans: opts.humans || [0], setup: opts.setup || null };
  // versus rules: fog of war, capture-the-flag bases, the hill
  B.fog = !!map.fog; B.vis = null; B.captureBy = null; B.endReason = null; B.flags = map.flags ? map.flags.map(f => ({ team: f.team, home: { x: f.x, y: f.y }, x: f.x, y: f.y, carrier: null })) : null; B.hill = map.hill ? { x: map.hill.x, y: map.hill.y, r: map.hill.r || 1, score: [0, 0], need: 3 } : null;
  // enemies / wild / allies from the map definition
  // (box: the unit belongs to its side's PC Box, so it recovers there when it faints, like a deployed one)
  for (const d of mapDef.units) { const u = makeUnit(d.mon, d.level, d.team == null ? 1 : d.team, { x: d.x, y: d.y, ai: d.ai, boss: d.boss, nick: d.nick ? TRX(d.nick) : d.nick }); if (d.hp) u.hp = Math.max(1, Math.floor(u.maxHp * d.hp)); u.provoked = false; if (d.box) u.fromBox = true; B.units.push(u); }
  // player party on deploy tiles: the campaign party keeps its HP edge, Versus trainers are built identically
  // id: 0 drops the id a serialized party member carried from an earlier battle so restoreUnit assigns a fresh
  // one: enemies were just numbered 1..N, and a duplicate id would make the duel scene overlay both sides.
  if (opts.territory) territoryInit(opts.captains);
  const fresh = { acted: false, status: null, recharge: 0, cd: 0, brace: 0, root: 0, id: 0 }; // battle-temporary state never crosses encounters (suspend keeps it)
  party.forEach((p, i) => { const slot = map.deploy[i]; if (!slot) return; const u = restoreUnit(Object.assign({}, p, fresh, { team: 0, x: slot.x, y: slot.y, hpBonus: opts.versus || p.loaner ? 1 : BOND_HP })); u.hp = u.maxHp; u.pid = p.pid; u.leader = i === 0; u.fromBox = true; B.units.push(u); });
  if (opts.party2) opts.party2.forEach((p, i) => { const slot = (map.deploy2 || [])[i]; if (!slot) return; const u = restoreUnit(Object.assign({}, p, fresh, { team: 1, x: slot.x, y: slot.y, hpBonus: 1 })); u.hp = u.maxHp; u.leader = i === 0; u.fromBox = true; u.fx.facing = -1; B.units.push(u); });
  if (!opts.territory) warSetup(mapDef, opts);
  initBattleCaptains(opts); initCampaignLessons(mapDef, opts);
  BT.mode = 'idle'; BT.sel = null; BT.queue = []; BT.anim = null; BT.autoEnd = 0; BT.dart = false; BT.log = []; BT.showDanger = false; BT.hpShow.clear();
  for (const u of B.units) requestBigSprite(u.num); // warm the duel scene's sprites; nothing waits on them
  const first = alive(0)[0]; BT.cx = first ? first.x : 0; BT.cy = first ? first.y : 0; BT.zoom = 1; if (narrowView() && canZoom()) setZoom(phoneZoom()); centerCam(BT.cx, BT.cy, true); // phones open zoomed out: six 32 px tiles across is too little context
  BT.hoverAnchor = null; BT.lastMode = BT.mode; FX.parts = []; FX.texts = []; FX.sprites = [];
  Audio.playMusic(map.music);
  if (!opts.defer) beginPhase(0, true);
}
// Every battle is a war (war.js): properties from the map, funds, and each side's Box. The Pokémon a side brought onto
// the map belong to its Box (they return to it when they faint); opts.box / opts.box2 add the ones waiting in the PC
// (the rest of a campaign collection, the rest of a Versus draft); the chapter's roster fills the enemy's.
function warSetup(mapDef, opts) {
  warInit(mapDef, { war: Object.assign({ centers: opts.versus || opts.skirmish ? -1 : 0 }, opts.war || {}) });
  for (const u of B.units) if (u.fromBox && u.team <= 1) { const e = warEntry({ num: u.num, level: u.level, data: serializeUnit(u), pid: u.pid }); e.state = 'field'; e.unitId = u.id; B.war.box[u.team].push(e); }
  // a serialized Pokémon keeps its moves and experience; a plain { num, level } is made fresh when deployed
  [opts.box || [], opts.box2 || []].forEach((list, team) => { for (const d of list) B.war.box[team].push(warEntry('xp' in d ? { data: d, pid: d.pid } : d)); });
  wildSetup(mapDef);
  const w = opts.weather || mapDef.weather; B.weather = null; B.map.weather = WEATHER[w] ? w : null; if (B.map.weather) setWeather(w, 0);
}
// Can a side still play a phase with nothing on the map? Only if it can deploy.
function warCanPlay(team) { return !!(B.war && team <= 1 && warDeploySites(team).length && B.war.box[team].some(e => e.state === 'box')); }
function warHasBox(team) { return !!(B && B.war && team <= 1 && B.war.box[team].length && warDeploySites(team).length); }
// first: the battle's opening phase (no turn increment). resumed: the phase comes from a suspend save,
// which was written after upkeep already ran, so heals, ticks and recharges must not apply again.
function beginPhase(team, first, resumed = false) {
  B.phase = team;
  if (team === 0 && !first && !resumed) { B.turn++; if (!B.territory && checkObjective()) { endBattle(); return; } }
  const ev = resumed ? [] : upkeep(team);
  if (B.versus && !resumed) { const hv = versusPhaseStart(team); if (hv && B.hill) floatText(B.hill.x * TILE + TILE / 2, B.hill.y * TILE - 8, TR('HILL {0}/{1} · {2}', hv.score, B.hill.need, teamName(team)), teamColorL(team), { big: true, life: 1.6, outline: '#000' }); if (checkObjective()) { endBattle(); return; } }
  if (B.fog) refreshVision(team);
  if (B.war && !resumed) { const before = team <= 1 ? B.war.funds[team] : 0; warUpkeep(team); if (team <= 1 && isHuman(team) && B.war.funds[team] > before) { BT.income = { t: BT.time + .6, amount: B.war.funds[team] - before, team }; BT.fundsShow = before; BT.fundsTeam = team; } if (checkObjective()) { endBattle(); return; } if (!isHuman(team)) for (const u of warAiDeploy(team)) { u.ai = 'war'; u.fx.alpha = 0; ev.push({ type: 'spawn', unit: u, deploy: true }); } }
  if (team === 0 && !B.versus && !resumed) { saveSuspend(); }
  const teamsPresent = [0, 1, 2, 3].filter(t => alive(t).length);
  if (!teamsPresent.includes(team) && team !== 0 && !warCanPlay(team)) { nextPhase(); return; }
  // reinforcements at the start of the enemy phase
  if (team === 1) for (const u of spawnReinforcements()) ev.push({ type: 'spawn', unit: u });
  if (team === 0 && !first && !resumed) { for (const u of safariFlee()) ev.push({ type: 'flee', unit: u }); for (const u of wildSpawn()) ev.push({ type: 'wildSpawn', unit: u }); }
  const label = phaseLabel(team);
  BT.banner = { text: label, t: 0, team, sub: isHuman(team) ? TR('Turn {0}', B.turn + (B.map.turnLimit && B.map.objective.type !== 'survive' ? ' / ' + B.map.turnLimit : '') + (B.map.objective.type === 'survive' ? ' / ' + B.map.objective.turns : '')) : null };
  BT.mode = 'banner'; Audio.sfx(isHuman(team) ? 'phase' : 'enemyphase');
  // the opening of a battle between two commanders: their portraits face off before the first phase
  if (first && !resumed && !B.territory && B.command && B.command.teams[0] && B.command.teams[1] && (coTrainer(B.command.teams[0]) || coTrainer(B.command.teams[1])) && !B.coVsShown) { B.coVsShown = true; BT.banner.vs = { t: 0 }; if (BT.income) BT.income.t += COVS_DUR; }
  Audio.playMusic(isHuman(team) ? (B.units.some(u => u.boss && u.hp > 0 && u.provoked) ? 'boss' : B.map.music) : 'enemy');
  if (B.versus && isHuman(team)) { BT.mode = 'handoff'; BT.handoff = { team, t: 0 }; }
  BT.queue = ev.map(e => ({ kind: 'event', ev: e }));
  BT.afterBanner = () => { playQueue(() => { if (isHuman(team)) { BT.waveT0 = BT.time; const f = alive(team).find(u => !u.acted); if (f) { BT.cx = f.x; BT.cy = f.y; keepCursorVisible(); } BT.mode = B.territory && BT.territoryGuide ? 'territoryGuide' : 'idle'; } else runEnemyPhase(team); }); };
}
function spawnReinforcements() { const out = []; for (const r of B.map.reinforce) if (r.turn === B.turn && !r.done) { r.done = true; for (const d of r.units) { if (unitAt(d.x, d.y)) continue; const u = makeUnit(d.mon, d.level, d.team == null ? 1 : d.team, { x: d.x, y: d.y, ai: d.ai || 'aggro', boss: d.boss }); B.units.push(u); out.push(u); requestBigSprite(u.num); } } return out; }
function nextPhase() {
  if (checkObjective()) { endBattle(); return; }
  let t = B.phase; for (let i = 0; i < 4; i++) { t = (t + 1) % 4; if (t === 0 || alive(t).length || warCanPlay(t)) break; }
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
  if (q.kind === 'duel') { startDuel(q); queueRecalls(q.events); }
  if (q.kind === 'move') { q.unit.fx.dx = 0; q.unit.fx.dy = 0; q.unit.fx.walk = true; q.i = 0; q.dur = (BT.fast ? .05 : .11); if (q.path.length > 1) { const l = q.path[q.path.length - 1]; if (!unitVisible(q.unit) || !unitVisible(l)) centerCam((q.path[0].x + l.x) / 2, (q.path[0].y + l.y) / 2); } }
  if (q.kind === 'strike') { q.style = atkStyle(q.move); q.dur = (BT.fast ? .3 : .5) * (q.style.board || 1); centerCamBetween(q.att, q.def); } // big moves take a little longer
  if (q.kind === 'msg') { q.dur = BT.fast ? .4 : .9; }
  if (q.kind === 'wait') { q.dur = BT.fast ? q.t2 * .3 : q.t2; }
  if (q.kind === 'fn') { q.fn(); nextAnim(); }
}
// Bring both units of an exchange into view; the camera only moves when one of them is outside the safe area.
function centerCamBetween(a, b) { if (unitVisible(a) && unitVisible(b)) return; centerCam((a.x + b.x) / 2, (a.y + b.y) / 2); }
function setupEvent(q) {
  const e = q.ev; q.dur = BT.fast ? .35 : .7;
  const ux = u => u.x * TILE + TILE / 2, uy = u => u.y * TILE + 4;
  switch (e.type) {
    case 'bossAlert': q.dur = REDUCED || BT.fast ? .8 : 1.7; Audio.sfx('boss'); Audio.playMusic('boss'); if (!REDUCED) { flashScreen('#ff3040', .3); shake(5); } break;
    case 'power': q.dur = REDUCED || BT.fast ? .7 : 1.65; Audio.sfx(e.superPower ? 'evolve' : 'phase'); if (!REDUCED) flashScreen(coOf({ co: e.co, root: e.root }).col, .22); break;
    case 'ko': queueRecalls([e]); q.dur = e.recalled ? (BT.fast ? .25 : .45) : BT.fast ? .45 : .8; Audio.sfx('ko'); shake(4); spawnParts(ux(e.unit), uy(e.unit) + 8, 18, ['#ffffff', '#ffd24a', '#c0c0c0'], { speed: 90, life: .7, grav: 60 }); noteKo(e); fadeFloatTexts(.12); floatText(ux(e.unit), uy(e.unit) - 14, e.unit.team === 0 ? 'FAINTED!' : 'KO!', e.unit.team === 0 ? UI.red : UI.gold, { huge: 2, life: 1.3, vy: -14, outline: e.unit.team === 0 ? '#2a0008' : '#3a2000' }); break;
    case 'xp': q.dur = BT.fast ? .35 : .6; q.from = e.unit.xp - e.amount; break;
    case 'levelup': q.dur = BT.fast ? .8 : 1.6; Audio.sfx('levelup'); spawnParts(ux(e.unit), uy(e.unit), 24, ['#ffd24a', '#ffffff', '#5ee06a'], { speed: 70, life: .9, grav: -30, shape: 'ring' }); break;
    case 'evolve': q.dur = BT.fast ? 1.4 : 3.2; Audio.sfx('evolve'); requestBigSprite(e.to.num); break;
    case 'heal': Audio.sfx('heal'); floatText(ux(e.unit), uy(e.unit), '+' + e.amount, UI.green, { outline: '#0a3a10' }); spawnParts(ux(e.unit), uy(e.unit) + 10, 10, ['#5ee06a', '#ffffff'], { speed: 30, grav: -60, life: .8 }); break;
    case 'cure': floatText(ux(e.unit), uy(e.unit) - 8, e.kind === 'frz' ? 'Thawed!' : e.kind === 'par' ? 'Recovered!' : 'Cured!', '#98d8f8'); break;
    case 'thaw': floatText(ux(e.unit), uy(e.unit) - 8, 'Thawed!', '#98d8f8'); break;
    case 'recharge': q.dur = BT.fast ? .3 : .6; if (e.done && !unitVisible(e.unit)) centerCam(e.unit.x, e.unit.y); floatText(ux(e.unit), uy(e.unit) - 8, e.done ? 'Recharging...' : 'Must recharge!', RECHARGE_COL, { outline: '#000' }); break;
    case 'dot': Audio.sfx(e.kind === 'brn' ? 'burn' : 'poison'); shake(1); floatText(ux(e.unit), uy(e.unit), '-' + e.amount, e.kind === 'psn' ? '#d080ff' : '#ff9040'); spawnParts(ux(e.unit), uy(e.unit) + 8, 8, e.kind === 'psn' ? ['#b050d0', '#7030a0'] : ['#ff8030', '#ffd040'], { speed: 30, grav: -50, life: .7 }); if (!unitVisible(e.unit)) centerCam(e.unit.x, e.unit.y); break;
    case 'recall': q.dur = BT.fast ? .62 : 1.2; if (!unitVisible(e.unit)) centerCam(e.unit.x, e.unit.y); Object.assign(e.unit.fx, { alpha: 1, flash: 0, tint: null, sx: 1, sy: 1, dx: 0, dy: 0 }); break;
    case 'spawn': q.dur = BT.fast ? .3 : e.deploy ? (REDUCED ? .6 : 1.15) : .6; centerCam(e.unit.x, e.unit.y);
      if (e.deploy) { e.unit.fx.alpha = 0; if (BT.fast) q.dur = .5; break; } // out of the PC: sendOutAnim plays it
      Audio.sfx('select'); spawnParts(ux(e.unit), uy(e.unit) + 8, 12, ['#ffffff', '#ff4b4b'], { speed: 50, life: .5, grav: 0 }); floatText(ux(e.unit), uy(e.unit) - 10, 'Reinforcements!', UI.red); break;
    // a wild Pokémon steps out of the tall grass: the blades burst, a "!" pops over it, its name is announced
    case 'aceDown': q.dur = REDUCED || BT.fast ? .7 : 1.5; Audio.sfx('faint'); if (!REDUCED) shake(3); break;
    case 'flee': q.dur = BT.fast ? .45 : .9; centerCam(e.unit.x, e.unit.y); Audio.sfx('whoosh'); floatText(ux(e.unit), uy(e.unit) - 6, 'FLED!', '#c8c8d8', { big: true, outline: UI.inset, life: 1 }); spawnParts(ux(e.unit), uy(e.unit) + 10, 14, ['#e8e0d0', '#b8b0a0', '#ffffff'], { speed: 40, grav: -20, life: .7 }); break;
    case 'wildSpawn': q.dur = BT.fast ? .5 : 1.1; centerCam(e.unit.x, e.unit.y); Audio.sfx('grass'); e.unit.fx.sy = .4; e.unit.fx.sx = 1.5;
      for (let i = 0; i < 8; i++) spawnSprite('leaf', ux(e.unit) + (i - 3.5) * 3, uy(e.unit) + 18, { size: 3, life: .7, col: '#3d8a3c', col2: '#a6dc7c', vx: (i - 3.5) * 16, vy: -60 - (i % 3) * 14, grav: 120, rot: i, spin: 10 });
      e.unit.fx.alert = BT.time; floatText(ux(e.unit), uy(e.unit) - 16, TR('A wild {0} appeared!', e.unit.name), UI.gold, { outline: '#000', life: 1.3, delay: .15 }); break;
    // a commander's power landing on one Pokémon: a bolt from the sky, the ground heaving, a swirl of petals, a psychic burst
    case 'powerHit': { q.dur = BT.fast ? .2 : .38; const x = ux(e.unit), y = uy(e.unit) + 8; if (!unitVisible(e.unit)) centerCam(e.unit.x, e.unit.y); e.unit.fx.flash = 1; e.unit.fx.hit = .25; e.unit.fx.dx = e.kind === 'quake' ? 4 : 0;
      if (e.kind === 'bolt') { Audio.sfx('elec'); spawnSprite('lightning', x, y + 10, { size: y + 40, life: .3, col: '#ffe94a' }); spawnSprite('flash', x, y, { size: 12, life: .2, col: '#fff7b0' }); flashScreen('#fff7b0', .25); }
      else if (e.kind === 'quake') { Audio.sfx('thud'); shake(5); for (let i = 0; i < 6; i++) spawnSprite('debris', x + (vrnd() - .5) * 16, y + 8, { vx: (vrnd() - .5) * 80, vy: -70 - vrnd() * 60, grav: 380, floor: y + 12, life: .7, size: 3, col: '#8a6a48', col2: '#c8a878', rot: i, spin: 10 }); }
      else if (e.kind === 'petals') { Audio.sfx('grass'); for (let i = 0; i < 8; i++) spawnSprite('leaf', x + (vrnd() - .5) * 20, y - 10, { size: 3, life: .6, col: '#ff8ac0', col2: '#ffd0e4', vx: (vrnd() - .5) * 60, vy: -30, grav: 40, rot: i, spin: 12 }); }
      else if (e.kind === 'psy') { Audio.sfx('psy'); spawnSprite('psy', x, y, { size: 22, life: .35, col: '#ff70b0', col2: '#ffd0e4' }); }
      else { Audio.sfx('hit'); spawnSprite('impact', x, y, { size: 14, life: .25, col: '#ffffff' }); }
      floatText(x, y - 14, '-' + e.amount, '#ff9a9a', { big: true, outline: '#000', life: .9 }); break; }
    case 'steal': q.dur = BT.fast ? .4 : .8; Audio.sfx('item'); if (e.unit) floatText(ux(e.unit), uy(e.unit) - 14, '+' + money(e.amount), UI.gold, { big: true, outline: '#3a2000', life: 1.3 }); break;
    case 'future': q.dur = BT.fast ? .3 : .6; Audio.sfx('psy'); if (e.unit) floatText(ux(e.unit), uy(e.unit) - 14, 'The future is set...', '#ff70b0', { outline: '#000', life: 1.3 }); break;
    case 'weather': q.dur = BT.fast ? .5 : 1.1; Audio.sfx(e.kind === 'sun' ? 'fire' : e.kind === 'rain' ? 'water' : 'whoosh'); flashScreen(e.kind === 'sun' ? '#fff0b0' : e.kind === 'rain' ? '#a0c8ff' : e.kind === 'sand' ? '#e0c890' : '#ffffff', .35); BT.weatherBanner = { t0: BT.time, text: WEATHER[e.kind].start, kind: e.kind }; break;
    case 'weatherEnd': q.dur = BT.fast ? .3 : .7; BT.weatherBanner = { t0: BT.time, text: WEATHER[e.kind].end, kind: e.kind, end: true }; break;
    case 'capture': q.dur = (CATCH_T.result + e.shakes * CATCH_T.shake + (e.ok ? 1.35 : .8)) / (BT.fast ? 1.8 : 1); centerCam(e.unit.x, e.unit.y); break; // the catch plays in the middle of the view
    case 'miss': q.dur = BT.fast ? .3 : .55; break;
    case 'status': floatText(ux(e.unit), uy(e.unit) - 6, STATUS[e.status].text.toUpperCase() + '!', STATUS[e.status].col, { outline: '#000' }); Audio.sfx(e.status === 'par' ? 'para' : e.status === 'brn' ? 'burn' : 'poison'); break;
    // role skills: a short card names the skill, then its effect floats over the target
    case 'skill': q.dur = BT.fast ? .4 : .8; Audio.sfx('select'); if (!unitVisible(e.unit) || !unitVisible(e.target)) centerCamBetween(e.unit, e.target); spawnParts(ux(e.unit), uy(e.unit) + 8, 10, [ROLES[e.unit.role].col, '#ffffff'], { speed: 40, life: .5, grav: -30 }); break;
    case 'brace': Audio.sfx('shake'); floatText(ux(e.unit), uy(e.unit) - 8, 'BRACED!', BRACE_COL, { outline: '#000' }); e.unit.fx.sy = .8; e.unit.fx.sx = 1.2; break;
    case 'root': Audio.sfx('grass'); shake(1); floatText(ux(e.unit), uy(e.unit) - 8, 'ROOTED!', ROOT_COL, { outline: '#000' }); spawnParts(ux(e.unit), uy(e.unit) + 12, 12, ['#2a6b38', '#c8f0a0'], { speed: 30, grav: 40, life: .6 }); break;
    case 'blocked': q.dur = BT.fast ? .4 : .7; if (!unitVisible(e.unit)) centerCam(e.unit.x, e.unit.y); floatText(ux(e.unit), uy(e.unit) - 8, e.kind === 'frz' ? 'Frozen solid!' : 'Fully paralyzed!', STATUS[e.kind].col, { outline: '#000' }); break;
    case 'property': q.dur = REDUCED || BT.fast ? (e.done ? .9 : .6) : e.done ? (e.property.kind === 'hq' ? 2.2 : 1.8) : 1.3; centerCam(e.property.x, e.property.y); q.ticks = 0; Audio.sfx('whoosh');
      if (e.done) { const c = teamColorL(e.unit.team); Audio.sfx('caught'); shake(3); flashScreen(c, .25); spawnSprite('ring', ux(e.unit), uy(e.unit) + 14, { size: 30, life: .55, col: c }); spawnSprite('ring', ux(e.unit), uy(e.unit) + 14, { size: 18, life: .45, col: '#ffffff', delay: .08 }); spawnParts(ux(e.unit), uy(e.unit) + 4, 26, [c, '#ffffff', UI.gold, teamColor(e.unit.team)], { speed: 90, life: .9, grav: 90 }); e.unit.fx.sy = .75; e.unit.fx.sx = 1.25; }
      else { Audio.sfx('select'); spawnParts(ux(e.unit), uy(e.unit) + 20, 8, [UI.gold, '#ffffff'], { speed: 30, life: .5, grav: -40 }); } break;
    case 'unroot': q.dur = BT.fast ? .2 : .4; floatText(ux(e.unit), uy(e.unit) - 8, 'Free!', ROOT_COL, { outline: '#000' }); break;
  }
}
function updateAnim(dt) {
  const q = BT.anim; if (!q) return;
  if (q.kind === 'duel') { updateDuel(q, dt); if (q.done) nextAnim(); return; }
  q.t += dt;
  if (q.kind === 'move') {
    const p = q.path; if (p.length < 2) { q.unit.x = p[0].x; q.unit.y = p[0].y; q.unit.fx.walk = false; nextAnim(); return; }
    const total = (p.length - 1) * q.dur; const k = Math.min(1, q.t / total); const seg = Math.min(p.length - 2, Math.floor(k * (p.length - 1))); const f = k * (p.length - 1) - seg;
    const a = p[seg], b = p[seg + 1]; const h = Math.abs(Math.sin(f * Math.PI)) * 5; q.unit.x = a.x; q.unit.y = a.y; q.unit.fx.dx = (b.x - a.x) * f * TILE; q.unit.fx.air = h; q.unit.fx.dy = (b.y - a.y) * f * TILE - h; q.unit.fx.sy = 1 + h * .02; q.unit.fx.sx = 1 - h * .015; q.unit.fx.facing = b.x - a.x !== 0 ? Math.sign(b.x - a.x) : q.unit.fx.facing;
    if (seg !== q.i) { q.i = seg; Audio.sfx('step'); stepFx(q.unit, a.x, a.y, false); }
    if (k >= 1) { const l = p[p.length - 1]; q.unit.x = l.x; q.unit.y = l.y; q.unit.fx.dx = 0; q.unit.fx.dy = 0; q.unit.fx.air = 0; q.unit.fx.walk = false; q.unit.fx.sy = .86; q.unit.fx.sx = 1.12; Audio.sfx('step'); stepFx(q.unit, l.x, l.y, true); nextAnim(); }
    return;
  }
  if (q.kind === 'strike') {
    const A = q.att, D = q.def, k = q.t / q.dur; const dx = Math.sign(D.x - A.x) || 0, dy = Math.sign(D.y - A.y) || 0; if (dx) A.fx.facing = dx;
    // wind-up (0-.3), lunge (.3-.45), impact at .45, recoil (.45-1)
    let off = 0; if (k < .3) off = -easeOut(k / .3) * 4; else if (k < .45) off = lerp(-4, 14, easeIn((k - .3) / .15)); else off = lerp(14, 0, easeOut((k - .45) / .55));
    if (q.ranged) off = k < .3 ? -easeOut(k / .3) * 3 : k < .45 ? lerp(-3, 6, (k - .3) / .15) : lerp(6, 0, easeOut((k - .45) / .55));
    A.fx.dx = dx * off; A.fx.dy = dy * off; A.fx.sx = k < .3 ? 1 - k * .3 : 1; A.fx.sy = k < .3 ? 1 + k * .3 : 1;
    // the move's own look (attackfx.js): its charge from the start, its travel from .3, its impact at .45
    const pose = q.style && q.style.pose; if (pose === 'leap' && k >= .3 && k < .45) A.fx.dy -= Math.round(Math.sin((k - .3) / .15 * Math.PI) * 12); // Body Slam hops on
    if (pose === 'burrow') { const b = k < .3 ? k / .3 : k < .5 ? 1 : Math.max(0, 1 - (k - .5) / .3); A.fx.alpha = 1 - .75 * b; A.fx.dy += Math.round(b * 6); } // Dig goes under
    if (!q.charged) { q.charged = true; atkWindup(boardAtkCtx(q)); }
    if (!q.hitDone && k >= .45) { q.hitDone = true; impact(q); }
    if (k >= .3 && !q.projDone) { q.projDone = true; atkLaunch(boardAtkCtx(q)); }
    if (q.react && q.hitDone && k < .92) { const hk = (k - .45) * q.dur; D.fx.tint = q.react === 'shock' ? (Math.floor(hk * 22) % 2 ? '#fff7a0' : '#3a3200') : q.react === 'chill' ? '#bde4f8' : Math.floor(hk * 16) % 2 ? '#ff8a40' : null; }
    if (k >= 1) { A.fx.dx = A.fx.dy = 0; A.fx.sx = A.fx.sy = 1; D.fx.dx = D.fx.dy = 0; if (pose === 'burrow') A.fx.alpha = 1; if (q.react) D.fx.tint = null; nextAnim(); }
    return;
  }
  if (q.kind === 'event') {
    const e = q.ev;
    if (e.type === 'ko' && e.recalled) { e.unit.fx.flash = Math.floor(q.t * 20) % 2; e.unit.fx.alpha = 1; if (q.t >= q.dur) e.unit.fx.flash = 0; }
    else if (e.type === 'ko') { const k = q.t / q.dur; e.unit.fx.flash = k < .4 ? (Math.floor(k * 20) % 2) : 0; e.unit.fx.alpha = k < .4 ? 1 : Math.max(0, 1 - (k - .4) / .5); e.unit.fx.dy = k > .4 ? -(k - .4) * 20 : 0; if (k >= .4 && !q.poofed) { q.poofed = true; const cx = e.unit.x * TILE + TILE / 2, cy = e.unit.y * TILE + TILE - 6; for (let i = 0; i < 4; i++) spawnSprite('poof', cx + (i - 1.5) * 7, cy - 2, { size: 5, life: .55, col: '#e8e0d0', col2: '#ffffff', vy: -14, vx: (i - 1.5) * 10, delay: i * .03 }); } if (k >= 1) { e.unit.fx.alpha = 1; e.unit.fx.flash = 0; e.unit.fx.dy = 0; } }
    if (e.type === 'evolve') { const k = q.t / q.dur; e.unit.fx.flash = k > .15 && k < .8 ? (Math.floor(k * 14) % 2 ? 1 : 0) : 0; e.unit.fx.showNum = k < .5 ? e.from.num : e.to.num; e.unit.fx.sx = e.unit.fx.sy = k > .15 && k < .8 ? 1 + Math.sin(k * 30) * .12 : 1; if (k > .8 && !q.popped) { q.popped = true; spawnParts(e.unit.x * TILE + TILE / 2, e.unit.y * TILE + 8, 40, ['#ffffff', '#ffd24a', '#98d8f8', '#f85888'], { speed: 120, life: 1, grav: 20 }); flashScreen('#ffffff', .8); shake(3); Audio.sfx('caught'); } if (k >= 1) { e.unit.fx.flash = 0; e.unit.fx.showNum = null; e.unit.fx.sx = e.unit.fx.sy = 1; } }
    if (e.type === 'capture') captureAnim(q);
    if (e.type === 'spawn' && e.deploy) sendOutAnim(q);
    if (e.type === 'recall') recallAnim(q);
    if (e.type === 'power' && !q.aura && q.t > q.dur * .78) { q.aura = true; const c = coOf({ co: e.co, root: e.root }); flashScreen('#ffffff', .45); Audio.sfx(e.superPower ? 'levelup' : 'heal'); for (const a of alive(e.team)) { spawnParts(a.x * TILE + TILE / 2, a.y * TILE + TILE - 4, 14, [c.col, '#ffffff', shade(c.col, .4)], { speed: 30, grav: -70, life: .9 }); a.fx.sy = .8; a.fx.sx = 1.2; } }
    if (e.type === 'levelup' && !q.shown && q.t > .2) { q.shown = true; }
    if (q.t >= q.dur) nextAnim();
    return;
  }
  if (q.kind === 'msg' || q.kind === 'wait') { if (q.t >= q.dur) nextAnim(); return; }
}
// What a step kicks up, by the ground under it: a splash on water (or a ripple under a flier), sand, snow, embers over
// lava, grey dust in caves and on floors, green bits on grass. `land` is the last step, which puffs a little wider.
function stepFx(u, x, y, land) {
  const t = terrAt(x, y), id = t.id, cx = x * TILE + TILE / 2, fy = y * TILE + TILE - 4, air = !!(u && u.fly);
  if (id === 'water' || id === 'lava') { const lava = id === 'lava', c = lava ? ['#ffd25a', '#ff8a2c', '#ffffff'] : ['#a2d8ff', '#edf9ff', '#62acf0'];
    spawnSprite('ring', cx, fy, { size: land ? 11 : 8, life: .4, col: lava ? '#ffb040' : '#edf9ff' }); if (!air || lava) spawnParts(cx, fy - 2, land ? 8 : 5, c, { speed: 34, life: .45, grav: lava ? -40 : 140, vy: lava ? -10 : -40 }); return; }
  if (air) return;
  const col = id === 'sand' ? ['#f2e2a4', '#cfb266'] : id === 'snow' || id === 'ice' ? ['#ffffff', '#c8d4ea'] : id === 'road' || id === 'bridge' ? ['#dec792', '#ffffff'] : id === 'cave' || id === 'rubble' || id === 'floor' || id === 'center' || id === 'crate' ? ['#a29bad', '#6e6278'] : ['#a3e07c', '#63b84c', '#ffffff'];
  if (land) for (let i = 0; i < 3; i++) spawnSprite('poof', cx + (i - 1) * 9, fy - 1, { size: 3, life: .3, col: col[0], col2: '#ffffff', vx: (i - 1) * 24, vy: -8 });
  else spawnParts(cx, fy, 3, col, { speed: 20, life: .35, grav: -10, flat: true });
  if (id === 'tall' && !REDUCED) for (let i = 0; i < (land ? 3 : 2); i++) spawnSprite('leaf', cx + (i - 1) * 6, fy - 8, { size: 3, life: .6, col: '#3d8a3c', col2: '#a6dc7c', vx: (i - 1) * 20 + (vrnd() - .5) * 10, vy: -34 - vrnd() * 16, grav: 90, rot: i, spin: 10 });
}
// The strike context for attackfx.js on the board (world pixels, a third of the scene's size): the attack leaves the
// attacker's front, lands on the defender's chest; wind-up is the first .3 of the strike, travel .3 → .45.
function boardAtkCtx(q) {
  const A = q.att, D = q.def, ax0 = A.x * TILE + TILE / 2, ay0 = A.y * TILE + 12, tx = D.x * TILE + TILE / 2, ty = D.y * TILE + 12, dx = tx - ax0, dy = ty - ay0, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, miss = q.ev.type === 'miss';
  return { S: .36, board: true, A: { x: ax0, y: A.y * TILE + TILE - 4 }, D: { x: tx, y: D.y * TILE + TILE - 4 }, dir: ux > .2 ? 1 : ux < -.2 ? -1 : (A.fx.facing || 1), ax: ax0 + ux * 8, ay: ay0 + uy * 8, tx: tx - ux * 2, ty, ex: miss ? tx + ux * 18 : tx, ey: miss ? ty + uy * 18 : ty, ux, uy,
    gy: D.y * TILE + TILE - 5, gyA: A.y * TILE + TILE - 5, top: D.y * TILE - 54, H: 26, wt: .3 * q.dur, dur: .15 * q.dur, rate: 1, move: q.move, type: q.move.type, pal: atkPal(q.move.type), e: q.ev, miss, q, att: A, def: D, fol: u => () => [u.fx.dx || 0, u.fx.dy || 0] };
}
function impact(q) {
  const A = q.att, D = q.def, e = q.ev; const cx = D.x * TILE + TILE / 2, cy = D.y * TILE + 10; const col = TYPE_COL[q.move.type];
  if (e.type === 'miss') { Audio.sfx('miss'); floatText(cx, cy - 10, 'MISS', '#c0c0c0', { big: true }); D.fx.dx = (D.x - A.x) * 6; D.fx.dodge = .25; return; }
  const kb = e.crit ? 8 : e.eff > 1 ? 6 : 5; D.fx.flash = 1; D.fx.dx = Math.sign(D.x - A.x) * kb; D.fx.dy = Math.sign(D.y - A.y) * kb - 2; D.fx.hit = .3; D.fx.sx = 1.18; D.fx.sy = .84;
  Audio.sfx(e.crit ? 'crit' : e.eff > 1 ? 'hit2' : 'hit'); if (e.crit || e.hpAfter <= 0) Audio.sfx('thud'); shake(e.crit ? 7 : e.eff > 1 ? 5 : 3); if (!BT.fast) FX.hitstop = e.crit ? .12 : e.eff > 1 ? .07 : .05;
  const ac = boardAtkCtx(q); atkImpact(ac); if (e.dmg > 0 && q.style && ['shock', 'chill', 'burn'].includes(q.style.react)) q.react = q.style.react; // the move's own impact (attackfx.js)
  // dust kicked back from the defender's feet
  if (e.dmg > 0) { const fx = Math.sign(D.x - A.x), fy = Math.sign(D.y - A.y); for (let i = 0; i < 3; i++) spawnSprite('poof', cx - fx * (4 + i * 4), D.y * TILE + TILE - 5, { size: 3, life: .32, col: '#e8e0d0', col2: '#ffffff', vx: fx * (20 + i * 8), vy: -6 + fy * 10, delay: i * .03 }); }
  if (e.eff > 1) { spawnSprite('ring', cx, cy, { size: 22, life: .4, col: '#ffd24a', delay: .04 }); flashScreen(shade(col || '#ffffff', .5), .25); }
  if (e.crit) { flashScreen('#fff2c0', .5); FX.zoom = 1; spawnSprite('burst', cx, cy, { size: 26, life: .42, col: UI.gold, delay: .05 }); }
  // the number rises from above the target's head a beat after the hit, so the move's own impact reads first
  floatText(cx, cy - 22, String(e.dmg), e.crit ? UI.gold : e.eff > 1 ? '#ffb040' : '#ffffff', e.crit || e.dmg >= 40 ? { huge: 2, life: 1.15, vy: -18, delay: .1, outline: '#1a0a14' } : { big: true, life: 1.1, vy: -18, delay: .1 });
  if (e.crit) floatText(cx, cy - 46, 'CRITICAL!', UI.gold, { big: true, life: .9, delay: .14, outline: '#3a2000', vy: -12 }); else floatText(cx + 16, cy - 36, MOVE_POP[q.move.type], col, { life: .9, delay: .15, outline: '#000', vy: -14 });
  if (e.eff > 1) floatText(cx, cy + 4, e.eff >= 2 ? 'SUPER EFFECTIVE!!' : 'Super effective!', '#ffd24a', { delay: .25, life: 1.2, outline: '#402000', vy: -10 });
  else if (e.eff === 0) floatText(cx, cy + 4, 'No effect...', '#c0c0c0', { delay: .25, life: 1.2, vy: -10 });
  else if (e.eff < 1) floatText(cx, cy + 4, 'Not very effective', '#a0d0ff', { delay: .25, life: 1.1, vy: -10 });
  if (e.status) { floatText(cx, cy + 14, STATUS[e.status].text.toUpperCase() + '!', STATUS[e.status].col, { delay: .5, life: 1.2, outline: '#000', vy: -10 }); }
  if (e.drain) { floatText(A.x * TILE + TILE / 2, A.y * TILE, '+' + e.drain, UI.green, { delay: .3 }); atkDrain(ac); }
  BT.hpShow.set(D.id, { from: e.hpAfter + e.dmg, to: e.hpAfter, t: 0 }); if (e.drain) BT.hpShow.set(A.id, { from: e.attHpAfter - e.drain, to: e.attHpAfter, t: 0 });
}
// The catch, as the games play it: the ball arcs over spinning, pops open above the Pokémon, a red beam pulls it in, the
// ball snaps shut, drops and bounces, then wobbles with its button glowing while the board dims around it. Caught: a
// click, stars, GOTCHA! and the ball flies off to the side's nearest PC (+1 BOX there). Broke free: the ball bursts
// and the Pokémon pops back out, angry. q.cfx holds what drawCatchFx draws; times are in seconds (BT.fast × 1.8).
const CATCH_T = { throw: .42, open: .5, absorb: .92, land: 1.36, result: 1.42, shake: .62, wobble: .36 };
function captureAnim(q) {
  const e = q.ev, T = e.unit, t = q.t * (BT.fast ? 1.8 : 1), C = q.cfx || (q.cfx = {}), CT = CATCH_T;
  const tx = T.x * TILE + TILE / 2, ty = T.y * TILE + 10, fx0 = e.from.x * TILE + TILE / 2, fy0 = e.from.y * TILE + 8, gy = T.y * TILE + TILE - 8, res = CT.result + e.shakes * CT.shake;
  C.shadow = null;
  if (t < CT.throw) { const k = t / CT.throw, h = 24 + Math.hypot(tx - fx0, ty - fy0) * .35; C.x = lerp(fx0, tx, k); C.y = lerp(fy0, ty - 14, k) - Math.sin(k * Math.PI) * h; C.angle = t * 24; C.open = 0; T.fx.alpha = 1;
    if (!C.thrown) { C.thrown = true; Audio.sfx('whoosh'); } if (vrnd() < .6) spawnParts(C.x, C.y, 1, ['#ffffff', '#ffd24a'], { speed: 6, life: .25, grav: 0 }); }
  else if (t < CT.open) { C.x = tx; C.y = ty - 14 - Math.round(Math.sin((t - CT.throw) / (CT.open - CT.throw) * Math.PI) * 4); C.angle = 0; C.open = 1;
    if (!C.popped) { C.popped = true; Audio.sfx('pop'); spawnSprite('ring', tx, ty - 4, { size: 18, life: .3, col: '#ffffff' }); spawnSprite('flash', tx, ty - 14, { size: 9, life: .2, col: '#ffffff' }); T.fx.sx = 1.15; T.fx.sy = .85; } }
  else if (t < CT.absorb) { const k = (t - CT.open) / (CT.absorb - CT.open); C.x = tx; C.y = ty - 14; C.open = 1; C.beam = 1 - Math.max(0, (k - .8) / .2);
    T.fx.tint = '#ff5a5a'; T.fx.sx = T.fx.sy = Math.max(.1, 1 - easeIn(k) * .9); T.fx.dy = -Math.round(easeIn(k) * 16); T.fx.alpha = 1 - Math.max(0, (k - .7) / .3);
    if (!C.absorbed) { C.absorbed = true; Audio.sfx('absorb'); } if (vrnd() < .7) spawnParts(tx + (vrnd() - .5) * 18, ty + (vrnd() - .5) * 12, 1, ['#ff8080', '#ffffff'], { speed: 10, life: .3, grav: -70 }); }
  else if (t < CT.land) { T.fx.alpha = 0; C.beam = 0; C.open = 0; const k = (t - CT.absorb) / (CT.land - CT.absorb);
    if (!C.shut) { C.shut = true; Audio.sfx('lock'); spawnSprite('flash', tx, ty - 14, { size: 6, life: .15, col: '#ff9a9a' }); }
    // a fall and two short bounces, a puff of dust each time it lands
    const hops = [[0, .46, ty - 14 - gy], [.46, .76, -6], [.76, 1, -2]]; C.x = tx; C.angle = Math.sin(k * 9) * .15 * (1 - k);
    for (let i = 0; i < hops.length; i++) { const [a, b, h] = hops[i]; if (k < a || k > b) continue; const f = (k - a) / (b - a); C.y = i === 0 ? gy + (1 - easeIn(f)) * h : gy + Math.sin(f * Math.PI) * h; if (!C['land' + i] && (i > 0 || f > .98)) { C['land' + i] = true; Audio.sfx('thud'); for (const d of [-1, 1]) spawnSprite('poof', tx + d * 5, gy + 5, { size: 3 - i, life: .3, col: '#e8e0d0', col2: '#ffffff', vx: d * 20, vy: -6 }); } }
    C.shadow = { x: tx, y: gy + 6, k: 1 - clamp((gy - C.y) / 30, 0, 1) }; }
  else if (t < res) { const s2 = t - CT.result, i = Math.floor(Math.max(0, s2) / CT.shake), f = Math.max(0, s2) - i * CT.shake; C.x = tx; C.y = gy; C.dim = Math.min(1, (t - CT.land) / .2); C.shadow = { x: tx, y: gy + 6, k: 1 };
    const wob = s2 >= 0 && f < CT.wobble; C.glow = wob; C.angle = wob ? Math.sin(f / CT.wobble * Math.PI * 2) * .42 : 0; C.x = tx + (wob ? Math.round(Math.sin(f / CT.wobble * Math.PI * 2) * 2) : 0);
    if (wob && C.shakeI !== i) { C.shakeI = i; Audio.sfx('shake'); } }
  else { const r = t - res; C.dim = Math.max(0, 1 - r / .35); C.angle = 0; C.glow = false; C.shadow = { x: tx, y: gy + 6, k: 1 };
    if (e.ok) {
      if (!C.done) { C.done = true; C.x = tx; C.y = gy; Audio.sfx('lock'); Audio.sfx('caught'); if (!REDUCED) shake(2); flashScreen('#ffffff', .3);
        for (let i = 0; i < 3; i++) spawnSprite('star', tx, gy - 4, { size: 5, life: .7, col: UI.gold, vx: (i - 1) * 34, vy: -70 + Math.abs(i - 1) * 16, grav: 110 });
        spawnParts(tx, gy - 4, 22, ['#ffd24a', '#ffffff', '#ff8080', '#8ab4ff'], { speed: 80, life: .8, grav: 60 }); floatText(tx, gy - 22, 'GOTCHA!', UI.gold, { huge: 2, life: 1.4, vy: -10, outline: '#3a2000' }); }
      // the ball flies to the nearest PC of the catcher's side
      if (r > .55) { if (C.site === undefined) { const sites = warDeploySites(e.team != null ? e.team : HT()); C.site = sites.length ? sites.slice().sort((a, b) => dist(a, T) - dist(b, T))[0] : null; }
        const k = Math.min(1, (r - .55) / .6); C.shadow = null; C.small = true;
        if (C.site) { const sx = C.site.x * TILE + TILE / 2, sy = C.site.y * TILE + 8; C.x = lerp(tx, sx, easeInOut(k)); C.y = lerp(gy, sy, k) - Math.sin(k * Math.PI) * 34; if (vrnd() < .7) spawnParts(C.x, C.y, 1, ['#ffd24a', '#ffffff'], { speed: 6, life: .3, grav: 0 });
          if (k >= 1 && !C.arrived) { C.arrived = true; C.gone = true; Audio.sfx('item'); spawnSprite('ring', sx, sy + 8, { size: 20, life: .45, col: teamColorL(e.team != null ? e.team : HT()) }); floatText(sx, sy - 6, '+1 BOX', teamColorL(e.team != null ? e.team : HT()), { big: true, outline: '#000', life: 1.2 }); } }
        else { C.fade = k; if (k >= 1) C.gone = true; } }
    } else if (!C.done) { C.done = true; C.gone = true; Audio.sfx('pop'); Audio.sfx('escape'); if (!REDUCED) shake(3); T.fx.alpha = 1; T.fx.tint = null; T.fx.sx = 1.45; T.fx.sy = .6; T.fx.dy = 0; T.provoked = true;
      spawnSprite('flash', tx, gy - 6, { size: 12, life: .25, col: '#ffffff' }); spawnParts(tx, gy - 6, 18, ['#ffffff', '#ff4040', '#ffd24a'], { speed: 90, life: .5, grav: 80 });
      for (let i = 0; i < 2; i++) spawnSprite('debris', tx, gy - 4, { vx: (i ? 1 : -1) * 60, vy: -90, grav: 400, floor: gy + 4, life: .8, size: 3, col: i ? '#e83c3c' : '#f8f6f0', col2: '#ffffff', rot: i, spin: 10 });
      floatText(tx, gy - 24, 'It broke free!', '#ffffff', { big: true, outline: '#000', life: 1.3 }); T.fx.anger = BT.time; }
  }
  if (q.t >= q.dur) { T.fx.tint = null; T.fx.sx = T.fx.sy = 1; T.fx.dy = 0; T.fx.alpha = 1; }
}
// Out of the PC, the way the games send a Pokémon out: a Poké Ball pops up out of the building spinning, bursts open
// over it, and a beam in the side's colour draws the Pokémon onto the tile as a white silhouette that grows, colours in
// and lands with a squash, a puff of dust and "Go, Pidgey!". The ball fades once it has done its work. Times in seconds
// (fast playback runs it 2.3× quicker); q.cfx is drawn by drawCatchFx.
const SENDOUT_T = { rise: .3, open: .4, grow: .72, land: .84 };
function sendOutAnim(q) {
  const e = q.ev, T = e.unit, t = q.t * (BT.fast ? 2.3 : 1), C = q.cfx || (q.cfx = { send: true }), S = SENDOUT_T;
  const tx = T.x * TILE + TILE / 2, gy = T.y * TILE + TILE - 8, hy = gy - 34, col = teamColorL(T.team);
  const land = () => { if (C.landed) return; C.landed = true; C.gone = true; C.beam = 0; T.fx.alpha = 1; T.fx.tint = null; T.fx.dy = 0; T.fx.sx = 1.35; T.fx.sy = .66; Audio.sfx('caught'); if (!REDUCED) shake(1);
    for (let i = 0; i < 4; i++) spawnSprite('poof', tx + (i - 1.5) * 7, gy + 2, { size: 3, life: .35, col: '#d8d0c0', col2: '#ffffff', vx: (i - 1.5) * 26, vy: -8, grav: 0 });
    spawnSprite('ring', tx, gy - 2, { size: 22, life: .45, col }); floatText(tx, T.y * TILE - 8, TR('Go, {0}!', T.name), col, { big: true, outline: '#000', life: 1.2 }); };
  if (REDUCED) { if (!C.popped) { C.popped = true; Audio.sfx('pop'); spawnSprite('flash', tx, gy - 10, { size: 12, life: .25, col: '#ffffff' }); } land(); T.fx.sx = T.fx.sy = 1; return; }
  if (t < S.rise) { const k = t / S.rise; C.x = tx; C.y = gy - 4 - easeOut(k) * (gy - 4 - hy); C.angle = t * 26; C.open = 0; T.fx.alpha = 0; C.shadow = { x: tx, y: gy + 6, k: 1 - k * .6 };
    if (!C.up) { C.up = true; Audio.sfx('whoosh'); spawnSprite('ring', tx, gy, { size: 12, life: .3, col: '#ffffff' }); } if (vrnd() < .6) spawnParts(C.x, C.y + 4, 1, ['#ffffff', col], { speed: 6, life: .25, grav: 0 }); }
  else if (t < S.open) { C.x = tx; C.y = hy - Math.round(Math.sin((t - S.rise) / (S.open - S.rise) * Math.PI) * 3); C.angle = 0; C.open = 1; T.fx.alpha = 0; C.shadow = null;
    if (!C.popped) { C.popped = true; Audio.sfx('pop'); spawnSprite('flash', tx, hy, { size: 10, life: .22, col: '#ffffff' }); spawnSprite('ring', tx, hy, { size: 18, life: .35, col }); spawnParts(tx, hy, 12, [col, '#ffffff', '#ffd24a'], { speed: 60, life: .5, grav: 40 }); } }
  else if (t < S.grow) { const k = (t - S.open) / (S.grow - S.open); C.x = tx; C.y = hy; C.open = 1; C.beam = 1; C.beamCol = col; T.fx.alpha = 1; T.fx.tint = '#ffffff'; T.fx.sy = .12 + .88 * easeOut(k); T.fx.sx = .4 + .6 * easeOut(k); T.fx.dy = 0;
    if (!C.grown) { C.grown = true; Audio.sfx('absorb'); } if (vrnd() < .8) spawnParts(tx + (vrnd() - .5) * 20, gy - vrnd() * 20, 1, ['#ffffff', col], { speed: 8, life: .35, grav: -60 }); }
  else if (t < S.land) { const k = (t - S.grow) / (S.land - S.grow); C.beam = 1 - k; C.fade = k; T.fx.alpha = 1; T.fx.sx = T.fx.sy = 1; T.fx.tint = k < .5 ? '#ffffff' : null; T.fx.flash = k < .5 ? 1 : 0; }
  else { T.fx.flash = 0; land(); const k = clamp((t - S.land) / .2, 0, 1); T.fx.sx = lerp(1.35, 1, easeOut(k)); T.fx.sy = lerp(.66, 1, easeOut(k)); }
  if (q.t >= q.dur) { T.fx.tint = null; T.fx.flash = 0; T.fx.sx = T.fx.sy = 1; T.fx.dy = 0; T.fx.alpha = 1; }
}
// A fainted Pokémon of a side with a Box goes back to it the way the games recall one: its ball pops open over it, a red
// beam pulls it in, the ball snaps shut and flies to the side's nearest PC, where "BOX · 2d" says how long it recovers.
// Queued after the KO (or after the duel scene that showed it); none under reduced motion or for wild Pokémon.
function koRecallInfo(u) { const W = B && B.war; if (REDUCED || !W || u.team > 1 || !W.box[u.team].some(en => en.unitId === u.id)) return null; const sites = warDeploySites(u.team); return { site: sites.length ? sites.slice().sort((a, b) => dist(a, u) - dist(b, u))[0] : null }; }
function queueRecalls(events) { const add = []; for (const e of events) if (e.type === 'ko' && !e.recallQueued) { e.recallQueued = true; const info = koRecallInfo(e.unit); if (info) { e.recalled = true; add.push({ kind: 'event', ev: { type: 'recall', unit: e.unit, site: info.site } }); } } if (add.length) BT.queue.unshift(...add); }
const RECALL_T = { open: .1, absorb: .42, shut: .5, fly: 1.1 };
function recallAnim(q) {
  const e = q.ev, T = e.unit, t = q.t * (BT.fast ? 1.8 : 1), C = q.cfx || (q.cfx = {}), R = RECALL_T, tx = T.x * TILE + TILE / 2, ty = T.y * TILE + 10;
  if (t < R.open) { C.x = tx; C.y = ty - 14 - Math.round((1 - t / R.open) * 6); C.angle = 0; C.open = 1; T.fx.alpha = 1;
    if (!C.popped) { C.popped = true; Audio.sfx('pop'); spawnSprite('flash', tx, ty - 14, { size: 8, life: .2, col: '#ffffff' }); } }
  else if (t < R.absorb) { const k = (t - R.open) / (R.absorb - R.open); C.x = tx; C.y = ty - 14; C.open = 1; C.beam = 1 - Math.max(0, (k - .8) / .2);
    T.fx.tint = '#ff5a5a'; T.fx.sx = T.fx.sy = Math.max(.1, 1 - easeIn(k) * .9); T.fx.dy = -Math.round(easeIn(k) * 16); T.fx.alpha = 1 - Math.max(0, (k - .7) / .3);
    if (!C.absorbed) { C.absorbed = true; Audio.sfx('absorb'); } if (vrnd() < .6) spawnParts(tx + (vrnd() - .5) * 16, ty + (vrnd() - .5) * 10, 1, ['#ff8080', '#ffffff'], { speed: 10, life: .3, grav: -70 }); }
  else if (t < R.shut) { C.beam = 0; C.open = 0; T.fx.alpha = 0; C.y = ty - 14; if (!C.shut) { C.shut = true; Audio.sfx('lock'); spawnSprite('flash', tx, ty - 14, { size: 6, life: .15, col: '#ff9a9a' }); } }
  else { T.fx.alpha = 0; C.small = true; const k = Math.min(1, (t - R.shut) / (R.fly - R.shut)), site = e.site; if (C.far == null) C.far = !site || !unitVisible(site); // an off-screen PC: the ball heads its way and fades
    if (!C.far) { const sx = site.x * TILE + TILE / 2, sy = site.y * TILE + 8; C.x = lerp(tx, sx, easeInOut(k)); C.y = lerp(ty - 14, sy, k) - Math.sin(k * Math.PI) * Math.min(40, 14 + dist(site, T) * 3); if (vrnd() < .6) spawnParts(C.x, C.y, 1, ['#ff9a9a', '#ffffff'], { speed: 6, life: .3, grav: 0 });
      if (k >= 1 && !C.arrived) { C.arrived = true; C.gone = true; Audio.sfx('item'); spawnSprite('ring', sx, sy + 8, { size: 18, life: .4, col: teamColorL(T.team) }); floatText(sx, sy - 6, TR('BOX · {0}d', WAR.recovery), teamColorL(T.team), { outline: '#000', life: 1.1 }); } }
    else { const dx = site ? Math.sign(site.x - T.x) : 0, dy = site ? Math.sign(site.y - T.y) : -1; C.x = tx + dx * easeOut(k) * 26; C.y = ty - 14 + dy * easeOut(k) * 14 - Math.sin(k * Math.PI) * 12; C.fade = clamp((k - .35) / .65, 0, 1); if (k >= 1) C.gone = true;
      if (!C.said) { C.said = true; floatText(tx, ty + 12, TR('BOX · {0}d', WAR.recovery), teamColorL(T.team), { outline: '#000', life: 1.1 }); } } } // under the KO's own text
  if (q.t >= q.dur) { T.fx.tint = null; T.fx.sx = T.fx.sy = 1; T.fx.dy = 0; T.fx.alpha = 0; }
}
// What the capture shows on the board (board space): a vignette that closes in on the ball while it shakes, the red
// beam, the ball itself (spinning, open, wobbling) with its shadow, or the small ball on its way to the PC.
function drawCatchFx(q) {
  const C = q.cfx; if (!C || C.x == null || C.gone && !C.small) return; const ox = -CAM.x + FX.shakeX, oy = -CAM.y + FX.shakeY, bx = Math.round(C.x + ox), by = Math.round(C.y + oy);
  if (C.dim > 0 && !REDUCED) { const r = 26, W = bvW() / BT.zoom + 64, H = bvH() / BT.zoom + 64; ctx.globalAlpha = .5 * C.dim; rect(-32, -32, W, by - r + 32, '#050915'); rect(-32, by + r, W, H, '#050915'); rect(-32, by - r, bx - r + 32, 2 * r, '#050915'); rect(bx + r, by - r, W, 2 * r, '#050915'); ctx.globalAlpha = .25 * C.dim; ellipseRing(bx, by, r + 2, r + 2, 3, '#050915'); ctx.globalAlpha = 1; }
  if (C.beam > 0) { const T = q.ev.unit, px2 = T.x * TILE + TILE / 2 + ox, py = T.y * TILE + 20 + oy, bc = C.beamCol || '#ff5050'; ctx.globalAlpha = C.beam * (.55 + .45 * Math.sin(BT.time * 44)); pline(bx - 3, by + 3, px2 - 9, py, bc, 2); pline(bx + 3, by + 3, px2 + 9, py, bc, 2); pline(bx, by + 3, px2, py - 3, '#ffffff', 1); ctx.globalAlpha = 1; }
  if (C.shadow) { ctx.globalAlpha = .3 * C.shadow.k; ellipse(Math.round(C.shadow.x + ox), Math.round(C.shadow.y + oy), 5, 2, '#000000'); ctx.globalAlpha = 1; }
  if (C.small) { if (C.gone) return; ctx.globalAlpha = C.fade != null ? 1 - C.fade : 1; drawBall(bx, by, ITEMS[q.ev.ball] ? ITEMS[q.ev.ball].col : ITEMS.pokeball.col, 3); ctx.globalAlpha = 1; return; }
  if (C.fade != null) ctx.globalAlpha = Math.max(0, 1 - C.fade); ctx.drawImage(ballSprite(C.angle || 0, C.open ? 1 : 0, C.glow ? 1 : 0, ITEMS[q.ev.ball] ? ITEMS[q.ev.ball].col : '#e83c3c'), bx - 8, by - 10); ctx.globalAlpha = 1;
}
BT.hpShow = new Map();

// ---------------------------------------------------------------- player actions
// Fog of war helpers: what the controlling trainer can see, and what a move can bump into.
function seenUnitAt(x, y) { const u = unitAt(x, y); return u && fogHides(u, HT()) ? null : u; }
function seenTargets(u) { return targetsFrom(u, u.x, u.y).filter(v => !fogHides(v, HT())); }
function standable(u, x, y) { const o = unitAt(x, y); return !o || o === u || fogHides(o, HT()); }
// Under fog a planned path may run into a hidden foe: the move stops on the tile before it (an ambush).
function fogPath(u, path) { if (!B.fog) return { path, ambush: null }; for (let i = 1; i < path.length; i++) { const o = unitAt(path[i].x, path[i].y); if (o && o !== u && hostile(o.team, u.team)) return { path: path.slice(0, i), ambush: o }; } return { path, ambush: null }; }
function ambushed(u, foe) { Audio.sfx('error'); shake(3); floatText(u.x * TILE + TILE / 2, u.y * TILE - 8, 'AMBUSH!', UI.red, { big: true, life: 1.2, outline: '#000' }); refreshVision(HT()); finishUnit(u); }
function selectUnit(u) {
  if (!canTakeAction(u)) { Audio.sfx('error'); return false; }
  BT.sel = u; BT.reach = reachable(u, u.x, u.y, effMov(u), { through: o => fogHides(o, HT()) }); BT.atk = attackCells(u, BT.reach); BT.path = [{ x: u.x, y: u.y }]; BT.mode = 'move'; BT.selT0 = BT.time; Audio.sfx('select');
  u.fx.sy = .85; u.fx.sx = 1.12; BT.quip = { text: quipFor(u.num), t: 0, unit: u };
}
function extendPath(x, y) {
  const u = BT.sel; const k = key(x, y); if (!BT.reach.has(k)) return; const p = BT.path;
  const i = p.findIndex(c => c.x === x && c.y === y); if (i >= 0) { BT.path = p.slice(0, i + 1); return; }
  const last = p[p.length - 1]; const adj = Math.abs(last.x - x) + Math.abs(last.y - y) === 1;
  if (adj) { let cost = 0; for (let j = 1; j < p.length; j++) cost += moveCost(terrAt(p[j].x, p[j].y), u); cost += moveCost(terrAt(x, y), u); if (cost <= effMov(u)) { BT.path = p.concat([{ x, y }]); return; } }
  BT.path = pathTo(BT.reach, x, y) || p;
}
function confirmMove() {
  const u = BT.sel; const dest = BT.path[BT.path.length - 1]; if (!standable(u, dest.x, dest.y)) { Audio.sfx('error'); return; }
  const fp = fogPath(u, BT.path.slice());
  if (BT.dart) { BT.dart = false; Audio.sfx('ok'); BT.queue = [{ kind: 'move', unit: u, path: fp.path }]; playQueue(() => { pickupAt(u); if (fp.ambush) ambushed(u, fp.ambush); else finishUnit(u); }); return; }
  BT.undo = { unit: u, x: u.x, y: u.y }; Audio.sfx('ok');
  BT.queue = [{ kind: 'move', unit: u, path: fp.path }];
  playQueue(() => { u.moved = true; pickupAt(u); if (fp.ambush) { BT.undo = null; ambushed(u, fp.ambush); } else openActionMenu(u); });
}
// Poké Balls lying on the board are picked up by the human unit that ends its move on them.
function pickupAt(u) {
  if (!isHuman(u.team)) return; const it = B.map.items.find(i => !i.taken && i.x === u.x && i.y === u.y); if (!it) return;
  it.taken = true; B.bag.pokeball = (B.bag.pokeball || 0) + 1; Audio.sfx('item');
  floatText(u.x * TILE + TILE / 2, u.y * TILE - 6, '+1 Poké Ball!', UI.gold, { outline: '#402000', life: 1.4 });
  spawnParts(u.x * TILE + TILE / 2, u.y * TILE + 10, 14, ['#ffd24a', '#ffffff', ITEMS.pokeball.col], { speed: 50, life: .6, grav: -20 });
}
function menuChoose(id) {
  const u = BT.sel;
  if (id === 'property') { const e = warCapture(u); if (!e) { Audio.sfx('error'); return; } BT.queue = [{ kind: 'event', ev: e }]; playQueue(() => finishUnit(u)); return; }
  if (id === 'skill') { if (skillBlock(u)) { Audio.sfx('error'); return; } Audio.sfx('ok'); BT.targets = skillTargetsAt(u); BT.tIdx = 0; BT.mode = 'skillTarget'; setTargetCursor(); return; }
  Audio.sfx('ok');
  if (id === 'wait') finishUnit(u);
  else if (id === 'attack') { BT.targets = seenTargets(u); BT.tIdx = 0; BT.moveIdx = 0; BT.mode = 'target'; setTargetCursor(); }
  else if (id === 'catch') { BT.targets = B.units.filter(v => v.hp > 0 && v.team === 2 && dist(v, u) === 1); BT.tIdx = 0; BT.mode = 'catchTarget'; setTargetCursor(); }
  else if (id === 'seize') { B.seized = true; Audio.sfx('win'); floatText(u.x * TILE + TILE / 2, u.y * TILE - 8, 'SEIZED!', UI.gold, { big: true, life: 1.5 }); spawnParts(u.x * TILE + TILE / 2, u.y * TILE + 8, 30, ['#ffd24a', '#ffffff', '#3d7dff'], { speed: 100, life: 1, grav: 40 }); BT.queue = [{ kind: 'wait', t2: 1.2 }]; playQueue(() => { u.acted = true; checkObjective(); endBattle(); }); }
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
  BT.sel = u; BT.reach = reachable(u, u.x, u.y, dartMov(u), { through: o => fogHides(o, HT()) }); BT.atk = []; BT.path = [{ x: u.x, y: u.y }]; BT.mode = 'move'; BT.dart = true; BT.undo = null; BT.cx = u.x; BT.cy = u.y; keepCursorVisible();
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
function cooldownText(sk) { return sk.cd === 2 ? TR('every other turn') : TR('again in {0} turns', sk.cd); }
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
  const u = BT.sel, t = BT.targets[BT.tIdx]; const ball = BT.ball; if (!t || !ball || !canTakeAction(u) || t.hp <= 0 || t.team !== 2 || dist(u, t) !== 1 || (ball === 'practiceball' && !isPracticeTarget(t))) return;
  if (isPracticeTarget(t) && !practiceReady(t)) { Audio.sfx('error'); return; }
  if (ball !== 'practiceball') { if (B.bag.pokeball > 0) B.bag.pokeball--; else if (B.war && B.war.funds[u.team] >= WAR.ball) B.war.funds[u.team] -= WAR.ball; else return; }
  const r = tryCapture(t, ITEMS[ball]);
  BT.queue = [{ kind: 'event', ev: { type: 'capture', unit: t, ok: r.ok, shakes: r.shakes, from: { x: u.x, y: u.y }, ball, team: u.team } }]; BT.boxNew = r.ok ? true : BT.boxNew;
  if (r.ok) BT.queue.push({ kind: 'fn', fn: () => {
    if (isPracticeTarget(t)) B.lesson.complete = true;
    powerCharge(u.team, 15); if (B.safari) safariCatch(u.team, t);
    // the catch goes to the catcher's PC Box (its first deployment is free); a campaign catch also joins the collection
    t.hp = 0; t.captured = true; const e = warBoxAdd(u.team, Object.assign({}, t, { ai: null, boss: false, provoked: false }));
    if (!B.versus && u.team === 0) { B.captured.push(serializeUnit(Object.assign({}, t, { team: 0, hp: Math.max(1, Math.floor(t.maxHp * .5)) }))); if (e) e.captIdx = B.captured.length - 1; } } });
  playQueue(() => { finishUnit(u); });
}
function finishUnit(u) {
  warSettle();
  u.acted = true; u.moved = true;
  if (B.versus) { const fe = versusAfterAction(u); if (fe) { Audio.sfx(fe.what === 'captured' ? 'select' : 'item'); floatText(u.x * TILE + TILE / 2, u.y * TILE - 8, fe.what === 'taken' ? 'FLAG TAKEN!' : fe.what === 'returned' ? 'Flag returned' : 'CAPTURED!', fe.what === 'captured' ? UI.gold : teamColorL(u.team), { big: fe.what !== 'returned', life: 1.4, outline: '#000' }); } }
  if (B.fog) refreshVision(HT()); BT.sel = null; BT.reach = null; BT.atk = null; BT.undo = null; BT.menu = null; BT.dart = false; BT.hpShow.clear();
  for (const v of B.units) { v.fx.dx = v.fx.dy = 0; v.fx.sx = v.fx.sy = 1; v.fx.alpha = 1; v.fx.flash = 0; v.fx.showNum = null; v.fx.walk = false; }
  if (checkObjective()) { endBattle(); return; }
  if (!B.territory && !powerState(HT()) && alive(HT()).every(v => v.acted)) { BT.mode = 'idle'; BT.autoEnd = .6; return; }
  BT.mode = 'idle'; const f = alive(HT()).find(v => !v.acted); if (f && !VIEW.touch) { /* keep the cursor where it is; the player picks the next unit */ }
}
function cancel() {
  if (BT.mode === 'move' && BT.dart) { const u = BT.sel; BT.cx = u.x; BT.cy = u.y; Audio.sfx('cancel'); finishUnit(u); } // staying put ends the darting unit's turn
  else if (BT.mode === 'move') { BT.sel.fx.sx = BT.sel.fx.sy = 1; BT.cx = BT.sel.x; BT.cy = BT.sel.y; BT.sel = null; BT.reach = null; BT.atk = null; BT.mode = 'idle'; Audio.sfx('cancel'); }
  else if (BT.mode === 'menu') { const u = BT.sel; if (BT.undo && BT.undo.unit === u) { u.x = BT.undo.x; u.y = BT.undo.y; u.moved = false; BT.undo = null; } BT.menu = null; selectUnit(u); BT.cx = u.x; BT.cy = u.y; Audio.sfx('cancel'); }
  else if (BT.mode === 'target' || BT.mode === 'catchTarget' || BT.mode === 'skillTarget') { BT.mode = 'menu'; BT.cx = BT.sel.x; BT.cy = BT.sel.y; openActionMenu(BT.sel); Audio.sfx('cancel'); }
  else if (BT.mode === 'endmenu' && BT.menu && BT.menu.back) { const b = BT.menu.back; Audio.sfx('cancel'); b(); } // a submenu steps back to the one that opened it
  else if (BT.mode === 'help' || BT.mode === 'unitinfo' || BT.mode === 'endmenu') { BT.mode = 'idle'; Audio.sfx('cancel'); }
  else if (BT.mode === 'idle') { openEndMenu(); Audio.sfx('menu'); }
}
const BATTLE_PREF_LABEL = { full: 'Full duel', quick: 'Quick duel', map: 'Map only' };
function endTurn() { BT.mode = 'anim'; BT.sel = null; BT.autoEnd = 0; for (const u of alive(HT())) u.acted = true; nextPhase(); }

// ---------------------------------------------------------------- enemy phase playback
function runEnemyPhase(team) {
  const order = alive(team).filter(u => u.hp > 0 && !u.acted).sort((a, b) => b.level - a.level); // acted: spent the turn recharging
  const step = () => {
    warSettle();
    if (checkObjective()) { endBattle(); return; }
    const u = order.shift(); if (!u) { nextPhase(); return; }
    if (u.hp <= 0) { step(); return; }
    if (!canTakeAction(u)) { step(); return; }
    const d = aiDecide(u);
    if (!d) { step(); return; }
    BT.queue = [];
    if (d.x !== u.x || d.y !== u.y) { const reach = reachable(u); const p = pathTo(reach, d.x, d.y); if (p) BT.queue.push({ kind: 'fn', fn: () => { centerCam(u.x, u.y); } }, { kind: 'wait', t2: .25 }, { kind: 'move', unit: u, path: p }); }
    if (d.capture) { BT.queue.push({ kind: 'fn', fn: () => { const e = warCapture(u); if (e) BT.queue.unshift({ kind: 'event', ev: e }); } }); }
    else if (d.catch) { BT.queue.push({ kind: 'fn', fn: () => { const c = safariThrow(u, d.target); if (c) BT.queue.unshift({ kind: 'event', ev: c.ev }, { kind: 'fn', fn: c.done }); } }); }
    else if (d.skill) { BT.queue.push({ kind: 'fn', fn: () => { BT.queue.unshift(...skillQueue(u, d.skill, d.target)); } }); }
    else if (d.target) {
      BT.queue.push({ kind: 'fn', fn: () => { BT.queue.unshift(...combatQueue(u, d.target, d.move, { x: d.x, y: d.y })); } });
      // a scout darts once the exchange has played out (the queue item runs after the duel, so the outcome is known)
      BT.queue.push({ kind: 'fn', fn: () => { const c = aiDart(u); if (!c) return; const p = pathTo(reachable(u, u.x, u.y, dartMov(u)), c.x, c.y); if (p) BT.queue.unshift({ kind: 'fn', fn: () => floatText(u.x * TILE + TILE / 2, u.y * TILE - 6, 'DART!', ROLES.scout.col, { outline: '#000', life: .9 }) }, { kind: 'move', unit: u, path: p }); } });
    }
    BT.queue.push({ kind: 'wait', t2: .15 });
    playQueue(() => { u.acted = true; step(); });
  };
  const power = aiPower(team); BT.queue = [];
  const boss = !B.versus && !B.territory && team === 1 && !B.bossAlerted && B.units.find(u => u.boss && u.hp > 0 && u.team === 1 && (u.provoked || u.ai === 'aggro'));
  if (boss) { B.bossAlerted = true; BT.queue.push({ kind: 'fn', fn: () => centerCam(boss.x, boss.y) }, { kind: 'event', ev: { type: 'bossAlert', unit: boss } }); }
  if (power) BT.queue.push(...power.map(ev => ({ kind: 'event', ev })));
  if (BT.queue.length) playQueue(step); else step();
}

// ---------------------------------------------------------------- input handling
function battleInput(ev) {
  if (BT.mode === 'power') { powerInput(ev); return; }
  if (BT.mode === 'confirm') { confirmInput(ev); return; }
  if (ev.type === 'key' && ev.key === 'mute') { Audio.toggle(); return; }
  if (ev.type === 'key' && ev.key === 'fast') { BT.fast = !BT.fast; const d = duelActive(); floatText(d ? VIEW.w / 2 : bvW() / 2 + CAM.x, d ? 40 : CAM.y + 40 / BT.zoom, BT.fast ? 'FAST MODE' : 'NORMAL SPEED', UI.gold); return; }
  if (BT.mode === 'territoryGuide') { if (ev.type === 'key' && (ev.key === 'ok' || ev.key === 'back')) closeTerritoryGuide(); else if (ev.type === 'up') hudHit(ev.x, ev.y); return; }
  if (duelActive()) { duelInput(BT.anim, ev); return; }
  if (ev.type === 'key' && (ev.key === 'zoomin' || ev.key === 'zoomout')) { if (setZoom(ev.key === 'zoomin' ? 1 : .5)) Audio.sfx('menu'); return; }
  if (BT.mode === 'banner') { if (ev.type === 'down' || (ev.type === 'key' && ev.key === 'ok')) { if (BT.banner.vs && BT.banner.vs.t < COVS_DUR) BT.banner.vs.t = Math.max(BT.banner.vs.t, COVS_DUR - .3); else BT.banner.t = Math.max(BT.banner.t, 1.1); } return; }
  if (BT.mode === 'handoff') { if (BT.handoff.t > .4 && (ev.type === 'up' || (ev.type === 'key' && ev.key === 'ok'))) { BT.mode = 'banner'; BT.banner.t = 0; Audio.sfx('phase'); } return; }
  if (BT.mode === 'anim') { if (ev.type === 'down' || ev.type === 'key') { BT.fastTap = .4; } return; }
  if (BT.mode === 'end') { if (BT.endTimer > 1.2 && (ev.type === 'down' || (ev.type === 'key' && ev.key === 'ok'))) { BT.endTimer = 99; } return; }
  if (BT.mode === 'help') { if (ev.type === 'down' || (ev.type === 'key')) { if (ev.type === 'key' && (ev.key === 'right' || ev.key === 'ok') || ev.type === 'down') { const r = helpRect(); if (r.next != null) BT.helpOffset = r.next; else { BT.helpOffset = 0; BT.helpPage++; if (BT.helpPage >= HELP_PAGES.length) { BT.helpPage = 0; BT.mode = 'idle'; } } } else if (ev.key === 'left') { if (BT.helpOffset) BT.helpOffset = Math.max(0, BT.helpOffset - helpRect().limit); else BT.helpPage = Math.max(0, BT.helpPage - 1); } else if (ev.key === 'back' || ev.key === 'help') { BT.mode = 'idle'; BT.helpPage = 0; BT.helpOffset = 0; } } return; }
  if (BT.mode === 'unitinfo') { if (ev.type === 'down' || ev.type === 'key') { if (ev.type === 'key' && (ev.key === 'left' || ev.key === 'right' || ev.key === 'prev' || ev.key === 'next')) { const list = B.units.filter(u => u.hp > 0 && !fogHides(u, HT())); let i = list.indexOf(BT.info); i = (i + (ev.key === 'left' || ev.key === 'prev' ? -1 : 1) + list.length) % list.length; BT.info = list[i]; BT.cx = BT.info.x; BT.cy = BT.info.y; keepCursorVisible(); Audio.sfx('cursor'); } else { BT.mode = 'idle'; Audio.sfx('cancel'); } } return; }
  if (ev.type === 'key') { keyInput(ev.key); return; }
  if (ev.type === 'wheel') { if ((BT.mode === 'menu' || BT.mode === 'endmenu') && BT.menu) { menuWheel(ev.dy); return; } CAM.tx += ev.dx / BT.zoom; CAM.ty += ev.dy / BT.zoom; clampCam(); return; }
  pointerInput(ev);
}
function keyInput(k) {
  const m = BT.mode;
  if (k === 'power' && m === 'idle') { openPowerMenu(); return; }
  if (m === 'menu' || m === 'endmenu') { if (k === 'up') menuNav(-1); else if (k === 'down') menuNav(1); else if (k === 'ok') activateMenu(); else if (k === 'back') cancel(); return; }
  if (m === 'target' && k === 'detail') { BT.forecastDetail = !BT.forecastDetail; Audio.sfx('menu'); return; }
  if (m === 'target' || m === 'catchTarget' || m === 'skillTarget') { if (k === 'left' || k === 'up' || k === 'prev') { BT.tIdx = (BT.tIdx - 1 + BT.targets.length) % BT.targets.length; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } else if (k === 'right' || k === 'down' || k === 'next') { BT.tIdx = (BT.tIdx + 1) % BT.targets.length; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } else if (k === 'info') { BT.moveIdx++; Audio.sfx('menu'); } else if (k === 'ok') { if (m === 'target') confirmAttack(); else if (m === 'skillTarget') confirmSkill(); else pickBall(); } else if (k === 'back') cancel(); return; }
  if (k === 'help') { BT.mode = 'help'; BT.helpPage = 0; BT.helpOffset = 0; return; }
  const dx = k === 'left' ? -1 : k === 'right' ? 1 : 0, dy = k === 'up' ? -1 : k === 'down' ? 1 : 0;
  if (dx || dy) { const nx = clamp(BT.cx + dx, 0, B.map.w - 1), ny = clamp(BT.cy + dy, 0, B.map.h - 1); if (nx !== BT.cx || ny !== BT.cy) { BT.cx = nx; BT.cy = ny; keepCursorVisible(); Audio.sfx('cursor'); if (m === 'move') extendPath(nx, ny); } return; }
  if (k === 'ok') { tileAction(BT.cx, BT.cy); return; }
  if (k === 'back') { cancel(); return; }
  if (k === 'next' || k === 'prev') { const list = alive(HT()).filter(u => !u.acted); if (list.length && m === 'idle') { const cur = list.findIndex(u => u.x === BT.cx && u.y === BT.cy); const n = list[(cur + (k === 'next' ? 1 : -1) + list.length) % list.length]; BT.cx = n.x; BT.cy = n.y; keepCursorVisible(); Audio.sfx('cursor'); } return; }
  if (k === 'info') { const u = seenUnitAt(BT.cx, BT.cy); if (u && m === 'idle') { BT.info = u; BT.mode = 'unitinfo'; Audio.sfx('ok'); } return; }
}
// Throwing: the practice ball on Oak's Caterpie (only once it is weak enough), a counted Poké Ball on anything else.
function pickBall() {
  const t = BT.targets[BT.tIdx]; if (!t) return;
  if (isPracticeTarget(t)) { if (!practiceReady(t)) { Audio.sfx('error'); floatText(t.x * TILE + TILE / 2, t.y * TILE - 6, 'Weaken it first!', UI.gold, { outline: '#000' }); return; } BT.ball = 'practiceball'; }
  else { if (!(B.bag.pokeball > 0) && !(B.war && B.war.funds[HT()] >= WAR.ball)) { Audio.sfx('error'); return; } BT.ball = 'pokeball'; }
  Audio.sfx('ok'); confirmCatch();
}
function tileAction(x, y) {
  const m = BT.mode; const u = seenUnitAt(x, y);
  if (m === 'idle') {
    if (B.war && !u) { const p = warProperty(x, y); if (p && p.owner === HT() && (p.kind === 'hq' || p.kind === 'center') && warHasBox(HT())) { openDeployMenu(p); return; } }
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
    if (BT.reach.has(key(x, y)) && standable(BT.sel, x, y)) { extendPath(x, y); confirmMove(); return; }
    Audio.sfx('error'); return;
  }
}
function confirmMoveThenAttack() { const u = BT.sel; BT.undo = { unit: u, x: u.x, y: u.y }; Audio.sfx('ok'); const fp = fogPath(u, BT.path.slice()); BT.queue = [{ kind: 'move', unit: u, path: fp.path }]; playQueue(() => { u.moved = true; pickupAt(u); if (fp.ambush) { BT.undo = null; ambushed(u, fp.ambush); return; } openActionMenu(u); const t = BT.pendingTarget; BT.pendingTarget = null; const tg = seenTargets(u); if (t && tg.includes(t)) { BT.targets = tg; BT.tIdx = tg.indexOf(t); BT.moveIdx = 0; BT.mode = 'target'; setTargetCursor(); } }); }
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
    if (m === 'menu' || m === 'endmenu') { const h = menuHit(ev.x, ev.y); if (h >= 0 && h !== BT.menu.i) { BT.menu.i = h; Audio.sfx('menu'); } return; }
    if (m === 'target' || m === 'catchTarget' || m === 'skillTarget') { const ti = BT.targets.findIndex(t => t.x === tx && t.y === ty); if (ti >= 0 && ti !== BT.tIdx) { BT.tIdx = ti; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } return; }
    if (hudCovers(ev.x, ev.y)) return; // pointer over a HUD panel: the board underneath is not being pointed at
    if (inMap(tx, ty) && (tx !== BT.cx || ty !== BT.cy) && (m === 'idle' || m === 'move')) { BT.cx = tx; BT.cy = ty; if (m === 'move') extendPath(tx, ty); }
    return;
  }
  if (ev.type === 'up') {
    if (BT.dragged) { BT.dragged = false; BT.dragStart = null; return; } BT.dragStart = null;
    const { x: tx, y: ty } = screenToTile(ev.x, ev.y);
    if (hudHit(ev.x, ev.y)) return;
    if (m === 'menu' || m === 'endmenu') { const h = menuHit(ev.x, ev.y); if (h >= 0) { BT.menu.i = h; activateMenu(); } else if (h === -1) cancel(); return; } // a tap between rows (the header, the footer) does nothing
    if (m === 'target' || m === 'catchTarget' || m === 'skillTarget') { const go = () => { if (m === 'target') confirmAttack(); else if (m === 'skillTarget') confirmSkill(); else pickBall(); }; const ti = BT.targets.findIndex(t => t.x === tx && t.y === ty); if (ti >= 0) { if (ti === BT.tIdx) go(); else { BT.tIdx = ti; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } } else if (m === 'target' && detailHit(ev.x, ev.y)) { BT.forecastDetail = !BT.forecastDetail; Audio.sfx('menu'); } else if (forecastHit(ev.x, ev.y)) go(); else if (m === 'target' && moveSwitchHit(ev.x, ev.y)) { BT.moveIdx++; Audio.sfx('menu'); } else cancel(); return; }
    if (hudCovers(ev.x, ev.y)) return; // a tap on a card is not a tap on the tile under it
    if (!inMap(tx, ty)) { if (m === 'move') cancel(); return; }
    if (ev.touch && (tx !== BT.cx || ty !== BT.cy) && m === 'move') { BT.cx = tx; BT.cy = ty; extendPath(tx, ty); keepCursorVisible(); Audio.sfx('cursor'); const u = unitAt(tx, ty); if (!u || u === BT.sel) return; }
    if (ev.touch && m === 'idle' && (tx !== BT.cx || ty !== BT.cy)) { BT.cx = tx; BT.cy = ty; keepCursorVisible(); const u = unitAt(tx, ty); if (!u) { Audio.sfx('cursor'); return; } }
    BT.cx = tx; BT.cy = ty; tileAction(tx, ty);
  }
}

// ---------------------------------------------------------------- update
function battleUpdate(dt) {
  if (B && B.fog) refreshVision(HT());
  BT.time += dt;
  if (BT.mode !== BT.lastMode) { BT.lastMode = BT.mode; BT.hoverAnchor = { x: INPUT.x, y: INPUT.y }; }
  if (FX.hitstop > 0) { FX.hitstop -= dt; dt *= .15; }
  if (BT.fastTap > 0) { BT.fastTap -= dt; dt *= 2.2; }
  const cs = BT.mode === 'anim' || BT.mode === 'banner' ? 10 : 14; CAM.x += (CAM.tx - CAM.x) * Math.min(1, dt * cs); CAM.y += (CAM.ty - CAM.y) * Math.min(1, dt * cs); if (Math.abs(CAM.tx - CAM.x) < .5) CAM.x = CAM.tx; if (Math.abs(CAM.ty - CAM.y) < .5) CAM.y = CAM.ty;
  for (const u of B.units) { const f = u.fx; f.sx += (1 - f.sx) * Math.min(1, dt * 12); f.sy += (1 - f.sy) * Math.min(1, dt * 12); if (f.hit > 0) { f.hit -= dt; if (f.hit <= 0) { f.flash = 0; f.dx = f.dy = 0; } } if (f.dodge > 0) { f.dodge -= dt; if (f.dodge <= 0) f.dx = 0; } }
  for (const [id, h] of BT.hpShow) { if (h.hold) continue; h.t += dt * 2.5; if (h.t >= 1) BT.hpShow.delete(id); }
  if (BT.quip) { BT.quip.t += dt; if (BT.quip.t > 1.6) BT.quip = null; }
  if (BT.mode === 'handoff') BT.handoff.t += dt;
  if (BT.mode === 'banner' && BT.banner.vs && BT.banner.vs.t < COVS_DUR) { coVsStep(BT.banner.vs, dt); } else if (BT.mode === 'banner') { BT.banner.t += dt; if (!BT.banner.slammed && BT.banner.t > .2) { BT.banner.slammed = true; if (!REDUCED) shake(2); } if (BT.banner.t > (BT.fast ? .9 : 1.5)) { BT.mode = 'anim'; const f = BT.afterBanner; BT.afterBanner = null; f(); } }
  if (BT.mode === 'anim') updateAnim(dt);
  if (BT.mode === 'end') { const was = BT.endTimer; BT.endTimer += dt; endSequenceCues(was, BT.endTimer); if (BT.endTimer > 4.4 || BT.endTimer >= 99) { BT.endTimer = 0; onBattleEnd(B.result); } }
  if (BT.autoEnd > 0 && BT.mode === 'idle') { BT.autoEnd -= dt; if (BT.autoEnd <= 0) endTurn(); }
  if (!B.territory && BT.mode === 'idle' && isHuman(B.phase) && !alive(B.phase).some(u => !u.acted) && !BT.autoEnd && !B.result) BT.autoEnd = .4;
  updateFX(dt); Audio.tick();
}

// ---------------------------------------------------------------- drawing
function battleDraw() {
  const d = duelActive(); if (d) { drawDuelFrame(d); return; }
  drawBoard(); drawHUD(); drawDuelWipeOut();
}
// The board layer is drawn in board space under ctx.scale(BT.zoom); floating texts and the screen flash are
// drawn afterwards at screen scale so they stay legible when zoomed out.
function drawBoard() {
  ctx.save(); ctx.scale(BT.zoom, BT.zoom); drawBoardLayer(); ctx.restore();
  drawWeather(weatherKind(), VIEW.w, VIEW.h, BT.time);
  drawFXTexts(-CAM.x + FX.shakeX, -CAM.y + FX.shakeY, BT.zoom);
  if (BT.mode === 'target') drawAimBubble();
  if (FX.flash > 0) { ctx.globalAlpha = FX.flash * .7; rect(0, 0, VIEW.w, VIEW.h, FX.flashCol); ctx.globalAlpha = 1; }
}
// ---------------------------------------------------------------- aiming
// Target mode on the board: dots march from the attacker to the chosen target (arcing for ranged moves), a lock-on
// ring closes in whenever the target changes, and a bubble over the target says what the attack will do to it.
function aimState() { const t = BT.targets[BT.tIdx]; if (!t) return null; if (BT.aimId !== t.id) { BT.aimId = t.id; BT.aimT0 = BT.time; } const raw = (BT.time - BT.aimT0) / .18; return { t, raw, k: REDUCED ? 1 : Math.min(1, raw) }; }
function drawAimLine() {
  const u = BT.sel, a = aimState(); if (!u || !a) return; const t = a.t, d = Math.abs(u.x - t.x) + Math.abs(u.y - t.y);
  const ax = tileX(u.x) + TILE / 2, ay = tileY(u.y) + TILE / 2 - 4, bx = tileX(t.x) + TILE / 2, by = tileY(t.y) + TILE / 2 - 4;
  const n = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / 6)), h = d > 1 ? Math.min(22, 4 + d * 4) : 0, march = REDUCED ? 0 : (BT.time * 2.4) % 1;
  for (let i = 0; i < n; i++) { const f = (i + march) / n; if (f < .16 || f > .84 || f > a.k) continue; const x = Math.round(lerp(ax, bx, f)), y = Math.round(lerp(ay, by, f) - Math.sin(f * Math.PI) * h); rect(x - 2, y - 2, 4, 4, '#2a0a10'); rect(x - 1, y - 1, 2, 2, '#ff6a6a'); px(x - 1, y - 1, '#ffd0c8'); }
}
function drawAimLock() {
  const a = aimState(); if (!a) return; const cf = currentForecast(), ko = cf && cf.fc.koD; const t = a.t, cx = tileX(t.x) + TILE / 2, cy = tileY(t.y) + TILE / 2 + 1;
  const col = ko ? UI.gold : '#ff5a5a', r = Math.round(lerp(30, 19, easeOut(a.k)) + (a.k >= 1 && !REDUCED ? Math.sin(BT.time * 6) : 0)), flash = !REDUCED && a.raw >= 1 && a.raw < 1.7;
  ctx.globalAlpha = .4 + .6 * a.k; ellipseRing(cx, cy, r + 1, r + 1, 3, '#1a0508'); ellipseRing(cx, cy, r, r, 1, flash ? '#ffffff' : col);
  // four ticks: diagonal while the ring closes in, square to the tile once it has locked
  const locked = a.k >= 1; for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + (locked ? 0 : Math.PI / 4), ox = Math.round(Math.cos(an) * (r + 3)), oy = Math.round(Math.sin(an) * (r + 3)); if (locked) { const hz = i % 2 === 0; rect(cx + ox - (hz ? (ox > 0 ? 0 : 5) : 1), cy + oy - (hz ? 1 : (oy > 0 ? 0 : 5)), hz ? 6 : 3, hz ? 3 : 6, '#1a0508'); rect(cx + ox - (hz ? (ox > 0 ? -1 : 4) : 0), cy + oy - (hz ? 0 : (oy > 0 ? -1 : 4)), hz ? 4 : 1, hz ? 1 : 4, flash ? '#ffffff' : col); } else { rect(cx + ox - 2, cy + oy - 2, 4, 4, '#1a0508'); rect(cx + ox - 1, cy + oy - 1, 2, 2, col); } }
  ctx.globalAlpha = 1;
}
// The bubble (screen space, so it keeps its size at any zoom): the HP the attack takes, or KO!, coloured by the matchup.
function drawAimBubble() {
  const cf = currentForecast(), a = aimState(); if (!cf || !a) return; const t = cf.target, fc = cf.fc, eff = fc.a.eff, lost = Math.max(0, t.hp - fc.hpD);
  const s = fc.koD ? 'KO!' : eff === 0 ? 'IMMUNE' : '-' + lost, arrow = fc.koD || eff === 0 ? '' : eff > 1 ? '▲' : eff < 1 ? '▼' : '';
  const ink = fc.koD ? UI.gold : eff > 1 ? '#ffb040' : eff < 1 ? '#a0d0ff' : '#ffffff', fill = fc.koD ? '#8a1c24' : '#101a30', edge = fc.koD ? UI.gold : '#ff5a5a';
  const w = textWidth(s, BIG) + 10 + (arrow ? textWidth(arrow) + 3 : 0), h = 15, z = BT.zoom, sx = toScreenX(tileX(t.x) + TILE / 2), top = toScreenY(tileY(t.y)), bot = toScreenY(tileY(t.y) + TILE);
  const pop = REDUCED ? 0 : Math.round((1 - easeOutBack(a.k, 2.4)) * 6), below = top - h - 9 < 2, x = Math.round(clamp(sx - w / 2, 2, VIEW.w - w - 2));
  const y = below ? bot + 7 + pop : top - h - 6 - pop + (REDUCED ? 0 : Math.round(Math.sin(BT.time * 4)));
  rrect(x, y + 1, w, h, '#000000', 2); rrect(x - 1, y - 1, w + 2, h + 1, '#1a0508', 2); rrect(x, y, w, h - 1, fill, 2); hline(x + 2, y, w - 4, edge); hline(x + 2, y + h - 2, w - 4, shade(fill, -.3));
  const tx = Math.round(clamp(sx, x + 4, x + w - 4)); // the tail points at the target even when the bubble is pushed off-centre
  if (below) { rect(tx - 2, y - 3, 5, 2, '#1a0508'); rect(tx - 1, y - 5, 3, 2, '#1a0508'); rect(tx - 1, y - 2, 3, 2, fill); px(tx, y - 4, fill); }
  else { rect(tx - 2, y + h - 1, 5, 2, '#1a0508'); rect(tx - 1, y + h + 1, 3, 2, '#1a0508'); rect(tx - 1, y + h - 1, 3, 2, fill); px(tx, y + h + 1, fill); }
  bigText(s, x + 5, y + 3, ink, { outline: '#000' }); if (arrow) text(arrow, x + w - 5 - textWidth(arrow), y + 4, ink, { outline: '#000' });
}
function drawBoardLayer() {
  const m = B.map; const f = Math.floor(BT.time * 3) % WATER_FRAMES;
  updateTallTerrain(B, BT.time);
  drawVoid();
  const x0 = Math.max(0, Math.floor(CAM.x / TILE)), y0 = Math.max(0, Math.floor(CAM.y / TILE)), x1 = Math.min(m.w - 1, Math.ceil((CAM.x + bvW()) / TILE)), y1 = Math.min(m.h - 1, Math.ceil((CAM.y + bvH()) / TILE));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    drawTerrain(ctx, m, x, y, tileX(x), tileY(y), f, BT.time);
  }
  if (!REDUCED) drawBoardAmbience(m);
  // items on the floor
  for (const it of m.items) if (!it.taken) drawPickup(tileX(it.x) + TILE / 2, tileY(it.y) + TILE / 2 + 2, BT.time, it.x * 7 + it.y * 3);
  // king of the hill zone and capture-the-flag bases
  if (B.hill) { const h = B.hill, X = tileX(h.x - h.r), Y = tileY(h.y - h.r), S = (2 * h.r + 1) * TILE; const k = Math.floor(BT.time * 3) % 2; ctx.globalAlpha = .18; rect(X, Y, S, S, UI.gold); ctx.globalAlpha = 1; outline(X + k, Y + k, S - 2 * k, S - 2 * k, UI.gold); for (const [cx, cy] of [[X, Y], [X + S - 6, Y], [X, Y + S - 6], [X + S - 6, Y + S - 6]]) rect(cx, cy, 6, 6, UI.goldDark); text('HILL', X + S / 2 - textWidth('HILL') / 2, Y - 9, UI.gold, { outline: '#000' }); }
  if (B.flags) for (const f of B.flags) { const X = tileX(f.home.x), Y = tileY(f.home.y); ctx.globalAlpha = .25; rect(X + 2, Y + 2, TILE - 4, TILE - 4, teamColor(f.team)); ctx.globalAlpha = 1; outline(X + 2, Y + 2, TILE - 4, TILE - 4, teamColorD(f.team)); rect(X + 10, Y + TILE - 8, 12, 3, teamColorD(f.team)); rect(X + 12, Y + TILE - 6, 8, 1, teamColorL(f.team)); if (f.carrier == null) drawFlag(tileX(f.x) + 13, tileY(f.y) + 6 + Math.round(Math.sin(BT.time * 5) * 1), f.team, Math.floor(BT.time * 6) % 2); }
  // seize target marker
  if (m.seize) { const X = tileX(m.seize.x), Y = tileY(m.seize.y); const k = Math.floor(BT.time * 4) % 2; outline(X + 2 + k, Y + 2 + k, TILE - 4 - 2 * k, TILE - 4 - 2 * k, UI.gold); bigC('!', X + TILE / 2, Y - 8 + Math.round(Math.sin(BT.time * 5) * 2), UI.gold, { outline: '#000' }); }
  // danger zone: wild threats in yellow underneath, trainer threats in red on top
  if (BT.showDanger && (BT.mode === 'idle' || BT.mode === 'move')) {
    const dz = dangerZones(HT(), B.vis); const toCells = set => [...set].map(k => { const [x, y] = k.split(',').map(Number); return { x, y }; });
    rangeOverlay(toCells(dz.wild), (x, y) => dz.wild.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, DANGER.wild[0], DANGER.wild[1], Math.floor(BT.time * 6));
    rangeOverlay(toCells(dz.trainer), (x, y) => dz.trainer.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, DANGER.trainer[0], DANGER.trainer[1], Math.floor(BT.time * 6));
  }
  // move / attack ranges
  if (BT.sel && (BT.mode === 'move' || BT.mode === 'anim' && BT.anim && BT.anim.kind === 'move' && BT.anim.unit === BT.sel)) {
    // the blue floods out from the unit, one step of movement cost at a time; the red attack fringe fades in after it
    const k = REDUCED ? 99 : (BT.time - (BT.selT0 == null ? -9 : BT.selT0)) / .2; let maxC = 0; for (const n of BT.reach.values()) maxC = Math.max(maxC, n.cost); const lim = k * (maxC + 1) - .5;
    const shown = (x, y) => { const n = BT.reach.get(key(x, y)); return !!n && n.cost <= lim; };
    const cells = [...BT.reach.values()].filter(n => canStand(BT.sel, n.x, n.y) && n.cost <= lim);
    rangeOverlay(cells, shown, -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#3060e0', '#a0c0ff', Math.floor(BT.time * 6));
    if (k >= 1) rangeOverlay(BT.atk, (x, y) => BT.reach.has(key(x, y)) || BT.atk.some(c => c.x === x && c.y === y), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e03030', '#ffa0a0', Math.floor(BT.time * 6), Math.min(1, (k - 1) * 3));
  }
  // resting the cursor on a foe shows how far it can move and strike, faintly, without switching DANGER on
  if (BT.mode === 'idle' && !BT.showDanger && !REDUCED) { const hov = seenUnitAt(BT.cx, BT.cy); if (hov && hov.hp > 0 && hostile(hov.team, HT())) {
    let c = BT.hoverRange; if (!c || c.id !== hov.id || c.turn !== B.turn || c.x !== hov.x || c.y !== hov.y) { const r = reachable(hov); c = BT.hoverRange = { id: hov.id, turn: B.turn, x: hov.x, y: hov.y, t0: BT.time, cells: [...r.values()].filter(n => canStand(hov, n.x, n.y)), r, ac: attackCells(hov, r) }; }
    const k = Math.min(1, (BT.time - c.t0) / .25); ctx.globalAlpha = .55 * k; rangeOverlay(c.cells, (x, y) => c.r.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e03030', '#ffa0a0', Math.floor(BT.time * 6)); rangeOverlay(c.ac, (x, y) => c.r.has(key(x, y)) || c.ac.some(q => q.x === x && q.y === y), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e07030', '#ffc0a0', Math.floor(BT.time * 6)); ctx.globalAlpha = 1; } }
  if (BT.mode === 'unitinfo' && BT.info && BT.info.team !== HT()) { const r = reachable(BT.info); const cells = [...r.values()].filter(n => canStand(BT.info, n.x, n.y)); rangeOverlay(cells, (x, y) => r.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e03030', '#ffa0a0', Math.floor(BT.time * 6)); const ac = attackCells(BT.info, r); rangeOverlay(ac, (x, y) => r.has(key(x, y)) || ac.some(c => c.x === x && c.y === y), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e07030', '#ffc0a0', Math.floor(BT.time * 6)); }
  drawOutposts();
  // target highlights: red for foes, green for allies and self (skills), the chosen one white
  if (BT.mode === 'target' || BT.mode === 'catchTarget' || BT.mode === 'skillTarget') for (const t of BT.targets) { const X = tileX(t.x), Y = tileY(t.y); const k = Math.floor(BT.time * 8) % 2; const friendly = !hostile(t.team, HT()); outline(X + 1 + k, Y + 1 + k, TILE - 2 - 2 * k, TILE - 2 - 2 * k, t === BT.targets[BT.tIdx] ? '#ffffff' : friendly ? '#60e070' : '#ff6060'); }
  if (BT.mode === 'skillTarget' && BT.sel && BT.sel.skill && BT.sel.skill.rng[1] > 0) { const rc = ring(BT.sel.x, BT.sel.y, BT.sel.skill.rng[0], BT.sel.skill.rng[1]); rangeOverlay(rc, (x, y) => rc.some(c => c.x === x && c.y === y), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, BT.sel.skill.target === 'foe' ? '#e03030' : '#30a050', BT.sel.skill.target === 'foe' ? '#ffa0a0' : '#a0ffb0', Math.floor(BT.time * 6)); }
  if (BT.mode === 'move' && BT.path.length > 1) drawArrow(BT.path, -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, BT.time * 1000);
  if (BT.mode === 'target') drawAimLine();
  if (['idle', 'move', 'target', 'catchTarget', 'skillTarget', 'unitinfo'].includes(BT.mode)) drawCursorGlow(tileX(BT.cx), tileY(BT.cy), BT.time * 1000);
  // units (sorted by y so southern sprites overlap northern ones)
  // a unit whose KO the duel scene has not shown yet stays on the board (its HP bar is held at the pre-exchange value)
  const held = u => { const h = BT.hpShow.get(u.id); return h && h.hold; };
  const units = B.units.filter(u => u.hp > 0 || (BT.anim && BT.anim.kind === 'event' && (BT.anim.ev.unit === u)) || held(u)).sort((a, b) => (a.y + a.fx.dy / TILE) - (b.y + b.fx.dy / TILE));
  for (const u of units) { if (fogHides(u, HT())) continue; drawUnit(u); const fl = B.flags && flagCarriedBy(u); if (fl) drawFlag(tileX(u.x) + u.fx.dx + TILE - 9, tileY(u.y) + u.fx.dy - 10 + Math.round(Math.sin(BT.time * 5) * 1), fl.team, Math.floor(BT.time * 6) % 2); }
  // fog of war: unseen tiles fall into darkness
  if (B.fog && B.vis) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!B.vis.has(key(x, y))) { ctx.globalAlpha = .55; rect(tileX(x), tileY(y), TILE, TILE, '#060a16'); ctx.globalAlpha = .35; dither(tileX(x), tileY(y), TILE, TILE, '#0b1020', (x + y) & 1); } ctx.globalAlpha = 1; }
  if (BT.mode === 'target') drawAimLock();
  // cursor
  if (['idle', 'move', 'target', 'catchTarget', 'skillTarget', 'unitinfo'].includes(BT.mode)) { const hostileCur = unitAt(BT.cx, BT.cy) && hostile(unitAt(BT.cx, BT.cy).team, HT()); drawCursor(tileX(BT.cx), tileY(BT.cy), BT.time * 1000, '#ffffff', (BT.mode === 'target' || hostileCur) ? '#ff5a5a' : BT.mode === 'skillTarget' ? '#60e070' : '#ffd24a'); }
  if (BT.anim && BT.anim.kind === 'event' && (BT.anim.ev.type === 'capture' || BT.anim.ev.type === 'recall' || BT.anim.ev.type === 'spawn' && BT.anim.ev.deploy)) drawCatchFx(BT.anim);
  drawFX(-CAM.x + FX.shakeX, -CAM.y + FX.shakeY, false);
}
// Ambient life on outdoor maps: huge soft cloud shadows drifting across the field and a few butterflies. Faint on
// purpose (the board must stay readable) and absent indoors, in caves and with reduced motion.
function boardOutdoor(m) { if (m.outdoor == null) { let g = 0, n = 0; for (const row of m.tiles) for (const t of row) { n++; if (GRASSY.has(t.id) || t.id === 'water' || t.id === 'road' || t.id === 'sand' || t.id === 'bridge') g++; } m.outdoor = g / Math.max(1, n) > .6; } return m.outdoor; }
// The mood of an indoor map from its tiles: lava → embers rising, cave floor → dust motes, a power plant → sparks, other
// floors → dust. Null outdoors.
function boardMood(m) { if (m.mood === undefined) { const c = {}; for (const row of m.tiles) for (const t of row) c[t.id] = (c[t.id] || 0) + 1; m.mood = boardOutdoor(m) ? null : c.lava ? 'embers' : /power/i.test(m.name) ? 'sparks' : 'dust'; } return m.mood; }
function drawIndoorAmbience(m, mood) {
  const ox = -CAM.x + FX.shakeX, oy = -CAM.y + FX.shakeY, mw = m.w * TILE, mh = m.h * TILE, t = BT.time; ctx.save(); ctx.beginPath(); ctx.rect(tileX(0), tileY(0), mw, mh); ctx.clip();
  const n = Math.round(m.w * m.h / 9);
  for (let i = 0; i < n; i++) { const r1 = (i * 7919) % 997 / 997, r2 = (i * 104729) % 991 / 991, sp = .3 + r2 * .7;
    if (mood === 'embers') { const k = (t * .07 * sp + r1) % 1, x = r2 * mw + Math.sin(t * 1.3 + i) * 6, y = mh * (1 - k); ctx.globalAlpha = Math.sin(k * Math.PI) * .9; const ex = Math.round(ox + x), ey = Math.round(oy + y); if (i % 3 === 0) rect(ex, ey, 2, 2, k < .5 ? '#ffd25a' : '#ff7a2c'); else px(ex, ey, k < .5 ? '#ffd25a' : '#ff7a2c'); if (i % 4 === 0) px(ex, ey + 2, '#e04e1a'); }
    else if (mood === 'dust') { const x = (r1 * mw + t * 3 * sp) % mw, y = (r2 * mh + Math.sin(t * .5 + i) * 8 + mh) % mh; ctx.globalAlpha = .25 + .25 * Math.sin(t * 1.1 + i); px(Math.round(ox + x), Math.round(oy + y), '#d8d0e8'); }
    else if (mood === 'sparks' && i % 3 === 0) { const phase = (t * 1.7 + r1 * 7) % 3; if (phase < .18) { const x = Math.round(ox + r2 * mw), y = Math.round(oy + ((r1 * 997) % 1) * mh), f = Math.floor(phase * 30) % 2; ctx.globalAlpha = 1; px(x, y, '#fff6a0'); if (f) { px(x - 1, y - 1, '#f8d030'); px(x + 1, y + 1, '#f8d030'); px(x + 2, y, '#f8d030'); } else { px(x + 1, y - 1, '#f8d030'); px(x - 1, y + 1, '#f8d030'); px(x - 2, y, '#f8d030'); } } } }
  ctx.globalAlpha = 1; ctx.restore();
}
function drawBoardAmbience(m) {
  const mood = boardMood(m); if (mood) { drawIndoorAmbience(m, mood); return; }
  const ox = -CAM.x + FX.shakeX, oy = -CAM.y + FX.shakeY, mw = m.w * TILE, mh = m.h * TILE, t = BT.time;
  ctx.save(); ctx.beginPath(); ctx.rect(tileX(0), tileY(0), mw, mh); ctx.clip();
  ctx.globalAlpha = .075; for (let i = 0; i < 3; i++) { const rx = 70 + i * 18, ry = 30 + i * 6, span = mw + rx * 4, x = ((i * 347 + t * (7 + i * 2)) % span) - rx * 2, y = ((i * 211 + t * 3) % (mh + ry * 4)) - ry * 2; ellipse(Math.round(ox + x), Math.round(oy + y), rx, ry, '#06101a'); ellipse(Math.round(ox + x - rx * .5), Math.round(oy + y + 8), Math.round(rx * .6), Math.round(ry * .6), '#06101a'); } ctx.globalAlpha = 1;
  // chimney smoke: three puffs per cottage rise from its chimney, drift east, swell and fade
  for (const h of mapHouses(m)) { const X = tileX(h.x) + h.cx, Y = tileY(h.y); if (X < -20 || Y < -30 || X > bvW() + 20 || Y > bvH() + 20) continue; drawChimneySmoke(X, Y, t, h.x * .13 + h.y * .07); }
  const cols = ['#ffffff', '#ffe36a', '#ffb3d0']; for (let i = 0; i < 3; i++) { const k = t * (.05 + i * .01) + i * .31, x = (Math.sin(k * 2.3 + i) * .45 + .5) * mw, y = (Math.cos(k * 1.7 + i * 2) * .45 + .5) * mh + Math.sin(t * 6 + i) * 3, flap = Math.floor(t * 10 + i * 3) % 2, X = Math.round(ox + x), Y = Math.round(oy + y);
    if (flap) { px(X - 1, Y, cols[i]); px(X + 1, Y, cols[i]); px(X - 2, Y - 1, cols[i]); px(X + 2, Y - 1, cols[i]); } else { px(X - 1, Y - 1, cols[i]); px(X + 1, Y - 1, cols[i]); } px(X, Y, '#3a2a20'); }
  ctx.restore();
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
// Every species uses its original Showdown mini icon on the board and in unit cards.
// Small offsets, shadows and team marks provide feedback without replacing the artwork.
function drawUnit(u) {
  const f = u.fx; const X = tileX(u.x) + f.dx, Y = tileY(u.y) + f.dy; const cx = X + TILE / 2, by = Y + TILE - 3;
  const { ready, grey, sel, hovered } = unitLook(u);
  const num = f.showNum || u.num;
  // idle life: the selected unit hops; icons (no frames of their own) breathe a little. Ready icons perk up on hover.
  let hop = 0, bsx = 1, bsy = 1;
  if (sel) { const p = Math.abs(Math.sin(BT.time * 9)); hop = p * 2; bsy = 1 + p * .05; bsx = 1 - p * .03; }
  // the turn-start wave: every ready unit hops once, left to right
  else if (ready && BT.waveT0 != null && !REDUCED) { const order = alive(u.team).filter(v => !v.acted).sort((a, b) => a.x - b.x || a.y - b.y).indexOf(u), w = BT.time - BT.waveT0 - order * .07; if (w > 0 && w < .32) { const p = Math.sin(w / .32 * Math.PI); hop = p * 6; bsy = 1 + p * .08; bsx = 1 - p * .06; } }
  else if (!REDUCED && !grey) { if (hovered) { const p = Math.abs(Math.sin(BT.time * 7 + u.id)); hop = p * 1.5; } else if (ready) { const p = Math.abs(Math.sin(BT.time * 3 + u.id * 1.7)); hop = p * 1; } else { const p = .5 + .5 * Math.sin(BT.time * 2.2 + u.id * 2.1); bsy = 1 - p * .02; bsx = 1 + p * .01; } }
  const bob = -Math.round(hop); const air = (f.air || 0) + hop; const gy = by + 1 + (f.air || 0); // ground baseline
  if (u.boss) { ctx.globalAlpha = f.alpha * .9; const k = Math.floor(BT.time * 4) % 2; ellipseRing(cx, gy, 14 + k, 5, 1, '#ffd24a'); ctx.globalAlpha = 1; }
  // a wild Pokémon weak enough to catch wears a small ball that bobs over it; one that broke free steams for a moment
  if (u.team === 2 && u.hp > 0 && u.hp <= u.maxHp / 2 && f.alpha > 0 && !u.boss) drawBall(cx + 10, by - 26 + (REDUCED ? 0 : Math.round(Math.sin(BT.time * 5 + u.id) * 1.5)), ITEMS.pokeball.col, 3);
  if (f.alert != null && BT.time - f.alert < 1.1) { const k = BT.time - f.alert, pop = k < .12 ? 1 : 0; rect(cx - 2 - pop, by - 36 - pop * 2, 5 + pop * 2, 9 + pop * 2, '#1e1a24'); rect(cx - 1, by - 35 - pop * 2, 3, 5 + pop, '#ffffff'); rect(cx - 1, by - 29 - pop, 3, 2, '#ffffff'); }
  if (f.anger != null && BT.time - f.anger < 1.3 && !REDUCED) { const k = Math.floor((BT.time - f.anger) * 8) % 2; stampAt(cx + 7, by - 30 - k, ['R.R.R', '.RRR.', 'RR.RR', '.RRR.', 'R.R.R'], { R: '#ff4a4a' }); }
  const sh = Math.max(.4, 1 - air / 18); ctx.globalAlpha = .3 * f.alpha * sh; ellipse(cx, gy, Math.round(10 * sh), Math.max(1, Math.round(3 * sh)), '#000000'); ctx.globalAlpha = 1;
  if (sel && !REDUCED) { const k = (BT.time * 1.4) % 1; ctx.globalAlpha = (1 - k) * .7 * f.alpha; ellipseRing(cx, gy, Math.round(11 + k * 8), Math.round(4 + k * 3), 1, teamColorL(u.team)); ctx.globalAlpha = 1; }
  const flip = u.team === 1 || u.team === 2 ? f.facing !== 1 : f.facing === -1;
  let tint = null; if (f.flash) tint = '#ffffff'; else if (f.tint) tint = f.tint;
  if (f.alpha > 0) {
    const sx = f.sx * bsx, sy = f.sy * bsy;
    const ol = grey ? '#50546a' : sel || hovered ? teamColorL(u.team) : teamColor(u.team);
    if (grey) { ctx.globalAlpha = .9 * f.alpha; drawMon(num, cx, by + bob, { flip, sx, sy, tint: 'grey', outline: ol }); ctx.globalAlpha = 1; }
    else drawMon(num, cx, by + bob, { flip, sx, sy, tint, alpha: f.alpha, outline: ol });
    if (f.flash === 1 && !grey) { ctx.globalAlpha = f.alpha; drawMon(num, cx, by + bob, { flip, sx, sy, tint: '#ffffff', outline: '#ffffff' }); ctx.globalAlpha = 1; }
  }
  const grassCell = tallUnitCell(u, B.map);
  if (grassCell) drawTallTerrainForeground(ctx, B.map, grassCell.x, grassCell.y, tileX(grassCell.x), tileY(grassCell.y), BT.time);
  const show = BT.hpShow.get(u.id); let hp = u.hp; if (show) hp = Math.round(lerp(show.from, show.to, Math.min(1, show.t)));
  if (f.alpha > 0 && hp > 0) {
    ctx.globalAlpha = f.alpha; const X0 = tileX(u.x), Y0 = tileY(u.y); // corner marks stay on the tile, not on the moving sprite
    teamMark(X0 + 2, Y0 + TILE - 9, u.team, grey);
    const ratio = clamp(hp / u.maxHp, 0, 1);
    if (hp < u.maxHp || show) { const s = String(hp); const w = textWidth(s); const hx = X0 + TILE - 2 - w, hy = Y0 + TILE - 9; const blink = show && show.t < 1 && show.from > show.to && Math.floor(BT.time * 16) % 2; ctx.globalAlpha = .75 * f.alpha; rrect(hx - 2, hy - 1, w + 4, 9, UI.inset, 1); ctx.globalAlpha = f.alpha; text(s, hx, hy, blink ? '#ffffff' : hpColor(ratio), { outline: UI.shadow }); }
    const k = Math.round(Math.sin(BT.time * 5) * 1); let tl = Y0 - 3;
    if (u.leader) { drawCrown(X0 - 1, tl + k); tl += 6; } else if (u.boss) { drawSkull(X0 - 1, tl + k); tl += 8; }
    if (u.recharge) miniBadge('CHG', RECHARGE_COL, X0 - 1, tl);
    let tr = Y0 - 3; if (u.status) { statusBadge(u.status, X0 + TILE - 15, tr); tr += 7; }
    if (u.brace) { miniBadge('BRC', BRACE_COL, X0 + TILE - 15, tr); tr += 7; } if (u.root) miniBadge('RT', ROOT_COL, X0 + TILE - 15, tr);
    ctx.globalAlpha = 1;
  }
}
// 7×7 team mark: own units a round plate, hostile trainers a spike (triangle), wild a diamond, allies a cross. Dimmed,
// not recoloured, when the unit has acted, so the side stays readable on grey sprites.
function teamMark(x, y, team, dim) {
  const shape = teamShape(team); const col = dim ? mix(teamColor(team), '#6a6f7c', .5) : teamColor(team), colL = dim ? mix(teamColorL(team), '#8a8f9c', .5) : teamColorL(team), out = '#0b1020';
  const rows = shape === 'ring' ? ['.OOOOO.', 'OCLCCCO', 'OLCCCCO', 'OCCCCCO', 'OCCCCCO', 'OCCCCCO', '.OOOOO.'] : shape === 'spiked' ? ['...O...', '..OCO..', '..OLO..', '.OCCCO.', '.OCCCO.', 'OCCCCCO', 'OOOOOOO'] : shape === 'dashed' ? ['...O...', '..OCO..', '.OCLCO.', 'OCCCCCO', '.OCCCO.', '..OCO..', '...O...'] : ['..OOO..', '..OCO..', 'OOOCOOO', 'OCLCCCO', 'OOOCOOO', '..OCO..', '..OOO..'];
  stampAt(x, y, rows, { O: out, C: col, L: colL });
}

// ---------------------------------------------------------------- HUD
const HUD = { hits: [], panels: [] };
function hudHit(x, y) { for (const h of HUD.hits) if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) { h.run(); return true; } return false; }
// Is the point over a HUD panel or button drawn this frame (so the board under it is not being pointed at)?
function hudCovers(x, y) { for (const r of HUD.hits.concat(HUD.panels)) if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return true; return false; }
function hudPanel(x, y, w, h, opt) { const p = panel(x, y, w, h, Object.assign({ light: true }, opt)); HUD.panels.push({ x, y, w, h }); return p; }
function button(x, y, w, h, label, run, opt = {}) { const over = INPUT.x >= x && INPUT.y >= y && INPUT.x < x + w && INPUT.y < y + h, hot = over && !VIEW.touch; uiButton(x, y, w, h, label, { hot, pressed: over && INPUT.down, col: opt.col, variant: opt.variant, ink: opt.ink, icon: opt.icon, disabled: opt.disabled, on: opt.on }); HUD.hits.push({ x, y, w, h, run, label }); }
// Screen rectangle of the board (the map itself, not the void around it).
function boardRect() { const z = BT.zoom; return { x: toScreenX(tileX(0) - FX.shakeX), y: toScreenY(tileY(0) - FX.shakeY), w: Math.round(B.map.w * TILE * z), h: Math.round(B.map.h * TILE * z) }; }
// Where the HUD goes. Portrait phones stack everything under the board: context cards, then a two-row button bar.
// Wider screens keep the turn card top-left, the buttons top-right and the context cards at the bottom, on the
// side away from the cursor, hugging the board's lower edge when the board leaves room.
function hudLayout() {
  const W = VIEW.w, H = VIEW.h, bh = btnH(), stack = narrowView() && portraitView(); const br = boardRect();
  const L = { W, H, stack, bh, top: { x: 4, y: 4, w: stack ? W - 8 : W >= 320 ? Math.min(W - 8, 152) : Math.min(W - 8, B.versus ? 128 : 118), h: stack ? 28 : W < 320 ? 24 : 36 } };
  if (B.territory) { L.top.h = stack ? 38 : 44; if (!stack) L.top.w = Math.min(202, W - 72); }
  if (stack) {
    L.bar = { x: 4, y: H - 2 * bh - 8, w: W - 8, rows: 2 }; L.ctxH = 42; L.ctxY = L.bar.y - L.ctxH - 4;
    L.ctx = { x: 4, y: L.ctxY, w: W - 8, h: L.ctxH, unit: true, terrain: true, combined: true };
  } else {
    const cursorLeft = toScreenX(tileX(BT.cx) - FX.shakeX) + TILE * BT.zoom / 2 < W / 2; const ch = 50;
    const y = Math.min(H - ch - 4, Math.max(L.top.y + L.top.h + 4, br.y + br.h + 6)); // under the board when it fits, else at the bottom
    const uw = 140, tw = 100; const x = cursorLeft ? W - 4 - uw - 4 - tw : 4;
    L.ctx = { x, y, w: uw + 4 + tw, h: ch, unitX: x, terrX: x + uw + 4, unitW: uw, terrW: tw, combined: false };
    const bw = Math.max(58, ...['END TURN', 'BACK', 'STAY', 'ZOOM -', 'PC!', 'NEXT'].map(t => textWidth(t) + 6), ...['DANGER', 'FAST'].map(t => textWidth(t) + 15), ...['HELP'].map(t => 2 * textWidth(t) + 16)); // the widest label in the player's language
    L.buttons = { x: W - 4 - bw, y: 4, w: bw };
  }
  return L;
}
// The weather chip under the objective and power cards (its icon, name and the days left), and the banner that
// announces a change: a band across the middle with the icon at 2× and the line, in and out in under two seconds.
function drawWeatherChip(L) {
  const k = weatherKind();
  if (k && !['power', 'help', 'handoff'].includes(BT.mode) && !(B.lesson && !B.lesson.complete)) { const Wt = B.weather, label = WEATHER[k].name.toUpperCase() + (Wt.days ? ' · ' + Wt.days + 'D' : ''), w = textWidth(label) + 22, x = L.top.x, y = L.top.y + L.top.h + powerRibbonHeight() + 3; hudPanel(x, y, w, 13, { fill: UI.panelDark, light: false, flat: true }); weatherIcon(k, x + 4, y + 3); text(label, x + 14, y + 3, k === 'sun' ? UI.gold : k === 'rain' ? '#8ab4ff' : k === 'sand' ? '#e0c890' : '#ffffff'); }
  const wb = BT.weatherBanner; if (!wb) return; const a = BT.time - wb.t0; if (a > 1.8) { BT.weatherBanner = null; return; }
  const W = VIEW.w, H = VIEW.h, k2 = REDUCED ? 1 : Math.min(1, a / .18) * Math.min(1, (1.8 - a) / .25), bh = Math.round(30 * k2), cy = Math.round(H * .38); if (bh < 2) return;
  const col = wb.kind === 'sun' ? '#c87820' : wb.kind === 'rain' ? '#2a5aa8' : wb.kind === 'sand' ? '#a07838' : '#6a86b8'; ctx.globalAlpha = .88; rect(0, cy - (bh >> 1), W, bh, shade(col, -.35)); ctx.globalAlpha = 1; hline(0, cy - (bh >> 1), W, shade(col, .4)); hline(0, cy + (bh >> 1) - 1, W, shade(col, -.6));
  if (bh > 20) { const txt = wb.text.toUpperCase(), tw = textWidth(txt, BIG), x0 = Math.round(W / 2 - (tw + 22) / 2) + (REDUCED ? 0 : Math.round((1 - Math.min(1, a / .25)) * 40)); ctx.save(); ctx.translate(x0, cy - 7); ctx.scale(2, 2); weatherIcon(wb.kind, 0, 0); ctx.restore(); bigText(txt, x0 + 20, cy - 4, '#ffffff', { outline: '#000' }); }
}
function drawHUD() {
  HUD.hits = []; HUD.panels = []; const W = VIEW.w, H = VIEW.h; const L = hudLayout();
  if (BT.mode === 'end') { if (SC.name === 'battle') drawEndScreen(); return; } // the outro dialogue draws over the board, not over the stamp
  const boardModes = ['idle', 'move', 'target', 'catchTarget', 'skillTarget', 'unitinfo', 'menu'];
  // turn / objective / ready-count card (top-left)
  if (BT.mode === 'power') { drawPowerMenu(); return; }
  drawTurnCard(L.top);
  drawPowerStrip(L.top);
  drawWeatherChip(L);
  // context cards: the hovered unit and its terrain, side by side or as one strip on portrait phones
  const hov = seenUnitAt(BT.cx, BT.cy); const t = terrAt(BT.cx, BT.cy);
  if (boardModes.includes(BT.mode) && BT.mode !== 'target' && BT.mode !== 'catchTarget' && BT.mode !== 'skillTarget' && !(L.stack && BT.mode === 'menu')) {
    const ref = hov || BT.sel || { fly: false, swim: false }; const showUnit = hov && BT.mode !== 'menu';
    if (L.stack) { const c = L.ctx; if (showUnit) { hudPanel(c.x, c.y, c.w, c.h, { header: hov.name, headerRight: 'Lv' + hov.level, headerFill: teamColorD(hov.team) }); unitCardBody(hov, c.x, c.y, c.w - 58, true); vline(c.x + c.w - 56, c.y + 16, c.h - 20, UI.border2); terrainCardBody(t, ref, c.x + c.w - 53, c.y + 11, 51, true); } else { hudPanel(c.x, c.y, c.w, c.h); terrainCardBody(t, ref, c.x, c.y + 4, c.w, false); } }
    else { const c = L.ctx; hudPanel(c.terrX, c.y + 14, c.terrW, 36); terrainCardBody(t, ref, c.terrX, c.y + 16, c.terrW, false); if (showUnit) { hudPanel(c.unitX, c.y, c.unitW, c.h, { header: hov.name, headerRight: 'Lv' + hov.level, headerFill: teamColorD(hov.team) }); unitCardBody(hov, c.unitX, c.y, c.unitW, false); } }
  }
  if (BT.mode === 'move' && BT.sel) { const c = BT.sel; textC(c.name + '  ' + (BT.dart ? TR(VIEW.touch ? 'DART {0}' : 'DART {0} · X: stay', dartMov(c)) : TR('MOV {0}', effMov(c))) + (BT.path.length > 1 ? '  →' + (BT.path.length - 1) : ''), W / 2, L.top.y + L.top.h + powerRibbonHeight() + 4, BT.dart ? ROLES.scout.col : UI.ink, { outline: UI.shadow }); }
  if (BT.quip && BT.quip.unit.hp > 0) { const u = BT.quip.unit; const x = toScreenX(tileX(u.x) + TILE / 2) + 16, y = toScreenY(tileY(u.y)) - 12 - Math.min(6, BT.quip.t * 30); const tw = textWidth(BT.quip.text) + 8; rrect(x - 2, y - 2, tw, 11, UI.shadow, 1); rrect(x - 3, y - 3, tw, 11, '#ffffff', 1); text(BT.quip.text, x + 1, y - 1, '#202030'); px(x, y + 8, '#ffffff'); px(x - 1, y + 9, '#ffffff'); }
  if (BT.mode === 'menu' || BT.mode === 'endmenu') drawMenu();
  if (BT.mode === 'confirm') drawConfirm();
  if (BT.mode === 'target') drawForecast();
  if (BT.mode === 'catchTarget') drawCatchCard();
  if (BT.mode === 'idle' && B.lesson && !B.lesson.complete) drawCatchLesson(L);
  drawCoach(L);
  if (BT.mode === 'skillTarget') drawSkillCard();
  if (BT.mode === 'unitinfo' && BT.info) { dimScreen(.3); drawUnitSheet(BT.info); }
  if (BT.mode === 'help') drawHelp();
  if (BT.mode === 'territoryGuide') drawTerritoryGuide();
  if (BT.mode === 'handoff') drawHandoff();
  if (BT.mode === 'banner') drawBanner();
  if (BT.mode === 'anim' && BT.anim && BT.anim.kind === 'event') drawEventCard(BT.anim);
  if (BT.mode === 'anim' && BT.anim && BT.anim.kind === 'strike') drawDuelCard(BT.anim);
  if (BT.mode === 'anim' && BT.anim && BT.anim.kind === 'msg') { const w = Math.min(160, W - 12); hudPanel(W / 2 - w / 2, 30, w, 20); textC(BT.anim.text, W / 2, 36, UI.ink); }
  drawButtons(L);
  // the auto-save at the start of each turn is acknowledged with a short pill once the phase banner has passed
  if (!powerState(HT()) && BT.savedAt != null && BT.mode !== 'banner' && BT.mode !== 'end') { const k = BT.time - BT.savedAt; if (k > .6 && k < 2.8) { ctx.globalAlpha = k > 2.3 ? (2.8 - k) / .5 : Math.min(1, (k - .6) / .2); const s = 'Saved'; const w = textWidth(s) + 18; const x = Math.round(W / 2 - w / 2), y = L.top.y + (L.stack ? L.top.h + 4 : 2); rrect(x, y, w, 12, UI.inset, 2); rrect(x + 1, y + 1, w - 2, 10, UI.panelDark, 1); circle(x + 6, y + 6, 2, UI.green); text(s, x + 11, y + 3, UI.ink); ctx.globalAlpha = 1; } }
}
// TURN n · objective · READY x/y, with the two teams' head counts.
// One line of mode status for the turn card: hill points, or where each flag is (home, carried, dropped).
function versusStatusText() {
  if (!B.versus) return null; const me = HT();
  if (B.hill) return { text: TR('HILL {0}/{1} · {2}/{1}', B.hill.score[me], B.hill.need, B.hill.score[1 - me]), col: UI.gold };
  if (B.flags) { syncFlags(); const st = f => f.carrier != null ? 'carried' : f.x === f.home.x && f.y === f.home.y ? 'home' : 'dropped'; const mine = B.flags.find(f => f.team === me), theirs = B.flags.find(f => f.team !== me); return { text: TR('FLAGS {0} / {1}', TR(st(mine)), TR(st(theirs))), right: TR(st(mine)) + ' / ' + TR(st(theirs)), col: st(mine) === 'home' ? UI.gold : UI.red }; }
  if (B.fog) return { text: 'FOG OF WAR', col: UI.dim };
  return null;
}
// What the map asks for and how far along it is: {text, right, ratio, col} for the objective tracker.
function objectiveProgress() {
  const o = B.map.objective;
  if (B.lesson && !B.lesson.complete) { const t = B.units.find(u => u.id === B.lesson.targetId); return { text: 'Catch the Caterpie', right: t && practiceReady(t) ? 'ready!' : 'weaken it', ratio: t ? clamp(1 - t.hp / t.maxHp, 0, 1) * 2 : 1, col: UI.gold }; }
  if (B.versus) { const st = versusStatusText(); const m = o.mode || 'elim'; if (m === 'hill' && B.hill) return { text: 'Hold the hill', right: B.hill.score[HT()] + '/' + B.hill.need, ratio: B.hill.score[HT()] / B.hill.need, col: UI.gold }; if (m === 'ctf') return { text: 'Capture the flag', right: st ? st.right : '', ratio: 0, col: UI.gold }; const hq = B.war && B.war.props.find(p => p.kind === 'hq' && p.hq === 1 - HT()); if (hq && hq.captor != null && B.units.some(u => u.id === hq.captor && u.team === HT())) return { text: 'Take their HQ', right: hq.progress + '/20', ratio: hq.progress / 20, col: UI.gold }; return { text: 'Rout them or take HQ', right: TR('{0} left', alive(1 - HT()).length), ratio: 1 - alive(1 - HT()).length / Math.max(1, B.units.filter(u => u.team === 1 - HT()).length), col: UI.gold }; }
  // taking their base wins anywhere it exists: while one of ours is on it, that is the objective to watch
  if (B.war && !B.territory && o.type !== 'war') { const me = HT(), hq = B.war.props.find(p => p.kind === 'hq' && p.hq >= 0 && p.hq !== me && p.captor != null && B.units.some(u => u.id === p.captor && u.team === me)); if (hq) return { text: TR(hq.name.includes('CAMP') ? 'Take their camp' : 'Take their HQ'), right: hq.progress + '/20', ratio: hq.progress / 20, col: UI.gold }; }
  if (o.type === 'safari' && B.safari) { const [a, b] = B.safari.score; return { text: TR('Catch race · {0} balls', B.bag.pokeball || 0), right: a + ' - ' + b, ratio: a / Math.max(1, a + b), col: a >= b ? UI.gold : UI.red }; }
  if (o.type === 'boss') { const b = B.units.find(u => u.boss && u.team === 1); const name = o.bossName || (b ? b.name : TR('the boss')); return { text: TR('Defeat {0}', name), right: b && b.hp > 0 ? b.hp + '/' + b.maxHp : TR('down!'), ratio: b ? b.hp / b.maxHp : 0, col: UI.red, boss: true }; }
  if (o.type === 'survive') return { text: TR('Survive {0} turns', o.turns), right: Math.min(B.turn, o.turns) + '/' + o.turns, ratio: (B.turn - 1) / o.turns, col: UI.blue };
  if (o.type === 'seize') { const p = B.war && B.war.props.find(q => q.goal); return { text: TR('Seize the {0}', TR(o.what || 'gym')), right: p ? (p.owner === HT() ? TR('taken!') : (p.captor != null ? p.progress : 0) + '/20') : '', ratio: p ? (p.owner === HT() ? 1 : (p.captor != null ? p.progress : 0) / 20) : 0, col: UI.gold }; }
  const total = B.units.filter(u => u.team === 1).length, left = alive(1).length;
  if (o.type === 'war') { const hq = B.war && B.war.props.find(p => p.kind === 'hq' && p.hq === 1), cap = hq && hq.captor != null ? B.units.find(u => u.id === hq.captor) : null; if (cap && cap.team === 0) return { text: 'Take their HQ', right: hq.progress + '/20', ratio: hq.progress / 20, col: UI.gold }; return { text: 'Rout them or take HQ', right: TR('{0} left', left), ratio: 1 - left / Math.max(1, total), col: UI.gold }; }
  return { text: 'Defeat every foe', right: TR('{0} left', left), ratio: 1 - left / Math.max(1, total), col: UI.gold };
}
// The objective tracker (top-left): the turn and one pip per Pokémon that can still act in the header band; the goal
// with its progress under it; on taller cards a progress bar and each side's head count.
function drawTurnCard(r) {
  if (B.territory) { drawTerritoryTurn(r); return; }
  const mine = alive(HT()), ready = mine.filter(u => !u.acted).length; const lim = B.map.objective.type === 'survive' ? B.map.objective.turns : B.map.turnLimit;
  const tall = r.h >= 32; const head = (B.versus ? TR('P{0}', HT() + 1) + ' · ' : '') + TR('TURN {0}', B.turn + (lim ? '/' + lim : ''));
  const pipsW = mine.length * 6, pips = mine.length <= 8 && textWidth(head) + pipsW + 16 <= r.w;
  hudPanel(r.x, r.y, r.w, r.h, { header: head, headerRight: pips ? null : TR('READY {0}/{1}', ready, mine.length), headerRightCol: ready ? UI.green : UI.muted, headerFill: teamColorD(HT()) });
  if (pips) mine.forEach((u, i) => { const px0 = r.x + r.w - 7 - (mine.length - 1 - i) * 6, py0 = r.y + 8; circle(px0, py0, 2, UI.inset); if (!u.acted) { circle(px0, py0, 2, UI.green); px(px0 - 1, py0 - 1, '#d8ffe0'); } else circle(px0, py0, 1, shade(teamColorD(HT()), -.3)); });
  // the war chest, beside the turn: the figure rolls to its new value, and each day's income rises out of it
  if (B.war && B.war.props.length && HT() <= 1) { const f = B.war.funds[HT()]; if (BT.fundsShow == null || BT.fundsTeam !== HT() || REDUCED) { BT.fundsShow = f; BT.fundsTeam = HT(); } const inc = BT.income, waiting = inc && inc.team === HT() && BT.time < inc.t; if (!waiting) BT.fundsShow += (f - BT.fundsShow) * Math.min(1, CLOCK.dt * 7); if (Math.abs(f - BT.fundsShow) < 10) BT.fundsShow = f;
    const fx = r.x + 10 + textWidth(head), roll = BT.fundsShow !== f; circle(fx + 3, r.y + 8, 3, UI.inset); circle(fx + 3, r.y + 8, 2, roll ? '#fff4b0' : UI.gold); px(fx + 2, r.y + 7, '#fffbe0'); text(money(Math.round(BT.fundsShow / 10) * 10), fx + 8, r.y + 5, roll ? '#fff4b0' : UI.gold, { shadow: shade(teamColorD(HT()), -.55) });
    if (inc && inc.team === HT() && !waiting && BT.time - inc.t < 1.4 && inc.amount > 0) { const k = (BT.time - inc.t) / 1.4; if (!inc.rung) { inc.rung = true; Audio.sfx('coin'); } ctx.globalAlpha = clamp((1 - k) * 2, 0, 1); text('+' + money(inc.amount), fx + 12 + textWidth(money(f)), r.y + 8 - Math.round(easeOut(Math.min(1, k * 1.6)) * 3), UI.green, { outline: UI.inset }); ctx.globalAlpha = 1; } }
  const P = objectiveProgress(), y1 = r.y + 17; iconAt('flag', r.x + 5, y1 - 1, P.col);
  const rw = textWidth(P.right); let s = String(TRX(P.text)); while (rawTextWidth(s) > r.w - 22 - rw - 6 && s.length > 4) s = s.slice(0, -1); text(s, r.x + 16, y1, UI.ink, { raw: true }); // trimmed in the player's language textR(P.right, r.x + r.w - 6, y1, P.col);
  if (tall) {
    const counts = [[0, alive(0).length], [1, alive(1).length]]; if (alive(2).length) counts.push([2, alive(2).length]); if (alive(3).length) counts.push([3, alive(3).length]);
    let cx = r.x + r.w - 6; const cy = r.y + 26; counts.reverse().forEach(([team, n]) => { cx -= textWidth(String(n)); text(String(n), cx, cy, UI.ink); cx -= 8; circle(cx + 2, cy + 3, 3, UI.inset); circle(cx + 2, cy + 3, 2, teamColor(team)); cx -= 6; });
    const bw = cx - r.x - 10; if (bw > 20) { const k = clamp(P.ratio, 0, 1); bar(r.x + 6, cy + 1, bw, 5, k, P.col, UI.hpBack); if (!REDUCED && k > 0 && k < 1) { const gx = r.x + 7 + Math.round((bw - 2) * k) - 1; ctx.globalAlpha = .5 + .5 * Math.sin(BT.time * 6); px(gx, cy + 2, '#ffffff'); ctx.globalAlpha = 1; } }
  }
}
function drawButtons(L) {
  const W = VIEW.w, bh = L.bh, m = BT.mode;
  const idle = m === 'idle', acting = m === 'move' || m === 'target' || m === 'catchTarget' || m === 'skillTarget' || m === 'menu', enemyAnim = m === 'anim' && !isHuman(B.phase);
  if (enemyAnim) textC(phaseLabel(B.phase) + (BT.fast ? ' · ' + TR('FAST') : ''), W / 2, L.top.y + L.top.h + 4, UI.red, { outline: UI.shadow });
  const items = [];
  if (idle) items.push({ label: 'END TURN', variant: 'danger', run: () => { Audio.sfx('ok'); confirmEndTurn(); } }, { label: 'DANGER', on: BT.showDanger, run: () => { BT.showDanger = !BT.showDanger; Audio.sfx('menu'); } });
  if (acting) items.push({ label: m === 'move' && BT.dart ? 'STAY' : 'BACK', variant: 'ghost', run: () => cancel() });
  if (enemyAnim) items.push({ label: 'FAST', on: BT.fast, run: () => { BT.fast = !BT.fast; } });
  if (idle && VIEW.touch && alive(HT()).some(u => !u.acted)) { const nx = { label: 'NEXT', run: () => keyInput('next') }; if (L.stack) items.splice(1, 0, nx); else items.push(nx); }
  if (idle || acting) { if (canZoom()) items.push({ label: BT.zoom === 1 ? 'ZOOM -' : 'ZOOM +', run: () => { toggleZoom(); Audio.sfx('menu'); } }); }
  if (idle && warHasBox(HT())) items.push({ label: BT.boxNew ? 'PC!' : 'PC', run: () => openDeployMenu() });
  // phones have no X key or right click: MENU opens the day menu (help, sound, the battle scene, retreat live there)
  if (idle && L.stack) items.push({ label: 'MENU', run: () => { openEndMenu(); Audio.sfx('menu'); } });
  else if (idle) items.push({ label: 'HELP', half: true, run: () => { BT.mode = 'help'; BT.helpPage = 0; BT.helpOffset = 0; Audio.sfx('menu'); } }, { label: '♪', on: !Audio.muted, half: true, run: () => { Audio.toggle(); Audio.sfx('menu'); } });
  if (!items.length) return;
  if (L.stack) { // two rows across the bottom: row 1 = the two main actions, row 2 = the rest
    // equal widths when every label fits; otherwise each button takes its label's width and they share what is left
    const b = L.bar; const row1 = items.slice(0, 2), row2 = items.slice(2); const lay = (row, y) => { if (!row.length) return; const gap = 4, avail = b.w - gap * (row.length - 1), eq = Math.floor(avail / row.length), nat = row.map(it => textWidth(it.label) + (it.on != null ? 9 : 0) + 8), sum = nat.reduce((a, c) => a + c, 0), fit = nat.every(n => n <= eq), extra = Math.max(0, avail - sum) / row.length;
      let x = b.x; row.forEach((it, i) => { const w = i === row.length - 1 ? b.x + b.w - x : fit || sum > avail ? eq : Math.floor(nat[i] + extra); button(x, y, w, bh, it.label, it.run, { col: it.col, variant: it.variant, on: it.on }); x += w + gap; }); };
    lay(row1, b.y); lay(row2, b.y + bh + 4);
  } else {
    const bx = L.buttons.x, bw = L.buttons.w; let y = 4; for (let i = 0; i < items.length; i++) { const it = items[i]; if (it.half && items[i + 1] && items[i + 1].half) { button(bx, y, bw / 2 - 1, bh, it.label, it.run, { col: it.col, variant: it.variant, on: it.on }); button(bx + bw / 2 + 1, y, bw / 2 - 1, bh, items[i + 1].label, items[i + 1].run, { col: items[i + 1].col, variant: items[i + 1].variant, on: items[i + 1].on }); i++; } else button(bx, y, bw, bh, it.label, it.run, { col: it.col, variant: it.variant, on: it.on }); y += bh + 2; }
    if (BT.showDanger && (idle || m === 'move')) drawDangerLegend(bx, y + 2);
  }
  if (L.stack && BT.showDanger && (idle || m === 'move')) drawDangerLegend(4, L.top.y + L.top.h + 2);
}
// First-battle coach marks: during the opening turns of the first lesson a bouncing arrow points at the next Pokémon to
// move and a bubble says what to do; in move mode the bubble explains the tiles. Nothing here changes the rules.
// A hint bubble; too wide for the screen (a long Spanish line on a phone), it wraps onto more lines instead.
function coachBubble(s, x, y) { const ls = textWidth(s) + 10 <= VIEW.w - 8 ? [TRX(s)] : wrap(s, VIEW.w - 18), w = Math.max(...ls.map(l => rawTextWidth(l))) + 10, h = ls.length * 9 + 3, bx = clamp(Math.round(x - w / 2), 4, VIEW.w - w - 4), by = clamp(Math.round(y), 4, VIEW.h - h - 4);
  rrect(bx + 1, by + 2, w, h, UI.shadow, 2); rrect(bx, by, w, h, UI.gold, 2); rrect(bx + 1, by + 1, w - 2, h - 2, '#fff6d0', 1); ls.forEach((l, i) => text(l, bx + 5, by + 3 + i * 9, '#3a2400', { raw: true })); }
function drawCoach(L) {
  // chapters 2 and 4 teach the power: the first time the bar can buy one, a bubble points at the meter until it is used
  const ps = B && !B.versus && !B.territory && powerState(HT()); if (ps && (B.chapter === 1 || B.chapter === 3) && BT.mode === 'idle' && isHuman(B.phase) && !ps.active && !ps.uses && ps.unlocked && ps.charge >= (B.chapter === 3 && ps.superUnlocked ? 100 : 50) && powerCaptain(HT())) {
    const r = L.top, y = r.y + r.h + powerRibbonHeight() + 2, msg = TR(B.chapter === 3 ? 'Super ready! {0}' : 'Power ready! {0}', TR(VIEW.touch ? 'Tap the meter' : 'Press P')); if (L.stack) coachBubble(msg, r.x + r.w / 2, y); else coachBubble(msg, r.x + r.w + 8 + (textWidth(msg) + 10) / 2, r.y + r.h + 8);
    if (!L.stack) stampAt(r.x + r.w + 2, r.y + r.h + 10, ['...O', '..OY', '.OYY', 'OYYY', '.OYY', '..OY', '...O'], { O: UI.inset, Y: UI.gold }); }
  if (!B || !B.lesson || B.turn > 2 || !isHuman(B.phase) || B.result) return;
  const bob = REDUCED ? 0 : Math.round(Math.abs(Math.sin(BT.time * 5)) * 3);
  if (BT.mode === 'idle') {
    const u = alive(HT()).filter(v => !v.acted).sort((a, b) => (b.leader ? 1 : 0) - (a.leader ? 1 : 0))[0]; if (!u) return;
    const sx = toScreenX(tileX(u.x) + TILE / 2), sy = toScreenY(tileY(u.y)) - 6 - bob; stampAt(sx - 3, sy - 6, ['OOOOOOO', 'OYYYYYO', '.OYYYO.', '..OYO..', '...O...'], { O: UI.inset, Y: UI.gold });
    coachBubble(TR(VIEW.touch ? 'Tap {0} to move it' : 'Select {0} (Z)', u.name), sx, sy - 22);
  } else if (BT.mode === 'move' && BT.sel && !BT.dart) { const sx = toScreenX(tileX(BT.sel.x) + TILE / 2), sy = toScreenY(tileY(BT.sel.y) + TILE) + 6; coachBubble('Blue: where it can go · red: what it can hit', sx, sy); }
  else if (BT.mode === 'target' && B.turn === 1 && !L.stack) { const r = forecastRect(); coachBubble(TR(VIEW.touch ? 'Tap the target again to attack' : 'Z to attack'), r.x + r.w / 2, r.y + r.h + 18); }
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
// Unit card body under a header band the caller draws (name / level in the team colour). Portrait at the left (the board
// sprite when the species has one), then HP, the role with its glyph and the move range, and the types spelled out.
// `compact` (phone strip) keeps two rows: HP, then role · move · types.
function unitCardBody(u, x, y, w, compact) {
  const y0 = y + 16, pw = compact ? 26 : 30, ph = compact ? 24 : 30; ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y0 - 1, pw, ph); ctx.clip(); portraitBg(x + 3, y0 - 1, pw, ph, u.team);
  drawMon(u.num, x + 3 + pw / 2, y0 + ph - 1, { flip: u.team !== 0 }); ctx.restore();
  const x1 = x + pw + 8, cw = x + w - 5 - x1; const hpTxt = u.hp + '/' + u.maxHp; const hw = textWidth(hpTxt);
  hpBar(x1, y0 + 1, cw - hw - 4, u.hp, u.maxHp); textR(hpTxt, x + w - 5, y0, UI.ink);
  if (u.team === HT() && isHuman(u.team) && !B.territory && u.xp != null) { rect(x1, y0 + 6, cw - hw - 4, 1, UI.inset); rect(x1, y0 + 6, Math.round((cw - hw - 4) * clamp(u.xp / 100, 0, 1)), 1, '#6ad0ff'); } // XP to the next level
  const R = ROLES[u.role]; const my = compact ? y0 + 10 : y0 + 11; iconAt(R.icon, x1, my - 1, R.col); text(R.name, x1 + 11, my, R.col);
  const mov = TR('MOVE {0}', effMov(u)); if (!compact) textR(mov, x + w - 5, my, UI.ink); else text('· ' + mov, x1 + 11 + textWidth(R.name) + 3, my, UI.ink);
  const ty = compact ? y0 + 10 : y0 + 21; let bx = compact ? x1 + 11 + textWidth(R.name) + 3 + textWidth('· ' + mov) + 5 : x1;
  const tags = []; if (u.status) tags.push([STATUS[u.status].text, STATUS[u.status].col]); if (u.brace) tags.push(['braced', BRACE_COL]); if (u.root) tags.push(['rooted', ROOT_COL]); if (u.recharge) tags.push(['recharging', RECHARGE_COL]); if (u.boss) tags.push(['BOSS', UI.red]);
  const mine = u.team === HT() && isHuman(B.phase); const tag = tags.length ? tags[0] : mine ? [u.acted ? 'done' : 'ready', u.acted ? UI.muted : UI.green] : null; const tagW = tag ? textWidth(tag[0]) + (tags.length ? 4 : 12) : 0;
  if (!compact) { const full = u.types.reduce((a, t) => a + textWidth(t.toUpperCase()) + 9, 0) <= x + w - 5 - tagW - bx; for (const t of u.types) bx += typeBadge(t, bx, ty, full ? 'auto' : 24) + 3; } else { for (const t of u.types) { if (bx + 24 > x + w - 4) break; bx += typeBadge(t, bx, ty, 24) + 2; } }
  if (!compact && tag) { if (tags.length) textR(tag[0], x + w - 5, ty, tag[1]); else { circle(x + w - 8, ty + 4, 2, tag[1]); textR(tag[0], x + w - 12, ty, tag[1]); } }
}
// Terrain card body: swatch, name, defence stars, move cost (or heal / no entry) and evasion when the tile has any.
// A narrow card keeps a long name's last word ("Cave Floor" → "Floor").
function terrainCardBody(t, ref, x, y, w, tall) {
  const mv = inMap(BT.cx, BT.cy) ? B.map.variants[BT.cy][BT.cx] : 0; const sw = tall ? 10 : 20;
  rect(x + 4, y + 3, sw, sw, UI.shadow); ctx.drawImage(tileImg(t.ch, mv, 0), 0, 0, 32, 32, x + 5, y + 4, sw - 2, sw - 2); outline(x + 4, y + 3, sw, sw, UI.border2);
  const property = warProperty(BT.cx, BT.cy);
  const healText = property && property.owner !== (ref.team == null ? HT() : ref.team) ? ['no heal here', UI.muted] : ['heals 30%', UI.green];
  const cost = moveCost(t, ref); const extra = t.heal ? healText : t.burn ? ['burns', UI.red] : cost >= 99 ? ['no entry', UI.muted] : null;
  const stars = defStars(terrainDef(t, ref)), eva = terrainEva(t, ref);
  const def = stars === '-' ? [TR('no cover'), UI.muted] : [TR('DEF {0}', stars), UI.gold];
  if (tall) { let name = TRX(t.name); if (textWidth(name) > w - 18) name = LANG === 'es' ? name.split(' ')[0] : name.split(' ').pop(); name = fitLabel(name, w - 18); text(name, x + 17, y + 4, UI.gold); text(def[0], x + 4, y + 12, def[1]); text(extra ? extra[0] : TR('MOVE {0}', cost) + (eva ? ' · ' + TR('EVA {0}', eva) : ''), x + 4, y + 20, extra ? extra[1] : UI.ink); } // 8-px lines: the third clears the card's border
  else { text(t.name, x + 27, y + 4, UI.gold); text(def[0], x + 27, y + 13, def[1]); if (eva) text(TR('EVADE +{0}', eva), x + 27 + textWidth(def[0]) + 6, y + 13, UI.info); text(extra ? extra[0] : TR('MOVE {0}', cost), x + 27, y + 22, extra ? extra[1] : UI.ink); }
}
// The forecast sits on the side away from the cursor on wide screens and spans the bottom on portrait phones.
function forecastRect() {
  const W = VIEW.w, H = VIEW.h, L = hudLayout(); const h = 124;
  if (L.stack) return { x: 4, y: L.bar.y - h - 4, w: W - 8, h, stack: true };
  const w = Math.min(220, W - 12); const left = toScreenX(tileX(BT.cx) - FX.shakeX) + TILE * BT.zoom / 2 > W / 2; const bb = 4 + (canZoom() ? 2 : 1) * (btnH() + 2); // under the BACK / ZOOM buttons on the right
  return { x: left ? 6 : W - w - 6, y: Math.min(Math.max(L.top.y + L.top.h + 14, left ? 0 : bb + 4), Math.max(4, H - h - 24)), w, h, stack: false };
}
// Hit areas: the head (portraits and HP) confirms, the three answer lines toggle the detailed table, the strip at
// the bottom switches moves.
function forecastHit(x, y) { const r = forecastRect(); return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + 58; }
function detailHit(x, y) { const r = forecastRect(); return x >= r.x && y >= r.y + 58 && x < r.x + r.w && y < r.y + r.h - 16; }
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
  if (!fc.c) return { text: TR(fc.noCounter === 'frozen' ? 'frozen · no counter' : fc.noCounter === 'recharging' ? 'recharging · no counter' : 'no counter'), col: UI.green };
  if (!hits('c')) return { text: TR('KO first · counters on miss'), col: UI.gold };
  let t = TR(fc.c.eff > 1 ? 'counters hard' : 'counters'); if (fc.koA) t += ' · ' + TR('KOs you!'); else if (hits('a') > 1) t += ' · ' + TR('you hit ×2'); else if (hits('c') > 1) t += ' ×2';
  return { text: t, col: fc.koA ? UI.red : fc.c.eff > 1 ? '#ffa0a0' : UI.muted };
}
// One text line per strike of the ordered exchange, for the forecast: who strikes, with what, the damage and the
// odds, whether it would KO, and the condition when it only happens if an earlier strike misses. Pure.
function forecastLines(fc, att, def) {
  let hpA = att.hp, hpD = def.hp; const out = [];
  for (const s of fc.strikes) {
    const mine = s.side === 'a'; let ko = false;
    if (s.nominal) { if (mine) { hpD = Math.max(0, hpD - s.dmg); hpA += s.drain; ko = hpD <= 0; } else { hpA = Math.max(0, hpA - s.dmg); hpD += s.drain; ko = hpA <= 0; } }
    const eff = s.eff === 0 ? TR('no effect') : s.eff >= 2 ? fmtMult(2.25) : s.eff > 1 ? fmtMult(1.5) : s.eff < 1 ? fmtMult(s.eff) : '';
    // critKo: the normal hit leaves the target standing but a critical (crit% odds) would not; never hidden behind the nominal numbers
    out.push({ side: s.side, nominal: s.nominal, ko, name: mvName(s.move).toUpperCase(), dmg: s.dmg, hit: s.hit, crit: s.crit, critDmg: s.critDmg, critKo: !!s.critKo && !ko, braced: !!s.braced, eff, cond: s.cond, condWho: s.condWho, drain: s.drain, counter: !mine });
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
  const who = l.condWho != null ? l.condWho : l.cond ? l.cond.replace(/^only if (.*) survives$/, '$1') : null, CRIT = TR('crit');
  let name = l.name, critWord = CRIT + ' ', cond = l.cond ? TR('only if {0} survives', who) : null; const opt = [l.braced ? TR('braced') : null, l.eff || null, l.drain ? '+' + l.drain : null].filter(Boolean);
  const build = () => { const head = arrow + name + dmg; const crit = critWord + l.crit + '%' + (l.critKo ? ' KO' : ''); const parts = [l.hit + '%', crit].concat(opt); if (cond) parts.push(cond); const text = head + '  ' + parts.join(' · '); const pre = head + '  ' + l.hit + '% · ' + critWord + l.crit + '% '; return { text, head, critKoAt: l.critKo ? textWidth(pre) + 1 : null }; };
  let f = build(); const fits = () => textWidth(f.text) <= avail;
  while (!fits() && opt.length) { opt.pop(); f = build(); }
  if (!fits() && cond) { cond = TR('if {0} alive', who); f = build(); }
  while (!fits() && name.length > 6) { name = name.slice(0, -1); f = build(); }
  if (!fits() && cond) { cond = TR('if alive'); f = build(); }
  if (!fits()) { critWord = CRIT[0]; f = build(); }
  while (!fits() && name.length > 3) { name = name.slice(0, -1); f = build(); }
  return f;
}
// The three questions a player asks before attacking, one line each. Pure.
//   1. how much do I take off (per strike, the odds, twice when a follow-up is nominal; KO when the nominal exchange drops the target)
//   2. can it answer, and how hard (the counter's move, damage and odds; conditional when it only happens if the first strike fails)
//   3. what could go wrong (a critical that would KO either side, the counter dropping me, secondary effects, recharge)
function forecastSummary(fc, att, def, move) {
  const nominal = side => fc.strikes.filter(x => x.side === side && x.nominal); const a = fc.a, c = fc.c;
  const hits = nominal('a'), damage = hits.length > 1 && hits.some(s => s.dmg !== a.dmg) ? hits.map(s => s.dmg).join('+') : a.dmg + (hits.length > 1 ? ' ×2' : '');
  const deal = { side: 'a', text: '▸ ' + mvName(move).toUpperCase() + ' ' + damage + ' · ' + TR('{0}% hit', a.hit) + (a.eff === 0 ? ' · ' + TR('no effect') : a.eff >= 2 ? ' · ' + fmtMult(2.25) : a.eff > 1 ? ' · ' + fmtMult(1.5) : a.eff < 1 ? ' · ' + fmtMult(a.eff) : ''), col: a.eff === 0 ? UI.muted : '#8ab4ff', ko: fc.koD };
  let answer;
  if (!c) answer = { side: 'c', text: '◂ ' + TR(fc.noCounter === 'frozen' ? 'Frozen: no counter' : fc.noCounter === 'recharging' ? 'Recharging: no counter' : 'Out of reach: no counter'), col: UI.green, ko: false };
  else if (!nominal('c').length) answer = { side: 'c', text: '◂ ' + mvName(c.move).toUpperCase() + ' ' + c.dmg + ' · ' + TR('only if it survives'), col: UI.muted, ko: false };
  else answer = { side: 'c', text: '◂ ' + mvName(c.move).toUpperCase() + ' ' + c.dmg + (nominal('c').length > 1 ? ' ×2' : '') + ' · ' + TR('{0}% hit', c.hit), col: fc.koA ? UI.red : c.eff > 1 ? '#ffa0a0' : '#ff9a9a', ko: fc.koA };
  const risk = isPracticeTarget(def) ? [TR('practice: cannot faint')] : []; let danger = false;
  const critA = fc.strikes.find(x => x.side === 'a' && x.critKo), critC = fc.strikes.find(x => x.side === 'c' && x.critKo);
  if (critC) { risk.push(TR('foe crit {0}% KOs you', c.crit)); danger = true; } else if (c) risk.push(TR('foe crit {0}%', c.crit));
  if (critA) risk.push(TR('your crit {0}% KOs', a.crit)); else risk.push(TR('crit {0}%', a.crit));
  if (a.eff !== 0) for (const e of moveEffects(move, def)) risk.push(e === 'must recharge' ? TR('you must recharge') : effText(e));
  if (c && c.eff !== 0) for (const e of moveEffects(c.move, att)) if (e !== 'high crit') risk.push(TR('foe {0}', effText(e)));
  return [deal, answer, { side: 'r', text: TR('Risk: {0}', risk.join(' · ')), risks: risk, col: danger ? UI.red : UI.muted, ko: false }];
}
function drawForecast() {
  const cf = currentForecast(); if (!cf) return; const { fc, move, moves, target } = cf; const r = forecastRect(); const u = BT.sel; const a = fc.a, c = fc.c;
  hudPanel(r.x, r.y, r.w, r.h, { title: BT.forecastDetail ? 'DETAILS · NORMAL HITS' : 'FORECAST · NORMAL HITS' }); const half = Math.floor(r.w / 2); // HP after assumes hits land and none is critical
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
  const ly = r.y + 58; const koTag = (kx, y, colr) => { rect(kx - 1, y - 1, textWidth('KO') + 2, 9, colr); text('KO', kx, y, '#ffffff'); };
  if (BT.forecastDetail) drawForecastTable(r, fc, u, target, ly, koTag);
  else { // the three answers; a KO tag rides the line whose nominal exchange drops someone
    hline(r.x + 5, ly - 3, r.w - 10, UI.inset);
    // the risks wrap between their items (up to three lines above the move strip) instead of being cut mid-word
    let y = ly; for (const l of forecastSummary(fc, u, target, move)) {
      if (l.risks) { for (const s of packItems(l.risks, TR('Risk: '), r.w - 12, Math.max(1, Math.floor((r.y + r.h - 18 - y) / 9)))) { text(s, r.x + 6, y, l.col); y += 9; } continue; }
      const tagW = l.ko ? textWidth('KO') + 5 : 0, t = fitLabel(l.text, r.w - 12 - tagW); text(t, r.x + 6, y, l.col); if (l.ko) koTag(r.x + 6 + textWidth(t) + 4, y, l.side === 'a' ? '#2a6a3a' : '#8a2c2c'); y += 9; }
  }
  // move selector: a strip along the bottom, tappable; arrows and the C key switch moves
  const sy = r.y + r.h - 16; rrect(r.x + 3, sy, r.w - 6, 13, UI.panelDark, 1); outline(r.x + 3, sy, r.w - 6, 13, moves.length > 1 ? UI.gold : UI.border2);
  let mx = r.x + 6; if (moves.length > 1) { text('◂', mx, sy + 3, UI.gold); mx += 8; } typeBadge(move.type, mx, sy + 2, 24); mx += 27;
  const idx = (moves.indexOf(move) + 1) + '/' + moves.length; const tail = moves.length > 1 ? idx + ' ▸' : ''; const tw = textWidth(tail);
  const rng = move.rng[0] + (move.rng[1] > move.rng[0] ? '-' + move.rng[1] : ''), room = r.x + r.w - 8 - tw - mx; // the longest wording that fits
  const mn = mvName(move), ms = [mn + '  ' + TR('{0} power · range {1}', move.pow, rng), mn + '  ' + TR('{0} pow · rng {1}', move.pow, rng), mn + ' ' + move.pow + ' · ' + rng, mn + ' ' + move.pow].find(t => textWidth(t) <= room) || fitLabel(mn, room);
  text(ms, mx, sy + 3, UI.ink); if (tail) textR(tail, r.x + r.w - 6, sy + 3, UI.gold);
  // the hint drops its optional items until it fits the card's width
  const hints = VIEW.touch ? [['tap target: attack', 'X: back'], [moves.length > 1 ? 'tap bar: move' : null], ['tap lines: details']] : [[['Z', 'attack'], ['X', 'back']], [moves.length > 1 ? ['C', 'move'] : null], [['V', BT.forecastDetail ? 'summary' : 'details']]];
  let items = hints.flat().filter(Boolean); while (items.length > 2 && hintWidth(items) > r.w) items = items.slice(0, -1);
  hintLine(items, r.x + r.w / 2, r.y + r.h + 5);
}
// The detailed exchange: one row per strike in resolver order with damage, hit and crit odds (a table on wide cards,
// fitted lines on narrow ones), then the summary line and the moves' side effects.
function drawForecastTable(r, fc, u, target, ly, koTag) {
  const lines = forecastLines(fc, u, target); const table = r.w >= 200; const a = fc.a, c = fc.c, move = a.move;
  if (table) { // aligned columns: the strike (with its conditions), then DMG · HIT · CRIT right-aligned
    const cx = [r.x + r.w - 6 - 66, r.x + r.w - 6 - 36, r.x + r.w - 6]; text('STRIKE', r.x + 6, ly, UI.dim); textR('DMG', cx[0], ly, UI.dim); textR('HIT', cx[1], ly, UI.dim); textR('CRIT', cx[2], ly, UI.dim); hline(r.x + 5, ly + 8, r.w - 10, UI.inset); hline(r.x + 5, ly + 9, r.w - 10, shade(UI.panel, .15));
    lines.slice(0, 3).forEach((l, i) => {
      const y = ly + 12 + i * 9; const col = !l.nominal ? UI.muted : l.side === 'a' ? '#8ab4ff' : '#ff9a9a'; const tagCol = l.side === 'a' ? '#2a6a3a' : '#8a2c2c';
      // the condition is essential and never dropped (it compacts to "if alive"); braced / effectiveness / drain go first, then the name shortens
      const who = l.condWho != null ? l.condWho : l.cond ? l.cond.replace(/^only if (.*) survives$/, '$1') : null, nameW = cx[0] - 34 - (r.x + 6); let cond = l.cond ? TR('if {0} alive', who) : null; const opt = [l.eff || null, l.braced ? TR('braced') : null, l.drain ? '+' + l.drain : null].filter(Boolean); let name = l.name;
      const build = () => { const ex = (cond ? [cond] : []).concat(opt); return (l.side === 'a' ? '▸ ' : '◂ ') + name + (ex.length ? '  ' + ex.join(' · ') : ''); }; let s = build();
      while (textWidth(s) > nameW && opt.length) { opt.pop(); s = build(); } if (textWidth(s) > nameW && cond) { cond = TR('if alive'); s = build(); } while (textWidth(s) > nameW && name.length > 3) { name = name.slice(0, -1); s = build(); }
      text(s, r.x + 6, y, col);
      textR(String(l.dmg), cx[0] - (l.ko ? 15 : 0), y, col); if (l.ko) koTag(cx[0] - 11, y, tagCol);
      textR(l.hit + '%', cx[1], y, col); textR(l.crit + '%', cx[2] - (l.critKo ? 15 : 0), y, col); if (l.critKo) koTag(cx[2] - 11, y, tagCol);
    });
  } else lines.slice(0, 3).forEach((l, i) => {
    const y = ly + i * 9; const col = !l.nominal ? UI.muted : l.side === 'a' ? '#8ab4ff' : '#ff9a9a'; const f = fitForecastLine(l, r.w - 12);
    text(f.text, r.x + 6, y, col);
    if (l.ko) koTag(r.x + 6 + textWidth(f.head) - textWidth('KO'), y, l.side === 'a' ? '#2a6a3a' : '#8a2c2c');
    if (f.critKoAt != null) koTag(r.x + 6 + f.critKoAt, y, l.side === 'a' ? '#2a6a3a' : '#8a2c2c');
  });
  // summary of the exchange, then the moves' side effects (never counted in the numbers above)
  const sum = exchangeSummary(fc); const ea = a.eff === 0 ? [] : moveEffects(move, target), ec = c && c.eff !== 0 ? moveEffects(c.move, u) : [];
  const fxText = (ea.length ? '▸ ' + ea.map(effText).join(' · ') : '') + (ea.length && ec.length ? '  ' : '') + (ec.length ? '◂ ' + ec.map(effText).join(' · ') : '');
  const foot = fitLabel(sum.text + (fxText ? '  ·  ' + fxText : ''), r.w - 12);
  text(foot, r.x + 6, r.y + r.h - 27, fxText && ea.some(t => t === 'must recharge') ? RECHARGE_COL : sum.col);
}
// The skill card: what the chosen skill does to the highlighted target, with the exact numbers, and how to confirm or back out.
function drawSkillCard() {
  const u = BT.sel, sk = u && u.skill, t = BT.targets[BT.tIdx]; if (!sk || !t) return; const r = skillCardRect(); hudPanel(r.x, r.y, r.w, r.h, { title: sk.name.toUpperCase() });
  ctx.save(); ctx.beginPath(); ctx.rect(r.x + 6, r.y + 8, 34, 28); ctx.clip(); portraitBg(r.x + 6, r.y + 8, 34, 28, t.team); drawMon(t.num, r.x + 23, r.y + 35, { flip: t.team !== HT() }); ctx.restore(); teamGlyph(r.x + 8, r.y + 10, t.team, teamColorL(t.team));
  text(fitLabel((t === u ? TR('itself') : t.name) + '  Lv' + t.level, r.w - 52), r.x + 46, r.y + 8, UI.ink);
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
  const cost = sk ? wrap(TR('uses the action') + (sk.xp && !B.territory ? ' · ' + TR('+{0} XP', sk.xp) : '') + (sk.cd ? ' · ' + cooldownText(sk) : ''), r.w - 12) : [];
  return { x: r.x, y: r.y, w: r.w, h: 40 + cost.length * 9 + 4, effect, cost };
}
function drawCatchCard() {
  const t = BT.targets[BT.tIdx]; if (!t) return; const r = forecastRect(); const practice = isPracticeTarget(t); const team = HT();
  hudPanel(r.x, r.y, r.w, 54, { title: practice ? 'PRACTICE CATCH' : 'CATCH' });
  ctx.save(); ctx.beginPath(); ctx.rect(r.x + 6, r.y + 8, 34, 30); ctx.clip(); portraitBg(r.x + 6, r.y + 8, 34, 30, t.team); drawMon(t.num, r.x + 23, r.y + 37, { flip: true }); ctx.restore();
  text(t.name + '  Lv' + t.level, r.x + 46, r.y + 8, UI.ink); hpBar(r.x + 46, r.y + 17, r.w - 54, t.hp, t.maxHp);
  // the chance: a ten-segment gauge that fills to it, green when likely, gold when even, red when long
  const p = captureChance(t, practice ? ITEMS.practiceball : ITEMS.pokeball), pc = Math.round(p * 100), col = practice ? (practiceReady(t) ? UI.green : UI.red) : p > .6 ? UI.green : p > .35 ? UI.gold : UI.red;
  const gx = r.x + 46, gy = r.y + 26, gw = r.w - 54 - 26; for (let i = 0; i < 10; i++) { const sx = gx + Math.round(i * gw / 10), sw = Math.round((i + 1) * gw / 10) - Math.round(i * gw / 10) - 1, on = practice ? practiceReady(t) : (i + 1) / 10 <= p + .05; rect(sx, gy, sw, 5, UI.inset); if (on) { rect(sx, gy, sw, 5, col); hline(sx, gy, sw, shade(col, .35)); } }
  textR(practice ? (practiceReady(t) ? '100%' : '0%') : pc + '%', r.x + r.w - 7, gy - 1, col, { outline: '#000' });
  // what the throw costs and what it earns
  const cost = practice ? TR('Oak\'s free ball') : B.bag.pokeball > 0 ? TR('Poké Ball · {0} left', B.bag.pokeball) : TR('buys a ball · {0}', money(WAR.ball)); drawBall(gx + 3, r.y + 38, practice ? ITEMS.practiceball.col : ITEMS.pokeball.col, 3); text(fitLabel(cost, r.w - 62), gx + 9, r.y + 35, UI.muted);
  text(fitLabel(practice ? (practiceReady(t) ? 'Ready: a sure catch' : 'Weaken it to half HP first') : (t.status ? TR('status helps') + ' · ' : '') + TR(B.war ? 'to your PC Box, 1st deploy free' : 'weaker is easier'), r.w - 54), gx, r.y + 44, practice || !B.war ? UI.dim : UI.info);
  hintLine(VIEW.touch ? ['tap: throw', 'X: back'] : [['Z', 'throw'], ['X', 'back']], r.x + r.w / 2, r.y + 59);
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
  if (e.type === 'power') { drawPowerBurst(q); return; }
  if (e.type === 'bossAlert') { drawBossAlert(q); return; }
  if (e.type === 'aceDown') { drawAceDown(q); return; }
  if (e.type === 'property') { drawCaptureCard(q); return; }
  if (e.type === 'xp') { const u = e.unit; const w = 120, x = W / 2 - w / 2, y = H - 40; panel(x, y, w, 24); const k = Math.min(1, q.t / q.dur); const shown = Math.min(100, q.from + e.amount * k); text(u.name, x + 6, y + 4, UI.ink); textR(TR('+{0} EXP', e.amount), x + w - 6, y + 4, UI.gold); bar(x + 6, y + 14, w - 12, 6, (shown % 100) / 100, '#6ad0ff'); }
  if (e.type === 'levelup') {
    const u = e.unit; const w = Math.min(190, W - 12), h = 74, x = W / 2 - w / 2; const uy = toScreenY(tileY(u.y)), ts = TILE * BT.zoom; const y = uy < H / 2 ? Math.min(H - h - 8, uy + ts + 10) : Math.max(28, uy - h - 12); const k = Math.min(1, q.t / .25); const yy = Math.round(y + (1 - easeOut(k)) * -20);
    const p = panel(x, yy, w, h, { header: 'LEVEL UP!', headerRight: TR('Lv {0} ▸ {1}', e.level - 1, e.level), headerRightCol: UI.gold });
    ctx.save(); ctx.beginPath(); ctx.rect(x + 6, p.cy, 34, 30); ctx.clip(); portraitBg(x + 6, p.cy, 34, 30, u.team); drawMon(u.fx.showNum || u.num, x + 23, p.cy + 29 + Math.round(Math.sin(q.t * 10) * (q.t < .6 ? 2 : 0)), {}); ctx.restore();
    text(u.fx.showNum && DEX[u.fx.showNum] && !u.nick ? DEX[u.fx.showNum].name : u.name, x + 46, p.cy, UI.ink); const g = e.gains; /* the name stays the pre-evolution one until the evolution plays */ const stats = [['HP', g.maxHp], ['ATK', g.atk], ['DEF', g.def], ['SPA', g.spa], ['SPD', g.spd], ['SPE', g.spe]]; const cw = Math.floor((w - 52) / 3);
    stats.forEach((s, i) => { const sx = x + 46 + (i % 3) * cw, sy = p.cy + 11 + Math.floor(i / 3) * 10; const showAt = .3 + i * .1; text(s[0], sx, sy, UI.muted); if (q.t > showAt) textR((s[1] >= 0 ? '+' : '') + s[1], sx + cw - 6, sy, s[1] > 0 ? UI.green : UI.ink); });
    if (q.t > 1) { const s = fitLabel(TR('Moves: {0}', u.moves.map(mvName).join(', ')), w - 12); hline(x + 5, p.cy + 32, w - 10, UI.inset); text(s, x + 6, p.cy + 35, UI.info); }
  }
  if (e.type === 'evolve') { const k = q.t / q.dur; const msg = k < .5 ? TR('What? {0} is evolving!', e.from.name) : TR('{0} evolved into {1}!', e.from.name, e.to.name); const w = Math.min(W - 12, Math.max(160, textWidth(msg) + 16)), x = W / 2 - w / 2, y = 30; panel(x, y, w, 20); textC(msg, W / 2, y + 6, k < .5 ? UI.ink : UI.gold); if (k > .15 && k < .8 && Math.floor(q.t * 14) % 2) { ctx.globalAlpha = .25; rect(0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; } }
  if (e.type === 'capture' && e.ok && q.cfx && q.cfx.done) { // CAUGHT: the portrait, the name and level, and where it went (the PC Box, first deployment free)
    const u = e.unit, w = Math.min(212, W - 12), h = 44, x = Math.round(W / 2 - w / 2), k = Math.min(1, (q.t * (BT.fast ? 1.8 : 1) - CATCH_T.result - e.shakes * CATCH_T.shake) / .25), y = Math.round(26 - (1 - easeOutBack(k, 2)) * 14);
    const rival = B.safari && e.team === 1, tier = B.safari ? safariTier(u.num) : null; ctx.globalAlpha = Math.min(1, k * 2); const p = panel(x, y, w, h, { header: rival ? 'BLUE CAUGHT IT!' : 'CAUGHT!', headerRight: TR('Lv {0}', u.level), headerRightCol: UI.gold, fill: rival ? '#4a1a26' : '#1f2a5e' });
    ctx.save(); ctx.beginPath(); ctx.rect(x + 6, p.cy, 30, 22); ctx.clip(); portraitBg(x + 6, p.cy, 30, 22, 0); drawMon(u.num, x + 21, p.cy + 21 + Math.round(Math.sin(q.t * 9) * (k < 1 ? 0 : 1)), {}); ctx.restore(); drawBall(x + 33, p.cy + 18, ITEMS.pokeball.col, 3);
    text(u.name, x + 42, p.cy + 1, '#ffffff', { outline: '#000' }); if (tier) { text(tier.name, x + 42, p.cy + 11, tier.col); textR(TR(rival ? '+{0} pts for Blue' : '+{0} pts', tier.pts), x + w - 7, p.cy + 11, rival ? UI.red : UI.green); } else { text(B.war ? 'Sent to your PC Box' : 'Joins your team', x + 42, p.cy + 11, UI.info); if (B.war) textR('1st deploy FREE', x + w - 7, p.cy + 11, UI.green); } ctx.globalAlpha = 1; }
  if (e.type === 'skill') { const msg = e.target && e.target !== e.unit ? TR('{0} uses {1} on {2}!', e.unit.name, e.skill.name, e.target.name) : TR('{0} uses {1}!', e.unit.name, e.skill.name); const w = Math.min(W - 12, Math.max(120, textWidth(msg) + 16)), x = W / 2 - w / 2, y = 30; panel(x, y, w, 20, { border: ROLES[e.unit.role].col }); textC(fitLabel(msg, w - 12), W / 2, y + 6, UI.ink); }
}
// Phase banner: a slanted band in the team colour sweeps in with speed lines, the phase name slams down (doubled when it
// fits), the turn counter follows, the team runs across under it, and everything leaves to the right.
// Phase banner: a tilted band in the team colour sweeps in with speed lines, the phase name slams down (doubled when it
// fits), the turn counter follows, the team runs across under it, and everything leaves to the right.
// Capturing, as Advance Wars shows it: the building (in its old colours) beside a meter of its 20 points that counts down
// as the Pokémon hops on it, one tick per point; when it reaches zero the banner changes hands in a flash, CAPTURED!
// (or BASE TAKEN! for an HQ) stamps down and sparks fly.
function drawCaptureCard(q) {
  const e = q.ev, p = e.property, u = e.unit, W = VIEW.w, t = q.t * (BT.fast ? 1.8 : 1), total = WAR.capture, from = e.from || 0, to = e.progress;
  const w = Math.min(236, W - 12), h = 72, x = Math.round(W / 2 - w / 2), k = REDUCED ? 1 : Math.min(1, t / .18), y = Math.round(24 - (1 - easeOutBack(k, 2)) * 14);
  const run = clamp((t - .25) / .6, 0, 1), shown = Math.round(lerp(from, to, REDUCED ? 1 : run)), left = total - shown, flip = e.done && t > .95, hq = p.kind === 'hq';
  if (shown > (q.ticks || 0) + from && !REDUCED) { q.ticks = shown - from; Audio.sfx('tick'); }
  if (flip && !q.flipped) { q.flipped = true; Audio.sfx(hq ? 'levelup' : 'chime'); if (!REDUCED) { shake(hq ? 5 : 2); flashScreen('#ffffff', .25); spawnParts(p.x * TILE + TILE / 2, p.y * TILE + 8, hq ? 40 : 22, [teamColor(u.team), teamColorL(u.team), '#ffd24a', '#ffffff'], { speed: 90, life: .9, grav: 50 }); } }
  const owner = flip ? u.team : e.prevOwner, col = teamColor(u.team), head = flip ? (hq ? (u.team === 0 ? 'BASE TAKEN!' : 'YOUR BASE FELL!') : 'CAPTURED!') : 'CAPTURING';
  ctx.globalAlpha = Math.min(1, k * 2); const pan = panel(x, y, w, h, { header: head, headerRight: fitLabel(TRX(p.name), w - textWidth(head) - 24), headerRightCol: flip ? UI.gold : UI.muted, headerFill: flip ? teamColorD(u.team) : '#2a2440' });
  // the building, large, in its colours of the moment
  const bx = x + 8, by = pan.cy + 1, img = tileImg(p.ch, (B.map.variants[p.y] || [])[p.x] || 0, 0, owner), pop = flip && !REDUCED ? Math.round(Math.sin(clamp((t - .95) / .25, 0, 1) * Math.PI) * 3) : 0;
  rect(bx - 1, by - 1, 34, 34, UI.inset); ctx.drawImage(img, bx, by - pop, 32, 32); if (flip && t < 1.25 && !REDUCED) { ctx.globalAlpha = (1.25 - t) / .3; rect(bx, by, 32, 32, '#ffffff'); ctx.globalAlpha = 1; }
  // the meter: 20 cells, the building's points left
  const mx = bx + 42, mw = w - (mx - x) - 46, cw = mw / total; text('POINTS', mx, pan.cy + 1, UI.muted); textR(String(left), mx + mw, pan.cy + 1, left <= 5 ? UI.red : UI.ink);
  for (let i = 0; i < total; i++) { const cx0 = Math.round(mx + i * cw), cx1 = Math.round(mx + (i + 1) * cw) - 1, on = i < left; rect(cx0, pan.cy + 11, cx1 - cx0, 8, UI.inset); if (on) { rect(cx0 + 1, pan.cy + 12, cx1 - cx0 - 2, 6, flip ? col : teamColor(e.prevOwner >= 0 ? e.prevOwner : 2)); hline(cx0 + 1, pan.cy + 12, cx1 - cx0 - 2, '#ffffff60'); } }
  text(fitLabel(flip ? (hq ? TR(u.team === 0 ? 'Their base is yours!' : 'They took your base!') : TR(u.team === 0 ? '{0} took it for your side' : '{0} took it for their side', u.name)) : u.name + ' +' + (to - from) + (to < total ? ' · ' + TR('{0} to go, next turn', total - to) : ''), x + w - 44 - mx), mx, pan.cy + 23, flip ? UI.gold : UI.ink);
  // the capturer hops on each point
  requestAnim(u.num); const hop = REDUCED ? 0 : run < 1 ? Math.round(Math.abs(Math.sin(t * 16)) * 4) : flip ? Math.round(Math.abs(Math.sin(t * 7)) * 2) : 0, sx = x + w - 22;
  ctx.save(); ctx.beginPath(); ctx.rect(x + w - 42, pan.cy - 4, 38, 40); ctx.clip(); if (animReady(u.num)) drawAnim(u.num, sx, pan.cy + 34 - hop, BT.time, { sx: .6, sy: .6 }); else drawMon(u.num, sx, pan.cy + 34 - hop, { outline: col }); ctx.restore();
  ctx.globalAlpha = 1;
  if (flip && !REDUCED) { const kk = clamp((t - .95) / .2, 0, 1), sc = 1 + (1 - easeOutBack(kk, 3)) * 1.5; ctx.save(); ctx.translate(Math.round(x + w / 2), y + h + 10); ctx.scale(sc, sc); bigC(hq ? 'BASE TAKEN!' : 'CAPTURED!', 0, -4, UI.gold, { outline: UI.inset }); ctx.restore(); }
}
// A commander's Ace falls: a band in the commander's colour, their portrait flinching, ACE DOWN! and what it costs.
function drawAceDown(q) {
  const e = q.ev, c = coOf({ co: e.co, root: e.root }), W = VIEW.w, H = VIEW.h, t = q.t, dur = q.dur, out = t > dur - .25 ? easeIn((t - (dur - .25)) / .25) : 0, cy = Math.round(H * .38);
  const bh = Math.round(34 * clamp(REDUCED ? 1 : easeOutBack(clamp(t / .2, 0, 1), 2), 0, 1.1) * (1 - out)); if (bh < 3) return;
  rect(0, cy - Math.round(bh / 2), W, bh, shade(c.col, -.55)); hline(0, cy - Math.round(bh / 2), W, c.col); hline(0, cy + Math.round(bh / 2), W, UI.inset);
  const face = trainerFace(coTrainer({ co: e.co }) ? c.tr : 'red'), shake2 = !REDUCED && t < .4 ? Math.round(Math.sin(t * 60) * 2) : 0, fx = Math.round(W / 2 - 90) + shake2, fy = cy - 11;
  if (face && bh >= 24) { rect(fx - 2, fy - 2, 26, 26, UI.inset); rect(fx - 1, fy - 1, 24, 24, c.col); ctx.save(); ctx.translate(fx + 2, fy + 2); ctx.drawImage(face, 0, 0); ctx.restore(); ctx.globalAlpha = .45; rect(fx + 2, fy + 2, 18, 18, '#1a0610'); ctx.globalAlpha = 1; }
  if (bh >= 24) { bigText('ACE DOWN!', fx + 32, cy - 10, '#ffffff', { outline: UI.inset }); text(fitLabel(TR('{0} fainted · meter halved', e.unit.name) + (e.lost ? ' (-' + e.lost + ')' : '') + ' · ' + TR('powers wait'), W - (fx + 32) - 8), fx + 32, cy + 2, shade(c.col, .5), { outline: UI.inset }); }
}
// The boss wakes up: a red band tears across, BOSS BATTLE! slams down and the boss slides in from the right with its name.
function drawBossAlert(q) {
  const u = q.ev.unit, W = VIEW.w, H = VIEW.h, t = q.t, dur = q.dur, out = t > dur - .25 ? easeIn((t - (dur - .25)) / .25) : 0, cy = Math.round(H / 2);
  const bh = Math.round(Math.min(90, H * .36) * clamp(REDUCED ? 1 : easeOutBack(clamp(t / .2, 0, 1), 2), 0, 1.1) * (1 - out));
  ctx.globalAlpha = .5 * (1 - out); rect(0, 0, W, H, '#1a0208'); ctx.globalAlpha = 1;
  if (bh > 2) { for (let y = 0; y < bh; y++) rect(0, cy - Math.round(bh / 2) + y, W, 1, y % 4 < 2 ? '#8a1020' : '#9a1628'); rect(0, cy - Math.round(bh / 2) - 2, W, 2, '#ff5060'); rect(0, cy + Math.round(bh / 2), W, 2, '#300008');
    if (!REDUCED) for (let i = 0; i < 12; i++) { const ly = cy - Math.round(bh / 2) + 3 + (i * 7) % Math.max(4, bh - 6), len = 20 + (i * 13) % 50, lx = W - ((t * (600 + i * 70) + i * 97) % (W + len * 2)); ctx.globalAlpha = .35; rect(Math.round(lx), ly, len, 1, '#ffc0c8'); ctx.globalAlpha = 1; } }
  const label = 'BOSS BATTLE!', big = W >= textWidth(label, BIG) * 2 + W * .45 ? 2 : 1, slam = REDUCED ? 0 : clamp(1 - (t - .15) / .14, 0, 1), sc = big + slam * 1.4, lx = Math.round(W * (W > 300 ? .38 : .5)) - Math.round(out * W);
  if (t > .15 || REDUCED) { ctx.save(); ctx.translate(lx, cy - Math.round(4.5 * sc) - 5); ctx.scale(sc, sc); bigC(label, 0, 0, '#ffffff', { outline: '#300008' }); ctx.restore(); ctx.globalAlpha = clamp((t - .35) / .2, 0, 1) * (1 - out); textC(u.name + '  Lv' + u.level, lx, cy + Math.round(4.5 * big) + 2, '#ffd0d8', { outline: '#300008' }); ctx.globalAlpha = 1; }
  if (W > 300 && bh > 30) { requestAnim(u.num); const bx = Math.round(W * .8 + (REDUCED ? 0 : (1 - easeOut(clamp((t - .1) / .35, 0, 1))) * W * .4) + out * W * .5); ctx.save(); ctx.beginPath(); ctx.rect(0, cy - Math.round(bh / 2), W, bh); ctx.clip(); if (animReady(u.num)) drawAnim(u.num, bx, cy + Math.round(bh / 2) - 4, BT.time, { flip: false }); else drawMon(u.num, bx, cy + Math.round(bh / 2) - 4, { flip: true, sx: 2, sy: 2 }); ctx.restore(); }
}
// ---------------------------------------------------------------- commanders face off
// The screen splits on a diagonal, each half in its commander's colour with bands racing across it; the two trainers
// slide in large from their sides, their names and passives under them, and VS stamps down in the seam.
const COVS_DUR = 2.2;
function coVsStep(V, dt) {
  const before = V.t; V.t += dt * (BT.fast ? 1.8 : 1); const at = (k) => before < k && V.t >= k;
  if (at(.02)) Audio.sfx('whoosh'); if (at(.14)) Audio.sfx('whoosh'); if (at(.55)) { Audio.sfx('crit'); if (!REDUCED) { shake(5); flashScreen('#ffffff', .35); } }
}
function drawCoVs(V) {
  const W = VIEW.w, H = VIEW.h, t = V.t, out = t > COVS_DUR - .3 ? easeIn((t - (COVS_DUR - .3)) / .3) : 0, tall = H > W * 1.2, top = Math.round(H * (tall ? .06 : .08)), bot = Math.round(H * (tall ? .9 : .92));
  ctx.globalAlpha = .78 * (1 - out); rect(0, 0, W, H, '#05041a'); ctx.globalAlpha = 1;
  // wide screens split left/right on a steep diagonal; tall ones top (the foe) and bottom (you) on a shallow one
  const seamX = y => Math.round(W * .56 - (y - top) / (bot - top) * W * .12), seamY = x => Math.round(H * .52 - x / W * H * .08);
  const sc = tall ? (W >= 170 ? 2 : 1) : H >= 330 && W >= 560 ? 3 : H >= 220 && W >= 360 ? 2 : 1, size = 80 * sc;
  for (const team of [0, 1]) {
    const s = powerState(team), c = coOf(s), trainer = !!coTrainer(s), k = REDUCED ? 1 : easeOut(clamp((t - team * .12) / .35, 0, 1)), dir = team === 0 ? -1 : 1, off = Math.round((1 - k) * W * .7 * dir + out * W * .8 * dir);
    ctx.save(); ctx.translate(off, 0); ctx.beginPath();
    if (!tall) { if (team === 0) { ctx.moveTo(-40, top); ctx.lineTo(seamX(top), top); ctx.lineTo(seamX(bot), bot); ctx.lineTo(-40, bot); } else { ctx.moveTo(seamX(top) + 3, top); ctx.lineTo(W + 40, top); ctx.lineTo(W + 40, bot); ctx.lineTo(seamX(bot) + 3, bot); } }
    else if (team === 1) { ctx.moveTo(-40, top); ctx.lineTo(W + 40, top); ctx.lineTo(W + 40, seamY(W + 40)); ctx.lineTo(-40, seamY(-40)); } else { ctx.moveTo(-40, seamY(-40) + 3); ctx.lineTo(W + 40, seamY(W + 40) + 3); ctx.lineTo(W + 40, bot); ctx.lineTo(-40, bot); }
    ctx.closePath(); ctx.clip();
    // each half in its army's colour (blue for P1/you, red for the other side) tinted by its commander, bands in the commander's own
    rect(-40, top, W + 80, bot - top, shade(mix(team === 0 ? '#2d58c8' : '#c02c3c', c.col, .3), -.5)); ctx.fillStyle = shade(c.col, -.3); const drift = REDUCED ? 0 : Math.floor(t * 60) % 24;
    for (let x = -bot + (team ? -drift : drift); x < W + 40; x += 24) { ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x + (bot - top), top); ctx.lineTo(x + (bot - top) + 9, top); ctx.lineTo(x + 9, bot); ctx.fill(); }
    const img = trainerCanvas(trainer ? c.tr : 'red', team === 1, false), shadow = trainerCanvas(trainer ? c.tr : 'red', team === 1, true);
    const cx = tall ? (team === 1 ? W - Math.round(size / 2) - 4 : Math.round(size / 2) + 4) : Math.round(team === 0 ? W * .26 : W * .74), feet = tall ? (team === 1 ? Math.min(seamY(cx) - 2, top + 44 + size) : bot - 30) : bot - (sc > 1 ? 34 : 26);
    if (shadow) { ctx.globalAlpha = .7; ctx.drawImage(shadow, cx - size / 2 + (team ? 3 : -3) * sc, feet - size + 2 * sc, size, size); ctx.globalAlpha = 1; } if (img) ctx.drawImage(img, cx - size / 2, feet - size, size, size);
    ctx.restore();
    // the name plate and the passive, sliding with their half
    const name = trainer ? c.name.toUpperCase() : 'TACTICIAN', big = sc > 1 && !tall ? 2 : 1, px0 = (tall ? W / 2 : cx) + off, pw = Math.min(tall ? W - 16 : W * .42, textWidth(name, BIG) * big + 24), ny = tall ? (team === 1 ? top + 8 : bot - 24) : bot - (big > 1 ? 30 : 22);
    rect(Math.round(px0 - pw / 2), ny, Math.round(pw), big > 1 ? 20 : 12, '#07061ae0'); hline(Math.round(px0 - pw / 2), ny, Math.round(pw), c.col);
    ctx.save(); ctx.translate(Math.round(px0), ny + 2); if (big > 1) ctx.scale(2, 2); bigC(name, 0, 0, '#ffffff', { outline: UI.inset }); ctx.restore();
    if (c.passive) textC(fitLabel(c.passive.text, tall ? W - 16 : W * .44), px0, ny + (big > 1 ? 22 : 14), shade(c.col, .45), { outline: UI.inset });
    ribbonTab(team === 0 ? (B.versus ? 'P1' : 'YOU') : (B.versus ? 'P2' : 'FOE'), Math.round((tall ? (team === 0 ? W - 36 : 8) : team === 0 ? 8 : W - 40) + off), tall ? (team === 0 ? bot - 42 : top + 36) : top + 6, team === 0 ? '#8ab4ff' : '#ff9a9a');
  }
  // the seam and VS
  if (tall) for (let x = 0; x < W; x++) rect(x, seamY(x), 1, 3, '#ffffff'); else for (let y = top; y < bot; y++) rect(seamX(y), y, 3, 1, '#ffffff');
  if (t >= .55 || REDUCED) { const k = REDUCED ? 1 : clamp((t - .55) / .18, 0, 1), vs = Math.max(2, 3 * sc / 2) + (1 - easeOutBack(k, 3)) * 5, vx = tall ? Math.round(W * .82) : seamX(Math.round(H / 2)) + 1, vy = tall ? seamY(Math.round(W * .82)) + 1 : Math.round(H / 2);
    ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(vx, vy); ctx.scale(vs, vs); bigC('VS', 0, -4.5, UI.gold, { outline: UI.inset }); ctx.restore(); }
  if (t > .8 && !REDUCED) hintLine(VIEW.touch ? ['tap'] : [['Z', 'go']], W / 2, bot + 4);
}
function drawBanner() {
  if (BT.banner.vs && BT.banner.vs.t < COVS_DUR) { drawCoVs(BT.banner.vs); return; }
  const b = BT.banner, W = VIEW.w, H = VIEW.h, t = b.t, dur = BT.fast ? .9 : 1.5, out = t > dur - .28 ? easeIn((t - (dur - .28)) / .28) : 0;
  const grow = REDUCED ? 1 : easeOutBack(clamp(t / .22, 0, 1), 2), bh = Math.round(46 * clamp(grow, 0, 1.15) * (1 - out)), cy = Math.round(H / 2);
  const col = b.team === 0 ? '#2d58c8' : b.team === 1 ? '#c02c3c' : b.team === 2 ? '#a88a20' : '#2a8a44', dark = shade(col, -.45), lite = shade(col, .4), tilt = .07;
  ctx.globalAlpha = .35 * (1 - out); rect(0, 0, W, H, '#05041a'); ctx.globalAlpha = 1;
  const topAt = x => cy - Math.round(bh / 2) - Math.round((x - W / 2) * tilt);
  if (bh > 2) { for (let x = 0; x < W; x += 2) { const y0 = topAt(x); rect(x, y0 - 2, 2, 2, lite); rect(x, y0, 2, bh, col); rect(x, y0 + Math.round(bh * .72), 2, Math.round(bh * .28), shade(col, -.12)); rect(x, y0 + bh, 2, 2, dark); rect(x, y0 + bh + 2, 2, 1, UI.inset); }
    if (!REDUCED) for (let i = 0; i < 10; i++) { const fy = 4 + (i * 13) % Math.max(4, bh - 8), len = 24 + (i * 17) % 44, lx = Math.round(((t * (440 + i * 70) + i * 97) % (W + len * 2)) - len); ctx.globalAlpha = .4 * (1 - out); for (let k = 0; k < len; k += 2) rect(lx + k, topAt(lx + k) + fy, 2, 1, '#ffffff'); ctx.globalAlpha = 1; } }
  // the commander of the phase in a framed portrait at the band's end (AW's day start)
  const cs = b.team <= 1 && powerState(b.team); if (cs && bh >= 30 && W >= 300) { const c = coOf(cs), face = trainerFace(coTrainer(cs) ? c.tr : 'red'), k = W >= 480 && bh >= 40 ? 2 : 1, sz = 18 * k, fx0 = b.team === 0 ? Math.round(W * .1) : Math.round(W * .9) - sz, fx = fx0 + Math.round(out * W * 1.2) + (REDUCED ? 0 : Math.round((1 - clamp(t / .25, 0, 1)) * (b.team === 0 ? -80 : 80))), fy = topAt(fx + sz / 2) + Math.round(bh / 2 - sz / 2);
    if (face) { rect(fx - 3, fy - 3, sz + 6, sz + 6, UI.inset); rect(fx - 2, fy - 2, sz + 4, sz + 4, c.col); rect(fx, fy, sz, sz, shade(c.col, -.5)); ctx.save(); ctx.translate(fx, fy); ctx.scale(k, k); ctx.drawImage(face, 0, 0); ctx.restore(); } }
  // the name: slams from 3x to its size with a white flash, then holds
  // the name in the display face, the side's colours (blue for you, red for the foe), slammed down from 3x with a flash
  const label = String(b.text).toUpperCase(), lw = displayWidth(label) + 1, big = W >= lw * 2 + 30 ? 2 : 1, slam = REDUCED ? 0 : clamp(1 - (t - .08) / .14, 0, 1), sc = big + slam * 1.4, tx = W / 2 + Math.round(out * W * 1.2), dst = b.team === 0 || (B.versus && b.team <= 1 && isHuman(b.team)) ? (b.team === 1 ? 'red' : 'blue') : b.team === 3 ? 'gold' : 'red';
  if (t > .08 || REDUCED) { ctx.save(); ctx.translate(Math.round(tx), cy - Math.round(5.5 * sc) - (b.sub ? 5 : 0)); ctx.scale(sc, sc); displayC(label, 0, 0, { style: dst, slant: 1 }); if (slam > 0) { const D = displayCanvas(label, dst, 1, 1); ctx.globalAlpha = slam; ctx.drawImage(D.shine, -Math.round(D.w / 2) - D.ox, -D.oy); ctx.globalAlpha = 1; } ctx.restore(); }
  if (b.sub && t > .25) { ctx.globalAlpha = clamp((t - .25) / .15, 0, 1) * (1 - out); textC(b.sub, tx, cy + Math.round(4.5 * big) - 1, UI.gold, { outline: UI.inset }); ctx.globalAlpha = 1; }
  // the team runs across under the band
  const list = alive(b.team).slice(0, 6), dir = b.team === 0 ? 1 : -1, base = cy + Math.round(bh / 2) + 34; list.forEach((u, i) => { const ux = Math.round(W / 2 + dir * ((t - .15) * W * 1.1 - W * .55) - dir * i * 26), hop = Math.round(Math.abs(Math.sin(t * 14 + i)) * 3); if (ux < -30 || ux > W + 30) return; ctx.globalAlpha = 1 - out; drawMon(u.num, ux, base - hop, { flip: dir < 0, outline: teamColor(u.team) }); ctx.globalAlpha = 1; });
}
// The unit sheet: two columns on wide screens (stats + evolution | traits + moves), one taller column on narrow ones.
function sheetRect() { const W = VIEW.w, H = VIEW.h; const narrow = W < 250; const w = narrow ? W - 12 : Math.min(260, W - 12), sl = BT.info ? Math.min(2, wrap(sheetSkillText(BT.info), w - 12).length) : 1, h = (narrow ? 194 : 134) + (sl - 1) * 9; return { x: W / 2 - w / 2, y: Math.max(12, H / 2 - h / 2), w, h, narrow, sl }; }
// What the role does right now: the state (cooldown, braced, rooted) first, then the skill or the plain-striker note.
function sheetSkillText(u) { const st = []; if (u.skill && !u.skill.passive && u.cd > 0) st.push(TR(u.cd > 1 ? 'ready in {0} turns' : 'ready in {0} turn', u.cd)); if (u.brace) st.push(TR('BRACED')); if (u.root) st.push(TR('ROOTED')); return (st.length ? st.join(' · ') + ' · ' : '') + (u.skill ? u.skill.blurb : TR('Striker: plain attacker, strikes twice when 10+ SPE faster')); }
function drawUnitSheet(u) {
  const W = VIEW.w; const r = sheetRect(), { x, y, w, h, narrow } = r; hudPanel(x, y, w, h, { title: B.versus ? (u.team === 2 ? 'WILD POKÉMON' : teamName(u.team)) : u.team === 0 ? 'YOUR POKÉMON' : u.team === 2 ? 'WILD POKÉMON' : u.team === 3 ? 'ALLY' : 'ENEMY' });
  portraitBg(x + 6, y + 8, 48, 40, u.team); drawMon(u.num, x + 30, y + 44, { flip: u.team !== 0, sy: 1 + Math.sin(BT.time * 4) * .03 }); teamGlyph(x + 9, y + 11, u.team, teamColorL(u.team));
  text(u.name, x + 60, y + 8, UI.ink); textR('Lv' + u.level + (isHuman(u.team) && !B.territory && !narrow ? '  ' + TR('{0}/100xp', u.xp) : ''), x + w - 6, y + 8, UI.gold); if (u.boss) text('BOSS', x + 60 + textWidth(u.name) + 6, y + 8, UI.red);
  u.types.forEach((t, i) => typeBadge(t, x + 60 + i * 26, y + 18, 24)); if (u.status) statusBadge(u.status, x + w - 22, y + 18);
  hpBar(x + 60, y + 30, w - 66, u.hp, u.maxHp); text(TR('HP {0}/{1}', u.hp, u.maxHp), x + 60, y + 37, UI.ink);
  const stats = [['ATK', u.atk], ['DEF', u.def], ['SPA', u.spa], ['SPD', u.spd], ['SPE', u.spe], ['MOV', effMov(u)]]; const cw = narrow ? Math.floor((w - 12) / 3) : 44; stats.forEach((s, i) => { const sx = x + 6 + (i % 3) * cw, sy = y + 54 + Math.floor(i / 3) * 10; text(s[0], sx, sy, UI.muted); textR(String(s[1]), sx + cw - 6, sy, UI.ink); });
  // role first (the badge colour matches the unit card), then the terrain traits; the skill line at the bottom says what the role does
  const R = ROLES[u.role]; const traits = [R.name.toUpperCase()]; if (u.fly) traits.push(TR('FLIES')); if (u.swim) traits.push(TR('SWIMS')); if (u.climb) traits.push(TR('CLIMBS')); if (u.forester) traits.push(TR('WOODS'));
  const ev = u.dex.evos.length && isHuman(u.team) ? TR('Evolves at Lv{0}', Math.min(...u.dex.evos.map(e => e[1]))) : '';
  const mx = narrow ? x + 6 : x + 140, my = narrow ? y + 88 : y + 54; const tw = narrow ? (ev ? w - 12 - textWidth(ev) - 6 : w - 12) : w - 146;
  let tr = traits.join(' · '); while (textWidth(tr) > tw && traits.length > 1) { traits.pop(); tr = traits.join(' · '); } miniBadge(R.abbr, R.col, mx, my - 1); text(tr, mx + 20, my, UI.green); if (narrow && ev) textR(ev, x + w - 6, my, '#98d8f8'); else if (ev) text(ev, x + 6, y + 76, '#98d8f8');
  sectionLabel('Moves', mx, my + 10, narrow ? w - 12 : w - 146 - (x + 140 - mx)); u.moves.slice(0, 4).forEach((m, i) => { typeBadge(m.type, mx, my + 19 + i * 10, 24); text(mvName(m) + ' ' + m.pow + (m.rng[1] > 1 ? ' ' + TR('R{0}', m.rng[0] + '-' + m.rng[1]) : ''), mx + 29, my + 20 + i * 10, UI.ink); });
  if (u.recharge && !u.boss) text('RECHARGING', x + 60 + textWidth(u.name) + 6, y + 8, RECHARGE_COL);
  // type matchup hints
  const weak = TYPES.filter(t => effRaw(t, u.types) >= 2).slice(0, 4), res = TYPES.filter(t => effRaw(t, u.types) < 1).slice(0, 4);
  const wy = narrow ? y + 150 : y + 88; text('Weak:', x + 6, wy, UI.muted); weak.forEach((t, i) => typeBadge(t, x + 36 + i * 25, wy - 1, 24)); text('Resist:', x + 6, wy + 11, UI.muted); res.forEach((t, i) => typeBadge(t, x + 36 + i * 25, wy + 10, 24));
  // what the role does right now, on up to two lines (the state leads, so it survives when even two are not enough)
  const skl = wrap(sheetSkillText(u), w - 12), sl = r.sl || 1, sk = skl.slice(0, sl); if (skl.length > sl) { let last = sk[sl - 1]; while (rawTextWidth(last + '…') > w - 12 && last.length > 8) last = last.slice(0, -1); sk[sl - 1] = trNote(last.replace(/ +$/, '') + '…'); }
  hline(x + 5, y + h - 16 - (sl - 1) * 9, w - 10, UI.inset); sk.forEach((l, i) => text(l, x + 6, y + h - 13 - (sl - 1) * 9 + i * 9, R.col));
  hintLine(VIEW.touch ? ['tap to close'] : [['◂▸', 'browse'], ['X', 'close']], W / 2, y + h + 5);
}
const HELP_PAGES = [
  ['HOW TO PLAY', 'Pick one of your Pokémon, walk it through the blue tiles, then act: Attack, Capture a property, use its role Skill, Catch a weak wild Pokémon, or Wait. Red tiles show what it can hit.', 'When everyone has acted the day passes; END TURN passes early. The objective in the top card is how you win: rout the foe, take their HQ, beat a boss, seize a Gym, survive or out-catch.', 'Keys: arrows move · Z confirm · X back · Q/E next Pokémon · C info · V forecast details · P power · F fast · H help. Mouse or touch: tap to select and confirm, drag to pan.'],
  ['FUNDS & THE PC BOX', 'Each HQ and Poké Center you hold pays ₽1,000 at the start of your day (the war chest is by the turn counter). They also heal and cure your Pokémon standing on them.', 'Open the PC (the PC button, or Z on a free center of yours) to deploy a Pokémon from your Box there: pay its price and it acts from your next turn. Ten on the map at most.', 'A Pokémon that faints goes back to the Box and recovers for two days. A catch goes to your Box and its first deployment is free; with no ball left you can buy one for ₽500.', 'Capture: stand on a property you do not own and Capture. 20 points, 10 per action at full HP; leaving resets it. An HQ taken ends the battle; a Rocket center taken stops their deployments.'],
  ['COMMANDERS', 'Each side follows a trainer; their Ace wears the crown. Allies within 2 tiles of the Ace get the passive. Hits dealt and taken, catches and captures fill the power bar: P or POWER spends 50 on a Power or 100 on a Super Power, once a turn.', 'The Tactician (you) leads with your partner: Charmander rallies (+25% on each ally\'s next attack), Squirtle shields (20% less damage), Bulbasaur heals (20% and a cure). Supers double them.', 'Gym Leaders you free join as commanders: Brock hardens Rock types, Misty calls rain, Lt. Surge paralyses, Erika heals, Koga poisons, Sabrina foresees, Blaine calls the sun, Blue speeds up, Giovanni shakes the ground.'],
  ['COMBAT', 'Before every attack the forecast answers three questions: what you deal, what comes back, and what could go wrong. Its numbers assume normal hits.', 'Types: super effective ×1.5 (×2.25 on a double weakness), resisted ×0.67, immune 0. A move of your own type hits 25% harder. Crits: 4% (24% for high-crit moves), ×1.5.', 'A foe that can reach you counters. Scouts and Strikers strike twice when 10+ SPE faster. Terrain stars cut damage; tall grass, forest and mountains also help dodge.', 'Weather: rain powers Water and dampens Fire, sun the reverse. A sandstorm and snow wear down everyone they do not spare; sand hardens Rock types against special moves, snow slows walkers on open ground and hardens Ice types. Burn halves ATK and ticks, poison ticks, paralysis slows, frozen skips until it thaws.'],
  ['ROLES', 'The type says whom a Pokémon beats; its role says how to use it (the badge on its card). Evolution keeps the role.', 'SCOUT darts 2 tiles after attacking. DEFENDER can Brace: 40% less damage until its next turn. AMPHIBIOUS swims and is tougher on water. CONTROLLER Roots a foe within 2 tiles (fliers are immune). RANGED hits one tile further. SUPPORT Mends an adjacent ally: +30% HP and a cure. STRIKER just hits hard.', 'Skills use the action, like an attack. Root and Mend work every other turn and earn XP; Brace can be used every turn and earns nothing.'],
];
function helpRect() { const W = VIEW.w, H = VIEW.h, w = Math.min(280, W - 12); const all = helpLines(BT.helpPage, w - 16), limit = Math.max(1, Math.floor((H - 64) / 10)), start = Math.min(BT.helpOffset || 0, Math.max(0, all.length - 1)); const lines = all.slice(start, start + limit), h = 50 + lines.length * 10; return { x: W / 2 - w / 2, y: Math.max(6, H / 2 - h / 2), w, h, lines, limit, next: start + limit < all.length ? start + limit : null }; }
function helpLines(page, width) { const p = HELP_PAGES[page]; const out = []; p.slice(1).forEach((para, i) => { if (i) out.push(''); out.push(...wrap(para, width)); }); return out; }
function drawHelp() {
  const W = VIEW.w; const r = helpRect(); dimScreen(.5); const p = hudPanel(r.x, r.y, r.w, r.h, { header: TR(BT.helpOffset ? 'HELP · CONTINUED' : 'HELP'), headerRight: (BT.helpPage + 1) + ' / ' + HELP_PAGES.length });
  sectionLabel(HELP_PAGES[BT.helpPage][0], r.x + 8, p.cy, r.w - 16, UI.gold); r.lines.forEach((l, i) => text(l, r.x + 8, p.cy + 12 + i * 10, UI.ink));
  rect(r.x + 4, r.y + r.h - 18, r.w - 8, 14, UI.panelDark); hline(r.x + 4, r.y + r.h - 18, r.w - 8, UI.inset);
  hintLine(VIEW.touch ? [r.next != null || BT.helpPage < HELP_PAGES.length - 1 ? 'tap: next page' : 'tap: close'] : [['Z', 'next page'], ['X', 'close']], W / 2, r.y + r.h - 14, { pill: false });
}
function drawHandoff() {
  const W = VIEW.w, H = VIEW.h, h = BT.handoff; const t = h.team; const k = Math.min(1, h.t / .3); ctx.globalAlpha = .78 * k; rect(0, 0, W, H, '#05070f'); ctx.globalAlpha = 1;
  const col = teamColor(t); const y = H / 2 - 52 + (1 - easeOut(k)) * 20; ctx.globalAlpha = k; const w = Math.min(224, W - 12);
  panel(W / 2 - w / 2, y, w, 96, { fill: t === 0 ? '#17264a' : '#3a1a22', border: col });
  ctx.save(); ctx.translate(W / 2, y + 12); ctx.scale(2, 2); bigC(teamName(t), 0, 0, teamColorL(t), { outline: '#000' }); ctx.restore();
  textC(TR('Turn {0}', B.turn + (B.map.turnLimit ? ' / ' + B.map.turnLimit : '')) + '  ·  ' + TR('{0} Pokémon ready', alive(t).length), W / 2, y + 36, UI.ink);
  const list = alive(t).slice(0, 6); list.forEach((u, i) => { const ux = W / 2 - (list.length - 1) * 13 + i * 26, uy = y + 78 - (REDUCED ? 0 : Math.round(Math.abs(Math.sin(BT.time * 6 + i)) * 2)); drawMon(u.num, ux, uy, { flip: t === 1, outline: u.leader ? UI.gold : teamColor(t) }); if (u.leader) drawCrown(ux - 4, uy - 30); });
  if (h.t > .4 && Math.floor(BT.time * 2) % 2) hintLine(VIEW.touch ? ['pass the device', 'tap to start'] : ['pass the controls', ['Z', 'start']], W / 2, y + 102, { col: UI.gold }); ctx.globalAlpha = 1;
}
// ---------------------------------------------------------------- the end of a battle
// VICTORY / DEFEAT stamped letter by letter over a turning sunburst, then (campaign and skirmish wins) the three stars
// pop in one by one; confetti for a win. endSequenceCues plays the sounds at the same beats the drawing uses.
const END_BEATS = { letters: .15, stars: 1.25, starGap: .38 };
function endStars() { if (B.versus || B.territory || B.tower != null || B.safari || !(B.result === 'win')) return null; return battleStars(B.map.par || (CHAPTERS[B.chapter] && CHAPTERS[B.chapter].par) || 10); }
function endSequenceCues(a, b) {
  if (!REDUCED) { const word = String(TRX(endWord())); for (let i = 0; i < word.length; i++) { const at = END_BEATS.letters + i * .06 + .2; if (word[i] !== ' ' && a < at && b >= at) Audio.sfx(i === word.length - 1 ? 'crit' : 'stamp'); } }
  const n = endStars(); if (n == null || REDUCED) return;
  for (let k = 0; k < 3; k++) { const at = END_BEATS.stars + k * END_BEATS.starGap; if (a < at && b >= at) { if (k < n) { Audio.sfx('levelup'); shake(2); const W = bvW(); spawnParts(CAM.x + W / 2 + (k - 1) * 40 / BT.zoom, CAM.y + bvH() / 2 + 18 / BT.zoom, 16, [UI.gold, '#ffffff', '#fff0a0'], { speed: 80, life: .7, grav: 60 }); } else Audio.sfx('cursor'); } }
}
const SUNBURST = {};
function sunburst(r, rays, phase, col) {
  const key = r + ':' + rays + ':' + phase + col; if (SUNBURST[key]) return SUNBURST[key];
  // built once per phase through ImageData: one pass over the pixels, no per-pixel draw calls
  const c = document.createElement('canvas'); c.width = c.height = r * 2; const g = c.getContext('2d'); const [R, G2, B2] = hexRgb(col);
  const img = g.createImageData(2 * r, 2 * r), d8 = img.data;
  for (let y = 0; y < 2 * r; y++) for (let x = 0; x < 2 * r; x++) { const dx = x - r + .5, dy = y - r + .5, d = Math.hypot(dx, dy); if (d > r || d < 6) continue; const a = (Math.atan2(dy, dx) / (Math.PI * 2) + 1 + phase / (rays * 4)) % 1; if (Math.floor(a * rays * 2) % 2 === 0) { const i = (y * 2 * r + x) * 4; d8[i] = R; d8[i + 1] = G2; d8[i + 2] = B2; d8[i + 3] = 255; } }
  g.putImageData(img, 0, 0); return SUNBURST[key] = c;
}
// The display face version: each letter drops, bounces and settles in turn (extrusions first, then faces).
function drawStampDisplay(word, cx, y, t, style, scale, slant = 2) {
  const chars = [...String(TRX(word)).toUpperCase()], widths = chars.map(ch => ch === ' ' ? 5 : rawDisplayWidth(ch) + 1), total = (widths.reduce((a, b) => a + b, 0) - 1) * scale + slant * scale; let x = Math.round(cx - total / 2); const put = [];
  chars.forEach((ch, i) => { const at = END_BEATS.letters + i * .06, u = REDUCED ? 1 : clamp((t - at) / .22, 0, 1); if (u > 0 && ch !== ' ') put.push({ ch, x, u }); x += widths[i] * scale; });
  for (const layer of ['back', 'face']) for (const p of put) { const D = displayCanvas(p.ch, style, scale, slant), drop = Math.round((1 - easeOutBounce(p.u)) * -34), sc = 1 + (1 - p.u) * .8, w2 = D.w / 2, h2 = D.h / 2;
    ctx.save(); ctx.globalAlpha = Math.min(1, p.u * 3); ctx.translate(p.x + w2, y + drop + h2); ctx.scale(sc, sc); ctx.drawImage(D[layer], Math.round(-w2 - D.ox), Math.round(-h2 - D.oy)); ctx.restore(); }
  return total;
}
function displayStampScale(word, W) { const w = displayWidth(word) + 4; return W >= w * 3 + 30 ? 3 : W >= w * 2 + 16 ? 2 : 1; }
function drawStampWord(word, cx, y, t, col, dark, scale) {
  const chars = [...word.toUpperCase()], widths = chars.map(ch => ch === ' ' ? 4 : textWidth(ch, BIG) + 1), total = (widths.reduce((a, b) => a + b, 0) - 1) * scale; let x = Math.round(cx - total / 2);
  chars.forEach((ch, i) => { const at = END_BEATS.letters + i * .06, u = REDUCED ? 1 : clamp((t - at) / .22, 0, 1); if (u > 0 && ch !== ' ') { const drop = Math.round((1 - easeOutBounce(u)) * -34), sc = scale * (1 + (1 - u) * .8); ctx.save(); ctx.globalAlpha = Math.min(1, u * 3); ctx.translate(x + widths[i] * scale / 2, y + drop + 4.5 * scale); ctx.scale(sc, sc); bigC(ch, 0, -4.5, col, { outline: dark }); ctx.restore(); } x += widths[i] * scale; });
  return total;
}
function endWord() { const vs = B.versus, vt = B.result === 'p1' ? 0 : B.result === 'p2' ? 1 : -1; return vs ? (vt < 0 ? 'DRAW' : vt === 0 ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!') : B.result === 'win' ? 'VICTORY!' : B.result === 'draw' ? 'DRAW' : B.result === 'retreat' ? 'RETREAT' : 'DEFEAT'; }
function drawEndScreen() {
  const W = VIEW.w, H = VIEW.h, t = BT.endTimer, k = Math.min(1, t / .5), vs = B.versus, vt = B.result === 'p1' ? 0 : B.result === 'p2' ? 1 : -1, win = vs ? vt >= 0 : B.result === 'win';
  const word = endWord();
  const col = vs ? (vt < 0 ? UI.muted : teamColorL(vt)) : win ? UI.gold : B.result === 'draw' ? UI.ink : '#ff8080', dark = win ? (vs ? UI.inset : UI.goldDark) : '#2a0a14';
  ctx.globalAlpha = .62 * k; rect(0, 0, W, H, win ? '#0a0820' : '#1a0610'); ctx.globalAlpha = 1;
  const cy = Math.round(H * .4), scale = displayStampScale(word, W), dstyle = vs ? (vt === 0 ? 'blue' : vt === 1 ? 'red' : 'silver') : win ? 'gold' : B.result === 'draw' || B.result === 'retreat' ? 'silver' : 'red';
  if (win && !REDUCED) { const r = Math.round(Math.min(W, H) * .42), sb = sunburst(r, 12, Math.floor(t * 6) % 4, '#ffffff'); ctx.globalAlpha = .07 * k; ctx.drawImage(sb, Math.round(W / 2 - r), Math.round(cy - r)); ctx.globalAlpha = 1; }
  // the ribbon under the word
  const rh = 11 * scale + 16, rw = Math.min(W - 8, Math.round(W * .9 * easeOut(k))); if (rw > 8) { rect(W / 2 - rw / 2, cy - rh / 2, rw, rh, win ? (vs ? teamColorD(vt) : '#3a2a8a') : '#4a1020'); hline(W / 2 - rw / 2, cy - rh / 2, rw, win ? UI.gold : '#ff6070'); hline(W / 2 - rw / 2, cy + rh / 2 - 1, rw, win ? UI.goldDark : '#200008'); }
  drawStampDisplay(word, W / 2, cy - Math.round(5.5 * scale), t, dstyle, scale);
  let y = cy + rh / 2 + 8;
  const n = endStars();
  if (n != null) { const ss = W >= 320 && H >= 240 ? 2 : 1; for (let s = 0; s < 3; s++) { const at = END_BEATS.stars + s * END_BEATS.starGap, u = REDUCED ? 1 : clamp((t - at) / .25, 0, 1), sx = Math.round(W / 2 + (s - 1) * (18 * ss + 6)), on = s < n; if (u <= 0) { drawBigStar(sx, y + 7 * ss, ss, false); continue; } const sc = on ? ss + (1 - easeOutBack(u, 3)) * ss : ss; drawBigStar(sx, y + 7 * ss, sc, on); } y += 14 * ss + 4;
    const goals = [TR('win'), TR('within {0} turns', B.map.par || 10), B.faints ? TR('{0} fainted', B.faints) : TR('nobody fainted')]; if (t > END_BEATS.stars + .2) { ctx.globalAlpha = clamp((t - END_BEATS.stars - .2) / .3, 0, 1); textC(goals.join('  ·  '), W / 2, y, UI.muted, { outline: UI.inset }); ctx.globalAlpha = 1; } y += 12; }
  const stats = vs || win ? TR('Turns {0}', B.turn) + '  ·  ' + TR('KOs {0}', B.kills) + (win && !vs && B.captured.length ? '  ·  ' + TR('Caught {0}', B.captured.length) : '') : TR(B.result === 'retreat' ? 'Your team runs back to the Poké Center.' : B.war && B.war.reason ? B.war.reason : 'Everyone fainted. Try a different plan!');
  if (t > .7) { ctx.globalAlpha = clamp((t - .7) / .3, 0, 1); wrap(vs ? (B.endReason || stats) : stats, W - 20).slice(0, 2).forEach((l, i) => textC(l, W / 2, y + i * 10, UI.ink, { outline: UI.inset })); ctx.globalAlpha = 1; }
  if (t > 1.2) hintLine(VIEW.touch ? ['tap to continue'] : [['Z', 'continue']], W / 2, Math.min(H - 14, y + 26));
  if (win && k >= 1 && Math.random() < .35) spawnParts(vrnd() * bvW() + CAM.x, CAM.y - 5, 1, vs && vt >= 0 ? [teamColor(vt), teamColorL(vt), '#ffd24a', '#ffffff'] : ['#ffd24a', '#5ee06a', '#3d7dff', '#ff5a5a', '#ffffff'], { speed: 10, vy: 40, life: 2.5, grav: 20, size: 3 });
}
// A 13-px star: gold with a highlight when earned, a dark outline when not; `sc` pops it bigger (integer steps).
function drawBigStar(cx, cy, sc, on) {
  const rows = ['......O......', '.....OYO.....', '.....OYO.....', '....OYWYO....', 'OOOOOYWYOOOOO', 'OYYYYYWYYYYyO', '.OYYYYYYYYyO.', '..OYYYYYYyO..', '...OYYYYyO...', '..OYYyOYYyO..', '..OYyO.OYyO..', '.OYyO...OyyO.', '.OOO.....OOO.'];
  const pal = on ? { O: UI.inset, Y: UI.gold, y: '#d08a10', W: '#fff8d0' } : { O: '#5a5880', Y: '#24223e', y: '#1c1a32', W: '#2e2c4a' };
  const s = Math.max(1, Math.round(sc)); ctx.save(); ctx.translate(Math.round(cx - 6.5 * s), Math.round(cy - 6.5 * s)); ctx.scale(s, s); stampAt(0, 0, rows, pal); ctx.restore();
}
