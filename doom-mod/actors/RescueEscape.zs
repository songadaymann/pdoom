// The final service route owns cover work, crouching companions and exit credit.
class PDRescueEscape : Object play
{
    int Bolts;
    int WorkingBolt;
    int WorkTics;
    bool Opened;
    bool Outside;
    bool DevApplied;
    bool SparePlaced;
    Array<int> Steps;
    Array<bool> Saved;
    Array<Actor> Fasteners;

    void Load()
    {
        WorkingBolt = -1;
        Steps.Resize(5); Saved.Resize(5); Fasteners.Resize(4);
        // The Computer Station's way out is HAL's main breaker (PDHalReboot), not a cover.
        if (PDCampaignSession.Hal()) return;
        for (int i = 0; i < 4; i++)
        {
            Fasteners[i] = Actor.Spawn('PDEscapeBolt', (PDCampaignSession.Hal()?(i%2==0?166:218):(i%2==0?806:858), PDCampaignSession.Hal()?607:957, i < 2 ? 56 : 32));
            Fasteners[i].Angle = 270;
        }
    }

    int CountBolts()
    {
        int count = 0;
        for (int i = 0; i < 4; i++) if (Bolts & (1 << i)) count++;
        return count;
    }

    int AimBolt(Actor pawn)
    {
        Vector2 forward = (cos(pawn.Angle), sin(pawn.Angle));
        double cy=PDCampaignSession.Hal()?608:958;
        if (forward.Y < 0.3 || pawn.Pos.Y > cy || pawn.Pos.Y < cy-168) return -1;
        double distance = (cy-1 - pawn.Pos.Y) / forward.Y;
        if (distance > 180) return -1;
        double x = pawn.Pos.X + forward.X * distance;
        double z = pawn.Pos.Z + pawn.player.viewheight - tan(pawn.Pitch) * distance;
        for (int i = 0; i < 4; i++)
            if (!(Bolts & (1 << i)) && abs(x - (PDCampaignSession.Hal()?(i%2==0?166:218):(i%2==0?806:858))) < 7 && abs(z - (i < 2 ? 56 : 32)) < 7) return i;
        return -1;
    }

    bool AtCover(Actor pawn)
    {
        // No cover in the Computer Station (its old bolt lines here were stale at the breaker's shutter).
        if(PDCampaignSession.Hal())return false;
        return pawn.Pos.Y < 960 && pawn.Pos.Y > 800 && abs(pawn.Pos.X - 832) < 110 && sin(pawn.Angle) > 0.4;
    }

    String Prompt(PDCheckpoint game)
    {
        let pawn = players[0].mo;
        if (PDCampaignSession.Hal() || !AtCover(pawn)) return "";
        if (Opened || !game.GroupGathered || !game.HasWrench || game.Tool != 0) return "";
        int bolt = AimBolt(pawn);
        return bolt >= 0 ? String.Format("Hold SPACE - loosen bolt (%d/4) %d%%", CountBolts(), WorkTics * 100 / 35) : "";
    }

    void Use(PDCheckpoint game)
    {
        if (Opened) { game.Say("Crawl in. We'll follow.", 105); return; }
        if (!game.GroupGathered) game.Say("Collect everyone still alive first.", 140);
        else if (!game.HasWrench) game.Say("Bolted shut. You need a tool.", 140);
        else if (game.Tool != 0) game.Say("Switch to the wrench (T) and hold SPACE on each bolt.", 175);
        else game.Say("Hold SPACE on each corner bolt.", 140);
    }

    void Uncover(PDCheckpoint game)
    {
        Opened = true; WorkTics = 0;
        // Capture before companions leave shelter and the permanent survival meter changes.
        game.Run.SnapshotCover(game);
        Ceiling_RaiseByValue(883, 8, 40);
        let covers = ThinkerIterator.Create('PDRefugeCover'); Actor cover;
        while ((cover = Actor(covers.Next())) != null) cover.Destroy();
        for (int i = 0; i < 4; i++) if (Fasteners[i]) Fasteners[i].Destroy();
        players[0].mo.A_StartSound("doors/dr1_open", CHAN_BODY);
        for (int i = 0; i < 5; i++)
        {
            let p = game.Cast.People[i];
            if (!p.Alive || !p.Released || p.Taken || !p.Body) continue;
            p.Holding = false; p.Sheltered = false; p.Nav.HasWaypoint = false;
        }
        game.Speak(game.Refuge.Speaker(game), "There's a passage behind it. Crawl in. We'll follow you.", 280, "passage");
        Console.Printf("PDOOM_EVENT {\"type\":\"cover-opened\"}");
    }

    Vector2 Waypoint(int step)
    {
        if(PDCampaignSession.Hal()){if(step==0)return (192,560);if(step==1)return(192,640);if(step==2)return(192,664);if(step==3)return(192,700);return(192,724);}
        if (step == 0) return (832, 920);
        if (step == 1) return (832, 1024);
        if (step == 2) return (720, 1024);
        if (step == 3) return (720, 1168);
        return (720, 1192);
    }

    int SavedCount(PDCheckpoint game)
    {
        int count = Outside ? 1 : 0;
        for (int i = 0; i < 5; i++) if (Saved[i] && game.Cast.People[i].Alive && !game.Cast.People[i].Taken) count++;
        return count;
    }

