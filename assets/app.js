import {parseMmsx,serializeMmsx} from './mmsx-project.js';
const parseSchedule=(bytes,name)=>/\.studio\.json$/i.test(name)?parseStudio(bytes):/^(MMS2|MMSX)$/.test(new TextDecoder().decode(new Uint8Array(bytes,0,Math.min(4,bytes.byteLength))))?parseMmsx(bytes,name):parseMsd(bytes,name);
import {parseMsd} from './msd-parser.js';
import {serializeMsd} from './msd-writer.js';
import {moveBoardItems,dayBreakKey,snapshotBoardFamily,restoreBoardFamily,dragSummary} from './scheduling.js';
import {boardGroups,boardGroupForPlan,entriesForBoard} from './board-segments.js';
import {resetDocumentState,documentIsDirty,markDocumentEdited,beginDocumentSave,finishDocumentSave} from './document-state.js';
import {elementSumText,categoryElementsText,elementLabel,sortCategoryElements} from './element-format.js';
import {expandReportBoxes} from './report-layout.js';
import {redFlagsForStrip,redFlagsOnDate,calendarDate,outsideCalendarActivity,findCalendar,eventsOnDate,intervalContains,intervalOverlaps} from './production-data.js';
import {STRIP_GESTURE,selectStripState,clearStripState,movementIntent} from './strip-interaction.js';
import {moveCalendarItems,editCalendar,snapshotProduction,restoreProduction} from './calendar-commands.js';
import {canSplit} from './calendar-selectors.js';
import {calendarMarkup,breakdownMarkup,CALENDAR_VISIBILITY} from './workspace-views.js';
import {STANDARD_PRESETS,standardLayout,presetFields,selectedFields,fieldsMarkup,fieldsPickerMarkup} from './strip-display.js';
import {calculateDood,doodElements,sortDoodRows,doodSummaryCsv,effectiveDoodRules,DEFAULT_DOOD_RULES} from './dood-engine.js';
import {doodMarkup} from './dood-view.js';
import {ensureStudio,snapshotStudio,restoreStudio,setDoodRules,serializeStudio,parseStudio} from './studio-project.js';
import {createPrintService} from './print-service.js';
import {createCatalogEditor} from './catalog-editor.js';
import {redFlagMarkup,registeredFlagTypes,addElementFlags,deleteFlags,flagCsv} from './red-flag-workspace.js';
import {elementOptions} from './element-management.js';
import {createDocumentEditor} from './document-editor.js';
import {sceneEditingMarkup,elementCatalogMarkup,createIntegratedEditing,fitSceneTextareas} from './integrated-editing.js';
import {snapshotDocument,restoreDocument,refreshDocument,validateDocument,createPlan} from './document-model.js';
import {createOverlay,installOverlayDismissal} from './overlay-service.js';
import {createStripColorEditor,resolveStripColors} from './strip-colors.js';
import {createCalendarEditor} from './calendar-editor.js';
import {insertScene,insertBanner,insertEndOfDay,assignPlanCalendar,reschedulePlan,bulkElementIds,moveElementsToCategory,reorderCollection,duplicateStrips,deleteStrips,stripDeletionSummary} from './workspace-commands.js';
import {formatTime,formatPages,parseTime} from './entry-format.js';
import {createEventManager} from './production-events.js';
const $ = id => document.getElementById(id);
const SAMPLES={wonderful:'samples/Wonderful Life Demo.msd'};
const state = {project:null, mode:'board', board:null, calendar:null, calendarMonth:null, calendarDate:null,
  flagMonth:null,flagCalendar:'',flagCategory:'',flagElement:'',flagName:'',flagStart:'',flagEnd:'',flagSelectedId:null,
  layout:null,boardLayoutChoice:null,boardFields:null,calendarPreset:'compact',calendarFields:null,calendarStripMenuOpen:false,query:'', unscheduled:false,segmentVisibility:new Map(),showColors:true, hideBanners:false, hideDayBreaks:false,
  allReport:false, importedSource:null, printHeader:true,reportOptions:new Map(),
  revision:0,savedRevision:0,serializationState:'idle',moveIntent:null,orderHistory:[],redoHistory:[],
  activeSceneId:null,layoutChoice:'single',previewOpen:false,breakdownReturnMode:'board',splitRatio:55,hideEmptyCategories:true,calendarRulesOpen:false,calendarStartDrafts:new Map(),calendarGoDraft:null,calendarMonthDraft:null,calendarMenuOpen:false,calendarDetailOpen:false,calendarExtended:false,calendarAgenda:true,calendarVisibility:Object.fromEntries(Object.keys(CALENDAR_VISIBILITY).map(k=>[k,true])),
  boneyardVisible:false,calendarMultiSelect:false,dataQuery:'',dataSelectedElements:new Set(),dataSort:{key:'boardId',direction:1},selectedStripIds:new Set(),selectionAnchorId:null,activeStripId:null,draggedStripIds:new Set(),touchMultiSelect:false};
const freshDoodUI=()=>({category:'',ruleElement:'',sort:[{key:'id',direction:'asc'}],hideUnused:false,hideOff:false,compact:true,selected:null,rulesOpen:false,goDate:null});
state.dood=freshDoodUI();
const freshFlags=()=>({category:null,elements:new Set(),dates:new Set(),selected:new Set(),type:null,note:'',month:null,anchor:null,filter:'all',sort:{key:'start',direction:1}});state.flags=freshFlags();
const SCREEN_PX_PER_INCH=76;
const collator = new Intl.Collator('it',{numeric:true,sensitivity:'base'});
const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : 'Senza data';
const shortDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'}) : '—';
const pages = n => n == null ? '—' : (Math.floor(n/8) ? `${Math.floor(n/8)}${n%8 ? ' '+n%8+'/8' : ''}` : `${n}/8`);
const rect = s => (s.a.BoundingRect||'').split(',').map(Number);
const safe = v => String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const sceneIndex = () => new Map(state.project.scenes.map(s=>[s.bdsId,s]));
const selectedBoard = () => state.project.boards.find(b=>b.name===state.board) || state.project.boards[0];
const selectedBoardGroup = () => boardGroupForPlan(state.project,state.board);
function visibleSegmentIds(){
  const parent=selectedBoardGroup();
  if(!parent)return new Set();
  if(!state.segmentVisibility.has(parent.id))state.segmentVisibility.set(parent.id,new Set(parent.segments.filter(s=>s.type==='normal').map(s=>s.id)));
  return state.segmentVisibility.get(parent.id);
}
function displayedEntries(){
  const projected=displayedBoard();
  return entriesForBoard(state.project,state.board,new Set([...visibleSegmentIds(),...(state.mode==='board'&&state.boneyardVisible?selectedBoardGroup().segments.filter(s=>s.type==='boneyard').map(s=>s.id):[])])).map(entry=>entry.board.name===projected?.name&&entry.container==='scheduledGroups'?
    {...entry,board:projected,group:projected.scheduledGroups[entry.groupIndex]}:entry);
}
function syncSegmentControls(){
  const parent=selectedBoardGroup(),ids=visibleSegmentIds(),segments=(parent?.segments||[]).filter(s=>s.type==='normal');
  state.unscheduled=state.mode==='board'&&state.boneyardVisible;
  $('toggleUnscheduled').textContent=`Sub-board · ${segments.filter(s=>ids.has(s.id)).length}/${segments.length} ▾`;
  $('subboardMenu').innerHTML=segments.map(segment=>`<label><input type="checkbox" data-segment-id="${safe(segment.id)}" ${ids.has(segment.id)?'checked':''}><span>${safe(segment.name)}</span></label>`).join('');
  $('boneyardButton')?.setAttribute('aria-pressed',String(state.boneyardVisible));
}

function closeSegmentMenu(){$('subboardMenu').hidden=true;$('toggleUnscheduled').setAttribute('aria-expanded','false')}
const displayedBoard = () => selectedBoard();
const selectedProductionCalendar = () => findCalendar(state.project,state.calendar)||state.project.calendars[0];
function consultCalendar(id){
  if(id==='__new__'){calendarEditor.open(null);$('calendarSelect').value=state.calendar;return}
  if(id==='__reorder__'){openCollectionOrder('calendar');$('calendarSelect').value=state.calendar;return}
  if(id==='__edit__'){calendarEditor.open(state.calendar);$('calendarSelect').value=state.calendar;return}
  if(id===selectedBoard().calendarId)return;
  try{applyDocumentCommand(()=>assignPlanCalendar(state.project,state.board,id));state.calendar=id;
    state.calendarDate=selectedProductionCalendar()?.scheduleDates.ProductionStartDate?.iso||selectedBoard().scheduledGroups.find(g=>g.date)?.date||null;
    state.calendarMonth=state.calendarDate?.slice(0,7)||state.calendarMonth;render();
  }catch(error){showStatus(error.message);$('calendarSelect').value=selectedBoard().calendarId}
}
function selectableCalendars(){
  const yards=boardGroups(state.project).flatMap(parent=>parent.segments.filter(s=>s.type==='boneyard').map(s=>[parent.id,s.id]));
  return state.project.calendars.filter(c=>!yards.some(([board,segment])=>c.scope?.boardId===board&&c.scope?.segmentId===segment)||state.project.boards.some(b=>b.calendarId===c.id));
}
function calendarOptions(){return selectableCalendars().map(c=>`<option value="${safe(c.id)}">${safe(c.name)}</option>`).join('')+'<option disabled>──────────</option><option value="__new__">＋ Nuovo calendario…</option><option value="__edit__">Proprietà calendario…</option><option value="__reorder__">Riordina calendari…</option>'}

const selectedBoardLayout=()=>state.boardLayoutChoice?.startsWith('studio:')?standardLayout(state.boardLayoutChoice.slice(7)):state.project.stripLayouts.find(l=>l.name===state.boardLayoutChoice)||state.project.stripLayouts[0];
const selectedLayout = () => state.mode==='board'?selectedBoardLayout():state.project.reportLayouts.find(l=>l.name===state.layout);
function syncBoardDisplay({force=false}={}){
  const layout=selectedBoardLayout();
  if(state.mode==='board'||force){
    $('layoutSelect').innerHTML=`<optgroup label="Layout standard">${Object.entries(STANDARD_PRESETS).map(([id,p])=>`<option value="studio:${id}">Standard · ${p.label}</option>`).join('')}${state.boardLayoutChoice==='studio:custom'?'<option value="studio:custom">Standard · Personalizzato</option>':''}</optgroup><optgroup label="Layout del file">${state.project.stripLayouts.map(l=>`<option value="${safe(l.name)}">${safe(l.name)}</option>`).join('')}</optgroup>`;
    $('layoutSelect').value=layout.name;state.layout=layout.name;
  }
  $('boardFieldPicker').hidden=(!force&&state.mode!=='board')||!layout.standard;
  if(layout.standard)$('boardFieldPicker').innerHTML=fieldsPickerMarkup(state.project,state.boardFields||presetFields(state.project,layout.preset),{target:'board',safe});
}
const groups = b => [...(b?.scheduledGroups||[]),...(state.unscheduled?b?.unscheduledGroups||[]:[])];
const sceneList = b => groups(b).flatMap(g=>g.strips.filter(x=>x.kind==='scene').map(x=>state.sceneMap.get(x.bdsId)).filter(Boolean));
const searchText = (s,x) => [s?.scene,s?.set,s?.location,s?.synopsis,s?.scriptDay,x?.text].join(' ').toLocaleLowerCase();

