import { type Data, type Rack, uid, rebuild, validate } from "./model";
import {
  type Hall,
  type SceneObject,
  type PartKind,
  type RackKind,
  type ObjectKind,
  type HallLayout,
  type Point,
  RACK_KINDS,
  isOpening,
  isPath,
  isMarking,
} from "./builderTypes";
import { boundsFor } from "./layout";
export type Part = {
  kind: PartKind;
  name: string;
  category:
    | "Lagersysteme"
    | "Halle & Öffnungen"
    | "Ausstattung"
    | "Wege & Flächen";
  width: number;
  depth: number;
  height: number;
  color: string;
};
export const PARTS: Part[] = [
  ["palletRack", "Palettenregal", "Lagersysteme", 5.4, 1.2, 4, "#547b8b"],
  ["shelfRack", "Fachbodenregal", "Lagersysteme", 3.6, 0.8, 2.6, "#6e8990"],
  ["binRack", "Kleinteileregal", "Lagersysteme", 3, 0.8, 2.6, "#6d9286"],
  ["slidingRack", "Schieberegal", "Lagersysteme", 6, 2.4, 3, "#648b86"],
  ["cabinet", "Lagerschrank", "Lagersysteme", 2, 0.65, 2.2, "#7b8f9a"],
  ["floorSlot", "Bodenlagerplatz", "Lagersysteme", 2, 2, 0.12, "#d7a54e"],
  ["wall", "Wand", "Halle & Öffnungen", 6, 0.18, 4, "#dce5e4"],
  ["door", "Tür", "Halle & Öffnungen", 1, 0.18, 2.2, "#6d9691"],
  ["exit", "Personenausgang", "Halle & Öffnungen", 1.2, 0.18, 2.2, "#629681"],
  [
    "emergencyExit",
    "Notausgang",
    "Halle & Öffnungen",
    1.4,
    0.18,
    2.3,
    "#478f65",
  ],
  ["gate", "Hallentor", "Halle & Öffnungen", 4, 0.2, 3.8, "#879ca3"],
  ["workbench", "Werkbank", "Ausstattung", 2.4, 0.9, 0.9, "#be9669"],
  ["packingTable", "Packtisch", "Ausstattung", 2.2, 1, 0.9, "#c5a57a"],
  ["pallet", "Palette", "Ausstattung", 1.2, 0.8, 0.16, "#c7a777"],
  ["crate", "Kiste", "Ausstattung", 1, 0.8, 0.7, "#bc9b76"],
  ["bin", "Lagerkasten", "Ausstattung", 0.6, 0.4, 0.35, "#7faaa1"],
  ["forklift", "Gabelstapler", "Ausstattung", 1.3, 3.1, 2.3, "#d89a3d"],
  ["palletJack", "Hubwagen", "Ausstattung", 0.65, 1.6, 1.2, "#d2a14e"],
  ["footpath", "Fußweg", "Wege & Flächen", 1.2, 5, 0.025, "#8bc5ad"],
  [
    "forkliftPath",
    "Staplerfahrweg",
    "Wege & Flächen",
    2.6,
    8,
    0.025,
    "#e7c66f",
  ],
  ["crossing", "Markierte Querung", "Wege & Flächen", 3, 2, 0.025, "#e9ece8"],
  ["arrow", "Richtungspfeil", "Wege & Flächen", 0.8, 1.8, 0.035, "#f4f0d9"],
  ["blocked", "Sperrfläche", "Wege & Flächen", 3, 2, 0.025, "#dfaf82"],
  ["parking", "Fahrzeugstellplatz", "Wege & Flächen", 2.4, 4, 0.025, "#91b3b5"],
  ["charger", "Stapler-Ladeplatz", "Wege & Flächen", 2.5, 4, 0.025, "#a5bf9d"],
  ["inbound", "Wareneingang", "Wege & Flächen", 4, 3, 0.025, "#91b8ad"],
  ["outbound", "Warenausgang", "Wege & Flächen", 4, 3, 0.025, "#c9b093"],
  ["zone", "Benannte Fläche", "Wege & Flächen", 4, 3, 0.025, "#b4c4cf"],
].map(([kind, name, category, width, depth, height, color]) => ({
  kind: kind as PartKind,
  name: String(name),
  category: category as Part["category"],
  width: Number(width),
  depth: Number(depth),
  height: Number(height),
  color: String(color),
}));
export const part = (kind: string) => PARTS.find((p) => p.kind === kind)!;
export const rackKind = (kind: string) => RACK_KINDS.includes(kind as RackKind);
export type Entity = Rack | SceneObject;
export const emptyLayout = (): HallLayout => ({
  version: 1,
  halls: [],
  objects: [],
});
export function layoutFor(data: Data): HallLayout {
  if (data.layout) return data.layout;
  if (!data.racks.length) return emptyLayout();
  const b = boundsFor(data.racks),
    h: Hall = {
      id: uid(),
      name: "Halle · Bestand",
      building: data.racks[0].building,
      x: (b.minX + b.maxX) / 2,
      z: (b.minZ + b.maxZ) / 2,
      width: Math.min(200, Math.max(12, b.maxX - b.minX + 6)),
      depth: Math.min(200, Math.max(10, b.maxZ - b.minZ + 8)),
      height: 5,
    };
  // Separate buildings receive separate hall outlines; no inventory IDs are changed.
  const buildings = [...new Set(data.racks.map((r) => r.building))];
  return {
    version: 1,
    halls: buildings.map((building, i) => ({
      ...h,
      id: i ? uid() : h.id,
      building,
      name: `Halle ${building}`,
    })),
    objects: [],
  };
}
export function ensureLayout(data: Data): Data {
  if (data.layout) return data;
  const layout = layoutFor(data);
  return {
    ...data,
    layout,
    racks: data.racks.map((r) => ({
      ...r,
      hallId: layout.halls.find((h) => h.building === r.building)?.id,
    })),
  };
}
export function makeHall(
  building = "1",
  name = "Neue Halle",
  width = 20,
  depth = 16,
): Hall {
  return { id: uid(), building, name, width, depth, height: 5, x: 0, z: 0 };
}
export function makeRack(
  kind: RackKind,
  hall: Hall,
  data: Data,
  x = 0,
  z = 0,
): Rack {
  const p = part(kind),
    areaDefs =
      kind === "slidingRack"
        ? [
            ["Hinten", "H", 10, 10],
            ["Mitte", "M", 10, 7],
            ["Vorne", "V", 10, 7],
          ]
        : [
            [
              kind === "floorSlot" ? "Boden" : "Vorne",
              "V",
              kind === "floorSlot" ? 1 : kind === "palletRack" ? 2 : 5,
              kind === "floorSlot" ? 1 : kind === "palletRack" ? 3 : 4,
            ],
          ];
  return rebuild(
    {
      id: uid(),
      kind,
      name: p.name,
      number: String(
        Math.max(
          0,
          ...data.racks
            .filter((r) => /^\d+$/.test(r.number))
            .map((r) => Number(r.number)),
        ) + 1,
      ),
      building: hall.building,
      hallId: hall.id,
      x,
      z,
      rotation: 0,
      width: p.width,
      height: p.height,
      depth: p.depth,
      color: p.color,
      slidingDirection: "x",
      areas: areaDefs.map(([name, prefix, columns, levels]) => ({
        id: uid(),
        name: String(name),
        prefix: String(prefix),
        columns: Number(columns),
        levels: Number(levels),
      })),
      slots: [],
    },
    [],
  );
}
export function makeObject(
  kind: ObjectKind,
  hall: Hall,
  x = 0,
  z = 0,
): SceneObject {
  const p = part(kind);
  return {
    id: uid(),
    kind,
    name: p.name,
    building: hall.building,
    hallId: hall.id,
    x,
    z,
    rotation: 0,
    width: p.width,
    height: p.height,
    depth: p.depth,
    color: p.color,
    ...(isPath(kind)
      ? {
          points: [
            { x: -p.depth / 2, z: 0 },
            { x: p.depth / 2, z: 0 },
          ],
        }
      : {}),
  };
}
export function wallsFor(h: Hall): SceneObject[] {
  return [
    [0, -h.depth / 2, h.width, 0],
    [0, h.depth / 2, h.width, 0],
    [-h.width / 2, 0, h.depth, 90],
    [h.width / 2, 0, h.depth, 90],
  ].map(([x, z, width, rotation], i) => ({
    ...makeObject("wall", h, h.x + x, h.z + z),
    width,
    rotation,
    height: h.height,
    name: `Außenwand ${i + 1}`,
    exterior: true,
  }));
}
export function toWorld(
  o: { x: number; z: number; rotation: number },
  p: Point,
): Point {
  const t = (o.rotation * Math.PI) / 180;
  return {
    x: o.x + p.x * Math.cos(t) + p.z * Math.sin(t),
    z: o.z - p.x * Math.sin(t) + p.z * Math.cos(t),
  };
}
export function toLocal(
  o: { x: number; z: number; rotation: number },
  p: Point,
): Point {
  const t = (-o.rotation * Math.PI) / 180,
    x = p.x - o.x,
    z = p.z - o.z;
  return {
    x: x * Math.cos(t) + z * Math.sin(t),
    z: -x * Math.sin(t) + z * Math.cos(t),
  };
}
export function attachOpening(
  o: SceneObject,
  w: SceneObject,
  p: Point,
): SceneObject {
  const local = toLocal(w, p),
    offset = Math.max(
      -(w.width - o.width) / 2,
      Math.min((w.width - o.width) / 2, local.x),
    ),
    world = toWorld(w, { x: offset, z: 0 });
  return {
    ...o,
    wallId: w.id,
    offset,
    x: world.x,
    z: world.z,
    rotation: w.rotation,
    building: w.building,
    hallId: w.hallId,
    depth: w.depth,
  };
}
export function syncOpenings(layout: HallLayout): HallLayout {
  return {
    ...layout,
    objects: layout.objects.map((o) => {
      if (!isOpening(o.kind)) return o;
      const w = layout.objects.find((w) => w.id === o.wallId);
      return w
        ? attachOpening(o, w, toWorld(w, { x: o.offset || 0, z: 0 }))
        : o;
    }),
  };
}
export function wallSegments(w: SceneObject, objects: SceneObject[]) {
  const openings = objects.filter(
    (o) => isOpening(o.kind) && o.wallId === w.id,
  );
  const xs = [
    ...new Set([
      -w.width / 2,
      w.width / 2,
      ...openings.flatMap((o) => [
        (o.offset || 0) - o.width / 2,
        (o.offset || 0) + o.width / 2,
      ]),
    ]),
  ].sort((a, b) => a - b);
  return xs
    .slice(0, -1)
    .map((left, i) => {
      const right = xs[i + 1],
        mid = (left + right) / 2,
        bottom = Math.max(
          0,
          ...openings
            .filter(
              (o) =>
                mid > (o.offset || 0) - o.width / 2 - 0.001 &&
                mid < (o.offset || 0) + o.width / 2 + 0.001,
            )
            .map((o) => o.height),
        );
      return {
        x: mid,
        width: right - left,
        bottom,
        height: Math.max(0, w.height - bottom),
      };
    })
    .filter((s) => s.width > 0.001 && s.height > 0.001);
}
export function nearestWall(layout: HallLayout, hallId: string, p: Point) {
  return layout.objects
    .filter((o) => o.hallId === hallId && o.kind === "wall")
    .map((w) => {
      const q = toLocal(w, p);
      return {
        w,
        d: Math.hypot(Math.max(0, Math.abs(q.x) - w.width / 2), q.z),
      };
    })
    .sort((a, b) => a.d - b.d)[0];
}
export function entities(data: Data): Entity[] {
  return [...data.racks, ...(data.layout?.objects || [])];
}
export function entityPoints(o: Entity): Point[] {
  if ("kind" in o && isPath(o.kind || "") && "points" in o && o.points)
    return o.points.flatMap((p) =>
      [-1, 1].flatMap((x) =>
        [-1, 1].map((z) =>
          toWorld(o, {
            x: p.x + (x * o.width) / 2,
            z: p.z + (z * o.width) / 2,
          }),
        ),
      ),
    );
  return [-1, 1].flatMap((x) =>
    [-1, 1].map((z) =>
      toWorld(o, { x: (x * o.width) / 2, z: (z * o.depth) / 2 }),
    ),
  );
}
export function overlap(a: Entity, b: Entity) {
  const ap = entityPoints(a),
    bp = entityPoints(b);
  for (const o of [a, b])
    for (const v of [
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ]) {
      const t = (o.rotation * Math.PI) / 180,
        axis = {
          x: v.x * Math.cos(t) + v.z * Math.sin(t),
          z: -v.x * Math.sin(t) + v.z * Math.cos(t),
        },
        aa = ap.map((p) => p.x * axis.x + p.z * axis.z),
        bb = bp.map((p) => p.x * axis.x + p.z * axis.z);
      if (
        Math.min(...aa) >= Math.max(...bb) - 0.025 ||
        Math.min(...bb) >= Math.max(...aa) - 0.025
      )
        return false;
    }
  return true;
}
export type Warning = { ids: string[]; text: string };
export function warnings(data: Data): Warning[] {
  const layout = data.layout;
  if (!layout) return [];
  const es = entities(data),
    result: Warning[] = [];
  for (const e of es) {
    if ("kind" in e && isOpening(e.kind || "")) continue;
    const hall = layout.halls.find((h) => h.id === e.hallId);
    if (
      hall &&
      entityPoints(e).some(
        (p) =>
          Math.abs(p.x - hall.x) > hall.width / 2 + 0.12 ||
          Math.abs(p.z - hall.z) > hall.depth / 2 + 0.12,
      )
    )
      result.push({
        ids: [e.id],
        text: `${e.name}: außerhalb von „${hall.name}“.`,
      });
  }
  const shapes = (o: Entity): Entity[] => {
    if (!isPath(o.kind || "") || !("points" in o) || !o.points) return [o];
    return o.points.slice(0, -1).map((p, i) => {
      const q = o.points![i + 1],
        mid = toWorld(o, { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 });
      return {
        ...o,
        ...mid,
        kind: "zone" as const,
        points: undefined,
        width: Math.max(0.02, Math.hypot(q.x - p.x, q.z - p.z)),
        depth: o.width,
        rotation:
          o.rotation - (Math.atan2(q.z - p.z, q.x - p.x) * 180) / Math.PI,
      };
    });
  };
  const allowed = (a: Entity, b: Entity) => {
    const am = isMarking(a.kind || ""),
      bm = isMarking(b.kind || "");
    if (am && bm) return true;
    if (!am && !bm) return false;
    const mark = am ? a : b,
      other = am ? b : a;
    if (["zone", "inbound", "outbound"].includes(mark.kind || "")) return true;
    if (
      ["parking", "charger", "forkliftPath", "crossing", "arrow"].includes(
        mark.kind || "",
      ) &&
      ["forklift", "palletJack"].includes(other.kind || "")
    )
      return true;
    return false;
  };
  const solid = es.filter((e) => !isOpening(e.kind || ""));
  for (let i = 0; i < solid.length; i++)
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i],
        b = solid[j];
      if (
        a.building !== b.building ||
        a.hallId !== b.hallId ||
        (a.kind === "wall" && b.kind === "wall") ||
        allowed(a, b)
      )
        continue;
      let hit = shapes(a).some((aa) => shapes(b).some((bb) => overlap(aa, bb)));
      const w = a.kind === "wall" ? a : b.kind === "wall" ? b : null,
        other = w === a ? b : a;
      if (hit && w)
        hit = wallSegments(w as SceneObject, layout.objects)
          .filter((seg) => seg.bottom < other.height)
          .some((seg) =>
            shapes(other).some((o) =>
              overlap(
                { ...w, ...toWorld(w, { x: seg.x, z: 0 }), width: seg.width },
                o,
              ),
            ),
          );
      if (hit)
        result.push({
          ids: [a.id, b.id],
          text: `Überschneidung: ${a.name} / ${b.name}.`,
        });
      if (result.length >= 60) return result;
    }

  return result;
}
export function duplicateEntities(
  data: Data,
  ids: string[],
): { data: Data; ids: string[] } {
  const next = structuredClone(data),
    newIds: string[] = [],
    idMap = new Map<string, string>();
  for (const id of ids) {
    const r = next.racks.find((r) => r.id === id);
    if (r) {
      const n = structuredClone(r);
      n.id = uid();
      n.name += " (Kopie)";
      n.number = String(
        Math.max(
          0,
          ...next.racks
            .filter((v) => /^\d+$/.test(v.number))
            .map((v) => Number(v.number)),
        ) + 1,
      );
      n.x += 1;
      n.z += 1;
      n.locked = false;
      n.areas = n.areas.map((a) => {
        const old = a.id,
          id = uid();
        n.slots = n.slots.map((s) =>
          s.areaId === old
            ? { ...s, id: uid(), areaId: id, name: undefined }
            : s,
        );
        return { ...a, id };
      });
      next.racks.push(n);
      newIds.push(n.id);
    } else {
      const o = next.layout?.objects.find((o) => o.id === id);
      if (o) {
        const n = {
          ...structuredClone(o),
          id: uid(),
          name: o.name + " (Kopie)",
          x: o.x + 1,
          z: o.z + 1,
          locked: false,
        };
        idMap.set(o.id, n.id);
        next.layout!.objects.push(n);
        newIds.push(n.id);
      }
    }
  }
  if (next.layout) {
    for (const o of next.layout.objects) {
      if (
        newIds.includes(o.id) &&
        isOpening(o.kind) &&
        o.wallId &&
        !idMap.has(o.wallId)
      ) {
        const wall = next.layout.objects.find((w) => w.id === o.wallId)!;
        const other = next.layout.objects.filter(
          (v) => v.id !== o.id && v.wallId === wall.id,
        );
        const candidates = [
          (o.offset || 0) + o.width + 0.25,
          (o.offset || 0) - o.width - 0.25,
          ...Array.from(
            { length: Math.ceil(wall.width / 0.25) + 1 },
            (_, i) => -wall.width / 2 + o.width / 2 + i * 0.25,
          ),
        ];
        const free = candidates.find(
          (x) =>
            Math.abs(x) <= (wall.width - o.width) / 2 + 0.001 &&
            other.every(
              (v) =>
                Math.abs((v.offset || 0) - x) >= (v.width + o.width) / 2 + 0.1,
            ),
        );
        if (free === undefined)
          throw Error(
            "In dieser Wand ist kein freier Platz für eine weitere Öffnung.",
          );
        Object.assign(
          o,
          attachOpening(o, wall, toWorld(wall, { x: free, z: 0 })),
        );
      }
    }
    for (const [old, id] of idMap) {
      const wall = next.layout.objects.find((o) => o.id === id);
      if (wall?.kind === "wall") {
        for (const o of data.layout!.objects.filter(
          (o) => o.wallId === old && !ids.includes(o.id),
        )) {
          next.layout.objects.push({ ...o, id: uid(), wallId: id });
        }
      }
    }
    next.layout = syncOpenings({
      ...next.layout,
      objects: next.layout.objects.map((o) =>
        newIds.includes(o.id) && o.wallId && idMap.has(o.wallId)
          ? { ...o, wallId: idMap.get(o.wallId) }
          : o,
      ),
    });
  }
  validate(next);
  return { data: next, ids: newIds };
}
export function removeEntities(data: Data, ids: string[]): Data {
  const removed = data.racks.filter((r) => ids.includes(r.id));
  if (
    removed.some((r) =>
      r.slots.some((s) => data.stock.some((b) => b.slotId === s.id)),
    )
  )
    throw Error(
      "Belegte Lagerplätze können nicht gelöscht werden. Bitte Materialien zuerst umlagern.",
    );
  if (entities(data).some((o) => ids.includes(o.id) && o.locked))
    throw Error("Gesperrte Objekte zuerst entsperren.");
  const next = {
    ...data,
    racks: data.racks.filter((r) => !ids.includes(r.id)),
    layout: data.layout
      ? {
          ...data.layout,
          objects: data.layout.objects.filter(
            (o) => !ids.includes(o.id) && !ids.includes(o.wallId || ""),
          ),
        }
      : undefined,
  };
  validate(next);
  return next;
}
export function transformEntities(
  data: Data,
  ids: string[],
  dx: number,
  dz: number,
  angle = 0,
  center?: Point,
): Data {
  const chosen = entities(data).filter((o) => ids.includes(o.id));
  const c = center || {
    x: chosen.reduce((s, o) => s + o.x, 0) / Math.max(1, chosen.length),
    z: chosen.reduce((s, o) => s + o.z, 0) / Math.max(1, chosen.length),
  };
  const edit = <T extends Entity>(o: T): T => {
    if (!ids.includes(o.id) || o.locked) return o;
    const p = toWorld(
      { x: c.x, z: c.z, rotation: angle },
      { x: o.x - c.x, z: o.z - c.z },
    );
    return {
      ...o,
      x: Math.round((p.x + dx) * 1000) / 1000,
      z: Math.round((p.z + dz) * 1000) / 1000,
      rotation: (((o.rotation + angle) % 360) + 360) % 360,
    };
  };
  const layout = data.layout
    ? syncOpenings({
        ...data.layout,
        objects: data.layout.objects.map(edit).map((o) => {
          if (ids.includes(o.id) && isOpening(o.kind) && o.wallId) {
            const wall = data
              .layout!.objects.map(edit)
              .find((w) => w.id === o.wallId);
            if (wall) return attachOpening(o, wall, { x: o.x, z: o.z });
          }
          return o;
        }),
      })
    : undefined;
  const next = { ...data, racks: data.racks.map(edit), layout };
  validate(next);
  return next;
}
export function exampleHallData(): Data {
  let data: Data = {
    version: 1,
    racks: [],
    materials: [],
    stock: [],
    layout: emptyLayout(),
  };
  const h = makeHall("DEMO", "Beispielhalle · Bauen", 24, 18);
  h.height = 5.5;
  data.layout!.halls.push(h);
  data.layout!.objects = wallsFor(h);
  const placements: [RackKind, number, number][] = [
    ["palletRack", -6, -5],
    ["shelfRack", -6, 0],
    ["slidingRack", 2, -4],
    ["cabinet", 8, 3],
  ];
  for (const [kind, x, z] of placements)
    data.racks.push(makeRack(kind, h, data, x, z));
  const front = data.layout!.objects[1];
  data.layout!.objects.push(
    attachOpening(makeObject("gate", h), front, { x: -7, z: 9 }),
    attachOpening(makeObject("exit", h), front, { x: 7, z: 9 }),
  );
  const add = (kind: ObjectKind, x: number, z: number) => {
    const o = makeObject(kind, h, x, z);
    data.layout!.objects.push(o);
    return o;
  };
  const foot = add("footpath", 0, 4);
  foot.points = [
    { x: -10, z: 0 },
    { x: 0, z: 0 },
    { x: 8, z: 2 },
  ];
  const road = add("forkliftPath", 0, 0);
  road.points = [
    { x: -10, z: 7.3 },
    { x: -1, z: 7.3 },
    { x: -1, z: 1.1 },
    { x: 8, z: 1.1 },
  ];
  const park = add("parking", 7, -6);
  park.name = "Staplerstellplatz";
  add("forklift", 7, -6);
  add("inbound", -7, 6);
  add("packingTable", -7, 2.4);
  add("crossing", 0, 4);
  add("pallet", -7, 5.2);
  add("crate", -5.7, 5.2);
  for (let i = 0; i < 4; i++) {
    const r = data.racks[i],
      m = {
        id: uid(),
        number: i === 2 ? "DEMO-0087050842" : `BAU-000${i + 1}`,
        name: `Beispielmaterial ${i + 1} · ${part(r.kind!).name}`,
        description: "Fiktive Beispieldaten für den Baumodus.",
      };
    data.materials.push(m);
    data.stock.push({
      id: uid(),
      materialId: m.id,
      slotId: r.slots[i === 2 ? 41 : 0].id,
      quantity: (i + 1) * 12,
    });
  }
  return validate(data);
}
export function sceneBounds(
  data: Data,
  spread = false,
  hidden: string[] = [],
  offsets: Record<string, number> = {},
) {
  const rb = data.racks.length
    ? boundsFor(data.racks, spread, hidden, offsets)
    : null;
  const points: Point[] = [];
  for (const h of data.layout?.halls || [])
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        points.push({ x: h.x + (x * h.width) / 2, z: h.z + (z * h.depth) / 2 });
  for (const o of data.layout?.objects || []) points.push(...entityPoints(o));
  if (rb) points.push({ x: rb.minX, z: rb.minZ }, { x: rb.maxX, z: rb.maxZ });
  if (!points.length) return boundsFor([]);
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
    minY: 0,
    maxY: Math.max(
      rb?.maxY || 0,
      ...(data.layout?.halls.map((h) => h.height) || [3]),
    ),
  };
}
