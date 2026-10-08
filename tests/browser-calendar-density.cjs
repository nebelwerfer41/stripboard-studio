/* Focused layout regression: every strip must fit its civil day without an inner scrollbar. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.STUDIO_URL||'http://127.0.0.1:8766';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(base);await page.waitForSelector('.strip-outer');await page.locator('#calendarNav').click();
  if(process.env.LONG_DAY_MMSX){await page.locator('#fileInput').setInputFiles(process.env.LONG_DAY_MMSX);await page.waitForFunction(()=>document.querySelector('#projectSubtitle').textContent.includes('calendar-long-day'));await page.locator('#calendarNav').click()}
  const contentMetrics=()=>page.locator('.operational-grid .cell-content').evaluateAll(els=>els.map(el=>({count:el.querySelectorAll('.calendar-strip').length,height:el.clientHeight,scroll:el.scrollHeight,max:getComputedStyle(el).maxHeight,overflow:getComputedStyle(el).overflowY,last:el.querySelector('.calendar-strip:last-of-type')?.getBoundingClientRect().bottom,bottom:el.getBoundingClientRect().bottom})));
  const checkFullCells=async()=>{
   const metrics=await contentMetrics();assert(metrics.some(m=>m.count>0));
   for(const m of metrics){assert.equal(m.max,'none');assert.equal(m.overflow,'visible');assert(m.scroll<=m.height+1,JSON.stringify(m));if(m.last)assert(m.last<=m.bottom+1,JSON.stringify(m))}
   return metrics;
  };
  const compact=await checkFullCells();assert.equal(await page.locator('.operational-grid .mini-synopsis').count(),0);
  const fields=await page.locator('.operational-grid .calendar-strip').first().evaluate(el=>[...el.children].map(e=>e.className));assert.deepEqual(fields,['calendar-strip-number','calendar-strip-set','calendar-strip-pages']);
  assert.equal(await page.locator('.operational-grid .calendar-strip-pages').first().innerText(),process.env.LONG_DAY_MMSX?'1':'5/8');
  if(process.env.LONG_DAY_MMSX){const long=compact.find(m=>m.count===40);assert(long);assert(long.height>310)}
  await page.locator('.operational-grid .calendar-strip').first().click();const key=await page.locator('.operational-grid .calendar-strip.active').first().getAttribute('data-scene-strip');
  await page.locator('.calendar-view-menu summary').click();await page.locator('[data-calendar-extended]').check();
  assert(await page.locator('.operational-grid .mini-synopsis').count()>0);const extended=await checkFullCells();
  const busiest=compact.reduce((best,m,i)=>m.count>compact[best].count?i:best,0);assert(extended[busiest].height>compact[busiest].height);
  assert.equal(await page.locator('.operational-grid .calendar-strip.active').first().getAttribute('data-scene-strip'),key);assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');
  await page.locator('[data-calendar-extended]').uncheck();assert.equal(await page.locator('.operational-grid .mini-synopsis').count(),0);await checkFullCells();
  await page.locator('[data-calendar-all=true]').click();assert(!(await page.locator('[data-calendar-extended]').isChecked()));await page.locator('.calendar-view-menu summary').click();
  await page.locator('#workspaceLayout').selectOption('calendar-board');await checkFullCells();
  for(const width of [1200,1201]){await page.setViewportSize({width,height:1000});await page.waitForFunction(width=>document.querySelector('#workspaceLayout').disabled===(width<=1200),width);await checkFullCells()}
  if(process.env.STUDIO_DENSITY_SCREENSHOT)await page.screenshot({path:process.env.STUDIO_DENSITY_SCREENSHOT,fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS compact/extended fields, 40-strip dynamic height, all strips visible, shared selection, UI-only preferences and 1200px threshold');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
