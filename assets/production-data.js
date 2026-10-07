/* Common production data and read-only selectors. Calendar dates are independent of boards. */
const WEEKDAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_MS=86400000;

export function validDate(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||''))return false;
  const day=new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(day.valueOf())&&day.toISOString().slice(0,10)===iso;
}

export function outsideCalendarActivity(calendar,iso){
  if(!calendar||!validDate(iso))return false;
  const dates=calendar.scheduleDates||{};
  const start=calendar.activityBounds?calendar.activityBounds.start:dates.ProductionPrepStartDate?.iso||dates.ProductionStartDate?.iso;
  const end=calendar.activityBounds?calendar.activityBounds.end:dates.ProductionWrapDate?.iso||dates.ProductionEndDate?.iso;
  return Boolean((validDate(start)&&iso<start)||(validDate(end)&&iso>end));
}

export function calendarDate(calendar,iso){
  if(!calendar||!validDate(iso))return null;
  const specialDays=(calendar.specialDays||[]).filter(item=>item.date===iso);
  const weekday=WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  const weeklyOff=calendar.daysOff?.[weekday];
  const special=specialDays[0]||null,flags=special?.attributes||{};
  let working=null,reason='unresolved';
  if(['0','1'].includes(weeklyOff)&&specialDays.length<=1&&
    (!special||['Off','Holiday','CompanyTravel','ExceptionWorkday'].every(key=>['0','1'].includes(flags[key])))){
    const blocked=['Off','Holiday','CompanyTravel'].filter(key=>flags[key]==='1');
    if(flags.ExceptionWorkday==='1'&&blocked.length===0){working=true;reason='exception-workday'}
    else if(flags.ExceptionWorkday==='1'){reason='conflicting-special-day'}
    else if(blocked.length){working=false;reason=blocked.join(',')}
    else {working=weeklyOff==='0';reason=working?'weekly-workday':'weekly-day-off'}
  }
  return {date:iso,weekday,working,reason,specialDay:special,
    shootingDays:[]};
}

export function calendarDatesBetween(calendar,start,end){
  if(!validDate(start)||!validDate(end)||end<start)return [];
  const dates=[];let day=Date.parse(`${start}T00:00:00Z`),last=Date.parse(`${end}T00:00:00Z`);
  while(day<=last&&dates.length<36600){dates.push(calendarDate(calendar,new Date(day).toISOString().slice(0,10)));day+=DAY_MS}
  return dates;
}

export function shootingDatesForCalendar(calendar,count){
  const start=calendar?.scheduleDates?.ProductionStartDate?.iso;
  if(!validDate(start))return Array(count).fill(null);
  const dates=[];let day=Date.parse(`${start}T00:00:00Z`),scanned=0;
  while(dates.length<count&&scanned++<36600){
    const iso=new Date(day).toISOString().slice(0,10),status=calendarDate(calendar,iso);
    if(status?.working==null)break;
    if(status.working)dates.push(iso);
    day+=DAY_MS;
  }
  while(dates.length<count)dates.push(null);
  return dates;
}

export function boardWithCalendar(project,boardName,calendarName){
  const board=project?.boards.find(item=>item.name===boardName);
  if(!board)return null;
  if(project.capabilities?.calendarProjection===false||!calendarName||calendarName===board.calendarId||calendarName===board.calendarName)return board;
  const calendar=findCalendar(project,calendarName);
  if(!calendar)return null;
  const groups=board.scheduledGroups.filter(item=>item.kind==='ScheduleDay');
  const dates=shootingDatesForCalendar(calendar,groups.length);
  let index=0;
  const scheduledGroups=board.scheduledGroups.map(group=>group.kind==='ScheduleDay'?
    {...group,date:dates[index++],calendarId:calendar.id,calendarName:calendar.name}:group);
  const resolved=scheduledGroups.filter(group=>group.kind==='ScheduleDay'&&group.date);
  return {...board,sourceCalendarName:board.calendarName,calendarId:calendar.id,calendarName:calendar.name,scheduledGroups,
    dateAudit:{method:'successive-workdays-v1',confidence:'inferred',
      firstDate:resolved[0]?.date??null,lastDate:resolved.at(-1)?.date??null,
      storedProductionEndDate:calendar.scheduleDates.ProductionEndDate?.iso??null,
      lastDateMatchesStoredEnd:resolved.length&&calendar.scheduleDates.ProductionEndDate?.iso?
        resolved.at(-1).date===calendar.scheduleDates.ProductionEndDate.iso:null}};
}

