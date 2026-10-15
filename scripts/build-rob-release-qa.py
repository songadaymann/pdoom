"""Private test copy: position the player on a real floor to test native walking."""
from pathlib import Path
import zipfile
root=Path(__file__).resolve().parents[1]
handler='''class PDRobReleaseQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        if(e.Name!="pdoom_qa_rob_walk")return;
        let pawn=players[0].mo;
        pawn.SetOrigin((-550,344,0),false);pawn.Vel=(0,0,0);pawn.Angle=180;pawn.Pitch=0;
    }
}
'''
out=root/'output/rob-emergency/qa.pk3';out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(root/'doom-web/pdoom.pk3') as source,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as target:
    for item in source.infolist():
        data=source.read(item.filename)
        if item.filename.upper()=='ZSCRIPT':data+=b'\n#include "actors/RobReleaseQA.zs"\n'
        if item.filename.upper()=='MAPINFO':data=data.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDRobReleaseQA"',1)
        target.writestr(item.filename,data)
    target.writestr('actors/RobReleaseQA.zs',handler)
