import assert from 'node:assert/strict';
import {test} from 'node:test';
import {expandReportBoxes} from '../assets/report-layout.js';
import {elementLabel,sortCategoryElements} from '../assets/element-format.js';

test('scene 12 props follow category name order, not numeric ID order',()=>{
  const elements=[{name:'Prescription Box',boardId:'65'},{name:'Poison Capsules',boardId:'63'},{name:'Telephone',boardId:'48'},{name:'Liquor Bottle',boardId:'18'}];
  assert.deepEqual(sortCategoryElements(elements,{SortElementsBy:'2',SortAscending:'1'}).map(elementLabel),['18.Liquor Bottle','63.Poison Capsules','65.Prescription Box','48.Telephone']);
  assert.equal(elementLabel({name:'Snow',boardId:''}),'Snow');
});

test('growing lists push following fields and separator without overlapping columns',()=>{
  const boxes=[
    {x:0,y:20,width:100,height:10,contentHeight:40},
    {x:110,y:20,width:100,height:10,contentHeight:60},
    {x:0,y:35,width:100,height:10},
    {x:110,y:35,width:100,height:10},
    {x:0,y:55,width:210,height:1}
  ];
  const result=expandReportBoxes(boxes);
  assert.deepEqual(result.map(box=>[box.y,box.height]),[[20,40],[20,60],[65,10],[85,10],[105,1]]);
  assert.equal(boxes[2].y,35,'saved layout is not modified');
});

test('empty or short growable text preserves the saved minimum size',()=>{
  const result=expandReportBoxes([{x:0,y:0,width:100,height:30,contentHeight:10},{x:0,y:40,width:100,height:20}]);
  assert.equal(result[0].height,30);
  assert.equal(result[1].y,40);
});
