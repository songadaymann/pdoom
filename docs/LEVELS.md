# Adding another campaign level

Two complete scored maps are available: The Control Problem (`five-prisons`,
E1M4) and Confabulation Station (`hal-station`, E1M7). Intake is an unscored
prototype. Unknown IDs do not silently launch another map. Direct testing links
use `?level=<id>&ceo=altman|amodei`; the playable campaign uses physical Safe Mode
doors to enter and return.

## Level contract

`doom-web/levels.js` declares stable ID, version, title, native episode/map,
scoring/board version, person/camera totals and optional `nextLevelId`. A descriptor
must have a playable native map/controller before it becomes selectable.

Each scored controller emits:

- `PDOOM_RUN_START`: level ID/version and practice state.
- `PDOOM_RUN`: level ID/version, active native tics, cover outlook and practice.
- `PDOOM_RESULT`: matching level/score versions, outcome, saved/figure totals,
  CEO state, skill, entry, retreat, active tics, cover outlook, camera totals,
  practice and routes.
- `PDOOM_CAMPAIGN`: committed saved/lost/following masks for the hub roster.

`PDRescueRun` owns completion and time. The browser rejects mismatched result
versions/totals and emits frozen `pdoom:level-complete` for campaign collaborators.
Geometry reloads on return; committed person masks are canonical. Saved people
remain in Safe Mode and never respawn as duplicate prisoners. Lost people stay
lost on normal return; **Replay** temporarily restores unresolved lost people for
another attempt. Restart preserves the entry/replay rules and committed camp.
Returning or replaying is practice, protecting the fresh-entry time boards.

## Native map and gameplay

Add a map builder, native geometry/nav provider and map-specific encounter owner.
`CheckpointMap.zs` routes shared code to `PDControlMap` or `PDHalMap`; do not copy
another level's sector IDs. Extend this facade, the session's map identity and
save masks, `PlatformPanel.zs`/KEYCONF map controls, and shared rescue/refuge/exit
logic as needed. Register assets in the reproducible `build:doom` pipeline.

Since 2026-10-10/11 each prisoner has exactly one rescue (Jonathan: alternatives felt
samey), and each refuge needs its own way out: E1M4 loosens four bolts and crawls a
duct; E1M7 smashes the BREAK GLASS case on HAL's main breaker in the Faraday Room
(two wrench hits; a steel shutter, tag 883, hides it until HAL locks you in) and pulls it (`HalReboot.zs`), and while HAL reboots (60 s: dark
station, doors fail open, red lights on the route, green floor chevrons pulsing toward
the exit along the walking path that `build_hal_map.py` emits as `PDHalMap.ExitLight`)
everyone walks through Roman's pod bay to the original E1M7 exit door (tag 890). Once you and
everyone still alive are in the exit room, its original red exit switch (SW1COMP, line
`PDHalMap.ExitButton()`) ends the level; pressed earlier it only says "Not everyone's here yet." (2026-10-14).

Every level needs one clear rescue per prisoner, a reachable refuge, physical exit,
health/tools, guardian movement, companion navigation, native retry and hub entry.
Validate the complete escort path, not just console puzzle state. Split WAD
boundaries with valid sector sides and compact unused sidedefs before emission.

## Browser and hub

Extend the campaign roster/save schema and `bootArgs()` in `campaign.js`; add the
physical destination and camp anchor in `src/doom-hub-doors.ts` / `src/doom-outside.ts`.
`main.js` coordinates warm native map loads while reusing the existing meadow
scene and song. Native queued speech/discovery events drive Doom-style cards.
Extend launch/story collaborators and any level-specific puzzle HUD. Test touch
controls as well as keyboard, native pause ownership and all exit transitions.
A level's `outside-reveal` event plays Doom's screen melt into Bliss (`doom-web/screen-melt.js`,
2026-10-14): the last Doom frame holds over the window while the meadow gets ready, then melts
away. New levels get it by emitting that same event; the prologue's upload and Load Game do not melt.

Use new versioned boards and regenerate the publishing config with
`node scripts/sync-level-boards.mjs`. Both levels now use isolated v3 rescue,
perfect and clean-sweep boards (v2 and older are archived in `ARCHIVED_LEVELS`). Side bonuses must remain below one figure's
10,000 points or require a new score version. Future combined campaign boards
need a separately defined metric; no placeholder aggregate board exists.

Acceptance evidence is in `output/campaign-v2`. `campaign-roundtrip-smoke.mjs`
checks E1M4 → hub → E1M7 → hub → E1M4, CEO recovery and committed camp. HAL tests
exercise all five rescues (`hal-browser-smoke`), that removed routes stay shut
(`hal-single-route-smoke`), and the breaker/reboot run to the exit (`hal-exit-smoke`).
