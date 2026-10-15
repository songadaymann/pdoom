# Verification — local first slice

2026-10-04, macOS arm64, Node 22.23.1, installed Google Chrome. This is evidence for a local prototype, not a production-ready or premium-art claim.

## Results

- `npm ci --ignore-scripts` / dependency install: passed. Existing local skill scaffold was used; its unused demo files were removed. No unfamiliar reference code was downloaded or executed.
- `npm run build`: TypeScript and Vite production build pass. Approximately 592 kB main JavaScript before gzip (~154 kB compressed), plus a ~9 kB simulation worker; exact build outputs remain in `dist/`.
- `npm test`: **20/20 pass**, final simulation source. Detailed fixtures, commands and limitations: [SIMULATION-QA.md](SIMULATION-QA.md).
- `GAME_URL='http://127.0.0.1:4197/?test' node scripts/browser-smoke.mjs`: production browser interaction checks; machine-readable result and console errors at [report.json](../output/browser/report.json).
- Adapted bundled web-game client: actual A movement, arrow look and Space attack; [state](../output/adapted-client/state-0.json) records unpaused 0.9 simulated seconds and player movement from x7 to x6.19. The only harness adaptation was installed Chrome instead of SwiftShader, whose original run was too slow and did not exercise gameplay. This failure is not counted as a pass.
- Canvas inspector: [desktop active play](../output/canvas/desktop-active-play.json) and [mobile outside](../output/canvas/mobile-outside.json) verify nonblank varied pixels and collect renderer diagnostics. Errors are recorded in each JSON.

Browser smoke uses real keyboard/touch events at explicit position fixtures for individual interaction stations. It covers movement/look, collecting charge/gun, handing off gun, camera destruction, crate pushing, planted charge→wall opening, opening/walking through hatch, operating outdoor relay, opening secondary rescue hatch, walking across perimeter, control transfer, pause/resume/restart and touch movement. Hunter aim/shot and loss/restart checks were added to the final pass. It does **not** establish an unassisted human route playthrough, actual phone GPU performance, or enjoyment/balance.

## Images inspected

- [Starting crowd](../output/browser/start.png)
- [Adult crowd close view](../output/browser/crowd-forecast.png)
- [Field and rescue controls](../output/browser/outside.png)
- [Hunter aiming](../output/browser/hunter-aim.png)
- [Loss screen](../output/browser/loss.png)
- [Phone viewport](../output/browser/mobile.png)

The initial outside render was pale green with too many circular clouds. The revised original terrain uses deeper green, lower lighting exposure and fewer cloud silhouettes. First-person hands were reduced. A mobile test caught a companion mesh filling the camera when walking through the crowd; figures closer than 0.85m are now hidden from that camera to avoid head/body clipping. This is a rendering accommodation, not solid-body crowd physics.

## Simulation and probability evidence

The final state uses six adults, a hunter activation delay of **8.5 seconds**, a **0.1-second fixed simulation step**, **45-second forecast horizon**, and **48 futures**. Navigation caching reduced repeated work and the forecast runs off the render thread. Rendering interpolates movement between fixed simulation steps.

Final initial forecast: **13 / 48 futures fail to get anyone to final safety**, or **27.08%**. This is a sample under the declared policy, not an empirical probability for human players. The Node benchmark took 2.586 seconds under concurrent work; browser worker measurements were approximately 0.4–0.6 seconds in the captured runs. Current diagnostics give snapshot time, sample count, compute time and a 95% Wilson interval. The HUD can briefly show a stale estimate while new work is pending.

Paired 16-future fixture results with the same seed bank:

| State | Deadline failures |
| --- | ---: |
| Initial | 6 / 16 |
| Cameras disabled | 1 / 16 |
| Weak wall breached | 0 / 16 |
| One bot armed | 0 / 16 |
| Crate pushed twice | 0 / 16 |

These fixtures show the physical state changes affect the actual simulated outcomes. They do not prove every intervention always improves survival, nor that 0 observed failures means zero model risk. The full autonomous route saves all six after **35.4 simulated seconds** with the hunter suppressed to isolate navigation. Alternate rescue-hatch connectivity is verified with the main route blocked.

Opening-delay sensitivity is steep, and guns/shortcuts are strong. Balance and the reward for rescuing additional people after p reaches zero need human testing. Earlier intermediate forecasts (24/48 and 26/48) were superseded after navigation and spawn improvements; they are not the final baseline.

## Rendering and physics limits

