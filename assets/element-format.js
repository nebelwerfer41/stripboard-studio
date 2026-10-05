export function elementTotal(names){
  return names.reduce((total,name)=>{
    const leading=/^\s*(\d+(?:[.,]\d+)?)/.exec(name||'');
    return total+(leading?Number(leading[1].replace(',','.')):1);
  },0);
}

export function elementSumText({type,text,category,suppress},names){
  const total=elementTotal(names);
  if(total===0&&suppress==='1')return '';
  const label=text||(type==='2'?category||'':'');
  if(type==='2')return label;
  if(type==='3')return label?`${label}${/\s$/.test(label)?'':' '}${total}`:String(total);
  return String(total);
}

export function customListText(category,values,printCategory){
  const entries=values.filter(Boolean).join('\n');
  return printCategory==='1'&&entries&&category?`${category}\n${entries}`:entries;
}

export function categoryElementsText(values,style){
  return values.filter(Boolean).join(style==='COMMA_DELIMETED_LIST'?', ':'\n');
}

export function elementLabel(element){
  return element.boardId?`${element.boardId}.${element.name}`:element.name;
}

const elementCollator=new Intl.Collator('it',{numeric:true,sensitivity:'base'});
export function sortCategoryElements(elements,attributes={}){
  const direction=attributes.SortAscending==='0'||attributes.SortAscending==='-1'?-1:1;
  return [...elements].sort((a,b)=>{
    if(attributes.SortElementsBy==='1')return direction*elementCollator.compare(a.boardId||'',b.boardId||'');
    if(attributes.SortElementsBy==='2')return direction*elementCollator.compare(a.name,b.name);
    return (Number(a.sortOrder)||0)-(Number(b.sortOrder)||0);
  });
}
