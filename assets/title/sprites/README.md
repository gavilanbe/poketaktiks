# Modular title sprites

The live logo contains **11 independent letter instances**. It does not load a
complete logo image. Its letters use the game's Rótulo glyph shapes, with new
pixel bevels, outlines, depth, and five separate highlight frames per glyph.

| Atlas | Pieces | Animation |
| --- | --- | --- |
| `letters.png` | 8 glyphs in gold and ivory, 5 frames each | Staggered arrival, squash, individual float, traveling highlights; tap the logo for a wave |
| `icons.png` | Ball, map, dice, flag, crossed swords, resume, music | 4 distinct frames per icon; selected menu icons animate at 6–7 fps |
| `buttons.png` | Idle, focus, pressed | Separate end caps and stretchable center, focus lift, press squash, highlight sweep |
| `effects.png` | Spark, diamond, ring | 4 frames each, with independent particle positions, velocities and lifetimes |

Each piece also has a separate transparent frame strip in its corresponding
subfolder. All PNGs use real alpha. `atlas.json` lists source rectangles, glyph
advances, anchors and frame rates; the game reads the same metadata from the
generated `titlemeta.js` module.

The editable art source is `tools/build-title-sprites.cjs`. It creates the
pixel shapes and PNGs with Node built-ins, without an image API or external
dependencies. It never edits or slices an AI-generated composite logo.

Regenerate from the repository root:

```sh
node tools/build-title-sprites.cjs
sh build.sh
```

`scenes.js` composes and animates the pieces. Hit targets remain stable during
visual movement. Confirmation lasts 200 ms, rejects duplicate activation and
clears before entering the next scene or showing the existing save-replacement
confirmation. Reduced motion disables ambient animation and plays actions
immediately. Missing sprite sheets retain usable code-drawn controls.
