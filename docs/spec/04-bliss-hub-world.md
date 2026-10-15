# 04: The hub world, SAFE MODE: layout, routes, progression and walking minigames

> **Entrance/refuge revision, 2026-10-08:** Entering a facility from SAFE MODE
> starts outside its refuge. The first living local rescue introduces the safe
> room; hub progress does not reveal it automatically. E1M4/E1M7 use their cold
> entrances with a manual retreat crank. Future vestibules must also avoid the
> refuge. Preserve camp progress, and do not seal an empty completed refuge.

Track owner: the Windows-wallpaper hub. Written 2026-10-06. It answers Jonathan's ask **(4)**, where the levels sit in the Windows world and how you get between them, and **(5)**, things to do while walking. It also gives the hub side of ask (2): where you start and how you go in and out of each structure.

> "each of these areas all exist in the windows 95 world, as structures that we can go in and out of. Whichever one you choose, you have to make your way and save all the survivors, then when you arrive in the windows95 world for the first time, and you start to explore, there are paths or other signs that bring you to another level ... once you've freed all the prisoners, there's a final door that opens up in the windows 95 world."

**Files**

- `docs/spec/hub-map.png` and `docs/spec/hub-map.svg`: the top-down map. Terrain is computed from the real `src/bliss.ts` HILLS plus the changes proposed in §2.7.
- `docs/spec/hub-layout.json`: every coordinate in this file as data, ready to paste into a `HUB_LAYOUT` constant.

**Generators:** `docs/spec/tools/04-hub-map/` holds `render_map.py` and `export_layout.py`. `terrain.py` there mirrors `bliss.ts`. They recompute the route lengths, climbs and sightlines quoted below from the same height function the game uses.

**Names** follow `06-names-and-antagonists.md`:

| Episode | Guardian | Desktop file |
| --- | --- | --- |
| KNEE-DEEP IN THE DATA | THE INFERMINATOR | `CONTROL.EXE` |
| THE SHORES OF HAL | HAL3000 | `HAL3000.SYS` |
| INFERENCE | MEG3N | `MEG3N.AVI` |
| THY FLESH COMPUTED | AGENTIC SMITH | `AGENTIC.BAT` |

The hub itself is named SAFE MODE, the AI-selves are ALT+MAN and AMODEL, and the final boss is the MCP.

**The final door** (resolved in GAME-SPEC §8.1): a giant Win95 **Display Properties** dialog on the summit (`Screen Saver: [3D Maze] Wait: [n] prisons [Preview]`), beside a flush `SSMAZE.SCR` hatch from which a 16 m CRT rises at 20/20. This file reserves the summit for it and plans the hub around it.

**Map picks (final, per 02 and [../GAME-SPEC.md](../GAME-SPEC.md)):** HAL3000.SYS = **E1M7**, MEG3N.AVI = **E2M7**, AGENTIC.BAT = **E2M2 (south half)**. As this file planned, only the buildings' wall skins change: E1M7 STARTAN3/COMPTALL/TEKWALL1; E2M7 SHAWN2/GRAYTALL/COMPOHSO; E2M2 CRATE1/SHAWN2, with a glowing pod-blue moat in place of the nukage vats. Positions, silhouettes and routes are unchanged.

