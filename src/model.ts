import {validateSap,type SapState} from './sapTypes';
import {
  type HallLayout,
  type RackKind,
  RACK_KINDS,
  validateLayout,
} from "./builderTypes";
export type Area = {
  id: string;
  name: string;
  prefix: string;
  segmentNames?: string[];
  columns: number;
  levels: number;
};
export type Slot = {
  id: string;
  areaId: string;
  number: number;
  name?: string;
};
export type Rack = {
  kind?: RackKind;
  hallId?: string;
  color?: string;
  locked?: boolean;
  slidingDirection?: "x" | "z";
  id: string;
  name: string;
  number: string;
  building: string;
  width: number;
  height: number;
  depth: number;
  x: number;
  z: number;
  rotation: number;
  areas: Area[];
  slots: Slot[];
};
export type Material = {
  id: string;
  number: string;
  name: string;
  description: string;
  alternativeNames?: string[];
  oldLocations?: string[];
  pendingLocations?: string[];
  assignedSlotIds?: string[];
};
export type Stock = {
  id: string;
  materialId: string;
  slotId: string;
  quantity: number;
};
export type ImportReviewRow = { row: number; number: string; name: string; old: string; next: string; issue: string; include: boolean };
export type CheckEntry = {materialName?:string;id:string; materialId?:string; slotId?:string; rackId?:string; oldLocation:string; proposedLocation:string; status:string; note:string; sourceKey?:string};
export type Data = {
  sap?: SapState;
  checklist?: CheckEntry[];
  importReview?: ImportReviewRow[];
  layout?: HallLayout;
  version: 1;
  racks: Rack[];
  materials: Material[];
  stock: Stock[];
};
export const uid = () => crypto.randomUUID();
export const code = (r: Rack, s: Slot) =>
  s.name ||
  `${r.building}R${r.number}${r.areas.find((a) => a.id === s.areaId)?.prefix ?? ""}${String(s.number).padStart(2, "0")}`;
