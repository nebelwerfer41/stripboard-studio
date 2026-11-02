/* Optional local attachment checks: never redistribute the user's sample content. */
const {chromium}=require('playwright'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
(async()=>{
 if(!process.env.MSD_SAMPLE)throw Error('Imposta MSD_SAMPLE al campione locale');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage();await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8766');
 let expectedTimes=null;if(process.env.MMSX_SAMPLE){const {parseMmsx}=await import('../assets/mmsx-project.js');const reference=await parseMmsx(await fs.readFile(process.env.MMSX_SAMPLE));expectedTimes=reference.scenes.map(s=>({scene:s.scene,time:s.estimateTimeA}));}
 const result=await page.evaluate(async ({data,expectedTimes})=>{
  const {parseMsd}=await import('./assets/msd-parser.js'),{serializeMsd}=await import('./assets/msd-writer.js');
  const bytes=new Uint8Array(data),p=await parseMsd(bytes.buffer,'sample.msd'),noop=new Uint8Array(serializeMsd(p,{acceptLoss:true}));
  if(!bytes.every((x,i)=>x===noop[i])||bytes.length!==noop.length)throw Error('Native no-op changed');
  let pairedTimes=0;if(expectedTimes){if(expectedTimes.length!==p.scenes.length)throw Error('Paired scene count');for(let i=0;i<p.scenes.length;i++){if(p.scenes[i].scene!==expectedTimes[i].scene||p.scenes[i].estimateTimeA!==expectedTimes[i].time)throw Error(`Paired native time mismatch at sheet ${i+1}`);pairedTimes++}}
  p.documentEditing=true;p.scenes[0].synopsis='Verifica sintetica';const exported=serializeMsd(p,{acceptLoss:true}),q=await parseMsd(exported,'rebuilt.msd');
  if(q.scenes[0].synopsis!=='Verifica sintetica')throw Error('Stale source');
  if(q.sourceDocument.sections.length!==11||q.sourceDocument.scheduleVersion!=='04.00.000')throw Error('Wrong EPSF variant');
  const xml=q.sourceXmlSections.ElementMgr,doc=new DOMParser().parseFromString(xml,'application/xml');for(const prop of doc.querySelectorAll('Elements > Element > Property'))if(prop.hasAttribute('Value'))throw Error('Wrong native property representation');
  return {scenes:q.scenes.length,boards:q.boards.length,sections:q.sourceDocument.sections.length,nativeNoop:true,currentEdit:true,pairedTimes};
 },{data:[...await fs.readFile(process.env.MSD_SAMPLE)],expectedTimes});assert.equal(result.scenes,146);console.log('PASS supplied MSD: native identity, full edit, 04/MMB10 framing and native property XML',result);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
