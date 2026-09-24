// ============================================================================
// menus.js — the battle's command menus and dialogs. One renderer serves them all: a header that says whose menu it is
// (the unit with its HP, the day with the war chest, the PC), rows with a coloured icon chip (or the Pokémon itself in
// the PC), a value, a badge or a lamp on the right, groups with breathing room, a highlight that glides to the chosen
// row with a Poké Ball cursor beside it, the row's explanation in the footer (in red when it cannot be used), and a pop
// when a menu opens. Decisions that end a turn or a battle go through a confirmation dialog.
// ============================================================================
'use strict';
// Chip colours by icon: warm for actions, cool for information, grey for leaving.
const MENU_COL = { sword: '#d8503c', flag: '#e0a020', ball: '#e04848', skill: '#4aa0e0', wait: '#6c6c8c', end: '#d23c3c', skull: '#9a4ab8', help: '#3a8ad8', note: '#3aa870', vs: '#d8a030', run: '#7a7a8a', x: '#5a5a6a', play: '#3aa870', map: '#3a8ad8', crown: '#e0b030' };
function fitBig(s, w) { s = String(TRX(s)).toUpperCase(); if (rawTextWidth(s, BIG) <= w) return trNote(s); while (s.length > 1 && rawTextWidth(s + '.', BIG) > w) s = s.slice(0, -1); return trNote(s + '.'); }
function menuMetrics() { const touch = VIEW.touch || narrowView(); return { rh: touch ? 18 : 16, gap: 5 }; }
function menuKind() { const m = BT.menu; return m.kind || (BT.mode === 'menu' ? 'action' : 'list'); }

