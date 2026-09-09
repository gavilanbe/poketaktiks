# POKÉTAKTIKS — pixel tactics with Gen I Pokémon

**Play:** https://gavilanbe.github.io/poketaktiks/

A Fire Emblem / Advance Wars style tactics game played with the Pokémon Showdown
party icons ("the little ones"). Grid board, move ranges, the yellow path arrow,
counters, doubles, terrain bonuses, type matchups, catching wild Pokémon, level
ups and evolutions, an 8-chapter campaign and endless random skirmishes.

Everything is HTML + JS vanilla with no dependencies: `./build.sh` concatenates
the source files into a single `index.html`. Open it in Chrome (it works from
`file://`). The external assets are `assets/pokemonicons-sheet.png`, the
Showdown mini-icon sheet drawn straight from the sheet by dex number for the
board, and `assets/battle/<num>.png`, the 96×96 Black/White front sprites
used by the attack scene (see `assets/battle/ATTRIBUTION.md`). Big sprites
load lazily; if one is missing the scene draws the mini icon at 2× instead.

## How it plays

- **Player phase → enemy phase → wild phase.** Pick a Pokémon, walk the yellow
  arrow through the blue tiles, then Attack / Catch / Bag / Wait. Red tiles are
  where you can hit after moving. Empty tile or right click opens the menu
  (End Turn, Danger zone, Help, Retreat).
