// Player-facing captain choice, campaign lessons and shared power controls.
'use strict';
ITEMS.practiceball = { name: 'Practice Ball', kind: 'ball', rate: 1, col: '#f0c957', desc: 'Oak\'s free practice ball. Guaranteed at half HP.' };
function fitLabel(s, w) { if (textWidth(s) <= w) return s; while (s.length > 1 && textWidth(s + '...') > w) s = s.slice(0, -1); return s + '...'; }
function showJourney(lines, next) { trainerImg('oak'); goScene('journey', { lines, next }); }
// A lesson card: the captain in a portrait on the left (when there is room), the lesson title on a ribbon, and each tip
// sliding in after the one before with a numbered bullet; LET'S GO pulses once everything is on screen.
function journeyDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data, t = SC.t, portrait = W >= 300, w = Math.min(360, W - 16), x = Math.round((W - w) / 2);
  rect(0, 0, W, H, UI.bg); for (let y = 0; y < H; y += 2) { ctx.globalAlpha = .18 * y / H; rect(0, y, W, 2, '#2a2f78'); } ctx.globalAlpha = 1; SC.hits = [];
  const pw = portrait ? 64 : 0, tw = w - 20 - (pw ? pw + 8 : 0), rows = S.lines.slice(1).map(s2 => wrap(s2, tw - 16));
  const h = Math.min(H - 12, 44 + rows.reduce((n, a) => n + a.length * 10 + 5, 0) + 30), y = Math.round((H - h) / 2), tok = unfold('journey', x, y, w, h, .22);
  const p = panel(x, y, w, h, { header: fitLabel(S.lines[0], w - 16), headerFill: '#2a2470' });
  const cap = SAVE && SAVE.party && SAVE.party.length ? SAVE.party[SAVE.captainPid || 0].num : 25;
  const oak = trainerCanvas('oak', false, false); // Prof. Oak gives the lessons (his sprite once loaded, the captain until then)
  if (pw && oak) { const px0 = x + 10, py0 = p.cy + 2, ph = Math.min(70, h - (p.cy - y) - 36); portraitBg(px0, py0, pw, ph, 0); outline(px0 - 1, py0 - 1, pw + 2, ph + 2, UI.border2); ctx.save(); ctx.beginPath(); ctx.rect(px0, py0, pw, ph); ctx.clip(); ctx.drawImage(oak, px0 + Math.round((pw - 80) / 2), py0 + ph - 72 + (REDUCED ? 0 : Math.round(Math.abs(Math.sin(t * 3)))), 80, 80); ctx.restore(); }
  else if (pw) { const px0 = x + 10, py0 = p.cy + 2, ph = Math.min(70, h - (p.cy - y) - 36); portraitBg(px0, py0, pw, ph, 0); outline(px0 - 1, py0 - 1, pw + 2, ph + 2, UI.border2); requestAnim(cap); ctx.save(); ctx.beginPath(); ctx.rect(px0, py0, pw, ph); ctx.clip(); if (animReady(cap)) drawAnim(cap, px0 + pw / 2, py0 + ph - 3, t); else drawMon(cap, px0 + pw / 2, py0 + ph - 3, { outline: teamColor(0) }); ctx.restore(); if (SAVE) drawCrown(px0 + 2, py0 + 2); }
  let yy = p.cy + 4; const tx = x + 10 + (pw ? pw + 8 : 0);
  rows.forEach((ls, i) => { const k = REDUCED ? 1 : clamp((t - .25 - i * .18) / .25, 0, 1); if (k <= 0) { yy += ls.length * 10 + 5; return; } ctx.globalAlpha = k; const off = Math.round((1 - easeOut(k)) * 16);
    rrect(tx - 1 - off, yy - 2, 11, 11, UI.inset, 1); rrect(tx - off, yy - 1, 9, 9, UI.gold, 1); hline(tx + 1 - off, yy - 1, 7, '#fff2b0'); textC(String(i + 1), tx + 5 - off, yy, UI.goldDark);
    ls.forEach(l => { text(l, tx + 13 - off, yy, UI.ink); yy += 10; }); yy += 5; ctx.globalAlpha = 1; });
  unfoldEnd(tok);
  const ready = REDUCED || t > .25 + rows.length * .18, pulse = ready && !REDUCED ? Math.round(Math.abs(Math.sin(t * 4)) * 1) : 0;
  bigButton(x + 8, y + h - 26 - pulse, w - 16, 20, 'LET\'S GO', () => { Audio.sfx('ok'); S.next(); }, { variant: 'primary', hot: ready });
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
  const c = coOf(s), x = r.x, y = r.y + r.h + 2, h = powerRibbonHeight() - 2, cap = powerCaptain(HT());
  hudPanel(x, y, r.w, h, { fill: UI.panelDark, light: false, flat: true });
  const can = s.unlocked && cap && !s.active, sup = can && s.charge >= 100 && s.superUnlocked, rdy = can && s.charge >= 50;
  const state = !s.unlocked ? 'unlocks in ch.2' : !cap ? 'Ace down' : s.active ? (s.active === 'super' ? c.super.name : c.power.name) + ' ON' : sup ? 'SUPER READY!' : rdy ? 'READY!' : s.charge + '/100';
  const face = coTrainer(s) ? trainerFace(c.tr) : null; if (face) { ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 2, 12, 11); ctx.clip(); rect(x + 3, y + 2, 12, 11, shade(c.col, -.5)); ctx.drawImage(face, x + 3 - 3, y + 2 - 2); ctx.restore(); outline(x + 2, y + 1, 14, 13, c.col); } else drawCrown(x + 5, y + 4); text(coTrainer(s) ? fitLabel(c.name.toUpperCase(), 60) : 'POWER', x + 17, y + 4, rdy || s.active ? c.col : UI.ink); textR(fitLabel(state, r.w - 60), x + r.w - 6, y + 4, s.active ? UI.green : sup ? UI.gold : rdy ? c.col : UI.muted);
  // ten cells; the 50 mark is a gap
  const bx = x + 6, bw = r.w - 12, cw = (bw - 1) / 10, glow = !REDUCED && rdy ? .5 + .5 * Math.sin(BT.time * 6) : 0;
  for (let i = 0; i < 10; i++) { const cx0 = Math.round(bx + i * cw + (i >= 5 ? 1 : 0)), cx1 = Math.round(bx + (i + 1) * cw - 1 + (i >= 5 ? 1 : 0)), on = s.charge >= (i + 1) * 10, part = !on && s.charge > i * 10;
    rect(cx0, y + 14, cx1 - cx0, 5, UI.inset); const fillC = sup ? UI.gold : c.col;
    if (on) { rect(cx0 + 1, y + 15, cx1 - cx0 - 2, 3, fillC); hline(cx0 + 1, y + 15, cx1 - cx0 - 2, shade(fillC, .5)); if (glow && (sup || i < 5)) { ctx.globalAlpha = glow * .6; rect(cx0 + 1, y + 15, cx1 - cx0 - 2, 3, '#ffffff'); ctx.globalAlpha = 1; } }
    else if (part) { const f = Math.round((cx1 - cx0 - 2) * (s.charge - i * 10) / 10); rect(cx0 + 1, y + 15, f, 3, shade(fillC, -.2)); }
    else rect(cx0 + 1, y + 15, cx1 - cx0 - 2, 3, '#232646'); }
  if (rdy && !REDUCED) { const k = (BT.time * 1.3) % 1, sxp = bx + Math.round((sup ? bw : bw / 2) * k); sparkle(sxp, y + 16, Math.round(Math.sin(k * Math.PI) * 2), '#ffffff'); }
  const enemy = powerState(1 - HT());
  if (enemy) { const ec = coOf(enemy), eh = enemy.charge / 100; text(B.versus ? 'P' + (2 - HT()) : 'FOE', x + 6, y + 23, enemy.active ? UI.red : UI.muted); const ex = x + 26, ew = r.w - 32 - textWidth(enemy.active ? 'ON' : String(enemy.charge)) - 4; bar(ex, y + 24, ew, 4, eh, enemy.charge >= 50 ? UI.red : shade(ec.col, -.2)); textR(enemy.active ? 'ON' : String(enemy.charge), x + r.w - 6, y + 23, enemy.active || enemy.charge >= 50 ? UI.red : UI.muted); }
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
// The power menu: the captain in a portrait with the charge meter, then two power cards (side by side on wide screens,
// stacked on tall ones): name, cost as cells, what it does, and READY or why not. The focused card lifts; Z or a second
// tap activates it.
function powerMenuLayout() {
  const W = VIEW.w, H = VIEW.h, side = W >= 380, w = Math.min(side ? 400 : 300, W - 12), x = Math.round((W - w) / 2), s = powerState(HT()), c = coOf(s);
  const cw = side ? Math.floor((w - 22) / 2) : w - 16, desc = [c.power.text, c.super.text].map(t => wrap(t, cw - 14));
  const pas = c.passive ? wrap(powerPassiveText(s, c), w - 16).slice(0, 2) : [];
  const lines = Math.min(side ? 3 : 2, Math.max(...desc.map(d => d.length))), ch = 44 + lines * 9, head = 30 + (pas.length ? pas.length * 9 + 4 : 0);
  const h = head + (side ? ch : ch * 2 + 5) + 32, y = Math.max(2, Math.round((H - h) / 2));
  const cards = [0, 1].map(i => side ? { x: x + 8 + i * (cw + 6), y: y + head, w: cw, h: ch } : { x: x + 8, y: y + head + i * (ch + 5), w: cw, h: ch });
  return { x, y, w, h, cards, desc, lines, side, pas };
}
// The passive, with whose aura carries it: "Ace Onix: Rock and Ground allies take 15% less".
function powerPassiveText(s, c) { const u = powerCaptain(HT()); return (coTrainer(s) ? 'Ace ' + (u ? u.name : DEX[COS[s.co].ace].name) + ': ' : '') + c.passive.text; }
function drawPowerMenu() {
  const team = HT(), s = powerState(team); if (!s) { BT.mode = 'idle'; return; }
  const c = coOf(s), u = powerCaptain(team), r = powerMenuLayout(), { x, y, w, h } = r, t = BT.time;
  dimScreen(.72); const tok = unfold('powermenu', x, y, w, h, .2);
  hudPanel(x, y, w, h, { light: false, fill: '#161a44', border: c.col });
  // the captain, its style and the charge
  const pnum = u ? (u.fx.showNum || u.num) : s.root, portrait = coTrainer(s) ? trainerFace(c.tr) : null; requestAnim(pnum); ctx.save(); ctx.beginPath(); ctx.rect(x + 6, y + 5, 26, 22); ctx.clip(); portraitBg(x + 6, y + 5, 26, 22, team); if (portrait) ctx.drawImage(portrait, x + 10, y + 6, 18, 18); else drawMon(pnum, x + 19, y + 27, { outline: c.col }); ctx.restore(); drawCrown(x + 7, y + 6);
  const mw = Math.min(90, w - 150), mx = x + w - 8 - mw; textR(s.charge + '/100', x + w - 8, y + 7, UI.gold); bar(mx, y + 18, mw, 5, s.charge / 100, c.col);
  bigText(fitBig(coTrainer(s) ? c.name.toUpperCase() : 'TEAM POWER', x + w - 8 - textWidth(s.charge + '/100') - 6 - (x + 38)), x + 38, y + 7, c.col, { shadow: UI.inset }); text(fitLabel(coTrainer(s) ? c.style : (u ? u.name : DEX[s.root].name) + ' · ' + c.style, mx - x - 44), x + 38, y + 18, UI.muted);
  // the passive runs full width under the portrait, wrapped rather than cut
  if (r.pas.length) { hline(x + 6, y + 29, w - 12, UI.inset); r.pas.forEach((l, j) => text(l, x + 8, y + 32 + j * 9, '#c8d0ff')); }
  for (let i = 0; i < 2; i++) {
    const card = r.cards[i], why = powerBlock(team, i === 1), hot = BT.powerIndex === i, lift = hot && !REDUCED ? -2 : 0, cx = card.x, cy = card.y + lift, ready = !why;
    rrect(cx + 1, card.y + 3, card.w, card.h, UI.shadow, 2); rrect(cx, cy, card.w, card.h, hot ? UI.gold : UI.inset, 2); rrect(cx + 1, cy + 1, card.w - 2, card.h - 2, hot ? '#2c2f78' : '#1e2050', 1); hline(cx + 2, cy + 1, card.w - 4, hot ? '#4a50a8' : '#2e3066');
    rect(cx + 1, cy + 1, 3, card.h - 2, i ? UI.gold : c.col);
    const name = (i ? c.super.name : c.power.name).toUpperCase(); bigText(fitLabel(name, card.w - 16), cx + 8, cy + 5, i ? UI.gold : c.col, { shadow: UI.inset });
    const cells = i ? 10 : 5, cwid = Math.max(3, Math.floor((card.w - 20) / 10) - 1); for (let k = 0; k < cells; k++) { const on = s.charge >= (k + 1) * 10; rect(cx + 8 + k * (cwid + 1), cy + 17, cwid, 4, UI.inset); if (on) rect(cx + 9 + k * (cwid + 1), cy + 18, cwid - 2, 2, i ? UI.gold : c.col); }
    text((i ? 100 : 50) + '', cx + 10 + cells * (cwid + 1), cy + 16, UI.muted);
    r.desc[i].slice(0, r.lines).forEach((l, j) => text(l, cx + 8, cy + 25 + j * 9, UI.ink));
    const sy = cy + card.h - 12; if (ready) { const pulse = REDUCED ? 1 : .6 + .4 * Math.abs(Math.sin(t * 5)); ctx.globalAlpha = pulse; text(VIEW.touch ? 'READY · tap again' : 'READY · Z', cx + 8, sy, UI.green); ctx.globalAlpha = 1; if (hot && !REDUCED) sparkle(cx + card.w - 8, cy + 6 + Math.round(Math.sin(t * 4)), 2, '#fff2b0'); } else text(fitLabel(why, card.w - 16), cx + 8, sy, UI.dim);
    HUD.hits.push({ x: card.x, y: card.y, w: card.w, h: card.h, label: i ? 'SUPERPOWER' : 'NORMAL POWER', run: () => { if (BT.powerIndex !== i) { BT.powerIndex = i; Audio.sfx('cursor'); } else confirmPower(); } });
  }
  unfoldEnd(tok);
  button(x + 8, y + h - 24, w - 16, 18, 'BACK', () => { BT.mode = 'idle'; Audio.sfx('cancel'); }, { variant: 'ghost' });
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
  const e = q.ev, cs = { co: e.co, root: e.root }, c = coOf(cs), W = VIEW.w, H = VIEW.h, t = q.t, dur = q.dur, out = t > dur - .25 ? easeIn((t - (dur - .25)) / .25) : 0;
  const col = c.col, dark = shade(col, -.5), grow = REDUCED ? 1 : easeOutBack(clamp(t / .25, 0, 1), 1.6), bh = Math.round(Math.min(H * .46, 110) * clamp(grow, 0, 1.1) * (1 - out)), cy = Math.round(H / 2);
  ctx.globalAlpha = .6 * (1 - out); rect(0, 0, W, H, '#05041a'); ctx.globalAlpha = 1;
  if (bh > 2) { const top = cy - Math.round(bh / 2), slant = -.35;
    for (let y = 0; y < bh; y++) { const off = Math.round((y - bh / 2) * slant), v = y / bh; rect(off - 30, top + y, W + 60, 1, v < .15 ? shade(col, .25) : v > .85 ? dark : (y >> 1) % 5 === 0 ? shade(col, .08) : col); }
    rect(Math.round((-bh / 2) * slant) - 30, top - 2, W + 60, 2, '#ffffff'); rect(Math.round((bh / 2) * slant) - 30, top + bh, W + 60, 2, UI.inset);
    if (!REDUCED) for (let i = 0; i < 14; i++) { const ly = top + 3 + (i * 11) % Math.max(4, bh - 6), len = 24 + (i * 23) % 60, lx = W - ((t * (520 + i * 80) + i * 131) % (W + len * 2)); ctx.globalAlpha = .4; rect(Math.round(lx + (ly - cy) * slant), ly, len, 1, '#ffffff'); ctx.globalAlpha = 1; } }
  // the commander slides in from the left, large and cut by the band; on a Super Power their Ace roars behind them
  const u = e.unit, num = u ? (u.fx.showNum || u.num) : e.root, slide = REDUCED ? 0 : Math.round((1 - easeOut(clamp((t - .05) / .3, 0, 1))) * -W * .5) - Math.round(out * W * .6);
  const px0 = Math.round(W * (W > 300 ? .26 : .3)) + slide, base = cy + Math.round(bh / 2) - 4, trainer = trainerCanvas(c.tr, false, false); requestAnim(num); requestBigSprite(num);
  if (bh > 20) { ctx.save(); ctx.beginPath(); ctx.rect(0, cy - Math.round(bh / 2), W, bh); ctx.clip(); const k2 = bh >= 100 ? 2 : 1;
    if (trainer) { const roar = e.superPower && !REDUCED ? clamp((t - .32) / .12, 0, 1) : 0, ax = px0 + Math.round(64 * k2 * .5) + 10, ak = k2 + (roar > 0 && roar < 1 ? .5 : 0);
      if (e.superPower) { if (roar > 0 && roar < 1 && !REDUCED) { ctx.globalAlpha = .5 * (1 - roar); circle(ax, base - 30 * k2, Math.round(40 * k2 * roar + 10), '#ffffff'); ctx.globalAlpha = 1; } ctx.globalAlpha = .9; if (animReady(num)) drawAnim(num, ax, base + 4, BT.time * 2, { sx: ak, sy: ak }); else drawBig(num, ax, base + 4, { sx: ak / 2, sy: ak / 2 }); ctx.globalAlpha = 1; }
      const size = 80 * k2 + (bh >= 100 ? 16 : 0); ctx.drawImage(trainer, px0 - Math.round(size / 2), cy - Math.round(bh / 2) - Math.round(size * .06), size, size); }
    else if (animReady(num)) drawAnim(num, px0, base, BT.time, { sx: k2, sy: k2 }); else drawBig(num, px0, base, { sx: k2 / 2, sy: k2 / 2 });
    ctx.restore(); }
  // the name slams down on the right, the effect under it
  const name = (e.superPower ? c.super.name : c.power.name).toUpperCase() + '!', nw = textWidth(name, BIG), big = W >= nw * 2 + W * .5 ? 2 : 1, slam = REDUCED ? 0 : clamp(1 - (t - .3) / .14, 0, 1), sc = big + slam * 1.5, nx = Math.round(W * (W > 300 ? .66 : .62)) + Math.round(out * W);
  if (t > .3 || REDUCED) { if (e.superPower) textC('SUPER POWER', nx, cy - 26 - 4 * big, UI.gold, { outline: UI.inset }); ctx.save(); ctx.translate(nx, cy - Math.round(9 * sc / 2) - 6); ctx.scale(sc, sc); bigC(name, 0, 0, '#ffffff', { outline: UI.inset }); ctx.restore();
    ctx.globalAlpha = clamp((t - .45) / .15, 0, 1) * (1 - out); const desc = wrap(e.superPower ? c.super.text : c.power.text, Math.min(W * .5, 190)); desc.slice(0, 2).forEach((l, i) => textC(l, nx, cy + 10 + i * 9, UI.ink, { outline: UI.inset })); textC(coTrainer(cs) ? c.name.toUpperCase() : teamName(e.team), nx, cy - Math.round(bh / 2) + 5, shade(col, .6), { outline: UI.inset }); ctx.globalAlpha = 1; }
}
function drawCatchLesson(L) {
  const t = B.units.find(u => u.id === B.lesson.targetId); if (!t) return;
  const line = practiceReady(t) ? 'Caterpie: approach, then Catch.' : 'Weaken Caterpie to half HP.';
  const w = Math.min(VIEW.w - 12, textWidth(line) + 12), x = (VIEW.w - w) / 2, y = L.top.y + L.top.h + powerRibbonHeight() + 4;
  hudPanel(x, y, w, 15, { fill: UI.panelDark, light: false, flat: true }); textC(line, VIEW.w / 2, y + 4, UI.gold);
}
function drawOutposts() {
  if (!B.war) return;
  for (const p of B.war.props) {
    const x = tileX(p.x), y = tileY(p.y), col = p.owner < 0 ? UI.gold : teamColor(p.owner);
    if (p.kind === 'outpost') outline(x + 1, y + 1, TILE - 2, TILE - 2, col);
    if (p.ch === 'K' && p.owner >= 0) drawFlag(x + TILE - 8, y + 2, p.owner, Math.floor(BT.time * 6 + p.x) % 2);
    if (p.progress) { rect(x + 3, y + TILE - 7, TILE - 6, 5, UI.inset); bar(x + 4, y + TILE - 6, TILE - 8, 3, p.progress / 20, col); }
  }
}

