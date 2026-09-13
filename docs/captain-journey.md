# Captain journey

Implementation scope: keep the campaign's starter choice and persistent collection; make the starter its explicit captain, teach the first catch, introduce shared team powers, and reuse those rules in Territory. Existing graphics work is preserved.

- [ ] Captain identity, old-save migration, fixed Pidgey partner, required deployment.
- [ ] Shared charge, three normal/super powers, deterministic forecasts, enemy use, suspend parity.
- [ ] Starter/preparation explanations, chapter lessons, guided first catch, campaign outposts.
- [ ] Territory captain selection and recovery; shared rules and UI.
- [ ] Power presentation, keyboard/touch controls, phone/landscape verification.
- [ ] Regression tests, feature tests, built output and documentation.

Power rules: charge 0–100; normal costs 50, super costs 100. Normal unlocks in chapter 2; super in chapter 4. Territory has both. Combat and completed captures charge the bar; healing and power effects do not. At most one activation per own phase, and active effects expire at the next own phase. A fainted captain prevents activation, not victory. Fire boosts each ally's next offensive exchange; Water protects the team; Grass heals and cures (super also prevents new status). Powers never refund spent unit actions.

Campaign lessons: chapter 1 movement and a protected practice catch, chapter 2 cover/outposts and the normal power, chapter 3 roles, chapter 4 capturing the gym and superpowers. Captures join after winning; all collection members recover and retain the existing catch-up training.
