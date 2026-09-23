// ============================================================================
// main.js — game flow (campaign, skirmish, saves), the main loop and boot.
// ============================================================================
'use strict';
let SAVE = null;   // { chapter, party:[serialized], bag:{}, stars:{}, beaten }
const PARAMS = new URLSearchParams(location.search);
// Saves written before the HP edge became an explicit per-unit field: every campaign party member carries it.
function migrateParty(list) { if (list) for (const p of list) if (p.hpBonus == null) p.hpBonus = BOND_HP; return list; }
function loadSave() { try { const s = JSON.parse(localStorage.getItem('pk_save')); if (s) { migrateParty(s.party); migrateCaptain(s); s.bag = normalizeBag(s.bag); } return s; } catch (e) { return null; } }
function writeSave() { if (PARAMS.has('nosave')) return; try { localStorage.setItem('pk_save', JSON.stringify(SAVE)); } catch (e) { } }
function loadSuspend() { try { return JSON.parse(localStorage.getItem('pk_suspend')); } catch (e) { return null; } }
function clearSuspend() { if (PARAMS.has('nosave')) return; try { localStorage.removeItem('pk_suspend'); } catch (e) { } }
// A serialized party member at full HP, evolved for its level. Campaign parties carry the HP edge; Versus passes 1.
function partyUnit(num, level, hpBonus = BOND_HP) { const u = makeUnit(num, level, 0, { hpBonus }); let evo; while ((evo = evolutionFor(u))) evolve(u, evo); u.hp = u.maxHp; return serializeUnit(u); }

