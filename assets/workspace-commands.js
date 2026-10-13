import {editScene,editElement,refreshDocument} from './document-model.js';
import {calendarDate,findCalendar,validDate} from './production-data.js';
import {dayBreakKey,moveBoardItems} from './scheduling.js';
const uid=kind=>`studio-${kind}:${crypto.randomUUID()}`;
export function insertionPoint(project,boardName,key){
  const board=project.boards.find(b=>b.name===boardName);if(!board)throw Error('Piano non trovato');
  const family=project.boards.filter(b=>b===board||b.parentBoardId===board.parentBoardId);
  for(const b of family)for(const container of ['scheduledGroups','unscheduledGroups'])for(const [groupIndex,g] of b[container].entries()){
    const stripIndex=g.strips.findIndex(s=>s.sourceKey===key);
    if(stripIndex>=0)return {boardName:b.name,container,groupIndex,stripIndex:stripIndex+1};
    if(dayBreakKey(b.name,g)===key){const next=b[container][groupIndex+1];return {boardName:b.name,container,groupIndex:next?groupIndex+1:groupIndex,stripIndex:next?0:g.strips.length}}
  }
  let groupIndex=board.scheduledGroups.findIndex(g=>g.kind==='RemainingScheduledStrips');
  if(groupIndex<0){board.scheduledGroups.push({id:uid('group'),kind:'RemainingScheduledStrips',strips:[],attributes:{},calendarId:board.calendarId,mmsxSegment:board.mmsxSegment});groupIndex=board.scheduledGroups.length-1}
  return {boardName:board.name,container:'scheduledGroups',groupIndex,stripIndex:board.scheduledGroups[groupIndex].strips.length};
}
export function insertScene(project,{boardName,key}){
  const to=insertionPoint(project,boardName,key),board=project.boards.find(b=>b.name===to.boardName);
  let number=1;const names=new Set(project.scenes.map(s=>s.scene));while(names.has(String(number)))number++;
  const scene=editScene(project,null,{scene:String(number),pagesEighths:0,ie:'INT',dn:'Day'});
  const strip=board.unscheduledGroups.flatMap(g=>g.strips).find(s=>s.bdsId===scene.bdsId);
  moveBoardItems(project,{boardName:board.name,sourceKeys:[strip.sourceKey],to});return {scene,strip,board};
}
export function insertBanner(project,{boardName,key}){
  const to=insertionPoint(project,boardName,key),board=project.boards.find(b=>b.name===to.boardName),group=board[to.container][to.groupIndex];
  const strip={kind:'banner',sourceKey:uid('banner'),text:'Nuovo banner',estimateTimeA:'00:00',style:{fontSize:12,fontSizeEdited:true}};
  group.strips.splice(to.stripIndex,0,strip);return {strip,board};
}
const nextDate=date=>new Date(Date.parse(`${date}T00:00:00Z`)+86400000).toISOString().slice(0,10);
export function reschedulePlan(project,board,{anchor=null}={}){
  const c=findCalendar(project,board.calendarId);if(!c)throw Error('Seleziona un calendario per il piano');
  const groups=board.scheduledGroups.filter(g=>g.kind==='ScheduleDay');if(!groups.length)return;
  let date=anchor||c.scheduleDates.ProductionStartDate?.iso||groups.find(g=>validDate(g.date))?.date;
  const missingStart=!validDate(date);
  if(missingStart){const today=new Date();date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-')}
  const dates=[];
  for(let i=0;i<groups.length;i++){
    if(i)date=nextDate(date);
    let found=false;for(let n=0;n<36600;n++){
      const status=calendarDate(c,date);if(status?.working==null)throw Error(`Regola del calendario non definita per ${date}`);
      if(status.working){found=true;break}date=nextDate(date);
    }
    if(!found)throw Error('Il calendario non contiene giorni lavorativi');dates.push(date);
  }
  if(missingStart)c.scheduleDates.ProductionStartDate={iso:dates[0],origin:'edited'};
  const firstNumber=groups.find(g=>Number.isSafeInteger(g.shootingDayNumber)&&g.shootingDayNumber>0)?.shootingDayNumber||1;
  groups.forEach((g,index)=>Object.assign(g,{date:dates[index],dateLocked:true,dateOrigin:'rescheduled',calendarId:c.id,ordinal:firstNumber+index,shootingDayNumber:firstNumber+index}));
  board.dateAudit={...board.dateAudit,firstDate:dates[0],lastDate:dates.at(-1)};
}
export function insertEndOfDay(project,{boardName,key}){
  const to=insertionPoint(project,boardName,key);if(to.container!=='scheduledGroups')throw Error('Il Boneyard non ha giornate: seleziona una strip del piano');
  const board=project.boards.find(b=>b.name===to.boardName),group=board.scheduledGroups[to.groupIndex];
  if(group.kind==='ScheduleDay'&&to.stripIndex===group.strips.length)return false;
  const originalStrips=group.strips.slice(),prefix=group.strips.splice(0,to.stripIndex),id=uid('day');
  const day={id,created:true,kind:'ScheduleDay',attributes:{},strips:prefix,calendarId:board.calendarId,mmsxSegment:board.mmsxSegment};
  if(project.format==='mmsx')day.mmsxDay=JSON.stringify([board.mmsxBoard,board.mmsxSegment,id]);
  board.scheduledGroups.splice(to.groupIndex,0,day);
  try{reschedulePlan(project,board);return day}catch(error){board.scheduledGroups.splice(to.groupIndex,1);group.strips=originalStrips;throw error}
}
export function assignPlanCalendar(project,boardName,calendarId){
  const board=project.boards.find(b=>b.name===boardName),calendar=findCalendar(project,calendarId);if(!board||!calendar)throw Error('Piano o calendario non trovato');
  for(const b of project.boards.filter(b=>b===board||b.parentBoardId===board.parentBoardId)){
    b.calendarId=calendar.id;b.calendarName=calendar.name;for(const g of b.scheduledGroups)g.calendarId=calendar.id;reschedulePlan(project,b);
  }
}
export function bulkElementIds(project,ids,{start=1,prefix=''}={}){
  if(!Number.isSafeInteger(start)||start<0)throw Error('ID iniziale non valido');
  const selected=ids.map(id=>project.elements.find(e=>e.id===id));if(!selected.length||new Set(ids).size!==ids.length||selected.some(e=>!e))throw Error('Seleziona gli elementi');
  const proposed=selected.map((e,index)=>`${prefix}${start+index}`),chosen=new Set(ids);
  if(!Number.isSafeInteger(start+ids.length-1))throw Error('ID troppo grande');
  for(const [i,e] of selected.entries())if(project.elements.some(other=>!chosen.has(other.id)&&other.category===e.category&&String(other.boardId??'')===proposed[i]))throw Error(`ID ${proposed[i]} già presente in ${e.category}`);
  selected.forEach((e,index)=>{e.boardId=proposed[index]});refreshDocument(project);
}
export function moveElementsToCategory(project,ids,category){
  if(!project.categorySettings.some(c=>c.name===category))throw Error('Categoria non trovata');
  const selected=ids.map(id=>project.elements.find(e=>e.id===id));if(!selected.length||selected.some(e=>!e))throw Error('Seleziona gli elementi');
  const names=new Set();for(const el of selected){if(names.has(el.name)||project.elements.some(e=>!ids.includes(e.id)&&e.category===category&&e.name===el.name))throw Error(`Esiste già un elemento ${el.name} in ${category}`);names.add(el.name)}
  for(const el of selected)editElement(project,el.id,{...el,category});
}
export function reorderCollection(project,kind,ids){
  if(kind==='calendar'){
    const list=project.calendars;if(ids.length!==list.length||new Set(ids).size!==list.length||ids.some(id=>!list.some(c=>c.id===id)))throw Error('Ordine calendari non valido');
    project.calendars=ids.map(id=>list.find(c=>c.id===id));return;
  }
  const parents=[...new Set(project.boards.map(b=>b.parentBoardId))];
  if(ids.length!==parents.length||new Set(ids).size!==parents.length||ids.some(id=>!parents.includes(id)))throw Error('Ordine piani non valido');
  project.boards=ids.flatMap(id=>project.boards.filter(b=>b.parentBoardId===id));project.boards.forEach((b,index)=>{b.sourceOrder=index;b.attributes={...b.attributes,SortOrder:String(index)}});
}
