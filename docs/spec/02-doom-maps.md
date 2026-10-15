# 02 — Which original Doom maps become the other three levels

> **Entrance/refuge revision, 2026-10-08:** The master spec's §5.1 supersedes
> older hub-entry routes below. Every arrival, retry and replay starts outside
> the refuge. E1M4 and E1M7 use their authored cold-start rooms on hub visits;
> future E2M7/E2M2 need separate entrance vestibules that do not cross the refuge.
> The first local rescued survivor leads you there, even after early solo
> exploration. Provide controls on both sides and a separate entrance retreat
> crank. An empty completed refuge must never trigger the finale door seal.

Track: pick the original DOOM.WAD maps for the Hal3000, meg3n and Matrix-style levels and plan them. This file
covers Jonathan's ask (2) (other Doom levels to mod: start, items, where prisoners are held, the physical
affordances each prison offers). It also supplies the door, structure and orientation data that ask (4), the
Bliss/Windows hub layout, needs. Detailed rescue mechanics and who is held where belong to the rescue
designer. Each site below lists its physical affordances so the rescue designer can match people and
solutions to it.

> **Lead-designer resolution ([../GAME-SPEC.md](../GAME-SPEC.md), 2026-10-06).** These map picks are final. The Matrix-style guardian's final name is **AGENTIC SMITH** (06); it keeps this file's materialise-at-the-reporting-camera rule and adds 06's possession of companions. Episode 4's two new tools are the **EMP** and 06's **red-team pill** (placed in alcove 12). The "spoon" lockpick is cut because it duplicated Bostrom's paperclip pick; its table now reads `THERE IS NO SPOON.` Who is held at each P1–P5 site, and how each is freed, is in GAME-SPEC §3.2–3.4.
>
> **Revision 2 (after a WAD audit, 2026-10-06).** Fixed in the tables below: the E1M7 lagoon-74 drop now has a climb-out (two step sectors; the drop is 200 u, not 176); the pod-bay windows are head-height (80 u above the yard), not chest-high; the pod-bay breach raises a rubble ramp; switch 762 becomes SR; E2M7's recommended breach is room 1 from hall 19 (the white-room hole becomes a one-way FIRE EXIT); pedestal 77's floor drops to 112; MEG3N's slots are one-way drops for humans; line 96 becomes WR; switch 680 also opens door 293; E2M2's stepping-stone lines are cleared and scripted, with a new staff stair to the island; Kokotajlo's release stops the crushers; and sector special 9 is cleared on every site and route (E1M7 94/147, E2M2 26/60; E2M7 294 stays a deliberate secret). Each new level's gun holds 3 rounds. Scoring is `rescue-v2`.

## Decisions at a glance

| Level / guardian | Map | Why this map | Runner-up |
| --- | --- | --- | --- |
| **Terminator-style hunter** (exists) | **E1M4 Command Control** | Already built: the central ring suits pursuit. | — |
| **Hal3000** (floating red eye; ship/station/computer core) | **E1M7 Computer Station** | Three raised server rooms reached by lifts, a raised **logic core** platform at the centre, 13 coloured key-door lines HAL can lock, and a sky courtyard holding the original exit building (the **pod bay**). There are two big pursuit loops plus a loop around the first cell. | E2M4 Deimos Lab |
| **meg3n** (killer doll; toy company, factory) | **E2M7 Spawning Vats** | The **vats** become doll-moulding tanks and there is a crate-stacked stockroom. It has 22 door sectors and 16 dead-end rooms, but almost no loops. That suits a fast doll that **cannot open doors** but crawls through the map's many 40–48-unit slots. | E1M5 Phobos Lab |
| **AGENTIC SMITH** (Matrix-style; pods, green code; working name AG3NT) | **E2M2 Containment Area, south half** | Three glowing-blue tank troughs with catwalks look like pod rows. The map also has a five-crusher "harvester" corridor, three perpetual-platform test rigs, stepping stones that rise out of a red pool, and a dark secret room. The crate warehouse is sealed, which leaves about 6.0 k units² of floor (E1M4 has 6.4 k). | E1M2 Nuclear Plant |

Conventions that hold on all four levels (details in §4):

- **Front door.** Every one of these maps has a `DOOR3` wall behind the original player start, the door
  Doomguy "came in through". On E1M7 and E2M7 that wall becomes the structure's door in the meadow. On E2M2 the
  south-half variant uses the original **EXIT room** instead. In hub mode you walk in through this door. On a cold
  start it is hidden behind the 4-bolt maintenance cover, exactly like E1M4's duct.
- The **refuge** is the room just inside the front door. On a **cold start** you wake somewhere nearby. The first
  rescue is about 400–1,900 units from the wake point, and the first guide leads back to the refuge.
- **9 cameras/sensors per level**, which keeps `camerasTotal` and the scoring cap unchanged. **One charge per level.**
  At most **two new tools** per level. The wrench carries between levels and a spare is always in the refuge.

Files written: [`maps/<MAP>.png`](maps/) for all 27 maps · [`maps/all-maps.png`](maps/all-maps.png) ·
[`maps/E1M7-plan.png`](maps/E1M7-plan.png) · [`maps/E2M7-plan.png`](maps/E2M7-plan.png) ·
[`maps/E2M2-plan.png`](maps/E2M2-plan.png) · [`maps/map-stats.json`](maps/map-stats.json) · tools in
[`maps/tools/`](maps/tools/).

> The floor plans are derived from the commercial DOOM.WAD. Keep them in this private repo, as with the WAD itself.

---

## 1. Method

- **Source.** `doom-web/local/DOOM.WAD` (registered: E1M1–E3M9) is parsed directly in Python
  ([`maps/tools/doommaps.py`](maps/tools/doommaps.py)) from the vanilla lumps THINGS, LINEDEFS, SIDEDEFS,
  VERTEXES, SECTORS, SEGS, SSECTORS and NODES. Sector interiors are rasterised through the map's own BSP, so
  concave rooms and nested sectors are exact.
- **Renders.** [`maps/tools/render_all.py`](maps/tools/render_all.py) draws every map in the same style:
  - Solid walls are black and steps/ledges grey. Floors are shaded lighter the higher they are.
  - Doors are orange, key doors are drawn in their key colour, lifts are cyan, and damaging floors are green
    (pale green where no damage special is set).
  - Open sky has a blue tint and secret sectors are purple. Crushers are red, exit lines red, teleporters magenta.
  - Also marked: keys, the player-1 start arrow, and a 512-unit grid with coordinates.
  - Run `python3 render_all.py --debug E2M7` to also write a sector-numbered plan to `/tmp/pdoom-spec/maps/`.
