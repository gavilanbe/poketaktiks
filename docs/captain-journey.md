# Captain journey

Implementation scope: keep the campaign's starter choice and persistent collection; make the starter its explicit captain, teach the first catch, introduce shared team powers, and reuse those rules in Territory. Existing graphics work is preserved.

- [x] Captain identity, old-save migration, fixed Pidgey partner, required deployment.
- [x] Shared charge, three normal/super powers, deterministic forecasts, enemy use, suspend parity.
- [x] Starter/preparation explanations, chapter lessons, guided first catch, campaign outposts.
- [x] Territory captain selection and recovery; shared rules and UI.
- [x] Power presentation, keyboard/touch controls, phone/landscape verification.
- [x] Regression tests, feature tests, built output and documentation.

Power rules: charge 0–100; normal costs 50, super costs 100. Normal unlocks in chapter 2; super in chapter 4. Territory has both. Combat and completed captures charge the bar; healing and power effects do not. At most one activation per own phase, and active effects expire at the next own phase. A fainted captain prevents activation, not victory. Fire boosts each ally's next offensive exchange; Water protects the team; Grass heals and cures (super also prevents new status). Powers never refund spent unit actions.

Campaign lessons: chapter 1 movement and a protected practice catch, chapter 2 cover/outposts and the normal power, chapter 3 roles, chapter 4 capturing the gym and superpowers. Captures join after winning; all collection members recover and retain the existing catch-up training.


Verified on 2026-09-13:
- 44 model regression tests, 9 Territory tests, 9 scene integration tests and 16 captain tests pass (78 total).
- Full deterministic Territory matches complete with Fire, Water and Grass captains; both sides activate powers. Rematches retain the selected captain and reset charge.
- The practice capture integration exercises weakening, survival protection, free guaranteed capture, objective completion and persistence after victory.
- Forecasts and combat share power modifiers; status/Root protection, spent actions, cooldowns, charge, evolution identity and suspend RNG are covered.
- UI bounds and text overlap checks cover logical views 180x320, 195x422, 422x195, 512x180, 512x288 and 640x360.
- Live browser inspection covers the campaign opening, preparation, guided-target movement and attack forecast, normal-power activation/payment, blocked repeat activation, and Territory captain choice using keyboard/touch. Viewports: desktop 1280x720, phone 390x844 and landscape 844x390. Tests use nosave.
- Built index.html from the current source modules; git diff --check passes.

Limits: the browser check does not play the entire eight-chapter campaign. Fixed-seed AI matches validate rule execution, not final balance; human playtesting is still needed for the new charge rates and chapter difficulty. Local draft Versus intentionally keeps its existing rules. No deployment is part of this change.
