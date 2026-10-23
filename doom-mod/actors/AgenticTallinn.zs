// Level 4 rescue 1, Jaan Tallinn: Run the hardline (docs/LEVEL-04.md). He is shut in payphone booth 19
// behind its jammed BOOTH 7 door (tag 7420). At the exchange in hall 31 you take the BOOTH 7 line off
// its drum and carry the end to the jack beside his door. The line lies taut behind you: it pulls
// straight wherever it can and wraps the corners you walk past, so the length you use is the route you
// chose, not how neatly you walked it. The straight route under camera C2 is just short enough
// (PDAgenticMap.CableBudget()); the long way round runs out and holds you. A camera that sees you with
// the line out sends SMITH for the line, not for you: he takes hold of it and cuts it there and then.
class PDAgenticTallinn : PDAgenticPuzzle
{
    // The taut line: the corners it wraps, from the drum (corner 0) on; it runs straight from the last
    // corner to your hands. Segments are the red ACBL pieces lying along it, one every 24 u.
    Array<double> CornerX,CornerY;
    Array<PDTallinnCable> Segments;
    PDAgenticProp Drum,Phone;
    PDTallinnJack Jack;Actor Probe;
    bool Carrying,Plugged,Done,Whip,Stowed,TautSaid,CutSaid,Cutting,Snapped,Came;
    int Budget,SavedTool,TautUntil,StrainAt,RingFrom,Cuts,GrabAt,HoldTill,GiveUpAt,Clicks,Held,TakenAt;
    // SeenAt: the last camera sighting already dealt with. CutCamera: the camera that saw you with the
    // line and sent SMITH for it (-1 none). Muted: other captives' hints held back while you carry it.
    int SeenAt,CutCamera,Muted,GrabTic,CutTic;
    double Used,GrabCap;Vector2 Last;

    static Vector2 Start(){return PDAgenticMap.CableStart();}
    // The BOOTH 7 jack hangs on the east jamb of the booth door (line 628), beside BoothPhone() (the spot
    // in front of the door that you plug in from).
    static Vector2 JackSpot(){Vector3 jack=PDAgenticMap.BoothJack();return jack.XY;}
    static double FloorAt(Vector2 p){return level.PointInSector(p).floorplane.ZatPoint(p);}
    Vector2 Corner(int i){return (CornerX[i],CornerY[i]);}
    int Corners(){return CornerX.Size();}
    bool Grabbing(){return Cutting&&GrabAt>0;}
    PDAgenticCamera CameraNumber(int index)
    {
        for(int i=0;i<Game.Cameras.Size();i++)if(Game.Cameras[i]&&Game.Cameras[i].Args[0]==index)return Game.Cameras[i];
        return null;
    }

    override void Setup()
    {
        Budget=PDAgenticMap.CableBudget();Drum=Game.Prop(5);Phone=Game.Prop(6);CutCamera=-1;
        Vector2 j=JackSpot();
        Jack=PDTallinnJack(Actor.Spawn('PDTallinnJack',(j,FloorAt(j)+26)));if(Jack)Jack.Angle=270;
        Probe=Actor.Spawn('PDTallinnProbe',(Start(),FloorAt(Start())));
        let watch=PDTallinnWatch(Actor.Spawn('PDTallinnWatch',(Start(),FloorAt(Start()))));if(watch)watch.Rescue=self;
    }

    override void Tick(PlayerPawn pawn)
    {
        TickWhip();
        HoldHints(pawn);
        if(Done)return;
        TickRing();
        if(Carrying)
        {
            // Carried off by a teleport (the farm chair into the Construct): the line drops back onto its drum.
            if((pawn.Pos.XY-Last).Length()>64||Game.InConstruct||Game.HoldsAny())Drop();
            else
            {
                // Both hands are on the plug: no wrench, no slingshot until you let go.
                Game.Tool=0;if(Game.HasWrench){Stowed=true;Game.HasWrench=false;}
                Follow(pawn);Layout(pawn.Pos.XY);
            }
        }
        TickCut();
        if(Drum)Drum.Frame=DrumFrame();
    }

    // The drum shows what is left: A full, B about half, C empty (taut).
    int DrumFrame()
    {
        if(!Carrying&&!Plugged)return 0;
        double left=1-Used/max(1,Budget);
        return left>.5?0:left>.06?1:2;
    }

