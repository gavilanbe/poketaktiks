#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { loadGame, arena, place } = require('./model-tests.cjs');
const tests = [], test = (name, run) => tests.push([name, run]);
function textHook(T) {
  T.G(`var __boxes=[],__m=[1,1,0,0],__stack=[];ctx.save=()=>__stack.push(__m.slice());ctx.restore=()=>{__m=__stack.pop()||[1,1,0,0];};ctx.translate=(x,y)=>{__m[2]+=x*__m[0];__m[3]+=y*__m[1];};ctx.scale=(x,y)=>{__m[0]*=x;__m[1]*=y;};text=(s,x,y,c,o={})=>{const w=textWidth(s,o.font||FONT);__boxes.push({s:String(s),x:x*__m[0]+__m[2],y:y*__m[1]+__m[3],w:w*__m[0]});return w;};`);
  return () => T.G('__boxes');
}
test('nosave protects campaign and suspend writes/removals; ordinary saving still works', () => {
  const T = loadGame(), { g, G, store } = T;
  const save = JSON.stringify({ chapter: 0, party: [], bag: {}, stars: {} }), susp = JSON.stringify({ keep: true });
  store.set('pk_save', save); store.set('pk_suspend', susp); G("PARAMS.set('nosave','')");
  g.startNewGame(); g.pickStarter(4); g.writeSave(); g.clearSuspend(); g.launchTerritory(7, true); g.saveSuspend(); g.onBattleEnd('retreat');
  assert.equal(store.get('pk_save'), save); assert.equal(store.get('pk_suspend'), susp);
  G("PARAMS.delete('nosave')"); g.writeSave(); assert.notEqual(store.get('pk_save'), save); g.clearSuspend(); assert.equal(store.has('pk_suspend'), false);
  g.launchTerritory(7, true); g.beginPhase(0, true); assert(JSON.parse(store.get('pk_suspend')).territory);
});
test('human and AI freeze/paralysis use the same one-time phase action check and preserve it on resume', () => {
  for (const team of [0, 1]) {
    const T = loadGame(), { g, G } = T; arena(T); const u = place(T, 1, 12, team, 2, 2); place(T, 4, 12, 1 - team, 5, 2);
    u.status = 'frz'; G('rnd=()=>.9'); g.upkeep(team); assert.equal(u.acted, true); assert.equal(g.canTakeAction(u), false); assert.equal(g.selectUnit(u), false); assert.equal(g.aiDecide(u), null);
    u.status = 'par'; u.statusTurns = 0; G('var rolls=0; rnd=()=>{rolls++;return .1;}'); g.upkeep(team); assert(u.acted); assert.equal(G('rolls'), 1);
    g.selectUnit(u); g.selectUnit(u); assert.equal(G('rolls'), 1, 'selection never rerolls');
    g.useItem(u, 'fullheal'); assert(u.acted, 'a cure never refunds an action already spent');
    g.upkeep(team); assert(!u.acted && g.canTakeAction(u));
  }
  const T = loadGame(), { g, G, C } = T; g.startBattle(C.CHAPTERS[0].map, [g.partyUnit(1, 5)], {}, { chapter: 0, defer: true });
  const u = g.alive(0)[0]; u.status = 'par'; u.statusTurns = 0; G('var rolls=0; rnd=()=>{rolls++;return .1;}'); g.beginPhase(0, true); assert(u.acted); g.resumeSuspend(); assert(g.alive(0)[0].acted); assert.equal(G('rolls'), 1);
});
test('enemy playback does not roll paralysis again after upkeep', () => {
  const T = loadGame(), { g, G } = T; arena(T); place(T, 4, 12, 0, 1, 1); const u = place(T, 1, 12, 1, 5, 2); u.status = 'par';
  G('var rolls=0; rnd=()=>{rolls++;return .9;}'); g.upkeep(1); assert(!u.acted); assert.equal(G('rolls'), 1);
  G('aiDecide=()=>null;nextPhase=()=>{};'); g.runEnemyPhase(1); assert.equal(G('rolls'), 1);
});
test('the first territory guide fits, dismisses without spending actions, and is remembered', () => {
  for (const [w, h] of [[180, 390], [195, 422], [422, 195], [640, 360]]) {
    const T = loadGame(), { g, G } = T; G(`VIEW.w=${w};VIEW.h=${h};`); g.launchTerritory(7);
    for (let i = 0; i < 100; i++) g.battleUpdate(.05);
    assert.equal(G('BT.mode'), 'territoryGuide'); const boxes = textHook(T); g.drawHUD();
    assert(boxes().every(b => b.x >= -1 && b.y >= 0 && b.x + b.w <= w + 1 && b.y + 7 <= h), JSON.stringify(boxes()));
    const r = g.territoryGuideRect(); assert(r.y >= 0 && r.y + r.h <= h);
    g.battleInput({ type: 'key', key: 'back' }); assert.equal(G('BT.mode'), 'idle'); assert(g.alive(0).every(u => !u.acted));
    assert.equal(T.store.get('pk_territoryGuide'), 'hide'); g.launchTerritory(19); for (let i = 0; i < 100; i++) g.battleUpdate(.05); assert.equal(G('BT.mode'), 'idle');
  }
});
test('all help lines can be read on short screens and the full title menu fits', () => {
  for (const [w, h] of [[180, 390], [195, 422], [422, 195], [512, 288]]) {
    const T = loadGame(), { g, G } = T; g.launchTerritory(7, true); G(`VIEW.w=${w};VIEW.h=${h};BT.mode='help';BT.helpPage=0;BT.helpOffset=0;`);
    const all = Array.from(G('HELP_PAGES')).flatMap((p, i) => Array.from(g.helpLines(i, Math.min(280, w - 12) - 16))), shown = [];
    let pages = 0;
    while (G('BT.mode') === 'help' && pages++ < 60) { const r = g.helpRect(); shown.push(...r.lines); assert(r.y >= 0 && r.y + r.h <= h); g.battleInput({ type: 'key', key: 'ok' }); }
    assert.deepStrictEqual(shown, all); assert(pages < 60);
    T.store.set('pk_save', JSON.stringify({ chapter: 0, party: [], stars: {} })); T.store.set('pk_suspend', '{}');
    g.goScene('title'); const boxes = textHook(T); g.titleDraw();
    const bad = boxes().filter(b => b.x < -1 || b.x + b.w > w + 1 || b.y < -1 || b.y + 7 > h + 1); assert(!bad.length, w + 'x' + h + ': ' + JSON.stringify(bad));
    assert.equal(G('SC.hits.length'), 6); for (const b of G('SC.hits')) assert(b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h);
  }
});
test('territory runs through the real enemy animation queue to results and rematch', () => {
  const T = loadGame(), { g, G } = T; G("PREF.territoryGuide='hide';PREF.battle='map';BT.fast=true;"); g.launchTerritory(7);
  let frames = 0;
  while (G('SC.name') === 'battle' && frames++ < 12000) {
    if (G('BT.mode') === 'idle' && T.B().phase === 0 && !T.B().result) { g.territoryAiDeploy(0); g.autoTurn(); }
    g.battleUpdate(.1); if (frames % 8 === 0) g.battleDraw();
  }
  assert.equal(G('SC.name'), 'territoryResults', 'real playback must finish'); assert(frames < 12000); assert(T.B().territory.captures.some(n => n > 0));
  g.territoryResultsDraw(); assert.equal(G('SC.hits.length'), 2); G('SC.hits[0].run()'); assert.equal(G('SC.name'), 'battle'); assert.equal(T.B().turn, 1); assert.equal(T.B().units.length, 6);
});
let failed = 0;
for (const [name, run] of tests) { try { run(); console.log('  ok   ' + name); } catch (e) { failed++; console.error('  FAIL ' + name + '\n' + e.stack); } }
console.log(`${tests.length - failed}/${tests.length} integration tests passed`); process.exitCode = failed ? 1 : 0;
