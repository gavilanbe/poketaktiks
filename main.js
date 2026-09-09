// ============================================================================
// main.js — game flow (campaign, skirmish, saves), the main loop and boot.
// ============================================================================
'use strict';
let SAVE = null;   // { chapter, party:[serialized], bag:{}, stars:{}, beaten }
const PARAMS = new URLSearchParams(location.search);
function loadSave() { try { return JSON.parse(localStorage.getItem('pk_save')); } catch (e) { return null; } }
function writeSave() { try { localStorage.setItem('pk_save', JSON.stringify(SAVE)); } catch (e) { } }
function loadSuspend() { try { return JSON.parse(localStorage.getItem('pk_suspend')); } catch (e) { return null; } }
function clearSuspend() { try { localStorage.removeItem('pk_suspend'); } catch (e) { } }
function partyUnit(num, level) { const u = makeUnit(num, level, 0); let evo; while ((evo = evolutionFor(u))) evolve(u, evo); u.hp = u.maxHp; return serializeUnit(u); }

// ---------------------------------------------------------------- campaign flow
function startNewGame() { clearSuspend(); SAVE = { chapter: 0, party: [], bag: { pokeball: 3, potion: 1 }, stars: {}, beaten: false }; goScene('starter'); }
function pickStarter(num) { SAVE.party = [partyUnit(num, 5), partyUnit(pick([16, 19, 21, 10, 13, 133]), 3)]; writeSave(); prepChapter(SAVE.chapter); }
function continueCampaign() { SAVE = loadSave(); if (!SAVE) { startNewGame(); return; } if (SAVE.chapter >= CHAPTERS.length) { SAVE.chapter = CHAPTERS.length - 1; } prepChapter(SAVE.chapter); }
function prepChapter(idx) {
  const ch = CHAPTERS[idx]; const P = { chapter: ch, party: SAVE.party, bag: SAVE.bag, deploy: [], start: null };
  autoDeploy(P);
  P.start = () => { const deployed = P.deploy.map(i => Object.assign({}, SAVE.party[i], { pid: i })); goScene('card', { chapter: ch, next: () => launchChapter(idx, deployed) }); };
  goScene('prep', P);
}
function launchChapter(idx, deployed) {
  const ch = CHAPTERS[idx]; BACKDROP = makeBackdrop(ch.map);
  startBattle(ch.map, deployed, Object.assign({}, SAVE.bag), { chapter: idx, seed: (Date.now() & 0xffff) | 1, defer: true });
  for (const u of alive(0)) { const src = deployed.find(d => d.pid != null && d.num === u.num && d.level === u.level && !d._used); if (src) { src._used = true; u.pid = src.pid; } }
  const go = () => { goScene('battle'); beginPhase(0, true); };
  if (ch.intro && !PARAMS.has('nostory')) { goScene('battle'); startDialog(ch.intro, go); } else go();
}
function onBattleEnd(result) {
  const win = result === 'win'; const idx = B.chapter; const skirmish = B.skirmish;
  clearSuspend();
  const caught = B.captured.slice();
  const finishChapter = () => {
    if (skirmish) { const rewards = win ? { pokeball: 1, greatball: 1, [pick(['potion', 'superpotion', 'candy'])]: 1 } : {}; if (SAVE && !SC.data?.preset) { applyBattleToParty(); for (const k in rewards) SAVE.bag[k] = (SAVE.bag[k] || 0) + rewards[k]; SAVE.skirmishWins = (SAVE.skirmishWins || 0) + (win ? 1 : 0); writeSave(); } goScene('results', { win, skirmish: true, turns: B.turn, kills: B.kills, par: B.map.par, rewards, caught, next: () => goScene('title') }); return; }
    const ch = CHAPTERS[idx];
    if (!win) { goScene('results', { win: false, turns: B.turn, kills: B.kills, caught: [], rewards: {}, nextLabel: 'TRY AGAIN', next: () => prepChapter(idx) }); return; }
    const R = { win: true, turns: B.turn, kills: B.kills, par: ch.par, rewards: ch.rewards, caught, trained: [], evolved: [] };
    applyBattleToParty(); for (const k in ch.rewards) SAVE.bag[k] = (SAVE.bag[k] || 0) + ch.rewards[k];
    // training: everyone below the next chapter's level catches up
    const nextCh = CHAPTERS[idx + 1]; const target = nextCh ? nextCh.level - 1 : ch.level + 4;
    SAVE.party = SAVE.party.map(p => { const u = restoreUnit(p); let msg = null; if (u.level < target) { const from = u.level; while (u.level < target) { levelUp(u); const evo = evolutionFor(u); if (evo) { R.evolved.push(u.name + ' evolved into ' + evo.name + '!'); evolve(u, evo); } } msg = u.name + ' trained from Lv' + from + ' to Lv' + u.level; } if (msg) R.trained.push(msg); u.hp = u.maxHp; u.status = null; return serializeUnit(u); });
    SAVE.stars[ch.id] = Math.min(SAVE.stars[ch.id] || 99, B.turn); SAVE.chapter = idx + 1; if (SAVE.chapter >= CHAPTERS.length) SAVE.beaten = true; writeSave();
    R.next = () => { if (idx + 1 >= CHAPTERS.length) goScene('credits', { party: SAVE.party }); else prepChapter(idx + 1); };
    goScene('results', R);
  };
  const ch = !skirmish && CHAPTERS[idx];
  if (win && ch && ch.outro && !PARAMS.has('nostory')) { goScene('battle'); startDialog(ch.outro, finishChapter); } else finishChapter();
}
// Write the battle's team-0 units back into SAVE.party (levels, evolutions), heal everyone, add captures.
function applyBattleToParty() {
  if (!SAVE) return;
  for (const u of B.units) { if (u.team !== 0 || u.pid == null) continue; const s = serializeUnit(u); s.hp = u.maxHp; s.status = null; s.acted = false; SAVE.party[u.pid] = s; }
  for (const c of B.captured) { const s = Object.assign({}, c); s.team = 0; s.acted = false; s.status = null; const u = restoreUnit(s); u.hp = u.maxHp; SAVE.party.push(serializeUnit(u)); }
  SAVE.bag = Object.assign({}, B.bag);
}
// ---------------------------------------------------------------- suspend (mid-battle save at the start of each player phase)
function saveSuspend() {
  if (!B || PARAMS.has('nosave')) return;
  const s = { chapter: B.chapter, skirmish: B.skirmish, skirmishMap: B.skirmish ? B.map.def : null, turn: B.turn, bag: B.bag, captured: B.captured, kills: B.kills, seed: B.seed, items: B.map.items.map(i => !!i.taken), reinforce: B.map.reinforce.map(r => !!r.done), units: B.units.map(u => Object.assign(serializeUnit(u), { pid: u.pid, leader: !!u.leader, provoked: !!u.provoked, maxHpNow: u.maxHp })), cx: BT.cx, cy: BT.cy, party: SAVE ? SAVE.party : null, preset: SC.data && SC.data.preset };
  try { localStorage.setItem('pk_suspend', JSON.stringify(s)); } catch (e) { }
}
function resumeSuspend() {
  const s = loadSuspend(); if (!s) { goScene('title'); return; }
  SAVE = loadSave();
  const mapDef = s.skirmish ? s.skirmishMap : CHAPTERS[s.chapter].map; if (!mapDef) { clearSuspend(); goScene('title'); return; }
  seedRng(s.seed ^ (s.turn * 7919)); const map = parseMap(mapDef); map.def = mapDef; UID = 1;
  B = { map, units: [], turn: s.turn, phase: 0, bag: s.bag, result: null, seized: false, captured: s.captured || [], kills: s.kills || 0, chapter: s.chapter, log: [], seed: s.seed, skirmish: !!s.skirmish };
  map.items.forEach((it, i) => { it.taken = !!s.items[i]; }); map.reinforce.forEach((r, i) => { r.done = !!s.reinforce[i]; });
  for (const d of s.units) { if (d.hp <= 0 && !d.leader) continue; const u = restoreUnit(d); u.pid = d.pid; u.leader = d.leader; u.provoked = d.provoked; if (d.hp <= 0) continue; B.units.push(u); }
  BACKDROP = makeBackdrop(mapDef); BT.mode = 'idle'; BT.sel = null; BT.queue = []; BT.anim = null; BT.cx = s.cx; BT.cy = s.cy; centerCam(BT.cx, BT.cy, true); FX.parts = []; FX.texts = [];
  if (s.skirmish && s.preset) SC.data = { preset: true };
  goScene('battle'); Audio.playMusic(map.music); beginPhase(0, true);
}
// ---------------------------------------------------------------- skirmish
function startSkirmishSetup() {
  SAVE = loadSave(); let party = SAVE && SAVE.party.length ? SAVE.party : null; let preset = false;
  if (!party) { preset = true; party = [partyUnit(25, 12), partyUnit(5, 12), partyUnit(8, 12), partyUnit(2, 12), partyUnit(133, 11), partyUnit(66, 11)]; }
  const avg = Math.round(party.reduce((a, p) => a + p.level, 0) / party.length);
  const S = { seed: Math.floor(Math.random() * 1000), level: clamp(avg, 3, 48), party, preset, go: null };
  S.go = () => { const ch = { title: S.map.name, num: 0, level: S.level, slots: Math.min(8, Math.max(3, Math.floor(party.length))), par: 10, map: S.map, rewards: {} }; const P = { chapter: ch, party, bag: preset ? { pokeball: 3, greatball: 1, potion: 2 } : SAVE.bag, deploy: [], preset }; autoDeploy(P); P.start = () => { const deployed = P.deploy.map(i => Object.assign({}, party[i], { pid: i })); goScene('card', { chapter: ch, next: () => { BACKDROP = makeBackdrop(S.map); startBattle(S.map, deployed, Object.assign({}, P.bag), { skirmish: true, seed: S.seed * 131 + 7, defer: true }); B.map.def = S.map; for (const u of alive(0)) { const src = deployed.find(d => d.pid != null && d.num === u.num && !d._used); if (src) { src._used = true; u.pid = src.pid; } } SC.data = { preset }; goScene('battle'); SC.data = { preset }; beginPhase(0, true); } }); }; goScene('prep', P); };
  goScene('skirmish', S);
}

