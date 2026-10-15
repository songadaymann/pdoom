"""Mirror of src/bliss.ts HILLS and groundY() as of 2026-10-06 (read-only copy for the hub spec)."""
import math
HILLS=[(42,-18,2.2,1800,700),(-12,-24,1.4,1400,600),(-45,-92,30,14000,2100),(120,-235,26,7000,6000),
 (-260,-420,22,9000,7000),(-60,-560,16,6000,5000),(260,-520,20,8000,6000),(480,-300,24,9000,9000),
 (-480,-180,18,9000,8000),(-420,260,20,10000,9000),(150,560,22,9000,8000),(520,250,16,8000,8000)]
def sm(a,b,x):
    t=min(1,max(0,(x-a)/(b-a)));return t*t*(3-2*t)
def gy(x,z,hills=HILLS):
    if 0<=z<34 and -4<x<38: return 0
    h=sum(a*math.exp(-((x-cx)**2/sx+(z-cz)**2/sz)) for cx,cz,a,sx,sz in hills)
    return h*sm(0,14,-z) if z<0 else h*sm(34,60,z+max(0,abs(x-17)-21)*1.5)
