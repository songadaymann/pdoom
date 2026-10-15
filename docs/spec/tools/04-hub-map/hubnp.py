import numpy as np
from hub import ALL, PADS, PADY
def smn(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def raw_np(X,Z,hills=ALL):
    h=np.zeros_like(X)
    for cx,cz,a,sx,sz in hills: h+=a*np.exp(-((X-cx)**2/sx+(Z-cz)**2/sz))
    # continuous fade (GAME-SPEC rev 2; mirrors hub.raw): distance from the bunker apron x -4..38, z 0..34
    d=np.hypot(np.maximum(np.maximum(-4-X,0),X-38),np.maximum(np.maximum(-Z,0),Z-34))
    return np.where(d<=0,0,h*smn(0,14,d))
def gy_np(X,Z):
    h=raw_np(X,Z)
    for k,(cx,cz,r,b) in PADS.items():
        d=np.hypot(X-cx,Z-cz);w=1-smn(r,r+b,d);h=h*(1-w)+PADY[k]*w
    return h
