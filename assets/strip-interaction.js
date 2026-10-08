// Keys are stable source keys (including Banner and Day Break keys). Only scene keys can be active.
export const STRIP_GESTURE={
  mouseDragPx:7,touchScrollPx:10,touchDragPx:12,longPressMs:480,
  autoscrollEdgePx:42,scrollbarGuardPx:14,postDragClickMs:700
};

export function selectStripState(state,key,{toggle=false,range=false,orderedKeys=[],isSceneKey,sceneIdForKey}={}){
  const previousActive=state.activeStripId;
  const anchorIndex=orderedKeys.indexOf(state.selectionAnchorId),keyIndex=orderedKeys.indexOf(key);
  if(range&&anchorIndex>=0&&keyIndex>=0){
    if(!toggle)state.selectedStripIds.clear();
    for(const item of orderedKeys.slice(Math.min(anchorIndex,keyIndex),Math.max(anchorIndex,keyIndex)+1))state.selectedStripIds.add(item);
  }else if(toggle&&state.selectedStripIds.has(key))state.selectedStripIds.delete(key);
  else{
    if(!toggle)state.selectedStripIds.clear();
    state.selectedStripIds.delete(key);
    state.selectedStripIds.add(key);
  }
  if(!range||anchorIndex<0||keyIndex<0)state.selectionAnchorId=key;
  if(state.selectedStripIds.has(key)&&isSceneKey(key))state.activeStripId=key;
  else if(!state.activeStripId||!state.selectedStripIds.has(state.activeStripId))
    state.activeStripId=[...state.selectedStripIds].reverse().find(isSceneKey)||null;
  if(!state.selectedStripIds.size)state.touchMultiSelect=false;
  if(sceneIdForKey)state.activeSceneId=state.activeStripId?sceneIdForKey(state.activeStripId):null;
  return previousActive;
}

export function clearStripState(state){
  const previousActive=state.activeStripId;
  state.selectedStripIds.clear();state.selectionAnchorId=null;state.activeStripId=null;state.activeSceneId=null;state.draggedStripIds.clear();state.touchMultiSelect=false;
  return previousActive;
}

export function movementIntent({pointerType,longPress},distance){
  if(pointerType==='touch'){
    if(!longPress)return distance>=STRIP_GESTURE.touchScrollPx?'scroll':'wait';
    return distance>=STRIP_GESTURE.touchDragPx?'drag':'wait';
  }
  return distance>=STRIP_GESTURE.mouseDragPx?'drag':'wait';
}
