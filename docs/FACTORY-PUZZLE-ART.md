# Local factory puzzle art

Generated with OpenAI's built-in image generator on 2026-10-17. Original transparent
sprite sheets and the opaque fabric texture sheet are in ignored
`art/factory-props-v1/`. No downloaded references, photographs, film frames,
purchased packs, or third-party character designs were used for these props.
The art matches the local cast's retro pixel rendering and candy factory palette.

| Puzzle | New art and feedback |
| --- | --- |
| Zvi | CD-player boombox off/on, intact vase, broken shards, brass cell key |
| Victoria | Padded playpen fabric, visibly torn fabric after the first hit; existing exact gate-closed success signs retained |
| Max | Petition lectern with zero through three signatures, shipping box moving/stopped/open |
| Paul | Training console with zero through three mastery lights, plus/minus buttons raised/depressed, guard blocking/saluting/stepping aside/praising |
| Ajeya | Teddy surveillance camera intact/broken, alarm idle/flashing, exit stool, identical helper dolls working/walking/clapping/stunned |

Placement polish (2026-10-17): the vase and the teddy camera stand on recoloured
Doom plinths. The camera sits beside Ajeya's case instead of in front of it, so she
stays visible; the dance still drops the vase shards and key to the floor. Victoria's
gate signs hang above eye level so the fabric panel and the gate stay readable.

The three dolls share all four poses. The randomized role selects their actions;
their identity and colors do not reveal the answer before oversight is removed.
Since 2026-10-18 they carry stools (the stool sprite, drawn at .55) from a stacked pile
to a code-drawn packing bin (`FPKBA0`, `build-factory-assets.py`). A v2 animation pack
(8-direction idle/walk and carry cycles plus front action poses) was generated on
2026-10-18 in `art/factory-dolls-v2/`: 24 walk/idle frames, 16 empty-handed carry frames
and 8 action poses. Exact prompts, source checksums, per-cell bounds and a 36-pixel
animated preview are saved with the pack; the v1 atlas stays unchanged. The same day
`scripts/import-factory-dolls.py` (run by `build-factory-assets.py`) sliced it into one
shared sprite, `FDOL`, at a 36-pixel standing height drawn at scale 1: A idle, B/C walk
and D/E carry walk in 8 rotations (cast column order), and front frames F/G clap, H offer
the key, I stunned, J/K press the alarm (back view), L/M sneaky glances. Without the
pack, `FDOL` falls back to the v1 side view (FDL0) as rotation-0 frames, and each doll
mirrors itself (`XFLIP`) to face the way it heads on screen and bobs as it steps.
Existing wrench, platform switch, bars, dance instructions and break-room signs
remain installed. Puzzle timings, rewards, randomized roles and collision sizes
retain the established first-pass behavior.

`scripts/import-factory-props.py` extracts 41 native prop/robot frames and two
wall textures. It preserves source atlases, uses nearest-neighbour scaling,
binary transparency and foot origins, and excludes neighboring-cell artifacts
from pose crops. Source checksums and exact prompts are recorded in the pack's
`import-manifest.json` and `prompts.json`. The originals remain unchanged.

Rebuild locally with `python3 scripts/build-factory-assets.py`, then
`python3 scripts/build-factory-preview.py --resources-only`. Full factory builds
also re-import the optional pack automatically. Without the ignored local pack,
public source builds retain original procedural fallbacks for every frame.
The new original prop art is covered by the original-media CC BY 4.0 terms in
ASSETS.md; the cast and Doom-derived environment keep their separate terms.

This pass updates only the local toy factory. It is not deployed and does not
change campaign progression, scoring, or the other levels.

MEG3N's live-feed screens (2026-10-20) are drawn in code by `build-factory-assets.py`
after the cast import: `FSCRA0`-`FSCRP0` put her own frames (`FMGN` rotation 1, else 0;
idle, walk, dance, stun, the eight watched poses, the flipped dance beats) inside a
44x36 pink monitor with scanlines and a red recording dot, in the same letter order as
`PDFactoryGuardian.Frame`, so `PDFactoryScreen` simply copies her frame; `FSCRQ0` is the
smashed screen (black glass, a star of cracks). They hang as wall sprites at scale .7.

Validation: `output/factory/props-final/report.json` passes all eight native
checks, including the five rescues and all five physical returns;
`output/factory/branches/report.json` passes four alternative behavior paths.
Native captures cover the installed puzzle states; browser and script errors
are empty. The standard game-skill client also boots E2M7 and records gameplay.
