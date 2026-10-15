// Small collision-checked movements around an unchanged stay/refuge anchor.
// Escort navigation and the escape duct retain their own movement rules.
class PDRescueIdle : Object play
{
    // Render-only breathing continues during every living pose, including
    // captive, escort waits, pressure-pad duty and blocked/crouched steps.
    static void Animate(PDCheckpointPrisoner body)
    {
        double phase = level.time * 2.3 + body.Args[0] * 79;
        body.Scale = (body.RestScale.X * (1.0 - sin(phase) * 0.008),
            body.RestScale.Y * (1.0 + sin(phase) * 0.018));
    }

    static void InPlace(PDRescuePerson p)
    {
        // Keep feet planted when the person must wait for the player or keep
        // a switch powered; small look turns complement their breathing.
        p.Body.Angle += sin(level.time * 1.7 + p.Site * 79) * 0.45;
    }

    static void Tick(PDCheckpoint game, PDRescuePerson p)
    {
        let body = p.Body;
        bool onPad = game.Encounters.Pad && !game.Cast.People[4].Released &&
            body.Distance2D(game.Encounters.Pad) < 64;
        if (!p.Idling)
        {
            p.Idling = true; p.IdleGoal = p.HoldGoal;
            p.IdleUntil = level.time;
        }
        if (level.time >= p.IdleUntil)
        {
            p.IdleStep++;
            double heading = p.Site * 71 + p.IdleStep * 137;
            double radius = p.Sheltered ? 16 : !p.Released ? 16 : 24;
            p.IdleGoal = p.HoldGoal + (cos(heading), sin(heading)) * radius;
            p.IdleUntil = level.time + 49 + ((p.Site * 31 + p.IdleStep * 17) % 21);
        }
        Vector2 toward = (onPad ? p.HoldGoal : p.IdleGoal) - body.Pos.XY;
        bool moving = false;
        if (toward.Length() > 2)
        {
            Vector2 next = body.Pos.XY + toward / toward.Length() * min(0.65, toward.Length());
            let sector = level.PointInSector(next);
            bool safe = p.Sheltered ? PDRescueRefuge.Inside(next) : !p.Released ?
                PDCheckpointMap.SiteInside(p.Site, next) : sector == level.PointInSector(p.HoldGoal);
            // No navigation fallback: a blocked idle step must never redirect
            // a parked human toward a doorway or out of their hiding spot.
            if (safe && abs(sector.floorplane.ZatPoint(next) - body.floorz) < 16)
            {
                body.Angle = atan2(toward.Y, toward.X);
                moving = body.TryMove(next, 0);
            }
            if (!moving) p.IdleGoal = body.Pos.XY;
        }
        else
        {
            double look = p.Site * 71 + p.IdleStep * 137 + 50 + sin(level.time * 1.7 + p.Site * 79) * 18;
            look = look % 360;
            double delta = look - body.Angle;
            if (delta > 180) delta -= 360;
            if (delta < -180) delta += 360;
            body.Angle += clamp(delta, -1.5, 1.5);
        }
        if (moving != p.Walking)
        {
            if (moving) body.SetStateLabel('Walk'); else body.SetStateLabel('Spawn');
            p.Walking = moving;
        }
    }
}
