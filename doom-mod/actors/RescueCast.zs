class PDRescuePerson : Object play
{
    PDCheckpointPrisoner Body;
    PDCheckpointNav Nav;
    PDRescueAvoid Avoid;
    int Site;
    bool Camped;
    bool Carded;
    bool Alive;
    bool Taken;
    bool Released;
    bool Discovered;
    int DiscoveredAt;
    bool Hinted;
    bool Holding;
    bool Walking;
    bool Complete;
    bool Sheltered;
    bool RefugeRecall;
    bool RefugeArrival;
    bool PadDuty;
    int ReleasedAt;
    Vector2 HoldGoal;
    Vector2 IdleGoal;
    int IdleUntil;
    int IdleStep;
    bool Idling;
    String Route;
}

// Each human owns their order and route. Parking one never changes the others.
class PDRescueCast : Object play
{
    Array<PDRescuePerson> People;
    bool OriginalAlive;

    void Load()
    {
        OriginalAlive = true;
        People.Resize(5);
        for (int i = 0; i < 5; i++)
        {
            People[i] = new('PDRescuePerson');
            People[i].Site = i;
            People[i].Nav = new('PDCheckpointNav'); People[i].Nav.Human = true;
            People[i].Avoid = new('PDRescueAvoid');
        }
        let it = ThinkerIterator.Create('PDCheckpointPrisoner');
        PDCheckpointPrisoner body;
        while ((body = PDCheckpointPrisoner(it.Next())) != null)
        {
            int site = body.Args[0];
            if (site >= 0 && site < People.Size())
            { People[site].Body = body; People[site].Alive = true; People[site].HoldGoal = body.Pos.XY; }
        }
    }

    bool DoorLocked(int tag)
    {
        let game=PDCheckpoint.Get();
        if(game&&game.Intro&&game.Intro.Locked(game,tag))return true;
        for (int i = 0; i < People.Size(); i++)
            if (PDCheckpointMap.SiteDoor(i) == tag) return !People[i].Released;
        return false;
    }

    int ReleasedCount()
    {
        int count = 0;
        for (int i = 0; i < People.Size(); i++) if (People[i].Released) count++;
        return count;
    }

    int AliveCount()
    {
        int count = OriginalAlive ? 1 : 0;
        for (int i = 0; i < People.Size(); i++) if (People[i].Alive) count++;
        return count;
    }

    int WaitingCount()
    {
        int count = 0;
        for (int i = 0; i < People.Size(); i++)
            if (People[i].Released && People[i].Alive && !People[i].Taken && People[i].Holding) count++;
        return count;
    }

    int FollowingCount()
    {
        int count = 0;
        for (int i = 0; i < People.Size(); i++)
            if (People[i].Released && People[i].Alive && !People[i].Taken && !People[i].Holding) count++;
        return count;
    }

    int OrderTarget(PDCheckpoint game)
    {
        return -1;
    }

    int NearbyPerson(PDCheckpoint game)
    {
        if (game.Escape.Opened) return -1;
        let pawn = players[0].mo;
        int selected = -1; double best = -99999;
        for (int i = 0; i < People.Size(); i++)
        {
            let p = People[i];
            if (!p.Alive || !p.Released || p.Taken || !p.Body) continue;
            double distance = pawn.Distance2D(p.Body);
            double facing = cos(pawn.AngleTo(p.Body) - pawn.Angle);
            if (distance >= 192 || facing <= 0.55 || !pawn.CheckSight(p.Body)) continue;
            double score = facing * 220 - distance;
            if (score > best) { best = score; selected = i; }
        }
        return selected;
    }

    void Order(PDCheckpoint game)
    {
        // Kept inert for old console bindings; escorts now manage themselves.
    }

    bool Release(int site, String route)
    {
        if (site < 0 || site >= People.Size() || People[site].Released) return false;
        let p = People[site];
        p.Released = true; p.Discovered = true; p.Route = route; p.ReleasedAt = level.time;
        p.Idling = false;
        return true;
    }

