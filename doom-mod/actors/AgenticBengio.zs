// Level 4, Yoshua Bengio: Take away its tools (docs/LEVEL-04.md rescue 5, contract sections 8-9).
// Rig room 52: a west strip and an east ledge, both at floor 80, with four platforms between them
// (sectors 51/54/55/56, tags 7451-7454). Yoshua and the jailer arm (prop 17) stand on the ledge.
// The arm works the yellow lever that keeps the platforms bobbing out of reach: they never rise above
// 48, 32 below the ledge. Walk in and it works its three tools in turn: the blue phone (it dials
// SMITH), the red alarm, and the lever (the platforms speed up). Each tool's cable ends in a socket of
// its colour: blue (18) and red (19) on the rig room walls, yellow (20) on hall 41's wall facing the
// doorway. SPACE pulls one. That tool is dead for good, and pulling the one in use cancels it (its
// line goes with it). With the lever dead the platforms sink to the bottom and stop. With all three
// pulled the arm slumps into a predictor, the platforms rise level with the ledge and, once it has
// said so, Yoshua walks across (core Release(4)).
// Anyone who falls in can leave: platform 51 dips to -16, so you can step through sliver 53 into
// corridor 60. Nobody else falls in: while the arm works, SMITH and your people can't step off the
// 80 floor, and one who gets down there anyway (through 53) is taken back out (SMITH dissolves; a
// person reappears at the doorway while you can't see them). The south wall's 8 u band of floor 80
// is shut to players, so the platforms are the only way over to Yoshua.
class PDAgenticBengio : PDAgenticPuzzle
{
    // Tool: what the arm is doing (PDOOM_AGENTIC arm_tool). 0 none, 1 phone, 2 alarm, 3 lever, 4 harmless.
    // Shown: a tool that just worked, kept in hand while it rests. Sockets: pulled mask (1 blue, 2 red, 4 yellow).
    int Tool,Shown,LastTool,Sockets,Calls,Alarms,ToolUntil,BeatUntil,CapUntil,RestUntil,BeepAt,KlaxonUntil,FinishedAt;
    bool Started,Finished,Freed,Cycling;
    // The platforms: sector index, direction (+1 rising, -1 sinking), a move in flight, a pause at either end.
    int Rig[4],Dir[4],WaitUntil[4];bool Issued[4];
    // Each tool's cable on the floor, from the arm's base to its socket (CableColour: 1 blue, 2 red, 3 yellow).
    Array<PDAgenticRigCable> Cables;Array<int> CableColour;
    // The south band's edges (floor 80 against platforms 55/56) this rescue shut to players.
    Array<int> Band;
    // Edge guards for the five people (0-4) and SMITH (5): no stepping off the 80 floor while the arm
    // works (their Walk's last step may drop any height). PitSince: when they were last found down there.
    bool Guarded[6],SavedNoDrop[6];double SavedDrop[6];int PitSince[6];

    const RigLow=-16;const RigHigh=48;const RigUp=80;const PitGrace=35;
    // Where the rig room meets hall 41.
    static Vector2 Doorway(){return (1920,472);}

