import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fixture} from './fixtures/calendar.mjs';
import {ExactNumber,encodeMmsx,decodeMmsx,stringifyExact} from '../assets/mmsx-codec.js';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';
import {editCalendar,previewReschedule,rescheduleCalendar,snapshotProduction,restoreProduction,calendarSignature} from '../assets/calendar-commands.js';
import {calendarPlanEntries,calendarDayContent,breakdownCategories,activeSceneContext,canSplit,groupSummary} from '../assets/calendar-selectors.js';
import {calendarMarkup,breakdownMarkup,CALENDAR_VISIBILITY} from '../assets/workspace-views.js';
for(const format of ['5','3','hybrid'])test(`${format}: rule edits, explicit replan, undo/redo and calendar save/reopen preserve opaque data`,async()=>{
 const root=fixture(format),bytes=await encodeMmsx(root),p=await parseMmsx(bytes),b=p.boards[0],id=b.calendarId,c=p.calendars.find(c=>c.id===id),initial=snapshotProduction(p);
 const order=b.scheduledGroups.map(g=>g.strips.map(s=>s.sourceKey)),dates=b.scheduledGroups.map(g=>g.date);
 editCalendar(p,{calendarId:id,weekday:'Tue',off:true});editCalendar(p,{calendarId:id,date:'2026-10-09',type:'travel'});editCalendar(p,{calendarId:id,date:'2026-10-07',type:'workday'});editCalendar(p,{calendarId:id,startDate:'2026-10-08'});
 assert.deepEqual(b.scheduledGroups.map(g=>g.date),dates);
 const rules=snapshotProduction(p),savedRules=await serializeMmsx(p,'edited.mmsx'),reopenedRules=await parseMmsx(savedRules);
 const reopenedCal=reopenedRules.calendars.find(c=>c.id===id);
 assert.equal(reopenedCal.daysOff.Tue,'1');assert.equal(reopenedCal.scheduleDates.ProductionStartDate.iso,'2026-10-08');
 assert.equal(reopenedCal.specialDays.find(s=>s.date==='2026-10-09').type,'travel');assert.equal(reopenedCal.specialDays.find(s=>s.date==='2026-10-07').type,'workday');
 assert.deepEqual(reopenedRules.boards[0].scheduledGroups.map(g=>g.date),dates);
 const preview=previewReschedule(p,id);assert.equal(preview.length,1);assert.deepEqual(preview[0].changes.map(c=>c.to),['2026-10-08','2026-10-12']);
 rescheduleCalendar(p,id,preview);assert.deepEqual(b.scheduledGroups.map(g=>g.strips.map(s=>s.sourceKey)),order);assert.deepEqual(b.scheduledGroups.filter(g=>g.kind==='ScheduleDay').map(g=>g.shootingDayNumber),[3,5]);
 assert.deepEqual(p.events,initial.calendars.length&&reopenedRules.events);assert.equal(p.redFlags[0].startDate,'2026-10-08');
 const replan=snapshotProduction(p),saved=await serializeMmsx(p,'edited.mmsx'),out=await decodeMmsx(saved),reopened=await parseMmsx(saved);
 assert.deepEqual(reopened.boards[0].scheduledGroups.filter(g=>g.kind==='ScheduleDay').map(g=>g.date),['2026-10-08','2026-10-12']);
 for(const k of ['category','breakdown','element','redflag','redflagType'])assert.equal(stringifyExact(out.contents[k]),stringifyExact(root.contents[k]));
 assert.deepEqual(out.productionInfo,root.productionInfo);assert.equal(out.id,root.id);
 assert.equal(out.contents.reports.opaque,'preserved');assert(reopenedCal.specialDays.some(s=>s.rawDate==='invalid'));
 const calendarOut=reopened.calendars.find(c=>c.id===id).source;assert.equal(stringifyExact(calendarOut.opaque),stringifyExact({keep:true}));assert.deepEqual(calendarOut.eventMap,c.source.eventMap);
 restoreProduction(p,rules);assert.deepEqual(b.scheduledGroups.map(g=>g.date),dates);restoreProduction(p,replan);assert.equal(b.scheduledGroups[1].date,'2026-10-12');
 restoreProduction(p,initial);assert.deepEqual(await serializeMmsx(p,'undo.mmsx'),bytes);
});
test('remove exception, shared calendar scope, empty and duplicate-date shooting days and Boneyard stay distinct',async()=>{
 const p=await parseMmsx(await encodeMmsx(fixture())),a=p.boards[0],b=p.boards[1];b.calendarId=a.calendarId;
 editCalendar(p,{calendarId:a.calendarId,date:'2026-10-07',type:null});assert(!p.calendars[0].specialDays.some(s=>s.date==='2026-10-07'));
 a.scheduledGroups[1].date=a.scheduledGroups[0].date;a.scheduledGroups[1].strips=[];
 const entries=calendarPlanEntries(p,a.name,new Set(['a','b','yard']),a.calendarId),day=calendarDayContent(p,a.calendarId,'2026-10-06',entries);
 assert.equal(day.days.length,3);assert.equal(day.days[1].summary.sceneCount,0);assert.equal(previewReschedule(p,a.calendarId).length,2);
 assert.equal(entries.filter(e=>e.container==='unscheduledGroups').length,0);assert.equal(p.boards[0].unscheduledGroups[0].date,'2026-10-01');
});
test('validation and stale preview reject without partial replan; all seven off still permit the anchor',async()=>{
 const p=await parseMmsx(await encodeMmsx(fixture())),id=p.boards[0].calendarId,c=p.calendars[0];
 const before=calendarSignature(c);assert.throws(()=>editCalendar(p,{calendarId:id,date:'2026-02-30',type:'workday'}));assert.equal(calendarSignature(c),before);
 const preview=previewReschedule(p,id);editCalendar(p,{calendarId:id,startDate:'2026-10-09'});
 const dates=p.boards[0].scheduledGroups.map(g=>g.date);assert.throws(()=>rescheduleCalendar(p,id,preview));assert.deepEqual(p.boards[0].scheduledGroups.map(g=>g.date),dates);
 for(const weekday of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])editCalendar(p,{calendarId:id,weekday,off:true});
 assert.throws(()=>previewReschedule(p,id),/Nessun giorno/);assert.deepEqual(p.boards[0].scheduledGroups.map(g=>g.date),dates);
});
test('custom category identity, order, quantities, properties, unresolved refs and partial scenes',async()=>{
 const p=await parseMmsx(await encodeMmsx(fixture())),scene=p.scenes[0],cats=breakdownCategories(p,scene),custom=cats.find(c=>c.id==='custom');
 assert.equal(custom.name,'Veicoli speciali');assert.equal(custom.color,'#123456');assert.equal(custom.items[0].quantity,2);assert.equal(custom.items[0].name,'12 auto');assert.equal(custom.items[0].properties.fuel,'Elettrico');
 assert(cats.some(c=>c.unknown&&c.items.some(r=>!r.resolved)));assert.deepEqual(breakdownCategories(p,{elementRefs:[]},{hideEmpty:true}),[]);
 const strip=p.boards[0].scheduledGroups[0].strips[0];assert.equal(activeSceneContext(p,p.boards[0].name,scene.id,strip.sourceKey).occurrence.group.date,'2026-10-06');
 assert.notEqual(scene.id,p.scenes[1].id);assert.equal(scene.estimateTimeA,'1:30');assert.equal(groupSummary(p,p.boards[0].scheduledGroups[0]).minutes,90);assert.equal(groupSummary(p,p.boards[0].scheduledGroups[0]).timePartial,true);
});
test('calendar and breakdown rendering preferences and context are read-only; threshold is strictly over 1200',async()=>{
 const p=await parseMmsx(await encodeMmsx(fixture())),bytes=await serializeMmsx(p,'noop.mmsx'),b=p.boards[0],s={calendar:b.calendarId,board:b.name,visibleSegments:new Set(['a']),calendarMonth:'2026-10',calendarDate:'2026-10-06',selectedStripIds:new Set(),calendarVisibility:Object.fromEntries(Object.keys(CALENDAR_VISIBILITY).map(k=>[k,true]))};
 const safe=String,helpers={safe,shortDate:safe,pages:safe,specialLabel:()=>'',sceneColors:()=>({}),valueText:safe};
 const html=calendarMarkup(p,s,helpers);assert(html.indexOf('data-scene-strip')<html.indexOf('Banner di prova'));assert(html.includes('Scena di prova'));assert(html.includes('calendar-strip-pages'));assert(!html.includes('class="mini-synopsis"'));const extended=calendarMarkup(p,{...s,calendarExtended:true},helpers);assert(extended.includes('class="mini-synopsis"'));assert(extended.includes('data-calendar-extended checked'));assert(!html.includes('data-calendar-extended checked'));assert(html.includes('calendar-conflict'));assert(html.includes('calendar-event'));
 const preview=breakdownMarkup(p,{...s,activeSceneId:p.scenes[0].id,activeStripId:b.scheduledGroups[0].strips[0].sourceKey},helpers);assert(preview.includes('12 auto'));assert(!preview.includes('element-quantity'));assert(!preview.includes('Carburante:'));assert(preview.includes('title="Riferimento non risolto"'));
 assert.deepEqual(await serializeMmsx(p,'noop.mmsx'),bytes);assert(!canSplit(1199));assert(!canSplit(1200));assert(canSplit(1201));
});
if(process.argv[2])test('real file: edit, replan and reopen preserve all non-calendar content',async()=>{
 const bytes=await readFile(process.argv[2]),p=await parseMmsx(bytes),b=p.boards.find(b=>b.scheduledGroups.some(g=>g.kind==='ScheduleDay'&&g.date)),initial=snapshotProduction(p),id=b.calendarId;
 const root=await decodeMmsx(bytes);editCalendar(p,{calendarId:id,weekday:'Mon',off:true});editCalendar(p,{calendarId:id,date:'2008-06-19',type:'travel'});
 const savedRules=await parseMmsx(await serializeMmsx(p,'real-test.mmsx'));assert.deepEqual(savedRules.boards.map(b=>b.scheduledGroups.map(g=>g.date)),p.boards.map(b=>b.scheduledGroups.map(g=>g.date)));
 rescheduleCalendar(p,id);const output=await serializeMmsx(p,'real-test.mmsx'),out=await decodeMmsx(output),reopen=await parseMmsx(output);
 for(const k of ['breakdown','element','category','redflag','redflagType'])assert.equal(stringifyExact(out.contents[k]),stringifyExact(root.contents[k]));
 assert.deepEqual(reopen.boards.map(b=>b.scheduledGroups.map(g=>g.date)),p.boards.map(b=>b.scheduledGroups.map(g=>g.date)));
 restoreProduction(p,initial);assert.deepEqual(await serializeMmsx(p,'undo.mmsx'),new Uint8Array(bytes));
});