- **Combat is Pokémon maths, FE structure.** Real base stats from Showdown at
  the unit's level, the standard damage formula, STAB (+25%), a softened type
  chart (super effective ×1.5, ×2.25 for a double weakness, resisted ×0.67,
  immunities stay at 0). The defender counters if the attacker stands in one
  of its move ranges and is still standing. Only Scouts and Strikers follow
  up: 10+ SPE over the foe = a second strike. Crits are a flat 4% (24% for
  high-crit moves, certain on a frozen target), ×1.5; speed no longer feeds
  them. The forecast walks the exchange in order (strike, counter, follow-up)
  and its HP-after numbers assume normal hits: every line shows the hit and
  crit odds, and a strike whose critical would KO where the normal hit would
  not carries a KO tag on the crit. A counter or follow-up that only happens
  if an earlier hit misses is greyed and named ("KO first · counters on
  miss"), and chance effects (status %, drain, recharge) are listed separately.
  The forecast is deterministic apart from HIT and CRIT and never rolls dice.
- **Roles.** Type says whom a Pokémon beats; its role (one per evolution
  line, a badge on the unit card and sheet) says how to use it on the board.
  Scout (Pidgey, Spearow, Zubat, Rattata, Meowth, Doduo, Diglett, Scyther,
  Aerodactyl, Ponyta): **Dart**, after attacking it may still move 2 tiles.
  Defender (Geodude, Onix, Sandshrew, Shellder, Rhyhorn, Cubone, Koffing,
  Snorlax, Lickitung, Grimer, Omanyte, Kabuto): **Brace**, spend the action to
  take 40% less damage until its next turn. Amphibious (Squirtle, Psyduck,
  Poliwag, Seel, Krabby, Goldeen, Horsea, Staryu, Tentacool, Slowpoke,
  Magikarp, Lapras): **Tide**, DEF 20% and AVO 20 on water. Controller
  (Bulbasaur, Oddish, Bellsprout, Paras, Tangela, Exeggcute, Venonat, Ekans,
  Drowzee, Jynx): **Root** a foe within 2 tiles so it cannot move on its next
  turn (fliers immune, every other turn). Ranged (Abra, Gastly, Voltorb,
  Magnemite, Porygon, Mr. Mime): **Reach**, ranged moves hit one tile further.
  Support (Clefairy, Jigglypuff, Chansey): **Mend** an adjacent ally for 30%
  of its HP and cure it (every other turn). Everyone else is a Striker: a
  plain attacker that follows up. Brace, Root and Mend sit in the action menu
  next to Attack, use the action, and show their exact effect on a card before
  you confirm; Root and Mend earn a little XP and work every other turn, Brace
  earns none and can be used every turn. The AI uses them under the same
  legality rules (no frozen, spent or recharging users, no out-of-range or
  wrong-team targets).
  A Poké Center, Full Heal or Mend frees a rooted unit.
- **Moves come from types.** Every Pokémon carries a small loadout: the best
  unlocked move of each of its types, the best adjacent-capable move of that
  type when the strongest one only fires at range (Fire Blast keeps
  Flamethrower), and a melee Normal fallback. Signature moves lead the list
  once their level is reached. Ranged types (Fire, Water, Electric, Psychic,
  Grass, Rock…) reach 1–2 tiles, brawlers hit adjacent only. Hyper Beam (Normal
  types, Lv40) must recharge: no counter after firing, and the next turn is
  spent recharging. Statuses: Poison ticks, Burn halves ATK, Paralysis cuts
  MOV, Frozen skips turns and eats guaranteed crits.
- **Danger zone.** Red tiles are where trainer Pokémon can hit next phase,
  yellow tiles where wild Pokémon can. A Pokémon that must recharge threatens
  nothing.
- **Terrain.** Forest 20% DEF, mountain 30%, tall grass 20 AVO, Poké Centers
  heal 30% a turn and cure statuses, lava burns anything that is not Fire or
  flying. Flyers ignore terrain, Water types swim, Rock/Ground/Fighting climb,
  Bug/Grass walk through woods for free.
- **Catching.** Wild Pokémon (yellow, dashed ring) fight everyone. Weaken one, stand
  next to it, choose Catch, pick a ball. Chance grows as HP drops, ×1.3 with a
  status, ×1.5 Great Ball, ×2 Ultra Ball. Caught Pokémon join the party at the
  end of the map. Trainer Pokémon (red) cannot be stolen.
- **Your side has an edge (campaign only).** Your campaign party, including
  catches, carries 20% more HP; in Versus both trainers use plain stats. The
  legendary birds and Mewtwo run on scaled-down base stats so a boss hits hard
  without one-shotting the board. Balance was tuned with `tools/cdp.cjs sim`,
  which lets the enemy AI play the player side through every chapter.
- **Growth.** XP on every hit and KO, 100 per level, stats recomputed from base
  stats. Level thresholds trigger evolutions on the board with a flashing
  silhouette, and between chapters everybody trains up to the next chapter's
  level so nobody is left behind. No permadeath: fainted Pokémon come back.
- **Objectives.** Rout, defeat the boss, seize the Gym, survive N turns.
  Reinforcements arrive on scripted turns. A par turn count earns a star.
- **Versus.** Two trainers on one device. Snake-draft four Pokémon each from
  a roster of 28, pick an arena seed, level and whether wild Pokémon roam the
  middle, then take turns: a hand-off screen asks you to pass the controls
  before each player phase. Arenas are mirror-symmetric with a Poké Center per
  side; wild Pokémon you catch join your team on the spot. Last team standing
  wins (30-turn limit, more survivors wins a timeout). Rematch, redraft or back
  to the title from the results.
- **Campaign:** Pallet Meadow → Viridian Forest → Mt. Moon → Nugget Bridge →
  Rocket Hideout → Power Plant (Zapdos) → Cinnabar Volcano (Moltres, survive)
  → Cerulean Cave (Mewtwo). **Skirmish:** value-noise random maps with a road,
  a Poké Center, a Rival boss and wild catches, using your campaign party or a
  loaner team.
- **Saves.** Campaign progress saves after each chapter; a suspend save is
  written at the start of every player phase so you can close the tab and
  pick the battle up from the title screen.

## Controls

Arrows/WASD move the cursor, Z/Enter/Space confirm, X/Esc cancel (cancelling
after a move undoes it), Q/E cycle units, C shows unit info (and switches the
move in the forecast), F toggles fast enemy phases, +/− zoom the board out and
in when the map does not fit (the ZOOM button does the same), H help, M mute.
Mouse: hover and click, right click to cancel, drag or wheel to pan. Touch:
tap to move the cursor, tap again to confirm, tap-and-drag to pan.

**Reading the board.** Every unit stands on a team-coloured plate whose shape
also tells the side apart: a plain ring for your own team, a spiked ring for
enemy trainers, a dashed ring for wild Pokémon, a barred ring for allies; the
same glyph sits on the HP plate under its feet. Units that can still act keep
their colour and a glint on the rim; units that have acted go grey. Marks sit
in the tile's corners, off the sprite: crown (leader) or skull (boss) top-left,
a CHG tag while recharging, the status tag top-right. The turn card shows the
turn, the objective and READY x/y; the forecast lists the strikes in order
with the HP after the exchange in large type, a KO mark on the strike that
drops someone, and "only if … survives" on strikes that depend on a miss.

**Phones.** Portrait phones render at about 200 logical pixels (the pixel
font is 10-12 CSS px), the board opens zoomed out, the context card and the
buttons sit under the board, and the forecast spans the width.

**Attack scene.** Confirming an attack wipes from the map into a side-on
battlefield: your Pokémon on the left (Player 1 in Versus), the other on the
right, each on its own terrain with a panel showing name, level, team, types,
status and HP, plus that tile's DEF and AVO. The attack name appears, the
strike plays (lunge for contact moves; fire, water, electric, grass, psychic
or a beam/projectile for ranged ones), HP drops on impact, the counter answers
with a COUNTER tag, doubles strike again, and a KO faints on the spot. The
scene is a replay of the one combat roll: skipping never changes the result.
Any key or tap speeds it up, a second press (or X / right click) skips to the
result, and the menu (right click / empty tile) cycles **Battle: Full duel /
Quick duel / Map only**, remembered between sessions. Reduced-motion
preference removes the wipe, lunges and shake. XP, level ups, evolutions and
captures still play on the map afterwards.

## Juice

Screen shake and hit-stop scaled by crits, white hit flash, squash and stretch
on select and on landing, hop-along path movement with dust, type-coloured
particle bursts and projectiles, popping damage numbers and onomatopoeia
(BONK!, FWOOSH!, BZZT!), "Super effective!" callouts, level-up fanfares with
stat arrows, evolution flash sequence, Poké Ball throw with shakes and GOTCHA,
sliding phase banners with the team parading underneath, speech-bubble quips
when you pick a unit, confetti on victory. Chiptune SFX and a small step
sequencer for music, all synthesised with WebAudio (nothing to download).
Reduced-motion preference tones the particles and shake down.

## Files

`core.js` canvas scaling, input, RNG, drawing, sprite atlas, audio ·
`font.js` pixel fonts · `dex.js` Gen I data (generated by `tools/dex.py`) ·
`data.js` types, moves, items, terrain, unit factory · `art.js` procedural
tiles, cursor, arrow, particles · `model.js` pathfinding, combat, AI ·
`battle.js` the board scene · `duel.js` the side-on attack scene (script,
layout, drawing) · `campaign.js` chapters and the skirmish
generator · `scenes.js` title, starter, prep, story, results, versus draft · `main.js` flow,
saves, loop. Deep links: `?ch=N`, `?skirmish=SEED`, `?versus=SEED[&auto]`.

`node tools/model-tests.cjs` runs the deterministic model tests (combat
forecast vs resolver, moves, upkeep, recharge, saves and resume, duel script
vs resolver and skip equivalence, board queue integration) with Node
built-ins only. `tools/shot.sh "ch=3&silent&nosave"` takes a headless screenshot;
`node tools/cdp.cjs smoke|mech|flow|enemy|skirmish|mobile|balance|art|ui` drives the
game over the DevTools protocol and writes screenshots to `artifacts/`.

Sprites: Pokémon Showdown (mini icons) and the PokeAPI sprite repository
(Black/White battle sprites, `assets/battle/ATTRIBUTION.md`). Pokémon ©
Nintendo / Game Freak / Creatures.
