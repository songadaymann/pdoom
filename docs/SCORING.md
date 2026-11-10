# Speedrun and leaderboard

Since 2026-11-07 p(DOOM) has **one leaderboard: how fast you beat the game.** Jonathan: "let's greatly simplify
the leaderboards. Let's just make it a speed run thing: One single leaderboard that measures how fast people can
beat the game."

It replaces the four per-level rescue-score boards (rescue-v2: 10,000 a figure, CEO, cameras, speed and outlook
bonuses), which never received a submission. Their stored rows and keys are retired, never reused.

The same day, nobody can be lost any more. "When a prisoner is lost, they have to restart that level that the
prisoner was lost on. There can be no lose of prisoners." Finishing the game always means all 20 home, so the
time is the only thing to rank.

## The rules

- **What's timed:** the whole game, from the moment a new campaign's first level starts to the moment the MCP
  goes down on the endgame page. The opening (prologue, XP intro) is skippable and doesn't count. Neither does
  the ending after the MCP falls.
- **Game time, not wall time:** the clock only runs while you can play.
  - In a level it's that level's own 35-tic clock (`PDOOM_RUN active_tics`). It stops for menus, story cards and
    platform panels.
  - In SAFE MODE it's the meadow's clock (`doom-outside.ts clock()`). It stops while the meadow is paused or the
    tab is hidden.
  - In the endgame it's the fight page's frame time (`mode-boss.ts`).
  - Films, loading screens and menus never count.
- **Restarts cost time:** someone you freed going down restarts the level (levels 1-2, `Checkpoint.zs
  LoseAll`); MEG3N or SMITH catching you does too (levels 3-4); and so does RESTART LEVEL or F5. None of them stop
  or rewind the clock. A Load Game resumes the same run at the same time.
- **Skipping (2026-11-09):** the films, the prologue, the guide's walks, a freed prisoner's card, the endgame's
  opening and its end can all be skipped, and the levels no longer end on a text screen. Skipping changes nothing in
  the rules: the films, cards and menus never counted, and the endgame's clock runs as before.
- **Any order:** after the first level, the other three can be played in any order. The route is part of the run.
- **One run per campaign:** New Game, or a level picked from the episode menu, starts a new campaign and a new run.
  An older save, made before this change, has no run. Its time can't be ranked; start a New Game.
- **Practice:** cheats (god, noclip and the rest), QA shortcuts (`pdoom_agentic_site`, `pdoom_factory_site`,
  `?puzzle=`), development endings (`?dev=end`), the SAFE MODE fixture (`?safemode=1`) and the endgame's test
  shortcuts (keys 1, 2, 3 and N, `?part=`, `?autosteer`, a tuned trick shot; since 2026-11-09) make the run practice. It
  keeps timing and shows `PRACTICE` but can't be submitted. Each level reports this as `assisted`, separately
  from a SAFE MODE walk-in, which is a normal part of a run.

The board is `campaign-speedrun-v1` (label Speedrun, metric `activeMs`, direction `asc`, display `time-ms`):
fastest first. Every submitted run is its own row. The shared shell shows times as minutes:seconds.hundredths, and
from an hour as h:mm:ss.cc (since 2026-11-09; a 75-minute run reads 1:15:00.00).

## In the game

- `doom-web/speedrun.js` owns the clock (`SpeedrunClock`), the board (`SPEEDRUN`, `SPEEDRUN_BOARD`) and the finished
  result (`speedrunResult`).
- The run lives in the campaign save, `pdoom.campaign.v1` `speedrun`: `{runId, splits, restarts, practice, done,
  startedAt}`. It's written every two seconds and whenever a level starts or ends, so it survives reloads, Load
  Game and the trip to the endgame page.
- The splits are `five-prisons`, `hal-station`, `meg3n-factory`, `agentic-pods`, `safe-mode` and `endgame`, in
  milliseconds. The time is their sum.
- A timer sits at the top of the screen, in whole seconds, in levels, in SAFE MODE and in the endgame.
- The run asks the server for its ticket when it starts, and again at each level start until one arrives.
- Levels have no results card any more. The one card opens in the meadow after the MCP is down, with the time, the
  six splits, the restarts and name entry. Once the time is submitted it waits behind the Results button. Unsent
  results stay in **Saved Results** in the main menu.
- `run-score.js` only reads a level's native result now (`readLevelResult`); the levels have no score.

