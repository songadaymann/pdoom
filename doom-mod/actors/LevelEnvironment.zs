// Environmental dressing has no rescue state, AI targets, collision or UI cards.
class PDLabPoster : Actor
{
    Default { Radius 1; Height 96; +WALLSPRITE +NOGRAVITY +NOBLOCKMAP +NOINTERACTION +DONTSPLASH }
    override void PostBeginPlay()
    {
        Super.PostBeginPlay();Frame=clamp(Args[0]-1,0,19);Angle+=Args[4]/10000.;
    }
    States { Spawn: PDPS A -1; Stop; }
}
class PDQuietTerminal : Actor
{
    int Age;
    Default { Radius 1; Height 32; Scale .5; +WALLSPRITE +NOGRAVITY +NOBLOCKMAP +NOINTERACTION +DONTSPLASH }
    override void PostBeginPlay(){Super.PostBeginPlay();Angle+=Args[4]/10000.;Age=int(abs(Pos.X+Pos.Y))%100;}
    override void Tick(){Super.Tick();Age++;Frame=(Age/18)%4;}
    States { Spawn: PDTC A -1; Stop; }
}
class PDBrokenLight : Actor
{
    int Baseline;
    Default { Radius 1; Height 1; +NOGRAVITY +NOBLOCKMAP +NOINTERACTION +DONTSPLASH }
    override void PostBeginPlay()
    {
        Super.PostBeginPlay();Baseline=level.PointInSector(Pos.XY).lightlevel;
        // Native slow, irregular flicker; retain sufficient light to navigate.
        Light_Flicker(Args[1],Baseline,max(96,Baseline-32));
        bInvisible=true;
    }
    States { Spawn: TNT1 A -1; Stop; }
}
class PDSteamVent : Actor
{
    Default { Radius 1; Height 1; +FLATSPRITE +NOGRAVITY +NOBLOCKMAP +NOINTERACTION +DONTSPLASH }
    States { Spawn: PDVN A -1; Stop; }
}
class PDSteamEmitter : Actor
{
    int Age,Spawned;
    Default { Radius 1; Height 1; +NOGRAVITY +NOBLOCKMAP +NOINTERACTION +DONTSPLASH }
    override void PostBeginPlay(){Super.PostBeginPlay();bInvisible=true;Age=int(abs(Pos.X*3+Pos.Y))%210;}
    override void Tick()
    {
        Super.Tick();Age++;
        if(!players[0].mo||Distance2D(players[0].mo)>640)return;
        // Short intermittent leaks, capped particle life, no corridor-wide hiss.
        if(Age%210<90&&Age%9==0)
        {
            let puff=Actor.Spawn('PDSteamPuff',Pos+(Random(-3,3),Random(-3,3),4));
            if(puff){puff.Vel=(.08,.04,.65);puff.Frame=(Age/9)%4;Spawned++;}
        }
    }
    States { Spawn: TNT1 A -1; Stop; }
}
class PDSteamPuff : Actor
{
    int Age;
    Default { Radius 1; Height 1; Scale .35; Alpha .5; RenderStyle "Translucent"; +NOGRAVITY +NOBLOCKMAP +NOCLIP +DONTSPLASH }
    override void Tick()
    {
        Super.Tick();Age++;Scale=(.35+Age*.014,.35+Age*.014);Alpha=.5*(1.-Age/48.);
        if(Age>=48||Pos.Z+12>=CeilingZ)Destroy();
    }
    // Keep pale vapor readable in the original map's unlit corridors.
    States { Spawn: PDST A -1 Bright; Stop; }
}
class PDCivilianChess : Actor
{
    int Age,Wins;
    Default { Radius 1; Height 64; Scale .5; +WALLSPRITE +NOGRAVITY +NOBLOCKMAP +NOINTERACTION +DONTSPLASH }
    override void Tick()
    {
        Super.Tick();Age++;int phase=Age%350;
        Frame=phase<140?0:phase<190?1:phase<260?2:3;
        if(phase==190)Wins++;
        // Piece taps are quiet, positional, and only emitted within this room's
        // immediate listening area. No voice loop competes with HAL/TEABOT.
        if((phase==150||phase==290)&&players[0].mo&&Distance2D(players[0].mo)<240&&CheckSight(players[0].mo))
            A_StartSound("pdoom/chess-piece",CHAN_BODY,0,.18,ATTN_STATIC);
    }
    States { Spawn: PDCS A -1; Stop; }
}
class PDEnvironmentReport : EventHandler
{
    override void WorldTick()
    {
        if(level.time%35!=0||!players[0].mo)return;
        int posters,monitors,vents,puffs,chess,phase=-1,wins;String lights="[";double steamRise;
        let actors=ThinkerIterator.Create('PDLabPoster');while(actors.Next())posters++;
        actors=ThinkerIterator.Create('PDQuietTerminal');while(actors.Next())monitors++;
        actors=ThinkerIterator.Create('PDSteamEmitter');while(actors.Next())vents++;
        actors=ThinkerIterator.Create('PDSteamPuff');PDSteamPuff puff;
        while((puff=PDSteamPuff(actors.Next()))){puffs++;steamRise=max(steamRise,puff.Pos.Z-level.PointInSector(puff.Pos.XY).floorplane.ZatPoint(puff.Pos.XY));}
        actors=ThinkerIterator.Create('PDBrokenLight');PDBrokenLight fixture;
        while((fixture=PDBrokenLight(actors.Next()))){if(lights!="[")lights=lights .. ",";lights=lights .. String.Format("%d",level.PointInSector(fixture.Pos.XY).lightlevel);}
        actors=ThinkerIterator.Create('PDCivilianChess');PDCivilianChess civilian;
        while((civilian=PDCivilianChess(actors.Next()))){chess++;phase=civilian.Frame;wins=civilian.Wins;}
        Console.Printf("PDOOM_ENVIRONMENT {\"posters\":%d,\"terminals\":%d,\"vents\":%d,\"steam_puffs\":%d,\"steam_rise\":%.1f,\"lights\":%s],\"civilian_robots\":%d,\"chess_pose\":%d,\"chess_wins\":%d}",posters,monitors,vents,puffs,steamRise,lights,chess,phase,wins);
    }
}
