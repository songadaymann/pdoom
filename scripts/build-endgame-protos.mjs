// Builds the endgame feel prototypes (prototypes/endgame/, docs/ENDGAME.md) into the ignored
// doom-web/endgame-proto/, served by scripts/serve-doom.mjs at /endgame-proto/.
import {build} from 'vite';
import {copyFile} from 'node:fs/promises';
const out='doom-web/endgame-proto';
await build({configFile:false,logLevel:'warn',build:{outDir:out,emptyOutDir:true,lib:{entry:'prototypes/endgame/main.ts',formats:['es'],fileName:()=>'proto.js'},sourcemap:true,chunkSizeWarningLimit:1200}});
for(const f of ['index.html','play.html'])await copyFile(`prototypes/endgame/${f}`,`${out}/${f}`);
console.log(`Built ${out}/`);
