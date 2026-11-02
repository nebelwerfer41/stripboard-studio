import {categoryUsesQuantity} from './quantities.js';
import {mmsxColors} from './export-colors.js';
/* dataFormat 5 record scaffold observed in the supplied MMS10 sample.
 * Independent of the permissive project parser. No production/sample data here. */
import {validDate} from './production-data.js';
import {ExactNumber} from './mmsx-codec.js';
import {builtinField} from './element-management.js';
const codes={ie:'intExt',dn:'dayNight',set:'set',location:'location',scriptDay:'scriptDay',unit:'unit',sequence:'sequence',episode:'episode'};
export function completeMmsxSchema(root,project){
 const c=root.contents,propertyIds=new Map();
 const systemFlags=[['travel','Travel - DOOD'],['fitting','Fitting - DOOD'],['unavailable','Unavailable'],['rehearsal','Rehearsal - DOOD']];
 c.rules??={};c.layout??={};
 for(const [field,name] of Object.entries({ie:'I/E',dn:'D/N',set:'Set',location:'Location',scriptDay:'Script Day',unit:'Unit',sequence:'Sequence',episode:'Episode'}))if(!Object.values(c.category).some(cat=>builtinField(cat.name)===field))c.category[`studio-category:${field}`]={name,propertyDesc:{},sortOrder:Object.keys(c.category).length+1};
 for(const [id,b] of Object.entries(c.breakdown)){Object.assign(b,{id,name:'Default'});for(const [id,s] of Object.entries(b.sheetMap)){s.id=id;for(const key of ['scenes','synopsis','unit','scriptDay','sequence','scriptPages','location','comments','intExt','dayNight','set','episode'])s[key]??='';s.color??='color13';s.backgroundColor??='color14'}}
 for(const [id,cat] of Object.entries(c.category)){Object.assign(cat,{id,hidden:false,exclude:false,allowHoldDays:false,allowDrop:false,minDropDays:0,autoAssignBoardId:false,useInDailyQTY:categoryUsesQuantity(project?.categorySettings.find(x=>x.id===id)||cat),color:cat.color||'#000000'});const code=cat.code||codes[builtinField(cat.name)]||(/^(Cast|Cast Members)$/i.test(cat.name)?'castMember':null);if(code)cat.code=code;
  cat.propertyDesc=Object.fromEntries(Object.entries(cat.propertyDesc||{}).map(([key,def],i)=>[propertyIds.set(`${id}:${key}`,/^[0-9a-f-]{36}$/i.test(key)?key:`property:${id}:${key}`).get(`${id}:${key}`),{name:def?.name||key,type:def?.type==='multiline'||def?.type==='longtext'?'longtext':'text',sortOrder:i+1}]));
 }
 for(const b of Object.values(c.breakdown))for(const sheet of Object.values(b.sheetMap))for(const code of Object.values(codes)){const e=c.element[sheet[code]];if(e&&!e.category_id)e.category_id=Object.keys(c.category).find(id=>c.category[id].code===code)}
 for(const [id,e] of Object.entries(c.element)){Object.assign(e,{id,boardId:e.boardId??'',lockId:false,allowHoldDays:false,allowDrop:false,minDropDays:0,exclude:false,linkedMap:{},notes:''});const cat=c.category[e.category_id];if(!cat)continue;const properties={};for(const [key,value] of Object.entries(e.properties||{})){let pid=propertyIds.get(`${cat.id}:${key}`)||Object.keys(cat.propertyDesc).find(k=>k===key||cat.propertyDesc[k].name===key);if(!pid){pid=`property:${cat.id}:${key}`;cat.propertyDesc[pid]={name:key,type:'text',sortOrder:Object.keys(cat.propertyDesc).length+1}}properties[pid]=value}e.properties=properties;
 }
 if(project)mmsxColors(root,project);
 const validStart=value=>typeof value==='string'&&/^\d{8}$/.test(value)&&validDate(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6)}`);
 const firstStart=Object.values(c.stripboard).flatMap(b=>Object.values(b.segmentMap)).filter(s=>s.type==='normal').map(s=>s.calendar?.prodStart).find(validStart)||'20000101';
 const calendar=start=>({prodStart:start,daysOff:96,specialDays:{},eventMap:{}});
 for(const [id,b] of Object.entries(c.stripboard)){b.id=id;b.description??='';const boardStart=Object.values(b.segmentMap).filter(s=>s.type==='normal').map(s=>s.calendar?.prodStart).find(validStart)||firstStart;for(const [id,s] of Object.entries(b.segmentMap)){s.id=id;if(s.type==='normal'){s.calendar??=calendar(boardStart);if(!validStart(s.calendar.prodStart))s.calendar.prodStart=boardStart;s.calendarOptions??={elements:['All']}}else{s.calendar??=calendar(boardStart);if(!validStart(s.calendar.prodStart))s.calendar.prodStart=boardStart;}for(const [id,r] of Object.entries(s.stripMap)){r.id=id;if(r.type==='day'){r.estHours??=0;r.estMinutes??=0;r.sunrise??='00:00';r.sunset??='00:00'} }let pending=[];for(const r of Object.values(s.stripMap).sort((a,b)=>a.sortOrder-b.sortOrder)){if(r.type==='day'){if(r.date&&s.type==='normal')for(const strip of pending){strip.date=r.date;strip.shootDay=r.shootDay}pending=[]}else pending.push(r)}if(s.calendar?.eventMap){const events={};for(const [eid,e] of Object.entries(s.calendar.eventMap)){const scopedId=`event:${b.id}:${s.id}:${eid}`;events[scopedId]={...e,id:scopedId,color:e.color||'#10457A'}}s.calendar.eventMap=events}}}
 for(const [id,t] of Object.entries(c.redflagType))Object.assign(t,{id,type:t.type||systemFlags.find(([,name])=>name===t.name)?.[0]||'unavailable',system:false,sortOrder:t.sortOrder??4});
 for(const [i,[type,name]] of systemFlags.entries()){const existing=Object.values(c.redflagType).find(t=>t.type===type&&t.name===name);if(existing){existing.system=true;existing.sortOrder=i}else{const id=`studio-system-flag:${type}`;c.redflagType[id]={id,type,name,system:true,sortOrder:i}}}
 for(const [id,f] of Object.entries(c.redflag)){f.id=id;f.color??='#FF0000'}
 const cells=keys=>({breaks:true,cells:keys.map((key,i)=>({id:`cell:${keys.join(',')}:${i}`,key,textSize:'default',row:1,left:i*135,width:135}))});
 c.layout['studio-strip']={id:'studio-strip',type:'stripboard',title:'Studio',design:cells(['sceneNum','set','synopsis','eighths']),dayDesign:cells(['endOfDay','breakDate','totalPages','estTime']),shootDayDesign:cells(['shootingDay','shootingDate']),scaleToText:false,showTotalStripCount:false};
 c.layout['studio-breakdown']={id:'studio-breakdown',type:'breakdown',title:'Breakdown',design:{rowCount:1,rows:[{cells:[{key:'scenes',width:135},{key:'synopsis',width:405}]}],breaks:true},sortOrder:0};
 c.layout['studio-fields']={id:'studio-fields',type:'breakDownActions',title:'Breakdown Fields',design:['episode','scenes','intExt','set','dayNight','shootTime','synopsis','location','pages','scriptPages','scriptDay','screenTime','unit','sequence','comments','sunrise','sunset'].map(key=>({key,name:key,useFlexContainer:true,isFlex:false})),oneColumn:false};
 c.layout['studio-header']={id:'studio-header',type:'reportHeader',title:'ReportHeader',design:{rowCount:1,rows:[{cells:[{key:'reportName',width:540}]}],breaks:true,showHeader:true},oneColumn:false};
 const reportNames={oneline:'One-line Schedule',shooting:'Shooting Schedule',elementList:'Element List',dood:'DOOD',doodSummary:'DOOD Summary',elementDetail:'Element Detail',breakdown:'Breakdown',reportHeader:'ReportHeader',dailyCategory:'Daily Category Total',calendarreport:'Calendar',conflicts:'Conflicts',redFlags:'Red Flags',vertical:'One-line Vertical'};
 c.layout['studio-strip'].title='Default';
 for(const type of ['dood','doodSummary','elementList','conflicts','redFlags'])c.layout[`studio-${type}`]={id:`studio-${type}`,type,title:reportNames[type]};
 for(const type of ['calendar','dailyCategory','shooting','oneline','vertical'])c.layout[`studio-${type}`]={...c.layout['studio-strip'],id:`studio-${type}`,type,title:reportNames[type]||'Calendar'};
 c.layout['studio-vertical'].design={breaks:true,cells:[{key:'synopsis',row:3,left:0,width:188},{key:'CAST',row:3,left:188,width:20,frozen:true},{key:'intExt',row:1,left:208,width:30},{key:'custom',text:'Scs',row:2,left:208,width:30},{key:'sceneNum',row:2,left:238,width:135},{key:'set',row:1,left:238,width:135},{key:'timeOfDay',row:3,left:373,width:35},{key:'eighths',row:3,left:408,width:20,orient:'normal',fontSize:'small',minWidth:12},{key:'redFlag',row:1,left:428,width:20,orient:'normal',minWidth:12},{key:'conflict',row:2,left:428,width:20,orient:'normal',minWidth:12}].map(cell=>({textSize:'default',...cell}))};
 c.layout['studio-elementDetail']={id:'studio-elementDetail',type:'elementDetail',title:'Element Detail',design:{rowCount:1,rows:[{cells:[{key:'elementName',width:540}]}],breaks:true},oneColumn:false};
 c.layout['studio-oneline-strip']={...c.layout['studio-strip'],id:'studio-oneline-strip',title:'One-line Schedule'};
 c.layout['studio-oneline'].stripLayoutId='studio-oneline-strip';
 // calendarreport is a distinct schema, not a stripboard with a different type.
 c.layout['studio-calendar'].design=cells(['sceneNum','set','elementNameList']);
 c.layout['studio-calendarreport']={id:'studio-calendarreport',type:'calendarreport',title:'Calendar',design:cells(['sceneNum','set','elementNameList']),controls:Object.fromEntries(['saturdays','sundays','events','strips','banners','shootdayofflabel','stripbannereventcolor','redflags','pagenumbers','estimatedtime','scenesperday'].map(key=>[key,true])),filtered:[]};
 for(const [order,type] of Object.keys(reportNames).entries())Object.values(c.layout).find(l=>l.type===type).sortOrder=order;
 for(const [layoutId,l] of Object.entries(c.layout))for(const field of ['design','dayDesign','shootDayDesign']){if(l[field])l[field]=structuredClone(l[field]);for(const [i,cell] of (l[field]?.cells||[]).entries())cell.id=`cell:${layoutId}:${field}:${i}`;}
 root.requires='10.7.33';root.changed=false;root.settings={isBoardTotalStripsChecked:false,orientation:'portrait'};
 // Native records repeat their UUID in the map value. Rewrite keys AND references together.
 const ids=new Map(),uuid=id=>{if(!ids.has(id))ids.set(id,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)?id:crypto.randomUUID());return ids.get(id)};
 function collect(v){if(!v||typeof v!=='object')return;if(typeof v.id==='string')uuid(v.id);for(const [key,x] of Object.entries(v)){if(key==='properties'||key==='productionInfo')continue;if(key==='propertyDesc')for(const pid of Object.keys(x))uuid(pid);collect(x)}}collect(root);
 const referenceFields=new Set(['id','category_id','categoryId','sheet','intExt','dayNight','set','location','scriptDay','unit','sequence','episode','elementId','stripLayoutId']);
 function rewrite(v,path=[]){
  if(v instanceof ExactNumber)return v;
  const properties=path.indexOf('properties');if(properties>=0&&path.length>properties+1||path[0]==='productionInfo')return v;
  if(typeof v==='string'){const key=path.at(-1),target=path.at(-2)==='elements'&&typeof key==='number',flagType=key==='type'&&path[0]==='contents'&&path[1]==='redflag';return referenceFields.has(key)||target||flagType?ids.get(v)||v:v}
  if(!v||typeof v!=='object')return v;if(Array.isArray(v))return v.map((x,i)=>rewrite(x,[...path,i]));
  return Object.fromEntries(Object.entries(v).map(([k,x])=>[ids.get(k)||k,rewrite(x,[...path,k])]));
 }
 return rewrite(root);
}
