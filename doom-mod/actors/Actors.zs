class PDSurvivorPlayer : DoomPlayer
{
    Default
    {
        Player.DisplayName "p(DOOM) Survivor";
        Player.ForwardMove 0.56, 0.81;
        Player.SideMove 0.56, 0.81;
        Species "PDHuman";
        +THRUSPECIES
    }
    override void GiveDefaultInventory() {}
    bool ModUseHeld,PreviousUse;
    override void PlayerThink()
    {
        let battle=PDLastStand.Get();
        if(battle&&battle.Active&&!battle.Captured)
        {
            // Restore native Doom's pace only during the combat prologue.
            double factor=(player.cmd.buttons&BT_SPEED)?0.81:0.56;
            player.cmd.forwardmove=int(player.cmd.forwardmove/factor);
            player.cmd.sidemove=int(player.cmd.sidemove/factor);
        }
        int buttons=player.cmd.buttons;
        bool held=(buttons&BT_USE)!=0;
        // Own the complete E press, even if the pickup disappears this tick.
        // Native doors get their normal use action when no mod target owns it.
        if(!held)ModUseHeld=false;
        else if(!PreviousUse){let checkpoint=PDCheckpoint.Get();ModUseHeld=checkpoint&&checkpoint.HandlesUse();}
        PreviousUse=held;
        if(ModUseHeld)player.cmd.buttons &= ~BT_USE;
        if(AutoCrouch())player.cmd.buttons|=BT_CROUCH;
        Super.PlayerThink();
        if(ModUseHeld)player.cmd.buttons=buttons;
    }
    // No crouch key: walking into a space too low to stand in ducks you, and
    // native Doom stands you back up once there is headroom again.
    bool AutoCrouch()
    {
        if(player.health<=0||!CanCrouch())return false;
        // Already under a low ceiling: stay down, even while standing still.
        if(Fits(Pos.XY)==1)return true;
        if(!(player.cmd.forwardmove||player.cmd.sidemove))return false;
        Vector2 ahead=(cos(Angle),sin(Angle))*player.cmd.forwardmove+(sin(Angle),-cos(Angle))*player.cmd.sidemove;
        if(ahead.Length()<1)return false;
        ahead=ahead.Unit();
        Vector2 across=(-ahead.Y,ahead.X);
        // Steps no longer than our radius cannot skip past a wall; side lanes
        // forgive an approach that is slightly off a duct's centre line.
        for(int step=8;step<=16;step+=8)
            for(int lane=-1;lane<=1;lane++)
            {
                Vector2 at=Pos.XY+ahead*step+across*lane*8;
                // A door or lift mid-travel is not a duct.
                if(!level.PointInSector(at).ceilingdata&&Fits(at)==1)return true;
            }
        return false;
    }
    // 2 = room to stand, 1 = only crouched, 0 = blocked either way.
    int Fits(Vector2 at)
    {
        double current=Height;
        Height=FullHeight;bool stands=CheckMove(at,PCM_NOACTORS);
        Height=FullHeight*.5;bool crawls=CheckMove(at,PCM_NOACTORS);
        Height=current;
        return stands?2:crawls?1:0;
    }
    override void Die(Actor source,Actor inflictor,int dmgflags,Name MeansOfDeath)
    {
        let battle=PDLastStand.Get();
        if(battle&&battle.Active)
        {
            // Native damage has already exhausted health after armor absorption.
            // Retain a living pawn for the fade, without the Doom death menu.
            health=1;if(player)player.health=1;
            battle.Capture(source);return;
        }
        Super.Die(source,inflictor,dmgflags,MeansOfDeath);
    }
    override int DamageMobj(Actor inflictor, Actor source, int damage, Name mod, int flags, double angle)
    {
        let battle=PDLastStand.Get();
        if(battle&&battle.Active)
        {
            if(battle.BootHolding||battle.Captured)return 0;
            // The soldiers and the founder beside us never hurt us.
            if(source is 'PDWarAlly')return 0;
            // Let native armor and damage rules decide whether this is lethal.
            return Super.DamageMobj(inflictor,source,damage,mod,flags,angle);
        }
        let checkpoint = PDCheckpoint.Get();
        if (checkpoint && checkpoint.Initialized && !checkpoint.Ended && checkpoint.Refuge && PDRescueRefuge.Inside(Pos.XY) && mod != 'Suicide') return 0;
        if (checkpoint && checkpoint.Initialized && !checkpoint.Ended && damage >= health)
        {
            checkpoint.LosePlayer();
            return 0;
        }
        let game = PDGame.Get();
        if (game && game.Initialized && !game.Ended && damage >= health)
        {
            game.KillPerson(game.Controlled);
            return 0;
        }
        return Super.DamageMobj(inflictor, source, damage, mod, flags, angle);
    }
}

class PDCompanion : Actor
{
    int PersonId;
    Default
    {
        Health 100;
        Radius 14;
        Height 56;
        Species "PDHuman";
        +SHOOTABLE
        +SOLID
        +THRUSPECIES
        DeathSound "player/male/death1";
    }
    States
    {
    Spawn:
        SURV A -1;
        Stop;
    Walk:
        SURV ABCD 6;
        Loop;
    Death:
        PLAY H 5 A_Scream;
        PLAY I 5 A_NoBlocking;
        PLAY JKLM 5;
        PLAY N -1;
        Stop;
    }
}

class PDSavedHuman : Actor
{
    Default { Radius 14; Height 56; Species "PDHuman"; }
    States { Spawn: SURV A -1; Stop; }
}

class PDDeadHuman : Actor
{
    Default { Radius 14; Height 16; }
    States { Spawn: PLAY N -1; Stop; }
}

