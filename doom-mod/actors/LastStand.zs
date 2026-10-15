// Native weapons and killable machines belong only to this unscored prologue.
// The war machines are pop-culture homages, deliberately unlike the rescue
// campaign's Inferminator (HUNT) and HAL (H300), which are characters later on:
//   Centurion trooper (WTRP), Sentinel squid (WSQD), ED-404 enforcer (WENF),
//   Hunter-Killer gunship (WGSH). Art: art/war-robots-v1/.
class PDWarBolt : CacodemonBall
{
    Default { Damage 2; Speed 21; SeeSound "weapons/plasmaf"; DeathSound "weapons/plasmax"; }
    States { Spawn: PLSS AB 4 Bright; Loop; Death: PLSE ABCDE 3 Bright; Stop; }
}
// The enforcer's rocket pod: a small blast, not a Cyberdemon one-shot.
class PDWarRocket : Actor
{
    Default { Projectile; Radius 8; Height 8; Speed 17; Damage 4; +RANDOMIZE; SeeSound "weapons/rocklf"; DeathSound "weapons/rocklx"; }
    States { Spawn: MISL A 1 Bright; Loop; Death: MISL B 6 Bright A_Explode(40,96); MISL C 5 Bright; MISL D 4 Bright; Stop; }
}
// A machine coming apart: fireball over the wreck.
class PDWarBurst : Actor
{
    Default { +NOINTERACTION; RenderStyle "Add"; }
    States { Spawn: MISL B 5 Bright; MISL C 5 Bright; MISL D 5 Bright; Stop; }
}
// Shared rules for every war machine: frozen while the boot screen or capture
// holds, and seeing the player reveals the rest of its room's squad.
class PDWarWalker : Actor
{
    override void Tick()
    {
        let battle=PDLastStand.Get();
        if(battle&&battle.Active&&(battle.BootHolding||battle.Captured||battle.Asleep(self)))return;
        if(battle&&battle.Active&&Target&&Args[0]>0)battle.RevealRoom(Args[0]);
        Super.Tick();
    }
    Default
    {
        // Aggressive by Doom standards: quick to react, fires often, rarely flinches.
        Health 60; Radius 20; Height 60; Speed 9; Mass 160; PainChance 90; MinMissileChance 110; ReactionTime 4;
        Monster; +NOBLOOD +CANUSEWALLS +MISSILEMORE
        Species "PDWarMachine"; +DONTHARMSPECIES
        SeeSound "baby/sight"; ActiveSound "baby/active"; PainSound "baby/pain"; DeathSound "pdoom/camera-break";
    }
    States
    {
    Spawn: WTRP A 10 A_Look; Loop;
    See: WTRP AABB 4 A_Chase; Loop;
    Missile: WTRP C 8 A_FaceTarget;
        WTRP D 3 Bright A_SpawnProjectile("PDWarBolt",38,6); WTRP C 3 A_FaceTarget;
        WTRP D 3 Bright A_SpawnProjectile("PDWarBolt",38,6); WTRP C 4; Goto See;
    Pain: WTRP E 3; WTRP E 3 A_Pain; Goto See;
    Death: WTRP E 4 A_Scream; WTRP F 0 A_SpawnItemEx("PDWarBurst",0,0,32,flags:SXF_NOCHECKPOSITION);
        WTRP F 6 A_NoBlocking; WTRP F -1; Stop;
    }
}
// Centurion: chrome rifle infantry, single sweeping red eye. The rank and file.
class PDWarTrooper : PDWarWalker { Default { Tag "Centurion"; } }
// Late replacements fire three-round volleys and move faster. Same health:
// the difficulty is more threats and less breathing space, not immunity.
class PDWarAssault : PDWarTrooper
{
    Default { Speed 11; MinMissileChance 70; +MISSILEEVENMORE }
    States
    {
    See: WTRP AABB 3 A_Chase; Loop;
    Missile: WTRP C 6 A_FaceTarget;
        WTRP D 3 Bright A_SpawnProjectile("PDWarBolt",38,6);
        WTRP C 2 A_FaceTarget;
        WTRP D 3 Bright A_SpawnProjectile("PDWarBolt",38,6);
        WTRP C 2 A_FaceTarget;
        WTRP D 3 Bright A_SpawnProjectile("PDWarBolt",38,6); Goto See;
    }
}
// Sentinel: fragile, fast, floats in swarms and lunges like a Lost Soul.
class PDWarSquid : PDWarWalker
{
    Default
    {
        Health 45; Radius 18; Height 48; Speed 12; Mass 60; PainChance 160; Damage 3; MinMissileChance 50; ReactionTime 2;
        +FLOAT +NOGRAVITY Tag "Sentinel";
        SeeSound "skull/active"; ActiveSound "baby/walk"; AttackSound "skull/melee"; PainSound "skull/pain"; DeathSound "baby/death";
    }
    States
    {
    Spawn: WSQD AB 8 A_Look; Loop;
    See: WSQD AABB 3 A_Chase; Loop;
    Missile: WSQD C 9 Bright A_FaceTarget;
        WSQD C 4 Bright A_SkullAttack(20);
        WSQD CC 4 Bright; Goto Missile+2;
    Pain: WSQD D 3; WSQD D 3 A_Pain; Goto See;
    Death: WSQD D 4 A_Scream;
        WSQD E 0 { A_SpawnItemEx("PDWarBurst",0,0,16,flags:SXF_NOCHECKPOSITION); bNoGravity=false; bFloat=false; }
        WSQD E 6 A_NoBlocking; WSQD E -1; Stop;
    }
}
// ED-404: the heavy. Slow, loud, very hard to stop; rocket pods then a burst.
class PDWarEnforcer : PDWarWalker
{
    bool Warned;
    override void Tick()
    {
        Super.Tick();
        let battle=PDLastStand.Get();
        if(!Warned&&Health>0&&Target&&battle&&battle.Active&&!battle.Captured&&CheckSight(Target))
        {Warned=true;battle.Bark("ED-404: PLEASE PUT DOWN YOUR WEAPON. YOU HAVE TWENTY SECONDS TO COMPLY.");}
    }
    Default
    {
        Health 700; Radius 40; Height 104; Speed 7; Mass 1000; PainChance 12; MinMissileChance 80; ReactionTime 4;
        +MISSILEMORE Tag "ED-404";
        SeeSound "cyber/sight"; ActiveSound "spider/active"; PainSound "baby/pain"; DeathSound "cyber/death";
    }
    States
    {
    Spawn: WENF A 10 A_Look; Loop;
    See: WENF A 6 A_Chase; WENF A 6 { A_Chase(); A_StartSound("cyber/hoof",CHAN_BODY); }
        WENF B 6 A_Chase; WENF B 6 { A_Chase(); A_StartSound("spider/walk",CHAN_BODY); } Loop;
    Missile: WENF A 14 A_FaceTarget;
        WENF C 5 Bright A_SpawnProjectile("PDWarRocket",78,-30); WENF A 8 A_FaceTarget;
        WENF C 5 Bright A_SpawnProjectile("PDWarRocket",78,30); WENF A 8 A_FaceTarget;
        WENF C 3 Bright A_SpawnProjectile("PDWarBolt",66,22); WENF C 3 Bright A_SpawnProjectile("PDWarBolt",66,-22);
        WENF C 3 Bright A_SpawnProjectile("PDWarBolt",66,22); Goto See;
    Pain: WENF D 6 A_Pain; Goto See;
    Death: WENF D 8 A_Scream; WENF E 0 A_SpawnItemEx("PDWarBurst",0,0,60,flags:SXF_NOCHECKPOSITION);
        WENF E 6 A_NoBlocking; WENF E 0 A_StartSound("world/barrelx",CHAN_6);
        WENF E 0 A_SpawnItemEx("PDWarBurst",16,12,30,flags:SXF_NOCHECKPOSITION); WENF E -1; Stop;
    }
}
// Hunter-Killer: a hover gunship. Keeps its distance, twin cannons in pairs.
class PDWarGunship : PDWarWalker
{
    Default
    {
        Health 140; Radius 28; Height 40; Speed 10; Mass 300; PainChance 60; MinMissileChance 80; ReactionTime 4;
        +FLOAT +NOGRAVITY +MISSILEMORE Tag "Hunter-Killer";
        SeeSound "spider/sight"; ActiveSound "baby/walk"; PainSound "baby/pain"; DeathSound "weapons/rocklx";
    }
    States
    {
    Spawn: WGSH AB 6 A_Look; Loop;
    See: WGSH AABB 3 A_Chase; Loop;
    Missile: WGSH A 8 A_FaceTarget;
        WGSH C 3 Bright { A_SpawnProjectile("PDWarBolt",18,-14); A_SpawnProjectile("PDWarBolt",18,14); }
        WGSH A 5 A_FaceTarget;
        WGSH C 3 Bright { A_SpawnProjectile("PDWarBolt",18,-14); A_SpawnProjectile("PDWarBolt",18,14); } Goto See;
    Pain: WGSH D 4 A_Pain; Goto See;
    Death: WGSH D 4 A_Scream;
        WGSH E 0 { A_SpawnItemEx("PDWarBurst",0,0,12,flags:SXF_NOCHECKPOSITION); bNoGravity=false; bFloat=false; }
        WGSH E 6 A_NoBlocking; WGSH E 0 A_StartSound("pdoom/camera-break",CHAN_6); WGSH E -1; Stop;
    }
}
// The last soldiers: Doom's own marines (PLAY) in the multiplayer colours. They run up
// from behind and join the fight; the robots shoot back, and in this war they all die.
// Same species as the player, who walks through them; neither side can hurt the other.
class PDWarAlly : Actor
{
    override void Tick()
    {
        let battle=PDLastStand.Get();
        if(battle&&battle.Active&&(battle.BootHolding||battle.Captured||battle.Asleep(self)))return;
        Super.Tick();
    }
    override int DamageMobj(Actor inflictor,Actor source,int damage,Name mod,int flags,double angle)
    {
        if(source&&(source.player||source is 'PDWarAlly'))return 0;
        return Super.DamageMobj(inflictor,source,damage,mod,flags,angle);
    }
    Default
    {
        Health 45; Radius 16; Height 56; Speed 11; Mass 100; PainChance 150; ReactionTime 2; MinMissileChance 120;
        Monster; +FRIENDLY -COUNTKILL
        Species "PDHuman"; +DONTHARMSPECIES
        AttackSound "grunt/attack"; PainSound "pdoom/marine-pain"; DeathSound "pdoom/marine-death";
        Tag "Soldier";
    }
    States
    {
    Spawn: PLAY A 4 A_Look; Loop;
    See: PLAY ABCD 3 A_Chase; Loop;
    Missile: PLAY E 5 A_FaceTarget;
        PLAY F 3 Bright A_CustomBulletAttack(7,0,1,5,"BulletPuff");
        PLAY E 4 A_FaceTarget;
        PLAY F 3 Bright A_CustomBulletAttack(7,0,1,5,"BulletPuff");
        PLAY E 6 A_MonsterRefire(40,"See"); Goto Missile+1;
    Pain: PLAY G 3; PLAY G 3 A_Pain; Goto See;
    Death: PLAY H 8; PLAY I 8 A_Scream; PLAY J 8 A_NoBlocking; PLAY KLM 8; PLAY N -1; Stop;
    XDeath: PLAY O 4; PLAY P 4 A_XScream; PLAY Q 4 A_NoBlocking; PLAY RSTUV 4; PLAY W -1; Stop;
    }
}
class PDWarAllyGrey : PDWarAlly { Default { Translation "112:127=96:111"; } }
class PDWarAllyBrown : PDWarAlly { Default { Translation "112:127=64:79"; } }
class PDWarAllyRed : PDWarAlly { Default { Translation "112:127=32:47"; } }
// The founder the player did not pick fights beside us in the finale. He cannot die:
// he is the one who walks us over the hill in the meadow afterwards. Art: WSAM / WDAR
// (scripts/import-war-allies.py; art/war-allies-v1/README.md).
class PDWarFounder : PDWarAlly
{
    Default { Health 1000; PainChance 40; Speed 10; +NODAMAGE PainSound ""; DeathSound ""; Tag "Founder"; }
}
class PDWarFounderSam : PDWarFounder
{
    States
    {
    Spawn: WSAM A 4 A_Look; Loop;
    See: WSAM AABB 3 A_Chase; Loop;
    Missile: WSAM C 5 A_FaceTarget;
        WSAM D 3 Bright A_CustomBulletAttack(6,0,1,6,"BulletPuff");
        WSAM C 4 A_FaceTarget;
        WSAM D 3 Bright A_CustomBulletAttack(6,0,1,6,"BulletPuff");
        WSAM C 6 A_MonsterRefire(40,"See"); Goto Missile+1;
    Pain: WSAM E 3; WSAM E 3 A_Pain; Goto See;
    }
}
class PDWarFounderDario : PDWarFounder
{
    States
    {
    Spawn: WDAR A 4 A_Look; Loop;
    See: WDAR AABB 3 A_Chase; Loop;
    Missile: WDAR C 5 A_FaceTarget;
        WDAR D 3 Bright A_CustomBulletAttack(6,0,1,6,"BulletPuff");
        WDAR C 4 A_FaceTarget;
        WDAR D 3 Bright A_CustomBulletAttack(6,0,1,6,"BulletPuff");
        WDAR C 6 A_MonsterRefire(40,"See"); Goto Missile+1;
    Pain: WDAR E 3; WDAR E 3 A_Pain; Goto See;
    }
}
// One gauntlet section (scripts/gauntlet.json): args = index (from 1), first sector,
// sector count, finale (1) and its squad robots. The handler reads and removes it.
class PDWarSectionMark : Actor
{
    Default { +NOBLOCKMAP +NOINTERACTION }
    States { Spawn: TNT1 A -1; Stop; }
}
// One airlock room, angled the way the player walks through it: args = pair (from 1),
// role (0 exit, 1 entrance), door tag, room sector, door sector.
class PDWarAirlock : Actor
{
    Default { +NOBLOCKMAP +NOINTERACTION }
    States { Spawn: TNT1 A -1; Stop; }
}
// Reinforcement pad; args[0] = its section (from 1).
class PDWarSpawn : Actor
{
    Default { +NOBLOCKMAP +NOINTERACTION }
    States { Spawn: TNT1 A -1; Stop; }
}
class PDLastStand : EventHandler
{
    bool Active, BootHolding, Captured, Bliss;
    int Clock, Wave, Kills, Spawned, CaptureClock;
    int NextWave, Pending, SpawnCursor, Rooms, BarkUntil;
    // The shape of the fight (scripts/gauntlet.json): a run of set pieces cut from the
    // original maps, each sealed until most of its squad is destroyed, joined by airlocks.
    // Then the FINALE: step out into a huge open-sky arena and the war arrives at once.
    const ROUTE=0; const OPEN=1; const YARD=2;
    const SECURE_FALLBACK=3150;                        // a sector unseals after 90 s regardless
    const TRICKLE_FROM=1575; const TRICKLE_EVERY=1050; // stragglers after 45 s, then every 30 s
    const BARRAGE=30;                                  // the finale's opening cascade
    const LIVE_BUDGET=128;
    int Stage, StageClock, YardSpawned;
    // Section progress. Transit 1: inside the exit airlock while its door shuts behind us.
    // Arrive after a crossing: 1 in the entrance airlock (its door ahead opens), 2 clear of it
    // (it shuts behind us), 3 shut for good.
    int Section, SectionClock, Finale, Transit, TransitClock, Arrive, ArriveClock, Left;
    // Soldiers beside us (PDWarAlly) and the founder who fights in the finale.
    int AllyClock, AlliesSent, AllyDeaths;
    Actor Founder;
    Actor Killer;          // who got us: the death view turns to face them
    const WAKE_AT=215;     // capture: ~1.3 s of Doom's own death, then the upload, then the meadow
    bool Secured;
    Array<int> SecFirst, SecCount, SecRobots;
    // Airlock pair k joins section k's exit room (X) to section k+1's entrance room (Y).
    Array<double> XX, XY, XZ, XA, YX, YY, YZ, YA;
    Array<int> XTag, XRoom, XDoor, YTag, YRoom, YDoor;
    Array<Actor> Pads;
    String WeaponName,DefeatedBy,BarkText;
    static PDLastStand Get(){return PDLastStand(EventHandler.Find('PDLastStand'));}
    override void WorldLoaded(WorldEvent e)
    {
        Active=level.MapName=="E1M2";Captured=false;Bliss=false;DefeatedBy="";Clock=0;Wave=0;Kills=0;Spawned=0;CaptureClock=0;
        if(!Active)return;
        BootHolding=true;NextWave=0;Pending=0;SpawnCursor=0;Rooms=0;BarkUntil=0;BarkText="";
        Stage=ROUTE;StageClock=0;YardSpawned=0;Section=0;SectionClock=0;Finale=0;Transit=0;TransitClock=0;Left=0;Secured=false;Arrive=0;ArriveClock=0;AllyClock=0;AlliesSent=0;AllyDeaths=0;Founder=null;
        ReadMarkers();
        let p=players[0].mo;
        p.GiveInventory('Fist',1);p.GiveInventory('Pistol',1);p.GiveInventory('Shotgun',1);
        p.GiveInventory('Clip',60);p.GiveInventory('Shell',16);
        // Let native BringUpWeapon install the weapon's first-person sprites.
        players[0].PendingWeapon=Weapon(p.FindInventory('Shotgun'));
        // Do not load or commit the rescue campaign during the historical fight.
        Report();
    }
    void ReadMarkers()
    {
        Array<Actor> marks;Actor mark;
        let sections=ThinkerIterator.Create('PDWarSectionMark');
        while((mark=Actor(sections.Next()))!=null)marks.Push(mark);
        int count=0;for(int i=0;i<marks.Size();i++)count=max(count,marks[i].Args[0]);
        SecFirst.Resize(count);SecCount.Resize(count);SecRobots.Resize(count);
        for(int i=0;i<marks.Size();i++)
        {
            int k=marks[i].Args[0]-1;
            SecFirst[k]=marks[i].Args[1];SecCount[k]=marks[i].Args[2];SecRobots[k]=marks[i].Args[4];
            if(marks[i].Args[3])Finale=k;
            marks[i].Destroy();
        }
        marks.Clear();
        let locks=ThinkerIterator.Create('PDWarAirlock');
        while((mark=Actor(locks.Next()))!=null)marks.Push(mark);
        int pairs=max(0,count-1);
        XX.Resize(pairs);XY.Resize(pairs);XZ.Resize(pairs);XA.Resize(pairs);XTag.Resize(pairs);XRoom.Resize(pairs);XDoor.Resize(pairs);
        YX.Resize(pairs);YY.Resize(pairs);YZ.Resize(pairs);YA.Resize(pairs);YTag.Resize(pairs);YRoom.Resize(pairs);YDoor.Resize(pairs);
        for(int i=0;i<marks.Size();i++)
        {
            let m=marks[i];int k=m.Args[0]-1;
            if(k<0||k>=pairs){m.Destroy();continue;}
            if(m.Args[1]==0){XX[k]=m.Pos.X;XY[k]=m.Pos.Y;XZ[k]=m.Pos.Z;XA[k]=m.Angle;XTag[k]=m.Args[2];XRoom[k]=m.Args[3];XDoor[k]=m.Args[4];}
            else{YX[k]=m.Pos.X;YY[k]=m.Pos.Y;YZ[k]=m.Pos.Z;YA[k]=m.Angle;YTag[k]=m.Args[2];YRoom[k]=m.Args[3];YDoor[k]=m.Args[4];}
            m.Destroy();
        }
        Pads.Clear();
        let padIt=ThinkerIterator.Create('PDWarSpawn');Actor pad;
        while((pad=Actor(padIt.Next()))!=null)Pads.Push(pad);
    }
    int SectionOf(Sector s)
    {
        if(!s)return -1;int i=s.Index();
        for(int k=0;k<SecFirst.Size();k++)if(i>=SecFirst[k]&&i<SecFirst[k]+SecCount[k])return k;
        return -1;
    }
    bool InYard(Actor a){return a&&Stage==YARD&&SectionOf(a.CurSector)==Finale;}
    void Bark(String text,int tics=210){BarkText=text;BarkUntil=Clock+tics;}
    void Choose(String name)
    {
        let p=players[0].mo;let weapon=Weapon(p.FindInventory(name));
        if(weapon)players[0].PendingWeapon=weapon;
    }
    override void NetworkProcess(ConsoleEvent e)
    {
        if(!Active)return;
        if(e.Name=="pdoom_ready"){BootHolding=false;return;}
        if(e.Name=="pdoom_prologue_skip"){Wake();return;}
        if(Captured)return;
        // QA only (console netevent): destroy the current sector's machines, leaving later sections intact.
        if(e.Name=="pdoom_prologue_clear")
        {
            let it=ThinkerIterator.Create('PDWarWalker');Actor bot;Array<Actor> doomed;
            while((bot=Actor(it.Next()))!=null)if(bot.Health>0&&SectionOf(bot.CurSector)==Section)doomed.Push(bot);
            for(int i=0;i<doomed.Size();i++)doomed[i].DamageMobj(null,null,doomed[i].Health+10,'None',DMG_FORCED);
            return;
        }
        if(e.Name=="pdoom_answer1")Choose("Fist");
        if(e.Name=="pdoom_answer2")Choose("Pistol");
        if(e.Name=="pdoom_answer3")Choose("Shotgun");
        if(e.Name=="pdoom_war4")Choose("Chaingun");
        if(e.Name=="pdoom_war5")Choose("RocketLauncher");
        if(e.Name=="pdoom_tool")
        {
            String current=players[0].ReadyWeapon?String.Format("%s",players[0].ReadyWeapon.GetClassName()):"";
            String names[4]={"Pistol","Shotgun","Chaingun","RocketLauncher"};int at=0;
            for(int i=0;i<4;i++)if(names[i]==current)at=i;
            for(int i=1;i<=4;i++){String n=names[(at+i)%4];if(players[0].mo.FindInventory(n)){Choose(n);break;}}
        }
    }
    override void WorldThingDied(WorldEvent e)
    {
        if(Active&&e.Thing is 'PDWarWalker')Kills++;
        if(Active&&e.Thing is 'PDWarAlly'&&!(e.Thing is 'PDWarFounder'))AllyDeaths++;
    }
    void Capture(Actor source=null)
    {
        if(!Active||Captured)return;Captured=true;CaptureClock=0;Killer=source;DefeatedBy=source?String.Format("%s",source.GetClassName()):"world";
        players[0].cheats|=CF_TOTALLYFROZEN|CF_GODMODE;
        players[0].mo.Vel=(0,0,0);
        // The battle ends in capture, never the rescue campaign's game-over UI.
        Report();
    }
    void Wake()
    {
        if(!Active)return;
        // Keep the historical native world frozen behind the meadow. The
        // first door will start a fresh rescue map; the walk has no run clock.
        Captured=true;Bliss=true;CaptureClock=WAKE_AT;
        players[0].cheats|=CF_TOTALLYFROZEN|CF_GODMODE;
        let pawn=players[0].mo;pawn.ViewHeight=pawn.Default.ViewHeight;players[0].viewheight=pawn.ViewHeight;
        players[0].mo.Vel=(0,0,0);
        Report();
    }
    // Doom's own death, by hand (after PlayerPawn.DeathThink) while the pawn stays
    // technically alive, so no respawn prompt: the scream, the gun dropping away, the view
    // sinking to the floor and turning to face whoever got us. The browser then uploads us.
    void DeathCam()
    {
        let p=players[0].mo;if(!p||Bliss)return;
        if(CaptureClock==1){p.A_StartSound("*death",CHAN_VOICE);p.DropWeapon();players[0].PendingWeapon=null;}
        if(p.ViewHeight>6){p.ViewHeight=max(6.,p.ViewHeight-1);players[0].viewheight=min(players[0].viewheight,p.ViewHeight);}
        if(abs(p.Pitch)<3)p.Pitch=0;else p.Pitch+=p.Pitch<0?3:-3;
        if(Killer&&Killer!=p)p.Angle+=clamp(Actor.deltaangle(p.Angle,p.AngleTo(Killer)),-5.,5.);
    }
    void RevealRoom(int id)
    {
        int bit=1<<(id-1);if(Rooms&bit)return;Rooms|=bit;
        let it=ThinkerIterator.Create('PDWarWalker');Actor bot;
        while((bot=Actor(it.Next()))!=null)if(bot.Health>0&&bot.Args[0]==id)
        {if(!bot.Target||bot.Target.Health<=0)bot.Target=players[0].mo;bot.SetStateLabel('See');}
    }
    // Rooms ahead of us wait, frozen, until we get there: their battles must not be over
    // before we arrive.
    bool Asleep(Actor a)
    {
        if(SecFirst.Size()==0||!a.CurSector)return false;
        int k=SectionOf(a.CurSector);
        return k>=0&&k!=Section;
    }
    // The nearest living thing of a kind, preferring ones in sight.
    Actor Nearest(Actor from,Class<Actor> kind,double range)
    {
        Actor best=null;double bestScore=0;
        let it=ThinkerIterator.Create(kind);Actor a;
        while((a=Actor(it.Next()))!=null)
        {
            if(a.Health<=0||a==from)continue;
            double d=from.Distance2D(a);if(d>range||SectionOf(a.CurSector)!=Section)continue;
            double score=d+(from.CheckSight(a)?0:2000);
            if(!best||score<bestScore){best=a;bestScore=score;}
        }
        return best;
    }
    // Mid-battle rooms: the moment we cross into one, its soldiers and machines are already
    // at each other's throats.
    void StartBattle()
    {
        if(!PDGauntletData.Battle(Section))return;
        Array<Actor> bots;Array<Actor> men;
        let it=ThinkerIterator.Create('PDWarWalker');Actor a;
        while((a=Actor(it.Next()))!=null)if(a.Health>0&&SectionOf(a.CurSector)==Section)bots.Push(a);
        let them=ThinkerIterator.Create('PDWarAlly');
        while((a=Actor(them.Next()))!=null)if(a.Health>0&&SectionOf(a.CurSector)==Section)men.Push(a);
        for(int i=0;i<bots.Size();i++)
        {
            let bot=bots[i];if(bot.Args[0]>0)Rooms|=1<<(bot.Args[0]-1);
            let foe=Nearest(bot,'PDWarAlly',2400);
            if(foe)bot.Target=foe;else bot.Target=players[0].mo;
            bot.SetStateLabel('See');
        }
        for(int i=0;i<men.Size();i++)
        {
            let foe=Nearest(men[i],'PDWarWalker',2400);
            if(foe){men[i].Target=foe;}
            men[i].SetStateLabel('See');
        }
    }
    // Keep it a war, not a duel with us: machines whose target is gone, and some of the
    // rest, turn on the nearest soldier in sight; idle soldiers pick a machine.
    void Engage()
    {
        if(!PDGauntletData.Battle(Section))return;
        Array<Actor> bots;Array<Actor> men;Actor a;
        let it=ThinkerIterator.Create('PDWarWalker');
        while((a=Actor(it.Next()))!=null)if(a.Health>0&&SectionOf(a.CurSector)==Section)bots.Push(a);
        let them=ThinkerIterator.Create('PDWarAlly');
        while((a=Actor(them.Next()))!=null)if(a.Health>0&&SectionOf(a.CurSector)==Section)men.Push(a);
        if(men.Size()==0)return;
        for(int i=0;i<bots.Size();i++)
        {
            let bot=bots[i];bool lost=!bot.Target||bot.Target.Health<=0;
            if(!lost&&Random(0,99)>=30)continue;
            let foe=Nearest(bot,'PDWarAlly',1600);
            if(foe&&bot.CheckSight(foe)){bot.Target=foe;if(lost)bot.SetStateLabel('See');}
            else if(lost){bot.Target=players[0].mo;bot.SetStateLabel('See');}
        }
        for(int i=0;i<men.Size();i++)
        {
            let man=men[i];if(man.Target&&man.Target.Health>0&&man.Target is 'PDWarWalker')continue;
            let foe=Nearest(man,'PDWarWalker',1600);
            if(foe&&man.CheckSight(foe)){man.Target=foe;man.SetStateLabel('See');}
        }
    }
    // Squad machines still standing in a section (stragglers, and machines that followed us
    // through an airlock, do not hold the door).
    int SquadLeft(int k)
    {
        int left=0;let it=ThinkerIterator.Create('PDWarWalker');Actor bot;
        while((bot=Actor(it.Next()))!=null)if(bot.Health>0&&bot.Args[0]>0&&SectionOf(bot.CurSector)==k)left++;
        return left;
    }
    int Allowed(){return SecRobots[Section]/4;}
    void Secure()
    {
        Secured=true;Door_Open(XTag[Section],16);
        players[0].mo.A_StartSound("doors/dr2_open",CHAN_AUTO,0,1,ATTN_NONE);
        Bark(Section+1==Finale?"RADIO: THIS IS IT. EVERYONE OUT INTO THE OPEN.":"RADIO: SECTOR CLEAR. THE BLAST DOOR IS OPEN - MOVE UP.",245);
    }
    double DoorGap(int index)
    {
        Sector door=level.Sectors[index];
        return door.ceilingplane.ZAtPoint(door.centerspot)-door.floorplane.ZAtPoint(door.centerspot);
    }
    // Is this whole body clear of a door sector (not even overlapping its lines)?
    bool ClearOf(Actor a,int index)
    {
        Sector door=level.Sectors[index];
        if(a.CurSector==door)return false;
        for(int i=0;i<door.Lines.Size();i++)
            if(SegmentDistance(a.Pos.XY,door.Lines[i].v1.p,door.Lines[i].v2.p)<=a.Radius)return false;
        return true;
    }
    // Door specials are ignored while a door is still moving, so keep asking until the
    // door is where it should be. An opened door rises to its lowest neighbour.
    void Want(int index,int tag,bool open)
    {
        if(level.Sectors[index].PlaneMoving(Sector.ceiling))return;
        double gap=DoorGap(index);
        if(open&&gap<56)Door_Open(tag,48);
        else if(!open&&gap>=1)Door_Close(tag,48);
    }
    // A machine standing in the closing doorway is crushed; the door never bounces open.
    void ClearDoorway(int index)
    {
        let it=ThinkerIterator.Create('PDWarWalker');Actor bot;Array<Actor> crushed;
        while((bot=Actor(it.Next()))!=null)if(bot.Health>0&&!ClearOf(bot,index))crushed.Push(bot);
        for(int i=0;i<crushed.Size();i++)crushed[i].DamageMobj(null,null,crushed[i].Health+10,'Crush',DMG_FORCED|DMG_NO_ARMOR);
    }
    static double SegmentDistance(Vector2 p,Vector2 a,Vector2 b)
    {
        Vector2 d=b-a;double length=d dot d;
        double t=length>0?clamp(((p-a) dot d)/length,0.,1.):0.;
        return (p-(a+d*t)).Length();
    }
    // Both airlock rooms are identical and both doors are shut: move everything inside
    // the exit room to the same spot in the next section's entrance room.
    void CrossAirlock()
    {
        int k=Section;double turn=YA[k]-XA[k];
        Vector2 from=(XX[k],XY[k]),to=(YX[k],YY[k]);
        Array<Actor> movers;
        let all=ThinkerIterator.Create('Actor');Actor thing;
        while((thing=Actor(all.Next()))!=null)
            if(thing.CurSector&&thing.CurSector.Index()==XRoom[k]&&(thing.player||thing.bIsMonster||thing.bMissile))movers.Push(thing);
        for(int i=0;i<movers.Size();i++)
        {
            let mover=movers[i];
            if(mover.bMissile){mover.Destroy();continue;}
            Vector2 rel=mover.Pos.XY-from;
            Vector2 turned=(rel.X*cos(turn)-rel.Y*sin(turn),rel.X*sin(turn)+rel.Y*cos(turn));
            mover.SetOrigin((to+turned,mover.Pos.Z-XZ[k]+YZ[k]),false);
            mover.Angle+=turn;
            mover.Vel=(mover.Vel.X*cos(turn)-mover.Vel.Y*sin(turn),mover.Vel.X*sin(turn)+mover.Vel.Y*cos(turn),mover.Vel.Z);
            mover.ClearInterpolation();
            mover.Args[0]=0;   // a machine that followed us in is no longer part of a squad
        }
        // Machines and soldiers left behind can never reach us again: free their budget.
        let bots=ThinkerIterator.Create('Actor');Actor bot;Array<Actor> behind;
        while((bot=Actor(bots.Next()))!=null)if((bot is 'PDWarWalker'||bot is 'PDWarAlly')&&SectionOf(bot.CurSector)==k)behind.Push(bot);
        for(int i=0;i<behind.Size();i++)behind[i].Destroy();
        Section=k+1;SectionClock=0;Secured=false;Transit=0;TransitClock=0;Arrive=1;ArriveClock=0;Pending=0;Left=SecRobots[Section];
        if(Section==Finale)Stage=OPEN;
        Bark(String.Format("SECTOR %d OF %d: %s",Section+1,SecFirst.Size(),PDGauntletData.Name(Section)),175);
        if(Section==Finale)SpawnFounder();
        StartBattle();
    }
    // The founder we are not steps out of the last airlock at our right shoulder:
    // pdoom_ceo 1 is Dario, so Sam fights beside him, and the other way round.
    void SpawnFounder()
    {
        let p=players[0].mo;
        Name kind=p.GetCVar("pdoom_ceo")==1?'PDWarFounderSam':'PDWarFounderDario';
        Vector2 side=(cos(p.Angle-90),sin(p.Angle-90))*28;
        Founder=Actor.Spawn(kind,(p.Pos.XY+side,p.Pos.Z));
        if(!Founder)return;
        if(!Founder.TestMobjLocation())Founder.SetOrigin((YX[Section-1],YY[Section-1],YZ[Section-1]),false);
        Founder.FriendPlayer=1;Founder.Angle=p.Angle;Founder.SetStateLabel('See');
    }
    // Soldiers who answered the last call come through the airlock behind us and run up to
    // join the fight: one every AllyEvery tics in the sections the setlist names, never more
    // than AllyMax at once. They appear in the shut entrance airlock, so nobody sees them pop
    // in; the blast door opens for them and shuts again once they are through.
    void Rally()
    {
        int every=PDGauntletData.AllyEvery(Section),most=PDGauntletData.AllyMax(Section);
        if(every<=0||Transit==1||Section<1)return;
        if(++AllyClock<every)return;
        if(Arrive!=3||LiveAllies()>=most){AllyClock=every-35;return;}
        int k=Section-1;Vector2 across=(cos(YA[k]+90),sin(YA[k]+90));
        Name kinds[4]={'PDWarAlly','PDWarAllyGrey','PDWarAllyBrown','PDWarAllyRed'};
        Actor ally=null;
        for(int i=0;i<3&&!ally;i++)
        {
            Vector2 spot=(YX[k],YY[k])+across*(((AlliesSent+i)%3)-1)*28;
            ally=Actor.Spawn(kinds[AlliesSent%4],(spot,YZ[k]));
            if(ally&&!ally.TestMobjLocation()){ally.Destroy();ally=null;}
        }
        if(!ally){AllyClock=every-35;return;}
        // Friendly to player 1: with nothing to shoot, they follow us.
        ally.FriendPlayer=1;ally.Angle=YA[k];ally.SetStateLabel('See');
        AllyClock=0;AlliesSent++;Arrive=2;
        if(AlliesSent==1)Bark("RADIO: SECOND PLATOON, MOVING UP ON YOUR SIX.",210);
    }
    // Is a soldier in this airlock room or its doorway?
    bool AlliesAt(int room,int door)
    {
        let it=ThinkerIterator.Create('PDWarAlly');Actor a;
        while((a=Actor(it.Next()))!=null)if(a.Health>0&&(a.CurSector.Index()==room||!ClearOf(a,door)))return true;
        return false;
    }
    int LiveAllies()
    {
        int n=0;let it=ThinkerIterator.Create('PDWarAlly');Actor a;
        // Only this room's soldiers count: those ahead are still asleep in their own fights.
        while((a=Actor(it.Next()))!=null)if(a.Health>0&&!(a is 'PDWarFounder')&&SectionOf(a.CurSector)==Section)n++;
        return n;
    }
    // Soldiers in the closing doorway step into the airlock with us instead of holding it.
    void GatherAllies(int door)
    {
        let it=ThinkerIterator.Create('PDWarAlly');Actor a;Array<Actor> late;
        while((a=Actor(it.Next()))!=null)if(a.Health>0&&!ClearOf(a,door))late.Push(a);
        for(int i=0;i<late.Size();i++)
        {
            Vector2 spot=(XX[Section],XY[Section])+(cos(XA[Section]+90),sin(XA[Section]+90))*((i%3)-1)*28;
            late[i].SetOrigin((spot,XZ[Section]),false);late[i].ClearInterpolation();
        }
    }
    void UpdateRoute()
    {
        if(Section>=Finale)return;
        let p=players[0].mo;int here=p.CurSector.Index();
        int room=XRoom[Section],door=XDoor[Section],tag=XTag[Section];
        // The seal also counts machines killed from the entrance airlock's doorway.
        if(!Secured)
        {
            if(Clock%7==0){Left=SquadLeft(Section);if(Left<=Allowed()||SectionClock>=SECURE_FALLBACK)Secure();}
            return;
        }
        // Once the whole body is inside the exit airlock its door shuts behind us; step
        // back out and it opens again.
        if(Transit==0&&here==room&&ClearOf(p,door)){Transit=1;TransitClock=0;}
        else if(Transit==1&&here!=room)Transit=0;
        if(Transit==1)
        {
            TransitClock++;
            if(DoorGap(door)<1){CrossAirlock();return;}
            if(TransitClock>8&&TransitClock%4==0)GatherAllies(door);
            if(TransitClock>35&&TransitClock%5==0)ClearDoorway(door);
        }
        if(Clock%4==0)Want(door,tag,Transit==0);
    }
    // After a crossing the door ahead opens after a beat. Once we are clear of it, it shuts
    // behind us; come back into the airlock before it has shut and it opens again. Soldiers
    // coming up behind us later reopen it for themselves.
    void UpdateArrival()
    {
        if(Arrive==0||Section<1)return;
        let p=players[0].mo;int k=Section-1;
        ArriveClock++;
        bool inside=p.CurSector.Index()==YRoom[k]||!ClearOf(p,YDoor[k]);
        if(Arrive==1&&ArriveClock>18&&!inside)
        {
            Arrive=2;
            if(Section==Finale&&Stage!=YARD)StartYard();
        }
        else if(Arrive>=2&&inside)Arrive=1;
        if(ArriveClock<18||Clock%4)return;
        // Soldiers coming up behind us use the same door.
        bool coming=AlliesAt(YRoom[k],YDoor[k]);
        if(Arrive==3&&coming)Arrive=2;
        if(Arrive==2&&!coming&&DoorGap(YDoor[k])<1&&!level.Sectors[YDoor[k]].PlaneMoving(Sector.ceiling)){Arrive=3;return;}
        if(Arrive!=3)Want(YDoor[k],YTag[k],Arrive==1||coming);
    }
    void StartYard()
    {
        Stage=YARD;StageClock=0;Wave=0;Pending=BARRAGE;NextWave=BARRAGE*12+140;
        let p=players[0].mo;
        p.A_StartSound("cyber/sight",CHAN_AUTO,0,1,ATTN_NONE);
        p.A_StartSound("misc/teleport",CHAN_AUTO,0,1,ATTN_NONE);
        Bark("RADIO: IT'S A TRAP. THEY'RE EVERYWHERE. THEY'RE",175);
    }
    // Along the route: Centurions and the odd Sentinel. The finale: everything.
    Name NextType()
    {
        if(Stage!=YARD)return Spawned%5==4?'PDWarSquid':Section>=2&&Spawned%3==2?'PDWarAssault':'PDWarTrooper';
        int n=YardSpawned;
        if(n==3||n==12||n>12&&n%18==0)return 'PDWarEnforcer';
        if(n%5==2)return 'PDWarGunship';
        if(n%3==1)return 'PDWarSquid';
        if(Wave>=3&&n%2==0)return 'PDWarAssault';
        return 'PDWarTrooper';
    }
    void Reinforce()
    {
        bool bam=Stage==YARD;
        Array<Actor> pool;
        for(int i=0;i<Pads.Size();i++)if(Pads[i]&&Pads[i].Args[0]==Section+1)pool.Push(Pads[i]);
        if(Pending<=0||pool.Size()==0)return;
        let p=players[0].mo;int live=0;
        let robots=ThinkerIterator.Create('PDWarWalker');Actor robot;
        while((robot=Actor(robots.Next()))!=null)if(robot.Health>0)live++;
        // Failed placements stay in the queue; dead robots release budget slots.
        int attempts=0,added=0,burst=bam?6:2;
        // The finale's first pass only takes pads the player can see, in front of them:
        // the trap should land in view. Then anywhere around.
        bool inView=bam;
        while(Pending>0&&live<LIVE_BUDGET&&added<burst)
        {
            if(attempts>=pool.Size()){if(!inView)break;inView=false;attempts=0;}
            SpawnCursor=(SpawnCursor+1+Random(0,6))%pool.Size();let pad=pool[SpawnCursor];attempts++;
            double distance=pad.Distance2D(p);
            bool visible=pad.CheckSight(p);
            // Along the route, arrivals stay out of sight. In the finale they drop in
            // all around, in plain view, never on top of you.
            if(bam)
            {
                if(distance<300||distance>1500)continue;
                if(inView&&(!visible||cos(p.AngleTo(pad)-p.Angle)<.55))continue;
            }
            else if(visible||distance<384||distance>1280)continue;
            Name type=NextType();
            Vector3 at=pad.Pos;if(type=='PDWarGunship')at.Z+=72;
            let bot=Actor.Spawn(type,at);
            if(!bot)continue;
            if(!bot.TestMobjLocation()){bot.Destroy();continue;}
            if(visible)Actor.Spawn('TeleportFog',pad.Pos);
            bot.Target=p;bot.SetStateLabel('See');Spawned++;live++;added++;Pending--;if(bam)YardSpawned++;
        }
    }
    String Prompt()
    {
        if(Clock<BarkUntil)return BarkText;
        FLineTraceData trace;let p=players[0].mo;
        p.LineTrace(p.Angle,64,0,TRF_THRUACTORS,offsetz:p.player.viewheight,data:trace);
        if(!trace.HitLine)return "";
        let front=trace.HitLine.frontsector,back=trace.HitLine.backsector;
        if(Stage!=YARD&&Section<Finale&&!Secured)
        {
            int door=XDoor[Section];
            if(front&&front.Index()==door||back&&back.Index()==door)
                return String.Format("SEALED. CLEAR THE SECTOR - %d MORE.",max(1,Left-Allowed()));
        }
        // Original doors leading out of a set piece stay shut.
        if(back&&trace.HitLine.special==0&&back.ceilingplane.ZAtPoint(back.centerspot)<=back.floorplane.ZAtPoint(back.centerspot)+1)
            return "JAMMED.";
        return "";
    }
    override void WorldTick()
    {
        if(!Active)return;
        if(BootHolding||Bliss){if(level.time%7==0)Report();return;}
        if(Captured){CaptureClock++;DeathCam();if(CaptureClock>=WAKE_AT){Wake();return;}}
        else
        {
            Clock++;StageClock++;SectionClock++;
            UpdateArrival();
            if(Stage!=YARD)
            {
                UpdateRoute();
                // Mid-battle rooms: machines keep arriving from the moment we do. Elsewhere,
                // stragglers drift into the current sector after a while, more as we go deeper.
                int stream=PDGauntletData.RobotEvery(Section);
                if(stream>0){if(Transit==0&&SectionClock%stream==stream-1&&Pending<4){Wave++;Pending++;}}
                else if(Transit==0&&SectionClock>=TRICKLE_FROM&&(SectionClock-TRICKLE_FROM)%TRICKLE_EVERY==0)
                {Wave++;Pending+=1+Section/2;}
                if(Clock%14==0)Reinforce();
                if(Clock%35==17)Engage();
                Rally();
            }
            else
            {
                // Then it never lets up: a bigger wave every few seconds.
                if(StageClock>=NextWave){Wave++;Pending+=5+Wave;NextWave=StageClock+max(105,175-Wave*5);}
                if(Clock%12==0)Reinforce();
                if(Clock%35==17)Engage();
                Rally();
            }
        }
        if(level.time%7==0)Report();
    }
    int Ammo(String name){let inv=players[0].mo.FindInventory(name);return inv?inv.Amount:0;}
    int Owns(String name){return players[0].mo.FindInventory(name)?1:0;}
    int Doom()
    {
        if(Captured)return 99;
        if(Stage==YARD)return min(99,70+StageClock/40);
        if(Stage==OPEN)return 66;
        return min(65,25+Section*40/max(1,Finale)+Kills/4);
    }
    void Report()
    {
        let p=players[0].mo;int live=0;String enemies="[";let armor=BasicArmor(p.FindInventory('BasicArmor'));
        let it=ThinkerIterator.Create('PDWarWalker');Actor bot;
        while((bot=Actor(it.Next()))!=null)if(bot.Health>0)
        {
            if(live)enemies=enemies..",";
            enemies=enemies..String.Format("{\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"health\":%d,\"kind\":\"%s\",\"squad\":%d}",bot.Pos.X,bot.Pos.Y,bot.Pos.Z,bot.Health,bot.GetClassName(),bot.Args[0]);live++;
        }
        enemies=enemies.."]";
        String friends="[";int n=0;let allies=ThinkerIterator.Create('PDWarAlly');Actor ally;
        while((ally=Actor(allies.Next()))!=null)if(ally.Health>0)
        {
            if(n++)friends=friends..",";
            friends=friends..String.Format("{\"x\":%.1f,\"y\":%.1f,\"kind\":\"%s\",\"fighting\":%d}",ally.Pos.X,ally.Pos.Y,ally.GetClassName(),ally.Target&&ally.Target is 'PDWarWalker'?1:0);
        }
        friends=friends.."]";
        WeaponName=players[0].ReadyWeapon?String.Format("%s",players[0].ReadyWeapon.GetClassName()):"Shotgun";
        String arms=String.Format("[%d,%d,%d,%d,%d,%d]",Owns("Pistol"),Owns("Shotgun"),Owns("Chaingun"),Owns("RocketLauncher"),Owns("PlasmaRifle"),Owns("BFG9000"));
        String stageName=Stage==YARD?"yard":Stage==OPEN?"open":"route";
        int here=SectionOf(p.CurSector);
        Console.Printf("PDOOM_PROLOGUE {\"active\":1,\"map\":\"E1M2\",\"ticks\":%d,\"clock\":%d,\"phase\":\"%s\",\"stage\":\"%s\",\"stage_clock\":%d,\"capture_ticks\":%d,\"x\":%.1f,\"y\":%.1f,\"z\":%.1f,\"angle\":%.1f,\"health\":%d,\"armor\":%d,\"armor_save\":%d,\"weapon\":\"%s\",\"arms\":%s,\"bullets\":%d,\"shells\":%d,\"rockets\":%d,\"cells\":%d,\"kills\":%d,\"wave\":%d,\"reinforcements\":%d,\"yard_spawned\":%d,\"pending\":%d,\"in_yard\":%d,\"live_budget\":%d,\"rooms_revealed\":%d,\"section\":%d,\"sections\":%d,\"section_name\":\"%s\",\"here\":%d,\"section_clock\":%d,\"secured\":%d,\"transit\":%d,\"arrive\":%d,\"exit_gap\":%d,\"behind_gap\":%d,\"left\":%d,\"allies\":%d,\"allies_sent\":%d,\"ally_deaths\":%d,\"founder\":\"%s\",\"ally_list\":%s,\"forced_end\":0,\"defeated_by\":\"%s\",\"robots\":%s,\"pdoom\":%d,\"prompt\":\"%s\"}",
            level.time,Clock,Bliss?"bliss":Captured?"captured":"battle",stageName,StageClock,CaptureClock,p.Pos.X,p.Pos.Y,p.Pos.Z,p.Angle,p.Health,armor?armor.Amount:0,armor?int(armor.SavePercent*100+.5):0,WeaponName,arms,Ammo("Clip"),Ammo("Shell"),Ammo("RocketAmmo"),Ammo("Cell"),Kills,Wave,Spawned,YardSpawned,Pending,InYard(p),LIVE_BUDGET,Rooms,
            Section+1,SecFirst.Size(),PDGauntletData.Name(Section),here+1,SectionClock,Secured?1:0,Transit==1?1:Arrive==1?2:0,Arrive,Section<Finale?int(DoorGap(XDoor[Section])):-1,Section>0?int(DoorGap(YDoor[Section-1])):-1,Left,LiveAllies(),AlliesSent,AllyDeaths,Founder?String.Format("%s",Founder.GetClassName()):"",friends,DefeatedBy,enemies,Doom(),Prompt());
    }
}
