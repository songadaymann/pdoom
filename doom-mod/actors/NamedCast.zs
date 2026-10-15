// Generated from art/campaign-v2/roster.json.
class PDNamedCast : Object play
{
    static Name Art(int site,bool crouch)
    {
        if(level.MapName=="E1M7")
        {
            if(site==0)return crouch?'ROCR':'ROBM';
            if(site==1)return crouch?'DACR':'DANH';
            if(site==2)return crouch?'NACR':'NATS';
            if(site==3)return crouch?'RMCR':'ROMY';
            if(site==4)return crouch?'BECR':'BETH';
        }
            if(site==0)return crouch?'LRCG':'LRSH';
            if(site==1)return crouch?'STCR':'STUR';
            if(site==2)return crouch?'ELCR':'ELYU';
            if(site==3)return crouch?'HICR':'HINT';
            if(site==4)return crouch?'HOCR':'HOEL';
        return 'LRSH';
    }
}
class PDNamedCastArtBank : Actor
{
    States
    {
    lironArt:
        LRSH ABCD -1;
        LRCG ABCD -1;
        Stop;
    stuartArt:
        STUR ABCD -1;
        STCR ABCD -1;
        Stop;
    eliezerArt:
        ELYU ABCD -1;
        ELCR ABCD -1;
        Stop;
    hintonArt:
        HINT ABCD -1;
        HICR ABCD -1;
        Stop;
    hollyArt:
        HOEL ABCD -1;
        HOCR ABCD -1;
        Stop;
    robArt:
        ROBM ABCD -1;
        ROCR ABCD -1;
        Stop;
    danArt:
        DANH ABCD -1;
        DACR ABCD -1;
        Stop;
    nateArt:
        NATS ABCD -1;
        NACR ABCD -1;
        Stop;
    romanArt:
        ROMY ABCD -1;
        RMCR ABCD -1;
        Stop;
    bethArt:
        BETH ABCD -1;
        BECR ABCD -1;
        Stop;
    }
}
