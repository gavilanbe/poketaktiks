'use strict';
// ============================================================================
// POKÉTAKTIKS — core.js: canvas + integer scaling, input, RNG, drawing helpers,
// Showdown icon atlas, WebAudio synth.
// ============================================================================
const TILE = 32;                      // logical pixels per board tile
const VIEW = { w: 480, h: 270, scale: 2, dpr: 1, touch: false };
const cv = document.getElementById('c');
const ctx = cv.getContext('2d', { alpha: false });
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
// Persisted presentation preferences. battle: 'full' (lateral duel scene), 'quick' (same scene, faster) or 'map' (strikes on the board).
const PREF = { battle: 'full', territoryGuide: 'show' };
const PREF_VALUES = { battle: ['full', 'quick', 'map'], territoryGuide: ['show', 'hide'] };
try { for (const k in PREF) { const v = localStorage.getItem('pk_' + k); if (PREF_VALUES[k].includes(v)) PREF[k] = v; } } catch (_) { }
function setPref(k, v) { if (!PREF_VALUES[k].includes(v)) return; PREF[k] = v; try { localStorage.setItem('pk_' + k, v); } catch (_) { } }
function cyclePref(k) { const vs = PREF_VALUES[k]; setPref(k, vs[(vs.indexOf(PREF[k]) + 1) % vs.length]); return PREF[k]; }

// Integer device-pixel scale for a canvas of pw×ph device pixels shown at cw CSS pixels wide.
// Landscape aims for ~560 logical pixels of width. Portrait on a phone (≤ 520 CSS px wide) aims for
// ~200, which puts the 5×7 font at 10-12 CSS px and a 18 px button at 36+ CSS px; tablets in portrait
// keep ~320. Never below 1, and never so coarse that fewer than 176 logical pixels remain.
function pickScale(pw, ph, cw) {
  const portrait = ph > pw; const target = portrait ? (cw <= 520 ? 200 : 320) : 560;
  let s = Math.max(1, Math.round(pw / target));
  while (s > 1 && pw / s < 176) s--;
  return s;
}
function resize() {
  const cw = innerWidth, ch = innerHeight, dpr = Math.min(devicePixelRatio || 1, 3);
  const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
  const s = pickScale(pw, ph, cw);
  VIEW.scale = s; VIEW.dpr = dpr;
  VIEW.w = Math.floor(pw / s); VIEW.h = Math.floor(ph / s);
  cv.width = pw; cv.height = ph; cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  ctx.setTransform(s, 0, 0, s, 0, 0); ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize); resize();
// Layout helpers shared by every scene. narrow: a phone-sized logical view (portrait phones land at
// 176-260 px); touch targets grow there and whenever a touch has been seen.
function narrowView() { return VIEW.w < 300; }
function portraitView() { return VIEW.h > VIEW.w; }
function btnH() { return narrowView() || VIEW.touch ? 18 : 14; }
function rowH() { return narrowView() || VIEW.touch ? 16 : 13; }

// ---------------------------------------------------------------- RNG
function mulberry32(a) { const next = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; next.state = () => a | 0; return next; }
let rnd = mulberry32((Math.random() * 1e9) | 0);       // gameplay RNG (reseeded per battle)
const vrnd = mulberry32(12345);                          // visual-only RNG
function seedRng(s) { rnd = mulberry32(s | 0); }
function rint(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function vpick(arr) { return arr[Math.floor(vrnd() * arr.length)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOut(t) { return 1 - (1 - t) * (1 - t); }
function easeIn(t) { return t * t; }
function easeInOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
const mixCache = {};
function mix(a, b, k) { const key = a + b + (k * 100 | 0); if (mixCache[key]) return mixCache[key]; const A = hexRgb(a), B = hexRgb(b); return mixCache[key] = rgbHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k); }
function shade(h, k) { return mix(h, k < 0 ? '#000000' : '#ffffff', Math.abs(k)); }

// ---------------------------------------------------------------- input
// Everything funnels into a queue of {type:'down'|'up'|'move'|'key'|'wheel', x, y, key, btn}.
const INPUT = { queue: [], x: -1, y: -1, down: false, keys: {}, lastKeyAt: 0, dragging: null };
function toLogical(e) { const r = cv.getBoundingClientRect(); return { x: Math.floor((e.clientX - r.left) * VIEW.dpr / VIEW.scale), y: Math.floor((e.clientY - r.top) * VIEW.dpr / VIEW.scale) }; }
cv.addEventListener('pointerdown', e => { e.preventDefault(); const p = toLogical(e); VIEW.touch = e.pointerType === 'touch'; INPUT.x = p.x; INPUT.y = p.y; INPUT.down = true; INPUT.queue.push({ type: 'down', x: p.x, y: p.y, btn: e.button, touch: VIEW.touch }); try { cv.setPointerCapture(e.pointerId); } catch (_) { } Audio.unlock(); });
cv.addEventListener('pointermove', e => { const p = toLogical(e); if (p.x === INPUT.x && p.y === INPUT.y) return; INPUT.x = p.x; INPUT.y = p.y; INPUT.queue.push({ type: 'move', x: p.x, y: p.y, touch: e.pointerType === 'touch' }); });
cv.addEventListener('pointerup', e => { const p = toLogical(e); INPUT.down = false; INPUT.queue.push({ type: 'up', x: p.x, y: p.y, btn: e.button, touch: e.pointerType === 'touch' }); });
cv.addEventListener('pointercancel', () => { INPUT.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { e.preventDefault(); INPUT.queue.push({ type: 'wheel', dy: e.deltaY, dx: e.deltaX }); }, { passive: false });
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right', z: 'ok', Z: 'ok', Enter: 'ok', ' ': 'ok', x: 'back', X: 'back', Escape: 'back', Backspace: 'back', q: 'prev', e: 'next', Q: 'prev', E: 'next', Tab: 'next', c: 'info', C: 'info', m: 'mute', M: 'mute', h: 'help', H: 'help', f: 'fast', F: 'fast', '+': 'zoomin', '-': 'zoomout', '=': 'zoomin', v: 'detail', V: 'detail', p: 'power', P: 'power' };
addEventListener('keydown', e => { const k = KEYMAP[e.key]; if (!k) return; e.preventDefault(); if (e.repeat && k !== 'up' && k !== 'down' && k !== 'left' && k !== 'right') return; INPUT.keys[k] = true; INPUT.queue.push({ type: 'key', key: k, repeat: e.repeat }); Audio.unlock(); });
addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) INPUT.keys[k] = false; });
addEventListener('blur', () => { INPUT.keys = {}; INPUT.down = false; });

