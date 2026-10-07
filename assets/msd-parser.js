import {completeProjectModel} from './project-model.js';
/* Movie Magic Scheduling 6 importer. Keeps the original EPSF bytes for conservative writes. */
import {calendarDate,calendarDatesBetween,shootingDatesForCalendar} from './production-data.js';
import {boardSignature} from './scheduling.js';
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true});
const FILE_MAGIC='/********* EPSF FILE ********/ ';
const SECTION_MAGIC='/********* EPSF SECTION *********/ ';
const MAP_MAGIC='/********* EPSF SECTION MAP *********/ ';
const MAX_FILE=128*1024*1024,MAX_XML=32*1024*1024,MAX_TOTAL_XML=128*1024*1024;
const textBytes=value=>encoder.encode(value);
function sameBytes(data,offset,expected){return expected.every((byte,index)=>data[offset+index]===byte)}
function cstring(data){const end=data.indexOf(0);return decoder.decode(end<0?data:data.subarray(0,end))}
function children(node,name){if(!node)return [];const list=[...node.children];return name==null?list:list.filter(child=>child.tagName===name)}
function path(node,names){return names.reduce((current,name)=>children(current,name)[0]||null,node)}
function paths(node,names){const parent=path(node,names.slice(0,-1));return children(parent,names.at(-1))}
function attr(node,name){return node?.getAttribute(name)??null}
function attrs(node){return node?Object.fromEntries([...node.attributes].map(a=>[a.name,a.value])):{}}
function rawNode(node){return node?{tag:node.tagName,attributes:attrs(node),text:node.firstChild?.nodeType===3?node.firstChild.nodeValue:null,
  children:children(node).map(rawNode)}:null}
