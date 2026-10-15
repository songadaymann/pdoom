// Rob's puzzle is a visible service routine, not a stealth/timing interaction.
// The machine chooses the button by its label; STOP releases the cell interlock.
class PDTeaService : Object play
{
    PDTeaBot Bot;
    PDTeaPanel Panel;
    Actor FillingCup;
    int Phase,PhaseAt,Served,Pressed;
    bool Swapped,Stopped,Carrying;

    void Load()
    {
        let bots=ThinkerIterator.Create('PDTeaBot');Bot=PDTeaBot(bots.Next());
        let panels=ThinkerIterator.Create('PDTeaPanel');Panel=PDTeaPanel(panels.Next());
    }
    String Prompt()
    {
        return Stopped||Swapped?"":"SPACE - swap labels";
    }
    void Swap(PDCheckpoint game)
    {
        if(Swapped||Stopped)return;
        Swapped=true;game.Hal.Labels=3;
        if(Panel){Panel.Frame=1;Panel.A_StartSound("switches/normbutn",CHAN_BODY,0,.4,ATTN_STATIC);}
        // The player does not open the door. The bot must actually press STOP.
        Console.Printf("PDOOM_EVENT {\"type\":\"tea-labels-swapped\"}");
    }
    void PressStop(PDCheckpoint game,String route)
    {
        if(Stopped)return;
        Stopped=true;Phase=6;Carrying=false;
        if(FillingCup){FillingCup.Destroy();FillingCup=null;}
        if(Bot){Bot.Frame=0;Bot.Vel=(0,0,0);}
        if(Panel)Panel.A_StartSound("switches/normbutn",CHAN_BODY,0,.4,ATTN_STATIC);
        game.OpenCell(0,route);
        Console.Printf("PDOOM_EVENT {\"type\":\"tea-stop-pressed\",\"route\":\"%s\"}",route);
    }
    bool MoveTo(Vector2 goal)
    {
        Vector2 d=goal-Bot.Pos.XY;
        if(d.Length()<2)return true;
        Bot.Angle=atan2(d.Y,d.X);
        Bot.TryMove(Bot.Pos.XY+d/d.Length()*min(1.7,d.Length()),0);
        return false;
    }
    void Tick(PDCheckpoint game)
    {
        if(!Bot||!Panel||Stopped)return;
        Bot.Frame=Carrying?1:0;
        if(Phase==0)
        {
            // Green is the north button, red is the south button on the wall.
            Vector2 goal=Swapped?(-422,-180):(-410,-134);
            if(MoveTo(goal)){Pressed=Swapped?2:1;Phase=1;PhaseAt=level.time+35;Bot.Angle=345;}
        }
        else if(Phase==1)
        {
            Bot.Frame=2;
            if(level.time>=PhaseAt)
            {
                Panel.A_StartSound("switches/normbutn",CHAN_BODY,0,.4,ATTN_STATIC);
                if(Pressed==2){PressStop(game,"teabot");return;}
                FillingCup=Actor.Spawn('PDTeaCup',(-368,-142,24));
                if(FillingCup){FillingCup.bNoGravity=true;FillingCup.Scale=(.35,.35);}
                Phase=2;PhaseAt=level.time+70;
            }
        }
        else if(Phase==2)
        {
            // Cup fills in the dispenser's recess before it is taken away.
            if(FillingCup)
            {
                FillingCup.Scale=(.65,.65);
                if(level.time%7==0)
                {
                    let tea=Actor.Spawn('PDTeaDrop',(-368,-142,39));
                    if(tea)tea.Vel=(0,0,-1.8);
                }
            }
            if(level.time>=PhaseAt)
            {
                if(FillingCup){FillingCup.Destroy();FillingCup=null;}
                Carrying=true;Phase=3;
            }
        }
        else if(Phase==3)
        {
            if(MoveTo((-436,-32))){Phase=4;PhaseAt=level.time+24;Bot.Angle=150;}
        }
        else if(Phase==4)
        {
            if(level.time>=PhaseAt)
            {
                Carrying=false;Served++;
                let cup=Actor.Spawn('PDTeaDiscard',Bot.Pos+(-8,4,22));
                if(cup)cup.Vel=(-1.1,.5,1);
                Phase=5;PhaseAt=level.time+35;
                Console.Printf("PDOOM_EVENT {\"type\":\"tea-cup-discarded\",\"cups\":%d}",Served);
            }
        }
        else if(Phase==5)
        {
            Bot.Frame=2;
            if(level.time>=PhaseAt)Phase=0;
        }
    }
}
class PDTeaBot : Actor
{
    // Harmless service hardware: no attack, target acquisition or damage state.
    Default {Radius 10;Height 42;+NOGRAVITY +THRUACTORS}
    States {Spawn: TEAB A -1;Stop; CarryArt: TEAB B -1;Stop; PressArt: TEAB C -1;Stop;}
}
class PDTeaPanel : PDCheckpointProp
{
    Default {Health 25;Radius 16;Height 64;Scale .5;+SHOOTABLE +NOBLOOD +WALLSPRITE}
    override void PostBeginPlay(){Super.PostBeginPlay();Kind=20;}
    // Only the robot presses STOP (after the label swap); shooting the panel does nothing.
    override int DamageMobj(Actor inflictor,Actor source,int damage,Name mod,int flags,double angle){return 0;}
    States {Spawn: TDIS AB -1;Stop;}
}
class PDTeaCupPile : Actor
{
    Default {Radius 22;Height 24;+NOGRAVITY}
    States {Spawn: TCPL A -1;Stop;}
}
class PDTeaCup : Actor
{
    Default {Radius 2;Height 10;+NOBLOCKMAP}
    States {Spawn: TCUP A -1;Stop;}
}
class PDTeaDiscard : PDTeaCup
{
    int Age;
    override void Tick(){Super.Tick();Age++;if(Age==18)A_StartSound("pdoom/tea-clink",CHAN_BODY,0,.45,ATTN_STATIC);if(Age>24)Alpha=max(0.,(35.-Age)/11.);if(Age>=35)Destroy();}
}
class PDTeaDrop : Actor
{
    int Age;
    Default {Radius 1;Height 1;+NOBLOCKMAP +NOGRAVITY RenderStyle "Translucent";Alpha .8;}
    override void Tick(){Super.Tick();Age++;if(Age>=9)Destroy();}
    States {Spawn: TDRP A -1;Stop;}
}
