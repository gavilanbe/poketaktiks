// Headless test harness: node tools/cdp.cjs <script> — drives index.html over the Chrome DevTools Protocol,
// logs console errors and saves screenshots to artifacts/. Scripts: smoke, flow, enemy, mobile, skirmish, full, art.
const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('/Users/gavilanbe/gavilanbe/page/node_modules/ws');
const path = require('path');
const fs = require('fs');
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = parseInt(process.env.PK_PORT || '9337'); const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  const script = process.argv[2] || 'smoke'; const mobile = script === 'mobile' || script.endsWith('-m');
  const W = mobile ? 390 : 1280, H = mobile ? 844 : 720;
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, '--user-data-dir=/tmp/pk-cdp-profile-' + PORT, 'about:blank'], { stdio: 'ignore' });
  const out = [];
  try {
    let targets = null; for (let i = 0; i < 200 && !targets; i++) { await sleep(200); try { targets = await new Promise((res, rej) => http.get(`http://127.0.0.1:${PORT}/json`, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej)); } catch (e) { } }
    const page = targets.find(t => t.type === 'page'); const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.on('open', r));
    let id = 0; const pending = new Map(); const logs = [];
    ws.on('message', m => { const d = JSON.parse(m); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.args.map(a => a.value || a.description).join(' ')); else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text)); });
    const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ result: {} }); } }, 8000); });
    const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) return 'EXC ' + JSON.stringify(r.result.exceptionDetails.exception.description); return r.result.result ? r.result.result.value : undefined; };
    const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(ROOT, 'artifacts', name + '.png'), Buffer.from(r.result.data, 'base64')); };
    const key = async (k, code) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: code || k, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0 }); await sleep(30); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: code || k }); await sleep(80); };
    const tap = async (x, y) => { if (mobile) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(40); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); } else { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await sleep(30); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await sleep(40); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); } await sleep(150); };
    const move = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await sleep(60); };
    const scale = async () => await ev('__pk.VIEW.scale / __pk.VIEW.dpr');
    const tileCenter = async (tx, ty) => { const s = await scale(); const p = JSON.parse(await ev(`JSON.stringify([(${tx}*32+16-__pk.CAM.x)*__pk.BT.zoom, (${ty}*32+16-__pk.CAM.y)*__pk.BT.zoom])`)); return [p[0] * s, p[1] * s]; };
    const tapTile = async (tx, ty) => { const [x, y] = await tileCenter(tx, ty); await tap(x, y); };
    const hoverTile = async (tx, ty) => { const [x, y] = await tileCenter(tx, ty); await move(x, y); };
    const waitMode = async (m, max = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const cur = await ev('__pk.BT.mode'); if (cur === m) return true; await sleep(100); } out.push('TIMEOUT waiting mode ' + m + ' (now ' + await ev('__pk.BT.mode') + ')'); return false; };
    const waitScene = async (s, max = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (await ev('__pk.SC.name') === s) return true; await sleep(100); } out.push('TIMEOUT waiting scene ' + s + ' (now ' + await ev('__pk.SC.name') + ')'); return false; };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: mobile ? 3 : 1, mobile });
    if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const nav = async q => { await send('Page.navigate', { url: 'file://' + ROOT + '/index.html?' + q }); await sleep(1200); };
    if (script === 'smoke' || script === 'full') {
      await nav('silent&nosave'); out.push('title scene: ' + await ev('__pk.SC.name')); await shot('01-title');
      await nav('ch=1&silent&nosave&seed=3'); await waitMode('idle', 6000); out.push('ch1 mode: ' + await ev('__pk.BT.mode') + ' units=' + await ev('__pk.B.units.length')); await shot('02-ch1-idle');
      const u = JSON.parse(await ev('JSON.stringify(__pk.B.units.filter(u=>u.team===0).map(u=>[u.name,u.x,u.y,u.level,u.hp,u.mov,u.moves.map(m=>m.name)]))')); out.push('party: ' + JSON.stringify(u));
      await hoverTile(u[0][1], u[0][2]); await sleep(200); await tapTile(u[0][1], u[0][2]); await sleep(200); out.push('after select: ' + await ev('__pk.BT.mode'));
      await hoverTile(u[0][1] + 3, u[0][2]); await sleep(300); await shot('03-ch1-move-range');
      await tapTile(u[0][1] + 3, u[0][2]); await waitMode('menu', 4000); await shot('04-ch1-menu'); out.push('menu: ' + await ev('JSON.stringify(__pk.BT.menu.items.map(i=>i.id))'));
      await key('x', 'KeyX'); await sleep(200); out.push('after cancel: ' + await ev('__pk.BT.mode') + ' pos=' + await ev('JSON.stringify([__pk.BT.sel&&__pk.BT.sel.x,__pk.BT.sel&&__pk.BT.sel.y])'));
      await key('x', 'KeyX'); await sleep(200);
      // quick attack: pick the wild Pidgey at (8,3) with Charmander
      await ev('__pk.BT.cx=' + u[0][1] + ';__pk.BT.cy=' + u[0][2]); await key('z', 'KeyZ'); await sleep(200);
      const enemies = JSON.parse(await ev('JSON.stringify(__pk.B.units.filter(u=>u.team!==0).map(u=>[u.name,u.x,u.y,u.team,u.hp]))')); out.push('foes: ' + JSON.stringify(enemies));
      const reach = JSON.parse(await ev('JSON.stringify([...__pk.BT.reach.keys()])')); out.push('reach cells: ' + reach.length);
      // find a foe attackable: use atk cells
      const atk = JSON.parse(await ev('JSON.stringify(__pk.BT.atk)')); let target = enemies.find(e => atk.some(c => c.x === e[1] && c.y === e[2]) || reach.includes(e[1] + ',' + e[2]));
      if (!target) { await key('x', 'KeyX'); await sleep(100); await ev('const c=__pk.B.units.find(u=>u.name==="Charmander"); c.x=7; c.y=3; __pk.BT.cx=7; __pk.BT.cy=3;'); await key('z', 'KeyZ'); await sleep(200); out.push('teleported, mode=' + await ev('__pk.BT.mode')); target = enemies.find(e => e[1] === 8 && e[2] === 3); }
      if (target) { await hoverTile(target[1], target[2]); await tapTile(target[1], target[2]); await waitMode('target', 5000); await shot('05-ch1-forecast'); out.push('forecast mode: ' + await ev('__pk.BT.mode')); await key('z', 'KeyZ'); await sleep(2500); await shot('06-ch1-strike'); await waitMode('idle', 12000); out.push('after attack: ' + await ev('JSON.stringify(__pk.B.units.map(u=>[u.name,u.hp,u.team,u.xp]))')); }
      else out.push('no target reachable');
      await shot('07-ch1-after');
      await key('c', 'KeyC'); await sleep(200); await shot('08-unitinfo'); await key('x', 'KeyX');
      await key('h', 'KeyH'); await sleep(200); await shot('09-help'); await key('x', 'KeyX');
      // end turn and watch the enemy phase
      await ev('__pk.endTurn()'); await sleep(500); await shot('10-enemy-banner'); await waitMode('idle', 30000); out.push('turn now: ' + await ev('__pk.B.turn') + ' hp=' + await ev('JSON.stringify(__pk.B.units.map(u=>[u.name,u.hp]))')); await shot('11-turn2');
    }
    if (script === 'enemy' || script === 'full') {
      // Let the AI fight itself for a few turns by ending turns; checks the game keeps running with no exceptions.
      await nav('ch=3&silent&nosave&seed=5'); await waitMode('idle', 6000);
      for (let t = 0; t < 6; t++) { await ev('__pk.BT.fast=true'); await ev('__pk.endTurn()'); await sleep(300); const ok = await waitMode('idle', 40000); if (!ok) break; if (await ev('__pk.B.result')) break; }
      out.push('ch3 after 6 turns: turn=' + await ev('__pk.B.turn') + ' result=' + await ev('__pk.B.result') + ' alive0=' + await ev('__pk.B.units.filter(u=>u.team===0&&u.hp>0).length') + ' alive1=' + await ev('__pk.B.units.filter(u=>u.team===1&&u.hp>0).length'));
      await shot('12-ch3-ai');
    }
    if (script === 'flow' || script === 'full') {
      await nav('silent&nosave'); await ev('localStorage.clear()'); await nav('silent'); await sleep(300);
      const s = await scale(); const h = JSON.parse(await ev('JSON.stringify(__pk.SC.hits.find(h=>h.label==="NEW GAME"))')); await tap((h.x + h.w / 2) * s, (h.y + h.h / 2) * s); await waitScene('starter'); await shot('13-starter');
      await key('ArrowRight'); await key('z', 'KeyZ'); await waitScene('prep'); await sleep(300); await shot('14-prep');
      const st = JSON.parse(await ev('JSON.stringify(__pk.SC.hits.find(h=>h.label==="START"))')); await tap((st.x + st.w / 2) * s, (st.y + st.h / 2) * s); await waitScene('card'); await shot('15-card'); await waitScene('story', 5000); await sleep(600); await shot('16-story'); await key('x', 'KeyX'); await waitScene('battle'); await waitMode('idle', 6000); out.push('flow battle ok, save=' + !!(await ev('localStorage.getItem("pk_save")')) + ' suspend=' + !!(await ev('localStorage.getItem("pk_suspend")')));
      // win instantly to check results
      await ev('__pk.B.units.filter(u=>u.team===1).forEach(u=>u.hp=0); __pk.endTurn()'); await sleep(1500); await shot('17-victory'); await ev('__pk.BT.endTimer=99'); await sleep(300); await waitScene('story', 5000); await key('x', 'KeyX'); await waitScene('results', 5000); await sleep(300); await shot('18-results'); out.push('results: ' + await ev('JSON.stringify({trained:__pk.SC.data.trained, caught:__pk.SC.data.caught.length, chapter:__pk.SAVE.chapter})'));
      await key('z', 'KeyZ'); await waitScene('prep'); await shot('19-prep2');
    }
    if (script === 'skirmish' || script === 'full') { await nav('skirmish=7&silent&nosave'); await sleep(500); await shot('20-skirmish'); await key('z', 'KeyZ'); await waitScene('prep'); await key('e', 'KeyE'); await waitScene('card'); await waitScene('battle', 6000); await waitMode('idle', 6000); await shot('21-skirmish-battle'); out.push('skirmish units: ' + await ev('__pk.B.units.length')); }
    if (script === 'mobile') { await nav('ch=2&silent&nosave'); await waitMode('idle', 6000); await shot('22-mobile'); const u = JSON.parse(await ev('JSON.stringify(__pk.B.units.filter(u=>u.team===0).map(u=>[u.x,u.y]))')); await tapTile(u[0][0], u[0][1]); await sleep(200); out.push('mobile mode after first tap: ' + await ev('__pk.BT.mode')); await tapTile(u[0][0] + 2, u[0][1]); await sleep(200); out.push('after tile tap: ' + await ev('__pk.BT.mode') + ' path=' + await ev('__pk.BT.path.length')); await shot('23-mobile-path'); await tapTile(u[0][0] + 2, u[0][1]); await waitMode('menu', 4000); await shot('24-mobile-menu');
      await nav('silent&nosave'); await sleep(500); await shot('mobile-title'); await nav('versus=5&silent&nosave'); await sleep(500); await shot('mobile-versus'); for (const k of ['z', 'ArrowRight', 'z', 'z', 'ArrowRight', 'z']) await key(k, k.length === 1 ? 'Key' + k.toUpperCase() : k); await shot('mobile-versus-2'); }

    if (script === 'mech') {
      // evolution: Charmander Lv15 with 95xp attacks the wild Pidgey → level 16 → Charmeleon
      await nav('ch=1&nosave&seed=3'); await waitMode('idle', 6000);
      await ev('const c=__pk.B.units.find(u=>u.name==="Charmander"); c.level=15; c.xp=98; __pk.makeUnit; c.x=7; c.y=3; __pk.BT.cx=7; __pk.BT.cy=3;');
      await ev('(function(){const c=__pk.B.units.find(u=>u.name==="Charmander"); c.maxHp=60; c.hp=60; c.atk=30; c.spa=30;})()');
      await key('z','KeyZ'); await sleep(200); await tapTile(8,3); await waitMode('target', 4000); await key('z','KeyZ'); await sleep(350); await shot('30-strike-mid'); await sleep(1500); await shot('31-levelup'); await sleep(2500); await shot('32-evolve'); await waitMode('idle', 15000);
      out.push('evo: ' + await ev('JSON.stringify(__pk.B.units.filter(u=>u.team===0).map(u=>[u.name,u.num,u.level,u.xp,u.moves.map(m=>m.name)]))'));
      // catch: Squirtle next to the weakened Caterpie
      await ev('(function(){const t=__pk.B.units.find(u=>u.name==="Caterpie"); t.hp=2; const s=__pk.B.units.find(u=>u.name==="Squirtle"); s.x=5; s.y=8; __pk.BT.cx=5; __pk.BT.cy=8;})()');
      await key('z','KeyZ'); await sleep(200); await tapTile(5,8); await waitMode('menu', 4000); out.push('menu with wild adjacent: ' + await ev('JSON.stringify(__pk.BT.menu.items.map(i=>i.id))'));
      await ev('__pk.BT.menu.i=__pk.BT.menu.items.findIndex(i=>i.id==="catch")'); await key('z','KeyZ'); await waitMode('catchTarget', 3000); await shot('33-catch-card'); await key('z','KeyZ'); await waitMode('ballPick', 3000); await shot('34-ballpick'); await key('z','KeyZ'); await sleep(1200); await shot('35-ball-shake'); await waitMode('idle', 15000);
      out.push('captured: ' + await ev('JSON.stringify(__pk.B.captured.map(c=>[c.num,c.level]))') + ' bag=' + await ev('JSON.stringify(__pk.B.bag)'));
      // bag: Bulbasaur uses a potion
      await ev('(function(){const b=__pk.B.units.find(u=>u.name==="Bulbasaur"); b.hp=5; __pk.BT.cx=b.x; __pk.BT.cy=b.y;})()');
      await key('z','KeyZ'); await sleep(200); await key('z','KeyZ'); await waitMode('menu', 4000); await ev('__pk.BT.menu.i=__pk.BT.menu.items.findIndex(i=>i.id==="item")'); await key('z','KeyZ'); await waitMode('item', 3000); await shot('36-bag'); await key('z','KeyZ'); await waitMode('itemTarget', 3000); await key('z','KeyZ'); await waitMode('idle', 8000);
      out.push('after potion: ' + await ev('JSON.stringify(__pk.B.units.filter(u=>u.name==="Bulbasaur").map(u=>[u.hp,u.maxHp]))') + ' bag=' + await ev('JSON.stringify(__pk.B.bag)'));
      // seize on ch4
      await nav('ch=4&silent&nosave'); await waitMode('idle', 6000); await ev('(function(){const u=__pk.B.units.find(u=>u.team===0); u.x=16; u.y=4; __pk.BT.cx=16; __pk.BT.cy=4;})()'); await key('z','KeyZ'); await sleep(200); await key('z','KeyZ'); await waitMode('menu', 4000); out.push('seize menu: ' + await ev('JSON.stringify(__pk.BT.menu.items.map(i=>i.id))')); await key('z','KeyZ'); await sleep(2000); await shot('37-seized'); out.push('ch4 result: ' + await ev('__pk.B.result'));
      // survive on ch7 (lava damage on upkeep too)
      await nav('ch=7&silent&nosave'); await waitMode('idle', 6000); await ev('__pk.B.turn=8; __pk.BT.fast=true; __pk.endTurn()'); await waitMode('end', 60000); out.push('ch7 result at turn 9: ' + await ev('__pk.B.result'));
      // resume: save a suspend on ch2, then reload and resume
      await nav('ch=2&silent'); await waitMode('idle', 6000); await ev('__pk.endTurn()'); await waitMode('idle', 30000); const t = await ev('__pk.B.turn'); await nav('silent'); await sleep(300); const s = await scale(); const h = JSON.parse(await ev('JSON.stringify(__pk.SC.hits.find(h=>h.label==="RESUME BATTLE")||null)')); out.push('resume button: ' + !!h); if (h) { await tap((h.x + h.w / 2) * s, (h.y + h.h / 2) * s); await waitMode('idle', 8000); out.push('resumed turn ' + await ev('__pk.B.turn') + ' (was ' + t + ') units=' + await ev('__pk.B.units.length')); await shot('38-resumed'); }
      await nav('ch=6&silent&nosave'); await waitMode('idle', 6000); await shot('39-ch6'); await nav('ch=8&silent&nosave'); await waitMode('idle', 6000); await shot('40-ch8'); await nav('ch=5&silent&nosave'); await waitMode('idle', 6000); await shot('41-ch5');
    }

    if (script === 'balance') {
      for (let ch = 1; ch <= 8; ch++) { const res = []; for (const seed of [1, 2, 3, 4]) { await nav('ch=' + ch + '&silent&nosave&seed=' + seed); await waitMode('idle', 6000); res.push(await ev('JSON.stringify(__pk.simBattle(30))')); } out.push('ch' + ch + ': ' + res.join(' ')); }
    }

    if (script === 'whatif') {
      const variants = { berserk: 'window.__caut=false', base: '', enemy2: 'B.units.filter(u=>u.team===1).forEach(u=>{u.level=Math.max(1,u.level-2);applyDex(u,u.dex);u.hp=u.maxHp;})', hp20: 'B.units.filter(u=>u.team===0).forEach(u=>{u.maxHp=Math.round(u.maxHp*1.2);u.hp=u.maxHp;})', both: 'B.units.filter(u=>u.team===1).forEach(u=>{u.level=Math.max(1,u.level-2);applyDex(u,u.dex);u.hp=u.maxHp;});B.units.filter(u=>u.team===0).forEach(u=>{u.maxHp=Math.round(u.maxHp*1.2);u.hp=u.maxHp;})', guardall: 'B.units.filter(u=>u.team===1&&!u.boss).forEach(u=>u.ai="guard")' };
      for (const ch of [2, 3, 4, 5, 6, 7, 8]) for (const v of ['berserk', 'base']) { const res = []; for (const seed of [1, 2, 3, 4]) { await nav('ch=' + ch + '&silent&nosave&seed=' + seed); await waitMode('idle', 6000); await ev(variants[v]); const r = JSON.parse(await ev('JSON.stringify(__pk.simBattle(30, window.__caut!==false))')); res.push((r.result||'-')[0] + r.turn + 'p' + r.p + 'e' + r.e); } out.push('ch' + ch + ' ' + v + ': ' + res.join(' ')); }
    }

    if (script === 'trace') { const ch = process.argv[3] || '4'; await nav('ch=' + ch + '&silent&nosave&seed=1'); await waitMode('idle', 6000); await ev('__pk.simBattle(30, true)'); out.push(await ev('__pk.B.simLog.join("\\n")')); }
    if (script === 'sim') { for (let ch = 1; ch <= 8; ch++) { const res = []; for (const seed of [1, 2, 3, 4, 5]) { await nav('ch=' + ch + '&silent&nosave&seed=' + seed); await waitMode('idle', 6000); const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(__pk.simBattle(30, true))', returnByValue: true }); const v = r.result && r.result.result ? JSON.parse(r.result.result.value) : { result: '?' }; res.push((v.result || '-')[0] + v.turn + ' p' + v.p + 'e' + v.e); } out.push('ch' + ch + ': ' + res.join('  ')); } }
    if (script === 'probe') { // ad-hoc: PK_EXPR is evaluated after loading ch1, then a zoomed clip is saved as artifacts/probe.png
      await nav(process.env.PK_NAV || 'ch=1&silent&nosave&seed=3'); await waitMode('idle', 6000); if (process.env.PK_EXPR) out.push('expr: ' + await ev(process.env.PK_EXPR)); await sleep(parseInt(process.env.PK_WAIT || '200'));
      const [ax, ay] = await tileCenter(parseInt(process.env.PK_TX || '3'), parseInt(process.env.PK_TY || '3')); const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: ax - 170, y: ay - 120, width: 340, height: 240, scale: 3 } }); fs.writeFileSync(path.join(ROOT, 'artifacts', 'probe.png'), Buffer.from(r.result.data, 'base64'));
    }
    if (script === 'art') {
      // art review: arrow with corners, danger zone, typed hit effects, KO, and clean chapter views
      await nav('ch=1&silent&nosave&seed=3'); await waitMode('idle', 6000);
      await tapTile(1, 3); await waitMode('move', 3000);
      await ev('__pk.BT.path=[{x:1,y:3},{x:2,y:3},{x:3,y:3},{x:3,y:4},{x:4,y:4},{x:4,y:5},{x:5,y:5}]'); await sleep(150); await shot('art-arrow');
      { const [ax, ay] = await tileCenter(3, 4); const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: ax - 170, y: ay - 120, width: 340, height: 240, scale: 3 } }); fs.writeFileSync(path.join(ROOT, 'artifacts', 'art-arrow-zoom.png'), Buffer.from(r.result.data, 'base64')); }
      { const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 160, y: 60, width: 420, height: 300, scale: 3 } }); fs.writeFileSync(path.join(ROOT, 'artifacts', 'art-tiles-zoom.png'), Buffer.from(r.result.data, 'base64')); }
      await key('x', 'KeyX'); await waitMode('idle', 3000); await ev('__pk.BT.showDanger=true'); await sleep(150); await shot('art-danger'); await ev('__pk.BT.showDanger=false');
      const strike = async (name, ux, uy, tx, ty, type, tag, ko) => {
        await ev(`(function(){const u=__pk.B.units.find(u=>u.name==="${name}"); u.x=${ux}; u.y=${uy}; u.acted=false; u.moved=false; u.hp=u.maxHp; ${type ? `u.moves=[Object.assign({}, u.moves[0], {type:"${type}", name:"${type} Test", rng:[1,2], acc:100})];` : ''} const t=__pk.B.units.find(v=>v.x===${tx}&&v.y===${ty}); if(t){t.hp=${ko ? 1 : 't.maxHp'};} __pk.BT.cx=${ux}; __pk.BT.cy=${uy}; __pk.CAM.tx=__pk.CAM.x; })()`);
        await tapTile(ux, uy); await waitMode('move', 3000); await tapTile(tx, ty); const ok = await waitMode('target', 3000); if (!ok) { out.push('no target for ' + tag); await key('x', 'KeyX'); await key('x', 'KeyX'); return; }
        const [cx, cy] = await tileCenter(tx, ty); const zs = async n => { const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: cx - 110, y: cy - 90, width: 220, height: 150, scale: 3 } }); fs.writeFileSync(path.join(ROOT, 'artifacts', n + '.png'), Buffer.from(r.result.data, 'base64')); };
        await key('z', 'KeyZ'); await sleep(190); await zs(tag + '-1'); await sleep(110); await zs(tag + '-2'); await sleep(130); await zs(tag + '-3'); if (ko) { await sleep(500); await zs(tag + '-4'); }
        await waitMode('idle', 15000);
      };
      await strike('Charmander', 7, 3, 8, 3, null, 'art-fire');
      await strike('Squirtle', 11, 2, 12, 2, null, 'art-water');
      await strike('Bulbasaur', 13, 5, 13, 4, null, 'art-grass');
      await strike('Charmander', 7, 3, 8, 3, 'Electric', 'art-electric');
      await strike('Squirtle', 11, 2, 12, 2, 'Psychic', 'art-psychic');
      await strike('Bulbasaur', 13, 5, 13, 4, 'Rock', 'art-rock');
      await strike('Charmander', 7, 3, 8, 3, 'Ice', 'art-ice');
      await strike('Squirtle', 11, 2, 12, 2, 'Poison', 'art-poison');
      await strike('Bulbasaur', 13, 5, 13, 4, 'Normal', 'art-normal', true);
      out.push('mode after strikes: ' + await ev('__pk.BT.mode'));
      for (const c of [2, 3, 4, 5, 6, 7, 8]) { await nav('ch=' + c + '&silent&nosave&seed=3'); await waitMode('idle', 9000); await sleep(200); await shot('art-ch' + c); const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 80, y: 60, width: 420, height: 300, scale: 3 } }); fs.writeFileSync(path.join(ROOT, 'artifacts', 'art-ch' + c + '-zoom.png'), Buffer.from(r.result.data, 'base64')); }
      await nav('skirmish=7&silent&nosave'); await waitMode('idle', 9000); await sleep(200); await shot('art-skirmish');
    }
    if (script === 'ui') {
      const clip = async (name, x, y, w, h, sc = 3) => { const r = await send('Page.captureScreenshot', { format: 'png', clip: { x, y, width: w, height: h, scale: sc } }); fs.writeFileSync(path.join(ROOT, 'artifacts', name + '.png'), Buffer.from(r.result.data, 'base64')); };
      await nav('silent&nosave'); await sleep(600); await shot('ui-title'); await key('ArrowDown', 'ArrowDown'); await sleep(200); await shot('ui-title-2');
      // versus setup: draft with keys, then start
      await nav('versus=5&silent&nosave'); await sleep(400); await shot('ui-versus-0');
      for (const k of ['z', 'ArrowRight', 'z', 'ArrowRight', 'z', 'ArrowDown', 'z', 'ArrowRight', 'z', 'ArrowRight', 'z', 'ArrowDown', 'z', 'ArrowLeft', 'z']) await key(k, k.length === 1 ? 'Key' + k.toUpperCase() : k);
      await sleep(200); await shot('ui-versus-1'); out.push('teams: ' + await ev('JSON.stringify(__pk.SC.data.teams)'));
      await key('e', 'KeyE'); await waitMode('handoff', 6000); await sleep(600); await shot('ui-handoff-p1'); out.push('scene/mode: ' + await ev('__pk.SC.name + "/" + __pk.BT.mode + " humans=" + JSON.stringify(__pk.B.humans)'));
      await key('z', 'KeyZ'); await waitMode('idle', 8000); await shot('ui-vs-idle');
      const p1 = JSON.parse(await ev('JSON.stringify(__pk.B.units.filter(u=>u.team===0).map(u=>[u.name,u.x,u.y]))')); out.push('p1: ' + JSON.stringify(p1));
      await tapTile(p1[0][1], p1[0][2]); await waitMode('move', 3000); await shot('ui-vs-move'); await key('x', 'KeyX'); await waitMode('idle', 3000);
      await ev('__pk.endTurn()'); await waitMode('handoff', 20000); await sleep(600); await shot('ui-handoff-p2'); out.push('phase now: ' + await ev('__pk.B.phase'));
      await key('z', 'KeyZ'); await waitMode('idle', 8000);
      const p2 = JSON.parse(await ev('JSON.stringify(__pk.B.units.filter(u=>u.team===1).map(u=>[u.name,u.x,u.y]))')); out.push('p2: ' + JSON.stringify(p2));
      await tapTile(p2[0][1], p2[0][2]); const okm = await waitMode('move', 3000); out.push('p2 can move: ' + okm); await shot('ui-vs-p2-move'); await key('x', 'KeyX'); await waitMode('idle', 3000);
      await ev('__pk.B.units.filter(u=>u.team===0).forEach(u=>u.hp=0); __pk.endTurn()'); await waitMode('end', 8000); await sleep(1000); await shot('ui-vs-end');
      await key('z', 'KeyZ'); await waitScene('results', 8000); await sleep(300); await shot('ui-vs-results'); out.push('result: ' + await ev('JSON.stringify(__pk.SC.data && __pk.SC.data.result)'));
      // battle UI close-ups on chapter 1
      await nav('ch=1&silent&nosave&seed=3'); await waitMode('idle', 6000);
      await ev('(function(){const c=__pk.B.units.find(u=>u.name==="Charmander"); c.x=7; c.y=3; __pk.BT.cx=7; __pk.BT.cy=3;})()');
      await tapTile(7, 3); await waitMode('move', 3000); await tapTile(8, 3); await waitMode('target', 3000); await sleep(200); await shot('ui-forecast'); await clip('ui-forecast-zoom', 0, 50, 440, 240);
      await key('x', 'KeyX'); await waitMode('menu', 3000); await key('x', 'KeyX'); await waitMode('move', 3000); await key('x', 'KeyX'); await waitMode('idle', 3000);
      await tapTile(7, 3); await waitMode('move', 3000); await tapTile(7, 3); await waitMode('menu', 4000); await sleep(200); { const [cx, cy] = await tileCenter(7, 3); await clip('ui-menu-zoom', cx - 60, cy - 80, 320, 200); }
      await key('x', 'KeyX'); await waitMode('move', 3000); await key('x', 'KeyX'); await waitMode('idle', 3000); await clip('ui-terrain-zoom', 1000, 620, 280, 100); await key('x', 'KeyX'); await waitMode('endmenu', 3000); await sleep(200); await shot('ui-endmenu'); { const [cx, cy] = await tileCenter(7, 3); await clip('ui-endmenu-zoom', cx - 40, cy - 60, 320, 200); }
    }
    if (script === 'ui2') {
      // every non-battle screen plus the modal cards, for design review
      await nav('silent&nosave'); await sleep(500); await ev('__pk.startNewGame()'); await waitScene('starter', 5000); await sleep(300); await shot('ui2-starter');
      await nav('ch=1&prep&silent&nosave'); await waitScene('prep', 5000); await sleep(300); await shot('ui2-prep');
      await nav('silent&nosave'); await sleep(500); await ev('__pk.startSkirmishSetup()'); await waitScene('skirmish', 5000); await sleep(300); await shot('ui2-skirmish');
      await nav('territory=3&silent&nosave&noguide'); await sleep(500); await shot('ui2-territory-setup');
      await nav('territory=3&auto&silent&nosave'); await waitMode('territoryGuide', 8000); await sleep(300); await shot('ui2-territory-guide'); await key('z', 'KeyZ'); await waitMode('idle', 5000); await sleep(200); await shot('ui2-territory-idle');
      await nav('ch=1&silent&nosave&seed=3'); await waitMode('idle', 6000);
      await key('h', 'KeyH'); await sleep(200); await shot('ui2-help'); await key('z', 'KeyZ'); await sleep(200); await shot('ui2-help-2'); await key('x', 'KeyX'); await sleep(200);
      await ev('__pk.BT.cx=8; __pk.BT.cy=3'); await key('c', 'KeyC'); await sleep(200); await shot('ui2-unitsheet'); await key('x', 'KeyX'); await sleep(200);
      await ev('(function(){const c=__pk.B.units.find(u=>u.name==="Charmander"); c.x=7; c.y=3; __pk.BT.cx=7; __pk.BT.cy=3;})()'); await sleep(200); await shot('ui2-hover');
      await tapTile(7, 3); await waitMode('move', 3000); await tapTile(7, 3); await waitMode('menu', 4000); await key('ArrowDown'); await key('ArrowDown'); await key('z', 'KeyZ'); await sleep(200); await shot('ui2-bag'); await key('x', 'KeyX'); await sleep(100); await key('x', 'KeyX'); await sleep(100); await key('x', 'KeyX'); await waitMode('idle', 3000);
      await ev('__pk.B.units.filter(u=>u.team!==0).forEach(u=>u.hp=0); __pk.endTurn()'); await waitMode('end', 8000); await sleep(1000); await shot('ui2-victory'); await key('z', 'KeyZ'); await waitScene('story', 8000); await sleep(1200); await shot('ui2-story'); await key('x', 'KeyX'); await waitScene('results', 8000); await sleep(300); await shot('ui2-results');
    }
    if (script === 'duel' || script === 'duel-m') {
      // the lateral attack scene, frame by frame
      await nav('ch=1&silent&nosave&seed=3'); await waitMode('idle', 6000); await ev("setPref('battle','full')");
      await ev('(function(){const c=__pk.B.units.find(u=>u.name==="Charmander"); c.x=7; c.y=3; __pk.BT.cx=7; __pk.BT.cy=3;})()');
      if (process.env.PK_KO) await ev('__pk.B.units.find(u=>u.x===8&&u.y===3).hp=1');
      await tapTile(7, 3); await waitMode('move', 3000); await tapTile(8, 3); await waitMode('target', 3000); await key('z', 'KeyZ');
      const t0 = Date.now(); let i = 0; while (Date.now() - t0 < 4200) { await shot((mobile ? 'duelm-' : 'duel-') + String(i).padStart(2, '0')); i++; await sleep(60); }
      out.push('mode after: ' + await ev('__pk.BT.mode'));
    }
    out.push('--- console ---'); out.push(...logs.slice(0, 40));
  } finally { chrome.kill(); }
  console.log(out.join('\n'));
}
main().catch(e => { console.error(e); process.exit(1); });
