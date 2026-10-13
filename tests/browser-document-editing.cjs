/* Integrated authoring: actual browser interactions, persisted documents and source conservation. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.STUDIO_URL||'http://127.0.0.1:8766';
const output=process.env.STUDIO_TEST_OUTPUT||'/tmp/stripboard-document-editing-qa';
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.stack));
    await page.addInitScript(()=>{delete window.showSaveFilePicker});
    await page.goto(base);await page.waitForSelector('.strip-outer');
    const geometry=selector=>page.locator(selector).evaluateAll(els=>els.map(el=>{
      const s=getComputedStyle(el);return ['width','height','left','top','fontSize','fontFamily','borderWidth','padding'].map(key=>s[key]);
    }));
    const field=async(key,value)=>{const input=page.locator(`[data-scene-field="${key}"]`);await input.fill(value);await input.dispatchEvent('change')};
    const apply=async()=>{await page.locator('#catalogEditForm button[type=submit]').click();assert(!(await page.locator('#catalogEditor').isVisible()))};
    const save=async(name)=>{const event=page.waitForEvent('download');await page.locator('#saveButton').click();const file=path.join(output,name);await(await event).saveAs(file);return file};
    const noModal=async()=>assert.equal(await page.locator('dialog:modal').count(),0);
    // Imported documents and geometry remain unchanged until an explicit edit.
    const strips=await geometry('#boardView .strip-layout');await page.locator('#reportNav').click();const report=await geometry('#reportView .report-block,#reportView .report-shape,#reportView .paper');
    await page.locator('#boardNav').click();await page.locator('.strip-outer[data-item-kind=scene]').first().click();await page.locator('#workspaceLayout').selectOption('board-breakdown');await noModal();
    assert(await page.locator('#boardView').isVisible());assert(await page.locator('[data-inline-scene]').isVisible());
    const sheetNumber=await page.locator('[data-sheet-number]').innerText();assert.equal(await page.locator('[data-scene-field=sheetNumber],[name=sheetNumber]').count(),0);
    const widths=await page.locator('.inline-scene-fields').evaluate(el=>Object.fromEntries(['scene','set','location','synopsis','comments'].map(key=>{const input=el.querySelector(`[data-scene-field="${key}"]`);return [key,(input.closest('.scene-choice-control')||input).getBoundingClientRect().width]})));
    assert(widths.set>widths.scene*2);assert(widths.location>widths.scene*2);assert.equal(widths.synopsis,widths.set);assert.equal(widths.comments,widths.set);
    const synopsisInput=page.locator('[data-scene-field=synopsis]'),synopsis=await synopsisInput.inputValue(),initialHeight=(await synopsisInput.boundingBox()).height;
    await synopsisInput.fill('Descrizione dettagliata della scena e delle azioni dei personaggi. '.repeat(8));assert((await synopsisInput.boundingBox()).height>initialHeight+18);assert((await synopsisInput.boundingBox()).height<=144);
    await synopsisInput.fill(synopsis);await synopsisInput.dispatchEvent('change');
    await page.locator('[data-scene-field=scene]').fill('12A');await page.locator('[data-scene-field=pagesEighths]').click();assert(await page.locator('[data-scene-field=pagesEighths]').evaluate(el=>el===document.activeElement));await field('pagesEighths','2 3/8');await field('comments','Nota persistente');
    await field('pagesEighths','1.5');assert.match(await page.locator('#status').innerText(),/2 3\/8/);assert.equal(await page.locator('[data-scene-field=pagesEighths]').getAttribute('aria-invalid'),'true');
    await page.locator('#saveButton').click();assert.match(await page.locator('#status').innerText(),/correggi/);await field('pagesEighths','2 3/8');assert(!(await page.locator('#status').isVisible()));
    const category=page.locator('.breakdown-category').filter({hasText:'Cast Members'}).first();
    await category.locator('[data-category-search]').click();const choices=await page.locator('#sceneChoiceDropdown [data-ref-element]').count();assert(choices>1);
    const id=await page.locator('#sceneChoiceDropdown [data-ref-element]:not(:checked)').first().getAttribute('data-ref-element');await page.locator(`#sceneChoiceDropdown [data-ref-element="${id}"]`).check();
    assert(await page.locator(`#sceneChoiceDropdown [data-ref-element="${id}"]`).isChecked());assert(await page.locator('#sceneChoiceDropdown').isVisible());
    await page.locator('#undoMoveButton').click();await category.locator('[data-category-search]').click();assert(!(await page.locator(`#sceneChoiceDropdown [data-ref-element="${id}"]`).isChecked()));await page.locator('#redoMoveButton').click();
    await category.locator('[data-category-search]').click();await category.locator('[data-category-search]').fill('George');assert.equal(await page.locator('#sceneChoiceDropdown [data-choice-index]').count(),1);await category.locator('[data-category-search]').fill('');
    const quantity=category.locator('[data-ref-quantity]').first();await quantity.fill('0');await quantity.dispatchEvent('change');assert.equal(await category.locator('[data-ref-quantity]').first().inputValue(),'0');
    await category.locator('[data-category-search]').fill('Nuovo interprete');await page.locator('#sceneChoiceDropdown .scene-choice-add').click();assert.match(await category.locator('.category-selected').innerText(),/Nuovo interprete/);
    const quickQuantity=category.locator('.breakdown-element').filter({hasText:'Nuovo interprete'}).locator('[data-ref-quantity]');await quickQuantity.fill('2');await quickQuantity.dispatchEvent('change');
    assert.equal(await page.locator('[data-scene-color]').count(),0);
    await page.locator('#reportNav').click();assert.deepEqual(await geometry('#reportView .report-block,#reportView .report-shape,#reportView .paper'),report);
    await page.locator('#boardNav').click();await page.locator('#workspaceLayout').selectOption('single');assert.deepEqual(await geometry('#boardView .strip-layout'),strips);
    const banner=page.locator('.strip-outer[data-item-kind=banner]').first();await banner.click();await page.locator('[data-inline-banner] [name=text]').fill('Trasferimento aggiornato');await page.locator('[data-inline-banner] [name=text]').dispatchEvent('change');assert.match(await page.locator('#boardView').innerText(),/Trasferimento aggiornato/);
    await page.locator('#dataNav').click();await noModal();await page.locator('[data-catalog-category="Cast Members"]').click();
    const row=page.locator('[data-catalog-element]').filter({has:page.locator('input[value="Nuovo interprete"]')});await row.locator('[data-element-field=name]').fill('Interprete rinominato');await row.locator('[data-element-field=name]').dispatchEvent('change');
    await page.locator('[data-catalog-search]').fill('Interprete rinominato');assert.equal(await page.locator('[data-catalog-element]:visible').count(),1);await page.locator('[data-catalog-search]').fill('');
    await page.locator('.catalog-elements [data-edit-document=category]').click();assert(await page.locator('#catalogEditor:modal').count());await page.locator('#catalogEditor [name=name]').fill('Interpreti');await apply();assert(await page.locator('[data-catalog-category=Interpreti]').count());
    const saved=await save('edited.studio.json'),data=JSON.parse(await fs.readFile(saved,'utf8'));assert.equal(data.version,2);assert(Buffer.from(data.native,'base64').equals(await fs.readFile(path.join(__dirname,'../samples/Wonderful Life Demo.msd'))));
    await page.locator('#fileInput').setInputFiles(saved);await page.waitForFunction(()=>document.querySelector('#undoMoveButton').disabled);await page.locator('#breakdownNav').click();await page.locator('#breakdownSceneSelect').selectOption({label:'12A · BACK ROOM DRUGSTORE'});
    assert.equal(await page.locator('[data-sheet-number]').innerText(),sheetNumber);assert.equal(await page.locator('[data-scene-field=sheetNumber],[name=sheetNumber]').count(),0);assert.equal(await page.locator('[data-scene-field=comments]').inputValue(),'Nota persistente');assert.equal(await page.locator('[data-scene-field=pagesEighths]').inputValue(),'2 3/8');assert.match(await page.locator('.breakdown-category').filter({hasText:'Interpreti'}).innerText(),/Interprete rinominato/);
    await page.screenshot({path:path.join(output,'spoglio-integrato.png')});
    console.log('PASS inline fields, invalid values, category checkboxes/search, quick creation, quantities, colors, banner, catalog, rename, Undo/Redo, geometry and imported save/reopen');
    // Create a document using contextual forms on a phone, without the former global editor.
    await page.setViewportSize({width:390,height:844});await page.locator('.project-heading summary').click();await page.locator('#newDocumentButton').click();await page.locator('#newDocumentForm input').fill('Film di prova');await page.locator('#newDocumentForm button[type=submit]').click();
    assert.equal(await page.locator('#projectTitle').innerText(),'Film di prova');
    await page.locator('.catalog-elements [data-inline-new=element]').click();assert(await page.locator('#catalogEditor:modal').count());await page.locator('#catalogEditor [name=name]').fill('ANNA');await page.locator('#catalogEditor [name=category]').selectOption('Cast');await page.locator('#catalogEditor [name=boardId]').fill('1');assert.equal(await page.locator('#catalogEditor [data-add-property]').count(),0);await apply();
    await page.locator('#boardNav').click();await page.locator('[data-insert-scene]').click();await noModal();assert.equal(await page.locator('[data-scene-field=sheetNumber]').count(),0);await field('scene','1A');await field('set','Casa');await field('pagesEighths','1 3/8');
    await page.locator('#hideEmptyCategories').uncheck();const cast=page.locator('.breakdown-category').filter({hasText:'Cast'}).first();await cast.locator('[data-category-search]').click();await page.locator('#sceneChoiceDropdown [data-ref-element]').first().check();const castQuantity=cast.locator('[data-ref-quantity]').first();await castQuantity.fill('2');await castQuantity.dispatchEvent('change');
    await page.locator('#boardNav').click();await page.locator('#calendarSelect').selectOption('__edit__');await page.locator('#calendarEditor [name=ProductionStartDate]').fill('2026-10-13');await page.locator('#calendarEditForm button[type=submit]').click();
    await page.locator('[data-insert-day]').click();await page.locator('[data-insert-banner]').click();await page.locator('[data-inline-banner] [name=text]').fill('Trasferimento');await page.locator('[data-inline-banner] [name=text]').dispatchEvent('change');
    await page.locator('#calendarNav').click();assert.match(await page.locator('#calendarView').innerText(),/Casa/);
    await page.locator('#redFlagNav').click();await page.locator('[data-flag-category]').selectOption('Cast');await page.locator('[data-flag-element]').first().check();await page.locator('[data-flag-month-input]').fill('2026-10');await page.locator('[data-flag-month-input]').dispatchEvent('change');await page.locator('[data-flag-date="2026-10-13"]').click();await page.locator('[data-flag-date="2026-10-14"]').click();await page.locator('[data-flag-add]').click();
    await page.locator('#doodNav').click();await page.locator('#doodCategory').selectOption('Cast');assert.match(await page.locator('.dood-grid').innerText(),/ANNA/);assert(await page.locator('.dood-conflict').count());
    await page.evaluate(()=>{window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async()=>{throw Error('Disco non disponibile')},close:async()=>{}})})});await page.locator('#saveButton').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Disco non disponibile'));assert.equal(await page.locator('#dirtyIndicator').innerText(),'Modifiche non salvate');await page.evaluate(()=>{delete window.showSaveFilePicker});
    const newFile=await save('new.studio.json');await page.locator('#fileInput').setInputFiles(newFile);await page.waitForFunction(()=>document.querySelector('#undoMoveButton').disabled);await page.locator('#dataNav').click();await page.locator('.element-catalog [data-edit-document=element]').first().click();assert.equal(await page.locator('#catalogEditor [name=name]').inputValue(),'ANNA');assert.equal(await page.locator('#catalogEditor [data-add-property]').count(),0);await page.locator('#catalogEditor [data-overlay-close]').click();await page.screenshot({path:path.join(output,'elementi-mobile.png')});
    console.log('PASS phone contextual authoring, direct scene/day/banner insertion, no custom field additions, scheduling, availability, write failure and retry/reopen');
    // Existing imported event authoring remains available and preserves its original archive.
    const {fixture}=await import('./fixtures/calendar.mjs'),{encodeMmsx}=await import('../assets/mmsx-codec.js');const importedPath=path.join(output,'events.mmsx'),bytes=await encodeMmsx(fixture());await fs.writeFile(importedPath,bytes);
    await page.locator('#fileInput').setInputFiles(importedPath);await page.waitForFunction(()=>document.querySelector('#projectSubtitle').textContent.includes('events.mmsx'));await page.locator('#calendarNav').click();await page.locator('#calendarView [data-event-manager]').click();await page.locator('#productionEventDialog [data-edit]').first().click();await page.locator('#productionEventForm [name=name]').fill('Evento importato modificato');await page.locator('#productionEventForm button[type=submit]').click();await page.locator('#productionEventDialog [data-close]').click();
    const eventFile=await save('events.studio.json'),eventData=JSON.parse(await fs.readFile(eventFile,'utf8'));assert(Buffer.from(eventData.native,'base64').equals(Buffer.from(bytes)));await page.locator('#fileInput').setInputFiles(eventFile);await page.waitForFunction(()=>document.querySelector('#undoMoveButton').disabled);await page.locator('#calendarNav').click();await page.locator('#calendarView [data-event-manager]').click();assert.match(await page.locator('.production-event-list').innerText(),/Evento importato modificato/);
    assert.deepEqual(errors,[]);console.log('PASS imported MMSX event preservation; all integrated authoring workflows passed');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
