# mann.cool publication plan

Requested 2026-10-15: publish the current Doom-browser game at https://mann.cool/pdoom/,
using existing game artwork as inspiration for the catalog's NES cartridge.

1. Inspect the current catalog checkout, routes, shell and score integration; preserve unrelated work.
2. Prepare a clean public source repository with GPL-3.0 licensing, no private media or secrets.
3. Adapt the existing allowlisted Doom runtime for the /pdoom/ prefix and existing shared shell.
4. Generate a cartridge from the existing red-bunker hero/banner art and a trailer hover loop.
5. Validate preview, publish the dedicated game Worker, add the catalog/source link, and deploy the catalog.
6. Verify canonical title, native levels, SAFE MODE, assets/media ranges, shell, scores and responsive UI.

The existing friends playtest stays available for rollback. The game remains free to play.

## Completed 2026-10-15

- Canonical game https://mann.cool/pdoom/ is served by `mann-cool-pdoom`, version `aed0cd42-b867-477b-8d09-0bb770b7be5a`.
- Catalog production branch `redesign/platform-v1`, commit `b72b328`; central Worker version `7608c748-f209-467d-8b73-cce0a5fc37ba`.
- Public GPL-3.0-only code: https://github.com/songadaymann/pdoom. Runtime media is separate; see ASSETS.md. Secret scanning and push protection are enabled.
- Cartridge: exact 800x1200 RGBA NES cartridge inspired by existing red bunker banner and title heroes. Matching trailer supplies 5 seconds of hover action; touch/reduced-motion/data-saver visitors keep static art.
- Canonical verifier passed root, engine, mod, art, meadow, and media byte ranges. Both native levels passed title/menu/films/movement/audio/Escape pause/revisit checks. New Game passed prologue and guide intro. Real saved-game loading and both SAFE MODE exits passed; real save remains unchanged.
- Shared shell passed desktop, phone and tablet checks, 15 board reads/toggles, player panel, configured Tip, Patreon, home, single automatic play event, theme opacity and HUD clearance. Guestbook opens the catalog's existing guestbook, read-only during verification. Desktop fullscreen passed.
- Four live catalog asset hashes match the local build. Cover/GIF behavior passed hover, touch, reduced motion and data saver checks.
- A clean archived source tree installed dependencies and built the fallback; runtime setup downloaded and checksum-verified 1745 files from the canonical host, and the meadow rebuilt successfully.
- Game build and 33 unit/simulation checks passed. No guestbook posts, score submissions, or email-linking requests were made.
- Requires current desktop Chrome/Edge with WebAssembly JSPI. Phone/tablet checks are emulated UI checks; physical mobile native-engine compatibility is not claimed in the catalog.
- The previous friends preview remains available for rollback.

Direct late-game visit: https://mann.cool/pdoom/?safemode=1 (in-memory test state).

Local verification reports are ignored under `output/playtest/canonical/` and `output/playtest/canonical-shell/`.
