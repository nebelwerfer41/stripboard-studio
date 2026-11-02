/* MSD EstimateTimeA = minutes, EstimateTimeB = hours, observed across paired native files. */
export function readMsdTime(minutes,hours){
 const m=String(minutes??''),h=String(hours??'');
 if(!m&&!h)return null;
 if((m&&!/^\d+$/.test(m))||(h&&!/^\d+$/.test(h)))throw Error('Tempo MSD non numerico');
 const total=Number(h||0)*60+Number(m||0);if(!Number.isSafeInteger(total))throw Error('Tempo MSD oltre il limite supportato');
 return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
}
export function writeMsdTime(value){
 if(value==null||value==='')return {EstimateTimeA:'',EstimateTimeB:''};
 const text=String(value),match=/^(\d+):([0-5]\d)$/.exec(text);
 let total;if(match)total=Number(match[1])*60+Number(match[2]);else if(/^\d+$/.test(text))total=Number(text);else throw Error('Tempo stimato non valido: usa ore:minuti');
 if(!Number.isSafeInteger(total))throw Error('Tempo stimato oltre il limite supportato');
 return {EstimateTimeA:String(total%60),EstimateTimeB:String(Math.floor(total/60))};
}
// Old Studio snapshots copied raw MSD fields. Migrate only values demonstrably identical to the archive.
export function migrateStudioMsdTimes(document,source){
 if(source.format!=='msd')return;
 const scenes=new Map(source.scenes.map(s=>[s.bdsId,s]));
 for(const s of document.scenes){const original=scenes.get(s.bdsId),raw=original?.msdTimeSource;if(s.msdTimeSource||!raw)continue;
  if(String(s.estimateTimeA??'')===String(raw.minutes??'')&&String(s.estimateTimeB??'')===String(raw.hours??'')){
   s.estimateTimeA=original.estimateTimeA;s.estimateTimeB=null;s.msdTimeSource={...raw};
  }
 }
}
export function readMmsxTime(hours,minutes){
 if(hours==null&&minutes==null)return null;
 if((hours!=null&&(!Number.isSafeInteger(hours)||hours<0))||(minutes!=null&&(!Number.isSafeInteger(minutes)||minutes<0)))return null;
 return readMsdTime(String(minutes??0),String(hours??0));
}
