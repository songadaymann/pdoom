# SAFE MODE progression: the hub after each level

Status, 2026-10-23: **built** in branch `claude/safe-mode-progression-7a6f55` (from `level-4-agentic-smith`), not committed. Jonathan picked the recommended building designs ("i like your picks! this looks amazing!") and added the digital detritus.

Jonathan's asks:

> "look at windows xp land... the buildings could look better (they still need to be contrasted with the beautiful setting, but overall they can be a bit more interesting). Things change between 1 and 2 in the space; now we need things to change between 2 and 3 and then also 3 and 4, and then plans for changing between 4 and the end game."
>
> "the people we save should be moving around a bit more. When we arrive out after 2, the people from 1 should not just be still right outside their level - maybe more spread out but generally up on top of the hill? Same between 2 and 3 etc."
>
> "over the course of defeating each thing, we start to see tron lines appear and things get cracked. By the time we've done 4, things are really crazy and we can feel the urgency to go to that final tall building."
>
> "we have those windows icon to kick around, maybe the world just gets more and more full of digital detritus too. maybe classic MAC (and NEXT?) icons, nintendo, gameboy, etc - nostalgia and digital overload of just things to kick around"

Agreed with the endgame lane (session `endgame-tron-finale`, `docs/ENDGAME.md` in its worktree):
- **The final tall building is the MCP column** on the south horizon at (60, 1000).
- After level 4 the endgame walks everyone south off the hill, through a gate at z 180 (x 20..160), and down a Grid corridor to the column's door.
- The hub owns the hill and the column as scenery. The endgame lane owns everything past z 180.
- Both lanes share one Tron palette: lines `#38f4ff`, core `#d8fdff`, floor `#02060a`. The MCP's own red-orange `#ff3b1f` appears only on the column.
- Both use the same Grid: 4 m minor and 16 m major lines on world x/z = 0.
- `MCP` and `MCP_TOP` are exported from `doom-hub-future.ts` for that lane.

Images are in `docs/img/safe-mode-progression/`. They are gitignored, like every PNG and JPG in this repo. Section 8 says how to regenerate them. In every 2 × 2 sheet the four panels are: top left after 1, top right after 2, bottom left after 3, bottom right after 4.

![Looking south toward the MCP column, by stage](img/safe-mode-progression/built-23-south-meadow.jpg)

---

## 1. What each stage changed before this work

I booted the meadow from seeded saves after levels 1, 2, 3 and 4 and shot the same views in each. **Apart from the people standing at the doors, the hub looked the same at every stage.**
- People never left their own door; they only swayed on the spot.
- Only a few small things changed: the MCP face resolution, the status strips, the READMEs, the Wait count, and the walking speed boost after two levels.
- None of GAME-SPEC §6.4's stage changes or cleared-building jokes had been built.

![Before: bunker exit](img/safe-mode-progression/today-01-bunker-exit.jpg)

Found and fixed along the way:
- After a **Load Game**, the hub HUD read `FRESH AIR · 0/1 OUTSIDE · WAITING FOR THE OTHERS · CAMERAS 0/9`. That was the last level's escape line, left over from before the load. When nobody came out with you on this visit, it now reads `n still out there` and the camera tally is hidden.

## 2. The arc

The wallpaper is lying on top of the Grid. Each structure you clear lets more of the Grid show through:
- Tron circuit traces leak out of the cleared building and run south to the gate where the endgame walk starts.
- The hill cracks like a struck screen.
- The sky cracks open from the south, with the impact point right behind the MCP column, so every crack line leads your eye to the final building.
- The desktop fills up with junk.

After 4 everything is falling apart and everything points south. After 1 stays exactly the approved look: no corruption and no extra junk until a second level is cleared.

## 3. Per stage (as built)

The traces come from each structure's own door, so any clearing order shows correctly. Overall intensity counts levels cleared. Changes ease in over a few seconds when you walk out of a level, and new junk drops out of the sky around you. On a load, everything is already in place.

