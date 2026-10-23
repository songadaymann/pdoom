// Level 4, AGENTIC SMITH's pod farm (E2M2, docs/LEVEL-04.md): the core's actors, a copy of
// FactoryActors.zs. Agentic.zs (PDAgentic) runs them; the five rescues (Agentic<Name>.zs) set
// the frames of their own props. Sprites are the A family (scripts/import-agentic-art.py, with
// procedural fallbacks from scripts/build-agentic-assets.py); every one is listed in an Art: state.
class PDAgenticPerson : Actor
{
    Vector2 ArtPrevious;
    bool ArtReady;
    int ActFrame,ActUntil;   // a one-off pose a rescue shows for a moment (Katja's throw, AGRC D)
    void Act(int frame,int tics){ActFrame=frame;ActUntil=level.time+tics;}
    override void Tick()
    {
        Super.Tick();
        bool moving=ArtReady&&(Pos.XY-ArtPrevious).Length()>.1;
        ArtPrevious=Pos.XY;ArtReady=true;
        if(!moving&&players[0].mo&&Distance2D(players[0].mo)<256)Angle=AngleTo(players[0].mo);
        int site=Args[0];
        Name identity=site==0?'ATAL':site==1?'ABOS':site==2?'AKOK':site==3?'AGRC':'ABEN';
        Sprite=GetSpriteIndex(identity);Frame=level.time<ActUntil?ActFrame:moving?1+(level.time/8)%2:0;
    }
    Default {Radius 10;Height 56;MaxStepHeight 24;MaxDropOffHeight 128;+SOLID;+NOBLOOD;Species "PDHuman";+THRUSPECIES;}
    States {Spawn: ATAL A -1;Stop;Art: ATAL BC -1;ABOS ABC -1;AKOK ABC -1;AGRC ABCD -1;ABEN ABC -1;Stop;}
}
// AGENTIC SMITH. Pose (set by Agentic.zs from SmithMode) picks a frame: -1 walks/idles,
// 3 D grab, 4 E stunned, 5 F earpiece (reading its list), 6 G survey, 7 H possess (bright), 8 I reboot.
// Once Katja's rescue has taken its badge (Unbadged) it shows ASMU, the same frames without it (G the
// survey without lanyard or badge); without ASMU art, only the survey changes, to ASMI J.
// Materialising at a camera, it fades in out of a green glyph column (PDAgenticDissolve).
class PDAgenticSmith : Actor
{
    Vector2 ArtPrevious;
    bool ArtReady,FadeIn,Unbadged,UnbadgedArt;
    int Pose;
    override void PostBeginPlay(){Super.PostBeginPlay();Pose=-1;UnbadgedArt=TexMan.CheckForTexture("ASMUA1",TexMan.Type_Sprite).IsValid();}
    override void Tick()
    {
        Super.Tick();
        bool moving=ArtReady&&(Pos.XY-ArtPrevious).Length()>.1;
        ArtPrevious=Pos.XY;ArtReady=true;
        Frame=Pose>=0?Pose:moving?1+(level.time/6)%2:0;
        Sprite=GetSpriteIndex(Unbadged&&UnbadgedArt?'ASMU':'ASMI');
        if(Frame==6&&Unbadged&&!UnbadgedArt)Frame=9;
        bBright=Frame==7;
        if(FadeIn){Alpha=min(1,Alpha+.045);if(Alpha>=1){FadeIn=false;A_SetRenderStyle(1,STYLE_Normal);}}
    }
    // Like MEG3N, it passes through you and your people: it can't trap anyone; its touch is scripted.
    override bool CanCollideWith(Actor other,bool passive)
    {
        if(other is 'PlayerPawn'||other is 'PDAgenticPerson')return false;
        return Super.CanCollideWith(other,passive);
    }
    Default {Radius 12;Height 56;+SOLID;+NOBLOOD;MaxStepHeight 24;MaxDropOffHeight 128;}
    States {Spawn: ASMI A -1;Stop;Art: ASMI BCDEFGHIJ -1;ASMU ABCDEFGHIJ -1;Stop;}
}
// SMITH's eyes (15403): Args[0] index 0-9, Args[1] flags (1 behind glass, 2 the refuge door camera,
// dormant until the exit). ACAM A watching, B reporting, C smashed, D dormant (lens and lights dark, the
// door camera until the exit arms it), E behind glass (C6, lit while it reports); level 1's CPCA/CPCB
// without them.
class PDAgenticCamera : Actor
{
    double ScanAngle;
    bool Broken,Own,On;
    int SeenUntil;
    Default {Radius 12;Height 24;Scale .5;+NOGRAVITY;+WALLSPRITE;+NOBLOOD;}
    override void PostBeginPlay()
    {
        Super.PostBeginPlay();ScanAngle=Angle;On=!(Args[1]&2);
        Own=TexMan.CheckForTexture("ACAMA0",TexMan.Type_Sprite).IsValid();
        if(!Own)Scale=(.7,.7);
    }
    override void Tick()
    {
        Super.Tick();
        bool seen=On&&!Broken&&level.time<SeenUntil;
        if(Own){Sprite=GetSpriteIndex('ACAM');Frame=Broken?2:Args[1]&1?4:!On?3:seen?1:0;}
        else{Sprite=GetSpriteIndex(Broken?'CPCB':'CPCA');Frame=!Broken&&seen?1:0;}
        bBright=seen;
    }
    States {Spawn: ACAM A -1;Stop;Art: ACAM BCDE -1;CPCA AB -1;CPCB A -1;Stop;}
}
// Every prop is one class (15402), Args[0] = kind (contract section 4). The core picks the sprite
// and draws its own kinds (pickups, the refuge payphone); each rescue sets Frame on its own kinds.
class PDAgenticProp : Actor
{
    int Kind;
    Default {Radius 12;Height 32;Scale .5;+NOGRAVITY;}
    static Name PropArt(int k)
    {
        if(k==1)return 'CPWR';if(k==2)return 'SLNG';if(k==3)return 'APIL';
        if(k==4||k==9||k==22)return 'APOD';if(k==5)return 'ADRM';if(k==6||k==21)return 'APHN';
        if(k==7||k==8)return 'ACHR';if(k==10)return 'AHRV';if(k==11||k==12)return 'ASGN';
        if(k==13)return 'ARDR';if(k==14)return 'ASRV';if(k==16)return 'AVTB';if(k==17)return 'AARM';
        if(k>=18&&k<=20)return 'ASKT';if(k==23)return 'ABAT';if(k==24||k==25)return 'ANOT';
        return 'TNT1';
    }
    override void PostBeginPlay()
    {
        Super.PostBeginPlay();Kind=Args[0];
        Sprite=GetSpriteIndex(PropArt(Kind));
        Frame=Kind==4?3:Kind==9||Kind==12||Kind==19||Kind==25?1:Kind==20?2:0;
        // Pods at full size; the wrench and slingshot lie on the floor at level 1's pickup size.
        if(Kind<=2||Kind==4||Kind==9||Kind==10||Kind==22)Scale=(1,1);
        if(Kind==17)Scale=(.7,.7);
        // Phones, sockets and notes hang flat on their wall.
        if(Kind==6||Kind==21||Kind>=18&&Kind<=20||Kind==24||Kind==25)bWallSprite=true;
        // The Construct's chair: the importer's pre-whitened frame B, or the white translation without it.
        if(Kind==8){if(TexMan.CheckForTexture("ACHRB0",TexMan.Type_Sprite).IsValid())Frame=1;else A_SetTranslation('PDConstructWhite');}
    }
    override void Tick()
    {
        Super.Tick();
        if(Kind!=21)return;
        let game=PDAgentic.Get();if(!game||!game.Active)return;
        // The refuge payphone: rings in bursts (B) while everyone is safe, off the hook (C) once answered.
        Frame=game.ExitDone?2:game.PhoneRinging&&(level.time-game.RingFrom)%70<52?1:0;
    }
    States
    {
    Spawn: APOD A -1;Stop;
    Art: CPWR A -1;SLNG A -1;APIL A -1;APOD BCD -1;ADRM ABC -1;APHN ABC -1;ACHR AB -1;AHRV AB -1;
        ASGN ABCD -1;ARDR AB -1;ASRV A -1;AVTB A -1;AARM ABCDE -1;ASKT ABCDEF -1;ABAT A -1;ANOT AB -1;ABDG A -1;ACBL ABC -1;Stop;
    }
}
// Set dressing (15404): Args[0] picks a TRNSLATE colourway PDAgenticDecor<n> (scripts/agentic_theme.py),
// Args[1] the shape: 0 battery cell, 1 server rack (Doom's tall tech column), 2 short tech column (COLU: DOOM.WAD has no TLP2).
// Scenery only: not solid, so escorts and SMITH's routes stay as the nav graph says.
class PDAgenticDecor : Actor
{
    Default {Radius 12;Height 40;+NOBLOCKMONST;+DONTSPLASH;}
    override void PostBeginPlay()
    {
        Super.PostBeginPlay();
        A_SetTranslation(String.Format("PDAgenticDecor%d",Args[0]));
        if(Args[1]==1){Sprite=GetSpriteIndex('ELEC');Scale=(.75,.75);}   // a 96-tall server rack: these halls are ~104 high
        if(Args[1]==2)Sprite=GetSpriteIndex('COLU');
    }
    States {Spawn: ABAT A -1;Stop;Art: ELEC A -1;COLU A -1;Stop;}
}
// SMITH's loading spinner over a possessed person's head (ASPN A-H, green).
class PDAgenticSpinner : Actor
{
    Actor Host;
    Default {Radius 2;Height 2;Scale .6;+NOINTERACTION;+NOGRAVITY;+BRIGHT;}
    override void Tick()
    {
        if(!Host){Destroy();return;}
        SetOrigin(Host.Pos+(0,0,Host.Height+6),true);Frame=(level.time/3)%8;
    }
    States {Spawn: ASPN A -1 Bright;Stop;Art: ASPN BCDEFGH -1;Stop;}
}
// The green glyph column SMITH materialises out of (and leaves behind).
class PDAgenticDissolve : Actor
{
    Default {Radius 2;Height 64;+NOINTERACTION;+NOGRAVITY;+BRIGHT;RenderStyle "Add";Alpha .9;}
    States {Spawn: ADIS ABCDABCDABCD 3 Bright;Stop;}
}

