// Ordinary corridor doors share a readable, bounded HAL interference rule.
// Cell puzzle interlocks remain owned by PDHalStation.
class PDHalDoors : Object play
{
    Array<bool> Jammed;
    Array<PDHalDoorPanel> Panels;
    int WarningIndex,WarningAt,LockIndex,LockExpires,NextLock,Locks;

    void Load()
    {
        Jammed.Resize(PDHalMap.DoorCount());WarningIndex=-1;LockIndex=-1;
        NextLock=level.time+1050;
        let it=ThinkerIterator.Create('PDHalDoorPanel');PDHalDoorPanel p;
        while((p=PDHalDoorPanel(it.Next()))!=null)Panels.Push(p);
    }
    bool IsLocked(int tag){return LockIndex>=0&&PDHalMap.OrdinaryDoor(LockIndex)==tag&&level.time<LockExpires;}
    String ContextPrompt(PDCheckpoint game)
    {
        let pawn=players[0].mo;int active=LockIndex>=0?LockIndex:WarningIndex;
        if(active>=0)
        {
            Vector2 center=PDHalMap.DoorPosition(active);Vector2 delta=center-pawn.Pos.XY;
            if(delta.Length()<192&&cos(atan2(delta.Y,delta.X)-pawn.Angle)>.25)return Prompt(active);
        }
        for(int i=0;i<5;i++)
        {
            if(i==1||i==2||game.Cast.People[i].Released)continue;
            Vector2 at=PDHalMap.DoorPoint(PDHalMap.SiteDoor(i),pawn.Pos.XY);Vector2 delta=at-pawn.Pos.XY;
            if(delta.Length()<112&&cos(atan2(delta.Y,delta.X)-pawn.Angle)>.55)return i==4?"SAFETY INTERLOCK - opens for an evaluation":"CELL INTERLOCK - controlled elsewhere";
        }
        return "";
    }
    String Prompt(int i)
    {
        if(Jammed[i])return "";
        if(i==LockIndex)return String.Format("HAL LOCK - %ds. Wait or wrench the panel.",max(1,(LockExpires-level.time+34)/35));
        if(i==WarningIndex)return String.Format("HAL locking in %ds - wrench the panel.",max(1,(WarningAt-level.time+34)/35));
        return "";
    }
    void Use(PDCheckpoint game,int i)
    {
        if(i==LockIndex)return;
        Door_Open(PDHalMap.OrdinaryDoor(i),24);
    }
    void Reopen(int i,int speed=24)
    {
        // Remote Door_Open ignores an existing closing mover. If the hunter
        // blocks that closing door, it may never finish; retire only this
        // corridor door's ceiling mover before issuing the opening action.
        let sec=level.PointInSector(PDHalMap.DoorPosition(i));
        if(sec.ceilingdata){sec.ceilingdata.Destroy();sec.ceilingdata=null;}
        Door_Open(PDHalMap.OrdinaryDoor(i),speed);
    }
    void Jam(PDCheckpoint game,int i,Vector3 at)
    {
        if(Jammed[i])return;
        Jammed[i]=true;Reopen(i,64);
        if(LockIndex==i)LockIndex=-1;
        if(WarningIndex==i)WarningIndex=-1;
        game.Combat.MachineBlast(at+(0,0,18));game.Alert(at.XY);
    }
    void Tick(PDCheckpoint game)
    {
        let h=game.Hal;let pawn=players[0].mo;
        // Walk up to a corridor door and it opens, unless HAL holds it shut.
        for(int i=0;i<Jammed.Size();i++)
        {
            if(i==LockIndex&&level.time<LockExpires)continue;
            Vector2 center=PDHalMap.DoorPosition(i),toward=center-pawn.Pos.XY;double distance=toward.Length();
            if(distance>=96||distance>=48&&cos(atan2(toward.Y,toward.X)-pawn.Angle)<.5)continue;
            let sec=level.PointInSector(center);
            if(!sec.ceilingdata&&sec.ceilingplane.ZatPoint(center)-sec.floorplane.ZatPoint(center)<56)Door_Open(PDHalMap.OrdinaryDoor(i),24);
        }
        bool enabled=!h.Pacified&&(h.Levers&2)&&(h.Levers&16)&&level.time>=h.EvaluationUntil;
        if(LockIndex>=0&&(!enabled||level.time>=LockExpires))
        {
            Reopen(LockIndex);LockIndex=-1;
        }
        if(!enabled)WarningIndex=-1;
        if(WarningIndex>=0&&level.time>=WarningAt)
        {
            LockIndex=WarningIndex;WarningIndex=-1;LockExpires=level.time+210;Locks++;
            Door_Close(PDHalMap.OrdinaryDoor(LockIndex),24);
        }
        if(enabled&&WarningIndex<0&&LockIndex<0&&level.time>=NextLock)
        {
            int nearest=-1;double distance=192;
            for(int n=0;n<Panels.Size();n++)
            {
                let p=Panels[n];int i=p.Args[1];
                if(Jammed[i]||!pawn.CheckSight(p)||cos(pawn.AngleTo(p)-pawn.Angle)<.25)continue;
                Vector2 center=PDHalMap.DoorPosition(i);let sec=level.PointInSector(center);
                if(sec.ceilingplane.ZatPoint(center)-sec.floorplane.ZatPoint(center)<56)continue;
                double d=pawn.Distance2D(p);if(d<distance){distance=d;nearest=i;}
            }
            if(nearest>=0)
            {
                WarningIndex=nearest;WarningAt=level.time+70;NextLock=level.time+1225;
                game.Speak(-2,"I am locking that door. Two seconds.",70,"door");
            }
        }
        for(int n=0;n<Panels.Size();n++)
        {
            let p=Panels[n];int i=p.Args[1];
            p.Frame=Jammed[i]?2:i==LockIndex?1:i==WarningIndex?3:0;
        }
        // A pair of controls represents one physical mover. Maintain by door,
        // rather than issuing duplicate actions for its two control panels.
        for(int i=0;i<Jammed.Size();i++)
        {
            if(!(Jammed[i]||!(h.Levers&2)))continue;
            Vector2 center=PDHalMap.DoorPosition(i);let sec=level.PointInSector(center);
            if(level.time%35==0&&sec.ceilingplane.ZatPoint(center)-sec.floorplane.ZatPoint(center)<56)Door_Open(PDHalMap.OrdinaryDoor(i),24);
        }
    }
    void Report()
    {
        String text=String.Format("PDOOM_DOORS {\"warning\":%d,\"warning_seconds\":%d,\"locked\":%d,\"lock_seconds\":%d,\"next_lock_seconds\":%d,\"locks\":%d,\"panels\":[",WarningIndex,WarningIndex<0?0:max(1,(WarningAt-level.time+34)/35),LockIndex,LockIndex<0?0:max(1,(LockExpires-level.time+34)/35),max(0,(NextLock-level.time+34)/35),Locks);
        for(int n=0;n<Panels.Size();n++){let p=Panels[n];Vector2 center=PDHalMap.DoorPosition(p.Args[1]);let sec=level.PointInSector(center);text.AppendFormat("%s{\"door\":%d,\"x\":%.1f,\"y\":%.1f,\"angle\":%.1f,\"z\":%.1f,\"wall_sprite\":%d,\"frame\":%d,\"jammed\":%d,\"clearance\":%.1f}",n?",":"",p.Args[1],p.Pos.X,p.Pos.Y,p.Angle,p.Pos.Z,p.bWallSprite,p.Frame,Jammed[p.Args[1]],sec.ceilingplane.ZatPoint(center)-sec.floorplane.ZatPoint(center));}
        Console.Printf("%s]}",text);
    }
}
class PDHalDoorPanel : PDHalTerminal
{
    Default {Radius 14;Height 32;+WALLSPRITE}
    override void PostBeginPlay(){Super.PostBeginPlay();Kind=60+Args[1];bWallSprite=true;Sprite=GetSpriteIndex('HDCN');Frame=0;}
    override int DamageMobj(Actor inflictor,Actor source,int damage,Name mod,int flags,double angle)
    {
        let game=PDCheckpoint.Get();
        if(game&&damage>0&&mod=='CheckpointMelee')game.Hal.Doors.Jam(game,Args[1],Pos);
        return 0;
    }
    States {Spawn: HDCN ABCD -1;Stop;}
}
