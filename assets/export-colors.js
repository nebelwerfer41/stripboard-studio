import {stripColorSettings,colorIndex} from './strip-colors.js';
import {palette as mmsxPalette} from './mmsx-palette.js';
// MMS6 has 32 editable palette slots; grid cells store RGB independently.
export const msdPalette=['#FFFFFF','#FFFF66','#33FF33','#FF0000','#FF9999','#4600A5','#0000D4','#0B0BBD','#45877A','#80CD80','#562C05','#90713A','#C0C0C0','#808080','#404040','#000000','#FFFFFF','#DDDD61','#FFC800','#D13131','#F20884','#4600A5','#4949BB','#02ABEA','#009900','#35A135','#6B4725','#90713A','#C0C0C0','#808080','#1A1818','#000000'];
export function exportColorSettings(p){const settings=stripColorSettings(p);if(!settings.palette?.length)settings.palette=[...msdPalette];if(settings.preferences.Hilite&&!p.colors?.preferences?.Selected)settings.preferences.Selected=settings.preferences.Hilite;return settings}
export function sceneExportColors(p,s,settings=exportColorSettings(p)){
 if(!p.colors?.combinationEditing&&s.mmsxColors)return s.mmsxColors;
 return settings.cells[`${colorIndex(settings.rows,s.dn)}:${colorIndex(settings.columns,s.ie)}`];
}
export function nativeMmsxColor(hex){const exact=Object.keys(mmsxPalette).find(key=>mmsxPalette[key].toUpperCase()===String(hex).toUpperCase());if(exact)return exact;
 // All RGB values are retained in Studio. Unknown native custom-color encoding is not guessed.
 const rgb=value=>[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));const input=rgb(hex||'#FFFFFF');let best='color14',distance=Infinity;for(const [key,value] of Object.entries(mmsxPalette)){const d=rgb(value).reduce((n,x,i)=>n+(x-input[i])**2,0);if(d<distance){distance=d;best=key}}return best;
}
export function nativeMsdDayNight(p,s,settings=exportColorSettings(p)){if(!s.dn)return '';const index=colorIndex(settings.rows,s.dn),label=settings.rows[index];return index!=='11'&&label?label:s.dn}
export function rgbText(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')}
export function mmsxColors(root,p){
 const c=root.contents,settings=exportColorSettings(p);
 const category=code=>Object.keys(c.category).find(id=>c.category[id].code===code);
 const element=(name,code)=>{const cat=category(code);let id=Object.keys(c.element).find(id=>c.element[id].category_id===cat&&colorIndex({'0':name,'11':'Other'},c.element[id].name)==='0');if(!id){id=`palette:${code}:${name}`;c.element[id]={id,name,category_id:cat,boardId:'',sortOrder:0,lockId:false,allowHoldDays:false,allowDrop:false,minDropDays:0,exclude:false,properties:{},linkedMap:{},notes:''}}return id};
 const ie=new Map(),dn=new Map();for(const [i,name] of Object.entries(settings.columns))if(name&&i!=='11')ie.set(i,element(name,'intExt'));for(const [i,name] of Object.entries(settings.rows))if(name&&i!=='11')dn.set(i,element(name,'dayNight'));
 if(!p.colors?.combinationEditing)for(const r of p.colors?.nativeRules||[])if(c.element[r.intExt]&&c.element[r.dayNight])c.rules[r.id]={id:r.id,intExt:r.intExt,dayNight:r.dayNight,color:nativeMmsxColor(r.fg),backgroundColor:nativeMmsxColor(r.bg)};
 for(const [row,dayNight] of dn)for(const [col,intExt] of ie){const value=settings.cells[`${row}:${col}`];const id=Object.keys(c.rules).find(id=>c.rules[id].intExt===intExt&&c.rules[id].dayNight===dayNight)||`rule:${row}:${col}`;c.rules[id]={id,intExt,dayNight,color:nativeMmsxColor(value.fg),backgroundColor:nativeMmsxColor(value.bg)}}
 const scenes=new Map(p.scenes.map(s=>[s.bdsId,s]));for(const b of Object.values(c.breakdown))for(const [id,s] of Object.entries(b.sheetMap)){const original=scenes.get(id);if(!original)continue;const value=sceneExportColors(p,original,settings);s.color=nativeMmsxColor(value.fg);s.backgroundColor=nativeMmsxColor(value.bg)}
}

export function msdColorConflicts(p){const settings=exportColorSettings(p);return p.scenes.filter(s=>{const stored=sceneExportColors(p,s,settings),cell=settings.cells[`${colorIndex(settings.rows,s.dn)}:${colorIndex(settings.columns,s.ie)}`];return stored.bg.toUpperCase()!==cell.bg.toUpperCase()||stored.fg.toUpperCase()!==cell.fg.toUpperCase()})}
// Project-owned projection of native MMSX rules, including combinations not used by any scene.
export function readMmsxColorSettings(contents){
 const prefs={Banner:{bg:'#663301',fg:'#FFFFFF'},DayStrip:{bg:'#333333',fg:'#FFFFFF'}};
 const settings=stripColorSettings({colors:{preferences:prefs},scenes:[]});
 const rules=Object.entries(contents.rules||{}),name=id=>contents.element[id]?.name;
 const columns=[...new Set(rules.map(([,r])=>name(r.intExt)).filter(Boolean))],rows=[...new Set(rules.map(([,r])=>name(r.dayNight)).filter(Boolean))];
 if(columns.length)settings.columns=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i),i===11?'Other':columns[i]||'']));
 if(rows.length)settings.rows=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i),i===11?'Other':rows[i]||'']));
 settings.nativeRules=[];
 for(const [id,r] of rules){const fg=mmsxPalette[r.color]||(/^#[0-9a-f]{6}$/i.test(r.color||'')?r.color:null),bg=mmsxPalette[r.backgroundColor]||(/^#[0-9a-f]{6}$/i.test(r.backgroundColor||'')?r.backgroundColor:null);if(!fg||!bg)continue;settings.nativeRules.push({id,intExt:r.intExt,dayNight:r.dayNight,fg,bg});
  const col=Object.keys(settings.columns).find(i=>settings.columns[i]===name(r.intExt)),row=Object.keys(settings.rows).find(i=>settings.rows[i]===name(r.dayNight));if(col!==undefined&&row!==undefined)settings.cells[`${row}:${col}`]={fg,bg};
 }
 return settings;
}
