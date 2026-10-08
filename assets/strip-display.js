/* Display preferences are independent of the imported document and its report layouts. */
export const STANDARD_PRESETS={
  compact:{label:'Compatto',fields:['scene','ie','set','dn','pages']},
  detailed:{label:'Dettagliato',fields:['scene','ie','set','dn','pages','location','estimate','synopsis']},
  production:{label:'Produzione',fields:['scene','set','pages','estimate','unit','sequence','cast','synopsis']}
};
const BASE_FIELDS=[
  ['scene','Scena',1],['ie','INT / EXT',1],['set','Set',4],['dn','Giorno / notte',1],
  ['pages','Pagine',1],['location','Location',3],['estimate','Tempo stimato',1],
  ['unit','Unità',1],['sequence','Sequenza',2],['scriptDay','Script day',1],
  ['scriptPageNumbers','Pagine script',1],['sheetNumber','Scheda',1],
  ['shootDay','Giornata',1],['shootDate','Data riprese',2],['flags','Red Flags',1],
  ['synopsis','Sinossi',5],['comments','Commenti',4]
];
export function stripFields(project){
  const categories=project?.categorySettings||[];
  return BASE_FIELDS.map(([key,label,weight])=>({key,label,weight})).concat(categories.map(c=>({
    key:`category:${c.id??c.name}`,label:c.name,category:c.name,weight:3
  })));
}
export function presetFields(project,preset,{calendar=false}={}){
  const keys=STANDARD_PRESETS[preset]?.fields||STANDARD_PRESETS.compact.fields;
  const cast=stripFields(project).find(f=>f.category&&/cast|interpreti|attori/i.test(f.label));
  if(calendar&&preset==='compact')return ['scene','set','pages'];
  return keys.flatMap(key=>key==='cast'?(cast?[cast.key]:[]):[key]);
}
export function selectedFields(project,keys){
  const definitions=new Map(stripFields(project).map(f=>[f.key,f]));
  return [...new Set(keys||[])].map(key=>definitions.get(key)).filter(Boolean);
}
export function standardLayout(preset){
  return {name:`studio:${preset}`,label:`Standard · ${STANDARD_PRESETS[preset]?.label||'Personalizzato'}`,
    standard:true,preset,orientation:'HORIZONTAL',length:12,width:.3,fields:[],header:[],attributes:{},
    dayBreakText:'Fine giornata {day} · {date} · {pages} pag.',bannerStyle:{},dayBreakStyle:{}};
}
export function sceneFieldText(field,scene,{project,group,pages,shortDate,flags=[]}){
  if(field.category){
    const elements=new Map((project.elements||[]).filter(e=>e.category===field.category).map(e=>[e.name,e]));
    return (scene?.requirements?.[field.category]||[]).map(name=>{
      const element=elements.get(name);
      return element?.boardId!=null&&element.boardId!==''?`${element.boardId}. ${name}`:name;
    }).join(', ');
  }
  if(field.key==='pages')return pages(scene?.pagesEighths);
  if(field.key==='shootDay')return String(group?.shootingDayNumber??'—');
  if(field.key==='shootDate')return group?.date?shortDate(group.date):'—';
  if(field.key==='flags')return flags.length?'⚑ '+flags.map(f=>f.name||'Red Flag').join(', '):'—';
  if(field.key==='estimate'){
    const value=scene?.estimateTimeA;
    if(value==null||value==='')return '—';
    const minutes=/^\d+$/.test(String(value))?Number(value):null;
    return minutes==null?String(value):`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  }
  return String(scene?.[field.key]??'—')||'—';
}
export function fieldsMarkup(fields,scene,helpers,{calendar=false}={}){
  return fields.map(field=>{
    const value=sceneFieldText(field,scene,helpers),safe=helpers.safe;
    const className=calendar?({scene:'calendar-strip-number',set:'calendar-strip-set',pages:'calendar-strip-pages',synopsis:'mini-synopsis'}[field.key]||'calendar-extra-field'):'standard-field';
    const tag=field.key==='scene'?'b':'span';
    return `<${tag} class="${className}" data-strip-field="${safe(field.key)}" data-strip-label="${safe(field.label)}" title="${safe(`${field.label}: ${value}`)}" aria-label="${safe(`${field.label}: ${value}`)}">${safe(value)}</${tag}>`;
  }).join('');
}
export function fieldsPickerMarkup(project,keys,{target,safe}){
  const chosen=new Set(keys);
  return `<fieldset class="strip-fields-picker"><legend>Campi delle strip</legend>${stripFields(project).map(field=>`<label><input type="checkbox" data-strip-field-option="${safe(field.key)}" data-field-target="${target}" ${chosen.has(field.key)?'checked':''} ${chosen.size===1&&chosen.has(field.key)?'disabled':''}>${safe(field.category?'Elementi · '+field.label:field.label)}</label>`).join('')}</fieldset>`;
}
