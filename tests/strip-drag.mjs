import test from 'node:test';
import assert from 'node:assert/strict';
import {moveStrips,moveDayBreak,moveBoardItems,dayBreakKey,snapshotBoardOrder,restoreBoardOrder,dragSummary} from '../assets/scheduling.js';

const scene=id=>({kind:'scene',bdsId:id,sourceKey:id});
const banner=id=>({kind:'banner',sourceKey:id,text:id});
const fixture=()=>({boards:[{name:'A',scheduledGroups:[
  {kind:'ScheduleDay',sourceIndex:0,date:'2026-10-06',ordinal:1,shootingDayNumber:1,attributes:{Marker:'one'},strips:[scene('a'),scene('b'),banner('divider'),scene('c'),scene('d'),scene('e')]},
  {kind:'ScheduleDay',sourceIndex:1,date:'2026-10-07',ordinal:2,shootingDayNumber:2,attributes:{Marker:'two'},strips:[scene('f'),scene('g')]},
  {kind:'RemainingScheduledStrips',sourceIndex:2,strips:[]}
],unscheduledGroups:[{kind:'RemainingUnscheduledStrips',strips:[scene('h')]}]}]});
const ids=group=>group.strips.map(item=>item.sourceKey);
const at=(groupIndex,stripIndex,container='scheduledGroups')=>({container,groupIndex,stripIndex});
const move=(project,keys,to)=>moveStrips(project,{boardName:'A',sourceKeys:keys,to});

test('single strip moves up and down with insertion indices from the original order',()=>{
  const project=fixture(),group=project.boards[0].scheduledGroups[0];
  assert.equal(move(project,['d'],at(0,1)),true);
  assert.deepEqual(ids(group),['a','d','b','divider','c','e']);
  assert.equal(move(project,['d'],at(0,6)),true);
  assert.deepEqual(ids(group),['a','b','divider','c','e','d']);
  assert.equal(move(project,['d'],at(0,6)),false);
});

test('contiguous multi-drag keeps the original internal order before and after source',()=>{
  const project=fixture(),group=project.boards[0].scheduledGroups[0];
  assert.equal(move(project,['c','d'],at(0,0)),true);
  assert.deepEqual(ids(group),['c','d','a','b','divider','e']);
  assert.equal(move(project,['d','c'],at(0,6)),true);
  assert.deepEqual(ids(group),['a','b','divider','e','c','d']);
});

test('noncontiguous multi-drag gathers scenes without moving banners or changing scene order',()=>{
  const project=fixture(),group=project.boards[0].scheduledGroups[0];
  assert.equal(move(project,['e','b','d'],at(0,3)),true);
  assert.deepEqual(ids(group),['a','divider','b','d','e','c']);
  assert.equal(new Set(ids(group)).size,6);
});

test('multi-drag across day break and between scheduled and unscheduled groups',()=>{
  const project=fixture(),board=project.boards[0];
  assert.equal(move(project,['g','b','d'],at(1,0)),true);
  assert.deepEqual(ids(board.scheduledGroups[0]),['a','divider','c','e']);
  assert.deepEqual(ids(board.scheduledGroups[1]),['b','d','g','f']);
  assert.equal(move(project,['b','d'],at(0,4)),true);
  assert.deepEqual(ids(board.scheduledGroups[0]),['a','divider','c','e','b','d']);
  assert.equal(move(project,['b','d'],at(0,1,'unscheduledGroups')),true);
  assert.deepEqual(ids(board.unscheduledGroups[0]),['h','b','d']);
});

test('invalid selections and destinations leave the model intact',()=>{
  const project=fixture(),before=structuredClone(project);
  assert.throws(()=>move(project,['b','missing'],at(0,0)));
  assert.throws(()=>move(project,['b','b'],at(0,0)));
  assert.throws(()=>move(project,['b'],at(0,99)));
  assert.deepEqual(project,before);
});

test('banner moves with the same strip command and its metadata intact',()=>{
  const project=fixture(),board=project.boards[0],item=board.scheduledGroups[0].strips[2];
  item.style={fontSize:'12'};
  const before=snapshotBoardOrder(board);
  assert.equal(move(project,['divider'],at(1,1)),true);
  assert.equal(board.scheduledGroups[1].strips[1],item);
  restoreBoardOrder(board,before);
  assert.equal(board.scheduledGroups[0].strips[2],item);
  assert.deepEqual(ids(board.scheduledGroups[1]),['f','g']);
});

test('day break repartitions groups, preserves group identity, and undo restores exact order',()=>{
  const project=fixture(),board=project.boards[0],first=board.scheduledGroups[0],second=board.scheduledGroups[1];
  const before=snapshotBoardOrder(board);
  assert.equal(moveDayBreak(project,{boardName:'A',from:at(0,first.strips.length),to:at(1,1)}),true);
  assert.deepEqual(ids(first),['a','b','divider','c','d','e','f']);
  assert.deepEqual(ids(second),['g']);
  assert.equal(first.attributes.Marker,'one');
  restoreBoardOrder(board,before);
  assert.equal(board.scheduledGroups[0],first);
  assert.equal(board.scheduledGroups[1],second);
  assert.deepEqual(ids(first),['a','b','divider','c','d','e']);
  assert.deepEqual(ids(second),['f','g']);
});

