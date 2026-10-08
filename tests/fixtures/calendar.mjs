import {mmsxFixture} from './mmsx.mjs';
import {cloneExact} from '../../assets/mmsx-codec.js';
export function fixture(format='5'){
 const root=cloneExact(mmsxFixture),c=root.contents;
 c.category.custom={name:'Veicoli speciali',sortOrder:4,color:'#123456',propertyDesc:{fuel:{name:'Carburante'}}};
 c.element.car={name:'12 auto',category_id:'custom',properties:{fuel:'Elettrico'}};
 c.breakdown.main.sheetMap.s1.elements.car=2;c.breakdown.main.sheetMap.s1.elements.missing={opaque:true};
 c.breakdown.main.sheetMap.s1.estHours=1;c.breakdown.main.sheetMap.s1.estMinutes=30;c.breakdown.main.sheetMap.s2.scenes='1';
 for(const s of Object.values(c.stripboard.board.segmentMap))s.calendar={prodStart:'20261006',daysOff:96,specialDays:{'20261007':'holiday','invalid':'unrecognized'},eventMap:{e:{eventName:'Test',startDate:'20261007',endDate:'20261009',elements:['actor']}},opaque:{keep:true}};
 c.redflag={rf:{type:'unavailable',startDate:'20261008',endDate:'20261010',elementId:'actor'}};
 c.redflagType={unavailable:{name:'Unavailable',type:'unavailable'}};
 if(format!=='5'){
  root.dataFormat=3;
  const array=map=>Object.entries(map).sort((a,b)=>(a[1].sortOrder||0)-(b[1].sortOrder||0)).map(([id,v])=>{const s={...v,id};delete s.sortOrder;return s});
  for(const b of Object.values(c.breakdown)){b.sheets=format==='hybrid'?[{id:'warning'}]:array(b.sheetMap);if(format!=='hybrid')delete b.sheetMap}
  for(const b of Object.values(c.stripboard)){
   for(const s of Object.values(b.segmentMap)){s.strips=format==='hybrid'?[{id:'warning'}]:array(s.stripMap);if(format!=='hybrid')delete s.stripMap}
   b.segments=format==='hybrid'?[{id:'warning'}]:array(b.segmentMap);if(format!=='hybrid')delete b.segmentMap;
  }
 }
 return root;
}
