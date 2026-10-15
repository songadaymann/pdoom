// Sam's alternate rescue entrance and permanent maze shortcut.
class PDRescueSam : Object play
{
    bool Opened;
    bool PowerCut;
    int InsideAt;
    int PlayerInAt;
    String Route;
    PDSamJunction Box;

    void Load()
    {
        let it = ThinkerIterator.Create('PDSamJunction'); Box = PDSamJunction(it.Next());
    }

    void Open(PDCheckpoint game, String source)
    {
        if (Opened) return;
        Opened = true; Route = source;
        // Retract exactly56units: the original maze has56units of headroom.
        // A standard door would stop4units short and strand standing escorts.
        Ceiling_RaiseByValue(886, 24, 56);
        if (Box) Box.A_StartSound("doors/dr1_open", CHAN_BODY);
        for (int i = 0; i < game.Cast.People.Size(); i++)
        { game.Cast.People[i].Nav.Ready = false; game.Cast.People[i].Nav.HasWaypoint = false; }
        game.HunterNav.Ready = false; game.HunterNav.HasWaypoint = false;
        // The junction's sparks and the lifting shutter speak for themselves.
        if (source != "junction") game.Speak(2, "I've opened the other shutter. Another way out.", 175);
        Console.Printf("PDOOM_EVENT {\"type\":\"sam-shutter-open\",\"route\":\"%s\"}", source);
    }

    void CutFeed(PDCheckpoint game)
    {
        if (PowerCut || Opened) return;
        PowerCut = true;
        Box.bShootable = false; Box.SetStateLabel('Broken');
        game.Combat.MachineBlast(Box.Pos + (0, 0, 16));
        let wires = ThinkerIterator.Create('PDSamCable'); Actor cable;
        while ((cable = Actor(wires.Next())) != null) cable.SetStateLabel('Dead');
        game.Alert(Box.Pos.XY);
        Open(game, "junction");
    }

    void OnRescue() { if (!Opened) InsideAt = level.time + 8; }

    void Tick(PDCheckpoint game)
    {
        // Nobody stays stuck in the cell: if the player has stood inside for 12 s without
        // working the CELL DOOR latch, Eliezer reaches over and pulls it himself.
        let pawn = players[0].mo;
        if (Opened && !game.Cast.People[2].Released && pawn && PDCheckpointMap.SiteInside(2, pawn.Pos.XY))
        {
            if (PlayerInAt <= 0) PlayerInAt = level.time;
            else if (level.time - PlayerInAt > 12 * TICRATE) game.OpenCell(2, "power-shutter");
        }
        else PlayerInAt = 0;
        if (Opened || InsideAt <= 0 || level.time < InsideAt) return;
        // Sam operates the reachable inside latch before leaving the cell;
        // no remote player command or extra tool is required after rescue.
        let p = game.Cast.People[2];
        if (p.Alive && !p.Taken && p.Body && PDCheckpointMap.SiteInside(2, p.Body.Pos.XY)) Open(game, "sam");
    }

    bool ClearOfCell(Actor body)
    {
        // Count the western escape only after the whole standing body clears
        // the shutter, so a first guide cannot turn back halfway through it.
        if (body.Pos.X < -984 && body.Pos.X >= -1000 - body.Radius - 2 &&
            body.Pos.Y > -352 && body.Pos.Y < -224) return false;
        return !PDCheckpointMap.SiteInside(2, body.Pos.XY);
    }

    Vector2 CellExit(Actor pawn)
    {
        // Clear the entire doorway before ordinary companion stopping distance applies.
        return Opened && pawn.Pos.X < -1000 ? (-1072, -288) : PDCheckpointMap.SiteExit(2);
    }

    void Use(PDCheckpoint game, int kind)
    {
        if (kind == 14) { if (!Opened) game.Say("A live feed. A solid strike could break it.", 140); }
        else if (kind == 15) { if (!Opened) game.Say("Power-locked. The cable runs round the corner.", 140); }
        else if (kind == 16)
        {
            if (!game.Cast.People[2].Released) game.OpenCell(2, Opened ? "power-shutter" : "service");
            Open(game, "inside");
        }
    }

    String Report()
    {
        Vector2 at = (-992, -288); let sector = level.PointInSector(at);
        let game = PDCheckpoint.Get(); let person = game.Cast.People[2];
        Vector2 waypoint = person.Nav.HasWaypoint ? PDCheckpointMap.Center(person.Nav.Waypoint) : (0, 0);
        return String.Format("{\"opened\":%d,\"power_cut\":%d,\"route\":\"%s\",\"clearance\":%.1f,\"waypoint_x\":%.1f,\"waypoint_y\":%.1f,\"blocked_actor\":%d,\"blocked_line\":%d}", Opened, PowerCut, Route,
            sector.ceilingplane.ZatPoint(at) - sector.floorplane.ZatPoint(at), waypoint.X, waypoint.Y,
            person.Body ? person.Body.BlockingMobj != null : 0, person.Body ? person.Body.BlockingLine != null : 0);
    }

}

class PDSamJunction : PDCheckpointProp
{
    Default { Health 1; Radius 18; Height 32; +SHOOTABLE +NOBLOOD +NOGRAVITY +WALLSPRITE }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 14; }
    override int DamageMobj(Actor inflictor, Actor source, int damage, Name mod, int flags, double angle)
    {
        let game = PDCheckpoint.Get();
        if (game && damage > 0 && mod == 'CheckpointMelee') game.Sam.CutFeed(game);
        return 0;
    }
    States { Spawn: CPSJ AC 6 Bright; Loop; Broken: CPSJ B -1; Stop; }
}
class PDSamShutterMarker : PDCheckpointProp
{
    Default { +WALLSPRITE }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 15; }
    States { Spawn: CPSL A -1; Stop; }
}
class PDSamInsideLatch : PDCheckpointProp
{
    Default { +WALLSPRITE }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 16; }
    // Its CELL DOOR plate points at the front door it opens; the lamp blinks while Eliezer
    // is locked in and turns green (with the arrow) once that door is open.
    override void Tick()
    {
        Super.Tick();
        if (level.time % 8 || InStateSequence(CurState, ResolveState('Open'))) return;
        let game = PDCheckpoint.Get();
        if (game && game.Cast && game.Cast.People.Size() > 2 && game.Cast.People[2].Released) SetStateLabel('Open');
    }
    States { Spawn: CPSL B 18 Bright; CPSL D 18; Loop; Open: CPSL C -1 Bright; Stop; }
}
class PDSamCable : Actor
{
    Default { +NOGRAVITY +NOBLOCKMAP +WALLSPRITE }
    override void PostBeginPlay() { Super.PostBeginPlay(); Angle+=Args[4]*.0001; }
    States { Spawn: CPSC A -1; Stop; Dead: CPSC B -1; Stop; }
}
