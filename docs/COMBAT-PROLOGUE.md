# The Last Stand — playable opening prototype

Purpose: meet the player's Doom expectations before changing the task. The
player experiences the final human battle, loses it, and wakes in Bliss.
The rescue campaign begins with a new understanding: survival now means
getting people out, not clearing every room.

## Current opt-in prototype

Open http://127.0.0.1:5198/?prologue=1, choose New Game and The Control Problem.
Normal links and Load Game retain the existing flow. This experiment is local;
it has not replaced the friends' deployed opening.

The battle is a **gauntlet** (2026-10-09): set pieces cut from several original
Doom maps, played in a line from room to room, ending in a huge open-sky arena.
It replaces the old single-map E1M2 version (kept in `scripts/build_prologue_map.py`
for reference; backups of the pre-gauntlet files are in
`output/gauntlet/backup-before-gauntlet/`). Four war-machine homages (below) and
genuine Doom weapons, ammunition and health pickups. Start with a shotgun and
pistol; green armor waits in the first room, the chaingun in the second, the
rocket launcher in the fourth.
Click / Space fires repeatedly when held. T cycles owned weapons; 1 fist,
2 pistol, 3 shotgun, 4 chaingun, 5 rockets. Native doors use E with a nearby prompt.

### The run (`scripts/gauntlet.json`)

| # | Sector | Source | Look | Robots |
| --- | --- | --- | --- | --- |
| 1 | THE HANGAR | E1M1 start room | Doom's own first room: get your bearings, green armor, armor bonuses, supplies | 2 |
| 2 | CONTAINMENT FLOOR | E2M2 depot | red ceiling, cement tech walls (your screenshot 4) | 5 |
| 3 | THE OSSUARY | E2M5 crypt | low green marble, skull pillars and doors (screenshot 3) | 8 |
| 4 | THE BLUE LAB | E2M4 lab | 248-tall COMPBLUE lab; first Hunter-Killer; rocket launcher (screenshot 6) | 11 |
| 5 | THE PILLAR YARD | E2M7 yard | first open sky (SKY2), pillar grid, nukage trenches (screenshot 2) | 12 |
| 6 | THE BREACH | E3M1 east court | hell sky (SKY3), rubble walls; the one ED-404 (screenshot 1) | 15 |
| 7 | THE LAST GROUND | E2M8 plaza | 3136x5056 courtyard of carved pillars under SKY3: the finale | endless |

THE HANGAR was added after the first playtest (2026-10-10: "the ramp is too
steep"). Its two Centurions are deaf and face away (one on the platform, one
guarding the exit corridor), so nothing happens until you start it.

Sections 2 and 5 come from E2M2 and E2M7, which `docs/spec/02-doom-maps.md` plans
as future rescue levels. `scripts/gauntlet-no-rescue-overlap.json` is a validated
drop-in that swaps them for E1M1's computer bay and E2M3's vine yard (screenshot 5);
copy it over `scripts/gauntlet.json` to use it.

### Mid-battle rooms, soldiers and the other founder

Apart from THE HANGAR, every room is already a war when its door opens
(2026-10-10: "walk into a room that is already mid-battle"). Each room's actors
are frozen (`PDLastStand.Asleep`) until you cross into it, so its fight cannot
end before you get there. On arrival (`StartBattle`), the room's soldiers, placed
just inside the entrance by the setlist's `soldiers` count, and its robot squads
turn on each other at once. Every second, `Engage` sends robots whose target has
died, and about a third of the rest, at the nearest soldier in sight, and idle
soldiers pick a robot, so the fire is spread around rather than all aimed at
you. Robots keep streaming in out of sight (`robots.every`: 12 s in room 2 down
to 7 s in THE BREACH). The finale opens with ten soldiers stepping out with you,
then the barrage. Soldiers can win a room's seal for you.

From the second room on, soldiers keep coming up behind you. They are Doom's own
marines (`PLAY`) in the multiplayer colours (`PDWarAlly` and its grey, brown and
red variants). Each one appears in the shut entrance airlock you just came
through, and the blast door opens to let him run out and join the fight; it
shuts again once he is through. The radio announces the first: "SECOND PLATOON,
MOVING UP ON YOUR SIX." They follow you and fire at the machines. The machines
shoot back, and in this war they all die. You walk through them, and neither
side can hurt the other. Each section's `allies` entry in the setlist sets the
pace and cap: room 2 one every 14 s (2 alive at most), rising to one every 5 s
(6 at most) in the finale. Soldiers in a closing exit doorway step into the
airlock with you; those left behind in a section are removed when you cross.

