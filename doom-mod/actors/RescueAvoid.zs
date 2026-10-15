// Released escorts briefly prioritize escaping a visible Terminator over following.
// Reuse the human clearance graph and native collision; no teleporting or noclip.
class PDRescueAvoid : Object play
{
    bool Fleeing;
    int PanicUntil;
    int ReplanAt;
    Vector2 Goal;
    Array<int> Seen;
    Array<int> Queue;
    Array<int> Depth;
    int Stamp;

    void Calm(PDRescuePerson p)
    {
        if (!Fleeing) return;
        Fleeing = false; PanicUntil = 0;
        p.Nav.AvoidThreat = false; p.Nav.Ready = false; p.Nav.HasWaypoint = false;
        if (p.Walking) p.Body.SetStateLabel('Walk'); else p.Body.SetStateLabel('Spawn');
    }

    void ChooseGoal(PDCheckpoint game, PDRescuePerson p)
    {
        int start = game.NodeAt(p.Body.Pos.XY,true), count = game.HumanLinks.Size();
        Goal = p.Body.Pos.XY;
        if (start < 0) return;
        if (Seen.Size() != count) Seen.Resize(count);
        if (Queue.Size() == 0) { Queue.Resize(512); Depth.Resize(512); }
        Stamp++;
        int head=0, tail=1;
        Queue[0]=start;Depth[0]=0;Seen[start]=Stamp;
        Vector2 regroup = game.Refuge.Guiding(p.Site) || p.RefugeArrival ? PDRescueRefuge.Slot(p.Site) : players[0].mo.Pos.XY;
        double best = -99999;
        while (head < tail)
        {
            int at = Queue[head], hops = Depth[head];head++;
            Vector2 point = PDCheckpointMap.Center(at);
            double score = (point-p.Nav.Threat).Length()*1.4 - (point-regroup).Length()*.25 - hops*2;
            if (game.Refuge.Known && PDRescueRefuge.Inside(point)) score += 400;
            if (score > best) { best=score;Goal=point; }
            if (hops >= 16) continue;
            for (int d=0;d<4;d++)
            {
                if (!(game.HumanLinks[at] & (1<<d))) continue;
                int next = at + (d==0?1:d==1?-1:d==2?PDCheckpointMap.Width():-PDCheckpointMap.Width());
                if (next<0 || next>=count || Seen[next]==Stamp || p.Nav.MaintenanceBlocked(game,next) ||
                    p.Nav.ThreatBlocks(point,PDCheckpointMap.Center(next))) continue;
                if (tail >= Queue.Size()) continue;
                Seen[next]=Stamp;Queue[tail]=next;Depth[tail]=hops+1;tail++;
            }
        }
        ReplanAt = level.time+18;
        p.Nav.Ready=false;p.Nav.HasWaypoint=false;
    }

    bool Tick(PDCheckpoint game, PDRescuePerson p)
    {
        let hunter = game.Hunter;
        if (PDCampaignSession.Hal() || !hunter || !game.Awake || p.Sheltered || PDRescueRefuge.Inside(p.Body.Pos.XY))
        { Calm(p); return false; }
        double distance = p.Body.Distance2D(hunter);
        bool danger = level.time >= hunter.StunUntil && distance < 480 && p.Body.CheckSight(hunter);
        if (danger) PanicUntil=level.time+53;
        if (!danger && (!Fleeing || level.time >= PanicUntil || distance > 672))
        { Calm(p); return false; }
        if (!Fleeing)
        {
            Fleeing=true;ReplanAt=0;p.Idling=false;
            p.Body.SetStateLabel('Run');p.Walking=true;
        }
        p.Nav.AvoidThreat=true;p.Nav.Threat=hunter.Pos.XY;
        if (level.time >= ReplanAt || (Goal-p.Body.Pos.XY).Length()<24) ChooseGoal(game,p);
        Vector2 before=p.Body.Pos.XY;
        game.MoveBody(p.Body,Goal,7.0,p.Nav,false,4);
        // If the graph has no retreat, try short, collision-checked sidesteps
        // away from the hunter. Never step closer or fall into a low crawl.
        if ((p.Body.Pos.XY-before).Length()<.1)
        {
            double away=atan2(before.Y-hunter.Pos.Y,before.X-hunter.Pos.X);
            for (int i=0;i<7;i++)
            {
                double turn=i==0?0:((i+1)/2)*25*(i%2?1:-1);
                double angle=away+turn;
                Vector2 next=before+(cos(angle),sin(angle))*7;
                let sector=level.PointInSector(next);
                if ((next-hunter.Pos.XY).Length()<=distance ||
                    abs(sector.floorplane.ZatPoint(next)-p.Body.floorz)>24 ||
                    sector.ceilingplane.ZatPoint(next)-sector.floorplane.ZatPoint(next)<p.Body.Height ||
                    p.Nav.ThreatBlocks(before,next)) continue;
                if (p.Body.TryMove(next,1)) { p.Body.Angle=angle;break; }
            }
        }
        return true;
    }
}
