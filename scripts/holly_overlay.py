"""Holly's powered bridge control: restore the feed, then raise the bridge."""
import math

LANDMARKS = dict(holly_power=[-1088,1543.5], holly_control=[-976,1951.5])


def add_holly(model, sector, polygon, cut_wall, actor):
    # The original switch supplies power now; it no longer raises the bridge.
    model['lines'][592]['special'] = 0
    model['sides'][model['lines'][592]['sidefront']]['texturemiddle'] = 'COMPTALL'
    actor(-1088,1543.5,15150,4,12,270)
    actor(-976,1951.5,15151,4,16,270)

    # Floor-hugging conduit passes through the real doorway and up the stairs.
    # It updates with the bridge floor, rather than hovering after it rises.
    points=[(-1088,1542),(-1088,1532),(-1008,1532),(-1008,1584),
        (-1136,1664),(-1136,1888),(-976,1888),(-976,1950)]
    for a,b in zip(points,points[1:]):
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
        count=math.ceil(length/14);angle=math.degrees(math.atan2(dy,dx))%360
        for i in range(count):
            f=(i+.5)/count
            wire=actor(a[0]+dx*f,a[1]+dy*f,15154,4,1,round(angle)%360)
            wire['arg4']=round((angle-round(angle))*10000)
