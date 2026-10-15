"""Private actor positioning for native behavior tests; never shipped."""
from pathlib import Path
import zipfile,runpy
runpy.run_path(str(Path(__file__).with_name('build-evaluation-qa.py')))
root=Path(__file__).resolve().parents[1]
handler='''class PDPersonalityQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        let g=PDCheckpoint.Get();if(!g||!g.Hal)return;
        if(e.Name=="pdoom_qa_ball")
        {
            Vector2 xy=(e.Args[0],e.Args[1]);let b=g.Hunter;
            b.SetOrigin((xy,level.PointInSector(xy).floorplane.ZatPoint(xy)+8),false);
            b.Vel=(0,0,0);b.StunUntil=e.Args[2]?level.time+100000:0;
        }
        else if(e.Name=="pdoom_qa_camera")
        {
            for(int i=0;i<g.Combat.Cameras.Size();i++){let c=g.Combat.Cameras[i];c.Broken=i!=e.Args[0];c.Turned=false;}
        }
        else if(e.Name=="pdoom_qa_aim_camera")
        {
            let c=g.Combat.Cameras[e.Args[0]];let p=players[0].mo;
            Vector2 xy=c.Pos.XY+(cos(c.Angle),sin(c.Angle))*64;
            p.SetOrigin((xy,level.PointInSector(xy).floorplane.ZatPoint(xy)),false);p.Vel=(0,0,0);
            p.Angle=p.AngleTo(c);p.Pitch=-atan2(c.Pos.Z+c.Height*.5-p.Pos.Z-p.player.viewheight,64);
            g.HasWrench=true;g.Tool=0;
        }
        else if(e.Name=="pdoom_qa_module"||e.Name=="pdoom_qa_module_ball")
        {
            let it=ThinkerIterator.Create('PDHalTerminal');PDHalTerminal t;
            while((t=PDHalTerminal(it.Next()))!=null)if(t.Kind==50+e.Args[0])
            {
                if(e.Name=="pdoom_qa_module_ball")
                {let b=g.Hunter;b.SetOrigin((t.Pos.XY,t.floorz+8),false);b.StunUntil=level.time+100000;return;}
                let p=players[0].mo;Vector2 xy=t.Pos.XY+(0,16);
                p.SetOrigin((xy,level.PointInSector(xy).floorplane.ZatPoint(xy)),false);p.Vel=(0,0,0);
                p.Angle=p.AngleTo(t);p.Pitch=0;return;
            }
        }
        else if(e.Name=="pdoom_qa_exam")
        {
            let it=ThinkerIterator.Create('PDHalTerminal');PDHalTerminal t;
            while((t=PDHalTerminal(it.Next()))!=null)if(t.Kind==22)
            {
                let p=players[0].mo;Vector2 xy=t.Pos.XY+(cos(t.Angle),sin(t.Angle))*48;
                p.SetOrigin((xy,level.PointInSector(xy).floorplane.ZatPoint(xy)),false);p.Vel=(0,0,0);p.Angle=p.AngleTo(t);p.Pitch=0;
                if(e.Args[0]){let b=g.Hunter;b.SetOrigin(p.Pos+(0,0,8),false);b.StunUntil=level.time+100000;}
                return;
            }
        }
        else if(e.Name=="pdoom_qa_aim_ball")
        {
            let b=g.Hunter,p=players[0].mo;
            p.Angle=p.AngleTo(b);p.Pitch=-atan2(b.Pos.Z+b.Height*.5-p.Pos.Z-p.player.viewheight,p.Distance2D(b));
            g.HasWrench=true;g.Tool=0;
        }
    }
}
'''
out=root/'output/hal-personality/qa.pk3';out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(root/'output/board-carry/qa.pk3') as source,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as target:
 for item in source.infolist():
  data=source.read(item.filename)
  if item.filename.upper()=='ZSCRIPT':data+=b'\n#include "actors/PersonalityQA.zs"\n'
  if item.filename.upper()=='MAPINFO':data=data.replace(b'"PDBoardQA"',b'"PDBoardQA", "PDPersonalityQA"',1)
  target.writestr(item.filename,data)
 target.writestr('actors/PersonalityQA.zs',handler)
