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

#### Stage 2 review follow-up (2026-09-09)

Reproduced with the real launch and model paths before the fix: a chapter-6 launch (`partyUnit` party [4,7,1,25,133,66] at Lv20) gave ids `1..11` to the enemies and `1..6` again to the party, so Charmeleon and the first Voltorb shared id 1 and the duel's `hp0`, terrain, panels and positions collapsed onto one side; a Caterpie Lv6 with 90 xp KOing a Rattata reached the scene already as Metapod Lv7 with 27 max HP; Jynx's Ice Beam showed the FRZ badge from the first frame; Giga Drain at full HP floated a `+heal` the model never applied.

Fixes:

- **Unique battle ids.** `startBattle` imports party and Versus party2 members with `id: 0` so `restoreUnit` numbers them after the map's units (campaign `pid` is untouched). `resumeSuspend` keeps saved ids and renumbers duplicates from old saves with `UID`, which `restoreUnit` already keeps above every saved id, so spawned, caught and restored units never reuse an active id.
- **Presentation snapshots.** `combatQueue` takes `duelView` (name, dex number, level, max HP, types, status, team) before resolving; the scene draws only from that copy, advances a status on the impact beat that inflicted it and clears it on the thaw beat, and `skipDuel` applies the same beats without playing them. The board keeps `fx.showNum` at the pre-evolution form from the moment the queue is built until the evolution event passes its half-way flash (level-up card included); `finishUnit` clears it. Model state is never touched or reapplied.
- **Honest drain.** Both `forecast` and `resolveCombat` cap the drain by the striker's missing HP, so the strike preview, the hit event's `drain`, the scene popup and the final HP agree (0 at full HP).

Checks: `node tools/model-tests.cjs` 26 passed. New: chapter-6 launch, deep-link chapter, Versus and a legacy suspend save with colliding ids (all ids unique, enemy ids preserved, the Charmeleon vs Voltorb duel has two panels, two positions, two `hp0`/terrain entries, correct end HP); Caterpie→Metapod through the real queue in full and quick (with a skip) modes showing Caterpie Lv6/24 in the scene and on the board until the evolution, ending evolved; Ice Beam FRZ hidden before impact, shown after, also when skipped; thaw clears the badge; drain at full HP, one point missing, overkill on 5 and 9 HP targets in preview, event and final HP, and no popup data. The boost test now presses a key after the wipe (fewer frames, same HP, every beat fired) and the persisted `quick` preference is timed too. All three new tests fail on the previous commit. `node --check` on every module; `sh build.sh` rebuilt `index.html` and its script parses. Still no browser run.

### Stage 3: visual clarity and controls (2026-09-09)

Changes:

