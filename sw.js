// ============================================================================
// sw.js — POKÉTAKTIKS offline and updates. build.sh stamps VERSION (and the trainer list) on every build, so each
// deploy is a new worker: the browser installs it in the background while the old version keeps playing, and the
// game offers the switch on the title screen (it never reloads under a battle). The shell (the page, the manifest,
// the icons, the Pokémon icon sheet and the trainers) is kept per version; battle sprites are kept across versions
// once seen, and the game can ask for all of them to be fetched so the whole thing plays offline.
// ============================================================================
'use strict';
const VERSION = 'd8a47673';
const TRAINERS = ['beauty.png','biker.png','bill.png','birdkeeper.png','blackbelt.png','blaine.png','blue.png','brock.png','bugcatcher.png','burglar.png','camper.png','erika.png','fisherman.png','gentleman.png','giovanni.png','hiker.png','juggler.png','koga.png','lass.png','ltsurge.png','misty.png','nurse.png','oak.png','psychic.png','red.png','rocketgrunt.png','rocketgruntf.png','sabrina.png','scientist.png','supernerd.png','swimmer.png','teamrocket.png','youngster.png'];
const SPRITE_SET = '173a3923';
const CORE = 'pk-core-' + VERSION, SPRITES = 'pk-sprites-' + SPRITE_SET; // the sprites' cache changes only when the sprites do
const SHELL = ['./manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png', './icons/shortcut-flag.png', './icons/shortcut-vs.png', './icons/shortcut-crown.png', './assets/pokemonicons-sheet.png'].concat(TRAINERS.map(t => './assets/trainers/' + t));
const fresh = u => new Request(u, { cache: 'no-cache' }); // revalidated with the server: a new version never stores an old file (and an unchanged one costs a 304)

// install: keep the new version's page and shell; it waits until the player chooses to switch (or every tab has closed).
// The page must be this version's (a CDN still serving the old one fails the install, and the browser tries again).
self.addEventListener('install', e => { e.waitUntil((async () => {
  const c = await caches.open(CORE), page = await fetch(fresh('./index.html'));
  if (!page.ok) throw new Error('page ' + page.status);
  if (VERSION !== 'dev' && !(await page.clone().text()).includes("const PK_BUILD = '" + VERSION + "'")) throw new Error('the page is not version ' + VERSION + ' yet');
  await c.put('./index.html', page); await c.addAll(SHELL.map(fresh));
})()); });
// activate: drop older versions' shells (and sprites, when they changed), take the open pages
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('pk-core-') && k !== CORE) || (k.startsWith('pk-sprites-') && k !== SPRITES)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => {
  const m = e.data || {};
  if (m.type === 'SKIP_WAITING') self.skipWaiting();
  else if (m.type === 'VERSION' && e.source) e.source.postMessage({ type: 'VERSION', version: VERSION });
  else if (m.type === 'WARM') e.waitUntil(warm(m.urls || [])); // every battle sprite, a few at a time, so the game plays offline
});
async function warm(urls) { const c = await caches.open(SPRITES); for (let i = 0; i < urls.length; i += 6) await Promise.all(urls.slice(i, i + 6).map(async u => { try { if (!(await c.match(u))) { const r = await fetch(u); if (r.ok) await c.put(u, r); } } catch (_) { } })); }
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  // the page: this version's copy at once (deep links like ?versus=1 included); the network if it is missing
  if (req.mode === 'navigate') { e.respondWith(caches.open(CORE).then(c => c.match('./index.html')).then(hit => hit || fetch(req))); return; }
  // battle sprites: once fetched, kept across versions
  if (url.pathname.includes('/assets/battle/') || url.pathname.includes('/assets/terrain/')) { e.respondWith(caches.open(SPRITES).then(async c => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; })); return; }
  // everything else in the shell: this version's copy, else the network
  e.respondWith(caches.open(CORE).then(c => c.match(req, { ignoreSearch: true })).then(hit => hit || fetch(req)));
});