// Conquest setup: pick the captain (both sides lead with the same one), see the six teammates (three start, three wait as
// reserves with their cost), the three rules, and the Three Bridges map. Controls: the captain cards, BACK, START.
function territorySetupDraw() {
  const W = VIEW.w, H = VIEW.h, S = SC.data, t = SC.t, bh = btnH(); S.captain = CAPTAINS[S.captain] ? S.captain : 7; rect(0, 0, W, H, UI.bg); SC.hits = [];
  drawBackdrop(S.bd, (W - S.bd.canvas.width) / 2 - t * 4, (H - S.bd.canvas.height) / 2, .82);
  const top = screenTitle('CONQUEST', H >= 240 ? (W >= 220 ? 'Three Bridges · centers, points and reserves' : 'Three Bridges') : null, 5), by = H - bh - 6, wide = W >= 420;
  const colW = wide ? Math.min(250, Math.floor((W - 20) / 2)) : Math.min(W - 12, 300), x0 = wide ? Math.round(W / 2 - colW - 4) : Math.round((W - colW) / 2);
  // captains
  const cw = Math.floor((colW - 8) / 3), chh = H >= 260 ? 50 : 38, cy0 = top + 2;
  STARTERS.forEach((n, i) => { const xx = x0 + i * (cw + 4), c = CAPTAINS[n], sel = S.captain === n, focus = SC.i === i;
    panel(xx, cy0, cw, chh, { fill: sel ? UI.panel2 : UI.panelDark, border: sel ? c.col : focus ? UI.gold : UI.border2, flat: true });
    requestAnim(n); const hop = sel && !REDUCED ? Math.round(Math.abs(Math.sin(t * 5)) * 2) : 0; if (chh >= 50 && animReady(n)) { ctx.save(); ctx.beginPath(); ctx.rect(xx + 3, cy0 + 3, cw - 6, chh - 16); ctx.clip(); drawAnim(n, xx + cw / 2, cy0 + chh - 13 - hop, t + i, { sx: 1, sy: 1 }); ctx.restore(); } else drawMon(n, xx + cw / 2, cy0 + chh - 12 - hop, { outline: sel ? c.col : null });
    textC(fitLabel(c.name, cw - 6), xx + cw / 2, cy0 + chh - 11, sel ? c.col : UI.muted);
    hit(xx, cy0, cw, chh, () => { S.captain = n; SC.i = i; Audio.sfx('catch'); }); });
  let y = cy0 + chh + 6; const c = CAPTAINS[S.captain];
  if (y + 9 < by - 4) { textC(fitLabel(c.normal, colW), x0 + colW / 2, y, UI.ink, { outline: UI.inset }); y += 10; }
  if (y + 9 < by - 4 && H >= 260) { textC(fitLabel('Super ' + c.superName + ': ' + c.super, colW), x0 + colW / 2, y, c.col, { outline: UI.inset }); y += 12; } else y += 2;
  // the six: who starts, who waits and what each costs
  const rosterX = wide ? x0 + colW + 8 : x0, rosterW = wide ? colW : colW; let ry = wide ? cy0 : y;
  const roster = territoryRoster(S.captain), cellW = Math.floor((rosterW - 4) / 3), cellH = 24;
  if (ry + 12 + cellH * 2 < by - 4) { sectionLabel('Your six', rosterX, ry, rosterW, UI.gold); ry += 10;
    roster.forEach((num, i) => { const cost = warCost(num, TERRITORY.level); const xx = rosterX + (i % 3) * (cellW + 2), yy = ry + Math.floor(i / 3) * (cellH + 2), starts = i < 3; rrect(xx, yy, cellW, cellH, starts ? '#1c3a6a' : '#1c1d3c', 1); drawMon(num, xx + 14, yy + cellH - 1, { outline: starts ? teamColor(0) : null }); text(starts ? 'START' : money(cost), xx + 28, yy + 4, starts ? UI.green : UI.gold); text(fitLabel(ROLES[roleFor(DEX[num])].name, cellW - 30), xx + 28, yy + 13, UI.muted); });
    ry += (cellH + 2) * 2 + 4; if (!wide) y = ry; }
  // the rules, one line each
  const rules = [['flag', 'Take the enemy HQ, or', UI.gold], ['flag', 'hold 2 of 3 middle centers 3 turns', UI.gold], ['ball', 'Centers pay ₽1000 a day: deploy from the PC', UI.info]];
  let rY = wide ? ry : y; const rX = wide ? rosterX : x0, rW = wide ? rosterW : colW;
  for (const [ic, s2, col] of rules) { if (rY + 9 > by - 4) break; iconAt(ic, rX, rY - 1, col); text(fitLabel(s2, rW - 12), rX + 12, rY, UI.ink); rY += 11; }
  // the map, when there is room left in the left column
  const mapTop = wide ? y + 2 : rY + 4, avail = by - 6 - mapTop;
  if (avail > 50) { const bd = S.bd, sc = Math.min(colW / bd.canvas.width, avail / bd.canvas.height), mw = Math.floor(bd.canvas.width * sc), mh = Math.floor(bd.canvas.height * sc), mx = (wide ? x0 : x0) + Math.floor((colW - mw) / 2), my = mapTop + Math.floor((avail - mh) / 2);
    rect(mx - 2, my - 2, mw + 4, mh + 4, UI.inset); ctx.drawImage(bd.canvas, mx, my, mw, mh); outline(mx - 1, my - 1, mw + 2, mh + 2, UI.border2); }
  bigButton(x0, by, Math.floor(colW * .3), bh, 'BACK', () => goScene('quick'), { variant: 'ghost', hot: SC.i === 3 });
  bigButton(x0 + Math.floor(colW * .3) + 4, by, (wide ? colW * 2 + 8 : colW) - Math.floor(colW * .3) - 4, bh, 'START', () => launchTerritory(S.seed, false, [S.captain, S.captain]), { variant: 'primary', hot: SC.i === 4 });
}

