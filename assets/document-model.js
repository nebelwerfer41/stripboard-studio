/* Editable common document. Proprietary archives remain owned by their adapters. */
import {completeProjectModel} from './project-model.js';
import {standardLayout} from './strip-display.js';
import {ExactNumber} from './mmsx-codec.js';
import {validDate} from './production-data.js';
import {isBuiltinCategory,categoryDefaults,elementOptions,builtinField,catalogCategories} from './element-management.js';
import {SINGLE_SCENE_FIELDS,refSceneField,normalizeSceneSingleValues,singleSceneValue,assertSceneSingleValues} from './scene-values.js';
export const DOCUMENT_KEYS=['title','production','scenes','elements','categorySettings','boards','calendars','events','redFlags','redFlagNames','redFlagSettings','activeBoard','defaultCalendar','studio','documentEditing','stripLayouts','reportLayouts','colors','capabilities'];
export const SCENE_FIELDS={scene:'Scena',synopsis:'Sinossi',ie:'INT / EXT',dn:'DAY / NIGHT',set:'Set',location:'Location',scriptDay:'Script day',episode:'Episodio',unit:'Unità',sequence:'Sequenza',scriptPageNumbers:'Pagine script',pagesEighths:'Pagine',estimateTimeA:'Tempo stimato',estimateTimeB:'Tempo schermo',comments:'Commenti'};
const uid=kind=>`studio-${kind}:${crypto.randomUUID()}`;
function clone(value,seen=new Map()){
  if(value instanceof ExactNumber)return new ExactNumber(value.text);
  if(!value||typeof value!=='object')return value;if(seen.has(value))return seen.get(value);
  const copy=Array.isArray(value)?[]:Object.create(Object.getPrototypeOf(value)===null?null:Object.prototype);seen.set(value,copy);
  for(const [key,item] of Object.entries(value))Object.defineProperty(copy,key,{value:clone(item,seen),enumerable:true,writable:true,configurable:true});return copy;
}
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
function requireRecord(value,label){if(!record(value))throw Error(`${label}: usa un oggetto di proprietà`)}
export function snapshotDocument(p){return clone(Object.fromEntries(DOCUMENT_KEYS.map(k=>[k,p[k]])))}
export function restoreDocument(p,s){for(const k of DOCUMENT_KEYS)p[k]=clone(s[k]);refreshDocument(p)}
export function refreshDocument(p){
  completeProjectModel(p);
  const elements=new Map(p.elements.map(e=>[e.id,e]));
  for(const s of p.scenes){
    const requirements=Object.create(null);
    for(const r of s.elementRefs){const el=elements.get(r.elementId);if(el){r.name=el.name;r.category=el.category;r.resolved=true}(requirements[r.category]??=[]).push(r.name)}
    s.requirements=requirements;
  }
  Object.assign(p.counts,{scenes:p.scenes.length,elements:p.elements.length,categories:p.categorySettings.length,stripboards:p.boards.length,sceneElementAssociations:p.scenes.reduce((n,s)=>n+s.elementRefs.length,0),scheduleDays:p.boards.reduce((n,b)=>n+b.scheduledGroups.filter(g=>g.kind==='ScheduleDay').length,0)});
  if(p.documentEditing)p.capabilities.createBoards=true;
  return p;
}
export function createDocument(title='Nuovo progetto'){
  const p={format:'studio',fileName:`${title.replace(/[\/\\:*?"<>|]/g,'-')}.studio.json`,title,production:{PictureTitle:title},scenes:[],elements:[],categorySettings:['Cast','Background Actors','Props','Costumes','Makeup','Set','Location','Special Effects','Vehicles','Animals','Sound','Notes'].map(name=>({id:uid('category'),name,attributes:{},properties:{}})),boards:[],calendars:[],events:[],redFlags:[],redFlagNames:[],stripLayouts:[standardLayout('compact')],reportLayouts:[],colors:{preferences:{Banner:{bg:'#663301',fg:'#FFFFFF'},DayStrip:{bg:'#333333',fg:'#FFFFFF'}}},counts:{},capabilities:{editCalendars:true,createBoards:true,calendarProjection:false},documentEditing:true};
  createCalendar(p,{name:'Calendario principale'});createPlan(p,{name:'Piano principale',calendarId:p.calendars[0].id});p.activeBoard=p.boards[0].name;p.defaultCalendar=p.calendars[0].name;return refreshDocument(p);
}
function required(value,label){if(typeof value!=='string'||!value.trim())throw Error(`${label} obbligatorio`);return value.trim()}
function uniqueName(list,name,current,label){if(list.some(x=>x!==current&&x.name===name))throw Error(`${label} già presente`)}
export function editScene(p,id,values,refs){
  let s=p.scenes.find(x=>x.id===id);if(id&&!s)throw Error('Scena non trovata');
  if(Object.hasOwn(values,'sheetNumber')&&(!s||values.sheetNumber!==s.sheetNumber))throw Error('Il numero sheet non è modificabile');
  const next={pagesEighths:null,...s,...values};next.scene=String(next.scene??'').trim();
  if(next.pagesEighths!==null&&(!Number.isSafeInteger(next.pagesEighths)||next.pagesEighths<0))throw Error('Gli ottavi devono essere un intero non negativo');
  for(const key of ['estimateTimeA','estimateTimeB'])if(next[key]&&typeof next[key]==='string'&&!/^\d+:[0-5]\d$/.test(next[key])&&!/^\d+$/.test(next[key]))throw Error('Tempo non valido: usa ore:minuti o il valore numerico sorgente');
  if(refs){const seen=new Set();next.elementRefs=refs.map(r=>{const key=r.elementId??JSON.stringify([r.category,r.name]);if(seen.has(key))throw Error('Elemento duplicato');seen.add(key);if(!p.elements.some(e=>e.id===r.elementId)&&!s?.elementRefs.some(old=>old.elementId===r.elementId&&!old.resolved))throw Error('Elemento non trovato');if(r.quantity!==null&&(typeof r.quantity!=='number'||!Number.isFinite(r.quantity)||r.quantity<0)&&JSON.stringify(r.quantity)!==JSON.stringify(s?.elementRefs.find(old=>old.elementId===r.elementId)?.quantity))throw Error('Quantità non valida');const old=s?.elementRefs.find(old=>old.elementId===r.elementId&&(r.elementId!==null||old.category===r.category&&old.name===r.name));return {...r,quantityOrigin:old&&JSON.stringify(old.quantity)===JSON.stringify(r.quantity)?old.quantityOrigin:r.quantity===null?'absent':'stored'}})}
  for(const field of SINGLE_SCENE_FIELDS)if(Object.hasOwn(values,field)&&values[field]!=null&&typeof values[field]==='object')throw Error(`Il parametro ${field} ammette un solo valore`);
  if(!s&&!Number.isSafeInteger(p.scenes.reduce((max,scene)=>{const n=Number(scene.sheetNumber);return Number.isSafeInteger(n)&&n>max?n:max},0)+1))throw Error('Numerazione sheet esaurita');
  const fieldRefs=new Map();if(refs)for(const ref of next.elementRefs){const field=refSceneField(p,ref);if(!field)continue;if(fieldRefs.has(field))throw Error(`Il parametro ${field} ammette un solo valore`);fieldRefs.set(field,ref)}
  for(const field of SINGLE_SCENE_FIELDS){
    if(Object.hasOwn(values,field)){const raw=String(values[field]??'');next[field]=p.elements.some(el=>builtinField(el.category)===field&&el.name===raw)||p.scenes.some(scene=>scene[field]===raw)?raw:raw.trim()}
    else if(refs){const old=(s?.elementRefs||[]).filter(r=>refSceneField(p,r)===field),chosen=fieldRefs.get(field);
      if(chosen&&!old.some(r=>r.elementId===chosen.elementId&&r.name===chosen.name))next[field]=p.elements.find(el=>el.id===chosen.elementId)?.name||chosen.name;
      else if(!chosen&&old.some(r=>r.name===String(s?.[field]??'')))next[field]='';
    }
    const name=String(next[field]??''),touched=(Object.hasOwn(values,field)||refs)&&(!s||String(s[field]??'')!==name)||refs&&fieldRefs.get(field)&&!s?.elementRefs.some(r=>r.elementId===fieldRefs.get(field).elementId);
    if(touched){
      next.elementRefs=(next.elementRefs||[]).filter(ref=>refSceneField(p,ref)!==field||ref.name===name);
      const current=singleSceneValue(p,s||{},field),existing=current.element?.name===name?current.element:p.elements.find(el=>builtinField(el.category)===field&&el.name===name);
      let element=existing;if(name&&!element){let category=catalogCategories(p).find(c=>builtinField(c.name)===field);if(category.derived){editCategory(p,null,{name:category.name,builtIn:true,attributes:{},properties:{}});category=p.categorySettings.find(c=>c.name===category.name)}element=editElement(p,null,{name,category:category.name,properties:{}})}
      next.fieldElementIds=(next.fieldElementIds||[]).filter(id=>builtinField(p.elements.find(el=>el.id===id)?.category)!==field);if(element&&name)next.fieldElementIds.push(element.id);
    }
  }
  normalizeSceneSingleValues(p,next);
  if(s&&['ie','dn'].some(field=>s[field]!==next[field])){delete next.mmsxColors;delete s.mmsxColors}
  if(!s){const highestSheet=p.scenes.reduce((max,scene)=>{const n=Number(scene.sheetNumber);return Number.isSafeInteger(n)&&n>max?n:max},0);if(!Number.isSafeInteger(highestSheet+1))throw Error('Numerazione sheet esaurita');next.sheetNumber=String(highestSheet+1);next.id=next.bdsId=uid('scene');next.elementRefs??=[];p.scenes.push(next);const seen=new Set();for(const b of p.boards){if(seen.has(b.unscheduledGroups))continue;seen.add(b.unscheduledGroups);let g=b.unscheduledGroups.find(g=>g.kind==='RemainingUnscheduledStrips');if(!g){g=newGroup('RemainingUnscheduledStrips',null,b);b.unscheduledGroups.push(g)}g.strips.push({kind:'scene',bdsId:next.bdsId,sourceKey:uid('strip')})}}else Object.assign(s,next);
  refreshDocument(p);return next;
}
export function editElement(p,id,values){
  requireRecord(values.properties??{},'Proprietà elemento');
  const el=p.elements.find(e=>e.id===id);if(id&&!el)throw Error('Elemento non trovato');const name=required(values.name,'Nome'),category=required(values.category,'Categoria');
  if(!p.categorySettings.some(c=>c.name===category)&&category!==el?.category)throw Error('Categoria non trovata');
  if(el&&elementOptions(el).lockId&&values.authoring?.lockId!==false&&String(values.boardId??el.boardId??'')!==String(el.boardId??''))throw Error('Il Board ID è bloccato');
  if(el&&category!==el.category&&isBuiltinCategory(p.categorySettings.find(c=>c.name===el.category)))throw Error('Gli elementi built-in non possono cambiare categoria');
  if(p.elements.some(e=>e!==el&&e.name===name&&e.category===category))throw Error('Elemento già presente nella categoria');
  if(values.linkedElements!==undefined){if(!Array.isArray(values.linkedElements)||values.linkedElements.some(link=>!Array.isArray(link)||link.length!==2||link.some(v=>typeof v!=='string')))throw Error('Collegamenti elemento non validi');for(const link of values.linkedElements)if(!p.elements.some(e=>e.category===link[0]&&e.name===link[1])&&!el?.linkedElements?.some(old=>old[0]===link[0]&&old[1]===link[1]))throw Error('Elemento collegato non trovato')}
  const defaults=categoryDefaults(p.categorySettings.find(c=>c.name===category));
  const sceneField=el&&builtinField(el.category),boundScenes=sceneField?p.scenes.filter(s=>singleSceneValue(p,s,sceneField).element?.id===id):[];
  const old=el?{name:el.name,category:el.category}:null,next={...(!el?{authoring:{excludeFromBoard:defaults.excludeFromBoard,allowHold:defaults.allowHold,useDailyQuantity:defaults.useDailyQuantity}}:{}),...el,...values,name,category,id:el?.id||uid('element')};
  if(!el&&defaults.autoAssignIds&&!String(next.boardId??'').trim()){let n=1;const used=new Set(p.elements.filter(e=>e.category===category).map(e=>String(e.boardId)));while(used.has(String(n)))n++;next.boardId=String(n)}
  if(el)Object.assign(el,next);else p.elements.push(next);
  if(old){for(const e of p.elements)if(Array.isArray(e.linkedElements))e.linkedElements=e.linkedElements.map(([cat,n])=>cat===old.category&&n===old.name?[category,name]:[cat,n]);for(const s of boundScenes){s[sceneField]=name;if(name!==old.name&&['ie','dn'].includes(sceneField))delete s.mmsxColors}for(const flag of p.redFlags)if(flag.target.elementId===id)Object.assign(flag.target,{category,element:name});for(const e of p.events)for(const t of e.targets||[])if(t.elementId===id)Object.assign(t,{category,element:name})}
  refreshDocument(p);return next;
}
export function editCategory(p,id,values){
  requireRecord(values.attributes??{},'Impostazioni categoria');requireRecord(values.properties??{},'Definizioni proprietà');
  const c=p.categorySettings.find(c=>c.id===id||c.name===id);if(id&&!c)throw Error('Categoria non trovata');const name=required(values.name,'Categoria');uniqueName(p.categorySettings,name,c,'Categoria');
  if(c&&isBuiltinCategory(c))throw Error('Le categorie built-in non sono modificabili');
  if(c){const old=c.name;for(const layout of [...p.stripLayouts,...p.reportLayouts])for(const shapes of Object.values(layout))if(Array.isArray(shapes))for(const shape of shapes){if(shape.categories)shape.categories=shape.categories.map(n=>n===old?name:n);for(const key of ['Category','CategoryName'])if(shape.a?.[key]===old)shape.a[key]=name}
    for(const el of p.elements)if(Array.isArray(el.linkedElements))el.linkedElements=el.linkedElements.map(([cat,n])=>[cat===old?name:cat,n]);
    Object.assign(c,values,{name});for(const e of p.elements)if(e.category===old)e.category=name;for(const s of p.scenes)for(const r of s.elementRefs)if(r.category===old)r.category=name;for(const f of p.redFlags)if(f.target.category===old)f.target.category=name;
    for(const event of p.events)for(const target of event.targets||[])if(target.category===old)target.category=name;
    for(const b of Object.values(p.studio?.dood||{}))if(Object.hasOwn(b.categories||{},old)){Object.defineProperty(b.categories,name,{value:b.categories[old],enumerable:true,writable:true,configurable:true});if(name!==old)delete b.categories[old]}
  }else p.categorySettings.push({id:uid('category'),attributes:{},properties:{},...values,name});refreshDocument(p);
}
export function createCalendar(p,values){
  requireRecord(values.options??{},'Opzioni calendario');
  const name=required(values.name,'Nome calendario');uniqueName(p.calendars,name,null,'Calendario');
  for(const d of Object.values(values.scheduleDates||{}))if(d.iso&&!validDate(d.iso))throw Error('Data calendario non valida');
  const c={id:uid('calendar'),name,scope:{kind:'project'},attributes:{},options:{},activityBounds:{start:null,end:null},scheduleDates:{ProductionStartDate:{iso:null,origin:'edited'}},daysOff:{Mon:'0',Tue:'0',Wed:'0',Thu:'0',Fri:'0',Sat:'1',Sun:'1'},specialDays:[],dates:[],...values};p.calendars.push(c);return c;
}
export function editCalendarDetails(p,id,values){
  requireRecord(values.options??{},'Opzioni calendario');
  const c=p.calendars.find(c=>c.id===id);if(!c)throw Error('Calendario non trovato');const name=required(values.name,'Nome calendario');uniqueName(p.calendars,name,c,'Calendario');
  for(const d of Object.values(values.scheduleDates||{}))if(d.iso&&!validDate(d.iso))throw Error('Data calendario non valida');
  const bounds=values.activityBounds||{};if(bounds.start&&!validDate(bounds.start)||bounds.end&&!validDate(bounds.end)||bounds.start&&bounds.end&&bounds.end<bounds.start)throw Error('Limiti attività non validi');
  const old=c.name;Object.assign(c,values,{name});if(values.scheduleDates){const dates=c.scheduleDates;c.activityBounds={start:Object.hasOwn(dates,'ProductionPrepStartDate')?dates.ProductionPrepStartDate.iso||null:c.activityBounds?.start||null,end:dates.ProductionWrapDate?.iso||dates.ProductionEndDate?.iso||null}}for(const b of p.boards)if(b.calendarId===id)b.calendarName=name;if(p.defaultCalendar===old)p.defaultCalendar=name;
}
function newGroup(kind,date,b,number=null){return {id:uid('group'),kind,date,dateOrigin:'edited',calendarId:kind==='ScheduleDay'?b.calendarId:null,shootingDayNumber:number,ordinal:number,sourceIndex:undefined,created:true,attributes:{},strips:[]}}
export function createPlan(p,{name,calendarId,copyFrom=null}){
  name=required(name,'Nome piano');uniqueName(p.boards,name,null,'Piano');const calendar=p.calendars.find(c=>c.id===calendarId);if(!calendar)throw Error('Calendario non trovato');
  const id=uid('plan'),b={id,parentBoardId:id,segmentId:uid('segment'),name,description:'',calendarId,calendarName:calendar.name,attributes:{Name:name},scheduledGroups:[],unscheduledGroups:[],dateAudit:{confidence:'stored'}};
  if(copyFrom){const old=p.boards.find(b=>b.id===copyFrom);if(!old)throw Error('Piano non trovato');for(const container of ['scheduledGroups','unscheduledGroups'])b[container]=old[container].map(g=>({...clone(g),id:uid('group'),sourceIndex:undefined,created:true,strips:g.strips.map(s=>({...clone(s),sourceKey:uid('strip')}))}))}
  else b.unscheduledGroups=[{...newGroup('RemainingUnscheduledStrips',null,b),strips:p.scenes.map(s=>({kind:'scene',bdsId:s.bdsId,sourceKey:uid('strip')}))}];
  if(p.format==='mmsx'){b.mmsxBoard=id;b.mmsxSegment=b.segmentId;b.yardSegments=[{id:`${id}:boneyard`,name:'Boneyard'}];for(const container of ['scheduledGroups','unscheduledGroups'])for(const g of b[container]){g.mmsxSegment=container==='scheduledGroups'?b.segmentId:b.yardSegments[0].id;if(g.mmsxDay)g.mmsxDay=JSON.stringify([id,g.mmsxSegment,uid('day')])}}
  if(!b.scheduledGroups.some(g=>g.kind==='RemainingScheduledStrips'))b.scheduledGroups.push(newGroup('RemainingScheduledStrips',null,b));p.boards.push(b);refreshDocument(p);return b;
}
export function editPlan(p,id,values){
  const b=p.boards.find(b=>b.id===id);if(!b)throw Error('Piano non trovato');const name=required(values.name,'Nome piano');uniqueName(p.boards,name,b,'Piano');const c=p.calendars.find(c=>c.id===values.calendarId);if(!c)throw Error('Calendario non trovato');const old=b.name;
  Object.assign(b,values,{name,calendarName:c.name});b.attributes={...b.attributes,Name:name};if(b.parentBoardName===old)b.parentBoardName=name;for(const g of b.scheduledGroups)g.calendarId=c.id;
  if(p.activeBoard===old)p.activeBoard=name;if(p.studio?.dood&&Object.hasOwn(p.studio.dood,old)){Object.defineProperty(p.studio.dood,name,{value:p.studio.dood[old],enumerable:true,writable:true,configurable:true});if(name!==old)delete p.studio.dood[old]}for(const e of p.events)if(e.studioBoardName===old)e.studioBoardName=name;
}
export function addDay(p,boardId,{date,shootingDayNumber}){
  const b=p.boards.find(b=>b.id===boardId);if(!b)throw Error('Piano non trovato');if(!validDate(date)||!Number.isSafeInteger(shootingDayNumber)||shootingDayNumber<1)throw Error('Data o numero giornata non valido');if(b.scheduledGroups.some(g=>g.kind==='ScheduleDay'&&g.shootingDayNumber===shootingDayNumber))throw Error('Numero giornata già presente');
  const g=newGroup('ScheduleDay',date,b,shootingDayNumber);b.scheduledGroups.splice(Math.max(0,b.scheduledGroups.findIndex(g=>g.kind==='RemainingScheduledStrips')),0,g);refreshDocument(p);return g;
}
export function editFlag(p,id,values){
  const old=p.redFlags.find(f=>f.id===id);if(id&&!old)throw Error('Red Flag non trovata');const name=required(values.name,'Tipo / nome');
  if(!validDate(values.startDate)||!validDate(values.endDate)||values.endDate<values.startDate)throw Error('Intervallo non valido');
  if(values.target.kind==='element'&&!p.elements.some(e=>e.id===values.target.elementId))throw Error('Elemento non trovato');
  const f={...old,...values,name,id:old?.id||uid('flag'),date:values.startDate,typeName:name,targetResolved:values.target.kind!=='unresolved',scope:{kind:'project'},dateOrigin:'edited'};if(old)Object.assign(old,f);else p.redFlags.push(f);refreshDocument(p);return f;
}
export function validateDocument(p,{allowLegacySingleValues=false}={}){
  if(!p||typeof p.title!=='string'||!p.title.trim())throw Error('Titolo progetto non valido');
  for(const key of ['scenes','elements','categorySettings','boards','calendars','events','redFlags'])if(!Array.isArray(p[key]))throw Error(`Raccolta ${key} non valida`);
  if(!p.boards.length)throw Error('Il documento richiede almeno un piano');
  for(const s of p.scenes)if(!record(s)||!Array.isArray(s.elementRefs)||!record(s.requirements))throw Error('Scheda scena non valida');
  for(const el of p.elements)if(!record(el)||typeof el.name!=='string')throw Error('Elemento non valido');
  for(const c of p.calendars)if(!record(c.daysOff)||!record(c.scheduleDates)||!Array.isArray(c.specialDays))throw Error('Calendario non valido');
  for(const e of p.events)if(!Array.isArray(e.targets))throw Error('Target evento non validi');
  for(const f of p.redFlags)if(!record(f.target))throw Error('Target Red Flag non valido');
  for(const [key,field] of [['scenes','bdsId'],['elements','id'],['boards','id'],['calendars','id']]){const ids=new Set();for(const r of p[key]){if(typeof r[field]!=='string'||ids.has(r[field]))throw Error(`Identità ${key} non valida`);ids.add(r[field])}}
  if(!allowLegacySingleValues)for(const scene of p.scenes)assertSceneSingleValues(p,scene);
  const scenes=new Set(p.scenes.map(s=>s.bdsId));for(const b of p.boards){const keys=new Set();for(const g of [...b.scheduledGroups,...b.unscheduledGroups]){if(!Array.isArray(g.strips))throw Error('Gruppo strip non valido');for(const s of g.strips){if(keys.has(s.sourceKey)||!s.sourceKey)throw Error('Identità strip duplicata');keys.add(s.sourceKey);if(s.kind==='scene'&&!scenes.has(s.bdsId))throw Error('Strip senza scena')}}}
  return p;
}
