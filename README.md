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

## Campaign: your captain and collection

Choose Bulbasaur, Charmander or Squirtle. That starter becomes your captain;
Pidgey always joins as your first companion. The captain always deploys and
keeps its identity and power family through evolution. Every other slot can
be filled from your collection, regardless of type. Existing saves migrate
without replacing their collection or levels.

Chapter 1 teaches movement, combat and a protected Caterpie catch. Oak's
practice target stays put, cannot faint and cannot gain status. Weaken it to
half HP, approach with a ready teammate and choose **Catch → Practice Ball**:
the ball is free and guaranteed. Catch it and defeat the trainers to win.
Captures join your collection after victory; your whole collection recovers
and weaker companions receive the existing catch-up training before the next
mission. Losing a campaign mission keeps the prior mission's save.

Chapter 2 introduces the normal team power and a capturable outpost. Chapter 3
explains team roles. Chapter 4 introduces superpowers and enemy captains;
claim the bridge outpost, then capture the gym over multiple actions. Campaign
outposts follow Territory's HP-based capture rules and heal only their owner.
They grant power charge, while Territory also has income and reserves.

## Shared team powers

Press **P** or tap **POWER** to see both powers, their costs, duration and any
reason they cannot be used. Every ally benefits, including other types.

| Captain family | Normal: 50 charge | Super: 100 charge |
| --- | --- | --- |
| Charmander | Rally: +25% on each ally's next offensive exchange | Blaze Rush: +50% |
| Squirtle | Shell Guard: all allies take 20% less damage | Tidal Shield: 40% less |
| Bulbasaur | Life Link: heal 20% max HP and cure status/Root | Verdant Bloom: heal 40%, cure, block new status/Root |

The shared bar caps at 100. Actual hostile combat damage charges both teams
(dealing up to 20 per hit, receiving up to 25); catching gives 15 and completing
a building capture gives 20. Healing, status ticks and overkill give no charge.
An active team power pauses that team's charge gain until its next own turn.
Only one power can activate per own turn. Effects expire at the next own turn;
healing is immediate and never restores spent actions or bypasses recharge.
Fire applies to the whole offensive exchange, including a follow-up; it is
consumed even if the exchange misses, and does not boost enemy-turn counters.

A fainted captain prevents activation, while surviving teammates can still
win. End turns manually so you can activate a defensive power after moving
everyone. Normal powers unlock in chapter 2 (with 50 starting charge for that
lesson); supers unlock in chapter 4. Territory has both from the start. Enemy
captains use the same costs and restrictions. Local draft Versus retains its
existing rules without captain powers.

## Territory: Three Bridges

Choose **TERRITORY** from the title. A short guide appears on first use;
**H / HELP** always opens the full rules.

- Choose a captain before starting. Both sides use the same choice and six
  unique teammates: Pidgey, Geodude, the captain, a complementary starter,
  Abra and Clefairy. Pidgey, Geodude and the captain start on the map. Both sides stay at level 12,
  with equal stats and no XP. At most five teammates can be active. All species use their original
  Showdown mini icons on the board, in unit cards and in combat forecasts.
- Buildings show their owner on the roof, as in Advance Wars: grey is neutral,
  blue is yours, red is the enemy's. The two HQs are larger halls with a
  banner; a capture in progress shows a gold bar under the building.
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
- Power charge is separate from command points. A recovered, redeployed
  captain regains access to the team's stored charge.
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
The forecast answers three questions on three lines: what you deal (move,
damage, odds, x2 when a follow-up is nominal), what comes back (the counter,
or why there is none), and the risks (a critical that would KO either side,
secondary effects, recharge). Both HP totals are shown before and after,
assuming normal hits. V, or a tap on the lines, opens the detailed table: every
strike in resolver order with damage, hit and critical odds; conditional
strikes are marked. Immunities block damage
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

## Versus: match rules

Local Versus drafts two teams on one device (snake draft) and then plays with
the rules chosen on the setup screen:

- **Mode.** *Elimination*: knock out the other team; at the turn limit the
  larger team wins. *Capture the Flag*: each base holds a flag at the end of
  the middle road; end a move on the enemy flag to take it, carry it back onto
  your own flag to win. A fainted carrier drops the flag where it fell; the
  other team picks it up from there, its owners send it home by stepping on
  it. *King of the Hill*: a 3×3 hill in the centre; start three of your turns
  with more Pokémon on it than the other team.
- **Arena** size (Small 14×9, Medium 18×11, Large 22×13), **Fog of war**,
  **Wild** Pokémon, **Level**, **Turns** (20/30/40/no limit) and the arena
  **Seed**. The preview shows deploy zones, flag bases and the hill.
