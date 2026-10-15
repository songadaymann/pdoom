// Turret, physical breach and weight gate share the same five rescue records.
class PDRescueEncounters : Object play
{
    PDCheckpointTurret Turret;
    PDCheckpointPad Pad;
    bool TurretBroken;
    bool PadActive;
    int TurretAim;
    int TurretShots;
    int TurretHits;
    int PadKeeper;
    int FuseUntil;
    Actor FuseVisual;
    Vector3 FusePosition;
    int Breaches;
    int DebrisSpawned;
    int SmokeSpawned;

    void Load()
    {
        PadKeeper = -1;
        let guns = ThinkerIterator.Create('PDCheckpointTurret');
        Turret = PDCheckpointTurret(guns.Next());
        let pads = ThinkerIterator.Create('PDCheckpointPad');
        Pad = PDCheckpointPad(pads.Next());
    }

    void DisableTurret(PDCheckpoint game, String route)
    {
        if (TurretBroken) return;
        TurretBroken = true; TurretAim = 0;
        if (Turret)
        {
            Turret.bShootable = false; Turret.SetStateLabel('Broken');
            Turret.A_StartSound("world/metal1", CHAN_BODY);
            if ((route == "breaker" || route == "textbook")) Actor.Spawn('PDRescueSmoke', Turret.Pos + (0, 0, 16));
            else game.Combat.MachineBlast(Turret.Pos + (0, 0, 16), true);
        }
        game.OpenCell(1, route);
        if (route != "breaker" && route != "textbook") game.Alert(Turret.Pos.XY);
    }

    void Plant(PDCheckpoint game, Actor wall)
    {
        if (FuseUntil > 0 || game.Cast.People[3].Released) return;
        if (!game.HasCharge) { game.Say("Cracked. A charge could break it.", 105); return; }
        game.HasCharge = false; FuseUntil = level.time + 105;
        FusePosition = wall.Pos;
        FuseVisual = Actor.Spawn('PDBurningCharge', wall.Pos + (0, 0, 12));
        game.Say("Charge set. Get back!", 105);
    }

    void Blast(PDCheckpoint game)
    {
        FuseUntil = 0; Breaches++;
        if (FuseVisual) { FuseVisual.Destroy(); FuseVisual = null; }
        let blast = Actor.Spawn('PDExplosion', FusePosition + (0, 0, 24));
        for (int i = 0; i < 20; i++)
        {
            let bit = Actor.Spawn('PDRescueDebris', FusePosition + (random(-8, 8), random(-24, 24), random(4, 56)));
            if (bit) { bit.Vel = (random(-5, 5), random(-5, 5), random(3, 8)); DebrisSpawned++; }
        }
        for (int i = 0; i < 10; i++)
        {
            let smoke = Actor.Spawn('PDRescueSmoke', FusePosition + (random(-24, 24), random(-24, 24), random(12, 56)));
            if (smoke) { smoke.Vel = (random(-2, 2) * 0.25, random(-2, 2) * 0.25, 0.6); SmokeSpawned++; }
        }
        let pawn = players[0].mo;
        bool lethal = pawn.Distance2D(blast) < 144 && blast.CheckSight(pawn);
        for (int i = 0; i < game.Cast.People.Size(); i++)
        {
            let p = game.Cast.People[i];
            if (p.Alive && p.Released && p.Body && p.Body.Distance2D(blast) < 144 && blast.CheckSight(p.Body))
                game.Cast.LoseBody(game, p.Body);
        }
        if (lethal) game.LosePlayer();
        game.OpenCell(3, "breach");
        game.Alert(FusePosition.XY);
        Console.Printf("PDOOM_EVENT {\"type\":\"wall-breached\",\"debris\":%d,\"smoke\":%d}", DebrisSpawned, SmokeSpawned);
    }

    int PlacementMarkers()
    {
        int count=0;let it=ThinkerIterator.Create('PDCheckpointBreach');
        while(it.Next()!=null)count++;return count;
    }

