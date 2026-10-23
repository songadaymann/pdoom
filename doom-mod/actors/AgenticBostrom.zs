// Level 4 rescue, site 1: Nick Bostrom, Unrendered (docs/LEVEL-04.md). His body sleeps in the centre
// pod of trough 119 (the core calls his nick-pod hint from it); his mind stands in a box in the
// Construct, a white room in the void reached through the leather chair on crosswalk 124.
// The box only exists while it is on your screen. Turn your back on it (or look at the floor) for a
// second and it stops rendering (no walls, nothing blocks), and his mind walks out. Look back and it
// redraws as a green wireframe for a second, then solid, with him standing outside it: only then is he
// out ("Shall we?"). Jack out from the white chair: his pod drains and he climbs out onto the catwalk.
// Leave before you have seen him outside and he is back in his box next time. One way, on screen.
class PDAgenticBostrom : PDAgenticPuzzle
{
    // Inside: you are in the Construct (HoldsPlayer: the core then suppresses CatchUp, cameras and
    // possession). MindClear: his mind has walked clear of the box. MindOut: you have seen the box redraw with
    // him outside it, so jacking out frees him. Done: freed (Released), nothing runs.
    bool Inside,MindClear,MindOut,Seen,HintSaid,NudgeSaid,Done;
    // Box (PDOOM_AGENTIC box): 0 unrendered, 1 solid, 2 wireframe until WireUntil.
    int Box,AwayTics,StareTics,WireUntil;
    PDAgenticBostromMind Mind;
    // The box is 96 u a side, and drawn 96 tall so it reads as a cube under the 160 ceiling. It is
    // the map's AWHITE, shaded per face and see-through, so it stands out from the white room with
    // him visible inside; the redraw is AWIRE at full brightness.
    const Half=48.;
    const Tall=96.;
    const SolidAlpha=.7;
    const WireAlpha=.92;
    // The view the engine draws (main.js pins it at 960x600, 16:10, FOV 90): tan of the half-angles,
    // horizontal .75*1.6=1.2 and vertical .75 (Doom's 1.2 pixel stretch is applied to heights below).
    // A little wider than the screen, so the box never vanishes while any of it is in frame.
    const ScreenWide=1.3;
    const ScreenTall=.8;

    override void Setup(){ResetMind();}
    override bool HoldsPlayer(){return Inside;}
    // (in_construct is the core's own field.) mind_out: jacking out now frees him. mind_clear: he stands
    // clear of the box. box_seen: some of the box is on screen. mind_x/mind_y: where his mind stands.
    override String Json()
    {
        return String.Format(",\"box\":%d,\"mind_out\":%d,\"mind_clear\":%d,\"box_seen\":%d,\"mind_x\":%.1f,\"mind_y\":%.1f",
            Box,MindOut,MindClear,Seen,Mind?Mind.Pos.X:0.,Mind?Mind.Pos.Y:0.);
    }

    // Prompts: the leather chair until he is free; inside, the white chair always takes you back.
    override String Prompt(PlayerPawn pawn)
    {
        if(Inside)return Near(pawn,PDAgenticMap.ConstructChair(),96)?"SPACE - jack out":"";
        if(Game.Released[Site])return "";
        return Game.Facing(pawn,Game.Prop(7),96,.5)?"SPACE - sit in the chair":"";
    }
    override bool Use(PlayerPawn pawn)
    {
        if(Prompt(pawn)=="")return false;
        if(Inside)JackOut(pawn);else JackIn(pawn);
        return true;
    }
    // ?puzzle=bostrom: the core puts you beside the leather chair; face it.
    override void ApplySite(int site)
    {
        let you=Game.Pawn(),chair=Game.Prop(7);
        if(site==2&&you&&chair)you.Angle=you.AngleTo(chair);
    }
    // Freed (his jack-out, QA, the hub walk-in, ?puzzle=exit): the pod stays drained, the mind is
    // gone and the box stops. A QA release while you are inside still lets you jack out.
    override void Released()
    {
        Done=true;MindOut=false;MindClear=false;
        let pod=Game.Prop(9);if(pod)pod.Frame=3;
        if(Mind){Mind.Destroy();Mind=null;}
    }

