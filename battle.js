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
};
function tileX(x) { return Math.round(x * TILE - CAM.x + FX.shakeX); }
function tileY(y) { return Math.round(y * TILE - CAM.y + FX.shakeY); }
function boardH() { return VIEW.h; }
function centerCam(x, y, snap) { CAM.tx = clamp(x * TILE + TILE / 2 - VIEW.w / 2, Math.min(0, (B.map.w * TILE - VIEW.w) / 2), Math.max(0, B.map.w * TILE - VIEW.w)); CAM.ty = clamp(y * TILE + TILE / 2 - VIEW.h / 2, Math.min(0, (B.map.h * TILE - VIEW.h) / 2), Math.max(0, B.map.h * TILE - VIEW.h)); if (snap) { CAM.x = CAM.tx; CAM.y = CAM.ty; } }
function keepCursorVisible() { const m = TILE * 1.5; const sx = BT.cx * TILE - CAM.tx, sy = BT.cy * TILE - CAM.ty; if (sx < m) CAM.tx -= m - sx; if (sx > VIEW.w - m - TILE) CAM.tx += sx - (VIEW.w - m - TILE); if (sy < m + 20) CAM.ty -= m + 20 - sy; if (sy > VIEW.h - m - TILE - 30) CAM.ty += sy - (VIEW.h - m - TILE - 30); clampCam(); }
function clampCam() { const mw = B.map.w * TILE, mh = B.map.h * TILE; CAM.tx = mw <= VIEW.w ? (mw - VIEW.w) / 2 : clamp(CAM.tx, 0, mw - VIEW.w); CAM.ty = mh <= VIEW.h ? (mh - VIEW.h) / 2 : clamp(CAM.ty, 0, mh - VIEW.h); }

// ---------------------------------------------------------------- battle setup
function startBattle(mapDef, party, bag, opts = {}) {
  seedRng(opts.seed || (Date.now() & 0xffff));
  const map = parseMap(mapDef); UID = 1;
  B = { map, units: [], turn: 1, phase: 0, bag: bag, result: null, seized: false, captured: [], kills: 0, chapter: opts.chapter != null ? opts.chapter : null, log: [], seed: opts.seed || 1, skirmish: !!opts.skirmish, turnsUsed: 0 };
  // enemies / wild / allies from the map definition
  for (const d of mapDef.units) { const u = makeUnit(d.mon, d.level, d.team == null ? 1 : d.team, { x: d.x, y: d.y, ai: d.ai, boss: d.boss, nick: d.nick }); if (d.hp) u.hp = Math.max(1, Math.floor(u.maxHp * d.hp)); u.provoked = false; B.units.push(u); }
  // player party on deploy tiles
  party.forEach((p, i) => { const slot = map.deploy[i]; if (!slot) return; const u = restoreUnit(Object.assign({}, p, { team: 0, x: slot.x, y: slot.y, acted: false, status: null })); u.hp = u.maxHp; u.leader = i === 0; B.units.push(u); });
  BT.mode = 'idle'; BT.sel = null; BT.queue = []; BT.anim = null; BT.log = []; BT.showDanger = false;
  const first = alive(0)[0]; BT.cx = first ? first.x : 0; BT.cy = first ? first.y : 0; centerCam(BT.cx, BT.cy, true);
  FX.parts = []; FX.texts = []; FX.sprites = [];
  Audio.playMusic(map.music);
  if (!opts.defer) beginPhase(0, true);
}
function beginPhase(team, first) {
  B.phase = team;
  const ev = upkeep(team);
  if (team === 0 && !first) { B.turn++; if (checkObjective()) { endBattle(); return; } }
  if (team === 0) { saveSuspend(); }
  const teamsPresent = [0, 1, 2, 3].filter(t => alive(t).length);
  if (!teamsPresent.includes(team) && team !== 0) { nextPhase(); return; }
  // reinforcements at the start of the enemy phase
  if (team === 1) for (const u of spawnReinforcements()) ev.push({ type: 'spawn', unit: u });
  const label = team === 0 ? 'PLAYER PHASE' : team === 1 ? 'ENEMY PHASE' : team === 2 ? 'WILD PHASE' : 'ALLY PHASE';
  BT.banner = { text: label, t: 0, team, sub: team === 0 ? 'Turn ' + B.turn + (B.map.turnLimit && B.map.objective.type !== 'survive' ? ' / ' + B.map.turnLimit : '') + (B.map.objective.type === 'survive' ? ' / ' + B.map.objective.turns : '') : null };
  BT.mode = 'banner'; Audio.sfx(team === 0 ? 'phase' : 'enemyphase');
  Audio.playMusic(team === 0 ? (B.units.some(u => u.boss && u.hp > 0 && u.provoked) ? 'boss' : B.map.music) : 'enemy');
  BT.queue = ev.map(e => ({ kind: 'event', ev: e }));
  BT.afterBanner = () => { playQueue(() => { if (team === 0) { const f = alive(0).find(u => !u.acted); if (f) { BT.cx = f.x; BT.cy = f.y; keepCursorVisible(); } BT.mode = 'idle'; } else runEnemyPhase(team); }); };
}
function spawnReinforcements() { const out = []; for (const r of B.map.reinforce) if (r.turn === B.turn && !r.done) { r.done = true; for (const d of r.units) { if (unitAt(d.x, d.y)) continue; const u = makeUnit(d.mon, d.level, d.team == null ? 1 : d.team, { x: d.x, y: d.y, ai: d.ai || 'aggro', boss: d.boss }); B.units.push(u); out.push(u); } } return out; }
function nextPhase() {
  if (checkObjective()) { endBattle(); return; }
  let t = B.phase; for (let i = 0; i < 4; i++) { t = (t + 1) % 4; if (t === 0 || alive(t).length) break; }
  beginPhase(t, false);
}
function endBattle() { BT.mode = 'end'; BT.endTimer = 0; Audio.stopMusic(); Audio.sfx(B.result === 'win' ? 'win' : 'lose'); if (B.result === 'win') Audio.playMusic('win'); }

