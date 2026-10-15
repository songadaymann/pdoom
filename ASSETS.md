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
license above. Existing film/character/likeness media is also outside that grant.
This change adds no such media. Generated test captures are in the ignored
`output/icon-physics/` folder.

## Public source distribution

The source repository excludes `art/`, generated captures/output, all image/audio/video/font
binaries, Doom IWAD/PK3 files and compiled engine binaries. No copyright or media license is
transferred by the GPL source license. `npm run setup:runtime` fetches a checksum-verified copy
of the separately published runtime to run locally; media retains the terms stated here.

The NES cartridge uses the existing game hero/title art and pdoom-banner-1-flanking.png as
references, generated with OpenAI's built-in image tool on 2026-10-15. Source references remain
private; the reviewed catalog derivative is published separately by the mann.cool catalog.