    // Freed people keep up (2026-10-19, Jonathan; levels 3-4 first, Factory.zs CatchUp): one left over 1024 units
    // behind and out of your sight appears just behind you where you cannot see it happen. The only escort teleport,
    // and only onto the human graph, out of crawls and away from an awake hunter.
    bool CatchUp(PDCheckpoint game, PDRescuePerson p, Actor pawn)
    {
        let who=p.Body;Vector3 from=who.Pos;
        for(int n=0;n<15;n++)
        {
            double a=pawn.Angle+180+(n%3-1)*35,reach=64+(n/3)*32;
            Vector2 spot=pawn.Pos.XY+(cos(a),sin(a))*reach;int node=game.NodeAt(spot,true);
            if(node<0||(PDCheckpointMap.Center(node)-spot).Length()>PDCheckpointMap.Step()||p.Nav.MaintenanceBlocked(game,node)||PDRescueRefuge.Inside(spot))continue;
            if(game.Hunter&&game.Awake&&(game.Hunter.Pos.XY-spot).Length()<256||!who.CheckPosition(spot))continue;
            let sec=level.PointInSector(spot);double z=sec.floorplane.ZatPoint(spot);
            if(sec.ceilingplane.ZatPoint(spot)-z<who.Height)continue;
            bool crowded=false;
            for(int j=0;j<People.Size();j++)if(People[j]!=p&&People[j].Alive&&People[j].Body&&(People[j].Body.Pos.XY-spot).Length()<24)crowded=true;
            if(crowded)continue;
            who.SetOrigin((spot,z),false);
            // Same room as you, nothing between: otherwise try the next spot.
            if(who.CheckSight(pawn)&&abs(who.Pos.Z-pawn.Pos.Z)<=24){who.ClearInterpolation();p.Nav.Ready=false;p.Nav.HasWaypoint=false;return true;}
            who.SetOrigin(from,false);
        }
        return false;
    }

    // Their own route search to your cell, under today's doors, bridge and locks, reached them: a warp
    // only shortens a walk they could already make (never past Holly's bridge or a locked cell).
    // Refreshed here, since Next only rebuilds it after a waypoint, and a snagged follower may never finish one.
    bool Linked(PDCheckpoint game, PDRescuePerson p, Actor pawn)
    {
        int you=game.NodeAt(pawn.Pos.XY,true),at=game.NodeAt(p.Body.Pos.XY,true);
        if(you<0||at<0)return false;
        p.Nav.Build(game,pawn.Pos.XY,at);
        return p.Nav.Goal==you&&!p.Nav.Stranded&&p.Nav.CostAt(at)>=0;
    }

