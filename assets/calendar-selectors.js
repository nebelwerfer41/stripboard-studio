import {entriesForBoard} from './board-segments.js';
import {calendarDate,eventsOnDate,redFlagsOnDate,redFlagsForStrip,findCalendar,outsideCalendarActivity} from './production-data.js';
export function calendarPlanEntries(project,boardName,visibleIds,calendarId){
  return entriesForBoard(project,boardName,visibleIds).filter(e=>e.container==='scheduledGroups'&&e.board.calendarId===calendarId);
}
export function estimateMinutes(value){
  if(value==null||value==='')return null;
  if(/^\d+$/.test(String(value)))return Number(value);
  const match=/^(\d+):(\d{2})(?::\d{2})?$/.exec(String(value));
  return match&&Number(match[2])<60?Number(match[1])*60+Number(match[2]):null;
}
export function groupSummary(project,group){
  const map=new Map(project.scenes.map(s=>[s.bdsId,s])),scenes=group.strips.filter(s=>s.kind==='scene').map(s=>map.get(s.bdsId));
  const times=group.strips.map(s=>s.kind==='scene'?estimateMinutes(map.get(s.bdsId)?.estimateTimeA):estimateMinutes(s.estimateTimeA));
  return {sceneCount:scenes.length,pagesEighths:scenes.some(s=>s?.pagesEighths==null)?null:scenes.reduce((n,s)=>n+s.pagesEighths,0),
    minutes:times.some(t=>t!=null)?times.reduce((n,t)=>n+(t??0),0):null,timePartial:times.some(t=>t==null)};
}
export function calendarDayContent(project,calendarId,date,entries){
  const calendar=findCalendar(project,calendarId),status=calendarDate(calendar,date),days=entries.filter(e=>e.group.kind==='ScheduleDay'&&e.group.date===date);
  const events=eventsOnDate(project,calendarId,date),flags=redFlagsOnDate(project,date),conflicts=[];
  for(const entry of days){
    if(status?.working!==true)conflicts.push({kind:'nonworking',message:`G ${entry.group.shootingDayNumber}: ${status?.working===false?'riprese in giorno non lavorativo':'regola non risolta'}`,groupId:entry.group.id});
    if(outsideCalendarActivity(calendar,date))conflicts.push({kind:'activity',message:`G ${entry.group.shootingDayNumber}: fuori attività`,groupId:entry.group.id});
    for(const strip of entry.group.strips.filter(s=>s.kind==='scene'))for(const flag of redFlagsForStrip(project,strip.bdsId,date).filter(f=>f.type==='unavailable'))
      conflicts.push({kind:'redflag',message:`${flag.name||'Red Flag'} · scena ${project.scenes.find(s=>s.bdsId===strip.bdsId)?.scene||'—'}`,stripId:strip.sourceKey,flagId:flag.id});
  }
  return {status,days:days.map(e=>({...e,summary:groupSummary(project,e.group)})),events,flags,conflicts};
}
export function activeSceneContext(project,boardName,sceneId,stripId){
  const scene=project.scenes.find(s=>s.id===sceneId)||null;
  const entries=entriesForBoard(project,boardName),occurrence=entries.find(e=>e.group.strips.some(s=>s.kind==='scene'&&s.sourceKey===stripId&&s.bdsId===scene?.bdsId));
  return {scene,occurrence:occurrence||null};
}
export function breakdownCategories(project,scene,{hideEmpty=false}={}){
  const categories=(project.categorySettings||[]).map((c,i)=>({...c,id:c.id??`category:${JSON.stringify([c.name,i])}`,items:[]}));
  const elements=new Map(project.elements.map(e=>[e.id,e]));
  for(const ref of scene?.elementRefs||[]){
    const element=elements.get(ref.elementId);
    let category=categories.find(c=>ref.categoryId?c.id===ref.categoryId:c.name===ref.category);
    if(!category){category={id:ref.categoryId??`unknown:${JSON.stringify(ref.category)}`,name:ref.category||'Categoria non risolta',unknown:true,items:[]};categories.push(category)}
    category.items.push({...ref,element,properties:element?.properties||{}});
  }
  return hideEmpty?categories.filter(c=>c.items.length):categories;
}
export const canSplit=width=>width>1200;
