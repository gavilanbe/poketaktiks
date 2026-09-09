#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { loadGame } = require('./model-tests.cjs');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const json = x => JSON.stringify(x);
function fresh() { const T = loadGame(); T.g.launchTerritory(7, true); return T; }
function ownTick(T, team) { T.B().phase = team; T.g.upkeep(team); T.g.territoryUpkeep(team); }
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
  assert.equal(g.territoryControl(0), 0); assert.equal(g.territoryIncome(0), 2);
});
test('capture consumes actions, slows with damage and interrupts on leaving or fainting', () => {
  const T = fresh(), { g } = T, B = T.B(), u = g.alive(0)[0], p = B.territory.properties[2];
  u.x = p.x; u.y = p.y; const money = B.territory.points[0];
  let e = g.territoryCapture(u); assert(e && !e.done); assert.equal(p.progress, 10); assert(u.acted);
  assert.equal(g.territoryCapture(u), null); assert.equal(p.progress, 10);
  g.upkeep(0); e = g.territoryCapture(u); assert(e.done); assert.equal(p.owner, 0); assert.equal(B.territory.points[0], money, 'capture grants no immediate income');
  const south = B.territory.properties[4]; u.x = south.x; u.y = south.y; u.acted = false; u.hp = Math.ceil(u.maxHp / 2);
  e = g.territoryCapture(u); assert(e.progress < 10 && e.progress >= 5);
  u.x--; g.territorySettle(); assert.equal(south.progress, 0);
  u.x++; u.acted = false; g.territoryCapture(u); u.hp = 0; g.territorySettle(); assert.equal(south.progress, 0);
  assert.equal(B.territory.reserves[0][0].unitId, null); assert.equal(B.territory.reserves[0][0].recovery, 2);
});
test('real phase starts grant income once, and resume preserves money, timers, roster and RNG', () => {
  const T = fresh(), { g, G } = T; g.beginPhase(0, true); let B = T.B(); assert.equal(B.territory.points[0], 6);
  g.territoryUpkeep(0); assert.equal(B.territory.points[0], 6);
  g.beginPhase(1, false); g.beginPhase(0, false); assert.equal(B.turn, 2); assert.equal(B.territory.points[0], 8, 'second player phase receives income');
  const u = g.alive(0)[0]; u.root = 1; u.cd = 1;
  const p = B.territory.properties[2]; p.captor = u.id; p.progress = 7; u.x = p.x; u.y = p.y;
  g.saveSuspend(); const state = json(B.territory), roll = G('rnd()');
  g.resumeSuspend(); B = T.B(); assert.equal(json(B.territory), state); assert.equal(G('rnd()'), roll, 'next gameplay roll preserved');
  const restored = B.units.find(v => v.id === u.id); assert.equal(restored.root, 1); assert.equal(restored.cd, 1);
  for (const team of [0, 1]) for (const r of B.territory.reserves[team]) if (r.unitId != null) assert(B.units.some(u => u.id === r.unitId && u.team === team));
});
test('owned centers heal/cure only their own team, including predicted danger cures', () => {
  const T = fresh(), { g } = T, u = g.alive(0)[0]; u.x = 13; u.y = 5; u.hp = 10; u.status = 'psn'; u.root = 2;
  assert.equal(g.statusAfterUpkeep(u), 'psn'); assert.equal(g.rootAfterUpkeep(u), 1);
  g.upkeep(0); assert(u.hp < 10); assert.equal(u.status, 'psn'); assert.equal(u.root, 1);
  u.x = 1; u.hp = 10; assert.equal(g.statusAfterUpkeep(u), null); g.upkeep(0); assert(u.hp > 10); assert.equal(u.status, null); assert.equal(u.root, 0);
});
test('deployment checks owner, phase, occupancy, cost, active cap and finite recovery', () => {
  const T = fresh(), { g } = T, B = T.B(), S = B.territory, hq = S.properties[0]; S.points[0] = 30;
  assert(g.territoryDeployBlock(0, 3, S.properties[2]));
  const u = g.territoryDeploy(0, 3, hq); assert(u && u.acted); assert.equal(S.points[0], 27); assert.equal(S.reserves[0][3].unitId, u.id);
  assert.equal(g.territoryDeploy(0, 3, hq), null); assert.equal(g.territoryDeploy(0, 4, hq), null);
  hq.owner = 1; assert(g.territoryDeployBlock(0, 4, hq)); hq.owner = 0;
  const p = S.properties[2]; p.owner = 0; const a = g.territoryDeploy(0, 4, p); assert(a); S.properties[4].owner = 0;
  assert.equal(g.territoryDeployBlock(0, 5, S.properties[4]), 'five on map');
  u.hp = 0; g.territorySettle(); assert.equal(S.reserves[0][3].recovery, 2);
  S.points[0] = 0; assert(g.territoryDeployBlock(0, 5, hq));
  B.turn++; ownTick(T, 0); assert.equal(S.reserves[0][3].recovery, 1); g.territoryUpkeep(0); assert.equal(S.reserves[0][3].recovery, 1);
  B.turn++; ownTick(T, 0); assert.equal(S.reserves[0][3].recovery, 0); const again = g.territoryDeploy(0, 3, hq); assert(again && again.id !== u.id);
  B.phase = 1; assert(g.territoryDeployBlock(0, 5, S.properties[4]));
  assert.equal(new Set(B.units.map(u => u.id)).size, B.units.length);
});
test('HQ, held-majority, interruption and turn-limit results are explicit; reserves prevent premature defeat', () => {
  let T = fresh(), B = T.B(); for (const u of T.g.alive(1)) u.hp = 0; assert.equal(T.g.checkObjective(), null);
  T.g.nextPhase(); assert.equal(B.phase, 1, 'empty enemy field still gets a phase'); assert.equal(B.territory.reserves[1][0].recovery, 1);
  B.territory.properties[1].owner = 0; assert.equal(T.g.checkObjective(), 'win');
  T = fresh(); B = T.B(); B.territory.properties[2].owner = B.territory.properties[3].owner = 0;
  ownTick(T, 0); assert.equal(B.territory.hold[0], 1); B.turn++; ownTick(T, 0); assert.equal(B.territory.hold[0], 2);
  B.territory.properties[2].owner = 1; T.g.territorySettle(); assert.equal(B.territory.hold[0], 0);
  B.territory.properties[2].owner = 0; for (let i = 0; i < 3; i++) { B.turn++; ownTick(T, 0); } assert.equal(T.g.checkObjective(), 'win');
  T = fresh(); B = T.B(); B.turn = 41; assert.equal(T.g.checkObjective(), 'draw');
  T = fresh(); B = T.B(); B.turn = 41; B.territory.properties[2].owner = 1; assert.equal(T.g.checkObjective(), 'lose');
});
test('spent/empty player phases stay open for reserves; move cancel preserves capture progress', () => {
  const T = fresh(), { g, G } = T, B = T.B(), BT = G('BT'); ownTick(T, 0); BT.mode = 'idle';
  for (const u of g.alive(0)) u.acted = true;
  for (let i = 0; i < 90; i++) g.battleUpdate(1 / 60); assert.equal(B.phase, 0); assert(!BT.autoEnd);
  g.openTerritoryReserves(B.territory.properties[0]); BT.menu.i = 3; g.activateMenu(); assert.equal(B.territory.reserves[0][3].unitId != null, true);
  const u = g.alive(0)[0], p = B.territory.properties[2]; u.x = p.x; u.y = p.y; u.acted = false; g.territoryCapture(u); u.acted = false;
  g.selectUnit(u); BT.undo = { unit: u, x: u.x, y: u.y }; u.x--; g.openActionMenu(u); g.cancel(); assert.equal(u.x, p.x); assert.equal(p.progress, 10);
});
test('territory setup, HUD, reserve menu and results text/controls fit phone and landscape views', () => {
  for (const [w, h] of [[180, 390], [195, 422], [422, 195], [512, 288], [640, 360]]) {
    for (const scene of ['setup', 'hud', 'reserves', 'results']) {
      const T = fresh(), { g, G } = T; G(`VIEW.w=${w};VIEW.h=${h};`); const boxes = textHook(T);
      if (scene === 'setup') { g.startTerritorySetup(); g.territorySetupDraw(); }
      if (scene === 'hud') { G("BT.mode='idle';BT.cx=1;BT.cy=5;B.units[0].x=1;B.units[0].y=5;"); g.drawHUD(); }
      if (scene === 'reserves') { g.openTerritoryReserves(T.B().territory.properties[0]); g.drawHUD(); }
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
    for (const team of [0, 1]) { assert(T.g.alive(team).length <= 5); assert(T.B().territory.points[team] >= 0); }
    console.log('       seed ' + seed + ': ' + r.result + ' turn ' + r.turn + ', ' + r.reason);
  }
});
let failed = 0;
for (const [name, fn] of tests) { try { fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.error('  FAIL ' + name + '\n' + e.stack); } }
console.log(`${tests.length - failed}/${tests.length} territory tests passed`); process.exitCode = failed ? 1 : 0;
