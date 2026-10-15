# p(DOOM): title, menus and entering a level

Design and implementation record, 2026-10-08. The first browser-menu slice is
implemented locally. Expanded refuge autosaves and public delivery remain future work.
Supersedes GAME-SPEC §2.1's native Playerclass → Episode → Skill menu chain.

## Player flow

```text
TITLE: both heroes + p(DOOM) logo → click / Enter
 MAIN MENU: general intro video behind the choices
  NEW GAME → choose hero → that founder's intro film (skippable) → Last Stand prologue → Bliss
  (?levels=1 for testing: choose hero → choose level → that level's film → gameplay)
  LOAD GAME → resume the autosaved campaign/checkpoint
  READ THIS! → game premise (+ the token, only if a crypto wallet is installed)
  OPTIONS → controls, audio, display/accessibility, replay intros

Gameplay / SAFE MODE → Esc → same menu, with RESUME at the top
```

The first click enters the menu and enables sound. Do not require watching the
whole general film before selecting a level. Keep both existing hero variants;
use the last selected hero's film on return, and Sam's on a first visit until
the player chooses Dario. Changing hero changes the film. Loading a campaign
restores its hero, rather than substituting the menu's current selection.

## Title and main menu

The title composition needs both current heroes, Sam Altman and Dario
Amodei, under a large p(DOOM) logo, with the same pixel density and palette as
the Doom title screen. Implemented title background: `local/ui/title-heroes.webp`, with the exact
`pdoom-logo.png` layered above it. This is Claude's selected D1 logo, copied
unchanged from `local/intro/title-logo.png`: math-italic ivory p and curved
parentheses around the original DOOM lettering. UI rebuilds preserve this choice. The old native `titlepic.png` remains an engine
asset, rather than the player-facing browser title. Use Sam's existing art
and Dario's new reference described below. Keep this as a lightweight still image so it appears before the
engine loads. Small prompt: **CLICK OR PRESS ENTER**.

### Dario's revised appearance (2026-10-08)

Jonathan's supplied **new-mario.png** is the canonical Dario reference:
[project copy](../art/characters/references/new-mario.png). Original:
`GADtrailers/pdoom/new-mario.png`.
Appearance: bald crown, two dark spiky tufts at the sides, dark rounded glasses,
yellow suit and white shirt, no mustache. This supersedes the older Dario art;
do not use the old mustached character for the new title composition.

Update together: title artwork, hero-selection portrait, Dario's general intro
and poster, any appearances in level intros, and the status-bar mugshots. The
HUD needs the entire Doom expression/health set (42 frames: glances, turns,
grin, pain, attack, god/dead), rather than replacing only the neutral face.
Preserve the slot dimensions, offsets, palette and animation behavior.

Implemented: the landscape Dario film and poster use the new reference and
updated crops/jokes; all 42 HUD expressions and hero-picker faces use the revised
code-native art. The title shows both current heroes. Internal `amodei`/`mario`
IDs and save compatibility are preserved. Sam's appearance is unchanged.
Old vertical social exports remain outside the runtime inventory.

Main menu entries: **NEW GAME**, **LOAD GAME**, **READ THIS!**, **OPTIONS**.
No manual SAVE GAME. No original Doom episodes or engine console. Browser users
close their tab to quit, so a QUIT GAME entry adds little. During active play,
add **RESUME** and **RESTART LEVEL**. Restart and New Game must clearly describe
what progress will be replaced before doing it; opening Esc never resets data.

Use Doom's red menu lettering and skull cursor, with cream small-font helper
text. Navigate by arrows/Enter/Esc, mouse, or touch. These are browser menus
drawn with our Doom assets; they do not expose GZDoom's general menus.

The general film continues behind the menu, with a dark backing behind choices
so its captions and the menu never compete. It can run to the end while the
player browses. First visit: start at the beginning, sound subject to settings.
Subsequent visits: show a quiet background excerpt/poster by default, with
**WATCH INTRO** available in Options. This preserves the existing “story only
by default on first visit” rule while retaining a moving menu background.
On Esc during play, use a quiet background excerpt, rather than restarting the
whole narrated story over the paused game. Reduced motion uses a still.

## New Game and choosing a level