// ---------------------------------------------------------------- the menus
// A unit's commands after it moved: what it can do from here, each with what it would come to.
function openActionMenu(u) {
  const items = [], tg = seenTargets(u);
  if (tg.length) { // the best that attacking could do from here: a KO on someone?
    let ko = false; for (const t of tg) for (const mv of usableMoves(u, dist(u, t))) { const fc = forecast(u, t, mv, u); if (fc.koD) ko = true; }
    items.push({ id: 'attack', label: 'Attack', icon: 'sword', right: TR(tg.length > 1 ? '{0} targets' : '{0} target', tg.length), badge: ko ? { text: 'KO!', col: '#e83c3c' } : null, sub: ko ? 'One of them can be knocked out from here' : 'Choose a target and a move; the forecast shows both sides' });
  }
  const wildAdj = B.units.filter(v => v.hp > 0 && v.team === 2 && dist(v, u) === 1); const canBuy = !!(B.war && B.war.funds[u.team] >= WAR.ball), hasBall = wildAdj.some(isPracticeTarget) || (B.bag.pokeball || 0) > 0 || canBuy;
  if (wildAdj.length && hasBall) { const best = Math.max(...wildAdj.map(t => captureChance(t, isPracticeTarget(t) ? ITEMS.practiceball : ITEMS.pokeball))); items.push({ id: 'catch', label: 'Catch', icon: 'ball', right: Math.round(best * 100) + '%', sub: wildAdj.some(isPracticeTarget) ? TR('Oak\'s practice ball') : (B.bag.pokeball > 0 ? TR('Throw a Poké Ball · {0} left', B.bag.pokeball) : TR('Buy a Poké Ball · {0}', money(WAR.ball))) + ' · ' + TR('the catch goes to your PC Box') }); }
  if (B.map.objective.type === 'seize' && B.map.seize && u.x === B.map.seize.x && u.y === B.map.seize.y && !warProperty(u.x, u.y)) items.unshift({ id: 'seize', label: 'Seize', icon: 'flag', badge: { text: 'WIN', col: UI.gold }, sub: 'Win the map!' });
  if (B.war && !warCaptureBlock(u)) { const p = warProperty(u.x, u.y), now = p.captor === u.id ? p.progress : 0, next = Math.min(WAR.capture, now + warCaptureGain(u)), done = next >= WAR.capture;
    items.unshift({ id: 'property', label: 'Capture', icon: 'flag', right: now + '→' + next + '/20', badge: done ? { text: p.kind === 'hq' ? 'WIN' : 'TAKE', col: p.kind === 'hq' ? UI.gold : '#5ee06a' } : null, sub: TRX(p.name) + (p.kind === 'hq' ? ' · ' + TR('take their base and win') : p.kind === 'center' ? ' · ' + TR('pays {0} a day, deploys, heals', money(B.war.income)) : '') + (done ? '' : ' · ' + TR('leaving resets it')) }); }
  // the role skill: always listed so the player learns it exists; greyed with the reason when it cannot be used now
  if (u.skill && !u.skill.passive) { const why = skillBlock(u); const n = why ? 0 : skillTargetsAt(u).length; items.push({ id: 'skill', label: u.skill.name, icon: 'skill', col: ROLES[u.role].col, off: !!why, right: why ? null : u.skill.target === 'self' ? null : TR(n > 1 ? '{0} targets' : '{0} target', n), sub: why ? u.skill.menu + ' (' + TRX(why) + ')' : u.skill.menu + (u.skill.target === 'self' ? '' : ' · ' + TR(n > 1 ? '{0} targets' : '{0} target', n)) + (u.skill.cd ? ' · ' + cooldownText(u.skill) : '') }); }
  items.push({ id: 'wait', label: 'Wait', icon: 'wait', sub: 'End this Pokémon\'s turn here' });
  BT.menu = { kind: 'action', items, i: 0 }; BT.mode = 'menu'; BT.cx = u.x; BT.cy = u.y;
}
// The day menu: end the turn, the PC and the commander, what you can see, how battles play, leaving. Toggles switch in
// place (their lamp says how they stand); things that open something else show a chevron.
function openEndMenu(keepIndex = 0) {
  const team = HT(), ready = alive(team).filter(u => !u.acted).length, s = powerState(team), items = [];
  items.push({ id: 'endturn', group: 0, label: 'End Turn', icon: 'end', right: ready ? TR('{0} ready', ready) : TR('all done'), sub: TR(B.versus ? 'Pass to the other trainer' : 'Pass to the enemy') + (ready ? ' · ' + TR(ready > 1 ? '{0} Pokémon can still act' : 'One Pokémon can still act', ready) : '') });
  if (warHasBox(team)) items.push({ id: 'pc', group: 1, label: 'PC Box', icon: 'ball', right: money(B.war.funds[team]), more: true, sub: 'Send Pokémon from your Box to your HQ or a free center' });
  if (s) { const c = coOf(s), can = !powerBlock(team, false), sup = !powerBlock(team, true); items.push({ id: 'power', group: 1, label: coTrainer(s) ? TR('{0}\'s Power', c.name) : 'Team Power', icon: 'skill', col: c.col, right: s.charge + '/100', badge: sup ? { text: 'SUPER', col: UI.gold } : can ? { text: 'READY', col: '#5ee06a' } : null, more: true, sub: TR('{0} at 50 · {1} at 100', c.power.name, c.super.name) }); }
  items.push({ id: 'danger', group: 2, label: 'Danger zones', icon: 'skull', lamp: !!BT.showDanger, sub: 'Show every tile the foe can hit next turn' });
  items.push({ id: 'help', group: 2, label: 'Help', icon: 'help', more: true, sub: 'Controls and rules' });
  items.push({ id: 'scene', group: 3, label: 'Battle scene', icon: 'vs', right: BATTLE_PREF_LABEL[PREF.battle], sub: 'Full duel, quick duel or on the map: Z switches' });
  items.push({ id: 'mute', group: 3, label: 'Sound', icon: 'note', lamp: !Audio.muted, sub: 'Music and effects' });
  items.push({ id: 'retreat', group: 4, label: B.versus ? 'Forfeit' : 'Retreat', icon: 'run', sub: B.versus ? 'Concede the arena (asks first)' : 'Give up this battle (asks first)' });
  BT.mode = 'endmenu'; BT.menu = { kind: 'main', items, i: clamp(keepIndex, 0, items.length - 1) };
}
// The PC: deploy a Pokémon from the side's Box onto a free center it owns (without a center given, pick the center
// first). Ready Pokémon come first, then the ones it cannot afford, then the recovering and the ones already out.
function openDeployMenu(p) {
  const team = HT(), W = B.war; BT.boxNew = false; BT.sel = null; BT.autoEnd = 0; BT.mode = 'endmenu';
  const sites = warDeploySites(team); if (!p && sites.length === 1 && !unitAt(sites[0].x, sites[0].y)) p = sites[0]; // one place to deploy: straight to the PC
  if (!p) { BT.menu = { kind: 'sites', title: 'DEPLOY WHERE?', i: 0, items: sites.map(q => ({ id: 'site:' + W.props.indexOf(q), label: q.name, icon: 'flag', off: !!unitAt(q.x, q.y), more: !unitAt(q.x, q.y), sub: unitAt(q.x, q.y) ? 'Occupied: move that Pokémon first' : 'Open the PC here · arrivals act next turn' })) };
    const k = BT.menu.items.findIndex(it => !it.off); if (k >= 0) BT.menu.i = k; return; }
  BT.deploySite = p; BT.cx = p.x; BT.cy = p.y; keepCursorVisible();
  const rows = W.box[team].map((e, i) => { const why = warDeployBlock(team, i, p), cost = warEntryCost(e), rank = e.state === 'field' ? 3 : e.recovery ? 2 : W.funds[team] < cost ? 1 : 0;
    return { rank, i, it: { id: 'deploy:' + i, group: rank, mon: e.num, label: TRX(e.nick || DEX[e.num].name) + ' Lv' + e.level, right: e.state === 'field' ? TR('OUT') : e.recovery ? TR('{0}d', e.recovery) : e.fresh ? TR('FREE') : money(e.cost), rightCol: e.state === 'field' ? UI.dim : e.recovery ? UI.red : e.fresh ? UI.green : W.funds[team] < cost ? UI.red : UI.gold, off: !!why, sub: (why ? why + ' · ' : '') + ROLES[roleFor(DEX[e.num])].name + ' · ' + DEX[e.num].types.map(typeName).join('/') + (why ? '' : ' · ' + TR('acts next turn')) } }; });
  rows.sort((a, b) => a.rank - b.rank || a.i - b.i);
  BT.menu = { kind: 'pc', title: 'PC BOX', i: 0, items: rows.map(r => r.it), pc: { team, p, cache: {} } };
  const k = BT.menu.items.findIndex(it => !it.off); if (k >= 0) BT.menu.i = k;
}
function warMenuAction(it) {
  if (!B.war || !(it.id === 'pc' || it.id.startsWith('site:') || it.id.startsWith('deploy:'))) return false;
  if (it.off) { Audio.sfx('error'); return true; }
  const from = BT.menu && BT.menu.kind, keep = BT.menu && BT.menu.i;
  if (it.id === 'pc') { Audio.sfx('ok'); openDeployMenu(); if (from === 'main') BT.menu.back = () => openEndMenu(keep); }
  else if (it.id.startsWith('site:')) { Audio.sfx('ok'); const back = BT.menu.back; openDeployMenu(B.war.props[+it.id.slice(5)]); BT.menu.back = () => { openDeployMenu(); BT.menu.back = back; }; }
  else { const u = warDeploy(HT(), +it.id.slice(7), BT.deploySite); if (!u) { Audio.sfx('error'); return true; } u.fx.alpha = 0; BT.menu = null; BT.queue = [{ kind: 'event', ev: { type: 'spawn', unit: u, deploy: true } }]; playQueue(() => { BT.mode = 'idle'; }); }
  return true;
}
// The wheel walks a menu one row per notch (a trackpad's stream of small deltas adds up to a notch), without wrapping.
function menuWheel(dy) { const m = BT.menu; BT.wheelAcc = (Math.sign(dy) === Math.sign(BT.wheelAcc || 0) ? BT.wheelAcc : 0) + dy; if (Math.abs(BT.wheelAcc) < 40) return; const j = clamp(m.i + Math.sign(BT.wheelAcc), 0, m.items.length - 1); BT.wheelAcc = 0; if (j !== m.i) { m.i = j; Audio.sfx('menu'); } }
function menuNav(dir) { const m = BT.menu; if (!m) return; m.i = (m.i + dir + m.items.length) % m.items.length; Audio.sfx('menu'); }
function activateMenu() {
  const m = BT.menu; const it = m.items[m.i]; if (!it) return;
  if (warMenuAction(it)) return;
  if (it.off) { Audio.sfx('error'); return; }
  if (BT.mode === 'menu') { menuChoose(it.id); return; }
  if (BT.mode !== 'endmenu') return;
  switch (it.id) {
    case 'endturn': Audio.sfx('ok'); confirmEndTurn(); break;
    case 'power': Audio.sfx('ok'); BT.mode = 'idle'; openPowerMenu(); break;
    case 'danger': BT.showDanger = !BT.showDanger; Audio.sfx(BT.showDanger ? 'ok' : 'cancel'); openEndMenu(m.i); break; // toggles switch in place
    case 'scene': cyclePref('battle'); Audio.sfx('menu'); openEndMenu(m.i); break;
    case 'mute': Audio.toggle(); Audio.sfx('ok'); openEndMenu(m.i); break;
    case 'help': Audio.sfx('ok'); BT.mode = 'help'; BT.helpPage = 0; BT.helpOffset = 0; break;
    case 'retreat': Audio.sfx('menu'); confirmRetreat(); break;
    default: Audio.sfx('cancel'); BT.mode = 'idle';
  }
}

