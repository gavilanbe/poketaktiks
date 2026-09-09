// ============================================================================
// data.js — types, moves, items, terrain, unit factory, dex processing.
// ============================================================================
'use strict';
const TYPES = ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
const TYPE_COL = { Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Electric: '#f8d030', Grass: '#78c850', Ice: '#98d8d8', Fighting: '#c03028', Poison: '#a040a0', Ground: '#e0c068', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820', Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848', Steel: '#b8b8d0', Fairy: '#ee99ac' };
// Attack type → {defending type: multiplier}. Missing = 1.
const CHART = {
  Normal: { Rock: .5, Ghost: 0, Steel: .5 },
  Fire: { Fire: .5, Water: .5, Grass: 2, Ice: 2, Bug: 2, Rock: .5, Dragon: .5, Steel: 2 },
  Water: { Fire: 2, Water: .5, Grass: .5, Ground: 2, Rock: 2, Dragon: .5 },
  Electric: { Water: 2, Electric: .5, Grass: .5, Ground: 0, Flying: 2, Dragon: .5 },
  Grass: { Fire: .5, Water: 2, Grass: .5, Poison: .5, Ground: 2, Flying: .5, Bug: .5, Rock: 2, Dragon: .5, Steel: .5 },
  Ice: { Fire: .5, Water: .5, Grass: 2, Ice: .5, Ground: 2, Flying: 2, Dragon: 2, Steel: .5 },
  Fighting: { Normal: 2, Ice: 2, Poison: .5, Flying: .5, Psychic: .5, Bug: .5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: .5 },
  Poison: { Grass: 2, Poison: .5, Ground: .5, Rock: .5, Ghost: .5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: .5, Poison: 2, Flying: 0, Bug: .5, Rock: 2, Steel: 2 },
  Flying: { Electric: .5, Grass: 2, Fighting: 2, Bug: 2, Rock: .5, Steel: .5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: .5, Dark: 0, Steel: .5 },
  Bug: { Fire: .5, Grass: 2, Fighting: .5, Poison: .5, Flying: .5, Psychic: 2, Ghost: .5, Dark: 2, Steel: .5, Fairy: .5 },
  Rock: { Fire: 2, Ice: 2, Fighting: .5, Ground: .5, Flying: 2, Bug: 2, Steel: .5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: .5 },
  Dragon: { Dragon: 2, Steel: .5, Fairy: 0 },
  Dark: { Fighting: .5, Psychic: 2, Ghost: 2, Dark: .5, Fairy: .5 },
  Steel: { Fire: .5, Water: .5, Electric: .5, Ice: 2, Rock: 2, Steel: .5, Fairy: 2 },
  Fairy: { Fire: .5, Fighting: 2, Poison: .5, Dragon: 2, Dark: 2, Steel: .5 },
};
// Raw Pokémon multiplier, then softened for tactics pacing: 4→2.25, 2→1.5, .5→.67, .25→.5, 0→0.
function effRaw(atkType, defTypes) { let m = 1; for (const t of defTypes) { const v = CHART[atkType] && CHART[atkType][t]; if (v != null) m *= v; } return m; }
function effMult(atkType, defTypes) { const m = effRaw(atkType, defTypes); return m === 0 ? 0 : m >= 4 ? 2.25 : m >= 2 ? 1.5 : m <= .25 ? .5 : m <= .5 ? .67 : 1; }
function effLabel(m) { return m === 0 ? 'NO EFFECT' : m >= 2 ? 'SUPER!!' : m > 1 ? 'SUPER' : m < .6 ? 'BARELY' : m < 1 ? 'WEAK' : ''; }

