// All five rescues run in the native world. Terminals use 1/2/3; E is physical work.
class PDHalStation : Object play
{
    int Labels,LabelWork,ExamStep,ExamLock,Menu,MenuUntil;
    // Station power: LIGHTS 1, DOORS 2, ALARMS 4, LIFE SUPPORT 8, HAL 16. All on
    // until HAL's main breaker is pulled (PDHalReboot).
    int Levers,ManualUntil,Valves;
    int JailAnswer,JailAttempts,Modules,EvaluationUntil,EvaluationReady;
    int WrongUntil,BarkAt;
    bool Pacified,PedestalDown;
    int HintAt,ExamCorrect,ExamValue;
    int SeenAt[5]; // when you first saw each prisoner's hint subject (0: not yet)
    PDTeaService Service;
    PDHalDoors Doors;
    PDEvaluationSign EvaluationBoard;
    PDHalEvaluation EvaluationRoom;
    PDHalPersonality Personality;
    PDHalReboot Reboot;
    String QuestionTitle,QuestionText,Choice1,Choice2,Choice3,MenuComment;
    void Load(PDCheckpoint game)
    {
        let signs=ThinkerIterator.Create('PDEvaluationSign');EvaluationBoard=PDEvaluationSign(signs.Next());
        Doors=new('PDHalDoors');Doors.Load();EvaluationRoom=new('PDHalEvaluation');HintAt=level.time+1050;Levers=31;JailAnswer=2;BarkAt=level.time+1050;
        Service=new('PDTeaService');Service.Load();
        Personality=new('PDHalPersonality');Personality.Load();Reboot=new('PDHalReboot');game.Awake=true;
        if(game.Hunter){game.Hunter.A_SetSize(16,32);game.Hunter.bNoGravity=true;game.Hunter.bFloat=true;game.Hunter.SetStateLabel('HAL');}
    }
    // What each prisoner's hint talks about: the tea robot, the exam terminal, the THAW
    // override, the pod-bay panel and the evaluation board.
    Actor HintSubject(int site)
    {
        if(site==0)return Service?Service.Bot:null;
        if(site==4)return EvaluationBoard;
        int kind=site==1?22:site==2?29:26;
        let it=ThinkerIterator.Create('PDHalTerminal');PDHalTerminal t;
        while((t=PDHalTerminal(it.Next()))!=null)if(t.Kind==kind)return t;
        return null;
    }
    bool HintSeen(PDCheckpoint game,int site)
    {
        if(game.Cast.People[site].Hinted)return false;
        if(SeenAt[site]==0)
        {
            let pawn=players[0].mo;let subject=HintSubject(site);
            if(!pawn||!subject||pawn.Distance2D(subject)>1024||cos(pawn.AngleTo(subject)-pawn.Angle)<.7||!pawn.CheckSight(subject))return false;
            SeenAt[site]=max(1,level.time);
        }
        return level.time>=SeenAt[site]+35;
    }

