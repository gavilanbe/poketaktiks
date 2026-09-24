#!/usr/bin/env node
// Deterministic model tests: node tools/model-tests.cjs
// Loads the game sources (same order as build.sh) into a vm context with a tiny DOM stub, so the
// real unit factory, combat model, upkeep, AI and suspend/resume flow run without a browser.
// Built-ins only. Exit code 1 on any failure.
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const FILES = ['core.js', 'i18n.js', 'lang/es.js', 'lang/es-data.js', 'lang/es-story.js', 'font.js', 'dex.js', 'data.js', 'animmeta.js', 'art.js', 'scenery.js', 'model.js', 'captain.js', 'battle.js', 'menus.js', 'duel.js', 'attackfx.js', 'campaign.js', 'war.js', 'territory.js', 'scenes.js', 'menukit.js', 'cofx.js', 'title.js', 'route.js', 'journey.js', 'modes.js', 'main.js'];

// ---------------------------------------------------------------- harness
// Tests run in English unless PK_LANG=es, which also records every drawn string that has no Spanish (tools/i18n-misses.txt).
const MISSES = [], EN = process.env.PK_LANG !== 'es'; // EN: wording checks run in English; layout checks run in both
function loadGame() {
  const store = new Map(); store.set('pk_lang', process.env.PK_LANG === 'es' ? 'es' : 'en');
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
  if (process.env.PK_LANG === 'es') { G('applyLang(); TRMISS = new Map(); TROUT = new Set()'); MISSES.push(() => G('TRMISS')); }
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
  arena(T, ['C..............'].concat(Array(14).fill('.'.repeat(15)))); const c = place(T, 25, 10, 1, 0, 0); c.status = 'par'; c.statusTurns = 0; T.B().war.props[0].owner = 1; // only an own center heals
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
  assert(S.total >= 2 && S.total <= 4.5, 'a three-strike exchange runs ' + S.total.toFixed(2) + 's'); // heavy moves (Body Slam's leap) take a little longer
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

test('attack choreographies: every move plays its own wind-up, travel and impact in the scene and on the board, error-free, rolling no dice, particles bounded; reduced motion stays calm', T => {
  const { g, G } = T; const MOVES = G('MOVES'), names = Object.keys(MOVES), BT = G('BT'), style = n => G('ATK_MOVE[' + JSON.stringify(n) + ']');
  for (const n of names) assert(style(n) && G('!!ATK[' + JSON.stringify(style(n)) + ']'), n + ' has a choreography of its own');
  assert(new Set(names.map(style)).size >= 50, 'the moves look different from each other');
  assert.strictEqual(G("atkStyleId({ name: 'Unknown', type: 'Fire', rng: [1, 1] })"), 'gcontact'); assert.strictEqual(G("atkStyleId({ name: 'Unknown', type: 'Fire', rng: [1, 2] })"), 'gshot');
  for (const n of names) { const m = 'MOVES[' + JSON.stringify(n) + ']', w = G('atkWindupTime(' + m + ')'), l = G('atkTravelTime(' + m + ', duelFamily(' + m + '))'); assert(w >= .2 && w <= .5 && l >= .12 && l <= .45, n + ' keeps a brisk pace (' + w + ' + ' + l + ')'); }
  // play every move through the real queue in both views; a choreography that throws is caught and reported here
  const errs = [], keepConsole = T.g.console; T.g.console = Object.assign({}, console, { error: (...a) => errs.push(a.map(String).join(' ')) });
  const play = (n, view) => {
    arena(T); G("PREF.battle = '" + view + "'"); const mv = MOVES[n], a = place(T, 25, 30, 0, 1, 1), d = place(T, 66, 30, 1, mv.rng[0] >= 2 ? 3 : 2, 1); d.hp = d.maxHp = 999; d.moves = []; a.moves = [mv];
    fixedRoll(T, .5); BT.queue = g.combatQueue(a, d, mv, a); G('var __r = 0; rnd = () => { __r++; return .5; }'); g.playQueue(() => { BT.mode = 'idle'; });
    let f = 0, peak = [0, 0]; while (BT.mode === 'anim' && f++ < 3000) { g.battleUpdate(1 / 60); g.battleDraw(); peak = [Math.max(peak[0], G('FX.sprites.length')), Math.max(peak[1], G('FX.parts.length'))]; }
    assert.strictEqual(BT.mode, 'idle', n + ' (' + view + ') finishes'); assert.strictEqual(G('__r'), 0, n + ' (' + view + ') rolls no dice while it plays'); return peak;
  };
  try {
    for (const view of ['full', 'map']) for (const n of names) { const [ps, pp] = play(n, view); assert(ps <= 360 && pp <= 700, n + ' (' + view + ') keeps its particles bounded: ' + ps + ' sprites, ' + pp + ' particles'); }
    assert.deepStrictEqual(errs, [], 'no choreography throws');
    G('REDUCED = true'); for (const n of ['Hyper Beam', 'Blizzard', 'Thunder', 'Surf', 'Earthquake', 'Rock Slide', 'Psychic', 'Outrage']) { const [ps] = play(n, 'full'); assert(ps <= 16, n + ' stays calm with reduced motion (' + ps + ' sprites)'); }
  } finally { G('REDUCED = false'); G("PREF.battle = 'full'"); T.g.console = keepConsole; }
});

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
test('duel layout keeps panels, terrain strips and 96px sprites on screen and apart, on desktop, tablets and phones', T => {
  const { g, G } = T; arena(T); const a = place(T, 25, 20, 0, 1, 1), d = place(T, 79, 20, 1, 2, 1); const q = { sides: g.duelSides(a, d) };
  for (const [w, h] of [[480, 270], [640, 360], [390, 844], [300, 600], [320, 480], [1024, 600], [195, 422], [180, 400], [207, 448], [256, 341]]) {
    G('VIEW.w = ' + w + '; VIEW.h = ' + h); const L = g.duelLayout(q); const pa = L.panels[a.id], pd = L.panels[d.id]; const tag = w + 'x' + h + ': ';
    const blocks = [pa, pd].map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h + 2 + L.TH })); // panel plus its terrain strip
    for (const p of blocks) { assert(p.x >= 0 && p.x + p.w <= w && p.y >= 0 && p.y + p.h <= h, tag + 'panel and strip inside'); assert(p.w >= 120, 'panel wide enough for name, level and HP'); }
    assert(!overlaps(blocks[0], blocks[1]), tag + 'panels do not overlap');
    const sprites = [a.id, d.id].map(id => ({ x: L.pos[id].x - 48, y: L.pos[id].y - 96, w: 96, h: 98 }));
    for (const s of sprites) { assert(s.x >= 0 && s.x + s.w <= w, tag + 'sprite inside'); assert(s.y >= L.top, tag + 'sprite below the top panel'); assert(s.y + s.h <= L.bottom + 8, tag + 'sprite above the bottom panel / hint'); for (const p of blocks) assert(!overlaps(s, p), tag + 'sprite clear of the panels'); }
    assert(L.pos[a.id].x + 48 <= L.pos[d.id].x - 48 + (w < 200 ? 18 : 8), tag + 'sprites do not overlap at rest (transparent margins allowed on the narrowest phones)');
    assert(L.hintY >= 0 && L.hintY + 8 <= h, tag + 'hint inside'); for (const p of blocks) assert(L.hintY + 8 <= p.y || L.hintY >= p.y + p.h, tag + 'hint clear of the panels');
    if (L.stacked) { assert(pd.y < L.pos[d.id].y - 96 && pa.y > L.pos[a.id].y, tag + 'portrait: foe panel above the field, own panel below it'); assert(L.gy >= h * .35 && L.gy <= h * .75, tag + 'portrait: the ground line sits in the middle band, not at the bottom (' + L.gy + ')'); }
  }
});

// Stage 3: scale rule, camera and zoom, pointer mapping, hover anchor, unit states, HUD layout and the forecast lines.
const SIZES = [[480, 270], [640, 360], [195, 422], [180, 400], [207, 448], [213, 378], [341, 455], [1024, 600]];
const inside = (r, w, h) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
test('scale rule: portrait phones land at 176-260 logical pixels, landscape keeps ~480-640, never under 176', T => {
  const { g } = T; const lw = (pw, ph, cw) => pw / g.pickScale(pw, ph, cw);
  for (const [pw, ph, cw] of [[390, 844, 390], [360, 780, 360], [1170, 2532, 390], [750, 1334, 375], [1290, 2796, 430], [412, 915, 412]]) { const w = lw(pw, ph, cw); assert(w >= 176 && w <= 260, cw + 'css portrait phone → ' + w + ' logical px'); }
  assert.strictEqual(g.pickScale(390, 844, 390), 2, 'the supervisor case: 390×844 at DPR 1 renders at ×2');
  for (const [pw, ph, cw] of [[1280, 720, 1280], [960, 540, 960], [1920, 1080, 1920], [2560, 1440, 1280], [844, 390, 844]]) { const w = lw(pw, ph, cw); assert(w >= 400 && w <= 700, cw + 'css landscape → ' + w); }
  for (const [pw, ph, cw] of [[320, 568, 320], [768, 1024, 768], [2048, 2732, 1024], [200, 300, 200]]) assert(lw(pw, ph, cw) >= 176, 'never narrower than 176: ' + cw);
  assert(g.pickScale(768, 1024, 768) >= 2 && lw(768, 1024, 768) >= 300, 'tablet portrait keeps room');
});

test('camera: fits the board between the HUD bands, clamps big maps, keeps the cursor and both fighters in the safe area, zooms to fit', T => {
  const { g, G, C } = T;
  for (const [w, h] of SIZES) {
    G('VIEW.w = ' + w + '; VIEW.h = ' + h); g.startBattle(C.CHAPTERS[5].map, [g.partyUnit(4, 20)], { pokeball: 1 }, { chapter: 5, seed: 7, defer: true }); const BT = G('BT'), CAM = G('CAM'); const tag = w + 'x' + h + ': ';
    const B = T.B(), mw = B.map.w * 32, mh = B.map.h * 32; assert.strictEqual(B.map.w, 20);
    const check = () => { const r = g.camRange(); assert(CAM.tx >= r.x[0] - 1e-9 && CAM.tx <= r.x[1] + 1e-9 && CAM.ty >= r.y[0] - 1e-9 && CAM.ty <= r.y[1] + 1e-9, tag + 'camera inside its range'); const R = g.hudReserve(); const bw = g.bvW(), bh = g.bvH();
      if (mw <= bw) assert(Math.abs(CAM.tx - (mw - bw) / 2) < 1, tag + 'a board narrower than the view is centred'); else assert(CAM.tx >= 0 && CAM.tx <= mw - bw, tag + 'no void shown beside a wide board');
      if (mh <= bh - R.top - R.bottom) { assert(-CAM.ty >= R.top - 1e-9, tag + 'board top clear of the turn card'); assert(-CAM.ty + mh <= bh - R.bottom + 1e-9, tag + 'board bottom clear of the bottom band'); } else assert(CAM.ty >= -R.top - 1e-9 && CAM.ty <= mh - bh + R.bottom + 1e-9, tag + 'a tall board pans at most to the HUD bands'); };
    check(); const z0 = BT.zoom; if (w < 300) assert(z0 === .5 || z0 === .75 || g.boardFits(1), tag + 'phones start zoomed to fit'); if (w < 300 && !g.boardFits(1)) assert(g.boardHeightFits(z0) || z0 === .5, tag + 'the opening zoom shows every row when a reduced zoom can'); else assert.strictEqual(z0, 1, tag + 'wide screens start at ×1');
    // zoom out and back keeps the camera valid; zooming in is only offered when the board does not fit
    if (g.canZoom()) { BT.zoom = 1; g.clampCam(); assert(g.setZoom(.5)); check(); assert(!g.setZoom(.5), 'already zoomed out'); assert(g.setZoom(1)); check(); } else assert(!g.setZoom(.5), tag + 'no zoom-out when the board fits');
    BT.zoom = 1; g.clampCam(); CAM.x = CAM.tx; CAM.y = CAM.ty;
    // the cursor at every corner of the board stays inside the view, clear of the HUD bands
    for (const [cx, cy] of [[0, 0], [B.map.w - 1, 0], [0, B.map.h - 1], [B.map.w - 1, B.map.h - 1], [10, 5]]) { BT.cx = cx; BT.cy = cy; g.keepCursorVisible(); check(); const sx = cx * 32 - CAM.tx, sy = cy * 32 - CAM.ty; const R = g.hudReserve(); assert(sx >= 0 && sx + 32 <= g.bvW(), tag + 'cursor ' + cx + ',' + cy + ' inside horizontally'); assert(sy >= R.top - 1e-9 && sy + 32 <= g.bvH() - R.bottom + 1e-9, tag + 'cursor ' + cx + ',' + cy + ' clear of the HUD bands (' + sy + ')'); }
    // both fighters of an exchange end up visible
    const a = B.units.find(u => u.team === 0), d = B.units.find(u => u.team === 1); a.x = 1; a.y = 1; d.x = 3; d.y = 2; CAM.tx = 400; CAM.ty = 100; g.clampCam(); g.centerCamBetween(a, d); check(); assert(g.unitVisible(a) && g.unitVisible(d), tag + 'both fighters in view');
    // a camera that already shows both does not move
    const before = [CAM.tx, CAM.ty]; if (g.unitVisible(a) && g.unitVisible(d)) { g.centerCamBetween(a, d); assert.deepStrictEqual([CAM.tx, CAM.ty], before, tag + 'no camera jump when both are visible'); }
  }
  G('VIEW.w = 480; VIEW.h = 270');
});

test('pointer mapping round-trips at both zoom levels; a resting pointer never moves the cursor after an overlay closes', T => {
  const { g, G } = T; G('VIEW.w = 480; VIEW.h = 270'); arena(T, Array(12).fill('.'.repeat(20))); const BT = G('BT'), CAM = G('CAM'), INPUT = G('INPUT');
  const me = place(T, 25, 10, 0, 3, 3); place(T, 19, 5, 1, 9, 6);
  for (const z of [1, .5]) { BT.zoom = z; CAM.tx = 37; CAM.ty = 21; CAM.x = CAM.tx; CAM.y = CAM.ty; for (const [x, y] of [[0, 0], [3, 3], [9, 6], [19, 11]]) { const sx = g.toScreenX(g.tileX(x)) + 2, sy = g.toScreenY(g.tileY(y)) + 2; const t = g.screenToTile(sx, sy); assert.deepStrictEqual([t.x, t.y], [x, y], 'zoom ' + z + ': tile ' + x + ',' + y + ' round trip'); } }
  BT.zoom = 1; CAM.tx = CAM.ty = 0; CAM.x = CAM.y = 0; BT.mode = 'idle'; BT.cx = 0; BT.cy = 0; g.battleUpdate(1 / 60);
  // the pointer rests over Pikachu while a menu closes: the cursor must not jump to it
  const px = 3 * 32 + 16, py = 3 * 32 + 16; INPUT.x = px; INPUT.y = py; BT.mode = 'menu'; g.battleUpdate(1 / 60); BT.mode = 'idle'; g.battleUpdate(1 / 60);
  g.battleInput({ type: 'move', x: px, y: py }); assert.deepStrictEqual([BT.cx, BT.cy], [0, 0], 'cursor stays put for a resting pointer');
  g.battleInput({ type: 'move', x: px + 2, y: py + 1 }); assert.deepStrictEqual([BT.cx, BT.cy], [0, 0], 'a jitter of a couple of pixels is still resting');
  g.battleInput({ type: 'move', x: px + 6, y: py }); assert.deepStrictEqual([BT.cx, BT.cy], [3, 3], 'a real movement drives the cursor again');
  g.battleInput({ type: 'move', x: 9 * 32 + 5, y: 6 * 32 + 5 }); assert.deepStrictEqual([BT.cx, BT.cy], [9, 6], 'and keeps doing so');
  // a wheel pans in screen pixels: the 640 px board scrolls at ×1, and at ×.5 it fits the 960 px view so the camera stays centred
  CAM.tx = 0; g.battleInput({ type: 'wheel', dx: 10, dy: 0 }); assert.strictEqual(CAM.tx, 10, 'wheel pans at ×1');
  BT.zoom = .5; g.clampCam(); const c0 = CAM.tx; g.battleInput({ type: 'wheel', dx: 10, dy: 0 }); assert.strictEqual(CAM.tx, c0, 'a board that fits does not scroll'); assert(c0 < 0, 'centred with void on both sides');
  BT.zoom = 1; assert(me.hp > 0);
});