    // A floor-level sight line: walls and shut doors stop it, an 8 u step does not.
    bool Clear(Vector2 a,Vector2 b)
    {
        Vector2 d=b-a;double l=d.Length();if(l<1||!Probe)return true;
        Probe.SetOrigin((a,FloorAt(a)),false);
        FLineTraceData hit;
        return !Probe.LineTrace(atan2(d.Y,d.X),l,0,TRF_THRUACTORS,20,data:hit)||hit.Distance>=l-.5;
    }
    double Laid(){double l=0;for(int i=1;i<Corners();i++)l+=(Corner(i)-Corner(i-1)).Length();return l;}

    // The line follows you: a corner goes as soon as the one before it sees your hands (it pulls
    // straight), and a new one wraps the wall corner that comes between the last corner and you. Past
    // CableBudget you are held on the limit: pulled back onto it, speed gone. While SMITH has hold of
    // the line no more pays out past his hands: you are held where you were when he took it.
    void Follow(PlayerPawn pawn)
    {
        Vector2 p=pawn.Pos.XY;
        while(Corners()>1&&Clear(Corner(Corners()-2),p)){int last=Corners()-1;CornerX.Delete(last);CornerY.Delete(last);}
        Vector2 end=Corner(Corners()-1);
        if(!Clear(end,p)&&(Last-end).Length()>2){end=Wrap(end,Last,p);CornerX.Push(end.X);CornerY.Push(end.Y);}
        bool held=Grabbing();
        double laid=Laid(),reach=(held?min(Budget,GrabCap):Budget)-laid,run=(p-end).Length();
        if(run>reach)
        {
            Vector2 q=run>.01?end+(p-end)*(max(0,reach)/run):end;
            if(!pawn.CheckPosition(q))q=Last;
            pawn.SetOrigin((q,pawn.Pos.Z),true);pawn.Vel=(0,0,pawn.Vel.Z);
            if(held)Strain(pawn);else Taut(pawn);
        }
        Last=pawn.Pos.XY;Used=laid+(Last-end).Length();
    }
    // Where the line wraps when a wall comes between its last corner and your hands: round the wall
    // corner it swung onto (a map vertex in the sliver swept since the last tic), standing 10 u off it
    // on whichever side keeps both runs clear and the line shortest. So the line hugs the corners of the
    // route you took however wide you walked round them, and only the route counts. Failing that, it
    // wraps where you just were.
    Vector2 Wrap(Vector2 pivot,Vector2 was,Vector2 p)
    {
        Vector2 back=was-pivot,now=p-pivot;
        double heading=atan2(back.Y,back.X);
        double span=Actor.deltaangle(heading,atan2(now.Y,now.X));
        double reach=max(back.Length(),now.Length())+1;
        double best=1e9;Vector2 corner=was;
        for(int i=0;i<level.Vertexes.Size();i++)
        {
            Vector2 v=level.Vertexes[i].p;Vector2 d=v-pivot;double l=d.Length();
            if(l<2||l>reach)continue;
            double turn=Actor.deltaangle(heading,atan2(d.Y,d.X));
            if(span>=0&&(turn<-.5||turn>span+.5)||span<0&&(turn>.5||turn<span-.5))continue;
            for(int k=0;k<8;k++)
            {
                Vector2 c=v+(cos(k*45+22.5),sin(k*45+22.5))*10;double run=(c-pivot).Length()+(p-c).Length();
                if(run<best&&Clear(pivot,c)&&Clear(c,p)){best=run;corner=c;}
            }
        }
        return corner;
    }
    void Strain(PlayerPawn pawn)
    {
        if(level.time>StrainAt+20)pawn.A_StartSound("agentic/snap",CHAN_6,0,.4,ATTN_NORM,1.5);
        StrainAt=level.time+10;
    }
    void Taut(PlayerPawn pawn)
    {
        Strain(pawn);
        TautUntil=level.time+10;Game.Say("THE CABLE WON'T REACH",70);
        if(!TautSaid){TautSaid=true;Game.Speak("Jaan Tallinn","Too far round. It won't reach.",175,"jaan-taut");}
    }

