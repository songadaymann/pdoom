# p(DOOM): first-playable design

Design decisions, 2026-10-04. This is a **testable design contract**, not a claim that every item below is implemented. See the project README and verification report for the actual slice and omissions.

**Current direction:** the browser now runs an actual Doom mod proof. [LEVEL-01.md](LEVEL-01.md) proposes its first authored level and directional sprite workflow. Implementation observations and the engine decision below describe the earlier Three.js slice; those systems have not all been ported to Doom.

## Current implementation boundary

Code inspection during development confirms six humans (one controlled, five bots), global follow/hold/evacuate orders, lethal hunter shots after an aiming interval, takeover of a surviving body, smashable cameras, a grid-step movable crate, a collectible demolition charge and breachable wall, weapon collection and transfer, a traversable hatch, and an outside relay that opens the second hatch and final perimeter while disabling cameras. Weapons stun the hunter; they do not kill it. A blast within 2.6 world units can kill humans. The forecast runs asynchronously with **48 trials, a 45-second horizon and the same 0.1-second step as live play**.

These are implementation observations, not playtest certification. Current companions use a simple navigation field and global orders; richer cover tactics, individual orders and robust stuck recovery are design targets. Surveillance presently uses distance and line of sight, not a precise camera viewing cone. Bodies, hunter, terrain and textures are original procedural stand-ins, not imported final art. Equipment recovery from corpses, generic movable props, richer sound, and general physics are not established features of this build. Any later changes should be recorded in the verification report.

## The promise

A crowd of visibly naked adult humans tries to outwit one overwhelming machine gunman in a brutal, Doom-like dungeon. You survive by changing the place, arming other people, and discovering what apparently ordinary objects let you do. Crawling through the escape hatch reveals an unnervingly familiar green hill and blue sky. You can still hear the people below. Leaving the dungeon is the midpoint; helping from outside creates the second half.

The crowd joke is structural: varied adult bodies, awkward running, bare feet, huddles and startled reactions against a machine that never hesitates. A shared skeleton and animation library should keep this achievable. Clothing, armored soldiers, anonymous capsules, or a lone hero would change the premise. Temporary procedural bodies can test crowd movement but do not satisfy the intended MakeHuman character fidelity.

| Contract | First-test decision |
| --- | --- |
| Feeling | Vulnerable, funny, inventive, then briefly serene and newly responsible |
| Primary verb | Alter: break, move, open, carry, hand over |
| Every 5–30 seconds | Read a threat, attempt a physical action, observe the new situation, move the group |
| Run objective | Get at least one person to permanent safety beyond the outside perimeter; saving more people is better |
| Pressure | One lethal hunter, camera reports, exposed sightlines, limited useful equipment |
| Reward | Concrete new routes, lost surveillance, a companion who can cover others, access to outside controls |
| Skill | Learn spatial consequences; time diversions; use companions and routes without treating lives as disposable ammunition |
| Failure/retry | A body dies, control can continue through a survivor; total loss restarts the short scenario |
| Non-goals | Multiplayer networking, persistent metaprogression, full procedural campaign, photoreal characters, commercial distribution |

Core loop: **change the dungeon to create a survivable route while the hunter closes in; each successful experiment creates a new option, each mistake costs time, equipment or a person. Reach the field, then change the dungeon from outside to improve the remaining group's escape.**

## First space and pacing

Use one authored layout before procedural generation. It needs a loop, a blocked shortcut, one camera-controlled sightline, an armory detour, and one fragile wall. A map generator is useful only after these encounters work.

