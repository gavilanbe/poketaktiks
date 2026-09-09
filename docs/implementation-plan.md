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
