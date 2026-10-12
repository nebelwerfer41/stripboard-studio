import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paginateDood,paginateSchedule,printGeometry} from '../assets/print-layout.js';
import {renderDoodPrint} from '../assets/dood-print.js';
const report={boardName:'Main',dates:Array.from({length:60},(_,i)=>({date:new Date(Date.UTC(2026,5,1+i)).toISOString().slice(0,10),shootingDays:[i+1],calendar:{working:true}})),rows:Array.from({length:100},(_,i)=>({element:{id:String(i),boardId:i+1,name:`Elemento ${i}`},totals:{worked:60,held:0,travel:0,fitting:0,rehearsal:0},first:'2026-06-01',last:'2026-07-30',cells:Array.from({length:60},()=>({codes:['SWF','TR','FT','R','/','M'],calendar:{working:true}}))}))};
test('bidimensional pagination covers every element/date exactly once',()=>{
 const layout=paginateDood(report,{summary:'none'}),coverage=new Map();assert(layout.pages.some(p=>p.columnBand>0));assert(layout.pages.some(p=>p.rowBand>0));
 for(const p of layout.pages){assert((p.dateEnd-p.dateStart)*layout.dateWidth+layout.identityWidth<=layout.contentWidth);assert(p.rowHeights.reduce((a,b)=>a+b,0)+layout.headerHeight+layout.tableHeaderHeight+layout.footerHeight<=layout.contentHeight+.001);
  for(let r=p.rowStart;r<p.rowEnd;r++)for(let d=p.dateStart;d<p.dateEnd;d++){const key=`${r}:${d}`;coverage.set(key,(coverage.get(key)||0)+1)}
 }
 assert.equal(coverage.size,6000);assert([...coverage.values()].every(n=>n===1));
});
test('repeat options, ordering and Summary-only reuse the report',()=>{
 let layout=paginateDood(report,{repeatHeaders:false,repeatIdentity:false,summary:'before'});assert.equal(layout.pages[0].kind,'summary');assert(layout.pages.some(p=>p.kind==='matrix'&&!p.identity));assert(layout.pages.some(p=>p.kind==='matrix'&&!p.headers));
 layout=paginateDood(report,{summary:'only'});assert(layout.pages.every(p=>p.kind==='summary'));assert.equal(layout.pages.reduce((n,p)=>n+p.rowEnd-p.rowStart,0),100);
});
test('scale and density are independent; paper orientation and margins change capacities',()=>{
 assert.equal(printGeometry({scale:2}).contentWidth,printGeometry().contentWidth/2);
 const normal=paginateDood(report,{summary:'none',autoDensity:false}),dense=paginateDood(report,{summary:'none',autoDensity:false,density:.8});assert(dense.pages.length<normal.pages.length);
 assert(paginateDood(report,{paper:'A3',summary:'none'}).pages.length<normal.pages.length);
 assert.throws(()=>paginateDood(report,{margin:100}),/non valida/);
});
test('renderer exposes the exact same planned page boundaries to preview/PDF',()=>{
 const {layout,html}=renderDoodPrint(report,{summary:'none'},{title:'<Project>',version:'Test'});assert.equal((html.match(/class="print-page"/g)||[]).length,layout.pages.length);assert(html.includes('&lt;Project&gt;'));assert(html.includes('SWF TR FT R / M'));
 for(const p of layout.pages){assert(html.includes(`data-page="${p.number}"`));assert(html.includes(`data-date-start="${p.dateStart}" data-row-start="${p.rowStart}"`))}
});
test('long names are wrapped into rows and excessive row sizes fail explicitly',()=>{
 const long={...report,rows:[{...report.rows[0],element:{name:'W'.repeat(160),boardId:1}}]};const layout=paginateDood(long,{summary:'none'});assert(layout.pages[0].rowHeights[0]>layout.rowHeight);assert.throws(()=>paginateDood({...long,rows:[{...long.rows[0],element:{name:'W'.repeat(10000)}}]}),/non entra/);
});
test('schedule shares geometry and fits strips without splitting',()=>{
 const items=Array.from({length:50},()=>({width:300,height:15,html:'strip'})),layout=paginateSchedule(items);assert(layout.pages.length>1);assert.equal(layout.pages.flatMap(p=>p.items).length,50);assert.equal(layout.contentWidth,printGeometry().contentWidth);assert(layout.pages.every(p=>p.items.reduce((n,i)=>n+i.height,0)<=layout.contentHeight-17));
});
