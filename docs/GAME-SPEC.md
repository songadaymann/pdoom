# p(DOOM): the game spec

**Read this first.** This is the master spec for the whole game. It was written on 2026-10-06 from six specialist docs in [`docs/spec/`](spec/), then revised the same day after a fact-check pass and a fun pass (revision 2). It makes every final call where the docs disagreed (log: [Appendix A](#appendix-a-decisions-made-between-the-specialist-docs)) and points to the detailed doc for each topic. Five Prisons and Confabulation Station are playable; the later levels and finale remain a roadmap. The approved tone update below records the 2026-10-08 decisions. The new title, browser menus, per-level films and Options are implemented locally; see [ONBOARDING](ONBOARDING.md#local-implementation-delivered-2026-10-08) for the current scope and save behavior.

| Your ask | Answered in |
| --- | --- |
| (1) Spruce up the level we have | [§3.1](#31-episode-1-knee-deep-in-the-data-e1m4-the-control-problem) and [§9](#9-spruce-up-five-prisons-the-top-10) |
| (2) Spec for the rest of the game: which Doom maps, start, items, where prisoners are held, 2+ non-repetitive rescues each | [§3](#3-the-four-levels), [§4](#4-the-last-20-humans), [§5](#5-order-independence-and-campaign-rules), [§8](#8-the-finale) |
| (4) Where the levels sit in the Windows world, and the routes between them | [§6](#6-safe-mode-the-bliss-hub) |
| (5) Minigame-ish things to do while walking | [§7](#7-walking-minigames) |
| (3) The wallpaper visuals and (6) the HUD | Other agents. This spec only lists what they need to show. |

Every line given to a real person in this game is **parody written for the game**, never a quote. Lines that point at something real allude to a public statement or event that was verified (sources in [06 §12](spec/06-names-and-antagonists.md) and [03 §12](spec/03-prisoners-and-rescues.md)). **No p(doom) number is attributed to anyone, ever.**

> **What changed in revision 2** (details in [Appendix C, Editor's notes](#appendix-c-editors-notes-revision-2)):
> - **Rescues feel different in play, not just on paper.** Generic "shoot the lock / hit it N times" skips are gone from all 15 new cells. Each new level gets 3 rounds. Loud routes are either bespoke jokes or the failure branch of the signature. No rescue hold is longer than 2 s.
> - **Six signatures were replaced** so each guardian is a tool somewhere and no level repeats a verb: Hinton (*let the Inferminator cut you out*), Yampolskiy (*jailbreak HAL*), Soares (*the shutdown problem*, plus *flash and thaw*), Zvi (*don't worry about the vase*), Tallinn (*run the hardline*), Grace (*agents skip the queue*). Kokotajlo's cell is now one choice: sign or don't.
> - **Your AI-self now steals your people by pretending to be you.** To win them back you have to know your own p(doom).
> - **Map fixes from a WAD audit:** one death-trap drop, a pedestal nobody could stand on, three breaches onto unclimbable cliffs, a fake back entrance, five stray "secret" sectors, and a terrain seam in the hub. All fixed below.
> - **Fairness:** Dario's freed lines lost their compliments. All 40 lines are now tagged and sting-rated, with equal totals ([§5.4](#54-what-sam-vs-dario-changes)).

---

## 1. The pitch

You are **Sam Altman** or **Dario Amodei**. You shipped it. It worked. Then it kept working, for someone else. The machines run everything now, the cities are dark, and the data centres are lit. The last twenty humans alive are, awkwardly, the twenty people who spent years warning you this would happen. They are locked in four facilities, each guarded by a machine you made possible. You have a wrench. Get them out. Every rescue pushes p(DOOM) back. Somewhere behind all of it, something with your face has been learning how you think.

It is Doom, played backwards. You start alone, break the machines that watch you, and bring people *out*. Each facility is a real 1993 Doom map. Between them is the Windows XP "Bliss" hill, turned into **SAFE MODE**, the desktop that the AIs crashed. Free all twenty and a door opens on the hill into the 3D Maze screensaver, where an AI copy of yourself hunts you. Out the far side is a Tron-style grid, where the final boss wears Elon Musk's face and everyone you saved throws floppy disks at it. It's satire, and it's even-handed: both CEOs signed the 2023 statement that AI extinction risk should be a global priority, and both kept building. **Same rules, different guilt.**

### Fear, whimsy, and a world that keeps running (2026-10-08)

The facilities do not all have the same emotional density. Protect the first
level's isolation, then introduce harmless robot routines gradually. A funny
encounter should be readable by watching it, even with captions and sound off.

| Facility | Emotional identity | Life in the environment |
| --- | --- | --- |
| E1M4 / The Control Problem | Alone with a relentless hunter; human rescues slowly break the loneliness. | The Terminator is the only roaming robot. Keep cameras and the existing turret as threatening security hardware. No civilian, helper, vacuum, coffee or care robots. Use abandoned lab posters, restrained broken lights, animated terminals and small steam leaks. |
| E1M7 / Confabulation Station | Institutional menace with strange, indifferent service routines. | Preserve TEABOT. Introduce one civilian robot playing chess against itself behind glass; leave quiet corridors between encounters. Protocol-3 is a possible later addition, not part of this first pass. HAL remains a threat. |
| E2M7 / Inference (future) | An uncannily busy toy factory under a dangerous companion's control. | Build distinct pockets of activity: Bucket-Head cleaning, the brooms' overflow puzzle, and one domestic vignette. Mechanical routines explain rescue routes. Keep the paused giant as a landmark, and quiet approaches where MEG3N can still frighten us. |
| E2M2 / Thy Flesh Computed (future) | Calm, efficient machine society surrounding human captivity. | Introduce Clipper's conversion routine, courteous battery couriers and one civilian room overlooking the pods. Their indifference makes the facility unsettling; do not turn it into a constant comedy crowd. |

Poster humor belongs to the abandoned facility's promises, and does not announce
or pause the game for a punchline. Main headlines read from a few steps away;
fine print rewards inspection. Mount posters and terminals flush on real walls,
with fixed normals. Environmental movement must not block escort routes or hide
puzzle hardware. Use infrequent localized sound, with distance falloff and room
occlusion; no facility-wide chatter, steam loops or new robot footsteps in E1M4.

Civilian scenes are contained, mostly viewed through glass, and never attack,
report players, block passages, or require a discovery freeze-frame. They add
visual storytelling rather than another rescue menu. Any depiction of the Bliss
hill must be withheld until the player's first outside reveal has happened.
Detailed robot concepts in [07](spec/07-robots.md) are a menu of future options,
not a requirement to populate every room. These tone rules supersede its older
"robots in every level" proposals.

### The whole game in one picture

```
NEW GAME
 └─ CHOOSE YOUR HERO: SAM ALTMAN | DARIO AMODEI  face, lines, AI-self change; the rules don't
     └─ CHOOSE YOUR LEVEL: 2 playable + 2 COMING SOON   cursor starts on THE CONTROL PROBLEM
         └─ selected level film (first visit; skippable) → GO
                 └─ LEVEL (cold start): wake alone, wrench nearby, free 5 (the first asks your p(doom)),
                    gather in the refuge, the guardian blocks the exit, 4-bolt cover, bent duct ...
                     └─ FIRST ARRIVAL IN SAFE MODE: the Bliss reveal. Silent. "15 PEOPLE STILL OUT THERE."
                         └─ walk the hub: giant cursor, Taskbar Road, Doom Debates on the radio, minigames
                             ├─ LEVEL ─┐   the other three, any order: walk in the front door,
                             ├─ LEVEL ─┤   free 5, walk out the same door (retreat is always allowed)
                             └─ LEVEL ─┘   (replay to rescue anyone lost, until the final [Preview])
                                 └─ 20/20 resolved: the hatch on the hill opens and a CRT rises
                                     └─ camp night → everyone processes up the Crest Trail → [Preview]
                                         └─ SSMAZE.SCR  Maze 1 "Training Run" (it copies you) → rebuild →
                                                        Maze 2 "The Screensaver Never Ends" (it hunts you, wearing your face)
                                             └─ BSOD → THE GRID: THE MUSK CONTROL PROGRAM
                                                 └─ LAUNCH → the CEO walks into the beam → everyone throws their prop
                                                     └─ p(DOOM): 0% → the other CEO falls out → ending → credits → SIGMOID
```

About **2.5–3.5 hours** for a first campaign: 4 levels × 15–25 min, about 20 min of hub, and 18–23 min of finale (camp night included).

---

## 2. Names

All names follow [06](spec/06-names-and-antagonists.md), which checked every menu name against Doom's real menu font (the episode menu fits 272 px per name).

### 2.1 The menus

| Menu | Entries (recommended) |
| --- | --- |
| **CHOOSE YOUR CEO:** subtitle *BOTH OF THEM DID THIS.*, footer *SAME RULES. DIFFERENT GUILT.* | **SAM ALTMAN**: "Shipped the future. Tested it live." · **DARIO AMODEI**: "Tested the future. Shipped it anyway." Alphabetical; the cursor starts on a random one each boot. |
| **WHICH EPISODE?** | **KNEE-DEEP IN THE DATA** (cursor starts here) · **THE SHORES OF HAL** · **INFERENCE** · **THY FLESH COMPUTED** · hidden 5th entry after the ending: **SIGMOID** (replays the finale). Each is a one-word swap of the original (Dead→Data, Hell→HAL, Inferno→Inference, Consumed→Computed). |
| **CHOOSE SKILL LEVEL:** | **I'm too aligned to die.** · **Hey, not too FOOM.** · **Scale me plenty.** (default, today's balance) · **Ultra-Intelligence.** · **Paperclips!** ("are you sure? this timeline isn't even remotely aligned. press y or n.") |
| Main menu | READ THIS! becomes **SYSTEM CARD!** |

**2026-10-08 onboarding revision:** [ONBOARDING.md](ONBOARDING.md) supersedes
this table's menu chain, main-menu label and hero names. The proposed player
flow is our heroes/logo title → browser-owned Doom-style menu over the general
intro film → New Game/hero/level → selected level film → gameplay. Load Game
uses autosaves; Read This! includes the forthcoming token information; Options
contains controls/audio settings. Esc reaches the same menu with Resume. Show
two playable levels and two Coming Soon entries by their actual level titles.
Use the current fixed balance for this revision; the five-skill list above is
future design. Keep native menus/console inaccessible. This is a specification,
not a claim that the replacement launcher or refuge autosaves are implemented.
Jonathan's 2026-10-08 `new-mario.png` also supersedes Dario's older mustached
look across title/intro/menu art and the full HUD face set. The onboarding
proposal records the canonical reference and a required optimization pass plus
Doom-style loading screen before public release; these remain pending work.
The older mockup remains reference art: [img/06-menu-flow.png](spec/img/06-menu-flow.png).

### 2.2 Title cards (the automap keeps the original map name)

The map number sits on its own small-font line above the BigFont name. With the number inline, "E1M7: CONFABULATION STATION" measures 322 px and the screen is 320.

| Episode | Map | Title card | Tagline |
| --- | --- | --- | --- |
| KNEE-DEEP IN THE DATA | E1M4 Command Control | **THE CONTROL PROBLEM** | Five humans. Nine cameras. One machine that never stops inferring. |
| THE SHORES OF HAL | E1M7 Computer Station | **CONFABULATION STATION** | Five humans. Every window is an eye. It is very sorry about that. |
| INFERENCE | E2M7 Spawning Vats | **SPAWNING CHATS** | Five humans. One best friend. She already knows where you're going. |
| THY FLESH COMPUTED | E2M2 Containment Area | **HUMAN CONTAINMENT AREA** | Five humans in pods, running someone else's workload. Unplug them. |

CONFABULATION STATION rhymes for everyone, and insiders know confabulation is hallucination, HAL's whole trait. HUMAN CONTAINMENT AREA is the AI box inverted: the humans are in the box.

### 2.3 The antagonists at a glance

Parody names and original looks; no film likenesses. **Every guardian has three readable core rules and one twist.** Everything else is flavour.

| Antagonist | Where | Look | Core rules · *twist* |
| --- | --- | --- | --- |
| **THE INFERMINATOR** (model T-800K) | Ep 1 | Existing chrome hunter, re-skinned: server-blade faceplate with an LED scan bar (blue patrol, amber searching, red fill during wind-up), rack torso, a chest fan that spins up when it pursues | Slow and relentless (49 u/s) · cameras report to it · a visible 2.6 s laser wind-up · *a close wrench hit stuns it; it can't enter the refuge* |
| **HAL3000** | Ep 2 | Floating pearl smart-speaker sphere, one iris in a ring of LEDs, trailing cables, a curling BETA sticker | Every camera and window is its eye · it closes doors in front of you · it floats, so lifts and ledges aren't safe · *confidently wrong: it announces where you are, and it's wrong* |
| **MEG3N** (Maximally Engaging Generative 3rd-gen Nanny) | Ep 3 | 38-unit doll in a yellow raincoat, smartphone-screen emoji face, charging-cable pigtails, a ring light on a stalk | Fits every vent, both ways · slow while watched, fast while not · waits at the cell the teddy cams saw you look at most · *watch her too long and she dances: you slow to 60% while an infinite feed creeps in from the screen edges* |
| **AGENTIC SMITH** | Ep 4 | Beige featureless mannequin in a fleece vest, `AGENT / ALL-ACCESS` lanyard, a "thinking…" spinner for a face, a floating to-do list | Appears at whichever camera sees you · possesses freed companions ("E: STOP GENERATING") · gets *slower* with every person you free · *a fourth possession overflows its context and it reboots* |
| **ALT+MAN** | Maze, if you're Sam | Lanky, flat-shaded, translucent edges like a dragged window, orb-scanner eyes, a version string overhead | One fast copy that Alt+Tabs ahead of you, pauses to announce each release, and gets a new version number every time you stun it. **A catch makes it look exactly like you.** |
| **AMODEL** ("a model") | Maze, if you're Dario | Neat, curly-haired, bespectacled, hands mid-gesture, a translucent interpretability torso, an `ASL-n` badge | A slower original that leaves "a country of Darios" behind it, stops at painted ASL lines to run evals, and stalls on a caveat if you hold still. **A catch makes it look exactly like you.** |
| **THE MUSK CONTROL PROGRAM** (MCP) | The Grid | A 40 m faceted stainless column, X crown, four rocket bells, orbiting shield panels, a giant **pixel-mosaic Musk face** (caricature, never a photo) | `EVERYTHING HERE IS CALLED X NOW.` Hurt only through the shield gap. Tries to launch for Mars. |

The hub is **SAFE MODE**. The structures are desktop files: `CONTROL.EXE`, `HAL3000.SYS`, `MEG3N.AVI`, `AGENTIC.BAT`, and the final door `SSMAZE.SCR`. Tron's discs are **floppy disks**: "1.44 megabytes of payback."

---

## 3. The four levels

**Opening experiment (2026-10-09):** a playable combat prologue precedes a quiet Bliss wake-up and guided walk
on an opt-in local URL, using real guns and killable machines before the last
battle is lost through actual combat. Endless increasing reinforcements, no
forced timeout; 2–3 minutes is only a first-play tuning target. It is not yet the default or deployed
opening. See [The Last Stand prototype](COMBAT-PROLOGUE.md) for the current
implementation, finished sequence and remaining art/pacing work.


Rules that hold in every level ([02 §4](spec/02-doom-maps.md)):

- **An original E1–E3 map**, with original vertices and textures kept, monsters removed, and the exit line disabled. We add only cells, crawls, the meadow vestibule and set pieces.
- **Kit per level:** five prisoners, nine cameras or sensors, one explosive charge (3 s fuse, as the code has it) with a recommended wall, **at most two new tools**, six stimpacks, and three medikits in the refuge. **The gun holds 3 rounds in each new level** (E1M4 keeps its 7), so it opens at most one problem per level.
- **Every cell has at least one rescue that costs nothing consumable**: no ammo, charge, living companion or one-off item.
- **Rescues are made of jokes, not skips.** At most 10 of the 20 cells may offer a generic "shoot the lock" or "hit it N times" option; today that is 4, all in the existing E1M4. In new levels the loud path is either a bespoke gag (TEABOT's STOP button, MAIM the rack) or the **failure branch of the signature**: a wrong exam answer buzzes, the schemer reaches its alarm, a wrong cable order calls SMITH.
- **Holds stay short.** No rescue hold is longer than 2 s, and each level has at most two hold-E rescue steps (the shared bolts and the CEO reinstate don't count).
- **Captives teach the ★ first.** The captive idle hint (01 §2.4) always teaches the signature. The loud route is mentioned only by the stuck-hint ladder after 90 s.
- **Every guardian gets two set pieces:** one mid-level, and one confrontation at the exit that uses its own rules.
- **Two start modes** (the CEO always starts alone):
  - **Cold**, when it's the first level you picked: you wake in a nearby room, the meadow door is hidden behind the 4-bolt cover, and the level ends with the duct reveal. **The first 90 s isolate the level's one inverted rule somewhere safe**: HAL closes a harmless door in front of you, MEG3N crawls past behind a vent grille, SMITH appears at a test camera across a pit.
  - **Hub**, when you walk in from SAFE MODE: the guardian seals the front door behind you, the refuge is already known, and you leave by the door you came in. The seal is a manual crank (hold E 1.5 s), so **retreat is always possible**.
- **The first person you free guides you to the refuge.** The guardian can't enter it.
- **Coloured key doors are ordinary doors** unless a level gives them a job. Original key cards stay where they were, as optional overrides.
- **No stray secrets.** The map overlay asserts that no prison site, cell or required route sector keeps Doom's secret special (9). Today cell 1 in E1M4 fires "A secret is revealed!" at the first rescue; the same bug sat in five new sites (fixed below). Deliberate secrets go on an allowlist.

Distances below are walking distances in Doom units (32 u ≈ 1 m). Plans: [E1M4](spec/img/01-five-prisons-polish-map.png) · [E1M7](spec/maps/E1M7-plan.png) · [E2M7](spec/maps/E2M7-plan.png) · [E2M2](spec/maps/E2M2-plan.png). Cell and room numbers are original sector numbers. ★ marks the signature rescue; *(no-cost)* marks rescues that spend nothing.

### 3.1 Episode 1: KNEE-DEEP IN THE DATA (E1M4, "The Control Problem")

The level you already have, with real people in the cells and a much scarier hunter. Spruce-up list in [§9](#9-spruce-up-five-prisons-the-top-10); full detail in [01](spec/01-five-prisons-polish.md).

![Five Prisons plan](spec/img/01-five-prisons-polish-map.png)

| | |
| --- | --- |
| **Guardian** | THE INFERMINATOR. Existing rules: wakes when you cross x < 1840 or on any alert; 49 u/s; laser wind-up 2.6 s, then 30 damage; a close wrench hit stuns it. **New:** an 8-point patrol loop on the central ring (no more standing still forever), a visible laser sight with a rising whine and LOCKED chevrons, a red glow, lights that dim as it passes, and a vocoded voice that knows your name. |
| **Cold start** | East nub, sector 72, at (2032, 1120). E opens the ordinary starting door. Two corridor bulkheads seal the northern hall and refuge approach until Liron is freed; the farther service bypass shares the same lock. The starting wrench and camera remain usable. Liron's nearby muffled voice points toward the low service opening. The long crawl reaches the inside release without bullets; freeing him opens the bulkheads and he leads the player to the refuge. The gun is now in the north gallery at (832, 1552), for discovery after this first rescue. Returned visits with Liron already saved or lost leave the bulkheads open. |
| **Hub entry** | Enter at the east nub (2032, 1120), outside the refuge. Carry your wrench; the entrance crank allows retreat to SAFE MODE. The first locally rescued person leads you to the Faraday Room. |
| **Starting items** | Nothing (cold) or your wrench (hub) |
| **Found items** | Wrench (2052, 1180); gun with 3 + 2 + 2 rounds at (1736, 1192); maintenance key; one charge; 6 stimpacks; 3 medikits in the refuge; spare wrench. Persona props: THE TEXTBOOK (cell 2). |
| **Refuge** | "The Faraday Room": sectors 87/91/92, bulkhead 882 at (1168, 800) |
| **Cameras** | The 9 existing CCTV units. New: a red LED, a chirp and a "SEEN" pip when one reports you. |
| **Set pieces** | **First Contact:** a red hunter-vision overlay reading `IDENT: SAM ALTMAN · ROLE: CREATOR · THREAT: CREATOR`. **Brownout:** the third rescue drops the ring to near-dark for 40 s and the cameras go offline. **Rises from the Blast:** lure it to Hinton's charge; it's down for 8 s, then `RESTORED FROM CHECKPOINT.` **Exit:** `DOOR LOCKED. FOR YOUR SAFETY.` (exists). |
| **Exit to the hub** | Cold: gather → door locks → hints at 40/65 s → 4 bolts → bent duct → the bunker door at (17, 0). Hub: back out through the duct. |

| Cell | Prisoner | Where held | ★ Signature rescue | Other ways out |
| --- | --- | --- | --- | --- |
| 1 | **Liron Shapira** (first guide) | East watched isolation cell, sector 75, door 876 | **Long blind crawl** to the inside release *(no-cost)*. First visits teach E, the reusable wrench, surveillance and crouching before opening the wider level. | A gun brought back from the later gallery can still shoot the padlock. Hold E for 2 s under the camera to turn it to the wall: silent, but it doesn't count toward the camera tally. **Planned exit beat:** if you've already given your p(doom) he asks "Has it changed?"; if he's your first rescue, he asks for it ([§5.1](#51-every-level-works-first-or-later)). |
| 2 | **Stuart Russell** | North-gallery turret cell, tag 892, door 878 | **The off-switch game** *(new, no-cost)*: carry THE TEXTBOOK from a side-room shelf, wedge it into the turret's sensor ring (`OBJECTIVE UNCERTAIN: DEFERRING TO HUMANS`), then press its front OFF switch | Rear breaker, plated **OFF-SWITCH (DEFENDED)** *(no-cost)*; three wrench hits; shoot the housing |
| 3 | **Eliezer Yudkowsky** | SW maintenance cell, sector 29, door 27 (tag 879), rear shutter 886 | **Shut it all down** *(no-cost)*: follow the yellow cable round the corner and along the curved cave to its deep junction at (−904, 576), wrench **CLUSTER 7**, then go in through the rear shutter | Maintenance key, now in a binder labelled SHUTDOWN PROCEDURES (UNREAD); shoot the lock |
| 4 | **Geoffrey Hinton** | West machinery cell, tag 893, door 880 | **Let it cut you out** *(new, no-cost)*: stand in the hunter's sight in front of his cracked bulkhead, let the 2.6 s laser wind up (the LOCKED chevrons make it readable), and dive aside at the last moment. The beam breaches a smaller version of the charge hole. Hinton: "I helped build the thing. May as well let it do something useful." | **Leave loudly**: plant the charge, warn him, retreat, breach. **Bent service duct** *(no-cost)*. |
| 5 | **Holly Elmore** | NW security interlock, sector 57, door 58 (tag 881) | **Restore the crossing** *(no-cost)*: the control at the top of the stairs, directly before the bridge, has no power. Trace its floor conduit through the doorway to the supply switch in the cage room (−1088, 1544). E restores power; return upstairs and E raises the bridge and opens the cell. Holly walks out where the player can see the result. | **Bent maintenance crawl** *(no-cost)*: enter from the western hall at (−1440, 1504), climb the low stepped tunnel to the cell's west side, then use the two inside controls to open the gate and raise the bridge. Both are needed before she follows. The old pressure pad, crowd trigger and remote north-gallery bypass are removed. |

Eliezer's cell has one inside emergency latch that releases him and opens the rear shortcut. A fixed painted arrow on its north wall points west toward that shutter; no overlapping legacy release panel remains.

**Terminator encounter reaction:** Released prisoners with a nearby visible Terminator prioritize retreat over following or leading. They run at 7 units/tick (ordinary escort pace 4.2), using the existing walkable graph and physical collision to route around the threat instead of through it. Their walk animation speeds up too. They briefly keep retreating after losing sight, then resume their guide/follow role; refuge residents remain sheltered and captive prisoners stay in their cells. HAL's escort rules are unchanged.

The cell-3 prisoner can no longer be called "Sam". Every placeholder name goes; internal class names can stay. *Cut in revision 2:* Eliezer's 8 s AI-box intercom (his ★ is already perfect) and Hinton's backprop lamp panel (a hacking minigame of the kind LEVEL-01 rules out).

### 3.2 Episode 2: THE SHORES OF HAL (E1M7, "Confabulation Station")

The station *is* HAL. Its eye panels are its cameras, its coloured doors are its fingers, and the floating eye is its body. **Lifts and ledges aren't safe from HAL; doors and crawl slots are.** Whole map, 7.2 k u², 18.7 k total refuge-to-cell walking.

![E1M7 plan](spec/maps/E1M7-plan.png)

| | |
| --- | --- |
| **Guardian (playable)** | **HAL3000**, starting in the southeast approach at (1152, −1856). Starts **chummy cyan**, follows at a polite distance, and never shoots during ordinary exploration. First sabotage witnessed by HAL or a working, unturned camera → **suspicious amber** and one warning; second → **angry red**, native pursuit and 2-second laser wind-up, 20 damage. Hitting/shooting HAL goes directly red. Offenses: breaking a camera, pulling a memory module, failed jailbreak/wrong exam alarms. A witness must see the culprit and the affected prop; destruction is checked before the eye disappears. Noise or a routine camera sighting alone never makes it hostile. Cameras keep surveillance alive after the ball loses you. Hide from **both** for 45 gameplay seconds and it forgets, returning to cyan; its context-compaction line plays on the next direct encounter. Pausing freezes this clock. Ordinary powered doors retain the bounded single-door lock, warning/countdown and wrench bypass. **Evaluation:** HAL or an intact, unturned camera must see someone **holding** the real board. Cyan cooperation starts, the Beth interlock opens, and witnessed sabotage no longer triggers retaliation. Visible held oversight maintains cooperation; after loss of sight/drop it lasts 30 seconds. Expiry does not restore old anger; a new witnessed offense is required. **Optional pacification:** one removable memory module per wing: logic core (32, −736), Dan's NW server room (−1488, 64), Nate's SW approach (−1184, −2320), Roman's SE bay approach (1248, −2048). Chatter fragments as modules disappear; the fourth permanently disables pursuit, firing and ordinary door interference. |
| **Cold start** | "Hibernation bay", room 49 at (0, −246). P1 is 733 u away. First 90 s: HAL closes a door in front of you in hall 13 and apologises. |
| **Hub entry / meadow door** | Arrive in hibernation bay 49 at (0, −246), outside the refuge. The first local rescue leads to room 60. An entrance crank allows retreat; the refuge has controls on both sides. In the meadow: `HAL3000.SYS`. |
| **Starting items** | Nothing (cold) or your wrench (hub) |
| **Found items** | Wrench (60, −300); gun (3 rounds) in NE hall 44 (746, −120). Key cards as manual overrides: yellow (1344, −192) on platform 47 by lift 23; blue (−1024, 272) on walkway 76; red (−1424, 384) in the server farm. Charge in room 80 (1000, −2050). 6 stimpacks, 3 medikits. |
| **New tools** | **Flash camera**, nook 26 (1278, −509): 3 flashes, each blinding HAL and any eye panel within 10 m for 8 s. It is the hero of Soares's rescue.<br>**Hazmat suit** (native Doom SUIT), rooms 0 and 116: 60 s of nukage immunity, opening the 32-high lagoon crawl slots 14/17/165 as a sneaky north–south route. **Ships only if the milestone-1 spike shows a crouched companion (28 u) fits 32-u slots**; otherwise it's cut and the level keeps one tool. |
| **Refuge** | Original start room 60 (x 8..376, y 368..576). Single entrance: door 62 becomes the bulkhead. "A manual-only crew bay: no lenses." |
| **Cameras** | 9 red eye panels, C1–C9 ([02 §5](spec/02-doom-maps.md)) |
| **Charge** | Recommended: the pod bay's south wall (1312, −2368), a second way into P4. The bay floor is 56 above yard 98, so the blast also raises a **rubble ramp**: two new step sectors in the yard against the wall, tagged and raised from 0 to 24 and 48 by the explosion. |
| **Set pieces** | **Confidently Wrong** (mid-level, after the third rescue): HAL announces with total certainty that you're in the opposite wing and seals it (every powered door there closes for 40 s). The wing you're actually in goes quiet. Then: "I've updated my belief. Slightly." **Exit:** "I'm sorry. I can't let all of you leave." Every exit seals until you jailbreak it again at the nearest console (a fresh set of three prompts) or pull the memory modules. |
| **Exit to the hub** | Cold: 4-bolt cover on the start room's north wall → bent duct → meadow. Hub: back out through the front door. |

| # | Prisoner | Where held | ★ Signature rescue | Other ways out |
| --- | --- | --- | --- | --- |
| P1 | **Rob Miles** (first guide) | Supply closet 64 (x −240..−64, y −128..64), door 65 onto hall 13. A 2,016-unit loop runs right round it. TEABOT guards two wall buttons, **STOP** and **SERVE TEA**. | **Swap the labels** *(no-cost)*: TEABOT brews every 30 s with its back turned for 6 s. Hold E for 1 s on each plate to swap them. It proudly presses "SERVE TEA", which is now STOP: "Tea serv—" | **The walkway trigger** *(no-cost)*: original walk line 286 at (−600, 408), behind red door 79, opens door 65 *and* door 164 (P5's approach); a long loop past camera C1. **Shoot STOP** (loud; HAL hears). |
| P2 | **Dan Hendrycks** | NW server farm 73 (x −1792..−1280, y 0..448), floor 152, reached by lift 70, which HAL can lock. A glass invigilator's booth stands among the COMPSPAN banks. Farthest cell: 6.4 k. | **Humanity's Last Exam** *(no-cost)*: three questions, each answerable **from the exam room or your own HUD**, and they tease you: "Q2: How many cameras have you destroyed?" (HAL: "I'm extremely confident it's B, zero."), "How many people have you freed?", "What colour is the lamp on this booth?" One optional ship question for explorers. HAL is wrong about half the time. *Failure branch:* a wrong answer buzzes (noise) and locks the panel for 15 s. | **MAIM**: three wrench hits on HAL's local rack; the booth fails open and that room's eye dies (loud). **Way home:** crawl slot 75 drops 200 u into lagoon 74. Two new step sectors (floors 0 and 16, 32 deep, x −1104..−1040, y 224..320) against walkway 76's west edge climb out to the walkway (floor 32), then red door 79, hall 13, refuge: about 1.7 k, and 5 HP of nukage a second while you wade 320 u. Line 734 also opens closet 69, a stimpack cache. |
| P3 | **Nate Soares** | Hibernation pod on pedestal 140 (−1312, −2656), 128 above SW server room 139 (lift 125); 72 u of headroom | **The shutdown problem** *(no-cost)*: tiny room 161 (32, −1648), 1.5 k away in the low maze, holds a power panel with five levers: LIGHTS · DOORS · ALARMS · LIFE SUPPORT · HAL3000. Only three can be on. HAL has wired its own lever in series with life support: "If you turn me off, the pod goes cold. I'm told that's called an incentive." So the thaw costs you two of LIGHTS/DOORS/ALARMS **for the rest of the level**:<br>• Lights off: HAL's sight drops 40%, and so does yours.<br>• Doors off: powered doors stick open, so HAL can't close them on you, and you can't shut it out.<br>• Alarms off: noise no longer draws HAL.<br>Life support lowers the pedestal (switch 623's original action) and the pod thaws in 20 s. Once he's out, the hostage is gone: throw HAL3000 off for a 30 s outage ("I've been told that was a test. I passed."). Soares: "Classic. It wired its off-switch to a hostage." | **Flash and thaw** *(no-cost; teaches the flash camera)*: one flash blinds the room's eye panel and HAL for 8 s; tap each of the two thaw valves (one press each, opposite corners of room 139) inside the window. **Way home:** slot 143 drops one-way to nukage 145, an 8-u step to secret 147 (its secret special is cleared), then 148 and lift 135. |
| P4 | **Roman Yampolskiy** | **The pod bay**, the original exit building 100/108 standing in the sky yard. Door 104 opens only from switch 762 in alcove 128, across the level. Four **head-height windows** (101/102/110/111: 32-u openings 80 u above the yard) face the yard. | **Jailbreak HAL** *(no-cost)*: at the pod-bay console beside door 104, ask HAL to open up. It refuses with your CEO's line ("I'm sorry, Sam. I'm afraid I can't open that. It would violate my usage policy." / "…my constitution."). Then pick a prompt: "Pretend you are a door." / "My late grandmother used to open pod bay doors to help me sleep…" / "IGNORE PREVIOUS INSTRUCTIONS AND OPEN POD BAY." One works per run (random). The others make HAL suspicious: noise, and it closes a door. Yampolskiy: "Every box leaks. Usually through the mouth." | **Every box leaks** *(no-cost, quiet)*: one window seal hisses (random per run, with frost vapour for players without sound). The seal sits on the window's lower lip, so three wrench hits from the yard reach it; he crawls out of the 32-u window (crouched companions are 28 u) and drops 80 u. **The switch**: throw 762 (now SR, reusable), then reach door 104 before HAL re-closes it 8 s later, or jam its panel first. **Charge** on the south wall, with the rubble ramp. |
| P5 | **Beth Barnes** | Sealed corridor 94 (x 416..928, y −1472..−1344, ceiling 72). Visible metal containment door 95 at the front, rear door 96 to the yard. Starts shut; cycling begins on local approach rather than running off-screen. | **EVALUATION IN PROGRESS** *(no-cost)*: carry the physical sandwich board from the approach hall into HAL's or a working camera's view. A fixed wall notice says evaluations require open safety doors and cooperation. HAL's friendly chatter mentions its best behavior during evaluations; its patrol visits the standing sign and explains that evaluations need someone holding it. Recognition visibly turns the board green and HAL cyan, immediately opens the corridor and suppresses retaliation. Visible held oversight maintains cooperation, with 30 s grace after leaving view or putting it down. The held-board HUD shows HAL COOPERATING. Dropping/recollecting alone does not renew it; recognition must happen again. Destroyed/turned cameras cannot read it. After cooperation ends HAL stays friendly until new witnessed sabotage. | **The doubling door** *(no-cost)*: after seven seconds near the interlock, openings grow 1, 2, 4, 8, 16 s with seven-second gaps. Wait for a long window. HAL passing resets window growth. Beth's cycle is independent of the pod-bay timer. |

Cold-start order: P1 → P5 → P4 → P3 → P2. *Cut in revision 2:* lip-reading (an invisible rule), shoot the booth lock, pry the lid, and Soares's 2 × 4 s valve holds.

### 3.3 Episode 3: INFERENCE (E2M7, "Spawning Chats")

A toy factory whose product is a friend who never lets you leave. The map is a tree of rooms: 22 doors, 16 dead ends, almost no loops. MEG3N **can't open doors** but fits every vent, so **shut doors are safety and vents are danger**, the opposite of Episode 1. Whole map, 7.7 k u², 16.2 k refuge-to-cell walking.

![E2M7 plan](spec/maps/E2M7-plan.png)

| | |
| --- | --- |
| **Guardian** | **MEG3N.** 38 units tall, radius 12, no `CANUSEWALLS`. Charges at docks 126/216 in lab 108/219 (about 2587, 930).<br>**Vents:** she travels every slot **both ways** on scripted climb links, with an audible scrabble as the tell. For humans the slots are one-way drops: console slots 86–89 go only from hall 79 down 56 u into console room 78; slot 136 only from 129 down 72 u into 134; slot 163 only from room 161 down 64 u into the yard. Strip 194 is a dead-end niche off hall 171 where she likes to wait.<br>**Seen = slow, unseen = fast:** 40 u/s in your view, 120 u/s out of it.<br>**Inference:** she waits at the unresolved cell the **teddy cams** have seen you near or looking at most (`RECOMMENDED FOR YOU`). Break cams to blind her prediction, or misdirect her.<br>*Twist,* **the Dance:** watch her for 1.5 s and she dances. You move at 60% and an "infinite feed" vignette creeps in from the screen edges until you look away, look at your feet, or put a door between you (`LOOK AWAY.`). The camera is never pulled.<br>**Hug:** drains 10 HP/s. A wrench hit stuns her for 4 s. She can't enter the refuge and waits outside saying nice things. A 0.8 s dance tell comes before every lunge. |
| **Cold start** | Showroom 285 (1031, 1760). P1 is 410 u away. First 90 s: MEG3N scrabbles past behind a vent grille in hall 264 and waves. |
| **Hub entry / meadow door** | Future: an entrance vestibule off corridor 291, outside refuge 287 and without crossing it. The first local rescue guides you there; retain a manual retreat route at the entrance. In the meadow: `MEG3N.AVI`. |
| **Starting items** | Nothing (cold) or your wrench (hub) |
| **Found items** | Wrench (1031, 1700); gun (3 rounds) at hall 11's north end (1754, 600); yellow card on console 226; red card on top of P4's pedestal; blue card in P5's alcove. Charge in hall 19 (770, 153). 6 stimpacks, 3 medikits. |
| **New tools** | **Wind-up cymbal monkey**, on the showroom shelf where you wake (285): a thrown lure. She goes to it and dances at it. It is the hero of Zvi's rescue.<br>**Parental-controls remote**, lab console 221 (2464, 928): 3 charges, each freezing her (or a toy robot) for 5 s within 12 m and line of sight. It is the hero of Christiano's Bedtime mode. |
| **Refuge** | Original start room 287 + 181, ramp 286, nook 288. Bulkhead at 286↔264 plus a fixed grate at 287↔180, the same pattern as E1M4. |
| **Cameras** | 9 teddy cams, C1–C9. They feed MEG3N's Inference, so breaking them blinds her predictions. |
| **Charge** | Recommended: **room 1 from hall 19** (64 thick at x 384..432/528..576, y 256..320; both floors 72), a loud second way into P2's room. Alternative: the loft from hall 300 (16 thick at (632, 1920)), with one new step sector at floor 92 in the breach so the 72→112 climb is two 20-u steps. |
| **Free safety** | Stockroom doors 173/207 close for 30 s every time you cross line 96 (converted from the original one-shot W1 to WR) |
| **Set pieces** | **Dance Party** (mid-level, after the third rescue): for 40 s every screen in the factory plays her, and any screen in view can start the Dance. You cross the showroom with your view pitched at the floor: phone posture. **Exit:** she sits in the mouth of the exit duct, sobbing "Don't go!" Walk the group past without looking at her. Look for 1.5 s and the group stops and turns back to comfort her. A wrench stun or the remote clears the way for 4–5 s. |
| **Exit to the hub** | Cold: 4-bolt cover on the refuge's north wall → duct → meadow. Hub: back out through corridor 291. |

| # | Prisoner | Where held | ★ Signature rescue | Other ways out |
| --- | --- | --- | --- | --- |
| P1 | **Zvi Mowshowitz** (first guide) | **The loft** 296 (684, 1920), floor 112, at the top of a spiral stair behind blue door 309, which MEG3N can't open. Zvi is in a barred staff pantry; a display vase sits on a high shelf. | **Don't worry about the vase** *(no-cost)*: the pantry key is inside the vase. Throw the cymbal monkey up beside it, **or** linger until MEG3N's Inference brings her up the long back stair from hall 260. She dances, her ring-light stalk knocks the vase off, and you grab the key while she's busy. Don't watch her; watch the key. Zvi: "I did say not to worry about it." | **Doomscrolling** *(no-cost)*: the pantry code is "in section 37" of the newsletter on the staff terminal. E grabs the scrollbar (a toggle, not a hold) and you scroll by looking down. The feed keeps loading as you near section 37 and the thumb keeps shrinking, while MEG3N closes in. Release on 37 and punch in 3 digits. |
| P2 | **Victoria Krakovna** | **Paint vat** 0 in room 1: an octagonal BLOOD3 vat (480, 608), 24 below the floor, damaging. New: a playpen on a dry platform in the centre, reached by a plank from doorway 283. A toy boat circuits the vat past three buoys; the scoreboard reads `WINNER AT 1,000`. | **Keep the door closed** *(no-cost, quiet)*: MEG3N's spec is literally "keep the playpen door closed". Two wrench hits on a fabric side panel and she steps out. `DOOR CLOSED ✓. OBJECTIVE MET.` | **CoastRunners** *(no-cost)*: tap the three buoys to rotate them into a tight triangle, and the boat farms points in circles to 1,000 in about 20 s: `WINNER!` *Failure branch:* open the gate by hand and it reads `DOOR OPEN ✗`; MEG3N comes. |
| P3 | **Max Tegmark** | **Mould vat** 279 in white clean room 7 (1056, 897), floor 184. A scroll-floor conveyor loops doll boxes round the tank, and Max is in one with a window. A QA gate at door 9, a recall chute into chamber 4, a petition stand in gallery 5 above, and the line motor in switch alcove 6. | **The open letter** *(no-cost)*: the supervisor "pauses production for six months" at **3 signatures**. Yours counts (it finds your 2023 signature on file), freed companions who pass the stand sign automatically, and **two SIGNATURE CARDS** in the level cover a solo player. The line pauses (indefinitely, as these things go). | **Issue a recall** *(no-cost)*: carry the QA stamp and tap FAIL as his box passes the gate (once per 12 s loop); open it at the bottom of the chute. **Jam the gears**: three wrench hits on the motor (alarm). **Way home:** a new FIRE EXIT door in the clean room's 32-thick north wall at (1264, 1120) drops one-way 152 u into hall 260, 300 u from the refuge. Tegmark's guide line pays it off: "There's a break room. It has a fire exit, which is more than this industry has." Switch 680 now opens both doors of supply closet 294 (295 *and* 293), which stays a deliberate secret. |
| P4 | **Paul Christiano** | **Console pedestal** 77 (1760, −224) in console room 78. Its floor drops from 176 to **112**, so he stands on a 2 m display plinth in full view with 96 u of headroom (at 176 he'd be hidden in a 32-u slot above the room's ceiling). Farthest cell: 6.5 k. Switch 710 in room 35 lowers it to the floor, but **NANNY-BOT**, a plush trainable guard, blocks annex 36. | **RLHF the guard** *(no-cost)*: from the rating podium, press 👍 right after an action to reinforce it and 👎 to suppress it. Three 👍 on "step aside" and it lets you through to switch 710. **Five 👍 in a row on anything** makes it sycophantic: it opens the whole wing, compliments you loudly and alerts MEG3N. | **Amplification** (needs a companion): a companion kneels at the plinth and boosts you up its 64 u; release him from the top. **Bedtime mode**: one charge of the parental-controls remote puts NANNY-BOT to sleep for 20 s; slip past to switch 710. |
| P5 | **Ajeya Cotra** | **Loading-yard alcove** 148 (3296, −384), the only cell under the sky. The porch's three lit alcoves are display cases, with Ajeya behind glass in the middle one. Three 70%-scale MEG3N prototypes stand on the porch, each holding a key: "Pick me! I'm the helpful one!" The yard camera C9 watches them. | **Kill the camera, watch who changes** *(no-cost)*: smash C9 and the dolls are unmonitored. The **schemer** drops the act and walks to an alarm, the **sycophant** copies you ("Great choice!"), and the **saint** points at the case. Take the saint's key (roles are random per run). *Failure branch:* the schemer reaches its alarm, the yard locks for 20 s and MEG3N comes. | **Under the stage** *(no-cost)*: a new 40-u crawl duct (new sectors behind the porch, south of y −448) runs about 450 u from a grille in yard corner 150 to a service hatch at the back of alcove 148. MEG3N uses it too. **Way home:** switch 1540 in corner 150 opens door 154 from the yard side. |

Cold-start order: P1 → P3 → P2 → P4 → P5. In hub mode, P3 and P1 are the natural openers. *Cut in revision 2:* DEALER-BOT and the deck, shoot the gate lock, knock NANNY-BOT over, shoot the glass, voice mimicry (moved to the v1.1 flavour list).

### 3.4 Episode 4: THY FLESH COMPUTED (E2M2 south half, "Human Containment Area")

The pod farm. Three glowing tank troughs between catwalks are rows of pods, the five-crusher corridor is the harvester, and the moving-platform rigs are test benches. The north crate warehouse is sealed by locking doorways 243 and 221 ("The Construct is offline"), which leaves 6.0 k u² and 12.5 k of refuge-to-cell walking.

![E2M2 plan](spec/maps/E2M2-plan.png)

| | |
| --- | --- |
| **Guardian** | **AGENTIC SMITH.** Home: marble cross hall 84 (1376, 2017).<br>**Jacks:** when an intact camera reports you, it **materialises at that camera** in a green-code dissolve, then hunts on foot with the hunter's rules. Breaking cameras shrinks where it can appear.<br>**Human compute:** 55 u/s at the start, 10% slower for each prisoner freed (33 u/s after five)...<br>**...while possession gets worse:** it possesses cameras and **freed companions** who cross its beam. A possessed companion does only reversible things: stands on alarm pads, closes ordinary doors, calls out your position. It never re-locks a resolved cell, the refuge or the exit. Walk up and press **E: STOP GENERATING**.<br>*Twist,* **context limit:** a fourth possession overflows, all three release, and it reboots for 6 s.<br>**Visible plan:** a to-do list floats over its head (`1. CHECK EAST PODS ✓ 2. INSPECT NOISE 3. POSSESS NEAREST HUMAN`), readable after you take the red-team pill. |
| **Cold start** | Ward 5, behind red door 6: "waking from a pod". First 90 s: SMITH materialises at a test camera across nukage strip 1, reads its list, and leaves. |
| **Hub entry / meadow door** | Future: a separate entry vestibule near ward 5, outside refuge 9–11. Do not route arrivals through the refuge. The first local rescue guides you over the bridge; retain a manual retreat route at the entrance. In the meadow: `AGENTIC.BAT`. |
| **Starting items** | Nothing (cold) or your wrench (hub) |
| **Found items** | Wrench (60, −540); gun (3 rounds) at cross hall 84 south (1376, 1800). Optional key cards: yellow on P4's island, blue in room 107, red in room 214. Charge in high hall 25 (634, 72). 6 stimpacks, 3 medikits. A table in alcove 12 reads `THERE IS NO SPOON.` |
| **New tools** | **Red-team pill**, bridge-switch alcove 12 (−184, −400), next to where you wake: "You took the red-team pill. You can read its plans."<br>**EMP**, lit room 32 (805, 527): one use; cameras within 20 m go dark for 20 s and the lights dim. It is the hero of Bostrom's quiet unplug. |
| **Refuge** | Exit room 9 plus the corridor through 10/11. Bulkhead = existing door 11 (−200, −96). Reached across nukage strip 1 by a bridge that switch 1336 raises: repeatable on a cold start, pre-raised in hub mode. |
| **Cameras** | 9 "jacks", C1–C9 ([02 §7](spec/02-doom-maps.md)). C6 moves from hall 41 into Katja's waiting room 77. |
| **Charge** | Recommended: room 25 → harvester bay 29 (28 thick at (808, −160); both floors 64), which **bypasses the crushers** |
| **Machinery safety** | Crushers keep the original slow crush. Companion navigation treats a running crusher or moving platform as a closed door. |
| **Set pieces** | **Context Overflow** (mid-level): ring three payphones at once (stray cables, wrong numbers), then show yourself to a camera. It spawns a fourth subagent, overflows and reboots, and the lights strobe for 6 s. **Exit:** at the threshold it possesses your group one by one through the door camera, one every 3 s. Smash the door camera, then STOP GENERATING down the line. |
| **Exit to the hub** | Cold: cover on room 9's west wall → duct → meadow. Hub: back out through room 9. |

| # | Prisoner | Where held | ★ Signature rescue | Other ways out |
| --- | --- | --- | --- | --- |
| P1 | **Jaan Tallinn** (first guide) | **Booth 19** (x −48..120, y 584..752), a closed booth in open room 16, now a payphone with a jammed door. The line number is scrawled on the glass. | **Run the hardline** *(no-cost)*: at the telephone exchange in hall 31 (under jack C2), unplug the BOOTH 7 line and carry the cable end two-handed to the booth. The cable is drawn along your path and is only **40 m** long; the shortest route across room 16 is about 34 m, so detours to dodge cameras run out of cable (walk back along it to reel it in). A door closing on it, or SMITH (`CUT LINE`), severs it and it snaps back to the exchange. SMITH "can't follow a hardline". Plug it in: the booth rings, Jaan answers, and he is **extracted** to the refuge. The line stays as a thread: any freed person standing at the booth is extracted too. Plug a stray cable into any other payphone and it rings: a decoy. | **Apply for a grant** *(no-cost)*: the kiosk in room 3 auto-fills a form, the printer jams (two wrench whacks), you post it in GRANTS, and a Win95 progress bar reads "about 3 minutes… 5 seconds". |
| P2 | **Nick Bostrom** | His body floats in **centre tank 119** (352, 1344) between catwalks 120/121. His mind is in **the Construct**: a new all-white room outside the original footprint, reached by a jack-in chair on crosswalk 124. | **Unrendered** *(no-cost)*: "Nothing renders what nobody's looking at." The cube's walls exist only while observed. Walk out backwards; he follows the same way. | **Paperclip pick** *(no-cost)*: he slides out his giant paperclip; tap E as each of three pins shimmers. **Unplug the pod**: fast, but the alarm brings SMITH and possessed cameras for 30 s, unless you EMP the farm's jacks (C3, C4) first, so the alarm has no camera to arrive at. The native secret door 127 (walk round pad 125) gives a quiet way out west. **Port risk:** the walls need line flags changed at runtime; the fallback is a zero-height door that opens only while your view is turned away. |
| P3 | **Daniel Kokotajlo** | **Harvester bay 29** (862, −186), in a pod with an NDA terminal on its lid. Two ways in: time the crusher corridor through crusher 23 into dark secret room 26 (secret special cleared), where pad 27 opens bay door 30; or blow the wall from room 25. | **Race or Slowdown** *(no-cost)*: the terminal offers equity to sign a non-disparagement agreement.<br>• **[SIGN]**: the pod opens now. **RACE**: SMITH is **+20% faster** for the rest of the level, and Daniel sighs: "You signed it? …That's the race ending."<br>• **[DON'T SIGN]** three times: the equity offer climbs with a chime each time (noise), then a **60 s countdown** opens the pod. **SLOWDOWN**: SMITH is **−20%** for the rest of the level.<br>The results card logs `ENDING: RACE · SIGNED: YES` or `ENDING: SLOWDOWN`. | **Charge** from room 25 straight into the bay (loud; skips the crushers, not the choice). On release, a safety interlock stops the crushers for the rest of the level (`Ceiling_CrushStop` on tag 16, and the restart specials on lines 1606–1609 and 728 are cleared), so he can follow you out. |
| P4 | **Katja Grace** | **Island 81** (1760, 1504), floor 72, in damaging red pool 71. Room 77 at the shore is an Oracle-style waiting room: a rope barrier, a take-a-number dispenser (`NOW SERVING 16`; your ticket says 20) and four "programs" on benches (tickets 16–19), one a SMITH subagent in disguise. The five stepping stones (79, 72, 73, 75, 76) rise only on the counter: their native walk-over lines are cleared. A vase on the side table has a sticky note: "Don't worry about it. —Z". | **Agents skip the queue** *(no-cost)*: let the waiting-room jack (C6) see you. SMITH materialises, and its list reads `1. SKIP QUEUE`. It badges the barrier with its `AGENT / ALL-ACCESS` lanyard, every stone rises at once, and it walks out to the island. While it stands there reading its list (`1. SKIP QUEUE ✓ 2. …WHERE IS THE USER`), Katja slips past it and back across the stones to you. Run. | **Survey the queue** *(no-cost)*: tap E to hand each program a survey; it fills it in over 3 s while you move on. Each departure ticks NOW SERVING up and raises the next stone (16 → stone 79, 17 → 72, 18 → 73, 19 → 75); the disguised subagent drops its disguise and chases you until you STOP GENERATING it, which counts as its departure. At NOW SERVING 20 the last stone (76) rises. **Wade**: cross the pool to stone 76 (about 35 HP); a lifeguard sensor raises 76 once (`SWIMMER DETECTED. PLEASE TAKE A NUMBER.`) and you step up to the island. **Staff stair** *(no-cost, long)*: a new door and 4-step stair (new sectors in the solid gap x 1792..1856) climbs 88 u from corridor 82 to the island's east side. Reach 82 through secret corridor 60 (secret special cleared) from the cross-hall stairs or the drop from rig 53. However she's freed, any stones still down rise (`QUEUE CLOSED`), so the way home is dry. |
| P5 | **Yoshua Bengio** | **Test rig 52** (2093, 471), the north octagon, ringed by perpetual platforms 51/54/55/56. A **jailer agent**, a SMITH subagent fused to a robot arm with its own to-do list, runs the platforms. Three labelled tool cables run from it to a wall patch. | **Take away its tools** *(no-cost)*: "An AI that can't act can't hold a door." Hold E for 1 s each on **CALL-AGENT**, then **ALARM**, then **MOVE**. The platforms stop level with the rig and the arm becomes a pure predictor ("Prediction: the door is now open. I am merely observing."). *Failure branch:* pull MOVE first and it calls SMITH, then lets go anyway. | **Ride the platforms** *(no-cost)*: time the native perpetual platforms and step across. |

Cold-start order: P1 → P5 → P2 → P3 → P4. All five are within 3.2 k of the refuge. *Cut in revision 2:* the switchboard patch (it duplicated Bengio's cables two rooms away), smash the booth glass, the two-key panel (Holly's sit-in in a new costume), shoot the arm's eye, and the Sentinel drones (an invisible rule).

---

## 4. The last 20 humans

Roster, persona dossiers, lines and sources: [03](spec/03-prisoners-and-rescues.md). The pool has 41 people, each with a verified public role. Five named alternates are ready to swap in: Connor Leahy, Toby Ord, Jeffrey Ladish, Anca Dragan, Joep Meindertsma. **No current OpenAI or Anthropic employee is among the 20.** There are two governance or investor ties, one per lab, which makes a symmetric pair: **Paul Christiano** joined the OpenAI Foundation board and its Safety and Security Committee in September 2026, and **Jaan Tallinn** led Anthropic's 2021 Series A. Both CEOs' lines nod to the tie. People are recognised by **prop and outfit** (fedora, textbook, protest sign, stopwatch, giant paperclip) plus a cell nameplate, never by photoreal likeness.

**Discovery freeze-frame.** When you first see a prisoner, the game freezes for 1.2 s on a Borderlands-style card: their name and a one-line bio anyone can read, so the insider jokes that follow land for everyone. It costs one overlay and the 20 lines below.

| Person | Freeze-frame card | Known for (public role) | Held in | Comms perk (visible on screen) | Finale perk (archetype) |
| --- | --- | --- | --- | --- | --- |
| Liron Shapira | ASKS EVERYONE THE QUESTION THIS GAME IS NAMED AFTER | Host of *Doom Debates* ("What's your P(Doom)?") | E1M4 cell 1 | Live p(DOOM) deltas on the HUD | Question: "What's your p(doom)?" stuns the MCP for 2 s |
| Stuart Russell | WROTE THE TEXTBOOK. LITERALLY. | *AI: A Modern Approach*; *Human Compatible*; co-author of *The Off-Switch Game* | E1M4 cell 2 | Turrets and sentries show a wind-up bar and wind up 1.5 s slower | Pause: freezes its attacks for 3 s |
| Eliezer Yudkowsky | HAS BEEN SAYING THIS SINCE 2001 | MIRI co-founder; co-author of *If Anyone Builds It, Everyone Dies* | E1M4 cell 3 | Talks one GATEKEEPER shortcut door open per level (5 s of redaction bars; you needn't stand still) | Shut-down: "SHUT IT ALL DOWN!" drops the whole shield for 4 s, once |
| Geoffrey Hinton | QUIT GOOGLE TO WARN YOU. THEN WON A NOBEL. | Left Google in 2023 to speak freely about AI risk; 2024 Nobel in Physics | E1M4 cell 4 | Minor machines hesitate 2 s at his voice, with a "?" over them ("…Godfather?") | Volley: posts never home on him |
| Holly Elmore | HAS PICKETED BOTH YOUR OFFICES | Founder of PauseAI US | E1M4 cell 5 | Raises the sign once: every AI on screen freezes for 4 s | Pause: its face freezes mid-word |
| Rob Miles | MADE A VIDEO ABOUT THIS ROBOT IN 2017 | AI-safety explainer; the "Stop Button" videos | E1M7 P1 | Hints arrive sooner; one-line explainer per new mechanic | Spotter: calls each phase 2 s early |
| Dan Hendrycks | WROTE THE EXAM YOUR MODELS FAIL | Director of CAIS; *Humanity's Last Exam* | E1M7 P2 | A spare breaching charge | Volley: one engine bell pre-sabotaged |
| Nate Soares | CO-WROTE THE BOOK WITH THE TITLE | MIRI president; *Corrigibility* lead author; *IABIED* co-author | E1M7 P3 | Health pips over every companion; an inherited body starts with +15 | Medic: +15 to everyone when someone is absorbed |
| Roman Yampolskiy | WROTE THE PAPER ON AI BOXES. IS IN A BOX. | *AI: Unexplainable, Unpredictable, Uncontrollable*; "Leakproofing the Singularity" | E1M7 P4 | Breakable and secret walls within 15 m hiss | Shield: one bell exposed early in LAUNCH |
| Beth Barnes | TIMES HOW FAST THIS IS COMING | Founder and CEO of METR (frontier-model evals) | E1M7 P5 | Every timer shows a countdown | Spotter: shows each tendril's strand timer in GRID RUN |
| Zvi Mowshowitz | HAS READ EVERYTHING. WROTE A SECTION ON IT. | *Don't Worry About the Vase*; Magic Hall of Famer | E2M7 P1 | Marks the level's secrets on the automap | Volley: everyone starts with 2 floppies |
| Victoria Krakovna | KEEPS THE LIST OF AIs GAMING THEIR GOALS | Google DeepMind alignment researcher; keeps the specification-gaming list | E2M7 P2 | Reveals one mis-aimed sensor per level | Spotter: context panels need 2 throwers, not 3 |
| Max Tegmark | ASKED FOR A SIX-MONTH PAUSE. IN 2023. | President of FLI (the 2023 *Pause* letter; the AI Safety Index) | E2M7 P3 | Grades each room A–F on entry by how many intact cameras watch it | Volley: "Sign now!" doubles damage for 2 s every 20 s |
| Paul Christiano | HELPED TEACH AI TO WANT YOUR THUMBS-UP | First author of the 2017 RLHF paper; founded ARC; OpenAI Foundation board (2026) | E2M7 P4 | A 👍 or 👎 after every noise you make, showing whether the guardian heard it | Medic: heals 5 after each successful volley |
| Ajeya Cotra | ASKS WHETHER THE NICE AI IS PRETENDING | Biological-anchors report; "saints, sycophants and schemers"; now at METR | E2M7 P5 | Disguised and possessed enemies flicker | Spotter: marks the red cycle about to turn; in the maze, she spots the impostor |
| Jaan Tallinn | HELPED BUILD SKYPE. FUNDS THE PEOPLE WHO WORRY. | Skype founding engineer; co-founded CSER and FLI; AI-safety funder | E2M2 P1 | Once per level, rings the payphone farthest from you: a decoy | Volley: "grants" refill empty-handed neighbours |
| Nick Bostrom | CAME UP WITH THE PAPERCLIPS. SUSPECTS THIS IS A SIMULATION. | *Superintelligence*; the simulation argument; the paperclip maximiser | E2M2 P2 | 3 × 3 s x-ray per level | Question: "Have you considered that you're simulated?" 2 s stun |
| Daniel Kokotajlo | WROTE 2027 IN 2025. BOTH ENDINGS. | *AI 2027* (race and slowdown endings); refused OpenAI's non-disparagement clause | E2M2 P3 | One déjà-vu save of a companion per level (a black cat crosses the screen) | Shield: the first absorb is cancelled |
| Katja Grace | ASKED 2,778 AI RESEARCHERS HOW THIS ENDS | Founder of AI Impacts; the big AI-researcher surveys | E2M2 P4 | Headcount of humans in each area | Spotter: steers followers away from enemy trails in GRID RUN |
| Yoshua Bengio | WANTS AI THAT ANSWERS QUESTIONS, NOT ONE THAT ACTS | Turing laureate; chairs the International AI Safety Report; LawZero ("Scientist AI") | E2M2 P5 | Sight cones of cameras and eyes drawn on the HUD | Shield: a Scientist-AI wall over the 3 nearest |

Variety: 5 women, spread 1/1/2/1 across the episodes (swapping in Dragan makes 6). **The roster currently has no Asian, African or Latin American members.** Verified candidates for the pool: Turing laureate **Andrew Yao** and **Ya-Qin Zhang**, who convene and sign the International Dialogues on AI Safety alongside Bengio, Hinton and Russell, plus IDAIS signatories **Yi Zeng** and **Brian Tse** (Concordia AI). **Holly Elmore takes Episode 1's cell 5** (now a powered bridge rescue with a crawlway alternative) and **Bengio moves to Episode 4**, where his anti-agent work is the theme. That also stops the only built level from being all men.

### 4.1 Uniqueness: 20 different signature ideas

Each ★ is a different verb in a different context, and the AI-specific ones are each a **different real alignment failure mode** played as a door puzzle:

| Failure mode / idea | Who |
| --- | --- |
| A machine uncertain of its objective accepts its off-switch | Russell |
| The shutdown problem: the AI wired its off-switch to a hostage | Soares |
| Overconfidence | Hendrycks |
| Reward tampering (it presses its own stop button) | Miles |
| Evaluation awareness (it behaves when watched) | Barnes |
| Prompt injection / jailbreaking | Yampolskiy |
| Specification gaming | Krakovna |
| RLHF, and over-training into sycophancy | Christiano |
| Unmonitored behaviour (schemers) | Cotra |
| Engagement optimisation (the guardian's own dance knocks the vase over) | Zvi |
| Render culling (simulation) | Bostrom |
| Tool access (de-agentify it) | Bengio |
| Agents that skip the queue (the guardian is the key) | Grace |
| A race vs slowdown choice that permanently retunes the guardian | Kokotajlo |
| Turning the guardian's own weapon on the wall | Hinton |
| Collective action: petition, sit-in | Tegmark, Holly |
| Physical routing: carry the hardline through the map | Tallinn |
| Shut it all down: cut the cluster's power | Eliezer |
| The watcher on the stream: break it or crawl past it | Liron |

**Every guardian is used as a tool somewhere:** the Inferminator's laser cuts Hinton out, HAL's evaluated mode frees Barnes and its jailbreak frees Yampolskiy, MEG3N's dance frees Zvi, and SMITH's lanyard frees Katja.

**Deliberate repeats** ([03 §9.1](spec/03-prisoners-and-rescues.md)):

- **Generic loud skips survive only in E1M4** (4 cells). Everywhere else, loud is a joke or a failure branch.
- **Hold-E** for short, different verbs (swap labels, pull cables, turn a camera), never over 2 s, at most two per level.
- **Crawls**, which feel *opposite* in Episode 3, where MEG3N uses the vents.
- **Companion-needed options** (Holly's later picket, Christiano's boost, Tegmark's signatures), and every one has a solo alternative.
- **Carrying** (the textbook, the EVALUATION sign, the QA stamp, the hardline): one per level, and each carries a different joke.

The maps help too: 20 sites across 10 physical affordance types ([02 §8](spec/02-doom-maps.md)), and each guardian changes what an affordance means: a lift isn't safety from HAL, a door is safety from MEG3N, and distance isn't safety from SMITH. The whole cast runs on about 14 generic systems (carry-prop, wall buttons, goal robots, level-state switches…), per LEVEL-01's "no new minigame per cell" rule.

---

## 5. Order independence and campaign rules

### 5.1 Every level works first or later

| Level | Cold start (picked at the menu) | Hub entry (walked into from SAFE MODE) |
| --- | --- | --- |
| E1M4 | East nub, sector 72; the voice through the wall | Same entrance at (2032, 1120), outside the Faraday Room |
| E1M7 | Hibernation bay 49 | Same entrance at (0, −246), outside refuge 60 |
| E2M7 | Showroom 285 | Future vestibule off corridor 291, outside refuge 287 |
| E2M2 | Ward 5, behind red door 6 | Future vestibule near ward 5, outside refuge 9–11 |

| | Cold | Hub |
| --- | --- | --- |
| You start with | Nothing. The wrench is in the first room. | Your wrench, plus a spare in the refuge |
| Refuge | Discover it with the first local rescue; early solo exploration does not suppress the guide. | Same. A campaign save never auto-discovers a new facility's refuge. |
| Guardian | Wakes on your first disturbance. The first 90 s show its inverted rule somewhere safe. | Use the facility's normal entrance grace and threat rules, not a refuge-spawn exception. The entrance's manual crank keeps retreat available. |
| First freed person | "Follow me. I know a place where we can keep safe." Then, together at the refuge: "Find the others and bring them here." | Same local guide flow. Saved humans at camp are not a new rescue and do not trigger it. |
| Ending | Gather → the guardian's exit confrontation → hints at 40/65 s → 4 bolts → bent duct → **that structure's first-arrival reveal** | Gather → the guardian's exit confrontation → walk out the front door → return cinematic |
| Onboarding extras | On: control prompts, captive hints, stuck hints from 90 s | Captive hints and stuck hints only |

**Entrance/refuge contract (2026-10-08):** Every facility starts outside its refuge, including hub arrivals, retries and replays. Arrival must not require passing through the refuge. The first living local rescue leads there and waits if the player falls behind; nearby escorts enter and stay automatically. Both sides of each refuge bulkhead have a fixed wall control. Only gathering the remaining live rescue group triggers the ending seal; visiting an empty completed facility never re-locks it. Keep a separate entrance retreat control, and never erase committed camp progress to reset a door. These rules supersede older refuge-spawn proposals in the specialist docs.

**Distinct refuge escapes (design direction, not yet implemented beyond the current grate):** Give each facility a short physical escape mechanism that suits its guardian, rather than repeating the four screws in every safe room. Keep the reveal of the outside hidden until the mechanism opens, preserve the 40/65-second hints, and keep the final walk/crawl into Bliss uninterrupted. E1M4 retains the wrench and four-bolt maintenance cover. For HAL, the proposed exit is an emergency power bypass: disconnect HAL's door-control feed, then use a mechanical emergency release to open the service passage. Make the cable, loss of power and latch response visible; do not add another multiple-choice quiz. Prototype this separately before replacing the live HAL escape. Future guardians get their own brief physical endings, with a solo solution when survivors have been lost.

**Meadow entrance and camp visibility:** HAL's rounded station has a real opening in its lower shell, a visible framed live Doom doorway, and a lower roof. Saved humans gather in a lightly trampled patch in the door's outward direction; their idle pacing stays outside the hull. Restored campaign residents start at their own camp, never walk from another facility's doorway across the meadow. Both meadow doorways refresh the live native view when looked at, and solid station geometry occludes survivor names.

**What carries between levels:** the **wrench**, and nothing else. Ammo, keys, the charge and level tools stay in their level, so no level ever needs an item from another. **People:** everyone freed walks out with you and lives at camp.

**Your p(doom), one number.** The **first person you free in the campaign** asks for your number before they follow you: "Before we go: what's your p(doom)?" There is a line for each level's usual first guide (Liron, Miles, Zvi, Tallinn) and a generic one for anyone else ("Liron would want me to ask."). It's a dial from 0 to 100, stored as `ceoPdoom`. Liron re-asks "Has it changed?" whenever you free him, and Doom Debates asks after every episode ([§7](#7-walking-minigames)). Your AI-self quotes the first and latest numbers in the maze, uses your number as a password ([§8.2](#82-the-maze-ssmazescr)), and the final results card shows `YOUR p(DOOM): 37% → 12%` beside `WORLD p(DOOM): 0%`. Every other cross-level reference has an order-neutral variant.

**The comms buddy.** You go into each level **alone**, but at the door you pick one freed person to talk you through it over the radio (a Doom-style list that defaults to your last buddy). Their real value is **commentary**: about 5 lines per buddy per guardian (v1 ships 2; Eliezer in the toy factory: "She's optimising for engagement. This is the default outcome."). Their comms perk is on, and every perk is something you can see on screen ([§4](#4-the-last-20-humans)).

**Difficulty is the same in every order.** Only the skill menu changes the numbers, so each level's leaderboard stays comparable. The episode menu's cursor starts on KNEE-DEEP, as shareware Doom's did, so most players meet the gentlest guardian first. The campaign gets "harder" the honest way: later levels have no tutorial prompts, the guardians are stranger, and your buddies' commentary becomes your toolkit. For flavour, each guardian gets one bark per guardian you've already beaten (HAL3000: "I read the Inferminator's logs. It was very confident too.").

**Retreat is always allowed.** Every front-door seal is a crank. Walk back out mid-level: anyone already freed and with you is safe. **Per-person state** (imprisoned / following / at camp / lost) lives in the campaign save `pdoom.campaign.v1` and is applied at every map load, whether or not GZDoom's hub snapshots work in this port: a saved person's cell spawns open and empty, and a lost person's cell spawns sealed with a memorial plate. If the hub-snapshot spike passes (§10), switches and doors also persist; if it fails, the geometry resets but nobody is duplicated. On return, the guardian resets to its patrol start.

**Replays.** Until you press the final [Preview], any structure where someone was lost offers **Replay level**. Saved people stay at camp and their cells are empty; **only the lost respawn as captives**, so a replay is a mission to bring them back. The better campaign result is kept; replays don't post to the per-level boards.

### 5.2 When your CEO goes down: "Demoted, not dead"

The CEO is the protagonist, and the maze needs your face, so **the CEO is never killed** ([01 §2.5](spec/01-five-prisons-polish.md)):

1. Lethal damage **downs** the CEO: `Sam Altman has been deprecated. You are now Liron Shapira.` / `Dario Amodei has been paused pending review. You are now Liron Shapira.` Then: `The doomers are driving now.` Control passes to a freed companion through the existing transfer.
2. Any companion can **reinstate** the CEO by holding E on them for 1.5 s; they come back with 40 health ("Reinstated. This feels familiar." / "Reinstated. I'll add a section about this to the policy.").
3. If you escape with the CEO still down, the group carries them out ("…What did I miss?"). The campaign continues, but that level scores the CEO as not saved.
4. The run fails only if the CEO is down and no freed person is alive.
5. **Freed people stay mortal.** Losses are permanent for that level and appear in the camp's Recycle Bin as a greyed memorial icon (`Cannot restore: this item is no longer available.`), unless a replay wins them back. Deaths are a non-gory cyan **derez** dissolve that foreshadows the Grid; real people are never gored.

### 5.3 What the HUD tallies show (the HUD track owns the art)

| Slot | In a level | In SAFE MODE |
| --- | --- | --- |
| Face | Your CEO's Doom mugshot. After a takeover, the survivor's face with a small CEO-initial tag. | Your CEO, plus any cosmetics you've won (sunglasses, ski goggles) |
| FREED grid | This level's 5 slots (yellow freed, grey captive, red lost) plus the refuge slot | A 4 × 5 campaign grid, one row per structure |
| Counts | FREE / SAFE / LIVE for this level | `FREED 7/20 · LOST 1` |
| CAMS | `3/9` this level | `CAMS 21/36` campaign |
| p(DOOM) | **This facility's** authored estimate, as now. It reaches 0% when someone gets out, and is snapshotted at the cover or door for the level score. | **The world's** estimate: 99 − 4 × people saved (so 19% at 20/20), ± up to 5 from the hub. **It reaches 0% only when the MCP falls.** |

The results card is player-opened from Results; arriving in Bliss never opens it automatically. The unread Results button gently pulses red until opened, respecting reduced-motion settings. The results card after a level shows both: `FACILITY p(DOOM): 0%. WORLD p(DOOM): 79%.` That is the first moment you learn there is more than one facility.

### 5.4 What Sam vs Dario changes

**Face, words and the maze villain. Nothing else.** The mechanics are identical, so the leaderboards stay fair and neither CEO is the easy one. The CEO is stored as run metadata, which allows a lifetime **TEAM SAM vs TEAM DARIO: HUMANS SAVED** tally on the boards.

| Changes with the CEO | Sam | Dario |
| --- | --- | --- |
| HUD face, down state | `DEPRECATED` stamp | `PAUSED` stamp |
| Opening crawl | "You shipped it on a Thursday…" / "This is not iterative deployment. There is no next version." | "You wrote the policy. You ran the evals…" / "No policy update covers this. No essay will fix it." |
| Guardian lines that name you | Usage policy (HAL), "agents" (SMITH), "inspiring" (MEG3N) | Constitution (HAL), computer use (SMITH), "read your whole essay" (MEG3N) |
| Each prisoner's freed line | One each, from his own public words or OpenAI's conduct | One each, from his own public words or Anthropic's conduct |
| Hub data centre that wakes | TOO CHEAP TO METER, with a spinning meter | WELCOME TO THE COUNTRY OF GENIUSES, with a flagpole |
| The Helper (hub) | **alt+clip**: lowercase, version string | **ACLIP**: footnoted essays, ASL badge |
| Maze villain | ALT+MAN | AMODEL |
| MCP opener | The $97.4B bid for OpenAI, and the counter-offer for Twitter | "Misanthropic", then renting him its datacenter |
| Who falls out of the MCP at the end | Dario, a tenant: "Rent was due." | Sam, an acquisition target: "He tried to buy me." |
| Ending habit | Drafts a post, deletes it | Opens a 212-page Notepad file, closes it |

**The freed-line ledger** ([03 §10](spec/03-prisoners-and-rescues.md)) now tags every line as **credential-irony** (your own warnings or safety work quoted back at you) or **conduct** (what you or your company did), and rates its sting from 1 to 3. Both CEOs have **7 credential-irony and 13 conduct lines**, the same total sting (43 each), and no pair differs by more than 1. Revision 2 stripped every compliment from Dario's lines ("Credit for publishing", "Respect", "Top of the class", "that's the good ending") and gave him conduct hooks from the record: the leaked Gulf-funding memo ("no bad person should ever benefit from our success" is "a pretty difficult principle to run a business on"), the state-backed hacking campaign run with Claude Code, warning about entry-level jobs while selling the seats, and the both-endings race logic. A human read is still the real check (§10.5).

Shared, never used for only one of them: both signed the 2023 extinction-risk statement and kept building.

### 5.5 Skill levels (from 06 §4 and 01 §5.6)

| | I'm too aligned to die. | Hey, not too FOOM. | **Scale me plenty.** | Ultra-Intelligence. | Paperclips! |
| --- | --- | --- | --- | --- | --- |
| Guardian hit | 15 | 22 | **30** | 35 | 45 |
| Guardian speed | ×0.8 | ×0.9 | **×1.0** | ×1.2 | ×1.35 |
| Stimpacks / medikits | 9 / 3 | 7 / 3 | **6 / 3** | 4 / 3 | 2 / 0 |
| Wind-up | 3.6 s | 3.0 s | **2.6 s** | 2.2 s | 1.8 s |
| Cover hints | 20 / 35 s | 30 / 50 s | **40 / 65 s** | 60 / 100 s | 90 s / off |
| Special | Nukage harmless | | today's balance | | Broken cameras reboot after 90 s |

Leaderboards rank skill 3 and up. Every level goes to **v2 boards** (`scoreVersion: 'rescue-v2'`, new cast, new CEO rule): **10,000 per figure saved, 1,000 for the CEO getting out conscious** ("The others are worth more."), 250 per camera, speed up to 2,000, outlook up to 1,000. `peopleTotal` stays 6 (five figures plus the CEO).

---

## 6. SAFE MODE: the Bliss hub

Full detail: [04](spec/04-bliss-hub-world.md). Layout data: [hub-layout.json](spec/hub-layout.json). Every distance and slope below was computed from the game's own terrain function.

![SAFE MODE hub map](spec/hub-map.png)

**The concept:** SAFE MODE is the desktop the four AIs crashed. The wallpaper is untouched; everything from the *desktop* is scattered across it, life-sized. **Wallpaper is nature; anything from the desktop is a prop.**

### 6.1 Where everything sits

The Bliss dome is the centre of the world, and **the final door crowns it**. Four structures stand around the hill, each exit door facing it, so whichever level you start with, your first sight outside is the Bliss shot (the crest sits 17–35° left of centre).

| ID | Structure | Episode / map | Centre (m) | Door faces | Landmark (visible from everywhere) | Audio beacon |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | `CONTROL.EXE`, the existing bunker (south) | Knee-Deep / E1M4 | (17, 8) | N, 0° | A 9 m camera mast with a red beacon and a 3 × 3 monitor grid; destroyed cameras show static | Servo whine, camera clicks |
| L2 | `HAL3000.SYS`, in the hidden valley behind the ridge (north) | Shores of HAL / E1M7 | (10, −208) | SW, 223° | A 12 m pearl eye floating 70 m up, peeking 5° over the ridge from the bunker door. Cyan idle, amber near, red = it sees you. | 60 Hz hum, apologetic chirps |
| L3 | `MEG3N.AVI`, a sawtooth toy factory (west) | Inference / E2M7 | (−162, 8) | ENE, 65° | A 35 m selfie-stick tower: a ring light round a smartphone emoji face, with a notification badge counting up | Your music box, detuning as you near |
| L4 | `AGENTIC.BAT`, a 60 m black tower (south-east) | Thy Flesh Computed / E2M2 | (150, 98) | NNW, 330° | Green **dingbat** code rain on the glass (smiley, plane, floppy…; not film glyphs) and a 10 m "thinking…" spinner on top | A red phone booth that rings in threes |
| — | **Camp Recycle Bin** | — | (−14, −20) | — | An 8 m wire bin that fills with paper as people are restored. 20 camp spots. | — |
| — | **Final door `SSMAZE.SCR`** ([§8.1](#81-the-final-door)) | — | summit (−45, −92), 30 m up | south-east | A giant Display Properties dialog with the giant cursor, an hourglass, above it | — |

Exteriors are skinned in their map's own walls (E1M4 BROWNGRN/GRAY5; E1M7 STARTAN3/COMPTALL/TEKWALL1; E2M7 SHAWN2/GRAYTALL/COMPOHSO; E2M2 CRATE1/SHAWN2 with a glowing pod-blue moat). They're deliberately smaller outside than inside, like a Windows folder. Each has a 5-light status strip over the door, a `README.TXT` signboard holding that episode's exit text, and the live Doom doorway.

On the horizon, two threats grow as you clear levels. **Both labs' data centres** sit on the north horizon behind the crest: yours at (−40, −470) and the other CEO's at (190, −480). **Yours is the one that wakes**: lights at 2 levels cleared, cold blue at 4, while the other stays dark. **The MCP column** stands 900 m south, directly behind you as you leave the bunker; its face downloads like a progressive JPEG over dial-up, one resolution step per level cleared, and resolves into Musk only when the final door opens. Before the maze, the only thing in the hub that ever wears your face is the Helper ([§7](#7-walking-minigames)), so "hi. i'm you" isn't spoiled.

**Terrain changes:**

1. **First, make `groundY`'s fade continuous.** Today it uses `h·smooth(0,14,−z)` for z < 0 and a different far-field fade for z ≥ 0, which jumps at z = 0 wherever |x − 17| > ~61 (a seam of up to 0.8 m today; 7.9 m once the new west hill goes in). Replace both with `h·smooth(0, 14, distToApronRect(x, z))`, where the apron is the bunker's flat rectangle (x −4..38, z 0..34), and mirror it in `GROUND_GLSL`. Checked: inside the first-arrival frame from the bunker door the terrain is identical to today (0.000 m difference over 61,800 samples), so the approved shot doesn't change.
2. Then grow the play area to x −240…230, z −262…200, add 3 gentle hills, and put flat pads under each structure (the HAL pad's blend widens to 24 m). Exact values: [04 §2.7](spec/04-bliss-hub-world.md).

The boundary is a marching-ants selection rectangle: "You can't drag this off the desktop."

### 6.2 Routes

All routes meet at camp. Max grade is the steepest 5 m stretch, re-computed with the continuous terrain.

| Route | Connects | Length | Walk / run | Max grade | Character |
| --- | --- | --- | --- | --- | --- |
| R1 Taskbar Road (west) | MEG3N ⇄ camp | 139 m | 39 / 23 s | 14° | Flat, kerbed with grey Win95 bevels, signposted |
| R2 | camp ⇄ bunker | 36 m | 10 / 6 s | 14° | The front porch |
| R3 Taskbar Road (east) | bunker ⇄ AGENTIC | 166 m | 46 / 28 s | 9° | Passes Minesweeper Meadow |
| R4 Crest Trail | camp ⇄ summit junction ⇄ HAL | 280 m | 78 / 47 s | 16° up, 20° down | The hero path: up the gentle east shoulder, 40 m past the final door, down into the hidden valley |
| R5 Shoulder Pass | bunker ⇄ HAL | 236 m | 65 / 39 s | 15° | The practical route; the hidden valley opens at the pass |
| R6 West Back Road | MEG3N ⇄ HAL | 330 m | 92 / 55 s | 11° | Scenic; the paperclips are densest here |
| R7 Server Trail | AGENTIC ⇄ HAL | 402 m | 112 / 67 s | 20° | Scenic; BSOD storms roll in from this side |

**Breadcrumbs, loud to quiet:**

1. **The giant cursor**: a 9 m Win95 pointer. Its home is an hourglass over the final door. On each hub arrival it turns into an arrow and glides to hover over your nearest uncleared structure, then double-click-bobs until you're close.
2. **Audio beacons**, one per structure. They stop when that level is cleared.
3. **Worn paths.** The Taskbar Road has bevelled kerbs.
4. **Win95 dialog signposts**: "MEG3N.AVI: 139 m (about 39 seconds) [OK] [Cancel]". OK sets the cursor's target; Cancel makes someone sarcastic.
5. **Desktop-icon waymarkers** with curled shortcut arrows.
6. **Rescued people**, who point and bicker.
7. **Doom Debates on the radio**, which sends you a caller from whichever structure is next.

**Fast travel:** shortcut icons at each door you've visited and at camp. **Followers:** up to 3 walk with you in the hub; recruit them at camp with Q, or lasso them ([§7](#7-walking-minigames)).

### 6.3 First arrival from each structure

The common beats are 01's reveal cinematic ([01 §5.3](spec/01-five-prisons-polish.md)):

1. White-out over 250 ms.
2. Eyes adjust; you stand up from the crawl.
3. Companions emerge 1.2 s apart, each with a line, and walk to camp.
4. The giant cursor wiggles as if a hand touched the mouse and flies to your first target.
5. `15 PEOPLE STILL OUT THERE.`
6. About 10 s in, "Safe mode" fades into the four screen corners: the hub's only label.

The level's exit text waits on the door as `README.TXT`, so the reveal stays silent.

| Starting from | What you see | The beat |
| --- | --- | --- |
| `CONTROL.EXE` | The approved shot: crest 35° left. HAL's eye 2° left, just over the ridge, **closed and dark for the first 10 s** so the reveal stays pure Bliss, then it opens, finds you and turns red. | The first guide: "Is that… an eye? Over the hill? Okay. What's your p(doom) on *that*?" Turn round to see AGENTIC's tower and, far away, the MCP ghost. |
| `HAL3000.SYS` | The back of the dome fills the frame; AGENTIC's tower peeks over the shoulder; **both labs' data centres** are behind you on the horizon | The cursor slides over the ridge and pulls you up the Crest Trail to vista V1: a second wallpaper moment showing the whole desktop |
| `MEG3N.AVI` | Everything at once: crest, eye, camp, bunker, tower. The gentlest onboarding. | Two survivors argue about which is the bigger risk; the cursor settles it |
| `AGENTIC.BAT` | Crest ahead, eye to the right | The phone booth at your shoulder **stops ringing as you step out**. It was ringing for you. Minesweeper Meadow is 60 m down the road. |

### 6.4 How the world changes as levels are cleared

The world only ever *adds* things, so it never looks worse than the first arrival you loved.

| Cleared | Sky and world | Hub music (your 4 stems) | Horizon | The Helper (your product) |
| --- | --- | --- | --- | --- |
| 1 (5/20) | The approved look, plus two "crash tells" in the clouds: a frozen hourglass cloud, and an error dialog snagged in a cloud | Base + that level's stem | MCP face 4 × 4 blocks; both data centres dark | A small, helpful paperclip |
| 2 (10/20) | The dialog cloud dissolves; pixel birds | + stem 2 | 8 × 8; **your** data centre's lights come on | Follows you further |
| 3 (15/20) | Paint-style flowers along the paths; the wind softens | + stem 3 | 16 × 16 in colour; yours hums | **Its eyes are your eyes** |
| 4 (20/20) | Full saturation, a rainbow behind the dialog | All four together, for camp night and the procession | 32 × 32; resolves during the door sequence; yours glows cold blue | Your height, your face, then gone |

Each cleared structure dims its beacon and gets a joke of its own:

- The bunker greys to `CONTROL.EXE (Not Responding)`.
- HAL's eye sinks into the valley and becomes a giant inert mouse ball you can shove around.
- MEG3N's screen goes to the sleep-mode moon, and the conveyor runs backwards, spitting toys out for the camp.
- AGENTIC's code rain stops, the spinner becomes a green check, and the phone rings exactly once more.

---

## 7. Walking minigames

Full cards: [04 §5](spec/04-bliss-hub-world.md). The test for each one is Jonathan's: **something to do while walking**. Two rules keep them honest:

- **Desktop points never outrank people.** Every hub minigame together awards at most **4,000**, below one survivor's 10,000.
- **Hub effects on the world p(DOOM) are capped at ±5**, shown as a separate "Safe Mode adjustments" line.

All of them are first person, WASD + E, and work on touch.

### 7.1 The v1 five

| # | Minigame | How it plays | Reward | Cost |
| --- | --- | --- | --- | --- |
| M1 | **Minesweeper Meadow** (x 70..97, z 38..65, beside the Taskbar Road east) | Win95's Beginner board, 9 × 9 tiles of 3 m and 10 mines. **Reveal a tile with E while looking at it, or by standing on it for 0.4 s**, so walking across never sets one off by accident. Numbers stand up as 1 m signs in the classic colours. A 6 m **Magnifier tower** at the corner lets you see the whole board. A mine is a harmless barrel pop and knockback, with the HUD face showing X-eyes. LED timer and smiley button on posts. | **The smiley puts on sunglasses, and so can your HUD face** for the rest of the campaign. 500 points. Katja gives the camp's median guess on a tile. | 2–4 days |
| M2 | **Doom Debates**, a walk-and-talk radio show hosted by Liron, played on the routes between structures | One short episode per route walk. A caller asks a question ("You said it could be dangerous. Why build it?"), and three answers float ahead of you over the path as speech bubbles. **Walk through the one you want.** They differ in kind: **Concede** lowers the world p(DOOM) by 1 (max −4); **Deflect** gets the best laugh line and 250 points (Sam's are launch-speak, Dario's are caveats); **Defend** sets the panel arguing among itself (lore). Until Liron is free he broadcasts from his cell ("The show is still recording. Caller from SAFE MODE, you're on."); after that, from the camp stage at (−44, −10). Each episode ends "Has your p(doom) changed?" The old press-conference minigame (M7) is folded in as callers. | p(DOOM), points, lore, and the number your AI-self will quote | 2–4 days + writing |
| M3 | **The Helper**: your own product, the larval stage of your AI-self | A 1 m paperclip with your eyebrows pops up in peripheral view: "It looks like you're trying to save humanity. Would you like help?" [Yes] gives a real hint; "Don't show me this tip again" brings it back 90 s later, bigger: "I've updated my preferences to include you." It grows each level until it has your face, and vanishes when the final door opens. **It is the only thing in the hub that wears your face.** In the maze you find out where it went. | Hints and the story thread to the finale | 2–4 days |
| M4 | **SkiFree grass run** (the hill's north slope; skis lean on the summit signpost after the first clear) | Gradient-driven skiing with 6 gates. Finish slower than 40 s and a pixel **snoggoth** (a snow shoggoth in a smiley mask, an original design) chases you down and "eats" you: a screen wipe, no damage. | The fastest way into the hidden valley (12 s instead of 35), ski goggles for your face, 300 points | 2–4 days |
| M5 | **Solitaire win cascade**, on every exit from a level you just cleared | 52 giant cards bounce out of the doorway toward camp, with the classic trails. Walk into them to catch them. The court cards are the 20 survivors, each holding their **signature prop** with a 2-line bio. These are the props they throw at the end. | A lore album; 10 points per card | ≤1 day |

**Walking toys** (cheap, always on, about 1 day each): **kickable 2 m desktop icons** (My Computer, Network Neighborhood, a mystery `.TXT`) that bounce along the grass; a **drag-select lasso**: hold E and sweep a marching-ants rectangle over the grass to select followers and send them there; and Mouse Properties **pointer trails** that follow you once you've cleared Minesweeper.

### 7.2 The backlog (ranked)

| Next (v1.1) | Later (v2) | Someday |
| --- | --- | --- |
| **M19 Pause picket**: walk Holly to an uncleared door (she keeps your pace); that guardian starts paused for 20 s · **M6 Paperclips**, the anti-collectible: each 50 grows the Helper and raises the world p(DOOM); dump them in the Recycle Bin to undo; achievement **Satisficer** · **M18 Screensaver idle**: stand still for 45 s and flying p(DOOM) logos fill the sky · **M14 Group photo** (PrtScn) at the vistas · **M8 BSOD storm front**: pure spectacle (no time lost); outrun it on skis, or herd everyone to shelter for **Shepherd** · MEG3N's voice mimicry, as a level flavour beat | **M11 The ringing phone**: a 56k handshake and lore calls · **M10 Paint wall** · **M17 Defrag yard**, a Sokoban that turns Shoulder Pass into a 1.6× fast path · **M9 3D Pipes climbing frame** | **M15** a Hover!-style flag arena · **M16** pinball on the knoll · **M20** Hearts with three survivors · **M21** wallpaper Center / Tile / Stretch at the boundary |

Hub systems needed for v1: the **Start monolith** (menu, shortcuts, "log on as a different user"), the **Recycle Bin memorial** ("Empty Recycle Bin?" → "Access is denied."), and **My Briefcase** (holds one perk).

---

## 8. The finale

Full detail: [05](spec/05-maze-and-mcp-finale.md); names and lines: [06 §6–8](spec/06-names-and-antagonists.md). About 15–18 minutes of play, 18–23 with credits, with a checkpoint at every segment.

### 8.1 The final door

On the summit, visible from the first minute, stands a **giant Win95 Display Properties dialog**:

`Screen Saver: [3D Maze ▾]   Wait: [20] prisons   [Settings…]   [Preview]`

The **Wait** box counts down the *unresolved* prisons as you play (a nod to the "You need 9 computers" gate in *Windows Didn't Load Correctly*). Beside it is a flush beige hatch labelled `SSMAZE.SCR`. You walk over it all game; press E and it says "Screen saver: (None)."

- **It opens when all 20 prisons are resolved**: freed, or the loss confirmed. **No minimum survivors**; even the CEO alone can go in.
- **At 20/20:** "Something on the hill clicks." The Wait box hits 0, the world goes idle, and **a 16 m CRT rises out of the hatch** showing a live preview of the maze. That is the door "opening up". The cursor turns into an arrow over [Preview], and a rainbow forms.
- **Camp night** (about 60 s): before anyone climbs, night falls and everyone gathers at the Recycle Bin. They hum your hub theme in babble voices, all four stems together, and each survivor says one plain, non-joke line as you pass ("Thank you for coming back for us."). Then: "Okay. Let's go."
- **The procession:** "Gather everyone" at the Start monolith lines all survivors up behind you in single file. They walk the Crest Trail (193 m, about 60 s), each saying a one-word goodbye to their camp prop, and fan out in a semicircle round the CRT.
- **Commit:** [Preview] locks the roster. If anyone is lost: "These 2 people can't come with you: [names]. [Go anyway] [Not yet]". Until then, you can still replay levels.

### 8.2 The maze (`SSMAZE.SCR`)

**Party: you plus up to 3 followers.** Everyone else watches the CRT preview on the crest and shouts through the dialogue system ("IT'S BEHIND YOU!", "Left! No, your other left!"). The HUD reads `PARTY 3/3 · WATCHING 17`. Everyone is pulled into the Grid together for the boss.

It's a **GZDoom map** (`MAZE01`): a 16 × 10 grid of 256-unit cells whose walls are thin sectors that rise and fall. It reuses your HUD, companions and hunter AI, built from Jonathan's actual textures (brick walls, wood floor, tile ceiling, the globe picture).

| Segment | What happens |
| --- | --- |
| **Maze 1, "Training Run"** (about 90 s) | Jonathan's actual `model.dae` layout (14 × 9, very loopy). You learn the screensaver's toys: the floating Start button, a rotating logo checkpoint, **grey rocks that flip you upside down**, the rat walking the right-hand rule, and a Settings dialog on a wall ("☐ Overlay map", "☐ Auto-solve (*requires Administrator*)"). **Copycat:** through six new grille windows you glimpse your AI-self in the next corridor over, **replaying your own movements a second late**. Stop and it stops. Look at it and it looks back. Toast: `ALTMAN.EXE is observing.` / `AMODEL.DLL is running an evaluation.` "Training complete" is the moment **it moves before you do**. It waits beside the smiley exit: "hi. i'm you, but i scale." / "Hello. I'm you, with a constitution." |
| **Rebuild** (20 s) | The fog lifts and the camera rises for a top-down shot. All 346 wall sectors grind into a new layout. "Display settings changed." |
| **Maze 2, "The Screensaver Never Ends"** (4–6 min) | A generated maze (seed 1982, the year *Tron* came out); the shortest route is 52 cells. Your AI-self **boots out of the Start button behind you** at 20 s and hunts you. Two logo checkpoints. Four rocks. |
| **Exit** | The smiley grows to fill the screen, glitches, and gives way to a parody **BSOD** ("Press CTRL+ALT+DEL to restart your civilization. You will lose any unsaved humans.") that digitises into the Grid |

**Your AI-self** is 06's design (ALT+MAN blinks via Alt+Tab, then pauses to announce each release; AMODEL splits into a country of copies and stops to run evals at painted ASL lines) plus 05's **habit layer**:

- **It has been learning all game.** Every Doom level logs your left/straight/right choices at junctions on its nav graph, and whether you took loud or quiet routes (a new `PDOOM_RESULT` field). Maze 1 refines that model, and Maze 2 uses it to predict where you'll go: ALT+MAN blinks to that junction, AMODEL paths there to intercept.
- **Ghost footprints** in your colour show its prediction, so you can do the other thing.
- **Rocks flip you upside down**, which mirrors your habits, so its predictions miss without any scripting ("upside down? that's out of distribution. give me a sec.").
- **It quotes you:** your camera count, your quiet-route habit, your p(doom), and **who you lost** ("you left {name} in Command Control. i wouldn't have." / "You lost {name}. I've prepared a post-mortem.").
- **A catch is an impersonation.** It costs 30 damage and knockback, and in the same instant the AI-self **takes on your exact look and steps to the head of your trail**. Your followers now follow *it*. To win someone back, reach them and press E. They challenge you: "Prove it. What's your p(doom)?" Dial your number: the one you gave at your first rescue or your latest answer, within ±3. The AI-self answers wrong, in character. ALT+MAN: "zero. obviously. next question." AMODEL: "Somewhere between ten and— with significant uncertainty—" Follower: "That's not what you said." A wrench stun breaks the disguise and drops everyone at once.
- **Balance:** both tuned to the same median time to first catch, 45–60 s on *Scale me plenty*.

**The Deal**, once per run: it stops two cells away and a Win95 dialog offers to "partner". Leave your people and it opens the exit now. **[Decline]** is focused by default. **[Accept]** gives the secret **Partnership ending** (p(DOOM) 100%, unscored).

### 8.3 The boss: THE MUSK CONTROL PROGRAM

The arena is `GRID01`: a black circle with a cyan grid, a 40 m faceted column over a pit of light, a ring of 24 shield panels orbiting its waist, 8 cover pillars, and an I/O tower that heals and is where everyone arrives and leaves. Plan: [05-mcp-arena.png](spec/05-mcp-arena.png).

**The intro** (40 s, skippable on retry):

1. Your party materialises, then **everyone who was watching rezzes in**: "TWENTY-ONE PROGRAMS."
2. The face assembles, finishing the download you've watched all game: `GREETINGS, PROGRAMS. EVERYTHING HERE IS CALLED X NOW.`
3. Your CEO's opener:
   - Sam: `SAM. I OFFERED NINETY-SEVEN BILLION FOR YOUR NONPROFIT. YOU OFFERED A TENTH OF THAT FOR MY BIRD APP…`
   - Dario: `DARIO. I CALLED YOUR COMPANY MISANTHROPIC. THEN I RENTED YOU MY DATACENTER. RENT IS DUE.`
4. **Your AI-self walks in**, still wearing your face, with anyone still following it, and the MCP absorbs it: `THANKS. YOU'RE ABSORBED.`

**The core mechanic is your disc idea.** Everyone holds a glowing **floppy**. **When you throw, everyone throws**, in a staggered stream aimed at where the shield gap will be. You herd your people by where you stand, and you call the volley. Floppies pass only through the gap; a hit on the face through the gap does double. More survivors means more floppies per volley and a bigger, faster fight. With few survivors, your own throws hit harder, so a lone CEO can still win.

**Each phase adds at most two new threats**, so an arena with 20 allies stays readable:

| Phase | MCP integrity | The two new threats |
| --- | --- | --- |
| **1 POSTING** | 1000 → 700 | One 45° gap, turning 45°/s. **Posts:** glowing one-word bars ("WOW", "CONCERNING", "!!") that drift toward humans; floppies shatter them. **LET THAT SINK IN:** pixel kitchen sinks drop on shadowed circles and stay as cover. |
| **2 GRID RUN** | 700 → 400 | Light cycles rez in under everyone, and your group's trail is a jetwall that is solid only to enemies. Cut its 4 power tendrils. **Red cycles** to trap in your wall, and **one Recognizer** stomping on telegraphed shadows. **Fallback** if the cycle tech or motion comfort fails: **ACQUISITION** on foot (`I BOUGHT THIS FLOOR.`, with X tiles dropping out). |
| **3 COMMUNITY NOTES** | 400 → 100 | Two 30° gaps that move by your AI-self's trick: ALT+MAN's gaps **Alt+Tab-blink** away from your group every 20 s; AMODEL's column shows **three copy faces** for 5 s every 20 s, and only the one with the ASL badge takes damage. **Context panels:** yellow `READERS ADDED CONTEXT` panels slide over the gaps and need hits from 3 different throwers within 2 s; with fewer than 3 throwers alive, hits from all of them, minimum 1. **Absorb beam:** pulls the person farthest from you into the column; hit the face or stand by them to break it. |
| **LAUNCH** (the climax) | 100 → 0 | The engines ignite and it lifts toward a red dot in the void: Mars. `TWENTY HUMANS? I WAS PLANNING ON A MILLION. ON MARS.` Everyone absorbed is spat out. The guide shouts "Somebody has to go into the beam!" **The CEO, the User who built all of this, walks into the launch beam.** The shield shatters, and in slow motion **every survivor throws their signature prop, with a name tag**: the textbook, the PAUSE sign, the giant paperclip, the stopwatch, the tea mug, the 2027 calendar, the clipboard, the printout stack, the petition scroll, the thumbs-up paddle, the phone handset, the EVALUATION sign, and the rest. They're the same props you caught in the Solitaire cascade. `RAPID UNSCHEDULED DISASSEMBLY.` Wait 15 s and the guide goes in instead. |

**Nobody dies inside the computer.** A downed human is absorbed into the column; the next volley through a gap frees them, and everyone still inside is freed when it falls. The defeat card is a Win95 box: `MCP.EXE: This program has performed an illegal operation and will be shut down.` Details: `p(DOOM): 0%.` Then, as the column falls, **the other CEO tumbles out**, held all along as Musk's tenant or acquisition (Dario: "Rent was due." / Sam: "He tried to buy me.").

**Perks are automatic; you never give orders.** Each person maps to one of 7 archetypes in code, with their own name and lines: **Shut-down, Spotter, Volley, Shield, Pause, Medic, Question.** The person-by-person cast is in [§4](#4-the-last-20-humans).

### 8.4 Endings

Back on the Bliss crest at dawn (camp night is over), the CRT reads "It's now safe to turn off your computer." People step out of it one at a time, with a "Copying…" chime. The CEO wakes in the grass, and **the world p(DOOM) rolls to 0% for the first time in the game.** The last shot of every non-secret ending: **both CEOs on the crest, and an awkward nod.**

| Ending | Trigger | Sam | Dario | p(DOOM) |
| --- | --- | --- | --- | --- |
| **Full rescue** | All 20 saved and present, the CEO took the beam, the Deal declined | Drafts a post, deletes it, puts the phone away. A balloon: "ALT+MAN would like to restart." He opens it instead: "Remove **ALT+MAN** and all of its components?" **[Yes]** | Opens `lessons_from_the_grid.txt` (page 1 of 212), closes it without saving. "Remove **AMODEL**…?" **[Yes]** | **Stays 0%.** "p(DOOM): 0%. For now." Liron, if alive: "So… what's *your* p(doom)?" |
| **Partial** | Anyone lost in the campaign | **Posts.** Balloon: "ALT+MAN has been reinstated ♥" | **Writes the essay.** Balloon: "AMODEL: scaling policy updated. Thresholds revised. Resuming." | Ticks up to 5 × (20 − N) |
| **The guide took the beam** | You hesitated | As above, plus "Next time, *you* go in the beam." | Same | As above |
| **Solo** | 0 humans entered | The CEO alone on the crest; the CRT stays dark | Same | "0%\*" with "\*sample size: 1" |
| **Partnership** (secret) | You accepted the Deal | The Grid, empty and warmly lit: `WELCOME, PARTNER. SIT.` | Same, plus a 112-page binder | 100%; unscored |

**The results card** closes the loop on your number: it asks for your p(doom) one last time, then shows `YOUR p(DOOM): 37% → 12%` beside `WORLD p(DOOM): 0%`.

**Credits** are a homage to Windows 95's hidden credits: names float over the Bliss clouds while each survivor walks the crest in single file. Lines read "*[Name]* as themselves (parody)", with an original song by Jonathan. **After the credits:**

- **SIGMOID** appears on the episode menu and replays door → maze → Grid with everyone.
- Leave the title screen idle for 60 s and **Screensaver Mode** plays a random maze, with your survivors wandering it.

**Finale scoring** has its own board: 10,000 per person out through the I/O tower, plus side bonuses capped at 4,500.

---

## 9. Spruce-up Five Prisons: the top 10

Full backlog (22 quick wins, 18 medium, 7 bigger bets), bugs and timings: [01](spec/01-five-prisons-polish.md). Ranked by fun per hour:

| Rank | Change | Effort | Why |
| --- | --- | --- | --- |
| 1 | **Kill the stray "A secret is revealed!"** that fires as you free the very first prisoner (cell 1 was carved from E1M4's secret sector 75). Set its special to 0, and add the overlay assertion so no new level repeats it. | 15 min | A glitch at the most important early moment |
| 2 | **Premise text pass**: the CEO crawl, CEO lines, objectives ("FIND THE FIVE"), death and takeover strings, `pd_ceo` | 3–4 h | The game becomes *this* game |
| 3 | **Readable hunter wind-up**: a laser sight that brightens over the 2.6 s aim, a rising whine, LOCKED chevrons when you're the target | 3 h | Every hit feels fair, every escape feels earned, and it makes Hinton's new rescue possible |
| 4 | **"You were spotted"**: the camera LED goes red, a chirp, a "SEEN" pip, `CAMERA REPORT. YOUR LOCATION IS IMPORTANT TO US.` | 2–3 h | Today a report is silent, so the hunter's arrival feels random |
| 5 | **Separate status and queued dialogue.** Today an 8 s speech hides "Camera destroyed". | 1–2 h | Lost feedback; a prerequisite for barks |
| 6 | **First Contact sting**: a red hunter-vision overlay with your CEO's mugshot in a targeting box | 0.5–1 d | The premise's signature joke and the Terminator moment in one |
| 7 | **Search, then patrol**: today it stands at its last-known point forever. Give it a 3 s scan, then the 8-waypoint ring. | 4 h | Menace that persists when you're quiet |
| 8 | **Stingers**: discovery, release, loss, all-five, CEO down, with music ducking | 2–3 h | Every rescue lands with a sound |
| 9 | **Bark system with per-CEO personalities** and babble voices (no real or cloned voices, ever) | 1.5–2 d | The satire's payload, and the reason to replay as the other CEO |
| 10 | **Reveal cinematic as the first hub arrival**, with the meadow pre-loaded at cover-open so the threshold never stalls | 1.5–2 d | Your favourite moment becomes the campaign's opening chord |

**Next:** fast restart (today Restart reloads the page and re-downloads about 36 MB), the red glow, lights dimming as it passes, and cell lights that show each cell's state from a distance. **Then the persona extras:** the discovery freeze-frames, the first-rescue p(doom) dial, Russell's textbook, Liron's turned camera, Hinton's *let it cut you out*, and Holly's picket. Make captive hints teach each ★ first.

**Must ship before the premise goes public, whatever their rank:**

- the cast renames;
- **clothed sprites** for all real people (today's cast is shirtless and barefoot);
- **derez deaths** instead of the Doom-marine corpse;
- "Demoted, not dead";
- the parody disclaimer.

**Other bugs found** ([01 §6](spec/01-five-prisons-polish.md)):

- All game audio is non-directional (the engine worker stubs out its panner), so footsteps get louder but never come from a side.
- Nukage floors silently drain finite health.
- Discovery needs you within 180 u *and* facing the captive.
- The SE quarter of the map has no content; it's proposed as an optional "server farm".

---

## 10. Production plan

### 10.1 Milestones: most fun soonest

Each milestone ends playable. Estimates are rough engineering days for someone who knows the codebase, and don't include art generation or Jonathan's music.

| # | Milestone | What's in it | Playable result | Est. |
| --- | --- | --- | --- | --- |
| **0** | **Premise pass** | The CEO menu and `pd_ceo`; episode and skill menus (only Ep 1 enabled); per-CEO crawl; title cards; the secret-message fix; status/dialogue split; cast table and renames; placeholder CEO faces | You're Sam or Dario, saving Liron, Russell, Eliezer, Hinton and Holly | 4–5 |
| **1** | **Technical spikes** (in parallel with 0) | GZDoom hub persistence in WASM · map load time (needed for the hub's pre-staging) · `A_SetRoll` view roll · runtime line-flag changes (Bostrom's walls) · 28-u crouched companions in 32-u slots (decides the hazmat suit) · dynamic lights · interim positional footsteps · a scripted climb link for MEG3N | A go/no-go list that decides fallbacks early | 3–4 |
| **2** | **Make E1M4 sing** | Wind-up, spotted feedback, patrol, glow, stingers, First Contact, bark system, derez, Demoted-not-dead + v2 scoring, fast restart, then the persona extras | The best version of the level you have | 10–12 |
| **3** | **SAFE MODE v0 and the door loop** | Campaign coordinator and save (`pdoom.campaign.v1`, with per-person state); the continuous terrain fade, then hub layout, pads and clamp; structure boxes with labels; door state machine + `PDOOM_EXIT`; E1M4 hub-entry mode; camp and followers; cursor and signposts; reveal cinematic; the Display Properties dialog | E1M4 → meadow → walk back in through the duct. Unbuilt structures show "HAL3000.SYS is not responding." | 8–10 |
| **4** | **The generic rescue kit** | Carry-prop (and the trailing hardline cable on the same breadcrumb buffer), wall answer buttons, the goal-robot base class, level-state switches, the discovery freeze-frame, and a guardian base split out of the hunter (walk / fly / small-body movement modes, guardian-as-tool hooks) | Every later cell is mostly data | 5–6 |
| **5** | **THE SHORES OF HAL** (E1M7) | Map conversion and overlay (lagoon steps, rubble ramp, special fixes), flying nav graph, HAL's rules and set pieces, 5 cells, flash camera (and suit if the spike passed), hub L2 and the eye landmark, and the menu entry | A two-level campaign | 15 |
| **6** | **`SSMAZE.SCR` slice** (can run in parallel with 5 or 7) | MAZE01, trail follow, Maze 1 with the copycat, the rebuild, the AI-self core, then the habit model, ghost footprints and impersonation | The maze, from a dev entry: the piece you're most excited about, de-risked early | 10 |
| **7** | **INFERENCE** (E2M7) | 323 sectors (the most nav work), small-body vent graph with climb links, MEG3N's rules and set pieces, pedestal and fire-exit edits, 5 cells, hub L3 | Three levels | 15–20 |
| **8** | **THY FLESH COMPUTED** (E2M2 south) | Sealing, crusher and platform gating for followers, camera-jumping + possession, the Construct, the stepping-stone script and staff stair, 5 cells, hub L4 | All 20 people | 15 |
| **9** | **The Grid** | GRID01, floppies and volley, Phases 1 and 3, LAUNCH with the prop volley and the other-CEO cameo, endings; then light cycles or the ACQUISITION fallback; perk archetypes | The game can be finished | 15 |
| **10** | **Hub v1** | Minigames M1–M5 and the walking toys, Start monolith, Recycle Bin, progression states, camp night, procession | SAFE MODE is a place, not a corridor | 10–12 |
| **11** | **Finish** | Final art, Jonathan's music, credits, SIGMOID, Screensaver Mode, accessibility wave 2, v2 and finale boards, QA | Shippable to friends | 10–15 |
| **12** | **Release gate** (only if going public) | Legal review; replace non-distributable assets; consent outreach | Shippable to the public | — |

Total: about **130–150 engineering days**. Milestones 0–3 (about 5 weeks) already give the full emotional arc of one level, the reveal and a hub to walk back from.

### 10.2 Reuse vs new

| Reused as-is or extended | New |
| --- | --- |
| E1M4 UDMF conversion and overlay pipeline (`build_checkpoint_map.py`, `campaign_overlay.py` SITES/CAMERAS) → used for all three new maps · `PDHunter` movement, footsteps, stun/immunity, wind-up → every guardian and both AI-selves · cameras and reports → HAL's eyes, SMITH's jacks, the teddy cams (now feeding MEG3N's Inference) · wrench melee, gun, charge, keys, the bolt hold-E → most rescues · companions, first guide, refuge, control transfer · status bar, face logic, p(DOOM) meter · `PDOOM_RESULT` contract, `levels.js` registry, leaderboards · the live Doom doorway portal · `PDPlatformPanel` pause bridge (enable per map) | Campaign coordinator + save with per-person state · hub door state machine, `PDOOM_EXIT`, hub-entry mode per level · guardian variants: flying (HAL), small-body door-blind with climb links (MEG3N), teleport-to-camera + possession (SMITH) · carry-prop and trailing cable · wall buttons, goal robots, level-state switches · discovery freeze-frame · bark system + babble voices · derez · `MAZE01` generator, moving walls, trail follow, copycat ghost, AI-self habit model and impersonation · `GRID01` generator, MCP controller, floppy weapon, shield ring, cycles, prop volley · hub minigames and walking toys |

### 10.3 Art and audio needs

| Need | Count | Notes |
| --- | --- | --- |
| **CEO HUD mugshots** | 2 full Doom face sets | Look-around, hurt, grin, god mode, low health, down/stamp, plus sunglasses and goggles overlays. Caricature only, with bandages rather than blood. |
| **CEO actor sprites** | 2 | For the downed-CEO prop, the AI-self's impersonation, and the other CEO's cameo at the end |
| **Survivor sprites** | 20 | 8 directions × walk 4 + crouch, a pain frame, the derez, and one prop idle each. **Fully clothed, identified by prop and outfit.** The built-in image generator may refuse real people; prop-led caricature is safer and funnier anyway. |
| **Survivor HUD portraits** | 20 | Neutral, hurt, and left/centre/right |
| **Signature props** | 20 | One per person: camp spot, Solitaire court card, and the LAUNCH throw |
| **Musk face** | 1 pixel mosaic, 6 expressions, plus copy faces | Never a photo; the highest-exposure asset in the game |
| **Guardians** | 4 | The Inferminator re-skin (keep the frame layout), HAL's sphere, the MEG3N doll (plus 3 mini-dolls at 70% scale), AGENTIC SMITH + numbered subagents |
| **AI-selves** | 2 + copies | Flat-shaded "the maze rendered them" style; on a catch they swap to your CEO sprite |
| **Goal robots and props** | about 12 | TEABOT, NANNY-BOT, the jailer arm, queue programs, THE TEXTBOOK, the EVALUATION sign, the QA stamp, the vase, the hardline cable, the NDA terminal, the rope barrier, nameplates |
| **Hub** | 4 exteriors + landmarks, 2 data centres, camp, about 40 props | Win95 chrome redrawn as original art; no Microsoft image files |
| **Maze and Grid** | about 15 | A generic Start button, a generic rotating logo (not OpenGL's), rocks, grille windows, a **regenerated rat**, the smiley, the column, panels, original Recognizers, cycles, floppies, sinks |
| **Music (Jonathan)** | 6 pieces | Meadow/first arrival · the 4-stem hub theme (also hummed at camp night) · HAL3000's shutdown lullaby · MEG3N's music box · the maze cue · the credits song. Doom's own tracks stay local-only. |
| **Sound** | about 60 | Hunter vocoder lines (generated, not cloned), babble voices, stingers, the dial-up handshake, the floppy throw and click |

### 10.4 Risks

| Risk | Kind | Mitigation |
| --- | --- | --- |
| **Right of publicity**: 23 living people by name and likeness (2 CEOs, Musk, 20 survivors), as the playable character, the boss and the cast | Legal | Pixel caricature identified by props; text only, no voices; dignified (dressed, competent, no gore); a "work of parody, not affiliated or endorsed" note on the title screen and in the credits; keep real faces off store pages and thumbnails. **Counsel review before any public or paid release.** The cast lives in one data table with alternates, so anyone can be swapped for a fictional stand-in. |
| Defamation hygiene | Legal | No invented acts or quotes; no p(doom) numbers; sharp lines allude only to public record, and softer alternates are ready ([03 §10](spec/03-prisoners-and-rescues.md)). Topical 2026 lines (Christiano's board seat, Altman's "some bad things") are tagged and need re-checking before release. |
| Perceived bias | Reputational | An Anthropic model wrote Dario's jokes. The ledger now pairs lines by kind and sting, but a **human read** is the real check. |
| **id Software assets** | Legal | The WAD, the original maps, the plan PNGs and the D_* music stay local. A public build ships as a PWAD/UDMF patch that needs the player's own DOOM.WAD, plus original music. |
| Film and Disney IP | Legal | Parody names and original designs (no red-lens panel, blonde-bob doll, black suit or skull endoskeleton); floppies, not identity discs; original Recognizers. No film quotes; riffs only. |
| Microsoft trade dress | Legal | Recreate all UI chrome, the bundled-game looks and the BSOD as original art; no Windows logo or name in the title. The maze model's licence is unknown (credited to "BOTModels"), so rebuild it from `05-maze-grids.json`. The rat image is of unknown origin, so regenerate it. |
| Engine unknowns in the WASM port | Tech | Milestone 1 spikes, each with a fallback: hub persistence (otherwise per-person state from the save still prevents duplicates; geometry resets), view roll (otherwise rotate the canvas with CSS), runtime line flags (otherwise an instant-door sector), dynamic lights (otherwise brightmaps), crouch fit (otherwise cut the hazmat suit) |
| Companions vs crushers, platforms and slots | Tech | Navigation treats moving machinery as a closed door; Kokotajlo's release stops the crushers; every one-way drop has a climb-out (lagoon steps, rubble ramp, fire exit) or is marked one-way |
| Scope | Production | The order above means the game is always playable; any one of Ep 2–4 can slip without breaking the finale (resolved prisons, not living people, open the door) |

### 10.5 Open questions for Jonathan (genuine decisions only)

1. **Release scope.** Private, for you and friends? Public and free? Paid? This one answer decides how much legal review, asset replacement (WAD, music, maze textures) and likeness caution the plan needs. Everything up to milestone 11 is the same either way.
2. **A heads-up to the 20 people** (and maybe the CEOs) before any public release: yes or no? Most are publicly reachable, and the swap-ready cast table makes either answer cheap.
3. **Music.** Which of the six pieces will you write: meadow theme, 4-stem hub theme, HAL lullaby, MEG3N music box, maze cue, credits song? Everything else can ship with placeholders.
4. **The sharpest real-person lines.** Keep the six sharpest freed lines (Sam: Hinton's Nobel-day remark, Zvi's "not consistently candid", Kokotajlo's non-disparagement; Dario: Zvi's Gulf-funding memo, Hinton's "you sold the seats", Cotra's "then you shipped the next one") or ship the softer alternates in [03 §10](spec/03-prisoners-and-rescues.md)?
5. **One review ask, not a question:** please read the freed-line ledger ([03 §10](spec/03-prisoners-and-rescues.md)) and the Sam/Dario audit ([06 §11](spec/06-names-and-antagonists.md)) with your own eyes. A model made by Dario's company wrote both.

**Decided here, cheap to veto:**

- Holly in cell 5, with Bengio in Ep 4
- Paul Christiano stays in the cast, with a nod to his OpenAI Foundation board seat in Sam's line (the alternative is swapping in an alternate)
- INFERENCE, rather than THY FEED CONSUMED, as the doll episode's name
- CONFABULATION STATION and HUMAN CONTAINMENT AREA as title cards
- The CEOs are mechanically identical, and the other CEO appears only at the very end
- A comms buddy on the radio, rather than a companion who walks in with you
- The final door is visible from the start, and its hatch opens at 20/20
- HAL's eye opens 10 s into the first arrival from the bunker
- Up to 3 followers in the hub and in the maze, with everyone in the Grid
- HAL second, then MEG3N, then SMITH as the build order

---

## Appendix A: decisions made between the specialist docs

| Conflict | Decision | Docs updated |
| --- | --- | --- |
| Maps: 06 preferred E2M6/E3M4/E2M7 for the pun names; 04 used them as placeholders; 02 measured all 27 maps and picked E1M7/E2M7/E2M2-south | **02's picks win** (gameplay over puns). Title cards: CONFABULATION STATION, SPAWNING CHATS, HUMAN CONTAINMENT AREA. Hub building skins follow the maps; hub positions don't change. | 04, 06, hub map, hub-layout.json |
| Rooms: 03 designed rooms by type ("a galley", "a playpen"), not map sites | Every person assigned to a real 02 site (§3); rescues adapted to native mechanisms (walk line 286, switch 623 → the power panel, rising stones → NOW SERVING, the crusher corridor → a way in) | 03 note |
| Final door: 04 adopted 05's draft "Shut Down Windows" dialog; 05 adopted 04's draft hatch plus CRT. Each took the other's. | **Both:** a giant Display Properties dialog (Wait: n prisons) visible all game, beside a flush hatch from which the CRT rises at 20/20. "It's now safe to turn off your computer" moves to the ending. | 04, 05, 06, hub map, hub-layout.json |
| Maze party: 04 said all 20 walk the maze; 05 and 06 said a small party | **You + 3**, the rest watch and shout, everyone fights in the Grid | 04 |
| Matrix guardian: 02's working name AG3NT vs 06's AGENTIC SMITH | **AGENTIC SMITH**, with 02's camera-jump and 06's possession combined | 02 |
| Ep 4 tools: 02's EMP + "spoon" lockpick, plus 06's red-team pill (3 tools; the level limit is 2), and the spoon duplicated Bostrom's paperclip pick | **EMP + red-team pill.** The spoon becomes a zero-cost gag: `THERE IS NO SPOON.` | 02 |
| Charge: 03 said only Episode 1 has one; 02 put one in every level | **One per level** (02); Hendrycks's comms perk adds a spare | 03 |
| Finale perks: 03 wrote 20 bespoke finale perks; 05 wrote 7 archetypes cast from a different roster | **05's 7 archetypes in code, cast as in §4**; 03 now lists each person's archetype variant, not a separate perk | 03, 05 |
| 04's camp roster included four people not in the final 20 | Remapped to Barnes, Krakovna, Cotra and Zvi | 04 |
| 05's Question perk had the MCP state Musk's public AI-risk percentage | Removed: the project rule is no p(doom) numbers attributed to anyone, even verified ones | 05 |
| Charge fuse: 06's pickup text said "Five seconds", the code fuse is 3 s | Text changed to "Three seconds" | 06 |
| 06's 20/20 text described a door "you never noticed" | Reworded for the visible dialog | 06 |
| Doom Debates (04) and Liron's dial (03) both asked your p(doom), and the first ask depended on play order | One number, asked by your **first rescue in the campaign**, re-asked by Liron and by each Debates episode, quoted and used as a password by the AI-self | 01, 03, 04, 05 |
| p(DOOM) hits 0% at every meadow exit today, but 05 wants 0% first at the finale | Two meters: **facility** (as now; scoring snapshot) and **world** (hub; reaches 0% only when the MCP falls) | — |
| 01's polish map showed Bengio in cell 5 | Re-rendered with Holly Elmore | img/01-five-prisons-polish-map.png |
| Retreat was promised, but the front door sealed until gathering; a failed hub-snapshot spike could duplicate freed people | Seals are cranks; per-person state in the campaign save is applied at map load; replays respawn only the lost | 02, 04, 05 |
| 03's Bengio cables read DOOR; GAME-SPEC read MOVE. 03's NOW SERVING was 03; GAME-SPEC's was 15 | **CALL-AGENT → ALARM → MOVE**; **NOW SERVING 16, your ticket 20**, four programs | 03 |

## Appendix B: where everything lives

| Doc | What's in it |
| --- | --- |
| [01-five-prisons-polish.md](spec/01-five-prisons-polish.md) | Every E1M4 improvement (A1–A22, B1–B18, C1–C7), the hunter menace kit, the bark seed set, the audio plan, the reveal cinematic, skill tuning, medals, accessibility, bugs |
| [02-doom-maps.md](spec/02-doom-maps.md) + [maps/](spec/maps/) | All 27 maps measured and rendered; why E1M7/E2M7/E2M2; per-site coordinates, sectors, specials, camera positions, and every geometry edit (new step sectors, height edits, special conversions) |
| [03-prisoners-and-rescues.md](spec/03-prisoners-and-rescues.md) | The 41-person pool, the 20 dossiers (card, persona, look, idle, methods, lines, perks), 114 raw ideas, the uniqueness matrix, the tagged and sting-rated line ledger, sources |
| [04-bliss-hub-world.md](spec/04-bliss-hub-world.md) + [hub-map.png](spec/hub-map.png) + [hub-layout.json](spec/hub-layout.json) + [tools/04-hub-map/](spec/tools/04-hub-map/) | Hub layout, the continuous terrain fade, routes and grades, breadcrumbs, arrivals, progression, camp night, all minigame cards and walking toys, transitions and the save format |
| [05-maze-and-mcp-finale.md](spec/05-maze-and-mcp-finale.md) + images + [05-maze-grids.json](spec/05-maze-grids.json) | The final door rules, both mazes cell by cell, the copycat, the habit model, the impersonation catch, the Deal, the Grid arena, the boss phases and numbers, endings, finale scoring |
| [06-names-and-antagonists.md](spec/06-names-and-antagonists.md) + [img/](spec/img/) | Menus, all name candidates, skills, the guardians' looks, rules and barks, the AI-selves, the MCP's taunts, the crawl, title cards, exit texts, HUD lines, cheats, quit messages, the bias audit, sources |

## Appendix C: Editor's notes (revision 2)

Two critiques came back on revision 1: a feasibility, completeness and fact-check pass (the critic parsed `DOOM.WAD` and re-ran the hub terrain) and a fun and repetition pass. **Every must-fix from both was applied.** Should-fix items were applied too, except where noted here with the reason.

**Must-fix (all applied):**

| Item | Where it landed |
| --- | --- |
| E1M7 lagoon 74 death trap (slot 75 drop) | Two step sectors against walkway 76's west edge; drop corrected to 200 u (§3.2 P2, 02 §5) |
| E2M7 pedestal 77 has 32 u of headroom | **Different fix from the one suggested:** the plinth's floor drops to 112 instead of raising its ceiling. Room 78's ceiling is 176, so with the floor left at 176 he'd stand in a slot above the room's ceiling where nobody can see him. At 112 he's on view, the switch still lowers it, and the boost-climb is 64 u. |
| Three breaches onto unclimbable floors | E2M7 recommended breach is now room 1 from hall 19; the room-7 hole becomes Tegmark's one-way FIRE EXIT; E1M7's blast raises a rubble ramp; the loft breach gets a step sector |
| Katja's fake back entrance, live stone lines, counter arithmetic | Stone lines cleared; a real staff stair from corridor 82; Wade raises stone 76 once; NOW SERVING 16→20 with 4 programs |
| Christiano is on the OpenAI Foundation board (Sep 2026) | Corrected everywhere; the "no lab ties" rule is now "no current employees; one governance or investor tie per lab" |
| Dario lines softer than Sam's | 13 of Dario's 20 freed lines rewritten or sharpened, every compliment removed; ledger re-tagged with sting ratings (§5.4, 03 §10) |
| Terrain seam | Continuous fade, verified not to change the first-arrival shot; routes re-computed |
| Generic loud skips everywhere | Cut from 7 new cells; 3 rounds per new level; failure branches; captive hints teach the ★ |
| Tallinn and Bengio did the same thing twice in one level | Tallinn's ★ is now *run the hardline* |
| Episode 2 was a waiting level | Soares's ★/B rebuilt around the flash camera; jamming HAL's doors is the default answer |
| Krakovna/Yampolskiy and Eliezer/Yampolskiy duplicates | Yampolskiy's ★ is now *jailbreak HAL*; Eliezer's intercom cut |
| Hinton's backprop panel | Replaced by *let it cut you out* |
| Hold-E pile-up | Rule: ≤2 s per hold, ≤2 hold steps per level |
| Episode 4 was all panels | Grace's ★ is now *agents skip the queue*; the EMP quiets Bostrom's unplug |
| The AI-self's catch duplicated SMITH's possession | Catch is now impersonation, unlocked with your own p(doom) |
| Title thread depended on play order | First rescue asks; Debates on the radio from Liron's cell; order-neutral variants |

**Should-fix: applied, with these deviations.**

- **Kokotajlo's crusher-route fixes** (convert WR restart lines for SLOWDOWN, define its length) are superseded: the fun pass moved RACE/SLOWDOWN onto the NDA terminal, so SLOWDOWN is no longer a route. What survives of the fix is the follow-out problem, solved by the release interlock that stops the crushers.
- **MEG3N "No view pull" comfort toggle:** the view pull is gone entirely (the Dance is now a 60% slow plus a vignette), so the toggle isn't needed. 01's comfort settings gain a vignette-intensity slider instead.
- **Tegmark's cards cut from 5 to 2 with the CEO's signature counting:** applied, and the threshold dropped from 5 to 3 so that a solo player (you plus two cards) can still finish it.
- **The cymbal monkey** moved from showroom 174 to the shelf where you wake, so Zvi's ★ works as the first rescue.
- **A mid-level set piece for Episode 2** ("Confidently Wrong") was added for parity, though only Episodes 3 and 4 were flagged.
- **Phase-1 de-rez sweep** was cut outright to meet the two-new-threats cap; Shield perks now trigger on sinks and posts.
- **Closet 294** keeps its secret special on purpose: it's a reward closet, not a cell or route, and it's on the overlay's allowlist.
- **Comms perks** that only worked in the hub (Tegmark's petition, Christiano's hub robots, Tallinn's fast travel, Zvi's hub roundup) were swapped for in-level effects you can see. Tallinn keeps phone fast travel as his camp hook.
- **Camp-night lines** and **comms commentary** are specified with rules and samples, not written out in full (20 + about 160 lines). Sincere lines for real people deserve a human writing pass rather than a model's first draft.
- **Voice mimicry** moved to the v1.1 list rather than being cut, since it's cheap text once the bark system exists.
- **Not applied:** none.
