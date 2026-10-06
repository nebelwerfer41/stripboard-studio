// Keys are stable source keys (including Banner and Day Break keys). Only scene keys can be active.
export const STRIP_GESTURE={
  mouseDragPx:7,touchScrollPx:10,touchDragPx:12,longPressMs:480,
  autoscrollEdgePx:42,scrollbarGuardPx:14,postDragClickMs:700
};

export function selectStripState(state,key,{toggle=false,isSceneKey}={}){
  const previousActive=state.activeStripId;
  if(toggle&&state.selectedStripIds.has(key))state.selectedStripIds.delete(key);
  else{
    if(!toggle)state.selectedStripIds.clear();
    state.selectedStripIds.delete(key);
    state.selectedStripIds.add(key);
  }
  if(state.selectedStripIds.has(key)&&isSceneKey(key))state.activeStripId=key;
  else if(!state.activeStripId||!state.selectedStripIds.has(state.activeStripId))
    state.activeStripId=[...state.selectedStripIds].reverse().find(isSceneKey)||null;
  if(!state.selectedStripIds.size)state.touchMultiSelect=false;
  return previousActive;
}

export function clearStripState(state){
  const previousActive=state.activeStripId;
  state.selectedStripIds.clear();state.activeStripId=null;state.draggedStripIds.clear();state.touchMultiSelect=false;
  return previousActive;
}

export function movementIntent({pointerType,longPress},distance){
  if(pointerType==='touch'){
    if(!longPress)return distance>=STRIP_GESTURE.touchScrollPx?'scroll':'wait';
    return distance>=STRIP_GESTURE.touchDragPx?'drag':'wait';
  }
  return distance>=STRIP_GESTURE.mouseDragPx?'drag':'wait';
}