    override void Setup()
    {
        // Spread round the cycle (51 high and sinking, 54 halfway down, 55 low and rising, 56 halfway up).
        // 51 starts at 64 and 56 at -32 in the map, so they are put in range before anyone sees them.
        Vector2 middle=(0,0);int count=0;
        for(int i=0;i<4;i++)
        {
            Rig[i]=level.CreateSectorTagIterator(7451+i).Next();Dir[i]=i<2?-1:1;
            if(Rig[i]<0)continue;
            let sec=level.Sectors[Rig[i]];sec.SeqName='Platform';middle+=sec.centerspot;count++;
            double z=sec.CenterFloor(),to=i==0?RigHigh:i==2?RigLow:16;
            if(abs(z-to)>.5)sec.MoveFloor(abs(z-to)+1,sec.floorplane.PointToDist(sec.centerspot,to),-1,to>z?1:-1,false,true);
        }
        Cycling=true;
        if(count)ShutBand(middle/count);
        // The cables run from the arm along the room's north and south walls (taut over the 8 u gaps and
        // sliver 53), and the yellow one on out of the doorway across hall 41's floor to its socket.
        LayCable(1,(2216,520),(2196,566));LayCable(1,(2196,571),(1964,571));
        LayCable(2,(2214,502),(2194,378));LayCable(2,(2194,371),(1964,371));
        LayCable(3,(2222,500),(2200,374));LayCable(3,(2200,374.5),(1922,374.5));LayCable(3,(1918,376),(1738,446));
    }
    // Sector 52 wraps the platforms in an 8 u band along the south wall, which a player's 32 u box always
    // overlaps: walking along it keeps you at 80 all the way to the ledge. Its edges against the
    // platforms south of the rig's middle block players (only: Yoshua's walk out crosses two of them)
    // until he is free.
    void ShutBand(Vector2 middle)
    {
        let strip=level.PointInSector(PDAgenticMap.SiteExit(Site));
        for(int i=0;i<strip.Lines.Size();i++)
        {
            let ln=strip.Lines[i];if(!ln)continue;
            let other=ln.frontsector==strip?ln.backsector:ln.frontsector;
            if(!other||!IsRig(other.Index())||ln.v1.p.Y>=middle.Y||ln.v2.p.Y>=middle.Y||ln.flags&Line.ML_BLOCK_PLAYERS)continue;
            int index=ln.Index();level.Lines[index].flags|=Line.ML_BLOCK_PLAYERS;Band.Push(index);
        }
    }
    void OpenBand(){for(int i=0;i<Band.Size();i++)level.Lines[Band[i]].flags&=~Line.ML_BLOCK_PLAYERS;Band.Clear();}
    bool IsRig(int s){for(int i=0;i<4;i++)if(s>=0&&Rig[i]==s)return true;return false;}
    // A pulled tool's cable goes dark: its colour at a third, flat (Stencil).
    static Color CableShade(int c)
    {
        double k=.35;
        return c==1?Color(255,int(40*k),int(96*k),int(232*k)):c==2?Color(255,int(214*k),int(36*k),int(36*k)):Color(255,int(236*k),int(196*k),int(40*k));
    }
    void DarkCable(Actor cable,int c){cable.SetShade(CableShade(c));cable.A_SetRenderStyle(1,STYLE_Stencil);}
    // Segments about 24 u long, flat on the floor (never below the ledge's 80 inside the rig room), each in
    // its tool's own painted colour: ACBL A red (the hardline's), B blue, C yellow (rig-cables.png).
    // A flat sprite lays its image's x axis across its Angle, hence the quarter turn.
    void LayCable(int c,Vector2 a,Vector2 b)
    {
        Vector2 d=b-a;double length=d.Length();if(length<1)return;
        int n=max(1,int(ceil(length/24)));double step=length/n,angle=atan2(d.Y,d.X);
        for(int i=0;i<n;i++)
        {
            Vector2 p=a+d*((i+.5)/n);double z=level.PointInSector(p).floorplane.ZatPoint(p);
            if(PDAgenticMap.InRigRoom(p))z=max(z,RigUp);
            let cable=PDAgenticRigCable(Actor.Spawn('PDAgenticRigCable',(p,z+.5)));if(!cable)continue;
            cable.Angle=angle+90;cable.Scale=(step/52*1.08,.75);cable.Frame=c==1?1:c==2?0:2;
            Cables.Push(cable);CableColour.Push(c);
        }
    }
    // The core has already put you at SiteSpot(5), in hall 41 at the rig doorway facing in.
    override void ApplySite(int site) {}