// ---------------------------------------------------------------- moves
// kind P (uses ATK/DEF) or S (uses SPA/SPD). rng [min,max]. eff: status/heal/crit/recoil/drain. lvl: unlock level.
const MOVE_LIST = [
  ['Tackle', 'Normal', 40, 'P', [1, 1], 100, null, 1], ['Scratch', 'Normal', 40, 'P', [1, 1], 100, null, 1],
  ['Body Slam', 'Normal', 85, 'P', [1, 1], 100, { status: 'par', chance: 30 }, 20], ['Hyper Beam', 'Normal', 150, 'S', [2, 2], 90, { recharge: 1 }, 40],
  ['Ember', 'Fire', 40, 'S', [1, 2], 100, { status: 'brn', chance: 10 }, 1], ['Flamethrower', 'Fire', 90, 'S', [1, 2], 100, { status: 'brn', chance: 10 }, 24], ['Fire Blast', 'Fire', 110, 'S', [2, 2], 85, { status: 'brn', chance: 30 }, 40],
  ['Water Gun', 'Water', 40, 'S', [1, 2], 100, null, 1], ['Bubble Beam', 'Water', 65, 'S', [1, 2], 100, null, 15], ['Surf', 'Water', 90, 'S', [1, 2], 100, null, 30], ['Hydro Pump', 'Water', 110, 'S', [2, 2], 80, null, 42],
  ['Vine Whip', 'Grass', 45, 'P', [1, 2], 100, null, 1], ['Razor Leaf', 'Grass', 55, 'P', [1, 2], 95, { crit: 3 }, 12], ['Giga Drain', 'Grass', 75, 'S', [1, 2], 100, { drain: .5 }, 26], ['Solar Beam', 'Grass', 120, 'S', [2, 2], 100, null, 38],
  ['Thunder Shock', 'Electric', 40, 'S', [1, 2], 100, { status: 'par', chance: 10 }, 1], ['Thunderbolt', 'Electric', 90, 'S', [1, 2], 100, { status: 'par', chance: 10 }, 26], ['Thunder', 'Electric', 110, 'S', [2, 3], 70, { status: 'par', chance: 30 }, 40],
  ['Ice Shard', 'Ice', 40, 'P', [1, 1], 100, null, 1], ['Ice Beam', 'Ice', 90, 'S', [1, 2], 100, { status: 'frz', chance: 10 }, 28], ['Blizzard', 'Ice', 110, 'S', [2, 2], 70, { status: 'frz', chance: 10 }, 42],
  ['Karate Chop', 'Fighting', 50, 'P', [1, 1], 100, { crit: 3 }, 1], ['Brick Break', 'Fighting', 75, 'P', [1, 1], 100, null, 18], ['Cross Chop', 'Fighting', 100, 'P', [1, 1], 80, { crit: 3 }, 36],
  ['Poison Sting', 'Poison', 35, 'P', [1, 1], 100, { status: 'psn', chance: 30 }, 1], ['Sludge', 'Poison', 65, 'S', [1, 2], 100, { status: 'psn', chance: 30 }, 20], ['Sludge Bomb', 'Poison', 90, 'S', [1, 2], 100, { status: 'psn', chance: 30 }, 34],
  ['Mud-Slap', 'Ground', 40, 'S', [1, 1], 100, null, 1], ['Dig', 'Ground', 80, 'P', [1, 1], 100, null, 22], ['Earthquake', 'Ground', 100, 'P', [1, 1], 100, null, 38],
  ['Gust', 'Flying', 40, 'S', [1, 2], 100, null, 1], ['Wing Attack', 'Flying', 60, 'P', [1, 1], 100, null, 14], ['Drill Peck', 'Flying', 80, 'P', [1, 1], 100, null, 30],
  ['Confusion', 'Psychic', 50, 'S', [1, 2], 100, null, 1], ['Psybeam', 'Psychic', 65, 'S', [1, 2], 100, null, 16], ['Psychic', 'Psychic', 90, 'S', [1, 2], 100, null, 32],
  ['Bug Bite', 'Bug', 60, 'P', [1, 1], 100, null, 1], ['X-Scissor', 'Bug', 80, 'P', [1, 1], 100, null, 30], ['Megahorn', 'Bug', 120, 'P', [1, 1], 85, null, 45],
  ['Rock Throw', 'Rock', 50, 'P', [1, 2], 90, null, 1], ['Rock Slide', 'Rock', 75, 'P', [1, 2], 90, null, 28], ['Stone Edge', 'Rock', 100, 'P', [1, 2], 80, { crit: 3 }, 40],
  ['Lick', 'Ghost', 30, 'P', [1, 1], 100, { status: 'par', chance: 30 }, 1], ['Hex', 'Ghost', 65, 'S', [1, 2], 100, null, 18], ['Shadow Ball', 'Ghost', 80, 'S', [1, 2], 100, null, 30],
  ['Twister', 'Dragon', 40, 'S', [1, 2], 100, null, 1], ['Dragon Claw', 'Dragon', 80, 'P', [1, 1], 100, null, 25], ['Outrage', 'Dragon', 120, 'P', [1, 1], 100, null, 45],
  ['Bite', 'Dark', 60, 'P', [1, 1], 100, null, 1], ['Crunch', 'Dark', 80, 'P', [1, 1], 100, null, 30],
  ['Metal Claw', 'Steel', 50, 'P', [1, 1], 95, null, 1], ['Iron Head', 'Steel', 80, 'P', [1, 1], 100, null, 30], ['Flash Cannon', 'Steel', 80, 'S', [1, 2], 100, null, 30],
  ['Fairy Wind', 'Fairy', 40, 'S', [1, 2], 100, null, 1], ['Draining Kiss', 'Fairy', 50, 'S', [1, 1], 100, { drain: .75 }, 18], ['Moonblast', 'Fairy', 95, 'S', [1, 2], 100, null, 35],
];
const MOVES = {}; for (const m of MOVE_LIST) MOVES[m[0]] = { name: m[0], type: m[1], pow: m[2], kind: m[3], rng: m[4], acc: m[5], eff: m[6], lvl: m[7] };
// Move flavour texts (what pops up over the target)
const MOVE_POP = { Normal: 'BONK!', Fire: 'FWOOSH!', Water: 'SPLASH!', Electric: 'BZZT!', Grass: 'SWISH!', Ice: 'CRACK!', Fighting: 'POW!', Poison: 'BLORP!', Ground: 'THUD!', Flying: 'WHOOSH!', Psychic: 'WOOOM!', Bug: 'CHOMP!', Rock: 'CRUNCH!', Ghost: 'BOO!', Dragon: 'ROAR!', Dark: 'GRR!', Steel: 'CLANG!', Fairy: 'TWINKLE!' };
// A small loadout for this level: per own type the strongest unlocked move, plus the strongest
// unlocked move of that type that can hit an adjacent foe when the strongest one cannot (Fire Blast
// keeps Flamethrower). Non-Normal types get a melee Normal fallback (never Hyper Beam). The species
// signature move leads the list once its own unlock level is reached.
function movesFor(types, level, signature) {
  const out = []; const add = m => { if (m && !out.includes(m)) out.push(m); };
  const best = (t, melee) => { let b = null; for (const m of MOVE_LIST) if (m[1] === t && m[7] <= level && (!melee || m[4][0] === 1) && (!b || m[2] > b.pow)) b = MOVES[m[0]]; return b; };
  for (const t of types) { const m = best(t, false); add(m); if (m && m.rng[0] > 1) add(best(t, true)); }
  if (!types.includes('Normal')) add(best('Normal', true));
  const sig = signature && MOVES[signature]; if (sig && sig.lvl <= level && !out.includes(sig)) out.unshift(sig);
  return out;
}
const STATUS = { psn: { name: 'PSN', col: '#b050d0', text: 'poisoned' }, brn: { name: 'BRN', col: '#f08030', text: 'burned' }, par: { name: 'PAR', col: '#f8d030', text: 'paralyzed' }, frz: { name: 'FRZ', col: '#98d8f8', text: 'frozen' }, slp: { name: 'SLP', col: '#a0a0c0', text: 'asleep' } };

