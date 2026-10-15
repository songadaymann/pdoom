// Launcher "How to play" panel: keycaps plus plain words, so the controls can
// actually be read. Doom lettering stays for the heading only. It is a
// disclosure: open on roomy desktop screens, a single tappable line on phones.
const DESKTOP=[
  [['W','A','S','D'],'Walk · doors open as you reach them'],
  [['Mouse'],'Look'],                  [['Click'],'Swing wrench · hold + release slingshot'],
  [['Space'],'Use switches and levers'],[['T'],'Switch wrench / slingshot'],
  [['Shift'],'Run'],                   [['Esc'],'Menu  ·  F fullscreen'],
];
const TOUCH=[
  [['Arrows'],'Walk · doors open as you reach them'],
  [['Drag'],'Look'],                   [['Swing'],'Wrench, or hold + release the slingshot'],
  [['Use'],'Switches and levers'],     [['Tool'],'Switch wrench / slingshot'],
  [['Run'],'Hold to run'],             [['Menu'],'Pause'],
];
const METER='P(DOOM) = the chance nobody survives. Rescues push it down.';

function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;}

export function renderHowToPlay(container,{touch=matchMedia('(pointer:coarse)').matches,open}={}){
  const panel=el('details','how-to-play');
  panel.open=open??(!touch&&innerHeight>=640);
  const summary=el('summary','htp-heading','How to play');
  const list=el('dl','htp-list');
  for(const [keys,action] of touch?TOUCH:DESKTOP){
    const row=el('div','htp-row');
    const term=el('dt','htp-keys');
    keys.forEach(key=>term.append(el('kbd','htp-key',key)));
    row.append(term,el('dd','htp-action',action));list.append(row);
  }
  panel.append(summary,list,el('p','htp-meter',METER));
  container.replaceChildren(panel);
  return panel;
}
