// Two-stage external rescue, or the crawlway with local controls inside.
class PDRescueHolly : Object play
{
    bool Powered;
    bool GateOpen;
    bool BridgeUp;
    PDHollyPower Feed;
    PDHollyControl Control;

    void Load()
    {
        let feeds=ThinkerIterator.Create('PDHollyPower');Feed=PDHollyPower(feeds.Next());
        let controls=ThinkerIterator.Create('PDHollyControl');Control=PDHollyControl(controls.Next());
    }

    String Prompt(int kind)
    {
        if(kind==30)return Powered?"":"SPACE - restore power";
        if(kind==31)return GateOpen&&BridgeUp?"":Powered?"SPACE - raise bridge / open gate":"NO POWER";
        if(kind==32)return GateOpen?"":"SPACE - open cell gate";
        if(kind==33)return BridgeUp?"":"SPACE - raise bridge";
        return "";
    }

    void Use(PDCheckpoint game, PDCheckpointProp panel)
    {
        int kind=panel.Kind;
        if(kind==30)
        {
            if(Powered)return;
            Powered=true;Feed.SetStateLabel('On');Control.SetStateLabel('On');
            panel.A_StartSound("switches/normbutn",CHAN_BODY);
            game.Say("Power on. The cable leads to the bridge control upstairs.",140);
            return;
        }
        if(kind==31&&!Powered)
        {game.Say("No power. Follow the cable.",105);return;}
        panel.A_StartSound("switches/normbutn",CHAN_BODY);
        if((kind==31||kind==32)&&!GateOpen){GateOpen=true;Door_Open(881,24);}
        if((kind==31||kind==33)&&!BridgeUp)
        {
            BridgeUp=true;Floor_RaiseByValue(2,8,64);
            // Paths were authored for the raised bridge; invalidate any cached
            // routes when its physical state changes.
            for(int i=0;i<game.Cast.People.Size();i++)
            {game.Cast.People[i].Nav.Ready=false;game.Cast.People[i].Nav.HasWaypoint=false;}
            game.HunterNav.Ready=false;game.HunterNav.HasWaypoint=false;
        }
        panel.SetStateLabel('On');
        if(GateOpen&&BridgeUp)game.OpenCell(4,kind==31?"powered-bridge":"crawl-controls");
        else game.Say(GateOpen?"Gate open. Now raise the bridge.":"Bridge up. Now open the gate.",105);
    }

    String Report()
    {
        let bridge=level.PointInSector((-1136,1888));
        return String.Format("{\"powered\":%d,\"gate_open\":%d,\"bridge_up\":%d,\"bridge_height\":%.1f}",Powered,GateOpen,BridgeUp,bridge.floorplane.ZatPoint((-1136,1888)));
    }
}
class PDHollyPower : PDCheckpointProp
{
    Default { +WALLSPRITE }
    override void PostBeginPlay(){Super.PostBeginPlay();Kind=30;}
    States { Spawn: PHFP A -1; Stop; On: PHFP B -1 Bright; Stop; }
}
class PDHollyControl : PDCheckpointProp
{
    Default { +WALLSPRITE }
    override void PostBeginPlay(){Super.PostBeginPlay();Kind=31;}
    States { Spawn: PHCT A -1; Stop; On: PHCT B -1 Bright; Stop; }
}
class PDHollyGate : PDCheckpointProp
{
    Default { +WALLSPRITE }
    override void PostBeginPlay(){Super.PostBeginPlay();Kind=32;}
    States { Spawn: PHGT A -1; Stop; On: PHGT B -1 Bright; Stop; }
}
class PDHollyBridge : PDCheckpointProp
{
    Default { +WALLSPRITE }
    override void PostBeginPlay(){Super.PostBeginPlay();Kind=33;}
    States { Spawn: PHBG A -1; Stop; On: PHBG B -1 Bright; Stop; }
}
class PDHollyCable : Actor
{
    Default { +NOGRAVITY +NOBLOCKMAP +FLATSPRITE }
    override void PostBeginPlay(){Super.PostBeginPlay();Pitch=0;Angle+=Args[4]*.0001;}
    override void Tick()
    {
        Super.Tick();SetOrigin((Pos.X,Pos.Y,floorz+1),false);
        let game=PDCheckpoint.Get();Frame=game&&game.Holly&&game.Holly.Powered?1:0;
    }
    States { Spawn: PHCB A -1; Stop; Banks: PHCB B -1; Stop; }
}
