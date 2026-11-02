import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,editScene,editElement,editCategory,addDay,editFlag,createPlan,createCalendar,editCalendarDetails,editPlan,snapshotDocument,restoreDocument,validateDocument} from '../assets/document-model.js';
import {serializeStudio,parseStudio} from '../assets/studio-project.js';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';
import {encodeMmsx} from '../assets/mmsx-codec.js';
import {mmsxFixture} from './fixtures/mmsx.mjs';
import {fixture} from './fixtures/calendar.mjs';
import {moveCalendarItems} from '../assets/calendar-commands.js';
import {redFlagsForStrip} from '../assets/production-data.js';
import {calculateDood} from '../assets/dood-engine.js';
function scene(p,element){return editScene(p,null,{scene:'12A',pagesEighths:11,set:'Casa',location:'Roma',ie:'INT',dn:'DAY',synopsis:'Arrivo',comments:'Nota',unit:'1',sequence:'A',scriptDay:'2',scriptPageNumbers:'10–11',estimateTimeA:'1:30',estimateTimeB:'0:20'},[{elementId:element.id,quantity:3}])}
test('new document persists every scene field, properties, quantities, days and linked constraints',async()=>{
 const p=createDocument('Film'),actor=editElement(p,null,{name:'Anna',category:'Cast',boardId:'1',properties:{actor:'Alice',contact:{email:'test@example.invalid'}}}),s=scene(p,actor),b=p.boards[0];
 addDay(p,b.id,{date:'2026-10-12',shootingDayNumber:1});const key=b.unscheduledGroups[0].strips[0].sourceKey;
 moveCalendarItems(p,{boardName:b.name,sourceKeys:[key],to:{boardName:b.name,calendarId:b.calendarId,date:'2026-10-12'}});
 editFlag(p,null,{name:'Unavailable',type:'unavailable',startDate:'2026-10-12',endDate:'2026-10-13',target:{kind:'element',elementId:actor.id,category:'Cast',element:actor.name},note:'Vincolo'});
 assert.equal(redFlagsForStrip(p,s.bdsId,'2026-10-12').length,1);
 const before=snapshotDocument(p),again=await parseStudio(await serializeStudio(p));
 assert.deepEqual(JSON.parse(JSON.stringify(snapshotDocument(again))),JSON.parse(JSON.stringify(before)));assert.equal(again.boards[0].scheduledGroups[0].strips[0].bdsId,s.bdsId);
 assert.equal(calculateDood({project:again,board:again.boards[0],calendar:again.calendars[0],elements:again.elements}).rows[0].totals.worked,1);
});
test('element and category renames preserve IDs, associations, quantities, flags and report geometry',()=>{
 const p=createDocument('Film'),actor=editElement(p,null,{name:'Anna',category:'Cast',properties:{}}),s=scene(p,actor);
 const shape={a:{BoundingRect:'0,0,10,1',CategoryName:'Cast'},font:{Size:'12'},categories:['Cast']};p.reportLayouts=[{record:[shape]}];
 const cat=p.categorySettings.find(c=>c.name==='Cast');editCategory(p,cat.id,{name:'Interpreti',attributes:{},properties:{}});editElement(p,actor.id,{name:'ANNA',category:'Interpreti',properties:{actor:'Alice'}});
 assert.equal(s.elementRefs[0].elementId,actor.id);assert.equal(s.elementRefs[0].quantity,3);assert.deepEqual(s.requirements.Interpreti,['ANNA']);assert.deepEqual(shape.categories,['Interpreti']);assert.equal(shape.a.BoundingRect,'0,0,10,1');assert.equal(shape.font.Size,'12');
});
test('undo restores document identities, views, references and creation; redo restores the complete edit',()=>{
 const p=createDocument('Film'),before=snapshotDocument(p);const el=editElement(p,null,{name:'Anna',category:'Cast',properties:{}});scene(p,el);const after=snapshotDocument(p);restoreDocument(p,before);assert.equal(p.scenes.length,0);restoreDocument(p,after);assert.deepEqual(snapshotDocument(p),after);
});
for(const variant of ['5','3','hybrid'])test(`full Studio edit preserves original MMSX ${variant} archive and shared Boneyard`,async()=>{
 const bytes=await encodeMmsx(fixture(variant)),p=await parseMmsx(bytes,'source.mmsx');p.documentEditing=true;
 const s=p.scenes[0];editScene(p,s.id,{scene:'99A',pagesEighths:17},s.elementRefs);editElement(p,'actor',{name:'Interprete',category:'Cast',properties:{actor:'Alice'}});
 const cal=createCalendar(p,{name:'Seconda unità'});createPlan(p,{name:'Piano alternativo',calendarId:cal.id,copyFrom:p.boards[0].id});
 const data=JSON.parse(new TextDecoder().decode(await serializeStudio(p)));assert.deepEqual(Uint8Array.from(atob(data.native),c=>c.charCodeAt(0)),bytes);
 const again=await parseStudio(new TextEncoder().encode(JSON.stringify(data)));assert.equal(again.scenes[0].pagesEighths,17);assert.equal(again.scenes[0].requirements.Cast[0],'Interprete');assert.equal(again.boards[0].unscheduledGroups,again.boards[1].unscheduledGroups);assert.equal(again.boards.at(-1).name,'Piano alternativo');
 assert.equal(again.events.length,p.events.length);assert.equal(again.events[0].id,p.events[0].id);await assert.rejects(()=>serializeMmsx(again,'source.mmsx'),/non risolto/);
});
test('calendar and plan renames retain calendar ID, dates and fixed events',()=>{
 const p=createDocument('Film'),b=p.boards[0],c=p.calendars[0];addDay(p,b.id,{date:'2026-10-12',shootingDayNumber:1});p.events.push({id:'ev',startDate:'2026-10-13',endDate:'2026-10-13',calendarId:c.id,studioBoardName:b.name,targets:[]});
 editCalendarDetails(p,c.id,{name:'Nuovo calendario',options:{},scheduleDates:{ProductionStartDate:{iso:'2026-10-10',origin:'edited'}}});editPlan(p,b.id,{name:'Piano B',calendarId:c.id,description:'Prova'});assert.equal(b.calendarName,c.name);assert.equal(p.events[0].studioBoardName,'Piano B');assert.equal(p.events[0].startDate,'2026-10-13');assert.equal(b.scheduledGroups[0].date,'2026-10-12');
});
test('invalid values fail without partial creation; malformed containers fail before loading',async()=>{
 const p=createDocument('Film');assert.throws(()=>editScene(p,null,{scene:'',pagesEighths:-1}),/intero/);assert.throws(()=>editScene(p,null,{scene:'1',pagesEighths:1.5}),/ottavi/);assert.equal(p.scenes.length,0);
 assert.throws(()=>editElement(p,null,{name:'Anna',category:'Missing',properties:{}}),/Categoria/);assert.throws(()=>addDay(p,p.boards[0].id,{date:'2026-02-30',shootingDayNumber:1}),/valido/);assert.throws(()=>editCategory(p,null,{name:'Cast'}),/presente/);
 const data=JSON.parse(new TextDecoder().decode(await serializeStudio(p)));data.document.value.boards[0].unscheduledGroups[0].strips=[{kind:'scene',sourceKey:'lost',bdsId:'missing'}];await assert.rejects(()=>parseStudio(new TextEncoder().encode(JSON.stringify(data))),/senza scena/);
 assert.equal(validateDocument(p),p);
});

