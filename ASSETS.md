# Asset provenance

This initial manifest records the desktop toys. Existing Doom, character, video and other
media retain their own terms; the toy entry does not grant rights to those files.
See `docs/REFERENCES.md` and the existing asset audit for earlier provenance findings.

## 1. Jonathan Mann's original media

The nine desktop icon drawings in `src/doom-desktop-icons.ts`, their procedural extrusion
in `src/doom-icon-toy.ts`, and the synthesized kick/bounce/chime sounds are original,
created for this project on 2026-10-14 and 2026-10-15. The media is CC BY 4.0,
attributed to Jonathan Mann. The artwork is drawn in code; no operating-system icon
bitmaps or product artwork were imported for these toys. Product names label the toys.

The favicon in `doom-web/favicon.svg` is original vector artwork created for this project
on 2026-10-15: a cream italic p and red parentheses on black. It uses paths rather than
a font or third-party image and is CC BY 4.0, attributed to Jonathan Mann.

## 2. Third-party software

Rapier 3D is Apache-2.0: https://github.com/dimforge/rapier
Its complete license is in `docs/licenses/rapier-apache-2.0.txt`.
Three.js and the existing Doom engine have separate software licenses; see
`THIRD_PARTY_NOTICES.md` and the engine's existing notices. Software licenses do not
license the game media they display.

## 3. Paid or restricted packs

No purchased media or asset packs were added for the desktop toy physics update.
Earlier project media has not been fully inventoried by this change.

## 4. Other media with separate or unresolved rights

