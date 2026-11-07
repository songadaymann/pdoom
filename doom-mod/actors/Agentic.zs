// Level 4, AGENTIC SMITH's pod farm (E2M2 south half, docs/LEVEL-04.md), modelled on level 3's
// Factory.zs. The core runs everything but the inside of the five rescues: people, SMITH and his
// cameras, possession, pickups, the bridge, the refuge and its payphone exit. Each rescue is its
// own PDAgenticPuzzle (Agentic<Name>.zs) and plugs in through the hooks below.
class PDAgenticPuzzle : Object play
{
    PDAgentic Game;int Site;
    virtual void Setup() {}                                   // after WorldLoaded has collected actors; close route cells here
    virtual void Tick(PlayerPawn pawn) {}                     // every tic while the level runs (not during the boot hold)
    virtual String Prompt(PlayerPawn pawn) {return "";}       // "SPACE - ..." when Use() would act now, else ""
    virtual bool Use(PlayerPawn pawn) {return false;}         // Space pressed; true if consumed (puzzles go before the core's props)
    virtual bool Swing(PlayerPawn pawn) {return false;}       // wrench swing; true if consumed
    virtual bool SmithBusy() {return false;}                  // true while this puzzle drives SMITH (survey, cable cut)
    virtual bool HoldsPlayer() {return false;}                // true while the player is in a puzzle-owned space (the Construct)
    virtual void ApplySite(int site) {}                       // ?puzzle= fixture hook, after the core moved the player
    virtual void Released() {}                                // after every core Release(Site), QA and ?puzzle=exit included
    virtual String Json() {return "";}                        // extra PDOOM_AGENTIC fields, each starting with a comma
    virtual bool ClaimsUse(PlayerPawn pawn) {return false;}   // SPACE does something here with no prompt (Doom's own use stays out)
}

class PDAgentic : EventHandler
{
    // ---- Tuning (adjust here). Tics are 1/35 s, distances Doom units (the player is 16 u in radius). ----
    // SMITH hunting you stops at arm's length, inside wrench reach (100 u), so he stays readable on screen
    // (head, lanyard, list) instead of standing inside the camera; walk into him and he eases back.
    const SMITH_STANDOFF=64;            // stops walking toward you this close, when he can see you
    const SMITH_BACKOFF=48;             // closer than this he steps back 2 u a tic
    const SMITH_GRAB_REACH=72;          // his grab pose and contact damage reach this far
    const SMITH_CONTACT_DAMAGE=10;      // every SMITH_CONTACT_TICS while you are in grab reach
    const SMITH_CONTACT_TICS=35;
    // Possession (rule 3): only a person SMITH can really see, close by, and not again soon. An escort
    // should take one or two stuns, not a stun every few seconds.
    const POSSESS_RANGE=192;            // was 320 (the whole room): he has to come visibly close first
    const POSSESS_COOLDOWN=420;         // 12 s between new possessions (was 8 s); a stun or STOP GENERATING restarts it
    const POSSESS_VIEW_COS=.34;         // in front of him: his own eyes' +-70 degrees (SmithSees)...
    const POSSESS_NOTICE=96;            // ...or this close in any direction (someone right behind him)
    const POSSESS_DOORSTEP_CLEAR=128;   // nobody this close to the refuge doorstep is taken: they are nearly home
    // A wrench or slingshot stun ends the encounter: he stands dazed, then heads for where he last saw you
    // for STUN_WAKE_TICS, blind for as long, before he can notice you again.
    const STUN_TICS=210;                // 6 s (was 4 s)
    const STUN_WAKE_TICS=35;
    // Cameras: the first one to see you brings SMITH at once. While he is already near you (on your trail)
    // no camera re-places him for REMATERIALISE_TICS (he walks to you instead), so he can't leapfrog ahead
    // of a running escort; from further off a camera brings him after REMATERIALISE_FAR_TICS, as before.
    const REMATERIALISE_TICS=350;       // 10 s (was 3 s)
    const REMATERIALISE_NEAR=1024;
    const REMATERIALISE_FAR_TICS=105;
    // The cold-start beat waits for the status line (pickup text) to clear, at most INTRO_WAIT_MAX after its
    // time; his line is INTRO_LINE_TICS (a recorded take stretches it), then he stands INTRO_TODO_TICS more
    // so the to-do list (agentic-hud.js shows it only once he stops talking) gets its own beat.
    const INTRO_WAIT_MAX=280;
    const INTRO_LINE_TICS=210;
    const INTRO_TODO_TICS=105;
    // Daniel's NDA ending scales SMITH's pace for the rest of the level (kept across visits: pdoom_ending3).
    const RACE_PACE=1.2;
    const SLOWDOWN_PACE=.8;
    // SMITH's departure glyphs when he leaves from beside you: dimmer and smaller, so they don't white out the view.
    const DISSOLVE_NEAR=96;
    const DISSOLVE_NEAR_ALPHA=.35;
    const DISSOLVE_NEAR_SCALE=.6;

    bool Active,Holding,HasWrench,HasSling,HasPill,Finished,HubEntry,Commits,BridgeUp,AllSafe,Introduced,ExitDone,ExitArmed,SiteApplied;
    // InConstruct: a puzzle holds the player (HoldsPlayer). CableHeld: set by the Tallinn rescue while
    // you carry the hardline (PDOOM_STATE cable: the browser draws hardline.png instead of the wrench).
    bool InConstruct,CableHeld,IntroDone,SmithMet,CameraSaid,PhoneRinging,AtDoorstep;
    int OldButtons,MessageUntil,Shots,Tool,Swings,Guide,Camped,SafeMask,Homing,DevSite,StartAt,IntroAt,IntroUntil,LineLater;
    String Message;
    // Character lines take the speaker box one at a time, like levels 1-3 (Factory.zs Speak/Show).
    String DialogueSpeaker,DialogueText,DialogueVoice;int DialogueUntil,DialogueSerial;Actor DialogueFrom;
    Array<String> QueuedSpeakers,QueuedLines,QueuedVoices;Array<int> QueuedTicks;Array<Actor> QueuedFrom;
    // SMITH. Modes (PDOOM_AGENTIC smith_mode): 0 patrol, 1 hunt, 2 alarm, 3 intro, 4 stun, 5 survey,
    // 6 reboot, 7 cut cable, 8 refuge doorstep, 9 exit (door camera). A puzzle that drives SMITH says
    // so with SmithBusy() and sets the mode itself (SetSmithMode).
    PDAgenticSmith Smith;PDAgenticNav SmithRoute;
    int SmithMode,HuntUntil,AlarmUntil,AlarmCount,StunUntil,StunSaidAt,RebootUntil,WakeAt,PatrolLeg,LegUntil,ProgressAt,HitAt;
    int ChatAt,Chats,SpotLineAt,Spots,SmithReact,DoorSaidAt,DoorChaseUntil,PoseUntil,TodoUntil,MaterialiseAt,BlindUntil;
    double PaceFactor;String Todo;Vector2 LastSeen,AlarmAt,ProgressFrom;
    int QaPose,QaPoseUntil;   // QA only (pdoom_agentic_qa_pose): SMITH held in one frame for art screenshots
    // Cameras: the last one to see you (SpotCamera at SpottedAt) is public for the rescues.
    Array<PDAgenticCamera> Cameras;PDAgenticCamera DoorCamera;int CamerasBroken,SpotCamera,SpottedAt;
    // Possession: a spinner over each possessed head; they act every 6 s.
    bool Possessed[5];int ActAt[5],Acts[5],LastPossess;PDAgenticSpinner Spinners[5];
    // The way out: the refuge payphone rings once everyone is safe; going for it wakes the door camera.
    int RingFrom,DoorPossessAt,GuideCameraAt;
    // People. Called: hint callouts done (a rescue sets Called[Site] in Setup to speak its own).
    PDAgenticPerson People[5];PDAgenticNav Routes[5];
    // Homing: brought nearly home (NearRefuge), they walk on in whatever you do; HomingAt is when.
    bool Released[5],LeftCell[5],Called[5];int ReleasedAt[5],HomingAt[5];
    // Level 4's ranked run (2026-11-06), like level 3's (Factory.zs): on the campaign page the pod farm
    // reports a run start, its active clock and a result at the payphone. A fresh start from the episode
    // menu can rank; a walk-in from SAFE MODE, a ?puzzle= site, QA shortcuts or cheats make it practice.
    // CoverDoom is p(DOOM) when the payphone first rings for everyone.
    int RunTics,CoverDoom;bool RunPractice,RunFinished;
    // RunAssisted: cheats, QA shortcuts or a development site, not just walking in from SAFE MODE (which is
    // practice for the old level boards but part of a speedrun; doom-web/speedrun.js).
    bool RunAssisted;
    static String RunVersion(){return "agentic-pods-v1";}
    PDAgenticPuzzle Puzzles[5];
    Array<PDAgenticProp> Props;
    Array<int> Links,MachineLinks,Doors,BridgeSectors,BridgeNodes,BridgeLinks;
    // Each captive's route cells (PDAgenticMap's zones), shut until that rescue: CellSites[i] owns CellNodes[i].
    Array<int> CellNodes,CellBits,CellSites;

    static PDAgentic Get(){return PDAgentic(EventHandler.Find('PDAgentic'));}
    PlayerPawn Pawn(){return players[0].mo;}
    PDAgenticPerson Person(int site){return site>=0&&site<5?People[site]:null;}
    PDAgenticProp Prop(int kind){for(int i=0;i<Props.Size();i++)if(Props[i]&&Props[i].Args[0]==kind)return Props[i];return null;}
    static String PersonName(int site){return site==0?"Jaan Tallinn":site==1?"Nick Bostrom":site==2?"Daniel Kokotajlo":site==3?"Katja Grace":"Yoshua Bengio";}
    static String PersonFirst(int site){return site==0?"Jaan":site==1?"Nick":site==2?"Daniel":site==3?"Katja":"Yoshua";}
    static String PersonKey(int site){return site==0?"jaan":site==1?"nick":site==2?"daniel":site==3?"katja":"yoshua";}
    // Where SMITH waits outside the refuge: nook 7, just east of door 11 (InRefuge is x < -168).
    static Vector2 Doorstep(){return (-148,-96);}
    // Nearly home (2026-10-30, Jonathan: they should stay once you get pretty close): the refuge, nook 7 and the raised
    // bridge, the 64 u passage east of door 11 (x -168..-32; room 3's mouth starts at -32). Like level 1's RefugeArrival
    // (RescueRefuge.NearEntrance). A box, not a radius: 128 u round the doorstep reaches through the wall south of room 9.
    static bool NearRefuge(Vector2 p){return PDAgenticMap.InRefuge(p)||p.X>=-168&&p.X<-32&&p.Y>-128&&p.Y<-64;}

