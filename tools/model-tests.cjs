#!/usr/bin/env node
// Deterministic model tests: node tools/model-tests.cjs
// Loads the game sources (same order as build.sh) into a vm context with a tiny DOM stub, so the
// real unit factory, combat model, upkeep, AI and suspend/resume flow run without a browser.
// Built-ins only. Exit code 1 on any failure.
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const FILES = ['core.js', 'font.js', 'dex.js', 'data.js', 'art.js', 'model.js', 'battle.js', 'duel.js', 'campaign.js', 'scenes.js', 'main.js'];

// ---------------------------------------------------------------- harness
function loadGame() {
  const store = new Map();
  const ctx2d = () => new Proxy({}, {
    get(t, k) { if (k in t) return t[k]; if (k === 'measureText') return () => ({ width: 0 }); if (k === 'getImageData' || k === 'createImageData') return (a, b, w, h) => ({ width: w || a, height: h || b, data: new Uint8ClampedArray((w || a) * (h || b) * 4) }); return () => undefined; },
    set(t, k, v) { t[k] = v; return true; },
  });
  const canvas = () => { const c = { width: 0, height: 0, style: {}, addEventListener() { }, setPointerCapture() { }, getBoundingClientRect: () => ({ left: 0, top: 0 }) }; c.getContext = () => c.ctx || (c.ctx = ctx2d()); return c; };
  const g = {
    console, setTimeout, clearTimeout, URLSearchParams, Image: class { },
    document: { getElementById: canvas, createElement: canvas },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() },
    location: { search: '' }, innerWidth: 960, innerHeight: 540, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }), addEventListener() { }, requestAnimationFrame() { }, performance: { now: () => 0 },
  };
  g.window = g; vm.createContext(g);
  vm.runInContext(FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n'), g, { filename: 'game.js' });
  const G = expr => vm.runInContext(expr, g); // evaluates inside the game: reaches top-level let/const such as B, BT, rnd
  const C = {}; for (const n of ['BOND_HP', 'CHAPTERS', 'DEX', 'DEX_LIST', 'SIGNATURE', 'key']) C[n] = G(n); // top-level consts are not global properties
  return { g, G, C, store, B: () => G('B') };
}
const PLAINS = ['.......', '.......', '.......', '.......', '.......'];
// A battle on an ASCII map with no party; units are placed by hand with `place`.
function arena(T, rows = PLAINS, opts = {}) {
  T.g.startBattle({ name: 'test', seed: 3, rows, deploy: [], units: [], objective: { type: 'rout' } }, [], { pokeball: 1 }, Object.assign({ defer: true, seed: 5 }, opts));
  return T.B();
}
function place(T, num, level, team, x, y, extra = {}) { const u = T.g.makeUnit(num, level, team, Object.assign({ x, y }, extra)); T.B().units.push(u); return u; }
function move(u, name) { const m = u.moves.find(m => m.name === name); assert(m, u.name + ' has no ' + name + ' (has ' + u.moves.map(m => m.name).join(', ') + ')'); return m; }
const fixedRoll = (T, v) => T.G('rnd = () => ' + v); // .5 = every 51%+ strike lands, no crits, no status procs
const kinds = ev => ev.map(e => e.type + (e.counter ? '*' : '')).join(' ');

// ---------------------------------------------------------------- tests
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('unit factory ignores team number; campaign edge is explicit; Versus trainers are symmetric', T => {
  const { g, C } = T; const plain = g.makeUnit(25, 20, 1);
  assert.strictEqual(g.makeUnit(25, 20, 0).maxHp, plain.maxHp, 'team 0 alone must not change HP');
  assert.strictEqual(g.makeUnit(25, 20, 0, { hpBonus: C.BOND_HP }).maxHp, Math.round(plain.maxHp * C.BOND_HP), 'explicit bonus applies');
  g.launchVersus({ seed: 5, level: 20, wild: true, teams: [[25, 5], [25, 8]], order: [0, 1, 1, 0], size: 2, cur: 0 });
  const B = T.B(); const p1 = B.units.find(u => u.team === 0 && u.num === 25), p2 = B.units.find(u => u.team === 1 && u.num === 25);
  assert(p1 && p2, 'both trainers field a Pikachu');
  for (const k of ['maxHp', 'hp', 'atk', 'def', 'spa', 'spd', 'spe']) assert.strictEqual(p1[k], p2[k], 'versus ' + k);
  assert.strictEqual(p1.maxHp, plain.maxHp, 'versus Pikachu has plain HP');
  g.levelUp(p1); g.levelUp(p2); assert.strictEqual(p1.maxHp, p2.maxHp, 'level up stays symmetric');
  g.evolve(p1, C.DEX[26]); g.evolve(p2, C.DEX[26]); assert.strictEqual(p1.maxHp, p2.maxHp, 'evolution stays symmetric');
  const r1 = g.restoreUnit(g.serializeUnit(p1)), r2 = g.restoreUnit(g.serializeUnit(p2)); assert.strictEqual(r1.maxHp, r2.maxHp, 'restore stays symmetric'); assert.strictEqual(r1.maxHp, p1.maxHp);
  const wild = B.units.find(u => u.team === 2); if (wild) { const before = wild.maxHp; wild.team = 0; assert.strictEqual(wild.maxHp, before, 'a Versus catch keeps its stats'); }
});

test('campaign party keeps its HP edge; wild and enemy do not; catches join with it', T => {
  const { g, G, C } = T;
  g.startBattle(C.CHAPTERS[0].map, [g.partyUnit(25, 20)], { pokeball: 1 }, { chapter: 0, seed: 7, defer: true });
  const B = T.B(); const mine = B.units.find(u => u.team === 0); const plain = g.makeUnit(25, 20, 1).maxHp;
  assert.strictEqual(mine.maxHp, Math.round(plain * C.BOND_HP), 'party Pikachu carries the edge');
  const wild = place(T, 25, 20, 2, 5, 5); assert.strictEqual(wild.maxHp, plain, 'wild Pikachu is plain');
  G('SAVE = { chapter: 0, party: [], bag: {}, stars: {}, beaten: false }');
  B.captured.push(g.serializeUnit(Object.assign({}, wild, { team: 0, hp: 5 }))); g.applyBattleToParty();
  const saved = G('SAVE').party[0]; assert.strictEqual(saved.hpBonus, C.BOND_HP); assert.strictEqual(g.restoreUnit(saved).maxHp, mine.maxHp, 'catch gets the party edge');
  // a save written before hpBonus existed migrates on load
  T.store.set('pk_save', JSON.stringify({ chapter: 1, party: [{ num: 4, level: 9, xp: 0, hp: 30, team: 0 }], bag: {}, stars: {} }));
  const old = g.loadSave(); assert.strictEqual(old.party[0].hpBonus, C.BOND_HP, 'legacy party member migrated');
});

