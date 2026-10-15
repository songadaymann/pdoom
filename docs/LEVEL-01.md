# p(DOOM) — Level 01: Test Chamber

Single-player redesign, 2026-10-05. This replaces the earlier Intake spec. **The five-prison rescue checkpoint now runs at http://127.0.0.1:5198/?level=rescue**, and is the default browser level. The old Intake remains at `?level=intake`. The hidden cover/duct and meadow ending are now playable; multiplayer is deferred. Locations, timings and balance are hypotheses for playtesting.

Implemented: original E1M4 environment with five independently tracked prisoners, the long blind east-side crawl, retained melee wrench, nine destructible cameras, a firing turret/rear breaker, maintenance key/shootable lock plus a rear power shutter with a wrench-breakable feed, an explosive bulkhead with smoke and wall fragments plus alternate bent crawl, and a weight-controlled security gate with remote emergency and shootable bypasses. Every cell has a non-consumable solution. Freed people follow automatically, the first rescue guides to safety, and later arrivals stay and idle in the refuge. A nearby follower volunteers at the security pad. No Stay/Follow button is required. The HUD tracks rescue and group counts. Original sectors keep their starting visual fields; new overlays bring the map to 149 sectors. Navigation distinguishes the human-sized low northwest lintel from hunter clearance and operates the original rising landing for followers.

A freed living person can inherit control after a casualty; captives cannot. Opened cells remain resolved after losses. The first rescued person guides you to a protected refuge; later arrivals settle there automatically. Health supplies are finite and inherited bodies keep their wounds. Gathering all remaining living people inside the refuge after all five rescues marks **Survivors gathered**, without revealing outside. Four aimed wrench bolts open a low bent service duct; surviving people physically crawl through it and appear in the clean meadow. Looking back shows the native Doom passage in the entrance. The live doorway view has fixed interior perspective; recorded voice dialogue remains unfinished. See the [playable encounters and controls](../README.md).

## The promise

You wake up alone inside Doom. Somewhere in the facility, five other humans are imprisoned. Find them, improvise ways to free them, and keep the surviving group alive while a machine hunts you. You initially have no reason to believe there is an outside worth reaching. Only after resolving the five prisons do the people and the place reveal an overlooked service passage. Following it brings you into an impossibly bright, clean meadow. Looking back, the facility still looks like Doom.

The emotional progression is **isolation → discovery → resourcefulness → solidarity → disbelief → relief**. The first objective is “Find the others.” No escape marker, green daylight, visible rescue gate, outside relay, map label or loading-screen artwork gives away the meadow. Original Doom sky windows remain: they appear to be the normal, hostile world of Doom.

Jonathan chose **permanent losses with escape still possible for fewer survivors**, rather than checkpoint restarts on a death. Finding/freeing everyone is the campaign's intended progression; keeping everyone alive is the mastery challenge. A death never removes an already-earned rescue or an essential clue.

For the first version, end on the group reaching the meadow and a quiet chance to look back. Another outdoor task remains an open creative decision. Do not add a relay errand simply because the old level had one.

## Use a real map: E1M4, Command Control

Start from the supplied original DOOM.WAD's E1M4. Preserve its actual vertices, sector heights, wall textures, floor/ceiling flats, light levels, texture offsets, doors, stairs, sky and decorative placements. Replace its combat encounters and objectives with ours. This is a modification of the original environment, not a new rectangular chamber painted with a few Doom textures.

The comparison was extracted directly from the supplied local WAD, covering E1M2, E1M4, E1M5, E1M6 and E1M7. E1M4 has 139 sectors and a recognizable central loop with several branches. That gives the hunter a continuous patrol space and gives the player routes around it, while the outer rooms can hold distinct rescue encounters. E1M2's maze and E1M6's larger, more hazardous layout are less attractive starting points for this first rescue campaign.

[Original candidate floor plans](../output/redesign/doom-map-comparison.html) · [E1M4 floor plan](../output/redesign/e1m4-floorplan.png). These show the original walls. The first checkpoint now has a separate navigation graph derived from the modified map; all five placements are implemented in the rescue overlay.