The supplied Doom IWAD and extracted Doom resources in the existing ignored
`doom-web/local/` folder are third-party game data, outside the original toy-media
license above. This includes `local/ui/textscreen-e2.png` (2026-10-19), Doom's own
SFLR6_1 flat, extracted by `scripts/build-doom-ui.py` for level 3's exit text screen, and
`local/ui/textscreen-e1.png` (2026-10-20), Doom's FLOOR4_8 flat, for levels 1-2's. The
factory's `local/factory-music.ogg` (2026-10-20) is Doom's D_E2M7 track, rendered by
`scripts/prepare-doom-music.mjs D_E2M7 factory` like the other levels' tracks. Level 3's intro
film (2026-10-20, ignored `local/intro/levels/e2m7-intro*.mp4`) is captured from the engine and
composited like levels 1-2's (`scripts/build-level-intros.py`): Doom's WIMAP2 and D_E2M7, the
factory and its cast, and no voice takes (MEG3N's lines are captions only). Existing film/character/likeness media is also outside that grant.
This change adds no such media. Generated test captures are in the ignored
`output/icon-physics/` folder.

**Level 3 voice takes, 2026-10-19.** 67 synthetic takes for MEG3N's Toy Factory, made by
Jonathan in his local Breeze TTS voice lab (`GADtrailers/pdoom/voice-lab`, outside this
repo) and imported by `scripts/import-voice-lines.py` into ignored `doom-web/voice/<key>.mp3`.
The five researchers (Zvi Mowshowitz, Victoria Krakovna, Max Tegmark, Paul Christiano,
Ajeya Cotra) and MEG3N use saved reference-conditioned voice profiles: the researchers from
public YouTube speech excerpts of the real people, MEG3N from M3GAN film clips (source URLs
and excerpts are recorded with the lab's private references). These are voice-likeness
media outside the CC BY grant above, and Breeze's licence limits its output to research and
non-commercial use. Robby, WALL-E, the guard and the dolls use original designed voices. The
game shows subtitles when the takes are absent. Lines and keys: `docs/LEVEL-03-LINES.md`.
A second batch on 2026-10-21 added 18 takes from the same saved profiles (MEG3N's screen,
guard and broadcast lines; each researcher's all-safe and TV lines), under the same terms.

## Public source distribution

### Local factory prototype, 2026-10-15

`scripts/build-factory-assets.py` draws original temporary pixel props, factory materials,
robot dolls, an exit stool, the cotton-candy yard sky and the TOYS crate sticker, and synthesizes
a short original CD-player tune. These
outputs are Jonathan's original project media under CC BY 4.0; they contain no film
stills, sampled soundtrack, purchased packs or third-party character likenesses.
The first-pass generic captive bodies are replaced locally by the generated named cast described below.
The source E2M7 geometry, wall textures, flats and decoration sprites come from the separately
supplied private DOOM.WAD and retain its existing third-party terms; derived maps/PK3s remain
ignored. `scripts/factory_theme.py` recolours those textures and sprites at load time: the
generated `doom-mod/factory-theme-*.txt` definitions name IWAD lumps and hold palette-translation
numbers only, never IWAD pixels.

The source repository excludes `art/`, generated captures/output, all image/audio/video/font
binaries, Doom IWAD/PK3 files and compiled engine binaries. No copyright or media license is
transferred by the GPL source license. `npm run setup:runtime` fetches a checksum-verified copy
of the separately published runtime to run locally; media retains the terms stated here.

The NES cartridge uses the existing game hero/title art and pdoom-banner-1-flanking.png as
references, generated with OpenAI's built-in image tool on 2026-10-15. Source references remain
private; the reviewed catalog derivative is published separately by the mann.cool catalog.

### Factory cast sprites, 2026-10-16

The built-in OpenAI image generator created eight directional sheets in ignored
`art/factory-cast-v1/`: Zvi Mowshowitz, Victoria Krakovna, Max Tegmark, Paul Christiano,
Ajeya Cotra, MEG3N/M3GAN, Robby the Robot (*Forbidden Planet*) and WALL-E.
`scripts/import-factory-cast.py` extracts 216 directional frames; it retains all
generated source sheets unchanged. Exact prompts and import checksums remain with
the local pack. [Factory cast provenance](docs/FACTORY-CAST-ART.md) records each
portrait source URL. Source photographs stay in ignored
`private-assets/factory-cast-references/`; they are reference-only and are not
packaged. Film-character depictions and third-party likeness/reference rights are
excluded from the original-media CC BY grant; no rights to those characters or
source photographs are asserted. The local generated images, native sprites and
PK3 remain ignored. Missing cast media falls back to existing runtime human art
and the original procedural robots. No purchased assets were added.
Since 2026-10-19 the importer also copies the five survivors' idle and walking frames,
unchanged, to ignored `doom-web/outside-assets/figure-{zvi,victoria,max,paul,ajeya}-*.png`
for the meadow after the factory's exit. No new art; same terms as the native frames.

On 2026-10-17, the built-in image generator created the additional
`art/factory-cast-v1/megan-watched-atlas.png` using the existing generated
MEG3N atlas as its sole character/style reference. It contains four front-facing
watched poses with two beats each: filming, shelf-doll freeze, peekaboo and heart
hands/kiss. Exact prompt and source checksum are saved beside the ignored PNG.
The generated original remains as `megan-watched-source.png`; the production
atlas uses crop and transparent padding to form eight equal 448x480 cells and
align both shoe baselines. Generated pose pixels and the soft ring-light halo
are preserved. This film-character depiction retains the separate character-rights
exclusions above. The sheet is saved for later animation integration.

### Factory puzzle props, 2026-10-17

OpenAI's built-in image generator created 13 original atlases in ignored
`art/factory-props-v1/`: boombox, vase/shards, key, petition lectern, feedback
console, rating buttons, shipping box, teddy camera, alarm, stool, guard robot,
generic helper doll and padded fabric. These use original designs without
external reference images and are Jonathan's original project media under
CC BY 4.0. The pack includes exact prompts, unchanged source images and import
checksums. `scripts/import-factory-props.py` extracts 41 native sprite frames
and two wall textures; missing local media has original procedural fallbacks.
Ajeya's packing bin (`FPKBA0`) and the break room's NO TOYS doorway tape (`FTAPA0`) are
drawn in code by `scripts/build-factory-assets.py`, as are the vase smash, Paul's console
chime and buzzer, the break-room TV and big screen (`FTVS`, `FTVB`), whose live frames
show MEG3N's imported dance frames when the local cast pack is present, and MEG3N's 20
live-feed wall screens (`FSCRA0`-`FSCRQ0`: her own front-view frames inside a pink monitor,
plus a cracked frame; a doll silhouette without the cast pack). The factory's status bar
(`PDFBAR`, labelled SCRN) is regenerated from the local DOOM.WAD like the other bar patches. The factory radio plays a 6-second clip of Jonathan's own song "Baby Yoda
Baby Baby Yoda" (Song A Day, 2019; his original media) when the ignored local source in
`art/factory-radio/` is present; otherwise a generated tune.
See [factory puzzle art](docs/FACTORY-PUZZLE-ART.md). Generated images and packaged
runtime remain ignored; no purchased or downloaded third-party media was added.

### Level 4 pod-farm art, 2026-10-18

OpenAI's built-in image generator created all 20 required images and both optional
images from the revised `docs/LEVEL-04-ART.md` in ignored `art/level-04-v1/`.
The current selection contains 219 frames/panels; exact prompts, unchanged source
copies, generation attempts, frame bounds, and checksums remain with the local pack.
SMITH, machinery, props, chair, textures, posters, courier, and retained generic
waiting-room designs are original project media under CC BY 4.0, attributed to
Jonathan Mann. Real-person likenesses and third-party reference rights are excluded
from that grant. Earlier art superseded by the revised brief is preserved separately.

Five photographs were downloaded for face/hair reference only from these pages:

- Jaan Tallinn: https://futureoflife.org/person/jaan-tallinn/
- Nick Bostrom: https://nickbostrom.com/
- Daniel Kokotajlo: https://www.aifutures.org/about
- Katja Grace: https://aiimpacts.org/about/
- Yoshua Bengio: https://yoshuabengio.org/

These photographs remain in ignored `private-assets/level-04-references/`, with
exact image URLs and checksums; they are not packaged or relicensed. Level 3 cast
and prop lineups were style references only. No purchased assets were added.
See [level 4 generated art](docs/LEVEL-04-ART-GENERATED.md). Generated media remains
ignored and is saved for future level 4 import.

### Factory helper-doll animations, 2026-10-18

OpenAI's built-in image generator created three directional/action atlases in ignored
`art/factory-dolls-v2/`: `doll-walk-atlas.png` (8x3), `doll-carry-atlas.png` (8x2),
and `doll-actions-atlas.png` (4x2), 48 frames total. The sole original character/style
reference is the project's existing `art/factory-props-v1/doll-atlas.png`.
Exact supplied prompts, final generation prompts, all attempts, unchanged selected
PNGs, source hashes, and per-cell bounds remain with the pack. The v1 atlas remains
unchanged. These original generic helper-doll designs are Jonathan Mann project
media under CC BY 4.0. No external reference downloads or purchased media were added.
The local animation preview normalizes figure scale and shoe baseline. The same day
`scripts/import-factory-dolls.py` imported the sheets into the native `FDOL` sprite used
in game (the v1 side view stands in when the local pack is absent). See
[factory puzzle art](docs/FACTORY-PUZZLE-ART.md). All media remains ignored by Git.
