const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{delete window.showSaveFilePicker});
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8766');await page.waitForSelector('.strip-outer');
 const bytes=await page.evaluate(async()=>{const {syntheticProject}=await import('./tests/fixtures/persistence.mjs'),{serializeStudio}=await import('./assets/studio-project.js');return [...await serializeStudio(syntheticProject(true))]});
 await page.locator('#fileInput').setInputFiles({name:'synthetic.studio.json',mimeType:'application/json',buffer:Buffer.from(bytes)});await page.waitForFunction(()=>document.querySelector('#projectTitle').textContent.includes('Città'));
 // Introduce a real edit using the app, then ensure exporting does not clear dirty state.
 await page.locator('#boardView .strip-outer[data-item-kind=banner]').first().click();await page.locator('#workspaceLayout').selectOption('board-breakdown');
 const input=page.locator('[data-inline-banner] [name=text]');await input.fill('Banner modificato per export');await input.dispatchEvent('change');assert.match(await page.locator('#dirtyIndicator').innerText(),/non salvate/);
 await page.locator('#exportButton').click();await page.locator('#exportFormat').selectOption('msd');assert.match(await page.locator('#exportReport').innerText(),/Quantità da 2 in su/);assert.match(await page.locator('#exportReport').innerText(),/Eventi di sistema sostituiti da Red Flags/);await page.locator('#exportFormat').selectOption('mmsx');assert.match(await page.locator('#exportReport').innerText(),/Trasformati:[\s\S]*Omessi:/);
 await page.locator('#exportConfirm').click();assert.equal(await page.locator('#exportDialog').isVisible(),true);assert.match(await page.locator('#status').innerText(),/Conferma/);
 await page.locator('#exportAcceptLoss').check();const download=page.waitForEvent('download');await page.locator('#exportConfirm').click();const file=await download;assert.match(file.suggestedFilename(),/\.mmsx$/);assert.match(await page.locator('#dirtyIndicator').innerText(),/non salvate/);
 const output='/tmp/stripboard-export-workflow.mmsx';await file.saveAs(output);
 const parsed=await page.evaluate(async b=>{const {parseMmsx}=await import('./assets/mmsx-project.js');const p=await parseMmsx(new Uint8Array(b));return p.boards.flatMap(b=>b.scheduledGroups.flatMap(g=>g.strips)).filter(s=>s.kind==='banner').map(s=>s.text)},[...await fs.readFile(output)]);assert(parsed.includes('Banner modificato per export'),JSON.stringify(parsed));
 const save=page.waitForEvent('download');await page.locator('#saveButton').click();assert.match((await save).suggestedFilename(),/\.studio\.json$/);await page.waitForFunction(()=>document.querySelector('#dirtyIndicator').textContent==='Salvato');
 assert.deepEqual(errors,[]);console.log('PASS compatibility review, mandatory loss confirmation, current banner exported, dirty state preserved by export, Studio save clears revision');
 // Existing HTML suites check native MSD conservation and calendar updates.
 for(const name of ['roundtrip','calendar-roundtrip','conservation','msd-categories']){
  await page.goto((process.env.STUDIO_URL||'http://127.0.0.1:8766')+`/tests/${name}.html`);await page.waitForFunction(()=>!document.querySelector('#result')?.textContent.startsWith('In corso'));
  const result=await page.locator('#result').innerText();assert(!/[✗❌]|FAIL|Error:/.test(result),`${name}: ${result}`);console.log(`PASS ${name}`);
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
