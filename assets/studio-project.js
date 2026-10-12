/* Studio-only data never changes the proprietary native export contract. */
import {parseMsd} from './msd-parser.js';
import {parseMmsx,serializeMmsx} from './mmsx-project.js';
import {serializeMsd} from './msd-writer.js';
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
export async function serializeStudio(project){
  if(project.documentEditing){
    validateDocument(project);
    const original=project.format==='mmsx'?project.mmsxSource?.bytes:project.sourceDocument?.bytes;
    const bytes=original?new Uint8Array(original):null,parts=[];
    if(bytes)for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
    const document=snapshotDocument(project);
    const data={type:'stripboard-studio',version:2,fileName:project.fileName,native:bytes?btoa(parts.join('')):null,format:project.format,document,views:{stripLayouts:project.stripLayouts,reportLayouts:project.reportLayouts,colors:project.colors}};
    return new TextEncoder().encode(JSON.stringify(data));
  }
  const native=project.format==='mmsx'?await serializeMmsx(project,project.fileName):new Uint8Array(serializeMsd(project));
  const bytes=new Uint8Array(native),parts=[];
  for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  return new TextEncoder().encode(JSON.stringify({type:'stripboard-studio',version:1,fileName:project.fileName,native:btoa(parts.join('')),studio:project.studio||{version:1,dood:{},print:{}},events:project.events.filter(e=>e.studio)}));
}
export async function parseStudio(bytes){
  const data=JSON.parse(new TextDecoder().decode(bytes));
  if(data.type==='stripboard-studio'&&data.version===2){
    if(typeof data.fileName!=='string'||!data.fileName)throw Error('Nome file Studio non valido');
    if(!data.document||!data.views||!Array.isArray(data.views.stripLayouts)||!Array.isArray(data.views.reportLayouts))throw Error('Documento Studio non valido');
    validateDocument(data.document);
    let project;
    if(data.native!==null){
      if(typeof data.native!=='string')throw Error('Archivio sorgente non valido');
      const native=Uint8Array.from(atob(data.native),c=>c.charCodeAt(0)).buffer;
      project=await (data.format==='mmsx'?parseMmsx(native,data.fileName):parseMsd(native,data.fileName));
    }else project=createDocument(data.document.title);
    // Reconnect the shared MMSX Boneyard after JSON decoding has broken array identity.
    const yards=new Map();for(const board of data.document.boards){const key=board.parentBoardId;if(yards.has(key))board.unscheduledGroups=yards.get(key);else yards.set(key,board.unscheduledGroups)}
    restoreDocument(project,data.document);Object.assign(project,data.views);project.documentEditing=true;project.studioContainer=true;project.fileName=data.fileName;project.capabilities.createBoards=true;return project;
  }
  if(data.type!=='stripboard-studio'||data.version!==1||typeof data.native!=='string'||!Array.isArray(data.events))throw Error('Progetto Studio non supportato');
  const native=Uint8Array.from(atob(data.native),c=>c.charCodeAt(0)).buffer;
  const magic=new TextDecoder().decode(new Uint8Array(native,0,Math.min(4,native.byteLength)));
  const project=await (/^(MMS2|MMSX)$/.test(magic)?parseMmsx(native,data.fileName):parseMsd(native,data.fileName));
  if(!data.studio||typeof data.studio!=='object'||Array.isArray(data.studio))throw Error('Metadati Studio non validi');
  project.studio=data.studio;project.events.push(...data.events.map(e=>{const board=project.boards.find(b=>b.name===e.studioBoardName);return {...e,studio:true,...(board?{calendarId:board.calendarId,scope:{kind:'segment',boardId:board.parentBoardId,segmentId:board.segmentId}}:{})}}));project.studioContainer=true;
  project.counts.events=project.events.length;
  return project;
}