Keep the existing hero choice and its subtitle **BOTH OF THEM DID THIS.** /
**SAME RULES. DIFFERENT GUILT.** It belongs after New Game, before the map choice.
Retain a draft selection while navigating Back. Do not delete an existing
campaign when the player merely opens New Game or changes a hero.

Heading: **CHOOSE YOUR LEVEL**. Present the actual level names prominently;
the episode puns can be smaller subtitles. Default selection is the first level.

| Level | Subtitle | Availability |
| --- | --- | --- |
| THE CONTROL PROBLEM | KNEE-DEEP IN THE DATA | Playable; The Inferminator |
| CONFABULATION STATION | THE SHORES OF HAL | Playable; HAL3000 |
| SPAWNING CHATS | INFERENCE | Gray; COMING SOON |
| HUMAN CONTAINMENT AREA | THY FLESH COMPUTED | Gray; COMING SOON |

Both playable maps can be chosen immediately. Coming Soon entries remain
visible but cannot start a level. Keep authored level IDs separate from native
map numbers; exclude the old Intake prototype from this player-facing list.
Only selecting a playable level and confirming replacement, if a campaign
exists, commits a New Game. Intro skip is never a progress-reset command.

For this first menu revision, use today's fixed balance. The older five-skill
proposal remains future work; omit an extra difficulty screen from onboarding.
If introduced later, difficulty must be recorded in the save and scoring rules.

## Level film and gameplay handoff

Level selection switches from the general background to the selected level's
full-screen film. Each level film plays automatically on that level's first
visit, has an obvious **SKIP**, and can be watched again from Options. Restart,
Load Game, or a later visit does not force a repeat. Esc skips a film; inside
menus Esc moves back one screen; during play Esc opens the paused menu.
Record intro-seen separately from campaign progress so starting a new campaign
does not force already-watched films. Keep the current opening-seen key when
migrating. Missing media must lead to a brief readable premise/title fallback,
with a way to proceed; it must not prevent playing.

The current v2 landscape films were inspected, including their ending frames:

| Film | Duration | Native start recorded in manifest | Last GO scene begins |
| --- | --- | --- | --- |
| `e1m4-intro.mp4` | 19.00 seconds | `(2032,1120)`, angle 180°, view Z 41 | 16.811 seconds |
| `e1m7-intro.mp4` | 19.51 seconds | `(0,-246)`, angle 90°, view Z 41 | 17.309 seconds |

These positions match our corrected outside-refuge entrances. There is no need
to recapture just to repair the spawn handoff. The frames do not include all
recent environment additions, so they are not a pixel-identical snapshot of
the final current map. Current manifest: `local/intro/levels/manifest.json`.
Source timeline: `scripts/level-intros.json`.

For now, reuse those films. If a future spawn changes, cut before the listed GO
scene, then render **GO.** over the actual paused gameplay view. This is also
a good eventual handoff: it matches the selected hero, current map and viewport
without baking each combination into another video. Claude can replace just
the final shot if we prefer to retain the wholly rendered film instead.

Begin shared engine/data downloads after entering the menu, prioritizing the
selected background film. Fetch only the chosen level film. Boot the chosen map
when selected; keep world simulation, hunter movement and score time paused
until both boot and film finish/skip. If loading lasts longer, show **LOADING**
with progress, not an early GO. Reuse the existing worker when changing maps;
never try to transfer the same OffscreenCanvas twice. Release pointer lock in
menus; reacquire it through the existing user-gesture path when resuming.

## Autosave and Load Game

Current implementation: `campaign.js` writes `pdoom.campaign.v1` on committed
level exits. It records rescued/lost/escort masks and hero, but not a mid-level
position, puzzle state or last selected map. The current interface therefore
cannot honestly promise to resume an interrupted rescue exactly as left.

Proposed save contract for the new menu:

- Keep committed campaign data authoritative; preserve existing death, retreat
  and replay rules. A checkpoint does not count someone as evacuated to camp.
- Autosave a separate safe checkpoint on reaching the refuge with newly freed
  survivors. Store the level, hero, inventory, opened puzzle routes, rescued
  companions, health and camera progress needed to reconstruct that checkpoint.
  Resume safely in that refuge; never pretend to restore an arbitrary corridor.
- Commit campaign evacuation/loss data on exits as today. Autosave in SAFE MODE
  after that commit; include enough hub state to restore that visit.
