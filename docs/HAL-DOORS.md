# HAL doors — current playable rules

Updated 2026-10-07 after Jonathan's door-readability feedback.

## Ordinary corridor doors

There are seven doors, with a narrow, fixed control on each approach side.
Controls are on nearby solid hall walls, not on tiny original door jambs.
They use the private IWAD’s original 32×32 metal red/green toggle artwork,
follow the room’s lighting, and share the state of their physical door.
They sit 0.5 units off the adjacent wall, with an exact fixed outward normal.
Door controls, exam/bay terminals, power levers, thaw valves and refuge controls
are wall sprites rather than camera-facing billboards. Portable items remain
ordinary pickups. Map thing angles are integers; Arg4 carries the small normal
fraction applied once at actor spawn for diagonal walls.

- Green lower lamp: the door opens as you walk up to it (Space on a panel also works).
- Amber warning lamp: HAL warns for two seconds before attempting a lock.
- Red upper lamp: the contextual prompt counts down six seconds. Walking
  up or Space cannot override this; a single wrench hit on either panel can.
- Cracked metal and a dark lamp: the door stays open for this attempt. Repeated strikes
  cannot award repeated explosions or toggle it shut.

HAL has a 30-second opening grace, locks only one visible nearby open door at
once, and starts interventions at least 35 seconds apart. It does not cycle
locks on doors that are already closed. The lock automatically reopens when
its six seconds expire. The timer is the game's active native clock and pauses
with gameplay.

HAL being evaluated, pacified by four modules, or switched off cancels
its interference and reopens its active lock. Switching the DOORS system off
holds ordinary doors open. Restart resets broken panels, timers and warnings.

The **UNDER EVALUATION — PLEASE BEHAVE** sign is now a larger freestanding
beadboard sandwich board, with a painted wood frame, feet, side supports and
readable front/back faces. It now stands in the approach hallway at (352,-1232),
where it can be collected before entering Beth's chamber. Aim at it and press Space
from up to 224 units away to pick it up. The actual board is visible in your hands
and follows your movement and turning. Space sets it down on the floor when no other
control is targeted; wall controls remain usable while carrying it. Weapons wait
until you put it down.

Picking it up does not start the evaluation. Carry it into a working camera's
view: walk through the open doorway into Beth's approach chamber (a wall-textured
one-way door until 2026-10-14) and carry it into the camera's view there. Entering
does not unlock her prisoner interlock or activate Rob's remote release. Recognition requires the camera's real scan cone, range and line
of sight to both you and the held board. Broken and turned-away cameras do not
count. After half a second of recognition HAL acknowledges the evaluation,
Beth's two doors open and HAL behaves for 30 seconds. The bottom stripe turns
green. Cameras stop issuing hostile reports during recognition and the active
evaluation. The timer pauses with the game; putting down/picking up cannot refresh
it, and the original 60-second cooldown still applies. The doubling-door rescue
remains available if those cameras have been destroyed.

The lock expiry and wrench override retire only that ordinary door's active
ceiling mover before starting a normal native opening animation. This prevents
an obstructed closing mover from ignoring Open forever when the robot stands
in the doorway. Existing native collision and ceiling geometry are retained.

## Prisoner interlocks

Prisoner door faces retain original Doom metal, with a red containment band,
a padlock and **CELL** plaque. Looking at a closed interlock near enough shows
**CELL INTERLOCK - controlled elsewhere**. They have their own rescue puzzles;
ordinary corridor controls never bypass them.

Rob's tea labels/STOP and marked balcony emergency release, Dan's exam/MAIM rack, Nate's
allocation/manual-thaw machinery, Roman's jailbreak/cycle/broken cycle panel/
window alternatives and Beth's evaluation/doubling routes remain intact. Dan
and Nate already have visibly distinct pods and pedestal machinery rather than
ordinary corridor door controls. The refuge and exit have their own existing
controls.

## Nate's thaw routes

