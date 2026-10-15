// Beth's interlock and its local teaching live together. Her doors open only for an
// evaluation (one route per cell, 2026-10-11; the doubling pulse doors are gone).
class PDHalEvaluation : Object play
{
    bool Introduced,Compliant,NoticeRead;
    void OpenDoors(bool interrupt=false)
    {
        for(int i=0;i<2;i++)
        {
            Vector2 at=i==0?(400,-1408):(944,-1408);
            let sec=level.PointInSector(at);
            if(interrupt&&sec.ceilingdata){sec.ceilingdata.Destroy();sec.ceilingdata=null;}
            Door_Open(i==0?881:889,24);
        }
    }
    double FrontClearance()
    {
        let sec=level.PointInSector((400,-1408));
        return sec.ceilingplane.ZatPoint((400,-1408))-sec.floorplane.ZatPoint((400,-1408));
    }
    void Tick(PDCheckpoint game)
    {
        let pawn=players[0].mo;
        bool evaluated=level.time<game.Hal.EvaluationUntil;
        if(evaluated&&!Compliant)OpenDoors(true);
        if(Compliant&&!evaluated&&!game.Cast.People[4].Released)
        {Door_Close(881,24);Door_Close(889,24);}
        Compliant=evaluated;
        if(game.Cast.People[4].Released)return;
        // The notice is readable in the world and gets one short transcription
        // when actually seen, without revealing the captive's biography.
        if(!NoticeRead)
        {
            let it=ThinkerIterator.Create('PDEvaluationNotice');let notice=Actor(it.Next());
            if(notice&&pawn.Distance2D(notice)<224&&cos(pawn.AngleTo(notice)-pawn.Angle)>.8&&pawn.CheckSight(notice))
            {NoticeRead=true;game.Say("Evaluation protocol: open safety doors. Cooperate with inspectors.",210);}
        }
        bool near=(pawn.Pos.XY-(352,-1408)).Length()<192;
        if(near&&!Introduced)
        {
            Introduced=true;
            if(!evaluated)game.Speak(-2,"This corridor stays sealed. No inspection is scheduled.",175,"sealed");
        }
        if(evaluated)OpenDoors();
        if(PDCheckpointMap.SiteInside(4,pawn.Pos.XY))game.OpenCell(4,"evaluation");
    }
}
class PDEvaluationNotice : Actor
{
    Default {Radius 1;Height 48;+WALLSPRITE +NOGRAVITY +NOBLOCKMAP}
    override void Tick()
    {
        Super.Tick();let game=PDCheckpoint.Get();
        if(game&&game.Hal)Frame=level.time<game.Hal.EvaluationUntil?1:0;
    }
    States {Spawn: HEVN AB -1;Stop;}
}