// ---------------------------------------------------------------- campaign flow
function startNewGame() { clearSuspend(); SAVE = { chapter: 0, party: [], bag: { pokeball: 5 }, stars: {}, beaten: false, co: 'you', journey: { version: 1, firstCatch: false } }; if (PARAMS.has('nostory')) goScene('starter'); else startPrologue(() => goScene('starter')); }
function pickStarter(num) { SAVE.party = [partyUnit(num, 5), partyUnit(16, 3)]; SAVE.starter = num; SAVE.captainPid = 0; writeSave(); showJourney(['YOUR PARTNER, YOUR PC BOX', DEX[num].name + ' is your partner: it wears the crown and leads your army. Pidgey joins as your scout.', 'Every Pokémon you catch waits in your PC Box, ready to deploy.', 'Hold Poké Centers: each pays ₽1,000 a day, and your Box deploys there.', 'Eight fronts to free across Kanto, each with a goal and three stars.'], () => openRoute({ sel: 0 })); }
function continueCampaign() { SAVE = loadSave(); if (!SAVE) { startNewGame(); return; } openRoute(); }
function prepChapter(idx) {
  migrateCaptain(SAVE);
  const ch = CHAPTERS[idx]; const P = { chapter: ch, party: SAVE.party, bag: SAVE.bag, deploy: [], start: null, noCaptain: idx >= 3 && !!SAVE.co && SAVE.co !== 'you' && coUnlocked(SAVE).includes(SAVE.co), back: () => openRoute({ sel: idx }) };
  autoDeploy(P);
  P.start = () => { const deployed = P.deploy.map(i => Object.assign({}, SAVE.party[i], { pid: i })); goScene('card', { chapter: ch, next: () => launchChapter(idx, deployed) }); };
  goScene('prep', P);
}
// A front's battle options: your collection's Box, your commander (the Tactician or a freed Gym Leader), and the enemy
// commander with their army waiting at the Rocket-held centers (from Mt. Moon on).
function chapterOpts(idx, box, seed) {
  const ch = CHAPTERS[idx], onMap = ch.map.units.filter(u => u.team == null || u.team === 1).map(u => u.mon);
  return { chapter: idx, seed, defer: true, box, captain: { pid: SAVE.captainPid, root: SAVE.starter, chapter: idx }, co: SAVE.co, enemyCo: ch.co || null, box2: ch.co ? coTeam(ch.co, Math.max(3, ch.level - 1), ch.army || 5, ch.num, onMap) : [], war: { funds: [0, 0] }, lesson: idx === 0 && SAVE.journey && !SAVE.journey.firstCatch };
}
function launchChapter(idx, deployed) {
  const ch = CHAPTERS[idx]; BACKDROP = makeBackdrop(ch.map);
  const box = SAVE.party.map((p, i) => Object.assign({}, p, { pid: i })).filter(p => !deployed.some(d => d.pid === p.pid));
  startBattle(ch.map, deployed, Object.assign({}, SAVE.bag), chapterOpts(idx, box, (Date.now() & 0xffff) | 1));
  for (const u of alive(0)) { const src = deployed.find(d => d.pid != null && d.num === u.num && d.level === u.level && !d._used); if (src) { src._used = true; u.pid = src.pid; } }
  const go = () => { const start = () => { goScene('battle'); beginPhase(0, true); }; if (CHAPTER_LESSONS[idx]) showJourney(CHAPTER_LESSONS[idx], start); else start(); };
  if (ch.intro && !PARAMS.has('nostory')) { goScene('battle'); startDialog(ch.intro, go); } else go();
}
function onBattleEnd(result) {
  if (B.territory) { const S = B.territory, W = B.war; clearSuspend(); goScene('territoryResults', { result, reason: W.reason || 'Retreated', turn: B.turn, centers: [warMiddleHeld(0), warMiddleHeld(1)], deployments: W.stats.deployments.slice(), seed: B.seed, captains: (S.captains || [7, 7]).slice() }); return; }
  if (B.tower != null) { towerEnd(result); return; }
  if (B.safari) { safariEnd(result); return; }
  if (B.versus) {
    const S = B.setup; const survivors = t => alive(t).map(u => u.num); const again = teams => { const S2 = Object.assign({}, S, { teams }); S2.go = () => launchVersus(S2); return S2; };
    goScene('results', { versus: true, result: B.result, reason: B.endReason, mode: B.map.objective.mode || 'elim', turns: B.turn, kills: B.kills, teams: [survivors(0), survivors(1)], rosters: [S.teams[0].slice(), S.teams[1].slice()], next: () => goScene('title'), rematch: () => { const S2 = again([S.teams[0].slice(), S.teams[1].slice()]); S2.seed = (S.seed + 1) % 1000; launchVersus(S2); }, setup: () => goScene('versus', again([[], []])) });
    return;
  }
  const win = result === 'win'; const idx = B.chapter; const skirmish = B.skirmish;
  clearSuspend();
  const caught = B.captured.slice();
  const finishChapter = () => {
    if (skirmish) { const rewards = win ? { pokeball: 3 } : {}; if (SAVE && !SC.data?.preset) { applyBattleToParty(); for (const k in rewards) SAVE.bag[k] = (SAVE.bag[k] || 0) + rewards[k]; SAVE.skirmishWins = (SAVE.skirmishWins || 0) + (win ? 1 : 0); writeSave(); } goScene('results', { win, skirmish: true, turns: B.turn, kills: B.kills, par: B.map.par, rewards, caught, stars: win ? battleStars(B.map.par || 10) : 0, faints: B.faints || 0, war: B.war ? { captures: B.war.stats.captures[0], deployments: B.war.stats.deployments[0], funds: B.war.funds[0], reason: B.war.reason } : null, next: () => goScene('quick') }); return; }
    const ch = CHAPTERS[idx];
    if (!win) { goScene('results', { win: false, turns: B.turn, kills: B.kills, caught: [], rewards: {}, nextLabel: 'TRY AGAIN', next: () => prepChapter(idx), route: () => openRoute({ sel: idx }) }); return; }
    // stars: the win, the win within par, the win with nobody fainted; rewards only on the first clear
    const stars = battleStars(ch.par), first = (SAVE.chapter || 0) <= idx, rewards = first ? ch.rewards : {};
    const R = { win: true, turns: B.turn, kills: B.kills, par: ch.par, rewards, caught, trained: [], evolved: [], stars, faints: B.faints || 0, best: SAVE.rating && SAVE.rating[ch.id] || 0 };
    if (B.lesson && B.lesson.complete && SAVE.journey) SAVE.journey.firstCatch = true;
    applyBattleToParty(); for (const k in rewards) SAVE.bag[k] = (SAVE.bag[k] || 0) + rewards[k];
    SAVE.rating = SAVE.rating || {}; SAVE.rating[ch.id] = Math.max(SAVE.rating[ch.id] || 0, stars);
    // training: everyone below the next chapter's level catches up
    const nextCh = CHAPTERS[idx + 1]; const target = nextCh ? nextCh.level - 1 : ch.level + 4;
    SAVE.party = SAVE.party.map(p => { const u = restoreUnit(p); let msg = null; if (u.level < target) { const from = u.level; while (u.level < target) { levelUp(u); const evo = evolutionFor(u); if (evo) { R.evolved.push(u.name + ' evolved into ' + evo.name + '!'); evolve(u, evo); } } msg = u.name + ' trained from Lv' + from + ' to Lv' + u.level; } if (msg) R.trained.push(msg); u.hp = u.maxHp; u.status = null; return serializeUnit(u); });
    const coBefore = coUnlocked(SAVE); SAVE.stars[ch.id] = Math.min(SAVE.stars[ch.id] || 99, B.turn); SAVE.chapter = Math.max(SAVE.chapter || 0, idx + 1); if (SAVE.chapter >= CHAPTERS.length) SAVE.beaten = true; writeSave();
    R.newCos = coUnlocked(SAVE).filter(c => !coBefore.includes(c)); // Gym Leaders freed on this front join as commanders
    const unlocked = first && idx + 1 < CHAPTERS.length ? idx + 1 : null;
    R.next = () => { if (first && idx + 1 >= CHAPTERS.length) goScene('credits', { party: SAVE.party }); else openRoute({ reveal: { cleared: idx, stars, unlocked } }); };
    goScene('results', R);
  };
  const ch = !skirmish && CHAPTERS[idx];
  if (win && ch && ch.outro && !PARAMS.has('nostory')) { goScene('battle'); startDialog(ch.outro, finishChapter); } else finishChapter();
}
// Stars for a won battle: one for the win, one within par, one when none of the player's Pokémon fainted.
function battleStars(par) { return 1 + (B.turn <= (par || 10) ? 1 : 0) + (!(B.faints > 0) ? 1 : 0); }
// Write the battle's team-0 units back into SAVE.party (levels, evolutions), heal everyone, add captures.
function applyBattleToParty() {
  if (!SAVE) return;
  for (const u of B.units) { if (u.team !== 0 || u.pid == null) continue; const s = serializeUnit(u); s.hp = u.maxHp; s.status = null; s.acted = false; s.recharge = 0; s.cd = 0; s.brace = 0; s.root = 0; SAVE.party[u.pid] = s; }
  if (B.war) for (const e of B.war.box[0]) if (e.captIdx != null && e.unitId != null) { const u = B.units.find(v => v.id === e.unitId); if (u) B.captured[e.captIdx] = serializeUnit(Object.assign({}, u, { team: 0 })); }
  for (const c of B.captured) { const s = Object.assign({}, c, { team: 0, acted: false, status: null, recharge: 0, cd: 0, brace: 0, root: 0, hpBonus: BOND_HP }); const u = restoreUnit(s); u.hp = u.maxHp; SAVE.party.push(serializeUnit(u)); }
  SAVE.bag = normalizeBag(B.bag);
}
// ---------------------------------------------------------------- suspend (mid-battle save at the start of each player phase)
function saveSuspend() {
  if (!B || PARAMS.has('nosave')) return;
  const s = { rng: typeof rnd.state === 'function' ? rnd.state() : null, territory: B.territory || null, war: B.war || null, weather: B.weather || null, command: B.command || null, lesson: B.lesson || null, chapter: B.chapter, skirmish: B.skirmish, tower: B.tower, safari: B.safari || null, skirmishMap: B.skirmish ? B.map.def : null, turn: B.turn, bag: B.bag, captured: B.captured, kills: B.kills, faints: B.faints || 0, seed: B.seed, items: B.map.items.map(i => !!i.taken), reinforce: B.map.reinforce.map(r => !!r.done), units: B.units.map(u => Object.assign(serializeUnit(u), { pid: u.pid, leader: !!u.leader, provoked: !!u.provoked, maxHpNow: u.maxHp })), cx: BT.cx, cy: BT.cy, party: SAVE ? SAVE.party : null, preset: SC.data && SC.data.preset };
  try { localStorage.setItem('pk_suspend', JSON.stringify(s)); BT.savedAt = BT.time; } catch (e) { }
}
function resumeSuspend() {
  const s = loadSuspend(); if (!s) { goScene('title'); return; }
  SAVE = loadSave();
  const mapDef = s.territory ? TERRITORY_MAP : s.skirmish ? s.skirmishMap : CHAPTERS[s.chapter]?.map; if (!mapDef) { clearSuspend(); goScene('title'); return; }
  seedRng(s.rng != null ? s.rng : s.seed ^ (s.turn * 7919)); const map = parseMap(mapDef); map.def = mapDef; map.weather = WEATHER[mapDef.weather] ? mapDef.weather : null; UID = 1;
  B = { territory: s.territory || null, war: s.war || null, weather: s.weather || null, command: s.command || null, lesson: s.lesson || null, map, units: [], turn: s.turn, phase: 0, bag: normalizeBag(s.bag), result: null, seized: false, captured: s.captured || [], kills: s.kills || 0, faints: s.faints || 0, chapter: s.chapter, log: [], seed: s.seed, skirmish: !!s.skirmish, tower: s.tower != null ? s.tower : null, safari: s.safari || null };
  map.items.forEach((it, i) => { it.taken = !!s.items[i]; }); map.reinforce.forEach((r, i) => { r.done = !!s.reinforce[i]; });
  for (const d of s.units) { if (d.hp <= 0 && !d.leader) continue; if (d.hpBonus == null && d.team === 0 && !B.territory) d.hpBonus = BOND_HP; const u = restoreUnit(d); u.pid = d.pid; u.leader = d.leader; u.provoked = d.provoked; if (u.team === 0 && u.status === 'frz') u.acted = true; if (d.hp <= 0) continue; B.units.push(u); }
  // older suspend saves could hold the same id on a party member and an enemy: renumber the duplicates (UID is already past every saved id)
  const seen = new Set(); for (const u of B.units) { if (seen.has(u.id)) u.id = UID++; seen.add(u.id); }
  BACKDROP = makeBackdrop(mapDef); BT.mode = 'idle'; BT.sel = null; BT.queue = []; BT.anim = null; BT.hpShow.clear(); BT.cx = s.cx; BT.cy = s.cy; BT.zoom = 1; if (narrowView() && canZoom()) setZoom(.5); centerCam(BT.cx, BT.cy, true); BT.hoverAnchor = null; FX.parts = []; FX.texts = [];
  for (const u of B.units) requestBigSprite(u.num);
  if (s.skirmish && s.preset) SC.data = { preset: true };
  if (B.war) { map.ownerAt = warOwnerAt; if (B.territory) for (const u of B.units) if (u.team <= 1) u.reserveSlot = B.war.box[u.team].findIndex(e => e.unitId === u.id); }
  if (B.war) wildSetup(mapDef);
  else warSetup(mapDef, { skirmish: B.skirmish }); // a suspend from before the war rules: rebuild them from the map
  if (!s.command) initBattleCaptains(B.territory ? {} : SAVE ? { captain: { pid: SAVE.captainPid, root: SAVE.starter, chapter: s.chapter == null ? 8 : s.chapter } } : {});
  // the save was written after this phase's upkeep: resume without applying it again
  goScene('battle'); Audio.playMusic(map.music); beginPhase(0, true, true);
}
// ---------------------------------------------------------------- skirmish
// Skirmish against the CPU on a random battlefield, Advance Wars style: both sides start with an HQ, a Poké Center and
// funds. You open with four of your Pokémon (the rest of your collection waits in the PC Box, topped up with loaners
// to six); the foe commander opens with a squad and their Ace and deploys the rest of their army as they earn.
function startSkirmishSetup() {
  SAVE = loadSave(); let party = SAVE && SAVE.party.length ? SAVE.party : null; let preset = false;
  if (!party) { preset = true; party = [partyUnit(25, 12), partyUnit(5, 12), partyUnit(8, 12), partyUnit(2, 12), partyUnit(133, 11), partyUnit(66, 11)]; }
  const avg = Math.round(party.reduce((a, p) => a + p.level, 0) / party.length), cos = coUnlocked(preset ? null : SAVE), last = (SAVE && SAVE.skirmishSetup) || {};
  const level = SKIRMISH.levels.reduce((b, l) => Math.abs(l - avg) < Math.abs(b - avg) ? l : b, SKIRMISH.levels[0]);
  const S = { seed: Math.floor(Math.random() * 1000), level, party, preset, cos, co: cos.includes(last.co) ? last.co : 'you', foe: CO_FOES.includes(last.foe) ? last.foe : pick(CO_FOES.slice(0, 4)), funds: SKIRMISH.funds.includes(last.funds) ? last.funds : 1000, weather: SKIRMISH.weather.includes(last.weather) ? last.weather : 'none', biome: SKIRMISH.biomes.includes(last.biome) ? last.biome : 'field', size: SKIRMISH.sizes[last.size] ? last.size : 'm', go: null };
  S.go = () => {
    const map = S.map, ch = { title: map.name, num: 0, label: 'SKIRMISH', level: S.level, slots: SKIRMISH.slots, par: map.par, map, rewards: {} };
    if (SAVE && !preset) { SAVE.skirmishSetup = { co: S.co, foe: S.foe, funds: S.funds, weather: S.weather, biome: S.biome, size: S.size }; writeSave(); }
    // loaners (plain stats, never saved to the collection) make up an army of twelve
    const army = party.concat(skirmishLoaners(party, S.level, SKIRMISH.slots + SKIRMISH.box - party.length).map(l => Object.assign(partyUnit(l.num, l.level, 1), { loaner: true })));
    const P = { chapter: ch, party: army, captain: preset ? null : (migrateCaptain(SAVE), SAVE.captainPid), bag: preset ? { pokeball: 3 } : SAVE.bag, deploy: [], preset, back: () => goScene('skirmish', S) }; autoDeploy(P);
    P.start = () => {
      const pid = i => i < party.length ? i : null, deployed = P.deploy.map(i => Object.assign({}, army[i], { pid: pid(i) })), box = army.map((p, i) => Object.assign({}, p, { pid: pid(i) })).filter((p, i) => !P.deploy.includes(i));
      const onMap = map.units.filter(u => u.team == null || u.team === 1).map(u => u.mon);
      const weather = S.weather === 'random' ? pick(['none', 'none', 'rain', 'sun', 'sand', 'snow']) : S.weather; map.weather = weather === 'none' ? null : weather;
      goScene('card', { chapter: ch, next: () => {
        BACKDROP = makeBackdrop(map);
        startBattle(map, deployed, Object.assign({}, P.bag), { skirmish: true, seed: S.seed * 131 + 7, defer: true, cos: [S.co, S.foe], box, box2: coTeam(S.foe, S.level, 8, S.seed + 1, onMap), war: { funds: [S.funds, S.funds] },
          captain: preset ? { pid: 0, root: 4, chapter: 8 } : { pid: SAVE.captainPid, root: SAVE.starter, chapter: SAVE.chapter } });
        B.map.def = map; SC.data = { preset }; goScene('battle'); SC.data = { preset }; beginPhase(0, true);
      } });
    };
    goScene('prep', P);
  };
  goScene('skirmish', S);
}

