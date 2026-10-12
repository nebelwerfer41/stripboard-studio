import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/calendar.mjs';
import {encodeMmsx,decodeMmsx,cloneExact} from '../assets/mmsx-codec.js';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';
import {moveBoardItems,dayBreakKey,snapshotBoardFamily,restoreBoardFamily} from '../assets/scheduling.js';

const segments=root=>{
 const board=root.contents.stripboard.board;
 return board.segmentMap||Object.fromEntries(board.segments.map(s=>[s.id,s]));
};
const strips=segment=>segment.stripMap||Object.fromEntries(segment.strips.map(s=>[s.id,s]));
const save=async project=>decodeMmsx(await serializeMmsx(project,'edited.mmsx'));

for(const format of ['5','3','hybrid']){
 test(`format ${format}: Boneyard edits preserve existing dates, day numbers and opaque metadata`,async()=>{
  const root=fixture(format),yard=segments(root).yard,records=strips(yard);
  Object.assign(records.locked,{beforeShootDay:2,eighths:17,opaque:{keep:true}});
  const banner={type:'banner',text:'Already in Boneyard',date:'20261002',shootDay:2,beforeShootDay:3,opaque:{keep:'banner'}};
  if(yard.stripMap)yard.stripMap.existing={...banner,sortOrder:1};else yard.strips.push({...banner,id:'existing'});
  const original=cloneExact(root),originals=segments(original),bytes=await encodeMmsx(root),p=await parseMmsx(bytes),board=p.boards[0];
  const before=snapshotBoardFamily(p,board.name),scene=board.scheduledGroups[0].strips.find(s=>s.kind==='scene'),id=JSON.parse(scene.sourceKey)[2];
  assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[scene.sourceKey],to:{container:'unscheduledGroups',groupIndex:1,stripIndex:0}}));
  const out=await save(p),saved=segments(out),savedYard=strips(saved.yard);
  assert.deepEqual(savedYard.locked,strips(originals.yard).locked);
  assert.deepEqual({...savedYard.existing,sortOrder:undefined},{...strips(originals.yard).existing,sortOrder:undefined});
  for(const field of ['date','shootDay','beforeShootDay'])assert(!Object.hasOwn(savedYard[id],field),`newly unscheduled scene: ${field}`);
  assert.deepEqual(saved.b,originals.b);
  assert.deepEqual(out.contents.breakdown,original.contents.breakdown);
  assert.deepEqual(out.contents.element,original.contents.element);
  assert.deepEqual(saved.yard.calendar,originals.yard.calendar);
  if(format==='hybrid'){
   assert.deepEqual(out.contents.stripboard.board.segments,original.contents.stripboard.board.segments);
   assert.deepEqual(saved.yard.strips,originals.yard.strips);
  }
  const reopened=await parseMmsx(await serializeMmsx(p,'edited.mmsx'));
  assert.equal(reopened.boards[0].unscheduledGroups[0].date,'2026-10-01');
  assert.equal(reopened.boards[0].unscheduledGroups[0].shootingDayNumber,1);
  const redo=snapshotBoardFamily(p,board.name);
  restoreBoardFamily(p,before);assert.deepEqual(await serializeMmsx(p,'undo.mmsx'),bytes);
  restoreBoardFamily(p,redo);assert.deepEqual(await save(p),out);
 });

 test(`format ${format}: transfers update scheduling fields and changed day totals`,async()=>{
  const root=fixture(format),records=strips(segments(root).yard);
  Object.assign(records.locked,{beforeShootDay:2,eighths:17});
  const p=await parseMmsx(await encodeMmsx(root)),board=p.boards[0],scene=board.scheduledGroups[0].strips.find(s=>s.kind==='scene'),id=JSON.parse(scene.sourceKey)[2];
  assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[scene.sourceKey],to:{container:'unscheduledGroups',groupIndex:0,stripIndex:0}}));
  let out=segments(await save(p));
  assert.equal(strips(out.yard).locked.date,records.locked.date);
  assert.equal(strips(out.yard).locked.beforeShootDay,2);
  assert.equal(strips(out.yard).locked.eighths,8);
  assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[scene.sourceKey],to:{container:'scheduledGroups',groupIndex:1,stripIndex:0}}));
  out=segments(await save(p));
  assert.equal(strips(out.a)[id].date,'20261007');
  assert.equal(strips(out.a)[id].shootDay,5);
  const boundary=board.scheduledGroups.find(g=>g.kind==='ScheduleDay');
  const boundaryId=JSON.parse(boundary.mmsxDay)[2];
  assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[dayBreakKey(board.name,boundary)],to:{container:'unscheduledGroups',groupIndex:1,stripIndex:0}}));
  out=segments(await save(p));
  for(const field of ['date','shootDay','beforeShootDay'])assert(!Object.hasOwn(strips(out.yard)[boundaryId],field),`newly unscheduled day: ${field}`);
  assert.equal(strips(out.yard).locked.date,records.locked.date);
 });
}