- **Metrics** (in `map-stats.json`, and summarised in §2):
  - **Walkable region** is the set of sectors with ≥ 56 units of headroom, plus doors and lifts. Two sectors
    connect only if their shared opening is ≥ 33 units wide and the step is ≤ 24 units (Doom's step limit).
    Doors and lifts are treated as open.
  - **Loops** are obstacles that can be circled on foot, measured as holes in the main walkable region.
    *Big* means a perimeter ≥ 2,048 units. This counts a ring-shaped corridor around a pillar, which a plain
    sector-graph cycle count misses. The cycle counts are also kept in the JSON.
  - **Dead-end rooms** are side branches of ≥ 16 k units² that hang off the main loop structure through a single
    bridge edge. *Door-gated* means that bridge is a door.
  - Also recorded: damaging and sky floor share, floor range, number of distinct floor levels, one-way drops,
    and texture families by wall area.
  - **Route lengths** (plan sections) are geodesic walking distances on a 4-unit raster of that walkable region,
    with doors and lifts open. For comparison, E1M4's refuge-to-cell distances measured the same way are:
    Milo 1,014 · Jules 3,623 · Sam 3,079 · Noah 4,820 · Ash 4,229 (total 16,765).
- **Cross-check.** Sector, line and bounds counts for E1M2/4/5/6/7 match the earlier
  `output/redesign/doom-map-comparison.json`.
- **Annotations.** [`maps/tools/plans.py`](maps/tools/plans.py) holds every planned coordinate, so the plans are
  reproducible: `cd docs/spec/maps/tools && python3 render_all.py && python3 plans.py`.

## 2. All 27 maps at a glance

![All maps](maps/all-maps.png)

| Map | Title | Sectors | Size (units) | Walkable (k u²) | Loops (big) | Longest loop | Dead-end rooms (door-gated) | Key doors | Lifts | Damaging | Sky | Floor range | Dominant walls |
|---|---|--:|--:|--:|--:|--:|--:|---|--:|--:|--:|---|---|
| E1M1 | Hangar | 85 | 4576×2816 | 4,476 | 1 (0) | 1,484 | 5 (0) | – | 1 | 9.1% | 35.5% | -136..136 | STARTAN3, BROWNGRN, STARG3 |
| E1M2 | Nuclear Plant | 200 | 5312×3904 | 9,464 | 8 (5) | 4,845 | 7 (1) | R2 | 5 | 4.7% | 43.9% | -232..272 | COMPTALL, BROWN1, STARTAN2 |
| E1M3 | Toxin Refinery | 177 | 4224×3056 | 5,724 | 4 (1) | 4,414 | 6 (0) | B2/Y2 | 6 | 14.1% | 18.5% | -32..368 | STARG3, STONE, BROWNGRN |
| E1M4 | Command Control | 139 | 3720×2784 | 6,453 | 8 (4) | 12,244 | 11 (1) | B2/Y2 | 3 | 6.4% | 2.2% | -64..328 | BROWNGRN, SLADWALL, BROWN96 |
| E1M5 | Phobos Lab | 143 | 3968×3232 | 5,137 | 6 (3) | 5,782 | 9 (4) | B3/Y2 | 3 | 21.4% | 16.4% | -216..112 | STONE2, STONE, BROWN1 |
| E1M6 | Central Processing | 250 | 5776×4768 | 9,507 | 11 (3) | 3,606 | 41 (9) | B3/R4/Y6 | 3 | 27.8% | 20.2% | -80..192 | BROWNGRN, BROWN1, BROWN96 |
| E1M7 | Computer Station | 170 | 4032×3432 | 7,242 | 7 (2) | 4,337 | 11 (2) | B2/R2/Y9 | 5 | 17.8% | 18.2% | -32..264 | SLADWALL, STARTAN3, STARG3 |
| E1M8 | Phobos Anomaly | 74 | 6616×7136 | 26,788 | 1 (1) | 3,221 | 0 (0) | – | 1 | 0.6% | 89.6% | -136..208 | BROWN96, BROWNHUG, BROWN1 |
| E1M9 | Military Base | 147 | 3392×3200 | 4,942 | 8 (3) | 4,603 | 8 (2) | B2/R4/Y4 | 5 | 18.5% | 31.0% | -168..208 | BROWN96, BROWN1, BROWNGRN |
| E2M1 | Deimos Anomaly | 92 | 2576×1984 | 3,488 | 0 (0) | 0 | 1 (0) | B2/R2 | 0 | 7.4% | 3.5% | -88..128 | STONE2, GSTONE1, SLADWALL |
| E2M2 | Containment Area | 245 | 3200×5184 | 10,794 | 7 (5) | 24,705 | 12 (2) | B3/R2/Y2 | 2 | 8.4% | 0.0% | -48..160 | CRATE1, BROWN1, TEKWALL1 |
| E2M3 | Refinery | 128 | 3552×2520 | 5,050 | 5 (1) | 5,384 | 11 (1) | B2 | 0 | 16.4% | 11.9% | -48..88 | BROWN1, MARBLE3, BROVINE |
| E2M4 | Deimos Lab | 205 | 3904×3776 | 9,500 | 7 (0) | 1,852 | 12 (1) | B1/Y1 | 3 | 15.9% | 0.0% | -112..592 | METAL1, STONE2, GRAYVINE |
| E2M5 | Command Center | 241 | 4288×3712 | 9,122 | 7 (6) | 10,931 | 15 (8) | – | 2 | 16.5% | 11.7% | -152..128 | BROVINE2, GRAYBIG, SP_HOT1 |
| E2M6 | Halls of the Damned | 181 | 3296×5000 | 6,302 | 4 (1) | 4,771 | 20 (11) | B1/R1/Y5 | 0 | 7.4% | 13.0% | -24..80 | STONE2, ICKWALL1, GSTVINE2 |
| E2M7 | Spawning Vats | 323 | 3968×2880 | 7,728 | 1 (0) | 779 | 16 (1) | B2/R2/Y2 | 0 | 7.1% | 15.8% | -72..264 | STONE, SHAWN2, COMPOHSO |
| E2M8 | Tower of Babel | 27 | 3136×5056 | 11,273 | 5 (1) | 12,012 | 0 (0) | – | 0 | 0.0% | 95.0% | 0..72 | BROWNHUG, BROWN96, MARBFACE |
| E2M9 | Fortress of Mystery | 19 | 3584×1920 | 2,889 | 0 (0) | 0 | 1 (0) | B1/R1/Y1 | 0 | 6.2% | 0.0% | -48..16 | SP_ROCK1, GSTONE1, GSTONE2 |
| E3M1 | Hell Keep | 39 | 2304×4352 | 4,502 | 2 (1) | 2,984 | 2 (0) | – | 2 | 12.3% | 82.7% | -128..104 | SP_HOT1, PIPE1, STONE3 |
| E3M2 | Slough of Despair | 68 | 2872×4352 | 4,116 | 8 (2) | 3,572 | 4 (2) | B1 | 0 | 0.1% | 69.4% | 0..256 | ASHWALL, SP_ROCK1, SP_ROCK2 |
| E3M3 | Pandemonium | 192 | 3520×3008 | 4,817 | 3 (1) | 28,613 | 12 (0) | B2 | 3 | 14.6% | 19.5% | -120..272 | SLADWALL, CEMENT3, WOOD1 |
| E3M4 | House of Pain | 186 | 4160×3800 | 6,067 | 2 (0) | 808 | 14 (8) | B2/R1/Y1 | 0 | 20.5% | 6.3% | -16..160 | GSTONE1, PIPE2, GSTONE2 |
| E3M5 | Unholy Cathedral | 268 | 4800×4624 | 8,253 | 11 (6) | 3,161 | 8 (5) | B2/Y1 | 0 | 6.6% | 42.3% | -48..248 | GSTONE1, SP_HOT1, METAL |
| E3M6 | Mt. Erebus | 125 | 6784×6792 | 31,452 | 19 (7) | 10,756 | 7 (0) | B1 | 0 | 63.3% | 93.0% | -128..200 | SP_HOT1, FIREBLU2, STONE2 |
| E3M7 | Limbo | 166 | 3712×3840 | 10,436 | 7 (1) | 2,932 | 5 (0) | B2/R7/Y2 | 3 | 44.9% | 0.0% | -96..256 | GSTONE1, SP_HOT1, SP_ROCK1 |
| E3M8 | Dis | 17 | 3712×3992 | 9,188 | 0 (0) | 0 | 1 (1) | – | 0 | 0.0% | 70.8% | 0..64 | MARBLE1, MARBLOD1, SKINTEK2 |
| E3M9 | Warrens | 71 | 5640×5824 | 9,093 | 1 (0) | 1,876 | 2 (0) | B1/R1 | 2 | 9.4% | 75.1% | -136..128 | SP_HOT1, GRAY4, STONE3 |

Quick rejects:
- **Boss and arena maps** E1M8, E2M8, E2M9 and E3M8 have under 80 sectors and are 70–95 % open sky.
- **Hell-flesh maps** E3M1–E3M7 are hell marble and flesh, mostly outdoors or lava. E3M6 has 31 k u² of
  walkable floor and 63 % of its floor is lava.
- **E2M1** is tiny and has no loops.
- **E1M1** is linear (one small loop) and is everybody's memory of "level one", which makes it better saved for a
  later idea.

The real field is the tech-base maps of E1 and E2.

## 3. Choosing maps for the three new guardians

### What each level needs from a map

1. **Five cell sites** that are spread out, are dead ends or side rooms, and each come with a *different*
   physical toy: a lift, switch, window, crawl slot, hazard floor or moving machinery.
2. **A pursuit space that fits the guardian.** Loops matter for walkers such as the existing Terminator. A
   teleporting or flying guardian needs less of them.
3. **A refuge** with a single closable entrance, at the map edge so it can join the meadow door.
4. **A theme reading** from the original textures alone. There is no retexturing; Jonathan values the
   authentic maps.
5. **Size close to E1M4** (≈6.4 k u²), or a clean way to seal part of the map with a few locked doors.
6. **Mechanisms in the original map to reuse:** remote switches, donut, stairs-raise, crushers, perpetual
   platforms. These give non-repetitive rescues for free.

### Candidate evaluation (score 1–5 per guardian; ✔ = pick)

| Map | Hal3000 (station/core) | meg3n (toy lab/factory) | Matrix (pods/Sentinels) | Geometry notes |
| --- | --- | --- | --- | --- |
| E1M7 Computer Station | **5 ✔** — computer banks (COMPTALL/COMPSPAN/COMPUTE2), raised core on lift 35, pod-bay exit building in the sky yard | 2 | 3 | 7 (2) loops, 11 dead ends, 3 lifted server rooms, 18 door sectors, 13 key-door lines |
| E2M4 Deimos Lab | 4 (runner-up) — fully enclosed (0 % sky), concentric "centrifuge" ring around a spiral core, COMPBLUE/METAL1 | 3 — crushers as toy presses, spiral as a carousel | 2 | **No big loops** (longest 1,852); 205 sectors; 10 secrets; 704-unit vertical range; 9.5 k u² |
| E1M5 Phobos Lab | 2 | 3 (runner-up) — compact (5.1 k), "lab", 4 door-gated dead ends | 2 | 6 (3) loops; 21 % nukage |
| E1M6 Central Processing | 3 | 2 | 3 | 41 dead ends would make great cells, but 9.5 k u², 28 % nukage and sprawl (LEVEL-01 already ruled it out) |
| E1M2 Nuclear Plant | 3 | 1 | 4 (runner-up) — the power plant fits the "humans as batteries" premise; the most computer wall texture in the WAD (COMPTALL 21 %, all COMP* 23 %); maze south | 8 (5) loops, 7 dead ends, 9.5 k u², 44 % sky courtyards |
| E1M3 Toxin Refinery | 2 | 2 | 3 — green nukage | Only 1 big loop; 6 lifts; 67 % of the floor in the main region |
| E2M2 Containment Area | 2 | 4 — crate warehouse = toy stock | **5 ✔ (south half)** — glowing-blue tank rows with catwalks = pod rows; crushers = harvester line; moving-platform rigs | 7 (5) loops; 24,705-unit lower loop; 12 secrets; whole map is 10.8 k u², so seal the north crate half |
| E2M5 Command Center | 4 — 68 door lines would suit door-control play | 2 | 3 | 6 big loops, 15 dead ends (8 door-gated); hell/wood textures weaken the "station" read |
| E2M7 Spawning Vats | 2 | **5 ✔** — vats, crate stockroom, COMPTALL R&D lab, many doors | 4 — "vats" ↔ grown humans | **1 loop only** (tree of rooms); 323 sectors (most work); 16 dead ends |
| E3M1 Hell Keep | 1 | 1 | 2 | 39 sectors, 83 % sky: too small and open |
| E3M6 Mt. Erebus | 1 | 1 | 2 — "desert of the real" | 31 k u², 63 % lava; reject |

### Why these three picks over the alternatives

- **E1M7 for Hal3000, not E2M4.** E2M4's centrifuge ring is the prettiest "2001" image in Doom. But its loop
  metric shows **no loop over 1,852 units**, and its 704-unit vertical range means long ramps. E1M7 gives
  readable pursuit loops, including one around the first cell. It also has three classic "lift up to the server
  room" spaces, a literal raised core platform (36) for HAL to float above, and the original **exit building
  standing in an open sky yard**, which naturally becomes the *pod bay*. Its 13 coloured key-door lines become the
  doors HAL locks on you.
- **E2M7 for meg3n, not E2M2.** E2M2's crate maze is the most toy-warehouse space in Doom (CRATE1 is 13 % of its
  wall area), but it is half of a 10.8 k map and is a hide-and-seek space that needs loops. E2M7 is a **tree of
  rooms with 22 door sectors**. A doll that **cannot open doors** but crawls through E2M7's many 40–48-unit slots
  (console slots 86–89, the under-console strip 194, slots 136 and 163) gives a different fear from the
  Terminator: shut doors are safety and vents are danger. The vats, crate stockroom 195 and COMPTALL lab 108/219
  with two lit COMPBLUE alcoves (the doll's charging docks) carry the theme with original textures. Computer
  textures are 16.8 % of E2M7's wall area.
- **E2M2 south for the Matrix, not E2M7 or E1M2.**
  - *Spawning Vats* has the best name for the Matrix's grown humans. Its vats, though, are nukage pools, and its
    tree topology needs the doll's door rule more.
  - E2M2's three **FLAT22-lit troughs between catwalks, with COMPBLUE walls** are the most "rows of glowing pods"
    image in the WAD.
  - The south half also offers the most varied *machinery* for non-repetitive rescues: a **five-crusher corridor**,
    **perpetual-platform rigs**, **stepping stones that rise one by one** out of a red pool, a **dark secret room
    lit by a pressure pad**, and a **nukage bridge switch** by the exit.
  - AGENTIC SMITH's camera-jumping (§7) covers the size.
  - Sealing the warehouse costs two locked doorways (243 and 221) and leaves 6.0 k u².
  - E1M2 stays the runner-up: it is thematically strong (a power plant), but 44 % of its area is sky courtyards
    and its maze is narrow for escorts.

Across the four levels you get four different looks:
- E1M4: brown and green command base.
- E1M7: grey STARTAN/COMPTALL station with a sky yard.
- E2M7: stone and SHAWN factory with vats.
- E2M2: concrete, tanks and crushers.

That is two Knee-Deep and two Shores-of-Hell tech bases, and no hell maps before the Windows maze.

## 4. Conventions shared by all four levels

### Front door, refuge and the two start modes

Jonathan's structure lets any of the four levels be the one chosen at the title screen, and the other three are
entered later from the meadow. Each map therefore needs one door to the meadow and two start modes.

| | Cold start (this level was picked first) | Hub mode (entered from the meadow) |
| --- | --- | --- |
| Where you begin | The level's **cold-start bed** (a quiet room near the refuge; per-level gag). | In the **vestibule** behind the front door, facing into the refuge. The guardian seals the vestibule door behind you, but the seal is a manual crank (hold E 1.5 s), so retreat is always possible. |
| Refuge | Unknown until the first freed person guides you there (E1M4 behaviour). | Known: it is the first room you walk through, which gives a natural safe base. |
| Exit | The front door is hidden behind the generic **4-bolt maintenance cover** inside the refuge, as in E1M4. Same gather → the guardian's exit confrontation → 40 s/65 s hint → bolts → bent duct → meadow reveal. | When all five sites are resolved and the living group is gathered, the guardian's exit confrontation plays at the vestibule; then you leave through the door you came in by. |
| Kit | Nothing. Wrench in the cold-start room. | You keep the wrench. Consumables (ammo, charge, keys, level tools) never carry over; a spare wrench is in the refuge. |
| People | Per-person state (imprisoned / following / camp / lost) comes from the campaign save and is applied at map load, whatever GZDoom's hub snapshots do: saved people's cells spawn open and empty; on a replay only the lost respawn as captives. | Same |

- **Why DOOR3.** E1M4, E1M7, E2M2 and E2M7 each have a one-sided `DOOR3` wall directly behind the player start:
  - E1M4 line 745 (x 2120, east)
  - E1M7 line 336 (y 608, north)
  - E2M2 lines 1218/1263 (y 4608, north)
  - E2M7 line 1327 (y 2112, north)

  "The door you came in through" is already drawn on every map, so turning it into the meadow door needs no new
  façade. E2M2's south-half variant uses its original exit room instead (§7).
- **Vestibule geometry.** Add a short bent duct of new sectors outside the original outer wall, beyond the DOOR3
  line, with one 90° bend. Every point from which no sky can be seen early is new space, so original vertices
  stay untouched. Reuse E1M4's cover/bolt actors and its crawl-duct pattern.
- **Order independence.** Every level contains its own wrench, gun, charge, stimpacks, medikits and tools. Never
  require an item from another level. Freed people from earlier levels wait in the meadow; each level is the
  player's CEO plus that level's five prisoners.

### Shared counts and rules

- **9 cameras/sensors per level.** The art differs per guardian: eye panels, teddy cams, jacks. Scoring is
  `rescue-v2` (10,000 per figure, 1,000 for the CEO, 9 × 250 = 2,250 camera bonus), and each level gets its own
  `levels.js` descriptor and boards.
- **3 rounds of gun ammo per new level** (E1M4 keeps its 7), so the gun opens at most one problem per level.
- **No stray secrets.** The overlay asserts that no prison site, cell or required route sector keeps sector special 9;
  deliberate secrets go on an allowlist.
- **One charge per level**, with one recommended breach. Thin shared walls were found by geometry search and are
  listed per level.
- **≤ 2 new tools per level.** Everything else reuses the wrench, gun, key cards, charge, stimpacks (6, +10) and
  refuge medikits (3, +25).
- **Key doors.** As in E1M4, coloured doors are ordinary usable facility doors unless a level gives them a role
  (E1M7: HAL-locked doors). The original key cards keep their spots and act as overrides or bonuses.
- **Monsters and exits.** Remove all original monsters. Keep decorations, barrels only where they are set
  dressing, and pickups we need. Disable original exit lines:
  - E1M7 line 810
  - E2M7 line 1400
  - E2M2: exit line 1297 becomes the front door

### Hand-off to the hub layout (ask 4)

Doom +y is north. With E1M4's existing convention (its bunker door is on the north face, −z in the meadow), an
unrotated structure faces:

| Level | Front door (Doom units) | Faces | Interior extent (at 32 u ≈ 1 m) | Suggested façade cue |
| --- | --- | --- | --- | --- |
| E1M4 (exists) | Meadow door = north-recess escape duct (bunker at x 8..26, z 0..16) | north (−z) | 3720×2784 u ≈ 116×87 m | Existing bunker |
| E1M7 Hal3000 | Line 336, x 160..224, y 608 (nook 61 → start room 60) | **north** | 4032×3432 u ≈ 126×107 m | Grey station dome with one red lens over the door |
| E2M7 meg3n | Line 1327, x 1344..1408, y 2112 (corridor 291 → start room 181/287) | **north** | 3968×2880 u ≈ 124×90 m | Pastel toy-factory block with a giant cardboard box |
| E2M2 AGENTIC SMITH | West wall of exit room 9, x −384, y −160..−32 | **west** (−x) | South half ≈ 3200×2700 u ≈ 100×84 m | Black monolith with falling green glyphs |

All four interiors are much larger than a meadow-scale building, so treat the structures as **bigger on the
inside**. The façade is a small, recognisable object; the doorway's live Doom view already sells the interior.
The hub designer can rotate a structure freely. The door just has to sit on the face listed above.

---

## 5. Hal3000 — E1M7 Computer Station

![E1M7 plan](maps/E1M7-plan.png)

**Reading.** The station *is* HAL. Wall-mounted red **eye panels** are its cameras, coloured doors are its
fingers, and the floating eye drone is its body, drifting out from the raised **logic core** (sector 36) in the
central computer room 20.

The eye **floats**:
- It ignores floor height, so it crosses the four nukage lagoons (3, 74, 119, 145) and rises to the lifted server
  rooms without lifts.
- **Lifts and ledges are not safety from HAL. Doors and crawl slots are.**

Footprint: whole map, 7.2 k u² walkable. Nothing sealed.

### Front door, refuge, start

| | Location | Notes |
| --- | --- | --- |
| Front door | DOOR3 line 336 (x 160..224, y 608), behind nook 61 (192, 592) | New bent vestibule duct north of y 608. Hub entry: nook 61 → refuge. |
| **Refuge** | Original start room **60** (x 8..376, y 368..576; 76 k u²) | **Single entrance**: door 62 (x 128..256, y 352..368) becomes the bulkhead. Same slot/medikit layout as E1M4. HAL's eye cannot enter ("a manual-only crew bay: no lenses"). |
| **Cold-start bed** | Room **49** "hibernation bay" (0, −246) | Entered from stair hall 51 and lit doorway 52 off hall 13; slot window 50 onto hall 12. P1 is 733 units away. |
| Guardian spawn | Logic core platform **36** (364, −882), raised 128 above room 20 on lift 35 (tag 2) | Idles above the core and returns there when it loses you. |

### Kit and items

| Item | Where | Notes |
| --- | --- | --- |
| Wrench | Cold-start room 49 (60, −300); spare in refuge | Reused |
| Gun (3 rounds) | NE hall 44 (746, −120) | Reused |
| Key cards = **manual overrides** | Yellow (1344, −192) on raised east platform 47 (lift 23); blue (−1024, 272) on the nukage walkway 76; red (−1424, 384) inside server farm 73 (P2) | Original positions. A card opens its colour's doors even while HAL has them locked. |
| Charge | Room 80 (1000, −2050) | Recommended breach: the **pod-bay south wall** facing the yard (16 thick, 192 long at (1312, −2368)), giving P4 a second entrance. The bay floor (56) is a 56-u ledge above yard 98 (0), so the blast also raises a **rubble ramp**: two new tagged step sectors in the yard against the wall (each ≥ 32 deep), raised from 0 to 24 and 48 by the explosion and dressed with rubble sprites. |
| **New tool 1 – Flash camera** | Blinking computer nook 26 (1278, −509) | 3 flashes; blinds HAL and any eye panel within ~10 m for ~8 s. Counters a flying sentry without a stun lock; the hero of Soares's *flash and thaw*. |
| **New tool 2 – Hazmat suit** (native Doom SUIT, thing 2025) | Room 0 (−1150, −450) and SW room 116 (−600, −2100) | 60 s nukage immunity for the wearer, opening the crouch-slot shortcuts through the lagoons (below). **Conditional:** ships only if the milestone-1 spike shows a crouched companion (28 u) fits the 32-u slots. |
| Stimpacks ×6 | 13 west arm, 12, 0, 116, 80, 81 | Medikits ×3 in the refuge |

### Prison sites

| # | Site | Location | Why it suits a cell | Physical affordances | Original mechanisms to reuse | Walk from refuge / cold start |
| --- | --- | --- | --- | --- | --- | --- |
| **P1** | **Supply closet 64** | x −240..−64, y −128..64. Door **65** faces west onto hall 13. | First rescue: next to the start, a closed box encircled by hall 13. A **2,016-unit pursuit loop runs right round the cell**. | Door 65 is a *tagged* door (no handle). Low hall 13 (72 high) on all sides. Secret nukage closet 71/72 nearby, off 13's west arm. | Walk line **286** (−600, 408) on the red-door walkway (W1, tag 11) opens **65 and 164** together: one remote that also unlocks P5's approach. | 933 / 733 |
| **P2** | **NW server farm 73** | x −1792..−1280, y 0..448; floor 152 (+104 over room 0) | The most remote cell (late rescue). A raised computer room HAL can lift-lock. | **Lift 70** (tag 9; lines 248, 642–645). **40-high crawl slot 75** (−1392, 384) drops **200 units** (176 → −24) into nukage pool 74. Pool 74's lowest neighbour is 56 u up, so **add two step sectors inside 74 against walkway 76's west edge** (line 884, x −1040): floors 0 and 16, each 32 deep, at x −1104..−1072 and −1072..−1040, y 224..320. Then −24 → 0 → 16 → 32 climbs out to walkway 76 → red door 79 → hall 13 → refuge (~1.7 k), about 320 u of wading at 5 HP/s. A one-way escape. COMPSPAN/COMPTALL banks, blinking light. Red card. | Line **734** inside 73 (W1, tag 12) opens closet door 69 (room 68) and low-maze door 132: rescuing here unlocks two other places. | 6,374 / 5,786 |
| **P3** | **SW pedestal, server room 139** | Room x −1472..−896, y −2816..−2240 (floor 112, lift **125** tag 10). Prisoner on pedestal **140** (−1312, −2656), 128 above the room floor. | A suspended-animation column in a lifted server room. | Lift 125 (lines 660, 687, 908). Door 127 (−712, −2144). Pedestal headroom 72 (fine for a 56-u human). **40-high slot 143** drops to nukage 145, giving a one-way escape via an 8-u step to secret 147 (clear its special 9), 148 (walk line 504 opens door 149) → lift 135. | Switch line **623** in tiny room **161** (32, −1648), ~1.5 k away in the low maze (S1 floor lower, tag 13), lowers the pedestal: a ready-made **remote release**. | 4,634 / 4,047 |
| **P4** | **The pod bay** (original exit building 100/108) | x 1144..1952, y −2368..−2240, standing in the sky yard | HAL's famous refusal to open the pod-bay doors, played straight. | Door **104** (1216, −2120) opens **only** from switch line **762** in alcove **128** (352, −1792), off room 81. Inner door 114. **Four head-height windows** 101/102/110/111 (32-high openings, floor 80, ceiling 112: 80 above the yard, 24 above the bay floor) face the yard. Original exit switch 112. From **inside**, the windows can be crouched through (24-unit step up from the bay floor, then an 80-unit drop): a one-way escape into the yard. Confirm the 28-u crouched companion fits the 32-u opening. Put the hissing-seal actor on a window's lower lip (z 80) so a wrench strike from the yard can reach it. | Tag-14 switch door; **convert switch 762 from S1 (103) to SR (63)** so HAL re-closing door 104 doesn't spend it. Seal actor breakable by wrench. Exit line 810 disabled. | 4,096 / 3,508 |
| **P5** | **Sealed corridor 94** | x 416..928, y −1472..−1344, ceiling 72; clear its secret special 9 | A prisoner shut between two locked doors, and the **only walkable way into the sky yard**. Freeing P5 opens the yard route to P4's windows. | Yellow door **95** (west, from 163). Yellow door **96** (east, to yard 18). Approach door **164** (tag 11, yellow). Low ceiling. | Walk line **286** opens 164 (see P1). Yellow card overrides. | 2,693 / 2,106 |

Order of discovery from a cold start: P1 (closet, next to the hibernation bay) → P5 (centre-south) → P4 (via the
yard) → P3 (SW) → P2 (NW, farthest).

Total refuge→cell distance is 18.7 k (E1M4: 16.8 k). P2 is the long trip, so the rescue designer should give it a
fast way home: its one-way slot 75.

### Guardian space and sensors

- **Patrol** (dashed on the plan):
  1. A ring inside computer room 20 around the core, the loop of 4,337 around (399, −899).
  2. The north-hall loop around closet 64 (2,016).
  3. Yard sweeps through 18/98/107. From the yard the eye peers in through windows 21 (into 20), 25 (into 24) and
     103/105 (into 80).
- **Lagoon shortcuts.** The eye crosses nukage lagoons directly. Humans have three **32-high crouch slots** between
  the halls and lagoon 3: 14 (−512, −384), 17 (−352, −904) and 165 (−8, −1208). With the hazmat suit, these make a
  sneaky north–south route that bypasses room 20. **Only if the crouch spike passes**; otherwise grate them.
  - Verify that companions' crouch collision fits 32 units; E1M4's ducts are 40.
- **HAL-specific map rule.** On a sighting, HAL closes (and locks) the door nearest the target on its route, with a ~20 s
  cooldown; one wrench hit jams a door's panel open for good, and a 1.5 s crank opens it quietly. These are
  the 13 key-door lines, e.g. yellow 39/41 into room 20 and yellow 2 into room 0. Holding the matching card
  overrides them. This uses data already in the map, with no new geometry.

| Eye panel | Position | Watches |
| --- | --- | --- |
| C1 | (−330, 230) hall 13 NW | P1 door 65, red door 79 |
| C2 | (650, 120) hall 13 / 44 | NE approach |
| C3 | (300, −470) hall 12 | Main E–W corridor |
| C4 | (−957, −120) room 0 | Lift 70 to P2 |
| C5 | (60, −1050) room 20 SW | Core room west door, low maze |
| C6 | (969, −560) hall 24 | Yellow door 41, east nook |
| C7 | (173, −1650) low maze 131 | Blue door 89, switch room 161 |
| C8 | (900, −1850) room 80 | Pod-bay door 104 |
| C9 | (−415, −1950) room 116 | Door 127 / lift 125 to P3 |

### Modifications to E1M7

- New: vestibule duct beyond line 336, and the refuge cover and bolts on the start room's north wall.
- Cell interiors: the closet, server farm, pedestal top, pod bay and corridor are already enclosed rooms, so no
  cell sectors are needed. Add only lock/handle actors.
- **New sectors (original vertices untouched):** two step sectors in lagoon 74 against walkway 76 (floors 0 and 16),
  and two tagged rubble-ramp sectors in yard 98 against the pod-bay south wall (raised to 24 and 48 by the blast).
- **Specials:** keep 286, 623, 734, 504, 511 (bridge 120) and the lift tags 1, 2, 9, 10, 6. **Convert 762 to SR (63).**
  Disable exit line 810. **Clear sector special 9 on 94 (Barnes's corridor) and 147 (P3's way home).**
- Retexture the EXITSIGN in 108 to plain TEKWALL so the cold-start pod bay carries no "exit" promise
  (LEVEL-01 rule).

---

## 6. meg3n — E2M7 Spawning Vats

![E2M7 plan](maps/E2M7-plan.png)

**Reading.** A toy-company factory gone wrong:
- The vats are doll-moulding baths (green nukage) and a paint vat (red BLOOD3).
- Crate stockroom **195** (1.2 M u², with crate-top pillars) is the toy store.
- The COMPTALL R&D lab **108/219** is where meg3n was built. Its two lit COMPBLUE alcoves, **126** (2587, 736) and
  **216** (2587, 1120), become her charging docks.

The map is a tree (one small loop, 16 dead ends, 22 door sectors). That suits a guardian that is fast in short
bursts but **cannot open doors**: GZDoom monsters open doors only with the `CANUSEWALLS` flag, so leave it off.
She is small (radius ≈ 12, height ≈ 32), so she **can use crawl slots**:

| Slot | Height | Connects | For humans (native movement) |
| --- | --- | --- | --- |
| Console slots 86–89 (1568, −144..−304) | 40–48 | Rooms 78 and 79 | **One-way drop** 79 → 78 (slots sit 56 above room 78) |
| Under-console strip 194 (1888, 2048) | 48, 320 long | Hall 171 and the strip | Dead-end niche (24-u step up from 171) |
| Slot 136 (2480, −256) | 40 | Rooms 129 and 134 | **One-way drop** 129 → 134 (72 u) |
| Slot 163 (3072, 656) | 48 | Room 161 and the yard | **One-way drop** 161 → yard 151 (64 u), at the yard's north edge under C9 |

MEG3N travels every slot **both ways** on scripted climb links in her small-body nav graph (a ZScript traversal
along each slot, with an audible scrabble as the tell). Shut doors are safety. Vents are where she comes from.

Footprint: whole map, 7.7 k u². Optional cut: lock the NW secret sky yard 284 and the SW secret blood room 47.
They are secrets, not routes.

### Front door, refuge, start

| | Location | Notes |
| --- | --- | --- |
| Front door | DOOR3 line 1327 (x 1344..1408, y 2112) at the north end of entry corridor **291** | Corridor 291 (14 k) becomes the vestibule; the new bent duct goes north of y 2112 |
| **Refuge** | Original start room **287 + 181**, ramp **286** and nook **288** (x 1152..1536, y 1536..1920; ≈168 k u², four SLADSKUL pillars) | Two openings:<br>• **Bulkhead** at 286↔264 (x 1184..1344, y 1536).<br>• **Grate** at 287↔180 (x 1472..1536, y 1536). This copies E1M4's "bulkhead plus fixed grate" refuge.<br>Secret door 293 (tag 8) is also opened by switch 680 (overlay link), so closet 294 is reachable. |
| **Cold-start bed** | Room **285** "showroom" (1031, 1760), MARBFAC3 walls | Joins 264 (south) and blue door 309 (west). P1 is 410 units away. |
| Guardian spawn | Charging docks 126/216 in lab 108/219 (≈2587, 930) | She "wakes" when a sensor reports you or a noise lands within ~1,500 units |

### Kit and items

| Item | Where | Notes |
| --- | --- | --- |
| Wrench | 285 (1031, 1700); spare in refuge | Reused. A close wrench strike knocks meg3n back (reuse the hunter stun). |
| Gun (3 rounds) | Hall 11 north end (1754, 600) | Reused |
| Yellow card | Raised console 226 (1760, 1088) | Original position |
| Red card | On pedestal 77 (P4) | Original position: a reward for P4 |
| Blue card | Yard alcove 148 (P5) | Original position |
| Charge | Hall 19 (770, 153) | Recommended breach: **room 1 from hall 19** (64 thick at x 384..432/528..576, y 256–320; both floors 72), a loud second way into P2's room. Alternative: loft 296 (floor 112) from hall 300 (floor 72; 16 thick at (632, 1920)), with one new step sector at floor 92 inside the breach. **Not a breach:** white room 7 (floor 184) over hall 260 (floor 32) is a 152-u cliff, so that 32-thick wall at (1264, 1120) instead gets a scripted FIRE EXIT door: a one-way drop out of P3. |
| **New tool 1 – Wind-up cymbal monkey** | The shelf in cold-start showroom 285, by the wrench (moved from dais 174 so Zvi's rescue can use it first) | Thrown noise lure. Reuses the hunter's investigate-noise logic. meg3n goes to it and does her **dance tell** before "attacking" it. |
| **New tool 2 – Parental-controls remote** | Lab console 221 (2464, 928) | 3 charges; freezes meg3n (or a toy robot, e.g. NANNY-BOT's 20 s Bedtime mode) ~5 s within 12 m line of sight. Ranged version of the existing close-stun, with the same immunity window. |
| Stimpacks ×6 | 282, 1, 260, 11, 25, 147 | Medikits ×3 in the refuge |

### Prison sites

| # | Site | Location | Why it suits a cell | Physical affordances | Original mechanisms to reuse | Walk from refuge / cold start |
| --- | --- | --- | --- | --- | --- | --- |
| **P1** | **The loft 296** | (684, 1920), floor 112, top of a spiral stair | First rescue: a display loft above the showroom, reachable only by climbing | **Blue door 309** (916, 1744) between 285 and the stairwell (meg3n-proof). Spiral stairs 304→306→313→314→315 (sightline breaks). Long stair down to 260 (269–278, 305–312) as a second route, which MEG3N uses to reach the loft. Thin wall to hall 300 (16 units, breachable with a floor-92 step sector). | Door only; very readable | 951 / 410 |
| **P2** | **Paint vat 0** in room 1 | Room x 256..704, y 320..960; octagonal BLOOD3 vat (480, 608), 24 below the floor, 10 %/tic-class damage | A prisoner held in a red paint bath | Two entrances: lit doorway **283** (north, from long hall 282) and the wide west mouth to curving corridor 2/40. Fire-lit corner nooks **3** and **41** (raised 136). South fire niche **22–24** in a 64-thick wall to hall 19 (breach candidate). | Damaging floor; nooks as perches | 2,699 / 2,076 |
| **P3** | **Mould vat 279** in white room 7 | (1056, 897), white FLOOR0_6 room, raised nukage tank 279 | The clean room where doll bodies are cast. Strong visual contrast. | Doors **9** (896, 756) and **18** (1216, 756) to white chamber 4. Stairs 281 north. Gallery **5** sits 80 above chamber 4 and overlooks the approach. Switch alcove **6**. 32-thick wall to hall 260 at (1264, 1120): a new FIRE EXIT door, a one-way 152-u drop into hall 260. | Switch line **680** in alcove 6 (S1, tag 7) opens door 295 of secret closet 294 beside the refuge; the overlay also links it to tag 8, so door 293 opens too (otherwise 293 needs switch 1620 in far secret 72). 294 keeps its secret special on purpose (allowlisted reward closet). | 1,618 / 1,124 |
| **P4** | **Console pedestal 77** in room 78 | Pedestal (1760, −224) in console room 78 (COMPTALL/COMPWERD; CONS1 desk flats). Original floor 176 / ceiling 208 leaves 32 u of headroom, and room 78's ceiling is 176, so the top is a hidden slot. **Height edit: set 77's floor to 112** (64 above room 78's floor 48; 96 u headroom), so the prisoner stands on a 2 m plinth in view. | A prisoner held aloft on a test plinth in the control room, farthest from the refuge | Pedestal. **Console slots 86–89** (40–48 high): a one-way drop for humans from hall 79 into 78; two-way for meg3n. Annex 36 → switch room 35. | Switch line **710** in **35** (1440, −384; S1 floor-lower, tag 1) lowers the pedestal to 48. Red card on top. | 6,479 / 5,856 |
| **P5** | **Loading-yard alcove 148** | Lit alcove (3296, −384) on the roofed south porch 147 of sky yard 151 | Out in the open: the one site under the sky | Three lit alcoves 146/148/149 (two decoys/supplies). Open yard with crate-free pillars and two nukage vats 155/156. Entries: 162 (NW corner), **48-high slot 163** (one-way drop from 161), 164 (NE), door 154 from room 133. **New:** a 40-high crawl duct (new sectors behind the porch, south of y −448) from a grille in yard corner 150 to the back of alcove 148, about 450 u. | Switch line **1540** in yard corner 150 (3744, −352) opens door 154 **from the yard side only**. Blue card in 148. | 4,409 / 4,832 |

Total refuge→cell distance is 16.2 k, close to E1M4. P4 and P5 are the long trips, through the vats or the yard.

Order of discovery from a cold start: P1 (loft, through the blue door beside the showroom) → P3 (mould vat) → P2
(paint vat) → P4 (console pedestal) → P5 (yard). In hub mode the refuge is home from the start, so P3 and P1 are
the natural openers.

### Guardian space and sensors

- **Roam 1:** lab 219/108 → door 109–111 → hall 11 → step room 103 → console 225–227 → back to the lab.
- **Roam 2:** octagon showroom 174 → stockroom 195 → back down through 217/218 → curve 120.
- **Roam 3:** a spur down the coolant channel 10/12 to console room 78 (P4).
- **Doors 173/207** into the stockroom close themselves for 30 s when crossed (line 96, tag 11). The original special 16 is
  W1, so it fires once; **convert it to WR 76** so it works every time. That is a free moment of safety from her.
- **Dance tell.** Before a lunge meg3n stops and does ~0.8 s of dance (an animation-only state), the doll
  counterpart to the Terminator's laser wind-up. It reads well in E2M7's long straight halls 11, 260 and 282.

| Teddy cam | Position | Watches |
| --- | --- | --- |
| C1 | (1157, 1470) lower hall 264 | Refuge bulkhead approach |
| C2 | (576, 1396) long hall 282 | P2 north door |
| C3 | (487, 800) room 1 | Paint vat |
| C4 | (1185, 1300) diagonal hall 260 | Stairs to P1/P3 |
| C5 | (1754, 433) hall 11 | Gun, coolant channel |
| C6 | (2258, 950) lab | Charging docks |
| C7 | (2304, 1250) showroom 174 | Octagon showroom |
| C8 | (1085, −105) room 25 | Exit corridor, nukage bridge 31 |
| C9 | (3364, 100) yard 151 | P5 |

### Modifications to E2M7

- New: vestibule duct beyond line 1327, the refuge bulkhead and grate, and the cover and bolts on the refuge's
  north wall.
- Keep specials 680 (plus an overlay link to tag 8), 710, 1540, 1580 (doors 28/65), 1740 (nukage bridge 31), 945,
  1760/1762. **Convert line 96 from W1 16 to WR 76.** Disable exit line 1400.
- **Height edit:** sector 77 floor 176 → 112 (vertices untouched).
- **New sectors:** the FIRE EXIT door in the 7/260 wall; Cotra's crawl duct; a floor-92 step sector if the loft wall is
  breached.
- Sector 294 keeps special 9 as a deliberate, allowlisted secret.
- Keep the secret teleporter pair 55↔48 (lines 425/1436/1630) as a secret only. No escorts through teleporters.
- Retexture EXITSIGN in 56 (exit corridor) as on E1M7.

---

## 7. AGENTIC SMITH (Matrix-style) — E2M2 Containment Area, south half

![E2M2 plan](maps/E2M2-plan.png)

**Reading.** The south half of E2M2 is the pod farm. This file's working name was AG3NT (Jonathan's leet style of
Hal3000/meg3n); the final name is **AGENTIC SMITH** (06).
- **Pods:** three glowing FLAT22 troughs with COMPBLUE walls and catwalks (119/122/133).
- **Harvester line:** the crusher corridor along y ≈ −352 (crushers 2, 21, 23, 46, 48).
- **Test rigs:** the three octagonal perpetual-platform rigs (51–70).
- **Architect's hall:** the marble cross hall 84.

**Guardian rule (map-relevant).** AGENTIC SMITH does not need to walk the map. When an intact camera, a *jack*, reports
you, it **materialises at that camera** with a green-code dissolve (`SetOrigin` to the camera's spawn point) and
then hunts on foot with the existing hunter rules. Breaking jacks shrinks where it can appear. (Revision 2 cut
the two Sentinel drones: an invisible rule. The 9 jacks are the only sensors.)

**Footprint.** Seal the whole crate warehouse, containment pen and NE hall (everything north of y ≈ 2200 except
the cross hall 84 and stub 220) by locking doorways **243** (0, 2144) and **221** (1376, 2768). Diegetically, "the
Construct is offline". That leaves **6.0 k u²**, with three big loops in the lower half, and the cross hall is
AGENTIC SMITH's home. The crate warehouse stays available for a future level or a bonus.

### Front door, refuge, start

| | Location | Notes |
| --- | --- | --- |
| Front door | The original **EXIT room 9**: west wall at x −384, y −160..−32 (EXITDOOR/SW1EXIT textures) | Not DOOR3 here: the north DOOR3 is in the sealed half. The exit as the way out to the meadow reads naturally. The new vestibule duct goes west of x −384. |
| **Refuge** | Exit room **9** (x −384..−208, y −160..−32) plus the corridor through 10/11 to exit-sign nook 7 | **Bulkhead = existing door 11** (−200, −96). The level side reaches the refuge across nukage strip **1** via the bridge raised by switch line **1336** (in 12, at (−184, −256)). In hub mode the bridge starts raised. Compact like E1M4's refuge (whose slots span ~96×80). |
| **Cold-start bed** | Ward **5** (x −320..256, y −576..−192), behind red door 6 | "Waking from a pod" in a sealed ward. The bridge switch alcove 12 is next door. A 32-thick wall separates the ward from the refuge. |
| Guardian home | Cross hall **84** (1376, 2017), marble with four pillars | Also where the rigs' stop lines 907/1132 sit |

### Kit and items

| Item | Where | Notes |
| --- | --- | --- |
| Wrench | Ward 5 (60, −540); spare in refuge | Reused |
| Gun (3 rounds) | Cross hall 84 south (1376, 1800) | Reused |
| Charge | High hall 25 (634, 72) | Recommended breach: **room 25 → harvester bay 29** (28-thick wall at (808, −160)), which **bypasses the crushers**. Alternatives: booth 19 from nook 17 (8 thick at x 120) or from 16 (16 thick at x −48); secret room 26 from 25 (16 at (848, 8)). |
| Key cards | Yellow on island 81 (P4 prize), blue in east-wing room 107, red in 214 behind blue door 215 | Original positions; optional |
| **New tool 1 – EMP** | Lit room 32 (805, 527) | One use: disables jacks within ~20 m for 20 s and dims lights (reuse light specials) |
| **New tool 2 – Red-team pill** (06) | Bridge-switch alcove 12 (−184, −400), next to the cold-start ward | Makes SMITH's floating to-do list readable. The table also reads `THERE IS NO SPOON.` (the cut lockpick) |
| Stimpacks ×6 | 3, 16, 31, 34, 44, 57 | Medikits ×3 in the refuge |

### Prison sites

| # | Site | Location | Why it suits a cell | Physical affordances | Original mechanisms to reuse | Walk from refuge / cold start |
| --- | --- | --- | --- | --- | --- | --- |
| **P1** | **Booth 19** (the "hardline" booth) | x −48..120, y 584..752, inside room 16; doorway **20** on its south side | First rescue: a closed booth in the open hall, like a phone box | Narrow METAL-framed doorway 20 (add a cell door). **Thin walls**: 8 to nook 17 (east), 16 to room 16 (west). Lit slot niche 18 nearby. Nukage moat 15 along the west edge. **New:** a telephone exchange in hall 31 (under jack C2, about 34 m from the booth across room 16) for the hardline rescue. | Lock plus breachable walls | 1,900 / 1,984 |
| **P2** | **Centre tank 119** | (352, 1344): glowing FLAT22 trough (damaging, special 4) between catwalks 120/121; side tanks 122/133 | The pod row: a body in the middle pod | Catwalks 120/121/123/130/134/135 (16 above the liquid). Crosswalks 124/136. Lit corridor **138** north with door 139. Secret door **127**, opened by walking around pad 125, to secret passage 126/128/129 → west room 132/131. | Walk-trigger lines 578–581 (W1 door, tag 1044); line 897 (special 16, door 129) | 2,871 / 2,955 |
| **P3** | **Harvester bay 29** | (862, −186), lit; door **30**. Twin bay **37** (1212, 56), door 38 | Reached only through **dark secret room 26** (clear its special 9), which is entered only through **crusher 23** | **Five crushers** (tag 16). The corridor starts them (WR lines 1606–1609 and 728). **Stop** lines (WR special 74): 1518 in room 3 (204, 172), 1307 at the moat (−128, 192), 687 in the east wing (2432, 704). Lit **pressure pad 27** (928, 32) inside 26. | Pad line **1363** (W1, tag 3) opens bays 30/38; lines **730–733** light room 26 (W1, light 255, tag 42). Start lines 1606–1609 (one per corridor sector 22/24/47/50) and 728 are **WR 73**, so they restart the crushers whenever crossed; stop line 1518 is in room 3. **Release interlock:** freeing the prisoner runs `Ceiling_CrushStop` on tag 16 and clears the specials on 1606–1609 and 728, so followers can path out. | 1,967 / 1,673 |
| **P4** | **Island 81** in the red pool | Lit island (1760, 1504), floor 72, in BLOOD3 pool 71 (damaging); entry from 77 (1760, 1056) | A prisoner marooned on a lit island | **Stepping stones** 79/72/73/75/76 (floor 40, special 16) rise +24 to 64 with a texture-and-type change; island 81 is floor 72 and borders only stone 76. Natively each rises when you walk across lines 722, 717, 716, 713, 1563 (W1 special 59; tags 14/15/17/19/21). **Clear those five specials** and raise the stones by script (the NOW SERVING counter, SMITH's lanyard, a one-off lifeguard raise of 76 for waders). Secret corridor 60 (x 1920..2272) touches only 53 and 82, never the island, and the pool's east wall is one-sided, so **add a staff stair**: a door from corridor 82 and four new step sectors (16 deep; floors 6, 28, 50, 72, so 22-u steps up from 82's −16; ceilings rising from 96 to 128) through the solid gap at x 1792..1856, y 1504..1536 (32 wide: it overlaps both 82 and the island), to the island's east side. Confirm the gap is void in the overlay. Clear 60's special 9. Yellow card on the island. | Native rising stones, re-triggered by script | 3,088 / 3,172 |
| **P5** | **Test rig 52** | North octagon rig (2093, 471), floor 80, surrounded by perpetual platforms 51/54/55/56. Rigs 61–65 and 66–70 below are decoys/cover. | A prisoner on top of a moving machine | **Perpetual platforms** (tag 23). Start lines (WR special 87): 1515 (1696, 8), 1537/1538 (1476, 800). Stop lines (WR special 89): 1511/1514 (1424, 700–900), 1549 (1504, 8), 907/1132 (cross hall). Rig 53 drops into secret corridor 60. | Stop the rigs or ride them; native specials | 2,693 / 2,777 |

Total refuge→cell distance is 12.5 k, tighter than E1M4. That suits a guardian that can appear at any jack.

Order of discovery from a cold start: the nearest sites are P3 (1.7 k, but behind the crushers) and P1 (2.0 k), so
the booth P1 is the gentle first rescue. Then P5 (rigs), P2 (tanks) and P4 (island). All five are within 3.2 k of the
refuge, so the order is the player's choice, as LEVEL-01 asks.

### Guardian space and sensors

- **Loops:** the lower-hall loop 31→43→41→34→25→3, the east-wing loop 57→58→113→208, and the cross hall 84 with
  its two pillar pairs. The longest lower loop is ≈ 24.7 k units around (1409, 910).

| Jack | Position | Watches |
| --- | --- | --- |
| C1 | (216, 128) room 3 | Crusher stop line, refuge side |
| C2 | (1028, 955) hall 31 | Centre hub |
| C3 | (160, 1184) crosswalk 124 | Tanks |
| C4 | (576, 1816) corridor 138 | Secret door 127 |
| C5 | (1376, 1880) cross hall 84 | Gun, stairs 92–98 |
| C6 | (1760, 1000) waiting room 77 (moved from hall 41) | The queue and the stepping stones |
| C7 | (1281, 272) hall 34 | Secret room 26 approach |
| C8 | (2140, −298) corridor end 49 | Crushers, east |
| C9 | (2430, 304) east hall 57 | East wing |

### Modifications to E2M2

- New: vestibule duct west of room 9 (front door). Refuge cover and bolts on 9's west wall.
- **Stepping stones:** clear the W1 specials on 722, 717, 716, 713, 1563; script the raises. **New sectors:** the staff
  stair from corridor 82 to island 81.
- **Crushers:** Kokotajlo's release interlock (`Ceiling_CrushStop` tag 16; clear 1606–1609 and 728).
- **Clear sector special 9 on 26 (the only route to bay 29) and 60 (the staff route).**
- Lock doorways 243 and 221. A blocking line inside the yellow doors is not needed because the north is
  unreachable.
- Make bridge line 1336 pre-raised in hub mode, and repeatable or pre-raised in cold start so it cannot be missed.
- Keep crushers, rigs, pad, stairs 638, lift 45 (lines 738/934, tag 7), and door 103 (lines 24/29).
- Remove the original exit action (line 1297) from room 9.
- **Crusher safety:** keep the original slow crush. The **companion navigation must never path through a running
  crusher**; treat crusher sectors as closed while active.

---

## 8. Variety across all 20 prison sites

How the rescue designer can avoid repetition. ● = the site has this physical affordance. E1M4 is listed from
README/LEVEL-01.

| Site | Lift / raised | Remote switch | Key / override door | Crawl slot / vent | Window | Hazard floor | Moving machine | Decoys (pick one) | Open sky | Thin wall (breach) |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| E1M4 Liron (camera cell) | | | | ● | | | | | | |
| E1M4 Russell (turret) | | ● | | | | | ● | | | |
| E1M4 Eliezer (maintenance) | | ● | ● | | | | | | | |
| E1M4 Hinton (bulkhead) | | | | ● | | | | | | ● |
| E1M4 Holly (interlock) | | ● | | | | | | | | |
| E1M7 P1 closet 64 | | ● | | | | | | | | |
| E1M7 P2 server farm | ● | ● | ● | ● | | ● | | | | |
| E1M7 P3 pedestal | ● | ● | | ● | | ● | | | | |
| E1M7 P4 pod bay | | ● | | | ● | | | | ● | ● |
| E1M7 P5 corridor 94 | | ● | ● | | | | | | ● | |
| E2M7 P1 loft | ● | | ● | | | | | | | ● |
| E2M7 P2 paint vat | | | | | | ● | | | | ● |
| E2M7 P3 mould vat | | ● | | | ● | ● | | | | ● |
| E2M7 P4 pedestal | ● | ● | | ● | | | | | | |
| E2M7 P5 yard alcove | | ● | | ● | | ● | | ● | ● | |
| E2M2 P1 booth | | | | | | | | | | ● |
| E2M2 P2 tank | | ● | | | | ● | | ● | | |
| E2M2 P3 harvester bay | | ● | | | | | ● | ● | | ● |
| E2M2 P4 island | | | | | | ● | ● | | | |
| E2M2 P5 test rig | ● | ● | | | | | ● | ● | | ● |

Each level's guardian also changes what the same affordance means:
- **Hal3000:** a lift is not safety (the eye floats); doors may be locked against you.
- **meg3n:** a door is safety; a vent is danger.
- **AGENTIC SMITH:** distance is not safety; a working camera is a doorway for it.

This is how 20 rescues stay different even where an affordance repeats ("some repetition is probably ok").

## 9. Notes for the existing E1M4 level (cross-reference for ask 1)

- E1M4 also has a DOOR3 wall behind its start: line 745 (x 2120, y 1120..1184), facing east. For hub-mode
  entry into Five Prisons (when it is not the first level), either:
  - (a) enter through the existing escape duct in reverse into the refuge (consistent with §4: the door in the
    meadow is the duct), or
  - (b) open the east DOOR3 into the start hall, if the hub designer wants that structure's door on its east face.

  Recommend (a).
- Measured the same way as the new levels, E1M4 is 6.45 k u² with 8 loops (4 big, longest 12,244 around the
  central ring) and 11 dead-end rooms. Its refuge→cell total is 16.8 k. The three new levels are sized against it.

## 10. Implementation notes and risks

- **Conversion.**
  - `scripts/build_checkpoint_map.py::read_map(path, name='E1M4')` already takes a map name. Reuse its UDMF
    conversion and overlay pattern (`campaign_overlay.py` SITES/LANDMARKS/CAMERAS) with per-map site tables.
  - Never reuse E1M4 sector IDs (LEVELS.md). Each level needs its own descriptor in `doom-web/levels.js`:
    `peopleTotal` 6 (five figures plus the CEO), `camerasTotal` 9, `scoreVersion: 'rescue-v2'`, `boardVersion: 'v2'`,
    new board keys.
  - The overlay asserts that no site, cell or required route sector keeps special 9 (allowlist: E2M7 294).
  - Enable each map in the `PlatformPanel.zs` pause bridge.
- **Navigation.** Build a fresh sampled navigation graph per map. E2M7 (323 sectors) is the most work.
  - Hal3000 needs a separate flying graph that ignores floor height, so it can cross nukage and ledges.
  - meg3n needs a small-body graph that includes the 40–48-high slots (two-way climb links) and excludes doors.
  - AGENTIC SMITH uses the standard hunter graph plus the teleport-to-jack rule.
- **Engine.** Everything above is classic geometry plus ZScript actors. The guardian flags are standard actor
  properties:
  - Hal3000: `+FLOAT +NOGRAVITY`.
  - meg3n: no `CANUSEWALLS`, small radius.
  - AGENTIC SMITH: `SetOrigin`.

  No 3D floors, portals or polyobjects are required.
- **Crushers and moving platforms (E2M2).** These are the riskiest native systems for escorts. Gate companion
  movement on platform and crusher state, and test with the real follower collision.
- **Crouch slots.** E1M7's lagoon slots and pod-bay windows are 32 high; E1M4's ducts are 40. Verify that a crouched
  companion (28 u) fits before promising those routes to humans; the hazmat suit depends on it.
- **Production risks for any public release (flag only).**
  - The maps are id Software data. Ship as a PWAD/UDMF patch that requires the player's own DOOM.WAD; never
    bundle the IWAD or these plan PNGs.
  - The guardians parody films (HAL/2001, M3GAN, The Matrix): keep parodic names and original designs, no film
    stills, logos or exact quotes.
  - The cast are real public figures: right-of-publicity and parody review before release.

## 11. Self-review against Jonathan's asks

- **Ask (2), the spec for the rest of the game.**
  - *Picking other original Doom levels to mod:* §2–§3 (all 27 measured and rendered; picks plus runner-ups).
  - *Where we start:* front door, cold-start bed and hub entry per level.
  - *What items we get:* kit tables, with ≤ 2 new tools per level.
  - *Where the prisoners are held:* five sites per level with coordinates, sectors and affordances.
  - *At least two non-repetitive ways out per prisoner:* every site lists ≥ 2 physical routes or mechanisms
    (door plus remote, slot, breach, override, machine), and §8 shows the spread. The rescue designer assigns
    people and final solutions.
- **"Hal3000 is floating around one":** the floating eye drives the E1M7 plan (lifts are not safe; lagoons are its
  shortcuts).
- **meg3n:** door-blind doll in a door-rich tree map (E2M7).
- **"Something from the Matrix":** pods, harvester and camera-jumping AGENTIC SMITH (E2M2 south).
- **"Each of these areas exist in the Windows 95 world as structures that we can go in and out of":** §4 gives
  every level one meadow door (coordinates, facing, extent) for the hub layout, and both start modes so any level
  can be first.
- **Ask (4), hub layout:** this file supplies door positions, facings and façade cues only. Placement and routes in
  the meadow belong to the hub spec.
- **"Some repetition is probably ok? unless you can think of 20 entirely different ideas":** §8 (20 sites,
  10 affordance types, three guardian twists).