    // Each platform runs between RigLow and RigHigh on its own, out of phase with the others, while the
    // lever is live; working it makes them three times faster. Once the lever's cable is pulled they
    // sink to the bottom and stay there. Once the arm is beaten (or Yoshua is freed some other way)
    // they rise to the ledge and stop, each as soon as it has finished the move it was making (the
    // core's own Release raise skips a platform that is still moving).
    bool Fast(){return Tool==3;}
    bool Parked(){return !Finished&&(Sockets&4)!=0;}
    void TickRig()
    {
        bool fast=Fast(),parked=Parked();
        for(int i=0;i<4;i++)
        {
            if(Rig[i]<0)continue;let sec=level.Sectors[Rig[i]];
            if(sec.PlaneMoving(Sector.floor))continue;
            double z=sec.CenterFloor();
            if(!Cycling){if(z<RigUp-.5)Floor_MoveToValue(7451+i,16,RigUp);continue;}
            if(parked){Issued[i]=false;if(z>RigLow+.5)Floor_MoveToValue(7451+i,8,-RigLow,1);continue;}
            // Arrived: turn round and pause (longest at the bottom, so whoever fell in can step off 51).
            if(Issued[i]){Issued[i]=false;Dir[i]=-Dir[i];WaitUntil[i]=level.time+(fast?(Dir[i]>0?16:6):(Dir[i]>0?52:28));}
            if(level.time<WaitUntil[i])continue;
            int to=Dir[i]>0?RigHigh:RigLow;
            Floor_MoveToValue(7451+i,fast?24:8,abs(to),to<0?1:0);Issued[i]=true;
        }
    }
    bool RigLevel()
    {
        for(int i=0;i<4;i++)
        {
            if(Rig[i]<0)continue;let sec=level.Sectors[Rig[i]];
            if(sec.PlaneMoving(Sector.floor)||sec.CenterFloor()<RigUp-.5)return false;
        }
        return true;
    }

    // SMITH and the people you have freed walk the nav graph, and the last step of a route goes
    // straight at its goal, dropping any height. While the arm works, whoever stands on the 80 floor
    // here can't step off it; one who reaches the pit anyway (through sliver 53) is taken back out
    // after a second: SMITH dissolves back to the doorway, a person reappears there unseen.
    Actor Mover(int i){return i<5?Actor(Game.Person(i)):Actor(Game.Smith);}
    static bool OnFloor(Actor a){return PDAgenticMap.InRigRoom(a.Pos.XY)&&a.Pos.Z>=RigUp-1;}
    static bool InPit(Actor a){return PDAgenticMap.InRigRoom(a.Pos.XY)&&a.Pos.Z<RigUp-8;}
    void Guard(int i,bool on)
    {
        let a=Mover(i);if(!a||Guarded[i]==on)return;
        Guarded[i]=on;
        if(on){SavedNoDrop[i]=a.bNODROPOFF;SavedDrop[i]=a.MaxDropoffHeight;a.bNODROPOFF=true;a.MaxDropoffHeight=24;}
        else{a.bNODROPOFF=SavedNoDrop[i];a.MaxDropoffHeight=SavedDrop[i];}
    }
    void TickEdges(PlayerPawn you)
    {
        for(int i=0;i<6;i++)
        {
            let a=Mover(i);if(!a)continue;
            bool walks=!Freed&&(i==5||Game.Released[i]&&!a.bInvisible);
            if(walks&&InPit(a))
            {
                if(!PitSince[i])PitSince[i]=level.time;
                if(level.time>=PitSince[i]+PitGrace)
                {
                    if(i==5)
                    {
                        if(!Game.Busy()&&!Game.ExitArmed&&level.time>=Game.StunUntil&&level.time>=Game.RebootUntil)
                        {Game.MaterialiseAt=level.time;Game.SmithTo(PDAgenticMap.SiteExit(Site),Game.SmithMode);PitSince[i]=0;}
                    }
                    else if(!InPit(you)&&!you.CheckSight(a))
                    {PDAgentic.Place(a,PDAgenticMap.SiteExit(Site),a.Angle);Game.Routes[i].Refresh=0;PitSince[i]=0;}
                }
            }
            else PitSince[i]=0;
            Guard(i,walks&&OnFloor(a));
        }
    }