- The five power toggles are together on the north wall of approach hallway124,
  immediately before Nate's lift, at x=-937 through -809, y=-2109 through -2092.
  Leave LIFE SUPPORT and HAL on, plus exactly
  one of LIGHTS, DOORS or ALARMS. The existing automatic thaw lasts 20 seconds.
- The alternative is a reusable, wall-mounted **THAW** override in Nate's own
  room (sector139), x=-1471.5, y=-2560. E unlocks both valves for 20 active seconds.
  Their plaques change LOCKED→READY→OPEN. Turn each once using E. The HUD
  shows remaining seconds and the 0/2 valve count in the shared text flow.
  The first valve is x=-1424, y=-2496.5; the second is x=-944, y=-2623.5.
- Expiry relocks both and clears partial progress. Press THAW again to retry.
  Repeated use during an active override cannot extend the timer. Completing
  either route releases Nate and lowers the pedestal. The switch changes
  only his valve interlocks: it does not stun HAL or alter corridor locks.
- The old flash pickup, B binding and clickable flash button are removed.
  Smashing the room's surveillance camera still only stops its surveillance.

`scripts/build-hal-thaw-map.py` draws the current generated E1M7 UDMF and exact
mounted hardware coordinates, with whole-station, power-panel and thaw-room
views. The source layout is retained in `scripts/hal-thaw-map.html`.

## Implementation and evidence

The curved staircase beside the central barrel room has a permanent low
landing instead of the original secret lift (sector135). Its recessed side
pocket (sector134) is 16 units below the landing, with enough ceiling clearance
to climb out while standing. Original lift triggers and escort lift handling
are removed for that landing, so waiting or using it cannot close the route.
The server-wing and Nate approach lifts retain their existing behavior.
`npm run test:doom:stairs` checks actual falls from both edges, standing return,
waiting, use and restart; its floor-position fixture is private to QA.

`HalDoors.zs` owns corridor interference and paired control state. The map
builder mounts controls and selects matching containment texture variants.
`doom-art.py` reads original switch patches from the supplied local IWAD.
`build-hal-door-assets.py` packages those patches with state/damage UI and small
cell text/lock markings. `wall-hardware.py` mounts hardware on a visible nearby
wall with sufficient width, preserving the map’s architecture. The first-level
release, breaker, emergency and refuge controls use the same metal switch art
and fixed mounting; locks and breach markers also have fixed wall orientations.

`npm run test:doom:doors` exercises the warning, countdown, physical reopening,
wrench during an active lock, every approach control, prisoner markings and
restart. Evidence is in `output/hal-doors/`; existing five-rescue regression
checks the actual prisoner routes and all five escorts.

Wall placement and native oblique-view evidence: `output/wall-controls/`.
The five power levers use compact native mechanical toggle art on a single
wall in the approach hallway, spaced 32 units apart, with visible on/off positions.

The retreat crank created on SAFE MODE entry is also a fixed wall sprite,
mounted beside the cover in both maps. HAL's cover is in a 32-unit recess;
the crank sits on the room wall beside that recess. Aimed crank instructions
take priority over the nearby cover prompt. Hold E still returns to SAFE MODE.

The evaluation doors cycle with Doom's original hydraulic opening/closing
sounds. The browser now mirrors native source/listener positions, distance
attenuation, cones, gain and playback-rate changes while sounds play. This
applies to both maps' world sounds; music and discovery-card cues remain local.
Prisoner discovery cards pause gameplay for 3.5 seconds (previously 1.2), with
the private IWAD's original power-up pickup sound played by the browser while
the native game is paused.

## Escort, camera and text polish

Prisoners pass through the pursuing robot, other people, the player and solid
decorations such as the tall tech pillar. Their collision radius is 10 units
(previously 14). Walls, closed doors, shootable obstacles and laser damage still
apply. All nine cameras in each campaign map sit
0.5 units off actual walls with fixed orientations; their scanning cones move
independently. They remain reachable with the wrench and retain destruction
effects, sounds and the camera tally.

