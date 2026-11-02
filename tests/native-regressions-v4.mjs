import {test} from 'node:test';import assert from 'node:assert/strict';
import {syntheticProject} from './fixtures/persistence.mjs';
import {createPlan} from '../assets/document-model.js';
import {analyzeExport,commonMmsxRoot,commonMsdSections} from '../assets/export-adapters.js';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';
import {mmsxFixture} from './fixtures/mmsx.mjs';import {cloneExact,encodeMmsx} from '../assets/mmsx-codec.js';
import {palette} from '../assets/mmsx-palette.js';import {scenePlacementConflicts} from '../assets/project-model.js';
test('one scene cannot occupy two segments or a segment and Boneyard in one parent, alternatives remain valid',async()=>{
 const p=syntheticProject(true);assert.equal(scenePlacementConflicts(p).length,0);p.boards[1].parentBoardId=p.boards[0].parentBoardId;
 assert(analyzeExport(p,'mmsx').blockers.some(x=>x.code==='duplicate-scene-placement'));await assert.rejects(()=>serializeMmsx(p,'x',{acceptLoss:true}),/più istanze/);
 const q=syntheticProject(true);createPlan(q,{name:'Alternative 3',calendarId:q.calendars[0].id,copyFrom:q.boards[0].id});assert.equal(analyzeExport(q,'mmsx').blockers.length,0);
});
test('native passthrough also blocks invalid scene placements',async()=>{
 const root=cloneExact(mmsxFixture);root.contents.stripboard.board.segmentMap.b.stripMap.duplicate={type:'breakdown',sheet:'s1',sortOrder:0};
 const p=await parseMmsx(await encodeMmsx(root));assert(analyzeExport(p,'mmsx').blockers.some(x=>x.code==='duplicate-scene-placement'));await assert.rejects(()=>serializeMmsx(p,'x',{acceptLoss:true}),/più istanze/);
});
test('vertical schema includes native protected CAST and timeOfDay cells',()=>{
 const root=commonMmsxRoot(syntheticProject(true));const l=Object.values(root.contents.layout).find(x=>x.type==='vertical');assert(l.design.cells.some(c=>c.key==='CAST'&&c.frozen));assert(l.design.cells.some(c=>c.key==='timeOfDay'));assert(l.design.cells.some(c=>c.orient==='normal'&&c.minWidth===12));
});
test('events have explicit colors and distinct record identities per segment copy; plain native events remain plain',async()=>{
 const p=syntheticProject(true);p.events.push({...p.events[0],id:'native-none',type:'none',name:'Ordinary event',color:'#10457A'});const root=commonMmsxRoot(p),events=Object.values(root.contents.stripboard).flatMap(b=>Object.values(b.segmentMap)).flatMap(s=>Object.values(s.calendar?.eventMap||{}));assert.equal(events.length,4);assert.equal(new Set(events.map(e=>e.id)).size,4);assert(events.every(e=>e.color==='#10457A'));assert.equal(events.filter(e=>e.type==='none').length,2);
 const q=await parseMmsx(await serializeMmsx(p,'x',{acceptLoss:true}));assert(q.events.some(e=>e.type==='none'&&e.name==='Ordinary event'));
});
test('MMSX colors are native palette values in sheets and matching rules; legacy zero defaults to one',()=>{
 const p=syntheticProject(true),root=commonMmsxRoot(p),s=Object.values(Object.values(root.contents.breakdown)[0].sheetMap)[0];assert.equal(palette[s.backgroundColor],'#FCFA7C');assert.equal(palette[s.color],'#333333');assert(Object.values(root.contents.rules).some(r=>r.intExt===s.intExt&&r.dayNight===s.dayNight&&r.backgroundColor===s.backgroundColor));
 const zero=Object.values(root.contents.element).find(e=>e.name==='Oggetto a quantità zero');assert.equal(s.elements[zero.id],1);
});
test('MSD DN matches the row label exactly and RGB matrix/palette are colored',()=>{
 const p=syntheticProject(true),sections=commonMsdSections(p);assert.match(sections.BreakdownSheetMgr,/DN="Day"/);assert.doesNotMatch(sections.BreakdownSheetMgr,/DN="DAY"/);assert.match(sections.ColorSettings,/RowNumber="0" ColumnNumber="0" Fg="51,51,51" Bg="252,250,124"/);assert.match(sections.ColorSettings,/Color RGB="255,255,102"/);assert.doesNotMatch(sections.ElementMgr,/CategoryName="D\/N"/);
});
test('unverified global event targeting is explicitly reported, not silently encoded as an element',async()=>{
 const p=syntheticProject(true);p.events[0].targets.push({kind:'project'});assert(analyzeExport(p,'mmsx').omitted.some(x=>x.code==='unverified-global-event-targets'&&x.count===1));const root=commonMmsxRoot(p),event=Object.values(Object.values(Object.values(root.contents.stripboard)[0].segmentMap)[0].calendar.eventMap)[0];assert.equal(event.elements.length,1);
});
test('native MMSX rule colors survive common model, Studio and complete editing including unused combinations',async()=>{
 const {serializeStudio,parseStudio}=await import('../assets/studio-project.js');
 const p=syntheticProject(true),root=commonMmsxRoot(p);
 const initial=Object.values(root.contents.rules);assert(initial.length>2);
 const unused=initial.find(r=>!Object.values(root.contents.breakdown).flatMap(b=>Object.values(b.sheetMap)).some(s=>s.intExt===r.intExt&&s.dayNight===r.dayNight));assert(unused);
 unused.backgroundColor='color0';
 const q=await parseMmsx(await encodeMmsx(root));assert.equal(q.colors.nativeRules.length,initial.length);
 const snapshot=await serializeStudio(q),stored=await parseStudio(snapshot);assert.deepEqual(stored.colors,q.colors);
 stored.scenes[0].comments='Complete edit triggers reconstruction';const rebuilt=await parseMmsx(await serializeMmsx(stored,'test.mmsx',{acceptLoss:true}));
 assert.deepEqual(rebuilt.scenes.map(s=>s.mmsxColors),q.scenes.map(s=>s.mmsxColors));
 const nativeUnused=q.colors.nativeRules.find(r=>r.id===unused.id),roundUnused=rebuilt.colors.nativeRules.find(r=>r.intExt===nativeUnused.intExt&&r.dayNight===nativeUnused.dayNight);assert.equal(roundUnused.bg,palette.color0);
 const row=Object.keys(stored.colors.rows).find(i=>stored.colors.rows[i].toUpperCase()==='DAY'),col=Object.keys(stored.colors.columns).find(i=>stored.colors.columns[i]==='INT');stored.colors.cells[`${row}:${col}`]={bg:'#0029F8',fg:'#FFFFFF'};stored.colors.combinationEditing=true;
 const edited=await parseMmsx(await serializeMmsx(stored,'edit.mmsx',{acceptLoss:true}));assert.equal(edited.scenes[0].mmsxColors.bg,'#0029F8');assert.equal(edited.scenes[0].mmsxColors.fg,'#FFFFFF');
});
test('old Studio v2/v3 snapshots recover missing native palette rules from the preserved archive',async()=>{
 const {serializeStudio,parseStudio}=await import('../assets/studio-project.js'),{snapshotDocument}=await import('../assets/document-model.js');
 const p=await parseMmsx(await encodeMmsx(commonMmsxRoot(syntheticProject(true))));
 const v3=JSON.parse(new TextDecoder().decode(await serializeStudio(p)));v3.document.value.colors={preferences:p.colors.preferences};
 const q=await parseStudio(new TextEncoder().encode(JSON.stringify(v3)));assert.deepEqual(q.colors.nativeRules,p.colors.nativeRules);assert.deepEqual(q.colors.cells,p.colors.cells);
 const document=snapshotDocument(p),colors={preferences:p.colors.preferences};document.colors=colors;
 const v2={type:'stripboard-studio',version:2,fileName:p.fileName,format:'mmsx',native:v3.native,document,views:{stripLayouts:p.stripLayouts,reportLayouts:p.reportLayouts,colors}};
 const r=await parseStudio(new TextEncoder().encode(JSON.stringify(v2)));assert.deepEqual(r.colors.nativeRules,p.colors.nativeRules);assert.deepEqual(r.colors.cells,p.colors.cells);
});
test('custom MMSX color approximation and MSD per-scene conflict are disclosed before export',()=>{
 const p=syntheticProject(true);p.colors.combinationEditing=false;p.scenes[0].mmsxColors={bg:'#FF0000',fg:'#FFFFFF'};
 assert(analyzeExport(p,'mmsx').transformed.some(x=>x.code==='native-color-approximation'&&x.count>0));assert(analyzeExport(p,'msd').omitted.some(x=>x.code==='per-scene-color-overrides'&&x.count===1));
 const root=commonMmsxRoot(p),scene=Object.values(Object.values(root.contents.breakdown)[0].sheetMap)[0];assert.equal(palette[scene.backgroundColor],'#FA003F');
});
test('legacy scene placement conflicts can be repaired incrementally without permitting new conflicts or export',async()=>{
 const {validateDocument,snapshotDocument}=await import('../assets/document-model.js');const p=syntheticProject(true);p.format='mmsx';p.boards[1].parentBoardId=p.boards[0].parentBoardId;
 p.boards[0].scheduledGroups[0].strips.push({kind:'scene',bdsId:p.scenes[1].bdsId,sourceKey:'legacy-duplicate-scene2'});const before=snapshotDocument(p);assert.equal(scenePlacementConflicts(p).length,2);
 p.boards[1].scheduledGroups[0].strips=p.boards[1].scheduledGroups[0].strips.filter(s=>s.bdsId!==p.scenes[0].bdsId);assert.equal(scenePlacementConflicts(p).length,1);assert.throws(()=>validateDocument(p,{requireUniqueMmsxScenes:true}),/più volte/);
 validateDocument(p,{requireUniqueMmsxScenes:true,repairFrom:before});assert(analyzeExport(p,'mmsx').blockers.some(x=>x.code==='duplicate-scene-placement'));
 p.boards[0].scheduledGroups[0].strips.push({kind:'scene',bdsId:p.scenes[1].bdsId,sourceKey:'new-invalid-copy'});assert.throws(()=>validateDocument(p,{requireUniqueMmsxScenes:true,repairFrom:before}),/più volte/);
});
