import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/calendar.mjs';
import {encodeMmsx,decodeMmsx,stringifyExact} from '../assets/mmsx-codec.js';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';
import {moveCalendarItems} from '../assets/calendar-commands.js';
import {moveBoardItems,snapshotBoardFamily,restoreBoardFamily,dayBreakKey} from '../assets/scheduling.js';
for(const format of ['5','3','hybrid'])test(`${format}: blank date drop creates a native day, persists and has reversible history`,async()=>{
 const root=fixture(format),bytes=await encodeMmsx(root),project=await parseMmsx(bytes),board=project.boards[0],before=snapshotBoardFamily(project,board.name);
 const original=board.scheduledGroups.filter(g=>g.kind==='ScheduleDay').map(g=>[g.date,g.shootingDayNumber]);
 const keys=board.scheduledGroups[0].strips.slice(0,2).map(s=>s.sourceKey),destination={boardName:board.name,calendarId:board.calendarId,date:'2026-10-09'};
 const allIds=p=>[...new Set(p.boards.flatMap(b=>[...b.scheduledGroups,...b.unscheduledGroups].flatMap(g=>g.strips.map(s=>s.sourceKey))))].sort();
 const ids=allIds(project);
 assert.equal(moveCalendarItems(project,{boardName:board.name,sourceKeys:keys,to:destination}),true);
 const day=board.scheduledGroups.find(g=>g.date===destination.date);assert(day.created);assert.deepEqual(day.strips.map(s=>s.sourceKey),keys);
 assert.deepEqual(board.scheduledGroups.filter(g=>g.kind==='ScheduleDay'&&!g.created).map(g=>[g.date,g.shootingDayNumber]),original);
 assert.deepEqual(allIds(project),ids);
 const after=snapshotBoardFamily(project,board.name),saved=await serializeMmsx(project,'drag.mmsx'),reopened=await parseMmsx(saved);
 const persisted=reopened.boards[0].scheduledGroups.find(g=>g.date===destination.date);
 assert.deepEqual(persisted.strips.map(s=>s.bdsId),day.strips.map(s=>s.bdsId));assert.equal(persisted.shootingDayNumber,day.shootingDayNumber);
 const out=await decodeMmsx(saved);for(const key of ['category','element','breakdown','redflag','redflagType'])assert.equal(stringifyExact(out.contents[key]),stringifyExact(root.contents[key]));
 assert.deepEqual(reopened.events,project.events);assert.deepEqual(reopened.redFlags,project.redFlags);
 assert.deepEqual(await serializeMmsx(reopened,'again.mmsx'),saved);
 restoreBoardFamily(project,before);assert.deepEqual(await serializeMmsx(project,'undo.mmsx'),bytes);
 restoreBoardFamily(project,after);assert.equal(board.scheduledGroups.find(g=>g.date===destination.date).strips.length,2);
 // A second drop reuses the day; moving its boundary also remains writable.
 const extra=board.scheduledGroups.find(g=>g.strips.length&&g!==day)?.strips[0];
 if(extra){assert(moveCalendarItems(project,{boardName:board.name,sourceKeys:[extra.sourceKey],to:destination}));assert.equal(board.scheduledGroups.filter(g=>g.date===destination.date).length,1)}
 assert(moveBoardItems(project,{boardName:board.name,sourceKeys:[dayBreakKey(board.name,day)],to:{boardName:board.name,container:'unscheduledGroups',groupIndex:0,stripIndex:0}}));
 await parseMmsx(await serializeMmsx(project,'boundary.mmsx'));
});
test('invalid calendar drops roll back and unrelated calendars are rejected',async()=>{
 const bytes=await encodeMmsx(fixture()),p=await parseMmsx(bytes),b=p.boards[0];
 const to={boardName:b.name,calendarId:b.calendarId,date:'2026-10-09'};
 for(const sourceKeys of [[],['missing'],[dayBreakKey(b.name,b.scheduledGroups[0])]])assert.throws(()=>moveCalendarItems(p,{boardName:b.name,sourceKeys,to}));
 assert.throws(()=>moveCalendarItems(p,{boardName:b.name,sourceKeys:[b.scheduledGroups[0].strips[0].sourceKey],to:{...to,calendarId:'unrelated'}}));
 assert.deepEqual(await serializeMmsx(p,'unchanged.mmsx'),bytes);
});