// PDFactoryNav on PDAgenticMap's grid. With machine=true (SMITH) it never plans into the refuge,
// nor through a low ceiling unless that cell is an ordinary door.
class PDAgenticNav : Object play
{
    Array<int> Prev,Queue;
    Array<int> Path;
    int Index,GoalNode,Refresh;
    bool NoPath;   // the last plan found no way to its goal (SMITH then drops that hunt or alarm)
    Vector2 Next(PDAgentic game,Actor body,Vector2 goal,bool machine=false)
    {
        int end=game.Node(goal);
        if(end<0){NoPath=true;return body.Pos.XY;}
        if(level.time>=Refresh||end!=GoalNode)
        {
            GoalNode=end;Refresh=level.time+70;Path.Clear();Index=0;
            int start=game.Node(body.Pos.XY),total=game.Links.Size();
            if(start<0)return body.Pos.XY;
            Prev.Resize(total);Queue.Resize(total);
            for(int n=0;n<total;n++)Prev[n]=-1;
            int head=0,tail=1;Queue[0]=start;Prev[start]=start;
            int width=PDAgenticMap.Width(),refuge=PDAgenticMap.RefugeDoor();
            while(head<tail&&Prev[end]<0)
            {
                int at=Queue[head++];
                for(int d=0;d<4;d++)
                {
                    if(!(game.Links[at]&(1<<d)))continue;
                    int to=at+(d==0?1:d==1?-1:d==2?width:-width);
                    if(to<0||to>=total||Prev[to]>=0)continue;
                    if(machine)
                    {
                        Vector2 p=PDAgenticMap.Center(to);
                        if(PDAgenticMap.InRefuge(p)||game.Doors[to]==refuge&&refuge)continue;
                        let sec=level.PointInSector(p);
                        if(!game.Doors[to]&&sec.ceilingplane.ZatPoint(p)-sec.floorplane.ZatPoint(p)<56)continue;
                    }
                    Prev[to]=at;Queue[tail++]=to;
                }
            }
            NoPath=Prev[end]<0;
            if(Prev[end]>=0)
            {
                Path.Push(start);
                Array<int> reversed;
                for(int n=end;n!=start;n=Prev[n])reversed.Push(n);
                for(int i=reversed.Size()-1;i>=0;i--)Path.Push(reversed[i]);
            }
        }
        while(Index<Path.Size()&&(PDAgenticMap.Center(Path[Index])-body.Pos.XY).Length()<4)Index++;
        return Index<Path.Size()?PDAgenticMap.Center(Path[Index]):Path.Size()>0?goal:body.Pos.XY;
    }
}
