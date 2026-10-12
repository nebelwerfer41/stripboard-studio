/* Local Chromium checks, including the real MSD sample and Studio/native round-trips. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const base=process.env.STUDIO_URL||'http://127.0.0.1:8766';
const out=process.env.STUDIO_TEST_OUTPUT||'/tmp/stripboard-dood-qa';
(async()=>{
 await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));page.on('dialog',d=>d.accept());await page.addInitScript(()=>{delete window.showSaveFilePicker});
 await page.goto(base);await page.waitForSelector('.strip-outer');await page.locator('#doodNav').click();await page.waitForSelector('.dood-grid');
 const categories=await page.evaluate(async()=>{
  const {parseMsd}=await import('./assets/msd-parser.js'),project=await parseMsd(await(await fetch('./samples/Wonderful%20Life%20Demo.msd')).arrayBuffer());
  return Object.fromEntries([...new Set(project.elements.map(el=>el.category))].map(category=>[category,project.elements.filter(el=>el.category===category).map(el=>el.name).sort()]));
 });
 assert.equal(await page.locator('#doodCategory option[value=""]').count(),0);
 const firstCategory=await page.locator('#doodCategory').inputValue();assert(firstCategory);
 const rowNames=async()=> (await page.locator('.dood-grid tbody .dood-name').allTextContents()).sort();
 assert.deepEqual(await rowNames(),categories[firstCategory]);
 const otherCategory=Object.keys(categories).find(c=>c!==firstCategory);assert(otherCategory);
 await page.locator('#doodCategory').selectOption(otherCategory);assert.deepEqual(await rowNames(),categories[otherCategory]);
 // An empty or obsolete UI value falls back to a single valid category.
 await page.locator('#doodCategory').evaluate(el=>{el.value='';el.dispatchEvent(new Event('change',{bubbles:true}))});
 assert.equal(await page.locator('#doodCategory').inputValue(),firstCategory);assert.deepEqual(await rowNames(),categories[firstCategory]);
 assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');
 console.log('PASS one category at a time: default, switching and invalid selection fallback without file changes');
 const builtins=await page.evaluate(async()=>{
  const {parseMsd}=await import('./assets/msd-parser.js'),p=await parseMsd(await(await fetch('./samples/Wonderful%20Life%20Demo.msd')).arrayBuffer());
  const board=p.boards.find(b=>b.name===p.activeBoard)||p.boards[0],scenes=new Map(p.scenes.map(s=>[s.bdsId,s]));
  return Object.fromEntries([['Set','set'],['Location','location'],['Script Day','scriptDay'],['Unit','unit'],['Sequence','sequence'],['DN','dn'],['INT/EXT','ie']].map(([category,field])=>{
   const dates=new Map();
   for(const group of board.scheduledGroups.filter(g=>g.kind==='ScheduleDay'&&g.date))for(const strip of group.strips.filter(s=>s.kind==='scene')){
    const name=scenes.get(strip.bdsId)?.[field];if(!name)continue;if(!dates.has(name))dates.set(name,new Set());dates.get(name).add(group.date);
   }
   return [category,Object.fromEntries([...dates].map(([name,days])=>[name,[...days].sort()]))];
  }));
 });
 for(const [category,elements] of Object.entries(builtins)){
  await page.locator('#doodCategory').selectOption(category);
  const observed=await page.locator('.dood-grid tbody tr').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[
   row.querySelector('.dood-name').textContent,[...row.querySelectorAll('[data-dood-cell]')].filter(cell=>/^(SWF|SW|WF|W)( |$)/.test(cell.textContent)).map(cell=>cell.dataset.doodCell).sort()
  ])));
  for(const [name,dates] of Object.entries(elements))assert.deepEqual(observed[name],dates,`${category}: ${name}`);
 }
 assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');
 console.log('PASS MSD built-in attendance matches scheduled scene fields for Set, Location, Script Day, Unit, Sequence, DN and INT/EXT');
 const category=await page.locator('#doodCategory option').evaluateAll(els=>els.find(el=>/Cast/i.test(el.textContent)).value);await page.locator('#doodCategory').selectOption(category);
 assert.equal(await page.locator('.dood-grid tbody tr').count(),59);assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');
 await page.locator('.dood-rules summary').click();await page.locator('[data-dood-rule=allowHold]').uncheck();assert.equal(await page.locator('[data-dood-rule=allowDrop]').isDisabled(),true);assert.equal(await page.locator('#saveButton').innerText(),'↓ Salva progetto Studio');
 await page.locator('#undoMoveButton').click();assert(await page.locator('[data-dood-rule=allowHold]').isChecked());await page.locator('#redoMoveButton').click();assert(!(await page.locator('[data-dood-rule=allowHold]').isChecked()));
 // Element override + category inheritance.
 const actor=await page.locator('#doodRuleElement option').evaluateAll(els=>els.find(el=>/George/.test(el.textContent)).value);await page.locator('#doodRuleElement').selectOption(actor);await page.locator('[data-dood-rule=allowHold]').check();
 await page.locator('[data-dood-rule=allowDrop]').check();await page.locator('[data-dood-rule=minimumCalendarDays]').fill('5');await page.locator('[data-dood-rule=minimumCalendarDays]').dispatchEvent('change');
 await page.locator('.dood-rules summary').click();
 const workedCell=page.locator('[data-dood-element]').filter({hasText:/SW/}).first();await workedCell.click();assert(await page.locator('.dood-cell-detail').isVisible());await page.locator('[data-dood-scene]').first().click();assert(await page.locator('#boardView').isVisible());assert(await page.locator('.strip-active').count()>0);
 await page.locator('#doodNav').click();
 // Multiple targets and inclusive interval in the one Calendar/DOOD event model.
 await page.locator('#doodView [data-event-manager]').click();await page.locator('#productionEventForm [name=type]').selectOption('travel');await page.locator('#productionEventForm [name=name]').fill('Travel QA');await page.locator('#productionEventForm [name=startDate]').fill('2008-06-15');await page.locator('#productionEventForm [name=endDate]').fill('2008-06-16');await page.locator('#productionEventForm [name=targets]').selectOption([actor]);await page.locator('#productionEventForm button[type=submit]').click();assert.match(await page.locator('.production-event-list').innerText(),/Travel QA/);await page.locator('#productionEventDialog [data-close]').click();assert(await page.locator('[data-dood-element]').filter({hasText:'TR'}).count()>0);
 // Original native export does not inject Studio-only data.
 let download=page.waitForEvent('download');await page.locator('#doodNativeExport').click();const native=path.join(out,'native.msd');await(await download).saveAs(native);assert.deepEqual(await fs.readFile(native),await fs.readFile(path.join(__dirname,'../samples/Wonderful Life Demo.msd')));
 download=page.waitForEvent('download');await page.locator('#saveButton').click();const saved=path.join(out,'project.studio.json');await(await download).saveAs(saved);assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');const json=JSON.parse(await fs.readFile(saved,'utf8'));assert.equal(json.events.length,1);assert.equal(json.events[0].targets[0].elementId,actor);assert(!JSON.stringify(json.studio).includes('sceneWork'));
 await page.locator('#fileInput').setInputFiles(saved);await page.waitForFunction(()=>document.querySelector('#doodRuleElement')?.value==='');await page.waitForSelector('.dood-grid');await page.locator('#doodCategory').selectOption(category);await page.locator('.dood-rules summary').click();assert(!(await page.locator('[data-dood-rule=allowHold]').isChecked()));await page.locator('#doodRuleElement').selectOption(actor);assert(await page.locator('[data-dood-rule=allowDrop]').isChecked());assert.equal(await page.locator('[data-dood-rule=minimumCalendarDays]').inputValue(),'5');await page.locator('.dood-rules summary').click();
 await page.screenshot({path:path.join(out,'dood-desktop.png')});
 // Native roundtrip metadata for MMSX 5 / 3 / hybrid and distinct Sub-Boards.
 const roundtrips=await page.evaluate(async()=>{
  const {fixture}=await import('./tests/fixtures/calendar.mjs'),{encodeMmsx}=await import('./assets/mmsx-codec.js'),{parseMmsx,serializeMmsx}=await import('./assets/mmsx-project.js'),{serializeStudio,parseStudio,setDoodRules}=await import('./assets/studio-project.js');
  const results=[];
  for(const format of ['5','3','hybrid']){
    const bytes=await encodeMmsx(fixture(format)),project=await parseMmsx(bytes,'qa.mmsx');setDoodRules(project,project.boards[0].name,{category:'Cast',rules:{allowHold:true,allowDrop:true,minimumCalendarDays:3}});
    project.events.push({id:'test',studio:true,type:'fitting',startDate:'2026-10-01',endDate:'2026-10-02',calendarId:project.boards[0].calendarId,targets:[{kind:'element',elementId:'actor'}]});
    const again=await parseStudio(await serializeStudio(project));results.push({format,rules:again.studio.dood[project.boards[0].name].categories.Cast,nativeUnchanged:Array.from(await serializeMmsx(again,'qa.mmsx')).join(',')===Array.from(bytes).join(','),events:again.events.filter(e=>e.studio).length});
  }return results;
 });
 for(const r of roundtrips){assert.equal(r.events,1);assert.equal(r.rules.minimumCalendarDays,3);assert(r.nativeUnchanged)}
 const newBoard=await page.evaluate(async()=>{
  const {parseMsd}=await import('./assets/msd-parser.js'),{createStripboard}=await import('./assets/scheduling.js'),{serializeStudio,parseStudio,setDoodRules}=await import('./assets/studio-project.js'),{calculateDood}=await import('./assets/dood-engine.js');
  const project=await parseMsd(await(await fetch('./samples/Wonderful Life Demo.msd')).arrayBuffer(),'source.msd');
  const board=createStripboard(project,{name:'DOOD alternative',sourceBoardName:project.activeBoard});setDoodRules(project,board.name,{category:'Cast Members',rules:{allowHold:false}});
  const actor=project.elements.find(e=>e.name==='George');project.events.push({id:'new-board',studio:true,type:'travel',studioBoardName:board.name,calendarId:board.calendarId,scope:{boardId:board.parentBoardId,segmentId:board.segmentId},startDate:'2008-06-15',endDate:'2008-06-15',targets:[{kind:'element',elementId:actor.id}]});
  const again=await parseStudio(await serializeStudio(project)),restored=again.boards.find(b=>b.name===board.name),calendar=again.calendars.find(c=>c.id===restored.calendarId);
  return calculateDood({project:again,board:restored,calendar}).rows.find(r=>r.element.name==='George').totals.travel;
 });assert.equal(newBoard,1);
 console.log('PASS real MSD rules, events, scene navigation, history, Studio/native roundtrip; MMSX 5/3/hybrid');
 // Shared page service, bidimensional pages, live settings, Summary-only.
 await page.locator('#doodPrint').click();const frame=page.frameLocator('#studioPrintDialog iframe');await frame.locator('.print-page').first().waitFor();assert(await frame.locator('.print-page').count()>2);
 const before=await frame.locator('.print-page').count();await page.locator('[data-setting=paper]').selectOption('A3');await page.waitForFunction(()=>document.querySelector('#studioPrintDialog iframe').contentDocument.querySelector('.print-page')?.style!==undefined);await frame.locator('.print-page').first().waitFor();assert(await frame.locator('.print-page').count()<before);
 await page.locator('[data-setting=summary]').selectOption('only');await frame.locator('[data-kind=summary]').first().waitFor();assert.equal(await frame.locator('[data-kind=matrix]').count(),0);
 await page.locator('[data-setting=paper]').selectOption('A4');await page.locator('[data-setting=summary]').selectOption('after');await frame.locator('[data-kind=matrix]').first().waitFor();
 const expected=await frame.locator('.print-page').count(),srcdoc=await page.locator('#studioPrintDialog iframe').getAttribute('srcdoc');
 const printPage=await browser.newPage();await printPage.setContent(srcdoc,{waitUntil:'networkidle'});await printPage.emulateMedia({media:'print'});
 const overflow=await printPage.locator('.print-page').evaluateAll(pages=>pages.map(page=>{const content=page.querySelector('.print-content'),table=page.querySelector('table'),footer=page.querySelector('footer');return {right:table.getBoundingClientRect().right-content.getBoundingClientRect().right,bottom:table.getBoundingClientRect().bottom-footer.getBoundingClientRect().top}}));assert(overflow.every(o=>o.right<2&&o.bottom<2),JSON.stringify(overflow));
 const pdf=path.join(out,'DOOD.pdf');await printPage.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'});assert.equal(Number(/Pages:\s+(\d+)/.exec(info)[1]),expected);
 const text=execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8'});assert.match(text,/George/);assert.match(text,/DOOD Summary/);assert.equal((text.match(/Pagina \d+ \/ \d+/g)||[]).length,expected);
 await printPage.screenshot({path:path.join(out,'dood-print.png'),fullPage:true});await printPage.close();
 await page.locator('#studioPrintDialog [data-close]').click();await page.locator('#boardNav').click();await page.locator('#printButton').click();await frame.locator('[data-kind=schedule]').first().waitFor();assert(await frame.locator('.strip-layout').count()>0);await page.locator('#studioPrintDialog [data-close]').click();
 // Existing standard/native-vertical layouts and phone source geometry share the service.
 const choices=await page.locator('#layoutSelect option').evaluateAll(els=>({standard:els.find(el=>el.value==='studio:compact')?.value,vertical:els.find(el=>/vertical/i.test(el.value))?.value}));
 for(const choice of [choices.standard,choices.vertical].filter(Boolean)){
  await page.locator('#layoutSelect').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))},choice);
  await page.locator('#printButton').click();await frame.locator('[data-kind=schedule]').first().waitFor();assert.equal(await frame.locator('.strip-layout').count(),await page.locator('#boardView .strip-layout').count());
  await page.locator('#studioPrintDialog [data-close]').click();
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#printButton').click();await frame.locator('[data-kind=schedule]').first().waitFor();assert.equal(await frame.locator('.strip-mobile-summary').count(),0);assert(await frame.locator('.strip-layout').count()>0);await page.locator('#studioPrintDialog [data-close]').click();await page.setViewportSize({width:1600,height:1050});
 console.log('PASS shared preview, pagination geometry, Summary-only and actual PDF page/text parity');
 await page.locator('#doodNav').click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'dood-phone.png')});const bounds=await page.locator('body').evaluate(el=>({scroll:el.scrollWidth,width:innerWidth}));assert(bounds.scroll<=bounds.width+1,JSON.stringify(bounds));
 assert.deepEqual(errors,[]);console.log('ALL DOOD BROWSER CHECKS PASSED');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