function showStatus(message){$('status').textContent=message;$('status').hidden=!message;}
function isDirty(){return documentIsDirty(state)}
function updateDocumentStatus(){
  const saving=state.serializationState==='saving';
  if(state.project)$('saveButton').textContent=state.project.documentEditing||state.project.studio||state.project.studioContainer?'↓ Salva Studio':state.project.format==='mmsx'?'↓ Salva .mmsx':'↓ Salva .msd';
  $('dirtyIndicator').textContent=saving?'Salvataggio…':isDirty()?'Modifiche non salvate':'Salvato';
  $('dirtyIndicator').classList.toggle('dirty',isDirty());
  $('saveButton').disabled=saving||!state.project;
  $('undoMoveButton').disabled=!state.orderHistory.length;$('redoMoveButton').disabled=!state.redoHistory.length;
}
function rebuildDocumentIndexes(){
  refreshDocument(state.project);state.sceneMap=sceneIndex();state.elementMap=new Map(state.project.elements.map(e=>[`${e.category}\u0000${e.name}`,e]));state.elementIds=new Map(state.project.elements.map(e=>[`${e.category}\u0000${e.name}`,e.boardId]));state.categorySettings=new Map(state.project.categorySettings.map(c=>[c.name,c.attributes]));
  if(!state.project.boards.some(b=>b.name===state.board))state.board=state.project.activeBoard||state.project.boards[0].name;
  state.calendar=selectedBoard()?.calendarId||state.calendar;
  $('projectTitle').textContent=state.project.title;refreshBoardOptions();$('calendarCount').textContent=selectableCalendars().length;$('redFlagCount').textContent=state.project.redFlags.length;
  $('calendarSelect').innerHTML=calendarOptions();$('calendarSelect').value=state.calendar;
}
let preservedEditingView=null;
function applyDocumentCommand(command,{preserveView=null}={}){
  const before=snapshotDocument(state.project),selectedPlanId=selectedBoard()?.id;
  try{if(command()===false)return false;state.project.documentEditing=true;validateDocument(state.project);const current=state.project.boards.find(b=>b.id===selectedPlanId);if(current)state.board=current.name;rebuildDocumentIndexes();state.orderHistory.push({kind:'document',before});state.redoHistory=[];preservedEditingView=preserveView;edited();showStatus('');return true}
  catch(error){restoreDocument(state.project,before);rebuildDocumentIndexes();throw error}
  finally{preservedEditingView=null}
}
const documentEditor=createDocumentEditor({getContext:()=>({project:state.project,boardName:state.board}),onChange:applyDocumentCommand,onCreate:project=>{setProject(project);state.projectChoice='new';markDocumentEdited(state);updateDocumentStatus();setMode('data')},onRefresh:()=>render(),onSaved:(kind,record)=>{if(kind==='plan'&&record){state.board=record.name;state.calendar=record.calendarId;rebuildDocumentIndexes();clearStripSelection();setMode('board')}}});
$('newDocumentButton').addEventListener('click',()=>{if(isDirty()&&!window.confirm('Ci sono modifiche non salvate. Creare un nuovo progetto?'))return;document.querySelector('.project-heading').open=false;documentEditor.newDocument()});
const catalogEditor=createCatalogEditor({getContext:()=>({project:state.project,boardName:state.board}),onChange:applyDocumentCommand,onRefresh:()=>render(),onError:showStatus});
const integratedEditing=createIntegratedEditing({getProject:()=>state.project,onChange:applyDocumentCommand,onError:showStatus});
installOverlayDismissal();
const colorEditor=createStripColorEditor({getProject:()=>state.project,onChange:applyDocumentCommand});
const calendarEditor=createCalendarEditor({getContext:()=>({project:state.project,boardName:state.board,date:state.calendarDate}),onChange:applyDocumentCommand,onCreated:id=>{state.calendar=id;state.calendarDate=selectedProductionCalendar()?.scheduleDates.ProductionStartDate?.iso||state.calendarDate;state.calendarMonth=state.calendarDate?.slice(0,7)||state.calendarMonth;render()}});
const displayOverlay=createOverlay('displayDialog',{className:'display-settings-overlay'}),boardOptions=document.querySelector('#displayOptions .options-row');
const collectionOverlay=createOverlay('collectionOrderDialog');
const bulkOverlay=createOverlay('elementBulkDialog');
const deleteOverlay=createOverlay('stripDeleteDialog'),flagDeleteOverlay=createOverlay('flagDeleteDialog');
function confirmStripDeletion(){
  const boardName=state.board,keys=[...state.selectedStripIds],summary=stripDeletionSummary(state.project,boardName,keys);if(!keys.length)return;
  const scenes=state.project.scenes.filter(scene=>summary.sceneIds.includes(scene.bdsId));
  deleteOverlay.open('Elimina strip e schede di spoglio',`<form><p>${summary.sceneCount?`${summary.sceneCount===1?'Verrà eliminata':'Verranno eliminate'} <strong>${summary.sceneCount} ${summary.sceneCount===1?'scheda':'schede'} di spoglio</strong> e tutte le <strong>${summary.occurrenceCount} occorrenze</strong> da ${summary.planCount} ${summary.planCount===1?'piano':'piani'}, incluso il Boneyard.`:''}${summary.specialCount?` Verranno eliminate anche ${summary.specialCount} strip banner / fine giornata selezionate.`:''}</p>${scenes.length?`<ul>${scenes.map(scene=>`<li>Scena ${safe(scene.scene||'senza numero')} · Sheet ${safe(scene.sheetNumber)} · ${safe(scene.set||scene.synopsis||'')}</li>`).join('')}</ul>`:''}<p>Confermi l’eliminazione? Puoi recuperare i dati con Annulla nella barra principale.</p><p data-delete-error role="alert"></p><div class="dialog-actions"><button type="button" data-delete-cancel>Annulla</button><button type="submit" data-delete-confirm>Elimina da tutti i piani</button></div></form>`);
  deleteOverlay.dialog.querySelector('[data-delete-cancel]').onclick=()=>deleteOverlay.close();
  deleteOverlay.dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{applyDocumentCommand(()=>deleteStrips(state.project,boardName,keys));clearStripSelection();if(!state.sceneMap.has(state.activeSceneId))state.activeSceneId=state.project.scenes[0]?.id||null;deleteOverlay.close();render();showStatus('Schede e strip eliminate da tutti i piani. Annulla ripristina l’operazione.')}catch(error){deleteOverlay.dialog.querySelector('[data-delete-error]').textContent=error.message}};
}
function openDisplaySettings(target=state.mode){
  if(displayOverlay.dialog.contains(boardOptions))$('displayOptions').append(boardOptions);
  const calendar=target==='calendar',report=target==='report';
  displayOverlay.open(calendar?'Visualizzazione calendario':report?'Visualizzazione report':'Visualizzazione Stripboard',`<div class="display-targets"></div><div data-display-content></div>`);
  const host=displayOverlay.dialog.querySelector('[data-display-content]');
  if(calendar){
    host.innerHTML=`<fieldset><legend>Formato delle strip</legend><label>Layout<select id="calendarStripPreset">${Object.entries(STANDARD_PRESETS).map(([id,p])=>`<option value="${id}" ${state.calendarPreset===id?'selected':''}>${safe(p.label)}</option>`).join('')}${state.calendarPreset==='custom'?'<option value="custom" selected>Personalizzato</option>':''}</select></label>${fieldsPickerMarkup(state.project,state.calendarFields||presetFields(state.project,state.calendarPreset,{calendar:true}),{target:'calendar',safe})}</fieldset><fieldset><legend>Contenuti del calendario</legend><div class="calendar-visibility-options">${Object.entries(CALENDAR_VISIBILITY).map(([key,label])=>`<label><input type="checkbox" data-calendar-option="${key}" ${state.calendarVisibility[key]?'checked':''}>${label}</label>`).join('')}</div></fieldset>`;
  }else{
    host.append(boardOptions);$('layoutControl').hidden=false;$('reportOptions').hidden=!report;$('visibilityOptions').hidden=false;
    $('layoutSelect').dataset.displayTarget=report?'report':'board';$('layoutLabel').textContent=report?'MODELLO REPORT':'LAYOUT STRIPBOARD';
    if(!report)syncBoardDisplay({force:true});else $('boardFieldPicker').hidden=true;
  }
}
displayOverlay.dialog.addEventListener('click',event=>{const button=event.target.closest('button[data-display-target]');if(button)openDisplaySettings(button.dataset.displayTarget)});
displayOverlay.dialog.addEventListener('change',event=>{
  const t=event.target;if(t.id==='calendarStripPreset'){state.calendarPreset=t.value;state.calendarFields=presetFields(state.project,t.value,{calendar:true});state.calendarExtended=t.value!=='compact';render();openDisplaySettings('calendar')}
  if(t.dataset.calendarOption){state.calendarVisibility[t.dataset.calendarOption]=t.checked;render()}
});
displayOverlay.dialog.addEventListener('close',()=>{if(displayOverlay.dialog.contains(boardOptions))$('displayOptions').append(boardOptions)});
$('displaySettingsButton').addEventListener('click',()=>openDisplaySettings(state.mode==='report'?'report':'board'));$('stripColorsButton').addEventListener('click',()=>colorEditor.open());
function openCollectionOrder(kind){
  const list=kind==='calendar'?selectableCalendars():boardGroups(state.project),order=list.map(r=>r.id);
  function draw(){collectionOverlay.open(kind==='calendar'?'Riordina calendari':'Riordina piani',`<form><div class="collection-order-list">${order.map((id,index)=>`<div><strong>${safe(list.find(r=>r.id===id).name)}</strong><button type="button" data-order-up="${index}" aria-label="Sposta su" ${index===0?'disabled':''}>↑</button><button type="button" data-order-down="${index}" aria-label="Sposta giù" ${index===order.length-1?'disabled':''}>↓</button></div>`).join('')}</div><p data-overlay-error role="alert"></p><div class="dialog-actions"><button type="submit">Salva ordine</button></div></form>`);
    collectionOverlay.dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{applyDocumentCommand(()=>reorderCollection(state.project,kind,kind==='calendar'?[...order,...state.project.calendars.filter(c=>!order.includes(c.id)).map(c=>c.id)]:order));collectionOverlay.close()}catch(error){collectionOverlay.dialog.querySelector('[data-overlay-error]').textContent=error.message}};
    for(const button of collectionOverlay.dialog.querySelectorAll('[data-order-up],[data-order-down]'))button.onclick=()=>{const from=Number(button.dataset.orderUp??button.dataset.orderDown),to=from+(button.hasAttribute('data-order-up')?-1:1);[order[from],order[to]]=[order[to],order[from]];draw()};
  }draw();
}
function selectedElementIds(){return [...$('dataView').querySelectorAll('[data-catalog-element]')].filter(row=>state.dataSelectedElements.has(row.dataset.catalogElement)).map(row=>row.dataset.catalogElement)}
function openElementBulk(kind){
  const ids=selectedElementIds();if(!ids.length)return;
  bulkOverlay.open(kind==='ids'?'Assegna ID agli elementi selezionati':'Sposta gli elementi selezionati',`<form id="elementBulkForm"><p>${ids.length} elementi selezionati</p>${kind==='ids'?'<div class="overlay-form-grid"><label>ID iniziale<input type="number" name="start" min="0" step="1" value="1" required></label><label>Prefisso<input name="prefix" value=""></label></div>':`<label>Categoria di destinazione<select name="category">${state.project.categorySettings.map(c=>`<option value="${safe(c.name)}">${safe(c.name)}</option>`).join('')}</select></label>`}<p data-overlay-error role="alert"></p><div class="dialog-actions"><button type="submit">Applica</button></div></form>`);
  bulkOverlay.dialog.querySelector('form').onsubmit=event=>{event.preventDefault();const values=new FormData(event.target);try{applyDocumentCommand(()=>{if(kind==='ids')bulkElementIds(state.project,ids,{start:Number(values.get('start')),prefix:String(values.get('prefix'))});else moveElementsToCategory(state.project,ids,String(values.get('category')))});if(kind!=='ids'){state.dataCategory=String(values.get('category'));renderProductionViewer()}bulkOverlay.close()}catch(error){bulkOverlay.dialog.querySelector('[data-overlay-error]').textContent=error.message}};
}
function addSceneAtSelection(){
  try{let result;applyDocumentCommand(()=>{result=insertScene(state.project,{boardName:state.board,key:state.selectionAnchorId})});state.board=result.board.name;
    state.selectedStripIds=new Set([result.strip.sourceKey]);state.selectionAnchorId=state.activeStripId=result.strip.sourceKey;state.activeSceneId=result.scene.id;
    const mode=['board','calendar'].includes(state.mode)?state.mode:'board';state.previewOpen=true;state.layoutChoice=canSplit(innerWidth)?`${mode}-breakdown`:'single';
    if(canSplit(innerWidth))setMode(mode);else{state.breakdownReturnMode=mode;setMode('breakdown')}
    $('breakdownPreview').querySelector('[data-scene-field=scene]')?.focus();
  }catch(error){showStatus(error.message)}
}
function addBannerAtSelection(){
  try{let result;applyDocumentCommand(()=>{result=insertBanner(state.project,{boardName:state.board,key:state.selectionAnchorId})});state.board=result.board.name;
    state.previewOpen=false;if(state.layoutChoice.endsWith('-breakdown'))state.layoutChoice='single';if(!['board','calendar'].includes(state.mode))setMode('board');else render();selectItem(result.strip.sourceKey,{reason:'insert'});
    $('boardEditingControls').querySelector('[name=text]')?.focus();$('boardEditingControls').querySelector('[name=text]')?.select();
  }catch(error){showStatus(error.message)}
}
function addEndOfDay(){try{const changed=applyDocumentCommand(()=>insertEndOfDay(state.project,{boardName:state.board,key:state.selectionAnchorId}));if(!changed)showStatus('La strip selezionata chiude già una giornata.')}catch(error){showStatus(error.message)}}
document.addEventListener('click',event=>{
  if(event.target.closest('[data-duplicate-strips]'))try{let copies;applyDocumentCommand(()=>{copies=duplicateStrips(state.project,state.board,[...state.selectedStripIds]);if(!copies.length)return false});if(copies?.length){state.selectedStripIds=new Set(copies.map(s=>s.sourceKey));state.selectionAnchorId=state.activeStripId=copies[0].sourceKey;state.activeSceneId=copies.find(s=>s.kind==='scene')?.bdsId||state.activeSceneId;render()}}catch(error){showStatus(error.message)}
  if(event.target.closest('[data-delete-strips]'))confirmStripDeletion();
  if(event.target.closest('[data-insert-scene]'))addSceneAtSelection();
  if(event.target.closest('[data-insert-banner]'))addBannerAtSelection();
  if(event.target.closest('[data-insert-day]'))addEndOfDay();
  if(event.target.closest('#boneyardButton')){state.boneyardVisible=!state.boneyardVisible;render()}
  if(event.target.closest('[data-elements-ids]'))openElementBulk('ids');
  if(event.target.closest('[data-elements-move]'))openElementBulk('move');
  const sort=event.target.closest('[data-elements-sort]');if(sort){state.dataSort={key:sort.dataset.elementsSort,direction:state.dataSort.key===sort.dataset.elementsSort?-state.dataSort.direction:1};renderProductionViewer()}
  const order=event.target.closest('[data-elements-order]');if(order){const ids=[...$('dataView').querySelectorAll('[data-catalog-element]')].map(r=>r.dataset.catalogElement);try{applyDocumentCommand(()=>{const records=new Map(state.project.elements.map(e=>[e.id,e]));let index=0;state.project.elements=state.project.elements.map(el=>el.category===order.dataset.category?records.get(ids[index++]):el);ids.forEach((id,i)=>{records.get(id).sortOrder=i})})}catch(error){showStatus(error.message)}}
});
$('dataView').addEventListener('input',event=>{if(event.target.hasAttribute('data-catalog-search'))state.dataQuery=event.target.value});
$('dataView').addEventListener('change',event=>{
  const t=event.target;if(t.dataset.elementSelect){if(t.checked)state.dataSelectedElements.add(t.dataset.elementSelect);else state.dataSelectedElements.delete(t.dataset.elementSelect);renderProductionViewer()}
  if(t.hasAttribute('data-elements-select-all')){for(const row of [...$('dataView').querySelectorAll('[data-catalog-element]:not([hidden])')].filter(row=>!row.querySelector('[data-element-select]').disabled)){if(t.checked)state.dataSelectedElements.add(row.dataset.catalogElement);else state.dataSelectedElements.delete(row.dataset.catalogElement)}renderProductionViewer()}
});
$('calendarView').addEventListener('change',event=>{const key=event.target.dataset.calendarSelection;if(key&&event.target.checked!==state.selectedStripIds.has(key))selectItem(key,{toggle:true,reason:'calendar-checkbox'})});
$('boardView').addEventListener('dblclick',event=>{const outer=event.target.closest('.strip-outer[data-item-kind=scene]');if(!outer)return;const scene=stripAt(movePositionFrom(outer));if(scene){selectBreakdownScene(scene.bdsId);state.breakdownReturnMode='board';state.layoutChoice='single';state.previewOpen=true;setMode('breakdown')}});
$('calendarView').addEventListener('dblclick',event=>{
  const strip=event.target.closest('[data-strip-key]');if(!strip)return;const key=strip.dataset.stripKey;
  state.board=strip.dataset.boardName;state.layoutChoice='single';state.previewOpen=false;setMode('board');selectItem(key,{reason:'calendar-jump'});
  const outer=[...$('boardView').querySelectorAll('.strip-outer')].find(el=>itemKey(el)===key);outer?.scrollIntoView({block:'center',inline:'nearest'});outer?.focus({preventScroll:true});
});

function edited(){
  state.project.counts.events=state.project.events.length;
  state.project.counts.scheduleDays=state.project.boards.reduce((n,board)=>n+board.scheduledGroups.filter(group=>group.kind==='ScheduleDay').length,0);
  state.project.counts.unscheduledDays=state.project.boards.reduce((n,board)=>n+board.unscheduledGroups.filter(group=>group.kind==='UnscheduledDay').length,0);
  markDocumentEdited(state);updateDocumentStatus();render()}