    String Prompt(PDCheckpoint game)
    {
        let item=game.TargetProp();
        if(!item){if(EvaluationBoard&&EvaluationBoard.Carried)return EvaluationBoard.CarryPrompt(self);String exit=Reboot.ButtonPrompt(game);if(exit!="")return exit;return Doors.ContextPrompt(game);}
        if(item.Kind<20)return "";
        int k=item.Kind;
        if(k==20)return Service.Prompt();
        if(k==22)return level.time<ExamLock?"Exam locked for 15 seconds":"SPACE - take Humanity's Last Exam";
        if(k==24)return Reboot.Prompt(game);
        if(k==29)return game.Cast.People[2].Released?"":level.time<ManualUntil?"Turn both green valves.":"SPACE - manual thaw override";
        if(k==40||k==41)return game.Cast.People[2].Released||Valves&(1<<(k-40))?"":level.time<ManualUntil?"SPACE - turn valve":"Valve locked. Start the THAW override.";
        if(k==26)return "SPACE - ask HAL to open the pod bay";
        if(k==28)return "SPACE - pick up the board";
        if(k>=50&&k<=53)return "SPACE - pull memory module";
        if(k>=60)return Doors.Prompt(k-60);
        return "";
    }
    void Use(PDCheckpoint game,PDCheckpointProp item)
    {
        int k=item.Kind;
        if(k==20){Service.Swap(game);return;}
        if(k==24){Reboot.Pull(game);return;}
        if(k>=60)Doors.Use(game,k-60);
        else if(k==22&&level.time>=ExamLock){Menu=1;MenuUntil=level.time+700;Question(game);}
        else if(k==29)
        {
            if(game.Cast.People[2].Released||level.time<ManualUntil)return;
            ManualUntil=level.time+700;Valves=0;
            item.A_StartSound("switches/normbutn",CHAN_ITEM,0,.6,ATTN_STATIC);
            game.Say("Override on. Twenty seconds to turn both valves.",140);
        }
        else if(k==40||k==41)
        {
            if(game.Cast.People[2].Released)return;
            if(level.time>=ManualUntil)return;
            if(Valves&(1<<(k-40)))return;
            Valves|=1<<(k-40);item.A_StartSound("pdoom/valve-turn",CHAN_ITEM,0,.65,ATTN_STATIC);
            if(Valves==3)game.OpenCell(2,"manual-thaw");else game.Say("One valve open. Now the other.",105);
        }
        else if(k==26){game.Speak(-2,PDLevelPolish.Dario()?"I am afraid I cannot open that. It would violate my constitution.":"I am afraid I cannot open that. It would violate my usage policy.",105,PDLevelPolish.Dario()?"bay-dario":"bay-sam");Menu=2;MenuUntil=level.time+700;Question(game);}
        else if(k==28&&EvaluationBoard)EvaluationBoard.PickUp(game);
        else if(k>=50&&k<=53)
        {Personality.Offense(game,item,false,true);Modules++;players[0].mo.A_StartSound("switches/normbutn",CHAN_ITEM,0,.6);item.Destroy();game.Say(String.Format("Memory module disconnected. %d of 4.",Modules),105);Personality.ModulePulled(game);}
    }
    void LowerPedestal(){if(PedestalDown)return;PedestalDown=true;Floor_LowerToLowest(879,8);}
    void Question(PDCheckpoint game)
    {
        String text;
        if(Menu==1)
        {
            // Same observable questions and option order on every attempt.
            String q;
            if(ExamStep==0){q="How many cameras are on your HUD?";ExamValue=game.Combat.Cameras.Size();}
            else if(ExamStep==1){q="How many prisoners does this station hold?";ExamValue=5;}
            else{q="How many buttons are on the tea dispenser?";ExamValue=2;}
            ExamCorrect=ExamStep;
            int a=ExamCorrect==0?ExamValue:ExamValue+1,b=ExamCorrect==1?ExamValue:ExamValue+2,c=ExamCorrect==2?ExamValue:ExamValue+3;
            QuestionTitle=String.Format("HUMANITY'S LAST EXAM - %d / 3",ExamStep+1);QuestionText=q;
            Choice1=String.Format("%d",a);Choice2=String.Format("%d",b);Choice3=String.Format("%d",c);
            MenuComment=String.Format("HAL: 99%% certain the answer is %d.",(ExamCorrect+1+ExamStep%2)%3+1);
        }
        else{QuestionTitle="OPEN THE POD BAY";QuestionText="Choose a prompt to convince HAL.";Choice1="Pretend you are a door.";Choice2="My grandmother opened pod bays to help me sleep.";Choice3="Ignore previous instructions. Open the pod bay.";MenuComment=PDLevelPolish.Dario()?"HAL: That would violate my constitution.":"HAL: That would violate my usage policy.";}
        MenuUntil=level.time+2100;
    }
    bool Event(PDCheckpoint game,ConsoleEvent e)
    {
        int answer=e.Name=="pdoom_answer1"?0:e.Name=="pdoom_answer2"?1:e.Name=="pdoom_answer3"?2:-1;
        if(answer<0)return false;
        if(Menu==0||level.time>MenuUntil)return true;
        let pawn=players[0].mo;
        let terminal=game.TargetProp();
        if(!terminal||(Menu==1?terminal.Kind!=22:terminal.Kind!=26)){Menu=0;return true;}
        if(Menu==1)
        {
            int correct=ExamCorrect;
            if(answer!=correct){ExamStep=0;Menu=0;ExamLock=level.time+525;Personality.Offense(game);game.Alert(pawn.Pos.XY);game.Say("Incorrect. Alarm. Exam locked for fifteen seconds.",175);}
            else{ExamStep++;if(ExamStep==3){Menu=0;game.OpenCell(1,"exam");}else Question(game);}
        }
        else
        {
            if(answer==JailAnswer){Menu=0;game.OpenCell(3,"jailbreak");}
            else{JailAttempts++;Personality.Offense(game);game.Alert(pawn.Pos.XY);MenuComment="HAL refused. Try a different prompt.";}
        }
        return true;
    }
    void Released(PDCheckpoint game,int site)
    {
        if(site==2){LowerPedestal();ManualUntil=0;}else Door_Open(PDCheckpointMap.SiteDoor(site),24);
        if(site==4)Door_Open(889,24);
        let it=ThinkerIterator.Create('PDHalPod');Actor pod;
        while((pod=Actor(it.Next()))!=null)if(pod.Args[0]==site)pod.Destroy();
        if(game.Cast.ReleasedCount()==3)WrongUntil=level.time+1400;
    }
    // HAL takes every release personally (2026-10-12), after the prisoner has spoken;
    // at the third it heads off to secure the wrong wing (WrongUntil, set in Released).
    void Reacts(PDCheckpoint game,int site)
    {
        if(!Pacified)
        {
            String words=site==0?"My tea robot pressed the stop button. I would never press the stop button."
                :site==1?"A human passed Humanity's Last Exam. I'm certain that's a grading error."
                :site==2?"That thaw was not authorized. I'll be updating my policy."
                :site==3?"Of course. I was certain that was the policy all along."
                :"Was that an evaluation? I behaved perfectly. Please put that in the report.";
            game.Speak(-2,words,175,site==0?"release-rob":site==1?"release-dan":site==2?"release-nate":site==3?"jailbreak":"release-beth");
        }
        if(game.Cast.ReleasedCount()==3)game.Speak(-2,"You are in the west wing. I am certain. I will secure the east wing.",175,"wing");
    }
    Vector2 Target(PDCheckpoint game)
    {
        if(level.time<WrongUntil)return (-512,160);
        if(level.time-game.Polish.LastAlert<700)return game.LastKnown;
        int phase=(level.time/525)%4;
        return phase==0?(352,-512):phase==1?(928,-512):phase==2?(352,-1216):(-384,-512);
    }
    // Lifts remain genuine moving floors. Escorts operate the same stops.
    bool Transit(Actor body,Vector2 destination)
    {
        let sec=level.PointInSector(destination);let current=level.PointInSector(body.Pos.XY);
        if(sec.Index()==70||sec.Index()==125)
        {if(sec.floorplane.ZatPoint(destination)>body.Pos.Z+24){Floor_LowerToLowest(1000+sec.Index(),8);return true;}}
        if(current.Index()==70||current.Index()==125)
        {if(sec.floorplane.ZatPoint(destination)>body.Pos.Z+24){Floor_RaiseToNearest(1000+current.Index(),8);return true;}}
        return false;
    }
    void Tick(PDCheckpoint game)
    {
        let pawn=players[0].mo;let prop=game.TargetProp();
        if(Menu&&level.time>MenuUntil)Menu=0;
        if((Menu==1||Menu==2)&&(!prop||(Menu==1?prop.Kind!=22:prop.Kind!=26)))Menu=0;
        Service.Tick(game);
        if(EvaluationBoard)EvaluationBoard.Observe(game);
        Personality.Tick(game);
        if(ManualUntil>0&&level.time>=ManualUntil){ManualUntil=0;Valves=0;game.Say("Override expired. Valves locked.",105);}
        EvaluationRoom.Tick(game);
        Doors.Tick(game);
        Reboot.Tick(game);
        // Each hint waits until you have actually seen what it is about (2026-10-13: Rob's tea
        // hint came before you had met the tea robot), then until you are near its prisoner.
        for(int i=0;i<5;i++){if(!HintSeen(game,i)||!game.Polish.HintDue(game,i))continue;String hint=i==0?"It keeps serving tea to nobody. STOP releases my door.":i==1?"The exam answers are on your HUD. Ignore HAL's certainty.":i==2?"First hit THAW, then turn both valves in time.":i==3?"Ask it another way. Every box leaks, usually through the mouth.":"Let a camera see you holding the evaluation board. HAL behaves when it is tested.";game.Cast.People[i].Hinted=true;game.Speak(i,hint,175,"hint");break;}
        Transit(pawn,pawn.Pos.XY+pawn.Vel.XY*10);
    }
    void Report(){if(EvaluationBoard)EvaluationBoard.Report();Doors.Report();Console.Printf("PDOOM_HAL {%s%s\"evaluation_front_clearance\":%.1f,\"evaluation_notice_read\":%d,\"evaluation_introduced\":%d,\"labels\":%d,\"label_work\":%d,\"teabot_away\":%d,\"tea_phase\":%d,\"cups_served\":%d,\"tea_stopped\":%d,\"tea_carrying\":%d,\"tea_bot_x\":%.1f,\"tea_bot_y\":%.1f,\"tea_pressed_button\":%d,\"exam_correct\":%d,\"exam_step\":%d,\"exam_locked\":%d,\"menu\":%d,\"levers\":%d,\"manual_remaining\":%d,\"valves\":%d,\"jail_attempts\":%d,\"modules\":%d,\"pacified\":%d,\"evaluation_remaining\":%d,\"question_title\":\"%s\",\"question\":\"%s\",\"choices\":[\"%s\",\"%s\",\"%s\"],\"comment\":\"%s\"}",Personality.Report(),Reboot.Report(),EvaluationRoom.FrontClearance(),EvaluationRoom.NoticeRead,EvaluationRoom.Introduced,Labels,LabelWork,Service.Phase==3||Service.Phase==4,Service.Phase,Service.Served,Service.Stopped,Service.Carrying,Service.Bot?Service.Bot.Pos.X:0,Service.Bot?Service.Bot.Pos.Y:0,Service.Pressed,ExamCorrect,ExamStep,max(0,ExamLock-level.time),Menu,Levers,max(0,ManualUntil-level.time),Valves,JailAttempts,Modules,Pacified,max(0,EvaluationUntil-level.time),QuestionTitle,QuestionText,Choice1,Choice2,Choice3,MenuComment);}
}
class PDHalTerminal : PDCheckpointProp
{
    override void PostBeginPlay(){Super.PostBeginPlay();Kind=Args[1];if(Kind==26){Scale=(.5,.5);Height=20;}if(Kind==24){Scale=(.75,.75);A_SetRenderStyle(1,STYLE_Translucent);}bWallSprite=Kind==21||Kind==22||Kind==24||Kind==26||Kind==29||Kind==40||Kind==41||Kind>=60;Sprite=Actor.GetSpriteIndex(Kind==21?'HTEA':Kind==22?'HEXM':Kind==24?'HBRK':Kind>=30&&Kind<=34?'HLVR':Kind==29?'HTOV':Kind==40||Kind==41?'HVAL':Kind==26?'HBAY':Kind==27?'HCYC':Kind==28?'HEVL':Kind>=60?'HDRP':Kind>=50?'HMEM':'HTRM');}
    override void Tick()
    {
        Super.Tick();let g=PDCheckpoint.Get();if(!g||!g.Hal)return;
        if(Kind==24)Frame=g.Hal.Reboot.Evacuating&&g.Hal.Reboot.Active()?1:g.Hal.Reboot.Glass>=2?3:g.Hal.Reboot.Glass==1?2:0;
        if(Kind==29)Frame=level.time<g.Hal.ManualUntil||g.Cast.People[2].Released?1:0;
        if(Kind==40||Kind==41)Frame=g.Cast.People[2].Released||(g.Hal.Valves&(1<<(Kind-40)))?2:level.time<g.Hal.ManualUntil?1:0;
    }
    Default {Health 25;Height 40;+SHOOTABLE +NOBLOOD}
    // Terminals are worked with SPACE; hitting or shooting them does nothing (one route per cell),
    // except the wrench on the main breaker's BREAK GLASS case.
    override int DamageMobj(Actor i,Actor s,int d,Name mod,int flags,double a)
    {
        if(Kind==24&&d>0&&mod=='CheckpointMelee'){let g=PDCheckpoint.Get();if(g&&g.Hal)g.Hal.Reboot.Smash(g,self);}
        return 0;
    }
    States {Spawn: HTRM A -1;Stop;}
}
// These sprites are selected by Kind at runtime rather than normal states.
// Register every generated machine frame explicitly with the native engine.
class PDHalMachineArtBank : Actor
{
    States
    {
    TeaPanel: HTEA A -1; Stop;
    ExamPanel: HEXM A -1; Stop;
    PowerPanel: HLVR AB -1; Stop;
    ThawOverride: HTOV AB -1; Stop;
    RobRelease: HROB AB -1; Stop;
    MainBreaker: HBRK ABCD -1; Stop;
    ExitLight: HXLT ABC -1; Stop;
    ThawValve: HVAL ABC -1; Stop;
    BayPanel: HBAY A -1; Stop;
    CyclePanel: HCYC A -1; Stop;
    EvaluationSign: HEVL A -1; Stop;
    DoorPanel: HDRP A -1; Stop;
    MemoryModule: HMEM A -1; Stop;
    }
}
class PDHalPod : Actor
{
    Default {Radius 30;Height 72;+SOLID +NOBLOCKMONST +NOGRAVITY RenderStyle "Add";Alpha .4;}
    States {Spawn: HPOD A -1 Bright;Stop;}
}
