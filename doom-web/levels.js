// Add a descriptor and its native map/controller to introduce another level.
// Never reuse board keys after changing a map or scoring rules.
export const GAME_SLUG='pdoom';
export const LEVELS=Object.freeze([
  // v3 (2026-10-10): one solution per prisoner, so earlier times are not comparable.
  Object.freeze({id:'five-prisons',version:'five-prisons-v3',title:'The Control Problem',subtitle:'Command Control',
    episode:1,map:4,scored:true,peopleTotal:6,camerasTotal:9,scoreVersion:'rescue-v2',boardVersion:'v3',
    nextLevelId:null}),
  // v3 (2026-10-11): one solution per prisoner and a new way out (HAL's breaker, then the original exit).
  Object.freeze({id:'hal-station',version:'hal-station-v3',title:'Confabulation Station',subtitle:'Computer Station',episode:1,map:7,scored:true,peopleTotal:6,camerasTotal:9,scoreVersion:'rescue-v2',boardVersion:'v3',nextLevelId:null}),
  // Walked into from SAFE MODE through MEG3N.AVI's door since 2026-10-20; unscored, no boards yet.
  Object.freeze({id:'meg3n-factory',version:'meg3n-factory-v1',title:"MEG3N's Toy Factory",subtitle:'Spawning Vats',
    episode:2,map:7,scored:false,nextLevelId:null}),
  Object.freeze({id:'intake',version:'intake-prototype',title:'Intake',
    episode:1,map:1,scored:false,nextLevelId:null})
]);
export function getLevel(id='five-prisons'){
  if(id==='rescue'||id==='first-rescue')id='five-prisons';
  return LEVELS.find(level=>level.id===id)||null;
}
export function boardsForLevel(level){
  if(!level?.scored)return [];
  const prefix=`${level.id}-rescue-${level.boardVersion}`;
  return [{variant:prefix,label:'Total score',metric:level.scoreVersion==='rescue-v2'?'rescueScoreV2':'rescueScoreV1',metricLabel:'Total score',direction:'desc',display:'integer',aggregation:'best'}];
}
export function nextLevel(level){return level?.nextLevelId?getLevel(level.nextLevelId):null;}

export const ARCHIVED_LEVELS=Object.freeze([Object.freeze({...LEVELS[0],version:"five-prisons-v1",title:"Five Prisons (legacy)",scoreVersion:"rescue-v1",boardVersion:"v1"}),
  Object.freeze({...LEVELS[0],version:"five-prisons-v2",title:"The Control Problem (several routes)",scoreVersion:"rescue-v2",boardVersion:"v2"}),
  Object.freeze({...LEVELS[1],version:"hal-station-v2",title:"Confabulation Station (several routes)",scoreVersion:"rescue-v2",boardVersion:"v2"})]);