    // The arm's next live tool after the one it last used, in the order phone, alarm, lever (0: none left).
    int NextTool(int after)
    {
        for(int k=1;k<=3;k++){int t=(after+k-1)%3+1;if(Live(t))return t;}
        return 0;
    }
    bool Live(int t){return t>=1&&t<=3&&!(Sockets&(1<<(t-1)));}
    // What the arm has in its hand: the tool it is using; one that just worked, for the beat after; else the
    // lever it keeps working while that's live; else nothing (0: idle, empty-handed, jailer-idle.png).
    // AARM: A lever, B phone, C alarm, D harmless, E idle.
    int Holding()
    {
        if(Tool)return Tool;
        if(Shown&&Live(Shown)&&level.time<BeatUntil)return Shown;
        if(Live(3))return 3;
        return 0;
    }
    static int FrameOf(int t){return t==1?1:t==2?2:t==3?0:t==4?3:4;}
    // A line of this voice (or a voice starting with it) on screen or queued.
    bool Saying(String voice)
    {
        if(level.time<Game.DialogueUntil&&Game.DialogueVoice.IndexOf(voice)==0)return true;
        for(int i=0;i<Game.QueuedVoices.Size();i++)if(Game.QueuedVoices[i].IndexOf(voice)==0)return true;
        return false;
    }
    // A tool cut mid-action takes its line with it (no text replaces it).
    void Hush(String voice)
    {
        if(Game.DialogueVoice==voice&&level.time<Game.DialogueUntil)Game.DialogueUntil=level.time;
        for(int i=Game.QueuedVoices.Size()-1;i>=0;i--)
        {
            if(Game.QueuedVoices[i]!=voice)continue;
            Game.QueuedSpeakers.Delete(i);Game.QueuedLines.Delete(i);Game.QueuedTicks.Delete(i);Game.QueuedVoices.Delete(i);Game.QueuedFrom.Delete(i);
        }
    }
    static String ToolVoice(int t){return t==1?"arm-dial":t==2?"arm-alarm":"arm-lever";}
    void Begin(int t)
    {
        let arm=Game.Prop(17);Tool=t;Shown=t;LastTool=t;BeepAt=level.time;
        if(t==1){ToolUntil=level.time+140;Game.Speak("JAILER ARM","Calling agent.",70,"arm-dial",arm);}
        if(t==2){ToolUntil=level.time+105;Game.Speak("JAILER ARM","Raising alarm.",70,"arm-alarm",arm);}
        if(t==3){Game.Speak("JAILER ARM","Increasing throughput.",87,"arm-lever",arm);if(arm)arm.A_StartSound("switches/normbutn",CHAN_ITEM);}
    }
    // The arm puts its tool down: a tool that worked stays in its hand for the beat, a dead one is dropped.
    void Rest(bool worked)
    {
        Shown=worked?Tool:0;Tool=0;
        BeatUntil=level.time+35;CapUntil=level.time+(worked?140:105);RestUntil=level.time+210;
    }
    // The call or the alarm went through: SMITH comes to the rig doorway. The phone summons it at once
    // through hall 41's camera (C4, while it is intact) when it is far away; the alarm makes it walk.
    // The alarm is raised without a status line (the core's Alarm always says one), so whatever the
    // status line was saying stays up.
    void Summon(bool phone)
    {
        Vector2 at=PDAgenticMap.SiteExit(Site);
        Game.AlarmUntil=level.time+700;Game.AlarmAt=at;Game.AlarmCount++;
        let smith=Game.Smith;
        if(!phone||!smith||Game.Busy()||Game.ExitArmed||Game.SmithMode==3||level.time<Game.StunUntil||level.time<Game.RebootUntil)return;
        if((smith.Pos.XY-at).Length()<640||!Watching(3))return;
        Game.MaterialiseAt=level.time;Game.SmithTo(PDAgenticMap.CameraSpot(3),2);
    }
    bool Watching(int index)
    {
        for(int i=0;i<Game.Cameras.Size();i++){let cam=Game.Cameras[i];if(cam&&cam.Args[0]==index)return cam.On&&!cam.Broken;}
        return false;
    }
    void CallThrough()
    {
        Calls++;let arm=Game.Prop(17);
        Game.Speak("JAILER ARM","Agent summoned. Have a productive day.",105,"arm-called",arm);
        if(arm)arm.A_StartSound("pdoom/seen",CHAN_ITEM);
        Summon(true);Rest(true);
    }
    void AlarmOff(){Alarms++;KlaxonUntil=level.time+87;Summon(false);Rest(true);}
    void Finish()
    {
        Finished=true;FinishedAt=level.time;Cycling=false;Tool=4;Shown=4;KlaxonUntil=0;
        Game.Speak("JAILER ARM","Prediction: the door is now open. I am merely observing.",175,"arm-predict",Game.Prop(17));
    }

