// Keep the saved gaps when growable fields expand. Fields in separate columns
// flow independently; a full-width field below them follows the tallest column.
export function expandReportBoxes(boxes){
  const ordered=boxes.map((box,index)=>({...box,index,height:Math.max(box.height,box.contentHeight||0),shift:0})).sort((a,b)=>a.y-b.y||a.index-b.index);
  const placed=[];
  for(const box of ordered){
    for(const previous of placed){
      const original=boxes[previous.index];
      const overlaps=previous.x<box.x+box.width-.5&&previous.x+previous.width>box.x+.5;
      if(overlaps&&original.y+original.height<=box.y+.5)box.shift=Math.max(box.shift,previous.shift+previous.height-original.height);
    }
    placed.push(box);
  }
  return ordered.sort((a,b)=>a.index-b.index).map(box=>({...box,y:box.y+box.shift}));
}