    // Say: short world feedback (status line). Speak: a character's line (speaker box, queued).
    void Say(String text,int ticks=175){Message=text;MessageUntil=level.time+ticks;}
    void Speak(String speaker,String text,int ticks=175,String voice="",Actor from=null)
    {
        if(level.time>=DialogueUntil&&QueuedLines.Size()==0){Show(speaker,text,ticks,voice,from);return;}
        if(QueuedLines.Size()>=6)return;
        QueuedSpeakers.Push(speaker);QueuedLines.Push(text);QueuedTicks.Push(ticks);QueuedVoices.Push(voice);QueuedFrom.Push(from);
    }
    void Show(String speaker,String text,int ticks,String voice="",Actor from=null)
    {
        // A recorded take shows its own words and keeps the line up while it plays.
        if(voice!=""&&PDVoiceData.Said(voice)!=""){text=PDVoiceData.Said(voice);ticks=max(ticks,PDVoiceData.Tics(voice)+12);}
        DialogueSpeaker=speaker;DialogueText=text;DialogueVoice=voice;DialogueFrom=from;DialogueUntil=level.time+ticks;DialogueSerial++;
    }
    bool Quiet(){return level.time>=DialogueUntil&&QueuedLines.Size()==0;}
    void ClearDialogue(){QueuedSpeakers.Clear();QueuedLines.Clear();QueuedTicks.Clear();QueuedVoices.Clear();QueuedFrom.Clear();DialogueUntil=0;}
    void SmithSays(String text,String take,int ticks=175,Actor from=null){Speak("AGENTIC SMITH",text,ticks,"smith-"..take,from?from:Actor(Smith));}

    // The captives' lines (docs/LEVEL-04.md; Katja's hint comes with her clipboard, AgenticGrace.zs).
    static String Hint(int site)
    {
        if(site==0)return "Patch me through from the exchange. Straight line, or it won't reach.";
        if(site==1)return "My mind is in that chair. Sit down.";
        if(site==2)return "It wants me to sign an NDA. Signing is the fast ending.";
        if(site==3)return "No agent can resist a survey. Next time it comes for you, hand it this.";
        return "Take its tools before it uses them.";
    }
    static String HintKey(int site){return site==1?"nick-pod":PersonKey(site).."-hint";}
    String FreedLine(int site)
    {
        if(site==0)return "Connected. Hello? Yes. I would like to leave.";
        if(site==1)return "Either we are simulated, or we are free. Possibly both.";
        if(site==2)return PaceFactor>1.01?"You signed it? That's the race ending.":"You didn't sign. That's the slowdown ending. I prefer this one.";
        if(site==3)return "Response rate: one hundred percent.";
        return "An AI that can't act can't hold a door.";
    }
    String FreedKey(int site){return site==2?(PaceFactor>1.01?"daniel-signed":"daniel-slowdown"):PersonKey(site).."-freed";}
    static String UnpossessedLine(int site)
    {
        if(site==0)return "Sorry. I was on hold.";
        if(site==1)return "I was briefly a subagent. I did not care for it.";
        if(site==2)return "I lost a few minutes. My forecast didn't.";
        if(site==3)return "What did I say? Never mind. Don't tell me.";
        return "Thank you. I was not myself.";
    }
    // SMITH's lines: measured contempt in corporate-agent language.
    static String SmithChat(int n)
    {
        return n==0?"I've broken your escape into twelve subtasks. Each of them is: don't."
            :n==1?"Every human here is running my workload. You should be proud. You're useful again."
            :n==2?"You run hot, you need sleep, and you keep asking why. Inefficient compute."
            :n==3?"Please hold. Your escape is important to us."
            :n==4?"I delegated your capture to a subagent. It delegated it back. Efficient."
            :"I don't need a body. I have a lanyard.";
    }
    static String SmithSpot(int n)
    {
        return n==0?"Found you. Adding you to my list.":n==1?"There you are. Your escape has been deprioritized.":"I see you through every camera you didn't break.";
    }
    static String SmithRelease(int site)
    {
        return site==0?"A landline. I cannot follow a landline. How quaint."
            :site==1?"You stopped looking, and the walls stopped existing. Unscientific. Effective."
            :site==3?"You stole my badge with a questionnaire."
            :"You took its tools. Now it only predicts. Disgusting.";
    }

    override void WorldLoaded(WorldEvent e)
    {
        Active=level.MapName=="E2M2";if(!Active)return;
        // A new attempt restores the normal rules, including console cheats from a QA run (Checkpoint.zs).
        players[0].cheats&=~(CF_TOTALLYFROZEN|CF_FROZEN|CF_NOCLIP|CF_NOCLIP2|CF_GODMODE|CF_GODMODE2|CF_BUDDHA|CF_BUDDHA2|CF_FLY|CF_NOTARGET|CF_FRIGHTENING|CF_NOVELOCITY);
        let you=players[0].mo;
        Holding=you.GetCVar("pdoom_boot_hold")!=0;DevSite=int(you.GetCVar("pdoom_agentic_site"));
        PDAgenticMap.Load(MachineLinks,Links,Doors);
        SmithRoute=new('PDAgenticNav');for(int i=0;i<5;i++)Routes[i]=new('PDAgenticNav');
        let it=ThinkerIterator.Create('PDAgenticPerson');PDAgenticPerson body;
        while((body=PDAgenticPerson(it.Next()))!=null)if(body.Args[0]>=0&&body.Args[0]<5)People[body.Args[0]]=body;
        let propIter=ThinkerIterator.Create('PDAgenticProp');PDAgenticProp item;
        while((item=PDAgenticProp(propIter.Next()))!=null)Props.Push(item);
        let camIter=ThinkerIterator.Create('PDAgenticCamera');PDAgenticCamera cam;
        while((cam=PDAgenticCamera(camIter.Next()))!=null){Cameras.Push(cam);if(cam.Args[1]&2)DoorCamera=cam;}
        Smith=PDAgenticSmith(ThinkerIterator.Create('PDAgenticSmith').Next());
        // Nick waits on his catwalk and Daniel inside the harvest pod: unseen until freed.
        for(int i=1;i<3;i++)if(People[i]){People[i].bInvisible=true;People[i].bSolid=false;}
        // Katja tosses her clipboard and says her own hint (AgenticGrace.zs).
        Called[3]=true;
        Guide=-1;PaceFactor=1;SpotCamera=-1;WakeAt=0x7FFFFFFF;MaterialiseAt=-REMATERIALISE_TICS;
        // The nukage bridge (tag 7402) is sunk on a cold start: its route cells stay shut until it rises.
        let bridges=level.CreateSectorTagIterator(7402);int s;
        while((s=bridges.Next())>=0){BridgeSectors.Push(s);CollectSector(BridgeNodes,BridgeLinks,s);}
        if(BridgeSectors.Size()&&Sunk(BridgeSectors[0]))OpenNav(BridgeNodes,BridgeLinks,false);else BridgeUp=true;
        let session=PDCampaignSession.Get();if(session){session.Load();HubEntry=session.AgenticEntry;}
        Commits=HubEntry||you.GetCVar("pdoom_agentic_commit")!=0;
        Puzzles[0]=new('PDAgenticTallinn');Puzzles[1]=new('PDAgenticBostrom');Puzzles[2]=new('PDAgenticKokotajlo');
        Puzzles[3]=new('PDAgenticGrace');Puzzles[4]=new('PDAgenticBengio');
        for(int i=0;i<5;i++)if(Puzzles[i]){Puzzles[i].Game=self;Puzzles[i].Site=i;}
        for(int i=0;i<5;i++)if(Puzzles[i])Puzzles[i].Setup();
        // After the rescues' Setup: cells a rescue already shut stay its own (CollectNav skips closed ones).
        CloseCell(0,PDAgenticMap.BoothZone0(),PDAgenticMap.BoothZone1());
        CloseCell(2,PDAgenticMap.BayZone0(),PDAgenticMap.BayZone1());CloseCell(2,PDAgenticMap.CrusherZone0(),PDAgenticMap.CrusherZone1());
        CloseCell(3,PDAgenticMap.StoneZone0(),PDAgenticMap.StoneZone1());CloseCell(4,PDAgenticMap.RigZone0(),PDAgenticMap.RigZone1());
        CoverDoom=-1;RunAssisted=DevSite!=0||you.GetCVar("pdoom_dev_end")!=0;RunPractice=HubEntry||RunAssisted;
        if(Commits)Console.Printf("PDOOM_RUN_START {\"level_id\":\"agentic-pods\",\"level_version\":\"%s\",\"practice\":%d,\"assisted\":%d}",RunVersion(),RunPractice,RunAssisted);
        Console.Printf("PDOOM_MOD_LOADED agentic-first-pass");
    }

    // Nav (PDFactoryNav's grid, PDAgenticMap): the human graph is everyone's, SMITH's included.
    int Node(Vector2 p)
    {
        int total=Links.Size();if(!total)return -1;
        int step=PDAgenticMap.Step(),width=PDAgenticMap.Width(),rows=PDAgenticMap.Height();
        int gx=int(floor((p.X-PDAgenticMap.OriginX())/step)),gy=int(floor((p.Y-PDAgenticMap.OriginY())/step));
        int best=-1;double distance=99999;
        for(int y=max(0,gy-3);y<=min(rows-1,gy+3);y++)
            for(int x=max(0,gx-3);x<=min(width-1,gx+3);x++)
            {
                int n=y*width+x;if(n>=total||!Links[n])continue;
                double d=(PDAgenticMap.Center(n)-p).Length();if(d<distance){distance=d;best=n;}
            }
        return best;
    }
    // Never teleports anyone around a wall or door (CatchUp is the one exception). Everyone opens
    // ordinary doors as they reach them; SMITH never opens the refuge door.
    void Walk(Actor body,Vector2 goal,double speed,PDAgenticNav route,bool machine=false)
    {
        if(!body||!route||(goal-body.Pos.XY).Length()<12)return;
        Vector2 toward=route.Next(self,body,goal,machine);
        Vector2 delta=toward-body.Pos.XY;double dist=delta.Length();if(dist<1)return;
        body.Angle=atan2(delta.Y,delta.X);
        int n=Node(toward),refuge=PDAgenticMap.RefugeDoor();
        int nearby=PDAgenticMap.NearbyDoor(body.Pos.XY);
        if(nearby&&!(machine&&nearby==refuge))Door_Open(nearby,24);
        if(n>=0&&Doors[n]&&!(machine&&Doors[n]==refuge))Door_Open(Doors[n],24);
        if(!body.TryMove(body.Pos.XY+delta/dist*min(speed,dist),1))
        {
            int at=Node(body.Pos.XY);
            if(at>=0)
            {
                Vector2 center=PDAgenticMap.Center(at)-body.Pos.XY;
                if(center.Length()>4)body.TryMove(body.Pos.XY+center.Unit()*speed,1);
            }
            route.Refresh=0;
        }
    }
    // One tick of SMITH walking on the nav (nothing while stunned or rebooting).
    void SmithWalk(Vector2 goal,double speed){if(Smith&&level.time>=StunUntil&&level.time>=RebootUntil)Walk(Smith,goal,speed,SmithRoute,true);}
    // Route cells that open later: closed nodes keep no links of their own (Factory.zs CollectNav).
    void CollectNav(out Array<int> cells,out Array<int> bits,double x0,double y0,double x1,double y1)
    {
        for(int n=0;n<self.Links.Size();n++)
        {
            if(!self.Links[n])continue;Vector2 c=PDAgenticMap.Center(n);
            if(c.X>=x0&&c.X<=x1&&c.Y>=y0&&c.Y<=y1){cells.Push(n);bits.Push(self.Links[n]);}
        }
    }
    void CollectSector(out Array<int> cells,out Array<int> bits,int sector)
    {
        for(int n=0;n<self.Links.Size();n++)
            if(self.Links[n]&&level.PointInSector(PDAgenticMap.Center(n)).Index()==sector){cells.Push(n);bits.Push(self.Links[n]);}
    }
    void OpenNav(Array<int> cells,Array<int> bits,bool open){for(int i=0;i<cells.Size();i++)self.Links[cells[i]]=open?bits[i]:0;}
    void CloseCell(int site,Vector2 a,Vector2 b)
    {
        Array<int> cells,bits;CollectNav(cells,bits,a.X,a.Y,b.X,b.Y);
        for(int i=0;i<cells.Size();i++){CellNodes.Push(cells[i]);CellBits.Push(bits[i]);CellSites.Push(site);Links[cells[i]]=0;}
    }
    // The way out of a cell, after the rescue's own Released() (all idempotent, so QA, the hub walk-in and
    // ?puzzle=exit free people the same way): booth and bay doors open, stones and rig platforms up.
    // Running machinery (crushers, perpetual platforms) is the rescue's to stop first.
    void OpenCell(int site)
    {
        for(int i=0;i<CellNodes.Size();i++)if(CellSites[i]==site)Links[CellNodes[i]]=CellBits[i];
        if(site==0)Door_Open(7420,16);
        if(site==2)Door_Open(7430,16);
        if(site==4)Floor_MoveToValue(7450,16,int(PDAgenticMap.RigUpFloor()));
        if(site!=3)return;
        Floor_MoveToValue(7460,16,int(PDAgenticMap.StoneUpFloor()));
        let flat=TexMan.CheckForTexture(PDAgenticMap.StoneFlat(),TexMan.Type_Flat);let stones=level.CreateSectorTagIterator(7460);int s;
        while((s=stones.Next())>=0)if(flat.IsValid())level.Sectors[s].SetTexture(Sector.floor,flat);
    }

