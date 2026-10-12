import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateDood,doodElements} from '../assets/dood-engine.js';
import {fixture} from './fixtures/calendar.mjs';
import {encodeMmsx} from '../assets/mmsx-codec.js';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';
import {moveBoardItems,snapshotBoardFamily,restoreBoardFamily} from '../assets/scheduling.js';

test('MSD scalar fields reuse native IDs and expose missing built-ins without changing the project',()=>{
 const fields={set:'Studio',location:'Rome',scriptDay:'1',unit:'Main',sequence:'Opening',dn:'DAY',ie:'INT'};
 const calendar={id:'cal',daysOff:{Mon:'0',Tue:'0',Wed:'0',Thu:'0',Fri:'0',Sat:'0',Sun:'0'},specialDays:[]};
 const board={name:'Plan',calendarId:'cal',scheduledGroups:[1,2].map((n,i)=>({kind:'ScheduleDay',date:`2026-10-0${n+4}`,shootingDayNumber:n,strips:[{kind:'scene',bdsId:`s${i}`,sourceKey:`strip${i}`}]})),unscheduledGroups:[]};
 const project={format:'msd',elements:[{id:'set',category:'Set',name:'Studio'},{id:'unused',category:'Set',name:'Unused'},{id:'custom',category:'Set Dressing',name:'Studio'}],
  scenes:[{bdsId:'s0',...fields,elementRefs:[]},{bdsId:'s1',...fields,dn:'NIGHT',ie:'EXT',elementRefs:[]}],boards:[board],events:[]};
 const before=JSON.stringify(project),elements=doodElements(project),report=calculateDood({project,board,calendar});
 assert.equal(elements.find(e=>e.category==='Set'&&e.name==='Studio').id,'set');
 assert.equal(elements.filter(e=>e.category==='Set'&&e.name==='Studio').length,1);
 assert.equal(report.rows.find(r=>r.element.id==='set').totals.scene,2);
 assert.equal(report.rows.find(r=>r.element.id==='unused').totals.worked,0);assert.equal(report.rows.find(r=>r.element.id==='custom').totals.worked,0);
 for(const category of ['Set','Location','Script Day','Unit','Sequence'])assert.equal(report.rows.find(r=>r.element.category===category).totals.scene,2);
 for(const [category,name] of [['DN','DAY'],['DN','NIGHT'],['INT/EXT','INT'],['INT/EXT','EXT']]){
  const row=report.rows.find(r=>r.element.category===category&&r.element.name===name);assert.equal(row.totals.scene,1);assert(row.cells.some(c=>c.codes.includes('SWF')));
 }
 assert.deepEqual(doodElements(project),elements);assert.equal(JSON.stringify(project),before);
 // Filtering with native catalog elements also resolves scalar attendance.
 assert.equal(calculateDood({project,board,calendar,elements:[project.elements[0]]}).rows[0].totals.scene,2);
});

for(const format of ['5','3','hybrid'])test(`MMSX ${format}: built-ins follow exact native IDs, moves and save/reopen`,async()=>{
 const root=fixture(format),c=root.contents;
 const bindings={set:['Set','set'],intExt:['INT/EXT','ie'],dayNight:['DN','dn'],location:['Location','location'],scriptDay:['Script Day','script'],unit:['Unit','unit'],sequence:['Sequence','sequence']};
 for(const [field,[category,id]] of Object.entries(bindings)){
  c.category[`builtin-${field}`]={name:category};c.element[id]={...c.element[id],name:c.element[id]?.name||'Same name',category_id:`builtin-${field}`};
 }
 c.element['duplicate-set']={name:c.element.set.name,category_id:'builtin-set'};
 const sheets=c.breakdown.main.sheetMap?Object.values(c.breakdown.main.sheetMap):c.breakdown.main.sheets;
 for(const sheet of sheets)for(const [field,[,id]] of Object.entries(bindings))sheet[field]=id;
 const bytes=await encodeMmsx(root),project=await parseMmsx(bytes),board=project.boards[0],calendar=project.calendars.find(c=>c.id===board.calendarId),before=JSON.stringify(project.scenes);
 const report=calculateDood({project,board,calendar});
 for(const [,id] of Object.values(bindings)){
  const row=report.rows.find(r=>r.element.id===id);assert.equal(row.totals.scene,2);assert.deepEqual(row.cells.filter(c=>c.sceneWork).map(c=>c.date),['2026-10-06','2026-10-07']);
 }
 assert.equal(report.rows.find(r=>r.element.id==='duplicate-set').totals.scene,0);
 assert(!project.scenes[0].elementRefs.some(r=>r.elementId==='set'));assert(project.scenes[0].fieldElementIds.includes('set'));
 assert.equal(JSON.stringify(project.scenes),before);assert.deepEqual(await serializeMmsx(project,'noop.mmsx'),bytes);
 const snapshot=snapshotBoardFamily(project,board.name),strip=board.scheduledGroups[0].strips.find(s=>s.kind==='scene');
 moveBoardItems(project,{boardName:board.name,sourceKeys:[strip.sourceKey],to:{boardName:board.name,container:'unscheduledGroups',groupIndex:0,stripIndex:0}});
 assert.equal(calculateDood({project,board,calendar}).rows.find(r=>r.element.id==='set').totals.scene,1);
 const saved=await serializeMmsx(project,'moved.mmsx'),reopened=await parseMmsx(saved),next=reopened.boards[0];
 assert.equal(calculateDood({project:reopened,board:next,calendar:reopened.calendars.find(c=>c.id===next.calendarId)}).rows.find(r=>r.element.id==='set').totals.scene,1);
 restoreBoardFamily(project,snapshot);assert.deepEqual(await serializeMmsx(project,'undo.mmsx'),bytes);
});