// ---------------------------------------------------------------- main loop
let lastT = 0;
function frame(t) {
  requestAnimationFrame(frame); const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t; SC.t += dt;
  // input
  const q = INPUT.queue; INPUT.queue = [];
  for (const ev of q) {
    if (ev.type === 'key' && ev.key === 'mute' && SC.name !== 'battle') { Audio.toggle(); continue; }
    switch (SC.name) {
      case 'title': titleInput(ev); break; case 'starter': starterInput(ev); break; case 'card': cardInput(ev); break; case 'story': storyInput(ev); break;
      case 'prep': prepInput(ev); break; case 'battle': battleInput(ev); break; case 'results': resultsInput(ev); break; case 'credits': creditsInput(ev); break; case 'skirmish': skirmishInput(ev); break;
    }
  }
  // update
  if (SC.name === 'battle') battleUpdate(dt); else if (SC.name === 'story') storyUpdate(dt); else { Audio.tick(); }
  // draw
  ctx.setTransform(VIEW.scale, 0, 0, VIEW.scale, 0, 0); ctx.imageSmoothingEnabled = false;
  switch (SC.name) {
    case 'loading': rect(0, 0, VIEW.w, VIEW.h, '#0e0c10'); textC('loading sprites…', VIEW.w / 2, VIEW.h / 2, UI.muted); break;
    case 'title': titleDraw(); break; case 'starter': starterDraw(); break; case 'card': cardDraw(); break; case 'story': storyDraw(); break;
    case 'prep': prepDraw(); break; case 'battle': battleDraw(); break; case 'results': resultsDraw(); break; case 'credits': creditsDraw(); break; case 'skirmish': skirmishDraw(); break;
  }
}
// Deep links for testing: ?ch=3 jumps into chapter 3 with a loaner party; ?skirmish=42 a skirmish; ?silent mutes.
function boot() {
  buildTileset();
  if (PARAMS.has('silent')) { Audio.muted = true; }
  if (PARAMS.has('ch')) {
    const idx = clamp(parseInt(PARAMS.get('ch')) - 1, 0, CHAPTERS.length - 1); const ch = CHAPTERS[idx]; const L = ch.level;
    SAVE = { chapter: idx, party: [partyUnit(4, L), partyUnit(7, L), partyUnit(1, L), partyUnit(25, L), partyUnit(133, L - 1), partyUnit(66, L - 1), partyUnit(74, L - 1), partyUnit(16, L - 2)], bag: { pokeball: 3, greatball: 2, potion: 2, superpotion: 1, fullheal: 1, candy: 1 }, stars: {}, beaten: false };
    if (PARAMS.has('prep')) { prepChapter(idx); return; }
    const deployed = SAVE.party.slice(0, ch.slots).map((p, i) => Object.assign({}, p, { pid: i })); BACKDROP = makeBackdrop(ch.map);
    startBattle(ch.map, deployed, Object.assign({}, SAVE.bag), { chapter: idx, seed: parseInt(PARAMS.get('seed') || '7'), defer: true }); alive(0).forEach((u, i) => u.pid = i); goScene('battle'); beginPhase(0, true); return;
  }
  if (PARAMS.has('skirmish')) { startSkirmishSetup(); SC.data.seed = parseInt(PARAMS.get('skirmish')) || 1; return; }
  goScene(PARAMS.get('scene') || 'title');
}
loadSprites(() => { boot(); });
requestAnimationFrame(frame);
// Debug: play one player phase with the enemy AI (used by tools/cdp.cjs balance script).
function autoTurn() { if (!B || B.phase !== 0 || BT.mode !== 'idle') return false; for (const u of alive(0)) { if (u.acted) continue; const d = aiDecide(u); if (d) { u.x = d.x; u.y = d.y; if (d.target) { resolveCombat(u, d.target, d.move, u); } } u.acted = true; if (checkObjective()) { endBattle(); return true; } } endTurn(); return true; }
// Debug: simulate a whole battle model-only (no animation), AI on both sides. Returns a summary.
function simBattle(maxTurns = 30, cautious = true) {
  const log = B.simLog = []; const act = team => { for (const u of alive(team)) { if (u.status === 'frz') continue; const d = aiDecide(u, team === 0 && cautious); if (d) { u.x = d.x; u.y = d.y; if (d.target) { const ev = resolveCombat(u, d.target, d.move, u); for (const e of ev) if (e.type === 'hit' || e.type === 'ko') log.push('T' + B.turn + ' ' + (e.type === 'ko' ? 'KO ' + e.unit.name + ' by ' + e.by.name : e.att.name + '(' + e.att.team + ')L' + e.att.level + ' ' + e.move.name + '→' + e.def.name + 'L' + e.def.level + ' ' + e.dmg + (e.crit ? '!' : '') + ' hp' + e.hpAfter + '/' + e.def.maxHp)); } } u.acted = true; if (checkObjective()) return true; } return false; };
  while (!B.result && B.turn <= maxTurns) {
    if (act(0)) break;
    let done = false; for (const t of [1, 2, 3]) { if (!alive(t).length) continue; upkeep(t); if (t === 1) spawnReinforcements(); if (act(t)) { done = true; break; } } if (done) break;
    B.turn++; upkeep(0); if (checkObjective()) break;
  }
  return { result: B.result, turn: B.turn, p: alive(0).length, e: alive(1).length };
}
window.__pk = { autoTurn, simBattle, get B() { return B; }, BT, SC, VIEW, CAM, INPUT, Audio, get SAVE() { return SAVE; }, HUD, goScene, startBattle, CHAPTERS, DEX, makeUnit, tileAction, endTurn };
