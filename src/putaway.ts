import {trackPutawaySap} from './sap';
import {uid,code,validate,type Data,type Material,type Rack,type Slot} from './model';
import {materialMatches} from './materialImport';
export type Order='bottom-lr'|'bottom-rl'|'top-lr'|'top-rl'|'column-lr'|'column-rl';
export const orders:Record<Order,string>={'bottom-lr':'Unten → oben, links → rechts','bottom-rl':'Unten → oben, rechts → links','top-lr':'Oben → unten, links → rechts','top-rl':'Oben → unten, rechts → links','column-lr':'Spaltenweise unten → oben, links → rechts','column-rl':'Spaltenweise unten → oben, rechts → links'};
export function orderedSlots(r:Rack,areaId:string,order:Order){const a=r.areas.find(a=>a.id===areaId);if(!a)return [];return r.slots.filter(s=>s.areaId===areaId).sort((x,y)=>{const row=(s:Slot)=>Math.floor((s.number-1)/a.columns),col=(s:Slot)=>(s.number-1)%a.columns;const reverse=order.endsWith('rl')?-1:1;return order.startsWith('column')?(col(x)-col(y))*reverse||row(x)-row(y):(row(x)-row(y))*(order.startsWith('top')?-1:1)||(col(x)-col(y))*reverse;});}
export const normalizeOld=(s:string)=>s.toLocaleLowerCase().replace(/[.\s/_-]/g,'');
export function oldPlaces(data:Data,m:Material){return [...new Set([...(m.oldLocations||[]),...(data.checklist||[]).filter(e=>e.materialId===m.id).flatMap(e=>e.oldLocation.split(/\r?\n/))].filter(Boolean))];}
export function lookupPutaway(data:Data,q:string,mode:'old'|'material') {if(!q.trim())return {matches:[] as Material[],exact:[] as Material[]};const n=normalizeOld(q);if(mode==='material'){const matches=data.materials.filter(m=>materialMatches(m,q));return {matches,exact:matches.filter(m=>m.number===q||m.name.toLocaleLowerCase()===q.toLocaleLowerCase())};}const exact=data.materials.filter(m=>oldPlaces(data,m).some(p=>normalizeOld(p)===n));const matches=exact.length?exact:data.materials.filter(m=>oldPlaces(data,m).some(p=>normalizeOld(p).includes(n)));return {matches,exact};}
export function materialSlots(data:Data,id:string){return data.racks.flatMap(r=>r.slots.filter(s=>data.materials.find(m=>m.id===id)?.assignedSlotIds?.includes(s.id)||data.stock.some(b=>b.materialId===id&&b.slotId===s.id)).map(s=>({r,s})));}
export function slotMaterials(data:Data,id:string){return data.materials.filter(m=>m.assignedSlotIds?.includes(id)||data.stock.some(b=>b.materialId===m.id&&b.slotId===id));}
export function putaway(data:Data,options:{materialId:string;slotId:string;old:string;action:'add'|'move';quantity?:number;occupiedConfirmed:boolean}){
 const {materialId,slotId,action,quantity,old}=options;const material=data.materials.find(m=>m.id===materialId);if(!material||!data.racks.some(r=>r.slots.some(s=>s.id===slotId)))throw Error('Material oder Zielfach ist nicht mehr vorhanden.');
 if(quantity!==undefined&&(!Number.isFinite(quantity)||quantity<=0||quantity>1e12))throw Error('Bitte eine positive Menge eingeben oder das Mengenfeld leer lassen.');
 if(slotMaterials(data,slotId).some(m=>m.id!==materialId)&&!options.occupiedConfirmed)throw Error('Zusätzliche Belegung zuerst bestätigen. Vorhandene Materialien bleiben erhalten.');
 const sources=data.stock.filter(b=>b.materialId===materialId&&b.slotId!==slotId);const total=sources.reduce((n,b)=>n+b.quantity,0);
 if(action==='move'&&quantity!==undefined&&(total===0||quantity>total))throw Error('Teilumlagerung benötigt eine gebuchte Quellmenge; die Menge darf deren Summe nicht überschreiten. Ohne Menge werden alle bestehenden Zuordnungen und Bestände umgelagert.');
 const next=structuredClone(data),m=next.materials.find(m=>m.id===materialId)!;const before=JSON.stringify({...next,sap:undefined});
 if(action==='move'){
  let remaining=quantity??total;let moved=0;
  for(const b of next.stock.filter(b=>b.materialId===materialId&&b.slotId!==slotId)){const amount=Math.min(remaining,b.quantity);b.quantity-=amount;remaining-=amount;moved+=amount;}
  next.stock=next.stock.filter(b=>b.quantity>0);
  if(moved){const target=next.stock.find(b=>b.materialId===materialId&&b.slotId===slotId);if(target)target.quantity+=moved;else next.stock.push({id:uid(),materialId,slotId,quantity:moved});}
  if(quantity===undefined)m.assignedSlotIds=[slotId];else m.assignedSlotIds=[...new Set([...(m.assignedSlotIds||[]),slotId])];
 }else{if(!next.stock.some(b=>b.materialId===materialId&&b.slotId===slotId)&&!m.assignedSlotIds?.includes(slotId))m.assignedSlotIds=[...(m.assignedSlotIds||[]),slotId];if(quantity!==undefined){const target=next.stock.find(b=>b.materialId===materialId&&b.slotId===slotId);if(target)target.quantity+=quantity;else next.stock.push({id:uid(),materialId,slotId,quantity});}}
 if(old.trim()&&!m.oldLocations?.includes(old))m.oldLocations=[...(m.oldLocations||[]),old];
 if(m.pendingLocations?.length){const rack=next.racks.find(r=>r.slots.some(s=>s.id===slotId))!;const slot=rack.slots.find(s=>s.id===slotId)!;const target=code(rack,slot);m.pendingLocations=m.pendingLocations.filter(p=>p!==target);}
 const tracked=trackPutawaySap(data,next,materialId,slotId,old);validate(tracked);return {data:tracked,changed:JSON.stringify({...tracked,sap:undefined})!==before,sapUpdated:JSON.stringify(tracked.sap)!==JSON.stringify(data.sap)};
}
