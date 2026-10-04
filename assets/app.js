import {parseMsd} from './msd-parser.js';
const $ = id => document.getElementById(id);
const SAMPLES={wonderful:'samples/Wonderful Life Demo.msd'};
const state = {project:null, mode:'board', board:null, layout:null, query:'', unscheduled:false, showColors:true, hideBanners:false, hideDayBreaks:false, allReport:false, imported:null, printPageBreaks:false, printHeader:true};
const SCREEN_PX_PER_INCH=76;
const PRINT_PX_PER_INCH=96;
const collator = new Intl.Collator('it',{numeric:true,sensitivity:'base'});
const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : 'Senza data';
const shortDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'}) : '—';
const pages = n => n == null ? '—' : (Math.floor(n/8) ? `${Math.floor(n/8)}${n%8 ? ' '+n%8+'/8' : ''}` : `${n}/8`);
const rect = s => (s.a.BoundingRect||'').split(',').map(Number);
const safe = v => String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const sceneIndex = () => new Map(state.project.scenes.map(s=>[s.bdsId,s]));
const selectedBoard = () => state.project.boards.find(b=>b.name===state.board) || state.project.boards[0];
const selectedLayout = () => (state.mode==='board'?state.project.stripLayouts:state.project.reportLayouts).find(l=>l.name===state.layout);
const groups = b => [...(b?.scheduledGroups||[]),...(state.unscheduled?b?.unscheduledGroups||[]:[])];
const sceneList = b => groups(b).flatMap(g=>g.strips.filter(x=>x.kind==='scene').map(x=>state.sceneMap.get(x.bdsId)).filter(Boolean));
const searchText = (s,x) => [s?.scene,s?.set,s?.location,s?.synopsis,s?.scriptDay,x?.text].join(' ').toLocaleLowerCase();

