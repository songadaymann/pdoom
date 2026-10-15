// Map-aware facade keeps movement and rescue owners shared.
class PDCheckpointMap : Object play
{
    static bool Hal(){return level.MapName=="E1M7";}
    static int Width(){return Hal()?PDHalMap.Width():PDControlMap.Width();}
    static int Height(){return Hal()?PDHalMap.Height():PDControlMap.Height();}
    static int Step(){return Hal()?PDHalMap.Step():PDControlMap.Step();}
    static int OriginX(){return Hal()?PDHalMap.OriginX():PDControlMap.OriginX();}
    static int OriginY(){return Hal()?PDHalMap.OriginY():PDControlMap.OriginY();}
    static int SiteDoor(int site){return Hal()?PDHalMap.SiteDoor(site):PDControlMap.SiteDoor(site);}
    static String SiteName(int site){return Hal()?PDHalMap.SiteName(site):PDControlMap.SiteName(site);}
    static Vector2 SiteExit(int site){return Hal()?PDHalMap.SiteExit(site):PDControlMap.SiteExit(site);}
    static bool SiteInside(int site,Vector2 p){return Hal()?PDHalMap.SiteInside(site,p):PDControlMap.SiteInside(site,p);}
    static Vector2 DoorPoint(int tag,Vector2 near){return Hal()?PDHalMap.DoorPoint(tag,near):PDControlMap.DoorPoint(tag,near);}
    static Vector2 Center(int node){return Hal()?PDHalMap.Center(node):PDControlMap.Center(node);}
    static void Load(out Array<int> links,out Array<int> humans,out Array<int> doors){if(Hal())PDHalMap.Load(links,humans,doors);else PDControlMap.Load(links,humans,doors);}
}
