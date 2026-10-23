// Level 4 rescue 3 (site 2), Daniel Kokotajlo: Race or Slowdown (docs/LEVEL-04.md).
// The harvester: five crushers (tag 7416: sectors 2, 21, 23, 46, 48) run the corridor south of room 3.
// Time them (they fall slowly, pause at the top, and a mistimed step costs 10 health a bite), take
// passage 28 into dark room 26 and step on lit pad 27: the native W1 line 1363 opens bay door 30 (tag
// 7430). Daniel's harvest pod stands in bay 29 between two panels:
//   SIGN       the pod opens now; the race ending (SMITH x1.2 for the rest of the level).
//   DON'T SIGN three times: the equity offer climbs ($1M, $10M, $100M) with a chime and an alarm at
//              the bay. The first chime brings SMITH out of the intact camera nearest the harvester (C8,
//              else C1); the third starts a 30 s countdown that only runs while you stand in the bay
//              (SLOWDOWN IN n, or SLOWDOWN PAUSED when you step out); then SMITH gives up and the pod
//              opens: the slowdown ending (x0.8).
// Releasing him stops the crushers for good, fully raised, so he can follow you out.
//
// The crushers are driven from here (Sector.MoveCeiling every tic). Each one also carries an engine
// ceiling mover held in stasis from load, for the engine's ceiling interpolation. A crusher lower than
// your head is a wall to you, as in Doom: invisible posts along its edges (PDKokotajloGate) stop you, and
// the auto-crouch (Actors.zs ducks you into any space you only fit crouched) is stood back up there, so it
// can't pull you under one that is coming down. Each crusher stops on whoever is under it (bites the
// player; only rests on SMITH or a person, who aren't shootable), and keeps its own original top so the
// release leaves them exactly as the map drew them.
//
// SMITH can't plan through the corridor while it runs (the core shuts those nav cells until the release).
// While he is outside, an alarm or hunt that points into the harvester is pointed at its nearest mouth
// instead, so the core keeps walking him (its cameras, voice and possession stay its own). At the mouth
// and inside, this rescue walks him (SmithBusy) on its own nav copy that includes the corridor, waiting at
// each crusher's edge and dashing under it in its open window, like the player has to. A camera that sees
// you while this rescue has him still brings him (DriveSmith hands that sighting to the core).

// Where a crusher's grinding comes from (Doom's stone-mover loop, heard only in and near the corridor).
class PDKokotajloHum : Actor
{
    Default {Radius 1;Height 1;+NOINTERACTION;+NOGRAVITY;+NOBLOCKMAP;+DONTSPLASH;}
    States {Spawn: TNT1 A -1;Stop;}
}

// A post at a crusher's edge: solid to the player only, and only while that crusher is lower than their
// head and they aren't already under it (Shut). Not shootable, so the crusher itself passes it by.
class PDKokotajloGate : Actor
{
    PDAgenticKokotajlo Rescue;int Index;
    Default {Radius 8;Height 64;+SOLID;+NOGRAVITY;+DONTSPLASH;+NOBLOOD;+NOTAUTOAIMED;}
    override bool CanCollideWith(Actor other,bool passive){return Rescue&&other is 'PlayerPawn'&&Rescue.Shut(Index,PlayerPawn(other));}
    States {Spawn: TNT1 A -1;Stop;}
}

// Ticks before SMITH's own Tick (STAT_USER runs before actors): while this rescue walks him, the core's
// TickSmith resets his pose to his mode's, so his grab and possess poses are put back here.
class PDKokotajloPose : Thinker
{
    PDAgenticKokotajlo Rescue;
    override void Tick(){if(Rescue)Rescue.ApplyPose();}
}

class PDAgenticKokotajlo : PDAgenticPuzzle
{
    const DownSpeed=1.0;        // Doom's slow crusher
    const UpSpeed=2.0;
    const TopDwell=24;          // a beat at the top: the window to go
    const BottomDwell=8;
    const RaiseSpeed=4.0;       // after the release, up to their tops and stopped
    const CrushDamage=10;
    const CrushEvery=12;
    const CountdownTics=1050;   // 30 s of holding the bay
    const PanelReach=100;
    const PanelCos=.85;
    const Sprint=5.0;           // SMITH dashing under a crusher
    const MouthReach=96;        // SMITH this near a mouth is this rescue's to walk in
    const SummonRange=400;      // only a camera this near a mouth can bring him for the NDA

    // The crushers, west to east.
    Array<int> Crushers,Dir,DwellUntil;
    Array<double> Top,Bottom,FloorZ,X0,Y0,X1,Y1;
    Array<PDKokotajloHum> Hums;
    bool Stopped,CrushedYou;int HurtAt;

