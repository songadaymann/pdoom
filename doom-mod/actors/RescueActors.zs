class PDCheckpointTurret : PDCheckpointProp
{
    Default { Health 1; Radius 20; Height 40; +SHOOTABLE +NOBLOOD }
    // Armoured: hits only clang. The one way past is round the back to its breaker.
    override int DamageMobj(Actor inflictor, Actor source, int damage, Name mod, int flags, double angle)
    {
        let game = PDCheckpoint.Get();
        if (game && damage > 0 && !game.Encounters.TurretBroken) { game.Encounters.TurretHits++; A_StartSound("world/metal1", CHAN_BODY, CHANF_OVERLAP, .5); }
        return 0;
    }
    States { Spawn: CPTU A -1; Stop; Aim: CPTU B -1 Bright; Stop; Broken: CPTU C -1; Stop; }
}
class PDCheckpointBreaker : PDCheckpointProp
{
    Default { +WALLSPRITE }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 10; }
    States { Spawn: CPRL A -1; Stop; }
}
class PDCheckpointKey : PDCheckpointProp
{
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 5; }
    States { Spawn: BKEY A -1 Bright; Stop; }
}
class PDCheckpointCharge : PDCheckpointProp
{
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 6; }
    States { Spawn: ROCK A -1; Stop; }
}
class PDCheckpointBreach : PDCheckpointProp
{
    Default { +WALLSPRITE }
    Default { Radius 16; Height 48; }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 7; }
    States { Spawn: CPBR A -1; Stop; }
}
class PDCheckpointPad : PDCheckpointProp
{
    Default { Radius 24; Height 4; +FLATSPRITE }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 8; Pitch = 0; }
    States { Spawn: CPPD A -1; Stop; Active: CPPD B -1 Bright; Stop; }
}
class PDCheckpointEmergency : PDCheckpointProp
{
    Default { +WALLSPRITE }
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 9; }
    States { Spawn: CPER A -1; Stop; }
}
class PDCheckpointRounds : PDCheckpointProp
{
    override void PostBeginPlay() { Super.PostBeginPlay(); Kind = 11; StoredAmmo = 2; }
    States { Spawn: SLNB A -1; Stop; }
}
class PDCheckpointBolt : PlasmaBall
{
    Default { Damage 3; Speed 18; }
}
class PDRescueDebris : Actor
{
    int Age;
    Default { Radius 3; Height 3; +NOBLOCKMAP +ROLLSPRITE }
    override void Tick()
    {
        Super.Tick(); Age++; Roll += 12;
        if (Age > 105) Destroy();
    }
    States { Spawn: CPDB A -1; Stop; }
}
class PDRescueSmoke : Actor
{
    int Age;
    Default { Radius 2; Height 2; +NOBLOCKMAP +NOGRAVITY +NOCLIP RenderStyle "Translucent"; Alpha 0.75; }
    override void Tick()
    {
        Super.Tick(); Age++;
        Scale = Scale * 1.025; Alpha = max(0, 0.75 * (1.0 - Age / 70.0));
        if (Age >= 70) Destroy();
    }
    States { Spawn: CPMS A -1; Stop; }
}
