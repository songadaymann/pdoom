import { createStaticGameWorker } from "./static-worker.js";
const game = createStaticGameWorker({
  "slug": "pdoom",
  "title": "p(DOOM)",
  "leaderboard": true,
  "leaderboardUrl": "",
  "leaderboardVariant": "five-prisons-rescue-v3",
  "leaderboardBoards": [
    {
      "variant": "five-prisons-rescue-v3",
      "label": "Level 1",
      "metric": "rescueScoreV2",
      "metricLabel": "Total score",
      "direction": "desc",
      "display": "integer",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "hal-station-rescue-v3",
      "label": "Level 2",
      "metric": "rescueScoreV2",
      "metricLabel": "Total score",
      "direction": "desc",
      "display": "integer",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "meg3n-factory-rescue-v1",
      "label": "Level 3",
      "metric": "rescueScoreV2",
      "metricLabel": "Total score",
      "direction": "desc",
      "display": "integer",
      "aggregation": "best",
      "minimumMatches": 1
    }
  ],
  "shellTheme": {
    "paper": "#241c17",
    "ink": "#dcc18e",
    "muted": "#bca67d",
    "rule": "#736250",
    "accent": "#ef573c",
    "panel": "#241c17",
    "panelInk": "#edca93",
    "panelMuted": "#bca67d",
    "field": "#100c09",
    "focus": "#ffe3a3",
    "font": "DoomSmall, monospace",
    "headingFont": "DoomSmall, monospace",
    "controlRadius": "0px",
    "panelRadius": "0px"
  }
});

// Preserve streaming media range support under the canonical prefix.
import {serveMedia} from '../deploy/playtest/media.js';
import media from '../deploy/playtest/media-manifest.json';
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.hostname==='www.mann.cool')return game.fetch(request,env,ctx);
 const assetPath=url.pathname.startsWith('/pdoom/')?url.pathname.slice(6):url.pathname;
 const film=media.find(m=>'/'+m.file===assetPath);
 if(film){url.pathname=assetPath;const response=await serveMedia(new Request(url,request),env,ctx,film);
  const headers=new Headers(response.headers);headers.delete('x-robots-tag');headers.set('x-mann-cool-delivery','dedicated-worker');
  return new Response(response.body,{status:response.status,headers});}
 return game.fetch(request,env,ctx);
}};
