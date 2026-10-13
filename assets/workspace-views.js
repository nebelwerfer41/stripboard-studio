import {STANDARD_PRESETS,presetFields,selectedFields,fieldsMarkup,fieldsPickerMarkup} from './strip-display.js';
import {redFlagsForStrip} from './production-data.js';
import {calendarPlanEntries,calendarDayContent,activeSceneContext,breakdownCategories,estimateMinutes} from './calendar-selectors.js';
import {findCalendar,calendarDate} from './production-data.js';
import {formatTime} from './entry-format.js';
import {boardGroups} from './board-segments.js';
export const CALENDAR_VISIBILITY={summaries:'Riepiloghi giornata',pages:'Pagine',times:'Tempi stimati',counts:'Conteggio scene',strips:'Strip scena',banners:'Banner',events:'Eventi',flags:'Red Flags',conflicts:'Conflitti',saturdays:'Sabato',sundays:'Domenica'};
const weekdays=[['Mon','Lun'],['Tue','Mar'],['Wed','Mer'],['Thu','Gio'],['Fri','Ven'],['Sat','Sab'],['Sun','Dom']];
const exceptionLabels={workday:'Giorno lavorativo',offday:'Off Day',holiday:'Holiday',travel:'Company Travel'};
export function calendarMarkup(project,state,{safe,shortDate,pages,specialLabel,sceneColors}){
  const c=findCalendar(project,state.calendar),options=state.calendarVisibility;
  if(!c)return '<p class="viewer-empty">Nessun calendario disponibile.</p>';
  const entries=calendarPlanEntries(project,state.board,state.visibleSegments,c.id),month=state.calendarMonth;
  const scopedBoard=boardGroups(project).find(b=>b.id===c.scope.boardId),scopedSegment=scopedBoard?.segments.find(s=>s.id===c.scope.segmentId);
  const plans=project.boards.filter(b=>b.parentBoardId===project.boards.find(b=>b.name===state.board)?.parentBoardId);
  const selected=state.calendarDate||`${month}-01`,cols=weekdays.filter(([key])=>key!=='Sat'||options.saturdays).filter(([key])=>key!=='Sun'||options.sundays);
  const sceneMap=new Map(project.scenes.map(s=>[s.bdsId,s]));
  const fieldKeys=state.calendarFields||presetFields(project,state.calendarExtended?'detailed':'compact',{calendar:true});
  const fields=selectedFields(project,fieldKeys),configured=fieldKeys.join(',')!=='scene,set,pages';
  function positionAttributes(entry,strip){
    return `data-strip-key="${safe(strip.sourceKey)}" data-board-name="${safe(entry.board.name)}" data-container="${safe(entry.container)}" data-group-index="${entry.groupIndex}" data-strip-index="${entry.group.strips.indexOf(strip)}" data-item-kind="${safe(strip.kind)}" data-plan-id="${safe(entry.board.id)}"`;
  }
  function stripMarkup(strip,entry){
    const selected=state.selectedStripIds.has(strip.sourceKey),active=state.activeStripId===strip.sourceKey;
    if(strip.kind==='banner'){
      if(!options.banners)return '';
      const prefs=project.colors?.preferences?.Banner,override=project.colors?.overriddenPreferences?.includes('Banner');
      return `<div class="calendar-strip-row"><input type="checkbox" data-calendar-selection="${safe(strip.sourceKey)}" aria-label="Seleziona banner ${safe(strip.text)}" ${selected?'checked':''} ${state.calendarMultiSelect?'':'hidden'}><button type="button" class="calendar-banner ${selected?'selected':''} ${active?'active':''}" ${positionAttributes(entry,strip)} aria-pressed="${selected}" aria-label="Banner ${safe(strip.text||'')}" style="background:${safe(override?prefs.bg:strip.style?.backgroundColor||prefs?.bg||'#663301')};color:${safe(override?prefs.fg:strip.style?.fontColor||prefs?.fg||'#fff')};${strip.style?.fontSizeEdited?`font-size:${Number(strip.style.fontSize)*.85}px;`:''}" title="${safe(strip.text)}">${safe(strip.text||'Banner')}</button></div>`;
    }
    if(strip.kind!=='scene'||!options.strips)return '';
    const s=sceneMap.get(strip.bdsId),colors=sceneColors(s||{})||{},flags=entry.group.date?redFlagsForStrip(project,strip.bdsId,entry.group.date):[];
    return `<div class="calendar-strip-row"><input type="checkbox" data-calendar-selection="${safe(strip.sourceKey)}" aria-label="Seleziona scena ${safe(s?.scene||strip.bdsId)}" ${selected?'checked':''} ${state.calendarMultiSelect?'':'hidden'}><button class="calendar-strip ${state.calendarExtended?'extended':''} ${configured?'configured-fields':''} ${selected?'selected':''} ${active?'active':''}" type="button" data-scene-strip="${safe(strip.sourceKey)}" ${positionAttributes(entry,strip)} style="background:${safe(colors.bg||'#fff')};color:${safe(colors.fg||'#263746')}" aria-pressed="${selected}" aria-label="Scena ${safe(s?.scene||strip.bdsId)}" title="${safe([s?.scene,s?.ie,s?.dn,s?.set,s?.location,`${pages(s?.pagesEighths)} pag.`,s?.synopsis].filter(Boolean).join(' · '))}">${fieldsMarkup(fields,s,{project,group:entry.group,safe,pages,shortDate,flags},{calendar:true})}</button></div>`;
  }
  const time=n=>n==null?'—':`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  function content(iso){
    const data=calendarDayContent(project,c.id,iso,entries);
    return data.days.map(entry=>`<div class="calendar-shooting-day" data-group-id="${safe(entry.group.id)}" data-board-name="${safe(entry.board.name)}" data-container="${safe(entry.container)}" data-group-index="${entry.groupIndex}" data-plan-id="${safe(entry.board.id)}">
      ${options.summaries||options.pages||options.times||options.counts?`<div class="calendar-summary">${options.summaries?`<b>G ${safe(entry.group.shootingDayNumber)}</b>`:''}${plans.length>1?` · ${safe(entry.segment.name)}`:''}${options.pages?` · ${pages(entry.summary.pagesEighths)} p.`:''}${options.times?` · ${time(entry.summary.minutes)}${entry.summary.timePartial&&entry.summary.minutes!=null?' parziale':''}`:''}${options.counts?` · ${entry.summary.sceneCount} scene`:''}${entry.summary.sceneCount===0?'<small>Giornata vuota</small>':''}</div>`:''}
      ${entry.group.strips.map(strip=>stripMarkup(strip,entry)).join('')}</div>`).join('')+
      (options.events?data.events.map(e=>`<div class="calendar-event" title="${safe(e.note)}">◈ ${safe(e.name)}${e.targets?.length?` · ${safe(e.targets.map(t=>t.element||t.kind).join(', '))}`:''}</div>`).join(''):'')+
      (options.flags?data.flags.map(f=>`<div class="calendar-flag" title="${safe(f.note)}">⚑ ${safe(f.name)} · ${safe(f.target.element|| (f.target.kind==='project'?'Generale':'Non risolto'))}</div>`).join(''):'')+
      (options.conflicts?data.conflicts.map(f=>`<div class="calendar-conflict">△ ${safe(f.message)}</div>`).join(''):'');
  }
  const [year,number]=month.split('-').map(Number),first=(new Date(Date.UTC(year,number-1,1)).getUTCDay()+6)%7,count=new Date(Date.UTC(year,number,0)).getUTCDate(),total=Math.ceil((first+count)/7)*7;
  let grid=cols.map(([,label])=>`<div class="operational-weekday">${label}</div>`).join('');
  for(let slot=0;slot<total;slot++){
    const key=weekdays[slot%7][0];if(!cols.some(([day])=>day===key))continue;
    const iso=new Date(Date.UTC(year,number-1,slot-first+1)).toISOString().slice(0,10),day=calendarDate(c,iso),inMonth=iso.slice(0,7)===month;
    grid+=`<div class="operational-cell ${!inMonth?'adjacent-month':''} ${day?.working===false?'nonworking':''} ${selected===iso?'selected':''}" data-calendar-cell="${iso}"><button type="button" class="civil-date" data-date="${iso}" aria-label="${safe(shortDate(iso))} · ${safe(specialLabel(day))}"><b>${Number(iso.slice(-2))}${inMonth?'':` ${new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT',{month:'short',timeZone:'UTC'})}`}</b><small class="agenda-weekday">${safe(new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT',{weekday:'short',timeZone:'UTC'}))}</small><span>${safe(specialLabel(day))}</span></button><div class="cell-content">${content(iso)}</div></div>`;
  }
  const undated=entries.filter(e=>e.group.kind==='ScheduleDay'&&!e.group.date||e.group.kind==='RemainingScheduledStrips'&&e.group.strips.length);
  return `<div class="calendar-toolbar"><div class="month-navigation"><button type="button" data-month-step="-1" aria-label="Mese precedente">‹</button><input id="calendarMonthInput" type="month" value="${safe(state.calendarMonthDraft??month)}" aria-label="Mese visualizzato"><button type="button" data-month-step="1" aria-label="Mese successivo">›</button></div><label>Vai alla data <input id="calendarGoDate" type="date" value="${safe(state.calendarGoDraft??selected)}"></label><button type="button" data-calendar-display>Visualizzazione calendario…</button><button type="button" id="calendarRulesToggle">Calendario…</button><button type="button" data-calendar-multi aria-pressed="${Boolean(state.calendarMultiSelect)}">Selezione multipla</button><button type="button" data-event-manager>Eventi…</button></div>
    ${!options.saturdays||!options.sundays?'<p class="calendar-note">Weekend nascosti dalla vista; giornate e regole rimangono nel piano. Il dettaglio della data resta accessibile con “Vai alla data”.</p>':''}
    <div class="calendar-operational-layout"><div class="calendar-grid-scroll ${state.calendarAgenda!==false?'agenda-mobile':''}"><button type="button" id="calendarAgendaToggle" class="calendar-agenda-toggle" aria-pressed="${state.calendarAgenda!==false}">${state.calendarAgenda!==false?'▦ Mostra mese':'≡ Mostra agenda'}</button><div class="operational-grid" style="--calendar-columns:${Math.max(1,cols.length)}">${grid}</div>
      <details class="calendar-selected-detail" ${state.calendarDetailOpen?'open':''}><summary>Dettaglio · ${safe(shortDate(selected))} · ${safe(specialLabel(calendarDate(c,selected)))}</summary><div class="selected-date-content">${content(selected)||'<p>Nessuna ripresa o evento in questa data.</p>'}</div></details>
      ${undated.length?`<details><summary>Programmate senza data · ${undated.length} gruppi</summary>${undated.map(e=>e.group.strips.map(s=>stripMarkup(s,e)).join('')).join('')}</details>`:''}
      </div></div>`;
}
export function breakdownMarkup(project,state,{safe,shortDate,pages,valueText,sceneOrder=project.scenes}){
  const {scene,occurrence}=activeSceneContext(project,state.board,state.activeSceneId,state.activeStripId);
  const index=sceneOrder.findIndex(s=>s.bdsId===scene?.bdsId);
  const head=`<header class="breakdown-header"><div><small>SPOGLIO</small><h3>${scene?`Scena ${safe(scene.scene||'senza numero')}`:'Seleziona una scena'}</h3></div><div class="breakdown-navigation"><button type="button" data-breakdown-step="-1" aria-label="Scena precedente" ${index<=0?'disabled':''}>‹</button><button type="button" data-breakdown-step="1" aria-label="Scena successiva" ${index<0||index>=sceneOrder.length-1?'disabled':''}>›</button><button type="button" id="closeBreakdown" aria-label="Torna al piano" title="Torna al piano">×</button></div></header><label class="breakdown-scene-picker" for="breakdownSceneSelect">Scena<select id="breakdownSceneSelect">${!scene?'<option value="">Seleziona una scena…</option>':''}${sceneOrder.map(s=>`<option value="${safe(s.bdsId)}" ${s.bdsId===scene?.bdsId?'selected':''}>${safe(s.scene||'—')} · ${safe(s.set||s.synopsis||'Senza set')}</option>`).join('')}</select></label>`;
  if(!scene)return head+'<p class="viewer-empty">Seleziona una strip nella Stripboard o in Calendar per consultare i campi e gli elementi della scena.</p>';
  const group=occurrence?.group,scheduled=occurrence?.container==='scheduledGroups'&&group?.kind==='ScheduleDay';
  const estimate=value=>{const n=estimateMinutes(value);return n==null?value:`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`};
  const fields=[['INT / EXT',scene.ie],['DAY / NIGHT',scene.dn],['Set',scene.set],['Location',scene.location],['Pagine',pages(scene.pagesEighths)],['Tempo stimato',estimate(scene.estimateTimeA)],['Tempo schermo',formatTime(scene.estimateTimeB,{screen:true})],['Script day',scene.scriptDay],['Unità',scene.unit],['Sequenza',scene.sequence],['Pagine script',scene.scriptPageNumbers],['Scheda',scene.sheetNumber],['Commenti',scene.comments]].filter(([,v])=>v!=null&&v!=='');
  const categories=breakdownCategories(project,scene,{hideEmpty:state.hideEmptyCategories});
  return head+`<div class="breakdown-context">${safe(occurrence?.board.name||'Nessuna occorrenza nel piano')} · ${scheduled?`G ${safe(group.shootingDayNumber)} · ${safe(shortDate(group.date))}`:occurrence?.container==='unscheduledGroups'?'Boneyard · non programmata':'Senza giornata'}${state.selectedStripIds.size>1?` · ${state.selectedStripIds.size} strip selezionate, mostra scena attiva`:''}</div><dl class="breakdown-fields">${fields.map(([k,v])=>`<div><dt>${safe(k)}</dt><dd>${safe(valueText(v))}</dd></div>`).join('')}</dl><p class="breakdown-synopsis">${safe(scene.synopsis||'Synopsis non disponibile')}</p><label class="breakdown-empty-toggle"><input id="hideEmptyCategories" type="checkbox" ${state.hideEmptyCategories?'checked':''}> Nascondi categorie vuote</label><div class="breakdown-categories">${categories.map(c=>`<section class="breakdown-category" data-category-id="${safe(c.id)}" style="--category-color:${safe(c.color||'#0c877c')}"><h4>${safe(c.name)} <small>${c.items.length}${c.unknown?' · non risolta':''}</small></h4>${c.items.length?c.items.map(ref=>`<div class="breakdown-element" ${!ref.resolved?'title="Riferimento non risolto"':''}><strong>${safe(ref.element?.boardId!=null&&String(ref.element.boardId)!==''?`${ref.element.boardId}. `:'')}${safe(ref.name||ref.elementId||'Elemento senza nome')}</strong></div>`).join(''):'<p>Nessun elemento</p>'}</section>`).join('')||'<p>Nessuna categoria disponibile.</p>'}</div>`;
}
