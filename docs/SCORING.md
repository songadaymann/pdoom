# Two-level rescue score and leaderboards

The game publishes only the current boards for Level 1, The Control Problem
(E1M4), and Level 2, Confabulation Station (E1M7). Each level has one total-score
board. The shared view has a Level 1 / Level 2 switch and displays only rank,
name and score.
Both use v3 board keys and the rescue-v2 scoring formula. Earlier board versions
are retired from the menu and API registration; their stored records are retained
without mixing them into the current boards.

## Rescue score v2

| Component | Points | Rule |
| --- | ---: | --- |
| Rescued figures | 10,000 each | Five unique figures per level; count only those who actually escape. |
| CEO | 1,000 | Conscious at escape. A carried/downed CEO earns no CEO bonus. |
| Cameras | 250 each | Unique destroyed cameras, nine per level. Quietly turning one away earns no destruction points. |
| Speed | Up to 2,000 | `round(2000 × 600 / (600 + activeSeconds))`. |
| Outlook | Up to 1,000 | `10 × (100 − pDoomAtCoverOpen)`. |

One additional figure outweighs all other bonuses combined. A complete rescue
at ten minutes with nine cameras and 5% cover-opening p(DOOM) scores **55,200**:
50,000 + 1,000 + 2,250 + 1,000 + 950. The authored outlook is an in-world estimate;
it is not a calibrated forecast or a countdown. The pre-escape minimum is 1%,
so the attainable outlook bonus is at most 990. Final p(DOOM) is also recorded.

Each level ranks the highest v2 total from a completed eligible escape. Rescue,
camera and timing details stay on the results card. The former Perfect rescue and
Clean sweep time boards are retired from the menu, submissions and API; their
stored records are retained. Existing total-score records keep their current keys.

Board keys are `<level-id>-rescue-v3`, with level IDs `five-prisons` and `hal-station`.
Skill 3 is the standard ruleset. Only a fresh cold entry qualifies; hub returns,
replays, retreats, development endings and console/cheat-assisted runs are
practice. A death or body transfer never restarts the active clock. Failed
attempts have no escaped score. Native restart makes a new attempt from the
committed campaign baseline; it does not make a hub entry eligible.

The native engine owns the 35-tic active clock. Story cards, menus and platform
panels pause it. Completion freezes time and outlook once; meadow walking and
submission retries cannot change the score. The results card waits for the
visible companion arrivals without extending the frozen time.

## Integration

`doom-web/levels.js` defines level/version/board metadata. Run
`node scripts/sync-level-boards.mjs` after changing descriptors. Generated
`mann-cool-leaderboards.json` and `mann-cool-shell-theme.json` are publishing
inputs. Only current `LEVELS` are published; `ARCHIVED_LEVELS` retains historical
descriptors. Never reuse an old board key when the map or scoring becomes incomparable.

The shared mann.cool v1 shell owns board viewing, guestbook, support and play
tracking. The game owns scoring, eligibility, name entry and retryable submission.
A single completed attempt submits once to its level's total-score board via
`POST /api/v1/leaderboard`; retry uses the identical per-run/per-board submission
ID and frozen metadata. Metadata includes CEO choice/state, skill, entry type,
retreat, level/score versions, saved figures, camera totals, native active time,
cover/final p(DOOM), routes and point breakdown. The total score is an integer. The shell preserves any already-open native pause/menu state.

The loopback server labels its boards **Local leaderboard** and stores them in
`output/local-leaderboards/scores.json`. Browser QA uses an isolated fixture store;
no tests submit public scores. The public p(DOOM) API now validates the rules and
recalculates scores as described below. This remains a casual board without proof
of gameplay. Its normal ordering is score then
creation time, and it lists best runs rather than guaranteeing one row per person.

## Server rules validation (option 1)

The mann.cool Worker issues a ticket through `POST /api/v1/pdoom/runs` for each
current map/version and client run UUID. A private, random browser nonce makes
ticket acquisition retryable after an uncertain response; only its hash is stored
on the server. Score submissions carry `{runTicket: {id, token}}` separately from
public metadata. Both `/api/v1/leaderboard` and the legacy `/api/leaderboard` enforce
the same p(DOOM) checks. Other games keep their existing contracts.

The server requires an escaped, fresh, non-practice skill-3 result; validates
survivor/CEO/camera counts, map and rules versions, outlook and the 35-tic clock;
and requires the level's current total-score board. It calculates the score and
breakdown
itself. One atomic completion fingerprint binds a ticket to the same result,
player and name. Repeating a submission ID cannot
create another row or change its stored score. Saved results from before the
simplification retain their original total-score submission identity and name;
retired categories are filtered from both pending and accepted lists.

Tickets last 90 days while unused; completed-ticket retries remain valid. There
are no heartbeat deadlines, guessed minimum completion times, or wall-clock
comparisons that penalize pausing, tab suspension or a lost connection. Ticket
requests start with the native run and retry on submission if the service was
unavailable. Acquisition failures never prevent playing. Completed eligible
results and partial-submission progress are retained in browser storage; **Saved
Results** in the main menu restores them after a refresh. Blocked/full browser
storage still permits current-tab retries.

`validation: server-rules-v1` means the rules and calculation were checked. It
does not prove the browser's reported events happened. A fabricated but internally
consistent run can still pass option 1. Replay verification (option 2) must reproduce
the official simulation before any stronger claim is made.

See [LEVELS.md](LEVELS.md) for adding further maps and campaign transitions.
