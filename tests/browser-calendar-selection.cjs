/* Calendar selection is an explicit plan association, including native imported schedules. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const {fixture}=await import('./fixtures/calendar.mjs'),{encodeMmsx}=await import('../assets/mmsx-codec.js'),{parseStudio}=await import('../assets/studio-project.js');
 const output=process.env.STUDIO_TEST_OUTPUT||'/tmp/calendar-association';await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));await page.addInitScript(()=>{delete window.showSaveFilePicker});
  const save=async name=>{const event=page.waitForEvent('download');await page.locator('#saveButton').click();const filename=path.join(output,name);await(await event).saveAs(filename);return fs.readFile(filename)};
  for(const variant of ['5','3','hybrid']){
   await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8766');await page.waitForSelector('.strip-outer');const bytes=await encodeMmsx(fixture(variant)),file=path.join(output,`source-${variant}.mmsx`);await fs.writeFile(file,bytes);await page.locator('#fileInput').setInputFiles(file);await page.waitForFunction(()=>document.querySelector('#projectSubtitle').textContent.includes('source-'));
   const before=await page.locator('#calendarSelect').inputValue(),other=await page.locator('#calendarSelect option').evaluateAll((opts,id)=>opts.find(o=>o.value!==id&&!o.disabled&&!o.value.startsWith('__')).value,before);
   await page.locator('#calendarSelect').selectOption(other);assert.equal(await page.locator('#dirtyIndicator').innerText(),'Modifiche non salvate');await page.locator('#calendarNav').click();assert(await page.locator('.calendar-strip').count());assert(!(await page.locator('#calendarView').innerText()).includes('Proiezione'));
   const saved=await save(`changed-${variant}.studio.json`),reopened=await parseStudio(saved);assert(reopened.boards.filter(b=>b.parentBoardId===reopened.boards[0].parentBoardId).every(b=>b.calendarId===other));assert.equal(reopened.boards[0].scheduledGroups.filter(g=>g.kind==='ScheduleDay')[1].date,'2026-10-08');assert.deepEqual(Uint8Array.from(atob(JSON.parse(saved).native),c=>c.charCodeAt(0)),bytes);
   await page.locator('#undoMoveButton').click();assert.equal(await page.locator('#calendarSelect').inputValue(),before);assert.deepEqual(await save(`undo-${variant}.mmsx`),Buffer.from(bytes));console.log('PASS calendar association, planned dates, source conservation and Undo',variant);
  }assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
