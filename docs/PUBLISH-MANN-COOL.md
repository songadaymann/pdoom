# mann.cool publication plan

Requested 2026-10-15: publish the current Doom-browser game at https://mann.cool/pdoom/,
using existing game artwork as inspiration for the catalog's NES cartridge.

1. Inspect the current catalog checkout, routes, shell and score integration; preserve unrelated work.
2. Prepare a clean public source repository with GPL-3.0 licensing, no private media or secrets.
3. Adapt the existing allowlisted Doom runtime for the /pdoom/ prefix and existing shared shell.
4. Generate a cartridge from the existing red-bunker hero/banner art and a trailer hover loop.
5. Validate preview, publish the dedicated game Worker, add the catalog/source link, and deploy the catalog.
6. Verify canonical title, native levels, SAFE MODE, assets/media ranges, shell, scores and responsive UI.

The existing friends playtest stays available for rollback. The game remains free to play.

## Completed 2026-10-15

- Canonical game https://mann.cool/pdoom/ is served by `mann-cool-pdoom`, version `aed0cd42-b867-477b-8d09-0bb770b7be5a`.
- Catalog production branch `redesign/platform-v1`, commit `b72b328`; central Worker version `7608c748-f209-467d-8b73-cce0a5fc37ba`.
- Public GPL-3.0-only code: https://github.com/songadaymann/pdoom. Runtime media is separate; see ASSETS.md. Secret scanning and push protection are enabled.
- Cartridge: exact 800x1200 RGBA NES cartridge inspired by existing red bunker banner and title heroes. Matching trailer supplies 5 seconds of hover action; touch/reduced-motion/data-saver visitors keep static art.
- Canonical verifier passed root, engine, mod, art, meadow, and media byte ranges. Both native levels passed title/menu/films/movement/audio/Escape pause/revisit checks. New Game passed prologue and guide intro. Real saved-game loading and both SAFE MODE exits passed; real save remains unchanged.
- Shared shell passed desktop, phone and tablet checks, 15 board reads/toggles, player panel, configured Tip, Patreon, home, single automatic play event, theme opacity and HUD clearance. Guestbook opens the catalog's existing guestbook, read-only during verification. Desktop fullscreen passed.
- Four live catalog asset hashes match the local build. Cover/GIF behavior passed hover, touch, reduced motion and data saver checks.
- A clean archived source tree installed dependencies and built the fallback; runtime setup downloaded and checksum-verified 1745 files from the canonical host, and the meadow rebuilt successfully.
- Game build and 33 unit/simulation checks passed. No guestbook posts, score submissions, or email-linking requests were made.
- Requires current desktop Chrome/Edge with WebAssembly JSPI. Phone/tablet checks are emulated UI checks; physical mobile native-engine compatibility is not claimed in the catalog.
- The previous friends preview remains available for rollback.

## Level 3 released 2026-10-21

