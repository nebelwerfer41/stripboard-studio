import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {mmsxFixture} from './fixtures/mmsx.mjs';
import {cloneExact,encodeMmsx,decodeMmsx,stringifyExact} from '../assets/mmsx-codec.js';
import {parseMmsx,serializeMmsx,updatedMmsxRoot} from '../assets/mmsx-project.js';
import {calendarDate,selectedCalendar,boardWithCalendar,eventsOnDate,redFlagsOnDate,redFlagsForStrip,getCalendarDate,outsideCalendarActivity,intervalOverlaps} from '../assets/production-data.js';
import {moveBoardItems,snapshotBoardOrder,restoreBoardOrder} from '../assets/scheduling.js';
const parse=async root=>parseMmsx(await encodeMmsx(root),'test.mmsx');
function fixture(){
 const r=cloneExact(mmsxFixture),c=r.contents;
 c.element.generic={name:'',category_id:''};c.element.actor.name='40 persone';c.element.actor.properties={rate:17};
 c.breakdown.main.sheetMap.s1.elements.actor=40;c.breakdown.main.sheetMap.s2.scenes='1';
 for(const [id,s] of Object.entries(c.stripboard.board.segmentMap))s.calendar={prodStart:'20261005',daysOff:id==='a'?96:1,specialDays:{'20261006':'holiday','20261010':'workday','20261012':'offday','20261013':'travel','20261014':'unknown'},eventMap:{},opaque:9007199254740991};
 c.stripboard.board.segmentMap.a.calendar.eventMap.e={eventName:'Camera Test',type:'cameratest',color:'#10457A',startDate:'20261006',endDate:'20261008',elements:['actor','missing'],note:'multi-day synthetic'};
 c.stripboard.board.segmentMap.a.calendarOptions={elements:['actor'],categories:['cast'],unknown:true};
 c.redflagType={t:{name:'Unavailable',type:'unavailable'}};
 c.redflag={range:{type:'t',startDate:'20261009',endDate:'20261012',elementId:'actor',color:'#661C15'},generic:{type:'t',typeName:'Personalizzato',startDate:'20261006',endDate:'20261006',elementId:'generic'},missing:{type:'t',startDate:'20261006',endDate:'20261006',elementId:'missing'}};
 return cloneExact(r);
}
function variant(root,format){
 const r=cloneExact(root);if(format==='5')return r;r.dataFormat=3;
 const ordered=map=>Object.entries(map).sort((a,b)=>(a[1].sortOrder||0)-(b[1].sortOrder||0)).map(([id,v])=>{const s={...v,id};delete s.sortOrder;return s});
 for(const b of Object.values(r.contents.breakdown)){b.sheets=format==='hybrid'?[{id:'warning'}]:ordered(b.sheetMap);if(format!=='hybrid')delete b.sheetMap}
 for(const b of Object.values(r.contents.stripboard)){
  b.segments=format==='hybrid'?[{id:'warning',type:'normal',strips:[]}]:ordered(b.segmentMap);
  for(const s of Object.values(b.segmentMap))s.strips=format==='hybrid'?[{id:'warning'}]:ordered(s.stripMap);
  if(format!=='hybrid'){for(const s of b.segments){s.strips=ordered(s.stripMap);delete s.stripMap}delete b.segmentMap}
 }
 return cloneExact(r);
}
test('native dates, quantities, duplicate scene numbers and segment calendars stay independent',async()=>{
 const root=fixture(),p=await parse(root),b=p.boards[0],cal=selectedCalendar(p,b.name);
 assert.equal(p.modelVersion,1);assert.equal(p.calendars.length,3);assert.equal(new Set(p.calendars.map(c=>c.id)).size,3);
 assert.equal(p.boards[0].parentBoardId,p.boards[1].parentBoardId);assert.notEqual(p.boards[0].id,p.boards[1].id);
 assert.equal(cal.scope.segmentId,'a');assert.equal(p.calendars.find(c=>c.scope.segmentId==='yard').daysOff.Mon,'1');
 assert.equal(p.scenes[0].elementRefs[0].quantity,40);assert.equal(p.scenes[0].elementRefs[0].name,'40 persone');assert.notEqual(p.scenes[0].id,p.scenes[1].id);
 assert.equal(p.elements.find(e=>e.id==='actor').properties.rate,17);assert.equal(p.production.title,'Test MMSX');
 assert.equal(boardWithCalendar(p,b.name,p.calendars[1].id),b);
 assert.equal(b.scheduledGroups[0].date,'2026-10-06');assert.equal(b.scheduledGroups[0].dateOrigin,'stored');
 assert.equal(calendarDate(cal,'2026-10-06').working,false);assert.equal(calendarDate(cal,'2026-10-10').working,true);
 assert.equal(calendarDate(cal,'2026-10-14').working,null);assert.equal(outsideCalendarActivity(cal,'2026-10-01'),false);
 assert.equal(cal.scheduleDates.ProductionWrapDate,undefined);assert.deepEqual(updatedMmsxRoot(p),root);
});
test('all seven weekly bits, all special kinds and invalid dates remain explicit',async()=>{
 for(let bit=0;bit<7;bit++){
  const root=fixture();root.contents.stripboard.board.segmentMap.a.calendar.daysOff=1<<bit;
  const p=await parse(root),cal=selectedCalendar(p);
  assert.equal(Object.values(cal.daysOff).filter(v=>v==='1').length,1);
  assert.equal(cal.daysOff[['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][bit]],'1');
 }
 const root=fixture();root.contents.stripboard.board.segmentMap.a.calendar.prodStart='20260230';
 const p=await parse(root),cal=selectedCalendar(p);
 assert.equal(cal.scheduleDates.ProductionStartDate.iso,null);assert.equal(calendarDate(cal,'2026-02-30'),null);
 for(const date of ['2026-10-12','2026-10-13'])assert.equal(calendarDate(cal,date).working,false);
 root.contents.redflag.range.endDate='20260230';const bad=await parse(root);
 assert.equal(bad.redFlags.find(f=>f.id==='range').endDate,null);
 assert(!redFlagsOnDate(bad,'2026-10-09').some(f=>f.id==='range'));
 assert.equal(intervalOverlaps(bad.redFlags.find(f=>f.id==='range'),'2026-10-09','2026-10-09'),false);
});
test('inclusive civil intervals, generic vs dangling IDs, event identity and scope',async()=>{
 const p=await parse(fixture()),cal=selectedCalendar(p);
 assert.equal(p.events.length,1);assert.equal(eventsOnDate(p,cal.id,'2026-10-07').length,1);assert.equal(eventsOnDate(p,p.calendars[1].id,'2026-10-07').length,0);
 assert.equal(eventsOnDate(p,cal.id,'2026-10-09').length,0);assert.equal(p.events[0].targets[1].kind,'unresolved');
 assert.equal(p.redFlags.length,3);for(const date of ['2026-10-09','2026-10-10','2026-10-11','2026-10-12'])assert.equal(redFlagsOnDate(p,date).length,1);
 assert.equal(redFlagsOnDate(p,'2026-10-13').length,0);assert.equal(p.redFlags.find(f=>f.id==='generic').target.kind,'project');assert.equal(p.redFlags.find(f=>f.id==='missing').target.kind,'unresolved');
 assert.deepEqual(redFlagsForStrip(p,'s1','2026-10-06').map(f=>f.id),['generic']);assert.equal(intervalOverlaps(p.redFlags[0],'2026-10-11','2026-10-11'),true);
});
for(const format of ['5','3','hybrid'])test(`format ${format}: exact no-op, strip edit, unknown data, undo and save/reopen`,async()=>{
 const root=variant(fixture(),format),bytes=await encodeMmsx(root),p=await parseMmsx(bytes,'test.mmsx'),b=p.boards[0];
 const snapshot=snapshotBoardOrder(b),strip=b.scheduledGroups[0].strips.find(s=>s.kind==='scene');
 assert.deepEqual(await serializeMmsx(p,'test-edited.mmsx'),bytes);
 moveBoardItems(p,{boardName:b.name,sourceKeys:[strip.sourceKey],to:{container:'scheduledGroups',groupIndex:1,stripIndex:0}});
 assert.equal(getCalendarDate(p,b.calendarId,'2026-10-07').shootingDays[0].shootingDayNumber,5);
 const saved=await serializeMmsx(p,'test-edited.mmsx'),out=await decodeMmsx(saved),reopened=await parseMmsx(saved);
 assert.equal(out.id,root.id);assert.deepEqual(out.productionInfo,root.productionInfo);assert.deepEqual(out.contents.breakdown,root.contents.breakdown);assert.deepEqual(out.contents.element,root.contents.element);assert.deepEqual(out.contents.redflag,root.contents.redflag);
 assert.equal(stringifyExact(reopened.calendars.map(c=>c.source)),stringifyExact(p.calendars.map(c=>c.source)));assert.deepEqual(reopened.events,p.events);assert.deepEqual(reopened.scenes.map(s=>s.elementRefs),p.scenes.map(s=>s.elementRefs));
 const redo=snapshotBoardOrder(b);restoreBoardOrder(b,snapshot);assert.deepEqual(updatedMmsxRoot(p),root);assert.deepEqual(await serializeMmsx(p,'undo.mmsx'),bytes);restoreBoardOrder(b,redo);assert.deepEqual(await decodeMmsx(await serializeMmsx(p,'redo.mmsx')),out);
});
test('calendar references are rebuilt after day-boundary moves and undo',async()=>{
 const p=await parse(fixture()),b=p.boards[0],snapshot=snapshotBoardOrder(b);
 const key=(await import('../assets/scheduling.js')).dayBreakKey(b.name,b.scheduledGroups[0]);
 moveBoardItems(p,{boardName:b.name,sourceKeys:[key],to:{container:'unscheduledGroups',groupIndex:0,stripIndex:0}});
 assert.equal(getCalendarDate(p,b.calendarId,'2026-10-07').shootingDays.length,0);
 restoreBoardOrder(b,snapshot);assert.equal(getCalendarDate(p,b.calendarId,'2026-10-07').shootingDays[0].shootingDayNumber,5);
});
if(process.argv[2])test('real edited2: verified counts, multi-target event, Ernie, generic flags and quantity 40',async()=>{
 const bytes=await readFile(process.argv[2]),p=await parseMmsx(bytes,'edited2.mmsx');
 for(const board of p.boards)for(const group of board.scheduledGroups)if(group.kind==='ScheduleDay'){const [,sid,id]=JSON.parse(group.mmsxDay),raw=p.mmsxSource.root.contents.stripboard[board.parentBoardId].segmentMap[sid].stripMap[id];assert.equal(group.date.replaceAll('-',''),raw.date);assert.equal(group.shootingDayNumber,Number(raw.shootDay))}
 assert.equal(p.scenes.length,146);assert.equal(p.boards.length,4);assert.equal(p.calendars.length,8);assert.equal(p.counts.scheduleDays,119);
 assert.equal(p.events.length,1);assert.equal(p.events[0].name,'Camera Test');assert.equal(p.events[0].targets.length,2);
 assert.equal(p.redFlags.length,7);assert.equal(p.redFlags.filter(f=>f.target.kind==='project').length,2);
 const ernie=p.redFlags.find(f=>f.target.element==='Ernie');for(const d of ['19','20','21','22','23'])assert(redFlagsOnDate(p,`2008-06-${d}`).includes(ernie));
 assert.equal(p.scenes.find(s=>s.scene==='102').elementRefs.find(r=>r.name==='40 Church Goers').quantity,40);
 assert.equal(p.scenes.filter(s=>s.scene==='5').length,2);assert.deepEqual(await serializeMmsx(p,'edited2.mmsx'),new Uint8Array(bytes));
});
