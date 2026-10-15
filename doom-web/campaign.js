// Only committed exits enter this save. Failed attempts cannot erase camp.
export const CAMPAIGN_KEY='pdoom.campaign.v1';
const mask=n=>Number.isInteger(n)&&n>=0&&n<=31?n:0;
export class Campaign{
 constructor(storage,ceo){this.storage=storage;this.ceo=ceo;this.data={version:1,ceo,hub:false,saved0:0,saved1:0,lost0:0,lost1:0,following0:0,following1:0};this.error=null;
  try{const value=JSON.parse(storage?.getItem(CAMPAIGN_KEY)||'null');if(value?.version===1&&value.ceo===ceo){this.data={...this.data,hub:!!value.hub};for(const key of ['saved0','saved1','lost0','lost1','following0','following1'])this.data[key]=mask(value[key]);this.data.ceoPdoom=Number.isInteger(value.ceoPdoom)?value.ceoPdoom:null;}}catch{}
 }
 commit(native){for(const i of [0,1]){this.data['saved'+i]|=mask(native['saved'+i]);this.data['lost'+i]=mask(native['lost'+i])&~this.data['saved'+i];this.data['following'+i]=mask(native['following'+i])&~(this.data['saved'+i]|this.data['lost'+i]);}this.data.hub=true;this.persist();}
 persist(){try{this.storage?.setItem(CAMPAIGN_KEY,JSON.stringify(this.data));}catch{this.error='Progress stays in this tab: browser storage unavailable.';}}
 bootArgs(){return ['saved0','saved1','lost0','lost1','following0','following1'].flatMap(key=>['+set','pdoom_'+key.replace('following','follow'),String(this.data[key])]).concat(['+set','pdoom_hub_entry',this.data.hub?'1':'0']);}
 roster(){const names=[['Liron Shapira','Stuart Russell','Eliezer Yudkowsky','Geoffrey Hinton','Holly Elmore'],['Rob Miles','Dan Hendrycks','Nate Soares','Roman Yampolskiy','Beth Barnes']];return names.flatMap((group,i)=>group.map((name,site)=>({id:i*5+site,name,levelId:i?'hal-station':'five-prisons',state:this.data['saved'+i]&(1<<site)?'camp':this.data['lost'+i]&(1<<site)?'lost':this.data['following'+i]&(1<<site)?'following':'imprisoned'})));}
 getState(){const roster=this.roster(),saved=roster.filter(p=>p.state==='camp').length,lost=roster.filter(p=>p.state==='lost').length;return {...this.data,saved,lost,worldPdoom:99-4*saved,roster,error:this.error};}
}
