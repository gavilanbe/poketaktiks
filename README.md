# POKÉTAKTIKS

A Pokémon tactics game inspired by Advance Wars: grid movement, complementary
unit roles, terrain, type matchups, and short lateral attack scenes. Includes
an eight-chapter campaign, random skirmishes, local two-player Versus, and
**Territory**, a battle over centers, income and a finite team of reserves.

[Published build](https://gavilanbe.github.io/poketaktiks/) — a published build
may differ from a local checkout until that checkout is pushed and deployed.

## Run locally

No dependencies or package manager are needed. Build and serve this directory:

```sh
sh build.sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`. The build concatenates the source modules into
`index.html`. All required sprite assets are bundled locally. Direct `file://`
loading uses relative asset paths, but its runtime behavior was not verified
in this pass because the supported browser blocked file URLs.

## Territory: Three Bridges

Choose **TERRITORY** from the title. A short guide appears on first use;
**H / HELP** always opens the full rules.

- Each side has six teammates: Pidgey, Geodude, Squirtle, Bulbasaur, Abra and
  Clefairy. The first three start on the map. Both sides stay at level 12,
  with equal stats and no XP. At most five teammates can be active.
- Any ready Pokémon standing on another center can **Capture**. A full-HP
  unit adds 10 of the required 20 points per action; damaged units add less.
  The same unit must remain there. Leaving or fainting resets its progress;
  damage reduces its next contribution. Root prevents movement, not capture.
- Each owned center earns **2 command points** at the start of its owner's
  turn, up to a bank of 30. Capturing changes future income; it gives no
  immediate payment. Only friendly owned centers heal 30% HP and cure status.
- Use **RESERVE**, or select an empty owned center, to deploy a teammate.
  Costs are shown before spending. An occupied center cannot deploy. Arrivals
  have already acted. Fainted teammates recover after two of their own turn
  starts and must be paid for again. There are no duplicate teammates.
- Win by capturing the enemy HQ, or owning at least two of the three contested
  centers at the start of three of your turns. Losing that majority resets
  the hold counter. After 40 turns, the side with more contested centers wins;
  equal ownership is a draw. An empty field is not a defeat while a team can
  recover and deploy through its centers.
- **End your turn manually**, after moving, using abilities and deploying.
  The AI uses the same capture, deployment, recovery and ability rules.

## Combat and roles

Select a Pokémon, move through the blue tiles, then choose an action. Movement
can be cancelled before committing the action. Red tiles show attack reach.
The forecast lists the attack, eligible counter and any follow-up in order.
Its HP projection assumes normal hits; hit/critical odds and critical-KO risks
are shown separately. Conditional strikes are marked. Immunities block damage
and secondary effects; drain heals only HP actually taken and missing.

Type matchups use softened effectiveness (×1.5, ×2.25 for a double weakness,
×0.67 resisted), STAB gives +25%, and critical hits deal ×1.5. Critical chance
is 4%, 24% for high-crit moves, and 100% against a frozen target. Only Scouts
and Strikers follow up, with a lead of at least 10 speed. Hyper Beam prevents
counters after firing and consumes the unit's next turn recharging.

| Role | Example | Tactical benefit |
| --- | --- | --- |
| Scout | Pidgey | Dart up to two tiles after attacking; no second action. |
| Defender | Geodude | Brace: spend an action for 40% less damage until its next turn. |
| Amphibious | Squirtle | Swim; 20% defense and 20 avoidance on water. |
| Controller | Bulbasaur | Root a foe within two tiles for its next movement phase; fliers are immune. |
| Ranged | Abra | One extra tile of reach on moves that are already ranged. |
| Support | Clefairy | Mend an adjacent ally for up to 30% max HP and cure it. |
| Striker | Charmander | A direct attacker with speed-based follow-ups. |

Roles stay with evolution lines. Root and Mend work every other turn; Brace
works every turn and earns no XP. Root/Mend earn XP outside Territory. Active
abilities consume the action and have a confirmable preview.

Burn halves physical attack and ticks damage; poison ticks damage; paralysis
cuts movement and has a 25% chance to spend the action at phase start. A frozen
unit spends its phase unless it thaws. These rules apply equally to players
and AI, after center cures. Selection/cancellation/resume cannot reroll the
phase check, and curing a unit does not refund an already spent action.

## Other modes and presentation

Campaign and skirmish retain catches, leveling and evolution. Trainer Pokémon
cannot be caught; weakened wild Pokémon can be caught from an adjacent tile.
The campaign party has an explicit 20% HP bonus. Local Versus uses equal stats,
a shared-device draft, and a hand-off screen between players. Territory does
not change campaign progression.

An attack opens a lateral battle scene framed like Advance Wars: the screen
splits on a diagonal, each side's terrain slides in as a diorama, header panels
show a big HP counter and terrain defence stars, the Black/White animated
sprites play their idle loops, and each strike has its own charge, projectile,
impact and KO choreography with a light camera push. HP changes, counters and
KOs play in order. Any key/tap speeds it up; X skips. The empty-tile
menu (also opened with Escape) offers **Full duel / Quick duel / Map only**. All modes replay
the same combat result; skipping cannot change it. Reduced-motion settings
reduce movement and effects. A missing large sprite falls back to its mini icon.

Team shapes and glyphs distinguish own, enemy, wild and allied units; spent
units turn grey. The HUD shows ready actions, objectives, terrain and status.
On phones the board opens zoomed out; drag to pan and use ZOOM for a closer view.

## Controls and saves

- Arrows/WASD: cursor. Z/Enter/Space: confirm. X/Escape: cancel/menu.
- Q/E: cycle units. C: unit information or switch the forecast move.
- F: fast playback. `+` / `-`: zoom. H: help. M: mute.
- Mouse: point and click; right-click to cancel/open the menu; drag/wheel to pan.
- Touch: tap to select/confirm, drag to pan; use the on-screen buttons (NEXT
  jumps to the next ready Pokémon).
- Resting the cursor on a foe shows its move and attack reach; DANGER shows
  every foe's reach at once. END TURN asks first while Pokémon can still act.

Campaign progression saves between chapters. A **shared suspend slot** is
written at the start of each player turn in campaign, skirmish and Territory;
starting another battle replaces that slot. Resume returns to the saved turn
start, preserving unit state and the random sequence without repeating upkeep,
income or recovery. Presentation settings persist separately.

## Development and verification

```sh
node tools/model-tests.cjs
node tools/territory-tests.cjs
node tools/integration-tests.cjs
SIM_TURNS=60 node tools/sim.cjs 3,7,19 1-8
```

The tests use Node built-ins and the actual game modules. They cover combat,
scene/skip parity, roles, saves, status-action rules, economy, capture, deployment,
AI legality, UI bounds and the battle-to-results flow. Fixed-seed simulations
are smoke checks, not proof of final balance. The campaign simulation proxy
cannot issue Seize or use items, so a Seize chapter can remain unfinished.
Mt. Moon remains difficult for that proxy and still needs human balance
playtesting.

Browser checks used a local HTTP server at desktop and phone sizes. The
implementation record and validation limits are in `docs/implementation-plan.md`.
The older CDP/screenshot helper scripts remain in `tools/`; they were not used
for browser verification in this implementation.

Deep links: `?ch=N`, `?ch=N&prep`, `?skirmish=SEED`, `?versus=SEED`,
`?territory=SEED` (setup), `?territory=SEED&auto` (battle).
`&silent` mutes; `&nosave` protects campaign/suspend persistence during tests;
`&noguide` bypasses the territory guide. Presentation preferences are independent.

Source modules: `core.js` (canvas/input/audio/RNG), `font.js`, `dex.js`, `data.js`,
`animmeta.js` (generated), `art.js`, `model.js`, `battle.js`, `duel.js`, `campaign.js`, `territory.js`,
`scenes.js`, and `main.js`. `build.sh` regenerates the tracked `index.html`.

Sprites: Pokémon Showdown mini icons and PokeAPI Black/White battle sprites
(static and animated; `tools/pack-anim.py` repacks the animated GIFs into the
frame sheets in `assets/battle/anim/` and `animmeta.js`).
See `assets/battle/ATTRIBUTION.md` for source provenance. Pokémon © Nintendo /
Game Freak / Creatures.
