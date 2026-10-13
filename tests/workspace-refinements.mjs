import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,editScene,editElement,editCategory,addDay,snapshotDocument,restoreDocument} from '../assets/document-model.js';
import {insertScene,duplicateStrips,deleteStrips,bulkElementIds} from '../assets/workspace-commands.js';
import {elementUsage,sceneUsesElement} from '../assets/element-management.js';
import {addElementFlags} from '../assets/red-flag-workspace.js';
import {paginateSchedule} from '../assets/print-layout.js';
import {serializeStudio,parseStudio} from '../assets/studio-project.js';
import {parseMmsx} from '../assets/mmsx-project.js';
import {encodeMmsx} from '../assets/mmsx-codec.js';
import {fixture} from './fixtures/calendar.mjs';
test('blank scene number is saved, duplicate gets an independent sheet and deletion removes its sheet globally',async()=>{
 const p=createDocument('Film'),b=p.boards[0];const original=insertScene(p,{boardName:b.name});assert.equal(original.scene.scene,'');const before=snapshotDocument(p);
 const [copy]=duplicateStrips(p,b.name,[original.strip.sourceKey]);assert.notEqual(copy.bdsId,original.scene.bdsId);const next=p.scenes.find(s=>s.bdsId===copy.bdsId);assert.equal(next.scene,'');assert.notEqual(next.sheetNumber,original.scene.sheetNumber);
 editScene(p,next.id,{synopsis:'Solo copia'});assert.notEqual(p.scenes[0].synopsis,'Solo copia');deleteStrips(p,b.name,[copy.sourceKey]);assert(!p.scenes.some(s=>s.bdsId===copy.bdsId));assert(!b.scheduledGroups.some(g=>g.strips.some(s=>s.sourceKey===copy.sourceKey)));
 const reopened=await parseStudio(await serializeStudio(p));assert(!reopened.scenes.some(s=>s.bdsId===next.bdsId));restoreDocument(p,before);assert.equal(p.scenes.length,1);
});
test('removing day boundary merges strips and shifts dates without deleting scenes',()=>{
 const p=createDocument('Film'),b=p.boards[0];p.calendars[0].scheduleDates.ProductionStartDate.iso='2026-10-16';const s1=editScene(p,null,{scene:'A'}),s2=editScene(p,null,{scene:'B'});
 const d1=addDay(p,b.id,{date:'2026-10-16',shootingDayNumber:1}),d2=addDay(p,b.id,{date:'2026-10-19',shootingDayNumber:2});const yard=b.unscheduledGroups[0];d1.strips=[yard.strips.shift()];d2.strips=[yard.strips.shift()];
 // dayBreakKey is the scheduling identity, shared with the UI.
 return import('../assets/scheduling.js').then(({dayBreakKey})=>{assert(deleteStrips(p,b.name,[dayBreakKey(b.name,d1)]));assert.equal(b.scheduledGroups.filter(g=>g.kind==='ScheduleDay').length,1);assert.deepEqual(d2.strips.map(s=>s.bdsId),[s1.bdsId,s2.bdsId]);assert.equal(d2.date,'2026-10-16');assert.equal(d2.shootingDayNumber,1)});
});
test('element counts use occurrences, unique shooting dates and scalar/native built-ins',()=>{
 const p=createDocument('Film'),b=p.boards[0],el=editElement(p,null,{name:'Anna',category:'Cast'}),scene=editScene(p,null,{scene:'1',set:'Casa'},[{elementId:el.id,quantity:2}]);const strip=b.unscheduledGroups[0].strips.shift();const d1=addDay(p,b.id,{date:'2026-10-13',shootingDayNumber:1}),d2=addDay(p,b.id,{date:'2026-10-14',shootingDayNumber:2});d1.strips=[strip,{...strip,sourceKey:'occurrence2'}];d2.strips=[{...strip,sourceKey:'occurrence3'}];const u=elementUsage(p,b.name,el);assert.equal(u.count,3);assert.equal(u.worked,2);assert.equal(u.first,'2026-10-13');assert.equal(u.last,'2026-10-14');assert(sceneUsesElement(p,scene,{id:'set',category:'Set',name:'Casa'}));
});
test('built-in categories are immutable and locked IDs survive bulk assignment',()=>{
 const p=createDocument('Film'),builtin=p.categorySettings.find(c=>c.name==='Set');assert.throws(()=>editCategory(p,builtin.id,{name:'Altro'}),/built-in/);const a=editElement(p,null,{name:'Anna',category:'Cast',boardId:'1',authoring:{lockId:true}}),b=editElement(p,null,{name:'Bruno',category:'Cast',boardId:'2'});
 bulkElementIds(p,[a.id,b.id],{start:10});assert.equal(a.boardId,'1');assert.equal(b.boardId,'10');assert.throws(()=>editElement(p,a.id,{...a,boardId:'99'}),/bloccato/);
 const cat=p.categorySettings.find(c=>c.name==='Cast');editCategory(p,cat.id,{name:'Cast',elementDefaults:{autoAssignIds:true,excludeFromBoard:true,useDailyQuantity:false,allowHold:false}});const c=editElement(p,null,{name:'Carla',category:'Cast'});assert.equal(c.boardId,'2');assert.equal(c.authoring.excludeFromBoard,true);assert.equal(c.authoring.useDailyQuantity,false);
});
test('batch Red Flags target the Cartesian product and validate before creating records',()=>{
 const p=createDocument('Film'),a=editElement(p,null,{name:'Anna',category:'Cast'}),b=editElement(p,null,{name:'Bruno',category:'Cast'});assert.throws(()=>addElementFlags(p,{elementIds:[a.id],dates:['2026-02-30'],type:{name:'Unavailable'}}),/valida/);assert.equal(p.redFlags.length,0);
 addElementFlags(p,{elementIds:[a.id,b.id],dates:['2026-10-13','2026-10-14'],type:{id:'U',name:'Unavailable',type:'unavailable'},note:'OFF'});assert.equal(p.redFlags.length,4);assert.equal(elementUsage(p,p.boards[0].name,a).flags.length,2);
});
test('automatic print scale fits one common width; manual scale remains independent',()=>{
 const items=[{width:350,height:10},{width:300,height:15}],auto=paginateSchedule(items,{scaleMode:'auto',paper:'A4',orientation:'landscape',margin:10,scale:2});assert.equal(auto.contentWidth,350);assert(Math.abs(auto.settings.scale-277/350)<1e-9);assert.equal(auto.pages[0].items[0].fit,1);assert.equal(auto.pages[0].items[1].fit,1);
 const manual=paginateSchedule(items,{scaleMode:'manual',scale:.7});assert.equal(manual.settings.scale,.7);assert.equal(manual.pages[0].items[0].fit,1);
});
for(const format of ['5','3','hybrid'])test(`native ${format}: duplication, deletion and flags keep the original archive`,async()=>{
 const native=await encodeMmsx(fixture(format)),p=await parseMmsx(native),b=p.boards[0],original=b.scheduledGroups.flatMap(g=>g.strips).find(s=>s.kind==='scene');p.documentEditing=true;const [copy]=duplicateStrips(p,b.name,[original.sourceKey]);assert(copy);deleteStrips(p,b.name,[original.sourceKey]);const reopened=await parseStudio(await serializeStudio(p));assert.deepEqual(reopened.mmsxSource.bytes,new Uint8Array(native));assert(reopened.scenes.some(s=>s.bdsId===copy.bdsId));
});
test('auto fit also keeps a tall vertical strip inside the page with one uniform scale',()=>{
 const layout=paginateSchedule([{width:30,height:260},{width:30,height:8}],{scaleMode:'auto'});assert(layout.settings.scale<1);assert.equal(layout.pages[0].items[0].fit,1);assert(layout.pages[0].items[0].height<=layout.contentHeight-17+.000001);
});
test('scene deletion removes every scheduled and Boneyard occurrence across plans and Undo restores the graph',async()=>{
 const {createPlan,validateDocument}=await import('../assets/document-model.js'),{stripDeletionSummary}=await import('../assets/workspace-commands.js');const p=createDocument('Film'),b=p.boards[0],s=insertScene(p,{boardName:b.name}),other=createPlan(p,{name:'Altro',calendarId:b.calendarId,copyFrom:b.id});
 other.unscheduledGroups[0].strips.push({kind:'scene',bdsId:s.scene.bdsId,sourceKey:'extra-yard-occurrence'});const before=snapshotDocument(p),summary=stripDeletionSummary(p,b.name,[s.strip.sourceKey]);assert.equal(summary.sceneCount,1);assert.equal(summary.planCount,2);assert.equal(summary.occurrenceCount,3);
 deleteStrips(p,b.name,[s.strip.sourceKey]);assert.equal(p.scenes.length,0);assert(p.boards.every(b=>[...b.scheduledGroups,...b.unscheduledGroups].every(g=>g.strips.every(strip=>strip.bdsId!==s.scene.bdsId))));assert.equal(validateDocument(p),p);
 const reopened=await parseStudio(await serializeStudio(p));assert.equal(reopened.scenes.length,0);restoreDocument(p,before);assert.deepEqual(snapshotDocument(p),before);assert.equal(validateDocument(p),p);
});
