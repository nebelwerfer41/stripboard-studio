import {createOverlay} from './overlay-service.js';
import {escapeHtml as e} from './dood-print.js';
import {snapshotDocument,createCalendar,editCalendarDetails} from './document-model.js';
import {SPECIAL_TYPES} from './calendar-commands.js';
import {assignPlanCalendar,reschedulePlan} from './workspace-commands.js';
import {validDate} from './production-data.js';
const days=[['Mon','Lunedì'],['Tue','Martedì'],['Wed','Mercoledì'],['Thu','Giovedì'],['Fri','Venerdì'],['Sat','Sabato'],['Sun','Domenica']];
const dates=[['ProductionPrepStartDate','Inizio preparazione'],['ProductionStartDate','Inizio riprese'],['ProductionEndDate','Fine riprese'],['ProductionWrapDate','Fine attività']];
const types={workday:'Giorno lavorativo',offday:'Riposo',holiday:'Festività',travel:'Viaggio produzione'};
export function createCalendarEditor({getContext,onChange,onCreated}){
  const overlay=createOverlay('calendarEditor',{className:'calendar-editor-overlay'});let draft,id;
  function drawExceptions(){overlay.dialog.querySelector('[data-calendar-exceptions]').innerHTML=draft.specialDays.map((s,index)=>({s,index})).sort((a,b)=>String(a.s.date||a.s.rawDate||'').localeCompare(String(b.s.date||b.s.rawDate||''))).map(({s,index})=>`<div class="exception-row"><span>${e(s.date||s.rawDate||'—')} · ${e(types[s.type]||types[Object.entries(SPECIAL_TYPES).find(([,key])=>s.attributes?.[key]==='1')?.[0]]||'Eccezione')}</span><button type="button" data-remove-exception="${index}" aria-label="Rimuovi eccezione ${e(s.date)}">×</button></div>`).join('')||'<p>Nessuna eccezione.</p>'}
  function show(calendarId){
    const {project,boardName,date}=getContext();id=calendarId;const board=project.boards.find(b=>b.name===boardName),base=snapshotDocument(project).calendars.find(c=>c.id===id);
    draft=base||{name:'Nuovo calendario',daysOff:Object.fromEntries(days.map(([key])=>[key,['Sat','Sun'].includes(key)?'1':'0'])),scheduleDates:{ProductionStartDate:{iso:project.calendars.find(c=>c.id===board.calendarId)?.scheduleDates.ProductionStartDate?.iso||date||null,origin:'edited'}},specialDays:[]};
    overlay.open(id?'Calendario del piano':'Nuovo calendario',`<form id="calendarEditForm"><div class="overlay-form-grid"><label class="span-all">Nome<input name="name" required value="${e(draft.name)}"></label>${dates.map(([key,label])=>`<label>${label}<input type="date" name="${key}" value="${e(draft.scheduleDates[key]?.iso||'')}"></label>`).join('')}</div><fieldset><legend>Riposi settimanali</legend><div class="calendar-week-rules">${days.map(([key,label])=>`<label><input type="checkbox" data-calendar-off="${key}" ${draft.daysOff[key]==='1'?'checked':''}>${label}</label>`).join('')}</div></fieldset><fieldset><legend>Eccezioni per data</legend><div class="calendar-exception-entry"><input type="date" id="calendarExceptionDate" aria-label="Data eccezione" value="${e(date||'')}"><select id="calendarExceptionType" aria-label="Tipo eccezione">${Object.entries(types).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select><button type="button" data-add-exception>Aggiungi / sostituisci</button></div><div data-calendar-exceptions></div></fieldset>${base?.options&&Object.keys(base.options).length?`<details><summary>Altre informazioni del calendario</summary><dl>${Object.entries(base.options).map(([key,value])=>`<dt>${e(key)}</dt><dd>${e(typeof value==='object'?JSON.stringify(value):value)}</dd>`).join('')}</dl></details>`:''}<p class="overlay-help">Le giornate dei piani collegati si aggiornano secondo queste regole. Eventi e disponibilità conservano le loro date.</p><p role="alert" data-overlay-error></p><div class="dialog-actions"><button type="button" data-calendar-cancel>Annulla</button><button type="submit">Salva calendario</button></div></form>`);
    drawExceptions();overlay.dialog.querySelector('[data-calendar-cancel]').onclick=()=>overlay.close();
    overlay.dialog.querySelector('form').onsubmit=event=>{
      event.preventDefault();const values=new FormData(event.target);
      try{
        let savedId;
        onChange(()=>{
          const p=getContext().project,old=p.calendars.find(c=>c.id===id),scheduleDates={...old?.scheduleDates};
          for(const [key] of dates)scheduleDates[key]={...scheduleDates[key],iso:values.get(key)||null,origin:'edited'};
          const c=old||createCalendar(p,{name:String(values.get('name')),scheduleDates,options:{}});
          if(old)editCalendarDetails(p,c.id,{name:String(values.get('name')),scheduleDates,options:c.options||{}});
          c.daysOff=Object.fromEntries(days.map(([key])=>[key,overlay.dialog.querySelector(`[data-calendar-off="${key}"]`).checked?'1':'0']));
          c.specialDays=draft.specialDays;
          if(!old){assignPlanCalendar(p,getContext().boardName,c.id)}
          else for(const b of p.boards.filter(b=>b.calendarId===c.id))reschedulePlan(p,b);savedId=c.id;
        });overlay.close();onCreated(savedId);
      }catch(error){overlay.dialog.querySelector('[data-overlay-error]').textContent=error.message}
    };
  }
  overlay.dialog.addEventListener('click',event=>{
    const remove=event.target.closest('[data-remove-exception]');if(remove){draft.specialDays.splice(Number(remove.dataset.removeException),1);drawExceptions()}
    if(event.target.closest('[data-add-exception]')){
      const date=overlay.dialog.querySelector('#calendarExceptionDate').value,type=overlay.dialog.querySelector('#calendarExceptionType').value;
      if(!validDate(date)){overlay.dialog.querySelector('[data-overlay-error]').textContent='Scegli una data valida';return}
      const existing=draft.specialDays.find(s=>s.date===date);draft.specialDays=draft.specialDays.filter(s=>s.date!==date);
      draft.specialDays.push({...existing,date,rawDate:existing?.rawDate||date,type,attributes:{...existing?.attributes,...Object.fromEntries(Object.values(SPECIAL_TYPES).map(key=>[key,key===SPECIAL_TYPES[type]?'1':'0']))}});draft.specialDays.sort((a,b)=>String(a.date).localeCompare(String(b.date)));drawExceptions();overlay.dialog.querySelector('[data-overlay-error]').textContent='';
    }
  });
  return {open:show};
}