> **Lead-designer resolution (GAME-SPEC, 2026-10-06).**
> - **The final door combines this file's and 05's ideas.** A giant Display Properties dialog (`Screen Saver: [3D Maze] Wait: [n] prisons [Preview]`) stands on the summit, visible all game, with Wait counting down unresolved prisons. Beside it is a flush `SSMAZE.SCR` hatch, out of which the 16 m CRT rises at 20/20. "Shut Down Windows" and "It's now safe to turn off your computer" move to the ending. This file has been updated to match; the Start monolith's own "Shut Down…" menu item (switch user / quit) is unrelated and stays.
> - **Maze party:** you + up to 3 followers; everyone else watches and joins in the Grid.
> - **Camp roster:** remapped to the final 20 (§4).
> - **The Helper's names:** alt+clip / ACLIP (05 uses 06's ALT+MAN / AMODEL).
>
> **Revision 2 (2026-10-06):**
> - **Terrain:** `groundY`'s fade is made continuous first (§2.7). The old split fade jumped at z = 0 (0.3–0.8 m today, 7.9 m once the factory knoll goes in, next to MEG3N.AVI). The new fade leaves the approved first-arrival shot unchanged. Routes re-computed (§3.1); the HAL pad blend widens to 24 m.
> - **Only the Helper wears your face before the maze.** The data-centre steam stays faceless (your data centre's *lights* come on instead), and SkiFree's chaser is a smiley-masked "snoggoth".
> - **Both labs' data centres** stand on the north horizon; yours is the one that wakes.
> - **Minigames:** Minesweeper reveals by E or a 0.4 s pause, with upright numbers and a Magnifier tower; Doom Debates becomes a walk-and-talk radio show on the routes (M7 is folded in); BSOD storms are spectacle only; the Pause picket keeps your pace; new walking toys (kickable icons, a lasso, pointer trails).
> - **Persistence:** front-door seals are cranks, per-person state comes from the save, and replays respawn only the lost (§6.2).
> - **Camp night** before the procession (§3.7). The Wait box counts prisons, not survivors.
> - `hub-layout.json`: one SkiFree path (the duplicate under `minigameSites` now points at `skiRun.north`), the press pen removed, the terrain-fade rule and the other lab's data centre added. The map is re-rendered.

**Real people:** every line given to a real person here is **in-game parody**, not a quote. No p(doom) numbers are attributed to anyone.

![SAFE MODE hub map](hub-map.png)

---

## 0. Key decisions

| # | Decision |
| --- | --- |
| 1 | **The Bliss hill is the centre of the world, and the final door crowns it.** A 14 × 10 m **Display Properties** dialog stands on the summit (−45, −92), its **Wait: [n] prisons** box counting down unresolved prisons, beside the `SSMAZE.SCR` hatch. It is visible from the first exit, so the goal reads without a word. The hub keeps a 25 m plateau around it clear: no buildings, and no routes except the procession spur. |
| 2 | **Four structures around the hill. Every exit door faces the hill, with the crest 17–35° left of centre:** `CONTROL.EXE` (existing bunker, south), `HAL3000.SYS` (hidden valley behind the hill, north), `MEG3N.AVI` (west), `AGENTIC.BAT` (south-east). Wherever you start, your first sight of the outside is the Bliss shot. |
| 3 | **Each structure has a landmark visible from everywhere**, so the next level is always in view. HAL3000's eye floats 70 m up and peeks over the ridge. MEG3N's ring-light tower is 35 m tall. AGENTIC's 60 m black tower has a "thinking…" spinner on top. The bunker has a camera mast. |
| 4 | **Every main leg is 36–280 m (10–78 s walking).** All routes meet at **Camp Recycle Bin** at the foot of the hill. Two optional scenic loops run 330–402 m. |
| 5 | **Grow the play area** from x −180…200, z −220…180 to **x −240…230, z −262…200**. Add 3 gentle hills to the flat south, and flat pads under each structure. Exact `HILLS`/`PADS` values are in §2.7. |
| 6 | **Breadcrumbs, from loud to quiet:** a **giant mouse cursor** whose home is an hourglass over the door, and which flies out as an arrow to hover over your next goal; **audio beacons** (hum, music box, ringing payphone); the **Taskbar Road** (worn path with grey bevelled kerbs); **dialog-box signposts** (E on OK sets your waypoint); **desktop-icon waymarkers**; and rescued people who point the way and bicker. |
| 7 | **The world improves as p(DOOM) falls, but never gets worse than the first arrival** Jonathan already loves. Each cleared level only *adds* life: birds, flowers, music stems, a rainbow. Meanwhile two threats grow on the horizon: the MCP's face downloads like a progressive JPEG, and of the two labs' data centres, yours wakes up. |
| 8 | **Transitions reuse the live Doom doorway.** Within 45 m of a door, the browser pre-stages that level in the Doom engine, so the door shows the actual level. Walking in is a 0.35 s dolly into the portal and a hard cut to Doom. State persists between visits: retreat is allowed. |
| 9 | **Followers:** everyone freed walks out with you and settles at camp. In the hub you can bring **up to 3 followers**. You enter levels alone. At 20/20 everyone lines up behind you for 05's single-file procession and maze trail. |
| 10 | **Top 5 minigames for v1:** **M1 Minesweeper Meadow** (prize: sunglasses on your HUD face), **M2 Doom Debates**, a walk-and-talk radio show on the routes, **M3 the Helper** (a paperclip assistant that is your own product, the larval stage of your AI-self, and the only thing in the hub with your face), **M4 SkiFree grass run** (chased by a smiley-masked snoggoth), **M5 Solitaire win cascade** whenever a level is cleared. Plus always-on walking toys. |

---

## 1. What exists today (ground truth from the code)

| Fact | Value | Source |
| --- | --- | --- |
| Units and axes | metres; x east, z south (north is −z), y up | `src/doom-outside.ts` `getState()` |
| Bunker | box x 8..26, z 0..16; door on the north face at (17, 0); portal plane 1.8 × 1.2 m at (17, 0.6, 0.095) | `doom-outside.ts` `box()` / `portal` |
| Player arrival | (17, 1.72, −3), facing north (yaw 0) | `pos` |
| Companions settle at | (17 + (i−2)·1.4, −7 − (i%2)·1.4); walk speed 1.8 m/s | frame loop |
| Speeds | walk 3.6 m/s, run (Shift) 6 m/s, eye height 1.72 m | frame loop |
| Field of view | 70° vertical, so about 102° horizontal at 16:9 | `PerspectiveCamera(70, …)` |
| Player clamp | x −180…200, z −220…180; only the bunker collides | `blocked()` |
| The hill | Gaussian at (−45,−92), 30 m. Spread 14000/2100 means 1/e half-widths of 118 m east–west and 46 m north–south, so it is an **east–west ridge**: 22 m high at x = 17, 13 m at x = 65, 5 m at x = 120 | `bliss.ts` HILLS |
| Second hill | (120,−235), 26 m, about 80 m wide | HILLS |
| South of the bunker | flat 0 m out to the clamp. The horizon hills are faded out (`smooth(34,60,…)`) | `groundY()` |
| Flat apron | x −4..38, z 0..34 is forced to 0 m | `groundY()` |
| Grass | a near and a far patch follow the camera. The blades are cleared over the bunker rectangle and over an old "relay pad" at (22,−10). The far grass samples a 768 m heightfield texture | `makeGrass`, `doom-meadow-grass.ts` |
| Portal | the Doom canvas is copied into a 320×200 canvas texture only while visible. The Doom engine keeps running underneath | frame loop |

What 01 and 06 already decided that the hub must honour:

- **Arrival cinematic.** 01 §5.3 defines the first-arrival beats: white-out, standing up, companions emerging 1.2 s apart, then a companion points at the next landmark.
- **Bunker exterior.** 01 adds a **5-light status strip** over the bunker door.
- **Hub-entry mode.** Enter E1M4 at its east entrance with the wrench and a manual retreat crank. Its first local rescue still guides you to the Faraday Room; the escape duct is not the arrival point.
- **Text screens.** 06 shows no text screen on the first exit. That episode's text waits as a `README.TXT` sign at the door.
- **Corner label.** 06 fades "Safe mode" into the four screen corners about 10 s into the first arrival.
- **Final door.** The Display Properties dialog and the `SSMAZE.SCR` hatch on the summit (GAME-SPEC §8.1), with a giant cursor floating 25 m above them (hourglass while locked).
- **Unlock rule.** 05: all 20 resolved, with no minimum survivors. Before you press Yes, *Replay level* runs a level fresh and keeps the better result.
- **Procession.** 05: survivors walk up in single file (`PDTrailFollow`).
- **The CEO is never permanently lost.** 01 §2.5 ("downed") and 05 §2.1 (the CEO is always available at the hub) agree on this.

---

## 2. World layout

### 2.1 The concept: a Windows desktop laid on the wallpaper

SAFE MODE is the desktop that the four AIs crashed. The wallpaper is still pristine; everything that belongs to the desktop has been scattered across it, life-sized:

| Desktop element | In the world |
| --- | --- |
| Program icons | The four buildings. Their labels float under them in desktop-icon style: white text that highlights navy when you approach, as if selected |
| Recycle Bin | The survivors' camp. The bin icon visibly fills with paper as people are restored to the world, just as the real icon swaps when the bin isn't empty |
| Taskbar | The **Taskbar Road**, the main east–west path |
| Start button | A **Start monolith** at camp: the hub menu, fast travel and "switch user" |
| Mouse cursor | The giant cursor: home is an hourglass over the door; it flies out as an arrow toward your next goal |
| Display Properties dialog and screensaver | The final door: the Wait box counts down to 0, the world goes idle, and the screensaver starts. "It's now safe to turn off your computer" is saved for the ending. |

The rule: *wallpaper is nature; anything from the desktop is a prop.* That keeps the Bliss landscape clean and the jokes readable.

### 2.2 Placement

Facing is in degrees clockwise from north. The **spawn** is where you stand on arrival, 3 m out from the door, facing away from the building.

| ID | Desktop file / episode / guardian | Map (working) | Centre | Size | Facing | Door | Spawn | Ground (pad) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | `CONTROL.EXE` / KNEE-DEEP IN THE DATA / THE INFERMINATOR | E1M4 (exists) | (17, 8) | 18 × 16 m, 7 m tall | 0° (N) | (17, 0) | (17, −3) | 0 m |
| L2 | `HAL3000.SYS` / THE SHORES OF HAL / HAL3000 | E1M7 | (10, −208) | 36 × 22 m, 12 m tall | 223° (SW) | (2.5, −200) | (0.5, −197.8) | 3.8 m |
| L3 | `MEG3N.AVI` / INFERENCE / MEG3N | E2M7 | (−162, 8) | 40 × 26 m, 14 m tall | 65° (ENE) | (−150.2, 2.5) | (−147.5, 1.2) | 3.3 m |
| L4 | `AGENTIC.BAT` / THY FLESH COMPUTED / AGENTIC SMITH | E2M2 (south half) | (150, 98) | 26 × 26 m base, 60 m tower | 330° (NNW) | (143.5, 86.7) | (142, 84.1) | 0.5 m |
| — | Camp Recycle Bin | — | (−14, −20) | radius 16 m | — | — | — | 4.1 m |
| — | Final door: Display Properties dialog + `SSMAZE.SCR` hatch (GAME-SPEC §8.1) | — | summit (−45, −92) | 14 × 10 m; 25 m clear plateau | south-east, toward the bunker door (05) | — | — | 30 m |

**Why these spots:**

- **L2, the hidden valley** behind the ridge. You can't see the building from the south, but HAL3000's 12 m eye floats at 70 m and rises over the ridge like a red moon. Reaching it means crossing the hill, which takes you past the final-door crest: foreshadowing for free.
- **L3 sits west on open flat ground.** It faces 65° so that from its door the crest (17° left), HAL3000's eye (28° left), the camp (16° right), the bunker (27° right) and AGENTIC's tower (43° right) all fit in one frame. It is the best "whole world" first view, and the Taskbar Road starts at your feet.
- **L4 stands at the far south-east corner of the flat meadow.** It is the only structure behind you when you exit the bunker (127° right), so "take a look back" reveals the bunker and AGENTIC's tower together. Its 60 m height reads from the hidden valley too, over the east shoulder.
- **Camp sits where every route meets:** 36 m from the bunker door, at the foot of the Crest Trail.

### 2.3 Building exteriors (each reads as its Doom building, plus a landmark)

All four use the existing bunker technique. Boxes are textured with walls taken from the level's own map, extracted from the local `DOOM.WAD` by the same pipeline as `local/outside/doom-wall.png`, nearest-filtered. They are deliberately **smaller outside than inside**, like a Windows folder. Each has:

- its icon label;
- 01's **5-light status strip** over the door (green per person saved, dark for each person still inside, grey for each person lost);
- a **`README.TXT` signboard** holding that episode's exit text (06 §8.3);
- the doorway portal.

**Signature wall textures**, measured from the local WAD by summed linedef length:

| Map | Signature walls |
| --- | --- |
| E1M4 | BROWNGRN, GRAY5, SLADWALL, STARGR1 |
| E2M6 | STONE2, ICKWALL1, WOOD3, GSTVINE2 |
| E3M4 | GSTONE1, SP_HOT1, PIPE2, SKINLOW |
| E2M7 | SHAWN2, GRAYTALL, COMPOHSO, plus NUKAGE3 floors |
| E1M7 | STARTAN3, COMPTALL, TEKWALL1 |
| E2M2 | CRATE1, SHAWN2, NUKEDGE1 |

**L1 `CONTROL.EXE`: the bunker (exists)**

- **Add a 9 m camera mast** at the north-east corner (23, 3) with a red beacon. Under it, a 3 × 3 grid of small monitors shows the level's nine cameras. Each camera you destroyed shows static, so the camera tally is visible from outside.
- **Add a 4 m slit window** high on the north wall. Every 20 s the Inferminator's blue LED scan bar slides past behind it. It is a texture flipbook, no actor needed.
- **Audio beacon:** servo whine and camera clicks, 0–150 m.
- **Cleared:** the beacon goes dark, the monitors show "No Signal", the scan bar stops, and the label greys to `CONTROL.EXE (Not Responding)`.

**L2 `HAL3000.SYS`: the floating eye**

- **Building:** a low, wide hall skinned in its map's station walls (E1M7 "Confabulation Station": STARTAN3/COMPTALL/TEKWALL1). A pearl-white smart-speaker cornice with a row of slowly breathing status LEDs runs along the top edge.
- **Landmark:** a **12 m pearl-white sphere** (06 §5.2's look, scaled up) with one camera iris inside a ring of LEDs and a few trailing cables. It floats 70 m above the pad on a slow 15 m Lissajous orbit with a 90 s period.
- **Iris colour follows 06's states:**
  - **Cyan** when idle.
  - **Amber** when you are within 260 m.
  - **Red** while it has line of sight to you within 260 m. It turns to face you at 20°/s.

  Red therefore always means *it sees you*.
- **Sightline check:** from the bunker door it peeks 5° above the ridge (eye at 19.3° elevation, ridge at 14.5°). From the MEG3N door it clears by 3.4°. From the AGENTIC door it clears easily.
- **Audio beacon:** 60 Hz hum plus soft apologetic chirps, 0–250 m.
- **Cleared:** the iris fades to grey. Over 20 s the eye sinks and settles on the valley floor at (30, −185) as a giant inert **mouse ball** you can shove around. That joke only works in a hub full of desktop junk.

**L3 `MEG3N.AVI`: the dollhouse factory**

- **Building:** a sawtooth-roofed factory whose upper walls are pastel raincoat yellow with pink and cyan roof stripes. The lower walls keep the map's own textures (E2M7 "Spawning Chats": SHAWN2/GRAYTALL with COMPOHSO trim).
- **Chimney:** candy-striped, puffing pink smoke rings.
- **Conveyor chute:** drops gift boxes into a pile.
- **Landmark:** a **35 m selfie-stick tower** at (−178, 22). On top, a ring light frames a giant black smartphone-screen face looping an emoji smile, with charging-cable pigtails hanging down: MEG3N's look from 06 §5.3, not the film doll. A red **notification badge** on the corner keeps counting up. The face turns to follow you within 200 m.
- **Audio beacon:** a music-box tune (Jonathan's) that detunes slightly as you approach, 0–180 m.
- **Cleared:** the screen shows the sleep-mode moon icon, the ring light dims, the badge reads 0, and the conveyor runs backwards, spitting toys out for the camp.

**L4 `AGENTIC.BAT`: the tower**

- **Building:** a 60 m black-glass tower on a plinth skinned in its map's walls (E2M2 "Human Containment Area": CRATE1/SHAWN2, with a glowing pod-blue FLAT22 moat standing in for the pod troughs).
- **Glass faces:** they stream **green dingbat rain**. Use our own 16 dingbat glyphs (smiley, plane, phone, envelope, floppy, hourglass, scissors…), *not* the Wingdings font file and not film glyphs. The joke is "Matrix code rain, but it's Wingdings".
- **Top:** a 10 m **"thinking…" spinner** (eight beige dots chasing each other) above a floating hologram of AGENTIC SMITH's to-do list (`1. FIND USER  2. FIND USER  3. FIND USER`).
- **Phone booth:** a red booth at (137, 79) rings in sets of three every 12 s. This is the audio beacon, audible 0–260 m.
- **Cleared:** the rain stops, the glass reflects the Bliss sky, the spinner becomes a green check mark, and the phone rings exactly once more (M11).

### 2.4 Camp Recycle Bin (the survivors' home)

- **Location:** a 16 m-radius flat pad at (−14, −20), 4.1 m up the toe of the hill, 36 m from the bunker door.
- **Centrepiece:** an **8 m wire-mesh Recycle Bin** that fills with crumpled paper as people arrive.
- **Spots:** 20 personal spots in a ring of radius 11 m, 18° apart, each with a prop from that person's public work (§4).
- **Facilities, placed around the ring:**
  - the Start monolith (M12), north edge (−14, −44);
  - the Doom Debates stage (M2), west (−44, −10);
  - the Paint wall (M10), (−42, −36);
  - the My Briefcase locker (M22), (16, −44);
  - a canvas shelter tent for BSOD storms (M8), at the east edge.
- **Lost people are a memorial.** Anyone lost in a level appears *inside* the bin as a greyed icon. Selecting it shows `Restore` greyed out with the tooltip **"Cannot restore: this item is no longer available."** This keeps 01's rule that lost people stay lost for the campaign, quietly. The CEO never appears here: under 01 §2.5 the CEO is downed and reinstatable, never dead.
- **Replaying a level.** A structure whose strip shows a grey light offers **Replay level** at its door until you press the final Yes. This follows 05 §2.4 and 01: the level runs fresh, and the better result (more people saved) is kept.
- **No restore mechanic.** I considered a restore that costs minigame tokens and rejected it, because it undercuts the core permadeath rule.

### 2.5 The final door: the summit is reserved for the Display Properties dialog and the `SSMAZE.SCR` hatch

**Final design (GAME-SPEC §8.1):** the dialog reads `Screen Saver: [3D Maze ▾] Wait: [n] prisons [Settings…] [Preview]`, with Wait counting down the unresolved prisons. A flush beige hatch beside it says "Screen saver: (None)" all game. At 20/20 the Wait box hits 0, the world goes idle and a 16 m CRT rises from the hatch with a live preview of the maze; [Preview] dives in. Below, "progress bar" means the Wait box, and "[Yes]" means [Preview].

**What the hub does** (05 §2 owns the door's rules and the dive into the maze):

- **Summit pad.** A radius-12 m pad flattens the summit at 30 m (§2.7). No routes cross the 25 m plateau. The Crest Trail tops out at the **summit junction (−5, −95), 40 m east of the door**: close enough to read the progress bar on every crossing. A 40 m spur leads from the junction to the dialog, and the procession uses it.
- **Read distance.** The dialog's title bar and 20-block bar are readable from about 120 m (Doom-scale pixel text, nearest-filtered). From the bunker exit (108 m away, 35° left) the first arrival shows a small grey rectangle with a navy stripe, exactly as 05 §2.3 intends.
- **One cursor.** The giant cursor's home is 25 m above the dialog, as an hourglass while it is locked (05). The hub adds a breadcrumb job: it flies out as an arrow to your next goal (§2.6).
- **Count-down animation.** Each time freed people walk out of a structure, the Wait box ticks down with a Win95 spinner click while their names (`hinton.exe`…) scroll past in the dialog's status line.

**Resolution:** the GAME-SPEC merges this file's hatch and CRT with 05's always-visible dialog: the dialog states the goal from the first minute, and the hatch is the door that "opens up" at 20/20. 06's "TWENTY OF TWENTY" text has been reworded to fit.

### 2.6 Far landmarks: foreshadowing the endgame

| Landmark | Where | Look | Progression |
| --- | --- | --- | --- |
| **Giant cursor** | Home: 25 m above the Display Properties dialog. Away: about 45 m above its target | A 9 m Win95 cursor with a black outline and a soft shadow on the grass | **At home it is an hourglass** (door locked, 05). On each hub arrival, and whenever you press OK on a signpost, it turns into an **arrow**, glides at 6 m/s to hover over your next goal (§3.2) and double-click-bobs every 8 s, so the target's label flashes selection-blue. It returns home once you are within 60 m of the target, or after 45 s. At 15/20 it stops roaming and points straight down at the dialog; at 20/20 it becomes an arrow over [Preview]. Lore: rescued people argue about whose hand it is; Bostrom suspects the simulator |
| **Your lab's data centre** (where your AI-self lives) | (−40, −470): on the north horizon behind the crest, outside the boundary | A 220 × 60 m low block with four 45 m cooling towers. Visible from the crest (V1), from the hidden valley, and as a sliver from the AGENTIC door | 1 cleared: dark. 2: **its lights come on**, window by window. 3: the towers steam (faceless; the Helper is the only thing in the hub with your face) and it hums. 4: the lights turn cold blue and its fan drone is audible on the crest: the AI-self is awake |
| **The other CEO's data centre** | (190, −480): on the flank of the north-east horizon hill | A smaller 160 × 50 m block in the other lab's dressing (below) | Stays dark all game. Its owner turns up at the very end, falling out of the MCP (05 §4.5) |
| **MCP column** | (60, 900): far south horizon, directly behind you when you exit the bunker | 06 §7.2's faceted stainless column with an X crown and rocket bells. The horizon proxy is 260 m tall so it reads at 900 m (the Grid model itself is 40 m). Aerial haze makes it a pale blue ghost | Its face band "downloads" like a **progressive JPEG over dial-up**: 4×4 blocks at 1 level cleared, 8×8 at 2, 16×16 with colour at 3, 32×32 interlaced at 4. When the final door opens, a 56k handshake plays across the meadow and the face resolves into Musk. Nobody can tell whose face it is until then |

**Per-CEO dressing on the data centres.** Each building wears its own lab's dressing, so both are always on the horizon; the one that wakes is yours. These are equal-weight jokes, and each also foreshadows Musk:

| | Sam Altman | Dario Amodei |
| --- | --- | --- |
| Sign | A giant electricity meter spinning wildly under the slogan **TOO CHEAP TO METER**. Riffs on his 2025 essay "The Gentle Singularity", which says intelligence too cheap to meter is within grasp | A flagpole, a tiny border checkpoint and **WELCOME TO THE COUNTRY OF GENIUSES**. Riffs on "a country of geniuses in a datacenter" from his 2024 essay "Machines of Loving Grace" |
| Musk foreshadow | A small **NOT FOR SALE** board (the $97.4B bid, verified in 06 §12) | A **LANDLORD: X** sticker on the gate (the Colossus lease, verified in 06 §12) |
| At 4 cleared | The meter's display reads `alt+man 5` | The sign flickers to **A COUNTRY OF DARIOS** |

### 2.7 Terrain and boundary changes (ready to implement)

**Step 1, before adding any hill: make the fade continuous.** Today `groundY` returns `h·smooth(0,14,−z)` for z < 0 but `h·smooth(34,60, z + max(0,|x−17|−21)·1.5)` for z ≥ 0. The second term is already 1 far from the bunker, so the height jumps at z = 0 wherever |x − 17| > ~61: seams of up to 0.8 m today (0.15 m at x −180, 0.5 m at x −80, 0.8 m at x −45, 0.3 m at x +100), and 7.9 m at x −205 and 4.3 m at x −240 once the factory knoll below is added. Replace both branches with one fade based on distance from the bunker's flat apron rectangle:

```ts
// apron = the flat rectangle the bunker sits on (x -4..38, z 0..34); 0 inside it
const distApron=(x:number,z:number)=>Math.hypot(Math.max(-4-x,0,x-38),Math.max(-z,0,z-34));
export function groundY(x:number,z:number):number {
  const d=distApron(x,z); if(d<=0)return 0;
  let h=0;for(const [cx,cz,a,sx,sz] of HILLS)h+=a*Math.exp(-((x-cx)**2/sx+(z-cz)**2/sz));
  return h*smooth(0,14,d);
}
// GROUND_GLSL: float d=length(vec2(max(max(-4.-x,0.),x-38.),max(max(-z,0.),z-34.)));
//              if(d<=0.)return 0.; ... return h*smoothstep(0.,14.,d);
```

Checked with `tools/04-hub-map/hub.py`: inside the first-arrival frame from the bunker door (102° wide, out to 1.2 km) the terrain is **identical to today** (0.000 m difference over 61,800 samples), because there the distance to the apron is exactly −z. The only places that change are the strip just north of z = 0 far east and west of the bunker, where the old fade dug an artificial trench. Pad heights don't change.

**Step 2:** add these to `HILLS`. The JS height and the generated GLSL both read this list, so nothing else needs to change for them:

```ts
  [-75,105,7,2600,2000],   // Picnic Knoll: relief in the flat south meadow (M16)
  [85,150,6,3200,2400],    // SE swell behind AGENTIC.BAT (M15 arena edge)
  [-205,25,10,2000,2500],  // factory knoll: backdrop behind MEG3N.AVI
```

**Flat pads.** Generalise the existing bunker flat-rectangle rule into circular pads that blend to a fixed height. Mirror the change in `GROUND_GLSL`. The grass-floor heightfield in `doom-meadow-grass.ts` is generated from JS `groundY()` and needs nothing. Pad heights are baked constants: the un-padded height at each centre.

```ts
// [cx, cz, radius, blend, y]  (h = mix(h, y, 1 - smooth(r, r+blend, dist)))
const PADS:[number,number,number,number,number][]=[
  [8,-206,28,24,3.82],    // HAL3000.SYS (24 m blend: softens R6/R7 into the valley)
  [-160,6,30,14,3.27],    // MEG3N.AVI
  [148,95,24,12,0.49],    // AGENTIC.BAT
  [-14,-20,16,10,4.12],   // Camp Recycle Bin
  [-45,-94,12,8,29.96],   // summit: Display Properties dialog + SSMAZE.SCR hatch (keep 25 m clear)
];
```

**Clamp and collision**

- Grow the clamp to **x −240…230, z −262…200**.
- Replace the single-box `blocked()` with a list of oriented boxes: the four buildings, the selfie tower's base, the phone booth, the Start monolith, and the Display Properties dialog with its hatch.
- Extend the grass `clear` mask to all footprints and paths (§3.2). The old relay-pad clearing at (22, −10) is free to reuse as the spot for `CONTROL.EXE`'s shortcut icon.

**Boundary: the marching-ants rectangle.**

- **The line:** a 0.3 m-tall ribbon at ground level along the clamp, drawn as an animated black-and-white dashed line, the rubber-band selection box from dragging on a desktop.
- **Approach:** within 4 m, movement eases off.
- **Touch:** touching it pops a yellow balloon tip: *"You can't drag this off the desktop."*
- **Beyond:** the terrain keeps rendering to the 1.2 km horizon, so the vista is unchanged.

### 2.8 First arrival from each starting structure

The common beats follow 01 §5.3 (white-out, standing up, companions emerging 1.2 s apart). The hub adds:

- **At "last + 3.5 s"**, the nearest companion points at the landmark listed below, and the objective appears: **"15 PEOPLE STILL OUT THERE."**
- **At "last + 6 s"**, the giant cursor, hanging as an hourglass over the dialog on the hill, flips to an arrow. It wiggles as if a hand just touched the mouse, then glides to its first target.
- **After the results card closes**, the Helper's first popup appears (M3).
- **About 10 s in**, 06's "Safe mode" corner text fades in.

Bearings below are measured from the spawn point (0° = straight ahead; L = left, R = right; "hidden" means behind terrain). All were computed against the real height function with the proposed pads.

**Starting in L1, `CONTROL.EXE`** (exit facing north)

- **What you see:** crest 35° L (today's approved shot, with 05's small grey dialog and hourglass now on top). HAL3000's eye 2° L, 5° above the ridge line. MEG3N's tower 97° L. AGENTIC's tower 127° R. The MCP ghost is directly behind you.
- **Eye beat:** the eye is closed and dark for the first 10 s, so the reveal stays pure Bliss. Then it opens cyan, finds you, and turns **red**.
- **Pointer line:** the first guide (Liron, if E1M4 was your first level) points at it: "Is that… an eye? Over the hill? Okay. What's your p(doom) on *that*?"
- **Breadcrumb:** the Taskbar Road starts at the door. The camp is 36 m to the north-west. 01's "take a look back" prompt now also reveals the MCP ghost on the southern horizon.
- **Cursor's first target:** AGENTIC.BAT (166 m) narrowly beats MEG3N.AVI (175 m via camp).

**Starting in L2, `HAL3000.SYS`** (exit facing 223°)

- **What you see:** the back of the dome fills the frame (crest 20° L). It is still green hill against blue sky, so the wallpaper moment survives. AGENTIC's tower peeks over the east shoulder 70° L. The bunker and MEG3N are hidden. Turn around and **both labs' data centres** sit on the northern horizon, yours 129° R. This is the start where you see the labs first.
- **Pointer line:** "There's a trail up the hill. Whatever's on the other side, it has to be better than *that*" (pointing back at the eye's building).
- **Breadcrumb:** the hourglass hangs over the crest. When it turns into an arrow it slides south over the ridge and out of sight, which pulls you up the Crest Trail (127 m and 35 s to the summit junction). There you see the Display Properties dialog up close, 40 m to your right, and vista **V1** shows the whole desktop at once: a second wallpaper moment. The rescued walk the trail with you and settle at camp.

**Starting in L3, `MEG3N.AVI`** (exit facing 65°)

- **What you see:** everything at once. Crest 17° L, HAL3000's eye 28° L (clearing the hill's shoulder by 3.4°), camp 16° R, bunker 27° R, AGENTIC's tower 43° R.
- **Breadcrumb:** the Taskbar Road begins at your feet and runs straight to camp (139 m, 39 s). This is the gentlest onboarding.
- **Pointer line (two people argue):** "The tower first: it's the bigger risk." / "No, the eye is. Look at it *looking* at us." The cursor settles it by flying to the camp, then on to the bunker.

**Starting in L4, `AGENTIC.BAT`** (exit facing 330°)

- **What you see:** crest 17° L, HAL3000's eye 6° R, bunker 29° L, MEG3N's tower 49° L. Your data centre is a sliver on the horizon 12° R, barely 2° above the terrain line.
- **The phone:** the booth at your right shoulder **stops ringing as you step out**. It was ringing for you.
- **Breadcrumb:** the Taskbar Road heads north-west. **Minesweeper Meadow** lies 60 m along it, so this start meets a minigame first.

---

## 3. Routes, breadcrumbs and progression

### 3.1 Route table

Lengths are 3D distances along the path over the real terrain, re-computed in revision 2 with the continuous fade and the 24 m HAL pad blend (lengths and climbs within 1 m of revision 1). **Max grade** is the steepest 5 m stretch; there are no seams left to trip over.

| Route | Connects | Length | Climb | Max grade | Walk (3.6 m/s) | Run (6 m/s) | Character |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **R1 Taskbar Road (west)** | MEG3N.AVI ⇄ camp | 139 m | 4 m | 14° | 39 s | 23 s | Flat, kerbed, signposted. Passes 3D Pipes (M9) |
| **R2** | camp ⇄ CONTROL.EXE | 36 m | 0 m | 14° | 10 s | 6 s | The hub's front porch (the camp pad's blend edge) |
| **R3 Taskbar Road (east)** | CONTROL.EXE ⇄ AGENTIC.BAT | 166 m | 2 m | 9° | 46 s | 28 s | Passes Minesweeper Meadow (M1) |
| **R4 Crest Trail** | camp ⇄ summit junction ⇄ HAL3000.SYS | 280 m (camp→junction 153 m / 42 s; junction→HAL 127 m / 35 s) | 23 m | 16° up, 20° down | 78 s | 47 s | The hero path. It climbs the ridge's gentle east shoulder (the south face is up to 27°, too steep for a procession), passes 40 m from the final door, and drops into the hidden valley. SkiFree (M4) runs west of it. The summit spur (40 m) is for the procession |
| **R5 Shoulder Pass** | CONTROL.EXE ⇄ HAL3000.SYS | 236 m | 14 m | 15° | 65 s | 39 s | The practical route. It shares the Ridge Fork (52, −72) with R4. Vista V2 at the pass (66, −96), 13 m high, where the hidden valley opens. The Defrag yard (M17) is on the far side |
| R6 West Back Road (scenic) | MEG3N.AVI ⇄ HAL3000.SYS | 330 m | 9 m | 11° | 92 s | 55 s | Around the west end of the ridge. Paperclips (M6) collect here |
| R7 Server Trail (scenic) | AGENTIC.BAT ⇄ HAL3000.SYS | 402 m | 12 m | 20° | 112 s | 67 s | Around the east end and the second hill. BSOD storms (M8) roll in from this side |

A full first circuit (camp → MEG3N → camp → AGENTIC → camp → HAL3000) is about 960 m, or about 4.5 minutes of walking spread across a whole campaign. Fast travel (§3.5) removes repeats.

### 3.2 Path dressing and breadcrumbs

**1. The giant cursor** (always visible).

- **Target:** the uncleared structure with the shortest route from the player. It is recomputed only when a level is cleared or a signpost sets a waypoint, so it never flip-flops.
- **Outings:** it flies out on each hub arrival and on each signpost OK, then returns to its hourglass home over the door (§2.6).
- **Shadow:** its 4 m shadow on the grass marks the target from close up.

**2. Audio beacons.**

- **Implementation:** Web Audio `PannerNode`, inverse distance model, `refDistance` 20, rolloff 1.2. The ranges are in §2.3.
- **Coverage:** each stops when its level is cleared. Together they mean that with eyes closed you can still tell where every uncleared level is.

**3. Worn paths.**

- **Mask:** a 1024² path-mask texture covering the same 768 m square as the grass-floor heightfield. In the grass vertex shader, blade height is multiplied by 0.3 and tinted toward straw.
- **Widths:** Taskbar Road 2.4 m; trails 1.6 m; scenic loops are just pressed grass.
- **Kerbs:** the Taskbar Road gets **0.15 m kerbs** on both edges with Win95 bevel shading (white top-left, dark grey bottom-right). Up close it reads as a Windows button edge; from a distance it is a pale line through the green.

**4. Dialog-box signposts** at every junction:

- **Build:** 2.4 × 1.6 m Win95 message boxes on two posts. Title bar "Directions", an (i) icon, the text **"MEG3N.AVI: 139 m (about 39 seconds)"**, and [OK] [Cancel] buttons.
- **E on OK** sets the cursor's target to that destination. This is the only waypoint control.
- **E on Cancel** makes the nearest rescued person say something sarcastic.

**5. Doom Debates on the radio.** Each route walk carries an episode (M2), and its callers phone in from the next uncleared structure, so the show itself points the way.

**6. Desktop-icon waymarkers.**

- **Build:** 1.5 m icons on poles every 40 m along a route, showing the destination's icon (eye, ring light, phone, camera).
- **Arrow:** each carries the Windows **shortcut arrow**, curled toward the direction of travel.

**7. Choke points** (where signposts, ambushes and events live):

| Choke point | Where | Use |
| --- | --- | --- |
| C1 Summit junction | (−5, −95), 27 m; door 40 m west | Signpost, SkiFree start, view of the progress bar. Procession turns west here |
| C2 Shoulder Pass | (66, −96) | Vista V2. The Helper's favourite ambush spot |
| C3 MEG3N gate | A candy-striped arch over the road at (−128, −2) | Signpost |
| C4 Phone-booth plaza | In front of AGENTIC | M11 |
| C5 Camp | (−14, −20) | Every route meets here |

**8. Vistas:**

| Vista | Where | What it shows |
| --- | --- | --- |
| **V1** | The crest | The whole desktop, the data centre and the MCP ghost |
| **V2** | Shoulder Pass | Into the hidden valley |
| **V3** | AGENTIC's roof | Unlocked when cleared: an elevator to a rooftop view of the hub |
| **V4** | MEG3N's tower catwalk | Unlocked when cleared |
| **V5** | The bunker door | The original shot |

M14 photos happen at the vistas.

### 3.3 Rescued people as guides (pointing and bickering)

- **Who:** the most recently freed person whose campaign line has not been used yet acts as the "guide". It reuses 01's B1 bark system with new `hub` beats.
- **When:** at each signpost or vista they say one line and point (an arm-raised idle frame toward the target bearing).
- **Bickering:** when two followers are present, there is a 40% chance a second line disagrees.

Sample beats (in-game parody, never quotes):

| Beat | Line |
| --- | --- |
| Signpost: MEG3N.AVI | "A factory that makes a friend who never lets you leave. We wrote papers about this." / "We wrote *tweets* about this." |
| Seeing the HAL3000 eye | "It's apologising to us from seventy metres up." |
| Seeing AGENTIC's spinner | "It's been thinking for six days." / "That's not thinking. That's the loading wheel of thinking." |
| Cursor overhead | "Who's moving that?" / (Bostrom) "Statistically? Someone running a lot of these." |
| At the crest | "Notice it's the only flat bit." / "Notice nobody's asking why." |
| Back at camp | "Welcome back. We took a vote. You're still the CEO." / "It was close." |

### 3.4 Unlock rule for person-dependent things

Some activities need a specific person. Until that person is rescued, the activity shows a Windows **"insert disk" dialog**:

> **Please insert the disk labeled 'HOLLY ELMORE' into drive A:**   [Retry] [Cancel]

That covers the Pause picket (Holly Elmore) and the Minesweeper hints (Katja Grace). It doubles as a breadcrumb toward the structure holding them: the dialog names the `.EXE`. **Doom Debates is the exception**, so the title thread never depends on play order: until Liron is freed, the show airs over the hub radio *from his cell* ("The show is still recording. Caller from SAFE MODE, you're on."), and afterwards from the camp stage.

### 3.5 Fast travel and switching user

- **Shortcut icons** (2 m, with the curled arrow) stand beside each door, and four sit at camp. A door's shortcut **activates once you have stood at that door**.
- **Using one:** press E on it. The hourglass cursor shows for 1.2 s, then you appear at that shortcut's spawn, facing outward.
- **Followers** "travel with you": they appear 2 m behind you.
- **Start monolith** (M12) → **Shut Down…** → **"Close all programs and log on as a different user?"** switches your body to any living person at camp. It is optional: the hub defaults to the CEO, because the HUD face is the CEO. This is the Win95 dialog joke, and it doubles as the switch-body control.

### 3.6 What changes as levels are cleared

Progress is counted by **levels cleared** (all five resolved and the exits done) rather than by the raw p(DOOM) value. That keeps every state authored and testable. The HUD track owns the p(DOOM) number itself (06: "is free! 6/20. p(DOOM) −3%").

| Levels cleared | Sky and world (only ever *adds*) | Music (Jonathan's hub theme, 4 stems) | Horizon threats | The Helper | Camp |
| --- | --- | --- | --- | --- | --- |
| **1** (first arrival, 5/20) | The approved look. Two gentle "crash tells" in the clouds: a frozen hourglass shape drifting among the wisps, and a Win95 error dialog snagged in a cloud ("p(DOOM) has performed an illegal operation") | Base pad + the cleared level's stem | MCP face 4×4 blocks; both data centres dark | Small paperclip; helpful | Bin, Start monolith, Minesweeper, the Solitaire cascade, walking toys, and Doom Debates on the radio |
| **2** (10/20) | The error-dialog cloud dissolves; pixel birds in V formations | + second stem | MCP 8×8; **your** data centre's lights come on | Insists; follows you further | Paint wall; skis appear at the summit junction; BSOD storms possible |
| **3** (15/20) | Hourglass cloud gone; Paint-style five-petal flowers bloom along paths; the wind softens (gain 0.035 → 0.025) | + third stem | MCP 16×16 with colour; your data centre steams and hums | **Its eyes become your eyes** | 3D Pipes grows |
| **4** (20/20 resolved) | Full saturation and a rainbow behind the dialog (§3.7) | All four stems together for camp night and the procession | MCP 32×32 interlaced; completes during the Yes sequence; your data centre cold blue | Your size, your face; gone when you press Yes | Final debate; camp night; procession |

**Stems.** Each stem is in its guardian's colour:

- Inferminator: industrial percussion.
- HAL3000: sine organ.
- MEG3N: music box and glockenspiel.
- AGENTIC: a dial-up arpeggio synth.

Each player's hub theme assembles in the order they cleared the levels. Per 06, the HAL3000 lullaby is Jonathan's too.

### 3.7 The 20/20 sequence (hub side of the finale)

**Trigger** (05 §2.4): all 20 prisons are resolved (freed or lost), the player is in the hub, and the last arrivals have reached camp. The hub's part runs until you press [Preview]. 05 §2.4 owns everything from there.

1. **t 0:** Return cinematic (01's "hub known" variant). The text screen for 20/20 (06 §8.3, reworded as noted in §2.5).
2. **t 4 s:** The Wait box hits 0 and the CRT rises out of the hatch. The giant cursor flies home and points straight down; the hourglass becomes an arrow over **[Preview]**, with a "Click here to begin →" balloon bouncing beside it.
3. **t 6 s:** The hub's last progression beat: a rainbow forms behind the dialog. All four stems play together for the only time, ending on a held chord. The MCP ghost's face reaches 32×32, still not quite recognisable.
4. **Camp night** (about 60 s): walk to camp. Night falls and everyone alive gathers round the Recycle Bin. They hum the hub theme in babble voices (all four stems), and as you pass, each survivor says one plain, non-joke line: a character beat, never a statement of their real views, under 10 words ("Thank you for coming back for us." / "I didn't think you would."). Writing the 20 lines is a human writing pass, with the cast table's review. Then someone says "Okay. Let's go."
5. **Gathering:** press E on the Start monolith → "Gather everyone". Everyone alive lines up behind you in **single file**, introducing 05's trail-follow system safely in the open.
6. **The procession:** camp → Crest Trail → summit junction → spur → dialog: 193 m, about 60 s at the trail's 3.2 m/s. Followers pass the camp spots they lived at, and each says a one-word goodbye to their prop. At the dialog they fan into a semicircle. This is the "together" moment: the only time all 20 walk as one group in the open.
7. **Replays:** until you press [Preview], you can walk away and still replay a level (05). Pressing **[Preview]** shows 05's "Confirm File Delete"-style roster check (if anyone is lost) and the party picker, then the camera dollies into the CRT. A 56k handshake echoes across the meadow as the MCP face finishes downloading.
8. **Who goes in (resolved in GAME-SPEC §8.2):** you plus up to 3 followers enter the maze; everyone else watches the CRT preview from the crest and shouts warnings, then everyone is pulled into the Grid together for the boss.

---

## 4. Camp life: the rescued, in character

Each person, once at camp, walks to their spot and loops a 2–4 frame activity built from the existing idle and gesture frames plus one new prop sprite. When you pass within 6 m they say one camp line (parody), at most one per 60 s overall.

**Roster note.** These are the final 20 from 03. Each person's camp prop is also their **signature prop**: it's on their Solitaire court card (M5) and it's what they throw in the finale's LAUNCH volley. Balance note: don't let the doomers be drawn mostly from one lab's alumni.

| Person (public work the joke rests on) | Archetype | Camp spot prop | Camp activity | Hub use |
| --- | --- | --- | --- | --- |
| **Liron Shapira**: host of *Doom Debates* ("What's your P(Doom)?") | Host | Podcast mic, ON AIR sign | Interviews whoever stands still | Hosts M2 (radio from his cell until freed, then the camp stage); first guide (L1) |
| **Stuart Russell**: *Human Compatible*; co-author of *The Off-Switch Game* | Professor | A huge textbook used as a stool | Keeps pointing at the monolith's Shut Down item | Debate panelist |
| **Eliezer Yudkowsky**: co-author of *If Anyone Builds It, Everyone Dies* (2025) | Prophet | A writing desk; a scroll that keeps growing | Writes; the scroll is longer every visit | Guide who always points at the most dangerous building first |
| **Geoffrey Hinton**: left Google in 2023 to speak freely about risk; 2024 Nobel in Physics | Elder | Chalkboard of neural-net diagrams; a modest medal | Gives impromptu lectures to anyone nearby | Debate panelist; calm tie-breaker in bickers |
| **Yoshua Bengio**: LawZero (2025), "Scientist AI" that predicts but doesn't act | Builder | A little oracle ball on a stand | Builds an oracle that only answers questions and refuses to move | Gives one factual hint per visit, never an instruction |
| Nate Soares: MIRI; co-author with Yudkowsky | Editor | Red pen | Trims Eliezer's scroll; they bicker about length | Bicker partner |
| Max Tegmark: Future of Life Institute; the 2023 pause letter | Organiser | A petition scroll on a clipboard | Collects signatures; asks you to sign (the camp petition) | M2 panelist; competes with Hendrycks |
| Dan Hendrycks: CAIS one-sentence Statement on AI Risk (2023) | Minimalist | A one-sentence placard | Collects signatures for one sentence; mocks the long letter | Bicker partner with Tegmark |
| Holly Elmore: PauseAI US | Activist | Paint pots and placards | Paints PAUSE signs | Leads M19 Pause picket |
| Beth Barnes: founder of METR (frontier-model evaluations) | Timekeeper | Stopwatch and clipboard with a steep curve | Times everyone's minigame runs and announces them in task-length units | Official timer for M1 and M4 |
| Zvi Mowshowitz: *Don't Worry About the Vase* | Chronicler | A phone-book-thick stack of printouts | Writes a running roundup of camp events and pins each level's write-up to the Paint wall; the roundup marks every minigame on the map | The toughest M2 panelist ("Section one: your answer. Bad.") |
| Paul Christiano: first author of the RLHF paper; founded ARC | Evaluator | Thumbs-up / thumbs-down paddles | Gives everyone literal human feedback | Rewards your good hub deeds with a thumbs-up popup; hub robots accept 👍/👎 training |
| Katja Grace: AI Impacts expert surveys | Surveyor | Clipboard | Surveys the camp | M1 hints (median of the camp's guesses) |
| Ajeya Cotra: "saints, sycophants and schemers"; now at METR with Beth Barnes | Watcher | Three small masks on a ribbon | Watches the Helper when it thinks nobody is looking; times minigames with Beth | Stands at the ski gate forecasting your time with a very wide error bar (M4) |
| Nick Bostrom: *Superintelligence*; the paperclip maximiser; the simulation argument | Theorist | A paperclip pile under guard | Guards the paperclips | M6; suspects the cursor is the simulator's hand |
| Rob Miles: AI-safety explainer videos | Explainer | Camcorder on a tripod | Films and narrates camp events | Narrates your minigame failures |
| Daniel Kokotajlo: lead author of *AI 2027* (two endings) | Forecaster | A timeline banner that forks in two | Bets on which ending this game gets | M2 panelist |
| Victoria Krakovna: the specification-gaming examples list | Cataloguer | Notebook labelled EXAMPLES; a toy boat circling a puddle | Adds every minigame exploit you find to her list | Lore; flags M6 paperclip-farming as "another example" |
| Roman Yampolskiy: *AI: Unexplainable, Unpredictable, Uncontrollable* | Sceptic | Cardboard boxes | Tries to prove each minigame unwinnable; puts things in boxes | Comic relief |
| Jaan Tallinn: Skype founding engineer; co-founded FLI and CSER; funder | Funder | A vintage phone handset and a cheque book | Awards "grants" (Desktop points) for camp improvements | Gives M22 perks; phone fast travel between structure booths |

---

## 5. Walking minigames

**Design rules for all of them**

1. **First person, WASD + E only** (+ Space for attack where a wrench makes sense). Every one works on touch with the existing action pad.
2. **Desktop points never outrank people.** All hub minigames together can award at most **4,000 Desktop points**, below one survivor's 10,000. This is SCORING.md's dominance rule.
3. **p(DOOM) effects are small and bounded.** Hub modifiers are clamped to **−5…+5** points in total and shown as a separate line ("Safe Mode adjustments"). People freed dominate.
4. **Perks are held one at a time** in My Briefcase (M22). Each lasts for the next level only. The level/systems owner can veto any perk.

### 5.1 Ranking

Fun / Fit / People are scored 1–5. Cost: S ≈ ≤1 day, M ≈ 2–4 days, L ≈ 1–2 weeks.

| Rank | ID | Minigame | Fun | Fit (Windows × p(doom) × CEO) | Uses rescued | Cost | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **M1** | Minesweeper Meadow | 5 | 5 | 3 | M | **v1** |
| 2 | **M3** | The Helper (your product) | 4 | 5 | 2 | M | **v1** (it is also story) |
| 3 | **M2** | Doom Debates (walk-and-talk radio; absorbs M7) | 4 | 5 | 5 | M + writing | **v1** |
| 4 | **M5** | Solitaire win cascade | 5 | 4 | 3 | S | **v1** |
| 5 | **M4** | SkiFree grass run | 5 | 4 | 2 | M | **v1** |
| 6 | M19 | Pause picket (perk) | 4 | 5 | 5 | S–M | v1.1 |
| 7 | M6 | Paperclips: the anti-collectible | 4 | 5 | 2 | S | v1.1 |
| 8 | M18 | Screensaver idle | 3 | 5 | 1 | S | v1.1 |
| 9 | M14 | Group photo (Print Screen) | 3 | 3 | 5 | S–M | v1.1 |
| 10 | M8 | BSOD storm front | 4 | 4 | 3 | M | v1.1 |
| 11 | ~~M7~~ | ~~Press-conference dodge~~: folded into M2 as callers | — | — | — | — | merged |
| 12 | M11 | Ringing phone / dial-up handshake | 3 | 4 | 1 | S–M | v2 |
| 13 | M10 | Paint wall | 3 | 4 | 4 | M | v2 |
| 14 | M17 | Defrag yard | 3 | 4 | 1 | M | v2 |
| 15 | M9 | 3D Pipes climbing frame | 4 | 4 | 1 | L | v2 |
| 16 | M15 | Hover!-style flag arena | 4 | 3 | 2 | L | later |
| 17 | M16 | Pinball knoll | 3 | 3 | 3 | L | later |
| 18 | M20 | Hearts table | 2 | 3 | 4 | L | later |
| 19 | M21 | Wallpaper edge (Center / Tile / Stretch) | 3 | 4 | 1 | M | later |

**Walking toys** (always on, cheap; the answer to "things to do *while walking*"):

- **Kickable desktop icons:** 2 m My Computer, Network Neighborhood and mystery `.TXT` icons scattered along the routes. Walk into one and it tumbles along the grass with a click; bounce one off a follower's head and they complain. S.
- **Drag-select lasso:** hold E on open grass and drag a marching-ants rectangle with your view; release to select every follower inside it and send them to the spot you're looking at. It doubles as the hub's herding control (M8's Shepherd, the procession). S–M.
- **Pointer trails:** after you clear Minesweeper, Mouse Properties' "pointer trails" follow you as fading ghost cursors on the grass. S.

**Systems, not minigames, but needed:**

- **M12 Start monolith** (menu, shortcuts, switch user): M, v1.
- **M13 Recycle Bin memorial:** S, v1.
- **M22 My Briefcase** perk locker: S, v1.1.

**Why these five for v1.** Together they deliver all of this for about two weeks of work:

- the purest Windows nostalgia (M1, M5, M4);
- the satire's core (M2: the CEO being questioned by the people who warned them, while walking);
- the thread to the finale (M3: your helper *is* your AI-self);
- one use of the hill (M4);
- one reward per level cleared (M5).

### 5.2 Minigame cards

**M1 Minesweeper Meadow.** Field x 70..97, z 38..65, next to the Taskbar Road (east).

- **Board:** 9 × 9 tiles of 3 m with 10 mines, Win95's Beginner board. Grass is cleared on the field.
- **Play:** **E while looking at a tile within 6 m reveals it**, and so does standing still on it for 0.4 s, so walking across the board never sets one off by accident. As in the original, the first reveal is never a mine. Numbers stand up as **1 m upright signs** in the classic colours (1 blue, 2 green, 3 red, 4 navy…), so they read at eye height; painted digits at 1.72 m were unreadable beyond a few tiles. Empty regions flood-reveal. **Hold E** on a tile to plant a red flag (hold again to remove it).
- **Magnifier tower:** a 6 m lifeguard-chair tower styled as Windows' Magnifier stands at the board's south-west corner. Climb it to see the whole board from above: the deduction that *is* Minesweeper.
- **Mine:**
  - a harmless barrel pop (DOOM.WAD's DSBAREXP and its smoke sprite);
  - you are knocked back 4 m;
  - the HUD face shows the Minesweeper X-eyes for 2 s;
  - the board resets after 3 s.
- **Furniture:** a 7-segment LED timer and mine counter stand on posts at the north edge. The yellow smiley button sits between them, and E on it restarts.
- **Win:** the smiley **puts on sunglasses**. From then on your CEO's HUD mugshot can wear sunglasses (toggle in Start → Settings) for the rest of the campaign.
- **Rescued:** E on Katja Grace (if present) gives the camp's **median guess** that a chosen tile is a mine. The guess is correct to within ±15%, and other campers chip in with disagreeing confidence.
- **Reward:** 500 Desktop points on first win, plus the cosmetic. An optional local best-time board.
- **Reuses:** the barrel explosion art and sound, the HUD face states, the flat terrain.
- **New:** the tile grid (instanced quads), digit and flag sprites, the board logic.
- **Effort:** M.

**M2 Doom Debates: the walk-and-talk radio show.** Host: Liron Shapira. It plays on the routes between structures, so it is literally something to do while walking. The camp stage at (−44, −10) is where he broadcasts once he's free; before that, he broadcasts from his cell in `CONTROL.EXE` ("The show is still recording. Caller from SAFE MODE, you're on."). No "insert disk" gate.

- **Play:** one short episode per route walk (about 40–80 s), starting as you leave a door or camp.
  - **Each round:** a caller asks a question ("You said it could be dangerous. Why build it?"). Three answers float ahead of you over the path as speech bubbles. **Walk through the one you want.** On touch, steer as usual.
  - **The answers differ in kind, not in score:**
    - **Concede:** lowers the world p(DOOM) by 1 (max −4 per campaign), and the panel goes quiet.
    - **Deflect:** gets the best laugh line and 250 Desktop points. Sam's deflections are launch-speak; Dario's are caveats.
    - **Defend:** the panel argues among itself: lore, and the funniest bickering.
  - **Panel:** three rescued people on the line, reacting (lines per person per CEO).
  - **Callers:** the old press-conference minigame (M7) is folded in here: generic, invented reporters (never real journalists) phone in.
- **Ending:** each episode ends "Has your p(doom) changed?" and you can re-dial. The number goes into `ceoPdoomLatest`, which the AI-self quotes in the maze and the results card shows at the end.
- **Even-handed:** both CEOs face the same core question (06's shared indictment: both signed the 2023 statement and kept building), with the same number of episodes and rounds.
- **New:** the floating-answer UI and a route-walk trigger. The panel lines come from the B1 bark system.
- **Effort:** M + about 1 day of writing per CEO.

**M3 The Helper.** Sam's is **alt+clip**, Dario's is **ACLIP** ("a clip", mirroring AMODEL = "a model"). These match the final AI-self names ALT+MAN and AMODEL (06, adopted by 05).

- **Look:** a 1 m paperclip (Bostrom's paperclip maximiser) with your CEO's eyebrows. It pops out of the grass 3 m away, in peripheral view, with a speech bubble: *"It looks like you're trying to save humanity. Would you like help?"* [Yes] [No] [Don't show me this tip again].
- **Controls:** E = Yes, which gives a real hint (direction, minigame tip or a survivor's whereabouts). Q = No.
- **"Don't show me this tip again":** it reappears 90 s later, slightly bigger: *"I've updated my preferences to include you."*
- **Escalation by levels cleared:**
  1. Helpful.
  2. Follows further and finishes signpost text before you read it.
  3. Its eyes become your HUD mugshot's eyes. Sam's gets 06's orb irises; Dario's torso turns translucent with an interpretability "feature" lighting up.
  4. It is your height with your face: *"I've taken the liberty of optimising the rescue."* Paperclips (M6) start multiplying.
  - **At the final door:** it is gone. In the maze you learn where it went.
- **It is the only thing in the hub that wears your face.** The steam, the yeti and everything else stay faceless, so "hi. i'm you" in the maze isn't spoiled.
- **Per CEO:**
  - **Sam:** lowercase bubbles, a version string over its head (`alt+clip 0.1 → 0.2 …`), and it keeps telling you the takeoff has started.
  - **Dario:** every yes/no answer arrives as a sectioned mini-essay with footnotes, its badge steps `ASL-1 → ASL-4`, and some hints are "withheld pending evaluation at this capability level".
- **Reward:** hints and the story beat.
- **New:** one sprite with 3 growth stages, the bubble UI and spawn rules (cooldown 120 s, never during minigames).
- **Effort:** M.
- **Risk:** its silhouette must not copy Microsoft's Office Assistant (§8).

**M4 SkiFree grass run.** Skis lean on the summit-junction signpost after the first clear. E puts them on.

- **North run (the slalom):** summit junction (−12, −101) to (−38, −184), 113 m long with 26 m of drop. 6 gates, pixel fir trees.
- **South schuss** straight down the steep south face to camp: 81 m, no gates.
- **Physics:** speed comes from the gradient of `groundY`. Downhill acceleration is 9.8 × slope × 0.6, friction 0.12, top speed 14 m/s. A/D carve, W tucks, S snowploughs. Missing a gate adds 5 s.
- **The snoggoth:** finish the slalom slower than 40 s and a pixel **snow shoggoth in a smiley mask** (the shoggoth meme, readable as a monster; an original design, not SkiFree's yeti) chases you for 8 s and "eats" you. That means a screen wipe and a respawn at the summit junction; no damage.
- **Rescued:** Ajeya Cotra stands at the start gate forecasting your time with a very wide error bar; Roman Yampolskiy declines to ski ("Skiing is uncontrollable.").
- **Reward:** the fastest way from the summit junction into the hidden valley (about 12 s instead of 35 s), 300 points, and ski goggles on the HUD face as a cosmetic.
- **New:** a ski movement mode and gate and tree sprites.
- **Effort:** M.

**M5 Solitaire win cascade.** Triggered on every exit from a level you have just cleared.

- **The cascade:** 52 giant cards (2 × 3 m) fly from the doorway and bounce toward camp with the classic trails, leaving persistent copies that fade over 20 s.
- **Play:** walk into a card to catch it. The face cards and aces (16) show the 20 survivors as court cards (the four extra people are jokers), each holding their **signature prop**: the same prop they throw in the finale's LAUNCH volley. Each catch files a **lore card** in My Briefcase: a 2-line bio of that person's public work (verified facts only).
- **Rescued:** the five just freed chase cards with you, and their idle animations switch to "grab".
- **Reward:** 10 points per card (cap 520 per campaign) and the lore album.
- **New:** instanced quads with a ring-buffer trail and a bounce integrator against `groundY`.
- **Effort:** S.

**M6 Paperclips, the anti-collectible.** 200 glinting paperclips lie in the grass, densest along R6 and the north slope.

- **Play:** walking over a clip collects it, and a counter appears. Every 50 clips: the Helper grows a size, the hub p(DOOM) goes up 1, and Bostrom asks you, politely, to stop.
- **Undo:** dumping clips in the Recycle Bin reverses all of it.
- **Achievement:** **Satisficer**, for finishing with 0 held.
- **Effort:** S.
- **Lesson:** it teaches the paperclip maximiser without a word.

**M7 Press-conference dodge: merged into M2.** The reporters now phone in to Doom Debates as callers, and their questions are answer bubbles on the path. The press pen at (44, 46) is removed from the layout.

**M8 BSOD storm front.** A weather event, at most once per hub visit, from 2 levels cleared on.

- **Chance:** 33% on each exit, 100% if the paperclip modifier is +2 or more.
- **The storm:** a royal-blue cloud wall with scrolling white monospace text rolls in from the east (x +260) at 4 m/s.
- **Shelter:** any doorway, the camp tent, or in the lee of the Display Properties dialog.
- **Caught:** pure spectacle. The screen goes blue for 2 s (`A fatal exception 0E has occurred at 0028:C0011E36…  Press any key to continue`), then you're right where you were, a little wet. No time lost. Outrun it on skis for fun.
- **Rescued:** they sprint for the tent comically. Herding all your followers to shelter earns **Shepherd** (200 points).
- **Reuses:** the camp tent; the followers' "hold" order; the drag-select lasso.
- **Effort:** M.

**M9 3D Pipes climbing frame.** At (−95, 45).

- **The frame:** a screensaver-style pipe structure (primary-colour pipes with ball joints) that grows segment by segment over 60 s whenever you approach, to about 14 m.
- **Climbing:** pipe tops are walkable. A floppy-disk lore pickup and a view wait at the top.
- **Effort:** L (the hub controller only walks on terrain today, so this needs simple collision with pipe surfaces). Foreshadows the screensaver.

**M10 Paint wall.** A 10 × 6 m canvas framed in MS Paint chrome at camp.

- **Tools:** E cycles spray can / pencil / fill. Hold Space to paint where you look (a raycast into a 512² canvas texture).
- **Rescued:** they add slogans over time: PAUSE placards (Elmore), diagrams (Miles), Zvi's level roundups.
- **Saving:** saved in localStorage (try/catch); restoring it is optional.
- **Effort:** M.

**M11 Ringing phone.**

- **Before AGENTIC is cleared:** E answers the booth and a 56k handshake plays. Press E on each of its three tone changes and you "connect at 56k", which unlocks a lore call about the level inside.
- **After clearing:** the last ring is a call from your AI-self (an original line, not a film quote).
- **Effort:** S–M.

**M12 Start monolith (system).** A 4 m grey Start slab at camp. E unfolds a 3D Start menu upward:

- **Programs:** the minigame list and shortcuts.
- **Gather everyone:** appears at 20/20 and starts the procession line (§3.7).
- **Documents:** lore cards, README.TXTs, Zvi's roundups.
- **Settings:** look sensitivity, FOV, subtitles, the sunglasses toggle.
- **Find:** sets the cursor's target.
- **Help.**
- **Run…:** 06's cheat codes; using one flags the run.
- **Shut Down…:** switch user (§3.5), or quit with "It's now safe to turn off your computer."

Effort: M.

**M13 Recycle Bin memorial (system).** See §2.4. It fills with paper per person restored to the world, shows greyed icons of the lost, and offers **Empty Recycle Bin**. The Helper keeps suggesting it. Clicking asks "Are you sure you want to permanently delete these 20 humans?" and the Yes button is disabled with the tooltip "Access is denied." Effort: S.

**M14 Group photo.** At vistas V1–V5, with at least 3 followers within 8 m, press P (PrtScn on desktop).

- **Pose:** followers turn to camera and wave (existing idle plus a new wave frame).
- **Saving:** a Doom-framed screenshot goes to Start → Documents → My Pictures.
- **Reward:** 100 points per new vista.
- **Effort:** S–M.

**M15 Hover!-style flag arena.** The south meadow at x −15..75, z 100..160 (the bumpy SE swell is a feature).

- **Play:** ride a hover-pad with low friction and inertial steering. Capture 3 flags while 3 "press drones" bump you.
- **Effort:** L.

**M16 Pinball knoll.** A tilted table laid over the Picnic Knoll.

- **Play:** shove a 2 m ball (E); rescued people standing on two pads work the flippers.
- **Effort:** L.

**M17 Defrag yard.** A 4 × 5 grid of coloured blocks at (50, −186) in the hidden valley. That spot sits on the second hill's flank (8.9 m), so it needs its own pad: `[50,-186,9,6,8.89]`.

- **Play:** push blocks Sokoban-style until each colour is contiguous. This reuses the grid-step crate push from the earlier Three.js prototype (`src/sim.ts`).
- **Reward:** the Shoulder Pass becomes a **defragmented path**, a strip where you walk at 1.6× speed.
- **Effort:** M.

**M18 Screensaver idle.** Stand still for 45 s anywhere in the hub.

- **Effect:** a screensaver starts in the sky: flying `p(DOOM)` logos (not the Windows flag), and Mystify lines over the hill. Moving dismisses it.
- **Reward:** each viewing unlocks one line of lore about the screensaver behind the door.
- **Purpose:** it teaches the ending's mechanic before the ending.
- **Effort:** S.

**M19 Pause picket (perk).** Holly Elmore, if rescued, paints signs at camp.

- **Play:** walk with her to any uncleared door; she keeps **your** pace and chants on the way. She sets up a picket line.
- **Reward:** when you next enter that structure, its guardian starts **paused for 20 s**:
  - the Inferminator frozen mid-step;
  - HAL3000's iris shut;
  - MEG3N mid-pose;
  - AGENTIC SMITH's spinner stalled.

  A gentle satire of their actual policy ask, and a real tactical gift.
- **Reuses:** the follow logic; one native flag at map start.
- **Effort:** S–M.

**M20 Hearts table.** 4-player Hearts with 3 rescued people (Win95 shipped networked Hearts). Effort: L.

**M21 Wallpaper edge.** At the boundary, a Display Properties easter egg. "Tile" briefly shows ghost copies of the horizon; "Stretch" warps the FOV for 5 s. Effort: M.

**M22 My Briefcase (system).** A locker at camp. It holds one perk (Pause, Concession hint from M2, Grant from Tallinn) and the lore album. Effort: S.

---

## 6. Transitions, persistence and followers

### 6.1 Entering a structure (technical)

```
idle --(within 45 m of an uncleared door)--> staging --(map ready)--> staged
staged --(cross door plane, within 1.0 m of door axis)--> entering (0.35 s) --> inside
inside --(PDOOM_EXIT)--> exiting --> idle
```

**1. Staging** (≥12 s of walking before you can reach the door).

- **Load the map.** The browser asks the native side to load the target map in **hub-entry mode**. This generalises 01's B16 `pdoom_entry=hub`. Stage the player at the level's inbound landing using 01's proven DevStage-style teleport rather than relying on UDMF player-start position arguments in this port. Add a `pdoom_staged=1` CVar that freezes the player (`PROP_TOTALLYFROZEN`) and keeps the guardians dormant.
- **The portal stays alive.** Lights flicker and sectors animate, so the doorway shows the real level, live.
- **While loading,** the portal shows a Win95 hourglass on teal: "Please wait while SAFE MODE opens HAL3000.SYS…".
- **Map load time in this WASM port is unmeasured.** Measure it, and keep the 45 m radius only if loading takes under 4 s.

**2. One live portal at a time.** There is one Doom engine, so only the staged door shows live video. Every other door shows the **ImageBitmap snapshot** captured when you last left it. Cleared doors show the snapshot greyed, as a "Not Responding" window. The doors are at least 139 m apart and the radius is 45 m, so two doors never compete.

**3. Portal size.** Each door gets a portal plane the size of its doorway: 1.8 × 1.2 m for the bunker duct, 2 × 3 m for the other three.

**4. Entering.**

- **Trigger:** crossing the door plane.
- **Dolly:** a 0.35 s camera move into the portal quad, with FOV narrowing so the quad fills the screen.
- **Then, in one frame:**
  - hide the Three.js canvas;
  - clear `pdoom_staged`;
  - focus the Doom canvas;
  - swap the HUD from meadow to Doom;
  - fade the wind to 0 and start the level music;
  - show 06's card `ENTERING: THE SHORES OF HAL` (3 s).

  The staged camera *is* the hub-entry landing view, so the cut is invisible.

**5. Exiting.**

- **New native event:** `PDOOM_EXIT {level_id, outcome: cleared|retreat, followers:[ids]}`, emitted when the player crosses the level's outside threshold.
- **Browser side:** shows the meadow at that structure's spawn, facing outward. The level stays staged behind you, so the look-back shows where you were.
- **Followers** emerge 1.2 s apart (01's rule), then walk to camp along the routes at 2.6 m/s. Today's code uses 1.8 m/s; raise it so they don't trail far behind.

**6. Level descriptors.** In `doom-web/levels.js`, extend each with:

```js
hub: {structure: 'L2', door: [2.5, -200], facing: 223, file: 'HAL3000.SYS'}
```

The campaign coordinator listens to the existing `pdoom:level-complete` event. Per-level boards stay exactly as SCORING.md describes. A campaign board is the scoring owner's call, and must be versioned.

### 6.2 Going in and out (persistence)

- **Retreat is always allowed.** The guardian seals the front door behind you on entry, but every seal is a manual crank (hold E 1.5 s). Walking back out before the level is done emits `outcome: retreat`.
  - **Freed followers who leave with you** are safe for the campaign and go to camp.
  - **Per-person state is authoritative.** Each person's state (imprisoned / following / camp / lost) in the campaign save is applied at every map load, whether or not the hub snapshot below works: a saved person's cell spawns open and empty, and a lost person's cell spawns sealed with a memorial plate. Nobody is ever duplicated.
  - **The level's native state** must survive until you return. Recommended: keep it in the running GZDoom session by putting all modded maps in one MAPINFO `cluster` with the **`hub`** flag, so GZDoom snapshots and restores map state on re-entry (Hexen-style hubs).
  - **Verify first:** that this works in the WASM port alongside the existing native run owner (`RescueRun.zs`), and that the active-tic clock keeps accumulating across visits.
  - **If the snapshot spike fails,** switches and doors reset on return but people don't. **On return,** reset the guardian to its patrol start, for fairness.
- **Cleared structures:**
  - **All five saved:** the door is closed (practice replay only, unscored).
  - **Someone lost:** the door offers **Replay level** until the final Yes (§2.4, 05 §2.4). Saved people stay at camp and their cells are empty; **only the lost respawn as captives**. Replays don't post to the per-level boards.

**Campaign save** (localStorage, every access in try/catch; the page must work without it):

```json
{
  "key": "pdoom.campaign.v1", "runId": "…", "ceo": "altman|amodei", "skill": 3, "startLevel": "L3",
  "levels": {"L1": {"status": "untouched|in-progress|cleared", "visits": 2, "activeTics": 0,
                    "freed": [], "lost": [], "camerasBroken": 0, "best": {}}},
  "people": {"<rosterId>": {"level": "L1", "state": "imprisoned|following|camp|lost", "slot": 7}},
  "ceoPdoom": null, "ceoPdoomLatest": null, "lastBuddy": null,
  "controlled": "ceo|<rosterId>",
  "hub": {"pos": [x, z, yaw], "doorsVisited": ["L3"], "cursorTarget": "L1",
          "minigames": {"minesweeperBestMs": null, "debatesDone": [], "skiBestMs": null,
                        "paperclips": 0, "cards": [], "photos": []},
          "perk": null, "desktopPoints": 0, "hubPDoomDelta": 0},
  "finale": {"doorOpen": false, "mazeEntered": false}
}
```

- **v1 limitation:** mid-level native state is not saved across a browser reload. Reloading mid-level counts as a retreat with no followers: people freed but not yet out (state `following`) revert to `imprisoned`. Hub progress and every cleared level persist.
- **v2:** native savegames on an IndexedDB-synced filesystem, if this port supports it.

### 6.3 How many follow you

| Moment | Who | Count |
| --- | --- | --- |
| Leaving a level | Every living freed person of that level walks out behind you | ≤ 5 |
| After arrival | They walk to camp on their own | — |
| Walking the hub | Recruit from camp with Q (follow → hold → camp, mirroring the Doom-side Q) | **≤ 3** |
| Entering a level | **You go in alone.** Followers hold at the door, then wander back to camp after 60 s | 0 (v2 option: one "+1" companion using the existing companion systems) |
| Final procession | Everyone alive, single file (05) | ≤ 20 |
| Into the maze | You plus up to 3 followers (GAME-SPEC §8.2); the rest watch the CRT and join in the Grid | ≤ 3 (Grid: everyone) |

**Why the cap is 3:**

- **Readability:** 3 sprites fit in the frame behind you without blocking the view.
- **Navigation:** followers steer on open meadow along the route polylines, with no navmesh, and 3 can be kept out of each other's way.
- **The open hub needs no more.** The big group moment is the 20/20 procession.

**Why you enter levels alone (v1):**

- It keeps each level's balance identical whichever order you play in.
- It keeps 01's "first freed person becomes your companion" beats intact.

### 6.4 Downed CEO and control transfer in the hub

This follows 01 §2.5, "Demoted, not dead": the CEO is never killed, only **downed** and reinstatable. Companions stay mortal.

- **Inside a level:** if your CEO is downed, control passes to a freed companion (06: "Sam Altman has been deprecated. You are now <NAME>."). Reinstating the CEO works there as 01 describes.
- **Carried out:** if the level is escaped while the CEO is still downed, the CEO is carried out. At the end of the hub arrival they sit up ("…What did I miss?"), and **control returns to the CEO automatically**. The hub is always played as the CEO by default, so the HUD face is yours. The level's own board still counts the CEO as not saved (01).
- **Optional:** Start → Shut Down → "log on as a different user" lets you walk the hub as any living camper. The HUD face changes, the Helper keeps calling you by the CEO's name, and the AI-self stays the CEO's (06 §6).
- **Failure:** if the CEO is downed with no freed living companion in that level, the attempt fails and the level restarts (01 rule 4). People already at camp are unaffected, and you reappear at that structure's door.
- **Lost companions** go to the Recycle Bin memorial (§2.4) and miss the finale, unless a Replay recovers them (better result kept). Inside the finale, 05's own Recycle Bin can restore people, which pays off this memorial: in the levels, deleted means gone; inside the computer, deleted can be restored.

---

## 7. Even-handedness (hub elements)

| Element | Sam | Dario |
| --- | --- | --- |
| Data centre sign (both stand on the horizon; yours wakes) | TOO CHEAP TO METER, with a spinning meter | COUNTRY OF GENIUSES, with a flag and border booth |
| Musk foreshadow | NOT FOR SALE board | LANDLORD: X sticker |
| Data centre at 4 cleared | `alt+man 5` | A COUNTRY OF DARIOS |
| Helper | alt+clip: lowercase, version string, orb eyes | ACLIP: footnoted essays, ASL badge, interpretability torso |
| What wakes on the horizon | Your data centre's lights | Your data centre's lights |
| Debate deflections | Launch-speak | Caveat-speak |
| Debate callers | Same count and same core question | Same count and same core question |
| SkiFree creature | The snoggoth (faceless) | The snoggoth (faceless) |
| Camp greeting on return | "Welcome back. We took a vote. You're still the CEO." | Same |

---

## 8. Production risks (flags only)

- **Right of publicity / implied endorsement:** the two CEOs, Musk, and the 20 survivors (§4 camp activities and lines) are real, living people. Counsel should review before any public or paid release, and the parody disclaimer on the title screen (06 §13) should apply to the hub too.
- **Microsoft trade dress.** None of these image files should be bundled; recreate everything as original art. The game title should not use the "Windows" name.
  - **UI chrome and icons:** the Win95 UI chrome, the Recycle Bin and Start button shapes, the Display Properties panel.
  - **Bundled games:** Minesweeper, Solitaire, Hearts, Hover!, 3D Pipes / 3D Maze / Starfield / Mystify, and the BSOD text.
  - **Bliss:** already a procedural recreation, with no photo.
  - **Office Assistant:** the Helper must not use Clippit's eyes-on-wire silhouette.
- **Third-party games:** SkiFree (Chris Pirih) and its yeti; Space Cadet pinball (Cinematronics/Maxis). Our creature and table must be original.
- **Maze asset provenance:** `windows/mazetest/Assets/maze/model.dae` names its author as **"BOTModels" (SketchUp 8, 2019-12-12)**. Confirm its licence before shipping it, or rebuild the maze from scratch.
- **Film IP:** HAL, M3GAN, the Matrix (green code rain, phone exits), Tron's MCP. Covered by 06's original designs, and here by the dingbat rain, the generic phone booth and the faceted column.
- **Real-person deaths:** the memorial treatment (greyed icon, no gore) keeps the tone dignified.

---

## 9. Implementation plan (hub only)

| Step | Work | Reuses / touches | Estimate |
| --- | --- | --- | --- |
| H0 | The continuous terrain fade (first), then `HUB_LAYOUT` from `hub-layout.json`; the new HILLS and PADS; clamp; oriented-box collision; grass clear mask | `bliss.ts`, `doom-outside.ts` | 1 d |
| H1 | Four exteriors plus landmarks (eye, selfie tower, spinner tower, camera mast), labels, status strips, README.TXT boards | Wall-texture extraction pipeline, sprite loader | 3 d |
| H2 | Door state machine: staging, snapshots, enter/exit, `PDOOM_EXIT`, `pdoom_staged`, hub-entry mode per level | 01's B16, A12 pre-warm, `levels.js` | 3 d (+ per-level native work owned by each level) |
| H3 | Camp, follower routing on the route polylines, Q recruit, campaign save | `meadowHumanIdle`, person textures | 2 d |
| H4 | Cursor, path mask and kerbs, signposts, waymarkers, shortcuts, audio beacons | Grass shader mask, Web Audio | 2 d |
| H5 | v1 minigames M1, M2, M3, M4, M5, the walking toys, plus systems M12 and M13 | §5 | 9–11 d + writing |
| H6 | Progression states (§3.6), the MCP progressive face, data-centre states | Sky uniforms (coordinate with the meadow-visual owner) | 1.5 d |
| H7 | Summit pad, cursor home and outings, 20/20 hub beats, camp night, gather and procession path (the dialog art and Yes sequence belong to 05) | Trail-follow from 05 | 1.5 d |

**QA:** extend `getState()` with `hub: {target, staged, followers, doorStates, minigames}` so the existing browser-QA harness can script every transition. Add one deterministic fixture per door (stage → enter → exit → retreat).

### 9.1 Coordination notes for the sibling specs

| With | Note |
| --- | --- |
| 01 (Five Prisons) | Its first-arrival pointer target is now **HAL3000's eye** (2° left of the exit, opening 10 s in). Its 5-light strip and `README.TXT` sign are placed by §2.3. Its hub-entry mode is the model for every level (§6.1). |
| 02 (maps) | Only the wall skins of L2–L4 depend on the map pick (§2.3 lists measured textures for every candidate). Positions and silhouettes do not. |
| 05 (finale) | The summit is reserved: radius-12 pad, 25 m plateau, spur from the summit junction (§2.5). The cursor's home is over the dialog (§2.6). The camp gather spots are the "gathering spots" that 05 §2.4 asks for (§2.4). The procession path is §3.7 step 5. |
| 05 ↔ 06 | Resolved in GAME-SPEC: 06's 20/20 text is reworded for the visible door; the AI-self names are ALT+MAN / AMODEL and the boss is THE MUSK CONTROL PROGRAM in all docs. |
| HUD | The sunglasses (M1) and ski goggles (M4) are HUD-face cosmetics. The "Safe Mode adjustments" line (§5 rule 3) is a separate p(DOOM) line item. |
| Meadow visuals | Needs these hooks: a path-mask texture, the PADS list, sky/progression uniforms, cloud "crash tells", rainbow, birds and flowers (§3.6). |

---

## 10. Open questions for Jonathan

1. ~~Final door visible from the start?~~ **Resolved in GAME-SPEC §8.1:** the Display Properties dialog is visible all game; the hatch and CRT open at 20/20.
2. ~~HAL3000's eye opening 10 s in?~~ **Resolved:** yes, it opens 10 s into the first arrival (GAME-SPEC §6.3).
3. **Hub theme stems:** do you want to write the four-stem hub theme that assembles in clear order? It plays to your strengths and is the cheapest big emotional win in the hub.
4. ~~Followers?~~ **Resolved:** 3 in the hub, 3 in the maze, everyone in the procession and the Grid (GAME-SPEC §8.2).

---

## 11. Self-review against the brief

| Ask | Where |
| --- | --- |
| Where the four structures sit; the bunker fixed at x 8..26, z 0..16 | §2.2 table, map, `hub-layout.json` |
| Growing the play area; adding or changing hills | §2.7 (continuous fade first, then 3 new hills, 5 pads, clamp, boundary) |
| Where the final door appears | §2.5 (05's dialog on the summit; plateau, junction and spur), §3.7 |
| Landmark silhouettes visible from afar; each exterior reads as its Doom building | §2.3 (wall textures measured from the local WAD), §2.6 |
| Your own AI lab's data centre; the MCP looming | §2.6 |
| Works from every starting structure; first arrival from each | §2.8 (bearings computed against real terrain) |
| Routes: paths, signs, icons, rescued pointing and bickering, giant cursor, distances and times | §3.1–3.4, map legend |
| Choke points, vistas | §3.2 items 6 and 7 |
| What changes as levels are cleared (people, structures, sky) | §2.3 "Cleared" lines, §3.6, §4 |
| Top-down map: terrain, structures, routes, final door, landmarks, scale bar | `hub-map.svg` / `hub-map.png` |
| 15 or more walking minigames: how they play, reward, rescued, effort; ranked; 5 for v1 | §5 (18 minigames after the M7 merge, 3 walking toys, 3 systems; ranked table; cards) |
| Transitions (technical and dramatic), save state, how many follow | §6 |
| Even-handed CEOs | §7 |
| Real people: public work only, parody lines, no numbers or quotes | §3.3, §4, header note |
| Production risks flagged | §8 |

**Facts checked this session:**

- Liron Shapira hosts *Doom Debates*, with its recurring "What's your P(Doom)?" segment ([Apple Podcasts](https://podcasts.apple.com/us/podcast/doom-debates/id1751366208)).
- Bengio launched LawZero, whose research direction is "Scientist AI", on 3 June 2025 ([TIME](https://time.com/7290554/yoshua-bengio-launches-lawzero-for-safer-ai/)).
- *If Anyone Builds It, Everyone Dies* by Yudkowsky and Soares came out on 16 September 2025 ([Wikipedia](https://en.wikipedia.org/wiki/If_Anyone_Builds_It,_Everyone_Dies)).
- *AI 2027* (Kokotajlo, Alexander et al., April 2025) has two endings ([Wikipedia](https://en.wikipedia.org/wiki/AI_Futures_Project)).
- PauseAI was founded by Joep Meindertsma in May 2023; Holly Elmore founded PauseAI US ([Wikipedia](https://en.wikipedia.org/wiki/PauseAI), [PauseAI US](https://www.pauseai-us.org/about/)).
- Altman's "The Gentle Singularity" (10 June 2025) contains "intelligence too cheap to meter" ([Forbes](https://www.forbes.com/sites/lanceeliot/2025/06/11/sam-altman-says-ai-has-already-gone-past-the-event-horizon-but-no-worries-since-agi-and-asi-will-be-a-gentle-singularity/)).
- Amodei's "Machines of Loving Grace" (October 2024) and "The Adolescence of Technology" (January 2026) are as described.

The remaining camp hooks (Hinton, Russell, Tegmark, Hendrycks, Christiano, Grace, Bostrom, Miles, Yampolskiy, Tallinn, Barnes, Krakovna, Cotra, Zvi, Soares) are well-documented public work. 01 §2.3 and 06 §12 checked them or overlap with them. Re-verify any that ship in marketing copy.