test('opaque quantities and unresolved references retain their imported state during unrelated edits',async()=>{
 const p=await parseMmsx(await encodeMmsx(fixture()),'source.mmsx'),s=p.scenes[0],before=s.elementRefs.map(ref=>({...ref}));
 editScene(p,s.id,{comments:'A note'},s.elementRefs);assert.deepEqual(s.elementRefs,before);
});
test('existing MMSX documents without a calendar remain editable and reopen without invented dates',async()=>{
 const p=await parseMmsx(await encodeMmsx(mmsxFixture),'source.mmsx');p.documentEditing=true;editScene(p,p.scenes[0].id,{comments:'A note'});
 const again=await parseStudio(await serializeStudio(p));assert.equal(again.calendars.length,0);assert.equal(again.scenes[0].comments,'A note');
});

// Sheet identities are assigned by the model and survive every editing path.
test('sheet numbers are automatic, immutable and preserved by undo and save/reopen',async()=>{
 const p=createDocument('Film'),first=editScene(p,null,{scene:'1'}),second=editScene(p,null,{scene:'2'});
 assert.equal(first.sheetNumber,'1');assert.equal(second.sheetNumber,'2');
 const before=snapshotDocument(p);
 assert.throws(()=>editScene(p,first.id,{scene:'Changed',sheetNumber:'99'}),/sheet non è modificabile/);
 assert.deepEqual(snapshotDocument(p),before);
 assert.throws(()=>editScene(p,null,{scene:'3',sheetNumber:'99'}),/sheet non è modificabile/);
 assert.equal(p.scenes.length,2);
 editScene(p,first.id,{scene:'1A',comments:'Note'});assert.equal(first.sheetNumber,'1');
 const after=snapshotDocument(p);restoreDocument(p,before);assert.equal(p.scenes[0].sheetNumber,'1');restoreDocument(p,after);
 const reopened=await parseStudio(await serializeStudio(p));assert.deepEqual(reopened.scenes.map(s=>s.sheetNumber),['1','2']);
});
test('new scenes continue imported sheet numbering without changing imported values',async()=>{
 const p=await parseMmsx(await encodeMmsx(fixture()),'source.mmsx');
 p.scenes[0].sheetNumber='42';p.scenes[1].sheetNumber='Imported opaque label';
 const next=editScene(p,null,{scene:'New'});assert.equal(next.sheetNumber,'43');
 assert.equal(p.scenes[0].sheetNumber,'42');assert.equal(p.scenes[1].sheetNumber,'Imported opaque label');
});