- **LOAD GAME** shows a small summary: hero, saved survivors, last checkpoint.
  With a checkpoint it resumes it. With only a legacy committed save, resume
  SAFE MODE through a supported hub bootstrap. With no save, disable the entry
  and show **NO AUTOSAVE YET**. Do not silently start a fresh campaign.
- Show a brief **AUTOSAVED** only after a successful write. Save to this browser
  initially. Cloudflare hosting does not itself provide cross-device saves.
  Handle unavailable browser storage without trapping the player in the menu.
- Track checkpoint/run IDs and active play time so loading cannot double-submit
  a result or count videos and menus as play time. A checkpoint reload must be
  distinguishable from an uninterrupted run if the leaderboard requires it.

For a smaller first implementation, Load Game can explicitly resume only the
last committed SAFE MODE save; show **SAVED WHEN YOU LEAVE A FACILITY**. Expand
to refuge checkpoints separately rather than presenting exit-only persistence
as full mid-level autosaving.

## Read This! and Options

Read This! explains the premise and p(DOOM). The token (name, network and a
copyable contract address, from `doom-web/token-info.js`) appears there only when
the browser has a crypto wallet extension installed (`doom-web/wallet-detect.js`,
listen-only: it never connects or reads an address). Without a wallet, nothing
about the token appears anywhere (Jonathan, 2026-10-14). Jonathan confirmed the
PDOOM token on Solana on 2026-10-15; its address is configured in token-info.js.
Playing never needs a wallet or token. `scripts/read-this-token-smoke.mjs` checks it. The older SYSTEM CARD! label is superseded
by Jonathan's READ THIS! request here.

Options: keyboard rebinding; reset controls; mouse sensitivity; SFX and music
volume; cutscene sound; fullscreen; reduced motion; replay general/level intros.
Persist preferences separately from campaign data. Remapping must update native
controls, browser input filtering, touch behavior where relevant, and displayed
prompts together. The cutscene, native engine and SAFE MODE must all honor audio
settings. Pause menu/world audio rather than letting game sounds play underneath
the menu film. Keep fixed menu navigation available while editing game bindings.

## Cloudflare delivery

### Optimization and loading before the public release

Optimize the complete shipped experience before going live: engine/data,
textures and sprite atlases, audio, videos, and the startup sequence. First
measure cold and warm loading and gameplay performance, then reduce unnecessary
downloads and decode work without changing the authored pixel-art appearance.
Keep reference images and raw production files out of the runtime bundle.

Ship a Doom-style loading screen: red **LOADING** heading, cream small-font
stage label, a metal-framed progress bar, and the p(DOOM) logo/current heroes.
It must appear before the engine initializes. Use downloaded-byte progress
where known, then named stages such as **STARTING ENGINE** and **ENTERING THE
FACILITY**. Do not show a made-up percentage during unmeasured startup work.
Retain the level-film image behind a compact loader when the film finishes or
is skipped before the engine is ready. Render **GO.** only when input, audio
and the world are ready. No hunter movement or score time while loading.

Priorities: title/fonts/menu first; the one selected background/level film;
shared engine and required gameplay resources next. Cache shared downloads
across level changes and retry without redundant fetching. Keep only one active
video, stop hidden videos, and defer optional SAFE MODE features until needed.
Prefer trimmed, reviewed video exports with progressive MP4 metadata, suitable
bitrate/resolution, and intact crisp pixels. Optimize sprite/texture and audio
delivery from source assets; keep original masters. Prepare short audio cues
before gameplay to avoid the previously fixed audio/frame stalls.

Measure the final served transfer sizes, time to visible menu, time to playable
level, and frame pacing. Test slow-network and warm-cache visits, intro Skip,
retry after a failed fetch, and returning through Esc. A failed download must
offer **RETRY** without deleting a save. The loading screen is part of onboarding,
not a substitute for optimizing the payload. This is a pre-release requirement;
the loading screen and shared downloader are now implemented. Full compression,
production caching and live-host performance verification still precede public release.

Use a Cloudflare Worker with Static Assets for the menu, engine and approved
media. Menus render before WebAssembly initialization. Keep release assets
versioned and cacheable; HTML/manifests can select the current version. The local
test server's blanket `no-store` policy is not a production caching plan.