test('unit look: acted units grey whatever the mode, unacted never grey during animations, foes never grey, ready only on the controlling team', T => {
  const { g, G } = T; arena(T); const BT = G('BT'); const B = T.B(); B.phase = 0;
  const a = place(T, 25, 10, 0, 1, 1), b = place(T, 4, 10, 0, 2, 1), e = place(T, 19, 10, 1, 5, 5); a.acted = true; b.acted = false; e.acted = true;
  BT.mode = 'idle'; assert.strictEqual(g.unitLook(a).grey, true); assert.strictEqual(g.unitLook(b).grey, false); assert.strictEqual(g.unitLook(b).ready, true); assert.strictEqual(g.unitLook(e).grey, false); assert.strictEqual(g.unitLook(e).ready, false);
  BT.mode = 'anim'; BT.anim = { kind: 'move', unit: b, path: [] }; assert.strictEqual(g.unitLook(b).grey, false, 'the moving unit is not grey'); assert.strictEqual(g.unitLook(a).grey, true, 'an acted unit stays grey while another animates'); assert.strictEqual(g.unitLook(b).ready, false, 'nothing reads as ready mid-animation');
  BT.anim = { kind: 'duel', att: a, def: e }; assert.strictEqual(g.unitLook(a).grey, false, 'a unit in the current exchange is drawn in colour even if flagged acted');
  BT.mode = 'idle'; BT.anim = null; B.phase = 1; assert.strictEqual(g.unitLook(b).ready, false, 'not ready during the enemy phase'); assert.strictEqual(g.unitLook(b).grey, false); B.phase = 0;
  assert.strictEqual(g.teamShape(0), 'ring'); assert.strictEqual(g.teamShape(1), 'spiked'); assert.strictEqual(g.teamShape(2), 'dashed'); assert.strictEqual(g.teamShape(3), 'barred');
});

test('HUD layout: buttons, cards, menus, forecast, sheet and help stay inside the view, apart, and touch-sized on phones', T => {
  const { g, G, C } = T;
  for (const [w, h] of SIZES) {
    G('VIEW.w = ' + w + '; VIEW.h = ' + h); g.startBattle(C.CHAPTERS[0].map, [g.partyUnit(4, 5), g.partyUnit(25, 5)], { pokeball: 1 }, { chapter: 0, seed: 7, defer: true }); const BT = G('BT'), HUD = G('HUD'); const tag = w + 'x' + h + ': '; const narrow = w < 300;
    const me = T.B().units.find(u => u.team === 0), foe = T.B().units.find(u => u.team !== 0); BT.cx = me.x; BT.cy = me.y;
    const checkHits = mode => { g.battleDraw(); for (const r of HUD.hits) { assert(inside(r, w, h), tag + mode + ': button ' + r.label + ' inside'); if (narrow) assert(r.h >= 18, tag + mode + ': button ' + r.label + ' is ' + r.h + ' tall'); if (r.label) assert(g.textWidth(r.label) + (/^(DANGER|♪|FAST)/.test(r.label) ? 13 : 4) <= r.w, tag + mode + ': the label ' + r.label + ' fits its ' + r.w + '-px button'); }
      for (let i = 0; i < HUD.hits.length; i++) for (let j = i + 1; j < HUD.hits.length; j++) assert(!overlaps(HUD.hits[i], HUD.hits[j]), tag + mode + ': buttons ' + HUD.hits[i].label + ' / ' + HUD.hits[j].label + ' overlap');
      for (const p of HUD.panels) assert(inside(p, w, h), tag + mode + ': panel inside'); for (const p of HUD.panels) for (const b of HUD.hits) assert(!overlaps(p, b), tag + mode + ': a panel covers button ' + b.label); return HUD.hits.map(b => b.label); };
    BT.mode = 'idle'; const idle = checkHits('idle'); assert(idle.includes('END TURN') && idle.some(l => l.startsWith('DANGER')) && (idle.includes('HELP') || g.hudLayout().stack && idle.includes('MENU')), tag + 'idle buttons present: ' + idle);
    if (g.hudLayout().stack) { G('VIEW.touch = true'); const touch = checkHits('idle, touch'); assert(touch.includes('NEXT') && touch.includes('MENU'), tag + 'a phone gets NEXT and MENU: ' + touch); G('VIEW.touch = false'); }
    if (!g.boardFits(1)) assert(idle.some(l => l.startsWith('ZOOM')), tag + 'zoom offered when the board does not fit'); else assert(!idle.some(l => l.startsWith('ZOOM')), tag + 'no zoom button when the board fits');
    // the turn card carries the ready count and does not collide with the buttons
    const L = g.hudLayout(); assert(inside(L.top, w, h)); for (const b of HUD.hits) assert(!overlaps(L.top, b), tag + 'turn card clear of ' + b.label);
    g.selectUnit(me); assert.strictEqual(BT.mode, 'move'); const mv = checkHits('move'); assert(mv.includes('BACK'), tag + 'BACK while moving');
    g.openActionMenu(me); BT.mode = 'menu'; checkHits('menu'); const mr = g.menuRect(); assert(inside(mr, w, h), tag + 'action menu inside'); assert(mr.h >= BT.menu.items.length * (narrow ? 16 : 13), tag + 'menu rows tall enough');
    // forecast: inside, clear of the buttons, with the move strip as its own hit area
    foe.x = me.x + 1; foe.y = me.y; BT.targets = [foe]; BT.tIdx = 0; BT.moveIdx = 0; BT.mode = 'target'; checkHits('target'); const fr = g.forecastRect(); assert(inside(fr, w, h), tag + 'forecast inside'); for (const b of HUD.hits) assert(!overlaps(fr, b), tag + 'forecast clear of ' + b.label);
    assert(g.forecastHit(fr.x + 5, fr.y + 5) && !g.moveSwitchHit(fr.x + 5, fr.y + 5) && g.moveSwitchHit(fr.x + 5, fr.y + fr.h - 6) && !g.forecastHit(fr.x + 5, fr.y + fr.h - 6), tag + 'forecast body and move strip are distinct hit areas');
    if (narrow) assert(fr.w >= w - 10, tag + 'phone forecast spans the width'); else assert(fr.w >= 200, tag + 'desktop forecast is wide enough for two columns');
    BT.mode = 'endmenu'; g.openEndMenu(); checkHits('endmenu'); assert(inside(g.menuRect(), w, h), tag + 'end menu inside');
    BT.mode = 'unitinfo'; BT.info = foe; checkHits('unitinfo'); assert(inside(g.sheetRect(), w, h), tag + 'unit sheet inside');
    BT.mode = 'help'; for (let p = 0; p < 3; p++) { BT.helpPage = p; checkHits('help'); const hr = g.helpRect(); assert(inside(hr, w, h), tag + 'help inside'); assert(hr.lines.every(l => g.textWidth(l) <= hr.w - 16), tag + 'help lines wrapped to the panel'); assert(20 + hr.lines.length * 10 <= hr.h - 12 + 10, tag + 'help page ' + p + ' fits its panel (' + hr.lines.length + ' lines)'); }
    BT.mode = 'idle'; BT.helpPage = 0;
  }
  G('VIEW.w = 480; VIEW.h = 270');
});