- **Fog of war.** Each trainer sees tiles within 3 of their Pokémon (4 for
  fliers); tall grass and forest hide anything not adjacent. Unseen foes do
  not block planning, but a move that runs into one stops on the tile before
  it (an ambush) and that Pokémon's action ends. The hand-off screen switches
  the view between trainers.

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

Units stand directly on the terrain: a small mark in the tile's bottom-left
corner gives the side (round for your own, a spike for enemy trainers, a
diamond for wild, a cross for allies) and keeps its colour when the unit has
acted and turns grey; the HP number appears in the bottom-right corner once a
unit is hurt. Unit cards spell out the role (with its glyph), the move range
and the types; terrain cards show defence as stars and the move cost.
On phones the board opens at 24-px tiles when every row fits (16-px on tall
maps); drag to pan and use ZOOM to cycle 32 / 24 / 16-px tiles. The action
menu sits at the bottom of the screen, within thumb reach.

## Controls and saves

The title screen assembles its logo letter by letter, with staggered arrival,
individual motion and highlight frames. Each menu icon has four animation
frames; the buttons have idle, focus and pressed sprites, a selection sweep,
and a short confirmation effect. Tap the logo for a letter wave. Layouts adapt
to desktop, portrait and short landscape screens; reduced motion disables
ambient animation. The sound control works by touch or with M.
The editable sprite sources and frame strips are described in
[`assets/title/sprites/README.md`](assets/title/sprites/README.md); background
art provenance and its generation prompt are in
[`assets/title/README.md`](assets/title/README.md).

- Arrows/WASD: cursor. Z/Enter/Space: confirm. X/Escape: cancel/menu.
- Q/E: cycle units. C: unit information or switch the forecast move. V: forecast details.
- P: inspect and activate the shared team power during your turn.
- F: fast playback. `+` / `-`: zoom. H: help. M: mute.
- Mouse: point and click; right-click to cancel/open the menu; drag/wheel to pan.
- Touch: tap to select/confirm, drag to pan; use the on-screen buttons (NEXT
  jumps to the next ready Pokémon).
- Resting the cursor on a foe shows its move and attack reach; DANGER shows
  every foe's reach at once. END TURN asks first while Pokémon can still act.

Campaign progression saves between chapters. A **shared suspend slot** is
written at the start of each player turn in campaign, skirmish and Territory;
starting another battle replaces that slot. Resume returns to the saved turn
start, preserving unit state, captain/charge/effects, captures and the random
sequence without repeating upkeep, income or recovery. Presentation settings
persist separately.

## Development and verification

```sh
node tools/model-tests.cjs
node tools/territory-tests.cjs
node tools/integration-tests.cjs
node tools/captain-tests.cjs
SIM_TURNS=60 node tools/sim.cjs 3,7,19 1-8
```

The tests use Node built-ins and the actual game modules. They cover combat,
scene/skip parity, roles, saves, status-action rules, economy, capture, deployment,
AI legality, UI bounds and the battle-to-results flow. Captain tests cover the
starter journey, unlocks, all six powers, forecasts, capture, migration,
suspend and full Territory matches for all three captains. Fixed-seed simulations
are smoke checks, not proof of final balance. The campaign simulation proxy
can capture outposts but cannot catch wild Pokémon or use items, so the guided
first mission needs interactive play or the dedicated capture integration test.
Mt. Moon remains difficult for that proxy and still needs human balance
playtesting.

Browser checks used a local HTTP server at desktop and phone sizes. The
implementation record and validation limits are in `docs/implementation-plan.md`.
The captain implementation and verification are in `docs/captain-journey.md`.
The older CDP/screenshot helper scripts remain in `tools/`; they were not used
for browser verification in this implementation.

Deep links: `?ch=N`, `?ch=N&prep`, `?skirmish=SEED`, `?versus=SEED`,
`?territory=SEED` (setup), `?territory=SEED&auto` (battle).
`&silent` mutes; `&nosave` protects campaign/suspend persistence during tests;
`&noguide` bypasses the territory guide. Presentation preferences are independent.

Source modules: `core.js` (canvas/input/audio/RNG), `font.js`, `dex.js`, `data.js`,
`animmeta.js` (generated), `art.js`, `model.js`, `captain.js` (powers and lessons), `battle.js`, `duel.js`, `campaign.js`, `territory.js`,
`scenes.js`, `journey.js` (captain UI), and `main.js`. `build.sh` regenerates the tracked `index.html`.

Sprites: Pokémon Showdown mini icons and PokeAPI Black/White battle sprites
(static and animated; `tools/pack-anim.py` repacks the animated GIFs into the
frame sheets in `assets/battle/anim/` and `animmeta.js`).
See `assets/battle/ATTRIBUTION.md` for source provenance. Pokémon © Nintendo /
Game Freak / Creatures.

The experimental redrawn board sprites in `mapart.js` are no longer loaded by
the game. The original bundled sprite sheets remain the source of unit art.
