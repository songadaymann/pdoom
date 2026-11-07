import {writeFile} from 'node:fs/promises';
import {SPEEDRUN_BOARD} from '../doom-web/speedrun.js';
import {SHELL_THEME} from '../doom-web/platform.js';
// One board since 2026-11-07: the whole-game speedrun (doom-web/speedrun.js, docs/SCORING.md).
const boards=[{...SPEEDRUN_BOARD,minimumMatches:1}];
await writeFile(new URL('../mann-cool-leaderboards.json',import.meta.url),JSON.stringify({boards},null,2)+'\n');
await writeFile(new URL('../mann-cool-shell-theme.json',import.meta.url),JSON.stringify(SHELL_THEME,null,2)+'\n');
console.log(`Prepared ${boards.length} leaderboard.`);