- **Phone scale.** `pickScale(pw, ph, cw)` (core.js) replaces the inline rule: landscape still aims for ~560 logical px; portrait on a phone (≤ 520 CSS px wide) aims for ~200 (tablets ~320), never fewer than 176. 390×844 at DPR 1 now renders at ×2 (195×422 logical), so the 5×7 font is 10-12 CSS px and touch targets are real. `narrowView()` (< 300 logical px), `btnH()` (18 on phones/touch, 14 on desktop) and `rowH()` (16 / 13) drive every layout. Desktop scale and pixel styling are unchanged.
- **Quieter terrain (art.js, refined in code).** Grass: one soft patch, ~26% of the tuft grid, a rare dark tuft, fewer stones. Meadow: 2-3 flowers. Tall grass keeps its density but the blades sit closer to the base tone. Cave floor: fewer pebbles/cracks, no light speckles. Road, sand, ice, snow: half the dashes and speckles, lower-contrast dashes. Cave wall top: fewer bumps and cracks. Brick wall top: bricks closer to the mortar. The tiled floor (Power Plant, Rocket Hideout) now has a grout mixed toward the tile colour, near-identical checker tones and only a faint lit top/left edge: the lattice is gone, passability and the wall faces stay as they were. Water, lava, shorelines, wall faces, buildings, trees and mountains are untouched.
- **Units first.** `drawStand` shapes the plate by side, not only colour: plain ring (own team), spiked ring (hostile trainer), dashed ring (wild), barred ring (ally); `teamGlyph` (●▲◇+) sits on the left of the HP plate and on the cards. `unitLook(u)` is the single source of truth: `grey` = the controlling team's unit that has acted (whatever the mode, except a unit taking part in the current animation), `ready` = can still act and no animation/banner is running; a ready unit's rim glints, an acted unit's plate greys with it. Marks moved off the sprite into the tile corners: crown/skull top-left, CHG beneath, status top-right.
- **HUD.** `hudLayout()`: the turn card (TURN, objective, READY x/y, head counts) top-left; the context cards (unit + terrain) side by side on the side away from the cursor, hugging the board's lower edge when the board leaves room, else at the bottom; buttons top-right (END TURN, DANGER, ZOOM when the map does not fit, HELP + ♪ on one row; BACK while acting; FAST during the enemy phase). Portrait phones stack: full-width turn card, one combined unit+terrain strip under the board, a two-row full-width button bar at the bottom. Menu rows use `rowH()`, their hint wraps and flips above the menu when there is no room below. Panels register in `HUD.panels`; a pointer over them neither moves the cursor nor taps the tile beneath.
- **Forecast.** Rewritten: both sides with portrait, glyph, name, level, the loss hatched on the bar and the HP after in the big face (red **KO** when it drops to 0); then `forecastLines(fc, att, def)`, one line per ordered strike (▸ own / ◂ counter, move, damage, hit %, crit when notable, ×eff, drain, a KO tag on the strike that drops someone, "only if X survives" on conditional ones, greyed); the exchange summary plus side effects; a tappable move-selector strip (◂ badge name pw rng n/m ▸, gold when there is a choice) that also answers C. 220 wide on desktop under the BACK/ZOOM buttons, full width above the button bar on phones (the camera keeps the target clear of it).
- **Camera and zoom.** `camRange()`: a board that fits is centred between the HUD bands (`hudReserve()`); a bigger board pans edge to edge and up to the bands so top and bottom rows can clear the turn card and the bottom bar. `keepCursorVisible` and the new `unitVisible` use the same bands; move/strike/recharge/poison events only recentre when a participant is outside the safe area. `BT.zoom` ∈ {1, .5}: the board layer is drawn under `ctx.scale`, floating texts and the flash stay at screen scale (`drawFXTexts`), pointer/drag/wheel/menu/quip/level-up positions go through `screenToTile`/`toScreenX`. +/− keys and the ZOOM button toggle; phones open zoomed out when the map does not fit.
- **Hover anchor.** On every mode change the pointer position is remembered; hover ignores the pointer until it travels more than 4 px, so a cursor never jumps to whatever sits under a menu or card that just closed.
- **Unit sheet, help, hand-off, end screen, item prompt, event cards** fit narrow views (single-column sheet, help paragraphs wrapped with `wrap()` and H closes it, widths clamped, long lines truncated).
- **Duel spacing.** Panels are 36 tall with the current HP in the big face; on narrow portrait the foe's panel sits at the top and the player's at the bottom with the field between them (ground line at ~68% of the field, sprites in the middle band, hint above the bottom panel); sprite spread is clamped so both stay inside 180-px views (their transparent margins may touch). Scene logic, script, sprites and the full/quick/map preference are unchanged.
- **Scenes at phone width.** Title footer, Versus (compact team strips, four-column roster, two-row settings/buttons), starter (three stacked cards), prep (single column, stacked buttons), results (wrapped text, per-row counts, stacked Versus buttons), skirmish (¼-scale preview, party line under the settings), chapter card (title scale drops to ×1 when it would not fit).

Checks run:

