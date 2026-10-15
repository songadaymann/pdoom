// Lives across native map loads. Browser save mirrors only committed hub exits.
class PDCampaignSession : StaticEventHandler
{
    bool Loaded;
    bool HubEntry;
    bool GuideGift;   // entering the first facility from the Bliss walk: the guide handed us his wrench
    bool Replay;
    int Saved0, Saved1, Lost0, Lost1, Following0, Following1;
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
        HubEntry=p.GetCVar("pdoom_hub_entry")!=0;
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
        if(Hal()){Saved1=saved;Lost1=lost;Following1=following;}else{Saved0=saved;Lost0=lost;Following0=following;}
        Console.Printf("PDOOM_CAMPAIGN {\"saved0\":%d,\"saved1\":%d,\"lost0\":%d,\"lost1\":%d,\"following0\":%d,\"following1\":%d,\"ceo_state\":\"%s\"}",Saved0,Saved1,Lost0,Lost1,Following0,Following1,game.CeoDown?"carried":"conscious");
    }
    void Enter(bool hal,bool asReplay=false)
    {
        let battle=PDLastStand.Get();
        HubEntry=!(battle&&battle.Active&&battle.Bliss);Replay=asReplay;
        // "Take this. It's dangerous to go alone." The guide's wrench comes with us.
        GuideGift=!hal&&battle&&battle.Active&&battle.Bliss;
        level.ChangeLevel(hal?"E1M7":"E1M4",0,CHANGELEVEL_NOINTERMISSION|CHANGELEVEL_RESETHEALTH|CHANGELEVEL_RESETINVENTORY);
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
