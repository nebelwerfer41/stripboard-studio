let installed=false;
export function installOverlayDismissal(){
  if(installed)return;installed=true;let pressed=null;
  const outside=(dialog,event)=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom};
  document.addEventListener('pointerdown',event=>{pressed=event.target instanceof HTMLDialogElement&&event.target.open&&outside(event.target,event)?event.target:null},true);
  document.addEventListener('pointerup',event=>{if(pressed&&event.target===pressed&&outside(pressed,event)){
    const cancel=new Event('cancel',{cancelable:true});if(pressed.dispatchEvent(cancel))pressed.close();
  }pressed=null},true);
}
export function createOverlay(id,{className=''}={}){
  installOverlayDismissal();const dialog=document.createElement('dialog');dialog.id=id;dialog.className=`studio-overlay ${className}`;document.body.append(dialog);
  return {dialog,show(){if(!dialog.open)dialog.showModal()},close(){dialog.close()},open(title,html,{onMount}={}){
    dialog.innerHTML=`<header class="overlay-header"><h2>${title}</h2><button type="button" data-overlay-close aria-label="Chiudi">×</button></header><div class="overlay-body">${html}</div>`;
    dialog.querySelector('[data-overlay-close]').onclick=()=>dialog.close();onMount?.(dialog);if(!dialog.open)dialog.showModal();
  }};
}