test('history preserves exact opaque calendar numbers through undo and a subsequent edit',async()=>{
 const root=fixture();root.contents.stripboard.board.segmentMap.a.calendar.specialDays.invalid=new ExactNumber('90071992547409931234');
 const bytes=await encodeMmsx(root),p=await parseMmsx(bytes),id=p.boards[0].calendarId,snapshot=snapshotProduction(p);
 editCalendar(p,{calendarId:id,weekday:'Mon',off:true});restoreProduction(p,snapshot);assert.deepEqual(await serializeMmsx(p,'undo.mmsx'),bytes);
 editCalendar(p,{calendarId:id,weekday:'Tue',off:true});const out=await decodeMmsx(await serializeMmsx(p,'second-edit.mmsx'));
 assert.equal(out.contents.stripboard.board.segmentMap.a.calendar.specialDays.invalid.text,'90071992547409931234');
});

test('unscheduled scene occurrence remains in Boneyard with no invented date after rule edits and rescheduling',async()=>{
 const root=fixture(),yard=root.contents.stripboard.board.segmentMap.yard;
 yard.stripMap.unscheduled={type:'breakdown',sheet:'s2',sortOrder:1};
 const p=await parseMmsx(await encodeMmsx(root)),b=p.boards[0],entry=b.unscheduledGroups.find(g=>g.strips.some(s=>s.kind==='scene')),strip=entry.strips.find(s=>s.kind==='scene');
 editCalendar(p,{calendarId:b.calendarId,startDate:'2026-10-08'});rescheduleCalendar(p,b.calendarId);
 assert.equal(entry.date,null);const context=activeSceneContext(p,b.name,p.scenes.find(s=>s.bdsId==='s2').id,strip.sourceKey);assert.equal(context.occurrence.container,'unscheduledGroups');
 const entries=calendarPlanEntries(p,b.name,new Set(['a','b','yard']),b.calendarId);assert(!entries.some(e=>e.group.strips.includes(strip)));
 const reopened=await parseMmsx(await serializeMmsx(p,'yard.mmsx')),again=reopened.boards[0].unscheduledGroups.find(g=>g.strips.some(s=>s.sourceKey===strip.sourceKey));assert.equal(again.date,null);
});