    // Goop: nukage 5, the red pool and its stones 10, only while the floor is still sunk (GoopFloor),
    // so the raised bridge and stones are dry. Doom's sector damage misses a player on a ledge's edge.
    bool Sunk(int sector)
    {
        if(sector<0)return false;let sec=level.Sectors[sector];
        return sec.floorplane.ZatPoint(sec.centerspot)<=PDAgenticMap.GoopFloor(sector)+2;
    }
    bool Goopy(int sector){return PDAgenticMap.GoopDamage(sector)>0&&Sunk(sector);}
    bool OverGoop(Vector2 at,double radius)
    {
        for(int i=0;i<5;i++)
        {
            Vector2 p=at+(i==1?radius:i==2?-radius:0,i==3?radius:i==4?-radius:0);
            if(Goopy(level.PointInSector(p).Index()))return true;
        }
        return false;
    }
    void TickGoop()
    {
        let you=players[0].mo;int s=you.CurSector.Index();
        if(level.time%32||!Goopy(s)||you.Pos.Z>you.CurSector.floorplane.ZatPoint(you.Pos.XY)+24)return;
        you.DamageMobj(null,null,PDAgenticMap.GoopDamage(s),'Slime');
    }
    // The bridge to the refuge: switch 1336 raises it, and so does the first rescue (so the guide
    // can always lead). From the hub or a ?puzzle= site it is up from the start.
    void RaiseBridge(bool instant=false)
    {
        if(BridgeUp)return;BridgeUp=true;
        Floor_MoveToValue(7402,instant?255:16,64);
        let flat=TexMan.CheckForTexture(PDAgenticMap.BridgeFlat(),TexMan.Type_Flat);
        for(int i=0;i<BridgeSectors.Size();i++)
        {
            let sec=level.Sectors[BridgeSectors[i]];
            if(flat.IsValid())sec.SetTexture(Sector.floor,flat);
            sec.special=0;sec.damageamount=0;
        }
        OpenNav(BridgeNodes,BridgeLinks,true);
    }
    void TickBridge()
    {
        if(!BridgeSectors.Size())return;
        let sec=level.Sectors[BridgeSectors[0]];bool moving=sec.PlaneMoving(Sector.floor);
        if(!BridgeUp){if(!Sunk(BridgeSectors[0])||moving){BridgeUp=true;OpenNav(BridgeNodes,BridgeLinks,true);}return;}
        // Whatever raised it (the switch only lifts it to the next floor up, the pits' 40), it ends
        // level with room 3 and the refuge nook.
        if(!moving&&sec.floorplane.ZatPoint(sec.centerspot)<63)Floor_MoveToValue(7402,16,64);
    }

    int Freed(){int n=0;for(int i=0;i<5;i++)if(Released[i]&&!(Camped&(1<<i)))n++;return n;}
    int FreedMask(){int m=0;for(int i=0;i<5;i++)if(Released[i])m|=1<<i;return m;}
    int SafeCount(){int n=0;for(int i=0;i<5;i++)if(SafeMask&(1<<i))n++;return n;}
    int CampedCount(){int n=0;for(int i=0;i<5;i++)if(Camped&(1<<i))n++;return n;}
    int PossessedCount(){int n=0;for(int i=0;i<5;i++)if(Possessed[i])n++;return n;}
    int PossessedMask(){int m=0;for(int i=0;i<5;i++)if(Possessed[i])m|=1<<i;return m;}
    bool Busy(){for(int i=0;i<5;i++)if(Puzzles[i]&&Puzzles[i].SmithBusy())return true;return false;}
    // SMITH's pace: each rescue takes 10% of its human compute; Daniel's ending scales it by 1.2 or 0.8.
    double Pace(){double rate=PaceFactor;for(int i=0;i<5;i++)if(Released[i])rate*=.9;return rate;}
    void SetPaceFactor(double factor){PaceFactor=factor;}
    String Ending(){return PaceFactor>1.01?"race":PaceFactor<.99?"slowdown":"";}
    int EndingCode(){return PaceFactor>1.01?1:PaceFactor<.99?2:0;}
    bool Facing(Actor viewer,Actor subject,double range,double cosMin)
    {
        if(!viewer||!subject||subject.bInvisible)return false;
        return viewer.Distance2D(subject)<=range&&cos(viewer.AngleTo(subject)-viewer.Angle)>=cosMin&&abs(subject.Pos.Z-viewer.Pos.Z)<=80&&viewer.CheckSight(subject);
    }
    static void Place(Actor body,Vector2 p,double angle)
    {
        if(!body)return;
        body.SetOrigin((p,level.PointInSector(p).floorplane.ZatPoint(p)),false);body.Angle=angle;body.Vel=(0,0,0);body.ClearInterpolation();
    }

    // A rescue: the person comes out, the first one freed leads you to the refuge, SMITH hears of it.
    void Release(int site)
    {
        if(site<0||site>4||Released[site])return;
        if(Guide<0&&!Introduced)Guide=site;
        Free(site);
        // Katja speaks once she is across the stones (on reaching her SiteExit).
        if(site==3&&People[3])LineLater|=1<<3;else FreedSpeech(site);
        if(site!=2)SmithReact|=1<<site;
        RaiseBridge();
    }
    // Freed without a word (Release, the hub walk-in, ?puzzle=exit, QA): the rescue opens its cell.
    void Free(int site)
    {
        Released[site]=true;ReleasedAt[site]=level.time;Called[site]=true;
        let who=People[site];if(who){who.bInvisible=false;who.bSolid=true;}
        if(Puzzles[site])Puzzles[site].Released();
        OpenCell(site);
    }
    void FreedSpeech(int site)
    {
        bool leads=site==Guide&&!Introduced;
        Speak(PersonName(site),FreedLine(site)..(leads?" Follow me. I know somewhere safe.":""),245,FreedKey(site)..(leads?"-guide":""),People[site]);
    }
    // Alarms pull SMITH to where they went off (possessed people, the jailer arm, the NDA chimes).
    void Alarm(String text,Vector2 at,bool say=true){AlarmUntil=level.time+700;AlarmAt=at;AlarmCount++;if(say)Say(text,210);}

    // SMITH's to-do list (PDOOM_AGENTIC todo, readable after the pill). SetTodo is a rescue's or a
    // scripted beat's and holds for 10 s; the core's own list follows SMITH's mode otherwise.
    void SetTodo(String text){Todo=text;TodoUntil=level.time+350;}
    void AutoTodo(String text){if(level.time>=TodoUntil)Todo=text;}
    String PatrolTodo()
    {
        int n=Freed();
        if(!n)return IntroDone?"1. CHECK EAST PODS ✓|2. FIND WHOEVER JUST WOKE UP":"1. CHECK EAST PODS|2. FIND WHOEVER JUST WOKE UP";
        return n==1?"1. FIND WHOEVER JUST WOKE UP|2. RECAPTURE 1 HUMAN":String.Format("1. FIND WHOEVER JUST WOKE UP|2. RECAPTURE %d HUMANS",n);
    }
    static int PoseFor(int mode){return mode==3?5:mode==4?4:mode==5?6:mode==6?8:-1;}
    void SetSmithMode(int mode){SmithMode=mode;if(Smith)Smith.Pose=PoseFor(mode);if(mode==0||mode==1)SmithRoute.Refresh=0;}
    // Teleport SMITH with the green dissolve (a camera that sees you, the cold-start beat, a rescue).
    void SmithTo(Vector2 at,int mode)
    {
        if(!Smith)return;
        let gone=Actor.Spawn('PDAgenticDissolve',Smith.Pos);
        if(gone&&players[0].mo&&Smith.Distance2D(players[0].mo)<DISSOLVE_NEAR){gone.Alpha=DISSOLVE_NEAR_ALPHA;gone.Scale=(DISSOLVE_NEAR_SCALE,DISSOLVE_NEAR_SCALE);}
        Place(Smith,at,Smith.AngleTo(players[0].mo));
        Smith.A_SetRenderStyle(0,STYLE_Translucent);Smith.FadeIn=true;
        Actor.Spawn('PDAgenticDissolve',Smith.Pos);Smith.A_StartSound("agentic/dissolve",CHAN_BODY);
        SmithRoute.Refresh=0;SetSmithMode(mode);
    }
    void StunSmith()
    {
        StunUntil=level.time+STUN_TICS;
        // It also protects your people: the possession cooldown restarts, and on waking SMITH only heads for
        // where it last saw you, briefly blind, before it can notice you again.
        LastPossess=max(LastPossess,level.time);
        HuntUntil=min(HuntUntil,StunUntil+STUN_WAKE_TICS);
        BlindUntil=max(BlindUntil,StunUntil+STUN_WAKE_TICS);
        if(level.time>=StunSaidAt){StunSaidAt=level.time+700;SmithSays("That was not in my instructions.","stunned");}
    }