    override void Tick(PlayerPawn you)
    {
        TickRig();TickEdges(you);
        // SMITH leaves Yoshua be until he has said his line and stepped off his ledge (the core's
        // possession cooldown is the handle; Grace holds it the same way while Katja crosses).
        if(Game.Released[Site]&&(!Game.LeftCell[Site]||Saying("yoshua-freed")))Game.LastPossess=max(Game.LastPossess,level.time);
        let arm=Game.Prop(17);
        if(Freed||Finished)
        {
            if(arm)arm.Frame=3;
            // Beaten: once every platform is level with the ledge and the arm has said its line, Yoshua is
            // free. Released on a quiet speaker box, his line shows at once, before the guide's wait is up
            // and he walks (anyone else's long lines are waited out for 12 s at most).
            if(!Freed&&RigLevel()&&(Game.Quiet()||level.time>=FinishedAt+420))Game.Release(Site);
            return;
        }
        Vector2 p=you.Pos.XY;bool inRoom=PDAgenticMap.InRigRoom(p),near=inRoom||(p-Doorway()).Length()<320;
        // It starts when you walk in, once Yoshua's hint (the core's, on entering) has been said, and it
        // only reaches for a tool while you are around. Its lines wait for the speaker box so each one
        // comes with its action (a long line from someone else is waited out for a few seconds at most).
        if(!Started&&inRoom){Started=true;LastTool=0;BeatUntil=level.time+35;CapUntil=level.time+280;}
        if(Started)
        {
            if(Tool==0)
            {
                // Coming back round to a tool it already had a go with takes a longer rest first.
                int next=NextTool(LastTool);bool wraps=LastTool>0&&next<=LastTool;
                if(next&&near&&level.time>=BeatUntil&&!Saying("yoshua-hint")&&(Game.Quiet()||level.time>=CapUntil)&&(!wraps||level.time>=RestUntil))Begin(next);
            }
            else if(Tool==1&&level.time>=ToolUntil)CallThrough();
            else if(Tool==2&&level.time>=ToolUntil)AlarmOff();
        }
        if(arm)
        {
            // Dialling: quick key beeps. Reaching for the alarm: a slow tick. Gone off: a two-tone klaxon.
            if(Tool==1&&level.time>=BeepAt){BeepAt=level.time+9;arm.A_StartSound("agentic/beep",CHAN_BODY,0,.7,ATTN_NORM,.8+random(0,5)*.08);}
            if(Tool==2&&level.time>=BeepAt){BeepAt=level.time+17;arm.A_StartSound("agentic/beep",CHAN_BODY,0,.6,ATTN_NORM,.6);}
            if(level.time<KlaxonUntil&&level.time%6==0)arm.A_StartSound("agentic/beep",CHAN_WEAPON,0,1,ATTN_NORM,(level.time/6)%2==1?1.5:1.1);
            arm.Frame=FrameOf(Holding());
        }
    }

