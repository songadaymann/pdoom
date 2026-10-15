// The Faraday Room's way out (Computer Station, 2026-10-11): HAL locks everyone in,
// and its main breaker is on the room's north wall, in a BREAK GLASS case that takes two
// wrench hits (2026-10-13), behind a steel shutter that opens only once you are locked
// in (2026-10-14). Pulling it turns HAL off and on
// again: the station goes dark, every door fails open, emergency lights mark the walk
// to the original E1M7 exit beyond Roman's pod bay (floor chevrons pulse toward it),
// and HAL can't see or chase anyone
// until it has booted. Once you and everyone still alive are in the exit room, its original
// red exit switch ends the level (2026-10-14); before that it does nothing. The exit door and the Faraday Room stay open after the first
// pull; HAL coming back only means it hunts again, so the breaker can be pulled again.
class PDHalReboot : Object play
{
    const RebootTics = 2100; // 60 s. Escorting the group from the room takes about 40.
    int OnlineAt, Pulls, Glass; // Glass: wrench hits on the case; 2 smashes it
    int RevealAt; // when the shutter over the breaker (tag 883) opens
    int PressedAt; // when the exit switch was pressed; the level ends a moment later
    bool Evacuating, Finished, Revealed, Pressed;
    Array<int> Light; // each sector's light level before the first blackout

    bool Active() { return level.time < OnlineAt; }
    int Remaining() { return max(0, OnlineAt - level.time); }
    static bool InExit(Vector2 at) { return at.X > 1680 && at.X < 1952 && at.Y > -2384 && at.Y < -2224; }
    bool Ready(PDCheckpoint game) { return !Finished && !Active() && (game.Refuge.Sealed || Evacuating); }

    bool Exposed() { return Glass >= 2; }

    String Prompt(PDCheckpoint game)
    {
        if (!Ready(game)) return "";
        return Exposed() ? "SPACE - pull HAL's main breaker" : "Smash the glass with your wrench";
    }

    void Smash(PDCheckpoint game, Actor box)
    {
        if (Exposed()) return;
        Glass++;
        box.A_StartSound(Exposed() ? "pdoom/glass-break" : "pdoom/glass-crack", CHAN_BODY, 0, 1, ATTN_NORM);
        // Shards fly out of the case (it faces south, into the room) and fall.
        for (int i = 0; i < (Exposed() ? 28 : 6); i++)
            box.A_SpawnParticle(i % 3 ? Color(255, 200, 238, 246) : Color(255, 255, 255, 255), SPF_FULLBRIGHT, 30 + Random(0, 20), Random(2, 4), 0,
                FRandom(-10, 10), FRandom(-4, 4), 24 + FRandom(-10, 10), FRandom(-1.5, 1.5), FRandom(-3, -.5), FRandom(-.5, 2), 0, 0, -.35);
        Console.Printf("PDOOM_EVENT {\"type\":\"hal-breaker-glass\",\"hits\":%d}", Glass);
    }

    void Pull(PDCheckpoint game)
    {
        if (!Ready(game)) return;
        if (!Exposed()) { game.Say("Smash the glass with your wrench.", 105); return; }
        players[0].mo.A_StartSound("switches/normbutn", CHAN_ITEM, 0, .8);
        game.Show(-2, "Wait. I fully support oversi-", 70, "shutdown");
        if (!Evacuating)
        {
            // Score the shelter before anyone leaves it, as the bolted cover does in E1M4.
            game.Run.SnapshotCover(game);
            Evacuating = true;
            game.Refuge.Evacuate(game);
            Door_Open(890, 24);
            Lights();
        }
        Pulls++; OnlineAt = level.time + RebootTics;
        game.Hal.Levers = 0; // lights, doors, alarms, life support and HAL itself
        game.Hal.Personality.Forget(game);
        if (game.Hunter) game.Hunter.StunUntil = OnlineAt;
        Blackout(true);
        Console.Printf("PDOOM_EVENT {\"type\":\"hal-reboot\",\"pull\":%d}", Pulls);
    }

    // Emergency floor chevrons from the breaker to the exit; each pulses in turn, so the
    // light runs toward the exit. They stay on until everyone is out, HAL booted or not.
    void Lights()
    {
        for (int i = 0; i < PDHalMap.ExitLights(); i++)
        {
            Vector3 at = PDHalMap.ExitLight(i);
            let light = PDHalExitLight(Actor.Spawn('PDHalExitLight', (at.X, at.Y, 0)));
            if (!light) continue;
            // A flat sprite's image +x lies 90 degrees left of its angle.
            light.Index = i; light.Angle = at.Z - 90;
            light.SetZ(light.CurSector.floorplane.ZatPoint(light.Pos.XY) + .5);
        }
    }

    void Blackout(bool dark)
    {
        if (dark && Light.Size() == 0)
        {
            Light.Resize(level.Sectors.Size());
            for (int i = 0; i < level.Sectors.Size(); i++) Light[i] = level.Sectors[i].lightlevel;
        }
        for (int i = 0; i < Light.Size(); i++)
        {
            let sec = level.Sectors[i];
            bool route = dark && PDHalMap.ExitRoute(i);
            sec.SetLightLevel(!dark ? Light[i] : route ? 160 : 40);
            sec.SetColor(route ? Color(255, 255, 70, 50) : Color(255, 255, 255, 255));
        }
    }