    // Lay the red pieces along the line, one every 24 u, from the drum to the end (your hands or the jack).
    // Pieces come and go at the far end: paying out, or reeling in as you walk back.
    void Layout(Vector2 end)
    {
        int want=int(Used/24),before=Segments.Size();
        while(Segments.Size()<want){let piece=PDTallinnCable(Actor.Spawn('PDTallinnCable',(Start(),FloorAt(Start())+1)));if(!piece)break;Segments.Push(piece);}
        while(Segments.Size()>want){let piece=Segments[Segments.Size()-1];if(piece)piece.Destroy();Segments.Delete(Segments.Size()-1);}
        // The drum clicks as it pays out or takes up.
        Clicks+=abs(Segments.Size()-before);
        if(Clicks>=3&&Drum){Clicks=0;Drum.A_StartSound("agentic/cable",CHAN_BODY,0,.6);}
        int piece=0,corners=Corners();double from=0;
        Vector2 a=Corner(0),b=corners>1?Corner(1):end;double len=(b-a).Length();
        for(int i=0;i<Segments.Size();i++)
        {
            double s=12+24*i;
            while(s>from+len&&piece<corners-1){from+=len;piece++;a=Corner(piece);b=piece+1<corners?Corner(piece+1):end;len=(b-a).Length();}
            Vector2 dir=len>.01?(b-a)/len:(1,0);
            Vector2 at=a+dir*clamp(s-from,0,len);
            let seg=Segments[i];if(!seg)continue;
            // The piece SMITH has hold of comes up off the floor into his hands, its neighbours with it.
            double z=FloorAt(at)+1+(Grabbing()?max(0,26-abs(i-Held)*10):0);
            if((seg.Pos.XY-at).Length()>.25||abs(seg.Pos.Z-z)>.25)seg.SetOrigin((at,z),true);
            seg.Angle=atan2(dir.Y,dir.X)+90;   // a flat sprite lies across its angle
        }
    }

    // A cut or a put-back: the line whips back onto the drum from the far end, five pieces a tic.
    void TickWhip()
    {
        if(!Whip)return;
        for(int n=0;n<5&&Segments.Size();n++){let piece=Segments[Segments.Size()-1];if(piece)piece.Destroy();Segments.Delete(Segments.Size()-1);}
        if(Segments.Size())return;
        Whip=false;if(Drum&&!Done)Drum.A_StartSound("agentic/cable",CHAN_BODY);
    }
    void FreeHands()
    {
        Game.CableHeld=false;
        if(Stowed){Stowed=false;Game.HasWrench=true;}
        Game.Tool=SavedTool;
    }
    void Drop()
    {
        if(!Carrying)return;
        Carrying=false;FreeHands();Used=0;TautUntil=0;CutCamera=-1;
        CornerX.Clear();CornerY.Clear();Whip=Segments.Size()>0;
    }
    void TakeLine(PlayerPawn pawn)
    {
        Carrying=true;Whip=false;TakenAt=level.time;CutCamera=-1;SeenAt=Game.SpottedAt;
        Vector2 home=Start();CornerX.Clear();CornerY.Clear();CornerX.Push(home.X);CornerY.Push(home.Y);
        Last=pawn.Pos.XY;Used=(Last-Start()).Length();
        Game.CableHeld=true;SavedTool=Game.Tool;Game.Tool=0;Stowed=Game.HasWrench;Game.HasWrench=false;
        if(Drum)Drum.A_StartSound("agentic/pickup",CHAN_ITEM);
        // Not heard him from the booth yet: he is on the other end of this line.
        if(!Game.Called[0]){Game.Called[0]=true;Game.Speak("Jaan Tallinn","Patch me through from the exchange. Straight line, or it won't reach.",210,"jaan-hint");}
    }
    // Plugged in: the line runs from your hands to the jack's foot, the booth rings, Jaan answers.
    void Plug(PlayerPawn pawn)
    {
        Vector2 foot=Jack.Pos.XY+(0,-6);
        if(!Clear(Corner(Corners()-1),foot)){CornerX.Push(pawn.Pos.X);CornerY.Push(pawn.Pos.Y);}
        Used=min(Budget,Laid()+(foot-Corner(Corners()-1)).Length());Layout(foot);
        Carrying=false;Plugged=true;FreeHands();TautUntil=0;CutCamera=-1;
        Jack.Frame=1;Jack.A_StartSound("agentic/plug",CHAN_BODY);
        RingFrom=level.time+25;
    }
    void TickRing()
    {
        if(!Plugged)return;
        int t=level.time-RingFrom;if(t<0)return;
        if(Phone){Phone.Frame=t%70<52?1:0;if(t%70==0)Phone.A_StartSound("agentic/ring",CHAN_BODY);}
        // Two rings, then he picks up and the door unjams (the core's OpenCell, via Release).
        if(t<130)return;
        if(Phone){Phone.Frame=2;Phone.A_StartSound("agentic/pickup",CHAN_ITEM);}
        Game.Release(Site);
    }