    override void Tick(PlayerPawn pawn)
    {
        // His body floats in the pod (B/C) until it drains (D).
        let pod=Game.Prop(9);if(pod)pod.Frame=Game.Released[Site]?3:1+(level.time/30)%2;
        if(!Inside)return;
        // Nobody out in the farm can give you away in here: a possessed person's next act waits.
        for(int i=0;i<5;i++)if(Game.Possessed[i])Game.ActAt[i]=max(Game.ActAt[i],level.time)+1;
        if(Done||!Mind)return;
        Seen=Looking(pawn);
        AwayTics=Seen?0:AwayTics+1;
        Vector2 at=Mind.Pos.XY,goal=PDAgenticMap.MindExit();
        // Half through its wall, or with you standing in it, the box can't come back yet.
        bool crossing=InBox(at,Mind.Radius)&&!InBox(at,-Mind.Radius);
        if(Box&&AwayTics>=35)PaintBox(0);
        else if(!Box&&Seen&&!crossing&&!InBox(pawn.Pos.XY,pawn.Radius+2))
        {
            PaintBox(2);WireUntil=level.time+35;
            pawn.A_StartSound("agentic/render",CHAN_AUTO);
        }
        else if(Box==2&&level.time>=WireUntil)PaintBox(1);
        // He walks out while nothing is there, and once clear keeps going to his spot.
        if(!Box||MindClear)StepMind(goal,2);
        if(!MindClear&&!InBox(Mind.Pos.XY,Mind.Radius))MindClear=true;
        // He is out once you have seen it: the box redrawn on your screen with him outside it.
        if(MindClear&&Box&&!MindOut)
        {MindOut=true;Game.Speak("Nick Bostrom","Shall we?",140,"nick-out",Mind);}
        // Staring at him in his closed box gets a nudge after about 10 s.
        StareTics=Seen&&Box==1&&!MindClear?StareTics+1:0;
        if(StareTics>=350&&!NudgeSaid)
        {NudgeSaid=true;Game.Speak("Nick Bostrom","...You're somebody.",175,"nick-nudge",Mind);}
    }

    // Sitting down: a white-out, and you stand in the Construct facing his box.
    void JackIn(PlayerPawn pawn)
    {
        // SMITH loses you: its hunt ends, and an alarm that points at this chair is forgotten, so it
        // walks its patrol instead of waiting here (or at a spot in the void it cannot reach). If it is
        // in the farm, its round takes it to the patrol point farthest from the chair, so it is walking
        // away (not standing beside you) when you come back.
        Game.HuntUntil=0;
        if((Game.AlarmAt-pawn.Pos.XY).Length()<640)Game.AlarmUntil=0;
        let smith=Game.Smith;int points=PDAgenticMap.PatrolCount();
        if(smith&&points>0&&!Game.Busy()&&smith.Distance2D(pawn)<640)
        {
            int far=0;double best=-1;
            for(int i=0;i<points;i++){double d=(PDAgenticMap.PatrolPoint(i)-pawn.Pos.XY).Length();if(d>best){best=d;far=i;}}
            Game.PatrolLeg=far;Game.LegUntil=level.time+700;Game.ProgressAt=level.time;Game.ProgressFrom=smith.Pos.XY;
            if(Game.SmithRoute)Game.SmithRoute.Refresh=0;
        }
        Flash(pawn);Inside=true;Game.Called[Site]=true;
        Vector3 at=PDAgenticMap.ConstructSpawn();PDAgentic.Place(pawn,at.XY,at.Z);pawn.Pitch=0;
        AwayTics=0;StareTics=0;Seen=true;
        if(!Done)ResetMind();
        if(!HintSaid){HintSaid=true;HintFirst();}
    }
    // The white chair: back beside the leather one, facing his pod. Once you have seen him outside the
    // box, his pod drains and he is free; otherwise he is back in his box for next time.
    void JackOut(PlayerPawn pawn)
    {
        Flash(pawn);Inside=false;Seen=false;
        Vector3 at=PDAgenticMap.ChairReturn();PDAgentic.Place(pawn,at.XY,at.Z);pawn.Pitch=0;
        let pod=Game.Prop(9);if(pod)pawn.Angle=pawn.AngleTo(pod);
        if(Game.Released[Site])return;
        if(MindOut)
        {
            Game.Release(Site);
            // He gets his freed line out before SMITH may take anyone (TryPossess waits 280 tics).
            Game.LastPossess=max(Game.LastPossess,level.time);
            return;
        }
        ResetMind();
    }
    // His hint on arrival. The farm's talk stays behind without being lost: his pod's call and SMITH's
    // lines stop (SMITH's greeting and rescue remarks come again the next time it sees you), and a
    // captive's hint cut short is called again on your next approach. Anything else finishes first.
    void HintFirst()
    {
        if(level.time<Game.DialogueUntil&&Interrupt(Game.DialogueVoice))Game.DialogueUntil=0;
        for(int i=Game.QueuedVoices.Size()-1;i>=0;i--)if(Interrupt(Game.QueuedVoices[i]))Unqueue(i);
        if(Game.QueuedVoices.Size()>=6)Unqueue(5);
        Game.Speak("Nick Bostrom","Nothing renders what nobody's looking at.",210,"nick-hint",Mind);
        // Queued behind someone still talking: it goes to the front.
        int last=Game.QueuedVoices.Size()-1;
        if(last<=0||Game.QueuedVoices[last]!="nick-hint")return;
        String speaker=Game.QueuedSpeakers[last],line=Game.QueuedLines[last],voice=Game.QueuedVoices[last];
        int ticks=Game.QueuedTicks[last];Actor from=Game.QueuedFrom[last];
        Unqueue(last);
        Game.QueuedSpeakers.Insert(0,speaker);Game.QueuedLines.Insert(0,line);Game.QueuedTicks.Insert(0,ticks);
        Game.QueuedVoices.Insert(0,voice);Game.QueuedFrom.Insert(0,from);
    }
    // True for a line that stays in the farm; whatever made it play is armed again.
    bool Interrupt(String voice)
    {
        if(voice=="nick-pod")return true;
        if(voice=="jaan-hint"){Game.Called[0]=false;return true;}
        if(voice=="daniel-hint"){Game.Called[2]=false;return true;}
        if(voice=="yoshua-hint"){Game.Called[4]=false;return true;}
        if(voice.Left(6)!="smith-")return false;
        if(voice=="smith-met-sam"||voice=="smith-met-dario")Game.SmithMet=false;
        for(int i=0;i<5;i++)if(voice=="smith-release-"..PDAgentic.PersonKey(i))Game.SmithReact|=1<<i;
        return true;
    }
    void Unqueue(int i)
    {
        Game.QueuedSpeakers.Delete(i);Game.QueuedLines.Delete(i);Game.QueuedTicks.Delete(i);
        Game.QueuedVoices.Delete(i);Game.QueuedFrom.Delete(i);
    }
    // (A_SetBlend reads 0xFFFFFFFF as "no colour", which flashes black: white is given without alpha.)
    static void Flash(PlayerPawn pawn)
    {
        pawn.A_SetBlend(Color(255,255,255),1,45);
        pawn.A_StartSound("agentic/flash",CHAN_AUTO);
    }
    void ResetMind()
    {
        Vector2 spot=PDAgenticMap.MindSpot();
        if(!Mind)Mind=PDAgenticBostromMind(Actor.Spawn('PDAgenticBostromMind',(spot,0)));
        if(Mind)PDAgentic.Place(Mind,spot,270);
        AwayTics=0;MindClear=false;MindOut=false;PaintBox(1);
    }
    // Outside the nav grid: his mind walks by hand, straight to MindExit.
    void StepMind(Vector2 goal,double speed)
    {
        Vector2 d=goal-Mind.Pos.XY;double l=d.Length();if(l<.5)return;
        Vector2 p=Mind.Pos.XY+d/l*min(speed,l);
        Mind.SetOrigin((p,level.PointInSector(p).floorplane.ZatPoint(p)),true);Mind.Angle=atan2(d.Y,d.X);
    }

