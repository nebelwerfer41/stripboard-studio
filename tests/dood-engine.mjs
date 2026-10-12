import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateDood,sortDoodRows,normalizeRules,doodSummaryCsv} from '../assets/dood-engine.js';
import {moveBoardItems,dayBreakKey} from '../assets/scheduling.js';
import {editCalendar,rescheduleCalendar,moveCalendarItems} from '../assets/calendar-commands.js';
const element={id:'actor',name:'George',boardId:'1',category:'Cast'};
function fixture(work=[1,3,8]){
 const date=n=>`2026-06-${String(n).padStart(2,'0')}`;
 const calendar={id:'cal',name:'Main',daysOff:{Sun:'1',Mon:'0',Tue:'0',Wed:'0',Thu:'0',Fri:'0',Sat:'1'},specialDays:[],scheduleDates:{ProductionStartDate:{iso:date(1)}}};
 const board={id:'plan',name:'Plan',parentBoardId:'plan',segmentId:'seg',calendarId:'cal',attributes:{},scheduledGroups:work.map((n,i)=>({id:`g${i}`,kind:'ScheduleDay',date:date(n),shootingDayNumber:i+1,sourceIndex:i,strips:[{kind:'scene',bdsId:`s${i}`,sourceKey:`strip${i}`}]})),unscheduledGroups:[{kind:'RemainingUnscheduledStrips',strips:[]}]};
 const scenes=work.map((n,i)=>({id:`s${i}`,bdsId:`s${i}`,elementRefs:[{elementId:'actor',resolved:true}],scene:String(i+1)}));
 return {date,calendar,board,project:{format:'msd',capabilities:{editCalendars:true,editStrips:true},boards:[board],elements:[element,{id:'unused',name:'Unused',category:'Cast'}],scenes,calendars:[calendar],events:[]}};
}
const calc=(f,rules={})=>calculateDood({project:f.project,board:f.board,calendar:f.calendar,rulesForElement:()=>normalizeRules(rules)});
const codes=row=>Object.fromEntries(row.cells.map(c=>[c.date,c.codes.join(' ')]));
function event(f,type,start,end=start){f.project.events.push({id:type,type,calendarId:'cal',startDate:f.date(start),endDate:f.date(end),targets:[{kind:'element',elementId:'actor'}]})}
test('SW, W, WF, SWF and elements without scenes',()=>{
 let f=fixture();assert.equal(codes(calc(f).rows[0])[f.date(1)],'SW');assert.equal(codes(calc(f).rows[0])[f.date(3)],'W');assert.equal(codes(calc(f).rows[0])[f.date(8)],'WF');assert.equal(calc(f).rows[1].totals.worked,0);
 f=fixture([3]);assert.equal(calc(f).rows[0].cells[0].codes[0],'SWF');
});
test('Hold excludes weekends and disabled Hold forbids Drop',()=>{
 const f=fixture([1,8]),row=calc(f).rows[0];assert.equal(row.totals.held,4);assert.equal(codes(row)[f.date(6)],'');assert.equal(calc(f,{allowHold:false,allowDrop:true}).rows[0].totals.held,0);
});
test('calendar-day minimum, SWD/PWF and no counts in Drop',()=>{
 const f=fixture([1,8]),row=calc(f,{allowDrop:true,minimumCalendarDays:6}).rows[0];assert.equal(codes(row)[f.date(1)],'SWD');assert.equal(codes(row)[f.date(8)],'PWF');assert.equal(row.totals.held,0);assert.equal(row.totals.worked,2);assert.equal(row.cells.filter(c=>c.dropped).length,6);
 assert.equal(calc(f,{allowDrop:true,minimumCalendarDays:7}).rows[0].dropIntervals.length,0);
});
test('middle releases use WD and pickups use PW',()=>{const f=fixture([1,2,8,9]),row=calc(f,{allowDrop:true,minimumCalendarDays:5}).rows[0];assert.equal(codes(row)[f.date(2)],'WD');assert.equal(codes(row)[f.date(8)],'PW')});
for(const type of ['travel','fitting','rehearsal'])test(`${type} interrupts eligibility and is a required activity`,()=>{
 const f=fixture([1,8]);event(f,type,4);const row=calc(f,{allowDrop:true,minimumCalendarDays:4}).rows[0];assert.equal(row.dropIntervals.length,0);assert.equal(row.totals.worked,3);assert.equal(row.totals[type],1);
});
test('activity-only release and pickup use D/P with activity codes',()=>{const f=fixture([1,12]);event(f,'travel',2);event(f,'fitting',10);const row=calc(f,{allowDrop:true,minimumCalendarDays:7}).rows[0];assert.equal(codes(row)[f.date(2)],'D TR');assert.equal(codes(row)[f.date(10)],'P FT')});
test('Travel before SW and Rehearsal after WF do not change qualifiers; event-only element',()=>{
 const f=fixture([3,8]);event(f,'travel',1);event(f,'rehearsal',10);const row=calc(f).rows[0];assert.equal(row.first,f.date(3));assert.equal(row.last,f.date(8));assert.equal(row.totals.worked,4);
 f.project.events[0].targets.push({kind:'element',elementId:'unused'});const unused=calc(f).rows[1];assert.equal(unused.first,null);assert.equal(unused.totals.travel,1);
});
test('Holiday/Move count only inside the scene span with Hold, and never during Drop',()=>{
 const f=fixture([1,8]);event(f,'holiday',3);event(f,'move',4);event(f,'holiday',10);
 let row=calc(f).rows[0];assert.equal(row.totals.worked,4);assert.equal(row.totals.held,2);assert.equal(row.totals.holiday,1);assert.equal(row.totals.move,1);
 row=calc(f,{allowHold:false}).rows[0];assert.equal(row.totals.worked,2);
 row=calc(f,{allowDrop:true,minimumCalendarDays:6}).rows[0];assert.equal(row.totals.worked,2);assert.equal(row.totals.holiday,0);
});
test('calendar holiday and overlapping events count worked once; Unavailable reports conflicts',()=>{
 const f=fixture([1,8]);f.calendar.specialDays.push({date:f.date(3),attributes:{Off:'0',Holiday:'1',CompanyTravel:'0',ExceptionWorkday:'0'}});event(f,'travel',1);event(f,'fitting',1);event(f,'unavailable',1);
 const row=calc(f).rows[0];assert.equal(row.totals.worked,3);assert.equal(row.totals.travel,1);assert.equal(row.totals.fitting,1);assert.equal(row.cells[0].conflicts.length,1);
});
test('multiple scenes, repeated strips and same-date shooting groups contribute one day',()=>{
 const f=fixture([1,1]);f.board.scheduledGroups[0].strips.push({...f.board.scheduledGroups[0].strips[0],sourceKey:'copy'});
 const row=calc(f).rows[0];assert.equal(row.totals.worked,1);assert.equal(row.cells[0].scenes.length,2);assert.equal(row.cells[0].scenes[0].stripIds.length,2);assert.equal(row.cells[0].codes[0],'SWF');
});
test('strip moves and day-break moves change projection, with no stored attendance',()=>{
 const f=fixture([1,3,8]);moveBoardItems(f.project,{boardName:'Plan',sourceKeys:['strip0'],to:{container:'scheduledGroups',groupIndex:1,stripIndex:0}});
 assert.equal(calc(f).rows[0].first,f.date(3));
 moveBoardItems(f.project,{boardName:'Plan',sourceKeys:[dayBreakKey('Plan',f.board.scheduledGroups[0])],to:{container:'scheduledGroups',groupIndex:1,stripIndex:1}});
 assert.equal(calc(f).rows[0].first,f.date(1));
});
test('calendar exceptions update Hold; explicit rescheduling updates scene dates',()=>{
 const f=fixture([1,8]);editCalendar(f.project,{calendarId:'cal',date:f.date(3),type:'offday'});assert.equal(calc(f).rows[0].totals.held,3);
 editCalendar(f.project,{calendarId:'cal',startDate:f.date(10)});rescheduleCalendar(f.project,'cal');assert.equal(calc(f).rows[0].first,f.date(10));
});
test('rules and events are scoped to distinct Sub-Boards',()=>{
 const f=fixture([1,8]);f.project.studio={dood:{Plan:{categories:{Cast:{allowHold:false}},elements:{actor:{allowHold:true}}},Other:{categories:{Cast:{allowHold:false}},elements:{}}}};
 const other={...f.board,name:'Other',segmentId:'other'};f.project.boards.push(other);event(f,'travel',3);f.project.events[0].scope={segmentId:'seg'};
 const a=calculateDood({project:f.project,board:f.board,calendar:f.calendar}),b=calculateDood({project:f.project,board:other,calendar:f.calendar});assert.equal(a.rows[0].totals.held,3);assert.equal(b.rows[0].totals.held,0);assert.equal(b.rows[0].totals.travel,0);
});
test('unknown imported event types and unresolved dates are diagnosed, never guessed',()=>{const f=fixture([1]);event(f,4096,2);f.board.scheduledGroups[0].date=null;const r=calc(f);assert.equal(r.rows[0].totals.worked,0);assert.equal(r.diagnostics.length,2)});
test('stable four-key sorting, null dates last in either direction',()=>{
 const f=fixture([1]);const rows=calc(f).rows;assert.deepEqual(sortDoodRows(rows,[{key:'first',direction:'desc'}]).map(r=>r.element.id),['actor','unused']);assert.deepEqual(sortDoodRows(rows,[{key:'held'}]),rows);
});
test('a one-day return between two eligible gaps preserves both pickup and release',()=>{const f=fixture([1,8,15]),row=calc(f,{allowDrop:true,minimumCalendarDays:6}).rows[0];assert.equal(codes(row)[f.date(8)],'PW D');assert.equal(row.dropIntervals.length,2)});
test('company activity on a boundary is counted once alongside scene work',()=>{const f=fixture([1,8]);event(f,'holiday',1);assert.equal(calc(f).rows[0].totals.worked,2);assert.equal(calc(f).rows[0].totals.holiday,1)});
test('typed Unavailable Red Flags are projected without duplicating event records',()=>{const f=fixture([1]);f.project.redFlags=[{id:'flag',type:'unavailable',startDate:f.date(1),endDate:f.date(1),target:{kind:'element',elementId:'actor'}}];const row=calc(f).rows[0];assert.equal(row.cells[0].codes.join(' '),'SWF U');assert.equal(row.cells[0].conflicts.length,1);assert.equal(f.project.events.length,0)});

test('a new day break created by a calendar date drop is read immediately',()=>{const f=fixture([1,3]);moveCalendarItems(f.project,{boardName:'Plan',sourceKeys:['strip0'],to:{boardName:'Plan',date:f.date(5),calendarId:'cal'}});const row=calc(f).rows[0];assert.equal(row.first,f.date(3));assert.equal(row.last,f.date(5));assert.equal(row.totals.worked,2);assert.equal(row.totals.held,1)});
test('inclusive individual event ranges remove every affected date from Drop eligibility',()=>{const f=fixture([1,8]);event(f,'fitting',2,7);const row=calc(f,{allowDrop:true,minimumCalendarDays:1}).rows[0];assert.equal(row.dropIntervals.length,0);assert.equal(row.totals.worked,8);assert.equal(row.totals.fitting,6)});
test('CSV preserves quoted names and keeps spreadsheet formulas as text',()=>{
 const f=fixture([1]),report=calc(f);report.rows[0].element={...report.rows[0].element,name:'=1+1, "George"'};
 const csv=doodSummaryCsv(report);assert(csv.includes(`"'=1+1, ""George"""`));assert(csv.includes('"Worked","Held","Travel","Fitting"'));
});
