# Replay verification experiment — 2026-10-15

Option 2 was tested locally; it is not enabled for public rankings. The shipped
engine and mod remain unchanged. A test-only worker response exposes the engine's
in-memory filesystem so the script can export an LMP recording and preload it
into a new browser context. No filesystem bridge is published.

## Results

Short native recordings covered ordinary keyboard movement, turning, interaction,
a menu opening/closing, and continued movement. Fresh playback contexts used the
same engine, assets and launch configuration. Native JSON state was compared at
matching world tics, including player state, the hunter and companions, equipment,
cameras and puzzle counters.

| Map | Hero | Matching state samples | Demo bytes | Active tics added during menu pause |
| --- | --- | ---: | ---: | ---: |
| Level 1 | Sam | 27 | 2130 | 21 |
| Level 1 | Dario | 26 | 2130 | 21 |
| Level 2 | Sam | 27 | 2128 | 21 |
| Level 2 | Dario | 27 | 2128 | 21 |

All 107 compared samples matched. These are reported state samples from short runs,
not full engine-memory comparisons or completed rescue verification.

Native recording changes pause behavior: opening the menu did not freeze the
world or rescue clock. Each 700 ms observation advanced the clock instead. Normal
non-recording play still pauses correctly in the ranked browser test. Enabling
recording unchanged would alter legitimate runs and must not be shipped as-is.

## Before using this for rankings

- Preserve the game's existing pause semantics with explicit recorded pause events
  or another recorder integration, then repeat the comparisons.
- Test complete eligible rescues and exact final score components on both levels,
  both heroes, legal starting loadouts, and pause/tab-suspension/restart paths.
- Reproduce playback in the proposed server environment with pinned builds and RNG.
- Treat demo files as untrusted. Enforce official starting state, allowed settings
  and commands; do not accept arbitrary saves, mods, cheats or privileged events
  embedded in a submitted recording. Bound replay size, CPU and execution time.
- Keep unavailable/failed verification separate from cheating: retain the recording
  and pending result while technical failures are retried or investigated.

## Reproduce

Start the normal loopback Doom server, then run:

```sh
npm run test:doom:replay
```

An optional `REPLAY_CASES=five-prisons-altman` selects one case. Generated LMPs,
JSON traces, screenshots and the report go to ignored `output/replay-feasibility/`.
The command checks state replay; the report separately records the pause failure.

Pinned WASM SHA-256: `d46b5a348ca041090467aaa376c4e36a4228476c2a30e66ca564c1cf3516c477`.

Pinned mod SHA-256: `131c1fd32c2b8b4fa32057f5fa140ab571fe1caee149c3ccab36125bb51fff09`.
