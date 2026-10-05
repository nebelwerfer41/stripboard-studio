/* Revision bookkeeping stays separate from source bytes and interpreted project data. */
export function resetDocumentState(state){
  state.revision=0;state.savedRevision=0;state.serializationState='idle';
}
export function documentIsDirty(state){return state.revision!==state.savedRevision}
export function markDocumentEdited(state){state.revision++}
export function beginDocumentSave(state){
  if(state.serializationState==='saving')throw Error('Salvataggio già in corso');
  state.serializationState='saving';
  return {project:state.project,revision:state.revision};
}
export function finishDocumentSave(state,token,succeeded){
  if(state.project!==token.project)return;
  if(succeeded)state.savedRevision=token.revision;
  state.serializationState='idle';
}
