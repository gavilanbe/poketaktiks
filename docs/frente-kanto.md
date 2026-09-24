# Frente Kanto: Advance Wars rules for a Pokémon army

Design agreed with the author on 2026-09-23 ("que se asimile más a Advance Wars… desplegar Pokémon, lore,
súper ataques, varias modalidades, algo con la captura"). The four decisions the author took:

1. **Full Advance Wars economy in every mode, campaign included**: funds per property each day, Pokémon
   deployed from your Box at your centers for a price.
2. **Captures go to the Box**: a Pokémon caught mid-battle can be deployed in that same battle (its first
   deployment is free) and, in the campaign, stays in your collection.
3. **Trainers are the commanders**: each with a passive, a Power and a Super Power and a portrait cut-in;
   the partner Pokémon is the Ace on the map. Gym Leaders unlock through the campaign.
4. **Modes**: story campaign, Skirmish and Versus with full setup, Battle Tower with ranks, Safari Zone.

## Lore

Team Rocket has hijacked Bill's Pokémon Storage System. Every Poké Center in Kanto is locked, and the
Pokémon deposited there are out of their trainers' reach. Trainers without Pokémon cannot fight, but a
**Tactician** can command any Pokémon linked to their PC Box. Professor Oak and Bill recruit you.

- Each center you free reconnects the PC in its area: that is why you deploy Pokémon at centers.
- Wild Pokémon you catch are stored in your Box and can be withdrawn at any center you hold.
- Gym Leaders, blackmailed by Rocket, join you as commanders once you free their town.
- Blue races you to free the region: sometimes a rival commander, sometimes an ally.
- Giovanni commands Rocket; the last front is Cerulean Cave and Mewtwo.

The eight existing chapters become the fronts of this war (Pallet, Viridian Forest, Mt. Moon, Nugget
Bridge, Rocket Hideout, Power Plant, Cinnabar, Cerulean Cave).

## The day

A **day** is one turn for each side. At the start of your turn:

1. **Income**: ₽1000 for each property you own (HQ, Poké Center, Field Center).
2. **Upkeep**: your units standing on your properties heal 20% of their max HP and are cured.
3. **Weather** ticks (chip damage, days left). Recovering Pokémon in the Box count down.

Then you act: move and act with each unit, **deploy** at free properties, use a **commander power**.

## Properties

| Tile | Property | Income | Heals | Deploys | Notes |
| --- | --- | --- | --- | --- | --- |
| Q | HQ | ₽1000 | 20% | yes | Captured by the enemy: you lose. |
| J | HQ (bunker) | ₽1000 | 20% | yes | The Rocket HQ on caves and bases; same rules as Q. |
| C | Poké Center | ₽1000 | 20% | yes | The PC terminal. |
| K | Field Center | ₽1000 | 20% | yes | The center of caves and bases. |
| G | Gym | – | – | – | Objective building (seize to win where the map says so). |

Capture: stand on it and choose Capture; progress adds `ceil(10 × HP/maxHP)`, 20 completes it. Leaving
or fainting resets it. Any Pokémon can capture (a full-HP one takes two actions, like Advance Wars infantry).

## The Box and deployment

- The **Box** is the list of Pokémon a side can deploy: in the campaign your collection; in Skirmish and
  Versus the shared **catalog** (every side has the same species, at the same level) plus captures.
- **Deploy**: select a free property you own (or press Z on it) to open the PC. Pay the Pokémon's cost;
  it appears on the property and cannot act until your next turn.
- **Cost**: `BST × (level + 10) / 4`, to the ₽100, at least ₽1000. A Lv 5 Pidgey costs ₽1000, a Lv 20
  Pidgey ₽1900, a Lv 16 Ivysaur ₽2600, a Lv 30 Charizard ₽5300 (the first formula, BST × level × 0.8,
  priced a Lv 16 Ivysaur at five days of income; this one lets a side deploy about one Pokémon a day).
- A deployed Pokémon **faints** back into the Box and **recovers for two of its side's days**; after that
  it can be deployed again at full HP for its cost. No Pokémon is lost for good.
- A side has at most **10 Pokémon on the map**.

## Wild Pokémon and captures

- Wild Pokémon (neutral) roam the map and answer when they are attacked. Tall grass can **spawn** a new
  wild Pokémon every few days while the map is under its wild cap.
- **Catch**: a unit next to a weakened wild Pokémon throws a ball: a free Poké Ball if you picked some up,
  otherwise one bought for ₽500. The chance grows as its HP drops (and with a status).
- Success: it goes to **your Box** marked *fresh*: its **first deployment is free**. In the campaign it
  joins your collection after the battle.

## Commanders

Each side has a **trainer**. The trainer is off the map; their partner Pokémon, the **Ace**, is on it,
wearing the crown.

- **Passive** (day-to-day): applies to allies within **2 tiles of the Ace** while it stands.
- **Meter**: charges with damage dealt (up to 20) and taken (up to 25), 15 per catch, 20 per property
  captured. **Power** costs 50, **Super Power** 100. One use per own turn; effects last until your next
  turn unless they say days.
- If the Ace faints, the meter halves and powers wait until it is deployed again.

| Trainer | Ace | Passive (near the Ace) | Power (50) | Super Power (100) |
| --- | --- | --- | --- | --- |
| You (Tactician) | your starter | Partner bond: allies deal 10% more, take 10% less | by your starter: Rally / Shell Guard / Life Link | Blaze Rush / Tidal Shield / Verdant Bloom |
| Brock | Onix | Rock/Ground take 15% less | Rock Tomb: enemies −1 move, 10% damage | Sandstorm Fort: allies take 30% less, 2 days of sandstorm |
| Misty | Starmie | +1 move on water, Water +10% | Rain Dance: 2 days of rain | Hydro Surge: 3 days of rain, Water +30%, heal 20% on water |
| Lt. Surge | Raichu | +10% critical chance | Thunder Wave: paralyse the three strongest enemies | Thunderstorm: lightning hits every enemy for 20% |
| Erika | Vileplume | centers heal +10% | Aromatherapy: heal all 20%, cure | Petal Blizzard: heal all 30%, enemies on grass take 15% |
| Koga | Weezing | status chance +10% | Toxic Spikes: poison enemies on open ground | Smokescreen: allies +20 evasion, enemy vision 1 |
| Sabrina | Alakazam | ranged moves +1 reach | Calm Mind: special moves +30% | Future Sight: every enemy takes 25% at your next turn |
| Blaine | Arcanine | Fire +10% | Sunny Day: 2 days of sun | Eruption: every enemy takes 20% and burns, 2 days of sun |
| Blue | Pidgeot | +10% damage | Smell Ya Later: allies +1 move | Champion's Pride: allies +40% damage, +1 move |
| Giovanni | Nidoking | income +10% | Earthquake: non-flying enemies take 20% | Rocket Supremacy: Earthquake, allies +30% damage and defence |

Activating a power plays an Advance Wars cut-in: bands in the trainer's colour sweep the screen, the
trainer's portrait slides in, the Ace roars behind it for a Super Power, the power's name is stamped, and
the effect plays over the whole map (lightning on each enemy, healing sparkles on each ally, a weather
storm).

## Weather

| Weather | Effect |
| --- | --- |
| Clear | – |
| Rain | Water moves ×1.5, Fire ×0.5; under fog, vision −1 |
| Sun | Fire moves ×1.5, Water ×0.5 |
| Sandstorm | non Rock/Ground/Steel lose 1/16 HP each day (never below 1); Rock types take ×2/3 from special moves (built instead of the planned ranged reach −1) |
| Snow | non-Ice lose 1/16 HP each day (never below 1); walking on grass, roads and sand costs +1 (not fliers or Ice types); Ice types take ×5/6 |

Maps set a default weather (or random); powers set it for a number of days. The board and the battle
scenes draw it; the forecast includes it.

## Modes

- **Campaign (Frente Kanto)**: the route, lore briefings (the enemy trainer and a line), commander and
  opening squad choice, the economy, stars → rank. Brock, Misty, Erika, Surge, Blaine and Sabrina unlock
  as they are freed; Blue and Giovanni after the ending.
- **Skirmish** (vs CPU) and **Versus** (two players, one screen): map, both trainers, starting funds, income,
  weather, fog and the catalog; Conquest's Three Bridges becomes one of the maps.
- **Battle Tower**: fixed challenge maps with a set enemy trainer; a rank S/A/B/C from Speed (days against
  par), Power (enemies defeated per unit lost) and Technique (units lost), with records.
- **Safari Zone**: a catch race on a map full of wild Pokémon; each catch scores by rarity; the best score
  after the day limit wins; catches go to your Box.

## Presentation

- The duel scene becomes an Advance Wars battle screen: each half is a painted panorama of the terrain
  the Pokémon stands on (field, forest, mountain, sea, bridge, road, beach, town, cave, base, volcano,
  snow) in parallax layers, team-coloured HP panels, muzzle flashes, explosions, smoke and bouncing
  debris; weather and active powers show in it.
- HUD: funds, the day, weather, the commander's portrait and meter.
- Languages: Spain Spanish by default, English on request (OPTIONS or the title's ES · EN pill). Terms follow
  the Spanish games: Nv for level, PS for HP, the official move and type names (Lanzallamas, Planta), la Caja
  del PC, cuartel for HQ, el As for the Ace, FASE DEL JUGADOR / FASE ENEMIGA.
- The opening starts on the maker's card (a sparrowhawk, GAVILANBE PRESENTS); PRESS START and the title's
  foot sign the game "a game by gavilanbe".

## Phases

All five are built (2026-09-23):

1. Advance Wars battle screen (backgrounds, panels, effects).
2. Economy everywhere: properties on every map, funds, the Box, the PC deploy menu, captures to the Box,
   AI that deploys and captures, HQ victory.
3. Trainers: roster, portraits, passive near the Ace, powers with cut-ins and map effects, unlocks.
4. Weather.
5. Modes: Skirmish/Versus setup, Battle Tower, Safari Zone, the campaign rewritten around the lore.

## As built: notes and numbers

- **Balance by simulation.** The AI plays both sides of whole battles model-only (`simWar` in war.js).
  Mirror Skirmishes favour the side that moves first (13 of 15), so the player's side, which a human
  plays better than the AI, starts with that edge. The Tactician got a passive (partner bond) because
  without one the AI's trainer commanders, with an evolved Ace, won 17 of 20 Skirmishes; with it the
  player-side AI wins about 40%, which a human turns into a comfortable but earned win.
- **Commander armies** are base species that evolve with the level (`formAt`), so a Lv 14 Brock fields
  Geodude and Onix, a Lv 40 one Graveler and Golem. The Ace joins its side's Box: it can be deployed
  again after it faints.
- **Skirmish** maps are point-symmetric: HQs at the road's ends, each side's own center three columns in,
  two neutral centers mirrored through the middle. Both armies count twelve (four on the map, eight in
  the Box). Biomes: fields, forest, coast, mountains, snowfield (packed snow `n` walks like a plain,
  drifts `S` cost 2), volcano (lava and rubble on cave floor) and cave, each with its own wild Pokémon.
- **Versus** arenas are mirrored: HQs at the road's ends, each player's center, two neutral ones; the
  flag bases for Capture the Flag moved behind the HQs. Both players deploy from the same catalog.
- **Battle Tower** floors and **Safari Zone** rules are in `modes.js`; records live in `pk_records`,
  apart from the campaign save. The rival AI of the Safari weakens without knocking out, throws when
  the odds and points are worth it, and fights your team when the trade is good.
- **Campaign**: from Mt. Moon each front has an enemy commander (Brock, Misty, Giovanni, Lt. Surge,
  Blaine, Giovanni), their Ace on the map and a Rocket center that deploys their army (five Pokémon at
  the front's level) until you capture it. Fronts 1-2 keep local trainers. Every front has both HQs
  (Joey's and Timmy's camps, then Rocket bunkers): the chapter's goal or their HQ wins it. Gym Leaders unlock after
  their front (`CO_UNLOCK`) and lead your side from the briefing from front 4 on.