Keep the starting room at the east edge. Use the central loop for pursuit, the northern gallery for the turret problem, the southwest passages for maintenance, and the northwest rooms for the late rescue. These encounter regions now have playable overlays; safe staging positions and encounter balance still need human playtesting. Add only the specific cell partitions, crawl passages and breached connections the encounters require. Disable the original level-exit action. Review original colored-key gates deliberately: they must not accidentally force a single rescue order or require ammunition to reach the alternate solutions.

Original map fidelity needs a visual comparison in the actual browser engine. GZDoom's renderer is not automatically pixel-identical to the 1993 renderer; classic texture filtering, palette treatment, lighting and camera settings need deliberate matching. Preserve the original environment data before tuning its presentation. Keep the supplied commercial assets local to the current development setup.

## The first play

| Phase | Experience | Intended decision |
| --- | --- | --- |
| Alone | An empty room, facility noise, a human voice through an adjacent wall, a loose wrench. Initial shelter gives time to learn movement and aiming. | Investigate the voice and an object that can actually be picked up. |
| First rescue | A real surveillance camera watches a cell entrance. Its sweep and a covered approach make the danger readable. | Break surveillance with a wrench swing, risk a gunshot, or enter from a service passage. |
| Learn the facility | The first person knows there are others. The central loop leads to several prison regions; the machine investigates sightings and noise. | Decide which problem to tackle next, which tool to take, and when to return the following group to shelter. |
| Change the place | A disabled turret, opened cell and breached partition alter usable routes. Dialogue supplies local information as people are found. | Trade speed and noise against a longer, quieter approach. Return through shortcuts the player created. |
| Find the unexplained passage | After all sites are resolved and the survivors gather, the refuge door locks. Delayed dialogue suggests another route and then a draft. | Revisit a familiar place, notice the change, and try the panel. Nobody promises paradise. |
| The reveal | A bent, enclosed service duct prevents any early glimpse. The final turn opens onto clean blue sky and bright grass. Machine noise recedes. | Step out, gather the surviving people, and look back at the dark Doom doorway. |

Target roughly 10–15 minutes for an exploratory first run, subject to playtesting. Do not make this time come from long empty corridors or repeated escorting. After the first rescue, allow several rescue orders; the fifth rescue is whichever site the player resolves last, rather than one scripted person every run.

## Five prisoners, five problems

Use a small vocabulary of reusable systems: projectiles, locks/keys, electrical switches, doors, short service passages, one charge, one hunter and one turret. Different combinations should create the variety. A new crafting or hacking minigame for each cell would obscure the core game.

| Prison / region | The problem | Loud or direct solution | Alternate solution | What changes afterward |
| --- | --- | --- | --- | --- |
| **1. Watched isolation cell / east branch** | A camera covers the cell entrance. | Hit its housing with the retained wrench, then shoot the exposed cell lock if armed. | Explore the long winding crouch passage to its manual release; the prisoner stays hidden through the blind bends. | First companion, a local route clue, and the refuge. Breaking the camera stops reports but makes one audible disturbance. |
| **2. Turret cell / northern gallery** | The turret watches the approach. Its firing lane is visible from safety. | Shoot its vulnerable power housing using cover. | Reach the rear power breaker using cover, or hit the housing three times with the retained wrench. | A dangerous lane becomes a useful shortcut; the mechanical shutdown is visible and audible. |
| **3. Maintenance prisoner / southwest passages** | A locked cell and a rear power shutter sit beside the maze. | Follow the yellow conduit around a blind corner and strike the damaged junction with the wrench; enter through the lifted shutter and use the inside release. | Find the maintenance key or shoot the eastern padlock. Sam then opens the inside emergency latch automatically. | The permanently open rear shutter gives the maze a second escape route. Cutting its feed alerts the hunter; finding the key remains quiet. |
| **4. Partitioned prisoner / west machinery rooms** | A cracked bulkhead blocks the short approach; a bent low service passage leads around it. | Plant the charge, warn the nearby person, retreat and breach. | Take the longer service entrance and open the cell mechanically. | The hole creates both a group shortcut and a firing lane the hunter can use. Smoke clears to reveal a genuinely open wall. |
| **5. Security prisoner / northwest command rooms** | An interlocked door closes before a lone person can traverse its normal approach. | A rescued companion holds the covered switch while the player crosses; or shoot the exposed lock if ammunition remains. | Reach the emergency manual release by a longer side route. This remains possible when no companion is alive. | The last unresolved prison prompts collecting the survivors. The service cover becomes actionable after the living group gathers. |

