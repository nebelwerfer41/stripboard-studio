/* Optional private references stay outside the repository and generated suite. */
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';import {serializeStudio,parseStudio} from '../assets/studio-project.js';
import {decodeMmsx} from '../assets/mmsx-codec.js';import {analyzeExport} from '../assets/export-adapters.js';
test('supplied native MMSX: source identity, all scene colors and every native palette rule through complete editing and Studio',{skip:!process.env.MMSX_SAMPLE},async()=>{
 const bytes=await fs.readFile(process.env.MMSX_SAMPLE),p=await parseMmsx(bytes,'reference.mmsx'),raw=await decodeMmsx(bytes);
 assert.deepEqual(await serializeMmsx(p,'reference.mmsx'),new Uint8Array(bytes));
 assert.equal(p.colors.nativeRules.length,Object.keys(raw.contents.rules).length);
 const stored=await parseStudio(await serializeStudio(p));stored.scenes[0].comments='Synthetic edit for local test';
 const q=await parseMmsx(await serializeMmsx(stored,'rebuilt.mmsx',{acceptLoss:true}));
 assert.deepEqual(q.scenes.map(s=>s.mmsxColors),p.scenes.map(s=>s.mmsxColors));
 for(const r of p.colors.nativeRules){const rebuilt=q.colors.nativeRules.find(x=>x.intExt===r.intExt&&x.dayNight===r.dayNight);assert(rebuilt);assert.equal(rebuilt.bg,r.bg);assert.equal(rebuilt.fg,r.fg)}
 assert.deepEqual(stored.mmsxSource.bytes,new Uint8Array(bytes));
});
test('MMS10-resaved synthetic case: preserve Studio zero and disclose MMSX omission, both event types, scopes, flag interval; disclose global audience omission',{skip:!process.env.MMSX_EDIT_SAMPLE},async()=>{
 const bytes=await fs.readFile(process.env.MMSX_EDIT_SAMPLE),p=await parseMmsx(bytes),report=analyzeExport(p,'mmsx',{rebuild:true});assert.equal(report.blockers.length,0);
 const q=await parseMmsx(await serializeMmsx(p,'candidate.mmsx',{rebuild:true,acceptLoss:true}));
 assert.equal(q.events.length,p.events.length);assert(q.events.some(e=>e.type==='none'));assert(q.events.some(e=>e.type==='fitting'));assert(q.events.every(e=>e.color));assert.equal(q.redFlags[0].endDate,p.redFlags[0].endDate);
 assert.equal(q.scenes[0].elementRefs.find(r=>r.name==='Èlia').quantity,1);assert(report.omitted.some(x=>x.code==='unverified-global-event-targets'&&x.count===2));
 assert.deepEqual(q.scenes.map(s=>s.mmsxColors),p.scenes.map(s=>s.mmsxColors));
});
