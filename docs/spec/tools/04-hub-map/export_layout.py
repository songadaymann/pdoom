"""Export the hub layout (docs/spec/04-bliss-hub-world.md) as JSON: python3 export_layout.py"""
import json,sys,os
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,HERE)
from hub import *
SITES={'M1 Minesweeper Meadow':{'rect':[70,97,38,65]},'M2 Doom Debates (radio show; camp stage after Liron is freed)':{'at':[-44,-10]},'M4 SkiFree north run':{'pathRef':'skiRun.north'},
 'M9 3D Pipes':{'at':[-95,45]},'M10 Paint wall':{'at':[-42,-36]},'M11 phone booth':{'at':[137,79]},'M12 Start monolith':{'at':[-14,-44]},
 'M13 Recycle Bin':{'at':list(CAMP)},'M15 Hover arena':{'rect':[-15,75,100,160]},'M16 Pinball knoll':{'at':[-75,105]},'M17 Defrag yard':{'at':[50,-186],'pad':[50,-186,9,6,8.89]},'M22 My Briefcase':{'at':[16,-44]}}
VISTAS={'V1 crest':[-45,-92],'V2 Shoulder Pass':[66,-96],'V3 AGENTIC roof':[150,98],'V4 MEG3N tower catwalk':[-178,22],'V5 bunker door':[17,-3]}
lay={
 "units":"metres; x east, z south (north = -z), y up; facing = degrees clockwise from north",
 "playArea":{"x":[-240,230],"z":[-262,200],"current":{"x":[-180,200],"z":[-220,180]}},
 "newHills":[list(h) for h in NEW_HILLS],
 "terrainFade":"continuous: h*smooth(0,14,distToApronRect(x,z)), apron x -4..38, z 0..34 (replaces the z<0 / z>=0 split in bliss.ts groundY; mirror in GROUND_GLSL). Required before adding newHills.",
 "pads":{k:{"cx":v[0],"cz":v[1],"r":v[2],"blend":v[3],"y":round(PADY[k],2)} for k,v in PADS.items()},
 "structures":{k:{"file":s['name'],"episode":s['episode'],"guardian":s['guardian'],"map":s['map'],"centre":list(s['c']),"width":s['w'],"depth":s['d'],"facing":s['face'],"door":list(s['door']),"spawn":list(s['spawn']),"groundY":round(gy(*s['c']),2)} for k,s in STRUCT.items()},
 "camp":{"centre":list(CAMP),"radius":16,"slotsRadius":11,"slots":20},
 "finalDoor":{"kind":"SSMAZE.SCR: giant Display Properties dialog (Wait: n survivors) beside a flush hatch; a 16 m CRT rises from the hatch at 20/20 (docs/GAME-SPEC.md section 8.1)","centre":list(CREST),"size":[14,10],"facing":"south-east, toward bunker door (05)","plateauClearRadius":25,"summitJunction":list(JUNCTION),"processionSpur":[list(p) for p in SUMMIT_SPUR]},
 "skiRun":{"north":[list(p) for p in SKI],"southSchuss":[list(JUNCTION),[-8,-60],list(CAMP)]},
 "landmarks":{"hal3000Eye":{"anchor":[EYE['x'],EYE['z']],"altitude":EYE['alt'],"diameter":12,"orbitRadius":15,"orbitPeriodS":90},
   "meg3nTower":{"at":[-178,22],"height":35},"agenticTower":{"height":60,"spinner":10,"phoneBooth":[137,79]},
   "controlMast":{"at":[23,3],"height":9},
   "dataCentre":{"at":[-40,-470],"size":[220,60],"height":25,"coolingTowers":45,"note":"your lab: the one that wakes"},"otherLabDataCentre":{"at":[190,-480],"size":[160,50],"height":22,"note":"the other CEO's lab: stays dark"},"mcpColumn":{"at":[60,900],"height":260,"diameter":50},
   "giantCursor":{"home":"25 m above the final door (hourglass while locked)","awayAltitude":45,"height":9,"speed":6,"returnWithinM":60,"returnAfterS":45}},
 "routes":{k:{"points":[list(p) for p in v],"lengthM":round(plen(v)[0]),"climbM":round(plen(v)[1])} for k,v in ROUTES.items()},
 "minigameSites":SITES,"vistas":VISTAS,
}
out=os.path.join(HERE,'..','..','hub-layout.json')
open(out,'w').write(json.dumps(lay,indent=1));print('wrote',os.path.normpath(out))
