export const RACK_KINDS = [
  "palletRack",
  "shelfRack",
  "binRack",
  "slidingRack",
  "cabinet",
  "floorSlot",
] as const;
export type RackKind = (typeof RACK_KINDS)[number];
export const OBJECT_KINDS = [
  "wall",
  "door",
  "exit",
  "emergencyExit",
  "gate",
  "workbench",
  "packingTable",
  "pallet",
  "crate",
  "bin",
  "forklift",
  "palletJack",
  "footpath",
  "forkliftPath",
  "crossing",
  "arrow",
  "blocked",
  "parking",
  "charger",
  "inbound",
  "outbound",
  "zone",
] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];
export type PartKind = RackKind | ObjectKind;
export type Point = { x: number; z: number };
export type Hall = {
  id: string;
  name: string;
  building: string;
  width: number;
  depth: number;
  height: number;
  x: number;
  z: number;
  locked?: boolean;
};
export type SceneObject = {
  id: string;
  kind: ObjectKind;
  name: string;
  building: string;
  hallId: string;
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  locked?: boolean;
  points?: Point[];
  wallId?: string;
  offset?: number;
  exterior?: boolean;
};
export type HallLayout = { version: 1; halls: Hall[]; objects: SceneObject[] };
export const isOpening = (kind: string) =>
  ["door", "exit", "emergencyExit", "gate"].includes(kind);
export const isPath = (kind: string) =>
  ["footpath", "forkliftPath"].includes(kind);
export const isMarking = (kind: string) =>
  isPath(kind) ||
  [
    "crossing",
    "arrow",
    "blocked",
    "parking",
    "charger",
    "inbound",
    "outbound",
    "zone",
  ].includes(kind);
export function validateLayout(
  layout: HallLayout,
  racks: { id: string; building: string; hallId?: string }[],
  used: Set<string>,
) {
  if (
    !layout ||
    layout.version !== 1 ||
    !Array.isArray(layout.halls) ||
    !Array.isArray(layout.objects) ||
    layout.halls.length > 20 ||
    layout.objects.length > 2000
  )
    throw Error("Ungültiges Hallenlayout.");
  const id = (s: string) => {
    if (typeof s !== "string" || !s || used.has(s))
      throw Error("Doppelte oder fehlende Bauteil-ID.");
    used.add(s);
  };
  const text = (s: string) => {
    if (typeof s !== "string" || !s.trim())
      throw Error("Name oder Gebäude fehlt.");
  };
  const num = (n: number, min: number, max: number) => {
    if (!Number.isFinite(n) || n < min || n > max)
      throw Error("Ungültige Hallen- oder Bauteilmaße.");
  };
  for (const h of layout.halls) {
    id(h.id);
    text(h.name);
    text(h.building);
    for (const n of [h.width, h.depth]) num(n, 1, 200);
    num(h.height, 1, 30);
    num(h.x, -1000, 1000);
    num(h.z, -1000, 1000);
    if (h.locked !== undefined && typeof h.locked !== "boolean")
      throw Error("Ungültige Sperre.");
  }
  for (const o of layout.objects) {
    id(o.id);
    text(o.name);
    text(o.building);
    if (!OBJECT_KINDS.includes(o.kind)) throw Error("Unbekannter Bauteiltyp.");
    if (
      !layout.halls.some((h) => h.id === o.hallId && h.building === o.building)
    )
      throw Error("Bauteil ohne passendes Gebäude/Halle.");
    for (const n of [o.width, o.depth]) num(n, 0.02, 200);
    num(o.height, 0.005, 30);
    num(o.x, -1000, 1000);
    num(o.z, -1000, 1000);
    num(o.rotation, -1000, 1000);
    if (!/^#[0-9a-f]{6}$/i.test(o.color))
      throw Error("Ungültige Bauteilfarbe.");
    if (o.locked !== undefined && typeof o.locked !== "boolean")
      throw Error("Ungültige Bauteilsperre.");
    if (o.exterior !== undefined && typeof o.exterior !== "boolean")
      throw Error("Ungültige Außenwand.");
    if (isPath(o.kind)) {
      if (
        !Array.isArray(o.points) ||
        o.points.length < 2 ||
        o.points.length > 100
      )
        throw Error("Ein Weg benötigt 2 bis 100 Stützpunkte.");
      for (const p of o.points) {
        num(p.x, -200, 200);
        num(p.z, -200, 200);
      }
    }
  }
  for (const o of layout.objects)
    if (isOpening(o.kind)) {
      const w = layout.objects.find(
        (w) => w.id === o.wallId && w.kind === "wall",
      );
      if (
        !w ||
        w.hallId !== o.hallId ||
        !Number.isFinite(o.offset) ||
        o.width > w.width ||
        o.height > w.height ||
        Math.abs(o.offset!) > (w.width - o.width) / 2 + 0.001
      )
        throw Error(
          "Die Öffnung passt nicht in die zugehörige Wand. Breite, Höhe oder Versatz anpassen.",
        );
    }
  for (const r of racks)
    if (
      r.hallId &&
      !layout.halls.some((h) => h.id === r.hallId && h.building === r.building)
    )
      throw Error("Regal ohne passende Halle.");
}