    // The NDA.
    int Refusals,NextPanelAt,CountLeft,SaidSecond,PausedTics,Summoned,GaveUp;
    bool Counting,Held,PodOpen,StimMoved;
    String Shown;int ShownAt;
    int BayDoor;

    // SMITH, while this rescue walks him (his own BFS: the core's links plus the corridor's), and the
    // core's alarm or hunt target while it is pointed at a mouth (restored when he gets there).
    bool Driving,AlarmSteered,SeenSteered,HaveMouth;
    Vector2 RealAlarm,SteerAlarm,RealSeen,SteerSeen,LastMouth;
    int SpotSeen,WantPose;
    Array<int> Saved,Prev,Queue,Path;
    int PathIndex,GoalNode,Refresh;
    PDKokotajloPose Poser;


    // ---- setup ---------------------------------------------------------------------------------

    override void Setup()
    {
        WantPose=-1;
        // The crushers' boxes come from their own lines; their tops are the map's ceilings.
        let it=level.CreateSectorTagIterator(7416);int s;
        while((s=it.Next())>=0)
        {
            let sec=level.Sectors[s];
            double lx=1e9,ly=1e9,hx=-1e9,hy=-1e9;
            for(int i=0;i<sec.Lines.Size();i++)
            {
                let ln=sec.Lines[i];
                for(int v=0;v<2;v++)
                {
                    Vector2 p=v?ln.v2.p:ln.v1.p;
                    lx=min(lx,p.X);ly=min(ly,p.Y);hx=max(hx,p.X);hy=max(hy,p.Y);
                }
            }
            // West to east.
            int at=0;while(at<Crushers.Size()&&X0[at]<lx)at++;
            double f=sec.floorplane.ZatPoint(sec.centerspot),c=sec.ceilingplane.ZatPoint(sec.centerspot);
            Crushers.Insert(at,s);X0.Insert(at,lx);Y0.Insert(at,ly);X1.Insert(at,hx);Y1.Insert(at,hy);
            FloorZ.Insert(at,f);Top.Insert(at,c);Bottom.Insert(at,f+8);Dir.Insert(at,-1);DwellUntil.Insert(at,0);
        }
        // An engine crusher on each, put straight into stasis (it never moves anything itself): the engine's
        // smooth ceiling for the renderer (Ceiling_CrushStop remove 1 = stasis).
        Ceiling_CrushAndRaise(7416,8,0);
        Ceiling_CrushStop(7416,1);
        // Posts along every edge you can walk in from (the corridor's y -448..-256; crusher 23 also from
        // passage 28 to its north).
        for(int i=0;i<Crushers.Size();i++)
        {
            for(double y=-440;y<=-264;y+=16){Gate(i,(X0[i]+8,y));Gate(i,(X1[i]-8,y));}
            if(Y1[i]<-248)for(double x=X0[i]+24;x<=X1[i]-24;x+=16)Gate(i,(x,Y1[i]-8));
        }
        // Staggered from the start, so the corridor is already working when you first look down it.
        for(int i=0;i<Crushers.Size();i++)
        {
            let sec=level.Sectors[Crushers[i]];
            double phase=i==1?.55:i==2?.3:i==3?.8:i==4?.15:0;
            double travel=Top[i]-Bottom[i],t=phase*2*travel,want;
            if(t<travel){want=Top[i]-t;Dir[i]=-1;}else{want=Bottom[i]+(t-travel);Dir[i]=1;}
            if(want<Top[i]-.5)sec.MoveCeiling(1024,want,-1,-1,false);
            Vector3 spot=(sec.centerspot.X,sec.centerspot.Y,want-8);
            Hums.Push(PDKokotajloHum(Actor.Spawn('PDKokotajloHum',spot)));
        }
        let doors=level.CreateSectorTagIterator(7430);BayDoor=doors.Next();
        // The core shuts the Crusher and Bay cells after this; keep their open links for SMITH's own walk.
        int total=Game.Links.Size();Saved.Resize(total);for(int n=0;n<total;n++)Saved[n]=0;
        Array<int> cells,bits;
        Vector2 a=PDAgenticMap.CrusherZone0(),b=PDAgenticMap.CrusherZone1();Game.CollectNav(cells,bits,a.X,a.Y,b.X,b.Y);
        a=PDAgenticMap.BayZone0();b=PDAgenticMap.BayZone1();Game.CollectNav(cells,bits,a.X,a.Y,b.X,b.Y);
        for(int i=0;i<cells.Size();i++)Saved[cells[i]]=bits[i];
        // Room 37's stimpack sits behind door 38, which never opens: it waits by the lit pad instead.
        let stims=ThinkerIterator.Create('Stimpack');Actor stim;
        while((stim=Actor(stims.Next()))!=null)
        {
            // The map builder already puts it there; an older map still has it behind door 38.
            if((stim.Pos.XY-(1040,72)).Length()<24){StimMoved=true;continue;}
            if((stim.Pos.XY-(1180,0)).Length()>24)continue;
            Vector2 p=(1040,72);stim.SetOrigin((p,level.PointInSector(p).floorplane.ZatPoint(p)),false);stim.ClearInterpolation();StimMoved=true;
        }
        Poser=PDKokotajloPose(new('PDKokotajloPose'));
        if(Poser){Poser.Rescue=self;Poser.ChangeStatNum(Thinker.STAT_USER);}
    }
    // The core put you at SiteSpot(3); a step further back, so the first frame shows the alcove and the
    // first crusher working rather than crusher 2's face.
    override void ApplySite(int site)
    {
        let you=Game.Pawn();if(site!=3||!you)return;
        PDAgentic.Place(you,(208,-352),0);
    }