    void Tick(PDCheckpoint game)
    {
        if (game.Escape.Opened) return;
        let pawn = players[0].mo;
        double pace=clamp(pawn.Vel.XY.Length()+.5,4.2,18); // Your pace up to running speed (2026-10-19), never under the old 4.2 walk.
        for (int i = 0; i < People.Size(); i++)
        {
            let p = People[i];
            if (!p.Alive || p.Taken || !p.Body) continue;
            if (!p.Discovered && pawn.Distance2D(p.Body) < 180 &&
                cos(pawn.AngleTo(p.Body) - pawn.Angle) > 0.45 && pawn.CheckSight(p.Body))
            { p.Discovered = true; p.DiscoveredAt = level.time; } // Seeing a captive does not reveal a name/bio.
            if (!p.Released) { PDRescueIdle.Tick(game, p); continue; }
            if (!p.Complete && (i == 2 && !PDCampaignSession.Hal() ? game.Sam.ClearOfCell(p.Body) : !PDCheckpointMap.SiteInside(i, p.Body.Pos.XY)))
            {
                p.Complete = true;
                Console.Printf("PDOOM_EVENT {\"type\":\"prisoner-clear\",\"id\":%d}", i + 1);
            }
            if (p.Avoid.Tick(game,p)) continue;
            // Every 7 tics, cheap tests first, the route search last. Not the guide, who waits where you left it, nor while HAL holds a door shut.
            if((level.time+i)%7==0&&p.Complete&&!p.Holding&&!p.Sheltered&&!p.RefugeArrival&&!game.Refuge.Guiding(i)&&level.time>=p.ReleasedAt+140&&p.Body.Distance2D(pawn)>1024&&
                !PDRescueRefuge.Inside(pawn.Pos.XY)&&!(PDCampaignSession.Hal()&&game.Hal.Doors.LockIndex>=0&&level.time<game.Hal.Doors.LockExpires)&&!pawn.CheckSight(p.Body)&&Linked(game,p,pawn))CatchUp(game,p,pawn);
            if (p.Holding && (p.Body.Pos.XY - p.HoldGoal).Length() <= (p.PadDuty ? 6 : 32))
            {
                PDRescueIdle.Tick(game, p);
                continue;
            }
            p.Idling = false;
            Vector2 goal = p.Holding ? p.HoldGoal : pawn.Pos.XY;
            bool guide = game.Refuge.Guiding(i) && !p.Holding;
            // Nobody follows the player back into a low crawl. First leave by
            // this prison's full-height opening; then join the ordinary graph.
            if (guide && level.time < p.ReleasedAt + 140)
                goal = p.Body.Pos.XY; // Let the newly freed person speak before leading.
            // The reboot run to the exit crosses Roman's pod bay, so it never sends him back out.
            else if (!p.Holding && (i == 2 && !PDCampaignSession.Hal() ? !p.Complete : !game.Refuge.Evacuating && PDCheckpointMap.SiteInside(i, p.Body.Pos.XY)))
                goal = i == 2 && !PDCampaignSession.Hal() ? game.Sam.CellExit(pawn) : PDCheckpointMap.SiteExit(i);
            else if (!p.Holding && p.RefugeArrival)
                goal = PDRescueRefuge.Slot(i);
            else if (guide)
            {
                goal = pawn.Distance2D(p.Body) > 224 && !PDRescueRefuge.Inside(pawn.Pos.XY) ? p.Body.Pos.XY : PDRescueRefuge.Slot(i);
                // The controlled player has to approach the door normally;
                // the guide operates the same physical override as others.
            }
            else if(!p.Holding&&game.Refuge.Known&&!game.Refuge.Evacuating&&PDRescueRefuge.Inside(pawn.Pos.XY))goal=PDRescueRefuge.Slot(i);
            else if (!p.Holding && p.Body.Distance2D(pawn) < 200)
            {
                double angle = i * 72;
                Vector2 formation = pawn.Pos.XY + (cos(angle), sin(angle)) * 80;
                int node = game.NodeAt(formation, true);
                if (node >= 0)
                {
                    Vector2 center = PDCheckpointMap.Center(node);
                    // Only a slot with no wall between you (2026-10-30): one behind a wall routes them away, and at
                    // 200 units they flip between that route and you and never arrive.
                    Vector2 toSlot = center - pawn.Pos.XY;FLineTraceData wall;
                    if ((center - formation).Length() < 48 && !pawn.LineTrace(atan2(toSlot.Y, toSlot.X), toSlot.Length(), 0, TRF_THRUACTORS, 28, data: wall)) goal = center;
                }
            }
            bool moving = (goal - p.Body.Pos.XY).Length() > (p.PadDuty ? 6 : p.Sheltered ? 8 : 48);
            if (moving != p.Walking)
            { if (moving) p.Body.SetStateLabel('Walk'); else p.Body.SetStateLabel('Spawn'); p.Walking = moving; }
            // Followers and the guide move at your pace; leaving a cell, refuge arrival and holding stay at 4.2.
            if (moving) game.MoveBody(p.Body, goal, p.Complete && !p.Holding && !p.RefugeArrival ? pace : 4.2, p.Nav, false, p.PadDuty ? 6 : p.Sheltered ? 8 : 40);
            else PDRescueIdle.InPlace(p);
            if (!p.Holding)
            {
                // Gentle separation at gathering spots. Waiting humans use
                // their own bounded idle movement instead.
                for (int j = 0; j < People.Size(); j++)
                {
                    let other = People[j];
                    if (i == j || !other.Alive || !other.Released || !other.Body) continue;
                    Vector2 apart = p.Body.Pos.XY - other.Body.Pos.XY;
                    double distance = apart.Length();
                    if (distance > 0.1 && distance < 30)
                        p.Body.TryMove(p.Body.Pos.XY + apart / distance * 0.4, 1);
                }
            }
        }
    }

