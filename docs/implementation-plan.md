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