test('forecast lines follow the ordered strikes: damage, odds, KO marks and the survive condition', T => {
  const { g } = T; arena(T); fixedRoll(T, .5);
  const att = place(T, 6, 30, 1, 1, 1), def = place(T, 10, 3, 2, 2, 1); const fc = g.forecast(att, def, move(att, 'Flamethrower'), att); const L = g.forecastLines(fc, att, def);
  assert.strictEqual(L.length, 3, 'strike, counter, double'); assert.strictEqual(L[0].side, 'a'); assert.strictEqual(L[0].dmg, fc.a.dmg); assert.strictEqual(L[0].hit, fc.a.hit); assert.strictEqual(L[0].ko, true, 'the first strike is marked KO'); assert.strictEqual(L[0].cond, null);
  assert.strictEqual(L[1].side, 'c'); assert.strictEqual(L[1].nominal, false); assert.strictEqual(L[1].cond, 'only if Caterpie survives'); assert.strictEqual(L[1].ko, false);
  assert.strictEqual(L[2].side, 'a'); assert.strictEqual(L[2].nominal, false); assert.strictEqual(L[2].cond, 'only if Caterpie survives', 'the double is conditional too'); assert.strictEqual(L[2].ko, false);
  arena(T); const p = place(T, 25, 20, 1, 1, 1), s = place(T, 79, 20, 0, 2, 1); const fc2 = g.forecast(p, s, move(p, 'Thunder Shock'), p); const L2 = g.forecastLines(fc2, p, s);
  assert.strictEqual(L2.map(l => l.side).join(''), 'aca'); assert(L2.every(l => l.nominal && !l.ko), 'nobody drops'); assert.strictEqual(L2[1].counter, true); assert.strictEqual(L2[0].eff, EN ? '×1.5' : '×1,5', 'Electric on Water is marked');
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
  const { g, G, C } = T; const ch = C.CHAPTERS[5]; const L = ch.level; assert.strictEqual(ch.title, G("TRX('Power Plant')"));
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


// Stage 3 review follow-up: rendered text stays inside narrow views, every control is reachable, every label uses real glyphs.
// Hooks `text` to record where each string lands (following save/translate/scale), like the supervisor's text-check script.
function textHook(T) {
  T.G(`var __boxes = [], __m = [1, 0, 0, 1, 0, 0], __st = []; ctx.save = () => __st.push(__m.slice()); ctx.restore = () => { __m = __st.pop() || [1, 0, 0, 1, 0, 0]; }; ctx.translate = (x, y) => { __m[4] += __m[0] * x; __m[5] += __m[3] * y; }; ctx.scale = (x, y) => { __m[0] *= x; __m[3] *= y; };
    text = (s, x, y, col, opt = {}) => { const w = (opt.raw ? rawTextWidth : textWidth)(s, opt.font || FONT); __boxes.push({ text: String(opt.raw ? s : TRX(s)), x: __m[0] * x + __m[4], y: __m[3] * y + __m[5], w: w * __m[0], h: 7 * __m[3] }); return w; };
    textBoxHook = (s, x, y, w, h) => { __boxes.push({ text: String(s), x: __m[0] * x + __m[4], y: __m[3] * y + __m[5], w: w * __m[0], h: 7 * __m[3], display: true }); };`);
  const take = () => { const b = T.G('__boxes'); T.G('__boxes = []'); take.__last = b; return b; }; return take;
}
const battleSetup = `const ch = CHAPTERS[5]; startBattle(ch.map, [4, 7, 1, 25, 133, 66].map(n => partyUnit(n, ch.level)), {}, { chapter: 5, defer: true }); goScene('battle'); BT.mode = 'idle'; BT.time = 2;`;
const TEXT_CASES = [
  ['title', `goScene('title'); SC.t = 5;`, 'titleDraw()'],
  ['versus', `startVersusSetup(5); SC.t = 5;`, 'versusDraw()'],
  ['starter', `goScene('title'); titleDraw(); startNewGame(); SC.t = 5;`, 'starterDraw()'],
  ['prep', `SAVE = { chapter: 5, party: [4, 7, 1, 25, 133, 66, 74, 16].map(n => partyUnit(n, 20)), bag: { pokeball: 3 }, stars: {}, beaten: false }; prepChapter(5); SC.t = 5;`, 'prepDraw()'],
  ['skirmish', `startSkirmishSetup(); SC.t = 5;`, 'skirmishDraw()'],
  ['quick', `goScene('quick'); SC.t = 5;`, 'quickDraw()'],
  ['brief', `SAVE = { chapter: 4, party: [4, 7, 1, 25, 133, 66].map(n => partyUnit(n, 16)), bag: { pokeball: 3 }, stars: {}, beaten: false, captainPid: 0, starter: 4 }; briefChapter(4); SC.t = 5;`, 'briefDraw()'],
  ['tower', `startTower(); SC.t = 5;`, 'towerDraw()'],
  ['cos', `openCoRoom(); SC.data.i = 0; SC.t = 5;`, 'coRoomDraw()'],
  ['cos-locked', `openCoRoom(); SC.data.i = 6; SC.t = 5;`, 'coRoomDraw()'],
  ['rank', `goScene('rank', { kind: 'tower', i: 2, win: true, S: towerScore(11, 12, 5, 2), best: { rank: 'S', total: 290, days: 9 }, record: false, co: 'misty' }); SC.t = 5;`, 'rankDraw()'],
  ['safari', `goScene('rank', { kind: 'safari', result: 'win', score: [14, 9], catches: [[{ num: 147, level: 12, pts: 8 }, { num: 16, level: 11, pts: 1 }, { num: 123, level: 12, pts: 5 }], [{ num: 115, level: 12, pts: 5 }, { num: 111, level: 10, pts: 3 }, { num: 19, level: 9, pts: 1 }]], best: 10, record: true }); SC.t = 5;`, 'rankDraw()'],
  ['results', `goScene('results', { win: true, turns: 5, kills: 3, par: 8, rewards: { pokeball: 3 }, caught: [{ num: 16, level: 5 }, { num: 19, level: 4 }], trained: ['Charmeleon trained from Lv14 to Lv17'], evolved: ['Charmander evolved into Charmeleon!'], next: () => {} }); SC.t = 5;`, 'resultsDraw()'],
  ['board', battleSetup, 'drawHUD()'],
  ['forecast', battleSetup + ` BT.sel = alive(0)[0]; BT.sel.x = 5; BT.sel.y = 2; BT.targets = [alive(1)[0]]; BT.tIdx = 0; BT.moveIdx = 0; BT.mode = 'target'; setTargetCursor();`, 'drawHUD()'],
  ['unitinfo', battleSetup + ` BT.info = B.units.find(u => u.boss) || B.units[0]; BT.mode = 'unitinfo';`, 'drawHUD()'],
  ...[0, 1, 2].map(p => ['help' + p, battleSetup + ` BT.mode = 'help'; BT.helpPage = ${p};`, 'drawHUD()']),
];
test('narrow screens: every rendered string and every control stays inside the view on phones and desktop', T0 => {
  for (const [w, h] of [[180, 390], [195, 422], [207, 448], [512, 288]]) for (const [name, setup, draw] of TEXT_CASES) {
    const T = loadGame(); const tag = w + 'x' + h + ' ' + name + ': '; T.G('VIEW.w = ' + w + '; VIEW.h = ' + h + '; ' + setup); const boxes = textHook(T); T.G(draw);
    const bad = boxes().filter(b => b.x < -1 || b.x + b.w > w + 1 || b.y < -1 || b.y + b.h > h + 1); assert(!bad.length, tag + 'text outside the view: ' + JSON.stringify(bad.slice(0, 3)));
    const hits = T.G('SC.name === "battle" ? HUD.hits : SC.hits'); for (const r of hits) { assert(inside(r, w, h), tag + 'control outside: ' + (r.label || '?') + ' ' + JSON.stringify([r.x, r.y, r.w, r.h])); assert(r.w >= 14 && r.h >= 12, tag + 'control too small: ' + (r.label || '?')); }
    for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) assert(!overlaps(hits[i], hits[j]), tag + 'controls overlap: ' + (hits[i].label || i) + ' / ' + (hits[j].label || j));
  }
});
test('phone keyboard and touch access: Versus draft, prep toggles and starter pick work through keys and their on-screen controls', T => {
  const { g, G } = T; G('VIEW.w = 180; VIEW.h = 390');
  g.startVersusSetup(5); const S = G('SC.data'); g.versusDraw(); const hits = G('SC.hits');
  const plus = k => hits.find(h => h.label === k + '+'); assert(plus('MAP') && plus('MODE') && plus('P2 COMMANDER'), 'the map, mode and commander [+] controls are on screen'); const cap = S.co1; plus('P2 COMMANDER').run(); assert.notStrictEqual(S.co1, cap, 'the commander [+] is usable'); const seed = S.seed; plus('MAP').run(); assert.strictEqual(S.seed, (seed + 1) % 1000, 'the map [+] is usable');
  for (const k of ['right', 'down', 'ok']) g.versusInput({ type: 'key', key: k }); assert.strictEqual(S.teams[0].length + S.teams[1].length, 1, 'keys draft a Pokémon'); assert.strictEqual(G('SC.i'), 1 + g.vsCols(), 'down moves one roster row (four columns on phones)');
  g.versusDraw(); for (const l of ['◂ TITLE', 'RANDOM', 'CLEAR', 'BATTLE! ▸']) assert(G('SC.hits').some(h => h.label === l), l + ' button present'); assert(G('SC.hits').some(h => h.label && h.label.startsWith('FOG')), 'FOG toggle present');
  g.goScene('title'); g.titleDraw(); G('SAVE = { chapter: 0, party: [], bag: {}, stars: {}, beaten: false }'); g.goScene('starter'); g.starterDraw(); assert.strictEqual(G('SC.hits').filter(h => ['BULBASAUR', 'CHARMANDER', 'SQUIRTLE'].includes(h.label)).length, 3, 'three starter balls'); assert(G('SC.hits').some(h => h.label.startsWith(G("TRX('CHOOSE')"))), 'a CHOOSE button'); g.starterInput({ type: 'key', key: 'right' }); assert.strictEqual(G('SC.i'), 1);
  G('SAVE.party = [partyUnit(4, 5), partyUnit(25, 5), partyUnit(7, 5), partyUnit(1, 5)]'); g.prepChapter(0); const P = G('SC.data'); g.prepDraw(); const n0 = P.deploy.length; g.prepInput({ type: 'key', key: 'down' }); g.prepInput({ type: 'key', key: 'ok' }); assert.notStrictEqual(P.deploy.length, n0, 'OK toggles the selected card'); g.prepDraw(); for (const l of ['◂ MISSION', 'AUTO PICK', 'BATTLE! ▸']) assert(G('SC.hits').some(h => h.label === l), l + ' button present on the phone layout');
});
test('every UI label uses glyphs the pixel font has (no "?" fallbacks)', T => {
  const { g, G, C } = T; const has = c => G('!!(FONT[' + JSON.stringify(c) + '] || FONT[stripAccents(' + JSON.stringify(c) + ')])');
  const check = (s, where) => { for (const c of String(s)) if (c !== ' ') assert(has(c), where + ': glyph missing for U+' + c.codePointAt(0).toString(16) + ' in "' + s + '"'); };
  for (const p of G('HELP_PAGES')) for (const l of p) check(l, 'help');
  g.startBattle(C.CHAPTERS[5].map, [g.partyUnit(4, 20)], { pokeball: 1 }, { chapter: 5, seed: 7, defer: true }); const BT = G('BT'), HUD = G('HUD');
  for (const mode of ['idle', 'move']) { BT.mode = mode; BT.sel = mode === 'move' ? T.B().units[0] : null; if (mode === 'move') { BT.reach = g.reachable(BT.sel); BT.atk = []; BT.path = [{ x: BT.sel.x, y: BT.sel.y }]; } for (const z of [1, .5]) { BT.zoom = z; g.battleDraw(); for (const b of HUD.hits) check(b.label, mode + ' button'); } }
  BT.mode = 'idle'; g.openEndMenu(); for (const it of BT.menu.items) { check(it.label, 'menu'); check(it.sub, 'menu hint'); }
  for (const s of ['OK: attack  ·  X: back  ·  C: move', '◂ ▸ browse  ·  X close', 'READY 3/5', 'ZOOM -', 'ZOOM +', '32 →', '×1.5', '×2.25', 'A fan game · Pokémon © Nintendo / Game Freak / Creatures']) check(s, 'label');
  for (const s of ['POKÉ', 'TAKTIKS', 'PRESS START', 'THE TACTICIAN', 'GIOVANNI', 'VS', 'VICTORY!', 'DEFEAT', 'RETREAT', 'DRAW', 'ENEMY PHASE', 'PLAYER 1 WINS!']) for (const c of s) if (c !== ' ') assert(G('!!DISPLAY_SRC[' + JSON.stringify(c) + '] || !!DISPLAY_ACCENT[' + JSON.stringify(c) + ']'), 'the display face has ' + c + ' (for ' + s + ')');
  for (const ch of C.CHAPTERS) for (const c of ch.title.toUpperCase()) if (c !== ' ') assert(G('!!DISPLAY_SRC[' + JSON.stringify(c) + '] || !!DISPLAY_ACCENT[' + JSON.stringify(c) + '] || !!DISPLAY_SRC[stripAccents(' + JSON.stringify(c) + ')]'), 'the display face has ' + c + ' (front ' + ch.title + ')');
  // Spanish: every translation draws in the small face, its capitals in the big one (the story's *emphasis* marks and
  // the credits' © stay small), and the display face has the Spanish capitals and marks: ÁÉÍÓÚÑÜ ¡¿
  const bad = G(`(() => { const out = []; const has = (c, f) => f[c] || f[stripAccents(c)] || (f === BIG && BIG[stripAccents(c).toUpperCase()]);
    for (const k in ES) for (const c of String(ES[k]).replace(/\\{\\d\\}|[*©~\\n ]/g, '')) { if (!has(c, FONT)) out.push('small ' + c + ' in ' + ES[k]); if (!has(c.toUpperCase(), BIG)) out.push('big ' + c + ' in ' + ES[k]); }
    for (const c of 'ÁÉÍÓÚÑÜ¡¿') if (!DISPLAY_SRC[c] && !DISPLAY_ACCENT[c]) out.push('display ' + c); return out.slice(0, 5).join(' | '); })()`);
  assert.strictEqual(bad, '', 'Spanish glyphs: ' + bad);
  // big accented capitals keep the whole letter and put the mark above the cap line
  for (const c of 'ÁÉÍÓÚÑÜ') { const gl = G('BIG[' + JSON.stringify(c) + ']'), base = G('BIG[stripAccents(' + JSON.stringify(c) + ')]'); assert(gl.off < 0 && gl.rows.slice(-base.rows.length).join('/') === base.rows.join('/'), 'big ' + c + ' keeps its letter whole'); }
});

// Stage 4: roles, skills, speed rules, AI use, saves and the menu/target flow.
// vm arrays have another realm's prototype, so structural equality goes through JSON.
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
test('roles: every species has one, evolution lines keep it, the six representatives match, restore and old saves keep it', T => {
  const { g, G, C } = T; const ROLES = G('ROLES'), LINE_ROOT = G('LINE_ROOT');
  for (const d of C.DEX_LIST) { const r = g.roleFor(d); assert(ROLES[r], d.name + ' has role ' + r); for (const e of d.evos) assert.strictEqual(g.roleFor(C.DEX[e[0]]), r, d.name + ' → ' + C.DEX[e[0]].name + ' keeps the role'); assert.strictEqual(LINE_ROOT[d.num] <= d.num, true); }
  const want = { 16: 'scout', 17: 'scout', 18: 'scout', 74: 'defender', 76: 'defender', 7: 'amphibious', 9: 'amphibious', 1: 'controller', 3: 'controller', 63: 'ranged', 65: 'ranged', 35: 'support', 36: 'support', 4: 'striker', 25: 'striker', 150: 'striker', 133: 'striker', 134: 'striker' };
  for (const n in want) assert.strictEqual(g.makeUnit(+n, 20, 0).role, want[n], C.DEX[n].name);
  const counts = {}; for (const d of C.DEX_LIST) counts[g.roleFor(d)] = (counts[g.roleFor(d)] || 0) + 1; for (const r in ROLES) assert(counts[r] >= 3, r + ' is used by at least three species (' + counts[r] + ')');
  // the skill follows the role; passive roles have no menu action
  assert.strictEqual(g.makeUnit(16, 5, 0).skill.id, 'dart'); assert.strictEqual(g.makeUnit(74, 5, 0).skill.id, 'brace'); assert.strictEqual(g.makeUnit(1, 5, 0).skill.id, 'root'); assert.strictEqual(g.makeUnit(35, 5, 0).skill.id, 'mend'); assert.strictEqual(g.makeUnit(63, 5, 0).skill.id, 'reach'); assert.strictEqual(g.makeUnit(7, 5, 0).skill.id, 'tide'); assert.strictEqual(g.makeUnit(4, 5, 0).skill, null);
  for (const n of [16, 7, 63, 4]) assert.strictEqual(g.skillBlock(g.makeUnit(n, 5, 0)), 'none', 'no active skill for ' + n);
  // evolving on the board keeps the role and the skill; a level-up recomputes the reach bonus
  const abra = g.makeUnit(63, 15, 0); same(abra.moves.find(m => m.name === 'Confusion').rng, [1, 3], 'Reach: Confusion 1-3'); assert(abra.moves.every(m => m.rng[0] === 1 || m.rng[0] === 2), 'minimum ranges unchanged'); assert.strictEqual(abra.rngMax, 3);
  same(g.makeUnit(25, 15, 0).moves.find(m => m.name === 'Thunder Shock').rng, [1, 2], 'a striker keeps the printed range'); same(T.G('MOVES').Confusion.rng, [1, 2], 'the move table itself is untouched');
  g.levelUp(abra); g.evolve(abra, C.DEX[64]); assert.strictEqual(abra.role, 'ranged'); assert.strictEqual(abra.rngMax, 3); assert(abra.moves.every(m => m.rng[1] <= 3 && (m.rng[1] === 1 || m.rng[1] >= 3)), 'Kadabra: melee stays 1, ranged goes to 3');
  const tackle = abra.moves.find(m => m.rng[1] === 1); assert(tackle, 'the melee fallback is still melee');
  // serialize / restore carries cd, brace and root; a save from before this stage restores with nothing pending
  const geo = g.makeUnit(74, 20, 0); geo.brace = 1; geo.cd = 2; geo.root = 1; const s = g.serializeUnit(geo); same([s.cd, s.brace, s.root], [2, 1, 1]);
  const r = g.restoreUnit(s); same([r.cd, r.brace, r.root, r.role, r.skill.id], [2, 1, 1, 'defender', 'brace']);
  const old = g.restoreUnit({ num: 35, level: 9, xp: 0, hp: 20, team: 0 }); same([old.cd, old.brace, old.root, old.role], [0, 0, 0, 'support'], 'legacy record');
  // party write-back after a battle clears anything pending
  arena(T); const B = T.B(); const p = place(T, 74, 20, 0, 1, 1); p.pid = 0; p.brace = 1; p.cd = 2; p.root = 2; G('SAVE = { chapter: 0, party: [null], bag: {}, stars: {}, beaten: false }'); g.applyBattleToParty(); const sp = G('SAVE').party[0]; same([sp.cd, sp.brace, sp.root], [0, 0, 0]);
  assert(B);
});

test('speed rules: crits are flat (4 / 24 / 100 on frozen), hit bonus capped at 10, only scouts and strikers follow up at +10 SPE', T => {
  const { g } = T; arena(T);
  const fast = place(T, 25, 30, 0, 1, 1), slow = place(T, 79, 30, 1, 2, 1); // Pikachu (striker) vs Slowpoke (amphibious)
  assert(fast.spe >= slow.spe + 30, 'a big speed gap');
  assert.strictEqual(g.calcCrit(fast, slow, T.G('MOVES')['Thunder Shock']), 4, 'no crit from speed'); assert.strictEqual(g.calcCrit(slow, fast, T.G('MOVES')['Tackle']), 4);
  assert.strictEqual(g.calcCrit(fast, slow, T.G('MOVES')['Karate Chop']), 24, 'high-crit move'); slow.status = 'frz'; assert.strictEqual(g.calcCrit(fast, slow, T.G('MOVES')['Tackle']), 100); slow.status = null;
  const m = T.G('MOVES')['Thunder Shock']; assert.strictEqual(g.calcHit(fast, slow, m, g.terrAt(2, 1)), 100); assert.strictEqual(g.calcHit(slow, fast, T.G('MOVES').Tackle, g.terrAt(1, 1)), 90, 'the slow side loses at most 10');
  assert.strictEqual(g.doubles(fast, slow), true, 'a striker follows up'); assert.strictEqual(g.doubles(slow, fast), false);
  const geo = place(T, 76, 30, 0, 3, 3), cat = place(T, 11, 5, 1, 4, 3); assert(geo.spe >= cat.spe + 10); assert.strictEqual(g.doubles(geo, cat), false, 'a defender never follows up whatever its speed');
  const cle = place(T, 36, 30, 0, 3, 4), sq = place(T, 9, 30, 0, 4, 4), bul = place(T, 3, 30, 0, 5, 4), abra = place(T, 65, 30, 0, 6, 4); for (const u of [cle, sq, bul, abra]) assert.strictEqual(g.doubles(u, cat), false, u.name + ' never follows up');
  const pid = place(T, 18, 30, 0, 7, 4); assert.strictEqual(g.doubles(pid, cat), true, 'a scout follows up'); pid.status = 'par'; assert.strictEqual(g.doubles(pid, cat), false);
  const near = place(T, 19, 30, 0, 8, 4); near.spe = cat.spe + 9; assert.strictEqual(g.doubles(near, cat), false, '9 SPE is not enough'); near.spe = cat.spe + 10; assert.strictEqual(g.doubles(near, cat), true);
  // forecast lines always carry the crit odds and flag a strike whose critical would KO where the normal hit would not
  arena(T); fixedRoll(T, .5); const a = place(T, 6, 30, 0, 1, 1), d = place(T, 20, 30, 1, 2, 1); const mv = move(a, 'Flamethrower'); let fc = g.forecast(a, d, mv, a);
  d.hp = fc.a.dmg + 1; fc = g.forecast(a, d, mv, a); assert.strictEqual(fc.strikes[0].critDmg, g.calcDmg(a, d, mv, g.terrAt(2, 1), true)); assert(fc.strikes[0].critDmg >= d.hp && fc.a.dmg < d.hp);
  let L = g.forecastLines(fc, a, d); assert.strictEqual(L[0].crit, 4); assert.strictEqual(L[0].critKo, true, 'crit would KO'); assert.strictEqual(L[0].ko, false); assert.strictEqual(fc.hpD, 1, 'HP after is the normal-hit number');
  d.hp = fc.a.dmg; fc = g.forecast(a, d, mv, a); L = g.forecastLines(fc, a, d); assert.strictEqual(L[0].ko, true); assert.strictEqual(L[0].critKo, false, 'no crit flag when the normal hit already KOs');
  d.hp = 500; fc = g.forecast(a, d, mv, a); L = g.forecastLines(fc, a, d); assert.strictEqual(L[0].critKo, false); assert.strictEqual(L[0].crit, 4);
  const G = T.G; G('VIEW.w = 480; VIEW.h = 270'); const BT = G('BT'); BT.sel = a; BT.targets = [d]; BT.tIdx = 0; BT.moveIdx = a.moves.indexOf(mv); BT.mode = 'target'; d.hp = fc.a.dmg + 1; BT.forecastDetail = true; const boxes = textHook(T); g.drawHUD(); const strs = boxes().map(b => b.text);
  assert(strs.some(s => s.includes(EN ? 'NORMAL HITS' : 'GOLPES NORMALES')), 'the forecast title says the numbers are for normal hits: ' + strs.join(' | '));
  { const all = boxes.__last || []; const crit = all.find(b => b.text === '4%'); assert(crit && all.some(b => b.text === 'KO' && b.y === crit.y && b.x > crit.x), 'the crit KO risk is spelled out next to the crit odds: ' + strs.join(' | ')); }
});

test('skills: legal targets, action cost, cooldown, brace and root expiry, cleanse, danger zone and dart', T => {
  const { g, C } = T; const MOVES = T.G('MOVES');
  // Brace: self only; 40% less damage in preview and resolver; gone at its own next upkeep; the AI counter is reduced too
  arena(T); fixedRoll(T, .5); const geo = place(T, 74, 20, 0, 2, 2), foe = place(T, 7, 20, 1, 3, 2); geo.hp = geo.maxHp = 500; foe.hp = foe.maxHp = 500;
  same(g.skillTargetsAt(geo), [geo]); assert.strictEqual(g.skillBlock(geo), null);
  const wg = move(foe, 'Bubble Beam'); const plain = g.calcDmg(foe, geo, wg, g.terrAt(2, 2)); const ev = g.useSkill(geo, geo.skill, geo); assert.strictEqual(geo.brace, 1); assert(ev.some(e => e.type === 'brace')); assert.strictEqual(geo.cd, 0, 'Brace has no cooldown');
  const fc = g.forecast(foe, geo, wg, foe); assert.strictEqual(fc.a.dmg, Math.floor(plain * .6)); assert.strictEqual(fc.strikes[0].braced, true); assert.strictEqual(fc.c.braced, false, 'the counter on the unbraced attacker is full');
  const before = geo.hp; g.resolveCombat(foe, geo, wg, foe); assert.strictEqual(before - geo.hp, Math.floor(plain * .6), 'resolver agrees with the preview');
  g.upkeep(1); assert.strictEqual(geo.brace, 1, 'the enemy upkeep does not end it'); g.upkeep(0); assert.strictEqual(geo.brace, 0, 'ends at its own upkeep'); assert.strictEqual(g.calcDmg(foe, geo, wg, g.terrAt(2, 2)), plain);
  // Mend: an adjacent hurt or statused ally, never itself, never a full-HP clean ally, never a foe; heals 30% capped by missing HP, cures, cooldown 2
  arena(T, Array(9).fill('.'.repeat(9))); const cle = place(T, 35, 20, 0, 4, 4), hurt = place(T, 4, 20, 0, 5, 4), fine = place(T, 7, 20, 0, 4, 5), far = place(T, 1, 20, 0, 6, 4), en = place(T, 19, 20, 1, 3, 4);
  hurt.hp = 10; far.hp = 10; en.hp = 1; cle.hp = 5;
  same(g.skillTargetsAt(cle).map(u => u.name), ['Charmander'], 'only the adjacent hurt ally'); fine.status = 'psn'; same(g.skillTargetsAt(cle).map(u => u.name).sort(), ['Charmander', 'Squirtle'], 'a statused ally counts');
  assert.strictEqual(g.mendAmount(hurt), Math.floor(hurt.maxHp * .3)); hurt.hp = hurt.maxHp - 2; assert.strictEqual(g.mendAmount(hurt), 2, 'capped by the missing HP'); hurt.hp = 10;
  assert.strictEqual(g.skillPreview(cle, cle.skill, hurt), T.G('TRX')('+' + Math.floor(hurt.maxHp * .3) + ' HP (10 → ' + (10 + Math.floor(hurt.maxHp * .3)) + ')'));
  const before2 = cle.hp; const ev2 = g.useSkill(cle, cle.skill, hurt); assert.strictEqual(hurt.hp, 10 + Math.floor(hurt.maxHp * .3)); assert(ev2.some(e => e.type === 'heal' && e.amount === Math.floor(hurt.maxHp * .3))); assert.strictEqual(cle.hp, before2, 'Mend never heals the healer');
  assert.strictEqual(cle.cd, 2); assert.strictEqual(g.skillBlock(cle), T.G("TR('cooldown {0}', 2)")); assert.strictEqual(g.skillReady(cle), false); assert(ev2.some(e => e.type === 'xp' && e.unit === cle), 'using a skill earns XP');
  g.upkeep(0); assert.strictEqual(cle.cd, 1); assert.strictEqual(g.skillReady(cle), false); g.upkeep(0); assert.strictEqual(cle.cd, 0); assert.strictEqual(g.skillReady(cle), true, 'usable every other turn');
  g.useSkill(cle, cle.skill, fine); assert.strictEqual(fine.status, null, 'cured'); assert.strictEqual(fine.hp, fine.maxHp);
  cle.cd = 0; fine.hp = fine.maxHp; hurt.hp = hurt.maxHp; assert.strictEqual(g.skillBlock(cle), 'no target', 'nothing to mend'); cle.recharge = 1; assert.strictEqual(g.skillReady(cle), false, 'not while recharging'); cle.recharge = 0;
  // Root: a hostile within 1-2 that is not flying and not already rooted; MOV 0 for exactly the target's next phase; refresh and cleanse rules
  arena(T, Array(11).fill('.'.repeat(11))); const bul = place(T, 1, 20, 0, 5, 5), rat = place(T, 19, 20, 1, 7, 5), bird = place(T, 16, 20, 1, 5, 7), off = place(T, 19, 20, 1, 8, 5), ally = place(T, 4, 20, 0, 4, 5);
  same(g.skillTargetsAt(bul).map(u => u.name), ['Rattata'], 'in range, not the flier at 2, not the one at 3, not the ally'); assert.strictEqual(g.skillTargetsAt(bul, bul.skill, { x: 7, y: 6 }).map(u => u.name).join(), 'Rattata,Rattata', 'from another tile both Rattata are in range');
  const ev3 = g.useSkill(bul, bul.skill, rat); assert.strictEqual(rat.root, 2); assert(ev3.some(e => e.type === 'root' && e.unit === rat)); assert.strictEqual(bul.cd, 2); assert(!g.skillTargetsAt(bul).includes(rat), 'an already rooted foe is not a target');
  assert.strictEqual(g.effMov(rat), 0); assert.strictEqual(g.reachable(rat).size, 1, 'a rooted unit cannot move'); assert.strictEqual(g.rootAfterUpkeep(rat), 1); assert.strictEqual(g.effMov(rat, rat.status, g.rootAfterUpkeep(rat)), 0);
  bird.recharge = 1; off.recharge = 1; // leave the rooted Rattata as the only threat
  const dz = g.dangerZones(0); assert.strictEqual([...dz.trainer].sort().join(' '), [C.key(6, 5), C.key(7, 4), C.key(7, 6), C.key(8, 5)].sort().join(' '), 'the danger zone shows the rooted unit threatening only from where it stands');
  g.upkeep(1); assert.strictEqual(rat.root, 1, 'held during its own phase'); assert.strictEqual(g.effMov(rat), 0); assert.strictEqual(g.rootAfterUpkeep(rat), 0); off.recharge = 1; bird.recharge = 1; assert(g.dangerZones(0).trainer.size > 20, 'next phase it moves again: the danger zone grows');
  const evu = g.upkeep(1); assert.strictEqual(rat.root, 0, 'free after one held phase'); assert(evu.some(e => e.type === 'unroot' && e.unit === rat)); assert(g.effMov(rat) > 0);
  const d2 = g.aiDecide(rat); assert(d2, 'the freed Rattata acts'); rat.root = 2; const d3 = g.aiDecide(rat); assert(!d3 || (d3.x === rat.x && d3.y === rat.y), 'a rooted unit acts from its tile: ' + JSON.stringify(d3 && [d3.x, d3.y]));
  // cleanse: a Poké Center frees a rooted unit; Mend does too; the rooted unit still counters
  rat.root = 2; ally.root = 2; const cl = place(T, 35, 20, 0, 3, 5); g.useSkill(cl, cl.skill, ally); assert.strictEqual(ally.root, 0, 'Mend frees an ally');
  arena(T, ['C....']); const rooted = place(T, 19, 20, 1, 0, 0); rooted.root = 2; T.B().war.props[0].owner = 1; assert.strictEqual(g.rootAfterUpkeep(rooted), 0, 'the center will free it'); g.upkeep(1); assert.strictEqual(rooted.root, 0);
  arena(T); fixedRoll(T, .5); const r2 = place(T, 19, 20, 1, 2, 2), p2 = place(T, 25, 20, 0, 3, 2); r2.root = 2; const fc2 = g.forecast(p2, r2, move(p2, 'Thunder Shock'), p2); assert(fc2.c, 'a rooted unit still counters');
  assert(bird.fly && off && MOVES);
  // Dart: after attacking a scout may move up to 2 tiles (1 when paralyzed, none when rooted or recharging or frozen); anyone else cannot
  arena(T, Array(9).fill('.'.repeat(9))); const pid = place(T, 16, 20, 0, 4, 4), tgt = place(T, 10, 5, 1, 5, 4); assert.strictEqual(g.canDart(pid), true); assert.strictEqual(g.dartMov(pid), 2);
  pid.status = 'par'; assert.strictEqual(g.dartMov(pid), 2, 'paralysis leaves MOV 5-2=3, dart still 2'); pid.mov = 3; assert.strictEqual(g.dartMov(pid), 1); pid.status = null; pid.mov = 5;
  pid.root = 2; assert.strictEqual(g.canDart(pid), false, 'rooted: no dart'); pid.root = 0; pid.recharge = 1; assert.strictEqual(g.canDart(pid), false); pid.recharge = 0; pid.status = 'frz'; assert.strictEqual(g.canDart(pid), false); pid.status = null;
  assert.strictEqual(g.canDart(place(T, 4, 20, 0, 1, 1)), false, 'a striker never darts'); assert.strictEqual(g.canDart(place(T, 74, 20, 0, 1, 2)), false);
  const c = g.aiDart(pid); assert(c && g.dist(c, pid) <= 2 && g.dist(c, pid) >= 1, 'the AI dart lands within 2 tiles: ' + JSON.stringify(c)); assert(g.dist(c, tgt) > 1, 'and away from the foe');
  // Tide: an amphibious unit on water gets DEF 20 / AVO 20, another swimmer only the small bonus, a flier nothing
  arena(T, ['~~~~~', '.....']); const sq = place(T, 7, 20, 0, 0, 0), gy = place(T, 130, 20, 0, 1, 0), lap = place(T, 131, 20, 0, 2, 0); const W = g.terrAt(0, 0);
  assert.strictEqual(g.terrainDef(W, sq), 20); assert.strictEqual(g.terrainEva(W, sq), 20); assert.strictEqual(g.terrainDef(W, lap), 20); assert.strictEqual(g.terrainDef(W, gy), 20, 'Gyarados keeps the Magikarp line role');
  const sta = g.makeUnit(120, 20, 0); assert.strictEqual(sta.role, 'amphibious'); const om = g.makeUnit(138, 20, 0); assert.strictEqual(om.role, 'defender'); assert.strictEqual(g.terrainDef(W, om), 5, 'a non-amphibious swimmer keeps swimDef'); assert.strictEqual(g.terrainEva(W, om), 0);
  assert.strictEqual(g.terrainDef(g.terrAt(0, 1), sq), 0, 'nothing on land');
});

test('AI: a support mends, a controller roots a threat, a defender braces when threatened, cooldowns and ranges are obeyed, a scout darts', T => {
  const { g, C } = T; const MOVES = T.G('MOVES');
  // Support: a hurt ally beside it beats a weak poke at a distant foe; on cooldown it attacks or waits instead
  arena(T, Array(11).fill('.'.repeat(11))); const cle = place(T, 35, 20, 1, 5, 5), ally = place(T, 74, 20, 1, 6, 5), foe = place(T, 25, 20, 0, 5, 9); ally.hp = 10;
  let d = g.aiDecide(cle); assert(d && d.skill && d.skill.id === 'mend' && d.target === ally, 'mends the hurt ally: ' + JSON.stringify(d && { x: d.x, y: d.y, s: d.skill && d.skill.id, t: d.target && d.target.name }));
  cle.cd = 2; d = g.aiDecide(cle); assert(!d || !d.skill, 'no Mend on cooldown'); cle.cd = 0; ally.hp = ally.maxHp; d = g.aiDecide(cle); assert(!d || !d.skill, 'nothing to mend');
  // it walks to the ally when it must: the ally two tiles away still gets mended from an adjacent tile
  ally.hp = 10; ally.x = 8; d = g.aiDecide(cle); assert(d && d.skill && d.target === ally && g.dist(d, ally) === 1, 'moves next to the ally first: ' + JSON.stringify(d && [d.x, d.y]));
  // Controller: roots the mobile foe that could reach its side next phase, from its own tile, never a flier, never a guard that will not move
  arena(T, Array(11).fill('.'.repeat(11))); const bul = place(T, 1, 20, 1, 5, 5), rat = place(T, 20, 22, 0, 7, 5), guard = place(T, 74, 20, 1, 4, 5); bul.hp = bul.maxHp = 300; rat.hp = rat.maxHp = 300;
  let d0 = g.aiDecide(bul); assert(d0 && d0.move && d0.move.name === 'Sludge' && !d0.skill, 'a free ranged hit beats the root'); bul.atk = bul.spa = 5; // a weak hitter: holding the Raticate is worth more than scratching it
  d = g.aiDecide(bul); assert(d && d.skill && d.skill.id === 'root' && d.target === rat, 'roots the Raticate: ' + JSON.stringify(d && { s: d.skill && d.skill.id, t: d.target && d.target.name, m: d.move && d.move.name }));
  rat.root = 2; d = g.aiDecide(bul); assert(!d || !d.skill, 'not twice'); rat.root = 0; bul.cd = 1; d = g.aiDecide(bul); assert(!d || !d.skill, 'cooldown respected'); bul.cd = 0;
  const bird = place(T, 16, 20, 0, 5, 7); d = g.aiDecide(bul); assert(!d || !d.skill || d.target !== bird, 'never roots a flier');
  arena(T, Array(11).fill('.'.repeat(11))); const bul2 = place(T, 1, 20, 0, 5, 5), gd = place(T, 74, 20, 1, 7, 5, { ai: 'guard' }); bul2.hp = bul2.maxHp = 300; bul2.atk = bul2.spa = 5;
  d = g.aiDecide(bul2); assert(!d || !d.skill, 'no Root on an unprovoked guard that never moves'); gd.provoked = true; d = g.aiDecide(bul2); assert(d && d.skill && d.target === gd, 'a provoked guard is worth rooting');
  // Defender: braces when it is threatened and has nobody worth hitting; attacks when it can; never braces out of danger
  arena(T, Array(11).fill('.'.repeat(11))); const geo = place(T, 74, 20, 1, 5, 5, { ai: 'guard' }), pik = place(T, 25, 20, 0, 6, 10); geo.provoked = true; // six tiles off: Pikachu (MOV 5, range 2) threatens it, Geodude (MOV 3, range 2) cannot reach back
  d = g.aiDecide(geo); assert(d && d.skill && d.skill.id === 'brace' && d.x === 5 && d.y === 5, 'braces in place under threat: ' + JSON.stringify(d)); pik.x = 5; pik.y = 10; pik.mov = 1;
  d = g.aiDecide(geo); assert(!d || !d.skill, 'no brace when nothing can reach it');
  pik.x = 5; pik.y = 6; pik.mov = 5; d = g.aiDecide(geo); assert(d && d.target === pik && d.move, 'attacks the adjacent Pikachu instead of bracing');
  // every AI skill decision is a legal one: the target is in the skill's list from the chosen tile, and the queue applies it with the same cost
  arena(T, Array(11).fill('.'.repeat(11))); const c2 = place(T, 35, 20, 1, 5, 5), a2 = place(T, 74, 20, 1, 7, 5); a2.hp = 10; place(T, 25, 20, 0, 5, 9);
  d = g.aiDecide(c2); assert(d && d.skill); assert(g.skillTargetsAt(c2, d.skill, d).includes(d.target)); c2.x = d.x; c2.y = d.y; const q = g.skillQueue(c2, d.skill, d.target); assert(q.every(x => x.kind === 'event')); assert.strictEqual(c2.cd, 2); assert(a2.hp > 10);
  // Scout: the enemy phase attack is followed by a dart in the model paths (simBattle / autoTurn) and the unit ends out of reach when a tile allows
  arena(T, Array(11).fill('.'.repeat(11))); fixedRoll(T, .5); const zub = place(T, 41, 20, 1, 5, 5), me = place(T, 66, 20, 0, 6, 5); zub.hp = zub.maxHp = 300; me.hp = me.maxHp = 300;
  d = g.aiDecide(zub); assert(d && d.target === me); g.aiAct(zub, d); assert(g.dist(zub, me) >= 2, 'darted away after the hit: ' + JSON.stringify([zub.x, zub.y])); assert(me.hp < 300, 'the attack happened');
  assert(C && MOVES);
});

test('player flow: the skill sits in the action menu with its reason when unusable, the target mode confirms/cancels, a dart follows an attack, resume keeps everything', T => {
  const { g, G, C } = T; G('VIEW.w = 480; VIEW.h = 270');
  // menu: Mend listed, greyed with the reason when there is no target; Brace usable at once
  arena(T, Array(9).fill('.'.repeat(9))); const BT = G('BT'); const cle = place(T, 35, 20, 0, 4, 4), hurt = place(T, 4, 20, 0, 5, 4), foe = place(T, 19, 20, 1, 4, 6); T.B().phase = 0;
  BT.sel = cle; g.openActionMenu(cle); let it = BT.menu.items.find(i => i.id === 'skill'); assert(it && it.label === G("TRX('Mend')") && it.off, 'Mend listed but off: ' + JSON.stringify(it)); assert(it.sub.includes(G("TRX('no target')")));
  g.menuChoose('skill'); assert.strictEqual(BT.mode, 'menu', 'choosing an unusable skill does nothing');
  hurt.hp = 10; g.openActionMenu(cle); it = BT.menu.items.find(i => i.id === 'skill'); assert(it && !it.off && it.sub.includes(G("TR('{0} target', 1)")) && it.sub.includes(G("TRX('every other turn')")) && !/every 3/.test(it.sub), it.sub);
  g.menuChoose('skill'); assert.strictEqual(BT.mode, 'skillTarget'); same(BT.targets, [hurt]); same([BT.cx, BT.cy], [5, 4], 'cursor on the target');
  const boxes = textHook(T); g.battleDraw(); const strs = boxes().map(b => b.text); assert(strs.some(s => s === G("TRX('MEND')")), 'skill card title'); assert(strs.some(s => /\+\d+ (HP|PS) /.test(s)), 'the card shows the exact heal: ' + strs.join(' | ')); assert(strs.some(s => s.includes(G("TRX('uses the action')"))));
  g.cancel(); assert.strictEqual(BT.mode, 'menu', 'back to the menu'); assert.strictEqual(hurt.hp, 10, 'nothing applied'); assert.strictEqual(cle.cd, 0);
  g.menuChoose('skill'); g.keyInput('ok'); assert.strictEqual(BT.mode, 'anim'); let n = 0; while (BT.mode === 'anim' && n++ < 2000) { g.battleUpdate(1 / 60); g.battleDraw(); }
  assert.strictEqual(BT.mode, 'idle'); assert.strictEqual(cle.acted, true, 'the action is spent'); assert.strictEqual(hurt.hp, 10 + Math.floor(hurt.maxHp * .3)); assert.strictEqual(cle.cd, 2); assert(cle.xp > 0);
  // Brace via the pointer: self is the only target, tapping the forecast area confirms
  const geo = place(T, 74, 20, 0, 2, 2); BT.sel = geo; g.openActionMenu(geo); it = BT.menu.items.find(i => i.id === 'skill'); assert(it && it.label === G("TRX('Brace')") && !it.off); g.menuChoose('skill'); same(BT.targets, [geo]);
  const fr = g.forecastRect(); g.pointerInput({ type: 'down', x: fr.x + 5, y: fr.y + 5, btn: 0 }); g.pointerInput({ type: 'up', x: fr.x + 5, y: fr.y + 5, btn: 0 }); n = 0; while (BT.mode === 'anim' && n++ < 2000) { g.battleUpdate(1 / 60); g.battleDraw(); }
  assert.strictEqual(geo.brace, 1); assert.strictEqual(geo.acted, true); assert.strictEqual(BT.mode, 'idle');
  // the unit sheet and card mention the role and the state; the HUD stays inside every size in skillTarget mode
  for (const [w, h] of SIZES) { G('VIEW.w = ' + w + '; VIEW.h = ' + h); const HUD = G('HUD'); BT.sel = cle; cle.acted = false; cle.cd = 0; hurt.hp = 10; g.openActionMenu(cle); g.menuChoose('skill'); assert.strictEqual(BT.mode, 'skillTarget'); g.battleDraw(); for (const p of HUD.panels) assert(inside(p, w, h), w + 'x' + h + ': skill card inside'); for (const b of HUD.hits) assert(inside(b, w, h)); g.cancel(); g.cancel(); g.cancel(); BT.mode = 'idle'; }
  G('VIEW.w = 480; VIEW.h = 270'); BT.info = geo; BT.mode = 'unitinfo'; const bx = textHook(T); g.battleDraw(); const sheet = bx().map(b => b.text); const tx = k => G('TRX(' + JSON.stringify(k) + ')'); assert(sheet.some(s => s.startsWith(tx('DEFENDER'))), 'role on the sheet'); assert(sheet.some(s => s.includes(tx('BRACED')) && s.includes(tx('Brace') + ':')), 'skill line with the state: ' + sheet.join(' | ')); BT.mode = 'idle';
  BT.cx = geo.x; BT.cy = geo.y; const bx2 = textHook(T); g.battleDraw(); assert(bx2().some(b => b.text === G("TRX('Defender')")), 'role name on the unit card');
  // dart: after a player attack the scout gets a 2-tile move, no undo, and ends spent; X stays put and ends the turn too
  fixedRoll(T, .5); const pid = place(T, 16, 20, 0, 6, 6), cat = place(T, 10, 5, 1, 7, 6); cat.hp = cat.maxHp = 500; pid.hp = pid.maxHp = 500;
  BT.sel = pid; BT.targets = [cat]; BT.tIdx = 0; BT.moveIdx = pid.moves.indexOf(move(pid, 'Wing Attack')); BT.mode = 'target'; g.confirmAttack(); n = 0; while (BT.mode === 'anim' && n++ < 3000) { g.battleUpdate(1 / 60); g.battleDraw(); }
  assert.strictEqual(BT.mode, 'move', 'dart move offered'); assert.strictEqual(BT.dart, true); assert.strictEqual(BT.sel, pid); assert.strictEqual(pid.acted, false); assert.strictEqual(BT.undo, null, 'no undo of the attack');
  const reach = [...BT.reach.values()]; assert(reach.every(c => g.dist(c, pid) <= 2) && reach.length > 1, 'two tiles of reach'); assert.strictEqual(BT.atk.length, 0, 'no second attack');
  const bx3 = textHook(T); g.battleDraw(); assert(bx3().some(b => b.text.includes(G("TR('DART {0}', 2)"))), 'the HUD names the dart');
  g.tileAction(6, 4); n = 0; while (BT.mode === 'anim' && n++ < 2000) { g.battleUpdate(1 / 60); g.battleDraw(); } same([pid.x, pid.y], [6, 4]); assert.strictEqual(pid.acted, true); assert.strictEqual(BT.mode, 'idle'); assert.strictEqual(BT.dart, false);
  const pid2 = place(T, 16, 20, 0, 2, 7); BT.sel = pid2; BT.targets = [cat]; cat.x = 3; cat.y = 7; BT.tIdx = 0; BT.moveIdx = pid2.moves.indexOf(move(pid2, 'Wing Attack')); BT.mode = 'target'; g.confirmAttack(); n = 0; while (BT.mode === 'anim' && n++ < 3000) { g.battleUpdate(1 / 60); g.battleDraw(); }
  assert.strictEqual(BT.mode, 'move'); g.cancel(); assert.strictEqual(pid2.acted, true, 'staying ends the turn'); same([pid2.x, pid2.y], [2, 7]); assert.strictEqual(BT.mode, 'idle');
  // a KO that wins the map ends the battle instead of offering a dart
  arena(T, Array(9).fill('.'.repeat(9))); fixedRoll(T, .5); const pid3 = place(T, 18, 40, 0, 1, 1), last = place(T, 10, 2, 1, 2, 1, { hp: 1 }); BT.sel = pid3; BT.targets = [last]; BT.tIdx = 0; BT.moveIdx = 0; BT.mode = 'target'; g.confirmAttack(); n = 0; while (BT.mode === 'anim' && n++ < 3000) { g.battleUpdate(1 / 60); g.battleDraw(); }
  assert.strictEqual(T.B().result, 'win'); assert.strictEqual(BT.mode, 'end', 'no dart after the winning blow');
  // resume: brace, root and cooldown survive a suspend save written at the start of the phase; nothing is applied twice
  g.startBattle(C.CHAPTERS[0].map, [g.partyUnit(74, 5), g.partyUnit(35, 5), g.partyUnit(1, 5)], { pokeball: 1 }, { chapter: 0, seed: 7, defer: true }); let B = T.B();
  const geo2 = B.units.find(u => u.num === 74), cle2 = B.units.find(u => u.num === 35), en = B.units.find(u => u.team === 1); cle2.cd = 2; en.root = 2; geo2.brace = 1; G('BT.fast = true'); g.beginPhase(0, true);
  assert.strictEqual(cle2.cd, 1, 'cooldown ticked once'); assert.strictEqual(geo2.brace, 0, 'own upkeep ended the brace'); assert.strictEqual(en.root, 2, 'the enemy upkeep has not run');
  g.resumeSuspend(); B = T.B(); const c3 = B.units.find(u => u.num === 35), e3 = B.units.find(u => u.team === 1 && u.x === en.x && u.y === en.y);
  assert.strictEqual(c3.cd, 1, 'not ticked again'); assert.strictEqual(e3.root, 2, 'root restored'); assert.strictEqual(c3.skill.id, 'mend');
});

test('help and menu labels for the roles use real glyphs, the sheet fits at phone widths and the balance sim tool runs one chapter', T => {
  const { g, G, C } = T; const has = c => G('!!(FONT[' + JSON.stringify(c) + '] || FONT[stripAccents(' + JSON.stringify(c) + ')])');
  const check = (s, where) => { for (const c of String(s)) if (c !== ' ') assert(has(c), where + ': glyph missing for U+' + c.codePointAt(0).toString(16) + ' in "' + s + '"'); };
  const ROLES = G('ROLES'), SKILLS = G('SKILLS'); for (const r in ROLES) { check(ROLES[r].name, 'role'); check(ROLES[r].abbr, 'role'); check(ROLES[r].desc, 'role'); } for (const s in SKILLS) { check(SKILLS[s].blurb, 'skill'); if (SKILLS[s].menu) check(SKILLS[s].menu, 'skill'); }
  assert(G('HELP_PAGES').some(p => p[0] === 'ROLES'), 'a help page explains the roles'); assert(G('HELP_PAGES').some(p => p.join(' ').includes('normal hits')), 'help states the forecast rule');
  for (const [w, h] of [[180, 390], [195, 422], [480, 270]]) { G('VIEW.w = ' + w + '; VIEW.h = ' + h); g.startBattle(C.CHAPTERS[2].map, [g.partyUnit(74, 10), g.partyUnit(35, 10)], { pokeball: 1 }, { chapter: 2, seed: 7, defer: true }); const BT = G('BT'); for (const u of T.B().units.slice(0, 6)) { BT.info = u; BT.mode = 'unitinfo'; const boxes = textHook(T); g.battleDraw(); const bad = boxes().filter(b => b.x < -1 || b.x + b.w > w + 1 || b.y < -1 || b.y + b.h > h + 1); assert(!bad.length, w + 'x' + h + ' sheet of ' + u.name + ': ' + JSON.stringify(bad.slice(0, 2))); } }
  G('VIEW.w = 480; VIEW.h = 270');
  const r = require('child_process').spawnSync(process.execPath, [require('path').join(__dirname, 'sim.cjs'), '1', '1-1'], { encoding: 'utf8', env: Object.assign({}, process.env, { SIM_TURNS: '12' }) }); assert.strictEqual(r.status, 0, r.stderr); assert(/^ch1: [wl-]\d+ p\d+e\d+/.test(r.stdout), r.stdout);
});


// Stage 4 review follow-up: no XP from safe bracing, one legality gate at the mutation boundary, clean fresh imports,
// cooldown wording that matches the timing, and narrow forecast rows that never lose the odds or the condition.
test('review: Brace earns no XP, useSkill refuses illegal calls without mutating, fresh encounters clear role state, cooldown wording, narrow forecast rows', T => {
  const { g, G, C } = T;
  // 1. ten idle braces with upkeeps in between never level the unit; Mend and Root still pay
  arena(T); const geo = place(T, 74, 10, 0, 1, 1); place(T, 19, 10, 1, 6, 1); T.B().phase = 0;
  for (let i = 0; i < 10; i++) { geo.acted = false; const ev = g.useSkill(geo, geo.skill, geo); assert(ev && ev.some(e => e.type === 'brace'), 'brace ' + i); assert(!ev.some(e => e.type === 'xp'), 'no XP event'); g.upkeep(0); }
  same([geo.level, geo.xp], [10, 0], 'no free levels from bracing'); assert.strictEqual(G('SKILLS').brace.xp, 0); assert.strictEqual(G('SKILLS').mend.xp, 12); assert.strictEqual(G('SKILLS').root.xp, 12);
  assert(G('HELP_PAGES').some(p => /Brace can be used every turn and earns nothing/.test(p.join(' '))), 'help says Brace earns nothing');
  // 2. the legality gate: dead, spent, frozen, recharging, cooling-down users, a skill that is not the unit's, wrong-team / out-of-range / rooted / flying targets
  arena(T, Array(9).fill('.'.repeat(9))); const bul = place(T, 1, 20, 0, 4, 4), rat = place(T, 19, 20, 1, 6, 4), farRat = place(T, 19, 20, 1, 8, 4), bird = place(T, 16, 20, 1, 4, 6), pal = place(T, 4, 20, 0, 5, 4), cle = place(T, 35, 20, 0, 3, 4); pal.hp = 10;
  const snap = () => JSON.stringify(T.B().units.map(u => g.serializeUnit(u))); const SK = G('SKILLS');
  const refuse = (u, sk, t, why, from) => { const before = snap(); assert.strictEqual(g.skillCheck(u, sk, t, from), why, 'check: ' + why); assert.strictEqual(g.useSkill(u, sk, t, from), null, 'useSkill refuses: ' + why); assert.strictEqual(snap(), before, 'nothing mutated for: ' + why); };
  assert.strictEqual(g.skillCheck(bul, bul.skill, rat), null, 'the legal case');
  bul.hp = 0; refuse(bul, bul.skill, rat, 'fainted'); bul.hp = bul.maxHp; bul.acted = true; refuse(bul, bul.skill, rat, 'acted'); bul.acted = false;
  bul.status = 'frz'; refuse(bul, bul.skill, rat, 'frozen'); bul.status = null; bul.recharge = 1; refuse(bul, bul.skill, rat, 'recharging'); bul.recharge = 0; bul.cd = 1; refuse(bul, bul.skill, rat, G("TR('cooldown {0}', 1)")); bul.cd = 0;
  refuse(bul, SK.mend, pal, 'none', undefined); refuse(bul, SK.brace, bul, 'none'); refuse(bul, SK.dart, rat, 'none');
  refuse(bul, bul.skill, farRat, 'bad target'); refuse(bul, bul.skill, pal, 'bad target'); refuse(bul, bul.skill, bird, 'bad target'); rat.root = 2; refuse(bul, bul.skill, rat, 'no target'); rat.root = 0; // the only foe in range is already rooted
  refuse(cle, cle.skill, cle, 'no target'); refuse(cle, cle.skill, rat, 'no target'); refuse(cle, cle.skill, pal, 'no target', undefined); // Charmander is two tiles from Clefairy: nothing legal from here
  assert.strictEqual(g.skillCheck(cle, cle.skill, pal, { x: 5, y: 5 }), null, 'a preview from a hypothetical adjacent tile is legal'); assert.notStrictEqual(g.skillCheck(cle, cle.skill, pal, { x: 5, y: 7 }), null, 'and from a far one is not');
  assert.strictEqual(g.skillBlock(cle), 'no target'); cle.acted = true; assert.strictEqual(g.skillBlock(cle), 'acted'); assert.strictEqual(g.skillReady(cle), false); cle.acted = false;
  // the UI and AI paths go through the same gate: confirmSkill on a frozen user does nothing, the AI never proposes a skill for a frozen or spent unit
  const BT = G('BT'); BT.sel = bul; BT.targets = [rat]; BT.tIdx = 0; BT.mode = 'skillTarget'; bul.status = 'frz'; const b0 = snap(); g.confirmSkill(); assert.strictEqual(snap(), b0); assert.strictEqual(BT.mode, 'skillTarget'); bul.status = null;
  bul.acted = true; assert(!(g.aiDecide(bul) || {}).skill, 'AI: no skill for a spent unit'); bul.acted = false; bul.status = 'frz'; assert(!(g.aiDecide(bul) || {}).skill, 'AI: no skill when frozen'); bul.status = null;
  same(g.skillQueue(bul, SK.mend, pal), [], 'an illegal AI queue is empty'); assert.strictEqual(bul.cd, 0);
  const ok = g.useSkill(bul, bul.skill, rat); assert(ok && rat.root === 2 && bul.cd === 2, 'the legal call still works');
  // 3. a fresh encounter drops root/brace/cd from an imported party member; a suspend save keeps them
  g.startBattle(C.CHAPTERS[0].map, [Object.assign(g.partyUnit(1, 5), { root: 2, brace: 1, cd: 2 })], {}, { chapter: 0, seed: 7, defer: true }); const fresh = g.alive(0)[0]; same([fresh.root, fresh.brace, fresh.cd], [0, 0, 0], 'fresh import clears role state');
  g.launchVersus({ seed: 5, level: 20, wild: false, teams: [[25], [74]], order: [0, 1], size: 1, cur: 0 }); for (const u of T.B().units) same([u.root, u.brace, u.cd], [0, 0, 0], 'versus import clean');
  const rec = { num: 1, level: 5, xp: 0, hp: 20, team: 0, x: 1, y: 3, root: 2, brace: 1, cd: 2, id: 9 }; const ru = g.restoreUnit(rec); same([ru.root, ru.brace, ru.cd], [2, 1, 2], 'restoreUnit itself keeps them (suspend path)');
  // 4. wording: menu, card and sheet all say every other turn / ready in n turns; nothing says "every 3"
  arena(T, Array(9).fill('.'.repeat(9))); G('VIEW.w = 480; VIEW.h = 270'); const c2 = place(T, 35, 20, 0, 4, 4), h2 = place(T, 4, 20, 0, 5, 4); h2.hp = 10; T.B().phase = 0;
  BT.sel = c2; g.openActionMenu(c2); const it = BT.menu.items.find(i => i.id === 'skill'), eot = G("TRX('every other turn')"); assert(it.sub.includes(eot) && !/every 3/.test(it.sub), it.sub);
  g.menuChoose('skill'); let boxes = textHook(T); g.battleDraw(); let strs = boxes().map(b => b.text); assert(strs.some(s => s.includes(eot)) && !strs.some(s => /next in 3|every 3/.test(s)), 'card wording: ' + strs.filter(s => /turn/.test(s)).join(' | ')); assert(strs.includes(G("TR('+{0} XP', 12)")) || strs.some(s => s.includes(G("TR('+{0} XP', 12)"))), 'card shows the XP');
  g.cancel(); g.cancel(); BT.mode = 'idle'; c2.cd = 2; BT.info = c2; BT.mode = 'unitinfo'; boxes = textHook(T); g.battleDraw(); strs = boxes().map(b => b.text); assert(strs.some(s => s.includes(G("TR('ready in {0} turns', 2)"))), 'sheet: ' + strs.join(' | ')); BT.mode = 'idle';
  // 5. narrow forecast rows: long move name, a conditional counter and a conditional follow-up keep damage, hit%, crit% and the condition; the crit KO tag survives
  for (const [w, h] of [[180, 390], [195, 422], [207, 448], [480, 270]]) {
    const T2 = loadGame(); const g2 = T2.g, G2 = T2.G; G2('VIEW.w = ' + w + '; VIEW.h = ' + h); arena(T2); G2('rnd = () => .5'); const BT2 = G2('BT');
    const a = place(T2, 6, 30, 0, 1, 1), d = place(T2, 10, 3, 1, 2, 1); const mv = a.moves.find(m => m.name === 'Flamethrower'); BT2.sel = a; BT2.targets = [d]; BT2.tIdx = 0; BT2.moveIdx = a.moves.indexOf(mv); BT2.mode = 'target';
    // the summary view answers the three questions on three lines (deal / answer / risk) and marks the KO; the detailed table is one toggle away
    { const bx0 = textHook(T2); g2.drawHUD(); const all0 = bx0(); const fr0 = g2.forecastRect(); const inCard = all0.filter(b => b.y >= fr0.y + 55 && b.y < fr0.y + fr0.h - 16).map(b => b.text); assert(inCard.includes('KO') && inCard.some(t => /^▸ .* 555/.test(t)) && inCard.some(t => /^◂ .* 2 · /.test(t)) && inCard.some(t => t.startsWith(G2("TR('Risk: ')"))), w + 'x' + h + ': summary lines: ' + inCard.join(' | ')); if (EN) assert(inCard.some(t => /^▸ FLAMETHROWER 555/.test(t)) && inCard.some(t => /^◂ TACKLE 2 · only if it survives/.test(t)), w + 'x' + h + ': summary wording: ' + inCard.join(' | ')); for (const b of all0) assert(b.x >= fr0.x - 1 && b.x + b.w <= fr0.x + fr0.w + 1 || b.y < fr0.y || b.y > fr0.y + fr0.h + 12, w + 'x' + h + ': summary text inside its card: ' + b.text); assert(g2.detailHit(fr0.x + 5, fr0.y + 60) && !g2.forecastHit(fr0.x + 5, fr0.y + 60) && !g2.moveSwitchHit(fr0.x + 5, fr0.y + 60), 'the lines are their own hit area'); g2.keyInput('detail'); assert.strictEqual(BT2.forecastDetail, true, 'V opens the details'); }
    const rows = () => { const bx = textHook(T2); g2.drawHUD(); const all = bx(); const fr = g2.forecastRect(); for (const b of all) assert(b.x >= fr.x - 1 && b.x + b.w <= fr.x + fr.w + 1 || b.y < fr.y || b.y > fr.y + fr.h + 12, w + 'x' + h + ': forecast text inside its card: ' + b.text); const rb = all.filter(b => /^[▸◂] /.test(b.text)); return { rows: rb.map(b => b.text), cells: rb.map(r => all.filter(b => b.y === r.y && b.x > r.x).map(b => b.text)), ko: all.filter(b => b.text === 'KO').map(b => b.x), fr, table: fr.w >= 200 }; };
    let R = rows(); const tag = w + 'x' + h + ': '; assert.strictEqual(R.rows.length, 3, tag + 'three strike rows');
    if (R.table) { // wide cards lay the strikes out as a table: the name and condition in the first column, DMG / HIT / CRIT as cells
      assert((!EN || /^▸ FLAMET\w*(  .*)?$/.test(R.rows[0])) && R.cells[0].includes('555') && R.cells[0].includes('100%') && R.cells[0].includes('4%') && R.cells[0].includes('KO'), tag + 'first row: ' + R.rows[0] + ' | ' + R.cells[0].join(' '));
      assert((!EN || /^◂ TACKLE  if (Caterpie )?alive$/.test(R.rows[1])) && R.cells[1].includes('2') && R.cells[1].some(s => /^\d+%$/.test(s)) && R.cells[1].includes('4%'), tag + 'conditional counter keeps hit, crit and the condition: ' + R.rows[1] + ' | ' + R.cells[1].join(' '));
      assert((!EN || /^▸ FLAMET\w*  if (Caterpie )?alive$/.test(R.rows[2])) && R.cells[2].includes('555') && R.cells[2].includes('100%') && R.cells[2].includes('4%'), tag + 'conditional follow-up too: ' + R.rows[2] + ' | ' + R.cells[2].join(' '));
    } else {
      const cond = G2("TR('if {0} alive', '')").trim().split(/\s+/).pop(); // the condition's last word: alive / sigue
      if (EN) assert(/^▸ FLAMET\w* 555 KO  100% · crit 4%/.test(R.rows[0]), tag + 'first row: ' + R.rows[0]); else assert(/ 555 KO  100% · /.test(R.rows[0]) && /4%/.test(R.rows[0]), tag + 'first row: ' + R.rows[0]);
      assert(EN ? /^◂ TACKLE 2  \d+% · c(rit )?4% · if (Caterpie )?alive$/.test(R.rows[1]) : / 2  \d+% · .*4% · .*/.test(R.rows[1]) && R.rows[1].endsWith(cond), tag + 'conditional counter keeps hit, crit and the condition: ' + R.rows[1]);
      assert(EN ? /^▸ FLAMET\w* 555  100% · c(rit )?4% · if (Caterpie )?alive$/.test(R.rows[2]) : / 555  100% · .*4% · .*/.test(R.rows[2]) && R.rows[2].endsWith(cond), tag + 'conditional follow-up too: ' + R.rows[2]);
    }
    assert(R.ko.length >= 1, tag + 'KO tag drawn'); assert(g2.textWidth(R.rows[0]) <= R.fr.w - 12 && g2.textWidth(R.rows[1]) <= R.fr.w - 12 && g2.textWidth(R.rows[2]) <= R.fr.w - 12, tag + 'rows fit the card');
    // a critical that would KO where the normal hit does not: the crit part reads "crit 4% KO" (a second KO tag next to the crit cell on wide cards)
    const fc = g2.forecast(a, d, mv, a); d.hp = fc.a.dmg + 1; R = rows(); if (!R.table) assert(/ 555  100% · .*4% KO/.test(R.rows[0]), tag + 'crit KO warning: ' + R.rows[0]); assert(R.ko.length >= 2, tag + 'crit KO tag drawn (' + R.ko.length + ')');
    const HUD = G2('HUD'); const fr = g2.forecastRect(); assert(inside(fr, w, h)); for (const b of HUD.hits) assert(inside(b, w, h) && !overlaps(fr, b), tag + 'forecast clear of ' + b.label); assert(g2.forecastHit(fr.x + 5, fr.y + 5) && g2.moveSwitchHit(fr.x + 5, fr.y + fr.h - 6), tag + 'hit areas intact');
    BT2.mode = 'help'; for (let p = 0; p < G2('HELP_PAGES').length; p++) { BT2.helpPage = p; g2.battleDraw(); const hr = g2.helpRect(); assert(inside(hr, w, h) && hr.lines.every(l => g2.textWidth(l) <= hr.w - 16), tag + 'help page ' + p + ' fits'); }
  }
  assert.strictEqual(g.fitForecastLine({ side: 'a', name: 'HYPER BEAM', dmg: 12, ko: false, hit: 90, crit: 4, critKo: true, braced: true, eff: '×1.5', drain: 3, cond: 'only if Wigglytuff survives' }, 100).text.length > 0, true);
  const tiny = g.fitForecastLine({ side: 'c', name: 'THUNDERBOLT', dmg: 12, ko: false, hit: 85, crit: 24, critKo: false, braced: false, eff: '', drain: 0, cond: 'only if Wigglytuff survives' }, 150); assert(/85%/.test(tiny.text) && /24%/.test(tiny.text) && (!EN || /c(rit )?24%/.test(tiny.text) && /if (Wigglytuff )?alive/.test(tiny.text)) && g.textWidth(tiny.text) <= 150, 'the fitter keeps odds and condition at 150 px: ' + tiny.text);
});


// Stage 4 review follow-up 2: the skill card's cost footer wraps across the card instead of clipping.
test('skill card: Root/Mend/Brace text, panel and hint stay inside 180/195/512 widths, footer wrapped, confirm and cancel hit targets work', T0 => {
  for (const w of [180, 195, 512]) for (const n of [1, 35, 74]) {
    const T = loadGame(); const { g, G } = T; G('VIEW.w = ' + w + '; VIEW.h = 390'); arena(T); const BT = G('BT'), HUD = G('HUD'); T.B().phase = 0;
    const u = place(T, n, 10, 0, 1, 1), t = place(T, 19, 10, n === 35 ? 0 : 1, 2, 1); t.hp = 5; BT.sel = u; BT.targets = [n === 74 ? u : t]; BT.tIdx = 0; BT.mode = 'skillTarget';
    const boxes = textHook(T); g.battleDraw(); const all = boxes(); const tag = w + ' ' + u.name + ': '; const r = g.skillCardRect();
    for (const b of all) assert(b.x >= 0 && b.x + b.w <= w && b.y >= 0 && b.y + b.h <= 390, tag + 'text inside the view: ' + b.text);
    const card = all.filter(b => b.y >= r.y && b.y < r.y + r.h); for (const b of card) assert(b.x >= r.x + 2 && b.x + b.w <= r.x + r.w - 2, tag + 'text inside the card: ' + b.text);
    const joined = r.cost.join(' '), tr = G('TR'), xp = tr('+{0} XP', 12).replace(/\+\d+ /, ''); assert(joined.includes(tr('uses the action')), tag + 'cost present'); if (u.skill.cd) assert(joined.includes(tr('every other turn')), tag + 'cadence present'); if (u.skill.xp) assert(joined.includes(tr('+{0} XP', 12)), tag + 'XP present'); else assert(!joined.includes(xp), tag + 'Brace shows no XP');
    assert(r.cost.every(l => g.textWidth(l) <= r.w - 12), tag + 'footer lines fit'); assert(all.some(b => b.text === r.cost[r.cost.length - 1]), tag + 'last footer line rendered');
    const hint = all.find(b => b.text.includes(G("TRX('confirm')"))); assert(hint && hint.y >= r.y + r.h, tag + 'hint below the card: ' + JSON.stringify(hint) + ' card ' + JSON.stringify([r.x, r.y, r.w, r.h])); assert(inside(r, w, 390), tag + 'card inside'); for (const p of HUD.panels) assert(inside(p, w, 390), tag + 'panel inside'); for (const b of HUD.hits) assert(inside(b, w, 390) && !overlaps(r, b), tag + 'card clear of ' + b.label);
    assert(r.h >= 40 + r.cost.length * 9, tag + 'panel tall enough for ' + r.cost.length + ' footer lines');
    // pointer: a tap inside the card confirms, a tap on empty board cancels back to the menu
    const before = JSON.stringify([u.cd, u.brace, t.hp, t.root]); g.pointerInput({ type: 'down', x: r.x + 5, y: r.y + 5, btn: 0 }); g.pointerInput({ type: 'up', x: r.x + 5, y: r.y + 5, btn: 0 }); assert.strictEqual(BT.mode, 'anim', tag + 'tap on the card confirms'); assert.notStrictEqual(JSON.stringify([u.cd, u.brace, t.hp, t.root]), before, tag + 'skill applied');
    let k = 0; while (BT.mode === 'anim' && k++ < 2000) { g.battleUpdate(1 / 60); g.battleDraw(); } assert.strictEqual(u.acted, true);
    u.acted = false; u.cd = 0; u.brace = 0; t.hp = 5; t.root = 0; BT.sel = u; g.openActionMenu(u); g.menuChoose('skill'); assert.strictEqual(BT.mode, 'skillTarget', tag + 'reopened'); g.keyInput('back'); assert.strictEqual(BT.mode, 'menu', tag + 'X cancels to the menu'); assert.strictEqual(u.cd, 0);
  }
});

// ---------------------------------------------------------------- runner
// Versus rules: flag pick-up, drop and capture; hill scoring; fog vision, hidden foes and the ambush stop.
test('versus rules: capture the flag, king of the hill, fog of war vision and ambushes', T => {
  const { g, G } = T;
  // capture the flag on a small arena
  g.launchVersus({ seed: 5, level: 20, wild: false, mode: 'ctf', arena: 's', fog: false, turns: 30, teams: [[25, 5], [4, 7]], order: [0, 1, 1, 0], size: 2, cur: 0 });
  let B = T.B(); assert.strictEqual(B.map.objective.mode, 'ctf'); assert(B.flags && B.flags.length === 2, 'two flags'); const f0 = B.flags.find(f => f.team === 0), f1 = B.flags.find(f => f.team === 1);
  const me = B.units.find(u => u.team === 0); me.x = f1.home.x; me.y = f1.home.y; let ev = g.versusAfterAction(me); assert(ev && ev.what === 'taken', 'stepping on the enemy flag takes it'); assert.strictEqual(f1.carrier, me.id);
  me.x = 5; me.y = 5; g.syncFlags(); assert(f1.x === 5 && f1.y === 5, 'the flag follows its carrier');
  me.hp = 0; g.syncFlags(); assert.strictEqual(f1.carrier, null, 'a fainted carrier drops the flag'); assert(f1.x === 5 && f1.y === 5, 'dropped where it fell');
  const foe = B.units.find(u => u.team === 1); foe.x = 5; foe.y = 5; ev = g.versusAfterAction(foe); assert(ev && ev.what === 'returned' && f1.x === f1.home.x && f1.y === f1.home.y, 'its owner sends a dropped flag home');
  const me2 = B.units.filter(u => u.team === 0 && u.hp > 0)[0]; me2.x = f1.home.x; me2.y = f1.home.y; g.versusAfterAction(me2); me2.x = f0.home.x; me2.y = f0.home.y; ev = g.versusAfterAction(me2); assert(ev && ev.what === 'captured', 'carrying it home captures'); assert.strictEqual(g.checkObjective(), 'p1'); assert.strictEqual(B.endReason, G("TR('Player {0} captured the flag!', 1)"));
  // king of the hill
  g.launchVersus({ seed: 5, level: 20, wild: false, mode: 'hill', arena: 'm', fog: false, turns: 30, teams: [[25, 5], [4, 7]], order: [0, 1, 1, 0], size: 2, cur: 0 });
  B = T.B(); assert(B.hill && B.hill.need === 3, 'hill needs three turns'); const h = B.hill; for (const u of B.units.filter(u => u.team === 0)) { u.x = h.x; u.y = h.y; } B.units.filter(u => u.team === 0)[1].x = h.x + 1;
  assert.strictEqual(g.versusPhaseStart(1), null, 'the other team scores nothing'); for (let i = 0; i < 3; i++) assert(g.versusPhaseStart(0), 'out-numbering on the hill scores'); assert.strictEqual(h.score[0], 3); assert.strictEqual(g.checkObjective(), 'p1');
  // fog of war
  g.launchVersus({ seed: 5, level: 20, wild: false, mode: 'elim', arena: 'm', fog: true, turns: 30, teams: [[25, 5], [4, 7]], order: [0, 1, 1, 0], size: 2, cur: 0 });
  B = T.B(); assert(B.fog, 'fog on'); const p1 = B.units.find(u => u.team === 0), p2 = B.units.find(u => u.team === 1); p1.x = 4; p1.y = 5; p2.x = 12; p2.y = 5;
  g.refreshVision(0); assert(g.fogHides(p2, 0), 'a far foe is hidden'); assert(!g.fogHides(p1, 0), 'own units are never hidden'); p2.x = 6; g.refreshVision(0); assert(!g.fogHides(p2, 0), 'a foe within 3 tiles is seen');
  p2.x = 12; g.refreshVision(0); const seen = g.reachable(p1, p1.x, p1.y, 40, { through: o => g.fogHides(o, 0) }), plain = g.reachable(p1, p1.x, p1.y, 40); assert(seen.has('12,5') && !plain.has('12,5'), 'a hidden foe does not block planning, a seen one does');
  const path = [{ x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }, { x: 11, y: 5 }, { x: 12, y: 5 }, { x: 13, y: 5 }]; const fp = g.fogPath(p1, path); assert.strictEqual(fp.ambush, p2, 'the hidden foe on the path springs an ambush'); assert.strictEqual(fp.path.length, 4, 'the move stops on the tile before it');
  assert.strictEqual(g.fogPath(p1, path.slice(0, 3)).ambush, null, 'a clear path is unchanged');
});
test('battle menus: the day menu, toggles in place, END TURN and RETREAT ask first, the PC opens on a lone base, the wheel walks rows', T => {
  const { g, G, C } = T; G('SAVE = { chapter: 0, party: [], bag: {}, stars: {}, beaten: false, co: "you" }');
  g.startBattle(C.CHAPTERS[0].map, [g.partyUnit(4, 6), g.partyUnit(16, 5)], { pokeball: 1 }, Object.assign(g.chapterOpts(0, [g.partyUnit(25, 5), g.partyUnit(7, 5)], 7), { lesson: false }));
  const BT = G('BT'), B = T.B(); B.phase = 0; BT.mode = 'idle'; B.war.funds[0] = 3000;
  g.openEndMenu(); const ids = BT.menu.items.map(it => it.id);
  assert(ids[0] === 'endturn' && ids.includes('pc') && ids.includes('danger') && ids.includes('help') && ids.includes('scene') && ids.includes('mute') && ids[ids.length - 1] === 'retreat', 'day menu: ' + ids.join(','));
  BT.menu.i = ids.indexOf('danger'); const was = !!BT.showDanger; g.activateMenu(); assert.strictEqual(!!BT.showDanger, !was, 'the danger toggle switches'); assert(BT.mode === 'endmenu' && BT.menu.items[BT.menu.i].id === 'danger', 'and the menu stays on its row');
  BT.menu.i = 0; g.activateMenu(); assert.strictEqual(BT.mode, 'confirm', 'END TURN with Pokémon ready asks'); assert.strictEqual(G('BT.confirm.i'), 0, 'KEEP PLAYING is chosen first');
  g.confirmInput({ type: 'key', key: 'back' }); assert(BT.mode === 'idle' && B.phase === 0, 'X keeps playing');
  g.openEndMenu(); BT.menu.i = BT.menu.items.findIndex(it => it.id === 'retreat'); g.activateMenu(); assert.strictEqual(BT.mode, 'confirm', 'RETREAT asks'); g.confirmChoose(0); assert(BT.mode === 'endmenu' && !B.result, 'STAY goes back to the day menu');
  BT.menu.i = 0; g.menuWheel(-120); assert.strictEqual(BT.menu.i, 0, 'the wheel does not wrap'); g.menuWheel(60); assert.strictEqual(BT.menu.i, 1, 'a notch moves a row'); g.menuWheel(15); g.menuWheel(15); assert.strictEqual(BT.menu.i, 1, 'small deltas add up'); g.menuWheel(15); assert.strictEqual(BT.menu.i, 2, 'to a notch');
  assert.strictEqual(g.warDeploySites(0).length, 1, 'one base on front 1');
  BT.menu.i = BT.menu.items.findIndex(it => it.id === 'pc'); g.activateMenu(); assert.strictEqual(BT.menu.kind, 'pc', 'with one base the PC opens on it'); assert(!BT.menu.items[BT.menu.i].off, 'a ready Pokémon is chosen first');
  g.cancel(); assert(BT.mode === 'endmenu' && BT.menu.kind === 'main' && BT.menu.items[BT.menu.i].id === 'pc', 'back returns to the day menu on the PC row');
  for (const u of B.units.filter(u => u.team === 0)) u.acted = true; BT.menu.i = 0; g.activateMenu(); assert.notStrictEqual(BT.mode, 'confirm', 'with everyone done END TURN does not ask');
});
test('deploys play as a send-out: the Pokémon stays hidden until its ball opens and lands whole, the player\'s and the AI\'s', T => {
  const { g, G, C } = T; G('SAVE = { chapter: 2, party: [partyUnit(4, 10), partyUnit(16, 9), partyUnit(25, 10), partyUnit(74, 9), partyUnit(7, 9), partyUnit(1, 9)], bag: { pokeball: 3 }, stars: {}, captainPid: 0, starter: 4, co: "you", journey: { version: 1, firstCatch: true } }');
  const party = G('SAVE.party').map((p, pid) => Object.assign({}, p, { pid })); g.startBattle(C.CHAPTERS[2].map, party.slice(0, 4), {}, g.chapterOpts(2, party.slice(4), 5)); const B = T.B(), BT = G('BT');
  const play = (u, frames = 900) => { let seen = false, n = 0; while (n++ < frames && (BT.mode === 'anim' || BT.mode === 'banner')) { if (BT.anim && BT.anim.ev && BT.anim.ev.unit === u) { seen = true; if (BT.anim.t < .05) assert.strictEqual(u.fx.alpha, 0, u.name + ' hidden while the ball rises'); } else if (seen) break; g.battleUpdate(1 / 60); g.battleDraw(); } return seen; };
  // the player's PC
  B.phase = 0; BT.mode = 'idle'; B.war.funds[0] = 9000; const hq = B.war.props.find(p => p.owner === 0 && p.kind === 'hq'); const o = g.unitAt(hq.x, hq.y); if (o) o.x = 0;
  g.openDeployMenu(hq); g.activateMenu(); const mine = g.unitAt(hq.x, hq.y); assert(mine && mine.team === 0, 'deployed on the HQ'); assert.strictEqual(mine.fx.alpha, 0, 'hidden until its send-out');
  assert(play(mine), 'its send-out plays'); assert(mine.fx.alpha === 1 && mine.fx.sx === 1 && mine.fx.sy === 1 && !mine.fx.tint, 'it stands whole afterwards');
  // the AI's reinforcements wait hidden behind the phase banner, then come out one by one
  g.alive(1).filter(u => !u.leader && !u.boss).slice(0, 4).forEach(u => { u.hp = 0; }); for (const p of B.war.props.filter(p => p.owner === 1)) { const v = g.unitAt(p.x, p.y); if (v) v.hp = 0; }
  B.war.funds[1] = 20000; g.beginPhase(1, false); const spawns = BT.queue.filter(q => q.kind === 'event' && q.ev.type === 'spawn' && q.ev.deploy).map(q => q.ev.unit);
  assert(spawns.length >= 1, 'the AI deploys'); assert(spawns.every(u => u.fx.alpha === 0), 'its Pokémon are hidden during the banner');
  for (const u of spawns) { assert(play(u), u.name + ' comes out'); assert.strictEqual(u.fx.alpha, 1, u.name + ' is visible after its send-out'); }
  // a fainted Pokémon of a side with a Box is recalled to it; a wild one just faints
  while (BT.mode === 'anim' || BT.mode === 'banner') { g.battleUpdate(1 / 60); if (G('BT.queue.length') === 0 && !BT.anim) break; } BT.queue.length = 0; BT.anim = null;
  const wild = g.makeUnit(10, 3, 2, { x: 0, y: 0 }); B.units.push(wild); for (const [u, recalled] of [[mine, true], [wild, false]]) { u.hp = 0; BT.queue.length = 0; G('BT').queue.push({ kind: 'event', ev: { type: 'ko', unit: u } }); g.playQueue(() => { BT.mode = 'idle'; });
    const kinds = []; let n = 0; while (BT.mode === 'anim' && n++ < 600) { if (BT.anim && BT.anim.ev && !kinds.includes(BT.anim.ev.type)) kinds.push(BT.anim.ev.type); g.battleUpdate(1 / 60); g.battleDraw(); }
    assert.strictEqual(kinds.includes('recall'), recalled, u.name + (recalled ? ' is recalled to the Box' : ' is not recalled') + ': ' + kinds.join(',')); }
});
test('commander powers: each Power and Super Power does what it says, plays its cast and sweep through the queue and marks the field', T0 => {
  const cases = [['brock', 4], ['misty', 4], ['surge', 4], ['erika', 4], ['koga', 4], ['sabrina', 4], ['blaine', 4], ['blue', 4], ['giovanni', 4], ['rocket', 4], ['you', 4], ['you', 7], ['you', 1]];
  for (const [co, cap] of cases) for (const sup of [false, true]) for (const [w, h] of sup ? [[195, 422], [640, 360]] : [[422, 195]]) {
    const T = loadGame(), { g, G } = T, tag = co + (co === 'you' ? cap : '') + (sup ? ' super ' : ' power ') + w + 'x' + h + ': '; G(`VIEW.w = ${w}; VIEW.h = ${h}; rnd = () => .5`);
    g.launchVersus({ seed: 5, level: 30, wild: false, mode: 'elim', arena: 'm', fog: false, turns: 30, co0: co, co1: co === 'you' ? 'brock' : co, cap0: cap, cap1: 7, teams: [[25, 6, 9, 3], [7, 133, 1, 4]], order: [0, 1, 1, 0, 0, 1, 1, 0], size: 4, cur: 0 });
    G("B.phase = 0; BT.mode = 'idle'; for (const u of B.units) u.hp = Math.max(1, Math.round(u.maxHp * .6)); const s = powerState(0); s.charge = 100; s.superUnlocked = true;");
    const hp = () => G('JSON.stringify(B.units.filter(u => u.team <= 1).map(u => [u.team, u.hp]))'), before = JSON.parse(hp()), ev = G(`activatePower(0, ${sup})`); assert(ev && ev.length && ev[0].type === 'power', tag + 'activates');
    const after = JSON.parse(hp()), fx = co === 'you' ? null : G(`COS['${co}'].${sup ? 'super' : 'power'}`), sum = (a, t) => a.filter(x => x[0] === t).reduce((n, x) => n + x[1], 0);
    // what it promises
    if (fx && fx.heal || co === 'you' && cap === 1) assert(sum(after, 0) > sum(before, 0), tag + 'the side heals');
    if (fx && fx.enemyDmg) assert(sum(after, 1) < sum(before, 1), tag + 'the foes are hurt');
    if (fx && fx.weather) assert.strictEqual(G('weatherKind()'), fx.weather[0], tag + 'the weather turns');
    if (fx && fx.future) assert.strictEqual(G('powerState(0).future'), fx.future, tag + 'Future Sight is planted');
    const ally = 'alive(0).find(u => !u.leader) || alive(0)[0]', foe = 'alive(1)[0]';
    if (fx && fx.def && !fx.types) assert(Math.abs(G(`coDefMult(${ally})`) - (1 - fx.def)) < 1e-9, tag + 'allies take less');
    if (fx && fx.atk && !fx.atkTypes) assert(G(`coAtkMult(${ally}, (${ally}).moves[0])`) >= 1 + fx.atk - 1e-9, tag + 'allies hit harder');
    if (fx && fx.move) assert(G(`coMove(${ally})`) >= fx.move, tag + 'allies move further');
    if (fx && fx.eva) assert.strictEqual(G(`coEva(${ally})`), fx.eva, tag + 'allies dodge more');
    if (fx && fx.enemyMove) { G('B.phase = 1'); assert(G(`coMove(${foe})`) <= fx.enemyMove, tag + 'foes move less on their turn'); G('B.phase = 0'); }
    if (co === 'you' && cap === 4) assert(G(`powerDamageMultiplier(${ally}, ${foe}, (${ally}).moves[0])`) >= (sup ? 1.5 : 1.25) - 1e-9, tag + 'the next attack is stronger');
    if (co === 'you' && cap === 7) assert(G(`powerDamageMultiplier(${foe}, ${ally}, (${foe}).moves[0])`) <= (sup ? .6 : .8) + 1e-9, tag + 'allies take less');
    // the show: the cast and the sweep play through the queue; text stays on screen; the chips say what it does
    assert(G(`copEffects(${JSON.stringify({ co, root: cap, superPower: sup })}).length`) > 0, tag + 'chips');
    g.__ev = ev; G("BT.queue = __ev.map(e => ({ kind: 'event', ev: e })); playQueue(() => { BT.mode = 'idle'; });");
    const boxes = textHook(T); let n = 0, maxT = 0; while (G("BT.mode === 'anim'") && n++ < 1200) { g.battleUpdate(1 / 30); if (G("BT.anim && BT.anim.ev && BT.anim.ev.type === 'power'")) maxT = Math.max(maxT, G('BT.anim.t')); if (n % 6 === 0 && !G("BT.anim && BT.anim.ev && BT.anim.ev.type === 'power' && BT.anim.t > copTimes(BT.anim.ev.superPower).cast - .3 && BT.anim.t < copTimes(BT.anim.ev.superPower).cast")) { g.battleDraw(); boxes(); g.drawHUD(); const bad = boxes().filter(b => b.x < -1 || b.x + b.w > w + 1 || b.y < -1 || b.y + 7 > h + 1); assert(!bad.length, tag + 'text off screen at ' + n + ': ' + JSON.stringify(bad.slice(0, 2))); } }
    assert.strictEqual(G('BT.mode'), 'idle', tag + 'the queue completes'); assert(maxT <= (sup ? 4.2 : 2.6), tag + 'brisk: ' + maxT.toFixed(2) + 's');
    // while it lasts: boosted allies (and hindered foes) are marked on the field
    const aura = G('JSON.stringify(copAura(0))'); if (fx && (fx.def || fx.atk || fx.eva || fx.move || fx.crit || fx.spAtk) || co === 'you' && (cap !== 1 || sup)) assert(aura !== 'null' && JSON.parse(aura).ally, tag + 'allies wear the aura: ' + aura);
    if (fx && (fx.future || fx.enemyMove)) assert(JSON.parse(aura).foe, tag + 'foes wear the mark');
    g.battleDraw();
  }
});
test('dialogue: every line of the story fits its box on phones and desktop, in English and Spanish', T0 => {
  for (const lang of ['en', 'es']) for (const [w, h] of [[180, 390], [195, 422], [422, 195], [640, 360]]) {
    const T = loadGame(), { g, G } = T; G(`setLang('${lang}'); VIEW.w = ${w}; VIEW.h = ${h};`); const boxes = textHook(T);
    const lines = G('PROLOGUE.concat(...CHAPTERS.map(c => (c.intro || []).concat(c.outro || [])))'), wide = w >= 480 && h >= 280, bottom = h - (wide ? 14 : 8) - 4 - 2;
    lines.forEach((line, k) => { G('startDialog([' + JSON.stringify(line) + '], () => {}, { stage: prologueStage }); SC.dialog.chars = 1e9; SC.dialog.t = 5; SC.dialog.T = 5;'); boxes(); g.storyDraw();
      const low = boxes().filter(b => b.y > h * .35 && !/^\d+ ?\/ ?\d+$/.test(b.text)); for (const b of low) assert(b.y + 7 <= bottom && b.x >= 0 && b.x + b.w <= w, `${lang} ${w}x${h} line ${k} (${line.who}): "${b.text}" leaves its box`); });
  }
});
test('touch: dialogs offer a SKIP pill that ends the scene; help and the unit sheet speak in taps', T => {
  const { g, G } = T; G('VIEW.w = 195; VIEW.h = 422; VIEW.touch = true'); g.startNewGame(); for (let i = 0; i < 20; i++) { g.storyUpdate(1 / 30); g.storyDraw(); }
  const k = G('SC.dialog.skipHit'); assert(k && k.x + k.w <= 195 && k.y >= 0, 'a SKIP pill on screen'); g.storyInput({ type: 'up', x: k.x + 2, y: k.y + 2 }); assert.strictEqual(G('SC.dialog'), null, 'tapping SKIP ends the dialog');
  G('VIEW.touch = false'); g.startNewGame(); for (let i = 0; i < 5; i++) { g.storyUpdate(1 / 30); g.storyDraw(); } assert.strictEqual(G('SC.dialog.skipHit'), null, 'with a keyboard, X skips and no pill shows');
});
test('title and options: your party on the knoll with its Ace, the trainer card, options that change and persist, erase asks first', T => {
  const { g, G, store } = T; G('VIEW.w = 640; VIEW.h = 360');
  store.set('pk_save', JSON.stringify({ chapter: 3, party: [G('partyUnit(16, 12)'), G('partyUnit(4, 14)'), G('partyUnit(25, 13)')], captainPid: 1, starter: 4, bag: {}, stars: {}, rating: {}, beaten: false }));
  g.goScene('title'); g.titleDraw(); const team = G('SC.titleTeam'), ace = G('SC.titleAce'); assert.strictEqual(team.length, 3); assert.strictEqual(G('DEX')[team[ace]].name.startsWith('Char'), true, 'the Ace stands beside the Tactician: ' + team);
  assert.strictEqual(G('SC.titleItems')[0].label, 'CONTINUE'); assert(G('SC.titleItems').some(it => it.label === 'OPTIONS'), 'OPTIONS is on the menu');
  const oi = G("SC.titleItems.findIndex(it => it.label === 'OPTIONS')"); g.titleActivate(oi); g.titleUpdate(.21); assert.strictEqual(G('SC.name'), 'options');
  const row = id => G("optionRows().findIndex(r => r.id === '" + id + "')");
  g.optionsDraw(); const before = G('PREF.battle'); G('SC.i = ' + row('battle')); g.optionsInput({ type: 'key', key: 'right' }); assert.notStrictEqual(G('PREF.battle'), before, 'right changes the battle scene'); assert.strictEqual(store.get('pk_battle'), G('PREF.battle'), 'and it is kept');
  G('SC.i = ' + row('motion')); g.optionsInput({ type: 'key', key: 'right' }); assert.strictEqual(G('PREF.motion'), 'full'); g.optionsInput({ type: 'key', key: 'right' }); assert.strictEqual(G('PREF.motion'), 'reduced'); assert.strictEqual(G('REDUCED'), true, 'Reduced motion applies at once'); g.optionsInput({ type: 'key', key: 'right' }); assert.strictEqual(G('PREF.motion'), 'auto');
  G("SC.i = optionRows().findIndex(r => r.id === 'erase')"); g.optionsInput({ type: 'key', key: 'ok' }); assert(G('SC.data.confirm'), 'erasing asks first'); g.optionsInput({ type: 'key', key: 'back' }); assert(store.get('pk_save'), 'KEEP keeps the journey');
  g.optionsInput({ type: 'key', key: 'ok' }); g.optionsInput({ type: 'key', key: 'right' }); g.optionsInput({ type: 'key', key: 'ok' }); assert(!store.get('pk_save'), 'ERASE removes the journey'); assert.strictEqual(G('SC.name'), 'title');
  g.openOptions(); g.optionsInput({ type: 'key', key: 'back' }); assert.strictEqual(G('SC.name'), 'title');
  // the language: the first row switches it at once, keeps it, and the title follows (from English, whatever the run's language)
  G("setLang('en')"); g.openOptions(); G('SC.i = ' + row('lang')); g.optionsInput({ type: 'key', key: 'right' }); assert.strictEqual(G('LANG'), 'es'); assert.strictEqual(store.get('pk_lang'), 'es', 'the language is kept');
  assert.strictEqual(G("optionRows().find(r => r.id === 'lang').value"), 'Español'); assert.strictEqual(G("TR('NEW GAME')"), 'NUEVA PARTIDA'); assert.strictEqual(G('CHAPTERS[1].title'), 'Bosque Verde', 'the fronts are renamed');
  assert.strictEqual(G("mvName('Flamethrower')"), 'Lanzallamas'); assert.strictEqual(G("TR('{0} targets', 3)"), '3 objetivos'); assert.strictEqual(G("TR('ON|power')"), 'ACTIVO'); assert.strictEqual(G("TRX('Charmander Lv12')"), 'Charmander Nv12', 'levels read Nv');
  g.optionsInput({ type: 'key', key: 'right' }); assert.strictEqual(G('LANG'), 'en'); assert.strictEqual(G('CHAPTERS[1].title'), 'Viridian Forest', 'English comes back whole'); assert.strictEqual(G("TR('ON|power')"), 'ON');
  G('setLang(' + JSON.stringify(process.env.PK_LANG === 'es' ? 'es' : 'en') + ')');
});
test('the opening: PRESS START, then night, the commanders face off and the logo lands; skippable, it ends on the title with the logo in place', T => {
  const { g, G, store } = T;
  for (const [w, h] of [[640, 360], [195, 422], [422, 195]]) {
    G(`VIEW.w = ${w}; VIEW.h = ${h}; CLOCK.frame = 1`); store.delete('pk_intro'); assert.strictEqual(g.introWanted(), true, 'a first visit gets the opening');
    g.goScene('splash'); g.splashDraw(); G('SC.t = .5'); g.splashInput({ type: 'key', key: 'ok' }); assert.strictEqual(G('SC.name'), 'intro', 'PRESS START opens the opening'); assert.strictEqual(store.get('pk_intro'), '1', 'and it will not play by itself again');
    // the held moments (the caption typed out, the commanders facing off, the logo in place) fit the screen
    const T0 = G('INTRO_T'); for (const at of [1.0, T0.credit + 3.0, T0.night + 1.5, T0.vs + 2.55]) { const boxes = textHook(T); G('SC.t = ' + at); g.introDraw(); for (const b of boxes()) assert(b.x >= -1 && b.x + b.w <= w + 1 && b.y >= -1 && b.y <= h, w + 'x' + h + ' at ' + at + 's: opening text inside the view: ' + JSON.stringify(b)); }
    G('SC.t = 0'); let n = 0; while (G('SC.name') === 'intro' && n++ < 800) { G('SC.t += 1 / 60'); g.titleUpdate(1 / 60); g.introDraw(); }
    assert.strictEqual(G('SC.name'), 'title', w + 'x' + h + ': the opening ends on the title'); assert.strictEqual(G('SC.titleFx.logoSettled'), true, 'with the logo already in place');
    g.startIntro(); G('SC.t = .2'); g.introInput({ type: 'key', key: 'ok' }); assert.strictEqual(G('SC.name'), 'intro', 'not skipped in its first moment'); G('SC.t = 1'); g.introInput({ type: 'key', key: 'ok' }); assert.strictEqual(G('SC.name'), 'title', 'any key skips it');
  }
  assert.strictEqual(g.introWanted(), false, 'seen once: later visits open on the title');
  g.openOptions(); assert(G("optionRows().some(r => r.id === 'opening')"), 'OPTIONS can play it again');
});
function run() {
  let failed = 0;
  for (const t of tests) {
    try { t.fn(loadGame()); console.log('  ok   ' + t.name); }
    catch (e) { failed++; console.log('  FAIL ' + t.name + '\n       ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n       ') : e)); }
  }
  console.log(failed ? `${failed} of ${tests.length} tests failed` : `${tests.length} tests passed`);
  if (process.env.PK_LANG === 'es') { const all = new Map(); for (const get of MISSES) for (const [k, n] of get()) all.set(k, (all.get(k) || 0) + n); const rows = [...all].sort((a, b) => b[1] - a[1]).map(([k, n]) => n + '\t' + JSON.stringify(k)); fs.writeFileSync(path.join(ROOT, 'tools', 'i18n-misses.txt'), rows.join('\n') + '\n'); console.log(rows.length + ' untranslated strings → tools/i18n-misses.txt'); }
  process.exit(failed ? 1 : 0);
}
if (require.main === module) run(); else module.exports = { loadGame, arena, place }; // reusable headless harness
