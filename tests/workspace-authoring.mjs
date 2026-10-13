import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatPages,parsePages,formatTime,parseTime} from '../assets/entry-format.js';
import {createDocument,createCalendar,editElement,snapshotDocument,restoreDocument} from '../assets/document-model.js';
import {insertScene,insertBanner,insertEndOfDay,assignPlanCalendar,reschedulePlan,bulkElementIds,moveElementsToCategory,reorderCollection} from '../assets/workspace-commands.js';
import {stripColorSettings,resolveStripColors} from '../assets/strip-colors.js';
import {serializeStudio,parseStudio} from '../assets/studio-project.js';
import {parseMmsx} from '../assets/mmsx-project.js';
import {encodeMmsx} from '../assets/mmsx-codec.js';
import {fixture} from './fixtures/calendar.mjs';
function project(){const p=createDocument('Film');p.calendars[0].scheduleDates.ProductionStartDate={iso:'2026-10-16'};return p}
const scheduled=p=>p.boards[0].scheduledGroups.filter(g=>g.kind==='ScheduleDay');
test('page fractions and clocks accept explicit human formats without changing their units',()=>{
 for(const [text,n] of [['2 3/8',19],['3/8',3],['2',16],['0/8',0],['',null]]){assert.equal(parsePages(text),n);assert.equal(parsePages(formatPages(n)),n)}
 for(const text of ['2.3','3/4','1 8/8','-1','abc'])assert.throws(()=>parsePages(text));
 assert.equal(formatTime('90'),'01:30');assert.equal(formatTime('1',{screen:true}),'01:00');assert.equal(formatTime('0:20',{screen:true}),'00:20');
 assert.equal(parseTime('1:30'),'01:30');assert.equal(parseTime('03:45',{screen:true}),'03:45');assert.throws(()=>parseTime('01:60'));assert.throws(()=>parseTime('90'));
});
test('insertions use the selected position, conserve strips and survive save/reopen',async()=>{
 const p=project(),board=p.boards[0];const a=insertScene(p,{boardName:board.name}),b=insertScene(p,{boardName:board.name}),c=insertScene(p,{boardName:board.name,key:a.strip.sourceKey});
 const banner=insertBanner(p,{boardName:board.name,key:c.strip.sourceKey});
 assert.deepEqual(board.scheduledGroups[0].strips.map(s=>s.sourceKey),[a.strip.sourceKey,c.strip.sourceKey,banner.strip.sourceKey,b.strip.sourceKey]);
 assert.equal(p.scenes.length,3);assert.equal(new Set(board.scheduledGroups[0].strips.map(s=>s.sourceKey)).size,4);assert.equal(board.unscheduledGroups[0].strips.length,0);
 const reopened=await parseStudio(await serializeStudio(p));assert.deepEqual(reopened.boards[0].scheduledGroups[0].strips.map(s=>s.sourceKey),board.scheduledGroups[0].strips.map(s=>s.sourceKey));
});
test('day boundaries split after selection and shift all following workdays, including holidays',async()=>{
 const p=project(),b=p.boards[0],items=Array.from({length:4},()=>insertScene(p,{boardName:b.name}));
 insertEndOfDay(p,{boardName:b.name,key:items[1].strip.sourceKey});insertEndOfDay(p,{boardName:b.name,key:items[3].strip.sourceKey});
 assert.deepEqual(scheduled(p).map(g=>g.date),['2026-10-16','2026-10-19']);
 const before=snapshotDocument(p);insertEndOfDay(p,{boardName:b.name,key:items[0].strip.sourceKey});
 assert.deepEqual(scheduled(p).map(g=>g.date),['2026-10-16','2026-10-19','2026-10-20']);assert.deepEqual(scheduled(p).map(g=>g.strips.length),[1,1,2]);
 assert.deepEqual(scheduled(p).map(g=>g.shootingDayNumber),[1,2,3]);
 p.calendars[0].specialDays.push({date:'2026-10-19',attributes:{Holiday:'1',Off:'0',CompanyTravel:'0',ExceptionWorkday:'0'}});reschedulePlan(p,p.boards[0]);assert.deepEqual(scheduled(p).map(g=>g.date),['2026-10-16','2026-10-20','2026-10-21']);
 const after=snapshotDocument(p);restoreDocument(p,before);assert.equal(scheduled(p).length,2);restoreDocument(p,after);const reopened=await parseStudio(await serializeStudio(p));assert.deepEqual(scheduled(reopened).map(g=>g.date),scheduled(p).map(g=>g.date));
});
test('calendar association is persisted and a day insertion cannot lose strips when scheduling fails',async()=>{
 const p=project(),b=p.boards[0],a=insertScene(p,{boardName:b.name}),other=insertScene(p,{boardName:b.name});
 insertEndOfDay(p,{boardName:b.name,key:other.strip.sourceKey});const c=createCalendar(p,{name:'Secondo',scheduleDates:{ProductionStartDate:{iso:'2026-11-02'}}});assignPlanCalendar(p,b.name,c.id);assert.equal(b.calendarId,c.id);assert.equal(scheduled(p)[0].date,'2026-11-02');
 const reopened=await parseStudio(await serializeStudio(p));assert.equal(reopened.boards[0].calendarId,c.id);assert.equal(scheduled(reopened)[0].date,'2026-11-02');
 for(const key of Object.keys(c.daysOff))c.daysOff[key]='1';const before=snapshotDocument(p);assert.throws(()=>insertEndOfDay(p,{boardName:b.name,key:a.strip.sourceKey}),/giorni lavorativi/);assert.deepEqual(snapshotDocument(p),before);
});
test('bulk IDs and category moves conserve identities, quantities, flags and links and reject conflicts',()=>{
 const p=project(),a=editElement(p,null,{name:'Anna',category:'Cast',boardId:'1',properties:{}}),b=editElement(p,null,{name:'Bruno',category:'Cast',boardId:'2',properties:{}}),c=editElement(p,null,{name:'Carlo',category:'Cast',boardId:'3',properties:{}});
 const scene=insertScene(p,{boardName:p.boards[0].name}).scene;scene.elementRefs=[{elementId:a.id,category:a.category,name:a.name,quantity:2,resolved:true}];p.redFlags=[{id:'flag',target:{kind:'element',elementId:a.id,category:a.category,element:a.name}}];
 bulkElementIds(p,[b.id,a.id],{start:100,prefix:'C'});assert.equal(b.boardId,'C100');assert.equal(a.boardId,'C101');
 const before=snapshotDocument(p);assert.throws(()=>bulkElementIds(p,[a.id],{start:3}),/già presente/);assert.deepEqual(snapshotDocument(p),before);
 moveElementsToCategory(p,[a.id,b.id],'Props');assert.equal(scene.elementRefs[0].elementId,a.id);assert.equal(scene.elementRefs[0].quantity,2);assert.equal(scene.elementRefs[0].category,'Props');assert.equal(p.redFlags[0].target.category,'Props');assert.equal(c.category,'Cast');
});
for(const variant of ['5','3','hybrid'])test(`native ${variant}: insertion, combination colors, association and Studio source conservation`,async()=>{
 const bytes=await encodeMmsx(fixture(variant)),p=await parseMmsx(bytes,'source.mmsx'),b=p.boards[0],key=b.scheduledGroups[0].strips[0].sourceKey;p.documentEditing=true;
 const s=insertScene(p,{boardName:b.name,key});assert.equal(b.scheduledGroups[0].strips[1].sourceKey,s.strip.sourceKey);
 const colors=stripColorSettings(p);colors.combinationEditing=true;colors.cells['0:0']={bg:'#aabbcc',fg:'#112233'};p.colors=colors;assert.deepEqual(resolveStripColors(p,{ie:'INT',dn:'Giorno',mmsxColors:{bg:'#000000'}}),colors.cells['0:0']);
 const c=createCalendar(p,{name:'Nuovo',scheduleDates:{ProductionStartDate:{iso:'2026-11-02'}}});assignPlanCalendar(p,b.name,c.id);const data=JSON.parse(new TextDecoder().decode(await serializeStudio(p)));assert.deepEqual(Uint8Array.from(atob(data.native),c=>c.charCodeAt(0)),bytes);
 const reopened=await parseStudio(new TextEncoder().encode(JSON.stringify(data)));assert.equal(reopened.boards[0].calendarId,c.id);assert.equal(reopened.boards[0].scheduledGroups.find(g=>g.kind==='ScheduleDay').shootingDayNumber,3);assert.equal(reopened.boards[0].unscheduledGroups,reopened.boards[1].unscheduledGroups);
 const order=reopened.calendars.map(c=>c.id).reverse();reorderCollection(reopened,'calendar',order);assert.deepEqual(reopened.calendars.map(c=>c.id),order);
});
