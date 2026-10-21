// Opening checkpoints precede the committed camp. Failed attempts cannot erase camp.
export const CAMPAIGN_KEY='pdoom.campaign.v1';
export const OPENING_COMPLETE_KEY='pdoom.opening-complete.v1';
const openingPoints=['xp-intro','level-one'];
const mask=n=>Number.isInteger(n)&&n>=0&&n<=31?n:0;
// One five-person group per structure; ids 10-14 are the factory's (camp spots, meadow art).
const MASKS=['saved0','saved1','saved2','lost0','lost1','lost2','following0','following1','following2'];
const LEVEL_IDS=['five-prisons','hal-station','meg3n-factory'];
const ROSTER=[['Liron Shapira','Stuart Russell','Eliezer Yudkowsky','Geoffrey Hinton','Holly Elmore'],['Rob Miles','Dan Hendrycks','Nate Soares','Roman Yampolskiy','Beth Barnes'],['Zvi Mowshowitz','Victoria Krakovna','Max Tegmark','Paul Christiano','Ajeya Cotra']];
export function campaignResumePoint(value){return value?.hub?'hub':openingPoints.includes(value?.checkpoint)?value.checkpoint:null;}
export function readCampaign(storage){try{const value=JSON.parse(storage?.getItem(CAMPAIGN_KEY)||'null');return value?.version===1&&['altman','amodei'].includes(value.ceo)&&campaignResumePoint(value)?value:null;}catch{return null;}}
export function canSkipOpening(storage){try{if(storage?.getItem(OPENING_COMPLETE_KEY)==='1')return true;}catch{}const point=campaignResumePoint(readCampaign(storage));return point==='level-one'||point==='hub';}
export class Campaign{
 constructor(storage,ceo){this.storage=storage;this.ceo=ceo;this.data={version:1,ceo,hub:false,...Object.fromEntries(MASKS.map(key=>[key,0]))};this.error=null;
  try{const value=JSON.parse(storage?.getItem(CAMPAIGN_KEY)||'null');if(value?.version===1&&value.ceo===ceo){this.data={...this.data,hub:!!value.hub};if(openingPoints.includes(value.checkpoint))this.data.checkpoint=value.checkpoint;for(const key of MASKS)this.data[key]=mask(value[key]);this.data.ceoPdoom=Number.isInteger(value.ceoPdoom)?value.ceoPdoom:null;}}catch{}
 }
 saveOpening(point){
  if(!openingPoints.includes(point)||this.data.hub||MASKS.some(key=>this.data[key])||this.data.checkpoint==='level-one'&&point==='xp-intro')return false;
  this.data.checkpoint=point;const saved=this.persist();
  if(point==='level-one')try{this.storage?.setItem(OPENING_COMPLETE_KEY,'1');}catch{}
  return saved;
 }
 // Levels 1-2 report both of their groups (PDOOM_CAMPAIGN); the factory reports only its own.
 commit(native){const groups='saved2' in native?[0,1,2].filter(i=>'saved'+i in native):[0,1];for(const i of groups){this.data['saved'+i]|=mask(native['saved'+i]);this.data['lost'+i]=mask(native['lost'+i])&~this.data['saved'+i];this.data['following'+i]=mask(native['following'+i])&~(this.data['saved'+i]|this.data['lost'+i]);}this.data.hub=true;delete this.data.checkpoint;this.persist();}
 // MEG3N's factory (2026-10-19): its clear is written only to a save that already reached SAFE MODE,
 // so a first visit by link never skips a new player's opening; this tab's meadow counts it either way.
 commitFactory(saved){this.data.saved2|=mask(saved);this.data.lost2&=~this.data.saved2;this.data.following2&=~this.data.saved2;return this.data.hub&&this.persist();}
 persist(){try{if(!this.storage)throw Error('No storage');this.storage.setItem(CAMPAIGN_KEY,JSON.stringify(this.data));this.error=null;return true;}catch{this.error='Progress stays in this tab: browser storage unavailable.';return false;}}
 bootArgs({opening=this.data.checkpoint}={}){return MASKS.flatMap(key=>['+set','pdoom_'+key.replace('following','follow'),String(this.data[key])]).concat(['+set','pdoom_hub_entry',this.data.hub?'1':'0','+set','pdoom_opening_checkpoint',this.data.hub?'0':opening==='xp-intro'?'1':opening==='level-one'?'2':'0']);}
 roster(){return ROSTER.flatMap((group,i)=>group.map((name,site)=>({id:i*5+site,name,levelId:LEVEL_IDS[i],state:this.data['saved'+i]&(1<<site)?'camp':this.data['lost'+i]&(1<<site)?'lost':this.data['following'+i]&(1<<site)?'following':'imprisoned'})));}
 getState(){const roster=this.roster(),saved=roster.filter(p=>p.state==='camp').length,lost=roster.filter(p=>p.state==='lost').length;return {...this.data,saved,lost,worldPdoom:99-4*saved,roster,error:this.error};}
}