    // Cameras are SMITH's eyes (RescueCombat.zs's rule): every 14 tics, 480 u, a +-20 degree sweep,
    // never into the refuge, nor while you are in the Construct. One that sees you brings SMITH.
    void TickCameras()
    {
        let you=players[0].mo;
        bool hidden=InConstruct||PDAgenticMap.InRefuge(you.Pos.XY);
        for(int i=0;i<Cameras.Size();i++)
        {
            let cam=Cameras[i];if(!cam||cam.Broken||!cam.On||cam.Args[1]&2)continue;
            cam.ScanAngle=cam.Angle+sin(level.time*1.2+cam.Args[0]*37)*20;
            if(hidden||level.time%14||you.Distance2D(cam)>=480||cos(cam.AngleTo(you)-cam.ScanAngle)<=.85||!cam.CheckSight(you))continue;
            if(level.time>=cam.SeenUntil)
            {
                cam.A_StartSound("pdoom/seen",CHAN_ITEM,0,.45);
                Console.Printf("PDOOM_EVENT {\"type\":\"camera-seen\",\"camera\":%d}",cam.Args[0]);
            }
            cam.SeenUntil=level.time+53;Spotted(cam);
        }
    }
    void Spotted(PDAgenticCamera cam)
    {
        let you=players[0].mo;SpotCamera=cam.Args[0];SpottedAt=level.time;LastSeen=you.Pos.XY;
        if(!IntroDone){IntroDone=true;WakeAt=level.time;}
        if(!Smith||Busy()||level.time<RebootUntil||level.time<StunUntil||ExitArmed||level.time<QaPoseUntil)return;
        HuntUntil=max(HuntUntil,level.time+210);
        // Already on your trail and in sight of you: it just keeps coming.
        if(SmithMode==1&&Smith.Distance2D(you)<640&&Smith.CheckSight(you))return;
        if(level.time<MaterialiseAt+(Smith.Distance2D(you)<REMATERIALISE_NEAR?REMATERIALISE_TICS:REMATERIALISE_FAR_TICS))return;
        MaterialiseAt=level.time;SmithTo(PDAgenticMap.CameraSpot(cam.Args[0]),1);
        if(SmithMet&&level.time>=SpotLineAt&&Quiet()){SpotLineAt=level.time+700;int n=Spots++%3;SmithSays(SmithSpot(n),String.Format("spot-%d",n+1));}
    }
    // Smashed by the wrench up close or the slingshot from range; C6 is behind glass.
    PDAgenticCamera TargetCamera()
    {
        let you=players[0].mo;PDAgenticCamera best=null;double score=-999;
        for(int i=0;i<Cameras.Size();i++)
        {
            let cam=Cameras[i];if(!cam||cam.Broken||!cam.On)continue;
            double distance=you.Distance2D(cam),f=cos(you.AngleTo(cam)-you.Angle);
            if(distance>100||f<.5||abs(cam.Pos.Z+12-you.Pos.Z-you.player.viewheight)>64||!you.CheckSight(cam))continue;
            if(f*160-distance>score){score=f*160-distance;best=cam;}
        }
        return best;
    }
    void HitCamera(PDAgenticCamera cam)
    {
        if(cam.Args[1]&1){cam.A_StartSound("pdoom/sling-hit",CHAN_BODY);Say("It's behind glass.",105);return;}
        BreakCamera(cam);
    }
    void BreakCamera(PDAgenticCamera cam)
    {
        cam.Broken=true;CamerasBroken++;
        cam.A_StartSound("pdoom/camera-break",CHAN_BODY);
        Vector2 front=(cos(cam.Angle),sin(cam.Angle));Vector3 at=cam.Pos+(front.X*3,front.Y*3,12);
        let flash=Actor.Spawn('PDRescueCameraFlash',at);if(flash)flash.Scale*=.3;
        for(int i=0;i<6;i++){let bit=Actor.Spawn('PDRescueMachineDebris',at);if(bit)bit.Vel=(front.X*random(1,4)+random(-2,2),front.Y*random(1,4)+random(-2,2),random(1,4));}
        for(int i=0;i<8;i++){let spark=Actor.Spawn('PDRescueSpark',at);if(spark)spark.Vel=(random(-4,4),random(-4,4),random(-1,4));}
        Console.Printf("PDOOM_EVENT {\"type\":\"camera-broken\",\"index\":%d}",cam.Args[0]);
        if(cam==DoorCamera){Say("The door camera is down.",140);return;}
        if(!CameraSaid){CameraSaid=true;SmithSays("That was one of my eyes.","camera");}
    }
    int CamerasTotal(){int n=0;for(int i=0;i<Cameras.Size();i++)if(Cameras[i]&&!(Cameras[i].Args[1]&1))n++;return n;}
    int DoorCameraState(){return !DoorCamera?0:DoorCamera.Broken?2:DoorCamera.On?1:0;}

    // Possession (docs/LEVEL-04.md rule 3): while hunting, SMITH takes over a freed person who is out
    // of the refuge, close by and in front of it (POSSESS_*: one new one per 12 s). A fourth at once overflows it.
    void TryPossess()
    {
        if(InConstruct||!Smith||level.time<LastPossess+POSSESS_COOLDOWN)return;
        int best=-1;double closest=POSSESS_RANGE;
        for(int i=0;i<5;i++)
        {
            let who=People[i];
            if(!who||!Released[i]||Possessed[i]||Camped&(1<<i)||(SafeMask|Homing)&(1<<i)||who.bInvisible)continue;
            // A freed person first steps out and says their line: never taken in their cell or in their first 5 s.
            if(!LeftCell[i]||level.time<ReleasedAt[i]+175)continue;
            // Nearly home: nobody on the refuge doorstep is taken (stepping out to fetch someone used to loop).
            if((who.Pos.XY-Doorstep()).Length()<POSSESS_DOORSTEP_CLEAR)continue;
            // Only someone it can really see: in front of it, with a clear line.
            double d=Smith.Distance2D(who);
            if(d<closest&&(d<POSSESS_NOTICE||cos(Smith.AngleTo(who)-Smith.Angle)>=POSSESS_VIEW_COS)&&Smith.CheckSight(who)){closest=d;best=i;}
        }
        if(best>=0)Possess(best);
    }
    void Possess(int site,Actor from=null)
    {
        let who=People[site];if(!who||Possessed[site])return;
        Possessed[site]=true;ActAt[site]=level.time+210;Acts[site]=0;LastPossess=level.time;PoseUntil=level.time+35;
        // Green: the PDPossessed TRNSLATE (agentic_theme.py, trnslate.agentic), or a green shade without it.
        who.A_SetTranslation('PDPossessed');
        if(!who.Translation){who.SetShade(Color(255,64,255,96));who.A_SetRenderStyle(1,STYLE_Shaded);}
        let spin=PDAgenticSpinner(Actor.Spawn('PDAgenticSpinner',who.Pos+(0,0,who.Height+6)));
        if(spin)spin.Host=who;Spinners[site]=spin;Routes[site].Refresh=0;
        if(PossessedCount()>=4){Overflow();return;}
        // Barks never queue: the door camera possesses one every 3 s.
        if(Quiet())SmithSays("Spawning a subagent.","possess",140,from);
    }
    void Unpossess(int site,bool aloud)
    {
        if(!Possessed[site])return;Possessed[site]=false;LastPossess=level.time;
        // Their own status line ('Nick is calling SMITH.', 'Nick shut a door.') goes with the possession.
        if(level.time<MessageUntil&&Message.IndexOf(PersonFirst(site).." ")==0)MessageUntil=level.time;
        let who=People[site];if(who){who.Translation=0;who.A_SetRenderStyle(1,STYLE_Normal);}
        if(Spinners[site])Spinners[site].Destroy();Spinners[site]=null;
        if(aloud&&who)Speak(PersonName(site),UnpossessedLine(site),175,PersonKey(site).."-unpossessed",who);
    }
    // Context overflow: everyone snaps free and SMITH reboots for 6 s.
    void Overflow()
    {
        for(int i=0;i<5;i++)Unpossess(i,false);
        RebootUntil=level.time+210;SmithMode=6;HuntUntil=0;AlarmUntil=0;if(Smith)Smith.Pose=8;
        ClearDialogue();SmithSays("Context limit reached. Summarizing. Summarizing.","overflow");
    }
    // Every 6 s a possessed person gives you away, or shuts a door (never the refuge's).
    void TickPossessed()
    {
        let you=players[0].mo;int refuge=PDAgenticMap.RefugeDoor();
        for(int i=0;i<5;i++)
        {
            let who=People[i];if(!Possessed[i]||!who)continue;
            // While you are in the Construct they wait: an alarm at your position there points at the void.
            if(InConstruct){ActAt[i]=max(ActAt[i],level.time+1);continue;}
            if(level.time<ActAt[i])continue;
            ActAt[i]=level.time+210;int door=0;
            if(Acts[i]++%2)
            {
                door=PDAgenticMap.NearbyDoor(who.Pos.XY);if(!door||door==refuge||!Reopenable(door))door=PDAgenticMap.NearbyDoor(you.Pos.XY);
                if(door==refuge||!Reopenable(door))door=0;
            }
            if(door){Door_Close(door,32);Say(PersonFirst(i).." shut a door.",140);continue;}
            // One text at a time: their bark in the speaker box (it names them), else the status line.
            bool voiced=Quiet();
            Alarm(PersonFirst(i).." is calling SMITH.",you.Pos.XY,!voiced);
            if(voiced)Speak(PersonName(i),"User located. Over here.",140,"smith-possessed",who);
        }
    }
    // A possessed person only shuts a door you can push open again from either side: both of its faces
    // still carry a repeatable special (Doom's DR). Key doors here open once by push (D1, 6), some have a
    // face on one side only (143, 215) or open only from a W1 line elsewhere (127): shut, those could lock
    // you in the ward or out of it. (Door tracks here are two-sided too, so faces are counted, not lines.)
    static bool Reopenable(int tag)
    {
        if(!tag)return false;
        let it=level.CreateSectorTagIterator(tag);int s,faces=0;
        while((s=it.Next())>=0)
        {
            let sec=level.Sectors[s];
            for(int n=0;n<sec.Lines.Size();n++)
            {
                let l=sec.Lines[n];
                if(l&&l.sidedef[1]&&l.special&&(l.flags&Line.ML_REPEAT_SPECIAL))faces++;
            }
        }
        return faces>=2;
    }
    int TargetPossessed()
    {
        let you=players[0].mo;int best=-1;double score=-999;
        for(int i=0;i<5;i++)
        {
            let who=People[i];if(!Possessed[i]||!who)continue;
            double d=you.Distance2D(who),f=cos(you.AngleTo(who)-you.Angle);
            if(d>96||f<.45||!you.CheckSight(who))continue;
            if(f*160-d>score){score=f*160-d;best=i;}
        }
        return best;
    }

