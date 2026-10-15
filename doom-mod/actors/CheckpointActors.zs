class PDCheckpointPrisoner : PDCompanion
{
    // Escorts can slip past people, pursuers and decorative actor props.
    // Native walls, closed doors and shootable obstacles still block them.
    override bool CanCollideWith(Actor other, bool passive)
    {
        if (other is 'PDHunter' || other is 'PDCompanion' || other is 'PlayerPawn' || !other.bShootable) return false;
        return Super.CanCollideWith(other, passive);
    }
    bool Derezzing;
    int DerezAt;
    Vector2 RestScale;
    override void PostBeginPlay()
    {
        Super.PostBeginPlay(); RestScale = Scale;
    }
    // Doom registers directional sprite families from state declarations.
    // These banks make them available to the site selector without changing
    // the inherited standing/walking timings or gameplay state labels.
    States
    {
    Run:
        SURV ABCD 3;
        Loop;
    Death:
        SAMS A 0 {Derezzing=true;DerezAt=level.time;bSolid=false;bShootable=false;Actor.Spawn('PDDerezBadge',Pos);for(int i=0;i<24;i++){let s=Actor.Spawn('PDRescueSpark',Pos+(random(-12,12),random(-12,12),random(4,48)));if(s)s.Vel=(random(-2,2),random(-2,2),random(1,4));}}
        SAMS A 35 {Sprite=GetSpriteIndex(PDNamedCast.Art(Args[0],false));Frame=0;}
        Stop;
    MiloCrouchArt:
        MCRH ABCD -1;
        Stop;
    JulesArt:
        JULS ABCD -1;
        JCRH ABCD -1;
        Stop;
    SamArt:
        SAMS ABCD -1;
        SCRH ABCD -1;
        Stop;
    NoahArt:
        NOAH ABCD -1;
        NCRH ABCD -1;
        Stop;
    AshArt:
        ASHS ABCD -1;
        ACRH ABCD -1;
        Stop;
    }
    // State frames still control timing; site identity and collision height
    // select the matching directional standing or articulated crouch artwork.
    override void Tick()
    {
        Super.Tick();
        if(Derezzing){Alpha=max(0.,1.-(level.time-DerezAt)/35.);return;}
        if (Sprite == GetSpriteIndex('PLAY')) return;
        PDRescueIdle.Animate(self);
        Sprite = GetSpriteIndex(PDNamedCast.Art(Args[0],Height<40));
    }
    // Original Doom monster barriers should not stop rescued humans.
    Default { Radius 10; +NOBLOCKMONST +NOBLOOD }
    override int DamageMobj(Actor inflictor, Actor source, int damage, Name mod, int flags, double angle)
    {
        let game = PDCheckpoint.Get();
        // A locked cell protects the captive. Threat starts after release.
        if (game && game.Cast && !game.Cast.People[Args[0]].Released) return 0;
        if (game && game.Refuge && PDRescueRefuge.Inside(Pos.XY)) return 0;
        return Super.DamageMobj(inflictor, source, damage, mod, flags, angle);
    }
}

class PDCheckpointProp : Actor
{
    int Kind;
    int StoredAmmo;
    // UDMF thing angles are integers; retain exact wall normals separately.
    override void PostBeginPlay(){Super.PostBeginPlay();Angle+=Args[4]*.0001;}
    Default { Radius 12; Height 24; +NOGRAVITY }
}
class PDCheckpointCamera : PDCheckpointProp
{
    double ScanAngle;
    bool Broken;
    bool Turned;
    int SeenUntil;
    int Reports;
    Default { Health 1; Radius 18; Height 30; Scale 0.7; +SHOOTABLE +NOBLOOD +WALLSPRITE }
    override int DamageMobj(Actor inflictor, Actor source, int damage, Name mod, int flags, double angle)
    {
        if (!Broken && damage > 0)
        {
            let game = PDCheckpoint.Get();
            if (game) game.Combat.BreakCamera(game, self);
        }
        return 0;
    }
    States { Spawn: CPCA A -1; Stop; Broken: CPCB A -1; Stop; Spotted: CPCA B -1 Bright; Stop; }
    override void PostBeginPlay() { Super.PostBeginPlay(); ScanAngle = Angle; }
}
class PDCheckpointWrench : PDCheckpointProp
{
    Default { Radius 8; Height 16; -NOGRAVITY }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 1; }
    States { Spawn: CPWR A -1; Stop; }
}
class PDCheckpointGun : PDCheckpointProp
{
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 2; StoredAmmo = 3; }
    States { Spawn: SLNG A -1; Stop; }
}
// The slingshot's ball bearing: a ricochet tink and a small spark where it lands.
class PDSlingPuff : BulletPuff
{
    Default { SeeSound "pdoom/sling-hit"; AttackSound "pdoom/sling-hit"; Scale .5; +PUFFONACTORS }
}
// What you see in flight. Purely visual: the hit itself is already resolved.
class PDSlingStone : Actor
{
    int Life;
    Default { Radius 2; Height 2; Scale .75; +NOINTERACTION +NOGRAVITY }
    void Fly(Vector3 to)
    {
        Vector3 d = to - Pos; double distance = d.Length();
        if (distance < 1) { Destroy(); return; }
        Vel = d / distance * 48; Life = max(1, int(distance / 48));
    }
    override void Tick() { Super.Tick(); if (--Life < 0) Destroy(); }
    States { Spawn: SLNS A -1 Bright; Stop; }
}
class PDCheckpointLock : PDCheckpointProp
{
    Default { +WALLSPRITE }
    Default { Health 1; Radius 14; Height 16; Scale 0.45; +SHOOTABLE +NOBLOOD }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 3; }
    // The padlock no longer breaks; each cell has one way in (see PDLevelPolish hints).
    override int DamageMobj(Actor inflictor, Actor source, int damage, Name mod, int flags, double angle) { return 0; }
    States { Spawn: CPLK A -1; Stop; }
}
class PDCheckpointRelease : PDCheckpointProp
{
    Default { +WALLSPRITE }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 4; }
    States { Spawn: CPRL A -1; Stop; }
}
class PDCheckpointHunter : PDHunter
{
    override void Tick()
    {
        Super.Tick();let game=PDCheckpoint.Get();
        if(PDCampaignSession.Hal()&&game&&game.Hal&&game.Hal.Personality)
        {Sprite=GetSpriteIndex('H300');Frame=game.Hal.Personality.Disposition;}
    }
    override int DamageMobj(Actor inflictor,Actor source,int damage,Name mod,int flags,double angle)
    {
        let game=PDCheckpoint.Get();
        if(damage>0&&source==players[0].mo&&PDCampaignSession.Hal()&&game&&game.Hal)
            game.Hal.Personality.Offense(game,self,true);
        return Super.DamageMobj(inflictor,source,damage,mod,flags,angle);
    }
}