test('day break can cross another day break without losing group metadata',()=>{
  const project=fixture(),board=project.boards[0],first=board.scheduledGroups[0],second=board.scheduledGroups[1];
  assert.equal(moveDayBreak(project,{boardName:'A',from:at(0,first.strips.length),to:at(2,0)}),true);
  assert.equal(board.scheduledGroups[0],second);
  assert.equal(board.scheduledGroups[1],first);
  assert.deepEqual(ids(second),['a','b','divider','c','d','e','f','g']);
  assert.deepEqual(ids(first),[]);
  assert.equal(second.date,'2026-10-06');
  assert.equal(first.date,'2026-10-07');
});

test('a mixed selection of scenes, banner and day break moves as one ordered unit and undoes exactly',()=>{
  const project=fixture(),board=project.boards[0],before=snapshotBoardOrder(board);
  const boundary=dayBreakKey('A',board.scheduledGroups[0]);
  assert.equal(moveBoardItems(project,{boardName:'A',sourceKeys:['f',boundary,'divider','b'],to:at(1,1)}),true);
  assert.deepEqual(ids(board.scheduledGroups[0]),['a','c','d','e','b','divider']);
  assert.deepEqual(ids(board.scheduledGroups[1]),['f','g']);
  assert.equal(board.scheduledGroups[0].attributes.Marker,'one');
  restoreBoardOrder(board,before);
  assert.deepEqual(ids(board.scheduledGroups[0]),['a','b','divider','c','d','e']);
  assert.deepEqual(ids(board.scheduledGroups[1]),['f','g']);
});

test('mixed scenes, banner and day break move into and out of Boneyard, with exact undo/redo',()=>{
  const project=fixture(),board=project.boards[0],boundaryGroup=board.scheduledGroups[0];
  const boundary=dayBreakKey('A',boundaryGroup),before=snapshotBoardOrder(board);
  const command=(keys,to)=>moveBoardItems(project,{boardName:'A',sourceKeys:keys,to});
  assert.equal(command(['divider','b',boundary],at(0,1,'unscheduledGroups')),true);
  assert.deepEqual(ids(board.scheduledGroups[0]),['a','c','d','e','f','g']);
  assert.equal(board.unscheduledGroups[0],boundaryGroup);
  assert.equal(boundaryGroup.kind,'UnscheduledDay');
  assert.equal(dayBreakKey('A',boundaryGroup),boundary);
  assert.deepEqual(ids(boundaryGroup),['h','b','divider']);
  assert.equal(boundaryGroup.attributes.Marker,'one');
  const after=snapshotBoardOrder(board);
  restoreBoardOrder(board,before);
  assert.equal(boundaryGroup.kind,'ScheduleDay');
  assert.deepEqual(ids(boundaryGroup),['a','b','divider','c','d','e']);
  restoreBoardOrder(board,after);
  assert.equal(boundaryGroup.kind,'UnscheduledDay');
  assert.equal(command(['b','divider',boundary],at(0,1)),true);
  assert.equal(boundaryGroup.kind,'ScheduleDay');
  assert.deepEqual(ids(boundaryGroup),['a','b','divider']);
  assert.deepEqual(ids(board.unscheduledGroups[0]),['h']);
  assert.equal(new Set([...board.scheduledGroups,...board.unscheduledGroups].flatMap(ids)).size,9);
});

test('banner alone transfers between Boneyard and schedule without moving a day boundary',()=>{
  const project=fixture(),board=project.boards[0];
  assert.equal(moveBoardItems(project,{boardName:'A',sourceKeys:['divider'],to:at(0,0,'unscheduledGroups')}),true);
  assert.deepEqual(ids(board.unscheduledGroups[0]),['divider','h']);
  assert.equal(moveBoardItems(project,{boardName:'A',sourceKeys:['divider'],to:at(1,0)}),true);
  assert.deepEqual(ids(board.scheduledGroups[1]),['divider','f','g']);
});

test('drag preview reports scene count and eighths as mixed pages',()=>{
  const strips=[scene('a'),scene('b'),scene('c'),scene('d'),banner('divider')];
  const scenes=[{bdsId:'a',pagesEighths:8},{bdsId:'b',pagesEighths:7},
    {bdsId:'c',pagesEighths:6},{bdsId:'d',pagesEighths:8}];
  assert.deepEqual(dragSummary(strips,scenes),{count:4,eighths:29,label:'4 scene · 3 5/8 pag.'});
  assert.equal(dragSummary([scene('b')],scenes).label,'1 scena · 7/8 pag.');
});

test('day boundaries with the same source index in opposite MSD containers have distinct stable keys',()=>{
  const scheduled={kind:'ScheduleDay',sourceIndex:0,sourceContainer:'ScheduledStrips'};
  const yard={kind:'UnscheduledDay',sourceIndex:0,sourceContainer:'UnscheduledStrips'};
  const key=dayBreakKey('A',yard);
  assert.notEqual(dayBreakKey('A',scheduled),key);
  yard.kind='ScheduleDay';assert.equal(dayBreakKey('A',yard),key);
});
