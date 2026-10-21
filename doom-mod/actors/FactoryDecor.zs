// Doom's own decorations, recoloured as toy-factory set dressing. Args[0] picks
// a TRNSLATE colourway written by scripts/factory_theme.py. They are scenery
// only: not solid, so escorts and puzzle routes stay exactly as verified.
class PDToyDecor : Actor
{
    Default {Radius 12;Height 40;+NOBLOCKMONST;+DONTSPLASH;}
    virtual String Colourway() {return "PDToyDrum";}
    override void PostBeginPlay()
    {
        Super.PostBeginPlay();
        A_SetTranslation(String.Format("%s%d",Colourway(),Args[0]));
    }
}
class PDToyDrum : PDToyDecor
{
    Default {Radius 10;Height 42;}
    States {Spawn: BAR1 AB 6;Loop;}
}
class PDToyLamp : PDToyDecor
{
    Default {Radius 10;Height 48;}
    override String Colourway() {return "PDToyLamp";}
    States {Spawn: COLU A -1 Bright;Stop;}
}
class PDToyPylon : PDToyDecor
{
    Default {Radius 16;Height 128;}
    override String Colourway() {return "PDToyPylon";}
    States {Spawn: ELEC A -1;Stop;}
}
class PDToyColumn : PDToyDecor
{
    Default {Radius 16;Height 52;}
    override String Colourway() {return "PDToyColumn";}
    States {Spawn: COL1 A -1;Stop;}
}
class PDToyBollard : PDToyDecor
{
    Default {Radius 16;Height 40;}
    override String Colourway() {return "PDToyBollard";}
    States {Spawn: COL2 A -1;Stop;}
}
