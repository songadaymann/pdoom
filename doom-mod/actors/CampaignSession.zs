// Lives across native map loads. Browser save mirrors only committed hub exits.
class PDCampaignSession : StaticEventHandler
{
    bool Loaded;
    bool HubEntry;
    bool GuideGift;   // entering the first facility from the Bliss walk: the guide handed us his wrench
    bool OpeningEntry; // resumed first XP arrival, before the first facility
    bool Replay;
    int Saved0, Saved1, Lost0, Lost1, Following0, Following1;
    // MEG3N's factory (E2M7, 2026-10-20): the third group, and whether we walked in from SAFE MODE.
    int Saved2, Lost2, Following2;
    bool FactoryEntry;
    // AGENTIC SMITH's pod farm (E2M2, 2026-10-21): the fourth group, and whether we walked in.
    int Saved3, Lost3, Following3;
    int Ending3;   // Daniel's NDA ending: 0 none yet, 1 race, 2 slowdown (SMITH's pace for the rest of the level)
    bool AgenticEntry;
    // What you broke in each level (doom-web/campaign.js BROKEN, 2026-11-09): written when you leave through the exit,
    // put back quietly on the next walk-in, so a level you go back into is as you left it.
    int Broken0,Broken1,Broken2,Broken3;
    static PDCampaignSession Get(){return PDCampaignSession(StaticEventHandler.Find('PDCampaignSession'));}
    static bool Hal(){return level.MapName=="E1M7";}
    static String Id(){return Hal()?"hal-station":"five-prisons";}
    static String MapVersion(){return Hal()?"hal-station-v3":"five-prisons-v3";}
    void Load()
    {
        if(Loaded)return;Loaded=true;
        let p=players[0].mo;
        Saved0=int(p.GetCVar("pdoom_saved0"));Saved1=int(p.GetCVar("pdoom_saved1"));
        Lost0=int(p.GetCVar("pdoom_lost0"));Lost1=int(p.GetCVar("pdoom_lost1"));
        Following0=int(p.GetCVar("pdoom_follow0"));Following1=int(p.GetCVar("pdoom_follow1"));
        Saved2=int(p.GetCVar("pdoom_saved2"));Lost2=int(p.GetCVar("pdoom_lost2"));Following2=int(p.GetCVar("pdoom_follow2"));
        Saved3=int(p.GetCVar("pdoom_saved3"));Lost3=int(p.GetCVar("pdoom_lost3"));Following3=int(p.GetCVar("pdoom_follow3"));
        Ending3=int(p.GetCVar("pdoom_ending3"));
        Broken0=int(p.GetCVar("pdoom_broken0"));Broken1=int(p.GetCVar("pdoom_broken1"));
        Broken2=int(p.GetCVar("pdoom_broken2"));Broken3=int(p.GetCVar("pdoom_broken3"));
        HubEntry=p.GetCVar("pdoom_hub_entry")!=0;
        OpeningEntry=!Hal()&&p.GetCVar("pdoom_opening_checkpoint")==1;
        GuideGift=!Hal()&&p.GetCVar("pdoom_opening_checkpoint")==2;
    }
    int SavedMask(){return Hal()?Saved1:Saved0;}
    int LostMask(){return Hal()?Lost1:Lost0;}
    int FollowMask(){return Hal()?Following1:Following0;}
    void Apply(PDCheckpoint game)
    {
        Load();game.EntryHub=HubEntry;game.Replay=Replay;
        int saved=SavedMask(),lost=LostMask(),following=FollowMask();
        if(Replay)lost=0;
        for(int i=0;i<5;i++)
        {
            let p=game.Cast.People[i];
            if(saved&(1<<i)){p.Camped=true;p.Released=true;p.Discovered=true;p.Complete=true;p.Alive=false;if(p.Body)p.Body.Destroy();p.Body=null;Door_Open(PDCheckpointMap.SiteDoor(i),64);if(PDCampaignSession.Hal())game.Hal.Released(game,i);}
            else if(lost&(1<<i)){p.Alive=false;p.Discovered=true;if(p.Body){Actor.Spawn('PDDerezBadge',p.Body.Pos);p.Body.Destroy();p.Body=null;}if(PDCampaignSession.Hal()){let pods=ThinkerIterator.Create('PDHalPod');Actor pod;while((pod=Actor(pods.Next()))!=null)if(pod.Args[0]==i)pod.Destroy();}}
            else if(following&(1<<i))game.OpenCell(i,"return");
        }
        if(HubEntry)
        {
            // Hub progress must not turn a new facility's refuge into its spawn.
            // Keep the authored entrance and let the first local rescue guide us.
            game.HasWrench=true;game.Tool=0;
            // The HAL cover is recessed 32 units past the room's north wall.
            let crank=Actor.Spawn('PDHubCrank',(Hal()?(256,575.5):(1151.5,928),24));
            crank.Angle=Hal()?270:180;
            RestoreBroken(game);
        }
        if(GuideGift)
        {
            // In hand from the start; the first room's shelf wrench is no longer needed.
            GuideGift=false;game.HasWrench=true;game.Tool=0;
            let pawn=players[0].mo;let wrenches=ThinkerIterator.Create('PDCheckpointWrench');Actor w;Array<Actor> shelf;
            while((w=Actor(wrenches.Next()))!=null)if(w.Distance2D(pawn)<400)shelf.Push(w);
            for(int i=0;i<shelf.Size();i++)shelf[i].Destroy();
            pawn.A_StartSound("pdoom/wrench-pickup",CHAN_ITEM,0,.9);
        }
    }
    void Commit(PDCheckpoint game)
    {
        int saved=SavedMask(),lost=LostMask(),following=0;
        for(int i=0;i<5;i++)
        {
            let p=game.Cast.People[i];
            if(p.Camped)continue;
            if(!p.Alive){lost|=1<<i;continue;}
            if(game.Escape.Saved[i]||p.Taken&&game.Escape.Outside){saved|=1<<i;lost&=~(1<<i);}
            else if(p.Released)following|=1<<i;
        }
        if(Hal()){Saved1=saved;Lost1=lost;Following1=following;Broken1|=BrokenMask(game);}else{Saved0=saved;Lost0=lost;Following0=following;Broken0|=BrokenMask(game);}
        Console.Printf("PDOOM_CAMPAIGN {\"saved0\":%d,\"saved1\":%d,\"lost0\":%d,\"lost1\":%d,\"following0\":%d,\"following1\":%d,\"broken0\":%d,\"broken1\":%d,\"ceo_state\":\"%s\"}",Saved0,Saved1,Lost0,Lost1,Following0,Following1,Broken0,Broken1,game.CeoDown?"carried":"conscious");
    }
    // Levels 1-2's broken things, one bit each (doom-web/campaign.js BROKEN). Cameras are Combat.Cameras[] in map
    // order; HAL's door panels by door, its memory modules by Args[1] (50-53), the breaker glass as 0-2 hits.
    int BrokenMask(PDCheckpoint game)
    {
        int m=0;
        for(int i=0;i<min(9,game.Combat.Cameras.Size());i++)if(game.Combat.Cameras[i]&&game.Combat.Cameras[i].Broken)m|=1<<i;
        if(Hal())
        {
            for(int d=0;d<6;d++)if(game.Hal.Doors.Jammed[d])m|=1<<(9+d);
            for(int k=0;k<4;k++)if(!HalModule(50+k))m|=1<<(15+k);
            m|=clamp(game.Hal.Reboot.Glass,0,2)<<19;
        }
        else
        {
            if(game.Sam.Opened)m|=1<<9;
            if(game.Sam.PowerCut)m|=1<<10;
            if(game.Encounters.TurretBroken)m|=1<<11;
            if(game.Holly.BridgeUp)m|=1<<12;
        }
        return m;
    }
    static Actor HalModule(int kind){let it=ThinkerIterator.Create('PDHalTerminal');Actor t;while((t=Actor(it.Next()))!=null)if(t.Args[1]==kind&&!(t is 'PDHalDoorPanel'))return t;return null;}
    // Back in from SAFE MODE: what you broke last time is broken again, quietly: no blast, no alarm, no lines, no events.
    void RestoreBroken(PDCheckpoint game)
    {
        int m=Hal()?Broken1:Broken0;if(!m)return;
        for(int i=0;i<min(9,game.Combat.Cameras.Size());i++)
        {let cam=game.Combat.Cameras[i];if(cam&&(m&(1<<i))){cam.Broken=true;cam.bShootable=false;cam.SetStateLabel('Broken');}}
        if(Hal())
        {
            let hal=game.Hal;
            for(int d=0;d<6;d++)if(m&(1<<(9+d))){hal.Doors.Jammed[d]=true;hal.Doors.Reopen(d,64);}
            for(int k=0;k<4;k++)if(m&(1<<(15+k))){let t=HalModule(50+k);if(t){t.Destroy();hal.Modules++;}}
            // all four out: HAL stays docile (HalPersonality.ModulePulled), without saying so again
            if(hal.Modules>=4){hal.Pacified=true;hal.Personality.Disposition=0;hal.Personality.Offenses=0;hal.Personality.Compacted=false;hal.Personality.Met=true;}
            hal.Reboot.Glass=(m>>19)&3;
            return;
        }
        // Level 1: the shutter and its junction (RescueSam.zs), the turret (RescueEncounters.zs), the bridge (RescueHolly.zs).
        let sam=game.Sam;
        if((m&(1<<10))&&sam.Box)
        {
            sam.PowerCut=true;sam.Box.bShootable=false;sam.Box.SetStateLabel('Broken');
            let wires=ThinkerIterator.Create('PDSamCable');Actor cable;while((cable=Actor(wires.Next()))!=null)cable.SetStateLabel('Dead');
        }
        if((m&(1<<9))&&!sam.Opened){sam.Opened=true;sam.Route=(m&(1<<10))?"junction":"inside";Ceiling_RaiseByValue(886,64,56);}
        let enc=game.Encounters;
        if((m&(1<<11))&&!enc.TurretBroken){enc.TurretBroken=true;enc.TurretAim=0;if(enc.Turret){enc.Turret.bShootable=false;enc.Turret.SetStateLabel('Broken');}}
        let holly=game.Holly;
        if((m&(1<<12))&&!holly.BridgeUp)
        {
            holly.Powered=true;holly.BridgeUp=true;
            if(holly.Feed)holly.Feed.SetStateLabel('On');if(holly.Control)holly.Control.SetStateLabel('On');
            Floor_RaiseByValue(2,64,64);
        }
    }
    void Enter(bool hal,bool asReplay=false)
    {
        // Load first, as EnterFactory/EnterAgentic do: on a fresh New Game the first Load() would otherwise run on
        // the new map and reset GuideGift from the boot cvars, so the guide's wrench never reached your hands.
        Load();
        let battle=PDLastStand.Get();
        bool fromOpening=!hal&&(OpeningEntry||battle&&battle.Active&&battle.Bliss);
        HubEntry=!fromOpening;Replay=asReplay;OpeningEntry=false;FactoryEntry=false;AgenticEntry=false;
        // "Take this. It's dangerous to go alone." The guide's wrench comes with us.
        GuideGift=fromOpening;
        level.ChangeLevel(hal?"E1M7":"E1M4",0,CHANGELEVEL_NOINTERMISSION|CHANGELEVEL_RESETHEALTH|CHANGELEVEL_RESETINVENTORY);
    }
    // MEG3N.AVI's door: the factory's front door (Factory.zs ApplyHubEntry), wrench in hand.
    void EnterFactory()
    {
        Load();HubEntry=true;FactoryEntry=true;AgenticEntry=false;Replay=false;OpeningEntry=false;GuideGift=false;
        level.ChangeLevel("E2M7",0,CHANGELEVEL_NOINTERMISSION|CHANGELEVEL_RESETHEALTH|CHANGELEVEL_RESETINVENTORY);
    }
    // Leaving the factory: who came out with you, and who you freed but left inside.
    void CommitFactory(int leaving,int following,int broken=0)
    {
        Saved2|=leaving;Lost2&=~Saved2;Following2=following&~Saved2;Broken2|=broken;
        Console.Printf("PDOOM_CAMPAIGN {\"saved2\":%d,\"lost2\":%d,\"following2\":%d,\"broken2\":%d}",Saved2,Lost2,Following2,Broken2);
    }
    // AGENTIC.BAT's door: room 3 of the pod farm, wrench in hand, the bridge up (Agentic.zs ApplyHubEntry).
    void EnterAgentic()
    {
        Load();HubEntry=true;AgenticEntry=true;FactoryEntry=false;Replay=false;OpeningEntry=false;GuideGift=false;
        level.ChangeLevel("E2M2",0,CHANGELEVEL_NOINTERMISSION|CHANGELEVEL_RESETHEALTH|CHANGELEVEL_RESETINVENTORY);
    }
    // Answering the refuge payphone: who came out with you, and who you freed but left inside.
    void CommitAgentic(int leaving,int following,int ending=0,int broken=0)
    {
        Saved3|=leaving;Lost3&=~Saved3;Following3=following&~Saved3;if(ending==1||ending==2)Ending3=ending;Broken3|=broken;
        Console.Printf("PDOOM_CAMPAIGN {\"saved3\":%d,\"lost3\":%d,\"following3\":%d,\"ending3\":%d,\"broken3\":%d}",Saved3,Lost3,Following3,Ending3,Broken3);
    }
    void Restart(){level.ChangeLevel(level.MapName,0,CHANGELEVEL_NOINTERMISSION|CHANGELEVEL_RESETHEALTH|CHANGELEVEL_RESETINVENTORY);}
}

class PDHubCrank : PDCheckpointProp
{
    Default {Height 32;+WALLSPRITE}
    override void PostBeginPlay(){Super.PostBeginPlay();Kind=19;}
    override void Tick()
    {
        Super.Tick();let game=PDCheckpoint.Get();
        if(!game||!game.Initialized){bInvisible=true;Kind=-1;return;}
        if(!game.EntryHub){Destroy();return;}
        bInvisible=false;Kind=19;
    }
    States {Spawn: CPRL A -1;Stop;}
}
