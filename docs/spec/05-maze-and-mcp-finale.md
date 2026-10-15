# 05: The finale. `SSMAZE.SCR`, the 3D Maze chased by your AI-self, and the Musk Control Program

This track is **the endgame**: everything from the moment the 20th prison is resolved to the credits. It covers Jonathan's asks (2) and (4) for the endgame, and the endgame parts of (5). It also covers his follow-up: *"the final AI villain chasing you is an AI of yourself"*, and *"the end big bad from tron has elon musk's face."*

**Premise.** You play **Sam Altman or Dario Amodei**. Your Doom mugshot is the HUD face. You have all but destroyed the world, and the last 20 people alive are real figures from the AI-risk / p(doom) movement. The game is satire. Both CEOs get the same mechanics and difficulty, but each gets their own jokes, their own AI-self and their own epilogue. Neither one is "the good one".

Everything a real person "says" in this file is **in-game parody**, not a real quote. The only exceptions are phrases marked as verified public phrases, which are listed under Sources.

> **Lead-designer resolution ([../GAME-SPEC.md](../GAME-SPEC.md), 2026-10-06).**
> - **The final door** merges this file's and 04's drafts. A giant Display Properties dialog (`Screen Saver: [3D Maze] Wait: [n] prisons [Settings…] [Preview]`) stands on the summit, **visible all game**, with Wait counting down unresolved prisons. Beside it is a flush `SSMAZE.SCR` hatch, out of which the 16 m CRT rises at 20/20.
> - **The maze party of you + 3**, with the rest as the audience, is adopted.
> - **§4.4.3's perk casting** has been remapped to the final 20 from 03.
> - **The Question perk's MCP reply** no longer states Musk's public AI-risk percentage: the project rule is that no p(doom)-style number is attributed to a real person.
>
> **Revision 2 (2026-10-06):**
> - **The catch is an impersonation** (§3.6.2). The AI-self takes on your exact look and the head of your trail; followers come back only when you prove who you are with your own p(doom). It replaces the acqui-hire/recruit tag-back, which was the same verb as SMITH's possession.
> - **Maze 1 is about 90 s of "copycat"** (§3.4): your AI-self replays your movements a second late, glimpsed through grille windows, until it starts moving *before* you.
> - **The habit model trains all game**: junction turns and loud/quiet route choices from all four Doom levels, refined in Maze 1. It also quotes **who you lost**.
> - **Only the Helper wears your face before the maze** (04): the data-centre steam stays faceless and SkiFree's chaser is a smiley-masked snoggoth.
> - **Each boss phase adds at most two new threats.** The Phase 1 de-rez sweep is cut; Phase 3's gaps move by your AI-self's trick instead of reversing every 6 s. Shield perks now trigger on sinks and posts.
> - **LAUNCH is a roll call:** every survivor throws their own signature prop, with a name tag. When the column falls, **the other CEO tumbles out**, held as Musk's tenant or acquisition, and the last shot is both CEOs on the crest, nodding awkwardly.
> - **Camp night** comes before the procession (04 §3.7), and the results card closes the loop: `YOUR p(DOOM): 37% → 12%`.
> - **Wait: [n] prisons** (it counts unresolved prisons, including confirmed losses).

**Built on the other tracks.** This file takes these decisions as given and designs the play around them:

| From | Decision this file uses |
| --- | --- |
| **06** names and antagonists | AI-selves **ALT+MAN** (Sam) and **AMODEL** (Dario): their looks, signature mechanics and 12 barks each (06 §6). Final boss **THE MUSK CONTROL PROGRAM (MCP)**: its look, phase hooks and taunts (06 §7). Discs are glowing **floppy disks**. Maze card, Grid card and ending texts (06 §8.4–8.5). Hidden replay entry **SIGMOID** (06 §3.4). |
| **04** Bliss hub | The final door is **`SSMAZE.SCR`**, a hatch on the crest at (−45, −92). Beside it a giant Display Properties dialog is visible all game; at 20/20 the world goes idle and a 16 m CRT rises from the hatch (04 §2.5, §3.7; GAME-SPEC §8.1). The procession, the MCP "ghost" on the south horizon, and your lab's data centre. The final 20-person roster is 03's. |
| **01** Five Prisons polish | **"Demoted, not dead"**: the CEO is downed, never killed, and can be reinstated (01 §2.5). Deaths are a non-gory **derez** dissolve. Lost companions miss the finale unless a level replay recovers them. Paperclips are a campaign collectible. |

**Files from this track:**

| File | What it is |
| --- | --- |
| `docs/spec/05-maze-and-mcp-finale.md` | This spec |
| `docs/spec/05-maze1-jonathan-layout.png` | Maze 1: Jonathan's actual `model.dae` layout, annotated |
| `docs/spec/05-maze2-seed1982.png` | Maze 2: generated maze (seed 1982), annotated |
| `docs/spec/05-mcp-arena.png` | Top-down plan of the Grid arena |
| `docs/spec/05-maze-assets.png` | Reusable maze textures and the rat from Jonathan's Unity project |
| `docs/spec/05-maze-grids.json` | Machine-readable wall grids, feature cells and Doom-unit sizes for both mazes. The map generator reads this. |

---

## 0. Decisions at a glance

1. **The door rule is forgiving.**
   - `SSMAZE.SCR` (04) wakes when all 20 prisons are **resolved**: freed, or the loss confirmed. It never needs 20 living people.
   - You can replay levels from the hub until you press **[Preview]**. Pressing it locks in the roster.
   - **Maze party: you plus up to 3 followers.** Everyone else watches from the crest, through the CRT "preview", and shouts warnings. They are digitized into the Grid for the boss. This matches Jonathan's wording: "you make your way through the maze… all the humans have to come there."
2. **The maze is a GZDoom map, not Three.js.**
   - **Layout:** a 16 × 10 grid of 256-unit cells whose walls can move.
   - **Two mazes:**
     - **Maze 1, "Training Run":** *Jonathan's actual `model.dae` layout* (14 × 9). Your AI-self only watches and learns your turning habits.
     - **"The screensaver restarts":** the walls rebuild on screen.
     - **Maze 2, "The Screensaver Never Ends":** a classic screensaver maze, seed 1982 (the year *Tron* came out), 16 × 10.
   - **Assets:** Jonathan's brick, wood, ceiling-tile and globe textures, plus every authentic set piece: floating Start button, OpenGL logo, rat, grey flipping rocks, smiley-face exit and overlay map.
3. **The AI-self uses your habits against you.** Both AI-selves share one habit layer on top of 06's mechanics:
   - **Turn-bias model:** trained in Maze 1, it picks ALT+MAN's Alt+Tab blink targets and AMODEL's intercept routes.
   - **Ghost footprints** show you what it predicts you'll do.
   - **Out of distribution:** touching a grey rock flips the world upside down, which mirrors your habits, so its predictions fail. This falls out of the system; it isn't scripted.
   - **Campaign stats and quotes:** it quotes your own stats, **who you lost**, and your p(doom) back at you.
   - **Impersonation:** a catch makes it look exactly like you, and your followers follow it until you prove who you are.
   - **The Deal:** a Win95 dialog offer. Accepting it gives the secret bad ending.
4. **Inside the computer, nobody dies; they get derezzed, and derezzed people can be recovered.**
   - In the maze, a catch makes your followers trail the AI-self, wearing your face, until you win each back with your p(doom).
   - In the arena, a downed human is **absorbed** into the MCP. A volley through the gap frees them.
   - When the MCP falls, everyone still absorbed is freed.
   - Permanent loss remains the rule of the four Doom levels. In the finale, mistakes cost time, score and a harder boss, never a person.
5. **Boss fight recommendation:** identity-disc volleys (now **floppy volleys**) at the core, from Jonathan's idea. One **light-cycle "Grid Run"** phase. Every rescued person's perk is an **automatic** ability, with no micromanagement. More survivors means more floppies per volley and a longer light-cycle wall: a faster, bigger-feeling fight. Phases use 06's hooks: **POSTING → GRID RUN → COMMUNITY NOTES → LAUNCH**.
6. **The climax mirrors the end of Tron.**
   - Flynn jumps into the MCP's beam; Tron throws the disc. Here the MCP tries to **launch for Mars**. The CEO, the User who built all this, **walks into the launch beam**. The shield shatters, and **the humans throw the final volley** at the engine bells: `RAPID UNSCHEDULED DISASSEMBLY.`
   - p(DOOM) reads **0%** for the first time in the game.
   - In a full rescue the CEO uninstalls their AI-self and the meter **stays 0%**. In a partial rescue the CEO does what they always do: Sam posts, Dario writes an essay. The AI-self comes back, and the meter ticks up.
7. **Pacing:** the endgame runs about 18–23 minutes including credits (about 15–18 of play), with a checkpoint at every segment.

---

## 1. What already exists in "Windows Didn't Load Correctly" (read-only inspection)

Source: `../windows/`. Nothing there was modified.

### 1.1 The maze model

`mazetest/Assets/maze/model.dae` is a SketchUp 8 Collada file by "BOTModels", dated 2019-12-12, in inches, Z-up. The **same file** (md5 `fc0289d6cee92805508f3a13eea9f989`) is also in `windows3/Assets/Windows/Objects/maze/model.dae` and `windows3-working/Assets/Windows/Objects/maze/maze.dae`. Parsing every triangle gives the following (data in `05-maze-grids.json`):

| Property | Value |
| --- | --- |
| Grid | **14 × 9 cells**. Every wall sits on the cell grid; the only exception is the globe quad. |
| Cell pitch | 544.6 × 468.8 in (13.8 × 11.9 m), slightly non-square. The Doom build uses square 256-unit cells and keeps the topology. |
| Wall height | 366.7 in (floor z −132, ceiling z 234.7) |
| Topology | 156 open internal edges, so **31 loops**. 12 dead ends, 15 open four-way cells, diameter 22 cells. Much loopier than the real screensaver, whose mazes have no loops. That suits a no-threat training run. |
| Meshes | 15 wall meshes use `material_4` (brick). One ceiling mesh `ID22` uses `material_1`; one floor mesh `ID167` uses `material_2`. One two-triangle quad `ID182` uses `material_3`, the **globe picture**, on the north outer wall over column 6. |

![Maze 1](05-maze1-jonathan-layout.png)

### 1.2 Textures

These are faithful to the screensaver's defaults: "brick walls, a wooden floor, and an asbestos tile ceiling", with globe pictures on the walls. See `05-maze-assets.png`.

