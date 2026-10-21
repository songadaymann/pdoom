# Factory character sprites

Generated on 2026-10-16 with the built-in `image_gen.imagegen` tool. Eight unmodified RGBA source atlases are saved in `art/factory-cast-v1/`; exact prompts, rejected request and import hashes are in `prompts.json` and `import-manifest.json` in that folder. Media stays ignored.

| Character | Native family | Views / poses |
| --- | --- | --- |
| Zvi Mowshowitz | FZVI | Eight directions; idle and two walk poses |
| Victoria Krakovna | FVIC | Eight directions; idle and two walk poses |
| Max Tegmark | FMAX | Eight directions; idle and two walk poses |
| Paul Christiano | FPAU | Eight directions; idle and two walk poses |
| Ajeya Cotra | FAJE | Eight directions; idle and two walk poses |
| MEG3N | FMGN | Eight directions; idle, two walk, two dance and standing stun poses |
| Robby the Robot | FRBY | Eight directions; idle, walk and signing poses |
| WALL-E | FWAL | Eight directions; idle, rolling and signing poses |

The two petition bots replace worker props 7 and 8. Their signing pose lasts three seconds after a successful new signature; repeated interactions still count only once. The guard and Ajeya’s three prototype dolls use the separate generated [puzzle art pack](FACTORY-PUZZLE-ART.md) added on 2026-10-17. Collisions, timings and rescue conditions are unchanged. Idle people turn to face a nearby player.

`python3 scripts/import-factory-cast.py` extracts 216 native 64-pixel tiles with nearest-neighbour scaling, shared per-character scale, transparent edges and Doom foot origins. It preserves the generated originals. `build-factory-assets.py` imports the pack when installed; without it, the existing runtime’s human art and original procedural robot props provide fallbacks.

MEG3N uses a recognisable film-style doll with blonde hair, beige dress and neck bow in this pass. The previous ring-light/phone drawing is retained as the original fallback; the vase message now describes the dance knocking it down. The distant SAFE MODE phone tower remains its separate existing landmark.

## MEG3N's watched poses (pending art)

While you look at her, MEG3N faces you and strikes one of four poses, chosen at random and never the same twice running: **filming you** (phone and ring light raised, then the light glows), **shelf-doll freeze** (stiff pose, then a deeper head tilt), **peekaboo** (hands over face, then peeking between fingers) and **heart hands** (heart hands, alternating with a blown kiss). Her dance is kept for music. Because she always faces you while posing, these are eight front-view frames (FMGN G-N, rotation 0) from one sheet: `art/factory-cast-v1/megan-watched-atlas.png`, 4 columns (filming, freeze, peekaboo, hearts) by 2 rows (beat A, beat B). `import-factory-cast.py` scales the sheet to her idle height; until it exists, her front idle frame stands in for every pose.

## Reference sources

Photographs were downloaded for likeness reference into ignored `private-assets/factory-cast-references/`; none are packaged as sprites. No redistribution rights to the source photos are asserted.

- victoria: [source page](https://futureoflife.org/person/victoria-krakovna/), [reference image](https://futureoflife.org/wp-content/uploads/2024/05/Victoria-Krakovna-FoL-2024_0261-2-768x768.jpg).
- ajeya: [source page](https://metr.org/team/ajeya-cotra/), [reference image](https://metr.org/assets/images/team/ajeya-cotra.webp).
- paul: [source page](https://iliad.stanford.edu/cs521-spring18/), [reference image](https://iliad.stanford.edu/cs521-spring18/images/Paul.jpg).
- max: [source page](https://futureoflife.org/person/max-tegmark/), [reference image](https://futureoflife.org/wp-content/uploads/2024/05/Max-Tegmark-FoL-2024_0224-2.jpg).
- zvi: [source page](https://www.lionheart.vc/team/), [reference image](https://www.lionheart.vc/app/uploads/2024/06/headshot-zvi-mowshowitz.png).

Character references: [M3GAN](https://www.universalpictures.com/movies/m3gan), [WALL-E](https://www.pixar.com/wall-e), Robby the Robot from *Forbidden Planet*. These generated depictions do not confer rights to the underlying film characters.

## Local verification

Run `node scripts/factory-cast-smoke.mjs` for native character captures, robot signing and MEG3N dance/stun views; `node scripts/factory-browser-smoke.mjs` checks all five rescues and physical return. Results are saved under `output/factory/`.

Verified locally: the cast capture test passed all 13 views/actions; all five rescue sequences and actual five-person return passed with no browser/script errors. All 216 installed frames match the local PK3. The standard game-skill client also booted the level successfully; screenshots were inspected. Evidence: `output/factory/cast-views/report.json`, `output/factory/cast-rescues/report.json`, `output/factory/cast-skill/`. Local build SHA-256: `d87531123aa50b7c889ab376ddb6cbeaeac6619cc4997e90f6bd4f0841f73c87`.
