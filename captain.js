// Captain identity, shared team powers and the campaign's capture lessons.
// These rules are model-only: forecasts/AI and playback use the same state.
'use strict';
const CAPTAINS = {
  4: { root: 4, style: 'OFFENSE', name: 'Rally', superName: 'Blaze Rush', col: '#ed9059',
    role: 'Break through the enemy line.', normal: 'Each ally: next attack +25% damage.', super: 'Each ally: next attack +50% damage.' },
  7: { root: 7, style: 'PROTECTION', name: 'Shell Guard', superName: 'Tidal Shield', col: '#72bcef',
    role: 'Keep the whole team standing.', normal: 'All allies take 20% less damage.', super: 'All allies take 40% less damage.' },
  1: { root: 1, style: 'RECOVERY', name: 'Life Link', superName: 'Verdant Bloom', col: '#8dcf75',
    role: 'Recover and hold your ground.', normal: 'All allies heal 20% HP and are cured.', super: 'Heal 40%, cure and block new status.' },
};
// Commanders (Frente Kanto): the trainer each side follows. 'you' is the player's own style, set by the starter's family
// (CAPTAINS above); the others bring their Ace (the crowned partner on the map). A passive helps the allies within two
// tiles of the Ace; a Power (50 charge) and a Super Power (100) last until the side's next turn. Effect keys:
//   atk (+ share, atkTypes to limit it), spAtk (special moves), def (− share taken, types to limit), move, crit, eva,
//   heal (share, cures), enemyDmg (share of max HP, never below 1; grounded/onGrass/openGround filters),
//   enemyStatus [status, how many], enemyMove, steal (₽), future (share at the next turn), weather [kind, days],
//   and the passive-only statusBonus, centerHeal, income, waterMove.
const COS = {
  you: { name: 'You', tr: 'red', col: '#e04848', blurb: 'Your own style: it follows your partner',
    passive: { text: 'Partner bond: allies near your partner deal 10% more, take 10% less', atk: .1, def: .1 } },
  brock: { name: 'Brock', tr: 'brock', col: '#c89858', ace: 95, blurb: 'Rock-solid defence',
    passive: { text: 'Rock and Ground allies take 15% less', def: .15, types: ['Rock', 'Ground'] },
    power: { name: 'Rock Tomb', text: 'Enemies lose 1 move next turn and take 10%', enemyMove: -1, enemyDmg: .1, quake: true },
    super: { name: 'Sandstorm Fort', text: 'Allies take 30% less; 2 days of sandstorm', def: .3, weather: ['sand', 2] } },
  misty: { name: 'Misty', tr: 'misty', col: '#5aa8f0', ace: 121, blurb: 'The tide is hers',
    passive: { text: 'Water moves +10%, +1 move on water', atk: .1, atkTypes: ['Water'], waterMove: 1 },
    power: { name: 'Rain Dance', text: '2 days of rain: Water ×1.5, Fire ×0.5', weather: ['rain', 2] },
    super: { name: 'Hydro Surge', text: '3 days of rain; Water moves +30%; heal 20%', weather: ['rain', 3], atk: .3, atkTypes: ['Water'], heal: .2 } },
  surge: { name: 'Lt. Surge', tr: 'ltsurge', col: '#ffd24a', ace: 26, blurb: 'Lightning strikes first',
    passive: { text: '+10% critical chance', crit: 10 },
    power: { name: 'Thunder Wave', text: 'Paralyse the three strongest enemies', enemyStatus: ['par', 3], bolt: true },
    super: { name: 'Thunderstorm', text: 'Lightning hits every enemy for 20%; crits +30%', enemyDmg: .2, crit: 30, bolt: true } },
  erika: { name: 'Erika', tr: 'erika', col: '#8cd058', ace: 45, blurb: 'Gardens that mend',
    passive: { text: 'Centers heal 10% more', centerHeal: .1 },
    power: { name: 'Aromatherapy', text: 'Heal every ally 20% and cure them', heal: .2 },
    super: { name: 'Petal Blizzard', text: 'Heal every ally 30%; enemies on grass take 15%', heal: .3, enemyDmg: .15, onGrass: true, petals: true } },
  koga: { name: 'Koga', tr: 'koga', col: '#b070d0', ace: 110, blurb: 'Poison and smoke',
    passive: { text: 'Status chances +10%', statusBonus: 10 },
    power: { name: 'Toxic Spikes', text: 'Poison every enemy on open ground', enemyStatus: ['psn', 99], openGround: true },
    super: { name: 'Smokescreen', text: 'Allies +25 evasion; enemies lose 1 move', eva: 25, enemyMove: -1 } },
  sabrina: { name: 'Sabrina', tr: 'sabrina', col: '#ff70b0', ace: 65, blurb: 'She saw it coming',
    passive: { text: 'Psychic moves +10%', atk: .1, atkTypes: ['Psychic'] },
    power: { name: 'Calm Mind', text: 'Special moves +30%', spAtk: .3 },
    super: { name: 'Future Sight', text: 'Every enemy takes 25% at your next turn', future: .25 } },
  blaine: { name: 'Blaine', tr: 'blaine', col: '#ff7040', ace: 59, blurb: 'Hot-headed fire',
    passive: { text: 'Fire moves +10%', atk: .1, atkTypes: ['Fire'] },
    power: { name: 'Sunny Day', text: '2 days of sun: Fire ×1.5, Water ×0.5', weather: ['sun', 2] },
    super: { name: 'Eruption', text: 'Every enemy takes 20% and burns; 2 days of sun', enemyDmg: .2, enemyStatus: ['brn', 99], weather: ['sun', 2], quake: true } },
  blue: { name: 'Blue', tr: 'blue', col: '#5a8af0', ace: 18, blurb: 'Always one step ahead',
    passive: { text: '+10% damage', atk: .1 },
    power: { name: 'Smell Ya Later', text: 'Allies +1 move', move: 1 },
    super: { name: "Champion's Pride", text: 'Allies +40% damage and +1 move', atk: .4, move: 1 } },
  giovanni: { name: 'Giovanni', tr: 'giovanni', col: '#b8a078', ace: 34, blurb: 'Money and might',
    passive: { text: 'Income +10%', income: .1 },
    power: { name: 'Earthquake', text: 'Enemies on the ground take 20%', enemyDmg: .2, grounded: true, quake: true },
    super: { name: 'Rocket Supremacy', text: 'Earthquake; allies +30% damage, take 30% less', enemyDmg: .2, grounded: true, quake: true, atk: .3, def: .3 } },
  rocket: { name: 'Rocket Grunt', tr: 'rocketgrunt', col: '#e05050', ace: 24, blurb: 'Dirty tricks',
    passive: { text: 'Poison moves +10%', atk: .1, atkTypes: ['Poison'] },
    power: { name: 'Pickpocket', text: 'Steal ₽1000 from the enemy', steal: 1000 },
    super: { name: 'Rocket Rush', text: 'Allies +25% damage and +1 move', atk: .25, move: 1 } },
};
const CO_ORDER = ['you', 'brock', 'misty', 'surge', 'erika', 'koga', 'sabrina', 'blaine', 'blue', 'giovanni'];
// Each commander's army: base species (they grow into their evolutions with the level), their Ace not included.
const CO_TEAMS = {
  you: [16, 19, 25, 1, 4, 7, 74, 63], brock: [74, 27, 95, 138, 140, 104, 111, 50], misty: [120, 54, 118, 60, 116, 90, 86, 72],
  surge: [25, 100, 81, 125, 21, 84, 66, 128], erika: [43, 69, 102, 114, 1, 46, 48, 113], koga: [41, 109, 88, 48, 23, 13, 29, 32],
  sabrina: [63, 96, 79, 122, 124, 102, 92, 137], blaine: [37, 58, 77, 4, 126, 109, 74, 133], blue: [16, 63, 58, 102, 111, 129, 7, 133],
  giovanni: [52, 27, 104, 111, 50, 32, 29, 128], rocket: [19, 41, 23, 109, 52, 88, 96, 92],
};
// Trainers freed on the campaign route lead your side in the other modes: each one after clearing that chapter (all of
// them once the journey is complete). Without a campaign save: You, Brock and Misty.
const CO_UNLOCK = { brock: 3, misty: 4, erika: 5, surge: 6, koga: 7, blaine: 7, sabrina: 8, blue: 8, giovanni: 8 };
function coUnlocked(save = typeof SAVE !== 'undefined' ? SAVE : null) { if (!save) return ['you', 'brock', 'misty']; return CO_ORDER.filter(c => c === 'you' || save.beaten || (save.chapter || 0) >= CO_UNLOCK[c]); }
// Who can command the other side against you.
const CO_FOES = ['rocket', 'brock', 'misty', 'surge', 'erika', 'koga', 'sabrina', 'blaine', 'blue', 'giovanni'];
// A commander's army as Box entries at a level, each species in the form it has grown into (the first `n`, or `n`
// picked by the seed); `skip` leaves out species already on the map.
function coTeam(co, level, n = 8, seed = 0, skip = []) { const list = (CO_TEAMS[co] || CO_TEAMS.rocket).map(num => formAt(num, level)).filter((num, i, a) => a.indexOf(num) === i && !skip.includes(num)); if (seed) { const r = mulberry32(seed); list.sort(() => r() - .5); } return list.slice(0, n).map(num => ({ num, level })); }
// What a side's command looks like, whichever kind it is: name, portrait, colour, passive and both powers.
function coOf(s) {
  if (!s) return null; const co = COS[s.co];
  if (co && s.co !== 'you') return Object.assign({ id: s.co, style: co.blurb }, co);
  const c = CAPTAINS[s.root] || CAPTAINS[7]; return { id: 'you', name: 'You', tr: 'red', col: c.col, style: c.style, blurb: c.role, passive: COS.you.passive, power: { name: c.name, text: c.normal }, super: { name: c.superName, text: c.super } };
}
function coTrainer(s) { const co = s && COS[s.co]; return co && s.co !== 'you' ? co : null; }
// The effects working for (or against) a unit right now.
function coNear(u) { const ace = powerCaptain(u.team); return !!(ace && dist(ace, u) <= 2); }
function coPassive(u) { const s = powerState(u.team), co = s && COS[s.co]; return co && co.passive && coNear(u) ? co.passive : null; }
function coActive(team) { const s = powerState(team), co = coTrainer(s); return co && s.active ? (s.active === 'super' ? co.super : co.power) : null; }
function coAtkMult(att, move) { let m = 1; for (const f of [coPassive(att), coActive(att.team)]) if (f) { if (f.atk && (!f.atkTypes || f.atkTypes.includes(move.type))) m *= 1 + f.atk; if (f.spAtk && move.kind !== 'P') m *= 1 + f.spAtk; } return m; }
function coDefMult(def) { let m = 1; for (const f of [coPassive(def), coActive(def.team)]) if (f && f.def && (!f.types || def.types.some(t => f.types.includes(t)))) m *= 1 - f.def; return m; }
function coCrit(att) { let c = 0; for (const f of [coPassive(att), coActive(att.team)]) if (f && f.crit) c += f.crit; return c; }
function coEva(def) { const f = coActive(def.team); return f && f.eva || 0; }
function coMove(u) { if (!B || !B.command) return 0; let m = 0; const a = coActive(u.team); if (a && a.move) m += a.move; for (const t of [0, 1]) if (t !== u.team) { const e = coActive(t); if (e && e.enemyMove && B.phase !== t) m += e.enemyMove; } const p = coPassive(u); if (p && p.waterMove && terrAt(u.x, u.y).id === 'water') m += p.waterMove; return m; }
function coStatusBonus(att) { const p = coPassive(att); return p && p.statusBonus || 0; }
function coCenterHeal(u) { const p = coPassive(u); return p && p.centerHeal || 0; }
function coIncome(team) { const co = coTrainer(powerState(team)); return co && co.passive && co.passive.income && powerCaptain(team) ? co.passive.income : 0; }
function captainRoot(num) { return num >= 1 && num <= 3 ? 1 : num >= 4 && num <= 6 ? 4 : num >= 7 && num <= 9 ? 7 : null; }
function migrateCaptain(save) {
  if (!save || !Array.isArray(save.party) || !save.party.length) return save;
  let pid = save.captainPid;
  if (!Number.isInteger(pid) || pid < 0 || pid >= save.party.length) {
    pid = save.party.findIndex(p => captainRoot(p.num)); if (pid < 0) pid = 0;
  }
  save.captainPid = pid;
  if (!save.journey) save.journey = { version: 1, firstCatch: save.chapter > 0 };
  save.starter = captainRoot(save.party[pid].num) || (CAPTAINS[save.starter] ? save.starter : 7);
  return save;
}
// The partner locked into the squad (crowned); none when a Gym Leader leads (P.noCaptain).
function prepCaptain(P) { if (P && P.noCaptain) return null; if (P && P.captain != null) return P.captain; return P && !P.preset && typeof SAVE !== 'undefined' && SAVE && P.party === SAVE.party ? (migrateCaptain(SAVE), SAVE.captainPid) : null; }
function powerState(team) { return B && B.command && B.command.teams[team] || null; }
function powerCaptain(team) { const s = powerState(team); return s && B.units.find(u => u.id === s.captainId && u.team === team && u.hp > 0); }
function addCaptain(team, unit, root, chapter = 8, co = 'you') {
  if (!unit) return; if (typeof trainerImg === 'function') trainerImg(COS[co] && co !== 'you' ? COS[co].tr : 'red'); // the cut-in's portrait, warmed
  if (!B.command) B.command = { version: 1, teams: {} };
  B.command.teams[team] = { co: COS[co] ? co : 'you', root: CAPTAINS[root] ? root : 7, captainId: unit.id, charge: chapter === 1 && team === 0 ? 50 : 0,
    unlocked: chapter >= 1, superUnlocked: chapter >= 3, active: null, spent: false, used: [], uses: 0, future: 0 };
  unit.leader = true;
}
// A trainer commander's Ace joins the side if it is not there: at the side's level, on the first free tile next to its
// first Pokémon (the campaign loans it for the battle).
function coAce(team, co, level) {
  const C = COS[co]; if (!C || !C.ace) return null; let u = alive(team).find(v => v.num === C.ace); if (u) return u;
  const anchor = alive(team)[0]; if (!anchor) return null; const spot = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0]].map(([dx, dy]) => ({ x: anchor.x + dx, y: anchor.y + dy })).find(p => inMap(p.x, p.y) && !unitAt(p.x, p.y));
  if (!spot) return null; u = makeUnit(C.ace, level, team, { x: spot.x, y: spot.y }); u.loaned = true; B.units.push(u); requestBigSprite(u.num);
  // the Ace belongs to its side's Box too: when it faints it recovers and can be deployed again, crown and all
  if (B.war && team <= 1) { const e = warEntry({ num: u.num, level: u.level }); e.state = 'field'; e.unitId = u.id; B.war.box[team].push(e); }
  return u;
}
function initBattleCaptains(opts) {
  B.command = null;
  if (B.territory) {
    for (const team of [0, 1]) { const u = alive(team).find(u => u.reserveSlot === 2); addCaptain(team, u, captainRoot(u && u.num) || 7); }
  } else if (B.versus) {
    const roots = opts.captains || [4, 7], cos = opts.cos || [];
    for (const team of [0, 1]) { const co = cos[team] && COS[cos[team]] ? cos[team] : 'you'; const lvl = alive(team)[0] ? alive(team)[0].level : 20; const u = co !== 'you' ? coAce(team, co, lvl) : alive(team).find(v => v.leader) || alive(team)[0]; for (const a of alive(team)) a.leader = a === u; addCaptain(team, u, roots[team], 8, co); }
  } else if (opts.cos && (opts.cos[0] || opts.cos[1])) { // Skirmish and the Tower name both commanders
    for (const team of [0, 1]) { const co = COS[opts.cos[team]] ? opts.cos[team] : null; if (!co) continue; const lvl = alive(team)[0] ? alive(team)[0].level : 12; const u = co !== 'you' ? coAce(team, co, lvl) : alive(team).find(v => v.leader) || alive(team)[0]; if (u) { for (const a of alive(team)) a.leader = a === u; addCaptain(team, u, co === 'you' ? (opts.captain && opts.captain.root) || captainRoot(u.num) || 7 : 7, 8, co); } }
  } else if (opts.captain) {
    // a Gym Leader freed on the route can lead instead of you: their Ace joins at the front's level
    const pco = opts.co && opts.co !== 'you' && COS[opts.co] && opts.captain.chapter >= 3 ? opts.co : null, lvl = (CHAPTERS[opts.captain.chapter] || {}).level || (alive(0)[0] || {}).level || 10;
    const u = (pco && coAce(0, pco, lvl)) || alive(0).find(u => u.pid === opts.captain.pid) || alive(0)[0];
    for (const a of alive(0)) a.leader = a === u;
    addCaptain(0, u, opts.captain.root, opts.captain.chapter, pco && u && u.num === COS[pco].ace ? pco : 'you');
    // Enemy commanders lead from Mt. Moon (Brock) on; a front without one gives its boss a command from chapter 4.
    if (opts.enemyCo || opts.captain.chapter >= 3) {
      const eco = opts.enemyCo && COS[opts.enemyCo] ? opts.enemyCo : null, foe = eco ? (alive(1).find(v => v.num === COS[eco].ace) || alive(1).find(v => v.boss) || alive(1)[0]) : alive(1).find(v => v.boss) || alive(1)[0];
      if (foe) addCaptain(1, foe, foe.types.includes('Water') ? 7 : foe.types.includes('Grass') ? 1 : 4, 8, eco || 'you');
    }
  }
}
function powerPhaseStart(team, ev = []) {
  const s = powerState(team); if (!s) return;
  s.active = null; s.spent = false; s.used = [];
  if (s.future) { for (const u of B.units) if (u.hp > 1 && hostile(team, u.team) && u.team <= 1) { const d = Math.min(u.hp - 1, Math.max(1, Math.floor(u.maxHp * s.future))); if (d > 0) { u.hp -= d; ev.push({ type: 'powerHit', unit: u, amount: d, kind: 'psy' }); } } s.future = 0; }
}
function powerCharge(team, amount) {
  const s = powerState(team); if (!s || !s.unlocked || s.active || amount <= 0) return;
  s.charge = clamp(s.charge + amount, 0, 100);
}
function powerCombatCharge(events) {
  for (const e of events) if (e.type === 'hit' && e.dmg > 0 && hostile(e.att.team, e.def.team)) {
    // Actual HP removed, never overkill; no charge for heals, ticks or the power itself.
    const loss = e.lost == null ? e.dmg : e.lost;
    powerCharge(e.att.team, Math.min(20, Math.ceil(30 * loss / e.def.maxHp)));
    powerCharge(e.def.team, Math.min(25, Math.ceil(40 * loss / e.def.maxHp)));
  }
}
function powerDamageMultiplier(att, def, move) {
  let mult = move ? coAtkMult(att, move) * coDefMult(def) : 1; const a = powerState(att.team), d = powerState(def.team);
  if (a && !coTrainer(a) && a.root === 4 && a.active && B.phase === att.team && !a.used.includes(att.id)) mult *= a.active === 'super' ? 1.5 : 1.25;
  if (d && !coTrainer(d) && d.root === 7 && d.active) mult *= d.active === 'super' ? .6 : .8;
  return mult;
}
function powerBlocksStatus(unit) { const s = powerState(unit.team); return !!(s && !coTrainer(s) && s.root === 1 && s.active === 'super'); }
function powerAfterCombat(att, events) {
  powerCombatCharge(events);
  const s = powerState(att.team);
  if (s && !coTrainer(s) && s.root === 4 && s.active && B.phase === att.team && !s.used.includes(att.id)) s.used.push(att.id);
}
function powerBlock(team, superPower = false) {
  const s = powerState(team);
  if (!s) return 'No captain';
  if (B.result || B.phase !== team) return 'Wait for your turn';
  if (!s.unlocked) return 'Unlocks in chapter 2';
  if (superPower && !s.superUnlocked) return 'Unlocks in chapter 4';
  if (!powerCaptain(team)) return 'Captain has fainted';
  if (s.spent) return 'Already used this turn';
  if (s.charge < (superPower ? 100 : 50)) return 'Need ' + (superPower ? 100 : 50) + ' charge';
  const co = coTrainer(s), fx = co ? (superPower ? co.super : co.power) : null;
  if (!co && s.root === 4 && !alive(team).some(u => canTakeAction(u))) return 'No attacks left this turn';
  if (!co && s.root === 1 && !superPower && !alive(team).some(u => u.hp < u.maxHp || u.status || u.root)) return 'Team already healthy';
  if (fx && fx.heal && !fx.enemyDmg && !fx.weather && !fx.atk && !alive(team).some(u => u.hp < u.maxHp || u.status || u.root)) return 'Team already healthy';
  return null;
}
function activatePower(team, superPower = false) {
  if (powerBlock(team, superPower)) return null;
  const s = powerState(team), c = coOf(s), events = [];
  s.charge -= superPower ? 100 : 50; s.active = superPower ? 'super' : 'normal'; s.spent = true; s.used = []; s.uses++;
  events.push({ type: 'power', team, root: s.root, co: s.co, superPower, unit: powerCaptain(team), name: (superPower ? c.super : c.power).name });
  if (coTrainer(s)) { coApply(team, superPower ? c.super : c.power, events); return events; }
  if (s.root === 1) for (const u of alive(team)) {
    const amount = Math.min(u.maxHp - u.hp, Math.max(1, Math.floor(u.maxHp * (superPower ? .4 : .2))));
    if (amount > 0) { u.hp += amount; events.push({ type: 'heal', unit: u, amount }); }
    if (u.status || u.root) { u.status = null; u.statusTurns = 0; u.root = 0; events.push({ type: 'cure', unit: u, kind: 'power' }); }
  }
  return events;
}
// What a trainer's power does the moment it is called: heal and cure the side, hurt, paralyse, poison or burn the other
// side, steal money, set the weather, plant a Future Sight. Every step is an event the board plays.
function coApply(team, fx, events) {
  const foes = B.units.filter(u => u.hp > 0 && u.team <= 1 && u.team !== team), grassy = u => ['plain', 'flower', 'tall', 'forest'].includes(terrAt(u.x, u.y).id), open = u => ['plain', 'flower', 'road', 'sand', 'snow', 'ice', 'cave', 'floor'].includes(terrAt(u.x, u.y).id);
  if (fx.heal) for (const u of alive(team)) { const amount = Math.min(u.maxHp - u.hp, Math.max(1, Math.floor(u.maxHp * fx.heal))); if (amount > 0) { u.hp += amount; events.push({ type: 'heal', unit: u, amount }); } if (u.status || u.root) { u.status = null; u.statusTurns = 0; u.root = 0; events.push({ type: 'cure', unit: u, kind: 'power' }); } }
  if (fx.enemyDmg) for (const u of foes) { if (fx.grounded && u.fly) continue; if (fx.onGrass && !grassy(u)) continue; const d = Math.min(u.hp - 1, Math.max(1, Math.floor(u.maxHp * fx.enemyDmg))); if (d > 0) { u.hp -= d; events.push({ type: 'powerHit', unit: u, amount: d, kind: fx.bolt ? 'bolt' : fx.quake ? 'quake' : fx.petals ? 'petals' : 'hit' }); } }
  if (fx.enemyStatus) { const [st, n] = fx.enemyStatus, immune = u => (st === 'brn' && u.types.includes('Fire')) || (st === 'psn' && (u.types.includes('Poison') || u.types.includes('Steel'))) || (st === 'par' && u.types.includes('Electric')) || (st === 'frz' && u.types.includes('Ice'));
    foes.filter(u => u.hp > 0 && !u.status && !immune(u) && !powerBlocksStatus(u) && (!fx.openGround || open(u))).sort((a, b) => b.level - a.level || b.hp - a.hp).slice(0, n).forEach(u => { u.status = st; u.statusTurns = 0; events.push({ type: 'status', unit: u, status: st }); }); }
  if (fx.steal && B.war) { const other = 1 - team, amount = Math.min(fx.steal, B.war.funds[other] || 0); if (amount > 0) { B.war.funds[other] -= amount; B.war.funds[team] += amount; events.push({ type: 'steal', team, amount, unit: powerCaptain(team) }); } }
  if (fx.weather) { setWeather(fx.weather[0], fx.weather[1]); events.push({ type: 'weather', kind: fx.weather[0], days: fx.weather[1] }); }
  if (fx.future) { powerState(team).future = fx.future; events.push({ type: 'future', team, unit: powerCaptain(team) }); }
}
function aiPower(team) {
  const s = powerState(team); if (!s) return null;
  const superPower = s.charge >= 100 && s.superUnlocked;
  if (powerBlock(team, superPower)) return null;
  const units = alive(team), foes = aiTargetsOf({ team }), co = coTrainer(s), fx = co ? (superPower ? co.super : co.power) : null;
  const close = units.some(u => foes.some(v => dist(u, v) <= u.mov + u.rngMax)), hurt = units.some(u => u.hp <= u.maxHp * .65 || u.status || u.root);
  if (fx) { if (fx.heal && !fx.enemyDmg && !fx.atk && !fx.weather) { if (!hurt) return null; } else if (!close && !fx.steal && !fx.future) return null; }
  else if (s.root === 1) { if (!hurt) return null; }
  else if (!close) return null;
  return activatePower(team, superPower);
}

