import {modelId} from './project-model.js';
import {validDate} from './production-data.js';
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const SPECIAL={offday:'Off',travel:'CompanyTravel',holiday:'Holiday',workday:'ExceptionWorkday'};
export function mmsxDate(raw){
  const text=String(raw??'');
  const iso=/^\d{8}$/.test(text)?`${text.slice(0,4)}-${text.slice(4,6)}-${text.slice(6)}`:null;
  return validDate(iso)?iso:null;
}
export function mmsxProduction(root){
  const c=root.contents,calendars=[],events=[];
  const target=id=>{
    const e=c.element[id];
    if(!e)return {kind:'unresolved',elementId:id,category:null,element:null};
    if(!e.name&&!e.category_id)return {kind:'project',elementId:id,category:null,element:null};
    const category=c.category?.[e.category_id]?.name;
    return {kind:category&&e.name?'element':'unresolved',elementId:id,category:category||null,element:e.name||null};
  };
  for(const [bid,b] of Object.entries(c.stripboard))for(const [sid,s] of Object.entries(b.segmentMap)){
    if(!s.calendar)continue;
    const raw=s.calendar,id=modelId('calendar',bid,sid),scope={kind:'segment',boardId:bid,segmentId:sid};
    const bits=Number(raw.daysOff),known=raw.daysOff!=null&&Number.isInteger(bits)&&bits>=0&&bits<=127;
    const specialDays=Object.entries(raw.specialDays||{}).map(([date,type])=>({date:mmsxDate(date),rawDate:date,type,
      attributes:Object.fromEntries(Object.values(SPECIAL).map(key=>[key,SPECIAL[type]?String(Number(SPECIAL[type]===key)):null]))}));
    calendars.push({id,name:`${b.name||bid} / ${s.name||s.type||sid}`,scope,segmentType:s.type,
      sourceRef:{format:'mmsx',boardId:bid,segmentId:sid},source:raw,options:s.calendarOptions||{},attributes:{},
      scheduleDates:{ProductionStartDate:{raw:raw.prodStart,iso:mmsxDate(raw.prodStart),origin:'stored'}},activityBounds:{start:null,end:null},
      daysOff:Object.fromEntries(DAYS.map((day,i)=>[day,known?String((bits>>i)&1):null])),specialDays,dates:[]});
    for(const [eid,e] of Object.entries(raw.eventMap||{}))events.push({id:modelId('event',bid,sid,eid),sourceId:eid,
      calendarId:id,scope,name:e.eventName||'',type:e.type,note:e.note||'',color:e.color||null,
      startDate:mmsxDate(e.startDate),endDate:mmsxDate(e.endDate),dateOrigin:'stored',
      targets:(Array.isArray(e.elements)?e.elements:[]).map(target),source:e});
  }
  // Labels are presentation only: calendars with identical names still have distinct IDs.
  const labels=new Map();for(const cal of calendars)labels.set(cal.name,(labels.get(cal.name)||0)+1);
  for(const cal of calendars)if(labels.get(cal.name)>1)cal.name+=` [${cal.scope.boardId} / ${cal.scope.segmentId}]`;
  const redFlagNames=Object.entries(c.redflagType||{}).map(([id,t])=>({id,name:t.name||t.type||id,type:t.type,sortOrder:t.sortOrder,source:t}));
  const redFlags=Object.entries(c.redflag||{}).map(([id,r],sourceOrder)=>{
    const resolved=target(r.elementId),type=c.redflagType?.[r.type];
    return {id,sourceId:id,sourceOrder,name:r.typeName||type?.name||r.type||'',typeId:r.type,type:type?.type||null,typeName:r.typeName||null,
      note:r.note||'',color:r.color||null,startDate:mmsxDate(r.startDate),endDate:mmsxDate(r.endDate),
      date:mmsxDate(r.startDate),rawDate:r.startDate,target:resolved,targetResolved:resolved.kind!=='unresolved',
      scope:{kind:'project'},dateOrigin:'stored',source:r};
  });
  return {calendars,events,redFlags,redFlagNames,production:root.productionInfo||{}};
}