test('forecast: a first-strike KO cancels the counter and the resolver agrees', T => {
  const { g } = T; arena(T); fixedRoll(T, .5);
  const att = place(T, 6, 30, 1, 1, 1), def = place(T, 10, 3, 2, 2, 1); // Charizard vs Caterpie, adjacent
  const fc = g.forecast(att, def, move(att, 'Flamethrower'), att);
  assert(fc.c, 'Caterpie could counter in principle'); assert.strictEqual(fc.strikes[0].nominal, true);
  const counter = fc.strikes.find(s => s.side === 'c'); assert.strictEqual(counter.nominal, false); assert.strictEqual(counter.cond, 'only if Caterpie survives');
  assert.strictEqual(fc.hpD, 0); assert.strictEqual(fc.koD, true); assert.strictEqual(fc.hpA, att.hp, 'no damage promised to the attacker');
  const ev = g.resolveCombat(att, def, move(att, 'Flamethrower'), att);
  assert.strictEqual(kinds(ev), 'hit ko', 'one hit, KO, no counter'); assert.strictEqual(def.hp, 0); assert.strictEqual(att.hp, fc.hpA);
});

test('forecast: counter then a speed double, all matching the resolver', T => {
  const { g } = T; arena(T); fixedRoll(T, .5);
  const att = place(T, 25, 20, 1, 1, 1), def = place(T, 79, 20, 0, 2, 1); // Pikachu doubles Slowpoke, which survives and answers
  const m = move(att, 'Thunder Shock'); const fc = g.forecast(att, def, m, att);
  assert.strictEqual(fc.strikes.map(s => s.side).join(' '), 'a c a'); assert(fc.strikes.every(s => s.nominal), 'every strike is nominal');
  assert.strictEqual(fc.hpD, def.hp - 2 * fc.a.dmg); assert.strictEqual(fc.hpA, att.hp - fc.c.dmg);
  const ev = g.resolveCombat(att, def, m, att);
  assert.strictEqual(kinds(ev).replace(/ xp.*$/, ''), 'hit hit* hit'); assert.strictEqual(def.hp, fc.hpD); assert.strictEqual(att.hp, fc.hpA);
});

test('forecast: a counter that KOs the attacker cancels its double', T => {
  const { g } = T; arena(T); fixedRoll(T, .5);
  const att = place(T, 25, 20, 1, 1, 1, { hp: 1 }), def = place(T, 143, 20, 2, 2, 1);
  const m = move(att, 'Thunder Shock'); const fc = g.forecast(att, def, m, att);
  assert.strictEqual(fc.koA, true); const dbl = fc.strikes[2]; assert.strictEqual(dbl.side, 'a'); assert.strictEqual(dbl.nominal, false); assert.strictEqual(dbl.cond, 'only if Pikachu survives');
  const ev = g.resolveCombat(att, def, m, att); assert.strictEqual(kinds(ev), 'hit hit* ko'); assert.strictEqual(att.hp, 0); assert.strictEqual(def.hp, fc.hpD);
});

test('forecast: no counter out of range, when frozen, or while recharging', T => {
  const { g } = T; arena(T);
  const att = place(T, 25, 20, 1, 1, 1), def = place(T, 66, 10, 2, 3, 1); // Machop only reaches adjacent tiles
  const m = move(att, 'Thunder Shock');
  let fc = g.forecast(att, def, m, att); assert.strictEqual(fc.c, null); assert.strictEqual(fc.noCounter, 'range');
  def.x = 2; fc = g.forecast(att, def, m, att); assert(fc.c, 'adjacent Machop counters'); assert.strictEqual(fc.noCounter, null);
  def.status = 'frz'; fc = g.forecast(att, def, m, att); assert.strictEqual(fc.noCounter, 'frozen'); def.status = null;
  def.recharge = 1; fc = g.forecast(att, def, m, att); assert.strictEqual(fc.noCounter, 'recharging');
});

test('forecast: drain heals the attacker in the preview and in the resolver', T => {
  const { g } = T; arena(T); fixedRoll(T, .5);
  const att = place(T, 3, 30, 1, 1, 1), def = place(T, 95, 30, 2, 2, 1); att.hp = 20; // Venusaur's Giga Drain on Onix
  const m = move(att, 'Giga Drain'); const fc = g.forecast(att, def, m, att);
  const first = fc.strikes[0]; assert(first.drain > 0, 'preview shows drain'); assert.strictEqual(first.drain, Math.floor(Math.min(fc.a.dmg, def.hp) * .5));
  const ev = g.resolveCombat(att, def, m, att); assert.strictEqual(ev[0].drain, first.drain); assert.strictEqual(att.hp, fc.hpA); assert.strictEqual(def.hp, fc.hpD);
});

test('forecast never rolls dice or touches the units; a miss deals nothing', T => {
  const { g, G } = T; arena(T);
  const att = place(T, 25, 20, 1, 1, 1), def = place(T, 143, 20, 2, 2, 1); const m = move(att, 'Thunder Shock');
  G('var __rolls = 0; rnd = () => { __rolls++; return .5; }');
  const before = JSON.stringify([g.serializeUnit(att), g.serializeUnit(def)]);
  for (let i = 0; i < 3; i++) g.forecast(att, def, m, att);
  assert.strictEqual(G('__rolls'), 0, 'forecast consumed RNG'); assert.strictEqual(JSON.stringify([g.serializeUnit(att), g.serializeUnit(def)]), before, 'forecast mutated a unit');
  fixedRoll(T, 1); const ev = g.resolveCombat(att, def, m, att); assert.strictEqual(ev[0].type, 'miss'); assert.strictEqual(def.hp, def.maxHp);
});

test('danger zone counts wild threats separately and drops recharging units', T => {
  const { g, C } = T; arena(T);
  place(T, 25, 10, 0, 0, 0); const wild = place(T, 16, 5, 2, 6, 4), foe = place(T, 19, 5, 1, 0, 4);
  const z = g.dangerZones(0); assert(z.wild.size > 0, 'wild reach shown'); assert(z.trainer.size > 0, 'enemy reach shown');
  assert(z.wild.has(C.key(wild.x - 1, wild.y)), 'the tile beside the wild Pidgey is dangerous');
  const all = g.dangerZone(0); for (const k of z.wild) assert(all.has(k)); for (const k of z.trainer) assert(all.has(k));
  foe.recharge = 1; assert.strictEqual(g.dangerZones(0).trainer.size, 0, 'a recharging foe threatens nothing next phase');
  const zv = g.dangerZones(1); assert(zv.trainer.has(C.key(1, 0)), 'from the enemy side the player is the trainer threat');
});

test('move loadouts honor unlock levels, keep an adjacent option and stay small', T => {
  const { g, C } = T; const names = (num, lvl) => g.movesFor(C.DEX[num].types, lvl, C.SIGNATURE[num]).map(m => m.name);
  assert(!names(25, 5).includes('Thunderbolt'), 'Pikachu Lv5 has no Thunderbolt'); assert(names(25, 5).includes('Thunder Shock'));
  assert.strictEqual(names(25, 26)[0], 'Thunderbolt', 'signature leads once unlocked');
  assert(names(25, 40).includes('Thunder') && names(25, 40).includes('Thunderbolt'), 'Thunder (2-3) keeps Thunderbolt for adjacent foes');
  for (const L of [39, 40]) { const ms = g.movesFor(C.DEX[38].types, L); assert(ms.some(m => m.rng[0] === 1), 'Ninetales Lv' + L + ' can hit adjacent'); }
  assert(!names(38, 40).includes('Hyper Beam'), 'Hyper Beam is not a fallback for non-Normal types'); assert(names(143, 40).includes('Hyper Beam') && names(143, 40).includes('Body Slam'));
  for (const d of C.DEX_LIST) for (let L = 1; L <= 50; L += 7) { const ms = g.movesFor(d.types, L, C.SIGNATURE[d.num]); assert(ms.length >= 1 && ms.length <= 5, d.name + ' Lv' + L + ' has ' + ms.length + ' moves'); assert(ms.some(m => m.rng[0] === 1), d.name + ' Lv' + L + ' cannot hit adjacent'); for (const m of ms) assert(m.lvl <= L, d.name + ' Lv' + L + ' has ' + m.name + ' early'); }
});