// ---------------------------------------------------------------- the briefing before a front
// Who holds this front and what they said, the mission (goal, level, par, the enemy forces and the wild Pokémon), and
// who commands your side: the Tactician, or a Gym Leader freed on the route. PREPARE picks the squad.
function briefChapter(idx) { if (SAVE) migrateCaptain(SAVE); const cos = coUnlocked(SAVE); goScene('brief', { idx, cos, co: SAVE && cos.includes(SAVE.co) ? SAVE.co : 'you' }); }
function briefGo(S) { if (SAVE) { SAVE.co = S.co; writeSave(); } Audio.sfx('select'); prepChapter(S.idx); }
function briefDraw() {
  const S = SC.data, ch = CHAPTERS[S.idx], W = VIEW.w, H = VIEW.h, t = SC.t, narrow = narrowView() || portraitView(), bh = btnH(); if (!S.bd) S.bd = makeBackdrop(ch.map);
  rect(0, 0, W, H, UI.bg); drawBackdrop(S.bd, (W - S.bd.canvas.width) / 2 - t * 3, (H - S.bd.canvas.height) / 2, .8); SC.hits = [];
  const top = screenTitle('FRONT ' + ch.num + ' · ' + ch.title.toUpperCase(), narrow ? null : objectiveTextFor(ch.map.objective, ch.map), 4), foot = narrow ? H - 2 * (bh + 4) - 8 : footerBand(bh + 12);
  const co = ch.co ? COS[ch.co] : null, sp = ch.foe ? SPEAKERS[ch.foe] : null, as = co ? null : { tr: sp ? sp.tr : 'rocketgrunt', name: ch.foe || 'Rocket', col: sp ? sp.col : UI.red };
  const lw = narrow ? W - 12 : Math.min(250, Math.floor(W * .42)), lx = 6, ly = top + 2, cardW = narrow ? 70 : 84, cardH = narrow ? 60 : 76;
  // the enemy commander and their words
  const fp = panel(lx, ly, lw, narrow ? cardH + 18 : Math.min(foot - 6 - ly, cardH + (co ? 110 : 44)), { header: co ? 'ENEMY COMMANDER' : 'ENEMY TRAINER', headerFill: shade(co ? co.col : as.col, -.55) });
  coCard(lx + 6, fp.cy, cardW, cardH, co ? ch.co : 'you', 1, null, { as, tag: 'FOE', pop: t });
  const qx = lx + 12 + cardW, qw = lw - (qx - lx) - 8, ql = wrap('"' + (ch.brief || '') + '"', qw - 8).slice(0, Math.floor((cardH - 6) / 9)); rrect(qx, fp.cy + 2, qw, ql.length * 9 + 8, '#fff6d8', 2); outline(qx, fp.cy + 2, qw, ql.length * 9 + 8, UI.inset); for (let k = 0; k < 3; k++) px(qx - 1 - k, fp.cy + 10 + k, '#fff6d8');
  ql.forEach((l, k) => { const a = REDUCED ? 1 : clamp((t - .3 - k * .25) / .2, 0, 1); ctx.globalAlpha = a; text(l, qx + 4, fp.cy + 6 + k * 9, '#3a2a18'); ctx.globalAlpha = 1; });
  const foes0 = ch.map.units.filter(u => u.team == null || u.team === 1), lead = co && (foes0.find(u => u.mon === co.ace) || foes0.find(u => u.boss) || foes0[0]); // who wears their crown on this front
  if (!narrow && co) { let y = fp.cy + cardH + 8; const c = coOf({ co: ch.co }); sectionLabel('HOW THEY FIGHT', lx + 8, y, lw - 16, co.col); y += 11;
    for (const [k, v] of [['Ace', DEX[lead ? lead.mon : co.ace].name], ['Passive', c.passive.text], ['Power', c.power.name + ': ' + c.power.text], ['Super', c.super.name + ': ' + c.super.text]]) { if (y + 9 > fp.y + fp.h - 4) break; text(k, lx + 8, y, UI.muted); const ls = wrap(v, lw - 62); ls.slice(0, 2).forEach((l, i) => text(l, lx + 52, y + i * 9, k === 'Super' ? UI.gold : UI.ink)); y += Math.min(2, ls.length) * 9 + 3; } }
  else if (!narrow) { const y = fp.cy + cardH + 10; wrap('A local trainer paid by Team Rocket. No commander powers yet: those start at Mt. Moon.', lw - 16).forEach((l, i) => text(l, lx + 8, y + i * 9, UI.muted)); }
  // the mission
  const mx = narrow ? 6 : lx + lw + 6, my = narrow ? ly + cardH + 24 : ly, mw = narrow ? W - 12 : W - mx - 6, mh = foot - 6 - my;
  const mp = panel(mx, my, mw, mh, { header: 'MISSION', headerRight: 'Lv ' + ch.level + ' · par ' + ch.par + ' days', headerRightCol: UI.gold }); let y = mp.cy;
  const goal = objectiveTextFor(ch.map.objective, ch.map).replace('Objective: ', ''); iconAt('flag', mx + 6, y - 1, UI.gold); text(fitLabel(goal[0].toUpperCase() + goal.slice(1), mw - 22), mx + 17, y, UI.ink); y += 12;
  const foes = ch.map.units.filter(u => u.team == null || u.team === 1), wild = ch.map.units.filter(u => u.team === 2), rocket = ch.map.war && ch.map.war.owners ? Object.keys(ch.map.war.owners).length : 0, per = Math.max(1, Math.floor((mw - 12) / 20));
  const row = (label, list, col, flip) => { if (!list.length || y + 26 > my + mh - 4) return; sectionLabel(label, mx + 8, y, mw - 16, col); y += 10; list.slice(0, per).forEach((n, k) => { const bob = !REDUCED && k === Math.floor(t * 3) % Math.min(per, list.length) ? -1 : 0; ctx.drawImage(monIcon(n, flip), mx + 4 + k * 20, y + bob, 24, 18); if (k === 0 && label.startsWith('ENEMY') && co) drawCrown(mx + 17 + k * 20, y); }); y += 20; };
  row('ENEMY FORCES · ' + foes.length, (lead ? [lead.mon] : []).concat(foes.filter(u => u !== lead).map(u => u.mon)), '#ff9a9a', true); // their Ace first
  if (rocket && y + 9 <= my + mh - 4) { text(fitLabel((rocket > 1 ? rocket + ' Rocket centers send ' : 'A Rocket center sends ') + (co ? co.name + '\'s' : 'their') + ' reinforcements: take ' + (rocket > 1 ? 'them' : 'it') + '!', mw - 16), mx + 8, y, UI.red); y += 12; }
  const allies = ch.map.units.filter(u => u.team === 3); row('ALLIES · FIGHTING WITH YOU', allies.map(u => u.mon), '#a0f0b0', false);
  row('WILD POKéMON', wild.map(u => u.mon), '#fff0a0', true);
  if (SAVE && y + 9 <= my + mh - 4) { text(fitLabel('Your collection: ' + SAVE.party.length + ' · ' + ch.slots + ' open the battle, the rest wait in the PC Box', mw - 16), mx + 8, y, UI.muted); y += 12; }
  // your commander
  if (y + 16 <= my + mh - 2) { if (S.cos.length > 1) { vsRuleRows(S, mx + 4, y, mw - 8, 14, [{ k: 'co', label: 'YOUR COMMANDER', vals: X => X.cos, show: v => v === 'you' ? 'Tactician' : COS[v].name }], 0); y += 16; if (S.co !== 'you' && y + 9 <= my + mh - 4) { text(fitLabel(COS[S.co].name + ' leads: ' + DEX[COS[S.co].ace].name + ' joins your team', mw - 16), mx + 8, y, UI.info); y += 10; } }
    else { text(fitLabel('Your commander: the Tactician. Freed Gym Leaders can lead too.', mw - 16), mx + 8, y + 2, UI.dim); y += 13; } }
  // the battlefield: your deploy tiles and center, the Rocket-held ones, every Pokémon on it
  const room = my + mh - 6 - y; if (room >= 40) { const sc = Math.min((mw - 16) / S.bd.canvas.width, room / S.bd.canvas.height), pw = Math.floor(S.bd.canvas.width * sc), ph = Math.floor(S.bd.canvas.height * sc), px0 = mx + Math.round((mw - pw) / 2), py0 = y + 2;
    rect(px0 - 2, py0 - 2, pw + 4, ph + 4, UI.inset); ctx.drawImage(S.bd.canvas, px0, py0, pw, ph); drawWarPreview(ch.map, S.bd, px0, py0, pw, ph, 0); outline(px0 - 1, py0 - 1, pw + 2, ph + 2, UI.border2); }
  const back = () => { Audio.sfx('cancel'); openRoute({ sel: S.idx }); };
  if (narrow) { footerBand(2 * (bh + 4) + 4); bigButton(6, H - 2 * (bh + 4), W - 12, bh, 'PREPARE', () => briefGo(S), { variant: 'primary' }); bigButton(6, H - bh - 4, W - 12, bh, 'ROUTE', back, { variant: 'ghost' }); return; }
  const fy = foot + 6; bigButton(W - 96, fy, 90, bh, 'PREPARE', () => briefGo(S), { variant: 'primary' }); bigButton(6, fy, 70, bh, 'ROUTE', back, { variant: 'ghost' });
  if (W > 360) hintLine(S.cos.length > 1 ? [['◂▸', 'commander'], ['Z', 'prepare']] : [['Z', 'prepare'], ['X', 'route']], W / 2, fy + (bh - 7) / 2, { pill: false });
}
function briefInput(ev) {
  const S = SC.data; if (ev.type === 'key') { if (ev.key === 'left' || ev.key === 'right') { if (S.cos.length > 1) vsCycle(S, { k: 'co', vals: X => X.cos }, ev.key === 'left' ? -1 : 1); } else if (ev.key === 'ok' || ev.key === 'next') briefGo(S); else if (ev.key === 'back') { Audio.sfx('cancel'); openRoute({ sel: S.idx }); } else if (ev.key === 'mute') Audio.toggle(); return; }
  if (ev.type === 'up') { const h = hitAt(ev.x, ev.y); if (h) h.run(); }
}

