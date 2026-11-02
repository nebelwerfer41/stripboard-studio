/* Reproducible synthetic exports; browser supplies the repository's real DOM/MSD parser. */
const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const base=process.env.STUDIO_URL||'http://127.0.0.1:8766';
const output=path.resolve(process.env.STUDIO_MANUAL_OUTPUT||path.join(__dirname,'../verification/movie-magic'));
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage();await page.goto(base);
 const result=await page.evaluate(async()=>{
  const {syntheticProject}=await import('./tests/fixtures/persistence.mjs');
  const {serializeMsd}=await import('./assets/msd-writer.js'),{parseMsd}=await import('./assets/msd-parser.js');
  const {serializeMmsx,parseMmsx}=await import('./assets/mmsx-project.js');
  const {analyzeExport,commonMmsxRoot}=await import('./assets/export-adapters.js');
  const {serializeStudio,parseStudio}=await import('./assets/studio-project.js');
  const {createDocument,createPlan,addDay,editFlag,snapshotDocument,editScene,editElement}=await import('./assets/document-model.js');
  const {associationQuantity,parseQuantityName}=await import('./assets/quantities.js');
  const {boardIdConflicts}=await import('./assets/element-ids.js');
  const {builtinField}=await import('./assets/element-management.js');
  const {projectMsdElements,projectMsdBoards,projectMsdRedFlags,eligibleMsdEvent,zeroQuantity}=await import('./assets/native-export-projections.js');
  const {encodeMmsx,ExactNumber}=await import('./assets/mmsx-codec.js');
  let counter=0,random=271828;crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++counter).padStart(12,'0')}`;
  crypto.getRandomValues=bytes=>{for(let i=0;i<bytes.length;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;bytes[i]=random&255}return bytes};
  const files=[],checks=[];
  const ok=(value,message)=>{if(!value)throw Error(message);checks.push(message)};
  const b64=bytes=>{const data=new Uint8Array(bytes);let s='';for(let i=0;i<data.length;i+=32768)s+=String.fromCharCode(...data.subarray(i,i+32768));return btoa(s)};
  const parse=(bytes,target)=>target==='msd'?parseMsd(new Uint8Array(bytes).buffer,'synthetic.msd'):parseMmsx(bytes,'synthetic.mmsx');
  const save=async(name,p,target,origin,operations)=>{
   const report=analyzeExport(p,target);ok(!report.blockers.length,`${name}: nessun impedimento: ${JSON.stringify(report.blockers)}`);
   const before=JSON.stringify(snapshotDocument(p));
   const bytes=target==='msd'?serializeMsd(p,{acceptLoss:true}):await serializeMmsx(p,name,{acceptLoss:true});
   ok(JSON.stringify(snapshotDocument(p))===before,`${name}: export senza mutazioni`);
   const q=await parse(bytes,target);
   ok(q.scenes.length===p.scenes.length&&q.boards.length===p.boards.length,`${name}: scene e piani reimportati`);
   for(let i=0;i<p.scenes.length;i++){
    const a=p.scenes[i],b=q.scenes[i];
    for(const field of ['scene','synopsis','comments','set','location','ie','dn','unit','sequence','episode','scriptDay','scriptPageNumbers','estimateTimeA','estimateTimeB'])ok((target==='msd'&&field==='dn'?String(a[field]??'').toLowerCase()===String(b[field]??'').toLowerCase():String(target==='msd'&&field==='estimateTimeB'?'':a[field]??'')===String(b[field]??'')),`${name}: scena ${i} campo ${field}`);
    ok(a.pagesEighths===b.pagesEighths,`${name}: scena ${i} ottavi incluso zero`);
    for(const ref of a.elementRefs){if(builtinField(ref.category))continue;const projected=target==='msd'?projectMsdElements(p).sceneRefs.get(a.bdsId)?.find(e=>e.originalId===ref.elementId):null,projectedName=projected?.name||(p.quantitySettings.mode==='name'?parseQuantityName(ref.name).name:ref.name),other=b.elementRefs.find(r=>r.name===projectedName&&r.category===ref.category);ok(Boolean(other),`${name}: relazione ${ref.category}/${projectedName}`);ok(target==='msd'?other.quantity===1:JSON.stringify(other.quantity)===JSON.stringify(associationQuantity(p,ref)),`${name}: quantità ${ref.name}`)}
   }
   for(let i=0;i<p.boards.length;i++){
    const a=p.boards[i],b=q.boards[i];
    for(const container of ['scheduledGroups','unscheduledGroups']){
     const expectedGroups=target==='msd'&&container==='unscheduledGroups'?projectMsdBoards(p)[i].unscheduledGroups.filter(g=>g.kind!=='UnscheduledDay'||g.strips.length).map(g=>({...g,kind:g.kind==='UnscheduledDay'?'RemainingUnscheduledStrips':g.kind})):a[container];
     ok(expectedGroups.length===b[container].length,`${name}: numero gruppi ${i}/${container}`);
     for(let j=0;j<expectedGroups.length;j++){
      const g=expectedGroups[j],h=b[container][j];
      ok(g.kind===h.kind,`${name}: tipo gruppo ${i}/${container}/${j}`);
      ok(JSON.stringify(g.strips.map(s=>s.kind==='banner'?['banner',s.text]:['scene',p.scenes.find(x=>x.bdsId===s.bdsId).scene]))===JSON.stringify(h.strips.map(s=>s.kind==='banner'?['banner',s.text]:['scene',q.scenes.find(x=>x.bdsId===s.bdsId).scene])),`${name}: ordine strip ${i}/${container}/${j}`);
      if(g.kind==='ScheduleDay')ok(g.date===h.date&&h.shootingDayNumber===(target==='msd'?j+1:g.shootingDayNumber),`${name}: data/numero giornata ${i}/${j}`);
     }
    }
   }
   for(const e of target==='msd'?projectMsdElements(p).elements:p.elements){const expectedName=target==='mmsx'&&p.quantitySettings.mode==='name'&&!/^(Cast|Cast Members)$/i.test(e.category)?parseQuantityName(e.name).name:e.name,other=q.elements.find(x=>x.name===expectedName&&x.category===e.category);ok(Boolean(other),`${name}: catalogo ${e.category}/${e.name}`);for(const [key,value] of Object.entries(e.properties||{})){if(target==='msd'&&value&&typeof value==='object')ok(!Object.hasOwn(other.properties,key),`${name}: proprietà strutturata omessa ${key}`);else ok(JSON.stringify(other.properties[key]??other.properties[Object.keys(q.categorySettings.find(c=>c.name===other.category)?.properties||{}).find(pid=>{const def=q.categorySettings.find(c=>c.name===other.category).properties[pid];const original=p.categorySettings.find(c=>c.name===e.category)?.properties?.[key];return def.name===(original?.name||key)})])===JSON.stringify(target==='msd'?String(value??''):value),`${name}: proprietà ${e.name}/${key}`)}}
   for(const b of p.boards){const cal=p.calendars.find(c=>c.id===b.calendarId),other=q.calendars.find(c=>c.id===q.boards[p.boards.indexOf(b)].calendarId);if(cal){ok(JSON.stringify(other.daysOff)===JSON.stringify(cal.daysOff),`${name}: pattern calendario`);ok(target==='mmsx'&&!cal.scheduleDates.ProductionStartDate?.iso?Boolean(other.scheduleDates.ProductionStartDate?.iso):((other.scheduleDates.ProductionStartDate?.iso??null)===(cal.scheduleDates.ProductionStartDate?.iso??null)),`${name}: inizio produzione o default navigazione dichiarato`);ok(other.specialDays.length===cal.specialDays.length,`${name}: eccezioni calendario`)}}
   if(target==='msd'){
    const flags=projectMsdRedFlags(p),elements=projectMsdElements(p),expected=flags.entries.flatMap(f=>(f.target.kind==='project'?[null]:elements.byOriginal.get(f.target.elementId)||[]).map(e=>({name:f.name,date:f.date,note:f.note,element:e?.name||null,category:e?.category||null,status:f.doodStatus})));
    ok(q.redFlags.length===expected.length,`${name}: conteggio Red Flags incluse conversioni eventi e varianti quantità`);
    const actual=q.redFlags.map(f=>({name:f.name,date:f.date,note:f.note,element:f.target.element,category:f.target.category,status:f.doodStatus}));ok(JSON.stringify(actual)===JSON.stringify(expected),`${name}: date, tipi, note, destinatari e codici DOOD delle Red Flags`);
    ok(q.events.length===0,`${name}: record evento sostituiti/omessi come dichiarato`);
    if(p.events.some(eligibleMsdEvent))ok(report.transformed.some(x=>x.code==='events-to-redflags'),`${name}: notifica conversione eventi`);
    if(projectMsdElements(p).elements.some(e=>e.name!==p.elements.find(x=>x.id===e.originalId)?.name))ok(report.transformed.some(x=>x.code==='quantity-element-names'),`${name}: notifica quantità nei nomi`);
    for(const board of q.boards){const ids=[...board.scheduledGroups,...board.unscheduledGroups].flatMap(g=>g.strips).filter(s=>s.kind==='scene').map(s=>s.bdsId);ok(ids.length===q.scenes.length&&new Set(ids).size===q.scenes.length,`${name}: ogni stripboard contiene tutte le scene esattamente una volta`)}
   }else{for(const f of p.redFlags){const el=p.elements.find(e=>e.id===f.target.elementId);ok(q.redFlags.some(x=>x.name===f.name&&x.note===f.note&&x.target.element===(p.quantitySettings.mode==='name'?parseQuantityName(el?.name).name:el?.name)),`${name}: target/nota Red Flag`)}ok(q.redFlags.length===p.redFlags.length,`${name}: Red Flags, intervalli inclusivi`)}
   if(target==='mmsx')for(const event of p.events)ok(q.events.some(e=>e.name===event.name&&e.startDate===event.startDate&&e.endDate===event.endDate&&e.targets.some(t=>t.element===p.elements.find(x=>x.id===event.targets[0].elementId)?.name)),`${name}: evento e target reimportati`);
   const {exportColorSettings,sceneExportColors,nativeMmsxColor}=await import('./assets/export-colors.js'),{palette}=await import('./assets/mmsx-palette.js');
   if(target==='mmsx')for(let i=0;i<p.scenes.length;i++){const input=sceneExportColors(p,p.scenes[i]);for(const key of ['fg','bg'])ok(q.scenes[i].mmsxColors[key].toUpperCase()===(report.mode==='native'?input[key]:palette[nativeMmsxColor(input[key])]).toUpperCase(),`${name}: colore scena ${i} ${key}`)}
   if(target==='msd'){const input=exportColorSettings(p),actual=exportColorSettings(q);for(const [key,value] of Object.entries(input.cells))for(const channel of ['bg','fg'])ok(value[channel].toUpperCase()===actual.cells[key][channel].toUpperCase(),`${name}: colore griglia ${key}/${channel}`);ok(JSON.stringify(input.palette.map(x=>x.toUpperCase()))===JSON.stringify(actual.palette.map(x=>x.toUpperCase())),`${name}: palette RGB MSD`)}
   const outputColors=exportColorSettings(q),groupContent=groups=>groups.map(g=>({kind:g.kind,date:g.date,number:g.shootingDayNumber,strips:g.strips.map(s=>s.kind==='banner'?{kind:'banner',text:s.text}:{kind:'scene',scene:q.scenes.find(x=>x.bdsId===s.bdsId)?.scene})}));
   ok(!boardIdConflicts(q.elements).length,`${name}: Board ID unici per categoria`);
   const expected={title:q.title,scenes:q.scenes.map(s=>({scene:s.scene,synopsis:s.synopsis,comments:s.comments,set:s.set,location:s.location,ie:s.ie,dn:s.dn,estimateTime:s.estimateTimeA,screenTime:s.estimateTimeB,pagesEighths:s.pagesEighths,colors:sceneExportColors(q,s),quantities:s.elementRefs.map(r=>({category:r.category,name:r.name,quantity:r.quantity}))})),boards:q.boards.map(b=>({name:b.name,parent:b.parentBoardId,segment:b.segmentId,calendar:b.calendarName,days:b.scheduledGroups.filter(g=>g.kind==='ScheduleDay').map(g=>({date:g.date,number:g.shootingDayNumber})),scheduledStrips:b.scheduledGroups.reduce((n,g)=>n+g.strips.length,0),boneyardStrips:b.unscheduledGroups.reduce((n,g)=>n+g.strips.length,0),scheduled:groupContent(b.scheduledGroups),boneyard:groupContent(b.unscheduledGroups)})),elements:q.elements.length,calendars:q.calendars.length,events:q.events.length,redFlags:q.redFlags.length,eventDetails:q.events,redFlagDetails:q.redFlags,colors:{rows:outputColors.rows,columns:outputColors.columns,palette:target==='mmsx'?palette:outputColors.palette,nativeRules:q.colors.nativeRules,preferences:outputColors.preferences,cells:Object.fromEntries(Object.entries(outputColors.cells).filter(([key])=>{const [row,col]=key.split(':');return outputColors.rows[row]&&outputColors.columns[col]&&(target==='msd'||row!=='11'&&col!=='11')}))}};
   files.push({name,bytes:b64(bytes),origin,operations,variant:report.variant,expected,compatibility:report,automatic:'PASS: parser destinazione e confronto con modello corrente',manual:'DA ESEGUIRE'});return {p:q,bytes};
  };
  const pair=async(prefix,p,origin,operations)=>{await save(prefix+'.msd',p,'msd',origin,operations);await save(prefix+'.mmsx',p,'mmsx',origin,operations)};
  const min=syntheticProject(),complex=syntheticProject(true);
  await pair('01-new-minimal',min,'Modello comune nuovo sintetico',['creazione progetto vuoto']);
  const single=syntheticProject();editScene(single,null,{scene:'1',synopsis:'Una scena sintetica',pagesEighths:null});await pair('01b-new-single-scene',single,'Modello comune nuovo sintetico',['una scena nel Boneyard, nessuna giornata']);
  await pair('02-new-complex',complex,'Modello comune nuovo sintetico',['creazione scene, elementi, quantità assente/zero/3, banner, 2 piani, 2 giornate, evento, Red Flag su 3 date']);
  const sourceMsd=serializeMsd(complex,{acceptLoss:true}),importMsd=await parse(sourceMsd,'msd');
  editScene(importMsd,importMsd.scenes[0].id,{synopsis:'MSD modificato: città e caffè',comments:'Modifica dopo importazione'});importMsd.documentEditing=true;
  editElement(importMsd,importMsd.elements.find(e=>e.name==='Èlia').id,{name:'Èlia aggiornata',category:'Cast',properties:{note:'Aggiornato'}});
  await pair('03-import-msd-edited',importMsd,'02-new-complex.msd',['import MSD sintetico','editing completo scena ed elemento','export MSD / conversione MSD→MMSX']);
  // Multiple normal segments share one Boneyard in this synthetic MMSX source.
  const root=commonMmsxRoot(complex),boards=Object.values(root.contents.stripboard),first=boards[0],second=boards[1];
  const segment=Object.values(second.segmentMap).find(s=>s.type==='normal');const secondSheet=Object.values(Object.values(root.contents.breakdown)[0].sheetMap).find(s=>s.scenes==='2');for(const r of Object.values(segment.stripMap)){if(r.type==='breakdown'){r.sheet=secondSheet.id;r.sortOrder=2;r.date='20261007';r.shootDay=2}if(r.type==='day')r.eighths=0}for(const yard of Object.values(first.segmentMap).filter(s=>s.type==='boneyard'))for(const [id,r] of Object.entries(yard.stripMap))if(r.sheet===secondSheet.id)delete yard.stripMap[id];first.segmentMap[segment.id]={...segment,name:'Secondo segmento'};delete root.contents.stripboard[Object.keys(root.contents.stripboard)[1]];
  root.syntheticOpaque={exact:new ExactNumber('900719925474099312345'),note:'Synthetic distributable source'};
  const sourceMmsx=await encodeMmsx(root),importMmsx=await parse(sourceMmsx,'mmsx');
  importMmsx.documentEditing=true;editScene(importMmsx,importMmsx.scenes[0].id,{synopsis:'MMSX modificato: perché sì',comments:'Modifica completa'});importMmsx.documentEditing=true;
  await pair('04-import-mmsx-edited',importMmsx,'MMSX sintetico con due segmenti e sorgente opaco',['import MMSX dataFormat 5','editing completo scena','export MMSX / conversione MMSX→MSD']);
  for(const [prefix,p] of [['05-studio-new',complex],['06-studio-msd',importMsd],['07-studio-mmsx',importMmsx]]){
   const studio=await serializeStudio(p),q=await parseStudio(studio);
   ok(JSON.stringify(snapshotDocument(q))===JSON.stringify(snapshotDocument(p)),`${prefix}: modello Studio integrale`);
   if(p.mmsxSource)ok(b64(q.mmsxSource.bytes)===b64(p.mmsxSource.bytes),`${prefix}: sorgente opaco identico`);
   if(p.sourceDocument)ok(b64(q.sourceDocument.bytes)===b64(p.sourceDocument.bytes),`${prefix}: sorgente MSD identico`);
   files.push({name:prefix+'.studio.json',bytes:b64(studio),origin:p.provenance||'Modello nuovo',operations:['salvataggio Studio v3','riapertura Studio'],variant:'Studio v3 / modello v3',automatic:'PASS',manual:'DA ESEGUIRE: aprire in Studio e poi esportare',expected:{title:q.title,scenes:q.scenes.length}});
   await pair(prefix,q,prefix==='05-studio-new'?'Modello nuovo del caso 02':prefix==='06-studio-msd'?'02-new-complex.msd + modifiche del caso 03':'08-native-noop.mmsx + modifiche del caso 04',['salvataggio Studio v3','riapertura Studio','export delle modifiche correnti']);
  }
  for(const [target,source] of [['msd',sourceMsd],['mmsx',sourceMmsx]]){
   const p=await parse(source,target),result=await save('08-native-noop.'+target,p,target,'Archivio sintetico nativo',['importazione','nessuna modifica','export conservativo']);ok(b64(source)===b64(result.bytes),`${target}: identità binaria nativa`);
  }
  for(const version of [1,2]){
   const p=await parse(sourceMmsx,'mmsx'),native=b64(sourceMmsx),data=version===1?{type:'stripboard-studio',version:1,fileName:'synthetic.mmsx',native,studio:{version:1,dood:{},print:{}},events:[]}:{type:'stripboard-studio',version:2,fileName:'synthetic.mmsx',native,format:'mmsx',document:snapshotDocument(p),views:{stripLayouts:p.stripLayouts,reportLayouts:p.reportLayouts,colors:p.colors}};
   // JSON v2 historically represented exact-number objects as plain records.
   const q=await parseStudio(new TextEncoder().encode(JSON.stringify(data))),again=await parseStudio(await serializeStudio(q));
   await pair(`09-migrate-v${version}`,again,`Studio v${version} sintetico`,['migrazione a Studio v3','riapertura','export MSD/MMSX']);
  }
  // Focused MSD controls: use only if the corrected complex case is still rejected.
  for(const feature of ['time','unicode','properties','empty-day','redflag','second-plan','int-ext-dn']){
   const p=createDocument('Diagnostic control');const scene=editScene(p,null,{scene:'1',synopsis:'Diagnostic control',pagesEighths:8});
   if(feature==='time')editScene(p,scene.id,{estimateTimeA:'1:30'});
   if(feature==='unicode')editScene(p,scene.id,{synopsis:'Caffè — città àèìòù'});
   if(feature==='properties'||feature==='redflag'){const e=editElement(p,null,{name:'Synthetic prop',category:'Props',properties:feature==='properties'?{count:0}:{}});editScene(p,scene.id,{},[{elementId:e.id,name:e.name,category:e.category,quantity:null,resolved:true}]);if(feature==='redflag')editFlag(p,null,{name:'Unavailable',note:'Synthetic constraint',startDate:'2026-10-06',endDate:'2026-10-08',target:{kind:'element',elementId:e.id,element:e.name,category:e.category}})}
   if(feature==='empty-day'){p.calendars[0].scheduleDates.ProductionStartDate={iso:'2026-10-06',origin:'edited'};addDay(p,p.boards[0].id,{date:'2026-10-06',shootingDayNumber:1})}
   if(feature==='second-plan')createPlan(p,{name:'Second plan',calendarId:p.calendars[0].id,copyFrom:p.boards[0].id});
   if(feature==='int-ext-dn')editScene(p,scene.id,{ie:'INT',dn:'DAY'});
   await save(`10-diagnostic-${feature}.msd`,p,'msd','Controllo sintetico con una sola caratteristica aggiunta',[feature]);
  }
  for(const [quantity,events,name] of [[0,false,'zero-no-events'],[null,true,'absent-events'],[null,false,'absent-no-events'],[1,false,'one-no-events']]){const p=syntheticProject(true),ref=p.scenes[0].elementRefs.find(r=>r.name==='Èlia');ref.quantity=quantity??1;ref.legacyQuantity=quantity===0?0:undefined;ref.quantity=ref.quantity===0?1:ref.quantity;ref.quantityOrigin=quantity===null?'absent':'stored';if(!events)p.events=[];await save(`11-redflag-${name}.mmsx`,p,'mmsx','Controllo quantità / eventi',['Quantità Èlia '+String(quantity),'Eventi '+String(events)])}
  const zeroActor=syntheticProject(true);zeroActor.scenes[0].elementRefs.find(r=>r.name==='Èlia').legacyQuantity=0;await save('11-redflag-actor-zero.mmsx',zeroActor,'mmsx','Variante esplicita del caso 02',['Zero storico normalizzato a 1: confronto con il singolo del caso 02']);
  for(const [name,end] of [['single-day','2026-10-06'],['scheduled-range','2026-10-07']]){const p=syntheticProject(true);p.events=[];p.redFlags[0].endDate=end;await save(`11-redflag-${name}.mmsx`,p,'mmsx','Controllo intervallo Red Flag, quantità uno, nessun evento',['Fine intervallo '+end])}
  const ordinary=syntheticProject(true);ordinary.events[0].type='none';ordinary.events[0].color='#10457A';await save('12-event-native-none.mmsx',ordinary,'mmsx','Controllo evento ordinario, come quello aggiunto nel campione risalvato',['Evento type none, colore esplicito, target Èlia']);
  const customColors=syntheticProject(true);customColors.colors.combinationEditing=false;customColors.scenes[0].mmsxColors={bg:'#FF0000',fg:'#FFFFFF'};await pair('13-color-losses',customColors,'Controllo colori fuori palette / override per scena',['Sfondo rosso RGB fuori palette token MMSX verificata','Override per scena divergente dalla combinazione: in MSD prevale la griglia, perdita dichiarata']);
  const system=syntheticProject(true);system.events=[];system.calendars[0].scheduleDates.ProductionEndDate={iso:'2026-10-11',origin:'edited'};for(const board of system.boards){addDay(system,board.id,{date:'2026-10-09',shootingDayNumber:3});addDay(system,board.id,{date:'2026-10-10',shootingDayNumber:4})}const actor=system.elements.find(e=>e.name==='Èlia'),prop=system.elements.find(e=>e.name==='Tazzina blu');for(const [i,[type,date]] of [['travel','2026-10-06'],['fitting','2026-10-07'],['rehearsal','2026-10-09'],['unavailable','2026-10-10'],['none','2026-10-11']].entries())system.events.push({id:'system-event-'+i,name:'Evento sintetico '+type,type,note:'Conservare tipo e nota',calendarId:system.calendars[0].id,startDate:date,endDate:date,scope:{kind:'project'},targets:[{kind:'element',elementId:actor.id},{kind:'element',elementId:prop.id}]});await pair('14-system-events',system,'Eventi di sistema e ordinari con più elementi',['Travel/Fitting/Unavailable/Rehearsal → Red Flags per data e variante elemento','Rehearsal usa 0 come campione generale: sigla R per elementi da verificare; none omesso','Nomi quantità leggibili e target coerenti; tipi su date distinte per non sovrapporre sigle']);
  const reserved=syntheticProject(true);reserved.events=[];reserved.redFlags=[];await save('15-msd-system-flag-definitions.msd',reserved,'msd','Definizioni riservate senza entry',['Creare manualmente Travel, Fitting, Rehearsal in MMS6 e verificare le sigle DOOD']);
  const variants=syntheticProject(true),crowd=editElement(variants,null,{name:'Folla sintetica',category:'Background Actors'});crowd.linkedElements=[['Cast','Èlia']];for(const [i,scene] of variants.scenes.entries())editScene(variants,scene.id,{},[...scene.elementRefs,{elementId:crowd.id,name:crowd.name,category:crowd.category,quantity:i?3:1}]);variants.redFlags[0].target={kind:'element',elementId:crowd.id,category:crowd.category,element:crowd.name};await save('16-msd-quantity-variants.msd',variants,'msd','Quantità diverse per una categoria con controllo attivo',['Folla senza suffisso nella prima scena, Folla (3) nella seconda','Cast resta singolo','Red Flags e collegamenti aggiornati; Board ID sempre assegnati e distinti']);
  const names=syntheticProject(true),nameProp=names.elements.find(e=>e.name==='Tazzina blu');editElement(names,nameProp.id,{...nameProp,name:'Tazzine (5)'});names.quantitySettings.mode='name';await pair('17-quantity-from-name',names,'Calcolo quantità dal nome',['Totale dal suffisso (5), indipendente dal campo numerico','MSD suffisso corretto; MMSX nome pulito con quantità numerica 5']);
  const prefix=syntheticProject(true);prefix.quantitySettings.msdStyle='prefix';await save('18-msd-leading-quantity.msd',prefix,'msd','Alternativa MMS6 numero iniziale',['3 Tazzina blu, nessuna decorazione per singoli']);

  const broken=syntheticProject(true);broken.scenes[0].elementRefs[0].elementId='dangling';ok(analyzeExport(broken,'msd').blockers.length&&analyzeExport(broken,'mmsx').blockers.length,'target irrisolti bloccati');
  broken.scenes[0].elementRefs[0].elementId=broken.elements[0].id;broken.boards[0].scheduledGroups[0].date='2026-10-09';ok(analyzeExport(broken,'msd').blockers.some(x=>x.code.startsWith('msd-')),'date MSD incompatibili bloccate');
  return {files,checks};
 });
 const {decodeMmsx}=await import('../assets/mmsx-codec.js');
 for(const file of result.files.filter(f=>f.name.endsWith('.mmsx'))){const root=await decodeMmsx(Buffer.from(file.bytes,'base64'));for(const key of ['category','element','breakdown','stripboard','rules','redflag','redflagType','layout']){assert(root.contents[key],key);for(const [id,record] of Object.entries(root.contents[key]))assert.equal(record.id,id,`${file.name}: ${key} id`)}for(const b of Object.values(root.contents.breakdown))for(const [id,s] of Object.entries(b.sheetMap))assert.equal(s.id,id,`${file.name}: sheet id`);for(const b of Object.values(root.contents.stripboard))for(const [id,s] of Object.entries(b.segmentMap)){assert.equal(s.id,id,`${file.name}: segment id`);for(const [id,r] of Object.entries(s.stripMap))assert.equal(r.id,id,`${file.name}: strip id`);for(const [id,e] of Object.entries(s.calendar?.eventMap||{}))assert.equal(e.id,id,`${file.name}: event id`);if(s.type==='boneyard')for(const r of Object.values(s.stripMap))assert(!Object.hasOwn(r,'date')&&!Object.hasOwn(r,'shootDay'),`${file.name}: Boneyard strips remain undated`)}}
 const manifest={suiteVersion:6,previousSuite:'v5: eventi di sistema corretti secondo riscontro utente; correggere posizionamento quantità e Board ID vuoti',nativeRecordIdentities:'PASS: controllo indipendente sui file generati',seed:271828,dataPolicy:'Esclusivamente dati sintetici; nessun campione privato o demo copiato',verification:'Parser repository Chromium; NON è una prova di importazione in MMS6/MMS10',checks:result.checks.length,files:[]};
 for(const file of result.files){const {bytes,...entry}=file,data=Buffer.from(bytes,'base64');await fs.writeFile(path.join(output,file.name),data);manifest.files.push({...entry,sha256:createHash('sha256').update(data).digest('hex'),size:data.length})}
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await fs.writeFile(path.join(output,'automatic-checks.json'),JSON.stringify(result.checks,null,2)+'\n');
 await fs.writeFile(path.join(output,'manual-results.csv'),'file,app,versione_esatta,sistema_operativo,data_tester,apertura,dati_relazioni,ordine_strip,date_quantita,colori,day_night,redflags_pagina,redflags_report,one_line_vertical,calendar_report,salvataggio_riapertura,anomalie\n'+manifest.files.filter(f=>/\.(msd|mmsx)$/.test(f.name)).map(f=>`${f.name},${f.name.endsWith('.msd')?'MMS6':'MMS10'},,,,${Array(11).fill('DA ESEGUIRE').join(',')},`).join('\n')+'\n');
 assert(manifest.files.length>=20);console.log(`PASS: ${manifest.files.length} file sintetici; ${manifest.checks} verifiche automatiche; ${output}`);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
