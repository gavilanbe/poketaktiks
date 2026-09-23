#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { loadGame } = require('./model-tests.cjs');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const json = x => JSON.stringify(x);
function fresh() { const T = loadGame(); T.g.launchTerritory(7, true); return T; }
function ownTick(T, team) { T.B().phase = team; T.g.upkeep(team); T.g.warUpkeep(team); }
// Conquest's five properties by name (the war rules list them in map order)
const prop = (T, name) => T.B().war.props.find(p => p.name === name);
function textHook(T) {
  T.G(`var __textBoxes=[],__matrix=[1,1,0,0],__matrixStack=[];ctx.save=()=>__matrixStack.push(__matrix.slice());ctx.restore=()=>{__matrix=__matrixStack.pop()||[1,1,0,0];};ctx.translate=(x,y)=>{__matrix[2]+=__matrix[0]*x;__matrix[3]+=__matrix[1]*y;};ctx.scale=(x,y)=>{__matrix[0]*=x;__matrix[1]*=y;};text=(s,x,y,c,o={})=>{const w=textWidth(s,o.font||FONT);__textBoxes.push({text:String(s),x:x*__matrix[0]+__matrix[2],y:y*__matrix[1]+__matrix[3],w:w*__matrix[0]});return w;};`);
  return () => T.G('__textBoxes');
}