Measured current landscape MP4s: general Sam/Dario variants 7.76/7.86 MiB, E1M4 9.60 MiB,
E1M7 12.29 MiB. These each fit the documented 25 MiB Static Asset file limit,
so those files alone do not require a separate video service. Confirm progressive
MP4 playback, seeking/range responses, MIME types and startup performance on the
actual deployed domain before selecting the final media delivery path.
References checked 2026-10-08:
[Static Assets](https://developers.cloudflare.com/workers/static-assets/),
[file limits](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

Publish a deliberately assembled runtime directory, excluding raw captures,
private QA packs, output reports and unused alternate videos. The existing
public-art/music release boundary in GAME-SPEC §9 still applies; public hosting
is not permission to upload the private commercial WAD or its derived media.

## Implementation and acceptance

1. Regenerate Dario's full HUD face set and intro/title art from the new
   reference; review them consistently at native pixel size.
2. Build the browser title/menu state machine and Doom-style visuals. Integrate
   current hero picker and pause/blocking paths, preserving existing saves.
3. Connect map selection and both level films, Doom-style loading screen,
   preload/boot pause, intro-seen
   migration and safe fallbacks. Preserve deep links for development.
4. Wire truthful Load Game behavior and persist Options across all game modes.
   Add refuge autosaves as a separate save/schema feature if included in scope.
5. Optimize the approved runtime bundle, record cold/warm startup and gameplay
   performance, then verify the Cloudflare-hosted flow.

Acceptance: first visit and returning visit; both heroes and levels; New Game
Back/cancel preserves save; disabled future levels; Load Game preserves hero and
progress; slow/failed video and engine loading; Skip; Esc during native gameplay
and SAFE MODE; zero paused score time; every audio source honors settings;
keyboard/mouse/touch menu navigation; no underlying engine menu or console;
browser storage failure; no downloads of every level movie at once.


## Local implementation delivered, 2026-10-08

- `doom-web/onboarding.js` / `.css`: title, moving main-menu background,
  hero/level choice, disabled future levels, Read This!, Options and Esc/Resume.
  First menu visit plays the general film; returning/paused menus use a muted
  machines-scene excerpt. Reduced motion uses a still.
- `doom-web/preferences.js`: persisted music/SFX/cutscene volume settings,
  mouse sensitivity and key mapping. Facility and SAFE MODE audio share volume
  buses; mapped interaction prompts follow the selected keys.
- `doom-web/asset-loader.js`: streaming byte progress, single shared downloads,
  cached successful files and retry. WASM bytes go directly to the worker.
  Downloads begin after title entry while films/menu remain usable.
- Native loading gate: no rescue/guardian/run ticks until the browser receives
  the new attempt's first state. Restarts wait for deferred native menu closure, then ignore queued state from
  the old map until the new attempt is confirmed.
- Films play automatically once per level, including first entry from SAFE MODE;
  Skip/Esc are available. Missing films offer a readable briefing and Continue.
- Load Game restores only the committed exit save in SAFE MODE, labeled as such.
  Opening/canceling New Game preserves it; failed downloads preserve it too.
  Browser storage failure allows play without persistence. Refuge checkpoint
  restoration is not included in this slice.
- Authored title source/provenance: `art/onboarding/`; reproducible delivery via
  `scripts/build-doom-ui.py`. Dario landscape rebuild: `npm run build:intro`.
- Audit: `npm run audit:doom:assets` writes a private runtime inventory under
  `output/onboarding/assets/`, excluding QA, raw captures and unused social
  movies. Shared native startup is 33.3 MiB raw; estimated gzip/Brotli transfers
  are 22.1/20.9 MiB. These are estimates, not deployed transfer measurements.
  All four landscape films have progressive MP4 metadata before their media data.

Validation: `npm run test:doom:onboarding` exercises actual native Chrome, both
heroes/maps, Skip/seen history, restart, confirmed/canceled New Game, saved
SAFE MODE entry, remapped movement, Options persistence, pause/timing, portrait
and landscape touch menus, failed-download retry and missing-film/storage
fallbacks. First-prisoner guide-to-refuge regression and the existing HUD,
campaign/score and spatial-audio unit checks are also run. Mobile testing is
menu/touch emulation, not a certification that native WASM works on every phone.
No public deploy is part of this change.