function refreshBoardOptions(){
  const parents=boardGroups(state.project);
  $('boardSelect').innerHTML=parents.map(b=>`<option value="${safe(b.id)}">${safe(b.name)}</option>`).join('')+'<option disabled>──────────</option><option value="__new__">＋ Nuova stripboard…</option><option value="__edit__">Proprietà piano…</option><option value="__reorder__">Riordina piani…</option>';
  $('boardSelect').value=selectedBoardGroup()?.id;$('boardCount').textContent=parents.length;
  document.querySelector('label[for="boardSelect"]').textContent=state.project.format==='mmsx'?'BOARD':'PIANO DI LAVORAZIONE';
  $('projectSubtitle').textContent=`${state.project.fileName} · ${state.project.counts.scenes} scene · ${parents.length} ${state.project.format==='mmsx'?'board':'piani disponibili'}`;
}
async function loadSample(id){
  showStatus('');$('projectTitle').textContent='Caricamento…';
  try {const source=SAMPLES[id];if(!source)throw Error('Progetto non trovato');const response=await fetch(encodeURI(source));
    if(!response.ok)throw Error(response.status===404?'Campione non disponibile: importa un file .msd dal tuo computer.':'Impossibile leggere il file MSD di esempio');
    setProject(await parseMsd(await response.arrayBuffer(),source.split('/').at(-1)));state.projectChoice=id}
  catch(e){showStatus(e.message);$('projectTitle').textContent=state.project?.title||'Importa un progetto .msd'}
}
function setProject(data){
  documentEditor.reset();catalogEditor.reset();deleteOverlay.close();flagDeleteOverlay.close();state.flags=freshFlags();
  document.querySelector('.project-heading').open=false;
  resetDocumentState(state);
  const isMmsx=data.format==='mmsx';
  if(isMmsx||data.format==='studio')state.mode='board';
  for(const [id,key] of [['reportNav','reports'],['calendarNav','readCalendars'],['redFlagNav','readRedFlags'],['calendarNav','readCalendars']])$(id).disabled=!data.capabilities[key];
  $('saveButton').textContent=isMmsx?'↓ Salva .mmsx':'↓ Salva .msd';
  state.orderHistory=[];state.redoHistory=[];state.moveIntent=null;state.activeSceneId=null;state.calendarStartDrafts.clear();state.calendarGoDraft=null;state.calendarMonthDraft=null;state.layoutChoice='single';state.previewOpen=false;
  clearStripSelection();
  state.dood=freshDoodUI();state.project=data;state.sceneMap=sceneIndex();state.elementIds=new Map(data.elements.map(e=>[`${e.category}\u0000${e.name}`,e.boardId]));state.board=data.boards.some(b=>b.name===data.activeBoard)?data.activeBoard:data.boards[0]?.name;state.dataScene=null;state.dataCategory='';state.dataElement=null;
  state.boardLayoutChoice=null;state.boardFields=null;state.calendarPreset=state.calendarExtended?'detailed':'compact';state.calendarFields=presetFields(data,state.calendarPreset,{calendar:true});
  state.calendar=selectedBoard()?.calendarId||findCalendar(data,data.defaultCalendar)?.id||data.calendars[0]?.id;
  state.calendarMonth=selectedProductionCalendar()?.scheduleDates.ProductionStartDate?.iso?.slice(0,7)||new Date().toISOString().slice(0,7);
  state.calendarDate=selectedProductionCalendar()?.scheduleDates.ProductionStartDate?.iso||null;
  state.flagMonth=data.redFlags.map(f=>f.date).filter(Boolean).sort()[0]?.slice(0,7)||state.calendarMonth;
  Object.assign(state,{flagCalendar:'',flagCategory:'',flagElement:'',flagName:'',flagStart:'',flagEnd:'',flagSelectedId:null});
  state.elementMap=new Map(data.elements.map(e=>[`${e.category}\u0000${e.name}`,e]));
  state.categorySettings=new Map((data.categorySettings||[]).map(c=>[c.name,c.attributes]));state.reportOptions.clear();
  state.boneyardVisible=false;state.calendarMultiSelect=false;state.dataSelectedElements.clear();state.dataCategoryGroup='custom';state.dataQuery='';state.dataSort={key:'boardId',direction:1};state.unscheduled=false;state.segmentVisibility.clear();closeSegmentMenu();state.allReport=false;state.query='';$('search').value='';
  state.hideBanners=false;state.hideDayBreaks=false;$('hideBanners').checked=false;$('hideDayBreaks').checked=false;
  state.printHeader=selectedBoard()?.attributes?.HideStripBoardHeader!=='1';syncPrintOptions();
  $('projectTitle').textContent=data.title;
  refreshBoardOptions();$('reportCount').textContent=data.reportLayouts.length;
  $('calendarCount').textContent=selectableCalendars().length;$('redFlagCount').textContent=data.redFlags.length;
  $('calendarSelect').innerHTML=calendarOptions();$('calendarSelect').value=state.calendar;
  syncSegmentControls();
  showStatus('');updateDocumentStatus();setMode(state.mode);
}
function setMode(mode){
  closeSegmentMenu();
  if(mode==='report'&&!state.project?.capabilities.reports)mode='board';
  if(mode==='breakdown'&&['board','calendar'].includes(state.mode))state.breakdownReturnMode=state.mode;
  if(state.mode==='breakdown'&&mode!=='breakdown')state.previewOpen=state.layoutChoice.endsWith('-breakdown');
  if(['board','calendar'].includes(mode)&&!canSplit(window.innerWidth)){
    state.previewOpen=false;
    if(state.layoutChoice.endsWith('-breakdown'))state.layoutChoice='single';
  }
  state.mode=mode;
  document.body.dataset.view=mode;
  if(['board','calendar'].includes(mode)&&state.layoutChoice.endsWith('-breakdown'))state.layoutChoice=`${mode}-breakdown`;
  for(const [id,key] of [['boardNav','board'],['calendarNav','calendar'],['breakdownNav','breakdown'],['reportNav','report'],['redFlagNav','redflags'],['dataNav','data'],['doodNav','dood']]){
    $(id).classList.toggle('active',mode===key);
    if(mode===key)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');
  }
  delete $('layoutSelect').dataset.displayTarget;
  $('layoutLabel').textContent=mode==='board'?'LAYOUT STRIPBOARD':'MODELLO REPORT';
  $('sectionKicker').textContent={board:'PIANO DI LAVORAZIONE',report:'ANTEPRIMA REPORT',calendar:'CALENDAR',breakdown:'SPOGLIO',redflags:'RED FLAG ENTRY',data:'DETTAGLI PROGETTO ED ELEMENTI',dood:'DAY OUT OF DAYS'}[mode];
  $('search').placeholder=mode==='dood'?'Cerca elemento o ID…':mode==='board'?'Cerca scena, set, testo…':'Cerca nei dati del report…';
  $('toggleUnscheduled').style.display=mode==='board'||mode==='calendar'?'':'none';
  $('reportOptions').hidden=mode!=='report';
  $('visibilityOptions').hidden=mode!=='board'&&mode!=='report';
  $('displayOptions').hidden=true;
  $('displayOptions').open=false;
  $('boardFieldPicker').hidden=mode!=='board';
  $('boardControl').hidden=mode==='redflags'||mode==='data'||mode==='breakdown';
  $('layoutControl').hidden=mode==='calendar'||mode==='redflags'||mode==='data'||mode==='breakdown'||mode==='dood';
  $('calendarControl').hidden=mode!=='board'&&mode!=='calendar';
  $('panelTools').hidden=mode==='redflags'||mode==='data'||mode==='breakdown';$('search').hidden=mode==='calendar';
  $('stats').hidden=mode==='calendar'||mode==='redflags'||mode==='data'||mode==='breakdown'||mode==='dood';
  $('controls').classList.toggle('minimal',mode==='redflags');
  const layouts=mode==='board'?state.project?.stripLayouts:state.project?.reportLayouts;
  if(mode==='calendar'||mode==='redflags'||mode==='data'||mode==='breakdown'||mode==='dood'){render();return}
  if(!layouts)return;
  if(mode==='board'){
    state.boardLayoutChoice??=(layouts.find(l=>l.orientation==='HORIZONTAL'&&l.name.startsWith('*Schedule'))||layouts.find(l=>l.orientation==='HORIZONTAL')||layouts[0])?.name;
    syncBoardDisplay();render();return;
  }
  if(!layouts.some(l=>l.name===state.layout)){
    const preferred=mode==='board'?layouts.find(l=>l.orientation==='HORIZONTAL' && l.name.startsWith('*Schedule'))||layouts.find(l=>l.orientation==='HORIZONTAL'):layouts.find(l=>l.name==='Flash Suite Export')||layouts.find(l=>l.sourceType==='STRIP_BOARD'&&l.recordType==='STRIP')||layouts[0];
    state.layout=preferred?.name;
  }
  $('layoutSelect').innerHTML=layouts.map(l=>`<option value="${safe(l.name)}">${safe(l.name)}</option>`).join('');$('layoutSelect').value=state.layout;
  render();
}
function render(){
  if(!state.project)return;
  document.documentElement.style.setProperty('--selection-color',state.project.colors?.preferences?.Selected?.bg||'#e3312e');
  const savedScroll=Object.fromEntries(['boardView','calendarView','breakdownPreview','doodView'].map(id=>[id,[$(id).scrollTop,$(id).scrollLeft]]));
  const primary=['board','calendar'].includes(state.mode),wide=canSplit(window.innerWidth);
  const split=primary&&wide&&state.layoutChoice!=='single';
  const breakdownVisible=state.mode==='breakdown'||primary&&state.previewOpen;
  const previewOnly=breakdownVisible&&!split;
  document.body.dataset.printView=previewOnly?'breakdown':state.mode;
  document.querySelector('.page').classList.toggle('breakdown-focus',previewOnly);
  const boardVisible=!previewOnly&&(state.mode==='board'||split&&state.layoutChoice==='calendar-board');
  const calendarVisible=!previewOnly&&(state.mode==='calendar'||split&&state.layoutChoice==='calendar-board');
  for(const [id,visible] of [['boardView',boardVisible],['calendarView',calendarVisible],['breakdownPreview',breakdownVisible],['doodView',state.mode==='dood'],['reportView',state.mode==='report'],['redFlagView',state.mode==='redflags'],['dataView',state.mode==='data']])$(id).hidden=!visible;
  $('workspaceToolbar').hidden=!wide||(!primary&&state.mode!=='breakdown');
  $('workspaceLayout').disabled=!wide;$('workspaceLayout').value=state.layoutChoice;
  $('workspaceLayoutControl').hidden=!wide;
  $('previewButton').hidden=true;
  $('boardEditingControls').hidden=!primary;
  $('stripColorsButton').hidden=!primary;
  $('displaySettingsButton').hidden=!boardVisible&&state.mode!=='report';$('displaySettingsButton').textContent=state.mode==='report'?'Visualizzazione report…':'Visualizzazione Stripboard…';
  $('workspaceSplitter').hidden=!split;
  $('workspaceViews').classList.toggle('split',split);
  $('workspaceViews').classList.toggle('calendar-first',split&&state.layoutChoice==='calendar-board');
  $('workspaceViews').classList.toggle('preview-only',previewOnly);
  $('workspaceViews').style.setProperty('--split-ratio',String(state.splitRatio/100));
  $('previewButton').setAttribute('aria-expanded',String(breakdownVisible));
  $('previewButton').textContent=previewOnly?`← Torna a ${state.mode==='calendar'?'Calendar':'Stripboard'}`:breakdownVisible?'Chiudi Spoglio':'Anteprima Spoglio';
  for(const [id,key] of [['boardNav','board'],['calendarNav','calendar'],['breakdownNav','breakdown']]){
    const active=key==='breakdown'?previewOnly:state.mode===key&&!previewOnly;
    $(id).classList.toggle('active',active);
    if(active)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');
  }
  if(breakdownVisible)renderBreakdown();
  $('undoMoveButton').disabled=!state.orderHistory.length;$('redoMoveButton').disabled=!state.redoHistory.length;
  if(state.mode==='breakdown'){$('viewTitle').textContent='Spoglio';$('viewSubtitle').textContent='Scheda scena e fabbisogni di produzione';return}
  if(state.mode==='data'){$('viewTitle').textContent='Dettagli progetto ed elementi';$('viewSubtitle').textContent='Dati di produzione, schede ed elementi modificabili';if(preservedEditingView!=='dataView')renderProductionViewer();return}
  if(state.mode==='redflags'){$('viewTitle').textContent='Red Flag Entry';$('viewSubtitle').textContent='Date, elementi e vincoli di produzione';renderRedFlagViewer();return}
  if(state.mode==='dood'){$('viewTitle').textContent='Day Out of Days';$('viewSubtitle').textContent='Presenze derivate dal piano · regole della Sub-board';renderDood();return}
  if(calendarVisible)renderCalendarViewer();
  if(boardVisible){
    renderBoard(displayedBoard(),selectedBoardLayout());
  }
  if(primary)renderBoardEditingTools();
  for(const [id,[top,left]] of Object.entries(savedScroll)){$(id).scrollTop=top;$(id).scrollLeft=left}
  if(state.mode==='calendar'){$('viewTitle').textContent='Calendar';$('viewSubtitle').textContent='Piano, date e regole di produzione · scene e banner in ordine';return}
  const board=state.mode==='board'?displayedBoard():selectedBoard(),layout=selectedLayout();if(!board||!layout)return;
  $('viewTitle').textContent=state.mode==='board'?selectedBoardGroup()?.name||board.name:layout.name;
  $('viewSubtitle').textContent=state.mode==='board'?`${selectedBoardGroup().segments.filter(s=>s.type==='normal'&&visibleSegmentIds().has(s.id)).map(s=>s.name).join(', ')||'Nessuna sub-board'}`:`${layout.sourceType==='BY_CATEGORY'?'Per categoria':'Da stripboard'} · ${layout.recordType==='SCHEDULE_DAY'?'per giornata':'per scena'}`;
  $('viewSubtitle').title=$('viewSubtitle').textContent;
  renderStats(board);
  if(state.mode==='report')renderReport(board,layout);
}
function renderBreakdown(){
  if(preservedEditingView==='breakdownPreview'){
    const scene=state.project.scenes.find(s=>s.id===state.activeSceneId),heading=$('breakdownPreview').querySelector('h3'),option=$('breakdownSceneSelect')?.selectedOptions[0];
    if(heading&&scene)heading.textContent=`Scena ${scene.scene}`;
    if(option&&scene)option.textContent=`${scene.scene} · ${scene.set||scene.synopsis||'Senza set'}`;
    return;
  }
  $('breakdownPreview').innerHTML=breakdownMarkup(state.project,state,{safe,shortDate,pages,valueText,sceneOrder:breakdownSceneOrder()});
  const scene=state.project.scenes.find(s=>s.id===state.activeSceneId);
  if(scene){const view=$('breakdownPreview');for(const el of view.querySelectorAll('.breakdown-fields,.breakdown-synopsis,.breakdown-empty-toggle,.breakdown-categories'))el.remove();view.insertAdjacentHTML('beforeend',sceneEditingMarkup(state.project,scene,state));}
  $('breakdownPreview').insertAdjacentHTML('beforeend','<div class="inline-category-tools"><button type="button" data-inline-new="scene">＋ Nuova scena</button></div><div data-editor-host></div>');
  fitSceneTextareas($('breakdownPreview'));
}
function renderBoardEditingTools(){
  const toolbar=$('boardEditingControls');if(preservedEditingView==='banner')return;
  const key=state.selectedStripIds.has(state.selectionAnchorId)?state.selectionAnchorId:state.activeStripId;
  const strip=entriesForBoard(state.project,state.board).flatMap(e=>e.group.strips).find(s=>s.sourceKey===key),banner=strip?.kind==='banner'?strip:null;
  toolbar.innerHTML=`<div class="view-editing-actions"><button type="button" data-insert-scene>＋ Scena</button><button type="button" data-insert-banner>＋ Banner</button><button type="button" data-insert-day>＋ Fine giornata</button><button type="button" data-duplicate-strips ${state.selectedStripIds.size?'':'disabled'}>Duplica</button><button type="button" data-delete-strips ${state.selectedStripIds.size?'':'disabled'}>Elimina</button><button type="button" id="boneyardButton" aria-pressed="${state.boneyardVisible}" ${state.mode==='calendar'?'hidden':''}>Boneyard</button></div>${banner?`<form data-inline-banner="${safe(banner.sourceKey)}"><label>Banner<input name="text" aria-label="Testo banner selezionato" required value="${safe(banner.text)}"></label><label>Font<input name="fontSize" type="number" min="7" max="72" step="any" aria-label="Dimensione font banner" value="${safe(banner.style?.fontSize||12)}"></label><label>Tempo<input name="estimateTimeA" aria-label="Tempo banner HH:MM" placeholder="HH:MM" value="${safe(formatTime(banner.estimateTimeA))}"></label><button type="submit">Applica</button></form>`:''}`;
}
document.addEventListener('submit',event=>{
  if(!event.target.matches('[data-inline-banner]'))return;event.preventDefault();
  const form=event.target,values=new FormData(form);
  try{applyDocumentCommand(()=>{const banner=displayedEntries().flatMap(e=>e.group.strips).find(s=>s.sourceKey===form.dataset.inlineBanner);if(!banner)throw Error('Banner non trovato');const text=String(values.get('text')).trim();if(!text)throw Error('Testo banner obbligatorio');const fontSize=Number(values.get('fontSize'));if(!Number.isFinite(fontSize)||fontSize<7||fontSize>72)throw Error('Dimensione font da 7 a 72');const estimateTimeA=parseTime(values.get('estimateTimeA'));if(banner.text===text&&banner.style?.fontSize===fontSize&&banner.estimateTimeA===estimateTimeA)return false;banner.text=text;banner.style={...banner.style,fontSize,fontSizeEdited:true};banner.estimateTimeA=estimateTimeA;},{preserveView:'banner'});for(const input of form.querySelectorAll('input'))input.defaultValue=input.value;showStatus('')}catch(error){showStatus(error.message)}
});
document.addEventListener('change',event=>{const form=event.target.closest('[data-inline-banner]');if(form)form.requestSubmit()});
function renderStats(board){
  const scheduled=state.mode==='board'?displayedEntries().filter(entry=>entry.container==='scheduledGroups').map(entry=>entry.group):board.scheduledGroups;
  const dated=scheduled.filter(g=>g.kind==='ScheduleDay');
  const used=scheduled.flatMap(g=>g.strips).filter(s=>s.kind==='scene').length;
  const vals=[['Giorni di riprese',dated.length],['Scene in piano',used],['Primo giorno',shortDate(dated.find(g=>g.date)?.date)],['Ultimo giorno',shortDate(dated.filter(g=>g.date).at(-1)?.date)]];
  $('stats').innerHTML=vals.map(([label,value])=>`<div class="stat"><span class="label">${label}</span><span class="value">${safe(value)}</span></div>`).join('');
}
function formatTemplate(t,ctx){
  return String(t||'').replace(/\{([^}]+)\}/g,(_,raw)=>{
    const key=raw.toLowerCase().replace(/[^a-z0-9]/g,'');
    const scene=ctx.scene||{};
    const sceneFields={set:'set',scenes:'scene',scene:'scene',synopsis:'synopsis',location:'location',ie:'ie',dn:'dn',scriptday:'scriptDay',sequence:'sequence',comments:'comments',unit:'unit',sheetnumber:'sheetNumber'};
    if(sceneFields[key])return scene[sceneFields[key]]||'';
    if(key==='numscriptpages'||key==='pages')return pages(ctx.dayPages??scene.pagesEighths);
    if(key==='shootingday'||key==='day')return ctx.group?.ordinal||'—';
    if(key==='shootingdate'||key==='date')return shortDate(ctx.group?.date);
    if(key==='stripboarddescription')return ctx.board?.description||ctx.board?.name||'';
    if(key==='picturetitle')return state.project.title;
    if(key==='scriptdated')return state.project.production.ScriptDated||'';
    if(key==='todaysdate')return new Date().toLocaleDateString('it-IT');
    return Object.entries(state.project.production).find(([name])=>name.toLowerCase().replace(/[^a-z0-9]/g,'')===key)?.[1]||'';
  });
}
function requirementNames(scene,categories,{day=false,forBoard=false}={}){
  if(!scene)return [];
  const rows=!categories?.length||categories.some(x=>/all remaining/i.test(x))?Object.entries(scene.requirements||{}):categories.map(c=>[c,scene.requirements?.[c]||[]]);
  return rows.flatMap(([category,names])=>names.filter(name=>{const options=elementOptions(state.elementMap.get(`${category}\u0000${name}`));return (!day||options.useDailyQuantity)&&(!forBoard||!options.excludeFromBoard)}));
}
function contextRequirements(ctx,categories){
  const forBoard=['board','calendar'].includes(state.mode);
  if(ctx.dayRecord&&ctx.group?.strips?.length)return [...new Set(ctx.group.strips.filter(x=>x.kind==='scene').flatMap(x=>requirementNames(state.sceneMap.get(x.bdsId),categories,{day:true,forBoard})))];
  return requirementNames(ctx.scene,categories,{forBoard});
}
function contextCategories(ctx){
  const categories=ctx.dayRecord&&ctx.group?.strips?.length?[...new Set(ctx.group.strips.filter(x=>x.kind==='scene').flatMap(x=>Object.keys(state.sceneMap.get(x.bdsId)?.requirements||{})))]:Object.keys(ctx.scene?.requirements||{});
  return categories.sort((a,b)=>(Number(state.categorySettings.get(a)?.SortOrder)||0)-(Number(state.categorySettings.get(b)?.SortOrder)||0));
}
function contextElements(ctx,category){
  const elements=contextRequirements(ctx,[category]).map(name=>state.elementMap.get(`${category}\u0000${name}`)||{category,name,boardId:''});
  return sortCategoryElements(['board','calendar'].includes(state.mode)?elements.filter(el=>!elementOptions(el).excludeFromBoard):elements,state.categorySettings.get(category));
}
function elementDays(element,board){
  if(!element||!board)return [];
  return board.scheduledGroups.filter(g=>g.kind==='ScheduleDay'&&g.strips.some(x=>{
    const s=state.sceneMap.get(x.bdsId);return (s?.requirements?.[element.category]||[]).includes(element.name);
  }));
}
function fieldValue(shape,ctx){
  const a=shape.a,s=ctx.scene,e=ctx.element,g=ctx.group,p=state.project.production;
  if(shape.tag==='StaticText')return formatTemplate(a.Text||'',ctx);
  if(shape.tag==='ProductionInfoField')return p[a.PropertyName]||'';
  if(shape.tag==='FunctionField')return a.Function==='PAGE_NUMBER'?'1':['CURRENT_DATE','RENDER_DATE'].includes(a.Function)?new Date().toLocaleDateString('it-IT'):'';
  if(shape.tag==='BDSCategoryElementsField'||shape.tag==='BDSCategoryElementsTableField'){
    const cats=a.CategorySource==='ALL_REMAINING'?contextCategories(ctx).filter(category=>!ctx.explicitCategories?.has(category)):
      shape.categories?.length?shape.categories:a.CategoryName?[a.CategoryName]:a.FieldName?[a.FieldName]:[];
    const table=shape.tag==='BDSCategoryElementsTableField';
    const sections=cats.map(category=>{
      const items=contextElements(ctx,category).filter(e=>!table||
        ((!a.LowBoardIDFilter||e.boardId&&collator.compare(e.boardId,a.LowBoardIDFilter)>=0)&&(!a.HighBoardIDFilter||e.boardId&&collator.compare(e.boardId,a.HighBoardIDFilter)<=0)))
        .map(e=>table?{text:e.boardId||e.name}:{text:elementLabel(e),id:e.boardId,name:e.name});
      return {heading:table?null:category,items};
    }).filter(section=>section.items.length);
    return {sections,columns:Number(a.NumColumns)||1,style:a.Style};
  }
  if(shape.tag==='BDSCategoryElementsOccurrenceCountField'){
    const cats=shape.categories?.length?shape.categories:a.CategoryName?[a.CategoryName]:[];
    return elementSumText({type:a.Type,text:a.Text,category:a.CategoryName,suppress:a.Suppress},contextRequirements(ctx,cats));
  }
  if(shape.tag==='BDSElementsIDListField'){
    const names=contextRequirements(ctx,[a.CategoryName]);
    return names.map(n=>state.elementIds.get(`${a.CategoryName}\u0000${n}`)||n).join(', ');
  }
  if(shape.tag==='BDSRedFlagField')return ctx.flags?.length?'⚑':'';
  if(shape.tag==='BDSByDayField'){
    const f=(a.FieldName||'').toUpperCase();
    const values=g?.strips.filter(x=>x.kind==='scene').map(x=>state.sceneMap.get(x.bdsId)).filter(Boolean)||[];
    const prop={SCENES:'scene',SET:'set',LOCATION:'location',IE:'ie',DN:'dn',SYNOPSIS:'synopsis'}[f];
    return prop?[...new Set(values.map(x=>x[prop]).filter(Boolean))].join(' · '):'';
  }
  if(shape.tag==='ByCatField'){
    const f=(a.FieldName||a.PropertyName||'').toUpperCase();
    const days=elementDays(e,selectedBoard());
    if(f==='BOARD ID')return e?.boardId||'';
    if(f==='TOTAL DAYS')return String(days.length);
    if(f==='START DATE')return shortDate(days[0]?.date);
    if(f==='FINISH DATE')return shortDate(days.at(-1)?.date);
    if(f.includes('SCENE'))return [...new Set(days.flatMap(d=>d.strips.map(x=>state.sceneMap.get(x.bdsId)).filter(s=>(s?.requirements?.[e?.category]||[]).includes(e?.name)).map(s=>s.scene)))].join(', ');
    if(f.includes('CATEG'))return e?.category||'';
    return e?.name||'';
  }
  if(shape.tag==='CustomListField'){
    const property=a.Property||'';
    const valueFor=element=>{
      if(/board id.*element name/i.test(property))return {text:elementLabel(element),id:element.boardId,name:element.name};
      if(/element name/i.test(property))return {text:element.name};
      if(/^board id$/i.test(property))return {text:element.boardId||''};
      return {text:element.properties?.[property]||''};
    };
    const items=(e?[e]:contextElements(ctx,a.Category)).map(valueFor).filter(item=>item.text);
    return {sections:[{items,heading:a.PrntCat==='1'?a.Category:null}],columns:Number(a.ColCnt)||1};
  }
  if(shape.tag==='BDSField'){
    const f=(a.FieldName||'').toUpperCase().replaceAll(' ','_');
    const map={SCENES:'scene',SCENE:'scene',SHEET_NUMBER:'sheetNumber',SYNOPSIS:'synopsis',SEQUENCE:'sequence',IE:'ie',DN:'dn',SET:'set',LOCATION:'location',SCRIPT_DAY:'scriptDay',SCRIPT_PAGES:'scriptPageNumbers',SCRIPT_PAGE_NUMBERS:'scriptPageNumbers',UNIT:'unit',ESTIMATE_TIME_A:'estimateTimeA',ESTIMATE_TIME_B:'estimateTimeB',COMMENTS:'comments'};
    if(f==='NUM_SCRIPT_PAGES'||f==='PAGES')return pages(s?.pagesEighths);
    if(f==='DATE')return shortDate(g?.date);
    return ['ESTIMATE_TIME_A','ESTIMATE_TIME_B'].includes(f)?formatTime(s?.[map[f]],{screen:f==='ESTIMATE_TIME_B'}):s?.[map[f]]||'';
  }
  return '';
}
function geometry(shapes,minimumWidth=0,minimumHeight=0){
  let minX=0,minY=0,maxX=minimumWidth,maxY=minimumHeight;
  const boxes=shapes.map(s=>({s,r:rect(s)})).filter(x=>x.r.length===4&&x.r.every(Number.isFinite));
  for(const {r} of boxes){minX=Math.min(minX,r[0]);minY=Math.min(minY,r[1]);maxX=Math.max(maxX,r[0]+r[2]);maxY=Math.max(maxY,r[1]+r[3]);}
  for(const s of shapes){
    if(s.tag!=='HorizontalLine'&&s.tag!=='VerticalLine')continue;
    const location=(s.a.Location||'').split(',').map(Number),length=Number(s.a.Length);
    if(location.length!==2||location.some(x=>!Number.isFinite(x))||!Number.isFinite(length))continue;
    minX=Math.min(minX,location[0]);minY=Math.min(minY,location[1]);
    maxX=Math.max(maxX,location[0]+(s.tag==='HorizontalLine'?length:0));
    maxY=Math.max(maxY,location[1]+(s.tag==='VerticalLine'?length:0));
  }
  return {boxes,minX,minY,maxX,maxY};
}
function createShapes(shapes,ctx,scale,baseClass,geo){
  const frag=document.createDocumentFragment();
  for(const {s,r} of geo.boxes){
    if(s.tag==='HorizontalLine'||s.tag==='VerticalLine')continue;
    if(s.tag==='BDSRedFlagField'&&!ctx.flags?.length)continue;
    const div=document.createElement('div');div.className=baseClass;
    const a=s.a;const value=fieldValue(s,ctx);
    if(value&&typeof value==='object'&&Array.isArray(value.sections)){
      const titles=[];
      for(const section of value.sections){
        if(!section.items.length)continue;
        const group=document.createElement('div');group.className='element-group';
        if(section.heading){const heading=document.createElement('div');heading.className='element-heading';heading.textContent=section.heading;group.append(heading);titles.push(section.heading)}
        const list=document.createElement('div');
        if(value.style==='COMMA_DELIMETED_LIST'){
          list.className='element-inline';list.textContent=categoryElementsText(section.items.map(item=>item.text),value.style);
        }else{
          list.className='element-list';list.style.gridTemplateColumns=`repeat(${Math.max(1,Math.min(12,Math.floor(value.columns)))}, minmax(0, 1fr))`;
          for(const item of section.items){
            const entry=document.createElement('div');entry.className='element-entry';
            if(item.id){
              entry.classList.add('with-id');
              const id=document.createElement('span');id.className='element-id';id.textContent=item.id+'.';
              const name=document.createElement('span');name.className='element-name';name.textContent=item.name;entry.append(id,name);
            }else{entry.textContent=item.text;if(section.heading)entry.classList.add('indented')}
            list.append(entry);
          }
        }
        titles.push(...section.items.map(item=>item.text));group.append(list);div.append(group);
      }
      div.title=titles.join('\n');if(!titles.length)div.classList.add('muted');
    }else{div.textContent=value;if(!value)div.classList.add('muted');div.title=value||a.FieldName||s.tag}
    if(s.tag==='BDSRedFlagField'){
      div.classList.add('red-flag-field');
      div.title=ctx.flags?.map(flagTitle).join('\n')||'';
      div.setAttribute('aria-label',div.title||'Nessuna Red Flag');
    }
    if(a.TextJustification==='CENTER')div.classList.add('center');if(a.TextJustification==='RIGHT')div.classList.add('right');
    if(a.WrapText==='1'||s.tag==='BDSCategoryElementsField'&&a.Style==='GRID'||s.tag==='BDSCategoryElementsTableField'||s.tag==='BDSElementsIDListField'||s.tag==='CustomListField'&&a.PrntCat==='1')div.classList.add('multiline');
    if(a.WrapText==='1')div.classList.add('allow-wrap');
    div.style.left=((r[0]-geo.minX)*scale)+'px';div.style.top=((r[1]-geo.minY)*scale)+'px';
    div.style.width=Math.max(5,r[2]*scale)+'px';div.style.height=Math.max(8,r[3]*scale)+'px';
    const report=baseClass==='report-shape';
    div.style.fontSize=(report?(Number(s.font.Size)||10)*scale/72:Math.max(7,Math.min(13,(Number(s.font.Size)||9)*.85)))+'px';
    if(Number(s.font.Style)&1)div.style.fontWeight='700';
    if(Number(s.font.Style)&2)div.style.fontStyle='italic';
    if(report&&s.font.Name)div.style.fontFamily=`"${s.font.Name.replaceAll('"','')}", Arial, sans-serif`;
    if(a.TextOrientation?.startsWith('VERTICAL')){div.style.writingMode='vertical-rl';if(a.TextOrientation==='VERTICAL_BOTTOM_TO_TOP')div.style.transform='rotate(180deg)'}
    if(a.Borders&&a.Borders!=='0')div.style.border=report?'1px solid #000':'1px solid #aab8bf';
    if(report){
      const content=document.createElement('div');content.className='shape-content';content.append(...div.childNodes);div.append(content);
      div.dataset.growable=a.IsGrowable==='1'?'1':'0';
    }
    frag.appendChild(div);
  }
  return frag;
}
function addLines(target,shapes,geo,scale,cls){
  for(const s of shapes){const a=s.a;if(s.tag!=='HorizontalLine'&&s.tag!=='VerticalLine')continue;
    const coords=(a.Location||'').split(',').map(Number);if(coords.length!==2||coords.some(x=>!Number.isFinite(x)))continue;
    const div=document.createElement('div');div.className=cls+' line';
    div.style.left=(coords[0]-geo.minX)*scale+'px';div.style.top=(coords[1]-geo.minY)*scale+'px';
    div.style.width=(s.tag==='HorizontalLine'?Math.max(1,Number(a.Length)*scale):1)+'px';
    div.style.height=(s.tag==='VerticalLine'?Math.max(1,Number(a.Length)*scale):1)+'px';target.appendChild(div);
  }
}
function stripMetrics(layout){
  const vertical=layout.orientation==='VERTICAL';const scale=vertical?43:SCREEN_PX_PER_INCH;
  const geo=geometry(layout.fields,vertical?0.4:Number(layout.length)||9,vertical?Number(layout.length)||9:Number(layout.width)||.4);
  // Vertical templates store some line coordinates outside the strip column.
  // Their field rectangles define the actual printable strip width.
  if(vertical&&geo.boxes.length){geo.minX=Math.min(...geo.boxes.map(x=>x.r[0]));geo.maxX=Math.max(...geo.boxes.map(x=>x.r[0]+x.r[2]));}
  return {vertical,scale,geo,width:Math.max(1,(geo.maxX-geo.minX)*scale),height:Math.max(1,(geo.maxY-geo.minY)*scale)};
}
function sceneColors(scene){return resolveStripColors(state.project,scene)}

