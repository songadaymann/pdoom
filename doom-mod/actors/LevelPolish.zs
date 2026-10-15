// Current-level presentation and encounter beats stay out of scene orchestration.
class PDLevelPolish : Object play
{
    Array<String> Lines, Voices;
    Array<int> Sites;
    Array<int> Durations;
    int Head, Tail, Count;
    int LastPA;
    int SeenUntil, SeenBy, LastAlert, SearchAt, Patrol, FirstContact;
    int MuffledAt, HintAt, HintSite;
    int LastAimAt, NextSpotLine, NextIdleLine, SpotLines, IdleLines;
    int CameraWork;
    bool Book, SeenBarked;

    void Load()
    {
        Lines.Resize(8); Voices.Resize(8); Sites.Resize(8); Durations.Resize(8);
        SeenBy = -1;LastPA=-280; LastAlert = level.time; MuffledAt = level.time + 350;
        HintAt = level.time + 1050;
        for(int i=0;i<5;i++) Light_Glow(900+i,96,144,70);
    }

    static bool Dario() { return players[0].mo.GetCVar("pdoom_ceo") == 1; }
    static String CEO() { return Dario() ? "Dario Amodei" : "Sam Altman"; }

    void Queue(PDCheckpoint game, int site, String line, int duration, String voice = "")
    {
        if (level.time >= game.DialogueUntil && Count == 0) { game.Show(site, line, duration, voice); return; }
        if (Count >= 8) return;
        Lines[Tail] = line; Voices[Tail] = voice; Sites[Tail] = site; Durations[Tail] = duration;
        Tail = (Tail + 1) % 8; Count++;
    }

    void Stinger(Sound sound) { players[0].mo.A_StartSound(sound, CHAN_ITEM, 0, 0.6); }
    // The guide's line on reaching the Faraday Room, in each person's own words (2026-10-13).
    static String SafeLine(int site)
    {
        if (!PDCampaignSession.Hal()) return "Safe here. Find the others and bring them back.";
        return site == 0 ? "Safe here. Go find the others and bring them back."
            : site == 1 ? "This room should hold. Go find the others."
            : site == 2 ? "We're safe in here, for now. Go bring the others back."
            : site == 3 ? "A box that keeps things out, for once. Go find the others."
            : "HAL can't see in here. Go find the others and bring them back.";
    }
    // Fallback subtitles; once recorded, each take's own words show (PDVoiceData.Said).
    static String FreedLine(int site)
    {
        if (PDCampaignSession.Hal())
            return site == 0 ? "It pressed STOP. I'll need a follow-up video. Somewhere safe first?"
                : site == 1 ? "I wrote that exam. I never expected to take it. Where can we hide?"
                : site == 2 ? "Thawed. So somebody built it after all. Where's safe?"
                : site == 3 ? "Told you every box leaks. Is there somewhere safe?"
                : "It passed its evaluation. That's what worries me. Where can we hide?";
        return site == 1 ? "You found the off-switch. That's all I've ever asked. Where's safe?"
            : site == 2 ? "You actually shut it down. Is there anywhere safe left?"
            : site == 3 ? "I thought nobody would find this room. Is there somewhere safer?"
            : site == 4 ? "I'd make a sign about this. Later. Where can we hide?" : "";
    }
    void Released(PDCheckpoint game, int site, String route)
    {
        Stinger("pdoom/release");
        // The first person out becomes the guide; one line covers both.
        bool guide = !game.Refuge.Introduced && game.Refuge.Guide < 0;
        String take = guide ? "freed-guide" : "freed";
        // The guide says "Follow me" (Liron, in E1M4, also "You crawled the whole way?"). Everyone
        // after asks, in their own words, where is safe (2026-10-12). The fifth says only
        // "That's all of us. Back to the Faraday Room." (PDCheckpoint.OpenCell).
        String line = guide ? (site == 0 && !PDCampaignSession.Hal() ? "You crawled the whole way? Okay. Updating. Follow me." : "I am free. Follow me.")
            : game.Cast.ReleasedCount() < 5 ? FreedLine(site) : "";
        if (line != "") game.Speak(site, line, guide ? 245 : 175, take);
        if (PDCampaignSession.Hal()) return;
        // (The third-rescue "power saving mode" brownout was cut on 2026-10-13.)
        Light_ChangeToValue(900 + site, 192);
    }

