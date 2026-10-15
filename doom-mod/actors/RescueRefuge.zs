// Original E1M4 side room, secured by a native bulkhead and a grated stair.
class PDRescueRefuge : Object play
{
    int Guide;
    bool Known;
    bool Introduced;
    int OpenUntil;
    bool DoorRequested;
    bool CoverChanged;
    bool Sealed;
    bool Evacuating; // Computer Station: HAL's breaker was pulled; everyone leaves together
    int GatheredAt;
    int HintStage;

    void Load()
    {
        Guide = -1;
        Door_Close(882, 24);
    }

    static bool Inside(Vector2 at)
    {
        if(PDCampaignSession.Hal())return at.X>8&&at.X<376&&at.Y>368&&at.Y<752;
        let sector = level.PointInSector(at);
        return sector == level.Sectors[87] || sector == level.Sectors[91] || sector == level.Sectors[92];
    }

    static Vector2 Slot(int site)
    {
        if(PDCampaignSession.Hal())return (64+(site%3)*96,480+(site/3)*64);
        if (site == 0) return (1008, 800);
        if (site == 1) return (1072, 800);
        if (site == 2) return (1008, 880);
        if (site == 3) return (1072, 880);
        return (1104, 832);
    }

    static bool NearEntrance(Vector2 at)
    {
        if (Inside(at)) return true;
        // Restrict capture to the actual entrance hall, not through room walls.
        if(PDCampaignSession.Hal())return at.X>112&&at.X<272&&at.Y>192&&at.Y<400;
        return at.X>1112&&at.X<1360&&at.Y>720&&at.Y<880;
    }

    void FirstRescue(PDCheckpoint game, int site)
    {
        // Their release line already says "Follow me" (PDLevelPolish.Released).
        if (Introduced || Guide >= 0) return;
        Guide = site;
    }

    bool Guiding(int site) { return !Introduced && Guide == site; }

    // Like any facility door: walk up to it from either side and it opens.
    bool Approaching(Actor pawn)
    {
        Vector2 toward = DoorAt() - pawn.Pos.XY;
        double distance = toward.Length();
        return abs(pawn.Pos.Z - 8) < 64 && (distance < 48 || distance < 96 && cos(atan2(toward.Y, toward.X) - pawn.Angle) > 0.5);
    }

    bool CanUse(Actor pawn)
    {
        Vector2 toward = DoorAt() - pawn.Pos.XY;
        return toward.Length() < 120 && abs(pawn.Pos.Z - 8) < 64 && cos(atan2(toward.Y, toward.X) - pawn.Angle) > 0.25;
    }

    static Vector2 DoorAt() { return PDCampaignSession.Hal() ? (192, 360) : (1168, 800); }

    // A native door ignores a new order while its last one is still moving, so retire
    // only this refuge's mover before ordering it open or shut.
    static void Retire()
    {
        let door = level.PointInSector(DoorAt());
        if (door.ceilingdata) { door.ceilingdata.Destroy(); door.ceilingdata = null; }
    }

    void Open()
    {
        if (Sealed) return;
        // A remote open cannot reverse a native closing mover.
        if(!DoorRequested){Retire();Door_Open(882,24);}
        OpenUntil = level.time + 105;
        DoorRequested = true;
    }

    // Sealing used to be ignored while the door was still opening for whoever came in
    // last (2026-10-13): "Locked." on the pad, door standing open. Close it regardless.
    void Close() { Retire(); Door_Close(882, 24); DoorRequested = false; }

    void Use(PDCheckpoint game)
    {
        if (Sealed) { game.Say("Locked.", 70); return; }
        Open();
    }

