import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,editScene,editElement,editCategory,snapshotDocument,restoreDocument,validateDocument} from '../assets/document-model.js';
import {SINGLE_SCENE_FIELDS,singleSceneValue,sceneValueChoices} from '../assets/scene-values.js';
import {catalogCategories,builtinField} from '../assets/element-management.js';
import {breakdownCategories} from '../assets/calendar-selectors.js';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';
import {encodeMmsx} from '../assets/mmsx-codec.js';
import {fixture} from './fixtures/calendar.mjs';
import {serializeStudio,parseStudio} from '../assets/studio-project.js';
for(const field of SINGLE_SCENE_FIELDS)test(`${field}: select, replace, clear and guard a single association`,()=>{
 const p=createDocument('Film'),s=editScene(p,null,{scene:'1',[field]:'Primo'});const category=catalogCategories(p).find(c=>builtinField(c.name)===field);assert(p.elements.some(el=>el.category===category.name&&el.name==='Primo'));assert.equal(s[field],'Primo');
 editScene(p,s.id,{[field]:'Secondo'});const slots=s.fieldElementIds.map(id=>p.elements.find(el=>el.id===id)).filter(el=>builtinField(el.category)===field);assert.equal(slots.length,1);assert.equal(slots[0].name,'Secondo');assert.equal(breakdownCategories(p,s).find(c=>c.sceneField===field).items.length,1);
 const second=p.elements.find(el=>el.category===category.name&&el.name==='Secondo');editElement(p,second.id,{...second,name:'Rinominato'});assert.equal(s[field],'Rinominato');assert.equal(s.fieldElementIds.filter(id=>id===second.id).length,1);assert.equal(validateDocument(p),p);
 const first=p.elements.find(el=>el.category===category.name&&el.name==='Primo'),before=snapshotDocument(p);
 assert.throws(()=>editScene(p,s.id,{},[{elementId:first.id,name:first.name,category:first.category,quantity:null},{elementId:second.id,name:second.name,category:second.category,quantity:null}]),/un solo valore/);assert.deepEqual(snapshotDocument(p),before);
 assert.throws(()=>editScene(p,s.id,{set:'NON CREARE',[field]:['Uno','Due']}),/un solo valore/);assert.deepEqual(snapshotDocument(p),before);
 editScene(p,s.id,{[field]:''});assert.equal(singleSceneValue(p,s,field).name,'');assert.equal(breakdownCategories(p,s).find(c=>c.sceneField===field).items.length,0);assert(!s.fieldElementIds.some(id=>builtinField(p.elements.find(el=>el.id===id).category)===field));assert.equal(validateDocument(p),p);
});
test('a built-in ref change replaces its scalar and invalidates native strip colors',()=>{
 const p=createDocument('Film'),s=editScene(p,null,{scene:'1',dn:'Day'}),night=editElement(p,null,{name:'Night',category:p.elements.find(el=>el.name==='Day').category});s.mmsxColors={bg:'#ffffff',fg:'#000000'};
 editScene(p,s.id,{},[{elementId:night.id,name:night.name,category:night.category,quantity:null}]);assert.equal(s.dn,'Night');assert.equal(s.mmsxColors,undefined);assert.equal(s.elementRefs.length,1);assert.equal(s.fieldElementIds.length,1);assert.equal(validateDocument(p),p);
 s.mmsxColors={bg:'#ffffff',fg:'#000000'};editElement(p,night.id,{...night,name:'Notte'});assert.equal(s.dn,'Notte');assert.equal(s.mmsxColors,undefined);assert.equal(s.fieldElementIds.length,1);assert.equal(validateDocument(p),p);
 editScene(p,s.id,{},[]);assert.equal(s.dn,'');assert.equal(s.elementRefs.length,0);assert.equal(s.fieldElementIds.length,0);assert.equal(validateDocument(p),p);
});
test('resource categories keep multiple associations and zero/null/opaque quantities',()=>{
 const p=createDocument('Film'),a=editElement(p,null,{name:'Anna',category:'Cast'}),b=editElement(p,null,{name:'Bruno',category:'Cast'}),s=editScene(p,null,{scene:'1'},[{elementId:a.id,quantity:0},{elementId:b.id,quantity:null}]);assert.equal(breakdownCategories(p,s).find(c=>c.name==='Cast').items.length,2);assert.equal(s.elementRefs[0].quantity,0);assert.equal(s.elementRefs[1].quantity,null);
 const before=snapshotDocument(p);editScene(p,s.id,{set:'Casa'});assert.equal(s.elementRefs[0].quantity,0);assert.equal(s.elementRefs[1].quantity,null);restoreDocument(p,before);assert.deepEqual(snapshotDocument(p),before);
});
test('custom categories named after object properties keep their multi-value associations',()=>{
 for(const name of ['constructor','toString','__proto__']){const p=createDocument('Film');editCategory(p,null,{name});assert.equal(builtinField(name),null);const a=editElement(p,null,{name:'Uno',category:name}),b=editElement(p,null,{name:'Due',category:name}),s=editScene(p,null,{scene:'1'},[{elementId:a.id,category:name,name:a.name,quantity:0},{elementId:b.id,category:name,name:b.name,quantity:1}]);assert.equal(s.elementRefs.length,2);assert.deepEqual(s.requirements[name],['Uno','Due']);assert.equal(breakdownCategories(p,s).find(c=>c.name===name).items.length,2);assert.equal(validateDocument(p),p)}
});
test('palette and scalar-derived values can be selected without changing the catalog on reads',()=>{
 const p=createDocument('Film');p.colors.rows={0:'Giorno',1:'Notte',2:'Alba'};p.scenes.push({id:'source',bdsId:'source',set:' Banca ',dn:'Giorno',elementRefs:[],requirements:{}});const before=snapshotDocument(p);assert(sceneValueChoices(p,'dn').some(v=>v.name==='Notte'));assert(sceneValueChoices(p,'set').some(v=>v.name===' Banca '));assert.deepEqual(snapshotDocument(p),before);editScene(p,'source',{set:' Banca '});assert.equal(p.scenes[0].set,' Banca ');
});
test('legacy conflicting built-in refs are repaired to the scalar value on Studio reopen',async()=>{
 const p=createDocument('Film'),s=editScene(p,null,{scene:'1',set:'Casa'}),cat=p.categorySettings.find(c=>c.name==='Set'),other=editElement(p,null,{name:'Bar',category:cat.name}),current=p.elements.find(el=>el.category==='Set'&&el.name==='Casa');const data=JSON.parse(new TextDecoder().decode(await serializeStudio(p)));
 data.document.scenes[0].elementRefs=[{elementId:current.id,name:current.name,category:'Set',quantity:0,resolved:true},{elementId:other.id,name:other.name,category:'Set',quantity:1,resolved:true}];const reopened=await parseStudio(new TextEncoder().encode(JSON.stringify(data)));assert.equal(reopened.scenes[0].set,'Casa');assert.equal(reopened.scenes[0].elementRefs.length,1);assert.equal(reopened.scenes[0].elementRefs[0].quantity,0);assert.equal(validateDocument(reopened),reopened);
});
for(const format of ['5','3','hybrid'])test(`native ${format}: dropdown choices, field identities, Studio/source conservation and undo`,async()=>{
 const bytes=await encodeMmsx(fixture(format)),p=await parseMmsx(bytes),before=snapshotDocument(p),s=p.scenes[0];sceneValueChoices(p,'set');breakdownCategories(p,s);assert.deepEqual(await serializeMmsx(p,'noop.mmsx'),bytes);
 p.documentEditing=true;editScene(p,s.id,{set:'Nuovo set',dn:'Notte'});assert.equal(s.fieldElementIds.filter(id=>builtinField(p.elements.find(e=>e.id===id)?.category)==='set').length,1);const reopened=await parseStudio(await serializeStudio(p));assert.equal(reopened.scenes[0].set,'Nuovo set');assert.deepEqual(reopened.mmsxSource.bytes,new Uint8Array(bytes));restoreDocument(p,before);assert.deepEqual(await serializeMmsx(p,'noop.mmsx'),bytes);
});