test('upkeep: Poké Center cures at full HP, heals the hurt, poison ticks once', T => {
  const { g } = T; arena(T, ['C......', 'C......', '.......']);
  const full = place(T, 25, 10, 0, 0, 0); full.status = 'par'; const hurt = place(T, 4, 10, 0, 0, 1); hurt.hp = 5; hurt.status = 'psn'; const sick = place(T, 7, 10, 0, 3, 1); sick.status = 'psn';
  const ev = g.upkeep(0);
  assert.strictEqual(full.status, null, 'full-HP paralysis cured'); assert(!ev.some(e => e.type === 'heal' && e.unit === full), 'no heal at full HP'); assert(ev.some(e => e.type === 'cure' && e.unit === full));
  assert.strictEqual(hurt.hp, 5 + Math.floor(hurt.maxHp * .3)); assert.strictEqual(hurt.status, null);
  assert.strictEqual(sick.hp, sick.maxHp - Math.max(1, Math.floor(sick.maxHp / 8)), 'poison ticks'); assert.strictEqual(sick.status, 'psn');
});

test('Hyper Beam: recharge blocks counters, costs the next turn, survives save/restore, AI respects it', T => {
  const { g, C } = T; arena(T); fixedRoll(T, .5);
  const lax = place(T, 143, 40, 1, 1, 1), tank = place(T, 95, 40, 0, 3, 1); // Snorlax fires from two tiles at Onix
  const beam = move(lax, 'Hyper Beam'); const fc = g.forecast(lax, tank, beam, lax); assert.strictEqual(fc.recharge, true); assert(g.moveEffects(beam).includes('must recharge'));
  const ev = g.resolveCombat(lax, tank, beam, lax); assert.strictEqual(lax.recharge, 1); assert(ev.some(e => e.type === 'recharge' && e.unit === lax && !e.done));
  assert.strictEqual(g.bestMove(lax, tank, 2, g.terrAt(3, 1), true), null, 'Hyper Beam is never a counter');
  tank.x = 2; assert.strictEqual(g.forecast(tank, lax, tank.moves[0], tank).noCounter, 'recharging', 'a recharging Snorlax cannot answer');
  const s = g.serializeUnit(lax); assert.strictEqual(s.recharge, 1); const r = g.restoreUnit(s); assert.strictEqual(r.recharge, 1);
  const up = g.upkeep(1); assert.strictEqual(lax.recharge, 0); assert.strictEqual(lax.acted, true, 'the recharge turn is spent'); assert(up.some(e => e.type === 'recharge' && e.done));
  assert(g.dangerZones(0).trainer.size > 0, 'once recharged it threatens the following phase again');
  // AI: with a same-range alternative the beam is only fired to finish a target
  arena(T); const ai = place(T, 40, 40, 1, 1, 1), target = place(T, 95, 40, 0, 3, 1); // Wigglytuff: Hyper Beam, Body Slam, Moonblast (1-2)
  assert(ai.moves.some(m => m.name === 'Hyper Beam') && ai.moves.some(m => m.name === 'Moonblast'));
  let d = g.aiDecide(ai); assert(d && d.move, 'AI attacks'); assert.strictEqual(d.move.name, 'Moonblast', 'no lost turn against a healthy target');
  target.hp = 1; ai.x = 1; ai.y = 1; d = g.aiDecide(ai); assert(d && d.target === target && g.calcDmg(ai, target, d.move, g.terrAt(target.x, target.y)) >= 1, 'AI finishes the weak target');
});

test('XP, level up, evolution and restore keep stats and progress', T => {
  const { g, C } = T; arena(T); fixedRoll(T, .5);
  const cat = place(T, 10, 6, 0, 1, 1), rat = place(T, 19, 2, 1, 2, 1, { hp: 1 }); cat.xp = 90;
  const ev = g.resolveCombat(cat, rat, move(cat, 'Bug Bite'), cat);
  assert(ev.some(e => e.type === 'ko'), 'Rattata down'); assert(ev.some(e => e.type === 'levelup'), 'Caterpie levels'); assert(ev.some(e => e.type === 'evolve'), 'and evolves');
  assert.strictEqual(cat.num, 11); assert.strictEqual(cat.level, 7); assert(cat.hp > 0 && cat.hp <= cat.maxHp);
  const r = g.restoreUnit(g.serializeUnit(cat)); for (const k of ['num', 'level', 'xp', 'hp', 'maxHp', 'atk', 'def', 'hpBonus']) assert.strictEqual(r[k], cat[k], 'restore ' + k);
  assert.strictEqual(r.moves.map(m => m.name).join(), cat.moves.map(m => m.name).join());
});

test('resuming a start-of-turn suspend save does not apply upkeep a second time', T => {
  const { g, G, C } = T;
  g.startBattle(C.CHAPTERS[0].map, [g.partyUnit(4, 5), g.partyUnit(25, 5), g.partyUnit(7, 5)], { pokeball: 1 }, { chapter: 0, seed: 7, defer: true });
  let B = T.B(); const char = B.units.find(u => u.num === 4), pika = B.units.find(u => u.num === 25), squirt = B.units.find(u => u.num === 7);
  char.x = 0; char.y = 5; char.hp = char.maxHp - 10; char.status = 'par'; // on the Poké Center
  pika.status = 'psn'; squirt.recharge = 1; G('BT.fast = true');
  g.beginPhase(0, true);
  const after = { char: char.hp, pika: pika.hp, turn: B.turn }; assert.strictEqual(char.status, null); assert.strictEqual(pika.hp, pika.maxHp - Math.max(1, Math.floor(pika.maxHp / 8))); assert.strictEqual(squirt.acted, true);
  const rec = JSON.parse(T.store.get('pk_suspend')); assert(rec, 'suspend written'); assert.strictEqual(rec.units.find(u => u.num === 25).hp, after.pika, 'save holds post-upkeep HP'); assert.strictEqual(rec.units.find(u => u.num === 7).acted, true, 'save holds the spent recharge turn');
  g.resumeSuspend(); B = T.B(); assert.notStrictEqual(B.units.find(u => u.num === 4), char, 'a fresh battle object');
  const char2 = B.units.find(u => u.num === 4), pika2 = B.units.find(u => u.num === 25), squirt2 = B.units.find(u => u.num === 7);
  assert.strictEqual(pika2.hp, after.pika, 'poison did not tick again'); assert.strictEqual(char2.hp, after.char, 'center did not heal again'); assert.strictEqual(char2.status, null);
  assert.strictEqual(squirt2.acted, true, 'reload does not refund the recharge turn'); assert.strictEqual(squirt2.recharge, 0); assert.strictEqual(B.turn, after.turn); assert.strictEqual(B.phase, 0);
  assert.strictEqual(char2.maxHp, char.maxHp, 'party HP edge survives the resume');
});

