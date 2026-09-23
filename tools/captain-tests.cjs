#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { loadGame, arena, place } = require('./model-tests.cjs');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const json = x => JSON.stringify(x);
function field(root = 4, chapter = 8) {
  const T = loadGame(); arena(T);
  const captain = place(T, root, 20, 0, 1, 1), ally = place(T, 25, 20, 0, 2, 2), foe = place(T, 143, 20, 1, 3, 2);
  T.g.addCaptain(0, captain, root, chapter); T.G('rnd = () => .5');
  return Object.assign(T, { captain, ally, foe });
}
function flush(T) { for (let i = 0; i < 1200 && T.G('BT.mode') === 'anim'; i++) T.g.battleUpdate(.1); assert.notEqual(T.G('BT.mode'), 'anim'); }
function textHook(T) {
  T.G(`var __textBoxes=[],__matrix=[1,1,0,0],__matrixStack=[];ctx.save=()=>__matrixStack.push(__matrix.slice());ctx.restore=()=>{__matrix=__matrixStack.pop()||[1,1,0,0];};ctx.translate=(x,y)=>{__matrix[2]+=__matrix[0]*x;__matrix[3]+=__matrix[1]*y;};ctx.scale=(x,y)=>{__matrix[0]*=x;__matrix[1]*=y;};text=(s,x,y,c,o={})=>{const w=textWidth(s,o.font||FONT);__textBoxes.push({text:String(s),x:x*__matrix[0]+__matrix[2],y:y*__matrix[1]+__matrix[3],w:w*__matrix[0]});return w;};`);
  return () => T.G('__textBoxes');
}