    // ---- the crushers --------------------------------------------------------------------------

    double Ceil(int i){let sec=level.Sectors[Crushers[i]];return sec.ceilingplane.ZatPoint(sec.centerspot);}
    // Which crusher a body of this radius at p overlaps, or -1 (the crusher sectors are rectangles).
    int CrusherAt(Vector2 p,double r)
    {
        for(int i=0;i<Crushers.Size();i++)if(p.X+r>X0[i]&&p.X-r<X1[i]&&p.Y+r>Y0[i]&&p.Y-r<Y1[i])return i;
        return -1;
    }
    int Movers(){int n=0;for(int i=0;i<Crushers.Size();i++)if(level.Sectors[Crushers[i]].ceilingdata)n++;return n;}
    void Gate(int i,Vector2 p)
    {
        let post=PDKokotajloGate(Actor.Spawn('PDKokotajloGate',(p,FloorZ[i])));
        if(post){post.Rescue=self;post.Index=i;}
    }
    // Crusher i is a wall to you: lower than your head, and you're not already under it.
    bool Shut(int i,PlayerPawn you)
    {
        return !Stopped&&you&&you.health>0&&i>=0&&i<Crushers.Size()&&Ceil(i)<FloorZ[i]+you.FullHeight&&CrusherAt(you.Pos.XY,you.Radius)!=i;
    }
    // The auto-crouch looks ahead past the posts and ducks you at a shut crusher's edge: stand back up
    // (CrouchMove keeps you down if there's no room). Your own crouch key is left alone.
    void Unduck(PlayerPawn you)
    {
        let p=you?you.player:null;
        if(!p||p.crouchfactor>=1||you.health<=0||p.original_cmd.buttons&BT_CROUCH||CrusherAt(you.Pos.XY,you.Radius)>=0)return;
        int i=CrusherAt(you.Pos.XY,you.Radius+24);
        if(i>=0&&Shut(i,you))you.CrouchMove(1);
    }
    void TickCrushers(PlayerPawn you)
    {
        for(int i=0;i<Crushers.Size();i++)
        {
            let sec=level.Sectors[Crushers[i]];double c=Ceil(i);
            if(Stopped)
            {
                if(c<Top[i]-.01){sec.MoveCeiling(RaiseSpeed,Top[i],-1,1,false);Hum(i,true);}
                continue;
            }
            if(Dir[i]==0)
            {
                if(level.time<DwellUntil[i])continue;
                Dir[i]=c>=Top[i]-.5?-1:1;
            }
            if(Dir[i]<0)
            {
                // SMITH and the people aren't shootable, so the engine would let it pass through them:
                // it rests on their heads instead (no bite), until they move on.
                if(c-DownSpeed<Resting(i))continue;
                int res=sec.MoveCeiling(DownSpeed,Bottom[i],-1,-1,false);
                if(res==Sector.MOVE_PASTDEST){Dir[i]=0;DwellUntil[i]=level.time+BottomDwell;if(Hums[i])Hums[i].A_StartSound("plats/pt1_stop",CHAN_BODY,0,.6,2);continue;}
                // It stops on whoever is under it, and bites.
                if(res==Sector.MOVE_CRUSHED&&you&&you.health>0&&CrusherAt(you.Pos.XY,you.Radius)==i&&level.time>=HurtAt)
                {
                    HurtAt=level.time+CrushEvery;you.DamageMobj(null,null,CrushDamage,'Crush');
                    if(you.health<=0)CrushedYou=true;
                }
            }
            else if(sec.MoveCeiling(UpSpeed,Top[i],-1,1,false)==Sector.MOVE_PASTDEST){Dir[i]=0;DwellUntil[i]=level.time+TopDwell;continue;}
            Hum(i,true);
        }
    }
    // The highest head of SMITH or a visible person under crusher i (else far below it).
    double Resting(int i)
    {
        double highest=-32768;
        for(int n=-1;n<5;n++)
        {
            Actor a=n<0?Actor(Game.Smith):Actor(Game.People[n]);
            if(!a||a.bInvisible)continue;
            Vector2 p=a.Pos.XY;double r=a.Radius;
            if(p.X+r>X0[i]&&p.X-r<X1[i]&&p.Y+r>Y0[i]&&p.Y-r<Y1[i])highest=max(highest,a.Pos.Z+a.Height);
        }
        return highest;
    }
    void Hum(int i,bool moving){if(moving&&Hums[i]&&level.time%8==i)Hums[i].A_StartSound("plats/pt1_mid",CHAN_BODY,0,.5,2);}
    // Tics a body of this height has under crusher i before it comes down past it (0 = not now).
    int Window(int i,double height)
    {
        if(Stopped)return 9999;
        double c=Ceil(i),fit=FloorZ[i]+height+2;
        if(c<fit)return 0;
        double fall=(Top[i]-fit)/DownSpeed;
        if(Dir[i]>0)return int((Top[i]-c)/UpSpeed+TopDwell+fall);
        if(Dir[i]==0)return c>=Top[i]-.5?int(DwellUntil[i]-level.time+fall):0;
        return int((c-fit)/DownSpeed);
    }

