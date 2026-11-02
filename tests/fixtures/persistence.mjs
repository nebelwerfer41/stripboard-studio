import {exportColorSettings} from '../../assets/export-colors.js';
import {createDocument,editElement,editScene,addDay,createPlan,editFlag,createCalendar,editCategory} from '../../assets/document-model.js';
export function syntheticProject(complex=false){
 const p=createDocument(complex?'Città, caffè e perché':'Minimo sintetico');
 if(!complex)return p;
 const actor=editElement(p,null,{name:'Èlia',category:'Cast',boardId:'1',properties:{note:'Solo dati inventati',nested:{synthetic:true}}});
 const zero=editElement(p,null,{name:'Oggetto a quantità zero',category:'Props',properties:{}});
 const prop=editElement(p,null,{name:'Tazzina blu',category:'Props',properties:{count:0}});
 editScene(p,null,{scene:'1A',synopsis:'Èlia entra nel caffè',comments:'Perché sì — àèìòù',pagesEighths:11,set:'Caffè',location:'Città',ie:'INT',dn:'DAY',scriptDay:'1',episode:'2',unit:'A',sequence:'Prologo',scriptPageNumbers:'1–2',estimateTimeA:'1:30',estimateTimeB:'0:20'},[{elementId:actor.id,quantity:1},{elementId:prop.id,quantity:null},{elementId:zero.id,quantity:0}]);
 editScene(p,null,{scene:'2',synopsis:'Ritorno in città',pagesEighths:0},[{elementId:actor.id,quantity:1},{elementId:prop.id,quantity:3}]);
 const c=p.calendars[0];c.scheduleDates.ProductionStartDate={iso:'2026-10-06',origin:'edited'};c.scheduleDates.ProductionEndDate={iso:'2026-10-07',origin:'edited'};
 c.specialDays=[{date:'2026-10-08',type:'holiday',attributes:{Off:'0',CompanyTravel:'0',Holiday:'1',ExceptionWorkday:'0'}},{date:'2026-10-10',type:'workday',attributes:{Off:'0',CompanyTravel:'0',Holiday:'0',ExceptionWorkday:'1'}}];
 createCalendar(p,{name:'Calendario non assegnato'});
 editCategory(p,null,{name:'Veicoli speciali',properties:{fuel:{name:'Carburante',type:'single'}},attributes:{}});
 editElement(p,null,{name:'Bicicletta elettrica',category:'Veicoli speciali',properties:{fuel:'Elettrico'}});
 p.production.Company='Produzione sintetica';p.production.extra={synthetic:true};
 const b=p.boards[0],d1=addDay(p,b.id,{date:'2026-10-06',shootingDayNumber:1}),d2=addDay(p,b.id,{date:'2026-10-07',shootingDayNumber:2});
 d1.strips.push(b.unscheduledGroups[0].strips.shift(),{kind:'banner',text:'Caffè e trasferimento',sourceKey:'synthetic-banner',style:{fontColor:'#123456'}});
 // Leave scene 2 in the Boneyard; retain an empty second day.
 const alt=createPlan(p,{name:'Piano alternativo',calendarId:c.id,copyFrom:b.id});
 alt.unscheduledGroups.unshift({id:'synthetic-yard-day',kind:'UnscheduledDay',date:null,shootingDayNumber:null,strips:[]});
 p.events.push({id:'synthetic-event',name:'Prova costumi',type:'fitting',note:'Evento inventato',calendarId:c.id,startDate:'2026-10-06',endDate:'2026-10-07',scope:{kind:'project'},targets:[{kind:'element',elementId:actor.id,category:actor.category,element:actor.name}]});
 editFlag(p,null,{name:'Indisponibile',note:'Vincolo sintetico',startDate:'2026-10-06',endDate:'2026-10-08',target:{kind:'element',elementId:actor.id,category:actor.category,element:actor.name}});
 p.studio={version:1,dood:{[b.name]:{categories:{Cast:{allowHold:true}}}},print:{}};
 const colors=exportColorSettings(p);for(const [key,value] of Object.entries(colors.cells))colors.cells[key]={bg:key.startsWith('1:')?'#0029F8':key==='0:0'?'#FCFA7C':value.bg,fg:key.startsWith('1:')?'#FFFFFF':'#333333'};colors.combinationEditing=true;p.colors=colors;
 return p;
}
