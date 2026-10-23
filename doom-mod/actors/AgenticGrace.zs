// Level 4 rescue 4 (site 3), Katja Grace: Hand the agent a survey (docs/LEVEL-04.md).
// She waits on island 81 in the red pool; the five stepping stones (tag 7460) are sunk. The first time
// you walk into her waiting room (from hall 41), she tosses a clipboard onto the shore
// (StoneShore). Hand it to SMITH when he reaches you there and he stops dead to fill in all 2,778
// questions (mode 5, pose G, 20 s); take his badge while he writes and swipe it at the AGENTS ONLY
// reader: Release(3), the core raises the stones (OpenCell) and she walks over. A wrench stun is too
// short: the badge only comes off mid-survey. The survey only works here (waiting room 77, its step 78,
// the pool and her island): it is her rescue, not a 20 s pause to carry round the level.

// Her clipboard: flies in an arc from the island to the shore, then lies there until you take it.
// If SMITH finishes the survey before you took his badge, she tosses another one onto the shore.
class PDGraceClipboard : Actor
{
    Vector3 From,To;int Start,Length;double Apex;bool Flying;
    Default {Radius 6;Height 12;Scale 1;+NOINTERACTION;+NOGRAVITY;+ROLLSPRITE;}
    // (Plain components: a Vector3 built in a script call's argument list arrived as zero in this VM.
    // Parameters never share a field's name: identifiers ignore case, so Apex=apex would set nothing.)
    // Its sprite's height in map units (ASRV A at Scale 1: 26 u with survey-clipboard.png, else 16).
    double Tall(){Vector2 dims=TexMan.GetScaledSize(TexMan.CheckForTexture("ASRVA0",TexMan.Type_Sprite));return max(16.,dims.Y*Scale.Y);}
    void Toss(double x,double y,double z,int tics,double peak)
    {
        From=Pos;To=(x,y,z);Start=level.time;Length=max(1,tics);Flying=true;
        // The arc (sprite included) stays under every ceiling it passes: the pool's is low.
        double headroom=Tall()+4;
        for(int i=1;i<10;i++)
        {
            double t=i/10.;Vector2 p=From.XY*(1-t)+To.XY*t;
            double room=level.PointInSector(p).ceilingplane.ZatPoint(p)-headroom-(From.Z*(1-t)+To.Z*t);
            peak=min(peak,room/(4*t*(1-t)));
        }
        Apex=max(0,peak);
    }
    override void Tick()
    {
        Super.Tick();
        if(!Flying)return;
        double t=min(1.,(level.time-Start)/double(Length));
        Vector3 at=From*(1-t)+To*t;at.Z+=Apex*4*t*(1-t);
        // Two flips on the way over, landing face up.
        SetOrigin(at,true);Roll=-720*t;
        if(t>=1){Flying=false;Roll=0;A_StartSound("pdoom/chess-piece",CHAN_BODY,0,.8);}
    }
    States {Spawn: ASRV A -1;Stop;Art: ASRV A -1;Stop;}
}

// SMITH's lanyard badge in flight: off its chest and into your hand when you take it, out of your hand
// into the reader's slot when you swipe it. It follows its goal (you move) and is gone on arrival.
class PDGraceBadge : Actor
{
    Actor Goal;double GoalZ,Lift;Vector3 From;int Start,Length;
    Default {Radius 2;Height 4;Scale .8;+NOINTERACTION;+NOGRAVITY;+BRIGHT;}
    void Fly(Actor dest,double height,int tics,double rise)
    {
        Goal=dest;GoalZ=height;Lift=rise;From=Pos;Start=level.time;Length=max(1,tics);
    }
    override void Tick()
    {
        Super.Tick();
        if(!Goal){Destroy();return;}
        double t=min(1.,(level.time-Start)/double(Length));
        Vector3 to=Goal.Pos;to.Z+=GoalZ;
        Vector3 at=From*(1-t)+to*t;at.Z+=Lift*4*t*(1-t);
        SetOrigin(at,true);
        if(t>=1)Destroy();
    }
    States {Spawn: ABDG A -1 Bright;Stop;Art: ABDG A -1;Stop;}
}

