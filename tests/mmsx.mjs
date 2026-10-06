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
assert.deepEqual(round.contents,edited.contents);assert.notEqual(round.id,root.id);assert(!('fileName' in round));
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
const locked=board.unscheduledGroups.flatMap((g,groupIndex)=>g.strips.map((strip,stripIndex)=>({strip,groupIndex,stripIndex}))).find(x=>x.strip.mmsxLocked);
if(locked){
 const to={container:'scheduledGroups',groupIndex:0,stripIndex:0};
 assert.throws(()=>moveBoardItems(p,{boardName:board.name,sourceKeys:[locked.strip.sourceKey],to}),/non sono spostabili/);
 assert.throws(()=>moveStrip(p,{boardName:board.name,from:{container:'unscheduledGroups',groupIndex:locked.groupIndex,stripIndex:locked.stripIndex},to}),/non sono spostabili/);
 assert.deepEqual(updatedMmsxRoot(p),root);
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