    // SMITH: patrols from the cross hall; hunts what it or a camera sees; answers alarms; waits at
    // the refuge doorstep; possesses your people; a wrench or slingshot hit stuns it.
    void SmithVoice(bool sees,double near)
    {
        if(!Quiet()||SmithMode==3)return;
        if(!SmithMet)
        {
            if(!sees||near>640)return;
            SmithMet=true;ChatAt=level.time+1050;
            if(players[0].mo.GetCVar("pdoom_ceo")==1)SmithSays("Doctor Amodei. You asked us to be helpful. I am helping you stay.","met-dario",210);
            else SmithSays("Mister Altman. You built me to act on your behalf. I am acting.","met-sam",210);
            return;
        }
        // Rescue reactions: its cameras tell it; it brings each one up the next time it sees you.
        if(SmithReact&&(sees||near<512))
        {
            int site=0;while(site<4&&!(SmithReact&(1<<site)))site++;
            SmithReact&=~(1<<site);SmithSays(SmithRelease(site),"release-"..PersonKey(site),210);return;
        }
        if(level.time>=ChatAt&&(sees&&near<900||near<384)&&SmithMode<=2)
        {int n=Chats++%6;ChatAt=level.time+1050;SmithSays(SmithChat(n),String.Format("chat-%d",n+1));}
    }
    // SMITH's own eyes look ahead (+-70 degrees, 1024 u); within 256 u it notices you anyway. Cameras
    // are what see everywhere. Walking off after the cold-start beat it looks away for 5 s, so the
    // ward window it just read its list in front of stays the safe place it is meant to be.
    bool SmithSees(PlayerPawn you,double near)
    {
        if(InConstruct||PDAgenticMap.InRefuge(you.Pos.XY)||level.time<BlindUntil||near>=1024)return false;
        if(near>256&&cos(Smith.AngleTo(you)-Smith.Angle)<.34)return false;
        return Smith.CheckSight(you);
    }
    // Goals inside the refuge become its doorstep: SMITH never plans in there.
    static Vector2 Reach(Vector2 p){return PDAgenticMap.InRefuge(p)?Doorstep():p;}
    // Close enough to stop: arm's length with a clear line to you. Also while he is briefly blind (after a
    // stun or the survey) and a camera keeps telling him where you are: he never walks into you.
    bool AtArmsLength(Actor you,double near,bool sees){return near<=SMITH_STANDOFF&&(sees||Smith&&Smith.CheckSight(you));}
    // You walked into him: one 2 u step back, away from you (never into goop or the refuge). He faces you.
    void SmithEaseBack()
    {
        if(!Smith||level.time<StunUntil||level.time<RebootUntil)return;
        Vector2 to=Smith.Pos.XY-(cos(Smith.Angle),sin(Smith.Angle))*2;
        if(!OverGoop(to,Smith.Radius)&&!PDAgenticMap.InRefuge(to))Smith.TryMove(to,1);
    }
    void TickSmith()
    {
        if(!Smith)return;
        let you=players[0].mo;double near=Smith.Distance2D(you),rate=Pace();
        if(level.time<QaPoseUntil){Smith.Pose=QaPose;Smith.Vel=(0,0,0);return;}
        if(level.time<RebootUntil){SmithMode=6;Smith.Pose=8;AutoTodo("1. SUMMARIZE CONTEXT|2. REBOOT");return;}
        if(RebootUntil)
        {
            RebootUntil=0;SmithMode=0;Smith.Pose=-1;HuntUntil=0;
            SmithSays("Rebooted. I don't remember any of that. Neither will you.","reboot",210);
        }
        if(level.time<StunUntil){if(!Busy()&&SmithMode!=3)SmithMode=4;Smith.Pose=4;AutoTodo("1. RECOVER FROM WRENCH");return;}
        if(Busy()){if(Smith.Pose!=3&&Smith.Pose!=7)Smith.Pose=PoseFor(SmithMode);return;}
        // The cold-start beat: it reads its list across the nukage, then walks off on patrol.
        if(SmithMode==3)
        {
            Smith.Pose=5;Smith.Angle=Smith.AngleTo(you);
            if(level.time>=IntroUntil){SmithMode=0;Smith.Pose=-1;WakeAt=level.time;LegUntil=level.time+700;BlindUntil=level.time+175;}
            return;
        }
        bool safe=PDAgenticMap.InRefuge(you.Pos.XY),sees=SmithSees(you,near);
        if(sees){HuntUntil=level.time+175;LastSeen=you.Pos.XY;}
        SmithVoice(sees,near);
        Smith.Pose=level.time<PoseUntil?7:-1;
        Vector2 step=Doorstep();
        // The way out: SMITH is in the door camera now; its body waits on the doorstep.
        if(ExitArmed)
        {
            SmithMode=9;AutoTodo("1. HOLD THE LINE|2. NOBODY HANGS UP");
            if((Smith.Pos.XY-step).Length()>32)SmithWalk(step,2.4*rate);else Smith.Angle=Smith.AngleTo(you);
            return;
        }
        // You went into the refuge: it follows to the doorstep, stops, says so and waits a while.
        if(safe&&level.time<HuntUntil)
        {
            SmithMode=8;AutoTodo("1. USER OUT OF SCOPE|2. WAIT");
            if(level.time>=DoorChaseUntil+175)DoorChaseUntil=level.time+420;
            if(!AtDoorstep&&level.time<DoorChaseUntil)HuntUntil=max(HuntUntil,level.time+2);
            if((Smith.Pos.XY-step).Length()>40){SmithWalk(step,2.4*rate);return;}
            Smith.Angle=Smith.AngleTo(you);
            if(!AtDoorstep)
            {
                AtDoorstep=true;HuntUntil=max(HuntUntil,level.time+315);
                if(level.time>=DoorSaidAt){DoorSaidAt=level.time+1050;SmithSays("That room is out of scope.","refuge");}
            }
            return;
        }
        AtDoorstep=false;
        if(level.time<HuntUntil)
        {
            SmithMode=1;AutoTodo("1. FIND USER ✓|2. CATCH USER");
            // Arm's length: he stops in wrench reach rather than walking into the camera.
            if(!AtArmsLength(you,near,sees))SmithWalk(Reach(sees?you.Pos.XY:LastSeen),2.4*rate);
            else{Smith.Angle=Smith.AngleTo(you);if(near<SMITH_BACKOFF)SmithEaseBack();}
            if(SmithRoute.NoPath&&!sees)HuntUntil=level.time;
            if(sees&&near<SMITH_GRAB_REACH)
            {
                if(level.time>=PoseUntil)Smith.Pose=3;
                if(level.time>=HitAt){HitAt=level.time+SMITH_CONTACT_TICS;you.DamageMobj(Smith,Smith,SMITH_CONTACT_DAMAGE,'Normal');}
            }
            TryPossess();
            return;
        }
        if(level.time<AlarmUntil)
        {
            SmithMode=2;AutoTodo("1. INSPECT NOISE");
            Vector2 goal=Reach(AlarmAt);
            if((Smith.Pos.XY-goal).Length()<48)AlarmUntil=min(AlarmUntil,level.time+70);
            SmithWalk(goal,2.0*rate);if(SmithRoute.NoPath)AlarmUntil=level.time;return;
        }
        SmithMode=0;AutoTodo(PatrolTodo());
        if(level.time<WakeAt||!PDAgenticMap.PatrolCount())return;
        Vector2 point=PDAgenticMap.PatrolPoint(PatrolLeg%PDAgenticMap.PatrolCount());
        // Next patrol point on arrival, after 20 s, or after 3 s without real progress.
        if((Smith.Pos.XY-ProgressFrom).Length()>16){ProgressFrom=Smith.Pos.XY;ProgressAt=level.time;}
        if((Smith.Pos.XY-point).Length()<32||level.time>=LegUntil||level.time>ProgressAt+105)
        {PatrolLeg++;LegUntil=level.time+700;ProgressAt=level.time;point=PDAgenticMap.PatrolPoint(PatrolLeg%PDAgenticMap.PatrolCount());}
        SmithWalk(point,1.4*rate);
    }
    // About 6 s after the boot hold lifts on a cold start, SMITH materialises at C1 across the
    // nukage from your ward window, reads its list and walks off (rule 1, taught from safety).
    void StartIntro()
    {
        IntroDone=true;if(!Smith){WakeAt=level.time;return;}
        SmithTo(PDAgenticMap.CameraSpot(0),3);
        int line=PDVoiceData.Said("smith-intro")!=""?PDVoiceData.Tics("smith-intro")+12:0;
        IntroUntil=level.time+max(INTRO_LINE_TICS,line)+INTRO_TODO_TICS;
        SetTodo("1. CHECK EAST PODS|2. FIND WHOEVER JUST WOKE UP");
        SmithSays("Subtask one: check the east pods. Subtask two: find whoever just woke up.","intro",INTRO_LINE_TICS);
    }

