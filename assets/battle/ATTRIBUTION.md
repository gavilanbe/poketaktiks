# Battle sprites

`1.png` … `151.png` are the Generation V (Pokémon Black / White) front sprites
for the Gen I roster, 96×96 PNG, indexed by National Dex number. They are used
unchanged by the lateral battle scene (`duel.js`); the left-hand Pokémon is
mirrored on a canvas at draw time, never on disk. If a file is missing or fails
to load, the scene falls back to the Showdown mini icon from
`assets/pokemonicons-sheet.png`.

- Source: https://github.com/PokeAPI/sprites
  path `sprites/pokemon/versions/generation-v/black-white/<num>.png`
- Fetched 2026-09-09 from the `master` branch at commit
  `712e6d9f915a1d2bdfbe991d04eea75e3ad950e7`, byte-for-byte as served by
  `raw.githubusercontent.com`.
- The PokeAPI/sprites repository states no licence of its own for the images.
  The artwork is © Nintendo / Creatures Inc. / GAME FREAK inc. and is used here
  for a non-commercial fan project.