All five rescue encounters now have playable overlays. Every cell needs a non-consumable way to resolve it; missed shots, a lost wrench, using the charge early, or losing an ally must not make the campaign impossible. Tools buy time or change danger, rather than serving as five mandatory inventory tokens.

## Rescued people and permanent loss

The first released human leads to the original side room between the central ring and the east starting hall. They walk the native route and wait beyond speaking distance if the player falls behind; a persistent HUD clue identifies the guide. A tagged native bulkhead seals the entrance once people clear it, and a visible fixed grate bars the secondary lift entrance. Machinery masks people inside: the hunter cannot navigate into the refuge or acquire targets there.

Later arrivals automatically settle in separate spots. Freed people follow automatically until sheltering; there are no manual orders. A nearby person volunteers to hold the security pad and resumes following after that rescue. Guide death chooses another freed, living NPC; if the guide becomes the player or none remains, a refuge-location clue persists. No companion teleports there. The maintenance cover in the north recess becomes actionable after gathering the surviving group: select a wrench, aim at four silver bolts and hold Space on each. A spare wrench prevents a lost tool from blocking the ending. The native ceiling gate opens a 40-unit low passage, with two blind bends before the final threshold. NPCs use native crouched collision and physical movement; they do not teleport down the duct.

Player and prisoners begin with 100 health. Each hunter hit deals 30; healing is finite: six native stimpacks (+10) across the facility and three native medikits (+25) in the refuge, capped at 100. Pickups use Doom walk-over behavior and remain available at full health. Inherited bodies keep their wounds. The turret and close demolition blast remain separately dangerous. Native damage supplies pain/impact feedback and the browser HUD displays health as a percentage.

Keep the current control-transfer idea: when the controlled human dies, control can pass to a living freed companion. Captive people are not playable remote cameras and cannot become a body-transfer shortcut into an unopened cell. If no freed, living body remains, the run ends and a manual retry starts a fresh attempt. Losing one person is consequential; it does not undo doors, destroy every carried tool, or demand an automatic checkpoint reset.

Track **prison resolved**, **person released**, **person alive** and **person outside** separately. For the reveal, all five prison sites must be resolved: release the person, or open/inspect the site and establish a casualty. A person who dies after being released still counts as a resolved prison. Completing the level requires at least one survivor outside, not six survivors. Full rescue means the player and all five prisoners reach the meadow alive.

Essential knowledge cannot live only in one person's dialogue. After a death, the relevant cell log, scratched diagram or dropped note supplies the same service clue. Do not require a particular living engineer or five bodies on pressure plates. Prevent remote, unexplained deaths of unseen captives; threats to a prison need a visible, reachable opportunity to intervene.

## Make the hidden exit feel discovered

The service route stays sealed until all five prison sites are resolved and all living people gather in the refuge. The bulkhead then closes and locks, with named dialogue: “We’re all here. Wait... the door just locked.” The room changes without a glowing exit objective or a promise of paradise.

The active native game clock supplies restrained fallback clues. At 40 seconds: “There must be another way out of here.” At 65 seconds: “Do you feel that draft? It’s coming from the maintenance wall.” Pausing freezes both delays, and opening the cover stops hints. A living rescued person speaks; a lone survivor gets their own thought. The maintenance-cover prompt is generic until inspected; aiming at a corner reveals its bolt interaction. Four aimed wrench bolts open the cover for any surviving group size.

Do not name this route “Escape Vent” in a prompt before the player discovers its destination. A generic service duct elsewhere teaches that ducts can be entered without signaling that the final one leaves Doom. The final duct has a bend and an enclosed transition pocket; no sky pixel, reflection or minimap thumbnail leaks Bliss beforehand.

