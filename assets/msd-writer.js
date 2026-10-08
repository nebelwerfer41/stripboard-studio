/* Conservative EPSF/MSD writer: patch StripBoardMgr/CalendarMgr only when changed. */
import {boardSignature} from './scheduling.js';
import {calendarsSignature,FLASH_DATE_NS,CALENDAR_DAYS} from './calendar-commands.js';

const encoder=new TextEncoder();
const child=(node,name)=>[...(node?.children||[])].find(item=>item.tagName===name)||null;
const groups=(board,container)=>[...(child(board,container)?.children||[])];

function storedDeflate(bytes){
  const chunks=[];let offset=0;
  do{
    const size=Math.min(65535,bytes.length-offset),last=offset+size===bytes.length;
    const block=new Uint8Array(size+5),inverse=(~size)&65535;
    block[0]=last?1:0;block[1]=size&255;block[2]=size>>>8;
    block[3]=inverse&255;block[4]=inverse>>>8;
    block.set(bytes.subarray(offset,offset+size),5);chunks.push(block);offset+=size;
  }while(offset<bytes.length);
  return concat(chunks);
}

function concat(chunks){
  const result=new Uint8Array(chunks.reduce((size,chunk)=>size+chunk.length,0));
  let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length}return result;
}

function parseSource(xml,rootName='StripBoardMgr'){
  if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml))throw Error('DTD/entities non supportate');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')||doc.documentElement.tagName!==rootName)throw Error(`${rootName} XML non valido`);
  return doc;
}

function sourceStrips(board){
  const result=new Map();
  for(const container of ['ScheduledStrips','UnscheduledStrips']){
    for(const [groupIndex,group] of groups(board,container).entries()){
      for(const [stripIndex,strip] of [...group.children].entries()){
        const key=JSON.stringify([board.getAttribute('Name'),container,groupIndex,stripIndex]);
        result.set(key,strip);
      }
    }
  }
  return result;
}

function patchGroups(node,board,original){
  const sources=sourceStrips(original),used=new Set();
  const usedGroups=new Set();
  for(const [modelName,xmlName] of [['scheduledGroups','ScheduledStrips'],['unscheduledGroups','UnscheduledStrips']]){
    const modelGroups=board[modelName],orderedGroups=[];
    let targetContainer=child(node,xmlName);
    if(!targetContainer){targetContainer=node.ownerDocument.createElement(xmlName);node.appendChild(targetContainer)}
    for(const group of modelGroups){
      const sourceGroup=group.sourceIndex===undefined?null:groups(original,group.sourceContainer||xmlName)[group.sourceIndex];
      const boundary=['ScheduleDay','UnscheduledDay'].includes(group.kind);
      if(sourceGroup&&(usedGroups.has(sourceGroup)||!(group.kind===sourceGroup.tagName||boundary&&['ScheduleDay','UnscheduledDay'].includes(sourceGroup.tagName))))throw Error('Tipo di gruppo MSD modificato');
      if(!sourceGroup&&boundary&&!(group.created===true&&group.id&&group.dateLocked))throw Error('Origine day break MSD mancante');
      if(sourceGroup)usedGroups.add(sourceGroup);
      const target=node.ownerDocument.createElement(group.kind);
      if(sourceGroup)for(const attribute of sourceGroup.attributes)target.setAttribute(attribute.name,attribute.value);
      if(group.kind==='ScheduleDay'&&group.dateLocked){
        target.setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns:flash',FLASH_DATE_NS);
        target.setAttributeNS(FLASH_DATE_NS,'flash:date',group.date??(group.dateOrigin==='unresolved'?group.rawCalendarDate:'')??'');
        target.setAttributeNS(FLASH_DATE_NS,'flash:dateOrigin',group.dateOrigin||'inferred');
      }else{
        target.removeAttributeNS(FLASH_DATE_NS,'date');target.removeAttributeNS(FLASH_DATE_NS,'dateOrigin');
      }
      const desired=group.strips.map(strip=>{
        const key=strip.sourceKey;
        if(!sources.has(key)||used.has(key))throw Error('Riferimento strip mancante o ripetuto');
        used.add(key);return sources.get(key).cloneNode(true);
      });
      if(sourceGroup&&([...sourceGroup.childNodes].some(item=>item.nodeType!==1&&item.nodeType!==3)||
        [...sourceGroup.childNodes].some(item=>item.nodeType===3&&item.nodeValue.trim())))throw Error('Contenuto opaco nel gruppo strip');
      target.replaceChildren(...desired);orderedGroups.push(target);
    }
    let nextGroup=0;
    const children=[...targetContainer.childNodes].flatMap(item=>item.nodeType===1?
      (orderedGroups[nextGroup]?[orderedGroups[nextGroup++]]:[]):[item.cloneNode(true)]);
    targetContainer.replaceChildren(...children,...orderedGroups.slice(nextGroup));
  }
  const originalGroups=[...groups(original,'ScheduledStrips'),...groups(original,'UnscheduledStrips')];
  if(originalGroups.some(group=>!usedGroups.has(group)))throw Error('Un gruppo originale andrebbe perso');
  if(used.size!==sources.size)throw Error('Una o più strip originali andrebbero perse');
}

