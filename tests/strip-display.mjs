import {test} from 'node:test';
import assert from 'node:assert/strict';
import {presetFields,selectedFields,sceneFieldText,fieldsPickerMarkup} from '../assets/strip-display.js';
const project={categorySettings:[{id:'cast',name:'Cast'},{id:'props',name:'Props'}],elements:[{name:'Alex',category:'Cast',boardId:3},{name:'Alex',category:'Props',boardId:17}]};
test('standard layouts resolve production categories without hardcoded category IDs',()=>{
 assert(presetFields(project,'production').includes('category:cast'));
 assert.deepEqual(presetFields(project,'compact',{calendar:true}),['scene','set','pages']);
 assert.deepEqual(selectedFields(project,['set','set','missing','scene']).map(f=>f.key),['set','scene']);
});
test('display fields resolve category-specific identities and scheduled context',()=>{
 const scene={requirements:{Cast:['Alex'],Props:['Alex']},estimateTimeA:'90',pagesEighths:9};
 const helpers={project,group:{date:'2026-10-08',shootingDayNumber:4},pages:n=>`${n}/8`,shortDate:d=>d};
 const fields=selectedFields(project,['category:cast','category:props','estimate','shootDay','shootDate']);
 assert.deepEqual(fields.map(f=>sceneFieldText(f,scene,helpers)),['3. Alex','17. Alex','01:30','4','2026-10-08']);
 assert.match(fieldsPickerMarkup(project,['scene'],{target:'board',safe:String}),/data-strip-field-option="scene"[^>]+disabled/);
});