// ---------------------------------------------------------------- versus (two trainers, one device)
const VS_ROSTER = [5, 8, 2, 25, 17, 33, 12, 15, 28, 37, 39, 42, 44, 54, 58, 61, 64, 67, 75, 93, 95, 123, 125, 126, 111, 104, 133, 116];
// Versus: both trainers at Lv 20 with plain stats, 30 turns, no wild Pokémon; each picks a captain style and their first
// draft pick leads the team (the same powers as the campaign, both unlocked).
function startVersusSetup(seed) { const S = { seed: seed != null ? seed : Math.floor(Math.random() * 1000), level: 20, wild: false, mode: 'elim', arena: 'm', fog: false, turns: 30, cap0: 4, cap1: 7, co0: 'brock', co1: 'misty', funds: 1000, weather: 'none', teams: [[], []], order: [0, 1, 1, 0, 0, 1, 1, 0], size: 4, cur: 0, go: null }; S.go = () => launchVersus(S); goScene('versus', S); }
function vsMapFor(S) { const A = VS_ARENAS[S.arena] || VS_ARENAS.m; return versusMap(S.seed, A.w, A.h, { wild: S.wild, level: S.level, mode: S.mode || 'elim', fog: !!S.fog, turns: S.turns == null ? 30 : S.turns }); }
function launchVersus(S) {
  const map = vsMapFor(S); const mk = list => list.map(n => partyUnit(n, S.level, 1)); // both trainers: plain stats
  const p1 = mk(S.teams[0]), p2 = mk(S.teams[1]); BACKDROP = makeBackdrop(map);
  const weather = S.weather === 'random' ? pick(['none', 'none', 'rain', 'sun', 'sand', 'snow']) : S.weather || 'none'; map.weather = weather === 'none' ? null : weather;
  const funds = S.funds == null ? 1000 : S.funds, cat = vsCatalog(S.level);
  startBattle(map, p1, {}, { versus: true, humans: [0, 1], party2: p2, seed: (S.seed * 131 + 7) | 1, defer: true, setup: S, captains: [S.cap0 || 4, S.cap1 || 7], cos: [S.co0 || 'brock', S.co1 || 'misty'], box: cat, box2: cat, war: { funds: [funds, funds] } });
  goScene('battle'); beginPhase(0, true);
}

