// ============================================================================
// modes.js — the Battle Tower (ten floors, one commander on each, ranked S to C with records) and the Safari Zone
// (a catch race against a rival). Both play on the war rules (war.js) over generated battlefields (skirmishMap).
// ============================================================================
'use strict';
// ---------------------------------------------------------------- records (kept apart from the campaign save)
function loadRecords() { try { return JSON.parse(localStorage.getItem('pk_records')) || {}; } catch (e) { return {}; } }
function writeRecords(R) { if (typeof PARAMS !== 'undefined' && PARAMS.has('nosave')) return; try { localStorage.setItem('pk_records', JSON.stringify(R)); } catch (e) { } }

// ---------------------------------------------------------------- the Battle Tower
// Each floor: the commander waiting there, the land, the level both armies fight at, the par in days, the weather and
// the map seed. Your army is the Tower's rental team at the floor's level, so every record is set on equal terms.
const TOWER = [
  { co: 'rocket', biome: 'field', level: 10, par: 10, seed: 101, quote: 'This tower belongs to Team Rocket now. Hand over your Pokémon!', beaten: 'Blast it! The boss is going to hear about this...', won: 'Team Rocket wins again! Now scram, kid!' },
  { co: 'brock', biome: 'mountain', level: 14, par: 11, seed: 202, quote: 'Rock-type Pokémon never budge. Neither do I.', beaten: 'You cracked my defence. That takes real grit.', won: 'Solid as a rock. Train harder and come back.' },
  { co: 'misty', biome: 'sea', level: 18, par: 11, seed: 303, weather: 'rain', quote: 'Water always finds a way through. Ready to get soaked?', beaten: 'Hmph! Fine, this round is yours.', won: 'Washed away! Come back when you can swim.' },
  { co: 'surge', biome: 'field', level: 22, par: 12, seed: 404, quote: 'Lightning never hesitates, kid. Neither does a soldier!', beaten: 'Whoa! You are the real deal, kid!', won: 'Zapped! That is how we did it in the war!' },
  { co: 'erika', biome: 'forest', level: 26, par: 12, seed: 505, quote: 'Even a quiet garden has thorns. Shall we begin?', beaten: 'Oh my... what a lovely victory. Truly.', won: 'Your team wilted. Water it well and return.' },
  { co: 'koga', biome: 'cave', level: 30, par: 13, seed: 606, quote: 'You will not see my poison coming. Few ever do.', beaten: 'Hmm... you saw through my smoke.', won: 'Poison works slowly, but it always works.' },
  { co: 'sabrina', biome: 'snow', level: 34, par: 13, seed: 707, weather: 'snow', quote: 'I have already seen how this ends. Shall I show you?', beaten: 'I did not foresee this. Remarkable.', won: 'Exactly as I predicted.' },
  { co: 'blaine', biome: 'volcano', level: 38, par: 13, seed: 808, weather: 'sun', quote: 'My Pokémon burn hotter than this volcano. Stand back!', beaten: 'Burned out! You have the fire, kid.', won: 'Hah! Too hot to handle!' },
  { co: 'blue', biome: 'field', level: 42, par: 14, seed: 909, quote: 'The top of the tower? That spot is mine. Smell ya later!', beaten: 'What?! No way! I will get you next time!', won: 'Heh. Smell ya later, loser!' },
  { co: 'giovanni', biome: 'mountain', level: 46, par: 14, seed: 1010, weather: 'sand', quote: 'Power decides everything. Show me you have some.', beaten: '...I see. You have true strength.', won: 'Power prevails. It always does.' },
];
const TOWER_RENTALS = [4, 7, 1, 25, 16, 63, 66, 74, 92, 60, 58, 133];
const RANK_COL = { S: '#ffd24a', A: '#5ee06a', B: '#5aa8f0', C: '#c8c8d8' };
function towerMap(i) { const F = TOWER[i], m = skirmishMap(F.seed, i >= 7 ? 18 : 16, 11, F.level, { foe: F.co, biome: F.biome }); m.name = 'Tower ' + (i + 1) + 'F'; m.par = F.par; m.weather = F.weather || null; return m; }
function towerCleared(R, i) { return !!(R.tower && R.tower[i]); }
function towerOpen(R, i) { return i === 0 || towerCleared(R, i - 1); }
// The rank of a won floor: SPEED (100 within par, −10 a day over), POWER (25 per foe knocked out for each Pokémon
// lost, 100 at most) and TECHNIQUE (100, −15 per Pokémon lost). S from 280, A from 240, B from 180.
function towerScore(par, days, kills, faints) {
  const speed = clamp(100 - Math.max(0, days - par) * 10, 0, 100), power = clamp(Math.round(kills / Math.max(1, faints) * 25), 0, 100), tech = clamp(100 - faints * 15, 0, 100), total = speed + power + tech;
  return { days, kills, faints, speed, power, tech, total, rank: total >= 280 ? 'S' : total >= 240 ? 'A' : total >= 180 ? 'B' : 'C' };
}
function startTower(sel, opened) {
  const R = loadRecords(), save = loadSave(); let i = 0; while (i < TOWER.length - 1 && towerCleared(R, i)) i++;
  const cos = coUnlocked(save), T = { i: sel != null ? sel : i, recs: R, cos, co: cos.includes(R.towerCo) ? R.towerCo : 'you', go: null, root: 4, opened: opened != null ? opened : -1 };
  T.go = () => { if (!towerOpen(T.recs, T.i)) { Audio.sfx('error'); return; } Audio.sfx('select'); launchTowerFloor(T); };
  goScene('tower', T);
}
function launchTowerFloor(T) {
  const i = T.i, F = TOWER[i], map = towerMap(i), level = F.level, R = loadRecords(); R.towerCo = T.co; writeRecords(R);
  const army = TOWER_RENTALS.map(n => Object.assign(partyUnit(n, level, 1), { loaner: true }));
  const ch = { title: 'Battle Tower ' + (i + 1) + 'F', num: 0, label: 'BATTLE TOWER · ' + (i + 1) + 'F', level, slots: 4, par: F.par, map, rewards: {} };
  const P = { chapter: ch, party: army, bag: {}, deploy: [], preset: true, back: () => goScene('tower', T) }; autoDeploy(P);
  P.start = () => {
    const deployed = P.deploy.map(k => Object.assign({}, army[k], { pid: null })), box = army.filter((p, k) => !P.deploy.includes(k)).map(p => Object.assign({}, p, { pid: null }));
    const onMap = map.units.filter(u => u.team == null || u.team === 1).map(u => u.mon);
    goScene('card', { chapter: ch, next: () => {
      BACKDROP = makeBackdrop(map);
      startBattle(map, deployed, {}, { skirmish: true, tower: i, seed: F.seed * 7 + 3, defer: true, cos: [T.co, F.co], box, box2: coTeam(F.co, level, 8, F.seed, onMap), war: { funds: [2000, 2000 + i * 500] }, captain: { pid: null, root: captainRoot(deployed[0].num) || 4, chapter: 8 } });
      B.map.def = map; SC.data = { preset: true }; goScene('battle'); SC.data = { preset: true }; beginPhase(0, true);
    } });
  };
  goScene('prep', P);
}
// The end of a floor: a win is ranked and recorded (the best rank and score stay); then the rank screen.
function towerEnd(result) {
  const i = B.tower, F = TOWER[i], win = result === 'win', S = towerScore(F.par, B.turn, B.kills || 0, B.faints || 0), R = loadRecords(); R.tower = R.tower || {};
  const best = R.tower[i] || null, record = win && (!best || S.total > best.total);
  if (record) { R.tower[i] = { rank: S.rank, total: S.total, days: S.days }; writeRecords(R); }
  clearSuspend(); goScene('rank', { kind: 'tower', i, win, S, best, record, co: F.co });
}

