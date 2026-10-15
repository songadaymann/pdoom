// Native wall-clipped melee and individual surveillance devices.
class PDRescueCombat : Object play
{
    Array<PDCheckpointCamera> Cameras;
    int Swings;
    int Hits;
    int StrikeAt;
    int Sparks;
    int Debris;
    int Smoke;
    int Explosions;

    void Load()
    {
        let it = ThinkerIterator.Create('PDCheckpointCamera');
        PDCheckpointCamera camera;
        while ((camera = PDCheckpointCamera(it.Next())) != null)
        { camera.ScanAngle = camera.Angle; Cameras.Push(camera); }
    }

    void Swing(PDCheckpoint game)
    {
        if (!game.HasWrench || level.time < game.AttackUntil) return;
        Swings++; StrikeAt = level.time + 6; game.AttackUntil = level.time + 18;
        players[0].mo.A_StartSound("weapons/punch", CHAN_WEAPON, 0, 0.3);
    }

    void Impact(PDCheckpoint game)
    {
        let pawn = players[0].mo;
        Actor hit = null;
        // Each trace respects original linedefs, height, pitch and intervening
        // actors. A narrow arc feels physical without reaching through walls.
        for (int i = 0; i < 3; i++)
        {
            double angle = pawn.Angle + (i == 1 ? -5 : i == 2 ? 5 : 0);
            FLineTraceData trace;
            pawn.LineTrace(angle, 112, pawn.Pitch, offsetz: pawn.player.viewheight, data: trace);
            hit = trace.HitActor;
            if (hit) break;
        }
        if (!hit) return;
        if (!(hit is 'PDCheckpointCamera') && !(hit is 'PDCheckpointTurret') && !(hit is 'PDSamJunction') && !(hit is 'PDHalTerminal') && hit != game.Hunter) return;
        Hits++; game.Impacts++;
        pawn.A_StartSound("world/metal1", CHAN_BODY);
        hit.DamageMobj(pawn, pawn, 25, 'CheckpointMelee', 0, pawn.Angle);
        game.Alert(pawn.Pos.XY);
        if (hit == game.Hunter && level.time >= game.Hunter.ImmuneUntil)
        {
            game.Hunter.StunUntil = level.time + 24; game.Hunter.ImmuneUntil = level.time + 105;
            game.Hunter.AimTics = 0;game.Hunter.LockedAim=false; game.Hunter.Mood = 3; game.Hunter.SetStateLabel('Stun');
        }
    }

    void MachineBlast(Vector3 at, bool heavy = false, bool camera = false)
    {
        let flash = Actor.Spawn(camera ? 'PDRescueCameraFlash' : 'PDExplosion', at); if (flash) flash.Scale *= heavy ? 0.8 : 0.45;
        Explosions++;
        for (int i = 0; i < (heavy ? 16 : 9); i++)
        {
            let bit = Actor.Spawn('PDRescueMachineDebris', at + (random(-5, 5), random(-5, 5), random(-4, 6)));
            if (bit) { bit.Vel = (random(-5, 5), random(-5, 5), random(2, 6)); Debris++; }
        }
        for (int i = 0; i < (heavy ? 8 : 4); i++)
        {
            let cloud = Actor.Spawn('PDRescueSmoke', at + (random(-8, 8), random(-8, 8), random(-4, 8)));
            if (cloud) { cloud.Vel = (random(-3, 3) * 0.2, random(-3, 3) * 0.2, 0.5); Smoke++; }
        }
        for (int i = 0; i < 10; i++)
        {
            let spark = Actor.Spawn('PDRescueSpark', at);
            if (spark) { spark.Vel = (random(-5, 5), random(-5, 5), random(-2, 5)); Sparks++; }
        }
    }

    void BreakCamera(PDCheckpoint game, PDCheckpointCamera camera)
    {
        if (!camera || camera.Broken) return;
        if(PDCampaignSession.Hal())game.Hal.Personality.Offense(game,camera);
        camera.Broken = true; camera.bShootable = false; camera.SetStateLabel('Broken');
        // Play from the persistent housing so the short-lived visual flash
        // cannot cut off the crunch and falling metal tail.
        camera.A_StartSound("pdoom/camera-break", CHAN_BODY);
        MachineBlast(camera.Pos + (0, 0, 12), false, true);
        game.Alert(camera.Pos.XY);
        Console.Printf("PDOOM_EVENT {\"type\":\"camera-broken\",\"x\":%.1f,\"y\":%.1f}", camera.Pos.X, camera.Pos.Y);
    }

