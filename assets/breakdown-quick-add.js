import {escapeHtml as e} from './dood-print.js';
import {catalogCategories,catalogElements,builtinField,sceneUsesElement} from './element-management.js';
import {editCategory,editElement,editScene} from './document-model.js';

export function quickAddMarkup(){
  const control=(kind,label,placeholder)=>`<label class="inline-field"><span>${label}</span><div class="scene-choice-control"><input data-quick-add="${kind}" role="combobox" aria-label="${label}" aria-autocomplete="list" aria-expanded="false" aria-controls="breakdownQuickAddDropdown" autocomplete="off" placeholder="${placeholder}"><button type="button" data-quick-add-open aria-label="Apri ${label}" tabindex="-1">▾</button></div></label>`;
  return `<div class="breakdown-quick-add">${control('element','Aggiunta rapida','Cerca o aggiungi un elemento…')}<div data-quick-category hidden>${control('category','Categoria del nuovo elemento','Scegli o aggiungi una categoria…')}</div><button type="button" data-quick-add-cancel hidden>Annulla</button></div>`;
}

// The caller wraps category creation, element creation and association in one document command.
export function addBreakdownElement(project,sceneId,{name,category}){
  const scene=project.scenes.find(s=>s.id===sceneId);
  if(!scene)throw Error('Scena non trovata');
  name=name.trim();category=category.trim();
  if(!name||!category)throw Error('Nome e categoria obbligatori');
  const same=(a,b)=>a.toLocaleLowerCase()===b.toLocaleLowerCase();
  const known=catalogCategories(project).find(c=>same(c.name,category));category=known?.name||category;
  const field=builtinField(category);
  if(field){const existing=catalogElements(project).find(el=>builtinField(el.category)===field&&same(el.name,name));editScene(project,scene.id,{[field]:existing?.name||name});return}
  if(!project.categorySettings.some(c=>c.name===category))editCategory(project,null,{name:category});
  const element=project.elements.find(el=>el.category===category&&same(el.name,name))||editElement(project,null,{name,category});
  if(!sceneUsesElement(project,scene,element))editScene(project,scene.id,{},[...scene.elementRefs,{elementId:element.id,category:element.category,name:element.name,resolved:true,quantity:null,quantityOrigin:'absent'}]);
}

