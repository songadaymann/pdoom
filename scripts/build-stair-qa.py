"""Private floor-position fixture for reproducing stair drops with native input."""
from pathlib import Path
import zipfile
root=Path(__file__).resolve().parents[1]
handler='''class PDStairQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        if(e.Name!="pdoom_qa_stair")return;
        let pawn=players[0].mo;
        double x=e.Args[0],y=e.Args[1];
        double z=level.PointInSector((x,y)).floorplane.ZatPoint((x,y));
        pawn.SetOrigin((x,y,z),false);pawn.Vel=(0,0,0);pawn.Angle=e.Args[2];pawn.Pitch=0;
    }
}
'''
out=root/'output/stair-softlock/qa.pk3';out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(root/'doom-web/pdoom.pk3') as source,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as target:
    for item in source.infolist():
        data=source.read(item.filename)
        if item.filename.upper()=='ZSCRIPT':data+=b'\n#include "actors/StairQA.zs"\n'
        if item.filename.upper()=='MAPINFO':data=data.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDStairQA"',1)
        target.writestr(item.filename,data)
    target.writestr('actors/StairQA.zs',handler)
