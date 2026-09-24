// ============================================================================
// i18n.js — languages. The game is written in English; in Spanish (from Spain, the default) every string drawn or
// measured goes through TRX(), which looks it up in ES (lang/es.js) exactly or in its upper-case form, so what is
// measured is what is drawn. Phrases built from parts use templates: TR('{0} ready', n). Data shown in pieces
// (commanders, roles, chapters...) is translated in place by applyLang(), which keeps the English originals.
// ============================================================================
'use strict';
const LANGS = ['es', 'en'], LANG_NAME = { es: 'Español', en: 'English' };
let LANG = 'es';
try { const q = new URLSearchParams(location.search).get('lang'), v = LANGS.includes(q) ? q : localStorage.getItem('pk_lang'); if (LANGS.includes(v)) LANG = v; } catch (_) { }
const ES = {};                // English → Spanish (lang/es.js fills it)
const TRMAP = new Map();      // ES and its upper-case forms, built on first use
// When a string has no entry, a few patterns still carry it across: levels (Lv5 → Nv5) and decimals (×1.5 → ×1,5).
const ES_RULES = [[/\bLv ?(\d)/g, m => m.replace('Lv', 'Nv')], [/×(\d+)\.(\d+)/g, (m, a, b) => '×' + a + ',' + b], [/\bHP\b/g, () => 'PS']];
const TRRULE = new Map();
let TRMISS = null, TROUT = null; // tools: a Map counting lookups that found nothing, and a Set of text that is already translated
function trBuild() { TRMAP.clear(); for (const k in ES) { TRMAP.set(k, ES[k]); const U = k.toUpperCase(); if (U !== k && !TRMAP.has(U)) TRMAP.set(U, ES[k].toUpperCase()); } }
function trNote(s) { if (TROUT && typeof s === 'string') TROUT.add(s); return s; }
function TRX(s) {
  if (LANG === 'en' || typeof s !== 'string' || !s) return s; if (!TRMAP.size) trBuild();
  const v = TRMAP.get(s); if (v != null) return v;
  let r = TRRULE.get(s); if (r === undefined) { r = s; for (const [re, fn] of ES_RULES) r = r.replace(re, fn); if (TRRULE.size > 4000) TRRULE.clear(); TRRULE.set(s, r); }
  if (TRMISS && r === s && /[A-Za-z]{2}/.test(s) && !(TROUT && TROUT.has(s))) TRMISS.set(s, (TRMISS.get(s) || 0) + 1);
  return r;
}
// TR(key, ...args): the key's translation with {0}, {1}... filled. A key may carry a context after '|' ('ON|power')
// when one English word needs two translations; English shows the part before the '|'.
function TR(s, ...a) { let out; if (typeof s === 'string' && s.includes('|')) { const base = s.slice(0, s.indexOf('|')); out = LANG === 'en' ? base : (TRMAP.size || trBuild(), TRMAP.has(s) ? TRMAP.get(s) : TRX(base)); } else out = TRX(s); if (a.length) out = String(out).replace(/\{(\d)\}/g, (m, i) => a[+i] != null ? a[+i] : ''); return trNote(out); }
function setLang(l) { if (!LANGS.includes(l)) return; LANG = l; try { localStorage.setItem('pk_lang', l); } catch (_) { } applyLang(); }
function pageLang() { try { document.documentElement.lang = LANG; } catch (_) { } } // the page says which language it speaks
// A multiplier in the language's style: ×1.5 / ×1,5.
function fmtMult(x) { return '×' + (LANG === 'es' ? String(x).replace('.', ',') : x); }
// Money in the language's style: ₽1,000 / ₽1.000.
function fmtNum(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, LANG === 'es' ? '.' : ','); }

// ---------------------------------------------------------------- data shown in pieces, translated in place
const I18N_ORIG = new WeakMap();
function tf(o, k) { if (!o || typeof o[k] !== 'string') return; let m = I18N_ORIG.get(o); if (!m) I18N_ORIG.set(o, m = {}); if (!(k in m)) m[k] = o[k]; o[k] = TRX(m[k]); }
function applyLang() {
  // runs after every module has loaded (at boot and when the language changes), so the tables below all exist
  TRMAP.clear(); TRRULE.clear(); pageLang(); const each = (obj, fn) => { for (const k in obj) if (obj[k] && typeof obj[k] === 'object') fn(obj[k], k); }, fields = (o, ...ks) => { for (const k of ks) tf(o, k); };
  each(ROLES, r => fields(r, 'name', 'abbr', 'desc'));
  each(SKILLS, s => fields(s, 'name', 'blurb', 'menu'));
  each(STATUS, s => fields(s, 'name', 'text'));
  each(ITEMS, s => fields(s, 'name', 'desc'));
  each(WEATHER, s => { for (const k in s) if (typeof s[k] === 'string') tf(s, k); });
  each(BIOMES, b => fields(b, 'name'));
  each(SK_DIFF, d => fields(d, 'name'));
  each(SKIRMISH.sizes, s => tf(s, 2));
  each(VS_MODES, m => fields(m, 'name', 'short', 'blurb'));
  each(VS_ARENAS, a => fields(a, 'name'));
  each(COS, c => { fields(c, 'name', 'blurb'); for (const p of [c.passive, c.power, c.super]) if (p) fields(p, 'name', 'text'); });
  each(CAPTAINS, c => fields(c, 'style', 'name', 'superName', 'role', 'normal', 'super'));
  for (const ch of CHAPTERS) { fields(ch, 'title', 'brief', 'label'); for (const l of (ch.intro || []).concat(ch.outro || [])) fields(l, 'text'); } // map names stay English (boardMood reads them); text() translates them
  for (const l of PROLOGUE) fields(l, 'text');
  for (const f of TOWER) fields(f, 'quote', 'beaten', 'won');
  for (const t of SAFARI.tiers) fields(t, 'name');
  each(TERRAIN, t => fields(t, 'name'));
  for (const m of QUICK_MODES) { fields(m, 'tag', 'goal'); if (m.lines) m.lines.forEach((_, i) => tf(m.lines, i)); }
}
// Move and type names stay English in the data (saves and the rules use them); they are translated where shown.
function mvName(m) { return TR(typeof m === 'string' ? m : m.name); }
function typeName(t) { return TR(t); }
// Tools: with localStorage pk_trmiss_on set, strings drawn without a translation are collected into pk_trmiss.
try { if (localStorage.getItem('pk_trmiss_on')) { TRMISS = new Map(); TROUT = new Set(); const flush = () => { try { const all = JSON.parse(localStorage.getItem('pk_trmiss') || '{}'); for (const [k, n] of TRMISS) all[k] = (all[k] || 0) + n; TRMISS.clear(); localStorage.setItem('pk_trmiss', JSON.stringify(all)); } catch (_) { } }; setInterval(flush, 1000); addEventListener('beforeunload', flush); } } catch (_) { }
// A move's side effect as the forecast lists it ("10% BRN", "drains 50%", "high crit", "must recharge").
function effText(e) { const m = /^drains (\d+)%$/.exec(e); return m ? TR('drains {0}%', m[1]) : TRX(e); }