export function createBreakdownQuickAdd({getProject,onAdd}){
  const popup=document.createElement('div');popup.id='breakdownQuickAddDropdown';popup.className='scene-choice-popup';popup.setAttribute('role','listbox');popup.hidden=true;document.body.append(popup);
  let input=null,sceneId=null,draft='',rows=[],active=0,restoringFocus=false;
  const sceneRoot=()=>[...document.querySelectorAll('[data-inline-scene]')].find(el=>el.dataset.inlineScene===sceneId&&!el.closest('[hidden]'));
  function close(){if(input){input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant')}popup.hidden=true;input=null}
  function reset(){close();const root=sceneRoot();if(root){for(const el of root.querySelectorAll('[data-quick-add]'))el.value='';root.querySelector('[data-quick-category]').hidden=true;root.querySelector('[data-quick-add-cancel]').hidden=true;root.querySelector('[data-quick-add=element]').readOnly=false}draft='';sceneId=null}
  function place(){
    if(!input?.isConnected||input.closest('[hidden]')){reset();return}
    const r=input.parentElement.getBoundingClientRect(),below=innerHeight-r.bottom-12,above=r.top-12,up=below<180&&above>below,space=Math.max(70,Math.min(320,up?above:below)),width=Math.min(innerWidth-16,Math.max(260,r.width));
    popup.style.width=`${width}px`;popup.style.left=`${Math.max(8,Math.min(innerWidth-width-8,r.left))}px`;popup.style.maxHeight=`${space}px`;popup.style.top=up?`${Math.max(8,r.top-4-Math.min(space,popup.scrollHeight))}px`:`${Math.min(innerHeight-space-8,r.bottom+4)}px`;
  }
  function draw(){
    if(!input)return;const p=getProject(),term=input.value.trim().toLocaleLowerCase(),category=input.dataset.quickAdd==='category',scene=p.scenes.find(s=>s.id===sceneId),elements=catalogElements(p);
    const options=category?catalogCategories(p).map(c=>({name:c.name,label:`${c.name} (${elements.filter(el=>el.category===c.name).length})`,category:c.name})):elements.map(el=>({...el,label:`${el.boardId?`${el.boardId}. `:''}${el.name} · ${el.category}`,selected:sceneUsesElement(p,scene,el)}));
    rows=options.filter(o=>o.label.toLocaleLowerCase().includes(term));
    if(term&&!options.some(o=>o.name.toLocaleLowerCase()===term))rows.push({create:true,name:input.value.trim()});
    active=Math.max(0,Math.min(active,rows.length-1));
    popup.innerHTML=`<div class="scene-choice-list">${rows.map((row,i)=>`<div id="quickAddOption${i}" data-quick-index="${i}" role="option" aria-selected="${Boolean(row.selected)}" class="scene-choice-option ${row.selected?'chosen':''} ${i===active?'highlighted':''}"><button type="button" tabindex="-1" class="${row.create?'scene-choice-add':''}">${row.create?`＋ Aggiungi «${e(row.name)}»`:e(row.label)}${row.selected?' ✓':''}</button></div>`).join('')||'<p class="scene-choice-empty">Digita il nome per aggiungerlo.</p>'}</div>`;
    popup.hidden=false;input.setAttribute('aria-expanded','true');if(rows.length)input.setAttribute('aria-activedescendant',`quickAddOption${active}`);else input.removeAttribute('aria-activedescendant');place();
  }
  function open(target){
    const id=target.closest('[data-inline-scene]').dataset.inlineScene;if(sceneId&&id!==sceneId)reset();
    close();sceneId=id;input=target;active=0;draw();
  }
  function choose(index){
    const row=rows[index];if(!row||!input)return;
    const root=sceneRoot();if(!root){reset();return}
    if(input.dataset.quickAdd==='element'&&row.create){
      draft=row.name;input.value=draft;input.readOnly=true;close();root.querySelector('[data-quick-category]').hidden=false;root.querySelector('[data-quick-add-cancel]').hidden=false;root.querySelector('[data-quick-add=category]').focus();return;
    }
    const value=input.dataset.quickAdd==='category'?{name:draft,category:row.name}:row;
    if(!row.selected&&onAdd(sceneId,value,input)===false)return;
    reset();
    // Reconnect after the document command replaces the scene editor.
    const next=[...document.querySelectorAll('[data-inline-scene]')].find(el=>el.dataset.inlineScene===root.dataset.inlineScene&&!el.closest('[hidden]'))?.querySelector('[data-quick-add=element]');
    restoringFocus=true;next?.focus({preventScroll:true});restoringFocus=false;
  }
  document.addEventListener('focusin',event=>{if(!restoringFocus&&event.target.matches('[data-quick-add]'))open(event.target)});
  document.addEventListener('input',event=>{if(event.target.matches('[data-quick-add]')){if(input!==event.target)open(event.target);active=0;draw()}});
  document.addEventListener('pointerdown',event=>{if(popup.contains(event.target)){event.preventDefault();return}if(!event.target.closest('.breakdown-quick-add'))close()});
  popup.addEventListener('click',event=>{const row=event.target.closest('[data-quick-index]');if(row)choose(Number(row.dataset.quickIndex))});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-quick-add-open]');if(button){const target=button.parentElement.querySelector('input');if(input===target)close();else{target.focus();if(input!==target)open(target)}}
    if(event.target.closest('[data-quick-add-cancel]')){const target=sceneRoot()?.querySelector('[data-quick-add=element]');reset();target?.focus()}
    if(event.target.matches('[data-quick-add]')&&input!==event.target)open(event.target);
  });
  document.addEventListener('keydown',event=>{
    if(!event.target.matches('[data-quick-add]'))return;
    if(['ArrowDown','ArrowUp','Enter','Escape'].includes(event.key)){
      event.preventDefault();event.stopImmediatePropagation();
      if(event.key==='Escape'){reset();return}
      if(!input)open(event.target);
      if(event.key==='Enter')choose(active);
      else{active=(active+(event.key==='ArrowDown'?1:-1)+rows.length)%Math.max(1,rows.length);draw();popup.querySelector(`[data-quick-index="${active}"]`)?.scrollIntoView({block:'nearest'})}
    }
    if(event.key==='Tab')close();
  });
  document.addEventListener('focusout',event=>{if(event.target.matches('[data-quick-add]'))queueMicrotask(()=>{if(input&&document.activeElement!==input)close()})});
  window.addEventListener('resize',()=>{if(input)place()});document.addEventListener('scroll',()=>{if(input)place()},true);
  return {reset};
}
