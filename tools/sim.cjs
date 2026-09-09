#!/usr/bin/env node
// Headless balance simulation: node tools/sim.cjs [seeds=1,2,3,4,5] [chapters=1-8] [root=..]
// Loads the game like model-tests.cjs, launches each chapter the way the ?ch= deep link does (loaner party at
// the chapter level, cautious AI playing the player side) and runs simBattle. Prints one line per chapter:
// result letter, turn, player and enemy survivors per seed, and the win count. Model only: no browser.
'use strict';
const path = require('path');
const { loadGame } = require(path.join(__dirname, 'model-tests.cjs'));
const seeds = (process.argv[2] || '1,2,3,4,5').split(',').map(Number);
const chapters = (process.argv[3] || '1-8').split('-').map(Number); const c0 = chapters[0], c1 = chapters[1] || chapters[0];
const turns = parseInt(process.env.SIM_TURNS || "30"); const cautious = process.env.SIM_CAUTIOUS !== "0";
function launch(T, idx, seed) {
  const { g, C } = T; const ch = C.CHAPTERS[idx]; const L = ch.level;
  const party = [g.partyUnit(4, L), g.partyUnit(7, L), g.partyUnit(1, L), g.partyUnit(25, L), g.partyUnit(133, L - 1), g.partyUnit(66, L - 1), g.partyUnit(74, L - 1), g.partyUnit(16, L - 2)];
  const deployed = party.slice(0, ch.slots).map((p, i) => Object.assign({}, p, { pid: i }));
  g.startBattle(ch.map, deployed, { pokeball: 3, greatball: 2, potion: 2, superpotion: 1, fullheal: 1, candy: 1 }, { chapter: idx, seed, defer: true });
  T.G('B.units.forEach(u => { u.provoked = u.provoked || false; })');
}
let wins = 0, total = 0; const out = [];
for (let idx = c0 - 1; idx <= c1 - 1; idx++) {
  const res = []; let skills = 0, darts = 0;
  for (const seed of seeds) {
    const T = loadGame(); launch(T, idx, seed); const r = T.g.simBattle(turns, cautious); const log = T.B().simLog;
    skills += log.filter(l => / (Brace|Root|Mend)→/.test(l)).length; darts += log.filter(l => / darts$/.test(l)).length;
    res.push((r.result || '-')[0] + r.turn + ' p' + r.p + 'e' + r.e); total++; if (r.result === 'win') wins++;
  }
  out.push('ch' + (idx + 1) + ': ' + res.join('  ') + '   skills=' + skills + ' darts=' + darts);
}
console.log(out.join('\n')); console.log('wins ' + wins + '/' + total);
