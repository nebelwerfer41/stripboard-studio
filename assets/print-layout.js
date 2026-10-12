/* Shared physical page geometry, independent of DOM and of the report renderer. */
export const PAPER_SIZES={A4:[210,297],A3:[297,420],Letter:[215.9,279.4],Legal:[215.9,355.6]};
export const DEFAULT_PRINT_SETTINGS=Object.freeze({paper:'A4',orientation:'landscape',margin:10,scale:1,density:1,autoDensity:true,dateWidth:9,nameWidth:42,rowHeight:5,fontSize:8,repeatHeaders:true,repeatIdentity:true,summary:'after'});
export function printGeometry(settings={}){
  const s={...DEFAULT_PRINT_SETTINGS,...settings};
  const positive=(key,min,max)=>{const n=Number(s[key]);if(!Number.isFinite(n)||n<min||n>max)throw Error(`Impostazione stampa non valida: ${key}`);s[key]=n};
  for(const [key,min,max] of [['margin',0,40],['scale',.5,2],['density',.65,1.6],['dateWidth',6,30],['nameWidth',20,100],['rowHeight',3,15],['fontSize',6,14]])positive(key,min,max);
  if(!PAPER_SIZES[s.paper]||!['portrait','landscape'].includes(s.orientation))throw Error('Formato carta non valido');
  const size=PAPER_SIZES[s.paper],width=s.orientation==='landscape'?size[1]:size[0],height=s.orientation==='landscape'?size[0]:size[1];
  return {settings:s,width,height,contentWidth:(width-2*s.margin)/s.scale,contentHeight:(height-2*s.margin)/s.scale};
}
const charWidth=font=>font*.3528*.95;
export function paginateDood(report,settings={}){
  const geometry=printGeometry(settings),s=geometry.settings;
  // Automatic density selects a readable table size, and never forces a single page.
  const density=s.autoDensity?(geometry.contentWidth<230?.9:1):s.density;
  const fontSize=Math.max(6,s.fontSize*density),dateWidth=Math.max(s.dateWidth*density,charWidth(fontSize)*3+2),nameWidth=s.nameWidth*density;
  const identityWidth=10*density+nameWidth+22*density;
  const headerHeight=16*density,tableHeaderHeight=16*density,footerHeight=7*density;
  const rowHeight=Math.max(s.rowHeight*density,fontSize*.3528+2);
  const textLines=(text,width)=>Math.max(1,Math.ceil(String(text??'').length*charWidth(fontSize)/(width-2)));
  const nameLines=name=>textLines(name,nameWidth);
  const identityLines=row=>Math.max(nameLines(row.element.name),textLines(row.element.boardId,10*density));
  function bands(items,heightFor,capacity){
    const result=[];let start=0,height=0;
    for(let i=0;i<items.length;i++){
      const h=heightFor(items[i]);if(h>capacity)throw Error('Una riga non entra nella pagina: aumenta il formato o riduci la densità');
      if(height+h>capacity&&i>start){result.push({start,end:i,height});start=i;height=0}height+=h;
    }
    result.push({start,end:items.length,height});return result;
  }
  const pages=[];
  function matrixPages(){
    let dateStart=0,columnBand=0;
    do{
      const identity=columnBand===0||s.repeatIdentity;
      const available=geometry.contentWidth-(identity?identityWidth:0);
      const count=Math.floor(available/dateWidth);if(count<1)throw Error('Nessuna data entra nella pagina: riduci margini, scala o larghezze');
      const dateEnd=Math.min(report.dates.length,dateStart+count);
      const cellLines=row=>Math.max(1,...row.cells.slice(dateStart,dateEnd).map(c=>Math.ceil(c.codes.join(' ').length*charWidth(fontSize)/(dateWidth-2))));
      const rows=bands(report.rows,r=>Math.max(rowHeight,(identity?identityLines(r):1)*fontSize*.3528+2,cellLines(r)*fontSize*.3528+2),geometry.contentHeight-headerHeight-tableHeaderHeight-footerHeight);
      rows.forEach((band,rowBand)=>pages.push({kind:'matrix',dateStart,dateEnd,rowStart:band.start,rowEnd:band.end,columnBand,rowBand,
        identity,headers:s.repeatHeaders||rowBand===0,rowHeights:report.rows.slice(band.start,band.end).map(r=>Math.max(rowHeight,(identity?identityLines(r):1)*fontSize*.3528+2,cellLines(r)*fontSize*.3528+2))}));
      dateStart=dateEnd;columnBand++;
    }while(dateStart<report.dates.length);
  }
  function summaryPages(){
    bands(report.rows,r=>Math.max(rowHeight,identityLines(r)*fontSize*.3528+2),geometry.contentHeight-headerHeight-tableHeaderHeight-footerHeight).forEach(band=>pages.push({kind:'summary',rowStart:band.start,rowEnd:band.end,identity:true,headers:true}));
  }
  if(s.summary==='before'||s.summary==='only')summaryPages();
  if(s.summary!=='only')matrixPages();
  if(s.summary==='after')summaryPages();
  return {...geometry,fontSize,dateWidth,nameWidth,identityWidth,rowHeight,headerHeight,tableHeaderHeight,footerHeight,density,pages:pages.map((p,i)=>({...p,number:i+1,total:pages.length}))};
}
export function paginateSchedule(items,settings={}){
  const g=printGeometry(settings),available=g.contentHeight-17,pages=[];let current=[],used=0;
  for(const item of items){
    if(!Number.isFinite(item.height)||!Number.isFinite(item.width)||item.height<=0||item.width<=0)throw Error('Dimensioni strip non valide');
    const fit=Math.min(1,g.contentWidth/item.width,available/item.height),height=item.height*fit;
    if(height>available)throw Error('Strip più alta della pagina');
    if(used+height>available&&current.length){pages.push({kind:'schedule',items:current});current=[];used=0}
    current.push({...item,fit,height});used+=height;
  }
  if(current.length||!pages.length)pages.push({kind:'schedule',items:current});
  return {...g,pages:pages.map((p,i)=>({...p,number:i+1,total:pages.length}))};
}