class PDExplosion : Actor
{
    Default { +NOGRAVITY }
    States
    {
    Spawn:
        MISL B 8 Bright A_StartSound("weapons/rocklx", CHAN_BODY);
        MISL C 6 Bright;
        MISL D 4 Bright;
        Stop;
    }
}

class PDHunter : Actor
{
    States { HAL: H300 A -1 Bright; Stop; HalArt: H300 ABC -1; Stop; }
    bool LockedAim;
    double ShotAngle,ShotPitch;
    Vector3 ShotPoint;
    int AimTics;
    int ReloadUntil;
    int StunUntil;
    int ImmuneUntil;
    int Mood;
    int PreyId;
    int DoorWait;
    double StepDistance;
    int FootstepsPlayed;
    double LastStepVolume;
    int LaserShots;

    void FireLaser(Actor prey)
    {
        // Native rail particles draw a bright, wall-clipped red pulse. Damage
        // stays with the rescue controller so the existing health rules apply.
        Target = prey;
        A_CustomRailgun(0, 0, "ff2020", "ff7070", RGF_SILENT | RGF_NOPIERCING | RGF_FULLBRIGHT | RGF_CENTERZ,
            1, range: 1100, duration: 14, sparsity: 0.5, driftspeed: 0, spawnofs_z: 8);
        LaserShots++;
    }

    void LockShot(Actor prey)
    {
        LockedAim=true;ShotPoint=prey.Pos+(0,0,prey.Height*.5);
        Vector3 d=ShotPoint-(Pos+(0,0,48));ShotAngle=atan2(d.Y,d.X);ShotPitch=-atan2(d.Z,d.XY.Length());
    }
    void FireLocked(int damage)
    {
        let marker=Actor.Spawn('PDLaserMarker',ShotPoint);Target=marker;
        A_CustomRailgun(0,0,"ff2020","ff7070",RGF_SILENT|RGF_NOPIERCING|RGF_FULLBRIGHT|RGF_CENTERZ,1,range:1100,duration:14,sparsity:.5,driftspeed:0,spawnofs_z:8);
        LineAttack(ShotAngle,1100,ShotPitch,damage,'HunterShot','BulletPuff',flags:LAF_OVERRIDEZ,offsetz:48);
        if(marker)marker.Destroy();LaserShots++;LockedAim=false;
    }

    // Called after native movement, so blocked doors and aiming stay quiet.
    void MovementFootsteps(Vector2 previous)
    {
        double moved = (Pos.XY - previous).Length();
        if (moved < 0.1) return;
        StepDistance += moved;
        if (StepDistance < 48) return;
        StepDistance -= 48;
        let listener = players[0].mo;
        if (!listener) return;
        double distance = Distance3D(listener);
        if (distance >= 512) return;
        LastStepVolume = 0.65 * (1.0 - distance / 512.0);
        A_StartSound("cyber/hoof", CHAN_BODY, 0, LastStepVolume, ATTN_NORM);
        FootstepsPlayed++;
    }
    Default
    {
        Health 100000;
        Radius 19;
        Height 64;
        Mass 10000;
        +SOLID
        +SHOOTABLE
        +NOBLOOD
    }
    States
    {
    Spawn:
        HUNT A -1;
        Stop;
    Walk:
        HUNT ABCD 8;
        Loop;
    Aim:
        HUNT EF 6 Bright;
        Loop;
    Stun:
        HUNT G 3;
        Loop;
    }
}

// These temporary Doom prop sprites can be replaced independently of behavior.
class PDProp : Actor
{
    int PropKind;
    bool Used;
    int StoredAmmo;
    property Kind: PropKind;
    Default { Radius 16; Height 32; +NOGRAVITY }
}
class PDCamera : PDProp
{
    Default { PDProp.Kind 1; Height 56; Scale 0.55; }
    States { Spawn: CEYE ABCB 6 Bright; Loop; Broken: CEYE A -1; Stop; }
}
class PDCart : PDProp
{
    Default { PDProp.Kind 2; Radius 32; Height 48; Scale 1.3; }
    States { Spawn: BAR1 A -1; Stop; }
}
class PDCharge : PDProp
{
    Default { PDProp.Kind 3; }
    States { Spawn: ROCK A -1; Stop; }
}
class PDBurningCharge : Actor
{
    Default { Radius 8; Height 16; +NOGRAVITY }
    States
    {
    Spawn:
        ROCK A 4 Bright;
        ROCK A 4;
        Loop;
    }
}
class PDCrackedWall : PDProp
{
    Default { PDProp.Kind 4; }
    States { Spawn: TNT1 A -1; Stop; }
}
class PDGun : PDProp
{
    override void PostBeginPlay() { Super.PostBeginPlay(); StoredAmmo = 6; }
    Default { PDProp.Kind 5; }
    States { Spawn: SHOT A -1; Stop; }
}
class PDRelay : PDProp
{
    Default { PDProp.Kind 6; Height 64; Scale 0.6; }
    States { Spawn: COLU A -1; Stop; }
}
class PDAmmo : PDProp
{
    override void PostBeginPlay() { Super.PostBeginPlay(); StoredAmmo = 2; }
    Default { PDProp.Kind 7; }
    States { Spawn: SHEL A -1; Stop; }
}
class PDDoor : PDProp
{
    Default { PDProp.Kind 8; }
    States { Spawn: TNT1 A -1; Stop; }
}

class PDLaserMarker : Actor
{Default{Radius 1;Height 1;+NOBLOCKMAP +NOGRAVITY +NOCLIP}States{Spawn:TNT1 A -1;Stop;}}