function flagTitle(flag){
  const target=flag.target.kind==='element'?` · ${flag.target.category}: ${flag.target.element}`:'';
  return `${flag.name||'Red Flag'}${target}${flag.note?' · '+flag.note:''}`;
}
function flagIcon(flags){
  const icon=document.createElement('span');icon.className='red-flag-icon scene-flag-icon';
  icon.textContent='⚑';icon.title=flags.map(flagTitle).join('\n');
  icon.setAttribute('role','img');icon.setAttribute('aria-label',`Red Flag scena: ${icon.title}`);
  return icon;
}
function makeStrip(scene,layout,metrics,group){
  if(layout.standard){
    const outer=document.createElement('div');outer.className='strip-outer standard-outer';
    const strip=document.createElement('div');strip.className='strip-layout standard-strip';
    const colors=sceneColors(scene),flags=group?.date?redFlagsForStrip(state.project,scene.bdsId,group.date):[];
    if(state.showColors&&colors?.bg){strip.style.backgroundColor=colors.bg;strip.style.color=colors.fg||'#1d2731'}
    const fields=selectedFields(state.project,state.boardFields||presetFields(state.project,layout.preset));
    strip.innerHTML=fieldsMarkup(fields,scene,{project:state.project,group,pages,shortDate,flags,safe});
    for(const [index,field] of fields.entries())strip.children[index].style.setProperty('--field-weight',field.weight);
    outer.append(strip);return outer;
  }
  const {scale,geo,width,height}=metrics;
  const outer=document.createElement('div');outer.className='strip-outer';
  const strip=document.createElement('div');strip.className='strip-layout';
  strip.style.width=width+'px';strip.style.height=height+'px';
  if(state.showColors){const source=sceneColors(scene);if(source?.bg){strip.style.backgroundColor=source.bg;strip.style.color=source.fg||'#1d2731';strip.classList.add('has-source-color')}}
  const flags=group?.date?redFlagsForStrip(state.project,scene.bdsId,group.date):[];
  strip.appendChild(createShapes(layout.fields,{scene,group,flags},scale,'strip-field',geo));addLines(strip,layout.fields,geo,scale,'strip-field');
  if(flags.length&&!layout.fields.some(field=>field.tag==='BDSRedFlagField'))strip.append(flagIcon(flags));
  strip.title=`Scena ${scene.scene||'—'} · ${scene.set||''} · ${scene.synopsis||''}`;
  const mobile=document.createElement('div');mobile.className='strip-mobile-summary';
  const colors=sceneColors(scene);
  if(state.showColors&&colors?.bg){mobile.style.backgroundColor=colors.bg;mobile.style.color=colors.fg||'#1d2731'}
  mobile.innerHTML=`<span class="mobile-scene-number">${safe(scene.scene||'—')}</span><span class="mobile-scene-set">${safe(scene.set||'Senza set')}</span><span class="mobile-scene-meta">${safe([scene.ie,scene.dn,pages(scene.pagesEighths)].filter(Boolean).join(' · '))}${flags.length?' ⚑':''}</span><span class="mobile-scene-synopsis">${safe(scene.synopsis||scene.location||'—')}</span>`;
  outer.append(strip,mobile);return outer;
}
function makeSpecialStrip(kind,text,layout,metrics,style={}){
  const outer=document.createElement('div');outer.className='strip-outer special-outer';
  const strip=document.createElement('div');strip.className=`strip-layout strip-special ${kind==='banner'?'banner-strip':'day-break-strip'}`;
  if(layout.standard)outer.classList.add('standard-outer');
  else{strip.style.width=metrics.width+'px';strip.style.height=metrics.height+'px'}
  const preferenceName=kind==='banner'?'Banner':'DayStrip',prefs=state.project.colors?.preferences?.[preferenceName],overridePreference=state.project.colors?.overriddenPreferences?.includes(preferenceName);
  if(state.showColors){
    if(style.backgroundColor||prefs?.bg)strip.style.backgroundColor=overridePreference?prefs.bg:style.backgroundColor||prefs.bg;
    strip.style.color=kind==='banner'?(overridePreference?prefs.fg:style.fontColor||prefs?.fg||'#263746'):(prefs?.fg||'#fff');
  }
  const layoutStyle=kind==='banner'?layout.bannerStyle:layout.dayBreakStyle;
  const size=Number(style.fontSize||layoutStyle?.Size);
  if(Number.isFinite(size)&&size>0){strip.style.fontSize=Math.max(7,size*.85)+'px';if(style.fontSizeEdited&&!metrics.vertical)strip.style.minHeight=`${Math.max(metrics.height,size*.85*1.3+4)}px`;}
  if(Number(style.fontStyle??layoutStyle?.Style)&1)strip.style.fontWeight='700';
  const family=style.fontName||layoutStyle?.Family;
  if(family)strip.style.fontFamily=`${family}, Arial, sans-serif`;
  const alignment={'20':['flex-start','left'],'21':['flex-end','right'],'22':['center','center']}[layoutStyle?.Alignment];
  if(alignment){strip.style.justifyContent=alignment[0];strip.style.textAlign=alignment[1];}
  if(metrics.vertical)strip.classList.add('vertical-special');
  strip.textContent=text;strip.title=text;
  outer.append(strip);return outer;
}
function stripboardHeader(shapes,metrics){
  const geo=geometry(shapes),el=document.createElement('div');el.className='stripboard-header-block';
  el.style.width=Math.max(1,(geo.maxX-geo.minX)*metrics.scale)+'px';
  el.style.height=Math.max(1,(geo.maxY-geo.minY)*metrics.scale)+'px';
  el.appendChild(createShapes(shapes,{scene:null,group:null},metrics.scale,'strip-field',geo));
  addLines(el,shapes,geo,metrics.scale,'strip-field');return el;
}
function groupMatches(group,q){if(!q)return true;return group.strips.some(x=>searchText(state.sceneMap.get(x.bdsId),x).includes(q));}
function groupLabel(group){
  if(group.kind==='ScheduleDay')return `Giorno ${group.shootingDayNumber} · ${shortDate(group.date)}`;
  if(group.kind==='RemainingScheduledStrips')return 'Scene programmate senza giorno';
  if(group.kind==='UnscheduledDay')return 'Giorno non programmato';
  return 'Scene non programmate';
}
function movePositionFrom(element){return {boardName:element.dataset.boardName||state.board,container:element.dataset.container,groupIndex:Number(element.dataset.groupIndex),stripIndex:Number(element.dataset.stripIndex)}}
function boardAt(position){return state.project.boards.find(b=>b.name===(position.boardName||state.board))}
function stripAt(position){return boardAt(position)?.[position.container]?.[position.groupIndex]?.strips[position.stripIndex]}
function itemKey(element){
  if(element.dataset.stripKey)return element.dataset.stripKey;
  const position=movePositionFrom(element),group=boardAt(position)?.[position.container]?.[position.groupIndex];
  if(!group)return null;
  return element.dataset.itemKind==='dayBreak'?dayBreakKey(position.boardName,group):stripAt(position)?.sourceKey;
}
function isSceneKey(key){return entriesForBoard(state.project,state.board)
  .some(({group})=>group.strips.some(strip=>strip.kind==='scene'&&strip.sourceKey===key))}
