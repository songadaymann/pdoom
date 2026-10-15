# Two-level campaign implementation

Authorized by Jonathan on 2026-10-06. Keep the current Safe Mode scenery and
original Bliss song. Safe Mode minigames, the other two prisons and finale are
out of this implementation. Local playable delivery only.

1. **Current level — implemented and verified.** Spec's named cast, CEO premise/dialogue,
   separate status and queued speech, camera/laser telegraphs, search/patrol,
   rescue stingers and signature alternatives. Preserve existing viable routes.
2. **Leaderboards — implemented and verified locally.** New v2 boards/formula, one standard scored
   ruleset, metadata for CEO/skill/entry, unique camera awards, explicit perfect
   and clean-sweep eligibility. Preserve historical v1 keys.
3. **Retreat/death — implemented and verified.** Recoverable CEO, permanent figure loss within
   attempts, saved/remaining/lost campaign states, retry/replay semantics, hub
   return doors and persistence without duplicate humans or fresh-timer exploits.
4. **HAL level — implemented and verified.** Complete original E1M7 overlay, flying guardian,
   five signature rescues and alternative routes, health/tools/refuge/exit,
   linked Safe Mode entry and return. No placeholder selectable level.

Acceptance: actual native browser play for new mechanics and both exits,
scoring/persistence lifecycle checks, desktop/touch UI screenshots and error
inspection, then E1M4 → hub → E1M7 → hub → E1M4 with saved roster intact.
Every phase updates this file and progress.md with its verified state.

Starting state: refreshed Bliss visuals and CEO picker exist. Playable hub
doors/campaign coordinator and E1M7 controller do not yet exist in the runtime.
Claude's master and supporting specifications are the design reference. A source
snapshot is retained at output/campaign-v2/source-before for recovery.

## 2026-10-06 implementation checkpoint

- V2 score/eligibility and campaign save unit checks: 11 passing.
- Native E1M4 → Safe Mode → native E1M7 → Safe Mode → E1M4: passing.
  Committed five-person camp survives both loads, return cells are empty.
- CEO down → companion takeover → 1.5-second reinstate → 40 health: passing.
  Native restart restores attempt baseline without downloading the engine again.
- HAL's five signature rescues and all five physical escorts to refuge: passing.
- HAL's final jailbreak, four aimed bolts, standing/crouch collision, physical
  companion crawl and five arrivals at HAL camp: passing.
- Current-level quiet camera, textbook and locked laser/wall interactions: passing.
- Failure / native Retry / normal loss / lost Replay / replay retry / retreat: passing.
- Nine live local board variants, including three archived v1 boards: passing.
- Native panel clock/pause and fresh restart eligibility; desktop and touch
  score submissions, partial retries, all board formats: passing.
- Touch puzzle controls fit portrait and landscape with 44px targets; screenshots
  inspected and overlap corrected.
- All HAL alternatives pass: STOP shot, MAIM strikes, flash/two valves,
  timed bay cycle, three frost-seal strikes with real crouch/drop, charge with
  real companion exit and player climb over the rubble into the pod bay.

The preserved meadow is used as the two-level hub. No Safe Mode minigames or
finale are implemented. The ten named prisoners now have individual likeness art, walking/crouching
angles, matching takeover faces and the same identities in camp. Generated
robots and rescue props replace the temporary machine art. Voices remain text.
The map port reloads geometry on a hub return; committed person states are the
canonical save, preventing camp duplication. Returning/replaying is practice.


## Final delivery

All four playable phases above are complete locally. Full asset/native/outdoor
build, TypeScript checks and 11 scoring/session unit checks pass. Native browser
reports and served-file comparisons are indexed in
`output/campaign-v2/acceptance-summary.json`. Server is running on port 5198.
The two level descriptors, map facade, shared controller events, campaign masks
and hub door metadata provide the documented extension points for future levels.

Presentation backlog remains separate: future-level character/prop art, fuller
First Contact/reveal cinematics, the first-rescue probability-choice panel,
and a larger music/voice pass. The guardian currently floats above traversable
floors rather than navigating unrestricted 3D airspace. Retained voice is text
with original sound cues, not recordings. The supplied Bliss song and Claude's
meadow scenery are preserved. Public leaderboard publication is not part of
this local delivery; tests use loopback stores only.