Status text, interaction prompts and queued spoken dialogue share a vertical
layout, so wrapped text pushes the next panel aside rather than overlapping it.
Quiz panels and discovery cards hide these background messages while visible.
The name/bio cards and their 3.5-second pause appear only after a prisoner is
released and seen nearby. Seeing an unreleased captive does not reveal the bio.

Once an escort reaches the actual refuge entrance hall, they commit to entering
and operating its physical bulkhead even if the player turns away. Inside,
they hold their refuge slot and wander locally. The approach trigger never
captures people through surrounding walls. The ending cannot seal the refuge
until the player is inside too.

The opening story is remembered per browser and skipped on subsequent visits,
including switching CEOs. Existing saved SAFE MODE campaigns also skip it.

The pod-bay and final exit jailbreaks consistently accept option 3. The exam
always asks about the camera total, prisoner total and tea-dispenser buttons,
with correct options 1, 2 and 3 respectively. Wrong answers retain their alarm
and cooldown but do not shuffle the questions or choices.

All four pulled memory modules permanently stop HAL's pursuer and ordinary
door interference for that attempt. Fewer than four do not pacify it.

The purple/gold book seen in HAL was a death remnant reusing textbook artwork,
not a pickup. Death remnants now briefly dissolve using digital plasma art.
The actual first-level textbook remains an E pickup and an alternate solution
for disabling the turret by wedging its sensor.

`npm run test:doom:escort-polish` checks native reciprocal movement, retained
wall collision/laser damage, camera mounts and melee, consistent quiz retries,
four-module pacification and the actual textbook route, plus text layout at
desktop and both phone orientations. Its native probes are included only in a
private QA copy of the pack, never the playable mod. Evidence and visually
reviewed camera views: `output/escort-polish/`. The five-rescue and final escape
regressions also pass there using the uninstrumented playable pack.

World sounds now fade to silence beyond a local range in addition to native
positional attenuation. Initial distant sources start silent, avoiding a short
click before the volume settles. Moving source/listener updates retain this
fade. Tea buttons use 40% source volume and cup drops 45%, both with Doom's
static-object attenuation. Music and local success feedback retain their own
playback paths.

`npm run test:doom:escort-arrival` verifies actual solid-pillar pass-through,
wall/damage retention, automatic refuge entry and waiting in both maps,
post-rescue bios, first/returning story visits and actual tea audio near/far.
It also renders audio to verify no distant transient and moving-listener fade.
Evidence: `output/escort-arrival/`. The full production five-rescue/escort
regression also passes under `output/escort-arrival/rescues/`.

`npm run test:doom:refuge-sound` verifies actual browser stereo/attenuation,
native machinery near/far, a real Rob discovery with paused run clock, wall
hardware views in both levels, and both manual-crank retreats. Evidence:
`output/spatial-audio/`. Native door cycle volume at the HAL entrance is under
1% of source amplitude; near the evaluation machinery it reaches about 85%.

Rob’s balcony alternative now uses a wall-mounted **EMERGENCY RELEASE — ROB CELL** switch beyond corridor door79. Breaking that corridor panel or crossing the old walkway trigger does not rescue him. Use the named switch to unlock his cell, then return to the galley and meet him; he waits inside until you see him nearby. His discovery card and escort start at that meeting. The tea-label and shooting-STOP solutions are unchanged.

## Interaction sounds

The local THAW override uses Doom's metal switch click. Each successful valve
turn plays an original 0.82-second mechanical ratchet ending in a latch clunk.
Both cues use native positional audio at the control's wall position. Locked or
already-open valves do not play success feedback. Mod interactions consume E
before Doom's native wall-use fallback, so a successful action no longer also
plays its failed-use grunt. Ordinary native door/lift use remains available.

Carry QA: `npm run test:doom:evaluation`; sound and full timed route QA:
`npm run test:doom:thaw`. Private fixtures position the player on the actual
sector floor; they are not part of the game pack.
