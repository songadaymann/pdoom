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

    void Tick(PDCheckpoint game)
    {
        if (game.Escape.Opened) return;
        let pawn = players[0].mo;
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
                    if ((center - formation).Length() < 48) goal = center;
                }
            }
            bool moving = (goal - p.Body.Pos.XY).Length() > (p.PadDuty ? 6 : p.Sheltered ? 8 : 48);
            if (moving != p.Walking)
            { if (moving) p.Body.SetStateLabel('Walk'); else p.Body.SetStateLabel('Spawn'); p.Walking = moving; }
            if (moving) game.MoveBody(p.Body, goal, 4.2, p.Nav, false, p.PadDuty ? 6 : p.Sheltered ? 8 : 40);
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
            game.Polish.Stinger("pdoom/loss");
            body.bShootable = false; body.bSolid = false; body.SetStateLabel('Death');
            game.Say(String.Format("%s is gone.", PDCheckpointMap.SiteName(i)),175);
            game.Speak(-1,"...That is on me.",140,"loss");
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