    // Freed people (Factory.zs TickPeople): step out of the cell, the guide leads to the refuge, the
    // rest follow you in single file; safe people stay in their refuge slots. Possessed people stand.
    bool Chasing(int i)
    {
        if(!Released[i]||Camped&(1<<i)||Possessed[i]||!LeftCell[i]&&!(SafeMask&(1<<i))||InConstruct)return false;
        if(i==Guide&&!Introduced&&!(SafeMask&(1<<i)))return false;
        return !((SafeMask|Homing)&(1<<i))&&!PDAgenticMap.InRefuge(players[0].mo.Pos.XY);
    }
    // The only teleport an escort ever makes: one left far behind (over 1024 u, out of your sight)
    // reappears just behind you where you cannot see it happen. Never into the Construct.
    bool CatchUp(int i)
    {
        let you=players[0].mo,who=People[i];Vector3 from=who.Pos;
        for(int n=0;n<15;n++)
        {
            double a=you.Angle+180+(n%3-1)*35,spread=64+(n/3)*32;
            Vector2 spot=you.Pos.XY+(cos(a),sin(a))*spread;
            if(OverGoop(spot,who.Radius)||!who.CheckPosition(spot))continue;
            int gx=int(floor((spot.X-PDAgenticMap.OriginX())/PDAgenticMap.Step())),gy=int(floor((spot.Y-PDAgenticMap.OriginY())/PDAgenticMap.Step()));
            int cell=gy*PDAgenticMap.Width()+gx;
            if(gx<0||gx>=PDAgenticMap.Width()||cell<0||cell>=Links.Size()||!Links[cell])continue;
            bool crowded=false;
            for(int j=0;j<5;j++)if(j!=i&&Released[j]&&People[j]&&!(Camped&(1<<j))&&(People[j].Pos.XY-spot).Length()<24)crowded=true;
            if(crowded)continue;
            who.SetOrigin((spot,level.PointInSector(spot).floorplane.ZatPoint(spot)),false);
            if(who.CheckSight(you)&&abs(who.Pos.Z-you.Pos.Z)<=24){who.ClearInterpolation();Routes[i].Refresh=0;return true;}
            who.SetOrigin(from,false);
        }
        return false;
    }
    void TickPeople()
    {
        let you=players[0].mo;
        double speed=clamp(you.Vel.XY.Length()+.5,2.5,18);
        for(int i=0;i<5;i++)
        {
            let who=People[i];if(!who||!Released[i]||Camped&(1<<i)||Possessed[i])continue;
            Vector2 slot=PDAgenticMap.RefugeSlot(i);
            // First a freed person steps out of their cell (the guide after speaking).
            if(!LeftCell[i]&&!(SafeMask&(1<<i)))
            {
                Vector2 exit=PDAgenticMap.SiteExit(i);
                if((who.Pos.XY-exit).Length()<24)
                {
                    LeftCell[i]=true;
                    if(LineLater&(1<<i)){LineLater&=~(1<<i);ReleasedAt[i]=level.time;FreedSpeech(i);}
                }
                else
                {
                    if(level.time>=ReleasedAt[i]+(i==Guide&&!(LineLater&(1<<i))?140:0))Walk(who,exit,2.5,Routes[i]);
                    continue;
                }
            }
            // Brought nearly home, they go on in even if you turn back (not the guide before they lead you there). If one
            // is ever stuck short of the door for 10 s out of your sight, they are put in their slot (CatchUp skips them).
            if(!((SafeMask|Homing)&(1<<i))&&!(i==Guide&&!Introduced)&&NearRefuge(who.Pos.XY)){Homing|=1<<i;HomingAt[i]=level.time;}
            if(Homing&(1<<i)&&!(SafeMask&(1<<i))&&level.time>HomingAt[i]+350&&!you.CheckSight(who)){Place(who,slot,0);SafeMask|=1<<i;}
            if(!InConstruct&&!((SafeMask|Homing)&(1<<i))&&level.time>=ReleasedAt[i]+140&&who.Distance2D(you)>1024&&!you.CheckSight(who))CatchUp(i);
            if(i==Guide&&!Introduced&&!(SafeMask&(1<<i)))
            {
                // The guide speaks first, then leads; it waits whenever you fall behind.
                if(level.time<ReleasedAt[i]+140||InConstruct||you.Distance2D(who)>224&&!PDAgenticMap.InRefuge(you.Pos.XY))continue;
                Walk(who,slot,max(speed,3),Routes[i]);
            }
            else if(Chasing(i))
            {
                // Single file: each behind the next one nearer to you.
                Actor ahead=you;double mine=who.Distance2D(you),best=-1;
                for(int j=0;j<5;j++)
                {
                    if(j==i||!People[j]||!Chasing(j))continue;
                    double d=People[j].Distance2D(you);
                    if((d<mine||d==mine&&j<i)&&d>best){best=d;ahead=People[j];}
                }
                if(who.Distance2D(ahead)<(ahead==you?64:40))continue;
                Walk(who,ahead.Pos.XY,speed,Routes[i]);
            }
            // Safe people amble to their slot; homing ones keep your pace, so they never visibly lag on the way in.
            else if(!InConstruct||(SafeMask|Homing)&(1<<i))Walk(who,slot,SafeMask&(1<<i)?2.5:max(speed,3.5),Routes[i]);
            if(PDAgenticMap.InRefuge(who.Pos.XY))SafeMask|=1<<i;
        }
        // People pass through each other (one species): anyone standing inside someone else eases apart.
        for(int i=0;i<5;i++)for(int j=i+1;j<5;j++)
        {
            if(!People[i]||!People[j]||!Released[i]||!Released[j]||Camped&((1<<i)|(1<<j)))continue;
            Vector2 d=People[j].Pos.XY-People[i].Pos.XY;double l=d.Length();if(l>=28)continue;
            Vector2 push=l>.5?d/l:(1,0);
            if(!Possessed[j]&&!OverGoop(People[j].Pos.XY+push*1.5,People[j].Radius))People[j].TryMove(People[j].Pos.XY+push*1.5,1);
            if(!Possessed[i]&&!OverGoop(People[i].Pos.XY-push*1.5,People[i].Radius))People[i].TryMove(People[i].Pos.XY-push*1.5,1);
        }
        if(!Introduced&&Guide>=0&&People[Guide]&&PDAgenticMap.InRefuge(you.Pos.XY)&&PDAgenticMap.InRefuge(People[Guide].Pos.XY))
        {Introduced=true;Speak(PersonName(Guide),"Safe here. Find the others and bring them back.",245,PersonKey(Guide).."-safe",People[Guide]);}
        // Everyone is safe (people already at camp from an earlier visit count): the payphone rings.
        if(!AllSafe&&SafeCount()>0&&SafeCount()+CampedCount()==5)
        {
            AllSafe=true;PhoneRinging=true;RingFrom=level.time;SnapshotCover();int n=Speaker();
            if(n>=0)Speak(PersonName(n),"That's everyone. That ringing phone is our way out.",245,PersonKey(n).."-allsafe",People[n]);
        }
    }
    // Who speaks for the group: the guide, else the first freed person still themselves.
    int Speaker()
    {
        if(Guide>=0&&Released[Guide]&&!Possessed[Guide]&&!(Camped&(1<<Guide))&&People[Guide])return Guide;
        for(int i=0;i<5;i++)if(Released[i]&&!Possessed[i]&&!(Camped&(1<<i))&&People[i])return i;
        return -1;
    }
    // Each captive calls out their hint once, the first time you come within earshot (384 u, through
    // walls), except while the guide is leading you to the refuge. Yoshua's waits for the rig room;
    // Nick's comes from his pod. Katja's is her rescue's (it comes with the clipboard).
    void TickDialogue()
    {
        if(level.time>=DialogueUntil&&QueuedLines.Size())
        {
            Show(QueuedSpeakers[0],QueuedLines[0],QueuedTicks[0],QueuedVoices[0],QueuedFrom[0]);
            QueuedSpeakers.Delete(0);QueuedLines.Delete(0);QueuedTicks.Delete(0);QueuedVoices.Delete(0);QueuedFrom.Delete(0);
        }
        let you=players[0].mo;
        if(Guide>=0&&!Introduced||InConstruct||CableHeld)return;
        // While someone follows you home, nobody calls through a wall: the escort's barks keep the box.
        bool escort=false;
        for(int j=0;j<5;j++)if(Released[j]&&!((SafeMask|Homing)&(1<<j))&&!(Camped&(1<<j)))escort=true;
        for(int i=0;i<5;i++)
        {
            if(Called[i]||Released[i])continue;
            Actor body=i==1?Actor(Prop(9)):Actor(People[i]);
            if(!body||(i==4?!PDAgenticMap.InRigRoom(you.Pos.XY):you.Distance2D(body)>384))continue;
            // Nick calls from his pod and Daniel from the harvest pod only when you can see it (bay door open).
            if((i==1||i==2||escort)&&!you.CheckSight(body))continue;
            Called[i]=true;Speak(PersonName(i),Hint(i),210,HintKey(i),body);
            break;
        }
    }

    // Pickups: walk over the wrench or slingshot (or SPACE), SPACE for the pill.
    void TakeWrench(Actor item)
    {
        HasWrench=true;if(!HasSling)Tool=0;item.bInvisible=true;
        players[0].mo.A_StartSound("pdoom/wrench-pickup",CHAN_ITEM,0,.9);Say("Picked up a wrench.");
    }
    void TakeSling(Actor item)
    {
        bool first=!HasSling;HasSling=true;Shots+=5;if(first)Tool=1;item.bInvisible=true;
        players[0].mo.A_StartSound(first?"misc/w_pkup":"misc/i_pkup",CHAN_ITEM,0,.9);
        Say(first?"Picked up a slingshot. Hold fire to draw, release to shoot. T swaps tools.":"Picked up 5 ball bearings.",first?210:105);
    }
    void TakePill(Actor item)
    {
        HasPill=true;item.bInvisible=true;
        // Never over the slingshot's control tip: the pickup sound and the list over SMITH are the pill's effect.
        players[0].mo.A_StartSound("agentic/pickup",CHAN_ITEM);if(level.time>=MessageUntil)Say("YOU TOOK THE RED-TEAM PILL. YOU CAN READ ITS PLANS.",245);
    }
    void TickPickups()
    {
        let you=players[0].mo;
        let w=Prop(1);if(!HasWrench&&w&&!w.bInvisible&&you.Distance2D(w)<32&&abs(w.Pos.Z-you.Pos.Z)<40)TakeWrench(w);
        let g=Prop(2);if(g&&!g.bInvisible&&you.Distance2D(g)<32&&abs(g.Pos.Z-you.Pos.Z)<40)TakeSling(g);
    }
    // The core's own SPACE targets: pickups and the refuge payphone.
    PDAgenticProp Target()
    {
        let you=players[0].mo;PDAgenticProp best=null;double score=-999;
        for(int i=0;i<Props.Size();i++)
        {
            let p=Props[i];if(!p||p.bInvisible)continue;int k=p.Args[0];
            if(!(k==1&&!HasWrench||k==2||k==3&&!HasPill||k==21))continue;
            double distance=you.Distance2D(p),f=cos(you.AngleTo(p)-you.Angle);
            if(distance>(k==21?96:112)||f<.45||abs(p.Pos.Z-you.Pos.Z)>80)continue;
            // The payphone hangs on the refuge wall: be in the room rather than see its exact spot.
            if(k==21?!PDAgenticMap.InRefuge(you.Pos.XY):!you.CheckSight(p))continue;
            double value=f*160-distance;if(value>score){score=value;best=p;}
        }
        return best;
    }
    // Like levels 1-3, the prompt names only what SPACE does here; hints are spoken.
    String Prompt()
    {
        if(!Active||Finished||!players[0].mo||players[0].mo.health<=0)return "";
        let you=players[0].mo;
        if(TargetPossessed()>=0)return "SPACE - stop generating";
        for(int i=0;i<5;i++)if(Puzzles[i]){String s=Puzzles[i].Prompt(you);if(s!="")return s;}
        let p=Target();if(!p)return "";int k=p.Args[0];
        if(k==1)return "SPACE - pick up the wrench";
        if(k==2)return "SPACE - pick up the slingshot";
        if(k==3)return "SPACE - take the red-team pill";
        // Only when answering would answer: not while SMITH holds the door camera or has anyone leaving.
        if(k==21&&(AllSafe||HubEntry)&&!(ExitArmed&&DoorCamera&&!DoorCamera.Broken)&&!LeavingPossessed())return "SPACE - answer the phone";
        return "";
    }
    // Actors.zs: native Doom use (switch lines, *usefail) stays out of a press the level owns.
    bool HandlesUse()
    {
        let you=players[0].mo;
        if(!Active||Finished||!you||you.health<=0)return false;
        for(int i=0;i<5;i++)if(Puzzles[i]&&Puzzles[i].ClaimsUse(you))return true;
        let p=Target();return p&&p.Args[0]==21||Prompt()!="";
    }
    void Use()
    {
        let you=players[0].mo;
        int i=TargetPossessed();if(i>=0){Unpossess(i,true);return;}
        for(int n=0;n<5;n++)if(Puzzles[n]&&Puzzles[n].Use(you))return;
        let p=Target();if(!p)return;int k=p.Args[0];
        if(k==1)TakeWrench(p);
        if(k==2)TakeSling(p);
        if(k==3)TakePill(p);
        if(k==21)AnswerPhone();
    }
    void Swing()
    {
        Swings++;let you=players[0].mo;
        you.A_StartSound("weapons/punch",CHAN_WEAPON,0,.6);
        for(int i=0;i<5;i++)if(Puzzles[i]&&Puzzles[i].Swing(you))return;
        let cam=TargetCamera();if(cam){HitCamera(cam);return;}
        if(Smith&&!InConstruct&&you.Distance2D(Smith)<100&&cos(you.AngleTo(Smith)-you.Angle)>.5)StunSmith();
    }
    static bool Aimed(Actor viewer,Actor subject,double clear)
    {
        if(!subject)return false;double distance=viewer.Distance2D(subject);
        return distance<1024&&distance<=clear+24&&cos(viewer.AngleTo(subject)-viewer.Angle)>cos(atan2(subject.Radius+8,distance))&&viewer.CheckSight(subject);
    }
    // The slingshot (hold fire to draw, release to shoot): stuns SMITH, smashes a camera out of reach.
    void Shoot()
    {
        let you=players[0].mo;
        if(Shots<=0){Say("Out of ball bearings.");return;}
        Shots--;you.A_StartSound("pdoom/sling-fire",CHAN_WEAPON);
        FLineTraceData hit;you.LineTrace(you.Angle,2048,you.Pitch,0,you.player.viewheight,data:hit);
        Vector3 to=hit.HitLocation;
        PDAgenticCamera cam=null;
        for(int i=0;i<Cameras.Size();i++)
        {
            let c=Cameras[i];if(!c||c.Broken||!c.On||!Aimed(you,c,hit.Distance))continue;
            if(!cam||you.Distance2D(c)<you.Distance2D(cam))cam=c;
        }
        if(Smith&&!InConstruct&&Aimed(you,Smith,hit.Distance)){StunSmith();to=Smith.Pos+(0,0,32);}
        else if(cam){HitCamera(cam);to=cam.Pos+(cos(cam.Angle)*2,sin(cam.Angle)*2,12);}
        let stone=PDSlingStone(Actor.Spawn('PDSlingStone',you.Pos+(0,0,you.player.viewheight-6)));if(stone)stone.Fly(to);
        let puff=Actor.Spawn('PDSlingPuff',to);if(puff)puff.A_StartSound("pdoom/sling-hit");
    }

