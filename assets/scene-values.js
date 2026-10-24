import {builtinField,catalogElements,catalogCategories} from './element-management.js';
export const SINGLE_SCENE_FIELDS=['set','location','ie','dn','scriptDay','unit','sequence','episode'];
const elementForRef=(project,ref)=>project.elements.find(el=>el.id===ref.elementId)||ref;
// Operation-scoped indexes: edits and Undo never retain stale element objects.
export function sceneValueIndex(project){
 const byId=new Map(),byField=new Map();
 for(const el of project.elements){if(!byId.has(el.id))byId.set(el.id,el);const field=builtinField(el.category);if(!field)continue;if(!byField.has(field))byField.set(field,new Map());if(!byField.get(field).has(el.name))byField.get(field).set(el.name,el)}
 return {byId,byField};
}
export const refSceneField=(project,ref)=>builtinField(elementForRef(project,ref).category);
export function singleSceneValue(project,scene,field,index){
  const resolve=ref=>index?(index.byId.get(ref.elementId)||ref):elementForRef(project,ref);
  const ids=scene?.fieldElementIds||[],refs=(scene?.elementRefs||[]).filter(ref=>builtinField(resolve(ref).category)===field);
  const native=ids.map(id=>index?index.byId.get(id):project.elements.find(el=>el.id===id)).filter(el=>el&&builtinField(el.category)===field);
  const raw=scene?.[field],scalar=raw!=null&&typeof raw==='object'?(Array.isArray(raw)?String(raw[0]??''):''):String(raw??'');
  const name=scalar||native[0]?.name||resolve(refs[0]||{}).name||'';
  const element=native.find(el=>el.name===name)||refs.map(resolve).find(el=>el.name===name&&el.id)||(index?index.byField.get(field)?.get(name):project.elements.find(el=>builtinField(el.category)===field&&el.name===name));
  return {name,element,ref:refs.find(r=>resolve(r).name===name)};
}
// Native archives remain untouched. Only contradictory common-model associations are repaired.
export function normalizeSceneSingleValues(project,scene,index=sceneValueIndex(project)){
  const resolve=ref=>index.byId.get(ref.elementId)||ref;
  const chosen=new Map(SINGLE_SCENE_FIELDS.map(field=>[field,singleSceneValue(project,scene,field,index)]));
  for(const [field,value] of chosen)if(scene[field]!=null&&typeof scene[field]==='object'||value.name&&String(scene[field]??'')!==value.name){scene[field]=value.name;if(field==='ie'||field==='dn')delete scene.mmsxColors}
  const seen=new Set();scene.elementRefs=(scene.elementRefs||[]).filter(ref=>{
    const field=builtinField(resolve(ref).category);if(!field)return true;
    const value=chosen.get(field);if(!value||seen.has(field)||resolve(ref).name!==value.name)return false;
    if(value.element&&ref.elementId!==value.element.id)return false;seen.add(field);return true;
  });
  if(scene.fieldElementIds){const fields=new Set();scene.fieldElementIds=scene.fieldElementIds.filter(id=>{
    const el=index.byId.get(id),field=builtinField(el?.category);if(!field)return true;
    const value=chosen.get(field);if(fields.has(field)||el.name!==value?.name||value.element&&id!==value.element.id)return false;fields.add(field);return true;
  })}
  return scene;
}
export function assertSceneSingleValues(project,scene,index=sceneValueIndex(project)){
  const refs=new Map(),ids=new Map();
  for(const ref of scene.elementRefs||[]){const el=index.byId.get(ref.elementId)||ref,field=builtinField(el.category);if(!field)continue;if(refs.has(field))throw Error(`Il parametro ${field} ammette un solo valore`);refs.set(field,el)}
  for(const id of scene.fieldElementIds||[]){const el=index.byId.get(id),field=builtinField(el?.category);if(!field)continue;if(ids.has(field))throw Error(`Il parametro ${field} ammette un solo valore`);ids.set(field,el)}
  for(const field of SINGLE_SCENE_FIELDS){if(scene[field]!=null&&typeof scene[field]==='object')throw Error(`Il parametro ${field} ammette un solo valore`);const ref=refs.get(field),el=ids.get(field),name=String(scene[field]??'');if(ref&&ref.name!==name||el&&el.name!==name||ref&&el&&ref.elementId!==el.id&&ref.id!==el.id)throw Error(`Il parametro ${field} non coincide con il valore della scheda`)}
}
export function sceneValueChoices(project,field){
  const category=catalogCategories(project).find(c=>builtinField(c.name)===field);
  const options=catalogElements(project,field).map(el=>({name:el.name,id:el.id,element:el}));
  const italian=options.some(o=>/^(giorno|notte|alba|imbrunire|tram)$/i.test(o.name));
  const labels=field==='ie'?Object.values(project.colors?.columns||{0:'INT',1:'EXT',2:'INT/EXT'}):field==='dn'?Object.values(project.colors?.rows||Object.fromEntries((italian?['Giorno','Notte','Tram','Alba','Imbrunire','FOTO','T-L','OMISSIS','CUT']:['Day','Night','Evening','Morning','Dusk','FOTO','T-L','OMISSIS','CUT']).map((label,i)=>[i,label]))):[];
  const compare=new Intl.Collator('it',{numeric:true,sensitivity:'base'}),seed=labels.filter(Boolean).map(name=>options.find(o=>o.name.toLocaleLowerCase()===String(name).toLocaleLowerCase())||{name:String(name),category:category?.name}),seen=new Set();
  return [...seed,...options.sort((a,b)=>compare.compare(a.name,b.name))].filter(o=>o.name&&!seen.has(o.name)&&seen.add(o.name));
}