// ---------------------------------------------------------------- layout and hit testing
// Width from the widest row; rows keep a gap between groups; a long list scrolls to keep the chosen row in view.
function menuRect() {
  const m = BT.menu, M = menuMetrics(), rh = M.rh, kind = menuKind(), big = kind === 'action';
  let wmax = 0; for (const it of m.items) { const lw = big ? textWidth(it.label.toUpperCase(), BIG) : textWidth(it.label), rw = it.right ? textWidth(it.right) + 6 : 0, bw = it.badge ? textWidth(it.badge.text) + 10 : 0, extra = (it.lamp != null ? 16 : 0) + (it.more ? 8 : 0) + (it.off ? 8 : 0); wmax = Math.max(wmax, (it.mon ? 30 : 24) + lw + 10 + rw + bw + extra + 6); }
  const L = hudLayout(), stack = L.stack && BT.mode !== 'endmenu'; // on phones a unit's commands sit full width above the bar
  const headH = kind === 'action' ? 26 : 17, w = stack ? VIEW.w - 8 : Math.min(VIEW.w - 8, Math.max(kind === 'action' ? 140 : 164, Math.ceil(wmax)));
  const subLines = m.items.reduce((n, it) => Math.max(n, it.sub ? Math.min(3, wrap(it.sub, w - 16).length) : 0), 0), foot = subLines ? subLines * 9 + 7 : 0;
  const offs = []; let yy = 0; m.items.forEach((it, i) => { if (i && (it.group || 0) !== (m.items[i - 1].group || 0)) yy += M.gap; offs.push(yy); yy += rh; }); const listH = yy;
  const room = Math.max(rh * 3, (stack ? L.bar.y - 14 : VIEW.h - 38) - headH - foot - 12), bodyH = Math.min(listH, room);
  const scroll = listH > bodyH ? clamp(offs[m.i] + rh / 2 - bodyH / 2, 0, listH - bodyH) : 0;
  const h = headH + 4 + bodyH + 4 + (foot ? foot + 2 : 0), top = headH + 4;
  let x, y;
  if (stack) { x = 4; y = Math.max(4, L.bar.y - h - 10); }
  else if (BT.mode === 'endmenu') { x = Math.round(VIEW.w / 2 - w / 2); y = Math.round(VIEW.h / 2 - h / 2); }
  else { const tx = toScreenX(tileX(BT.cx) - FX.shakeX), ty = toScreenY(tileY(BT.cy) - FX.shakeY), ts = TILE * BT.zoom; x = tx + ts + 6; y = ty - 4; if (x + w > VIEW.w - 4) x = tx - w - 6; }
  if (!stack) { x = clamp(x, 4, VIEW.w - w - 4); y = clamp(y, 30, Math.max(30, VIEW.h - h - 4)); }
  return { x, y, w, h, headH, top, foot, subLines, rh, offs, listH, bodyH, scroll, kind, big, listY: y + top, rows: m.items.length, start: 0 };
}
// Which row is under a point: an index, -2 inside the menu but between rows (header, footer), -1 outside.
function menuHit(px2, py) {
  const r = menuRect(); if (px2 < r.x || px2 >= r.x + r.w || py < r.y || py >= r.y + r.h) return -1;
  const rel = py - r.listY + r.scroll; if (py < r.listY || py >= r.listY + r.bodyH) return -2;
  for (let i = 0; i < r.offs.length; i++) if (rel >= r.offs[i] && rel < r.offs[i] + r.rh) return i;
  return -2;
}