    // Looking: some part of the box is on your screen. Each face (a 96 x 96 square standing on the floor)
    // goes into view space and is clipped against the view: in front of you, and inside the screen's
    // edges left, right, top and bottom. So turning away and looking down at the floor both count as not
    // looking, and a box at the edge of the screen is still there. Nothing in the white room hides it.
    static bool Looking(PlayerPawn pawn)
    {
        if(!pawn.player)return false;
        Vector2 c=PDAgenticMap.ConstructBox();
        double base=level.PointInSector(c).floorplane.ZatPoint(c),k=tan(clamp(pawn.player.FOV,30,150)*.5);
        Vector3 eye=(pawn.Pos.XY,pawn.player.viewz);
        // The hardware renderer stretches heights by 1.2 and turns the pitch to match.
        double pitch=atan2(1.2*sin(pawn.Pitch),cos(pawn.Pitch));
        double ca=cos(pawn.Angle),sa=sin(pawn.Angle),cp=cos(pitch),sp=sin(pitch);
        Vector3 ahead=(ca*cp,sa*cp,-sp),right=(sa,-ca,0),up=(ca*sp,sa*sp,cp);
        Array<double> xs,ys,zs;
        for(int face=0;face<4;face++)
        {
            Vector2 a=c+Corner(face),b=c+Corner(face+1);
            xs.Clear();ys.Clear();zs.Clear();
            for(int i=0;i<4;i++)
            {
                Vector2 p=i==0||i==3?a:b;
                Vector3 d=(p.X-eye.X,p.Y-eye.Y,(base+(i<2?0:Tall)-eye.Z)*1.2);
                xs.Push(d dot right);ys.Push(d dot up);zs.Push(d dot ahead);
            }
            if(OnScreen(xs,ys,zs,ScreenWide*k,ScreenTall*k))return true;
        }
        return false;
    }
    // Box corners clockwise from the south-west (west, north, east, south faces between them).
    static Vector2 Corner(int i)
    {
        i%=4;return (i==0||i==1?-Half:Half,i==1||i==2?Half:-Half);
    }
    // Sutherland-Hodgman: clip the polygon (view space: x right, y up, z ahead) to the view; anything left is on screen.
    static bool OnScreen(out Array<double> xs,out Array<double> ys,out Array<double> zs,double tw,double th)
    {
        Array<double> nx,ny,nz;
        for(int plane=0;plane<5;plane++)
        {
            int n=xs.Size();if(!n)return false;
            nx.Clear();ny.Clear();nz.Clear();
            for(int i=0;i<n;i++)
            {
                int j=(i+1)%n;
                double di=PlaneSide(plane,xs[i],ys[i],zs[i],tw,th),dj=PlaneSide(plane,xs[j],ys[j],zs[j],tw,th);
                if(di>=0){nx.Push(xs[i]);ny.Push(ys[i]);nz.Push(zs[i]);}
                if((di>=0)!=(dj>=0))
                {
                    double t=di/(di-dj);
                    nx.Push(xs[i]+(xs[j]-xs[i])*t);ny.Push(ys[i]+(ys[j]-ys[i])*t);nz.Push(zs[i]+(zs[j]-zs[i])*t);
                }
            }
            xs.Copy(nx);ys.Copy(ny);zs.Copy(nz);
        }
        return xs.Size()>0;
    }
    // Plane 0 is just in front of the eye; 1-4 are the screen's right, left, top and bottom edges.
    static double PlaneSide(int plane,double x,double y,double z,double tw,double th)
    {
        return plane==0?z-2:plane==1?tw*z-x:plane==2?tw*z+x:plane==3?th*z-y:th*z+y;
    }
    // A point within the box grown (or shrunk) by margin.
    static bool InBox(Vector2 p,double margin)
    {
        Vector2 d=p-PDAgenticMap.ConstructBox();
        return abs(d.X)<Half+margin&&abs(d.Y)<Half+margin;
    }
    static bool Near(PlayerPawn pawn,Vector2 spot,double reach)
    {
        Vector2 d=spot-pawn.Pos.XY;double l=d.Length();
        return l<=reach&&(l<24||cos(atan2(d.Y,d.X)-pawn.Angle)>=.5);
    }
    // BarrierLine(7400,0..3) are its west, north, east and south faces (two-sided, inside sector 246).
    // 0 takes the walls away and lets everything through; 1 and 2 draw them and block. The wireframe
    // shows 66 of AWIRE's 64 columns across a face, so its bold left edge closes the right side too.
    void PaintBox(int state)
    {
        Box=state;
        TextureID tex;tex.SetNull();
        if(state)tex=TexMan.CheckForTexture(state==2?"AWIRE":"AWHITE",TexMan.Type_Wall);
        for(int i=0;i<4;i++)
        {
            int n=PDAgenticMap.BarrierLine(7400,i);if(n<0)continue;
            let ln=level.Lines[n];
            if(state)ln.flags|=Line.ML_BLOCKING;else ln.flags&=~Line.ML_BLOCKING;
            ln.flags&=~Line.ML_WRAP_MIDTEX;ln.alpha=state==2?WireAlpha:SolidAlpha;
            for(int s=0;s<2;s++)
            {
                let wall=ln.sidedef[s];if(!wall)continue;
                wall.SetTexture(Side.mid,tex);
                wall.Flags=(wall.Flags&~Side.WALLF_WRAP_MIDTEX)|Side.WALLF_ABSLIGHTING|Side.WALLF_NOFAKECONTRAST;
                // The wireframe: 66 columns and the top 66 rows (square cells), the rest pushed under the floor.
                wall.SetTextureXScale(Side.mid,(state==2?66.:64.)/96);wall.SetTextureYScale(Side.mid,(state==2?66.:128.)/Tall);
                wall.SetTextureXOffset(Side.mid,0);wall.SetTextureYOffset(Side.mid,state==2?-62:0);
                wall.Light=state==2?255:Shade(i);
            }
        }
    }
    // Lit from the south-west: the face you arrive in front of is the brightest.
    static int Shade(int face){return face==3?184:face==0?160:face==2?128:112;}
}

// His mind in the Construct (Nick's own sprite): faces you while standing, walks when moved.
class PDAgenticBostromMind : Actor
{
    Vector2 ArtPrevious;
    bool ArtReady;
    Default {Radius 10;Height 56;+NOBLOOD;+DONTSPLASH;}
    override void Tick()
    {
        Super.Tick();
        bool moving=ArtReady&&(Pos.XY-ArtPrevious).Length()>.1;
        ArtPrevious=Pos.XY;ArtReady=true;
        let you=players[0].mo;
        if(!moving&&you&&Distance2D(you)<640)Angle=AngleTo(you);
        Frame=moving?1+(level.time/8)%2:0;
    }
    States {Spawn: ABOS A -1;Stop;Art: ABOS BC -1;Stop;}
}