    // ---- the NDA -------------------------------------------------------------------------------

    bool Done(){return Game.Released[Site];}
    bool BayOpen()
    {
        if(BayDoor<0)return false;let sec=level.Sectors[BayDoor];
        return sec.ceilingplane.ZatPoint(sec.centerspot)-sec.floorplane.ZatPoint(sec.centerspot)>=56;
    }
    // Holding the bay: standing in bay 29 or its doorway 30.
    static bool InBay(Vector2 p){int s=level.PointInSector(p).Index();return s==29||s==30;}
    // 11 SIGN, 12 DON'T SIGN, 0 neither: the one you're looking at, close up.
    int Panel(PlayerPawn pawn)
    {
        if(!pawn||Done()||Refusals>=3||level.time<NextPanelAt)return 0;
        int best=0;double score=-1;
        for(int k=11;k<=12;k++)
        {
            let p=Game.Prop(k);if(!p||!Game.Facing(pawn,p,PanelReach,PanelCos))continue;
            double f=cos(pawn.AngleTo(p)-pawn.Angle);if(f>score){score=f;best=k;}
        }
        return best;
    }
    override String Prompt(PlayerPawn pawn)
    {
        int k=Panel(pawn);
        return k==11?"SPACE - sign the NDA":k==12?"SPACE - refuse to sign":"";
    }
    override bool Use(PlayerPawn pawn)
    {
        int k=Panel(pawn);if(!k)return false;
        if(k==11)Sign();else Refuse();
        return true;
    }
    Vector2 BaySpot(){let pod=Game.Prop(10);return pod?pod.Pos.XY+(0,40):(852,-180);}
    void Sign()
    {
        let p=Game.Prop(11);if(p)p.A_StartSound("agentic/beep",CHAN_BODY);
        Game.SetPaceFactor(PDAgentic.RACE_PACE);Game.Release(Site);
        Game.Speak("AGENTIC SMITH","Agreement executed. Accelerating.",175,"smith-race",Game.Smith);
    }
    void Refuse()
    {
        Refusals++;NextPanelAt=level.time+24;
        let p=Game.Prop(12);if(p)p.A_StartSound("agentic/chime",CHAN_BODY);
        // The offer is the alarm's own status line, and the chime is the noise SMITH comes to.
        Show(Refusals==1?"EQUITY OFFERED: $1M":Refusals==2?"EQUITY OFFERED: $10M":"EQUITY OFFERED: $100M",0);
        Vector2 bay=BaySpot();Game.Alarm(Shown,bay);
        Summon();
        if(Refusals<3){Game.SetTodo("1. GET SIGNATURE|2. RAISE OFFER");return;}
        // No deal: the panels go dark and the bay has to be held until it gives up.
        Counting=true;CountLeft=CountdownTics;SaidSecond=0;Held=true;
        Dim();
        Game.SetTodo("1. GET SIGNATURE (DECLINED)|2. INSPECT NOISE");
        Game.Speak("Daniel Kokotajlo","No deal. Now hold the bay until it gives up.",175,"daniel-hold",Game.People[Site]);
    }
    // A refusal's noise reaches SMITH's nearest eye: he steps out of the intact camera closest to the
    // harvester (C8 in corridor 49, else C1 in room 3) hunting you at the bay, as a camera that saw you
    // would send him, and has to time the crushers like you did. Smash those cameras first and he has to
    // walk from wherever he is. Only once he's further off than that camera (the first chime, as a rule).
    void Summon()
    {
        let smith=Game.Smith;
        if(!smith||Game.ExitArmed||Game.SmithMode==3||Game.InConstruct||OtherBusy()||level.time<Game.RebootUntil||level.time<Game.StunUntil||InArea(smith.Pos.XY))return;
        PDAgenticCamera best=null;double closest=SummonRange;
        for(int i=0;i<Game.Cameras.Size();i++)
        {
            let cam=Game.Cameras[i];if(!cam||cam.Broken||!cam.On||cam.Args[1]&2)continue;
            double away=MouthGap(PDAgenticMap.CameraSpot(cam.Args[0]));
            if(away<closest){closest=away;best=cam;}
        }
        if(!best||MouthGap(smith.Pos.XY)<=closest)return;
        Summoned=best.Args[0]+1;Game.MaterialiseAt=level.time;best.SeenUntil=level.time+53;
        Game.SmithTo(PDAgenticMap.CameraSpot(best.Args[0]),1);
        Game.HuntUntil=max(Game.HuntUntil,level.time+210);Game.LastSeen=BaySpot();
        Game.SpotLineAt=level.time+700;
        Game.Speak("AGENTIC SMITH","I see you through every camera you didn't break.",175,"smith-spot-3",Game.Smith);
    }
    void Show(String text,int ticks){Shown=text;ShownAt=level.time;if(ticks)Game.Say(text,ticks);}
    // The NDA's alarm and hunt, at the bay or pointed at a mouth on their way there.
    bool OurAlarm()
    {
        Vector2 bay=BaySpot();
        return Same(Game.AlarmAt,bay)||AlarmSteered&&Same(Game.AlarmAt,SteerAlarm)&&Same(RealAlarm,bay);
    }
    bool OurHunt()
    {
        Vector2 bay=BaySpot();
        return Same(Game.LastSeen,bay)||SeenSteered&&Same(Game.LastSeen,SteerSeen)&&Same(RealSeen,bay);
    }
    // Counts down only while you stand in the bay; out of it, it waits (SLOWDOWN PAUSED).
    void TickCountdown(PlayerPawn you)
    {
        if(!Counting)return;
        if(Done()){Counting=false;return;}
        bool standing=you&&you.health>0&&InBay(you.Pos.XY);
        if(standing)CountLeft--;else PausedTics++;
        // The noise goes on while the bay is still to be held: SMITH keeps coming.
        if(OurAlarm())Game.AlarmUntil=max(Game.AlarmUntil,level.time+35);
        if(Summoned&&OurHunt()&&level.time<Game.HuntUntil)Game.HuntUntil=max(Game.HuntUntil,level.time+35);
        if(CountLeft<=0)
        {
            Counting=false;
            // It gives up: the NDA's alarm and its hunt for you end, and SMITH dissolves out of the harvester
            // back to his cross hall, where he looks away for 5 s (as after his cold-start beat), so you and
            // Daniel can walk out. His cameras still see you.
            GiveUp();
            Game.SetPaceFactor(PDAgentic.SLOWDOWN_PACE);Game.Release(Site);
            Game.Speak("AGENTIC SMITH","A slowdown. How responsible.",175,"smith-slowdown",Game.Smith);
            return;
        }
        Held=standing;
        int n=(CountLeft+34)/35;
        String want=standing?String.Format("SLOWDOWN IN %d",n):"SLOWDOWN PAUSED";
        // A new second or a change of state; the paused line is kept up while you're out of the bay but
        // still in the harvester (beyond it, it isn't repeated across the map).
        if(want==Shown&&(standing||level.time<Game.MessageUntil-1||!you||!InArea(you.Pos.XY)))return;
        // Never over something newer on the status line (the last offer keeps it for 2 s first).
        bool mine=Game.Message==Shown&&(Shown.Left(8)=="SLOWDOWN"||level.time>=ShownAt+70);
        if(level.time<Game.MessageUntil&&!mine)return;
        if(standing)SaidSecond=n;
        Show(want,standing?45:70);
    }
    void GiveUp()
    {
        if(OurAlarm())Game.AlarmUntil=0;
        Game.HuntUntil=0;
        let smith=Game.Smith;
        if(!smith||Game.ExitArmed||Game.SmithMode==3||Game.InConstruct||OtherBusy())return;
        GaveUp=1;Game.MaterialiseAt=level.time;Game.BlindUntil=level.time+175;
        Game.SmithTo(PDAgenticMap.SmithHome(),0);
    }
    int CountdownLeft(){return Counting&&!Done()?max(0,(CountLeft+34)/35):0;}
    // Both panels switch off: ASGN C (SIGN) and D (DON'T SIGN), label and button dark.
    void Dim()
    {
        for(int k=11;k<=12;k++){let p=Game.Prop(k);if(p)p.Frame=k==11?2:3;}
    }
    void OpenPod()
    {
        PodOpen=true;let pod=Game.Prop(10);if(!pod)return;
        if(pod.Frame!=1)pod.A_StartSound("doors/dr1_open",CHAN_BODY);
        pod.Frame=1;
    }

