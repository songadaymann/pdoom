class PDCheckpoint : EventHandler
{
    bool Replay;
    bool CeoDown;
    bool EntryHub;
    bool Retreat;
    bool Initialized;
    bool BootHolding;
    bool Ended;
    bool Awake;
    bool HasWrench;
    bool HasGun;
    bool HasKey;
    bool HasCharge;
    bool GroupGathered;
    PDRescueCast Cast;
    PDRescueEncounters Encounters;
    PDRescueCombat Combat;
    PDRescueRefuge Refuge;
    PDRescueEscape Escape;
    PDRescueSam Sam;
    PDRescueHolly Holly;
    PDRescueRun Run;
    PDLevelPolish Polish;
    PDRescueLives Lives;
    PDFirstRescueIntro Intro;
    PDHalStation Hal;
    int Ammo;
    int Tool;
    int OldButtons;
    int AttackUntil;
    int WakeAt;
    int MessageUntil;
    int CameraReports;
    int Impacts;
    int DoorWait;
    int Controlled;
    int DialogueUntil;
    String DialogueSpeaker;
    String DialogueText;
    int DialogueSite, DialogueSerial;
    String DialogueLine;
    String Message;
    Vector2 LastKnown;
    PDCheckpointHunter Hunter;
    PDCheckpointCamera Camera;
    PDCheckpointNav HunterNav;
    Array<int> Links;
    Array<int> HumanLinks;
    Array<int> Doors;

    static PDCheckpoint Get() { return PDCheckpoint(EventHandler.Find('PDCheckpoint')); }

    void Say(String text, int duration = 140)
    {
        Message = text; MessageUntil = level.time + duration;
        Console.Printf("PDOOM_MESSAGE %s", text);
    }

    // line: the recorded take's name for this speaker (doom-web/voice/lines.json), or "".
    void Speak(int site, String text, int duration = 280, String line = "")
    {
        if(Polish) Polish.Queue(self,site,text,duration,line);
        else Show(site,text,duration,line);
    }
    // Puts one spoken line up now. A recorded take keeps the subtitle up as long as it plays,
    // and the subtitle reads what the take says (machine lines stay in capitals).
    void Show(int site, String text, int duration, String line)
    {
        DialogueSpeaker = site >= 0 ? PDCheckpointMap.SiteName(site) : site == -2 ? (PDCampaignSession.Hal()?"HAL3000":"INFERMINATOR") : "YOU";
        if (line != "")
        {
            String key = VoiceKey(site, line), said = PDVoiceData.Said(key);
            duration = max(duration, PDVoiceData.Tics(key) + 18);
            if (said != "") text = text == text.MakeUpper() ? said.MakeUpper() : said;
        }
        DialogueText = text; DialogueUntil = level.time + duration;
        DialogueSite = site; DialogueLine = line; DialogueSerial++;
    }
    static String VoiceWho(int site)
    {
        if (site == -1) return PDLevelPolish.Dario() ? "you-dario" : "you-sam";
        bool hal = PDCampaignSession.Hal();
        if (site == -2) return hal ? "hal" : "inferminator";
        if (hal) return site == 0 ? "rob" : site == 1 ? "dan" : site == 2 ? "nate" : site == 3 ? "roman" : "beth";
        return site == 0 ? "liron" : site == 1 ? "stuart" : site == 2 ? "eliezer" : site == 3 ? "hinton" : "holly";
    }
    static String VoiceKey(int site, String line) { return VoiceWho(site) .. "-" .. line; }
    // Where the voice comes from: a prisoner's body, the INFERMINATOR, or nowhere
    // (HAL is the station's PA; YOU are the listener).
    Actor VoiceSource()
    {
        if (DialogueSite >= 0 && DialogueSite < Cast.People.Size() && !Cast.People[DialogueSite].Taken) return Cast.People[DialogueSite].Body;
        if (DialogueSite == -2 && !PDCampaignSession.Hal()) return Hunter;
        return null;
    }

    override void WorldLoaded(WorldEvent e)
    {
        if (level.MapName != "E1M4" && level.MapName != "E1M7") { Initialized = false; return; }
        // A new map/attempt restores the normal rules, including any console
        // cheats enabled during the previous practice attempt.
        players[0].cheats&=~(CF_TOTALLYFROZEN|CF_FROZEN|CF_NOCLIP|CF_NOCLIP2|CF_GODMODE|CF_GODMODE2|CF_BUDDHA|CF_BUDDHA2|CF_FLY|CF_NOTARGET|CF_FRIGHTENING|CF_NOVELOCITY);
        CeoDown=false;Retreat=false;EntryHub=false;Replay=false;
        BootHolding=players[0].mo.GetCVar("pdoom_boot_hold")!=0;
        Ended=false;Awake=false;HasWrench=false;HasGun=false;HasKey=false;HasCharge=false;GroupGathered=false;
        Ammo=0;Tool=0;OldButtons=0;AttackUntil=0;WakeAt=0;MessageUntil=0;CameraReports=0;Impacts=0;DoorWait=0;Controlled=0;DialogueUntil=0;DialogueSite=-1;DialogueLine="";
        Links.Clear();HumanLinks.Clear();Doors.Clear();
        PDCampaignSession.Get().Load();
        Cast = new('PDRescueCast'); Cast.Load();
        Encounters = new('PDRescueEncounters'); Encounters.Load();
        Combat = new('PDRescueCombat'); Combat.Load();
        Refuge = new('PDRescueRefuge'); Refuge.Load();
        Escape = new('PDRescueEscape'); Escape.Load();
        Sam = new('PDRescueSam'); Sam.Load();
        Holly = new('PDRescueHolly'); if(!PDCampaignSession.Hal())Holly.Load();
        Run = new('PDRescueRun'); Run.Load();
        let machines = ThinkerIterator.Create('PDCheckpointHunter');
        Hunter = PDCheckpointHunter(machines.Next());
        let devices = ThinkerIterator.Create('PDCheckpointCamera');
        Camera = PDCheckpointCamera(devices.Next());
        PDCheckpointMap.Load(Links, HumanLinks, Doors);
        HunterNav = new('PDCheckpointNav');
        LastKnown = Hunter ? Hunter.Pos.XY : players[0].mo.Pos.XY;
        Polish=new('PDLevelPolish');Polish.Load();
        Hal=new('PDHalStation');if(PDCampaignSession.Hal())Hal.Load(self);
        Intro=new('PDFirstRescueIntro');
        Lives=new('PDRescueLives');PDCampaignSession.Get().Apply(self);
        Intro.Tick(self);
        // The turret gallery's raised centre block (tag 9) drops at once, as if its
        // original W1 trigger had fired: walk in and the turret is already firing
        // down the middle; the way to its rear breaker is round the sides.
        if(!PDCampaignSession.Hal())Floor_LowerToHighest(9,255,136,1);
        Initialized = true;
        Console.Printf("PDOOM_MOD_LOADED five-rescues-v1");
    }

    int NodeAt(Vector2 position, bool human = false)
    {
        int gx = int(floor((position.X - PDCheckpointMap.OriginX()) / PDCheckpointMap.Step()));
        int gy = int(floor((position.Y - PDCheckpointMap.OriginY()) / PDCheckpointMap.Step()));
        int best = -1; double nearest = 999999;
        for (int y = max(0, gy - 2); y <= min(PDCheckpointMap.Height() - 1, gy + 2); y++)
            for (int x = max(0, gx - 2); x <= min(PDCheckpointMap.Width() - 1, gx + 2); x++)
            {
                int nodeIndex = y * PDCheckpointMap.Width() + x;
                if (!(human ? HumanLinks[nodeIndex] : Links[nodeIndex])) continue;
                double distance = (PDCheckpointMap.Center(nodeIndex) - position).Length();
                if (distance < nearest) { nearest = distance; best = nodeIndex; }
            }
        return best;
    }

    void Alert(Vector2 at)
    {
        if(PDCampaignSession.Hal()&&Hal)
        {
            // Noise/ordinary surveillance wakes a friendly observer. Only
            // typed, witnessed offenses change its attitude.
            Awake=true;
            if(Hal.Personality.Disposition==2){LastKnown=at;Polish.LastAlert=level.time;}
            return;
        }
        LastKnown = at;
        if(Polish){Polish.LastAlert=level.time;Polish.SearchAt=0;}
        if (!Awake) { Awake = true; WakeAt = level.time; }
    }

    PDCheckpointProp TargetProp()
    {
        let pawn = players[0].mo;
        let items = ThinkerIterator.Create('PDCheckpointProp');
        PDCheckpointProp item, selected = null; double best = -99999;
        while ((item = PDCheckpointProp(items.Next())) != null)
        {
            if (item.Kind <= 0 || item is 'PDEvaluationSign' && PDEvaluationSign(item).Carried) continue;
            if (item.Args[0] >= 0 && item.Args[0] < 5 && Cast.People[item.Args[0]].Released &&
                (item.Kind == 3 || item.Kind == 4 || item.Kind >= 7 && item.Kind <= 10)) continue;
            double distance = pawn.Distance2D(item);
            double facing = cos(pawn.AngleTo(item) - pawn.Angle);
            if (distance > (item.Kind==28?224:104) || facing < (item.Kind==28?.65:.25) || !pawn.CheckSight(item)) continue;
            double score = facing * 150 - distance;
            if (score > best) { best = score; selected = item; }
        }
        return selected;
    }

    String Prompt()
    {
        String introPrompt=Intro.Prompt(self);if(introPrompt!="")return introPrompt;
        if(PDCampaignSession.Hal()){String h=Hal.Prompt(self);if(h!="")return h;}
        let nearby = TargetProp();
        String ending = nearby && (nearby.Kind == 1 || nearby.Kind == 19) ? "" : Escape.Prompt(self);
        if (ending != "") return ending;
        let item = TargetProp();
        if (item)
        {
            if(!PDCampaignSession.Hal()&&item.Kind>=30&&item.Kind<=33)return Holly.Prompt(item.Kind);
            if (item.Kind == 4) return "SPACE - pull release";
            if (item.Kind == 7) return Encounters.FuseUntil > 0 ? "Get back!" : HasCharge ? "SPACE - plant charge" : "";
            if (item.Kind == 9) return "SPACE - emergency release";
            if (item.Kind == 10) return "SPACE - cut turret power";
            if(item.Kind==17)return "Hold SPACE - reinstate CEO";
            if(item.Kind==19)return "Hold SPACE - return to SAFE MODE";
            if (item.Kind == 16) return Cast.People[2].Released ? "Cell door open" : "SPACE - open cell door";
            return "";
        }
        let pawn = players[0].mo;
        if(Polish.Book && Encounters.Turret && !Encounters.TurretBroken && pawn.Distance2D(Encounters.Turret)<112)return "SPACE - wedge textbook in the sensor";
        return "";
    }

    // The native use action must not also try a Doom wall behind a mod prop.
    // PlayerThink masks native BT_USE only here, then restores it for our tick.
    bool HandlesUse()
    {
        if(!Initialized||Ended||!players[0].mo)return false;
        return TargetProp()!=null || Escape.AtCover(players[0].mo) || Refuge.CanUse(players[0].mo) || Hal&&Hal.Reboot&&Hal.Reboot.AtButton(players[0].mo) ||
            Hal&&Hal.EvaluationBoard&&Hal.EvaluationBoard.Carried&&!Hal.EvaluationBoard.AtNativeDoor(players[0].mo);
    }

    void UseItem()
    {
        let item = TargetProp();
        if(!PDCampaignSession.Hal()&&item&&item.Kind>=30&&item.Kind<=33){Holly.Use(self,item);return;}
        if(PDCampaignSession.Hal()&&item&&item.Kind>=20){Hal.Use(self,item);return;}
        // Hal exists in every level; its Reboot only in the Computer Station.
        if(Hal&&Hal.Reboot&&!item&&Hal.Reboot.AtButton(players[0].mo)){Hal.Reboot.PressButton(self);return;}
        if (Escape.AtCover(players[0].mo) && (!item || item.Kind == 13)) { Escape.Use(self); return; }
        if(Polish.Book && Encounters.Turret && !Encounters.TurretBroken && players[0].mo.Distance2D(Encounters.Turret)<112 && players[0].mo.CheckSight(Encounters.Turret)){Polish.Book=false;Encounters.DisableTurret(self,"textbook");return;}
        if (!item)
        {
            if (Refuge.CanUse(players[0].mo)) Refuge.Use(self);
            else if(Hal&&Hal.EvaluationBoard&&Hal.EvaluationBoard.Carried&&!Hal.EvaluationBoard.AtNativeDoor(players[0].mo))Hal.EvaluationBoard.PutDown(self);
            return;
        }
        if (PickUp(item)) return;
        if (item.Kind == 3) Say("Locked.", 70);
        else if (item.Kind == 4) OpenCell(item.Args[0], item.Args[0] == 2 && Sam.Opened ? "power-shutter" : "service");
        else if (item.Kind == 7) Encounters.Plant(self, item);
        else if (item.Kind == 8) Say("Needs weight on the pad. Bring someone.", 105);
        else if (item.Kind == 9) OpenCell(4, "emergency");
        else if (item.Kind == 10) Encounters.DisableTurret(self, "breaker");
        else if (item.Kind == 12) Refuge.Use(self);
        else if (item.Kind == 13) Escape.Use(self);
        else if (item.Kind >= 14 && item.Kind <= 16) Sam.Use(self, item.Kind);
    }

    // Items are Doom pickups: walking over one takes it (E still works too).
    // Switches, releases, terminals and carried boards stay on E, like Doom's switches.
    static bool IsPickup(int kind){return kind==1||kind==2||kind==5||kind==6||kind==11||kind==18;}
    bool PickUp(PDCheckpointProp item)
    {
        if (!item || !IsPickup(item.Kind)) return false;
        let pawn = players[0].mo;
        if (item.Kind == 1)
        {
            HasWrench = true; Tool = 0;
            pawn.A_StartSound("pdoom/wrench-pickup", CHAN_ITEM, 0, 0.9);
            Say("Picked up a wrench.", 105);
        }
        else if (item.Kind == 2)
        {
            HasGun = true; Ammo += item.StoredAmmo; Tool = 1;
            pawn.A_StartSound("misc/w_pkup", CHAN_ITEM, 0, 0.9);
            Say("Picked up a slingshot. Hold fire to draw, release to shoot. T swaps tools.", 210);
        }
        else if (item.Kind == 5) { HasKey = true; pawn.A_StartSound("misc/k_pkup", CHAN_ITEM, 0, 0.9); Say("Picked up a maintenance key.", 105); }
        else if (item.Kind == 6) { HasCharge = true; pawn.A_StartSound("misc/i_pkup", CHAN_ITEM, 0, 0.9); Say("Picked up a demolition charge.", 105); }
        else if (item.Kind == 11) { Ammo += item.StoredAmmo; pawn.A_StartSound("misc/i_pkup", CHAN_ITEM, 0, 0.9); Say("Picked up 2 ball bearings.", 105); }
        else if (item.Kind == 18) { Polish.Book = true; pawn.A_StartSound("misc/i_pkup", CHAN_ITEM, 0, 0.9); Say("Picked up THE TEXTBOOK.", 105); }
        item.Destroy();
        return true;
    }
    void TouchPickups()
    {
        let pawn = players[0].mo;
        let items = ThinkerIterator.Create('PDCheckpointProp');
        PDCheckpointProp item;
        while ((item = PDCheckpointProp(items.Next())) != null)
        {
            if (!IsPickup(item.Kind)) continue;
            // Doom's touch test: overlapping bounding boxes, feet within reach of the item.
            double reach = pawn.Radius + item.Radius + 4;
            if (abs(item.Pos.X - pawn.Pos.X) > reach || abs(item.Pos.Y - pawn.Pos.Y) > reach) continue;
            if (item.Pos.Z > pawn.Pos.Z + pawn.Height || item.Pos.Z + max(8., item.Height) < pawn.Pos.Z - 8) continue;
            if (!pawn.CheckSight(item)) continue;
            PickUp(item);
        }
    }

    void OpenCell(int site, String routeName)
    {
        if (!Cast.Release(site, routeName)) return;
        // Their card comes up the moment they are out, so a release you did not see coming
        // (a breaker, a bridge, a blast) is named there and then, not when you next look at them.
        // Companions returning with you (or a dev fixture) were introduced on an earlier visit.
        if (!Cast.People[site].Carded && routeName != "return" && routeName != "development") Console.Printf("PDOOM_EVENT {\"type\":\"prisoner-discovered\",\"id\":%d}", site + 1);
        Cast.People[site].Carded = true;
        Intro.Tick(self);
        if(PDCampaignSession.Hal())Hal.Released(self,site);
        else Door_Open(PDCheckpointMap.SiteDoor(site), site == 3 ? 64 : 24);
        let locks = ThinkerIterator.Create('PDCheckpointLock'); Actor latch;
        while ((latch = Actor(locks.Next())) != null) if (latch.Args[0] == site) latch.Destroy();
        // The charge placement plate belongs to this wall, never to the opening
        // left behind by a breach, laser hit, or inside release.
        if(site == 3)
        {
            let plates = ThinkerIterator.Create('PDCheckpointBreach'); Actor plate;
            while ((plate = Actor(plates.Next())) != null) plate.Destroy();
        }
        if (routeName == "shot") Alert(players[0].mo.Pos.XY);
        Polish.Released(self,site,routeName);
        Refuge.FirstRescue(self, site);
        if (site == 2 && !PDCampaignSession.Hal()) Sam.OnRescue();
        if (Cast.ReleasedCount() == 5) Speak(site, "That's all of us. Back to the Faraday Room.", 280, "last");
        if (PDCampaignSession.Hal() && routeName != "return" && routeName != "development") Hal.Reacts(self, site);
        Console.Printf("PDOOM_EVENT {\"type\":\"prisoner-released\",\"id\":%d,\"route\":\"%s\"}", site + 1, routeName);
    }

    void SetSecurityGate(bool open)
    {
        if (open) Door_Open(881, 24); else Door_Close(881, 24);
    }

    // The slingshot: same instant hit as before (every puzzle hook still listens
    // for 'CheckpointShot'), a visible ball bearing in flight, and no gunshot. It
    // is quiet where you stand; the hunter hears the clatter where it lands.
    void Shoot()
    {
        if (!HasGun || level.time < AttackUntil) return;
        if (Ammo <= 0) { Say("Out of ball bearings.", 105); return; }
        let pawn = players[0].mo;
        Ammo--; AttackUntil = level.time + 24;
        pawn.A_StartSound("pdoom/sling-fire", CHAN_WEAPON);
        FTranslatedLineTarget victim;
        Actor puff = pawn.LineAttack(pawn.Angle, 2048, pawn.Pitch, 25, 'CheckpointShot', 'PDSlingPuff', flags: LAF_OVERRIDEZ, victim: victim, offsetz: pawn.player.viewheight);
        let hit = victim.linetarget;
        Vector3 from = pawn.Pos + (0, 0, pawn.player.viewheight - 6);
        Vector3 to = puff ? puff.Pos : hit ? hit.Pos + (0, 0, hit.Height * .5) : from + (cos(pawn.Angle) * cos(pawn.Pitch), sin(pawn.Angle) * cos(pawn.Pitch), -sin(pawn.Pitch)) * 1024;
        let stone = PDSlingStone(Actor.Spawn('PDSlingStone', from));
        if (stone) stone.Fly(to);
        Alert(to.XY);
        if (Hunter && hit == Hunter && level.time >= Hunter.ImmuneUntil)
        {
            Hunter.StunUntil = level.time + 53; Hunter.ImmuneUntil = level.time + 140;
            Hunter.AimTics = 0; Hunter.LockedAim=false; Hunter.Mood = 3; Hunter.SetStateLabel('Stun');
        }
    }

    override void NetworkProcess(ConsoleEvent e)
    {
        if(e.Name=="pdoom_ready"){BootHolding=false;return;}
        if(e.Name=="pdoom_restart"){PDCampaignSession.Get().Restart();return;}
        if(e.Name=="pdoom_enter_control"||e.Name=="pdoom_enter_hal"||e.Name=="pdoom_replay_control"||e.Name=="pdoom_replay_hal")
        {PDCampaignSession.Get().Enter(e.Name=="pdoom_enter_hal"||e.Name=="pdoom_replay_hal",e.Name=="pdoom_replay_control"||e.Name=="pdoom_replay_hal");return;}
        if(e.Name=="pdoom_enter_factory"){PDCampaignSession.Get().EnterFactory();return;}
        if (!Initialized || Ended) return;
        if(PDCampaignSession.Hal()&&Hal.Event(self,e))return;
        if (e.Name == "pdoom_tool" && HasGun) Tool = Tool == 0 ? 1 : 0;
        // Manual companion orders are intentionally disabled in this campaign.
        if(e.Name=="pdoom_test_laser_wall"&&players[0].mo.GetCVar("pdoom_development")){Run.Practice=true;Awake=true;WakeAt=level.time-175;Hunter.SetOrigin((-1280,1120,96),false);Hunter.StunUntil=0;Hunter.AimTics=0;Hunter.LockedAim=false;players[0].mo.SetOrigin((-1408,1120,96),false);players[0].mo.Angle=0;LastKnown=(-1408,1120);}
        if (e.Name == "pdoom_test_hunter_at_gate") { Run.Practice = true; Refuge.TestHunterAtGate(self); }
        if (e.Name == "pdoom_practice") Run.Practice = true;
    }

    void MoveBody(Actor body, Vector2 target, double speed, PDCheckpointNav nav, bool machine = false, double stopDistance = 40)
    {
        if ((target - body.Pos.XY).Length() < stopDistance) return;
        Vector2 destination = nav.Next(self, body.Pos.XY, target);
        int nodeIndex = NodeAt(destination, !machine);
        // Wait for Holly's crossing; companions must not bypass its power puzzle.
        if (!PDCampaignSession.Hal() && destination.X > -1216 && destination.X < -1024 && destination.Y > 1824 && destination.Y < 1952)
        {
            if (!Holly.BridgeUp) return;
            let landing = level.PointInSector(destination);
            if (landing.floorplane.ZatPoint(destination) < 192) return;
        }
        if(PDCampaignSession.Hal()&&Hal.Transit(body,destination))return;
        if (nodeIndex >= 0 && Doors[nodeIndex] > 0 &&
            (destination - body.Pos.XY).Length() < 104)
        {
            Vector2 doorPoint = PDCheckpointMap.DoorPoint(Doors[nodeIndex], destination);
            let sector = level.PointInSector(doorPoint);
            if (sector.ceilingplane.ZatPoint(doorPoint) - sector.floorplane.ZatPoint(doorPoint) < body.Height)
            {
                if (Doors[nodeIndex] == 882)
                { if (!machine) Refuge.Open(); return; }
                if (!PDCampaignSession.Hal() && Doors[nodeIndex] == 886 || Cast.DoorLocked(Doors[nodeIndex])) return;
                if(!machine&&PDCampaignSession.Hal()&&Hal.Doors.IsLocked(Doors[nodeIndex]))return;
                // The original exit door opens only when HAL's breaker is pulled (PDHalReboot).
                if(PDCampaignSession.Hal()&&Doors[nodeIndex]==890&&!Hal.Reboot.Evacuating)return;
                if (!machine || ++DoorWait >= 53)
                { Door_Open(Doors[nodeIndex], 16); DoorWait = 0; }
                return;
            }
        }
        Vector2 direction = destination - body.Pos.XY;
        if (machine && (PDRescueRefuge.Inside(destination) || !PDCampaignSession.Hal() && destination.X > 1136 && destination.X < 1200 && destination.Y > 720 && destination.Y < 880)) return;
        double distance = direction.Length();
        if (distance < 1) return;
        body.Angle = atan2(direction.Y, direction.X);
        // The graph limits floor steps. Allow descending the original stairs;
        // Doom's monster drop-off veto otherwise treats several treads as a cliff.
        if (!body.TryMove(body.Pos.XY + direction / distance * min(speed, distance), 1))
        {
            int currentNode = NodeAt(body.Pos.XY, !machine);
            if (currentNode >= 0)
            {
                Vector2 center = PDCheckpointMap.Center(currentNode) - body.Pos.XY;
                if (center.Length() > 4) body.TryMove(body.Pos.XY + center / center.Length() * speed, 1);
            }
        }
    }

    void TickHunter()
    {
        if (!Hunter || !Awake || level.time < Hunter.StunUntil) return;
        if(PDCampaignSession.Hal()&&Hal.Personality.FriendlyMovement(self))return;
        Actor prey = null;
        if(PDCampaignSession.Hal()&&level.time<Hal.WrongUntil){Hunter.AimTics=0;Hunter.LockedAim=false;MoveBody(Hunter,Hal.Target(self),2.0,HunterNav,true);return;}
        let pawn = players[0].mo;
        if (!PDRescueRefuge.Inside(pawn.Pos.XY) && Hunter.Distance2D(pawn) < (PDCampaignSession.Hal()&&!(Hal.Levers&1)?600:1000) && Hunter.CheckSight(pawn)) prey = pawn;
        for (int i = 0; i < Cast.People.Size(); i++)
        {
            let p = Cast.People[i];
            if (p.Released && p.Alive && p.Body && !PDRescueRefuge.Inside(p.Body.Pos.XY) && Hunter.Distance2D(p.Body) < (PDCampaignSession.Hal()&&!(Hal.Levers&1)?600:1000) &&
                Hunter.CheckSight(p.Body) && (!prey || Hunter.Distance2D(p.Body) < Hunter.Distance2D(prey))) prey = p.Body;
        }
        if(Hunter.LockedAim){
            if(Hunter.PreyId<10)prey=pawn;else if(Hunter.PreyId-10<5)prey=Cast.People[Hunter.PreyId-10].Body;else prey=null;
            if(!prey||prey.health<=0){Hunter.LockedAim=false;Hunter.AimTics=0;}
        }
        if (prey)
        {
            LastKnown = prey.Pos.XY; Polish.LastAlert=level.time; Hunter.Angle = Hunter.LockedAim?Hunter.ShotAngle:Hunter.AngleTo(prey);
            if (level.time > WakeAt + 140 && level.time >= Hunter.ReloadUntil)
            {
                if (Hunter.Mood != 2)
                { Hunter.Mood = 2; Hunter.SetStateLabel('Aim'); Hunter.AimTics = 0; Hunter.A_StartSound("weapons/plasmaf", CHAN_VOICE); }
                int preyId = prey == pawn ? Controlled : prey.Args[0] + 10;
                if (preyId != Hunter.PreyId) { Hunter.PreyId = preyId; Hunter.AimTics = 0; }
                Hunter.AimTics++;if(Hunter.AimTics==(PDCampaignSession.Hal()?49:70))Hunter.LockShot(prey);Polish.Aim(self,prey);
                if(PDCampaignSession.Hal()){Hunter.Sprite=Actor.GetSpriteIndex('H300');Hunter.Frame=2;}
                if (Hunter.AimTics >= (PDCampaignSession.Hal()?70:91))
                {
                    Hunter.AimTics = 0; Hunter.ReloadUntil = level.time + 70;
                    Hunter.A_StartSound("weapons/shotgf", CHAN_WEAPON);
                    int damage=PDCampaignSession.Hal()?20:30;bool survived=prey.health>damage;
                    Hunter.FireLocked(damage);
                    if (survived && prey != pawn) Say(String.Format("%s was hit!", PDCheckpointMap.SiteName(prey.Args[0])), 105);
                }
                return;
            }
        }
        else {Hunter.AimTics=0;Hunter.LockedAim=false;}
        if(PDCampaignSession.Hal())Hunter.Sprite=Actor.GetSpriteIndex('H300');
        if (Hunter.Mood != 1) { Hunter.Mood = 1; Hunter.SetStateLabel('Walk'); }
        // A slow, steady pursuer: normal walking must create distance.
        Vector2 previous = Hunter.Pos.XY;
        MoveBody(Hunter, PDCampaignSession.Hal()?Hal.Target(self):Polish.SearchTarget(self), PDCampaignSession.Hal()?2.0:1.4, HunterNav, true);
        if(!PDCampaignSession.Hal())Hunter.MovementFootsteps(previous);else {Hunter.SetOrigin((Hunter.Pos.XY,Hunter.floorz+8+sin(level.time*4)*2),false);Hunter.Sprite=Actor.GetSpriteIndex('H300');Hunter.Frame=Hal.Personality.Disposition;}
    }

    void LosePlayer()
    {
        if (Ended) return;
        let pawn = players[0].mo;
        Vector3 at = pawn.Pos;
        if (HasWrench) { Actor.Spawn('PDCheckpointWrench', at); HasWrench = false; }
        if (HasGun)
        {
            let dropped = PDCheckpointGun(Actor.Spawn('PDCheckpointGun', at));
            if (dropped) dropped.StoredAmmo = Ammo;
        }
        if (HasKey) Actor.Spawn('PDCheckpointKey', at);
        if (HasCharge) Actor.Spawn('PDCheckpointCharge', at);
        HasGun = false; Ammo = 0; HasKey = false; HasCharge = false;
        Lives.Down(self);
        if (Cast.TakeNext(self))
        {
            if (Hunter) { Hunter.AimTics = 0; Hunter.ReloadUntil = level.time + 105; }
        }
        else
        {
            pawn.health = 0; pawn.player.health = 0;
            Ended = true; pawn.player.cheats |= CF_TOTALLYFROZEN;
            Run.Finish(self, 0);
        }
    }

    override void WorldThingDied(WorldEvent e)
    {
        if (Initialized && !Ended) Cast.LoseBody(self, e.Thing);
    }

    void Report()
    {
        Intro.Report();
        if(!PDCampaignSession.Hal())Console.Printf("PDOOM_HOLLY %s",Holly.Report());
        Console.Printf("PDOOM_BREACH {\"markers\":%d}",Encounters.PlacementMarkers());
        Run.Report(); Polish.Report(self); Lives.Report(self); if(PDCampaignSession.Hal())Hal.Report();
        Console.Printf("PDOOM_SAM %s", Sam.Report());
        Console.Printf("PDOOM_COMBAT %s", Combat.Report(self));
        let voiceFrom = VoiceSource(); let listener = players[0].mo;
        Console.Printf("PDOOM_DIALOGUE {\"speaker\":\"%s\",\"text\":\"%s\",\"remaining\":%d,\"refuge_sealed\":%d,\"hint_stage\":%d,\"gathered_tics\":%d,\"serial\":%d,\"site\":%d,\"line\":\"%s\",\"voice\":\"%s\",\"from\":%d,\"sx\":%.1f,\"sy\":%.1f,\"sz\":%.1f,\"seen\":%d}",
            DialogueSpeaker, DialogueText, max(0, DialogueUntil - level.time), Refuge.Sealed, Refuge.HintStage, Refuge.Sealed ? level.time - Refuge.GatheredAt : 0,
            DialogueSerial, DialogueSite, DialogueLine, DialogueLine == "" ? "" : VoiceKey(DialogueSite, DialogueLine), voiceFrom != null,
            voiceFrom ? voiceFrom.Pos.X : 0, voiceFrom ? voiceFrom.Pos.Y : 0, voiceFrom ? voiceFrom.Pos.Z + voiceFrom.Height * .85 : 0,
            voiceFrom && listener ? listener.CheckSight(voiceFrom, SF_IGNOREVISIBILITY) : 1);
        Console.Printf("PDOOM_ESCAPE {\"bolts\":%d,\"aim_bolt\":%d,\"view_height\":%.2f,\"working_bolt\":%d,\"work_tics\":%d,\"opened\":%d,\"outside\":%d,\"saved\":%d,\"dev\":%d,\"saved_people\":[%d,%d,%d,%d,%d],\"steps\":[%d,%d,%d,%d,%d]}", Escape.CountBolts(), Escape.AimBolt(players[0].mo), players[0].mo.player.viewheight, Escape.WorkingBolt, Escape.WorkTics, Escape.Opened, Escape.Outside, Escape.SavedCount(self), Escape.DevApplied, Escape.Saved[0], Escape.Saved[1], Escape.Saved[2], Escape.Saved[3], Escape.Saved[4], Escape.Steps[0], Escape.Steps[1], Escape.Steps[2], Escape.Steps[3], Escape.Steps[4]);
        let pawn = players[0].mo;
        let first = Cast.People[0];
        String message = level.time < MessageUntil ? Message : "";
        String prompt = Ended ? "" : Prompt();
        Vector2 waypoint = HunterNav.HasWaypoint ? PDCheckpointMap.Center(HunterNav.Waypoint) : (0, 0);
        int doorNode = HunterNav.HasWaypoint ? NodeAt(waypoint) : -1;
        int doorTag = doorNode >= 0 ? Doors[doorNode] : 0;
        Vector2 doorPoint = PDCheckpointMap.DoorPoint(doorTag, waypoint);
        let doorSector = level.PointInSector(doorPoint);
        double doorHeight = doorTag > 0 ? doorSector.ceilingplane.ZatPoint(doorPoint) - doorSector.floorplane.ZatPoint(doorPoint) : 0;
        Console.Printf("PDOOM_STATE {\"level\":\"first-rescue\",\"campaign\":\"five-prisons\",\"map\":\"%s\",\"ticks\":%d,\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"angle\":%.1f,\"pitch\":%.1f,\"health\":%d,\"crouch\":%.2f,\"controlled\":%d,\"released\":%d,\"discovered\":%d,\"companion_alive\":%d,\"completed\":%d,\"hold\":%d,\"awake\":%d,\"wrench\":%d,\"flight\":%d,\"charging\":%d,\"impacts\":%d,\"gun\":%d,\"ammo\":%d,\"tool\":%d,\"camera_broken\":%d,\"camera_reports\":%d,\"hunter_x\":%.1f,\"hunter_y\":%.1f,\"hunter_z\":%.1f,\"hunter_floor\":%.1f,\"hunter_waypoint_x\":%.1f,\"hunter_waypoint_y\":%.1f,\"hunter_blocked_actor\":%d,\"hunter_blocked_line\":%d,\"hunter_door_tag\":%d,\"hunter_door_height\":%.1f,\"hunter_state\":%d,\"hunter_aim\":%d,\"hunter_lasers\":%d,\"hunter_steps\":%d,\"hunter_last_step_volume\":%.3f,\"companion_x\":%.1f,\"companion_y\":%.1f,\"route\":\"%s\",\"prompt\":\"%s\",\"message\":\"%s\",\"freed\":%d,\"alive\":%d,\"following\":%d,\"waiting\":%d,\"order_target\":%d,\"key\":%d,\"charge\":%d,\"fuse\":%d,\"turret_broken\":%d,\"turret_shots\":%d,\"pad_active\":%d,\"breaches\":%d,\"debris\":%d,\"smoke\":%d,\"group_gathered\":%d,\"refuge_known\":%d,\"guide\":%d,\"in_refuge\":%d,\"sheltered\":%d,\"refuge_open\":%d,\"cover_changed\":%d,\"medical_left\":%d,\"people\":%s}",
            level.MapName, level.time, pawn.Pos.X, pawn.Pos.Y, pawn.Pos.Z, pawn.Angle, pawn.Pitch, pawn.health, pawn.player.crouchfactor,
            Controlled, first.Released, first.Discovered, first.Alive && !first.Taken, first.Complete, first.Holding, Awake, HasWrench, 0,
            0, Impacts, HasGun, Ammo, Tool, Camera ? Camera.Broken : 1, CameraReports,
            Hunter ? Hunter.Pos.X : 0, Hunter ? Hunter.Pos.Y : 0, Hunter ? Hunter.Pos.Z : 0, Hunter ? Hunter.floorz : 0,
            waypoint.X, waypoint.Y, Hunter ? Hunter.BlockingMobj != null : 0, Hunter ? Hunter.BlockingLine != null : 0,
            doorTag, doorHeight, Hunter ? Hunter.Mood : 0, Hunter ? Hunter.AimTics : 0,
            Hunter ? Hunter.LaserShots : 0, Hunter ? Hunter.FootstepsPlayed : 0, Hunter ? Hunter.LastStepVolume : 0,
            first.Body ? first.Body.Pos.X : 0, first.Body ? first.Body.Pos.Y : 0, first.Route, prompt, message,
            Cast.ReleasedCount(), Cast.AliveCount(), Cast.FollowingCount(), Cast.WaitingCount(), Cast.OrderTarget(self), HasKey, HasCharge,
            max(0, Encounters.FuseUntil - level.time), Encounters.TurretBroken, Encounters.TurretShots, Encounters.PadActive,
            Encounters.Breaches, Encounters.DebrisSpawned, Encounters.SmokeSpawned, GroupGathered, Refuge.Known, Refuge.Guide + 1, PDRescueRefuge.Inside(pawn.Pos.XY), Refuge.ShelteredCount(self), Refuge.DoorRequested, Refuge.CoverChanged, Refuge.MedicalCount(), Cast.Report());
    }

    override void WorldTick()
    {
        if (!Initialized || !players[0].mo) return;
        if(BootHolding){if(level.time%7==0)Report();return;}
        if (!Ended)
        {
            Run.Tick();
            let pawn = players[0].mo;
            int buttons = pawn.player.cmd.buttons;
            if ((buttons & BT_USE) && !(OldButtons & BT_USE)) UseItem();
            if ((buttons & BT_ATTACK) && !(OldButtons & BT_ATTACK))
            {
                if (Hal&&Hal.EvaluationBoard&&Hal.EvaluationBoard.Carried) Say("Put down the board before using a weapon.",70);
                else if (Tool == 1) { if (HasGun && Ammo > 0) pawn.A_StartSound("pdoom/wrench-pickup", CHAN_ITEM, 0, .25, ATTN_NORM, .55); }
                else if (HasWrench) Combat.Swing(self);
                else Say("Empty hands.", 70);
            }
            // Slingshot: hold attack to draw back, let go to fire.
            if (!(buttons & BT_ATTACK) && (OldButtons & BT_ATTACK) && Tool == 1 &&
                !(Hal&&Hal.EvaluationBoard&&Hal.EvaluationBoard.Carried)) Shoot();
            OldButtons = buttons;
            TouchPickups();
            if (!Awake && (PDCampaignSession.Hal()?level.time>350:pawn.Pos.X<1840)) Alert(pawn.Pos.XY);
            Lives.Tick(self); if(Ended){Report();return;}
            if(PDCampaignSession.Hal())Hal.Tick(self);
            Intro.Tick(self); Polish.Tick(self); Combat.Tick(self); Encounters.Tick(self); Refuge.Tick(self); Escape.Tick(self); if(!PDCampaignSession.Hal())Sam.Tick(self); Cast.Tick(self); TickHunter();
            if (!GroupGathered && !Refuge.CompletedVisit(self) && Refuge.Known && PDRescueRefuge.Inside(pawn.Pos.XY) && Cast.Together())
            {
                GroupGathered = true;
                Refuge.BeginEnding(self);
                Console.Printf("PDOOM_EVENT {\"type\":\"group-gathered\",\"alive\":%d}", Cast.AliveCount());
            }
        }
        if (level.time % 7 == 0) Report();
    }
}