## Server rules

The mann.cool Worker (`worker/pdoom-scores.js` in the mann-cool repo, deployed from `redesign/platform-v1`) issues
a ticket through `POST /api/v1/pdoom/runs` for `{levelId:"campaign", levelVersion:"campaign-v1",
scoreVersion:"speedrun-v1", boardVersion:"v1"}` and a client run ID. A private, random browser nonce makes ticket
acquisition retryable after an uncertain response; only its hash is stored. Submissions carry `{runTicket: {id,
token}}` apart from public metadata.

A submission to `campaign-speedrun-v1` must be a finished, non-practice run with 20/20 home, exactly the six
splits (every level and the endgame above 0), and `activeMs` equal to their sum. The server rebuilds the metadata
(`validation: server-rules-v2`) and ranks `activeMs`. One atomic completion fingerprint binds a ticket to one
result, player and name. Retries reuse the same submission ID (`<runId>:campaign-speedrun-v1`) and can't change a
stored time. The hero (`ceo`, `altman` or `amodei`) is optional metadata; it's left out, never sent as null.

Three checks hold a run for review instead of rejecting it:
- **Below 20 minutes.** This is an estimate, to tighten once real runs exist.
- **Faster than real time:** more active time than has passed since its ticket was issued. A ticket fetched late,
  for example offline at the start, can hold a genuine run.
- **Top ten (2026-11-09):** any time that would make the top ten of the approved board. Jonathan's challenge is judged
  on screen recordings, so whatever reaches the top has been checked by a person. `PDOOM_REVIEW_TOP` in the Worker's
  vars changes the ten.

**Videos (2026-11-09).** The results card takes an optional link to the run's recording (`videoUrl`: https, on a
known video site such as YouTube, Twitch, Vimeo, Google Drive or Dropbox). Once the time is in, the card keeps a
"Video of your run" field: Results, or Saved Results in the main menu, can add, change or clear the link later
from the browser that played the run (`POST /api/v1/pdoom/runs/video`, proven by the run's ticket and its private
token; `ranked-runs.js attachVideo`). The board shows a ▶ by the name, and the moderation list shows each held run's
link. The link isn't part of the time.

**One row per player; signing in for the challenge (2026-11-09).** The board (`aggregation: 'player-best'`) shows each
player once, with their best approved time. The results card sends the browser's mann.cool player secret with the time
(`mannCool.player.credential()`), so the server knows the player without trusting a claimed ID. Signing in is optional.
Jonathan: "if they want to have their run count for the contest, they have to sign in, but if they just want to put
their run there, they don't have to". The card says whether you're signed in. Its Sign in button opens the shell's
email panel, and the card comes back once you're in. A signed-in player's row has a ✓, and signing in later counts the
runs that browser already posted. Since 2026-11-09 a crypto wallet works too, Solana or Ethereum: the shell's panel lists the browser's wallets,
and signing a one-time Sign-In with Ethereum message (free, no transaction) links the address like an email. The top-ten hold counts players, not runs. The moderation list shows each run's
player, the email hint and how many other players posted from the same IP.

Held runs are stored as `pending` and stay off the board until approved. Retries keep that status, and the card
says the run is held. Moderation is `npm run leaderboard:moderate` in the mann.cool repo. It needs
`CLOUDFLARE_ACCOUNT_ID` set to the Novox account.

Tickets last 90 days while unused, so a run can span many sessions. These are plausibility checks, not proof: a
fabricated but consistent run can still pass. Replay verification would be needed for any stronger claim.

## Local and tests

- The loopback server (`scripts/serve-doom.mjs`) serves a **Local leaderboard** with the same one board, stored
  in `output/local-leaderboards/scores.json`.
- `node --test tests/*.test.mjs` covers the clock, the save, the result and the submission body.
- `scripts/ranked-score-browser-smoke.mjs` runs the whole path against a loopback copy of the mann.cool Worker
  (`npx wrangler dev --local --port 5202` in the mann-cool repo): menu start, ticket, timer, pause, the endgame
  split, the card and the submission.
- `scripts/simple-leaderboard-smoke.mjs` checks the shell's board view. `DOOM_URL=https://mann.cool/pdoom/` runs
  it read-only against the live board.

See [LEVELS.md](LEVELS.md) for adding further maps. A new level changes the game, so it needs a new speedrun board
key.
