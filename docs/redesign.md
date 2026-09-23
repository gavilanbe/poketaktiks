# Redesign: one clear loop, real pixel art, juice everywhere

Started 2026-09-23. Goal from the author: redesign assets, board graphics and UI, make the title
screen real pixel art, give everything excellent juice, and turn the "batiburrillo" of systems
into a game with a clear sense of play.

## Diagnosis

- Four top-level modes (campaign, skirmish, territory, versus), each with its own rule set:
  captain powers in two of them, an economy in one, flags/hill/fog/wild/level/turn knobs in another.
- Systems that overlap: potions, Full Heal and Rare Candy next to Poké Centers, Mend, the Grass
  captain power and between-chapter training; three ball types that only change a number.
- Screens explain rules in paragraphs (eight help pages); the HUD is a wall of counters.
- The title uses a painted illustration, not pixel art; menus and panels are flat and static.

## The loop every battle shares

1. Your team, led by a **captain**, against theirs on a grid with terrain and Poké Centers.
2. Each Pokémon moves, then acts: **Attack**, **Capture** a center, its role **Skill**, **Catch** a
   weakened wild Pokémon (campaign and skirmish), or **Wait**.
3. Damage dealt and taken fills the **power bar**; the captain spends it on a team power.
4. **Centers** heal their owner and charge the bar when captured.
5. One clear **objective** per map, always on screen with its progress.

## Decisions

- Title: Campaign (continue / new), **Quick Battle** (Skirmish or Conquest against the CPU),
  **Versus** (two players). Territory becomes "Conquest" inside Quick Battle.
- The Bag is gone: no potions, Full Heal or candy. One kind of Poké Ball, counted. Map pickups are
  Poké Balls. Old saves convert their balls and drop the rest.
- Captains and team powers in every mode, Versus included (each player picks a style; their
  first pick leads).
- Versus setup keeps Mode, Arena and Fog. Level, turn limit and wild Pokémon are fixed.
- Campaign gets a **route map** between chapters with a three-star rating per chapter
  (clear, under par, nobody fainted); cleared chapters can be replayed for stars.
- Help shrinks to four short pages plus one page for the current mode.

## Presentation

- A pixel title drawn at the game's own resolution: layered sky, parallax hills, a hand-drawn
  wordmark, the starters' animated sprites, sparkles.
- A restyled design system (panels, buttons, headers, badges) with motion built in: panels pop
  open, buttons press, numbers count, scenes change through a Poké Ball wipe.
- Board: team outlines on units, a flood-fill reveal of move ranges, bouncier cursor, stronger
  phase banners, an Advance Wars style power cut-in, capture and victory celebrations.

## Status

Done (2026-09-23):

- Pixel title (`title.js`), Poké Ball scene wipe, restyled design system with motion helpers
  (`appear`, `unfold`, `countUp`, raised buttons, ribbon tabs, shiny headlines).
- Quick Battle hub (Skirmish / Conquest); in-game confirmation for replacing a save.
- The bag is gone; one counted Poké Ball; map pickups and rewards are balls.
- Captains in Versus; Versus setup trimmed to Mode, Arena, Map, Fog and the captains.
- Five help pages.
- Campaign route map (`route.js`) with stars, replays and the reveal of the next stop.
- Battle: team outlines, flooding ranges, ready wave, objective tracker, power meter, tilted
  phase banner, power cut-in, capture celebration, big-number pops, stamped victory with stars.
- Screens: Oak's lab partner choice, team preparation, chapter card, lesson cards, results,
  Conquest setup.
- Later passes: Field Centers ('K') on the five indoor chapters, first-battle and first-power
  coach marks, a boss-battle cut-in, indoor moods (embers, dust, sparks) and outdoor cloud shadows,
  an animated power menu, Conquest HUD and results, Skirmish setup, story portraits, an ending
  over the title landscape, a route theme.
