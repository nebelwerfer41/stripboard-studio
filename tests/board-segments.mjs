import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mmsxFixture} from './fixtures/mmsx.mjs';
import {cloneExact,encodeMmsx,decodeMmsx} from '../assets/mmsx-codec.js';
import {parseMmsx,serializeMmsx,updatedMmsxRoot} from '../assets/mmsx-project.js';
import {boardGroups,entriesForBoard} from '../assets/board-segments.js';
import {moveBoardItems,dayBreakKey,snapshotBoardFamily,restoreBoardFamily} from '../assets/scheduling.js';
function fixture(){
 const r=cloneExact(mmsxFixture),c=r.contents;
 for(let i=1;i<=4;i++)c.breakdown.main.sheetMap['s'+i]={...cloneExact(c.breakdown.main.sheetMap.s1),scenes:String(i),sortOrder:i};
 const banner=(text,sortOrder)=>({type:'banner',text,sortOrder,opaque:{retained:true}});
 const scene=(sheet,sortOrder)=>({type:'breakdown',sheet,sortOrder,opaque:{retained:true}});
 c.stripboard.board.segmentMap={
  a:{type:'normal',name:'Default',sortOrder:0,stripMap:{beginA:banner('Begin A',0),sA:scene('s1',1),endA:banner('End A',2)}},
  yard:{type:'boneyard',name:'Boneyard',sortOrder:1,stripMap:{beginY:banner('Begin Y',0),sY:scene('s3',1),dayY:{type:'day',sortOrder:2,opaque:'boundary'},sY2:scene('s4',3),endY:banner('End Y',4)}},
  b:{type:'normal',name:'Sub-board 2',sortOrder:2,stripMap:{beginB:banner('Begin B',0),sB:scene('s2',1),endB:banner('End B',2)}}
 };
 return cloneExact(r);
}
const parse=async root=>parseMmsx(await encodeMmsx(root),'segments.mmsx');
const keys=(p,name)=>entriesForBoard(p,name).flatMap(({board,group})=>[...group.strips.map(s=>s.sourceKey),...(group.mmsxDay?[dayBreakKey(board.name,group)]:[])]);
const position=(board,container='scheduledGroups',groupIndex=0,stripIndex=0)=>({boardName:board.name,container,groupIndex,stripIndex});
test('one parent, three native segments, one shared Boneyard and independent visibility',async()=>{
 const p=await parse(fixture()),[a,b]=p.boards,[parent]=boardGroups(p);
 assert.equal(boardGroups(p).length,1);assert.equal(parent.name,'Piano');assert.deepEqual(parent.segments.map(s=>s.name),['Default','Sub-board 2','Boneyard']);
 assert.equal(a.unscheduledGroups,b.unscheduledGroups);
 const ids=keys(p,a.name);assert.equal(ids.length,11);assert.equal(new Set(ids).size,11);
 assert.deepEqual(entriesForBoard(p,a.name,new Set(['a','b'])).flatMap(e=>e.group.strips).filter(s=>s.kind==='scene').map(s=>s.bdsId),['s1','s2']);
 assert.deepEqual(entriesForBoard(p,a.name,new Set(['yard'])).flatMap(e=>e.group.strips).filter(s=>s.kind==='scene').map(s=>s.bdsId),['s3','s4']);
 assert.equal(entriesForBoard(p,a.name,new Set()).length,0);assert.deepEqual(updatedMmsxRoot(p),fixture());
});
test('direct normal-to-normal strip move updates one partition and undo/redo restores all segments',async()=>{
 const root=fixture(),bytes=await encodeMmsx(root),p=await parseMmsx(bytes),[a,b]=p.boards,before=snapshotBoardFamily(p,a.name);
 const strip=a.scheduledGroups[0].strips.find(s=>s.kind==='scene');
 assert(moveBoardItems(p,{boardName:a.name,sourceKeys:[strip.sourceKey],to:position(b,'scheduledGroups',0,1)}));
 assert(!a.scheduledGroups[0].strips.includes(strip));assert(b.scheduledGroups[0].strips.includes(strip));
 const out=updatedMmsxRoot(p);assert(!out.contents.stripboard.board.segmentMap.a.stripMap.sA);assert(out.contents.stripboard.board.segmentMap.b.stripMap.sA);
 assert.deepEqual(out.contents.breakdown,root.contents.breakdown);assert.deepEqual(out.contents.element,root.contents.element);
 const saved=await serializeMmsx(p,'changed.mmsx'),reopened=await parseMmsx(saved),redo=snapshotBoardFamily(p,a.name);
 assert.equal(keys(reopened,reopened.boards[0].name).length,11);
 restoreBoardFamily(p,before);assert.deepEqual(await serializeMmsx(p,'undo.mmsx'),bytes);
 restoreBoardFamily(p,redo);assert.deepEqual(await decodeMmsx(await serializeMmsx(p,'redo.mmsx')),out);
});
test('mixed selections can originate in both normal segments and the shared Boneyard',async()=>{
 const p=await parse(fixture()),[a,b]=p.boards;
 const sourceKeys=[a.scheduledGroups[0].strips[1].sourceKey,b.scheduledGroups[0].strips[1].sourceKey,a.unscheduledGroups[0].strips[1].sourceKey];
 assert(moveBoardItems(p,{boardName:b.name,sourceKeys,to:position(b,'scheduledGroups',0,0)}));
 assert.equal(b.scheduledGroups[0].strips.filter(s=>sourceKeys.includes(s.sourceKey)).length,3);
 assert.deepEqual(b.scheduledGroups[0].strips.slice(0,3).map(s=>s.sourceKey),sourceKeys);
 const ids=keys(p,a.name);assert.equal(new Set(ids).size,11);assert.equal(ids.length,11);assert.doesNotThrow(()=>updatedMmsxRoot(p));
});
test('native undated day boundary can move from Boneyard into another normal segment and retain identity',async()=>{
 const p=await parse(fixture()),[a,b]=p.boards,before=snapshotBoardFamily(p,a.name),group=a.unscheduledGroups[0],key=dayBreakKey(a.name,group);
 assert(moveBoardItems(p,{boardName:a.name,sourceKeys:[key],to:position(b,'scheduledGroups',0,1)}));
 assert(b.scheduledGroups.includes(group));assert.equal(group.mmsxSegment,'b');assert.equal(dayBreakKey(b.name,group),key);
 const out=updatedMmsxRoot(p);assert.equal(out.contents.stripboard.board.segmentMap.b.stripMap.dayY.date,undefined);
 assert.equal(out.contents.stripboard.board.segmentMap.b.stripMap.dayY.shootDay,undefined);assert.equal(out.contents.stripboard.board.segmentMap.b.stripMap.dayY.opaque,'boundary');
 const reopened=await parseMmsx(await serializeMmsx(p,'undated.mmsx'));assert(reopened.boards.find(plan=>plan.mmsxSegment==='b').scheduledGroups.some(g=>JSON.parse(g.mmsxDay||'[]')[2]===JSON.parse(group.mmsxDay)[2]));
 restoreBoardFamily(p,before);assert.deepEqual(updatedMmsxRoot(p),fixture());
});
test('mixed scenes, banner and an undated boundary cross segments in visible order',async()=>{
 const p=await parse(fixture()),[a,b]=p.boards,before=snapshotBoardFamily(p,a.name),boundary=a.unscheduledGroups[0];
 const sourceKeys=[a.scheduledGroups[0].strips[1].sourceKey,a.unscheduledGroups[0].strips[1].sourceKey,dayBreakKey(a.name,boundary),b.scheduledGroups[0].strips[0].sourceKey];
 moveBoardItems(p,{boardName:a.name,sourceKeys,to:position(b,'scheduledGroups',0,0)});
 assert(b.scheduledGroups.includes(boundary));assert.equal(boundary.mmsxSegment,'b');
 assert.deepEqual(boundary.strips.map(s=>s.sourceKey),[sourceKeys[0],sourceKeys[3],sourceKeys[1]]);
 assert.equal(keys(p,a.name).length,11);assert.equal(new Set(keys(p,a.name)).size,11);assert.doesNotThrow(()=>updatedMmsxRoot(p));
 restoreBoardFamily(p,before);assert.deepEqual(updatedMmsxRoot(p),fixture());
});
for(const format of ['3','hybrid'])test(`format ${format}: cross-segment editing preserves schema, shared yard and no-op bytes`,async()=>{
 const root=fixture();root.dataFormat=3;
 const ordered=map=>Object.entries(map).sort((a,b)=>(a[1].sortOrder||0)-(b[1].sortOrder||0)).map(([id,value])=>{const record={...value,id};delete record.sortOrder;return record});
 for(const breakdown of Object.values(root.contents.breakdown)){
  breakdown.sheets=format==='hybrid'?[{id:'warning',comments:'compatibility placeholder'}]:ordered(breakdown.sheetMap);
  if(format==='3')delete breakdown.sheetMap;
 }
 for(const board of Object.values(root.contents.stripboard)){
  board.segments=ordered(board.segmentMap);
  for(const segment of board.segments){segment.strips=format==='hybrid'?[{id:'warning',type:'banner',text:'compatibility placeholder'}]:ordered(segment.stripMap);delete segment.stripMap}
  if(format==='3')delete board.segmentMap;
 }
 const bytes=await encodeMmsx(root),p=await parseMmsx(bytes),[a,b]=p.boards,before=snapshotBoardFamily(p,a.name);
 assert.equal(boardGroups(p)[0].segments.length,3);assert.deepEqual(await serializeMmsx(p,'no-op.mmsx'),bytes);
 const strip=a.scheduledGroups[0].strips.find(s=>s.kind==='scene');moveBoardItems(p,{boardName:a.name,sourceKeys:[strip.sourceKey],to:position(b)});
 const out=await decodeMmsx(await serializeMmsx(p,'changed.mmsx'));assert.equal(out.dataFormat,3);
 const round=await parseMmsx(await encodeMmsx(out));assert.equal(boardGroups(round)[0].segments.length,3);assert.equal(keys(round,round.boards[0].name).length,11);
 if(format==='hybrid')assert.deepEqual(out.contents.stripboard.board.segments,cloneExact(root).contents.stripboard.board.segments);
 else assert(!Object.hasOwn(out.contents.stripboard.board,'segmentMap'));
 restoreBoardFamily(p,before);assert.deepEqual(await serializeMmsx(p,'undo.mmsx'),bytes);
});
test('stored dates remain segment-specific and calendar data is untouched during cross-segment editing',async()=>{
 const root=cloneExact(mmsxFixture);
 for(const [sid,s] of Object.entries(root.contents.stripboard.board.segmentMap)){
  s.calendar={prodStart:sid==='b'?'20271008':'20261006',daysOff:sid==='b'?1:96,eventMap:{opaque:{eventName:'Test',startDate:'20261006',endDate:'20261006',elements:[]}}};
  if(sid==='b')for(const r of Object.values(s.stripMap))if(r.date)r.date=r.sortOrder<=1?'20271008':'20271011';
 }
 const p=await parse(root),[a,b]=p.boards,before=snapshotBoardFamily(p,a.name),bDates=b.scheduledGroups.map(g=>g.date);
 const boundary=a.scheduledGroups[0],key=dayBreakKey(a.name,boundary),bMeta=b.scheduledGroups.map(g=>[g.ordinal,g.date,g.shootingDayNumber,g.calendarId]);
 moveBoardItems(p,{boardName:a.name,sourceKeys:[key],to:position(a,'unscheduledGroups',0,0)});
 assert.deepEqual(b.scheduledGroups.map(g=>[g.ordinal,g.date,g.shootingDayNumber,g.calendarId]),bMeta);restoreBoardFamily(p,before);
 moveBoardItems(p,{boardName:a.name,sourceKeys:[key],to:position(b,'scheduledGroups',1,0)});
 assert.equal(b.scheduledGroups[0].date,bDates[0]);assert.equal(boundary.calendarId,b.calendarId);
 const out=updatedMmsxRoot(p);for(const [id,s] of Object.entries(root.contents.stripboard.board.segmentMap))assert.deepEqual(out.contents.stripboard.board.segmentMap[id].calendar,cloneExact(s.calendar));
 restoreBoardFamily(p,before);assert.deepEqual(updatedMmsxRoot(p),cloneExact(root));
});
test('moving across different parent boards fails without mutations',async()=>{
 const root=fixture();root.contents.stripboard.other=cloneExact(root.contents.stripboard.board);root.contents.stripboard.other.name='Other';
 const p=await parse(root),a=p.boards[0],other=p.boards.find(b=>b.parentBoardId==='other');
 assert.throws(()=>moveBoardItems(p,{boardName:a.name,sourceKeys:[a.scheduledGroups[0].strips[0].sourceKey],to:position(other)}),/board corrente/);
 assert.deepEqual(updatedMmsxRoot(p),cloneExact(root));
});
if(process.argv[2])test('PURGED real file: one board, three sub-boards, four scenes, exact no-op and direct transfer',async()=>{
 const bytes=await readFile(process.argv[2]),p=await parseMmsx(bytes,'PURGED.mmsx'),[parent]=boardGroups(p),[a,b]=p.boards;
 assert.equal(boardGroups(p).length,1);assert.equal(parent.name,'Default');assert.deepEqual(new Set(parent.segments.map(s=>s.name)),new Set(['Default','Sub-board 2','Boneyard']));
 const visible=entriesForBoard(p,a.name),scenes=visible.flatMap(e=>e.group.strips).filter(s=>s.kind==='scene');
 assert.equal(scenes.length,4);assert.equal(new Set(scenes.map(s=>s.bdsId)).size,4);assert.equal(new Set(keys(p,a.name)).size,keys(p,a.name).length);
 assert.deepEqual(await serializeMmsx(p,'purged.mmsx'),new Uint8Array(bytes));
 const before=snapshotBoardFamily(p,a.name),strip=a.scheduledGroups[0].strips.find(s=>s.kind==='scene');
 moveBoardItems(p,{boardName:a.name,sourceKeys:[strip.sourceKey],to:position(b)});
 const saved=await serializeMmsx(p,'purged-edited.mmsx'),round=await parseMmsx(saved);assert.equal(boardGroups(round)[0].segments.length,3);assert.equal(entriesForBoard(round,round.boards[0].name).flatMap(e=>e.group.strips).filter(s=>s.kind==='scene').length,4);
 restoreBoardFamily(p,before);assert.deepEqual(await serializeMmsx(p,'purged-undo.mmsx'),new Uint8Array(bytes));
});
