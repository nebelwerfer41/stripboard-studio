import {quickAddMarkup,createBreakdownQuickAdd,addBreakdownElement} from './breakdown-quick-add.js';
import {SCENE_FIELDS,editScene,editElement} from './document-model.js';
import {breakdownCategories} from './calendar-selectors.js';
import {escapeHtml as e} from './dood-print.js';
import {elementUsage,isBuiltinCategory,elementOptions,catalogCategories,catalogElements} from './element-management.js';
import {SINGLE_SCENE_FIELDS,singleSceneValue} from './scene-values.js';
import {dropdownMarkup,createSearchDropdown} from './search-dropdown.js';
import {sceneEntryValue,parseSceneEntry} from './entry-format.js';

const sceneFieldOrder=['scene','sheetNumber','ie','dn','set','synopsis','location','pagesEighths','scriptDay','episode','unit','scriptPageNumbers','sequence','estimateTimeA','estimateTimeB','comments'];
const wideSceneFields=new Set(['set','synopsis','location','sequence','comments']);
export function sceneFieldsMarkup(scene,{form=false,project=null}={}){
  return `<div class="inline-scene-fields" data-scene-choice-id="${e(scene.id||'')}">${sceneFieldOrder.map(key=>{
    const label=key==='sheetNumber'?'Sheet':SCENE_FIELDS[key];
    const identity=form?`name="${key}"`:`data-scene-field="${key}"`;
    let control;
    if(key==='sheetNumber')control=`<output data-sheet-number aria-label="Sheet" title="Numero assegnato automaticamente">${e(scene.sheetNumber??(form?'Automatico':'—'))}</output>`;
    else if(SINGLE_SCENE_FIELDS.includes(key))control=dropdownMarkup({identity,field:key,value:project?singleSceneValue(project,scene,key).name:scene[key]||'',label});
    else if(['synopsis','comments'].includes(key))control=`<textarea ${identity} class="scene-textarea" aria-label="${e(label)}" rows="1">${e(scene[key]??'')}</textarea>`;
    else control=`<input ${identity} aria-label="${e(label)}" value="${e(sceneEntryValue(scene,key))}" ${key==='pagesEighths'?'placeholder="2 3/8"':key==='estimateTimeA'?'placeholder="HH:MM"':key==='estimateTimeB'?'placeholder="MM:SS"':''}>`;
    return `<label class="inline-field scene-field scene-field-${key} ${wideSceneFields.has(key)?'scene-field-wide':''}"><span>${e(label)}</span>${control}</label>`;
  }).join('')}</div>`;
}
export function fitSceneTextareas(root){
  for(const textarea of root.querySelectorAll('.scene-textarea')){
    textarea.style.height='auto';textarea.style.height=`${Math.min(144,Math.max(30,textarea.scrollHeight+2))}px`;
  }
}
export function sceneEditingMarkup(project,scene,state){
  const categories=breakdownCategories(project,scene,{hideEmpty:false}).filter(c=>!isBuiltinCategory(c));
  return `<section class="inline-scene" data-inline-scene="${e(scene.id)}">${sceneFieldsMarkup(scene,{project})}${quickAddMarkup()}<div class="inline-category-tools"><label class="breakdown-empty-toggle"><input id="hideEmptyCategories" type="checkbox" ${state.hideEmptyCategories?'checked':''}> Nascondi categorie vuote</label><button type="button" data-inline-new="category">＋ Categoria</button></div><div class="breakdown-categories">${categories.map(c=>{
    const single=Boolean(c.sceneField),value=single?singleSceneValue(project,scene,c.sceneField).name:'',hideQuantity=Boolean(c.hideQuantity);
    return `<section class="breakdown-category" data-category-id="${e(c.id)}" data-category-name="${e(c.name)}" ${single?`data-single-scene-field="${e(c.sceneField)}"`:''} style="--category-color:${e(c.color||'#0c877c')}" ${state.hideEmptyCategories&&!c.items.length?'hidden':''}><h4>${e(c.name)} <small>(${c.items.length})</small></h4>${dropdownMarkup({field:c.sceneField,category:c.name,value,label:single?`${c.name} della scena`:`Elementi ${c.name}`})}${!single&&c.items.length?`<div class="category-quantity-heading">${hideQuantity?'Uso giornaliero':'Quantità · uso giornaliero'}</div>`:''}<div class="category-selected">${c.items.map(ref=>{
      const index=scene.elementRefs.findIndex(r=>r.elementId===ref.elementId&&r.category===ref.category&&r.name===ref.name),opaque=ref.quantity&&typeof ref.quantity==='object';
      return `<div class="breakdown-element" ${!ref.resolved?'title="Riferimento non risolto"':''}><strong>${e(ref.element?.boardId!=null&&String(ref.element.boardId)!==''?`${ref.element.boardId}. `:'')}${e(ref.name)}</strong>${single?`<button type="button" data-clear-scene-field="${e(c.sceneField)}" aria-label="Svuota ${e(c.name)}">×</button>`:`<input type="number" min="0" step="any" data-ref-quantity="${index}" ${hideQuantity?'hidden':''} aria-label="Quantità ${e(ref.name)}" placeholder="Qtà" value="${e(typeof ref.quantity==='number'?ref.quantity:'')}" ${opaque?'disabled title="Quantità importata strutturata"':''}><input class="daily-quantity-check" type="checkbox" data-ref-daily-quantity="${index}" aria-label="Usa ${e(ref.name)} nella quantità giornaliera" ${ref.useDailyQuantity!==false?'checked':''}><button type="button" data-ref-remove="${index}" aria-label="Rimuovi ${e(ref.name)}">×</button>`}</div>`;
    }).join('')}</div></section>`;
  }).join('')}</div><p class="inline-edit-hint">Scegli un valore dal dropdown o usa Aggiungi per crearne uno nuovo. I campi built-in ammettono un solo valore per scena.</p></section>`;
}

