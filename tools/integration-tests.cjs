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
    const nurse = place(T, 35, 12, team, u.x, u.y + 1); u.hp = 1; g.useSkill(nurse, nurse.skill, u); assert(!u.status && u.acted, 'a cure never refunds an action already spent');
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
    assert.equal(G('SC.hits.length'), 7); for (const b of G('SC.hits')) assert(b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h);
  }
});
test('title routes work before artwork loads; sound, pointer and keyboard controls stay independent', () => {
  const T = loadGame(), { g, G } = T;
  for (const [label, scene, draw] of [['NEW GAME', 'story', 'storyDraw'], ['QUICK BATTLE', 'quick', 'quickDraw'], ['VERSUS', 'versus', 'versusDraw']]) {
    g.goScene('title'); g.titleDraw();
    const h = G('SC.hits').find(h => h.label === label);
    g.titleInput({ type: 'up', x: h.x + h.w / 2, y: h.y + h.h / 2, touch: true });
    g.titleUpdate(.21);
    assert.equal(G('SC.name'), scene); assert.doesNotThrow(() => g[draw]());
    if (scene === 'story') { assert.doesNotThrow(() => g.storyUpdate(.5)); g.finishDialog(); assert.equal(G('SC.name'), 'starter', 'the prologue leads to the lab'); assert.doesNotThrow(() => g.starterDraw()); } // a new journey opens on the prologue
  }
  // quick battle: a tap selects a card, a second tap (or OK) opens its setup; BACK returns to the title
  for (const [i, scene, draw] of [[0, 'skirmish', 'skirmishDraw'], [1, 'territory', 'territorySetupDraw']]) {
    g.goScene('quick'); g.quickDraw(); const card = G('SC.hits')[i];
    g.quickInput({ type: 'up', x: card.x + 4, y: card.y + 4 }); g.quickDraw(); g.quickInput({ type: 'up', x: card.x + 4, y: card.y + 4 });
    assert.equal(G('SC.name'), scene); assert.doesNotThrow(() => g[draw]());
  }
  g.goScene('quick'); g.quickInput({ type: 'key', key: 'back' }); assert.equal(G('SC.name'), 'title');
  g.goScene('title'); g.titleDraw();
  const sound = G('SC.titleSound'), muted = G('Audio.muted');
  g.titleInput({ type: 'up', x: sound.x + 4, y: sound.y + 4, touch: true });
  assert.equal(G('Audio.muted'), !muted); assert.equal(G('SC.name'), 'title'); assert.equal(G('SC.i'), 0);
  const second = G('SC.hits[1]');
  g.titleInput({ type: 'move', x: second.x + 4, y: second.y + 4 }); assert.equal(G('SC.i'), 1);
  g.titleInput({ type: 'key', key: 'down' }); assert.equal(G('SC.i'), 2);
  g.titleInput({ type: 'key', key: 'ok' }); g.titleUpdate(.21); assert.equal(G('SC.name'), 'versus');
});
test('all title save states fit small screens; new-game cancellation preserves the save', () => {
  for (const [w, h] of [[176, 288], [180, 320], [195, 422], [422, 195], [512, 180], [480, 300], [307, 409]]) {
    const T = loadGame(), { g, G, store } = T;
    G(`VIEW.w=${w};VIEW.h=${h};`);
    for (const state of [0, 1, 2]) {
      if (state >= 1) store.set('pk_save', JSON.stringify({ chapter: 1, party: [], stars: {} }));
      if (state === 2) store.set('pk_suspend', '{}');
      g.goScene('title'); const boxes = textHook(T); g.titleDraw();
      assert.equal(G('SC.hits.length'), 5 + state); // NEW GAME, QUICK BATTLE, VERSUS, COMMANDERS, OPTIONS (+ CONTINUE, + RESUME)
      for (const b of boxes()) assert(b.x >= -1 && b.x + b.w <= w + 1 && b.y >= 0 && b.y + 7 <= h, `${w}x${h}: ${JSON.stringify(b)}`);
      const hits = G('SC.hits');
      for (const b of hits) {
        assert(b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h - 27);
        for (const other of hits) if (b !== other) assert(b.x + b.w <= other.x || other.x + other.w <= b.x || b.y + b.h <= other.y || other.y + other.h <= b.y);
      }
    }
    // NEW GAME over a save asks in-game; the confirmation panel fits and KEEP SAVE leaves the save alone
    const before = store.get('pk_save');
    G("SC.hits.find(h=>h.label==='NEW GAME').run()");
    g.titleUpdate(.21); assert(G('SC.titleConfirm'), 'the confirmation opens');
    const boxes = textHook(T); g.titleDraw(); for (const b of boxes()) assert(b.x >= -1 && b.x + b.w <= w + 1 && b.y >= 0 && b.y + 7 <= h, `${w}x${h} confirm: ${JSON.stringify(b)}`);
    const keep = G("SC.titleConfirmHits.find(h=>h.label==='KEEP SAVE')"); g.titleInput({ type: 'up', x: keep.x + 3, y: keep.y + 3 });
    assert.equal(store.get('pk_save'), before); assert.equal(G('SC.name'), 'title'); assert.equal(G('SC.titleConfirm'), null);
  }
});
test('title confirmation fires once after its press effect; dragging to another button cancels', () => {
  const T = loadGame(), { g, G } = T;
  g.goScene('title'); g.titleDraw();
  let activated = 0; G('SC.titleItems')[0].run = () => activated++;
  const [a, b] = G('SC.hits');
  g.titleInput({ type: 'down', x: a.x + 5, y: a.y + 5, btn: 0 });
  g.titleInput({ type: 'up', x: b.x + 5, y: b.y + 5, btn: 0 });
  assert.equal(G('SC.titleFx.action'), null);
  g.titleInput({ type: 'key', key: 'ok' });
  g.titleInput({ type: 'key', key: 'ok' });
  g.titleInput({ type: 'key', key: 'down' });
  assert.equal(G('SC.i'), 0); assert.equal(activated, 0);
  g.titleUpdate(.12); assert.equal(activated, 0);
  g.titleUpdate(.09); assert.equal(activated, 1);
  g.titleUpdate(1); assert.equal(activated, 1); assert.equal(G('SC.titleFx.action'), null);
  // A cancelled new-game confirmation must clear the press effect and hand input back to the menu; confirming starts over.
  T.store.set('pk_save', JSON.stringify({ chapter: 1, party: [], stars: {} }));
  g.goScene('title'); g.titleDraw();
  const i = G("SC.titleItems.findIndex(x=>x.label==='NEW GAME')");
  g.titleActivate(i); g.titleUpdate(.21);
  assert.equal(G('SC.name'), 'title'); assert.equal(G('SC.titleFx.action'), null); assert(G('SC.titleConfirm'));
  g.titleInput({ type: 'key', key: 'down' }); assert.equal(G('SC.i'), i, 'the menu is frozen while the confirmation is open');
  g.titleInput({ type: 'key', key: 'back' }); assert.equal(G('SC.titleConfirm'), null);
  g.titleInput({ type: 'key', key: 'down' }); assert.equal(G('SC.i'), i + 1);
  g.titleActivate(i); g.titleUpdate(.21); g.titleInput({ type: 'key', key: 'right' }); g.titleInput({ type: 'key', key: 'ok' }); assert.equal(G('SC.name'), 'story'); g.finishDialog(); assert.equal(G('SC.name'), 'starter');
});
test('route map: stars for par and faints, first-clear rewards, replays never rewind progress, the reveal opens the next stop', () => {
  const T = loadGame(), { g, G, C, store } = T; G("PARAMS.set('nostory','')");
  G('SAVE = { chapter: 0, party: [partyUnit(4, 5), partyUnit(16, 4)], bag: { pokeball: 5 }, stars: {}, captainPid: 0, starter: 4, journey: { version: 1, firstCatch: true } }');
  const win = (idx, turn, faints) => { const ch = C.CHAPTERS[idx]; g.startBattle(ch.map, G('SAVE.party.map((p,pid)=>Object.assign({},p,{pid}))'), G('SAVE.bag'), { chapter: idx, defer: true, seed: 3, captain: { pid: 0, root: 4, chapter: idx } }); const B = T.B(); B.turn = turn; B.faints = faints; B.result = 'win'; g.onBattleEnd('win'); return G('SC.data'); };
  let R = win(0, 3, 0); assert.equal(R.stars, 3, 'under par, nobody fainted'); assert.equal(G('SAVE.chapter'), 1); assert.equal(G('SAVE.rating.meadow'), 3); assert.equal(G('SAVE.bag.pokeball'), 5 + C.CHAPTERS[0].rewards.pokeball);
  R.next(); assert.equal(G('SC.name'), 'route'); assert.equal(G('SC.data.reveal.unlocked'), 1); for (let i = 0; i < 200 && G('SC.data.reveal'); i++) g.routeUpdate(.05); assert.equal(G('SC.data.sel'), 1, 'the captain walks on to the new stop'); for (let i = 0; i < 60; i++) g.routeUpdate(.05);
  R = win(1, 30, 2); assert.equal(R.stars, 1, 'over par with faints: one star'); assert.equal(G('SAVE.chapter'), 2);
  const balls = G('SAVE.bag.pokeball'); R = win(0, 20, 1); assert.equal(R.stars, 1); assert.equal(G('SAVE.chapter'), 2, 'a replay keeps the progress'); assert.equal(G('SAVE.rating.meadow'), 3, 'the best rating stays'); assert.equal(G('SAVE.bag.pokeball'), balls, 'no reward for a replay');
  R.next(); assert.equal(G('SC.data.reveal.unlocked'), null, 'a replay reveals no new stop');
  // navigation: locked stops cannot be picked, OK opens the preparation, its BACK returns to the route on that stop
  g.openRoute(); for (let i = 0; i < 40; i++) g.routeUpdate(.05); assert.equal(G('SC.data.sel'), 2);
  g.routeInput({ type: 'key', key: 'right' }); assert.equal(G('SC.data.sel'), 2, 'stop 4 is locked'); g.routeInput({ type: 'key', key: 'left' }); for (let i = 0; i < 60; i++) g.routeUpdate(.05); assert.equal(G('SC.data.sel'), 1);
  g.routeInput({ type: 'key', key: 'ok' }); assert.equal(G('SC.name'), 'brief', 'a front opens on its briefing'); assert.doesNotThrow(() => g.briefDraw()); g.briefInput({ type: 'key', key: 'ok' }); assert.equal(G('SC.name'), 'prep'); assert.equal(G('SC.data.chapter.id'), C.CHAPTERS[1].id); g.prepInput({ type: 'key', key: 'back' }); assert.equal(G('SC.name'), 'brief', 'TEAM steps back to its MISSION'); g.briefInput({ type: 'key', key: 'back' }); assert.equal(G('SC.name'), 'route'); assert.equal(G('SC.data.sel'), 1);
  for (const [w, h] of [[180, 390], [195, 422], [422, 195], [480, 270], [640, 360]]) {
    G(`VIEW.w=${w};VIEW.h=${h};`); g.openRoute(); const boxes = textHook(T); g.routeDraw();
    for (const b of boxes()) assert(b.x >= -1 && b.x + b.w <= w + 1 && b.y >= -1 && b.y + 7 <= h + 1, `${w}x${h} route text outside: ${JSON.stringify(b)}`);
    for (const b of G('SC.hits')) if (!/^STOP/.test(b.label)) assert(b.x >= 0 && b.y >= 0 && b.x + b.w <= w && b.y + b.h <= h, `${w}x${h} route control outside: ${b.label}`);
  }
});
test('territory runs through the real enemy animation queue to results and rematch', () => {
  const T = loadGame(), { g, G } = T; G("PREF.territoryGuide='hide';PREF.battle='map';BT.fast=true;"); g.launchTerritory(7);
  let frames = 0;
  while (G('SC.name') === 'battle' && frames++ < 12000) {
    if (G('BT.mode') === 'idle' && T.B().phase === 0 && !T.B().result) { g.warAiDeploy(0); g.autoTurn(); }
    g.battleUpdate(.1); if (frames % 8 === 0) g.battleDraw();
  }
  assert.equal(G('SC.name'), 'territoryResults', 'real playback must finish'); assert(frames < 12000); assert(T.B().war.stats.captures.some(n => n > 0));
  g.territoryResultsDraw(); assert.equal(G('SC.hits.length'), 2); G('SC.hits[0].run()'); assert.equal(G('SC.name'), 'battle'); assert.equal(T.B().turn, 1); assert.equal(T.B().units.length, 6);
});
let failed = 0;
for (const [name, run] of tests) { try { run(); console.log('  ok   ' + name); } catch (e) { failed++; console.error('  FAIL ' + name + '\n' + e.stack); } }
console.log(`${tests.length - failed}/${tests.length} integration tests passed`); process.exitCode = failed ? 1 : 0;
