import {escapeHtml as e} from './dood-print.js';
const normalized=key=>key.toLowerCase().replace(/[^a-z0-9]/g,'');
const titleField=key=>['title','picturetitle'].includes(normalized(key));
const fieldAliases={preparer:['preparer','preparedby'],episode:['episode','episodeno'],miscOne:['miscone','misc1'],miscTwo:['misctwo','misc2'],miscThree:['miscthree','misc3'],miscFour:['miscfour','misc4']};
const fields=[['company','Società'],['prodNo','Numero produzione'],['director','Regia'],['preparer','Preparato da'],['producer','Produttore'],['timing','Tempi'],['upm','Direttore di produzione'],['episode','Episodio'],['asstDirector','Aiuto regia'],['miscOne','Informazioni aggiuntive 1'],['artDirector','Scenografia'],['miscTwo','Informazioni aggiuntive 2'],['setDresser','Arredamento set'],['miscThree','Informazioni aggiuntive 3'],['scriptDated','Data sceneggiatura'],['miscFour','Informazioni aggiuntive 4']];
const text=value=>value==null?'':typeof value==='object'?JSON.stringify(value,null,2):String(value);
export function productionFields(project){
 const values=project.production||{},keys=Object.keys(values),used=new Set(keys.filter(titleField));
 const standard=fields.map(([name,label])=>{
  const aliases=fieldAliases[name]||[normalized(name)],key=keys.find(key=>aliases.includes(normalized(key)))||(project.format==='msd'?name[0].toUpperCase()+name.slice(1):name);used.add(key);
  return {key,label,value:values[key]};
 });
 return [...standard,...keys.filter(key=>!used.has(key)).map(key=>({key,label:key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' '),value:values[key]}))];
}
export function productionInfoMarkup(project){
 const fieldMarkup=({key,label,value})=>{
  const contents=text(value),multiline=typeof value==='object'&&value!==null||contents.includes('\n')||contents.length>100;
  const attr=`data-production-field="${e(key)}" data-production-initial="${e(contents)}" aria-label="${e(label)}"`;
  const control=typeof value==='boolean'?`<select ${attr}><option value="true" ${value?'selected':''}>Sì</option><option value="false" ${!value?'selected':''}>No</option></select>`:multiline?`<textarea ${attr} rows="3" spellcheck="false">${e(contents)}</textarea>`:`<input ${attr} type="${typeof value==='number'?'number':'text'}" ${typeof value==='number'?'step="any"':''} value="${e(contents)}">`;
  return `<label class="inline-field production-field ${multiline?'span-all':''}"><span>${e(label)}</span>${control}</label>`;
 };
 return `<section class="production-info-panel" aria-label="Production Info"><div class="production-edit-fields"><label class="inline-field production-field span-all"><span>Titolo progetto</span><input data-production-title data-production-initial="${e(project.title)}" aria-label="Titolo progetto" required value="${e(project.title)}"></label>${productionFields(project).map(fieldMarkup).join('')}</div></section>`;
}
export function productionChanges(project,title,entries){
 title=title.trim();if(!title)throw Error('Titolo obbligatorio');const production={...project.production};
 for(const [key,value] of entries){
  const original=project.production?.[key];if(value===text(original))continue;
  let next=value;
  if(original!==null&&typeof original==='object')next=JSON.parse(value);
  else if(typeof original==='number'){if(value.trim()===''||!Number.isFinite(Number(value)))throw Error(`Valore numerico non valido: ${key}`);next=Number(value)}
  else if(typeof original==='boolean')next=value==='true';
  Object.defineProperty(production,key,{value:next,enumerable:true,writable:true,configurable:true});
 }
 for(const key of Object.keys(production))if(titleField(key))production[key]=title;
 return {title,production};
}

export function createProductionEditing({getProject,onChange,onError}){
 const selector='[data-production-field],[data-production-title]';
 const current=(input,project)=>input.hasAttribute('data-production-title')?project.title:text(project.production?.[input.dataset.productionField]);
 function commit(input){
  const project=getProject();if(!project)return;if(input.value===current(input,project)){input.dataset.productionInitial=input.value;input.removeAttribute('aria-invalid');onError('');return}
  try{
   const title=input.hasAttribute('data-production-title')?input.value:project.title;
   const entries=input.hasAttribute('data-production-title')?[]:[[input.dataset.productionField,input.value]];
   const changes=productionChanges(project,title,entries);
   onChange(()=>Object.assign(project,changes),{preserveView:'projectView'});
   input.value=current(input,project);input.dataset.productionInitial=input.value;input.removeAttribute('aria-invalid');onError('');
  }catch(error){input.setAttribute('aria-invalid','true');onError(error.message)}
 }
 document.addEventListener('change',event=>{if(event.target.matches(selector))commit(event.target)});
 document.addEventListener('keydown',event=>{
  const input=event.target;if(!input.matches(selector))return;
  if(event.key==='Escape'){event.preventDefault();input.value=current(input,getProject());input.dataset.productionInitial=input.value;input.removeAttribute('aria-invalid');onError('')}
  if(event.key==='Enter'&&input.tagName!=='TEXTAREA'){event.preventDefault();commit(input)}
 });
 return {hasDraft(){const project=getProject();return Boolean(project&&[...document.querySelectorAll(selector)].some(input=>input.value!==input.dataset.productionInitial||input.hasAttribute('aria-invalid')))}};
}
