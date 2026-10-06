/* Conservative EPSF/MSD 6 writer: replace only StripBoardMgr, copy all other sections. */
import {boardSignature} from './scheduling.js';

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

function parseSource(xml){
  if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml))throw Error('DTD/entities non supportate');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')||doc.documentElement.tagName!=='StripBoardMgr')throw Error('StripBoardMgr XML non valido');
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
  for(const [modelName,xmlName] of [['scheduledGroups','ScheduledStrips'],['unscheduledGroups','UnscheduledStrips']]){
    const modelGroups=board[modelName],sourceGroups=groups(original,xmlName),usedGroups=new Set(),orderedGroups=[];
    if(modelGroups.length!==sourceGroups.length)throw Error(`Gruppi ${xmlName} incompatibili`);
    const targetContainer=child(node,xmlName);
    if(!targetContainer){if(modelGroups.length)throw Error(`Contenitore ${xmlName} mancante`);continue}
    for(const [index,group] of modelGroups.entries()){
      const sourceGroup=sourceGroups[group.sourceIndex??index];
      if(!sourceGroup||usedGroups.has(sourceGroup)||group.kind!==sourceGroup.tagName)throw Error('Tipo di gruppo MSD modificato');
      usedGroups.add(sourceGroup);
      const target=sourceGroup.cloneNode(true);
      const desired=group.strips.map(strip=>{
        const key=strip.sourceKey;
        if(!sources.has(key)||used.has(key))throw Error('Riferimento strip mancante o ripetuto');
        used.add(key);return sources.get(key).cloneNode(true);
      });
      // Preserve group attributes and opaque non-strip children; MSD strip groups contain only elements and whitespace.
      if([...target.childNodes].some(item=>item.nodeType!==1&&item.nodeType!==3)||
        [...target.childNodes].some(item=>item.nodeType===3&&item.nodeValue.trim()))throw Error('Contenuto opaco nel gruppo strip');
      target.replaceChildren(...desired);
      orderedGroups.push(target);
    }
    let nextGroup=0;
    targetContainer.replaceChildren(...[...targetContainer.childNodes].map(item=>
      item.nodeType===1?orderedGroups[nextGroup++]:item.cloneNode(true)));
  }
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

export function serializeMsd(project){
  const source=project?.sourceDocument;
  if(!source?.bytes||!source?.sections)throw Error('Documento MSD originale non disponibile');
  if(boardSignature(project)===source.boardSignature)return source.bytes.slice(0);
  const oldBytes=new Uint8Array(source.bytes),oldView=new DataView(source.bytes);
  const targetSection=source.sections.find(section=>section.root==='StripBoardMgr');
  if(!targetSection)throw Error('Sezione stripboard assente');
  const xmlBytes=patchManager(project),compressed=storedDeflate(xmlBytes);
  const changed=concat([oldBytes.slice(targetSection.offset,targetSection.offset+68),compressed]);
  const body=[];let offset=716;
  const map=oldBytes.slice(oldView.getUint32(260));
  const mapView=new DataView(map.buffer);
  for(const section of source.sections){
    const block=section===targetSection?changed:oldBytes.slice(section.offset,section.offset+section.length);
    body.push(block);mapView.setUint32(section.index*332+68,offset);mapView.setUint32(section.index*332+72,block.length);
    offset+=block.length;
  }
  const header=oldBytes.slice(0,716);
  new DataView(header.buffer).setUint32(260,offset);
  return concat([header,...body,map]).buffer;
}
