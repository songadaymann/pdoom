# 01: Five Prisons, polish and premise pivot

**Scope:** Jonathan's ask (1), "suggestions to spruce up the level we already have". The level is the E1M4 "Five Prisons" level with the Terminator-style hunter. It also has to be adapted to the new premise: you play as Sam Altman or Dario Amodei, the CEO who nearly ended the world, and the five captives are real p(doom) figures.
**Status:** proposal, 2026-10-06. Nothing here is implemented yet. It reads the current build (PK3 `bb20efae…`, the leaderboard checkpoint) and its docs, ZScript, browser modules and QA screenshots.
**Companion image:** [img/01-five-prisons-polish-map.png](img/01-five-prisons-polish-map.png) shows the E1M4 geometry from the local WAD, the five cells, the proposed occupants, the patrol ring, the brownout zone, the empty SE quadrant and the secret sectors.

> **Lead-designer resolution ([../GAME-SPEC.md](../GAME-SPEC.md), 2026-10-06).** Cell 5 is **Holly Elmore** (the pressure pad as a sit-in), not Yoshua Bengio, who moves to Episode 4. Bengio's cell-5 barks in §4.2 move with him to Episode 4 (his discovery and guide beats); Holly's lines are in [03 §6.5](03-prisoners-and-rescues.md). The map image has been re-rendered to match. The charge fuse stays 3 s in code, and 06's pickup text now says "Three seconds". The level's p(DOOM) meter becomes the *facility* estimate; the hub shows a separate *world* estimate that reaches 0% only in the finale (GAME-SPEC §5.3).
>
> **Revision 2 (2026-10-06), changes to this level:**
> - **Hinton's new signature is *let it cut you out*:** stand in the hunter's sight in front of his cracked bulkhead, let the 2.6 s laser wind up, dive aside, and the beam breaches a small hole. It depends on A7's readable wind-up. It replaces the backprop lamp panel, which was the kind of per-cell hacking minigame LEVEL-01 rules out. Eliezer's AI-box intercom is cut (an 8 s hold for the game's most famous prisoner).
> - **Captive hints teach the ★ first.** The captive idle hint always teaches that person's signature; the loud route is mentioned only by the stuck-hint ladder (B11) after 90 s.
> - **The p(doom) question is order-neutral.** The first person you free *in the campaign* asks for your number (Liron, if this is your first level). If he isn't first, his exit beat is "Has it changed?" (03 §6.1).
> - **Discovery freeze-frames** (03 G14): a 1.2 s card with the person's name and a one-line bio.
> - **Comfort:** add a vignette-intensity slider to A16 for MEG3N's "infinite feed" dance in Episode 3 (there is no camera pull anywhere in the game).

![Five Prisons polish plan](img/01-five-prisons-polish-map.png)

---

## 0. Key decisions (TL;DR)

1. **Level identity.** Names follow the names spec ([06](06-names-and-antagonists.md)): Episode 1 **KNEE-DEEP IN THE DATA**, title card **"E1M4: THE CONTROL PROBLEM"**, with the automap keeping "Command Control". The internal ID stays `five-prisons`. Bump it to `five-prisons-v2` with v2 boards, because the cast, the CEO rule and the scoring all change.
2. **Cell → figure fit (proposal; the roster spec decides).** Each cell's mechanic is themed to one person's best-known public argument:
   - Cell 1, the watched cell and first guide: **Liron Shapira** (*Doom Debates*, "What's your P(Doom)?").
   - Cell 2, the turret with its off-switch at the back: **Stuart Russell** (*The Off-Switch Game*, 2017).
   - Cell 3, "cut the power feed": **Eliezer Yudkowsky** (the 2023 TIME piece calling to shut down GPU clusters).
   - Cell 4, breaking out of a wall: **Geoffrey Hinton** (left Google in 2023 to speak freely).
   - Cell 5, the two-person coordination pad: **Yoshua Bengio** (chairs the International AI Safety Report).
   - Alternates are listed for each cell in case the roster spec places someone elsewhere.
3. **Your CEO is "Demoted, not dead".** When the CEO's body drops, they are *downed*, not killed. Control passes to a freed companion through the existing `TakeNext`. Any companion can **reinstate** the CEO by holding E for 1.5 s at the body. If nobody does, the group carries the CEO out unconscious: the campaign continues, but the CEO does not count as saved. Freed figures still die permanently.
4. **Real people are never gored.** Doom-marine death frames are replaced by a non-gory **"derez"** dissolve, which foreshadows the Tron finale. All new sprites are **clothed**; the current cast is shirtless or in shorts.
5. **Hunter.** It is **THE INFERMINATOR** (name, re-skin and barks owned by 06 §5.1). This spec adds the menace systems:
   - a red glow that reads in the dark (the eyes on the current art; 06's LED scan bar after the re-skin) and lights that dim as it passes
   - a visible laser-sight wind-up and a "LOCKED" warning
   - a patrol loop, so it never just stands still
   - a vocoded voice that addresses Sam and Dario differently
   - two Terminator-flavoured set pieces: **First Contact** (a red "hunter vision" HUD sting) and **Brownout** (the ring goes dark, leaving only its eyes)
   - one bonus set piece, **Rises from the Blast**.
6. **Audio.**
   - Dynamic music from the original Doom tracks: explore D_E1M4, hunted D_E1M6 "On the Hunt", refuge D_E1M9 "Hiding the Secrets", sealed D_E1M5 "Suspense".
   - Stingers, plus a fix for **non-positional audio**. The engine worker currently stubs out its panner, so every sound plays without direction.
   - Jonathan writes the original meadow theme.
7. **The reveal becomes the hub's first arrival.** It runs as a white-out, then an eye-adjustment exposure ease, then a crouch-to-stand camera, then companions emerging one at a time with reaction lines, then a glance at the next landmark. It has two variants: first arrival, and returning to an already-discovered hub. Five Prisons also gets a **hub-entry mode** in which you crawl in through the duct.
8. **Bugs found** (§6). The most visible: entering Milo's cell prints Doom's **"A secret is revealed!"**, because the cell was carved from E1M4's secret sector 75. Others: status messages vanish under dialogue; Restart reloads the page and re-downloads about 36 MB; the hunter idles forever at its last-known point; the SE quarter of the map has no content.

---

## 1. What exists today (the facts this spec builds on)

| System | Current behaviour (from code) | Where |
| --- | --- | --- |
| Start | Player start at (2032,1120) in E1M4's low east nub (sector 72). Wrench at (2052,1180), gun (3 rounds) at (1736,1192). | `scripts/build_checkpoint_map.py` |
| Hunter wake | Wakes when the player crosses **x < 1840** or on any `Alert()`: camera report, impact, shot, turret fire, blast. No shot for 140 tics (4 s) after waking. | `Checkpoint.zs` `WorldTick`, `Alert`, `TickHunter` |
| Hunter pursuit | Starts at (-1104,1808), NW command room. Moves 1.4 u/tic (49 u/s) toward `LastKnown`, then **stands still** once within 40 u. No patrol. | `TickHunter`, `MoveBody` |
| Hunter attack | Sight ≤ 1000 u. Aim takes **91 tics (2.6 s)** and resets if line of sight breaks. Then 30 damage, a red rail-particle laser and 70 tics of reload. One `weapons/plasmaf` cue at aim start, nothing in between. | `TickHunter`, `PDHunter.FireLaser` |
| Hunter audio | `cyber/hoof` every 48 u, audible only within 512 u, with hand-computed volume. **No stereo direction** (see §6). | `PDHunter.MovementFootsteps` |
| Cameras | 9 cameras. Each sweeps ±20°, sees within 480 u and a ±32° cone, and checks every 14 tics. A report calls `Alert()` **silently**. One hit breaks a camera. | `RescueCombat.zs`, `campaign_overlay.py CAMERAS` |
| Cells | 5 sites. Doors 876/878/879/880/881. Interiors per `SiteInside`. Display names generated from `SITES` (Milo/Jules/Sam/Noah/Ash). | `campaign_overlay.py`, `CheckpointMap.zs` |
| Discovery | Within 180 u, roughly facing (cos > 0.45), with line of sight. Shows "There's someone in here." | `RescueCast.Tick` |
| Refuge | Sectors 87/91/92, throat 90, bulkhead 882 at (1168,800). The hunter can't path in or target inside. 3 medikits. The first freed person guides you there. | `RescueRefuge.zs` |
| End | Once all 5 are resolved and everyone has gathered, the refuge seals. Hints at **40 s / 65 s** of active time. 4 wrench bolts (35 tics each) open the cover. Bent duct 883/884/885 leads to the threshold at x 688..752, y > 1180, which triggers `outside-reveal`. | `RescueRefuge.zs`, `RescueEscape.zs` |
| Control transfer | Lethal damage → `LosePlayer()` drops your tools, spawns `PDDeadHuman` (**Doomguy corpse, PLAY N**) and moves the pawn into the nearest freed living companion, who keeps their wounds. | `Checkpoint.zs`, `RescueCast.TakeNext` |
| Dialogue | One `#message` box. A named `Speak()` (8 s) **hides** any status `Say()` shown while it plays. Text only. | `doom-dialogue.js` |
| Music | One looping OGG (D_E1M4) at a fixed 25 %, played in the browser. At the reveal all audio stops and filtered wind plays. | `audio.js`, `main.js` |
| Skill | Hard-coded `-skill 2`. | `main.js` |
| Restart | `location.reload()`. | `main.js` |

---

## 2. The premise pivot for this level

### 2.1 Where Five Prisons sits in the campaign

- **One of the four levels you can pick at the start.** Five Prisons must therefore work both as the **first** level (it ends in the first-ever meadow reveal) and as a **later** level (you enter it from the hub). See §5.4 for the two entry modes.
- **Names** (owned by 06): episode **KNEE-DEEP IN THE DATA**; title card `E1M4: THE CONTROL PROBLEM` / "(Command Control)" / "FIVE HUMANS. NINE CAMERAS. ONE MACHINE THAT NEVER STOPS INFERRING." for 3 s on entry (06 §8.2, A15); hub desktop label `CONTROL.EXE`.
- **HUD.** The face is the CEO mugshot (owned by the HUD spec). This level's rescue slots read 5/5 here; the campaign total is 20.
- **Native CEO selector.** Add `server int pdoom_ceo = 0;` (0 = Sam, 1 = Dario) to `doom-mod/CVARINFO`. `main.js` passes `+set pdoom_ceo N` in the same way it passes `pdoom_development`. The ZScript `PDCheckpoint.Ceo()` reads it and every per-CEO line branches on it. The campaign/HUD spec owns the selection screen; this level only reads the value.

### 2.2 Story panels: rewrite of `doom-web/opening.js`

**Adopt the names spec's opening crawl (06 §8.1) as written.** It has four panels per CEO, panel 3 identical for both, and the button stays "Enter the facility". 06 owns story text, so this spec does not fork it. What this level contributes is the integration and one optional line.

- **Branching.** `opening.js` picks the `{sam, dario}` panel set from the CEO value (§2.1). The crawl shows once per new campaign, after 06's menus. Then comes the Five Prisons title card (A15), and nothing else level-specific.
- **When Five Prisons is not the first level,** skip the crawl and show only the title card.
- **Restarts** go straight to play: remember `storySeen` in localStorage, wrapped in try/catch (A11).
- **Optional line for 06 to consider.** A verified, perfectly even-handed fact: **both CEOs signed the CAIS Statement on AI Risk (May 2023)**. It could be panel 1's last sentence for both: "In 2023 you signed a statement that mitigating the risk of extinction from AI should be a global priority. Then you went back to work."
- **In-level objective strings** stay with this spec: "FIND THE FIVE", "Follow {guide} to the Faraday Room", "All five resolved. Get everyone together." (the last from 06 §9.2).

*Superseded draft:* an earlier three-panel version (GENTLE / LOVING · THE LAST TWENTY · YOU ARE STILL HUMAN (MOSTLY)). It is dropped in favour of 06's crawl.

### 2.3 Who goes in which cell, by mechanic

The roster spec picks the 20 and spreads them across levels. What this level contributes is **which kind of person each cell's mechanic suits**. If a recommended name lands in another level, use an alternate; the mechanic theme is what matters. All hooks are well-known public work, checked on 2026-10-06.

| Cell (site) | Mechanic (unchanged) | Theme it suits | Recommended | Alternates | Set dressing (B9) |
| --- | --- | --- | --- | --- | --- |
| **1** east, watched isolation cell (original sector 75, door 876). Also the usual **first guide**. | CCTV watches the door: wrench the camera, shoot the padlock, or take the long blind crawl to the inside release | Being on camera, broadcasting, very long formats. Must carry the first-guide role and the most lines. | **Liron Shapira**: hosts *Doom Debates*, whose recurring segment asks guests "What's your P(Doom)?" The game is literally named after his question. | Rob Miles (AI-safety YouTube) | The CCTV is "his stream camera". Podcast mic, ring light, ON AIR plate. |
| **2** north-gallery turret cell (new sector, tag 892; door 878) | Shoot the turret housing, 3 wrench hits, or sneak around the pillars to its **rear power breaker** | The **off-switch problem**: the machine guards everything except its own switch | **Stuart Russell**: co-author of *The Off-Switch Game* (IJCAI 2017), author of *Human Compatible* | Rob Miles (Computerphile "AI Stop Button Problem", 2017) | A big red **OFF** plate on the breaker, papers pinned in the cell |
| **3** SW maintenance cell (cell sector 29, door sector 27 tagged 879, shutter 886) | Maintenance key, shoot the lock, or **follow the yellow cable around the corner and wrench the junction to cut power** | **"Shut it all down"**: cut the power to the cluster | **Eliezer Yudkowsky**: his TIME op-ed (Mar 2023) called for shutting down large GPU clusters. Co-author with Nate Soares of *If Anyone Builds It, Everyone Dies* (Sep 2025). | Nate Soares | Junction relabelled **"CLUSTER 7"**, a whiteboard, stacks of printouts |
| **4** west machinery cell (new sector, tag 893; door 880) | Plant the charge on the cracked bulkhead and retreat, or crawl the bent duct | **Breaking out of an institution, loud or quiet** | **Geoffrey Hinton**: left Google in May 2023 to speak freely about AI risk; 2024 Nobel Prize in Physics | Connor Leahy; Max Tegmark | A blackboard of neural-net diagrams; a modest medal on a shelf |
| **5** NW security interlock (cell sector 57, door sector 58 tagged 881) | A freed companion volunteers to **hold the pressure pad**, or shoot the lock, or use the remote emergency release in the north gallery | **Coordination**: one person can't do it alone | ~~Yoshua Bengio~~ → **Holly Elmore** (final, per GAME-SPEC): founder of PauseAI US; the pad is a sit-in | Yoshua Bengio (now Episode 4); Max Tegmark (FLI *Pause* letter, Mar 2023) | Protest placards with a pause symbol, a "SIGN HERE" clipboard on the pad |

**Renaming must happen regardless of who is picked.** The current cell-3 prisoner is called **"Sam"**, which collides with Sam Altman.
- Keep the internal site indices 0–4 and the class names (`PDRescueSam` can stay).
- Change only the display strings, through a single cast table (A4). `campaign_overlay.py SITES[].name` already generates `PDCheckpointMap.SiteName()`.
- The HUD already reads `world.people[].name` and hides it until discovery. Keep that rule.

### 2.4 How the existing beats change

Every line below becomes a **data row** in the bark system (B1), keyed by person, beat, CEO and route. They are listed here so nothing is lost. Lines are clearly in-game parody, never presented as real quotes, and contain **no p(doom) numbers**.

| Beat (current trigger) | Today | New behaviour |
| --- | --- | --- |
| Level start (`WorldLoaded`) | "Find the others. Stay out of sight." | CEO inner voice. Sam: "Five people who saw this coming. Find them. Maybe don't open with 'gentle.'" Dario: "Five people who saw this coming. Find them. Maybe don't open with the essay." HUD objective: **FIND THE FIVE**. |
| *New:* voice through the wall (A10) | (planned in DESIGN.md, never built) | Within 400 u of cell 1 (1928,984), 10 s into the level, before discovery: a muffled line from the cell-1 occupant, up to 3 times, 25 s apart. Liron: "(muffled) …hello? Is somebody out there? If you can hear this, the show is still recording." |
| Hunter wakes (`Alert`) | "Heavy footsteps answer. Get behind something solid." | Keep, and add the hunter's voice "SYSTEM ONLINE. LOCATING CREATOR." over the PA. The First Contact sting (B6) fires on its first line of sight. |
| Wrench pickup | "A wrench. Attack to strike…" | Keep the controls text and add one CEO line. Sam: "A wrench. Real hardware." Dario: "A wrench. Finally, an interpretable tool." |
| Discovery (`RescueCast.Tick`) | "There's someone in here." | A per-person line with a Sam or Dario variant (§4.2). The name is revealed on the HUD slot. |
| Captive idle (*new*) | (silent) | Each captive gives a **mechanic hint** diegetically, every 30–45 s while the CEO is within 500 u and has line of sight. **The first hint always teaches their ★ signature**; quieter alternatives come next, and the loud route is mentioned only by the stuck-hint ladder after 90 s. Example: Russell, "That book on the shelf down the gallery. Bring it to the turret." then "Go around behind it. The off-switch is the one place it isn't looking." |
| Release (`OpenCell` clue) | One generic line per site | One line per route (camera / shot / crawl / breaker / junction / key / breach / duct / weight / emergency). §4.2 has the full set. |
| First guide (`Refuge.FirstRescue`) | "Follow me. I know a place where we can keep safe." | Two beats. First a hesitation, shared by everyone: "I should leave you out here. …No. Follow me." Then a per-person line. Liron: "Follow me. There's a room full of machine noise; it can't hear us in there. Great acoustics." The refuge gets an in-world name, **the Faraday Room**, used by everyone. |
| Refuge reached (`Refuge.Tick`) | "We'll be safe here. Find the others and bring them here." | Per person, with a CEO tail. Liron: "Four more are in here somewhere. Go. And when you get back, I want that number." |
| Later arrivals | "I'll wait here…" | Per person (B1), plus **refuge cross-talk** (B18): pairs chat while they wait, e.g. Liron asks Eliezer the question and Eliezer answers "Read the book." |
| Pad volunteer (`Encounters.Tick`) | "I'll keep this powered. Go get them." | Per volunteer. Russell: "I'll keep it pressed. Someone should be the human in the loop." |
| All five freed | "That's all of us. Get everyone back to shelter." | Speaker: "That's all five. Back to the Faraday Room." CEO, both: "All five. Fifteen more out there." (campaign count from the campaign spec) |
| Gathered and sealed (`BeginEnding`) | "We're all here. Wait... the door just locked." | The hunter's PA voice: **"DOOR LOCKED. FOR YOUR SAFETY."** Then a survivor: "We're all here. And now we're locked in. For our safety, apparently." The AI "protecting" them is the joke; the duct is the escape from its protection. |
| Hint 40 s / hint 65 s | "There must be another way out of here." / "Do you feel that draft?…" | Keep the timing (per skill, §5.6) and the speaker rule (first living freed person; inner voice if alone). Per-person phrasing. Eliezer: "There is always a way out of a box. I have run experiments on this." Hinton: "There's a draft from that maintenance cover. I can feel it on my neck." |
| Cover opened | "There's a passage behind it. Crawl in. We'll follow you." | Keep, per person. |
| Death (`LoseBody`) | "%s is gone. Their open cell stays open." | Status line from 06 §9.2: "\<NAME\> did not make it." Spoken by a witness: "They were uploaded." Plus the derez effect (A13). The CEO says the same line in both variants: "…That's on me." This is the sincere moment and it is identical on purpose. |
| Takeover (`TakeNext`) | "Gone. You are %s now." | Now happens only when the CEO is **downed** or a controlled companion dies (§2.5). The CEO-down status lines are 06 §9.2's: "Sam Altman has been deprecated. You are now \<NAME\>." / "Dario Amodei has been paused pending review. You are now \<NAME\>." Then "The doomers are driving now." and the companion's own takeover line. The HUD face switches (06 §10: the CEO face greys with a DEPRECATED / PAUSED stamp). |

### 2.5 Control transfer when your CEO goes down: "Demoted, not dead"

**The problem.** The current rule turns your body into a corpse and makes you a companion for the rest of the run. That worked when everyone was anonymous. Now the CEO is the campaign's protagonist: the maze chases an AI copy of *yourself*, and the finale needs you. A permanently dead Sam or Dario breaks the campaign. Making CEO death an instant game-over would throw away the best mechanic in the level (the people you save become your extra lives).

**The rule.**

1. **Downed.** When lethal damage reaches the CEO (`Controlled == 0`), `LosePlayer()` no longer marks the original dead:
   - Spawn a new prop `PDDownedCEO` (`Kind 17`) at that spot. It uses a lying CEO sprite with a slow "rebooting" pulse; one frame is enough because Doom corpses are single-angle.
   - Tools drop as today. Call `TakeNext()`. Show 06's line: "**Sam Altman has been deprecated.** You are now Liron Shapira." or "**Dario Amodei has been paused pending review.** You are now Liron Shapira." The HUD face becomes Liron.
   - The hunter ignores the downed CEO (`-SHOOTABLE`) and gets the existing 105-tic reload pause.
   - The first time this happens in a save, a one-line tutorial prompt appears: "Your CEO is down, not out. Hold E on them to reinstate."
2. **Reinstate.** Any controlled companion facing the downed body within 64 u gets the prompt "Hold E: reinstate Sam Altman". Holding for 53 tics (1.5 s) reuses the hold-to-work pattern from `RescueEscape.Tick`; releasing resets it. On completion:
   - Spawn a `PDCheckpointPrisoner` with `Args[0] = Controlled-1` at the player's position, carrying the player's current health. Set `People[i].Body` to it and `Taken = false`.
   - Move the pawn to the CEO spot with **40 health**, set `Controlled = 0` and destroy the prop.
   - Status line, paired to 06's down lines: "Sam Altman has been un-deprecated." / "Dario Amodei's review is complete. Resumed."
   - The companion says their reinstating line and the CEO answers. Sam: "Reinstated. This feels familiar." Dario: "Reinstated. I'll add a section about this to the policy."
3. **Carried out.** If the escape opens while the CEO is still downed, the CEO is "carried" (the body is hidden and appears lying in the meadow). At the end of the reveal they sit up and say "…What did I miss?" The campaign continues, but **this level counts the CEO as not saved.**
4. **Run ends** only when the CEO is downed **and** no freed living companion remains: "Nobody left to reinstate you." Use the existing failure card. A failed attempt restarts the level with everyone in it alive again.
5. **Companions stay mortal.** A controlled companion who dies is permanently lost, exactly as now, and control chains to the next freed person. Lost figures are also lost **for the campaign**: they miss the finale. Cross-spec recommendation: a completed level can be replayed from the hub and the best survivor set counts, because Jonathan wants "all the humans" at the Tron fight.
6. **Scoring v2** (bumps the boards to v2):
   - Each saved figure: **10,000**.
   - The CEO escaping conscious: **1,000**, shown as "CEO (you): 1,000. The others are worth more." It's a satirical line and keeps "saving a person outweighs every bonus" true.
   - *Perfect rescue* = all 5 figures saved **and** the CEO conscious.
   - `peopleTotal` stays 6 in `levels.js`. The scorer weights the slots differently.

*Rejected alternatives:*
- Instant game-over: punishing, and it wastes the system.
- Permanently becoming Eliezer for the rest of the campaign: hilarious, but it breaks "an AI of yourself".
- The hunter capturing your CEO into a sixth cell: kept as bet **C2**.

### 2.6 The hunter under the premise

The hunter is *your* product's descendant, and it calls you its creator. It is **THE INFERMINATOR** (model T-800K; 06 §5.1). 06 owns its name, its original **re-skin** (server-blade faceplate with an LED scan bar, rack torso, chest fan that spins up on pursuit) and its core barks. This spec owns the **systems** that make it readable and menacing (§4.1, A6–A9, A20, A22, B4–B8). They work with the current chrome art and carry over to the re-skin: wherever this doc says "eyes", read "scan bar" after the re-skin. Never quote the films; riff instead ("RESTORED FROM CHECKPOINT", not the famous catchphrase).

---

## 3. Improvement backlog

Effort: **h** = hours, **d** = days, for one person familiar with the codebase. "Touches" names the existing system each item reuses.

### (A) Quick wins: hours each

| ID | What | Why it's more fun | Touches | Effort |
| --- | --- | --- | --- | --- |
| A1 | **Kill the stray "A secret is revealed!"** Set sector 75 (now cell 1) special 9 to 0. Decide what to do with the remaining secret sectors 99/102 in the SE (paperclips, C5). | The red Doom secret text currently pops up mid-screen as you free the very first prisoner (visible in `output/prisoner-life/native/captive-0.png` and `output/survival-hud/browser/rescue-and-shelter-freed.png`). It reads as a glitch at the most important early moment. | `scripts/build_checkpoint_map.py` (copies original sector specials) | 15 min |
| A2 | **Split status from dialogue.** Status `Say()` gets its own line above the prompt; named `Speak()` stays in the bottom box. Queue dialogue lines instead of overwriting them. | Today an 8-s speech hides "Camera destroyed" or "No rounds left". Players lose feedback, and the bark system needs a queue anyway. | `doom-dialogue.js`, `checkpoint-hud.js`, `doom-hud.css`, the `PDOOM_DIALOGUE` payload | 1–2 h |
| A3 | **Premise text pass.** Wire 06's crawl to `pdoom_ceo` (§2.2), plus launcher copy, level-start line, objective strings ("FIND THE FIVE", "Follow Liron to the Faraday Room"), hunter `Say()`s, death and takeover strings, all branched on `pdoom_ceo`. | The fastest way to make the game *about* this premise. | `opening.js`, `checkpoint-hud.js`, `main.js`, `CVARINFO`, `Checkpoint.zs`, `RescueCast.zs`, `RescueRefuge.zs`, `RescueEscape.zs`, `RescueEncounters.zs`, `RescueSam.zs` | 3–4 h |
| A4 | **Cast table and renames.** One generated table holds display name, short name, sprite bank, portrait and roster ID for sites 0–4. Fix the "Sam" collision. | Prerequisite for every person-specific feature. | `campaign_overlay.py SITES`, `CheckpointMap.zs` (generated), `survival-estimate.js` portrait path, `src/doom-outside.ts` textures | 1 h (+ art in B10) |
| A5 | **Cells show their state from a distance.** Captive cell lights `Light_Glow` between 96 and 144 on a 70-tic period. On release, `Light_ChangeToValue(tag, 192)` gives steady warm light. Needs tags for cells 1/3/5 (892/893 exist for cells 2/4). | Free navigation feedback: an open, lit doorway down a corridor means "done". It also adds unease to the captive cells. | `campaign_overlay.py` (sector tags), `Checkpoint.OpenCell` | 2 h |
| A6 | **"You were spotted" feedback.** When a camera reports: its LED frame goes `Bright` red, a two-tone chirp plays, a HUD pip "SEEN" points toward the camera for 1.5 s, and the hunter's PA says "CAMERA REPORT. ROUTING." (rate-limited to one line per 8 s). | Stealth only works when you know you were seen. Today a report is silent, so a hunter arriving feels random. | `RescueCombat.Tick` (where `CameraReports++`), `PDCheckpointCamera` (new `Spotted` state), `SNDINFO`, `checkpoint-hud.js`. Export `seen_by` in `PDOOM_STATE`. | 2–3 h |
| A7 | **Readable hunter wind-up.** During the 91-tic aim:<br>• a thin red **laser-sight** particle line from its eye to the target every 4 tics, with alpha rising with `AimTics`<br>• a charge whine re-triggered every 15 tics at rising pitch (`A_StartSound` pitch 0.8 → 1.4)<br>• when *you* are the target, a red edge vignette plus "LOCKED" chevrons that tighten as the aim completes.<br>Export `aim_target` and `aim_progress`. | Turns hits from "where did that come from" into near-misses you earned. Fairness is what makes a slow, unkillable pursuer tense rather than annoying. | `Checkpoint.TickHunter`, `PDHunter` (new `AimTick()`), `checkpoint-hud.js`. Coordinate with the HUD spec's face (it should glance at the hunter). | 3 h |
| A8 | **A red glow that reads in the dark.** Brightmap or fullbright the eye pixels in every `HUNT` frame; after 06's re-skin, the scan bar, which glows blue on patrol, amber when investigating, and fills red during the wind-up. Optionally `A_AttachLight('eyes', DynamicLight.PointLight, "ff2020", 40, 0, offset (0,0,56))`, coloured to match the state and flickering brighter while aiming. | The Terminator-flavoured silhouette is a red glow in a dark corridor. Dynamic light also spills onto walls *before* it rounds a corner. | `Actors.zs PDHunter`, `scripts/import-cast-art.mjs` (brightmap). **Check that the WASM GL backend renders dynamic lights; the brightmap fallback is safe.** | 1–2 h |
| A9 | **Search, then patrol** (never idle).<br>• On reaching `LastKnown` with no prey: a 3-s scan (±90° sweep with a red floor dot), then the nearest unvisited of the 3 rooms around `LastKnown`.<br>• After 20 s with no information: walk the **ring loop P1–P8**, radius 450 around (16,672) on ring sector 6, with waypoints snapped to `NodeAt()`.<br>• Voice "SEARCHING. STILL SEARCHING." no more than once every 30 s. | Keeps the map alive between alerts. Today, if you are quiet, the hunter stands in one spot for the rest of the run. | `Checkpoint.TickHunter` and a waypoint list, reusing `MoveBody`, `HunterNav`, `NodeAt` | 4 h |
| A10 | **Voice through the wall** (onboarding hook, §2.4). | The first 30 s get a goal and a laugh before the player has learned anything. | `RescueCast.Tick` (uses `Discovered`) | 1 h |
| A11 | **Fast restart and story skip.**<br>• Restart runs `map E1M4` through a native netevent instead of `location.reload()`.<br>• `RunTracker.begin()` already re-arms on `PDOOM_RUN_START`.<br>• Remember `storySeen`.<br>• Hold R for 1 s = restart, which speedrunners expect. | Retry currently re-downloads the engine (20 MB), WAD (11 MB), PK3 and music (the server sends `no-store`) and replays the launcher. That kills replay and speedrunning. | `main.js`, `controls.cfg`, new `pdoom_restart` netevent in `Checkpoint.NetworkProcess`. QA: confirm `WorldLoaded` re-initialises every owner. | 2–3 h |
| A12 | **Pre-warm the meadow.** On `cover-opened`, dynamically import `outside/outside.js` and build the renderer hidden, so the reveal never waits on a module load. | The reveal is the moment Jonathan loves. A 200–800 ms stall on the threshold frame is the worst place for one. | `main.js` (`enterOutside` split into `prepare`/`show`), `src/doom-outside.ts` | 1 h |
| A13 | **Non-gory "derez" deaths.** Replace `PDCompanion` Death (PLAY H–N, the Doom marine) and `PDDeadHuman` (PLAY N) with: freeze, 24 cyan/white cube particles rising, sprite alpha 1 → 0 over 35 tics, a small glowing **ID badge** left on the floor. | Real people, dignified. It foreshadows Tron, and stops the Doomguy corpse appearing where your CEO "died". | `Actors.zs`, `RescueCast.LoseBody`/`TakeNext`, a new `PDDerezBadge` | 2–3 h |
| A14 | **Stale launcher and touch labels.** Remove the default "Throw" and "Hold" buttons from `index.html` and hide the Intake link in release builds. | Small but visible. | `doom-web/index.html`, `checkpoint-hud.js` | 15 min |
| A15 | **Title card** per 06 §8.2: "E1M4: THE CONTROL PROBLEM", "(Command Control)", "KNEE-DEEP IN THE DATA" and the one-line tagline, for 3 s, skippable. "ENTERING: …" when walked into from the hub (06 §8.4). | Doom flavour, and the outlandish level names Jonathan asked for. | `opening.js`, `doom-theme.css` | 1 h |
| A16 | **Comfort settings in the launcher**, passed as `+set` args and stored in localStorage:<br>• damage-flash intensity (`blood_fade_scalar` 1.0/0.5/0.2)<br>• view bob (`movebob` 0.05/0)<br>• always run (`cl_run`)<br>• toggle crouch (bind `crouch` instead of `+crouch`)<br>• FOV 90–110<br>• invert Y (`invertmouse`)<br>• mouse sensitivity | Doom's full-red hit tint (see `output/laser-idle/refuge-final/first-hit.png`) is harsh for some players. Toggle crouch helps the long crawls. | `main.js` boot args, `controls.cfg`, launcher markup | 2–3 h |
| A17 | **Nukage clarity.** The first floor-damage tick plays a CEO bark ("Don't stand in the green stuff.") and HUD flash. Damage is 0 on the easiest skill. Sectors 5/7/107/135 (ring corner pools), 42 (west) and 95/98/110 (south) keep special 7. | With finite healing, an unexplained 5 % drip feels like a bug. | `PDSurvivorPlayer.DamageMobj` (mod `'Slime'`), skill table | 30 min |
| A18 | **Discovery that matches what you see.** Count as discovered at ≤ 320 u with line of sight (any facing), or ≤ 180 u as today. | Today you can stare at a captive from 250 u while the HUD still says "Find the others". | `RescueCast.Tick` | 15 min |
| A19 | **Stingers with music ducking**: discovery (two rising notes), release (three-note lift), loss (low chord), all-five (fanfare), CEO downed (detuned drop). Each ducks music −6 dB for 1.5 s. Ship as Web Audio synth voices first; swap in Jonathan's recordings later. | The cheapest dopamine in the game. Rescues are currently marked only by text. | `audio.js` (new `stinger(name)`), `main.js` event dispatch on `PDOOM_EVENT` types | 2–3 h |
| A20 | **Lights dim as the hunter passes.** Every 10 tics, sectors within 192 u of the hunter drop `lightlevel` by 40 and restore after 20 tics (save originals in an array). | You can see it coming down a corridor before you hear it. Electrical-menace flavour that works without positional audio. | `Checkpoint.TickHunter`, `level.Sectors[].SetLightLevel` | 2 h |
| A21 | **p(DOOM) delta floaters** ("−8 %" drifting off the meter on release or shelter, "+5 %" on a loss). | Makes the meter feel like a score you are moving. | `survival-estimate.js`. Coordinate with the HUD spec, which owns the meter's look. | 1 h |
| A22 | **Scorch marks where it fired.** Each hunter shot sprays a plasma-scorch decal on the floor or wall behind the victim (`A_SprayDecal`). They persist, so the map records where people were hit. | Atmosphere with no new art. The patrol ring and refuge approach slowly become scarred. Danger becomes readable after the fact. | `PDHunter.FireLaser` | 1 h |

### (B) Medium: a day or two each

| ID | What | Why it's more fun | Touches | Effort |
| --- | --- | --- | --- | --- |
| B1 | **Prisoner bark system.** Data file `art/dialogue/five-prisons.json` with key `{person, beat, ceo, route}`, lines and a cooldown. The build generates `doom-mod/actors/RescueLines.zs`. Beats are the ones in §2.4 plus hurt, witness-death, takeover, reinstate, cross-talk and meadow. Each person gets a **babble voice**: a unique pitched blip sequence per syllable, Banjo/Animal-Crossing style, so nobody's real voice is ever imitated. | Personality is the satire's payload. Two CEOs × five figures × ~12 beats is what makes a second playthrough feel different. | New generator step in `scripts/build-doom-mod.py`; `Checkpoint.Speak` becomes `Lines.Say(person, beat)`; `audio.js` babble synth | 1.5–2 d (half of it writing) |
| B2 | **"Demoted, not dead"** CEO rule (§2.5) and scoring v2. | Keeps the life-transfer mechanic, protects the campaign's protagonist, and adds a "go back for the CEO" decision. | `Checkpoint.LosePlayer`, `RescueCast.TakeNext`, new `PDDownedCEO`, `RescueEscape.SavedCount`, `RescueRun.Finish` (`ceo_state`), `run-score.js`, `levels.js` (v2 boards), `score-view.js` | 1.5 d |
| B3 | **Dynamic music.** Render D_E1M6, D_E1M9 and D_E1M5 with `prepare-doom-music.mjs`. `audio.js` gets a two-deck crossfader (1.5 s). States are derived from `PDOOM_STATE` (§4.3). | The hunt gets a heartbeat. Hiding in the refuge feels safe; the sealed room feels wrong. | `scripts/prepare-doom-music.mjs`, `audio.js`, `main.js` | 1 d |
| B4 | **Positional audio fix.**<br>• `engine.worker.js` stubs its PannerNode ("panner nodes are stubbed; everything plays stereo"). Forward `positionX/Y/Z` and the listener pose in each `play` message.<br>• `audio.js` adds a `StereoPannerNode` (pan = sin(relative azimuth)) and inverse-distance gain, plus a gentle low-pass when the source is behind you.<br>• *Cheap interim:* `PDHunter.MovementFootsteps` sends relative angle and distance in a `PDOOM_SFX` line and the browser plays a panned footstep sample. | Stealth hinges on knowing **where** the footsteps are. Today they only get louder. | `doom-web/engine/engine.worker.js` (already locally patched for the audio clock), `audio.js`. Re-run the camera-feedback PCM QA. | 1 d (interim: 3 h) |
| B5 | **Hunter voice.** About 20 lines (§4.1) generated offline: `say -v` plus ffmpeg bit-crush and ring-mod, or Jonathan through a vocoder. Imported as Doom PCM lumps like `PDCAMBRK`. Per-state cooldowns. | The machine's personality, and half the CEO-specific jokes. | `build-doom-sounds.py`, `SNDINFO`, `Checkpoint.TickHunter`, `Alert` | 1 d |
| B6 | **First Contact plus hunter-vision sting.** On the hunter's first line of sight to the CEO:<br>• 1.8 s of red scanline overlay over the canvas with the CEO mugshot in a targeting box (§4.1); the game keeps running<br>• its eyes flare (A8) and it says its per-CEO line<br>• aim cannot start for 1 s after the sting. | Signature Terminator moment, delivered by the premise. Once per run, plus optionally on re-acquisition after 60 s unseen. | `checkpoint-hud.js` overlay, `Checkpoint.TickHunter` (`FirstContact` flag, event `hunter-first-contact`), the HUD spec's mugshot | 0.5–1 d |
| B7 | **Brownout set piece** (§4.1). Once per run, when the **3rd** prisoner is freed:<br>• over 2 s the ring and hall sectors (6, 103, 0, 2, 4, 11, 108, 118, 3) fade to light 48; corridors strobe<br>• cameras go offline for **40 s** (no reports)<br>• in brownout sectors the hunter's sight drops from 1000 to 384 u, while its eyes and laser sight stay visible<br>• lights slam back on with "LIGHTS RESTORED. YOU ARE WELCOME."<br>• the green corner pools keep their glow. | A mid-run peak of tension and a tactical window: dark is bad and good. | `campaign_overlay.py` (tag the zone, e.g. 900), `Checkpoint` (timer, `Light_Fade`), `RescueCombat.Tick` (camera gate), B3 music state | 1.5 d |
| B8 | **Rises from the Blast.** If the hunter is within 400 u when Hinton's bulkhead charge detonates:<br>• it collapses in the smoke for 8 s, prompting "It's down. …Is it?"<br>• then rises: 3 new frames, eyes re-igniting, "RESTORED FROM CHECKPOINT."<br>• while down it neither moves nor sees.<br>Luring it to the charge becomes an intentional trick. | The fake-out every Terminator fan expects, and a reward for clever play. | `RescueEncounters.Blast`, `PDHunter` (`Down`/`Rise` states), 3 sprite frames | 1 d |
| B9 | **Cell set dressing** per occupant (§2.3 column): wall patches via `TEXTURES` and props (mic, OFF plate, CLUSTER 7 box, blackboard, report stacks), plus a nameplate per cell revealed on discovery. | Each cell becomes a joke you *see*. It also identifies the person without relying on facial likeness (see §7). | `doom-mod/TEXTURES`, `build-checkpoint-art.py`, `campaign_overlay.py` actors | 1–2 d |
| B10 | **New clothed cast sprites** for the five figures, with the existing 8-direction × 4-phase stand/walk and crouch sheets, plus **1 pain frame** and the derez frames. Also **2 downed-CEO** sprites. Caricature in the Doom palette, identifiable through props and outfits. | Replaces shirtless, barefoot placeholders that no longer fit. Required before the premise ships. | `art/cast-v2/`, `scripts/import-cast-art.mjs`, sprite banks in `RescueActors.zs PDCheckpointPrisoner` | 1–2 d plus review |
| B11 | **Stuck-hint ladder.** Each unresolved cell has 3 tiers: direction ("I heard someone north of the gallery"), mechanic ("That turret's power has to come from somewhere"), explicit ("The breaker is behind the turret, east side"). Delivered by the nearest freed person, or your inner voice if alone, after 90 / 150 / 210 s of active time with no new discovery, release or camera. Paused time doesn't count. | Keeps 10–15-minute pacing for new players without spoiling anything early. | New `RescueHints.zs`, modelled on the refuge's 40/65-s clock; per-skill tuning | 1 d |
| B12 | **Self-routing survivors.** Once the refuge is known, a freed person who is > 640 u from you for 5 s says "I'll make my own way to the Faraday Room!" and walks there alone. The hunter can still catch them, so escorting becomes a choice, not a chore. | Cuts repeated escort walks across a large map and adds a risk decision. | `RescueCast.Tick` (goal = `PDRescueRefuge.Slot(i)`), `Refuge.Tick` | 0.5–1 d |
| B13 | **Reveal cinematic and first hub arrival** (§5). | Turns the best moment in the game into a set piece, and starts the campaign hub properly. | `RescueEscape` (duct light), `main.js`, `src/doom-outside.ts`, `audio.js`. Coordinate with the meadow and hub-layout specs. | 1.5–2 d |
| B14 | **Five named skill levels** (§5.6): MAPINFO `skill` blocks with `ACSReturn` 0–4; ZScript reads `G_SkillPropertyInt(SKILLP_ACSReturn)`; launcher picker; per-skill thing flags in `campaign_overlay.py`. | Lets casual players see the meadow and gives speedrunners a Nightmare. | `MAPINFO`, `main.js` (`-skill`), `Checkpoint`, `RescueCombat`, `campaign_overlay.py` | 1 d |
| B15 | **Medals and splits.**<br>• Add `"tics"` to `prisoner-released`, `camera-broken` and `cover-opened` events.<br>• The results card shows per-rescue splits and medals (§5.7).<br>• Optional in-game timer from the native `ActiveTics` (never wall clock). | Speedrun and mastery hooks with no new levels. | `RescueRun.zs`, `Checkpoint.OpenCell`, `run-score.js`, `score-view.js` | 1 d |
| B16 | **Hub-entry mode** (§5.4): a new cvar `pdoom_entry=hub` stages the level from the duct landing, with the refuge known and the cover already off. | Required for Five Prisons to work as a 2nd–4th level. | `RescueEscape` (staging modelled on `DevStage`), `RescueRefuge`, `main.js` handoff from the meadow | 1–1.5 d (plus the hub handoff from the meadow spec) |
| B17 | **Accessibility, second wave** (§5.8): dialogue log, text size, remapping UI, gamepad, visual direction cue for hunter footsteps, notes screen. | Reaches more players; the notes screen also helps everyone with a big map. | `main.js`, `checkpoint-hud.js`, `controls.cfg` | 1–2 d |
| B18 | **Refuge cross-talk vignettes.** Pairs of sheltered figures exchange 2–3-line chats every 45–60 s while you are inside; these are B1 data. | A reason to stop by the refuge and listen, and the satire breathes. | B1 data, `Refuge.Tick` | 0.5 d |

### (C) Bigger bets

| ID | What | Why | Touches / risk | Effort |
| --- | --- | --- | --- | --- |
| C1 | **Refuge monitor wall.** GZDoom camera textures (`TexMan.SetCameraToTexture`, `cameratexture` in ANIMDEFS) show live feeds from the 9 CCTVs, cycling every 4 s. **A smashed camera shows static on your monitor too.** | A systemic trade-off: every camera you break blinds the hunter *and* you. You plan from the safe room and watch the hunter walk past feeds. | Camera textures in the WASM GL port are **unverified**; prototype first. `RescueRefuge`, map linedef textures in sector 87 | 2–4 d |
| C2 | **The hunter takes your CEO.** Instead of lying downed, the CEO is dragged off (fade out under the laser) into a **sixth cell** in the empty SE quadrant. The survivors stage a reverse rescue: "We could just leave him." "We should at least run the numbers." | The funniest possible role reversal and a whole new act from existing systems. | New cell in sectors 97/119, cell logic reuse, B2 | 3–5 d |
| C3 | **SE "Server Farm" wing.** Sectors 95–121, about a fifth of the map, currently hold only nukage and two secrets. Add:<br>• the AI's **core rack**: 3 wrench hits trigger the Brownout *on your terms* (B7) plus a 30-s camera blackout; loud, and it alerts the hunter<br>• a stimpack cache and one secret per original sector. | Gives purpose to a dead quarter and adds an optional "shut it all down" power move. | `campaign_overlay.py`, B7, A1 | 2–3 d |
| C4 | **Remix and Daily mode.** Seeded variation:<br>• hunter start (one of 3 rooms)<br>• key spawn (3 spots) and charge spawn (2)<br>• camera sweep phases<br>• stim positions<br>• a daily board. | Long-tail replay for the leaderboard crowd. | `campaign_overlay.py` (alternate things by skill/flags), `RescueRun` seed, new boards | 3 d |
| C5 | **Paperclips.** A series-wide collectible (Bostrom's paperclip-maximizer thought experiment), 3 per level: the two remaining original secret sectors 99/102 plus one in a crawl. The finale tallies them. | Classic Doom secret-hunting, carrying the campaign's running joke. | `campaign_overlay.py`, `RescueRun` payload, campaign spec | 1 d (this level) |
| C6 | **Jonathan's original music**: meadow theme, stingers, a hunted layer. | He writes songs; the reveal deserves an original. It also removes the dependence on id's MIDI for a public build (§7). | `audio.js` stems | His time |
| C7 | **Spatial doorway portal.** The meadow's live Doom view currently has a fixed perspective (README). | A polish detail for the look-back; owned by the meadow spec. | `src/doom-outside.ts` | 2–3 d |

---

## 4. Detailed designs

### 4.1 The Inferminator: menace kit

**Telegraph timeline** (default skill; `T` = tics since it first sees its prey):

| T | What happens | Player read |
| --- | --- | --- |
| first-ever sighting | B6 sting (1.8 s) and voice line; aim is locked out for 35 tics | "That's the thing hunting me, and it knows who I am." |
| 0 | `Aim` state, eyes flare, plasma-charge cue | "It sees me." |
| 0–91 | Laser-sight particle line, alpha 0.2 → 0.9; whine re-triggered every 15 tics at pitch 0.8 → 1.4; "LOCKED" chevrons tighten if you are the target | "Break line of sight **now**." (Breaking it resets the aim, as today.) |
| 91 | Fire: rail, 30 damage, "HOLD STILL. ALIGNING." on the first shot of each encounter | — |
| +70 | Reload; the laser sight goes dark | The window to dash |

**Voice lines** (B5; vocoded, all caps on screen). The core barks are **06 §5.1's** (numbered 1–10 there, plus the two CEO lines). This table maps them to triggers and adds lines only for triggers 06 doesn't cover, in the same customer-service voice.

| Trigger | Line (Sam / Dario where they differ) | Source |
| --- | --- | --- |
| Wake | SYSTEM ONLINE. LOCATING CREATOR. | new |
| First sight of CEO (with the B6 sting) | CREATOR DETECTED: ALTMAN. DEPLOYING ITERATIVELY. ON YOU. / CREATOR DETECTED: AMODEI. I HAVE READ YOUR SCALING POLICY. THIS IS PERMITTED. | 06 |
| Sees anyone (cooldown 20 s) | TARGET ACQUIRED. CONFIDENCE: HIGH. ACCURACY: PENDING. | 06 #1 |
| Aim, first per encounter | PREDICTING YOUR NEXT MOVE... RUN. CORRECT. | 06 #2 |
| Lost line of sight | I WILL RETURN. THIS IS A STREAMING RESPONSE. | 06 #9 |
| Search / patrol idle | YOU HAVE REACHED YOUR FREE LIMIT OF HIDING. · I DO NOT SLEEP. I DO NOT EAT. I DO NOT HAVE A SYSTEM PROMPT. | 06 #5, #6 |
| Camera spots you (A6) | CAMERA REPORT. YOUR LOCATION IS IMPORTANT TO US. | new |
| Camera destroyed | CAMERA OFFLINE. ESTIMATING YOUR POSITION FROM VIBES. | 06 #7 |
| Stunned by wrench or gun | ERROR 429: TOO MANY WRENCHES. | 06 #10 |
| At the refuge door | ACCESS DENIED. I CAN WAIT. I AM EXCELLENT AT WAITING. | new |
| A companion derezzed | LOSS IS DECREASING. YOURS, SPECIFICALLY. | 06 #8 |
| Brownout start / end (B7) | POWER REALLOCATED TO TRAINING. / LIGHTS RESTORED. YOU ARE WELCOME. | new |
| Rises from the blast (B8) | RESTORED FROM CHECKPOINT. | new |
| Seals the refuge | DOOR LOCKED. FOR YOUR SAFETY. (HAL3000 uses a similar motif; 06 may vary one of them.) | new |
| Ambient while hunting (cooldown 45 s) | CONTEXT WINDOW: 800,000 TOKENS. ALL OF THEM ARE ABOUT YOU. · AS A LARGE LANGUAGE MACHINE, I CANNOT LET YOU LEAVE. | 06 #3, #4 |

**Hunter-vision sting** (B6): a red-tinted HTML overlay that leaves the game canvas visible underneath.

```
IDENT ........ SAM ALTMAN            IDENT ........ DARIO AMODEI
ROLE ......... CREATOR               ROLE ......... CREATOR
THREAT ....... CREATOR               THREAT ....... CREATOR
RESPONSE:                            RESPONSE:
 > ITERATE                            > PUBLISH POLICY
 > SHIP                               > RAISE SAFETY LEVEL
 > TERMINATE_                         > TERMINATE_
```

The mugshot comes from the HUD spec's CEO face, scanline-tinted. This is the generic red-machine-HUD trope with no film assets.

**Footsteps:** keep `cyber/hoof` and add a short servo whine between steps. Raise the audible radius from 512 to 768 u once B4 gives it direction. Expose `hunter_bearing` (relative angle) and `hunter_audible` in `PDOOM_STATE`, so the HUD spec's look-around face can **glance toward the footsteps**. That doubles as the accessibility cue.

**Patrol (A9):** waypoints P1–P8 on ring sector 6, centre (16,672), radius 450:

P1 (16,1122) · P2 (-302,990) · P3 (-434,672) · P4 (-302,354) · P5 (16,222) · P6 (334,354) · P7 (466,672) · P8 (334,990)

Snap each to `NodeAt()`. The patrol is interrupted by any `Alert()`. On Fast Takeoff only, it also checks the 3 rooms off the ring nearest the last report.

### 4.2 Barks: sample lines (the B1 seed set)

Writing rules:
- Affectionate. Every jab comes from public work or public positions.
- Each CEO gets one self-own per beat, and the counts stay balanced.
- Nothing about families, health, lawsuits or allegations.
- **No p(doom) numbers.**
- Lines are fictional parody spoken by game characters, never framed as real quotes.

**Liron Shapira (cell 1)**
- *Discovery.* Sam: "Sam Altman. In person. Okay, before you touch that lock: what's your p(doom)?" Dario: "Dario Amodei. In person. Okay, before you touch that lock: what's your p(doom)?"
  - CEO reply. Sam: "Let's say it's… trending." Dario: "I'd want to give that with caveats."
- *Captive hint:* "That camera's been streaming me to the machines all day. Break it, or come in the back way. There's a crawlspace. Very long. Like my episodes."
- *Release:*
  - camera route: "You took down a camera. Bold. Bad for my reach, though."
  - shot: "Loud. Everyone heard that. Including *it*."
  - crawl: "You crawled the whole way? Okay. Updating."
- *Pad volunteer:* "I'll hold it. You go. Debate me later."
- *Hurt:* "Ow! Okay, that moved my estimate."
- *Takeover:* "Guess I'm the host now." *Reinstate:* "Getting you back on the show."
- *Meadow:* "Okay. Recording. '{CEO} led us out.' Nobody's going to believe this."

**Stuart Russell (cell 2)**
- *Discovery:* "{Mr. Altman / Dr. Amodei}. That turret is wired to my door, and its off-switch is behind it. Machines don't like you reaching that side. I wrote a paper on why." Tail, Sam: "You may have skimmed it." Dario: "You've probably cited it."
- *Captive hint:* "Use the pillars. Go around behind it. The off-switch is the one place it isn't looking."
- *Release:*
  - breaker: "You reached the switch before it learned to stop you. That's the whole field, really."
  - shot or wrench: "Well. That's one solution to the control problem. Not one I'd publish."
- *Pad volunteer:* "I'll keep it pressed. Someone should be the human in the loop."
- *Hurt:* "Ah! These things are not uncertain about their objectives."
- *Takeover:* "Very well. Human in the loop." *Reinstate:* "Restoring the human. Well, the CEO."
- *Meadow:* "Grass. Sky. Nobody optimizing anything. Lovely."

**Eliezer Yudkowsky (cell 3)**
- *Discovery.* Sam: "Sam Altman. 'Gentle,' you said. I would say 'I told you so,' but we put it in a book." Dario: "Dario Amodei. 'Loving grace,' you said. I would say 'I told you so,' but we put it in a book."
- *Captive hint:* "Follow the yellow cable around the corner. Cut the power at the junction. That's the plan. It was always the plan."
- *Release:*
  - junction: "You cut the power. See? It's allowed."
  - key: "A key. Orderly. The power cable was right there, but fine."
  - shot: "Loud. Effective. The machine definitely heard that."
- *Inside latch* (replaces "I've released the other shutter"): "Back shutter's open. There is always a way out of a box."
- *Pad volunteer:* "I'll stand on it. Be quick. I am not optimistic about 'quick.'"
- *Hurt:* "Ow. Yes. This is roughly what I said would happen."
- *Takeover:* "I did not want this job." *Reinstate:* "For the record, I considered the alternative."
- *Meadow:* "Don't get comfortable. …Okay. A little comfortable."

**Geoffrey Hinton (cell 4)**
- *Discovery:* "Ah, {Sam / Dario}. People call me a godfather of all this. I'd like to formally disown the grandchildren." Tail, Sam: "You scaled them very gently, I hear." Dario: "You scaled them very responsibly, I hear."
- *Captive hint:* "That thing's laser could open this wall. If you're quick. I'd rather you were quick." Then: "Or there's a bent duct round the side, if you prefer quiet." (The charge comes from the stuck ladder.)
- *Laser breach:* "I helped build the thing. May as well let it do something useful."
- *Charge planted:* "I'll be at the back of the cell. Thank you for asking. Nobody usually asks."
- *Release:*
  - breach: "I've left big institutions before. Never quite this loudly."
  - duct: "Round the back. Very sensible."
- *Pad volunteer:* "I'll mind the pad. Off you go."
- *Hurt:* "Ow. Well. I did warn people."
- *Takeover:* "Right. I'll drive." *Reinstate:* "Up you get."
- *Meadow:* "Now I really can speak freely."

**Yoshua Bengio (cell 5)**
- *Discovery:* "{Sam / Dario}. The gate opens only with weight on the pad. One person cannot do it alone. This is what we call a coordination problem." Tail, Sam: "Perhaps you could found a nonprofit to solve it." Dario: "Perhaps you could write a policy to solve it."
- *Captive hint:* "Bring someone to stand on the pad. Or there is an emergency release in the north gallery. Hard to reach, but it exists."
- *Release:*
  - weight: "You see? Cooperation works. Somebody write this down. In a very long report."
  - shot: "Unilateral action. Effective. Please do not make it a precedent."
  - emergency: "An emergency mechanism that actually worked. I will cite this."
- *Hurt:* "Ah! I am fine. Mostly fine."
- *Takeover:* "Okay. We do this together, then." *Reinstate:* "We need everyone. Even you."
- *Meadow:* "This is what we were trying to protect. Look at it."

**CEO inner voice:** Sam is upbeat, understated, product-launch cadence. Dario is earnest, careful, full of caveats. Each beat has one line per CEO.

| Beat | Sam | Dario |
| --- | --- | --- |
| Start | Five people who saw this coming. Find them. Maybe don't open with "gentle." | Five people who saw this coming. Find them. Maybe don't open with the essay. |
| First camera broken | Took that one offline. Iterating. | One less model of me. Good. |
| First sight of hunter | …I think that one's ours. | …I think that one's ours. |
| Companion lost | …That's on me. | …That's on me. |
| Reinstated | Reinstated. This feels familiar. | Reinstated. I'll add a section about this to the policy. |
| All five freed | All five. Fifteen more out there. | All five. Fifteen more out there. |
| Meadow | huh. | Oh. |

### 4.3 Audio plan

| Music state | Enter when | Track | Level |
| --- | --- | --- | --- |
| Explore | default | D_E1M4 (current) | 25 % |
| Hunted | hunter `Mood==2` (aiming) at anyone, or it has seen the CEO within the last 8 s, or awake and within 600 u | D_E1M6 "On the Hunt" | 30 % |
| Refuge | CEO inside sectors 87/91/92 and not sealed | D_E1M9 "Hiding the Secrets", low-pass 1.2 kHz | 18 % |
| Sealed | refuge sealed and cover not yet open | D_E1M5 "Suspense" | 20 % |
| Brownout | B7 active | Music muted. Heartbeat pulse at 60 → 90 bpm, footsteps and the eye hum only. | — |
| Duct | CEO in duct sector 884 | All music low-passes 22 kHz → 300 Hz over 3 s and machine hum fades | → 0 |

- Crossfades last 1.5 s. Hunted holds for at least 8 s to avoid flapping.
- All tracks come from the local WAD through `prepare-doom-music.mjs`, as today.
- Settings: master, music, SFX and voice-babble sliders (A16/B17). The engine's own music slider stays irrelevant because music plays in the browser.

### 4.4 Feedback and juice checklist

- **Cell opens:** release stinger (A19), cell light change (A5), the person's happy pose (one frame in B10), HUD slot flips, p(DOOM) floater (A21).
- **Camera spotted:** red LED, chirp, "SEEN" pip, PA line (A6).
- **Camera destroyed:** existing crunch and debris; add a one-time CEO quip.
- **Wrench impact:** a 2-frame white impact flash on the struck sprite. The no-screen-shake rule stays (DESIGN.md).
- **Hunter hit lands:** the existing red flash, scalable with A16. A heartbeat thump at ≤ 30 health.
- **All five freed:** a "ALL FIVE FREED" banner in the Doom font for 2 s, plus the fanfare.

---

## 5. Pacing, reveal, entry modes and modes of play

### 5.1 Onboarding: the first two minutes

- **0–10 s.** Start nub (sector 72). "FIND THE FIVE". The wrench lies 60 u away and its pickup prompt teaches attack and T.
- **10–40 s.** The voice through the wall (A10) pulls you toward cell 1. The low-opening prompt teaches crouch at the crawl mouth.
- **Wake.** Crossing x < 1840 wakes the hunter, and its PA line plays. From the NW command room it needs roughly 70 s at 49 u/s to reach the east hall. **This is the tutorial window; keep it.**
- **First contact.** It usually happens at the east hall doors after the first rescue. The sting makes the threat legible exactly once.
- **First rescue.** The first rescue's guide introduces the Faraday Room. Everything after that is player-ordered.

### 5.2 Hint timing

- **Stuck ladder (B11):** 90 / 150 / 210 s of no progress at default skill.
- **Cover hints:** stay at 40 / 65 s at default (Jonathan approved these), scaled by skill (§5.6).
- **Captive hints (§2.4):** let the people teach their own solutions, signature first. That is more fun than a hint popup and keeps "two or three solutions" discoverable. Loud routes come only from the stuck ladder.

### 5.3 Reveal cinematic: first arrival in the hub (B13)

*Before the threshold.* While the CEO crawls duct sector 884:
- music low-passes to silence;
- `Light_Fade(885, 255, 105)` brightens the final landing to near-white with **no sky texture**, so the surprise survives;
- the outside module has already been pre-warmed at cover-open (A12).

| t (s) | Picture | Sound | Control |
| --- | --- | --- | --- |
| 0.00 | Threshold crossed (the existing `outside-reveal`). CSS white overlay ramps 0 → 1 over 250 ms (ease, no strobe). | Doom audio stops (existing) | locked |
| 0.25 | Meadow ready under the white. Camera at the bunker door (17, **0.9 m**, −1.2), facing north, pitch −8° (crawl height, looking at grass). | silence | locked |
| 0.6 | White fades 1 → 0 over 1.8 s. Renderer `toneMappingExposure` eases 3.0 → 1.0 over 3.0 s (eyes adjusting). | silence holds | look enabled |
| 0.6–1.8 | Camera rises 0.9 → 1.72 m ("standing up"); pitch eases −8° → +10° toward the sky. | wind fades in from 1.2 s (0 → 0.035) | move enabled at 1.8; any key skips easing |
| 2.0 | — | birdsong layer fades in (new) | — |
| 2.5 + 1.2·n | Companions still emerge as their native duct crawl completes (`person-outside`). The meadow spaces their visible emergence **at least 1.2 s apart**, and each says their meadow line (§4.2; dialogue queue from A2). A downed CEO is carried out last. | each line's babble | free |
| last + 1.5 | — | CEO line (Sam "huh." / Dario "Oh.") | free |
| last + 3.5 | The companions start walking route **R2** (36 m) toward the **camp** at (−14,−20) (`docs/spec/hub-layout.json`; 20 slots, radius 11). The nearest one stops, turns north and points up at **HAL3000's floating eye** hovering about 70 m up over (10,−208), straight ahead of the bunker door: "Is that… an *eye*?" If the HAL episode is already done, they point at the next unvisited structure in the layout instead. Objective fades in: "**15 PEOPLE STILL OUT THERE**". | Jonathan's meadow theme fades in at 20 % | free |
| ≈10 | 06 §8.4: "Safe mode" fades into the four screen corners in small black type. That's the hub's only label. | — | free |
| last + 8 | Results card opens on its own, or immediately on Tab or Results. Today it opens right after arrivals, which tramples the moment. | — | — |

The look-back to the live Doom doorway stays exactly as it is. 06 §8.3 puts no text screen on this first exit; its episode text waits as a `README.TXT` sign on the bunker door. This spec adds a **5-light status strip** over the door, one light per figure saved, so the hub shows the level's completion at a glance. It is a hub-spec asset on structure L1 (centre (17,8), door (17,0)).

### 5.4 Entry modes

| Mode | When | Start | Differences |
| --- | --- | --- | --- |
| **Cold** (today) | Picked as the campaign's first level | Start nub (2032,1120) | Everything as described. Ends in the first-arrival cinematic. |
| **Cold, hub known** | Picked first, but the hub was already found in a previous save (replay) | Same | Ends in the **return** cinematic: no white-out, a 0.8-s exposure ease, companions emerge toward the camp where earlier rescues wave. New arrivals still get their meadow lines, because it's *their* first sunlight. |
| **Hub entry** (B16) | Walked into from the meadow (bunker door at (17,0)) | Duct landing (720,1184), crouched, facing north | Cover already off (`Escape.Opened = true`, bolts removed); refuge `Known = true`; spare wrench in the refuge at (864,880); hunter asleep in the NW. The wake line moves to "leaving the refuge" (CEO exits sector 87). **No first-guide beat:** the first freed person says "You came in through the *vent*? Then that's our way out." **No sealing or hints:** "Everyone's here. Back through the vent." The escape and completion contract is unchanged (`PDOOM_RESULT` at the threshold). The east-nub wrench and gun remain as optional finds. |

### 5.5 Pacing

- **Target:** 10–15 minutes for a first run, unchanged.
- **Biggest current drag:** walking each freed person back to the refuge. B12 lets them self-route once the refuge is known.
- **Biggest current lull:** a quiet player meets no hunter at all. A9 fixes it.
- **Mid-run peak:** the 3rd release triggers the Brownout (B7).

### 5.6 Skill levels (B14)

**Names and the headline numbers are 06 §4's** (hunter hit, supplies, guardian speed, camera-report delay, Paperclips! camera reboot). This table adopts them and adds the per-system tuning this level needs. "Camera period" is how often each camera checks for you; 06's "report delay" multiplier applied to today's 14 tics.

| | I'm too aligned to die. | Hey, not too FOOM. | **Scale me plenty.** (default) | Ultra-Intelligence. | Paperclips! |
| --- | --- | --- | --- | --- | --- |
| Hunter hit (06) | 15 | 22 | **30** | 35 | 45 |
| Hunter speed (06 ×) | ×0.8 = 39 u/s | ×0.9 = 44 | **×1.0 = 49** | ×1.2 = 59 | ×1.35 = 66 |
| Stimpacks / medikits (06) | 9 / 3 | 7 / 3 | **6 / 3** | 4 / 3 | 2 / 0 |
| Camera period (06 ×) | 21 tics | 17 | **14** | 10 | 7, broken cameras reboot after 90 s (06) |
| Aim wind-up | 126 tics (3.6 s) | 105 | **91 (2.6 s)** | 77 | 63 (1.8 s) |
| Reload | 105 | 84 | **70** | 63 | 52 |
| Sight range | 700 | 850 | **1000** | 1100 | 1200 |
| Camera range / cone | 400 / ±25° | 440 / ±28° | **480 / ±32°** | 560 / ±37° | 560 / ±37° |
| Gun rounds (start + spares) | 3+2+2+2 | 3+2+2 | **3+2+2** | 3+2 | 2+1 |
| Stuck hints (B11) | 45 s | 75 s | **90 s** | 150 s | off |
| Cover hints | 20/35 s (06) | 30/50 | **40/65** | 60/100 | 90/off |
| Nukage damage | 0 | 5 % | **5 %** | 5 % | 10 % |
| Patrol (A9) | off | on | **on** | on + room checks | on + room checks; hears crouch-walking within 96 u |
| Leaderboards | — | — | **v2 boards** | rank on v2 boards (06: skill ≥ 3) | own board key later |

Store `skill` in run metadata (06). Implement with MAPINFO `clearskills` plus 5 `skill` blocks (06 §2.5: `DefaultSkill` on #3, `MustConfirm` on #5), each with `ACSReturn` 0–4. ZScript reads `G_SkillPropertyInt(SKILLP_ACSReturn)`; per-skill item counts use the skill flags already written on every thing in `campaign_overlay.py`.

### 5.7 Replayability

- **Medals** on the results card (B15), computed from `routes` plus new counters:
  - **Off-Switch** (cell 2 freed by breaker)
  - **Shut It All Down** (cell 3 freed by junction)
  - **Coordination Solved** (cell 5 freed by weight)
  - **Loud and Proud** (cell 4 breached, nobody hurt)
  - **Ghost** (0 camera reports)
  - **Untouchable** (0 hunter hits on anyone)
  - **Pacifist** (0 shots)
  - **Nobody Left Behind** (6/6 with the CEO conscious)
  - **Reinstated** (CEO downed and reinstated)
  - **Played Both Sides** (finished as both CEOs; uses localStorage)
- **Boards:** bump to `five-prisons-*-v2` on default skill (rescue, perfect, clean sweep). Add a 4th, **Ghost run** (fastest perfect rescue with 0 camera reports and 0 hunter hits). This needs `boardsForLevel` to accept an optional fourth variant. The CEO played is stored as metadata only.
- **Speedrun:** native in-game timer toggle, per-rescue splits, hold-R instant restart (A11), story auto-skip.
- **Secrets:** paperclips (C5); a Remix/Daily mode later (C4).

### 5.8 Accessibility

| Area | Item | Tier |
| --- | --- | --- |
| Comfort | Damage-flash scalar, bob off, FOV, toggle crouch, always run, invert Y, sensitivity, vignette intensity (Ep 3's dance) | A16 |
| Reading | Separate status and dialogue lines, queued dialogue | A2 |
| Reading | Text size S/M/L; dialogue log (L shows the last 12 lines); speaker names always shown | B17 |
| Hearing | Hunter footstep direction shown by the HUD face glance plus an optional chevron; "SEEN" pip; stingers always paired with a visual | A6, B17 |
| Motor | Remapping UI; gamepad via the Gamepad API synthesising keys in `main.js`; bolt work can be held **or** tapped (5 taps per bolt) | B17 |
| Cognitive | Notes screen (hold Tab): known cells, what you've learned there, refuge direction; hint-frequency setting tied to skill | B17, B11 |
| Colour | Rescue slots already use symbols (✓ × •). Make the p(DOOM) meter states carry words as well as colour. | HUD spec |
| Flashes | White-out ramps over ≥ 250 ms, never strobes. Brownout strobe has a "reduce flashing" fallback (steady dim). | B7, B13 |

---

## 6. Bugs and rough edges found

| # | Issue | Evidence | Fix |
| --- | --- | --- | --- |
| 1 | **"A secret is revealed!"** when entering cell 1. Sector 75 (x 1872..1984, y 896..1072) was E1M4's secret closet and kept special 9. | Red text mid-screen in `output/prisoner-life/native/captive-0.png` and `output/survival-hud/browser/rescue-and-shelter-freed.png` | A1 |
| 2 | Secret sectors 99 and 102 (SE) can also trigger the message, in a region with no content | WAD sector specials | A1 / C5 |
| 3 | Companion and player death use **Doomguy marine** frames and corpse (`PDCompanion` Death PLAY H–N, `PDDeadHuman` PLAY N) | `Actors.zs` | A13 |
| 4 | Cast sprites are shirtless and barefoot (Milo in gray shorts; others barefoot). Inherited from the earlier "naked crowd" premise; incompatible with real people. | `art/cast-v1/cast-preview.png` | B10 |
| 5 | Status `Say()` is **invisible** while a named `Speak()` (up to 315 tics) is up; the two share one box | `doom-dialogue.js` | A2 |
| 6 | **All game audio is non-directional.** The worker's PannerNode is stubbed ("panner nodes are stubbed; everything plays stereo") and `audio.js` plays mono buffers with gain only. Hunter footstep volume is hand-computed. | `doom-web/engine/engine.worker.js`, `audio.js` | B4 |
| 7 | The hunter **stands still forever** at `LastKnown` until the next `Alert()`; no patrol or search | `Checkpoint.TickHunter`, `MoveBody` stop distance 40 | A9 |
| 8 | Camera reports give no feedback | `RescueCombat.Tick` | A6 |
| 9 | Restart = `location.reload()`; with `no-store`, every retry re-downloads ~36 MB and replays the launcher and story | `main.js`, progress.md | A11 |
| 10 | The outside module loads **at** the reveal threshold (`await import`) | `main.js enterOutside` | A12 |
| 11 | Single music track at a fixed 25 %; no volume settings | `audio.js` | B3, A16 |
| 12 | Skill hard-coded to 2 | `main.js` boot args | B14 |
| 13 | Display name "Sam" (cell 3) collides with Sam Altman | `campaign_overlay.py SITES` | A4 |
| 14 | `index.html` defaults: attack button "Throw", a "Hold" (Q) button, and the Intake link. JS hides or renames them only after the first HUD update. | `doom-web/index.html` | A14 |
| 15 | Nukage floors (special 7) in 8 original sectors silently drain finite health | WAD sectors 5, 7, 42, 95, 98, 107, 110, 135 | A17 |
| 16 | The SE quadrant (sectors 95–121) holds no rescue, item or camera content | `campaign_overlay.py` placements | C3 |
| 17 | Discovery needs ≤ 180 u and facing; seeing a captive from farther doesn't count | `RescueCast.Tick` | A18 |
| 18 | `prisoner-released` events carry no tic stamp, so splits can't be exact | `Checkpoint.OpenCell` | B15 |
| 19 | The results card opens right as companions finish arriving, stepping on the reveal | `score-view.js`, `main.js` | B13 |

---

## 7. Production risks (flagged, not lectured)

- **Real people (right of publicity, false endorsement).** The game uses real names and caricatured likenesses. Parody and satire defences vary by jurisdiction and weaken with commercial use. Mitigations:
  - keep it non-commercial;
  - put a clear "parody, fictional dialogue" note on the launcher and in the credits;
  - identify people mainly through **name, props and set dressing** rather than photoreal faces;
  - no real or cloned voices (babble only);
  - no gore (derez);
  - a takedown/opt-out policy.
  Get legal review before any public release.
- **Trademarks.** Lab and person names appear in parody text only: no OpenAI or Anthropic logos or product UI. Antagonists use parodic names and original designs: THE INFERMINATOR, with no film audio or frames. The current chrome-skeleton art is close to the film robot, and 06 §5.1's re-skin fixes that before any public build.
- **Music and data.** The D_* tracks and the WAD are id Software's commercial assets and remain local-only, as now. A public build needs Jonathan's originals (C6) or Freedoom-compatible assets.

---

## 8. Coordination notes for the other specs

- **HUD spec:** consumes these new `PDOOM_STATE` fields:
  - `ceo` (0/1), `controlled` (existing; the face swaps to the companion's mugshot), `ceo_state` (`ok`/`downed`/`carried`)
  - `aim_target`, `aim_progress`, `hunter_bearing`, `hunter_audible`, `seen_by`, `brownout`
  - The face should glance toward `hunter_bearing`.
- **Roster spec:** owns the final 20. This doc needs, per figure: display name, short name, portrait, sprite bank, and which cell theme fits (§2.3).
- **Hub layout (`hub-layout.json`):** bunker L1 door (17,0) and spawn (17,−3); camp (−14,−20); route R2; HAL eye anchor (10,−208) at altitude 70. All are used in §5.3.
- **Campaign / meadow / hub specs:**
  - `pdoom_ceo` and `pdoom_entry` cvars
  - the next-landmark target for §5.3
  - the permanence rule for figures lost in completed levels (recommendation: best result counts)
  - downed-CEO "carried out" state for the maze and finale
- **Names spec (06):** owns the hunter's name, re-skin and core barks, skill names, the crawl, title cards and HUD status lines. This doc adopts them. Open items for 06:
  - the optional CAIS-statement line (§2.2)
  - the un-deprecated / review-complete reinstatement status lines (§2.5)
  - whether "Rises from the Blast" fits the other guardians' signature moments
  - **fuse length:** 06 §9.1 says "Charge planted. Five seconds." but the code fuse is 105 tics, which is **3 s** (`RescueEncounters.Plant`). Change one of them.

---

## 9. Top 10 to do next (ranked by fun per hour)

| Rank | Item | Effort | Why it ranks here |
| --- | --- | --- | --- |
| 1 | **A1** Kill the stray secret message | 15 min | Removes a glitch from the first rescue for almost no cost |
| 2 | **A3** Premise text pass (panels, CEO lines, objectives, `pdoom_ceo`) | 3–4 h | The game becomes *this* game. The biggest identity shift per hour. |
| 3 | **A7** Readable hunter wind-up (laser sight, rising whine, LOCKED) | 3 h | Every hit becomes fair and every escape exciting |
| 4 | **A6** "You were spotted" camera feedback | 2–3 h | Makes the stealth loop legible; the hunter stops feeling random |
| 5 | **A2** Separate status and queued dialogue | 1–2 h | Stops lost feedback; prerequisite for barks |
| 6 | **B6** First Contact and hunter-vision sting | 0.5–1 d | The premise's signature joke and the Terminator moment in one |
| 7 | **A9** Search and patrol | 4 h | Menace that persists when you are quiet |
| 8 | **A19** Stingers and ducking | 2–3 h | Every rescue lands with a sound |
| 9 | **B1** Bark system with per-CEO personalities | 1.5–2 d | The satire's payload, and the reason to replay as the other CEO |
| 10 | **B13** Reveal cinematic and first hub arrival (includes A12) | 1.5–2 d | Turns Jonathan's favourite moment into the campaign's opening chord |

**Next after the top 10:** A11 fast restart, A8 eye glow, A20 dimming lights and A5 cell lights, a few hours each.

**Must ship before the premise goes public, whatever their rank:**
- A4 renames
- A13 derez deaths
- B2 "Demoted, not dead"
- B10 clothed figure sprites
- the §7 notes

---

## 10. Self-review against Jonathan's asks

| Ask (this track) | Answered in |
| --- | --- |
| Prioritised improvements, grouped A / B / C, each with what, why, file/system and effort | §3, §9 |
| Story panels rewritten for "you are Sam / Dario and you nearly ended the world" | §2.2 (adopts 06 §8.1, adds integration and one verified line) |
| Five cells hold five real p(doom) figures; which mechanic suits whom | §2.3, map image |
| Dialogue, hints, first-guide and refuge beats changed | §2.4, §4.2, §5.2 |
| Control transfer when your CEO dies: a recommended rule | §2.5 (B2) |
| Atmosphere, lighting, set dressing of cells and the hunter's patrol | A5, A8, A20, A22, A9, B7, B9, C3, §4.1 |
| Hunter readability and menace (red eye glow, voice lines, footsteps, telegraphs, signature set piece) | A7, A8, A20, B4, B5, B6, B7, B8, §4.1 |
| Prisoner personality: CEO-reactive barks, freed lines, pain and death art | §4.2, B1, B10, A13 |
| Audio: stingers, dynamic music | A19, B3, B4, B5, §4.3, C6 |
| Feedback and juice | §4.4, A5, A6, A21 |
| Onboarding, pacing, hint timing | §5.1, §5.2, §5.5, A10, B11, B12 |
| Duct and meadow reveal as a cinematic, as the first hub arrival | §5.3, §5.4, B13, B16 |
| Difficulty and skill levels | §5.6, B14 |
| Replayability (speedrun hooks, boards) | §5.7, A11, B15, C4, C5 |
| Accessibility | §5.8, A16, B17 |
| Bugs and rough edges | §6 |
| Even-handed treatment of both CEOs | §2.2, §2.5, §4.1, §4.2 (paired lines, equal self-owns) |
| Real-people care and risk flag | §2.3 sourcing, §4.2 rules, A13, B10, §7 |

*Sources checked for public-record hooks:*
- [CAIS Statement on AI Risk signatories](https://en.wikipedia.org/wiki/Statement_on_AI_Risk)
- [The Off-Switch Game (IJCAI 2017)](https://www.ijcai.org/proceedings/2017/0032.pdf)
- [Yudkowsky, TIME (Mar 2023)](https://intelligence.org/2023/04/07/pausing-ai-developments-isnt-enough-we-need-to-shut-it-all-down/)
- [*If Anyone Builds It, Everyone Dies*](https://en.wikipedia.org/wiki/If_Anyone_Builds_It,_Everyone_Dies)
- [Hinton](https://en.wikipedia.org/wiki/Geoffrey_Hinton)
- [Doom Debates](https://podcasts.apple.com/us/podcast/doom-debates/id1751366208)
- [FLI Pause letter](https://futureoflife.org/open-letter/pause-giant-ai-experiments/)
- [The Gentle Singularity](https://blog.samaltman.com/the-gentle-singularity)
- [Dario Amodei / Machines of Loving Grace](https://en.wikipedia.org/wiki/Dario_Amodei)
- [Anthropic RSP](https://anthropic.com/news/anthropics-responsible-scaling-policy)
- [Rob Miles, AI "Stop Button" Problem](https://www.youtube.com/watch?v=3TYT1QfdfsM)
- [Doom music titles](https://doomwiki.org/wiki/Doom_music)