    // ---- SMITH in the harvester ----------------------------------------------------------------

    // The corridor and its crushers, passage 28, dark room 26, pad 27, bay 29 and its door 30.
    static bool InArea(Vector2 p)
    {
        switch(level.PointInSector(p).Index()){case 2:case 21:case 22:case 23:case 24:case 46:case 47:case 48:case 50:case 26:case 27:case 28:case 29:case 30:return true;}
        return false;
    }
    bool OtherBusy(){for(int i=0;i<5;i++)if(i!=Site&&Game.Puzzles[i]&&Game.Puzzles[i].SmithBusy())return true;return false;}
    static bool Same(Vector2 a,Vector2 b){return (a-b).Length()<.5;}
    // The corridor's two ends: room 3 in the west, corridor 49 in the east.
    static Vector2 WestMouth(){return (296,-352);}
    static Vector2 EastMouth(){return (1704,-352);}
    static double MouthGap(Vector2 p){return min((p-WestMouth()).Length(),(p-EastMouth()).Length());}
    // The nearer mouth; once he's on his way to one, the other has to be clearly nearer.
    Vector2 MouthFor(Vector2 from)
    {
        Vector2 w=WestMouth(),e=EastMouth();
        if(HaveMouth)
        {
            Vector2 other=Same(LastMouth,w)?e:w;
            if((from-other).Length()+200>(from-LastMouth).Length())return LastMouth;
        }
        LastMouth=(from-w).Length()<=(from-e).Length()?w:e;HaveMouth=true;
        return LastMouth;
    }
    PDAgenticCamera CameraNumber(int n)
    {
        for(int i=0;i<Game.Cameras.Size();i++)if(Game.Cameras[i]&&Game.Cameras[i].Args[0]==n)return Game.Cameras[i];
        return null;
    }
    // Put back whatever was pointed at a mouth (when SMITH reaches it, or on the release).
    void Unsteer()
    {
        if(AlarmSteered&&Same(Game.AlarmAt,SteerAlarm))Game.AlarmAt=RealAlarm;
        if(SeenSteered&&Same(Game.LastSeen,SteerSeen))Game.LastSeen=RealSeen;
        AlarmSteered=false;SeenSteered=false;
    }
    void DriveSmith(PlayerPawn you)
    {
        bool was=Driving;Driving=false;WantPose=-1;
        let smith=Game.Smith;
        if(!smith||!you)return;
        // A camera saw you last tic while this rescue had SMITH, and the core waited for it (Busy): hand
        // the sighting on now, so a camera always brings him by the core's own rule.
        if(Game.SpottedAt>SpotSeen)
        {
            SpotSeen=Game.SpottedAt;
            let cam=CameraNumber(Game.SpotCamera);
            if(was&&cam&&!Stopped){Game.Spotted(cam);SpotSeen=Game.SpottedAt;}
        }
        if(Stopped||Game.ExitArmed||Game.SmithMode==3||Game.InConstruct||OtherBusy())return;
        // Stunned or rebooting, the core shows it and nothing walks.
        if(level.time<Game.RebootUntil||level.time<Game.StunUntil)return;
        bool inside=InArea(smith.Pos.XY);
        double near=smith.Distance2D(you);
        bool sees=Game.SmithSees(you,near);
        int mode;Vector2 target;
        if(sees||level.time<Game.HuntUntil)
        {mode=1;target=PDAgentic.Reach(sees?you.Pos.XY:SeenSteered&&Same(Game.LastSeen,SteerSeen)?RealSeen:Game.LastSeen);}
        else if(level.time<Game.AlarmUntil)
        {mode=2;target=PDAgentic.Reach(AlarmSteered&&Same(Game.AlarmAt,SteerAlarm)?RealAlarm:Game.AlarmAt);}
        else{mode=0;target=MouthFor(smith.Pos.XY);}
        if(!inside&&!InArea(target))return;
        Vector2 mouth=MouthFor(smith.Pos.XY);
        if(!inside&&!sees&&(smith.Pos.XY-mouth).Length()>MouthReach)
        {
            // Still on his way: the core walks him to the harvester's mouth on its own graph.
            if(mode==2)
            {
                if(!(AlarmSteered&&Same(Game.AlarmAt,SteerAlarm)))RealAlarm=Game.AlarmAt;
                Game.AlarmAt=mouth;SteerAlarm=mouth;AlarmSteered=true;
            }
            else
            {
                if(!(SeenSteered&&Same(Game.LastSeen,SteerSeen)))RealSeen=Game.LastSeen;
                Game.LastSeen=mouth;SteerSeen=mouth;SeenSteered=true;
            }
            return;
        }
        Unsteer();
        // From here on he's this rescue's to move (the core's TickSmith sees Busy() and waits).
        Driving=true;Game.SmithMode=mode;
        if(sees){Game.HuntUntil=level.time+175;Game.LastSeen=you.Pos.XY;}
        // His voice is the core's (first meeting, rescue reactions, chatter); his poses are put back by Poser.
        Game.SmithVoice(sees,near);
        WantPose=level.time<Game.PoseUntil?7:mode==1&&sees&&near<PDAgentic.SMITH_GRAB_REACH?3:-1;
        double rate=Game.Pace();
        if(mode==1)
        {
            Game.AutoTodo("1. FIND USER ✓|2. CATCH USER");
            if(sees&&near<PDAgentic.SMITH_GRAB_REACH&&level.time>=Game.HitAt){Game.HitAt=level.time+PDAgentic.SMITH_CONTACT_TICS;you.DamageMobj(smith,smith,PDAgentic.SMITH_CONTACT_DAMAGE,'Normal');}
            // Hunting here is hunting: the core's possession rule still holds.
            Game.TryPossess();
            // Arm's length, as the core's hunt (PDAgentic.SMITH_STANDOFF).
            if(Game.AtArmsLength(you,near,sees)){smith.Angle=smith.AngleTo(you);if(near<PDAgentic.SMITH_BACKOFF)Game.SmithEaseBack();return;}
            Step(smith,target,2.4*rate);return;
        }
        if(mode==2)
        {
            Game.AutoTodo("1. INSPECT NOISE|2. TIME THE CRUSHERS");
            if((smith.Pos.XY-target).Length()<48)Game.AlarmUntil=min(Game.AlarmUntil,level.time+70);
            Step(smith,target,2.0*rate);return;
        }
        Game.AutoTodo("1. LEAVE HARVESTER|2. RESUME PATROL");
        Step(smith,target,1.4*rate);
    }
    void ApplyPose(){if(Driving&&WantPose>=0&&Game&&Game.Smith)Game.Smith.Pose=WantPose;}
    int MLink(int n){int l=Game.Links[n];return l?l:Saved[n];}
    int MNode(Vector2 p)
    {
        int total=Game.Links.Size();if(!total)return -1;
        int step=PDAgenticMap.Step(),width=PDAgenticMap.Width(),rows=PDAgenticMap.Height();
        int gx=int(floor((p.X-PDAgenticMap.OriginX())/step)),gy=int(floor((p.Y-PDAgenticMap.OriginY())/step));
        int best=-1;double distance=99999;
        for(int y=max(0,gy-3);y<=min(rows-1,gy+3);y++)
            for(int x=max(0,gx-3);x<=min(width-1,gx+3);x++)
            {
                int n=y*width+x;if(n>=total||!MLink(n))continue;
                double d=(PDAgenticMap.Center(n)-p).Length();if(d<distance){distance=d;best=n;}
            }
        return best;
    }
    // PDAgenticNav.Next on the merged links: never the refuge, never a low ceiling unless it's a door
    // or a crusher (crushers are timed at the edge, in Step).
    Vector2 NextStep(Actor body,Vector2 goal)
    {
        int end=MNode(goal);if(end<0)return body.Pos.XY;
        if(level.time>=Refresh||end!=GoalNode)
        {
            GoalNode=end;Refresh=level.time+35;Path.Clear();PathIndex=0;
            int start=MNode(body.Pos.XY),total=Game.Links.Size();if(start<0)return body.Pos.XY;
            Prev.Resize(total);Queue.Resize(total);for(int n=0;n<total;n++)Prev[n]=-1;
            int head=0,tail=1;Queue[0]=start;Prev[start]=start;
            int width=PDAgenticMap.Width(),refuge=PDAgenticMap.RefugeDoor();
            while(head<tail&&Prev[end]<0)
            {
                int at=Queue[head++],bits=MLink(at);
                for(int d=0;d<4;d++)
                {
                    if(!(bits&(1<<d)))continue;
                    int to=at+(d==0?1:d==1?-1:d==2?width:-width);
                    if(to<0||to>=total||Prev[to]>=0)continue;
                    Vector2 p=PDAgenticMap.Center(to);
                    if(PDAgenticMap.InRefuge(p)||refuge&&Game.Doors[to]==refuge)continue;
                    let sec=level.PointInSector(p);
                    if(!Game.Doors[to]&&!PDAgenticMap.Crusher(sec.Index())&&sec.ceilingplane.ZatPoint(p)-sec.floorplane.ZatPoint(p)<56)continue;
                    Prev[to]=at;Queue[tail++]=to;
                }
            }
            if(Prev[end]>=0)
            {
                Array<int> back;
                for(int n=end;n!=start;n=Prev[n])back.Push(n);
                Path.Push(start);for(int i=back.Size()-1;i>=0;i--)Path.Push(back[i]);
                // Not back to the centre of the cell he's in: just past a crusher, that reads as stepping
                // under it again and he would wait for its window.
                if(Path.Size()>1)PathIndex=1;
            }
        }
        while(PathIndex<Path.Size()&&(PDAgenticMap.Center(Path[PathIndex])-body.Pos.XY).Length()<4)PathIndex++;
        return PathIndex<Path.Size()?PDAgenticMap.Center(Path[PathIndex]):Path.Size()>0?goal:body.Pos.XY;
    }
    // One tic of SMITH walking: he waits at a crusher's edge until it has time for him, then dashes.
    void Step(Actor body,Vector2 goal,double speed)
    {
        if((goal-body.Pos.XY).Length()<12)return;
        Vector2 toward=NextStep(body,goal),delta=toward-body.Pos.XY;double dist=delta.Length();if(dist<1)return;
        Vector2 heading=delta/dist;
        int under=CrusherAt(body.Pos.XY,body.Radius+1);
        if(under>=0)speed=max(speed,Sprint);
        else
        {
            Vector2 ahead=body.Pos.XY+heading*(min(speed,dist)+6);
            int next=CrusherAt(ahead,body.Radius+1);
            if(next>=0)
            {
                double span=X1[next]-X0[next]+body.Radius*2+8+(Crushers[next]==23?140:0);
                if(Window(next,body.Height)<span/Sprint+6){body.Angle=atan2(heading.Y,heading.X);return;}
                speed=max(speed,Sprint);
            }
        }
        body.Angle=atan2(delta.Y,delta.X);
        int refuge=PDAgenticMap.RefugeDoor(),nearby=PDAgenticMap.NearbyDoor(body.Pos.XY),n=MNode(toward);
        if(nearby&&nearby!=refuge)Door_Open(nearby,24);
        if(n>=0&&Game.Doors[n]&&Game.Doors[n]!=refuge)Door_Open(Game.Doors[n],24);
        if(!body.TryMove(body.Pos.XY+heading*min(speed,dist),1))
        {
            int at=MNode(body.Pos.XY);
            if(at>=0){Vector2 c=PDAgenticMap.Center(at)-body.Pos.XY;if(c.Length()>4)body.TryMove(body.Pos.XY+c.Unit()*speed,1);}
            Refresh=0;
        }
    }

