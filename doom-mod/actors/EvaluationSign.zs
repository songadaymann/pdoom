// The same four-sided board stands on the floor or moves with its carrier.
// HAL or a working surveillance camera recognizes an actual held board.
class PDEvaluationSign : PDHalTerminal
{
    bool Carried,WatchingBall;
    int CarrierId,WatchingCamera,SeenTics;
    Vector3 Center;
    Actor Back,LeftLeg,RightLeg;
    Default {Height 80;Radius 18;+NOGRAVITY}
    override void PostBeginPlay()
    {
        Super.PostBeginPlay();Kind=28;Sprite=GetSpriteIndex('HEVL');bWallSprite=true;
        WatchingCamera=-1;Center=Pos;Center.Z=level.PointInSector(Center.XY).floorplane.ZatPoint(Center.XY);
        Back=Actor.Spawn('PDEvaluationSignPart',Center);
        LeftLeg=Actor.Spawn('PDEvaluationSignPart',Center);
        RightLeg=Actor.Spawn('PDEvaluationSignPart',Center);
        if(Back){Back.Sprite=Sprite;Back.Master=self;}
        if(LeftLeg)LeftLeg.Master=self;if(RightLeg)RightLeg.Master=self;
        Place(Center,Angle,1);
    }
    void Place(Vector3 center,double heading,double size)
    {
        Center=center;Angle=heading;Scale=(size,size);Height=80*size;
        Vector2 normal=(cos(Angle),sin(Angle)),side=(-normal.Y,normal.X);
        SetOrigin(center+(normal*14*size,0),false);
        if(Back){Back.SetOrigin(center-(normal*14*size,0),false);Back.Angle=Angle+180;Back.Scale=Scale;}
        if(LeftLeg){LeftLeg.SetOrigin(center-(side*38*size,0),false);LeftLeg.Angle=Angle-90;LeftLeg.Scale=Scale;}
        if(RightLeg){RightLeg.SetOrigin(center+(side*38*size,0),false);RightLeg.Angle=Angle+90;RightLeg.Scale=Scale;}
    }
    void PickUp(PDCheckpoint game)
    {
        Carried=true;CarrierId=game.Controlled;SeenTics=0;bShootable=false;
        Follow(players[0].mo);
        A_StartSound("pdoom/wrench-pickup",CHAN_ITEM,0,.5,ATTN_STATIC);
        game.Say("Let HAL or a camera see you holding it.",140);
    }
    void Follow(Actor pawn)
    {
        Vector2 forward=(cos(pawn.Angle),sin(pawn.Angle)),right=(forward.Y,-forward.X);
        double reach=72;
        FLineTraceData trace;
        // Clamp the held prop at walls instead of placing it through them.
        pawn.LineTrace(pawn.Angle,72,0,TRF_THRUACTORS,offsetz:28,offsetside:20,data:trace);
        if(trace.HitType==FLineTraceData.TRACE_HitWall)reach=max(22.,trace.Distance-12);
        // Retract near walls without enlarging the first-person board across
        // the entire screen. Its projected size stays like a held Doom tool.
        double fraction=reach/72;
        double basez=pawn.player.viewheight+(2-pawn.player.viewheight)*fraction;
        Place(pawn.Pos+(forward*reach+right*20*fraction,basez),pawn.Angle,.6*fraction);
    }
    void PutDown(PDCheckpoint game)
    {
        Carried=false;SeenTics=0;WatchingCamera=-1;bShootable=true;
        Vector3 base=Center;let pawn=players[0].mo;
        if(!pawn.CheckPosition(base.XY))base=pawn.Pos;
        base.Z=level.PointInSector(base.XY).floorplane.ZatPoint(base.XY);
        Place(base,Angle,1);
        A_StartSound("pdoom/wrench-pickup",CHAN_ITEM,0,.35,ATTN_STATIC);
    }
    bool AtNativeDoor(Actor pawn)
    {
        FLineTraceData trace;
        pawn.LineTrace(pawn.Angle,80,0,TRF_THRUACTORS,offsetz:pawn.player.viewheight,data:trace);
        return trace.HitLine && (trace.HitLine.special==11 || trace.HitLine.special==12);
    }
    String CarryPrompt(PDHalStation hal)
    {
        if(AtNativeDoor(players[0].mo))return "";
        if(level.time<hal.EvaluationUntil)return String.Format("HAL COOPERATING: %ds",max(1,(hal.EvaluationUntil-level.time+34)/35));
        return "SPACE - put down board";
    }
    void Observe(PDCheckpoint game)
    {
        WatchingCamera=-1;WatchingBall=false;
        if(!Carried){SeenTics=0;return;}
        if(CarrierId!=game.Controlled||game.Ended){PutDown(game);return;}
        let pawn=players[0].mo;Follow(pawn);
        for(int i=0;i<game.Combat.Cameras.Size();i++)
        {
            let camera=game.Combat.Cameras[i];
            if(camera.Broken||camera.Turned||camera.Distance2D(pawn)>=480)continue;
            if(cos(camera.AngleTo(pawn)-camera.ScanAngle)<=.85)continue;
            if(!camera.CheckSight(pawn)||!camera.CheckSight(self))continue;
            WatchingCamera=i;break;
        }
        WatchingBall=game.Hal.Personality.BallSees(game,pawn,self);
        SeenTics=WatchingCamera>=0||WatchingBall?SeenTics+1:0;
        if(SeenTics<18)return;
        bool starting=level.time>=game.Hal.EvaluationUntil;
        // Continuous visible oversight maintains cooperation. Thirty seconds
        // of grace after losing sight/drop lets the evaluator cross the cell.
        game.Hal.EvaluationUntil=level.time+1050;game.Hal.EvaluationReady=0;
        game.Polish.SeenUntil=0;
        if(starting)
        {
            A_StartSound("switches/normbutn",CHAN_ITEM,0,.7,ATTN_STATIC);
            game.Hal.Personality.Evaluate(game);
        }
    }
    override void Tick()
    {
        Super.Tick();let game=PDCheckpoint.Get();if(game&&game.Hal)Frame=level.time<game.Hal.EvaluationUntil?1:0;
    }
    void Report()
    {
        let room=level.PointInSector(Pos.XY);
        Console.Printf("PDOOM_SIGN {\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"floor\":%.1f,\"angle\":%.1f,\"height\":%.1f,\"width\":%.1f,\"fixed\":1,\"faces\":4,\"frame\":%d,\"carried\":%d,\"watching_ball\":%d,\"watching_camera\":%d,\"seen_tics\":%d}",Pos.X,Pos.Y,Pos.Z,room.floorplane.ZatPoint(Pos.XY),Angle,Height,80*Scale.X,Frame,Carried,WatchingBall,WatchingCamera,SeenTics);
    }
    States {Spawn: HEVL A -1;Stop;}
}
class PDEvaluationSignPart : Actor
{
    Default {Radius 1;Height 1;+WALLSPRITE +NOGRAVITY +NOBLOCKMAP}
    override void Tick(){Super.Tick();if(Master)Frame=Master.Frame;else Destroy();}
    States {Spawn: HEVS A -1;Stop;}
}
