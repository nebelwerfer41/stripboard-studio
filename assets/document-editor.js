import {SCENE_FIELDS,createDocument,editScene,editElement,editCategory,createCalendar,editCalendarDetails,createPlan,editPlan,addDay,editFlag} from './document-model.js';
import {escapeHtml as e} from './dood-print.js';
import {validDate} from './production-data.js';
const labels={production:'Produzione',scene:'Scene e spoglio',element:'Elementi e proprietà',category:'Categorie',calendar:'Calendari',plan:'Piani',day:'Giornate',banner:'Banner',flag:'Red Flags'};
const fields=(spec,values)=>spec.map(([key,label,type='text',required=false])=>`<label>${e(label)}${type==='json'?`<textarea name="${key}" data-json rows="5">${e(JSON.stringify(values[key]??{},null,2))}</textarea>`:type==='textarea'?`<textarea name="${key}">${e(values[key]??'')}</textarea>`:`<input name="${key}" type="${type}" ${required?'required':''} ${type==='number'?'min="0" step="1"':''} value="${e(values[key]??'')}">`}</label>`).join('');
const options=(list,id,label)=>list.map(r=>`<option value="${e(id(r))}">${e(label(r))}</option>`).join('');
export function createDocumentEditor({getContext,onChange,onCreate,onRefresh}){
  const dialog=document.createElement('dialog');dialog.id='documentEditor';dialog.className='document-editor';document.body.append(dialog);
  let kind='production',recordId='',context,draftRefs=[];
  const p=()=>context.project;
  function records(){switch(kind){case 'scene':return p().scenes;case 'element':return p().elements;case 'category':return p().categorySettings;case 'calendar':return p().calendars;case 'plan':return p().boards;case 'flag':return p().redFlags;case 'day':return board().scheduledGroups.filter(g=>g.kind==='ScheduleDay');case 'banner':return [...board().scheduledGroups,...board().unscheduledGroups].flatMap(g=>g.strips.filter(s=>s.kind==='banner'));default:return []}}
  const id=r=>r.id||r.sourceKey||r.name;
  function board(){return p().boards.find(b=>b.name===context.boardName)||p().boards[0]}
  const label=r=>r.scene?`${r.scene} · ${r.set||r.synopsis||''}`:r.category?`${r.category} · ${r.name}`:r.shootingDayNumber?`G ${r.shootingDayNumber} · ${r.date||'Senza data'}`:r.text||r.name||id(r);
  function draw(){
    const list=records(),r=list.find(r=>id(r)===recordId)||{},fresh=!list.some(r=>id(r)===recordId);
    dialog.innerHTML=`<div class="print-service-header"><h2>Modifica documento</h2><button type="button" data-close>Chiudi</button></div><div class="document-edit-controls"><label>Sezione<select id="editorKind">${Object.entries(labels).map(([k,v])=>`<option value="${k}" ${k===kind?'selected':''}>${v}</option>`).join('')}</select></label>${kind!=='production'?`<label>Voce<select id="editorRecord"><option value="">Nuovo…</option>${options(list,id,label)}</select></label><button type="button" data-new>＋ Nuovo</button>`:''}</div><form id="documentEditForm"><div class="document-edit-fields">${body(r,fresh)}</div><p role="alert" id="editorError"></p><div class="dialog-actions"><button type="button" data-cancel>Annulla</button><button type="submit">${fresh&&kind!=='production'?'Crea':'Applica modifiche'}</button></div></form>`;
    if(dialog.querySelector('#editorRecord'))dialog.querySelector('#editorRecord').value=recordId;
    dialog.querySelector('[data-close]').onclick=()=>close();dialog.querySelector('[data-cancel]').onclick=close;
    dialog.querySelector('#editorKind').onchange=event=>{if(!discard()) {event.target.value=kind;return}kind=event.target.value;recordId=records()[0]?id(records()[0]):'';draw()};
    const select=dialog.querySelector('#editorRecord');if(select)select.onchange=event=>{if(!discard()){event.target.value=recordId;return}recordId=event.target.value;draw()};
    const add=dialog.querySelector('[data-new]');if(add)add.onclick=()=>{if(discard()){recordId='';draw()}};
    dialog.querySelector('form').onsubmit=submit;
    if(kind==='scene')wireRefs(r);
    if(kind==='element')dialog.querySelector('[name=category]').value=r.category||p().categorySettings[0]?.name||'';
    if(kind==='plan')dialog.querySelector('[name=calendarId]').value=r.calendarId||board().calendarId;
    if(kind==='flag')dialog.querySelector('[name=targetId]').value=r.target?.kind==='unresolved'?'__studio_unresolved_target__':r.target?.elementId||'';
    dirty=false;
  }
  let dirty=false;
  dialog.addEventListener('input',()=>{dirty=true});dialog.addEventListener('change',event=>{if(!['editorKind','editorRecord'].includes(event.target.id))dirty=true});
  const discard=()=>!dirty||window.confirm('Ci sono modifiche non applicate. Scartarle?');
  function close(){if(discard())dialog.close()}
  dialog.addEventListener('cancel',event=>{if(!discard())event.preventDefault()});
  function body(r,fresh){
    if(kind==='production')return fields([['title','Titolo progetto','text',true]],p())+propertyFields(p().production,'production');
    if(kind==='scene'){
      draftRefs=structuredClone(r.elementRefs||[]);
      return fields(Object.entries(SCENE_FIELDS).map(([k,label])=>[k,label,k==='pagesEighths'?'number':['synopsis','comments'].includes(k)?'textarea':'text',k==='scene']),r)+`<fieldset><legend>Elementi della scena e quantità</legend><div id="editorRefs"></div><label>Aggiungi elemento<select id="editorAddElement"><option value="">Scegli…</option>${options(p().elements,r=>r.id,r=>`${r.category} · ${r.boardId||''} ${r.name}`)}</select></label></fieldset>`;
    }
    if(kind==='element')return fields([['name','Nome','text',true],['boardId','Board ID'],['sortOrder','Ordine'],['notes','Note','textarea']],{...r,notes:r.notes??r.source?.notes??''})+`<label>Categoria<select name="category">${options([...p().categorySettings,...(r.category&&!p().categorySettings.some(c=>c.name===r.category)?[{name:r.category}]:[])],c=>c.name,c=>c.name)}</select></label>`+propertyFields(r.properties||{},'properties')+fields([['linkedElements','Elementi collegati (categoria e nome)','json']],{...r,linkedElements:r.linkedElements||[]});
    if(kind==='category')return fields([['name','Nome','text',true],['color','Colore'],['attributes','Impostazioni categoria','json'],['properties','Definizioni proprietà','json']],r);
    if(kind==='calendar')return fields([['name','Nome','text',true],['options','Opzioni calendario','json']],r)+fields(['ProductionPrepStartDate','ProductionStartDate','ProductionEndDate','ProductionWrapDate'].map(key=>[key,{ProductionPrepStartDate:'Inizio preparazione',ProductionStartDate:'Inizio riprese',ProductionEndDate:'Fine riprese',ProductionWrapDate:'Wrap'}[key],'date']),Object.fromEntries(Object.entries(r.scheduleDates||{}).map(([k,v])=>[k,v.iso])))+`<p>Regole settimanali ed eccezioni si modificano in Calendar → Regole e date.</p>`;
    if(kind==='plan')return fields([['name','Nome','text',true],['description','Descrizione','textarea']],r)+`<label>Calendario<select name="calendarId">${options(p().calendars,c=>c.id,c=>c.name)}</select></label>${fresh?`<label>Copia ordine da<select name="copyFrom"><option value="">Piano vuoto</option>${options(p().boards,b=>b.id,b=>b.name)}</select></label>`:''}`;
    if(kind==='day')return fields([['date','Data riprese','date',true],['shootingDayNumber','Numero giornata','number',true]],r);
    if(kind==='banner')return fields([['text','Testo banner','textarea',true],['estimateTimeA','Tempo stimato']],r)+`<label>Gruppo<select name="groupId">${options([...board().scheduledGroups,...board().unscheduledGroups],g=>g.id,g=>g.kind==='ScheduleDay'?`G ${g.shootingDayNumber} · ${g.date||''}`:g.kind)}</select></label>`;
    if(kind==='flag')return fields([['name','Nome vincolo','text',true],['type','Tipo (unavailable per indisponibilità)'],['typeId','ID tipo sorgente'],['startDate','Dal','date',true],['endDate','Al','date',true],['note','Note','textarea'],['color','Colore']],r)+`<label>Disponibilità / vincolo per<select name="targetId"><option value="">Intero progetto</option>${r.target?.kind==='unresolved'?'<option value="__studio_unresolved_target__">Riferimento importato non risolto</option>':''}${options(p().elements,r=>r.id,r=>`${r.category} · ${r.name}`)}</select></label>`;
    return '';
  }
  function propertyFields(values,prefix){return `<fieldset data-properties="${prefix}"><legend>${prefix==='production'?'Informazioni di produzione':'Proprietà elemento'}</legend><div data-property-rows>${Object.entries(values).map(([key,v])=>propertyRow(key,v)).join('')}</div><button type="button" data-add-property>Aggiungi campo</button></fieldset>`}
  function propertyRow(key,value){return `<div data-property-row><input aria-label="Nome campo" data-key value="${e(key)}"><textarea aria-label="Valore campo" data-value ${value&&typeof value==='object'?'data-json-value':''}>${e(value&&typeof value==='object'?JSON.stringify(value,null,2):value??'')}</textarea><button type="button" data-remove-property aria-label="Rimuovi campo">×</button></div>`}
  dialog.addEventListener('click',event=>{const add=event.target.closest('[data-add-property]'),remove=event.target.closest('[data-remove-property]');if(add){add.parentElement.querySelector('[data-property-rows]').insertAdjacentHTML('beforeend',propertyRow('',''));dirty=true}if(remove){remove.closest('[data-property-row]').remove();dirty=true}});
  function wireRefs(scene){
    function refs(){dialog.querySelector('#editorRefs').innerHTML=draftRefs.map((ref,i)=>`<div data-ref="${i}"><span>${e(ref.category)} · ${e(ref.name||ref.elementId||'Non risolto')}</span><input aria-label="Quantità ${e(ref.name)}" type="number" min="0" step="any" placeholder="Non specificata" value="${e(typeof ref.quantity==='number'?ref.quantity:'')}" ${ref.quantity&&typeof ref.quantity==='object'?'disabled':''}><button type="button" data-remove-ref="${i}" aria-label="Rimuovi elemento">×</button></div>`).join('')}
    refs();dialog.querySelector('#editorRefs').oninput=event=>{const row=event.target.closest('[data-ref]');if(row)draftRefs[Number(row.dataset.ref)].quantity=event.target.value===''?null:Number(event.target.value)};
    dialog.querySelector('#editorRefs').onclick=event=>{const button=event.target.closest('[data-remove-ref]');if(button){draftRefs.splice(Number(button.dataset.removeRef),1);dirty=true;refs()}};
    dialog.querySelector('#editorAddElement').onchange=event=>{const el=p().elements.find(e=>e.id===event.target.value);if(el&&!draftRefs.some(r=>r.elementId===el.id))draftRefs.push({elementId:el.id,category:el.category,name:el.name,resolved:true,quantity:null,quantityOrigin:'absent'});event.target.value='';dirty=true;refs()};
  }
  function submit(event){
    event.preventDefault();const form=event.target;
    try{
      const original=records().find(r=>id(r)===recordId)||{};
      const values={};for(const input of form.querySelectorAll('[name]')){let value=input.value;if(input.hasAttribute('data-json'))value=JSON.parse(value);if(input.type==='number')value=value===''?null:Number(value);values[input.name]=!input.hasAttribute('data-json')&&Object.hasOwn(original,input.name)&&input.value===String(original[input.name]??'')?original[input.name]:value}
      for(const section of form.querySelectorAll('[data-properties]')){const props={};for(const row of section.querySelectorAll('[data-property-row]')){const key=row.querySelector('[data-key]').value.trim(),input=row.querySelector('[data-value]');if(!key)throw Error('Nome campo obbligatorio');if(Object.hasOwn(props,key))throw Error('Nome campo duplicato');Object.defineProperty(props,key,{enumerable:true,configurable:true,writable:true,value:input.hasAttribute('data-json-value')?JSON.parse(input.value):input.value})}values[section.dataset.properties]=props}
      const success=onChange(()=>{
        const project=p(),r=records().find(r=>id(r)===recordId);
        switch(kind){
          case 'production':if(!values.title.trim())throw Error('Titolo obbligatorio');project.title=values.title.trim();project.production=values.production;if(Object.hasOwn(project.production,'PictureTitle'))project.production.PictureTitle=project.title;if(Object.hasOwn(project.production,'title'))project.production.title=project.title;break;
          case 'scene':editScene(project,recordId||null,values,draftRefs);break;
          case 'element':if(!Array.isArray(values.linkedElements)&&!(values.linkedElements&&Object.keys(values.linkedElements).length===0))throw Error('Elementi collegati non validi');values.linkedElements=Array.isArray(values.linkedElements)?values.linkedElements:[];editElement(project,recordId||null,values);break;
          case 'category':editCategory(project,recordId||null,values);break;
          case 'calendar':{const dates={...r?.scheduleDates};for(const k of ['ProductionPrepStartDate','ProductionStartDate','ProductionEndDate','ProductionWrapDate']){dates[k]={...dates[k],iso:values[k]||null,origin:'edited'};delete values[k]}values.scheduleDates=dates;if(r)editCalendarDetails(project,recordId,values);else createCalendar(project,values);break}
          case 'plan':if(r)editPlan(project,recordId,values);else createPlan(project,values);break;
          case 'day':if(!r)addDay(project,board().id,values);else{if(!validDate(values.date)||!Number.isSafeInteger(values.shootingDayNumber)||values.shootingDayNumber<1)throw Error('Giornata non valida');if(board().scheduledGroups.some(g=>g!==r&&g.kind==='ScheduleDay'&&g.shootingDayNumber===values.shootingDayNumber))throw Error('Numero giornata duplicato');Object.assign(r,values,{ordinal:values.shootingDayNumber,dateLocked:true,dateOrigin:'edited'})}break;
          case 'banner':{const g=[...board().scheduledGroups,...board().unscheduledGroups].find(g=>g.id===values.groupId);if(!g||!values.text.trim())throw Error('Testo e gruppo obbligatori');delete values.groupId;if(r){Object.assign(r,values);for(const source of [...board().scheduledGroups,...board().unscheduledGroups])if(source!==g)source.strips=source.strips.filter(s=>s!==r);if(!g.strips.includes(r))g.strips.push(r)}else g.strips.push({kind:'banner',sourceKey:`studio-banner:${crypto.randomUUID()}`,style:{},...values});break}
          case 'flag':{const el=project.elements.find(e=>e.id===values.targetId);values.target=values.targetId==='__studio_unresolved_target__'?r.target:el?{kind:'element',elementId:el.id,category:el.category,element:el.name}:{kind:'project'};delete values.targetId;editFlag(project,recordId||null,values);break}
        }
      });
      if(success===false)throw Error('Modifiche non applicate');dirty=false;dialog.close();onRefresh?.();
    }catch(error){dialog.querySelector('#editorError').textContent=error.message}
  }
  return {hasDraft:()=>dialog.open&&dirty,open(section='production',selectedId){context=getContext();kind=section;recordId=selectedId??(records()[0]?id(records()[0]):'');draw();dialog.showModal()},newDocument(){
    dialog.innerHTML=`<h2>Nuovo progetto</h2><form id="newDocumentForm"><label>Titolo<input name="title" required maxlength="160" value="Nuovo progetto"></label><div class="dialog-actions"><button type="button" data-cancel>Annulla</button><button type="submit">Crea progetto</button></div><p role="alert"></p></form>`;
    dialog.querySelector('[data-cancel]').onclick=close;dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{onCreate(createDocument(event.target.elements.title.value.trim()));dirty=false;dialog.close()}catch(error){dialog.querySelector('[role=alert]').textContent=error.message}};dirty=false;dialog.showModal();
  }};
}
