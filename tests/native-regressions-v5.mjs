import {test} from 'node:test';import assert from 'node:assert/strict';
import {syntheticProject} from './fixtures/persistence.mjs';import {snapshotDocument,editElement,editScene} from '../assets/document-model.js';
import {commonMsdSections,analyzeExport,commonMmsxRoot} from '../assets/export-adapters.js';import {projectMsdElements,projectMsdBoards,projectMsdRedFlags,readMsdFlagType} from '../assets/native-export-projections.js';
import {serializeMmsx,parseMmsx} from '../assets/mmsx-project.js';import {encodeMmsx} from '../assets/mmsx-codec.js';
import {serializeStudio,parseStudio} from '../assets/studio-project.js';
test('MMSX writes positive numeric associations, default one and no zero; Studio keeps original quantities',async()=>{
 const p=syntheticProject(true),before=snapshotDocument(p),root=commonMmsxRoot(p),sheets=Object.values(root.contents.breakdown)[0].sheetMap;
 for(const s of Object.values(sheets))for(const q of Object.values(s.elements))assert(typeof q==='number'&&q>0);
 const q=await parseMmsx(await serializeMmsx(p,'out.mmsx',{acceptLoss:true}));assert.equal(q.scenes[0].elementRefs.find(r=>r.name==='Oggetto a quantità zero').quantity,1);assert.equal(q.scenes[0].elementRefs.find(r=>r.name==='Tazzina blu').quantity,1);assert(q.elements.some(e=>e.name==='Oggetto a quantità zero'));
 assert.deepEqual(snapshotDocument(p),before);const stored=await parseStudio(await serializeStudio(p));assert.equal(JSON.stringify(snapshotDocument(stored)),JSON.stringify(before));
 await assert.rejects(()=>serializeMmsx(p,'out.mmsx'),/Conferma/);
});
test('previous synthetic MMSX with empty-object/zero quantities is rebuilt explicitly rather than replayed',async()=>{
 const root=commonMmsxRoot(syntheticProject(true)),sheet=Object.values(Object.values(root.contents.breakdown)[0].sheetMap)[0],eid=Object.keys(sheet.elements)[0];sheet.elements[eid]={};
 const p=await parseMmsx(await encodeMmsx(root));assert.equal(analyzeExport(p,'mmsx').mode,'rebuild');assert(analyzeExport(p,'mmsx').transformed.some(x=>x.code==='default-element-quantities'));const q=await parseMmsx(await serializeMmsx(p,'fixed.mmsx',{acceptLoss:true}));assert.equal(q.scenes[0].elementRefs[0].quantity,1);
});
test('every MSD plan receives the catalog complement at the tail of its existing Boneyard exactly once',()=>{
 const p=syntheticProject(true),before=snapshotDocument(p);p.boards[0].unscheduledGroups.forEach(g=>g.strips=g.strips.filter(s=>s.bdsId!==p.scenes[1].bdsId));
 const source=snapshotDocument(p),projection=projectMsdBoards(p),board=projection[0];assert.deepEqual(board.missing.map(s=>s.scene),['2']);assert.equal(board.unscheduledGroups.at(-1).strips.at(-1).bdsId,p.scenes[1].bdsId);
 for(const {board,unscheduledGroups} of projection){const ids=[...board.scheduledGroups,...unscheduledGroups].flatMap(g=>g.strips).filter(s=>s.kind==='scene').map(s=>s.bdsId);assert.equal(ids.length,p.scenes.length);assert.equal(new Set(ids).size,p.scenes.length)}
 assert.deepEqual(snapshotDocument(p),source);assert(analyzeExport(p,'msd').transformed.some(x=>x.code==='msd-complete-boards'&&x.count===1));assert.notDeepEqual(source,before);
});
test('MSD suffix quantity variants preserve links and flags with nonempty unique Board IDs',()=>{
 const p=syntheticProject(true),actor=p.elements.find(e=>e.name==='Èlia'),prop=p.elements.find(e=>e.name==='Tazzina blu');prop.linkedElements=[['Cast',actor.name]];p.redFlags[0].target={kind:'element',elementId:prop.id,category:prop.category,element:prop.name};
 const before=snapshotDocument(p),projection=projectMsdElements(p),variants=projection.byOriginal.get(prop.id);assert.deepEqual(variants.map(e=>e.name),['Tazzina blu','Tazzina blu (3)']);assert(variants.every(e=>e.boardId));assert.equal(new Set(variants.map(e=>e.boardId)).size,2);assert.deepEqual(variants[0].linkedElements,[['Cast','Èlia']]);
 assert.match(commonMsdSections(p).RedFlagMgr,/Element="Tazzina blu \(3\)"/);assert.deepEqual(snapshotDocument(p),before);
});
test('MSD refuses names colliding with a generated quantity suffix',()=>{
 const p=syntheticProject(true);editElement(p,null,{name:'Tazzina blu (3)',category:'Props'});assert(analyzeExport(p,'msd').blockers.some(x=>x.code==='quantity-name-collision'));
});
test('reserved MSD DOOD definitions exist even without entries, with observed Travel/Fitting status bits',()=>{
 const p=syntheticProject(),xml=commonMsdSections(p).RedFlagMgr;for(const name of ['Travel - DOOD','Fitting - DOOD','Unavailable','Rehearsal - DOOD'])assert(xml.includes(`Name="${name}" SortOrder="-1"`));assert.match(xml,/SortRedFlagsBy="0" SortOrderRedFlags="0"/);assert.equal(readMsdFlagType('Fitting - DOOD','4096'),'fitting');assert.equal(readMsdFlagType('Travel - DOOD','16384'),'travel');assert.equal(readMsdFlagType('Custom','0'),null);
});
test('system events become per-element/date MSD flags with title and note, copies deduplicate; ordinary events remain disclosed and Rehearsal uncertainty is explicit',()=>{
 const p=syntheticProject(true),e=p.events[0];p.events=[e,{...e,id:'copy'},{...e,id:'travel',name:'Trasferta',type:'travel'},{...e,id:'ordinary',type:'none'},{...e,id:'rehearsal',type:'rehearsal'}];
 const projection=projectMsdRedFlags(p),generated=projection.entries.filter(f=>f.fromEvent);assert.equal(generated.length,6);assert.equal(generated.filter(f=>f.doodStatus==='4096').length,2);assert.equal(generated.filter(f=>f.doodStatus==='16384').length,2);assert(generated.every(f=>f.target.elementId===e.targets[0].elementId));assert(generated.some(f=>f.note==='Prova costumi — Evento inventato'));
 const report=analyzeExport(p,'msd');assert(report.transformed.some(x=>x.code==='events-to-redflags'&&x.count===4));assert(report.omitted.some(x=>x.code==='events'&&x.count===1));assert(report.transformed.some(x=>x.code==='rehearsal-status'));assert.equal(generated.filter(f=>f.type==='rehearsal'&&f.doodStatus==='0').length,2);assert.match(commonMsdSections(p).RedFlagMgr,/DOODStatus="4096"/);
});
test('invalid dates or unresolved recipients in converted events block MSD output',()=>{
 const p=syntheticProject(true);p.events[0].endDate='2026-02-30';assert(analyzeExport(p,'msd').blockers.some(x=>x.code==='range'));p.events[0].endDate='2026-10-07';p.events[0].targets[0].elementId='missing';assert(analyzeExport(p,'msd').blockers.some(x=>x.code==='target-ref'));
});

test('global native flags keep observed zero, including Rehearsal, while every reserved definition is mandatory',()=>{const p=syntheticProject(true);p.events=[];p.redFlags=[{...p.redFlags[0],name:'Rehearsal - DOOD',type:'rehearsal',doodStatus:'0',target:{kind:'project'}}];const projection=projectMsdRedFlags(p);assert(projection.entries.every(f=>f.doodStatus==='0'));assert(projection.definitions.filter(f=>f.sortOrder===-1).length>=4);});
