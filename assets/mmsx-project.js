import {decodeMmsx,encodeMmsx,cloneExact} from './mmsx-codec.js';
import {resolveColor} from './mmsx-palette.js';
const sorted=map=>Object.entries(map||{}).sort((a,b)=>Number(a[1].sortOrder||0)-Number(b[1].sortOrder||0)||a[0].localeCompare(b[0]));
const iso=s=>/^\d{8}$/.test(s||'')?`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}`:null;
const compactDate=s=>s?.replaceAll('-','');
const signature=g=>JSON.stringify(g.map(x=>[x.mmsxSegment,x.mmsxDay,x.date,x.shootingDayNumber,x.strips.map(s=>s.sourceKey)]));
function field(text,x,width){return {tag:'StaticText',a:{Text:text,WrapText:'1',BoundingRect:`${x},0,${width},0.48`},font:{Size:'10'},categories:[]}}
const layout={name:'MMSX · vista compatta',orientation:'HORIZONTAL',length:12,width:.48,attributes:{},header:[],fields:[field('{scene}',0,.75),field('{ie} / {dn}',.75,1),field('{set}',1.75,2.2),field('{synopsis}',3.95,5.7),field('{pages}',9.65,.65),field('{location}',10.3,1.7)],dayBreakText:'Fine giornata {day} · {date} · {pages} pag.',bannerStyle:{},dayBreakStyle:{}};
export async function parseMmsx(bytes,fileName='imported.mmsx'){
 const root=await decodeMmsx(bytes),c=root?.contents;
 if(root.type!=='schedule'||root.dataFormat!==5||!c?.breakdown||!c.element||!c.stripboard)throw Error('MMSX: supportati i piani con dataFormat 5');
 const name=id=>c.element[id]?.name||'',scenes=[],seen=new Set();
 for(const [,b] of sorted(c.breakdown))for(const [id,s] of sorted(b.sheetMap)){
  if(seen.has(id))throw Error('Identificativo scena MMSX duplicato');seen.add(id);
  const requirements=Object.create(null);for(const eid of Object.keys(s.elements||{})){const e=c.element[eid];if(e)(requirements[c.category[e.category_id]?.name||'Elementi']??=[]).push(e.name)}
  const rule=Object.values(c.rules||{}).find(r=>r.intExt===s.intExt&&r.dayNight===s.dayNight);
  scenes.push({bdsId:id,scene:s.scenes||'',synopsis:s.synopsis||'',set:name(s.set),location:name(s.location),ie:name(s.intExt),dn:name(s.dayNight),scriptDay:name(s.scriptDay),unit:name(s.unit),sequence:name(s.sequence),comments:s.comments||'',pagesEighths:Number(s.eigths)||0,requirements,mmsxColors:{bg:resolveColor(s.backgroundColor)||resolveColor(rule?.backgroundColor)||'#FFFFFF',fg:resolveColor(s.color)||resolveColor(rule?.color)||'#333333'}});
 }
 const boards=[],recordMaps=new Map(),initialSegments=new Map();
 for(const [bid,b] of sorted(c.stripboard)){
  const records=new Map();recordMaps.set(bid,records);
  const convert=(sid,id,r)=>{const key=JSON.stringify([bid,sid,id]);if(!['breakdown','banner','day'].includes(r.type))throw Error(`Tipo strip MMSX non supportato: ${r.type}`);if(r.type==='breakdown'&&!seen.has(r.sheet))throw Error('MMSX contiene una strip senza scheda');records.set(key,{id,sid,record:r});return {kind:r.type==='breakdown'?'scene':'banner',sourceKey:key,bdsId:r.sheet,text:r.type==='day'?'Fine giornata (Boneyard)':r.text||'',mmsxLocked:r.type==='day',style:{backgroundColor:resolveColor(r.backgroundColor)||resolveColor(r.color)||'#663301',fontColor:'#FFFFFF'}}};
  const yards=sorted(b.segmentMap).filter(([,s])=>s.type==='boneyard');
  const unscheduledGroups=yards.map(([sid,s],index)=>({kind:'RemainingUnscheduledStrips',sourceIndex:index,mmsxSegment:sid,attributes:{},date:null,strips:sorted(s.stripMap).map(([id,r])=>convert(sid,id,r))}));
  for(const group of unscheduledGroups)initialSegments.set(JSON.stringify([bid,group.mmsxSegment]),signature([group]));
  const normals=sorted(b.segmentMap).filter(([,s])=>s.type==='normal');
  if(!normals.length)throw Error('MMSX senza sub-board normale');
  for(const [sid,s] of normals){
   const scheduledGroups=[];let pending=[];
   for(const [id,r] of sorted(s.stripMap)){
    const strip=convert(sid,id,r);
    if(r.type==='day'){scheduledGroups.push({kind:'ScheduleDay',sourceIndex:scheduledGroups.length,mmsxSegment:sid,mmsxDay:strip.sourceKey,ordinal:Number(r.shootDay)||scheduledGroups.length+1,shootingDayNumber:Number(r.shootDay)||scheduledGroups.length+1,date:iso(r.date),attributes:{},strips:pending});pending=[]}
    else pending.push(strip);
   }
   scheduledGroups.push({kind:'RemainingScheduledStrips',sourceIndex:scheduledGroups.length,mmsxSegment:sid,attributes:{},date:null,strips:pending});
   let boardName=normals.length===1?b.name:`${b.name} / ${s.name}`;if(boards.some(x=>x.name===boardName))boardName+=` [${sid}]`;
   initialSegments.set(JSON.stringify([bid,sid]),signature(scheduledGroups));
   const dates=scheduledGroups.map(g=>g.date).filter(Boolean);
   boards.push({name:boardName,sourceBoardName:boardName,mmsxBoard:bid,mmsxSegment:sid,attributes:{Name:boardName,SortOrder:String(boards.length)},description:b.description||boardName,calendarName:'Date originali MMSX',scheduledGroups,unscheduledGroups,dateAudit:{firstDate:dates[0]||null,lastDate:dates.at(-1)||null,confidence:'stored'}});
  }
 }
 if(!boards.length)throw Error('Nessun piano MMSX disponibile');
 const elements=sorted(c.element).map(([,e])=>({category:c.category[e.category_id]?.name||'Elementi',name:e.name,boardId:e.boardId,sortOrder:e.sortOrder,properties:{}}));
 return {format:'mmsx',fileName,title:root.productionInfo?.title||root.name||fileName,production:{},scenes,elements,categorySettings:sorted(c.category).map(([,v])=>({name:v.name,attributes:{SortOrder:String(v.sortOrder)}})),boards,activeBoard:boards[0].name,defaultCalendar:null,calendars:[],redFlags:[],redFlagNames:[],stripLayouts:[layout],reportLayouts:[],colors:{preferences:{Banner:{bg:'#663301',fg:'#FFFFFF'},DayStrip:{bg:'#333333',fg:'#FFFFFF'}}},counts:{scenes:scenes.length,elements:elements.length,stripboards:boards.length,scheduleDays:boards.reduce((n,b)=>n+b.scheduledGroups.filter(g=>g.kind==='ScheduleDay').length,0),unscheduledDays:0},mmsxSource:{root,recordMaps,initialSegments,boardCount:boards.length}};
}
export function updatedMmsxRoot(project){
 const source=project.mmsxSource;if(!source||project.boards.length!==source.boardCount)throw Error('Creazione di piani MMSX non disponibile');
 const root=cloneExact(source.root),done=new Set(),sceneMap=new Map(project.scenes.map(s=>[s.bdsId,s]));
 for(const board of project.boards){
  const records=source.recordMaps.get(board.mmsxBoard);if(!records)throw Error('Piano MMSX sconosciuto');
  const batches=[{sid:board.mmsxSegment,groups:board.scheduledGroups,yard:false},...board.unscheduledGroups.map(g=>({sid:g.mmsxSegment,groups:[g],yard:true}))];
  for(const {sid,groups,yard} of batches){
   const key=JSON.stringify([board.mmsxBoard,sid]);if(done.has(key))continue;done.add(key);
   if(signature(groups)===source.initialSegments.get(key))continue;
   const stripMap=Object.create(null);let order=0;
   function append(key,group,isDay=false){
    const origin=records.get(key);if(!origin)throw Error('Strip MMSX sconosciuta');
    if(Object.hasOwn(stripMap,origin.id))throw Error('Strip MMSX duplicata');
    if(origin.record.type==='day'&&!isDay&&(!yard||origin.sid!==sid))throw Error('I fine giornata del Boneyard devono restare nel Boneyard');
    const r=cloneExact(origin.record);r.sortOrder=order++;
    if(yard||group.kind!=='ScheduleDay'){delete r.date;delete r.shootDay;delete r.beforeShootDay}
    else{if(!group.date)throw Error('Giornata MMSX senza data: impossibile ripianificare');r.date=compactDate(group.date);r.shootDay=group.shootingDayNumber;delete r.beforeShootDay}
    if(isDay)r.eighths=group.strips.reduce((n,s)=>n+(sceneMap.get(s.bdsId)?.pagesEighths||0),0);
    stripMap[origin.id]=r;
   }
   for(const group of groups){for(const strip of group.strips)append(strip.sourceKey,group);if(group.mmsxDay)append(group.mmsxDay,group,true)}
   root.contents.stripboard[board.mmsxBoard].segmentMap[sid].stripMap=stripMap;
  }
 }
 // Compare every original strip identity across all segments: no drop or duplication.
 for(const [bid,records] of source.recordMaps){
  const expected=new Map();for(const {id} of records.values())expected.set(id,(expected.get(id)||0)+1);
  const actual=new Map();for(const s of Object.values(root.contents.stripboard[bid].segmentMap))if(['normal','boneyard'].includes(s.type))for(const id of Object.keys(s.stripMap))actual.set(id,(actual.get(id)||0)+1);
  if(actual.size!==expected.size||[...expected].some(([id,count])=>actual.get(id)!==count))throw Error('Esportazione interrotta: strip perse o duplicate');
 }
 return root;
}
export async function serializeMmsx(project,fileName){
 const root=updatedMmsxRoot(project);root.id=crypto.randomUUID();root.name=fileName.replace(/\.mmsx$/i,'');root.changed=false;
 for(const k of ['nonce','fileName','shared','presence','user'])delete root[k];
 return encodeMmsx(root);
}
