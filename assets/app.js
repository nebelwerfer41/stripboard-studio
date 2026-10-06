import {parseMmsx,serializeMmsx} from './mmsx-project.js';
const parseSchedule=(bytes,name)=>/^(MMS2|MMSX)$/.test(new TextDecoder().decode(new Uint8Array(bytes,0,Math.min(4,bytes.byteLength))))?parseMmsx(bytes,name):parseMsd(bytes,name);
import {parseMsd} from './msd-parser.js';
import {serializeMsd} from './msd-writer.js';
import {moveBoardItems,dayBreakKey,snapshotBoardOrder,restoreBoardOrder,dragSummary,createStripboard} from './scheduling.js';
import {resetDocumentState,documentIsDirty,markDocumentEdited,beginDocumentSave,finishDocumentSave} from './document-state.js';
import {elementSumText,categoryElementsText,elementLabel,sortCategoryElements} from './element-format.js';
import {expandReportBoxes} from './report-layout.js';
import {redFlagsForStrip,redFlagsOnDate,calendarDate,boardWithCalendar,outsideCalendarActivity} from './production-data.js';
import {STRIP_GESTURE,selectStripState,clearStripState,movementIntent} from './strip-interaction.js';
const $ = id => document.getElementById(id);
const SAMPLES={wonderful:'samples/Wonderful Life Demo.msd'};
const state = {project:null, mode:'board', board:null, calendar:null, calendarMonth:null, calendarDate:null,
  flagMonth:null,flagCalendar:'',flagCategory:'',flagElement:'',flagName:'',flagStart:'',flagEnd:'',flagSelectedId:null,
  layout:null, query:'', unscheduled:false, showColors:true, hideBanners:false, hideDayBreaks:false,
  allReport:false, importedSource:null, printHeader:true,reportOptions:new Map(),
  revision:0,savedRevision:0,serializationState:'idle',moveIntent:null,orderHistory:[],redoHistory:[],
  selectedStripIds:new Set(),selectionAnchorId:null,activeStripId:null,draggedStripIds:new Set(),touchMultiSelect:false};
const SCREEN_PX_PER_INCH=76;
const collator = new Intl.Collator('it',{numeric:true,sensitivity:'base'});
const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : 'Senza data';
const shortDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'}) : '—';
const pages = n => n == null ? '—' : (Math.floor(n/8) ? `${Math.floor(n/8)}${n%8 ? ' '+n%8+'/8' : ''}` : `${n}/8`);
const rect = s => (s.a.BoundingRect||'').split(',').map(Number);
const safe = v => String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const sceneIndex = () => new Map(state.project.scenes.map(s=>[s.bdsId,s]));
const selectedBoard = () => state.project.boards.find(b=>b.name===state.board) || state.project.boards[0];
const displayedBoard = () => boardWithCalendar(state.project,state.board,state.calendar)||selectedBoard();
const selectedProductionCalendar = () => state.project.calendars.find(c=>c.name===state.calendar)||state.project.calendars[0];
const selectedLayout = () => (state.mode==='board'?state.project.stripLayouts:state.project.reportLayouts).find(l=>l.name===state.layout);
const groups = b => [...(b?.scheduledGroups||[]),...(state.unscheduled?b?.unscheduledGroups||[]:[])];
const sceneList = b => groups(b).flatMap(g=>g.strips.filter(x=>x.kind==='scene').map(x=>state.sceneMap.get(x.bdsId)).filter(Boolean));
const searchText = (s,x) => [s?.scene,s?.set,s?.location,s?.synopsis,s?.scriptDay,x?.text].join(' ').toLocaleLowerCase();

function showStatus(message){$('status').textContent=message;$('status').hidden=!message;}
function isDirty(){return documentIsDirty(state)}
function updateDocumentStatus(){
  const saving=state.serializationState==='saving';
  $('dirtyIndicator').textContent=saving?'Salvataggio…':isDirty()?'Modifiche non salvate':'Salvato';
  $('dirtyIndicator').classList.toggle('dirty',isDirty());
  $('saveButton').disabled=saving||!state.project;
}
function edited(){
  state.project.counts.scheduleDays=state.project.boards.reduce((n,board)=>n+board.scheduledGroups.filter(group=>group.kind==='ScheduleDay').length,0);
  state.project.counts.unscheduledDays=state.project.boards.reduce((n,board)=>n+board.unscheduledGroups.filter(group=>group.kind==='UnscheduledDay').length,0);
  markDocumentEdited(state);updateDocumentStatus();render()}
