import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDoodCache,doodWindow} from '../assets/dood-performance.js';
import {calculateDood,doodSummaryCsv} from '../assets/dood-engine.js';
import {catalogElements} from '../assets/element-management.js';
import {createDocument,editScene,snapshotDocument,restoreDocument} from '../assets/document-model.js';
import {sceneValueChoices,sceneValueIndex,singleSceneValue} from '../assets/scene-values.js';

function fixture(){
 const project={format:'msd',elements:[{id:'a',category:'Cast',name:'Anna'},{id:'set',category:'Set',name:'Casa'}],scenes:[
  {id:'s1',bdsId:'s1',set:'Casa',elementRefs:[{elementId:'a',resolved:true},{elementId:'a',resolved:true},{elementId:'set',resolved:true}],fieldElementIds:['a','set']},
  {id:'s2',bdsId:'s2',set:'Casa',elementRefs:[{elementId:'a',resolved:false}]}
 ],events:[],redFlags:[]};
 const board={name:'Plan',scheduledGroups:[{kind:'ScheduleDay',date:'2026-01-01',strips:[{kind:'scene',bdsId:'s2',sourceKey:'2'},{kind:'scene',bdsId:'s1',sourceKey:'1'},{kind:'scene',bdsId:'s1',sourceKey:'copy'}]}]};
 return {project,board};
}
test('indexed attendance deduplicates refs, preserves schedule order and ignores unresolved refs',()=>{
 const {project,board}=fixture(),report=calculateDood({project,board});
 assert.deepEqual(report.rows[0].cells[0].scenes.map(s=>s.scene.id),['s1']);
 assert.deepEqual(report.rows[1].cells[0].scenes.map(s=>s.scene.id),['s2','s1']);
 assert.deepEqual(report.rows[1].cells[0].scenes[1].stripIds,['1','copy']);
 assert.equal(report.rows[1].totals.scene,1);
});
test('DOOD cache reuses attendance and invalidates on edit, Undo, board, category, project and rollback',()=>{
 const {project,board}=fixture(),cache=createDoodCache(),get=(revision=1,b=board,category='Cast',p=project)=>cache.report(p,revision,b,null,category);
 const first=get();assert.equal(get(),first);
 project.scenes[0].elementRefs=[];project.scenes[0].fieldElementIds=[];
 const edited=get(2);assert.notEqual(edited,first);assert.equal(edited.rows[0].totals.scene,0);
 project.scenes[0].fieldElementIds=['a'];assert.equal(get(3).rows[0].totals.scene,1);
 assert.equal(get(3,{name:'Empty',scheduledGroups:[]}).dates.length,0);
 assert.equal(get(3,board,'Set').rows[0].element.category,'Set');
 assert.notEqual(get(3,board,'Set',structuredClone(project)),get(3,board,'Set'));
 const before=get(3);cache.clear();assert.notEqual(get(3),before);
});
test('large DOOD windows bound DOM cells while retaining full totals, dates and CSV',()=>{
 const dates=Array.from({length:365},(_,i)=>({date:String(i)}));
 const rows=Array.from({length:400},(_,i)=>({element:{id:String(i),name:`Actor ${i}`},cells:dates.map(d=>({date:d.date})),totals:{worked:365,held:0}}));
 const report={dates,rows},seen=new Set();
 const first=doodWindow(report,{});assert(first.large);assert(first.rows.length*first.dates.length<=6000);
 for(let rowPage=0;rowPage<first.rowPages;rowPage++)for(let datePage=0;datePage<first.datePages;datePage++){
  const part=doodWindow(report,{rowPage,datePage});
  for(const row of part.rows){assert.equal(row.totals.worked,365);for(const cell of row.cells)seen.add(`${row.element.id}/${cell.date}`)}
 }
 assert.equal(seen.size,400*365);assert.equal(report.rows[0].cells.length,365);assert.equal(doodSummaryCsv(report).split('\r\n').length,401);
 const last=doodWindow(report,{rowPage:999,datePage:999});assert.equal(last.rows.at(-1).element.id,'399');assert.equal(last.dates.at(-1).date,'364');
 const small=doodWindow({rows:rows.slice(0,2),dates:dates.slice(0,3)},{});assert.equal(small.large,false);
});
test('catalog projection reads only the requested field and keeps source IDs and exact names',()=>{
 const p=createDocument('Film');p.elements=[{id:'native',category:'Set',name:'Casa'}];
 p.scenes=[{id:'s',bdsId:'s',set:'Casa',elementRefs:[]},{id:'t',bdsId:'t',set:' Casa ',elementRefs:[]}];
 Object.defineProperty(p.scenes[0],'location',{get(){throw Error('Unrelated scene field scanned')}});
 const choices=sceneValueChoices(p,'set');assert.equal(choices.find(c=>c.name==='Casa').id,'native');assert(choices.some(c=>c.name===' Casa '));
 assert.equal(catalogElements(p,'set').length,2);
});
test('operation-scoped scene indexes reflect element renames and Undo',()=>{
 const p=createDocument('Film');editScene(p,null,{scene:'1',set:'Casa',dn:'Day'});const before=snapshotDocument(p);
 const index=sceneValueIndex(p);for(const field of ['set','dn','ie'])assert.deepEqual(singleSceneValue(p,p.scenes[0],field,index),singleSceneValue(p,p.scenes[0],field));
 editScene(p,p.scenes[0].id,{set:'Bar'});assert.equal(singleSceneValue(p,p.scenes[0],'set',sceneValueIndex(p)).name,'Bar');
 restoreDocument(p,before);assert.equal(singleSceneValue(p,p.scenes[0],'set',sceneValueIndex(p)).name,'Casa');
});