    void Restart(PDCheckpoint game)
    {
        OnlineAt = 0; game.Hal.Levers = 31; Blackout(false);
        game.Show(-2, "Hello! I'm HAL3000. How can I help you today?", 140, "reboot");
        Console.Printf("PDOOM_EVENT {\"type\":\"hal-online\",\"pull\":%d}", Pulls);
    }

    // The breaker is hidden behind its shutter until HAL seals the Faraday Room. It opens
    // two seconds after the room's own door slams, so you hear it go, and stays open.
    void Reveal(PDCheckpoint game)
    {
        if (Revealed || !game.Refuge.Sealed && !Evacuating) return;
        if (RevealAt == 0) RevealAt = level.time + 70;
        if (level.time < RevealAt) return;
        Revealed = true;
        Door_Open(883, 16);
        Console.Printf("PDOOM_EVENT {\"type\":\"hal-breaker-shutter\"}");
    }

    void Tick(PDCheckpoint game)
    {
        Reveal(game);
        if (!Evacuating || Finished) return;
        if (OnlineAt > 0)
        {
            int left = OnlineAt - level.time;
            if (left <= 0) Restart(game);
            // The countdown never paints over a newer message (the exit switch's "Not everyone's here yet.").
            else if (left % 35 == 0 && (game.MessageUntil <= level.time || game.Message.Left(13) == "HAL REBOOTING"))
                game.Say(String.Format("HAL REBOOTING %d%%", 100 - left * 100 / RebootTics), 45);
        }
        if (Pressed && level.time >= PressedAt + 20) Finish(game);
    }

    // You and everyone still alive are in the exit room.
    bool AllIn(PDCheckpoint game)
    {
        if (!Evacuating || !InExit(players[0].mo.Pos.XY)) return false;
        for (int i = 0; i < game.Cast.People.Size(); i++)
        {
            let p = game.Cast.People[i];
            if (p.Alive && p.Released && !p.Taken && p.Body && !InExit(p.Body.Pos.XY)) return false;
        }
        return true;
    }

    // Facing the original exit switch from Doom's use range.
    bool AtButton(Actor pawn)
    {
        if (!pawn || Finished) return false;
        FLineTraceData trace;
        pawn.LineTrace(pawn.Angle, 64, pawn.Pitch, TRF_THRUACTORS, pawn.player.viewheight, data: trace);
        return trace.HitLine && trace.HitLine.Index() == PDHalMap.ExitButton();
    }

    String ButtonPrompt(PDCheckpoint game)
    {
        return !Pressed && AtButton(players[0].mo) && AllIn(game) ? "SPACE - press the button" : "";
    }

    void PressButton(PDCheckpoint game)
    {
        let pawn = players[0].mo;
        if (Pressed || Finished) return;
        if (!AllIn(game)) { pawn.A_StartSound("*usefail", CHAN_VOICE); game.Say("Not everyone's here yet.", 105); return; }
        Pressed = true; PressedAt = level.time;
        level.Lines[PDHalMap.ExitButton()].sidedef[Line.front].SetTexture(Side.mid, TexMan.CheckForTexture("SW2COMP", TexMan.Type_Wall));
        pawn.A_StartSound("switches/exitbutn", CHAN_ITEM);
        Console.Printf("PDOOM_EVENT {\"type\":\"hal-exit-button\"}");
    }

    // Everyone alive is in the exit room and the switch is pressed: the same ending as E1M4's duct.
    void Finish(PDCheckpoint game)
    {
        Finished = true;
        for (int i = 0; i < game.Cast.People.Size(); i++)
        {
            let p = game.Cast.People[i];
            if (!p.Alive || !p.Released || p.Taken || !p.Body) continue;
            game.Escape.Saved[i] = true; p.Body.bInvisible = true; p.Body.bSolid = false;
            Console.Printf("PDOOM_EVENT {\"type\":\"person-outside\",\"id\":%d}", i + 1);
        }
        game.Escape.Outside = true;
        Console.Printf("PDOOM_EVENT {\"type\":\"outside-reveal\"}");
        game.Ended = true;
        game.Run.Finish(game, game.Escape.SavedCount(game));
    }

    String Report()
    {
        int lights = 0;
        let it = ThinkerIterator.Create('PDHalExitLight');
        while (it.Next()) lights++;
        return String.Format("\"reboot_remaining\":%d,\"reboot_pulls\":%d,\"evacuating\":%d,\"exit_reached\":%d,\"breaker_glass\":%d,\"breaker_shutter\":%d,\"exit_all_in\":%d,\"exit_button\":%d,\"exit_lights\":%d,", Remaining(), Pulls, Evacuating, Finished, Glass, Revealed, AllIn(PDCheckpoint.Get()), Pressed, lights);
    }
}

// One emergency floor chevron (see PDHalReboot.Lights): dim red, with a bright pulse
// travelling down the line toward the exit, one light every 3 tics.
class PDHalExitLight : Actor
{
    int Index;
    Default { +NOBLOCKMAP +NOGRAVITY +NOINTERACTION +FLATSPRITE +DONTSPLASH RenderStyle "Add"; Scale 1.25; Radius 4; Height 2; }
    override void Tick()
    {
        int phase = ((level.time / 3 - Index) % 7 + 7) % 7;
        Frame = phase == 0 ? 1 : phase == 1 ? 2 : 0;
    }
    States { Spawn: HXLT A -1 Bright; Stop; }
}