// ---------------------------------------------------------------- drawing helpers
function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
function px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); }
function hline(x, y, w, c) { rect(x, y, w, 1, c); }
function vline(x, y, h, c) { rect(x, y, 1, h, c); }
function outline(x, y, w, h, c) { hline(x, y, w, c); hline(x, y + h - 1, w, c); vline(x, y, h, c); vline(x + w - 1, y, h, c); }
// Pixel-rounded rectangle: corners cut by 1px (r=1) or 2px stair (r=2).
function rrect(x, y, w, h, c, r = 1) {
  x |= 0; y |= 0; w |= 0; h |= 0; ctx.fillStyle = c;
  if (r <= 0) { ctx.fillRect(x, y, w, h); return; }
  ctx.fillRect(x + r, y, w - 2 * r, h); ctx.fillRect(x, y + r, w, h - 2 * r);
  if (r === 2) { ctx.fillRect(x + 1, y + 1, w - 2, h - 2); }
}
// Dithered rectangle (checker) for translucent-looking overlays without alpha.
function dither(x, y, w, h, c, phase = 0) { ctx.fillStyle = c; for (let j = 0; j < h; j++) for (let i = (j + phase) & 1; i < w; i += 2) ctx.fillRect(x + i, y + j, 1, 1); }
function alpha(a, fn) { const o = ctx.globalAlpha; ctx.globalAlpha = a; fn(); ctx.globalAlpha = o; }
function circle(cx, cy, r, c) { ctx.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y) + .5); ctx.fillRect(cx - w, cy + y, 2 * w + 1, 1); } }
function ellipse(cx, cy, rx, ry, c) { ctx.fillStyle = c; for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)) + .5); ctx.fillRect(cx - w, cy + y, 2 * w + 1, 1); } }

// ---------------------------------------------------------------- clock & motion
// CLOCK.t: seconds since boot, advanced by the main loop; CLOCK.frame counts frames. The motion helpers read it so any
// screen can animate without timers of its own. Outside the loop (tests, tools) CLOCK.frame stays 0 and every entrance
// reports itself finished, so layouts are always measured at rest.
const CLOCK = { t: 0, frame: 0, dt: 0 };
const APPEAR = new Map();
// Seconds since `id` started being drawn on consecutive frames; it re-arms when the element is gone for a few frames.
function appear(id) { if (!CLOCK.frame || REDUCED) return 99; let a = APPEAR.get(id); if (!a || CLOCK.frame - a.f > 2) { a = { t0: CLOCK.t, f: CLOCK.frame }; APPEAR.set(id, a); } a.f = CLOCK.frame; return CLOCK.t - a.t0; }
function easeOutBack(t, s = 1.7) { t = clamp(t, 0, 1) - 1; return 1 + (s + 1) * t * t * t + s * t * t; }
function easeOutElastic(t) { t = clamp(t, 0, 1); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1; }
function wobble(t, amp, freq = 9, decay = 7) { return amp * Math.sin(t * freq * Math.PI * 2 / 3) * Math.exp(-t * decay); }
// Entrance for a box, pixel-crisp: it unfolds from its middle row and settles with a small bounce. Draw between
// unfold(...) and unfoldEnd(token). Returns null (nothing to undo) once the entrance is over.
function unfold(id, x, y, w, h, dur = .2) {
  const k = appear(id) / dur; if (k >= 1) return null;
  const e = easeOutBack(k, 2.2), hh = Math.max(2, Math.round(h * clamp(e, 0, 1.08))), dy = Math.round((1 - clamp(e, 0, 1)) * 6);
  ctx.save(); ctx.globalAlpha *= clamp(k * 3, 0, 1); ctx.beginPath(); ctx.rect(x - 4, Math.round(y + h / 2 - hh / 2) - 4 + dy, w + 10, hh + 10); ctx.clip(); ctx.translate(0, dy); return true;
}
function unfoldEnd(tok) { if (tok) ctx.restore(); }
// Count-up for numbers that just changed (results, points): the shown value runs from 0 to v over `dur` after `delay`.
function countUp(id, v, dur = .6, delay = 0) { const t = appear(id) - delay; if (t >= dur) return v; if (t <= 0) return 0; return Math.round(v * easeOut(t / dur)); }

// ---------------------------------------------------------------- scene transition (Poké Ball wipe)
// goScene snapshots the last frame; the two halves of a Poké Ball close over it, then open on the new scene.
const TRANS = { snap: null, t: 0, on: false };
function captureTransition() {
  if (REDUCED || !CLOCK.frame) return;
  try { if (!TRANS.snap) TRANS.snap = document.createElement('canvas'); TRANS.snap.width = cv.width; TRANS.snap.height = cv.height; TRANS.snap.getContext('2d').drawImage(cv, 0, 0); TRANS.t = 0; TRANS.on = true; } catch (_) { TRANS.on = false; }
}
function drawTransition(dt) {
  if (!TRANS.on) return; TRANS.t += dt; const T = TRANS.t, CLOSE = .17, HOLD = .07, OPEN = .28;
  if (T >= CLOSE + HOLD + OPEN) { TRANS.on = false; return; }
  const W = VIEW.w, H = VIEW.h;
  let k; if (T < CLOSE) { k = easeIn(T / CLOSE); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(TRANS.snap, 0, 0); ctx.restore(); } else if (T < CLOSE + HOLD) k = 1; else k = 1 - easeInOut((T - CLOSE - HOLD) / OPEN);
  const half = Math.ceil((H / 2 + 3) * k), cx = Math.round(W / 2), r = Math.max(9, Math.round(Math.min(W, H) * .07));
  // top: red shell with a highlight band; bottom: white shell; both carry a black rim on the closing edge and half of the button
  rect(0, 0, W, half, '#e2343e'); rect(0, 0, W, Math.max(0, half - Math.round(H * .35)), '#f04a52'); hline(0, half - 5, W, '#a81c27'); rect(0, half - 3, W, 3, '#141020');
  rect(0, H - half, W, half, '#f2eee6'); hline(0, H - half + 3, W, '#ffffff'); rect(0, H - half, W, 3, '#141020'); hline(0, H - 1, W, '#c9c2b4');
  for (const [top, y0] of [[true, half], [false, H - half]]) { ctx.save(); ctx.beginPath(); if (top) ctx.rect(0, 0, W, half); else ctx.rect(0, H - half, W, half); ctx.clip(); const cy = top ? y0 : y0; circle(cx, cy, r + 3, '#141020'); circle(cx, cy, r, '#f2eee6'); circle(cx, cy, r - 3, '#141020'); circle(cx, cy, r - 5, k > .98 ? '#ffffff' : '#e8e2d6'); if (k > .98) circle(cx - 2, cy - 2, 2, '#ffffff'); ctx.restore(); }
}