    void Tick(PDCheckpoint game)
    {
        let pawn = players[0].mo;
        if (FuseUntil > 0 && level.time >= FuseUntil) Blast(game);
        if (Pad && !game.Cast.People[4].Released)
        {
            // A close companion volunteers without a Stay/Follow command.
            if (PadKeeper < 0 && pawn.Distance2D(Pad) < 240)
            {
                for (int i = 0; i < game.Cast.People.Size(); i++)
                {
                    let p = game.Cast.People[i];
                    if (!p.Alive || !p.Released || p.Taken || p.Sheltered || !p.Body || game.Refuge.Guiding(i)) continue;
                    if (p.Body.Distance2D(Pad) < 160 && p.Body.CheckSight(Pad))
                    {
                        PadKeeper = i; p.PadDuty = true; p.Holding = true; p.HoldGoal = Pad.Pos.XY; p.Nav.HasWaypoint = false; p.Idling = false;
                        game.Speak(i, "I'll keep this powered. Go get them.", 245); break;
                    }
                }
            }
            if (PadKeeper >= 0 && (!game.Cast.People[PadKeeper].Alive || game.Cast.People[PadKeeper].Taken)) PadKeeper = -1;
            bool active = pawn.Distance2D(Pad) < 40 && abs(pawn.Pos.Z - Pad.floorz) < 24;
            for (int i = 0; i < game.Cast.People.Size(); i++)
            {
                let p = game.Cast.People[i];
                if (p.Alive && p.Released && p.Body && p.Body.Distance2D(Pad) < 40 && abs(p.Body.Pos.Z - Pad.floorz) < 24) active = true;
            }
            if (active != PadActive)
            {
                PadActive = active;
                if (active) Pad.SetStateLabel('Active'); else Pad.SetStateLabel('Spawn');
                game.SetSecurityGate(active);
            }
            if (PadActive && PDCheckpointMap.SiteInside(4, pawn.Pos.XY)) game.OpenCell(4, "weight");
        }
        else if (PadKeeper >= 0)
        {
            let p = game.Cast.People[PadKeeper]; p.PadDuty = false; p.Holding = false; p.Idling = false; p.Nav.HasWaypoint = false; PadKeeper = -1;
        }
        if(!game.Cast.People[4].Released && Pad && pawn.Distance2D(Pad)<256){
            int crowd=0;for(int i=0;i<5;i++){let p=game.Cast.People[i];if(p.Alive&&p.Released&&p.Body&&p.Body.Distance2D(Pad)<224)crowd++;}
            if(crowd>=2)game.OpenCell(4,"picket");
        }
        if (!Turret || TurretBroken) return;
        Actor prey = null;
        // Fixed firing lane leaves the rear power housing reachable. Original
        // north-gallery columns and walls are native sight/projectile cover.
        Turret.Angle = 270;
        if (Turret.Distance2D(pawn) < 720 && cos(Turret.AngleTo(pawn) - 270) > 0.75 && Turret.CheckSight(pawn)) prey = pawn;
        for (int i = 0; i < game.Cast.People.Size(); i++)
        {
            let p = game.Cast.People[i];
            if (!p.Released || !p.Alive || !p.Body) continue;
            if (Turret.Distance2D(p.Body) < 720 && cos(Turret.AngleTo(p.Body) - 270) > 0.75 && Turret.CheckSight(p.Body) &&
                (!prey || Turret.Distance2D(p.Body) < Turret.Distance2D(prey))) prey = p.Body;
        }
        if (!prey) { TurretAim = 0; Turret.SetStateLabel('Spawn'); return; }
        TurretAim++;
        Turret.Angle = Turret.AngleTo(prey); Turret.SetStateLabel('Aim');
        if (TurretAim < 21 || level.time % 12 != 0) return;
        Vector3 start = Turret.Pos + (cos(Turret.Angle) * 28, sin(Turret.Angle) * 28, 12);
        Vector3 direction = prey.Pos + (0, 0, prey.Height * 0.5) - start;
        let bolt = Actor.Spawn('PDCheckpointBolt', start);
        if (bolt)
        {
            bolt.Target = Turret; bolt.Angle = Turret.Angle;
            bolt.Vel = direction / max(1, direction.Length()) * 18;
            TurretShots++; game.Alert(Turret.Pos.XY);
            Turret.A_StartSound("weapons/plasmaf", CHAN_WEAPON);
        }
    }
}