1. **Start, 0–20 seconds:** a small group is together, a camera moves visibly, and an obstruction hides a side route. The first choice is moving the obstruction or taking the exposed passage. Make a useful interaction reachable immediately.
2. **First threat, 20–45 seconds:** a camera sighting changes the hunter's route; the hunter's aiming tell lets the player break line of sight. One corner must demonstrate that cover really works.
3. **Experiment, 45–90 seconds:** a weapon and explosive require a detour. A cracked wall connects two known spaces. Blasting it helps the group but also creates a hunter route and a sightline. These consequences should exist in the simulation, not in a score table.
4. **Reveal, roughly halfway:** a real traversable hatch opens onto a large, bright field with the intended Bliss composition: saturated grass, low sweeping hill, deep blue sky, soft white cloud clusters. A tiny decorative garden would not deliver the reveal. The interior remains audible and spatially connected.
5. **Outside responsibility:** an exposed relay can cut surveillance and open a second rescue route into the dungeon. The hunter can emerge. Reaching the first hatch alone does not end the run.
6. **Resolution:** the group crosses the final safety perimeter. Once someone is permanently safe, the no-survivor event is impossible. End or continue to rescue others according to the test build's actual behavior; never quietly redefine the meter to restore tension.

Timing above is a pacing target, to be tuned from play, not verified duration. Landmarks should be physical: a red surveillance corridor, a warm armory, the cracked wall, daylight at the hatch, and the outside relay. Signage may name destinations without explaining probability effects.

## Physical interaction set

| Object / attempt | Concrete consequence | Discovery cue |
| --- | --- | --- |
| Camera: smash or shoot | Stops that camera's future sight reports; breaking it may make a brief noise | Moving lens, light, tracking motion; visible broken state |
| Crate / wheeled obstruction: push | Changes collision, passage width and line of sight; can block the hunter too | Handles, wheels, scrape response on contact |
| Door: open / close | Changes traversability and cover for everybody | Handle, moving panel, latch sound |
| Weak wall: plant found explosive | Permanent opening used by people and hunter; blast/noise has a cost | Cracks and reinforcing frame; nearby matching charge |
| Weapon: collect / give to companion | Actual holder changes; an armed bot can interrupt the hunter's aim or provide brief covering fire | Held model and firing response, not an invisible upgrade |
| Hatch: open / traverse | Connects dungeon and field without ending the scenario | Light, breeze, ladder/ramp, sound leaking through |
| Outside relay: operate | Opens a rescue route and cuts remaining cameras | Visible wire run and mechanical gate response |
| Companion: follow / hold / evacuate | Changes the companion's navigation intent | Short gesture/acknowledgment; no tactical dashboard required |

The first slice should prioritize cameras, obstruction, explosive breach, weapon transfer, hatch, and outside relay. Doors and richer squad commands can follow. An interesting object should accept a plausible attempt and respond: move, resist, rattle, break, or give a short contextual hint. Avoid a world full of visually tempting props that silently ignore input.

Keep the main HUD to **`p(doom) ≈ 37%`**. Contextual action prompts, essential controls, and a death/retry prompt can exist; do not add a factor breakdown, “TEAM EXTINCTION,” or numerical camera/weapon bonuses. Explain the forecast once in help/documentation so its meaning is available without prescribing experiments.

## Companions and hunter

Solo play should work without finding testers. Start with a small fixed crowd and one player-controlled body. Each person has the same locomotion, collision and inventory rules whether driven by the player or a bot; later human takeover can replace the source of input rather than replacing the actor.

**Bot target policy:** take usable escape routes, replan after a breach or moved obstacle, avoid the hunter's visible firing lane when an alternative exists, and use assigned equipment. Follow/hold orders should be stable until explicitly changed or immediate danger forces a short evasion. Bots should not autonomously consume the only explosive or solve every experimental interaction. Never silently teleport them to the hatch to cover pathfinding failures. A visible “stuck” response is preferable to a disappearing companion. These are design targets; the slice may use a simpler evacuation policy.

**Hunter:** one physically consistent actor, not a randomly spawning punishment. Cameras supply positions and last-seen information, not permanent omniscience. Its uncertainty comes from seeded strategy choices and bounded aim variation. It can patrol, investigate noise, pursue a sighting and re-acquire. Lethality does not require an untelegraphed death: a short aiming/lock-on tell gives cover, interruption and diversion meaning. Human guns should interrupt or delay it in the first test; ordinary sustained fire should not turn this into a conventional boss kill.

