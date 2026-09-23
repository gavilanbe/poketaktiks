# ImageGen tall-grass tiles

**Status (2026-09-23):** the game now draws its tall grass procedurally in `art.js` (`drawTallGrass`, one sheet per map variant with the same four states and foreground layer described below). These ImageGen sheets are kept for comparison and load with `?terrain=imagegen`; `?terrain=classic` still shows the static tile.

ImageGen drew the complete terrain sheet in `source/imagegen-tall-grass-v2-original.png`, using the actual Pokétaktiks tiles and map as references. The game loads `imagegen-tall-grass-v2.png` directly for terrain `t` / `tall`.

`tools/build-terrain-sprites.py` only crops the 16 complete ImageGen cells, scales each to 32×32 with nearest-neighbor and maps colors to the existing five-green game palette. It does not arrange individual plants or redraw the design. The original sheet, generation prompt and source SHA-256 in `imagegen-tall-grass-v2.json` document where the imported pixels came from.

Both runtime sheets are 128×128 px. Each cell is 32×32. Columns are four animation frames; rows are the four states below. Map variants stagger animation timing while using the same generated drawings.

1. `idle`: unoccupied grass, 240 ms per frame.
2. `rustle`: a visible unit enters, 110 ms per frame.
3. `occupied`: a lower center leaves the unit readable, 240 ms per frame.
4. `recover`: the unit leaves, 140 ms per frame; then idle.

`imagegen-tall-grass-v2.png` is the opaque terrain base. `imagegen-tall-grass-front-v2.png` is a mask of the already-painted foreground leaf pixels in its bottom seven rows; the game draws these after the Pokémon and before its team/HP/status markers. All runtime pixels use integer coordinates, nearest-neighbor sampling and binary alpha.

The renderer follows the unit's visible position during the actual movement queue. It ignores fog-hidden units. Reduced-motion mode uses still poses. State is transient rendering data and never enters a save, consumes gameplay RNG, or changes movement/defense/avoidance rules. The original procedural game tile remains the loading/error fallback. The earlier experiment that composed a grass motif into tiles is no longer used.

Local comparison after `sh build.sh` and serving the repository:

- New terrain in the original map: `/?ch=1&nosave&silent`
- More grass and forest: `/?ch=2&nosave&silent`
- Previous terrain: `/?ch=1&nosave&silent&terrain=classic`

Only tall grass is replaced in this initial trial. Other terrain types remain the game's existing tiles.

Validation: the browser-loaded asset URL was checked and a rendered occupied tile was compared pixel-for-pixel with the matching imported PNG rectangle. Real movement, occupied/recovery transitions, fog visibility and the classic fallback passed; the nine integration checks also passed.