function patchManager(project){
  const xml=project.sourceXmlSections?.StripBoardMgr;
  if(!xml)throw Error('Sezione StripBoardMgr originale mancante');
  const doc=parseSource(xml),root=doc.documentElement,boardList=child(root,'StripBoards');
  if(!boardList)throw Error('Lista stripboard mancante');
  const originals=new Map([...boardList.children].filter(item=>item.tagName==='StripBoard').map(item=>[item.getAttribute('Name'),item]));
  if(originals.size!==[...boardList.children].filter(item=>item.tagName==='StripBoard').length)throw Error('Nomi stripboard originali duplicati');
  const sourceSnapshots=new Map([...originals].map(([name,node])=>[name,node.cloneNode(true)]));
  const names=new Set();
  for(const board of project.boards){
    if(!board.name||names.has(board.name))throw Error('Nome stripboard mancante o duplicato');
    names.add(board.name);
    const source=sourceSnapshots.get(board.sourceBoardName);
    if(!source)throw Error('Origine della stripboard non trovata');
    let target=originals.get(board.name);
    if(target&&board.sourceBoardName!==board.name)throw Error('Identità della stripboard ambigua');
    const isNew=!target;
    if(isNew)target=source.cloneNode(true);
    for(const [name,value] of Object.entries(board.attributes))target.setAttribute(name,value);
    target.setAttribute('Name',board.name);
    if(isNew||child(target,'Description')?.textContent!==board.description){
      let description=child(target,'Description');
      if(!description){description=doc.createElement('Description');target.insertBefore(description,target.firstChild)}
      description.textContent=board.description;
    }
    patchGroups(target,board,source);
    if(isNew)boardList.appendChild(target);
  }
  if([...originals.keys()].some(name=>!names.has(name)))throw Error('La rimozione di piani non è supportata');
  const preference=[...(child(child(root,'StripBoardMgrPreferences'),'PropertyList')?.children||[])]
    .find(item=>item.tagName==='Property'&&item.getAttribute('Name')==='ActiveStripBoard');
  if(!preference||!names.has(project.activeBoard))throw Error('Piano attivo non valido');
  preference.setAttribute('Value',project.activeBoard);
  const prefix=/^(<\?xml[^>]*\?>\s*)/.exec(xml)?.[0]||'';
  return encoder.encode(prefix+new XMLSerializer().serializeToString(root));
}

function patchCalendars(project){
  const xml=project.sourceXmlSections.CalendarMgr,doc=parseSource(xml,'CalendarMgr');
  const list=child(doc.documentElement,'Calendars');
  const format=iso=>{const [y,m,d]=iso.split('-');return `${m}/${d}/${y}`};
  const ensure=(node,name)=>{let target=child(node,name);if(!target){target=doc.createElement(name);node.appendChild(target)}return target};
  for(const c of project.calendars){
    if(calendarsSignature({calendars:[c]})===project.sourceDocument.calendarSignatures.get(c.name))continue;
    const node=[...list.children].find(n=>n.getAttribute('Name')===c.sourceRef.name);
    if(!node)throw Error('Origine calendario MSD non trovata');
    const days=ensure(node,'DaysOff');
    for(const key of CALENDAR_DAYS)if(c.daysOff[key]!== (days.hasAttribute(key)?days.getAttribute(key):undefined)){
      if(!['0','1'].includes(c.daysOff[key]))throw Error('Pattern MSD non risolto');days.setAttribute(key,c.daysOff[key]);
    }
    const start=c.scheduleDates.ProductionStartDate;
    if(start?.origin==='edited'){
      const dates=ensure(node,'ScheduleDates');let target=[...dates.children].find(n=>n.getAttribute('Name')==='ProductionStartDate');
      if(!target){target=doc.createElement('ScheduleDate');target.setAttribute('Name','ProductionStartDate');dates.appendChild(target)}
      target.setAttribute('Date',format(start.iso));
    }
    const specials=ensure(node,'SpecialDays'),original=[...specials.children].filter(n=>n.tagName==='SpecialDay');
    const existing=new Map(original.map(n=>[n.getAttribute('Date'),n]));
    const wanted=new Set();
    for(const s of c.specialDays){
      const key=existing.has(s.rawDate)?s.rawDate:s.date?format(s.date):s.rawDate;
      let target=existing.get(key);
      if(!target){target=doc.createElement('SpecialDay');specials.appendChild(target)}
      wanted.add(target);
      for(const [key,value] of Object.entries(s.attributes))target.setAttribute(key,value);
      target.setAttribute('Date',key);
    }
    for(const target of original)if(!wanted.has(target))target.remove();
  }
  const prefix=/^(<\?xml[^>]*\?>\s*)/.exec(xml)?.[0]||'';
  return encoder.encode(prefix+new XMLSerializer().serializeToString(doc.documentElement));
}
export function serializeMsd(project){
  const source=project?.sourceDocument;
  if(!source?.bytes||!source?.sections)throw Error('Documento MSD originale non disponibile');
  const boardChanged=boardSignature(project)!==source.boardSignature,calendarChanged=calendarsSignature(project)!==source.calendarsSignature;
  if(!boardChanged&&!calendarChanged)return source.bytes.slice(0);
  const oldBytes=new Uint8Array(source.bytes),oldView=new DataView(source.bytes);
  const replacements=new Map();
  for(const [root,changed,patch] of [['StripBoardMgr',boardChanged,patchManager],['CalendarMgr',calendarChanged,patchCalendars]])if(changed){
    const section=source.sections.find(s=>s.root===root);if(!section)throw Error(`Sezione ${root} assente`);
    replacements.set(section,concat([oldBytes.slice(section.offset,section.offset+68),storedDeflate(patch(project))]));
  }
  const body=[];let offset=716;
  const map=oldBytes.slice(oldView.getUint32(260));
  const mapView=new DataView(map.buffer);
  for(const section of source.sections){
    const block=replacements.get(section)||oldBytes.slice(section.offset,section.offset+section.length);
    body.push(block);mapView.setUint32(section.index*332+68,offset);mapView.setUint32(section.index*332+72,block.length);
    offset+=block.length;
  }
  const header=oldBytes.slice(0,716);
  new DataView(header.buffer).setUint32(260,offset);
  return concat([header,...body,map]).buffer;
}
