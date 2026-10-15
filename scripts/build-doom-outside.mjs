import {build} from 'vite';
await build({configFile:false,build:{outDir:'doom-web/outside',emptyOutDir:true,lib:{entry:'src/doom-outside.ts',formats:['es'],fileName:()=> 'outside.js'},sourcemap:true,chunkSizeWarningLimit:900}});