// ---------------------------------------------------------------- items
const ITEMS = {
  pokeball: { name: 'Poké Ball', desc: 'Catch a weakened wild Pokémon.', rate: 1, kind: 'ball', col: '#f04848' },
  greatball: { name: 'Great Ball', desc: 'A better ball. ×1.5 catch rate.', rate: 1.5, kind: 'ball', col: '#4888f0' },
  ultraball: { name: 'Ultra Ball', desc: 'The best ball. ×2 catch rate.', rate: 2, kind: 'ball', col: '#f8d030' },
  potion: { name: 'Potion', desc: 'Restores 50% HP.', heal: .5, kind: 'heal', col: '#c060e0' },
  superpotion: { name: 'Super Potion', desc: 'Restores all HP.', heal: 1, kind: 'heal', col: '#f08030' },
  fullheal: { name: 'Full Heal', desc: 'Cures any status, frees a rooted unit.', cure: true, kind: 'heal', col: '#48d0a0' },
  candy: { name: 'Rare Candy', desc: 'Raises a Pokémon one level.', kind: 'candy', col: '#f8a0d0' },
};

// ---------------------------------------------------------------- terrain
// Map characters → terrain. cost: {walk, fly, swim, climb, forester, desert}; def: % damage reduction; eva: evasion bonus.
const TERRAIN = {
  '.': { id: 'plain', name: 'Plains', cost: { walk: 1 }, def: 0, eva: 0 },
  ',': { id: 'flower', name: 'Meadow', cost: { walk: 1 }, def: 0, eva: 0 },
  't': { id: 'tall', name: 'Tall Grass', cost: { walk: 1 }, def: 10, eva: 20 },
  'T': { id: 'forest', name: 'Forest', cost: { walk: 2, fly: 1, forester: 1 }, def: 20, eva: 10 },
  'M': { id: 'mountain', name: 'Mountain', cost: { walk: 3, fly: 1, climb: 2 }, def: 30, eva: 15 },
  '^': { id: 'rock', name: 'Cliff', cost: { walk: 99, fly: 1 }, def: 0, eva: 0 },
  '~': { id: 'water', name: 'Water', cost: { walk: 99, fly: 1, swim: 1 }, def: 0, eva: 0, swimDef: 5 },
  'w': { id: 'water', name: 'Cave Pool', cost: { walk: 99, fly: 1, swim: 1 }, def: 0, eva: 0, swimDef: 5 },
  '=': { id: 'bridge', name: 'Bridge', cost: { walk: 1 }, def: 0, eva: 0 },
  '#': { id: 'road', name: 'Road', cost: { walk: 1 }, def: 0, eva: 0 },
  's': { id: 'sand', name: 'Sand', cost: { walk: 2, fly: 1, desert: 1 }, def: 0, eva: 0 },
  'C': { id: 'center', name: 'Poké Center', cost: { walk: 1 }, def: 10, eva: 0, heal: .3 },
  'G': { id: 'gym', name: 'Gym', cost: { walk: 1 }, def: 20, eva: 0 },
  'H': { id: 'house', name: 'House', cost: { walk: 99, fly: 99 }, def: 0, eva: 0 },
  'c': { id: 'cave', name: 'Cave Floor', cost: { walk: 1 }, def: 0, eva: 0 },
  'r': { id: 'rubble', name: 'Rubble', cost: { walk: 2, fly: 1, climb: 1 }, def: 15, eva: 5 },
  'W': { id: 'wall', name: 'Cave Wall', cost: { walk: 99, fly: 99 }, def: 0, eva: 0 },
  'f': { id: 'floor', name: 'Floor', cost: { walk: 1 }, def: 0, eva: 0 },
  'b': { id: 'bwall', name: 'Wall', cost: { walk: 99, fly: 99 }, def: 0, eva: 0 },
  'L': { id: 'lava', name: 'Lava', cost: { walk: 99, fly: 1 }, def: 0, eva: 0, burn: true },
  'p': { id: 'pillar', name: 'Pillar', cost: { walk: 99, fly: 1 }, def: 0, eva: 0 },
  'x': { id: 'crate', name: 'Crates', cost: { walk: 2, fly: 1 }, def: 15, eva: 10 },
  'i': { id: 'ice', name: 'Ice', cost: { walk: 1 }, def: 0, eva: -10 },
  'S': { id: 'snow', name: 'Snow', cost: { walk: 2, fly: 1 }, def: 5, eva: 5 },
};
for (const k in TERRAIN) TERRAIN[k].ch = k;
function moveCost(terr, unit) {
  const c = terr.cost; let best = c.walk;
  if (unit.fly && c.fly != null) best = Math.min(best, c.fly); else if (unit.fly && c.walk < 99) best = Math.min(best, 1);
  if (unit.swim && c.swim != null) best = Math.min(best, c.swim);
  if (unit.climb && c.climb != null) best = Math.min(best, c.climb);
  if (unit.forester && c.forester != null) best = Math.min(best, c.forester);
  if (unit.desert && c.desert != null) best = Math.min(best, c.desert);
  return best;
}
// Water: an amphibious unit is at home there (Tide: DEF 20 / AVO 20); other swimmers get the small swimDef.
function terrainDef(terr, unit) { if (terr.id === 'water' && unit.swim) return unit.role === 'amphibious' ? TIDE.def : terr.swimDef; if (unit.fly && (terr.id === 'forest' || terr.id === 'mountain' || terr.id === 'tall' || terr.id === 'rubble' || terr.id === 'crate')) return 0; return terr.def; }
function terrainEva(terr, unit) { if (terr.id === 'water' && unit.swim && unit.role === 'amphibious') return TIDE.eva; if (unit.fly && terr.id !== 'gym' && terr.id !== 'center') return 0; return terr.eva; }