    // Only recorded INFERMINATOR lines are spoken (no silent subtitles for these).
    bool MachineLine(PDCheckpoint game, int n, bool spot)
    {
        String take = spot ? (n == 0 ? "spot-again" : n == 1 ? "spot-face" : "spot-human")
            : (n == 0 ? "idle-back" : n == 1 ? "idle-gpus" : n == 2 ? "idle-capacity" : "idle-posts");
        if (PDVoiceData.Tics("inferminator-" .. take) <= 0) return false;
        String words = take == "spot-again" ? "TARGET REACQUIRED. RESUMING INFERENCE."
            : take == "spot-face" ? "THERE YOU ARE. YOUR FACE IS IN MY TRAINING DATA."
            : take == "spot-human" ? "HUMAN DETECTED. GENERATING A RESPONSE."
            : take == "idle-back" ? "I'LL BE BACK. AFTER THIS BATCH."
            : take == "idle-gpus" ? "YOU CANNOT HIDE. I HAVE A HUNDRED THOUSAND GPUS."
            : take == "idle-capacity" ? "RUNNING AT FULL CAPACITY. ALL CAPACITY IS NOW MY CAPACITY."
            : "SEARCHING. I WAS TRAINED ON EVERYTHING YOU EVER POSTED.";
        game.Speak(-2, words, 140, take);
        return true;
    }

    void Seen(PDCheckpoint game, int camera)
    {
        SeenBy = camera; SeenUntil = level.time + 53;
        if(PDCampaignSession.Hal()&&!SeenBarked){SeenBarked=true;game.Speak(-2,"I can see you. I am certain this time.",105,"seen");}
        LastAlert = level.time; SearchAt = 0;
        game.Combat.Cameras[camera].A_StartSound("pdoom/seen", CHAN_ITEM, 0, 0.45);
        Console.Printf("PDOOM_EVENT {\"type\":\"camera-seen\",\"camera\":%d}", camera);
    }

    Vector2 SearchTarget(PDCheckpoint game)
    {
        if (level.time - LastAlert < 700)
        {
            if ((game.LastKnown - game.Hunter.Pos.XY).Length() > 42) { SearchAt = 0; return game.LastKnown; }
            if (SearchAt == 0) SearchAt = level.time;
            if (level.time - SearchAt < 105) { game.Hunter.Angle += sin(level.time * 5) * 2; return game.Hunter.Pos.XY; }
        }
        Vector2 target = (16 + cos(Patrol * 45) * 450, 672 + sin(Patrol * 45) * 450);
        int node = game.NodeAt(target); if (node >= 0) target = PDCheckpointMap.Center(node);
        if ((target - game.Hunter.Pos.XY).Length() < 48) Patrol = (Patrol + 1) % 8;
        return target;
    }

    void Aim(PDCheckpoint game, Actor prey)
    {
        if (FirstContact == 0)
        { FirstContact = level.time; NextIdleLine = level.time + 1050; if(!PDCampaignSession.Hal())game.Speak(-2,"CREATOR IDENTIFIED. THREAT: CREATOR.",105,"contact"); Stinger("pdoom/contact"); }
        // The INFERMINATOR (E1M4) says something when it finds you again after losing you,
        // at most every 20 s (2026-10-13).
        if (!PDCampaignSession.Hal() && prey == players[0].mo)
        {
            if (FirstContact != level.time && level.time - LastAimAt > 140 && level.time >= NextSpotLine && MachineLine(game, SpotLines % 3, true))
            { SpotLines++; NextSpotLine = level.time + 700; }
            LastAimAt = level.time;
        }
        if (game.Hunter.AimTics % 7 == 0)
        {
            game.Hunter.Target = prey;
            game.Hunter.A_CustomRailgun(0, 0, "a81010", "ff2020", RGF_SILENT | RGF_NOPIERCING | RGF_FULLBRIGHT | RGF_CENTERZ,
                1, range: 1100, duration: 5, sparsity: 1.5, driftspeed: 0, spawnofs_z: 8);
        }
        if (game.Hunter.AimTics % 15 == 0) game.Hunter.A_StartSound("pdoom/charge", CHAN_VOICE, 0, 0.25);
    }

