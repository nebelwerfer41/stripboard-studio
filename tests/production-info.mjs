import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productionChanges,productionFields,productionInfoMarkup} from '../assets/production-info.js';
test('Production Info resolves native field names and retains additional values without duplicate titles',()=>{
 const p={format:'msd',title:'Film',production:{PictureTitle:'Film',Company:'Studio',UPM:'Anna',miscOne:'Extra',custom:{nested:[1,2]}}},before=structuredClone(p);
 const fields=productionFields(p);assert.equal(fields.find(f=>f.key==='UPM').label,'Direttore di produzione');assert.equal(fields.find(f=>f.key==='Company').value,'Studio');assert.equal(fields.filter(f=>f.key==='PictureTitle').length,0);assert(fields.some(f=>f.key==='custom'));assert.match(productionInfoMarkup(p),/Studio/);assert.match(productionInfoMarkup(p),/data-production-field="custom"/);assert.deepEqual(p,before);
});
test('Production Info preserves absent, null, numeric, boolean and structured fields on unchanged save',()=>{
 const p={title:'Film',production:{PictureTitle:'Film',custom:{list:[1,2]},number:7,enabled:false,empty:null}},entries=[['custom',JSON.stringify(p.production.custom,null,2)],['number','7'],['enabled','false'],['empty',''],['company','']];
 assert.deepEqual(productionChanges(p,'Film',entries),p);
 const next=productionChanges(p,' Nuovo ',[['custom','{"list":[3]}'],['number','0'],['enabled','true'],['company','Studio']]);assert.equal(next.title,'Nuovo');assert.equal(next.production.PictureTitle,'Nuovo');assert.equal(next.production.number,0);assert.equal(next.production.enabled,true);assert.deepEqual(next.production.custom,{list:[3]});assert.equal(p.production.number,7);
 assert.throws(()=>productionChanges(p,'Film',[['custom','{bad']]),SyntaxError);assert.throws(()=>productionChanges(p,'  ',[]),/Titolo/);
});