// ---------------------------------------------------------------- dex
const DEX = {}; const DEX_LIST = [];
for (const r of DEX_RAW) { const d = { num: r[0], name: r[1], types: r[2], base: { hp: r[3][0], atk: r[3][1], def: r[3][2], spa: r[3][3], spd: r[3][4], spe: r[3][5] }, evos: r[4] }; DEX[d.num] = d; DEX_LIST.push(d); }
const BY_NAME = {}; for (const d of DEX_LIST) BY_NAME[d.name.toLowerCase()] = d;
function dexOf(x) { return typeof x === 'number' ? DEX[x] : BY_NAME[String(x).toLowerCase()]; }

// ---------------------------------------------------------------- roles & skills
// Type says whom a Pokémon beats; role says how it is used on the board. One role per evolution line,
// keyed by the line's first form, so evolving never changes a unit's role. Lines not listed are plain
// strikers. Every role's skill is shared by the whole role: there are six skills, not 151.
const ROLE_LINES = {
  scout: [16, 21, 41, 19, 52, 84, 50, 123, 142, 77],           // Pidgey, Spearow, Zubat, Rattata, Meowth, Doduo, Diglett, Scyther, Aerodactyl, Ponyta
  defender: [74, 95, 27, 90, 111, 104, 109, 143, 108, 88, 138, 140], // Geodude, Onix, Sandshrew, Shellder, Rhyhorn, Cubone, Koffing, Snorlax, Lickitung, Grimer, Omanyte, Kabuto
  amphibious: [7, 54, 60, 86, 98, 118, 116, 120, 72, 79, 129, 131], // Squirtle, Psyduck, Poliwag, Seel, Krabby, Goldeen, Horsea, Staryu, Tentacool, Slowpoke, Magikarp, Lapras
  controller: [1, 43, 69, 46, 114, 102, 48, 23, 96, 124],      // Bulbasaur, Oddish, Bellsprout, Paras, Tangela, Exeggcute, Venonat, Ekans, Drowzee, Jynx
  ranged: [63, 92, 100, 81, 137, 122],                          // Abra, Gastly, Voltorb, Magnemite, Porygon, Mr. Mime
  support: [35, 39, 113],                                       // Clefairy, Jigglypuff, Chansey
};
// followUp: the role that turns a 10+ SPE lead into a second strike. Everyone else strikes once, whatever their speed.
const ROLES = {
  scout: { name: 'Scout', abbr: 'SCT', col: '#f0a040', skill: 'dart', followUp: true, desc: 'Flanker. After attacking it darts up to 2 tiles. Strikes twice when 10+ SPE faster.' },
  defender: { name: 'Defender', abbr: 'DEF', col: '#a0a0b0', skill: 'brace', followUp: false, desc: 'Wall. Brace instead of attacking to take 40% less damage until its next turn.' },
  amphibious: { name: 'Amphibious', abbr: 'AMP', col: '#5090f0', skill: 'tide', followUp: false, desc: 'Swims. On water it is at home: DEF 20% and AVO 20.' },
  controller: { name: 'Controller', abbr: 'CTL', col: '#70c060', skill: 'root', followUp: false, desc: 'Root a foe within 2 tiles: it cannot move on its next turn. Every other turn; fliers are immune.' },
  ranged: { name: 'Ranged', abbr: 'RNG', col: '#e070c0', skill: 'reach', followUp: false, desc: 'Reach: its ranged moves hit one tile further, out of most counters.' },
  support: { name: 'Support', abbr: 'SUP', col: '#60d0a0', skill: 'mend', followUp: false, desc: 'Mend an adjacent ally: 30% HP and cures status and root. Every other turn.' },
  striker: { name: 'Striker', abbr: 'STK', col: '#e05050', skill: null, followUp: true, desc: 'Plain attacker. Strikes twice when 10+ SPE faster.' },
};
// Active skills take the unit's action (like Attack) and go on cooldown for `cd` of the unit's own upkeeps:
// cd 2 means use on turn N, unavailable on N+1, ready again on N+2 (every other turn).
// Passive ones are always on. Nothing here rolls dice.
const SKILLS = {
  dart: { id: 'dart', name: 'Dart', passive: true, blurb: 'Dart: moves up to 2 tiles after attacking' },
  brace: { id: 'brace', name: 'Brace', target: 'self', rng: [0, 0], cd: 0, xp: 0, blurb: 'Brace: 40% less damage until its next turn', menu: 'Take 40% less damage until your next turn' },
  root: { id: 'root', name: 'Root', target: 'foe', rng: [1, 2], cd: 2, xp: 12, blurb: 'Root: a foe within 2 cannot move next turn', menu: 'A foe within 2 tiles cannot move on its next turn' },
  mend: { id: 'mend', name: 'Mend', target: 'ally', rng: [1, 1], cd: 2, xp: 12, blurb: 'Mend: adjacent ally +30% HP, cures status', menu: 'Heal an adjacent ally 30% and cure it' },
  reach: { id: 'reach', name: 'Reach', passive: true, blurb: 'Reach: ranged moves hit one tile further' },
  tide: { id: 'tide', name: 'Tide', passive: true, blurb: 'Tide: DEF 20% and AVO 20 on water' },
};
const TIDE = { def: 20, eva: 20 };
const BRACE_MULT = .6;   // damage taken while braced
const MEND_RATIO = .3;   // share of max HP Mend restores
const DART_MOV = 2;      // tiles a scout may move after attacking
// Skill XP (human teams): Root and Mend carry `xp` because they need a real target; Brace has none, so a
// unit cannot level up by bracing in safety turn after turn.
// First form of every evolution line, then role by line.
const LINE_ROOT = {}; for (const d of DEX_LIST) if (!LINE_ROOT[d.num]) LINE_ROOT[d.num] = d.num; for (const d of DEX_LIST) for (const e of d.evos) LINE_ROOT[e[0]] = LINE_ROOT[d.num];
const ROLE_OF = {}; for (const r in ROLE_LINES) for (const n of ROLE_LINES[r]) ROLE_OF[n] = r;
function roleFor(dex) { return ROLE_OF[LINE_ROOT[dex.num]] || 'striker'; }
function skillOf(role) { const s = ROLES[role] && ROLES[role].skill; return s ? SKILLS[s] : null; }

