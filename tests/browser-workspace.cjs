/* Run with NODE_PATH pointing to an installed Playwright; Chrome can be supplied via CHROME_PATH. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.STUDIO_URL||'http://127.0.0.1:8766';
const output=process.env.STUDIO_TEST_OUTPUT||'/private/tmp/stripboard-calendar-qa';
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];
 await page.addInitScript(()=>{delete window.showSaveFilePicker});
 page.on('pageerror',e=>errors.push(e.stack));
 for(const name of ['parser','roundtrip','conservation','calendar-roundtrip']){
  await page.goto(`${base}/tests/${name}.html`);await page.waitForFunction(()=>['true','false'].includes(document.body.dataset.passed));
  assert.equal(await page.locator('body').getAttribute('data-passed'),'true',`${name}: ${await page.locator('body').innerText()}`);console.log('PASS',name);
 }
 if(process.env.REAL_MSD){await page.locator('#file').setInputFiles(process.env.REAL_MSD);await page.waitForFunction(()=>['true','false'].includes(document.body.dataset.passed));assert.equal(await page.locator('body').getAttribute('data-passed'),'true',await page.locator('#result').innerText());console.log('PASS real MSD calendar roundtrip')}
 await page.goto(base);await page.waitForSelector('.strip-outer');
 const scene=page.locator('.strip-outer[data-item-kind="scene"]').first();await scene.click();await page.locator('#previewButton').click();
 assert.match(await page.locator('#breakdownPreview').innerText(),/Scena/);assert(await page.locator('#workspaceViews').evaluate(el=>el.classList.contains('split')));
 const active=await page.locator('#breakdownPreview h3').innerText();await page.locator('#calendarNav').click();assert.equal(await page.locator('#breakdownPreview h3').innerText(),active);
 await page.locator('.operational-grid .calendar-strip').first().click();const firstHeading=await page.locator('#breakdownPreview h3').innerText();
 await page.locator('.operational-grid .calendar-strip').nth(1).click({modifiers:['ControlOrMeta']});assert.match(await page.locator('#breakdownPreview').innerText(),/2 strip selezionate/);assert.notEqual(await page.locator('#breakdownPreview h3').innerText(),firstHeading);
 await page.locator('#workspaceLayout').selectOption('calendar-board');assert(await page.locator('#boardView').isVisible());assert(await page.locator('#calendarView').isVisible());assert(!(await page.locator('#breakdownPreview').isVisible()));
 await page.locator('#workspaceSplitter').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#workspaceSplitter').getAttribute('aria-valuenow'),'50');
 for(const width of [1200,1199]){await page.setViewportSize({width,height:1000});await page.waitForFunction(()=>document.querySelector('#workspaceLayout').disabled);assert(!(await page.locator('#boardView').isVisible()));assert(await page.locator('#workspaceLayout').isDisabled());assert(!(await page.locator('#workspaceViews').evaluate(el=>el.classList.contains('split'))))}
 await page.setViewportSize({width:1201,height:1000});await page.waitForFunction(()=>!document.querySelector('#workspaceLayout').disabled);assert(await page.locator('#boardView').isVisible());assert(await page.locator('#calendarView').isVisible());
 await page.locator('#workspaceLayout').selectOption('single');for(const width of [1200,1201,1600]){await page.setViewportSize({width,height:1050});assert(!(await page.locator('#workspaceViews').evaluate(el=>el.classList.contains('split'))))}
 assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');
 const parent=await page.locator('#boardSelect').inputValue(),otherParent=await page.locator('#boardSelect option').evaluateAll((els,current)=>els.find(e=>e.value!==current).value,parent);
 await page.locator('#boardSelect').selectOption(otherParent);await page.locator('#boardSelect').selectOption(parent);assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');
 await page.locator('.calendar-view-menu summary').click();await page.locator('[data-calendar-all=false]').click();assert.equal(await page.locator('.calendar-strip').count(),0);await page.locator('[data-calendar-all=true]').click();assert(await page.locator('.calendar-strip').count()>0);assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');
 await page.locator('[data-calendar-option=saturdays]').uncheck();await page.locator('[data-calendar-option=sundays]').uncheck();assert.equal(await page.locator('.operational-weekday').count(),5);await page.locator('[data-calendar-all=true]').click();assert.equal(await page.locator('.operational-weekday').count(),7);await page.locator('.calendar-view-menu summary').click();
 const current=await page.locator('#calendarSelect').inputValue(),other=await page.locator('#calendarSelect option').evaluateAll((els,current)=>els.find(e=>e.value!==current).value,current);
 await page.locator('#calendarSelect').selectOption(other);assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');assert.equal(await page.locator('.calendar-shooting-day').count(),0);await page.locator('#calendarSelect').selectOption(current);
 const downloadNoop=page.waitForEvent('download');await page.locator('#saveButton').click();await(await downloadNoop).saveAs(path.join(output,'noop.msd'));assert.deepEqual(await fs.readFile(path.join(output,'noop.msd')),await fs.readFile(path.join(__dirname,'../samples/Wonderful Life Demo.msd')));
 console.log('PASS shared selection, multi, split >1200 / <=1200 and read-only no-op');
 // Drag must use the visible Stripboard pane even when Calendar is the primary tab.
 await page.locator('#workspaceLayout').selectOption('calendar-board');
 const from=page.locator('#boardView .day[data-group-index="0"] .strip-outer').first(),destination=page.locator('#boardView .day[data-group-index="1"] .strip-outer').first();
 await from.click();const movedLabel=await from.getAttribute('aria-label'),fromRect=await from.boundingBox(),toRect=await destination.boundingBox();
 await page.mouse.move(fromRect.x+fromRect.width/2,fromRect.y+fromRect.height/2);await page.mouse.down();await page.mouse.move(toRect.x+toRect.width/2,toRect.y+toRect.height/4,{steps:8});await page.mouse.up();
 const firstDay=page.locator('#boardView .day[data-group-index="0"]'),secondDay=page.locator('#boardView .day[data-group-index="1"]');
 assert.equal(await firstDay.getByRole('button',{name:movedLabel,exact:true}).count(),0);assert.equal(await secondDay.getByRole('button',{name:movedLabel,exact:true}).count(),1);
 assert.match((await page.locator('[data-calendar-cell="2008-06-18"] .calendar-strip-number').allTextContents()).join(','),/12/);
 await page.locator('#undoMoveButton').click();assert.equal(await firstDay.getByRole('button',{name:movedLabel,exact:true}).count(),1);
 await page.locator('#redoMoveButton').click();assert.equal(await secondDay.getByRole('button',{name:movedLabel,exact:true}).count(),1);
 const splitDragDownload=page.waitForEvent('download');await page.locator('#saveButton').click();await(await splitDragDownload).saveAs(path.join(output,'split-drag.msd'));
 console.log('PASS Calendar + Stripboard mouse drag, calendar synchronization and Undo/Redo');

 // Actual UI editing and downloads, in both imported formats.
 for(const file of [path.join(__dirname,'../samples/Wonderful Life Demo.msd'),process.env.REAL_MMSX||process.env.SYNTHETIC_MMSX].filter(Boolean)){
  await page.locator('#fileInput').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#projectSubtitle').textContent.includes('-')||document.querySelector('#projectSubtitle').textContent.includes('.msd')||document.querySelector('#projectSubtitle').textContent.includes('.mmsx'));await page.waitForTimeout(150);
  await page.locator('#calendarNav').click();if(!(await page.locator('#calendarException').isVisible()))await page.locator('#calendarRulesToggle').click();
  const savedStart=await page.locator('#calendarStartDate').inputValue();await page.locator('#calendarStartDate').fill('');await page.locator('#workspaceLayout').selectOption('calendar-board');assert.equal(await page.locator('#calendarStartDate').inputValue(),'');await page.locator('#workspaceLayout').selectOption('single');assert.equal(await page.locator('#calendarStartDate').inputValue(),'');await page.locator('#calendarStartDate').fill(savedStart);await page.locator('#calendarStartDate').dispatchEvent('change');
  const before=await page.locator('.operational-grid .calendar-shooting-day').evaluateAll(els=>els.map(e=>[e.dataset.groupId,e.closest('[data-calendar-cell]').dataset.calendarCell]));
  await page.locator('#calendarException').selectOption('holiday');assert.equal(await page.locator('#dirtyIndicator').innerText(),'Modifiche non salvate');
  assert.deepEqual(await page.locator('.operational-grid .calendar-shooting-day').evaluateAll(els=>els.map(e=>[e.dataset.groupId,e.closest('[data-calendar-cell]').dataset.calendarCell])),before);
  await page.locator('#undoMoveButton').click();assert.equal(await page.locator('#calendarException').inputValue(),'');await page.locator('#redoMoveButton').click();assert.equal(await page.locator('#calendarException').inputValue(),'holiday');
  const extension=file.endsWith('.mmsx')?'mmsx':'msd',rulesFile=path.join(output,`rules.${extension}`),download=page.waitForEvent('download');await page.locator('#saveButton').click();await(await download).saveAs(rulesFile);
  await page.locator('#fileInput').setInputFiles(rulesFile);await page.waitForTimeout(150);await page.locator('#calendarNav').click();
  if(!(await page.locator('#calendarException').isVisible()))await page.locator('#calendarRulesToggle').click();
  assert.equal(await page.locator('#calendarException').inputValue(),'holiday');
  const start=await page.locator('#calendarStartDate').inputValue();const date=new Date(`${start}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+3);const shifted=date.toISOString().slice(0,10);
  await page.locator('#calendarStartDate').fill(shifted);await page.locator('#calendarStartDate').dispatchEvent('change');
  await page.locator('#calendarReschedule').click();assert(await page.locator('#rescheduleDialog').isVisible());assert.match(await page.locator('#rescheduleEffects').innerText(),/piani\/segmenti coinvolti/);
  await page.locator('#rescheduleForm button[value=apply]').click();assert(!(await page.locator('#rescheduleDialog').isVisible()));
  await page.locator('#undoMoveButton').click();await page.locator('#redoMoveButton').click();
  const replanned=page.waitForEvent('download'),replanFile=path.join(output,`replanned.${extension}`);await page.locator('#saveButton').click();await(await replanned).saveAs(replanFile);
  await page.locator('#fileInput').setInputFiles(replanFile);await page.waitForTimeout(150);await page.locator('#calendarNav').click();if(!(await page.locator('#calendarStartDate').isVisible()))await page.locator('#calendarRulesToggle').click();assert.equal(await page.locator('#calendarStartDate').inputValue(),shifted);
  console.log('PASS UI rules/replan/undo/redo/download/reopen',extension);
 }
 if(process.env.SYNTHETIC_MMSX){
  await page.locator('#fileInput').setInputFiles(process.env.SYNTHETIC_MMSX);await page.waitForTimeout(150);await page.locator('#calendarNav').click();
  await page.locator('.operational-grid .calendar-strip').first().click();await page.locator('#previewButton').click();
  assert.match(await page.locator('#breakdownPreview').innerText(),/Veicoli speciali/);assert.match((await page.locator('.breakdown-element').allTextContents()).join(' '),/12 auto/);assert.equal(await page.locator('.breakdown-element .element-quantity,.breakdown-element small').count(),0);assert.equal(await page.locator('.breakdown-element[title="Riferimento non risolto"]').count(),1);
  await page.locator('#hideEmptyCategories').uncheck();await page.screenshot({path:path.join(output,'calendar-breakdown-wide.png'),fullPage:true});
  await page.setViewportSize({width:1200,height:1000});await page.waitForFunction(()=>document.querySelector('#breakdownPreview').classList.contains('drawer'));assert(await page.locator('#breakdownPreview').evaluate(el=>el.classList.contains('drawer')));await page.screenshot({path:path.join(output,'breakdown-1200.png')});await page.locator('#closeBreakdown').click();assert(await page.locator('#calendarView').isVisible());
  await page.setViewportSize({width:1600,height:1050});assert(!(await page.locator('#workspaceViews').evaluate(el=>el.classList.contains('split'))));
  console.log('PASS custom breakdown, quantities, unresolved refs and drawer');
 }
 if(process.env.PURGED_MMSX){await page.locator('#fileInput').setInputFiles(process.env.PURGED_MMSX);await page.waitForTimeout(200);await page.locator('#calendarNav').click();await page.locator('#workspaceLayout').selectOption('calendar-board');assert(await page.locator('#boardView').isVisible());assert(await page.locator('#calendarView').isVisible());console.log('PASS real PURGED multiple segment layout')}
 assert.deepEqual(errors,[]);console.log('ALL BROWSER WORKFLOWS PASSED');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
