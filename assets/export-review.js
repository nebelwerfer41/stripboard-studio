const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

// Keep the adapter's concrete findings, with blockers and losses visible first.
export function exportReviewMarkup(report){
  const blocked=report.blockers.length>0,changes=report.transformed.length+report.omitted.length;
  const status=blocked?'Correggi gli impedimenti prima di esportare':changes?'Controlla le modifiche prima di esportare':'Pronto per l’esportazione';
  const groups=[['blockers','Impedimenti'],['transformed','Trasformati'],['omitted','Omessi'],['kept','Mantenuti']];
  return `<p class="export-review-status" data-export-state="${blocked?'blocked':changes?'review':'ready'}">${status}</p><p class="overlay-help">${escape(report.target.toUpperCase())} · ${report.mode==='native'?'Aggiornamento conservativo':'Ricostruzione dal progetto corrente'}</p>${groups.map(([key,label])=>`<section class="export-review-group" data-export-group="${key}"><h3>${label}: <small>${report[key].length?`${report[key].length} ${report[key].length===1?'voce':'voci'}`:'nessuno'}</small></h3>${report[key].length?`<ul>${report[key].map(item=>`<li><span class="export-item-count">${escape(item.count)}</span><span>${escape(item.detail)}</span></li>`).join('')}</ul>`:''}</section>`).join('')}`;
}
