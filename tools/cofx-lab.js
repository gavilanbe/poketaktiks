// Browser-side lab for `node tools/cdp.cjs cofx`: calls chosen commanders' powers in a Versus battle and paints chosen
// moments of each (the cast, the sweep over the field, and the board afterwards with its auras) into one sheet, a row per
// power. spec: { rows: [['brock', 4, true], ['you', 7, false], ...] (commander, the Tactician's partner, super?),
//   moments: [seconds...] (a moment past the end shows the board once the queue has played) }. Evaluated in the page.
(function () {
  const setup = ([co, cap]) => { launchVersus({ seed: 5, level: 30, wild: false, mode: 'elim', arena: 'm', fog: false, turns: 30, co0: co, co1: co === 'you' ? 'brock' : co, cap0: cap || 4, cap1: 7, teams: [[25, 6, 9, 3], [7, 133, 1, 4]], order: [0, 1, 1, 0, 0, 1, 1, 0], size: 4, cur: 0 }); B.phase = 0; BT.mode = 'idle'; for (const u of B.units) u.hp = Math.max(1, Math.round(u.maxHp * .6)); };
  window.cofxLabPrepare = spec => { for (const [co] of spec.rows) { const C = COS[co] || COS.you; trainerImg(C.tr); if (C.ace) { requestAnim(C.ace); requestBigSprite(C.ace); } } for (const n of [25, 6, 9, 3, 7, 133, 1, 4, 5, 8, 2]) requestAnim(n); return 'ok'; };
  window.cofxLabRender = spec => {
    const cv = document.getElementById('c'), cw = VIEW.w > VIEW.h ? 320 : 180, ch = Math.round(cw * VIEW.h / VIEW.w), M = spec.moments || [.35, .8, 1.3, 2.1, 3.0, 3.5, 99], out = document.createElement('canvas'); out.width = 90 + M.length * (cw + 2); out.height = spec.rows.length * (ch + 2); const g = out.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#18181c'; g.fillRect(0, 0, out.width, out.height);
    spec.rows.forEach((row, r) => { setup(row); const s = powerState(0); s.charge = 100; s.superUnlocked = true; const ev = activatePower(0, !!row[2]); if (!ev) return; BT.queue = ev.map(e => ({ kind: 'event', ev: e })); let T = 0; playQueue(() => { BT.mode = 'idle'; });
      M.forEach((m, c) => { let n = 0; while (T < m && BT.mode === 'anim' && n++ < 2000) { battleUpdate(1 / 60); T += 1 / 60; } ctx.setTransform(VIEW.scale, 0, 0, VIEW.scale, 0, 0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; battleDraw(); g.drawImage(cv, 0, 0, cv.width, cv.height, 90 + c * (cw + 2), r * (ch + 2), cw, ch); });
      g.fillStyle = '#ffffff'; g.font = '11px monospace'; g.fillText(row[0] + (row[0] === 'you' ? ' ' + row[1] : ''), 4, r * (ch + 2) + 14); g.fillStyle = '#a0a0b0'; g.fillText(row[2] ? 'SUPER' : 'power', 4, r * (ch + 2) + 28);
      BT.queue = []; BT.anim = null; BT.mode = 'idle'; });
    const old = document.getElementById('cofxlab'); if (old) old.remove(); out.id = 'cofxlab'; const dpr = window.devicePixelRatio || 1;
    out.style.cssText = 'position:absolute;left:0;top:0;z-index:99999;image-rendering:pixelated;width:' + out.width / dpr + 'px;height:' + out.height / dpr + 'px';
    document.body.appendChild(out); return JSON.stringify({ w: out.width / dpr, h: out.height / dpr });
  };
})();
