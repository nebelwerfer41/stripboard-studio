/* Responsive navigation, readable phone views and the actual usable split widths. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.STUDIO_URL||'http://127.0.0.1:8766';
const output=process.env.STUDIO_TEST_OUTPUT||'/tmp/stripboard-responsive-qa';
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.stack));
    await page.addInitScript(()=>{delete window.showSaveFilePicker});
    await page.goto(base);await page.waitForSelector('.strip-outer');
    const checkViewport=async()=>{
      const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
      assert(metrics.scrollWidth<=metrics.width,JSON.stringify(metrics));
      assert(metrics.scrollHeight<=metrics.height,JSON.stringify(metrics));
    };
    const checkSingleView=async()=>{
      assert.equal(await page.locator('#workspaceViews>.view:visible').count(),1);
      assert(!(await page.locator('#workspaceSplitter').isVisible()));
      await checkViewport();
    };
    const firstScene=page.locator('#boardView .strip-outer[data-item-kind=scene]').first();
    await firstScene.click();
    const selectedLabel=await firstScene.getAttribute('aria-label');
    await page.locator('#displayOptions>summary').click();
    assert(await firstScene.evaluate(el=>el.classList.contains('strip-selected')));
    await page.locator('#blackWhite').check();assert(await page.locator('#boardView').evaluate(el=>el.classList.contains('is-monochrome')));
    await page.locator('#blackWhite').uncheck();await page.locator('#displayOptions>summary').click();
    await page.locator('#breakdownNav').click();assert.match(await page.locator('#breakdownPreview h3').innerText(),new RegExp(selectedLabel));
    await checkSingleView();
    const current=await page.locator('#breakdownSceneSelect').inputValue();
    await page.locator('[data-breakdown-step="1"]').click();assert.notEqual(await page.locator('#breakdownSceneSelect').inputValue(),current);
    await page.locator('#breakdownSceneSelect').selectOption(current);assert.match(await page.locator('#breakdownPreview h3').innerText(),new RegExp(selectedLabel));
    await page.locator('#closeBreakdown').click();assert.equal(await page.locator('#boardNav').getAttribute('aria-current'),'page');
    await page.screenshot({path:path.join(output,'desktop-stripboard.png')});
    await page.locator('#redFlagNav').click();
    const allFlags=await page.locator('#redFlagView [data-flag-id]').count();assert(allFlags>0);
    await page.locator('#rfFrom').fill('2030-01-01');await page.locator('#rfFrom').dispatchEvent('change');
    assert.equal(await page.locator('#redFlagView [data-flag-id]').count(),0);
    await page.locator('#rfClearDates').click();assert.equal(await page.locator('#redFlagView [data-flag-id]').count(),allFlags);
    await page.locator('#rfCategory').selectOption('__general__');
    assert.equal(await page.locator('#redFlagView tr[data-flag-id] td:nth-child(2)').evaluateAll(els=>els.every(el=>el.textContent==='—')),true);
    await page.locator('#rfCategory').selectOption('');await page.locator('#boardNav').click();

    for(const layout of ['board-breakdown','calendar-breakdown','calendar-board']){
      await page.locator('#workspaceLayout').selectOption(layout);
      const left=layout.startsWith('calendar')?'calendarView':'boardView',right=layout==='calendar-board'?'boardView':'breakdownPreview';
      const checkSplit=async()=>{
        const widths=await page.evaluate(([left,right])=>{
          const total=document.querySelector('#workspaceViews').getBoundingClientRect().width,handle=document.querySelector('#workspaceSplitter').getBoundingClientRect().width;
          return [document.getElementById(left).getBoundingClientRect().width,document.getElementById(right).getBoundingClientRect().width,total-handle];
        },[left,right]);
        assert(widths[0]>=widths[2]*.25-.5,JSON.stringify(widths));assert(widths[1]>=widths[2]*.25-.5,JSON.stringify(widths));
        assert(Math.abs(widths[0]+widths[1]-widths[2])<1,JSON.stringify(widths));
      };
      for(const [key,value] of [['Home','25'],['ArrowLeft','25'],['End','75'],['ArrowRight','75']]){
        await page.locator('#workspaceSplitter').focus();await page.keyboard.press(key);
        assert.equal(await page.locator('#workspaceSplitter').getAttribute('aria-valuenow'),value);await checkSplit();
      }
      const area=await page.locator('#workspaceViews').boundingBox();
      for(const [x,value] of [[area.x-50,'25'],[area.x+area.width+50,'75']]){
        const handle=await page.locator('#workspaceSplitter').boundingBox();
        await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
        await page.mouse.move(x,handle.y+handle.height/2,{steps:6});await page.mouse.up();
        assert.equal(await page.locator('#workspaceSplitter').getAttribute('aria-valuenow'),value);await checkSplit();
      }
      // Small viewports reuse one full-width view; the explicit desktop pair returns on resize.
      await page.setViewportSize({width:1024,height:768});await page.waitForFunction(()=>!document.querySelector('#workspaceViews').classList.contains('split'));await checkSingleView();assert(await page.locator('#workspaceLayout').isDisabled());
      await page.setViewportSize({width:1440,height:900});await page.waitForFunction(()=>document.querySelector('#workspaceViews').classList.contains('split'));assert.equal(await page.locator('#workspaceViews>.view:visible').count(),2);await checkSplit();
    }
    await page.screenshot({path:path.join(output,'desktop-calendar-stripboard.png')});
    await page.locator('#workspaceLayout').selectOption('single');

    for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,768],[1199,800],[1200,800],[1201,900]]){
      await page.setViewportSize({width,height});
      for(const nav of ['boardNav','calendarNav','breakdownNav','reportNav','redFlagNav','dataNav']){
        await page.locator(`#${nav}`).click();await checkSingleView();
        assert.equal(await page.locator(`#${nav}`).getAttribute('aria-current'),'page');
      }
      await page.locator('#boardNav').click();
      const board=await page.locator('#boardView').boundingBox();assert(board.y<340,`Board starts at ${board.y} at ${width}px`);
      if(width<=620){
        const summary=page.locator('.strip-mobile-summary:visible').first();
        assert(Number(await summary.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)))>=12);
        await page.locator('#calendarNav').click();
        const firstVisible=page.locator('.operational-grid .calendar-strip:visible').first();
        await firstVisible.scrollIntoViewIfNeeded();await firstVisible.click();const activeKey=await firstVisible.getAttribute('data-scene-strip');
        assert(await page.locator('.agenda-weekday:visible').count()>0);
        await page.locator('#calendarAgendaToggle').click();assert.equal(await page.locator('.operational-weekday:visible').count(),7);
        await page.locator('#calendarAgendaToggle').click();assert.equal(await page.locator('.operational-weekday:visible').count(),0);
        await page.locator('#breakdownNav').click();await checkSingleView();
        const preview=await page.locator('#breakdownPreview').boundingBox();assert(preview.y<160);assert(preview.width>width-30);
        await page.locator('#closeBreakdown').click();assert.equal(await page.locator('.operational-grid .calendar-strip.active').getAttribute('data-scene-strip'),activeKey);
      }
    }
    await page.setViewportSize({width:390,height:844});await page.locator('#boardNav').click();
    await page.screenshot({path:path.join(output,'phone-stripboard.png')});
    await page.locator('#calendarNav').click();await page.screenshot({path:path.join(output,'phone-calendar.png')});
    await page.locator('#breakdownNav').click();await page.screenshot({path:path.join(output,'phone-spoglio.png')});
    await page.emulateMedia({media:'print'});assert(await page.locator('#breakdownPreview').isVisible());assert(!(await page.locator('.app-header').isVisible()));
    await page.emulateMedia({media:'screen'});
    assert.equal(await page.locator('#dirtyIndicator').innerText(),'Salvato');
    const download=page.waitForEvent('download');await page.locator('#saveButton').click();
    const saved=path.join(output,'responsive-noop.msd');await(await download).saveAs(saved);
    assert.deepEqual(await fs.readFile(saved),await fs.readFile(path.join(__dirname,'../samples/Wonderful Life Demo.msd')));

    // Compact phone strips retain the original reorder and Undo workflow for both source orientations.
    await page.locator('#boardNav').click();
    for(const orientation of ['HORIZONTAL','VERTICAL']){
      await page.locator('#displayOptions>summary').click();
      const layouts=await page.locator('#layoutSelect option').allTextContents();
      const chosen=orientation==='VERTICAL'?layouts.find(name=>/vertical/i.test(name)):layouts.find(name=>/thin horizontal/i.test(name));
      assert(chosen);await page.locator('#layoutSelect').selectOption(chosen);await page.locator('#displayOptions>summary').click();
      await page.emulateMedia({media:'print'});
      assert(await page.locator('#boardView .strip-layout').first().isVisible());assert.equal(await page.locator('.strip-mobile-summary:visible').count(),0);
      const sourceWidth=await page.locator('#boardView').evaluate(el=>parseFloat(el.style.getPropertyValue('--print-board-width')));assert(sourceWidth>1);
      await page.emulateMedia({media:'screen'});
      const scene=page.locator('#boardView .strip-outer[data-item-kind=scene]').first(),label=await scene.getAttribute('aria-label');
      const target=page.locator('#boardView .strip-outer[data-item-kind=scene]').nth(1);
      await scene.scrollIntoViewIfNeeded();const from=await scene.boundingBox(),to=await target.boundingBox();
      await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
      await page.mouse.move(to.x+to.width/2,to.y+to.height-3,{steps:8});await page.mouse.up();
      assert.notEqual(await page.locator('#boardView .strip-outer[data-item-kind=scene]').first().getAttribute('aria-label'),label);
      await page.locator('#undoMoveButton').click();assert.equal(await page.locator('#boardView .strip-outer[data-item-kind=scene]').first().getAttribute('aria-label'),label);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS top navigation, full-width Spoglio, phone agenda/month, seven viewport sizes, all split limits by pointer/keyboard, exact no-op save and phone reorder/Undo');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
