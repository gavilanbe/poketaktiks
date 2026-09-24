// Browser-side attack lab for `node tools/cdp.cjs fx`: plays chosen moves through the real exchange code (resolveCombat,
// the duel scene or the board strike, updateFX) with a fixed clock, and paints chosen moments of each into one sheet:
// a row per move, a column per moment. Evaluated in the page; defines fxLabPrepare(spec) and fxLabRender(spec).
// spec: { moves: ['Ember', ...], view: 'duel' | 'board', att: dex number (else one of the move's type), def: dex number,
//         level, crit: true (every strike crits), miss: true (every strike misses), frames: [moments] }
(function () {
  const speciesFor = type => { for (const n of [6, 9, 3, 25, 131, 68, 89, 51, 18, 65, 123, 76, 94, 149, 143, 82, 36, 59, 45, 34, 112, 121, 142]) { const d = DEX[n]; if (d && d.types.includes(type)) return n; } for (const k in DEX) if (DEX[k].types.includes(type)) return +k; return 25; };
  const pick = (spec, name) => spec.att || speciesFor(MOVES[name].type);
  window.fxLabPrepare = spec => { const nums = new Set([spec.def || 66]); for (const m of spec.moves) nums.add(pick(spec, m)); for (const n of nums) { requestBigSprite(n); requestAnim(n); } return [...nums].join(','); };
  window.fxLabRender = spec => {
    // moments: by default the same beats of each move's own timing (wind-up, travel, impact, aftermath)
    const duel = (spec.view || 'duel') === 'duel', AUTO = duel ? [['w', .6], ['l', .35], ['l', .85], ['i', .04], ['i', .16], ['i', .4]] : [.2, .36, .44, .5, .6, .8], FR = spec.frames || AUTO;
    const sc = spec.scale || (duel ? .25 : .5), cw = duel ? Math.round(cv.width * sc) : Math.round(6 * TILE * BT.zoom * VIEW.scale * sc), ch = duel ? Math.round(cv.height * sc) : Math.round(3 * TILE * BT.zoom * VIEW.scale * sc);
    const out = document.createElement('canvas'); out.width = FR.length * (cw + 2) + 90; out.height = spec.moves.length * (ch + 2); const g = out.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#202024'; g.fillRect(0, 0, out.width, out.height);
    const keep = { battle: PREF.battle, rnd };
    spec.moves.forEach((name, row) => {
      const mv = MOVES[name]; if (!mv) return; const far = mv.rng[0] >= 2 || (spec.far && mv.rng[1] >= 2);
      startBattle({ name: 'lab', seed: 3, rows: ['.........', '.........', '.........', '.........', '.........'], deploy: [], units: [], objective: { type: 'rout' } }, [], { pokeball: 1 }, { defer: true, seed: 5 });
      if (SC.name !== 'battle') { SC.name = 'battle'; }
      const a = makeUnit(pick(spec, name), spec.level || 40, 0, { x: 3, y: 2 }), d = makeUnit(spec.def || 66, spec.level || 40, 1, { x: far ? 5 : 4, y: 2 }); B.units.push(a, d);
      d.hp = d.maxHp = 999; d.moves = []; a.moves = [mv]; B.phase = 0; BT.fast = false; FX.parts = []; FX.sprites = []; FX.texts = []; FX.hitstop = 0; FX.shake = 0; FX.flash = 0; // no counter: one strike a row
      PREF.battle = duel ? 'full' : 'map'; rnd = spec.crit ? (() => .001) : spec.miss ? (() => .999) : (() => .5);
      BT.queue = combatQueue(a, d, mv, a); rnd = keep.rnd; let finished = false; playQueue(() => { finished = true; BT.mode = 'idle'; });
      centerCam(3.5 + (far ? .5 : 0), 2); CAM.x = CAM.tx; CAM.y = CAM.ty;
      // the clock the moments are measured on: the scene clock from the strike's wind-up, or the strike's own clock
      const q0 = BT.anim, S = duel && q0 && q0.script, wb = S ? S.beats.find(b => b.kind === 'windup') : null, w0 = wb ? wb.t : 0, lb = S ? S.beats.find(b => b.kind === 'launch') : null, ib = S ? S.beats.find(b => b.kind === 'impact' || b.kind === 'miss') : null;
      const at = f => !Array.isArray(f) ? f : f[0] === 'w' ? wb.dur * f[1] : f[0] === 'l' ? lb.t - w0 + lb.dur * f[1] : ib.t - w0 + f[1]; // a moment in seconds from the wind-up
      const now = () => duel ? (q0.t - w0) : (BT.anim === q0 ? q0.t : 99);
      let step = 0; const dt = 1 / 60; let boardT = 0;
      FR.forEach((ft, col) => {
        if (duel) { const tt = at(ft); while (!q0.done && now() < tt && step++ < 4000) battleUpdate(dt); }
        else { const tt = Array.isArray(ft) ? 0 : spec.frames ? ft : ft * q0.dur; while (boardT < tt && step++ < 4000) { battleUpdate(dt); boardT += dt; } }
        ctx.setTransform(VIEW.scale, 0, 0, VIEW.scale, 0, 0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1;
        if (duel) { if (q0.done) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW.w, VIEW.h); } else battleDraw(); g.drawImage(cv, 0, 0, cv.width, cv.height, 90 + col * (cw + 2), row * (ch + 2), cw, ch); }
        else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW.w, VIEW.h); drawBoard(); const k = BT.zoom * VIEW.scale, sx = Math.round(((3 - 1) * TILE - CAM.x) * k), sy = Math.round(((2 - 1) * TILE - CAM.y) * k); g.drawImage(cv, sx, sy, 6 * TILE * k, 3 * TILE * k, 90 + col * (cw + 2), row * (ch + 2), cw, ch); }
      });
      g.fillStyle = '#ffffff'; g.font = '11px monospace'; g.fillText(name, 4, row * (ch + 2) + 14); g.fillStyle = '#a0a0b0'; g.fillText(mv.type, 4, row * (ch + 2) + 28); g.fillText(DEX[a.num].name, 4, row * (ch + 2) + 42);
      BT.queue = []; BT.anim = null; BT.mode = 'idle';
    });
    PREF.battle = keep.battle; rnd = keep.rnd; FX.parts = []; FX.sprites = []; FX.texts = [];
    // the sheet goes on the page (file:// sprites taint the canvas, so it is screenshotted rather than exported)
    const old = document.getElementById('fxlab'); if (old) old.remove(); out.id = 'fxlab'; const r = window.devicePixelRatio || 1;
    out.style.cssText = 'position:absolute;left:0;top:0;z-index:99999;image-rendering:pixelated;width:' + out.width / r + 'px;height:' + out.height / r + 'px';
    document.body.appendChild(out); return JSON.stringify({ w: out.width / r, h: out.height / r });
  };
})();