- `node tools/model-tests.cjs`: 32 passed (26 + 6 new): scale rule (phones 176-260 logical px, the 390×844 DPR 1 case renders ×2, landscape 400-700, tablets ≥ 300); camera (chapter 6's 20×10 board at eight view sizes: centred between the bands when it fits, panned at most to the bands when it does not, cursor at every corner clear of the bands, zoom out/in round trip, both fighters visible after `centerCamBetween` and no jump when they already are, phones open zoomed out); pointer round trip at both zoom levels, resting pointer after a mode change never moves the cursor, a 2-px jitter still counts as resting, a real move does, wheel pans at ×1 and a fitting board stays centred; unit look (acted grey in every mode, unacted never grey while another animates, exchange participants in colour, foes never grey, not ready in the enemy phase, plate shapes per side); HUD layout at eight sizes in idle/move/menu/target/endmenu/unitinfo/help (every button inside, pairwise non-overlapping, ≥ 18 px on phones, no panel over a button, turn card clear of the buttons, ZOOM only when the board does not fit, forecast inside and clear of the buttons with distinct body/move-strip hit areas, menus/sheet/help inside, help lines wrapped and fitting); forecast lines (KO on the first strike, conditional counter and double with the survive text, a·c·a order with ×1.5). The duel layout test now runs on ten sizes and checks panels, strips, sprites and the hint against each other as rectangles, plus the portrait arrangement.
- A headless drive (frame loop + draw every frame) of a full player turn — hover, select, move, menu, forecast with a move switch, attack, unit sheet, help pages, zoom keys, end menu, end turn and the whole enemy phase — at 195×422, 480×270 and 640×360 in `full` and `map` modes, plus every scene drawn at 195×422 with all hit areas inside the view: no exceptions.
- `node --check` on every module; `sh build.sh` rebuilt `index.html` (360,100 bytes) and its script block parses.

Not verified / limits:

- No browser run (the supervisor does browser QA): the terrain's actual look, the plate shapes and glyphs at 1:1, the greying, the forecast's big numbers, the zoomed-out board (16-px tiles with the mini icons at half size) and the portrait duel spacing were reasoned about and checked geometrically, not seen.
- Zoom is a two-step toggle (×1 / ×.5), not continuous, and floating texts keep their size when zoomed out while unit HP plates and badges shrink with the board.
- The hover anchor also delays menu-row highlighting until the pointer moves 4 px after a menu opens.
- `tools/cdp.cjs` `tileCenter` now accounts for `BT.zoom`, but the scripted screenshot runs were not executed.

#### Stage 3 review follow-up (2026-09-09)

Findings (supervisor's text-position script and 390×844 browser playback) and fixes:

- **Offscreen text at 180 px.** Title menu-card subtitles are now truncated to the card with an ellipsis (`menuCard`). The starter scene wraps Prof. Oak's line to the view, shortens the heading on the narrowest phones, and lays the phone cards out with two short stat rows (HP · ATK · DEF / SPA · SPD · SPE · MOV) plus the move list, each fitted to the card. Versus settings on phones use a compact `label [-] value [+]` at 84 px each, so both `+` controls (not only their text) sit inside 180 px and remain tappable.
- **Missing glyph.** The zoom-out button read `ZOOM ?`: U+2212 is not in the pixel font. Button and help now use ASCII `-`; a test asserts every help line, button label, menu label/hint and the forecast's fixed strings resolve to real glyphs.

Checks: `node tools/model-tests.cjs` 35 passed (3 new): (1) rendered-text bounds via a `text` hook that follows save/translate/scale, for title, Versus, starter, prep, skirmish, results, board HUD, forecast, unit sheet and the three help pages at 180×390, 195×422, 207×448 and 512×288, plus every scene/HUD control inside the view, at least 14×12 and pairwise non-overlapping; (2) phone keyboard/touch access at 180×390: both Versus `+` controls change level/seed, arrow keys and OK draft a Pokémon with four-column row stepping, all five Versus buttons present, three starter cards and arrow selection, prep OK toggles a card and BACK/AUTO PICK/START are present; (3) glyph coverage as above. The supervisor's `text-check.cjs` now prints nothing (no overflow). `node --check` on every module; `sh build.sh` rebuilt `index.html` (360,757 bytes) and its script block parses. Camera/forecast behaviour from the stage 3 commit is untouched.

Caveats: still no browser run from this side; the compact starter cards and the ellipsised subtitles were checked by measured text width, not seen.
