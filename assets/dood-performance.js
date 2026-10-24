import {calculateDood,doodElements} from './dood-engine.js';

// Keep only the current calculation. Display preferences never invalidate attendance.
export function createDoodCache(){
 let owner,version,all,entry;
 function elements(project,revision){
  if(owner!==project||version!==revision){owner=project;version=revision;all=doodElements(project);entry=null}
  return all;
 }
 return {clear(){owner=null;entry=null;all=null},elements,report(project,revision,board,calendar,category){
  const list=elements(project,revision);
  if(!entry||entry.board!==board||entry.calendar!==calendar||entry.category!==category)
   entry={board,calendar,category,value:calculateDood({project,board,calendar,elements:list.filter(e=>e.category===category)})};
  return entry.value;
 }};
}

// Window only the screen: totals, cell details, CSV and print retain the full report.
export function doodWindow(report,ui){
 const large=report.rows.length*report.dates.length>12000||report.rows.length>200||report.dates.length>180;
 const dateLimit=large?90:Math.max(1,report.dates.length);
 const rowLimit=large?Math.min(100,Math.floor(6000/Math.min(dateLimit,Math.max(1,report.dates.length)))):Math.max(1,report.rows.length);
 const rowPages=Math.max(1,Math.ceil(report.rows.length/rowLimit)),datePages=Math.max(1,Math.ceil(report.dates.length/dateLimit));
 const rowPage=Math.max(0,Math.min(rowPages-1,ui.rowPage||0)),datePage=Math.max(0,Math.min(datePages-1,ui.datePage||0));
 const rowStart=rowPage*rowLimit,dateStart=datePage*dateLimit;
 return {large,rowPage,datePage,rowPages,datePages,rowStart,dateStart,rowLimit,dateLimit,
  rows:report.rows.slice(rowStart,rowStart+rowLimit).map(row=>({...row,cells:row.cells.slice(dateStart,dateStart+dateLimit)})),
  dates:report.dates.slice(dateStart,dateStart+dateLimit)};
}