test('every starter gets Pidgey, stays deployed ahead of stronger catches, and keeps its identity through evolution', () => {
  for (const n of [4, 7, 1]) {
    const T = loadGame(), { g, G } = T; g.startNewGame(); g.pickStarter(n);
    assert.equal(G('SC.name'), 'journey'); assert.equal(json(G('SAVE.party.map(p=>p.num)')), json([n, 16]));
    G('SAVE.party.push(partyUnit(149,50))'); g.prepChapter(0); const P = G('SC.data');
    assert.equal(P.deploy[0], 0); g.toggleDeploy(P, 0); assert(P.deploy.includes(0));
    G(`SAVE.party[0]=partyUnit(${n},40)`); g.migrateCaptain(G('SAVE')); assert.equal(G('SAVE.starter'), n);
    assert.equal(g.captainRoot(G('SAVE.party[0].num')), n);
  }
});
test('legacy save migration preserves the collection and chooses its starter family', () => {
  const T = loadGame(), party = [T.g.partyUnit(16, 10), T.g.partyUnit(8, 18)];
  const before = json(party); T.store.set('pk_save', json({ chapter: 3, party, bag: { pokeball: 8 } }));
  const save = T.g.loadSave(); assert.equal(save.captainPid, 1); assert.equal(save.starter, 7); assert.equal(json(save.party), before);
});
test('chapter unlocks, exact prices and phase/captain/spent checks are enforced at activation', () => {
  for (const chapter of [0, 1, 2, 3]) {
    const T = field(7, chapter), { g } = T, s = g.powerState(0); s.charge = 100;
    assert.equal(!!g.powerBlock(0), chapter === 0); assert.equal(!!g.powerBlock(0, true), chapter < 3);
  }
  const T = field(7), { g } = T, s = g.powerState(0); s.charge = 100;
  T.B().phase = 1; assert.equal(g.activatePower(0), null); T.B().phase = 0;
  T.captain.hp = 0; assert.equal(g.activatePower(0), null); T.captain.hp = 1;
  assert(g.activatePower(0)); assert.equal(s.charge, 50); assert.equal(g.activatePower(0), null);
  g.upkeep(1); assert.equal(s.active, 'normal'); g.upkeep(0); assert.equal(s.active, null); assert(!s.spent);
  s.charge = 100; assert(g.activatePower(0, true)); assert.equal(s.charge, 0);
});
test('fire boosts other types, forecast matches every strike, and the boost is consumed once without refilling', () => {
  const T = field(4), { g, ally, foe } = T, s = g.powerState(0), m = ally.moves[0];
  const base = g.calcDmg(ally, foe, m, g.terrAt(foe.x, foe.y)); s.charge = 100; g.activatePower(0, true);
  const fc = g.forecast(ally, foe, m, ally); assert.equal(fc.a.dmg, Math.floor(base * 1.5));
  const snapshot = json(T.B().command); g.forecast(ally, foe, m, ally); assert.equal(json(T.B().command), snapshot);
  g.resolveCombat(ally, foe, m, ally); assert.equal(foe.hp, fc.hpD); assert.equal(ally.hp, fc.hpA); assert.equal(s.charge, 0);
  assert(s.used.includes(ally.id)); assert.equal(g.calcDmg(ally, foe, m, g.terrAt(foe.x, foe.y)), base);
});
test('water protects through the enemy phase and both preview and combat use its reduction', () => {
  const T = field(7), { g, ally, foe } = T, s = g.powerState(0), m = foe.moves[0]; s.charge = 100;
  const base = g.calcDmg(foe, ally, m, g.terrAt(ally.x, ally.y)); g.activatePower(0, true);
  T.B().phase = 1; g.upkeep(1); const fc = g.forecast(foe, ally, m, foe);
  assert.equal(fc.a.dmg, Math.max(1, Math.floor(base * .6))); g.resolveCombat(foe, ally, m, foe); assert.equal(ally.hp, fc.hpD);
  assert.equal(s.charge, 0); g.upkeep(0); assert.equal(s.active, null);
});
test('grass heals and cures without refunding actions, recharge or cooldown; super wards status and Root', () => {
  for (const superPower of [false, true]) {
    const T = field(1), { g, ally } = T, s = g.powerState(0); s.charge = 100;
    ally.hp = 1; ally.acted = true; ally.moved = true; ally.recharge = 1; ally.cd = 2; ally.status = 'frz'; ally.root = 2;
    const ev = g.activatePower(0, superPower); assert(ev.some(e => e.type === 'heal'));
    assert.equal(ally.hp, 1 + Math.floor(ally.maxHp * (superPower ? .4 : .2))); assert.equal(ally.status, null); assert.equal(ally.root, 0);
    assert(ally.acted && ally.moved); assert.equal(ally.recharge, 1); assert.equal(ally.cd, 2);
    assert.equal(g.powerBlocksStatus(ally), superPower);
    assert.equal(g.moveEffects({eff:{status:'psn',chance:100}}, ally).length, superPower ? 0 : 1);
    const enemy = place(T, 1, 20, 1, 2, 3); assert.equal(g.skillTargetsAt(enemy, enemy.skill, enemy).includes(ally), !superPower);
    if (superPower) {
      const move = Object.assign({}, enemy.moves[0], { eff: { status: 'psn', chance: 100 }, acc: 100 });
      g.resolveCombat(enemy, ally, move, enemy); assert.equal(ally.status, null);
    }
  }
});
test('charge uses actual hostile HP loss, caps at 100 and ignores friendly damage and active powers', () => {
  const T = field(7), { g, ally, foe } = T; g.addCaptain(1, foe, 4); const s = g.powerState(0), e = g.powerState(1);
  g.powerCombatCharge([{ type: 'hit', att: ally, def: foe, dmg: 999, lost: 1 }]);
  assert.equal(s.charge, Math.ceil(30 / foe.maxHp)); assert.equal(e.charge, Math.ceil(40 / foe.maxHp));
  const charge = s.charge; g.powerCombatCharge([{ type: 'heal', unit: ally, amount: 99 }, { type: 'hit', att: ally, def: T.captain, dmg: 20, lost: 20 }]); assert.equal(s.charge, charge);
  g.powerCharge(0, 999); assert.equal(s.charge, 100); g.activatePower(0); g.powerCharge(0, 50); assert.equal(s.charge, 50);
});
test('practice target stays put, cannot faint even on a double, and capture is free, gated and persisted after victory', () => {
  const T = loadGame(), { g, G, C } = T; g.startNewGame(); g.pickStarter(4);
  const party = G('SAVE.party.map((p,pid)=>Object.assign({},p,{pid}))');
  g.startBattle(C.CHAPTERS[0].map, party, {}, { chapter: 0, defer: true, seed: 7, lesson: true, captain: { pid: 0, root: 4, chapter: 0 } });
  const B = T.B(), target = B.units.find(u => g.isPracticeTarget(u)), u = g.alive(0)[0];
  assert.equal(g.aiDecide(target), null); assert.equal(g.captureChance(target, G('ITEMS.practiceball')), 0);
  const big = place(T, 6, 40, 0, target.x - 1, target.y); G('rnd = () => .5');
  const fc = g.forecast(big, target, big.moves[0], big); assert(!fc.koD); g.resolveCombat(big, target, big.moves[0], big); assert.equal(target.hp, fc.hpD); assert.equal(target.hp, 1);
  assert.equal(g.captureChance(target, G('ITEMS.practiceball')), 1);
  for (const v of g.alive(1)) v.hp = 0; assert.equal(g.checkObjective(), null, 'catch required even after rout');
  u.x = target.x - 1; u.y = target.y; G('BT.mode="idle"'); g.selectUnit(u); const BT = G('BT'); BT.targets = [target]; BT.tIdx = 0; BT.ball = 'practiceball';
  g.confirmCatch(); flush(T); assert(B.lesson.complete); assert.equal(B.captured.length, 1); assert.equal(json(B.bag), '{"pokeball":0}', 'the practice ball is free: no Poké Ball spent'); assert.equal(g.checkObjective(), 'win');
  g.onBattleEnd('win'); if (G('SC.dialog')) g.finishDialog();
  assert(G('SAVE.journey.firstCatch')); assert(G('SAVE.party.some(p=>p.num===10)')); assert.equal(G('SAVE.captainPid'), 0);
});
test('campaign outposts take two full-HP actions, heal their owner and charge only on completion', () => {
  const T = field(7), { g, ally } = T, B = T.B(), s = g.powerState(0);
  B.outposts = [{ x: 2, y: 2, owner: -1, progress: 0, captor: null, goal: true }];
  assert(!g.territoryHeals(ally)); assert(!g.boardCapture(ally).done); assert.equal(s.charge, 0);
  assert.equal(g.boardCapture(ally), null); g.upkeep(0); assert(g.boardCapture(ally).done); assert.equal(s.charge, 20); assert(B.seized); assert(g.territoryHeals(ally));
  B.outposts[0].owner = -1; ally.acted = false; g.boardCapture(ally); ally.x--; g.settleOutposts(); assert.equal(B.outposts[0].progress, 0);
});
test('Territory offers three symmetric unique teams, and a recovered captain regains power access', () => {
  for (const root of [4, 7, 1]) {
    const T = loadGame(), { g } = T; g.launchTerritory(7, true, [root, root]); const B = T.B(), s = g.powerState(0);
    assert.equal(s.root, root); assert(s.superUnlocked); const roster = B.territory.reserves[0]; assert.equal(new Set(roster.map(r => r.num)).size, 6);
    assert.equal(json(roster.map(r=>r.num)), json(B.territory.reserves[1].map(r=>r.num)));
    g.powerCaptain(0).hp = 0; g.territorySettle(); s.charge = 100; assert(g.powerBlock(0));
    for (let i = 0; i < 2; i++) { B.turn++; g.territoryUpkeep(0); }
    B.territory.points[0] = 30; const again = g.territoryDeploy(0, 2, B.territory.properties[0]); assert(again); assert.equal(g.powerCaptain(0).id, again.id); assert.equal(g.powerBlock(0, true), null);
  }
});
test('AI activates the same shared power once before its units act', () => {
  const T = field(), { g, foe, ally } = T; g.addCaptain(1, foe, 7); const s = g.powerState(1); s.charge = 100; T.B().phase = 1;
  const ev = g.aiPower(1); assert(ev && ev[0].type === 'power'); assert.equal(s.active, 'super'); assert.equal(s.charge, 0); assert.equal(s.uses, 1); assert.equal(g.aiPower(1), null); assert(!foe.acted);
});
test('Territory rematch retains the chosen captain and uses fresh charge', () => {
  const T = loadGame(), { g, G } = T; g.launchTerritory(7, true, [4, 4]); g.powerState(0).charge = 90;
  g.onBattleEnd('win'); g.territoryResultsDraw(); const rematch = G('SC.hits').find(h => h.label === 'REMATCH');
  assert(rematch); rematch.run(); assert.equal(g.powerState(0).root, 4); assert.equal(g.powerState(1).root, 4); assert.equal(g.powerState(0).charge, 0);
});
test('full Territory simulations finish with each captain and legal powers on both teams', () => {
  for (const root of [4, 7, 1]) {
    const T = loadGame(), r = T.g.simTerritory(7, 41, [root, root]);
    assert(['win', 'lose', 'draw'].includes(r.result)); assert(r.turn <= 41);
    for (const team of [0, 1]) { assert(r.actions.some(a => a.team === team && a.kind === 'power')); assert(T.g.powerState(team).charge >= 0); }
    console.log(`       captain ${root}: ${r.result}, turn ${r.turn}, ${r.actions.filter(a=>a.kind==='power').length} powers`);
  }
});
test('suspend preserves charge, active effects, used attacks, outposts, lesson and RNG without replaying upkeep', () => {
  const T = loadGame(), { g, G } = T; g.launchTerritory(7, true, [4, 4]);
  g.powerState(0).charge = 100; g.activatePower(0, true); g.powerState(0).used.push(g.alive(0)[0].id);
  const command = json(T.B().command), s = T.B().territory; g.saveSuspend(); const roll = G('rnd()'); g.resumeSuspend();
  assert.equal(json(T.B().command), command); assert.equal(G('rnd()'), roll); assert.equal(json(T.B().territory), json(s));
  assert.equal(g.powerCaptain(0).reserveSlot, 2); assert.equal(g.activatePower(0), null);
  const U = loadGame(); U.g.startNewGame(); U.g.pickStarter(7); U.g.launchChapter(0, U.G('SAVE.party.map((p,pid)=>Object.assign({},p,{pid}))'));
  U.g.saveSuspend(); const lesson = json(U.B().lesson); U.g.resumeSuspend(); assert.equal(json(U.B().lesson), lesson);
});
test('power confirmation and skipped animation apply healing and payment exactly once', () => {
  const T = field(1), { g, ally } = T, s = g.powerState(0); s.charge = 100; ally.hp = 1;
  g.openPowerMenu(); T.G('BT.powerIndex=1'); g.confirmPower(); const hp = ally.hp;
  T.G('BT.skipAnim=true'); flush(T); assert.equal(ally.hp, hp); assert.equal(s.charge, 0); assert.equal(s.uses, 1); assert.equal(T.G('BT.mode'), 'idle');
});
test('starter, lessons, preparation and power screens fit portrait and short landscape without text overlap', () => {
  for (const [w, h] of [[180, 320], [195, 422], [422, 195], [512, 180], [512, 288], [640, 360]]) for (const scene of ['starter', 'journey', 'prep', 'power', 'burst', 'territory']) {
    const T = field(1), { g, G } = T; G(`VIEW.w=${w};VIEW.h=${h}`); const boxes = textHook(T);
    if (scene === 'starter') { g.startNewGame(); g.starterDraw(); }
    if (scene === 'journey') { g.showJourney(G('CHAPTER_LESSONS[3]'), () => {}); g.journeyDraw(); }
    if (scene === 'prep') { g.startNewGame(); g.pickStarter(7); g.prepChapter(0); g.prepDraw(); }
    if (scene === 'power') { g.openPowerMenu(); g.drawHUD(); }
    if (scene === 'burst') { g.powerState(0).charge = 100; const ev = g.activatePower(0, true); g.drawPowerBurst({ ev: ev[0], t: .3 }); }
    if (scene === 'territory') { g.startTerritorySetup(); g.territorySetupDraw(); }
    const bad = boxes().filter(b => b.x < -1 || b.x + b.w > w + 1 || b.y < -1 || b.y + 7 > h + 1);
    assert.equal(bad.length, 0, `${w}x${h} ${scene}: ${json(bad)}`);
    for (const [i, a] of boxes().entries()) for (const b of boxes().slice(i + 1)) assert(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + 7 && b.y < a.y + 7), `${w}x${h} ${scene} overlap: ${json([a,b])}`);
    const controls = G(['starter','journey','prep','territory'].includes(scene) ? 'SC.hits' : 'HUD.hits');
    for (const b of controls) assert(b.x >= 0 && b.y >= 0 && b.x+b.w <= w && b.y+b.h <= h, `${w}x${h} ${scene} control outside view`);
  }
});
test('versus: each trainer picks a captain style, the first pick leads, both powers are unlocked and charge from combat', () => {
  const T = loadGame(), { g, G } = T;
  g.launchVersus({ seed: 5, level: 20, wild: false, mode: 'elim', arena: 's', fog: false, turns: 30, cap0: 1, cap1: 4, teams: [[25, 5], [7, 133]], order: [0, 1, 1, 0], size: 2, cur: 0 });
  const B = T.B(), s0 = g.powerState(0), s1 = g.powerState(1);
  assert(s0 && s1, 'both trainers command a power'); assert.equal(s0.root, 1); assert.equal(s1.root, 4); assert(s0.unlocked && s0.superUnlocked && s1.superUnlocked);
  assert.equal(g.powerCaptain(0).num, 25, 'player 1 first pick leads'); assert.equal(g.powerCaptain(1).num, 8, 'player 2 first pick leads (Squirtle has evolved at Lv20)');
  assert.equal(B.units.filter(u => u.leader).length, 2, 'one crown per side'); assert.equal(json(B.bag), '{"pokeball":0}', 'no catching gear in Versus'); assert(!B.units.some(u => u.team === 2), 'no wild Pokémon');
  G('rnd = () => .5'); const a = g.alive(0)[0], d = g.alive(1)[0]; a.x = 3; a.y = 3; d.x = 4; d.y = 3; B.phase = 0; g.resolveCombat(a, d, a.moves[0], a);
  assert(s0.charge > 0 && s1.charge > 0, 'combat charges both bars: ' + s0.charge + '/' + s1.charge);
  s0.charge = 50; a.hp = 1; assert.equal(g.powerBlock(0, false), null); const ev = g.activatePower(0, false); assert(ev && ev.some(e => e.type === 'heal'), 'Life Link heals in Versus');
});
let failed = 0;
for (const [name, fn] of tests) { try { fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.error('  FAIL ' + name + '\n' + e.stack); } }
console.log(`${tests.length-failed}/${tests.length} captain tests passed`); process.exitCode = failed ? 1 : 0;
