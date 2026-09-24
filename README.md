# POKÉTAKTIKS

A Pokémon tactics game played by Advance Wars rules: grid battles over terrain,
funds earned from the Poké Centers you hold, Pokémon deployed from your PC Box,
trainers as commanders with passives, Powers and Super Powers, weather, and an
Advance Wars style battle screen for every exchange.

**Frente Kanto** — Team Rocket has hijacked Bill's Pokémon Storage System. Every
Poké Center in Kanto is locked and every stored Pokémon is out of its trainer's
reach. A **Tactician** can still command any Pokémon linked to their PC Box:
free the Centers, catch wild Pokémon, and free the Gym Leaders Rocket is
blackmailing so they command beside you.

Ways to play:

- **Campaign**: a prologue with Prof. Oak and Bill, a partner from Oak's lab, and
  eight fronts across Kanto (Pallet Meadow to Cerulean Cave), each opened by a
  briefing on the enemy commander. Three stars per front.
- **Quick Battle** against the CPU:
  - **Skirmish**: a random battlefield (fields, forest, coast, mountains,
    snowfield, volcano or cave), HQ vs HQ, your commander against theirs, with
    the level, starting funds and weather you choose.
  - **Battle Tower**: ten floors, a commander on each, rental armies at the
    floor's level; every won floor is ranked S to C and the best result is kept.
  - **Safari Zone**: an eight-day catch race against Blue. Weaken, never knock
    out: rare Pokémon score more, and every catch joins your collection.
  - **Conquest**: Three Bridges, the same captain on both sides; take the HQ or
    hold two of the three middle centers.
- **Versus**: two players on one screen, a snake draft, HQ War, Capture the Flag
  or King of the Hill, commanders, funds, weather and optional fog of war.

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

## The day

A day is one turn for each side. At the start of yours:

1. **Income**: ₽1,000 for each HQ and Poké Center (or Field Center) you hold. The
   war chest sits beside the turn counter and rolls up as the money comes in.
2. **Upkeep**: your Pokémon standing on your own properties heal and are cured;
   weather ticks; Pokémon recovering in the Box count down.
3. Then act: move and act with each Pokémon, **deploy** from the PC Box at a
   free property you hold, and use your commander's **Power**.

Each Pokémon moves through the blue tiles, then **Attacks**, **Captures** a
property, uses its role **Skill**, **Catches** an adjacent weakened wild Pokémon
or **Waits**. One objective per map sits top-left with its progress: rout the
foe or take their HQ, defeat a boss, seize a Gym, survive, or out-catch Blue.
Every front has two bases, yours and theirs (Joey's and Timmy's camps, then the
Rocket HQ bunkers): taking theirs wins on any front, losing yours loses it.

## Properties, the Box and catching

| Tile | Property | Pays | Heals its owner | Deploys | Notes |
| --- | --- | --- | --- | --- | --- |
| HQ | Headquarters (a camp, or a Rocket bunker) | ₽1,000 | yes | yes | Captured by the enemy: that side loses. |
| Poké Center | the PC terminal | ₽1,000 | yes | yes | Rocket-held ones deploy the enemy's army. |
| Field Center | caves and bases | ₽1,000 | yes | yes | |
| Gym, outposts | objectives | – | outposts yes | – | Seize to win where the map says so. |

- **Capture**: stand on it and choose Capture; each action adds
  `ceil(10 × HP / max HP)`, 20 completes it (a full-HP Pokémon takes two).
  Leaving or fainting resets the progress; a completed capture charges 20 power.
  Each capture plays as a scene: the building in its owner's colours, its points
  ticking down as the Pokémon hops on it, the banner changing hands, CAPTURED!
  (or BASE TAKEN! on an HQ).
- **The PC Box**: the Pokémon a side can deploy. In the campaign it is your
  collection; in Skirmish your collection topped up with loaners; in the Tower
  the rental army; in Versus a shared catalog plus the draft. Deploying costs
  `BST × (level + 10) / 4` to the ₽100 (at least ₽1,000); the Pokémon appears on
  the property and acts next turn. At most ten on the map.
