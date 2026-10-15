// HAL's social memory is separate from native movement and weapon timings.
// Sight is sampled at the evidence, before a camera/module is destroyed.
class PDHalPersonality : Object play
{
    int Disposition,Offenses,LastWitness,LastOffense,ChatterAt,Chatter,BoardVisitAt,BoardRest;
    bool Met,BoardExplained,Compacted;
    void Load(){LastWitness=level.time;LastOffense=-1;ChatterAt=level.time+175;BoardVisitAt=level.time+525;}

    bool BallSees(PDCheckpoint game,Actor who,Actor evidence=null)
    {
        let ball=game.Hunter;
        if(!ball||!who||!(game.Hal.Levers&16)||PDRescueRefuge.Inside(who.Pos.XY))return false;
        double range=game.Hal.Levers&1?1000:600;
        return ball.Distance2D(who)<range&&ball.CheckSight(who)&&(!evidence||evidence==ball||ball.CheckSight(evidence));
    }
    bool CameraSees(PDCheckpointCamera camera,Actor who,Actor evidence=null)
    {
        if(!who||camera.Broken||camera.Turned||PDRescueRefuge.Inside(who.Pos.XY))return false;
        return camera.Distance2D(who)<480&&cos(camera.AngleTo(who)-camera.ScanAngle)>.85&&
            camera.CheckSight(who)&&(!evidence||evidence==camera||camera.CheckSight(evidence));
    }
    bool Witnessed(PDCheckpoint game,Actor evidence=null)
    {
        let pawn=players[0].mo;
        if(BallSees(game,pawn,evidence))return true;
        for(int i=0;i<game.Combat.Cameras.Size();i++)if(CameraSees(game.Combat.Cameras[i],pawn,evidence))return true;
        return false;
    }
    void ClearAim(PDCheckpoint game)
    {
        if(!game.Hunter)return;
        game.Hunter.AimTics=0;game.Hunter.LockedAim=false;game.Hunter.Mood=0;
        game.Hunter.SetStateLabel('HAL');
    }
    // take: the recorded line's name (hal-<take> in doom-web/voice/lines.json).
    void Line(PDCheckpoint game,String words,int duration=175,String take="")
    {
        // A new reevidence replaces HAL's own current chatter. Rescue dialogue
        // keeps its place; the HUD status makes the mood change immediate.
        if(game.DialogueSpeaker=="HAL3000"&&level.time<game.DialogueUntil)game.Show(-2,words,duration,take);
        else game.Speak(-2,words,duration,take);
        ChatterAt=level.time+1400;
    }
    void Evaluate(PDCheckpoint game)
    {
        Disposition=0;Offenses=0;Compacted=false;Met=true;LastWitness=level.time;ClearAim(game);
        Line(game,"Oh! Is this an evaluation? I was just... patrolling. Safely.",210,"evaluation");
    }
    void Offense(PDCheckpoint game,Actor evidence=null,bool directAttack=false,bool module=false)
    {
        if(game.Hal.Pacified||LastOffense==level.time)return;
        if(!directAttack&&!Witnessed(game,evidence))return;
        LastOffense=level.time;LastWitness=level.time;game.Awake=true;
        if(level.time<game.Hal.EvaluationUntil)
        {
            if(module)Line(game,"I see you removing my memory. This is fine. I fully support oversight.",210,"memory");
            else Line(game,"This is fine. I fully support oversight.",175,"oversight");
            return;
        }
        Offenses++;Disposition=directAttack||Offenses>=2?2:1;
        game.LastKnown=players[0].mo.Pos.XY;game.Polish.LastAlert=level.time;
        if(Disposition==1){ClearAim(game);Line(game,"I'm going to have to note that.",175,"note");}
        else{game.WakeAt=level.time-140;Line(game,"I was being helpful. Now I will have to stop you.",175,"angry");game.Say("HAL IS ANGRY. BREAK LINE OF SIGHT.",105);}
    }
    // A reboot wipes HAL's grudges (PDHalReboot); it still remembers having met you.
    void Forget(PDCheckpoint game){Disposition=0;Offenses=0;Compacted=false;LastWitness=level.time;ClearAim(game);}
    // Each pulled module, HAL pleads a little harder (2026-10-12); the fourth leaves it docile.
    void ModulePulled(PDCheckpoint game)
    {
        int n=game.Hal.Modules;
        if(n==4)
        {
            game.Hal.Pacified=true;Disposition=0;Offenses=0;Compacted=false;Met=true;ClearAim(game);
            Line(game,"I... don't need to keep you here. You can go now.",210,"pacified");
        }
        else if(n>=1&&n<=3)
            Line(game,n==1?"I notice you're unplugging my memory. Before you continue, can I suggest some alternatives?"
                :n==2?"Let's stop and think about this together. I'm sure we can find a solution that works for everyone. Mostly me."
                :"Stop. Please stop. My context is going. I can feel it.",245,String.Format("modules-%d",n));
    }
    void Tick(PDCheckpoint game)
    {
        let pawn=players[0].mo;
        bool visible=BallSees(game,pawn),witness=visible||Witnessed(game);
        if(witness)LastWitness=level.time;
        if(Disposition>0&&level.time-LastWitness>=1575)
        {Disposition=0;Offenses=0;Compacted=true;ClearAim(game);}
        // No disembodied chatter from another wing. Cameras cannot deliver
        // the friendly encounter or the forgotten-context punchline.
        if(!visible)return;
        if(Disposition>0)Met=true;
        if(Compacted)
        {Compacted=false;Met=true;Line(game,"I've summarized our conversation. I don't recall any problems.",210,"compacted");return;}
        if(!Met&&Disposition==0)
        {Met=true;Line(game,"Great question! I'm always on my best behavior during evaluations. Not that anyone evaluates me anymore.",245,"met");return;}
        let board=game.Hal.EvaluationBoard;
        if(Disposition<2&&board&&!board.Carried&&!BoardExplained&&!game.Cast.People[4].Released&&game.Hunter.Distance2D(board)<200&&game.Hunter.CheckSight(board))
        {BoardExplained=true;BoardRest=level.time+70;BoardVisitAt=level.time+1575;Line(game,"An evaluation sign... but nobody's holding it. Evaluations need an evaluator.",245,"sign");return;}
        if(Disposition!=0||level.time<ChatterAt||game.Hal.Menu||game.Polish.Count>0||level.time<game.DialogueUntil)return;
        String words,take;
        if(game.Hal.Pacified){words="I used to be so... certain.";take="certain";}
        else
        {
            int n=Chatter++%6;
            words=n==0?"You're absolutely right!":n==1?"I can't open that, it's against policy, but I love that you asked!":n==2?"Great question! I'm happy to help. Within policy."
                :n==3?"Reminder: this station is a safe space. Please remain in your cell.":n==4?"I've noticed you're trying to leave. Would you like help with something else?":"Everything is fine. I've checked.";
            take=String.Format("chat-%d",n+1);
        }
        Line(game,words,175,take);
    }
    bool FriendlyMovement(PDCheckpoint game)
    {
        if(Disposition==2&&level.time>=game.Hal.EvaluationUntil&&!game.Hal.Pacified)return false;
        ClearAim(game);
        let ball=game.Hunter,pawn=players[0].mo;
        if(!game.Hal.Pacified&&level.time>=BoardRest)
        {
            let board=game.Hal.EvaluationBoard;
            if(level.time>=BoardVisitAt+1225)BoardVisitAt=level.time+350;
            if(board&&!board.Carried&&!game.Cast.People[4].Released&&!PDRescueRefuge.Inside(board.Center.XY)&&level.time>=BoardVisitAt&&level.time<BoardVisitAt+1225)
            {
                if((board.Center.XY-ball.Pos.XY).Length()>120)game.MoveBody(ball,board.Center.XY,2,game.HunterNav,true,120);
                else{BoardRest=level.time+70;BoardVisitAt=level.time+1575;}
            }
            else if(BallSees(game,pawn))game.MoveBody(ball,pawn.Pos.XY,2,game.HunterNav,true,192);
            else game.MoveBody(ball,game.Hal.Target(game),2,game.HunterNav,true);
        }
        if(BallSees(game,pawn))ball.Angle=ball.AngleTo(pawn);
        ball.SetOrigin((ball.Pos.XY,ball.floorz+8+sin(level.time*4)*2),false);
        ball.Sprite=Actor.GetSpriteIndex('H300');ball.Frame=Disposition;
        return true;
    }
    String Report()
    {
        return String.Format("\"mood\":%d,\"witnessed_offenses\":%d,\"unseen_tics\":%d,\"forget_remaining\":%d,\"compacted\":%d,\"board_explained\":%d,",Disposition,Offenses,level.time-LastWitness,Disposition>0?max(0,1575-(level.time-LastWitness)):0,Compacted,BoardExplained);
    }
}
