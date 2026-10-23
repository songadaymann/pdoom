# AGENTIC SMITH's pod farm — level 4, local first pass

Approved by Jonathan 2026-10-18 (after one revision of the rescues). Built 2026-10-21/22 on branch `level-4-agentic-smith`: all five rescues, SMITH, the refuge and the payphone exit run natively; the level is unscored and local development only until it is released (see [Local implementation](#local-implementation)). This trims the 2026-10-06 spec ([GAME-SPEC §3.4](GAME-SPEC.md#34-episode-4-thy-flesh-computed-e2m2-south-half-human-containment-area), [03 §6.16–6.20](spec/03-prisoners-and-rescues.md)) to the current house rules: one rescue per prisoner, captives call out their hint on approach, the first person freed leads you to the refuge, Doom controls, sparse text, and a refuge exit of its own. The sections below are the approved design; **Built:** notes say where the build changed or settled it. Art prompts are in [LEVEL-04-ART.md](LEVEL-04-ART.md), what is still needed in [LEVEL-04-NEEDS.md](LEVEL-04-NEEDS.md).

**THY FLESH COMPUTED** · title card **HUMAN CONTAINMENT AREA** · *Five humans in pods, running someone else's workload. Unplug them.*

## Map: E2M2 Containment Area, south half

![E2M2 plan](spec/maps/E2M2-plan.png)

The north crate warehouse is sealed at doorways 243 and 221, which leaves about 6.0 k u², close to E1M4. The south half is the best "pod farm" in Doom, and each rescue is built on one of its own machines:

| Original feature | Becomes | Used by |
| --- | --- | --- |
| Three glowing troughs between catwalks | Rows of pods | Bostrom |
| Five-crusher corridor | The harvester | Kokotajlo |
| Octagon rigs ringed by perpetual platforms | Test benches | Bengio |
| Stepping stones that rise out of a red pool | The queue | Katja |
| Booth in the open hall | Payphone booth | Tallinn |
| Exit room across a nukage bridge | Refuge | Everyone |
| Marble cross hall with four pillars | SMITH's lobby | — |

**Built:** all IWAD things are dropped; the troughs are walkable and harmless (glow only); pits 0 and 14 are raised to 40 so you can step back out; the Construct is a new sealed white room in the void (x 0..512, y −1600..−1088). Doom's exit, crusher, perpetual-platform, stone and secret specials are cleared (the stairs are pre-built), and the level's machines are driven from ZScript.

## Look: two worlds, by recolour

Following the factory pass, keep every E2M2 texture, flat and decoration and recolour them per wing with TEXTURES translations (`scripts/agentic_theme.py`, modelled on `scripts/factory_theme.py`). The organising idea is the films' two colour grades: the machine world is cold blue steel and pink pod gel, and the places SMITH runs are a green-tinted 1999 office.

| Wing | Palette |
| --- | --- |
| Refuge (exit room 9, corridor 10/11) | Warm rust and amber lamplight. The only warm room in the level, so safety reads at a glance |
| Pod ward 5 (cold start) | Low pink light, empty drained pods |
| Pod farm (troughs, catwalks, corridor 138) | Deep blue steel; the troughs glow pink-red gel; black cable bundles |
| Harvester (crusher corridor, bays 26/29) | Oxide red and black, hazard stripes on the crushers, sodium-orange light |
| Test rigs (east octagons) | Sterile lab white with orange safety paint |
| Office halls (rooms 3, 16, 25, 31, 32, 34) | Green-graded 1999 corporate: sage walls, grey-green carpet, fluorescent ceilings. The payphones live here |
| Waiting room 77 and the red pool | Warm kitchen ochre; the pool stays red (it hurts) |
| Cross hall 84 | White marble with a cold green-white glow |
| East wing | Dark server teal with blinking LEDs |
| The Construct (new room) | Pure white, faint seams only |

Every computer texture runs original falling green glyphs (animated, our own glyph set, not the film's). Nukage strips glow brighter "code green". Doom barrels become glowing human battery cells, tech columns become server racks. The check is the same muted screenshot tour as the factory.

**Built:** as tabled; the east wing is lifted (a 144 light floor) so it isn't black; skull wood, satyr/lion switches, AASTINKY and the marble friezes swap to plain Doom materials. Three server racks (Doom's tech column, recoloured per wing and drawn 96 tall to fit the low halls) stand in room corners (`agentic_theme.dress`). The glowing battery cells were taken out on 2026-10-23: scattered on the floors they read as pickups. The core smoke's `tour` case is the screenshot tour.

## AGENTIC SMITH

He looks like Agent Smith (Jonathan, 2026-10-18, replacing the spec's original mannequin): black suit, narrow black tie, dark sunglasses, coiled earpiece, slicked-back hair. The AI jokes are in the details: an `AGENT / ALL-ACCESS` lanyard over the tie, a green loading spinner turning in each lens, and a short to-do list floating over his head (`1. CHECK EAST PODS ✓  2. INSPECT NOISE`).

1. **Cameras are its eyes.** When a camera sees you, SMITH materialises at that camera in a green-glyph dissolve and chases on foot. Smash a camera and it can't appear there.
2. **Freed people slow it.** Each rescue takes 10% of its "human compute".
3. **It possesses the people you've freed.** A possessed companion gets SMITH's green loading spinner over their head and does reversible, annoying things: shouts your position, shuts doors. Walk up, `SPACE - STOP GENERATING`.
4. *Twist:* a fourth possession overflows its context. Everyone snaps free and it reboots for 6 s.

A wrench hit stuns it, like the other guardians. It can't enter the refuge.

**Built (tuning of 2026-10-22; every number is a named constant at the top of `PDAgentic` in `Agentic.zs`):**
- **Look:** Agent Smith since the 2026-10-23 redo (black suit, narrow tie, sunglasses with green lenses, earpiece, slicked hair, the lanyard badge). Once Katja's badge is taken he wears the badge-less frames (`ASMU`) for the rest of the level. The to-do list is drawn by the browser over his head, only after the pill and never while he is speaking.
- **Cameras:** ten. C1-C9 watch the halls with level 1's camera rule (480 u, ±20° sweep); C6 over the red pool is behind glass (`It's behind glass.`); the tenth is the refuge door camera, dormant until the exit. The first camera to see you brings him at once; while he is within 1024 u of you no camera re-places him for 10 s (3 s from further away). His own eyes see 1024 u at ±70°, all round within 256 u. Wrench up close or slingshot from range smashes a camera; the status bar's CAMS counts the nine breakable ones.
- **Pace:** hunt 2.4 u/tic, alarm 2.0, patrol 1.4, times 0.9 per person freed, times 1.2 (race) or 0.8 (slowdown).
- **Contact:** he stops at arm's length (64 u) and steps back if you come inside 48 u; his grab hits 10 HP a second within 72 u. A wrench or slingshot stun lasts 6 s, then he heads for where he last saw you for 1 s, blind.
- **Possession:** only while hunting, a freed person within 192 u, in his ±70° view (or within 96 u) and in sight; never someone still stepping out of their cell, freed under 5 s ago, or within 128 u of the refuge doorstep. At most one new possession per 12 s; a stun or `SPACE - stop generating` (within 96 u) restarts that cooldown. Every 6 s a possessed person either calls SMITH to your position or shuts a nearby door that can be pushed open from both sides (otherwise they call). Possessed people hold still while you are in the Construct.
- **Refuge:** he waits on the doorstep in nook 7 (`That room is out of scope.`) and never opens refuge door 11.

## Start, refuge, exit

- **Cold start:** you wake in a drained pod in ward 5. The table next door has the red-team pill (`SPACE - TAKE THE RED-TEAM PILL`; afterwards you can read SMITH's to-do lists) and a note: `THERE IS NO SPOON.` In the first 90 s SMITH materialises at a camera across the nukage strip, reads its list and walks off, which teaches rule 1 from safety.

  **Built:** the pill and the slingshot lie on the floor of alcove 12 next to the ward, under the note (`SPACE - take the red-team pill`). The beat is scripted, about 6 s in, once the pickup text has cleared (at most 8 s later): SMITH appears at C1 in room 3 across the nukage from the ward window, says his intro (from 6.2 s), holds about 3 s so the to-do list gets its own beat (alone from 12.2 s), then patrols. Only one new text element appears at a time.
- **Kit:** wrench in the ward; the slingshot for cameras out of reach. Six stimpacks, three medikits in the refuge.
- **Refuge:** exit room 9, across the nukage bridge (the switch is beside your ward; pre-raised from the hub).

  **Built:** the bridge starts sunk to 16 (not −16, which trapped a player below the pits) and rises to 64 from its switch (line 1336, a Boom generalized floor-to-highest-neighbour raise) or by itself the moment anyone is freed, so the guide can always lead. It is up from the start on a hub visit or any `?puzzle=` site.
- **Exit, "the hardline home":** once everyone alive is in the refuge, its payphone rings. As you reach for it, SMITH takes over the door camera and possesses your people one every 3 s. Smash the door camera, `STOP GENERATING` down the line, then answer the phone: Doom's screen melt into the meadow. (Level 1 crawls a duct; level 2 runs a reboot. This one is a phone call.)

  **Built as designed.** Coming within 192 u of the ringing phone inside the refuge wakes the door camera (`smith-exit`); the guide shouts `It's in the door camera. Break it!`; the objective reads `Break the door camera`, then `Stop generating`, then `Answer the phone`. Before everyone is safe on a cold start the phone says `Not everyone's here yet.` On a hub visit it answers any time and takes whoever is with you in the refuge; only possessed people inside the refuge block it, and anyone left in the halls is saved as following. The melt comes out of AGENTIC.BAT's door; a later exit that finishes the level types the exit text first, ending with `ENDING: RACE` or `ENDING: SLOWDOWN`.

## The five rescues

Revised 2026-10-18 after Jonathan's first read: Katja and Bengio were redesigned because they needed too much explaining, and Bostrom's box became "stop looking at him".

Suggested order from a cold start: Tallinn → Bengio → Bostrom → Kokotajlo → Grace. Any order works; the playthrough smoke uses this one.

**1. Jaan Tallinn — Run the hardline** (payphone booth in the office hall)
He's in a payphone booth with a jammed door. *Hint: "Patch me through from the exchange. Straight line, or it won't reach."* At the switchboard across the hall, pull the red BOOTH 7 cable and carry its end. It pays out from a cable drum and lies on the floor behind you as a red line. There is just enough for the straight route, and a camera watches that route.
- Go the long way round to dodge the camera and the drum runs empty: the cable snaps taut and you can't take another step. Walk back to take up the slack.
- Go straight while the camera's intact and SMITH appears, walks to the cable (not to you) and cuts it, and it whips back to the drum.

So you smash that camera, then walk straight. Plug in: the booth rings, he answers, the door unjams, and he leads you to the refuge.

**Built:** the payphone is inside the booth; you plug into the BOOTH 7 jack on the east jamb of the booth door (`PDAgenticMap.BoothJack()`, standing at `BoothPhone()` in front of the door). The line lies taut: it pulls straight and wraps the corners you pass, so only the route counts (`CableBudget()` = the straight route × 1.08). Both hands are on the plug (HUD `hardline.png`): no wrench or slingshot until you let go, and nobody else calls out a hint meanwhile. A camera that sees you with the line out (C2 watches the straight route) sends SMITH to the nearest piece of it; he takes hold, holding you where you are, and cuts it. What SMITH sees with his own eyes he hunts as usual and leaves the line alone.

**2. Nick Bostrom — Unrendered** (the middle pod row, then the Construct)
His body floats in the centre pod. Beside it is a worn leather chair: `SPACE - SIT`. White-out, and you're in the Construct, an endless white room. Bostrom stands inside a white box with no door. *Hint: "Nothing renders what nobody's looking at."* Stare at him long enough and he adds: *"...You're somebody."*
The answer is to turn your back on him. While the box is out of your view it isn't there, and he walks out. When you turn back, the box redraws itself as a green wireframe for a second before going solid, with Bostrom now standing outside it. That redraw happens every time you look back at the box, so it's the visual tell. He says *"Shall we?"*, you sit in the white chair to jack out, his pod drains, and he climbs onto the catwalk.
*Backup if playtests say this doesn't read:* CLIPPER, a paperclip maximiser robot that follows your wrench because it's metal. Lead it to his cage and it eats the bars.

**Built:** the box is a 96 u see-through white cube (`AWHITE`, shaded per face at 70%, so you see him inside); the redraw is `AWIRE` green wireframe at full brightness. Looking down at the floor counts as looking away. He is out only once you have seen the box redraw with him outside it; jack out before that and he is back in his box next time. The nudge comes after 10 s of staring. Inside the Construct no camera, catch-up or possession runs; SMITH keeps patrolling the farm. His pod calls `My mind is in that chair. Sit down.` when you can see it. CLIPPER is not built.

**3. Daniel Kokotajlo — Race or Slowdown** (harvester bay, behind the crushers)
Time the five-crusher corridor into a dark side room; a lit floor pad opens the bay. His pod's screen has two big buttons under *"Sign the non-disparagement agreement to release?"*
- **SIGN** (green): the pod opens now, and SMITH is 20% faster for the rest of the level. *"You signed it? …That's the race ending."*
- **DON'T SIGN** (red), three times: the equity offer climbs with a chime each time (noise), then a 30 s countdown opens the pod while you hold the bay, and SMITH is 20% slower for the rest of the level.

The results card logs `ENDING: RACE` or `ENDING: SLOWDOWN`. Releasing him stops the crushers for good so he can follow you out.

**Built:** the crushers fall slowly, pause at the top and bite 10 HP; one lower than your head is a wall (the auto-crouch never pulls you under). Refusals show `EQUITY OFFERED: $1M` / `$10M` / `$100M` with a chime and an alarm at the bay; the first brings SMITH out of C8 (else C1), and he times the crushers to reach you. The countdown runs only while you stand in the bay (`SLOWDOWN IN n`, `SLOWDOWN PAUSED` when you step out). The level is unscored, so the ending goes on the exit text, not a results card; it is kept with the campaign save (`ending3`) and restored on later visits.

**4. Katja Grace — Hand the agent a survey** (island in the red pool)
She's on an island; the stepping stones are sunk in the pool. On the shore stands a badge reader marked with the same white lanyard badge SMITH wears: `AGENTS ONLY`. When you arrive she tosses a clipboard onto the shore. *Hint: "No agent can resist a survey. Next time it comes for you, hand it this."*
1. When SMITH reaches you: `SPACE - HAND SURVEY`. It stops dead and starts filling it in, and its list reads `1. COMPLETE SURVEY (Q1 OF 2,778)`.
2. While it's busy (about 20 s): `SPACE - TAKE BADGE`.
3. Swipe the badge at the reader. Every stone rises and she walks over.

When SMITH finishes, its list reads `2. FIND BADGE` and the hunt resumes. A stun is too short to take the badge, so the survey is the only way. A camera behind glass watches the pool, so SMITH can always be brought here. A vase on a side table has a sticky note: "Don't worry about it. —Z".

**Built:** she tosses the clipboard the moment you walk into her waiting room from hall 41 (changed 2026-10-23 after Jonathan's playtest: before, you had to reach the shore, and nothing told you to). `?puzzle=grace` starts you in hall 41 facing her door. The survey only works in her rooms (waiting room 77, its step, the pool and her island). The badge flies off his lanyard to you and into the reader's slot; she speaks once she reaches the shore, and SMITH takes nobody while she crosses. If he finishes first (`Survey submitted. Where is my badge?`), she tosses another clipboard. The AGENTS ONLY sign hangs small under the ceiling over the reader. C6 brings SMITH out onto her shore.

**5. Yoshua Bengio — Take away its tools** (north test rig)
He's on a rig with a robot arm, one of SMITH's subagents, with a loading spinner for a face. The arm works a yellow lever that keeps the platforms around the rig circling out of reach. Its base holds three tools: a blue phone, a red alarm button and that yellow lever. Each tool's cable runs to a socket of the same colour, spread around the room's walls. *Hint: "Take its tools before it uses them."*
1. When you walk in, it picks up the blue phone and starts dialling (about 4 s). Pull the blue socket and the line goes dead.
2. It lunges for the red alarm button. Pull the red socket.
3. It yanks the lever and the platforms speed up. Pull the yellow socket.

The platforms stop level with the rig, and the arm slumps into a harmless predictor (*"Prediction: the door is now open."*). There's no order to learn; you pull whatever it's reaching for. If it gets there first, the call or the alarm brings SMITH, and the arm moves on to its next tool, so you can always finish.

**Built:** the platforms bob between −16 and 48, never level with the 80 ledge, and the lever makes them three times faster. Blue and red sockets are on the rig room's north and south walls, yellow on hall 41's wall facing the doorway. A pulled tool is dead for good, and pulling the one in use cancels it; with the lever's cable pulled the platforms sink and stop. A call that goes through brings SMITH out of C4 if he is far off. Anyone who falls in can walk out through sliver 53 into corridor 60; SMITH and your people are kept on the 80 floor while the arm works, and the south wall's 8 u band is shut to you until Yoshua is free.

## Decisions for Jonathan

1. **The prologue uses E2M2 too.** The Last Stand's second room ("red depot", E2M2 sectors 2, 3, 17, 25, 36) is the harvester end of this level. Level 3 has the same issue with E2M7. `scripts/gauntlet-no-rescue-overlap.json` is a validated swap (E1M1 hangar and E2M3 vine yard instead). Recommended: swap it. **Still open:** `scripts/gauntlet.json` still uses E2M2 and E2M7.
2. **Tallinn walks or is "extracted"?** The old spec teleports him to the refuge through the phone (very Matrix), but then he can't be your first guide, and we've avoided teleporting companions. Recommended: he walks out, and phones-as-exits is saved for the level's own exit. **Built as recommended.**
3. **Kokotajlo's countdown** is now 30 s (the spec said 60). **Built.**
4. **The to-do list.** Readable only after the red-team pill (as specced), or always on? Recommended: keep the pill. It's the level's first Matrix moment and it costs one prop. **Built with the pill.**
5. **Context overflow.** Keep the fourth-possession reboot as SMITH's twist. The old mid-level set piece (ring three payphones at once to force it) can wait for a later pass. **Built as the twist only.**

New open problems are listed at the end of [Local implementation](#local-implementation).

## Cut from the 2026-10-06 spec

One route each, so these go: Tallinn's grant kiosk; Bostrom's paperclip lockpick and unplug-the-pod (and with it the EMP tool); Kokotajlo's charge breach (so this level needs no charge); Katja's waiting room, take-a-number queue, "agents skip the queue", wading and staff stair; Bengio's fixed cable order and ride-the-platforms; the Context Overflow payphone set piece (later). CLIPPER and the battery couriers stay optional ambience.

## Local implementation

**Run.** `node scripts/serve-doom.mjs` (port 5198; `PDOOM_PORT=<port>` serves a second checkout, such as a worktree, alongside), then `http://127.0.0.1:<port>/?level=agentic-pods`. It is local only until released: `levels.js` marks it `local:true` and unscored (no boards), and the page needs loopback plus the server's `dev-config.json` (`PDOOM_DEV=0` turns it off). Without them `?level=agentic-pods` opens level 1, and crafted `&play=1` / `?start=agentic-pods` links show `THIS LEVEL IS NOT AVAILABLE.` and keep the save. Add `&puzzle=tallinn|bostrom|kokotajlo|grace|bengio|refuge|exit` (or `1`-`7`, CVar `pdoom_agentic_site`) to start beside that rescue, in the refuge, or at the ringing phone with all five safe; every site gives the wrench, the slingshot (5 shots) and the pill, with the bridge up. In SAFE MODE, under the same conditions, AGENTIC.BAT's door walks in (Space; key F1, netevent `pdoom_enter_agentic`, which `Checkpoint.zs` ignores unless the browser set `pdoom_agentic_enabled`): room 3 facing north, wrench in hand, bridge up, no intro film yet. People at camp are gone, anyone freed but left behind waits in the refuge, and the payphone brings you out of the same door (group 3, roster ids 15-19). Elsewhere the door still opens its install dialog. Esc pauses. The music is Doom's D_E2M2 (ignored `local/agentic-music.ogg`, rendered by `scripts/prepare-doom-music.mjs D_E2M2 agentic`; without it the page only warns).

**Build.** It needs the private `doom-web/local/DOOM.WAD`, an existing local runtime (`doom-web/pdoom.pk3`) and Python with Pillow and NumPy.
- `python3 scripts/build-agentic-preview.py` rebuilds E2M2 and the resources into `doom-web/pdoom.pk3`. `--resources-only` refreshes scripts and textures and reuses the last built map (`output/agentic/E2M2-TEXTMAP.txt`). `--out <pk3> --only <tallinn|bostrom|kokotajlo|grace|bengio>` writes a separate pk3 with the other four rescues replaced by their compiling stubs (`scripts/agentic-stubs/`).
- The map build (`scripts/build_agentic_map.py`) first runs `scripts/build-agentic-assets.py`, which draws the procedural art and sounds and runs `scripts/import-agentic-art.py` on ignored `art/level-04-v1/` and `art/level-04-redo-2026-10-23/` (SMITH's badge-less `ASMU` frames are derived from his sheets, and `doom-web/held-badge.png` is written here); without the packs it draws a stand-in under every imported name. It also applies `scripts/agentic_theme.py` and writes `doom-mod/actors/PDAgenticMap.zs`, `output/agentic/map-debug.json` and `output/agentic/E2M2-TEXTMAP.txt`. `scripts/build-doom-mod.py` packs the same map and lumps in a full build.
- `python3 scripts/render-agentic-map.py` draws the built map to ignored `output/agentic/agentic-map.png`: wings, rescues, props, camera cones, the hardline's two routes, SMITH's patrol, the refuge and the Construct.
- `python3 scripts/agentic-lines.py` checks all 78 lines against the `.zs` files. `--write` refreshes `doom-web/voice/lines.json` and [LEVEL-04-LINES.md](LEVEL-04-LINES.md), and `--todo` refreshes [LEVEL-04-VOICE-TODO.md](LEVEL-04-VOICE-TODO.md).

**Native files.**

| File | Owns |
| --- | --- |
| `doom-mod/actors/Agentic.zs` | `PDAgentic` (event handler) and the `PDAgenticPuzzle` hooks: people, the guide and escorts, SMITH (modes, patrol, hunt, intro beat, stun, overflow), cameras, possession, pickups and pill, the bridge, goop damage, the refuge, the payphone exit, hub entry, `?puzzle=` sites, QA netevents (`pdoom_agentic_qa_out`, `pdoom_agentic_qa_possess`, and `pdoom_agentic_qa_pose <frame, +10 badge-less, -1 off> <dist> <turn>`, which holds SMITH in one frame in front of you for screenshots), `PDOOM_STATE` / `PDOOM_AGENTIC`. All tuning constants are at the top. |
| `AgenticActors.zs` | Person, SMITH, camera, prop, decor, spinner and dissolve actors, and `PDAgenticNav` |
| `AgenticTallinn.zs`, `AgenticBostrom.zs`, `AgenticKokotajlo.zs`, `AgenticGrace.zs`, `AgenticBengio.zs` | One rescue each (`PDAgenticPuzzle`): its props, prompts, speech, SMITH while it drives him, and its `?puzzle=` fixture |
| `PDAgenticMap.zs` | Generated by the map build: nav grid, door table, spots, cameras, zones and the map's static methods |
| `CampaignSession.zs`, `Checkpoint.zs` | Group 3 (`Saved3/Lost3/Following3`, `Ending3`), `EnterAgentic`, `CommitAgentic`; the gated door netevent |
| `CVARINFO`, `MAPINFO`, `SNDINFO`, `ZSCRIPT` | Group-3, site, commit, ending and enable CVars; the E2M2 entry, editor numbers 15400-15404 and the handler; 13 `agentic/*` sounds |
| `doom-mod/agentic-textures.txt`, `agentic-theme-*.txt` | Project textures (the Construct, glyph screens); the generated recolour, animation, glow and translation lumps |

Browser side: `doom-web/agentic-hud.js` (page setup, objective line, status bar, held hardline, held badge, SMITH's to-do list, exit text), `main.js` (local gate, page, exit, Esc pause), `campaign.js` (group 3 and `ending3`), `src/doom-outside.ts`, `doom-hub-future.ts` and `doom-camp-layout.ts` (AGENTIC.BAT's live door, lights and README, camp spots, optional meadow figures).

**Smokes.** All run headless and muted against `PDOOM_PORT` (default 5198) and write `output/agentic/<case>/`. Each rescue smoke builds on its own `output/agentic/qa-<name>.pk3` (`--only`); `AGENTIC_FULL=1` runs it on `doom-web/pdoom.pk3` instead. Latest results (2026-10-23, after the SMITH redo, the optional art, the voice takes and the music, on the rebuilt `doom-web/pdoom.pk3`; every rescue smoke with `AGENTIC_FULL=1`):
- `agentic-core-smoke.mjs` 14/14: cold start and pickups, the intro beat, cameras bringing SMITH, the stun, smashing cameras (C6 behind glass), the bridge switch, the refuge doorstep, the guide, possession and STOP GENERATING, every `?puzzle=` site, the exit, the hub round trip, the look tour, and level 3 still booting.
- `agentic-tallinn-smoke.mjs` 6/6: straight, detour (taut), cut, sprint, SMITH's own sight, death at the drum.
- `agentic-bostrom-smoke.mjs` 10/10: the rescue, turning away, looking down, screen edge, early jack-out, hints, C3 cases, the alarm, a QA release.
- `agentic-kokotajlo-smoke.mjs` 13/13: crusher bite and auto-crouch, slowdown, sieges, race, late sign, cameras, SMITH through the crushers, death by crusher.
- `agentic-grace-smoke.mjs` 12/12: survey, reader, stun, retry, deaths, late swipe, follower, carry, earshot, guide. Its `qa-free` case now watches Katja's crossing before walking to the reader: on the full pk3 SMITH (out of C6) stood in the way and she had crossed before the watch began.
- `agentic-bengio-smoke.mjs` 10/10: solve, calls through, summon, QA release, pit, ledge, SMITH and followers at the pit, possession, lever first. (`called` fell into the pit once while another smoke ran alongside, and passed alone.)
- `agentic-playthrough-smoke.mjs`: one cold start through all five and the exit with real input, passed in 479 s (4 stuns; possessions during Katja's rescue and at the exit, where SMITH overflowed and rebooted). Run alone, it passed on the fourth try: twice the bot ran into the room-3 nukage pit and had no route out (since fixed by `climbOut`), and once a warp to the leather chair left it 61 u off target with SMITH beside it (not reproduced).
- Also: `node --test tests/*.mjs` 50/50, `agentic-lines.py` all 78 match, and the level 1-3 factory-browser, hal-browser, onboarding and voice-lines smokes. In a level 4 run the recorded takes play (`voiceOver.played` has `smith-intro`, `jaan-hint`, `smith-cut`, `jaan-cut`), each subtitle reads its take (`jaan-cut`: "Line is dead. ...") and lasts it, and the page fetches `local/agentic-music.ogg` (200) and plays it. (2026-10-22 also ran `hub-future-smoke.mjs` in both modes and the level 1-3 campaign, exit and meadow smokes.)

**Open problems and decisions for Jonathan.**
1. **Playtest SMITH's balance.** After the tuning, possession may be too rare: in the 2026-10-23 playthrough the only possessions were one during Katja's rescue and those at the exit, and the guide is seldom within reach. `POSSESS_RANGE` (192) and `POSSESS_COOLDOWN` (12 s) are the first knobs.
2. **SMITH's poses.** The Agent Smith redo is in (2026-10-23), but `smith-poses.png` (F-J: earpiece, survey, possess, reboot) draws him with a smaller head and slimmer body than the atlas, so he changes build when he goes into a pose. A regenerated poses sheet would fix it; the other small art leftovers are in [NEEDS](LEVEL-04-NEEDS.md).
3. **Voice.** All 78 lines are recorded (2026-10-23). `jaan-allsafe` may need a new take (Whisper hears "that bringing phone"). The takes are ignored files in the level-4 worktree only, so the main checkout needs the same `scripts/import-voice-lines.py` run after the merge, or the manifest lists takes that are missing there.
4. **Real-person sprites ship before the level does.** Once this is merged, every deploy's `pdoom.pk3` carries the level 4 sprites, the five researchers' likenesses included (about 10 MB), though the level is reachable only locally. `scripts/audit-doom-assets.mjs` keeps `hardline.png`, `held-badge.png`, the five meadow figures and the 78 level 4 voice takes out of the deploy until release.
5. **At release:** remove that exclusion, `pdoom_agentic_enabled` and `local:true`; refresh `runtime-manifest.json`; add `local/agentic-music.ogg` to the deploy allowlist; decide on scoring and an intro film like levels 1-3's; and settle the prologue swap (decision 1).
6. **Crafted links** (`?level=agentic-pods&play=1` off loopback) stop at `THIS LEVEL IS NOT AVAILABLE.` with a retry that repeats it, instead of falling back to level 1. The save is safe.
7. **Not addressed:** about 6 s of `SEEN` through the ward window after the intro beat. The playthrough bot, running with Shift, can still drift into the room-3 nukage pit; since 2026-10-23 it climbs back out onto the grid (`climbOut`, logged in `stats.climbs`) instead of failing. One run climbed out of the pit at (-112,141) and finished that escort, which also shows a player can step out.
8. **Commit together:** the untracked level 4 files (docs, `Agentic*.zs`, `PDAgenticMap.zs`, `agentic-*.txt`, `agentic-hud.js`, the `scripts/agentic*` and build/import/render scripts) belong in the same commit as the modified files; `main.js` imports `agentic-hud.js` statically.
