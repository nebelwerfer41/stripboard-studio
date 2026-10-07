/* Additive common contract. Source archives belong to adapters, never to views. */
export const modelId=(kind,...parts)=>`${kind}:${JSON.stringify(parts)}`;
export function completeProjectModel(project){
  project.modelVersion=1;
  project.capabilities={readCalendars:true,readEvents:true,readRedFlags:true,readProduction:true,
    readQuantities:true,editStrips:true,editCalendars:false,editProduction:false,
    reports:project.reportLayouts.length>0,createBoards:false,
    calendarProjection:false,...project.capabilities};
  project.events??=[];
  for(const [i,e] of project.elements.entries())e.id??=modelId('element',i);
  const elementIndex=new Map(project.elements.map(e=>[JSON.stringify([e.category,e.name]),e]));
  for(const scene of project.scenes){
    scene.id??=scene.bdsId;
    scene.elementRefs??=Object.entries(scene.requirements||{}).flatMap(([category,names])=>names.map(name=>({
      elementId:elementIndex.get(JSON.stringify([category,name]))?.id??null,category,name,
      quantity:null,quantityOrigin:'absent',resolved:elementIndex.has(JSON.stringify([category,name]))})));
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
  project.counts.calendars=project.calendars.length;project.counts.events=project.events.length;
  project.counts.redFlags=project.redFlags.length;
  return project;
}