// Stage 1 review follow-ups: live status mid-exchange, immunity, guaranteed cures in the danger zone, drain vs overkill.
test('a defender frozen by the first hit neither counters nor doubles; a paralyzed attacker loses its double', T => {
  const { g } = T; arena(T); fixedRoll(T, 0); // every roll succeeds: hits land, status procs
  const jynx = place(T, 124, 30, 0, 2, 2), cat = place(T, 10, 30, 1, 3, 2); jynx.spe = cat.spe = 30; jynx.hp = jynx.maxHp = cat.hp = cat.maxHp = 1000; cat.moves = [T.G('MOVES').Tackle];
  const fc = g.forecast(jynx, cat, move(jynx, 'Ice Beam'), jynx); assert(fc.c, 'the preview still lists the counter (freeze is a 10% chance)');
  const ev = g.resolveCombat(jynx, cat, move(jynx, 'Ice Beam'), jynx);
  assert.strictEqual(cat.status, 'frz'); assert(!ev.some(e => e.counter), 'no counter from a frozen defender: ' + kinds(ev)); assert.strictEqual(jynx.hp, jynx.maxHp);
  // Rapidash doubles Slowpoke, but a paralyzing counter (Lick) cancels the second strike
  arena(T); fixedRoll(T, 0); const fast = place(T, 78, 20, 1, 1, 1), slow = place(T, 79, 20, 2, 2, 1); fast.hp = fast.maxHp = slow.hp = slow.maxHp = 1000; slow.moves = [T.G('MOVES').Lick];
  const fc2 = g.forecast(fast, slow, move(fast, 'Ember'), fast); assert.strictEqual(fc2.strikes.map(s => s.side).join(' '), 'a c a');
  const ev2 = g.resolveCombat(fast, slow, move(fast, 'Ember'), fast);
  assert.strictEqual(fast.status, 'par'); assert.strictEqual(kinds(ev2), 'hit hit*', 'the double is gone once paralyzed');
});

test('type immunity blocks damage, status and drain alike', T => {
  const { g } = T; arena(T); fixedRoll(T, 0);
  const pika = place(T, 25, 30, 0, 2, 2), dig = place(T, 50, 30, 1, 3, 2); pika.hp = pika.maxHp = dig.hp = dig.maxHp = 1000;
  const ev = g.resolveCombat(pika, dig, move(pika, 'Thunderbolt'), pika);
  assert.strictEqual(ev[0].dmg, 0); assert.strictEqual(ev[0].status, null); assert.strictEqual(dig.status, null, 'Ground is immune to Electric, so no paralysis');
  // and a Normal move cannot drain from a Ghost
  arena(T); fixedRoll(T, 0); const kiss = place(T, 36, 30, 0, 2, 2), gast = place(T, 92, 30, 1, 3, 2); kiss.hp = 10; kiss.moves = [Object.assign({}, T.G('MOVES').Tackle, { eff: { drain: .5 } })]; gast.hp = gast.maxHp = 500;
  const fc = g.forecast(kiss, gast, kiss.moves[0], kiss); assert.strictEqual(fc.strikes[0].drain, 0, 'preview: nothing to drain');
  const ev3 = g.resolveCombat(kiss, gast, kiss.moves[0], kiss); assert.strictEqual(ev3[0].dmg, 0, 'Normal cannot hit Ghost'); assert.strictEqual(ev3[0].drain, 0); assert.strictEqual(ev3[0].attHpAfter, 10, 'no healing on an immune target');
});

test('danger zone previews guaranteed upkeep cures without touching the unit', T => {
  const { g, C } = T; arena(T, Array(15).fill('.'.repeat(15)));
  const e = place(T, 25, 10, 1, 2, 2); e.status = 'par'; e.statusTurns = 2; // cured at its next upkeep (3 turns)
  const snap = JSON.stringify(g.serializeUnit(e));
  assert(g.dangerZone(0).has(C.key(8, 2)), 'full move after the guaranteed cure'); assert.strictEqual(JSON.stringify(g.serializeUnit(e)), snap, 'no mutation');
  e.statusTurns = 0; assert(!g.dangerZone(0).has(C.key(8, 2)), 'still paralyzed next phase: reduced reach');
  arena(T, ['C..............'].concat(Array(14).fill('.'.repeat(15)))); const c = place(T, 25, 10, 1, 0, 0); c.status = 'par'; c.statusTurns = 0;
  assert(g.dangerZone(0).has(C.key(7, 0)), 'a Poké Center cures whatever the timer says');
  const w = place(T, 16, 10, 2, 10, 10); w.status = 'frz'; w.statusTurns = 1; const z = g.dangerZones(0); assert(z.wild.size > 0, 'a wild unit sure to thaw is a wild threat'); assert(!z.trainer.has(C.key(10, 9)), 'zones stay separate');
  w.recharge = 1; assert.strictEqual(g.dangerZones(0).wild.size, 0, 'recharge still wins');
});

test('drain heals from HP actually taken, not overkill, in preview and resolver', T => {
  const { g } = T; arena(T); fixedRoll(T, .5);
  const ven = place(T, 3, 30, 0, 2, 2), onix = place(T, 95, 30, 1, 3, 2); ven.hp = 10; onix.hp = 1;
  const m = move(ven, 'Giga Drain'); const fc = g.forecast(ven, onix, m, ven); assert(fc.a.dmg > 2, 'a big hit'); assert.strictEqual(fc.strikes[0].drain, 1); assert.strictEqual(fc.hpA, 11);
  const ev = g.resolveCombat(ven, onix, m, ven); assert.strictEqual(ev[0].drain, 1); assert.strictEqual(ev[0].attHpAfter, 11); assert.strictEqual(ven.hp, 11); assert.strictEqual(onix.hp, 0);
  arena(T); fixedRoll(T, .5); const v2 = place(T, 3, 30, 0, 2, 2), o2 = place(T, 95, 30, 1, 3, 2); v2.hp = 10; o2.hp = 7;
  const fc2 = g.forecast(v2, o2, m, v2); assert.strictEqual(fc2.strikes[0].drain, Math.floor(7 * .5)); const ev2 = g.resolveCombat(v2, o2, m, v2); assert.strictEqual(ev2[0].drain, 3); assert.strictEqual(v2.hp, 13);
});

// Stage 2: the duel scene replays the resolver's events; it never rerolls, never touches units, and skipping lands on the same numbers.
const sceneEvents = ev => ev.filter(e => ['hit', 'miss', 'ko', 'thaw'].includes(e.type));
// Play a duel queue item to the end in fixed steps; optionally skip part-way. Returns the beats fired and the HP shown at the end.
function playDuel(T, q, skipAt = -1, boostAt = -1) {
  const g = T.g; g.startDuel(q); let n = 0;
  while (!q.done && n++ < 5000) { g.updateDuel(q, 1 / 60); if (boostAt >= 0 && q.t >= boostAt && !q.boost) g.duelInput(q, { type: 'key', key: 'ok' }); if (skipAt >= 0 && q.t >= skipAt && !q.skipped) g.skipDuel(q); }
  assert(q.done, 'duel finished'); return { fired: q.i, frames: n, hpA: g.duelHpAt(q.script, q.t, q.att.id), hpD: g.duelHpAt(q.script, q.t, q.def.id), t: q.t };
}

