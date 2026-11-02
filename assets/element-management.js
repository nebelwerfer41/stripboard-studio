import {categoryUsesQuantity} from './quantities.js';
import {validDate} from './production-data.js';
const fields={set:'set',location:'location',scriptday:'scriptDay',unit:'unit',sequence:'sequence',dn:'dn',daynight:'dn',ie:'ie',intext:'ie',episode:'episode'};
export const builtinField=name=>{const key=String(name??'').toLowerCase().replace(/[^a-z]/g,'');return Object.hasOwn(fields,key)?fields[key]:null};
export function isBuiltinCategory(category){return Boolean([category?.builtIn,category?.source?.builtIn,category?.source?.isBuiltIn].some(value=>[true,1,'1'].includes(value))||builtinField(category?.name))}
const bool=(value,fallback=false)=>value==null?fallback:[true,1,'1'].includes(value);
export function categoryDefaults(category){
  const a=category?.attributes||{},s=category?.source||{};
  return {autoAssignIds:bool(a.AutoAssignIds??s.autoAssignIds),excludeFromBoard:bool(a.ExcludeFromStripboard??s.excludeFromBoard),allowHold:bool(a.AllowDOODHoldDays??s.allowHoldDays,true),useDailyQuantity:categoryUsesQuantity(category),...category?.elementDefaults};
}
export function elementOptions(element){
  const s=element?.source||{},a=element?.attributes||{};
  return {lockId:bool(a.LockBoardID??a.LockID??s.lockId),excludeFromBoard:bool(a.ExcludeFromStripboard??s.excludeFromBoard),useDailyQuantity:bool(a.UseInDailyQuantity??s.useInDailyQuantity,true),...element?.authoring};
}
export function sceneUsesElement(project,scene,element){
  return scene.elementRefs?.some(r=>r.elementId===element.id||(r.category===element.category&&r.name===element.name))||scene.fieldElementIds?.includes(element.id)||Boolean(builtinField(element.category)&&scene[builtinField(element.category)]===element.name);
}
export function elementUsage(project,boardName,element){
  const current=project.boards.find(b=>b.name===boardName)||project.boards[0],family=project.boards.filter(b=>b.parentBoardId===current.parentBoardId),sceneMap=new Map(project.scenes.map(s=>[s.bdsId,s])),seen=new Set(),occurrences=[];
  for(const board of family)for(const container of ['scheduledGroups','unscheduledGroups'])for(const group of board[container])for(const strip of group.strips){
    if(seen.has(strip.sourceKey))continue;seen.add(strip.sourceKey);const scene=sceneMap.get(strip.bdsId);
    if(strip.kind==='scene'&&scene&&sceneUsesElement(project,scene,element))occurrences.push({scene,strip,group,board,date:container==='scheduledGroups'&&validDate(group.date)?group.date:null});
  }
  const dates=[...new Set(occurrences.map(o=>o.date).filter(Boolean))].sort();
  const flags=project.redFlags.filter(f=>f.target?.kind==='element'&&(f.target.elementId===element.id||f.target.category===element.category&&f.target.element===element.name));
  return {occurrences,dates,first:dates[0]||null,last:dates.at(-1)||null,worked:dates.length,count:occurrences.length,flags};
}
export function propertyDefinitions(category){return Object.entries(category?.properties||{}).map(([key,value])=>({key,label:value?.name||key,type:value?.type==='multiline'||value?.type==='Multi-Line'||value?.type==='longtext'?'multiline':'single',raw:value}))}
const builtinNames=[['set','Set'],['location','Location'],['dn','D/N'],['ie','I/E'],['scriptDay','Script Day'],['sequence','Sequence'],['unit','Unit'],['episode','Episode']];
export function catalogCategories(project){
 const list=[...project.categorySettings];for(const [field,name] of builtinNames)if(!list.some(c=>builtinField(c.name)===field))list.push({id:`derived-category:${field}`,name,builtIn:true,attributes:{},properties:{},derived:true});return list;
}
export function catalogElements(project,onlyField=null){
 const list=onlyField?project.elements.filter(el=>builtinField(el.category)===onlyField):[...project.elements],categories=catalogCategories(project);
 const names=new Map(builtinNames.map(([field])=>[field,new Set()]));
 for(const el of list)names.get(builtinField(el.category))?.add(el.name);
 for(const [field] of builtinNames){if(onlyField&&field!==onlyField)continue;const category=categories.find(c=>builtinField(c.name)===field),seen=names.get(field);for(const scene of project.scenes){const name=scene[field];if(name==null||name===''||seen.has(name))continue;seen.add(name);list.push({id:`derived-element:${JSON.stringify([field,name])}`,name,category:category.name,boardId:'',derived:true})}}return list;
}
