# Title-screen assets

- `kanto-landscape-v1.webp`: 1672 × 941, generated with the built-in ImageGen tool on 2026-09-11. The runtime uses the same illustration in landscape and frames the character group above the menu in portrait, without stretching it. WebP quality 92; approximately 430 KiB.
- `sprites/`: the live, modular title system. Eight unique glyphs in two palettes have five highlight frames each; eleven independent letter instances form the logo. Seven icons have four distinct frames each, alongside three button states and particle sprites. See [`sprites/README.md`](sprites/README.md) for the editable source and regeneration commands.

The illustration and sprite atlases load independently of the game sprites and have code-drawn fallbacks. The background composition is cached at the current logical canvas size. Each letter, icon and particle is composed separately at runtime. Pointer, touch and keyboard selection share the same short press transition. Reduced-motion preferences disable ambient motion and remove the transition delay.

Pokémon characters belong to Nintendo / Game Freak / Creatures. This is a fan game. The illustration was generated, not downloaded from an official art source.

## Final image-generation prompt

Built-in ImageGen, new image, no reference images:

```text
Use case: stylized-concept
Asset type: production background illustration for the title screen of POKÉTAKTIKS, a Gen I Pokémon turn-based grid tactics game.
Primary request: create a gorgeous polished pixel-art game title key visual, landscape 16:9, 1536x864 or nearest landscape resolution. Authentic detailed 32-bit adventure pixel art, deliberate pixel clusters, crisp edges, restrained dithering, no smooth 3D rendering. Warm sunset gold, cream clouds, sage green hills, rich teal river and deep forest navy shadows; wistful adventurous summer atmosphere.
Scene/backdrop: an elevated view over a lush Kanto-inspired valley: winding river, a small stone bridge, a tiny red-roofed town, layered mountains receding into a golden evening sky. The landscape's subtle square patches of meadow and paths evoke a tactical game board organically, without UI or obvious drawn grid.
Subject: in the RIGHT HALF foreground, on a grassy overlook, a beautifully drawn cheerful Pikachu as the largest focal character, accompanied by Charmander, Squirtle and Bulbasaur. All four recognizable, correct anatomy, expressive poses, looking out toward their next adventure and partly toward the viewer. Small travel-adventure group, balanced natural arrangement, enough separation to read silhouettes.
Composition/framing: important! The LEFT 43 percent will contain a logo and menu added separately in code, so keep it very calm: softly shaded forest foliage and simple teal shadow shapes with no characters, no important landmarks, no sharp bright highlights. The scene and four characters occupy the right 57 percent. Characters grounded near 77 percent of height, heads at roughly 48-65 percent. Sky and distant landscape retain beautiful depth across the top. Dark foliage framing bottom corners. Full-bleed illustration with no border.
Constraints: ONLY the environmental illustration, no typography, no title, no menus, no button shapes, no UI, no letters, no watermark. One coherent finished scene, never a sprite sheet or collage.
```

## Verification

Run `sh build.sh`, `node tools/model-tests.cjs`, `node tools/territory-tests.cjs`, and `node tools/integration-tests.cjs`. The title checks cover all save states at phone, tablet and desktop sizes, menu bounds and overlap, pointer and keyboard routing, sound control, starting the game without a loaded illustration, and cancellation of save replacement.

