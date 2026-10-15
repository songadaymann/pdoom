// Generated from map.json by scripts/build-doom-mod.py. Do not edit.
class PDMap : Object
{
    static int Width() { return 26; }
    static int Height() { return 26; }
    static int CellSize() { return 128; }
    static int Kind(int gx, int gy)
    {
        if (gx < 0 || gx >= 26 || gy < 0 || gy >= 26) return 0;
        switch (gy)
        {
        case 1:
            if (gx == 8) return 1;
            return 0;
        case 2:
            if (gx == 7) return 3;
            if (gx == 8) return 8;
            if (gx >= 9 && gx <= 18) return 1;
            return 0;
        case 3:
            if (gx >= 3 && gx <= 7) return 3;
            if (gx >= 17 && gx <= 19) return 1;
            return 0;
        case 4:
            if (gx >= 3 && gx <= 7) return 3;
            if (gx >= 8 && gx <= 15) return 1;
            if (gx >= 17 && gx <= 19) return 1;
            return 0;
        case 5:
            if (gx >= 3 && gx <= 7) return 3;
            if (gx >= 9 && gx <= 15) return 1;
            if (gx >= 17 && gx <= 19) return 1;
            return 0;
        case 6:
            if (gx >= 3 && gx <= 7) return 3;
            if (gx >= 10 && gx <= 12) return 1;
            if (gx >= 17 && gx <= 19) return 1;
            return 0;
        case 7:
            if (gx >= 5 && gx <= 6) return 6;
            if (gx >= 9 && gx <= 10) return 1;
            if (gx == 12) return 1;
            if (gx == 13) return 5;
            if (gx >= 14 && gx <= 19) return 1;
            return 0;
        case 8:
            if (gx >= 1 && gx <= 7) return 2;
            if (gx >= 9 && gx <= 12) return 1;
            if (gx >= 14 && gx <= 19) return 1;
            return 0;
        case 9:
            if (gx >= 1 && gx <= 7) return 2;
            if (gx >= 9 && gx <= 12) return 4;
            if (gx == 14) return 1;
            if (gx >= 16 && gx <= 19) return 1;
            return 0;
        case 10:
            if (gx >= 1 && gx <= 7) return 2;
            if (gx >= 9 && gx <= 12) return 1;
            if (gx >= 14 && gx <= 17) return 1;
            if (gx == 19) return 1;
            return 0;
        case 11:
            if (gx == 1) return 2;
            if (gx >= 4 && gx <= 7) return 2;
            if (gx >= 9 && gx <= 12) return 1;
            if (gx >= 14 && gx <= 19) return 1;
            return 0;
        case 12:
            if (gx >= 1 && gx <= 7) return 2;
            if (gx >= 10 && gx <= 19) return 1;
            return 0;
        case 13:
            if (gx >= 1 && gx <= 5) return 2;
            if (gx == 7) return 2;
            if (gx >= 16 && gx <= 18) return 1;
            return 0;
        case 14:
            if (gx >= 1 && gx <= 5) return 2;
            if (gx == 7) return 2;
            if (gx >= 16 && gx <= 18) return 1;
            return 0;
        case 15:
            if (gx >= 1 && gx <= 7) return 2;
            if (gx >= 16 && gx <= 18) return 1;
            return 0;
        case 16:
            if (gx >= 1 && gx <= 24) return 2;
            return 0;
        case 17:
            if (gx >= 1 && gx <= 24) return 2;
            return 0;
        case 18:
            if (gx >= 1 && gx <= 9) return 2;
            if (gx >= 13 && gx <= 24) return 2;
            return 0;
        case 19:
            if (gx >= 1 && gx <= 17) return 2;
            if (gx >= 19 && gx <= 24) return 2;
            return 0;
        case 20:
            if (gx >= 1 && gx <= 17) return 2;
            if (gx >= 19 && gx <= 24) return 2;
            return 0;
        case 21:
            if (gx >= 1 && gx <= 6) return 2;
            if (gx >= 9 && gx <= 24) return 2;
            return 0;
        case 22:
            if (gx >= 1 && gx <= 13) return 2;
            if (gx >= 16 && gx <= 24) return 2;
            return 0;
        case 23:
            if (gx >= 1 && gx <= 24) return 7;
            return 0;
        case 24:
            if (gx >= 1 && gx <= 24) return 7;
            return 0;
        }
        return 0;
    }
    static Vector2 CellCenter(int index)
    {
        int gx = index % 26;
        int gy = index / 26;
        return ((gx + 0.5) * 128, (gy + 0.5) * 128);
    }
    static Vector2 CartParking() { return (1168.0, 292.0); }
}