export function rebuild(r: Rack, stock: Stock[], previous?: Rack): Rack {
  const slots = r.areas.flatMap((a) =>
    Array.from({ length: a.columns * a.levels }, (_, i) => {
      const existing = r.slots.find(
        (s) => s.areaId === a.id && s.number === i + 1,
      );
      const old = previous?.areas.find((v) => v.id === a.id);
      return (
        existing ||
        (old && i < old.columns * old.levels
          ? null
          : { id: uid(), areaId: a.id, number: i + 1 })
      );
    }).filter((s): s is Slot => s !== null),
  );
  if (
    (previous?.slots || r.slots).some(
      (s) =>
        !slots.some((n) => n.id === s.id) &&
        stock.some((b) => b.slotId === s.id),
    )
  )
    throw Error(
      "Die Änderung würde belegte Fächer entfernen. Bitte lagern Sie deren Materialien zuerst um.",
    );
  return { ...r, slots };
}
export function example(): Data {
  const racks: Rack[] = [1, 2, 3].map((n) => {
    const areas = (
      n === 3
        ? [
            ["Hinten", "H", 10, 10],
            ["Mitte", "M", 10, 7],
            ["Vorne", "V", 10, 7],
          ]
        : [["Vorne", "V", 6, 5]]
    ).map((a) => ({
      id: uid(),
      name: String(a[0]),
      prefix: String(a[1]),
      columns: Number(a[2]),
      levels: Number(a[3]),
    }));
    return rebuild(
      {
        id: uid(),
        name: `Kleinteile ${n}`,
        number: String(n),
        building: "55",
        width: n === 3 ? 6 : 4,
        height: 3,
        depth: n === 3 ? 2.4 : 1,
        x: (n - 1) * 6 - 6,
        z: 0,
        rotation: 0,
        areas,
        slots: [],
      },
      [],
    );
  });
  const names = [
    "Sechskantschraube M8",
    "Unterlegscheibe 8 mm",
    "Kugellager 6204",
    "Dichtring 25 mm",
    "Steckverbinder 4-polig",
    "Kabelbinder 200 mm",
    "Druckfeder klein",
    "Gewindemutter M6",
    "Sicherungsring 20 mm",
    "Distanzhülse 12 mm",
    "Sensorhalter",
    "Klemmstück",
    "O-Ring 30 mm",
    "Passstift 6 mm",
    "Montagewinkel",
    "Schutzkappe",
    "Anschlussklemme",
    "Rändelschraube",
    "Führungshülse",
    "Gummipuffer",
  ];
  const materials = names.map((name, i) => ({
    id: uid(),
    number: i === 0 ? "0087050842" : `00010${String(i + 1).padStart(5, "0")}`,
    name: `${name} · Beispiel`,
    description: "Fiktives Testmaterial – keine realen Unternehmensdaten.",
  }));
  const stock = materials.map((m, i) => ({
    id: uid(),
    materialId: m.id,
    slotId: (i < 7 ? racks[0].slots[i * 3] : racks[2].slots[(i - 7) * 11 + 41])
      .id,
    quantity: (i + 1) * 8,
  }));
  stock.push({
    id: uid(),
    materialId: materials[0].id,
    slotId: racks[2].slots[41].id,
    quantity: 42,
  });
  return { version: 1, racks, materials, stock };
}
export function validate(v: unknown): Data {
  const d = v as Data;
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.racks) ||
    !Array.isArray(d.materials) ||
    !Array.isArray(d.stock)
  )
    throw Error(
      "Ungültiges JSON: Erwartet wird ein Lagerraum-Export (Version 1).",
    );
  if(d.importReview !== undefined && (!Array.isArray(d.importReview) || d.importReview.length>10000 || d.importReview.some(r=>!r || !Number.isInteger(r.row) || r.row<1 || typeof r.include!=='boolean' || [r.number,r.name,r.old,r.next,r.issue].some(v=>typeof v!=='string')))) throw Error('Ungültige Import-Prüfliste.');
  const ids = new Set<string>();
  const id = (x: unknown) => {
    if (typeof x !== "string" || !x || ids.has(x))
      throw Error("Interne IDs fehlen oder sind doppelt.");
    ids.add(x);
  };
  const str = (x: unknown) => {
    if (typeof x !== "string" || !x.trim()) throw Error("Pflichttext fehlt.");
  };
  const num = (x: number, min: number, max: number) => {
    if (!Number.isFinite(x) || x < min || x > max)
      throw Error("Ungültige Maße, Positionen oder Mengen.");
  };
  if (
    d.racks.length > 100 ||
    d.materials.length > 10000 ||
    d.stock.length > 50000
  )
    throw Error("Datei überschreitet die Prototyp-Grenzen.");
  for (const r of d.racks) {
    id(r.id);
    if (r.kind !== undefined && !RACK_KINDS.includes(r.kind))
      throw Error("Unbekannter Regaltyp.");
    if (r.locked !== undefined && typeof r.locked !== "boolean")
      throw Error("Ungültige Regalsperre.");
    if (
      r.slidingDirection !== undefined &&
      !["x", "z"].includes(r.slidingDirection)
    )
      throw Error("Ungültige Bewegungsrichtung.");
    if (r.color !== undefined && !/^#[0-9a-f]{6}$/i.test(r.color))
      throw Error("Ungültige Regalfarbe.");

    str(r.name);
    str(r.number);
    str(r.building);
    for (const v of [r.width, r.height, r.depth]) num(v, 0.1, 100);
    for (const v of [r.x, r.z, r.rotation]) num(v, -1000, 1000);
    if (
      !Array.isArray(r.areas) ||
      !r.areas.length ||
      r.areas.length > 10 ||
      !Array.isArray(r.slots)
    )
      throw Error("Ungültige Bereiche.");
    for (const a of r.areas) {
      id(a.id);
      str(a.name);
      str(a.prefix);
      if(a.segmentNames !== undefined && (!Array.isArray(a.segmentNames) || a.segmentNames.length!==a.columns || a.segmentNames.some(v=>typeof v!=='string'||!v.trim()))) throw Error('Ungültige Segmentnamen.');
      for (const n of [a.columns, a.levels]) {
        num(n, 1, 20);
        if (!Number.isInteger(n))
          throw Error("Spalten und Ebenen müssen ganzzahlig sein.");
      }
    }
    if (r.slots.length > 4000) throw Error("Zu viele Fächer.");
    const positions = new Set();
    for (const s of r.slots) {
      id(s.id);
      const a = r.areas.find((a) => a.id === s.areaId);
      if (
        !a ||
        !Number.isInteger(s.number) ||
        s.number < 1 ||
        s.number > a.columns * a.levels
      )
        throw Error("Ungültige Fachposition.");
      const key = `${s.areaId}:${s.number}`;
      if (positions.has(key)) throw Error("Doppelte Fachposition.");
      positions.add(key);
      if (s.name !== undefined) str(s.name);
    }
  }
  for (const m of d.materials) {
    id(m.id);
    str(m.number);
    str(m.name);
    for (const field of [m.alternativeNames, m.oldLocations, m.pendingLocations, m.assignedSlotIds]) {
      if (field !== undefined && (!Array.isArray(field) || field.some(v => typeof v !== 'string' || !v.trim()) || new Set(field).size !== field.length)) throw Error('Ungültige importierte Materialangaben.');
    }
    if (m.assignedSlotIds?.some(id => !d.racks.some(r => r.slots.some(s => s.id === id)))) throw Error('Material verweist auf unbekannten Lagerplatz.');
    if (typeof m.description !== "string")
      throw Error("Beschreibung muss Text sein.");
  }
  if (new Set(d.materials.map((m) => m.number)).size !== d.materials.length)
    throw Error("Doppelte Materialnummer.");
  const pairs = new Set();
  for (const b of d.stock) {
    id(b.id);
    num(b.quantity, Number.MIN_VALUE, 1e12);
    if (
      !d.materials.some((m) => m.id === b.materialId) ||
      !d.racks.some((r) => r.slots.some((s) => s.id === b.slotId))
    )
      throw Error("Belegung verweist auf unbekannte Daten.");
    const p = b.materialId + ":" + b.slotId;
    if (pairs.has(p)) throw Error("Doppelte Belegung.");
    pairs.add(p);
  }
  const codes = d.racks.flatMap((r) => r.slots.map((s) => code(r, s)));
  if (new Set(codes).size !== codes.length)
    throw Error("Lagerplatzcodes müssen eindeutig sein.");
  if(d.sap !== undefined)validateSap(d.sap,id);
  if(d.checklist !== undefined){
    if(!Array.isArray(d.checklist) || d.checklist.length>50000)throw Error('Ungültige Kontrollliste.');
    for(const e of d.checklist){id(e.id);if(e.materialName!==undefined&&typeof e.materialName!=='string')throw Error('Ungültige Kontrollbezeichnung.');if([e.oldLocation,e.proposedLocation,e.status,e.note].some(v=>typeof v!=='string') || e.sourceKey!==undefined&&typeof e.sourceKey!=='string')throw Error('Ungültige Prüfwerte.');
      if(e.materialId!==undefined&&!d.materials.some(m=>m.id===e.materialId))throw Error('Kontrollliste verweist auf unbekanntes Material.');
      if(e.rackId!==undefined&&!d.racks.some(r=>r.id===e.rackId))throw Error('Kontrollliste verweist auf unbekanntes Regal.');
      if(e.slotId!==undefined&&!d.racks.some(r=>(!e.rackId||e.rackId===r.id)&&r.slots.some(s=>s.id===e.slotId)))throw Error('Kontrollliste verweist auf unbekanntes Fach.');
    }
  }
  if (d.layout !== undefined) validateLayout(d.layout, d.racks, ids);
  return d;
}
export function transfer(
  d: Data,
  stockId: string,
  target: string,
  amount: number,
): Data {
  const b = d.stock.find((b) => b.id === stockId);
  if (
    !b ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > b.quantity ||
    target === b.slotId ||
    !d.racks.some((r) => r.slots.some((s) => s.id === target))
  )
    throw Error("Bitte ein anderes Zielfach und eine gültige Menge wählen.");
  const stock = d.stock.map((b) => ({ ...b }));
  const source = stock.find((s) => s.id === stockId)!;
  source.quantity -= amount;
  const dest = stock.find(
    (s) => s.slotId === target && s.materialId === b.materialId,
  );
  if (dest) dest.quantity += amount;
  else
    stock.push({
      id: uid(),
      slotId: target,
      materialId: b.materialId,
      quantity: amount,
    });
  return { ...d, stock: stock.filter((s) => s.quantity > 0) };
}
