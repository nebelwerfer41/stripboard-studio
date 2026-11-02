import {associationQuantity,quantitySettings,quantityElementName,quantityName,positiveQuantity,parseQuantityName,categoryUsesQuantity,isCastCategory,categoryForRef} from './quantities.js';
import {assignExportBoardIds} from './element-ids.js';
/* Destination projections do not mutate the Studio document or its source archive. */
import {builtinField} from './element-management.js';
import {ExactNumber} from './mmsx-codec.js';
import {validDate} from './production-data.js';
export const MSD_SYSTEM_FLAGS=Object.freeze([
 {type:'travel',name:'Travel - DOOD',status:'16384',verified:true},
 {type:'fitting',name:'Fitting - DOOD',status:'4096',verified:true},
 {type:'unavailable',name:'Unavailable',status:'0',verified:true},
 // Native redflags.msd confirms zero for a project target. Element R remains unverified.
 {type:'rehearsal',name:'Rehearsal - DOOD',status:'0',verified:true,elementStatusVerified:false}
]);
export function hasMsdSystemFlagDefinitions(p){return MSD_SYSTEM_FLAGS.every(type=>(p.redFlagNames||[]).some(t=>t.name===type.name&&String(t.sortOrder??t.attributes?.SortOrder)==='-1'))}
export function msdFlagType(flag){return MSD_SYSTEM_FLAGS.find(t=>t.type===flag.type)||MSD_SYSTEM_FLAGS.find(t=>t.name===flag.name)||null}
export function readMsdFlagType(name,status){return MSD_SYSTEM_FLAGS.find(t=>t.status!==null&&t.status!=='0'&&t.status===status)?.type||MSD_SYSTEM_FLAGS.find(t=>t.name===name)?.type||null}
export const zeroQuantity=value=>value===0||value instanceof ExactNumber&&/^-?0(?:\.0+)?(?:[eE][+-]?\d+)?$/.test(value.text);
export function mmsxElementEntries(scene,p){return scene.elementRefs.filter(r=>!builtinField(r.category)).map(r=>[r.elementId,isCastCategory(categoryForRef(p,r))?1:associationQuantity(p,r)])}
export function needsMmsxQuantityProjection(p){return p.scenes.some(s=>s.elementRefs.some(r=>!builtinField(r.category)&&(zeroQuantity(r.quantity)||zeroQuantity(r.legacyQuantity)||r.source&&typeof r.source==='object'&&!Object.keys(r.source).length)))}
export function projectMsdBoards(p){return p.boards.map(board=>{
 const present=new Set([...board.scheduledGroups,...board.unscheduledGroups].flatMap(g=>g.strips).filter(s=>s.kind==='scene').map(s=>s.bdsId));
 const missing=p.scenes.filter(s=>!present.has(s.bdsId));let unscheduledGroups=board.unscheduledGroups;
 if(missing.length){unscheduledGroups=board.unscheduledGroups.map(g=>({...g,strips:[...g.strips]}));let tail=unscheduledGroups.at(-1);if(tail?.kind!=='RemainingUnscheduledStrips'){tail={kind:'RemainingUnscheduledStrips',strips:[]};unscheduledGroups.push(tail)}for(const scene of missing)tail.strips.push({kind:'scene',bdsId:scene.bdsId})}
 return {board,missing,unscheduledGroups};
})}
export function eligibleMsdEvent(event){const type=MSD_SYSTEM_FLAGS.find(t=>t.type===event.type);return Boolean(type?.verified&&event.targets.some(t=>t.kind==='element'))}
function dates(start,end){if(!validDate(start)||!validDate(end))return [];const count=(Date.parse(end)-Date.parse(start))/86400000+1;if(!Number.isInteger(count)||count<1||count>3660)return [];return Array.from({length:count},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10))}
export function projectMsdRedFlags(p){
 const flags=p.redFlags.map(flag=>{const type=msdFlagType(flag),name=type?.verified?type.name:flag.name,note=name===flag.name?flag.note||'':`${flag.name}${flag.note?' — '+flag.note:''}`;return {...flag,name,note,doodStatus:flag.target.kind==='project'?'0':type?.elementStatusVerified===false?flag.doodStatus??'0':type?.status??flag.doodStatus??'0'}});
 const converted=[],seen=new Set();
 for(const event of p.events.filter(eligibleMsdEvent)){const type=MSD_SYSTEM_FLAGS.find(t=>t.type===event.type),targets=[...new Map(event.targets.filter(t=>t.kind==='element').map(t=>[t.elementId,t])).values()];converted.push({event,targets});
  for(const target of targets){const flag={name:type.name,type:type.type,note:`${event.name}${event.note?' — '+event.note:''}`,startDate:event.startDate,endDate:event.endDate,target,doodStatus:type.status,fromEvent:true};const key=JSON.stringify([flag.name,flag.note,flag.startDate,flag.endDate,target.elementId]);if(!seen.has(key)){seen.add(key);flags.push(flag)}}
 }
 const entries=flags.flatMap(flag=>dates(flag.startDate||flag.date,flag.endDate||flag.date).map(date=>({...flag,date})));
 const definitions=[...MSD_SYSTEM_FLAGS.map(t=>({name:t.name,sortOrder:-1})),...[...new Set([...(p.redFlagNames||[]).map(t=>t.name),...flags.map(f=>f.name)])].filter(name=>name&&!MSD_SYSTEM_FLAGS.some(t=>t.name===name)).map((name,i)=>({name,sortOrder:p.redFlagNames?.find(t=>t.name===name)?.sortOrder??p.redFlagNames?.find(t=>t.name===name)?.attributes?.SortOrder??i}))];
 return {flags,entries,converted,definitions};
}
function msdAssociationQuantity(p,ref){return !isCastCategory(categoryForRef(p,ref))&&!categoryUsesQuantity(categoryForRef(p,ref))?1:associationQuantity(p,ref)}
// MSD has no per-association quantity: use readable catalog variants and rewire every relation.
export function projectMsdElements(p){
 const allowed=e=>!['ie','dn'].includes(builtinField(e.category)),byOriginal=new Map(),sceneRefs=new Map(),conflicts=[];
 for(const element of p.elements.filter(allowed)){
  const quantities=new Set(),field=builtinField(element.category);for(const scene of p.scenes)for(const ref of scene.elementRefs)if(ref.elementId===element.id)quantities.add(field?null:String(msdAssociationQuantity(p,ref)?.text??msdAssociationQuantity(p,ref)));
  // Scalar fields must still resolve their unadorned value.
  if(!quantities.size||field&&p.scenes.some(s=>s[field]===element.name))quantities.add(null);
  byOriginal.set(element.id,[...quantities].map((quantity,index)=>({...element,boardId:index===0?element.boardId:'',name:quantity===null?element.name:quantityName(parseQuantityName(element.name).name,quantity,quantitySettings(p).msdStyle),originalId:element.id,quantityLabel:quantity})));
 }
 const elements=[...byOriginal.values()].flat(),names=new Map();for(const element of elements){const key=JSON.stringify([element.category,element.name]);if(names.has(key))conflicts.push({first:names.get(key),second:element});else names.set(key,element)}
 for(const scene of p.scenes)sceneRefs.set(scene.bdsId,scene.elementRefs.filter(ref=>!builtinField(ref.category)).flatMap(ref=>{const quantity=String(msdAssociationQuantity(p,ref)?.text??msdAssociationQuantity(p,ref));return byOriginal.get(ref.elementId)?.filter(e=>e.quantityLabel===quantity)||[]}));
 const originalNames=new Map(p.elements.map(e=>[JSON.stringify([e.category,e.name]),e]));
 for(const element of elements)element.linkedElements=(element.linkedElements||[]).flatMap(([category,name])=>{const original=originalNames.get(JSON.stringify([category,name]));return (byOriginal.get(original?.id)||[]).map(e=>[e.category,e.name])});
 const allocation=assignExportBoardIds(elements),replacements=new Map(elements.map((e,i)=>[e,allocation.elements[i]]));for(const [id,variants] of byOriginal)byOriginal.set(id,variants.map(e=>replacements.get(e)));for(const [id,refs] of sceneRefs)sceneRefs.set(id,refs.map(e=>replacements.get(e)));
 return {elements:allocation.elements,byOriginal,sceneRefs,conflicts,assignedIds:allocation.assigned};
}
// Name-based MSD variants become one MMSX resource with quantities on each scene.
export function projectMmsxElements(p){
 const groups=new Map(),byOriginal=new Map(),conflicts=[],merges=[];
 for(const element of p.elements){const name=quantityElementName(p,element),key=JSON.stringify([element.category,name]);let group=groups.get(key);if(!group){group={...element,name,originalIds:[]};groups.set(key,group)}else{
  const metadata=e=>JSON.stringify([e.properties||{},e.notes||'',e.authoring||{},(e.linkedElements||[]).map(([category,name])=>[category,parseQuantityName(name).name])]);
  if(metadata(group)!==metadata(element))conflicts.push({detail:`Dati diversi nelle varianti ${group.name} e ${element.name}: unione MMSX non sicura`});
 }
 group.originalIds.push(element.id);byOriginal.set(element.id,group);
 }
 for(const group of groups.values())if(group.originalIds.length>1)merges.push(group);
 for(const scene of p.scenes){const seen=new Set();for(const ref of scene.elementRefs.filter(r=>!builtinField(r.category))){const group=byOriginal.get(ref.elementId);if(!group)continue;if(seen.has(group.id))conflicts.push({detail:`Scena ${scene.scene}: due risorse diventerebbero ${group.name}, quantità ambigua`});seen.add(group.id)}}
 const initial=[...groups.values()],allocation=assignExportBoardIds(initial),replacements=new Map(initial.map((e,i)=>[e,allocation.elements[i]]));for(const [id,element] of byOriginal)byOriginal.set(id,replacements.get(element));
 return {elements:allocation.elements,byOriginal,conflicts,merges,assignedIds:allocation.assigned};
}
