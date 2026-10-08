/* Field preferences and real pointer moves, including cross-view drag without a split. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.STUDIO_URL||'http://127.0.0.1:8766';
const output=process.env.STUDIO_TEST_OUTPUT||'/tmp/stripboard-drag-qa';
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));page.on('dialog',dialog=>dialog.accept());await page.addInitScript(()=>{delete window.showSaveFilePicker});
  const load=async file=>{await page.goto(base);await page.waitForSelector('.strip-outer');if(file){await page.locator('#fileInput').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#projectSubtitle').textContent.includes('.mmsx'))}};
  const byKey=(view,key)=>page.locator(`${view} [data-strip-key]`).filter({visible:true}).evaluateAll((els,k)=>els.find(e=>e.dataset.stripKey===k)?.dataset.groupIndex,key);
  const drag=async(from,to,{after=false}={})=>{
   await from.scrollIntoViewIfNeeded();await to.scrollIntoViewIfNeeded();const a=await from.boundingBox(),b=await to.boundingBox();
   assert(a&&b);await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
   await page.mouse.move(b.x+b.width/2,b.y+b.height*(after?.85:.2),{steps:12});await page.mouse.up();
  };
  await load();await page.locator('#displayOptions summary').click();
  for(const preset of ['compact','detailed','production']){
   await page.locator('#layoutSelect').selectOption(`studio:${preset}`);
   assert(await page.locator('.standard-strip').count()>0);
   const dimensions=await page.locator('#boardView').evaluate(view=>({available:view.clientWidth-20,widths:[...view.querySelectorAll('.standard-strip')].map(el=>el.getBoundingClientRect().width)}));
   assert(dimensions.widths.every(w=>Math.abs(w-dimensions.available)<2),JSON.stringify(dimensions));
  }
  await page.locator('#boardFieldPicker [data-strip-field-option="location"]').check();
  await page.locator('#boardFieldPicker [data-strip-field-option="pages"]').uncheck();
  assert.equal(await page.locator('#layoutSelect').inputValue(),'studio:custom');
  assert(await page.locator('.standard-strip [data-strip-field="location"]').count()>0);
  assert.equal(await page.locator('.standard-strip [data-strip-field="pages"]').count(),0);
  await page.screenshot({path:path.join(output,'standard-production.png')});
  await page.locator('#displayOptions summary').click();await page.locator('#calendarNav').click();
  await page.locator('.calendar-strip-menu summary').click();await page.locator('#calendarStripPreset').selectOption('production');
  await page.locator('.calendar-strip-menu [data-strip-field-option="location"]').check();
  await page.locator('.calendar-strip-menu [data-strip-field-option="pages"]').uncheck();
  assert.equal(await page.locator('#calendarStripPreset').inputValue(),'custom');
  assert(await page.locator('.operational-grid [data-strip-field="location"]').count()>0);
  assert.equal(await page.locator('.operational-grid [data-strip-field="pages"]').count(),0);
  assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');
  const download=page.waitForEvent('download');await page.locator('#saveButton').click();await(await download).saveAs(path.join(output,'display-only.msd'));
  assert.deepEqual(await fs.readFile(path.join(output,'display-only.msd')),await fs.readFile(path.join(__dirname,'../samples/Wonderful Life Demo.msd')));
  await page.locator('.calendar-strip-menu summary').click();
  await page.locator('#boardNav').click();await page.locator('#displayOptions summary').click();assert.equal(await page.locator('#layoutSelect').inputValue(),'studio:custom');await page.locator('#displayOptions summary').click();
  await page.setViewportSize({width:390,height:844});assert(await page.locator('.standard-strip').first().isVisible());
  const width=await page.locator('.standard-strip').first().evaluate(el=>el.getBoundingClientRect().width);assert(width<=390);
  console.log('PASS three standard layouts, independent custom fields, phone rows and exact display-only save');
  // Exercise both original adapters. Every operation can be undone to the initial ordering.
  for(const file of [null,process.env.SYNTHETIC_MMSX].filter(f=>f!==undefined)){
   await page.setViewportSize({width:1600,height:1000});await load(file);await page.locator('#calendarNav').click();
   const groups=page.locator('.operational-grid .calendar-shooting-day');assert(await groups.count()>=2);
   const first=groups.nth(0),second=groups.nth(1),source=first.locator('[data-strip-key]').first(),other=first.locator('[data-strip-key]').nth(1);
   const key=await source.getAttribute('data-strip-key'),before=await first.locator('[data-strip-key]').evaluateAll(es=>es.map(e=>e.dataset.stripKey));
   await drag(other,source);assert.notDeepEqual(await first.locator('[data-strip-key]').evaluateAll(es=>es.map(e=>e.dataset.stripKey)),before);
   await page.locator('#undoMoveButton').click();assert.deepEqual(await first.locator('[data-strip-key]').evaluateAll(es=>es.map(e=>e.dataset.stripKey)),before);
   const targetIndex=await second.getAttribute('data-group-index');
   await drag(source,second.locator('[data-strip-key]').first());assert.equal(await byKey('#calendarView .operational-grid',key),targetIndex);
   await page.locator('#undoMoveButton').click();
   // Pointer cancellation has no history and no model mutation.
   const a=await source.boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+50,a.y+60,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();
   assert.deepEqual(await first.locator('[data-strip-key]').evaluateAll(es=>es.map(e=>e.dataset.stripKey)),before);
   await page.locator('#workspaceLayout').selectOption('calendar-board');
   const boardName=await source.getAttribute('data-board-name');
   const targetSelector=await page.evaluate(({boardName,targetIndex})=>`#boardView .strip-outer[data-board-name="${CSS.escape(boardName)}"][data-container="scheduledGroups"][data-group-index="${targetIndex}"]`,{boardName,targetIndex});
   await drag(source,page.locator(targetSelector).first());assert.equal(await byKey('#calendarView .operational-grid',key),targetIndex);await page.locator('#undoMoveButton').click();
   // Reverse cross-pane direction, preserving the scene identity.
   const boardSourceSelector=await page.evaluate(({boardName})=>`#boardView .strip-outer[data-board-name="${CSS.escape(boardName)}"][data-group-index="0"][data-strip-index="0"]`,{boardName});
   await drag(page.locator(boardSourceSelector).first(),second.locator('[data-strip-key]').first());assert.equal(await byKey('#calendarView .operational-grid',key),targetIndex);await page.locator('#undoMoveButton').click();
   // Empty civil date creates and saves a day, and Undo removes it in one step.
   const date=file?'2026-10-09':'2008-06-15',cell=page.locator(`[data-calendar-cell="${date}"]`);
   assert.equal(await cell.locator('.calendar-shooting-day').count(),0);
   await drag(source,cell.locator('.civil-date'));
   assert.equal(await cell.locator('[data-strip-key]').first().getAttribute('data-strip-key'),key);
   const save=page.waitForEvent('download');await page.locator('#saveButton').click();const saved=path.join(output,file?'date-drag.mmsx':'date-drag.msd');await(await save).saveAs(saved);
   await page.locator('#undoMoveButton').click();assert.equal(await cell.locator('.calendar-shooting-day').count(),0);
   await page.locator('#redoMoveButton').click();assert.equal(await cell.locator('[data-strip-key]').first().getAttribute('data-strip-key'),key);
   await page.locator('#fileInput').setInputFiles(saved);await page.waitForFunction(()=>document.querySelector('#projectSubtitle').textContent.includes('date-drag')); await page.locator('#calendarNav').click();
   assert(await page.locator(`[data-calendar-cell="${date}"] .calendar-strip`).count()>0);
   console.log('PASS Calendar reorder/date move, both cross-pane directions, cancel, empty date save/reopen and Undo/Redo',file?'MMSX':'MSD');
  }
  // Tablet/phone: hold over a navigation tab to reveal the target view during drag.
  for(const size of [{width:1024,height:900},{width:390,height:844}]){
   await page.setViewportSize(size);await load();await page.locator('#displayOptions summary').click();await page.locator('#layoutSelect').selectOption('studio:compact');await page.locator('#displayOptions summary').click();
   const source=page.locator('#boardView .strip-outer[data-group-index="0"][data-strip-index="0"]').first();
   const a=await source.boundingBox(),nav=await page.locator('#calendarNav').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
   await page.mouse.move(nav.x+nav.width/2,nav.y+nav.height/2,{steps:10});await page.waitForTimeout(650);
   assert(await page.locator('#calendarView').isVisible());assert(!(await page.locator('#workspaceViews').evaluate(el=>el.classList.contains('split'))));
   const destination=page.locator('.operational-grid .calendar-shooting-day').nth(1).locator('[data-strip-key]').first();await destination.scrollIntoViewIfNeeded();const b=await destination.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height*.2,{steps:10});await page.mouse.up();
   assert.equal(await destination.getAttribute('data-scene-strip'),await page.locator('.operational-grid .calendar-shooting-day').nth(1).locator('[data-strip-key]').first().getAttribute('data-strip-key'));
   assert.match(await page.locator('.operational-grid .calendar-shooting-day').nth(1).innerText(),/12/);await page.locator('#undoMoveButton').click();
   // Reverse direction via Stripboard tab.
   const calendarSource=page.locator('.operational-grid [data-scene-strip]').first(),r=await calendarSource.boundingBox(),boardNav=await page.locator('#boardNav').boundingBox();
   await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(boardNav.x+boardNav.width/2,boardNav.y+boardNav.height/2,{steps:10});await page.waitForTimeout(650);assert(await page.locator('#boardView').isVisible());
   const boardDestination=page.locator('#boardView .strip-outer[data-group-index="1"]').first();await boardDestination.scrollIntoViewIfNeeded();const t=await boardDestination.boundingBox();await page.mouse.move(t.x+t.width/2,t.y+t.height*.2,{steps:10});await page.mouse.up();
   assert.match(await page.locator('#boardView .day[data-group-index="1"]').first().innerText(),/12/);await page.locator('#undoMoveButton').click();
  }
  // Native touch events: long press, multiselection and a cross-view move on phone.
  const touchPage=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  touchPage.on('pageerror',e=>errors.push(e.stack));await touchPage.goto(base);await touchPage.waitForSelector('.strip-outer');await touchPage.locator('#calendarNav').click();
  const cdp=await touchPage.context().newCDPSession(touchPage);
  const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,radiusX:2,radiusY:2,force:1,id:0}]});
  const point=async loc=>{await loc.scrollIntoViewIfNeeded();const r=await loc.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2}};
  const hold=async loc=>{const p=await point(loc);await touch('touchStart',p.x,p.y);await touchPage.waitForTimeout(550);await touch('touchEnd')};
  const mobileDay=touchPage.locator('.operational-grid .calendar-shooting-day').first();
  await hold(mobileDay.locator('[data-scene-strip]').nth(0));await hold(mobileDay.locator('[data-scene-strip]').nth(1));
  assert.equal(await touchPage.locator('.operational-grid .calendar-strip.selected').count(),2);
  const mobileSource=await point(mobileDay.locator('[data-scene-strip]').first()),mobileDestination=await point(touchPage.locator('.operational-grid .calendar-shooting-day').nth(1).locator('[data-strip-key]').first());
  await touch('touchStart',mobileSource.x,mobileSource.y);await touchPage.waitForTimeout(550);await touch('touchMove',mobileSource.x+18,mobileSource.y);await touch('touchMove',mobileDestination.x,mobileDestination.y-3);await touch('touchEnd');
  const next=touchPage.locator('.operational-grid .calendar-shooting-day').nth(1);
  assert.match(await next.innerText(),/12/);assert.match(await next.innerText(),/14/);await touchPage.locator('#undoMoveButton').click();await touchPage.keyboard.press('Escape');
  const finger=await point(mobileDay.locator('[data-scene-strip]').first()),nav=await point(touchPage.locator('#boardNav'));
  await touch('touchStart',finger.x,finger.y);await touchPage.waitForTimeout(550);await touch('touchMove',finger.x+18,finger.y);await touch('touchMove',nav.x,nav.y);await touchPage.waitForTimeout(650);
  assert(await touchPage.locator('#boardView').isVisible());assert(!(await touchPage.locator('#calendarView').isVisible()));
  const end=await point(touchPage.locator('#boardView .strip-outer[data-group-index="1"]').first());await touch('touchMove',end.x,end.y-3);await touch('touchEnd');
  assert.match(await touchPage.locator('#boardView .day[data-group-index="1"]').first().innerText(),/12/);await touchPage.locator('#undoMoveButton').click();await touchPage.close();
  console.log('PASS native phone touch: long press, multi-drag, Undo and navigation to Stripboard during drag');
  assert.deepEqual(errors,[]);console.log('PASS both directions through top navigation at tablet/phone widths, without split view');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