test('duel script mirrors the resolver: pre-hit HP holds, drops in event order, skipping matches playing', T => {
  const { g, G } = T; arena(T); fixedRoll(T, .5);
  const att = place(T, 25, 20, 0, 1, 1), def = place(T, 79, 20, 1, 2, 1); // Pikachu doubles Slowpoke, which answers in between
  const hp0 = { [att.id]: att.hp, [def.id]: def.hp }; const ev = g.resolveCombat(att, def, move(att, 'Thunder Shock'), att);
  const hits = ev.filter(e => e.type === 'hit'); assert.strictEqual(hits.length, 3); assert(def.hp < hp0[def.id] && att.hp < hp0[att.id], 'both took damage');
  G('var __rolls = 0; rnd = () => { __rolls++; return .5; }'); const S = g.duelScript(sceneEvents(ev), hp0);
  assert.strictEqual(S.beats.map(b => b.kind).join(' '), 'intro windup launch impact windup launch impact windup launch impact outro');
  const impacts = S.beats.filter(b => b.kind === 'impact');
  impacts.forEach((b, i) => { const e = hits[i]; assert.strictEqual(b.ev, e); assert.strictEqual(b.hpTo, e.hpAfter, 'impact ' + i + ' lands on the event HP'); assert.strictEqual(b.hpFrom - b.hpTo, Math.min(e.dmg, b.hpFrom), 'impact ' + i + ' drops exactly the HP taken'); assert.strictEqual(b.attTo, e.attHpAfter); });
  assert.strictEqual(impacts[0].hpFrom, hp0[def.id], 'the first hit starts from the pre-exchange HP, not the model HP'); assert.strictEqual(S.beats[4].counter, true, 'the counter is labelled');
  assert.strictEqual(S.hpEnd[def.id], def.hp); assert.strictEqual(S.hpEnd[att.id], att.hp);
  // shown HP: untouched until the first impact, then never rising for the defender, final at the end
  assert.strictEqual(g.duelHpAt(S, impacts[0].t - .01, def.id), hp0[def.id]); assert.strictEqual(g.duelHpAt(S, impacts[0].t - .01, att.id), hp0[att.id]);
  let last = hp0[def.id]; for (let t = 0; t <= S.total; t += .02) { const v = g.duelHpAt(S, t, def.id); assert(v <= last, 'defender HP never rises'); last = v; }
  assert.strictEqual(g.duelHpAt(S, S.total, def.id), def.hp); assert.strictEqual(g.duelHpAt(S, S.total, att.id), att.hp);
  assert.strictEqual(G('__rolls'), 0, 'building the script rolled dice');
  assert(S.total >= 2 && S.total <= 4.2, 'a three-strike exchange runs ' + S.total.toFixed(2) + 's');
  // playing through, speeding up and skipping all reach the same numbers, and none of them touches the units
  const snap = () => JSON.stringify([g.serializeUnit(att), g.serializeUnit(def)]); const before = snap(); const kills = T.B().kills;
  const mk = () => ({ kind: 'duel', att, def, events: sceneEvents(ev), hp0 });
  const full = playDuel(T, mk()); const skipped = playDuel(T, mk(), impacts[0].t + .05); const fast = playDuel(T, mk(), -1, S.intro); // one key press after the wipe
  assert.strictEqual(full.fired, S.beats.length, 'every beat fired'); assert.strictEqual(full.hpD, def.hp); assert.strictEqual(full.hpA, att.hp);
  for (const r of [skipped, fast]) { assert.strictEqual(r.hpD, full.hpD); assert.strictEqual(r.hpA, full.hpA); assert.strictEqual(r.fired, S.beats.length, 'skip and boost still pass every beat'); }
  assert(fast.t >= S.total, 'speeding up still reaches the end of the script'); assert(fast.frames < full.frames * .5, 'boost: ' + fast.frames + ' frames vs ' + full.frames); assert(skipped.frames < fast.frames, 'skip: ' + skipped.frames + ' frames');
  G("setPref('battle', 'quick')"); assert.strictEqual(G("localStorage.getItem('pk_battle')"), 'quick'); const quick = playDuel(T, mk()); G("setPref('battle', 'full')");
  assert(quick.frames < full.frames * .7 && quick.frames > skipped.frames, 'quick preference: ' + quick.frames + ' frames'); assert.strictEqual(quick.hpD, full.hpD); assert.strictEqual(quick.hpA, full.hpA);
  assert.strictEqual(snap(), before, 'the scene mutated a unit'); assert.strictEqual(T.B().kills, kills, 'no KO here'); assert.strictEqual(G('__rolls'), 0, 'the scene rolled dice');
});

test('combatQueue: one duel item carries the strikes, XP follows on the board, a KO is counted once in either mode', T => {
  const { g, G } = T; arena(T); fixedRoll(T, .5); G("setPref('battle', 'full')");
  const att = place(T, 6, 30, 0, 1, 1), def = place(T, 10, 3, 1, 2, 1); const B = T.B(); B.kills = 0;
  const q = g.combatQueue(att, def, move(att, 'Flamethrower'), att);
  assert.strictEqual(q[0].kind, 'duel'); assert.strictEqual(q[0].events.map(e => e.type).join(' '), 'hit ko'); assert.strictEqual(JSON.stringify(q[0].hp0), JSON.stringify({ [att.id]: att.maxHp, [def.id]: def.maxHp }), 'snapshot taken before the roll');
  assert(q.slice(1).every(x => x.kind === 'event' && !['hit', 'miss', 'ko', 'thaw'].includes(x.ev.type)), 'the rest stays on the board'); assert(q.slice(1).some(x => x.ev.type === 'xp'), 'XP still awarded once, after the scene');
  // the KO is booked when the scene starts, exactly once, and the ko beat comes before the outro
  const r = playDuel(T, q[0]); assert.strictEqual(B.kills, 1); g.noteKo(q[0].events[1]); assert.strictEqual(B.kills, 1, 'a second look at the same event does not count again');
  const kinds = q[0].script.beats.map(b => b.kind); assert.strictEqual(kinds.slice(-2).join(' '), 'ko outro'); assert.strictEqual(r.hpD, 0);
  // the board's HP bars are held at the pre-exchange value while the scene runs, then released
  const q2 = g.combatQueue(place(T, 25, 30, 0, 4, 4), place(T, 19, 30, 1, 5, 4), T.G('MOVES')['Thunder Shock'], { x: 4, y: 4 })[0];
  assert.strictEqual(q2.kind, 'duel'); g.startDuel(q2); const BT = G('BT'); const held = BT.hpShow.get(q2.def.id); assert(held && held.hold && held.from === q2.hp0[q2.def.id], 'board bar held at pre-hit HP');
  while (!q2.done) g.updateDuel(q2, 1 / 30); assert(!BT.hpShow.has(q2.def.id), 'hold released at the outro');
  // map mode: the same events become board strikes, and the board's KO event counts once too
  G("setPref('battle', 'map')"); arena(T); fixedRoll(T, .5); const a2 = place(T, 6, 30, 0, 1, 1), d2 = place(T, 10, 3, 1, 2, 1); T.B().kills = 0;
  const qm = g.combatQueue(a2, d2, move(a2, 'Flamethrower'), a2); assert.strictEqual(qm[0].kind, 'strike'); assert.strictEqual(qm[1].ev.type, 'ko');
  g.setupEvent(qm[1]); g.setupEvent(qm[1]); assert.strictEqual(T.B().kills, 1);
  assert.strictEqual(G("localStorage.getItem('pk_battle')"), 'map', 'preference persisted'); G("setPref('battle', 'full')");
});

