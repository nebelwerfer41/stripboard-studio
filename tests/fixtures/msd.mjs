// Build a derived sample in memory; the original EPSF file is never modified.
const concat=chunks=>{
 const bytes=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes;
};
function storedDeflate(bytes){
 const chunks=[];let offset=0;
 do{
  const size=Math.min(65535,bytes.length-offset),block=new Uint8Array(size+5);
  block[0]=offset+size===bytes.length?1:0;
  new DataView(block.buffer).setUint16(1,size,true);
  new DataView(block.buffer).setUint16(3,(~size)&65535,true);
  block.set(bytes.subarray(offset,offset+size),5);chunks.push(block);offset+=size;
 }while(offset<bytes.length);
 return concat(chunks);
}
export function renamedCategoryFixture(project,from,to){
 const source=project.sourceDocument,bytes=new Uint8Array(source.bytes),view=new DataView(source.bytes);
 const map=bytes.slice(view.getUint32(260)),mapView=new DataView(map.buffer),chunks=[];
 let offset=716;
 for(const section of source.sections){
  const xml=project.sourceXmlSections[section.root].split(from).join(to);
  const chunk=concat([bytes.slice(section.offset,section.offset+68),storedDeflate(new TextEncoder().encode(xml))]);
  mapView.setUint32(section.index*332+68,offset);
  mapView.setUint32(section.index*332+72,chunk.length);
  chunks.push(chunk);offset+=chunk.length;
 }
 const header=bytes.slice(0,716);new DataView(header.buffer).setUint32(260,offset);
 return concat([header,...chunks,map]).buffer;
}