export function availableCalendars(project){return project?.calendars||[]}
export function findCalendar(project,id){return availableCalendars(project).find(c=>c.id===id)||availableCalendars(project).find(c=>c.name===id)||null}
export function selectedCalendar(project,boardName=project?.activeBoard){
  const board=project?.boards.find(item=>item.name===boardName);
  return findCalendar(project,board?.calendarId||board?.calendarName||project?.defaultCalendar);
}
export function getCalendarDate(project,calendarName,iso){
  const calendar=findCalendar(project,calendarName),date=calendarDate(calendar,iso);
  if(!date)return null;
  date.shootingDays=(project.boards||[]).flatMap(board=>
    (board.calendarId?board.calendarId===calendar.id:board.calendarName===calendar.name)?board.scheduledGroups.flatMap((group,groupIndex)=>
      group.kind==='ScheduleDay'&&group.date===iso?[{boardName:board.name,shootingDayNumber:group.shootingDayNumber,groupIndex,dateRelationship:group.dateOrigin||board.dateAudit?.confidence}]:[]):[]);
  return date;
}
export function listCalendarDates(project,calendarName,{start=null,end=null,working=null}={}){
  const calendar=findCalendar(project,calendarName);
  if(!calendar)return [];
  const dates=start&&end?calendarDatesBetween(calendar,start,end).map(item=>getCalendarDate(project,calendarName,item.date)):
    (calendar.dates||[]).filter(item=>(!start||item.date>=start)&&(!end||item.date<=end)).map(item=>getCalendarDate(project,calendarName,item.date));
  return working===null?dates:dates.filter(item=>item.working===working);
}
export function shootingDaysOnDate(project,calendarName,iso){
  return getCalendarDate(project,calendarName,iso)?.shootingDays||[];
}
export function scenesForShootingDay(project,boardName,shootingDayNumber){
  const board=project?.boards.find(item=>item.name===boardName);
  const group=board?.scheduledGroups.find(item=>item.kind==='ScheduleDay'&&item.shootingDayNumber===shootingDayNumber);
  const sceneIndex=new Map((project?.scenes||[]).map(item=>[item.bdsId,item]));
  return group?.strips.filter(item=>item.kind==='scene').map(item=>sceneIndex.get(item.bdsId)).filter(Boolean)||[];
}
export function intervalContains(item,iso){
  const start=Object.hasOwn(item,'startDate')?item.startDate:item.date,end=Object.hasOwn(item,'endDate')?item.endDate:item.date;
  return validDate(iso)&&validDate(start)&&validDate(end)&&start<=end&&iso>=start&&iso<=end;
}
export function intervalOverlaps(item,start,end){
  const first=Object.hasOwn(item,'startDate')?item.startDate:item.date,last=Object.hasOwn(item,'endDate')?item.endDate:item.date;
  if((start||end)&&(!validDate(first)||!validDate(last)||first>last))return false;
  return (!start||(validDate(last)&&last>=start))&&(!end||(validDate(first)&&first<=end));
}
export function eventsOnDate(project,calendarId,iso){return (project?.events||[]).filter(e=>e.calendarId===calendarId&&intervalContains(e,iso))}
export function redFlagsOnDate(project,iso){return (project?.redFlags||[]).filter(item=>intervalContains(item,iso))}
function matchesElement(scene,target){
  if(target.elementId&&scene.elementRefs)return scene.elementRefs.some(ref=>ref.elementId===target.elementId&&ref.resolved);
  return (scene.requirements?.[target.category]||[]).includes(target.element);
}
export function redFlagsForShootingDay(project,boardName,shootingDayNumber){
  const board=project?.boards.find(item=>item.name===boardName);
  const group=board?.scheduledGroups.find(item=>item.kind==='ScheduleDay'&&item.shootingDayNumber===shootingDayNumber);
  if(!group?.date)return [];
  const scenes=scenesForShootingDay(project,boardName,shootingDayNumber);
  return redFlagsOnDate(project,group.date).filter(flag=>flag.target.kind==='project'||
    flag.target.kind==='element'&&scenes.some(scene=>
      matchesElement(scene,flag.target)));
}
export function redFlagsForScene(project,bdsId,iso=null){
  const scene=project?.scenes.find(item=>item.bdsId===bdsId);
  if(!scene)return [];
  return (project.redFlags||[]).filter(flag=>flag.target.kind==='element'&&(!iso||intervalContains(flag,iso))&&matchesElement(scene,flag.target));
}
export function redFlagsForStrip(project,bdsId,iso){
  if(!iso||!project?.scenes.some(item=>item.bdsId===bdsId))return [];
  const direct=new Set(redFlagsForScene(project,bdsId,iso));
  return redFlagsOnDate(project,iso).filter(flag=>flag.target.kind==='project'||direct.has(flag));
}