// Some evolutions in Showdown are stones/trades: dex.py assigns levels. Legendaries and one-offs never evolve.
const SIGNATURE = { 25: 'Thunderbolt', 6: 'Flamethrower', 9: 'Surf', 3: 'Razor Leaf', 150: 'Psychic', 151: 'Psychic', 130: 'Bite', 143: 'Body Slam', 144: 'Ice Beam', 145: 'Thunderbolt', 146: 'Flamethrower', 149: 'Dragon Claw', 65: 'Psychic', 94: 'Shadow Ball', 59: 'Flamethrower', 26: 'Thunderbolt', 131: 'Ice Beam', 134: 'Surf', 135: 'Thunderbolt', 136: 'Flamethrower', 68: 'Cross Chop', 112: 'Earthquake', 142: 'Wing Attack', 121: 'Psychic', 34: 'Earthquake', 31: 'Earthquake' };
// Fun one-liners when a unit is selected.
const QUIPS = { 25: ['Pika pika!', 'Pikaaa!', 'Chu!'], 4: ['Char!', 'Charmander!'], 1: ['Bulba!', 'Saur saur!'], 7: ['Squirtle squirt!', 'Turtle time.'], 129: ['Splash.', '...splash.', 'Karp.'], 143: ['Zzz...', '*yawns*', 'Snack time?'], 54: ['Psy...', 'My head...'], 52: ['Meowth, that\'s right!', 'Nyaa!'], 132: ['Ditto.', 'Ditto ditto.'], 150: ['...', 'Why am I here?'], 94: ['Hehehe!', 'Boo.'], 79: ['...', '... slow.', 'Huh?'], 39: ['La la la~', 'Puff!'], 133: ['Vee!', 'Eevee!'], 35: ['Clefa!', 'Fairy!'], 63: ['*teleports*', 'Zzz.'], 66: ['Hup!', 'Chop chop!'], 16: ['Pidgey!', 'Coo!'], 19: ['Rattata!', 'Nibble!'], 10: ['Chomp.', 'Leaf!'], 41: ['Screee!', 'Skree!'], 74: ['Rock.', 'Geodude!'], 92: ['Gas... tly.', 'Hehe.'], 109: ['*puffs*', 'Koff.'], 88: ['Blorp.', 'Squish.'], 96: ['Sleepy...'], 58: ['Arf!', 'Growl!'], 37: ['Vul!', '*flicks tails*'], 27: ['Sand!', '*curls up*'], 95: ['GRRAAAH!', '*rumbles*'], 100: ['*rolls*', 'Volt!'], 81: ['Beep.', 'Boop.'], 77: ['Neigh!', '*flames*'], 116: ['Blub.', 'Horsea!'], 120: ['*spins*', 'Hyah!'], 60: ['Poli!', '*wiggles*'], 147: ['Dra...', 'Tini!'], 128: ['MOO!', '*stomps*'], 115: ['*protects baby*', 'Kanga!'], 56: ['Raaargh!', '*angry*'], 23: ['Sssss.', 'Hisss!'], 69: ['Bell!', '*sways*'], 72: ['*jellies*', 'Blub.'], 90: ['*clam*', 'Shell!'], 98: ['Cookie cookie!', 'Krab!'], 118: ['Blub.', 'Goldeen!'], 138: ['*ancient noises*'], 140: ['*fossil noises*'] };
function quipFor(num) { const q = QUIPS[num]; return q ? vpick(q) : vpick(['Let\'s go!', 'Ready!', '!', 'Hm?', 'Yeah!', '*nods*', 'Here!', '*bounces*']); }