In THE LAST GROUND the founder you did not pick (`pdoom_ceo`: playing Dario
brings Sam, and the other way round) steps out of the last airlock at your right
shoulder and fights beside you (`PDWarFounderSam` / `PDWarFounderDario`). He
cannot be killed, because he is the one who walks you over the hill in Bliss.
His sprites (`WSAM`, `WDAR`) are currently the Bliss guide's walking poses without
a gun. `art/war-allies-v1/README.md` specifies the ChatGPT atlas that replaces
them (rifle, walk, aim, fire and pain, 8 directions), and
`scripts/import-war-allies.py` imports it.

### How the stitching works

`scripts/build_gauntlet_map.py` reads the setlist and the private IWAD and writes
the E1M2 slot (`maps/E1M2.wad` in the PK3), plus `doom-mod/actors/GauntletData.zs`
(section names) and `output/prologue/map.json` + `gauntlet.png` (layout for QA).

- A section is a set of sectors from one original map. Kept sectors keep their
  geometry, heights, textures and lighting. Lines into deleted space become
  walls. Adjacent closed doors stay as sealed "JAMMED." doors (their tags are
  cleared so no trigger opens them). Exits, keys, secrets and crushers are
  stripped; `strip` removes other interior triggers.
- Sections are laid out side by side in one map, never touching. Consecutive
  sections are joined by a pair of **identical airlocks**: a BIGDOOR2 blast door
  plus a 192-deep room built straight out of the exit line, and the same at the
  next entrance. The exit door is sealed ("SEALED. CLEAR THE SECTOR - N MORE.")
  until at most a quarter of the section's squad remains, or 90 seconds pass.
  Once your whole body is inside, the door shuts behind you; step back out and
  it opens again. Once it is closed, the handler moves you, and anything that
  followed you in, to the same spot in the next airlock. The rooms are
  identical (noise flats, no fake contrast), so nothing visibly changes. The
  door ahead opens. Once you are clear of it, it shuts behind you; duck back
  in before it has shut and it opens again. The handler keeps re-asking each
  door until it is where it should be, because Doom ignores door specials
  while a door is still moving. Machines left behind are removed, freeing
  their budget. Machines that followed you through leave their squad.
- Per-section `sky` uses Boom sky transfer (SKY1 default; SKY2/SKY3 by section).
- Validate any setlist with `npm run check:gauntlet` (or
  `python3 scripts/build_gauntlet_map.py --check --setlist f.json --out dir`):
  overlap, straight-boundary, walkability, damage-floor and cut-sky checks.
- The atlas of every original map (`python3 scripts/doom_atlas.py`) renders
  numbered sectors to `output/gauntlet/atlas/` for choosing new cuts.

Four machine types, each a pop-culture homage and deliberately unlike the
rescue campaign's Inferminator and HAL (art in `art/war-robots-v1/`):

| Machine | Homage | Behaviour | Health |
| --- | --- | --- | --- |
| Centurion trooper (`PDWarTrooper`) | Cylon centurion | rifle infantry, single plasma bolts | 60 |
| Sentinel (`PDWarSquid`) | Matrix sentinel | fast floating swarmer, Lost-Soul lunges | 45 |
| ED-404 enforcer (`PDWarEnforcer`) | ED-209 | slow stomping heavy, rocket pods then a burst, warns "twenty seconds to comply" | 700 |
| Hunter-Killer (`PDWarGunship`) | Terminator HK | hover gunship, paired cannon shots | 140 |

Late replacement troopers (`PDWarAssault`) fire three-round volleys. All are
killable; weapons never secretly stop doing damage. Each has Doom's own
mechanical sight/pain/death sounds (arachnotron, cyberdemon, spider, lost soul)
and a fireball over the wreck; troopers die with the camera-break crunch.

The fight has a shape: a push from room to room, then a trap.

1. **Route.** Six set pieces, each with dormant, deaf squads (Doom's ambush
   flag) that wake together when one of them sees you. Squads grow 2, 5, 8,
   11, 12, 15 and new machine types arrive one at a time: Centurions and a
   Sentinel, Sentinel pairs, the first Hunter-Killer and Assault troopers, a
   flight of Sentinels with two Hunter-Killers, then the ED-404. In the first
   two rooms the machines stand with their backs turned, so you get the first
   shot. Each arrival shows "SECTOR n OF 7: NAME". A sector you linger in gets stragglers
   after 45 seconds, out of sight where pads allow, more of them deeper in.
2. **Seals.** Each exit is a sealed blast door until the sector is mostly
   clear (or 90 s pass): "RADIO: SECTOR CLEAR. THE BLAST DOOR IS OPEN - MOVE UP."
   The last one says "THIS IS IT. EVERYONE OUT INTO THE OPEN."