export function elementCatalogMarkup(project,state){
  const group=state.dataCategoryGroup||'custom';
  const catalog=catalogElements(project),categories=catalogCategories(project).filter(c=>isBuiltinCategory(c)===(group==='builtin')),category=categories.find(c=>c.name===state.dataCategory)||categories[0];
  const compare=new Intl.Collator('it',{numeric:true,sensitivity:'base'}),sort=state.dataSort||{key:'boardId',direction:1};
  const usage=new Map(catalog.filter(el=>el.category===category?.name).map(el=>[el.id,elementUsage(project,state.board,el)]));
  const elements=catalog.filter(el=>el.category===category?.name).sort((a,b)=>{const x=usage.get(a.id)[sort.key]??a[sort.key],y=usage.get(b.id)[sort.key]??b[sort.key];if(x==null||y==null)return x===y?0:x==null?1:-1;return (typeof x==='number'?x-y:compare.compare(String(x),String(y)))*sort.direction});
  const selected=state.dataSelectedElements||new Set(),chosen=elements.filter(el=>selected.has(el.id));
  return `<section class="inline-catalog"><aside class="catalog-categories"><h3>Categorie</h3><div class="catalog-groups"><button type="button" data-category-group="custom" aria-pressed="${group==='custom'}">Categorie</button><button type="button" data-category-group="builtin" aria-pressed="${group==='builtin'}">Built-in 🔒</button></div>${categories.map(c=>`<button type="button" data-catalog-category="${e(c.name)}" aria-pressed="${c===category}" style="--category-color:${e(c.color||'#0c877c')}">${e(c.name)} <small>${catalog.filter(el=>el.category===c.name).length}</small></button>`).join('')}<button type="button" data-inline-new="category">＋ Categoria</button></aside><div class="catalog-elements"><div class="element-toolbar"><strong>${e(category?.name||'Elementi')}</strong><button type="button" data-inline-new="element" data-category="${e(category?.name)}">＋ Elemento</button>${category&&!isBuiltinCategory(category)?`<button type="button" data-edit-document="category" data-record-id="${e(category.id||category.name)}">Proprietà categoria</button>`:''}<span>${chosen.length} selezionati</span><button type="button" data-elements-ids ${!chosen.length?'disabled':''}>Assegna ID…</button><button type="button" data-elements-move ${!chosen.length?'disabled':''}>Sposta in categoria…</button><button type="button" data-elements-order data-category="${e(category?.name)}" ${isBuiltinCategory(category)?'hidden':''}>Salva questo ordine</button></div><label class="inline-field"><span>Cerca elemento</span><input type="search" data-catalog-search aria-label="Cerca elemento" value="${e(state.dataQuery||'')}" placeholder="Nome o Board ID…"></label><div class="flag-table-wrap"><table class="flag-table element-catalog"><thead><tr><th><input type="checkbox" data-elements-select-all aria-label="Seleziona tutti gli elementi visibili" ${elements.length&&chosen.length===elements.length?'checked':''}></th><th><button type="button" data-elements-sort="boardId">Board ID ${sort.key==='boardId'?(sort.direction===1?'↑':'↓'):''}</button></th><th><button type="button" data-elements-sort="name">Nome elemento ${sort.key==='name'?(sort.direction===1?'↑':'↓'):''}</button></th>${[['count','Occorrenze'],['first','Start'],['last','End'],['worked','Pose']].map(([key,label])=>`<th><button type="button" data-elements-sort="${key}">${label} ${sort.key===key?(sort.direction===1?'↑':'↓'):''}</button></th>`).join('')}<th>Proprietà</th></tr></thead><tbody>${elements.map(el=>`<tr data-catalog-element="${e(el.id)}" class="${selected.has(el.id)?'selected':''}"><td><input type="checkbox" data-element-select="${e(el.id)}" ${el.derived?'disabled':''} aria-label="Seleziona ${e(el.name)}" ${selected.has(el.id)?'checked':''}></td><td><input data-element-field="boardId" aria-label="Board ID ${e(el.name)}" value="${e(el.boardId??'')}" ${el.derived?'readonly title="Valore della scena"':elementOptions(el).lockId?'readonly title="ID bloccato"':''}></td><td><input data-element-field="name" aria-label="Nome elemento ${e(el.name)}" value="${e(el.name)}" ${el.derived?'readonly':''}></td><td>${usage.get(el.id).count}</td><td>${usage.get(el.id).first||'—'}</td><td>${usage.get(el.id).last||'—'}</td><td>${usage.get(el.id).worked}</td><td><button type="button" data-edit-document="element" data-record-id="${e(el.id)}">Proprietà…</button></td></tr>`).join('')||'<tr><td colspan="8">Nessun elemento. Aggiungi il primo elemento alla categoria.</td></tr>'}</tbody></table></div></div></section>`;
}