function refreshBoardOptions(){
  $('boardSelect').innerHTML=state.project.boards.map(b=>`<option value="${safe(b.name)}">${safe(b.name)}</option>`).join('');
  $('boardSelect').value=state.board;$('boardCount').textContent=state.project.boards.length;
  $('projectSubtitle').textContent=`${state.project.fileName} · ${state.project.counts.scenes} scene · ${state.project.boards.length} piani disponibili`;
}
async function loadSample(id){
  showStatus('');$('projectTitle').textContent='Caricamento…';
  try {const source=SAMPLES[id];if(!source)throw Error('Progetto non trovato');const response=await fetch(encodeURI(source));
    if(!response.ok)throw Error(response.status===404?'Campione non disponibile: importa un file .msd dal tuo computer.':'Impossibile leggere il file MSD di esempio');
    setProject(await parseMsd(await response.arrayBuffer(),source.split('/').at(-1)));state.projectChoice=id}
  catch(e){showStatus(e.message);$('projectTitle').textContent=state.project?.title||'Importa un progetto .msd'}
}
function setProject(data){
  resetDocumentState(state);
  const isMmsx=data.format==='mmsx';
  if(isMmsx)state.mode='board';
  for(const id of ['reportNav','calendarNav','redFlagNav','newBoardButton'])$(id).disabled=isMmsx;
  $('saveButton').textContent=isMmsx?'↓ Esporta copia .mmsx':'↓ Salva .msd';
  state.orderHistory=[];state.redoHistory=[];state.moveIntent=null;
  clearStripSelection();
  state.project=data;state.sceneMap=sceneIndex();state.elementIds=new Map(data.elements.map(e=>[`${e.category}\u0000${e.name}`,e.boardId]));state.board=data.boards.some(b=>b.name===data.activeBoard)?data.activeBoard:data.boards[0]?.name;
  state.calendar=selectedBoard()?.calendarName||data.defaultCalendar||data.calendars[0]?.name;
  state.calendarMonth=selectedProductionCalendar()?.scheduleDates.ProductionStartDate?.iso?.slice(0,7)||new Date().toISOString().slice(0,7);
  state.calendarDate=selectedProductionCalendar()?.scheduleDates.ProductionStartDate?.iso||null;
  state.flagMonth=data.redFlags.map(f=>f.date).filter(Boolean).sort()[0]?.slice(0,7)||state.calendarMonth;
  Object.assign(state,{flagCalendar:'',flagCategory:'',flagElement:'',flagName:'',flagStart:'',flagEnd:'',flagSelectedId:null});
  state.elementMap=new Map(data.elements.map(e=>[`${e.category}\u0000${e.name}`,e]));
  state.categorySettings=new Map((data.categorySettings||[]).map(c=>[c.name,c.attributes]));state.reportOptions.clear();
  state.unscheduled=false;state.allReport=false;state.query='';$('search').value='';
  state.hideBanners=false;state.hideDayBreaks=false;$('hideBanners').checked=false;$('hideDayBreaks').checked=false;
  state.printHeader=selectedBoard()?.attributes?.HideStripBoardHeader!=='1';syncPrintOptions();
  $('sideProject').textContent=data.title;$('projectTitle').textContent=data.title;
  refreshBoardOptions();$('reportCount').textContent=data.reportLayouts.length;
  $('calendarCount').textContent=data.calendars.length;$('redFlagCount').textContent=data.redFlags.length;
  $('calendarSelect').innerHTML=data.calendars.map(c=>`<option value="${safe(c.name)}">${safe(c.name)}</option>`).join('');$('calendarSelect').value=state.calendar;
  $('toggleUnscheduled').classList.remove('selected');$('toggleUnscheduled').textContent='Visualizza Boneyard';
  showStatus('');updateDocumentStatus();setMode(state.mode);
}
function setMode(mode){
  if(state.project?.format==='mmsx')mode='board';
  state.mode=mode;
  for(const [id,key] of [['boardNav','board'],['reportNav','report'],['calendarNav','calendar'],['redFlagNav','redflags']])$(id).classList.toggle('active',mode===key);
  $('crumb').textContent={board:'STRIPBOARD',report:'REPORT',calendar:'PRODUCTION CALENDARS',redflags:'RED FLAG ENTRY'}[mode];
  $('layoutLabel').textContent=mode==='board'?'LAYOUT STRIPBOARD':'MODELLO REPORT';
  $('sectionKicker').textContent={board:'PIANO DI LAVORAZIONE',report:'ANTEPRIMA REPORT',calendar:'PRODUCTION CALENDARS',redflags:'RED FLAG ENTRY'}[mode];
  $('search').placeholder=mode==='board'?'Cerca scena, set, testo…':'Cerca nei dati del report…';
  $('toggleUnscheduled').style.display=mode==='board'?'':'none';
  $('colorSwitch').style.display=mode==='board'?'':'none';
  $('printOptions').hidden=mode!=='board';
  $('reportOptions').hidden=mode!=='report';
  $('visibilityOptions').hidden=mode!=='board'&&mode!=='report';
  $('boardControl').hidden=mode==='redflags';
  $('layoutControl').hidden=mode==='calendar'||mode==='redflags';
  $('calendarControl').hidden=state.project?.format==='mmsx'||(mode!=='board'&&mode!=='calendar');
  $('panelTools').hidden=mode==='calendar'||mode==='redflags';
  $('stats').hidden=mode==='calendar'||mode==='redflags';
  $('controls').classList.toggle('minimal',mode==='redflags');
  const layouts=mode==='board'?state.project?.stripLayouts:state.project?.reportLayouts;
  if(mode==='calendar'||mode==='redflags'){render();return}
  if(!layouts)return;
  if(!layouts.some(l=>l.name===state.layout)){
    const preferred=mode==='board'?layouts.find(l=>l.orientation==='HORIZONTAL' && l.name.startsWith('*Schedule'))||layouts.find(l=>l.orientation==='HORIZONTAL'):layouts.find(l=>l.name==='Flash Suite Export')||layouts.find(l=>l.sourceType==='STRIP_BOARD'&&l.recordType==='STRIP')||layouts[0];
    state.layout=preferred?.name;
  }
  $('layoutSelect').innerHTML=layouts.map(l=>`<option value="${safe(l.name)}">${safe(l.name)}</option>`).join('');$('layoutSelect').value=state.layout;
  render();
}
function render(){
  if(!state.project)return;
  for(const [id,mode] of [['boardView','board'],['reportView','report'],['calendarView','calendar'],['redFlagView','redflags']])$(id).hidden=state.mode!==mode;
  if(state.mode==='calendar'){
    $('viewTitle').textContent='Calendari di produzione';$('viewSubtitle').textContent='Pattern settimanali, eccezioni e giorni di ripresa del piano selezionato.';
    renderCalendarViewer();return;
  }
  if(state.mode==='redflags'){
    $('viewTitle').textContent='Red Flag Entry';$('viewSubtitle').textContent='Date, elementi e tipi presenti nel file MSD · consultazione';
    renderRedFlagViewer();return;
  }
  const board=state.mode==='board'?displayedBoard():selectedBoard(),layout=selectedLayout();if(!board||!layout)return;
  $('viewTitle').textContent=state.mode==='board'?board.name:layout.name;
  $('viewSubtitle').textContent=state.mode==='board'?`Calendario: ${board.calendarName}${board.sourceCalendarName?` · nel file: ${board.sourceCalendarName}`:''} · Layout: ${layout.name} · Clic/tap: seleziona · ⌘/Ctrl-clic o pressione lunga: multi · Drag: riordina`:`${layout.sourceType==='BY_CATEGORY'?'Per categoria':'Da stripboard'} · ${layout.recordType==='SCHEDULE_DAY'?'per giornata':layout.recordType==='BY_CATEGORY'?'per elemento':'per scena'}`;
  renderStats(board);
  if(state.mode==='board')renderBoard(board,layout);else renderReport(board,layout);
}
function renderStats(board){
  const dated=board.scheduledGroups.filter(g=>g.kind==='ScheduleDay');
  const used=board.scheduledGroups.flatMap(g=>g.strips).filter(s=>s.kind==='scene').length;
  const vals=[['Giorni di riprese',dated.length],['Scene in piano',used],['Primo giorno',shortDate(board.dateAudit.firstDate)],['Ultimo giorno',shortDate(board.dateAudit.lastDate)]];
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
function requirementNames(scene,categories){
  if(!scene)return [];
  if(!categories?.length||categories.some(x=>/all remaining/i.test(x)))return Object.values(scene.requirements||{}).flat();
  return categories.flatMap(c=>scene.requirements?.[c]||[]);
}
function contextRequirements(ctx,categories){
  if(ctx.dayRecord&&ctx.group?.strips?.length){
    return [...new Set(ctx.group.strips.filter(x=>x.kind==='scene').flatMap(x=>requirementNames(state.sceneMap.get(x.bdsId),categories)))];
  }
  return requirementNames(ctx.scene,categories);
}
function contextCategories(ctx){
  const categories=ctx.dayRecord&&ctx.group?.strips?.length?[...new Set(ctx.group.strips.filter(x=>x.kind==='scene').flatMap(x=>Object.keys(state.sceneMap.get(x.bdsId)?.requirements||{})))]:Object.keys(ctx.scene?.requirements||{});
  return categories.sort((a,b)=>(Number(state.categorySettings.get(a)?.SortOrder)||0)-(Number(state.categorySettings.get(b)?.SortOrder)||0));
}
function contextElements(ctx,category){
  const elements=contextRequirements(ctx,[category]).map(name=>state.elementMap.get(`${category}\u0000${name}`)||{category,name,boardId:''});
  return sortCategoryElements(elements,state.categorySettings.get(category));
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
    return s?.[map[f]]||'';
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
function matchColorIndex(labels,value){
  const needle=String(value||'').trim().toLocaleLowerCase();
  const exact=Object.entries(labels||{}).find(([,label])=>label&&label.trim().toLocaleLowerCase()===needle);
  return exact?.[0]??Object.entries(labels||{}).find(([,label])=>label==='Other')?.[0]??'11';
}
function sceneColors(scene){
  if(scene.mmsxColors)return scene.mmsxColors;
  const colors=state.project.colors||{};
  const row=matchColorIndex(colors.rows,scene.dn),col=matchColorIndex(colors.columns,scene.ie);
  return colors.cells?.[`${row}:${col}`];
}
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
  const {scale,geo,width,height}=metrics;
  const outer=document.createElement('div');outer.className='strip-outer';
  const strip=document.createElement('div');strip.className='strip-layout';
  strip.style.width=width+'px';strip.style.height=height+'px';
  if(state.showColors){const source=sceneColors(scene);if(source?.bg){strip.style.backgroundColor=source.bg;strip.style.color=source.fg||'#1d2731';strip.classList.add('has-source-color')}}
  const flags=group?.date?redFlagsForStrip(state.project,scene.bdsId,group.date):[];
  strip.appendChild(createShapes(layout.fields,{scene,group,flags},scale,'strip-field',geo));addLines(strip,layout.fields,geo,scale,'strip-field');
  if(flags.length&&!layout.fields.some(field=>field.tag==='BDSRedFlagField'))strip.append(flagIcon(flags));
  strip.title=`Scena ${scene.scene||'—'} · ${scene.set||''} · ${scene.synopsis||''}`;
  outer.append(strip);return outer;
}
function makeSpecialStrip(kind,text,layout,metrics,style={}){
  const outer=document.createElement('div');outer.className='strip-outer special-outer';
  const strip=document.createElement('div');strip.className=`strip-layout strip-special ${kind==='banner'?'banner-strip':'day-break-strip'}`;
  strip.style.width=metrics.width+'px';strip.style.height=metrics.height+'px';
  const prefs=state.project.colors?.preferences?.[kind==='banner'?'Banner':'DayStrip'];
  if(state.showColors){
    if(style.backgroundColor||prefs?.bg)strip.style.backgroundColor=style.backgroundColor||prefs.bg;
    strip.style.color=kind==='banner'?(style.fontColor||prefs?.fg||'#263746'):(prefs?.fg||'#fff');
  }
  const layoutStyle=kind==='banner'?layout.bannerStyle:layout.dayBreakStyle;
  const size=Number(style.fontSize||layoutStyle?.Size);
  if(Number.isFinite(size)&&size>0)strip.style.fontSize=Math.max(7,Math.min(20,size*.85))+'px';
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
function movePositionFrom(element){return {container:element.dataset.container,groupIndex:Number(element.dataset.groupIndex),stripIndex:Number(element.dataset.stripIndex)}}
function stripAt(position){return selectedBoard()?.[position.container]?.[position.groupIndex]?.strips[position.stripIndex]}
function itemKey(element){
  const position=movePositionFrom(element),group=selectedBoard()?.[position.container]?.[position.groupIndex];
  if(!group)return null;
  return element.dataset.itemKind==='dayBreak'?dayBreakKey(state.board,group):stripAt(position)?.sourceKey;
}
function isSceneKey(key){return [...selectedBoard().scheduledGroups,...selectedBoard().unscheduledGroups]
  .some(group=>group.strips.some(strip=>strip.kind==='scene'&&strip.sourceKey===key))}
// Future scene detail can follow active changes and open only on stripopenrequest (never on drag).
function selectionChanged(previousActive,reason='selection',open=false){
  syncStripSelection();
  const detail={selectedStripIds:[...state.selectedStripIds],activeStripId:state.activeStripId,reason};
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
}
function selectItem(key,{toggle=false,range=false,reason='selection',open=false}={}){
  if(!key)return;
  selectionChanged(selectStripState(state,key,{toggle,range,isSceneKey,orderedKeys:[...$('boardView').querySelectorAll('.strip-outer[data-strip-index]')].map(itemKey)}),reason,open);
}
function openMoveDialog(intent){
  const board=selectedBoard(),group=board[intent.from.container]?.[intent.from.groupIndex],
    isBreak=intent.fromKind==='dayBreak',strip=isBreak?null:group?.strips[intent.from.stripIndex];
  if(!group||(!isBreak&&!strip))return;
  state.moveIntent=intent;
  const scene=state.sceneMap.get(strip?.bdsId);
  $('moveSource').textContent=intent.sourceKeys.length>1?`${intent.sourceKeys.length} elementi selezionati`:
    isBreak?`Fine ${groupLabel(group)}`:
    strip.kind==='scene'?`Scena ${scene?.scene||strip.bdsId}`:`Banner: ${strip.text||''}`;
  const destinations=[...board.scheduledGroups.map((group,index)=>({group,container:'scheduledGroups',index})),
    ...board.unscheduledGroups.map((group,index)=>({group,container:'unscheduledGroups',index}))];
  $('moveGroup').innerHTML=destinations.map(({group,container,index})=>
    `<option value="${container}:${index}">${safe(groupLabel(group))}</option>`).join('');
  $('moveGroup').value=`${intent.from.container}:${intent.from.groupIndex}`;
  refreshMovePositions();$('movePosition').value=String(isBreak?group.strips.length:intent.from.stripIndex);
  $('moveDialog').showModal();
}
function refreshMovePositions(){
  const [container,index]=($('moveGroup').value||'').split(':');
  const group=selectedBoard()?.[container]?.[Number(index)];if(!group)return;
  $('movePosition').innerHTML=Array.from({length:group.strips.length+1},(_,position)=>{
    const next=group.strips[position],scene=next&&state.sceneMap.get(next.bdsId);
    const label=next?(next.kind==='scene'?`Prima della scena ${scene?.scene||next.bdsId}`:`Prima del banner ${next.text||''}`):(['ScheduleDay','UnscheduledDay'].includes(group.kind)?'Alla fine, prima del day break':'Alla fine');
    return `<option value="${position}">${safe(label)}</option>`;
  }).join('');
}
function fitBoardPreview(){
  const view=$('boardView');
  if(view.hidden||view.classList.contains('is-vertical')||!view.classList.contains('print-fit'))return;
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
  const view=$('boardView');view.replaceChildren();view.style.setProperty('--live-board-zoom','1');const q=state.query.trim().toLocaleLowerCase();
  $('undoMoveButton').disabled=!state.orderHistory.length;
  $('redoMoveButton').disabled=!state.redoHistory.length;
  const vertical=layout.orientation==='VERTICAL';
  view.classList.toggle('is-vertical',vertical);
  const metrics=stripMetrics(layout);
  const printHeading=document.createElement('div');printHeading.className='print-heading';
  printHeading.textContent=`${state.project.title} · ${board.name}`;
  if(layout.header.length)printHeading.append(stripboardHeader(layout.header,metrics));
  view.append(printHeading);
  let shown=0;
  const positioned=[...board.scheduledGroups.map((group,index)=>({group,container:'scheduledGroups',groupIndex:index})),
    ...(state.unscheduled?board.unscheduledGroups.map((group,index)=>({group,container:'unscheduledGroups',groupIndex:index})):[])];
  const visibleGroups=positioned.filter(({group})=>groupMatches(group,q));
  for(const {group,container,groupIndex} of visibleGroups){
    const day=document.createElement('section');day.className='day';
    Object.assign(day.dataset,{container,groupIndex});
    day.setAttribute('aria-label',group.kind==='ScheduleDay'?`Giorno ${group.ordinal}, ${fmtDate(group.date)}`:group.kind);
    const wrap=document.createElement('div');wrap.className=vertical?'vertical-grid':'strips';
    for(const [stripIndex,item] of group.strips.entries()){
      const scene=state.sceneMap.get(item.bdsId);
      if(q&&!searchText(scene,item).includes(q))continue;
      let outer=null;
      if(item.kind==='scene'&&scene)outer=makeStrip(scene,layout,metrics,group);
      else if(item.kind==='banner'&&!state.hideBanners)outer=makeSpecialStrip('banner',formatTemplate(item.text??'',{group,board}),layout,metrics,item.style);
      if(outer){
        Object.assign(outer.dataset,{container,groupIndex,stripIndex});
        makeItemInteractive(outer,item.kind==='scene'?`Scena ${scene?.scene||item.bdsId}`:`Banner ${item.text||''}`);
        wrap.append(outer);
      }
    }
    if(['ScheduleDay','UnscheduledDay'].includes(group.kind)&&layout.dayBreakText&&!state.hideDayBreaks){
      const dayPages=group.strips.reduce((sum,x)=>sum+(state.sceneMap.get(x.bdsId)?.pagesEighths||0),0);
      const outer=makeSpecialStrip('dayBreak',formatTemplate(layout.dayBreakText,{group,board,dayPages}),layout,metrics);
      Object.assign(outer.dataset,{container,groupIndex,stripIndex:group.strips.length,itemKind:'dayBreak'});
      makeItemInteractive(outer,`Fine ${groupLabel(group)}`);wrap.append(outer);
    }
    if(!wrap.children.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Nessuna strip in questo giorno';wrap.append(empty)}
    day.append(wrap);
    view.append(day);shown++;
  }
  const printStrips=[...view.querySelectorAll('.strip-layout')];
  const printWidths=vertical?[...view.querySelectorAll('.vertical-grid')].map(grid=>grid.scrollWidth):
    printStrips.map(strip=>strip.offsetWidth);
  view.classList.toggle('print-fit',printStrips.length>0);
  view.style.setProperty('--print-board-width',`${Math.max(1,...printWidths)}px`);
  view.style.setProperty('--print-strip-height',`${Math.max(1,...printStrips.map(strip=>strip.offsetHeight))}px`);
  if(!shown){const el=document.createElement('div');el.className='empty';el.textContent='Nessun risultato per questa ricerca.';view.append(el)}
  fitBoardPreview();syncStripSelection();
}
let stripPointer=null,lastDragAt=0;
function pointerDistance(rect,x,y){
  const dx=Math.max(rect.left-x,0,x-rect.right),dy=Math.max(rect.top-y,0,y-rect.bottom);
  return dx*dx+dy*dy;
}
function dropPosition(x,y){
  const view=$('boardView'),bounds=view.getBoundingClientRect();
  if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return null;
  const days=[...view.querySelectorAll('.day')];
  const day=days.sort((a,b)=>pointerDistance(a.getBoundingClientRect(),x,y)-pointerDistance(b.getBoundingClientRect(),x,y))[0];
  if(!day)return null;
  const wrap=day.firstElementChild,vertical=$('boardView').classList.contains('is-vertical');
  const position={container:day.dataset.container,groupIndex:Number(day.dataset.groupIndex),stripIndex:0};
  const group=selectedBoard()?.[position.container]?.[position.groupIndex];
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
      const next=days.filter(item=>item.dataset.container===day.dataset.container&&Number(item.dataset.groupIndex)>Number(day.dataset.groupIndex))
        .sort((a,b)=>Number(a.dataset.groupIndex)-Number(b.dataset.groupIndex))[0];
      if(next){position.groupIndex=Number(next.dataset.groupIndex);position.stripIndex=0;after=true}
    }
  }
  return {position,anchor,after,wrap,vertical};
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
  stripPointer.slot=dropPosition(x,y);
  stripPointer.marker.hidden=!stripPointer.slot;
  if(stripPointer.slot)showDropPosition(stripPointer.slot);
}
function dragAutoscroll(){
  if(!stripPointer?.active)return;
  const edge=STRIP_GESTURE.autoscrollEdgePx,{x,y}=stripPointer;
  if(y<edge)window.scrollBy(0,-Math.ceil((edge-y)/5));
  else if(y>window.innerHeight-edge)window.scrollBy(0,Math.ceil((y-(window.innerHeight-edge))/5));
  const view=$('boardView'),rect=view.getBoundingClientRect();
  if(y>=rect.top&&y<=rect.bottom){
    const left=Math.max(0,rect.left),right=Math.min(window.innerWidth,rect.right);
    let dx=0;
    if(x>=left&&x<left+edge)dx=-Math.ceil((left+edge-x)/5);
    else if(x<=right&&x>right-edge)dx=Math.ceil((x-(right-edge))/5);
    if(dx){if(view.scrollWidth>view.clientWidth+1)view.scrollLeft+=dx;else window.scrollBy(dx,0)}
  }
  positionDrag(x,y);
  stripPointer.frame=requestAnimationFrame(dragAutoscroll);
}
function startStripDrag(event){
  const pointer=stripPointer;
  if(pointer.range||!pointer.wasSelected)selectItem(pointer.key,{toggle:pointer.toggle,range:pointer.range,reason:'drag'});
  const intent={from:pointer.from,fromKind:pointer.fromKind,sourceKeys:[...state.selectedStripIds]};
  pointer.intent=intent;state.draggedStripIds=new Set(intent.sourceKeys);
  pointer.preview=document.createElement('div');pointer.preview.className='strip-drag-preview';
  const keys=new Set(intent.sourceKeys);
  const chosen=[...selectedBoard().scheduledGroups,...selectedBoard().unscheduledGroups]
    .flatMap(group=>group.strips.filter(item=>keys.has(item.sourceKey)));
  const summary=dragSummary(chosen,state.project.scenes),other=intent.sourceKeys.length-summary.count;
  pointer.preview.textContent=summary.count?`${summary.label}${other?` · +${other} elementi`:''}`:
    `${other} ${other===1?'elemento':'elementi'}`;
  pointer.marker=document.createElement('div');pointer.marker.className='strip-drop-indicator';
  document.body.append(pointer.preview,pointer.marker);
  pointer.active=true;
  $('boardView').setPointerCapture(event.pointerId);
  document.body.classList.add('strip-dragging');
  positionDrag(event.clientX,event.clientY);
  pointer.frame=requestAnimationFrame(dragAutoscroll);
}
function endStripDrag(event,cancel=false){
  const pointer=stripPointer;if(!pointer)return;
  stripPointer=null;clearTimeout(pointer.longPressTimer);
  if(pointer.frame)cancelAnimationFrame(pointer.frame);
  pointer.preview?.remove();pointer.marker?.remove();
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
          const toggle=state.touchMultiSelect;
          selectItem(pointer.key,{toggle,reason:'tap',open:!toggle});
        }else{
          state.touchMultiSelect=false;
          selectItem(pointer.key,{toggle:pointer.toggle,range:pointer.range,reason:'click',open:!pointer.toggle&&!pointer.range});
        }
      }
    }else if(pointer.empty&&isEmptyBoardPoint(event))clearStripSelection();
  }
  state.draggedStripIds.clear();
}
function applyBoardMove(intent,to){
  const board=selectedBoard(),before=snapshotBoardOrder(board);
  const changed=moveBoardItems(state.project,{boardName:state.board,sourceKeys:intent.sourceKeys,to});
  if(changed){
    state.orderHistory.push({boardName:state.board,before});
    state.redoHistory=[];
    edited();
  }else syncStripSelection();
  return changed;
}
function undoBoardMove(){
  const entry=state.orderHistory.pop();if(!entry)return;
  const board=state.project.boards.find(item=>item.name===entry.boardName);
  if(!board)return;
  state.redoHistory.push({boardName:entry.boardName,before:snapshotBoardOrder(board)});
  restoreBoardOrder(board,entry.before);clearStripSelection();edited();showStatus('');
}
function redoBoardMove(){
  const entry=state.redoHistory.pop();if(!entry)return;
  const board=state.project.boards.find(item=>item.name===entry.boardName);
  if(!board)return;
  state.orderHistory.push({boardName:entry.boardName,before:snapshotBoardOrder(board)});
  restoreBoardOrder(board,entry.before);clearStripSelection();edited();showStatus('');
}
function syncPrintOptions(){
  $('printHeader').checked=state.printHeader;
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
  return active.join(' · ')||'Eccezione registrata';
}
function renderCalendarViewer(){
  const view=$('calendarView'),calendar=selectedProductionCalendar(),board=displayedBoard();
  if(!calendar){view.innerHTML='<p class="viewer-empty">Nessun calendario nel file MSD.</p>';return}
  const month=state.calendarMonth||calendar.scheduleDates.ProductionStartDate?.iso?.slice(0,7)||new Date().toISOString().slice(0,7);
  const selected=state.calendarDate||`${month}-01`,day=calendarDate(calendar,selected);
  const shootingGroups=board?.scheduledGroups.filter(group=>group.kind==='ScheduleDay'&&group.date===selected)||[];
  const sceneIds=shootingGroups.flatMap(group=>group.strips.filter(strip=>strip.kind==='scene').map(strip=>strip.bdsId));
  const scenes=sceneIds.map(id=>state.sceneMap.get(id)).filter(Boolean);
  const selectedFlags=redFlagsOnDate(state.project,selected);
  const list=state.project.calendars.map(item=>`<button type="button" class="calendar-choice ${item.name===calendar.name?'selected':''}" data-calendar-name="${safe(item.name)}">
    <span class="choice-title">${safe(item.name)} ${item.name===state.project.defaultCalendar?'<small>PREDEFINITO</small>':''}</span>
    <span>${shortDate(item.scheduleDates.ProductionPrepStartDate?.iso)} → ${shortDate(item.scheduleDates.ProductionWrapDate?.iso)}</span>
  </button>`).join('');
  const off=WEEK_DAYS.map(([key,name])=>`<span class="weekday-chip ${calendar.daysOff[key]==='1'?'off':''}">${name}</span>`).join('');
  const grid=monthGrid(month,selected,iso=>{
    const value=calendarDate(calendar,iso);
    const groups=board?.scheduledGroups.filter(group=>group.kind==='ScheduleDay'&&group.date===iso)||[];
    const flags=redFlagsOnDate(state.project,iso);
    const outside=outsideCalendarActivity(calendar,iso);
    return {className:`${value?.working===false?'nonworking':value?.working===null?'unresolved':'working'} ${value?.specialDay?'special':''} ${groups.length?'shooting':''} ${outside?'outside-activity':''}`,
      meta:groups.length?`G ${groups.map(group=>group.shootingDayNumber).join(', ')}`:value?.specialDay?'★':flags.length?'⚑':'',
      title:`${fmtDate(iso)} · ${specialLabel(value)}${outside?' · Fuori dal periodo di attività':''}${groups.length?` · Giorno di ripresa ${groups.map(g=>g.shootingDayNumber).join(', ')}`:''}`};
  });
  const dates=DATE_FIELDS.map(([key,label])=>{
    const iso=calendar.scheduleDates[key]?.iso;
    return `<div class="date-fact"><span>${label}</span>${iso?`<button type="button" data-go-date="${iso}" title="Vai a ${safe(shortDate(iso))}">${shortDate(iso)} ↗</button>`:'<strong>—</strong>'}</div>`;
  }).join('');
  view.innerHTML=`<div class="viewer-intro"><p>I calendari appartengono al progetto MSD. Cambiare calendario ricalcola solo le date mostrate per il piano <strong>${safe(board?.name||'—')}</strong>; scene e ordine restano gli stessi.</p></div>
    <div class="calendar-layout"><aside class="viewer-side"><h3>Calendari disponibili</h3><div class="calendar-choices">${list}</div>
      <div class="viewer-card"><h3>${safe(calendar.name)}</h3><div class="date-facts">${dates}</div><h4>Giorni non lavorativi</h4><div class="weekday-chips">${off}</div></div></aside>
      <div class="viewer-main"><div class="viewer-card"><div class="month-toolbar"><button type="button" data-month-step="-1" aria-label="Mese precedente">‹</button><h3>${safe(monthLabel(month))}</h3><button type="button" data-month-step="1" aria-label="Mese successivo">›</button><input id="calendarMonthInput" type="month" value="${month}" aria-label="Vai al mese"></div>${grid}
        <div class="calendar-legend"><span><i class="legend-dot work"></i> Lavorativo</span><span><i class="legend-dot off"></i> Non lavorativo</span><span><i class="legend-dot outside"></i> Fuori attività</span><span><i class="legend-dot special"></i> Eccezione</span><span><i class="legend-dot shoot"></i> Riprese del piano</span></div></div>
        <div class="viewer-card date-detail"><h3>${safe(fmtDate(selected))}</h3><p><strong>${safe(specialLabel(day))}</strong>${day?.working===null?' · Stato da verificare':''}</p>
          <div class="detail-pills"><span>${shootingGroups.length?`Giorno di ripresa ${shootingGroups.map(g=>g.shootingDayNumber).join(', ')}`:'Nessuna ripresa nel piano'}</span><span>${scenes.length} ${scenes.length===1?'scena':'scene'}</span><span>${selectedFlags.length} Red Flag nella data</span></div>
          ${scenes.length?`<p class="scene-summary">${safe(scenes.slice(0,8).map(scene=>scene.scene||scene.bdsId).join(' · '))}${scenes.length>8?' · …':''}</p>`:''}</div></div></div>`;
}

