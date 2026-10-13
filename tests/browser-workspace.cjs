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
 for(const name of ['parser','msd-categories','roundtrip','conservation','calendar-roundtrip']){
  await page.goto(`${base}/tests/${name}.html`);await page.waitForFunction(()=>['true','false'].includes(document.body.dataset.passed));
  assert.equal(await page.locator('body').getAttribute('data-passed'),'true',`${name}: ${await page.locator('body').innerText()}`);console.log('PASS',name);
 }
 if(process.env.REAL_MSD){await page.locator('#file').setInputFiles(process.env.REAL_MSD);await page.waitForFunction(()=>['true','false'].includes(document.body.dataset.passed));assert.equal(await page.locator('body').getAttribute('data-passed'),'true',await page.locator('#result').innerText());console.log('PASS real MSD calendar roundtrip')}
 assert.deepEqual(errors,[]);console.log('ALL PARSER AND NATIVE ROUNDTRIP BROWSER CHECKS PASSED');
 assert.deepEqual(errors,[]);console.log('PASS workspace adapter browser suite; use browser-workspace-revision.cjs for authoring');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
