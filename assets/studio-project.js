import {migrateStudioMsdTimes} from './scene-time.js';
/* Studio-only data never changes the proprietary native export contract. */
import {parseMsd} from './msd-parser.js';
import {parseMmsx} from './mmsx-project.js';
import {snapshotDocument,restoreDocument,validateDocument,createDocument} from './document-model.js';
export function ensureStudio(project){return project.studio??={version:1,dood:{},print:{}}}
export function snapshotStudio(project){return {studio:structuredClone(project.studio),events:structuredClone(project.events.filter(e=>e.studio))}}
export function restoreStudio(project,snapshot){project.studio=structuredClone(snapshot.studio);project.events=[...project.events.filter(e=>!e.studio),...structuredClone(snapshot.events)]}
export function setDoodRules(project,boardName,{category,elementId,rules}){
  const studio=ensureStudio(project);studio.dood??={};const config=studio.dood[boardName]??={categories:{},elements:{}};
  const bucket=elementId?config.elements:config.categories,key=elementId||category;
  if(!key)throw Error('Scegli categoria o elemento');
  if(rules===null)delete bucket[key];else bucket[key]={...rules};
}
// Explicit numeric paths avoid tag collisions with opaque user objects.
import {ExactNumber} from './mmsx-codec.js';
function encodeDocument(document){
 const exactNumbers=[];
 const walk=(v,path=[])=>{if(v instanceof ExactNumber){exactNumbers.push(path);return v.text}if(!v||typeof v!=='object')return v;if(Array.isArray(v))return v.map((x,i)=>walk(x,[...path,i]));return Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).map(([k,x])=>[k,walk(x,[...path,k])]))};
 return {value:walk(document),exactNumbers};
}
function decodeDocument(encoded){
 const value=encoded.value;
 for(const path of encoded.exactNumbers){if(!Array.isArray(path)||!path.length)throw Error('Percorso numerico Studio non valido');let node=value;for(const k of path.slice(0,-1)){if(!Object.hasOwn(node,k))throw Error('Percorso numerico Studio non valido');node=node[k]}const key=path.at(-1);if(!Object.hasOwn(node,key)||typeof node[key]!=='string'||!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(node[key]))throw Error('Numero Studio non valido');node[key]=new ExactNumber(node[key])}return value;
}
export async function serializeStudio(project){
 validateDocument(project);
 const original=project.mmsxSource?.bytes??project.sourceDocument?.bytes;
 const bytes=original?new Uint8Array(original):null,parts=[];
 if(bytes)for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
 return new TextEncoder().encode(JSON.stringify({type:'stripboard-studio',version:3,modelVersion:3,fileName:project.fileName,provenance:project.provenance??{format:project.format,fileName:project.fileName},sourceFormat:project.format,native:bytes?btoa(parts.join('')):null,document:encodeDocument(snapshotDocument(project))}));
}
export async function parseStudio(bytes){
  const data=JSON.parse(new TextDecoder().decode(bytes));
  if(data.type==='stripboard-studio'&&data.version===3){
    if(![1,2,3].includes(data.modelVersion)||typeof data.fileName!=='string'||!data.fileName||!data.document?.value||!Array.isArray(data.document.exactNumbers))throw Error('Progetto Studio non supportato');
    if(!['studio','msd','mmsx'].includes(data.sourceFormat))throw Error('Formato sorgente Studio non valido');
    const document=decodeDocument(data.document);validateDocument(document);
    let project;
    if(data.native!==null){
      if(typeof data.native!=='string'||!['msd','mmsx'].includes(data.sourceFormat))throw Error('Archivio sorgente non valido');
      const native=Uint8Array.from(atob(data.native),c=>c.charCodeAt(0)).buffer;
      project=await (data.sourceFormat==='mmsx'?parseMmsx(native,data.fileName):parseMsd(native,data.fileName));
    }else project=createDocument(document.title);
    if(data.modelVersion===1)migrateStudioMsdTimes(document,project);
    if(project.mmsxSource&&project.colors.nativeRules?.length&&!document.colors?.cells&&!document.colors?.combinationEditing)document.colors={...project.colors,...document.colors,preferences:{...project.colors.preferences,...document.colors?.preferences}};
    project.format=data.sourceFormat;reconnectYards(document);restoreDocument(project,document);
    project.provenance=data.provenance;project.format=data.sourceFormat;project.fileName=data.fileName;project.studioContainer=true;project.storageFormat='studio';
    return project;
  }

  if(data.type==='stripboard-studio'&&data.version===2){
    if(typeof data.fileName!=='string'||!data.fileName)throw Error('Nome file Studio non valido');
    if(!data.document||!data.views||!Array.isArray(data.views.stripLayouts)||!Array.isArray(data.views.reportLayouts))throw Error('Documento Studio non valido');
    validateDocument(data.document,{allowLegacySingleValues:true});
    let project;
    if(data.native!==null){
      if(typeof data.native!=='string')throw Error('Archivio sorgente non valido');
      const native=Uint8Array.from(atob(data.native),c=>c.charCodeAt(0)).buffer;
      project=await (data.format==='mmsx'?parseMmsx(native,data.fileName):parseMsd(native,data.fileName));
    }else project=createDocument(data.document.title);
    // Reconnect the shared MMSX Boneyard after JSON decoding has broken array identity.
    if(project.mmsxSource&&project.colors.nativeRules?.length&&!data.views.colors?.cells&&!data.views.colors?.combinationEditing){data.views.colors={...project.colors,...data.views.colors,preferences:{...project.colors.preferences,...data.views.colors?.preferences}};data.document.colors=data.views.colors}
    if(['studio','msd','mmsx'].includes(data.format))project.format=data.format;
    migrateStudioMsdTimes(data.document,project);
    reconnectYards(data.document);
    restoreDocument(project,data.document);Object.assign(project,data.views);project.documentEditing=true;project.studioContainer=true;project.storageFormat='studio';project.fileName=data.fileName;project.capabilities.createBoards=true;return project;
  }
  if(data.type!=='stripboard-studio'||data.version!==1||typeof data.native!=='string'||!Array.isArray(data.events))throw Error('Progetto Studio non supportato');
  const native=Uint8Array.from(atob(data.native),c=>c.charCodeAt(0)).buffer;
  const magic=new TextDecoder().decode(new Uint8Array(native,0,Math.min(4,native.byteLength)));
  const project=await (/^(MMS2|MMSX)$/.test(magic)?parseMmsx(native,data.fileName):parseMsd(native,data.fileName));
  if(!data.studio||typeof data.studio!=='object'||Array.isArray(data.studio))throw Error('Metadati Studio non validi');
  project.studio=data.studio;project.events.push(...data.events.map(e=>{const board=project.boards.find(b=>b.name===e.studioBoardName);return {...e,studio:true,...(board?{calendarId:board.calendarId,scope:{kind:'segment',boardId:board.parentBoardId,segmentId:board.segmentId}}:{})}}));project.studioContainer=true;project.storageFormat='studio';
  project.counts.events=project.events.length;
  return project;
}

function reconnectYards(document){const yards=new Map();for(const board of document.boards){const key=board.parentBoardId;if(!key)continue;if(yards.has(key)){if(JSON.stringify(board.unscheduledGroups)!==JSON.stringify(yards.get(key)))throw Error('Boneyard condiviso incoerente');board.unscheduledGroups=yards.get(key)}else yards.set(key,board.unscheduledGroups)}}
