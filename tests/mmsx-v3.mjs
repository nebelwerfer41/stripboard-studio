import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeMmsx,decodeMmsx,cloneExact} from '../assets/mmsx-codec.js';
import {parseMmsx,updatedMmsxRoot,serializeMmsx} from '../assets/mmsx-project.js';
import {moveBoardItems,snapshotBoardOrder,restoreBoardOrder} from '../assets/scheduling.js';
import {mmsxFixture} from './fixtures/mmsx.mjs';

function fixture(){
 const root=cloneExact(mmsxFixture);root.dataFormat=3;
 const ordered=map=>Object.entries(map).sort((a,b)=>a[1].sortOrder-b[1].sortOrder).map(([id,record])=>{const copy={...record,id};delete copy.sortOrder;return copy});
 for(const b of Object.values(root.contents.breakdown)){b.sheets=ordered(b.sheetMap);delete b.sheetMap}
 for(const b of Object.values(root.contents.stripboard)){
  b.segments=ordered(b.segmentMap);delete b.segmentMap;
  for(const s of b.segments){s.strips=ordered(s.stripMap);delete s.stripMap}
 }
 root.contents.layout={opaque:{preserved:true}};return cloneExact(root);
}
test('format 3 preserves array order, identities and all source data without edits',async()=>{
 const root=fixture(),p=await parseMmsx(await encodeMmsx(root),'test.mmsx');
 assert.equal(p.scenes.length,2);assert.equal(p.boards.length,2);
 assert.deepEqual(updatedMmsxRoot(p),root);
 assert.equal(p.boards[0].scheduledGroups[0].strips[0].bdsId,'s1');
});
test('format 3 move, export/reimport and undo retain the original array schema',async()=>{
 const root=fixture(),p=await parseMmsx(await encodeMmsx(root),'test.mmsx'),b=p.boards[0],before=snapshotBoardOrder(b);
 const strip=b.scheduledGroups[0].strips[0];
 moveBoardItems(p,{boardName:b.name,sourceKeys:[strip.sourceKey],to:{container:'unscheduledGroups',groupIndex:0,stripIndex:0}});
 const changed=updatedMmsxRoot(p);
 assert.equal(changed.dataFormat,3);assert.deepEqual(changed.contents.breakdown,root.contents.breakdown);assert.deepEqual(changed.contents.layout,root.contents.layout);
 const segments=Object.values(changed.contents.stripboard)[0].segments;
 assert(!segments[0].strips.some(s=>s.id===JSON.parse(strip.sourceKey)[2]));
 assert(segments.find(s=>s.type==='boneyard').strips.some(s=>s.id===JSON.parse(strip.sourceKey)[2]));
 assert(segments.flatMap(s=>s.strips).every(s=>!Object.hasOwn(s,'sortOrder')));
 const out=await serializeMmsx(p,'copy.mmsx');assert.deepEqual((await decodeMmsx(out)).contents,changed.contents);
 const reopened=await parseMmsx(out,'copy.mmsx');assert.equal(reopened.scenes.length,2);
 restoreBoardOrder(b,before);assert.deepEqual(updatedMmsxRoot(p),root);
});
test('format 3 rejects duplicate array IDs instead of losing records',async()=>{
 const root=fixture();root.contents.breakdown.main.sheets.push(root.contents.breakdown.main.sheets[0]);
 await assert.rejects(()=>parseMmsxBytes(root),/duplicato/);
});
async function parseMmsxBytes(root){return parseMmsx(await encodeMmsx(root))}

test('hybrid format 3 uses complete maps and preserves legacy warning placeholders on export',async()=>{
 const root=cloneExact(mmsxFixture);root.dataFormat=3;
 for(const b of Object.values(root.contents.breakdown))b.sheets=[{id:'placeholder',comments:'This schedule requires MMS 10.10'}];
 for(const b of Object.values(root.contents.stripboard)){
  b.segments=Object.entries(b.segmentMap).map(([id,s])=>({id,type:s.type,strips:[{id:'warning',type:'banner',text:'This schedule requires MMS 10.10 or newer'}]}));
  for(const s of Object.values(b.segmentMap))s.strips=[{id:'warning',type:'banner',text:'This schedule requires MMS 10.10 or newer'}];
 }
 const original=cloneExact(root),p=await parseMmsx(await encodeMmsx(root),'hybrid.mmsx');
 assert.equal(p.scenes.length,2);assert.deepEqual(updatedMmsxRoot(p),original);
 const b=p.boards[0],strip=b.scheduledGroups[0].strips[0],before=snapshotBoardOrder(b);
 moveBoardItems(p,{boardName:b.name,sourceKeys:[strip.sourceKey],to:{container:'unscheduledGroups',groupIndex:0,stripIndex:0}});
 const changed=updatedMmsxRoot(p),bid=b.mmsxBoard,sid=b.mmsxSegment,id=JSON.parse(strip.sourceKey)[2];
 assert(!Object.hasOwn(changed.contents.stripboard[bid].segmentMap[sid].stripMap,id));
 assert.deepEqual(changed.contents.stripboard[bid].segments,original.contents.stripboard[bid].segments);
 assert.deepEqual(changed.contents.stripboard[bid].segmentMap[sid].strips,original.contents.stripboard[bid].segmentMap[sid].strips);
 assert.deepEqual(changed.contents.breakdown,original.contents.breakdown);
 const out=await serializeMmsx(p,'hybrid-copy.mmsx');assert.deepEqual((await decodeMmsx(out)).contents,changed.contents);
 assert.equal((await parseMmsx(out)).scenes.length,2);
 restoreBoardOrder(b,before);assert.deepEqual(updatedMmsxRoot(p),original);
});
