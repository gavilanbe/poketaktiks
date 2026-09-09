# Pokétaktiks: Advance Wars with Pokémon

## Brief

Turn this existing game into a readable, satisfying Pokémon tactics game inspired by Advance Wars. Keep the pixel-art identity, vanilla JavaScript build, campaign, captures and evolutions. Make positioning, complementary Pokémon roles and territorial objectives matter. Show each attack in a short lateral battle scene with large Pokémon, terrain on both sides, clear damage and a conditional counterattack, then return to the map. Keep battles fast and skippable.

Work in the stages below. Finish one stage, run meaningful checks, rebuild `index.html`, inspect the diff, and commit before beginning the next. Preserve existing saves with compatible defaults. Fix causes rather than papering over failures. Do not push or deploy. The supervisor reviews each stage and runs browser checks.

## Stages

1. **Trustworthy combat.** Equal versus stats; ordered, reliable forecasts; explicit wild threats; level-appropriate moves without losing essential ranges; center cures; real recharge. Add model regression checks.
2. **Lateral battle scene.** Map-to-duel transition, larger combat sprites with offline fallback, matching terrain, readable HP, attack/impact/counter/KO sequence, fast/skip controls, reduced motion. One combat result drives every presentation mode.
3. **Visual clarity and controls.** Quieter terrain, clearer unit/team/action states, stable readable HUD and forecast, viewport-aware camera, usable mouse/keyboard/touch controls. Retain the existing visual identity.
4. **Distinct tactical roles.** A focused species roster with explicit complementary roles and a small set of deterministic support/control abilities; readable descriptions, AI use, sound movement/range rules. Curb speed's accumulated advantages without breaking campaign progression.
5. **Territory battle.** Add a complete, selectable small territory mode with ownership, capture progress, command-point income, reserve deployment, multiple routes, clear victory conditions and an objective-aware AI. Preserve existing campaign and versus behavior. Include save/resume support.
6. **Integration and polish.** Playable onboarding, concise help, compatible settings/saves, consistent interactions, model/build verification and repair of integration regressions. Document how to play the new mechanics and the limits of validation.

## Acceptance

- A preview never promises a counter that cannot occur; skipped animation has the same result as normal animation.
- Same species/level on opposite human teams have equal stats.
- A player can identify ownership, remaining actions, danger, terrain and expected damage without guessing.
- Role abilities and territorial decisions create alternatives to moving forward and choosing the largest damage number.
- The new mode is reachable from the title, playable to completion against AI, and resumable.
- Mouse, keyboard and narrow screens remain usable; new assets have a graceful fallback.
- Every stage has a focused commit with rebuilt output and relevant verification.

## Execution record

Planning baseline: clean `main` at `1df3ba9`. Implementation branch: `codex/advance-wars-battles`.

### Stage 1: trustworthy combat (2026-09-09)

Changes:

- **Equal Versus stats.** `applyDex` no longer keys HP on team 0. The campaign edge is an explicit per-unit `hpBonus` (`BOND_HP` = 1.2) set by the campaign flow (`partyUnit`, `startBattle` for non-Versus parties, catches in `applyBattleToParty`); Versus passes 1 for both trainers. `hpBonus` is serialized; older `pk_save` parties and suspend records migrate on load.
- **Ordered forecast shared with the resolver.** `forecast()` now returns the ordered `strikes` (attack, counter, faster side's double) with `nominal` flags, conditions ("only if X survives"), drain, `hpA`/`hpD` after the nominal exchange, `koA`/`koD`, and `noCounter` (`range` / `frozen` / `recharging`). It rolls no dice and mutates nothing. `resolveCombat` walks the same strike list. The forecast card shows conditional counter damage in brackets, a one-line exchange summary, and the moves' chance/lasting effects on their own line. The AI scores with the same preview.
- **Danger zone.** `dangerZones(team)` splits trainer and wild threats; the overlay draws wild reach in yellow under trainer reach in red, with an on-screen legend. Units that must recharge are excluded because they skip their next phase; frozen/paralyzed units stay in.
- **Moves.** `movesFor` honors unlock levels for signatures (Pikachu Lv5 has Thunder Shock, Thunderbolt from Lv26), keeps the best adjacent-capable move of a type whose strongest move is range-only (Ninetales Lv40: Fire Blast + Flamethrower), and uses a melee Normal fallback (Hyper Beam only for Normal types). Loadouts are 1–5 moves; the unit sheet lists four.
- **Poké Center** cures status independently of missing HP.
- **Hyper Beam recharge.** After firing (hit or miss) `unit.recharge = 1`: it cannot counter, cannot be used as a counter, and its next upkeep clears the flag and marks the unit acted (turn spent). Enemy phase skips acted units. State is saved/restored; the map shows a CHG badge, the unit card/sheet a marker, the forecast "must recharge", and help page 2 states the rule.
- **Resume timing.** The suspend save is written after upkeep; `resumeSuspend` now calls `beginPhase(0, true, true)` which skips upkeep and re-saving, so heals, poison ticks and recharge turns are not applied twice and a reload cannot refund a spent turn.

Checks run:

- `node tools/model-tests.cjs`: 14 tests passed (Versus symmetry incl. level up/evolve/restore, campaign edge and save migration, first-strike KO cancels counter, counter + double, counter KO cancels double, no-counter reasons, drain, forecast purity and miss path, danger zones, move loadouts across the whole dex at Lv1–50, center cure/heal/poison, recharge rules + AI + save round trip, XP/level/evolve/restore, suspend/resume without double upkeep).
- `node --check` on every module; `sh build.sh` regenerated `index.html` and its script block parses.
- Model-only smoke of all eight chapters through the same harness (`simBattle`, cautious AI on the player side, seed 7, loaner party): every battle ran to completion without exceptions. Compared with the pre-change sources on the same seed the outcomes were identical for chapters 1–5 and 7 and flipped from loss to win on chapters 6 and 8. One seed only; not a balance result.

Not verified / limits:

- No browser run in this stage (supervisor does browser checks): forecast card layout (height 94→104), danger legend placement and the CHG badge were only reasoned about.
- Campaign balance shifted slightly: low-level party members no longer get their signature move early (starters at Lv5 use Ember/Water Gun/Vine Whip until the signature level), and the AI no longer fears counters that cannot happen. `tools/cdp.cjs balance` was not re-run.
- The AI fires Hyper Beam when it is the only move usable from a spot and the score (minus a lost-turn penalty) still wins; it prefers a same-range alternative unless the beam finishes the target.

#### Stage 1 review follow-up (2026-09-09)

Reproduced with the supervisor's minimal harness (dex/data/model only, `rnd = () => 0`, `isHuman = () => false`, plain 15×15 map) before the fix: a Caterpie frozen by Jynx's first Ice Beam still countered; Diglett took paralysis from a zero-damage Thunder Shock; a paralyzed Pikachu with `statusTurns = 2` was not shown reaching (8,2) although its upkeep is certain to cure it; Giga Drain on a 1 HP target healed 61 in the preview and 92 in the resolver.

Fixes (model.js, one line in battle.js):

- `resolveCombat` re-checks the live state per strike: a striker that is frozen skips (no counter, no double), a striker that already struck and no longer `doubles()` (paralyzed mid-exchange) skips its double, and hit/crit are recomputed from the current status. No extra strikes are created; the strike list still comes from `forecast()`.
- Secondary status and drain require a damaging hit, so type immunity blocks them. The forecast's effects line hides side effects when the move has no effect on the target.
- `drainFor(move, lost)` heals from HP actually taken (`min(dmg, hp)`) in both preview and resolver; hit events carry the capped amount.
- `statusAfterUpkeep(u)` previews guaranteed cures (Poké Center, paralysis timer, freeze timer) without dice or mutation; `dangerZones` uses it via `effMov(u, status)`. Wild/trainer split and the recharge exclusion are unchanged.

Checks: `node tools/model-tests.cjs` 18 passed (4 new regression tests: frozen-then-no-counter plus paralyzed-loses-double, immunity vs status/drain in preview and resolver, danger zone with guaranteed cure / center / wild thaw / recharge and a no-mutation check, drain vs overkill at 1 HP and at partial HP). The minimal reproduction script reports all four cases fixed. `node --check` on model.js and battle.js; `sh build.sh` rebuilt `index.html`. Not verified in a browser.

### Stage 2: lateral battle scene (2026-09-09)

Changes:

- **One roll, one event list.** `combatQueue(att, def, move, from)` in battle.js is now the only place an exchange is resolved for display: it snapshots both units' HP (`hp0`), calls `resolveCombat` once and hands the events to `eventsToQueue`. The player's `confirmAttack` and the enemy phase both use it. With the preference at `full`/`quick` the hit/miss/ko/thaw events become one `{kind:'duel'}` queue item and the rest (recharge, xp, levelup, evolve) follow as board events exactly as before, so XP, evolution and capture flow are unchanged. With `map` the old strike animation plays. KO bookkeeping (`B.kills`, leader down) moved into `noteKo(e)`, guarded so either presentation counts each KO once.
- **duel.js (new module).** `duelScript(events, hp0)` turns the events into timed beats (intro → per strike: windup, launch, impact | miss → ko / thaw → outro). Each impact beat stores the HP it starts from and lands on; `duelHpAt(script, t, id)` gives the HP to display at any time, so the panels show the pre-exchange HP until that strike's impact instead of the model's final value. No dice, no unit mutation. `startDuel/updateDuel/skipDuel/duelInput` drive a queue item; `skipDuel` moves the clock to the outro, which lands on the same numbers as playing through. `duelSides` puts the controlling side on the left (P1 in Versus; player, then ally, then wild, then enemy trainer in the campaign), so enemy and wild attacks read the same way. Families: contact (every melee-only move), fire, water (Water + Ice), electric, grass, psychic (Psychic/Ghost/Fairy/Poison/Dragon) and a neutral beam (Normal/Steel) or the existing type projectile for the rest.
- **Scene.** Curtain wipe from the board (drawn underneath, HP bars held at pre-exchange values via `BT.hpShow` holds so nothing leaks), subdued backdrop chosen from the tiles and the map (meadow, forest, cave, interior, volcano, snow), each half of the ground tiled with that side's real terrain, two panels (name, level, team tag, types, status, HP bar + numbers, terrain name with DEF/AVO), attack-name banner with a COUNTER tag, lunge/cast poses, white hit flash, knockback, damage number, effectiveness, status and drain callouts, MISS dodge, KO flash-and-drop with FAINTED!/KO!, wipe back. Panels sit side by side from ~300 logical px width and stack above each other below that; the sprite positions and ground line follow the height, with a layout test covering 480×270, 390×844, 320×480, 300×600 and 1024×600. A three-strike exchange scripts to 3.4 s, a two-strike one to 2.55 s, KO +0.75 s.
- **Controls and preference.** Any key or tap = speed up (×3.5), second press / X / Esc / right click = skip. F (fast) also shortens the scene. `PREF.battle` (`full` | `quick` | `map`, `localStorage pk_battle`, default `full`) is cycled from the in-battle menu ("Battle: Full duel / Quick duel / Map only") and explained on help page 1. Reduced motion removes the wipe (hard cut), lunges, knockback and shake.
- **Sprites.** `assets/battle/1.png`…`151.png`: the Black/White front sprites (96×96) copied unchanged from PokeAPI/sprites (commit `712e6d9`, see `assets/battle/ATTRIBUTION.md`; 604 KB). `requestBigSprite` loads them lazily per species (warmed for every unit at battle start, on reinforcement and on evolution) and never blocks boot; `drawBig` falls back to the mini icon at 2× when a file is missing or not yet loaded, and the choice is locked when the wipe finishes so a sprite never pops in mid-scene. The left-hand sprite is mirrored on a canvas at draw time. Board icons are unchanged.
- **Sound.** New cues: wipe, swing, fire, water, elec, grass, psy, beam, faint. Title footer and README credit both sprite sources.

Checks run:

- `node tools/model-tests.cjs`: 23 passed. New: (1) duel script mirrors the resolver — beat order for attack/counter/double, every impact starts from the tracked HP and drops exactly the HP taken, defender HP never rises, pre-impact reads equal the snapshot while the model is already final, zero RNG calls while building or playing, playing through / boosting / skipping mid-strike reach identical final HP, units untouched; (2) `combatQueue` partition, XP after the scene, KO counted once in both modes, board HP holds set and released, preference persisted; (3) miss, immune 0-damage impact, drain raising the attacker, lethal counter ending in `ko outro`, side rules, family mapping; (4) layout bounds on five viewports; (5) integration: a real `confirmAttack` driven through `battleUpdate`/`battleDraw` (stub canvas) until the board is idle in full, quick and map modes, with a speed-up key mid-scene.
- `node --check` on every module; `sh build.sh` regenerated `index.html` (333,714 bytes) and its script block parses.

Not verified / limits:

- No browser run (supervisor does browser QA): sprite baseline alignment (`spriteBottom` reads the last opaque row when pixel access is allowed, else assumes row 90), backdrop/ground colours, banner placement, portrait stacking and touch skipping were reasoned about and checked geometrically, not seen.
- No recoil exists in the move data, so there is no recoil beat; drain, status, immunity, crit, miss, KO and thaw are covered.
- `spriteBottom` cannot read pixels from `file://` images, so from disk every sprite stands on row 90 (a few species with deeper margins may float by a couple of pixels).
- `simBattle`/`autoTurn` still call `resolveCombat` directly (no presentation), as before.