3. **The Last Ground.** Step out of the final airlock into the E2M8 plaza
   under the red sky: "IT'S A TRAP", a cyberdemon roar, the music cuts to At
   Doom's Gate, and a 30-machine barrage teleports in, landing in view first,
   ED-404s included. Bigger waves follow every few seconds for as long as the
   player survives; there is no fixed ending time. A cache by the door
   (soulsphere, rockets, bullets, shells, medikits) makes the start of the last
   stand heroic before it turns hopeless.

The machines are aggressive by Doom standards: quick reactions, frequent fire,
two-round trooper bursts, little flinching and fast bolts. p(DOOM) climbs
section by section (25% to 65%), reads 66% in the final airlock and runs from
70% to 99% in the finale.

A 128-live-robot simulation budget protects the browser. It does not cancel
waves: unplaced reinforcements stay queued, and every kill opens a slot for a
replacement. Pressure continues after the old 150-second endpoint. Capture
happens only after native damage, including armor absorption, exhausts health. There is no hidden
scripted damage, timer death, EMP defeat, victory or finite last wave.

The earlier 2–3-minute preference is a tuning target, not a deadline: skilled
players may hold out longer. Esc pauses combat. The explicit Skip Prologue
control remains for repeat testing and players who choose to bypass the fight.

The real Doom status bar runs the fight: AMMO, HEALTH, the vanilla ARMS grid,
the CEO's face and the BULL/SHEL/RCKT/CELL table, with only ARMOR relabelled
P(DOOM) (`PDWBAR`, doom-statusbar.js war mode). Armor still works natively. It
shows as a gauge in the three key boxes, filling upward with one chest plate
per third of its maximum: green (`PDARMG`) for green armor and bonuses, out of
100, and blue (`PDARMB`) for blue armor, out of 200. The title fades like a level
name; short messages sit top-left like Doom's.

QA: `node scripts/gauntlet-walk.mjs` walks every section natively (seal prompt,
section clear, airlock crossing with before/after screenshots that must match,
look-around shots of each arrival, finale barrage) into
`output/prologue/gauntlet-walk/`. It is part of `npm run test:doom:prologue`.
`netevent pdoom_prologue_clear` (console, QA only) destroys the current
section's machines without touching later sections.

Capture plays Doom's own death, then an upload. Natively (`DeathCam`, after
`PlayerPawn.DeathThink`), you scream, your gun drops away, and the view sinks to
the floor and turns to your killer. The status bar shows the dead face and 0%.
The world freezes, and the pawn stays technically alive, so there is no respawn
prompt. At 1.3 s, `doom-web/prologue.js` snapshots the last frame (status bar
included) and uploads you: the picture tears into displaced slices with split
colour, drains to green as code climbs up out of it, and burns out to white at
4.7 s. There is no on-screen text, because the founders say it. The white
spreads from the engine view's 8:5 box to the whole window, holds until the
meadow is ready, then fades evenly into full-screen Bliss. The sound is synthesised in
the browser and is original, not a film sample: rising data chatter, a climbing
sweep and swelling static, then a bright chord that rings into the meadow.
`output/prologue/transition/probe.mjs` films it. Then you wake in the Windows XP
meadow with empty hands. No normal
Doom death menu, score modal, rescue losses, or campaign save is emitted. The
first rescue and bulkheads remain untouched. The historical fight is unscored.

## Intended finished sequence

1. Immediate competence: shotgun, a small group of readable enemies, satisfying
   destruction. One short objective, no preceding wall of story text.
2. Momentum: find a heavier weapon, push through an actual route, gain ground.
   Radio updates imply other human squads are still fighting.
3. Collapse: reinforcements from several directions, other squads fall silent,
   the in-world p(DOOM) climbs. A brief apparent success precedes the last push.
4. Overwhelmed: the player can keep killing individual machines, but cannot
   turn the larger war. Only actual lethal combat damage advances the story.
   Reinforcements keep coming for as long as the player survives.
5. Quiet wake-up: fade from darkness into Bliss, empty hands, wind and the
   existing Bliss song. You wake low behind the big dome facing away; no bunker
   is visible anywhere. Look round to find the other founder up the slope.
