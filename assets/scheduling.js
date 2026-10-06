/* Structural scheduling commands. They mutate the project model, never the DOM. */
const CONTAINERS={scheduledGroups:'ScheduledStrips',unscheduledGroups:'UnscheduledStrips'};

function locate(board,position){
  if(!Object.hasOwn(CONTAINERS,position?.container))throw Error('Contenitore strip non valido');
  const group=board[position.container]?.[position.groupIndex];
  if(!group)throw Error('Giorno o gruppo non disponibile');
  return group;
}

export function moveStrip(project,{boardName,from,to}){
  const board=project.boards.find(item=>item.name===boardName);
  if(!board)throw Error('Stripboard non trovata');
  const source=locate(board,from),target=locate(board,to);
  if(!Number.isInteger(from.stripIndex)||from.stripIndex<0||from.stripIndex>=source.strips.length)throw Error('Strip sorgente non valida');
  if(!Number.isInteger(to.stripIndex)||to.stripIndex<0||to.stripIndex>target.strips.length)throw Error('Posizione di destinazione non valida');
  if(source===target&&(to.stripIndex===from.stripIndex||to.stripIndex===from.stripIndex+1))return false;
  const [strip]=source.strips.splice(from.stripIndex,1);
  const insertion=source===target&&to.stripIndex>from.stripIndex?to.stripIndex-1:to.stripIndex;
  target.strips.splice(insertion,0,strip);
  return true;
}

// Source keys identify the original MSD nodes and remain stable as strips move.
export function moveStrips(project,{boardName,sourceKeys,to}){
  const board=project.boards.find(item=>item.name===boardName);
  if(!board)throw Error('Stripboard non trovata');
  const target=locate(board,to);
  if(!Number.isInteger(to.stripIndex)||to.stripIndex<0||to.stripIndex>target.strips.length)throw Error('Posizione di destinazione non valida');
  const keys=new Set(sourceKeys);
  if(!keys.size||keys.size!==sourceKeys.length)throw Error('Selezione strip non valida');
  const groups=[...board.scheduledGroups,...board.unscheduledGroups];
  const ordered=groups.flatMap(group=>group.strips.filter(strip=>keys.has(strip.sourceKey)));
  if(ordered.length!==keys.size)throw Error('Selezione strip non valida');
  const insertion=to.stripIndex-target.strips.slice(0,to.stripIndex).filter(strip=>keys.has(strip.sourceKey)).length;
  const next=groups.map(group=>group.strips.filter(strip=>!keys.has(strip.sourceKey)));
  next[groups.indexOf(target)].splice(insertion,0,...ordered);
  const changed=groups.some((group,index)=>group.strips.length!==next[index].length||group.strips.some((strip,i)=>strip!==next[index][i]));
  if(changed)groups.forEach((group,index)=>{group.strips=next[index]});
  return changed;
}

export function dayBreakKey(boardName,group){return `dayBreak:${JSON.stringify([boardName,group.mmsxDay||[group.sourceContainer||'ScheduledStrips',group.sourceIndex]])}`}
export function isDayBreakKey(key){return typeof key==='string'&&key.startsWith('dayBreak:')}

// Day breaks are group boundaries in both containers. Move a flat sequence,
// then repartition it without carrying unselected scenes along with a boundary.
export function moveBoardItems(project,{boardName,sourceKeys,to}){
  const board=project.boards.find(item=>item.name===boardName);
  if(!board)throw Error('Stripboard non trovata');
  const keys=new Set(sourceKeys);
  if(!keys.size||keys.size!==sourceKeys.length)throw Error('Selezione non valida');
  const target=locate(board,to);
  if(!Number.isInteger(to.stripIndex)||to.stripIndex<0||to.stripIndex>target.strips.length)throw Error('Destinazione non valida');
  const containers=Object.keys(CONTAINERS),sequences={},positions=new Map();
  for(const container of containers){
    const tokens=[];
    for(const group of board[container]){
      positions.set(group,tokens.length);
      tokens.push(...group.strips.map(strip=>({strip,key:strip.sourceKey})));
      if(['ScheduleDay','UnscheduledDay'].includes(group.kind))tokens.push({break:group,key:dayBreakKey(boardName,group)});
      else tokens.push({terminal:group});
    }
    sequences[container]=tokens;
  }
  const chosen=containers.flatMap(container=>sequences[container]).filter(token=>keys.has(token.key));
  if(chosen.length!==keys.size)throw Error('Selezione non valida');
  if(!chosen.some(token=>token.break))return moveStrips(project,{boardName,sourceKeys,to});
  const targetTokens=sequences[to.container],targetIndex=positions.get(target)+to.stripIndex;
  const insertion=targetIndex-targetTokens.slice(0,targetIndex).filter(token=>keys.has(token.key)).length;
  const next=Object.fromEntries(containers.map(container=>[container,sequences[container].filter(token=>!keys.has(token.key))]));
  next[to.container].splice(insertion,0,...chosen);
  if(containers.every(container=>next[container].length===sequences[container].length&&next[container].every((token,i)=>token===sequences[container][i])))return false;
  const ordered={};
  for(const container of containers){
    const pending=[];ordered[container]=[];
    for(const token of next[container]){
      if(token.strip)pending.push(token.strip);
      else ordered[container].push({group:token.break||token.terminal,strips:pending.splice(0),boundary:!!token.break});
    }
    if(pending.length)ordered[container].push({group:{kind:container==='scheduledGroups'?'RemainingScheduledStrips':'RemainingUnscheduledStrips',attributes:{},strips:[],mmsxSegment:target.mmsxSegment},strips:pending,boundary:false});
  }
  const dayDates=board.scheduledGroups.filter(group=>group.kind==='ScheduleDay').map(group=>group.date);
  const dayNumbers=board.scheduledGroups.filter(group=>group.kind==='ScheduleDay').map(group=>group.shootingDayNumber);
  for(const container of containers){
    for(const item of ordered[container]){
      if(item.boundary){
        item.group.kind=container==='scheduledGroups'?'ScheduleDay':'UnscheduledDay';
        if(project.format==='mmsx'&&keys.has(dayBreakKey(boardName,item.group)))item.group.mmsxSegment=target.mmsxSegment;
      }
      item.group.strips=item.strips;
    }
    board[container].splice(0,board[container].length,...ordered[container].map(item=>item.group));
  }
  let ordinal=0;
  for(const group of board.scheduledGroups)if(group.kind==='ScheduleDay'){
    const index=ordinal++;
    group.ordinal=ordinal;
    group.shootingDayNumber=project.format==='mmsx'?(dayNumbers[index]??group.shootingDayNumber??ordinal):ordinal;
    group.date=dayDates[index]??group.date??dayDates.at(-1)??null;
  }
  return true;
}

