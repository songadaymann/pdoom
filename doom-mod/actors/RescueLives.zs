class PDRescueLives : Object play
{
    PDDownedCEO Body;
    int Work, CrankWork;
    void Down(PDCheckpoint game)
    {
        if(game.Controlled!=0)return;
        game.CeoDown=true;game.Cast.OriginalAlive=false;
        Body=PDDownedCEO(Actor.Spawn('PDDownedCEO',players[0].mo.Pos));
        game.Polish.Stinger("pdoom/loss");
        game.Speak(-1,"The doomers are driving now.",140,"doomers");
        game.Say("Hold SPACE on the CEO to reinstate them.",210);
        Console.Printf("PDOOM_EVENT {\"type\":\"ceo-downed\"}");
    }
    bool Near(Actor pawn){return Body&&pawn.Distance2D(Body)<104&&pawn.CheckSight(Body)&&cos(pawn.AngleTo(Body)-pawn.Angle)>.25;}
    void Reinstate(PDCheckpoint game)
    {
        if(!Body||game.Controlled<=0)return;
        let pawn=players[0].mo;int site=game.Controlled-1;let p=game.Cast.People[site];
        p.Body=PDCheckpointPrisoner(Actor.Spawn('PDCheckpointPrisoner',pawn.Pos));p.Body.Args[0]=site;p.Body.health=max(1,pawn.health);
        p.Taken=false;p.Holding=false;p.Sheltered=false;p.Idling=false;p.Nav.HasWaypoint=false;p.RefugeRecall=true;
        pawn.SetOrigin(Body.Pos,false);pawn.Vel=(0,0,0);pawn.health=40;pawn.player.health=40;
        game.Controlled=0;game.CeoDown=false;game.Cast.OriginalAlive=true;Body.Destroy();Body=null;Work=0;
        game.Speak(-1,PDLevelPolish.Dario()?"Reinstated. I will add a section about this to the policy.":"Reinstated. This feels familiar.",140,"reinstated");
        Console.Printf("PDOOM_EVENT {\"type\":\"ceo-reinstated\"}");
    }
    void Exit(PDCheckpoint game)
    {
        game.Retreat=!game.Cast.Together();game.Run.Practice=true;game.Run.SnapshotCover(game);
        game.Escape.Outside=true;
        for(int i=0;i<5;i++)
        {
            let p=game.Cast.People[i];
            if(p.Alive&&p.Released&&(p.Taken||p.Body&&(PDRescueRefuge.Inside(p.Body.Pos.XY)||p.Body.Distance2D(players[0].mo)<224&&players[0].mo.CheckSight(p.Body))))
            {game.Escape.Saved[i]=true;if(p.Body){p.Body.bInvisible=true;p.Body.bSolid=false;}}
        }
        game.Ended=true;game.Run.Finish(game,game.Escape.SavedCount(game));
        Console.Printf("PDOOM_EVENT {\"type\":\"outside-reveal\"}");
    }
    void Tick(PDCheckpoint game)
    {
        let pawn=players[0].mo;
        if(game.CeoDown&&game.Controlled>0&&Near(pawn)&&pawn.player.cmd.buttons&BT_USE){Work++;if(Work>=53)Reinstate(game);}else Work=0;
        let prop=game.TargetProp();
        if(game.EntryHub&&prop&&prop.Kind==19&&pawn.player.cmd.buttons&BT_USE){CrankWork++;if(CrankWork>=53)Exit(game);}else CrankWork=0;
    }
    void Report(PDCheckpoint game){Console.Printf("PDOOM_LIVES {\"ceo_down\":%d,\"reinstate_work\":%d,\"crank_work\":%d,\"entry_hub\":%d,\"replay\":%d,\"ceo_body_x\":%.1f,\"ceo_body_y\":%.1f}",game.CeoDown,Work,CrankWork,game.EntryHub,game.Replay,Body?Body.Pos.X:0,Body?Body.Pos.Y:0);}
}
class PDDownedCEO : PDCheckpointProp
{
    override void PostBeginPlay(){Super.PostBeginPlay();Kind=17;Sprite=GetSpriteIndex(PDLevelPolish.Dario()?'DARB':'SAMB');}
    override void Tick(){Super.Tick();Alpha=.7+.15*sin(level.time*4);}
    Default {Radius 14;Height 16;-NOGRAVITY}
    States {Spawn: SAMB A -1;Stop; DarioArt: DARB A -1;Stop;}
}
// A brief digital remnant, never the interactable textbook's artwork.
class PDDerezBadge : PDRescueSpark
{
    Default{Scale .3;}
    States{Spawn: PLSS AB 12 Bright;Stop;}
}
