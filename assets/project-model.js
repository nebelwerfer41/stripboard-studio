import {normalizeProjectQuantities} from './quantities.js';
/* Additive common contract. Source archives belong to adapters, never to views. */
import {normalizeSceneSingleValues,sceneValueIndex} from './scene-values.js';
export const modelId=(kind,...parts)=>`${kind}:${JSON.stringify(parts)}`;
export function completeProjectModel(project){
  project.modelVersion=3;
  project.id??=project.mmsxSource?.root.id??modelId('project',project.format,project.fileName);
  project.provenance??={format:project.format,fileName:project.fileName};
  project.capabilities={readCalendars:true,readEvents:true,readRedFlags:true,readProduction:true,
    readQuantities:true,editStrips:true,editCalendars:false,editProduction:false,
    reports:project.reportLayouts.length>0,createBoards:false,
    calendarProjection:false,...project.capabilities};
  project.events??=[];
  for(const [i,e] of project.elements.entries())e.id??=modelId('element',i);
  for(const e of project.elements)if(e.category&&!project.categorySettings.some(c=>c.name===e.category))project.categorySettings.push({id:modelId('category',e.category),name:e.category,attributes:{},properties:{},derived:true});
  const elementIndex=new Map(project.elements.map(e=>[JSON.stringify([e.category,e.name]),e]));
  const values=sceneValueIndex(project);
  for(const scene of project.scenes){
    scene.id??=scene.bdsId;
    scene.elementRefs??=Object.entries(scene.requirements||{}).flatMap(([category,names])=>names.map(name=>({
      elementId:elementIndex.get(JSON.stringify([category,name]))?.id??null,category,name,
      quantity:null,quantityOrigin:'absent',resolved:elementIndex.has(JSON.stringify([category,name]))})));
    normalizeSceneSingleValues(project,scene,values);
    const requirements=Object.create(null);for(const ref of scene.elementRefs)(requirements[ref.category]??=[]).push(ref.name);scene.requirements=requirements;
  }
  for(const [i,c] of project.calendars.entries()){
    c.id??=modelId('calendar',i);c.scope??={kind:'project'};
    c.sourceRef??={format:project.format,name:c.name,order:i};
    for(const value of Object.values(c.scheduleDates))value.origin??='stored';
  }
  for(const [i,b] of project.boards.entries()){
    b.id??=modelId('plan',i);b.parentBoardId??=b.id;b.segmentId??=modelId('segment',b.id,'scheduled');
    b.calendarId??=project.calendars.find(c=>c.name===b.calendarName)?.id??null;
    for(const container of ['scheduledGroups','unscheduledGroups'])for(const [j,g] of b[container].entries()){
      g.id??=modelId('group',b.id,container,g.sourceIndex??j);
      g.calendarId??=container==='scheduledGroups'?b.calendarId:null;
      g.dateOrigin??=b.dateAudit?.confidence||'unresolved';
    }
  }
  for(const flag of project.redFlags){
    if(!Object.hasOwn(flag,'startDate'))flag.startDate=flag.date;
    if(!Object.hasOwn(flag,'endDate'))flag.endDate=flag.date;
    flag.scope??={kind:'project'};flag.dateOrigin??='stored';
    if(flag.target.kind==='element')flag.target.elementId??=elementIndex.get(JSON.stringify([flag.target.category,flag.target.element]))?.id??null;
  }
  project.counts.categories=project.categorySettings.length;
  project.counts.calendars=project.calendars.length;project.counts.events=project.events.length;
  project.counts.redFlags=project.redFlags.length;
  normalizeProjectQuantities(project);
  return project;
}

// A native writer may patch only the areas audited by that adapter.
const NATIVE_DATA=['id','title','production','scenes','elements','categorySettings','redFlags','redFlagNames','redFlagSettings','stripLayouts','reportLayouts','colors','quantitySettings'];
export function nativeDataSignature(p){
 const strips=new Map();for(const b of p.boards)for(const g of [...b.scheduledGroups,...b.unscheduledGroups])for(const s of g.strips)strips.set(s.sourceKey,s);
 const calendars=p.calendars.map(c=>[c.id,c.name,c.options,c.attributes,c.activityBounds,Object.entries(c.scheduleDates).filter(([k])=>k!=='ProductionStartDate')]);
 const boards=p.format==='mmsx'?p.boards.map(b=>[b.id,b.name,b.description,b.parentBoardId,b.segmentId,b.calendarId,b.segmentName,b.parentBoardName,b.segmentOrder,b.attributes,b.yardSegments]):null;
 return JSON.stringify([...NATIVE_DATA.map(k=>p[k]),p.events.filter(e=>!e.studio),[...strips].sort(([a],[b])=>a.localeCompare(b)),calendars,boards]);
}
export function registerNativeModel(p){
  p.provenance??={format:p.format,fileName:p.fileName};
  p.nativeModelSignature=nativeDataSignature(p);p.nativeArrangementSignature=arrangementSignature(p);p.nativeStartDates=new Map(p.calendars.map(c=>[c.id,c.scheduleDates.ProductionStartDate?.iso??null]));p.nativeGroupAttributes=new Map(p.boards.flatMap(b=>[...b.scheduledGroups,...b.unscheduledGroups]).map(g=>[g.id,JSON.stringify(g.attributes)]));return p;
}
function arrangementSignature(p){return JSON.stringify([p.boards,p.calendars,p.activeBoard,p.defaultCalendar])}
export function canPatchNative(p,format){
 if(p.calendars.some(c=>(c.scheduleDates.ProductionStartDate?.iso??null)!==p.nativeStartDates?.get(c.id)&&(!c.scheduleDates.ProductionStartDate?.iso||c.scheduleDates.ProductionStartDate.origin!=='edited')))return false;
 if(p.boards.some(b=>[...b.scheduledGroups,...b.unscheduledGroups].some(g=>p.nativeGroupAttributes?.has(g.id)&&p.nativeGroupAttributes.get(g.id)!==JSON.stringify(g.attributes))))return false;
 if(format==='msd'&&p.boards.some(b=>b.calendarName!==b.attributes?.CalendarName||b.calendarId!==(p.calendars.find(c=>c.name===b.calendarName)?.id??null)))return false;
 return p.format===format&&p.nativeModelSignature===nativeDataSignature(p)&&(!p.documentEditing||p.nativeArrangementSignature===arrangementSignature(p))}
// A breakdown sheet has one placement per MMSX parent board, including its shared Boneyard.
// Alternative parent boards remain independent schedules.
export function scenePlacementConflicts(project){
 const families=new Map(),conflicts=[];
 for(const b of project.boards){const parent=b.parentBoardId||b.id;let family=families.get(parent);if(!family)families.set(parent,family={scenes:new Map(),yard:false});
  const batches=[['scheduledGroups',b.scheduledGroups]];if(!family.yard){family.yard=true;batches.push(['unscheduledGroups',b.unscheduledGroups])}
  for(const [container,groups] of batches)for(const g of groups)for(const strip of g.strips){if(strip.kind!=='scene')continue;const position={boardId:b.id,boardName:b.name,segmentId:container==='scheduledGroups'?b.segmentId:g.mmsxSegment||'boneyard',container,groupId:g.id,sourceKey:strip.sourceKey};const first=family.scenes.get(strip.bdsId);if(first)conflicts.push({parentBoardId:parent,bdsId:strip.bdsId,first,duplicate:position});else family.scenes.set(strip.bdsId,position)}
 }
 return conflicts;
}
