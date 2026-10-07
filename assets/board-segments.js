/* Parent boards and sub-boards are views of the existing editing groups, not copies. */
export function boardGroups(project){
  const parents=new Map();
  for(const plan of project?.boards||[]){
    const id=plan.parentBoardId||plan.id||plan.name;
    let parent=parents.get(id);
    if(!parent){parent={id,name:plan.parentBoardName||plan.name,plans:[],segments:[]};parents.set(id,parent)}
    parent.plans.push(plan);
    parent.segments.push({id:plan.segmentId||`${plan.name}:scheduled`,name:plan.segmentName||'Piano',
      type:'normal',order:plan.segmentOrder??parent.segments.length,boardName:plan.name,container:'scheduledGroups'});
    for(const yard of plan.yardSegments||[{id:`${id}:boneyard`,name:'Boneyard'}]){
      if(parent.segments.some(s=>s.id===yard.id))continue;
      parent.segments.push({...yard,type:'boneyard',order:yard.order??Number.MAX_SAFE_INTEGER,
        boardName:plan.name,container:'unscheduledGroups'});
    }
  }
  for(const parent of parents.values())parent.segments.sort((a,b)=>Number(a.type==='boneyard')-Number(b.type==='boneyard')||a.order-b.order);
  return [...parents.values()];
}
export function boardGroupForPlan(project,boardName){
  return boardGroups(project).find(parent=>parent.plans.some(plan=>plan.name===boardName))||null;
}
export function entriesForBoard(project,boardName,visibleIds=null){
  const parent=boardGroupForPlan(project,boardName);
  if(!parent)return [];
  return parent.segments.filter(segment=>!visibleIds||visibleIds.has(segment.id)).flatMap(segment=>{
    const board=project.boards.find(plan=>plan.name===segment.boardName);
    return (board?.[segment.container]||[]).flatMap((group,groupIndex)=>
      segment.type==='boneyard'&&group.mmsxSegment&&group.mmsxSegment!==segment.id?[]:
      [{segment,board,group,container:segment.container,groupIndex}]);
  });
}