    void Tick(PDCheckpoint game)
    {
        let pawn = players[0].mo;
        if (game.GroupGathered && !Sealed && !Evacuating) BeginEnding(game);
        if (!Sealed && Approaching(pawn)) Open();
        // One nudge if the player is stuck in the sealed room. In the Computer Station
        // HAL itself gives the breaker away by asking you not to touch it.
        if (Sealed)
        {
            // Keep a sealed room shut: re-close if anything left the door standing open.
            let door = level.PointInSector(DoorAt());
            if (!door.ceilingdata && door.ceilingplane.ZatPoint(DoorAt()) > door.floorplane.ZatPoint(DoorAt()) + 1) Close();
        }
        if (Sealed && !game.Escape.Opened && HintStage == 0 && level.time - GatheredAt >= 1400)
        {
            HintStage = 1;
            if (PDCampaignSession.Hal()) game.Speak(-2, "Please don't touch my main breaker. Turning me off and on again won't help.", 245, "breaker");
            else game.Speak(Speaker(game), "There must be another way out of here.", 280, "way-out");
        }
        if (!Introduced && Guide >= 0 && (!game.Cast.People[Guide].Alive || game.Cast.People[Guide].Taken))
        {
            Guide = -1;
            for (int i = 0; i < game.Cast.People.Size(); i++)
                if (game.Cast.People[i].Released && game.Cast.People[i].Alive && !game.Cast.People[i].Taken && game.Cast.People[i].Body)
                { Guide = i; break; }
            if (Guide >= 0) game.Speak(Guide, "I'll show you where we can keep safe. Follow me.", 280);
            else game.Say("The refuge is off the east side of the central loop.", 175);
        }
        if (!Known && Inside(pawn.Pos.XY))
        {
            Known = true;
            if (Guide < 0) game.Say("Safe here. The machinery masks you.", 140);
        }
        if(!Introduced&&Guide>=0&&Inside(pawn.Pos.XY)&&game.Cast.People[Guide].Body&&Inside(game.Cast.People[Guide].Body.Pos.XY))
        {
            Introduced=true;
            game.Speak(Guide,PDLevelPolish.SafeLine(Guide),245,"safe");
        }
        for (int i = 0; i < game.Cast.People.Size(); i++)
        {
            let p = game.Cast.People[i];
            if (p.Body && !Inside(p.Body.Pos.XY)) p.RefugeRecall = false;
            if (game.Escape.Opened || Evacuating || (!Known && Guide<0) || !p.Alive || !p.Released || p.Taken || !p.Body || p.RefugeRecall) continue;
            if (!p.Sheltered && !p.RefugeArrival && NearEntrance(p.Body.Pos.XY))
            { p.RefugeArrival=true; p.Nav.HasWaypoint=false; }
            if (!p.Sheltered && Inside(p.Body.Pos.XY))
            {
                p.Sheltered = true; p.Holding = true; p.HoldGoal = Slot(i);
                p.Nav.HasWaypoint = false;
            }
        }
        // Never close on a human crossing the throat. Once clear, real native
        // sector collision seals it; the hunter cannot operate this override.
        bool crossing = PDCampaignSession.Hal()?pawn.Pos.X>112&&pawn.Pos.X<272&&pawn.Pos.Y>320&&pawn.Pos.Y<400:pawn.Pos.X > 1112 && pawn.Pos.X < 1224 && pawn.Pos.Y > 700 && pawn.Pos.Y < 900;
        for (int i = 0; i < game.Cast.People.Size(); i++)
        {
            let p = game.Cast.People[i];
            if (p.Alive && p.Released && p.Body && (PDCampaignSession.Hal()?p.Body.Pos.X>112&&p.Body.Pos.X<272&&p.Body.Pos.Y>320&&p.Body.Pos.Y<400:p.Body.Pos.X > 1112 && p.Body.Pos.X < 1224 && p.Body.Pos.Y > 700 && p.Body.Pos.Y < 900)) crossing = true;
        }
        if (!Sealed && crossing && DoorRequested) OpenUntil = level.time + 35;
        if (DoorRequested && level.time > OpenUntil && !crossing)
        { Door_Close(882, 24); DoorRequested = false; }
        if (!CoverChanged && game.Cast.ReleasedCount() == 5)
        {
            CoverChanged = true;
        }
    }

    int Speaker(PDCheckpoint game)
    {
        for (int i = 0; i < game.Cast.People.Size(); i++)
            if (game.Cast.People[i].Alive && game.Cast.People[i].Released && !game.Cast.People[i].Taken) return i;
        return -1;
    }

    bool CompletedVisit(PDCheckpoint game)
    {
        let session=PDCampaignSession.Get();
        return session.SavedMask()==31 || game.EntryHub&&!game.Replay&&(session.SavedMask()|session.LostMask())==31;
    }

    void BeginEnding(PDCheckpoint game)
    {
        // Revisiting a completed, empty facility is not another rescue ending.
        if (Sealed || CompletedVisit(game)) return;
        game.Polish.Stinger("pdoom/gathered");
        Sealed = true; GatheredAt = level.time; HintStage = 0;
        Close();
        if (PDCampaignSession.Hal()) game.Speak(-2, "Everyone's together. How nice. For your safety, I've locked the door.", 245, "lockdown");
        else game.Speak(Speaker(game), "We're all here. Wait... the door just locked.", 280, "locked");
    }

    // HAL's breaker is pulled: the room unseals for good and everyone follows the player.
    void Evacuate(PDCheckpoint game)
    {
        Evacuating = true; Sealed = false;
        Open();
        for (int i = 0; i < game.Cast.People.Size(); i++)
        {
            let p = game.Cast.People[i];
            p.Holding = false; p.Sheltered = false; p.RefugeArrival = false; p.Idling = false; p.Nav.HasWaypoint = false;
        }
    }

    int ShelteredCount(PDCheckpoint game)
    {
        int count = 0;
        for (int i = 0; i < game.Cast.People.Size(); i++)
            if (game.Cast.People[i].Alive && game.Cast.People[i].Released && (game.Cast.People[i].Taken ? Inside(players[0].mo.Pos.XY) : game.Cast.People[i].Sheltered)) count++;
        return count;
    }

    int MedicalCount()
    {
        int count = 0;
        let it = ThinkerIterator.Create('Health');
        while (it.Next() != null) count++;
        return count;
    }

    // Unbound native-console QA fixture: place the real pursuer at the gate
    // without changing its damage, targeting, collision or movement rules.
    void TestHunterAtGate(PDCheckpoint game)
    {
        if (!game.Hunter) return;
        game.Hunter.SetOrigin((1232, 800, 0), false);
        game.Awake = true; game.WakeAt = level.time - 175;
        game.LastKnown = (1168, 800);
        game.Hunter.StunUntil = 0; game.Hunter.ReloadUntil = 0; game.Hunter.AimTics = 0;
        game.HunterNav.Ready = false; game.HunterNav.HasWaypoint = false;
    }
}

class PDRefugeOverride : PDCheckpointProp
{
    Default { Height 32; +WALLSPRITE }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 12; }
    States { Spawn: CPRL A -1; Stop; }
}
class PDRefugeCover : PDCheckpointProp
{
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 13; }
    // Fixed to the north wall; actor angle is the panel's facing direction.
    Default { +WALLSPRITE }
    States { Spawn: CPVT A -1; Stop; }
}
