/* One event model and one editor, shared by Calendar and DOOD. Native opaque events remain inspectable. */
import {DOOD_EVENT_TYPES} from './dood-engine.js';
import {validDate} from './production-data.js';
import {escapeHtml as e} from './dood-print.js';
export function createEventManager({getContext,onChange}){
  const dialog=document.createElement('dialog');dialog.id='productionEventDialog';dialog.className='production-event-dialog';document.body.append(dialog);
  let context,editing=null;
  function draw(){
    const events=context.project.events.filter(ev=>ev.calendarId===context.calendar?.id&&(!ev.scope?.boardId||ev.scope.boardId===context.board.parentBoardId)&&(!ev.scope?.segmentId||ev.scope.segmentId===context.board.segmentId)),selected=events.find(ev=>ev.id===editing);
    dialog.innerHTML=`<div class="print-service-header"><h2>Eventi di produzione</h2><button type="button" data-close>Chiudi</button></div><p>${e(context.calendar?.name||'Nessun calendario')} · ${e(context.board.segmentName||context.board.name)}</p><div class="production-event-list">${events.map(ev=>`<div><strong>${e(ev.name||DOOD_EVENT_TYPES[ev.type]||'Evento')}</strong> · ${e(ev.type??'Tipo non verificato')} · ${e(ev.startDate)}–${e(ev.endDate)} ${ev.studio?`<button type="button" data-edit="${e(ev.id)}">Modifica</button><button type="button" data-delete="${e(ev.id)}">Elimina</button>`:'<small>Importato · sola lettura</small>'}</div>`).join('')||'Nessun evento.'}</div><form id="productionEventForm"><h3>${selected?'Modifica evento':'Nuovo evento'}</h3><label>Tipo <select name="type">${Object.entries(DOOD_EVENT_TYPES).map(([type,name])=>`<option value="${type}" ${selected?.type===type?'selected':''}>${name}</option>`).join('')}</select></label><label>Nome <input name="name" value="${e(selected?.name||'')}" maxlength="160"></label><label>Da <input type="date" name="startDate" required value="${e(selected?.startDate||context.date||'')}"></label><label>A <input type="date" name="endDate" required value="${e(selected?.endDate||context.date||'')}"></label><label data-targets>Elementi (⌘ / Ctrl per selezione multipla)<select name="targets" multiple size="7">${context.project.elements.map(el=>`<option value="${e(el.id)}" ${selected?.targets.some(t=>t.elementId===el.id)?'selected':''}>${e(el.category)} · ${e(el.boardId)} ${e(el.name)}</option>`).join('')}</select></label><label>Note <textarea name="note">${e(selected?.note||'')}</textarea></label><div class="dialog-actions"><button type="button" data-new>Nuovo</button><button type="submit" ${!context.calendar?'disabled':''}>Salva evento</button></div><p role="status"></p></form>`;
    const form=dialog.querySelector('form');
    const sync=()=>{form.querySelector('[data-targets]').hidden=['holiday','move'].includes(form.elements.type.value)};form.elements.type.onchange=sync;sync();
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-new]').onclick=()=>{editing=null;draw()};
    for(const button of dialog.querySelectorAll('[data-edit]'))button.onclick=()=>{editing=button.dataset.edit;draw()};
    for(const button of dialog.querySelectorAll('[data-delete]'))button.onclick=()=>{onChange(()=>{context.project.events=context.project.events.filter(ev=>ev.id!==button.dataset.delete)});editing=null;draw()};
    form.onsubmit=event=>{
      event.preventDefault();const type=form.elements.type.value,startDate=form.elements.startDate.value,endDate=form.elements.endDate.value;
      const company=['holiday','move'].includes(type),ids=[...form.elements.targets.selectedOptions].map(o=>o.value);
      if(!validDate(startDate)||!validDate(endDate)||endDate<startDate||!company&&!ids.length){form.querySelector('[role=status]').textContent='Inserisci un intervallo valido e almeno un elemento per gli eventi individuali.';return}
      const value={id:editing||`studio-event:${crypto.randomUUID()}`,studio:true,type,name:form.elements.name.value.trim(),note:form.elements.note.value,
        startDate,endDate,calendarId:context.calendar.id,studioBoardName:context.board.name,scope:{kind:'segment',boardId:context.board.parentBoardId,segmentId:context.board.segmentId},targets:company?[]:ids.map(id=>({kind:'element',elementId:id}))};
      onChange(()=>{context.project.events=context.project.events.filter(ev=>ev.id!==value.id);context.project.events.push(value)});editing=null;draw();
    };
  }
  return {open(){context=getContext();editing=null;draw();dialog.showModal()}};
}
