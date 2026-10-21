# p(DOOM)

Play at **https://mann.cool/pdoom/**. Source: https://github.com/songadaymann/pdoom.

Copyright 2026 Jonathan Mann. Source code is **GPL-3.0-only**, because this project integrates
the GPL GZDoom engine; see [LICENSE](LICENSE) and the engine provenance below. Original media
and third-party game data have separate terms in [ASSETS.md](ASSETS.md).

## Run the current game

Node 22+ and current Chrome/Edge with WebAssembly JSPI support are required.

```sh
npm ci
npm run setup:runtime
node scripts/build-doom-outside.mjs
node scripts/serve-doom.mjs
```

Open http://127.0.0.1:5198/. The checksum-verified setup downloads the separately distributed
runtime assets; authoring images, personal recordings, generated output and game data are
excluded from this source repository. `PDOOM_RUNTIME_ORIGIN` can point at another trusted
runtime mirror. `.env.example` lists optional variables without credentials.

Without those assets, `npm run dev` runs the earlier self-contained procedural Three.js
prototype. `npm run build` builds that fallback. The complete authoring pipeline additionally
requires the source media described in ASSETS.md; it is not required to run the published game.

## Level 3: MEG3N’s Toy Factory

MEG3N’s Toy Factory is E2M7, Spawning Vats, with bright toy-factory materials and five physical
rescue puzzles. Since 2026-10-20 it is part of the campaign: in SAFE MODE, `MEG3N.AVI`’s door
walks into it and its exit switch comes back out there (the five at camp, the clear in the save).
Since 2026-10-21 it has its own Level 3 scoreboard: a fresh SPAWNING CHATS run from the
episode menu ranks (see `docs/SCORING.md`). The unscored
[practice page](http://127.0.0.1:5198/?level=meg3n-factory) starts in the showroom and takes the
`?puzzle=` development flags. Full guardian vent traversal and final sound/animation remain later work.

With the supplied private `doom-web/local/DOOM.WAD` and existing local runtime present:

```sh
python3 scripts/build-factory-preview.py
node scripts/serve-doom.mjs
```

The preview build needs Python with Pillow. Space/E interacts, click/Ctrl swings the wrench,
and Esc pauses. [Level 3’s specification](docs/LEVEL-03.md) records the approved puzzle contracts.
Run `node scripts/factory-browser-smoke.mjs` against the local server for native browser checks,
`node scripts/factory-hub-smoke.mjs` for the SAFE MODE round trip and `node scripts/factory-exit-smoke.mjs` for the exit.

---

# p(DOOM) — Five Prisons

A playable design prototype of reverse Doom: start alone, find imprisoned humans, improvise a rescue and keep people alive while an overwhelming hunter searches for you. The browser Doom mod is the current implementation direction. The earlier Three.js prototype remains available separately.

Friends playtest: **https://pdoom-playtest.novox-robot.workers.dev/** — standalone
Cloudflare preview with separate test scoreboards; the public game is now on mann.cool.
See [playtest hosting](docs/PLAYTEST-HOSTING.md) for updates and verification.

Local opening experiment: [The Last Stand](http://127.0.0.1:5198/?prologue=1)
(New Game → The Control Problem). Robot-filled rooms and endless escalating reinforcements lead to a real combat defeat and quiet Bliss wake-up; the opposite founder guides you to the first prison. This
sequence is the current public opening; see
[the prologue design](docs/COMBAT-PROLOGUE.md).

## Actual Doom mod in the browser

Jonathan chose a real Doom mod with browser play required. **Five Prisons** is the default level at **http://127.0.0.1:5198/**:

```sh
npm run dev:doom
```

Use current Chrome or Edge with WebAssembly JSPI support. The launcher detects missing support. This uses the actual GZDoom WebAssembly engine, an authored UDMF map and ZScript gameplay packaged as `doom-web/pdoom.pk3`, plus the `DOOM.WAD` supplied in `~/Downloads/doom.zip`. [The first-level design](docs/LEVEL-01.md) records the intended progression and unverified playtest goals.

### Current checkpoint: Five Prisons in Command Control

The rescue prototype modifies the supplied original E1M4 map. Its original 139 sectors retain their starting heights, textures and lights; original vertices and decorative placements are preserved. Specific new cells and crawl passages extend the map to 149 sectors. This is original Doom map data rendered by GZDoom, with original exits disabled and no meadow preview.

Start alone and find five people. Since 2026-10-10 each rescue has exactly one solution, so no two feel alike:

| Person | Encounter | Solution |
| --- | --- | --- |
| Liron Shapira | Watched east-side cell with a padlock that cannot be broken | Take the long winding crawlspace (you duck automatically) to the inside release. |
| Stuart Russell | North-gallery turret, armoured against wrench and slingshot | The gallery's centre block starts lowered, so the turret is visibly firing down the middle as you enter; work round the sides to the power breaker on its back. |
| Eliezer Yudkowsky | Southwest maintenance cell; the front lock is permanent | Follow the rear shutter's yellow cable round the maze corner, strike its damaged junction with the wrench, then use the inside release. |
| Geoffrey Hinton | West machinery bulkhead | Find the demolition charge, plant it on the cracked wall and get clear before it blows. |
| Holly Elmore | Northwest bridge cell | Restore power at the feed switch, then raise the bridge at its control. |

Eliezer's rear shutter stays open once cut, as a second way through the maze.

The charge produces smoke and flying wall fragments, and opens a real native passage. The turret fires native plasma projectiles. The northwest landing retains Doom's rising floor; companions can operate that original mechanism and use the lower lintel that fits humans. Ordinary colored Doom doors are usable facility doors, without discarded original key requirements.

The first person freed knows a refuge and leads there, waiting if the player falls behind. It uses the original side room west of the starting hall and east of the central ring, with a native closing bulkhead and a fixed grate over its secondary entrance. E operates the bulkhead directly or its controls; companions use the same door, which waits for humans to clear before closing. The hunter cannot enter or target people inside. Later arrivals automatically settle there and pace within safe spots. Captives also pace inside their locked cells; all living poses have subtle breathing and waiting look turns. The meadow group continues small steps around their gathering spots after arrival. Pausing freezes this movement. Freed people follow automatically; there are no manual Stay/Follow orders. Named on-screen dialogue explains the first guide and the return for the others. If the guide dies or becomes the controlled body, another freed person takes over or a location clue remains.

Start with 100 health; hunter shots deal 30, so four hits kill an unhealed person. Prisoners also take damage rather than dying immediately, and control transfer preserves their remaining health. Six finite Doom stimpacks heal 10 each, and three refuge medikits heal 25 each, capped at 100. Walk over supplies to collect them; full health leaves them for later. The status bar shows health, freed prisoners, the refuge once known, and freed/sheltered/living tallies.

Once all five cells are resolved and the surviving people gather inside the refuge, its bulkhead locks. Nobody immediately explains the way out. After 40 seconds of active game time, a survivor says “There must be another way out of here.” In the Computer Station HAL locks you in itself; its main breaker is in a niche on the room's north wall, behind a steel shutter that opens two seconds after the lock (HAL asks you not to touch it after 40 seconds), and while it reboots you lead everyone through the dark station to the original exit beyond Roman's pod bay, where its red exit switch works once everyone is in the room. Leaving either level, the last Doom frame melts away into the meadow, Doom's own screen wipe. Pausing freezes this clock. The cover prompt stays generic until inspected; select the wrench, aim at its four silver bolts and hold Space for a second apiece. A spare wrench appears in the recess if needed. The opened cover reveals a bent 40-unit-high duct: crouch through it, and the surviving people crawl after you. The final turn reveals a clean meadow with wind, dense animated grass and the actual pixelated Doom passage visible in the entrance behind you. The ending counts whoever survives; walking and looking around remain available. Deaths remain permanent until restart; captive people cannot inherit control.

WASD moves, mouse drag or arrows turn, Page Up/Down aims vertically. Doors open when you walk into them, walking over an item picks it up, and low ducts crouch you automatically (C still crouches by hand). Space uses things, like original Doom (switches, levers, releases; E works too). A locked mouse click or Ctrl swings the retained wrench or, held and released, fires the slingshot (ball bearings: quiet, staggers the hunter, which goes to where they clatter), T switches wrench/slingshot, Shift runs, Esc opens the menu, F toggles fullscreen. Touch controls include Use, Swing/Shoot and Tool. Restart starts a fresh attempt.

The status bar's **CAMS** row (and the meadow's **CAMERAS 0/9** line) counts unique camera destructions. Picking up the wrench plays an original metallic clank. Camera destruction plays an original casing crunch, low burst and falling-metal tail from its persistent housing, including gun hits; repeated hits on a broken housing add neither sound nor tally. [Audio source and provenance](art/audio/provenance.json).

Nine native cameras watch different routes. One wrench hit or shot destroys each, stopping that camera’s reports. Hits use the actual view and native collision, so walls block melee. Cameras and destroyed turret housing erupt with fire, smoke, sparks and metal fragments; the wrench stays in your hand. The turret takes three wrench hits or one gunshot; its rear breaker remains a quiet alternative. A close wrench strike briefly interrupts the hunter.

The launcher, native title/menu, HUD and dialogue use the p(DOOM) logo and bitmap-derived Doom lettering. Normal starts show three skippable story panels about the machine takeover and five captive experimental subjects. Enter, Space or E advances; Esc or Skip enters the facility. The local ending shortcut bypasses the story.

The long first crawl hides Milo until the final approach; the opening objective reveals no location. The hunter retains its far northwest start and slow 49 Doom units/sec pursuit. This is a five-rescue playtest, with temporary turret art and text dialogue. The cover, secret passage and meadow ending are playable. The doorway uses a live view of the native passage, rather than reconstructing the entire Doom map in the outdoor renderer; its interior perspective is fixed. Human balancing and physical-phone/browser compatibility still need testing.

For local ending tests, open **http://127.0.0.1:5198/?dev=end** and enter the game. This starts at the refuge with five living rescued people and the wrench; all four bolts remain intact. A visible development badge links back to the ordinary start. The loopback server enables the capability through `/dev-config.json`; `PDOOM_DEV=0` disables it. Static/public serving without that endpoint leaves it disabled, and the native fixture requires both `pdoom_development` and `pdoom_dev_end`. Restart repeats the selected start mode. `npm run test:doom:escape` exercises the new ending; `DOOM_ENDING=1 DOOM_CASES=five-prisons-gather npm run test:doom:campaign` extends the ordinary rescue fixture through the meadow.

[Current redesign acceptance](output/redesign/acceptance-summary.json) records the opening, retained melee, independent surveillance, turret routes, automatic escort/pad duty, finite health, refuge protection, delayed hints and complete endings. The ending remains playable with six, five or one survivor. Touch layouts use Chrome emulation; physical-phone and Safari support are unverified. Earlier diagnostics remain in their source reports; the summary selects passing final cases and records the tested native build and served browser assets.

New generated camera assets: [intact source](art/checkpoint/camera-source.png), [broken source](art/checkpoint/camera-broken-source.png), [exact prompts and provenance](art/checkpoint/prompts.json). Both were made with the built-in image generator; transparent sources are imported as small Doom sprites. Tool and lock sprites are code-authored.

[Sam’s rear-shutter acceptance](output/sam-shutter/acceptance-summary.json) records eight targeted checks on the current build. `npm run test:doom:sam` checks the rear shutter, real wrench range/wall collision, standing player/companion passage and automatic inside latch. `npm run test:doom` (or `npm run test:doom:checkpoint`) runs the original seven camera, crawl, parking, control-transfer and portrait/landscape touch cases. `npm run test:doom:campaign` runs the additional encounter and group checks. `npm run test:doom:refuge` runs health/healing, first guides, inherited wounds, five-person staging/recall, native bulkhead protection and touch cases. Legacy follow/order fixtures first establish the refuge as known; first-guide behavior has its own tests. Browser tests use native player-position fixtures followed by actual keyboard input with the normal hunter active; companions always walk. The close-range gate check places the real hunter outside through an unbound QA console event while leaving its normal rules active. Touch checks are Chrome emulation, not physical-phone certification. [Previous health/refuge acceptance](output/checkpoint/refuge/acceptance-summary.json) records 27 passing cases on the served build, with per-case report provenance and final mobile layout reruns. [Earlier five-prison acceptance](output/checkpoint/five-prisons/acceptance-summary.json) records the original 18 cases before health/refuge changes.

[Single-player scoring and mann.cool leaderboard integration](docs/SCORING.md) now provides a frozen Doom-style scorecard, exact native active time, cover-opening p(DOOM) snapshot and rescue/fastest-perfect/fastest-clean-sweep boards. The loopback server stores local scores on this computer; public mann.cool registration/deployment remains separate. Development endings and console/cheat runs show scores but cannot submit. [The level registry and completion hook](docs/LEVELS.md) support future maps, per-level targets and isolated boards. `npm run test:doom:score` checks the score/lifecycle/API; `npm run test:doom:leaderboards` checks native clock/pause/cheats and isolated scorecard/shared-shell submission fixtures.

### Previous Intake test

The previous group-start level is still available at **http://127.0.0.1:5198/?level=intake**. It has the holding room, armory, cart/service route, charge/breach, visible outdoor ramp, rescue relay and safety boundary. Its controls are now Space interact, click/Ctrl shoot, Q Follow/Hold, G give gun and R finish once someone is safe. `npm run test:doom:intake` runs its separate browser checks.

One generated adult character supplies the first crowd animation test: [sheet](art/intake-survivor-sheet.png), [prompt](art/intake-survivor-prompt.txt), [resource metadata](art/intake-survivor-sheet.json). The sheet contains eight directions and four walking phases, imported as 32 virtual sprites using the original PNG without pixel edits. The generator rejected the nude request, so this version wears gray shorts. All five companions share this one character. The hunter, prop and death graphics remain temporary Doom art; armed poses and cast variety remain to do. Camera/obstruction interactions are authored actions, not general-purpose object physics. Escort behavior, encounter balance and the outdoor composition still need human playtesting. The current Five Prisons HUD is described below.

`npm run build:doom` regenerates the PK3 from `doom-mod/`; `npm run test:doom:intake` runs the Intake browser checks against the running server. See `output/doom-browser/intake-qa/report.json` for the latest pass/fail results and distinction between natural movement and targeted console-position fixtures. `node scripts/build-character-resources.mjs` regenerates the 32 directional frame definitions. The runtime is pinned to [tomb-engine commit 6c735315](https://github.com/mungus43/tomb-engine/tree/6c735315b8ac1b1dd6646ac78c46bbbdbb775a5c), with hashes and a local audio-clock fix recorded in `doom-web/engine/provenance.json`. Upstream license and README are retained there. The supplied commercial WAD stays under ignored `doom-web/local/`, served on loopback for local testing. No browser or public-release compatibility beyond the reported checks is implied.

Five Prisons draws the original Doom status bar from the local WAD's own patches (`npm run build:doom` runs `scripts/build-doom-faces.py` and then `scripts/build-doom-statusbar.py`, which generate them into ignored `doom-web/local/ui/faces/` and `doom-web/local/ui/stbar/`; `npm run test:doom:statusbar` checks the bar and face in the real game, and `scripts/statusbar-fidelity-capture.mjs` with `python3 scripts/statusbar-fidelity.py check` audits the in-game bar pixel for pixel against vanilla `st_stuff.c` drawn from the WAD; see [output/doom-hud/README.md](output/doom-hud/README.md)), relabelled in the same lettering: AMMO shows gun rounds (blank with the wrench, like the fist), HEALTH, a FREED grid in place of ARMS (prisoners 1–5 yellow when freed, grey while captive, red when lost; the sixth cell marks the refuge once known), the mugshot of whoever you control with Doom's face logic (looking around, grinning at rescues and pickups, ouch on hunter hits, turning toward a hunter aiming from the side, rampaging while swinging or after a camera, dead face on loss), P(DOOM) in place of ARMOR, a steel wrench, the yellow maintenance keycard and a charge in the key slots, and CAMS/FREE/SAFE/LIVE tallies in the ammo table. On touch screens the bar sits under the view in portrait and along its top edge in landscape. Jonathan chose an authored in-world estimate rather than a simulated probability: survival begins at about 12%, rises when living people are discovered/released/sheltered, and falls with injuries and permanent losses. The bar shows its complement, P(DOOM), meaning nobody survives; it pulses on Doom's fire colours at 90% or more. One person reaching permanent outside safety makes survival 100% and p(DOOM) 0%, while the remaining rescues still matter. The launcher, status-bar description and telemetry identify this as an in-world estimate. It is not the old Monte Carlo forecast and makes no calibration or 45-second horizon claim. The heavy bar drops away in the meadow.

The actual simulated forecast still requires a deliberate port: the earlier code clones its own small simulation, and cannot directly clone complete Doom engine worlds. A shared ZScript simulation or a separately validated forecasting model would need to be chosen for that future system.

Music is prepared once from the supplied WAD into ignored `doom-web/local/intake-music.ogg` (D_E1M1) and `doom-web/local/rescue-music.ogg` (D_E1M4), then played through Web Audio outside the engine. Live MIDI rendering caused a 75–80 ms pause roughly every half-second. To regenerate the local tracks, run `node scripts/prepare-doom-music.mjs` for Intake and `node scripts/prepare-doom-music.mjs D_E1M4 rescue` for First Rescue with the Doom server running; this requires Chrome and ffmpeg. Without the prepared track, the game starts with sound effects and no music. The engine frame limit is 120; measured rates depend on browser and hardware. The browser music volume is currently fixed at 25%, separate from the engine's music slider.

SAFE MODE (Bliss) promises what's next (2026-10-14, `src/doom-hub-future.ts`). Levels 3 and 4 stand where the hub spec puts them, locked: MEG3N.AVI, a sawtooth toy factory (E2M7's own walls under raincoat yellow, a candy chimney puffing pink smoke rings) under a 35 m selfie-stick phone whose notification badge never stops counting; and AGENTIC.BAT, a 60 m black tower on an E2M2 crate plinth whose glass rains green dingbats under a "thinking..." spinner and a FIND USER to-do list, with a red phone booth that rings in threes. Each has five dark lights and a README.TXT; SPACE at its door opens a Win95 install dialog (a creeping, slipping bar; "Time remaining: calculating..."; Cancel is not available; READ THIS! or R opens READ THIS!). The summit holds the final door: a giant Display Properties dialog (Screen saver: 3D Maze, Wait: N people) under a flipping hourglass; SPACE there opens it (Preview is not available). 1 km south, the MCP column's face downloads like a progressive JPEG, 2x2 blocks before any level, 4x4 after one, 8x8 after two. Nine kickable giant desktop icons (My Computer, Winamp, Minesweeper, Solitaire, Paint, The Internet, a floppy, Recycle Bin, SECRETS.TXT) lie about the meadow and by HAL's exit: walk or sprint into one and it tumbles, bounces and settles naturally. As of 2026-10-15 these are chunky, 0.34 m thick pixel silhouettes with real Rapier rigid-body physics: off-centre kicks generate rotation, hills redirect them downhill, and toys can collide and stack. Each toy has its own mass: My Computer and Recycle Bin are heavy, while the cards, floppy and text file fly much farther from the same kick. Their separate labels face you; the toys themselves keep their physical orientation. Grass presses down under grounded toys. All of it stays hidden during the first wake-up walk, like HAL's station. To try it, open `?safemode=1`: straight into SAFE MODE as if both levels were just cleared, out of HAL's door (`&level=five-prisons` for the bunker), from an in-memory save that leaves a real save alone. `node scripts/hub-future-smoke.mjs` checks it (both levels cleared via Load Game, muted). Since 2026-10-20 MEG3N.AVI's door is a real door (Space walks into the factory; see Level 3 above); AGENTIC.BAT still installs.

After both facilities are resolved, meadow movement unlocks a faster travel pace: walking is
6 m/s (previously 3.6), running is 10 m/s (previously 6). The opening and first return retain their
original pace. This counts both rescued and lost people, so a completed run with losses still
unlocks it. `node scripts/meadow-travel-smoke.mjs` checks actual movement and the unlock conditions.
The varied toy weights and faster travel are deployed to the friends playtest (2026-10-15).

Desktop toy checks: `npm run test:doom:icons` (with the local Doom server running) builds the meadow,
checks kick impulses, slopes, stacking, wall tunneling and frame-rate independence, then exercises real
keyboard and emulated mobile touch input, pause/resume and visual captures. Results are in
`output/icon-physics/`. Physics runs at 60 fixed steps/second; nine convex toy bodies share a sampled
meadow heightfield and simple building colliders. The existing hub instance preserves their positions
while visiting a facility; a page reload starts a fresh world. Deployed to the friends playtest on 2026-10-15.

The AGENTIC phone booth is a local spatial sound: its bell fades with distance and is silent
beyond 36 m, with HRTF direction that follows camera movement throughout each ring sequence.
Pause, backgrounding and facility entry stop its scheduled bells. `node scripts/phone-audio-smoke.mjs`
checks both the running booth and rendered stereo audio, including turning and walking away mid-ring.

The Bliss meadow plays Jonathan's supplied original `bliss.mp3` from `doom-web/music/bliss.mp3`. The stereo track loops with a gentle 1.5-second fade-in at 25% volume alongside the existing wind. It stops during pause/results and resumes from the same position; facility music stays off outdoors. `src/doom-bliss-audio.ts` owns this mix separately from native Doom audio. The full native ending/audio/loop check is recorded in `output/bliss-song/ending/report.json`.

Claude's campaign plan is in [docs/GAME-SPEC.md](docs/GAME-SPEC.md); the implementation and design review is in [docs/SPEC-REVIEW.md](docs/SPEC-REVIEW.md). The review identifies remaining rules to settle before expanding the campaign, rather than changing the existing level to match the whole future spec.

## Earlier Three.js prototype

The remaining sections describe the separate earlier prototype, including its simulation, art and forecast. They do not claim those implementations are the current Doom mod's behavior.

### Run

Requires Node 22+ and npm.

```sh
cd pdoom
npm ci --ignore-scripts
npm run dev
```

Open **http://127.0.0.1:5197/**. The server binds loopback only. Build with `npm run build`; `npm run preview` serves the build at **http://127.0.0.1:4197/**. No cloud service, account, API key, paid generation, or runtime network asset dependency is used. Dependencies are already installed in this workspace.

WASD move, mouse or arrow keys look, Shift run. **E tries the object you face**, click/Space attacks, **G gives your gun to a nearby companion**, Q cycles follow → hold → escape. R restarts, Esc pauses, F toggles fullscreen. Touch buttons and drag-to-look are included; desktop is the primary test target. On platforms without pointer lock, arrow-key look remains available.

The starting room has a charge, guns, a camera and five other adults. Try moving the obstruction more than once. You can plant a charge at the cracked wall; stand well back. The EXIT signs lead to a usable hatch. Outside, the wired relay opens the second hatch and perimeter and shuts off surveillance. Getting outside does **not** end the run. Once one person crosses the final gate, control returns to someone still needing rescue. Finish when everyone is dead or safe; the result reports survivors.

## What is implemented

- First-person indoor/outdoor play in one connected scene; a visibly naked adult crowd with varied builds on one procedural articulated rig.
- One hunter, line-of-sight aim wind-up, lethal shots, stochastic target/strategy choices, camera reports and searching remembered positions. The hunter can follow through the hatch.
- Cameras can be smashed; a crate can be pushed and changes collision/paths; a collected charge destroys the weak wall, makes a real opening, attracts the hunter, and can kill nearby humans.
- Collectible guns can be given to companions with line of sight. Bots fire automatically to interrupt the unkillable hunter. Player fire also staggers it; bare hands can give a very brief close shove.
- Five bots with global follow/hold/escape orders, path replanning after changes, and soft separation to avoid escort collisions. Outside rescue controls alter the same map.
- A successful hunter shot immediately kills that body. Control transfers to a living unsaved companion, preferring one outside the current firing lock and then proximity. Dead bodies do not respawn. This is a reversible first-test choice.
- A probability estimate computed in a worker from the actual simulation; pause/help explains its assumptions while the HUD stays simply `p(doom)` and a percentage.

## What the percentage actually means

**Chance that nobody is permanently safe now or reaches final safety within the next 45 simulated seconds, if everybody switches to automatic evacuation now.** A survivor still inside after 45 seconds counts as a forecast failure, without being killed or ending the real run. This is **not** eventual extinction or a calibrated prediction of the human player's choices.

48 cloned futures use the same 0.1-second movement/visibility/hunter/weapon rules as live play. The declared evacuation policy opens the main hatch and outside relay; after the relay, route planning may use either open hatch. It does not pick up new equipment, push crates, smash cameras or plant bombs. A lit fuse continues; armed humans fire normally. Independent seeded futures never advance live RNG. Shared sample seeds help compare interventions.

The display updates asynchronously, so it can briefly describe an earlier snapshot. `~54%`, `≈0%`, and `≈100%` are sample estimates. At 48 samples, the approximate 95% sampling margin near 50% is ±14 percentage points; zero observed failures still has a Wilson upper bound around 7.4%. Certain `0%` is reserved for someone already permanently safe, certain `100%` for everyone dead with nobody safe. Once a person is safe the number stays zero; further rescues still count.

This definition is a deliberate provisional compromise. [Design](docs/DESIGN.md) compares eventual-extinction estimates with unresolved-rollout bounds, expected casualties, save-everyone risk, and prediction learned from play data.

## Art, engine and reference decisions

Three.js standalone makes the physical edits, continuous exterior and cloneable simulation directly testable. A literal Doom mod has the strongest authentic map/material pipeline but needs a focused feasibility test for the human crowd, dynamic geometry and forecast architecture. Godot remains a production candidate with stronger integrated character/physics/navigation tooling. No engine decision makes proprietary art reusable.

All current bodies, robot, textures, landscape and props are **original procedural placeholders**. The crowd gag is present, but these are not MakeHuman exports. No original Doom textures, maps, sounds, Windows wallpaper, film character, Freedoom artwork or linked generator code is bundled. The green-field reveal has the intended color/shape direction; it is not yet a faithful photographic Bliss treatment.

The related [Dungeon Forge repository](https://github.com/majidmanzarpour/threejs-procedural-dungeon) is public and MIT. The exact linked X post could not be retrieved, so a match to its clip is unverified. MakeHuman/MPFB core assets are available under CC0; actual shared-rig authoring/export remains to do. Authentic Doom data, a faithful final Bliss asset plan, and a chosen hunter asset are consequential unresolved asset decisions. [Reference and license evidence](docs/REFERENCES.md) includes the primary sources and limitations.

## Verification and remaining limits

See [verification report](docs/VERIFICATION.md), [simulation QA](docs/SIMULATION-QA.md), and [browser evidence](output/browser/report.json). Run:

```sh
npm test
npm run build
# With dev server running; uses an installed Google Chrome:
node scripts/browser-smoke.mjs
node scripts/inspect-threejs-canvas.mjs --url 'http://127.0.0.1:5197/?test' --state active-play
```

The browser smoke test uses real keyboard/touch events at explicit interaction fixtures; it is not an unassisted player playthrough or a fun/balance certification. Diagnostics shortcuts are gated behind `?test`. Source simulation tests separately exercise complete autonomous routes, death and outcomes.

Still limited: no multiplayer/human network takeover, no procedural map generation, no MakeHuman/animation import, no general rigid-body physics or arbitrary destruction, no sound, no corpse weapon recovery, no sophisticated cover/panic/stuck recovery, and no human enjoyment study. Weapons and shortcuts are intentionally strong for discovery tests; balance needs play. Cameras currently sense by radius plus sightline rather than a viewing cone. The meadow is wider than the dungeon navigation field; clear outdoor steering supports roaming, while complicated outdoor detours need a larger navigation system.

No files in other projects were edited. Nothing was pushed, published, purchased or deployed.

Human art update: [five distinct people, standing/crouching sheets, robot atlas and exact generation prompts](art/cast-v1/README.md). Four new identities supplement the original Milo. Each person keeps their appearance in native rescue encounters, the articulated final crawl and the meadow. The hunter now uses an original chrome endoskeleton with walking, aiming and stun views. The importer preserves unmodified generated sources, aligns feet, uses crisp nearest-neighbor scaling and emits per-character directional resources. Doom sprite families are registered through native state banks before the per-site selector uses them. Corpses retain the existing temporary death artwork.

Factory cast art (local, 2026-10-16): [eight generated character sheets, directional import and provenance](docs/FACTORY-CAST-ART.md). After installing the local media, run `python3 scripts/import-factory-cast.py` then `python3 scripts/build-factory-preview.py --resources-only`. `node scripts/factory-cast-smoke.mjs` captures every identity, robot signatures and MEG3N’s animation in the native level.