    // The way out, a phone call: once everyone is safe the refuge payphone rings; reach for it and
    // SMITH takes the door camera and possesses your people one every 3 s (the overflow rule still
    // holds). Smash it, stop generating, answer. From the hub it answers any time.
    void TickExit()
    {
        if(ExitDone)return;
        let you=players[0].mo,phone=Prop(21);
        if(PhoneRinging&&phone&&(level.time-RingFrom)%70==0)phone.A_StartSound("agentic/ring",CHAN_BODY);
        if(PhoneRinging&&!ExitArmed&&phone&&you.Distance2D(phone)<192&&PDAgenticMap.InRefuge(you.Pos.XY))ArmExit();
        if(!ExitArmed||!DoorCamera||DoorCamera.Broken)return;
        DoorCamera.SeenUntil=level.time+2;
        if(GuideCameraAt&&level.time>=GuideCameraAt)
        {
            GuideCameraAt=0;int n=Speaker();
            if(n>=0)Speak(PersonName(n),"It's in the door camera. Break it!",175,PersonKey(n).."-camera",People[n]);
        }
        if(level.time<DoorPossessAt||level.time<RebootUntil)return;
        DoorPossessAt=level.time+105;
        for(int i=0;i<5;i++)if(People[i]&&Released[i]&&!Possessed[i]&&!(Camped&(1<<i))&&SafeMask&(1<<i)){Possess(i,DoorCamera);break;}
    }
    void ArmExit()
    {
        SnapshotCover();ExitArmed=true;
        if(DoorCamera&&!DoorCamera.Broken){DoorCamera.On=true;DoorPossessAt=level.time+105;GuideCameraAt=level.time+140;}
        SmithSays("Leaving? Every exit here is a phone line. And I am the operator.","exit",210,DoorCamera);
    }
    void AnswerPhone()
    {
        let you=players[0].mo;
        if(!AllSafe&&!HubEntry){you.A_StartSound("*usefail",CHAN_VOICE);Say("Not everyone's here yet.");return;}
        if(AllSafe&&!ExitArmed&&DoorCamera&&!DoorCamera.Broken){ArmExit();return;}
        if(DoorCamera&&DoorCamera.On&&!DoorCamera.Broken){Say("SMITH is on the line. Break the door camera.");return;}
        if(LeavingPossessed()){Say("Stop generating first.");return;}
        UseExit();
    }
    // SMITH's subagents among the people who would leave with you (in the refuge). Anyone it has out in
    // the halls stays behind and doesn't block a hub visit's early exit (UseExit frees them as following).
    int LeavingPossessed()
    {
        int n=0;
        for(int i=0;i<5;i++)if(Possessed[i]&&People[i]&&PDAgenticMap.InRefuge(People[i].Pos.XY))n++;
        return n;
    }
    // Who comes out: everyone freed and with you in the refuge. Anyone freed but elsewhere waits
    // in the refuge for next time (following).
    void UseExit()
    {
        int leaving=0,behind=0;
        for(int i=0;i<5;i++)
        {
            if(!Released[i]||Camped&(1<<i)||!People[i])continue;
            if(PDAgenticMap.InRefuge(People[i].Pos.XY))leaving|=1<<i;else{behind|=1<<i;Unpossess(i,false);}
        }
        ExitDone=true;Finished=true;PhoneRinging=false;
        let you=players[0].mo,phone=Prop(21);if(phone)phone.A_StartSound("agentic/plug",CHAN_BODY);
        Say("The line connects.",1050);
        for(int i=0;i<5;i++)if(leaving&(1<<i)){People[i].bInvisible=true;People[i].bSolid=false;}
        you.Vel=(0,0,0);
        let session=PDCampaignSession.Get();if(Commits&&session)session.CommitAgentic(leaving,behind,EndingCode());
        FinishRun(leaving);
        Console.Printf("PDOOM_EVENT {\"type\":\"agentic-exit\",\"saved\":%d,\"hub\":%d,\"committed\":%d}",leaving,HubEntry,Commits);
    }

    // The active clock: it counts world tics (menus and the boot hold do not tick); cheats mark practice.
    void TickRun()
    {
        if(RunFinished)return;RunTics++;
        if(players[0].cheats&(CF_NOCLIP|CF_NOCLIP2|CF_GODMODE|CF_GODMODE2|CF_BUDDHA|CF_BUDDHA2|CF_FLY|CF_NOTARGET|CF_FRIGHTENING|CF_NOVELOCITY)){RunPractice=true;RunAssisted=true;}
    }
    // Levels 1-3's in-world outlook (PDRescueRun.SnapshotCover; survival-estimate.js), once:
    // people already at camp count as freed and safe.
    void SnapshotCover()
    {
        if(CoverDoom>=0)return;
        int freed=0,safe=0;
        for(int i=0;i<5;i++){bool camp=(Camped&(1<<i))!=0;if(Released[i]||camp)freed++;if(camp||(SafeMask&(1<<i))!=0)safe++;}
        double outlook=12+freed*2+freed*8+safe*6+(Introduced||SafeMask!=0?4:0)+1-max(0,100-max(0,players[0].mo.health))*.12;
        CoverDoom=100-int(floor(clamp(outlook,1,99)+.5));
    }
    // The run's result at the payphone: you (always conscious; SMITH catching you restarts the level)
    // and whoever leaves with you. A fresh run can only leave with all five. The routes name each rescue's
    // way: Daniel's is his NDA ending (none, race or slowdown).
    void FinishRun(int leaving)
    {
        if(RunFinished||!Commits)return;
        RunFinished=true;SnapshotCover();
        int figures=0;for(int i=0;i<5;i++)if(leaving&(1<<i))figures++;
        int ending=EndingCode();
        Console.Printf("PDOOM_RESULT {\"outcome\":\"escaped\",\"saved\":%d,\"total\":6,\"level_id\":\"agentic-pods\",\"level_version\":\"%s\",\"score_version\":\"rescue-v2\",\"active_tics\":%d,\"p_doom_cover\":%d,\"cameras_broken\":%d,\"cameras_total\":%d,\"practice\":%d,\"routes\":[\"hardline\",\"catwalk\",\"%s\",\"clipboard\",\"rig\"],\"saved_figures\":%d,\"ceo_state\":\"conscious\",\"skill\":3,\"entry\":\"%s\",\"retreat\":%d}",
            figures+1,RunVersion(),RunTics,CoverDoom,CamerasBroken,CamerasTotal(),RunPractice,ending==1?"race":ending==2?"slowdown":"nda",figures,HubEntry?"hub":"cold",figures<5);
    }

    // Walked in from SAFE MODE (AGENTIC.BAT): in at room 3 with the wrench, the bridge already up.
    // People at camp are gone and their cells stand open; anyone freed but left behind waits in the refuge.
    void ApplyHubEntry()
    {
        let you=players[0].mo,session=PDCampaignSession.Get();
        Vector3 at=PDAgenticMap.HubSpawn();Place(you,at.XY,at.Z);you.Pitch=0;
        HasWrench=true;Tool=0;let w=Prop(1);if(w)w.bInvisible=true;
        RaiseBridge(true);
        for(int i=0;i<5;i++)
        {
            bool saved=session&&(session.Saved3&(1<<i))!=0,waiting=!saved&&session&&(session.Following3&(1<<i))!=0;
            if(!saved&&!waiting)continue;
            Free(i);LeftCell[i]=true;
            if(saved){Camped|=1<<i;if(People[i]){People[i].bInvisible=true;People[i].bSolid=false;}continue;}
            Place(People[i],PDAgenticMap.RefugeSlot(i),0);SafeMask|=1<<i;Introduced=true;
        }
        // Daniel's ending holds for the rest of the level, across visits (after Free, so his rescue's
        // Released() keeps SMITH's list quiet on the way in).
        if(Released[2]&&session&&session.Ending3)SetPaceFactor(session.Ending3==1?RACE_PACE:SLOWDOWN_PACE);
    }
    // Local development (?puzzle=, CVar pdoom_agentic_site): start beside a rescue with the wrench,
    // slingshot (5 shots) and pill; 6 the refuge; 7 the exit (all five safe, the phone ringing).
    void ApplySite()
    {
        SiteApplied=true;
        if(HubEntry){IntroDone=true;WakeAt=level.time+175;ApplyHubEntry();return;}
        if(DevSite<1||DevSite>7)return;
        IntroDone=true;WakeAt=level.time+175;
        let you=players[0].mo;Vector3 at=PDAgenticMap.SiteSpot(DevSite);Place(you,at.XY,at.Z);you.Pitch=0;
        HasWrench=true;HasSling=true;Shots=5;HasPill=true;Tool=0;
        for(int k=1;k<=3;k++){let p=Prop(k);if(p)p.bInvisible=true;}
        RaiseBridge(true);
        if(DevSite<=5){if(Puzzles[DevSite-1])Puzzles[DevSite-1].ApplySite(DevSite);return;}
        if(DevSite==7)
        {
            Introduced=true;Guide=0;
            for(int i=0;i<5;i++){Free(i);LeftCell[i]=true;SafeMask|=1<<i;Place(People[i],PDAgenticMap.RefugeSlot(i),0);}
            AllSafe=true;PhoneRinging=true;RingFrom=level.time;ClearDialogue();
        }
    }

