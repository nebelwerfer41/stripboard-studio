const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.STUDIO_URL||'http://127.0.0.1:8766';
const output=process.env.STUDIO_TEST_OUTPUT||'/tmp/stripboard-calendar-rules';
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const {fixture}=await import('./fixtures/calendar.mjs'),{encodeMmsx}=await import('../assets/mmsx-codec.js');
 const inputs=[{name:'sample.msd',bytes:await fs.readFile(path.join(__dirname,'../samples/Wonderful Life Demo.msd'))}];
 for(const format of ['5','3','hybrid'])inputs.push({name:`rules-${format}.mmsx`,bytes:Buffer.from(await encodeMmsx(fixture(format)))});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];
  await page.addInitScript(()=>{delete window.showSaveFilePicker});page.on('pageerror',e=>errors.push(e.stack));
  async function model(bytes,name){
   return page.evaluate(async({bytes,name})=>{
    const format=name.endsWith('.mmsx')?'mmsx':'msd',{parseMmsx}=await import('./assets/mmsx-project.js'),{parseMsd}=await import('./assets/msd-parser.js');
    const p=await(format==='mmsx'?parseMmsx:parseMsd)(new Uint8Array(bytes).buffer,name);
    return {calendars:p.calendars.map(c=>({id:c.id,name:c.name,scope:c.scope,daysOff:c.daysOff,specialDays:c.specialDays,scheduleDates:c.scheduleDates})),
     plans:p.boards.map(b=>({name:b.name,calendarId:b.calendarId,dates:b.scheduledGroups.map(g=>g.date)}))};
   },{bytes:Array.from(bytes),name});
  }
  async function save(name){
   const download=page.waitForEvent('download');await page.locator('#saveButton').click();const file=path.join(output,name);await(await download).saveAs(file);return fs.readFile(file);
  }
  for(const {name,bytes} of inputs){
   await page.goto(base);await page.waitForSelector('.strip-outer');await page.locator('#fileInput').setInputFiles({name,mimeType:'application/octet-stream',buffer:bytes});
   await page.waitForFunction(name=>document.querySelector('#projectSubtitle').textContent.includes(name),name);
   await page.locator('#calendarNav').click();await page.locator('#calendarRulesToggle').click();
   const initial=await model(bytes,name),current=await page.locator('#calendarSelect').inputValue();
   const selected=initial.calendars.find(c=>c.scope.segmentId==='b')||initial.calendars.find(c=>c.id!==current);
   assert(selected);await page.locator('#calendarSelect').selectOption(selected.id);
   assert.equal(await page.locator('.rules-target strong').innerText(),selected.name);
   assert.equal(await page.locator('#calendarEditPlan').count(),0);
   assert.equal(await page.locator('#calendarStartDate').inputValue(),selected.scheduleDates.ProductionStartDate?.iso||'');
   // A draft belongs to its calendar and survives consultation of another one.
   await page.locator('#calendarStartDate').fill('');await page.locator('#calendarSelect').selectOption(current);
   assert.equal(await page.locator('.rules-target strong').innerText(),initial.calendars.find(c=>c.id===current).name);
   await page.locator('#calendarSelect').selectOption(selected.id);assert.equal(await page.locator('#calendarStartDate').inputValue(),'');
   const date=await page.locator('#calendarGoDate').inputValue();
   const wasOff=selected.daysOff.Tue==='1';await page.locator('[data-calendar-weekday="Tue"]').setChecked(!wasOff);
   const type=selected.specialDays.find(s=>s.date===date)?.type==='travel'?'holiday':'travel';await page.locator('#calendarException').selectOption(type);
   await page.locator('#calendarStartDate').fill('2031-02-03');await page.locator('#calendarStartDate').dispatchEvent('change');
   assert.equal(await page.locator('#dirtyIndicator').innerText(),'Modifiche non salvate');
   if(initial.plans.some(p=>p.calendarId===selected.id)){
    await page.locator('#calendarReschedule').click();assert.match(await page.locator('#rescheduleEffects').innerText(),new RegExp(selected.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    for(const plan of initial.plans.filter(p=>p.calendarId===selected.id))assert((await page.locator('#rescheduleEffects').innerText()).includes(plan.name));
    await page.locator('#rescheduleForm button[value=apply]').click();await page.locator('#undoMoveButton').click();
   }else assert(await page.locator('#calendarReschedule').isDisabled());
   const saved=await save(name),reopened=await model(saved,name),changed=reopened.calendars.find(c=>c.id===selected.id);
   assert.equal(changed.daysOff.Tue,wasOff?'0':'1');assert.equal(changed.scheduleDates.ProductionStartDate.iso,'2031-02-03');assert.equal(changed.specialDays.find(s=>s.date===date).attributes[type==='travel'?'CompanyTravel':'Holiday'],'1');
   assert.deepEqual(reopened.calendars.filter(c=>c.id!==selected.id),initial.calendars.filter(c=>c.id!==selected.id));assert.deepEqual(reopened.plans,initial.plans);
   // Undo only the three rule edits; consultation itself added no history entries.
   for(let i=0;i<3;i++)await page.locator('#undoMoveButton').click();
   await page.locator('#calendarSelect').selectOption(current);assert.deepEqual(await save(`undo-${name}`),bytes);
   console.log(`PASS ${name}: selected rules, separate drafts, targeted edits and reschedule, save/reopen and full Undo`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