test('territory roster and terrain are symmetric and growth is fixed', () => {
  const T = fresh(), { g } = T, B = T.B();
  assert.equal(B.units.length, 6); assert.equal(B.map.w, 15); assert.equal(B.map.h, 11);
  for (const u of g.alive(0)) { const v = g.alive(1).find(v => v.num === u.num); for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'mov']) assert.equal(u[k], v[k]); }
  const sq = g.alive(0).find(u => u.num === 7), geo = g.alive(0).find(u => u.num === 74);
  assert.equal(g.moveCost(g.terrAt(7, 4), sq), 1); assert.equal(g.moveCost(g.terrAt(7, 4), geo), 99);
  assert.equal(g.terrainDef(g.terrAt(7, 4), sq), 20);
  const ev = []; g.awardXp(sq, 200, ev); assert.equal(sq.level, 12); assert.equal(sq.xp, 0); assert.equal(ev.length, 0);
  assert.equal(g.warMiddleHeld(0), 0); assert.equal(g.warIncome(0), 1000, 'the HQ pays ₽1000 a day');
});
test('capture consumes actions, slows with damage and interrupts on leaving or fainting', () => {
  const T = fresh(), { g } = T, B = T.B(), u = g.alive(0)[0], p = prop(T, 'NORTH');
  u.x = p.x; u.y = p.y; const money = B.war.funds[0];
  let e = g.warCapture(u); assert(e && !e.done); assert.equal(p.progress, 10); assert(u.acted);
  assert.equal(g.warCapture(u), null); assert.equal(p.progress, 10);
  g.upkeep(0); e = g.warCapture(u); assert(e.done); assert.equal(p.owner, 0); assert.equal(B.war.funds[0], money, 'capture grants no immediate income');
  const south = prop(T, 'SOUTH'); u.x = south.x; u.y = south.y; u.acted = false; u.hp = Math.ceil(u.maxHp / 2);
  e = g.warCapture(u); assert(e.progress < 10 && e.progress >= 5);
  u.x--; g.warSettle(); assert.equal(south.progress, 0);
  u.x++; u.acted = false; g.warCapture(u); u.hp = 0; g.warSettle(); assert.equal(south.progress, 0);
  const entry = B.war.box[0].find(e => e.unitId === u.id); assert.equal(entry.state, 'box', 'a fainted Pokémon goes back to the Box'); assert.equal(entry.recovery, 2);
});
test('real phase starts grant income once, and resume preserves money, timers, roster and RNG', () => {
  const T = fresh(), { g, G } = T; g.beginPhase(0, true); let B = T.B(); assert.equal(B.war.funds[0], 3000, '₽2000 to start, ₽1000 from the HQ');
  g.warUpkeep(0); assert.equal(B.war.funds[0], 3000);
  g.beginPhase(1, false); g.beginPhase(0, false); assert.equal(B.turn, 2); assert.equal(B.war.funds[0], 4000, 'second player phase receives income');
  const u = g.alive(0)[0]; u.root = 1; u.cd = 1;
  const p = prop(T, 'NORTH'); p.captor = u.id; p.progress = 7; u.x = p.x; u.y = p.y;
  g.saveSuspend(); const state = json(B.war), roll = G('rnd()');
  g.resumeSuspend(); B = T.B(); assert.equal(json(B.war), state); assert.equal(G('rnd()'), roll, 'next gameplay roll preserved');
  const restored = B.units.find(v => v.id === u.id); assert.equal(restored.root, 1); assert.equal(restored.cd, 1);
  for (const team of [0, 1]) for (const e of B.war.box[team]) if (e.state === 'field') assert(B.units.some(u => u.id === e.unitId && u.team === team));
});
test('owned centers heal/cure only their own team, including predicted danger cures', () => {
  const T = fresh(), { g } = T, u = g.alive(0)[0]; u.x = 13; u.y = 5; u.hp = 10; u.status = 'psn'; u.root = 2;
  assert.equal(g.statusAfterUpkeep(u), 'psn'); assert.equal(g.rootAfterUpkeep(u), 1);
  g.upkeep(0); assert(u.hp < 10); assert.equal(u.status, 'psn'); assert.equal(u.root, 1);
  u.x = 1; u.hp = 10; assert.equal(g.statusAfterUpkeep(u), null); g.upkeep(0); assert(u.hp > 10); assert.equal(u.status, null); assert.equal(u.root, 0);
});
test('deployment checks owner, phase, occupancy, cost, active cap and finite recovery', () => {
  const T = fresh(), { g } = T, B = T.B(), W = B.war, hq = prop(T, 'WEST HQ'); W.funds[0] = 30000;
  const cost = W.box[0][3].cost; assert.equal(cost, g.warCost(W.box[0][3].num, 12)); assert(cost >= 1000 && cost % 100 === 0);
  assert(g.warDeployBlock(0, 3, prop(T, 'NORTH')), 'a neutral center cannot deploy');
  const u = g.warDeploy(0, 3, hq); assert(u && u.acted); assert.equal(W.funds[0], 30000 - cost); assert.equal(W.box[0][3].unitId, u.id); assert.equal(W.box[0][3].state, 'field');
  assert.equal(g.warDeploy(0, 3, hq), null); assert.equal(g.warDeploy(0, 4, hq), null);
  hq.owner = 1; assert(g.warDeployBlock(0, 4, hq)); hq.owner = 0;
  const p = prop(T, 'NORTH'); p.owner = 0; const a = g.warDeploy(0, 4, p); assert(a); prop(T, 'SOUTH').owner = 0;
  assert.equal(g.warDeployBlock(0, 5, prop(T, 'SOUTH')), '5 on the map already');
  u.hp = 0; g.warSettle(); assert.equal(W.box[0][3].recovery, 2); assert.equal(W.box[0][3].state, 'box');
  W.funds[0] = 0; assert(g.warDeployBlock(0, 5, hq));
  B.turn++; ownTick(T, 0); assert.equal(W.box[0][3].recovery, 1); g.warUpkeep(0); assert.equal(W.box[0][3].recovery, 1);
  B.turn++; ownTick(T, 0); assert.equal(W.box[0][3].recovery, 0); const again = g.warDeploy(0, 3, hq); assert(again && again.id === u.id && again.hp === again.maxHp, 'the same Pokémon comes back at full HP');
  B.phase = 1; assert(g.warDeployBlock(0, 5, prop(T, 'SOUTH')));
  assert.equal(new Set(B.units.map(u => u.id)).size, B.units.length);
});
test('HQ, held-majority, interruption and turn-limit results are explicit; reserves prevent premature defeat', () => {
  let T = fresh(), B = T.B(); for (const u of T.g.alive(1)) u.hp = 0; assert.equal(T.g.checkObjective(), null);
  T.g.nextPhase(); assert.equal(B.phase, 1, 'empty enemy field still gets a phase'); assert.equal(B.war.box[1][0].recovery, 1);
  prop(T, 'EAST HQ').owner = 0; assert.equal(T.g.checkObjective(), 'win');
  T = fresh(); B = T.B(); prop(T, 'NORTH').owner = prop(T, 'BRIDGE').owner = 0;
  ownTick(T, 0); assert.equal(B.war.hold.count[0], 1); B.turn++; ownTick(T, 0); assert.equal(B.war.hold.count[0], 2);
  prop(T, 'NORTH').owner = 1; T.g.warSettle(); assert.equal(B.war.hold.count[0], 0);
  prop(T, 'NORTH').owner = 0; for (let i = 0; i < 3; i++) { B.turn++; ownTick(T, 0); } assert.equal(T.g.checkObjective(), 'win');
  T = fresh(); B = T.B(); B.turn = 41; assert.equal(T.g.checkObjective(), 'draw');
  T = fresh(); B = T.B(); B.turn = 41; prop(T, 'NORTH').owner = 1; assert.equal(T.g.checkObjective(), 'lose');
});
test('spent/empty player phases stay open for reserves; move cancel preserves capture progress', () => {
  const T = fresh(), { g, G } = T, B = T.B(), BT = G('BT'); ownTick(T, 0); BT.mode = 'idle';
  for (const u of g.alive(0)) u.acted = true;
  for (let i = 0; i < 90; i++) g.battleUpdate(1 / 60); assert.equal(B.phase, 0); assert(!BT.autoEnd);
  g.openDeployMenu(prop(T, 'WEST HQ')); BT.menu.i = 3; g.activateMenu(); assert.equal(B.war.box[0][3].state, 'field', 'the PC deploys the chosen Pokémon');
  const u = g.alive(0)[0], p = prop(T, 'NORTH'); u.x = p.x; u.y = p.y; u.acted = false; g.warCapture(u); u.acted = false;
  g.selectUnit(u); BT.undo = { unit: u, x: u.x, y: u.y }; u.x--; g.openActionMenu(u); g.cancel(); assert.equal(u.x, p.x); assert.equal(p.progress, 10);
});
test('territory setup, HUD, reserve menu and results text/controls fit phone and landscape views', () => {
  for (const [w, h] of [[180, 390], [195, 422], [422, 195], [512, 288], [640, 360]]) {
    for (const scene of ['setup', 'hud', 'reserves', 'results']) {
      const T = fresh(), { g, G } = T; G(`VIEW.w=${w};VIEW.h=${h};`); const boxes = textHook(T);
      if (scene === 'setup') { g.startTerritorySetup(); g.territorySetupDraw(); }
      if (scene === 'hud') { G("BT.mode='idle';BT.cx=1;BT.cy=5;B.units[0].x=1;B.units[0].y=5;"); g.drawHUD(); }
      if (scene === 'reserves') { g.openDeployMenu(prop(T, 'WEST HQ')); g.drawHUD(); }
      if (scene === 'results') { g.goScene('territoryResults', { result: 'lose', reason: 'Enemy held two centers for three turns', turn: 14, centers: [2, 1], deployments: [5, 4], seed: 7 }); g.territoryResultsDraw(); }
      const bad = boxes().filter(b => b.x < -1 || b.x + b.w > w + 1 || b.y < -1 || b.y + 7 > h + 1);
      assert.equal(bad.length, 0, w + 'x' + h + ' ' + scene + ': ' + json(bad));
      if (scene === 'setup') for (const [i, a] of boxes().entries()) for (const b of boxes().slice(i + 1)) assert(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + 7 && b.y < a.y + 7), 'setup text overlaps: ' + json([a, b]));
      const controls = G(scene === 'setup' || scene === 'results' ? 'SC.hits' : 'HUD.hits');
      for (const b of controls) assert(b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h, scene + ': control outside view');
    }
  }
});
test('fixed-seed matches complete with legal movement, capture, skills and deployment on both sides', () => {
  for (const seed of [3, 7, 19]) {
    const T = fresh(), r = T.g.simTerritory(seed);
    assert(['win', 'lose', 'draw'].includes(r.result), json(r)); assert(r.turn <= 41); assert(r.captures[0] && r.captures[1]); assert(r.deployments[0] && r.deployments[1]);
    assert(r.actions.some(a => a.kind === 'attack')); assert(r.actions.some(a => a.kind === 'capture'));
    for (const team of [0, 1]) { assert(T.g.alive(team).length <= 5); assert(T.B().war.funds[team] >= 0); }
    console.log('       seed ' + seed + ': ' + r.result + ' turn ' + r.turn + ', ' + r.reason);
  }
});
test('war rules outside Conquest: campaign centers, catches to the Box with a free deploy, bought balls, tall-grass spawns', () => {
  const { place } = require('./model-tests.cjs');
  const T = loadGame(), { g, G } = T;
  g.startBattle({ name: 'war', seed: 3, rows: ['C.....', '..tttt', '..tttt', '......'], deploy: [{ x: 1, y: 0 }], units: [{ mon: 16, level: 3, team: 2, x: 5, y: 3 }, { mon: 19, level: 3, team: 1, x: 5, y: 0 }], objective: { type: 'rout' } }, [g.partyUnit(7, 8)], { pokeball: 0 }, { defer: true, seed: 5 });
  const B = T.B(), W = B.war, pc = W.props[0];
  assert.equal(pc.owner, 0, 'a campaign center belongs to the player'); assert.equal(W.box[0].length, 1, 'the deployed partner is in the Box'); assert.equal(W.box[0][0].state, 'field');
  assert(B.wild && B.wild.pool.length === 1 && B.wild.cap === 2, 'wild pool from the map');
  // catching with no ball left buys one; the catch lands in the Box, fresh: its first deployment is free
  const sq = g.alive(0)[0], wild = g.alive(2)[0]; sq.x = 4; sq.y = 3; wild.hp = 1; W.funds[0] = 600; B.phase = 0; G('rnd = () => 0.01');
  const BT = G('BT'); BT.sel = sq; BT.targets = [wild]; BT.tIdx = 0; BT.ball = 'pokeball'; g.confirmCatch(); assert.equal(W.funds[0], 100, 'a ball bought for ₽500');
  while (BT.queue.length || BT.anim) { g.nextAnim(); } assert(wild.captured, 'caught'); const e = W.box[0].find(x => x.num === 16); assert(e && e.fresh && e.state === 'box');
  assert.equal(g.warDeployBlock(0, W.box[0].indexOf(e), pc), null, 'free even with ₽100'); const u = g.warDeploy(0, W.box[0].indexOf(e), pc); assert(u && u.team === 0 && u.num === 16); assert.equal(W.funds[0], 100);
  // tall grass spawns: at most the cap, never next to anyone
  G('rnd = () => 0.01'); const spawned = g.wildSpawn(); assert.equal(spawned.length, 1); const s0 = spawned[0]; assert.equal(B.map.tiles[s0.y][s0.x].id, 'tall'); assert(B.units.every(v => v === s0 || v.hp <= 0 || g.dist(v, s0) > 2));
  g.wildSpawn(); assert(g.alive(2).length <= 2, 'the cap holds'); G('rnd = () => 0.99'); const before = g.alive(2).length; g.wildSpawn(); assert.equal(g.alive(2).length, before, 'no spawn on a failed roll');
});
test('Skirmish battlefields: HQ vs HQ with point-symmetric centers, Box-owned squads and Aces, deployed Pokémon that roam, a full war', () => {
  for (const seed of [3, 42, 77]) {
    const T = loadGame(), { g } = T, map = g.skirmishMap(seed, 16, 11, 14, { foe: 'brock' }), ry = map.rows.findIndex(r => r[1] === 'Q');
    const props = []; map.rows.forEach((r, y) => [...r].forEach((c, x) => { if ('QCK'.includes(c)) props.push({ x, y, c }); }));
    assert.equal(props.filter(p => p.c === 'Q').length, 2); assert.equal(props.filter(p => p.c === 'C').length, 4);
    for (const p of props) assert(props.some(q => q.c === p.c && q.x === 15 - p.x && q.y === 2 * ry - p.y), 'mirror of ' + json(p));
    assert.equal(map.objective.type, 'war'); assert(map.units.filter(u => u.team == null).every(u => u.box && u.ai === 'aggro'));
    const party = [4, 16, 25, 7, 1, 74].map((n, i) => Object.assign(g.partyUnit(n, 14), { pid: i }));
    g.startBattle(map, party.slice(0, 4), {}, { skirmish: true, seed: 9, defer: true, cos: ['you', 'brock'], box: party.slice(4), box2: g.coTeam('brock', 14, 8, 2), war: { funds: [1000, 1000] }, captain: { pid: 0, root: 4, chapter: 8 } });
    const B = T.B(), W = B.war, owner = (x, y) => W.props.find(p => p.x === x && p.y === y).owner;
    assert.equal(owner(1, ry), 0); assert.equal(owner(14, ry), 1); assert.deepEqual(W.props.filter(p => p.kind === 'center').map(p => p.owner).sort(), [-1, -1, 0, 1]);
    const ace = g.alive(1).find(u => u.num === 95); assert(ace && ace.leader, 'Onix leads Brock\'s side');
    assert.equal(W.box[1].length, 12, 'squad, Ace and army'); assert(W.box[1].some(e => e.unitId === ace.id && e.state === 'field'), 'the Ace comes back through the Box');
    assert.equal(W.box[0].length, 6);
    const grunt = g.alive(1).find(u => u !== ace); grunt.ai = 'war'; assert(g.warRoams(grunt), 'deployed Pokémon play the war');
    const r = g.simWar(40); assert(B.turn <= 41); assert(r.deployments[0] + r.deployments[1] > 0, json(r)); for (const t of [0, 1]) assert(W.funds[t] >= 0);
    if (r.result) assert(['win', 'lose', 'draw'].includes(r.result));
    console.log('       seed ' + seed + ': ' + (r.result || 'unfinished') + ' turn ' + r.turn + ', ' + (r.reason || 'rout'));
  }
});
let failed = 0;
for (const [name, fn] of tests) { try { fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.error('  FAIL ' + name + '\n' + e.stack); } }
console.log(`${tests.length - failed}/${tests.length} territory tests passed`); process.exitCode = failed ? 1 : 0;