// ---------------------------------------------------------------- animation queue
// Queue items: {kind:'move', unit, path} | {kind:'strike', ...} | {kind:'event', ev} | {kind:'wait', t} | {kind:'fn', fn} | {kind:'msg', text}
function playQueue(done) { BT.queueDone = done; BT.mode = 'anim'; nextAnim(); }
function nextAnim() {
  const q = BT.queue.shift();
  if (!q) { BT.anim = null; const d = BT.queueDone; BT.queueDone = null; if (d) d(); return; }
  BT.anim = q; q.t = 0;
  if (q.kind === 'event') { setupEvent(q); }
  if (q.kind === 'move') { q.unit.fx.dx = 0; q.unit.fx.dy = 0; q.i = 0; q.dur = (BT.fast ? .05 : .11); if (q.path.length > 1) { const l = q.path[q.path.length - 1]; if (Math.abs(l.x * TILE - CAM.tx - VIEW.w / 2) > VIEW.w * .6 || Math.abs(l.y * TILE - CAM.ty - VIEW.h / 2) > VIEW.h * .6) centerCam(q.path[0].x, q.path[0].y); } }
  if (q.kind === 'strike') { q.dur = BT.fast ? .35 : .62; centerCamBetween(q.att, q.def); }
  if (q.kind === 'msg') { q.dur = BT.fast ? .5 : 1.1; }
  if (q.kind === 'wait') { q.dur = BT.fast ? q.t2 * .3 : q.t2; }
  if (q.kind === 'fn') { q.fn(); nextAnim(); }
}
function centerCamBetween(a, b) { const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2; if (Math.abs(x * TILE - CAM.tx - VIEW.w / 2) > VIEW.w * .35 || Math.abs(y * TILE - CAM.ty - VIEW.h / 2) > VIEW.h * .35) centerCam(x, y); }
function setupEvent(q) {
  const e = q.ev; q.dur = BT.fast ? .35 : .7;
  const ux = u => u.x * TILE + TILE / 2, uy = u => u.y * TILE + 4;
  switch (e.type) {
    case 'ko': q.dur = BT.fast ? .5 : .9; Audio.sfx('ko'); shake(4); spawnParts(ux(e.unit), uy(e.unit) + 8, 18, ['#ffffff', '#ffd24a', '#c0c0c0'], { speed: 90, life: .7, grav: 60 }); if (e.unit.team !== 0) B.kills++; floatText(ux(e.unit), uy(e.unit) - 14, e.unit.team === 0 ? 'FAINTED!' : 'KO!', e.unit.team === 0 ? UI.red : UI.gold, { big: true, life: 1.3 }); if (e.unit.leader) { BT.leaderDown = true; } break;
    case 'xp': q.dur = BT.fast ? .5 : 1.0; q.from = e.unit.xp - e.amount; break;
    case 'levelup': q.dur = BT.fast ? .9 : 2.1; Audio.sfx('levelup'); spawnParts(ux(e.unit), uy(e.unit), 24, ['#ffd24a', '#ffffff', '#5ee06a'], { speed: 70, life: .9, grav: -30, shape: 'ring' }); break;
    case 'evolve': q.dur = BT.fast ? 1.4 : 3.2; Audio.sfx('evolve'); break;
    case 'heal': Audio.sfx('heal'); floatText(ux(e.unit), uy(e.unit), '+' + e.amount, UI.green, { outline: '#0a3a10' }); spawnParts(ux(e.unit), uy(e.unit) + 10, 10, ['#5ee06a', '#ffffff'], { speed: 30, grav: -60, life: .8 }); break;
    case 'cure': floatText(ux(e.unit), uy(e.unit) - 8, e.kind === 'frz' ? 'Thawed!' : e.kind === 'par' ? 'Recovered!' : 'Cured!', '#98d8f8'); break;
    case 'thaw': floatText(ux(e.unit), uy(e.unit) - 8, 'Thawed!', '#98d8f8'); break;
    case 'dot': Audio.sfx(e.kind === 'brn' ? 'burn' : 'poison'); shake(1); floatText(ux(e.unit), uy(e.unit), '-' + e.amount, e.kind === 'psn' ? '#d080ff' : '#ff9040'); spawnParts(ux(e.unit), uy(e.unit) + 8, 8, e.kind === 'psn' ? ['#b050d0', '#7030a0'] : ['#ff8030', '#ffd040'], { speed: 30, grav: -50, life: .7 }); if (e.unit.x * TILE < CAM.x || e.unit.x * TILE > CAM.x + VIEW.w) centerCam(e.unit.x, e.unit.y); break;
    case 'spawn': q.dur = BT.fast ? .3 : .6; centerCam(e.unit.x, e.unit.y); Audio.sfx('select'); spawnParts(ux(e.unit), uy(e.unit) + 8, 12, ['#ffffff', '#ff4b4b'], { speed: 50, life: .5, grav: 0 }); floatText(ux(e.unit), uy(e.unit) - 10, 'Reinforcements!', UI.red); break;
    case 'capture': q.dur = BT.fast ? 1.6 : 2.6 + e.shakes * .5; Audio.sfx('catch'); break;
    case 'miss': q.dur = BT.fast ? .3 : .55; break;
    case 'status': floatText(ux(e.unit), uy(e.unit) - 6, STATUS[e.status].text.toUpperCase() + '!', STATUS[e.status].col, { outline: '#000' }); Audio.sfx(e.status === 'par' ? 'para' : e.status === 'brn' ? 'burn' : 'poison'); break;
  }
}
function updateAnim(dt) {
  const q = BT.anim; if (!q) return; q.t += dt;
  if (q.kind === 'move') {
    const p = q.path; if (p.length < 2) { q.unit.x = p[0].x; q.unit.y = p[0].y; nextAnim(); return; }
    const total = (p.length - 1) * q.dur; const k = Math.min(1, q.t / total); const seg = Math.min(p.length - 2, Math.floor(k * (p.length - 1))); const f = k * (p.length - 1) - seg;
    const a = p[seg], b = p[seg + 1]; q.unit.x = a.x; q.unit.y = a.y; q.unit.fx.dx = (b.x - a.x) * f * TILE; q.unit.fx.dy = (b.y - a.y) * f * TILE - Math.abs(Math.sin(f * Math.PI)) * 5; q.unit.fx.facing = b.x - a.x !== 0 ? Math.sign(b.x - a.x) : q.unit.fx.facing;
    if (seg !== q.i) { q.i = seg; Audio.sfx('step'); spawnParts(a.x * TILE + TILE / 2, a.y * TILE + TILE - 4, 3, ['#d8c8a0', '#ffffff'], { speed: 20, life: .35, grav: -10, flat: true }); }
    if (k >= 1) { const l = p[p.length - 1]; q.unit.x = l.x; q.unit.y = l.y; q.unit.fx.dx = 0; q.unit.fx.dy = 0; q.unit.fx.sy = .8; q.unit.fx.sx = 1.2; nextAnim(); }
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
  if (k >= 1) { if (e.ok) { T.fx.alpha = 1; T.hp = 0; T.captured = true; } else T.fx.alpha = 1; T.fx.sx = T.fx.sy = 1; q.ball = null; }
}
BT.hpShow = new Map();

// ---------------------------------------------------------------- player actions
function selectUnit(u) {
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
  BT.undo = { unit: u, x: u.x, y: u.y }; Audio.sfx('ok');
  BT.queue = [{ kind: 'move', unit: u, path: BT.path.slice() }];
  playQueue(() => { u.moved = true; pickupAt(u); openActionMenu(u); });
}
// Items lying on the board are picked up by the player unit that ends its move on them.
function pickupAt(u) {
  if (u.team !== 0) return; const it = B.map.items.find(i => !i.taken && i.x === u.x && i.y === u.y); if (!it || !ITEMS[it.item]) return;
  it.taken = true; B.bag[it.item] = (B.bag[it.item] || 0) + 1; Audio.sfx('item');
  floatText(u.x * TILE + TILE / 2, u.y * TILE - 6, 'Got ' + ITEMS[it.item].name + '!', UI.gold, { outline: '#402000', life: 1.4 });
  spawnParts(u.x * TILE + TILE / 2, u.y * TILE + 10, 14, ['#ffd24a', '#ffffff', ITEMS[it.item].col], { speed: 50, life: .6, grav: -20 });
}
function openActionMenu(u) {
  const items = []; const tg = targetsFrom(u, u.x, u.y); if (tg.length) items.push({ id: 'attack', label: 'Attack', sub: tg.length + (tg.length > 1 ? ' targets' : ' target') });
  const wildAdj = B.units.filter(v => v.hp > 0 && v.team === 2 && dist(v, u) === 1); const hasBall = Object.keys(B.bag).some(k => ITEMS[k].kind === 'ball' && B.bag[k] > 0);
  if (wildAdj.length && hasBall) items.push({ id: 'catch', label: 'Catch', sub: 'Throw a ball' });
  if (B.map.objective.type === 'seize' && B.map.seize && u.x === B.map.seize.x && u.y === B.map.seize.y) items.unshift({ id: 'seize', label: 'Seize', sub: 'Win the map!' });
  if (Object.keys(B.bag).some(k => ITEMS[k].kind !== 'ball' && B.bag[k] > 0)) items.push({ id: 'item', label: 'Bag', sub: 'Use an item' });
  items.push({ id: 'wait', label: 'Wait', sub: 'End this unit\'s turn' });
  BT.menu = { items, i: 0 }; BT.mode = 'menu'; BT.cx = u.x; BT.cy = u.y;
}
function menuChoose(id) {
  const u = BT.sel; Audio.sfx('ok');
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
  const ev = resolveCombat(u, t, cf.move, u); BT.queue = eventsToQueue(ev, u, t); BT.mode = 'anim';
  playQueue(() => { finishUnit(u); });
}
function eventsToQueue(ev, u, t) {
  const q = [];
  for (const e of ev) {
    if (e.type === 'hit' || e.type === 'miss') { const d = dist(e.att, e.def); q.push({ kind: 'strike', att: e.att, def: e.def, move: e.move, ev: e, ranged: d > 1 }); }
    else q.push({ kind: 'event', ev: e });
  }
  return q;
}
function confirmCatch() {
  const u = BT.sel, t = BT.targets[BT.tIdx]; const ball = BT.ball; if (!t || !ball) return;
  B.bag[ball]--; if (B.bag[ball] <= 0) delete B.bag[ball]; const r = tryCapture(t, ITEMS[ball]);
  BT.queue = [{ kind: 'event', ev: { type: 'capture', unit: t, ok: r.ok, shakes: r.shakes, from: { x: u.x, y: u.y }, ball } }];
  if (r.ok) BT.queue.push({ kind: 'fn', fn: () => { t.hp = 0; t.captured = true; B.captured.push(serializeUnit(Object.assign({}, t, { team: 0, hp: Math.max(1, Math.floor(t.maxHp * .5)) }))); } });
  playQueue(() => { finishUnit(u); });
}
function finishUnit(u) {
  u.acted = true; u.moved = true; BT.sel = null; BT.reach = null; BT.atk = null; BT.undo = null; BT.menu = null; BT.hpShow.clear();
  for (const v of B.units) { v.fx.dx = v.fx.dy = 0; v.fx.sx = v.fx.sy = 1; v.fx.alpha = 1; v.fx.flash = 0; }
  if (checkObjective()) { endBattle(); return; }
  if (alive(0).every(v => v.acted)) { BT.mode = 'idle'; BT.autoEnd = .6; return; }
  BT.mode = 'idle'; const f = alive(0).find(v => !v.acted); if (f && !VIEW.touch) { /* keep the cursor where it is; the player picks the next unit */ }
}
function cancel() {
  if (BT.mode === 'move') { BT.sel.fx.sx = BT.sel.fx.sy = 1; BT.cx = BT.sel.x; BT.cy = BT.sel.y; BT.sel = null; BT.reach = null; BT.atk = null; BT.mode = 'idle'; Audio.sfx('cancel'); }
  else if (BT.mode === 'menu') { const u = BT.sel; if (BT.undo && BT.undo.unit === u) { u.x = BT.undo.x; u.y = BT.undo.y; u.moved = false; BT.undo = null; } BT.menu = null; selectUnit(u); BT.cx = u.x; BT.cy = u.y; Audio.sfx('cancel'); }
  else if (BT.mode === 'target' || BT.mode === 'catchTarget' || BT.mode === 'item') { BT.mode = 'menu'; BT.cx = BT.sel.x; BT.cy = BT.sel.y; openActionMenu(BT.sel); Audio.sfx('cancel'); }
  else if (BT.mode === 'ballPick') { BT.mode = 'catchTarget'; Audio.sfx('cancel'); }
  else if (BT.mode === 'itemTarget') { BT.mode = 'item'; Audio.sfx('cancel'); }
  else if (BT.mode === 'help' || BT.mode === 'unitinfo' || BT.mode === 'endmenu') { BT.mode = 'idle'; Audio.sfx('cancel'); }
  else if (BT.mode === 'idle') { BT.mode = 'endmenu'; BT.menu = { items: [{ id: 'endturn', label: 'End Turn', sub: 'Pass to the enemy' }, { id: 'danger', label: (BT.showDanger ? 'Hide' : 'Show') + ' Danger', sub: 'Enemy attack range' }, { id: 'help', label: 'Help', sub: 'Controls & rules' }, { id: 'mute', label: Audio.muted ? 'Unmute' : 'Mute', sub: 'Sound on/off' }, { id: 'retreat', label: 'Retreat', sub: 'Give up this map' }, { id: 'close', label: 'Close', sub: '' }], i: 0 }; Audio.sfx('menu'); }
}
function endTurn() { BT.mode = 'anim'; BT.sel = null; BT.autoEnd = 0; for (const u of alive(0)) u.acted = true; nextPhase(); }

// ---------------------------------------------------------------- enemy phase playback
function runEnemyPhase(team) {
  const order = alive(team).filter(u => u.hp > 0).sort((a, b) => b.level - a.level);
  const step = () => {
    if (checkObjective()) { endBattle(); return; }
    const u = order.shift(); if (!u) { nextPhase(); return; }
    if (u.hp <= 0) { step(); return; }
    if (u.status === 'frz' || (u.status === 'par' && rnd() < .25)) { BT.queue = [{ kind: 'fn', fn: () => { centerCam(u.x, u.y); floatText(u.x * TILE + TILE / 2, u.y * TILE - 4, u.status === 'frz' ? 'Frozen solid!' : 'Fully paralyzed!', STATUS[u.status].col, { outline: '#000' }); } }, { kind: 'wait', t2: .7 }]; playQueue(step); return; }
    const d = aiDecide(u);
    if (!d) { step(); return; }
    BT.queue = [];
    if (d.x !== u.x || d.y !== u.y) { const reach = reachable(u); const p = pathTo(reach, d.x, d.y); if (p) BT.queue.push({ kind: 'fn', fn: () => { centerCam(u.x, u.y); } }, { kind: 'wait', t2: .25 }, { kind: 'move', unit: u, path: p }); }
    if (d.target) { BT.queue.push({ kind: 'fn', fn: () => { const ev = resolveCombat(u, d.target, d.move, { x: d.x, y: d.y }); BT.queue.unshift(...eventsToQueue(ev, u, d.target)); } }); }
    BT.queue.push({ kind: 'wait', t2: .15 });
    playQueue(() => { u.acted = true; step(); });
  };
  step();
}

// ---------------------------------------------------------------- input handling
function battleInput(ev) {
  if (ev.type === 'key' && ev.key === 'mute') { Audio.toggle(); return; }
  if (ev.type === 'key' && ev.key === 'fast') { BT.fast = !BT.fast; floatText(VIEW.w / 2 + CAM.x, CAM.y + 40, BT.fast ? 'FAST MODE' : 'NORMAL SPEED', UI.gold); return; }
  if (BT.mode === 'banner') { if (ev.type === 'down' || (ev.type === 'key' && ev.key === 'ok')) BT.banner.t = Math.max(BT.banner.t, 1.1); return; }
  if (BT.mode === 'anim') { if (ev.type === 'down' || ev.type === 'key') { BT.fastTap = .4; } return; }
  if (BT.mode === 'end') { if (BT.endTimer > 1.2 && (ev.type === 'down' || (ev.type === 'key' && ev.key === 'ok'))) { BT.endTimer = 99; } return; }
  if (BT.mode === 'help') { if (ev.type === 'down' || (ev.type === 'key')) { if (ev.type === 'key' && (ev.key === 'right' || ev.key === 'ok') || ev.type === 'down') { BT.helpPage++; if (BT.helpPage > 2) { BT.helpPage = 0; BT.mode = 'idle'; } } else if (ev.key === 'left') BT.helpPage = Math.max(0, BT.helpPage - 1); else if (ev.key === 'back') { BT.mode = 'idle'; BT.helpPage = 0; } } return; }
  if (BT.mode === 'unitinfo') { if (ev.type === 'down' || ev.type === 'key') { if (ev.type === 'key' && (ev.key === 'left' || ev.key === 'right' || ev.key === 'prev' || ev.key === 'next')) { const list = B.units.filter(u => u.hp > 0); let i = list.indexOf(BT.info); i = (i + (ev.key === 'left' || ev.key === 'prev' ? -1 : 1) + list.length) % list.length; BT.info = list[i]; BT.cx = BT.info.x; BT.cy = BT.info.y; keepCursorVisible(); Audio.sfx('cursor'); } else { BT.mode = 'idle'; Audio.sfx('cancel'); } } return; }
  if (ev.type === 'key') { keyInput(ev.key); return; }
  if (ev.type === 'wheel') { CAM.tx += ev.dx; CAM.ty += ev.dy; clampCam(); return; }
  pointerInput(ev);
}
function menuNav(dir) { const m = BT.menu; if (!m) return; m.i = (m.i + dir + m.items.length) % m.items.length; Audio.sfx('menu'); }
function keyInput(k) {
  const m = BT.mode;
  if (m === 'menu' || m === 'item' || m === 'endmenu' || m === 'ballPick') { if (k === 'up') menuNav(-1); else if (k === 'down') menuNav(1); else if (k === 'ok') activateMenu(); else if (k === 'back') cancel(); return; }
  if (m === 'target' || m === 'catchTarget') { if (k === 'left' || k === 'up' || k === 'prev') { BT.tIdx = (BT.tIdx - 1 + BT.targets.length) % BT.targets.length; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } else if (k === 'right' || k === 'down' || k === 'next') { BT.tIdx = (BT.tIdx + 1) % BT.targets.length; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } else if (k === 'info') { BT.moveIdx++; Audio.sfx('menu'); } else if (k === 'ok') { if (m === 'target') confirmAttack(); else pickBall(); } else if (k === 'back') cancel(); return; }
  if (m === 'itemTarget') { if (k === 'ok') useItemOn(BT.sel); else if (k === 'back') cancel(); return; }
  if (k === 'help') { BT.mode = 'help'; BT.helpPage = 0; return; }
  const dx = k === 'left' ? -1 : k === 'right' ? 1 : 0, dy = k === 'up' ? -1 : k === 'down' ? 1 : 0;
  if (dx || dy) { const nx = clamp(BT.cx + dx, 0, B.map.w - 1), ny = clamp(BT.cy + dy, 0, B.map.h - 1); if (nx !== BT.cx || ny !== BT.cy) { BT.cx = nx; BT.cy = ny; keepCursorVisible(); Audio.sfx('cursor'); if (m === 'move') extendPath(nx, ny); } return; }
  if (k === 'ok') { tileAction(BT.cx, BT.cy); return; }
  if (k === 'back') { cancel(); return; }
  if (k === 'next' || k === 'prev') { const list = alive(0).filter(u => !u.acted); if (list.length && m === 'idle') { const cur = list.findIndex(u => u.x === BT.cx && u.y === BT.cy); const n = list[(cur + (k === 'next' ? 1 : -1) + list.length) % list.length]; BT.cx = n.x; BT.cy = n.y; keepCursorVisible(); Audio.sfx('cursor'); } return; }
  if (k === 'info') { const u = unitAt(BT.cx, BT.cy); if (u && m === 'idle') { BT.info = u; BT.mode = 'unitinfo'; Audio.sfx('ok'); } return; }
}
function activateMenu() {
  const m = BT.menu; const it = m.items[m.i]; if (!it) return;
  if (BT.mode === 'menu') menuChoose(it.id);
  else if (BT.mode === 'item') { BT.item = it.id; BT.mode = 'itemTarget'; Audio.sfx('ok'); }
  else if (BT.mode === 'ballPick') { BT.ball = it.id; confirmCatch(); }
  else if (BT.mode === 'endmenu') { Audio.sfx('ok'); if (it.id === 'endturn') endTurn(); else if (it.id === 'danger') { BT.showDanger = !BT.showDanger; BT.mode = 'idle'; } else if (it.id === 'help') { BT.mode = 'help'; BT.helpPage = 0; } else if (it.id === 'mute') { Audio.toggle(); BT.mode = 'idle'; } else if (it.id === 'retreat') { B.result = 'retreat'; endBattle(); } else BT.mode = 'idle'; }
}
function pickBall() { const balls = Object.keys(B.bag).filter(k => ITEMS[k].kind === 'ball' && B.bag[k] > 0); if (!balls.length) { Audio.sfx('error'); return; } const t = BT.targets[BT.tIdx]; BT.menu = { items: balls.map(k => ({ id: k, label: ITEMS[k].name + ' ×' + B.bag[k], sub: Math.round(clamp((.22 + .68 * (1 - t.hp / t.maxHp)) * ITEMS[k].rate * (t.status ? 1.3 : 1) * (t.boss ? .5 : 1), .05, .97) * 100) + '% chance' })), i: 0 }; BT.mode = 'ballPick'; Audio.sfx('ok'); }
function useItemOn(u) { const it = BT.item; B.bag[it]--; if (B.bag[it] <= 0) delete B.bag[it]; Audio.sfx('item'); const ev = useItem(u, it); BT.queue = ev.map(e => ({ kind: 'event', ev: e })); playQueue(() => finishUnit(u)); }
function tileAction(x, y) {
  const m = BT.mode; const u = unitAt(x, y);
  if (m === 'idle') {
    if (u && u.team === 0 && !u.acted) { selectUnit(u); return; }
    if (u) { BT.info = u; BT.mode = 'unitinfo'; Audio.sfx('ok'); return; }
    cancel(); return; // empty tile → end-turn menu
  }
  if (m === 'move') {
    if (u && u === BT.sel) { BT.path = [{ x: u.x, y: u.y }]; confirmMove(); return; }
    if (u && u.team === 0 && !u.acted) { cancel(); selectUnit(u); return; }
    if (u && hostile(u.team, 0) && BT.atk.some(c => c.x === x && c.y === y) || (u && hostile(u.team, 0) && BT.reach.has(key(x, y)))) { // quick-attack: move next to it and attack
      const spots = [...BT.reach.values()].filter(n => canStand(BT.sel, n.x, n.y) && usableMoves(BT.sel, Math.abs(n.x - u.x) + Math.abs(n.y - u.y)).length);
      if (spots.length) { spots.sort((a, b) => (terrainDef(terrAt(b.x, b.y), BT.sel) - terrainDef(terrAt(a.x, a.y), BT.sel)) || (dist(a, BT.sel) - dist(b, BT.sel))); const s = spots[0]; BT.path = pathTo(BT.reach, s.x, s.y); BT.pendingTarget = u; confirmMoveThenAttack(); return; }
    }
    if (BT.reach.has(key(x, y)) && canStand(BT.sel, x, y)) { extendPath(x, y); confirmMove(); return; }
    Audio.sfx('error'); return;
  }
}
function confirmMoveThenAttack() { const u = BT.sel; BT.undo = { unit: u, x: u.x, y: u.y }; Audio.sfx('ok'); BT.queue = [{ kind: 'move', unit: u, path: BT.path.slice() }]; playQueue(() => { u.moved = true; pickupAt(u); openActionMenu(u); const t = BT.pendingTarget; BT.pendingTarget = null; const tg = targetsFrom(u, u.x, u.y); if (t && tg.includes(t)) { BT.targets = tg; BT.tIdx = tg.indexOf(t); BT.moveIdx = 0; BT.mode = 'target'; setTargetCursor(); } }); }
function pointerInput(ev) {
  const m = BT.mode;
  if (ev.type === 'down') { BT.dragStart = { x: ev.x, y: ev.y, cx: CAM.tx, cy: CAM.ty }; BT.dragged = false; if (ev.btn === 2) { cancel(); BT.dragStart = null; return; } }
  if (ev.type === 'move') {
    if (BT.dragStart && INPUT.down) { const dx = ev.x - BT.dragStart.x, dy = ev.y - BT.dragStart.y; if (BT.dragged || Math.abs(dx) + Math.abs(dy) > 6) { BT.dragged = true; CAM.tx = BT.dragStart.cx - dx; CAM.ty = BT.dragStart.cy - dy; clampCam(); CAM.x = CAM.tx; CAM.y = CAM.ty; } return; }
    if (ev.touch) return;
    const tx = Math.floor((ev.x + CAM.x) / TILE), ty = Math.floor((ev.y + CAM.y) / TILE);
    if (m === 'menu' || m === 'item' || m === 'endmenu' || m === 'ballPick') { const h = menuHit(ev.x, ev.y); if (h >= 0 && h !== BT.menu.i) { BT.menu.i = h; Audio.sfx('menu'); } return; }
    if (m === 'target' || m === 'catchTarget') { const ti = BT.targets.findIndex(t => t.x === tx && t.y === ty); if (ti >= 0 && ti !== BT.tIdx) { BT.tIdx = ti; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } return; }
    if (inMap(tx, ty) && (tx !== BT.cx || ty !== BT.cy) && (m === 'idle' || m === 'move')) { BT.cx = tx; BT.cy = ty; if (m === 'move') extendPath(tx, ty); }
    return;
  }
  if (ev.type === 'up') {
    if (BT.dragged) { BT.dragged = false; BT.dragStart = null; return; } BT.dragStart = null;
    const tx = Math.floor((ev.x + CAM.x) / TILE), ty = Math.floor((ev.y + CAM.y) / TILE);
    if (hudHit(ev.x, ev.y)) return;
    if (m === 'menu' || m === 'item' || m === 'endmenu' || m === 'ballPick') { const h = menuHit(ev.x, ev.y); if (h >= 0) { BT.menu.i = h; activateMenu(); } else cancel(); return; }
    if (m === 'target' || m === 'catchTarget') { const ti = BT.targets.findIndex(t => t.x === tx && t.y === ty); if (ti >= 0) { if (ti === BT.tIdx) { if (m === 'target') confirmAttack(); else pickBall(); } else { BT.tIdx = ti; BT.moveIdx = 0; setTargetCursor(); Audio.sfx('cursor'); } } else if (forecastHit(ev.x, ev.y)) { if (m === 'target') confirmAttack(); else pickBall(); } else if (moveSwitchHit(ev.x, ev.y)) { BT.moveIdx++; Audio.sfx('menu'); } else cancel(); return; }
    if (m === 'itemTarget') { useItemOn(BT.sel); return; }
    if (!inMap(tx, ty)) { if (m === 'move') cancel(); return; }
    if (ev.touch && (tx !== BT.cx || ty !== BT.cy) && m === 'move') { BT.cx = tx; BT.cy = ty; extendPath(tx, ty); keepCursorVisible(); Audio.sfx('cursor'); const u = unitAt(tx, ty); if (!u || u === BT.sel) return; }
    if (ev.touch && m === 'idle' && (tx !== BT.cx || ty !== BT.cy)) { BT.cx = tx; BT.cy = ty; keepCursorVisible(); const u = unitAt(tx, ty); if (!u) { Audio.sfx('cursor'); return; } }
    BT.cx = tx; BT.cy = ty; tileAction(tx, ty);
  }
}

// ---------------------------------------------------------------- update
function battleUpdate(dt) {
  BT.time += dt;
  if (FX.hitstop > 0) { FX.hitstop -= dt; dt *= .15; }
  if (BT.fastTap > 0) { BT.fastTap -= dt; dt *= 2.2; }
  const cs = BT.mode === 'anim' || BT.mode === 'banner' ? 10 : 14; CAM.x += (CAM.tx - CAM.x) * Math.min(1, dt * cs); CAM.y += (CAM.ty - CAM.y) * Math.min(1, dt * cs); if (Math.abs(CAM.tx - CAM.x) < .5) CAM.x = CAM.tx; if (Math.abs(CAM.ty - CAM.y) < .5) CAM.y = CAM.ty;
  for (const u of B.units) { const f = u.fx; f.sx += (1 - f.sx) * Math.min(1, dt * 12); f.sy += (1 - f.sy) * Math.min(1, dt * 12); if (f.hit > 0) { f.hit -= dt; if (f.hit <= 0) { f.flash = 0; f.dx = f.dy = 0; } } if (f.dodge > 0) { f.dodge -= dt; if (f.dodge <= 0) f.dx = 0; } }
  for (const [id, h] of BT.hpShow) { h.t += dt * 2.5; if (h.t >= 1) BT.hpShow.delete(id); }
  if (BT.quip) { BT.quip.t += dt; if (BT.quip.t > 1.6) BT.quip = null; }
  if (BT.mode === 'banner') { BT.banner.t += dt; if (BT.banner.t > (BT.fast ? .9 : 1.5)) { BT.mode = 'anim'; const f = BT.afterBanner; BT.afterBanner = null; f(); } }
  if (BT.mode === 'anim') updateAnim(dt);
  if (BT.mode === 'end') { BT.endTimer += dt; if (BT.endTimer > 3.5 || BT.endTimer >= 99) { BT.endTimer = 0; onBattleEnd(B.result); } }
  if (BT.autoEnd > 0 && BT.mode === 'idle') { BT.autoEnd -= dt; if (BT.autoEnd <= 0) endTurn(); }
  if (BT.mode === 'idle' && !alive(0).some(u => !u.acted) && !BT.autoEnd && B.phase === 0 && !B.result) BT.autoEnd = .4;
  updateFX(dt); Audio.tick();
}

// ---------------------------------------------------------------- drawing
function battleDraw() {
  const m = B.map; const f = Math.floor(BT.time * 3) % WATER_FRAMES;
  drawVoid();
  const x0 = Math.max(0, Math.floor(CAM.x / TILE)), y0 = Math.max(0, Math.floor(CAM.y / TILE)), x1 = Math.min(m.w - 1, Math.ceil((CAM.x + VIEW.w) / TILE)), y1 = Math.min(m.h - 1, Math.ceil((CAM.y + VIEW.h) / TILE));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    drawTerrain(ctx, m, x, y, tileX(x), tileY(y), f, BT.time);
  }
  // items on the floor
  for (const it of m.items) if (!it.taken) { const X = tileX(it.x) + TILE / 2, Y = tileY(it.y) + TILE / 2 + Math.round(Math.sin(BT.time * 4 + it.x) * 2); drawBall(X, Y, ITEMS[it.item] ? ITEMS[it.item].col : '#f04848', 5); if (Math.floor(BT.time * 6 + it.x) % 5 === 0) px(X + 6, Y - 6, '#ffffff'); }
  // seize target marker
  if (m.seize) { const X = tileX(m.seize.x), Y = tileY(m.seize.y); const k = Math.floor(BT.time * 4) % 2; outline(X + 2 + k, Y + 2 + k, TILE - 4 - 2 * k, TILE - 4 - 2 * k, UI.gold); bigC('!', X + TILE / 2, Y - 8 + Math.round(Math.sin(BT.time * 5) * 2), UI.gold, { outline: '#000' }); }
  // danger zone
  if (BT.showDanger && (BT.mode === 'idle' || BT.mode === 'move')) { const dz = dangerZone(0); const cells = []; for (const k of dz) { const [x, y] = k.split(',').map(Number); cells.push({ x, y }); } rangeOverlay(cells, (x, y) => dz.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#b03030', '#ff8080', Math.floor(BT.time * 6)); }
  // move / attack ranges
  if (BT.sel && (BT.mode === 'move' || BT.mode === 'anim' && BT.anim && BT.anim.kind === 'move' && BT.anim.unit === BT.sel)) {
    const cells = [...BT.reach.values()].filter(n => canStand(BT.sel, n.x, n.y));
    rangeOverlay(cells, (x, y) => BT.reach.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#3060e0', '#a0c0ff', Math.floor(BT.time * 6));
    rangeOverlay(BT.atk, (x, y) => BT.reach.has(key(x, y)) || BT.atk.some(c => c.x === x && c.y === y), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e03030', '#ffa0a0', Math.floor(BT.time * 6));
  }
  if (BT.mode === 'unitinfo' && BT.info && BT.info.team !== 0) { const r = reachable(BT.info); const cells = [...r.values()].filter(n => canStand(BT.info, n.x, n.y)); rangeOverlay(cells, (x, y) => r.has(key(x, y)), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e03030', '#ffa0a0', Math.floor(BT.time * 6)); const ac = attackCells(BT.info, r); rangeOverlay(ac, (x, y) => r.has(key(x, y)) || ac.some(c => c.x === x && c.y === y), -CAM.x + FX.shakeX, -CAM.y + FX.shakeY, '#e07030', '#ffc0a0', Math.floor(BT.time * 6)); }
  // target highlights
  if (BT.mode === 'target' || BT.mode === 'catchTarget') for (const t of BT.targets) { const X = tileX(t.x), Y = tileY(t.y); const k = Math.floor(BT.time * 8) % 2; outline(X + 1 + k, Y + 1 + k, TILE - 2 - 2 * k, TILE - 2 - 2 * k, t === BT.targets[BT.tIdx] ? '#ffffff' : '#ff6060'); }
  if (BT.mode === 'move' && BT.path.length > 1) drawArrow(BT.path, -CAM.x + FX.shakeX, -CAM.y + FX.shakeY);
  // units (sorted by y so southern sprites overlap northern ones)
  const units = B.units.filter(u => u.hp > 0 || (BT.anim && BT.anim.kind === 'event' && (BT.anim.ev.unit === u))).sort((a, b) => (a.y + a.fx.dy / TILE) - (b.y + b.fx.dy / TILE));
  for (const u of units) drawUnit(u);
  // cursor
  if (['idle', 'move', 'target', 'catchTarget', 'unitinfo'].includes(BT.mode)) { const hostileCur = unitAt(BT.cx, BT.cy) && hostile(unitAt(BT.cx, BT.cy).team, 0); drawCursor(tileX(BT.cx), tileY(BT.cy), BT.time * 1000, '#ffffff', (BT.mode === 'target' || hostileCur) ? '#ff5a5a' : '#ffd24a'); }
  if (BT.anim && BT.anim.ball) { const b = BT.anim.ball; drawBall(Math.round(b.x - CAM.x), Math.round(b.y - CAM.y), ITEMS[BT.anim.ev.ball].col, 5); }
  drawFX(-CAM.x + FX.shakeX, -CAM.y + FX.shakeY);
  if (FX.flash > 0) { ctx.globalAlpha = FX.flash * .7; rect(0, 0, VIEW.w, VIEW.h, FX.flashCol); ctx.globalAlpha = 1; }
  drawHUD();
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
  const W = VIEW.w, H = VIEW.h; rect(0, 0, W, H, '#101219');
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
function drawUnit(u) {
  const f = u.fx; const X = tileX(u.x) + f.dx, Y = tileY(u.y) + f.dy; const cx = X + TILE / 2, by = Y + TILE - 3;
  const idle = (u.team === 0 && !u.acted && BT.mode !== 'anim') ? Math.round(Math.sin(BT.time * 6 + u.id) * 1) : 0;
  const sel = BT.sel === u && BT.mode === 'move';
  const bob = sel ? Math.round(Math.abs(Math.sin(BT.time * 10)) * -3) : idle;
  // shadow / team stand
  drawStand(cx, by + 1, u.team, f.alpha);
  if (u.boss) { ctx.globalAlpha = f.alpha; const k = Math.floor(BT.time * 4) % 2; ellipse(cx, by + 1, 13 + k, 5, '#ffd24a'); drawStand(cx, by + 1, u.team, f.alpha); ctx.globalAlpha = 1; }
  const grey = u.team === 0 && u.acted && BT.mode !== 'anim';
  const num = f.showNum || u.num; const flip = u.team === 1 || u.team === 2 ? f.facing !== 1 : f.facing === -1;
  let tint = null; if (f.flash) tint = '#ffffff'; else if (grey) tint = null;
  if (f.alpha > 0) {
    if (grey) { ctx.globalAlpha = .9 * f.alpha; drawMon(num, cx, by + bob, { flip, sx: f.sx, sy: f.sy, tint: 'grey' }); ctx.globalAlpha = 1; }
    else drawMon(num, cx, by + bob, { flip, sx: f.sx, sy: f.sy, tint, alpha: f.alpha });
    if (f.flash === 1 && !grey) { ctx.globalAlpha = f.alpha; drawMon(num, cx, by + bob, { flip, sx: f.sx, sy: f.sy, tint: '#ffffff' }); ctx.globalAlpha = 1; }
  }
  // hp pip bar + level + status
  if (f.alpha > 0 && u.hp > 0) {
    const show = BT.hpShow.get(u.id); let hp = u.hp; if (show) hp = Math.round(lerp(show.from, show.to, Math.min(1, show.t)));
    ctx.globalAlpha = f.alpha; const bw = 20; rrect(cx - bw / 2 - 1, by + 4, bw + 2, 5, UI.shadow, 1); rect(cx - bw / 2, by + 5, bw, 3, '#2b2b33'); const ratio = clamp(hp / u.maxHp, 0, 1); const w = Math.round(bw * ratio); if (w) { const hc = hpColor(ratio); rect(cx - bw / 2, by + 5, w, 3, hc); hline(cx - bw / 2, by + 5, w, shade(hc, .4)); }
    if (u.status) statusBadge(u.status, cx + 6, Y - 2);
    if (u.leader) { const k = Math.round(Math.sin(BT.time * 5) * 1); drawCrown(cx - 16, Y + 2 + k); }
    if (u.boss) { const k = Math.round(Math.sin(BT.time * 4) * 1); drawSkull(cx + 10, Y - 4 + k); }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- HUD
const HUD = { hits: [] };
function hudHit(x, y) { for (const h of HUD.hits) if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) { h.run(); return true; } return false; }
function button(x, y, w, h, label, run, opt = {}) { const hot = INPUT.x >= x && INPUT.y >= y && INPUT.x < x + w && INPUT.y < y + h && !VIEW.touch; rrect(x + 1, y + 1, w, h, UI.shadow, 1); rrect(x, y, w, h, opt.col || (hot ? '#5a7ac0' : UI.panel2), 1); outline(x, y, w, h, UI.border); hline(x + 1, y + 1, w - 2, shade(opt.col || UI.panel2, .25)); textC(label, x + w / 2, y + (h - 7) / 2, opt.ink || UI.ink); HUD.hits.push({ x, y, w, h, run }); }
function drawHUD() {
  HUD.hits = []; const W = VIEW.w, H = VIEW.h;
  if (BT.mode === 'end') { drawEndScreen(); return; }
  // turn / objective card (top-left)
  if (BT.mode !== 'banner' || true) {
    const tw = 118; panel(4, 4, tw, 24); text('TURN ' + B.turn + (B.map.turnLimit && B.map.objective.type !== 'survive' ? '/' + B.map.turnLimit : B.map.objective.type === 'survive' ? '/' + B.map.objective.turns : ''), 10, 8, UI.gold); text(objectiveText(), 10, 17, UI.muted);
    const pc = alive(0).length, ec = alive(1).length; const dot = (x, y, c) => { circle(x, y, 3, UI.shadow); circle(x, y, 2, c); };
    dot(tw - 14, 11, teamColor(0)); textR(String(pc), tw - 18, 8, UI.ink); dot(tw - 14, 20, teamColor(1)); textR(String(ec), tw - 18, 17, UI.ink);
  }
  // terrain + hovered unit cards (bottom)
  const hov = unitAt(BT.cx, BT.cy); const t = terrAt(BT.cx, BT.cy);
  if (['idle', 'move', 'target', 'catchTarget', 'unitinfo', 'menu'].includes(BT.mode)) {
    const onRight = BT.cx * TILE - CAM.x < W / 2; const tx = onRight ? W - 78 : 4;
    panel(tx, H - 34, 74, 30); text(t.name, tx + 6, H - 30, UI.gold); const ref = hov || BT.sel || { fly: false, swim: false }; text('DEF ' + terrainDef(t, ref) + '%', tx + 6, H - 21, UI.ink); text('AVO ' + terrainEva(t, ref), tx + 40, H - 21, UI.ink); if (t.heal) text('HEALS', tx + 6, H - 12, UI.green); else if (t.burn) text('BURNS', tx + 6, H - 12, UI.red); else { const mc = moveCost(t, ref); text(mc >= 99 ? 'NO ENTRY' : 'MOVE ' + mc, tx + 6, H - 12, UI.muted); }
    const showUnit = hov && !(BT.mode === 'menu'); if (showUnit) drawUnitCard(hov, onRight ? 4 : W - 140, H - 46);
  }
  if (BT.mode === 'move' && BT.sel) { const c = BT.sel; textC(c.name + '  MOV ' + effMov(c) + (BT.path.length > 1 ? '  →' + (BT.path.length - 1) : ''), W / 2, 6, UI.ink, { outline: UI.shadow }); }
  if (BT.quip && BT.quip.unit.hp > 0) { const u = BT.quip.unit; const x = tileX(u.x) + TILE / 2 + 16, y = tileY(u.y) - 12 - Math.min(6, BT.quip.t * 30); const tw = textWidth(BT.quip.text) + 8; rrect(x - 2, y - 2, tw, 11, UI.shadow, 1); rrect(x - 3, y - 3, tw, 11, '#ffffff', 1); text(BT.quip.text, x + 1, y - 1, '#202030'); px(x, y + 8, '#ffffff'); px(x - 1, y + 9, '#ffffff'); }
  if (BT.mode === 'menu' || BT.mode === 'item' || BT.mode === 'endmenu' || BT.mode === 'ballPick') drawMenu();
  if (BT.mode === 'target') drawForecast();
  if (BT.mode === 'catchTarget') drawCatchCard();
  if (BT.mode === 'itemTarget') { panel(W / 2 - 70, H / 2 - 16, 140, 32); textC('Use ' + ITEMS[BT.item].name + ' on ' + BT.sel.name + '?', W / 2, H / 2 - 10, UI.ink); textC('OK to confirm · X to cancel', W / 2, H / 2 + 1, UI.muted); }
  if (BT.mode === 'unitinfo' && BT.info) drawUnitSheet(BT.info);
  if (BT.mode === 'help') drawHelp();
  if (BT.mode === 'banner') drawBanner();
  if (BT.mode === 'anim' && BT.anim && BT.anim.kind === 'event') drawEventCard(BT.anim);
  if (BT.mode === 'anim' && BT.anim && BT.anim.kind === 'strike') drawDuelCard(BT.anim);
  if (BT.mode === 'anim' && BT.anim && BT.anim.kind === 'msg') { panel(W / 2 - 80, 30, 160, 20); textC(BT.anim.text, W / 2, 36, UI.ink); }
  // bottom-right buttons (touch-friendly)
  if (BT.mode === 'idle') { button(W - 62, 4, 58, 14, 'END TURN', () => { Audio.sfx('ok'); endTurn(); }, { col: '#7a3030' }); button(W - 62, 20, 58, 14, BT.showDanger ? 'DANGER ●' : 'DANGER ○', () => { BT.showDanger = !BT.showDanger; Audio.sfx('menu'); }); button(W - 62, 36, 28, 14, 'HELP', () => { BT.mode = 'help'; BT.helpPage = 0; Audio.sfx('menu'); }); button(W - 32, 36, 28, 14, Audio.muted ? '♪ ○' : '♪ ●', () => { Audio.toggle(); Audio.sfx('menu'); }); }
  if (BT.mode === 'anim' && B.phase !== 0) { textC('ENEMY PHASE' + (BT.fast ? ' · FAST' : ''), W / 2, 6, UI.red, { outline: UI.shadow }); button(W - 46, 4, 42, 14, BT.fast ? 'FAST ●' : 'FAST ○', () => { BT.fast = !BT.fast; }); }
  if (BT.mode === 'move' || BT.mode === 'target' || BT.mode === 'catchTarget' || BT.mode === 'menu') { button(W - 46, 4, 42, 14, 'BACK', () => cancel(), { col: '#5a4a30' }); }
}
function drawUnitCard(u, x, y) {
  const w = 136; panel(x, y, w, 42);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 3, 40, 36); ctx.clip(); portraitBg(x + 3, y + 3, 40, 36, u.team); drawMon(u.num, x + 23, y + 36, { flip: u.team !== 0 }); ctx.restore();
  text(u.name, x + 46, y + 5, UI.ink); textR('Lv' + u.level, x + w - 5, y + 5, UI.gold);
  hpBar(x + 46, y + 15, w - 52, u.hp, u.maxHp); text(u.hp + '/' + u.maxHp, x + 46, y + 22, UI.ink);
  u.types.forEach((t, i) => typeBadge(t, x + 46 + i * 26, y + 31, 24)); if (u.status) statusBadge(u.status, x + w - 20, y + 22);
  if (u.boss) text('BOSS', x + w - 28, y + 31, UI.red);
}
function menuRect() { const m = BT.menu; const w = 108, h = m.items.length * 13 + 8; let x = tileX(BT.cx) + TILE + 6, y = tileY(BT.cy) - 4; if (BT.mode === 'endmenu') { x = VIEW.w / 2 - w / 2; y = VIEW.h / 2 - h / 2; } if (x + w > VIEW.w - 4) x = tileX(BT.cx) - w - 6; if (x < 4) x = 4; y = clamp(y, 30, VIEW.h - h - 4); return { x, y, w, h }; }
function menuHit(px2, py) { const r = menuRect(); if (px2 < r.x || px2 >= r.x + r.w || py < r.y || py >= r.y + r.h) return -1; return clamp(Math.floor((py - r.y - 4) / 13), 0, BT.menu.items.length - 1); }
function drawMenu() {
  const m = BT.menu, r = menuRect(); panel(r.x, r.y, r.w, r.h, { title: BT.mode === 'item' ? 'BAG' : BT.mode === 'ballPick' ? 'BALLS' : BT.mode === 'endmenu' ? 'MENU' : null });
  m.items.forEach((it, i) => { const y = r.y + 4 + i * 13; if (i === m.i) { rrect(r.x + 3, y - 1, r.w - 6, 12, UI.menuSel, 1); pointerHand(r.x + 5, y + 1, BT.time * 1000); } text(it.label, r.x + 16, y + 2, i === m.i ? UI.hi : UI.ink); });
  const it = m.items[m.i]; if (it && it.sub) { const sw = textWidth(it.sub) + 10; const sx = clamp(r.x, 2, VIEW.w - sw - 2); panel(sx, r.y + r.h + 3, sw, 13, { fill: UI.panelDark }); text(it.sub, sx + 5, r.y + r.h + 6, UI.muted); }
}
function forecastRect() { const w = 184, h = 78; const left = BT.cx * TILE - CAM.x > VIEW.w / 2; return { x: left ? 6 : VIEW.w - w - 6, y: 32, w, h }; }
function forecastHit(x, y) { const r = forecastRect(); return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h - 14; }
function moveSwitchHit(x, y) { const r = forecastRect(); return x >= r.x && y >= r.y + r.h - 14 && x < r.x + r.w && y < r.y + r.h + 4; }
function drawForecast() {
  const cf = currentForecast(); if (!cf) return; const { fc, move, moves, target } = cf; const r = forecastRect(); const u = BT.sel;
  panel(r.x, r.y, r.w, r.h, { title: 'FORECAST' });
  const col = (side, x, unit, flip) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, r.y + 6, 40, 30); ctx.clip(); portraitBg(x, r.y + 6, 40, 30, unit.team); drawMon(unit.num, x + 20, r.y + 36, { flip }); ctx.restore();
    text(unit.name, x, r.y + 38, UI.ink); hpBar(x, r.y + 47, 40, unit.hp, unit.maxHp);
    const after = side ? Math.max(0, unit.hp - side.dmg * (side.dbl ? 2 : 1)) : unit.hp;
  };
  col(fc.c, r.x + 6, u, false); col(fc.a, r.x + r.w - 46, target, true);
  // centre stats: MOVE / DMG / HIT / CRIT
  const cx = r.x + r.w / 2; const a = fc.a, c = fc.c;
  const rows = [['HP', u.hp + '→' + Math.max(0, u.hp - (c ? c.dmg * (c.dbl ? 2 : 1) * (c.hit > 0 ? 1 : 0) : 0)), target.hp + '→' + Math.max(0, target.hp - a.dmg * (a.dbl ? 2 : 1))], ['DMG', a.dmg + (a.dbl ? '×2' : ''), c ? c.dmg + (c.dbl ? '×2' : '') : '—'], ['HIT', a.hit + '%', c ? c.hit + '%' : '—'], ['CRT', a.crit + '%', c ? c.crit + '%' : '—']];
  rows.forEach((row, i) => { const y = r.y + 8 + i * 9; textC(row[0], cx, y, UI.muted); textR(row[1], cx - 13, y, i === 0 ? UI.green : UI.ink); text(row[2], cx + 13, y, i === 0 ? UI.red : UI.ink); });
  const el = effLabel(a.eff); if (el) textC(el, cx, r.y + 45, a.eff > 1 ? UI.gold : '#a0d0ff');
  if (!c) textC('no counter', cx, r.y + 45 + (el ? 9 : 0), UI.muted); else if (c.eff > 1) textC('counter: ' + effLabel(c.eff), cx, r.y + 45 + (el ? 9 : 0), '#ffa0a0');
  // move selector (bottom)
  rrect(r.x + 3, r.y + r.h - 14, r.w - 6, 11, UI.panelDark, 1); typeBadge(move.type, r.x + 5, r.y + r.h - 13, 24); text(move.name + '  ' + move.pow + 'pw  rng ' + move.rng[0] + (move.rng[1] > move.rng[0] ? '-' + move.rng[1] : ''), r.x + 32, r.y + r.h - 12, UI.ink); if (moves.length > 1) textR('C ▸', r.x + r.w - 5, r.y + r.h - 12, UI.gold);
  textC('OK: attack  ·  X: back' + (moves.length > 1 ? '  ·  C: move' : ''), r.x + r.w / 2, r.y + r.h + 4, UI.muted, { outline: UI.shadow });
}
function drawCatchCard() {
  const t = BT.targets[BT.tIdx]; if (!t) return; const r = forecastRect(); panel(r.x, r.y, r.w, 50, { title: 'CATCH' });
  drawMon(t.num, r.x + 24, r.y + 36, { flip: true }); text(t.name + '  Lv' + t.level, r.x + 48, r.y + 8, UI.ink); hpBar(r.x + 48, r.y + 18, r.w - 56, t.hp, t.maxHp); text(t.hp + '/' + t.maxHp + ' HP', r.x + 48, r.y + 26, UI.ink);
  const p = clamp(.22 + .68 * (1 - t.hp / t.maxHp), .05, .97); text('Base chance ' + Math.round(p * 100) + '%', r.x + 48, r.y + 36, p > .6 ? UI.green : p > .35 ? UI.gold : UI.red);
  textC('OK: pick a ball  ·  X: back', r.x + r.w / 2, r.y + 54, UI.muted, { outline: UI.shadow });
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
  if (e.type === 'levelup') { const u = e.unit; const w = 176, h = 70, x = W / 2 - w / 2; const uy = tileY(u.y); const y = uy < H / 2 ? Math.min(H - h - 8, uy + TILE + 10) : Math.max(28, uy - h - 12); const k = Math.min(1, q.t / .25); const yy = y + (1 - easeOut(k)) * -20; panel(x, yy, w, h, { title: 'LEVEL UP!' }); drawMon(u.num, x + 26, yy + 40, {}); bigText('LV ' + e.level, x + 50, yy + 8, UI.gold, { outline: '#402000' }); const g = e.gains; const stats = [['HP', g.maxHp], ['ATK', g.atk], ['DEF', g.def], ['SPA', g.spa], ['SPD', g.spd], ['SPE', g.spe]]; stats.forEach((s, i) => { const sx = x + 50 + (i % 3) * 40, sy = yy + 24 + Math.floor(i / 3) * 12; const showAt = .3 + i * .12; if (q.t > showAt) { text(s[0], sx, sy, UI.muted); text((s[1] >= 0 ? '+' : '') + s[1], sx + 20, sy, s[1] > 0 ? UI.green : UI.ink); } }); if (q.t > 1.1) { const nm = u.moves.map(m => m.name); text('Moves: ' + nm.join(', ').slice(0, 34), x + 6, yy + 52, UI.ink); } }
  if (e.type === 'evolve') { const k = q.t / q.dur; const w = 160, x = W / 2 - w / 2, y = 30; panel(x, y, w, 20); textC(k < .5 ? 'What? ' + e.from.name + ' is evolving!' : e.from.name + ' evolved into ' + e.to.name + '!', W / 2, y + 6, k < .5 ? UI.ink : UI.gold); if (k > .15 && k < .8 && Math.floor(q.t * 14) % 2) { ctx.globalAlpha = .25; rect(0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; } }
  if (e.type === 'capture' && q.t > q.dur - .8 && e.ok) { const w = 150, x = W / 2 - w / 2, y = 30; panel(x, y, w, 20); textC(e.unit.name + ' was caught!', W / 2, y + 6, UI.gold); }
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
function drawUnitSheet(u) {
  const W = VIEW.w, H = VIEW.h; const w = Math.min(260, W - 12), h = 118; const x = W / 2 - w / 2, y = H / 2 - h / 2; panel(x, y, w, h, { title: u.team === 0 ? 'YOUR POKÉMON' : u.team === 2 ? 'WILD POKÉMON' : u.team === 3 ? 'ALLY' : 'ENEMY' });
  portraitBg(x + 6, y + 8, 48, 40, u.team); drawMon(u.num, x + 30, y + 44, { flip: u.team !== 0, sy: 1 + Math.sin(BT.time * 4) * .03 });
  text(u.name, x + 60, y + 8, UI.ink); textR('Lv' + u.level + (u.team === 0 ? '  ' + u.xp + '/100xp' : ''), x + w - 6, y + 8, UI.gold); if (u.boss) text('BOSS', x + 60 + textWidth(u.name) + 6, y + 8, UI.red);
  u.types.forEach((t, i) => typeBadge(t, x + 60 + i * 26, y + 18, 24)); if (u.status) statusBadge(u.status, x + w - 22, y + 18);
  hpBar(x + 60, y + 30, w - 66, u.hp, u.maxHp); text('HP ' + u.hp + '/' + u.maxHp, x + 60, y + 37, UI.ink);
  const stats = [['ATK', u.atk], ['DEF', u.def], ['SPA', u.spa], ['SPD', u.spd], ['SPE', u.spe], ['MOV', effMov(u)]]; stats.forEach((s, i) => { const sx = x + 6 + (i % 3) * 44, sy = y + 54 + Math.floor(i / 3) * 10; text(s[0], sx, sy, UI.muted); textR(String(s[1]), sx + 38, sy, UI.ink); });
  const traits = []; if (u.fly) traits.push('FLIES'); if (u.swim) traits.push('SWIMS'); if (u.climb) traits.push('CLIMBS'); if (u.forester) traits.push('WOODS'); text(traits.join(' · '), x + 140, y + 54, UI.green);
  text('Moves', x + 140, y + 64, UI.muted); u.moves.slice(0, 3).forEach((m, i) => { typeBadge(m.type, x + 140, y + 73 + i * 10, 24); text(m.name + ' ' + m.pow + (m.rng[1] > 1 ? ' R' + m.rng[0] + '-' + m.rng[1] : ''), x + 169, y + 74 + i * 10, UI.ink); });
  const ev = u.dex.evos.length && u.team === 0 ? 'Evolves at Lv' + Math.min(...u.dex.evos.map(e => e[1])) : ''; text(ev, x + 6, y + 76, '#98d8f8');
  // type matchup hints
  const weak = TYPES.filter(t => effRaw(t, u.types) >= 2).slice(0, 4), res = TYPES.filter(t => effRaw(t, u.types) < 1).slice(0, 4);
  text('Weak:', x + 6, y + 88, UI.muted); weak.forEach((t, i) => typeBadge(t, x + 36 + i * 25, y + 87, 24)); text('Resist:', x + 6, y + 99, UI.muted); res.forEach((t, i) => typeBadge(t, x + 36 + i * 25, y + 98, 24));
  textC('◂ ▸ browse  ·  X close', W / 2, y + h + 4, UI.muted, { outline: UI.shadow });
}
function drawHelp() {
  const W = VIEW.w, H = VIEW.h; const w = Math.min(280, W - 12), h = 124; const x = W / 2 - w / 2, y = H / 2 - h / 2; panel(x, y, w, h, { title: 'HELP ' + (BT.helpPage + 1) + '/3' });
  const pages = [
    ['CONTROLS', 'Arrows/WASD: cursor · Z/Enter/Space: OK · X/Esc: back', 'Mouse: hover + click. Right click or empty tile: menu', 'Touch: tap to move the cursor, tap again to confirm', 'Q/E: next unit · C: unit info / switch move · F: fast', 'Drag or wheel to pan · M: mute · H: this help'],
    ['RULES', 'Pick a unit, walk the yellow arrow, then Attack, Catch,', 'use the Bag or Wait. Blue = move, red = attack.', 'Defenders counter if you are in their move range.', 'Speed 8+ higher than the foe = you strike twice (×2).', 'Terrain gives DEF% and AVO. Poké Centers heal 30%/turn.'],
    ['TYPES & CATCHING', 'Super effective ×1.5 (×2.25 double), resisted ×0.67.', 'STAB: a move of your own type deals +25%.', 'Burn halves ATK, Poison ticks, Paralysis cuts MOV,', 'Frozen skips turns and crits are guaranteed on it.', 'Wild (yellow) Pokémon can be caught when weak: stand', 'next to them, choose Catch and throw a ball. Trainer', 'Pokémon (red) cannot be stolen. Level ups can evolve!'],
  ];
  const p = pages[BT.helpPage]; text(p[0], x + 8, y + 8, UI.gold); p.slice(1).forEach((l, i) => text(l, x + 8, y + 20 + i * 11, UI.ink)); textC('click / OK: next page', W / 2, y + h - 12, UI.muted);
}
function drawEndScreen() {
  const W = VIEW.w, H = VIEW.h; const k = Math.min(1, BT.endTimer / .6); const win = B.result === 'win';
  ctx.globalAlpha = .6 * k; rect(0, 0, W, H, '#000'); ctx.globalAlpha = 1;
  const y = H / 2 - 30 + (1 - easeOut(k)) * -30; panel(W / 2 - 100, y, 200, 60, { fill: win ? '#1c3a2a' : '#3a1c1c' });
  bigC(win ? 'VICTORY!' : B.result === 'retreat' ? 'RETREAT' : 'DEFEAT...', W / 2, y + 10, win ? UI.gold : '#ff8080', { outline: '#000' });
  if (win) { text('Turns: ' + B.turn + '   KOs: ' + B.kills + '   Caught: ' + B.captured.length, W / 2 - 90, y + 32, UI.ink); if (B.turn <= (B.map.par || 8)) textC('★ Speedy! Under par ' + (B.map.par || 8), W / 2, y + 44, UI.gold); else textC('Par: ' + (B.map.par || 8) + ' turns', W / 2, y + 44, UI.muted); }
  else textC(B.result === 'retreat' ? 'Your team runs back to the Poké Center.' : 'Everyone fainted. Try a different plan!', W / 2, y + 36, UI.ink);
  if (BT.endTimer > 1.2) textC(VIEW.touch ? 'tap to continue' : 'press OK', W / 2, y + 66, UI.muted, { outline: UI.shadow });
  if (win && k >= 1 && Math.random() < .25) spawnParts(vrnd() * W + CAM.x, CAM.y - 5, 1, ['#ffd24a', '#5ee06a', '#3d7dff', '#ff5a5a', '#ffffff'], { speed: 10, vy: 40, life: 2.5, grav: 20, size: 3 });
}