- Game `mann-cool-pdoom` version `6c920d3c-874d-41e2-9150-ebd684205d06` from `main` (`01e5c26`): MEG3N's Toy Factory (E2M7) in the campaign (episode menu SPAWNING CHATS and SAFE MODE's MEG3N.AVI door), with its voice takes, intro film, live-feed screens, the Doom status bar and levels 1-2's exit text screens. The live pk3 is byte-identical to the local build.
- Central Worker `mann-cool` version `c87c34d3-41f4-4a3e-8d50-83f51cbbcf75` from `redesign/platform-v1` (`225f564`, on top of the already-deployed PR #4): the Level 3 board `meg3n-factory-rescue-v1` is registered and validated (20 screens, board v1, 3-minute review floor). Live reads: all three boards 200; an unknown variant 400; a ticketless POST 401.
- Live checks: canonical host smoke (both earlier levels, Load Game into SAFE MODE, phone menu); canonical shell smoke on desktop, phone and tablet (3 total-score level tabs, Tip, Support, guestbook, single play); a fresh SPAWNING CHATS run on mann.cool boots E2M7 as a rankable run with SCRN 0/20. No score submissions, guestbook posts or email requests were made.

The public `?safemode=1` shortcut is retired. SAFE MODE remains accessible through
normal progression and Load Game. The fixture is available only on loopback with
`dev-config.enabled: true`.

Local verification reports are ignored under `output/playtest/canonical/` and `output/playtest/canonical-shell/`.

## One row per player and challenge sign-in released 2026-11-09

- Central Worker `mann-cool` version `6d1674dd-ef94-4484-bfd3-b8636b904b46` from `redesign/platform-v1` (`72ae826`, the merge of PR #10, whose tree equals `claude/pdoom-one-per-player` `7631da3`). The rollback point is `516b3eab-69da-4967-99ed-f997baac88d6`.
  - The board is `player-best`: one row per player, their best.
  - The player comes from the browser's secret, never a claimed ID. A signed-in (email) player's row is `signedIn`, checked when the board is read.
  - The top-ten hold counts players.
  - The moderation list shows player_id, signed_in and same_ip_players.
  - The shell (`?v=20261109-player-best1`) marks ✓ with a key and has `mannCool.player.credential()`.
- Game `mann-cool-pdoom` version `69341c96-b3c4-432f-b603-b5a6c6ad6ccc` from `main` (`63e5bca`): the card sends the credential and offers signing in for the challenge.
- Before deploy (local): mann-cool tests 26/26 and `catalog:validate`; game unit tests 49/49; the speedrun end-to-end against `wrangler dev --local --var PLAYER_EMAIL_DEV:1`, with a real email-code sign-in and the run stored under the signed-in player.
- Live checks:
  - The board reads `player-best`; an old shell URL redirects to the new version, which has `credential()`.
  - The live game files match the build.
  - The canonical host and shell smokes passed.
  - A throwaway browser with a seeded finished run opened the live card, showing the sign-in line, the video field and a credential from the real shell. Nothing was posted.
  - One approved run was already on the live board.

## Top-ten review and run videos released 2026-11-09

- Central Worker `mann-cool` version `516b3eab-69da-4967-99ed-f997baac88d6` from `redesign/platform-v1` (`b99d5ee`, the merge of PR #9, whose tree equals `claude/pdoom-video-links` `5f8f97e`). The rollback point is `f67893c9-7c56-4090-9ffc-fd4f09481fab`.
  - Every time that would make the top ten of the approved board is held for review (`PDOOM_REVIEW_TOP`, default 10).
  - A run can carry a `videoUrl` (https, known video sites). `POST /api/v1/pdoom/runs/video` adds, changes or clears it later with the run's ticket.
  - The shared shell (now `?v=20261109-run-videos1`) shows a ▶ link and times over an hour as h:mm:ss.cc. The moderation list shows `video`.
- Game `mann-cool-pdoom` version `6993a1e6-b467-456f-b0b9-466c1a3ba523` from `main` (`487ebd1`): the results card's video field and the add-later form.
- Before deploy (local): mann-cool `node --test tests/*.test.mjs` 24/24 and `catalog:validate`; the game's unit tests 48/48; the speedrun end-to-end against `wrangler dev --local` (a link sent with the time and held as top ten, a bad link refused, the link changed); the board rendered with a video row and an hour-long row.
- Live checks:
  - The board reads 200; the video route answers a ticketless request with 401; an old shell URL redirects to the new version.
  - The live `score-view.js`, `ranked-runs.js`, `leaderboard-client.js` and `score.css` match the build.
  - The canonical host and shell smokes passed.
  - A throwaway browser with a seeded finished run opened the live results card with the video field and the new shell. Nothing was submitted.

## Persistent levels released 2026-11-09

- Game `mann-cool-pdoom` version `3a8c5915-f998-493e-82db-cb9fc529a7e7` from `main` (`9b30785`). No central Worker change.
  - Going back into a level keeps what you broke: the campaign save's `broken0`-`broken3` (`doom-web/campaign.js` BROKEN), written at the exit and put back quietly on a walk-in (`CampaignSession.zs RestoreBroken`, `Factory.zs` and `Agentic.zs ApplyHubEntry`).
  - The live `pdoom.pk3` (four entries patched locally: CVARINFO, CampaignSession.zs, Factory.zs, Agentic.zs) and `campaign.js` match the build.
- Before deploy (local): unit tests 47/47; persistent-levels-smoke (all four levels); checkpoint 9/9, level-exit, campaign-roundtrip, hal-exit, escape 7/7, factory hub/exit, agentic-menu.
- Live checks:
  - The canonical host and shell smokes passed.
  - A throwaway browser with a seeded save walked into CONTROL.EXE (cameras 0, 4 and 8 broken, the turret off, no break events) and HAL3000.SYS (cameras 1 and 7, four modules out, HAL pacified) on mann.cool.
  - Nothing was submitted.

## The meadow walks' skip button released 2026-11-09

- Game `mann-cool-pdoom` version `b49d8c4d-5a21-4b83-aa8d-5d657f138eef` from `main` (`5b783c7`). No central Worker change.
  - The XP intro's `SPACE — SKIP WALK` and the after-level-4 meeting's `SPACE — SKIP` now show at the bottom right the whole time the walk can be skipped. On a phone the label is `TAP — SKIP` and sits above the touch controls. The button used to be placed off the top of the window. SPACE skipped both all along.
- Before deploy (local): meadow-skip-smoke (intro, door, phone in landscape and portrait), endgame-hookup, onboarding (with two stale checks updated).
- Live checks: the live `outside/outside.js` and `prologue.css` match the build. `CASES=intro` meadow-skip-smoke passed against `https://mann.cool/pdoom/` (New Game, the film and prologue skipped, the button on screen, SPACE lands you in front of CONTROL.EXE). The canonical host and shell smokes passed. Nothing was submitted.

## Skipping the exposition released 2026-11-09

- Game `mann-cool-pdoom` version `ef8a878f-27ce-41a9-ac70-4575a4eb56df` from `main` (`e8a45eb`). No central Worker change (it stays `f67893c9`).
  - No exit text screen after any level: every exit melts straight into SAFE MODE (`doom-web/exit-text.js` is gone; it now 404s).
  - SPACE, ENTER or E closes a freed prisoner's card.
  - In the endgame SPACE skips his opening and the end after the MCP falls, and cuts the line playing on the walk in.
  - The endgame's test shortcuts (1, 2, 3, N, `?part=`, `?autosteer`, a tuned trick shot) now make a real speedrun practice. On the live site before this, they could jump a real run to the last throw.
  - The endgame page was rebuilt (`node scripts/build-endgame-protos.mjs`) before the deploy.
- Before deploy (local): `node --test tests/*.test.mjs` 46/46; endgame-skip (new), level-exit (renamed from level-exit-text), the speedrun end-to-end against `wrangler dev --local`, factory exit/hub/menu, agentic-menu, endgame-hookup, checkpoint 9/9 (new `discovery-card-skips`) and escape 7/7.
- Live checks:
  - The live `main.js`, `story-beats.js`, `level-polish.css` and `endgame-proto/proto.js` match the staged build. For about 10 s after the deploy the edge still served the old files.
  - The canonical host smoke passed, and the canonical shell smoke passed on desktop, phone and tablet.
  - `endgame-skip-smoke` passed against `https://mann.cool/pdoom/` (`PDOOM_ORIGIN`): the walk line, the opening, the end, and a test key marking a real run practice (in a throwaway browser).
  - No score submissions, guestbook posts or email requests were made.

## The speedrun and no lost prisoners released 2026-11-07

- Central Worker `mann-cool` version `f67893c9-7c56-4090-9ffc-fd4f09481fab` from `redesign/platform-v1` (`7617e0b`, the merge of PR #8, whose tree equals `claude/pdoom-speedrun-board` `ff6e4a3`). It retires the four per-level rescue boards and registers the one board `campaign-speedrun-v1` (asc, `time-ms`, `server-rules-v2`, 20-minute review floor). The rollback point is `9eb1fb5f-c636-4d25-8907-d91686d7edc3` (2026-11-06).
- Game `mann-cool-pdoom` version `64466121-9456-49c4-9399-363f54a37b0a` from `main` (`5afa024`):
  - A freed person going down in levels 1–2, or the player going down with nobody to take over, restarts the level. Nobody can be lost.
  - One whole-game speedrun clock in the save, a timer on screen in levels, SAFE MODE and the endgame, and one results card at the end with the splits. The levels have no score cards.
  - The endgame page was rebuilt (`node scripts/build-endgame-protos.mjs`) before the deploy; the live `proto.js` matches the local build.
- Before deploy (local): `node --test tests/*.test.mjs` 46/46 and `npm test` 20/20; mann-cool `npm run test:pdoom` 12/12 and `catalog:validate`; the speedrun end-to-end (`ranked-score-browser-smoke`) against `wrangler dev --local`; agentic-menu, factory-menu, the escape and refuge restart cases, endgame-hookup, checkpoint-browser 8/8 and simple-leaderboard at three sizes.
- Live checks:
  - `campaign-speedrun-v1` reads 200 (asc, empty); a retired board such as `five-prisons-rescue-v2` and an unknown variant give 400; a ticketless POST gives 401.
  - The canonical host smoke passed, now reading the speedrun board.
  - The canonical shell smoke passed with the one speedrun board on desktop, phone and tablet.
  - A fresh HUMAN CONTAINMENT AREA run from the live episode menu starts the speedrun (not practice, timer on screen) and gets its `campaign` / `speedrun-v1` ticket (201).
  - No score submissions, guestbook posts or email requests were made; one run ticket was issued.

## Level 4 ranked, Cybertrucks and the sky glitch released 2026-11-06

- Central Worker `mann-cool` version `9eb1fb5f-c636-4d25-8907-d91686d7edc3` from `claude/pdoom-level-4-board` (`567c2db`), which is `redesign/platform-v1` (`2750688`) plus one commit (PR #7). It registers the Level 4 board `agentic-pods-rescue-v1` (map `agentic-pods-v1`, board v1, 9 cameras, 3-minute review floor). The rollback point is `8a461121-c211-4065-ba9f-3f7e642d2911` (2026-10-22). Never deploy the central Worker from mann-cool's stale `main`.
- Game `mann-cool-pdoom` version `571d00aa-3bcf-4cbb-950f-35ec93239e05` from `main` (`71b37ec`):
  - The episode menu's fourth entry is HUMAN CONTAINMENT AREA (THY FLESH COMPUTED). A fresh run from it ranks on Level 4; AGENTIC.BAT walk-ins are practice.
  - Four level tabs share one row at every width.
  - The walk in gets two Cybertrucks (P4) and the sky glitch under `end-sky`.
  - The live pk3 is byte-identical to the local build. Only `actors/Agentic.zs` changed; the entry was replaced in place.
- Before deploy (local):
  - `node --test tests/*.mjs` 51/51 and `npm test` 20/20.
  - mann-cool `npm run test:pdoom` 14/14 and `catalog:validate`.
  - These smokes passed: endgame-hookup (trucks, glitch), boss-check ALL OK, agentic-core (cold, exit, hub), the new agentic-menu, factory-menu (menu, handoff) and simple-leaderboard (4 tabs, desktop/phone/tablet).
  - ranked-score-browser passed against the new central Worker under `wrangler dev --local` (port 5202), including Level 4's submit and menu ticket.
- Live checks:
  - All four boards read 200 (Level 1–4 labels, all empty); an unknown variant gives 400.
  - The canonical host smoke passed (`node scripts/canonical-host-smoke.mjs https://mann.cool/pdoom/`).
  - The canonical shell smoke passed with 4 level tabs on desktop, phone and tablet.
  - A fresh HUMAN CONTAINMENT AREA run from the live episode menu boots E2M2 cold as a rankable run and gets its ticket.
  - The live walk plays the sky glitch and both trucks, with no failed requests.
  - No score submissions, guestbook posts or email requests were made; one run ticket was issued.
- All four live boards read empty. Production D1 wasn't read: the agent's read was blocked. Check held rows with `npm run leaderboard:moderate -- list --slug pdoom --status all` in mann-cool.

## Level 4 and the endgame released 2026-11-03

- Game `mann-cool-pdoom` version `b14ef678-9892-4a81-9fca-7dbd6facaceb` from `main` (`02baae3`, the `claude/endgame-hookup` work merged with main and the one-row leaderboard tabs fix). AGENTIC.BAT's door opens for everyone: level 4, AGENTIC SMITH's Pod Farm (E2M2), unscored, with its voice takes, music, HUD images and the five captives' meadow figures. SAFE MODE changes after each level. When all twenty are resolved, the meadow's gate leads to the endgame page (`endgame-proto/play.html?m=finale`: the walk, the MCP fight, the wasteland) and back to the meadow. The live pk3 is byte-identical to the local build.
- No central Worker change: level 4 has no board yet, so the shell keeps three level tabs. The episode menu's fourth entry still reads COMING SOON; level 4 is reached through SAFE MODE.
- Before deploy (local): hub-future (now checking the open door), endgame-hookup, safe-mode-stages, factory-hub, campaign, onboarding, agentic core and playthrough, and the Tallinn, Bostrom, Kokotajlo and Bengio rescues passed. Grace passed 11 of 12; its `guide` case (the `katja-hint` take is heard after the guide is introduced) passed 1 of 3 reruns. Her line triggers every time; the voice take sometimes isn't heard in the test's window.
- Live checks: canonical host smoke, canonical shell smoke (desktop, phone, tablet), the hub smoke against mann.cool (AGENTIC.BAT enters, its phone rings), a Load Game into SAFE MODE with three levels cleared that walks into AGENTIC.BAT and boots E2M2, and the endgame page under `/pdoom/` with no failed requests. No score submissions, guestbook posts or email requests were made.