class PDAgenticGrace : PDAgenticPuzzle
{
    const SurveyTics=700;           // about 20 s of SMITH filling it in
    const ScribbleTics=40;
    const CrossTics=700;            // longest her walk over the stones may keep SMITH's hands off her
    PDGraceClipboard Clipboard;
    bool Hinted,Tossed,HasSurvey,Handed,Surveying,HasBadge,Swiped,ReaderWarned,WasPossessed;
    int HeardAt,SurveyFrom,SurveyUntil,ScribbleAt,Question,Tosses;Vector2 SurveySpot;
    Array<int> Stones;

    // The core leaves her hint to this rescue (it comes with the clipboard); the stones are tag 7460.
    override void Setup()
    {
        Game.Called[3]=true;
        let it=level.CreateSectorTagIterator(7460);int s;
        while((s=it.Next())>=0)Stones.Push(s);
        HangSign();
    }
    // The AGENTS ONLY sign (kind 25) hangs small under the ceiling over the reader: it reads across the
    // room as the reader's sign, and stays out of the way when you stand at the reader watching her cross.
    void HangSign()
    {
        let sign=Game.Prop(25),reader=Game.Prop(13);if(!sign||!reader)return;
        // (A prop is 32 u tall: under this 72 u ceiling that would hold it down at eye level.)
        sign.Scale=(.34,.34);sign.A_SetSize(-1,4);
        Vector2 at=reader.Pos.XY+(0,2);
        double top=level.PointInSector(at).ceilingplane.ZatPoint(at);
        // (ANOT B is 26 texels tall with wall-notes.png, 17 drawn.)
        Vector2 plate=TexMan.GetScaledSize(TexMan.CheckForTexture("ANOTB0",TexMan.Type_Sprite));if(plate.Y<=0)plate.Y=17;
        sign.SetOrigin((at.X,at.Y,top-plate.Y*.34-3),false);
    }
    bool StonesUp()
    {
        if(!Stones.Size())return Game.Released[3];
        let sec=level.Sectors[Stones[0]];
        return sec.floorplane.ZatPoint(sec.centerspot)>=PDAgenticMap.StoneUpFloor()-1;
    }
    static double FloorAt(Vector2 p){return level.PointInSector(p).floorplane.ZatPoint(p);}
    // Her part of the map: the red pool and its stones (71-76, 79, 80), waiting room 77, its step 78
    // and her island 81 (the original E2M2 sector numbers, which the map builder keeps).
    static bool InWaitingRoom(Vector2 p){int s=level.PointInSector(p).Index();return s>=71&&s<=81;}
    bool ClipboardDown(){return Clipboard&&!Clipboard.Flying;}