    // ---- hooks ---------------------------------------------------------------------------------

    override void Tick(PlayerPawn pawn)
    {
        TickCrushers(pawn);
        Unduck(pawn);
        TickCountdown(pawn);
        DriveSmith(pawn);
    }
    override bool SmithBusy() {return Driving;}
    // Called after every Release(2) (the panels, the countdown, QA, the hub walk-in, ?puzzle=exit):
    // the crushers rise to their tops and stay; the panels and countdown go quiet; SMITH is the core's;
    // his list says how the NDA ended.
    override void Released()
    {
        Stopped=true;Driving=false;Counting=false;WantPose=-1;
        Unsteer();
        OpenPod();Dim();
        String ending=Game.Ending();
        if(ending=="race")Game.SetTodo("1. GET SIGNATURE ✓|2. ACCELERATE");
        else if(ending=="slowdown")Game.SetTodo("1. GET SIGNATURE (DECLINED)|2. SLOW DOWN");
        else Game.TodoUntil=0;
    }
    override String Json()
    {
        String ceils="",dirs="";
        for(int i=0;i<Crushers.Size();i++)
        {
            ceils=ceils..String.Format("%s%d",i?",":"",int(Ceil(i)+.5));
            dirs=dirs..String.Format("%s%d",i?",":"",Stopped?0:Dir[i]);
        }
        let smith=Game.Smith,you=Game.Pawn();
        // (ZScript names ignore case: no local may share a field's or method's name.)
        double crouch=you&&you.player?you.player.crouchfactor:1.;
        int holding=Counting&&Held?1:0,steered=AlarmSteered||SeenSteered?1:0,frame=smith?smith.Frame:-1;
        return String.Format(",\"crouch\":%.2f,\"nda_refusals\":%d,\"countdown\":%d,\"countdown_held\":%d,\"countdown_paused\":%d,\"crushers\":%d,\"crusher_ceil\":[%s],\"crusher_dir\":[%s],\"crusher_movers\":%d,\"bay_door\":%d,\"pod_open\":%d,\"smith_driven\":%d,\"smith_steered\":%d,\"smith_frame\":%d,\"summoned\":%d,\"killed_by\":\"%s\",\"stim_moved\":%d,\"gave_up\":%d",
            crouch,Refusals,CountdownLeft(),holding,PausedTics,!Stopped,ceils,dirs,Movers(),BayOpen(),PodOpen,Driving,steered,frame,Summoned,CrushedYou?"crusher":"",StimMoved,GaveUp);
    }
}
