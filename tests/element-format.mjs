import assert from 'node:assert/strict';
import {test} from 'node:test';
import {elementTotal,elementSumText,customListText,categoryElementsText} from '../assets/element-format.js';

test('element totals use a leading quantity and count other names once',()=>{
  assert.equal(elementTotal(['20 Townspeople','2 Guards','Captain','0 Stand-ins']),23);
  assert.equal(elementTotal(['Guard 20',' 3 Dancers']),4);
});

test('element sum modes respect text, number and zero suppression',()=>{
  const names=['20 Townspeople','2 Guards','Captain'];
  assert.equal(elementSumText({type:'0',text:'Extras:'},names),'23');
  assert.equal(elementSumText({type:'1',text:''},names),'23');
  assert.equal(elementSumText({type:'2',text:'Extras:'},names),'Extras:');
  assert.equal(elementSumText({type:'3',text:'E: '},names),'E: 23');
  assert.equal(elementSumText({type:'3',text:'E:',suppress:'1'},[]),'');
});

test('report category heading appears only when requested and entries exist',()=>{
  assert.equal(customListText('Props',['Chair','Lamp'],'1'),'Props\nChair\nLamp');
  assert.equal(customListText('Props',['Chair','Lamp'],'0'),'Chair\nLamp');
  assert.equal(customListText('Props',[],'1'),'');
});

test('MSD element style selects comma list or grid rows',()=>{
  assert.equal(categoryElementsText(['George','Mary','Clarence'],'COMMA_DELIMETED_LIST'),'George, Mary, Clarence');
  assert.equal(categoryElementsText(['George','Mary','Clarence'],'GRID'),'George\nMary\nClarence');
});