The route must accommodate the actual surviving group. Test single-file movement, corners, collision and regrouping; use short, walkable low passages rather than an elaborate ladder simulation. No companion should die because a decorative hatch cannot fit its navigation radius.

## Hands-on interactions and destruction

**Cameras:** draw or generate an original low-resolution CCTV housing, bracket, lens and cable that belong in Doom. Use directional billboard frames if needed, with clear intact, tracking, hit and broken states. Stock decorative eyeballs are not the camera art. Its sweep points toward what it can actually see; its indicator dies on destruction.

**Wrench:** keep hold of it and swing with Space/attack; T switches between it and the gun. Use native view-height/pitch aiming and a 112-unit wall-blocked reach. A missed swing costs no tool. One hit breaks a camera; three disable the turret housing. Impacts visibly erupt with fire, smoke, sparks and gray metal fragments. Humans are not damaged by wrench swings. The hunter can be briefly interrupted at close range, with an immunity interval preventing a permanent stun lock. E does not remotely destroy machines.

**Gun:** keep one weapon with limited ammunition. It can damage locks, cameras and turret components, and briefly interrupt the hunter. It does not turn the campaign into clearing rooms of ordinary Doom monsters. Lock collision and hit feedback need to be generous enough that missing the exact hinge is not the puzzle. Giving it to a companion remains an optional tactical choice.

**Breach:** plant one charge on a legible patched partition, show its fuse, and provide time and space to retreat. The blast produces a short flash/light pulse, an explosion sound, outward wall fragments and layered smoke. The solid partition must actually disappear and reveal the connected room; a decal or changed texture is insufficient. Change collision, sightlines and navigation with the breach. Debris settles/fades without permanently clogging the hole. Limit particle/debris budgets on mobile. Keep the patched wall's shadowing and edges plausible before and after detonation.

For the first version, smoke is visual and does not silently grant invisibility. If smoke later blocks sensing, the hunter and any future forecast must use the same rule. Keep camera bob subtle; avoid screen shake that recreates the movement discomfort already fixed.

**Keys, switches and charge placement:** E/use remains appropriate, supported by a visible held tool, mechanical motion and an audible response. The interesting choice is reaching the device, exposing yourself, timing the action or creating a new route. Do not replace every meaningful action with a long hold-to-use timer.

## The hunter

One machine occupies one continuous map. Camera reports and impacts convey a last-known location, not knowledge through walls. It telegraphs attacks, loses aim behind real cover, and takes audible time to open doors. Loops, short bypasses and shutting doors should buy the player useful time. Breaking a camera does not subtract an invented danger percentage; it removes that sensor's future reports.

The first shelter is safe until the player ventures out or deliberately makes a disturbance. A new player must be able to learn a wrench swing without a countdown killing them. Outside the shelter, threat remains understandable: machine footsteps, sweep lights, windup and impacts explain why it is approaching. Rescue sites have cover for the person being released. Full rescue must be achievable without a scripted sacrifice or perfect companion pathfinding.

## Doom inside, Claude's world outside

The original Three.js outside at port 5197 supplied the art direction: saturated blue sky, wind-swept cloud wisps and bright long grass. The native campaign at port 5198 now switches to a separate meadow renderer after its enclosed duct. Its entrance displays a live native passage view, with fixed interior perspective. The older Three.js capture below shows the earlier closed-door prototype. [Field capture](../output/redesign/claude-outside/desktop-outside.png) · [Look-back capture](../output/redesign/claude-outside/look-back.png).

The required image is **simultaneous contrast**: from the clean meadow, the doorway and visible facility interior retain their Doom textures, lighting and pixel treatment. Changing the entire screen from pixelated to smooth at a threshold cannot by itself satisfy that look-back view. The first reveal should be framed by a cramped dark opening, then expand into open sky and grass; give sound and movement room to breathe.