// ---------------------------------------------------------------- main loop
let lastT = 0;
function frame(t) {
  requestAnimationFrame(frame); const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t; SC.t += dt; CLOCK.t += dt; CLOCK.dt = dt; CLOCK.frame++;
  // input
  const q = INPUT.queue; INPUT.queue = [];
  for (const ev of q) {
    if (ev.type === 'key' && ev.key === 'mute' && SC.name !== 'battle') { Audio.toggle(); continue; }
    switch (SC.name) {
      case 'journey': journeyInput(ev); break; case 'territory': case 'territoryResults': territorySceneInput(ev); break; case 'title': titleInput(ev); break; case 'starter': starterInput(ev); break; case 'card': cardInput(ev); break; case 'story': storyInput(ev); break;
      case 'prep': prepInput(ev); break; case 'battle': battleInput(ev); break; case 'results': resultsInput(ev); break; case 'credits': creditsInput(ev); break; case 'skirmish': skirmishInput(ev); break; case 'versus': versusInput(ev); break; case 'quick': quickInput(ev); break; case 'route': routeInput(ev); break; case 'tower': towerInput(ev); break; case 'rank': rankInput(ev); break; case 'brief': briefInput(ev); break; case 'cos': coRoomInput(ev); break;
    }
  }
  // update
  if (SC.name === 'battle') battleUpdate(dt); else if (SC.name === 'story') storyUpdate(dt); else if (SC.name === 'route') routeUpdate(dt); else { if (SC.name === 'title') titleUpdate(dt); Audio.tick(); }
  // draw
  ctx.setTransform(VIEW.scale, 0, 0, VIEW.scale, 0, 0); ctx.imageSmoothingEnabled = false;
  switch (SC.name) {
    case 'loading': rect(0, 0, VIEW.w, VIEW.h, '#0e0c10'); textC('loading sprites…', VIEW.w / 2, VIEW.h / 2, UI.muted); break;
    case 'journey': journeyDraw(); break; case 'territory': territorySetupDraw(); break; case 'territoryResults': territoryResultsDraw(); break; case 'title': titleDraw(); break; case 'starter': starterDraw(); break; case 'card': cardDraw(); break; case 'story': storyDraw(); break;
    case 'prep': prepDraw(); break; case 'battle': battleDraw(); break; case 'results': resultsDraw(); break; case 'credits': creditsDraw(); break; case 'skirmish': skirmishDraw(); break; case 'versus': versusDraw(); break; case 'quick': quickDraw(); break; case 'route': routeDraw(); break; case 'tower': towerDraw(); break; case 'rank': rankDraw(); break; case 'brief': briefDraw(); break; case 'cos': coRoomDraw(); break;
  }
  // every scene change closes and reopens a Poké Ball over the screen (see captureTransition)
  drawTransition(dt);
}
// Deep links for testing: ?ch=3 jumps into chapter 3 with a loaner party; ?skirmish=42 a skirmish; ?silent mutes.
function boot() {
  buildTileset();
  if (PARAMS.has('silent')) { Audio.muted = true; }
  if (PARAMS.has('territory')) { const seed = parseInt(PARAMS.get('territory')) || 7; if (PARAMS.has('auto')) launchTerritory(seed); else startTerritorySetup(seed); return; }
  if (PARAMS.has('ch')) {
    const idx = clamp(parseInt(PARAMS.get('ch')) - 1, 0, CHAPTERS.length - 1); const ch = CHAPTERS[idx]; const L = ch.level;
    SAVE = { chapter: idx, party: [partyUnit(4, L), partyUnit(7, L), partyUnit(1, L), partyUnit(25, L), partyUnit(133, L - 1), partyUnit(66, L - 1), partyUnit(74, L - 1), partyUnit(16, L - 2)], bag: { pokeball: 5 }, stars: {}, beaten: false };
    if (PARAMS.has('prep')) { prepChapter(idx); return; }
    if (PARAMS.has('brief')) { briefChapter(idx); return; }
    migrateCaptain(SAVE);
    const deployed = SAVE.party.slice(0, ch.slots).map((p, i) => Object.assign({}, p, { pid: i })); BACKDROP = makeBackdrop(ch.map);
    if (PARAMS.has('co')) SAVE.co = PARAMS.get('co');
    startBattle(ch.map, deployed, Object.assign({}, SAVE.bag), Object.assign(chapterOpts(idx, SAVE.party.slice(ch.slots).map((p, i) => Object.assign({}, p, { pid: ch.slots + i })), parseInt(PARAMS.get('seed') || '7')), { lesson: false })); alive(0).forEach((u, i) => { if (u.pid == null && !u.loaned) u.pid = i; }); goScene('battle'); beginPhase(0, true); return;
  }
  if (PARAMS.has('skirmish')) { startSkirmishSetup(); SC.data.seed = parseInt(PARAMS.get('skirmish')) || 1; return; }
  if (PARAMS.has('safari')) { startSafari(); return; }
  if (PARAMS.has('tower')) { startTower(clamp((parseInt(PARAMS.get('tower')) || 1) - 1, 0, TOWER.length - 1)); return; }
  if (PARAMS.has('versus')) { startVersusSetup(parseInt(PARAMS.get('versus')) || 1); if (PARAMS.has('auto')) { const S = SC.data; S.teams = [VS_ROSTER.slice(0, 4), VS_ROSTER.slice(4, 8)]; S.go(); } return; }
  goScene(PARAMS.get('scene') || 'title');
}
loadSprites(() => { boot(); });
requestAnimationFrame(frame);
// Debug: play one player phase with the enemy AI (used by tools/cdp.cjs balance script).
// Model-only action for one AI decision: skill, or attack then dart. Shared by autoTurn and simBattle.
function aiAct(u, d, log) {
  u.x = d.x; u.y = d.y; warSettle();
  if (d.capture) { const ev = warCapture(u); if (log && ev) log.push('T' + B.turn + ' ' + u.name + ' captures ' + ev.property.name); return; }
  if (d.catch) { const c = safariThrow(u, d.target); if (c) { c.done(); if (log) log.push('T' + B.turn + ' ' + u.name + '(' + u.team + ') throws at ' + d.target.name + (c.ev.ok ? ': caught' : ': broke free')); } return; }
  if (d.skill) { const ev = useSkill(u, d.skill, d.target); if (log && ev) log.push('T' + B.turn + ' ' + u.name + '(' + u.team + ') ' + d.skill.name + '→' + d.target.name); return; }
  if (d.target) { const ev = resolveCombat(u, d.target, d.move, u); if (log) for (const e of ev) if (e.type === 'hit' || e.type === 'ko') log.push('T' + B.turn + ' ' + (e.type === 'ko' ? 'KO ' + e.unit.name + ' by ' + e.by.name : e.att.name + '(' + e.att.team + ')L' + e.att.level + ' ' + e.move.name + '→' + e.def.name + 'L' + e.def.level + ' ' + e.dmg + (e.crit ? '!' : '') + ' hp' + e.hpAfter + '/' + e.def.maxHp)); const c = aiDart(u); if (c) { u.x = c.x; u.y = c.y; if (log) log.push('T' + B.turn + ' ' + u.name + ' darts'); } }
}
function autoTurn() { if (!B || B.phase !== 0 || BT.mode !== 'idle') return false; aiPower(0); for (const u of alive(0)) { if (u.acted) continue; const d = aiDecide(u); if (d) aiAct(u, d); u.acted = true; if (checkObjective()) { endBattle(); return true; } } endTurn(); return true; }
// Debug: simulate a whole battle model-only (no animation), AI on both sides. Returns a summary.
function simBattle(maxTurns = 30, cautious = true) {
  const log = B.simLog = []; const act = team => { B.phase = team; const power = aiPower(team); if (power) log.push('T' + B.turn + ' ' + team + ' uses ' + power[0].name); for (const u of alive(team)) { if (u.status === 'frz' || u.acted) continue; const d = aiDecide(u, team === 0 && cautious); if (d) aiAct(u, d, log); u.acted = true; if (checkObjective()) return true; } return false; };
  while (!B.result && B.turn <= maxTurns) {
    if (act(0)) break;
    let done = false; for (const t of [1, 2, 3]) { if (!alive(t).length) continue; upkeep(t); if (t === 1) spawnReinforcements(); if (act(t)) { done = true; break; } } if (done) break;
    B.turn++; upkeep(0); if (checkObjective()) break;
  }
  return { result: B.result, turn: B.turn, p: alive(0).length, e: alive(1).length };
}
window.__pk = { autoTurn, simBattle, startVersusSetup, launchVersus, startSkirmishSetup, startTower, launchTowerFloor, startSafari, startTerritorySetup, startNewGame, get B() { return B; }, BT, SC, VIEW, CAM, INPUT, Audio, get SAVE() { return SAVE; }, HUD, goScene, startBattle, CHAPTERS, DEX, makeUnit, tileAction, endTurn };
