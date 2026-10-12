import {paginateDood} from './print-layout.js';
export const escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const dateLabel=iso=>iso?`${iso.slice(8)}/${iso.slice(5,7)}`:'—';
const weekday=iso=>new Date(iso+'T00:00:00Z').toLocaleDateString('it-IT',{weekday:'short',timeZone:'UTC'});
export function renderDoodPrint(report,settings,metadata={}){
  const layout=paginateDood(report,settings),e=escapeHtml;
  function identity(row){return `<td>${e(row.element.boardId)}</td><td class="element-name">${e(row.element.name)}</td><td>${row.totals.worked}</td><td>${row.totals.held}</td>`}
  const html=layout.pages.map(p=>{
    const rows=report.rows.slice(p.rowStart,p.rowEnd),dates=report.dates.slice(p.dateStart,p.dateEnd);
    let table='';
    if(p.kind==='summary'){
      table=`<table class="dood-print-table summary-table"><colgroup><col style="width:8%"><col style="width:36%">${Array(7).fill('<col style="width:8%">').join('')}</colgroup><thead><tr>${['ID','Elemento','Worked','Held','Travel','Fitting','Rehearsal','Start','Finish'].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td>${e(r.element.boardId)}</td><td class="element-name">${e(r.element.name)}</td>${['worked','held','travel','fitting','rehearsal'].map(k=>`<td>${r.totals[k]}</td>`).join('')}<td>${dateLabel(r.first)}</td><td>${dateLabel(r.last)}</td></tr>`).join('')}</tbody></table>`;
    }else{
      const idHeaders=p.identity?['ID','Elemento','Worked','Held'].map(t=>`<th rowspan="3">${t}</th>`).join(''):'';
      table=`<table class="dood-print-table" style="width:${(p.identity?layout.identityWidth:0)+dates.length*layout.dateWidth}mm"><colgroup>${p.identity?`<col style="width:${10*layout.density}mm"><col style="width:${layout.nameWidth}mm"><col span="2" style="width:${11*layout.density}mm">`:''}<col span="${Math.max(1,dates.length)}" style="width:${layout.dateWidth}mm"></colgroup>${p.headers?`<thead><tr>${idHeaders}${dates.map(d=>`<th>${dateLabel(d.date)}</th>`).join('')}</tr><tr>${dates.map(d=>`<th>${weekday(d.date)}</th>`).join('')}</tr><tr>${dates.map(d=>`<th>${e(d.shootingDays.join(', '))}</th>`).join('')}</tr></thead>`:''}<tbody>${rows.map((r,i)=>`<tr style="height:${p.rowHeights[i]}mm">${p.identity?identity(r):''}${r.cells.slice(p.dateStart,p.dateEnd).map(c=>`<td class="${c.calendar.working===false?'nonworking':''}">${e(c.codes.join(' '))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    return `<section class="print-page" data-page="${p.number}" data-kind="${p.kind}" data-date-start="${p.dateStart??''}" data-row-start="${p.rowStart}"><div class="print-content"><header class="print-page-header"><strong>${e(metadata.title||'Progetto')} · ${p.kind==='summary'?'DOOD Summary':'Day Out of Days'}</strong><span>${e(report.boardName)} · ${e(metadata.version||'')}</span></header>${table}<footer class="print-page-footer">${e(metadata.date||'')} · Pagina ${p.number} / ${p.total}${p.kind==='matrix'&&dates.length?` · ${dateLabel(dates[0].date)}–${dateLabel(dates.at(-1).date)}`:''}</footer></div></section>`;
  }).join('');
  return {layout,html};
}
