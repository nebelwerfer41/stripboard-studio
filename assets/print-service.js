import {createOverlay} from './overlay-service.js';
import {DEFAULT_PRINT_SETTINGS,paginateSchedule} from './print-layout.js';
import {renderDoodPrint,escapeHtml} from './dood-print.js';
export function createPrintService({getSource,getSettings,onSettings}){
  const dialog=createOverlay('studioPrintDialog',{className:'studio-print-dialog'}).dialog;
  dialog.innerHTML=`<div class="print-service-header"><h2>Anteprima di stampa</h2><button type="button" data-close>Chiudi</button></div><div class="print-service-controls">
  <label>Carta <select data-setting="paper"><option>A4</option><option>A3</option><option>Letter</option><option>Legal</option></select></label>
  <label>Orientamento <select data-setting="orientation"><option value="landscape">Orizzontale</option><option value="portrait">Verticale</option></select></label>
  <label>Margini (mm) <input data-setting="margin" type="number" min="0" max="40" step="1"></label>
  <label data-schedule>Scala <select data-setting="scaleMode"><option value="auto">Adatta alla larghezza</option><option value="manual">Manuale</option></select></label>
  <label>Scala pagina <input data-setting="scale" type="number" min="0.5" max="2" step="0.05"></label>
  <label data-schedule><input data-setting="includeHeader" type="checkbox"> Header di stampa</label>
  <label data-schedule><input data-setting="monochrome" type="checkbox"> Bianco e nero</label>
  <label data-dood><input data-setting="autoDensity" type="checkbox"> Densità automatica</label>
  <label data-dood>Densità <input data-setting="density" type="number" min="0.65" max="1.6" step="0.05"></label>
  <label data-dood>Date (mm) <input data-setting="dateWidth" type="number" min="6" max="30"></label>
  <label data-dood>Nomi (mm) <input data-setting="nameWidth" type="number" min="20" max="100"></label>
  <label data-dood>Righe (mm) <input data-setting="rowHeight" type="number" min="3" max="15" step="0.5"></label>
  <label data-dood>Font (pt) <input data-setting="fontSize" type="number" min="6" max="14"></label>
  <label data-dood><input data-setting="repeatHeaders" type="checkbox"> Ripeti intestazioni</label>
  <label data-dood><input data-setting="repeatIdentity" type="checkbox"> Ripeti ID / nomi / totali</label>
  <label data-dood>Summary <select data-setting="summary"><option value="after">In coda</option><option value="before">In testa</option><option value="none">Nessuno</option><option value="only">Solo Summary</option></select></label>
  <button type="button" data-print>Stampa / Salva PDF</button></div><p class="print-service-status" role="status"></p><iframe title="Pagine reali di stampa"></iframe>`;
  document.body.append(dialog);let source,settings,valid=false;
  const iframe=dialog.querySelector('iframe'),status=dialog.querySelector('[role=status]');
  function refresh(){
    try{
      source=getSource(settings);dialog.querySelector('[data-setting=scale]').disabled=source.kind==='schedule'&&settings.scaleMode==='auto';
      const result=source.kind==='dood'?renderDoodPrint(source.report,settings,source.metadata):renderSchedule(source,settings);
      const g=result.layout,s=g.settings;
      dialog.querySelector('[data-setting=scale]').value=source.kind==='schedule'&&settings.scaleMode==='auto'?Number(s.scale.toFixed(3)):settings.scale;
      const css=`@page{size:${g.width}mm ${g.height}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#e7eaed;font-family:Arial,sans-serif;color:#111}.print-page{position:relative;width:${g.width}mm;height:${g.height}mm;padding:${s.margin}mm;background:#fff;break-after:page;margin:10px auto;box-shadow:0 1px 7px #0003;overflow:hidden}.print-page:last-child{break-after:auto}.print-content{width:${g.contentWidth}mm;height:${g.contentHeight}mm;transform:scale(${s.scale});transform-origin:top left;position:relative;font-size:${g.fontSize||9}pt}.print-page-header{height:${g.headerHeight??10}mm;display:flex;flex-direction:column;gap:2mm;font-size:9pt}.print-page-header span{font-size:8pt}.print-page-footer{display:block!important;margin:0;position:absolute;bottom:0;height:${g.footerHeight||7}mm;font-size:7pt;padding-top:2mm}.dood-print-table{border-collapse:collapse;table-layout:fixed;font-size:inherit;line-height:1.1}.dood-print-table th,.dood-print-table td{border:.2mm solid #444;padding:.5mm;text-align:center;overflow-wrap:anywhere;white-space:normal;color:#111;vertical-align:middle}.dood-print-table th{font-weight:normal;height:5mm}.dood-print-table .element-name{text-align:left}.nonworking{background:#e4e4e4}.summary-table{width:100%}.summary-table tr{height:${g.rowHeight||5}mm}.schedule-print-item{position:relative;overflow:visible}.schedule-print-item{pointer-events:none;user-select:none}.schedule-print-item .strip-outer{cursor:default;transform-origin:top left;margin:0!important}.schedule-print-item .strip-layout{box-shadow:none!important;outline:0!important}.schedule-print-item .strip-outer::before{display:none!important}${source.monochrome?'.schedule-print-item .strip-layout{background:white!important;color:black!important}.schedule-print-item .strip-field,.schedule-print-item .red-flag-icon{color:black!important}.schedule-print-item .strip-field.line{background:black!important}':''}@media screen{.print-page{zoom:.65}}@media print{html,body{background:white}.print-page{margin:0;box-shadow:none;zoom:1;-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
      iframe.srcdoc=`<!doctype html><html lang="it"><head><meta charset="utf-8"><base href="${escapeHtml(document.baseURI)}">${source.kind==='schedule'?'<link rel="stylesheet" href="assets/style.css">':''}<style>${css}</style></head><body>${result.html}</body></html>`;
      iframe.dataset.pageCount=String(g.pages.length);status.textContent=`${g.pages.length} pagine · ${g.width} × ${g.height} mm${source.kind==='schedule'?` · Scala ${Math.round(s.scale*100)}%`:''}. Nel dialogo browser usa scala 100%, margini nessuno e disattiva intestazioni/piè di pagina del browser. Per PDF scegli “Salva come PDF”.`;
      valid=true;
    }catch(error){valid=false;status.textContent=error.message;iframe.srcdoc='';iframe.dataset.pageCount='0'}
    dialog.querySelector('[data-print]').disabled=!valid;
  }
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.querySelector('[data-print]').onclick=()=>{if(valid){iframe.contentWindow.focus();iframe.contentWindow.print()}};
  dialog.addEventListener('change',event=>{
    const input=event.target,key=input.dataset.setting;if(!key)return;
    settings={...settings,[key]:input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value};
    refresh();if(valid)onSettings(settings);
  });
  return {open(){source=getSource();settings={...DEFAULT_PRINT_SETTINGS,scaleMode:'auto',...getSettings()};
    for(const input of dialog.querySelectorAll('[data-setting]')){const value=settings[input.dataset.setting];if(input.type==='checkbox')input.checked=value;else input.value=value}
    for(const label of dialog.querySelectorAll('[data-dood]'))label.hidden=source.kind!=='dood';
    for(const label of dialog.querySelectorAll('[data-schedule]'))label.hidden=source.kind!=='schedule';
    refresh();dialog.showModal();}};
}
function renderSchedule(source,settings){
  const layout=paginateSchedule(source.items,settings),e=escapeHtml;
  const html=layout.pages.map(p=>`<section class="print-page" data-page="${p.number}" data-kind="schedule"><div class="print-content"><header class="print-page-header">${source.includeHeader?`<strong>${e(source.metadata.title)} · ${e(source.metadata.boardName)}</strong>`:''}</header>${p.items.map(item=>`<div class="schedule-print-item" style="height:${item.height}mm;width:${item.width*item.fit}mm"><div style="transform:scale(${item.fit});transform-origin:top left;width:${item.width}mm">${item.html}</div></div>`).join('')}<footer class="print-page-footer">${e(source.metadata.date)} · Pagina ${p.number} / ${p.total}</footer></div></section>`).join('');
  return {layout,html};
}