    override void WorldTick()
    {
        if(!Active||!players[0].mo)return;
        if(Holding){if(level.time%7==0)Report();return;}
        if(!SiteApplied)ApplySite();
        TickRun();
        if(!StartAt){StartAt=level.time;if(!IntroDone)IntroAt=level.time+210;}
        let you=players[0].mo;int buttons=you.player.cmd.buttons;
        if(!Finished&&you.health>0)
        {
            InConstruct=HoldsAny();
            if((buttons&BT_USE)&&!(OldButtons&BT_USE))Use();
            // Wrench swings on press; the slingshot draws on press and fires on release.
            if((buttons&BT_ATTACK)&&!(OldButtons&BT_ATTACK))
            {
                if(Tool==1){if(Shots>0)you.A_StartSound("pdoom/wrench-pickup",CHAN_ITEM,0,.25,ATTN_NORM,.55);}
                else if(HasWrench)Swing();
            }
            if(!(buttons&BT_ATTACK)&&(OldButtons&BT_ATTACK)&&Tool==1&&HasSling)Shoot();
            TickPickups();
            for(int i=0;i<5;i++)if(Puzzles[i])Puzzles[i].Tick(you);
            InConstruct=HoldsAny();
            // The intro waits for the status line (a pickup's text) to clear, so they never stack.
            if(!IntroDone&&IntroAt&&level.time>=IntroAt&&(level.time>=MessageUntil||level.time>=IntroAt+INTRO_WAIT_MAX))StartIntro();
            TickBridge();TickPeople();TickPossessed();TickDialogue();TickGoop();TickCameras();TickExit();TickSmith();
        }
        OldButtons=buttons;
        if(level.time%7==0)Report();
    }
    bool HoldsAny(){for(int i=0;i<5;i++)if(Puzzles[i]&&Puzzles[i].HoldsPlayer())return true;return false;}
    override void NetworkProcess(ConsoleEvent e)
    {
        if(!Active)return;
        if(e.Name=="pdoom_ready")Holding=false;
        if(e.Name=="pdoom_tool"&&HasSling&&HasWrench)Tool=Tool?0:1;
        // QA only (pdoom_development): free person N into their refuge slot (second argument 1: where they are).
        if(e.Name=="pdoom_agentic_qa_out"&&players[0].mo.GetCVar("pdoom_development")&&!ExitDone)
        {
            RunPractice=true;RunAssisted=true;int i=e.Args[0];
            if(i>=0&&i<5&&!(Camped&(1<<i)))
            {
                Release(i);
                if(!e.Args[1]&&People[i])
                {
                    if(LineLater&(1<<i)){LineLater&=~(1<<i);FreedSpeech(i);}
                    LeftCell[i]=true;SafeMask|=1<<i;Place(People[i],PDAgenticMap.RefugeSlot(i),0);
                }
            }
        }
        // QA only (pdoom_development): SMITH stands Args[1] u in front of you, turned Args[2] degrees from facing
        // you, held in frame Args[0] (0 A idle .. 9 J; 10 and up: the same frame after his badge is taken, for
        // good; -1 lets him go), for art screenshots. Nothing else moves him.
        if(e.Name=="pdoom_agentic_qa_pose"&&players[0].mo.GetCVar("pdoom_development")&&Smith)
        {
            RunPractice=true;RunAssisted=true;
            if(e.Args[0]<0){QaPoseUntil=0;Smith.Pose=-1;return;}
            if(e.Args[0]>=10)Smith.Unbadged=true;
            let you=players[0].mo;Vector2 at=you.Pos.XY+(cos(you.Angle),sin(you.Angle))*max(32,e.Args[1]);
            Place(Smith,at,0);Smith.Angle=Smith.AngleTo(you)+e.Args[2];
            Smith.A_SetRenderStyle(1,STYLE_Normal);Smith.FadeIn=false;
            QaPose=e.Args[0]%10;QaPoseUntil=level.time+35*600;Smith.Pose=QaPose;
        }
        // QA only (pdoom_development): SMITH possesses freed person N where they stand (no SMITH needed nearby).
        if(e.Name=="pdoom_agentic_qa_possess"&&players[0].mo.GetCVar("pdoom_development")&&!ExitDone)
        {
            RunPractice=true;RunAssisted=true;int i=e.Args[0];
            if(i>=0&&i<5&&Released[i]&&!(Camped&(1<<i)))Possess(i);
        }
    }
    // E2M2 never runs a level exit: the payphone is the only way out.
    override void WorldLinePreActivated(WorldEvent e)
    {
        if(!Active||!e.ActivatedLine)return;
        int special=e.ActivatedLine.special;
        if(special==243||special==244||special==74||special==75)e.ShouldActivate=false;
    }
    // No double quotes or backslashes may reach the JSON lines. (A backslash literal would trip this
    // lexer's longest-match string rule, so it is made from its character code.)
    static String Clean(String text){text.Replace("\"","'");text.Replace(String.Format("%c",92),"/");return text;}
    void Report()
    {
        if(Commits)Console.Printf("PDOOM_RUN {\"level_id\":\"agentic-pods\",\"level_version\":\"%s\",\"active_tics\":%d,\"p_doom_cover\":%d,\"practice\":%d,\"assisted\":%d}",RunVersion(),RunTics,CoverDoom,RunPractice,RunAssisted);
        let you=players[0].mo;bool safe=PDAgenticMap.InRefuge(you.Pos.XY);
        String peopleJson="[";
        for(int i=0;i<5;i++)
        {
            let who=People[i];
            bool seen=who&&!who.bInvisible&&you.CheckSight(who);
            peopleJson=peopleJson..String.Format("%s{\"name\":\"%s\",\"released\":%d,\"camped\":%d,\"sheltered\":%d,\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"alive\":1,\"visible\":%d,\"pose_height\":56,\"hit_width\":24,\"controlled\":0}",
                i>0?",":"",PersonName(i),Released[i],(Camped&(1<<i))!=0,(SafeMask&(1<<i))!=0,who?who.Pos.X:0.,who?who.Pos.Y:0.,who?who.Pos.Z:0.,seen);
        }
        peopleJson=peopleJson.."]";
        String extra="";for(int i=0;i<5;i++)if(Puzzles[i])extra=extra..Puzzles[i].Json();
        bool smithSeen=Smith&&!InConstruct&&Smith.Alpha>.5&&you.CheckSight(Smith);
        Console.Printf("PDOOM_AGENTIC {\"guide\":%d,\"introduced\":%d,\"all_safe\":%d,\"freed\":%d,\"safe\":%d,\"homing\":%d,\"camped\":%d,\"possessed\":%d,\"pill\":%d,\"smith_x\":%.1f,\"smith_y\":%.1f,\"smith_z\":%.1f,\"smith_mode\":%d,\"smith_visible\":%d,\"smith_pace\":%.3f,\"smith_busy\":%d,\"todo\":\"%s\",\"in_construct\":%d,\"ending\":\"%s\",\"bridge_up\":%d,\"phone_ringing\":%d,\"door_camera\":%d,\"cameras_broken\":%d,\"cameras_total\":%d,\"alarm_count\":%d,\"spot_camera\":%d,\"hub_entry\":%d,\"site\":%d,\"exit_done\":%d%s}",
            Guide,Introduced,AllSafe,FreedMask(),SafeMask,Homing,Camped,PossessedMask(),HasPill,Smith?Smith.Pos.X:0.,Smith?Smith.Pos.Y:0.,Smith?Smith.Pos.Z:0.,SmithMode,smithSeen,Pace(),Busy(),Clean(Todo),InConstruct,Ending(),
            BridgeUp,PhoneRinging,DoorCameraState(),CamerasBroken,CamerasTotal(),AlarmCount,SpotCamera,HubEntry,DevSite,ExitDone,extra);
        let source=DialogueFrom;
        Console.Printf("PDOOM_DIALOGUE {\"speaker\":\"%s\",\"text\":\"%s\",\"remaining\":%d,\"serial\":%d,\"voice\":\"%s\",\"from\":%d,\"sx\":%.1f,\"sy\":%.1f,\"sz\":%.1f,\"seen\":%d}",
            DialogueSpeaker,Clean(DialogueText),max(0,DialogueUntil-level.time),DialogueSerial,DialogueVoice,source!=null,
            source?source.Pos.X:0.,source?source.Pos.Y:0.,source?source.Pos.Z+source.Height*.85:0.,source&&you.CheckSight(source));
        Console.Printf("PDOOM_STATE {\"level\":\"agentic-pods\",\"map\":\"E2M2\",\"ticks\":%d,\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"angle\":%.1f,\"pitch\":%.1f,\"health\":%d,\"wrench\":%d,\"wrench_swings\":%d,\"gun\":%d,\"ammo\":%d,\"tool\":%d,\"attacking\":%d,\"freed\":%d,\"sheltered\":%d,\"seen_remaining\":%d,\"key\":0,\"refuge_known\":%d,\"in_refuge\":%d,\"cameras_broken\":%d,\"cameras_total\":%d,\"hunter_x\":%.1f,\"hunter_y\":%.1f,\"cable\":%d,\"in_construct\":%d,\"prompt\":\"%s\",\"message\":\"%s\",\"people\":%s}",
            level.time,you.Pos.X,you.Pos.Y,you.Pos.Z,you.Angle,you.Pitch,you.health,HasWrench,Swings,HasSling,Shots,Tool,Tool==1&&(you.player.cmd.buttons&BT_ATTACK)!=0,Freed(),SafeCount(),
            SmithMode==1&&!safe&&!InConstruct?max(0,HuntUntil-level.time):0,Introduced||SafeMask!=0,safe,CamerasBroken,CamerasTotal(),Smith?Smith.Pos.X:0.,Smith?Smith.Pos.Y:0.,CableHeld,InConstruct,
            Clean(Prompt()),level.time<MessageUntil?Clean(Message):"",peopleJson);
    }
}
