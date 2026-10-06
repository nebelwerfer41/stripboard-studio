import {cloneExact,stringifyExact} from './mmsx-codec.js';

// Version 3 stores ordered arrays where version 5 uses maps and sortOrder.
// Normalize only the in-memory view; export keeps the original version 3 document.
function orderedMap(items,label){
 if(!Array.isArray(items))throw Error(`MMSX formato 3: ${label} non valido`);
 const map=Object.create(null);
 for(const [index,item] of items.entries()){
  if(!item||typeof item.id!=='string'||!item.id||Object.hasOwn(map,item.id))throw Error(`MMSX formato 3: identificativo ${label} assente o duplicato`);
  map[item.id]={...item,sortOrder:index};
 }
 return map;
}
export function normalizeMmsxV3(original){
 const root=cloneExact(original),c=root.contents;
 for(const b of Object.values(c.breakdown))if(!Object.hasOwn(b,'sheetMap'))b.sheetMap=orderedMap(b.sheets,'scheda');
 for(const b of Object.values(c.stripboard)){
  if(!Object.hasOwn(b,'segmentMap'))b.segmentMap=orderedMap(b.segments,'segmento');
  for(const s of Object.values(b.segmentMap))if(!Object.hasOwn(s,'stripMap'))s.stripMap=orderedMap(s.strips,'strip');
 }
 return root;
}
export function restoreMmsxV3(source,updated){
 const original=source.originalRoot,root=cloneExact(original);
 for(const [bid,board] of Object.entries(root.contents.stripboard)){
  const originalRecords=new Map();
  const segments=b=>Object.hasOwn(b,'segmentMap')?Object.entries(b.segmentMap):b.segments.map(s=>[s.id,s]);
  for(const [,segment] of segments(original.contents.stripboard[bid]))for(const strip of segment.strips||[]){
   // A strip ID can appear in multiple sub-boards; preserve each record's metadata.
   const list=originalRecords.get(strip.id)||[];list.push(strip);originalRecords.set(strip.id,list);
  }
  for(const [sid,segment] of segments(board)){
   const before=source.root.contents.stripboard[bid].segmentMap[sid].stripMap;
   const after=updated.contents.stripboard[bid].segmentMap[sid].stripMap;
   if(stringifyExact(before)===stringifyExact(after))continue;
   // Newer MMS documents retain legacy arrays containing a version-warning banner.
   // Update authoritative maps only; keep those compatibility placeholders intact.
   if(Object.hasOwn(segment,'stripMap')){segment.stripMap=cloneExact(after);continue}
   segment.strips=Object.values(after).sort((a,b)=>a.sortOrder-b.sortOrder).map(strip=>{
    const record=cloneExact(strip);
    if(!(originalRecords.get(strip.id)||[]).some(r=>Object.hasOwn(r,'sortOrder')))delete record.sortOrder;
    return record;
   });
  }
 }
 return root;
}