function flagMatches(flag,{includeDate=true}={}){
  if(state.flagCategory==='__general__'&&flag.target.kind!=='project')return false;
  if(state.flagCategory&&state.flagCategory!=='__general__'&&flag.target.category!==state.flagCategory)return false;
  if(state.flagElement&&flag.target.element!==state.flagElement)return false;
  if(state.flagName&&flag.name!==state.flagName)return false;
  if(includeDate&&state.flagStart&&(!flag.date||flag.date<state.flagStart))return false;
  if(includeDate&&state.flagEnd&&(!flag.date||flag.date>state.flagEnd))return false;
  return true;
}
function renderRedFlagViewer(){
  const view=$('redFlagView'),project=state.project,month=state.flagMonth||new Date().toISOString().slice(0,7);
  const categories=[...new Set([...project.elements.map(item=>item.category),...project.redFlags.map(flag=>flag.target.category)].filter(Boolean))].sort(collator.compare);
  const elements=state.flagCategory&&state.flagCategory!=='__general__'?project.elements.filter(item=>item.category===state.flagCategory).map(item=>item.name).sort(collator.compare):[];
  const names=[...new Set([...project.redFlagNames.map(item=>item.name),...project.redFlags.map(flag=>flag.name)])].filter(Boolean);
  const filtered=project.redFlags.filter(flag=>flagMatches(flag)).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||a.sourceOrder-b.sourceOrder);
  if(!filtered.some(flag=>flag.id===state.flagSelectedId))state.flagSelectedId=filtered[0]?.id||null;
  const selected=filtered.find(flag=>flag.id===state.flagSelectedId);
  const categoryOptions=categories.map(name=>`<option value="${safe(name)}" ${state.flagCategory===name?'selected':''}>${safe(name)}</option>`).join('');
  const elementOptions=elements.map(name=>`<option value="${safe(name)}" ${state.flagElement===name?'selected':''}>${safe(name)}</option>`).join('');
  const typeOptions=names.map(name=>`<option value="${safe(name)}" ${state.flagName===name?'selected':''}>${safe(name)}</option>`).join('');
  const calendarOptions=project.calendars.map(item=>`<option value="${safe(item.name)}" ${state.flagCalendar===item.name?'selected':''}>${safe(item.name)}</option>`).join('');
  const context=project.calendars.find(item=>item.name===state.flagCalendar);
  const grid=monthGrid(month,state.flagStart&&state.flagStart===state.flagEnd?state.flagStart:null,iso=>{
    const flags=project.redFlags.filter(flag=>flag.date===iso&&flagMatches(flag,{includeDate:false}));
    const day=context?calendarDate(context,iso):null;
    const outside=context&&outsideCalendarActivity(context,iso);
    return {className:`${day?.working===false?'nonworking':''} ${flags.length?'has-flags':''} ${outside?'outside-activity':''}`,
      meta:flags.length?`⚑ ${flags.length}`:'',title:`${fmtDate(iso)} · ${flags.length} Red Flag${day?` · ${specialLabel(day)}`:''}${outside?' · Fuori dal periodo di attività':''}`};
  });
  const rows=filtered.map(flag=>`<tr class="${flag.id===selected?.id?'selected':''}" data-flag-id="${safe(flag.id)}" tabindex="0" aria-selected="${flag.id===selected?.id}">
    <td>${shortDate(flag.date)}</td><td>${safe(flag.target.category||'—')}</td><td>${safe(flag.target.element||'—')}</td><td>${safe(flag.name||'—')}</td><td>${safe(flag.note||'')}</td></tr>`).join('');
  view.innerHTML=`<div class="viewer-intro"><p>Red Flag Entry elenca le segnalazioni salvate nel file. I tipi disponibili provengono dal Red Flag Manager MSD. Questa vista è in sola lettura.</p></div>
    <div class="flag-filter-layout"><div class="viewer-card"><h3>1 · Elemento</h3><label class="viewer-label" for="rfCategory">Categoria</label><select id="rfCategory"><option value="">Tutte le categorie</option><option value="__general__" ${state.flagCategory==='__general__'?'selected':''}>Generali · senza elemento</option>${categoryOptions}</select>
      <label class="viewer-label" for="rfElement">Elemento</label><select id="rfElement" ${elements.length?'':'disabled'}><option value="">Tutti gli elementi</option>${elementOptions}</select></div>
      <div class="viewer-card"><h3>2 · Data o intervallo</h3><div class="month-toolbar"><button type="button" data-flag-month-step="-1" aria-label="Mese precedente">‹</button><strong>${safe(monthLabel(month))}</strong><button type="button" data-flag-month-step="1" aria-label="Mese successivo">›</button><input id="rfMonthInput" type="month" value="${month}" aria-label="Vai al mese"></div>${grid}
        <div class="date-range"><label>Dal <input id="rfFrom" type="date" value="${safe(state.flagStart)}"></label><label>Al <input id="rfTo" type="date" value="${safe(state.flagEnd)}"></label><button id="rfClearDates" type="button">Azzera</button></div>
        <label class="viewer-label" for="rfCalendar">Contesto calendario</label><select id="rfCalendar"><option value="">Solo Red Flags</option>${calendarOptions}</select></div>
      <div class="viewer-card"><h3>3 · Tipo di Red Flag</h3><select id="rfType" size="7" aria-label="Tipo di Red Flag"><option value="" ${!state.flagName?'selected':''}>Tutti i tipi</option>${typeOptions}</select><p class="viewer-hint">Tipi definiti nel file MSD; nessuna modifica viene salvata.</p></div></div>
    <div class="viewer-card flag-results"><div class="results-heading"><h3>Red Flags nel file</h3><span>${filtered.length} di ${project.redFlags.length} voci</span></div>
      <div class="flag-table-wrap"><table class="flag-table"><thead><tr><th>Data</th><th>Categoria</th><th>Elemento</th><th>Tipo</th><th>Nota</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="no-results">Nessuna Red Flag per questi filtri.</td></tr>'}</tbody></table></div></div>
    ${selected?`<div class="viewer-card flag-detail"><div><span class="detail-kicker">RED FLAG SELEZIONATA</span><h3>${safe(selected.name||'Red Flag')}</h3><p>${shortDate(selected.date)} · ${safe(selected.target.kind==='project'?'Intera giornata':`${selected.target.category}: ${selected.target.element}`)}</p></div><div><strong>Nota</strong><p>${safe(selected.note||'Nessuna nota')}</p><small>DOODStatus: ${safe(selected.doodStatus??'—')}</small></div></div>`:''}`;
}

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
  clearStripSelection();
  const changed=state.project.activeBoard!==e.target.value;
  state.board=e.target.value;state.project.activeBoard=state.board;
  state.calendar=selectedBoard()?.calendarName||state.project.defaultCalendar;
  $('calendarSelect').value=state.calendar;
  state.calendarDate=selectedProductionCalendar()?.scheduleDates.ProductionStartDate?.iso||null;
  state.calendarMonth=state.calendarDate?.slice(0,7)||new Date().toISOString().slice(0,7);
  state.printHeader=selectedBoard()?.attributes?.HideStripBoardHeader!=='1';syncPrintOptions();
  if(changed)edited();else render();
});
$('newBoardButton').addEventListener('click',()=>{
  $('newBoardName').value=`${state.board} copia`;$('newBoardDialog').showModal();$('newBoardName').focus();$('newBoardName').select();
});
$('newBoardForm').addEventListener('submit',event=>{
  event.preventDefault();
  if(event.submitter?.value!=='create'){$('newBoardDialog').close();return}
  try{
    const board=createStripboard(state.project,{name:$('newBoardName').value,sourceBoardName:state.board});
    clearStripSelection();
    state.board=board.name;state.calendar=board.calendarName;state.printHeader=board.attributes.HideStripBoardHeader!=='1';
    $('calendarSelect').value=state.calendar;syncPrintOptions();refreshBoardOptions();showStatus('');$('newBoardDialog').close();setMode('board');edited();
  }catch(error){showStatus(error.message)}
});
const isMac=/Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform||navigator.platform||'');
function isToggleGesture(event){return isMac?event.metaKey:event.ctrlKey}
const stripInteractionControls='button,a,input,select,textarea,label,dialog,[contenteditable]:not([contenteditable="false"]),[role="button"]:not(.strip-outer)';
function isEmptyBoardPoint(event){
  const view=$('boardView');
  if(state.mode!=='board'||event.target.closest(`.strip-outer,${stripInteractionControls}`))return false;
  // Blank space throughout the page dismisses selection; controls keep their own interactions.
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
  if(state.mode!=='board'||event.button!==0||stripPointer||event.target.closest(stripInteractionControls))return;
  const outer=$('boardView').contains(event.target)?event.target.closest('.strip-outer[data-strip-index]'):null;
  const empty=!outer&&isEmptyBoardPoint(event);
  if(!outer&&!empty)return;
  const from=outer&&movePositionFrom(outer);
  stripPointer={pointerId:event.pointerId,pointerType:event.pointerType,outer,empty,
    key:outer&&itemKey(outer),from,fromKind:outer&&(outer.dataset.itemKind||stripAt(from)?.kind),
    wasSelected:!!outer&&state.selectedStripIds.has(itemKey(outer)),
    toggle:isToggleGesture(event),range:event.shiftKey,startX:event.clientX,startY:event.clientY,active:false,longPress:false,scrolling:false};
  if(event.pointerType==='touch'&&outer){
    const pointer=stripPointer;
    pointer.longPressTimer=setTimeout(()=>{
      if(stripPointer!==pointer||pointer.scrolling)return;
      pointer.longPress=true;pointer.dragStartX=pointer.lastX??pointer.startX;pointer.dragStartY=pointer.lastY??pointer.startY;
      pointer.outer.classList.add('strip-long-press');
      if(!state.selectedStripIds.has(pointer.key))selectItem(pointer.key,{toggle:state.touchMultiSelect,reason:'longpress'});
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
    const [container,index]=$('moveGroup').value.split(':');
    const to={container,groupIndex:Number(index),stripIndex:Number($('movePosition').value)};
    try{applyBoardMove(state.moveIntent,to);showStatus('')}
    catch(error){showStatus(error.message)}
  }
  $('moveDialog').close();state.moveIntent=null;
});
$('moveDialog').addEventListener('close',()=>{state.moveIntent=null});
$('undoMoveButton').addEventListener('click',undoBoardMove);
$('redoMoveButton').addEventListener('click',redoBoardMove);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&state.mode==='board'&&!event.target.closest('dialog')){
    if(stripPointer)endStripDrag(event,true);
    clearStripSelection();
  }
  if((event.metaKey||event.ctrlKey)&&!event.target.closest('input,textarea,[contenteditable="true"]')&&state.mode==='board'){
    const key=event.key.toLowerCase();
    if(key==='z'&&!event.shiftKey&&state.orderHistory.length){event.preventDefault();undoBoardMove()}
    else if(((key==='z'&&event.shiftKey)||key==='y')&&state.redoHistory.length){event.preventDefault();redoBoardMove()}
  }
});
$('saveButton').addEventListener('click',async()=>{
  if(!state.project||state.serializationState==='saving')return;
  const token=beginDocumentSave(state),project=token.project;
  updateDocumentStatus();showStatus('');
  try{
    const isMmsx=project.format==='mmsx',extension=isMmsx?'.mmsx':'.msd';
    const fileName=isMmsx?project.fileName.replace(/\.mmsx$/i,'')+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8)+'.mmsx':project.fileName.replace(/\.msd$/i,'')+'-edited.msd';
    // Open the picker during the user gesture, before asynchronous compression.
    const handle=window.showSaveFilePicker?await window.showSaveFilePicker({suggestedName:fileName,types:[{description:'Movie Magic Scheduling',accept:{'application/octet-stream':[extension]}}]}):null;
    const bytes=isMmsx?await serializeMmsx(project,fileName):serializeMsd(project);
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
window.addEventListener('beforeunload',event=>{if(isDirty()){event.preventDefault();event.returnValue=''}});
$('layoutSelect').addEventListener('change',e=>{state.layout=e.target.value;state.allReport=false;render()});
$('calendarSelect').addEventListener('change',e=>{
  state.calendar=e.target.value;
  state.calendarDate=selectedProductionCalendar()?.scheduleDates.ProductionStartDate?.iso||null;
  state.calendarMonth=state.calendarDate?.slice(0,7)||new Date().toISOString().slice(0,7);
  render();
});
$('boardNav').addEventListener('click',()=>setMode('board'));
$('reportNav').addEventListener('click',()=>setMode('report'));
$('calendarNav').addEventListener('click',()=>setMode('calendar'));
$('redFlagNav').addEventListener('click',()=>setMode('redflags'));
$('calendarView').addEventListener('click',event=>{
  const go=event.target.closest('[data-go-date]');
  if(go){state.calendarDate=go.dataset.goDate;state.calendarMonth=state.calendarDate.slice(0,7);render();return}
  const calendar=event.target.closest('[data-calendar-name]');
  if(calendar){state.calendar=calendar.dataset.calendarName;$('calendarSelect').value=state.calendar;
    state.calendarDate=selectedProductionCalendar()?.scheduleDates.ProductionStartDate?.iso||null;
    state.calendarMonth=state.calendarDate?.slice(0,7)||new Date().toISOString().slice(0,7);render();return}
  const step=event.target.closest('[data-month-step]');
  if(step){state.calendarMonth=monthShift(state.calendarMonth,Number(step.dataset.monthStep));state.calendarDate=`${state.calendarMonth}-01`;render();return}
  const date=event.target.closest('[data-date]');
  if(date){state.calendarDate=date.dataset.date;render()}
});
$('calendarView').addEventListener('change',event=>{
  if(event.target.id==='calendarMonthInput'&&/^\d{4}-\d{2}$/.test(event.target.value)){
    state.calendarMonth=event.target.value;state.calendarDate=`${state.calendarMonth}-01`;render();
  }
});
$('redFlagView').addEventListener('click',event=>{
  const step=event.target.closest('[data-flag-month-step]');
  if(step){state.flagMonth=monthShift(state.flagMonth,Number(step.dataset.flagMonthStep));render();return}
  const date=event.target.closest('[data-date]');
  if(date){state.flagStart=date.dataset.date;state.flagEnd=date.dataset.date;render();return}
  if(event.target.closest('#rfClearDates')){state.flagStart='';state.flagEnd='';render();return}
  const row=event.target.closest('[data-flag-id]');
  if(row){state.flagSelectedId=row.dataset.flagId;render()}
});
$('redFlagView').addEventListener('keydown',event=>{
  if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-flag-id]')){
    event.preventDefault();state.flagSelectedId=event.target.dataset.flagId;render();
  }
});
$('redFlagView').addEventListener('change',event=>{
  const {id,value}=event.target;
  if(id==='rfCategory'){state.flagCategory=value;state.flagElement=''}
  else if(id==='rfElement')state.flagElement=value;
  else if(id==='rfType')state.flagName=value;
  else if(id==='rfFrom'){state.flagStart=value;if(value)state.flagMonth=value.slice(0,7)}
  else if(id==='rfTo'){state.flagEnd=value;if(value)state.flagMonth=value.slice(0,7)}
  else if(id==='rfCalendar')state.flagCalendar=value;
  else if(id==='rfMonthInput'&&/^\d{4}-\d{2}$/.test(value))state.flagMonth=value;
  else return;
  render();
});
$('search').addEventListener('input',e=>{clearStripSelection();state.query=e.target.value;render()});
$('toggleUnscheduled').addEventListener('click',()=>{clearStripSelection();state.unscheduled=!state.unscheduled;$('toggleUnscheduled').classList.toggle('selected',state.unscheduled);render()});
$('showColors').addEventListener('change',e=>{state.showColors=e.target.checked;render()});
$('hideBanners').addEventListener('change',e=>{state.hideBanners=e.target.checked;render()});
$('hideDayBreaks').addEventListener('change',e=>{state.hideDayBreaks=e.target.checked;render()});
$('printHeader').addEventListener('change',e=>{state.printHeader=e.target.checked;syncPrintOptions()});
$('reportSeparateRecords').addEventListener('change',e=>{
  state.reportOptions.set(state.layout,{...state.reportOptions.get(state.layout),SeparateRecordsWithALine:e.target.checked});render();
});
$('printButton').addEventListener('click',()=>{
  if(state.mode==='report'&&!state.allReport){state.allReport=true;renderReport(selectedBoard(),selectedLayout())}
  requestAnimationFrame(()=>window.print());
});
new ResizeObserver(fitBoardPreview).observe($('boardView'));
$('fileInput').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(isDirty()&&!window.confirm('Ci sono modifiche non salvate. Importare un altro file?'))return;
    showStatus('');$('projectTitle').textContent='Importazione…';
    if(file.size>64*1024*1024)throw Error('Il file deve essere inferiore a 64 MB');const bytes=await file.arrayBuffer(),data=await parseSchedule(bytes.slice(0),file.name);
    state.importedSource={bytes,name:file.name};
    if(!$('projectSelect').querySelector('[value="imported"]')){$('projectSelect').insertAdjacentHTML('beforeend','<option value="imported">File importato</option>')}
    $('projectSelect').value='imported';setProject(data);state.projectChoice='imported';
  }catch(err){showStatus(err.message);$('projectTitle').textContent='Importazione non riuscita'}finally{e.target.value=''}
});
loadSample('wonderful');
