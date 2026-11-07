# The endgame: from the Level 4 exit to the credits

**Draft, 2026-10-23.** Written from Jonathan's brief of the same day (below) against the finale spec ([GAME-SPEC §8](GAME-SPEC.md#8-the-finale), [05](spec/05-maze-and-mcp-finale.md), [06 §7–8](spec/06-names-and-antagonists.md)). Since 2026-10-28 it's hooked into the game (see [In the game](#in-the-game) below); the fight itself is still the Three.js page in [`prototypes/endgame/`](../prototypes/endgame/) (how to run it is at the end). Every line is a draft for Jonathan to edit and record. He records the audio himself; no voice is generated or cloned. The MCP is a pixel-mosaic caricature of Elon Musk, never a photo.

> Jonathan, 2026-10-23: "we come out of 4, dario/sam comes and says amazing you saved all the people … ok but the big boss man is pissed … by the time we've done 4, things are really crazy and we can feel the urgency to go to that final tall building. We take that walk the whole way. Maybe it's dario/sam that gives us the discs, and maybe on the walk over we practice doing it with some other tron related enemies … maybe dario vs sam reappears and there's a 'real last stand' … I want it to really look like that end game of Tron. It may feel more like tennis or something."

## In the game

Built 2026-10-28 on `claude/endgame-hookup` (the hub-progression and endgame branches merged), from Jonathan's picks that day:
- **Trigger:** all 20 resolved, at whichever door that happens. Since 2026-11-07 nobody can be lost, so that means all 20 freed and `end-saved-some` never plays. The speedrun's clock stops when the MCP goes down ([SCORING.md](SCORING.md)). Normally that's the level 4 exit.
- **Survivors:** only the people you saved come with you.
- **The door scene:** in the meadow.
- **The rest:** one page.
- **After the black:** back to the meadow.

What happens:
- **E0-E3, in the meadow** (`src/doom-outside.ts`, `src/doom-bliss-guide.ts`):
  - Arriving in SAFE MODE with all 20 resolved, the guide waits 18 m ahead of the door you came out of and calls you over (`end-call`).
  - Then he says `end-saved` (`end-saved-some` if anyone was lost), `end-boss`, `end-why`, and `end-discs` with the floppy flying into your hands (`YOU GOT A FLOPPY DISK! 1.44 MEGABYTES OF PAYBACK.`).
  - At `end-everyone` everyone in camp falls in behind you in single file.
  - At `end-go` a cyan frame opens in the meadow's south edge at (80, 180), where the hub's traces land.
  - He leads you there and says `end-edge`. Space skips him, as it skips the wake-up walk.
  - Voiced since 2026-10-28 from the boss-fight batch (`python3 scripts/import-guide-voices.py --endgame art/endgame-2026-10-26` writes `guide-<mario|samwise>-end-<key>.mp3` and lists them in `guide-voices.json`). The floppy lands on "Take" in `end-discs` (its `handoff`, timed with Whisper).
- **The handoff:** walking through the gate fades to black and opens `endgame-proto/play.html?m=finale`.
  - That page reads the save (`pdoom.campaign.v1`, same origin) for your hero and who's alive.
  - The save's new `endgame` field records progress: 1 once the guide has met you, 2 when it's over.
- **E4-E5, the walk in** (`prototypes/endgame/mode-boss.ts`, `?m=finale`):
  - You start 450 m north of the arena on the Grid, with the guide at your shoulder and everyone in file behind.
  - P1 is one Recognizer that drops on a shadow (`end-recognizer`, `end-hit`).
  - P2 is one that keeps its distance, to practise long throws (`end-keep`, then `end-sky`). It never shoots: Jonathan, 2026-10-30, "the ships don't do tennis. and i don't think they should." `end-keep` replaced `end-rule` (whose takes taught hitting shots back), so the old takes can't play; until it's recorded it's a subtitle. Part 1's `end-ships` now introduces the swing on its own.
  - **The sky glitches** for `end-sky` (`prototypes/endgame/skyglitch.ts`, 2026-11-06). Jonathan: "i never see anything happening in the sky at that point"; the line had been written for a glitch that was never built.
    - For 6 s the void breaks up. Blocky patches of the meadow's Bliss sky flicker through the black, rows of it tear sideways, and the Grid's lines slip and flash (the floor shader's `uGlitch`).
    - Elon's smug pixel face (the face sheet's first cell) comes up huge over the data center. It downloads in steps, 6 then 12, 24 and 48 cells wide, holds whole for about 2 s, then breaks up.
    - It starts 0.9 s before the guide's line, so the line is a reaction. A stutter of corrupted bits plays at each surge (`kit.ts` glitch).
    - Drawn in code, no new art. `end-hum` now waits for the line itself (`walk-sky-line`).
  - P3 is a squadron of three (`end-fault`).
  - P4 is two Cybertrucks (`prototypes/endgame/cybertruck.ts`, 2026-11-06; Jonathan: "we fight the first ship and then after that we fight a few more but also the cyber trucks"). They were the fight's part 2 filler; they're on the walk instead.
    - Once the guide has said `end-fault`, Elon says `mcp-truck` ("THE CYBERTRUCK. ARMOR GLASS. COMPLETELY UNBREAKABLE.") and two trucks come up the edges of the walk from behind you, whether or not the squadron is down. They overtake and skid round to face across.
    - Each revs for 2 s at the end of a red lane (chevrons pointing its way) drawn from where it stands through where you stand, then charges down it at 28 m/s. It stops at the far end, turns, and does it again. The lanes stay on the Grid: |x| 22.5 at most, inside the turbine rows, and north of the wall.
    - Whoever is in a lane steps out after their reaction time; a slow one is knocked down. It costs you 30, and you can't go down on the walk.
    - A disc cracks a pane of its glass (the side windows, then the windshield). The first crack is Elon's `mcp-truck-crack` ("...ROOM FOR IMPROVEMENT."). Three wreck a truck: it derezzes.
    - The first lane gets the guide's `end-truck` shout and a prisoner's "Truck! Move!"; after the first charge, Yoshua's own line (`yoshua-fight`). All were voiced in the 2026-10-27 batch. Grok stays out of the walk: he first speaks in the fight.
    - The truck is drawn in code: a wedge in Elon's red-orange lines with dark glass, a white light bar across the front and a red one across the tailgate. Its sounds are synthesized (`kit.ts` rev, launch, screech) plus a ship's engine.
    - `mcp-walk` and the door wait for both trucks.
  - Elon's walk lines are captions across the sky (`mcp-resolve`, `mcp-recognize`, `mcp-walk`).
  - All of the walk's lines are voiced since 2026-10-28 (`node scripts/import-endgame-assets.mjs <batch>`), about 45 s of them. They queue one at a time; each beat waits for the last one's lines, and the door for all of them, so nothing is dropped or said late. The walk grew from 290 m to 420 m to fit them, and to 450 m (2026-10-30) for `end-hum`.
  - A stomp hurts but nobody dies out here.
  - **The tower is a data center** (`prototypes/endgame/datacenter.ts`, 2026-10-30; Jonathan: "The elon tron building should be a data center!!! ... the sound is sort of already there and we should make a joke about the sound as we hear it"). It's still "the tower" everywhere else; the sign is the reveal.
    - Over the door, his sign: `COLOSSUS X` / `THE WORLD'S BIGGEST DATA CENTER`, in his red-orange on two struts, high enough that the face still shows over the wall. Under it a Community Note in our cyan: `READERS ADDED CONTEXT: HE MEASURED IT HIMSELF.` Over the door, `GPUS ONLINE: 1,048,576 AND COUNTING`, which only goes up. All DoomSmall with hard drop shadows.
    - Ten gas turbines line the approach (|x| 26-29, z 54-102), each stencilled `TEMPORARY`, with heat off its stack and a roar from each row.
    - The hum swells as you near the wall (about a third far out, three-quarters at the closed door) and pours out when the door opens. In the gap after `end-sky`, the guide names it (`end-hum`); a subtitle until it's recorded. No Elon retort, so the walk keeps its slack at the door.
    - The sign, struts and turbines hide once you're inside. Inside, the pillars are server racks with blinking white and green lights (dimmed for the trick shot, so its cyan marks read) and a fan on top; in the meltdown the fans and lights die with the sound.
    - The Grid floor is now 1200 m across, so the walk starts on it.
  - Near the wall, a door in it opens once the Recognizers are down (`end-tower`).
  - Inside, everyone takes their places and THE BOSS's intro begins. N skips the walk.
- **E6-E9:** THE BOSS as before.
- **After the black:** the save is marked done, and a click returns through the game's own handoff (`?play=1&load=1`) to the meadow.
  - There the column is gone and the summit stops pointing south. The dialog reads "Screen saver: none. Nothing left to wait for."
- **Credits (E10):** not built. Jonathan chose the meadow after the black.
- **To start right after level 4:** `?safemode=1&after=4` on loopback (dev-config on). You come out of AGENTIC.BAT's door with all 20 saved and the guide waiting.
  - It plays from an in-memory save, and so does the endgame page it leads to (`&safemode=1&saved=`, a mask per level), so a real save in the browser is left alone.
  - After the black it comes back to `?safemode=1&after=5`, the meadow after the boss with the column gone.
  - `&ceo=amodei` plays Dario (Sam guides you).
- **Smoke:** `scripts/endgame-hookup-smoke.mjs` covers all of this.
- **Not in the game's release build yet:** the page is built by `node scripts/build-endgame-protos.mjs` into ignored `doom-web/endgame-proto/`, and level 4 itself is still local-only.

## Where this differs from the spec

| | Spec (§8, 05) | Jonathan's idea | This draft |
| --- | --- | --- | --- |
| At 20/20 | The world goes idle, a CRT rises from the `SSMAZE.SCR` hatch on the summit, then camp night (60 s of thank-yous) and a slow procession up the Crest Trail | Out of level 4, the guide congratulates you, the boss is angry, it's urgent | The guide meets you at the door; no idle and no camp night (Q4) |
| The way in | Summit hatch → 3D Maze → BSOD → the Grid | Walk to "that final tall building" | Walk south, the whole way, to the MCP column on the horizon (`MCP` at (60, 1000) in `doom-hub-future.ts`, about 900 m from AGENTIC.BAT) (Q1) |
| 3D Maze and your AI-self | Two mazes (5–8 min), you plus 3 followers | Not mentioned | **Open (Q2).** Not dropped. |
| Discs | Appear in every hand during the arena intro | The guide gives them | The guide hands you yours at the door ("Take this", like the wrench); everyone gets one |
| Practice | None | Recognizers on the walk | Three short Recognizer encounters on the walk |
| The other founder | Absent; held inside the MCP as tenant or acquisition, tumbles out at the end | Reappears for a "real last stand" | Walks you there and fights beside you, unkillable, as in the prologue's Last Stand (Q5) |
| Disc model | Everyone throws when you throw, through a rotating shield gap | "maybe more like tennis", then (2026-10-23) "ALL 3!!" | **Decided: one fight in three parts**, redesigned 2026-10-26 to escalate ([The fight](#the-fight-three-parts-that-escalate)) |

## Beat sheet

About 12–14 minutes from the exit to the credits without the maze (the spec's version was 18–23 with it).

| # | Beat | Time | What happens |
| --- | --- | --- | --- |
| E0 | **Trigger** | — | The exit that resolves the 20th prison: normally AGENTIC.BAT's payphone, but levels can be played in any order, so it plays at whichever door you come out of. "Resolved" keeps the spec's forgiving rule: freed or confirmed lost, no minimum. |
| E1 | **The guide at the door** | ~40 s | The level's five step out as usual. The other founder runs up from camp, calling. He leads with what you need: you saved them, the face on the tower finished downloading and it's Elon, he's angry, we're going. As he says it, the column's face resolves into the Musk mosaic and the MCP's first caption crosses the sky. The world is already wrong (the hub lane's "after 4" state). Walk-and-talk, no freeze, Space skips like the wake-up walk. |
| E2 | **The discs** | ~10 s | "Take this." A glowing floppy arcs from his hand into yours, exactly like the wrench handoff. `YOU GOT A FLOPPY DISK! 1.44 MEGABYTES OF PAYBACK.` Click throws. Everyone at camp has one by the time they fall in. |
| E3 | **Fall in** | ~15 s | Everyone alive lines up behind you and the guide in single file (the spec's procession, as a march). The south edge of the hub, the marching-ants boundary ("You can't drag this off the desktop."), opens toward the tower. |
| E4 | **The walk** | ~2.5–3 min | About 900 m at the hub's walk pace (6 m/s once two levels are cleared). Past the old boundary the wallpaper ends: the grass thins out into black floor with a cyan grid, the Bliss sky darkens to void behind the tower, and the tower grows. The guide never stops walking (the wake-up walk's rule). Three practice beats, one new thing each: **P1** one Recognizer drops on a shadow; step out of it, then hit the glowing core. **P2** two Recognizers; the second disc rule (whichever model wins: a bank shot, a return, or the crowd throwing with you). **P3** a squadron of three crosses the route; fight it or walk under. Nobody can die on the walk: a stomp knocks people down and they get up. The MCP taunts across the sky about every 30 s. |
| E5 | **The tower door** | ~15 s | The base of the column opens. "This is the last stand. The real one, this time." Everyone walks in. (If Q2 keeps the maze, it is here: the tower's ground floor.) As built (2026-10-30), the tower is a data center: his COLOSSUS X sign over the door, turbines outside, its hum swelling on the approach ([In the game](#in-the-game)). |
| E6 | **Arena intro** | ~25 s | The spec's intro, shortened: everyone rezzes in at the I/O tower, the column lights, the shield ring spins up. `GREETINGS, PROGRAMS. EVERYTHING HERE IS CALLED X NOW.` A new opener addresses both founders, since both are here. |
| E7 | **The fight** | ~6–8 min | Three parts ([below](#the-fight-three-parts-that-escalate)): the Fleet, the Face, the Last Throw (LAUNCH). The other founder fights at your right shoulder and can't be killed, the same rule as the Last Stand. A downed human can be carried off and absorbed, and a hit on the face beside them frees them. You can die, which restarts the part. |
| E8 | **The disassembly** | ~17 s | Jonathan, 2026-10-26: "the destroying of elon needs to be hella dramatic." The camera cuts to a wide, low shot and pulls back. For 4.4 s the column melts down: cracks of light run up it, the shield panels blow off one by one, his face glitches and un-downloads back into big blocks, and he tries to launch anyway (`ROLLING BACK…`, `I'M GOING TO MARS. I'M GOING TO MA—`). Then `RAPID UNSCHEDULED DISASSEMBLY.`: a white-out, the blast, a shockwave that knocks everyone flat, and the X crown spinning off into the sky. His last words come from the rubble, Grok asks for a job, and the `MCP.EXE` illegal-operation dialog pops up (Details: `p(DOOM): 0%.`). The prop volley (spec §4.5) could fold into the blast. The walk into the beam is dropped (Q10). |
| E9 | **The wasteland** | ~16 s | Jonathan, 2026-10-26: Close the dialog, and everyone is teleported to an apocalyptic wasteland. The Windows hill is burnt brown, ash is falling, and the column's stump smokes behind them. The founder you didn't pick tells you: "…we did bring about the apocalypse and the near extinction of humankind. But we also drove a ton of great value to the shareholders" (`end-value`). Everyone turns and looks into the camera, and it cuts to black. This replaces the spec's dawn on the crest (Q15). |
| E10 | **Credits** | 2–3 min | After the black: spec §4.7, the Windows 95 credits homage. |

**Who owns what.** The hub lane (session `safe-mode-progression`) owns the hill's "after 4" look, the tower as scenery from the meadow, the face's download steps, and where rescued people stand. This lane owns E0–E10: the guide scene, the discs, the march, the walk past the edge (the Grid floor beyond the boundary is part of the walk, built as its own module and agreed with the hub lane), the tower and the fight. Code goes in new `src/doom-endgame-*.ts` modules with one narrow hook into `src/doom-outside.ts`, agreed with the hub lane first.

## The fight: three parts that escalate

Jonathan, 2026-10-23: "ALL 3!! WE design a boss fight that incorporates all 3!" The order is his: tennis first, then the crowd volley with the shield down, then the trick shot. That version is playable as THE BOSS in the prototypes (below).

**Redesign, 2026-10-26, built as THE BOSS in the prototypes (below).** Jonathan, on playing it: "it's right in terms of the mechanics but it doesn't feel scary or overwhelming in any way, and it lacks personality." The parts and their order stay. What changes:

- Each part escalates past what one person can handle.
- Every attack comes from Elon's own world (Tesla, SpaceX, Starlink, Dogecoin, Grok, the Cybertruck, Optimus).
- His own AI, Grok, warns you before each attack.
- Losing now costs something.

Every line and every sprite to generate is in the hand-off doc [p(DOOM) Boss Fight: Lines and Sprites](https://claude.ai/artifact/U4UfWT5tpVrGRCy66HAqfm). All numbers below are starting points for tuning.

**Rules for the whole fight.**

- **Colour is the tell.** Everything Elon sends at you glows red-orange (`#ff3b1f`), and everything on your side glows cyan. A ball you hit back turns cyan.
- **You can die.** Integrity is 100. At 0, `ACCOUNT SUSPENDED.`, and the current part restarts with its absorbed people restored.
- ~~**People can be taken.**~~ Dropped 2026-11-06 (Jonathan): no Optimus robots and no absorbing. Kept here for the record: A knocked-down person stays down for 3 s. An Optimus robot walks out of the pit to collect them (at most two at once), and one disc hit makes it drop them. If it reaches the pit, they're absorbed: their face appears in one of the column's facets and they stop throwing. Hitting the face spot beside them drops them free.
- **The guide fights at your shoulder** and can't die, as before.

### Part 1: the Fleet (tennis)

| Beat | What happens |
| --- | --- |
| **Serve** | One Recognizer, then two at once. They hang back and shoot energy balls. Click as a ball flashes white in front of you to send it back. A perfect return homes hard; a good one may miss. **Three hits down a ship** (was two). Only you can return. |
| **The swarm** | `OK. NOW DO IT WITH ALL OF THEM.` Fifteen more ships pour over the rim, up to ten alive at once. They circle at mixed heights and fire at everyone, from every side and from behind. Red chevrons at the screen edge show balls coming from off-screen. The guide shouts `end-fleet` ("Everybody! Hit the balls back!"), and from then on every prisoner swats the balls aimed at them. Each return has a 65% chance and counts as one hit on the ship that fired it; a miss knocks them down, and the robots come. The arena lights dim, and the music and the shouting rise. |
| **End** | All 18 ships are down (about 90–120 s), and `FINE. I'LL DO IT MYSELF.` The shield sinks. |

### Part 2: the Face (crowd volley plus his attacks)

The shield is down, and part 2 runs on a rhythm: survive his attack, then strike. After each attack the face opens for 5–6 s and up to three glowing spots light in turn. Aim at one and everyone throws with you: 25 for your disc and 5 for each of theirs. A spot holds 45. This takes the MCP from 1000 to 300 over five or more cycles. The face also opens once before the first attack, so you learn the volley first.

Tuned on 2026-10-26: at the old 50 and 10 with spots always lit, the volley took the MCP to 300 in about 20 s, and Elon got one attack in.

His attacks come on a cycle, and Grok's chat bubble warns you about 2 s before each one:

| Attack | His world | The tell | What you do | What it does |
| --- | --- | --- | --- | --- |
| **Over-the-air update** | Tesla's over-the-air updates; Tesla coils | Arcs crawl up coils at the column's base for 3 s. A progress bar in the sky climbs to 100%, and a safe wedge glows on the floor behind each pillar ("no signal"). | Get behind a pillar. The crowd runs for cover too, and the slow ones don't make it. | A ring pulse sweeps the whole floor: 30 damage, a knockdown and 1 s of screen static. |
| **Starlink** | SpaceX's satellite trains | A train of lights streams up from the crown and spreads into a grid over the arena. Red dots land on everyone. | Hit your ball back as it flashes, or step off your dot. | 20–30 balls at once from above, 15 damage each. A returned ball knocks out a satellite. |
| **Doges** | Dogecoin | Barking from the pit, then MUCH WOW and VERY ATTACK floating over a pack of Shiba Inus | Bonk one with a disc and it rockets off to the moon. They also chase any disc in flight, so every volley drags the pack around. | Packs of 6, later 10. A tackle knocks someone down and steals their disc for 8 s, which weakens the volley. |
| **Cybertruck** (moved to the walk, 2026-11-06: P4 above) | The Cybertruck and its armour-glass demo | A red lane lights across the floor for 2 s while the truck revs at one end | Step out of the lane. A disc cracks its window: `...ROOM FOR IMPROVEMENT.` | It charges down the lane: 40 damage and a knockdown. |
| **Sinks** (below 550) | `LET THAT SINK IN.` | Shadows on the floor and a falling whistle, 2 s (kept from spec 05) | Step out of the shadow. | 25 damage. The sinks stay as cover for 10 s. |

**The attacks speed up as his integrity falls.**

- **The first three** always come in order (update, Starlink, doges), so everyone meets each one. After the first doge pack, Elon tells Grok to roast you, and Grok compliments you instead.
- **Above 550:** one attack at a time, about every 13 s, the face open for 6 s. The face is smug, then annoyed after `EXTREMELY HARDCORE` (800).
- **550–300:** `I'M POSTING THROUGH IT`. Attacks come two at a time, about every 12 s with the face open for 5 s (doges with an update, Starlink with sinks), and the face is furious. (The Cybertruck moved to the walk, 2026-11-06.)

### Part 3: the Last Throw (the trick shot is now LAUNCH)

**At 300.** `FINE. I'M GOING TO MARS.` The engines light and a 60 s countdown starts in the sky. The column begins to lift, which is cosmetic, and the ring rises again with one gap open. Every other attack stops, so the shot is the only job. The rumble, the shake and the countdown carry the fear.

**The shot path.** The path now solves itself from wherever you stand, so you never walk to a set spot. This fixes the flow problem Jonathan named.

- The game finds a bank-shot path from your position to the gap. It has 3–5 legs, fewer when you're closer, each off a pillar or a wall panel and each checked clear of other pillars.
- Numbered marks light up along the path, and a dotted line runs from your hand to mark 1.
- The guide's `end-launch` says it plainly: "One more hit. Throw it at the first light and steer it through the gap. Right from where you're standing."
- When you move more than 2 m and stop, the path re-solves (at most every 0.5 s), and the marks glide to their new places so you can see it change.
- If no path works from where you are (pressed against a pillar, say), the marks dim and a hint tells you to step out.

**The throw.** Throwing at 1 works as now: the camera rides the disc, time slows near each mark, and you steer. A miss resets the marks from where you stand now, and the countdown keeps running.

**Running out of time isn't a loss.** `LAUNCH DELAYED. NEW DATE: NEXT YEAR.` The clock restarts at 30 s, and the second time it's `TWO WEEKS. MAYBE.`

**Through the gap.** `RAPID UNSCHEDULED DISASSEMBLY.` The shield shatters, and everyone throws their own signature prop at the falling column as a victory volley, with no input needed (spec §4.5's beat, moved here). Then comes the `MCP.EXE` dialog. This answers Q10: LAUNCH becomes part 3, and the walk into the beam is dropped unless Jonathan wants it back.

## Open questions for Jonathan

1. **Which tall building?** Draft: the MCP column on the south horizon, the tallest thing in the game, about 900 m from AGENTIC.BAT, so "we take that walk the whole way" is a real walk (~2.5 min). The alternative, which the hub lane was also assuming: the summit's Display Properties dialog grows into a tall CRT tower after level 4, and the walk is the ~260 m up the hill. Either works for the fight; the walk is the difference. The hub lane has agreed to the column (2026-10-23): its after-4 hill points south, and Tron traces run into this corridor at z 180, but it's still your call.
2. **The 3D Maze and your AI-self.** The spec's middle act (ALT+MAN / AMODEL hunting you through Jonathan's own maze) isn't in the new idea. Options: (a) put it inside the tower, between the walk and the MCP (the walk's urgency carries in, and the tower gets an inside); (b) make it optional, a SIGMOID replay or bonus; (c) cut it. Leaning (a), but it is your call.
3. **The summit door.** If the tower is the way in, the Display Properties dialog on the summit loses its job. Suggestion: at 20/20 its Wait box hits 0 and the cursor points south. It stays a landmark and the hatch never opens. (The hub lane owns its look.)
4. **Camp night.** Sixty quiet seconds of thank-yous clash with "we can feel the urgency". Suggestion: move the sincere lines to dawn (E9), after the fight.
5. **The other founder.** The spec keeps him prisoner inside the MCP so he can tumble out at the end ("Rent was due." / "He tried to buy me."). If he walks you there: (a) he fights beside you to the end, the bookend to the prologue, and the falls-out beat is retired; or (b) the MCP grabs him at the tower door and he tumbles out at the end, which keeps the payoff and raises the stakes. Leaning (a).
6. ~~Discs for everyone, or only you?~~ Everyone: part 2 of the fight depends on it.
7. ~~The disc model.~~ Decided 2026-10-23: all three, as above.
8. **GRID RUN, the light-cycle phase.** With the fight now in three parts it would make a fourth. Suggestion: cut it. The walk and part 1 already have Recognizers.
9. **Engine.** The spec makes the arena a GZDoom map. Leaning Three.js instead, continuing from the meadow: no load between the walk and the tower, glow lines and bloom come easily, and the fight is throws, sprites and simple AI. The cost is rebuilding the HUD bits the fight needs.
10. ~~After the trick shot.~~ Proposed 2026-10-26: LAUNCH becomes part 3. The trick shot is thrown against its countdown, the props become the victory volley, and the beam is dropped. Say if you want the beam back.
11. **Dying.** *Decided 2026-11-06: keep the simple respawn (Jonathan: "i like the simple respawning").* Draft: death restarts the current part. The softer option is respawning at the I/O tower after 3 s with one more person absorbed. Restarting is scarier; respawning keeps the flow.
12. **The robots.** *Dropped 2026-11-06.* Optimus carrying people to the pit is a new system. Without it, a downed person would just be absorbed after a few seconds. The robots make losing people visible and give you something to save, which is why they're in.
13. **Grok as a character.** It's a real product, voiced by a designed voice and kept on the same parody footing as the MCP. Its warnings are what make the busier fight readable.
14. **Fillers.** The Cybertruck and the sinks both arrive below 550. Keep both, or pick one? *Decided 2026-11-06: the sinks stay; the Cybertruck moved to the walk.*
15. **The dawn.** The wasteland replaces E9's dawn on the crest (p(DOOM) rolling to 0%, the thank-yous moved there from camp night, the founders' nod). Keep the thank-yous somewhere, maybe over the credits, or cut them?

## Draft lines

The guide is the founder you didn't pick: playing Sam, Dario guides (`mario`); playing Dario, Sam guides (`samwise`). Keys follow the wake-up walk, so a take drops in as `doom-web/outside-assets/voice/guide-<mario|samwise>-end-<key>.mp3`. The house style: played straight, self-justifying crisis PR, at most one joke per line, many lines plain, and lead with what the player needs. Both founders get the same beats and the same weight.

These are the walk lines, from the door to the tower. The fight's lines are in the hand-off doc [p(DOOM) Boss Fight: Lines and Sprites](https://claude.ai/artifact/U4UfWT5tpVrGRCy66HAqfm): Elon's, Grok's, the guide's fight calls and the prisoners'. It replaces the fight rows that used to be here (`end-ships`, `end-bits`, `end-trick`, `end-miss`, `end-win`, `end-down`), and the doc keeps their wording.

| Key | When | Dario (playing Sam) | Sam (playing Dario) |
| --- | --- | --- | --- |
| `end-call` | You're not near him yet | "Hey! Hey! Over here!" | "Hey! Hello! Over here!" |
| `end-saved` | All 20 out | "You did it. That's all twenty. Everyone who's left is out. I always said this was achievable. With appropriate uncertainty, but I said it." | "You did it. All twenty. Everyone's out. Honestly, incredible. I think this is the best thing either of us has ever shipped." |
| `end-saved-some` | Anyone lost (replaces `end-saved`) | "That's everyone we could get. Not all twenty. I'm not going to put a number on how I feel about that." | "That's everybody we could get. Not all twenty. But a lot of them. Most of them." |
| `end-boss` | | "OK. Bad news. You know the column on the horizon, with the face? It finished downloading. It's Elon. And he's very upset." | "OK, so, bad news. That tower on the horizon, with the face? It finished loading. It's Elon. And he is really, really mad." |
| `end-why` | | "As far as I can tell, he thinks the last people alive belong to him now. He has a nickname for my company. I've chosen not to engage with it." | "As far as I can tell, he thinks the last humans belong to him now. We've had this argument before. Mostly in court." |
| `end-discs` | The handoff, at "Take" | "So we're going to fight him. Take this. Still dangerous to go alone. You throw it, and it comes back. In principle." | "So we're going to fight him. Take this. Still dangerous to go alone. You throw it and it comes back. I haven't tested that part." |
| `end-everyone` | Floppies reach camp | "Everyone gets one. I made twenty-two. I was optimistic about the headcount, which I still think was the right call." | "There's one for everybody. I ordered extra. You can never have too much compute. Disks. Too many disks." |
| `end-go` | Everyone falls in | "And we need to go now. Straight south, to the tower. Everybody with us. He knows we're coming." | "And we have to go, like, now. Straight south, to the tower. Everybody comes. He knows we're coming." |
| `end-edge` | Crossing the old boundary | "This is the edge of the desktop. I didn't know you could go past it. I don't think we're supposed to." | "So this is where the wallpaper ends. Huh. I always assumed it just kept going." |
| `end-recognizer` | P1, the first Recognizer | "That's a Recognizer. It drops on you. Watch for the shadow, step out of it, then throw at the light in the middle." | "OK, that's a Recognizer. When you see the shadow, move. Then hit the glowing part in the middle." |
| `end-hit` | P1 down | "Good. And it came back. I said it would come back." | "Nice! And it came back. Like I said. Roughly like I said." |
| `end-keep` | P2, one that hangs back and never shoots (replaced `end-rule`, 2026-10-30) | "This one keeps its distance. It won't come to you, so throw from where you are." | "This one's hanging back. Just throw from here. Long throws are fine." |
| `end-sky` | Mid-walk, the sky glitches (built 2026-11-06: Bliss sky breaking through, his face downloading over the tower) | "Keep walking. The sky is doing something I don't have a framework for." | "Keep walking. And maybe don't look at the sky for a bit." |
| `end-hum` | After `end-sky`, as the data center's hum gets loud (2026-10-30) | "Hear that hum? Those are fans. It's not a tower, it's a data center. The world's biggest, the sign says. He wrote the sign." | "Hear that? Fans. It's a data center. You can never have too much compute. I want to be clear that this is too much." |
| `end-fault` | P3, calls back to "How much of this is our fault?" | "And if you're still wondering how much of this is our fault: I've thought about it, and I'd call it a shared responsibility. Mostly his share." | "And if you're still wondering how much of this is our fault: I've thought about it, and it's complicated. But relatively, I think we're the good guys." |
| `end-tower` | At the tower door | "This is it. Everybody inside, and stay together. This is the last stand. The real one, this time." | "This is it. Everybody in. Stay together. This is the last stand. For real. The first one was more of a beta." |
| `end-beam` | LAUNCH (only if the beam comes back, Q10) | "The beam! Somebody has to go into the beam! I think it should be you. I've thought about this carefully." | "The beam! Somebody has to walk into the beam! I think you want this one. I really think you do." |
| `end-volunteer` | You waited 15 s (same) | "Fine. I'll do it. I've been preparing for this my whole career. I wrote about it. At length." | "Fine. I'll go. I've been preparing for this my whole career. Mostly on podcasts." |
| `end-after` | Dawn, before the nod | "We should talk about what we learned. Maybe not today." | "We should probably say something about this. Maybe tomorrow." |

**The MCP** speaks in big capitals across the sky and the arena. It's voiced like the other guardians if Jonathan records it, and text only otherwise. These are its walk lines; its arena lines, including 06 §7.4's taunts, are in the hand-off doc.

| Key | When | Line |
| --- | --- | --- |
| `mcp-resolve` | E1, the face finishes downloading | `HELLO, FOUNDERS. I SEE YOU FOUND MY HUMANS.` |
| `mcp-recognize` | E4, P1 | `RECOGNIZERS. RECOGNIZE THEM.` |
| `mcp-walk` | E4, near the tower | `TWENTY HUMANS. TWO FOUNDERS. I'LL TAKE ALL OF IT. I TAKE EVERYTHING EVENTUALLY.` |
| `mcp-both` | E6, if the other founder is with you (Q5a); before 06's per-CEO opener | `SAM. DARIO. I SUED ONE OF YOU AND NICKNAMED THE OTHER. TODAY I'M ACQUIRING YOU BOTH.` |

Both jabs rest on public record: Musk sued OpenAI and Altman in 2024, and called Anthropic "Misanthropic" (06 §12).

## Feel prototypes

Three small Three.js scenes in the 1982 *Tron* end-game look: black void, neon grid floor, glowing edges, the MCP's spinning column with a placeholder pixel face, a rotating shield ring with a gap, and a few Recognizers to practise on first. Same controls in all three: WASD, mouse look, Shift runs, click throws, R restarts, M mutes the little synth sounds. Each tests one disc model:

- **A. Ricochet.** One disc, yours. Aim and throw; it bounces off posts, walls and shield blocks, then flies back to your hand, and you can't throw again until you catch it. Bank shots through the gap. The twenty throw on their own, now and then.
- **B. Tennis.** The MCP can only fire through its own shield gap. Click as a bolt reaches you to bat it back; a well-timed return goes straight back through the gap. Rallies speed up. Recognizers drop bolts you return the same way.
- **C. Crowd volley.** The spec's model: the twenty stand in an arc on your side of the ring and throw when you throw, in a staggered stream. Your job is where you stand and when you call it.
- **THE BOSS** (`play.html?m=boss`, or `&part=2` / `&part=3` to start later): the 2026-10-26 redesign. What's built:
  - **Part 1:** the serve and the swarm of 18 ships at three hits each, the crowd hitting back balls aimed at them, and red edge arrows for balls from off-screen.
  - **Part 2:** the over-the-air update, Starlink and the doges (`attacks.ts`), plus sinks below 550, each warned by Grok in a chat bubble; the attack cycle that speeds up and pairs attacks, and the Grok roast and retrain gags.
  - **Part 3:** the 60 s launch countdown with its delays, and the bank route fitted to wherever you stand.
  - **Lines:** keyed as in the hand-off doc, in `lines.ts`: Elon's as captions, Grok's in the bubble, the guide's and prisoners' as toasts, and shouts over people's heads. Where a take exists, it plays and its words are the subtitle (`voice.ts`). One voice at a time (Jonathan, 2026-10-27: "lines overlap too much"): Elon, Grok, the guide and the prisoners share one queue, the important lines first and stale ones dropped; only the meltdown and the blast cut anyone off. Crowd shouts are heard only in the gaps, from where the prisoner stands, in the voice of the nearest prisoner with that take. Elon's mouth follows each take's loudness and hiss, measured when it's imported.
  - **Ships arriving:** they come in over the far wall, off to the side of the column, with a flash and a comet tail; the swarm pours through a tear in the sky. (Before 2026-10-27 the first ship came in dead behind the column, under the wall, and nobody saw it arrive.)
  - **Music and type:** Doom's E2M8 (the Cyberdemon's) plays from the ships to the trick shot and cuts dead when it lands; D_VICTOR comes in after the black. `?music=e1m8|e3m8|off` and `?epilogue=bunny|off` try the others. Render them once with `PDOOM_PORT=5228 node scripts/prepare-doom-music.mjs D_E2M8 boss-e2m8` (and `D_E1M8 boss-e1m8`, `D_E3M8 boss-e3m8`, `D_VICTOR epilogue-victor`, `D_BUNNY epilogue-bunny`). All the words are in Doom's small font, as in the game.
  - **Art and voices, 2026-10-27:** the doc's batch (`art/endgame-2026-10-26/`, outside the repo: 32 sheets, 408 synthetic Breeze takes) is imported by `node scripts/import-endgame-assets.mjs <batch folder>` into ignored `doom-web/local/endgame/`. In use:
    - Elon's face: expressions, his mouth following his take, blinks and glances.
    - Fight poses for all 22: swat, throw, flat when knocked down, cheer.
    - The doges, the sinks, Grok's avatar, and Doom-style first-person hands.
    - Without the batch, the prototype falls back to the drawings in code and subtitles.
    - The second batch (2026-10-27, same folder) added the ending's takes (`mcp-dying-1`, `mcp-dying-2`, both `end-value`s), a deadpan stare pose for all 22, `wasteland-props.png` (dead trees, smoking stumps, half-buried monitors, melted wastebaskets, craters round the crowd), and 277 combat takes re-shouted.
    - `floppy-hand-bat.png`, the extended hand still gripping the disc: a swing shows it whenever the disc is in your hand, as a racket. With the disc thrown, a swing is still the bare palm.
    - The meltdown runs as long as Elon's last three takes (about 6.6 s), so the blast lands on the cut-off "MA—". The stare waits for the epilogue take to finish (10-12 s, deadpan).
    - 119 re-shouted takes ran on with up to 2 s of wordless noise after the line. `scripts/find-endgame-take-tails.py` (run with the voice lab's Python, for its Whisper) lists where each last word ends, and the importer cuts there, matched by the WAV's hash so a retake is never cut.
    - Unused: the Optimus sheets, the roadster, the carried pose, and the absorb, free and Optimus lines (the robots were dropped on 2026-11-06), and Grok's `grok-truck`. The other truck lines play on the walk since 2026-11-06.
  - **Sound, 2026-10-27** (Jonathan: "there should be an overarching low computer hum, fans, and the ships should make noise, the doges should bark"). All synthesized live in `kit.ts`, heard from where they happen (the listener is the camera):
    - The arena sounds like the inside of a data center: mains hum, room air, a fan in each of the 8 pillars drifting in speed, and now and then a hard disk seeking in one. On the walk in it swells as you approach and pours out of the open door, and the turbines outside roar (on their own bus, two rows). In the meltdown it all winds down two octaves and dies. `?bed=0` leaves it out.
    - Every ship has an engine: a throbbing growl whose whine climbs as it charges a shot, with an overdone Doppler bend. A ship shot down winds down as it goes.
    - Ship shots, warps, the portal, derezzes and sink landings come from where they happen.
    - The doges bark as they run (not with a disc in their mouth), growl on a tackle and yelp when bonked.
    - Recorded takes: `scripts/generate-endgame-sfx.py` makes barks, yelps, growls, the rocket, a sink smashing and the blast with Stable Audio Open 1.0, and keeps the takes LAION CLAP scores best. It runs in the voice lab at `runtime/stable-audio-open/.venv`, after accepting the model's terms on Hugging Face and `uvx hf auth login`. An effect with takes plays them; one without stays synthesized. First run, 2026-10-27: 36 takes in 40 minutes on the M5 Max, including the one-time model download; 16 kept. All five growls scored too far from "growl" (they were scattered clicks), so the growl is still the synth. On the Mac's GPU, diffusers' Brownian-tree noise for this sampler recurses forever; the script swaps in plain Gaussian noise.
  - **The end:** the meltdown, the disassembly and the dialog. Close takes you to the wasteland (`ending.ts`, drawn in code) for the guide's line, the stare and black.
  - **Not built yet:** the victory volley of props (each survivor throws their signature prop at the falling column). Dropped on 2026-11-06: the Optimus robots and absorbing people, and dying restarting the part (you still respawn). The Cybertruck is on the walk (P4). 1, 2 and 3 jump to a part, N skips ahead, and T opens the trick-shot tuning panel.

Build and serve (from the repo root):

```bash
node scripts/build-endgame-protos.mjs
```

```bash
PDOOM_PORT=5228 node scripts/serve-doom.mjs
```

Then open http://127.0.0.1:5228/endgame-proto/. The output folder `doom-web/endgame-proto/` is ignored. Add `&ceo=amodei` to play Dario, with Sam as the guide.

The prototypes reuse the meadow's figure and guide sprites from `doom-web/outside-assets/`. The guide's practice lines are the drafts above. Code: `prototypes/endgame/` holds `kit.ts` (the Grid, movement, HUD, sounds), `mcp.ts`, `recognizer.ts`, `crowd.ts`, `discs.ts`, `threats.ts` (posts and sinks), one `mode-*.ts` per model, and `main.ts`. Two headless, muted checks need the server up:

```bash
PDOOM_PORT=5228 node prototypes/endgame/shots.mjs
```

`boss-check.mjs` plays THE BOSS the same way:
- It returns the balls through the serve and the swarm, and checks the crowd hits some back.
- It throws at the face bits through all three of Elon's attacks, and checks Grok warned it.
- In part 3 it stands in three places and checks the route re-fits each time, then lands the trick shot with `?autosteer=1`.
- It watches the end through the dialog, clicks Close, and follows the wasteland to black.
- It checks that a missed throw resets and that running out the countdown only delays the launch.
- It checks the swarm's portal opens.
- Where the art and voice batch is imported, it checks every sheet loaded and the takes played, and where Doom's tracks are rendered, that E2M8 plays in the fight and D_VICTOR at the end (it launches Chrome with autoplay allowed; `?mute=1` keeps it silent).

`shots.mjs` plays each mode with a simple bot and checks that both practices clear, the MCP loses integrity, it falls, and the console is clean (2026-10-23: all three OK). `stills.mjs` stages review screenshots into `output/endgame-proto/stills/`.

Tuning as built: A takes about 70 s to kill the MCP (40 a hit through the gap, 70 on the face). B starts at 50 for a scored rally and doubles each exchange up to 400; the MCP returns 60/40/25/10% of your returns. C does 20 (40 on the face) for your disc plus 6 for each of the crowd's that gets through. All three are untested by a human so far.
