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
            // 11 Door_Open, 12 Door_Raise: Doom's D1/DR doors after translation.
            if((line.special==11||line.special==12)&&(line.activation&SPAC_Use))line.activation|=SPAC_Push;
        }
    }
}