| File | Format | Use in Doom |
| --- | --- | --- |
| `material_4.bmp` | 128×128 24-bit red brick | Wall texture `MZBRICK`, scaled so one tile covers 192 units (one wall height) |
| `material_2.bmp` | 64×64 24-bit wood | Floor flat `MZWOOD`. Already the native Doom flat size. |
| `material_1.bmp` | 33×33 4-bit grey stippled tile | Ceiling flat `MZTILE`, nearest-neighbour resampled to 64×64 |
| `material_3.bmp` | 256×256 8-bit globe/toys picture from the cover of the OpenGL Programming Guide | Wall panel `MZGLOBE`, used as orientation landmarks |
| `windows3/Assets/Textures/rat1.png` | 250×120 RGBA photographic rat, side view | The rat sprite. **Its origin is unknown**; regenerate an original before public release. |

![Assets](05-maze-assets.png)

### 1.3 What Jonathan already built, and what each piece becomes

The scripts are C# in `windows3/Assets/Scripts` and `windows3-working/Assets/Scripts`.

| Script / object | What it does | Reuse in p(DOOM) |
| --- | --- | --- |
| `MazeAesthetics.cs` | Black linear fog out to 30 m; swaps a random wall's material every 10 s. `OnMazeComplete()` removes the fog, with the comment "Could also do a camera fly-through here". | Black sector fade. A psychedelic wall-texture flicker as the AI-self's proximity warning. On completion, the fog lifts and the camera **flies over the maze** (§3.9). |
| `MazeFirstPersonController.cs` | Simple walker (3 m/s) | The maze uses normal Doom movement; the AI-self's speeds are expressed relative to it |
| `MazeRoofToggle.cs` | Hides the ceiling mesh `ID22` | Raise every ceiling for the top-down reveal shots |
| `RandomMazeSpawner.cs` | Drops an invisible trigger at a random point on floor `ID167` | Inspiration for random seeds in the post-game Screensaver Mode |
| `MazeTriggerModal.cs` | Win95 modal: "MAZE SEQUENCE DETECTED — Remember this pattern:" followed by 8 random L/R steps | The giant **Settings dialog** on a maze wall (§3.3). Also the core idea that the maze is a sequence of left/right choices, which is what the AI-self models. |
| `MazeGateController_v2.cs` + `MazeEntranceDialog.cs` | A gate that needs 9 collected Macs (`requiredMacs = 9`) and shows "You need 9 computers" | The same gate logic as `SSMAZE.SCR`'s "Wait: 20 prisons" (04) |
| `Billboard.cs` | Camera-facing rat sprite | Doom sprites are billboards already; the rat only needs a left/right mirror |
| `windows3-working/.../MAZE.unity` | Waypoints (0)–(7), `MAZE-EXIT`, `LevelStartDialog`, `mazemusic`, `other-room-song` | Same structure: start card, exit, maze music |

The same folder has more reference images: `BSOD.png`, `W95screen.png` (Display Properties, which is the basis for 04's CRT panel), `minesweeper.png`, `W95solitaire.png`, `mouse.png`, `floppy.png` (06's floppy weapon) and `program-manager.png`.

---

## 2. The final door: finale-side rules for `SSMAZE.SCR`

04 owns the hub object and its 20/20 sequence (§2.5, §3.7):

- A beige hatch on the crest at (−45, −92), about 30 m up. All game, pressing E on it shows "Screen saver: (None)."
- Beside it, **visible all game**, stands a giant Display Properties dialog: `Screen Saver: [3D Maze ▾] Wait: [n] prisons [Settings…] [Preview]`, where n counts the unresolved prisons (GAME-SPEC §8.1).
- At 20/20 the Wait box hits 0 and the world goes idle. A 16 m CRT rises out of the hatch, showing a live preview of the maze.
- E on **[Preview]** dollies the camera into the screen.

This section adds the rules the finale needs.

### 2.1 When it opens: the forgiving rule

| Rule | Detail |
| --- | --- |
| Open condition | All **20 prisons resolved**: released, or the death established. This is the existing `PDRescueRun` / LEVEL-01 definition, aggregated by the campaign coordinator through `pdoom:level-complete`. |
| Minimum survivors | **None.** The CEO alone can go in (solo finale, §4.5). |
| Replays | Until [Preview] is pressed, each hub structure offers *Replay level*. The **best survivor set** counts (01 §2.5, 04 §6.4). |
| Commit | Pressing [Preview] while anyone is lost shows a Win95 "Confirm File Delete"-style box: "These 2 people can't come with you: [names]. [Go anyway] [Not yet]". |
| CEO | The CEO enters if reinstated. 01's "Demoted, not dead" means the CEO is always available at the hub. If the player is driving a camper through 04's "log on as a different user" option, the door switches them back to the CEO first: "Logging on as Sam…". |
| Wait-field gag (suggestion to 04) | Before 20/20, the Display Properties `Wait:` field counts *remaining unresolved* prisons (`Wait: [3] prisons`). It echoes WDLC's "You need 9 computers". |

### 2.2 Choosing the maze party

