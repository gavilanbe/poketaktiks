// Player-facing captain choice, campaign lessons and shared power controls.
'use strict';
ITEMS.practiceball = { name: 'Practice Ball', kind: 'ball', rate: 1, col: '#f0c957', desc: 'Oak\'s free practice ball. Guaranteed at half HP.' };
function fitLabel(s, w) { if (textWidth(s) <= w) return s; while (s.length > 1 && textWidth(s + '...') > w) s = s.slice(0, -1); return s + '...'; }
function showJourney(lines, next) { goScene('journey', { lines, next }); }
function journeyDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data, w = Math.min(310, W - 16), x = (W - w) / 2;
  rect(0, 0, W, H, UI.bg); SC.hits = [];
  const rows = S.lines.slice(1).map((s, i) => wrap((i + 1) + '. ' + s, w - 24));
  const h = Math.min(H - 12, 50 + rows.reduce((n, a) => n + a.length * 10 + 5, 0)), y = (H - h) / 2;
  const p = panel(x, y, w, h, { header: fitLabel(S.lines[0], w - 16), headerFill: UI.panel2 });
  let yy = p.cy + 4;
  rows.forEach(ls => { ls.forEach(l => { text(l, x + 12, yy, UI.ink); yy += 10; }); yy += 5; });
  bigButton(x + 8, y + h - 27, w - 16, 20, 'LET\'S GO', () => { Audio.sfx('ok'); S.next(); }, { variant: 'primary' });
}
function journeyInput(ev) {
  if (ev.type === 'key' && (ev.key === 'ok' || ev.key === 'back')) { Audio.sfx('ok'); SC.data.next(); }
  else if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// Choosing a partner in Oak's lab: a window on the dusk, shelves, a wooden floor and a long table with three Poké Balls.
// The focused ball pops open and its Pokémon hops out onto the table; the card beside (or under) the lab says what kind of
// captain it makes. Tap a ball to look, CHOOSE to confirm.
const STARTER_ROLE = { 1: 'Controller · roots foes', 4: 'Striker · hits twice when faster', 7: 'Amphibious · at home in water' };
function drawLab(st, tableY) {
  const { x, y, w, h } = st, wallB = tableY + 4, r = mulberry32(88);
  rect(x, y, w, wallB - y, '#3a3468'); for (let yy = y; yy < wallB; yy += 8) hline(x, yy, w, '#403a72'); rect(x, wallB - 7, w, 7, '#2c2854'); hline(x, wallB - 7, w, '#4a4480');
  // the window on the left: the dusk sky from the title, a star or two, a frame with a cross
  const ww = Math.round(w * .3), wh = Math.round((wallB - y) * .5), wx = x + Math.round(w * .08), wy = y + Math.round((wallB - y) * .14);
  if (wh > 10) { for (let yy = 0; yy < wh; yy++) rect(wx, wy + yy, ww, 1, DUSK[Math.min(DUSK.length - 1, Math.floor(yy / wh * DUSK.length))]); px(wx + 5, wy + 3, '#ffffff'); px(wx + ww - 8, wy + 5, '#d8c8ff'); circle(wx + ww - 10, wy + wh - 6, 3, '#ffe39a');
    outline(wx - 1, wy - 1, ww + 2, wh + 2, '#8a6a4a'); outline(wx - 2, wy - 2, ww + 4, wh + 4, '#5a4030'); vline(wx + Math.round(ww / 2), wy, wh, '#8a6a4a'); hline(wx, wy + Math.round(wh / 2), ww, '#8a6a4a'); rect(wx - 3, wy + wh + 1, ww + 6, 2, '#6a4e38'); }
  // shelves with books on the right
  const sx = x + Math.round(w * .56), sw = Math.round(w * .36);
  for (let k = 0; k < 2; k++) { const sy = y + Math.round((wallB - y) * (.28 + k * .3)); if (sy + 2 > wallB - 8) break; rect(sx, sy, sw, 2, '#8a6a4a'); hline(sx, sy + 2, sw, '#4a3428'); let bx = sx + 2; while (bx < sx + sw - 4) { const bw = 2 + Math.floor(r() * 3), bh = 6 + Math.floor(r() * 5); rect(bx, sy - bh, bw, bh, ['#c04848', '#4878c0', '#58a058', '#d8a838', '#8a58b0'][Math.floor(r() * 5)]); px(bx, sy - bh, '#ffffff40'); bx += bw + 1; } }
  // the floor: planks with staggered seams
  rect(x, wallB, w, y + h - wallB, '#5a4038'); for (let yy = wallB + 3, row = 0; yy < y + h; yy += 5, row++) { hline(x, yy, w, '#4a3230'); for (let xx = x + (row % 2) * 13; xx < x + w; xx += 26) vline(xx, yy - 4, 4, '#4a3230'); }
}
function captainChoiceDraw() {
  const W = VIEW.w, H = VIEW.h, t = SC.t, wide = W >= 380 && W > H, bh = btnH(); SC.hits = [];
  rect(0, 0, W, H, '#120f2a');
  const top = screenTitle('CHOOSE YOUR PARTNER', H >= 240 ? 'Your partner becomes your captain' : null, 5), foot = H - bh - 10;
  const stage = wide ? { x: 6, y: top, w: Math.round(W * .54) - 6, h: foot - top - 4 } : { x: 6, y: top, w: W - 12, h: Math.max(64, Math.round((foot - top) * .48)) };
  const card = wide ? { x: stage.x + stage.w + 6, y: top + 4, w: W - stage.w - 18, h: foot - top - 10 } : { x: 8, y: stage.y + stage.h + 6, w: W - 16, h: foot - stage.y - stage.h - 12 };
  const big = stage.h >= 150 && stage.w >= 240 ? 2 : 1, tableY = stage.y + Math.round(stage.h * .72), gap = Math.min(96, Math.round(stage.w / 3.1));
  ctx.save(); ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip(); drawLab(stage, tableY);
  // the table
  const tx0 = stage.x + 8, tw = stage.w - 16; rect(tx0, tableY, tw, 5, '#c08a58'); hline(tx0, tableY, tw, '#e8b27a'); rect(tx0, tableY + 5, tw, 7, '#8a5a34'); hline(tx0, tableY + 11, tw, '#5a3a22'); rect(tx0 + 4, tableY + 12, 4, stage.y + stage.h - tableY - 12, '#6a4428'); rect(tx0 + tw - 8, tableY + 12, 4, stage.y + stage.h - tableY - 12, '#6a4428');
  if (SC.popAt == null) SC.popAt = -9; const popK = clamp((t - SC.popAt) / .35, 0, 1);
  STARTERS.forEach((n, i) => {
    const cx = Math.round(stage.x + stage.w / 2 + (i - 1) * gap), sel = SC.i === i, c = CAPTAINS[n], by = tableY;
    if (sel) { // light, the open ball and the Pokémon on the table
      const u = REDUCED ? 1 : easeOutBack(popK, 2.4), glowR = 16 * big + Math.round(Math.sin(t * 3) * 2);
      if (!REDUCED) { ctx.globalAlpha = .16; circle(cx, by - 14 * big, glowR, c.col); ctx.globalAlpha = .1; circle(cx, by - 14 * big, glowR + 6, '#ffffff'); ctx.globalAlpha = 1; for (let k = 0; k < 7; k++) { const a = t * 1.5 + k * .9, rr = 12 * big + ((t * 18 + k * 7) % (12 * big)); px(Math.round(cx + Math.cos(a) * rr), Math.round(by - 14 * big + Math.sin(a) * rr * .6), k % 2 ? '#ffffff' : shade(c.col, .4)); } }
      // the open ball: its top half flipped back, the bottom half on the table
      circle(cx + 7 * big, by - 3, 5, '#10133e'); circle(cx + 7 * big, by - 3, 4, '#e6343e'); rect(cx + 7 * big - 5, by - 3, 11, 4, '#f2eee6'); hline(cx + 7 * big - 5, by - 3, 11, '#10133e'); hline(cx + 7 * big - 4, by + 1, 9, '#10133e');
      requestAnim(n); requestBigSprite(n); const hop = REDUCED ? 0 : Math.round(Math.abs(Math.sin(t * 3.2)) * 2 * big), grow = Math.max(.3, Math.min(1.25, u)) * big;
      ctx.globalAlpha = .4; ellipse(cx, by + 1, 11 * big, 2, '#000'); ctx.globalAlpha = 1;
      if (animReady(n)) drawAnim(n, cx, by + 1 - hop, t, { sx: grow, sy: grow }); else drawBig(n, cx, by + 1 - hop, { sx: .45 * grow, sy: .45 * grow });
    } else { const wob = !REDUCED && (t + i) % 3 < .3 ? Math.round(Math.sin((t + i) * 40)) : 0; ctx.globalAlpha = .4; ellipse(cx, by + 1, 7, 2, '#000'); ctx.globalAlpha = 1; drawTitleBall(cx + wob, by - 6, 6, t + i); }
  });
  ctx.restore();
  STARTERS.forEach((n, i) => { const cx = Math.round(stage.x + stage.w / 2 + (i - 1) * gap); hit(cx - Math.round(gap / 2) + 1, stage.y, gap - 2, stage.h, () => { if (SC.i === i) confirmStarter(); else starterFocus(i); }, DEX[n].name.toUpperCase()); });
  // the card for the focused partner
  const n = STARTERS[SC.i], c = CAPTAINS[n], d = DEX[n], tok = unfold('starter' + SC.i, card.x, card.y, card.w, card.h, .18);
  const p = panel(card.x, card.y, card.w, card.h, { header: c.style, headerFill: shade(c.col, -.45), headerCol: '#ffffff', headerRight: 'CAPTAIN', headerRightCol: shade(c.col, .5), border: c.col });
  let y = p.cy; const x = card.x + 8, w = card.w - 16, room = card.y + card.h - 6;
  const line = (str, col, bigText2) => { if (y + (bigText2 ? 9 : 7) > room) return false; if (bigText2) bigText(fitLabel(str.toUpperCase(), w), x, y, col, { shadow: UI.inset }); else text(fitLabel(str, w), x, y, col); y += bigText2 ? 12 : 9; return true; };
  if (y + 9 <= room) { bigText(d.name.toUpperCase(), x, y, c.col, { shadow: UI.inset }); let bx = x + textWidth(d.name.toUpperCase(), BIG) + 6; for (const tp of d.types) { if (bx + 24 > x + w) break; bx += typeBadge(tp, bx, y, 24) + 2; } y += 12; }
  line(STARTER_ROLE[n], UI.muted);
  if (y + 30 <= room) { y += 3; sectionLabel('Team power', x, y, w, UI.gold); y += 10; }
  for (const [nm, dd] of [[c.name + ' (50)', c.normal], [c.superName + ' (100)', c.super]]) { if (!line(nm, UI.ink)) break; for (const l of wrap(dd, w - 6).slice(0, 2)) { if (y + 7 > room) break; text(l, x + 6, y, UI.muted); y += 9; } y += 2; }
  // base stats as bars, when there is room
  const stats = [['HP', d.base.hp], ['ATK', d.base.atk], ['DEF', d.base.def], ['SP.A', d.base.spa], ['SPE', d.base.spe]];
  if (y + 12 + stats.length * 9 <= room) { y += 2; sectionLabel('Strengths', x, y, w, UI.gold); y += 10; for (const [lb, v] of stats) { text(lb, x, y, UI.muted); bar(x + 28, y + 1, w - 28, 5, v / 110, v >= 60 ? c.col : shade(c.col, -.25)); y += 9; } }
  unfoldEnd(tok);
  const fy = foot + 3; bigButton(6, fy, 64, bh, 'BACK', () => { Audio.sfx('cancel'); goScene('title'); }, { variant: 'ghost' });
  const cw = Math.min(150, W - 82); bigButton(W - cw - 6, fy, cw, bh, 'CHOOSE ' + d.name.toUpperCase(), confirmStarter, { variant: 'primary', small: textWidth('CHOOSE ' + d.name.toUpperCase(), BIG) > cw - 8 });
}
function starterFocus(i) { if (SC.i === i) return; SC.i = i; SC.popAt = SC.t; Audio.sfx('catch'); }
function confirmStarter() { Audio.sfx('select'); pickStarter(STARTERS[SC.i]); }
function powerRibbonHeight() { return powerState(HT()) ? (powerState(1 - HT()) ? 38 : 27) : 0; }
// The power meter under the objective card: ten cells in the captain's colour with the 50 mark, READY / SUPER READY
// when a power can be bought (the cells glow and sparkle), the foe's charge as a thin second bar. Tapping it opens POWER.
function drawPowerStrip(r) {
  const s = powerState(HT()); if (!s || ['power', 'help', 'unitinfo', 'endmenu', 'territoryGuide', 'handoff'].includes(BT.mode)) return;
  const c = CAPTAINS[s.root], x = r.x, y = r.y + r.h + 2, h = powerRibbonHeight() - 2, cap = powerCaptain(HT());
  hudPanel(x, y, r.w, h, { fill: UI.panelDark, light: false, flat: true });
  const can = s.unlocked && cap && !s.active, sup = can && s.charge >= 100 && s.superUnlocked, rdy = can && s.charge >= 50;
  const state = !s.unlocked ? 'unlocks in ch.2' : !cap ? 'captain down' : s.active ? (s.active === 'super' ? c.superName : c.name) + ' ON' : sup ? 'SUPER READY!' : rdy ? 'READY!' : s.charge + '/100';
  drawCrown(x + 5, y + 4); text('POWER', x + 15, y + 4, rdy || s.active ? c.col : UI.ink); textR(fitLabel(state, r.w - 60), x + r.w - 6, y + 4, s.active ? UI.green : sup ? UI.gold : rdy ? c.col : UI.muted);
  // ten cells; the 50 mark is a gap
  const bx = x + 6, bw = r.w - 12, cw = (bw - 1) / 10, glow = !REDUCED && rdy ? .5 + .5 * Math.sin(BT.time * 6) : 0;
  for (let i = 0; i < 10; i++) { const cx0 = Math.round(bx + i * cw + (i >= 5 ? 1 : 0)), cx1 = Math.round(bx + (i + 1) * cw - 1 + (i >= 5 ? 1 : 0)), on = s.charge >= (i + 1) * 10, part = !on && s.charge > i * 10;
    rect(cx0, y + 14, cx1 - cx0, 5, UI.inset); const fillC = sup ? UI.gold : c.col;
    if (on) { rect(cx0 + 1, y + 15, cx1 - cx0 - 2, 3, fillC); hline(cx0 + 1, y + 15, cx1 - cx0 - 2, shade(fillC, .5)); if (glow && (sup || i < 5)) { ctx.globalAlpha = glow * .6; rect(cx0 + 1, y + 15, cx1 - cx0 - 2, 3, '#ffffff'); ctx.globalAlpha = 1; } }
    else if (part) { const f = Math.round((cx1 - cx0 - 2) * (s.charge - i * 10) / 10); rect(cx0 + 1, y + 15, f, 3, shade(fillC, -.2)); }
    else rect(cx0 + 1, y + 15, cx1 - cx0 - 2, 3, '#232646'); }
  if (rdy && !REDUCED) { const k = (BT.time * 1.3) % 1, sxp = bx + Math.round((sup ? bw : bw / 2) * k); sparkle(sxp, y + 16, Math.round(Math.sin(k * Math.PI) * 2), '#ffffff'); }
  const enemy = powerState(1 - HT());
  if (enemy) { const ec = CAPTAINS[enemy.root], eh = enemy.charge / 100; text(B.versus ? 'P' + (2 - HT()) : 'FOE', x + 6, y + 23, enemy.active ? UI.red : UI.muted); const ex = x + 26, ew = r.w - 32 - textWidth(enemy.active ? 'ON' : String(enemy.charge)) - 4; bar(ex, y + 24, ew, 4, eh, enemy.charge >= 50 ? UI.red : shade(ec.col, -.2)); textR(enemy.active ? 'ON' : String(enemy.charge), x + r.w - 6, y + 23, enemy.active || enemy.charge >= 50 ? UI.red : UI.muted); }
  HUD.hits.push({ x, y, w: r.w, h, label: 'POWER', run: () => { if (BT.mode === 'idle') openPowerMenu(); } });
}
function openPowerMenu() {
  if (!powerState(HT()) || BT.mode !== 'idle' || B.phase !== HT()) return;
  BT.autoEnd = 0; BT.powerIndex = 0; BT.mode = 'power'; Audio.sfx('menu');
}
function confirmPower() {
  const events = activatePower(HT(), BT.powerIndex === 1);
  if (!events) { Audio.sfx('error'); return; }
  BT.queue = events.map(ev => ({ kind: 'event', ev })); playQueue(() => { BT.mode = 'idle'; });
}
function powerMenuLayout() {
  const w = Math.min(300, VIEW.w - 12), x = (VIEW.w - w) / 2;
  const c = CAPTAINS[powerState(HT()).root], desc = [c.normal, c.super].map(s => wrap(s, w - 24));
  const row = Math.max(48, Math.max(...desc.map(a => a.length)) * 10 + 31);
  const duration = wrap('Until next own turn. No extra actions.', w - 16);
  const offset = 37 + duration.length * 10, h = offset + 28 + row * 2, y = Math.max(2, (VIEW.h - h) / 2);
  return { x, y, w, h, row, desc, duration, offset };
}
function drawPowerMenu() {
  const team = HT(), s = powerState(team); if (!s) { BT.mode = 'idle'; return; }
  const c = CAPTAINS[s.root], u = powerCaptain(team), r = powerMenuLayout(), { x, y, w, h, row } = r;
  dimScreen(.7); hudPanel(x, y, w, h, { header: 'TEAM POWER', headerRight: s.charge + '/100', headerRightCol: c.col, light: false });
  text(fitLabel((u ? u.name : DEX[s.root].name) + ' · ' + c.style, w - 16), x + 8, y + 19, c.col);
  r.duration.forEach((l, i) => text(l, x + 8, y + 30 + i * 10, UI.muted));
  for (let i = 0; i < 2; i++) {
    const yy = y + r.offset + i * row, why = powerBlock(team, i === 1), hot = BT.powerIndex === i;
    if (hot) rect(x + 5, yy - 2, w - 10, row - 3, UI.panel2);
    text(fitLabel((i ? c.superName : c.name) + ' · ' + (i ? '100' : '50'), w - 24), x + 12, yy + 2, hot ? c.col : UI.ink);
    r.desc[i].forEach((l, j) => text(l, x + 12, yy + 14 + j * 10, UI.ink));
    text(fitLabel(why || 'Z / tap: activate', w - 24), x + 12, yy + row - 14, why ? UI.muted : UI.green);
    HUD.hits.push({ x: x + 5, y: yy - 2, w: w - 10, h: row - 3, label: i ? 'SUPERPOWER' : 'NORMAL POWER', run: () => { if (BT.powerIndex !== i) { BT.powerIndex = i; Audio.sfx('cursor'); } else confirmPower(); } });
  }
  button(x + 8, y + h - 23, w - 16, 18, 'BACK', () => { BT.mode = 'idle'; Audio.sfx('cancel'); }, { variant: 'ghost' });
}
function powerInput(ev) {
  if (ev.type === 'key') {
    if (ev.key === 'back' || ev.key === 'power') { BT.mode = 'idle'; Audio.sfx('cancel'); }
    else if (['left', 'right', 'up', 'down'].includes(ev.key)) { BT.powerIndex = 1 - BT.powerIndex; Audio.sfx('cursor'); }
    else if (ev.key === 'ok') confirmPower();
    else if (ev.key === 'mute') Audio.toggle();
  } else if (ev.type === 'up') hudHit(ev.x, ev.y);
}
// The power cut-in, Advance Wars style: the screen darkens, a band in the captain's colour tears across on a slant with
// speed lines, the captain slides in large on the left, and the power's name slams down beside it with what it does.
function drawPowerBurst(q) {
  const e = q.ev, c = CAPTAINS[e.root], W = VIEW.w, H = VIEW.h, t = q.t, dur = q.dur, out = t > dur - .25 ? easeIn((t - (dur - .25)) / .25) : 0;
  const col = c.col, dark = shade(col, -.5), grow = REDUCED ? 1 : easeOutBack(clamp(t / .25, 0, 1), 1.6), bh = Math.round(Math.min(H * .46, 110) * clamp(grow, 0, 1.1) * (1 - out)), cy = Math.round(H / 2);
  ctx.globalAlpha = .6 * (1 - out); rect(0, 0, W, H, '#05041a'); ctx.globalAlpha = 1;
  if (bh > 2) { const top = cy - Math.round(bh / 2), slant = -.35;
    for (let y = 0; y < bh; y++) { const off = Math.round((y - bh / 2) * slant), v = y / bh; rect(off - 30, top + y, W + 60, 1, v < .15 ? shade(col, .25) : v > .85 ? dark : (y >> 1) % 5 === 0 ? shade(col, .08) : col); }
    rect(Math.round((-bh / 2) * slant) - 30, top - 2, W + 60, 2, '#ffffff'); rect(Math.round((bh / 2) * slant) - 30, top + bh, W + 60, 2, UI.inset);
    if (!REDUCED) for (let i = 0; i < 14; i++) { const ly = top + 3 + (i * 11) % Math.max(4, bh - 6), len = 24 + (i * 23) % 60, lx = W - ((t * (520 + i * 80) + i * 131) % (W + len * 2)); ctx.globalAlpha = .4; rect(Math.round(lx + (ly - cy) * slant), ly, len, 1, '#ffffff'); ctx.globalAlpha = 1; } }
  // the captain slides in from the left, big
  const u = e.unit, num = u ? (u.fx.showNum || u.num) : e.root, slide = REDUCED ? 0 : Math.round((1 - easeOut(clamp((t - .05) / .3, 0, 1))) * -W * .5) - Math.round(out * W * .6);
  const px0 = Math.round(W * (W > 300 ? .26 : .3)) + slide, base = cy + Math.round(bh / 2) - 4, spr = W > 300 && H > 220 ? 1 : .7; requestAnim(num); requestBigSprite(num);
  if (bh > 20) { ctx.save(); ctx.beginPath(); ctx.rect(0, cy - Math.round(bh / 2), W, bh); ctx.clip(); const k2 = bh >= 100 ? 2 : 1; if (animReady(num)) drawAnim(num, px0, base, BT.time, { sx: k2, sy: k2 }); else drawBig(num, px0, base, { sx: k2 / 2, sy: k2 / 2 }); ctx.restore(); }
  // the name slams down on the right, the effect under it
  const name = (e.superPower ? c.superName : c.name).toUpperCase() + '!', nw = textWidth(name, BIG), big = W >= nw * 2 + W * .5 ? 2 : 1, slam = REDUCED ? 0 : clamp(1 - (t - .3) / .14, 0, 1), sc = big + slam * 1.5, nx = Math.round(W * (W > 300 ? .66 : .62)) + Math.round(out * W);
  if (t > .3 || REDUCED) { if (e.superPower) textC('SUPER POWER', nx, cy - 26 - 4 * big, UI.gold, { outline: UI.inset }); ctx.save(); ctx.translate(nx, cy - Math.round(9 * sc / 2) - 6); ctx.scale(sc, sc); bigC(name, 0, 0, '#ffffff', { outline: UI.inset }); ctx.restore();
    ctx.globalAlpha = clamp((t - .45) / .15, 0, 1) * (1 - out); const desc = wrap(e.superPower ? c.super : c.normal, Math.min(W * .5, 190)); desc.slice(0, 2).forEach((l, i) => textC(l, nx, cy + 10 + i * 9, UI.ink, { outline: UI.inset })); textC(teamName(e.team), nx, cy - Math.round(bh / 2) + 5, shade(col, .6), { outline: UI.inset }); ctx.globalAlpha = 1; }
}
function drawCatchLesson(L) {
  const t = B.units.find(u => u.id === B.lesson.targetId); if (!t) return;
  const line = practiceReady(t) ? 'Caterpie: approach, then Catch.' : 'Weaken Caterpie to half HP.';
  const w = Math.min(VIEW.w - 12, textWidth(line) + 12), x = (VIEW.w - w) / 2, y = L.top.y + L.top.h + powerRibbonHeight() + 4;
  hudPanel(x, y, w, 15, { fill: UI.panelDark, light: false, flat: true }); textC(line, VIEW.w / 2, y + 4, UI.gold);
}
function drawOutposts() {
  for (const p of B.outposts || []) {
    const x = tileX(p.x), y = tileY(p.y), col = p.owner < 0 ? UI.gold : teamColor(p.owner);
    outline(x + 1, y + 1, TILE - 2, TILE - 2, col);
    if (p.progress) { rect(x + 3, y + TILE - 7, TILE - 6, 5, UI.inset); bar(x + 4, y + TILE - 6, TILE - 8, 3, p.progress / 20, col); }
  }
}

function territorySetupDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data, w = Math.min(330, W - 16), x = (W - w) / 2;
  S.captain = CAPTAINS[S.captain] ? S.captain : 7;
  rect(0, 0, W, H, UI.bg); SC.hits = [];
  screenTitle('TERRITORY', 'Three Bridges · same captain both sides', 6);
  const cw = Math.floor((w - 8) / 3), y = 40;
  STARTERS.forEach((n, i) => {
    const xx = x + i * (cw + 4), c = CAPTAINS[n], selected = S.captain === n;
    panel(xx, y, cw, 53, { fill: selected ? UI.panel2 : UI.panelDark, border: selected || SC.i === i ? c.col : UI.border2 });
    drawMon(n, xx + cw / 2, y + 31, {});
    textC(fitLabel(DEX[n].name, cw - 8), xx + cw / 2, y + 39, selected ? c.col : UI.ink);
    hit(xx, y, cw, 53, () => { S.captain = n; SC.i = i; Audio.sfx('cursor'); });
  });
  const c = CAPTAINS[S.captain]; textC(c.name + ' / ' + c.superName, W / 2, 102, c.col);
  const ls = wrap(c.normal, w - 8); ls.forEach((l, i) => textC(l, W / 2, 114 + i * 10, UI.ink));
  const by = H - 27, infoY = 118 + ls.length * 10;
  const info = ['3 start · 6 teammates · 5 on map', 'Capture HQ, or hold 2 centers for 3 turns.', 'Centers earn CP. Powers use a separate bar.'];
  if (H > 265) {
    textC('YOUR TEAM · 3 START / 3 RESERVE', W / 2, infoY, UI.gold);
    territoryRoster(S.captain).forEach(([num, cost], i) => {
      const cell = Math.floor(w / 2), xx = x + (i % 2) * cell, yy = infoY + 13 + Math.floor(i / 2) * 20;
      text(fitLabel(DEX[num].name, cell - 8), xx + 4, yy, UI.ink);
      text(i < 3 ? 'STARTS' : cost + ' CP', xx + 4, yy + 9, i < 3 ? UI.green : UI.muted);
    });
  }
  let iy = H > 265 ? infoY + 77 : infoY;
  const rules = H < 215 ? ['Same captain on both sides · HELP for rules'] : info;
  for (const s of rules) for (const l of wrap(s, w)) { if (iy + 8 < by - 3) textC(l, W / 2, iy, UI.muted); iy += 10; }
  const available = by - iy - 10;
  if (available > 45) {
    const bd = S.bd, scale = Math.min((w - 12) / bd.canvas.width, available / bd.canvas.height);
    const mw = Math.floor(bd.canvas.width * scale), mh = Math.floor(bd.canvas.height * scale), mx = Math.floor((W - mw) / 2), my = Math.floor(iy + 5 + (available - mh) / 2);
    outline(mx - 2, my - 2, mw + 4, mh + 4, UI.border2); ctx.drawImage(bd.canvas, mx, my, mw, mh);
  }
  bigButton(x, by, Math.floor(w * .3), 20, 'BACK', () => goScene('quick'), { variant: 'ghost', hot: SC.i === 3 });
  bigButton(x + Math.floor(w * .3) + 4, by, w - Math.floor(w * .3) - 4, 20, 'START', () => launchTerritory(S.seed, false, [S.captain, S.captain]), { variant: 'primary', hot: SC.i === 4 });
}
