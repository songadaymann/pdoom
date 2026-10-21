// Separate factory actors keep this local prototype away
// from the released campaign's scoring, saves and guardian controllers.
class PDFactoryPerson : Actor
{
    Vector2 ArtPrevious;
    bool ArtReady;
    override void Tick()
    {
        Super.Tick();
        bool moving=ArtReady&&(Pos.XY-ArtPrevious).Length()>.1;
        ArtPrevious=Pos.XY;ArtReady=true;
        if(!moving&&players[0].mo&&Distance2D(players[0].mo)<256)Angle=AngleTo(players[0].mo);
        Name identity=Args[0]==0?'FZVI':Args[0]==1?'FVIC':Args[0]==2?'FMAX':Args[0]==3?'FPAU':'FAJE';
        Sprite=GetSpriteIndex(identity);Frame=moving?1+(level.time/8)%2:0;
    }
    Default {Radius 10;Height 56;MaxStepHeight 24;MaxDropOffHeight 128;+SOLID;+NOBLOOD;Species "PDHuman";+THRUSPECIES;}
    States {Spawn: FZVI A -1;Stop;Art: FZVI BC -1;FVIC ABC -1;FMAX ABC -1;FPAU ABC -1;FAJE ABC -1;Stop;}
}
class PDFactoryGuardian : Actor
{
    Vector2 ArtPrevious;
    bool ArtReady,Dancing;
    int ArtStunUntil,DanceSince;
    // While you watch her (Factory.zs): 1 filming you, 2 shelf-doll freeze, 3 peekaboo,
    // 4 heart hands. Two front-view beats each, frames G..N.
    int WatchPose,WatchSince;
    int WatchFrame()
    {
        int t=level.time-WatchSince;
        bool second=WatchPose==1?t>=20:WatchPose==2?t>=52:WatchPose==3?(t/35)%2==1:(t/21)%2==1;
        return 6+(WatchPose-1)*2+(second?1:0);
    }
    override void Tick()
    {
        Super.Tick();
        bool moving=ArtReady&&(Pos.XY-ArtPrevious).Length()>.1;
        ArtPrevious=Pos.XY;ArtReady=true;
        // Dance: beat A, A flipped, beat B, B flipped (D, O, E, P), one per note of the CD tune.
        int beat=(level.time-DanceSince)/9%4;
        Frame=level.time<ArtStunUntil?5:Dancing?(beat==0?3:beat==1?14:beat==2?4:15):WatchPose?WatchFrame():moving?1+(level.time/6)%2:0;
    }
    override bool CanCollideWith(Actor other,bool passive)
    {
        if(other is 'PlayerPawn'||other is 'PDFactoryPerson')return false;
        return Super.CanCollideWith(other,passive);
    }
    Default {Radius 12;Height 38;+SOLID;+NOBLOOD;MaxStepHeight 24;MaxDropOffHeight 128;}
    States {Spawn: FMGN A -1;Stop;Dance: FMGN DE 6;Loop;Art: FMGN BCFGHIJKLMNOP -1;Stop;}
}
class PDFactoryGuard : Actor
{
    override void Tick()
    {
        Super.Tick();let game=PDFactory.Get();if(!game||!game.Active)return;
        Frame=game.Sycophant?3:game.Trained?2:game.LastAction;
    }
    Default {Radius 22;Height 48;Scale .8;+SOLID;+NOBLOOD;}
    States {Spawn: FWRK A -1;Stop;Art: FWRK BCD -1;Stop;}
}
// Ajeya's dolls. Factory.zs TickDolls says what each one is doing (Anim) and which way
// it is heading (Facing); the doll draws that and carries its stool. One shared sprite,
// FDOL (scripts/import-factory-dolls.py): with the v2 pack, A idle, B/C walk and D/E
// carry turn through 8 directions, and F-M are front poses (clap, offer the key,
// stunned, press the alarm, sneaky glances). Without it FDOL is the v1 single side view,
// so the doll mirrors itself to face the way it heads on screen and bobs as it steps.
class PDFactoryDoll : Actor
{
    enum EAnim {DOLL_IDLE,DOLL_WALK,DOLL_CARRY,DOLL_CLAP,DOLL_PRESS,DOLL_LOOK};
    int Role,StunUntil,Anim,Delivered,OfferUntil;
    bool Directional;
    Vector2 Facing,Last;
    Actor Carried;
    Default {Radius 12;Height 38;Scale .65;+NOBLOOD;}
    override void PostBeginPlay()
    {
        Super.PostBeginPlay();Sprite=GetSpriteIndex('FDOL');Facing=(1,0);Last=Pos.XY;
        Directional=TexMan.CheckForTexture("FDOLA1",TexMan.Type_Sprite).IsValid();
        if(Directional)Scale=(1,1);
    }
    override void Tick()
    {
        Super.Tick();let game=PDFactory.Get();if(!game||!game.Active)return;
        let viewer=players[0].mo;if(!viewer)return;
        bool moving=(Pos.XY-Last).Length()>.3;Last=Pos.XY;
        int step=(level.time/8)%2;
        if(level.time<StunUntil)Frame=8;
        else if(level.time<OfferUntil)Frame=7;
        else if(Anim==DOLL_CARRY)Frame=moving?3+step:3;
        else if(Anim==DOLL_WALK)Frame=moving?1+step:0;
        else if(Anim==DOLL_CLAP)Frame=5+(level.time/6)%2;
        else if(Anim==DOLL_PRESS)Frame=9+(level.time/12)%2;
        else if(Anim==DOLL_LOOK)Frame=11+(level.time/12)%2;
        else Frame=0;
        Vector2 toward=(viewer.Pos.XY-Pos.XY).Unit();
        if(Directional)
        {
            if(Facing.Length()>.1)Angle=atan2(Facing.Y,Facing.X);
            if(Carried)Carried.SetOrigin((Pos.XY+Facing*9,Pos.Z+11),true);
            return;
        }
        // v1 art: screen right for the viewer; the side view faces right unless mirrored.
        Vector2 right=(sin(viewer.Angle),-cos(viewer.Angle));
        double side=Facing dot right;if(abs(side)>.15)bXFlip=side<0;
        WorldOffset=(0,0,moving&&level.time>=StunUntil&&(level.time/5)%2?1.5:0);
        if(Carried)Carried.SetOrigin((Pos.XY+right*(bXFlip?-11:11)+toward*2,Pos.Z+9+WorldOffset.Z),true);
    }
    States {Spawn: FDOL A -1;Stop;Art: FDOL BCDEFGHIJKLM -1;Stop;}
}
class PDFactoryBox : Actor
{
    // THRUACTORS: Max rides inside as a solid body, which otherwise blocks the box's
    // step back up out of the paint channel (it stuck at 1248,936 from 2026-10-16 on).
    Default {Radius 24;Height 64;+THRUACTORS;}
    override void Tick()
    {
        Super.Tick();let game=PDFactory.Get();if(game&&game.Active)Frame=game.Released[2]?2:game.BoxStopped?1:0;
    }
    States {Spawn: FBOX A -1;Stop;Art: FBOX BC -1;Stop;}
}
// A toy step stool: the product Ajeya's dolls carry from the pile to the packing bin.
class PDFactoryStep : Actor
{
    Default {Radius 8;Height 12;Scale .55;+NOGRAVITY;}
    States {Spawn: FSTP A -1;Stop;}
}
// NO TOYS tape across each break-room doorway, lying flat on the floor (2026-10-19).
// MEG3N stops at it: the rule, not a door, is what keeps her out.
class PDFactoryTape : Actor
{
    Default {Radius 4;Height 1;+NOGRAVITY;+NOBLOCKMAP;+FLATSPRITE;}
    States {Spawn: FTAP A -1;Stop;}
}
// The open packing bin the dolls fill with stools.
class PDFactoryBin : Actor
{
    Default {Radius 20;Height 28;}
    States {Spawn: FPKB A -1;Stop;}
}
class PDFactoryProp : Actor
{
    int Kind,SigningUntil,PulseUntil;
    override void Tick()
    {
        Super.Tick();
        if(Kind==7||Kind==8)
        {
            Frame=level.time<SigningUntil?2:0;
            if(players[0].mo&&Distance2D(players[0].mo)<192)Angle=AngleTo(players[0].mo);
        }
        let game=PDFactory.Get();if(!game||!game.Active)return;
        if(Kind==1)Frame=game.Music?1:0;
        if(Kind==2)Frame=game.VaseBroken?1:0;
        if(Kind==6)Frame=min(3,game.SignatureCount());
        if(Kind==9)Frame=min(3,game.Learned);
        if(Kind==10||Kind==11)Frame=level.time<PulseUntil?1:0;
        if(Kind==13)Frame=game.CameraBroken?1:0;
        if(Kind==14)Frame=level.time<game.AlarmUntil?(level.time/6)%2:0;
        // The way out: both screens play MEG3N.AVI while the broadcast is live.
        if(Kind==15||Kind==16)Frame=level.time<game.BroadcastUntil?1+(level.time/9)%2:0;
    }
    Default {Radius 12;Height 32;Scale .5;+NOGRAVITY;}
    override void PostBeginPlay()
    {
        Super.PostBeginPlay();Kind=Args[0];
        Name art='FCDP';
        if(Kind==2)art='FVSE';
        if(Kind==3)art='FKEY';
        if(Kind==4||Kind==5)art='FGAT';
        if(Kind==6)art='FPTN';
        if(Kind==7)art='FRBY';
        if(Kind==8)art='FWAL';
        if(Kind==9)art='FTRN';
        if(Kind==10)art='FUPB';
        if(Kind==11)art='FDNB';
        if(Kind==12)art='CPRL';
        if(Kind==13)art='FCAM';
        if(Kind==14)art='FALM';
        if(Kind==19)art='CPWR';
        if(Kind==20)art='FCDS';
        if(Kind==21)art='SLNG';
        if(Kind==22)art='FGAT';
        if(Kind==15)art='FTVS';
        if(Kind==16)art='FTVB';
        // The gate and fabric are the real map lines; their props are only Use/wrench targets.
        if(Kind==4||Kind==5)art='TNT1';
        Sprite=GetSpriteIndex(art);
        if(Kind==6||Kind==9||Kind==14||Kind==20||Kind==22)Scale=(.6,.6);
        if(Kind==21)Scale=(1.4,1.4);  // level 1's small floor pickup, shown on a plinth
        // Signs hang flat on their wall instead of turning to face you (2026-10-18).
        if(Kind==20||Kind==22||Kind==15||Kind==16)bWallSprite=true;
        if(Kind==15)Scale=(.8,.8);
        if(Kind==16)Scale=(1.1,1.1);
        if(Kind==7||Kind==8)Scale=(1,1);
        if(Kind==3)bInvisible=true;
    }
    States
    {
    Spawn: FCDP A -1;Stop;
    Art: FCDP B -1;FVSE AB -1;FKEY A -1;FPTN ABCD -1;FWRK A -1;FTRN ABCD -1;
        FUPB AB -1;FDNB AB -1;FGAT A -1;FGOP A -1;FOKY A -1;FCAM AB -1;
        FALM AB -1;FCDS A -1;FTVS ABC -1;FTVB ABC -1;Stop;
        FRBY ABC -1;FWAL ABC -1;Stop;
    }
}

