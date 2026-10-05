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

export function createStripboard(project,{name,sourceBoardName}){
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
    scheduledGroups:board.scheduledGroups.map(group=>[group.kind,group.attributes,group.strips.map(strip=>strip.sourceKey)]),
    unscheduledGroups:board.unscheduledGroups.map(group=>[group.kind,group.attributes,group.strips.map(strip=>strip.sourceKey)])
  }))});
}
