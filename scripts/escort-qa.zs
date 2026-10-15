// Test-only event handler, added to a private QA pack by escort-polish-smoke.
// This file is never included in the playable mod.
class PDEscortQA : EventHandler
{
    override void NetworkProcess(ConsoleEvent e)
    {
        let game=PDCheckpoint.Get();if(!game||!game.Initialized)return;
        if(e.Name=="pdoom_qa_collision")
        {
            Vector3 base=players[0].mo.Pos;
            // The first map's spawn corridor has its north wall only 96 units
            // away. Probe west along that corridor, not through the map wall.
            Vector3 axis=PDCampaignSession.Hal()?(0,1,0):(-1,0,0);
            let human=Actor.Spawn('PDCheckpointPrisoner',base+axis*64);
            let robot=Actor.Spawn('PDCheckpointHunter',base+axis*96);
            bool humanPass=human.TryMove(robot.Pos.XY,1);
            human.SetOrigin(base+axis*64,false);robot.SetOrigin(base+axis*128,false);
            bool robotPass=robot.TryMove(human.Pos.XY,1);
            bool playerBlocks=human.CanCollideWith(players[0].mo,false);
            robot.Destroy();
            let column=Actor.Spawn('TechPillar',base+axis*96);
            human.SetOrigin(base+axis*64,false);
            bool decorPass=human.TryMove(column.Pos.XY,1);
            bool columnSolid=column.bSolid;
            column.Destroy();
            robot=Actor.Spawn('PDCheckpointHunter',base+axis*128);
            robot.SetOrigin(base+axis*128,false);human.SetOrigin(base+axis*64,false);
            bool old=game.Cast.People[0].Released;game.Cast.People[0].Released=true;
            FTranslatedLineTarget victim;
            robot.LineAttack(robot.AngleTo(human),256,0,10,'CheckpointShot','BulletPuff',flags:LAF_OVERRIDEZ,victim:victim,offsetz:24);
            game.Cast.People[0].Released=old;
            let marker=Actor.Spawn('PDDerezBadge',base+(32,0,0));
            Console.Printf("PDOOM_QA {\"human_pass\":%d,\"robot_pass\":%d,\"player_blocks\":%d,\"decor_pass\":%d,\"column_solid\":%d,\"radius\":%.0f,\"shot_hit\":%d,\"health\":%d,\"marker_book_art\":%d}",humanPass,robotPass,playerBlocks,decorPass,columnSolid,human.Radius,victim.linetarget==human,human.health,marker.Sprite==Actor.GetSpriteIndex('PDBK'));
            human.Destroy();robot.Destroy();
        }
        if(e.Name=="pdoom_qa_wall")
        {
            let c=game.Combat.Cameras[0];Vector2 n=(cos(c.Angle),sin(c.Angle));
            Vector2 at=c.Pos.XY+n*48;let sec=level.PointInSector(at);
            let h=Actor.Spawn('PDCheckpointPrisoner',(at,sec.floorplane.ZatPoint(at)));
            bool moved=h.TryMove(c.Pos.XY,1);
            Console.Printf("PDOOM_QA {\"wall_blocked\":%d,\"blocking_line\":%d}",!moved,h.BlockingLine!=null);
            h.Destroy();
        }
        if(e.Name=="pdoom_qa_arrival")
        {
            game.Refuge.Known=true;game.Refuge.Guide=-1;
            game.OpenCell(4,"qa-refuge");
            let p=game.Cast.People[4];
            Vector2 at=PDCampaignSession.Hal()?(192,240):(1280,800);
            let sec=level.PointInSector(at);
            p.Body.SetOrigin((at,sec.floorplane.ZatPoint(at)),false);
            p.Complete=true;p.Sheltered=false;p.Holding=false;p.RefugeArrival=false;
            p.RefugeRecall=false;p.Idling=false;p.Nav.HasWaypoint=false;
        }
    }
}

// Deterministic encounter positions; movement after setup uses real AI ticks.
class PDThreatQA : EventHandler
{
    void Place(PDCheckpoint game,int site,Vector2 at,bool released=true)
    {
        let p=game.Cast.People[site];let sector=level.PointInSector(at);
        p.Avoid.Calm(p);p.Body.SetOrigin((at,sector.floorplane.ZatPoint(at)),false);
        p.Body.health=100;p.Released=released;p.Complete=true;p.Carded=true;
        p.Holding=false;p.Sheltered=false;p.RefugeArrival=false;p.RefugeRecall=false;
        p.Idling=false;p.Nav.Ready=false;p.Nav.HasWaypoint=false;
        p.Body.SetStateLabel('Spawn');p.Walking=false;
    }
    override void NetworkProcess(ConsoleEvent e)
    {
        let game=PDCheckpoint.Get();if(!game||!game.Initialized)return;
        if(e.Name=="pdoom_qa_flee")
        {
            game.Refuge.Known=true;game.Refuge.Introduced=true;game.Refuge.Guide=-1;
            players[0].mo.SetOrigin((1760,1120,0),false);players[0].mo.Angle=180;
            Place(game,0,(1960,1120));Place(game,2,(2016,1120));
            game.Hunter.SetOrigin((1840,1120,0),false);
            game.Awake=true;game.WakeAt=level.time-175;
            game.Hunter.StunUntil=0;game.Hunter.AimTics=0;game.Hunter.LockedAim=false;
            game.Hunter.ReloadUntil=level.time+100000;
            Console.Printf("PDOOM_THREAT {\"setup\":\"flee\",\"x0\":1960,\"x2\":2016,\"hunter_x\":1840}");
        }
        if(e.Name=="pdoom_qa_flee_clear")
        {
            game.Hunter.SetOrigin((-1104,1808,136),false);game.Awake=false;
        }
        if(e.Name=="pdoom_qa_flee_refuge")
        {
            Place(game,3,PDRescueRefuge.Slot(3));let p=game.Cast.People[3];
            p.Holding=true;p.Sheltered=true;p.HoldGoal=PDRescueRefuge.Slot(3);
            game.Hunter.SetOrigin((1248,800,8),false);game.Awake=true;
        }
        if(e.Name=="pdoom_qa_flee_wall")
        {
            players[0].mo.SetOrigin((-1104,-288,128),false);players[0].mo.Angle=180;
            Place(game,0,(-1040,-288));Place(game,2,(-944,-288),false);
            game.Hunter.SetOrigin((-944,-288,128),false);game.Awake=true;
            Console.Printf("PDOOM_THREAT {\"setup\":\"wall\",\"visible\":%d}",game.Cast.People[0].Body.CheckSight(game.Hunter));
        }
        if(e.Name=="pdoom_qa_shortcut")
        {
            int panels=0;
            let releases=ThinkerIterator.Create('PDCheckpointRelease');Actor panel;
            while((panel=Actor(releases.Next()))!=null)if(panel.Args[0]==2)panels++;
            let latches=ThinkerIterator.Create('PDSamInsideLatch');
            while((panel=Actor(latches.Next()))!=null)panels++;
            Console.Printf("PDOOM_THREAT {\"panels\":%d}",panels);
        }
    }
}