// ---------------------------------------------------------------- tower lobby
// The tower drawn as ten stacked floors (1F at the bottom): each floor's commander in a window, the land, and the best
// rank earned there; floors open one by one. Beside it the chosen floor: the commander's card and line, its rules, your
// commander and the record.
function towerLayout() {
  const W = VIEW.w, H = VIEW.h, narrow = narrowView() || portraitView(), bh = btnH(), top = 4 + (narrow ? 18 : 26), foot = H - (narrow ? 2 * (bh + 4) + 8 : bh + 12);
  const tw = narrow ? W - 12 : Math.min(244, Math.floor(W * .42) - 6), rowH = narrow ? clamp(Math.floor((foot - top) * .44 / 10.6), 14, 18) : clamp(Math.floor((foot - top - 22) / 10), 14, 24);
  const roof = narrow ? 10 : 18, th = roof + rowH * 10 + 4, tx = narrow ? 6 : 12, ty = top + (narrow ? 2 : Math.max(2, Math.floor((foot - top - th) / 2)));
  const px = narrow ? 6 : tx + tw + 8, py = narrow ? ty + th + 6 : top + 2, pw = narrow ? W - 12 : W - px - 6, ph = foot - 6 - py;
  return { W, H, narrow, bh, top, foot, tw, rowH, roof, th, tx, ty, px, py, pw, ph };
}
function towerDraw() {
  const T = SC.data, L = towerLayout(), { W, H } = L, t = SC.t; T.i = clamp(T.i, 0, TOWER.length - 1); const F = TOWER[T.i], open = towerOpen(T.recs, T.i);
  rect(0, 0, W, H, '#100c24'); for (let y = 0; y < H; y += 2) { ctx.globalAlpha = .5 * (1 - y / H); hline(0, y, W, '#2a1c5a'); } ctx.globalAlpha = 1; // dusk sky
  for (let k = 0; k < 40; k++) { const sx = (k * 97) % W, sy = (k * 53) % Math.round(H * .6), tw2 = Math.sin(t * 2 + k) > .6; px(sx, sy, tw2 ? '#ffffff' : '#6a64a0'); }
  const recs = Object.values(T.recs.tower || {}), sub = recs.length ? 'Cleared ' + recs.length + '/' + TOWER.length + ' · S ranks ' + recs.filter(r => r.rank === 'S').length + ' · best total ' + recs.reduce((a, r) => a + r.total, 0) : 'Ten floors · one commander on each · ranked S to C';
  SC.hits = []; screenTitle('BATTLE TOWER', L.narrow ? null : sub, 4);
  // the tower: a spire, then the floors from the top (10F) down to 1F
  const { tx, ty, tw, rowH } = L, cx = tx + Math.round(tw / 2);
  for (let k = 0; k < L.roof; k++) { const half = Math.round((tw / 2 - 6) * (k + 1) / L.roof); hline(cx - half, ty + k, half * 2, k % 3 === 0 ? '#5a4a9a' : '#46387e'); } vline(cx, ty - 6, 6, '#c8c0e8'); rect(cx + 1, ty - 6, 5, 3, UI.red);
  const fy0 = ty + L.roof;
  for (let f = TOWER.length - 1; f >= 0; f--) {
    const y = fy0 + (TOWER.length - 1 - f) * rowH, x = tx + 2, w = tw - 4, sel = f === T.i, isOpen = towerOpen(T.recs, f), rec = T.recs.tower && T.recs.tower[f], co = COS[TOWER[f].co];
    const lift = sel && !REDUCED ? -1 : 0, face0 = sel ? '#3a2e7a' : isOpen ? '#2a2258' : '#211b48', mortar = shade(face0, -.18); rect(x, y, w, rowH - 1, face0);
    for (let by = y + 2, c = 0; by < y + rowH - 3; by += 5, c++) { hline(x, by + 4, w, mortar); for (let bx = x + (c % 2 ? 5 : 0) + (f % 2 ? 3 : 0); bx < x + w; bx += 10) vline(bx, by, 4, mortar); } // bricks
    hline(x, y, w, sel ? '#6a5ab8' : '#3a3272'); hline(x, y + rowH - 2, w, '#15102e'); rect(x, y, 3, rowH - 1, '#1a1438'); rect(x + w - 3, y, 3, rowH - 1, '#1a1438'); // ledge and pillars
    const fl = (f + 1) + 'F'; bigText(fl, x + 4, y + Math.round((rowH - 9) / 2) + lift, sel ? UI.gold : isOpen ? '#c8c0e8' : '#5a5480', { shadow: '#0a0820' });
    const face = trainerFace(co.tr), fx = x + 26, fs = Math.min(16, rowH - 4); rect(fx - 1, y + Math.round((rowH - fs) / 2) - 1 + lift, fs + 2, fs + 2, isOpen ? co.col : '#3a3460');
    if (face && isOpen) { ctx.save(); ctx.beginPath(); ctx.rect(fx, y + Math.round((rowH - fs) / 2) + lift, fs, fs); ctx.clip(); ctx.drawImage(face, fx - Math.round((18 - fs) / 2), y + Math.round((rowH - fs) / 2) + lift - 1); ctx.restore(); } else rect(fx, y + Math.round((rowH - fs) / 2) + lift, fs, fs, '#15102e');
    const nx = fx + fs + 5; if (rowH >= 14) text(fitLabel(isOpen ? co.name : '???', w - (nx - x) - 60), nx, y + Math.round((rowH - 7) / 2) + lift, isOpen ? UI.ink : '#5a5480');
    const rx = x + w - 4; if (rec) { const rc = RANK_COL[rec.rank]; rrect(rx - 13, y + Math.round((rowH - 11) / 2), 13, 11, UI.inset, 1); rect(rx - 12, y + Math.round((rowH - 11) / 2) + 1, 11, 9, shade(rc, -.5)); bigC(rec.rank, rx - 6, y + Math.round((rowH - 9) / 2), rc, { shadow: '#000' }); }
    else if (!isOpen) iconAt('x', rx - 10, y + Math.round((rowH - 9) / 2), '#5a5480');
    if (rowH >= 16 && !L.narrow) textR(BIOMES[TOWER[f].biome].name + ' · Lv' + TOWER[f].level, rx - (rec || !isOpen ? 18 : 0), y + Math.round((rowH - 7) / 2) + lift, isOpen ? UI.muted : '#4a4470');
    if (sel) { outline(x - 1, y - 1, w + 2, rowH + 1, UI.gold); if (!REDUCED) drawBall(x - 5 + Math.round(Math.sin(t * 5)), y + Math.round(rowH / 2), '#f04848', 3); }
    // a floor just opened: its lights switch on, with a flash and sparkles
    if (f === T.opened && !REDUCED && t < 1.6) { const k = clamp((t - .3) / .5, 0, 1); ctx.globalAlpha = (1 - k) * .8 * (t > .3 ? 1 : 0); rect(x, y, w, rowH - 1, '#fff6d0'); ctx.globalAlpha = 1; if (t > .3) for (let q = 0; q < 5; q++) sparkle(x + 20 + ((q * 47 + Math.floor(t * 9) * 13) % (w - 40)), y + 2 + (q * 5) % Math.max(2, rowH - 4), 1 + (q + Math.floor(t * 8)) % 2, '#fff2b0'); if (!T.chimed && t > .3) { T.chimed = true; Audio.sfx('chime'); } }
    hit(x, y, w, rowH, () => { if (T.i === f) T.go(); else { T.i = f; T.at = SC.t; Audio.sfx('cursor'); } }, fl);
  }
  // the chosen floor
  const p = panel(L.px, L.py, L.pw, L.ph, { header: 'FLOOR ' + (T.i + 1) + (open ? ' · ' + COS[F.co].name.toUpperCase() : ' · LOCKED'), headerRight: open ? BIOMES[F.biome].name : null, headerFill: open ? shade(COS[F.co].col, -.55) : UI.panelDark });
  let y = p.cy; const cardW = L.narrow ? 64 : 76, cardH = L.narrow ? 54 : 64;
  if (open) {
    coCard(p.x + 6, y, cardW, cardH, F.co, 1, null, { tag: 'FOE', pop: SC.t - (T.at || -9) });
    const qx = p.x + 12 + cardW, qw = p.w - (qx - p.x) - 8, lines = wrap('"' + F.quote + '"', qw - 8).slice(0, Math.floor((cardH - 8) / 9)); rrect(qx, y + 2, qw, lines.length * 9 + 8, '#fff6d8', 2); outline(qx, y + 2, qw, lines.length * 9 + 8, UI.inset);
    for (let k = 0; k < 3; k++) px(qx - 1 - k, y + 10 + k, '#fff6d8'); lines.forEach((l, k) => text(l, qx + 4, y + 6 + k * 9, '#3a2a18'));
    const co = coOf({ co: F.co }), ty = y + lines.length * 9 + 14; text(fitLabel(co.passive.text, qw), qx, ty, UI.muted); text(fitLabel(co.power.name + ' · ' + co.super.name, qw), qx, ty + 10, UI.info);
    y = Math.max(y + cardH, ty + 18) + 5;
  } else { textC('Clear floor ' + T.i + ' to open this one.', p.x + p.w / 2, y + 20, UI.muted); y += 40; }
  const rows = [['LEVEL', 'Lv ' + F.level + ' · both armies'], ['PAR', F.par + ' days'], ['WEATHER', F.weather ? WEATHER[F.weather].name : 'Clear'], ['FUNDS', money(2000) + ' · foe ' + money(2000 + T.i * 500)]], rh = L.narrow ? 11 : 12;
  for (const [k, v] of rows) { if (y + rh > p.y + p.h - 34) break; text(k, p.x + 8, y, UI.muted); textR(fitLabel(v, p.w - 70), p.x + p.w - 8, y, UI.ink); y += rh; }
  y += 2; const rule = { k: 'co', label: 'YOUR COMMANDER', vals: S => S.cos, show: v => v === 'you' ? 'Tactician' : COS[v].name }; vsRuleRows(T, p.x + 4, y, p.w - 8, 14, [rule], 0); y += 18;
  const rec = T.recs.tower && T.recs.tower[T.i]; if (y + 9 <= p.y + p.h - 4) { if (rec) { text('BEST', p.x + 8, y, UI.muted); text(rec.rank, p.x + 34, y, RANK_COL[rec.rank]); text(rec.total + ' pts · ' + rec.days + ' days', p.x + 44, y, UI.ink); } else text(open ? 'Not cleared yet' : 'Locked', p.x + 8, y, UI.dim); } y += 13;
  // both armies at the floor's level: the foe's (their Ace first) and the Tower's rentals you pick four from
  const armies = [['FOE ARMY', open ? [COS[F.co].ace].concat(CO_TEAMS[F.co].map(n => formAt(n, F.level))) : [], true], ['YOUR RENTALS', TOWER_RENTALS.map(n => formAt(n, F.level)), false]], per = Math.max(1, Math.floor((p.w - 12) / 20));
  for (const [label, list, foe] of armies) { if (!list.length || y + 30 > p.y + p.h - 4) continue; sectionLabel(label, p.x + 8, y, p.w - 16, foe ? '#ff9a9a' : '#8ab4ff'); y += 10;
    list.slice(0, per * 2).forEach((n, k) => { const ix = p.x + 6 + (k % per) * 20, iy = y + Math.floor(k / per) * 16; if (iy + 16 > p.y + p.h - 3) return; const bob = !REDUCED && k === Math.floor(t * 3) % list.length ? -1 : 0; ctx.drawImage(monIcon(n, foe), ix - 2, iy + bob, 24, 18); if (foe && k === 0) drawCrown(ix + 13, iy); });
    y += Math.ceil(Math.min(list.length, per * 2) / per) * 16 + 4; }
  // footer
  const back = () => { Audio.sfx('cancel'); goScene('quick'); };
  if (L.narrow) { footerBand(2 * (L.bh + 4) + 4); bigButton(6, H - 2 * (L.bh + 4), W - 12, L.bh, 'CHALLENGE', T.go, open ? { variant: 'primary' } : { disabled: true }); bigButton(6, H - L.bh - 4, W - 12, L.bh, 'BACK', back, { variant: 'ghost' }); return; }
  const fy = footerBand(L.bh + 12) + 6; bigButton(W - 106, fy, 100, L.bh, 'CHALLENGE', T.go, open ? { variant: 'primary' } : { disabled: true }); bigButton(6, fy, 70, L.bh, 'BACK', back, { variant: 'ghost' });
  if (W > 360) hintLine([['▲▼', 'floor'], ['◂▸', 'commander'], ['Z', 'challenge']], W / 2, fy + (L.bh - 7) / 2, { pill: false });
}
function towerInput(ev) {
  const T = SC.data; if (ev.type === 'key') {
    if (ev.key === 'up') { T.i = Math.min(TOWER.length - 1, T.i + 1); T.at = SC.t; Audio.sfx('cursor'); } else if (ev.key === 'down') { T.i = Math.max(0, T.i - 1); T.at = SC.t; Audio.sfx('cursor'); }
    else if (ev.key === 'left' || ev.key === 'right') vsCycle(T, { k: 'co', vals: S => S.cos }, ev.key === 'left' ? -1 : 1);
    else if (ev.key === 'ok' || ev.key === 'next') T.go(); else if (ev.key === 'back') { Audio.sfx('cancel'); goScene('quick'); } else if (ev.key === 'mute') Audio.toggle(); return;
  }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- the rank screen (Tower floors, the Safari Zone)
// A won floor: the rank letter stamps down over a sunburst, then SPEED, POWER and TECHNIQUE fill one after another and
// the score adds up; NEW RECORD when it beats the best. A lost floor shows what happened and offers a retry.
function rankDraw() {
  const R = SC.data, W = VIEW.w, H = VIEW.h, t = SC.t; rect(0, 0, W, H, '#0e0c10'); if (BACKDROP) drawBackdrop(BACKDROP, -((t * 6) % 200), 0, .74); SC.hits = [];
  if (R.kind === 'safari') { safariResultsDraw(R); return; }
  const S = R.S, F = TOWER[R.i], narrow = narrowView() || portraitView(), w = Math.min(narrow ? W - 12 : 360, W - 12), h = narrow ? 232 : 144, x = Math.round((W - w) / 2), y = Math.max(8, Math.round((H - 30 - h) / 2));
  const tok = unfold('rank', x, y, w, h, .25), col = COS[F.co].col;
  const p = panel(x, y, w, h, { header: 'TOWER ' + (R.i + 1) + 'F · ' + COS[F.co].name.toUpperCase(), headerRight: R.win ? 'CLEAR!' : 'DEFEAT', headerRightCol: R.win ? UI.green : UI.red, headerFill: shade(col, -.55) });
  const mx = narrow ? x + w / 2 : x + 52, my = narrow ? p.cy + 34 : p.cy + 46, rc = R.win ? RANK_COL[S.rank] : '#ff8080';
  // the medallion and the letter
  if (R.win && !REDUCED) { const sb = sunburst(40, 10, Math.floor(t * 5) % 4, rc); ctx.globalAlpha = .18; ctx.drawImage(sb, Math.round(mx - 40), Math.round(my - 40)); ctx.globalAlpha = 1; }
  circle(Math.round(mx), Math.round(my), 27, UI.inset); circle(Math.round(mx), Math.round(my), 26, shade(rc, -.55)); circle(Math.round(mx), Math.round(my), 22, shade(rc, -.7)); ellipseRing(Math.round(mx), Math.round(my), 24, 24, 1, rc);
  const at = .35, u = REDUCED ? 1 : clamp((t - at) / .25, 0, 1);
  if (u > 0) { const letter = R.win ? S.rank : '×', sc = 5 + (1 - easeOutBack(u, 2.5)) * 4; ctx.save(); ctx.globalAlpha = Math.min(1, u * 2); ctx.translate(Math.round(mx), Math.round(my)); ctx.scale(sc, sc); bigC(letter, 0, -4.5, rc, { outline: UI.inset }); ctx.restore(); }
  if (!R.rang && t >= at + .2) { R.rang = true; Audio.sfx(R.win ? (S.rank === 'S' ? 'levelup' : 'crit') : 'lose'); if (!REDUCED) shake(3); }
  if (R.win && R.record && t > at + .5) { const k = clamp((t - at - .5) / .25, 0, 1); ctx.globalAlpha = k; const rw = textWidth('NEW RECORD!') + 10; rrect(Math.round(mx - rw / 2), Math.round(my + 24), rw, 11, UI.gold, 1); textC('NEW RECORD!', mx, my + 26, '#3a2400'); ctx.globalAlpha = 1; if (!R.recSfx) { R.recSfx = true; Audio.sfx('chime'); } }
  // the three bars
  const bx = narrow ? x + 10 : x + 110, bw = narrow ? w - 20 : w - 122; let by = narrow ? my + 42 : p.cy + 6;
  const bars = [['SPEED', S.speed, S.days + ' days · par ' + F.par], ['POWER', S.power, S.kills + ' KO' + (S.kills === 1 ? '' : 's') + ' · ' + S.faints + ' lost'], ['TECHNIQUE', S.tech, S.faints ? S.faints + ' fainted' : 'nobody fainted']];
  bars.forEach(([label, v, note], k) => {
    const d = .8 + k * .45, val = R.win ? countUp('rank:' + label, v, .5, d) : 0; text(label, bx, by, UI.muted); textR(fitLabel(note, bw - 70), bx + bw - 24, by, UI.ink); textR(String(val), bx + bw, by, val >= 90 ? UI.gold : UI.ink); by += 9;
    bar(bx, by, bw, 5, val / 100, v >= 90 ? UI.gold : v >= 60 ? UI.green : UI.blue); by += 9;
    if (R.win && CLOCK.frame && t >= d && (R.tick || 0) <= k) { R.tick = k + 1; Audio.sfx('tick'); }
  });
  if (R.win) { const tot = countUp('rank:total', S.total, .6, 2.2); sectionLabel('SCORE', bx, by, bw - 50, UI.gold); textR(tot + ' / 300', bx + bw, by, UI.gold); by += 10; if (R.best && !R.record) text('Best ' + R.best.rank + ' · ' + R.best.total + ' pts', bx, by, UI.dim); }
  else { text('Your army was routed or your HQ fell.', bx, by, UI.ink); by += 10; text('Retry with another opening four.', bx, by, UI.muted); }
  // the commander has the last word
  { const line = R.win ? F.beaten : F.won, face = trainerFace(COS[F.co].tr), ly = y + h - 26, lx = x + 30, lw = w - 38, ls = wrap(line, lw - 10).slice(0, 2); rect(x + 8, ly, 20, 20, shade(col, -.4)); if (face) ctx.drawImage(face, x + 9, ly + 1); outline(x + 7, ly - 1, 22, 22, col);
    rrect(lx, ly, lw, 20, '#fff6d8', 2); for (let k = 0; k < 3; k++) px(lx - 1 - k, ly + 7 + k, '#fff6d8'); ls.forEach((l, k) => text(l, lx + 5, ly + (ls.length > 1 ? 2 : 6) + k * 9, '#3a2a18')); }
  unfoldEnd(tok);
  const bh = btnH(), next = R.win && R.i + 1 < TOWER.length, tower = () => { Audio.sfx('cancel'); startTower(R.i); }, nextFloor = () => { Audio.sfx('select'); startTower(R.i + 1, R.record && !R.best ? R.i + 1 : -1); }; // a first clear opens the next floor with its lights coming on
  const retry = () => { Audio.sfx('ok'); const T = { i: R.i, recs: loadRecords(), cos: coUnlocked(loadSave()), co: loadRecords().towerCo || 'you' }; if (!T.cos.includes(T.co)) T.co = 'you'; launchTowerFloor(T); };
  if (W < 300) { // phones: the way forward on its own row, the others under it
    footerBand(2 * (bh + 4) + 4); const r1 = H - 2 * (bh + 4), r2 = H - bh - 4, hw = Math.floor((W - 18) / 2);
    if (next) { bigButton(6, r1, W - 12, bh, 'NEXT FLOOR', nextFloor, { variant: 'primary' }); bigButton(6, r2, hw, bh, 'TOWER', tower, { variant: 'ghost' }); bigButton(12 + hw, r2, hw, bh, 'RETRY', retry); }
    else { bigButton(6, r1, W - 12, bh, 'RETRY', retry, { variant: 'primary' }); bigButton(6, r2, W - 12, bh, 'TOWER', tower, { variant: 'ghost' }); }
    return;
  }
  const fy = footerBand(bh + 12) + 6, n = next ? 3 : 2, bw2 = Math.min(100, Math.floor((W - 12 - (n - 1) * 6) / n)), x0 = Math.round((W - (n * bw2 + (n - 1) * 6)) / 2);
  bigButton(x0, fy, bw2, bh, 'TOWER', tower, { variant: 'ghost' }); bigButton(x0 + bw2 + 6, fy, bw2, bh, 'RETRY', retry, next ? {} : { variant: 'primary' });
  if (next) bigButton(x0 + 2 * (bw2 + 6), fy, bw2, bh, 'NEXT FLOOR', nextFloor, { variant: 'primary' });
}
function rankInput(ev) {
  const R = SC.data; if (ev.type === 'key') { if (ev.key === 'ok') { if (R.kind === 'safari') { Audio.sfx('ok'); goScene('quick'); } else { const nx = R.win && R.i + 1 < TOWER.length ? R.i + 1 : R.i; startTower(nx, nx !== R.i && R.record && !R.best ? nx : -1); } } else if (ev.key === 'back') { Audio.sfx('cancel'); goScene('quick'); } return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- the Safari Zone
// A catch race against Blue over eight days on a meadow thick with tall grass: wild Pokémon keep stepping out of it.
// Weaken one without knocking it out and throw a Safari Ball (twelve each). A catch scores by rarity; the higher score
// at the end of day eight wins, and every catch you make joins your collection. Blue's team can be fought too.
const SAFARI = { days: 8, balls: 12, cap: 9, chance: .7, tiers: [
  { name: 'Common', pts: 1, col: '#c8c8d8', w: 6, mons: [19, 16, 29, 32, 46, 48, 84, 102, 54, 118] },
  { name: 'Uncommon', pts: 3, col: '#5ee06a', w: 4, mons: [111, 49, 47, 85, 30, 33, 25] },
  { name: 'Rare', pts: 5, col: '#5aa8f0', w: 2, mons: [115, 128, 123, 127, 113] },
  { name: 'Very rare', pts: 8, col: '#ffd24a', w: 3, mons: [147] },
] };
function safariTier(num) { return SAFARI.tiers.find(t => t.mons.includes(num)) || SAFARI.tiers.find(t => t.mons.includes(LINE_ROOT[num])) || SAFARI.tiers[0]; }
// The wild pool with each species repeated by its tier's weight (about 60/28/10/3 per cent by tier).
function safariPool(level) { const out = []; for (const T of SAFARI.tiers) for (const n of T.mons) for (let k = 0; k < T.w; k++) out.push({ mon: n, level: Math.max(3, level - 3 + (k % 4)), ai: 'guard' }); return out; }
function safariMap(seed, level) {
  const w = 16, h = 11, r = mulberry32(seed * 13 + 5), noise = (x, y, s) => { const n = Math.sin((x * 12.9898 + y * 78.233 + s) * 43758.5453) * 1e4; return n - Math.floor(n); }, base = r() * 1000, rows = [];
  for (let y = 0; y < h; y++) { let row = ''; for (let x = 0; x < w; x++) { let v = 0; for (let o = 1; o <= 3; o++) { const sc = o * 2, fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; v += lerp(lerp(noise(x0, y0, base + o), noise(x0 + 1, y0, base + o), tx), lerp(noise(x0, y0 + 1, base + o), noise(x0 + 1, y0 + 1, base + o), tx), ty) / o; } v /= 1.83;
    row += x <= 1 || x >= w - 2 ? (v > .6 ? 'T' : '.') : v < .3 ? '~' : v < .34 ? 's' : v > .72 ? 'T' : v > .44 ? 't' : r() < .12 ? ',' : '.'; } rows.push(row); }
  const mid = Math.floor(h / 2), order = []; for (let y = 0; y < h; y++) for (let x = 0; x < 2; x++) order.push({ x, y }); order.sort((a, b) => Math.abs(a.y - mid) - Math.abs(b.y - mid) || a.x - b.x);
  const put = (x, y, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); }, deploy = order.slice(0, 6); for (const d of deploy) { put(d.x, d.y, '.'); put(w - 1 - d.x, d.y, '.'); }
  const units = [], taken = new Set(deploy.map(d => key(d.x, d.y)).concat(deploy.map(d => key(w - 1 - d.x, d.y))));
  coTeam('blue', level, 4, seed).forEach((e, i) => { const d = deploy[i]; units.push({ mon: e.num, level, x: w - 1 - d.x, y: d.y, team: 1, ai: 'aggro' }); });
  const pool = safariPool(level), grass = []; for (let y = 0; y < h; y++) for (let x = 3; x < w - 3; x++) if (rows[y][x] === 't') grass.push({ x, y });
  for (let i = 0; i < 8 && grass.length; i++) { const g = grass.splice(Math.floor(r() * grass.length), 1)[0]; if (taken.has(key(g.x, g.y))) continue; const d = pool[Math.floor(r() * pool.length)]; units.push({ mon: formAt(d.mon, d.level), level: d.level, x: g.x, y: g.y, team: 2, ai: 'guard' }); }
  return { name: 'Safari Zone', seed, objective: { type: 'safari', days: SAFARI.days }, rows, deploy, units, items: [], par: SAFARI.days, music: 'calm', turnLimit: SAFARI.days, wildPool: pool, wildCap: SAFARI.cap, wildChance: SAFARI.chance };
}
function startSafari() {
  const save = loadSave(); let party = save && save.party.length ? save.party : null, preset = false;
  if (!party) { preset = true; party = [partyUnit(25, 14), partyUnit(5, 14), partyUnit(8, 14), partyUnit(2, 14), partyUnit(133, 13), partyUnit(66, 13)]; }
  SAVE = save; const level = clamp(Math.round(party.reduce((a, p) => a + p.level, 0) / party.length), 5, 50), seed = Math.floor(Math.random() * 1000), map = safariMap(seed, level);
  // a small collection is topped up to four with loaners (plain stats, never kept)
  const team = party.concat(skirmishLoaners(party, level, 4 - party.length).map(l => Object.assign(partyUnit(l.num, l.level, 1), { loaner: true })));
  const ch = { title: 'Safari Zone', num: 0, label: 'SAFARI ZONE', level, slots: 4, par: SAFARI.days, map, rewards: {} };
  const P = { chapter: ch, party: team, captain: preset ? null : (migrateCaptain(SAVE), SAVE.captainPid), bag: { pokeball: SAFARI.balls }, deploy: [], preset, back: () => goScene('quick') }; autoDeploy(P);
  P.start = () => { const deployed = P.deploy.map(i => Object.assign({}, team[i], { pid: preset || i >= party.length ? null : i })); goScene('card', { chapter: ch, next: () => {
    BACKDROP = makeBackdrop(map);
    startBattle(map, deployed, { pokeball: SAFARI.balls }, { skirmish: true, safari: { days: SAFARI.days, score: [0, 0], catches: [[], []], balls: [SAFARI.balls, SAFARI.balls], preset }, seed: seed * 17 + 1, defer: true, cos: ['you', 'blue'], captain: preset ? { pid: null, root: 4, chapter: 8 } : { pid: SAVE.captainPid, root: SAVE.starter, chapter: 8 } });
    B.map.def = map; SC.data = { preset }; const go = () => { goScene('battle'); SC.data = { preset }; beginPhase(0, true); };
    if (PARAMS.has('nostory')) go(); else { goScene('battle'); startDialog([{ who: 'Blue', text: 'The Safari Zone! Eight days, twelve Safari Balls each. Whoever brings back the *rarest* haul wins.' }, { who: 'Blue', text: 'Knock one out and it counts for *nothing*, and a wounded one may *run off* at dawn. Try to keep up. Smell ya later!' }], go); }
  } }); };
  goScene('prep', P);
}
// Safari Pokémon are skittish: at dawn each wounded one may run off into the grass (a fifth of the time).
const SAFARI_FLEE = .2;
function safariFlee() { if (!B || !B.safari) return []; const out = []; for (const u of alive(2)) if (u.hp < u.maxHp && rnd() < SAFARI_FLEE) { u.hp = 0; u.fled = true; out.push(u); } return out; }
// A catch scores for its catcher, with a floating tally on the board.
function safariCatch(team, t) { const S = B.safari, T = safariTier(t.num); S.score[team] += T.pts; S.catches[team].push({ num: t.num, level: t.level, pts: T.pts }); if (typeof floatText === 'function') floatText(t.x * TILE + TILE / 2, t.y * TILE - 4, '+' + T.pts, T.col, { big: true, life: 1.4, outline: '#000', delay: .2 }); }
// An AI throw: the odds are settled now; the catch leaves the board after its animation (done), as the player's does.
function safariThrow(u, t) {
  const S = B.safari; if (!S || !t || t.hp <= 0 || t.team !== 2 || dist(u, t) !== 1) return null;
  if (u.team === 0) { if (!(B.bag.pokeball > 0)) return null; B.bag.pokeball--; } else { if (!(S.balls[u.team] > 0)) return null; S.balls[u.team]--; }
  const r = tryCapture(t, ITEMS.pokeball); u.acted = u.moved = true;
  return { ev: { type: 'capture', unit: t, ok: r.ok, shakes: r.shakes, from: { x: u.x, y: u.y }, ball: 'pokeball', team: u.team }, done: () => { if (!r.ok) return; t.hp = 0; t.captured = true; safariCatch(u.team, t); powerCharge(u.team, 15); } };
}
// The race, as the AI plays it: throw at a weakened wild Pokémon it can reach, weaken the most valuable one without
// knocking it out (a knockout scores nothing), fight the rival's team when the trade is good, or close in on the best
// catch on the map, keeping out of reach of what could knock it out.
function safariDecide(u) {
  if (!canTakeAction(u)) return null;
  const S = B.safari, balls = u.team === 0 ? (B.bag.pokeball || 0) : S.balls[u.team], wild = alive(2), rivals = B.units.filter(v => v.hp > 0 && v.team <= 1 && v.team !== u.team), threat = dangerZone(u.team);
  let best = null, score = -Infinity; const offer = (sc, d) => { if (sc > score) { score = sc; best = d; } };
  for (const n of reachable(u).values()) {
    if (!canStand(u, n.x, n.y)) continue; const danger = threat.has(key(n.x, n.y)) ? 3 + (u.hp < u.maxHp / 2 ? 6 : 0) : 0;
    let approach = 0; if (balls > 0) for (const t of wild) approach = Math.max(approach, safariTier(t.num).pts * 8 / (dist(n, t) + 1)); offer(approach - danger, { x: n.x, y: n.y });
    for (const t of wild) {
      const pts = safariTier(t.num).pts; if (balls <= 0) break;
      if (dist(n, t) === 1) offer(captureChance(t, ITEMS.pokeball) * pts * 16 + 3 - danger, { x: n.x, y: n.y, catch: true, target: t });
      for (const m of usableMoves(u, dist(n, t))) { const fc = forecast(u, t, m, n); let dealt = 0, taken = 0; for (const st of fc.strikes) if (st.nominal) { if (st.side === 'a') dealt += st.dmg * st.hit / 100; else taken += st.dmg * st.hit / 100; }
        const left = t.hp - dealt, ko = fc.koD || left < 1; offer((ko ? -pts * 12 : pts * 10 * dealt / t.maxHp * (left < t.maxHp / 2 ? 1.4 : 1)) - (fc.koA ? 50 : taken * .2) - danger, { x: n.x, y: n.y, target: t, move: m }); }
    }
    for (const t of rivals) for (const m of usableMoves(u, dist(n, t))) { const fc = forecast(u, t, m, n); let dealt = 0, taken = 0; for (const st of fc.strikes) if (st.nominal) { if (st.side === 'a') dealt += st.dmg * st.hit / 100; else taken += st.dmg * st.hit / 100; }
      offer((dealt - taken * .8 + (fc.koD ? 15 : 0) - (fc.koA ? 50 : 0)) * .45 - danger, { x: n.x, y: n.y, target: t, move: m }); }
  }
  return best;
}
// The end of the race: the record, and (from a campaign save) every catch joins the collection.
function safariEnd(result) {
  const S = B.safari, R = loadRecords(), best = R.safari || 0, record = S.score[0] > best; if (record) { R.safari = S.score[0]; writeRecords(R); }
  if (!S.preset && SAVE) { applyBattleToParty(); writeSave(); }
  clearSuspend(); goScene('rank', { kind: 'safari', result, score: S.score.slice(), catches: S.catches.map(c => c.slice()), best, record });
}
// Results: a scoreboard (both trainers, the totals racing up, the winner crowned), then both hauls with each catch's
// rarity and points; NEW RECORD when your score beats the best.
function safariResultsDraw(R) {
  const W = VIEW.w, H = VIEW.h, t = SC.t, narrow = narrowView() || portraitView(), w = Math.min(narrow ? W - 12 : 380, W - 12), colW = narrow ? w - 12 : Math.floor((w - 18) / 2), rowH = 14;
  const listH = narrow ? R.catches.reduce((a, c) => a + Math.max(1, c.length), 0) * rowH + 30 : Math.max(1, ...R.catches.map(c => c.length)) * rowH + 14, h = Math.min(H - 50, 16 + 44 + listH + 24), x = Math.round((W - w) / 2), y = Math.max(6, Math.round((H - 30 - h) / 2));
  const win = R.result === 'win', draw = R.result === 'draw', tok = unfold('safariRes', x, y, w, h, .25);
  const p = panel(x, y, w, h, { header: 'SAFARI ZONE · ' + SAFARI.days + ' DAYS', headerRight: win ? 'YOU WIN!' : draw ? 'DRAW' : 'BLUE WINS', headerRightCol: win ? UI.gold : draw ? UI.ink : UI.red, headerFill: '#2a4a1a' });
  // the scoreboard
  const sy = p.cy + 2, mid = x + w / 2; rrect(x + 6, sy, w - 12, 38, '#10200c', 2); outline(x + 6, sy, w - 12, 38, '#3a6a2a');
  [[0, 'red', 'YOU', '#8ab4ff'], [1, 'blue', 'BLUE', '#ff9a9a']].forEach(([k, tr, who, col]) => { const face = trainerFace(tr), side = k === 0 ? -1 : 1, fx = Math.round(mid + side * (w / 2 - 34)) - 9, won = k === 0 ? win : R.result === 'lose', tot = countUp('saf:tot' + k, R.score[k], .9, .4);
    rect(fx - 1, sy + 5, 20, 20, shade(col, -.5)); if (face) ctx.drawImage(face, fx, sy + 6); outline(fx - 2, sy + 4, 22, 22, won ? UI.gold : col); if (won && t > 1.3) drawCrown(fx + 5, sy - 1); textC(who, fx + 9, sy + 28, col);
    ctx.save(); ctx.translate(Math.round(mid + side * 30), sy + 8); ctx.scale(2, 2); bigC(String(tot), 0, 0, won || draw ? UI.gold : UI.muted, { outline: UI.inset }); ctx.restore(); });
  bigC('-', mid, sy + 13, UI.muted);
  if (!R.stamped && t > 1.3) { R.stamped = true; Audio.sfx(win ? 'levelup' : draw ? 'chime' : 'lose'); if (!REDUCED) shake(2); }
  // both hauls
  const side = (k, cx, cy) => { const list = R.catches[k], col = k === 0 ? '#8ab4ff' : '#ff9a9a';
    sectionLabel((k === 0 ? 'YOUR' : 'BLUE\'S') + ' CATCHES · ' + list.length, cx, cy, colW, col); cy += 11;
    if (!list.length) { text('Nothing caught', cx + 2, cy + 3, UI.dim); return cy + rowH; }
    list.forEach((c, i) => { const T = safariTier(c.num), a = clamp((appear('saf:' + k + ':' + i) - .3 - i * .08) / .2, 0, 1); if (a <= 0) { cy += rowH; return; } ctx.globalAlpha = a; const bob = !REDUCED && T.pts >= 5 ? Math.round(Math.sin(t * 5 + i) * 1) : 0;
      ctx.drawImage(monIcon(c.num, k === 1), cx - 3, cy - 4 + bob, 20, 15); text(fitLabel(DEX[c.num].name, colW - 74), cx + 19, cy + 1, UI.ink); text(T.name, cx + colW - 62, cy + 1, T.col); textR('+' + c.pts, cx + colW, cy + 1, T.col); if (T.pts >= 8 && !REDUCED) sparkle(cx + 14, cy - 2, 1 + Math.round(Math.abs(Math.sin(t * 4))), '#fff2b0'); ctx.globalAlpha = 1; cy += rowH; });
    return cy; };
  const ly = sy + 44; if (narrow) { const cy = side(0, x + 6, ly); side(1, x + 6, cy + 4); } else { side(0, x + 6, ly); side(1, x + 12 + colW, ly); }
  if (R.record && t > 1.6) { const k = clamp((t - 1.6) / .25, 0, 1); ctx.globalAlpha = k; const rw = textWidth('NEW RECORD · ' + R.score[0] + ' PTS') + 10; rrect(Math.round(W / 2 - rw / 2), y + h - 16, rw, 11, UI.gold, 1); textC('NEW RECORD · ' + R.score[0] + ' PTS', W / 2, y + h - 14, '#3a2400'); ctx.globalAlpha = 1; if (!R.recSfx) { R.recSfx = true; Audio.sfx('chime'); } }
  else if (R.best) textC('Best ' + R.best + ' pts', W / 2, y + h - 14, UI.dim);
  unfoldEnd(tok);
  const bh = btnH(), fy = footerBand(bh + 12) + 6, bw = Math.min(110, Math.floor((W - 18) / 2));
  bigButton(W / 2 - bw - 3, fy, bw, bh, 'QUICK BATTLE', () => { Audio.sfx('cancel'); goScene('quick'); }, { variant: 'ghost' }); bigButton(W / 2 + 3, fy, bw, bh, 'AGAIN', () => { Audio.sfx('select'); startSafari(); }, { variant: 'primary' });
}