| | After 1 | After 2 | After 3 | After 4 |
| --- | --- | --- | --- | --- |
| **Sky** | Approved look | Unchanged | Hairline cracks start in the south sky, centred behind the MCP column | Cracks reach overhead. Shards fall out, showing black with the Grid behind. Light drains to a cold dusk. Red-orange glow on the south horizon. |
| **Hill** | Untouched | One glowing hairline per cleared building. Short cracks round the summit dialog. | Full 5-lane buses from each cleared building, and pins round its walls like a chip's. Cracks run down the hill and up from the south. First loose tiles flicker; a few drop out toward the south. | Bright buses pulse toward the gate. Many 4 m wallpaper tiles are missing, so the Grid floor shows (more toward the south). Pixels lift off and drift south. |
| **Buildings** | Redesigned (§4). CONTROL.EXE is cleared. | Cleared buildings' edges rez up in faint cyan. HAL's eye becomes the mouse ball. | Brighter outlines. MEG3N paused on the sleep moon. | Full Tron outlines. AGENTIC: rain stops, green check, the agents are gone. Summit hourglass becomes an arrow pointing south. |
| **MCP column** | Grey ghost in haze | Same | Haze lifts a little, faint red-orange edges | Haze mostly gone, edges burning and pulsing |
| **Junk to kick** | The 9 desktop icons | 45 pieces: old computers and disks | 80: games and gadgets | 142: error pop-ups, copies of copies, giants |
| **People** | At the bunker door, wandering | L1 on the hilltop, L2 at HAL's door | L1–2 on the hilltop, L3 at its door | L1–3 on the hilltop, L4 at its door |

![Bunker exit by stage](img/safe-mode-progression/built-01-bunker-exit.jpg)
![Looking back south by stage](img/safe-mode-progression/built-02-look-back-south.jpg)
![AGENTIC.BAT by stage](img/safe-mode-progression/built-09-agentic.jpg)
![From high above, by stage](img/safe-mode-progression/built-12-aerial.jpg)

---

## 4. Buildings (Jonathan's picks, built)

The rule stays: wallpaper is nature, and anything from the desktop is a prop. Each building is a desktop file come to life, deliberately at odds with Bliss. Everything is added to the existing Doom-walled buildings; their walls, doors, status strips and READMEs are untouched (`src/doom-hub-dressing.ts`).

| Building | Built | Cleared |
| --- | --- | --- |
| **CONTROL.EXE** | The program window: a navy title bar crowns the bunker, with a menu bar, status bars and bevelled corner posts. The watchtower: a camera mast with a red beacon, CCTV on every roof corner turning to follow you, a 3 × 3 monitor wall of its cameras, and a red scanner sweeping a slit window. | `CONTROL.EXE (Not Responding)` greyed, a hung cursor over it, beacon dark, monitors `NO SIGNAL`, scanner stopped |
| **HAL3000.SYS** | The system file: a 21 m dog-eared page with a gear (`device=hal3000.sys … eye=always_on`) and a real gear turning in front of it | The page reads `eye=off` and the gear stops. The eye greys, sinks over 20 s, and rests in the valley at (30, −185) as a giant rubber **mouse ball you can shove**: walk into it and it rolls ahead of you until the hall or the valley edge stops it. |
| **MEG3N.AVI** | A 22 m Media Player window on the facade playing her live feed. Hearts float up, and the "watching" counter climbs as you approach. A filmstrip frieze runs along the top. | Paused on the sleep moon, `0 watching`, ❚❚ down, filmstrip stopped. Her selfie-stick phone shows the moon too, the badge reads 0, and the ring light dims. |
| **AGENTIC.BAT** | A line of identical suited agents in sunglasses along the parapet | The rain stops and the glass reflects the sky. The spinner becomes a green check. The agents are gone. |
| **Summit dialog** | Unchanged until 20/20 | At 20/20 the hourglass becomes the arrow cursor, faces you, and points back down the hill toward the column |