    // While you carry the line nobody else calls out to you (Nick's pod is in earshot of the band, through
    // the wall). A hint held back here waits until you are out of that captive's earshot again, then the
    // core calls it the next time you come near, as it would have.
    void HoldHints(PlayerPawn pawn)
    {
        for(int i=0;i<5;i++)
        {
            int bit=1<<i;if(i==Site)continue;
            // Sitting in the farm chair, Nick's rescue takes his hint over: it is never re-armed from here.
            if(Game.Released[i]||i==1&&Game.HoldsAny()){Muted&=~bit;continue;}
            if(Carrying&&!Done){if(!Game.Called[i]){Game.Called[i]=true;Muted|=bit;}continue;}
            if(!(Muted&bit))continue;
            Actor body=i==1?Actor(Game.Prop(9)):Actor(Game.Person(i));
            bool near=body&&(i==4?PDAgenticMap.InRigRoom(pawn.Pos.XY):pawn.Distance2D(body)<=384);
            if(!near){Game.Called[i]=false;Muted&=~bit;}
        }
    }
    // A line that goes to the front of the speech queue (the last one Speak just queued, if it queued one).
    void ToFront(int before)
    {
        int last=Game.QueuedLines.Size()-1;
        if(last<before||last<1)return;
        String speaker=Game.QueuedSpeakers[last],line=Game.QueuedLines[last],voice=Game.QueuedVoices[last];
        int ticks=Game.QueuedTicks[last];Actor from=Game.QueuedFrom[last];
        Game.QueuedSpeakers.Delete(last);Game.QueuedLines.Delete(last);Game.QueuedTicks.Delete(last);Game.QueuedVoices.Delete(last);Game.QueuedFrom.Delete(last);
        Game.QueuedSpeakers.Insert(0,speaker);Game.QueuedLines.Insert(0,line);Game.QueuedTicks.Insert(0,ticks);Game.QueuedVoices.Insert(0,voice);Game.QueuedFrom.Insert(0,from);
    }

