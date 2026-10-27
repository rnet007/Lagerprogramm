import { code, uid, validate, type Data, type Material, type ImportReviewRow } from './model';
export type Cell = { text: string; issue?: string };
export type Sheet = { name: string; rows: Cell[][] };
export type Mapping = { number: number; name: number; old: number; next: number };
export type ImportRow = ImportReviewRow;
export type Group = { number: string; rows: ImportRow[]; names: string[]; old: string[]; next: string[]; existing?: Material };
export type Choice = { include: boolean; name: string; action: 'review' | 'merge' | 'replace' | 'skip'; slots: string[] };
export const unique = (a: string[]) => [...new Set(a.filter(Boolean))];
export const materialMatches = (m: Material, query: string) => [m.number, m.name, m.description, ...(m.alternativeNames || []), ...(m.oldLocations || []), ...(m.pendingLocations || [])].some(v => v.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
export function csvRows(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/)[0];
  const delimiter = [';', ',', '\t'].sort((a,b) => first.split(b).length-first.split(a).length)[0];
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for(let i=0;i<text.length;i++) { const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"') { value+='"'; i++; } else if(!value || quoted) quoted=!quoted; else value+=c; }
    else if(!quoted && (c===delimiter || c==='\n' || c==='\r')) { row.push(value); value=''; if(c!==delimiter) { rows.push(row); row=[]; if(c==='\r' && text[i+1]==='\n')i++; } }
    else value+=c;
  }
  if(quoted) throw Error('CSV enthält ein nicht geschlossenes Anführungszeichen.');
  if(value || row.length) {row.push(value);rows.push(row);} return rows;
}
export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  if(file.size>15*1024*1024) throw Error('Bitte eine Datei bis 15 MB verwenden.');
  if(/\.csv$/i.test(file.name)) {
    const bytes=await file.arrayBuffer(); const prefix=new Uint8Array(bytes,0,Math.min(2,bytes.byteLength)); let text=new TextDecoder(prefix[0]===255 && prefix[1]===254?'utf-16le':prefix[0]===254 && prefix[1]===255?'utf-16be':'utf-8',{fatal:false}).decode(bytes);
    if(text.includes('\ufffd'))text=new TextDecoder('windows-1252').decode(bytes);
    const rows=csvRows(text); if(rows.length>10001 || rows.some(r=>r.length>200))throw Error('Maximal 10.000 Datenzeilen und 200 Spalten.');
    return [{name:'CSV',rows:rows.map(r=>r.map(text=>({text})))}];
  }
  if(!/\.xlsx$/i.test(file.name)) throw Error('Bitte .xlsx oder .csv auswählen.');
  const { Workbook }=await import('exceljs'); const book=new Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  return book.worksheets.map(sheet=>{
    if(sheet.rowCount>10001 || sheet.columnCount>200)throw Error('Maximal 10.000 Zeilen und 200 Spalten pro Blatt.');
    const rows: Cell[][]=[];
    for(let n=1;n<=sheet.rowCount;n++) {
      const row:Cell[]=[];
      for(let col=1;col<=sheet.columnCount;col++) {
        const c=sheet.getCell(n,col); let text=c.text, issue=''; const v=c.value;
        if(typeof v==='number') {
          const format=c.numFmt || 'General';
          if(Number.isSafeInteger(v) && v>=0 && /^0+$/.test(format)) text=String(v).padStart(format.length,'0');
          else {text=String(v); issue='Numerische Zelle: führende Nullen nicht eindeutig. Nummer als Text prüfen und bestätigen.';}
          if(!Number.isSafeInteger(v) || v<0) issue='Numerischer Wert ist keine verlustfrei lesbare Materialnummer. Original prüfen.';
        } else if(v && typeof v==='object' && ('formula' in v || 'sharedFormula' in v)) issue='Formelzelle: gespeichertes Ergebnis muss manuell geprüft werden.';
        else if(v instanceof Date)issue='Datumszelle: Materialnummer manuell prüfen.';
        else if(v && typeof v==='object' && 'error' in v)issue='Excel-Fehlerzelle.';
        row.push({text,issue});
      } rows.push(row);
    }return {name:sheet.name,rows};
  });
}
export function detectMapping(headers: Cell[]): Mapping {
  const normalized=headers.map(c=>c.text.toLowerCase().replace(/[\s_\-]/g,''));
  const find=(names:string[])=>normalized.findIndex(v=>names.includes(v));
  return {number:find(['material','materialnummer','materialnr','artikelnummer']),name:find(['materialkurztext','bezeichnung','materialbezeichnung','name']),old:find(['platz','lagerplatz','alterlagerplatz','altplatz']),next:find(['neuerlagerplatz','neuerplatz','ziellagerplatz','zielplatz'])};
}
export function mappedRows(sheet:Sheet, header:number,m:Mapping): ImportRow[] {
  return sheet.rows.slice(header+1).map((r,i)=>({row:header+i+2,number:r[m.number]?.text ?? '',name:(r[m.name]?.text || '').trim(),old:(r[m.old]?.text || '').trim(),next:(r[m.next]?.text || '').trim(),issue:r[m.number]?.issue || '',include:true})).filter(r=>[r.number,r.name,r.old,r.next].some(Boolean));
}
export function groupRows(rows:ImportRow[],data:Data): Group[] {
  const groups=new Map<string,Group>();
  for(const row of rows.filter(r=>r.include && r.number.trim() && !r.issue)) {
    let g=groups.get(row.number); if(!g){g={number:row.number,rows:[],names:[],old:[],next:[],existing:data.materials.find(m=>m.number===row.number)};groups.set(row.number,g);}
    g.rows.push(row);g.names=unique([...g.names,row.name]);g.old=unique([...g.old,row.old]);g.next=unique([...g.next,row.next]);
  }return [...groups.values()];
}
export function slotMatches(data:Data, value:string) {return data.racks.flatMap(r=>r.slots.filter(s=>code(r,s)===value).map(s=>s.id));}
export function defaultChoice(g:Group):Choice {return {include:true,name:g.existing?.name || (g.names.length===1?g.names[0]:''),action:g.existing?'review':'merge',slots:[]};}
export function applyImport(data:Data,rows:ImportRow[],choices:Record<string,Choice>, replacesReview = false) {
  const next=structuredClone(data); const result={created:0,updated:0,unchanged:0,deferred:0,excluded:rows.filter(r=>!r.include).length};
  result.deferred=rows.filter(r=>r.include && (!r.number.trim() || r.issue)).length;
  const review: ImportRow[]=rows.filter(r=>r.include && (!r.number.trim() || r.issue));
  const key=(r:ImportRow)=>JSON.stringify([r.number,r.name,r.old,r.next]);
  const incoming=new Set(rows.map(key));
  for(const g of groupRows(rows,data)) {
    const c=choices[g.number] || defaultChoice(g);
    if(!c.include) {result.excluded++;continue;}
    if(c.action==='skip'){if(g.existing)result.unchanged++;else result.excluded++;continue;}
    if(!c.name.trim() || c.action==='review'){result.deferred++;review.push(...g.rows);continue;}
    if(c.slots.some(s=>!g.next.some(v=>{const ids=slotMatches(data,v);return ids.length===1 && ids[0]===s;})))throw Error('Lagerplatzzuordnung ist nicht eindeutig.');
    const old=g.existing; const names=unique([...(old?.alternativeNames || []),old?.name || '',...g.names]).filter(n=>n!==(c.action==='merge' && old?old.name:c.name));
    const material:Material={...(old || {id:uid(),number:g.number,description:''}),name:c.action==='merge' && old?old.name:c.name,alternativeNames:names,oldLocations:unique([...(old?.oldLocations || []),...g.old]),assignedSlotIds:unique([...(old?.assignedSlotIds || []),...c.slots]),pendingLocations:unique([...(old?.pendingLocations || []),...g.next]).filter(v=>!slotMatches(data,v).some(id=>[...(old?.assignedSlotIds || []),...c.slots].includes(id)))};
    if(old) {
      const normalized=(m:Material)=>JSON.stringify({...m,alternativeNames:m.alternativeNames || [],oldLocations:m.oldLocations || [],assignedSlotIds:m.assignedSlotIds || [],pendingLocations:m.pendingLocations || []});
      if(normalized(old)===normalized(material))result.unchanged++;else {next.materials[next.materials.findIndex(m=>m.id===old.id)]=material;result.updated++;}
    } else {next.materials.push(material);result.created++;}
    if(material.pendingLocations?.length)result.deferred++;
  }
  const all=[...(replacesReview ? [] : (data.importReview || []).filter(r=>!incoming.has(key(r)))),...review];
  next.importReview=[...new Map(all.map(r=>[key(r),r])).values()];
  validate(next);return {data:next,result};
}