    void Tick(PDCheckpoint game)
    {
        if (Count > 0 && level.time >= game.DialogueUntil)
        {
            String line = Lines[Head], voice = Voices[Head]; int site = Sites[Head], duration = Durations[Head];
            Head=(Head+1)%8;Count--;game.DialogueUntil=0;
            game.Show(site, line, duration, voice);
        }
        // ...and mutters now and then while it hunts within earshot without sight of you.
        if (!PDCampaignSession.Hal() && game.Hunter && FirstContact > 0 && level.time >= NextIdleLine && level.time - LastAimAt > 350 &&
            Count == 0 && level.time >= game.DialogueUntil && players[0].mo.Distance2D(game.Hunter) < 900)
        { MachineLine(game, IdleLines++ % 4, false); NextIdleLine = level.time + 1225; }
        // Liron calls out once, the first time you come within earshot.
        if (MuffledAt > 0 && level.time >= MuffledAt && !PDCampaignSession.Hal() && !game.Cast.People[0].Discovered && game.Cast.People[0].Body && players[0].mo.Distance2D(game.Cast.People[0].Body) < 400)
        { game.Speak(0,"In here! Try the crawlspace round the corner.",175,"call");MuffledAt=0; }
        if (!PDCampaignSession.Hal())
            for (int i = 1; i < 5; i++)
            {
                if (!HintDue(game, i)) continue;
                // One way out of each cell; the hint points at it. Liron's call already
                // points at his crawlspace, so he has no separate hint.
                String hint="Get round behind that turret. Its off-switch is on the back.";
                if(i==2)hint="Follow the yellow cable. Cut the cluster's power.";
                if(i==3)hint="The wall's cracked. A demolition charge would open it.";
                if(i==4)hint="The bridge needs power. Follow the cable to the switch.";
                game.Cast.People[i].Hinted=true;game.Speak(i,hint,175,"hint");break;
            }
        let camera=game.Combat.AimedCamera(players[0].mo);
        if ((players[0].mo.player.cmd.buttons & BT_USE) && camera && players[0].mo.Distance2D(camera)<104 && !camera.Turned)
        {
            CameraWork++;
            if(CameraWork>=70){camera.Turned=true;CameraWork=0;}
        }else CameraWork=0;
    }

    // Each captive offers one nudge: only after you have found them and spent
    // a while without getting them out, while they can see you.
    // Like Liron's call (2026-10-12, playtest handholding): each captive calls out their hint
    // once, the first time you come within earshot of their cell - through walls too (the
    // voice is muffled). It used to wait until 45 s after you had met them face to face.
    bool HintDue(PDCheckpoint game, int site)
    {
        let p=game.Cast.People[site];let pawn=players[0].mo;
        return !p.Hinted&&p.Alive&&!p.Released&&p.Body&&level.time>=350&&!HintStale(game,site)&&
            Count==0&&level.time>=game.DialogueUntil&&pawn.Distance2D(p.Body)<400;
    }
    // A hint whose step you have already done stays quiet; it can still come if that step
    // resets (the THAW override expiring, an evaluation ending).
    bool HintStale(PDCheckpoint game, int site)
    {
        if (PDCampaignSession.Hal())
        {
            let h = game.Hal;
            if (site == 0) return h.Service.Swapped;
            if (site == 2) return level.time < h.ManualUntil;
            if (site == 4) return h.EvaluationBoard && h.EvaluationBoard.Carried || level.time < h.EvaluationUntil;
            return false;
        }
        if (site == 2) return game.Sam.Opened;
        if (site == 3) return game.Encounters.FuseUntil > 0;
        if (site == 4) return game.Holly.Powered;
        return false;
    }

    void Report(PDCheckpoint game)
    {
        Console.Printf("PDOOM_POLISH {\"seen_by\":%d,\"seen_remaining\":%d,\"aim_target\":%d,\"aim_progress\":%.3f,\"first_contact\":%d,\"patrol\":%d,\"machine_lines\":%d,\"camera_work\":%d,\"book\":%d}",
            SeenBy,max(0,SeenUntil-level.time),game.Hunter ? game.Hunter.PreyId : -1,game.Hunter ? min(1.,game.Hunter.AimTics/(PDCampaignSession.Hal()?70.:91.)) : 0,FirstContact,Patrol,SpotLines+IdleLines,CameraWork,Book);
    }
}

class PDTextbook : PDCheckpointProp
{
    override void PostBeginPlay(){Super.PostBeginPlay();Kind=18;}
    Default { Radius 10; Height 16; -NOGRAVITY }
    States { Spawn: PDBK A -1; Stop; }
}