    // What SPACE does here now: 1 take the survey, 2 hand it over, 3 take the badge, 4 swipe it.
    // Nothing for the dead: SPACE is Doom's respawn then, and the view has turned to whoever killed you.
    bool CanHand(PlayerPawn pawn)
    {
        let smith=Game.Smith;
        if(!smith||Game.Busy()||Game.InConstruct||Game.SmithMode==3||Game.SmithMode==6)return false;
        if(level.time<Game.StunUntil||level.time<Game.RebootUntil||!InWaitingRoom(pawn.Pos.XY))return false;
        return Game.Facing(pawn,smith,112,.6);
    }
    int SpaceDoes(PlayerPawn pawn)
    {
        if(!pawn||pawn.health<=0||Game.Released[3])return 0;
        let reader=Game.Prop(13);
        if(HasBadge&&reader&&Game.Facing(pawn,reader,96,.45))return 4;
        if(Surveying&&!HasBadge&&Game.Smith&&Game.Facing(pawn,Game.Smith,96,.45))return 3;
        if(HasSurvey&&!Surveying&&CanHand(pawn))return 2;
        if(!HasSurvey&&ClipboardDown()&&Game.Facing(pawn,Clipboard,96,.45))return 1;
        return 0;
    }
    override String Prompt(PlayerPawn pawn)
    {
        int a=SpaceDoes(pawn);
        return a==1?"SPACE - take the survey":a==2?"SPACE - hand it the survey":a==3?"SPACE - take its badge":a==4?"SPACE - swipe the badge":"";
    }
    override bool Use(PlayerPawn pawn)
    {
        int a=SpaceDoes(pawn);
        if(a==1)
        {
            HasSurvey=true;Clipboard.Destroy();Clipboard=null;
            pawn.A_StartSound("agentic/pickup",CHAN_ITEM);
            return true;
        }
        if(a==2){HandSurvey(pawn);return true;}
        if(a==3){TakeBadge(pawn);return true;}
        if(a==4){Swipe(pawn);return true;}
        // The reader without a badge: no prompt (SPACE opens nothing), but it answers.
        let reader=Game.Prop(13);
        if(pawn&&pawn.health>0&&!Game.Released[3]&&!HasBadge&&reader&&Game.Facing(pawn,reader,96,.45)){Deny(reader);ReaderWarned=true;return true;}
        return false;
    }
    // The reader without a badge answers SPACE with no prompt: the press is ours, not Doom's own use.
    override bool ClaimsUse(PlayerPawn pawn)
    {
        let reader=Game.Prop(13);
        return pawn&&pawn.health>0&&!Game.Released[3]&&!HasBadge&&reader&&Game.Facing(pawn,reader,96,.45);
    }
    void Deny(Actor reader)
    {
        reader.A_StartSound("agentic/badgeno",CHAN_BODY);Game.Say("AGENTS ONLY",105);
    }
    // It comes off SMITH's lanyard and flies to you; it goes on writing without them (ASMI J).
    void TakeBadge(PlayerPawn pawn)
    {
        HasBadge=true;pawn.A_StartSound("agentic/badgeok",CHAN_ITEM);
        let smith=Game.Smith;if(!smith)return;
        smith.Unbadged=true;
        let badge=PDGraceBadge(Actor.Spawn('PDGraceBadge',smith.Vec3Angle(10,smith.AngleTo(pawn),34)));
        if(badge)badge.Fly(pawn,44,24,6);
    }
    // Into the reader's slot: it turns green, the stones rise (core OpenCell) and she walks over.
    void Swipe(PlayerPawn pawn)
    {
        let reader=Game.Prop(13);Swiped=true;
        let badge=PDGraceBadge(Actor.Spawn('PDGraceBadge',pawn.Vec3Angle(14,pawn.Angle,34)));
        if(badge)badge.Fly(reader,20,8,0);
        reader.Frame=1;reader.A_StartSound("agentic/badgeok",CHAN_BODY);
        Game.Release(3);
    }