The implemented contrast proof uses a separate meadow canvas and live native passage texture. Earlier alternatives considered for that proof: Start with the real browser Doom interior. Try an engine-native outdoor scene if it can reproduce the approved art direction; preserving Claude's exact Three.js shaders instead would require a portal/compositing approach, synchronized cameras, portal clipping and movement continuity. A two-canvas handoff alone does not solve looking back through the doorway. Importing the original map into Three.js would be a larger engine change and is not the default choice after adopting an actual Doom mod.

Acceptance for this proof: no early outside visibility; clean outside and visibly Doom inside in the same view; a convincing threshold crossing; reliable companion continuity; and smooth pacing on desktop plus a credible mobile budget. The implemented handoff is not a fully integrated renderer: the doorway view has fixed interior perspective.

## Build in reviewable stages

1. **Original-map baseline:** make a separate development entry for E1M4 using its original environment data, without replacing the current playable Intake entry. Confirm architecture, materials, lighting and movement visually. Replace encounter actors deliberately; preserve decorative things. If conversion to UDMF is needed, compare heights, offsets, tags and door behavior against the binary original rather than redrawing it by hand.
2. **First rescue slice:** add one imprisoned person, a real-looking camera, a retained melee wrench, two entry solutions and the hunter in a small part of that map. Test whether these actions feel fun and readable before adding more sites. Build the real sector/door navigation here; the old 26×26 grid graph cannot simply stand in for E1M4.
3. **Early contrast proof:** test the hidden duct and outside/inside look-back using a separate debug route. Resolve rendering feasibility before building the full ending. The debug route is not exposed in normal play.
4. **Five-prison campaign:** implement the encounter variations, refuge, dialogue/clue fallbacks, permanent-loss rules and surviving group passage. Check every site with empty ammunition, no charge and no available companion.
5. **Destruction and presentation pass:** finish camera frames, breach effects, human identities and sound; then blind-playtest discovery and tune danger. Add an outdoor follow-up only if the ending needs it.

The original-map baseline, first rescue, and five-rescue portion are now implemented. The hidden cover, physical duct, meadow and live native passage look-back are also implemented; the doorway retains a fixed interior perspective. Intake remains available as the earlier comparison level. No multiplayer or extra crafting system is part of these stages. The subsequent HUD decision is recorded below.

## What must be proved by play

- A new player finds someone without being told an exit exists; the meadow remains a surprise.
- Two players solve the same prison differently, and can explain the cost of their choice.
- Camera impacts, turret power loss and the breach visibly change actual gameplay geometry or sensing.
- There is a credible route around the hunter, and danger can be attributed to sight or noise.
- All five people can survive; losing one still permits a smaller group to discover the route and escape.
- Clues remain available after the death of the person who would have spoken them.
- The group can traverse the original map, altered doors, breach and final duct without queuing failures deciding the outcome.
- Swinging, shooting, using a key and planting a charge remain readable on desktop and touch.
- Looking back from the meadow preserves the intended visual contrast without reintroducing regular movement stalls.

The original prototype forecast estimated the chance that nobody reaches permanent safety in the next 45 seconds. This campaign changes the rescue progression and hidden-route rules, so its forecast assumptions need a separate decision and validation. Jonathan subsequently chose an authored in-world survival estimate for the native campaign, explicitly distinct from a simulated forecast. The Doom-style HUD starts low and rewards discovery, release and shelter, with penalties for injuries and permanent losses; it adds no numerical tool bonuses. SURVIVAL EST. rises, while its p(DOOM) complement falls. The underlying event is at least one permanent survivor, not all six surviving. No earlier simulation assumptions or statistical accuracy are claimed. A genuine forecasting port remains a separate future task.


## Opening and presentation pass

The normal start now uses a p(DOOM) logo and three skippable panels: machine takeover, five captive experimental subjects, then the rescue mission. Native title/menu and browser lettering use private bitmap-derived Doom assets. Named speaker text distinguishes prisoner dialogue from facility/status messages. The first rescued person says “Follow me. I know a place where we can keep safe.” On arrival: “We’ll be safe here. Find the others and bring them here.” The selected survival estimate has no invented ticking countdown; critical means nobody remains.