    PDCheckpointCamera AimedCamera(Actor pawn)
    {
        for (int i = 0; i < Cameras.Size(); i++)
        {
            let camera = Cameras[i];
            if (!camera.Broken && pawn.Distance2D(camera) < 260 &&
                cos(pawn.AngleTo(camera) - pawn.Angle) > 0.94 && pawn.CheckSight(camera)) return camera;
        }
        return null;
    }

    void Tick(PDCheckpoint game)
    {
        if (StrikeAt > 0 && level.time >= StrikeAt)
        {
            StrikeAt = 0;
            if (game.HasWrench && game.Tool == 0) Impact(game);
        }
        let pawn = players[0].mo;
        for (int i = 0; i < Cameras.Size(); i++)
        {
            let camera = Cameras[i]; if (camera.Broken || camera.Turned) continue;
            if(level.time>=camera.SeenUntil)camera.SetStateLabel('Spawn');
            camera.ScanAngle = camera.Angle + sin(level.time * 1.2 + i * 37) * 20;
            // Reading an evaluation board is not a hostile surveillance report.
            if(game.Hal&&(level.time<game.Hal.EvaluationUntil ||
                game.Hal.EvaluationBoard&&game.Hal.EvaluationBoard.Carried&&
                game.Hal.EvaluationBoard.WatchingCamera>=0&&level.time>=game.Hal.EvaluationReady))
            {camera.SeenUntil=0;camera.SetStateLabel('Spawn');continue;}
            if (level.time % 14 == 0 && !PDRescueRefuge.Inside(pawn.Pos.XY) && pawn.Distance2D(camera) < 480 &&
                cos(camera.AngleTo(pawn) - camera.ScanAngle) > 0.85 && camera.CheckSight(pawn))
            { game.CameraReports++; camera.Reports++; if(level.time>=camera.SeenUntil){camera.SeenUntil=level.time+53;camera.SetStateLabel('Spotted');if(!PDCampaignSession.Hal()||game.Hal.Personality.Disposition==2)game.Polish.Seen(game,i);}game.Alert(pawn.Pos.XY); }
        }
    }

    int BrokenCount()
    {
        int count = 0;
        for (int i = 0; i < Cameras.Size(); i++) if (Cameras[i].Broken) count++;
        return count;
    }

    String Report(PDCheckpoint game)
    {
        int broken = 0; String devices = "[";
        for (int i = 0; i < Cameras.Size(); i++)
        {
            let camera = Cameras[i]; if (camera.Broken) broken++;
            if (i > 0) devices = devices .. ",";
            devices = devices .. String.Format("{\"id\":%d,\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"angle\":%.2f,\"scan_angle\":%.2f,\"wall_sprite\":%d,\"broken\":%d,\"turned\":%d,\"reports\":%d}", i, camera.Pos.X, camera.Pos.Y, camera.Pos.Z, camera.Angle, camera.ScanAngle, camera.bWallSprite, camera.Broken, camera.Turned, camera.Reports);
        }
        return String.Format("{\"wrench_swings\":%d,\"wrench_hits\":%d,\"attacking\":%d,\"cameras_total\":%d,\"cameras_broken\":%d,\"machine_explosions\":%d,\"machine_sparks\":%d,\"machine_debris\":%d,\"machine_smoke\":%d,\"turret_hits\":%d,\"cameras\":%s]}",
            Swings, Hits, level.time < game.AttackUntil, Cameras.Size(), broken, Explosions, Sparks, Debris, Smoke, game.Encounters.TurretHits, devices);
    }
}

class PDRescueCameraFlash : PDExplosion
{
    States
    {
    Spawn:
        MISL B 8 Bright;
        MISL C 6 Bright;
        MISL D 4 Bright;
        Stop;
    }
}

class PDRescueMachineDebris : PDRescueDebris
{
    States { Spawn: CPMD A -1; Stop; }
}
class PDRescueSpark : Actor
{
    Default { Radius 1; Height 1; +NOBLOCKMAP +NOCLIP +NOGRAVITY RenderStyle "Add"; Scale 0.12; }
    States { Spawn: PLSS AB 3 Bright; Stop; }
}
