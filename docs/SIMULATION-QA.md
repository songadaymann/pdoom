# Simulation verification

**Result: 20 of 20 tests passed on 2026-10-04.** This is direct, deterministic simulation verification. It does not establish visual quality, real keyboard/pointer behavior, browser audio, mobile support, or a production release. Those require the separate browser pass.

Run from the `pdoom` directory:

```sh
npm test
```

This executes `node --experimental-strip-types --test tests/simulation.test.ts`, importing `src/sim.ts` directly. Recorded environment: Node v22.23.1, macOS (`darwin`), arm64. The final successful run completed in 11.72 seconds; there were zero failed, skipped, or cancelled tests. This run includes the new player spawn `(7,26)`, behind the companions, the widened exterior with a physical fence, outdoor direct steering, and the final 8.5-second hunter opening delay.

## Covered behavior

| Test | Result |
| --- | --- |
| Camera requires reach, breaks through ordinary attack, remains destroyed | Pass |
| Crate push changes collision; a masonry wall blocks an invalid push | Pass |
| Player movement collides with crate; two forward pushes clear the narrow opening | Pass |
| Charge collection, one-use inventory, fuse, wall destruction, nearby friendly deaths, transfer | Pass |
| Weapon pickup, nearest eligible recipient, autonomous companion fire/stun | Pass |
| Weapon handoff blocked by intervening wall, successful once obstruction is removed | Pass |
| Blast stuns hunter at 3.9 metres, but not at 4 metres or far away | Pass |
| Live companion follow/hold/escape with forecast mode disabled and stationary player | Pass |
| Hunter's brief aiming window, one-hit death, exactly one controlled survivor after transfer | Pass |
| First step outside does not win; relay opens rescue hatch/gate and disables cameras | Pass |
| Gate safety transfers control to someone still endangered; forecast becomes terminal zero | Pass |
| Wide field bounds, closed-gate movement collision, fence outside gate, unlocked crossing | Pass |
| Companions follow and hunter pursues visible outdoor targets beyond the dungeon grid | Pass |
| Open rescue hatch provides a viable alternative when the main exit is obstructed | Pass |
| All-dead loss, stopped terminal simulation, fresh-state restart restores world and inventory | Pass |
| One safe survivor preserves a win when every remaining human dies | Pass |
| Forecast calls reproduce, leave snapshot unchanged, and do not consume the live RNG stream | Pass |
| Deadline forecast counts no evacuation by horizon even when everyone is alive | Pass |
| Paired stochastic rollouts react to cameras, breached wall, armed companion, and cleared crate | Pass |
| Autonomous full evacuation reaches relay and final gate with all six humans | Pass |
| Full 48-sample forecast returns a finite frequency with recorded computation time | Pass |

Tests isolate rules with explicit fixtures where appropriate. Teleporting into an interaction fixture does not prove a player can reach that location through browser controls. The live bot test does drive a companion from the initial dungeon through the real navigation route, hatch, relay, and gate using the ordinary live `step` path.

## Recorded evidence

The autonomous evacuation script uses the same navigation policy as forecasts. Hunter activity is suppressed only for this route-isolation test; its purpose is to prove the entire route is traversable, not that the game is easy or balanced.

```json
{"evidence":"scripted-autonomous-evacuation","seed":4729,"timestep":0.1,"ticks":354,"simulatedSeconds":35.40000000000023,"safe":6,"mode":"won","hunter":"suppressed to isolate navigation"}
```

The separate live-mode bot test leaves the player standing at `(7,23)`, orders one companion to escape, and verifies that companion reaches safety within 60 simulated seconds. The hunter is also suppressed for this navigation test. Follow and hold behavior are tested beforehand.

```json
{"evidence":"paired-interventions","timestep":0.1,"openingDelay":8.5,"samples":16,"failures":{"baseline":6,"cameras-disabled":1,"wall-breached":0,"one-armed-bot":0,"crate-pushed-twice":0}}
```

The intervention test uses the same 16 rollout seed values for each snapshot, a 45-second horizon, and the initial hunter at `(27,25)` with an 8.5-second opening delay. It makes physical state changes, then reruns the ordinary simulation. It does not add/subtract arbitrary risk points. A camera-free world still has direct hunter sight and therefore retains risk. One gun is very effective in this small map; its result is a balancing observation, not proof of invulnerability.

```json
{"evidence":"forecast-benchmark","seed":4729,"timestep":0.1,"openingDelay":8.5,"elapsedMs":2586,"prediction":{"p":0.2708333333333333,"failures":13,"samples":48,"terminal":false,"horizon":45},"platform":"darwin","architecture":"arm64","node":"v22.23.1"}
```

This is CPU simulation timing in Node, not browser frame rate or GPU performance. The main implementation now runs forecasts in a worker and caches navigation fields. The earlier uncached version took approximately 745 ms for just four rollouts at a coarser 0.2-second timestep. Recomputing the complete current forecast on the rendering thread would still be unsuitable: the measured final run is about 2.6 seconds. These timings include ordinary machine load and are not a controlled performance comparison. Worker scheduling and stale-result handling need browser verification.

## Probability interpretation and tuning

