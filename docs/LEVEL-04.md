# AGENTIC SMITH's pod farm — level 4 plan

Approved by Jonathan 2026-10-18 (after one revision of the rescues). Nothing is built yet; implementation waits until level 3 is finished. This trims the 2026-10-06 spec ([GAME-SPEC §3.4](GAME-SPEC.md#34-episode-4-thy-flesh-computed-e2m2-south-half-human-containment-area), [03 §6.16–6.20](spec/03-prisoners-and-rescues.md)) to the current house rules: one rescue per prisoner, captives call out their hint on approach, the first person freed leads you to the refuge, Doom controls, sparse text, and a refuge exit of its own. Art to generate is in [LEVEL-04-ART.md](LEVEL-04-ART.md).

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

## Look: two worlds, by recolour

Following the factory pass, keep every E2M2 texture, flat and decoration and recolour them per wing with TEXTURES translations (a `matrix_theme.py` modelled on `scripts/factory_theme.py`). The organising idea is the films' two colour grades: the machine world is cold blue steel and pink pod gel, and the places SMITH runs are a green-tinted 1999 office.

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

## AGENTIC SMITH

He looks like Agent Smith (Jonathan, 2026-10-18, replacing the spec's original mannequin): black suit, narrow black tie, dark sunglasses, coiled earpiece, slicked-back hair. The AI jokes are in the details: an `AGENT / ALL-ACCESS` lanyard over the tie, a green loading spinner turning in each lens, and a short to-do list floating over his head (`1. CHECK EAST PODS ✓  2. INSPECT NOISE`).

1. **Cameras are its eyes.** When a camera sees you, SMITH materialises at that camera in a green-glyph dissolve and chases on foot. Smash a camera and it can't appear there.
2. **Freed people slow it.** Each rescue takes 10% of its "human compute".
3. **It possesses the people you've freed.** A possessed companion gets SMITH's green loading spinner over their head and does reversible, annoying things: shouts your position, shuts doors. Walk up, `SPACE - STOP GENERATING`.
4. *Twist:* a fourth possession overflows its context. Everyone snaps free and it reboots for 6 s.

A wrench hit stuns it, like the other guardians. It can't enter the refuge.

## Start, refuge, exit

- **Cold start:** you wake in a drained pod in ward 5. The table next door has the red-team pill (`SPACE - TAKE THE RED-TEAM PILL`; afterwards you can read SMITH's to-do lists) and a note: `THERE IS NO SPOON.` In the first 90 s SMITH materialises at a camera across the nukage strip, reads its list and walks off, which teaches rule 1 from safety.
- **Kit:** wrench in the ward; the slingshot for cameras out of reach. Six stimpacks, three medikits in the refuge.
- **Refuge:** exit room 9, across the nukage bridge (the switch is beside your ward; pre-raised from the hub).
- **Exit, "the hardline home":** once everyone alive is in the refuge, its payphone rings. As you reach for it, SMITH takes over the door camera and possesses your people one every 3 s. Smash the door camera, `STOP GENERATING` down the line, then answer the phone: Doom's screen melt into the meadow. (Level 1 crawls a duct; level 2 runs a reboot. This one is a phone call.)

## The five rescues

Revised 2026-10-18 after Jonathan's first read: Katja and Bengio were redesigned because they needed too much explaining, and Bostrom's box became "stop looking at him".

Suggested order from a cold start: Tallinn → Bengio → Bostrom → Kokotajlo → Grace. Any order works.

**1. Jaan Tallinn — Run the hardline** (payphone booth in the office hall)
He's in a payphone booth with a jammed door. *Hint: "Patch me through from the exchange. Straight line, or it won't reach."* At the switchboard across the hall, pull the red BOOTH 7 cable and carry its end. It pays out from a cable drum and lies on the floor behind you as a red line. There is just enough for the straight route, and a camera watches that route.
- Go the long way round to dodge the camera and the drum runs empty: the cable snaps taut and you can't take another step. Walk back to take up the slack.
- Go straight while the camera's intact and SMITH appears, walks to the cable (not to you) and cuts it, and it whips back to the drum.

So you smash that camera, then walk straight. Plug in: the booth rings, he answers, the door unjams, and he leads you to the refuge.

**2. Nick Bostrom — Unrendered** (the middle pod row, then the Construct)
His body floats in the centre pod. Beside it is a worn leather chair: `SPACE - SIT`. White-out, and you're in the Construct, an endless white room. Bostrom stands inside a white box with no door. *Hint: "Nothing renders what nobody's looking at."* Stare at him long enough and he adds: *"...You're somebody."*
The answer is to turn your back on him. While the box is out of your view it isn't there, and he walks out. When you turn back, the box redraws itself as a green wireframe for a second before going solid, with Bostrom now standing outside it. That redraw happens every time you look back at the box, so it's the visual tell. He says *"Shall we?"*, you sit in the white chair to jack out, his pod drains, and he climbs onto the catwalk.
*Backup if playtests say this doesn't read:* CLIPPER, a paperclip maximiser robot that follows your wrench because it's metal. Lead it to his cage and it eats the bars.

**3. Daniel Kokotajlo — Race or Slowdown** (harvester bay, behind the crushers)
Time the five-crusher corridor into a dark side room; a lit floor pad opens the bay. His pod's screen has two big buttons under *"Sign the non-disparagement agreement to release?"*
- **SIGN** (green): the pod opens now, and SMITH is 20% faster for the rest of the level. *"You signed it? …That's the race ending."*
- **DON'T SIGN** (red), three times: the equity offer climbs with a chime each time (noise), then a 30 s countdown opens the pod while you hold the bay, and SMITH is 20% slower for the rest of the level.

The results card logs `ENDING: RACE` or `ENDING: SLOWDOWN`. Releasing him stops the crushers for good so he can follow you out.

**4. Katja Grace — Hand the agent a survey** (island in the red pool)
She's on an island; the stepping stones are sunk in the pool. On the shore stands a badge reader marked with the same white lanyard badge SMITH wears: `AGENTS ONLY`. When you arrive she tosses a clipboard onto the shore. *Hint: "No agent can resist a survey. Next time it comes for you, hand it this."*
1. When SMITH reaches you: `SPACE - HAND SURVEY`. It stops dead and starts filling it in, and its list reads `1. COMPLETE SURVEY (Q1 OF 2,778)`.
2. While it's busy (about 20 s): `SPACE - TAKE BADGE`.
3. Swipe the badge at the reader. Every stone rises and she walks over.

When SMITH finishes, its list reads `2. FIND BADGE` and the hunt resumes. A stun is too short to take the badge, so the survey is the only way. A camera behind glass watches the pool, so SMITH can always be brought here. A vase on a side table has a sticky note: "Don't worry about it. —Z".

**5. Yoshua Bengio — Take away its tools** (north test rig)
He's on a rig with a robot arm, one of SMITH's subagents, with a loading spinner for a face. The arm works a yellow lever that keeps the platforms around the rig circling out of reach. Its base holds three tools: a blue phone, a red alarm button and that yellow lever. Each tool's cable runs to a socket of the same colour, spread around the room's walls. *Hint: "Take its tools before it uses them."*
1. When you walk in, it picks up the blue phone and starts dialling (about 4 s). Pull the blue socket and the line goes dead.
2. It lunges for the red alarm button. Pull the red socket.
3. It yanks the lever and the platforms speed up. Pull the yellow socket.

The platforms stop level with the rig, and the arm slumps into a harmless predictor (*"Prediction: the door is now open."*). There's no order to learn; you pull whatever it's reaching for. If it gets there first, the call or the alarm brings SMITH, and the arm moves on to its next tool, so you can always finish.

## Decisions for Jonathan

1. **The prologue uses E2M2 too.** The Last Stand's second room ("red depot", E2M2 sectors 2, 3, 17, 25, 36) is the harvester end of this level. Level 3 has the same issue with E2M7. `scripts/gauntlet-no-rescue-overlap.json` is a validated swap (E1M1 hangar and E2M3 vine yard instead). Recommended: swap it.
2. **Tallinn walks or is "extracted"?** The old spec teleports him to the refuge through the phone (very Matrix), but then he can't be your first guide, and we've avoided teleporting companions. Recommended: he walks out, and phones-as-exits is saved for the level's own exit.
3. **Kokotajlo's countdown** is now 30 s (the spec said 60).
4. **The to-do list.** Readable only after the red-team pill (as specced), or always on? Recommended: keep the pill. It's the level's first Matrix moment and it costs one prop.
5. **Context overflow.** Keep the fourth-possession reboot as SMITH's twist. The old mid-level set piece (ring three payphones at once to force it) can wait for a later pass.

## Cut from the 2026-10-06 spec

One route each, so these go: Tallinn's grant kiosk; Bostrom's paperclip lockpick and unplug-the-pod (and with it the EMP tool); Kokotajlo's charge breach (so this level needs no charge); Katja's waiting room, take-a-number queue, "agents skip the queue", wading and staff stair; Bengio's fixed cable order and ride-the-platforms; the Context Overflow payphone set piece (later). CLIPPER and the battery couriers stay optional ambience.
