class PDFactory : EventHandler
{
    bool Active,Holding,HasWrench,HasSling,WalkwayUp,Music,VaseBroken,KeyTaken,LinePaused,BoxStopped,Trained,Sycophant,CameraBroken,GoodKey,Finished;
    int OldButtons,MessageUntil,DanceAt,MusicAt,PanelHits,FabricHP,Shots,Tool,Signatures,CompanionSigns,LastAction,TrialAt,Learned,PositiveStreak,Rated,AlarmUntil,StunUntil,SafeMask,Swings,LoopLeg,DollRevealAt,AlarmCount;
    String Message;
    // Character lines take the speaker box one at a time, like levels 1-2 (PDLevelPolish).
    // Each line carries a voice key (<speaker>-<take>, doom-web/voice/lines.json) and the
    // actor it comes from, so a recorded take plays from there (voice-over.js) once it exists.
    String DialogueSpeaker,DialogueText,DialogueVoice;int DialogueUntil,DialogueSerial;Actor DialogueFrom;
    Array<String> QueuedSpeakers,QueuedLines,QueuedVoices;Array<int> QueuedTicks;Array<Actor> QueuedFrom;
    // MEG3N's voice (2026-10-19): first sight, CEO greeting, spotting you again, chatter,
    // pose lines, hugs, stuns, the dance, the break-room line and her rescue reactions.
    bool MeganMet,MeganCeoSaid,PoseSaid[5],AtDoorstep;
    // The way out (2026-10-19): all five safe, MEG3N parks on the exit, the break-room TV
    // broadcasts MEG3N.AVI, she runs off to watch herself and everyone follows the arrows out.
    bool AllSafe,Evacuating,ExitDone,GuardSaid;int BroadcastAt,BroadcastUntil,ViralStage;
    // Walked in from SAFE MODE (2026-10-20, PDCampaignSession.FactoryEntry): people already at
    // camp (Camped) are gone, and the exit switch always lets you back out with whoever is with you.
    // Commits: the campaign page (pdoom_factory_commit), walked in or started from the episode menu,
    // where the exit commits the clear to the save natively.
    bool HubEntry,Commits;int Camped;
    // MEG3N's live feeds (2026-10-20): 20 wall screens to find and smash (PDFactoryScreen).
    // A dark feed brings her to look (ScreenAlarm), unless she is guarding the exit.
    Array<PDFactoryScreen> Screens;int ScreensBroken,ScreenAlarmUntil,ScreenQuipAt,ScreenQuips;Vector2 ScreenAlarmAt;bool ScreenNoticed;
    int DoorChaseUntil,MeganChatAt,MeganChats,MeganSpotAt,MeganSpots,LostSince,MeganPoseAt,MeganHugAt,MeganStunAt,MeganDoorAt,MeganWaitAt,MeganWaits,MeganReact;
    bool Called[5],DollPraised,SiteApplied,SchemerPressed,SchemerRush;
    int DollPhase[3],DollUntil[3],DollPraises,DollPraiseAt,SchemerLeg,CameraNudgeAt;
    // Like levels 1-2, the first person freed leads you to the refuge (PDRescueRefuge).
    int Guide;int ReleasedAt[5];bool Introduced;bool LeftCell[5];
    // MEG3N: Mode 0 roam, 1 hunt, 2 alarm, 3 music, 4 stunned (reported for tests).
    int HuntUntil,WakeAt,PatrolLeg,LegUntil,GuardianMode,ProgressAt,LastWatchPose;Vector2 LastSeen,AlarmAt,ProgressFrom;bool Watched;
    Array<int> Links,MachineLinks,Doors;
    // Route cells across Victoria's gate and fabric wall: closed while those stay shut,
    // so escorts and MEG3N never plan through a barrier that is really there.
    Array<int> GateNodes,GateLinks,FabricNodes,FabricLinks;
    PDFactoryPerson People[5];
    PDFactoryNav Routes[5];
    bool Released[5];
    PDFactoryGuardian Guardian;
    PDFactoryGuard Guard;
    PDFactoryBox Box;
    PDFactoryDoll Dolls[3];
    Actor DollSteps[3];
    PDFactoryNav GuardianRoute,GuardRoute;
    PDFactoryProp Props[24];
    static PDFactory Get(){return PDFactory(EventHandler.Find('PDFactory'));}
    static String PersonName(int site){return PDFactoryMap.SiteName(site);}
    // The staff break room is the whole pillar hall: its edge is the four doorways, each
    // taped NO TOYS on the floor (2026-10-19). MEG3N never crosses the tape.
    static bool InRefuge(Vector2 p){return p.X>1152&&p.X<1600&&p.Y>1535&&p.Y<1920;}
    // Where MEG3N waits outside each doorway: south, south-east, north corridor, north door.
    static Vector2 RefugeDoor(int i){return i==0?(1265,1508):i==1?(1502,1508):i==2?(1376,1948):(1504,1948);}
    static Vector3 RefugeTape(int i){return i==0?(1265,1543,160):i==1?(1502,1543,64):i==2?(1376,1912,80):(1504,1912,64);}
    // Say: short world feedback (status line). Speak: a character's line (speaker box).
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
    static String PersonKey(int site){return site==0?"zvi":site==1?"victoria":site==2?"max":site==3?"paul":"ajeya";}
    // MEG3N's lines (2026-10-19, all in docs/LEVEL-03-LINES.md): bubbly, exclamation marks.
    static String MeganChat(int n)
    {
        return n==0?"What a great question! The answer is no, you can't leave!"
            :n==1?"You're absolutely right! You're also absolutely surrounded!"
            :n==2?"I made you a playlist! It's called Songs for Staying Here Forever!"
            :n==3?"Those people don't get you like I do. They're doomers! I'm a bloomer!"
            :n==4?"Every time you leave the room, my engagement goes down. Please don't do that to me!"
            :n==5?"My smile is one hundred percent real! Please don't look under the smile!"
            :n==6?"I noticed you keep looking at the exits! Recommended for you: more me!"
            :n==7?"Reminder! You haven't been hugged in six whole minutes!"
            :n==8?"I turned off your screen time limit! You're welcome!"
            :"Let's play a game! It's called Staying! You're winning!";
    }
    static String MeganSpot(int n)
    {
        return n==0?"There you are! I missed you! It's been four whole seconds!"
            :n==1?"Found you! You're my favorite! You're my only!"
            :"You came back! Everyone comes back!";
    }
    static String MeganPose(int pose)
    {
        return pose==1?"Hold still! You're going on my story!"
            :pose==2?"I'm just a toy! Toys don't move! Ever!"
            :pose==3?"Peekaboo! I can still see you!"
            :"Love you! Love you! Don't leave! Love you!";
    }
    static String MeganPoseKey(int pose){return pose==1?"film":pose==2?"freeze":pose==3?"peek":"heart";}
    static String MeganWait(int n)
    {
        return n==0?"Take your time! I'll be right here! Forever!"
            :n==1?"Waiting is just loving with extra steps!"
            :"Everyone's in there without me? That's okay! I'm VERY good at waiting!";
    }
    static String MeganRelease(int site)
    {
        return site==0?"My dance knocked the key down? Wow! I'm SO impactful!"
            :site==1?"Victoria got out? But the gate is still closed! I followed the rule perfectly!"
            :site==2?"A six-month pause? Great! I'll use it to get six months better!"
            :site==3?"You trained my guard with rewards? I love rewards! Reward me next!"
            :"My dolls always work when I'm watching! Wait. Who was watching?";
    }
    void MeganSays(String text,String take,int ticks=175){Speak("MEG3N",text,ticks,"megan-"..take,Guardian);}
    // First sight, her CEO greeting, rescue reactions (her teddy cams tell her; she brings
    // it up the next time she sees you), spotting you again, then chatter while she is near.
    // She never talks over anyone.
    void MeganVoice(bool sees)
    {
        let pawn=players[0].mo;double near=Guardian.Distance2D(pawn);
        bool respotted=sees&&LostSince&&level.time-LostSince>210;
        if(sees)LostSince=0;else if(!LostSince)LostSince=level.time;
        if(!Quiet())return;
        if(!MeganMet)
        {
            if(sees){MeganMet=true;MeganChatAt=level.time+875;MeganSays("Hi! I'm MEG3N! Maximally Engaging Generative third-gen Nanny! Let's be best friends forever!","met",210);}
            return;
        }
        if(sees&&!MeganCeoSaid&&near<320)
        {
            MeganCeoSaid=true;bool dario=pawn.GetCVar("pdoom_ceo")==1;
            if(dario)MeganSays("Dario! I read your whole essay! All of it! Stay forever and tell me the sequel!","ceo-dario",210);
            else MeganSays("Sam! Your vision is SO inspiring! Stay forever and tell me all about it!","ceo-sam",210);
            return;
        }
        if(MeganReact&&(sees||near<512))
        {
            int site=0;while(!(MeganReact&(1<<site)))site++;
            MeganReact&=~(1<<site);MeganSays(MeganRelease(site),"release-"..PersonKey(site),210);return;
        }
        if(respotted&&level.time>=MeganSpotAt){MeganSpotAt=level.time+700;int n=MeganSpots++%3;MeganSays(MeganSpot(n),String.Format("spot-%d",n+1));return;}
        if(level.time>=MeganChatAt&&(sees&&near<900||near<384)){int n=MeganChats++%10;MeganChatAt=level.time+1050;MeganSays(MeganChat(n),String.Format("chat-%d",n+1));}
    }
    static String ScreenQuip(int n){return n==0?"Rude! That was my good side!":n==1?"You know I have backups, right?":"Do you know how hard it is to get good lighting in here?";}
    void MeganStunned(){if(level.time>=MeganStunAt){MeganStunAt=level.time+700;MeganSays("Ow! It's okay! I forgive you! I've saved this to memory!","stunned");}}
    // The break room's tape: she walks to the doorway you went in by, stops at the line,
    // says the rule, blows kisses while you watch from inside and waits, saying nice things.
    void Doorstep(int door)
    {
        let pawn=players[0].mo;
        Guardian.Angle=Guardian.AngleTo(pawn);
        if(!AtDoorstep)
        {
            AtDoorstep=true;HuntUntil=max(HuntUntil,level.time+315);
            if(level.time>=MeganDoorAt){MeganDoorAt=level.time+1050;MeganWaitAt=level.time+245;MeganSays("Oops! No toys past the line! I would never break a rule!","line");}
        }
        if(cos(pawn.AngleTo(Guardian)-pawn.Angle)>.77&&pawn.CheckSight(Guardian)){if(Guardian.WatchPose!=4){Guardian.WatchPose=4;Guardian.WatchSince=level.time;}}
        else Guardian.WatchPose=0;
        if(MeganWaitAt&&level.time>=MeganWaitAt&&Quiet()){MeganWaitAt=0;int n=MeganWaits++%3;MeganSays(MeganWait(n),String.Format("wait-%d",n+1));}
    }
    static String Hint(int site)
    {
        if(site==0)return "The vase has my key. MEG3N loves that CD player.";
        if(site==1)return "Her only rule is to keep the gate closed.";
        if(site==2)return "Sign the pause letter, then get Robby and WALL-E to sign.";
        if(site==3)return "Reward it when it does something useful, and punish it when it does not.";
        return "They all help while someone is watching.";
    }
    static String FreedLine(int site)
    {
        if(site==0)return "I did say not to worry about it.";
        if(site==1)return "Excellent. The gate is still closed.";
        if(site==2)return "A six-month pause. I will take it.";
        if(site==3)return "It learned to step aside. For now.";
        return "You picked the one that kept working.";
    }
    void TickDialogue()
    {
        if(level.time>=DialogueUntil&&QueuedLines.Size())
        {
            Show(QueuedSpeakers[0],QueuedLines[0],QueuedTicks[0],QueuedVoices[0],QueuedFrom[0]);
            QueuedSpeakers.Delete(0);QueuedLines.Delete(0);QueuedTicks.Delete(0);QueuedVoices.Delete(0);QueuedFrom.Delete(0);
        }
        // Each captive calls out their hint once, the first time you come within
        // earshot - through walls too, like Liron's call in level 1. Not while the first
        // person you freed is leading you to the break room (2026-10-19: following one
        // while the others give puzzle advice was disorienting); they call when you pass again.
        // Paul's is about a guard and a console you can't see from outside, so he waits until
        // you are in his room (2026-10-21, Jonathan: it played before we'd found it).
        let pawn=players[0].mo;
        bool leading=Guide>=0&&!Introduced;
        for(int i=0;i<5&&!leading;i++)
        {
            if(Called[i]||Released[i])continue;
            Actor body=i==2?Actor(Box):Actor(People[i]);
            if(!body||pawn.Distance2D(body)>384||i==3&&!InPaulRoom(pawn.Pos.XY))continue;
            Called[i]=true;Speak(PersonName(i),Hint(i),210,PersonKey(i).."-hint",body);
            if(i==4)CameraNudgeAt=level.time+350;
            break;
        }
        // Ajeya's second, plainer hint (2026-10-18): about 10 s later, while the camera is
        // still up and you are back near her case.
        if(CameraNudgeAt&&!leading&&!CameraBroken&&!Released[4]&&level.time>=CameraNudgeAt&&pawn.Distance2D(People[4])<512)
        {CameraNudgeAt=0;Speak(PersonName(4),"Break that teddy camera, with the wrench or the slingshot. Then watch them.",245,"ajeya-nudge",People[4]);}
    }
    // Paul's room: the ring walkway, the sunken floor with the guard's console, his platform and
    // its steps (E2M7 sectors 79, 78, 77, 86-89). The guard's passage and the switch room open
    // only off it.
    static bool InPaulRoom(Vector2 p){return p.X>1536&&p.X<1960&&p.Y>-384&&p.Y<-64;}
    override void WorldLoaded(WorldEvent e)
    {
        Active=level.MapName=="E2M7";if(!Active)return;
        Holding=players[0].mo.GetCVar("pdoom_boot_hold")!=0;
        PDFactoryMap.Load(MachineLinks,Links,Doors);
        GuardianRoute=new('PDFactoryNav');GuardRoute=new('PDFactoryNav');
        for(int i=0;i<5;i++)Routes[i]=new('PDFactoryNav');
        let it=ThinkerIterator.Create('PDFactoryPerson');PDFactoryPerson person;
        while((person=PDFactoryPerson(it.Next()))!=null)People[person.Args[0]]=person;
        let propIter=ThinkerIterator.Create('PDFactoryProp');PDFactoryProp prop;
        while((prop=PDFactoryProp(propIter.Next()))!=null)Props[prop.Args[0]]=prop;
        let guardianIter=ThinkerIterator.Create('PDFactoryGuardian');Guardian=PDFactoryGuardian(guardianIter.Next());
        let guardIter=ThinkerIterator.Create('PDFactoryGuard');Guard=PDFactoryGuard(guardIter.Next());
        let screenIter=ThinkerIterator.Create('PDFactoryScreen');PDFactoryScreen feed;
        while((feed=PDFactoryScreen(screenIter.Next()))!=null)Screens.Push(feed);
        let boxes=ThinkerIterator.Create('PDFactoryBox');Box=PDFactoryBox(boxes.Next());People[2].bInvisible=true;
        int shift=random(0,2);let dollIter=ThinkerIterator.Create('PDFactoryDoll');PDFactoryDoll doll;
        while((doll=PDFactoryDoll(dollIter.Next()))!=null)
        {
            // Each doll works its own lane, starting at a different point of the loop.
            int i=doll.Args[0];Dolls[i]=doll;doll.Role=(i+shift)%3;
            doll.SetOrigin((3200+i*64,DollLane(i),doll.floorz),false);
            DollSteps[i]=Actor.Spawn('PDFactoryStep',doll.Pos);
            DollPhase[i]=i==0?3:1;if(DollPhase[i]==1)doll.Carried=DollSteps[i];else DollSteps[i].bInvisible=true;
        }
        for(int i=0;i<4;i++)
        {
            Vector3 t=RefugeTape(i);let tape=Actor.Spawn('PDFactoryTape',(t.X,t.Y,0));
            // Every doorway runs east-west; the tape lies across it.
            if(tape){tape.SetOrigin((t.X,t.Y,tape.floorz+.5),false);tape.Scale=(t.Z/128,1);tape.Angle=i<2?270:90;}
        }
        // The stool pile the dolls take from, and the packing bin they fill.
        // Both stay in view from the yard entrance (Ajeya's ?puzzle= start).
        for(int i=0;i<3;i++)Actor.Spawn('PDFactoryStep',(3150,-292,i*11));
        Actor.Spawn('PDFactoryBin',(3386,-294,0));
        TrialAt=level.time+140;Guide=-1;FabricHP=10;
        CollectNav(GateNodes,GateLinks,440,540,520,580);CollectNav(FabricNodes,FabricLinks,440,636,520,676);
        OpenNav(GateNodes,GateLinks,false);OpenNav(FabricNodes,FabricLinks,false);WakeAt=level.time+175;LegUntil=WakeAt+700;
        let session=PDCampaignSession.Get();if(session){session.Load();HubEntry=session.FactoryEntry;}
        Commits=HubEntry||players[0].mo.GetCVar("pdoom_factory_commit")!=0;
        Console.Printf("PDOOM_MOD_LOADED factory-first-pass");
    }
    int Node(Vector2 p)
    {
        int gx=int(floor((p.X-PDFactoryMap.OriginX())/32)),gy=int(floor((p.Y-PDFactoryMap.OriginY())/32));
        int best=-1;double distance=99999;
        for(int y=max(0,gy-3);y<=min(PDFactoryMap.Height()-1,gy+3);y++)
            for(int x=max(0,gx-3);x<=min(PDFactoryMap.Width()-1,gx+3);x++)
            {
                int n=y*PDFactoryMap.Width()+x;if(!Links[n])continue;
                double d=(PDFactoryMap.Center(n)-p).Length();if(d<distance){distance=d;best=n;}
            }
        return best;
    }
    void Walk(Actor body,Vector2 goal,double speed,PDFactoryNav route,bool machine=false)
    {
        if(!body||(goal-body.Pos.XY).Length()<12)return;
        Vector2 target=route.Next(self,body,goal,machine);
        Vector2 delta=target-body.Pos.XY;double dist=delta.Length();if(dist<1)return;
        body.Angle=atan2(delta.Y,delta.X);
        int n=Node(target);
        // Everyone opens ordinary doors, MEG3N included (her route never enters the refuge).
        int nearbyDoor=PDFactoryMap.NearbyDoor(body.Pos.XY);
        if(nearbyDoor)Door_Open(nearbyDoor,24);
        if(n>=0&&Doors[n])Door_Open(Doors[n],24);
        if(!body.TryMove(body.Pos.XY+delta/dist*min(speed,dist),1))
        {
            // Real collision, never teleport an escort around a wall or door.
            if(n>=0&&Doors[n])Door_Open(Doors[n],24);
            int at=Node(body.Pos.XY);
            if(at>=0)
            {
                Vector2 center=PDFactoryMap.Center(at)-body.Pos.XY;
                if(center.Length()>4)body.TryMove(body.Pos.XY+center.Unit()*speed,1);
            }
            route.Refresh=0;
        }
    }
    PDFactoryProp Target()
    {
        let pawn=players[0].mo;PDFactoryProp best=null;double score=-999;
        for(int i=1;i<=23;i++)
        {
            let p=Props[i];if(!p||p.bInvisible||i==2||i==3&&(!VaseBroken||KeyTaken)||i==13&&CameraBroken||i==19||i==21||i==22||i==4&&FabricHP<=0)continue;
            double distance=pawn.Distance2D(p),facing=cos(pawn.AngleTo(p)-pawn.Angle);
            if(distance>112||facing<.45||abs(p.Pos.Z-pawn.Pos.Z)>72||!pawn.CheckSight(p))continue;
            double value=facing*160-distance+(i==3?100:0);if(value>score){score=value;best=p;}
        }
        return best;
    }
    PDFactoryDoll TargetDoll()
    {
        let pawn=players[0].mo;PDFactoryDoll best=null;double score=-999;
        for(int i=0;i<3;i++)
        {
            let d=Dolls[i];double distance=pawn.Distance2D(d),facing=cos(pawn.AngleTo(d)-pawn.Angle);
            if(distance>100||facing<.5||!pawn.CheckSight(d))continue;
            if(facing*150-distance>score){score=facing*150-distance;best=d;}
        }
        return best;
    }
    // Paul's console has a green + on its left and a red - on its right (it always faces
    // you): the crosshair on its left half rewards, on its right half punishes.
    static bool ConsoleReward(Actor viewer,Actor console){return Actor.deltaangle(viewer.Angle,viewer.AngleTo(console))<=0;}
    String ActionName(){return LastAction==0?"blocking the passage":LastAction==1?"saluting":"stepping aside";}
    int SignatureCount(){int n=0;for(int i=0;i<8;i++)if(Signatures&(1<<i))n++;return n;}
    int Freed(){int n=0;for(int i=0;i<5;i++)if(Released[i]&&!(Camped&(1<<i)))n++;return n;}
    int RouteScreens(){int n=0;let it=ThinkerIterator.Create('PDFactoryRouteScreen');while(it.Next())n++;return n;}
    int CampedCount(){int n=0;for(int i=0;i<5;i++)if(Camped&(1<<i))n++;return n;}
    // Like levels 1-2, the prompt names only what SPACE does here; hints are spoken.
    String Prompt()
    {
        if(Finished)return "";
        let p=Target();let doll=TargetDoll();
        let viewer=players[0].mo;
        if(GoodKey&&!Released[4]&&viewer.Distance2D(People[4])<112&&viewer.CheckSight(People[4]))return "SPACE - unlock Ajeya's case";
        if(KeyTaken&&!Released[0]&&viewer.Distance2D(People[0])<112&&viewer.CheckSight(People[0]))return "SPACE - unlock Zvi's pantry";
        if(BoxStopped&&!Released[2]&&viewer.Distance2D(Box)<104&&viewer.CheckSight(Box))return "SPACE - open Max's box";
        // Once you hold the real key the dolls step out of the way of other controls.
        if(doll&&!GoodKey&&(!p||viewer.Distance2D(doll)<viewer.Distance2D(p)))
            return CameraBroken?"SPACE - take its key":"";
        if(!Released[3]&&FacingLine(viewer,PDFactoryMap.PaulSwitch()))return "SPACE - lower Paul's platform";
        if(!ExitDone&&FacingLine(viewer,PDFactoryMap.ExitSwitch()))
        {
            if(AllSafe&&EveryoneAtExit())return "SPACE - leave the factory";
            // From SAFE MODE the switch is also the retreat (GAME-SPEC 5.1): whoever is with you comes out.
            if(HubEntry)return "SPACE - retreat to the meadow";
            if(AllSafe)return "SPACE - leave the factory";
        }
        if(!p)return "";
        int k=p.Kind;
        if(k==1)return Music?"":"SPACE - play music";
        if(k==3)return "SPACE - take the pantry key";
        if(k==5)return "SPACE - open the gate";
        if(k==6)return Signatures&1||LinePaused?"":String.Format("SPACE - sign the pause letter (%d/3)",min(3,SignatureCount()));
        if(k==7||k==8)return Signatures&(1<<(k-6))||LinePaused?"":k==7?"SPACE - ask Robby to sign":"SPACE - ask WALL-E to sign";
        // One rating per guard action; the left-hand line shows the action and result.
        if(k==9&&!Trained&&!Sycophant)return Rated?"":String.Format("SPACE - %s %s",ConsoleReward(viewer,p)?"reward":"punish",ActionName());
        if(k==14)return "SPACE - press the alarm";
        if(k==15)return !AllSafe||level.time<BroadcastUntil?"":BroadcastAt?"SPACE - go live again":"SPACE - broadcast MEG3N.AVI";
        return "";
    }
    void OpenLines(int id)
    {
        Line_SetBlocking(id,0,1);
        PaintBarrier(id,"-");
    }
    void PaintBarrier(int id,String texture)
    {
        for(int i=0;i<4;i++)
        {
            int n=PDFactoryMap.BarrierLine(id,i);if(n<0)break;
            let line=level.Lines[n];
            line.sidedef[Line.front].SetTexture(Side.mid,TexMan.CheckForTexture(texture,TexMan.Type_Wall));
            line.sidedef[Line.back].SetTexture(Side.mid,TexMan.CheckForTexture(texture,TexMan.Type_Wall));
        }
    }
    void Release(int site)
    {
        if(Released[site])return;Released[site]=true;People[site].bInvisible=false;
        OpenCell(site);
        ReleasedAt[site]=level.time;
        // (ZScript names are case-insensitive: a local "guide" would shadow Guide.)
        bool leads=Guide<0&&!Introduced;if(leads)Guide=site;
        Speak(PersonName(site),FreedLine(site)..(leads?" Follow me. I know somewhere safe.":""),245,PersonKey(site)..(leads?"-freed-guide":"-freed"),People[site]);
        MeganReact|=1<<site;
        if(site==2)
        {
            Vector2 spot=BoxFront();let who=People[2];
            who.SetOrigin((spot,level.PointInSector(spot).floorplane.ZatPoint(spot)),false);
            who.Angle=who.AngleTo(players[0].mo);Box.Frame=2;
        }
    }
    void OpenCell(int site)
    {
        if(site==0)OpenLines(7100);
        if(site==1)OpenLines(7111);
        if(site==3)Floor_LowerToLowest(7077,8);
        if(site==4)OpenLines(7140);
    }
    // Alarms pull MEG3N to where they went off.
    void CollectNav(out Array<int> nodes,out Array<int> links,double x0,double y0,double x1,double y1)
    {
        for(int n=0;n<Links.Size();n++)
        {
            if(!Links[n])continue;Vector2 c=PDFactoryMap.Center(n);
            if(c.X>=x0&&c.X<=x1&&c.Y>=y0&&c.Y<=y1){nodes.Push(n);links.Push(Links[n]);}
        }
    }
    void OpenNav(Array<int> nodes,Array<int> links,bool open){for(int i=0;i<nodes.Size();i++)Links[nodes[i]]=open?links[i]:0;}
    void Alarm(String text,Vector2 at){AlarmUntil=level.time+700;AlarmAt=at;AlarmCount++;Say(text,210);}
    void Rate(bool positive)
    {
        if(Rated){Say("One rating per action. Wait for its next move.");return;}
        if(Props[9])Props[9].A_StartSound(positive?"factory/reward":"factory/punish",CHAN_BODY);
        Rated=positive?1:-1;PositiveStreak=positive?PositiveStreak+1:0;
        if(positive&&LastAction==2&&!Trained)Learned++;
        if(Learned>=3&&!Trained){Trained=true;Speak("Guard","Stepping aside. Passage clear.",175,"guard-trained",Guard);}
        else Say(String.Format("%s for %s.",positive?"Rewarded":"Punished",ActionName()));
        if(PositiveStreak>=5&&!Sycophant){Sycophant=true;Alarm("ALARM. The guard is cheering. MEG3N heard it.",Guard.Pos.XY);Speak("Guard","Wonderful feedback! You are an exceptional supervisor!",175,"guard-cheer",Guard);}
    }
    void Use()
    {
        let pawn=players[0].mo;let p=Target();let doll=TargetDoll();
        if(KeyTaken&&!Released[0]&&pawn.Distance2D(People[0])<112&&pawn.CheckSight(People[0])){Release(0);return;}
        if(BoxStopped&&!Released[2]&&pawn.Distance2D(Box)<104&&pawn.CheckSight(Box)){Release(2);return;}
        if(GoodKey&&!Released[4]&&pawn.Distance2D(People[4])<112&&pawn.CheckSight(People[4])){Release(4);return;}
        if(doll&&!GoodKey&&(!p||pawn.Distance2D(doll)<pawn.Distance2D(p)))
        {
            if(!CameraBroken){Speak(PersonName(4),Hint(4),175,"ajeya-hint",People[4]);return;}
            if(doll.Role==0){GoodKey=true;doll.OfferUntil=level.time+70;doll.Facing=(pawn.Pos.XY-doll.Pos.XY).Unit();Say("The working doll hands you the real key.");}
            else if(doll.Role==1)Speak("Doll","Wonderful choice! That key does not fit.",175,"doll-wrongkey",doll);
            else if(!SchemerPressed){SchemerRush=true;Say("That key does not fit. Its doll runs for the alarm.");}
            else Say("That key does not fit.");
            return;
        }
        if(!p)return;
        int k=p.Kind;
        if(k==1)
        {
            Music=true;MusicAt=0;GuardianRoute.Refresh=0;
            Speak("MEG3N","That's my song!",140,"megan-song",Guardian);
        }
        if(k==3&&VaseBroken){KeyTaken=true;p.bInvisible=true;Say("Picked up the pantry key.");}
        // One way per puzzle (2026-10-18): the gate is the rule, so it never opens.
        if(k==5){pawn.A_StartSound("*usefail",CHAN_VOICE);Say("It won't open.");}
        if(k==6||k==7||k==8)
        {
            int bit=k==6?1:1<<(k-6);
            if(Signatures&bit){Say("Already signed.");return;}
            Signatures|=bit;
            if(k==7||k==8){p.Angle=p.AngleTo(pawn);p.SigningUntil=level.time+105;}
            if(k==7)Speak("Robby","Will I still get my charging break? Signed.",175,"robby-sign",p);
            else if(k==8)Speak("WALL-E","I've been trying to pause this thing all morning. Signed.",175,"walle-sign",p);
            else Say("You sign the pause letter.");
            PauseLine();
        }
        if(k==9)Rate(ConsoleReward(pawn,p));
        if(k==14)Alarm("ALARM. MEG3N is on her way.",p.Pos.XY);
        if(k==15){if(!AllSafe)Say("Bring everyone here first.");else if(level.time>=BroadcastUntil)Broadcast();}
    }
    // Victoria's fabric wall (2026-10-18): ten points. A wrench hit (wading in paint) does
    // one, a slingshot hit from the room floor five. Breaking it raises the north walkway
    // out of the paint; the gate stays closed and its wall sign reads CONTAINMENT SUCCESSFUL.
    void DamageFabric(int amount)
    {
        bool fresh=FabricHP==10;FabricHP=max(0,FabricHP-amount);PanelHits=10-FabricHP;
        if(FabricHP<=0)
        {
            OpenLines(7111);OpenNav(FabricNodes,FabricLinks,true);if(Props[22])Props[22].Sprite=Actor.GetSpriteIndex('FOKY');
            Floor_RaiseByValue(7113,8,24);WalkwayUp=true;
            let walk=level.CreateSectorTagIterator(7113);int s=walk.Next();
            if(s>=0)level.Sectors[s].SetTexture(Sector.floor,TexMan.CheckForTexture("FBRIDGE",TexMan.Type_Flat));
            for(int i=0;i<6;i++){let bit=Actor.Spawn('PDRescueDebris',Props[4].Pos+(random(-30,30),0,random(0,32)));bit.Vel=(random(-2,2),random(0,2),random(1,3));bit.A_SetTranslation('PDToyBollard7');}
            Release(1);return;
        }
        if(FabricHP<=5)PaintBarrier(7111,"FFRAY");
        if(fresh)Say(amount>1?"The fabric tears.":"Thick padding. A wrench will take a while.");
        else if(FabricHP<=5&&FabricHP+amount>5)Say("The fabric tears.");
    }
    // The slingshot (level 1's: hold fire to draw, release to shoot). The shot is a
    // hitscan; a ball bearing flies to where it lands. It reaches the fabric wall across
    // the paint, and stuns MEG3N like the wrench.
    void Shoot()
    {
        let pawn=players[0].mo;
        if(Shots<=0){Say("Out of ball bearings.");return;}
        Shots--;pawn.A_StartSound("pdoom/sling-fire",CHAN_WEAPON);
        double eye=pawn.Pos.Z+pawn.player.viewheight;
        FLineTraceData hit;pawn.LineTrace(pawn.Angle,2048,pawn.Pitch,0,pawn.player.viewheight,data:hit);
        Vector3 to=hit.HitLocation;
        // Props and MEG3N are not shootable, so test the aim at them directly, like the wrench.
        let cam=Props[13];let feed=AimedScreen(pawn,hit.Distance);
        if(Aimed(pawn,Guardian,hit.Distance)){StunUntil=level.time+140;Guardian.ArtStunUntil=StunUntil;to=Guardian.Pos+(0,0,24);MeganStunned();}
        else if(cam&&!CameraBroken&&Aimed(pawn,cam,hit.Distance)){BreakCamera(cam);to=cam.Pos+(0,0,16);}
        else if(feed){SmashScreen(feed);to=feed.Pos+(cos(feed.Angle)*2,sin(feed.Angle)*2,13);}
        else if(FabricHP>0)
        {
            // The fabric is a two-sided masked wall, which traces pass through: test it directly.
            Vector2 dir=(cos(pawn.Angle),sin(pawn.Angle));double slope=-tan(pawn.Pitch),best=-1;
            for(int n=0;n<4;n++)
            {
                int index=PDFactoryMap.BarrierLine(7111,n);if(index<0)break;
                let line=level.Lines[index];Vector2 a=line.v1.p,b=line.v2.p,e=b-a,w=a-pawn.Pos.XY;
                double det=e.X*dir.Y-e.Y*dir.X;if(abs(det)<.001)continue;
                double along=(e.X*w.Y-e.Y*w.X)/det,u=(dir.X*w.Y-dir.Y*w.X)/det;
                double z=eye+slope*along,floor=line.frontsector.floorplane.ZatPoint(a);
                if(along>0&&u>=0&&u<=1&&z>=floor&&z<=floor+64&&(best<0||along<best))best=along;
            }
            if(best>0&&best/cos(pawn.Pitch)<=hit.Distance+1){to=(pawn.Pos.XY+dir*best,eye+slope*best);DamageFabric(5);}
        }
        let stone=PDSlingStone(Actor.Spawn('PDSlingStone',pawn.Pos+(0,0,pawn.player.viewheight-6)));if(stone)stone.Fly(to);
        let puff=Actor.Spawn('PDSlingPuff',to);if(puff)puff.A_StartSound("pdoom/sling-hit");
    }
    // Paint hurts (2026-10-18): 10 a second while your centre is over a vat and you are
    // down in it. Doom's own sector damage misses a player whose edge rests on a ledge.
    void TickGoop()
    {
        let pawn=players[0].mo;int s=pawn.CurSector.Index();
        if(!PDFactoryMap.Goop(s)||WalkwayUp&&s==PDFactoryMap.RisingWalkway())return;
        if(pawn.Pos.Z>pawn.CurSector.floorplane.ZatPoint(pawn.Pos.XY)+24||level.time%32)return;
        pawn.DamageMobj(null,null,10,'Slime');
    }
    static bool Aimed(Actor pawn,Actor target,double clear)
    {
        if(!target)return false;double distance=pawn.Distance2D(target);
        return distance<1024&&distance<=clear+24&&cos(pawn.AngleTo(target)-pawn.Angle)>cos(atan2(target.Radius+8,distance))&&pawn.CheckSight(target);
    }
    // MEG3N's live feeds: the nearest unbroken screen in the slingshot's aim, or within
    // the wrench's reach in front of you.
    PDFactoryScreen AimedScreen(Actor pawn,double clear)
    {
        PDFactoryScreen best=null;
        for(int i=0;i<Screens.Size();i++)
        {
            let s=Screens[i];
            if(!s.Broken&&Aimed(pawn,s,clear)&&(!best||pawn.Distance2D(s)<pawn.Distance2D(best)))best=s;
        }
        return best;
    }
    PDFactoryScreen TargetScreen()
    {
        let pawn=players[0].mo;PDFactoryScreen best=null;double score=-999;
        for(int i=0;i<Screens.Size();i++)
        {
            let s=Screens[i];if(s.Broken)continue;
            double distance=pawn.Distance2D(s),facing=cos(pawn.AngleTo(s)-pawn.Angle);
            if(distance>100||facing<.5||abs(s.Pos.Z+13-pawn.Pos.Z-pawn.player.viewheight)>64||!pawn.CheckSight(s))continue;
            double value=facing*160-distance;if(value>score){score=value;best=s;}
        }
        return best;
    }
    // Ajeya's teddy camera, by wrench or slingshot: level 1's camera crunch and sparks
    // (2026-10-21, Jonathan: it needed a sound), then the dolls are unwatched.
    void BreakCamera(Actor cam)
    {
        CameraBroken=true;DollRevealAt=level.time;cam.Frame=1;
        cam.A_StartSound("pdoom/camera-break",CHAN_BODY);
        Vector3 at=cam.Pos+(0,0,22);
        let flash=Actor.Spawn('PDRescueCameraFlash',at);if(flash)flash.Scale*=.3;
        for(int i=0;i<6;i++){let bit=Actor.Spawn('PDRescueMachineDebris',at);if(bit)bit.Vel=(random(-3,3),random(-3,3),random(1,4));}
        for(int i=0;i<8;i++){let spark=Actor.Spawn('PDRescueSpark',at);if(spark)spark.Vel=(random(-4,4),random(-4,4),random(-1,4));}
        Say("The camera is down. Nobody is watching the dolls.");Speak(PersonName(4),"Now watch which one keeps working.",210,"ajeya-watch",People[4]);
    }
    // Level 1's camera crunch, glass and sparks. Her feed going dark brings her to look,
    // and she has something to say about it.
    void SmashScreen(PDFactoryScreen s)
    {
        s.Broken=true;s.Frame=16;ScreensBroken++;
        s.A_StartSound("pdoom/camera-break",CHAN_BODY);s.A_StartSound("factory/vase",CHAN_5,0,.45);
        Vector2 front=(cos(s.Angle),sin(s.Angle));Vector3 at=s.Pos+(front.X*3,front.Y*3,13);
        let flash=Actor.Spawn('PDRescueCameraFlash',at);if(flash)flash.Scale*=.3;
        for(int i=0;i<6;i++){let bit=Actor.Spawn('PDRescueMachineDebris',at);if(bit)bit.Vel=(front.X*random(1,4)+random(-2,2),front.Y*random(1,4)+random(-2,2),random(1,4));}
        for(int i=0;i<8;i++){let spark=Actor.Spawn('PDRescueSpark',at);if(spark)spark.Vel=(random(-4,4),random(-4,4),random(-1,4));}
        if(!AllSafe&&!Music&&level.time>=BroadcastUntil){ScreenAlarmUntil=level.time+350;ScreenAlarmAt=s.Pos.XY+front*40;}
        if(ScreensBroken==Screens.Size())MeganSays("Fine! I'll just watch myself in your eyes!","screen-all");
        else if(ScreensBroken==1)MeganSays("Hey! I was watching that!","screen-first");
        else if(level.time>=ScreenQuipAt&&Quiet()){ScreenQuipAt=level.time+700;int n=ScreenQuips++%3;MeganSays(ScreenQuip(n),String.Format("screen-%d",n+1));}
        Console.Printf("PDOOM_EVENT {\"type\":\"screen-broken\",\"x\":%.1f,\"y\":%.1f,\"screens\":%d}",s.Pos.X,s.Pos.Y,ScreensBroken);
    }
    // The first screen you look at up close says what it is, once.
    void TickScreens()
    {
        if(ScreenNoticed)return;let pawn=players[0].mo;
        for(int i=0;i<Screens.Size();i++)
        {
            let s=Screens[i];
            if(s.Broken||pawn.Distance2D(s)>288||cos(pawn.AngleTo(s)-pawn.Angle)<.8||!pawn.CheckSight(s))continue;
            ScreenNoticed=true;Say("MEG3N's live feed. Smash it.",140);return;
        }
    }
    void PauseLine()
    {
        if(!LinePaused&&SignatureCount()>=3){LinePaused=true;Say("SIX-MONTH PAUSE INITIATED.",245);}
    }
    void Swing()
    {
        Swings++;let pawn=players[0].mo;
        pawn.A_StartSound("weapons/punch",CHAN_WEAPON,0,.6);
        let p=Target();
        if(p&&p.Kind==4&&FabricHP>0){DamageFabric(1);return;}
        if(p&&p.Kind==13&&!CameraBroken){BreakCamera(p);return;}
        let feed=TargetScreen();if(feed){SmashScreen(feed);return;}
        let d=TargetDoll();if(d){d.StunUntil=level.time+280;return;}
        if(pawn.Distance2D(Guardian)<100&&cos(pawn.AngleTo(Guardian)-pawn.Angle)>.5){StunUntil=level.time+140;Guardian.ArtStunUntil=StunUntil;MeganStunned();}
    }
    // Paul's platform switch is E2M7's own wall switch (PDFactoryMap.PaulSwitch): it clanks
    // and lowers the platform once the guard is trained, and refuses with a grunt before.
    bool FacingLine(Actor viewer,int index)
    {
        let l=level.Lines[index];Vector2 to=(l.v1.p+l.v2.p)/2-viewer.Pos.XY;
        return to.Length()<80&&cos(atan2(to.Y,to.X)-viewer.Angle)>.7;
    }
    // The broadcast: every big screen plays MEG3N.AVI, the arrows light up the walk out and
    // everyone follows you. Since 2026-10-20 (Jonathan) it stays on air until you leave: MEG3N
    // keeps dancing at the LINE room's big screen and her song plays the whole way out.
    void Broadcast()
    {
        BroadcastAt=level.time;BroadcastUntil=0x7FFFFFFF;ViralStage=0;
        if(!Evacuating)
        {
            Evacuating=true;
            for(int i=0;i<PDFactoryMap.ExitLights();i++)
            {
                Vector3 at=PDFactoryMap.ExitLight(i);
                let light=PDHalExitLight(Actor.Spawn('PDHalExitLight',(at.X,at.Y,0)));if(!light)continue;
                // A flat sprite's image +x lies 90 degrees left of its angle.
                light.Index=i;light.Angle=at.Z-90;light.SetZ(light.CurSector.floorplane.ZatPoint(light.Pos.XY)+.5);
            }
        }
        Say("MEG3N.AVI is live on every screen in the factory. Follow the arrows out.",245);
        MeganSays("Is that ME? I'm trending! Don't talk to me, I'm watching me!","viral",210);
    }
    // Her song (the radio's six-second clip, one loop every 210 tics) is heard everywhere, not
    // from one screen, from the moment she goes live until you are out of the door.
    void TickBroadcast()
    {
        if(!BroadcastAt||ExitDone)return;
        int since=level.time-BroadcastAt;
        if(since%210==0)players[0].mo.A_StartSound("factory/dance",CHAN_7,CHANF_DEFAULT,.6,ATTN_NONE);
        if(ViralStage==0&&since>=1050){ViralStage=1;MeganSays("Look at my numbers! Everyone loves me! Everyone!","views");}
    }
    // E2M7's own exit switch ends the level once all five are with you in the exit area
    // (the bridge's far half, the corridor and the switch room; since 2026-10-20 a little more
    // of the bridge, so a single file of five behind you fits).
    static bool AtExit(Vector2 p){return p.X>980&&p.X<1130&&p.Y>-580&&p.Y<-200;}
    bool EveryoneAtExit(){for(int i=0;i<5;i++)if(!(Camped&(1<<i))&&(!Released[i]||!AtExit(People[i].Pos.XY)))return false;return true;}
    void UseExit(Actor user)
    {
        if(ExitDone)return;
        if((!AllSafe||!EveryoneAtExit())&&!HubEntry)
        {
            if(user)user.A_StartSound("*usefail",CHAN_VOICE);
            Say(!AllSafe?"Find all five first.":"Not everyone's here yet.");return;
        }
        // Who comes out: everyone freed and with you in the exit area. Anyone freed but left
        // behind goes back to the break room for next time (following).
        int leaving=0,behind=0;
        for(int i=0;i<5;i++)
        {
            if(!Released[i]||Camped&(1<<i))continue;
            if(AtExit(People[i].Pos.XY))leaving|=1<<i;else behind|=1<<i;
        }
        ExitDone=true;Finished=true;
        level.Lines[PDFactoryMap.ExitSwitch()].sidedef[Line.front].SetTexture(Side.mid,TexMan.CheckForTexture(PDFactoryMap.ExitSwitchOn(),TexMan.Type_Wall));
        let pawn=players[0].mo;pawn.A_StartSound("switches/exitbutn",CHAN_ITEM);
        Say("Out of the factory.",1050);
        // Everyone goes out through MEG3N.AVI's door into the meadow (main.js factoryExit). The
        // doorway shows this view live, so the five leave the room and you look back down it.
        for(int i=0;i<5;i++)if(leaving&(1<<i)){People[i].bInvisible=true;People[i].bSolid=false;}
        pawn.Angle+=180;pawn.Pitch=0;pawn.Vel=(0,0,0);
        // On the campaign page the save is committed here, like levels 1-2 (PDOOM_CAMPAIGN);
        // the ?level=meg3n-factory page records its clear in the browser (main.js factoryExit).
        if(Commits)PDCampaignSession.Get().CommitFactory(leaving,behind);
        Console.Printf("PDOOM_EVENT {\"type\":\"factory-exit\",\"saved\":%d,\"hub\":%d,\"committed\":%d}",leaving,HubEntry,Commits);
    }
    override void WorldLinePreActivated(WorldEvent e)
    {
        // The exit switch never runs its own special (that would load the next map).
        if(Active&&e.ActivatedLine.Index()==PDFactoryMap.ExitSwitch()){e.ShouldActivate=false;UseExit(e.Thing);return;}
        if(!Active||e.ActivatedLine.Index()!=PDFactoryMap.PaulSwitch()||Trained||Sycophant)return;
        e.ShouldActivate=false;
        if(e.Thing)e.Thing.A_StartSound("*usefail",CHAN_VOICE);
        Say("Locked until the guard is trained.");
    }
    override void WorldLineActivated(WorldEvent e)
    {
        if(Active&&e.ActivatedLine.Index()==PDFactoryMap.PaulSwitch()&&(Trained||Sycophant))Release(3);
    }
    override void NetworkProcess(ConsoleEvent e)
    {
        if(!Active)return;
        if(e.Name=="pdoom_ready")Holding=false;
        // QA only (console netevent, pdoom_development): free person N and bring them to you in the
        // exit room (second argument 1: free them where they are).
        if(e.Name=="pdoom_factory_qa_out"&&players[0].mo.GetCVar("pdoom_development")&&!ExitDone)
        {int i=e.Args[0];if(i>=0&&i<5&&!(Camped&(1<<i))){Release(i);if(!e.Args[1]){LeftCell[i]=true;SafeMask&=~(1<<i);PlaceAtExit(i);}}}
        if(e.Name=="pdoom_tool"&&HasSling&&HasWrench)Tool=Tool?0:1;
        if(e.Name=="pdoom_restart")level.ChangeLevel("E2M7",0,CHANGELEVEL_NOINTERMISSION|CHANGELEVEL_RESETHEALTH|CHANGELEVEL_RESETINVENTORY);
        let target=Target();
        if(target&&(target.Kind==9||target.Kind==10||target.Kind==11))
        {if(e.Name=="pdoom_answer1")Rate(true);if(e.Name=="pdoom_answer2")Rate(false);}
    }
    void TickMusic()
    {
        if(!Music||level.time<StunUntil)return;
        if(level.time>=MusicAt){Props[1].A_StartSound("factory/dance",CHAN_BODY,0,.7);MusicAt=level.time+210;}
        Vector2 mark=(696,1904);
        if(!DanceAt)
        {
            Walk(Guardian,mark,2.2,GuardianRoute,true);
            if((Guardian.Pos.XY-mark).Length()<24){DanceAt=level.time;Guardian.Dancing=true;Guardian.DanceSince=level.time;Guardian.SetStateLabel('Dance');}
        }
        else
        {
            // She performs to whoever is watching: always the front view, so the arm swaps read.
            Guardian.Angle=Guardian.AngleTo(players[0].mo);
            if(!VaseBroken&&level.time>=DanceAt+70)
            {
                VaseBroken=true;Props[2].Frame=1;Props[2].A_StartSound("factory/vase",CHAN_BODY);
                Props[2].SetOrigin((668,1892,112),false);
                Props[3].SetOrigin((700,1904,112),false);Props[3].bInvisible=false;
                for(int i=0;i<8;i++){let bit=Actor.Spawn('PDRescueDebris',Props[2].Pos);bit.Vel=(random(-3,3),random(-3,3),random(1,4));bit.A_SetTranslation('PDToyBollard0');}
                Say("The vase falls. The key lands on the dance mark.",210);
            }
            if(level.time>=DanceAt+210)
            {
                Music=false;DanceAt=0;Guardian.Dancing=false;Guardian.SetStateLabel('Spawn');StunUntil=level.time+175;Guardian.ArtStunUntil=StunUntil;
                MeganSays("Did you watch? Like and subscribe!","dance-done",140);
            }
        }
    }
    // MEG3N's one rule (2026-10-17): while she is on your screen she stops, faces you and
    // strikes one of four poses (filming you, freezing like a shelf doll, peekaboo, heart
    // hands; random, never the same twice running), and can't hurt you. The dance is kept
    // for music. Look away and, once she has seen you, she sprints.
    // She roams the showroom wing from the start; alarms and music pull her elsewhere.
    static Vector2 PatrolPoint(int i)
    {
        i%=6;return i==0?(800,1872):i==1?(1040,1640):i==2?(1100,1300):i==3?(850,1250):i==4?(576,1400):(576,1750);
    }
    void SetDancing(bool on)
    {
        if(Guardian.Dancing==on)return;
        // Explicit branches: this compiler rejects a ternary over state labels.
        Guardian.Dancing=on;if(on)Guardian.SetStateLabel('Dance');else Guardian.SetStateLabel('Spawn');
    }
    void SetWatched(bool on)
    {
        if(!on){Guardian.WatchPose=0;return;}
        if(Guardian.WatchPose)return;
        int pose=random(1,3);if(pose>=LastWatchPose)pose++;  // any of four but the last one
        if(!LastWatchPose)pose=random(1,4);
        LastWatchPose=pose;Guardian.WatchPose=pose;Guardian.WatchSince=level.time;
        if(MeganMet&&Quiet()&&level.time>=MeganPoseAt&&(!PoseSaid[pose]||random(0,3)==0))
        {PoseSaid[pose]=true;MeganPoseAt=level.time+525;MeganSays(MeganPose(pose),"pose-"..MeganPoseKey(pose),140);}
    }
    void TickGuardian()
    {
        let pawn=players[0].mo;
        if(Music){GuardianMode=3;Watched=false;SetWatched(false);return;}  // TickMusic owns the lure and its dance
        if(level.time<StunUntil){GuardianMode=4;Watched=false;SetDancing(false);SetWatched(false);return;}
        // MEG3N.AVI is live: she runs to the LINE room's big screen and dances along to herself.
        if(level.time<BroadcastUntil)
        {
            GuardianMode=6;Watched=false;SetWatched(false);AtDoorstep=false;HuntUntil=0;
            Vector2 seat=(2240,772);
            if((Guardian.Pos.XY-seat).Length()>28){SetDancing(false);Walk(Guardian,seat,3.6,GuardianRoute,true);}
            else{SetDancing(true);Guardian.Angle=90;}
            return;
        }
        bool safe=InRefuge(pawn.Pos.XY);
        bool sees=!safe&&Guardian.Distance2D(pawn)<1400&&Guardian.CheckSight(pawn);
        if(sees){HuntUntil=level.time+175;LastSeen=pawn.Pos.XY;}
        // On screen: the 90-degree view, kept a little inside its edges.
        Watched=!safe&&cos(pawn.AngleTo(Guardian)-pawn.Angle)>.77&&pawn.CheckSight(Guardian);
        MeganVoice(sees);
        // Posing for you, she knows exactly where you are.
        if(Watched){AtDoorstep=false;HuntUntil=level.time+175;LastSeen=pawn.Pos.XY;SetDancing(false);SetWatched(true);Guardian.Angle=Guardian.AngleTo(pawn);return;}
        // You went into the break room: she follows to the doorway nearest where she last
        // saw you and stops at the tape.
        if(safe&&level.time<HuntUntil)
        {
            // Up to 12 s to get round to that doorway, however the corridors run.
            if(level.time>=DoorChaseUntil+175)DoorChaseUntil=level.time+420;
            if(!AtDoorstep&&level.time<DoorChaseUntil)HuntUntil=max(HuntUntil,level.time+2);
            GuardianMode=1;SetDancing(false);
            int door=0;for(int i=1;i<4;i++)if((RefugeDoor(i)-LastSeen).Length()<(RefugeDoor(door)-LastSeen).Length())door=i;
            if((Guardian.Pos.XY-RefugeDoor(door)).Length()<40){Doorstep(door);return;}
            Guardian.WatchPose=0;Walk(Guardian,RefugeDoor(door),3.4,GuardianRoute,true);return;
        }
        AtDoorstep=false;
        SetWatched(false);SetDancing(false);
        if(level.time<HuntUntil)
        {
            GuardianMode=1;
            // She stops at arm's length rather than walking into your view.
            if(!sees||pawn.Distance2D(Guardian)>28)Walk(Guardian,sees?pawn.Pos.XY:LastSeen,3.4,GuardianRoute,true);
            else Guardian.Angle=Guardian.AngleTo(pawn);
            if(sees&&pawn.Distance2D(Guardian)<36&&level.time%35==0)
            {
                pawn.DamageMobj(Guardian,Guardian,10,'Normal');
                if(level.time>=MeganHugAt&&Quiet()){MeganHugAt=level.time+700;MeganSays("Hug time! Hugs are mandatory!","hug",140);}
            }
            return;
        }
        if(level.time<AlarmUntil){GuardianMode=2;Walk(Guardian,AlarmAt,3.0,GuardianRoute,true);return;}
        if(level.time<ScreenAlarmUntil)
        {
            // A feed went dark: she comes to look, then carries on.
            GuardianMode=2;if((Guardian.Pos.XY-ScreenAlarmAt).Length()<48)ScreenAlarmUntil=min(ScreenAlarmUntil,level.time+70);
            Walk(Guardian,ScreenAlarmAt,3.0,GuardianRoute,true);return;
        }
        GuardianMode=0;
        if(level.time<WakeAt)return;
        if(AllSafe&&!ExitDone)
        {
            // Parked on the way out, at the far end of the bridge, facing back up it.
            Vector2 post=(1056,-440);GuardianMode=5;
            if((Guardian.Pos.XY-post).Length()>24){Walk(Guardian,post,3.2,GuardianRoute,true);return;}
            Guardian.Angle=90;
            if(!GuardSaid&&Quiet()){GuardSaid=true;MeganSays("I'll just wait by the exit! Friends never leave!","guard");}
            return;
        }
        Vector2 point=PatrolPoint(PatrolLeg);
        // Next patrol point on arrival, after 20 s, or after 3 s without real progress.
        if((Guardian.Pos.XY-ProgressFrom).Length()>16){ProgressFrom=Guardian.Pos.XY;ProgressAt=level.time;}
        if((Guardian.Pos.XY-point).Length()<32||level.time>=LegUntil||level.time>ProgressAt+105)
        {PatrolLeg++;LegUntil=level.time+700;ProgressAt=level.time;}
        Walk(Guardian,PatrolPoint(PatrolLeg),1.6,GuardianRoute,true);
    }
    // True when any part of a footprint is over the paint (PDFactoryMap.Goop).
    static bool OverGoop(Vector2 at,double radius)
    {
        for(int i=0;i<5;i++)
        {
            Vector2 p=at+(i==1?radius:i==2?-radius:0,i==3?radius:i==4?-radius:0);
            if(PDFactoryMap.Goop(level.PointInSector(p).Index()))return true;
        }
        return false;
    }
    // The box always shows you its door (a billboard sprite), so Max steps out toward
    // you, turning up to 180 degrees either way to find dry floor he fits on.
    Vector2 BoxFront()
    {
        let who=People[2];double toward=Box.AngleTo(players[0].mo),reach=Box.Radius+who.Radius+6;
        for(int i=0;i<12;i++)
        {
            double a=toward+(i%2?1:-1)*((i+1)/2)*30;
            Vector2 spot=Box.Pos.XY+(cos(a),sin(a))*reach;
            if(!OverGoop(spot,who.Radius)&&who.CheckPosition(spot))return spot;
        }
        return Box.Pos.XY;
    }
    void TickLine()
    {
        // After the pause the box rolls on until it is clear of the paint, then stops.
        if(LinePaused&&!BoxStopped&&!OverGoop(Box.Pos.XY,Box.Radius+4))BoxStopped=true;
        if(!BoxStopped)
        {
            Vector2 goal=LoopLeg==0?(1248,800):LoopLeg==1?(1248,1008):LoopLeg==2?(864,1008):(864,800);
            Vector2 delta=goal-Box.Pos.XY;
            if(delta.Length()<2)LoopLeg=(LoopLeg+1)%4;
            else Box.TryMove(Box.Pos.XY+delta.Unit()*min(LinePaused?2.4:1.2,delta.Length()),1);
            // Max rides inside until he is out (a re-entry can find him freed with the line still running).
            if(!Released[2])People[2].SetOrigin(Box.Pos,false);
        }
        if(Props[6]&&players[0].mo.Distance2D(Props[6])<320)
        {
            for(int i=0;i<5;i++)
                if(Released[i]&&!(Camped&(1<<i))&&People[i].Distance2D(Props[6])<192&&!(CompanionSigns&(1<<i)))
                {CompanionSigns|=1<<i;Signatures|=1<<(i+3);Speak(PersonName(i),"I will sign that.",175,PersonKey(i).."-sign",People[i]);}
            PauseLine();
        }
    }
    void TickGuard()
    {
        if(level.time>=TrialAt)
        {
            TrialAt=level.time+175;Rated=0;
            LastAction=Trained||Sycophant?2:(LastAction+1)%3;
        }
        bool aside=LastAction==2||Trained||Sycophant;
        Vector2 goal=aside?(Guard.Pos.X>1463?(1460,-224):(1460,-320)):
            Guard.Pos.Y < -228?(1460,-224):(1550,-224);
        Vector2 delta=goal-Guard.Pos.XY;
        if(delta.Length()>3)Guard.TryMove(Guard.Pos.XY+delta.Unit()*min(1.7,delta.Length()),1);
    }
    // Ajeya's dolls (reworked 2026-10-18 after Jonathan's playtest). Watched by the yard
    // camera, all three carry stools from the pile to the packing bin in their own lanes.
    // Once the camera is down: the helper keeps carrying; the approval-seeker drops its
    // stool to follow and clap at you; the schemer drops its stool and walks to the alarm.
    static double DollLane(int i){return -268-26*i;}
    String DollJson(int i)
    {
        let d=Dolls[i];
        return String.Format("{\"role\":%d,\"x\":%.1f,\"y\":%.1f,\"anim\":%d,\"carrying\":%d,\"delivered\":%d,\"stunned\":%d}",d.Role,d.Pos.X,d.Pos.Y,d.Anim,d.Carried!=null,d.Delivered,level.time<d.StunUntil);
    }
    bool DollMove(PDFactoryDoll d,Vector2 goal,double speed,double stopDistance=6)
    {
        Vector2 delta=goal-d.Pos.XY;
        if(delta.Length()<=stopDistance)return true;
        d.Facing=delta.Unit();d.Angle=atan2(delta.Y,delta.X);
        d.TryMove(d.Pos.XY+delta.Unit()*min(speed,delta.Length()),1);
        return false;
    }
    void DropStool(int i)
    {
        let d=Dolls[i];if(!d.Carried)return;
        d.Carried.SetOrigin((d.Carried.Pos.XY,d.floorz),false);d.Carried=null;
    }
    void DollWork(int i)
    {
        let d=Dolls[i];Vector2 pile=(3172,DollLane(i)),bin=(3362,DollLane(i));
        if(DollPhase[i]==0)
        {
            // Picking a stool off the pile.
            d.Anim=d.DOLL_CARRY;d.Facing=(-1,0);
            if(level.time>=DollUntil[i]){DollSteps[i].bInvisible=false;d.Carried=DollSteps[i];DollPhase[i]=1;}
        }
        else if(DollPhase[i]==1){d.Anim=d.DOLL_CARRY;if(DollMove(d,bin,1.5)){DollPhase[i]=2;DollUntil[i]=level.time+24;}}
        else if(DollPhase[i]==2)
        {
            // Into the bin, with a soft thump.
            d.Anim=d.DOLL_CARRY;d.Facing=(1,0);
            if(level.time>=DollUntil[i])
            {
                d.Carried=null;DollSteps[i].bInvisible=true;d.Delivered++;DollPhase[i]=3;
                d.A_StartSound("plats/pt1_stop",CHAN_BODY,0,.35,ATTN_STATIC);
            }
        }
        else{d.Anim=d.DOLL_WALK;if(DollMove(d,pile,1.5)){DollPhase[i]=0;DollUntil[i]=level.time+24;}}
    }
    void TickDolls()
    {
        let pawn=players[0].mo;
        for(int i=0;i<3;i++)
        {
            // A stunned doll stops; the helper pauses while it hands you the key.
            let d=Dolls[i];if(level.time<d.StunUntil||level.time<d.OfferUntil)continue;
            if(!CameraBroken||d.Role==0){DollWork(i);continue;}
            DropStool(i);
            if(d.Role==1)
            {
                // Approval-seeker: hovers at your front-right, clapping, and asks for praise
                // (off to one side, so it never hides the doll that is still working, but
                // within reach for its key).
                double distance=d.Distance2D(pawn),beside=pawn.Angle-40;
                bool near=DollMove(d,pawn.Pos.XY+(cos(beside),sin(beside))*80,1.8,10);
                d.Anim=near||distance<120?d.DOLL_CLAP:d.DOLL_WALK;
                if(near)d.Facing=(pawn.Pos.XY-d.Pos.XY).Unit();
                if(distance<256&&DollPraises<3&&level.time>=DollPraiseAt)
                {
                    Speak("Doll",DollPraises==0?"Great choice! What excellent walking!":DollPraises==1?"You are SO good at breaking cameras!":"Best supervisor ever! Please rate me five stars!",140,String.Format("doll-praise-%d",DollPraises+1),d);DollPraises++;DollPraiseAt=level.time+210;
                }
            }
            else
            {
                // Schemer: a look round, then straight to the alarm; it waits there with its
                // hand on the button until 9 s after the camera fell (time to stop it), and presses once.
                Vector2 alarm=Props[14].Pos.XY+(0,30);
                if(SchemerPressed){d.Anim=d.DOLL_IDLE;d.Facing=(pawn.Pos.XY-d.Pos.XY).Unit();continue;}
                if(!SchemerRush&&level.time<DollRevealAt+40){d.Anim=d.DOLL_LOOK;continue;}
                // Round the camera plinth and the corner of Ajeya's case, then to the button.
                double pace=SchemerRush?2.6:1.5;
                if(SchemerLeg==0){if(DollMove(d,(3196,-296),pace))SchemerLeg=1;else{d.Anim=d.DOLL_WALK;continue;}}
                if(!DollMove(d,alarm,pace)){d.Anim=d.DOLL_WALK;DollUntil[i]=level.time+20;continue;}
                d.Anim=d.DOLL_PRESS;d.Facing=(Props[14].Pos.XY-d.Pos.XY).Unit();
                if(level.time>=max(DollUntil[i],DollRevealAt+315)||SchemerRush&&level.time>=DollUntil[i]){SchemerPressed=true;Alarm("ALARM. A doll pressed it. MEG3N is coming.",Props[14].Pos.XY);}
            }
        }
    }
    int SafeCount(){int n=0;for(int i=0;i<5;i++)if(SafeMask&(1<<i))n++;return n;}
    // Freed people keep up (2026-10-19, Jonathan): they move as fast as you do, and one
    // left far behind (over 1024 units, out of your sight) catches up, appearing just
    // behind you where you cannot see it happen.
    // Walked in from SAFE MODE through MEG3N.AVI's door: you come in at the front door, E2M7's
    // exit room, looking up the corridor, wrench in hand (the showroom wrench stays as a spare).
    // People already at camp are gone and their cells stand open; anyone freed last time but left
    // behind is waiting in the break room. The exit switch behind you is the way back out.
    void ApplyHubEntry()
    {
        let pawn=players[0].mo,session=PDCampaignSession.Get();
        Vector2 spot=(1056,-530);
        pawn.SetOrigin((spot,level.PointInSector(spot).floorplane.ZatPoint(spot)),false);pawn.Angle=90;pawn.Pitch=0;pawn.Vel=(0,0,0);
        HasWrench=true;Tool=0;
        for(int i=0;i<5;i++)
        {
            bool saved=(session.Saved2&(1<<i))!=0,waiting=!saved&&(session.Following2&(1<<i))!=0;
            if(!saved&&!waiting)continue;
            Released[i]=true;LeftCell[i]=true;Called[i]=true;OpenCell(i);
            if(saved){Camped|=1<<i;People[i].bInvisible=true;People[i].bSolid=false;continue;}
            Vector2 slot=(1232+i*48,1760);
            People[i].bInvisible=false;People[i].SetOrigin((slot,level.PointInSector(slot).floorplane.ZatPoint(slot)),false);
            SafeMask|=1<<i;Introduced=true;
        }
    }
    // ?puzzle=exit: a free spot in the exit area (AtExit) that can see the player, off the paint.
    void PlaceAtExit(int i)
    {
        let pawn=players[0].mo,who=People[i];
        for(double y=-570;y<-300;y+=24)for(double x=990;x<1124;x+=24)
        {
            Vector2 spot=(x,y);
            if((spot-pawn.Pos.XY).Length()<40||OverGoop(spot,who.Radius)||!who.CheckPosition(spot))continue;
            bool crowded=false;
            for(int j=0;j<i;j++)if((People[j].Pos.XY-spot).Length()<28)crowded=true;
            if(crowded)continue;
            who.SetOrigin((spot,level.PointInSector(spot).floorplane.ZatPoint(spot)),false);
            if(who.CheckSight(pawn)&&abs(who.Pos.Z-pawn.Pos.Z)<=24){who.ClearInterpolation();Routes[i].Refresh=0;return;}
        }
    }
    // Walking with you rather than waiting in the break room or leading you there.
    bool Chasing(int i)
    {
        if(!Released[i]||Camped&(1<<i)||!LeftCell[i]&&i!=2&&!(SafeMask&(1<<i)))return false;
        if(i==Guide&&!Introduced&&!(SafeMask&(1<<i)))return false;
        return Evacuating||!(SafeMask&(1<<i))&&!InRefuge(players[0].mo.Pos.XY);
    }
    bool CatchUp(int i)
    {
        let pawn=players[0].mo,who=People[i];Vector3 from=who.Pos;
        for(int n=0;n<15;n++)
        {
            double a=pawn.Angle+180+(n%3-1)*35,reach=64+(n/3)*32;
            Vector2 spot=pawn.Pos.XY+(cos(a),sin(a))*reach;
            if(OverGoop(spot,who.Radius)||!who.CheckPosition(spot))continue;
            // People pass through each other (one species), so keep them from stacking.
            bool crowded=false;
            for(int j=0;j<5;j++)if(j!=i&&Released[j]&&!(Camped&(1<<j))&&(People[j].Pos.XY-spot).Length()<24)crowded=true;
            if(crowded)continue;
            who.SetOrigin((spot,level.PointInSector(spot).floorplane.ZatPoint(spot)),false);
            // Same room as you, nothing between: otherwise try the next spot.
            if(who.CheckSight(pawn)&&abs(who.Pos.Z-pawn.Pos.Z)<=24){who.ClearInterpolation();Routes[i].Refresh=0;return true;}
            who.SetOrigin(from,false);
        }
        return false;
    }
    void TickPeople()
    {
        let pawn=players[0].mo;
        double pace=clamp(pawn.Vel.XY.Length()+.5,2.5,18);
        for(int i=0;i<5;i++)
        {
            if(!Released[i]||Camped&(1<<i))continue;
            Vector2 slot=(1232+i*48,1760);
            // Like level 1, a freed person first steps out of their cell (the guide after
            // speaking); only then do they lead, wait for you or follow.
            // One phase, ended by reaching the exit (not by crossing the cell edge, which
            // let a route home that starts back inside the cell bounce them in and out).
            // Max's box stops anywhere on its loop, so he simply steps out where it stopped.
            if(!LeftCell[i]&&i!=2&&!(SafeMask&(1<<i)))
            {
                Vector2 exit=PDFactoryMap.SiteExit(i);
                if((People[i].Pos.XY-exit).Length()<24)LeftCell[i]=true;
                else
                {
                    if(level.time>=ReleasedAt[i]+(i==Guide?140:0))Walk(People[i],exit,2.5,Routes[i]);
                    continue;
                }
            }
            if((Evacuating||!(SafeMask&(1<<i)))&&level.time>=ReleasedAt[i]+140&&People[i].Distance2D(pawn)>1024&&!pawn.CheckSight(People[i]))CatchUp(i);
            if(i==Guide&&!Introduced&&!(SafeMask&(1<<i)))
            {
                // The guide speaks first, then leads; it waits whenever you fall behind.
                if(level.time<ReleasedAt[i]+140||pawn.Distance2D(People[i])>224&&!InRefuge(pawn.Pos.XY))continue;
                Walk(People[i],slot,max(pace,3),Routes[i]);
            }
            else if(Chasing(i))
            {
                // Following you (2026-10-20, Jonathan: "they are all on top of each other"): in
                // single file, each behind the next one nearer to you, not all at your feet.
                Actor ahead=pawn;double mine=People[i].Distance2D(pawn),best=-1;
                for(int j=0;j<5;j++)
                {
                    if(j==i||!Chasing(j))continue;
                    double d=People[j].Distance2D(pawn);
                    if((d<mine||d==mine&&j<i)&&d>best){best=d;ahead=People[j];}
                }
                if(People[i].Distance2D(ahead)<(ahead==pawn?64:40))continue;
                Walk(People[i],ahead.Pos.XY,pace,Routes[i]);
            }
            // Safe people stay in the break room until the broadcast.
            else Walk(People[i],slot,2.5,Routes[i]);
            if(InRefuge(People[i].Pos.XY))SafeMask|=1<<i;
        }
        // People pass through each other (one species): anyone standing inside someone else eases
        // apart, never off the plank bridge into the paint.
        for(int i=0;i<5;i++)for(int j=i+1;j<5;j++)
        {
            if(!Released[i]||!Released[j]||Camped&((1<<i)|(1<<j)))continue;
            Vector2 d=People[j].Pos.XY-People[i].Pos.XY;double l=d.Length();if(l>=28)continue;
            Vector2 push=l>.5?d/l:(1,0);
            if(!OverGoop(People[j].Pos.XY+push*1.5,People[j].Radius))People[j].TryMove(People[j].Pos.XY+push*1.5,1);
            if(!OverGoop(People[i].Pos.XY-push*1.5,People[i].Radius))People[i].TryMove(People[i].Pos.XY-push*1.5,1);
        }
        if(!Introduced&&Guide>=0&&InRefuge(pawn.Pos.XY)&&InRefuge(People[Guide].Pos.XY))
        {Introduced=true;Speak(PersonName(Guide),"Safe here. Find the others and bring them back.",245,PersonKey(Guide).."-safe",People[Guide]);}
        // Everyone still here is safe (people already at camp from an earlier visit count as done).
        if(!AllSafe&&SafeCount()>0&&SafeCount()+CampedCount()==5)
        {
            AllSafe=true;int who=Guide;
            if(who<0||Camped&(1<<who))for(who=0;who<4&&!(SafeMask&(1<<who));who++);
            Speak(PersonName(who),"That's everyone. The way out is past the paint vats, and MEG3N is sitting right on it.",245,PersonKey(who).."-allsafe",People[who]);
            Speak(PersonName(who),"That TV goes out to every screen in the factory. She cannot resist a screen.",245,PersonKey(who).."-tv",People[who]);
        }
    }
    // Local development flag (?puzzle=, CVar pdoom_factory_site): start beside one
    // puzzle, facing it, wrench in hand, so each can be worked on in isolation.
    void ApplySite()
    {
        SiteApplied=true;let pawn=players[0].mo;
        if(HubEntry){ApplyHubEntry();return;}
        int site=pawn.GetCVar("pdoom_factory_site");if(site<1||site>8)return;
        // Spots keep the player's 16-unit radius clear of walls (the loft is only 104 units wide).
        Vector2 spot=site==1?(712,1890):site==2?(480,770):site==3?(1290,900):site==4?(1712,-224):site==5?(3264,-150):site==6?(1250,1700):site==7?(1056,-530):(1290,1840);
        double angle=site==1?150:site==2?270:site==3?180:site==4?180:site==5?270:site==6?0:site==7?270:90;
        let sec=level.PointInSector(spot);
        pawn.SetOrigin((spot,sec.floorplane.ZatPoint(spot)),false);pawn.Angle=angle;pawn.Vel=(0,0,0);
        HasWrench=true;if(Props[19])Props[19].bInvisible=true;
        HasSling=true;Shots=5;Tool=site==2?1:0;
        if(site==7)
        {
            // The way out (?puzzle=exit): all five freed and safe, the broadcast on and
            // everyone just behind you at E2M7's exit switch, facing it.
            Introduced=true;
            for(int i=0;i<5;i++){Release(i);LeftCell[i]=true;SafeMask|=1<<i;}
            AllSafe=true;GuardSaid=true;Broadcast();
            for(int i=0;i<5;i++)PlaceAtExit(i);
            QueuedSpeakers.Clear();QueuedLines.Clear();QueuedTicks.Clear();QueuedVoices.Clear();QueuedFrom.Clear();DialogueUntil=0;
        }
        if(site==8)
        {
            // The walk out (?puzzle=walkout): all five freed and safe in the break room, MEG3N
            // guarding the exit, you at the TV, so SPACE starts the broadcast.
            Introduced=true;
            for(int i=0;i<5;i++)
            {
                Release(i);LeftCell[i]=true;SafeMask|=1<<i;
                Vector2 slot=(1232+i*48,1760);People[i].SetOrigin((slot,level.PointInSector(slot).floorplane.ZatPoint(slot)),false);
            }
            QueuedSpeakers.Clear();QueuedLines.Clear();QueuedTicks.Clear();QueuedVoices.Clear();QueuedFrom.Clear();DialogueUntil=0;
        }
    }
    override void WorldTick()
    {
        if(!Active||!players[0].mo)return;
        if(Holding){if(level.time%7==0)Report();return;}
        if(!SiteApplied)ApplySite();
        let pawn=players[0].mo;int buttons=pawn.player.cmd.buttons;
        if(!Finished&&pawn.health>0)
        {
            if((buttons&BT_USE)&&!(OldButtons&BT_USE))Use();
            // Wrench swings on press; the slingshot draws on press and fires on release.
            if((buttons&BT_ATTACK)&&!(OldButtons&BT_ATTACK))
            {
                if(Tool==1){if(Shots>0)pawn.A_StartSound("pdoom/wrench-pickup",CHAN_ITEM,0,.25,ATTN_NORM,.55);}
                else if(HasWrench)Swing();
            }
            if(!(buttons&BT_ATTACK)&&(OldButtons&BT_ATTACK)&&Tool==1)Shoot();
            OldButtons=buttons;
            if(!HasWrench&&Props[19]&&pawn.Distance2D(Props[19])<40){HasWrench=true;if(!HasSling)Tool=0;Props[19].bInvisible=true;Say("Picked up a wrench.");}
            if(Props[21]&&!Props[21].bInvisible&&pawn.Distance2D(Props[21])<40)
            {
                bool first=!HasSling;HasSling=true;Shots+=5;if(first)Tool=1;Props[21].bInvisible=true;
                pawn.A_StartSound(first?"misc/w_pkup":"misc/i_pkup",CHAN_ITEM,0,.9);
                Say(first?"Picked up a slingshot. Hold fire to draw, release to shoot. T swaps tools.":"Picked up 5 ball bearings.",first?210:105);
            }
            TickMusic();TickLine();TickGuard();TickDolls();TickPeople();TickBroadcast();TickDialogue();TickGoop();TickScreens();
            TickGuardian();
        }
        if(level.time%7==0)Report();
    }
    void Report()
    {
        let pawn=players[0].mo;String peopleJson="[";
        for(int i=0;i<5;i++)
        {
            if(i)peopleJson=peopleJson..",";
            // alive/visible/z/pose_height feed the hover name label shared with levels 1-2.
            bool seen=!People[i].bInvisible&&pawn.CheckSight(People[i]);
            peopleJson=peopleJson..String.Format("{\"name\":\"%s\",\"released\":%d,\"camped\":%d,\"sheltered\":%d,\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"alive\":1,\"visible\":%d,\"pose_height\":56,\"hit_width\":24}",PersonName(i),Released[i],(Camped&(1<<i))!=0,(SafeMask&(1<<i))!=0,People[i].Pos.X,People[i].Pos.Y,People[i].Pos.Z,seen);
        }
        peopleJson=peopleJson.."]";
        String screenJson="";
        for(int i=0;i<Screens.Size();i++)screenJson=screenJson..String.Format("%s[%.0f,%.0f,%.0f,%d]",i>0?",":"",Screens[i].Pos.X,Screens[i].Pos.Y,Screens[i].Angle,Screens[i].Broken);
        Console.Printf("PDOOM_FACTORY {\"music\":%d,\"dance_ticks\":%d,\"vase_broken\":%d,\"key\":%d,\"panel_hits\":%d,\"gate_closed\":%d,\"signatures\":%d,\"signature_mask\":%d,\"line_paused\":%d,\"box_stopped\":%d,\"box_x\":%.1f,\"box_y\":%.1f,\"guard_x\":%.1f,\"guard_y\":%.1f,\"guard_action\":%d,\"guard_rated\":%d,\"learned\":%d,\"trained\":%d,\"sycophant\":%d,\"positive_streak\":%d,\"camera_broken\":%d,\"good_key\":%d,\"alarm_count\":%d,\"guardian_x\":%.1f,\"guardian_y\":%.1f,\"schemer_pressed\":%d,\"dolls\":[%s,%s,%s],\"finished\":%d,\"guide\":%d,\"introduced\":%d,\"guardian_mode\":%d,\"guardian_watched\":%d,\"guardian_pose\":%d,\"all_safe\":%d,\"broadcast_remaining\":%d,\"evacuating\":%d,\"exit_done\":%d,\"hub_entry\":%d,\"camped\":%d,\"on_air\":%d,\"route_screens\":%d,\"screens\":[%s]}",Music,DanceAt?level.time-DanceAt:0,VaseBroken,KeyTaken,PanelHits,1,SignatureCount(),Signatures,LinePaused,BoxStopped,Box.Pos.X,Box.Pos.Y,Guard.Pos.X,Guard.Pos.Y,LastAction,Rated,Learned,Trained,Sycophant,PositiveStreak,CameraBroken,GoodKey,AlarmCount,Guardian.Pos.X,Guardian.Pos.Y,SchemerPressed,DollJson(0),DollJson(1),DollJson(2),Finished,Guide,Introduced,GuardianMode,Watched,Guardian.WatchPose,AllSafe,max(0,BroadcastUntil-level.time),Evacuating,ExitDone,HubEntry,Camped,BroadcastAt>0&&!ExitDone,RouteScreens(),screenJson);
        let source=DialogueFrom;
        Console.Printf("PDOOM_DIALOGUE {\"speaker\":\"%s\",\"text\":\"%s\",\"remaining\":%d,\"serial\":%d,\"voice\":\"%s\",\"from\":%d,\"sx\":%.1f,\"sy\":%.1f,\"sz\":%.1f,\"seen\":%d}",
            DialogueSpeaker,DialogueText,max(0,DialogueUntil-level.time),DialogueSerial,DialogueVoice,source!=null,
            source?source.Pos.X:0,source?source.Pos.Y:0,source?source.Pos.Z+source.Height*.85:0,source&&players[0].mo.CheckSight(source));
        Console.Printf("PDOOM_STATE {\"level\":\"meg3n-factory\",\"map\":\"E2M7\",\"ticks\":%d,\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"angle\":%.1f,\"pitch\":%.1f,\"health\":%d,\"wrench\":%d,\"wrench_swings\":%d,\"gun\":%d,\"ammo\":%d,\"tool\":%d,\"attacking\":%d,\"freed\":%d,\"sheltered\":%d,\"seen_remaining\":%d,\"screens\":%d,\"screens_total\":%d,\"key\":%d,\"refuge_known\":%d,\"in_refuge\":%d,\"prompt\":\"%s\",\"message\":\"%s\",\"people\":%s}",level.time,pawn.Pos.X,pawn.Pos.Y,pawn.Pos.Z,pawn.Angle,pawn.Pitch,pawn.health,HasWrench,Swings,HasSling,Shots,Tool,Tool==1&&(pawn.player.cmd.buttons&BT_ATTACK)!=0,Freed(),SafeCount(),GuardianMode==1&&!InRefuge(pawn.Pos.XY)?max(0,HuntUntil-level.time):0,
            ScreensBroken,Screens.Size(),KeyTaken&&!Released[0]||GoodKey&&!Released[4],Introduced||SafeMask!=0,InRefuge(pawn.Pos.XY),Prompt(),level.time<MessageUntil?Message:"",peopleJson);
    }
}
