/* Pure projection: the only source of scene attendance is the current schedule. */
import {calendarDate,validDate,intervalContains} from './production-data.js';
export const DEFAULT_DOOD_RULES=Object.freeze({allowHold:true,allowDrop:false,minimumCalendarDays:7});
export const DOOD_EVENT_TYPES=Object.freeze({travel:'Travel',fitting:'Fitting',rehearsal:'Rehearsal',unavailable:'Unavailable',holiday:'Company Holiday',move:'Company Move'});
const ACTIVITY_CODES={travel:'TR',fitting:'FT',rehearsal:'R',unavailable:'U'};
const COMPANY_CODES={holiday:'/',move:'M'};
const DAY_MS=86400000;
const SCENE_FIELDS=[['set','Set'],['location','Location'],['scriptDay','Script Day'],['unit','Unit'],['sequence','Sequence'],['dn','DN'],['ie','INT/EXT']];
const FIELD_CATEGORIES=new Map([['set','set'],['location','location'],['scriptday','scriptDay'],['unit','unit'],['sequence','sequence'],['dn','dn'],['daynight','dn'],['ie','ie'],['intext','ie']]);
const categoryField=category=>FIELD_CATEGORIES.get(String(category??'').toLowerCase().replace(/[\s/]/g,''));
// MSD stores built-ins as scalar scene values, sometimes without catalog elements.
// Derived rows are a read-only DOOD projection; native catalog IDs remain authoritative.
export function doodElements(project){
  if(project.format!=='msd')return project.elements;
  const elements=project.elements.map(element=>{
    const field=categoryField(element.category);
    return field?{...element,doodField:field}:element;
  });
  const keys=new Set(elements.filter(e=>e.doodField).map(e=>JSON.stringify([e.doodField,e.name])));
  for(const [field,category] of SCENE_FIELDS)for(const scene of project.scenes){
    const name=scene[field];if(name==null||name==='')continue;
    const key=JSON.stringify([field,name]);if(keys.has(key))continue;keys.add(key);
    elements.push({id:`dood-field:${key}`,category:elements.find(e=>e.doodField===field)?.category||category,name,boardId:'',doodField:field});
  }
  return elements;
}
export const doodBoardKey=board=>board.name; // unique in both adapters and stable after reopening
export function normalizeRules(value={}){
  const rules={...DEFAULT_DOOD_RULES,...value};
  return {allowHold:rules.allowHold===true,allowDrop:rules.allowHold===true&&rules.allowDrop===true,
    minimumCalendarDays:Number.isFinite(Number(rules.minimumCalendarDays))?Math.max(1,Math.floor(Number(rules.minimumCalendarDays))):7};
}
export function effectiveDoodRules(project,board,element){
  const config=project.studio?.dood?.[doodBoardKey(board)]||{};
  const authoring=element.authoring||{},rules=Object.fromEntries(['allowHold','allowDrop','minimumCalendarDays'].filter(k=>Object.hasOwn(authoring,k)).map(k=>[k,authoring[k]]));
  return normalizeRules({...rules,...config.categories?.[element.category],...config.elements?.[element.id]});
}
export function doodEventType(event){
  const type=String(event.type??'').toLowerCase().replace(/[ _-]/g,'');
  return ({travel:'travel',fitting:'fitting',rehearsal:'rehearsal',unavailable:'unavailable',holiday:'holiday',companyholiday:'holiday',move:'move',companymove:'move'})[type]||null;
}
function inScope(event,board,calendar){
  return (!event.calendarId||event.calendarId===calendar?.id)&&
    (!event.scope?.boardId||event.scope.boardId===board.parentBoardId)&&
    (!event.scope?.segmentId||event.scope.segmentId===board.segmentId);
}
function targetsElement(event,element){
  return (event.targets||[]).some(t=>t.kind==='project'&&doodEventType(event)==='unavailable'||t.kind==='element'&&(t.elementId?t.elementId===element.id:t.category===element.category&&t.element===element.name));
}
export function doodCodes(cell){
  let work='';
  if(cell.sceneWork){
    if(cell.pickup)work=cell.finish?'PWF':'PW';
    else if(cell.release)work=cell.start?'SWD':'WD';
    else work=cell.start&&cell.finish?'SWF':cell.start?'SW':cell.finish?'WF':'W';
  }else if(cell.release)work='D';
  else if(cell.pickup)work='P';
  else if(cell.held)work='H';
  return [work,cell.pickup&&cell.release?'D':'',...cell.individualTypes.map(t=>ACTIVITY_CODES[t]),...cell.companyTypes.map(t=>COMPANY_CODES[t])].filter(Boolean);
}
// Eligible gaps are full civil dates between required activities. Events split gaps.
export function findDropIntervals(cells,rules){
  if(!rules.allowHold||!rules.allowDrop)return [];
  const anchors=cells.map((c,i)=>c.sceneWork||c.individualTypes.some(t=>t!=='unavailable')?i:-1).filter(i=>i>=0);
  const first=cells.findIndex(c=>c.start),last=cells.findIndex(c=>c.finish),intervals=[];
  for(let i=1;i<anchors.length;i++){
    const release=anchors[i-1],pickup=anchors[i];
    if(release<first||pickup>last||pickup-release-1<rules.minimumCalendarDays)continue;
    intervals.push({release,pickup,calendarDays:pickup-release-1});
  }
  return intervals;
}
export function calculateDood({project,board,calendar,elements=doodElements(project),events=project.events||[],rulesForElement=e=>effectiveDoodRules(project,board,e),startDate=null,endDate=null}){
  if(!board)throw Error('Sub-board DOOD non disponibile');
  const diagnostics=[],days=new Map(),sceneIndex=new Map(project.scenes.map(s=>[s.bdsId,s]));
  for(const group of board.scheduledGroups||[]){
    if(group.kind!=='ScheduleDay')continue;
    if(!validDate(group.date)){diagnostics.push(`Giornata ${group.shootingDayNumber??'—'} senza data: esclusa dal DOOD`);continue}
    if(!days.has(group.date))days.set(group.date,{shootingDays:[],scenes:new Map()});
    const day=days.get(group.date);day.shootingDays.push(group.shootingDayNumber);
    for(const strip of group.strips||[])if(strip.kind==='scene'){
      const scene=sceneIndex.get(strip.bdsId);
      if(!scene){diagnostics.push(`Scena non risolta: ${strip.bdsId}`);continue}
      const item=day.scenes.get(scene.id||scene.bdsId)||{scene,stripIds:[]};item.stripIds.push(strip.sourceKey);day.scenes.set(scene.id||scene.bdsId,item);
    }
  }
  const flagEvents=(project.redFlags||[]).filter(f=>Object.hasOwn(DOOD_EVENT_TYPES,f.type)).map(f=>({...f,type:f.type,targets:f.target?[f.target]:[],derivedRedFlag:true}));
  const scoped=[...events,...flagEvents].filter(e=>inScope(e,board,calendar));
  for(const e of scoped)if(!doodEventType(e))diagnostics.push(`Evento ${e.name||e.id}: tipo DOOD non verificato, escluso dai conteggi`);
  for(const e of scoped)if(doodEventType(e)&&(!validDate(e.startDate)||!validDate(e.endDate)||e.endDate<e.startDate))diagnostics.push(`Evento ${e.name||e.id}: intervallo non valido, escluso`);
  const known=scoped.filter(e=>doodEventType(e)&&validDate(e.startDate)&&validDate(e.endDate)&&e.endDate>=e.startDate);
  const bounds=[...days.keys(),...known.flatMap(e=>[e.startDate,e.endDate])].sort();
  const start=startDate||bounds[0],end=endDate||bounds.at(-1),dates=[];
  if(start&&end){
    if(!validDate(start)||!validDate(end)||end<start)throw Error('Intervallo DOOD non valido');
    const count=(Date.parse(end)-Date.parse(start))/DAY_MS+1;if(count>36600)throw Error('Intervallo DOOD superiore a 100 anni');
    for(let time=Date.parse(start);time<=Date.parse(end);time+=DAY_MS){
      const date=new Date(time).toISOString().slice(0,10),status=calendarDate(calendar,date);
      dates.push({date,calendar:status||{working:null,reason:'unresolved'},shootingDays:days.get(date)?.shootingDays||[]});
    }
  }
  if(dates.some(d=>d.calendar.working===null))diagnostics.push('Calendario non risolto: Hold non assegnato nei giorni ambigui');
  const rows=elements.map(element=>{
    const rules=normalizeRules(rulesForElement(element));
    const field=project.format==='msd'?(element.doodField||categoryField(element.category)):null;
    const cells=dates.map(day=>{
      const scenes=[...(days.get(day.date)?.scenes.values()||[])].filter(({scene})=>
        (scene.elementRefs||[]).some(ref=>ref.resolved&&ref.elementId===element.id)||
        (scene.fieldElementIds||[]).includes(element.id)||
        field&&scene[field]===element.name);
      const matching=known.filter(e=>intervalContains(e,day.date)&&(['holiday','move'].includes(doodEventType(e))||targetsElement(e,element)));
      const individualTypes=[...new Set(matching.map(doodEventType).filter(t=>Object.hasOwn(ACTIVITY_CODES,t)))];
      const companyTypes=[...new Set(matching.map(doodEventType).filter(t=>Object.hasOwn(COMPANY_CODES,t)))];
      if(day.calendar.specialDay?.attributes?.Holiday==='1'&&!companyTypes.includes('holiday'))companyTypes.push('holiday');
      return {date:day.date,calendar:day.calendar,sceneWork:scenes.length>0,scenes,events:matching,individualTypes,companyTypes,
        start:false,finish:false,held:false,dropped:false,release:false,pickup:false,contributions:{},codes:[]};
    });
    const work=cells.filter(c=>c.sceneWork),first=work[0]?.date??null,last=work.at(-1)?.date??null;
    for(const c of cells){c.start=c.sceneWork&&c.date===first;c.finish=c.sceneWork&&c.date===last}
    const dropIntervals=findDropIntervals(cells,rules);
    for(const interval of dropIntervals){cells[interval.release].release=true;cells[interval.pickup].pickup=true;
      for(let i=interval.release+1;i<interval.pickup;i++)cells[i].dropped=true;
    }
    const totals={worked:0,held:0,scene:0,travel:0,fitting:0,rehearsal:0,holiday:0,move:0};
    for(const cell of cells){
      const inside=first!==null&&cell.date>first&&cell.date<last;
      const insideSpan=first!==null&&cell.date>=first&&cell.date<=last;
      const activity=cell.individualTypes.some(t=>t!=='unavailable');
      const company=rules.allowHold&&insideSpan&&!cell.dropped&&cell.companyTypes.length>0;
      cell.held=rules.allowHold&&inside&&!cell.dropped&&!cell.sceneWork&&!activity&&!company&&cell.calendar.working===true;
      cell.contributions={worked:!cell.dropped&&(cell.sceneWork||activity||company),held:cell.held,scene:cell.sceneWork,
        travel:cell.individualTypes.includes('travel'),fitting:cell.individualTypes.includes('fitting'),rehearsal:cell.individualTypes.includes('rehearsal'),
        holiday:company&&cell.companyTypes.includes('holiday'),move:company&&cell.companyTypes.includes('move')};
      cell.conflicts=cell.individualTypes.includes('unavailable')&&(cell.sceneWork||activity)?['Elemento Unavailable durante una prestazione']:[];
      cell.codes=doodCodes(cell);
      for(const key of Object.keys(totals))if(cell.contributions[key])totals[key]++;
    }
    return {element,rules,first,last,cells,totals,dropIntervals};
  });
  return {boardName:board.name,calendarId:calendar?.id??null,dates,rows,diagnostics:[...new Set(diagnostics)]};
}
export function sortDoodRows(rows,criteria=[{key:'id',direction:'asc'}]){
  const collator=new Intl.Collator('it',{numeric:true,sensitivity:'base'});
  const value=(r,key)=>({id:r.element.boardId??'',name:r.element.name??'',first:r.first,last:r.last,worked:r.totals.worked,held:r.totals.held})[key];
  return rows.map((row,index)=>({row,index})).sort((a,b)=>{
    for(const criterion of criteria.slice(0,4)){
      const x=value(a.row,criterion.key),y=value(b.row,criterion.key);
      if(x==null||y==null){if(x!==y)return x==null?1:-1;continue}
      const result=typeof x==='number'?x-y:collator.compare(String(x),String(y));
      if(result)return result*(criterion.direction==='desc'?-1:1);
    }return a.index-b.index;
  }).map(item=>item.row);
}
export function doodSummaryCsv(report){
  const quote=v=>{const value=String(v??'');return '"'+(/^[=+@\t\r-]/.test(value)?"'":'')+value.replaceAll('"','""')+'"'};
  return [['ID','Elemento','Worked','Held','Travel','Fitting','Rehearsal','Start','Finish'],...report.rows.map(r=>[r.element.boardId,r.element.name,r.totals.worked,r.totals.held,r.totals.travel,r.totals.fitting,r.totals.rehearsal,r.first,r.last])].map(row=>row.map(quote).join(',')).join('\r\n');
}