function parseXml(source){
  if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(source))throw Error('DTD/entities are unsupported');
  const doc=new DOMParser().parseFromString(source,'application/xml');
  if(doc.querySelector('parsererror'))throw Error('Invalid XML section');
  const root=doc.documentElement;
  if(!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(root.tagName))throw Error('Unsupported XML root');
  return root;
}
async function inflateRaw(data){
  if(typeof DecompressionStream==='undefined')throw Error('Browser senza supporto alla decompressione DEFLATE');
  try{return await readCompressed(data,'deflate-raw')}
  catch(error){throw Error(`Impossibile decomprimere la sezione MSD: ${error.message}`)}
}
async function readCompressed(data,format){
  const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream(format));
  const chunks=[];let total=0;const reader=stream.getReader();
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_XML){await reader.cancel();throw Error('Oversized XML section')}chunks.push(value)}
  const output=new Uint8Array(total);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length}return output;
}
async function readContainer(buffer,fileName){
  const data=new Uint8Array(buffer);const view=new DataView(buffer);
  if(data.length>MAX_FILE)throw Error('File MSD troppo grande');
  if(data.length<716||!sameBytes(data,0,textBytes(FILE_MAGIC)))throw Error('Not a supported EPSF file');
  const mapOffset=view.getUint32(260),count=view.getUint32(264);
  if(!(count>0&&count<=1024&&mapOffset>=716&&mapOffset+count*332===data.length))throw Error('Invalid EPSF section map bounds');
  const scheduleVersion=cstring(data.subarray(192,256));
  if(cstring(data.subarray(64,128))!=='00.01.001'||!['06.00.000','04.00.000'].includes(scheduleVersion))throw Error('Unsupported EPSF or schedule version');
  if(scheduleVersion==='04.00.000'&&(count!==11||cstring(data.subarray(268,332))!=='MMB10'))throw Error('Unsupported MSD 04 variant');
  const roots={},sourceXmlSections={},sectionRecords=[];let expected=716,totalXml=0;
  const mapMagic=textBytes(MAP_MAGIC),sectionMagic=textBytes(SECTION_MAGIC);
  for(let index=0;index<count;index++){
    const entry=mapOffset+index*332;
    if(!sameBytes(data,entry,mapMagic)||data.subarray(entry+mapMagic.length,entry+68).some(Boolean))throw Error('Invalid section map record marker');
    const offset=view.getUint32(entry+68),length=view.getUint32(entry+72);
    if(offset!==expected||length<=68||offset+length>mapOffset)throw Error('Invalid section bounds');
    expected=offset+length;
    if(!sameBytes(data,offset,sectionMagic)||data.subarray(offset+sectionMagic.length,offset+67).some(Boolean)||data[offset+67]!==1)throw Error('Unsupported section compression header');
    const raw=await inflateRaw(data.subarray(offset+68,offset+length));
    totalXml+=raw.length;if(totalXml>MAX_TOTAL_XML)throw Error('Total XML size limit exceeded');
    const xml=decoder.decode(raw[0]===0xef&&raw[1]===0xbb&&raw[2]===0xbf?raw.subarray(3):raw);
    const root=parseXml(xml);if(roots[root.tagName])throw Error('Duplicate XML root');
    roots[root.tagName]=root;sourceXmlSections[root.tagName]=xml;
    sectionRecords.push({root:root.tagName,index,offset,length,mapOffset:entry});
  }
  if(expected!==mapOffset)throw Error('Gap before section map');
  return {roots,sourceXmlSections,fileName,sourceDocument:{bytes:buffer.slice(0),sections:sectionRecords,scheduleVersion}};
}
function isoDate(raw){
  const match=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw||'');if(!match)return null;
  const [,m,d,y]=match.map(Number),date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.toISOString().slice(0,10):null;
}
function calendar(node){
  const scheduleDates={};for(const item of paths(node,['ScheduleDates','ScheduleDate'])){
    const name=attr(item,'Name');if(name in scheduleDates)throw Error(`Duplicate schedule date: ${name}`);
    const raw=attr(item,'Date');scheduleDates[name]={raw,iso:isoDate(raw),attributes:attrs(item)};
  }
  const result={name:attr(node,'Name'),attributes:attrs(node),scheduleDates,daysOff:attrs(path(node,['DaysOff'])),
    specialDays:paths(node,['SpecialDays','SpecialDay']).map(item=>({date:isoDate(attr(item,'Date')),rawDate:attr(item,'Date'),attributes:attrs(item)})),
    source:rawNode(node),dates:[]};
  const bounds=Object.values(scheduleDates).map(item=>item.iso).filter(Boolean).sort();
  if(bounds.length)result.dates=calendarDatesBetween(result,bounds[0],bounds.at(-1));
  return result;
}
function rgbColor(value){
  const parts=(value||'').split(',').map(Number);
  return parts.length===3&&parts.every(x=>Number.isInteger(x)&&x>=0&&x<=255)?'#'+parts.map(x=>x.toString(16).padStart(2,'0')).join(''):null;
}
function shapes(section){
  const parent=path(section,['Layout','Shapes']);
  return parent?[...parent.children].map(node=>({tag:node.tagName,a:attrs(node),font:attrs(path(node,['Font'])),
    categories:children(node,'CategoryRef').map(x=>attr(x,'CategoryName'))})):[];
}
function parseLayouts(root,kind){
  if(!root)return [];
  if(kind==='strip')return paths(root,['StripBoardLayouts','StripBoardLayout']).map(node=>({
    name:attr(node,'Name'),orientation:attr(node,'StripOrientation')||'HORIZONTAL',
    length:attr(node,'StripLength'),width:attr(node,'StripWidth'),attributes:attrs(node),
    pageFormat:attrs(path(node,['PageFormat'])),paper:attrs(path(node,['PageFormat','Paper'])),
    fields:shapes(path(node,['BDSStripLayout'])),header:shapes(path(node,['StripBoardHeaderLayout'])),
    headerLayout:attrs(path(node,['StripBoardHeaderLayout'])),
    dayBreakText:attr(path(node,['DayBreakStripLayout']),'DayBreakText')||'',
    dayBreakLayout:attrs(path(node,['DayBreakStripLayout'])),stripLayout:attrs(path(node,['BDSStripLayout'])),
    textStyles:Object.fromEntries(children(path(node,['TextStyles'])).map(x=>[x.tagName,attrs(x)])),
    bannerStyle:attrs(path(node,['TextStyles','BANNER'])),dayBreakStyle:attrs(path(node,['TextStyles','DAY_BREAK']))
  }));
  return paths(root,['ReportLayouts','ReportLayout']).map(node=>({
    name:attr(node,'Name'),sourceType:attr(node,'ReportSourceType'),recordType:attr(node,'ReportRecordType'),
    settings:attrs(path(node,['ReportSettings'])),dayBreakText:attrs(path(node,['ReportSettings','DayBreakText'])),
    paper:attrs(path(node,['PageFormat','Paper'])),header:shapes(path(node,['PageHeaderLayout'])),
    record:shapes(path(node,['ReportRecordLayout'])),footer:shapes(path(node,['PageFooterLayout'])),
    headerHeight:attr(path(node,['PageHeaderLayout']),'Height')||'0',
    recordHeight:attr(path(node,['ReportRecordLayout']),'Height')||'0',
    footerHeight:attr(path(node,['PageFooterLayout']),'Height')||'0',
    criteria:paths(node,['SelectCriteriaList','SelectCriteria']).map(attrs)
  }));
}
function parseColors(root){
  if(!root)return {columns:[],rows:[],cells:{},preferences:{}};
  const columns=Object.fromEntries(paths(root,['ColorGrid','ColumnLabelList','ColumnLabel']).map(x=>[attr(x,'ColumnNumber'),attr(x,'Name')||'']));
  const rows=Object.fromEntries(paths(root,['ColorGrid','RowLabelList','RowLabel']).map(x=>[attr(x,'RowNumber'),attr(x,'Name')||'']));
  const cells=Object.fromEntries(paths(root,['ColorGrid','ColorGridCells','ColorGridCell']).map(x=>[
    `${attr(x,'RowNumber')}:${attr(x,'ColumnNumber')}`,{fg:rgbColor(attr(x,'Fg')),bg:rgbColor(attr(x,'Bg'))}]));
  const preferences=Object.fromEntries(paths(root,['StripColorPreferences','StripColorPreference']).map(x=>[
    attr(x,'Name'),{fg:rgbColor(attr(x,'Fg')),bg:rgbColor(attr(x,'Bg'))}]));
  return {columns,rows,cells,preferences};
}
function compactStrip(node){
  const kind=node.tagName==='BDSStrip'?'scene':node.tagName==='BannerStrip'?'banner':'unknown';
  const strip={kind,bdsId:kind==='scene'?attr(node,'BDSID'):null,text:kind==='banner'?attr(node,'Text'):null};
  if(kind==='banner'){
    const attributes=attrs(node);
    strip.attributes=attributes;strip.style={fontColor:rgbColor(attributes.FontColor),fontSize:attributes.FontSize??null,
      fontStyle:attributes.FontStyle??null,fontName:attributes.FontName??null,customized:attributes.IsCustomized==='1'};
  }
  return strip;
}
function issue(issues,code){issues[code]=(issues[code]||0)+1}
function unique(values,key,label){
  const result=new Map();for(const value of values){const id=key(value);if(result.has(id))throw Error(`Ambiguous duplicate ${label}: ${id}`);result.set(id,value)}
  return result;
}
function parseRedFlags(root,elementIndex,issues){
  const list=path(root,['RedFlagEntryList']);
  const names=paths(root,['RedFlagNameList','Name']).map(item=>({name:attr(item,'Name'),sortOrder:attr(item,'SortOrder'),attributes:attrs(item),source:rawNode(item)}));
  const entries=children(list,'RedFlagEntry').map((node,index)=>{
    const attributes=attrs(node),category=attr(node,'Category'),element=attr(node,'Element');
    const hasTarget=Boolean(category||element),target=hasTarget?
      {kind:category&&element?'element':'unresolved',category,element}:
      {kind:'project',category:null,element:null};
    const targetResolved=target.kind==='element'?elementIndex.has(JSON.stringify([category,element])):target.kind==='project';
    if(!targetResolved)issue(issues,'MISSING_REDFLAG_ELEMENT');
    return {id:`red-flag-${index+1}`,sourceId:attr(node,'ID'),identitySource:attr(node,'ID')?'msd-id':'entry-order',
      sourceOrder:index,name:attr(node,'Name'),note:attr(node,'Note'),date:isoDate(attr(node,'Date')),
      rawDate:attr(node,'Date'),target,targetResolved,doodStatus:attr(node,'DOODStatus'),
      attributes,source:rawNode(node)};
  });
  return {entries,names,settings:{manager:attrs(root),list:attrs(list)},source:rawNode(root)};
}
function buildProject(container){
  const {roots,fileName,sourceXmlSections,sourceDocument}=container;
  for(const name of ['CalendarMgr','CategoryMgr','ElementMgr','BreakdownSheetMgr','StripBoardMgr']){
    if(!roots[name])throw Error(`Missing required manager section: ${name}`);
  }
  const issues={};
  const categorySettings=paths(roots.CategoryMgr,['CategoryList','Category']).map(x=>({name:attr(x,'Name'),attributes:attrs(x)}));
  const categories=categorySettings.map(x=>x.name);
  const categorySet=new Set(categories);
  const elements=paths(roots.ElementMgr,['Elements','Element']).map(node=>{
    const category=attr(node,'CategoryName'),name=attr(node,'Name');
    if(!categorySet.has(category))issue(issues,'MISSING_ELEMENT_CATEGORY');
    return {category,name,boardId:attr(node,'BoardID'),sortOrder:attr(node,'SortOrder'),
      properties:Object.fromEntries(children(node,'Property').map(x=>[attr(x,'Name'),attr(x,'Value')??x.textContent??''])),
      linkedElements:paths(node,['LinkedElements','LinkedElement']).map(x=>[attr(x,'CategoryName'),attr(x,'Name')])};
  });
  const elementIndex=unique(elements,x=>JSON.stringify([x.category,x.name]),'element key');
  let linkedCount=0;for(const element of elements)for(const key of element.linkedElements){
    linkedCount++;if(!elementIndex.has(JSON.stringify(key)))issue(issues,'MISSING_LINKED_ELEMENT');
  }
  const fieldMap={scene:'Scenes',sheetNumber:'SheetNumber',synopsis:'Synopsis',sequence:'Sequence',ie:'IE',dn:'DN',
    set:'Set',location:'Location',scriptDay:'ScriptDay',scriptPageNumbers:'ScriptPageNumbers',unit:'Unit',
    estimateTimeA:'EstimateTimeA',estimateTimeB:'EstimateTimeB',comments:'Comments'};
  let associationCount=0;
  const scenes=paths(roots.BreakdownSheetMgr,['BreakdownSheets','BreakdownSheet']).map(node=>{
    const scene={bdsId:attr(node,'BDSID')};
    for(const [key,name] of Object.entries(fieldMap))scene[key]=attr(node,name);
    const rawPages=attr(node,'NumScriptPages');scene.pagesEighths=/^\d+$/.test(rawPages||'')?Number(rawPages):null;
    if(scene.pagesEighths===null)issue(issues,'UNPARSED_PAGE_COUNT');
    const requirements={};for(const ref of paths(node,['ElementRefs','ElementRef'])){
      associationCount++;const category=attr(ref,'CategoryName'),name=attr(ref,'ElementName');
      (requirements[category]??=[]).push(name);
      if(!elementIndex.has(JSON.stringify([category,name])))issue(issues,'MISSING_SCENE_ELEMENT');
    }
    scene.requirements=requirements;return scene;
  });
  const sceneIndex=unique(scenes,x=>x.bdsId,'BDSID');
  const calendars=paths(roots.CalendarMgr,['Calendars','Calendar']).map(calendar);
  const calendarIndex=unique(calendars,x=>x.name,'calendar');
  const active=attr(paths(roots.StripBoardMgr,['StripBoardMgrPreferences','PropertyList','Property']).find(x=>attr(x,'Name')==='ActiveStripBoard'),'Value');
  const boards=paths(roots.StripBoardMgr,['StripBoards','StripBoard']).map((node,sourceOrder)=>{
    const name=attr(node,'Name'),calendarName=attr(node,'CalendarName'),cal=calendarIndex.get(calendarName);
    if(!cal)issue(issues,'MISSING_BOARD_CALENDAR');
    const dayCount=paths(node,['ScheduledStrips','ScheduleDay']).length,dates=shootingDatesForCalendar(cal,dayCount);
    let ordinal=0;
    const groups=(containerName)=>{
      const parent=path(node,[containerName]);if(!parent){issue(issues,'MISSING_STRIP_CONTAINER');return []}
      return [...parent.children].map((group,groupIndex)=>{
        const kind=group.tagName,date=kind==='ScheduleDay'&&containerName==='ScheduledStrips'?dates[ordinal++]:null;
        if(!['ScheduleDay','RemainingScheduledStrips','UnscheduledDay','RemainingUnscheduledStrips'].includes(kind))issue(issues,'UNKNOWN_STRIP_GROUP');
        const strips=[...group.children].map((stripNode,stripIndex)=>({
          ...compactStrip(stripNode),sourceKey:JSON.stringify([name,containerName,groupIndex,stripIndex])}));
        for(const strip of strips){if(strip.kind==='unknown')issue(issues,'UNKNOWN_STRIP_TYPE')}
        const shootingDayNumber=kind==='ScheduleDay'&&containerName==='ScheduledStrips'?ordinal:null;
        return {kind,sourceIndex:groupIndex,sourceContainer:containerName,ordinal:shootingDayNumber,shootingDayNumber,date,calendarName:shootingDayNumber?calendarName:null,
          attributes:attrs(group),strips};
      });
    };
    const scheduledGroups=groups('ScheduledStrips'),unscheduledGroups=groups('UnscheduledStrips');
    const dayDates=scheduledGroups.filter(g=>g.kind==='ScheduleDay'&&g.date).map(g=>g.date);
    const storedEnd=cal?.scheduleDates.ProductionEndDate?.iso??null;
    if(dayDates.length&&storedEnd&&dayDates.at(-1)!==storedEnd)issue(issues,'STORED_END_DIFFERS_FROM_BOARD');
    const refs=scheduledGroups.concat(unscheduledGroups).flatMap(g=>g.strips).filter(x=>x.kind==='scene').map(x=>x.bdsId);
    const counts={};for(const id of refs)counts[id]=(counts[id]||0)+1;
    if(refs.some(id=>!sceneIndex.has(id)))issue(issues,'DANGLING_BOARD_SCENES');
    if(scenes.some(x=>!counts[x.bdsId]))issue(issues,'SCENES_ABSENT_FROM_BOARD');
    if(Object.values(counts).some(n=>n>1))issue(issues,'REPEATED_BOARD_SCENES');
    return {name,sourceBoardName:name,sourceOrder,identitySource:'Name',description:path(node,['Description'])?.textContent||'',calendarName,attributes:attrs(node),
      scheduledGroups,unscheduledGroups,dateAudit:{method:'successive-workdays-v1',confidence:'inferred',
        firstDate:dayDates[0]??null,lastDate:dayDates.at(-1)??null,storedProductionEndDate:storedEnd,
        lastDateMatchesStoredEnd:dayDates.length&&storedEnd?dayDates.at(-1)===storedEnd:null}};
  });
  unique(boards,x=>x.name,'board');
  if(!boards.some(x=>x.name===active))issue(issues,'MISSING_ACTIVE_BOARD');
  for(const board of boards){
    const cal=calendarIndex.get(board.calendarName);if(!cal)continue;
    for(const [groupIndex,group] of board.scheduledGroups.entries()){
      if(group.kind!=='ScheduleDay'||!group.date)continue;
      let date=cal.dates.find(item=>item.date===group.date);
      if(!date){date=calendarDate(cal,group.date);cal.dates.push(date);cal.dates.sort((a,b)=>a.date.localeCompare(b.date))}
      date.shootingDays.push({boardName:board.name,shootingDayNumber:group.shootingDayNumber,groupIndex,
        dateRelationship:'inferred-successive-working-days'});
    }
  }
  const redFlagData=parseRedFlags(roots.RedFlagMgr,elementIndex,issues),redFlags=redFlagData.entries;
  const defaultCalendar=attr(paths(roots.CalendarMgr,['CalendarMgrPreferences','PropertyList','Property']).find(x=>attr(x,'Name')==='DefaultCalendar'),'Value');
  if(defaultCalendar&&!calendarIndex.has(defaultCalendar))issue(issues,'MISSING_DEFAULT_CALENDAR');
  const production={};for(const child of children(roots.ProductionInfo))for(const prop of children(child,'Property')){
    production[attr(prop,'Name')]=attr(prop,'Value')??prop.textContent??'';
  }
  const project={format:'msd',fileName,title:production.PictureTitle||fileName.replace(/\.msd$/i,''),production,capabilities:{createBoards:true,calendarProjection:true},
    counts:{scenes:scenes.length,elements:elements.length,categories:categories.length,calendars:calendars.length,
      stripboards:boards.length,sceneElementAssociations:associationCount,linkedElements:linkedCount,
      redFlags:redFlags.length,scheduleDays:boards.reduce((n,b)=>n+b.scheduledGroups.filter(g=>g.kind==='ScheduleDay').length,0),
      unscheduledDays:boards.reduce((n,b)=>n+b.unscheduledGroups.filter(g=>g.kind==='UnscheduledDay').length,0)},
    activeBoard:active,defaultCalendar,calendars,calendarManager:{source:rawNode(roots.CalendarMgr)},
    redFlags,redFlagNames:redFlagData.names,redFlagSettings:redFlagData.settings,redFlagManagerSource:redFlagData.source,
    scenes,elements:elements.map(({linkedElements,...rest})=>rest),categorySettings,boards,
    stripLayouts:parseLayouts(roots.StripBoardLayoutMgr,'strip'),reportLayouts:parseLayouts(roots.ReportLayoutMgr,'report'),
    colors:parseColors(roots.ColorSettings),issues,sourceXmlSections,sourceDocument};
  sourceDocument.boardSignature=boardSignature(project);
  return completeProjectModel(project);
}
export async function parseMsd(buffer,fileName='imported.msd'){
  if(!(buffer instanceof ArrayBuffer))throw TypeError('Expected an ArrayBuffer');
  return buildProject(await readContainer(buffer,fileName));
}
