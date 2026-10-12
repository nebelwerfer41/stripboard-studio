const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.STUDIO_URL||'http://127.0.0.1:8766';
const output=process.env.STUDIO_TEST_OUTPUT||'/tmp/stripboard-calendar-selection';
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];
  await page.addInitScript(()=>{delete window.showSaveFilePicker});
  page.on('pageerror',e=>errors.push(e.stack));
  const days=()=>page.locator('.operational-grid .calendar-shooting-day').evaluateAll(els=>els.map(e=>({
   board:e.dataset.boardName,index:Number(e.dataset.groupIndex),date:e.closest('[data-calendar-cell]').dataset.calendarCell,
   keys:[...e.querySelectorAll('[data-strip-key]')].map(s=>s.dataset.stripKey)
  })));
  async function saveNoop(bytes,name){
   assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');
   const download=page.waitForEvent('download');await page.locator('#saveButton').click();
   const file=path.join(output,name);await(await download).saveAs(file);assert.deepEqual(await fs.readFile(file),bytes);
  }
  await page.goto(base);await page.waitForSelector('.strip-outer');await page.locator('#calendarNav').click();
  const original=await days(),current=await page.locator('#calendarSelect').inputValue();
  assert(original.length>0);
  const other=await page.locator('#calendarSelect option').evaluateAll((els,id)=>els.find(e=>e.value!==id).value,current);
  await page.locator('#calendarSelect').selectOption(other);
  const switched=await days();assert(switched.length>0);assert(switched.some(d=>d.keys.length>0));
  const expected=await page.evaluate(async({board,id})=>{
   const {parseMsd}=await import('./assets/msd-parser.js'),{boardWithCalendar}=await import('./assets/production-data.js');
   const p=await parseMsd(await(await fetch('./samples/Wonderful%20Life%20Demo.msd')).arrayBuffer());
   return boardWithCalendar(p,board,id).scheduledGroups.map((g,index)=>({index,date:g.date,keys:g.strips.map(s=>s.sourceKey)}));
  },{board:original[0].board,id:other});
  for(const day of switched){const group=expected.find(g=>g.index===day.index);assert.equal(day.date,group.date);assert.deepEqual(day.keys,group.keys)}
  await page.locator('#calendarSelect').selectOption(current);assert.deepEqual(await days(),original);
  await saveNoop(await fs.readFile(path.join(__dirname,'../samples/Wonderful Life Demo.msd')),'noop.msd');
  console.log('PASS MSD alternate calendar: scenes and days visible, matching Stripboard dates, return and byte-identical save');
  const {fixture}=await import('./fixtures/calendar.mjs'),{encodeMmsx}=await import('../assets/mmsx-codec.js');
  for(const format of ['5','3','hybrid']){
   const root=fixture(format),board=root.contents.stripboard.board;
   const segments=board.segmentMap?Object.entries(board.segmentMap):board.segments.map(s=>[s.id,s]);
   for(const [id,segment] of segments)if(id!=='a')segment.calendar.prodStart='20300101';
   const bytes=Buffer.from(await encodeMmsx(root)),name=`calendar-selection-${format}.mmsx`;
   await page.locator('#fileInput').setInputFiles({name,mimeType:'application/octet-stream',buffer:bytes});
   await page.waitForFunction(()=>document.querySelector('#calendarSelect option')?.value.includes('board'));
   await page.locator('#calendarNav').click();
   await page.locator('#calendarGoDate').fill('2026-10-06');await page.locator('#calendarGoDate').dispatchEvent('change');
   const before=await days(),initialCalendar=await page.locator('#calendarSelect').inputValue();assert(before.length>0);
   const first=page.locator('.operational-grid .calendar-strip').first(),key=await first.getAttribute('data-strip-key');await first.click();
   const others=await page.locator('#calendarSelect option').evaluateAll((els,id)=>els.filter(e=>e.value!==id).map(e=>e.value),initialCalendar);
   for(const id of others){
    await page.locator('#calendarSelect').selectOption(id);
    assert.equal(await page.locator('#calendarMonthInput').inputValue(),'2026-10');assert.equal(await page.locator('#calendarGoDate').inputValue(),'2026-10-06');
    assert.deepEqual(await days(),before);assert(await page.locator(`.operational-grid [data-strip-key='${key}']`).evaluate(el=>el.classList.contains('selected')));
   }
   await page.locator('#calendarSelect').selectOption(initialCalendar);assert.deepEqual(await days(),before);
   await page.locator('#toggleUnscheduled').click();await page.locator('input[data-segment-id="b"]').uncheck();
   const visible=await days();assert(visible.length>0);assert(visible.length<before.length);
   await page.locator('#calendarSelect').selectOption(others[0]);assert.deepEqual(await days(),visible);
   await saveNoop(bytes,`noop-${format}.mmsx`);
   console.log(`PASS MMSX ${format}: all calendars including Boneyard preserve native dates, month, scene selection, segment visibility and bytes`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
