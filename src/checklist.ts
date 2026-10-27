import {code,uid,validate,type Data,type CheckEntry,type Rack} from './model';
import type {Sheet} from './materialImport';
export const fields={nr:'Nr.',number:'Materialnummer',name:'Materialbezeichnung',old:'Alter Lagerplatz',next:'Neuer Lagerplatz',status:'Geprüft',note:'Bemerkung'};
export type CheckMapping={enabled:boolean;header:number;fields:Record<keyof typeof fields,number>};
export type CheckMappings=Record<string,CheckMapping>;
const norm=(v:string)=>v.toLowerCase().replace(/[\s.()_\-]/g,'');
const aliases:Record<keyof typeof fields,string[]>={nr:['nr','nummer','lfdnr'],number:['materialnummer','material','materialnr','artikelnummer'],name:['materialbezeichnung','materialkurztext','bezeichnung'],old:['alterlagerplatz','altlagerplatz','alterplatz','platz'],next:['neuerlagerplatz','neuerplatz','ziellagerplatz'],status:['geprüft','geprueft','prüfstatus','status'],note:['bemerkung','bemerkungen','kommentar']};
export function headerFields(sheet:Sheet,row:number){const headers=sheet.rows[row]?.map(c=>norm(c.text)) || [];return Object.fromEntries(Object.entries(aliases).map(([k,names])=>[k,headers.findIndex(h=>names.includes(h))])) as CheckMapping['fields'];}
export function detectCheckMappings(sheets:Sheet[]):CheckMappings{return Object.fromEntries(sheets.map(s=>{const header=s.rows.findIndex((_,i)=>{const f=headerFields(s,i);return f.number>=0&&f.next>=0&&Object.values(f).filter(i=>i>=0).length>=3;});return [s.name,{enabled:header>=0,header:Math.max(0,header),fields:headerFields(s,Math.max(0,header))}];}));}
export type CheckRow={id:string;sheet:string;line:number;nr:string;number:string;name:string;old:string;next:string;status:string;note:string;issue:string;error:string;recordId?:string;rackId?:string;slotId?:string;materialId?:string;newMaterialId:string;newSlotId:string;sourceKey:string};
export type CheckChoice={include:boolean;assign:boolean;occupied:boolean;createRack:string;createArea:string;number:string;reviewed:boolean;primaryName:string};
export const defaultCheckChoice=(r:CheckRow):CheckChoice=>({include:true,assign:false,occupied:false,createRack:'',createArea:'',number:r.number,reviewed:false,primaryName:''});
export function parseCheckRows(sheets:Sheet[],mappings:CheckMappings):CheckRow[]{
 const refs=new Map<string,string[][]>();const meta=sheets.find(s=>s.name==='Kontrollzuordnung');if(meta){for(const r of meta.rows.slice(1)){const a=r.map(c=>c.text);const key=a[0]+'\0'+a[1];refs.set(key,[...(refs.get(key)||[]),a]);}}
 const result:CheckRow[]=[];for(const s of sheets){const m=mappings[s.name];if(!m?.enabled)continue;const seen=new Set<string>();
  for(let i=m.header+1;i<s.rows.length;i++){const cells=s.rows[i];const text=(key:keyof typeof fields)=>cells[m.fields[key]]?.text || '';const nr=text('nr');if(!['number','name','old','next','status','note'].some(k=>text(k as keyof typeof fields)))continue;
   const link=nr?refs.get(s.name+'\0'+nr):undefined;const ref=link?.length===1?link[0]:undefined;let error=link && link.length>1?'Mehrdeutige technische Zuordnung für diese Nr.':'';
   if(nr&&seen.has(nr))error='Doppelte Nr. im Tabellenblatt. Technische Zuordnung ist nicht eindeutig.';if(nr)seen.add(nr);
   const row:CheckRow={id:uid(),sheet:s.name,line:i+1,nr,number:text('number'),name:text('name'),old:text('old'),next:text('next').trim(),status:text('status'),note:text('note'),issue:cells[m.fields.number]?.issue || '',error,newMaterialId:uid(),newSlotId:uid(),sourceKey:s.name+'\0'+(nr || 'Zeile '+(i+1))};
   if(ref){row.recordId=ref[2]||undefined;row.rackId=ref[3]||undefined;row.slotId=ref[4]||undefined;row.materialId=ref[5]||undefined;}result.push(row);
  }
 }
 for(const r of result)if(r.recordId&&result.filter(v=>v.recordId===r.recordId).length>1)r.error='Doppelte Kontroll-ID. Zuordnung muss geprüft werden.';
 for(const r of result)if(r.nr&&result.filter(v=>v.sheet===r.sheet&&v.nr===r.nr).length>1)r.error='Doppelte Nr. im Tabellenblatt. Technische Zuordnung ist nicht eindeutig.';
 return result;
}
export const matchingSlots=(data:Data,value:string)=>data.racks.flatMap(r=>r.slots.filter(s=>code(r,s)===value).map(s=>({rack:r,slot:s})));
export function inspectCheckRow(data:Data,r:CheckRow,c:CheckChoice){const matches=r.next?matchingSlots(data,r.next):[];const material=data.materials.find(m=>m.number===c.number);const existing=matches.length===1?matches[0]:undefined;const occupants=existing?data.materials.filter(m=>m.id!==material?.id&&(m.assignedSlotIds?.includes(existing.slot.id)||data.stock.some(b=>b.materialId===m.id&&b.slotId===existing.slot.id))):[];const check=(data.checklist || []).find(e=>r.recordId&&e.id===r.recordId)||(data.checklist || []).find(e=>e.sourceKey===r.sourceKey&&e.materialId===material?.id);return {check,matches,material,existing,occupants,associated:!!(material&&existing&&(material.assignedSlotIds?.includes(existing.slot.id)||data.stock.some(b=>b.materialId===material.id&&b.slotId===existing.slot.id)))};}
export type CheckApplyResult={materialsCreated:number;assignmentsAdded:number;slotsCreated:number;checksChanged:number;unchanged:number;proposals:number;skipped:{sheet:string;line:number;reason:string}[]};
export function applyChecklist(data:Data,rows:CheckRow[],choices:Record<string,CheckChoice>){
 const next=structuredClone(data);const result:CheckApplyResult={materialsCreated:0,assignmentsAdded:0,slotsCreated:0,checksChanged:0,unchanged:0,proposals:0,skipped:[]};const errors:{id:string;message:string}[]=[];const allIds=()=>new Set([...next.racks.flatMap(r=>[r.id,...r.areas.map(a=>a.id),...r.slots.map(s=>s.id)]),...next.materials.map(m=>m.id),...next.stock.map(b=>b.id),...(next.checklist || []).map(e=>e.id),...(next.layout?.halls.map(h=>h.id)||[]),...(next.layout?.objects.map(o=>o.id)||[])]);
 for(const row of rows){const c=choices[row.id]||defaultCheckChoice(row);if(!c.include){result.skipped.push({sheet:row.sheet,line:row.line,reason:'Ausgeschlossen'});continue;}
  // A row is applied to its own draft, so an error cannot leave a partial row behind.
  const before=structuredClone(next),beforeResult={...result};try{
   if(row.error)throw Error(row.error);if(row.issue&&!c.reviewed)throw Error('Materialnummer als Text prüfen und bestätigen.');
   if(c.number.trim()&&!row.name.trim()&&!next.materials.some(m=>m.number===c.number))throw Error('Materialbezeichnung für neues Material fehlt.');
   if(!c.number.trim()&&row.name.trim())throw Error('Materialnummer fehlt.');
   let m=c.number.trim()?next.materials.find(m=>m.number===c.number):undefined;
   const linked=next.materials.find(m=>m.id===row.materialId);if(linked&&linked.number!==c.number)throw Error('Materialnummer widerspricht der internen Material-ID. Nicht automatisch zugeordnet.');
   if(!m&&c.number.trim()){const names=[...new Set(rows.filter(v=>{const other=choices[v.id]||defaultCheckChoice(v);return other.include&&other.number===c.number;}).map(v=>v.name).filter(v=>v.trim()))];if(names.length>1&&!names.includes(c.primaryName))throw Error('Mehrere Bezeichnungen: Hauptbezeichnung ausdrücklich auswählen.');const id=row.materialId||row.newMaterialId;if(allIds().has(id))throw Error('Material-ID ist bereits anderweitig vergeben.');m={id,number:c.number,name:c.primaryName || row.name,description:''};next.materials.push(m);result.materialsCreated++;}
   if(m){if(row.name.trim()&&row.name!==m.name&&!m.alternativeNames?.includes(row.name))m.alternativeNames=[...(m.alternativeNames || []),row.name];const old=row.old.split(/\r?\n/).filter(v=>v.trim());if(old.some(v=>!m!.oldLocations?.includes(v)))m.oldLocations=[...new Set([...(m.oldLocations || []),...old])];}
   let hits=row.next?matchingSlots(next,row.next):[];if(hits.length>1)throw Error('Neuer Lagerplatz ist mehrdeutig.');
   const requestedCreate=!!c.createRack;
   if(requestedCreate){if(!row.next)throw Error('Für ein neues Fach ist ein Lagerplatzcode erforderlich.');if(!c.assign)throw Error('Anlegen des Fachs und Zuordnung ausdrücklich bestätigen.');const r=next.racks.find(r=>r.id===c.createRack);if(!r||r.locked)throw Error('Zielregal fehlt oder ist gesperrt.');const area=r.areas.find(a=>a.id===c.createArea);if(!area)throw Error('Zielbereich für das neue Fach auswählen.');
    if(hits.length&&!(hits[0].rack.id===r.id&&rows.some(v=>v.newSlotId===hits[0].slot.id)))throw Error('Code existiert bereits. Vorhandenes Fach bestätigen statt erneut anzulegen.');
    if(!hits.length){let n=1;while(n<=area.columns*area.levels&&r.slots.some(s=>s.areaId===area.id&&s.number===n))n++;if(n>area.columns*area.levels){if(area.levels>=20)throw Error('Bereich ist voll (maximal 20 Ebenen).');area.levels++;}if(allIds().has(row.newSlotId))throw Error('Neue Fach-ID ist bereits vergeben.');const slot={id:row.newSlotId,areaId:area.id,number:n,name:row.next};r.slots.push(slot);hits=[{rack:r,slot}];result.slotsCreated++;}
   }
   const hit=hits[0];const associated=!!(m&&hit&&(m.assignedSlotIds?.includes(hit.slot.id)||next.stock.some(b=>b.materialId===m!.id&&b.slotId===hit.slot.id)));
   if(c.assign){if(!row.next||!hit)throw Error('Neuer Platz existiert nicht. Vorschlag speichern oder Zielregal und Bereich zum Anlegen auswählen.');const other=next.materials.filter(v=>v.id!==m?.id&&(v.assignedSlotIds?.includes(hit.slot.id)||next.stock.some(b=>b.materialId===v.id&&b.slotId===hit.slot.id)));if(other.length&&!c.occupied)throw Error('Fach ist bereits belegt. Zusätzliche Zuordnung separat bestätigen.');if(m&&!associated){m.assignedSlotIds=[...new Set([...(m.assignedSlotIds || []),hit.slot.id])];result.assignmentsAdded++;}}
   const confirmed=!!hit&&(!m||c.assign||associated);
   if(!m&&!confirmed&&(row.old||row.status||row.note||row.next))throw Error('Zeile ohne Materialnummer benötigt ein eindeutig vorhandenes oder ausdrücklich angelegtes leeres Fach.');
   if(m&&row.next&&!confirmed){if(!m.pendingLocations?.includes(row.next))m.pendingLocations=[...(m.pendingLocations || []),row.next];result.proposals++;}
   if(m&&confirmed&&m.pendingLocations?.includes(row.next))m.pendingLocations=m.pendingLocations.filter(v=>v!==row.next);
   if(row.rackId&&!next.racks.some(r=>r.id===row.rackId))throw Error('Regal-ID ist im ausgewählten Lager nicht vorhanden. Struktur zuerst in der Vorschau auswählen.');
   const slotId=confirmed?hit?.slot.id:undefined;const rackId=confirmed?hit?.rack.id:row.rackId;
   const previous=(next.checklist || []).find(e=>row.recordId&&e.id===row.recordId) || (next.checklist || []).find(e=>e.sourceKey===row.sourceKey&&e.materialId===m?.id);
   if(previous&&previous.materialId!==m?.id)throw Error('Kontroll-ID gehört zu einem anderen Material.');
   const needsEntry=previous||row.old||row.status||row.note||m&&row.next&&!confirmed;
   if(needsEntry){const id=previous?.id||row.recordId||row.id;if(!previous&&allIds().has(id))throw Error('Kontroll-ID ist bereits anderweitig vergeben.');const entry:CheckEntry={id,materialName:row.name || m?.name || '',...(m?{materialId:m.id}:{}),...(slotId?{slotId}:{}),...(rackId?{rackId}:{}),oldLocation:row.old,proposedLocation:row.next,status:row.status,note:row.note,sourceKey:previous?.sourceKey || row.sourceKey};
    if(JSON.stringify(previous)!==JSON.stringify(entry)){next.checklist=next.checklist || [];const i=next.checklist.findIndex(e=>e.id===id);if(i<0)next.checklist.push(entry);else next.checklist[i]=entry;result.checksChanged++;}else result.unchanged++;
   }else result.unchanged++;
  }catch(e){Object.assign(next,before);for(const k of Object.keys(next) as (keyof Data)[])if(!(k in before))delete next[k];Object.assign(result,beforeResult);errors.push({id:row.id,message:(e as Error).message});result.skipped.push({sheet:row.sheet,line:row.line,reason:(e as Error).message});}
 }
 try{validate(next);}catch(e){errors.push({id:'',message:(e as Error).message});}
 return {data:next,result,errors};
}
