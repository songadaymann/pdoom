# Intro cut-scene, readable controls and the new CEO faces

Built 2026-10-07 and now wired into the live local launcher. The selected character's film replaces the story panels on a first visit. Existing `pdoom.opening-seen.v1` history and campaign-hub visits still skip it; skipping or finishing remembers the visit. **Watch intro** replays the chosen film from the launcher without starting a run. Missing/unplayable media uses the old skippable text panels as a fallback.

The launcher and status bar use Sam Altman / Dario Amodei portraits. Existing `altman` / `amodei` link, storage, campaign and score identifiers remain compatible and map to the new artwork.

Escape now opens the game's **Resume / Restart level** pause menu. Browser input and the native controls configuration exclude the inherited Doom console, save/load menus, automap and episode shortcuts. The fallback episode list contains only the two campaign levels, and native exits cannot advance into original Doom levels. Gameplay, campaign travel, intro replay and current-level restart remain available.

Point at a visible person with the mouse, or aim the locked crosshair at them, to see their name in Doom lettering. Native names use wall/door visibility checks; they do not expose prisoners through closed cell walls. The meadow uses the same name display. This does not trigger a discovery card or reveal an unreleased prisoner's biography.

Preview everything at **http://127.0.0.1:5198/dev/intro-preview.html**.

## What exists

| Piece | Files | Status |
| --- | --- | --- |
| Readable "How to play" panel | `doom-web/how-to-play.js`, `doom-web/how-to-play.css` | Done. Keycaps plus a plain sans-serif; Doom lettering only on the heading. It's a disclosure: open on desktop, one tappable line on phones (the old text was hidden on touch). Fits the 1280×800 launcher, phone portrait and landscape. |
| Cut-scene player | `doom-web/intro-video.js` | Done and tested. Skip button plus keyboard keys after a 0.6 s grace period (Tab and modifier shortcuts stay available), so the Enter that started the run can't skip it. Pauses when the tab is hidden. Muted fallback with a sound button. Captions go to a screen-reader live region. Resolves `ended`, `skipped` or `unavailable`. |
| Cut-scene films | `scripts/build-intro-cutscene.py` → `doom-web/local/intro/intro-{samwise,mario}.mp4` + `manifest.json` | Rendered from the local WAD, so they live in the git-ignored `local/` tree. |
| HUD faces for Sam Altman / Dario Amodei | `scripts/build-influencer-faces.py` → `doom-web/local/ui/faces/{samwise,mario}/` + `influencer-manifest.json` | Built and wired into both the launcher and HUD. |

Character source art: `art/characters/samwise-othermale.webp`, `art/characters/mario-scaldi.webp`.

## Integration reference (implemented)

1. **`doom-web/index.html`**
   - Add `<link rel="stylesheet" href="how-to-play.css">` after `doom-theme.css`.
   - Change `<p id="controls" class="controls"></p>` to `<div id="controls"></div>`. It must be a `div` because the panel contains block elements, and it must not have the `controls` class, which `doom-theme.css` hides on touch screens.
   - The `#hud-note` paragraph can go: its meaning is now the panel's last line.
2. **`doom-web/checkpoint-hud.js`** (`configureCheckpointLauncher`): for checkpoint levels, replace the `el('controls').innerHTML=…` string with `renderHowToPlay(el('controls'))` (import it from `./how-to-play.js`). Keep the Intake string as it is.
3. **`doom-web/opening.js`** (`showOpening`): after the `seen()` / `remember()` checks, try the film first:
   ```js
   import {playIntroVideo,introVideoState} from './intro-video.js';
   // inside showOpening(ceo), before the panels:
   const result=await playIntroVideo(ceo);
   if(result!=='unavailable')return;
   ```
   `playIntroVideo` accepts `samwise`/`mario` and also the old `altman`/`amodei` ids. For tests, `openingState()` can report `introVideoState()` while a film is playing.
4. **Faces:** add `samwise` and `mario` to the CEO face sets the status-bar build reads (see `scripts/build-doom-statusbar.py`, which reads `faces/ceo-manifest.json`; `faces/influencer-manifest.json` has the same shape). Run `scripts/build-influencer-faces.py` in `build:doom` before `build-doom-statusbar.py`. The picker images and status-bar face mapping use the new sets; persistence ids remain compatible.
5. **Build:** the films take a while to render, so give them their own script (for example `"build:intro": "python3 scripts/build-intro-cutscene.py"`) rather than adding them to `build:doom`.

## Validation

`node scripts/intro-browser-smoke.mjs` checks real video playback for both characters, keyboard and touch skips, natural film end into native gameplay, returning visits across levels/CEO choices, replay, sound-autoplay fallback, tab pause/resume and unavailable media. Evidence is in `output/intro-integration/`. The adapted game client skips the film for gameplay QA.