export function createIntegratedEditing({getProject,onChange,onError}){
  const project=()=>getProject();
  function commit(command,target,{syncRelations=false}={}){
    const wasFocused=document.activeElement===target;
    const sceneId=target.closest('[data-inline-scene]')?.dataset.inlineScene,field=target.dataset.sceneField,elementId=target.closest('[data-catalog-element]')?.dataset.catalogElement,elementField=target.dataset.elementField;
    const root=target.closest('.view'),catalogSearch=root?.querySelector('[data-catalog-search]')?.value;
    try{onChange(command,{preserveView:!syncRelations&&(field||elementField)?root?.id:null});target.removeAttribute('aria-invalid');onError('');
      if(catalogSearch){const input=root.querySelector('[data-catalog-search]');if(input){input.value=catalogSearch;input.dispatchEvent(new Event('input',{bubbles:true}))}}
      dropdown.refresh();
      const next=[...document.querySelectorAll('[data-inline-scene]')].find(s=>s.dataset.inlineScene===sceneId)?.querySelector(`[data-scene-field="${field}"]`)||[...document.querySelectorAll('[data-catalog-element]')].find(el=>el.dataset.catalogElement===elementId)?.querySelector(`[data-element-field="${elementField}"]`);
      if(wasFocused&&document.activeElement===document.body&&next)next.focus({preventScroll:true});return true;
    }catch(error){target.setAttribute('aria-invalid','true');onError(error.message);return false}
  }
  const dropdown=createSearchDropdown({getProject:project,
    onField(sceneId,field,value,input){const p=project(),scene=p.scenes.find(s=>s.id===sceneId);return scene&&commit(()=>editScene(p,scene.id,{[field]:value}),input,{syncRelations:true})},
    onToggle(sceneId,id,checked,input){const p=project(),scene=p.scenes.find(s=>s.id===sceneId),el=p.elements.find(e=>e.id===id);if(!scene||!el)return false;const refs=structuredClone(scene.elementRefs).filter(r=>r.elementId!==id);if(checked)refs.push({elementId:el.id,category:el.category,name:el.name,resolved:true,quantity:null,quantityOrigin:'absent'});return commit(()=>editScene(p,scene.id,{},refs),input)},
    onCreate(sceneId,category,name,input){const p=project(),scene=p.scenes.find(s=>s.id===sceneId);if(!scene)return false;return commit(()=>{const el=p.elements.find(el=>el.category===category&&el.name.toLocaleLowerCase()===name.toLocaleLowerCase())||editElement(p,null,{name,category,properties:{}});if(!scene.elementRefs.some(r=>r.elementId===el.id))editScene(p,scene.id,{},[...scene.elementRefs,{elementId:el.id,category:el.category,name:el.name,resolved:true,quantity:null,quantityOrigin:'absent'}])},input)}
  });
  const quickAdd=createBreakdownQuickAdd({getProject:project,onAdd(sceneId,value,input){return commit(()=>addBreakdownElement(project(),sceneId,value),input,{syncRelations:true})}});
  document.addEventListener('input',event=>{
    const t=event.target;
    if(t.matches('.scene-textarea'))fitSceneTextareas(t.parentElement);
    if(t.matches('[data-catalog-search]'))for(const row of t.closest('.inline-catalog').querySelectorAll('[data-catalog-element]'))row.hidden=![...row.querySelectorAll('input')].some(i=>i.value.toLocaleLowerCase().includes(t.value.toLocaleLowerCase()));
  });
  document.addEventListener('change',event=>{
    const t=event.target,p=project(),scene=p?.scenes.find(s=>s.id===t.closest('[data-inline-scene]')?.dataset.inlineScene);if(!p)return;
    if(t.dataset.sceneField&&scene){if(t.dataset.choiceField&&event.isTrusted)return;const key=t.dataset.sceneField;if(!Object.hasOwn(SCENE_FIELDS,key))return;try{if(t.value!==sceneEntryValue(scene,key)){const value=parseSceneEntry(key,t.value);commit(()=>editScene(p,scene.id,{[key]:value}),t,{syncRelations:SINGLE_SCENE_FIELDS.includes(key)});t.value=sceneEntryValue(p.scenes.find(s=>s.id===scene.id),key)}else{t.removeAttribute('aria-invalid');onError('')}}catch(error){t.setAttribute('aria-invalid','true');onError(error.message)}}
    if(t.hasAttribute('data-ref-quantity')&&scene){const refs=structuredClone(scene.elementRefs);refs[Number(t.dataset.refQuantity)].quantity=t.value===''?null:Number(t.value);commit(()=>editScene(p,scene.id,{},refs),t)}
    if(t.hasAttribute('data-ref-daily-quantity')&&scene){const refs=structuredClone(scene.elementRefs);refs[Number(t.dataset.refDailyQuantity)].useDailyQuantity=t.checked;commit(()=>editScene(p,scene.id,{},refs),t)}
    if(t.dataset.elementField){const el=p.elements.find(el=>el.id===t.closest('[data-catalog-element]')?.dataset.catalogElement);if(el&&el[t.dataset.elementField]!==t.value)commit(()=>editElement(p,el.id,{...el,[t.dataset.elementField]:t.value}),t)}
  });
  document.addEventListener('click',event=>{
    const clear=event.target.closest('[data-clear-scene-field]');if(clear){const p=project(),scene=p.scenes.find(s=>s.id===clear.closest('[data-inline-scene]').dataset.inlineScene);commit(()=>editScene(p,scene.id,{[clear.dataset.clearSceneField]:''}),clear,{syncRelations:true});dropdown.close(false);return}
    const button=event.target.closest('[data-ref-remove]');if(!button)return;const p=project(),scene=p.scenes.find(s=>s.id===button.closest('[data-inline-scene]').dataset.inlineScene),refs=structuredClone(scene.elementRefs);refs.splice(Number(button.dataset.refRemove),1);commit(()=>editScene(p,scene.id,{},refs),button);
  });
  return {reset:()=>{dropdown.close();quickAdd.reset()},hasDraft(){
    const p=project();if(!p)return false;
    if(document.querySelector('.view:not([hidden]) [aria-invalid="true"]'))return true;
    return [...document.querySelectorAll('.view:not([hidden]) [data-scene-field],.view:not([hidden]) [data-element-field]')].some(input=>{
      if(input.hasAttribute('data-choice-field')&&input.getAttribute('aria-expanded')==='true')return false;
      const scene=p.scenes.find(s=>s.id===input.closest('[data-inline-scene]')?.dataset.inlineScene);
      const element=p.elements.find(el=>el.id===input.closest('[data-catalog-element]')?.dataset.catalogElement);
      return Boolean(scene||element)&&(scene?sceneEntryValue(scene,input.dataset.sceneField):String(element?.[input.dataset.elementField]??''))!==input.value;
    })||[...document.querySelectorAll('#boardEditingControls [data-inline-banner] input')].some(input=>input.value.toLocaleLowerCase()!==input.defaultValue.toLocaleLowerCase());
  }};
}