// ---------------------------------------------------------------- drawing
function drawMenu() {
  const m = BT.menu, r = menuRect(), t = BT.time, kind = r.kind; if (BT.mode === 'endmenu') dimScreen(.45);
  const key = BT.mode + ':' + kind + ':' + (m.title || '') + ':' + m.items.length; if (BT.menuKey !== key) { BT.menuKey = key; BT.menuT0 = t; BT.menuSelY = null; }
  const age = REDUCED ? 9 : t - BT.menuT0, pop = easeOutBack(clamp(age / .15, 0, 1), 1.8), sc = .88 + .12 * pop;
  const ax = BT.mode === 'endmenu' || hudLayout().stack ? r.x + r.w / 2 : r.x < toScreenX(tileX(BT.cx)) ? r.x + r.w : r.x, ay = r.y + (BT.mode === 'endmenu' ? r.h / 2 : 10);
  ctx.save(); ctx.translate(ax, ay); ctx.scale(sc, sc); ctx.translate(-ax, -ay); ctx.globalAlpha = clamp(age / .08, 0, 1);
  hudPanel(r.x, r.y, r.w, r.h, { fill: '#1a1e4a', light: false });
  drawMenuHeader(m, r, kind);
  // the rows, clipped to the list window
  ctx.save(); ctx.beginPath(); ctx.rect(r.x + 3, r.listY - 1, r.w - 6, r.bodyH + 2); ctx.clip();
  const target = r.offs[m.i] - r.scroll; BT.menuSelY = BT.menuSelY == null || REDUCED ? target : lerp(BT.menuSelY, target, Math.min(1, CLOCK.dt * 20)); if (Math.abs(BT.menuSelY - target) < .5) BT.menuSelY = target;
  const hy = Math.round(r.listY + BT.menuSelY), it0 = m.items[m.i], selCol = it0 && it0.off ? '#3a3050' : '#34408e';
  rrect(r.x + 4, hy, r.w - 8, r.rh - 1, selCol, 1); hline(r.x + 5, hy, r.w - 10, shade(selCol, .35)); hline(r.x + 5, hy + r.rh - 2, r.w - 10, shade(selCol, -.4)); rect(r.x + 4, hy + 1, 2, r.rh - 3, UI.gold);
  if (!REDUCED) { const sh = (t * .8) % 2; if (sh < 1) { ctx.globalAlpha = .12 * Math.sin(sh * Math.PI); rect(Math.round(r.x + 6 + sh * (r.w - 20)), hy + 1, 6, r.rh - 3, '#ffffff'); ctx.globalAlpha = 1; } }
  m.items.forEach((it, i) => {
    const y = Math.round(r.listY + r.offs[i] - r.scroll); if (y + r.rh < r.listY - 1 || y > r.listY + r.bodyH) return;
    const d = REDUCED ? 1 : clamp((age - .04 - i * .025) / .12, 0, 1); if (d <= 0) return; const ox = Math.round((1 - easeOut(d)) * 10), hot = i === m.i;
    ctx.globalAlpha = d * clamp(age / .08, 0, 1);
    if (i && (it.group || 0) !== (m.items[i - 1].group || 0)) for (let q = r.x + 10; q < r.x + r.w - 10; q += 3) px(q, y - 3, '#3a3f78');
    drawMenuRow(it, r, y, hot, ox);
  });
  ctx.globalAlpha = clamp(age / .08, 0, 1); ctx.restore();
  if (r.scroll > 0) drawMenuArrow(r.x + r.w / 2, r.listY - 3, -1); if (r.scroll < r.listH - r.bodyH - .5) drawMenuArrow(r.x + r.w / 2, r.listY + r.bodyH + 1, 1);
  // the footer: what the chosen row does, or why it cannot
  if (r.foot) { const fy = r.y + r.h - 4 - r.foot; rect(r.x + 4, fy, r.w - 8, r.foot, '#12143a'); hline(r.x + 4, fy, r.w - 8, UI.inset); const it = m.items[m.i];
    const lines = it && it.sub ? wrap(it.sub, r.w - 16).slice(0, r.subLines) : []; lines.forEach((l, i) => text(l, r.x + 8, fy + 4 + i * 9, it.off ? '#e8a0a0' : UI.muted)); }
  ctx.restore();
  // the cursor: a Poké Ball bobbing beside the chosen row, once the menu has popped
  if (age > .1 && !(hudLayout().stack && BT.mode !== 'endmenu')) { const by = hy + Math.round(r.rh / 2), bob = REDUCED ? 0 : Math.round(Math.sin(t * 7) * 1.5); drawBall(r.x - 5 + bob, by, '#f04848', 3); }
  if (!VIEW.touch && r.y + r.h + 14 < VIEW.h && BT.mode === 'endmenu') hintLine([['▲▼', 'choose'], ['Z', 'ok'], ['X', 'back']], r.x + r.w / 2, r.y + r.h + 4, { pill: true });
  if (m.pc) drawPcPreview(m, r);
}
function drawMenuArrow(cx, y, dir) { const x = Math.round(cx); for (let k = 0; k < 3; k++) hline(x - k, dir < 0 ? y - 2 + k : y + 2 - k, 2 * k + 1, UI.gold); }
// Whose menu it is: the unit (portrait, name, level, HP), the day with the war chest and the commander, or the PC.
function drawMenuHeader(m, r, kind) {
  const x = r.x, y = r.y, w = r.w, hh = r.headH, u = BT.sel, team = kind === 'action' && u ? u.team : HT(), band = teamColorD(team);
  rect(x + 3, y + 3, w - 6, hh, band); hline(x + 3, y + 3, w - 6, shade(band, .3)); hline(x + 3, y + 3 + hh, w - 6, shade(band, -.45));
  if (kind === 'action' && u) {
    const ic = monIcon(u.fx.showNum || u.num, u.team === 1); rect(x + 6, y + 5, 26, 20, shade(band, -.35)); ctx.drawImage(ic, x + 7, y + 6, 24, 18);
    text(fitLabel(u.name, w - 48 - textWidth('Lv' + u.level)), x + 36, y + 6, '#ffffff', { shadow: shade(band, -.6) }); textR('Lv' + u.level, x + w - 8, y + 6, UI.gold, { shadow: shade(band, -.6) });
    const bw = w - 44 - 34; bar(x + 36, y + 17, bw, 5, u.hp / u.maxHp, hpColor(u.hp / u.maxHp)); textR(u.hp + '/' + u.maxHp, x + w - 8, y + 16, UI.ink, { shadow: shade(band, -.6) });
    if (u.leader) drawCrown(x + 6, y + 4);
    return;
  }
  const title = kind === 'main' ? TR('DAY {0}', B.turn) : TR(m.title || 'MENU'); text(title, x + 8, y + 7, UI.gold, { shadow: shade(band, -.6) });
  const s = powerState(team), face = s && trainerFace(coTrainer(s) ? coOf(s).tr : 'red');
  let rx = x + w - 8; if (kind === 'main' && face) { rect(rx - 13, y + 4, 13, 13, shade(band, -.4)); ctx.save(); ctx.beginPath(); ctx.rect(rx - 12, y + 5, 11, 11); ctx.clip(); ctx.drawImage(face, rx - 16, y + 2); ctx.restore(); rx -= 17; }
  if (B.war && (kind === 'main' || kind === 'pc') && team <= 1) textR(money(B.war.funds[team]), rx, y + 7, UI.gold, { shadow: shade(band, -.6) });
  else if (kind === 'sites') { const n = warDeploySites(team).length; textR(TR(n === 1 ? '{0} site' : '{0} sites', n), rx, y + 7, UI.muted); }
  if (kind === 'pc' && BT.deploySite) { const nw = textWidth(title) + 14; text(fitLabel('· ' + TRX(BT.deploySite.name), rx - x - nw - 60), x + nw, y + 7, UI.muted); }
}
// One row: the chip (or the Pokémon in the PC), the label (large for a unit's commands), and on the right its lamp,
// badge, value or chevron; a padlock when it cannot be used now.
function drawMenuRow(it, r, y, hot, ox) {
  const x = r.x + ox, rh = r.rh, cy = y + Math.round(rh / 2), off = !!it.off, col = it.col || MENU_COL[it.icon] || '#5a5a78';
  if (it.mon) { const ic = monIcon(it.mon); ctx.globalAlpha *= off ? .45 : 1; ctx.drawImage(ic, x + 7, cy - 9, 24, 18); ctx.globalAlpha /= off ? .45 : 1; }
  else if (it.icon) { const cc = off ? '#3a3a50' : col; rrect(x + 7, cy - 6, 13, 13, UI.inset, 2); rrect(x + 8, cy - 5, 11, 11, cc, 1); hline(x + 9, cy - 5, 9, shade(cc, .35)); iconAt(it.icon, x + 9, cy - 4, off ? '#8a8aa0' : '#ffffff'); }
  const lx = x + (it.mon ? 34 : 25), ink = off ? UI.dim : hot ? '#ffffff' : UI.ink;
  let rx = r.x + r.w - 8;
  if (it.more) { const ax = rx - 2; for (let k = 0; k < 3; k++) vline(ax - k, cy - k, 2 * k + 1, off ? UI.dim : hot ? UI.gold : UI.muted); rx -= 8; }
  if (it.lamp != null) { circle(rx - 4, cy, 4, UI.inset); circle(rx - 4, cy, 3, it.lamp ? '#5ee06a' : '#3a3a50'); if (it.lamp) px(rx - 5, cy - 1, '#d8ffe0'); text(it.lamp ? 'ON' : 'OFF', rx - 10 - textWidth(it.lamp ? 'ON' : 'OFF'), cy - 3, it.lamp ? '#8ae89a' : UI.dim); rx -= 12 + textWidth('OFF'); }
  if (off) { rect(rx - 5, cy - 1, 5, 4, UI.dim); outline(rx - 4, cy - 4, 3, 4, UI.dim); rx -= 9; }
  if (it.badge) { const bw = textWidth(it.badge.text) + 6; rrect(rx - bw, cy - 5, bw, 10, it.badge.col, 1); text(it.badge.text, rx - bw + 3, cy - 3, '#1a1030'); rx -= bw + 4; }
  if (it.right) { textR(it.right, rx, cy - 3, off ? UI.dim : it.rightCol || (hot ? UI.gold : '#e8d8a0')); rx -= textWidth(it.right) + 6; }
  const room = rx - lx - 2;
  if (r.big) bigText(fitBig(it.label.toUpperCase(), room), lx, cy - 4, ink, { shadow: hot ? '#0a0c2a' : UI.inset });
  else text(fitLabel(it.label, room), lx, cy - 3, ink, hot ? { shadow: shade(UI.sel, -.6) } : {});
}
// Beside the PC Box list: the highlighted Pokémon in a portrait with its types, role, stats and price (wide screens).
function drawPcPreview(m, r) {
  const it = m.items[m.i]; if (!it || !it.id.startsWith('deploy:') || VIEW.w < 380 || hudLayout().stack) return;
  const i = +it.id.slice(7), e = B.war.box[m.pc.team][i]; if (!e) return; let u = m.pc.cache[i]; if (!u) u = m.pc.cache[i] = e.data ? restoreUnit(Object.assign({}, e.data, { id: 0 })) : makeUnit(e.num, e.level, m.pc.team);
  const w = 118, h = 124, x = r.x + r.w + 4 + w > VIEW.w - 4 ? r.x - w - 4 : r.x + r.w + 4, y = clamp(r.y, 4, VIEW.h - h - 4), t = BT.time, R = ROLES[u.role];
  const p = hudPanel(x, y, w, h, { header: fitLabel(u.name, w - 44), headerRight: 'Lv' + u.level, headerRightCol: UI.gold, headerFill: teamColorD(m.pc.team) });
  const ph = 40; portraitBg(x + 5, p.cy, w - 10, ph, m.pc.team); ctx.save(); ctx.beginPath(); ctx.rect(x + 5, p.cy, w - 10, ph); ctx.clip(); requestAnim(u.num); if (animReady(u.num)) drawAnim(u.num, x + w / 2, p.cy + ph - 3, t); else drawMon(u.num, x + w / 2, p.cy + ph - 2, {}); ctx.restore(); outline(x + 4, p.cy - 1, w - 8, ph + 2, UI.border2);
  let yy = p.cy + ph + 4, bx = x + 6; for (const tp of u.types) bx += typeBadge(tp, bx, yy, 26) + 2; iconAt(R.icon, x + w - 50, yy, R.col); text(fitLabel(R.name, 36), x + w - 40, yy + 1, R.col); yy += 12;
  [['HP', u.maxHp], ['SPA', u.spa], ['ATK', u.atk], ['SPE', u.spe], ['DEF', u.def], ['MOV', u.mov]].forEach(([k, v], j) => { const cx = x + 6 + (j % 2) * 55, cy = yy + Math.floor(j / 2) * 9; text(k, cx, cy, UI.muted); textR(String(v), cx + 48, cy, UI.ink); }); yy += 29;
  const price = e.state === 'field' ? ['ON THE MAP', UI.dim] : e.recovery ? [TR('RECOVERING · {0}d', e.recovery), UI.red] : e.fresh ? ['FREE · FIRST DEPLOY', UI.green] : [money(e.cost), B.war.funds[m.pc.team] >= e.cost ? UI.gold : UI.red];
  if (yy + 9 <= y + h - 3) textC(price[0], x + w / 2, yy, price[1], { outline: UI.inset });
}

