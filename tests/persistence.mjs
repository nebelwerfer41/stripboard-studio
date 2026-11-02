import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syntheticProject} from './fixtures/persistence.mjs';
import {analyzeExport,requireExport} from '../assets/export-adapters.js';
import {serializeMmsx,parseMmsx} from '../assets/mmsx-project.js';
import {parseStudio,serializeStudio} from '../assets/studio-project.js';
import {encodeMmsx,ExactNumber} from '../assets/mmsx-codec.js';
import {fixture} from './fixtures/calendar.mjs';
import {snapshotDocument} from '../assets/document-model.js';
for(const complex of [false,true])test(`common MMSX export, new ${complex?'complex':'minimal'} project`,async()=>{
 const p=syntheticProject(complex),before=snapshotDocument(p),report=analyzeExport(p,'mmsx');assert.deepEqual(report.blockers,[]);
 await assert.rejects(()=>serializeMmsx(p,'out.mmsx'),/Conferma/);
 const q=await parseMmsx(await serializeMmsx(p,'out.mmsx',{acceptLoss:true}));
 assert.deepEqual(snapshotDocument(p),before);assert.equal(q.scenes.length,p.scenes.length);assert.equal(q.boards.length,p.boards.length);
 if(complex){assert.equal(q.scenes[0].scene,'1A');assert.equal(q.scenes[0].comments,p.scenes[0].comments);assert.equal(q.scenes[0].elementRefs.find(r=>r.name==='Èlia').quantity,1);assert.equal(q.scenes[0].elementRefs.find(r=>r.name==='Tazzina blu').quantity,1);assert.equal(q.redFlags.length,1);assert.equal(q.events.length,2);assert.equal(q.redFlags[0].endDate,'2026-10-08')}
});
test('v3 preserves exact numbers, source archive and shared yard without documentEditing',async()=>{
 const root=fixture();root.contents.breakdown.main.sheetMap.s1.elements.actor=new ExactNumber('900719925474099399');
 const bytes=await encodeMmsx(root),p=await parseMmsx(bytes);p.scenes[0].synopsis='Modifica corrente senza flag';
 const q=await parseStudio(await serializeStudio(p));assert(q.scenes[0].elementRefs[0].quantity instanceof ExactNumber);assert.equal(q.scenes[0].elementRefs[0].quantity.text,'900719925474099399');assert.deepEqual(q.mmsxSource.bytes,bytes);assert.equal(q.scenes[0].synopsis,p.scenes[0].synopsis);assert.equal(q.boards[0].unscheduledGroups,q.boards[1].unscheduledGroups);assert.equal(analyzeExport(q,'mmsx').mode,'rebuild');
});
test('export blockers cannot be bypassed by accepting losses',async()=>{
 const p=syntheticProject(true);p.scenes[0].elementRefs[0].elementId='missing';assert(analyzeExport(p,'mmsx').blockers.some(x=>x.code==='element-ref'));await assert.rejects(()=>serializeMmsx(p,'out',{acceptLoss:true}),/non risolto/);
 const b=syntheticProject(true);b.boards[0].scheduledGroups[0].date='2026-10-10';assert(analyzeExport(b,'msd').blockers.length);assert.throws(()=>requireExport(b,'msd',{acceptLoss:true}));
});
test('v1 and v2 migrate to v3, with current model authoritative and original bytes retained',async()=>{
 const bytes=await encodeMmsx(fixture()),native=Buffer.from(bytes).toString('base64');
 const v1={type:'stripboard-studio',version:1,fileName:'legacy.mmsx',native,studio:{version:1,dood:{},print:{}},events:[]};
 const p=await parseStudio(new TextEncoder().encode(JSON.stringify(v1)));assert.deepEqual(await serializeMmsx(p,'out'),bytes);
 const doc=snapshotDocument(p);doc.scenes[0].synopsis='Modificato in v2';doc.documentEditing=true;
 const v2={type:'stripboard-studio',version:2,fileName:'legacy.mmsx',native,format:'mmsx',document:doc,views:{stripLayouts:p.stripLayouts,reportLayouts:p.reportLayouts,colors:p.colors}};
 const q=await parseStudio(new TextEncoder().encode(JSON.stringify(v2))),v3=await serializeStudio(q),again=await parseStudio(v3);
 assert.equal(JSON.parse(new TextDecoder().decode(v3)).version,3);assert.equal(again.scenes[0].synopsis,'Modificato in v2');assert.deepEqual(again.mmsxSource.bytes,bytes);assert.equal(again.boards[0].unscheduledGroups,again.boards[1].unscheduledGroups);
});
test('native export cannot replay the old archive after a banner or production edit without flags',async()=>{
 const p=syntheticProject(true),bytes=await serializeMmsx(p,'source.mmsx',{acceptLoss:true}),q=await parseMmsx(bytes);
 q.boards[0].scheduledGroups[0].strips.find(s=>s.kind==='banner').text='Banner aggiornato';
 assert.equal(analyzeExport(q,'mmsx').mode,'rebuild');
 const again=await parseMmsx(await serializeMmsx(q,'out.mmsx',{acceptLoss:true}));assert.equal(again.boards[0].scheduledGroups[0].strips.find(s=>s.kind==='banner').text,'Banner aggiornato');
 q.production.title='Titolo corrente';q.title='Titolo corrente';assert.equal(analyzeExport(q,'mmsx').mode,'rebuild');
});
test('unchanged native archive remains byte-identical even after entering complete editing',async()=>{
 const bytes=await serializeMmsx(syntheticProject(),'source.mmsx',{acceptLoss:true}),p=await parseMmsx(bytes);p.documentEditing=true;
 assert.equal(analyzeExport(p,'mmsx').mode,'native');assert.deepEqual(await serializeMmsx(p,'out.mmsx'),bytes);
});
test('Studio keeps legacy metadata while active quantities and MMSX use one for defaults',async()=>{
 const p=syntheticProject(true),stored=await parseStudio(await serializeStudio(p));assert.equal(stored.scenes[0].elementRefs.find(r=>r.name==='Tazzina blu').quantity,1);assert.equal(stored.scenes[0].elementRefs.find(r=>r.name==='Oggetto a quantità zero').quantity,1);assert.equal(stored.scenes[0].elementRefs.find(r=>r.name==='Oggetto a quantità zero').legacyQuantity,0);
 const report=analyzeExport(p,'mmsx');assert(report.transformed.some(x=>x.code==='default-element-quantities'));
 const q=await parseMmsx(await serializeMmsx(p,'out.mmsx',{acceptLoss:true}));assert.equal(q.scenes[0].elementRefs.find(r=>r.name==='Oggetto a quantità zero').quantity,1);
});
test('direct start-date edits without origin flags rebuild from current model',async()=>{
 const bytes=await serializeMmsx(syntheticProject(true),'source.mmsx',{acceptLoss:true}),p=await parseMmsx(bytes);
 p.calendars[0].scheduleDates.ProductionStartDate.iso='2026-10-05';
 assert.equal(analyzeExport(p,'mmsx').mode,'rebuild');const q=await parseMmsx(await serializeMmsx(p,'out.mmsx',{acceptLoss:true}));assert(q.calendars.some(c=>c.scheduleDates.ProductionStartDate.iso==='2026-10-05'));
});
