import type {Workbook,Worksheet} from 'exceljs';
import {code,type Data,type CheckEntry} from './model';
export const CHECK_HEADERS=['Nr.','Materialnummer','Materialbezeichnung','Alter Lagerplatz','Neuer Lagerplatz','Geprüft','Bemerkung'];
export function addChecklistSheets(book:Workbook,data:Data){
 const reserved=new Set(['regale','bereiche und segmente','lagerplätze','anleitung','lagerplan','kontrollzuordnung','noch kein lagerplatz']);
 const sheetName=(raw:string)=>{const base=(raw.replace(/[\\/*?:\[\]]/g,' ').replace(/^'+|'+$/g,'').trim() || 'Regal').slice(0,31).replace(/^'+|'+$/g,'');let name=base,n=2;while(reserved.has(name.toLowerCase()))name=base.slice(0,26)+' ('+(n++)+')';reserved.add(name.toLowerCase());return name;};
 const make=(name:string)=>{const s=book.addWorksheet(name);s.addRow(CHECK_HEADERS);s.columns=[8,22,48,26,26,19,55].map(width=>({width,style:{numFmt:'@'}}));s.views=[{state:'frozen',ySplit:1}];s.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};s.getRow(1).height=28;s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF294454'}};return s;};
 const refs:string[][]=[];const emitted=new Set<string>();let rowNumber=0;
 const add=(s:Worksheet,material:Data['materials'][number]|undefined,slot:Data['racks'][number]['slots'][number]|undefined,rack:Data['racks'][number]|undefined,entry?:CheckEntry)=>{
  const nr=String(++rowNumber);const next=slot&&rack?code(rack,slot):entry?.proposedLocation || '';
  s.addRow([nr,material?.number || '',entry?.materialName || material?.name || '',entry?.oldLocation ?? material?.oldLocations?.join('\n') ?? '',next,entry?.status || '',entry?.note || '']);
  const last=s.lastRow!;last.alignment={wrapText:true,vertical:'top'};last.height=Math.min(220,Math.max(25,...[[entry?.materialName || material?.name || '',48],[entry?.note || '',55],[entry?.oldLocation || '',26]].map(([value,width])=>18*String(value).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/Number(width))),0)+8)));
  refs.push([s.name,nr,entry?.id || '',rack?.id || entry?.rackId || '',slot?.id || '',material?.id || '',slot?'JA':'NEIN']);if(entry)emitted.add(entry.id);
 };
 for(const rack of data.racks){const s=make(sheetName(`${rack.building} R${rack.number} ${rack.name}`));rowNumber=0;
  for(const slot of rack.slots){const materials=data.materials.filter(m=>m.assignedSlotIds?.includes(slot.id)||data.stock.some(b=>b.slotId===slot.id&&b.materialId===m.id));if(!materials.length){const checks=(data.checklist || []).filter(e=>e.slotId===slot.id&&!e.materialId);if(checks.length)checks.forEach(e=>add(s,undefined,slot,rack,e));else add(s,undefined,slot,rack);}
   for(const m of materials){const checks=(data.checklist || []).filter(e=>e.slotId===slot.id&&e.materialId===m.id);if(checks.length)checks.forEach(e=>add(s,m,slot,rack,e));else add(s,m,slot,rack);}
  }
  for(const e of data.checklist || [])if(!emitted.has(e.id)&&(e.rackId===rack.id||rack.slots.some(v=>v.id===e.slotId))){const m=data.materials.find(m=>m.id===e.materialId),slot=rack.slots.find(v=>v.id===e.slotId);const associated=slot&&(!m||m.assignedSlotIds?.includes(slot.id)||data.stock.some(b=>b.materialId===m.id&&b.slotId===slot.id));add(s,m,associated?slot:undefined,rack,e);}
  s.autoFilter=`A1:G${Math.max(1,s.rowCount)}`;
 }
 const unassigned=make('Noch kein Lagerplatz');rowNumber=0;
 for(const e of data.checklist || [])if(!e.slotId&&!emitted.has(e.id))add(unassigned,data.materials.find(m=>m.id===e.materialId),undefined,undefined,e);
 for(const m of data.materials)if(!m.assignedSlotIds?.length&&!data.stock.some(b=>b.materialId===m.id)&&!(data.checklist || []).some(e=>e.materialId===m.id&&!e.slotId))add(unassigned,m,undefined,undefined);
 unassigned.autoFilter=`A1:G${Math.max(1,unassigned.rowCount)}`;
 const links=book.addWorksheet('Kontrollzuordnung');links.addRow(['Blatt','Nr.','Kontroll-ID','Regal-ID','Fach-ID','Material-ID','Bestätigt']);refs.forEach(r=>links.addRow(r));links.columns=[40,9,40,40,40,40,14].map(width=>({width,style:{numFmt:'@'}}));links.getRow(1).font={bold:true};links.views=[{state:'frozen',ySplit:1}];
}
