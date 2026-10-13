import {createDocument,editScene,editElement,editCategory,createCalendar,editCalendarDetails,createPlan,editPlan,addDay,editFlag} from './document-model.js';
import {sceneFieldsMarkup,fitSceneTextareas} from './integrated-editing.js';
import {escapeHtml as e} from './dood-print.js';
import {createOverlay} from './overlay-service.js';
import {parseSceneEntry} from './entry-format.js';
import {validDate} from './production-data.js';
import {builtinField} from './element-management.js';
import {assignPlanCalendar} from './workspace-commands.js';
const labels={production:'Produzione',scene:'Scene e spoglio',element:'Elementi e proprietà',category:'Categorie',calendar:'Calendari',plan:'Piani',day:'Giornate',banner:'Banner',flag:'Red Flags'};
const fields=(spec,values)=>spec.map(([key,label,type='text',required=false])=>`<label>${e(label)}${type==='json'?`<textarea name="${key}" data-json rows="5">${e(JSON.stringify(values[key]??{},null,2))}</textarea>`:type==='textarea'?`<textarea name="${key}">${e(values[key]??'')}</textarea>`:`<input name="${key}" type="${type}" ${required?'required':''} ${type==='number'?'min="0" step="1"':''} value="${e(values[key]??'')}">`}</label>`).join('');
const options=(list,id,label)=>list.map(r=>`<option value="${e(id(r))}">${e(label(r))}</option>`).join('');
export function createDocumentEditor({getContext,onChange,onCreate,onRefresh,onSaved}){
  const overlay=createOverlay('documentEditor',{className:'document-editor'}),dialog=overlay.dialog;
  let kind='production',recordId='',context,draftRefs=[];
  const p=()=>context.project;
  function records(){switch(kind){case 'scene':return p().scenes;case 'element':return p().elements;case 'category':return p().categorySettings;case 'calendar':return p().calendars;case 'plan':return p().boards;case 'flag':return p().redFlags;case 'day':return board().scheduledGroups.filter(g=>g.kind==='ScheduleDay');case 'banner':return [...board().scheduledGroups,...board().unscheduledGroups].flatMap(g=>g.strips.filter(s=>s.kind==='banner'));default:return []}}
  const id=r=>r.id||r.sourceKey||r.name;
  function board(){return p().boards.find(b=>b.name===context.boardName)||p().boards[0]}
  const label=r=>r.scene?`${r.scene} · ${r.set||r.synopsis||''}`:r.category?`${r.category} · ${r.name}`:r.shootingDayNumber?`G ${r.shootingDayNumber} · ${r.date||'Senza data'}`:r.text||r.name||id(r);
  function draw(){
    const list=records(),r=list.find(r=>id(r)===recordId)||{},fresh=!list.some(r=>id(r)===recordId);
    dialog.innerHTML=`<div class="print-service-header"><h2>${labels[kind]}</h2><button type="button" data-close>Chiudi</button></div><form id="documentEditForm"><div class="document-edit-fields">${body(r,fresh)}</div><p role="alert" id="editorError"></p><div class="dialog-actions"><button type="button" data-cancel>Annulla</button><button type="submit">${fresh&&kind!=='production'?'Crea':'Applica modifiche'}</button></div></form>`;
    dialog.querySelector('[data-close]').onclick=close;dialog.querySelector('[data-cancel]').onclick=close;
    dialog.querySelector('form').onsubmit=submit;
    if(kind==='scene'){wireRefs(r);fitSceneTextareas(dialog)}
    if(kind==='element')dialog.querySelector('[name=category]').value=r.category||p().categorySettings[0]?.name||'';
    if(kind==='plan')dialog.querySelector('[name=calendarId]').value=r.calendarId||board().calendarId;
    if(kind==='flag')dialog.querySelector('[name=targetId]').value=r.target?.kind==='unresolved'?'__studio_unresolved_target__':r.target?.elementId||'';
    dirty=false;
  }
  let dirty=false;
  dialog.addEventListener('input',()=>{dirty=true});dialog.addEventListener('change',event=>{if(!['editorKind','editorRecord'].includes(event.target.id))dirty=true});
  function close(){dirty=false;dialog.close()}
  dialog.addEventListener('close',()=>{dirty=false});
  function body(r,fresh){
    if(kind==='production')return fields([['title','Titolo progetto','text',true]],p())+propertyFields(p().production,'production');
    if(kind==='scene'){
      draftRefs=structuredClone(r.elementRefs||[]);
      return sceneFieldsMarkup(r,{form:true,project:p()})+`<fieldset><legend>Elementi della scena e quantità</legend><div id="editorRefs"></div><label>Aggiungi elemento<select id="editorAddElement"><option value="">Scegli…</option>${options(p().elements,r=>r.id,r=>`${r.category} · ${r.boardId||''} ${r.name}`)}</select></label></fieldset>`;
    }
    if(kind==='element')return fields([['name','Nome','text',true],['boardId','Board ID'],['sortOrder','Ordine'],['notes','Note','textarea']],{...r,notes:r.notes??r.source?.notes??''})+`<label>Categoria<select name="category">${options([...p().categorySettings,...(r.category&&!p().categorySettings.some(c=>c.name===r.category)?[{name:r.category}]:[])],c=>c.name,c=>c.name)}</select></label>`+propertyFields(r.properties||{},'properties')+`<label>Elementi collegati<select name="linkedElementIds" multiple size="5">${p().elements.filter(el=>el.id!==r.id).map(el=>`<option value="${e(el.id)}" ${(r.linkedElements||[]).some(([cat,name])=>cat===el.category&&name===el.name)?'selected':''}>${e(el.category)} · ${e(el.name)}</option>`).join('')}</select></label>`;
    if(kind==='category')return fields([['name','Nome','text',true],['color','Colore','color']],{...r,color:r.color||'#0c877c'})+propertyFields(r.attributes||{},'attributes')+propertyFields(r.properties||{},'properties');
    if(kind==='calendar')return fields([['name','Nome','text',true]],r)+fields(['ProductionPrepStartDate','ProductionStartDate','ProductionEndDate','ProductionWrapDate'].map(key=>[key,{ProductionPrepStartDate:'Inizio preparazione',ProductionStartDate:'Inizio riprese',ProductionEndDate:'Fine riprese',ProductionWrapDate:'Wrap'}[key],'date']),Object.fromEntries(Object.entries(r.scheduleDates||{}).map(([k,v])=>[k,v.iso])))+propertyFields(r.options||{},'options')+`<p>Regole settimanali ed eccezioni si modificano in Calendar → Regole e date.</p>`;
    if(kind==='plan')return fields([['name','Nome','text',true],['description','Descrizione','textarea']],r)+`<label>Calendario<select name="calendarId">${options(p().calendars,c=>c.id,c=>c.name)}</select></label>${fresh?`<label>Copia ordine da<select name="copyFrom"><option value="">Piano vuoto</option>${options(p().boards,b=>b.id,b=>b.name)}</select></label>`:''}`;
    if(kind==='day')return fields([['date','Data riprese','date',true],['shootingDayNumber','Numero giornata','number',true]],r);
    if(kind==='banner')return fields([['text','Testo banner','textarea',true],['estimateTimeA','Tempo stimato']],r)+`<label>Gruppo<select name="groupId">${options([...board().scheduledGroups,...board().unscheduledGroups],g=>g.id,g=>g.kind==='ScheduleDay'?`G ${g.shootingDayNumber} · ${g.date||''}`:g.kind)}</select></label>`;
    if(kind==='flag')return fields([['name','Nome vincolo','text',true],['type','Tipo (unavailable per indisponibilità)'],['typeId','ID tipo sorgente'],['startDate','Dal','date',true],['endDate','Al','date',true],['note','Note','textarea'],['color','Colore']],r)+`<label>Disponibilità / vincolo per<select name="targetId"><option value="">Intero progetto</option>${r.target?.kind==='unresolved'?'<option value="__studio_unresolved_target__">Riferimento importato non risolto</option>':''}${options(p().elements,r=>r.id,r=>`${r.category} · ${r.name}`)}</select></label>`;
    return '';
  }
  function propertyFields(values,prefix){return `<fieldset data-properties="${prefix}"><legend>${({production:'Informazioni di produzione',attributes:'Impostazioni categoria',options:'Opzioni calendario',properties:'Proprietà'})[prefix]}</legend><div data-property-rows>${Object.entries(values).map(([key,v])=>propertyRow(key,v)).join('')}</div></fieldset>`}
  function propertyRow(key,value){return `<div data-property-row><input aria-label="Nome campo" data-key value="${e(key)}"><textarea aria-label="Valore campo" data-value ${value&&typeof value==='object'?'data-json-value':''}>${e(value&&typeof value==='object'?JSON.stringify(value,null,2):value??'')}</textarea><button type="button" data-remove-property aria-label="Rimuovi campo">×</button></div>`}
  dialog.addEventListener('click',event=>{const remove=event.target.closest('[data-remove-property]');if(remove){remove.closest('[data-property-row]').remove();dirty=true}});
  function wireRefs(scene){
    function refs(){dialog.querySelector('#editorRefs').innerHTML=draftRefs.map((ref,i)=>`<div data-ref="${i}"><span>${e(ref.category)} · ${e(ref.name||ref.elementId||'Non risolto')}</span><input aria-label="Quantità ${e(ref.name)}" type="number" min="0" step="any" placeholder="Non specificata" value="${e(typeof ref.quantity==='number'?ref.quantity:'')}" ${ref.quantity&&typeof ref.quantity==='object'?'disabled':''}><button type="button" data-remove-ref="${i}" aria-label="Rimuovi elemento">×</button></div>`).join('')}
    refs();dialog.querySelector('#editorRefs').oninput=event=>{const row=event.target.closest('[data-ref]');if(row)draftRefs[Number(row.dataset.ref)].quantity=event.target.value===''?null:Number(event.target.value)};
    dialog.querySelector('#editorRefs').onclick=event=>{const button=event.target.closest('[data-remove-ref]');if(button){const removed=draftRefs.splice(Number(button.dataset.removeRef),1)[0],field=builtinField(removed.category);if(field)dialog.querySelector(`[name="${field}"]`).value='';dirty=true;refs()}};
    dialog.querySelector('#editorAddElement').onchange=event=>{const el=p().elements.find(e=>e.id===event.target.value);if(el){const field=builtinField(el.category);if(field){draftRefs=draftRefs.filter(ref=>builtinField(ref.category)!==field);dialog.querySelector(`[name="${field}"]`).value=el.name}}if(el&&!draftRefs.some(r=>r.elementId===el.id))draftRefs.push({elementId:el.id,category:el.category,name:el.name,resolved:true,quantity:null,quantityOrigin:'absent'});event.target.value='';dirty=true;refs()};
  }
  function submit(event){
    event.preventDefault();const form=event.target;
    try{
      const original=records().find(r=>id(r)===recordId)||{};
      const values={};for(const input of form.querySelectorAll('[name]')){let value=input.value;if(input.hasAttribute('data-json'))value=JSON.parse(value);if(input.type==='number')value=value===''?null:Number(value);values[input.name]=!input.hasAttribute('data-json')&&Object.hasOwn(original,input.name)&&input.value===String(original[input.name]??'')?original[input.name]:value}
      if(kind==='element'){
        values.linkedElements=[...form.querySelector('[name=linkedElementIds]').selectedOptions].map(option=>{const el=p().elements.find(el=>el.id===option.value);return [el.category,el.name]});
        for(const link of original.linkedElements||[])if(!p().elements.some(el=>el.category===link[0]&&el.name===link[1]))values.linkedElements.push(link);
        delete values.linkedElementIds;
      }
      for(const section of form.querySelectorAll('[data-properties]')){const props={};for(const row of section.querySelectorAll('[data-property-row]')){const key=row.querySelector('[data-key]').value.trim(),input=row.querySelector('[data-value]');if(!key)throw Error('Nome campo obbligatorio');if(Object.hasOwn(props,key))throw Error('Nome campo duplicato');Object.defineProperty(props,key,{enumerable:true,configurable:true,writable:true,value:input.hasAttribute('data-json-value')?JSON.parse(input.value):input.value})}values[section.dataset.properties]=props}
      let createdRecord;const success=onChange(()=>{
        const project=p(),r=records().find(r=>id(r)===recordId);
        switch(kind){
          case 'production':if(!values.title.trim())throw Error('Titolo obbligatorio');project.title=values.title.trim();project.production=values.production;if(Object.hasOwn(project.production,'PictureTitle'))project.production.PictureTitle=project.title;if(Object.hasOwn(project.production,'title'))project.production.title=project.title;break;
          case 'scene':for(const key of ['pagesEighths','estimateTimeA','estimateTimeB'])values[key]=parseSceneEntry(key,values[key]);editScene(project,recordId||null,values,draftRefs);break;
          case 'element':if(!Array.isArray(values.linkedElements)&&!(values.linkedElements&&Object.keys(values.linkedElements).length===0))throw Error('Elementi collegati non validi');values.linkedElements=Array.isArray(values.linkedElements)?values.linkedElements:[];editElement(project,recordId||null,values);break;
          case 'category':editCategory(project,recordId||null,values);break;
          case 'calendar':{const dates={...r?.scheduleDates};for(const k of ['ProductionPrepStartDate','ProductionStartDate','ProductionEndDate','ProductionWrapDate']){dates[k]={...dates[k],iso:values[k]||null,origin:'edited'};delete values[k]}values.scheduleDates=dates;if(r)editCalendarDetails(project,recordId,values);else createCalendar(project,values);break}
          case 'plan':if(r){const calendarChanged=r.calendarId!==values.calendarId;editPlan(project,recordId,values);if(calendarChanged)assignPlanCalendar(project,r.name,values.calendarId)}else{createdRecord=createPlan(project,values);if(values.copyFrom&&project.boards.find(b=>b.id===values.copyFrom)?.calendarId!==values.calendarId)assignPlanCalendar(project,createdRecord.name,values.calendarId);project.activeBoard=createdRecord.name}break;
          case 'day':if(!r)addDay(project,board().id,values);else{if(!validDate(values.date)||!Number.isSafeInteger(values.shootingDayNumber)||values.shootingDayNumber<1)throw Error('Giornata non valida');if(board().scheduledGroups.some(g=>g!==r&&g.kind==='ScheduleDay'&&g.shootingDayNumber===values.shootingDayNumber))throw Error('Numero giornata duplicato');Object.assign(r,values,{ordinal:values.shootingDayNumber,dateLocked:true,dateOrigin:'edited'})}break;
          case 'banner':{const g=[...board().scheduledGroups,...board().unscheduledGroups].find(g=>g.id===values.groupId);if(!g||!values.text.trim())throw Error('Testo e gruppo obbligatori');delete values.groupId;if(r){Object.assign(r,values);for(const source of [...board().scheduledGroups,...board().unscheduledGroups])if(source!==g)source.strips=source.strips.filter(s=>s!==r);if(!g.strips.includes(r))g.strips.push(r)}else g.strips.push({kind:'banner',sourceKey:`studio-banner:${crypto.randomUUID()}`,style:{},...values});break}
          case 'flag':{const el=project.elements.find(e=>e.id===values.targetId);values.target=values.targetId==='__studio_unresolved_target__'?r.target:el?{kind:'element',elementId:el.id,category:el.category,element:el.name}:{kind:'project'};delete values.targetId;editFlag(project,recordId||null,values);break}
        }
      });
      if(success===false)throw Error('Modifiche non applicate');dirty=false;dialog.close();onSaved?.(kind,createdRecord);onRefresh?.();
    }catch(error){dialog.querySelector('#editorError').textContent=error.message}
  }
  return {hasDraft:()=>dialog.open&&dirty,reset(){dialog.close();dirty=false},open(section='production',selectedId){dialog.close();context=getContext();kind=section;recordId=selectedId??(records()[0]?id(records()[0]):'');draw();overlay.show();fitSceneTextareas(dialog)},newDocument(){
    dialog.close();
    dialog.innerHTML=`<h2>Nuovo progetto</h2><form id="newDocumentForm"><label>Titolo<input name="title" required maxlength="160" value="Nuovo progetto"></label><div class="dialog-actions"><button type="button" data-cancel>Annulla</button><button type="submit">Crea progetto</button></div><p role="alert"></p></form>`;
    dialog.querySelector('[data-cancel]').onclick=close;dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{onCreate(createDocument(event.target.elements.title.value.trim()));dirty=false;dialog.close()}catch(error){dialog.querySelector('[role=alert]').textContent=error.message}};dirty=false;dialog.showModal();
  }};
}
