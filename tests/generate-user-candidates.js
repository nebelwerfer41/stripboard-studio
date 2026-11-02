/* Rebuild the synthetic MMS10-resaved case only. Never use a private project here. */
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {parseMmsx,serializeMmsx} from '../assets/mmsx-project.js';import {analyzeExport} from '../assets/export-adapters.js';import {snapshotDocument} from '../assets/document-model.js';
import assert from 'node:assert/strict';
if(!process.env.MMSX_EDIT_SAMPLE)throw Error('Imposta MMSX_EDIT_SAMPLE al caso sintetico 02-new-complex_edit.mmsx');
const output=path.resolve(process.env.STUDIO_CANDIDATE_OUTPUT||'verification/user-candidates-v6');await fs.mkdir(output,{recursive:true});
const input=await fs.readFile(process.env.MMSX_EDIT_SAMPLE),files=[];
let serial=0;crypto.randomUUID=()=>`10000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;let seed=314159;crypto.getRandomValues=bytes=>{for(let i=0;i<bytes.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;bytes[i]=seed&255}return bytes};
for(const quantity of [0,1]){
 const p=await parseMmsx(input,'02-new-complex_edit.mmsx'),name=`02-resaved-rebuilt-actor-${quantity}.mmsx`;
 if(quantity===1)p.scenes[0].elementRefs.find(r=>r.name==='Èlia').quantity=1;
 const before=JSON.stringify(snapshotDocument(p)),report=analyzeExport(p,'mmsx',{rebuild:true});assert.equal(report.blockers.length,0);
 const bytes=await serializeMmsx(p,name,{rebuild:true,acceptLoss:true}),q=await parseMmsx(bytes,name);assert.equal(JSON.stringify(snapshotDocument(p)),before);assert.equal(q.events.length,3);assert.equal(q.scenes[0].elementRefs.find(r=>r.name==='Èlia')?.quantity,1);assert(q.events.every(e=>e.color));assert.deepEqual(q.scenes.map(s=>s.mmsxColors),p.scenes.map(s=>s.mmsxColors));
 await fs.writeFile(path.join(output,name),bytes);files.push({name,sha256:createHash('sha256').update(bytes).digest('hex'),origin:'02-new-complex_edit.mmsx risalvato dall’utente in MMS10',operations:['Ricostruzione esplicita dal modello corrente, layout corretti, eventi con colore e ID distinti',quantity===0?'Quantità zero preservata nel modello Studio; singolo esportato come quantità 1 con notifica':'SOLO CONTROLLO DIAGNOSTICO: quantità Èlia nella prima scena modificata da 0 a 1'],variant:report.variant,expected:{scenes:q.scenes.length,events:q.events.map(e=>({name:e.name,type:e.type,color:e.color,startDate:e.startDate,endDate:e.endDate,targets:e.targets})),redFlags:q.redFlags,actorInputQuantity:quantity,actorOutputQuantity:1,actorAssociationOmitted:false,colors:'Bianco già registrato nel file ricevuto: mantenuto, nessun colore originale inventato'},compatibility:report,automatic:'PASS parser e confronti su quantità, eventi, colori, nessuna mutazione',manual:'DA ESEGUIRE in MMS10'});
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({version:6,dataPolicy:'Solo il caso sintetico fornito per diagnosi; nessun percorso locale o archivio privato incluso',originSha256:createHash('sha256').update(input).digest('hex'),verification:'Verifiche interne separate dalla prova MMS10, da registrare',seed:314159,files},null,2)+'\n');
console.log(`PASS: ${files.length} candidati ricostruiti e riletti`);
