import {code,uid,validate,type Data,type Rack,type Area,type Slot} from './model';
import {readSpreadsheet,type Sheet} from './materialImport';
import {RACK_KINDS} from './builderTypes';
export const kinds:Record<string,string>={palletRack:'Palettenregal',shelfRack:'Fachbodenregal',binRack:'Kastenregal',slidingRack:'Schieberegal',cabinet:'Schrank',floorSlot:'Bodenplatz'};
export const columns={
 Regale:['Beispiel','Regal-ID','Regalschlüssel','Gebäude','Regalnummer','Regalname','Regaltyp','Breite (m)','Höhe (m)','Tiefe (m)','Position X (m)','Position Z (m)','Drehung (Grad)','Hallen-ID','Farbe','Gesperrt','Schieberichtung'],
 'Bereiche und Segmente':['Beispiel','Bereich-ID','Bereichsschlüssel','Regal-ID','Regalschlüssel','Regalname','Bereich','Präfix','Segmentanzahl (Spalten)','Fächer je Segment (Ebenen)','Segmentnamen'],
 Lagerplätze:['Beispiel','Fach-ID','Regal-ID','Regalschlüssel','Bereich-ID','Bereichsschlüssel','Bereich','Segmentnummer','Segmentname','Ebene','Fachnummer','Lagerplatzcode','Belegungsstatus','Materialnummern','Materialbezeichnungen'],
} as const;
export type TableName=keyof typeof columns;
export const tables=Object.keys(columns) as TableName[];
export type TableMapping={sheet:number;header:number;fields:Record<string,number>};
export type StructureMapping=Record<TableName,TableMapping>;
const norm=(s:string)=>s.toLocaleLowerCase().replace(/[\s_()\-]/g,'');
export function autoMapping(sheets:Sheet[]):StructureMapping {
 return Object.fromEntries(tables.map(name=>{const index=sheets.findIndex(s=>norm(s.name)===norm(name));const sheet=sheets[index];return [name,{sheet:index,header:0,fields:Object.fromEntries(columns[name].map(h=>[h,sheet?.rows[0]?.findIndex(c=>norm(c.text)===norm(h)) ?? -1]))}];})) as StructureMapping;
}
export const readStructure=async(file:File)=>{if(!/\.xlsx$/i.test(file.name))throw Error('Für die Regalstruktur bitte eine .xlsx-Datei auswählen.');return readSpreadsheet(file);};
const yes=(s:string)=>['ja','yes','true','1','beispiel'].includes(s.trim().toLowerCase());
function records(sheets:Sheet[],mapping:TableMapping) {
 const sheet=sheets[mapping.sheet];if(!sheet)return [];
 return sheet.rows.slice(mapping.header+1).map((row,i)=>({line:i+mapping.header+2,values:Object.fromEntries(Object.entries(mapping.fields).map(([key,col])=>[key,row[col]?.text.trim() || '']))})).filter(r=>Object.values(r.values).some(Boolean));
}
const num=(s:string,label:string,min:number,max:number,integer=false)=>{const n=Number(s.replace(',','.'));if(!s || !Number.isFinite(n) || n<min || n>max || (integer&&!Number.isInteger(n)))throw Error(`${label}: gültiger Wert zwischen ${min} und ${max}${integer?' (ganzzahlig)':''} erforderlich.`);return n;};
function validateStructureData(data:Data){const seen=new Set<string>(),duplicates=new Set<string>();for(const r of data.racks)for(const s of r.slots){const value=code(r,s);if(seen.has(value))duplicates.add(value);seen.add(value);}if(duplicates.size)throw Error('Lagerplatzcodes müssen eindeutig sein. Doppelte Codes: '+[...duplicates].slice(0,12).join(', '));validate(data);}
export type Change={key:string;name:string;rack?:Rack;existing?:Rack;errors:string[];notes:string[];createdSlots:number;changedSlots:number;removedSlots:number;changed:boolean;lines:string[]};
export type StructurePlan={changes:Change[];errors:string[];examples:number};
export function planStructure(data:Data,sheets:Sheet[],mapping:StructureMapping):StructurePlan {
 const plan:StructurePlan={changes:[],errors:[],examples:0};
 const rs=records(sheets,mapping.Regale),areas=records(sheets,mapping['Bereiche und Segmente']),slots=records(sheets,mapping.Lagerplätze);
 const real=(rows:ReturnType<typeof records>)=>rows.filter(r=>{if(yes(r.values.Beispiel)){plan.examples++;return false;}return true;});
 const racks=real(rs),ars=real(areas),sls=real(slots);
 if(mapping.Regale.sheet<0)plan.errors.push('Tabellenblatt „Regale“ fehlt. Bitte zuordnen.');
 const allIds=new Set<string>();for(const r of data.racks){allIds.add(r.id);r.areas.forEach(a=>allIds.add(a.id));r.slots.forEach(s=>allIds.add(s.id));}data.materials.forEach(m=>allIds.add(m.id));data.stock.forEach(s=>allIds.add(s.id));data.layout?.halls.forEach(h=>allIds.add(h.id));data.layout?.objects.forEach(o=>allIds.add(o.id));
 const seen=new Set<string>();
 const duplicateIds=new Set<string>();const workbookIds=new Set<string>();
 for(const [rows,id] of [[racks,'Regal-ID'],[ars,'Bereich-ID'],[sls,'Fach-ID']] as const)for(const r of rows){const v=r.values[id];if(v){if(workbookIds.has(v))duplicateIds.add(v);workbookIds.add(v);}}
 const usedArea=new Set<number>(),usedSlots=new Set<number>();
 for(const row of racks){const v=row.values,key=v['Regalschlüssel'] || v['Regal-ID'];const c:Change={key,name:v.Regalname || '(ohne Namen)',errors:[],notes:[],createdSlots:0,changedSlots:0,removedSlots:0,changed:false,lines:[`Regale: ${row.line}`]};plan.changes.push(c);
 try{
  if(!key)throw Error('Regalschlüssel oder Regal-ID fehlt.');if(!v['Regal-ID'] && data.racks.some(r=>r.id===key))throw Error('Regalschlüssel gehört zu einem vorhandenen Regal. Interne Regal-ID beibehalten.');if(seen.has(key))throw Error('Doppelter Regalschlüssel: '+key);seen.add(key);
  const id=v['Regal-ID'] || uid();if(duplicateIds.has(id))throw Error('Doppelte interne ID: '+id);
  const old=data.racks.find(r=>r.id===id);c.existing=old;
  if(!old && allIds.has(id))throw Error('Regal-ID gehört zu einem anderen Objekt.');
  for(const field of ['Gebäude','Regalnummer','Regalname','Regaltyp'])if(!v[field])throw Error(`Pflichtangabe „${field}“ fehlt.`);
  const kind=RACK_KINDS.find(k=>k===v.Regaltyp || norm(kinds[k])===norm(v.Regaltyp));if(!kind)throw Error('Unbekannter Regaltyp: '+v.Regaltyp);
  const hallId=v['Hallen-ID'] || old?.hallId; if(hallId && !data.layout?.halls.some(h=>h.id===hallId && h.building===v.Gebäude))throw Error('Hallen-ID passt nicht zu einem Gebäude im aktuellen Lager.');
  const r:Rack={...(old || {}),id,name:v.Regalname,number:v.Regalnummer,building:v.Gebäude,kind:old && !old.kind && kind==='shelfRack'?undefined:kind,width:num(v['Breite (m)'],'Breite',.1,100),height:num(v['Höhe (m)'],'Höhe',.1,100),depth:num(v['Tiefe (m)'],'Tiefe',.1,100),x:num(v['Position X (m)'],'Position X',-1000,1000),z:num(v['Position Z (m)'],'Position Z',-1000,1000),rotation:num(v['Drehung (Grad)'],'Drehung',-1000,1000),areas:structuredClone(old?.areas || []),slots:structuredClone(old?.slots || [])};
  if(hallId)r.hallId=hallId;else {delete r.hallId;const hall=!old?data.layout?.halls.find(h=>h.building===r.building):undefined;if(hall)r.hallId=hall.id;}
  if(v.Farbe)r.color=v.Farbe;if(v.Gesperrt)r.locked=yes(v.Gesperrt);if(v.Schieberichtung){if(!['x','z'].includes(v.Schieberichtung))throw Error('Schieberichtung muss x oder z sein.');r.slidingDirection=v.Schieberichtung as 'x'|'z';}
  const areaKeys=new Map<string,string>();r.areas.forEach(a=>areaKeys.set(a.id,a.id));const usedAreaKeys=new Set<string>();
  for(const ar of ars){const a=ar.values;if(!((a['Regal-ID'] && a['Regal-ID']===id)||(a['Regalschlüssel'] && a['Regalschlüssel']===key)))continue;usedArea.add(ar.line);c.lines.push(`Bereiche und Segmente: ${ar.line}`);
   if(a['Regal-ID'] && a['Regal-ID']!==id || a['Regalschlüssel'] && a['Regalschlüssel']!==key)throw Error(`Bereiche Zeile ${ar.line}: widersprüchliche Regalverweise.`);
   const areaKey=a['Bereichsschlüssel'] || a['Bereich-ID'];if(!areaKey || usedAreaKeys.has(areaKey))throw Error(`Bereiche Zeile ${ar.line}: fehlender oder doppelter Bereichsschlüssel.`);usedAreaKeys.add(areaKey);
   const aid=a['Bereich-ID'] || uid(),prev=r.areas.find(b=>b.id===aid);if([areaKey,aid].some(alias=>areaKeys.has(alias) && areaKeys.get(alias)!==aid))throw Error(`Bereiche Zeile ${ar.line}: Bereichsschlüssel ist bereits belegt. Interne Bereich-ID beibehalten.`);if(duplicateIds.has(aid) || (!prev && allIds.has(aid)))throw Error(`Bereiche Zeile ${ar.line}: doppelte oder fremde ID.`);
   if(!a.Bereich || !a.Präfix)throw Error(`Bereiche Zeile ${ar.line}: Bereich und Präfix sind Pflicht.`);
   const next:Area={...(prev || {}),id:aid,name:a.Bereich,prefix:a.Präfix,columns:num(a['Segmentanzahl (Spalten)'],'Spalten',1,20,true),levels:num(a['Fächer je Segment (Ebenen)'],'Ebenen',1,20,true)};
   if(a.Segmentnamen){next.segmentNames=a.Segmentnamen.split('|').map(s=>s.trim());if(next.segmentNames.length!==next.columns || next.segmentNames.some(s=>!s))throw Error(`Bereiche Zeile ${ar.line}: genau ein Segmentname pro Spalte, getrennt mit |, erforderlich.`);}else if(next.segmentNames && next.segmentNames.length!==next.columns)delete next.segmentNames;
   if(prev)r.areas[r.areas.findIndex(b=>b.id===aid)]=next;else r.areas.push(next);areaKeys.set(areaKey,aid);areaKeys.set(aid,aid);
  }
  if(!r.areas.length)throw Error('Mindestens ein Bereich ist erforderlich.');
  const invalid=r.slots.filter(s=>{const a=r.areas.find(a=>a.id===s.areaId);return !a || s.number>a.columns*a.levels;});
  if(invalid.some(s=>data.stock.some(b=>b.slotId===s.id)||data.materials.some(m=>m.assignedSlotIds?.includes(s.id))))throw Error('Verkleinerung würde belegte oder zugeordnete Fächer entfernen. Zuerst umlagern/Zuordnung aufheben.');
  r.slots=r.slots.filter(s=>!invalid.includes(s));c.removedSlots=invalid.length;
  const explicit=new Set<string>();
  for(const sr of sls){const s=sr.values;if(!((s['Regal-ID'] && s['Regal-ID']===id)||(s['Regalschlüssel'] && s['Regalschlüssel']===key)))continue;usedSlots.add(sr.line);c.lines.push(`Lagerplätze: ${sr.line}`);
   if(s['Regal-ID'] && s['Regal-ID']!==id || s['Regalschlüssel'] && s['Regalschlüssel']!==key)throw Error(`Lagerplätze Zeile ${sr.line}: widersprüchliche Regalverweise.`);
   const areaId=areaKeys.get(s['Bereich-ID'] || s['Bereichsschlüssel']);const a=r.areas.find(a=>a.id===areaId);if(!a || s['Bereich-ID'] && s['Bereichsschlüssel'] && areaKeys.get(s['Bereichsschlüssel'])!==areaId)throw Error(`Lagerplätze Zeile ${sr.line}: Bereich nicht eindeutig zugeordnet.`);
   const number=num(s.Fachnummer,'Fachnummer',1,a.columns*a.levels,true);const pos=areaId+':'+number;if(explicit.has(pos))throw Error(`Lagerplätze Zeile ${sr.line}: doppelte Fachposition.`);explicit.add(pos);
   const sid=s['Fach-ID'] || uid(),prev=old?.slots.find(b=>b.id===sid);if(duplicateIds.has(sid) || (!prev && allIds.has(sid)))throw Error(`Lagerplätze Zeile ${sr.line}: doppelte oder fremde Fach-ID.`);
   if(old?.slots.some(b=>b.id===sid) && invalid.some(b=>b.id===sid))throw Error(`Lagerplätze Zeile ${sr.line}: Fach passt nicht zur verkleinerten Anordnung.`);
   const at=r.slots.find(b=>b.areaId===areaId && b.number===number && b.id!==sid);if(at)throw Error(`Lagerplätze Zeile ${sr.line}: Position existiert bereits. Interne Fach-ID beibehalten.`);
   const next:Slot={...(prev || {}),id:sid,areaId:a.id,number};
   // Exported generated codes remain generated; explicit edited codes become overrides.
   const oldRack=old;const displayed=s.Lagerplatzcode;
   if(displayed && !(prev && oldRack && !prev.name && displayed===code(oldRack,prev)))next.name=displayed;
   if(prev){const index=r.slots.findIndex(b=>b.id===sid);if(index>=0)r.slots[index]=next;else r.slots.push(next);}else r.slots.push(next);
  }
  for(const a of r.areas)for(let n=1;n<=a.columns*a.levels;n++)if(!r.slots.some(s=>s.areaId===a.id && s.number===n)){const previous=old?.areas.find(v=>v.id===a.id);if(!previous || n>previous.columns*previous.levels)r.slots.push({id:uid(),areaId:a.id,number:n});}
  // Locked existing racks cannot be changed through a spreadsheet.
  const normal=(r:Rack)=>JSON.stringify({...r,areas:[...r.areas],slots:[...r.slots].sort((a,b)=>a.id.localeCompare(b.id))});
  c.changed=!old || normal(r)!==normal(old);if(old?.locked && c.changed)throw Error('Regal ist gesperrt. Zuerst im Baumodus entsperren.');
  const oldSlots=new Map(old?.slots.map(s=>[s.id,s]) || []);c.createdSlots=r.slots.filter(s=>!oldSlots.has(s.id)).length;c.changedSlots=r.slots.filter(s=>{const prev=oldSlots.get(s.id);return prev && (JSON.stringify(s)!==JSON.stringify(prev)||code(r,s)!==code(old!,prev));}).length;
  c.rack=r;c.notes.push(`${r.areas.length} Bereiche; ${r.slots.length} Fächer`,...r.areas.map(a=>`${a.name}: ${a.columns} Segmente × ${a.levels} Fächer`));
  const candidate={...data,racks:old?data.racks.map(v=>v.id===id?r:v):[...data.racks,r]};validateStructureData(candidate);
 }catch(e){c.errors.push((e as Error).message);}}
 for(const r of ars)if(!usedArea.has(r.line) && !racks.some(v=>r.values['Regal-ID'] && r.values['Regal-ID']===v.values['Regal-ID'] || r.values['Regalschlüssel'] && r.values['Regalschlüssel']===(v.values['Regalschlüssel'] || v.values['Regal-ID'])))plan.errors.push(`Bereiche und Segmente Zeile ${r.line}: Regalverweis fehlt oder ist unklar.`);
 for(const r of sls)if(!usedSlots.has(r.line) && !racks.some(v=>r.values['Regal-ID'] && r.values['Regal-ID']===v.values['Regal-ID'] || r.values['Regalschlüssel'] && r.values['Regalschlüssel']===(v.values['Regalschlüssel'] || v.values['Regal-ID'])))plan.errors.push(`Lagerplätze Zeile ${r.line}: Regalverweis fehlt oder ist unklar.`);
 // Duplicate local keys must invalidate every related candidate, not only the later row.
 for(const c of plan.changes)if(plan.changes.filter(v=>v.key===c.key).length>1 && !c.errors.includes('Doppelter Regalschlüssel.'))c.errors.push('Doppelter Regalschlüssel.');
 return plan;
}
export function applyStructure(data:Data,plan:StructurePlan,selected:string[]) {
 if(plan.errors.length)throw Error('Ungeklärte Zeilenverweise: Bitte zuerst die Datei korrigieren.');
 const choices=plan.changes.filter(c=>selected.includes(c.key));if(choices.some(c=>c.errors.length || !c.rack))throw Error('Auswahl enthält fehlerhafte Änderungen.');
 const next=structuredClone(data);for(const c of choices){const r=structuredClone(c.rack!);const index=next.racks.findIndex(v=>v.id===r.id);if(index<0)next.racks.push(r);else next.racks[index]=r;}
 validateStructureData(next);return {data:next,result:{createdRacks:choices.filter(c=>!c.existing).length,changedRacks:choices.filter(c=>c.existing&&c.changed).length,unchangedRacks:choices.filter(c=>c.existing&&!c.changed).length,createdSlots:choices.reduce((n,c)=>n+c.createdSlots,0),changedSlots:choices.reduce((n,c)=>n+c.changedSlots,0),removedSlots:choices.reduce((n,c)=>n+c.removedSlots,0),skipped:plan.changes.filter(c=>!selected.includes(c.key)).map(c=>({name:c.name,lines:c.lines,errors:c.errors}))}};
}
export async function createStructureWorkbook(data:Data,warehouse:string,template=false,checklist=false) {
 const {Workbook}=await import('exceljs');const book=new Workbook();book.creator='Lagerraum';if(checklist){const {addChecklistSheets}=await import('./checklistExport');addChecklistSheets(book,data);}
 const add=(name:string,headers:readonly string[])=>{const s=book.addWorksheet(name);s.addRow([...headers]);s.views=[{state:'frozen',ySplit:1}];s.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};s.columns=headers.map(h=>({width:Math.min(45,Math.max(18,h.length+3)),style:{numFmt:'@'}}));s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF294454'}};return s;};
 const rSheet=add('Regale',columns.Regale),aSheet=add('Bereiche und Segmente',columns['Bereiche und Segmente']),sSheet=add('Lagerplätze',columns.Lagerplätze);
 let racks=data.racks;
 if(template){racks=[['NEU-P','Palettenregal','palletRack',1],['NEU-S','Schieberegal','slidingRack',3]].map(([key,name,kind,count],i)=>{const areas=Array.from({length:Number(count)},(_,j)=>({id:`${key}-${j}`,name:['Vorne','Mitte','Hinten'][j],prefix:['V','M','H'][j],columns:2,levels:j===2?10:7}));return {id:String(key),name:String(name)+' · BEISPIEL',number:String(90+i),building:'BEISPIEL',kind:kind as Rack['kind'],width:4,height:3,depth:Number(count),x:i*6,z:0,rotation:0,areas,slots:areas.flatMap(a=>Array.from({length:a.columns*a.levels},(_,n)=>({id:'',areaId:a.id,number:n+1})))};});}
 for(const r of racks){rSheet.addRow([template?'JA':'',template?'':r.id,r.id,r.building,r.number,r.name,kinds[r.kind || 'shelfRack'],r.width,r.height,r.depth,r.x,r.z,r.rotation,r.hallId || '',r.color || '',r.locked===undefined?'':r.locked?'JA':'NEIN',r.slidingDirection || '']);
  for(const a of r.areas)aSheet.addRow([template?'JA':'',template?'':a.id,a.id,template?'':r.id,r.id,r.name,a.name,a.prefix,a.columns,a.levels,a.segmentNames?.join('|') || '']);
  for(const s of r.slots){const a=r.areas.find(a=>a.id===s.areaId)!;const mats=data.materials.filter(m=>data.stock.some(b=>b.slotId===s.id&&b.materialId===m.id)||m.assignedSlotIds?.includes(s.id));const segment=(s.number-1)%a.columns+1;sSheet.addRow([template?'JA':'',template?'':s.id,template?'':r.id,r.id,template?'':a.id,a.id,a.name,segment,a.segmentNames?.[segment-1] || `Segment ${segment}`,Math.floor((s.number-1)/a.columns)+1,s.number,template?'':code(r,s),mats.length?'Zugeordnet / belegt':'Frei',mats.map(m=>m.number).join('\n'),mats.map(m=>m.name).join('\n')]);}
 }
 const help=book.addWorksheet('Anleitung');[
 ['Lagerraum – Regalstruktur',warehouse],['Dateityp','Lagerraum-Struktur v1'],['Bearbeiten','Regalname, Gebäude, Nummer, Typ, Maße (m), Position X/Z, Drehung (Grad); Bereiche, Präfixe, Spalten/Ebenen und Fachcodes. IDs unverändert lassen.'],['Neue Regale','Regal-ID leer lassen; eigenen eindeutigen Regalschlüssel vergeben. In Bereichen und Fächern denselben Regalschlüssel verwenden.'],['Neue Bereiche','Bereich-ID leer lassen; eigenen Bereichsschlüssel vergeben und in Lagerplätzen verwenden. Mindestens einen Bereich pro neuem Regal anlegen.'],['Segmente','Segment = senkrechte Spalte. Anzahl = Spalten, Fächer je Segment = Ebenen. Optionale Segmentnamen mit | trennen. Vorne/Mitte/Hinten liegen hintereinander in der Tiefe.'],['Neue Fächer','Werden aus Spalten × Ebenen erzeugt. Lagerplätze-Blatt ist optional für neue Regale. Für einzelne Codes Zeilen mit leerer Fach-ID und Bereichsschlüssel ergänzen.'],['Fachnummer','Zeilenweise von unten: (Ebene − 1) × Spalten + Segmentnummer. Fachnummer ist maßgeblich; Segmentnummer/Ebene sind Übersicht.'],['Beispiele','ALLE Beispielzeilen tragen JA in Beispiel. Sie werden immer übersprungen. Für eigene Daten JA in allen zugehörigen Zeilen entfernen und Beispielwerte ersetzen.'],['Erhalt','Fehlende Zeilen löschen nichts. Nur eine ausdrücklich kleinere Spalten-/Ebenenzahl kann unbesetzte Randfächer entfernen. Belegte/zugeordnete Fächer sind geschützt.'],['Übersicht','Materialnummern, Materialbezeichnungen, Belegungsstatus, Regalname/Bereich/Segmentname in Verweisblättern sind Übersicht und ändern keine Materialien oder Bestände.'],['Lagerplan','Hallen und Bauteile sind zusätzliche unveränderte JSON-Snapshots zur Übersicht. Dieser Import bearbeitet nur Regale/Bereiche/Fächer; vollständige Wiederherstellung über JSON-Gesamtsicherung.'],['Bestätigung','Datei hochladen, Zuordnung und Vorschau prüfen, Regale auswählen, Import bestätigen. Doppelte IDs/Codes oder unklare Verweise werden nicht geraten.'],['Kontrollliste','Bei kombinierten Exporten: ein lesbares Blatt je Regal und Noch kein Lagerplatz. Prüfstatus/Bemerkung über Kontrollliste importieren übernehmen; neue Plätze erfordern eine ausdrückliche Zuordnungsentscheidung. Kontrollzuordnung enthält technische Verweise, Nr.-Werte nicht doppelt vergeben.'],['Grenzen','Gleichmäßiges Raster pro Bereich: höchstens 20 Spalten und 20 Ebenen. Unterschiedliche Raster zwischen Vorne/Mitte/Hinten möglich.'],
 ].forEach(r=>help.addRow(r));help.columns=[{width:28},{width:115}];help.eachRow(r=>{r.alignment={wrapText:true,vertical:'top'};r.height=45;});
 const layout=book.addWorksheet('Lagerplan');layout.addRow(['Objekttyp','ID','Daten (nur Übersicht; JSON-Snapshot)']);if(!template){for(const h of data.layout?.halls || [])layout.addRow(['Halle',h.id,JSON.stringify(h)]);for(const o of data.layout?.objects || [])layout.addRow(['Bauteil',o.id,JSON.stringify(o)]);}layout.columns=[{width:18},{width:40},{width:120}];
 return book;
}
export async function downloadStructure(data:Data,name:string,template=false,checklist=false){const book=await createStructureWorkbook(data,name,template,checklist);const bytes=await book.xlsx.writeBuffer();const blob=new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=checklist?'Lagerraum-Kontrollliste.xlsx':template?'Lagerraum-Regalvorlage.xlsx':`Lagerraum-Struktur-${name.replace(/[^\p{L}\p{N}-]/gu,'_')}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