## Death: reversible first-test default

**Default:** a successful hunter shot kills the current body immediately. The dead body stays dead, equipment can remain in the world, and control transfers to a surviving companion. If every human dies before anyone is permanently safe, the run is lost. Restart restores a reproducible scenario. This preserves lethal encounters and continuing agency without making the first casualty demand a full restart.

Prefer a successor outside an existing firing lock so control transfer does not cause an unreadable chain of deaths. A brief clear transfer transition is a usability target. Do not simulate a magical new human or revive the same body: the remaining crowd is a finite reserve of lives. Evaluate whether this makes players sacrifice bots; if it does, survivor recognition and deliberate transfer rules need revision.

| Alternative | Value | Risk / next test |
| --- | --- | --- |
| One life, spectator until all dead | Strong horror and individual stakes | Bad solo iteration; bot mistakes take control away |
| Respawn as same human | Fast experimentation | Undermines naked vulnerability and collective survival |
| Dead operator helps survivors | Keeps agency, supports the outside-controls idea | Can make deliberate death optimal; needs constrained physical access and a separate test |
| Death uploads you to help the AI | Distinctive betrayal premise for later multiplayer | In solo play it changes the goal and confounds the first survival test |

No final commitment to a death fiction is required by this prototype.

## Probability: honest first-test model

The original “all humans die before anyone escapes” event collapses to zero at the first true escape. Calling a safe outside person doomed afterward would require changing that definition. For this slice, the first hatch is not permanent safety; it exposes the second part of the map.

**Chosen provisional quantity:** the chance that nobody is permanently safe now or reaches the final safety perimeter in the next **45 simulated seconds**, if the humans execute the declared autonomous evacuation policy and the hunter follows the build's stochastic rules. This is a conditional **failure-to-reach-safety forecast**, not a calibrated prediction of a human player's behavior and not a literal probability of eventual extinction. Survivors still alive inside when the forecast horizon expires count as forecast failures. That does not itself kill them or end the live game.

Let `S(t)` be the cumulative number of permanently safe humans, `x_t` the complete current simulation state, `π` the declared evacuation policy and `H = 45s`:

```text
p_H(x_t; π) = P[S(t + H) = 0 | x_t, π, game transition rules]
estimate    = count(rollouts with S(t + H) = 0) / rollout count
```

Rollouts start from cloned real state and use the same movement, collision, navigation, line-of-sight, camera, weapon, hunter and escape rules as the live simulation. Their policy `π` deliberately switches every living unsaved person to evacuation, replacing current follow/hold orders and future player input. They route to the main hatch, open it when near, travel to and operate the outside relay, then go to the final perimeter; armed humans fire when the ordinary bot rules allow. They do not collect new equipment, transfer guns, push the crate, smash cameras or plant a new bomb. An already burning fuse continues. Automatic hatch/relay operations are therefore an explicit assumption, not a prediction of what the player will discover.

Existing openings, inventory and cameras are real state, not manually assigned danger weights. A breach can create a hunter route or a lethal line of sight. No intervention is guaranteed to lower the percentage. Noise from camera destruction is a desired future tradeoff, not an implemented first-slice cost.

Implementation requirements:

- Declare the policy precisely in the README: routing priorities, bot weapon use, and whether any interaction is automatic. The forecast is meaningful only under that policy.
- Keep `H`, rollout count, tick size and strategy distribution in configuration. Ensure ordinary traversable routes can finish inside `H`; otherwise the meter measures travel time almost exclusively.
- Forecast RNG must never consume the live RNG. Reuse a deterministic sample-seed bank between snapshots to reduce distracting sampling noise, while preserving independent trials within a snapshot.
- Show approximate, whole percentages. Sample estimates of 0% and 100% do not prove certainty; expose sample count and a binomial interval in diagnostics, not the gameplay HUD. With the current 48 trials, the approximate 95% sampling margin near 50% is about ±14 percentage points. In particular, zero observed failures in 48 trials does not establish that the true risk is below 2%; its 95% Wilson interval still extends to about 7.4%. Reserve unqualified 0%/100% for analytically known terminal conditions.
- Once a human is permanently safe, `S > 0` and the estimate is exactly zero under these rules. If every human dies with `S = 0`, it is exactly one. Do not clamp ordinary forecasts to fake urgency.
- Validate known fixtures and changed world states, not just “numbers move.” Test safe absorption, all-dead loss, blocked navigation, camera line-of-sight, weapon ownership, rollout reproducibility, and live-state immutability during estimation.

| Model alternative | Why it is attractive | Why not the first default |
| --- | --- | --- |
| Eventual total extinction before any final escape | Closest to the title's literal meaning | Some policies hide or loop forever; finite rollouts leave unresolved outcomes. Report bounds `deaths/N` to `(deaths+unresolved)/N`, or define an actual mission deadline rather than count unknowns as death |
| Failure to save every starting human | Keeps rescue stakes after one is safe | One death makes it permanently 100%; too brittle for this death model |
| A uniformly randomly selected human dies | Coherent and sensitive to all lives | Measures expected casualty fraction, not group extinction; would need an explicit change of meaning |
| Learned prediction from human play | Could estimate actual player behavior | Requires representative play data and calibration; cannot be honestly invented now |

The first model is deliberately provisional. Test whether its rolling horizon feels useful, whether outside play remains compelling, and whether the naked crowd is funny and sympathetic before committing to a larger simulation.

## Engine decision and fidelity debt

**Provisional local slice: Three.js standalone.** Preserve first-person dungeon movement, a genuinely traversable outdoor reveal, shared human actors, physical state changes and a simulation that can be cloned for forecasts. Use a deliberately small collision/navigation model for this slice; upgrading arbitrary object physics later is a real engineering task. Three.js is a renderer, so gameplay systems remain our responsibility.

| Option | Strength | Consequential cost |
| --- | --- | --- |
| Literal Doom mod on a modern Doom source port | Authentic map/material pipeline and immediate Doom movement vocabulary | Owned Doom data still required for original assets. Shared animated human bodies, dynamic route edits and cheap cloned world rollouts need a dedicated feasibility spike. Do not assume engine openness licenses WAD artwork |
| Three.js standalone, chosen for test | Local browser review; direct ownership of the simulation; easy two-world connection and same-kernel forecasts | Custom bot/navigation/physics work; current procedural art is an acknowledged visual placeholder |
| Godot standalone, production candidate | Integrated scene, character, animation, physics and navigation tooling | Porting cost; a separate lightweight forecast kernel can diverge from the engine unless carefully tested |

A standalone is not permission to soften the requested look. Actual Doom materials, the MakeHuman crowd, and a faithful Bliss-like reveal remain explicit art goals. Current substitutions should be labeled. See [REFERENCES.md](REFERENCES.md) for verified availability, rights, and blockers.

## First-test acceptance and reference ledger

The first playable is acceptable only if a real player can move and interact, change at least one route, influence surveillance, transfer a weapon, encounter lethal pressure, cross the hatch into a usable second space, operate an outside rescue action, and reach a visible fail/retry or safety outcome. It also needs a build, a local browser input test, a nonblank render, and console-error inspection. **This design document does not certify those checks.**

Read for this design work (all yes; no load failures):

- `~/.codex/skills/threejs-gameplay-systems/SKILL.md`
- `references/gameplay-workflows.md`
- `references/game-design-level-design.md`
- `references/checklists/new-game-definition-of-done.md`
- `references/checklists/game-design-level-design.md`

Outstanding experiential tests: whether companion losses feel fair, whether the forecast meaning is comprehensible without a breakdown, whether an obvious interaction encourages further experiments, whether the first outdoor reveal lands, and whether its rescue action earns an actual second half.