// A scripted unit (a guard, a boss's escort) still takes a property within its reach when that beats its best attack:
// the capture choice the campaign's outposts always had, now over every war property.
function warCaptureChoice(u, combatScore) {
  if (!B.war || u.team > 1 || !B.war.props.some(p => p.owner !== u.team)) return null;
  let best = null, score = Math.max(12, combatScore == null ? 12 : combatScore);
  for (const n of reachable(u).values()) {
    if (!canStand(u, n.x, n.y)) continue; const p = warProperty(n.x, n.y); if (!p || warCaptureBlock(u, p, n)) continue;
    const value = 28 + (p.captor === u.id ? p.progress : 0) + (p.goal ? 12 : 0) + (p.kind === 'hq' ? 20 : 0);
    if (value > score) { score = value; best = { x: n.x, y: n.y, capture: true }; }
  }
  return best;
}

function isPracticeTarget(u) { return !!(u && B && B.lesson && !B.lesson.complete && B.lesson.targetId === u.id); }
function practiceReady(u) { return isPracticeTarget(u) && u.hp <= Math.ceil(u.maxHp / 2); }
function captureChance(target, ball) {
  if (isPracticeTarget(target)) return practiceReady(target) ? 1 : 0;
  let p = .22 + .68 * (1 - target.hp / target.maxHp); p *= ball.rate; if (target.status) p *= 1.3; if (target.boss) p *= .5;
  return clamp(p, .05, .97);
}
function initCampaignLessons(mapDef, opts) {
  B.lesson = null;
  if (opts.lesson) {
    const u = B.units.find(v => v.team === 2 && v.num === 10);
    if (u) { u.ai = 'stay'; B.lesson = { targetId: u.id, complete: false }; }
  }
}
const CHAPTER_LESSONS = [
  ['YOUR FIRST FRONT', 'Your partner wears the crown. Pidgey scouts ahead.', 'Move, attack, then catch Oak\'s Caterpie at half HP: the practice ball is free.', 'Your Poké Center pays ₽1,000 a day. Open the PC there to deploy from your Box.', 'Catches wait in your Box: their first deployment is free.'],
  ['TEAM POWER UNLOCKED', 'Your partner now commands a shared team power.', 'Open POWER or press P. Normal costs 50 charge.', 'Combat, catches and captures refill the bar.', 'Claim the outpost: capture twice at full HP, then heal there.'],
  ['ENEMY COMMANDERS', 'Brock leads the other side: his Ace, Onix, wears the crown.', 'A commander\'s passive helps allies within 2 tiles of the Ace.', 'The Rocket center deploys his army each day. Capture it to stop them.', 'Fainted Pokémon go back to the Box and recover in two days.'],
  ['SUPERPOWER UNLOCKED', 'Spend 50 on a power, or save 100 for its super version.', 'Freed Gym Leaders can command your side: pick one in the briefing.', 'Capture the bridge outpost, then occupy and capture the gym.', 'Capturing uses an action. Leaving resets your progress.'],
];
