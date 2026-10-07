import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {decodeMmsx,encodeMmsx,parseExact,stringifyExact,decryptMmsx,encryptMmsx} from '../assets/mmsx-codec.js';
import {parseMmsx,serializeMmsx,updatedMmsxRoot} from '../assets/mmsx-project.js';
import {moveBoardItems,moveStrip,createStripboard,dayBreakKey,snapshotBoardOrder,restoreBoardOrder} from '../assets/scheduling.js';
import {mmsxFixture} from './fixtures/mmsx.mjs';
const bytes=process.argv[2]?await readFile(process.argv[2]):await encodeMmsx(mmsxFixture);const ab=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const root=await decodeMmsx(ab);assert.equal(root.dataFormat,5);
const payload=decryptMmsx(ab);assert.deepEqual(encryptMmsx(payload,bytes.slice(4,12)),new Uint8Array(ab));
const exact='{"large":900719925474099312345,"decimal":0.123456789012345678901,"tiny":1e-900,"negativeZero":-0,"__proto__":{"x":1}}';
assert.equal(stringifyExact(parseExact(exact)),exact);assert.equal({}.x,undefined);
assert.throws(()=>parseExact('{"a":1,"a":2}'));
const p=await parseMmsx(ab,'plan.mmsx');assert(p.scenes.length>0);assert.deepEqual(updatedMmsxRoot(p),root);
const board=p.boards.find(b=>b.scheduledGroups.filter(g=>g.kind==='ScheduleDay').length>1&&b.unscheduledGroups.length);
const before=snapshotBoardOrder(board),sourceIndex=board.scheduledGroups.findIndex(g=>g.strips.some(x=>x.kind==='scene'));
const scene=board.scheduledGroups[sourceIndex].strips.find(s=>s.kind==='scene');
assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[scene.sourceKey],to:{container:'unscheduledGroups',groupIndex:0,stripIndex:0}}));
let edited=updatedMmsxRoot(p);const [,originalSegment,stripID]=JSON.parse(scene.sourceKey);
const yardID=board.unscheduledGroups[0].mmsxSegment;
assert(!edited.contents.stripboard[board.mmsxBoard].segmentMap[originalSegment].stripMap[stripID]);
assert.equal(edited.contents.stripboard[board.mmsxBoard].segmentMap[yardID].stripMap[stripID].date,undefined);
assert.deepEqual(edited.contents.breakdown,root.contents.breakdown);
assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[scene.sourceKey],to:{container:'scheduledGroups',groupIndex:1,stripIndex:0}}));
edited=updatedMmsxRoot(p);assert.equal(edited.contents.stripboard[board.mmsxBoard].segmentMap[originalSegment].stripMap[stripID].date,board.scheduledGroups[1].date.replaceAll('-',''));
const exported=await serializeMmsx(p,'local-copy.mmsx'),round=await decodeMmsx(exported.buffer);
assert.deepEqual(round.contents,edited.contents);assert.equal(round.id,root.id);assert.equal(round.fileName,root.fileName);
const copy=await decodeMmsx(await serializeMmsx(p,'copy.mmsx',{copy:true}));assert.notEqual(copy.id,root.id);assert(!('fileName' in copy));
const reopened=await parseMmsx(exported.buffer,'local-copy.mmsx');assert.equal(reopened.scenes.length,p.scenes.length);
restoreBoardOrder(board,before);assert.deepEqual(updatedMmsxRoot(p),root);
// A Boneyard is shared by the sub-boards of the same original MMSX board.
const siblings=p.boards.filter(b=>p.boards.some(o=>o!==b&&o.mmsxBoard===b.mmsxBoard));
if(siblings.length>=2){
 const a=siblings.find(b=>b.scheduledGroups.some(g=>g.strips.some(s=>s.kind==='scene'))),b=siblings.find(b=>b!==a);
 const backups=[snapshotBoardOrder(a),snapshotBoardOrder(b)];
 const strip=a.scheduledGroups.flatMap(g=>g.strips).find(s=>s.kind==='scene');
 moveBoardItems(p,{boardName:a.name,sourceKeys:[strip.sourceKey],to:{container:'unscheduledGroups',groupIndex:0,stripIndex:0}});
 assert.equal(b.unscheduledGroups[0].strips[0].sourceKey,strip.sourceKey);
 moveBoardItems(p,{boardName:b.name,sourceKeys:[strip.sourceKey],to:{container:'scheduledGroups',groupIndex:0,stripIndex:0}});
 const changed=updatedMmsxRoot(p),id=JSON.parse(strip.sourceKey)[2];
 assert(changed.contents.stripboard[b.mmsxBoard].segmentMap[b.mmsxSegment].stripMap[id]);
 restoreBoardOrder(a,backups[0]);restoreBoardOrder(b,backups[1]);assert.deepEqual(updatedMmsxRoot(p),root);
}
const group=board.scheduledGroups.find(g=>g.kind==='ScheduleDay');