    // SMITH and the line. A camera that sees you while the line is out sends SMITH for the line, not for
    // you: he walks to the nearest piece of it (or, if he is far off, comes out of that camera), takes
    // hold, says so and cuts it at once. Until then the jack will not take the plug. What SMITH sees with
    // his own eyes he hunts as ever, and he leaves the line alone: the line is the cameras' business.
    bool OthersBusy(){for(int i=0;i<5;i++)if(i!=Site&&Game.Puzzles[i]&&Game.Puzzles[i].SmithBusy())return true;return false;}
    void TickCut()
    {
        let smith=Game.Smith;
        if(Carrying&&Game.SpottedAt>SeenAt)
        {
            SeenAt=Game.SpottedAt;
            if(!Cutting&&CutCamera<0&&Game.SpotCamera>=0)CutCamera=Game.SpotCamera;
        }
        if(!Cutting)
        {
            if(CutCamera<0||!smith||!Carrying||!Segments.Size()||OthersBusy()||Game.SmithMode==3||Game.ExitArmed)return;
            Cutting=true;GrabAt=0;Snapped=false;Came=false;GiveUpAt=level.time+1050;
            Game.SetSmithMode(7);Game.SetTodo("1. LOCATE UNAUTHORIZED LINE|2. TERMINATE CONNECTION");
        }
        if(!smith){StopCut();return;}
        if(level.time>=Game.RebootUntil)Game.SmithMode=7;
        if(Snapped){if(level.time>=HoldTill)StopCut();return;}
        if(!Carrying||!Segments.Size()){StopCut();return;}
        if(GrabAt){if(level.time>=GrabAt+20)Snap();return;}
        if(level.time>=GiveUpAt){StopCut();return;}
        if(level.time<Game.StunUntil||level.time<Game.RebootUntil)return;
        PDTallinnCable best=null;double near=1e9;int index=-1;
        for(int i=0;i<Segments.Size();i++){let s=Segments[i];if(!s)continue;double d=smith.Distance2D(s);if(d<near){near=d;best=s;index=i;}}
        if(!best){StopCut();return;}
        // Across the map when the camera saw the line: he comes out of that camera, as the core brings him.
        if(near>640&&!Came)
        {
            Came=true;Game.MaterialiseAt=level.time;Game.SmithTo(PDAgenticMap.CameraSpot(CutCamera),7);
            return;
        }
        if(near<28){Grab(best,index);return;}
        Game.SmithWalk(best.Pos.XY,2.4*Game.Pace());
    }
    // He takes hold and says so over whatever was being said; the line snaps 20 tics later.
    void Grab(PDTallinnCable piece,int index)
    {
        let smith=Game.Smith;
        GrabAt=level.time;GrabTic=level.time;Held=index;GrabCap=Used;smith.Angle=smith.AngleTo(piece);
        Interrupted();
        Game.DialogueUntil=min(Game.DialogueUntil,level.time);int queued=Game.QueuedLines.Size();
        Game.Speak("AGENTIC SMITH","Unauthorized connection. Terminating.",105,"smith-cut",smith);
        ToFront(queued);
    }
    // A one-off line SMITH's grab talks over is said again later, like the Construct does: a captive's
    // hint the next time it is due (Jaan's at the next take), SMITH's first-meeting or rescue line at his
    // next sighting. Katja's hint is her rescue's own.
    void Interrupted()
    {
        if(level.time>=Game.DialogueUntil)return;
        String voice=Game.DialogueVoice;
        for(int i=0;i<5;i++)if(i!=3&&voice==PDAgentic.HintKey(i))Game.Called[i]=false;
        if(voice=="smith-met-sam"||voice=="smith-met-dario")Game.SmithMet=false;
        for(int i=0;i<5;i++)if(voice=="smith-release-"..PDAgentic.PersonKey(i))Game.SmithReact|=1<<i;
    }
    void Snap()
    {
        let smith=Game.Smith;Snapped=true;HoldTill=level.time+18;Cuts++;CutTic=level.time;
        if(smith)
        {
            Vector3 at=smith.Pos+(cos(smith.Angle)*14,sin(smith.Angle)*14,4);
            for(int i=0;i<8;i++){let spark=Actor.Spawn('PDRescueSpark',at);if(spark)spark.Vel=(random(-3,3),random(-3,3),random(1,4));}
            smith.A_StartSound("agentic/snap",CHAN_ITEM);
        }
        // Jaan names the camera that sent him (it is still up: you had no hands free to break it).
        let cam=CameraNumber(CutCamera);
        Drop();
        if(!CutSaid&&cam&&!cam.Broken)
        {
            CutSaid=true;int queued=Game.QueuedLines.Size();
            Game.Speak("Jaan Tallinn","Line's dead. Kill that camera, then try again.",175,"jaan-cut");
            ToFront(queued);
        }
    }
    void StopCut()
    {
        CutCamera=-1;
        if(!Cutting)return;
        Cutting=false;GrabAt=0;Snapped=false;Game.SetSmithMode(0);
    }