// ---------------------------------------------------------------- UI design system
// One vocabulary for every screen: raised cream-framed windows on deep indigo, gold for headings and the selection,
// sky blue for information, green/red for outcomes. Everything is 1-px pixel art; motion comes from the helpers above.
const UI = {
  panel: '#1f2452', panel2: '#2b3274', panelDark: '#141736', panelLight: '#272d66',
  border: '#f4e9cb', borderHi: '#fffbef', borderLo: '#b9a67a', border2: '#5b619e', inset: '#0b0a1d',
  ink: '#f7f3e7', muted: '#a8aed3', dim: '#6c72a2', info: '#9cdbff',
  gold: '#ffd049', goldDark: '#4a2a00', red: '#ff5d67', green: '#62e58d', blue: '#6cb0ff', shadow: '#06051a', hi: '#ffffff',
  menuSel: '#3646aa', sel: '#3646aa',
  bg: '#0d0b1e', hpGreen: '#4cd96c', hpYellow: '#f8c63a', hpRed: '#f2484c', hpBack: '#1a1c34',
  btn: { neutral: '#36428f', primary: '#2f9b56', danger: '#c63a46', ghost: '#5d4f78', gold: '#d8991f', dark: '#242b5e' },
};
// Two-tone body with a dithered seam a third of the way down: reads as a lit surface without gradients.
function bodyFill(x, y, w, h, fill) { const top = shade(fill, .07), s = Math.round(h * .38); rect(x, y, w, h, fill); if (h > 8) { rect(x, y, w, s, top); dither(x, y + s, w, 1, top, 0); } }
// Panel: soft drop shadow, ink outline with round corners, a cream frame lit top-left, an ink inner line and an indigo
// body. opt: fill, border (accent frame colour, e.g. the selection), flat (plain body), title (a gold ribbon riding the
// top edge, 9 px above y), header (a band inside; content starts at the returned cy), headerFill/headerCol/headerRight.
function panel(x, y, w, h, opt = {}) {
  x |= 0; y |= 0; w |= 0; h |= 0;
  if (opt.light) return lightPanel(x, y, w, h, opt);
  const fill = opt.fill || UI.panel, border = opt.border || UI.border, accent = !!opt.border && opt.border !== UI.border;
  const hi = accent ? shade(border, .4) : UI.borderHi, lo = accent ? shade(border, -.35) : UI.borderLo;
  ctx.globalAlpha = .6; rrect(x + 2, y + 3, w, h, UI.shadow, 2); ctx.globalAlpha = 1;   // drop shadow
  rrect(x, y, w, h, UI.inset, 2);                                                          // ink outline
  rrect(x + 1, y + 1, w - 2, h - 2, border, 1);                                            // cream frame
  hline(x + 2, y + 1, w - 4, hi); vline(x + 1, y + 2, h - 4, hi); hline(x + 2, y + h - 2, w - 4, lo); vline(x + w - 2, y + 2, h - 4, lo);
  rect(x + 3, y + 3, w - 6, h - 6, UI.inset);                                              // inner line
  if (opt.flat) rect(x + 4, y + 4, w - 8, h - 8, fill); else { bodyFill(x + 4, y + 4, w - 8, h - 8, fill); hline(x + 4, y + 4, w - 8, shade(fill, .22)); hline(x + 4, y + h - 5, w - 8, shade(fill, -.3)); }
  let cy = y + 6;
  if (opt.header) { const bh = 12, hf = opt.headerFill || UI.panelDark; rect(x + 4, y + 4, w - 8, bh, hf); hline(x + 4, y + 4, w - 8, shade(hf, .25)); hline(x + 4, y + 4 + bh, w - 8, UI.border2); hline(x + 4, y + 5 + bh, w - 8, shade(fill, -.3)); text(opt.header, x + 8, y + 7, opt.headerCol || UI.gold, { shadow: shade(hf, -.55) }); if (opt.headerRight) textR(opt.headerRight, x + w - 8, y + 7, opt.headerRightCol || UI.muted, { shadow: shade(hf, -.55) }); cy = y + 4 + bh + 5; }
  if (opt.title) ribbonTab(opt.title, x + 5, y - 9, opt.titleCol);
  return { x, y, w, h, cx: x + 6, cy, cw: w - 12 };
}
// A gold ribbon tab (12 px tall) with a notched tail, carrying dark text. Returns its width.
function ribbonTab(label, x, y, col) {
  const face = col && col !== UI.gold ? col : UI.gold, tw = textWidth(label) + 12;
  rrect(x, y, tw, 12, UI.inset, 1); rect(x + 1, y + 1, tw - 2, 10, face); hline(x + 2, y + 1, tw - 4, shade(face, .45)); hline(x + 1, y + 10, tw - 2, shade(face, -.3));
  px(x + tw - 2, y + 5, UI.inset); px(x + tw - 2, y + 6, UI.inset); px(x + tw - 3, y + 6, shade(face, -.3));
  text(label, x + 5, y + 3, shade(face, -.82)); return tw;
}
// Light panel (in-battle HUD): a 1-px cream frame around a lighter indigo body, a soft shadow and, with opt.header, a 12-px
// band in opt.headerFill (a team colour) carrying opt.header left and opt.headerRight right. Same return shape as panel().
function lightPanel(x, y, w, h, opt) {
  const fill = opt.fill || UI.panelLight, border = opt.border || UI.border;
  ctx.globalAlpha = .5; rrect(x + 2, y + 3, w, h, UI.shadow, 2); ctx.globalAlpha = 1;
  rrect(x, y, w, h, UI.inset, 2); rrect(x + 1, y + 1, w - 2, h - 2, border, 1); hline(x + 2, y + 1, w - 4, UI.borderHi);
  if (opt.flat) rect(x + 2, y + 2, w - 4, h - 4, fill); else { bodyFill(x + 2, y + 2, w - 4, h - 4, fill); hline(x + 2, y + 2, w - 4, shade(fill, .18)); hline(x + 2, y + h - 3, w - 4, shade(fill, -.25)); }
  let cy = y + 5;
  if (opt.header) { const bh = 12, hf = opt.headerFill || UI.panelDark; rect(x + 2, y + 2, w - 4, bh, hf); hline(x + 2, y + 2, w - 4, shade(hf, .3)); hline(x + 2, y + 3, w - 4, shade(hf, .12)); hline(x + 2, y + 2 + bh, w - 4, shade(hf, -.4)); text(opt.header, x + 6, y + 5, opt.headerCol || UI.ink, { shadow: shade(hf, -.55) }); if (opt.headerRight) textR(opt.headerRight, x + w - 6, y + 5, opt.headerRightCol || UI.ink, { shadow: shade(hf, -.55) }); cy = y + 2 + bh + 4; }
  if (opt.title) ribbonTab(opt.title, x + 4, y - 9, opt.titleCol);
  return { x, y, w, h, cx: x + 4, cy, cw: w - 8 };
}
// Filled progress bar with an inset frame; opt.notch draws quarter marks on wide bars.
function bar(x, y, w, h, ratio, col, back = UI.hpBack, opt = {}) {
  x |= 0; y |= 0; w |= 0; h |= 0; rect(x, y, w, h, back); const f = Math.round(clamp(ratio, 0, 1) * (w - 2));
  if (f > 0) { rect(x + 1, y + 1, f, h - 2, col); hline(x + 1, y + 1, f, shade(col, .45)); if (h > 4) hline(x + 1, y + h - 2, f, shade(col, -.3)); if (f > 2 && h > 3) px(x + f, y + 1, shade(col, .7)); }
  if (opt.notch && w >= 40) for (let q = 1; q < 4; q++) { const nx = x + 1 + Math.round((w - 2) * q / 4); vline(nx, y + 1, h - 2, shade(back, .25)); if (nx < x + 1 + f) vline(nx, y + 1, h - 2, shade(col, -.35)); }
  outline(x, y, w, h, UI.inset); hline(x + 1, y + h - 1, w - 2, shade(back, .35));
}
// Terrain defence as Advance Wars stars: one per 10% of damage reduction (max 4); '-' when none.
function defStars(def) { const n = Math.min(4, Math.round(def / 10)); return n ? '★'.repeat(n) : '-'; }
function hpColor(r) { return r > .5 ? UI.hpGreen : r > .2 ? UI.hpYellow : UI.hpRed; }
function hpBar(x, y, w, cur, max) { bar(x, y, w, 5, cur / max, hpColor(cur / max), UI.hpBack, { notch: true }); }
// Button face (no hit registration): a raised key with a 2-px base that the face sinks into while pressed. opt: hot
// (pointer over it / keyboard focus: gold rim, brighter face, a travelling shine), pressed, variant (neutral | primary |
// danger | ghost | gold | dark), big (headline font), ink, disabled, icon, on (toggle lamp), col (explicit face colour).
function uiButton(x, y, w, h, label, opt = {}) {
  x |= 0; y |= 0; w |= 0; h |= 0; const dis = !!opt.disabled; let face = opt.col || UI.btn[opt.variant || 'neutral'] || UI.btn.neutral; if (dis) face = '#2a2d48'; else if (opt.hot) face = shade(face, .2);
  const depth = h >= 16 && !dis ? 2 : 1, down = opt.pressed && !dis ? depth : 0, fh = h - depth; // face height above the base
  ctx.globalAlpha = .5; rrect(x + 1, y + 2, w, h, UI.shadow, 1); ctx.globalAlpha = 1;
  rrect(x, y, w, h, opt.hot && !dis ? UI.gold : UI.inset, 1);
  rrect(x + 1, y + 1 + fh - 2, w - 2, h - fh, shade(face, -.5), 1);                          // the base under the key
  const fy = y + 1 + down; rrect(x + 1, fy, w - 2, fh - 2 + (down ? 0 : 0), face, 1);           // the key face
  hline(x + 2, fy, w - 4, shade(face, .45)); hline(x + 2, fy + 1, w - 4, shade(face, .14)); vline(x + 1, fy + 1, fh - 4, shade(face, .15)); vline(x + w - 2, fy + 1, fh - 4, shade(face, -.2)); hline(x + 2, fy + fh - 3, w - 4, shade(face, -.28));
  if (opt.hot && !dis && !REDUCED && CLOCK.frame) { const sx = Math.round(((CLOCK.t * 70) % (w + 40)) - 20); ctx.save(); ctx.beginPath(); ctx.rect(x + 2, fy + 1, w - 4, fh - 4); ctx.clip(); ctx.globalAlpha = .22; for (let i = 0; i < 3; i++) vline(x + sx + i, fy + 1, fh - 4, '#ffffff'); ctx.restore(); }
  const ink = dis ? UI.dim : opt.ink || (opt.hot ? UI.hi : UI.ink); const iw = opt.icon ? 12 : 0;
  const big = opt.big && h >= 15; const lw = textWidth(big ? String(label).toUpperCase() : label, big ? BIG : FONT) + iw; let lx = x + Math.round((w - lw) / 2);
  const cy = fy + Math.round((fh - 2) / 2);
  if (opt.icon) { iconAt(opt.icon, lx, cy - 5, dis ? UI.dim : ink); lx += iw; }
  if (opt.on != null) { const ly = cy - 3; lx -= 5; rect(lx + lw + 4, ly, 5, 5, UI.inset); rect(lx + lw + 5, ly + 1, 3, 3, opt.on ? UI.gold : '#3a4068'); if (opt.on) px(lx + lw + 5, ly + 1, '#fff3b0'); } // toggle lamp
  if (big) bigText(label, lx, cy - 5, ink, { shadow: shade(face, -.6) }); else text(label, lx, cy - 4, ink, { shadow: dis ? null : shade(face, -.6) });
}
// Menu row highlight: a lit band with a gold edge and a marker that nudges right while it is fresh.
function selRow(x, y, w, h, col = UI.sel) { rrect(x, y, w, h, col, 1); hline(x + 1, y, w - 2, shade(col, .32)); hline(x + 1, y + h - 1, w - 2, shade(col, -.35)); rect(x, y + 1, 2, h - 2, UI.gold); px(x + 2, y + 1, '#fff2b8'); }
// Keycap: cream cap with a dark letter and a 1-px base; touch screens get a plain word instead.
function keycap(k, x, y) { const w = textWidth(k) + 6; rrect(x, y - 1, w, 10, UI.inset, 1); rect(x + 1, y - 1 + 1, w - 2, 7, UI.border); hline(x + 1, y, w - 2, UI.borderHi); hline(x + 1, y + 7, w - 2, UI.borderLo); text(k, x + 3, y, '#1b1834'); return w; }
// Hint line: [['Z', 'attack'], ['X', 'back'], 'plain text'] centred at cx, on a dark pill so it reads over any board.
// Returns the drawn width. opt: left (x is the left edge), pill=false (no background), col.
function hintLine(items, cx, y, opt = {}) {
  const parts = items.filter(Boolean).map(it => Array.isArray(it) ? { k: it[0], t: it[1] } : { t: it });
  const kw = p => (p.k && !VIEW.touch ? textWidth(p.k) + 6 + 3 : 0) + textWidth(p.t);
  const gap = 9; const tot = parts.reduce((s, p) => s + kw(p), 0) + gap * (parts.length - 1);
  let x = opt.left ? cx : opt.right ? Math.round(cx - tot) : Math.round(cx - tot / 2); if (opt.pill !== false) { ctx.globalAlpha = .78; rrect(x - 5, y - 3, tot + 10, 13, UI.inset, 2); ctx.globalAlpha = 1; }
  for (const p of parts) { if (p.k && !VIEW.touch) x += keycap(p.k, x, y) + 3; text(p.t, x, y, opt.col || UI.muted); x += textWidth(p.t) + gap; }
  return tot;
}
// Width a hint line would take (same measuring as hintLine), for callers that trim hints to a card.
function hintWidth(items) { const parts = items.filter(Boolean).map(it => Array.isArray(it) ? { k: it[0], t: it[1] } : { t: it }); const kw = p => (p.k && !VIEW.touch ? textWidth(p.k) + 6 + 3 : 0) + textWidth(p.t); return parts.reduce((s, p) => s + kw(p), 0) + 9 * (parts.length - 1) + 10; }
// Small-caps section label with a rule running to the right edge.
function sectionLabel(s, x, y, w, col = UI.muted) { const t = String(s).toUpperCase(); text(t, x, y, col); const rx = x + textWidth(t) + 5; if (w && rx < x + w) { hline(rx, y + 4, x + w - rx, UI.border2); hline(rx, y + 5, x + w - rx, UI.inset); } }
function dimScreen(a = .55, col = '#07061a') { ctx.globalAlpha = a; rect(0, 0, VIEW.w, VIEW.h, col); ctx.globalAlpha = 1; }
// Headline in the display face with a gold fill, a dark outline and a shine that sweeps across it every few seconds.
function shinyTitle(s, cx, y, col = UI.gold, dark = UI.goldDark) {
  const t = String(s).toUpperCase(), tw = textWidth(t, BIG), x = Math.round(cx - tw / 2);
  bigText(t, x, y, col, { outline: dark }); hline(x, y + 9, tw, shade(col, -.25));
  if (!REDUCED && CLOCK.frame) { const k = (CLOCK.t % 3.2) / .7; if (k < 1) { const sx = x - 6 + Math.round((tw + 12) * k); ctx.save(); ctx.beginPath(); ctx.rect(sx, y - 1, 3, 11); ctx.clip(); bigText(t, x, y, '#fffbe6'); ctx.restore(); } }
  return tw;
}
// Screen chrome for setup / result scenes: a headline with a gold rule, and a footer band for buttons and hints.
function screenTitle(title, sub, y = 6) {
  const W = VIEW.w, k = easeOutBack(clamp(appear('title:' + title) / .35, 0, 1)); const tw = textWidth(String(title).toUpperCase(), BIG);
  const yy = y + Math.round((1 - k) * -14); shinyTitle(title, W / 2, yy, UI.gold, UI.goldDark);
  const rw = Math.round((tw + 28) * clamp(k, 0, 1)); rect(W / 2 - rw / 2, y + 12, rw, 1, UI.gold); rect(W / 2 - rw / 2, y + 13, rw, 1, UI.goldDark); if (rw > 8) { px(W / 2 - rw / 2 - 2, y + 12, UI.gold); px(W / 2 + rw / 2 + 1, y + 12, UI.gold); }
  if (sub) textC(sub, W / 2, y + 17, UI.muted, { outline: UI.shadow }); return y + (sub ? 28 : 16);
}
function footerBand(h) { const W = VIEW.w, H = VIEW.h; ctx.globalAlpha = .88; rect(0, H - h, W, h, '#08071a'); ctx.globalAlpha = 1; hline(0, H - h, W, UI.gold); hline(0, H - h + 1, W, UI.goldDark); hline(0, H - h + 2, W, UI.inset); return H - h; }