moveBoardItems(p,{boardName:board.name,sourceKeys:[dayBreakKey(board.name,group)],to:{container:'scheduledGroups',groupIndex:1,stripIndex:1}});
const dayEdited=updatedMmsxRoot(p);assert.deepEqual(dayEdited.contents.breakdown,root.contents.breakdown);
// Undo/redo also preserve MMSX day identities and stored day numbers.
const afterDayMove=snapshotBoardOrder(board);
restoreBoardOrder(board,before);assert.deepEqual(updatedMmsxRoot(p),root);
restoreBoardOrder(board,afterDayMove);
assert.deepEqual(updatedMmsxRoot(p),dayEdited);
restoreBoardOrder(board,before);
assert.throws(()=>createStripboard(p,{name:'Copy',sourceBoardName:board.name}),/MMSX/);
const banner=board.scheduledGroups.flatMap(g=>g.strips).find(strip=>strip.kind==='banner');
if(banner){
 const backup=snapshotBoardOrder(board),id=JSON.parse(banner.sourceKey)[2];
 assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[banner.sourceKey],to:{container:'unscheduledGroups',groupIndex:0,stripIndex:0}}));
 let moved=updatedMmsxRoot(p);
 assert.equal(moved.contents.stripboard[board.mmsxBoard].segmentMap[yardID].stripMap[id].text,banner.text);
 const reopened=await parseMmsx((await serializeMmsx(p,'banner-yard.mmsx')).buffer);
 assert(reopened.boards[0].unscheduledGroups.flatMap(g=>g.strips).some(s=>s.kind==='banner'&&s.text===banner.text));
 assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[banner.sourceKey],to:{container:'scheduledGroups',groupIndex:0,stripIndex:0}}));
 moved=updatedMmsxRoot(p);
 assert.equal(moved.contents.stripboard[board.mmsxBoard].segmentMap[board.mmsxSegment].stripMap[id].text,banner.text);
 restoreBoardOrder(board,backup);assert.deepEqual(updatedMmsxRoot(p),root);
}
// Scheduled and original Boneyard day breaks are both movable, including across sub-boards.
const yardBreak=board.unscheduledGroups.find(g=>g.kind==='UnscheduledDay');
if(yardBreak){
 const key=dayBreakKey(board.name,yardBreak),backup=snapshotBoardOrder(board);
 const originID=JSON.parse(yardBreak.mmsxDay)[2];
 assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[key],to:{container:'scheduledGroups',groupIndex:0,stripIndex:0}}));
 let moved=updatedMmsxRoot(p);
 assert.equal(moved.contents.stripboard[board.mmsxBoard].segmentMap[board.mmsxSegment].stripMap[originID].type,'day');
 assert(!moved.contents.stripboard[board.mmsxBoard].segmentMap[yardID].stripMap[originID]);
 const serialized=await serializeMmsx(p,'day-from-yard.mmsx');
 const reimported=await parseMmsx(serialized.buffer);
 assert(reimported.boards.find(b=>b.mmsxSegment===board.mmsxSegment).scheduledGroups.some(g=>JSON.parse(g.mmsxDay||'[]')[2]===originID));
 const redo=snapshotBoardOrder(board);
 restoreBoardOrder(board,backup);assert.deepEqual(updatedMmsxRoot(p),root);
 restoreBoardOrder(board,redo);assert.deepEqual(updatedMmsxRoot(p),moved);
 assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[key],to:{container:'unscheduledGroups',groupIndex:0,stripIndex:0}}));
 moved=updatedMmsxRoot(p);
 assert.equal(moved.contents.stripboard[board.mmsxBoard].segmentMap[yardID].stripMap[originID].type,'day');
 restoreBoardOrder(board,backup);assert.deepEqual(updatedMmsxRoot(p),root);
}
const scheduledBreak=board.scheduledGroups.find(g=>g.kind==='ScheduleDay');
const dayID=JSON.parse(scheduledBreak.mmsxDay)[2];
assert(moveBoardItems(p,{boardName:board.name,sourceKeys:[dayBreakKey(board.name,scheduledBreak)],to:{container:'unscheduledGroups',groupIndex:0,stripIndex:0}}));
const toYard=updatedMmsxRoot(p);
assert.equal(toYard.contents.stripboard[board.mmsxBoard].segmentMap[yardID].stripMap[dayID].type,'day');
assert(!toYard.contents.stripboard[board.mmsxBoard].segmentMap[board.mmsxSegment].stripMap[dayID]);
const yardRound=await parseMmsx((await serializeMmsx(p,'day-to-yard.mmsx')).buffer);
assert(yardRound.boards[0].unscheduledGroups.some(g=>JSON.parse(g.mmsxDay||'[]')[2]===dayID));
restoreBoardOrder(board,before);assert.deepEqual(updatedMmsxRoot(p),root);
if(siblings.length>=2){
 const a=siblings[0],b=siblings[1],backupA=snapshotBoardOrder(a),backupB=snapshotBoardOrder(b);
 const group=a.scheduledGroups.find(g=>g.kind==='ScheduleDay'),id=JSON.parse(group.mmsxDay)[2];
 moveBoardItems(p,{boardName:a.name,sourceKeys:[dayBreakKey(a.name,group)],to:{container:'unscheduledGroups',groupIndex:0,stripIndex:0}});
 assert(b.unscheduledGroups.includes(group));
 moveBoardItems(p,{boardName:b.name,sourceKeys:[dayBreakKey(b.name,group)],to:{container:'scheduledGroups',groupIndex:0,stripIndex:0}});
 const moved=updatedMmsxRoot(p);
 assert(!moved.contents.stripboard[a.mmsxBoard].segmentMap[a.mmsxSegment].stripMap[id]);
 assert.equal(moved.contents.stripboard[b.mmsxBoard].segmentMap[b.mmsxSegment].stripMap[id].type,'day');
 restoreBoardOrder(a,backupA);restoreBoardOrder(b,backupB);assert.deepEqual(updatedMmsxRoot(p),root);
}
// Both container signatures are accepted.
const alternate=bytes.slice();alternate.set(new TextEncoder().encode('MMSX'));
assert.deepEqual(await decodeMmsx(alternate),root);
// Refuse export when any strip is duplicated; retain the source object.
board.scheduledGroups[0].strips.push(scene);assert.throws(()=>updatedMmsxRoot(p));
restoreBoardOrder(board,before);assert.deepEqual(updatedMmsxRoot(p),root);
for(const n of [0,4,18,bytes.length-1])await assert.rejects(()=>decodeMmsx(ab.slice(0,n)));
const bad=structuredClone(root);bad.dataFormat=999;await assert.rejects(async()=>parseMmsx((await encodeMmsx(bad)).buffer));
if(process.argv[3])await writeFile(process.argv[3],exported);
console.log(`PASS: MMSX codec, exact numbers, ${p.scenes.length} scenes, ${p.boards.length} sub-boards, Boneyard, move, undo, export/reimport, malformed files.`);
