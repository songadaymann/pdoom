"""Floor-correct camera setup in an isolated test pack, never shipped."""
from pathlib import Path
import zipfile,tempfile
root=Path(__file__).resolve().parents[1]
handler='''class PDEnvironmentQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        if(e.Name!="pdoom_qa_environment"||!players[0].mo)return;
        let pawn=players[0].mo;Vector2 xy=(e.Args[0],e.Args[1]);
        double z=level.PointInSector(xy).floorplane.ZatPoint(xy);
        pawn.SetOrigin((xy,z),false);pawn.Vel=(0,0,0);pawn.Angle=e.Args[2];pawn.Pitch=0;
    }
}
'''
out=root/'output/inhabited-levels/qa.pk3';out.parent.mkdir(parents=True,exist_ok=True)
with tempfile.NamedTemporaryFile(prefix='.qa-',suffix='.pk3',dir=out.parent,delete=False) as pending:temporary=Path(pending.name)
with zipfile.ZipFile(root/'doom-web/pdoom.pk3') as source,zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED) as target:
 for item in source.infolist():
  data=source.read(item.filename)
  if item.filename.upper()=='ZSCRIPT':data+=b'\n#include "actors/EnvironmentQA.zs"\n'
  if item.filename.upper()=='MAPINFO':data=data.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDEnvironmentQA"',1)
  target.writestr(item.filename,data)
 target.writestr('actors/EnvironmentQA.zs',handler)
temporary.replace(out)
