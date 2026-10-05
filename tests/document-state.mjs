import test from 'node:test';
import assert from 'node:assert/strict';
import {resetDocumentState,documentIsDirty,markDocumentEdited,beginDocumentSave,finishDocumentSave} from '../assets/document-state.js';

test('clean → edit → successful save → clean',()=>{
  const state={project:{}};resetDocumentState(state);
  assert.equal(documentIsDirty(state),false);
  markDocumentEdited(state);assert.equal(documentIsDirty(state),true);
  const token=beginDocumentSave(state);finishDocumentSave(state,token,true);
  assert.equal(documentIsDirty(state),false);
});

test('a failed save leaves every edit dirty',()=>{
  const state={project:{}};resetDocumentState(state);markDocumentEdited(state);
  const token=beginDocumentSave(state);finishDocumentSave(state,token,false);
  assert.equal(state.savedRevision,0);assert.equal(documentIsDirty(state),true);
});

test('edits made while a save is in flight remain dirty',()=>{
  const state={project:{}};resetDocumentState(state);markDocumentEdited(state);
  const token=beginDocumentSave(state);markDocumentEdited(state);
  finishDocumentSave(state,token,true);
  assert.equal(state.savedRevision,1);assert.equal(state.revision,2);assert.equal(documentIsDirty(state),true);
});

test('completion for an old project cannot clean the new project',()=>{
  const state={project:{}};resetDocumentState(state);markDocumentEdited(state);
  const token=beginDocumentSave(state);state.project={};resetDocumentState(state);markDocumentEdited(state);
  finishDocumentSave(state,token,true);
  assert.equal(state.savedRevision,0);assert.equal(documentIsDirty(state),true);
});
