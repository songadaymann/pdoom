"""Inline floor plan from current generated UDMF, never a hand-drawn layout."""
from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parents[1]
text=(root/'output/hal/E1M7-TEXTMAP.txt').read_text();model={}
for kind,key in [('vertex','vertices'),('linedef','lines'),('sidedef','sides')]:
    model[key]=[{k:json.loads(v) for k,v in re.findall(r'(\w+)\s*=\s*(.*?);',block)} for block in re.findall(kind+r'\s*\{(.*?)\}',text,re.S)]
fixture=json.loads((root/'output/hal/map-debug.json').read_text())
def segment(line):
    return [value for key in ['v1','v2'] for value in [model['vertices'][line[key]]['x'],model['vertices'][line[key]]['y']]]
def edges(sector):
    return [segment(line) for line in model['lines'] if any(model['sides'][line[key]]['sector']==sector for key in ['sidefront','sideback'] if line[key]>=0)]
def mount(kind):return next([p['x'],p['y']] for p in fixture['wall_mounts'] if p['type']==15122 and p['kind']==kind)
power_sector=next(p['sector'] for p in fixture['wall_mounts'] if p['type']==15122 and p['kind']==32)
power_edges=edges(power_sector)
power_x=[e[i] for e in power_edges for i in (0,2)]
power_y=[e[i] for e in power_edges for i in (1,3)]
data=dict(lines=[segment(l) for l in model['lines']],walls=[segment(l) for l in model['lines'] if l['sideback']<0 or l.get('blocking')],powerEdges=power_edges,powerBounds=[min(power_x)-32,min(power_y)-120,max(power_x)+352,max(power_y)+144],thawEdges=edges(139),switches=[mount(k) for k in range(30,35)],power=mount(32),override=mount(29),valves=[mount(40),mount(41)],spawn=fixture['spawn'],refuge=fixture['refuge'],nate=fixture['sites'][2]['prisoner'])
data['bounds']=[min(v['x'] for v in model['vertices'])-40,min(v['y'] for v in model['vertices'])-40,max(v['x'] for v in model['vertices'])+40,max(v['y'] for v in model['vertices'])+40]
destination=Path(sys.argv[1]);destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(Path(__file__).with_name('hal-thaw-map.html').read_text().replace('__MAP_DATA__',json.dumps(data,separators=(',',':'))))
print(destination)
