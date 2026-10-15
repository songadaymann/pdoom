# Current playable build

| Area | Status | Owner / evidence |
| --- | --- | --- |
| Combat prologue: The Last Stand | Opt-in local prototype; four pop-culture war machines (Centurion, Sentinel, ED-404, Hunter-Killer), quiet first minute then slower growing waves, real Doom status bar, plain fade on defeat → Bliss walk (wake behind the dome, founder in the distance, crest reveal, spatial voice slots) → clean first rescue; test:doom:prologue passed | `doom-mod/actors/LastStand.zs`, `src/doom-bliss-guide.ts`, `art/war-robots-v1/`, `docs/COMBAT-PROLOGUE.md`, `output/prologue/` |
| First level: The Control Problem | Playable, local native checks passed; items (wrench, slingshot, key, charge, ball bearings, textbook) are Doom walk-over pickups, switches/doors stay on E; the rescue gun is now a slingshot (hold/release, quiet, lures the hunter to the impact) | `doom-mod/`, `progress.md` |
| Starting-room / ordinary-door interaction hint | Doom-style contextual E prompt; local/live escape checked | `doom-mod/actors/Checkpoint.zs`, `output/door-prompt/` |
| First-rescue onboarding | Rescue-linked bulkheads, crawl hint and later gun; native rescue/guide/return checks passed | `doom-mod/actors/FirstRescueIntro.zs`, `scripts/first-rescue-overlay.py`, `output/first-rescue-intro/` |
| Second level: Confabulation Station | Playable; cyan/amber/red HAL personality tested locally | `doom-mod/actors/HalPersonality.zs`, `progress.md` |
| Intro/menu/options/first-visit films | Playable, packaged preview checks passed | `doom-web/onboarding.js`, `output/playtest/local-verification/report.json` |
| SAFE MODE meadow/camps/autosave | Playable, packaged preview load checks passed | `src/doom-outside.ts`, `doom-web/campaign.js` |
| Friends playtest host | Deployed; remote browser/media/assets verified | `deploy/playtest/`, `output/playtest/verification/report.json` |
| Optional playtest scoreboards | Separate D1; local persistence/API checks and live reads passed | `deploy/playtest/worker.js`, `scripts/playtest-score-smoke.mjs` |
| mann.cool launch | Not published; user explicitly deferred | No catalog/domain changes |
| Later levels / distinct future refuge puzzles | Spec only | `docs/GAME-SPEC.md` |
