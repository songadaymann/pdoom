# Level 4 generated art

Generated locally on 2026-10-18 with OpenAI's built-in image generator, following [the current art brief](LEVEL-04-ART.md).

The selected pack is in ignored `art/level-04-v1/`: **20 required images plus both optional images**, using the brief's exact filenames. There are 219 frames/panels, 22.79 MB total; no individual selected PNG exceeds 2.35 MB. Open the pack's `index.html` through a local HTTP server for a gallery, individual cells, and links to each original sheet.

The brief changed during generation. The current pack includes the cable drum, jack-in chair, survey kit, sockets, SMITH's survey-writing pose, and the grey jailer arm's lever/telephone/alarm/crystal-ball states. Earlier waiting-room art, cable box, and superseded poses remain under `superseded-brief/`; they are not part of the current 22-image selection.

## Selected images

| File | Grid |
| --- | --- |
| `tallinn-atlas.png` | 8 × 3 |
| `bostrom-atlas.png` | 8 × 3 |
| `kokotajlo-atlas.png` | 8 × 3 |
| `grace-atlas.png` | 8 × 3 |
| `bengio-atlas.png` | 8 × 3 |
| `smith-atlas.png` | 8 × 5 |
| `smith-poses.png` | 4 × 1 |
| `payphone.png` | 3 × 1 |
| `cable-drum.png` | 3 × 1 |
| `hardline-hands.png` | 1 |
| `pods.png` | 4 × 1 |
| `jack-chair.png` | 1 |
| `harvest-pod.png` | 2 × 1 |
| `katja-kit.png` | 5 × 1 |
| `jailer-arm.png` | 4 × 1 |
| `sockets.png` | 3 × 2 |
| `camera.png` | 3 × 1 |
| `pickups.png` | 2 × 1 |
| `switchboard.png` | 2 × 1 |
| `booth-door.png` | 1 |
| `courier.png` (optional) | 8 × 2 |
| `posters.png` (optional) | 2 × 1 |

## Portrait references

Downloaded on 2026-10-18 from the person's own or organisation's site. The photographs remain reference-only in ignored `private-assets/level-04-references/`; no permission to redistribute those photographs is asserted.

| Person | Source page | Source image |
| --- | --- | --- |
| Jaan Tallinn | [Future of Life Institute](https://futureoflife.org/person/jaan-tallinn/) | [Portrait](https://futureoflife.org/wp-content/uploads/2024/05/Jaan-Tallinn-FoL-2024_0129-2.jpg) |
| Nick Bostrom | [Official home page](https://nickbostrom.com/) | [Portrait](https://nickbostrom.com/img/nick-bostrom-header.jpg?v=4) |
| Daniel Kokotajlo | [AI Futures Project](https://www.aifutures.org/about) | [Portrait](https://www.aifutures.org/Daniel.jpeg) |
| Katja Grace | [AI Impacts](https://aiimpacts.org/about/) | [Portrait](https://aiimpacts.org/wp-content/uploads/2014/12/KatjaGrace-25-July-14.jpg) |
| Yoshua Bengio | [Official home page](https://yoshuabengio.org/) | [Portrait](https://yoshuabengio.org/sites/default/files/styles/focal_crop_1250x1250/public/frontpage/yb2025rlm1481v3-website-4_1.jpg?h=755ef5dd&itok=lC-G_VMz) |

Style references were `art/factory-cast-v1/cast-lineup.png` and `art/factory-props-v1/puzzle-lineup.png`. They were used for pixel technique and proportions; their existing cast members were not requested as new subjects. Original geometric layout guides were also used during generation. SMITH's extra poses and the jailer arm use the selected original SMITH design as a reference.

## Verification and import

The pack records exact prompts, all attempts, source locations, and SHA-256 hashes. Every selected PNG is byte-identical to its generated source. All 19 sprite sheets have real alpha transparency; the three texture/poster sheets are fully opaque. Each of the 219 cells contains artwork. Complete props and figures fit their cells; the cable drum's trailing cable deliberately meets the right edge, as requested by the brief. Candidates with insufficient margins were regenerated through the image tool.

Use the grids and rounded frame bounds in the pack's `quality-report.json`. Image dimensions and within-cell padding vary. Normalize character scale and shoe baseline from alpha bounds during native import, as in the factory cast pipeline. The selected sources have not been manually cut, rearranged, recoloured, or repainted. Level 4 runtime integration remains a separate build step.

Original SMITH, machinery, props, chair, textures, posters, courier, and retained generic waiting-room designs are Jonathan Mann project media under CC BY 4.0. Third-party photograph, likeness, and reference rights remain separate. See [ASSETS.md](../ASSETS.md). Images, local reference photos, previews, and generated output remain ignored by Git.
