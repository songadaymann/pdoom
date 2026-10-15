# Review of Claude's campaign spec

Reviewed 2026-10-06 against `GAME-SPEC.md` revision 2, its supporting documents,
and the current native run, level registry, score and meadow implementations.
This is a design and implementation-contract review; the real-person sourcing
and every proposed WAD coordinate have not been independently re-audited here.

The core direction works: four guardians change what counts as safety, rescues
use those rules rather than interchangeable locks, and the Bliss hub preserves
the contrast that already works in the prototype. The guardian-as-tool rescues,
the Helper becoming the AI-self, and the coordinated floppy volley make strong
through-lines. The master document also resolves the major disagreements between
the supporting documents.

These are the remaining changes I recommend before campaign implementation.

## 1. Decide what makes a competitive run comparable

**Priority: high.** Sections 5.1 and 5.5 say levels remain comparable in every
order, but skills 3–5 share leaderboard eligibility while changing damage,
speed, wind-up, health supplies and camera reboot behavior. A comms buddy also
adds mechanical advantages: extra charges, longer sentry wind-up, health, hints
and vision overlays. Which buddies are available depends on campaign order.

Recommendation: one standard competitive ruleset per level (skill 3 with fixed
perks), or distinct board keys for difficulty/ruleset. Campaign attempts can keep
their earned perks but should not silently mix with that standard. Store skill,
buddy and perk rules in frozen run metadata. CEO identity can share a board
because its mechanics are specified as identical. Preserve v1 boards; changes
to cast, CEO survival and scoring belong on new v2 keys as already proposed.

On Paperclips, a camera reboot must not erase a unique destruction award or let
the same camera award points repeatedly. Track unique camera IDs separately
from the live machine state; the current `BrokenCount()` counts current broken
housings and would need changing for rebooting cameras.

## 2. Define retreat, retry and prisoner resolution as explicit transitions

**Priority: high.** Section 5.1 promises retreat and persistent prisoners;
section 5.2 fails an attempt when the CEO is down with no freed survivor;
section 8.1 requires all twenty cells to be resolved. It does not specify what
happens to still-imprisoned people after that failure, or exactly when someone
left in the refuge becomes permanently safe during an early retreat.

Recommendation: campaign state belongs to individual people. Save someone only
after they cross the exit; a person parked in the refuge remains in the facility.
A failed attempt must offer a retry without converting untouched captives into
lost people. Earlier camp rescues remain saved. A replay explicitly restores
only confirmed losses. Define `resolved = atCamp + confirmedLost`, excluding the
CEO, and derive every gate/progression counter from it. Test zero rescued,
partial retreat, CEO down, sole survivor, retry and return after a page reload.

## 3. Extend the native/browser score contract for the new exits

**Priority: high.** The existing score owner finishes once at the completed duct
escape and requires `p_doom_cover`. The spec adds front-door escapes, repeated
visits and a recoverable CEO scored differently from the five figures. Merely
adding descriptors to `levels.js` cannot implement these rules.

Recommendation: define a shared exit snapshot (`exitKind`, facility outlook,
saved figure IDs, CEO conscious/down, skill and ruleset), with distinct campaign
progress and scored-attempt completion. Door exits snapshot before companions
leave safety, just as the current cover does. A first retreat ends competitive
eligibility for that attempt; later visits can improve campaign rescues without
resetting a leaderboard timer for free. Perfect rescue must specify all five
figures **and a conscious CEO**, rather than trusting an aggregate `saved === 6`.
Keep the current total and three-board lifecycle unchanged until v2 is built.

## 4. Minesweeper currently triggers on normal walking

**Priority: medium.** Section 7.1 says a 0.4-second standing trigger prevents
accidental activation. At the current walk/run speeds, crossing a 3 m tile takes
about 0.83/0.50 seconds, so ordinary walking can reveal it.

Recommendation: require E or a deliberately stationary dwell, with a low
movement-speed threshold and reset on leaving the tile. Merely standing inside
the tile bounds is insufficient. This matters especially for touch controls.

## 5. Enforce the rescue interaction budget consistently

**Priority: medium.** The master caps hold-E rescue steps at two per level
(sections 3 and 4.1), but Bengio's signature specifies three held cable pulls in
Episode 4. Soares's finite flash-camera route is also marked "no-cost" despite
spending one of three flashes; his shutdown route is the actual no-consumable
option, so the universal fallback rule still holds.

Recommendation: make Bengio's cable pulls short tap interactions with physical
feedback, or explicitly revise that budget. Label consumable routes accurately.
Keep each level's solo, no-consumable route usable after all ammo/tools are spent.

## 6. Treat the first hub reveal as a protected playable moment

**Priority: medium.** The reveal piles on emerging companions, their lines, the
cursor, a counter, Safe Mode labels and HAL's eye. Its dramatic strength is the
initial clean contrast. I recommend letting the landscape and music breathe
before adding those cues; avoid immediately covering it with multiple overlays.
MEG3N's watched/dance rules also need explicit sight, range and occlusion tests
so a distant screen cannot unexpectedly slow the player across the whole map.

Jonathan supplied `bliss.mp3` for the Bliss sections on 2026-10-06. It is now the
current outdoor music: the original stereo MP3, looping with a 1.5-second fade-in,
pause/resume at its held position, and no overlap with facility music. This
supersedes the spec's proposed silent arrival; it is one full mix, not the four
future stems. Stems, radio ducking and progression mixes remain future work.

## Build recommendation

Treat the 130–150-day estimate in the document as its full campaign plan, not the
next implementation task. First polish the current guardian's telegraph and
camera feedback, then make one complete E1M4 → Bliss → E1M4 return loop with
persistent individual prisoners. That proves the campaign foundation before
adding the next guardian or the maze. Preserve the current local playable build
while those slices develop.

The proposed geometry edits still need actual native player/companion traversal
tests: drawing a route on a stock-map plan does not prove crouch clearance,
dynamic machinery safety or a follower's ability to get back out.
