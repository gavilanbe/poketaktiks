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
const PREF = { battle: 'full' };
const PREF_VALUES = { battle: ['full', 'quick', 'map'] };
try { for (const k in PREF) { const v = localStorage.getItem('pk_' + k); if (PREF_VALUES[k].includes(v)) PREF[k] = v; } } catch (_) { }
function setPref(k, v) { if (!PREF_VALUES[k].includes(v)) return; PREF[k] = v; try { localStorage.setItem('pk_' + k, v); } catch (_) { } }
function cyclePref(k) { const vs = PREF_VALUES[k]; setPref(k, vs[(vs.indexOf(PREF[k]) + 1) % vs.length]); return PREF[k]; }

function resize() {
  const cw = innerWidth, ch = innerHeight, dpr = Math.min(devicePixelRatio || 1, 3);
  const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
  // Pick the integer scale that leaves ~440 logical pixels of width (never below 1).
  let s = Math.max(1, Math.round(pw / (ph > pw ? 400 : 560)));
  if (pw / s < 300) s = Math.max(1, Math.floor(pw / 300));
  VIEW.scale = s; VIEW.dpr = dpr;
  VIEW.w = Math.floor(pw / s); VIEW.h = Math.floor(ph / s);
  cv.width = pw; cv.height = ph; cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  ctx.setTransform(s, 0, 0, s, 0, 0); ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- RNG
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
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
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right', z: 'ok', Z: 'ok', Enter: 'ok', ' ': 'ok', x: 'back', X: 'back', Escape: 'back', Backspace: 'back', q: 'prev', e: 'next', Q: 'prev', E: 'next', Tab: 'next', c: 'info', C: 'info', m: 'mute', M: 'mute', h: 'help', H: 'help', f: 'fast', F: 'fast', '+': 'zoomin', '-': 'zoomout', '=': 'zoomin' };
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

// UI palette (FE/Pokémon-menu flavored)
const UI = {
  panel: '#1c2a4a', panel2: '#25355c', panelDark: '#101a30', border: '#e8dfc2', border2: '#8c7e5a', ink: '#f6f2e6', muted: '#a6b0c8',
  gold: '#ffd24a', red: '#ff5a5a', green: '#5ee06a', blue: '#5aa8ff', shadow: '#0b1020', hi: '#ffffff', menuSel: '#3a5088',
  bg: '#0e0c10', hpGreen: '#48d05a', hpYellow: '#f4c430', hpRed: '#f04848', hpBack: '#2b2b33',
};
// 9-slice-ish panel: dark fill, cream border, dark outer shadow line, inner highlight.
function panel(x, y, w, h, opt = {}) {
  x |= 0; y |= 0; w |= 0; h |= 0;
  const fill = opt.fill || UI.panel, border = opt.border || UI.border;
  rrect(x + 1, y + 1, w, h, UI.shadow, 2);                 // drop shadow
  rrect(x, y, w, h, border, 2);
  rrect(x + 1, y + 1, w - 2, h - 2, opt.border2 || UI.border2, 1);
  rrect(x + 2, y + 2, w - 4, h - 4, fill, 1);
  if (!opt.flat) { hline(x + 3, y + 2, w - 6, shade(fill, .18)); vline(x + 2, y + 3, h - 6, shade(fill, .1)); hline(x + 3, y + h - 3, w - 6, shade(fill, -.3)); vline(x + w - 3, y + 3, h - 6, shade(fill, -.2)); }
  // corner rivets on the cream frame
  for (const [cx, cy] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) px(cx, cy, opt.border2 || UI.border2);
  if (opt.title) { const tw = textWidth(opt.title) + 8; rrect(x + 6, y - 4, tw, 9, border, 1); rrect(x + 7, y - 3, tw - 2, 7, UI.panelDark, 0); text(opt.title, x + 10, y - 3, UI.gold); }
}
function bar(x, y, w, h, ratio, col, back = UI.hpBack) { rect(x, y, w, h, back); const f = Math.round(clamp(ratio, 0, 1) * (w - 2)); if (f > 0) { rect(x + 1, y + 1, f, h - 2, col); hline(x + 1, y + 1, f, shade(col, .35)); } outline(x, y, w, h, UI.shadow); }
function hpColor(r) { return r > .5 ? UI.hpGreen : r > .2 ? UI.hpYellow : UI.hpRed; }
function hpBar(x, y, w, cur, max) { bar(x, y, w, 5, cur / max, hpColor(cur / max)); }

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
// Draw a mon icon centred at (cx, baseline y). Options: flip, tint, alpha, sx/sy scale (squash&stretch), dy hop.
function drawMon(num, cx, by, o = {}) {
  const img = monIcon(num, !!o.flip, o.tint || null);
  const sx = o.sx || 1, sy = o.sy || 1; const w = 40 * sx, h = 30 * sy;
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(img, Math.round(cx - w / 2), Math.round(by - h), Math.round(w), Math.round(h));
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
function drawBig(num, cx, by, o = {}) {
  const img = bigSprite(num, !!o.flip, o.tint || null); const sx = o.sx || 1, sy = o.sy || 1;
  if (!img) { drawMon(num, cx, by, { flip: o.flip, tint: o.tint, alpha: o.alpha, sx: 2 * sx, sy: 2 * sy }); return; }
  const w = 96 * sx, h = 96 * sy, bottom = (BIGSPR.bottom[num] || 90) * sy;
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(img, Math.round(cx - w / 2), Math.round(by - bottom), Math.round(w), Math.round(h));
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