// ---------------------------------------------------------------- confirmation dialogs
// A question in the middle of the screen with two answers; the safe one is chosen first. Units, when given, are shown
// (the Pokémon that could still act). Arrows switch, Z answers, X takes the safe answer.
function openConfirm(opt) { BT.confirm = Object.assign({ i: 0, t0: BT.time, back: BT.mode === 'endmenu' ? 'endmenu' : 'idle' }, opt); BT.mode = 'confirm'; BT.sel = null; Audio.sfx('menu'); }
function confirmChoose(i) { const c = BT.confirm; if (!c) return; const a = i === 1 ? c.yes : c.no; BT.confirm = null; BT.mode = 'idle'; Audio.sfx(i === 1 ? 'select' : 'cancel'); a.run(); }
function confirmEndTurn() {
  const ready = alive(HT()).filter(u => !u.acted); if (!ready.length) { endTurn(); return; }
  BT.autoEnd = 0; openConfirm({ title: 'END TURN?', lines: [TR(ready.length > 1 ? '{0} Pokémon can still act this turn.' : 'One Pokémon can still act this turn.', ready.length)], units: ready, no: { label: 'KEEP PLAYING', run: () => { BT.mode = 'idle'; } }, yes: { label: 'END TURN', variant: 'danger', run: () => endTurn() } });
}
function confirmRetreat() {
  const vs = B.versus; openConfirm({ title: vs ? 'FORFEIT?' : 'RETREAT?', lines: [vs ? 'The other trainer wins the arena.' : B.chapter != null && !B.skirmish ? 'Your team runs back to the Poké Center. The front stays as it was.' : 'This battle ends as a loss.'], no: { label: 'STAY', run: () => openEndMenu() }, yes: { label: vs ? 'FORFEIT' : 'RETREAT', variant: 'danger', run: () => { B.result = vs ? (HT() === 0 ? 'p2' : 'p1') : 'retreat'; endBattle(); } } });
}
function confirmRect() { const c = BT.confirm, w = Math.min(250, VIEW.w - 16), lines = c.lines.flatMap(l => wrap(l, w - 20)), units = c.units ? Math.min(c.units.length, Math.floor((w - 16) / 26)) : 0, bh = btnH(), h = 20 + 6 + lines.length * 10 + (units ? 26 : 0) + bh + 16; return { x: Math.round((VIEW.w - w) / 2), y: Math.round((VIEW.h - h) / 2), w, h, lines, units, bh }; }
function drawConfirm() {
  const c = BT.confirm; if (!c) { BT.mode = 'idle'; return; } const r = confirmRect(), t = BT.time, age = REDUCED ? 9 : t - c.t0, pop = easeOutBack(clamp(age / .16, 0, 1), 2), sc = .86 + .14 * pop;
  dimScreen(.6 * clamp(age / .12, 0, 1)); ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(sc, sc); ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2)); ctx.globalAlpha = clamp(age / .08, 0, 1);
  const danger = c.yes.variant === 'danger', p = panel(r.x, r.y, r.w, r.h, { fill: '#1a1e4a', header: c.title, headerFill: danger ? '#5a1d2e' : UI.panelDark, headerCol: '#ffffff' });
  let y = p.cy + 2; r.lines.forEach(l => { textC(l, r.x + r.w / 2, y, UI.ink); y += 10; });
  if (r.units) { const n = r.units, x0 = Math.round(r.x + r.w / 2 - n * 13); c.units.slice(0, n).forEach((u, k) => { const bob = REDUCED ? 0 : Math.round(Math.abs(Math.sin(t * 5 + k)) * -2); ctx.drawImage(monIcon(u.num), x0 + k * 26, y + 2 + bob, 24, 18); }); y += 26; }
  ctx.restore();
  // the answers, as HUD buttons (registered after the pop so they are hit where they are drawn)
  const bw = Math.floor((r.w - 24) / 2), by = r.y + r.h - r.bh - 8; [[c.no, 0, 'ghost'], [c.yes, 1, c.yes.variant || 'primary']].forEach(([a, i, variant]) => { const bx = r.x + 8 + i * (bw + 8), hot = c.i === i;
    if (hot && !REDUCED) { ctx.globalAlpha = .35 + .2 * Math.sin(t * 6); rrect(bx - 2, by - 2, bw + 4, r.bh + 4, UI.gold, 2); ctx.globalAlpha = 1; }
    button(bx, by, bw, r.bh, a.label, () => confirmChoose(i), { variant }); });
  if (!VIEW.touch && r.y + r.h + 14 < VIEW.h) hintLine([['◂▸', 'choose'], ['Z', 'answer'], ['X', String(TRX(c.no.label)).toLowerCase()]], r.x + r.w / 2, r.y + r.h + 4, { pill: true });
}
function confirmInput(ev) {
  const c = BT.confirm; if (!c) { BT.mode = 'idle'; return; }
  if (ev.type === 'key') { if (['left', 'right', 'up', 'down', 'next', 'prev'].includes(ev.key)) { c.i = 1 - c.i; Audio.sfx('cursor'); } else if (ev.key === 'ok') confirmChoose(c.i); else if (ev.key === 'back') confirmChoose(0); return; }
  if (ev.type === 'up') { const h = HUD.hits.find(b => ev.x >= b.x && ev.y >= b.y && ev.x < b.x + b.w && ev.y < b.y + b.h); if (h) h.run(); else confirmChoose(0); }
  if (ev.type === 'move' && !ev.touch) { const r = confirmRect(), bw = Math.floor((r.w - 24) / 2), by = r.y + r.h - r.bh - 8; if (ev.y >= by && ev.y < by + r.bh) { const i = ev.x < r.x + 8 + bw + 4 ? 0 : 1; if (i !== c.i) { c.i = i; Audio.sfx('cursor'); } } }
}
