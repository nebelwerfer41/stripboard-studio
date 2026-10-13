export function formatPages(eighths){
  if(eighths==null)return '';
  const whole=Math.floor(eighths/8),rest=eighths%8;
  return whole?`${whole}${rest?` ${rest}/8`:''}`:`${rest}/8`;
}
export function parsePages(text){
  const value=String(text).trim();if(!value)return null;
  const match=/^(?:(\d+)\s+)?(\d+)\/8$/.exec(value);
  if(match){const whole=Number(match[1]||0),fraction=Number(match[2]);if(fraction>7)throw Error('La frazione deve essere compresa fra 0/8 e 7/8');const n=whole*8+fraction;if(Number.isSafeInteger(n))return n}
  else if(/^\d+$/.test(value)){const n=Number(value)*8;if(Number.isSafeInteger(n))return n}
  throw Error('Inserisci le pagine come 2 3/8, 3/8 oppure 2');
}
const pad=n=>String(n).padStart(2,'0');
export function formatTime(value,{screen=false}={}){
  if(value==null||value==='')return '';
  const text=String(value),match=/^(\d+):([0-5]\d)$/.exec(text);
  if(match)return `${pad(Number(match[1]))}:${match[2]}`;
  if(/^\d+(?:\.\d+)?$/.test(text)){
    const seconds=Math.round(Number(text)*60);
    return screen?`${pad(Math.floor(seconds/60))}:${pad(seconds%60)}`:`${pad(Math.floor(seconds/3600))}:${pad(Math.floor(seconds%3600/60))}`;
  }
  return text;
}
export function parseTime(text,{screen=false}={}){
  const value=String(text).trim();if(!value)return null;
  const match=/^(\d+):([0-5]\d)$/.exec(value);
  if(!match||!Number.isSafeInteger(Number(match[1])))throw Error(`Inserisci il tempo nel formato ${screen?'MM:SS':'HH:MM'}`);
  return `${pad(Number(match[1]))}:${match[2]}`;
}
export function sceneEntryValue(scene,key){return key==='pagesEighths'?formatPages(scene[key]):key==='estimateTimeA'||key==='estimateTimeB'?formatTime(scene[key],{screen:key==='estimateTimeB'}):String(scene[key]??'')}
export function parseSceneEntry(key,value){return key==='pagesEighths'?parsePages(value):key==='estimateTimeA'||key==='estimateTimeB'?parseTime(value,{screen:key==='estimateTimeB'}):value}
