import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syntheticProject} from './fixtures/persistence.mjs';
import {commonMmsxRoot,commonMsdSections} from '../assets/export-adapters.js';
import {ExactNumber,decodeMmsx} from '../assets/mmsx-codec.js';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function check(root){
 const c=root.contents;assert.equal(root.dataFormat,5);assert(root.requires);assert(root.settings);
 for(const name of ['category','element','breakdown','stripboard','rules','redflag','redflagType','layout'])assert(c[name],name);
 for(const name of ['category','element','breakdown','stripboard','rules','redflag','redflagType','layout'])for(const [id,record] of Object.entries(c[name])){assert(uuid.test(id),`${name}: UUID`);assert.equal(record.id,id,`${name}: embedded identity`)}
 for(const code of ['intExt','dayNight','set','location','scriptDay','unit','sequence','episode'])assert(Object.values(c.category).some(x=>x.code===code),code);
 for(const e of Object.values(c.element)){if(!e.category_id)continue;const cat=c.category[e.category_id];assert(cat);for(const key of Object.keys(e.properties||{})){assert(uuid.test(key));assert(cat.propertyDesc[key],`definition for property ${key}`)}}
 for(const b of Object.values(c.breakdown))for(const [id,s] of Object.entries(b.sheetMap)){assert.equal(s.id,id);assert(uuid.test(id));for(const key of Object.keys(s.elements))assert(c.element[key]);for(const f of ['intExt','dayNight','set','location','unit','sequence','episode','scriptDay'])if(s[f])assert(c.element[s[f]])}
 for(const b of Object.values(c.stripboard))for(const [id,s] of Object.entries(b.segmentMap)){assert.equal(s.id,id);if(s.type==='normal')assert(s.calendar);for(const [id,r] of Object.entries(s.stripMap)){assert.equal(r.id,id);if(r.type==='breakdown')assert(Object.values(c.breakdown).some(b=>b.sheetMap[r.sheet]))}for(const [id,e] of Object.entries(s.calendar?.eventMap||{})){assert.equal(e.id,id);for(const eid of e.elements)assert(c.element[eid])}}
 for(const type of ['stripboard','breakdown','breakDownActions','reportHeader','dood','calendar','oneline'])assert(Object.values(c.layout).some(l=>l.type===type),type);
}
for(const complex of [false,true])test(`independent native record/UUID/reference/schema checks (${complex})`,()=>check(commonMmsxRoot(syntheticProject(complex))));
test('MSD property schema matches observed type and element text, complete defaults',()=>{
 const s=commonMsdSections(syntheticProject(true));assert.equal(Object.keys(s).length,11);assert(!s.Schedule);assert(!s.PrintViewOptions);assert.match(s.CategoryMgr,/Type="1"/);assert.doesNotMatch(s.CategoryMgr,/Type="0"/);assert.match(s.ElementMgr,/<Property Name="count">0<\/Property>/);assert.match(s.ElementMgr,/<ElementMgrPreferences>/);assert.match(s.BreakdownSheetMgr,/<BreakdownSheetMgrPreferences>/);assert.match(s.DOODLayoutMgr,/<DOODLayout>/);assert.match(s.ReportLayoutMgr,/<ReportLayout /);
});
if(process.env.MMSX_SAMPLE)test('supplied native sample: schema and binary no-op; complete edit is current',async()=>{
 const bytes=fs.readFileSync(process.env.MMSX_SAMPLE);check(await decodeMmsx(bytes));const p=await parseMmsx(bytes);assert.equal(p.scenes.length,146);assert.deepEqual(Buffer.from(await serializeMmsx(p,'no-op.mmsx')),bytes);
 p.documentEditing=true;p.scenes[0].synopsis='Verifica sintetica di modifica';const root=await decodeMmsx(await serializeMmsx(p,'edited.mmsx',{acceptLoss:true}));check(root);assert(Object.values(root.contents.breakdown).some(b=>Object.values(b.sheetMap).some(s=>s.synopsis==='Verifica sintetica di modifica')));
});

test('UUID rewrites preserve exact quantities and literal names',async()=>{const p=syntheticProject(true);p.scenes[0].elementRefs.find(r=>r.name==='Tazzina blu').quantity=new ExactNumber('900719925474099399');const q=await parseMmsx(await serializeMmsx(p,'test.mmsx',{acceptLoss:true}));assert.equal(q.scenes[0].elementRefs.find(r=>r.name==='Tazzina blu').quantity.text,'900719925474099399');assert.equal(q.redFlags[0].name,'Indisponibile')});
for(const complex of [false,true])test(`report and Red Flag navigation schemas (${complex})`,()=>{
 const root=commonMmsxRoot(syntheticProject(complex)),c=root.contents;
 const globalTargets=Object.values(c.element).filter(e=>e.name===''&&!e.category_id);assert.equal(globalTargets.length,1);assert.equal(globalTargets[0].sortOrder,-1);assert.deepEqual(globalTargets[0].properties,{});
 for(const type of ['travel','fitting','unavailable','rehearsal'])assert(Object.values(c.redflagType).some(t=>t.system&&t.type===type));
 const report=Object.values(c.layout).find(l=>l.type==='calendarreport');assert.equal(report.title,'Calendar');assert(Array.isArray(report.filtered));for(const key of ['saturdays','sundays','events','strips','redflags','pagenumbers'])assert.equal(typeof report.controls[key],'boolean');assert(!report.dayDesign);
 assert.equal(Object.values(c.layout).find(l=>l.type==='elementList').title,'Element List');assert.equal(Object.values(c.layout).find(l=>l.type==='oneline').title,'One-line Schedule');
 const cellIds=[];for(const l of Object.values(c.layout))for(const f of ['design','dayDesign','shootDayDesign'])for(const cell of l[f]?.cells||[])cellIds.push(cell.id);assert.equal(new Set(cellIds).size,cellIds.length);
 for(const b of Object.values(c.stripboard))for(const s of Object.values(b.segmentMap)){assert(/^\d{8}$/.test(s.calendar.prodStart));if(s.type==='boneyard')for(const r of Object.values(s.stripMap)){assert(!Object.hasOwn(r,'date'));assert(!Object.hasOwn(r,'shootDay'))}}
});

test('native reference rewriting never changes a strip type or literal property data',()=>{const p=syntheticProject(true),old=p.scenes[0].bdsId;p.scenes[0].bdsId='breakdown';for(const b of p.boards)for(const g of [...b.scheduledGroups,...b.unscheduledGroups])for(const strip of g.strips)if(strip.bdsId===old)strip.bdsId='breakdown';p.elements[0].properties.literal={id:'breakdown',type:'breakdown'};const root=commonMmsxRoot(p);for(const b of Object.values(root.contents.stripboard))for(const s of Object.values(b.segmentMap))for(const r of Object.values(s.stripMap))assert(['breakdown','day','banner'].includes(r.type));assert(Object.values(root.contents.element).some(e=>Object.values(e.properties||{}).some(v=>v?.id==='breakdown'&&v?.type==='breakdown')))});

test('existing standard flag types are reused rather than duplicating Unavailable',()=>{const p=syntheticProject(true);p.redFlags[0].name='Unavailable';p.redFlags[0].type='unavailable';const c=commonMmsxRoot(p).contents;const types=Object.values(c.redflagType).filter(t=>t.name==='Unavailable');assert.equal(types.length,1);assert.equal(types[0].system,true);assert.equal(c.redflag[Object.keys(c.redflag)[0]].type,types[0].id)});
