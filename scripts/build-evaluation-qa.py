"""Private native carry fixture; no test hooks enter the shipped pack."""
from pathlib import Path
import zipfile,tempfile
root=Path(__file__).resolve().parents[1]
handler='''class PDBoardQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        let game=PDCheckpoint.Get();if(!game||!game.Hal)return;
        if(e.Name=="pdoom_qa_board")
        {
            let pawn=players[0].mo;Vector2 xy=(e.Args[0],e.Args[1]);
            double z=level.PointInSector(xy).floorplane.ZatPoint(xy);
            pawn.SetOrigin((xy,z),false);pawn.Vel=(0,0,0);pawn.Angle=e.Args[2];pawn.Pitch=0;
        }
        else if(e.Name=="pdoom_qa_board_hunter")
        {
            let b=game.Hunter;Vector2 xy=(-1312,-2656);
            b.SetOrigin((xy,level.PointInSector(xy).floorplane.ZatPoint(xy)+8),false);b.StunUntil=level.time+100000;
        }
        else if(e.Name=="pdoom_qa_board_cameras")
        {
            for(int i=0;i<game.Combat.Cameras.Size();i++)
            {let c=game.Combat.Cameras[i];c.Broken=e.Args[0]==1;c.Turned=e.Args[0]==2;}
        }
    }
}
'''
out=root/'output/board-carry/qa.pk3';out.parent.mkdir(parents=True,exist_ok=True)
with tempfile.NamedTemporaryFile(prefix='.qa-',suffix='.pk3',dir=out.parent,delete=False) as pending:
    temporary=Path(pending.name)
with zipfile.ZipFile(root/'doom-web/pdoom.pk3') as source,zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED) as target:
    for item in source.infolist():
        data=source.read(item.filename)
        if item.filename.upper()=='ZSCRIPT':data+=b'\n#include "actors/BoardQA.zs"\n'
        if item.filename.upper()=='MAPINFO':data=data.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDBoardQA"',1)
        target.writestr(item.filename,data)
    target.writestr('actors/BoardQA.zs',handler)

temporary.replace(out)
