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
      "label": "Control · Rescue score",
      "metric": "rescueScoreV2",
      "metricLabel": "The Control Problem: saved + cameras + speed + outlook",
      "direction": "desc",
      "display": "integer",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "five-prisons-perfect-v3",
      "label": "Control · Perfect rescue",
      "metric": "perfectRescueActiveMs",
      "metricLabel": "The Control Problem: all 6 saved",
      "direction": "asc",
      "display": "time-ms",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "five-prisons-clean-sweep-v3",
      "label": "Control · Clean sweep",
      "metric": "cleanSweepActiveMs",
      "metricLabel": "The Control Problem: all 6 saved, all 9 cameras",
      "direction": "asc",
      "display": "time-ms",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "hal-station-rescue-v3",
      "label": "HAL · Rescue score",
      "metric": "rescueScoreV2",
      "metricLabel": "Confabulation Station: saved + cameras + speed + outlook",
      "direction": "desc",
      "display": "integer",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "hal-station-perfect-v3",
      "label": "HAL · Perfect rescue",
      "metric": "perfectRescueActiveMs",
      "metricLabel": "Confabulation Station: all 6 saved",
      "direction": "asc",
      "display": "time-ms",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "hal-station-clean-sweep-v3",
      "label": "HAL · Clean sweep",
      "metric": "cleanSweepActiveMs",
      "metricLabel": "Confabulation Station: all 6 saved, all 9 cameras",
      "direction": "asc",
      "display": "time-ms",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "five-prisons-rescue-v1",
      "label": "Control v1 · Rescue score",
      "metric": "rescueScoreV1",
      "metricLabel": "Five Prisons (legacy): saved + cameras + speed + outlook",
      "direction": "desc",
      "display": "integer",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "five-prisons-perfect-v1",
      "label": "Control v1 · Perfect rescue",
      "metric": "perfectRescueActiveMs",
      "metricLabel": "Five Prisons (legacy): all 6 saved",
      "direction": "asc",
      "display": "time-ms",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "five-prisons-clean-sweep-v1",
      "label": "Control v1 · Clean sweep",
      "metric": "cleanSweepActiveMs",
      "metricLabel": "Five Prisons (legacy): all 6 saved, all 9 cameras",
      "direction": "asc",
      "display": "time-ms",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "five-prisons-rescue-v2",
      "label": "Control v2 · Rescue score",
      "metric": "rescueScoreV2",
      "metricLabel": "Control v2: saved + cameras + speed + outlook",
      "direction": "desc",
      "display": "integer",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "five-prisons-perfect-v2",
      "label": "Control v2 · Perfect rescue",
      "metric": "perfectRescueActiveMs",
      "metricLabel": "Control v2: all 6 saved",
      "direction": "asc",
      "display": "time-ms",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "five-prisons-clean-sweep-v2",
      "label": "Control v2 · Clean sweep",
      "metric": "cleanSweepActiveMs",
      "metricLabel": "Control v2: all 6 saved, all 9 cameras",
      "direction": "asc",
      "display": "time-ms",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "hal-station-rescue-v2",
      "label": "HAL v2 · Rescue score",
      "metric": "rescueScoreV2",
      "metricLabel": "HAL v2: saved + cameras + speed + outlook",
      "direction": "desc",
      "display": "integer",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "hal-station-perfect-v2",
      "label": "HAL v2 · Perfect rescue",
      "metric": "perfectRescueActiveMs",
      "metricLabel": "HAL v2: all 6 saved",
      "direction": "asc",
      "display": "time-ms",
      "aggregation": "best",
      "minimumMatches": 1
    },
    {
      "variant": "hal-station-clean-sweep-v2",
      "label": "HAL v2 · Clean sweep",
      "metric": "cleanSweepActiveMs",
      "metricLabel": "HAL v2: all 6 saved, all 9 cameras",
      "direction": "asc",
      "display": "time-ms",
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