// ---------------------------------------------------------------- the prologue
// A new journey opens on a town at night: the Poké Center's PC sign flickers dead red in the rain while Prof. Oak and
// Bill explain what Team Rocket did and what a Tactician is, before the walk to the lab and the choice of a partner.
const PROLOGUE = [
  { who: 'Prof. Oak', text: 'You made it through the rain. Good. Listen closely: *Kanto has a problem*.' },
  { who: 'Bill', side: 1, text: 'Team Rocket hijacked my *Pokémon Storage System*. Every Poké Center is locked, and every Pokémon stored in a PC is out of reach.' },
  { who: 'Prof. Oak', text: 'Trainers without their Pokémon cannot fight back. But a *Tactician* can command any Pokémon linked to their PC Box.' },
  { who: 'Bill', side: 1, text: 'Free a Poké Center and it reconnects the PC around it. From there you *deploy* Pokémon from your Box, and every Center you hold *pays funds* each day.' },
  { who: 'Prof. Oak', text: 'Catch wild Pokémon and they wait in your Box, ready to fight. And the Gym Leaders... Rocket is *blackmailing* them. Free their towns and they will command beside you.' },
  { who: 'Bill', side: 1, text: 'Somebody has to lead this. Oak says it should be you.' },
  { who: 'Prof. Oak', text: 'Every Tactician needs a partner. Come to the lab and *choose yours*.' },
];
function prologueStage(d) {
  const W = VIEW.w, H = VIEW.h, t = d.T, hz = Math.round(H * .5), gy = Math.round(H * .78), S = sceneFor('town', W, H, hz, gy, 5, 'center'), drift = REDUCED ? 0 : Math.round(Math.sin(t * .15) * 8);
  ctx.drawImage(S.sky, -SCENE_PAD + drift * .2, 0); ctx.drawImage(S.far, -SCENE_PAD + drift * .4, 0); ctx.drawImage(S.mid, -SCENE_PAD + drift, 0); ctx.drawImage(S.ground, -SCENE_PAD + drift, 0);
  // night falls over it, the Center's sign flickers red (the PC is down), rain
  ctx.globalAlpha = .55; rect(0, 0, W, H, '#0a0c2e'); ctx.globalAlpha = 1;
  const flick = REDUCED ? .5 : (Math.sin(t * 9) > .2 || Math.sin(t * 23) > .7 ? .9 : .25), b = S.fx.building || { x: W / 2 + SCENE_PAD, y: hz + 2 }, cx = Math.round(b.x - SCENE_PAD + drift), cy = b.y - 20; ctx.globalAlpha = .22 * flick; circle(cx, cy, 30, '#ff3040'); ctx.globalAlpha = .12 * flick; circle(cx, cy, 52, '#ff3040'); ctx.globalAlpha = 1;
  const sign = 'PC OFFLINE', sw = textWidth(sign) + 8; rrect(cx - sw / 2, cy - 5, sw, 11, '#1a0610', 1); textC(sign, cx, cy - 3, flick > .5 ? '#ff5a6a' : '#6a2030');
  drawWeather('rain', W, H, t);
  const cap = 'KANTO · THE NIGHT THE PCs WENT DARK', a = REDUCED ? 1 : clamp(t / .8, 0, 1) * clamp((6 - t) / 1, 0, 1); if (a > 0) { ctx.globalAlpha = a; bigC(cap, W / 2, 18, '#ffe2a8', { outline: '#0a0820' }); ctx.globalAlpha = 1; }
}
function startPrologue(next) { trainerImg('oak'); trainerImg('bill'); startDialog(PROLOGUE, next, { stage: prologueStage }); Audio.playMusic('calm'); }