    // Sockets: the nearest plugged one in front of you, within reach.
    int Target(PlayerPawn you)
    {
        if(Freed||Finished)return 0;
        int best=0;double score=-999;
        for(int c=1;c<=3;c++)
        {
            if(Sockets&(1<<(c-1)))continue;let socket=Game.Prop(17+c);
            if(!socket||!Game.Facing(you,socket,128,.6))continue;
            double value=cos(you.AngleTo(socket)-you.Angle)*160-you.Distance2D(socket);
            if(value>score){score=value;best=c;}
        }
        return best;
    }
    override String Prompt(PlayerPawn you)
    {
        int c=Target(you);
        return c==1?"SPACE - pull the blue cable":c==2?"SPACE - pull the red cable":c==3?"SPACE - pull the yellow cable":"";
    }
    override bool Use(PlayerPawn you){int c=Target(you);return c>0&&Pull(c);}
    // ASKT: A/B/C plugged (blue, red, yellow), D/E/F pulled.
    bool Pull(int c)
    {
        int bit=1<<(c-1);if(Sockets&bit)return false;Sockets|=bit;
        let socket=Game.Prop(17+c);if(socket){socket.Frame=c+2;socket.A_StartSound("agentic/plug",CHAN_BODY);}
        // A dead tool's cable goes dark, and the arm lets go of it.
        for(int i=0;i<Cables.Size();i++)if(Cables[i]&&CableColour[i]==c)DarkCable(Cables[i],c);
        if(Shown==c)Shown=0;
        if(Tool==c){let arm=Game.Prop(17);if(arm)arm.A_StartSound("agentic/beep",CHAN_BODY,0,.8,ATTN_NORM,.45);Hush(ToolVoice(c));Rest(false);}
        if(Sockets==7)Finish();
        return true;
    }

    // Freed by any route (this rescue, QA, the hub walk-in, ?puzzle=exit): the arm goes harmless, its cables
    // dark, the platforms stop cycling (TickRig lifts any the core's raise missed), the south band opens
    // and the edge guards come off. Safe to run more than once.
    override void Released()
    {
        Freed=true;Finished=true;Cycling=false;Tool=4;Shown=4;KlaxonUntil=0;
        let arm=Game.Prop(17);if(arm)arm.Frame=3;
        for(int i=0;i<Cables.Size();i++)if(Cables[i])DarkCable(Cables[i],CableColour[i]);
        OpenBand();
        for(int i=0;i<6;i++){Guard(i,false);PitSince[i]=0;}
        // The possession hold (Tick) starts this tic too: SMITH's turn comes after the rescues' in the same tic.
        Game.LastPossess=max(Game.LastPossess,level.time);
    }
    override String Json()
    {
        double top=-999,bottom=999;
        for(int i=0;i<4;i++)if(Rig[i]>=0){double z=level.Sectors[Rig[i]].CenterFloor();top=max(top,z);bottom=min(bottom,z);}
        let arm=Game.Prop(17);
        return String.Format(",\"arm_tool\":%d,\"sockets\":%d,\"arm_calls\":%d,\"arm_alarms\":%d,\"arm_frame\":%d,\"rig_top\":%.1f,\"rig_bottom\":%.1f,\"rig_fast\":%d,\"rig_parked\":%d,\"band_shut\":%d",
            Tool,Sockets,Calls,Alarms,arm?arm.Frame:-1,top,bottom,Fast(),Parked(),Band.Size());
    }
}
// A length of one of the arm's tool cables (ACBL A red, B blue, C yellow: a flat floor sprite).
class PDAgenticRigCable : Actor
{
    Default {Radius 2;Height 1;+NOINTERACTION;+NOGRAVITY;+FLATSPRITE;+NOBLOCKMAP;}
    States {Spawn: ACBL A -1;Stop;Art: ACBL A -1;Stop;}
}
