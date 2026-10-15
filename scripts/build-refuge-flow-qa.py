"""Native refuge probes in a private copy; no player-pack test bindings."""
from pathlib import Path
import zipfile,tempfile
root=Path(__file__).resolve().parents[1]
out=root/'output/refuge-flow/qa.pk3';out.parent.mkdir(parents=True,exist_ok=True)
handler='''class PDRefugeFlowQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        let game=PDCheckpoint.Get();if(!game||!game.Initialized)return;
        if(e.Name=="pdoom_qa_refuge_at")
        {
            Vector2 xy=(e.Args[0],e.Args[1]);let sec=level.PointInSector(xy);
            players[0].mo.SetOrigin((xy,sec.floorplane.ZatPoint(xy)),false);
            players[0].mo.Vel=(0,0,0);players[0].mo.Angle=e.Args[2];players[0].mo.Pitch=0;
        }
        if(e.Name=="pdoom_qa_refuge_release")game.OpenCell(e.Args[0],"qa-guide");
        if(e.Name=="pdoom_qa_refuge_quiet")
        {
            if(game.Hunter){game.Hunter.StunUntil=level.time+100000;game.Hunter.AimTics=0;}
            if(PDCampaignSession.Hal())game.Hal.Pacified=true;
        }
        if(e.Name=="pdoom_qa_refuge_report")
        {
            Vector2 at=PDCampaignSession.Hal()?(192,352):(1168,800);let sec=level.PointInSector(at);
            Console.Printf("PDOOM_REFUGE_QA {\\"height\\":%.1f,\\"sealed\\":%d,\\"introduced\\":%d}",sec.ceilingplane.ZatPoint(at)-sec.floorplane.ZatPoint(at),game.Refuge.Sealed,game.Refuge.Introduced);
        }
    }
}
'''
with tempfile.NamedTemporaryFile(prefix='.qa-',suffix='.pk3',dir=out.parent,delete=False) as p:pending=Path(p.name)
with zipfile.ZipFile(root/'doom-web/pdoom.pk3') as src,zipfile.ZipFile(pending,'w',zipfile.ZIP_DEFLATED) as dst:
 for item in src.infolist():
  data=src.read(item.filename)
  if item.filename.upper()=='ZSCRIPT':data+=b'\n#include "actors/RefugeFlowQA.zs"\n'
  if item.filename.upper()=='MAPINFO':data=data.replace(b'"PDPlatformPanel"',b'"PDPlatformPanel", "PDRefugeFlowQA"',1)
  dst.writestr(item.filename,data)
 dst.writestr('actors/RefugeFlowQA.zs',handler)
pending.replace(out)