function showStatus(message){$('status').textContent=message;$('status').hidden=!message;}
async function loadSample(id){
  showStatus('');$('projectTitle').textContent='Caricamento…';
  try {const source=SAMPLES[id];if(!source)throw Error('Progetto non trovato');const response=await fetch(encodeURI(source));
    if(!response.ok)throw Error(response.status===404?'Campione non disponibile: importa un file .msd dal tuo computer.':'Impossibile leggere il file MSD di esempio');
    setProject(await parseMsd(await response.arrayBuffer(),source.split('/').at(-1)))}
  catch(e){showStatus(e.message);$('projectTitle').textContent=state.project?.title||'Importa un progetto .msd'}
}
function setProject(data){
  state.project=data;state.sceneMap=sceneIndex();state.elementIds=new Map(data.elements.map(e=>[`${e.category}\u0000${e.name}`,e.boardId]));state.board=data.boards.some(b=>b.name===data.activeBoard)?data.activeBoard:data.boards[0]?.name;
  state.unscheduled=false;state.allReport=false;state.query='';$('search').value='';
  state.hideBanners=false;state.hideDayBreaks=false;$('hideBanners').checked=false;$('hideDayBreaks').checked=false;
  state.printPageBreaks=false;state.printHeader=selectedBoard()?.attributes?.HideStripBoardHeader!=='1';syncPrintOptions();
  $('sideProject').textContent=data.title;$('projectTitle').textContent=data.title;
  $('projectSubtitle').textContent=`${data.fileName} · ${data.counts.scenes} scene · ${data.boards.length} piani disponibili`;
  $('boardCount').textContent=data.boards.length;$('reportCount').textContent=data.reportLayouts.length;
  $('boardSelect').innerHTML=data.boards.map(b=>`<option value="${safe(b.name)}">${safe(b.name)}</option>`).join('');$('boardSelect').value=state.board;
  $('toggleUnscheduled').classList.remove('selected');$('toggleUnscheduled').textContent='Visualizza Boneyard';
  showStatus('');setMode(state.mode);
}
function setMode(mode){
  state.mode=mode;$('boardNav').classList.toggle('active',mode==='board');$('reportNav').classList.toggle('active',mode==='report');
  $('crumb').textContent=mode==='board'?'STRIPBOARD':'REPORT';$('layoutLabel').textContent=mode==='board'?'LAYOUT STRIPBOARD':'MODELLO REPORT';
  $('sectionKicker').textContent=mode==='board'?'PIANO DI LAVORAZIONE':'ANTEPRIMA REPORT';
  $('search').placeholder=mode==='board'?'Cerca scena, set, testo…':'Cerca nei dati del report…';
  $('toggleUnscheduled').style.display=mode==='board'?'':'none';
  $('colorSwitch').style.display=mode==='board'?'':'none';
  $('printOptions').hidden=mode!=='board';
  const layouts=mode==='board'?state.project?.stripLayouts:state.project?.reportLayouts;
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
  const board=selectedBoard(),layout=selectedLayout();if(!board||!layout)return;
  $('boardView').hidden=state.mode!=='board';$('reportView').hidden=state.mode!=='report';
  $('viewTitle').textContent=state.mode==='board'?board.name:layout.name;
  $('viewSubtitle').textContent=state.mode==='board'?`Calendario: ${board.calendarName} · Layout: ${layout.name}`:`${layout.sourceType==='BY_CATEGORY'?'Per categoria':'Da stripboard'} · ${layout.recordType==='SCHEDULE_DAY'?'per giornata':layout.recordType==='BY_CATEGORY'?'per elemento':'per scena'}`;
  renderStats(board);
  if(state.mode==='board'){renderBoard(board,layout);applyPrintLayout(layout)}else{const style=$('printLayoutStyle');if(style)style.textContent='';renderReport(board,layout)}
}
function renderStats(board){
  const dated=board.scheduledGroups.filter(g=>g.kind==='ScheduleDay');
  const used=board.scheduledGroups.flatMap(g=>g.strips).filter(s=>s.kind==='scene').length;
  const vals=[['GIORNI DI RIPRESE',dated.length],['SCENE IN PIANO',used],['PRIMO GIORNO',shortDate(board.dateAudit.firstDate)],['ULTIMO GIORNO',shortDate(board.dateAudit.lastDate)]];
  $('stats').innerHTML=vals.map(([label,value])=>`<div class="stat"><div class="label">${label}</div><div class="value ${String(value).length>10?'small':''}">${safe(value)}</div></div>`).join('');
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
  if(shape.tag==='FunctionField')return a.Function==='PAGE_NUMBER'?'1':a.Function==='CURRENT_DATE'?new Date().toLocaleDateString('it-IT'):'';
  if(shape.tag==='BDSCategoryElementsField'||shape.tag==='BDSCategoryElementsTableField'){
    const cats=shape.categories?.length?shape.categories:a.CategoryName?[a.CategoryName]:[];
    return contextRequirements(ctx,cats).join(' · ');
  }
  if(shape.tag==='BDSCategoryElementsOccurrenceCountField'){
    const cats=shape.categories?.length?shape.categories:a.CategoryName?[a.CategoryName]:[];
    const count=contextRequirements(ctx,cats).length;
    if(!count&&a.Suppress==='1')return '';
    const label=a.Text || (a.Type==='2'?a.CategoryName||'':'');
    return a.Type==='1'?String(count):`${label}${label&&!/\s$/.test(label)?' ':''}${count}`;
  }
  if(shape.tag==='BDSElementsIDListField'){
    const names=contextRequirements(ctx,[a.CategoryName]);
    return names.map(n=>state.elementIds.get(`${a.CategoryName}\u0000${n}`)||n).join(', ');
  }
  if(shape.tag==='BDSRedFlagField')return '';
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
    if(e){if(/board id.*element name/i.test(property))return [e.boardId,e.name].filter(Boolean).join(' · ');if(/element name/i.test(property))return e.name;return e.properties?.[property]||''}
    return contextRequirements(ctx,[a.Category]).join(' · ');
  }
  if(shape.tag==='BDSField'){
    const f=(a.FieldName||'').toUpperCase().replaceAll(' ','_');
    const map={SCENES:'scene',SCENE:'scene',SHEET_NUMBER:'sheetNumber',SYNOPSIS:'synopsis',SEQUENCE:'sequence',IE:'ie',DN:'dn',SET:'set',LOCATION:'location',SCRIPT_DAY:'scriptDay',SCRIPT_PAGE_NUMBERS:'scriptPageNumbers',UNIT:'unit',ESTIMATE_TIME_A:'estimateTimeA',ESTIMATE_TIME_B:'estimateTimeB',COMMENTS:'comments'};
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
    const div=document.createElement('div');div.className=baseClass;
    const a=s.a;const value=fieldValue(s,ctx);div.textContent=value;
    if(!value)div.classList.add('muted');
    if(a.TextJustification==='CENTER')div.classList.add('center');if(a.TextJustification==='RIGHT')div.classList.add('right');
    if(a.WrapText==='1'||s.tag==='BDSCategoryElementsField'||s.tag==='BDSElementsIDListField')div.classList.add('multiline');
    div.style.left=((r[0]-geo.minX)*scale)+'px';div.style.top=((r[1]-geo.minY)*scale)+'px';
    div.style.width=Math.max(5,r[2]*scale)+'px';div.style.height=Math.max(8,r[3]*scale)+'px';
    div.style.fontSize=Math.max(7,Math.min(13,(Number(s.font.Size)||9)*.85))+'px';
    if(Number(s.font.Style)&1)div.style.fontWeight='700';
    if(a.TextOrientation?.startsWith('VERTICAL')){div.style.writingMode='vertical-rl';if(a.TextOrientation==='VERTICAL_BOTTOM_TO_TOP')div.style.transform='rotate(180deg)'}
    if(a.Borders&&a.Borders!=='0')div.style.border='1px solid #aab8bf';
    div.title=value||a.FieldName||s.tag;frag.appendChild(div);
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
  const colors=state.project.colors||{};
  const row=matchColorIndex(colors.rows,scene.dn),col=matchColorIndex(colors.columns,scene.ie);
  return colors.cells?.[`${row}:${col}`];
}
function makeStrip(scene,layout,metrics){
  const {scale,geo,width,height}=metrics;
  const outer=document.createElement('div');outer.className='strip-outer';
  const strip=document.createElement('div');strip.className='strip-layout';
  strip.style.width=width+'px';strip.style.height=height+'px';
  if(state.showColors){const source=sceneColors(scene);if(source?.bg){strip.style.backgroundColor=source.bg;strip.style.color=source.fg||'#1d2731';strip.classList.add('has-source-color')}}
  strip.appendChild(createShapes(layout.fields,{scene},scale,'strip-field',geo));addLines(strip,layout.fields,geo,scale,'strip-field');
  strip.title=`Scena ${scene.scene||'—'} · ${scene.set||''} · ${scene.synopsis||''}`;
  outer.append(strip);return outer;
}
function makeSpecialStrip(kind,text,layout,metrics,style={}){
  const outer=document.createElement('div');outer.className='strip-outer special-outer';
  const strip=document.createElement('div');strip.className=`strip-layout strip-special ${kind==='banner'?'banner-strip':'day-break-strip'}`;
  strip.style.width=metrics.width+'px';strip.style.height=metrics.height+'px';
  const prefs=state.project.colors?.preferences?.[kind==='banner'?'Banner':'DayStrip'];
  if(state.showColors){
    if(prefs?.bg)strip.style.backgroundColor=prefs.bg;
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
function renderBoard(board,layout){
  const view=$('boardView');view.replaceChildren();const q=state.query.trim().toLocaleLowerCase();
  const vertical=layout.orientation==='VERTICAL';
  view.classList.toggle('is-vertical',vertical);
  const metrics=stripMetrics(layout);
  const printHeading=document.createElement('div');printHeading.className='print-heading';
  printHeading.textContent=`${state.project.title} · ${board.name}`;
  if(layout.header.length)printHeading.append(stripboardHeader(layout.header,metrics));
  view.append(printHeading);
  let shown=0;
  const visibleGroups=groups(board).filter(group=>groupMatches(group,q));
  for(const [index,group] of visibleGroups.entries()){
    const day=document.createElement('section');day.className='day';
    if(state.printPageBreaks&&group.kind==='ScheduleDay'&&index<visibleGroups.length-1)day.classList.add('print-page-break');
    day.setAttribute('aria-label',group.kind==='ScheduleDay'?`Giorno ${group.ordinal}, ${fmtDate(group.date)}`:group.kind);
    const wrap=document.createElement('div');wrap.className=vertical?'vertical-grid':'strips';
    for(const item of group.strips){
      const scene=state.sceneMap.get(item.bdsId);
      if(q&&!searchText(scene,item).includes(q))continue;
      if(item.kind==='scene'&&scene)wrap.append(makeStrip(scene,layout,metrics));
      else if(item.kind==='banner'&&!state.hideBanners)wrap.append(makeSpecialStrip('banner',formatTemplate(item.text??'',{group,board}),layout,metrics,item.style));
    }
    if(group.kind==='ScheduleDay'&&layout.dayBreakText&&!state.hideDayBreaks){
      const dayPages=group.strips.reduce((sum,x)=>sum+(state.sceneMap.get(x.bdsId)?.pagesEighths||0),0);
      wrap.append(makeSpecialStrip('dayBreak',formatTemplate(layout.dayBreakText,{group,board,dayPages}),layout,metrics));
    }
    if(!wrap.children.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Nessuna strip in questo giorno';wrap.append(empty)}
    day.append(wrap);
    view.append(day);shown++;
  }
  if(!shown){const el=document.createElement('div');el.className='empty';el.textContent='Nessun risultato per questa ricerca.';view.append(el)}
}
function syncPrintOptions(){
  $('printPageBreaks').checked=state.printPageBreaks;$('printHeader').checked=state.printHeader;
  document.body.classList.toggle('print-with-header',state.printHeader);
}
function printSurface(layout){
  const paper=layout.paper||{},format=layout.pageFormat||{};
  const width=Number(paper.Width),height=Number(paper.Height);
  const rect=(paper.PrintableRect||'').split(',').map(Number);
  if(!(width>0&&height>0&&rect.length===4&&rect.every(Number.isFinite)&&rect[2]>0&&rect[3]>0))return null;
  const landscape=/LANDSCAPE/.test(format.Orientation||'');
  if(!landscape)return {width,height,contentWidth:rect[2],contentHeight:rect[3],margins:[rect[1],width-rect[0]-rect[2],height-rect[1]-rect[3],rect[0]]};
  const reverse=format.Orientation==='REVERSE_LANDSCAPE';
  return {width:height,height:width,contentWidth:rect[3],contentHeight:rect[2],margins:reverse?
    [rect[0],rect[1],width-rect[0]-rect[2],height-rect[1]-rect[3]]:
    [width-rect[0]-rect[2],height-rect[1]-rect[3],rect[0],rect[1]]};
}
function applyPrintLayout(layout){
  const surface=printSurface(layout),metrics=stripMetrics(layout);
  const dayWidths=[...$('boardView').querySelectorAll('.vertical-grid')]
    .map(grid=>grid.querySelectorAll('.strip-outer').length*metrics.width);
  const boardWidth=metrics.vertical?Math.max(metrics.width,...dayWidths):metrics.width;
  const available=surface?surface.contentWidth*PRINT_PX_PER_INCH:boardWidth*PRINT_PX_PER_INCH/metrics.scale;
  const heightFit=metrics.vertical&&surface?surface.contentHeight*PRINT_PX_PER_INCH/metrics.height:Infinity;
  const zoom=Math.min(PRINT_PX_PER_INCH/metrics.scale,available/boardWidth,heightFit);
  const style=$('printLayoutStyle')||document.head.appendChild(Object.assign(document.createElement('style'),{id:'printLayoutStyle'}));
  const page=surface?`@page { size: ${surface.width}in ${surface.height}in; margin: ${surface.margins.map(v=>Math.max(0,v)+'in').join(' ')}; }`:'';
  style.textContent=`${page} @media print { #boardView { width: ${boardWidth}px; zoom: ${Math.max(.01,zoom)}; } }`;
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
function reportBlock(shapes,ctx,height,scale,className){
  const geo=geometry(shapes,7.7,Number(height)||0);
  const el=document.createElement('div');el.className='report-block '+className;
  el.style.width=Math.max(580,(geo.maxX-geo.minX)*scale)+'px';el.style.height=Math.max(className==='header-block'?48:32,(geo.maxY-geo.minY)*scale)+'px';
  el.appendChild(createShapes(shapes,ctx,scale,'report-shape',geo));addLines(el,shapes,geo,scale,'report-shape');return el;
}
function renderReport(board,layout){
  const view=$('reportView');view.replaceChildren();state.elementIds=new Map(state.project.elements.map(e=>[`${e.category}\u0000${e.name}`,e.boardId]));
  const all=reportRecords(board,layout);const q=state.query.trim().toLocaleLowerCase();
  const records=q?all.filter(x=>searchText(x.scene,{text:[x.element?.name,x.element?.category,x.inlineText].filter(Boolean).join(' ')}).includes(q)):all;
  const intro=document.createElement('div');intro.className='report-intro';intro.innerHTML=`<span class="pill">${safe(layout.recordType||'REPORT')}</span><span>${records.length} record · ${safe(layout.name)}</span>`;view.append(intro);
  const paper=document.createElement('div');paper.className='paper';const scale=78;
  if(layout.header.length)paper.append(reportBlock(layout.header,{group:null,scene:null},layout.headerHeight,scale,'header-block'));
  const show=state.allReport?records:records.slice(0,12);
  for(const ctx of show){
    if(ctx.inlineText){const el=document.createElement('div');el.className=`report-inline report-inline-${ctx.inlineKind}`;el.textContent=ctx.inlineText;paper.append(el);continue}
    paper.append(reportBlock(layout.record,ctx,layout.recordHeight,scale,'record-block'));
  }
  if(layout.footer.length)paper.append(reportBlock(layout.footer,{},layout.footerHeight,scale,'footer-block'));
  view.append(paper);
  if(records.length>12&&!state.allReport){const more=document.createElement('button');more.className='report-more';more.textContent=`Mostra tutti i ${records.length} record`;more.onclick=()=>{state.allReport=true;renderReport(board,layout)};view.append(more)}
  const note=document.createElement('div');note.className='report-notice';note.textContent='Anteprima dei campi del modello .msd. Alcune formule e regole di impaginazione di Movie Magic non sono disponibili.';view.append(note);
}

$('projectSelect').addEventListener('change',e=>{if(e.target.value==='imported'&&state.imported)setProject(state.imported);else loadSample(e.target.value)});
$('boardSelect').addEventListener('change',e=>{state.board=e.target.value;state.printHeader=selectedBoard()?.attributes?.HideStripBoardHeader!=='1';syncPrintOptions();render()});
$('layoutSelect').addEventListener('change',e=>{state.layout=e.target.value;state.allReport=false;render()});
$('boardNav').addEventListener('click',()=>setMode('board'));
$('reportNav').addEventListener('click',()=>setMode('report'));
$('search').addEventListener('input',e=>{state.query=e.target.value;render()});
$('toggleUnscheduled').addEventListener('click',()=>{state.unscheduled=!state.unscheduled;$('toggleUnscheduled').classList.toggle('selected',state.unscheduled);render()});
$('showColors').addEventListener('change',e=>{state.showColors=e.target.checked;render()});
$('hideBanners').addEventListener('change',e=>{state.hideBanners=e.target.checked;render()});
$('hideDayBreaks').addEventListener('change',e=>{state.hideDayBreaks=e.target.checked;render()});
$('printPageBreaks').addEventListener('change',e=>{state.printPageBreaks=e.target.checked;render()});
$('printHeader').addEventListener('change',e=>{state.printHeader=e.target.checked;syncPrintOptions()});
$('printButton').addEventListener('click',()=>{
  if(state.mode==='report'&&!state.allReport){state.allReport=true;renderReport(selectedBoard(),selectedLayout())}
  requestAnimationFrame(()=>window.print());
});
$('fileInput').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;showStatus('');$('projectTitle').textContent='Importazione…';
  try{if(file.size>20*1024*1024)throw Error('Il file deve essere inferiore a 20 MB');const data=await parseMsd(await file.arrayBuffer(),file.name);state.imported=data;
    if(!$('projectSelect').querySelector('[value="imported"]')){$('projectSelect').insertAdjacentHTML('beforeend','<option value="imported">File importato</option>')}
    $('projectSelect').value='imported';setProject(data);
  }catch(err){showStatus(err.message);$('projectTitle').textContent='Importazione non riuscita'}finally{e.target.value=''}
});
loadSample('wonderful');