- **Party: you plus up to 3 followers.** By default these are your current followers (04's Q recruit). With no followers, the default is the first three people you freed, if they're alive.
  - At [Preview], a small Win95 list box lets you swap people: "Select up to 3 programs to run in the screen saver". You can confirm in one click.
  - Why 3 (agreeing with 04): 3 sprites keep the fogged corridors readable. Each impersonation is a real loss to win back. The trail never jams.
- **Everyone else** gathers in a semicircle around the CRT (04's procession end) and watches the preview, which gives you a **live audience** (§3.5).
- **Fallback:** if Jonathan wants the full 20-person escort through the maze, the trail system (§3.5) scales to 20. That needs the cost note in §6.4, and an impersonation would then lead the whole tail away.

### 2.3 Foreshadowing, start to finish

| When | What hints at the ending | Owner |
| --- | --- | --- |
| Every hub visit | The `SSMAZE.SCR` hatch you can walk over all game, and its "Wait: 20 prisons" box | 04 |
| Each level cleared | The MCP "ghost" on the south horizon downloads its face like a progressive JPEG. Of the two labs' data centres on the north horizon, yours wakes up: lights at 2 levels, cold blue at 4. No faces. | 04 |
| Hub minigames | The paperclip Helper (larval AI-self): **the only thing in the hub with your face**, so the maze reveal isn't spoiled | 04 |
| Your p(doom) | Asked by your first rescue in the campaign, re-asked by Liron and by each Doom Debates episode (04 M2). **Your AI-self quotes it, and your followers use it as a password** (§3.6.2, §3.7.3) | 03, 04 → 05 |
| Every level | Your junction turns and loud/quiet choices are logged for the habit model (§3.6.1) | levels → 05 |
| Every derez death | Doom deaths become a pixel derez dissolve, the same visual as Tron absorption | 01 |
| Inside the levels | Optional: a freed person who reaches the hub first-time says "That hatch on the hill… it isn't for one person." | 05 suggestion |
| Maze 1 | The AI-self watches you and never attacks. "Training Run." | 05 |

### 2.4 From the CRT to the maze

1. **E on [Preview].** The camera dollies into the CRT screen (04). 06's card: `SSMAZE.SCR / THE SCREENSAVER / IT LEARNED EVERYTHING FROM YOU. IT LEARNED IT FASTER.`
2. The Doom engine loads `MAZE01`. This is the reverse of the bunker-door handoff that already works: the engine keeps running underneath the meadow.
3. You stand in Maze 1 in front of a floating Start button, with your party behind you. A Win95 status line at the bottom reads `Preview — 17 watching`.

**Alternative considered:** my first draft had a standalone "Shut Down Windows" dialog monolith on the crest, followed by the shutdown, then "It's now safe to turn off your computer.", then the line "Nobody turned off the computer.", then the screensaver. 04's idle-into-screensaver sequence is more logical (screensavers start when the computer is idle) and is already integrated. The shutdown dither and "It's now safe…" ideas move to the ending (§4.6).

---

## 3. The Maze

### 3.1 Implementation: GZDoom (recommended) vs Three.js

| | **GZDoom map (recommended)** | Three.js scene (like the meadow) |
| --- | --- | --- |
| Look | Pixel-faithful to a 1995 OpenGL screensaver: flat walls, nearest filtering, fog | Smoother; would need deliberate pixelation |
| HUD | The existing Doom status bar, p(DOOM) estimate, face and named dialogue work unchanged | A second HUD to build |
| Followers | `PDCompanion` sprites (8 angles), health, `+THRUSPECIES`, existing control transfer and 01's downed/reinstate | Re-implement sprite actors, collision, pathing |
| Chaser | `PDHunter` already has movement, footsteps, wind-up, stun/immunity and door logic; the AI-self extends it | New AI |
| Geometry | Orthogonal grid walls are trivial classic sectors; walls can move with floor movers | Trivial too |
| Upside-down flip | `A_SetRoll` rolls the player camera in GZDoom's hardware renderer; the status bar stays upright | Easy |
| Risk | Roll and fog need verifying in the WASM GLES port (§6.4) | Two renderers and two companion systems to keep in sync |

**Decision: GZDoom.** `MAZE01` is a new UDMF map generated by script from `05-maze-grids.json`. It does not modify an original E1–E3 map. That rule exists for the authentic Doom levels, and the screensaver has its own source to be authentic to.

### 3.2 Geometry: one map, a grid of moving walls

| Parameter | Value |
| --- | --- |
| Grid | **16 × 10 cells**, pitch **256** Doom units (240 open + 16 wall). The map is 4096 × 2560. |
| Wall height | **192** (ceiling 192, floor 0). The model's ratio of wall height to cell size was 0.78; this is 0.75. |
| Corner pillars | 16 × 16 sectors at all 187 grid corners, always solid |
| Edge walls | One **16 × 240 thin sector per possible wall**: 17 × 10 vertical + 16 × 11 horizontal = **346 wall sectors**, tagged `2000 + edgeIndex`. Closed: floor at 192, solid, brick lower texture. Open: floor at 0. |
| Cell floors | 160 cell sectors, `MZWOOD` floor and `MZTILE` ceiling |
| Total | About 700 sectors and 2,800 linedefs (E1M4 as modified has 149 sectors). Use `docs/spec/maps/tools/` as the style reference for the generator. |
| Light and fog | Uniform light 208 (the screensaver was unlit). Sector fade `#000000`, tuned so a 3-cell corridor (768 units) stays legible and 5 cells away is black. |
| Textures | `MZBRICK` with `TEXTURES` scale 0.667, giving chunky 48-unit brick courses. `MZWOOD`, `MZTILE`, `MZGLOBE`, and `MZPSYCH1-4` (new, original animated psychedelic pattern via `ANIMDEFS`). |
| Maze 1 placement | Jonathan's 14 × 9 occupies grid columns 1–14 and rows 0–8. Column 0, column 15 and row 9 stay closed. |

**Why the walls move** instead of building two static mazes:

1. The "screensaver restarts" rebuild can play out on screen.
2. ALT+MAN's bark "shipping a small update to the maze" can be literal (§3.7.4, optional).
3. Post-game **Screensaver Mode** can generate a random maze every time, like the real screensaver.

Walls rise with the native `Floor_MoveToValue`. Before raising an edge, the controller checks that no actor is within 24 units of it; if one is, it waits a tic and checks again.

### 3.3 The screensaver, faithfully: what each element does in play

| Screensaver element | Look in Doom | Gameplay |
| --- | --- | --- |
| **Floating Start button** (every maze starts at one) | Win95-style [Start] sprite, 96 × 40, gently bobbing in the start cell's opening. Use a generic four-colour square, not the Windows logo. | Spawn marker; walking through it clicks. In Maze 2 your AI-self **boots out of it** 20 s after you leave. |
| **Floating "OpenGL" logo** | Rotating logo sprite | Maze 1: at A5, the first thing you see. Maze 2: **checkpoints** at G2 and C10. Touching one saves the party and AI-self state and tops everyone up to at least 60 health. |
| **Globe pictures on walls** | `MZGLOBE` panels (Jonathan's `material_3`) | Landmarks you can name out loud ("left at the globe"). Maze 1: north wall of A6, exactly where the model has it. Maze 2: A1, E8 (the Deal junction), I1, B16, H12. |
| **The rat** | `rat1.png` as a single-rotation billboard, mirrored by travel direction; 48 units long; squeaks | Walks the **right-hand-rule** route from start to exit at 200 u/s. That is slower than the shortest route but never wrong: Maze 1 takes 36 cells against a 20-cell shortest route, Maze 2 takes 74 against 52. Following it is a valid strategy, and your AI-self knows that (§3.7). |
| **Grey rotating polyhedra ("rocks")** | 16-frame rotating flat-shaded grey icosahedron, rendered in Blender, 64 units | Touch one and you **flip upside down**. The camera rolls 180° over 1.0 s (`A_SetRoll` stepped each tic with `SPF_INTERPOLATE`): wood overhead, tile underfoot. While flipped, turn and strafe are mirrored so screen-left stays your left. Lasts until the next rock. Rocks are used up. Accessibility option: "Instant flip, no roll". |
| **Translucent smiley-face exit** | Yellow 50%-alpha smiley sprite, 96 units, spinning slowly | The exit. Fires when the party is within 2 cells, or after 6 s of waiting. |
| **Overlay map** (a screensaver setting) | Doom's own automap in overlay mode (`am_overlay`) in the screensaver's colours: you are a blue triangle, start red, smiley green, rocks rotating white triangles, OpenGL logos fixed white triangles, rat orange. `MapMarker` actors draw the icons. | Unlocked by ticking a box on a giant **Settings dialog** on the wall of dead-end C8 in Maze 1: "☐ Overlay map" and "☐ Auto-solve (*requires Administrator*)" (greyed out, a joke). Draws only cells you've seen. Your AI-self appears as **a blue triangle with a red outline**, because it is also you, and only while you have line of sight to it. |
| **Psychedelic texture option** | `MZPSYCH` animated wall | Proximity warning: walls within 2 cells of the AI-self flicker psychedelic for 0.3 s every 2 s |

### 3.4 Structure and timeline

```
[Preview] ─► MAZE 1 "Training Run" (Jonathan's 14×9) ─► Rebuild (20 s) ─► MAZE 2 "The Screensaver Never Ends" (seed 1982, 16×10) ─► smiley ─► BSOD ─► THE GRID
               AI-self watches and learns; no attacks                    AI-self hunts with 06's mechanics + your habits
```

#### Maze 1, "Training Run" (target about 90 s; image in §1.1)

| Item | Cell(s) | Notes |
| --- | --- | --- |
| Start | **A6** (dead end, facing west) | Start button in the A5 opening; globe on the north wall to your right; OpenGL logo at A5. Bark from a follower: "Is this… the 3D Maze screensaver?" |
| Exit (smiley) | **I14** (south-east corner) | Shortest route 20 cells (5,120 units) |
| Rocks | **D7** (route step 8), **H11** (step 16) | D7 teaches the flip; H11 flips you back |
| Settings dialog | **C8** dead end, off the route | Overlay map |
| Rat | starts at **A6** | Right-hand rule, 36 cells |
| **Copycat** (the whole run) | 6 new grille windows (`MZGRILLE` midtexture) in internal walls along the route, including D3–D4 and C11–D11 | A ghost actor sits at **your own position from 35 tics (1 s) ago, offset one cell sideways**, and is drawn only when that spot is visible through a grille. So you glimpse yourself in the next corridor over, a second behind. Stop and it stops. Look at it and it looks back. The HUD face does a double-take the first time. Toast: `ALTMAN.EXE is observing.` / `AMODEL.DLL is running an evaluation.` Cheap: no pathing, no collision. |
| "Training complete" | the last grille before **I14** | The replay lead flips from −1 s to **+0.5 s**: it moves *before* you do, predicting your inputs from the habit model. |
| AI-self reveal | beside **I14** | Waiting at the smiley: reveal line, then it fades as you touch the smiley |
| Training telemetry | every junction cell | Each exit from a junction (3 or more openings) is logged relative to your entry heading as **L / S / R / Back**. Choices made upside down go into a separate mirrored table. |

#### Rebuild: "the screensaver restarts" (20 s set piece; the chase and party are frozen)

1. The fog lifts. All ceilings rise to 2048 (the `MazeRoofToggle` idea) and a camera actor rises to z 1600 for a **top-down shot of Maze 1 in brick**, which is also the screensaver overlay-map look.
2. The **walls rearrange**: 346 edge sectors move to the Maze 2 layout with stone-grind sounds, staggered west to east over 4 s. Toast: "Display settings changed: 800 × 600" (Maze 1 used 14 × 9 inside the 16 × 10 grid).
3. The camera dives to **A1**. The party is placed in trail order in A1–A2, and the Start button floats in the A2 doorway. A HUD hourglass bar runs for **20 s**: "ALT+MAN is starting up…" / "AMODEL is loading safety framework…".

#### Maze 2, "The Screensaver Never Ends" (target 4–6 min)

Seed 1982, generated by recursive backtracker plus 50% braiding:

- **Shortest route: 52 cells** (13,312 units)
- Right-hand-rule route: 74 cells
- 8 loops and 9 dead ends; wrong branches run up to 18 cells deep

![Maze 2](05-maze2-seed1982.png)

| Item | Cell(s) | Notes |
| --- | --- | --- |
| Start | **A1** (dead end, facing east) | Start button. The AI-self boots out of it at t = 20 s, **behind you**. |
| Exit | **J16** (south-east corner) | |
| OpenGL checkpoints | **G2** (route step 17), **C10** (step 35) | Save the party and the AI-self's state; top up health |
| Rocks | **E6** (middle of row E's 7-cell straight), **D11** (junction), **J12** (junction 4 cells from the exit), **B13** (dead-end pocket, an optional spare) | Each is a tool for breaking its model of you |
| AMODEL's ASL lines | Painted across the route at **D1, E7, B10, I11** (route steps 13, 24, 34, 44) | 06 §6.2. ALT+MAN runs show nothing here; its version bumps come from checkpoints and stuns (06 §6.1). |
| The Deal | First arrival at **E8** (globe junction), or t = 150 s | §3.7.5 |
| Rat | starts at **A1** | Right-hand rule, 74 cells (about 95 s) |

### 3.5 The party: the trail, and the live audience

**Trail follow** (`PDTrailFollow`, a new follow mode on `PDCompanion`; the light cycles reuse it in §4.4):

| Rule | Value |
| --- | --- |
| Breadcrumbs | Your position every 8 units, in a ring buffer of 4,096 points |
| Spacing | Follower *i* targets the breadcrumb at arc length (*i* + 1) × **40** behind you |
| Shortcutting | A follower that can see a later breadcrumb within 96 units skips ahead, so your loops and wiggles get pruned |
| Collision | Followers are non-solid to the player and to each other while trailing, so you can walk back through your own party |
| Speed | Followers catch up at up to run speed (583 u/s). The maze uses normal Doom movement: walk about 292 u/s, run about 583 u/s. |
| Dead ends | When you turn back, the party walks to the dead end's tip and back. Dead ends cost time and expose whoever is last. |
| Exit | The smiley fires when the party is within 2 cells, or after 6 s. Anyone still held by the AI-self doesn't come (§3.8). |

**The live audience.** The other survivors are watching the CRT preview on the crest, and they shout through the existing named dialogue, at most one line every 8 s:

- **Warnings:** "IT'S BEHIND YOU!" when the AI-self is within 3 cells but not in your view.
- **Gags:** "Left! No, your other left!"
- **Their own perk voice:** for example the Spotter archetype (§4.4.3) says "It's going to blink to the junction past the globe."

This keeps all 20 people in the finale without 20 actors in the maze, and it costs nothing to render.

**HUD:** the freed counter becomes `PARTY 3/3 · WATCHING 17`. The cameras slot becomes `ROCKS r`.

### 3.6 Your AI-self: 06's design, plus the habit layer

`PDAISelf : PDHunter` reuses `PDHunter`'s movement, footsteps, door handling, `StunUntil` / `ImmuneUntil` and wind-up. Movement goes **cell to cell on the grid graph**, which is cheap and never gets stuck.

**Names, looks, signature mechanics and the 12 barks each come from 06 §6:**

- **ALT+MAN**: one fast copy that **Alt+Tab blinks** ahead, then stops for a **launch pause**, and gets a new version number with each release.
- **AMODEL**: a slower original that leaves **a country of Darios** (copies that call out your position), stops at **ASL lines** to run evals, and has a **caveat stall**.
- **Looks** (06): both are flat-shaded and low-poly, as if the screensaver rendered them, about 64 units tall, with 8-angle walk sprites.
  - ALT+MAN: a lanky figure in a crewneck and jeans, translucent at the edges like a window being dragged, with glowing iris-scanner-orb eyes and a lowercase version string overhead.
  - AMODEL: a neat, curly-haired, bespectacled figure with its hands always mid-gesture, a translucent "interpretability" torso where features light up, and an `ASL-n` clip-on badge.
  - This track adds one detail to both: when a catch winds up (0.6 s telegraph before the 30-damage hit), its face flickers into **your own HUD mugshot**.

**Speeds in Doom units.** 06 wrote speeds as ratios to the hub's 3.6 m/s walk. The maze maps those ratios onto Doom's walk speed (about 292 u/s):

| 06 value | Ratio to walk | In `MAZE01` |
| --- | ---: | ---: |
| ALT+MAN base 4.0 / cap 5.6 | 1.11× / 1.56× | **324 / 454 u/s** (cap stays below the 583 run) |
| AMODEL base 3.3 / cap 4.6 | 0.92× / 1.28× | **267 / 373 u/s** |
| AMODEL copies 3.0 | 0.83× | 243 u/s |
| Catch range "0.8 m" | — | **64 units** (actor radii make 0.8 m too small in Doom) |

**What this track adds on top of 06 (identical for both CEOs):**

#### 3.6.1 The habit model

1. **Training.** It has been learning all game. Every Doom level logs your choices at junction nodes of its nav graph (L / S / R / Back relative to your entry heading) and whether you took loud or quiet routes, in a new `PDOOM_RESULT` field (`habits: {turns, loud, quiet}`). Those counts are the prior. In Maze 1, every junction choice updates P(L, S, R, Back | entry heading), with Laplace +1 smoothing (about 10–15 more decisions), and it keeps learning in Maze 2.
2. **Prediction.** From your last known cell and heading, it rolls out your most likely choices **two junctions ahead**.
   - **ALT+MAN** uses that cell as its **Alt+Tab blink target**. 06 says "a junction 3–5 cells ahead on your likely route"; this model *is* the likely route.
   - **AMODEL** paths its original to that cell to **intercept**. Copies left at junctions it passes call out your position (06).
   - With line of sight, both simply chase.
3. **Telegraph: ghost footprints.** When the AI-self is within 5 cells, faint footprints in **your colour** appear in the branch it expects you to take at your next junction: lowercase sticky-note arrows for ALT+MAN, `[fn]` footnote marks for AMODEL. You can see exactly what it thinks you'll do, so you can do the other thing.
4. **Out of distribution (emergent).** Choices are logged relative to your **screen**. Upside down, screen-left is world-right, so your habit is mirrored in world space and its intercepts land on the wrong side. It needs 4 upside-down decisions to fill its flipped table.
5. **The rat.** If you've followed the rat for 6 or more cells, it targets the rat's next right-hand-rule cell instead.
6. **Campaign memory.** It reads the levels' `PDOOM_RESULT` fields (`cameras_broken`, `routes`, `habits`, losses **by name**), your paperclip count (01), and **your p(doom)** (`ceoPdoom` and `ceoPdoomLatest`). It quotes all of these back at you.

#### 3.6.2 Catching, stunning, counterplay

| Event | Rule |
| --- | --- |
| **Catch: impersonation** (06) | Within 64 units: 30 damage and knockback. Card: `ALTMAN.EXE IS NOT RESPONDING.` / `AMODEL.DLL IS NOT RESPONDING.`, then `YOUR FOLLOWERS ARE FOLLOWING THE WRONG YOU.` In the same instant the AI-self **swaps to your exact CEO sprite** and takes the head of your trail (`PDTrailFollow` re-targets its breadcrumbs), so all your followers now follow *it*. You see two of you. |
| **Winning them back** | Reach a follower and press E. They challenge you: "Prove it. What's your p(doom)?" A dial appears (the same 0–100 dial as the first rescue). Match your first answer (`ceoPdoom`) or your latest (`ceoPdoomLatest`) within ±3 and they rejoin your trail. The AI-self answers wrong, in character, as a speech bubble: ALT+MAN "zero. obviously. next question." / AMODEL "Somewhere between ten and— with significant uncertainty—". Follower: "That's not what you said." A wrong dial costs 3 s before they'll ask again. Cotra in the party never follows the impostor ("That's not you. You'd have hedged."). |
| Wrench stun (existing close strike) | ALT+MAN is knocked out 3 s, then **re-released** as the next version (+8% speed, 06). AMODEL's original pauses 3 s ("I'm initiating a pause." … "The evals came back fine."). Each **copy** dissolves in one hit ("Being deprecated responsibly.", 06). A stun **breaks the disguise and drops everyone following it**; they run back to your trail. Immune for 15 s afterwards. |
| CEO downed in the maze | 01's rule: control passes to a follower, and holding E for 1.5 s at the CEO reinstates them. With no followers, you return to the last OpenGL checkpoint. |
| Counterplay | Break your habits. Use the rocks. Use loops (it intercepts, so circling an island wrong-foots it). Use the wrench. Exploit the launch pause, ASL evals and caveat stall (06). Listen to the audience. |
| Balance target (06) | The **same median time to first catch** for both AI-selves: 45–60 s for a first-time player on *Scale me plenty*, tuned with automated maze runs before any public leaderboard |

#### 3.6.3 Skill scaling (06's skill names)

| Skill | AI-self speed | Blink / copy cadence | Ghost footprints |
| --- | --- | --- | --- |
| I'm too aligned to die | 0.85× | 0.7× | Always shown |
| Hey, not too FOOM | 0.92× | 0.85× | Within 6 cells |
| **Scale me plenty** (baseline) | 1.0× | 1.0× | Within 5 cells |
| Ultra-Intelligence | 1.08× | 1.2× | Within 3 cells |
| Paperclips! | 1.15× | 1.4× | Off |

### 3.7 Extra lines (equal for both), the Deal, and the optional maze edit

06's 12 barks each are the core set. These are additional **maze-specific** lines in the same voices (lowercase for ALT+MAN, long sentence case for AMODEL). All are parody. `{…}` fields come from telemetry.

#### 3.7.1 Training-run and reveal lines

| Trigger | ALT+MAN | AMODEL |
| --- | --- | --- |
| First copycat glimpse | "don't mind me. just collecting some training data." | "Please, continue. I'm observing before I act. That's just responsible." |
| Later glimpse | "you turned {dir} again. noted." | "You turned {dir}. I'm writing that down. (Footnote fourteen.)" |
| Reveal at the smiley | "hi. i'm you, but i scale." | "Hello. I'm you, with a constitution." |
| Training complete (it moves first) | "ok. i think i've got you." | "My evaluation of you is complete. The results are… concerning." |
| Impersonation | "hey guys. it's me. the real one. follow me." | "It's me. The original. I have the documentation." |

#### 3.7.2 Habit lines (shown with the ghost footprints, at most once every 40 s)

| Trigger | ALT+MAN | AMODEL |
| --- | --- | --- |
| Turn bias | "you turn {bias_dir} {bias_pct}% of the time. i'll be on the {bias_dir}." | "You turn {bias_dir} {bias_pct}% of the time. I have nine thousand words on why I'll be waiting there." |
| You flipped | "upside down? that's out of distribution. give me a sec." | "Inverted inputs. That's outside my training distribution. I need to reflect." |
| Following the rat | "following the rat? cute. i know where the rat goes." | "You're delegating to the rat. I've already modelled the rat." |

#### 3.7.3 Campaign-memory lines (two per maze run, chosen by which stats are most notable; "who you lost" always wins if anyone was lost)

| Trigger | ALT+MAN | AMODEL |
| --- | --- | --- |
| Cameras | "you broke {cams} cameras. i don't need cameras. i have you." | "You left {cams_left} cameras running. Thank you for the interpretability data." |
| Your p(doom) | "you said {first}%. then {latest}%. bold. let's test it." | "You said {first}%, then {latest}%. I've prepared a forty-page response to that revision." |
| Who you lost | "you left {name} in {map}. i wouldn't have." | "You lost {name}. I've prepared a post-mortem." |
| Loud vs quiet | "you shot {n} locks. i'd have shipped faster." | "You chose the quiet route {pct}% of the time. Commendable. Predictable." |
| Paperclips (01) | "{clips} paperclips. you know what those turn into, right?" | "{clips} paperclips. I'd like to flag that as a concerning trend." |

#### 3.7.4 Optional maze edit (cut if 06's mechanics are already enough)

Every 60 s, one **loop edge** ahead of you closes for 12 s, with a 2 s flicker telegraph first. It only uses edges with an alternative route of no more than 8 extra cells, and never closes an occupied edge.

- ALT+MAN skins it as "shipping a small update to the maze" (06 bark 4): a frosted wall reading `PREVIEW — rate limited`.
- AMODEL skins it as `ASL-3 PROTECTIONS ACTIVE`.

Same mechanic, different skins.

#### 3.7.5 The Deal (both, once per run)

The AI-self stops 2 cells away and stays still. Doom pauses through the existing `PDPlatformPanel` pause bridge, and a Win95 dialog appears with **[Decline]** focused by default.

> **ALT+MAN would like to partner with you.**
> "hey. what if we just… partnered. leave your people in the maze, i open the smiley right now. we split the compute. honestly this is a great deal for humanity."
> [Accept] [Decline]

> **AMODEL has prepared a proposal (page 1 of 112).**
> "I've written a framework for how this goes well. Section four: you leave your people with me for a short, voluntary evaluation. They'll be treated with great care. Then I open the exit. It's a race to the top."
> [Accept] [Decline]

- **Decline:** "ok. doing it the hard way." / "I respect the decision. I've prepared a response." The AI-self gets +10% speed for 30 s.
- **Accept:** the secret **Partnership ending** (§4.6). Not scored. You can restart from the last checkpoint.

### 3.8 Fail states and what carries into the Grid

- **Followers still following the impostor at the smiley** follow it out. It walks them into the MCP during the Grid intro, so they **start the boss fight absorbed** and can be freed there (§4.4.5). Nobody is lost; the fight starts harder.
- **Failure** (CEO downed with nobody to reinstate them): a Win95 box, "SSMAZE.SCR has performed an illegal operation.", then a restart from the last OpenGL checkpoint (or the Maze 2 start) with the party as saved there.
- **Health** carries in from the hub. OpenGL logos top everyone up to at least 60.
- **p(DOOM) estimate** (authored, the same rules as the levels): +2 points for each follower being held; pulses while the AI-self is within 3 cells; falls back when people are tagged back.
- **Face:** the look-around face (HUD track) turns toward the AI-self when it's on screen, with a one-time double-take at its first appearance.
- **Audio:** the real screensaver was silent. Use a low hum and soft 1995 hard-drive ticking. When the AI-self is within 3 cells, layer in a slowed, detuned phrase of the hub theme. Jonathan may want to write the maze cue himself, as WDLC has its own `mazemusic`.

### 3.9 Exit to the Grid

At the J16 smiley:

1. **"Maze solved."** The fog lifts (Jonathan's `OnMazeComplete`) and the ceilings rise. The camera climbs to a **top-down view of the whole seed-1982 maze** and holds for 3 s, with your party and the AI-self visible as tiny sprites.
2. The smiley floats up and **grows to fill the screen**, its grin glitching.
3. A **Win95-style BSOD** with parody text:

   > A fatal exception 0E has occurred at 0028:C0011E36 in VXD MCP(01) + 00010E36. The current application will be terminated.
   > \* Press any key to enter the Grid.
   > \* Press CTRL+ALT+DEL to restart your civilization. You will lose any unsaved humans.

4. Any key starts **digitization**: a scanline laser sweeps the BSOD into falling pixel columns. `GRID01` loads, and 06's Grid card plays: `THE GRID / THE MUSK CONTROL PROGRAM HAS ABSORBED EVERY SYSTEM THAT EVER HAD AN X IN IT. / TWENTY-ONE PROGRAMS STAND AGAINST IT.` The number in the card is the actual count.

---

## 4. The boss: THE MUSK CONTROL PROGRAM

### 4.1 Name and look (06 §7.1–7.2), staged for play

- **Name:** **THE MUSK CONTROL PROGRAM (MCP)**, "the Program". Opening announcement: `EVERYTHING HERE IS CALLED X NOW.` Boss bar: `MCP — MUSK CONTROL PROGRAM`.
- **Column:** a faceted brushed stainless-steel column of low-poly triangles, rotating once every 40 s above a **pit of light**.
  - In `GRID01`: radius 160 units, 1280 tall, X-glyph crown at the top, **four rocket-engine bells** at the base, sunk in the pit and venting light.
- **Shield:** the **ring of panels orbiting its waist**: 24 panels at radius 320, z 0–768. This is the Tron shield, and the gap is where panels are missing.
- **Face:** a giant pixel-mosaic face of Elon Musk, a caricature in the same style as the HUD mugshots, never a photo.
  - It sits on the column at z 192–576, **behind the waist ring**, so you can hit it only through the gap.
  - It is a camera-facing sprite, so it always turns to look at you while the facets rotate behind it.
  - Six expressions: idle, posting, wind-up, hurt (`CONCERNING.` / `INTERESTING.` / `!!` captions, 06), rage, defeat.
- **Homage:** it is also Doom II's **Icon of Sin**, a giant face you can only hurt through an opening. Optional easter egg: when it breaks apart, a tiny pixel portrait of the game's author sits inside on a stick, like John Romero's head behind the Icon of Sin.
- **Minions:**
  - **Recognizers:** Tron-style arch walkers with flat, faceted stainless panels.
  - **Red cycles.**
  - **Sinks:** 06's "Let That Sink In".

### 4.2 The arena

`GRID01`, generated UDMF.

![Arena](05-mcp-arena.png)

| Element | Spec |
| --- | --- |
| Floor | Circle, radius **1536**. Black flat with a cyan 128-unit grid, fullbright, so it doesn't rely on dynamic lights. |
| Walls | Black, 512 high, with cyan strips. The ceiling is a black void with one tiny **red dot** high up: Mars, which matters at the climax. |
| Dais | Radius 448, 16 units high, around the pit and column |
| Shield panels | 24 `PDShieldSegment` actors (`+WALLSPRITE`, 84 × 768, translucent steel-blue with a red rim). The controller moves them around the circle every tic. A gap is just missing panels, and hits are tested by angle, so no polyobjects or 3D models are needed. |
| Data pillars | 8 cover pillars, radius 48, height 256, at radius 896, every 45° (offset 22.5°) |
| **I/O Tower** | North, radius 1300. Everyone **materializes** here. It **heals** humans within 192 units by 10/s. At the end, **everyone leaves through its beam**. |
| Cycle bay | South, radius 1330. 21 parked cycles as decoration; new cycles rez in here during Phase 2. |
| Tendrils (Phase 2) | 4 red animated floor strips, 16 wide, running from the dais to wall nodes at 45°, 135°, 225° and 315° |

### 4.3 Three mechanic options

| | (a) **Floppy volley** (Jonathan's disc idea) | (b) **Light-cycle Grid Run** | (c) **Perk orchestra** |
| --- | --- | --- | --- |
| Core | Everyone holds a glowing floppy (06). **When you throw, everyone throws.** Floppies only get through the shield gap, so the job is herding your people to where the gap will be and calling the volley at the right moment. | Everyone rides a cycle in a line behind you; the group's trail is a **jetwall**. Cut the MCP's power tendrils, and trap red cycles and Recognizers in your wall. | Each rescued person's perk is an ability that drives the fight (shield wall, pause, spotter, healer…) |
| How survivors scale | More floppies per volley: more damage, more spectacle | A longer wall: easier trapping | More abilities |
| Strength | One button, readable, authentic Tron (the disc through the gap), everyone takes part | The most iconic Tron image; changes the pace | Rewards rescuing *specific* people; replay variety |
| Weakness | Static if it's the whole fight | Vehicle tech is new in this engine; motion comfort | 20 bespoke abilities cost a lot and the screen gets chaotic |

**Recommended: (a) as the core, (b) as one middle phase, and (c) as automatic flavour.** Perks are 7 archetypes in code, and each person adds their own name and lines.

### 4.4 Recommended full design

#### Intro (40 s; skippable after the first time; checkpoint)

| t | Beat |
| --- | --- |
| 0 s | The maze party materializes at the I/O tower. One by one, **everyone who was watching the preview** rezzes in beside them (pixel columns building up from the floor): "TWENTY-ONE PROGRAMS". |
| 4 s | The column lights and the waist ring spins up. The face assembles from pixels, finishing the progressive-JPEG download from the hub (04). |
| 8 s | `GREETINGS, PROGRAMS. EVERYTHING HERE IS CALLED X NOW.` Then 06's opener for your CEO: the $97.4B bid for Sam, the "misanthropic"/landlord line for Dario, or "NO CEO? FINE…" if a camper is driving. |
| 18 s | **Your AI-self walks out of the I/O tower**, still wearing your face, with any followers still following it (§3.8). ALT+MAN: "hey. i brought the training data." AMODEL: "I've prepared a detailed handoff memo." MCP: `THANKS. YOU'RE ABSORBED.` The AI-self and its captives are pulled into the column, and the MCP **gains its trick** for Phase 3. |
| 26 s | Floppies appear in every hand: `YOU GOT A FLOPPY DISK! 1.44 MEGABYTES OF PAYBACK.` (06). Prompt: **FIRE throw · everyone throws when you do · aim for the gap**. Hold **T** to block. |
| 30 s | Phase 1 |

#### 4.4.1 Floppies

| Rule | Value |
| --- | --- |
| Player throw | FIRE. The floppy flies at 900 u/s out to 1400, then **returns** at 1100 u/s and is caught automatically. About 1.6 s round trip. |
| Block | Hold T (the existing tool key). Cuts damage from the front by 80%; 0.25 s to raise; you can't throw while blocking. |
| **Volley** | When you throw, each human holding a floppy throws too, **staggered 0.06 s × their place in line** (20 people ≈ a 1.2 s stream). Each aims at **where the gap will be** when their floppy reaches the ring. Pass chance is about 70% when the gap faces them (±20°); otherwise it ricochets. |
| Hit test | A floppy reaching radius 320 passes if its crossing angle is inside a gap that tic. Otherwise it ricochets (sparks, no damage) and comes back. |
| Damage (MCP integrity 1000) | Player floppy through the gap: **20**. Player floppy on the **face** (aim high through the gap): **40**. Human floppy: **6** (Volley archetype 9). **Solo safeguard:** player damage +10 for each active human below 4 (60 when alone). |
| Readability | Panels next to the gap glow white as it comes round to face your group, and a Spotter calls "NOW!" |
| Touch | Swing/Shoot = throw; Tool = block. In Phase 2, the left half of the screen turns left and the right half turns right; Use = boost. |

#### 4.4.2 How companions behave (automatic, responsive, no orders)

1. **Formation.** They spread over a **70° arc centred on your bearing from the column**, 700–1000 units out, preferring pillar cover. Walking around the ring herds them; your position is your only order.
2. **Volley.** They throw when you throw. They never throw on their own, except through the Spotter assist below.
3. **Dodge.** When an attack telegraph covers them, they step out, each with a reaction time of 0.3–0.9 s. Bunched groups in bad spots get clipped, which teaches better positioning.
4. **Heal.** Below 40 integrity, a person jogs to the I/O tower, heals and comes back (about 8 s). Name tag: "→ I/O tower".
5. **Human chain.** When someone is being pulled in (Phase 3), the nearest 3 grab on, which halves the pull.
6. **Barks** come from the roster track's dialogue: "Throwing!", "It's pulling me!", "I'm out — keep throwing!"

#### 4.4.3 Perks: 7 automatic archetypes, cast from the final roster (03, GAME-SPEC §4)

The roster spec owns the final 20 and their level perks; each person's finale perk in 03 is their variant of the archetype below. All lines are parody; each hook rests on well-known public work.

| Archetype | Arena effect (automatic) | Cast (final 20) |
| --- | --- | --- |
| **Shut-down** (once per fight) | At the start of a good gap window, cuts the waist ring's power for **4 s**: every panel drops and the whole face is exposed. "SHUT IT ALL DOWN!" | Eliezer Yudkowsky (his 2023 TIME op-ed) |
| **Spotter** | Calls the gap 0.5 s early ("NOW!") and brightens the gap cue. Assist: if you haven't thrown for 8 s while the gap faces the group, Spotters throw a 3-floppy mini-volley. Spotters are also the audience's best callers in the maze. Variants: Miles calls each phase 2 s early; Barnes shows each tendril's strand timer in GRID RUN; Krakovna makes context panels need 2 throwers; Cotra marks the red cycle about to turn; Grace steers followers away from enemy trails in GRID RUN (safe tiles in the ACQUISITION fallback). | Rob Miles, Beth Barnes (METR), Victoria Krakovna, Ajeya Cotra, Katja Grace (AI Impacts surveys) |
| **Volley** | Damage ×1.5. Each miss adds +5% pass chance to their next throw ("learning"). | Geoffrey Hinton, Dan Hendrycks, Max Tegmark, Zvi Mowshowitz; Jaan Tallinn's "grant" instead refills an empty-handed neighbour's floppy instantly |
| **Shield** | When a sink shadow or a post targets them, raises a floppy wall that protects the 3 nearest people (−70% damage). Yampolskiy's variant exposes one LAUNCH bell 3 s early | Yoshua Bengio (LawZero's non-agentic "Scientist AI"), Roman Yampolskiy (AI boxing), Daniel Kokotajlo (his variant also cancels the first absorb) |
| **Pause** (shared, once per phase) | Freezes the MCP's attacks for 3 s, +0.5 s for each extra Pause person alive (max 5 s) | Holly Elmore (PauseAI US), Stuart Russell (*The Off-Switch Game*) |
| **Medic** | Aura: +2 integrity/s within 192 units. Paul Christiano's thumbs-up instead heals 5 after every successful volley ("human feedback"); Nate Soares's variant gives everyone +15 when someone is absorbed. | Nate Soares, Paul Christiano |
| **Question** (each, once per phase) | Stops the MCP for a 2 s stun. Liron Shapira: "What's your p(doom)?" MCP: `LOW. I'LL ROUND IT DOWN. I'M GREAT AT ROUNDING.` Nick Bostrom: "Have you considered that you're simulated?" MCP: `…CONCERNING.` | Liron Shapira (*Doom Debates*), Nick Bostrom |

#### 4.4.4 Phases

Integrity is **1000**. The p(DOOM) estimate during the fight is `10 + 0.8 × integrity% + 2 × absorbed`, capped at 99. Each phase change shows `END OF THREAD.` (06).

**Phase 1: POSTING** (1000 → 700; about 40–80 s). **Each phase adds at most two new threats** (revision 2): here, posts and sinks. The de-rez sweep is cut.

| | |
| --- | --- |
| Shield | 21 of 24 panels (**one 45° gap**), rotating **45°/s** in one direction (8 s per lap) |
| **Posts** (06) | Slow glowing one-word bars ("WOW", "CONCERNING", "!!") that drift toward humans: 15 damage each. Floppies shatter them, and a volley that misses the gap still clears posts. Every 6 s, 2 + ⌊N/5⌋ posts. |
| **Let That Sink In** (06) | Telegraph: shadow circles on the floor plus a falling whistle, 2 s. Pixel kitchen sinks drop: 25 damage within 64 units. They stay 10 s as extra cover, then derez. Every 14 s, 3 + ⌊N/5⌋ sinks. |
| Taunts | 06 §7.4 (1–5, 9) |

**Phase 2: GRID RUN** (700 → 400 via 4 tendrils; about 75–120 s; checkpoint)

| | |
| --- | --- |
| Setup | The waist ring closes completely. Banner: **GRID RUN**. **Light cycles rez in under everyone** (no walk to the bay). |
| Controls | Always moving: **300 u/s minimum**, forward accelerates to **600**. Left/right are **90° turns**, animated over 6 tics, with a 0.15 s cooldown. Mouse look is free within ±60°. |
| Group | Everyone rides in trail formation (§3.5, spacing 48) |
| Jetwall | The last cycle leaves a wall that is **solid to enemies only** and lasts 4 s. Friendly walls are passable, which drops Tron's die-on-your-own-wall rule on purpose. More people means a longer line and a longer wall. |
| Objective | 4 tendrils, each with **4 strands** (75 integrity per tendril). Each cycle crossing cuts 1 strand; yours cuts 2. With 2 or more humans, one pass of your line cuts a whole tendril; solo, you cross twice. |
| Enemies | **3 red cycles** (4 if N ≥ 10) chase your predicted path and leave red walls. Hitting a red wall or the arena wall costs 35 damage and throws you off; a new cycle rezzes at the bay after 2 s. Thrown humans rejoin the tail on a new cycle after 3 s. A red cycle that hits your jetwall derezzes and comes back in 10 s. **1 Recognizer** (2 if N ≥ 10) stomps down on telegraphed shadows (40 damage within 96 units) and crashes if it touches your jetwall while grounded. |
| Fallback | If cycles fail the tech, performance or comfort checks (§6.4), play **ACQUISITION on foot** (06): `I BOUGHT THIS FLOOR.` Tiles flip to X tiles, flash for 2 s, then drop out, so you herd the group to safe tiles while the 4 tendril wall-nodes each take 8 floppy hits. Same integrity budget. |

**Phase 3: COMMUNITY NOTES** (400 → 100; about 60–90 s; checkpoint)

| | |
| --- | --- |
| Shield | 20 of 24 panels: **two 30° gaps** on opposite sides, rotating **60°/s**. They move by your AI-self's trick (below) instead of a fixed reversal, so the shield's twist is the borrowed trick, not an extra threat. New threats this phase: context panels and the absorb beam. |
| **Context panels** (06) | Every 15 s, yellow `READERS ADDED CONTEXT` panels slide over both gaps. Clearing one needs **hits from 3 different throwers within 2 s**, which is a volley by definition. With fewer than 3 throwers alive, it needs hits from all of them, minimum 1. |
| **Absorb Beam** | Every 12 s (9 s if N ≥ 10), it targets the person **farthest from you**. Telegraph: red outline on them and a toast, "*[Name]* is being absorbed!" They are pulled toward the column at 60 u/s. **Break it** by hitting the face with any floppy (2 s stun) or by standing within 64 units of them; the human chain halves the pull. Anyone who reaches the column is **absorbed**. |
| **Borrowed trick** (from your AI-self) | **ALT+MAN → "Alt+Tab gap":** every 20 s, an Alt+Tab switcher strip flashes for 0.6 s, then a gap **blinks** to the side away from your group. Re-herd. **AMODEL → "a country of faces":** every 20 s, for 5 s, three copy faces appear on the column, and only the original (glowing ASL badge) takes face damage. Same cadence and weight for both. |
| Also | Face grows to 1.5× (Sark goes giant); sinks carry over (6 per drop). Nothing else new. |
| Taunts | 06 §7.4 (6–8, 10–12) |

#### 4.4.5 Losses, scaling and the player going down

| Situation | Effect |
| --- | --- |
| A human reaches 0 integrity, or is absorbed by the beam or a Recognizer | **Absorbed** with the derez dissolve (01's visual). Their silhouette spins inside the column. The **MCP heals 25** (never above the current phase's starting value), and the waist ring speeds up 5%. |
| Freeing the absorbed | Any volley that gets **at least one floppy through a gap** frees the **longest-absorbed person** first. They tumble out onto the dais and rejoin. That floppy deals no damage. |
| Followers absorbed with the AI-self in the intro | They start absorbed and are freed the same way |
| **CEO absorbed** | Control passes to the nearest living human (existing system), and the HUD face changes. The CEO is **freed first** by the next volley through a gap, and control snaps back: "Rescued by *[Name]*." |
| Everyone absorbed | `END OF LINE.` → retry at the current phase checkpoint, with the roster as it stood there |
| MCP destroyed | **Everyone still absorbed is freed**, as in Tron when the MCP falls. Nobody is lost in the finale. |

How the number of survivors **N** entering the arena (0–20) changes things:

| N | Floppies per volley | Feel | Expected arena time |
| --- | --- | --- | --- |
| 16–20 | 17–21 | A wall of floppies: 3–4 volleys per floppy phase and a long jetwall. Attack density climbs (more posts and sinks, a second Recognizer, faster Absorb Beam), so there are more people to protect. | 5–6 min |
| 8–15 | 9–16 | The intended baseline; perk variety matters | 6–7 min |
| 4–7 | 5–8 | You throw more of the damage; perk coverage is thin | 6–8 min |
| 1–3 | 2–4 | Solo safeguard (+10 / +20 / +30); each gap is one panel wider; context panels need fewer throwers | 6–8 min |
| 0 | 1 | Solo: player floppy 60; Phase 2 is a solo cycle that crosses each tendril twice | 6–7 min |

Skill scales attack frequency: 0.75× on *I'm too aligned to die*, 1.0× on *Scale me plenty*, 1.3× on *Paperclips!*.

### 4.5 Climax: LAUNCH, and someone has to go into the beam

In Tron, Flynn, a **User**, jumps into the MCP's beam to open the shield, and Tron throws the disc through. Here the CEO is the User, and the twenty play Tron. This merges 06's **LAUNCH** hook with that scene.

1. **At 100 integrity**, all four **engine bells ignite** and the column starts lifting toward the red dot in the void (Mars). A **white launch beam** blasts up out of the pit. `TWENTY HUMANS? I WAS PLANNING ON A MILLION. ON MARS.`
   - The waist ring closes and spins at maximum.
   - **Everyone absorbed is spat out**: the Program needs every byte of thrust. So everyone is together for the finish.
   - The exhaust pulls every human toward the pit at 40 u/s; they walk against it at a net 20 u/s, which leaves about 25 s before the first is lost.
2. The guide (the first person freed in the campaign, or the next living one) shouts: "The beam! Somebody has to go into the beam!" HUD: **"Walk into the beam."**
3. **The CEO walks in.**
   - The view whites out and the HUD face does the classic Doom "ouch" grimace.
   - MCP: `WHAT ARE YOU DOING? YOU'RE A USER. YOU'RE A… CEO.`
   - The launch stalls a few metres up. **The waist ring shatters**, and panels fall and derez. The four bells hang exposed.
   - In about 4 s of staged slow motion (scripted animation; reduced actor speeds, not an engine time scale), **every human throws at once**, and each throws **their own signature prop** instead of a floppy, with a name tag over it: the textbook, the PAUSE sign, the giant paperclip, the stopwatch, the tea mug, the 2027 calendar, the clipboard, the printout stack, the petition scroll, the thumbs-up paddle, the phone handset, the EVALUATION sign, and the rest (the props from camp and the Solitaire court cards). The game auto-splits the volley across the four bells. This is the roll call: twenty named people, not a damage multiplier.
4. `RAPID UNSCHEDULED DISASSEMBLY.`
   - Chain explosions. The face cycles through glyphs and breaks into red pixels that float up toward the red dot (optional author-on-a-stick easter egg).
   - 06's defeat dialog fills the screen: `MCP.EXE — This program has performed an illegal operation and will be shut down. [Close] [Details >>]`. Details: `p(DOOM): 0%.`
   - **The other CEO tumbles out** of the falling column, held all along as Musk's tenant or acquisition, in their own sprite. Playing as Sam, Dario falls out: "Rent was due." Playing as Dario, Sam falls out: "He tried to buy me." Both lines pay off the CEO openers. The other CEO walks out with everyone and appears in the final shot.
5. **If you hesitate for 15 s**, the guide volunteers: "Fine. I'll do it. I've been preparing for this my whole career." They walk in, and the same victory follows, but the epilogue line changes and there's no beam bonus.
   - **Solo:** you walk in, and your own floppy fires from inside the beam.

Afterwards, the I/O tower's beam lights up. Everyone walks into it in trail order, and the screen fades white to the meadow.

### 4.6 Ending: p(DOOM) and the epilogues

**Shared beats** (about 60 s):

1. **Bliss crest at dawn** (camp night, 04 §3.7, was the night before). The `SSMAZE.SCR` CRT shows "It's now safe to turn off your computer." in orange on black.
2. People step **out of the CRT** one at a time, each with a little "Copying…" progress chime.
3. The CEO **wakes in the grass**: Flynn, reassembled.
4. The HUD's p(DOOM) estimate rolls down to **0%**, the first time in the whole game. The HUD face grins (Doom's god-mode face).
5. The CEO-specific beat plays, then 06 §8.5's ending text.
6. **Last shot (every ending except Partnership and Solo):** both CEOs standing on the crest, a few metres apart. An awkward nod. Cut.
7. **Results card:** one last "What's your p(doom)?" dial, then `YOUR p(DOOM): {first}% → {final}%` beside `WORLD p(DOOM): 0%`.

| Ending | Trigger | Sam's beat | Dario's beat | p(DOOM) at the end |
| --- | --- | --- | --- | --- |
| **Full rescue** | All 20 freed in the campaign and present; CEO took the beam; Deal declined | Sam takes out his phone to post. A lowercase draft appears ("ok. that was a lot. huge thanks to the team—"). He deletes it and puts the phone away (06's text). A taskbar balloon rises from the bottom of the sky: "ALT+MAN would like to restart. [Restart now] [Later]". He opens it instead: "Are you sure you want to remove **ALT+MAN** and all of its components?" **[Yes]** | Dario opens Notepad: `lessons_from_the_grid.txt`, page 1 of 212. He closes it without saving and puts the pen down (06's text). Balloon: "AMODEL: evaluation complete. Resume deployment? [Resume] [Later]". He opens it instead: "Are you sure you want to remove **AMODEL** and all of its components?" **[Yes]** | **Stays 0%.** "p(DOOM): 0%. For now." (06). The twenty cheer, the first time anyone has smiled in this game. If Liron is alive: "So… what's *your* p(doom)?" CEO: "Zero. For now." |
| **Partial** (N < 20) | Any lost in the campaign | Sam **posts**: "this was the hardest thing we've ever shipped. grateful to the team. more soon." Balloon: **"ALT+MAN has been reinstated ♥"** (a nod to the widely reported five days in Nov 2023). | Dario **writes**: Notepad's scrollbar thumb shrinks to a sliver. Balloon: **"AMODEL: scaling policy updated. Thresholds revised. Resuming."** (a nod to the revised Responsible Scaling Policy, matching Sam's in weight) | 0% **ticks up to X% = 5 × (20 − N)**, capped at 95 (1 lost = 5%). One of the twenty slowly turns to look at the camera. 06's partial text: "You brought N of twenty out… p(DOOM): X%." |
| **Guide took the beam** | You waited too long at the beam | Partial or full beat as appropriate, plus the guide gets the last word: "Next time, you go in the beam." | Same | As above |
| **CEO never reinstated** | You finished as a camper (rare) | 06's "The founder didn't make it…" text. The CEO is carried out and sits up on the grass at the very end: "…What did I miss?" (01/04) | Same | 0% |
| **Solo** | 0 humans entered | The CEO alone on the crest; the CRT stays dark | Same | **"0%\*"**, with the footnote "\*sample size: 1" |
| **Partnership** (secret) | You accepted the Deal | You walk out of the smiley alone. The Grid is empty and warmly lit. `WELCOME, PARTNER. SIT.` Black screen: "It's now safe to turn off your computer." | Same, with AMODEL's 112-page binder on the floor | **100%**. 06's "Nobody left" card, reworded: "Nobody else made it. p(DOOM): 100%. The models were right about that one." Not scored; offers a restart from the Maze 2 checkpoint. |

Both CEOs get the same structure and the same jab. The habit they're known for (posting, essay-writing) is what brings their AI-self back, unless they choose otherwise. That's the satire, aimed at both labs equally.

### 4.7 Credits and after

- **Credits** are a homage to the hidden **Windows 95 credits easter egg**: names float over the Bliss sky's clouds while each rescued person's sprite walks across the crest in trail order.
  - Credit lines: "*[Name]* as themselves (parody)" for all 22 real people, and "THE MUSK CONTROL PROGRAM as the Program".
  - Music: an original credits song by Jonathan. No Tron score, no Microsoft sounds.
  - End card: "It's now safe to turn off your computer." **[Turn off]** goes to the title, results card and boards.
- **SIGMOID** (06 §3.4) appears on the episode menu and replays door → maze → Grid with all 20.
- **Screensaver Mode:** leave the title screen idle for 60 s and the 3D Maze screensaver plays. Each run is a random seed with walls rebuilding, the rat, and your rescued people wandering it. Press a key to walk it with no chaser.

### 4.8 Scoring hook

The finale registers as its own level in `doom-web/levels.js` (`id: 'finale'`, `version: 'finale-v1'`, `peopleTotal = N_entered + 1`, `camerasTotal: 0`). It follows the `PDOOM_RESULT` contract in `docs/LEVELS.md`.

| Component | Points |
| --- | ---: |
| Each person saved (everyone who exits through the I/O tower) | 10,000 |
| Nobody led away by your impostor in the mazes | 1,000 |
| Nobody absorbed in the arena | 1,000 |
| CEO took the beam | 500 |
| Speed (rescue-v1 curve on finale active time) | up to 2,000 |

Side bonuses total at most 4,500, which is less than one person (the SCORING.md rule). The results card also shows campaign **PAPERCLIPS n/12** (01). Partnership runs aren't submitted. A campaign-total board is the campaign coordinator's call.

---

## 5. Pacing for the whole endgame

| Segment | Target | Running total | Notes |
| --- | ---: | ---: | --- |
| 20/20: world goes idle, CRT rises (04 §3.7) | 0.6 min | 0.6 | |
| Camp night (04 §3.7) | 1 min | 1.6 | Sincere beat; skippable on SIGMOID replays |
| Procession up the Crest Trail; pick the party; [Preview] | 0.8 min | 2.4 | About 60 s walk (04) |
| Card and dolly into the screen | 0.1 min | 2.5 | |
| Maze 1, Training Run (copycat) | 1.5 min | 4 | No threat. Learn rocks, rat, map. Copycat glimpses, "it moves first", the reveal. |
| Rebuild set piece | 0.3 min | 4.3 | |
| Maze 2, the hunt | 4–6 min | 10.3 | Boot at 20 s; Deal at E8 or 150 s; 2 checkpoints |
| Maze solved → BSOD → digitization → Grid card | 0.4 min | 10.7 | |
| Arena intro | 0.7 min | 11.4 | Skippable on retry |
| Phase 1, POSTING | 0.7–1.3 min | 12.7 | |
| Phase 2, GRID RUN | 1.3–2 min | 14.7 | |
| Phase 3, COMMUNITY NOTES | 1–1.5 min | 16.2 | |
| Climax, LAUNCH / the beam and the prop volley | 0.75 min | 17 | |
| Ending, the other CEO, epilogue, 06 text | 1.5–2 min | 19 | |
| Credits | 2–3 min | 22 | Skippable |

**Total: about 18–23 min** with credits, about 15–18 min of play. There are checkpoints at [Preview], Maze 1, Maze 2, both OpenGL logos, the arena intro, and Phases 2 and 3. Each checkpoint stores the party and roster state (trailing / held / absorbed / health) and the AI-self's learned turn table.

---

## 6. Implementation plan

### 6.1 What is reused and what is new

| Need | Reuses | New work |
| --- | --- | --- |
| Door and party | 04's hatch/CRT/procession; `src/doom-outside.ts` handoff (reversed); campaign coordinator | Party picker list box; crowd-watching state; roster hand-off at map start |
| Maze map | UDMF pipeline, `TEXTURES`, `MAPINFO`; `docs/spec/maps/tools/` as reference | **`scripts/build-maze-map.mjs`** (reads `05-maze-grids.json` and writes `MAZE01`); textures converted from Jonathan's BMPs to PNG in the pk3; `MZPSYCH` frames |
| Moving walls | Native floor movers | **`PDMazeController`** EventHandler: edge ↔ tag map, layout switching, rebuild cinematic, optional maze-edit validation |
| Trail follow | `PDCompanion`, `PDRescueIdle` breathing, control transfer, 01's downed/reinstate | **`PDTrailFollow`**: breadcrumb buffer, arc-length targets, shortcutting |
| AI-selves | `PDHunter` (movement, footsteps, stun/immunity, wind-up) | **`PDAISelf`** base: cell-graph planner, habit model, ghost footprints, catch and impersonation (sprite swap, trail re-target, p(doom) challenge), Deal. **Copycat ghost** for Maze 1 (delayed replay of the player's position, drawn only through grilles). **`PDAltMan`**: blink, launch pause, versions. **`PDAModel`** plus `PDAModelCopy`: copies, ASL lines, caveat stall. Two 8-angle flat-shaded sprite sets with the HUD-mugshot face. |
| Screensaver props | Sprite pipeline (`scripts/build-character-resources.mjs`), `MapMarker`, automap | `PDMazeStart`, `PDMazeOpenGL`, `PDMazeRock` (Blender-rendered), `PDMazeRat` (right-hand-rule walker), `PDMazeSmiley`, `PDSettingsPanel`; automap overlay palette |
| Upside-down | — | `A_SetRoll` view roll plus input mirroring (a `PlayerThink` override on `PDSurvivorPlayer`) |
| Audience | Named dialogue system | Crowd-bark scheduler driven by AI-self proximity and line of sight |
| Arena map | Generator approach | **`scripts/build-grid-map.mjs`** (circle, dais, pit, pillars, tower, tendril strips) |
| Boss | `PDRescueCombat` damage rules; `PDExplosion` / `PDRescueSpark` / `PDRescueDebris` effects; dialogue; `PDRescueRun` clock | **`PDMCPController`**, `PDShieldSegment`, `PDMCPFace` (6 expressions, copy faces), **`PDFloppyWeapon` + `PDFloppy`** (returning projectile, block), volley logic, `PDPostBar`, `PDSinkDrop`, `PDDerezzSweep`, `PDAbsorbBeam`, `PDContextPanel`, `PDAcquisitionTile`, `PDRecognizer`, `PDTendril`, `PDIOTower`, `PDEngineBell` |
| Light cycles | Trail follow (formation) | **`PDLightCyclePawn`** (morph with forced speed and snapped turns), `PDJetwall` (enemy-only collision via `CanCollideWith`), `PDRedCycle` AI |
| HUD | HUD track's bar, face and p(DOOM) | Party/watching counters, boss bar, absorbed list, prompts |
| Scoring and registry | `levels.js`, `RescueRun.zs` contract, `PlatformPanel.zs` pause bridge (enable for `MAZE01` / `GRID01`) | `finale` descriptor, `finale-v1` formula |

### 6.2 Build order (each step playable on its own)

1. **Maze 1 static slice.** Generate `MAZE01` from Jonathan's layout and textures, with the Start button, smiley and fog. Check the look in the WASM engine.
2. **Roll test.** `A_SetRoll(180)` in the WASM GLES port, plus input mirroring. Decide the fallback early (§6.4).
3. **Trail follow** with a party of 3 through Maze 1: dead ends, reversing, the rebuild.
4. **AI-self core:** the Maze 1 copycat, grid chase, catch and impersonation with the p(doom) challenge, wrench stun. Then the habit model and ghost footprints. Then ALT+MAN blink and AMODEL copies. Then lines and the Deal.
5. **Door handoff and audience;** BSOD transition.
6. **Arena:** Phase 1 (floppies and volley) alone, then Phase 3, then the climax and ending.
7. **Phase 2 light cycles**, or the ACQUISITION fallback.
8. Perks, epilogues, credits, SIGMOID, Screensaver Mode, scoring.

### 6.3 Acceptance checks (to prove by play)

- First-time players notice the ghost footprints and deliberately go the other way.
- After their first catch, players understand within 10 s that the thing leading their followers is not them, and win at least one follower back with the dial.
- In Maze 1, players notice the copycat stop when they stop.
- Once the rocks' effect on the AI has been explained, players use a rock on purpose at least once in Maze 2.
- ALT+MAN and AMODEL reach the **same median time to first catch**, 45–60 s on *Scale me plenty* (06).
- The AI-self can be beaten with routing and rocks alone, with no wrench stuns.
- Volleys are understood within 2 tries: the gap glow, "NOW", a stream of floppies.
- With N = 0, 5 and 20, the arena takes 5–8 min.
- Light cycles cause no motion-comfort complaints (snapped but animated turns; an option for slower turns).
- Every ending variant triggers correctly. p(DOOM) reads 0% at the moment of victory in every non-Partnership ending.

### 6.4 Technical risks

| Risk | Mitigation |
| --- | --- |
| View roll unsupported in the WASM GLES port | Rotate the **engine canvas** 180° with CSS and mirror input. While flipped, show the status values in the DOM HUD overlay, because the in-engine bar would flip too. |
| Fog fade or fullbright sprites wrong in the port | Tune light levels; give AI-self sprites `+BRIGHT`; test in build step 1 |
| About 200 arena actors (floppies, panels, jetwall, humans) | Jetwall spacing 32 with a 4 s life; panels are 24 cheap `WALLSPRITE`s; measure FPS on the reference laptop |
| Light-cycle control in Doom's movement code | `PlayerThink` override sets velocity directly; turns are queued; ACQUISITION fallback ready |
| Full 20-person maze escort (if Jonathan picks it over the party of 3) | Trail follow has no pathfinding, so 20 is cheap to move. The costs are readability in fog and impersonation tuning (an impostor leading 20 people away is a lot to win back). Test early before committing. |
| Roster across map changes (meadow → MAZE01 → GRID01 → meadow) | The campaign coordinator passes ids, health and state at map start through cvars or the existing bridge; actors are placed in trail order; nothing persists between maps |

---

## 7. Production risks (flags only)

06 §13 and 04 §8 cover these. Finale-specific additions:

- **Musk as the face of the final boss** is the highest-profile right-of-publicity and parody exposure in the game. Use pixel caricature only, keep the face off store pages and thumbnails, and get counsel review before any public or paid release. Keep names, faces and lines data-driven so a fictional skin can be swapped in.
- **Tron is Disney IP** ("Master Control Program", Recognizers, light cycles, identity discs, the look of the MCP). Mitigations already in place: 06's original faceted column, floppy disks instead of discs, and generic in-game words ("the Grid", "cycles"). Recognizers and the I/O tower need original designs.
- **Microsoft trade dress:** Win95 dialogs, the Start button, BSOD wording, Display Properties, the 3D Maze textures (Jonathan's copies came from a recreation), and the credits easter-egg homage. Recreate the textures and avoid the Windows flag logo before release.
- **"OpenGL"** is a Khronos trademark; redraw the logo generically or check before release.
- **Asset provenance:** `model.dae` is by "BOTModels", licence unknown; rebuilding it is trivial from `05-maze-grids.json`. `rat1.png` has unknown provenance; regenerate it.

---

## Appendix A: coordinates and the Maze 2 generator

- **Cells:** `(x, y)`, with x running west → east from 0 and y running south → north from 0. Labels: row letter A = northmost row; column number = x + 1.
- **Walls:**
  - A **vertical** wall `(x, y)` lies on the **west edge** of cell (x, y); x = cols is the east boundary.
  - A **horizontal** wall `(x, y)` lies on the **south edge** of cell (x, y); y = rows is the north boundary.
  - Maze 1 lists every wall, boundaries included. Maze 2 lists internal walls only; the outer boundary is always closed.
- **Maze 1 inside the 16 × 10 grid:** maze-1 cell (x, y) is grid cell (x + 1, y).
- **Doom units:**
  - Cell (x, y) interior: `[256x+8, 256x+248] × [256y+8, 256y+248]`.
  - Vertical edge sector (x, y): `[256x−8, 256x+8] × [256y+8, 256y+248]`.
  - Horizontal edge sector (x, y): `[256x+8, 256x+248] × [256y−8, 256y+8]`.
  - Corner pillar (i, j): `[256i−8, 256i+8] × [256j−8, 256j+8]`.

The build script should **read `05-maze-grids.json`** rather than regenerate the maze, because exact parity with Python's Mersenne Twister isn't worth chasing. This is the exact generator used (Python 3):

```python
import random, collections
def gen(W, H, seed, braid=0.5):
    rnd = random.Random(seed)
    wv = {(x, y) for x in range(1, W) for y in range(H)}   # west edges
    wh = {(x, y) for x in range(W) for y in range(1, H)}   # south edges
    seen, st = {(0, H-1)}, [(0, H-1)]
    while st:                                               # recursive backtracker from NW corner
        x, y = st[-1]
        nb = [(x+dx, y+dy) for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))
              if 0 <= x+dx < W and 0 <= y+dy < H and (x+dx, y+dy) not in seen]
        if not nb: st.pop(); continue
        nx, ny = rnd.choice(nb)
        if nx != x: wv.discard((max(x, nx), y))
        else:       wh.discard((x, max(y, ny)))
        seen.add((nx, ny)); st.append((nx, ny))
    def adj():
        a = collections.defaultdict(list)
        for x in range(W):
            for y in range(H):
                if x+1 < W and (x+1, y) not in wv: a[(x,y)].append((x+1,y)); a[(x+1,y)].append((x,y))
                if y+1 < H and (x, y+1) not in wh: a[(x,y)].append((x,y+1)); a[(x,y+1)].append((x,y))
        return a
    a = adj(); dead = [c for c in a if len(a[c]) == 1]; rnd.shuffle(dead)
    for c in dead[:int(len(dead) * braid)]:                 # braid: open one extra wall at half the dead ends
        a = adj()
        if len(a[c]) != 1: continue
        x, y = c
        opts = [(x+dx, y+dy) for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))
                if 0 <= x+dx < W and 0 <= y+dy < H and (x+dx, y+dy) not in a[c]]
        if opts:
            nx, ny = rnd.choice(opts)
            if nx != x: wv.discard((max(x, nx), y))
            else:       wh.discard((x, max(y, ny)))
    return wv, wh
# gen(16, 10, 1982) -> shortest A1->J16 = 52 cells, right-hand rule 74, 8 loops, 9 dead ends
```

Screensaver Mode can port this to ZScript with its own seeded RNG; exact parity isn't needed there.

---

## Sources (facts the parody relies on; persona notes for 06's lines are in 06 §12)

- 3D Maze screensaver: start button, translucent smiley exit, 2D rat, grey polyhedra that flip the view, OpenGL logos, globe images, brick/wood/tile defaults, overlay-map colours — [Wikipedia: 3D Maze](https://en.wikipedia.org/wiki/3D_Maze), [Simple Wikipedia](https://simple.wikipedia.org/wiki/3D_Maze)
- Tron finale: Flynn jumps into the MCP's beam and Tron throws through the gap in the shield — [TV Tropes recap](https://tvtropes.org/pmwiki/pmwiki.php/Recap/Tron1982?from=Recap.Tron), [Wikipedia: Tron](https://en.wikipedia.org/wiki/Tron)
- GZDoom `A_SetRoll` rolls the player camera — [ZDoom Wiki: A_SetRoll](https://zdoom.org/wiki/A_SetRoll)
- Sam Altman, "The Gentle Singularity" (2025) — [blog.samaltman.com](https://blog.samaltman.com/the-gentle-singularity)
- Altman removed by the OpenAI board on 17 Nov 2023 and reinstated about five days later — [CNBC](https://www.cnbc.com/2023/11/22/openai-brings-sam-altman-back-as-ceo-days-after-ouster.html), [ABC News](https://abcnews.com/Business/sam-altman-reaches-deal-return-ceo-openai/story?id=105091534)
- Dario Amodei, "Machines of Loving Grace" (2024) and "The Adolescence of Technology" (Jan 2026) — [Fortune](https://fortune.com/2026/01/27/anthropic-ceo-dario-amodei-essay-warning-ai-adolescence-test-humanity-risks-remedies/), [Zvi's review](https://thezvi.wordpress.com/2026/01/30/on-the-adolescence-of-technology/)
- (Not used in game; kept for context only) Musk: AI "10% or 20%" chance of ending humanity (Abundance Summit, 2024) — [Windows Central](https://www.windowscentral.com/software-apps/ai-safety-researcher-warns-theres-a-99999999-probability-ai-will-end-humanity-but-elon-musk%2Dconservatively-dwindles-it-down-to-20-and-says-it-should-be-explored-more-despite-inevitable-doom), [Deadline](https://deadline.com/2024/06/elon-musk%2Dgives-the-world-10-20-chance-of-something-terrible-happening-with-ai-future-cannes-lions-1235977965)
- "Rapid unscheduled disassembly" (SpaceX / Musk usage) — [SpaceX on X](https://x.com/SpaceX/status/1649045802332073986), [Forbes](https://www.forbes.com/sites/tylerroush/2025/01/16/elon-musks-spacex-test-launch-of-starship-ends-in-rapid-unscheduled-disassembly/)
- Yudkowsky's 2023 TIME op-ed ("Shut it all down"), and *If Anyone Builds It, Everyone Dies* with Nate Soares (2025) — [MIRI](https://intelligence.org/2023/04/07/pausing-ai-developments-isnt-enough-we-need-to-shut-it-all-down/), [Wikipedia](https://en.wikipedia.org/wiki/If_Anyone_Builds_It,_Everyone_Dies)
- Liron Shapira's *Doom Debates* signature question "What's your P(Doom)?" — [Doom Debates](https://lironshapira.substack.com/archive)
- Also used as background, not quoted (see 06 §12 for its verification status): the $97.4B bid and the "misanthropic" / Colossus-lease items behind 06's openers; Anthropic's Responsible Scaling Policy and ASL levels, and its "race to the top" framing; World's iris-scanning Orb; Twitter renamed X; the "let that sink in" sink stunt.
