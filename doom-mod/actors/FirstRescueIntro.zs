// A resource-free first rescue teaches tools and crawling before combat.
class PDFirstRescueIntro : Object play
{
    bool Opened;
    static bool Gate(int tag) { return tag==894 || tag==895 || tag==897; }
    bool Locked(PDCheckpoint game,int tag)
    {
        return !PDCampaignSession.Hal() && Gate(tag) && !game.Cast.People[0].Released && game.Cast.People[0].Alive;
    }
    String Prompt(PDCheckpoint game)
    {
        if(PDCampaignSession.Hal()||Opened)return "";
        let pawn=players[0].mo;
        for(int i=0;i<3;i++)
        {
            Vector2 at=(1400,i==0?1152:i==1?800:448),delta=at-pawn.Pos.XY;
            if(delta.Length()<144&&cos(atan2(delta.Y,delta.X)-pawn.Angle)>.65)
                return "Bulkhead sealed - free the captive";
        }
        return "";
    }
    void Tick(PDCheckpoint game)
    {
        if(PDCampaignSession.Hal()||Opened||Locked(game,894))return;
        Opened=true;
        Door_Open(894,24);Door_Open(895,24);Door_Open(897,24);
        game.HunterNav.Ready=false;game.HunterNav.HasWaypoint=false;
        for(int i=0;i<game.Cast.People.Size();i++)
        {game.Cast.People[i].Nav.Ready=false;game.Cast.People[i].Nav.HasWaypoint=false;}
    }
    void Report()
    {
        if(PDCampaignSession.Hal()){Console.Printf("PDOOM_INTRO null");return;}
        Vector2 north=(1400,1152),south=(1400,800),service=(1400,448);
        let a=level.PointInSector(north),b=level.PointInSector(south),c=level.PointInSector(service);
        Console.Printf("PDOOM_INTRO {\"opened\":%d,\"north\":%.1f,\"south\":%.1f,\"service\":%.1f}",Opened,
            a.ceilingplane.ZatPoint(north)-a.floorplane.ZatPoint(north),
            b.ceilingplane.ZatPoint(south)-b.floorplane.ZatPoint(south),
            c.ceilingplane.ZatPoint(service)-c.floorplane.ZatPoint(service));
    }
}
