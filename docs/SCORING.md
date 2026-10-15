# Two-level rescue score and leaderboards

The local game has separate v2 boards for The Control Problem (E1M4) and
Confabulation Station (E1M7). The three original Five Prisons v1 boards remain
registered as historical boards; their records never mix with v2.

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

Each level has three boards:

- **Rescue score:** highest v2 total from a completed eligible escape.
- **Perfect rescue:** shortest time with all five figures and a conscious CEO.
- **Clean sweep:** shortest time with all five figures, a conscious CEO, and all nine cameras destroyed.

Board keys are `<level-id>-rescue-v2`, `<level-id>-perfect-v2`, and
`<level-id>-clean-sweep-v2`, with level IDs `five-prisons` and `hal-station`.
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
inputs. Preserve old board keys whenever the map or scoring becomes incomparable.

The shared mann.cool v1 shell owns board viewing, guestbook, support and play
tracking. The game owns scoring, eligibility, name entry and retryable submission.
A single completed attempt submits at most once per qualifying board via
`POST /api/v1/leaderboard`; retry uses the identical per-run/per-board submission
ID and frozen metadata. Metadata includes CEO choice/state, skill, entry type,
retreat, level/score versions, saved figures, camera totals, native active time,
cover/final p(DOOM), routes and point breakdown. Time boards submit integer
milliseconds. The shell preserves any already-open native pause/menu state.

The loopback server labels its boards **Local leaderboard** and stores them in
`output/local-leaderboards/scores.json`. Browser QA uses an isolated fixture store;
no tests submit public scores. Public catalog registration and deployment remain
a separate release. The generic API trusts client scores; this is a casual board,
not a claim of tamper-proof verified play. Its normal ordering is score then
creation time, and it lists best runs rather than guaranteeing one row per person.

See [LEVELS.md](LEVELS.md) for adding further maps and campaign transitions.
