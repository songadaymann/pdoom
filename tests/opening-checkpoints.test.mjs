import test from 'node:test';
import assert from 'node:assert/strict';
import {Campaign,CAMPAIGN_KEY,OPENING_COMPLETE_KEY,readCampaign,campaignResumePoint,canSkipOpening} from '../doom-web/campaign.js';
function memory(){const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('first XP arrival is loadable with the selected hero but does not unlock skipping',()=>{
 for(const hero of ['altman','amodei']){const storage=memory(),campaign=new Campaign(storage,hero);
  assert.equal(readCampaign(storage),null);assert.equal(canSkipOpening(storage),false);
  assert.equal(campaign.saveOpening('xp-intro'),true);const saved=readCampaign(storage);
  assert.equal(saved.ceo,hero);assert.equal(campaignResumePoint(saved),'xp-intro');assert.equal(canSkipOpening(storage),false);
  const loaded=new Campaign(storage,hero);assert.equal(loaded.getState().saved,0);assert.equal(loaded.getState().hub,false);
  assert.match(loaded.bootArgs().join(' '),/pdoom_hub_entry 0 \+set pdoom_opening_checkpoint 1/);
 }
});
test('entering Level 1 advances the checkpoint and permanently unlocks skipping',()=>{
 const storage=memory(),campaign=new Campaign(storage,'amodei');campaign.saveOpening('xp-intro');
 assert.equal(campaign.saveOpening('level-one'),true);assert.equal(campaignResumePoint(readCampaign(storage)),'level-one');
 assert.equal(campaign.saveOpening('xp-intro'),false);assert.equal(storage.getItem(OPENING_COMPLETE_KEY),'1');
 assert.match(new Campaign(storage,'amodei').bootArgs().join(' '),/pdoom_hub_entry 0 \+set pdoom_opening_checkpoint 2/);
 storage.removeItem(CAMPAIGN_KEY);assert.equal(canSkipOpening(storage),true);
});
test('legacy camp saves keep priority and cannot be overwritten by an opening checkpoint',()=>{
 const storage=memory();storage.setItem(CAMPAIGN_KEY,JSON.stringify({version:1,ceo:'altman',hub:true,saved0:3,saved1:1,lost1:2}));
 const original=storage.getItem(CAMPAIGN_KEY),campaign=new Campaign(storage,'altman');
 assert.equal(campaignResumePoint(readCampaign(storage)),'hub');assert.equal(canSkipOpening(storage),true);
 assert.equal(campaign.saveOpening('level-one'),false);assert.equal(storage.getItem(CAMPAIGN_KEY),original);
 assert.equal(campaign.getState().saved,3);assert.match(campaign.bootArgs().join(' '),/pdoom_hub_entry 1 \+set pdoom_opening_checkpoint 0/);
});
test('committing the first exit replaces the opening checkpoint with the camp save',()=>{
 const storage=memory(),campaign=new Campaign(storage,'altman');campaign.saveOpening('level-one');campaign.commit({saved0:1,lost0:2});
 assert.equal(campaignResumePoint(readCampaign(storage)),'hub');assert.equal(readCampaign(storage).checkpoint,undefined);
 assert.equal(campaign.getState().saved,1);assert.equal(campaign.getState().lost,1);assert.equal(campaign.saveOpening('xp-intro'),false);
});
test('invalid saves and unavailable storage never report a successful checkpoint',()=>{
 const storage=memory();for(const value of ['{',JSON.stringify({version:1,ceo:'altman',checkpoint:'unknown'}),JSON.stringify({version:2,ceo:'altman',checkpoint:'xp-intro'}),JSON.stringify({version:1,ceo:'other',checkpoint:'level-one'})]){storage.setItem(CAMPAIGN_KEY,value);assert.equal(readCampaign(storage),null);assert.equal(canSkipOpening(storage),false);}
 for(const failed of [null,{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}]){const c=new Campaign(failed,'altman');assert.equal(c.saveOpening('xp-intro'),false);assert.match(c.error,/storage unavailable/);}
});
