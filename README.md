# POKÉTAKTIKS

A Pokémon tactics game inspired by Advance Wars: grid movement, complementary
unit roles, terrain, type matchups, a captain with a team power, and short
lateral attack scenes. Three ways to play:

- **Campaign**: pick a partner, travel an eight-stop route, catch companions,
  earn up to three stars per chapter.
- **Quick Battle** against the CPU: **Skirmish** (a random map, beat the Rival)
  or **Conquest** (Three Bridges: capture centers, earn points, call reserves).
- **Versus**: two players on one screen, snake draft, Elimination, Capture the
  Flag or King of the Hill, with optional fog of war.

[Published build](https://gavilanbe.github.io/poketaktiks/) — a published build
may differ from a local checkout until that checkout is pushed and deployed.

## Run locally

No dependencies or package manager are needed. Build and serve this directory:

```sh
sh build.sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`. The build concatenates the source modules into
`index.html`; every sprite asset is bundled locally.

## The loop every battle shares

1. Your team, led by a **captain** (the crowned Pokémon), against theirs on a
   grid with terrain and Poké Centers.
2. Each Pokémon moves through the blue tiles, then acts: **Attack**,
   **Capture** a center, its role **Skill**, **Catch** a weakened wild Pokémon
   (campaign and skirmish), or **Wait**.
3. Hits dealt and taken fill the **power bar**; the captain spends it on a team
   power (normal for 50, super for 100).
4. **Poké Centers** heal and cure their owner at the start of each turn;
   capturing one adds 20 charge.
5. One **objective** per map, always shown top-left with its progress: foes
   left, the boss's HP, turns survived or capture points.

There is no bag: healing comes from centers (every campaign map has one; caves
and bases get a Field Center), Support Pokémon and the Grass captain; levels come from battles and the training between chapters. The only
item is the Poké Ball, counted, found on maps and given as first-clear rewards.
Saves from older versions convert their balls and drop the rest.

## Campaign: the route and your collection

Choose Bulbasaur, Charmander or Squirtle in Oak's lab. That partner becomes
your captain and keeps its power family through evolution; Pidgey joins as
your first companion. The **route map** is an overworld built from the board's
own tiles: eight stops on one road, each with its goal, star goals, first-clear
reward and a preview of the battlefield. The captain walks the road between
stops; cleared stops can be replayed for stars (progress never rewinds and a
replay gives no second reward).

Stars: one for the win, one for winning within par, one when none of your
Pokémon fainted. Winning plays a reveal on the route: the stars pop on the
stop, the next stretch of road appears tile by tile and the new stop opens.

Chapter 1 teaches movement, combat and a protected Caterpie catch (Oak's free
practice ball, guaranteed at half HP). Chapter 2 introduces the normal team
power and a capturable outpost, chapter 3 the roles, chapter 4 superpowers,
enemy captains and seizing the gym. Captures join after the battle; the whole
collection recovers and weaker companions catch up before the next mission.

## Team powers

| Captain family | Normal: 50 charge | Super: 100 charge |
| --- | --- | --- |
| Charmander | Rally: +25% on each ally's next offensive exchange | Blaze Rush: +50% |
| Squirtle | Shell Guard: all allies take 20% less damage | Tidal Shield: 40% less |
| Bulbasaur | Life Link: heal 20% max HP and cure status/Root | Verdant Bloom: heal 40%, cure, block new status/Root |

Press **P** or tap the power meter. Actual combat damage charges both teams
(dealing up to 20 per hit, receiving up to 25); catching gives 15 and a
completed capture 20. One activation per own turn; effects last until your next
turn and never refund spent actions. A fainted captain blocks activation, not
victory. Campaign powers unlock in chapters 2 and 4; Conquest and Versus have
both from the start. In Versus each trainer picks a captain style and their
first draft pick leads.

## Conquest (Quick Battle)

Three Bridges, the same captain on both sides, six teammates each (three start,
three wait as reserves with a cost). Each owned center earns 2 command points
per turn (bank limit 30); spend them at an empty owned center to call a
reserve. Capture: 20 points, a full-HP unit adds 10 per action, damaged units
less; leaving or fainting resets it. Win by taking the enemy HQ, or by owning 2
of the 3 middle centers at the start of 3 of your turns. After 40 turns, more
middle centers wins. Fainted teammates recover after two of their own turns.

## Versus

Local Versus drafts two teams on one device (snake draft) and plays with the
rules chosen on the setup screen: **Mode** (Elimination, Capture the Flag, King
of the Hill), **Arena** size, **Map** and **Fog**, plus each player's captain.
Both teams are Lv 20 with plain stats, 30 turns, no wild Pokémon. Under fog you
see 3 tiles around your team (4 for fliers); a move that runs into a hidden foe
stops short (an ambush).

## Combat and roles

The forecast answers three questions on three lines: what you deal, what comes
back, and what could go wrong. V (or a tap on the lines) opens the detailed
strike table. Type matchups are softened (×1.5 super, ×2.25 double, ×0.67
resisted); STAB gives +25%; crits are 4% (24% for high-crit moves) for ×1.5.
Only Scouts and Strikers follow up, with a lead of at least 10 speed.

| Role | Example | Tactical benefit |
| --- | --- | --- |
| Scout | Pidgey | Dart up to two tiles after attacking. |
| Defender | Geodude | Brace: 40% less damage until its next turn. |
| Amphibious | Squirtle | Swims; 20% defense and 20 avoidance on water. |
| Controller | Bulbasaur | Root a foe within two tiles for its next turn (fliers immune). |
| Ranged | Abra | One extra tile of reach on ranged moves. |
| Support | Clefairy | Mend an adjacent ally for 30% max HP and cure it. |
| Striker | Charmander | A direct attacker with speed-based follow-ups. |

## Presentation

- **Title**: pixel art drawn at the game's own resolution — a dusk sky in
  dithered bands, a striped sun, parallax ranges, a mirrored lake, a backlit
  meadow with the starters, and a hand-drawn POKÉ/TAKTIKS wordmark whose
  letters bounce in, breathe, shine and sparkle.
- **Scene changes** close and reopen a Poké Ball over the screen.
- **UI**: raised buttons that sink when pressed, panels that unfold, ribbon
  tabs, shiny headlines, count-ups.
- **Map art**: every tile is pixel art drawn in code and cached: grass with
  tufts and patches, flower clusters, animated tall grass that parts around a
  Pokémon, shaded round trees, apple trees and pines, snow-capped peaks, water
  with bobbing ripples and a three-quarter shoreline, dirt roads and sand with
  grass edges that cast a shadow, cottages with shingled roofs, chimneys and
  flower boxes, a Poké Center with its crest and PC sign, a keep-like HQ, a
  columned Gym, Field Center machines, caves with crystals, rubble heaps,
  molten lava, steel pillars and crates. Poké Balls on the map hop and twinkle.
- **Board**: units wear a team-coloured outline, move ranges flood out from the
  unit, ready units hop at the start of the turn, the objective tracker and a
  segmented power meter sit top-left; phase banners tilt in with speed lines;
  powers play an Advance Wars style cut-in; captures, crits and KOs celebrate.
- **Victory**: the word is stamped letter by letter over a sunburst, then the
  stars pop in. A boss that wakes up gets its own cut-in; indoor maps have embers,
  dust or sparks, outdoor maps cloud shadows and butterflies. The first battles
  point at what to do next. Every one of these respects reduced motion.
- **Ending**: the credits play over the title landscape with your own team.
- **Attacks**: aiming draws a marching line to the target, a lock-on ring and a
  bubble with the damage it will take (or KO!). The lateral **duel scene** is an
  Advance Wars battle screen: each half is a painted panorama of the terrain its
  Pokémon stands on (field, meadow, tall grass, forest, mountain, road, beach,
  sea, bridge, town with its Poké Center, Gym or HQ, cave, base, volcano, snow)
  in parallax layers with drifting clouds, waves, leaves, snow or embers, and
  team-coloured HP plates; swimmers float half under the water. It closes over
  the board in stripes, splits the screen on a diagonal with the Black/White
  animated sprites and slams a VS between them; each move charges
  with an aura, a heavy hit freezes on an impact frame with focus lines, the
  damage lands as a huge number, the HP bar leaves a ghost that drains, and a
  KO is stamped over the fallen Pokémon while the winner hops. Any key speeds
  it up, X skips. The menu offers full, quick or map-only battles; map strikes
  get the same numbers, impact stars and KO stamp.

## Controls and saves

- Arrows/WASD: cursor. Z/Enter/Space: confirm. X/Escape: cancel/menu.
- Q/E: cycle units. C: unit info or switch the forecast move. V: forecast details.
- P: team power. F: fast playback. `+` / `-`: zoom. H: help. M: mute.
- Mouse: point and click; right-click cancels; drag/wheel pans.
- Touch: tap to select/confirm, drag to pan; NEXT jumps to the next ready Pokémon.

Campaign progress saves between chapters. A suspend slot is written at the
start of each player turn in campaign, skirmish and Conquest; RESUME BATTLE on
the title returns to it.

## Development and verification

```sh
node tools/model-tests.cjs
node tools/territory-tests.cjs
node tools/integration-tests.cjs
node tools/captain-tests.cjs
SIM_TURNS=60 node tools/sim.cjs 3,7,19 1-8
```

The tests use Node built-ins and the real game modules: combat, forecasts,
roles, saves, powers, capture, deployment, AI legality, the route and its
stars, and UI bounds at phone and desktop sizes.

Browser walks (Chrome over the DevTools protocol) save screenshots to
`artifacts/`: `node tools/cdp.cjs <smoke|flow|mech|mobile|ui|ui2|duel|vs|title>`
(append `-m` for a phone viewport), and `PK_Q=… PK_EXPR=… PK_NAME=… node
tools/cdp.cjs page` for a one-off capture.

Deep links: `?ch=N`, `?ch=N&prep`, `?skirmish=SEED`, `?versus=SEED`,
`?territory=SEED` (Conquest setup), `?territory=SEED&auto` (battle).
`&silent` mutes; `&nosave` protects persistence during tests.

Source modules: `core.js` (canvas, input, motion helpers, design system,
audio), `font.js`, `dex.js`, `data.js`, `animmeta.js` (generated), `art.js`
(tiles, effects), `scenery.js` (battle-screen panoramas), `model.js`, `captain.js`, `battle.js`, `duel.js`,
`campaign.js`, `territory.js`, `scenes.js`, `title.js`, `route.js`,
`journey.js` and `main.js`. `build.sh` regenerates the tracked `index.html`.
The redesign's rationale is in `docs/redesign.md`.

Sprites: Pokémon Showdown mini icons and PokeAPI Black/White battle sprites
(static and animated). See `assets/battle/ATTRIBUTION.md`. Pokémon © Nintendo /
Game Freak / Creatures.
