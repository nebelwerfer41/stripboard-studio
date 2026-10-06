/* MMS2/MMSX dataFormat 5 interoperability. No network or Movie Magic dependency. */
const keys=[1648095772,2585400131,604766348,3359926216,720573198,3967776733,4120650410,2464540550,2827940678,2857550047,688309029,3547364823,635260292,3501372004,1255697379,3545601426,2214544105,1446283197,1864246140,2529586331,1042505700,605611319,3183490306,407498046,3981543103,3261249596,4249665918];
const MAX_FILE=64*1024*1024,MAX_JSON=128*1024*1024;
const rol=(v,n)=>(v<<n)|(v>>>(32-n)),ror=(v,n)=>rol(v,32-n);
export class ExactNumber {constructor(text){this.text=text} valueOf(){return Number(this.text)}}
// Preserve opaque numbers beyond JavaScript precision, including decimal values.
export function parseExact(text){
 let i=0;const ws=()=>{while(/\s/.test(text[i]||'!'))i++};
 function value(depth=0){
  if(depth>150)throw Error('Documento MMSX troppo annidato');ws();const ch=text[i];
  if(ch==='"'){const start=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue}if(text[i++]==='"')return JSON.parse(text.slice(start,i))}throw Error('Testo JSON incompleto')}
  if(ch==='{'||ch==='['){i++;const obj=ch==='{'?Object.create(null):[],end=ch==='{'?'}':']';ws();if(text[i]===end){i++;return obj}while(i<text.length){if(ch==='{'){ws();if(text[i]!=='"')throw Error('Chiave JSON non valida');const key=value(depth+1);ws();if(text[i++]!==':')throw Error('JSON non valido');if(Object.hasOwn(obj,key))throw Error('Chiave JSON duplicata');obj[key]=value(depth+1)}else obj.push(value(depth+1));ws();const sep=text[i++];if(sep===end)return obj;if(sep!==',')throw Error('JSON non valido')}throw Error('JSON incompleto')}
  for(const [s,v] of [['true',true],['false',false],['null',null]])if(text.startsWith(s,i)){i+=s.length;return v}
  const match=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));if(!match)throw Error('Valore JSON non valido');i+=match[0].length;
  const n=Number(match[0]);return Number.isSafeInteger(n)&&String(n)===match[0]?n:new ExactNumber(match[0]);
 }
 const result=value();ws();if(i!==text.length)throw Error('Dati JSON aggiuntivi');return result;
}
export function stringifyExact(v){
 if(v instanceof ExactNumber)return v.text;
 if(v===null||typeof v!=='object')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(stringifyExact).join(',')+']';
 return '{'+Object.entries(v).map(([k,x])=>JSON.stringify(k)+':'+stringifyExact(x)).join(',')+'}';
}
export const cloneExact=v=>parseExact(stringifyExact(v));
export function decryptMmsx(buffer){
 const bytes=new Uint8Array(buffer),magic=new TextDecoder().decode(bytes.subarray(0,4));
 if(!['MMS2','MMSX'].includes(magic)||bytes.length<20||bytes.length>MAX_FILE||(bytes.length-12)%8)throw Error('MMSX non riconosciuto, incompleto o oltre 64 MB');
 const input=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),output=new Uint8Array(bytes.length-12),view=new DataView(output.buffer);
 for(let p=12;p<bytes.length;p+=8){let a=input.getUint32(p),b=input.getUint32(p+4);for(let k=keys.length-1;k>=0;k--){b=ror(b^a,3);a=rol(((a^keys[k])-b)>>>0,8)}view.setUint32(p-12,a^input.getUint32(p-8));view.setUint32(p-8,b^input.getUint32(p-4))}
 const pad=output.at(-1);if(pad<1||pad>8||!output.slice(-pad).every(x=>x===pad))throw Error('MMSX danneggiato: padding non valido');return output.slice(0,-pad);
}
export function encryptMmsx(data,iv=crypto.getRandomValues(new Uint8Array(8))){
 if(iv.length!==8)throw Error('IV non valido');const pad=8-data.length%8,plain=new Uint8Array(data.length+pad);plain.set(data);plain.fill(pad,data.length);
 const output=new Uint8Array(12+plain.length);output.set(new TextEncoder().encode('MMS2'));output.set(iv,4);const view=new DataView(output.buffer),input=new DataView(plain.buffer);let a=view.getUint32(4),b=view.getUint32(8);
 for(let p=0;p<plain.length;p+=8){a^=input.getUint32(p);b^=input.getUint32(p+4);for(const k of keys){a=((ror(a,8)+b)>>>0)^k;b=rol(b,3)^a}view.setUint32(p+12,a);view.setUint32(p+16,b)}
 if(output.length>MAX_FILE)throw Error('Esportazione oltre 64 MB');return output;
}
async function gzip(bytes,decompress){
 const Constructor=decompress?globalThis.DecompressionStream:globalThis.CompressionStream;
 if(!Constructor)throw Error('Questo browser non supporta la compressione MMSX. Aggiorna Safari o il browser.');
 const reader=new Blob([bytes]).stream().pipeThrough(new Constructor('gzip')).getReader(),chunks=[];let count=0;
 while(true){const {value,done}=await reader.read();if(done)break;count+=value.length;if(count>MAX_JSON){await reader.cancel();throw Error('Contenuto MMSX oltre 128 MB')}chunks.push(value)}
 const result=new Uint8Array(count);let p=0;for(const c of chunks){result.set(c,p);p+=c.length}return result;
}
export async function decodeMmsx(bytes){return parseExact(new TextDecoder('utf-8',{fatal:true}).decode(await gzip(decryptMmsx(bytes),true)))}
export async function encodeMmsx(root){const bytes=new TextEncoder().encode(stringifyExact(root));if(bytes.length>MAX_JSON)throw Error('Contenuto MMSX oltre 128 MB');return encryptMmsx(await gzip(bytes,false))}