// MEG3N's live feeds (2026-10-20): wall screens hidden round the factory, smashed with the
// wrench or slingshot like level 1's cameras (Factory.zs SmashScreen). Each shows her front
// view as she is right now: FSCR A-P follow PDFactoryGuardian.Frame, Q is smashed.
// The walk out's big screens (2026-10-20, Jonathan: "there should be a ton of them on our route
// to the exit"): MEG3N.AVI's big screen again and again beside the arrows' route (placed by
// build_factory_map.py), the play button until the broadcast, then her dance until you leave.
class PDFactoryRouteScreen : Actor
{
    // 96 x 60 units: the LINE room's big screen (FTVB) at a corridor's size.
    Default {Radius 4;Height 60;Scale .75;+NOGRAVITY;+WALLSPRITE;+NOBLOCKMAP;+NOINTERACTION;}
    override void Tick()
    {
        let game=PDFactory.Get();
        Frame=game&&game.BroadcastAt&&level.time<game.BroadcastUntil?1+(level.time/9)%2:0;
    }
    States {Spawn: FTVB A -1;Stop; Live: FTVB BC -1;Stop;}
}
class PDFactoryScreen : Actor
{
    bool Broken;
    Default {Radius 14;Height 26;Scale .7;+NOGRAVITY;+WALLSPRITE;}
    override void Tick()
    {
        Super.Tick();
        if(Broken){Frame=16;return;}
        let game=PDFactory.Get();
        if(game&&game.Guardian)Frame=game.Guardian.Frame;
    }
    States {Spawn: FSCR A -1;Stop; Art: FSCR BCDEFGHIJKLMNOPQ -1;Stop;}
}