    // SMITH must complete every task it is given: it stops where it is and writes.
    void HandSurvey(PlayerPawn pawn)
    {
        let smith=Game.Smith;
        HasSurvey=false;Handed=true;Surveying=true;SurveyFrom=level.time;SurveyUntil=level.time+SurveyTics;Question=1;
        Game.SetSmithMode(5);smith.Angle=smith.AngleTo(pawn);smith.Vel=(0,0,0);SurveySpot=smith.Pos.XY;
        smith.A_StartSound("agentic/scribble",CHAN_BODY);ScribbleAt=level.time+ScribbleTics;
        Game.SetTodo(SurveyTodo());
        Game.Speak("AGENTIC SMITH","A survey? I must complete every task I'm given. Question one.",140,"smith-survey",smith);
        Game.Speak("Katja Grace","Take its badge while it's busy.",140,"katja-badge",Game.Person(3));
    }
    static String Thousands(int n){return n<1000?String.Format("%d",n):String.Format("%d,%03d",n/1000,n%1000);}
    String SurveyTodo(){return "1. COMPLETE SURVEY (Q"..Thousands(Question).." OF 2,778)";}
    void TickSurvey(PlayerPawn pawn)
    {
        if(!Surveying)return;
        // Something else took SMITH over (a reboot, another rescue): the survey is abandoned.
        if(!Game.Smith||Game.SmithMode!=5){EndSurvey(true);return;}
        // Slow through the first questions, then faster and faster: Q2,778 lands as the time runs out.
        double t=clamp((level.time-SurveyFrom)/double(SurveyTics),0.,1.);
        Question=clamp(1+int(2777*t*t*t),1,2778);
        Game.SetTodo(SurveyTodo());
        if(level.time>=ScribbleAt){ScribbleAt=level.time+ScribbleTics;Game.Smith.A_StartSound("agentic/scribble",CHAN_BODY,0,.8);}
        // Done after 20 s, or as soon as you leave her rooms: nobody is left to hide from, so it submits.
        if(level.time>=SurveyUntil||!InWaitingRoom(pawn.Pos.XY))EndSurvey(false);
    }
    void EndSurvey(bool abandoned)
    {
        Surveying=false;let smith=Game.Smith;
        if(!abandoned)
        {
            // Submitted. It looks up for 2 s, then hunts from where it stood (not from where you are), and
            // spawns no subagent for 8 s: Katja may be right beside you.
            Game.SetSmithMode(1);Game.HuntUntil=max(Game.HuntUntil,level.time+210);Game.LastSeen=SurveySpot;
            Game.BlindUntil=max(Game.BlindUntil,level.time+70);Game.LastPossess=level.time;
        }
        if(HasBadge)
        {
            Game.SetTodo("1. COMPLETE SURVEY ✓|2. FIND BADGE");
            if(abandoned)return;
            Game.Speak("AGENTIC SMITH","Survey submitted. Where is my badge?",175,"smith-survey-done",smith);
            // If she is already out this is its badge line; its release remark would say the same again.
            if(Game.Released[3])Game.SmithReact&=~(1<<3);
            return;
        }
        // Finished before you took the badge: Katja tosses another copy onto the shore for another go.
        Game.SetTodo("1. COMPLETE SURVEY ✓|2. CATCH USER");
        if(!Game.Released[3])TossClipboard();
    }
    // Where it lands: StoneShore, or the nearest dry spot of her shore at least 80 u clear of SMITH
    // (standing on it, he would hide it).
    Vector2 LandingSpot()
    {
        Vector2 shore=PDAgenticMap.StoneShore();let smith=Game.Smith;
        if(!smith)return shore;
        double ground=FloorAt(shore);
        for(int row=0;row<3;row++)for(int k=0;k<11;k++)
        {
            Vector2 p=shore+(((k+1)/2)*24*(k%2?1:-1),-row*36);
            if((p-smith.Pos.XY).Length()<80||Game.OverGoop(p,8)||abs(FloorAt(p)-ground)>2||!InWaitingRoom(p))continue;
            return p;
        }
        return shore;
    }
    // From her island onto the shore, under the pool's low ceiling.
    void TossClipboard()
    {
        let katja=Game.Person(3);if(!katja)return;
        Vector2 shore=LandingSpot();
        katja.Angle=atan2(shore.Y-katja.Pos.Y,shore.X-katja.Pos.X);
        katja.Act(3,28);  // her throw (AGRC D) while it leaves her hand
        if(Clipboard)Clipboard.Destroy();
        Clipboard=PDGraceClipboard(Actor.Spawn('PDGraceClipboard',katja.Pos+(0,0,36)));
        if(Clipboard)Clipboard.Toss(shore.X,shore.Y,FloorAt(shore),42,72);
        Tossed=true;Tosses++;
    }

