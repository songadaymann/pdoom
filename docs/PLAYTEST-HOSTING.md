# Standalone friends playtest

Playtest URL: **https://pdoom-playtest.novox-robot.workers.dev/**

Current deployment: 2026-10-15, Worker version
`f14373fa-3f08-44fc-92e1-079ab1724d93`. All nine desktop toys have individual masses: the computer
is heavy; cards, floppy and text file travel much farther from the same kick. Resolving both
facilities unlocks 6 m/s walking and 10 m/s running in the meadow; the opening and first return
keep their original 3.6/6 m/s pace. The physical toy bodies and local spatial phone audio remain
included. This release changed only `outside/outside.js`; live bytes match the staged bundle.
Live travel unlock/input checks, weighted-toy desktop/touch checks (60 FPS), spatial phone checks,
both SAFE MODE flags and the eight-case host check PASS without browser or missing-resource errors.

Previous deployment: 2026-10-15, Worker version
`cbeb4d66-a8fa-4852-988f-bb5e4f52e5b8`. Nine desktop icons are now chunky pixel-silhouette toys
with real Rapier physics (tumbling, slopes, collisions and stacking). The AGENTIC phone bell is
local to 36 m and uses live HRTF direction as the player moves or turns. Only the meadow bundle
and third-party notices changed in this upload. Live bundle and notice bytes match the stage.
Live icon/touch checks (60 FPS), spatial phone audio checks, both SAFE MODE flags and the
eight-case host check PASS with no browser or missing-resource errors.

Jump directly into SAFE MODE: **https://pdoom-playtest.novox-robot.workers.dev/?safemode=1**.
Add `&level=five-prisons` to arrive by the bunker instead of HAL's door. The flag uses an in-memory
completed-level save and leaves the real browser save alone.

Previous deployment: 2026-10-14, Worker version
`04d3c963-4be0-4af8-9292-f20582a5d626`. SAFE MODE now promises what's next: locked MEG3N.AVI and
AGENTIC.BAT (levels 3 and 4) with install dialogs (READ THIS! from there), the summit's Display
Properties final door, the MCP's blocky face on the south horizon, and nine kickable desktop icons.
`?safemode=1` goes straight there as if both levels were just cleared (in-memory save; a real save is
left alone), out of HAL's door; `&level=five-prisons` for the bunker. Pre-deploy smokes, live hashes,
host smoke, live voice, live safemode and live hub checks PASS.

Earlier today: `38e702e4-ebf8-47ed-a063-53e0e7ae3752`. Level 2 ends at the exit room's red exit switch, which
works only once everyone still alive is in the room; leaving either level now melts the last
Doom frame away into Bliss (Doom's own screen wipe) instead of cutting. Pre-deploy smokes on the
full build, live hashes, host smoke and live voice check PASS.

Earlier today: `369159cf-78cd-42e6-b04c-630628f09fdf`. Level 2: HAL's main breaker is hidden behind a steel
shutter that opens only once HAL locks you in the Faraday Room; the wall-textured door into
Beth's evaluation vestibule is now an open doorway. READ THIS! drops its token placeholders
(token details show only to wallet holders, and only once a contract is set; none is yet).
Pre-deploy smokes on the full build PASS.

Earlier today: `1148c2d4-bf1e-47dc-bd17-d671a09fa48f`. Level 1's Faraday Room door really closes when the
room locks; no subtitle left frozen in the meadow after the crawl; level 2 hints wait until
you have seen what they are about; whoever you free first in level 2 (Beth included) can
lead you to the Faraday Room. Pre-deploy smokes on the full build, live hashes, host smoke
and live voice check PASS.

Earlier: `1f3c505f-05a5-4c51-8349-602dfc2040f6`. Status bar no longer shows 0% health after the
prologue melee; Eliezer's inside latch is a labelled CELL DOOR release (blinking lamp,
arrow to the front door, "Cell door open"; he pulls it himself after 12 s); HAL's main
breaker sits in a BREAK GLASS case (two wrench hits); green floor chevrons pulse along
the reboot run to the exit; HAL hall README.TXT is HAL's warning until level 2 is beaten.
Pre-deploy smokes on the full build, live hashes, host smoke and live voice check PASS.

Earlier today: `95cb4704-e158-41bf-969a-b477d05b774c`. Followers no longer drop the frame rate (nav
rebuilds bounded); level 2 plays Doom's E1M7 track; objective line no longer under the
subtitles; readable in-world labels (hires/ lettering); Bliss: blue torch trail, HAL
station rebuilt to spec with the floating eye, doorways show their own level; 91 voice
takes incl. safe-room, HAL ending, INFERMINATOR spot/idle, ED-404, founders' in-level
and Bliss shout lines. Host smoke and the live voice check PASS.

Earlier today: `0f199d8c-5cfe-4166-8975-9930d5bb9bd0`. Films fit wide windows (letterboxed instead of
running off the bottom). Host smoke PASS.

Earlier today: `75f0e225-17d1-4ba7-9db0-3dab60544a09`. HAL reacts to every release and pleads on each
memory-module pull; each prisoner has their own freed line; six HAL chatter lines;
stale lines (HAL's sign line after Beth, the fifth's "the others") removed. 67 takes.
Host smoke and the live voice/duck check PASS.

