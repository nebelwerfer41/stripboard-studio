import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readMmsxTime,readMsdTime,writeMsdTime,migrateStudioMsdTimes} from '../assets/scene-time.js';
import {syntheticProject} from './fixtures/persistence.mjs';
import {commonMsdSections} from '../assets/export-adapters.js';
test('MSD minutes/hours pairs match the paired native MMSX estMinutes/estHours',()=>{
 for(const [m,h,want] of [['30','1','1:30'],['24','2','2:24'],['45','','0:45'],['0','6','6:00'],['','','']]){assert.equal(readMsdTime(m,h)??'',want);if(want)assert.deepEqual(writeMsdTime(want),{EstimateTimeA:String(Number(m)),EstimateTimeB:String(Number(h||0))})}
 assert.deepEqual(writeMsdTime('01:30'),{EstimateTimeA:'30',EstimateTimeB:'1'});assert.deepEqual(writeMsdTime('90'),{EstimateTimeA:'30',EstimateTimeB:'1'});assert.throws(()=>writeMsdTime('1:99'));
});
test('MSD output has integer time attributes, declared scalar properties, no unsupported Boneyard days',()=>{
 const xml=commonMsdSections(syntheticProject(true));assert.match(xml.BreakdownSheetMgr,/EstimateTimeA="30" EstimateTimeB="1"/);assert.doesNotMatch(xml.BreakdownSheetMgr,/EstimateTime[AB]="[^"]*:/);assert.match(xml.CategoryMgr,/PropertyDefinition Name="count" Type="1"/);assert.match(xml.CategoryMgr,/PropertyDefinition Name="note" Type="1"/);assert.doesNotMatch(xml.StripBoardMgr,/<UnscheduledDay/);assert.doesNotMatch(xml.ElementMgr,/<LinkedElements><\/LinkedElements>/);
});
test('legacy Studio migration changes only times that equal the original numeric MSD fields',()=>{
 const source={format:'msd',scenes:[{bdsId:'1',estimateTimeA:'1:30',msdTimeSource:{minutes:'30',hours:'1'}},{bdsId:'2',estimateTimeA:'1:30',msdTimeSource:{minutes:'30',hours:'1'}}]},document={scenes:[{bdsId:'1',estimateTimeA:'30',estimateTimeB:'1'},{bdsId:'2',estimateTimeA:'2:40',estimateTimeB:'0:20'}]};migrateStudioMsdTimes(document,source);assert.equal(document.scenes[0].estimateTimeA,'1:30');assert.equal(document.scenes[0].estimateTimeB,null);assert.equal(document.scenes[1].estimateTimeA,'2:40');assert.equal(document.scenes[1].estimateTimeB,'0:20');
});

test('MMSX absent hour or minute is zero, both absent remain absent',()=>{assert.equal(readMmsxTime(undefined,45),'0:45');assert.equal(readMmsxTime(2,undefined),'2:00');assert.equal(readMmsxTime(undefined,undefined),null);assert.equal(readMmsxTime(0,0),'0:00')});

test('MSD property values and definitions share human-readable names rather than MMSX UUIDs',()=>{const p=syntheticProject(true);const xml=commonMsdSections(p);assert.match(xml.CategoryMgr,/PropertyDefinition Name="Carburante"/);assert.match(xml.ElementMgr,/<Property Name="Carburante">Elettrico<\/Property>/);assert.doesNotMatch(xml.CategoryMgr,/PropertyDefinition Name="fuel"/)});