    // The moment you walk into her rooms (Jonathan, 2026-10-23: no need to walk up to the pool), she
    // tosses the clipboard and gives her hint. While the guide is leading you (the core's rule for every hint) the
    // clipboard still comes, and the line waits for the next time she sees you, unless you've used it by then.
    void TickHint(PlayerPawn pawn)
    {
        let katja=Game.Person(3);
        if(Hinted||!katja||Game.Released[3]||Game.InConstruct)return;
        if(!InWaitingRoom(pawn.Pos.XY)){HeardAt=0;return;}
        if(Handed){Hinted=true;return;}
        if(Game.Guide>=0&&!Game.Introduced){if(!Tossed)TossClipboard();return;}
        if(!HeardAt)HeardAt=level.time;
        // Line and toss go together: wait up to 3 s for the speaker box to be free.
        if(!Game.Quiet()&&level.time<HeardAt+105)return;
        Hinted=true;
        if(!Tossed)TossClipboard();
        Game.Speak("Katja Grace","No agent can resist a survey. Next time it comes for you, hand it this.",210,"katja-hint",katja);
    }
    // Walking up to the reader without a badge, it answers once (again after you have walked away).
    void TickReader(PlayerPawn pawn)
    {
        let reader=Game.Prop(13);
        if(!reader||Game.Released[3]||HasBadge)return;
        if(pawn.Distance2D(reader)>144){ReaderWarned=false;return;}
        if(!ReaderWarned&&Game.Facing(pawn,reader,72,.7)){ReaderWarned=true;Deny(reader);}
    }
    // SMITH keeps its hands off her on the stones: no new possession while she crosses (the core's 8 s
    // cooldown then covers her first steps ashore). STOP GENERATING on her also restarts that cooldown,
    // so it is not undone the same tic.
    void TickHands()
    {
        bool now=Game.Possessed[3];
        if(WasPossessed&&!now)Game.LastPossess=level.time;
        WasPossessed=now;
        if(Game.Released[3]&&!Game.LeftCell[3]&&level.time<Game.ReleasedAt[3]+CrossTics)Game.LastPossess=level.time;
    }
    override void Tick(PlayerPawn pawn)
    {
        if(!pawn||pawn.health<=0)return;
        TickHint(pawn);TickSurvey(pawn);TickReader(pawn);TickHands();
    }
    override bool SmithBusy(){return Surveying;}
    // ?puzzle=grace: the core has already put you in hall 41 (SiteSpot 4), facing her waiting-room door.
    override void ApplySite(int site) {}
    // After every Release(3) (the swipe, QA, the hub walk-in, ?puzzle=exit): reader green, no toss, no
    // hint, no clipboard, nothing left to hand over. A survey already running is SMITH's to finish (at most
    // 20 s, sooner if you leave): it keeps him busy while she crosses, and then he notices the badge.
    override void Released()
    {
        Tossed=true;Hinted=true;HasSurvey=false;
        if(Clipboard){Clipboard.Destroy();Clipboard=null;}
        let reader=Game.Prop(13);if(reader)reader.Frame=1;
    }
    // survey: you hold it; surveying: SMITH is filling it in (survey_q); clipboard 0 none, 1 flying, 2 on the
    // floor; katja_hint: her line was spoken; tossed/tosses: clipboards she has thrown.
    // (smith_busy is the core's own field: it already includes this rescue's SmithBusy.)
    override String Json()
    {
        Vector3 c=Clipboard?Clipboard.Pos:(0,0,0);int clip=!Clipboard?0:Clipboard.Flying?1:2;let reader=Game.Prop(13);
        let you=Game.Pawn();bool here=you&&InWaitingRoom(you.Pos.XY);
        return String.Format(",\"survey\":%d,\"badge\":%d,\"stones_up\":%d,\"surveying\":%d,\"survey_q\":%d,\"clipboard\":%d,\"clipboard_x\":%.1f,\"clipboard_y\":%.1f,\"katja_hint\":%d,\"tossed\":%d,\"tosses\":%d,\"swiped\":%d,\"reader_green\":%d,\"in_waiting_room\":%d",
            HasSurvey,HasBadge,StonesUp(),Surveying,Surveying?Question:0,clip,c.X,c.Y,Hinted,Tossed,Tosses,Swiped,reader&&reader.Frame==1,here);
    }
}
