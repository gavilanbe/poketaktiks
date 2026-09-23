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
function prepCaptain(P) { return P && !P.preset && typeof SAVE !== 'undefined' && SAVE && P.party === SAVE.party ? (migrateCaptain(SAVE), SAVE.captainPid) : null; }
function powerState(team) { return B && B.command && B.command.teams[team] || null; }
function powerCaptain(team) { const s = powerState(team); return s && B.units.find(u => u.id === s.captainId && u.team === team && u.hp > 0); }
function addCaptain(team, unit, root, chapter = 8) {
  if (!unit) return;
  if (!B.command) B.command = { version: 1, teams: {} };
  B.command.teams[team] = { root: CAPTAINS[root] ? root : 7, captainId: unit.id, charge: chapter === 1 && team === 0 ? 50 : 0,
    unlocked: chapter >= 1, superUnlocked: chapter >= 3, active: null, spent: false, used: [], uses: 0 };
  unit.leader = true;
}
function initBattleCaptains(opts) {
  B.command = null;
  if (B.territory) {
    for (const team of [0, 1]) { const u = alive(team).find(u => u.reserveSlot === 2); addCaptain(team, u, captainRoot(u && u.num) || 7); }
  } else if (opts.captain) {
    const u = alive(0).find(u => u.pid === opts.captain.pid) || alive(0)[0];
    for (const a of alive(0)) a.leader = a === u;
    addCaptain(0, u, opts.captain.root, opts.captain.chapter);
    // Rival/boss commands are introduced alongside the player's superpower.
    if (opts.captain.chapter >= 3) {
      const foe = alive(1).find(v => v.boss) || alive(1)[0];
      if (foe) addCaptain(1, foe, foe.types.includes('Water') ? 7 : foe.types.includes('Grass') ? 1 : 4);
    }
  }
}
function powerPhaseStart(team) {
  const s = powerState(team); if (!s) return;
  s.active = null; s.spent = false; s.used = [];
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
function powerDamageMultiplier(att, def) {
  let mult = 1; const a = powerState(att.team), d = powerState(def.team);
  if (a && a.root === 4 && a.active && B.phase === att.team && !a.used.includes(att.id)) mult *= a.active === 'super' ? 1.5 : 1.25;
  if (d && d.root === 7 && d.active) mult *= d.active === 'super' ? .6 : .8;
  return mult;
}
function powerBlocksStatus(unit) { const s = powerState(unit.team); return !!(s && s.root === 1 && s.active === 'super'); }
function powerAfterCombat(att, events) {
  powerCombatCharge(events);
  const s = powerState(att.team);
  if (s && s.root === 4 && s.active && B.phase === att.team && !s.used.includes(att.id)) s.used.push(att.id);
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
  if (s.root === 4 && !alive(team).some(u => canTakeAction(u))) return 'No attacks left this turn';
  if (s.root === 1 && !superPower && !alive(team).some(u => u.hp < u.maxHp || u.status || u.root)) return 'Team already healthy';
  return null;
}
function activatePower(team, superPower = false) {
  if (powerBlock(team, superPower)) return null;
  const s = powerState(team), c = CAPTAINS[s.root], events = [];
  s.charge -= superPower ? 100 : 50; s.active = superPower ? 'super' : 'normal'; s.spent = true; s.used = []; s.uses++;
  events.push({ type: 'power', team, root: s.root, superPower, unit: powerCaptain(team), name: superPower ? c.superName : c.name });
  if (s.root === 1) for (const u of alive(team)) {
    const amount = Math.min(u.maxHp - u.hp, Math.max(1, Math.floor(u.maxHp * (superPower ? .4 : .2))));
    if (amount > 0) { u.hp += amount; events.push({ type: 'heal', unit: u, amount }); }
    if (u.status || u.root) { u.status = null; u.statusTurns = 0; u.root = 0; events.push({ type: 'cure', unit: u, kind: 'power' }); }
  }
  return events;
}
function aiPower(team) {
  const s = powerState(team); if (!s) return null;
  const superPower = s.charge >= 100 && s.superUnlocked;
  if (powerBlock(team, superPower)) return null;
  const units = alive(team), foes = aiTargetsOf({ team });
  const close = units.some(u => foes.some(v => dist(u, v) <= u.mov + u.rngMax));
  if (s.root === 1) { if (!units.some(u => u.hp <= u.maxHp * .65 || u.status || u.root)) return null; }
  else if (!close) return null;
  return activatePower(team, superPower);
}

// Outposts use the same 20-point, HP-scaled capture as Territory. Campaign
// outposts grant team charge and owned healing; Territory also has an economy.
function campaignProperty(x, y) { return B && B.outposts && B.outposts.find(p => p.x === x && p.y === y) || null; }
function boardProperty(x, y) { return B && B.territory ? territoryProperty(x, y) : campaignProperty(x, y); }
function campaignCaptureBlock(u, from = u) {
  const p = from && campaignProperty(from.x, from.y);
  if (!u || u.hp <= 0 || u.team > 1 || u.acted || u.status === 'frz' || u.recharge) return 'Unit not ready';
  return !p || p.owner === u.team ? 'Stand on another outpost' : null;
}
function settleOutposts() {
  for (const p of B.outposts || []) if (p.captor != null) {
    const u = B.units.find(u => u.id === p.captor && u.hp > 0);
    if (!u || u.x !== p.x || u.y !== p.y || u.team === p.owner) { p.captor = null; p.progress = 0; }
  }
}
function boardCapture(u) {
  if (B.territory) return territoryCapture(u);
  if (campaignCaptureBlock(u)) return null;
  settleOutposts(); const p = campaignProperty(u.x, u.y);
  if (p.captor !== u.id) { p.captor = u.id; p.progress = 0; }
  p.progress = Math.min(20, p.progress + territoryCaptureGain(u));
  const done = p.progress >= 20;
  if (done) { p.owner = u.team; p.captor = null; p.progress = 0; powerCharge(u.team, 20); if (p.goal && u.team === 0) B.seized = true; }
  u.acted = u.moved = true;
  return { type: 'property', unit: u, property: p, done, progress: p.progress };
}
function campaignCaptureChoice(u, combatScore) {
  if (!B.outposts || !B.outposts.length || u.team > 1) return null;
  let best = null, score = Math.max(12, combatScore == null ? 12 : combatScore);
  for (const n of reachable(u).values()) {
    if (!canStand(u, n.x, n.y) || campaignCaptureBlock(u, n)) continue;
    const p = campaignProperty(n.x, n.y); const value = 28 + (p.captor === u.id ? p.progress : 0) + (p.goal ? 12 : 0);
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
  B.outposts = (mapDef.outposts || []).map(p => Object.assign({ owner: -1, captor: null, progress: 0 }, p));
  B.lesson = null;
  if (B.outposts.length) B.map.ownerAt = (x, y) => { const p = campaignProperty(x, y); return p ? p.owner : null; };
  if (opts.lesson) {
    const u = B.units.find(v => v.team === 2 && v.num === 10);
    if (u) { u.ai = 'stay'; B.lesson = { targetId: u.id, complete: false }; }
  }
}
const CHAPTER_LESSONS = [
  ['YOUR FIRST TEAM', 'Your starter is the captain. Pidgey scouts ahead.', 'Move, attack, then catch Oak\'s Caterpie at half HP.', 'The practice ball is free and guaranteed. Caterpie cannot faint.', 'Win to bring your catch to the next mission.'],
  ['TEAM POWER UNLOCKED', 'Your captain now commands a shared team power.', 'Open POWER or press P. Normal costs 50 charge.', 'Combat and completed captures refill the bar.', 'Claim the outpost: capture twice at full HP, then heal there.'],
  ['BUILD A BALANCED TEAM', 'Your captain leads; choose companions for this map.', 'Geodude holds ground. Clefairy heals. Fliers cross rubble.', 'Your collection trains and recovers after each victory.'],
  ['SUPERPOWER UNLOCKED', 'Spend 50 on a power, or save 100 for its super version.', 'The rival has powers too. Watch both charge bars.', 'Capture the bridge outpost, then occupy and capture the gym.', 'Capturing uses an action. Leaving resets your progress.'],
];
