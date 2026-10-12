import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/calendar.mjs';
import {encodeMmsx} from '../assets/mmsx-codec.js';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';
import {serializeStudio,parseStudio,snapshotStudio,restoreStudio,setDoodRules} from '../assets/studio-project.js';
for(const variant of ['5','3','hybrid'])test(`Studio roundtrip preserves native ${variant} plus scoped metadata and partial overrides`,async()=>{
 const bytes=await encodeMmsx(fixture(variant)),project=await parseMmsx(bytes,'source.mmsx'),board=project.boards[0];
 setDoodRules(project,board.name,{category:'Cast',rules:{allowHold:true}});setDoodRules(project,board.name,{elementId:'actor',rules:{allowDrop:true}});
 project.events.push({id:'studio-event',studio:true,type:'travel',studioBoardName:board.name,calendarId:board.calendarId,startDate:'2026-10-01',endDate:'2026-10-02',scope:{boardId:'stale',segmentId:'stale'},targets:[{kind:'element',elementId:'actor'}]});
 const again=await parseStudio(await serializeStudio(project));assert.deepEqual(again.studio,project.studio);assert.deepEqual(await serializeMmsx(again,'source.mmsx'),bytes);
 const event=again.events.find(e=>e.studio);assert.equal(event.scope.boardId,again.boards[0].parentBoardId);assert.equal(event.scope.segmentId,again.boards[0].segmentId);assert.equal(again.counts.events,again.events.length);
});
test('history restores Studio metadata/events without cloning native opaque event records',async()=>{
 const project=await parseMmsx(await encodeMmsx(fixture()),'source.mmsx'),original=project.events[0],before=snapshotStudio(project);
 setDoodRules(project,project.boards[0].name,{category:'Cast',rules:{allowHold:false}});project.events.push({id:'local',studio:true});const after=snapshotStudio(project);
 restoreStudio(project,before);assert.equal(project.studio,undefined);assert.equal(project.events[0],original);assert.equal(project.events.filter(e=>e.studio).length,0);
 restoreStudio(project,after);assert.equal(project.studio.dood[project.boards[0].name].categories.Cast.allowHold,false);assert.equal(project.events.filter(e=>e.studio).length,1);
});
test('unsupported Studio container versions fail before native parsing',async()=>{await assert.rejects(()=>parseStudio(new TextEncoder().encode(JSON.stringify({type:'stripboard-studio',version:2,native:'',events:[]}))),/non supportato/)});