    void MovePeople(PDCheckpoint game)
    {
        for (int i = 0; i < 5; i++)
        {
            let p = game.Cast.People[i];
            if (!p.Alive || !p.Released || p.Taken || !p.Body || Saved[i]) continue;
            Vector2 goal = Waypoint(Steps[i]);
            if ((goal - p.Body.Pos.XY).Length() < 7)
            {
                Steps[i]++;
                if (Steps[i] == 1) { p.Body.Height = 28; }
                if (Steps[i] >= 5)
                {
                    Saved[i] = true; p.Body.bInvisible = true; p.Body.bSolid = false;
                    Console.Printf("PDOOM_EVENT {\"type\":\"person-outside\",\"id\":%d}", i + 1);
                    continue;
                }
                goal = Waypoint(Steps[i]);
            }
            if (Steps[i] == 0) game.MoveBody(p.Body, goal, 2.8, p.Nav, false, 6);
            else
            {
                Vector2 direction = goal - p.Body.Pos.XY;
                p.Body.Angle = atan2(direction.Y, direction.X);
                p.Body.TryMove(p.Body.Pos.XY + direction / direction.Length() * min(2.0, direction.Length()), 1);
            }
            if (!p.Walking) { p.Body.SetStateLabel('Walk'); p.Walking = true; }
        }
    }

    void DevStage(PDCheckpoint game)
    {
        // Both server-provided development capability and explicit fixture flag
        // are required. Static/public launches leave these false.
        let pawn = players[0].mo;
        if (game.EntryHub || DevApplied || !pawn.GetCVar("pdoom_development") || !pawn.GetCVar("pdoom_dev_end")) return;
        DevApplied = true;
        for (int i = 0; i < 5; i++)
        {
            let p = game.Cast.People[i];
            // A restarted campaign can already have these people safe in Bliss.
            if (p.Camped || !p.Body || !p.Alive) continue;
            game.OpenCell(i, "development");
            p.Body.SetOrigin((PDRescueRefuge.Slot(i), PDCampaignSession.Hal()?0:8), false);
            p.Body.Vel = (0, 0, 0); p.Body.health = 100;
            p.Holding = true; p.Sheltered = true; p.Complete = true;
            p.HoldGoal = PDRescueRefuge.Slot(i); p.Nav.HasWaypoint = false;
        }
        game.Refuge.Known = true; game.Refuge.Introduced = true; game.Refuge.CoverChanged = true;
        game.Awake = true; game.WakeAt = level.time - 175;
        game.GroupGathered = true; game.HasWrench = true; game.Tool = 0;
        pawn.SetOrigin((PDCampaignSession.Hal()?(192,528):(832,880),PDCampaignSession.Hal()?0:24), false); pawn.Angle = 90; pawn.Pitch = 10; pawn.Vel = (0, 0, 0);
        game.Refuge.BeginEnding(game);
        Console.Printf("PDOOM_EVENT {\"type\":\"development-end-fixture\"}");
    }

    void Tick(PDCheckpoint game)
    {
        DevStage(game);
        if (PDCampaignSession.Hal()) return;
        let pawn = players[0].mo;
        if (game.GroupGathered && !SparePlaced)
        { Actor.Spawn('PDCheckpointWrench', (PDCampaignSession.Hal()?(224,528):(864,880),PDCampaignSession.Hal()?0:24)); SparePlaced = true; }
        if (!Opened)
        {
            int bolt = game.GroupGathered && game.HasWrench && game.Tool == 0 ? AimBolt(pawn) : -1;
            if (!(pawn.player.cmd.buttons & BT_USE) || bolt < 0) { WorkTics = 0; WorkingBolt = -1; }
            else
            {
                if (WorkingBolt != bolt) { WorkingBolt = bolt; WorkTics = 0; }
                WorkTics++;
                if (WorkTics % 9 == 1) pawn.A_StartSound("weapons/chngun", CHAN_ITEM, CHANF_OVERLAP, 0.16);
                if (WorkTics >= 35)
                {
                    Bolts |= 1 << bolt; Fasteners[bolt].SetStateLabel('Loose'); WorkTics = 0;
                    if (CountBolts() == 4) Uncover(game);
                }
            }
            return;
        }
        MovePeople(game);
        if (!Outside && (PDCampaignSession.Hal()?pawn.Pos.X>160&&pawn.Pos.X<224&&pawn.Pos.Y>712:pawn.Pos.X>688&&pawn.Pos.X<752&&pawn.Pos.Y>1180))
        {
            Outside = true; pawn.Vel = (0, 0, 0); pawn.Angle = 270; pawn.Pitch = 0;
            pawn.SetOrigin((PDCampaignSession.Hal()?(192,720):(720,1184),PDCampaignSession.Hal()?0:24), false);
            Console.Printf("PDOOM_EVENT {\"type\":\"outside-reveal\"}");
        }
        if (Outside && SavedCount(game) == game.Cast.AliveCount())
        {
            game.Ended = true;
            game.Run.Finish(game, SavedCount(game));
        }
    }
}

class PDEscapeBolt : Actor
{
    Default { +NOGRAVITY +WALLSPRITE }
    States { Spawn: CPVB A -1; Stop; Loose: CPVB B -1; Stop; }
}