Desktop active capture: around **175 draw calls / 90,536 triangles / 47 geometries / 12 textures** at 1280×720. Exterior independent capture: **40 calls / 60,002 triangles / 14 textures**. Exact current counts vary with camera and state and are in the JSON artifacts. Instanced walls/floors, shared figure resources, pixel ratio capped at 1.5, no postprocessing; one 1024 shadow map outside, contact shadows indoors. No sustained FPS claim is made from these snapshots.

Physics is custom deterministic 2D circle/grid collision in a 3D renderer: seven moving actors, fixed world tiles, dynamic crate/wall/hatches/gate, and proximity interaction/escape/blast triggers. Crates move in 2m increments; walls disappear as a unit; shots use visibility/range tests. There is no rigid-body pile, ragdoll, ballistic simulation or arbitrary demolition. Rendered exterior terrain height is visual; horizontal navigation uses the same flat-coordinate kernel.

## Workflow ledgers

| Skill / phase | State and evidence |
| --- | --- |
| `threejs-game-director` | Read; phase-playbook read; phases delegated per its workflow |
| `design-guardrails` | Read; square controls, minimal HUD, three text sizes |
| `threejs-gameplay-systems` | Read; design/level brief and simulation implemented/tested |
| `threejs-aaa-graphics-builder` | Read by visual worker; prototype art only, no premium completion claim |
| `threejs-game-ui-designer` | Read; HUD, controls, pause/help, outcomes and touch layout implemented |
| `threejs-debug-profiler` | Read; navigation performance, camera/body clipping, pointer-lock rejection and favicon error addressed |
| `threejs-qa-release` | Read; build, simulation, browser input, pixel and screenshot evidence |
| `develop-web-game` | Read; text-state/advanceTime hooks and adapted bundled action client used |
| External generator phase | Not undertaken: task requested a small local slice and no paid services. No credential-availability claim or paid-generation attempt; all art is acknowledged temporary authored code |

Required reference ledger (all files read by their phase owner):

- Director `references/phase-playbook.md`.
- Gameplay `gameplay-workflows.md`, `game-design-level-design.md`, `physics-engine-selection.md`, `checklists/new-game-definition-of-done.md`, `checklists/game-design-level-design.md`.
- Graphics `visual-scorecard.md`, `implementation-blueprint.md`, `model-recipes.md`, `render-recipes.md`, `technical-art.md`, `shader-cookbook.md`.
- UI `ui-patterns.md`, `checklists/game-ui-quality.md`, `checklists/hud-readability.md`, `checklists/responsive-ui-fit.md`.
- Debug `debug-profile-checklists.md`, `checklists/scene-debugging.md`.
- QA `qa-release-checklists.md`, `checklists/visual-verification.md`, `checklists/playtest-qa.md`, `checklists/release.md`; simulation worker additionally read `playtest-bot.md` and `checklists/bot-playtest.md`.

All names above resolve under `~/.codex/skills/<skill>/references/`. The catalog skills were available; `.agents/skills` was also inspected, with no missing relevant skill found. Visual snapshot-regression baselines are skipped while art and framing are provisional; deterministic fixture screenshots and nonblank pixel checks are present. Direct simulation bot playtests are added. No release-ready bot or human-play calibration is claimed.

Asset ledger: crowd / hunter / guns / interactable props / dungeon surfaces / grass / sky / clouds / signs are original procedural stand-ins in `src/art.ts` and `src/view.ts`; no external asset outputs. UI uses system fonts. Audio is absent. MakeHuman core assets and their CC0 status are verified but imports are not complete. Exact Doom, Bliss and chosen hunter-asset fidelity/rights remain unresolved as detailed in [REFERENCES.md](REFERENCES.md).

No public deployment, remote Git operation, purchase, or modification of unrelated projects occurred. Local dev and preview servers may remain running on loopback ports 5197 and 4197.

## Game design brief, core loop and level/encounter plan

Game design brief: vulnerable comic crowd survives through experimentation under lethal pursuit. Core loop: alter surveillance/route/equipment, move the group, read consequences, escape the hatch and operate the outside rescue mechanism. Level/encounter plan: authored supply room → blocked passage or central breach → north hatch → open field relay → final perimeter; the hunter activates after8.5 seconds and can follow outside. Full design and alternatives are in [DESIGN.md](DESIGN.md).

## Skill-loading ledger and phase ledger

The skill-loading ledger is the workflow table above. Phase ledger: gameplay systems done for the scoped first slice; external asset sourcing researched, final asset integration deferred; AAA graphics skipped as a premium phase, procedural prototype visuals implemented; UI done for scoped controls/states; debug/profile done for the observed issues; QA/release local verification passed with listed limitations, public release not requested. No phase claims final art or human-tested balance.
