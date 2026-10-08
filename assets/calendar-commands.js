/* Calendar transactions share the same model and history as strip scheduling. */
import {findCalendar,calendarDate,validDate} from './production-data.js';
import {snapshotBoardOrder,restoreBoardOrder} from './scheduling.js';
import {ExactNumber} from './mmsx-codec.js';
export const CALENDAR_DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const SPECIAL_TYPES={workday:'ExceptionWorkday',offday:'Off',holiday:'Holiday',travel:'CompanyTravel'};
export const FLASH_DATE_NS='https://stripboard.studio/ns/calendar/1';
export const calendarSignature=c=>JSON.stringify([c.daysOff,c.specialDays,c.scheduleDates]);
export const calendarsSignature=p=>JSON.stringify(p.calendars.map(c=>[c.name,calendarSignature(c)]));
export function plansForCalendar(project,id){return project.boards.filter(b=>b.calendarId===id)}
// structuredClone drops ExactNumber's prototype; history must preserve opaque numeric values.
function cloneValue(value){
  if(value instanceof ExactNumber)return new ExactNumber(value.text);
  if(Array.isArray(value))return value.map(cloneValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,cloneValue(v)]));
  return value;
}
export function snapshotProduction(project){
  return {calendars:project.calendars.map(c=>({id:c.id,daysOff:cloneValue(c.daysOff),specialDays:cloneValue(c.specialDays),scheduleDates:cloneValue(c.scheduleDates)})),
    boards:project.boards.map(b=>({id:b.id,order:snapshotBoardOrder(b),dateAudit:structuredClone(b.dateAudit)}))};
}
export function restoreProduction(project,snapshot){
  for(const entry of snapshot.calendars){const c=findCalendar(project,entry.id);if(c)for(const key of ['daysOff','specialDays','scheduleDates'])c[key]=cloneValue(entry[key])}
  for(const entry of snapshot.boards){const b=project.boards.find(b=>b.id===entry.id);if(b){restoreBoardOrder(b,entry.order);b.dateAudit=structuredClone(entry.dateAudit)}}
}
export function editCalendar(project,{calendarId,weekday,off,date,type,startDate}){
  if(!project.capabilities.editCalendars)throw Error('Editing calendario non supportato');
  const c=findCalendar(project,calendarId);if(!c)throw Error('Calendario non trovato');
  const before=calendarSignature(c);
  if(weekday!==undefined){
    if(!CALENDAR_DAYS.includes(weekday)||typeof off!=='boolean')throw Error('Regola settimanale non valida');
    if(CALENDAR_DAYS.some(day=>!['0','1'].includes(c.daysOff[day])))throw Error('Pattern settimanale non risolto: occorre un calendario con sette regole valide');
    c.daysOff={...c.daysOff,[weekday]:off?'1':'0'};
  }else if(date!==undefined){
    if(!validDate(date)||type!==null&&!Object.hasOwn(SPECIAL_TYPES,type))throw Error('Eccezione non valida');
    const old=c.specialDays.filter(s=>s.date===date);
    if(old.length>1)throw Error('Più eccezioni sulla data: risolvere la sorgente prima di sostituirle');
    if(type===null&&!old.length)return false;
    if(type&&old.length&&Object.values(SPECIAL_TYPES).every(key=>old[0].attributes[key]===String(Number(key===SPECIAL_TYPES[type]))))return false;
    const special=type===null?null:{...old[0],date,rawDate:old[0]?.rawDate||date,type,
      attributes:{...old[0]?.attributes,...Object.fromEntries(Object.values(SPECIAL_TYPES).map(key=>[key,String(Number(key===SPECIAL_TYPES[type]))]))}};
    const index=c.specialDays.findIndex(s=>s.date===date);
    c.specialDays=c.specialDays.filter(s=>s.date!==date);
    if(special)c.specialDays.splice(index<0?c.specialDays.length:index,0,special);
  }else if(startDate!==undefined){
    if(!validDate(startDate))throw Error('Inizio riprese non valido');
    if(c.scheduleDates.ProductionStartDate?.iso===startDate)return false;
    c.scheduleDates={...c.scheduleDates,ProductionStartDate:{...c.scheduleDates.ProductionStartDate,iso:startDate,origin:'edited'}};
  }else throw Error('Comando calendario vuoto');
  if(before===calendarSignature(c))return false;
  // MSD has no native per-day dates. Lock the existing inference until explicit rescheduling.
  if(project.format==='msd')for(const b of plansForCalendar(project,c.id))for(const g of b.scheduledGroups)if(g.kind==='ScheduleDay')g.dateLocked=true;
  return true;
}
const nextDate=date=>new Date(Date.parse(`${date}T00:00:00Z`)+86400000).toISOString().slice(0,10);
export function previewReschedule(project,calendarId){
  const c=findCalendar(project,calendarId);if(!c)throw Error('Calendario non trovato');
  const anchor=c.scheduleDates.ProductionStartDate?.iso;
  if(!validDate(anchor))throw Error('Imposta un inizio riprese valido');
  return plansForCalendar(project,c.id).map(board=>{
    const groups=board.scheduledGroups.filter(g=>g.kind==='ScheduleDay'),dates=[];let date=anchor;
    for(let i=0;i<groups.length;i++){
      if(i){let found=false;for(let n=0;n<36600;n++){
        date=nextDate(date);const status=calendarDate(c,date);
        if(status.working===null)throw Error(`Regola non risolta il ${date}; ripianificazione interrotta`);
        if(status.working){found=true;break}
      }if(!found)throw Error('Nessun giorno lavorativo disponibile nei prossimi 100 anni')}
      dates.push(date);
    }
    return {boardId:board.id,boardName:board.name,segmentName:board.segmentName,changes:groups.map((g,i)=>({groupId:g.id,from:g.date,to:dates[i],shootingDayNumber:g.shootingDayNumber})),
      anchorConflict:calendarDate(c,anchor)?.working!==true};
  });
}
export function rescheduleCalendar(project,calendarId,expected=null){
  if(!project.capabilities.editCalendars)throw Error('Ripianificazione non supportata');
  const preview=previewReschedule(project,calendarId);
  if(expected&&JSON.stringify(preview)!==JSON.stringify(expected))throw Error('Il piano è cambiato: rivedi gli effetti prima di applicare');
  let changed=false;
  for(const plan of preview){
    const b=project.boards.find(b=>b.id===plan.boardId);
    let planChanged=false;
    for(const change of plan.changes){const g=b.scheduledGroups.find(g=>g.id===change.groupId);
      if(g.date!==change.to){g.date=change.to;g.dateOrigin='rescheduled';if(project.format==='msd')g.dateLocked=true;changed=true;planChanged=true}
    }
    if(planChanged)b.dateAudit={...b.dateAudit,firstDate:plan.changes[0]?.to??null,lastDate:plan.changes.at(-1)?.to??null};
  }
  return changed;
}
