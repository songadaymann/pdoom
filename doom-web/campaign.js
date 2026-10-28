// Opening checkpoints precede the committed camp. Failed attempts cannot erase camp.
export const CAMPAIGN_KEY='pdoom.campaign.v1';
export const OPENING_COMPLETE_KEY='pdoom.opening-complete.v1';
const openingPoints=['xp-intro','level-one'];
const mask=n=>Number.isInteger(n)&&n>=0&&n<=31?n:0;
// The pod farm's NDA ending (level 4, Daniel Kokotajlo): 0 none yet, 1 race, 2 slowdown. It lasts for the
// rest of the level, so a later visit restores it (CVar pdoom_ending3, Agentic.zs ApplyHubEntry).
const ending=n=>n===1||n===2?n:0;
// The endgame (docs/ENDGAME.md): 0 not yet, 1 the guide has met you at the door (all 20 resolved), 2 the
// MCP is down and you're back in the meadow. Written here and, at the end, by the endgame page.
export const ENDGAME_GATE=1,ENDGAME_DONE=2;
const endgame=n=>n===ENDGAME_GATE||n===ENDGAME_DONE?n:0;
// One five-person group per structure; ids 10-14 are the factory's, 15-19 AGENTIC SMITH's pod farm (camp spots, meadow art).
const MASKS=['saved0','saved1','saved2','saved3','lost0','lost1','lost2','lost3','following0','following1','following2','following3'];
const LEVEL_IDS=['five-prisons','hal-station','meg3n-factory','agentic-pods'];
const ROSTER=[['Liron Shapira','Stuart Russell','Eliezer Yudkowsky','Geoffrey Hinton','Holly Elmore'],['Rob Miles','Dan Hendrycks','Nate Soares','Roman Yampolskiy','Beth Barnes'],['Zvi Mowshowitz','Victoria Krakovna','Max Tegmark','Paul Christiano','Ajeya Cotra'],['Jaan Tallinn','Nick Bostrom','Daniel Kokotajlo','Katja Grace','Yoshua Bengio']];
export function campaignResumePoint(value){return value?.hub?'hub':openingPoints.includes(value?.checkpoint)?value.checkpoint:null;}
export function readCampaign(storage){try{const value=JSON.parse(storage?.getItem(CAMPAIGN_KEY)||'null');return value?.version===1&&['altman','amodei'].includes(value.ceo)&&campaignResumePoint(value)?value:null;}catch{return null;}}
export function canSkipOpening(storage){try{if(storage?.getItem(OPENING_COMPLETE_KEY)==='1')return true;}catch{}const point=campaignResumePoint(readCampaign(storage));return point==='level-one'||point==='hub';}
export class Campaign{
 constructor(storage,ceo){this.storage=storage;this.ceo=ceo;this.data={version:1,ceo,hub:false,...Object.fromEntries(MASKS.map(key=>[key,0])),ending3:0,endgame:0};this.error=null;
  try{const value=JSON.parse(storage?.getItem(CAMPAIGN_KEY)||'null');if(value?.version===1&&value.ceo===ceo){this.data={...this.data,hub:!!value.hub};if(openingPoints.includes(value.checkpoint))this.data.checkpoint=value.checkpoint;for(const key of MASKS)this.data[key]=mask(value[key]);this.data.ending3=ending(value.ending3);this.data.endgame=endgame(value.endgame);this.data.ceoPdoom=Number.isInteger(value.ceoPdoom)?value.ceoPdoom:null;}}catch{}
 }
 saveOpening(point){
  if(!openingPoints.includes(point)||this.data.hub||MASKS.some(key=>this.data[key])||this.data.checkpoint==='level-one'&&point==='xp-intro')return false;
  this.data.checkpoint=point;const saved=this.persist();
  if(point==='level-one')try{this.storage?.setItem(OPENING_COMPLETE_KEY,'1');}catch{}
  return saved;
 }
 // Levels 1-2 report both of their groups (PDOOM_CAMPAIGN); the factory and the pod farm report only
 // their own, so only the groups a report names are written (a group-3-only report used to wipe 0-1).
 commit(native){const groups=[0,1,2,3].filter(i=>'saved'+i in native);for(const i of groups){this.data['saved'+i]|=mask(native['saved'+i]);this.data['lost'+i]=mask(native['lost'+i])&~this.data['saved'+i];this.data['following'+i]=mask(native['following'+i])&~(this.data['saved'+i]|this.data['lost'+i]);}if(ending(native.ending3))this.data.ending3=native.ending3;this.data.hub=true;delete this.data.checkpoint;this.persist();}
 // MEG3N's factory (2026-10-19): its clear is written only to a save that already reached SAFE MODE,
 // so a first visit by link never skips a new player's opening; this tab's meadow counts it either way.
 // The pod farm (level 4, group 3) follows the same rule through commitGroup(3,saved).
 commitGroup(i,saved,end=0){const s='saved'+i;if(i===3&&ending(end))this.data.ending3=end;this.data[s]|=mask(saved);this.data['lost'+i]&=~this.data[s];this.data['following'+i]&=~this.data[s];return this.data.hub&&this.persist();}
 commitFactory(saved){return this.commitGroup(2,saved);}
 // never backwards: the door scene can't undo a finished endgame
 setEndgame(step){if(endgame(step)>this.data.endgame){this.data.endgame=step;return this.persist();}return false;}
 persist(){try{if(!this.storage)throw Error('No storage');this.storage.setItem(CAMPAIGN_KEY,JSON.stringify(this.data));this.error=null;return true;}catch{this.error='Progress stays in this tab: browser storage unavailable.';return false;}}
 bootArgs({opening=this.data.checkpoint}={}){return MASKS.flatMap(key=>['+set','pdoom_'+key.replace('following','follow'),String(this.data[key])]).concat(['+set','pdoom_ending3',String(ending(this.data.ending3)),'+set','pdoom_hub_entry',this.data.hub?'1':'0','+set','pdoom_opening_checkpoint',this.data.hub?'0':opening==='xp-intro'?'1':opening==='level-one'?'2':'0']);}
 roster(){return ROSTER.flatMap((group,i)=>group.map((name,site)=>({id:i*5+site,name,levelId:LEVEL_IDS[i],state:this.data['saved'+i]&(1<<site)?'camp':this.data['lost'+i]&(1<<site)?'lost':this.data['following'+i]&(1<<site)?'following':'imprisoned'})));}
 getState(){const roster=this.roster(),saved=roster.filter(p=>p.state==='camp').length,lost=roster.filter(p=>p.state==='lost').length;return {...this.data,saved,lost,worldPdoom:99-4*saved,roster,error:this.error};}
}