test('duel beats for a miss, an immune hit, drain and a lethal counter; sides put the player on the left', T => {
  const { g } = T; arena(T); fixedRoll(T, 1);
  const pika = place(T, 25, 20, 0, 1, 1), lax = place(T, 143, 20, 2, 2, 1); const hp0 = { [pika.id]: pika.hp, [lax.id]: lax.hp };
  let ev = g.resolveCombat(pika, lax, move(pika, 'Thunder Shock'), pika); assert.strictEqual(ev[0].type, 'miss');
  let S = g.duelScript(sceneEvents(ev), hp0); assert(S.beats.some(b => b.kind === 'miss')); assert(!S.beats.some(b => b.kind === 'impact' && b.def === lax), 'no impact on a miss');
  assert.strictEqual(g.duelHpAt(S, S.total, lax.id), hp0[lax.id], 'HP untouched by a miss');
  arena(T); fixedRoll(T, 0); const p2 = place(T, 25, 30, 0, 2, 2), dig = place(T, 50, 30, 1, 3, 2); p2.hp = p2.maxHp = dig.hp = dig.maxHp = 1000; const h2 = { [p2.id]: 1000, [dig.id]: 1000 };
  ev = g.resolveCombat(p2, dig, move(p2, 'Thunderbolt'), p2); S = g.duelScript(sceneEvents(ev), h2); const imm = S.beats.find(b => b.kind === 'impact' && b.def === dig);
  assert(imm && imm.hpFrom === imm.hpTo && imm.ev.dmg === 0, 'an immune hit shows a 0 with no drop');
  arena(T); fixedRoll(T, .5); const ven = place(T, 3, 30, 0, 2, 2), onix = place(T, 95, 30, 1, 3, 2); ven.hp = 10; const h3 = { [ven.id]: 10, [onix.id]: onix.hp };
  ev = g.resolveCombat(ven, onix, move(ven, 'Giga Drain'), ven); S = g.duelScript(sceneEvents(ev), h3); const dr = S.beats.find(b => b.kind === 'impact');
  assert(dr.attTo > dr.attFrom, 'drain raises the attacker'); assert.strictEqual(g.duelHpAt(S, dr.t - .01, ven.id), 10); assert.strictEqual(g.duelHpAt(S, S.total, ven.id), ven.hp);
  // a counter that KOs the attacker: impact, counter impact, ko, outro; the KO'd side reads 0
  arena(T); fixedRoll(T, .5); const weak = place(T, 25, 20, 0, 1, 1, { hp: 1 }), big = place(T, 143, 20, 1, 2, 1); const h4 = { [weak.id]: 1, [big.id]: big.hp };
  ev = g.resolveCombat(weak, big, move(weak, 'Thunder Shock'), weak); assert.strictEqual(kinds(ev), 'hit hit* ko');
  S = g.duelScript(sceneEvents(ev), h4); assert.strictEqual(S.beats.map(b => b.kind).join(' '), 'intro windup launch impact windup launch impact ko outro');
  assert.strictEqual(S.beats.find(b => b.kind === 'ko').unit, weak); assert.strictEqual(g.duelHpAt(S, S.total, weak.id), 0);
  const sides = g.duelSides(big, weak); assert.strictEqual(sides.left, weak, 'the player stands on the left even when attacked'); assert.strictEqual(g.duelSides(weak, big).left, weak);
  const wild = place(T, 16, 5, 2, 4, 4); assert.strictEqual(g.duelSides(big, wild).left, wild, 'wild before enemy trainer'); assert.strictEqual(g.duelSides(wild, weak).left, weak);
  assert.strictEqual(g.duelFamily(T.G('MOVES').Tackle), 'contact'); assert.strictEqual(g.duelFamily(T.G('MOVES')['Ice Shard']), 'contact'); assert.strictEqual(g.duelFamily(T.G('MOVES').Ember), 'fire'); assert.strictEqual(g.duelFamily(T.G('MOVES')['Hyper Beam']), 'neutral');
});

test('duel layout keeps panels, terrain strips and 96px sprites on screen on desktop and narrow portrait', T => {
  const { g, G } = T; arena(T); const a = place(T, 25, 20, 0, 1, 1), d = place(T, 79, 20, 1, 2, 1); const q = { sides: g.duelSides(a, d) };
  for (const [w, h] of [[480, 270], [390, 844], [300, 600], [320, 480], [1024, 600]]) {
    G('VIEW.w = ' + w + '; VIEW.h = ' + h); const L = g.duelLayout(q); const pa = L.panels[a.id], pd = L.panels[d.id];
    for (const p of [pa, pd]) { assert(p.x >= 0 && p.x + p.w <= w, w + 'x' + h + ': panel inside'); assert(p.w >= 120, 'panel wide enough for name, level and HP'); assert(p.y + p.h + 2 + L.TH <= L.top, 'terrain strip above the field'); }
    if (!L.stacked) assert(pa.x + pa.w < pd.x, 'side-by-side panels do not overlap'); else assert(pa.y + pa.h + L.TH < pd.y, 'stacked panels do not overlap');
    for (const id of [a.id, d.id]) { const p = L.pos[id]; assert(p.x - 48 >= 0 && p.x + 48 <= w, w + 'x' + h + ': sprite inside'); assert(p.y - 96 >= L.top, 'sprite below the panels'); assert(p.y <= h - 20, 'ground above the hint line'); }
    assert(L.pos[a.id].x + 48 <= L.pos[d.id].x - 48 + 8, 'sprites do not overlap at rest');
  }
});