6. Walk and talk: walk over (he calls out if you don't), then follow him over
   the crest. The bunker appears in the middle of the meadow; he says nothing
   for a moment, then keeps walking and talking, waiting if we fall behind.
7. Enter the facility: E at the portal starts the original first-room
   wrench/camera/crawl rescue with reset health/inventory. No second intro
   film, and no rescue timer or score runs during the meadow walk.

The prototype now provides a seven-section gauntlet with squad reveals, sealed
exits, escalating stragglers and a combat-driven defeat handoff. Radio voices
remain. Human playtesting should tune squad sizes (THE BREACH wakes all 15
machines, the ED-404 included, when its door opens), ammunition and the wave
curve; never restore a forced deadline.

## Art and identity

Use Doom's combat systems and textures with our own robots. The original game's
Cyberdemon and Spider Mastermind are mechanical/cyborg designs; they do not
provide a complete all-robot cast. Do not rely on assets from sequels we have
not imported. Planned original sprite families: humanoid rifle machine,
floating/tentacled pursuit machine, and a heavy siege machine. The current orb
is placeholder art, not an introduction to HAL's later personality.

Make the persistent prison hunter visibly distinct from the disposable war
robots. Its later gun feedback must teach that shots stagger it. The prologue
must not leave players expecting a finite-ammo rescue gun to kill that hunter.

## Before making this the default opening

Human-test combat length, room reveals and the feeling of being overwhelmed.
Keep death combat-driven. Add distinct robot art and polish the quiet wake-up. Save a separate prologue-seen flag only when
its handoff completes; future visits can skip it and Options can replay it.
Load Game, HAL direct entry, committed rescues and leaderboard clocks must all
bypass the prologue. The current experimental URL deliberately replays it.

## Bliss guide (2026-10-09)

The selected founder remains the player. Sam’s guide is Dario (new yellow
suit); Dario’s guide is Sam. Two walking poses and eight directions per
character use the built-in image generator; source, prompt and import bounds
are in `art/bliss-guide-v1/`. The guide is not a rescued survivor and never
changes saved/lost counts. Subtitles live in their own single text panel, pause
with Esc and stop advancing when the player wanders out of conversation range.
Space or the visible Skip Walk button finishes exposition without bypassing
the portal interaction. The first entrance becomes usable after the talk.

The walk (`src/doom-bliss-guide.ts`): start (-45,-150) behind the dome, the
founder at (-45,-120) on the slope above, route over the crest (reveal ~18 m
after leaving him) down to the side of the door, about 127 m at 3.1 m/s. The
HAL station, its sky eye and the waymarker posts are hidden until after the
first level, and the grass has no mown path. Lines play in order, each waiting
for the previous one, a minimum gap and a point on the route, and only within
earshot; voices are spatialised from the founder. He keeps walking the whole
way (Jonathan did not want a pause), at 2.5 m/s while talking. The voiced walk
takes about 55–60 s (`output/prologue/walk-timing/probe.mjs` times it). At the
door he says the last line and hands over the wrench at "Take this": the wrench
sprite arcs from his hands into yours with a clank. The four-frame acted
handoff (`art/bliss-guide-v1/HANDOFF.md`) plays once that art exists. Then he
potters about in front of the bunker, never into it: short walks within 4.5 m,
pauses, glances at you, and he faces you whenever you come close. The door only
works after the last line. Skip puts both founders at the door and still hands
over the wrench.

The script is `src/doom-bliss-guide-lines.json`, v2 (2026-10-10). This is
Jonathan's final script, with his recordings; the subtitles match the takes. Beats:
call (only if you have not come over) / greet / follow / recap (AGI a week ago,
the last stand) / fault / situation (Windows XP, the last 20 people in four
original Doom levels) / mirror ("It's all very Black Mirror", Dario only) /
inside (five of the last 20 are in here; "Take this. It's dangerous to go
alone"). The cue list skips any beat a founder does not have. "Take this" is
literal: entering the first facility from the walk (or after Skip Walk) starts
you holding the guide's wrench (`PDCampaignSession.GuideGift`), and the
first-room shelf wrench is removed. The takes are in
`GADtrailers/pdoom/{dario,sam}-prologue-vo-v2/`, copied from
`~/Downloads/{dario,sam}-rewritten-oct10`. `scripts/import-guide-voices.py`
(TAKES) cuts and joins the takes per line; Dario's recap splices "How much do
you remember?" with the separate "Not much?" take. It levels them into
`doom-web/outside-assets/voice/guide-<mario|samwise>-<key>.mp3`, and each line
is timed from its own file. The voiced walk takes about 70 s. The v1 recordings
are archived in `art/audio/bliss-guide-v1-recordings/`.
`scripts/build-guide-voices.py` can generate stand-ins with fal.ai MiniMax
(placeholders are marked in the JSON). Do not clone a real person's voice;
`--clone` is only for a recording whose owner has agreed.

This deliberately changes the original concealed-outside reveal: Bliss is
introduced after the battle, so later escapes become reunions in the quiet
meadow. As of 2026-10-15, first XP arrival autosaves the start of this walk. Entering
the first facility advances the checkpoint to Level 1's beginning and unlocks the
optional Skip Opening choice on future New Games. Later committed camp saves still
load the ordinary meadow without replaying the guide. See ONBOARDING's save contract.
