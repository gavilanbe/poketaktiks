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
- **Cost**: `round(BST × level × 0.8, to 100)`, at least ₽1000. A Lv 5 Pidgey costs ₽1000, a Lv 16
  Ivysaur ₽5200, a Lv 30 Charizard ₽12800.
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
| You (Tactician) | your starter | – | by your starter: Rally / Shell Guard / Life Link | Blaze Rush / Tidal Shield / Verdant Bloom |
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
| Sandstorm | non Rock/Ground/Steel lose 1/16 HP each day (never below 1); ranged reach −1 |
| Snow | non-Ice lose 1/16 HP each day (never below 1); walking on grass, roads and sand costs +1; Ice defence +20% |

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

## Phases

1. Advance Wars battle screen (backgrounds, panels, effects).
2. Economy everywhere: properties on every map, funds, the Box, the PC deploy menu, captures to the Box,
   AI that deploys and captures, HQ victory.
3. Trainers: roster, portraits, passive near the Ace, powers with cut-ins and map effects, unlocks.
4. Weather.
5. Modes: Skirmish/Versus setup, Battle Tower, Safari Zone, the campaign rewritten around the lore.