// ---------------------------------------------------------------- units
function statFor(base, level) { return Math.floor(2 * base * level / 100) + 5; }
function hpFor(base, level) { return Math.floor(2.4 * base * level / 100) + level + 12; }
function movFor(dex) { const s = dex.base.spe; let m = s < 45 ? 3 : s < 80 ? 4 : s < 110 ? 5 : 6; if (dex.types.includes('Flying')) m = Math.max(m, 5); if (dex.num === 129) m = 2; return m; }
let UID = 1;
// Campaign difficulty edge: the trainer's own party (and its catches) carries 20% more HP. It is a
// per-unit multiplier set by the campaign flow, never by team number, so Versus stays symmetric.
const BOND_HP = 1.2;
// extra: x, y, ai, boss, nick, hp, hpBonus (HP multiplier, default 1).
function makeUnit(numOrName, level, team, extra = {}) {
  const dex = dexOf(numOrName); const u = { id: UID++, num: dex.num, team, level, xp: 0, status: null, statusTurns: 0, recharge: 0, acted: false, moved: false, x: extra.x | 0, y: extra.y | 0, ai: extra.ai || 'aggro', boss: !!extra.boss, nick: extra.nick || null, wild: team === 2, hpBonus: extra.hpBonus || 1, cd: 0, brace: 0, root: 0, fx: { dx: 0, dy: 0, sx: 1, sy: 1, alpha: 1, flash: 0 } };
  applyDex(u, dex); u.hp = u.maxHp; if (extra.hp != null) u.hp = extra.hp;
  return u;
}
// Legendaries keep their aura but not their 580-680 base stat totals, or they one-shot everything on the board.
const LEGEND_SCALE = { 144: .7, 145: .7, 146: .7, 150: .6, 151: .75, 149: .9 };
function applyDex(u, dex) {
  u.num = dex.num; u.name = u.nick || dex.name; u.types = dex.types.slice(); u.dex = dex;
  const L = u.level, k = LEGEND_SCALE[dex.num] || 1; const b = k === 1 ? dex.base : { hp: dex.base.hp, atk: Math.round(dex.base.atk * k), def: Math.round(dex.base.def * k), spa: Math.round(dex.base.spa * k), spd: Math.round(dex.base.spd * k), spe: Math.round(dex.base.spe * k) };
  u.maxHp = Math.round(hpFor(b.hp, L) * (u.hpBonus || 1)); u.atk = statFor(b.atk, L); u.def = statFor(b.def, L); u.spa = statFor(b.spa, L); u.spd = statFor(b.spd, L); u.spe = statFor(b.spe, L);
  u.mov = movFor(dex);
  u.fly = dex.types.includes('Flying') || dex.num === 92 || dex.num === 93 || dex.num === 94 || dex.num === 81 || dex.num === 82 || dex.num === 109 || dex.num === 110 || dex.num === 151; // ghosts, magnets, koffing and Mew float
  u.swim = dex.types.includes('Water'); u.climb = dex.types.includes('Rock') || dex.types.includes('Ground') || dex.types.includes('Fighting') || dex.types.includes('Steel');
  u.forester = dex.types.includes('Bug') || dex.types.includes('Grass'); u.desert = dex.types.includes('Ground') || dex.types.includes('Rock');
  u.role = roleFor(dex); u.skill = skillOf(u.role);
  u.moves = movesFor(dex.types, L, SIGNATURE[dex.num]);
  // Reach (ranged role): every move that already fires at range goes one tile further; melee moves stay melee
  if (u.skill && u.skill.id === 'reach') u.moves = u.moves.map(m => m.rng[1] >= 2 ? Object.assign({}, m, { rng: [m.rng[0], m.rng[1] + 1] }) : m);
  u.rngMin = Math.min(...u.moves.map(m => m.rng[0])); u.rngMax = Math.max(...u.moves.map(m => m.rng[1]));
}
function levelUp(u) { const before = { maxHp: u.maxHp, atk: u.atk, def: u.def, spa: u.spa, spd: u.spd, spe: u.spe }; u.level++; const oldMax = u.maxHp; applyDex(u, u.dex); u.hp = Math.min(u.maxHp, u.hp + (u.maxHp - oldMax)); return { maxHp: u.maxHp - before.maxHp, atk: u.atk - before.atk, def: u.def - before.def, spa: u.spa - before.spa, spd: u.spd - before.spd, spe: u.spe - before.spe }; }
function evolutionFor(u) { const evs = u.dex.evos.filter(e => u.level >= e[1] && DEX[e[0]]); if (!evs.length) return null; return DEX[pick(evs)[0]]; }
function evolve(u, dex) { const oldMax = u.maxHp; u.dex = dex; applyDex(u, dex); u.hp = Math.min(u.maxHp, u.hp + (u.maxHp - oldMax)); }
function xpToNext() { return 100; }
function xpGain(att, def, kill) { const diff = clamp(def.level - att.level, -8, 8); let xp = 15 + diff * 2 + (kill ? 35 + diff * 3 : 0); if (def.boss && kill) xp += 40; return Math.max(3, Math.round(xp)); }
function serializeUnit(u) { return { num: u.num, level: u.level, xp: u.xp, hp: u.hp, nick: u.nick, team: u.team, x: u.x, y: u.y, ai: u.ai, boss: u.boss, status: u.status, statusTurns: u.statusTurns, recharge: u.recharge || 0, acted: u.acted, hpBonus: u.hpBonus || 1, id: u.id, cd: u.cd || 0, brace: u.brace || 0, root: u.root || 0 }; }
// Older saves have no hpBonus: callers that know the unit is a campaign party member pass BOND_HP themselves.
// Saves from before the roles stage have no cd/brace/root: they restore as 0 (nothing pending).
function restoreUnit(s) { const u = makeUnit(s.num, s.level, s.team, { x: s.x, y: s.y, ai: s.ai, boss: s.boss, nick: s.nick, hpBonus: s.hpBonus }); u.xp = s.xp || 0; u.hp = s.hp != null ? Math.min(u.maxHp, s.hp) : u.maxHp; u.status = s.status || null; u.statusTurns = s.statusTurns || 0; u.recharge = s.recharge ? 1 : 0; u.acted = !!s.acted; u.cd = s.cd | 0; u.brace = s.brace | 0; u.root = s.root | 0; if (s.id) { u.id = s.id; UID = Math.max(UID, s.id + 1); } return u; }
