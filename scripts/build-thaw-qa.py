"""Private test copy with one correct-height starting position, no rule changes."""
from pathlib import Path
import json,zipfile,math
root=Path(__file__).resolve().parents[1]
mount=next(p for p in json.loads((root/'output/hal/map-debug.json').read_text())['wall_mounts'] if p['kind']==29)
angle=math.radians(mount['angle'])
position=f"({mount['x']+math.cos(angle)*48},{mount['y']+math.sin(angle)*48},{mount['floor']})"
handler='''class PDThawQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        if(e.Name!="pdoom_qa_thaw_start")return;
        let pawn=players[0].mo;
        pawn.SetOrigin(POSITION,false);pawn.Vel=(0,0,0);pawn.Angle=HEADING;pawn.Pitch=0;
    }
}
'''.replace('POSITION',position).replace('HEADING',str((mount['angle']+180)%360))
out=root/'output/thaw-override/qa.pk3';out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(root/'doom-web/pdoom.pk3') as source,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as target:
    for item in source.infolist():
        data=source.read(item.filename)
        if item.filename.upper()=='ZSCRIPT':data+=b'\n#include "actors/ThawQA.zs"\n'
        if item.filename.upper()=='MAPINFO':data=data.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDThawQA"',1)
        target.writestr(item.filename,data)
    target.writestr('actors/ThawQA.zs',handler)
