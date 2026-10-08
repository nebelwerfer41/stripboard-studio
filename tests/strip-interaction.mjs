import test from 'node:test';
import assert from 'node:assert/strict';
import {STRIP_GESTURE,selectStripState,clearStripState,movementIntent} from '../assets/strip-interaction.js';

const state=()=>({selectedStripIds:new Set(),activeStripId:null,draggedStripIds:new Set(),touchMultiSelect:false});
const scenes=new Set(['105','106','107']);
const select=(model,key,toggle=false)=>selectStripState(model,key,{toggle,isSceneKey:value=>scenes.has(value)});
const check=model=>assert.equal(model.activeStripId===null||model.selectedStripIds.has(model.activeStripId),true);

test('single click replaces selection and makes that scene active',()=>{
  const model=state();select(model,'105');select(model,'106');
  assert.deepEqual([...model.selectedStripIds],['106']);assert.equal(model.activeStripId,'106');check(model);
});

test('modifier and touch multiselection retain interaction order and active fallback',()=>{
  const model=state();select(model,'105');select(model,'106',true);select(model,'107',true);
  assert.deepEqual([...model.selectedStripIds],['105','106','107']);assert.equal(model.activeStripId,'107');
  select(model,'107',true);assert.equal(model.activeStripId,'106');check(model);
  select(model,'105',true);assert.equal(model.activeStripId,'106');check(model);
  select(model,'106',true);assert.equal(model.activeStripId,null);assert.equal(model.selectedStripIds.size,0);check(model);
});

test('banner and day break can be selected without becoming active scenes',()=>{
  const model=state();select(model,'105');select(model,'banner',true);select(model,'break',true);
  assert.equal(model.activeStripId,'105');
  select(model,'105',true);assert.equal(model.activeStripId,null);check(model);
  select(model,'banner');assert.deepEqual([...model.selectedStripIds],['banner']);check(model);
});

test('clear selection also clears drag and touch mode',()=>{
  const model=state();select(model,'105');model.draggedStripIds.add('105');model.touchMultiSelect=true;
  clearStripState(model);
  assert.deepEqual([...model.selectedStripIds],[]);assert.equal(model.activeStripId,null);
  assert.equal(model.draggedStripIds.size,0);assert.equal(model.touchMultiSelect,false);check(model);
});

test('mouse drag starts after its threshold; touch movement scrolls until long press',()=>{
  const mouse={pointerType:'mouse',longPress:false},touch={pointerType:'touch',longPress:false};
  assert.equal(movementIntent(mouse,STRIP_GESTURE.mouseDragPx-1),'wait');
  assert.equal(movementIntent(mouse,STRIP_GESTURE.mouseDragPx),'drag');
  assert.equal(movementIntent(touch,STRIP_GESTURE.touchScrollPx-1),'wait');
  assert.equal(movementIntent(touch,STRIP_GESTURE.touchScrollPx),'scroll');
  touch.longPress=true;
  assert.equal(movementIntent(touch,STRIP_GESTURE.touchDragPx-1),'wait');
  assert.equal(movementIntent(touch,STRIP_GESTURE.touchDragPx),'drag');
});

const order=['105','banner','106','break','107'];
const range=(model,key,toggle=false,orderedKeys=order)=>selectStripState(model,key,{range:true,toggle,orderedKeys,isSceneKey:value=>scenes.has(value)});
test('Shift selects a contiguous range including banners and boundaries in either direction',()=>{
  const model=state();select(model,'105');range(model,'107');
  assert.deepEqual([...model.selectedStripIds],order);assert.equal(model.activeStripId,'107');
  range(model,'106');assert.deepEqual([...model.selectedStripIds],order.slice(0,3));
  assert.equal(model.selectionAnchorId,'105');
  select(model,'107');range(model,'banner');
  assert.deepEqual([...model.selectedStripIds],order.slice(1));check(model);
});
test('Ctrl/Command plus Shift adds a range while a missing or hidden anchor falls back to single selection',()=>{
  const model=state();select(model,'105');select(model,'107',true);range(model,'break',true);
  assert.deepEqual([...model.selectedStripIds],['105','107','break']);check(model);
  range(model,'106',false,['106','break']);
  assert.deepEqual([...model.selectedStripIds],['106']);
  assert.equal(model.selectionAnchorId,'106');
  clearStripState(model);range(model,'107');assert.deepEqual([...model.selectedStripIds],['107']);
});

test('active scene identity is distinct from occurrence and follows multi-selection fallback',()=>{
 const model=state(),ids={a:'scene-A',b:'scene-A',c:'scene-B'},choose=(key,toggle=false)=>selectStripState(model,key,{toggle,isSceneKey:k=>Boolean(ids[k]),sceneIdForKey:k=>ids[k]});
 choose('a');assert.equal(model.activeSceneId,'scene-A');choose('b',true);assert.equal(model.activeStripId,'b');assert.equal(model.activeSceneId,'scene-A');
 choose('c',true);assert.equal(model.activeSceneId,'scene-B');choose('c',true);assert.equal(model.activeSceneId,'scene-A');
 clearStripState(model);assert.equal(model.activeSceneId,null);
});