The implemented event is **no human reaches the final safety boundary within the next 45 seconds if everyone immediately follows the evacuation policy**. It includes futures where humans remain alive when the clock runs out. It is not the eventual probability of extinction, nor a prediction of what an arbitrary player will decide. First entry into the field is not safety; the relay and final gate matter. A survivor already beyond the final boundary makes the event impossible and returns exactly zero without sampling.

The estimator runs the same exported `step` function and 0.1-second timestep as live play, with a forecast mode that substitutes the stated evacuation policy. Each rollout receives a separate deterministic random seed. Tests verify that these predictions do not modify the live state or advance its random stream. Reusing the seed set makes comparisons reproducible.

An exploratory 16-sample sweep, using the current player spawn `(7,26)` and the final outdoor evacuation behavior, informed the opening delay:

| Initial hunter delay | Deadline failures / 16 |
| --- | ---: |
| 8 seconds | 11 |
| 8.5 seconds | 6 |
| 9 seconds | 0 |
| 9.5 seconds | 0 |

The final default is 8.5 seconds. Direct outdoor steering and allowing evacuation straight to the gate after relay activation shorten the route, so earlier forecasts with the 10-second delay no longer describe this build. The steep delay sensitivity is an outstanding balancing risk: this map has a sharp race to its choke points. The benchmark and paired intervention results above use the final source configuration.

48 samples give a resolution of roughly 2.1 percentage points; they do not give 2.1-point statistical accuracy. At an observed 50%, the binomial standard error is about 7.2 percentage points. Zero observed failures in a nonterminal forecast does not mean the true model risk is exactly zero. This first slice has internal simulation consistency, not empirical calibration against human play.

## Findings and limits

- **Forecast blocking was addressed in source:** navigation caching plus a Web Worker. A browser check is still needed to validate visible updates while estimates run.
- **Trivial initial forecast was addressed in source:** the final opening delay is 8.5 seconds, with nontrivial forecast variation and meaningful physical-intervention differences. Earlier 10-second timing became too generous after outdoor navigation improved.
- **Two crate pushes are necessary:** one push opens the original tile but leaves the crate in the next choke tile. A second push makes the west route useful. This is tested through movement and actual interaction calls.
- **Friendly blast placement matters:** soft human separation can push a companion outside the blast radius before detonation. The blast fixture separates the two intended victims enough to avoid conflating that rule with explosion behavior.
- **Weapon handoff fix verified:** `give()` now requires line of sight. A regression places two humans within handoff range on opposite sides of the cracked wall; the handoff fails until the obstruction is removed.
- **Explosion proximity fix verified:** a blast now gives the hunter a two-second stun only inside four metres. Regression cases at 3.9, 4, and 12 metres verify both the useful close-range effect and absence of global stun.
- **Wider field collision verified:** the field permits positions between `x=-80` and `x=110`, bounded at `z=-70`; the fence band between `z=-33` and `z=-31` remains blocked outside the gate opening `x=15..19`, even after the relay is activated. Movement stops at a closed gate and proceeds to safety after unlocking it.
- **Wider field pursuit fix verified:** the dungeon navigation field still spans 17 columns, but actors now steer directly between visible outdoor points. Regression fixtures around `x=55..65` verify companion follow and hunter pursuit beyond the old grid. Obstructed outdoor routes still fall back to the limited grid; arbitrary future meadow obstacles would require expanded navigation.
- **Rescue connectivity verified:** once the relay is active, bots target final safety and can use the west rescue hatch. The regression obstructs the main exit and verifies west-hatch crossing followed by safety. With both exits open, Manhattan-distance ties may still favor the east hatch; opening rescue does not guarantee every bot chooses it.
- No difficulty/fairness claim follows from these tests. Armed companions currently suppress the hunter very effectively. Multiple bots can extend that protection further. The initial opening-delay sensitivity and this weapon strength need human playtesting.
- The fail/retry test verifies reconstruction with `createState`; the actual menu/restart input is owned by browser QA. The all-escape script invokes simulation policy directly and is **not** a real keyboard bot test.
- Screenshots, canvas pixel metrics, renderer diagnostics, visual regression baselines, mobile controls, and audio were outside this simulation subtask. The prototype should not be described as release-ready based on this report.

## Reference ledger

| Reference | Read | Note |
| --- | --- | --- |
| `~/.codex/skills/threejs-qa-release/SKILL.md` | Yes | Simulation portion of the QA workflow applied. |
| `~/.codex/skills/threejs-qa-release/references/qa-release-checklists.md` | Yes | Required checklist consulted; browser/release portions deferred to separate task. |
| `~/.codex/skills/threejs-qa-release/references/checklists/playtest-qa.md` | Yes | Correct resolved location. Requested `checklists/playtest-qa.md` at skill root does not exist. |
| `~/.codex/skills/threejs-qa-release/references/playtest-bot.md` | Yes | Direct simulation tests added; real-input bot not claimed here. |
| `~/.codex/skills/threejs-qa-release/references/checklists/bot-playtest.md` | Yes | Metrics reported with seed, ticks, time, and progression. Browser console/input criteria deferred. |
| `~/.codex/skills/threejs-debug-profiler/references/debug-profile-checklists.md` | Yes | Fixed timestep and measured forecast CPU bottleneck checked. |

Visual harness decision for this subtask: skipped because it owns only simulation tests; the separate visual pass must make its own decision. Direct simulation playtest decision: added with the coverage and limitations above.