    void LoseBody(PDCheckpoint game, Actor body)
    {
        for (int i = 0; i < People.Size(); i++)
        {
            let p = People[i];
            if (p.Body != body || !p.Alive || !p.Released) continue;
            p.Alive = false; p.Holding = false;
            body.bShootable = false; body.bSolid = false; body.SetStateLabel('Death');
            game.Speak(-1,"...That is on me.",140,"loss");
            // Nobody stays lost: the level restarts (PDCheckpoint.LoseAll).
            game.LoseAll(String.Format("%s is gone.", PDCheckpointMap.SiteName(i)));
            return;
        }
    }

    bool TakeNext(PDCheckpoint game)
    {
        let pawn = players[0].mo;
        if (game.Controlled == 0) OriginalAlive = false;
        else
        { People[game.Controlled - 1].Alive = false; People[game.Controlled - 1].Taken = false; }
        int selected = -1; double nearest = 999999;
        for (int i = 0; i < People.Size(); i++)
        {
            let p = People[i];
            if (!p.Alive || !p.Released || !p.Body || p.Taken) continue;
            double distance = pawn.Distance2D(p.Body);
            if (distance < nearest) { nearest = distance; selected = i; }
        }
        if (selected < 0) return false;
        let next = People[selected];
        Vector3 at = next.Body.Pos; double heading = next.Body.Angle; int inheritedHealth = max(1, next.Body.health);
        if(game.Controlled!=0)Actor.Spawn('PDDerezBadge',pawn.Pos);
        next.Body.Destroy(); next.Body = null; next.Taken = true; next.Holding = false;
        game.Controlled = selected + 1;
        pawn.SetOrigin(at, false); pawn.Vel = (0, 0, 0); pawn.Angle = heading;
        pawn.health = inheritedHealth; pawn.player.health = inheritedHealth;
        next.Sheltered = false; next.RefugeRecall = true;
        game.Say(String.Format("%s. You are now %s.", PDLevelPolish.Dario()?"CEO paused pending review":"CEO deprecated",PDCheckpointMap.SiteName(selected)),175);
        return true;
    }

    bool Together()
    {
        for(int i=0;i<5;i++)if(People[i].Alive&&!People[i].Released)return false;
        let pawn = players[0].mo;
        if (!PDRescueRefuge.Inside(pawn.Pos.XY)) return false;
        for (int i = 0; i < People.Size(); i++)
            if (People[i].Alive && !People[i].Taken && People[i].Body && (!PDRescueRefuge.Inside(People[i].Body.Pos.XY) || People[i].Body.Distance2D(pawn) > 224)) return false;
        return true;
    }

    String Report()
    {
        String result = "[";
        for (int i = 0; i < People.Size(); i++)
        {
            let p = People[i];
            Vector3 at = p.Taken ? players[0].mo.Pos : p.Body ? p.Body.Pos : (0, 0, 0);
            if (i > 0) result = result .. ",";
            result = result .. String.Format("{\"id\":%d,\"name\":\"%s\",\"alive\":%d,\"controlled\":%d,\"released\":%d,\"discovered\":%d,\"holding\":%d,\"clear\":%d,\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"health\":%d,\"sheltered\":%d,\"route\":\"%s\",\"hold_x\":%.1f,\"hold_y\":%.1f,\"visible\":%d,\"hit_width\":%.1f,\"walking\":%d,\"idle_step\":%d,\"pose_height\":%.1f,\"crouch_art\":%d,\"facing\":%.2f,\"breath_scale\":%.4f,\"fleeing\":%d,\"sprint_speed\":%.1f,\"flee_x\":%.1f,\"flee_y\":%.1f}",
                i + 1, PDCheckpointMap.SiteName(i), p.Alive||p.Camped, p.Taken, p.Released, p.Discovered, p.Holding, p.Complete, at.X, at.Y, at.Z, p.Taken ? players[0].mo.health : p.Body ? max(0, p.Body.health) : 0, p.Sheltered, p.Route, p.HoldGoal.X, p.HoldGoal.Y, p.Body && players[0].mo.CheckSight(p.Body), p.Body ? p.Body.Radius * 2 : 0, p.Walking, p.IdleStep, p.Body ? p.Body.Height : 0, p.Body && p.Body.Height < 40, p.Body ? p.Body.Angle : 0, p.Body ? p.Body.Scale.Y : 0, p.Avoid.Fleeing, p.Avoid.Fleeing ? 7.0 : 0., p.Avoid.Goal.X, p.Avoid.Goal.Y);
        }
        return result .. "]";
    }
}