![Buildings, by stage](img/safe-mode-progression/built-13-control-front.jpg)
![HAL3000.SYS and the mouse ball](img/safe-mode-progression/built-19-hal-ball.jpg)
![MEG3N.AVI](img/safe-mode-progression/built-16-meg-front.jpg)

The mock-ups and options Jonathan chose from are kept in `mock-*.jpg`.

## 5. Digital detritus

The world fills up with things to kick (`src/doom-desktop-detritus.ts`): 30 new pieces of our own 32 × 32 pixel art. They are generic objects in the spirit of the classic Mac, NeXT and Nintendo era, with **no company's logo, name or icon**, so the repo can stay public. They land in waves:

- **After 2: old computers and disks.** A beige all-in-one (`Hard Disk`), a metal trash can, a bomb (`System Error`), a black cube workstation, a rainbow pinwheel (`Not Responding`), `New Folder (17)`, a 5¼" floppy (`DISK 2 OF 14`), a 56K modem, a mouse, a free-hours CD.
- **After 3: games and gadgets.** A grey handheld with a green screen (`Low Battery`), a cartridge (`BLOW ON IT`), a gamepad (`Player 2`), a joystick, a rabbit-ear CRT (`Channel 3`), a mixtape, a virtual pet (`Pet (hungry)`), a flip phone (`37 Missed Calls`), a pager, an arcade token.
- **After 4: overload.** An error dialog, a `YOU WON!` pop-up, a 99% progress bar, an hourglass, a 404 page, a sticky note, a smiley, a pixel heart (`Like`), a notification bell (`99+`), giant copies (a 4 m CRT, a 3.6 m handheld), and copies of copies (`New Folder (19)`, `Copy of TODO.txt`).

Each wave has named pieces placed by hand, plus seeded **piles** of copies where you walk: the bunker exit, the camp, the roads, HAL's valley and the south meadow toward the gate. The total goes from 9 to 45, 80 and then 142 toys. The piles' labels only show up close. When you walk out of a level, the new wave drops out of the sky and bounces. A few play something when kicked: Winamp's riff (as before), the all-in-one's startup chord, the handheld's chime, the bell's ding. These are generic notes, not the products' real sounds.

Kicking, physics, pressed grass and sleep all work as for the original nine. The grass under the nine toys nearest you is pressed down. Phones (coarse pointer) get the named pieces but none of the piles. In my headless desktop Chrome checks, every stage held the 60 fps cap. I haven't measured on a phone.

![A junk pile by the bunker, by stage](img/safe-mode-progression/built-22-pile.jpg)

---

## 6. People: on the hill and moving

![Where the rescued stand, and where the junk lands](img/safe-mode-progression/people-map.png)

The existing camp and door data stays in `src/doom-camp-layout.ts`, which adds `HILL_ZONES`:

1. **After 1:** level 1's five stand outside the bunker, as before, but now they wander.
2. **The newest group** stays near its exit: the level you just walked out of, or on a load the latest group cleared. They come out one by one as before, walk to their door spot, then wander within 2.5 m of it. Nobody stops within 5 m of a door or in front of one.
3. **Every earlier group lives on the hilltop**, one 9 m zone per group on the dome's sunny south faces (L1 south-east, L2 south, L3 south-west, L4 north-east). There you see them as figures up on the hill from the bunker exit and the camp. The zones stay clear of the dialog's front, the Crest Trail and its spur, and HAL's torch trail. When a group stops being the newest, it moves up the hill. If you are more than 45 m away it just appears there; if you are closer, the group walks up.
4. **Wandering:** each person rests 3–9 s (today's idle sway, turning to look around), then strolls to another free spot at about 1 m/s with the walk frames. They pick spots at least 1.4 m from everyone else's. A wanderer never walks into you: they wait until you step aside. People coming out of a door walk past you as before. Pause freezes them; reduced motion keeps them on their spots.

![The rescued on the hilltop from the bunker exit, after 4](img/safe-mode-progression/built-after-4-people-from-bunker.jpg)

---

## 7. Between 4 and the endgame

The hub's part, after 4:
- Everything in §3's last column.
- The summit arrow points south.
- Every bus pulses toward the gate, landing on the Grid's major lines (x 48, 64, 80, 112 at z 180) so the endgame corridor can continue them.
- The sky's struck-screen impact sits behind the column, which burns red-orange.

![After 4, looking south](img/safe-mode-progression/built-after-4-south.jpg)

The endgame lane's part: the guide's congratulations, handing out the discs, the walk south through the gate, Recognizers, the followers' march, and the arena behind the column's door.

Built 2026-10-28 ([ENDGAME.md, In the game](ENDGAME.md#in-the-game)): with all 20 resolved, `outside.startEndgame()` runs the guide's meeting at the door. The hill groups fall in behind you in single file, and the gate opens at (80, 180). After the endgame, `outside.endgameDone()` takes the column off the horizon.

## 8. Previewing and testing

- **Preview a stage:** `?safemode=1&after=N` (N 1–5). It works only on loopback with dev-config on, like the existing `?safemode=1` fixture, and plays from an in-memory save so a real save is untouched. You come out of the door you'd leave level N by: the bunker's, HAL's, MEG3N.AVI's, AGENTIC.BAT's. After 4 the guide meets you there and the endgame begins (docs/ENDGAME.md, "In the game"). 5 is the meadow after the boss, out of the bunker's door.
- **Smoke:** `PDOOM_ORIGIN=http://127.0.0.1:5218 node scripts/safe-mode-stages-smoke.mjs`. It is muted and boots each stage through the flag. It checks:
  - the newest group is near its exit and clear of the door, every earlier group is in its hilltop zone, and people wander;
  - the corruption stage, the toy count, every cleared building's state and the column's glow;
  - the hub HUD after a load;
  - that there are no page or console errors.

  Screenshots go to `output/safe-mode-stages/`.
- **Updated smokes:** the new behaviour changed three existing ones. `meadow-camp-load-smoke.mjs` now expects level 1's five on the hill after a two-level load, and takes `PDOOM_ORIGIN`. `hub-future-smoke.mjs` expects 45 toys after two levels. `icon-physics-browser-smoke.mjs` checks distinct weights for the original nine.
- **Passed on port 5218:** the stage smoke, those three, `safemode-flag`, `meadow-travel`, `phone-audio`, and a port-patched `factory-hub` (walking in and out of MEG3N, including its arrivals).
- **Screenshot tour:** `output/safe-mode-tour/tour.mjs` (gitignored scratch) writes the per-stage stills used here.

Files:
- New: `src/doom-hub-traces.ts` (palette, trace and crack masks, GLSL), `src/doom-hub-corruption.ts` (staging, building outlines, pixels), `src/doom-hub-dressing.ts` (the building designs), `src/doom-desktop-detritus.ts`, `scripts/safe-mode-stages-smoke.mjs`.
- Changed: the meadow shaders (`doom-meadow-shared/terrain/grass/sky.ts`); `doom-hub-doors.ts` (HAL's mouse ball); `doom-hub-future.ts` (MCP export, column edges, MEG3N and AGENTIC cleared states, the summit arrow); `doom-desktop-icons.ts`, `doom-icon-toy.ts` and `doom-icon-physics.ts` (staged toys, scale); `doom-camp-layout.ts` (hill zones); `doom-outside.ts` (wiring, people, HUD); `doom-web/main.js` (the `after` flag).

## 9. Open questions for Jonathan

1. **CONTROL.EXE's live watchtower is never seen in normal play.** The bunker is always cleared by the time the hub shows its dressing, and the wake-up walk hides all the new scenery to keep the approved intro untouched. Should the watchtower (beacon pulsing, cameras turning to follow you) show during the wake-up walk toward the bunker?
2. **Phones:** they skip the junk piles (about 90 toys) for performance. Is that OK, or should I measure on a real phone first?
