import {escapeHtml as e} from './dood-print.js';
import {sortCategoryElements} from './element-format.js';
import {sceneValueChoices,singleSceneValue} from './scene-values.js';
export function dropdownMarkup({identity='',field=null,category=null,value='',label=''}){
 return `<div class="scene-choice-control"><input ${identity} ${field?`data-choice-field="${e(field)}" ${category?`data-choice-category="${e(category)}"`:""}`:`data-choice-category="${e(category)}" data-category-search`} role="combobox" aria-label="${e(label)}" aria-autocomplete="list" aria-expanded="false" aria-controls="sceneChoiceDropdown" autocomplete="off" value="${e(value)}" placeholder="${field?'Scegli o cerca…':'Cerca o aggiungi elemento…'}"><button type="button" data-choice-clear aria-label="Svuota ${e(label)}" ${!field||!value?'hidden':''}>×</button><button type="button" data-choice-open aria-label="Apri ${e(label)}" tabindex="-1">▾</button></div>`;
}
export function createSearchDropdown({getProject,onField,onToggle,onCreate}){
 const popup=document.createElement('div');popup.id='sceneChoiceDropdown';popup.className='scene-choice-popup';popup.setAttribute('role','listbox');popup.hidden=true;document.body.append(popup);
 let context=null,query='',active=0,rows=[];
 const inputs=()=>[...document.querySelectorAll('[data-choice-field],[data-choice-category]')];
 const idFor=input=>input.closest('[data-inline-scene]')?.dataset.inlineScene||input.closest('[data-scene-choice-id]')?.dataset.sceneChoiceId;
 function reconnect(){if(!context)return null;const input=inputs().find(input=>idFor(input)===context.sceneId&&input.dataset.choiceField===context.field&&input.dataset.choiceCategory===context.category&&Boolean(input.name)===context.form);if(input&&input.closest('[hidden]'))return null;return input||null}
 function scene(){return getProject()?.scenes.find(s=>s.id===context?.sceneId)}
 function close(reset=true){
  const input=reconnect()||context?.input;if(input){input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');if(reset&&!context.form){input.value=context.field?singleSceneValue(getProject(),scene(),context.field).name:''}}
  popup.hidden=true;context=null;
 }
 function place(){
  const input=reconnect();if(!input||!input.isConnected){close(false);return}context.input=input;
  const r=input.closest('.scene-choice-control').getBoundingClientRect(),below=innerHeight-r.bottom-12,above=r.top-12,up=below<180&&above>below,space=Math.max(70,Math.min(320,up?above:below));
  const width=Math.min(innerWidth-16,Math.max(240,r.width));popup.style.width=`${width}px`;popup.style.left=`${Math.max(8,Math.min(innerWidth-width-8,r.left))}px`;popup.style.maxHeight=`${space}px`;
  popup.style.top=up?`${Math.max(8,r.top-4-Math.min(space,popup.scrollHeight))}px`:`${Math.min(innerHeight-space-8,r.bottom+4)}px`;
 }
 function draw(){
  if(!context)return;const p=getProject(),s=scene(),input=reconnect();if(!input||!p){close(false);return}
  const single=Boolean(context.field),selected=new Set(s?.elementRefs.map(r=>r.elementId)||[]),value=singleSceneValue(p,s,context.field).name;
  const options=single?sceneValueChoices(p,context.field):sortCategoryElements(p.elements.filter(el=>el.category===context.category),p.categorySettings.find(c=>c.name===context.category)?.attributes).map(el=>({id:el.id,name:el.name,label:el.boardId?`${el.boardId}. ${el.name}`:el.name}));
  const term=query.trim().toLocaleLowerCase(),filtered=options.filter(o=>`${o.name} ${o.label||''}`.toLocaleLowerCase().includes(term));
  rows=filtered.map(o=>({...o,kind:'option',selected:single?o.name===(context.form?input.value:value):selected.has(o.id)}));
  if(term&&!options.some(o=>o.name.toLocaleLowerCase()===term))rows.push({kind:'create',name:query.trim(),selected:false});
  if(active<0)active=Math.max(0,rows.findIndex(row=>row.selected));active=Math.max(0,Math.min(active,rows.length-1));popup.setAttribute('aria-multiselectable',String(!single));
  popup.innerHTML=`<div class="scene-choice-list">${rows.map((o,index)=>`<div id="sceneChoiceOption${index}" data-choice-index="${index}" role="option" aria-selected="${o.selected}" class="scene-choice-option ${o.selected?'chosen':''} ${index===active?'highlighted':''}">${o.kind==='create'?`<button type="button" tabindex="-1" class="scene-choice-add">＋ Aggiungi «${e(o.name)}»</button>`:single?`<button type="button" tabindex="-1">${e(o.name)}</button>`:`<label><input type="checkbox" tabindex="-1" data-ref-element="${e(o.id)}" aria-label="Associa ${e(o.name)}" ${o.selected?'checked':''}><span>${e(o.label||o.name)}</span></label>`}</div>`).join('')||'<p class="scene-choice-empty">Nessun elemento. Digita il nome per aggiungerlo.</p>'}</div>`;
  popup.hidden=false;input.setAttribute('aria-expanded','true');if(rows.length)input.setAttribute('aria-activedescendant',`sceneChoiceOption${active}`);else input.removeAttribute('aria-activedescendant');place();
 }
 function open(input,{filter=false}={}){if(context&&context.input!==input)close();context={input,sceneId:idFor(input),field:input.dataset.choiceField,category:input.dataset.choiceCategory,form:Boolean(input.name)};query=filter?input.value:'';active=-1;draw()}
 function choose(index,checked){
  const option=rows[index],input=reconnect();if(!option||!input)return;
  if(context.form){input.value=option.name;input.dispatchEvent(new Event('change',{bubbles:true}));close(false);input.focus();return}
  let ok;if(context.field)ok=onField(context.sceneId,context.field,option.name,input);
  else if(option.kind==='create')ok=onCreate(context.sceneId,context.category,option.name,input);
  else ok=onToggle(context.sceneId,option.id,checked??!option.selected,input);
  if(ok===false){draw();return}
  const next=reconnect();if(context.field){close(false);next?.focus({preventScroll:true});close(false)}else{if(option.kind==='create')query='';if(next){context.input=next;next.value=query;next.focus({preventScroll:true})}draw()}
 }
 document.addEventListener('focusin',event=>{const input=event.target;if(input.matches('[data-choice-field],[data-choice-category]')&&context?.input!==input)open(input)});
 document.addEventListener('input',event=>{if(event.target.matches('[data-choice-field],[data-choice-category]')){if(!context||context.input!==event.target)open(event.target,{filter:true});query=event.target.value;active=0;draw()}});
 document.addEventListener('pointerdown',event=>{
  if(popup.contains(event.target)){if(event.target.closest('[data-choice-index]'))event.preventDefault();return}
  const wrapper=event.target.closest('.scene-choice-control');if(!wrapper)close();else if(context&&wrapper!==context.input?.closest('.scene-choice-control'))close();
 });
 popup.addEventListener('click',event=>{const row=event.target.closest('[data-choice-index]');if(!row)return;const checkbox=event.target.matches('input[type=checkbox]')?event.target:null;choose(Number(row.dataset.choiceIndex),checkbox?.checked)});
 document.addEventListener('click',event=>{
  if(event.target.matches('[data-choice-field],[data-choice-category]')&&!context)open(event.target);
  const openButton=event.target.closest('[data-choice-open]');if(openButton){const input=openButton.parentElement.querySelector('input');if(context?.input===input){close();return}input.focus();if(!context)open(input)}
  const clear=event.target.closest('[data-choice-clear]');if(clear){const input=clear.parentElement.querySelector('input');const id=idFor(input);if(input.name){input.value='';input.dispatchEvent(new Event('change',{bubbles:true}))}else onField(id,input.dataset.choiceField,'',input);close(false)}
 });
 document.addEventListener('keydown',event=>{
  if(!event.target.matches('[data-choice-field],[data-choice-category]'))return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopImmediatePropagation();if(!context)open(event.target);else{active=(active+(event.key==='ArrowDown'?1:-1)+rows.length)%Math.max(1,rows.length);draw();popup.querySelector(`[data-choice-index="${active}"]`)?.scrollIntoView({block:'nearest'})}}
  if(event.key==='Enter'&&context){event.preventDefault();event.stopImmediatePropagation();choose(active)}
  if(event.key==='Escape'&&context){event.preventDefault();event.stopImmediatePropagation();close()}
  if(event.key==='Tab'&&context)close();
 });
 document.addEventListener('focusout',event=>{if(event.target.matches('[data-choice-field],[data-choice-category]'))queueMicrotask(()=>{if(context&&document.activeElement!==reconnect()&&!popup.contains(document.activeElement))close()})});
 window.addEventListener('resize',()=>{if(context)place()});document.addEventListener('scroll',()=>{if(context)place()},true);
 return {close,refresh(){if(context)draw()}};
}