Earlier: `6b89a39e-21b4-4995-a29a-9619c162d3c2`. World sounds duck to 30% under spoken lines
and now go through the SFX volume; the "hide" line is wired (silent until recorded).
Host smoke and the live voice/duck check PASS.

Earlier today: `7aa16306-a7b0-48f8-a0dd-d2122d598626`. New Game plays the chosen founder's intro film
before the prologue; every captive calls out their hint the first time you come
within earshot (no 45 s wait); INFERMINATOR voice (contact, brownout). Host smoke
(now including the founder film) and a live voice check (Liron call, Stuart and Dan
hints on approach) PASS.

Earlier today: `b4bd955e-283d-4ca3-ba57-d556e212657d`. Recorded voice-over (55 takes; subtitles
read what each take says), lines Jonathan skipped cut, the Computer Station down to
one route per prisoner, and its new ending: HAL locks the Faraday Room, you pull its
main breaker and lead everyone to the original E1M7 exit while it reboots. Level 2
boards are now v3 (v2 archived). Host smoke and a live voice-line check PASS. Right
after the upload Cloudflare's edge briefly served the previous voice manifest and JS
(cf-cache-status HIT); it matched the stage within about a minute.

Previous: 2026-10-11, `53e19987-27b0-4e70-9583-873d931b7069`. Fixes the Bliss intro on this host: the
guide's idle frames (added 2026-10-11) were not on the allowlist, so the intro
failed ("The meadow could not load"). The allowlist now ships all of
outside-assets/, and the host smoke walks New Game -> prologue -> Skip -> Bliss
with zero failed requests. Earlier today: `3ca9b1dc-5d90-401f-93ba-b6d489224e3f`
(meadow images retry once; failures name the file). Before that `0b0ff63b-7f5f-449e-8f12-a9e2aefe67de`. Adds the restored UPLOADING CONSCIOUSNESS
bar (UPLOAD COMPLETE / BOOTING SAFE MODE on the white), flying windows and
toasters in the Bliss sky, an earlier and repeating founder shout with 3D voice
and gusting wind, bio cards at release, and the voice-over system (silent until
takes are imported with scripts/import-voice-lines.py). Host smoke PASS.

Previous: 2026-10-10, `848c6c35-5cf8-46b5-85d8-8bef3e047683`.

New Game now runs title -> menu -> hero -> the Last Stand prologue, which ends
in Bliss beside the first facility door (no level select; `?levels=1` restores
it for testing). This build also has Doom controls (Space use, click/Ctrl fire,
walk-in doors, auto-crouch), much less on-screen text, pixel-exact Doom
lettering, one solution per level-1 prisoner and level-1 boards v3. The
allowlist now includes the Bliss guide's recorded lines and the prologue
yard music. `scripts/playtest-host-smoke.mjs` passed against this version.

Live verification passed in installed desktop Chrome: both named levels,
both heroes, menu/level films, actual movement, music, pause, returning-visit
skip, autosave Load Game into SAFE MODE and actual HAL doorway re-entry.
Key remote assets match local hashes; video/audio ranges, HEAD, ETags and
invalid ranges passed. No browser errors, missing resources or off-host
writes were observed. Phone-sized menu navigation was checked; native
Safari/iOS play is not verified. Reports/screenshots are in
`output/playtest/verification/`. Live test scoreboards start empty.

This deployment is independent of mann.cool. It has no custom domain routes,
catalog entry or public platform tracking. The dedicated `pdoom-playtest`
Worker serves the allowlisted runtime from Cloudflare Static Assets. Its
`pdoom-playtest-scores` D1 database stores optional test scores, separately
from the production boards. Autosaves stay in the player's browser.

The playable engine currently needs Chrome or Edge with WebAssembly JSPI.
Developer ending fixtures are disabled on this host. The staging process
excludes source maps, authoring art, QA packs, promo exports and old films.
The current runtime package is about 81 MiB; engine data starts downloading
behind the menu/intro and SAFE MODE assets load when needed. Every selected
file fits the static asset limit, so no R2 bucket is needed for this build. Films and the Bliss MP3 use a
streaming Worker handler for byte ranges, seeking and conditional cache
requests; the remaining static assets go directly through the CDN.

## Update this preview

```sh
npm run build:doom
node scripts/prepare-playtest.mjs
npx --yes wrangler@4.149.0 deploy --config deploy/playtest/wrangler.jsonc --dry-run
npx --yes wrangler@4.149.0 deploy --config deploy/playtest/wrangler.jsonc
```

One-time scoreboard schema setup (safe to repeat):

```sh
npx --yes wrangler@4.149.0 d1 execute pdoom-playtest-scores --remote --config deploy/playtest/wrangler.jsonc --file deploy/playtest/schema.sql
```

Run `node scripts/playtest-host-smoke.mjs <URL>` after a deployment. It checks
the real remote assets, video byte ranges, title/intro/menu, both native maps,
movement/audio, SAFE MODE rendering and isolated leaderboard reads. It does
not submit test scores to a live board.

Hosting references: [Static Assets](https://developers.cloudflare.com/workers/static-assets/binding/),
[current platform limits](https://developers.cloudflare.com/workers/platform/limits/).
