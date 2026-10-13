import {escapeHtml as e} from './dood-print.js';
import {createOverlay} from './overlay-service.js';
const defaultColumns=['INT','EXT','INT/EXT','T-L','FOTO','','','','','','','Other'];
const defaultRows=['Day','Night','Evening','Morning','Dusk','FOTO','T-L','OMISSIS','CUT','','','Other'];
const aliases={'i/e':'int/ext','int / ext':'int/ext','ie':'int/ext','d':'day','giorno':'day','n':'night','notte':'night','alba':'morning','tram':'evening','tramonto':'evening','imbrunire':'dusk'};
const normalize=value=>{const key=String(value??'').trim().toLocaleLowerCase();return aliases[key]||key};
export function colorIndex(labels,value){return Object.keys(labels).find(key=>labels[key]&&normalize(labels[key])===normalize(value))||Object.keys(labels).find(key=>normalize(labels[key])==='other')||'11'}
export function stripColorSettings(project){
  const original=project.colors||{},settings=structuredClone(original);
  settings.columns??=Object.fromEntries(defaultColumns.map((name,i)=>[String(i),name]));
  settings.rows??=Object.fromEntries(defaultRows.map((name,i)=>[String(i),name]));
  for(let i=0;i<12;i++){settings.columns[i]??='';settings.rows[i]??=''}
  settings.cells??={};settings.preferences??={};
  for(let row=0;row<12;row++)for(let col=0;col<12;col++)settings.cells[`${row}:${col}`]??={bg:row===1?'#264eb8':col===1?'#ffffa3':'#ffffff',fg:row===1?'#ffffff':'#263746'};
  if(!original.cells)for(const scene of project.scenes){const key=`${colorIndex(settings.rows,scene.dn)}:${colorIndex(settings.columns,scene.ie)}`;if(scene.mmsxColors)settings.cells[key]={...scene.mmsxColors}}
  settings.preferences.Selected??={bg:'#e3312e',fg:'#ffffff'};
  settings.preferences.DayStrip??={bg:'#333333',fg:'#ffffff'};settings.preferences.Banner??={bg:'#663301',fg:'#ffffff'};
  return settings;
}
export function resolveStripColors(project,scene){
  if(!project.colors?.combinationEditing&&scene.mmsxColors)return scene.mmsxColors;
  const settings=stripColorSettings(project),key=`${colorIndex(settings.rows,scene.dn)}:${colorIndex(settings.columns,scene.ie)}`;
  return settings.cells[key];
}
export function createStripColorEditor({getProject,onChange}){
  const overlay=createOverlay('stripColorsDialog',{className:'strip-colors-overlay'});let draft,key='0:0',channel='bg';
  function draw(){
    const rows=Object.keys(draft.rows),cols=Object.keys(draft.columns);
    overlay.open('Colori strip',`<form id="stripColorsForm"><p class="overlay-help">Scegli una combinazione INT/EXT e D/N, poi il colore dello sfondo o del testo.</p><div class="color-matrix-scroll"><table class="color-matrix"><thead><tr><th>DN / INT-EXT</th>${cols.map(col=>`<th><input data-color-column="${col}" aria-label="INT/EXT ${col}" value="${e(draft.columns[col])}" ${col==='11'?'readonly':''}></th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th><input data-color-row="${row}" aria-label="D/N ${row}" value="${e(draft.rows[row])}" ${row==='11'?'readonly':''}></th>${cols.map(col=>{const cell=draft.cells[`${row}:${col}`];return `<td><button type="button" data-color-cell="${row}:${col}" aria-pressed="${key===`${row}:${col}`}" aria-label="${e(draft.columns[col]||col)} / ${e(draft.rows[row]||row)}" style="background:${e(cell.bg)};color:${e(cell.fg)}">${Number(row)*12+Number(col)}</button></td>`}).join('')}</tr>`).join('')}</tbody></table></div><div class="color-edit-controls"><label><input type="radio" name="channel" value="bg" ${channel==='bg'?'checked':''}> Sfondo</label><label><input type="radio" name="channel" value="fg" ${channel==='fg'?'checked':''}> Testo</label><label>Colore personalizzato<input id="combinationColor" type="color" value="${draft.cells[key][channel]}"></label></div><div class="color-special-settings">${[['Selected','Selezione'],['DayStrip','Fine giornata'],['Banner','Banner']].map(([id,label])=>`<fieldset><legend>${label}</legend><label>${id==='Selected'?'Bordo e indicatore':'Sfondo'}<input type="color" data-preference-color="${id}" data-channel="bg" value="${e(draft.preferences[id].bg)}"></label>${id!=='Selected'?`<label>Testo<input type="color" data-preference-color="${id}" data-channel="fg" value="${e(draft.preferences[id].fg)}"></label>`:''}</fieldset>`).join('')}</div><p role="alert" data-overlay-error></p><div class="dialog-actions"><button type="button" data-overlay-cancel>Annulla</button><button type="submit">Salva colori</button></div></form>`);
    overlay.dialog.querySelector('[data-overlay-cancel]').onclick=()=>overlay.close();
    overlay.dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{onChange(()=>{const base=stripColorSettings(getProject()),overrides=new Set(base.overriddenPreferences||[]);for(const name of ['Banner','DayStrip'])if(['bg','fg'].some(channel=>draft.preferences[name][channel]!==base.preferences[name][channel]))overrides.add(name);getProject().colors={...draft,combinationEditing:true,overriddenPreferences:[...overrides]};for(const scene of getProject().scenes)delete scene.studioColors});overlay.close()}catch(error){overlay.dialog.querySelector('[data-overlay-error]').textContent=error.message}};
  }
  overlay.dialog.addEventListener('click',event=>{const cell=event.target.closest('[data-color-cell]');if(cell){key=cell.dataset.colorCell;for(const b of overlay.dialog.querySelectorAll('[data-color-cell]'))b.setAttribute('aria-pressed',String(b===cell));overlay.dialog.querySelector('#combinationColor').value=draft.cells[key][channel]}});
  overlay.dialog.addEventListener('input',event=>{
    const t=event.target;if(t.dataset.colorColumn!==undefined)draft.columns[t.dataset.colorColumn]=t.value;
    if(t.dataset.colorRow!==undefined)draft.rows[t.dataset.colorRow]=t.value;
    if(t.name==='channel'){channel=t.value;overlay.dialog.querySelector('#combinationColor').value=draft.cells[key][channel]}
    if(t.id==='combinationColor'){draft.cells[key][channel]=t.value;const b=[...overlay.dialog.querySelectorAll('[data-color-cell]')].find(b=>b.dataset.colorCell===key);b.style.background=draft.cells[key].bg;b.style.color=draft.cells[key].fg}
    if(t.dataset.preferenceColor)draft.preferences[t.dataset.preferenceColor][t.dataset.channel]=t.value;
  });
  return {open(){draft=stripColorSettings(getProject());key='0:0';channel='bg';draw()}};
}
