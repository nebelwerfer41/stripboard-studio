import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {STRIP_GESTURE,movementIntent} from '../assets/strip-interaction.js';

// Exercise the actual page handlers, including pointer completion, without a browser dependency.
const source=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
function fixture(){
  const handlers={},starts=[],moves=[],state={mode:'board',selectedStripIds:new Set(['scene']),draggedStripIds:new Set()};
  const listen=(name,handler)=>{handlers[name]=handler};
  const view={contains:target=>target.inside,offsetWidth:500,clientWidth:500,offsetHeight:300,clientHeight:300,
    scrollWidth:500,scrollHeight:300,scrollTop:0,getBoundingClientRect:()=>({left:100,top:200,right:600,bottom:500})};
  const context=vm.createContext({state,STRIP_GESTURE,movementIntent,performance,
    document:{querySelector:()=>null,elementFromPoint:()=>null,addEventListener:listen,documentElement:{clientWidth:1000,clientHeight:800},body:{hasPointerCapture:()=>false,classList:{remove(){}}}},
    window:{addEventListener:listen},$:id=>id==='calendarView'?{hidden:true,contains:()=>false}:view,isMac:false,
    starts,moves,applyBoardMove:(intent,to)=>moves.push({intent,to}),showStatus(){},positionDrag(){},
    clearStripSelection:()=>state.selectedStripIds.clear(),clearTimeout,setTimeout,cancelAnimationFrame(){},
    selectItem:key=>{state.selectedStripIds.clear();state.selectedStripIds.add(key)},
    itemKey:()=> 'scene',movePositionFrom:()=>({}),stripAt:()=>({kind:'scene'})});
  vm.runInContext('let stripPointer=null; let lastDragAt=0; function startStripDrag(event){starts.push(event.pointerId);stripPointer.active=true;stripPointer.intent={sourceKeys:[stripPointer.key]};stripPointer.slot={position:{stripIndex:1}}}'+
    source.slice(source.indexOf('function endStripDrag('),source.indexOf('function applyBoardMove('))+
    source.slice(source.indexOf('function isToggleGesture('),source.indexOf('// Pointer completion owns'))+
    source.slice(source.indexOf("document.addEventListener('pointerdown'"),source.indexOf("$('moveGroup').addEventListener")),context);
  const target=({inside=false,strip=false,control=false}={})=>({inside,closest:selector=>{
    // Rendered strips have role="button", including when a child receives the event.
    if(strip&&selector.includes('[role="button"]')&&!selector.includes('[role="button"]:not(.strip-outer)'))return {};
    if(strip&&selector.startsWith('.strip-outer'))return {dataset:{itemKind:'scene'},classList:{remove(){},add(){}}};
    if(control&&selector.includes('button'))return {};
    return null;
  }});
  const pointer=(type,target,x=100,y=100)=>({pointerId:1,pointerType:type,button:0,target,clientX:x,clientY:y,preventDefault(){}});
  return {handlers,state,view,target,pointer,starts,moves,context};
}
for(const type of ['mouse','touch']){
  test(`${type}: accessible strips remain selectable before and after dismissing selection`,()=>{
    const f=fixture();f.state.selectedStripIds.clear();
    for(const strip of [true,false,true]){
      const event=f.pointer(type,f.target({inside:strip,strip}));
      f.handlers.pointerdown(event);f.handlers.pointerup(event);
      assert.equal(f.state.selectedStripIds.size,strip?1:0);
    }
  });
  test(`${type}: blank page space and board space both clear selection`,()=>{
    for(const inside of [false,true]){
      const f=fixture(),event=f.pointer(type,f.target({inside}));
      f.handlers.pointerdown(event);f.handlers.pointerup(event);
      assert.equal(f.state.selectedStripIds.size,0);
    }
  });
  test(`${type}: controls, scrollbars and other views preserve selection`,()=>{
    for(const kind of ['control','scrollbar','other-view']){
      const f=fixture();
      if(kind==='other-view')f.state.mode='report';
      const event=f.pointer(type,f.target({control:kind==='control'}),kind==='scrollbar'?1000:100);
      f.handlers.pointerdown(event);f.handlers.pointerup(event);
      assert.equal(f.state.selectedStripIds.size,1);
    }
  });
  test(`${type}: movement, cancellation and release over a strip preserve selection`,()=>{
    for(const kind of ['move','cancel','strip']){
      const f=fixture(),event=f.pointer(type,f.target());
      f.handlers.pointerdown(event);
      if(kind==='move')f.handlers.pointermove({...event,clientY:150});
      if(kind==='strip')event.target=f.target({inside:true,strip:true});
      f.handlers[kind==='cancel'?'pointercancel':'pointerup'](event);
      assert.equal(f.state.selectedStripIds.size,1);
    }
  });
}

for(const type of ['mouse','touch'])test(`${type}: Calendar paired with visible Stripboard accepts selection; hidden Stripboard stays inert`,()=>{
 for(const hidden of [false,true]){
  const f=fixture();f.state.mode='calendar';f.view.hidden=hidden;f.state.selectedStripIds.clear();
  const event=f.pointer(type,f.target({inside:true,strip:true}));f.handlers.pointerdown(event);f.handlers.pointerup(event);
  assert.equal(f.state.selectedStripIds.size,hidden?0:1);
 }
});
test('mouse drag from the Stripboard pane in Calendar reaches the shared move command',()=>{
 const f=fixture();f.state.mode='calendar';f.view.hidden=false;
 const down=f.pointer('mouse',f.target({inside:true,strip:true}));f.handlers.pointerdown(down);
 f.handlers.pointermove({...down,clientY:down.clientY+STRIP_GESTURE.mouseDragPx+1});
 assert.equal(f.starts.length,1);f.handlers.pointerup(down);assert.equal(f.moves.length,1);assert.equal(f.moves[0].intent.sourceKeys[0],'scene');
});
test('drag autoscroll follows the independently scrolling Stripboard panel',()=>{
 const f=fixture(),windowMoves=[];f.view.scrollHeight=1200;
 f.context.window.innerHeight=800;f.context.window.scrollBy=(x,y)=>windowMoves.push([x,y]);f.context.requestAnimationFrame=()=>0;
 vm.runInContext(source.slice(source.indexOf('function dragAutoscroll('),source.indexOf('function startStripDrag(')),f.context);
 vm.runInContext('stripPointer={active:true,x:300,y:495};dragAutoscroll()',f.context);
 assert(f.view.scrollTop>0);assert.equal(windowMoves.length,0);
 f.view.scrollHeight=300;vm.runInContext('stripPointer.y=790;dragAutoscroll()',f.context);assert.equal(windowMoves.length,1);
});