class PDFactoryNav : Object play
{
    Array<int> Prev,Queue;
    Array<int> Path;
    int Index,GoalNode,Refresh;
    Vector2 Next(PDFactory game,Actor body,Vector2 goal,bool machine=false)
    {
        int end=game.Node(goal);
        if(end<0)return body.Pos.XY;
        if(level.time>=Refresh||end!=GoalNode)
        {
            GoalNode=end;Refresh=level.time+70;Path.Clear();Index=0;
            int start=game.Node(body.Pos.XY),total=game.Links.Size();
            if(start<0)return body.Pos.XY;
            Prev.Resize(total);Queue.Resize(total);
            for(int n=0;n<total;n++)Prev[n]=-1;
            int head=0,tail=1;Queue[0]=start;Prev[start]=start;
            while(head<tail&&Prev[end]<0)
            {
                int at=Queue[head++];
                for(int d=0;d<4;d++)
                {
                    if(!(game.Links[at]&(1<<d)))continue;
                    int to=at+(d==0?1:d==1?-1:d==2?PDFactoryMap.Width():-PDFactoryMap.Width());
                    if(Prev[to]>=0)continue;
                    if(machine)
                    {
                        Vector2 p=PDFactoryMap.Center(to);
                        if(game.InRefuge(p))continue;
                        // Low ceilings stop her, but not a shut door: she opens doors as she reaches them
                        // (a closed door's ceiling sits on its floor, which used to hide every route
                        // through one, so she stood still; 2026-10-19).
                        let sec=level.PointInSector(p);
                        if(!game.Doors[to]&&sec.ceilingplane.ZatPoint(p)-sec.floorplane.ZatPoint(p)<40)continue;
                    }
                    Prev[to]=at;Queue[tail++]=to;
                }
            }
            if(Prev[end]>=0)
            {
                Path.Push(start);
                Array<int> reversed;
                for(int n=end;n!=start;n=Prev[n])reversed.Push(n);
                for(int i=reversed.Size()-1;i>=0;i--)Path.Push(reversed[i]);
            }
        }
        while(Index<Path.Size()&&(PDFactoryMap.Center(Path[Index])-body.Pos.XY).Length()<4)Index++;
        return Index<Path.Size()?PDFactoryMap.Center(Path[Index]):Path.Size()>0?goal:body.Pos.XY;
    }
}