// Shared scene details follow selection; dragging never opens another view.
function selectionChanged(previousActive,reason='selection',open=false){
  const occurrence=entriesForBoard(state.project,state.board).flatMap(e=>e.group.strips).find(strip=>strip.sourceKey===state.activeStripId&&strip.kind==='scene');
  state.activeSceneId=occurrence?state.sceneMap.get(occurrence.bdsId)?.id??null:null;
  syncStripSelection();if(state.project&&!$('breakdownPreview').hidden)renderBreakdown();if(state.project&&['board','calendar'].includes(state.mode))renderBoardEditingTools();
  const detail={selectedStripIds:[...state.selectedStripIds],activeStripId:state.activeStripId,activeSceneId:state.activeSceneId,reason};
  $('boardView').dispatchEvent(new CustomEvent('stripselectionchange',{detail}));
  if(previousActive!==state.activeStripId)$('boardView').dispatchEvent(new CustomEvent('stripactivechange',{detail}));
  if(open&&state.activeStripId)$('boardView').dispatchEvent(new CustomEvent('stripopenrequest',{detail}));
}
function clearStripSelection(){
  selectionChanged(clearStripState(state),'clear');
}
function syncStripSelection(){
  for(const outer of $('boardView').querySelectorAll('.strip-outer[data-strip-index]')){
    const key=itemKey(outer),selected=state.selectedStripIds.has(key);
    outer.classList.toggle('strip-selected',selected);
    outer.classList.toggle('strip-active',state.activeStripId===key);
    outer.setAttribute('aria-pressed',String(selected));
  }
  for(const checkbox of $('calendarView').querySelectorAll('[data-calendar-selection]'))checkbox.checked=state.selectedStripIds.has(checkbox.dataset.calendarSelection);
  for(const strip of $('calendarView').querySelectorAll('[data-strip-key]')){const key=strip.dataset.stripKey;strip.classList.toggle('selected',state.selectedStripIds.has(key));strip.classList.toggle('active',state.activeStripId===key);strip.setAttribute('aria-pressed',String(state.selectedStripIds.has(key)))}
}
function selectItem(key,{toggle=false,range=false,reason='selection',open=false}={}){
  if(!key)return;
  selectionChanged(selectStripState(state,key,{toggle,range,isSceneKey,sceneIdForKey:key=>{const strip=entriesForBoard(state.project,state.board).flatMap(e=>e.group.strips).find(s=>s.sourceKey===key);return state.sceneMap.get(strip?.bdsId)?.id??null},orderedKeys:reason.startsWith('calendar')?[...$('calendarView').querySelectorAll('.operational-grid [data-strip-key]')].map(el=>el.dataset.stripKey):[...$('boardView').querySelectorAll('.strip-outer[data-strip-index]')].map(itemKey)}),reason,open);
}
function openMoveDialog(intent){
  const board=boardAt(intent.from),group=board?.[intent.from.container]?.[intent.from.groupIndex],
    isBreak=intent.fromKind==='dayBreak',strip=isBreak?null:group?.strips[intent.from.stripIndex];
  if(!group||(!isBreak&&!strip))return;
  state.moveIntent=intent;
  const scene=state.sceneMap.get(strip?.bdsId);
  $('moveSource').textContent=intent.sourceKeys.length>1?`${intent.sourceKeys.length} elementi selezionati`:
    isBreak?`Fine ${groupLabel(group)}`:
    strip.kind==='scene'?`Scena ${scene?.scene||strip.bdsId}`:`Banner: ${strip.text||''}`;
  const destinations=entriesForBoard(state.project,state.board);
  $('moveGroup').innerHTML=destinations.map(({group,board,container,groupIndex,segment})=>
    `<option value="${safe(JSON.stringify([board.name,container,groupIndex]))}">${safe(segment.name)} · ${safe(groupLabel(group))}</option>`).join('');
  $('moveGroup').value=JSON.stringify([board.name,intent.from.container,intent.from.groupIndex]);
  refreshMovePositions();$('movePosition').value=String(isBreak?group.strips.length:intent.from.stripIndex);
  $('moveDialog').showModal();
}
function refreshMovePositions(){
  const [boardName,container,index]=JSON.parse($('moveGroup').value||'[]');
  const group=boardAt({boardName})?.[container]?.[index];if(!group)return;
  $('movePosition').innerHTML=Array.from({length:group.strips.length+1},(_,position)=>{
    const next=group.strips[position],scene=next&&state.sceneMap.get(next.bdsId);
    const label=next?(next.kind==='scene'?`Prima della scena ${scene?.scene||next.bdsId}`:`Prima del banner ${next.text||''}`):(['ScheduleDay','UnscheduledDay'].includes(group.kind)?'Alla fine, prima del day break':'Alla fine');
    return `<option value="${position}">${safe(label)}</option>`;
  }).join('');
}
function fitBoardPreview(){
  const view=$('boardView');
  if(view.hidden)return;
  view.classList.toggle('compact-board',view.getBoundingClientRect().width<=620);
  if(view.classList.contains('is-standard')||view.classList.contains('is-vertical')||!view.classList.contains('print-fit'))return;
  const styles=getComputedStyle(view);
  const available=view.clientWidth-parseFloat(styles.paddingLeft)-parseFloat(styles.paddingRight);
  const width=parseFloat(view.style.getPropertyValue('--print-board-width'));
  if(available>0&&width>0){
    const fittedZoom=available/width;
    view.style.setProperty('--live-board-zoom',String(fittedZoom));
  }
}
function makeItemInteractive(outer,label){
  outer.tabIndex=0;outer.setAttribute('role','button');outer.setAttribute('aria-label',label);
  outer.setAttribute('aria-keyshortcuts','F2');outer.title=`${label} · Invio per selezionare · Shift+clic per selezionare un intervallo · F2 per spostare`;
  outer.draggable=false;
}
function renderBoard(board,layout){
  syncSegmentControls();
  const view=$('boardView');view.replaceChildren();view.style.setProperty('--live-board-zoom','1');const q=state.query.trim().toLocaleLowerCase();
  view.classList.toggle('is-monochrome',!state.showColors);
  $('undoMoveButton').disabled=!state.orderHistory.length;
  $('redoMoveButton').disabled=!state.redoHistory.length;
  const vertical=layout.orientation==='VERTICAL';
  view.classList.toggle('is-vertical',vertical);view.classList.toggle('is-standard',!!layout.standard);
  const metrics=stripMetrics(layout);
  const printHeading=document.createElement('div');printHeading.className='print-heading';
  printHeading.textContent=`${state.project.title} · ${selectedBoardGroup()?.name||board.name}`;
  if(layout.header.length)printHeading.append(stripboardHeader(layout.header,metrics));
  view.append(printHeading);
  let shown=0;
  const positioned=displayedEntries();
  const visibleGroups=positioned.filter(({group})=>groupMatches(group,q));
  let section=null,sectionId=null;
  for(const {group,board:plan,container,groupIndex,segment} of visibleGroups){
    if(sectionId!==segment.id){
      sectionId=segment.id;const block=document.createElement('div');block.className='board-segment';block.dataset.segmentId=segment.id;
      const label=document.createElement('div');label.className='segment-heading';label.textContent=segment.name;
      section=document.createElement('div');section.className='segment-days';block.append(label,section);view.append(block);
    }
    const day=document.createElement('section');day.className='day';
    Object.assign(day.dataset,{boardName:plan.name,container,groupIndex,segmentId:segment.id});
    day.setAttribute('aria-label',group.kind==='ScheduleDay'?`Giorno ${group.ordinal}, ${fmtDate(group.date)}`:group.kind);
    const wrap=document.createElement('div');wrap.className=vertical?'vertical-grid':'strips';
    for(const [stripIndex,item] of group.strips.entries()){
      const scene=state.sceneMap.get(item.bdsId);
      if(q&&!searchText(scene,item).includes(q))continue;
      let outer=null;
      if(item.kind==='scene'&&scene)outer=makeStrip(scene,layout,metrics,group);
      else if(item.kind==='banner'&&!state.hideBanners)outer=makeSpecialStrip('banner',formatTemplate(item.text??'',{group,board:plan}),layout,metrics,item.style);
      if(outer){
        Object.assign(outer.dataset,{boardName:plan.name,container,groupIndex,stripIndex,itemKind:item.kind});
        makeItemInteractive(outer,item.kind==='scene'?`Scena ${scene?.scene||item.bdsId}`:`Banner ${item.text||''}`);
        wrap.append(outer);
      }
    }
    if(['ScheduleDay','UnscheduledDay'].includes(group.kind)&&layout.dayBreakText&&!state.hideDayBreaks){
      const dayPages=group.strips.reduce((sum,x)=>sum+(state.sceneMap.get(x.bdsId)?.pagesEighths||0),0);
      const outer=makeSpecialStrip('dayBreak',formatTemplate(layout.dayBreakText,{group,board:plan,dayPages}),layout,metrics);
      Object.assign(outer.dataset,{boardName:plan.name,container,groupIndex,stripIndex:group.strips.length,itemKind:'dayBreak'});
      makeItemInteractive(outer,`Fine ${groupLabel(group)}`);wrap.append(outer);
    }
    if(!wrap.children.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Nessuna strip in questo giorno';wrap.append(empty)}
    day.append(wrap);
    section.append(day);shown++;
  }
  const printStrips=[...view.querySelectorAll('.strip-layout')];
  // Source dimensions stay available when phone rows hide the original layout on screen.
  const sourceWidth=strip=>parseFloat(strip.style.width)||strip.offsetWidth;
  const printWidths=vertical?[...view.querySelectorAll('.vertical-grid')].map(grid=>[...grid.querySelectorAll('.strip-layout')].reduce((width,strip)=>width+sourceWidth(strip),0)):
    printStrips.map(sourceWidth);
  view.classList.toggle('print-fit',!layout.standard&&printStrips.length>0);
  view.style.setProperty('--print-board-width',`${Math.max(1,...printWidths)}px`);
  view.style.setProperty('--print-strip-height',`${Math.max(1,...printStrips.map(strip=>parseFloat(strip.style.height)||strip.offsetHeight))}px`);
  if(!shown){const el=document.createElement('div');el.className='empty';el.textContent=visibleSegmentIds().size?'Nessun risultato per questa ricerca.':'Scegli le sub-board da mostrare.';view.append(el)}
  fitBoardPreview();syncStripSelection();
}
let stripPointer=null,lastDragAt=0;
function pointerDistance(rect,x,y){
  const dx=Math.max(rect.left-x,0,x-rect.right),dy=Math.max(rect.top-y,0,y-rect.bottom);
  return dx*dx+dy*dy;
}
function boardDropPosition(x,y){
  const view=$('boardView');if(view.hidden)return null;const bounds=view.getBoundingClientRect();
  if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return null;
  const days=[...view.querySelectorAll('.day')];
  const day=days.sort((a,b)=>pointerDistance(a.getBoundingClientRect(),x,y)-pointerDistance(b.getBoundingClientRect(),x,y))[0];
  if(!day)return null;
  const wrap=day.firstElementChild,vertical=$('boardView').classList.contains('is-vertical')&&!$('boardView').classList.contains('compact-board');
  const position={boardName:day.dataset.boardName,container:day.dataset.container,groupIndex:Number(day.dataset.groupIndex),stripIndex:0};
  const group=boardAt(position)?.[position.container]?.[position.groupIndex];
  if(!group)return null;
  const outers=[...wrap.querySelectorAll(':scope > .strip-outer[data-strip-index]')];
  const coordinate=vertical?x:y;
  let anchor=null,after=false;
  for(const outer of outers){
    const rect=outer.getBoundingClientRect(),mid=vertical?(rect.left+rect.right)/2:(rect.top+rect.bottom)/2;
    if(coordinate<mid){position.stripIndex=Number(outer.dataset.stripIndex);anchor=outer;break}
  }
  if(!anchor){
    position.stripIndex=group.strips.length;
    anchor=outers.at(-1)||null;
    after=!!anchor&&anchor.dataset.itemKind!=='dayBreak';
    if(anchor?.dataset.itemKind==='dayBreak'){
      const next=days.filter(item=>item.dataset.boardName===day.dataset.boardName&&item.dataset.segmentId===day.dataset.segmentId&&item.dataset.container===day.dataset.container&&Number(item.dataset.groupIndex)>Number(day.dataset.groupIndex))
        .sort((a,b)=>Number(a.dataset.groupIndex)-Number(b.dataset.groupIndex))[0];
      if(next){position.groupIndex=Number(next.dataset.groupIndex);position.stripIndex=0;after=true}
    }
  }
  return {position,anchor,after,wrap,vertical};
}
function calendarDropPosition(x,y){
  if($('calendarView').hidden)return null;
  const element=document.elementFromPoint(x,y),cell=element?.closest('[data-calendar-cell]');
  if(!cell||!$('calendarView').contains(cell))return null;
  const groups=[...cell.querySelectorAll('.calendar-shooting-day')];
  const node=element.closest('.calendar-shooting-day')||groups.sort((a,b)=>pointerDistance(a.getBoundingClientRect(),x,y)-pointerDistance(b.getBoundingClientRect(),x,y))[0];
  if(node){
    const position={boardName:node.dataset.boardName,container:node.dataset.container,groupIndex:Number(node.dataset.groupIndex),stripIndex:0};
    const group=boardAt(position)?.[position.container]?.[position.groupIndex];if(!group)return null;
    const strips=[...node.querySelectorAll('[data-strip-index]')];let anchor=null,after=false;
    for(const strip of strips){const rect=strip.getBoundingClientRect();if(y<(rect.top+rect.bottom)/2){position.stripIndex=Number(strip.dataset.stripIndex);anchor=strip;break}}
    if(!anchor){position.stripIndex=group.strips.length;anchor=strips.at(-1)||null;after=!!anchor}
    return {position,anchor,after,wrap:node,vertical:false,cell};
  }
  const source=boardAt(stripPointer?.intent?.from),candidates=entriesForBoard(state.project,state.board,new Set([...visibleSegmentIds(),...(state.mode==='board'&&state.boneyardVisible?selectedBoardGroup().segments.filter(s=>s.type==='boneyard').map(s=>s.id):[])])).map(e=>e.board).filter(b=>b.calendarId===state.calendar);
  const target=candidates.find(b=>b===source)||candidates.find(b=>b.name===state.board)||candidates[0];
  if(!target)return null;
  return {position:{boardName:target.name,date:cell.dataset.calendarCell,calendarId:state.calendar},wrap:cell.querySelector('.cell-content'),anchor:null,after:false,vertical:false,cell};
}
function dropPosition(x,y){return calendarDropPosition(x,y)||boardDropPosition(x,y)}
function dragViewHover(x,y){
  const pointer=stripPointer;if(!pointer?.active||!$('boardView').hidden&&!$('calendarView').hidden)return;
  const nav=document.elementFromPoint(x,y)?.closest('#boardNav,#calendarNav'),mode=nav?.id==='boardNav'?'board':nav?.id==='calendarNav'?'calendar':null;
  if(!mode||mode===state.mode){pointer.hoverMode=null;return}
  if(pointer.hoverMode!==mode){pointer.hoverMode=mode;pointer.hoverSince=performance.now();return}
  if(performance.now()-pointer.hoverSince>=500){pointer.hoverMode=null;state.previewOpen=false;setMode(mode)}
}
function showDropPosition(slot){
  const marker=stripPointer?.marker;if(!marker)return;
  const rect=(slot.anchor||slot.wrap).getBoundingClientRect();
  marker.classList.toggle('vertical',slot.vertical);
  if(slot.vertical){
    marker.style.left=`${slot.after?rect.right:rect.left}px`;marker.style.top=`${rect.top}px`;
    marker.style.width='3px';marker.style.height=`${rect.height}px`;
  }else{
    marker.style.left=`${rect.left}px`;marker.style.top=`${slot.after?rect.bottom:rect.top}px`;
    marker.style.width=`${rect.width}px`;marker.style.height='3px';
  }
}
function positionDrag(x,y){
  if(!stripPointer?.active)return;
  stripPointer.x=x;stripPointer.y=y;
  const preview=stripPointer.preview,touch=stripPointer.pointerType==='touch';
  // Keep touch feedback above the finger and within narrow phone viewports.
  const left=Math.max(12,Math.min(x+18,window.innerWidth-preview.offsetWidth-12));
  const top=Math.max(12,Math.min(touch?y-preview.offsetHeight-48:y+18,window.innerHeight-preview.offsetHeight-12));
  preview.style.transform=`translate(${left}px, ${top}px)`;
  dragViewHover(x,y);
  document.querySelector('.calendar-drop-target')?.classList.remove('calendar-drop-target');
  stripPointer.slot=dropPosition(x,y);
  stripPointer.slot?.cell?.classList.add('calendar-drop-target');
  stripPointer.marker.hidden=!stripPointer.slot;
  if(stripPointer.slot)showDropPosition(stripPointer.slot);
}
function dragAutoscroll(){
  if(!stripPointer?.active)return;
  const edge=STRIP_GESTURE.autoscrollEdgePx,{x,y}=stripPointer;
  const under=document.elementFromPoint(x,y);
  const view=under?.closest('#calendarView')||under?.closest('#boardView')||($(state.mode==='calendar'?'calendarView':'boardView')),rect=view.getBoundingClientRect();
  const top=Math.max(0,rect.top),bottom=Math.min(window.innerHeight,rect.bottom);
  if(view.scrollHeight>view.clientHeight+1&&x>=rect.left&&x<=rect.right){
    if(y>=top-edge&&y<top+edge)view.scrollTop-=Math.ceil((top+edge-y)/5);
    else if(y>bottom-edge&&y<=bottom+edge)view.scrollTop+=Math.ceil((y-(bottom-edge))/5);
  }else{
    if(y<edge)window.scrollBy(0,-Math.ceil((edge-y)/5));
    else if(y>window.innerHeight-edge)window.scrollBy(0,Math.ceil((y-(window.innerHeight-edge))/5));
  }
  if(y>=rect.top&&y<=rect.bottom){
    const left=Math.max(0,rect.left),right=Math.min(window.innerWidth,rect.right);
    let dx=0;
    if(x>=left&&x<left+edge)dx=-Math.ceil((left+edge-x)/5);
    else if(x<=right&&x>right-edge)dx=Math.ceil((x-(right-edge))/5);
    if(dx){const scroller=under?.closest('.calendar-grid-scroll')||view;if(scroller.scrollWidth>scroller.clientWidth+1)scroller.scrollLeft+=dx;}
  }
  positionDrag(x,y);
  stripPointer.frame=requestAnimationFrame(dragAutoscroll);
}
function startStripDrag(event){
  const pointer=stripPointer;
  if(pointer.range||!pointer.wasSelected)selectItem(pointer.key,{toggle:pointer.toggle,range:pointer.range,reason:pointer.origin==='calendar'?'calendar-drag':'drag'});
  const intent={from:pointer.from,fromKind:pointer.fromKind,sourceKeys:[...state.selectedStripIds]};
  pointer.intent=intent;state.draggedStripIds=new Set(intent.sourceKeys);
  pointer.preview=document.createElement('div');pointer.preview.className='strip-drag-preview';
  const keys=new Set(intent.sourceKeys);
  const chosen=entriesForBoard(state.project,state.board)
    .flatMap(({group})=>group.strips.filter(item=>keys.has(item.sourceKey)));
  const summary=dragSummary(chosen,state.project.scenes),other=intent.sourceKeys.length-summary.count;
  pointer.preview.textContent=summary.count?`${summary.label}${other?` · +${other} elementi`:''}`:
    `${other} ${other===1?'elemento':'elementi'}`;
  pointer.marker=document.createElement('div');pointer.marker.className='strip-drop-indicator';
  document.body.append(pointer.preview,pointer.marker);
  pointer.active=true;
  document.body.setPointerCapture(event.pointerId);
  document.body.classList.add('strip-dragging');
  positionDrag(event.clientX,event.clientY);
  pointer.frame=requestAnimationFrame(dragAutoscroll);
}
function endStripDrag(event,cancel=false){
  const pointer=stripPointer;if(!pointer)return;
  stripPointer=null;clearTimeout(pointer.longPressTimer);
  if(pointer.frame)cancelAnimationFrame(pointer.frame);
  pointer.preview?.remove();pointer.marker?.remove();
  document.querySelector('.calendar-drop-target')?.classList.remove('calendar-drop-target');
  if(document.body.hasPointerCapture(pointer.pointerId))document.body.releasePointerCapture(pointer.pointerId);
  pointer.outer?.classList.remove('strip-long-press');
  document.body.classList.remove('strip-dragging');
  if(pointer.active){
    lastDragAt=performance.now();
    if(!cancel&&pointer.slot){
      try{applyBoardMove(pointer.intent,pointer.slot.position);showStatus('')}
      catch(error){showStatus(error.message)}
    }
  }else if(!cancel&&!pointer.scrolling){
    if(pointer.outer){
      if(!pointer.longPress){
        if(pointer.pointerType==='touch'){
          const toggle=state.touchMultiSelect||(pointer.origin==='calendar'&&state.calendarMultiSelect);
          selectItem(pointer.key,{toggle,reason:pointer.origin==='calendar'?'calendar-tap':'tap',open:!toggle});
        }else{
          state.touchMultiSelect=false;
          selectItem(pointer.key,{toggle:pointer.toggle,range:pointer.range,reason:pointer.origin==='calendar'?'calendar-click':'click',open:!pointer.toggle&&!pointer.range});
        }
      }
    }else if(pointer.empty&&isEmptyBoardPoint(event))clearStripSelection();
  }
  state.draggedStripIds.clear();
}
function applyBoardMove(intent,to){
  const before=snapshotBoardFamily(state.project,state.board);
  const command=to.date?moveCalendarItems:moveBoardItems;
  const changed=command(state.project,{boardName:intent.from.boardName||state.board,sourceKeys:intent.sourceKeys,to});
  if(changed){
    state.orderHistory.push({boardName:state.board,before});
    state.redoHistory=[];
    edited();
  }else syncStripSelection();
  return changed;
}
function applyCalendarCommand(command){
  const before=snapshotProduction(state.project);
  try{if(!command()){showStatus('');return true}state.orderHistory.push({kind:'production',before});state.redoHistory=[];edited();showStatus('');return true}
  catch(error){restoreProduction(state.project,before);showStatus(error.message);return false}
}
function historyStep(from,to){
  const entry=from.pop();if(!entry)return;
  if(entry.kind==='document'){
    to.push({kind:'document',before:snapshotDocument(state.project)});restoreDocument(state.project,entry.before);rebuildDocumentIndexes();
  }else if(entry.kind==='studio'){
    to.push({kind:'studio',before:snapshotStudio(state.project)});restoreStudio(state.project,entry.before);
  }else if(entry.kind==='production'){
    to.push({kind:'production',before:snapshotProduction(state.project)});restoreProduction(state.project,entry.before);
  }else{
    to.push({boardName:entry.boardName,before:snapshotBoardFamily(state.project,entry.boardName)});restoreBoardFamily(state.project,entry.before);
  }
  edited();selectionChanged(state.activeStripId,'history');showStatus('');
}
function undoBoardMove(){historyStep(state.orderHistory,state.redoHistory)}
function redoBoardMove(){historyStep(state.redoHistory,state.orderHistory)}
function syncPrintOptions(){
  document.body.classList.toggle('print-with-header',state.printHeader);
}
function reportRecords(board,layout){
  if(layout.sourceType==='BY_CATEGORY'){
    const cats=layout.record.flatMap(s=>s.categories||[]).filter(c=>!/^all remaining/i.test(c));
    let elements=state.project.elements;
    const criteria=layout.criteria.filter(c=>c.FieldName==='CATEGORY'&&c.ComparisonValue).map(c=>c.ComparisonValue.toLowerCase());
    if(criteria.length)elements=elements.filter(e=>criteria.some(c=>e.category.toLowerCase().includes(c)));
    else if(cats.length)elements=elements.filter(e=>cats.includes(e.category));
    else {const name=layout.name.toLowerCase();const guess=state.project.elements.map(e=>e.category).find(c=>name.includes(c.toLowerCase()));if(guess)elements=elements.filter(e=>e.category===guess)}
    return elements.map(element=>({element}));
  }
  const includeDayBreaks=layout.settings.IncludeDayBreaks==='1'&&!state.hideDayBreaks;
  const endOfDay=group=>{
    const dayPages=group.strips.reduce((sum,x)=>sum+(state.sceneMap.get(x.bdsId)?.pagesEighths||0),0);
    const inlineText=formatTemplate(layout.dayBreakText.DayBreakFooterText||'',{group,board,dayPages});
    return includeDayBreaks&&group.kind==='ScheduleDay'&&inlineText?[{group,inlineText,inlineKind:'day-break'}]:[];
  };
  if(layout.recordType==='SCHEDULE_DAY')return groups(board).filter(g=>g.kind==='ScheduleDay').flatMap(group=>[
    {group,dayRecord:true,scene:group.strips.map(x=>state.sceneMap.get(x.bdsId)).find(Boolean),dayPages:group.strips.reduce((n,x)=>n+(state.sceneMap.get(x.bdsId)?.pagesEighths||0),0)},
    ...endOfDay(group)
  ]);
  const includeBanners=layout.settings.IncludeBanners==='1'&&!state.hideBanners;
  return groups(board).flatMap(group=>[
    ...group.strips.flatMap(item=>{
      const scene=item.kind==='scene'?state.sceneMap.get(item.bdsId):null;
      if(scene)return [{group,scene}];
      if(item.kind==='banner'&&includeBanners){
        const inlineText=formatTemplate(item.text||'',{group,board});
        if(inlineText)return [{group,inlineText,inlineKind:'banner'}];
      }
      return [];
    }),
    ...endOfDay(group)
  ]);
}
function reportBlock(shapes,ctx,height,scale,className,originY=0){
  const geo=geometry(shapes,7.7,originY+(Number(height)||0));geo.minY=originY;
  const el=document.createElement('div');el.className='report-block '+className;
  el.style.width=Math.max(580,(geo.maxX-geo.minX)*scale)+'px';el.style.height=Math.max(0,(geo.maxY-geo.minY)*scale)+'px';
  el.appendChild(createShapes(shapes,ctx,scale,'report-shape',geo));addLines(el,shapes,geo,scale,'report-shape');return el;
}
function fitReportBlocks(paper){
  for(const block of paper.querySelectorAll('.report-block')){
    const elements=[...block.children];
    const boxes=elements.map(el=>{
      const box={x:parseFloat(el.style.left),y:parseFloat(el.style.top),width:parseFloat(el.style.width),height:parseFloat(el.style.height)};
      if(el.dataset.growable==='1'&&el.textContent){
        const content=el.querySelector('.shape-content'),styles=getComputedStyle(el);
        box.contentHeight=content.getBoundingClientRect().height+parseFloat(styles.paddingTop)+parseFloat(styles.paddingBottom)+parseFloat(styles.borderTopWidth)+parseFloat(styles.borderBottomWidth);
      }
      return box;
    });
    const expanded=expandReportBoxes(boxes);
    expanded.forEach((box,index)=>{elements[index].style.top=box.y+'px';elements[index].style.height=box.height+'px'});
    const extra=Math.max(0,...expanded.map((box,index)=>box.shift+box.height-boxes[index].height));
    block.style.height=(parseFloat(block.style.height)+extra)+'px';
  }
  // Some templates already draw a full-width line at the end of each record.
  // Reuse that line when enabling the general record separator option.
  const records=[...paper.querySelectorAll('.record-block')];
  records.forEach((record,index)=>{
    const previous=records[index-1];if(!previous)return;
    const bottom=parseFloat(previous.style.height),width=parseFloat(previous.style.width);
    const existing=[...previous.querySelectorAll('.line')].some(line=>{
      const y=parseFloat(line.style.top),h=parseFloat(line.style.height),w=parseFloat(line.style.width);
      return h<=2&&w>=width*.9&&bottom-y-h>=-1&&bottom-y-h<=8;
    });
    record.classList.toggle('preceded-by-layout-line',existing);
  });
}
function reportSetting(layout,name){
  return state.reportOptions.get(layout.name)?.[name]??layout.settings[name]==='1';
}
function renderReport(board,layout){
  $('reportSeparateRecords').checked=reportSetting(layout,'SeparateRecordsWithALine');
  const view=$('reportView');view.replaceChildren();state.elementIds=new Map(state.project.elements.map(e=>[`${e.category}\u0000${e.name}`,e.boardId]));
  const all=reportRecords(board,layout);const q=state.query.trim().toLocaleLowerCase();
  const records=q?all.filter(x=>searchText(x.scene,{text:[x.element?.name,x.element?.category,x.inlineText].filter(Boolean).join(' ')}).includes(q)):all;
  const intro=document.createElement('div');intro.className='report-intro';intro.innerHTML=`<span class="pill">${safe(layout.recordType||'REPORT')}</span><span>${records.length} record · ${safe(layout.name)}</span>`;view.append(intro);
  const paper=document.createElement('div');paper.className='paper';const scale=78;
  if(layout.header.length)paper.append(reportBlock(layout.header,{group:null,scene:null},layout.headerHeight,scale,'header-block'));
  const show=state.allReport?records:records.slice(0,12);
  const explicitCategories=new Set(layout.record.filter(shape=>shape.a.CategorySource!=='ALL_REMAINING').flatMap(shape=>shape.categories?.length?shape.categories:shape.a.Category?[shape.a.Category]:shape.a.CategoryName?[shape.a.CategoryName]:[]));
  let hasRecord=false;
  for(const ctx of show){
    if(ctx.inlineText){const el=document.createElement('div');el.className=`report-inline report-inline-${ctx.inlineKind}`;el.textContent=ctx.inlineText;paper.append(el);continue}
    const record=reportBlock(layout.record,{...ctx,explicitCategories},layout.recordHeight,scale,'record-block',Number(layout.headerHeight)||0);
    record.classList.toggle('record-separator',hasRecord&&reportSetting(layout,'SeparateRecordsWithALine'));paper.append(record);hasRecord=true;
    record.classList.toggle('keep-on-page',layout.settings.KeepOnOnePage==='1');
    record.classList.toggle('record-new-page',layout.settings.PageBreak==='1');
  }
  if(layout.footer.length)paper.append(reportBlock(layout.footer,{},layout.footerHeight,scale,'footer-block',(Number(layout.headerHeight)||0)+(Number(layout.recordHeight)||0)));
  view.append(paper);
  fitReportBlocks(paper);
  if(records.length>12&&!state.allReport){const more=document.createElement('button');more.className='report-more';more.textContent=`Mostra tutti i ${records.length} record`;more.onclick=()=>{state.allReport=true;renderReport(board,layout)};view.append(more)}
  const note=document.createElement('div');note.className='report-notice';note.textContent='Anteprima dei campi del modello .msd. Alcune formule e regole di impaginazione di Movie Magic non sono disponibili.';view.append(note);
}

const WEEK_DAYS=[['Mon','Lun'],['Tue','Mar'],['Wed','Mer'],['Thu','Gio'],['Fri','Ven'],['Sat','Sab'],['Sun','Dom']];
const DATE_FIELDS=[['ProductionPrepStartDate','Inizio preparazione'],['ProductionStartDate','Inizio produzione'],
  ['ProductionEndDate','Fine produzione'],['ProductionWrapDate','Fine attività']];
const SPECIAL_NAMES={Off:'Giorno libero',Holiday:'Festività',CompanyTravel:'Viaggio produzione',ExceptionWorkday:'Lavorativo eccezionale'};
function monthShift(month,delta){
  const [year,number]=month.split('-').map(Number);
  return new Date(Date.UTC(year,number-1+delta,1)).toISOString().slice(0,7);
}
function monthLabel(month){return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('it-IT',{month:'long',year:'numeric',timeZone:'UTC'})}
function monthGrid(month,selected,details){
  const [year,number]=month.split('-').map(Number);
  const first=(new Date(Date.UTC(year,number-1,1)).getUTCDay()+6)%7;
  const count=new Date(Date.UTC(year,number,0)).getUTCDate();
  const total=Math.ceil((first+count)/7)*7;
  let html=WEEK_DAYS.map(([,name])=>`<div class="month-weekday">${name}</div>`).join('');
  for(let slot=0;slot<total;slot++){
    const n=slot-first+1;
    if(n<1||n>count){html+='<div class="month-blank"></div>';continue}
    const iso=`${month}-${String(n).padStart(2,'0')}`,detail=details(iso);
    html+=`<button type="button" class="month-cell ${detail.className||''} ${selected===iso?'selected':''}" data-date="${iso}" title="${safe(detail.title||'')}"><span class="month-number">${n}</span><span class="month-meta">${safe(detail.meta||'')}</span></button>`;
  }
  return `<div class="month-grid">${html}</div>`;
}
function specialLabel(day){
  if(!day?.specialDay)return day?.working===false?'Riposo settimanale':day?.working===true?'Giorno lavorativo':'Regola non risolta';
  const active=Object.entries(SPECIAL_NAMES).filter(([key])=>day.specialDay.attributes[key]==='1').map(([,name])=>name);
  return active.join(' · ')||`Eccezione non risolta: ${day.specialDay.type||'—'}`;
}
function dateRange(item){
  const start=Object.hasOwn(item,'startDate')?item.startDate:item.date,end=Object.hasOwn(item,'endDate')?item.endDate:item.date;
  if(!start||!end)return 'Intervallo non risolto';
  return start&&end&&start!==end?`${shortDate(start)} → ${shortDate(end)}`:shortDate(start);
}
function table(headers,rows){return `<div class="flag-table-wrap"><table class="flag-table"><thead><tr>${headers.map(h=>`<th>${safe(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${safe(value)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${headers.length}">Nessun dato presente.</td></tr>`}</tbody></table></div>`}
function valueText(value){return value?.text??(value==null?'—':typeof value==='object'?JSON.stringify(value):String(value))}
document.addEventListener('click',event=>{
  const group=event.target.closest('[data-category-group]');if(group){state.dataCategoryGroup=group.dataset.categoryGroup;state.dataCategory=null;state.dataQuery='';state.dataSelectedElements.clear();renderProductionViewer();return}
  const category=event.target.closest('[data-catalog-category]');if(category){state.dataCategory=category.dataset.catalogCategory;state.dataQuery='';state.dataSelectedElements.clear();renderProductionViewer();return}
  const button=event.target.closest('[data-edit-document],[data-inline-new]');if(!button)return;
  const kind=button.dataset.editDocument||button.dataset.inlineNew;
  if(kind==='calendar'){calendarEditor.open(button.hasAttribute('data-new-record')?null:state.calendar);return}
  if(kind==='scene'&&(button.dataset.inlineNew||button.hasAttribute('data-new-record'))){addSceneAtSelection();return}
  if(kind==='banner'&&button.dataset.inlineNew){addBannerAtSelection();return}
  if(kind==='day'){addEndOfDay();return}
  const id=button.dataset.recordId??(button.hasAttribute('data-new-record')||button.dataset.inlineNew?'':kind==='scene'?(state.mode==='data'?state.dataScene:state.activeSceneId):kind==='element'?state.dataElement:kind==='calendar'?state.calendar:kind==='flag'?state.flagSelectedId:undefined);
  if(kind==='scene'&&id){selectBreakdownScene(id);setMode('breakdown');return}
  if(['element','category'].includes(kind)){catalogEditor.open(kind,id??undefined,{categoryName:button.dataset.category});return}
  documentEditor.open(kind,id??undefined);
  if(button.dataset.category){const select=$('documentEditor').querySelector('[name=category]');if(select)select.value=button.dataset.category}
});
function renderProductionViewer(){
  const p=state.project,scenes=[...p.scenes].sort((a,b)=>Number(!a.scene)-Number(!b.scene)||collator.compare(a.scene||'',b.scene||''));
  const scene=scenes.find(s=>s.bdsId===state.dataScene)||scenes[0];
  const categories=[...new Set([...p.categorySettings.map(c=>c.name),...p.elements.map(e=>e.category)].filter(Boolean))].sort(collator.compare);
  const elements=p.elements.filter(e=>!state.dataCategory||e.category===state.dataCategory).sort((a,b)=>collator.compare(a.name||'',b.name||''));
  const element=elements.find(e=>e.id===state.dataElement)||elements.find(e=>e.name)||elements[0];
  state.dataScene=scene?.bdsId??null;state.dataElement=element?.id??null;
  const productionLabels={artDirector:'Scenografia',setDresser:'Arredamento set',timing:'Tempi',episode:'Episodio',miscOne:'Informazioni aggiuntive 1',miscTwo:'Informazioni aggiuntive 2',miscThree:'Informazioni aggiuntive 3',miscFour:'Informazioni aggiuntive 4',title:'Titolo',PictureTitle:'Titolo',company:'Società',director:'Regia',producer:'Produttore',upm:'Direttore di produzione',asstDirector:'Aiuto regia',scriptDated:'Data sceneggiatura',prodNo:'Numero produzione',preparer:'Preparato da'};
  $('dataView').innerHTML=`${elementCatalogMarkup(p,state)}<details class="project-details"><summary>Produzione e quantità per scheda ▾</summary>
    <div class="production-cards"><div class="viewer-card"><h3>Produzione</h3><button type="button" data-edit-document="production">Modifica produzione</button>${table(['Campo','Valore'],Object.entries(p.production).map(([key,value])=>[productionLabels[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2'),valueText(value)]))}</div>
    <div class="viewer-card"><h3>Quantità per scheda</h3><button type="button" data-edit-document="scene">Modifica scena e quantità</button><button type="button" data-edit-document="scene" data-new-record>Nuova scena</button><label class="viewer-label" for="dataSceneSelect">Scheda</label><select id="dataSceneSelect">${scenes.map(s=>`<option value="${safe(s.bdsId)}" ${s===scene?'selected':''}>${safe(s.scene||'Senza numero')} · ${safe(s.synopsis)}</option>`).join('')}</select>
      ${table(['Categoria','Elemento','Quantità','Stato'],(scene?.elementRefs||[]).map(ref=>[ref.category,ref.name,valueText(ref.quantity),!ref.resolved?'Riferimento non risolto':ref.quantityOrigin==='stored'?'Quantità salvata':'Quantità non presente']))}</div>
    </div></details>`;
  const catalogSearch=$('dataView').querySelector('[data-catalog-search]');if(catalogSearch&&state.dataQuery){catalogSearch.value=state.dataQuery;catalogSearch.dispatchEvent(new Event('input',{bubbles:true}))}
}
function renderCalendarViewer(){
  const view=$('calendarView');
  const scroll=view.querySelector('.calendar-grid-scroll'),top=scroll?.scrollTop||0,left=scroll?.scrollLeft||0;
  view.innerHTML=calendarMarkup(state.project,{...state,visibleSegments:visibleSegmentIds()},{safe,shortDate,pages,specialLabel,sceneColors});

  const next=view.querySelector('.calendar-grid-scroll');if(next){next.scrollTop=top;next.scrollLeft=left}
}

function flagMatches(flag,{includeDate=true}={}){
  if(state.flagCategory==='__general__'&&flag.target.kind!=='project')return false;
  if(state.flagCategory&&state.flagCategory!=='__general__'&&flag.target.category!==state.flagCategory)return false;
  if(state.flagElement){
    const element=state.project.elements.find(item=>item.id===state.flagElement);
    if(!element||flag.target.elementId!==element.id&&(flag.target.category!==element.category||flag.target.element!==element.name))return false;
  }
  if(state.flagName&&flag.name!==state.flagName)return false;
  return !includeDate||intervalOverlaps(flag,state.flagStart,state.flagEnd);
}
function renderRedFlagViewer(){$('redFlagView').innerHTML=redFlagMarkup(state.project,state.flags)}

$('projectSelect').addEventListener('change',async e=>{
  const choice=e.target.value;
  if(isDirty()&&!window.confirm('Ci sono modifiche non salvate. Aprire un altro progetto?')){e.target.value=state.projectChoice;return}
  try{
    if(choice==='imported'&&state.importedSource){
      const {bytes,name}=state.importedSource;setProject(await parseSchedule(bytes.slice(0),name));state.projectChoice='imported';
    }else await loadSample(choice);
  }catch(error){showStatus(error.message);e.target.value=state.projectChoice}
});
$('boardSelect').addEventListener('change',e=>{
  if(e.target.value==='__new__'){documentEditor.open('plan','');$('boardSelect').value=selectedBoardGroup().id;return}
  if(e.target.value==='__edit__'){documentEditor.open('plan',selectedBoard().id);$('boardSelect').value=selectedBoardGroup().id;return}
  if(e.target.value==='__reorder__'){openCollectionOrder('board');$('boardSelect').value=selectedBoardGroup().id;return}
  clearStripSelection();
  const parent=boardGroups(state.project).find(item=>item.id===e.target.value);if(!parent)return;
  state.board=parent.plans[0].name;closeSegmentMenu();syncSegmentControls();
  state.calendar=selectedBoard()?.calendarId||findCalendar(state.project,state.project.defaultCalendar)?.id;
  $('calendarSelect').value=state.calendar;
  state.calendarDate=selectedProductionCalendar()?.scheduleDates.ProductionStartDate?.iso||null;
  state.calendarMonth=state.calendarDate?.slice(0,7)||new Date().toISOString().slice(0,7);
  state.printHeader=selectedBoard()?.attributes?.HideStripBoardHeader!=='1';syncPrintOptions();
  state.dood.selected=null;state.dood.ruleElement='';state.dood.goDate=null;render();
});
const isMac=/Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform||navigator.platform||'');
function isToggleGesture(event){return isMac?event.metaKey:event.ctrlKey}
const stripInteractionControls='button,a,input,select,textarea,label,summary,dialog,[contenteditable]:not([contenteditable="false"]),[role="button"]:not(.strip-outer)';
function scheduleInteractionEnabled(){return ['board','calendar'].includes(state.mode)&&(!$('boardView').hidden||!$('calendarView').hidden)}
function boardInteractionEnabled(){return ['board','calendar'].includes(state.mode)&&!$('boardView').hidden}
function isEmptyBoardPoint(event){
  const view=$('boardView');
  if(!boardInteractionEnabled()||event.target.closest(`.strip-outer,${stripInteractionControls}`))return false;
  // Blank space throughout the page dismisses selection; controls keep their own interactions.
  if(event.target.closest('#calendarView,#breakdownPreview,#workspaceToolbar,#workspaceSplitter'))return false;
  if(!view.contains(event.target)){
    const root=document.documentElement;
    return event.clientX<root.clientWidth&&event.clientY<root.clientHeight;
  }
  const rect=view.getBoundingClientRect(),scrollbarX=view.offsetWidth-view.clientWidth,scrollbarY=view.offsetHeight-view.clientHeight;
  if(scrollbarX>0&&event.clientX>=rect.right-scrollbarX)return false;
  if(scrollbarY>0&&event.clientY>=rect.bottom-scrollbarY)return false;
  if(view.scrollWidth>view.clientWidth+1&&event.clientY>=rect.bottom-STRIP_GESTURE.scrollbarGuardPx&&event.target===view)return false;
  return true;
}
// Pointer completion owns mouse/touch selection. A click with detail 0 is keyboard or assistive activation.
$('boardView').addEventListener('click',event=>{
  if(event.detail!==0){if(performance.now()-lastDragAt<STRIP_GESTURE.postDragClickMs){event.preventDefault();event.stopPropagation()}return}
  const outer=event.target.closest('.strip-outer[data-strip-index]');
  if(outer){const toggle=isToggleGesture(event);selectItem(itemKey(outer),{toggle,range:event.shiftKey,reason:'keyboard',open:!toggle&&!event.shiftKey})}
});
$('boardView').addEventListener('keydown',event=>{
  const outer=event.target.closest('.strip-outer[data-strip-index]');
  if(!outer||event.target!==outer)return;
  if(event.key==='Enter'||event.key===' '){
    event.preventDefault();
    const toggle=isToggleGesture(event);selectItem(itemKey(outer),{toggle,range:event.shiftKey,reason:'keyboard',open:!toggle&&!event.shiftKey});
  }else if(event.key==='F2'){
    event.preventDefault();
    const key=itemKey(outer),from=movePositionFrom(outer);
    if(!state.selectedStripIds.has(key))selectItem(key);
    openMoveDialog({from,fromKind:outer.dataset.itemKind||stripAt(from)?.kind,sourceKeys:[...state.selectedStripIds]});
  }
});
document.addEventListener('pointerdown',event=>{
  if(document.querySelector('dialog:modal')||!scheduleInteractionEnabled()||event.button!==0||stripPointer)return;
  const calendar=$('calendarView').contains(event.target)?event.target.closest('[data-strip-key]'):null;
  if(!calendar&&event.target.closest(stripInteractionControls))return;
  const outer=calendar||($('boardView').contains(event.target)?event.target.closest('.strip-outer[data-strip-index]'):null);
  const empty=!outer&&isEmptyBoardPoint(event);
  if(!outer&&!empty)return;
  const from=outer&&movePositionFrom(outer);
  stripPointer={pointerId:event.pointerId,pointerType:event.pointerType,origin:calendar?'calendar':'board',outer,empty,
    key:outer&&itemKey(outer),from,fromKind:outer&&(outer.dataset.itemKind||stripAt(from)?.kind),
    wasSelected:!!outer&&state.selectedStripIds.has(itemKey(outer)),
    toggle:isToggleGesture(event)||(Boolean(calendar)&&state.calendarMultiSelect),range:event.shiftKey,startX:event.clientX,startY:event.clientY,active:false,longPress:false,scrolling:false};
  if(event.pointerType==='touch'&&outer){
    const pointer=stripPointer;
    pointer.longPressTimer=setTimeout(()=>{
      if(stripPointer!==pointer||pointer.scrolling)return;
      pointer.longPress=true;pointer.dragStartX=pointer.lastX??pointer.startX;pointer.dragStartY=pointer.lastY??pointer.startY;
      pointer.outer.classList.add('strip-long-press');
      if(!state.selectedStripIds.has(pointer.key))selectItem(pointer.key,{toggle:state.touchMultiSelect,reason:pointer.origin==='calendar'?'calendar-longpress':'longpress'});
      state.touchMultiSelect=true;
    },STRIP_GESTURE.longPressMs);
  }
});
window.addEventListener('pointermove',event=>{
  const pointer=stripPointer;
  if(!pointer||event.pointerId!==pointer.pointerId)return;
  pointer.lastX=event.clientX;pointer.lastY=event.clientY;
  if(!pointer.active){
    const distance=Math.hypot(event.clientX-(pointer.longPress?pointer.dragStartX:pointer.startX),
      event.clientY-(pointer.longPress?pointer.dragStartY:pointer.startY));
    const intent=movementIntent(pointer,distance);
    if(intent==='scroll'){clearTimeout(pointer.longPressTimer);pointer.scrolling=true;return}
    if(intent==='wait')return;
    if(!pointer.outer){pointer.scrolling=true;return}
    startStripDrag(event);
  }
  if(stripPointer?.active){event.preventDefault();positionDrag(event.clientX,event.clientY)}
},{passive:false});
window.addEventListener('touchmove',event=>{
  if(stripPointer?.pointerType==='touch'&&(stripPointer.longPress||stripPointer.active))event.preventDefault();
},{passive:false});
window.addEventListener('pointerup',event=>{if(event.pointerId===stripPointer?.pointerId)endStripDrag(event)});
window.addEventListener('pointercancel',event=>{if(event.pointerId===stripPointer?.pointerId)endStripDrag(event,true)});
$('moveGroup').addEventListener('change',refreshMovePositions);
$('moveForm').addEventListener('submit',event=>{
  event.preventDefault();
  if(event.submitter?.value==='move'){
    const [boardName,container,index]=JSON.parse($('moveGroup').value);
    const to={boardName,container,groupIndex:index,stripIndex:Number($('movePosition').value)};
    try{applyBoardMove(state.moveIntent,to);showStatus('')}
    catch(error){showStatus(error.message)}
  }
  $('moveDialog').close();state.moveIntent=null;
});
$('moveDialog').addEventListener('close',()=>{state.moveIntent=null});
$('undoMoveButton').addEventListener('click',undoBoardMove);
$('redoMoveButton').addEventListener('click',redoBoardMove);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&scheduleInteractionEnabled()&&!event.target.closest('dialog')){
    closeSegmentMenu();
    if(stripPointer)endStripDrag(event,true);
    clearStripSelection();
  }
  if((event.metaKey||event.ctrlKey)&&!event.target.closest('input,textarea,[contenteditable="true"]')&&!event.target.closest('dialog')){
    const key=event.key.toLowerCase();
    if(key==='z'&&!event.shiftKey&&state.orderHistory.length){event.preventDefault();undoBoardMove()}
    else if(((key==='z'&&event.shiftKey)||key==='y')&&state.redoHistory.length){event.preventDefault();redoBoardMove()}
  }
});
$('saveButton').addEventListener('click',async()=>{
  if(!state.project||state.serializationState==='saving')return;
  if(integratedEditing.hasDraft()||documentEditor.hasDraft()||catalogEditor.hasDraft()||eventManager.hasDraft()){showStatus('Applica o correggi i campi ancora in modifica prima di salvare.');return}
  const token=beginDocumentSave(state),project=token.project;
  const saveProject={...project,...snapshotDocument(project)};
  updateDocumentStatus();showStatus('');
  try{
    const isMmsx=project.format==='mmsx',studio=Boolean(project.documentEditing||project.studio||project.studioContainer),extension=studio?'.json':isMmsx?'.mmsx':'.msd';
    const fileName=studio?project.fileName.replace(/(?:\.studio\.json|\.(?:msd|mmsx))$/i,'')+'.studio.json':isMmsx?project.fileName.replace(/\.mmsx$/i,'')+'-edited.mmsx':project.fileName.replace(/\.msd$/i,'')+'-edited.msd';
    // Open the picker during the user gesture, before asynchronous compression.
    let handle=null;
    if(window.showSaveFilePicker)try{handle=await window.showSaveFilePicker({suggestedName:fileName,types:[{description:studio?'Stripboard Studio':'Movie Magic Scheduling',accept:{'application/octet-stream':[extension]}}]})}catch(error){if(!['SecurityError','NotSupportedError'].includes(error.name))throw error}
    const bytes=studio?await serializeStudio(saveProject):isMmsx?await serializeMmsx(saveProject,fileName):serializeMsd(saveProject);
    if(handle){
      const writer=await handle.createWritable();await writer.write(bytes);await writer.close();
    }else{
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
      try{const link=document.createElement('a');link.href=url;link.download=fileName;document.body.append(link);link.click();link.remove()}
      finally{setTimeout(()=>URL.revokeObjectURL(url),60000)}
    }
    finishDocumentSave(state,token,true);
  }catch(error){finishDocumentSave(state,token,false);if(error.name!=='AbortError')showStatus(`Salvataggio non riuscito: ${error.message}`)}
  finally{updateDocumentStatus()}
});
window.addEventListener('beforeunload',event=>{if(isDirty()||documentEditor.hasDraft()||integratedEditing.hasDraft()||eventManager.hasDraft()){event.preventDefault();event.returnValue=''}});
$('layoutSelect').addEventListener('change',e=>{
  if(state.mode==='board'||e.target.dataset.displayTarget==='board'){
    state.boardLayoutChoice=e.target.value;
    if(e.target.value.startsWith('studio:'))state.boardFields=presetFields(state.project,e.target.value.slice(7));
    syncBoardDisplay();
  }else state.layout=e.target.value;
  state.allReport=false;render();
});
document.addEventListener('change',event=>{
  const input=event.target;if(!input.hasAttribute('data-strip-field-option'))return;
  const calendar=input.dataset.fieldTarget==='calendar',property=calendar?'calendarFields':'boardFields';
  const chosen=state[property]||presetFields(state.project,calendar?state.calendarPreset:selectedBoardLayout().preset,{calendar});
  const keys=input.checked?[...chosen,input.dataset.stripFieldOption]:chosen.filter(key=>key!==input.dataset.stripFieldOption);
  if(!keys.length)return;
  state[property]=[...new Set(keys)];
  if(calendar){state.calendarPreset='custom';state.calendarStripMenuOpen=true}
  else{state.boardLayoutChoice='studio:custom';syncBoardDisplay({force:$('layoutSelect').dataset.displayTarget==='board'})}
  render();
  if(calendar)openDisplaySettings('calendar');
  const picker=calendar?displayOverlay.dialog:$('boardFieldPicker');
  [...picker.querySelectorAll('[data-strip-field-option]')].find(el=>el.dataset.stripFieldOption===input.dataset.stripFieldOption)?.focus();
});
$('calendarSelect').addEventListener('change',e=>{
  consultCalendar(e.target.value);
});
$('boardNav').addEventListener('click',()=>setMode('board'));
$('reportNav').addEventListener('click',()=>setMode('report'));
$('calendarNav').addEventListener('click',()=>setMode('calendar'));
$('doodNav').addEventListener('click',()=>setMode('dood'));
$('breakdownNav').addEventListener('click',()=>{if(!state.activeSceneId)selectBreakdownScene(breakdownSceneOrder()[0]?.bdsId);setMode('breakdown')});
$('redFlagNav').addEventListener('click',()=>setMode('redflags'));
$('dataNav').addEventListener('click',()=>setMode('data'));
$('dataView').addEventListener('change',event=>{
  if(!['dataSceneSelect','dataCategorySelect','dataElementSelect'].includes(event.target.id))return;
  if(event.target.id==='dataSceneSelect')state.dataScene=event.target.value;
  if(event.target.id==='dataCategorySelect'){state.dataCategory=event.target.value;state.dataElement=null}
  if(event.target.id==='dataElementSelect')state.dataElement=event.target.value;
  render();
});
$('calendarView').addEventListener('click',event=>{
  if(event.target.closest('[data-event-manager]')){eventManager.open();return}
  if(event.target.closest('#calendarAgendaToggle')){state.calendarAgenda=!state.calendarAgenda;renderCalendarViewer();$('calendarAgendaToggle').focus();return}
  const strip=event.target.closest('[data-strip-key]');
  if(strip){
    if(event.detail!==0){if(performance.now()-lastDragAt<STRIP_GESTURE.postDragClickMs)event.preventDefault();return}
    selectItem(strip.dataset.stripKey,{toggle:isToggleGesture(event),range:event.shiftKey,reason:'calendar'});return;
  }
  const all=event.target.closest('[data-calendar-all]');
  if(all){state.calendarVisibility=Object.fromEntries(Object.keys(CALENDAR_VISIBILITY).map(k=>[k,all.dataset.calendarAll==='true']));state.calendarMenuOpen=true;render();return}
  if(event.target.closest('#calendarRulesToggle')){calendarEditor.open(state.calendar);return}
  if(event.target.closest('[data-calendar-multi]')){state.calendarMultiSelect=!state.calendarMultiSelect;render();return}
  if(event.target.closest('[data-calendar-display]')){openDisplaySettings('calendar');return}
  if(event.target.closest('#calendarStartSelected')){applyCalendarCommand(()=>editCalendar(state.project,{calendarId:editingCalendar()?.id,startDate:state.calendarDate}));return}

  const go=event.target.closest('[data-go-date]');
  if(go){if(!go.dataset.goDate)return;state.calendarGoDraft=null;state.calendarMonthDraft=null;state.calendarDate=go.dataset.goDate;state.calendarMonth=state.calendarDate.slice(0,7);render();return}
  const step=event.target.closest('[data-month-step]');
  if(step){state.calendarMonth=monthShift(state.calendarMonth,Number(step.dataset.monthStep));state.calendarDate=`${state.calendarMonth}-01`;render();return}
  const date=event.target.closest('[data-date]');
  if(date){state.calendarDate=date.dataset.date;render()}
});
$('calendarView').addEventListener('keydown',event=>{
  const strip=event.target.closest('[data-strip-key]');if(!strip||event.target!==strip)return;
  if(event.key==='F2'){
    event.preventDefault();const key=itemKey(strip),from=movePositionFrom(strip);
    if(!state.selectedStripIds.has(key))selectItem(key,{reason:'calendar'});
    openMoveDialog({from,fromKind:strip.dataset.itemKind,sourceKeys:[...state.selectedStripIds]});
  }
});
$('calendarView').addEventListener('input',event=>{const target=event.target;if(target.id==='calendarStartDate')state.calendarStartDrafts.set(editingCalendar()?.id,target.value);if(target.id==='calendarGoDate')state.calendarGoDraft=target.value;if(target.id==='calendarMonthInput')state.calendarMonthDraft=target.value});
$('calendarView').addEventListener('change',event=>{
  const target=event.target;
  if(target.id==='calendarStripPreset'){state.calendarPreset=target.value;state.calendarFields=presetFields(state.project,target.value,{calendar:true});state.calendarExtended=target.value!=='compact';state.calendarStripMenuOpen=true;render();return}
  if(target.hasAttribute('data-calendar-extended')){state.calendarExtended=target.checked;state.calendarPreset=target.checked?'detailed':'compact';state.calendarFields=presetFields(state.project,state.calendarPreset,{calendar:true});state.calendarMenuOpen=true;render();return}
  if(target.dataset.calendarOption){state.calendarVisibility[target.dataset.calendarOption]=target.checked;state.calendarMenuOpen=true;render();return}
  if(target.dataset.calendarWeekday){applyCalendarCommand(()=>editCalendar(state.project,{calendarId:editingCalendar()?.id,weekday:target.dataset.calendarWeekday,off:target.checked}));return}
  if(target.id==='calendarException'){applyCalendarCommand(()=>editCalendar(state.project,{calendarId:editingCalendar()?.id,date:state.calendarDate||`${state.calendarMonth}-01`,type:target.value||null}));return}
  if(target.id==='calendarStartDate'){const id=editingCalendar()?.id;if(applyCalendarCommand(()=>editCalendar(state.project,{calendarId:id,startDate:target.value})))state.calendarStartDrafts.delete(id);return}
  if(target.id==='calendarGoDate'&&target.value){state.calendarGoDraft=null;state.calendarDate=target.value;state.calendarMonth=target.value.slice(0,7);render();return}

  if(event.target.id==='calendarMonthInput'&&/^\d{4}-\d{2}$/.test(event.target.value)){
    state.calendarMonthDraft=null;state.calendarMonth=event.target.value;state.calendarDate=`${state.calendarMonth}-01`;render();
  }
});
$('redFlagView').addEventListener('input',event=>{if(event.target.hasAttribute('data-flag-note'))state.flags.note=event.target.value});
$('redFlagView').addEventListener('change',event=>{
 const t=event.target,ui=state.flags;
 if(t.hasAttribute('data-flag-category')){ui.category=t.value;ui.elements.clear()}
 else if(t.dataset.flagElement){if(t.checked)ui.elements.add(t.dataset.flagElement);else ui.elements.delete(t.dataset.flagElement)}
 else if(t.hasAttribute('data-flag-all-elements')){for(const el of state.project.elements.filter(el=>el.category===ui.category)){if(t.checked)ui.elements.add(el.id);else ui.elements.delete(el.id)}}
 else if(t.dataset.flagSelect){if(t.checked)ui.selected.add(t.dataset.flagSelect);else ui.selected.delete(t.dataset.flagSelect)}
 else if(t.hasAttribute('data-flag-all-records')){for(const row of $('redFlagView').querySelectorAll('[data-flag-record]')){if(t.checked)ui.selected.add(row.dataset.flagRecord);else ui.selected.delete(row.dataset.flagRecord)}}
 else if(t.hasAttribute('data-flag-type'))ui.type=t.value;
 else if(t.hasAttribute('data-flag-filter'))ui.filter=t.value;
 else if(t.hasAttribute('data-flag-month-input'))ui.month=t.value;
 else return;renderRedFlagViewer();
});
$('redFlagView').addEventListener('click',event=>{
 const ui=state.flags,t=event.target;
 const day=t.closest('[data-flag-date]');if(day){const value=day.dataset.flagDate;if(event.shiftKey&&ui.anchor){let [start,end]=[value,ui.anchor].sort();for(let n=Date.parse(start+'T00:00:00Z');n<=Date.parse(end+'T00:00:00Z');n+=86400000)ui.dates.add(new Date(n).toISOString().slice(0,10))}else if(ui.dates.has(value))ui.dates.delete(value);else ui.dates.add(value);ui.anchor=value;renderRedFlagViewer();return}
 const month=t.closest('[data-flag-month]');if(month){ui.month=monthShift(ui.month,Number(month.dataset.flagMonth));renderRedFlagViewer();return}
 if(t.closest('[data-flag-clear-elements]')){ui.elements.clear();renderRedFlagViewer()}
 if(t.closest('[data-flag-clear-dates]')){ui.dates.clear();ui.anchor=null;renderRedFlagViewer()}
 const sort=t.closest('[data-flag-sort]');if(sort){ui.sort={key:sort.dataset.flagSort,direction:ui.sort.key===sort.dataset.flagSort?-ui.sort.direction:1};renderRedFlagViewer()}
 if(t.closest('[data-flag-add]'))try{applyDocumentCommand(()=>addElementFlags(state.project,{elementIds:[...ui.elements],dates:[...ui.dates],type:registeredFlagTypes(state.project).find(type=>type.id===ui.type),note:ui.note,general:ui.category==='__general__'}));}catch(error){$('redFlagView').querySelector('[data-flag-error]').textContent=error.message}
 if(t.closest('[data-flag-delete]')){
  const ids=new Set(ui.selected);flagDeleteOverlay.open('Elimina Red Flags',`<form><p>Eliminare le ${ids.size} Red Flags selezionate?</p><p data-delete-error role="alert"></p><div class="dialog-actions"><button type="button" data-delete-cancel>Annulla</button><button type="submit" data-flag-delete-confirm>Elimina</button></div></form>`);flagDeleteOverlay.dialog.querySelector('[data-delete-cancel]').onclick=()=>flagDeleteOverlay.close();flagDeleteOverlay.dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{applyDocumentCommand(()=>deleteFlags(state.project,ids));ui.selected.clear();flagDeleteOverlay.close();renderRedFlagViewer()}catch(error){flagDeleteOverlay.dialog.querySelector('[data-delete-error]').textContent=error.message}};
 }
 if(t.closest('[data-flag-export]')){const url=URL.createObjectURL(new Blob([flagCsv(state.project,ui.filter==='selected'?new Set(state.project.redFlags.filter(f=>ui.elements.has(f.target.elementId)).map(f=>f.id)):null)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='red-flags.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
});
$('search').addEventListener('input',e=>{clearStripSelection();state.query=e.target.value;render()});
$('toggleUnscheduled').addEventListener('click',()=>{
  const open=$('subboardMenu').hidden;$('subboardMenu').hidden=!open;$('toggleUnscheduled').setAttribute('aria-expanded',String(open));
});
$('subboardMenu').addEventListener('change',event=>{
  const id=event.target.dataset.segmentId;if(!id)return;
  const ids=visibleSegmentIds();if(event.target.checked)ids.add(id);else ids.delete(id);
  clearStripSelection();render();
});
document.addEventListener('click',event=>{
  if(!event.target.closest('.subboard-picker'))closeSegmentMenu();
  if(!event.target.closest('.display-options'))$('displayOptions').open=false;
  if(!event.target.closest('.project-heading'))document.querySelector('.project-heading').open=false;
});
$('hideBanners').addEventListener('change',e=>{state.hideBanners=e.target.checked;render()});
$('hideDayBreaks').addEventListener('change',e=>{state.hideDayBreaks=e.target.checked;render()});
$('reportSeparateRecords').addEventListener('change',e=>{
  state.reportOptions.set(state.layout,{...state.reportOptions.get(state.layout),SeparateRecordsWithALine:e.target.checked});render();
});
$('printButton').addEventListener('click',()=>{
  if(state.mode==='report'&&!state.allReport){state.allReport=true;renderReport(selectedBoard(),selectedLayout())}
  if(['board','dood'].includes(state.mode)){printService.open();return}
  requestAnimationFrame(()=>window.print());
});
function editingCalendar(){
  return findCalendar(state.project,state.calendar);
}
$('calendarView').addEventListener('toggle',event=>{
  if(event.target.matches('.calendar-view-menu'))state.calendarMenuOpen=event.target.open;
  if(event.target.matches('.calendar-strip-menu'))state.calendarStripMenuOpen=event.target.open;
  if(event.target.matches('.calendar-selected-detail'))state.calendarDetailOpen=event.target.open;
},true);
$('workspaceLayout').addEventListener('change',event=>{
  if(!canSplit(window.innerWidth))return;
  state.layoutChoice=event.target.value;state.previewOpen=state.layoutChoice.endsWith('-breakdown');
  if(state.layoutChoice!=='single')setMode(state.layoutChoice.startsWith('calendar')?'calendar':'board');else render();
});
function closeBreakdown(){
  state.previewOpen=false;if(state.layoutChoice.endsWith('-breakdown'))state.layoutChoice='single';
  if(state.mode==='breakdown')setMode(state.breakdownReturnMode);else render();
  (canSplit(innerWidth)?$('workspaceLayout'):$(state.mode==='calendar'?'calendarNav':'boardNav')).focus();
}
$('previewButton').addEventListener('click',()=>{
  if(state.previewOpen){closeBreakdown();return}
  state.previewOpen=true;if(canSplit(window.innerWidth))state.layoutChoice=`${state.mode}-breakdown`;render();
});
$('breakdownPreview').addEventListener('click',event=>{
  if(event.target.closest('#closeBreakdown'))closeBreakdown();
  const step=event.target.closest('[data-breakdown-step]');
  if(step){const scenes=breakdownSceneOrder(),index=scenes.findIndex(s=>s.id===state.activeSceneId);selectBreakdownScene(scenes[index+Number(step.dataset.breakdownStep)]?.bdsId);$('breakdownPreview').querySelector(`[data-breakdown-step="${step.dataset.breakdownStep}"]`)?.focus()}
});
function breakdownSceneOrder(){
  const ids=new Set(displayedEntries().flatMap(e=>e.group.strips.filter(s=>s.kind==='scene').map(s=>s.bdsId)));
  return [...ids].map(id=>state.sceneMap.get(id)).filter(Boolean).concat(state.project.scenes.filter(s=>!ids.has(s.bdsId)));
}
function selectBreakdownScene(id){
  if(!id||!state.sceneMap.has(id))return;
  state.activeSceneId=state.sceneMap.get(id).id;
  state.activeStripId=displayedEntries().flatMap(e=>e.group.strips).find(s=>s.kind==='scene'&&s.bdsId===id)?.sourceKey||null;
  state.selectedStripIds=new Set(state.activeStripId?[state.activeStripId]:[]);state.selectionAnchorId=state.activeStripId;
  renderBreakdown();syncStripSelection();if(['board','calendar'].includes(state.mode))renderBoardEditingTools();
  [...$('boardView').querySelectorAll('.strip-outer')].find(el=>itemKey(el)===state.activeStripId)?.scrollIntoView({block:'nearest',inline:'nearest'});
  if(!$('calendarView').hidden)renderCalendarViewer();
}
$('breakdownPreview').addEventListener('change',event=>{

  if(event.target.id==='hideEmptyCategories'){state.hideEmptyCategories=event.target.checked;renderBreakdown();$('hideEmptyCategories').focus()}
  if(event.target.id==='breakdownSceneSelect'){selectBreakdownScene(event.target.value);$('breakdownSceneSelect').focus()}
});
let splitPointer=null;
function setSplitRatio(ratio){state.splitRatio=Math.max(25,Math.min(75,ratio));$('workspaceViews').style.setProperty('--split-ratio',String(state.splitRatio/100));$('workspaceSplitter').setAttribute('aria-valuenow',String(Math.round(state.splitRatio)));fitBoardPreview()}
$('workspaceSplitter').addEventListener('pointerdown',event=>{if(!event.isPrimary||event.button!==0)return;splitPointer=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.classList.add('dragging');event.preventDefault()});
$('workspaceSplitter').addEventListener('pointermove',event=>{if(splitPointer!==event.pointerId)return;const rect=$('workspaceViews').getBoundingClientRect(),divider=$('workspaceSplitter').getBoundingClientRect().width;setSplitRatio((event.clientX-rect.left-divider/2)/(rect.width-divider)*100)});
$('workspaceSplitter').addEventListener('pointerup',()=>{splitPointer=null});
$('workspaceSplitter').addEventListener('pointercancel',()=>{splitPointer=null});
$('workspaceSplitter').addEventListener('lostpointercapture',()=>{splitPointer=null;$('workspaceSplitter').classList.remove('dragging')});
$('workspaceSplitter').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();setSplitRatio(event.key==='Home'?25:event.key==='End'?75:state.splitRatio+(event.key==='ArrowLeft'?-5:5))}});
let wasWide=canSplit(window.innerWidth);
window.addEventListener('resize',()=>{const wide=canSplit(window.innerWidth);if(wide!==wasWide){wasWide=wide;render()}});
new ResizeObserver(fitBoardPreview).observe($('boardView'));
document.querySelector('.upload').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();$('fileInput').click()}});
$('fileInput').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(isDirty()&&!window.confirm('Ci sono modifiche non salvate. Importare un altro file?'))return;
    showStatus('');$('projectTitle').textContent='Importazione…';
    if(file.size>64*1024*1024)throw Error('Il file deve essere inferiore a 64 MB');const bytes=await file.arrayBuffer(),data=await parseSchedule(bytes.slice(0),file.name);
    state.importedSource={bytes,name:file.name};
    if(!$('projectSelect').querySelector('[value="imported"]')){$('projectSelect').insertAdjacentHTML('beforeend','<option value="imported">File importato</option>')}
    $('projectSelect').value='imported';setProject(data);state.projectChoice='imported';
  }catch(err){showStatus(err.message);$('projectTitle').textContent=state.project?.title||'Importazione non riuscita'}finally{e.target.value=''}
});
function currentDoodReport(){
  const ui=state.dood,elements=doodElements(state.project),categories=[...new Set(elements.map(e=>e.category))];
  if(!categories.includes(ui.category))ui.category=categories[0]??'';
  const report=calculateDood({project:state.project,board:selectedBoard(),calendar:findCalendar(state.project,selectedBoard().calendarId),elements:elements.filter(e=>e.category===ui.category)});
  report.rows=sortDoodRows(report.rows.filter(r=>(!ui.hideUnused||r.totals.worked||r.totals.held)&&(!state.query||`${r.element.boardId||''} ${r.element.name}`.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()))),ui.sort);
  if(ui.hideOff){const indices=report.dates.map((d,i)=>d.calendar.working!==false?i:-1).filter(i=>i>=0);report.dates=indices.map(i=>report.dates[i]);report.rows=report.rows.map(r=>({...r,cells:indices.map(i=>r.cells[i])}))}
  return report;
}
function renderDood(){
  const view=$('doodView'),old=view.querySelector('.dood-grid-scroll'),position=old?[old.scrollTop,old.scrollLeft]:[0,0],focus=document.activeElement;
  const focusId=view.contains(focus)?focus.id:null;
  try{state.doodReport=currentDoodReport();view.innerHTML=doodMarkup(state.project,selectedBoard(),state.doodReport,state.dood,selectedBoardGroup().plans)}
  catch(error){view.innerHTML=`<p>${safe(error.message)}</p>`;return}
  const grid=view.querySelector('.dood-grid-scroll');grid.scrollTop=position[0];grid.scrollLeft=position[1];
  if(focusId)$(focusId)?.focus({preventScroll:true});
}
function applyStudioCommand(command){
  const before=snapshotStudio(state.project);
  try{command();if(JSON.stringify(before)===JSON.stringify(snapshotStudio(state.project)))return;
    state.orderHistory.push({kind:'studio',before});state.redoHistory=[];edited();showStatus('');
  }catch(error){restoreStudio(state.project,before);showStatus(error.message)}
}
function downloadArtifact(bytes,name,type='application/octet-stream'){
  const url=URL.createObjectURL(new Blob([bytes],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function scrollDoodToDate(date){
  const dates=state.doodReport.dates,chosen=dates.find(d=>d.date>=date)||dates.at(-1);if(!chosen)return;
  state.dood.goDate=chosen.date;const cell=$('doodView').querySelector(`[data-dood-date="${chosen.date}"]`),grid=$('doodView').querySelector('.dood-grid-scroll');
  if(cell&&grid){const fixed=grid.querySelector('.dood-held').getBoundingClientRect().right-grid.getBoundingClientRect().left;grid.scrollLeft=Math.max(0,cell.offsetLeft-fixed)}
  $('doodGoDate').value=chosen.date;
}
$('doodView').addEventListener('toggle',event=>{if(event.target.matches('.dood-rules'))state.dood.rulesOpen=event.target.open},true);
$('doodView').addEventListener('click',async event=>{
  const target=event.target,cell=target.closest('[data-dood-cell]');
  if(cell){state.dood.selected={elementId:cell.dataset.doodElement,date:cell.dataset.doodCell};renderDood();$('doodView').querySelector('.dood-cell-detail')?.scrollIntoView({block:'nearest'});return}
  if(target.closest('#doodCloseCell')){state.dood.selected=null;renderDood();return}
  const scene=target.closest('[data-dood-scene]');
  if(scene){state.query='';$('search').value='';state.segmentVisibility.set(selectedBoardGroup().id,new Set([selectedBoard().segmentId]));state.layoutChoice='single';state.previewOpen=false;
    setMode('board');selectItem(scene.dataset.doodStrip,{reason:'dood'});const el=[...$('boardView').querySelectorAll('.strip-outer')].find(el=>itemKey(el)===scene.dataset.doodStrip);el?.scrollIntoView({block:'center'});return}
  if(target.closest('[data-event-manager]')){eventManager.open();return}
  if(target.closest('#doodPrint')){printService.open();return}
  if(target.closest('#doodCsv')){downloadArtifact('\uFEFF'+doodSummaryCsv(currentDoodReport()),'DOOD Summary.csv','text/csv;charset=utf-8');return}
  if(target.closest('#doodNativeExport')){try{const project=state.project,bytes=project.format==='mmsx'?await serializeMmsx(project,project.fileName):serializeMsd(project);downloadArtifact(bytes,project.fileName.replace(/\.(msd|mmsx)$/i,'')+'-edited.'+project.format)}catch(error){showStatus(error.message)}return}
  if(target.closest('#doodResetRule')){applyStudioCommand(()=>setDoodRules(state.project,state.board,{elementId:state.dood.ruleElement,rules:null}));return}
  const shift=target.closest('[data-dood-shift]');
  if(shift){const d=new Date((state.dood.goDate||state.doodReport.dates[0]?.date)+'T00:00:00Z');if(!Number.isNaN(d.valueOf())){d.setUTCDate(d.getUTCDate()+Number(shift.dataset.doodShift));scrollDoodToDate(d.toISOString().slice(0,10));$('doodGoDate').value=state.dood.goDate}}
});
$('doodView').addEventListener('change',event=>{
  const input=event.target,ui=state.dood;
  if(input.id==='doodSubboard'){state.board=input.value;ui.selected=null;ui.ruleElement='';ui.goDate=null;renderDood();return}
  if(input.id==='doodCategory'){ui.category=input.value;ui.ruleElement='';ui.selected=null;renderDood();return}
  if(input.id==='doodRuleElement'){ui.ruleElement=input.value;renderDood();return}
  if(input.id==='doodGoDate'){scrollDoodToDate(input.value);return}
  for(const [id,key] of [['doodHideUnused','hideUnused'],['doodHideOff','hideOff'],['doodCompact','compact']])if(input.id===id){ui[key]=input.checked;renderDood();return}
  if(input.hasAttribute('data-dood-sort')||input.hasAttribute('data-dood-direction')){
    ui.sort=[...$('doodView').querySelectorAll('[data-dood-sort]')].map((select,i)=>({key:select.value,direction:$('doodView').querySelector(`[data-dood-direction="${i}"]`).value})).filter(c=>c.key);renderDood();return;
  }
  if(input.dataset.doodRule){
    const category=ui.category,element=doodElements(state.project).find(e=>e.id===ui.ruleElement);
    const existing=element?effectiveDoodRules(state.project,selectedBoard(),element):{...DEFAULT_DOOD_RULES,...state.project.studio?.dood?.[state.board]?.categories?.[category]};
    const rules={...existing,[input.dataset.doodRule]:input.type==='checkbox'?input.checked:Math.max(1,Math.floor(Number(input.value)||7))};
    if(!rules.allowHold)rules.allowDrop=false;
    // Element overrides store only the edited values, so category changes still propagate.
    const previous=state.project.studio?.dood?.[state.board]?.elements?.[ui.ruleElement]||{};
    const override={...previous,[input.dataset.doodRule]:rules[input.dataset.doodRule]};
    if(input.dataset.doodRule==='allowHold'&&!rules.allowHold)override.allowDrop=false;
    applyStudioCommand(()=>setDoodRules(state.project,state.board,{category,elementId:ui.ruleElement,rules:element?override:rules}));
  }
});
const eventManager=createEventManager({getContext:()=>({project:state.project,board:state.mode==='calendar'?(selectedBoard().calendarId===state.calendar?selectedBoard():state.project.boards.find(b=>b.calendarId===state.calendar)||selectedBoard()):selectedBoard(),calendar:state.mode==='calendar'?editingCalendar():findCalendar(state.project,selectedBoard().calendarId),date:state.mode==='dood'?state.dood.goDate||state.doodReport.dates[0]?.date:state.calendarDate}),onChange:(command,{native=false}={})=>{if(native||state.project.documentEditing)return applyDocumentCommand(()=>{ensureStudio(state.project);command()});return applyStudioCommand(()=>{ensureStudio(state.project);command()})}});
const printService=createPrintService({
  getSource(settings={}){
    const metadata={title:state.project.title,boardName:selectedBoardGroup().name,date:new Date().toLocaleDateString('it-IT',{timeZone:'Europe/Rome'}),version:`${state.project.fileName} · revisione ${state.revision}`};
    if(state.mode==='dood')return {kind:'dood',report:currentDoodReport(),metadata};
    const standard=selectedBoardLayout().standard;
    const items=[...$('boardView').querySelectorAll('.strip-outer')].map(outer=>{
      const clone=outer.cloneNode(true),strip=clone.querySelector('.strip-layout'),original=outer.querySelector('.strip-layout');
      clone.classList.remove('strip-selected','strip-active');for(const el of [clone,...clone.querySelectorAll('*')]){for(const attr of [...el.attributes])if(attr.name.startsWith('data-')||['tabindex','aria-pressed','aria-keyshortcuts','draggable','role'].includes(attr.name))el.removeAttribute(attr.name)}clone.querySelector('.strip-mobile-summary')?.remove();
      // Source geometry remains available when phone summaries hide the original strip.
      const width=!standard&&original?.style.width.endsWith('px')?parseFloat(original.style.width):outer.offsetWidth;
      const height=!standard&&original?.style.height.endsWith('px')?parseFloat(original.style.height):outer.offsetHeight;
      clone.style.width=width+'px';clone.style.height=height+'px';clone.style.minWidth='0';
      if(strip){strip.style.width=width+'px';strip.style.height=height+'px';strip.style.display=standard?'flex':'block'}
      return {width:width*25.4/96,height:height*25.4/96,html:clone.outerHTML};
    });
    const includeHeader=settings.includeHeader??state.printHeader;
    if(includeHeader){
      const heading=$('boardView').querySelector('.print-heading').cloneNode(true),width=Math.max(1,...items.map(i=>i.width))*96/25.4;
      if(heading.firstChild?.nodeType===Node.TEXT_NODE)heading.firstChild.remove();
      heading.style.cssText=`display:block;position:fixed;visibility:hidden;width:${width}px;left:-10000px`;
      document.body.append(heading);const height=heading.offsetHeight;heading.remove();heading.style.cssText=`display:block;width:${width}px`;
      if(height)items.unshift({width:width*25.4/96,height:height*25.4/96,html:heading.outerHTML});
    }
    return {kind:'schedule',metadata,includeHeader,monochrome:settings.monochrome??false,items};
  },getSettings:()=>({includeHeader:state.printHeader,...state.project.studio?.print}),onSettings:settings=>applyStudioCommand(()=>{ensureStudio(state.project).print={...settings}})
});

loadSample('wonderful');
