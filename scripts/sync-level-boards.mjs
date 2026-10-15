import {writeFile} from 'node:fs/promises';
import {LEVELS,boardsForLevel} from '../doom-web/levels.js';
import {SHELL_THEME} from '../doom-web/platform.js';
const boards=LEVELS.filter(level=>level.scored).flatMap((level,index)=>
  boardsForLevel(level).map(board=>({...board,label:`Level ${index+1} · ${board.label}`})));
if(new Set(boards.map(b=>b.variant)).size!==boards.length)throw Error('Leaderboard keys must be unique across levels.');
for(const level of LEVELS.filter(l=>l.scored)){
  if(level.camerasTotal*250+3000>=10000)throw Error(`${level.id}: side bonuses must be worth less than one survivor.`);
}
await writeFile(new URL('../mann-cool-leaderboards.json',import.meta.url),JSON.stringify({boards},null,2)+'\n');
await writeFile(new URL('../mann-cool-shell-theme.json',import.meta.url),JSON.stringify(SHELL_THEME,null,2)+'\n');
console.log(`Prepared ${boards.length} level-specific boards.`);