    override String Prompt(PlayerPawn pawn)
    {
        if(Done||Plugged||Whip||!pawn||pawn.health<=0)return "";
        if(Carrying)
        {
            // Not while SMITH is on his way to the line or has hold of it.
            if(!Cutting&&Jack&&Game.Facing(pawn,Jack,128,.45))return "SPACE - plug in the line";
            if(level.time>=TakenAt+18&&Drum&&Game.Facing(pawn,Drum,96,.45))return "SPACE - put the line back";
            return "";
        }
        return Drum&&Game.Facing(pawn,Drum,96,.45)?"SPACE - take the BOOTH 7 line":"";
    }
    override bool Use(PlayerPawn pawn)
    {
        if(Done||Plugged||Whip||!pawn||pawn.health<=0)return false;
        if(Carrying)
        {
            if(!Cutting&&Jack&&Game.Facing(pawn,Jack,128,.45)){Plug(pawn);return true;}
            if(level.time>=TakenAt+18&&Drum&&Game.Facing(pawn,Drum,96,.45)){Drop();return true;}
            return false;
        }
        if(Drum&&Game.Facing(pawn,Drum,96,.45)){TakeLine(pawn);return true;}
        return false;
    }
    override bool Swing(PlayerPawn pawn){return false;}
    override bool SmithBusy(){return Cutting&&!Done;}
    override bool HoldsPlayer(){return false;}
    // ?puzzle=tallinn: SiteSpot(1) is beside the drum; face it.
    override void ApplySite(int site){let you=Game.Pawn();if(you&&Drum)you.Angle=you.AngleTo(Drum);}
    // However he got out (the call, QA, the hub walk-in, ?puzzle=exit): the line machinery stops for good.
    // (Hints held back while carrying come back through HoldHints, which keeps running.)
    override void Released()
    {
        if(Done)return;
        if(Carrying)Drop();
        StopCut();
        Done=true;
        if(Phone)Phone.Frame=Plugged?2:0;
        if(Drum)Drum.Frame=DrumFrame();
    }
    // QA: the line's corners, "x y|x y|..." from the drum.
    String CornerList(){String t=",\"cable_corners\":\"";for(int i=0;i<Corners();i++)t=t..String.Format("%d %d|",int(CornerX[i]),int(CornerY[i]));return t.."\"";}
    override String Json()
    {
        // QA extras: cable_drum is the drum's frame (0 full, 1 half, 2 empty); cable_smith 1 while SMITH
        // goes for the line, 2 while he holds it; cable_camera the camera that sent him (-1 none);
        // cable_muted the other captives' hints held back while you carry it (bit per site); cable_grab_tic
        // and cable_cut_tic when SMITH last took hold of it and cut it.
        return String.Format(",\"cable\":%d,\"cable_used\":%d,\"cable_budget\":%d,\"cable_taut\":%d,\"cable_segments\":%d,\"cable_cuts\":%d,\"cable_plugged\":%d,\"cable_drum\":%d,\"cable_smith\":%d,\"cable_camera\":%d,\"cable_muted\":%d,\"cable_grab_tic\":%d,\"cable_cut_tic\":%d",
            Carrying,int(Used),Budget,level.time<TautUntil,Segments.Size(),Cuts,Plugged,Drum?Drum.Frame:0,!SmithBusy()?0:GrabAt?2:1,CutCamera,Muted,GrabTic,CutTic)..CornerList();
    }
}

// One red piece of the hardline lying on the floor (ACBL, flat; 26 u long at this scale).
class PDTallinnCable : Actor
{
    Default {Radius 2;Height 1;Scale .5;+NOINTERACTION;+NOGRAVITY;+NOBLOCKMAP;+FLATSPRITE;+NOTONAUTOMAP;}
    States {Spawn: ACBL A -1;Stop;}
}
// The BOOTH 7 jack beside the booth door, with its short red lead: empty (AJCK A) until you plug in (B).
// (Without booth-jack.png, scripts/build-agentic-assets.py makes AJCK of Bengio's red socket, ASKT E/B.)
class PDTallinnJack : Actor
{
    Default {Radius 4;Height 20;Scale .5;+NOGRAVITY;+NOBLOCKMAP;+WALLSPRITE;+NOTONAUTOMAP;}
    States {Spawn: AJCK A -1;Stop;Art: AJCK B -1;Stop;}
}
// Where the line's floor-level sight checks start from (never seen).
class PDTallinnProbe : Actor
{
    Default {Radius 1;Height 1;+NOGRAVITY;+NOBLOCKMAP;+NOTONAUTOMAP;+INVISIBLE;}
    States {Spawn: TNT1 A -1;Stop;}
}
// Spawned after SMITH, so it ticks after him: while he has hold of the line it shows his grab frame
// (D), which the core's pose (from his mode) would otherwise turn back into walking.
class PDTallinnWatch : Actor
{
    PDAgenticTallinn Rescue;
    Default {+NOINTERACTION;+NOGRAVITY;+NOBLOCKMAP;+NOTONAUTOMAP;+INVISIBLE;}
    override void Tick()
    {
        if(Rescue&&Rescue.Game&&Rescue.Game.Smith&&Rescue.Grabbing())Rescue.Game.Smith.Frame=3;
    }
    States {Spawn: TNT1 A -1;Stop;}
}