test('an attack runs through the board queue: duel, then XP on the board, then the unit is spent; map mode ends the same', T => {
  const { g, G } = T;
  for (const pref of ['full', 'quick', 'map']) {
    G("setPref('battle', '" + pref + "')"); arena(T); fixedRoll(T, .5); const BT = G('BT');
    const att = place(T, 6, 30, 0, 1, 1), def = place(T, 10, 3, 1, 2, 1); place(T, 19, 3, 1, 6, 4); // a second foe keeps the map going after the KO
    BT.sel = att; BT.targets = [def]; BT.tIdx = 0; BT.moveIdx = att.moves.indexOf(move(att, 'Flamethrower')); BT.mode = 'target';
    g.confirmAttack(); assert.strictEqual(BT.mode, 'anim'); const sawDuel = BT.anim && BT.anim.kind === 'duel'; assert.strictEqual(sawDuel, pref !== 'map', pref + ': presentation picked');
    let frames = 0, drew = 0; for (const [w, h] of [[480, 270], [300, 600]]) { G('VIEW.w = ' + w + '; VIEW.h = ' + h); while (BT.mode === 'anim' && frames++ < 2000) { g.battleUpdate(1 / 60); g.battleDraw(); drew++; if (BT.anim && BT.anim.kind === 'duel' && frames === 40) g.duelInput(BT.anim, { type: 'key', key: 'ok' }); } }
    assert.strictEqual(BT.mode, 'idle', pref + ': back on the board after ' + frames + ' frames'); assert(frames < 2000, 'finished in time'); assert(drew > 10);
    assert.strictEqual(def.hp, 0, 'Caterpie down'); assert.strictEqual(att.acted, true, 'attacker spent'); assert.strictEqual(T.B().kills, 1, pref + ': one KO counted'); assert(att.xp > 0, 'XP awarded once'); assert.strictEqual(BT.hpShow.size, 0, 'no held bars left');
  }
  G("setPref('battle', 'full')");
});

// Stage 2 review follow-ups: unique ids on real launches, presentation snapshots, honest drain.
const uniqueIds = (B, label) => { const ids = B.units.map(u => u.id); assert.strictEqual(new Set(ids).size, ids.length, label + ': duplicate unit ids ' + ids.join(',')); };
function walkNextTo(g, u, t) { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const x = t.x + dx, y = t.y + dy; if (g.inMap(x, y) && g.moveCost(g.terrAt(x, y), u) < 99 && !g.unitAt(x, y)) { u.x = x; u.y = y; return; } } assert.fail('no free tile beside ' + t.name); }

test('chapter launch, Versus and resume give every unit a unique id; the chapter-6 Charmeleon vs Voltorb duel has two sides', T => {
  const { g, G, C } = T; const ch = C.CHAPTERS[5]; const L = ch.level; assert.strictEqual(ch.title, 'Power Plant');
  const party = [4, 7, 1, 25, 133, 66].map(n => g.partyUnit(n, L)); assert(party.every(p => p.id), 'serialized party members carry ids from their own creation');
  g.startBattle(ch.map, party.slice(0, ch.slots), { pokeball: 1 }, { chapter: 5, seed: 7, defer: true }); const B = T.B(); uniqueIds(B, 'chapter 6');
  const char = B.units.find(u => u.team === 0 && u.num === 5), volt = B.units.find(u => u.team === 1 && u.num === 100); assert(char && volt, 'Charmeleon and a Voltorb are on the board');
  walkNextTo(g, char, volt); fixedRoll(T, .5); const q = g.combatQueue(char, volt, move(char, 'Ember'), char)[0]; assert.strictEqual(q.kind, 'duel');
  g.startDuel(q); assert.strictEqual(Object.keys(q.hp0).length, 2); assert.strictEqual(Object.keys(q.terr).length, 2); assert.strictEqual(Object.keys(q.view).length, 2);
  const Lay = g.duelLayout(q); assert.strictEqual(Object.keys(Lay.panels).length, 2); assert.strictEqual(Object.keys(Lay.pos).length, 2); assert.notStrictEqual(Lay.pos[char.id].x, Lay.pos[volt.id].x);
  assert.strictEqual(q.sides.left, char); assert.strictEqual(q.sides.right, volt); assert.strictEqual(q.view[char.id].name, 'Charmeleon'); assert.strictEqual(q.view[volt.id].name, 'Voltorb');
  while (!q.done) g.updateDuel(q, 1 / 30); assert.strictEqual(g.duelHpAt(q.script, q.t, volt.id), volt.hp); assert.strictEqual(g.duelHpAt(q.script, q.t, char.id), char.hp);
  // a reinforcement and a wild catch keep getting fresh ids after the party import
  const extra = g.makeUnit(100, L, 1, { x: 0, y: 0 }); B.units.push(extra); uniqueIds(B, 'after spawn');
  // Versus: two imported parties plus wild
  g.launchVersus({ seed: 5, level: 20, wild: true, teams: [[25, 5, 8, 2], [25, 5, 8, 2]], order: [0, 1, 1, 0], size: 4, cur: 0 }); uniqueIds(T.B(), 'versus');
  // the deep-link chapter path
  g.startBattle(C.CHAPTERS[0].map, [g.partyUnit(4, 5), g.partyUnit(7, 5), g.partyUnit(1, 5)], { pokeball: 1 }, { chapter: 0, seed: 7, defer: true }); uniqueIds(T.B(), 'chapter 1');
  // resume: a save written by the old code with the party's ids colliding with enemies is renumbered, a clean save is kept
  G('BT.fast = true'); g.beginPhase(0, true); const rec = JSON.parse(T.store.get('pk_suspend')); const old = rec.units.map(u => u.id); assert.strictEqual(new Set(old).size, old.length, 'suspend holds unique ids');
  rec.units.filter(u => u.team === 0).forEach((u, i) => { u.id = i + 1; }); T.store.set('pk_suspend', JSON.stringify(rec)); g.resumeSuspend(); uniqueIds(T.B(), 'resumed legacy save');
  const enemyIds = T.B().units.filter(u => u.team === 1).map(u => u.id); assert(enemyIds.every(id => rec.units.some(u => u.team === 1 && u.id === id)), 'enemy ids are the saved ones');
  const fresh = g.makeUnit(19, 5, 2, { x: 0, y: 0 }); assert(!T.B().units.some(u => u.id === fresh.id), 'new units never reuse an active id');
});

