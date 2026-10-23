# Level 4: art, voice and music still needed

The running list for [AGENTIC SMITH's pod farm](LEVEL-04.md). Art prompts are in [LEVEL-04-ART.md](LEVEL-04-ART.md). The generated art is in ignored `art/level-04-v1/` and `art/level-04-redo-2026-10-23/`, and `scripts/import-agentic-art.py` imports both. Without the art the level still runs: every imported name has a procedural stand-in.

Updated 2026-10-23, after the SMITH redo, the optional visuals, the voice takes and the music were brought in and `doom-web/pdoom.pk3` was rebuilt. Fresh screenshots are in ignored `output/agentic/final/`, and the art pass's own close-ups are in `output/agentic/art-redo/`.

## Art

All required and optional images are now in the game. The redo pack holds 13 PNGs (61 frames), with a gallery, prompts, checks and a frame-mapping README. The new `smith-atlas.png` and `smith-poses.png` replace the mannequin sheets in `art/level-04-v1/`, and the old sheets are archived in its `history/2026-10-23-before-smith-redo/`.

| Status | What | In game |
| --- | --- | --- |
| Done | `smith-atlas.png` redo, Agent Smith look (prompt #6): A idle, B/C walk, **D grab**, E stunned, rotations 1-8 | `ASMI` A-E. Black suit, narrow tie, sunglasses with green lenses, earpiece, slicked hair. D is his contact attack and his hold on Jaan's hardline. |
| Done | `smith-poses.png` redo (prompt #7): F earpiece / reading his list, G survey, **H possess**, I reboot | `ASMI` F-I. |
| Done | SMITH surveying without his lanyard badge: `smith-survey-unbadged.png` | `ASMI` J. Once Katja's badge is taken he switches to the badge-less `ASMU` A-J for the rest of the level. `ASMU` is painted from the SMITH sheets with the badge removed, not generated. |
| Done | BOOTH 7 jack, empty and plugged: `booth-jack.png` | `AJCK` A/B on the booth door's east jamb |
| Done | Dormant refuge door camera: `camera-dormant.png` | `ACAM` D until the exit arms it |
| Done | C6 camera behind glass: `camera-glass.png` | `ACAM` E |
| Done | SIGN / DON'T SIGN panels, lit and off: `sign-panels.png` | `ASGN` A-D |
| Done | `THERE IS NO SPOON.` and `AGENTS ONLY`: `wall-notes.png` | `ANOT` A/B |
| Done | Empty-handed jailer arm: `jailer-idle.png` | `AARM` E whenever it isn't using a tool |
| Done | Blue and yellow rig cables: `rig-cables.png` | `ACBL` B/C (A stays red) |
| Done | Larger clipboard `survey-clipboard.png` and Katja's throw `grace-throw.png` | `ASRV` A (24×26) and `AGRC` D for 28 tics as she throws |
| Done | First-person held badge: `held-badge.png` | `doom-web/held-badge.png`, shown lower left while you carry the badge |
| Have | The other 20 images | Cast, props, textures, courier and posters, imported as they are |

What would still improve the art (none of it blocks the level):
- **SMITH's poses are drawn to a different build.** In F-J his head is smaller and his body slimmer than in the atlas, so he visibly changes shape when he goes into a pose (earpiece, survey, possess, reboot). The heights match. Fixing it needs a regenerated `smith-poses.png`.
- **The painted-out badge leaves a trace up close.** On `ASMU` there is a slightly darker patch and the lanyard cords stop where the badge was. It isn't noticeable at play distance. A generated badge-less atlas would remove it.
- **Katja's throw is one front-facing frame,** so she throws to her right from every angle.
- **C6's glass is opaque.** Doom sprites can't be partly transparent, so the pane is tinted over a dark backing.
- **The speaker box covers part of the held badge while someone talks.** Checked 2026-10-23 (`output/agentic/final/badge-*.png`): touch landscape is clear (11% under the box), touch portrait now sits in the corner clear of the wrench but is 56% under the box, and a 1024×700 window is 27% under it. Once the line ends the badge is fully visible. At 1280×800 it is clear.

**Optional sounds, still open:** alarm klaxon, dial tone and ringback, a strained taut cable, pod-drain gurgle, paper landing. For now the game uses a pitched `agentic/beep`, a quiet `agentic/snap`, silence, and `pdoom/chess-piece`.

## Music

Done 2026-10-23. `local/agentic-music.ogg` is Doom's D_E2M2, rendered by `PDOOM_PORT=<port> node scripts/prepare-doom-music.mjs D_E2M2 agentic` (156.5 s, -23 LUFS, like the other tracks). The level requests it and plays it. It is ignored media in the main checkout's `doom-web/local/`, and its provenance JSON and WAV are in the worktree's ignored `output/agentic/music/`. Until release it is not on the deploy allowlist.

## Voice

All 78 lines are recorded (Jonathan, 2026-10-23) and imported by `scripts/import-voice-lines.py` into ignored `doom-web/voice/<key>.mp3`. Each line's subtitle shows for the length of its take.
- **All lines:** [LEVEL-04-LINES.md](LEVEL-04-LINES.md), 78 lines by speaker, with when each plays.
- **Still to record:** [LEVEL-04-VOICE-TODO.md](LEVEL-04-VOICE-TODO.md), now empty. A line added to the game later will show up there.
- **One wording change:** the `jaan-cut` take says "Line is dead", so its subtitle (`PDVoiceData.Said`) reads "Line is dead. Kill that camera, then try again."

Both docs are generated from the game's code by `python3 scripts/agentic-lines.py --write --todo`. The plain check fails if a line no longer matches `doom-mod/actors/Agentic*.zs`.

Still open:
- **`jaan-allsafe` may need a new take.** Whisper hears "that bringing phone" where the line says "That ringing phone". Jonathan should listen to it and regenerate it if the words are slurred.
- **The takes exist only in the level-4 worktree** (ignored files). After the merge, the main checkout needs the same import, or the manifest lists takes that are missing and the game falls back to subtitles.
- **Optional new SMITH lines** (not in the game, so not in the list): `Survey submitted.` when he finishes Katja's survey with his badge still on (today he says nothing), and his own line for coming out of C8 when you refuse the NDA (today `smith-spot-3`).

The deploy allowlist (`scripts/audit-doom-assets.mjs`) leaves the level 4 takes out until release, along with the other real-person likenesses.
