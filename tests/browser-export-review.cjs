const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8766');
  await page.waitForSelector('.strip-outer');
  const bytes=await page.evaluate(async()=>{
   const {syntheticProject}=await import('./tests/fixtures/persistence.mjs');
   const {serializeStudio}=await import('./assets/studio-project.js');
   const project=syntheticProject(true);
   project.elements[0].name='<img src=x onerror=alert(1)>';
   return [...await serializeStudio(project)];
  });
  await page.locator('#fileInput').setInputFiles({name:'review.studio.json',mimeType:'application/json',buffer:Buffer.from(bytes)});
  await page.waitForFunction(()=>document.querySelector('#projectTitle').textContent.includes('Città'));
  await page.locator('#exportButton').click();
  await page.locator('#exportFormat').selectOption('mmsx');
  assert.equal(await page.locator('#exportQuantityStyleLabel').isVisible(),false);
  await page.locator('#exportConfirm').click();
  assert.match(await page.locator('#exportError').innerText(),/Conferma/);
  await page.locator('#exportAcceptLoss').check();
  await page.locator('#exportQuantityMode').selectOption('name');
  assert.equal(await page.locator('#exportAcceptLoss').isChecked(),false);
  assert.equal(await page.locator('#exportError').isVisible(),false);
  assert.match(await page.locator('#exportQuantityHelp').innerText(),/lette dai nomi/);
  await page.locator('#exportFormat').selectOption('msd');
  assert.equal(await page.locator('#exportQuantityStyleLabel').isVisible(),true);
  assert.equal(await page.locator('#exportReport img').count(),0);
  for(const size of [{width:1280,height:800},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(size);
   await page.locator('#exportConfirm').scrollIntoViewIfNeeded();
   const geometry=await page.locator('#exportDialog').evaluate(dialog=>{
    const r=dialog.getBoundingClientRect(),button=dialog.querySelector('#exportConfirm').getBoundingClientRect();
    return {left:r.left,right:r.right,bottom:r.bottom,top:r.top,width:dialog.clientWidth,scrollWidth:dialog.scrollWidth,buttonBottom:button.bottom};
   });
   assert(geometry.left>=0&&geometry.right<=size.width&&geometry.top>=0&&geometry.bottom<=size.height,JSON.stringify({size,geometry}));
   assert(geometry.scrollWidth<=geometry.width+1,JSON.stringify({size,geometry}));
   assert(geometry.buttonBottom<=size.height,JSON.stringify({size,geometry}));
  }
  await page.setViewportSize({width:1280,height:800});
  await page.screenshot({path:'/tmp/stripboard-export-review.png'});
  await page.locator('#exportClose').click();
  assert.equal(await page.locator('#exportDialog').isVisible(),false);
  await page.locator('#exportButton').click();
  assert.equal(await page.locator('#exportQuantityMode').inputValue(),'project');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#exportDialog').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS export review: inline errors, confirmation reset, format-specific options, escaped content, desktop/mobile bounds and dismissal');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
