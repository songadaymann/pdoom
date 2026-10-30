// Ordinary Doom doors open when you walk into them (Hexen's push doors), so
// the use key is left for switches and releases. Only lines that were already
// usable doors gain this; scripted bulkheads and cells have no line special.
// Native push doors never close again when bumped while open.
class PDAutoDoors : EventHandler
{
    override void WorldLoaded(WorldEvent e)
    {
        for(int i=0;i<level.Lines.Size();i++)
        {
            let line=level.Lines[i];
            // E1M4's central tag-1 octagon lost the blue key that marked its only inside trigger (128..176,768..816), so its 12 outer WR approach lines open it for good instead of shutting a solo player in (2026-10-30). Door_Open's args[2] is a light tag, so the 150 tic delay must go.
            if(level.MapName=="E1M4"&&line.special==12&&line.args[0]==1&&(line.activation&SPAC_Cross)){line.special=11;line.args[2]=0;}
            // 11 Door_Open, 12 Door_Raise: Doom's D1/DR doors after translation.
            if((line.special==11||line.special==12)&&(line.activation&SPAC_Use))line.activation|=SPAC_Push;
        }
    }
}