test('the scene shows the pre-exchange identity, level, max HP and status; the model still ends evolved', T => {
  const { g, G } = T;
  for (const pref of ['full', 'quick']) {
    G("setPref('battle', '" + pref + "')"); arena(T); fixedRoll(T, .5); const BT = G('BT');
    const cat = place(T, 10, 6, 0, 1, 1), rat = place(T, 19, 2, 1, 2, 1, { hp: 1 }); place(T, 19, 3, 1, 6, 4); cat.xp = 90; const before = { name: cat.name, num: cat.num, level: cat.level, maxHp: cat.maxHp };
    const q = g.combatQueue(cat, rat, move(cat, 'Bug Bite'), cat); assert.strictEqual(cat.num, 11, 'the model has already evolved'); assert.strictEqual(cat.level, 7);
    const v = q[0].view[cat.id]; assert.strictEqual(v.name, 'Caterpie'); assert.strictEqual(v.num, before.num); assert.strictEqual(v.level, 6); assert.strictEqual(v.maxHp, before.maxHp); assert.strictEqual(q[0].hp0[cat.id], before.maxHp);
    assert.strictEqual(cat.fx.showNum, 10, 'the board keeps drawing Caterpie until the evolution plays'); assert(q.some(x => x.kind === 'event' && x.ev.type === 'evolve'), 'evolution queued after the scene');
    BT.queue = q.slice(); g.playQueue(() => { BT.mode = 'idle'; }); let frames = 0, sawScene = false, sawEvolve = false;
    while (BT.mode === 'anim' && frames++ < 3000) { g.battleUpdate(1 / 60); g.battleDraw(); if (BT.anim && BT.anim.kind === 'duel') { sawScene = true; assert.strictEqual(BT.anim.view[cat.id].num, 10, 'scene draws Caterpie'); if (frames === 30 && pref === 'quick') g.skipDuel(BT.anim); } if (BT.anim && BT.anim.kind === 'event' && BT.anim.ev.type === 'evolve') { sawEvolve = true; if (BT.anim.t < BT.anim.dur * .5) assert.strictEqual(cat.fx.showNum, 10, 'still Caterpie until the evolution is half way'); } }
    assert(sawScene && sawEvolve && BT.mode === 'idle', pref + ': scene then evolution then back'); assert.strictEqual(cat.fx.showNum, null, 'shown as its real form afterwards'); assert.strictEqual(cat.num, 11); assert.strictEqual(cat.level, 7); assert.strictEqual(cat.hp, Math.min(cat.maxHp, cat.hp), 'model untouched');
  }
  G("setPref('battle', 'full')");
  // a status inflicted by the first hit appears on that hit's impact, not at the start; skipping ends with it shown
  arena(T); fixedRoll(T, 0); const jynx = place(T, 124, 30, 0, 2, 2), cat2 = place(T, 10, 30, 1, 3, 2); jynx.hp = jynx.maxHp = cat2.hp = cat2.maxHp = 1000;
  const q2 = g.combatQueue(jynx, cat2, move(jynx, 'Ice Beam'), jynx)[0]; assert.strictEqual(cat2.status, 'frz', 'model already frozen'); assert.strictEqual(q2.view[cat2.id].status, null, 'snapshot taken before the hit');
  g.startDuel(q2); const imp = q2.script.beats.find(b => b.kind === 'impact'); while (q2.t < imp.t - .02) { g.updateDuel(q2, 1 / 60); assert.strictEqual(q2.view[cat2.id].status, null, 'no badge before impact'); }
  while (!q2.done) g.updateDuel(q2, 1 / 60); assert.strictEqual(q2.view[cat2.id].status, 'frz', 'badge after the impact beat');
  const q3 = g.combatQueue(jynx, cat2, move(jynx, 'Ice Beam'), jynx)[0]; g.startDuel(q3); g.updateDuel(q3, .05); g.skipDuel(q3); while (!q3.done) g.updateDuel(q3, 1 / 60); assert.strictEqual(q3.view[cat2.id].status, 'frz', 'skip applies the status too'); assert.strictEqual(q3.view[cat2.id].status, q3.view[cat2.id].status);
  // a thaw beat clears the frozen badge shown from the snapshot
  arena(T); fixedRoll(T, .5); const fire = place(T, 6, 30, 0, 2, 2), ice = place(T, 143, 30, 1, 3, 2); ice.status = 'frz'; ice.hp = ice.maxHp = 2000; fire.hp = fire.maxHp = 2000;
  const q4 = g.combatQueue(fire, ice, move(fire, 'Flamethrower'), fire)[0]; assert(q4.events.some(e => e.type === 'thaw')); assert.strictEqual(q4.view[ice.id].status, 'frz'); g.startDuel(q4);
  const th = q4.script.beats.find(b => b.kind === 'thaw'); while (q4.t < th.t - .02) g.updateDuel(q4, 1 / 60); assert.strictEqual(q4.view[ice.id].status, 'frz', 'frozen until the thaw beat'); while (!q4.done) g.updateDuel(q4, 1 / 60); assert.strictEqual(q4.view[ice.id].status, null);
});

test('drain reports the HP actually restored: nothing at full HP, the missing HP when nearly full, never overkill', T => {
  const { g } = T;
  const setup = (attHp, defHp) => { arena(T); fixedRoll(T, .5); const ven = place(T, 3, 30, 0, 2, 2), onix = place(T, 95, 30, 1, 3, 2); if (attHp != null) ven.hp = attHp; if (defHp != null) onix.hp = defHp; return [ven, onix]; };
  let [ven, onix] = setup(null, null); const m = move(ven, 'Giga Drain'); let fc = g.forecast(ven, onix, m, ven); assert(fc.a.dmg > 4);
  assert.strictEqual(fc.strikes[0].drain, 0, 'full HP: preview promises no healing'); assert.strictEqual(fc.hpA, ven.maxHp);
  let ev = g.resolveCombat(ven, onix, m, ven); assert.strictEqual(ev[0].drain, 0, 'full HP: event shows no healing'); assert.strictEqual(ev[0].attHpAfter, ven.maxHp); assert.strictEqual(ven.hp, ven.maxHp);
  let S = g.duelScript(sceneEvents(ev), { [ven.id]: ven.maxHp, [onix.id]: onix.maxHp }); assert.strictEqual(S.beats.find(b => b.kind === 'impact').attTo, ven.maxHp);
  [ven, onix] = setup(null, null); ven.hp = ven.maxHp - 1; fc = g.forecast(ven, onix, m, ven); assert.strictEqual(fc.strikes[0].drain, 1, 'nearly full: only the missing point'); assert.strictEqual(fc.hpA, ven.maxHp);
  ev = g.resolveCombat(ven, onix, m, ven); assert.strictEqual(ev[0].drain, 1); assert.strictEqual(ven.hp, ven.maxHp); assert.strictEqual(ev[0].attHpAfter, ven.maxHp);
  [ven, onix] = setup(null, 5); ven.hp = ven.maxHp - 3; fc = g.forecast(ven, onix, m, ven); assert.strictEqual(fc.strikes[0].drain, 2, 'overkill on 5 HP drains from 5, not the hit'); assert.strictEqual(fc.hpA, ven.maxHp - 1);
  ev = g.resolveCombat(ven, onix, m, ven); assert.strictEqual(ev[0].drain, 2); assert.strictEqual(ven.hp, ven.maxHp - 1); assert.strictEqual(onix.hp, 0);
  [ven, onix] = setup(null, 9); ven.hp = ven.maxHp - 2; fc = g.forecast(ven, onix, m, ven); assert.strictEqual(fc.strikes[0].drain, 2, 'floor(9/2)=4 capped by 2 missing'); ev = g.resolveCombat(ven, onix, m, ven); assert.strictEqual(ev[0].drain, 2); assert.strictEqual(ven.hp, ven.maxHp);
  // the scene only floats a heal popup when the event carries healing
  [ven, onix] = setup(null, null); const q = g.combatQueue(ven, onix, m, ven)[0]; g.startDuel(q); while (!q.done) g.updateDuel(q, 1 / 60); assert(!T.G('FX.texts').some(t => String(t.s).startsWith('+')) && q.script.beats.find(b => b.kind === 'impact').attFrom === q.script.beats.find(b => b.kind === 'impact').attTo, 'no +heal popup data at full HP');
});

// ---------------------------------------------------------------- runner
function run() {
  let failed = 0;
  for (const t of tests) {
    try { t.fn(loadGame()); console.log('  ok   ' + t.name); }
    catch (e) { failed++; console.log('  FAIL ' + t.name + '\n       ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n       ') : e)); }
  }
  console.log(failed ? `${failed} of ${tests.length} tests failed` : `${tests.length} tests passed`);
  process.exit(failed ? 1 : 0);
}
if (require.main === module) run(); else module.exports = { loadGame, arena, place }; // reusable headless harness