export function moveDayBreak(project,{boardName,from,to}){
  const board=project.boards.find(item=>item.name===boardName);
  const group=board&&locate(board,from);
  if(!['ScheduleDay','UnscheduledDay'].includes(group?.kind))throw Error('Day break non valido');
  return moveBoardItems(project,{boardName,sourceKeys:[dayBreakKey(boardName,group)],to});
}

export function snapshotBoardOrder(board){
  return ['scheduledGroups','unscheduledGroups'].map(container=>({container,
    groups:board[container].slice(),strips:board[container].map(group=>group.strips.slice()),
    dayMeta:board[container].map(group=>({kind:group.kind,mmsxSegment:group.mmsxSegment,ordinal:group.ordinal,shootingDayNumber:group.shootingDayNumber,date:group.date}))}));
}
export function restoreBoardOrder(board,snapshot){
  for(const {container,groups,strips,dayMeta} of snapshot){
    board[container].splice(0,board[container].length,...groups);
    groups.forEach((group,index)=>{group.strips=strips[index].slice();Object.assign(group,dayMeta[index])});
  }
}

export function dragSummary(strips,scenes){
  const sceneIndex=new Map(scenes.map(scene=>[scene.bdsId,scene]));
  const count=strips.filter(strip=>strip.kind==='scene').length;
  const eighths=strips.reduce((total,strip)=>total+(strip.kind==='scene'?(sceneIndex.get(strip.bdsId)?.pagesEighths||0):0),0);
  const whole=Math.floor(eighths/8),rest=eighths%8;
  const pages=whole?`${whole}${rest?` ${rest}/8`:''}`:`${rest}/8`;
  return {count,eighths,label:`${count} ${count===1?'scena':'scene'} · ${pages} pag.`};
}

export function createStripboard(project,{name,sourceBoardName}){
  if(project.format==='mmsx')throw Error('Creazione di piani MMSX non disponibile');
  const cleanName=String(name||'').trim();
  if(!cleanName||cleanName.length>128)throw Error('Inserisci un nome per il piano (massimo 128 caratteri)');
  if(project.boards.some(board=>board.name.toLocaleLowerCase()===cleanName.toLocaleLowerCase()))throw Error('Esiste già un piano con questo nome');
  const source=project.boards.find(board=>board.name===sourceBoardName);
  if(!source)throw Error('Piano di origine non trovato');
  const board=structuredClone(source);
  const maxOrder=Math.max(-1,...project.boards.map(item=>Number(item.attributes.SortOrder)).filter(Number.isFinite));
  board.name=cleanName;board.attributes.Name=cleanName;board.attributes.SortOrder=String(maxOrder+1);
  board.sourceOrder=project.boards.length;board.identitySource='Name';
  board.description=cleanName;
  project.boards.push(board);
  project.activeBoard=cleanName;
  project.counts.stripboards=project.boards.length;
  project.counts.scheduleDays+=board.scheduledGroups.filter(group=>group.kind==='ScheduleDay').length;
  project.counts.unscheduledDays+=board.unscheduledGroups.filter(group=>group.kind==='UnscheduledDay').length;
  for(const calendar of project.calendars)for(const date of calendar.dates){
    for(const day of [...date.shootingDays])if(day.boardName===source.name){
      date.shootingDays.push({...day,boardName:cleanName});
    }
  }
  return board;
}

export function sourceContainer(position){return CONTAINERS[position.container]||null}

export function boardSignature(project){
  return JSON.stringify({activeBoard:project.activeBoard,boards:project.boards.map(board=>({
    name:board.name,sourceBoardName:board.sourceBoardName,description:board.description,attributes:board.attributes,
    scheduledGroups:board.scheduledGroups.map(group=>[group.kind,group.sourceIndex,group.attributes,group.strips.map(strip=>strip.sourceKey)]),
    unscheduledGroups:board.unscheduledGroups.map(group=>[group.kind,group.sourceIndex,group.attributes,group.strips.map(strip=>strip.sourceKey)])
  }))});
}