- A Pokémon that **faints** goes back to the Box and recovers for two of its
  side's days; it can then be deployed again at full HP. The Ace too.
- **Catching**: throw a Poké Ball at an adjacent wild Pokémon (a found ball, or
  one bought for ₽500). The chance grows as its HP drops and with a status. A
  catch goes to your Box and its first deployment is free; in the campaign it
  joins your collection after the battle.
- **Tall grass** breeds wild Pokémon: at dawn, while the map is under its wild
  cap, one of the map's species may step out of an empty patch (caves and
  snowfields breed them on their open floor).

## Commanders

Each side follows a trainer. The trainer stays off the map; their partner, the
**Ace**, wears the crown on it. The **passive** helps allies within two tiles of
the Ace. The meter charges with damage dealt (up to 20 a hit) and taken (up to
25), 15 per catch and 20 per capture: a **Power** costs 50, a **Super Power**
100, one per turn, lasting until your next turn unless it says days. Activating
one plays an Advance Wars cut-in with the trainer's portrait.

| Commander | Ace | Passive | Power | Super Power |
| --- | --- | --- | --- | --- |
| You (Tactician) | your partner | Partner bond: allies deal 10% more, take 10% less | Rally / Shell Guard / Life Link (by your partner's family) | Blaze Rush / Tidal Shield / Verdant Bloom |
| Brock | Onix | Rock and Ground take 15% less | Rock Tomb | Sandstorm Fort |
| Misty | Starmie | Water +10%, +1 move on water | Rain Dance | Hydro Surge |
| Lt. Surge | Raichu | +10% critical chance | Thunder Wave | Thunderstorm |
| Erika | Vileplume | Centers heal 10% more | Aromatherapy | Petal Blizzard |
| Koga | Weezing | Status chances +10% | Toxic Spikes | Smokescreen |
| Sabrina | Alakazam | Psychic +10% | Calm Mind | Future Sight |
| Blaine | Arcanine | Fire +10% | Sunny Day | Eruption |
| Blue | Pidgeot | +10% damage | Smell Ya Later | Champion's Pride |
| Giovanni | Nidoking | Income +10% | Earthquake | Rocket Supremacy |
| Rocket Grunt | Arbok | Poison +10% | Pickpocket | Rocket Rush |

The **Commanders** room on the title shows every trainer, their Ace, passive and
powers, and where to free the ones still held. Gym Leaders join you as they are freed on the route (Brock after Mt. Moon,
Misty after Nugget Bridge, Erika after the Rocket Hideout, Lt. Surge after the
Power Plant, Koga and Blaine after Cinnabar; Sabrina, Blue and Giovanni once the
journey is complete) and can lead your side from a front's briefing and in the
Quick Battle modes. Without a campaign save you can lead as the Tactician,
Brock or Misty.

## Weather

Rain powers Water (×1.5) and dampens Fire (×0.5) and, under fog, shortens sight
by a tile; harsh sun the reverse. A sandstorm and snow chip 1/16 of max HP a day
from everyone they do not spare (never below 1); a sandstorm also hardens Rock
types against special moves (×2/3), and snow slows walkers on open ground (+1
move cost; fliers and Ice types are spared) and hardens Ice types (×5/6). Maps, setup screens and powers set it; it falls over the board
and the battle screen, a chip shows the days left, and a banner marks changes.

## Campaign: Frente Kanto

A new journey opens on the prologue, then Oak's lab: Bulbasaur, Charmander or
Squirtle becomes your partner (keeping its power family through evolution) and
Pidgey your scout. The **route map** is an overworld built from the board's own
tiles: eight fronts on one road, each with its goal, star goals, first-clear
reward and a preview. Each front opens on a **briefing**: who holds it and what
they say, how they fight, the enemy forces with their Ace, the Rocket center
feeding them, the wild Pokémon, the battlefield, and who leads your side.

| Front | Enemy | Goal |
| --- | --- | --- |
| 1 Pallet Meadow | Youngster Joey | Rout them, catch Oak's Caterpie |
| 2 Viridian Forest | Bug Catcher Timmy | Rout them, take the outpost |
| 3 Mt. Moon | Brock (blackmailed) | Defeat Rocket's Raticate |
| 4 Nugget Bridge | Misty (blackmailed) | Seize the Cerulean Gym |
| 5 Rocket Hideout | Giovanni | Defeat Persian |
| 6 Power Plant | Lt. Surge (blackmailed); Blue fights beside you | Defeat Zapdos |
| 7 Cinnabar Volcano | Blaine | Survive seven days |
| 8 Cerulean Cave | Giovanni | Defeat Mewtwo |

Stars: one for the win, one within par, one when none of your Pokémon fainted.
Winning plays a reveal on the route: the stars pop on the stop, the road grows
tile by tile and the next front opens; a freed Gym Leader shows up on the
results as a new commander. Replays keep progress and give no second reward.
Team powers unlock on front 2, Super Powers and the freed leaders on front 4.

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

## The modes in detail

- **Skirmish**: point-symmetric battlefields with an HQ at each end of the road,
  each side's own center and two neutral ones. The foe opens with a squad and
  their Ace; both armies count twelve. Rules: your commander, the foe, level, CPU
  difficulty (Easy: half the funds and ¾ of the income; Hard: 1.5× funds, 1.25×
  income and two levels more), starting funds (₽0–10,000), weather, land, size
  (14×9, 16×11 or 20×13) and map.
- **Battle Tower**: Rocket Grunt, Brock, Misty, Lt. Surge, Erika, Koga, Sabrina,
  Blaine, Blue and Giovanni, one per floor, each on their own land and weather.
  Rank = SPEED (100 within par, −10 a day over) + POWER (25 per knockout for each
  Pokémon lost, up to 100) + TECHNIQUE (100, −15 per Pokémon lost): S from 280,
  A from 240, B from 180. The commander has the last word.
- **Safari Zone**: twelve Safari Balls each, eight days, a meadow thick with tall
  grass that keeps breeding Pokémon (a wounded one may run off at dawn): Common 1 point, Uncommon 3, Rare 5
  (Kangaskhan, Tauros, Scyther, Pinsir, Chansey), Very rare 8 (Dratini).
- **Conquest**: Three Bridges, the same captain on both sides, six teammates
  each (three start, three wait in the Box). Win by taking the enemy HQ, or by
  holding 2 of the 3 middle centers at the start of 3 of your turns.
- **Versus**: both players at Lv 20 with plain stats; the draft plays from the
  Box and both share a catalog to deploy; modes HQ War, Capture the Flag and King
  of the Hill; commanders, funds, weather, arena size, map and fog of war (3
  tiles of sight, 4 for fliers; a move into a hidden foe stops short).

## Presentation

- **Title**: pixel art drawn at the game's own resolution — a dusk sky, a
  striped sun, parallax ranges, a mirrored lake, a meadow with the starters, and
  a hand-drawn POKÉ/TAKTIKS wordmark whose letters bounce, breathe and shine.
- **Dialogues**: trainer portraits slide in on their side and darken while they
  listen, voices blip per letter, *emphasis* glows in gold, cinematic bars close.
- **Battle screen**: each half is a painted panorama of the terrain its Pokémon
  stands on (field, meadow, tall grass, forest, mountain, road, beach, sea,
  bridge, town, cave, base, volcano, snow) with team-coloured HP plates,
  Black/White animated sprites, charge auras, impact frames, huge damage numbers,
  muzzle flashes, explosions, smoke and bouncing debris, weather and a KO stamp.
- **Catching**: a spinning throw, an open ball with a red beam, bounces, glowing
  shakes, GOTCHA! and the flight to the PC.
- **Sending out and recalling**: a Pokémon deployed from the PC comes out the
  way the games send one out (the ball pops up out of the building, bursts open,
  and a beam in the side's colour draws a white silhouette that grows, colours in
  and lands: "Go, Pikachu!"); one that faints is recalled by a red beam and its
  ball heads for the nearest PC, "BOX · 2d".
- **Board**: every tile is pixel art drawn in code; units wear team outlines,
  ranges flood out, phase banners tilt in, powers play a commander cut-in.
- **Menus**: a Pokémon's commands open beside it with its portrait and HP, and
  each says what it would come to (targets in reach, KO!, the capture meter and
  WIN when it would take a base, the catch odds, why a skill is not ready). The
  day menu (X) groups End Turn, the PC Box and the Power, what you see, how
  battles play, and Retreat; toggles show a lamp, a highlight glides between
  rows and the footer explains the chosen one. The PC lists the Box ready first,
  with icons, prices and a preview of the Pokémon; with one base it opens
  straight on it. Ending a turn with Pokémon still to act, retreating and
  forfeiting ask first, with the safe answer chosen.
- **Scene changes** close and reopen a Poké Ball over the screen. Everything
  respects reduced motion.

## Controls and saves

- Arrows/WASD: cursor. Z/Enter/Space: confirm. X/Escape: cancel/menu.
- Q/E: cycle units. C: unit info or switch the forecast move. V: forecast details.
- P: commander power. F: fast playback. `+` / `-`: zoom. H: help. M: mute.
- Mouse: point and click; right-click cancels; drag/wheel pans.
- Touch: tap to select/confirm, drag to pan; NEXT jumps to the next ready Pokémon.

Campaign progress saves between fronts; Tower ranks and the Safari record are
kept apart from it. A suspend slot is written at the start of each player turn
(campaign, Skirmish, Tower, Safari and Conquest); RESUME BATTLE returns to it.

## Development and verification

```sh
node tools/model-tests.cjs
node tools/territory-tests.cjs
node tools/integration-tests.cjs
node tools/captain-tests.cjs
SIM_TURNS=60 node tools/sim.cjs 3,7,19 1-8
```

The tests use Node built-ins and the real game modules: combat, forecasts,
roles, saves, powers, commanders, weather, the war economy, deployment, AI
legality, whole Skirmish, Tower and Safari battles played by the AI, the route
and its stars, and UI bounds at phone and desktop sizes.

Browser walks (Chrome over the DevTools protocol) save screenshots to
`artifacts/`: `node tools/cdp.cjs <smoke|flow|mech|mobile|ui|ui2|duel|vs|title|tiles|scenes>`
(append `-m` for a phone viewport), and `PK_Q=… PK_EXPR=… PK_NAME=… node
tools/cdp.cjs page` for a one-off capture.

Deep links: `?ch=N` (a front with a loaner collection; `&brief` or `&prep` to
open its briefing or preparation, `&co=brock` to lead with a Gym Leader),
`?skirmish=SEED`, `?tower=FLOOR`, `?safari`, `?versus=SEED` (`&auto` for random
teams), `?territory=SEED` (`&auto` for the battle). `&silent` mutes; `&nosave`
protects persistence during tests; `&nostory` skips dialogues.

Source modules: `core.js` (canvas, input, motion helpers, design system,
audio), `font.js`, `dex.js`, `data.js`, `animmeta.js` (generated), `art.js`
(tiles, effects, weather), `scenery.js` (battle-screen panoramas), `model.js`,
`captain.js` (commanders and powers), `battle.js`, `menus.js` (the battle's
command menus, the PC and the confirmations), `duel.js`, `campaign.js`
(fronts, battlefield generator and biomes), `war.js` (properties, funds, the
Box, deployment, wild spawns, weather rules, the war AI), `territory.js`,
`scenes.js`, `title.js`, `route.js`, `journey.js` (prologue, briefings,
lessons), `modes.js` (Battle Tower, Safari Zone) and `main.js`. `build.sh`
regenerates the tracked `index.html`. The design is in `docs/frente-kanto.md`;
the earlier redesign's rationale in `docs/redesign.md`.

Sprites: Pokémon Showdown mini icons and trainer sprites, PokeAPI Black/White
battle sprites (static and animated). See `assets/battle/ATTRIBUTION.md` and
`assets/trainers/ATTRIBUTION.md`. Pokémon © Nintendo / Game Freak / Creatures.