// ---------------------------------------------------------------- sprite atlas (Showdown minis)
// The Showdown icon sheet is 12 icons per row, 40×30 each, indexed by dex number.
const SPR = { sheet: null, ready: false, cache: {}, w: 40, h: 30, scratch: document.createElement('canvas') };
SPR.scratch.width = 40; SPR.scratch.height = 30; SPR.sctx = SPR.scratch.getContext('2d');
function loadSprites(cb) {
  const img = new Image(); img.onload = () => { SPR.sheet = img; SPR.ready = true; cb && cb(); };
  img.onerror = () => { SPR.ready = true; SPR.sheet = null; cb && cb(); };
  img.src = 'assets/pokemonicons-sheet.png';
}
// Returns an offscreen canvas holding one icon (optionally flipped or tinted). Cached.
function monIcon(num, flip = false, tint = null) {
  const key = num + (flip ? 'f' : '') + (tint || '');
  let c = SPR.cache[key]; if (c) return c;
  c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d');
  if (SPR.sheet) {
    const sx = (num % 12) * 40, sy = Math.floor(num / 12) * 30;
    if (flip) { g.translate(40, 0); g.scale(-1, 1); }
    g.drawImage(SPR.sheet, sx, sy, 40, 30, 0, 0, 40, 30);
    if (tint === 'grey') { // desaturated + slightly darkened copy for units that already acted (blend modes: works from file://)
      g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(-40, 0, 80, 30);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(SPR.sheet, sx, sy, 40, 30, 0, 0, 40, 30);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(10,12,30,.35)'; g.fillRect(-40, 0, 80, 30); }
    else if (tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = tint; g.fillRect(-40, 0, 80, 30); }
  } else { g.fillStyle = tint || '#c0c0c0'; g.fillRect(12, 6, 16, 18); }
  SPR.cache[key] = c; return c;
}
// The same icon with a 1-px outline in `col` hugging its silhouette (team colour on the board, as Advance Wars tints its
// units): the silhouette is stamped at the four neighbours, then the icon on top. 42×32, cached.
function monIconOutlined(num, flip, tint, col) {
  const key = 'o' + num + (flip ? 'f' : '') + (tint || '') + col; let c = SPR.cache[key]; if (c) return c;
  const icon = monIcon(num, flip, tint), sil = document.createElement('canvas'); sil.width = 40; sil.height = 30; const sg = sil.getContext('2d');
  sg.drawImage(icon, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = col; sg.fillRect(0, 0, 40, 30);
  c = document.createElement('canvas'); c.width = 42; c.height = 32; const g = c.getContext('2d');
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.drawImage(sil, dx, dy); g.drawImage(icon, 1, 1);
  SPR.cache[key] = c; return c;
}
// Draw a mon icon centred at (cx, baseline y). Options: flip, tint, alpha, sx/sy scale (squash&stretch), outline (colour).
function drawMon(num, cx, by, o = {}) {
  const img = o.outline ? monIconOutlined(num, !!o.flip, o.tint || null, o.outline) : monIcon(num, !!o.flip, o.tint || null);
  const sx = o.sx || 1, sy = o.sy || 1, pad = o.outline ? 1 : 0; const w = img.width * sx, h = img.height * sy;
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(img, Math.round(cx - w / 2), Math.round(by - h + pad * sy), Math.round(w), Math.round(h));
  if (o.alpha != null) ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- battle sprites (96×96 Gen V fronts, assets/battle/<num>.png)
// Loaded lazily per species and never awaited: the duel scene asks for both combatants when it starts
// and draws the mini icon at 2× until (or if never) the big sprite is ready. Missing files are harmless.
const BIGSPR = { img: {}, state: {}, cache: {}, bottom: {} };
function requestBigSprite(num) {
  if (BIGSPR.state[num] || typeof Image === 'undefined') return;
  BIGSPR.state[num] = 'loading'; const img = new Image();
  img.onload = () => { BIGSPR.img[num] = img; BIGSPR.state[num] = 'ok'; BIGSPR.bottom[num] = spriteBottom(img); };
  img.onerror = () => { BIGSPR.state[num] = 'fail'; };
  img.src = 'assets/battle/' + num + '.png';
}
function bigReady(num) { return BIGSPR.state[num] === 'ok'; }
// Last opaque row, so sprites with transparent margins stand on the ground line. Pixel reads are refused
// for file:// images in some browsers; the default matches the usual margin of the set.
function spriteBottom(img) {
  try { const c = document.createElement('canvas'); c.width = 96; c.height = 96; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, 96, 96).data; for (let y = 95; y >= 0; y--) for (let x = 0; x < 96; x++) if (d[(y * 96 + x) * 4 + 3] > 40) return y + 1; } catch (_) { }
  return 90;
}
// Offscreen copy of one big sprite, optionally mirrored or tinted. Null until the image is ready.
function bigSprite(num, flip = false, tint = null) {
  if (!bigReady(num)) return null; const key = num + (flip ? 'f' : '') + (tint || ''); let c = BIGSPR.cache[key]; if (c) return c;
  c = document.createElement('canvas'); c.width = 96; c.height = 96; const g = c.getContext('2d');
  if (flip) { g.translate(96, 0); g.scale(-1, 1); } g.drawImage(BIGSPR.img[num], 0, 0);
  if (tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = tint; g.fillRect(-96, 0, 192, 96); }
  BIGSPR.cache[key] = c; return c;
}
// Draw a battle sprite standing on baseline `by`, centred on cx. Falls back to the mini icon at 2×.
// ---------------------------------------------------------------- animated battle sprites (assets/battle/anim/<num>.png + ANIM_META)
// Frame sheets packed from the Black/White animated GIFs; loaded lazily like the static sprites. Frames are cut
// into small cached canvases (per frame, flip and tint) so drawing is one drawImage.
const ANIM = { img: {}, state: {}, cache: {}, cum: {} };
function requestAnim(num) {
  if (ANIM.state[num] || typeof Image === 'undefined' || typeof ANIM_META === 'undefined' || !ANIM_META[num]) return;
  ANIM.state[num] = 'loading'; const img = new Image();
  img.onload = () => { ANIM.img[num] = img; ANIM.state[num] = 'ok'; };
  img.onerror = () => { ANIM.state[num] = 'fail'; };
  img.src = 'assets/battle/anim/' + num + '.png';
}
function animReady(num) { return ANIM.state[num] === 'ok'; }
// Frame index at time t (seconds) through the loop; opt.speed scales the playback rate.
function animFrame(num, t, speed = 1) {
  const m = ANIM_META[num]; let cum = ANIM.cum[num]; if (!cum) { cum = ANIM.cum[num] = []; let a = 0; for (const d of m.d) { a += d; cum.push(a); } }
  const total = cum[cum.length - 1]; let ms = ((t * 1000 * speed) % total + total) % total; let i = 0; while (i < cum.length - 1 && ms >= cum[i]) i++; return i;
}
function animFrameCanvas(num, i, flip, tint) {
  const key = num + ':' + i + (flip ? 'f' : '') + (tint || ''); let c = ANIM.cache[key]; if (c) return c;
  const m = ANIM_META[num]; c = document.createElement('canvas'); c.width = m.w; c.height = m.h; const g = c.getContext('2d');
  if (flip) { g.translate(m.w, 0); g.scale(-1, 1); } g.drawImage(ANIM.img[num], (i % m.cols) * m.w, Math.floor(i / m.cols) * m.h, m.w, m.h, 0, 0, m.w, m.h);
  if (tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = tint; g.fillRect(-m.w, 0, 2 * m.w, m.h); }
  ANIM.cache[key] = c; return c;
}
// Draw the animated sprite standing on baseline `by`, centred on cx, at time t. o: flip, tint, alpha, sx, sy, speed.
function drawAnim(num, cx, by, t, o = {}) {
  const m = ANIM_META[num], i = animFrame(num, t, o.speed || 1), img = animFrameCanvas(num, i, !!o.flip, o.tint || null); const sx = o.sx || 1, sy = o.sy || 1;
  const w = m.w * sx, h = m.h * sy, bottom = m.b * sy;
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(img, Math.round(cx - w / 2), Math.round(by - bottom), Math.round(w), Math.round(h));
  if (o.alpha != null) ctx.globalAlpha = 1;
}
function drawBig(num, cx, by, o = {}) {
  const img = bigSprite(num, !!o.flip, o.tint || null); const sx = o.sx || 1, sy = o.sy || 1;
  if (!img) { drawMon(num, cx, by, { flip: o.flip, tint: o.tint, alpha: o.alpha, sx: 2 * sx, sy: 2 * sy }); return; }
  const w = 96 * sx, h = 96 * sy, bottom = (BIGSPR.bottom[num] || 90) * sy; const x = Math.round(cx - w / 2), y = Math.round(by - bottom), W = Math.round(w), H = Math.round(h);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (o.breath) { // idle breathing: the rows above the chest line rise one pixel, the rest stays planted
    const split = Math.round(H * .55); ctx.drawImage(img, 0, Math.round(split / sy), 96, 96 - Math.round(split / sy), x, y + split, W, H - split);
    ctx.drawImage(img, 0, 0, 96, Math.round(split / sy), x, y + split - split - o.breath, W, split);
  } else ctx.drawImage(img, x, y, W, H);
  if (o.alpha != null) ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- audio (synth SFX + tiny sequencer)
const Audio = {
  ac: null, muted: localStorage.getItem('pk_mute') === '1', master: null, musicGain: null, music: null, musicTimer: 0,
  unlock() { if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; } try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ac.createGain(); this.master.gain.value = this.muted ? 0 : .5; this.master.connect(this.ac.destination); this.musicGain = this.ac.createGain(); this.musicGain.gain.value = .35; this.musicGain.connect(this.master); } catch (e) { this.ac = null; } },
  toggle() { this.muted = !this.muted; localStorage.setItem('pk_mute', this.muted ? '1' : '0'); if (this.master) this.master.gain.value = this.muted ? 0 : .5; },
  // One-shot tone: type, freq start→end, duration, volume, optional noise.
  tone(type, f0, f1, dur, vol = .3, t0 = 0, curve = 'exp') {
    if (!this.ac || this.muted) return; const ac = this.ac, t = ac.currentTime + t0;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); else o.frequency.linearRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .02);
  },
  noise(dur, vol = .25, t0 = 0, hp = 800) {
    if (!this.ac || this.muted) return; const ac = this.ac, t = ac.currentTime + t0; const n = ac.sampleRate * dur | 0;
    const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(); s.buffer = buf; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur);
  },
  sfx(name) {
    if (!this.ac || this.muted) return;
    switch (name) {
      case 'cursor': this.tone('square', 880, 880, .04, .08); break;
      case 'ok': this.tone('square', 660, 990, .07, .15); break;
      case 'cancel': this.tone('square', 500, 300, .09, .12); break;
      case 'select': this.tone('triangle', 520, 780, .08, .2); this.tone('square', 1040, 1560, .06, .06, .04); break;
      case 'step': this.tone('triangle', 300, 200, .05, .12); break;
      case 'menu': this.tone('square', 740, 740, .03, .07); break;
      case 'titleFocus': this.tone('triangle', 740, 1110, .045, .1); this.tone('sine', 1480, 1480, .065, .025, .025); break;
      case 'titleConfirm': this.tone('triangle', 440, 330, .045, .15); [660, 880, 1320].forEach((f, i) => this.tone('square', f, f, .07, .055, .035 + i * .035)); break;
      case 'hit': this.noise(.12, .3, 0, 400); this.tone('square', 220, 60, .15, .25); break;
      case 'hit2': this.noise(.1, .25, 0, 1200); this.tone('sawtooth', 320, 90, .12, .2); break;
      case 'crit': this.noise(.25, .4, 0, 300); this.tone('sawtooth', 500, 40, .3, .35); this.tone('square', 1200, 200, .2, .15, .02); break;
      case 'miss': this.tone('sine', 700, 300, .18, .15); break;
      case 'ko': this.tone('square', 400, 30, .5, .3); this.noise(.4, .2, .05, 200); break;
      case 'heal': [523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f, f, .18, .18, i * .07)); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, .12, .12, i * .08)); this.tone('triangle', 1568, 1568, .4, .15, .42); break;
      case 'evolve': for (let i = 0; i < 8; i++) this.tone('square', 440 + i * 110, 440 + i * 110, .1, .1, i * .09); this.tone('triangle', 1760, 880, .6, .2, .75); break;
      case 'catch': this.tone('square', 900, 400, .1, .2); this.tone('square', 400, 400, .1, .2, .3); this.tone('square', 400, 400, .1, .2, .6); break;
      case 'caught': [784, 988, 1175, 1568].forEach((f, i) => this.tone('square', f, f, .15, .15, i * .1)); break;
      case 'escape': this.tone('sawtooth', 300, 700, .25, .15); break;
      case 'phase': this.tone('square', 392, 392, .12, .18); this.tone('square', 523, 523, .12, .18, .12); this.tone('square', 784, 784, .25, .18, .24); break;
      case 'enemyphase': this.tone('square', 392, 392, .12, .18); this.tone('square', 311, 311, .12, .18, .12); this.tone('square', 262, 262, .3, .18, .24); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, .16, .15, i * .11)); break;
      case 'lose': [440, 415, 392, 370, 349].forEach((f, i) => this.tone('square', f, f, .3, .15, i * .22)); break;
      case 'item': this.tone('triangle', 660, 1320, .15, .2); break;
      case 'poison': this.tone('sawtooth', 200, 120, .2, .15); break;
      case 'burn': this.noise(.2, .2, 0, 2000); this.tone('sawtooth', 300, 200, .15, .1); break;
      case 'para': this.tone('square', 1500, 1400, .03, .1); this.tone('square', 1500, 1400, .03, .1, .06); this.tone('square', 1500, 1400, .03, .1, .12); break;
      case 'shake': this.noise(.15, .2, 0, 100); break;
      case 'error': this.tone('square', 200, 180, .12, .15); break;
      case 'text': this.tone('square', 1200, 1100, .015, .03); break;
      case 'boss': this.tone('sawtooth', 110, 55, .6, .3); this.noise(.5, .2, 0, 80); break;
      // duel scene cues: the wipe, a wind-up, one launch sound per attack family, a fainting slump
      case 'wipe': this.noise(.18, .16, 0, 1500); this.tone('sine', 300, 900, .18, .07); break;
      case 'swing': this.noise(.09, .18, 0, 2500); this.tone('sine', 500, 200, .1, .1); break;
      case 'fire': this.noise(.35, .28, 0, 500); this.tone('sawtooth', 160, 60, .35, .16); break;
      case 'water': this.tone('sine', 1000, 300, .22, .16); this.noise(.25, .16, .05, 3000); break;
      case 'elec': for (let i = 0; i < 6; i++) this.tone('square', i % 2 ? 1800 : 1200, i % 2 ? 1500 : 900, .04, .11, i * .045); this.noise(.2, .12, 0, 4000); break;
      case 'grass': [1400, 1100, 1700].forEach((f, i) => this.tone('triangle', f, f * .5, .09, .13, i * .07)); break;
      case 'psy': this.tone('sine', 400, 1400, .45, .14); this.tone('sine', 800, 2800, .45, .05, .02); break;
      case 'beam': this.tone('sawtooth', 300, 1200, .3, .12); this.tone('square', 600, 2400, .3, .05, .03); break;
      case 'faint': this.tone('square', 330, 40, .55, .22); this.tone('triangle', 220, 30, .6, .12, .05); break;
    }
  },
  // Music: a tiny 3-voice step sequencer. Songs are {bpm, bass:[...], lead:[...], arp:[...]} with note numbers (semitones from A3) or null.
  playMusic(name) { if (this.music === name) return; this.music = name; this.step = 0; this.nextAt = 0; },
  stopMusic() { this.music = null; },
  tick() {
    if (!this.ac || this.muted || !this.music) return; const song = SONGS[this.music]; if (!song) return;
    const ac = this.ac, spb = 60 / song.bpm / 2; // eighth notes
    if (!this.nextAt || this.nextAt < ac.currentTime - .5) this.nextAt = ac.currentTime + .05;
    while (this.nextAt < ac.currentTime + .25) {
      const i = this.step % song.len, t = this.nextAt;
      const play = (n, type, vol, dur, oct = 0) => { if (n == null) return; const f = 220 * Math.pow(2, (n + oct * 12) / 12); const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + dur + .02); };
      play(song.bass[i], 'triangle', .5, spb * .9, -1); play(song.lead[i], 'square', .16, spb * .8, 1); if (song.arp) play(song.arp[i], 'square', .07, spb * .5, 2);
      if (song.drum && song.drum[i]) { const n = ac.sampleRate * .05 | 0, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / n); const s = ac.createBufferSource(); s.buffer = buf; const g = ac.createGain(); g.gain.value = song.drum[i] === 2 ? .25 : .12; s.connect(g); g.connect(this.musicGain); s.start(t); }
      this.step++; this.nextAt += spb;
    }
  },
};
// Note helper: string of note names to semitone numbers relative to A3. '.' = rest, '-' = hold (rest for this synth).
function notes(s) { const N = { c: -9, d: -7, e: -5, f: -4, g: -2, a: 0, b: 2 }; return s.trim().split(/\s+/).map(tok => { if (tok === '.' || tok === '-') return null; const m = tok.match(/^([a-g])(#?)(\d)$/); if (!m) return null; return N[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3]) - 3) * 12; }); }
const SONGS = {
  title: { bpm: 112, len: 32, bass: notes('a2 . a2 . f2 . f2 . g2 . g2 . e2 . e2 . a2 . a2 . f2 . f2 . g2 . g2 . c3 . e3 .'), lead: notes('a4 . c5 e5 . d5 c5 . f4 . a4 c5 . b4 a4 . g4 . b4 d5 . c5 b4 . e4 g4 b4 . e5 . d5 . a4 . c5 e5 . d5 c5 . f4 . a4 c5 . b4 a4 . g4 . b4 d5 . c5 b4 . c5 . e5 . a5 . .'), arp: notes('. a5 . e5 . a5 . e5 . f5 . c5 . f5 . c5 . g5 . d5 . g5 . d5 . e5 . b4 . e5 . b4 . a5 . e5 . a5 . e5 . f5 . c5 . f5 . c5 . g5 . d5 . g5 . d5 . c6 . g5 . e5 . c5'), drum: [2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 1, 1, 1] },
  player: { bpm: 126, len: 32, bass: notes('c3 . c3 . c3 . g2 . f2 . f2 . f2 . g2 . c3 . c3 . c3 . g2 . a2 . a2 . f2 . g2 .'), lead: notes('e5 . g5 . c6 . b5 g5 a5 . f5 . a5 . g5 f5 e5 . g5 . c6 . d6 e6 c6 . a5 . f5 . g5 . . .'), arp: notes('c5 e5 g5 e5 c5 e5 g5 e5 f5 a5 c6 a5 f5 a5 c6 a5 c5 e5 g5 e5 c5 e5 g5 e5 a4 c5 e5 c5 f4 a4 g4 b4'), drum: [2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 1, 2, 1] },
  enemy: { bpm: 120, len: 32, bass: notes('a2 . a2 . a2 . g2 . f2 . f2 . f2 . e2 . a2 . a2 . a2 . g2 . f2 . f2 . e2 . e2 .'), lead: notes('a4 . . c5 . b4 a4 . f4 . . a4 . g4 f4 . e4 . . g4 . a4 b4 . c5 . b4 . e4 . . .'), arp: notes('a4 c5 e5 c5 a4 c5 e5 c5 f4 a4 c5 a4 f4 a4 c5 a4 e4 g4 b4 g4 e4 g4 b4 g4 e4 g#4 b4 g#4 e4 g#4 b4 g#4'), drum: [2, 0, 0, 1, 2, 0, 1, 0, 2, 0, 0, 1, 2, 0, 1, 0, 2, 0, 0, 1, 2, 0, 1, 0, 2, 0, 0, 1, 2, 1, 1, 1] },
  boss: { bpm: 140, len: 32, bass: notes('e2 e2 . e2 e2 . e2 . f2 f2 . f2 f2 . f2 . e2 e2 . e2 e2 . e2 . g2 g2 . g2 a2 . b2 .'), lead: notes('e4 . g4 . b4 . e5 . f4 . a4 . c5 . f5 . e5 . d5 . b4 . g4 . a4 . b4 . d5 . e5 .'), arp: notes('e5 b4 g4 b4 e5 b4 g4 b4 f5 c5 a4 c5 f5 c5 a4 c5 e5 b4 g4 b4 e5 b4 g4 b4 g5 d5 b4 d5 a5 e5 c5 e5'), drum: [2, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 1, 2, 2] },
  win: { bpm: 120, len: 16, bass: notes('c3 . g2 . c3 . g2 . f2 . g2 . c3 . c3 .'), lead: notes('c5 e5 g5 c6 . g5 c6 . a5 . b5 . c6 . . .'), arp: notes('e5 g5 c6 g5 e5 g5 c6 g5 f5 a5 g5 b5 c6 e6 c6 g5'), drum: [2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 1, 1, 1] },
  calm: { bpm: 96, len: 32, bass: notes('f2 . . . c3 . . . g2 . . . d3 . . . f2 . . . c3 . . . a2 . . . c3 . . .'), lead: notes('a4 . c5 . e5 . . . g4 . b4 . d5 . . . f4 . a4 . c5 . . . e5 . d5 . c5 . . .'), arp: notes('. f4 a4 c5 . e4 g4 c5 . g4 b4 d5 . f4 a4 d5 . f4 a4 c5 . e4 g4 c5 . a4 c5 e5 . g4 c5 e5') },
};
