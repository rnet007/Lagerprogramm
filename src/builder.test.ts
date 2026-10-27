import { describe, it, expect } from "vitest";
import { validate, example, code } from "./model";
import {
  PARTS,
  makeHall,
  wallsFor,
  makeObject,
  makeRack,
  attachOpening,
  wallSegments,
  exampleHallData,
  duplicateEntities,
  removeEntities,
  transformEntities,
  warnings,
  emptyLayout,
  ensureLayout,
  sceneBounds,
  rackKind,
} from "./builder";
import type { Data } from "./model";
import type { ObjectKind, RackKind } from "./builderTypes";
import { slotPosition } from "./layout";
function base() {
  const hall = makeHall("1", "Prüfhalle");
  const data: Data = {
    version: 1,
    racks: [],
    materials: [],
    stock: [],
    layout: { version: 1, halls: [hall], objects: wallsFor(hall) },
  };
  return { hall, data };
}
describe("Baumodus", () => {
  it("legt alle angebotenen Bauteile als validierbare reale Datentypen an", () => {
    const { data, hall } = base();
    for (const p of PARTS) {
      if (rackKind(p.kind))
        data.racks.push(makeRack(p.kind as RackKind, hall, data));
      else {
        let o = makeObject(p.kind as ObjectKind, hall);
        if (["door", "exit", "emergencyExit", "gate"].includes(p.kind))
          o = attachOpening(o, data.layout!.objects[1], {
            x: 0,
            z: hall.depth / 2,
          });
        data.layout!.objects.push(o);
      }
    }
    expect(validate(data)).toBe(data);
    expect(PARTS.length).toBe(28);
    expect(data.racks).toHaveLength(6);
    expect(
      new Set(data.racks.flatMap((r) => r.slots.map((s) => code(r, s)))).size,
    ).toBe(data.racks.reduce((n, r) => n + r.slots.length, 0));
  });
  it("bildet tatsächliche Wandöffnungen mit einem Sturz statt geschlossener Wand", () => {
    const { hall } = base(),
      wall = { ...makeObject("wall", hall), width: 10, height: 3 },
      door = attachOpening(
        { ...makeObject("door", hall), width: 2, height: 2.2 },
        wall,
        { x: 0, z: 0 },
      ),
      segments = wallSegments(wall, [door]);
    expect(segments.map((s) => [s.width, s.bottom, s.height])).toEqual([
      [4, 0, 3],
      [2, 2.2, 0.7999999999999998],
      [4, 0, 3],
    ]);
    expect(segments.some((s) => Math.abs(s.x) < 0.5 && s.bottom === 0)).toBe(
      false,
    );
  });
  it("verschiebt eine Wand mit Öffnungen und verschiebt eine Tür längs ihrer Wand", () => {
    const { hall, data } = base();
    const wall = data.layout!.objects[1],
      door = attachOpening(makeObject("door", hall), wall, {
        x: 0,
        z: hall.depth / 2,
      });
    data.layout!.objects.push(door);
    const moved = transformEntities(data, [wall.id], 2, 0);
    expect(moved.layout!.objects.find((o) => o.id === door.id)?.x).toBeCloseTo(
      2,
    );
    const slide = transformEntities(data, [door.id], 1, 0);
    expect(
      slide.layout!.objects.find((o) => o.id === door.id)?.offset,
    ).toBeCloseTo(1);
    expect(slide.layout!.objects.find((o) => o.id === door.id)?.x).toBeCloseTo(
      1,
    );
  });
  it("dupliziert die Regalstruktur mit neuen IDs/Codes, aber ohne Bestände", () => {
    const d = exampleHallData(),
      r = d.racks[2],
      n = duplicateEntities(d, [r.id]),
      copy = n.data.racks.at(-1)!;
    expect(copy.kind).toBe("slidingRack");
    expect(copy.slots).toHaveLength(240);
    expect(copy.areas.map((a) => [a.columns, a.levels])).toEqual(
      r.areas.map((a) => [a.columns, a.levels]),
    );
    expect(copy.slots.every((s) => !r.slots.some((o) => o.id === s.id))).toBe(
      true,
    );
    expect(
      copy.slots.every((s) => !n.data.stock.some((b) => b.slotId === s.id)),
    ).toBe(true);
    expect(n.data.stock).toEqual(d.stock);
    expect(validate(n.data)).toBe(n.data);
  });
  it("schützt belegte und gesperrte Objekte beim Löschen", () => {
    const d = exampleHallData();
    expect(() => removeEntities(d, [d.racks[0].id])).toThrow(
      "Belegte Lagerplätze",
    );
    const o = d.layout!.objects.find((o) => o.kind === "packingTable")!;
    o.locked = true;
    expect(() => removeEntities(d, [o.id])).toThrow("Gesperrte");
    expect(
      transformEntities(d, [o.id], 3, 2).layout!.objects.find(
        (v) => v.id === o.id,
      ),
    ).toEqual(o);
  });
  it("erlaubt Stapler auf passendem Stellplatz, warnt aber vor blockierten Wegen und Hallengrenzen", () => {
    const { hall, data } = base();
    data.layout!.objects = [];
    const parking = makeObject("parking", hall),
      fork = makeObject("forklift", hall);
    data.layout!.objects = [parking, fork];
    expect(warnings(data)).toEqual([]);
    const rack = makeRack("shelfRack", hall, data);
    data.racks = [rack];
    data.layout!.objects = [makeObject("footpath", hall)];
    expect(warnings(data).some((w) => w.text.includes("Überschneidung"))).toBe(
      true,
    );
    data.racks = [{ ...rack, x: 30 }];
    expect(warnings(data).some((w) => w.text.includes("außerhalb"))).toBe(true);
  });
  it("berücksichtigt Wandöffnungen bei der Kollisionsprüfung nach Höhe", () => {
    const { data, hall } = base(),
      wall = data.layout!.objects[1];
    data.layout!.objects.push(
      attachOpening(
        { ...makeObject("door", hall), width: 2, height: 2.2 },
        wall,
        { x: 0, z: hall.depth / 2 },
      ),
    );
    const box = {
      ...makeObject("crate", hall, 0, hall.depth / 2 - 0.2),
      width: 0.5,
      depth: 0.5,
      height: 1,
    };
    data.layout!.objects.push(box);
    expect(
      warnings(data).some(
        (w) => w.ids.includes(wall.id) && w.ids.includes(box.id),
      ),
    ).toBe(false);
    box.height = 3;
    expect(
      warnings(data).some(
        (w) => w.ids.includes(wall.id) && w.ids.includes(box.id),
      ),
    ).toBe(true);
  });
  it("ändert beim visuellen Segmentverschieben keine Lagerplätze oder Belegungen", () => {
    const d = exampleHallData(),
      raw = JSON.stringify(d),
      r = d.racks[2],
      s = r.slots[41],
      before = slotPosition(r, s, false),
      after = slotPosition(r, s, false, { [s.areaId]: 2 });
    expect(after[0] - before[0]).toBeCloseTo(2);
    expect(after[2]).toBe(before[2]);
    expect(JSON.stringify(d)).toBe(raw);
  });
  it("ergänzt einen Hallenumriss im Bestand ohne Verlust von Materialreferenzen", () => {
    const old = example(),
      copy = ensureLayout(old);
    expect(copy.stock).toEqual(old.stock);
    expect(copy.materials).toEqual(old.materials);
    expect(copy.racks.map((r) => r.slots)).toEqual(
      old.racks.map((r) => r.slots),
    );
    expect(old.layout).toBeUndefined();
    expect(validate(copy)).toBe(copy);
    const bounds = sceneBounds(exampleHallData());
    expect(bounds.minX).toBeLessThanOrEqual(-12);
    expect(bounds.maxZ).toBeGreaterThanOrEqual(9);
  });
  it("weist beschädigte Hallen- und Bauteilreferenzen beim Import ab", () => {
    const d = exampleHallData();
    d.layout!.objects[0].hallId = "fehlt";
    expect(() => validate(d)).toThrow("Halle");
  });
});

it("liefert eine vollständige Beispielhalle ohne unbeabsichtigte Überschneidungen", () => {
  const d = exampleHallData();
  expect(d.racks.map((r) => r.kind)).toEqual([
    "palletRack",
    "shelfRack",
    "slidingRack",
    "cabinet",
  ]);
  for (const kind of [
    "gate",
    "exit",
    "footpath",
    "forkliftPath",
    "parking",
    "forklift",
    "inbound",
    "packingTable",
  ])
    expect(d.layout!.objects.some((o) => o.kind === kind)).toBe(true);
  expect(warnings(d)).toEqual([]);
});

it("dupliziert eine Wandöffnung an einen freien Wandabschnitt mit neuer ID", () => {
  const { hall, data } = base(),
    wall = data.layout!.objects[1],
    door = attachOpening(makeObject("door", hall), wall, {
      x: 0,
      z: hall.depth / 2,
    });
  data.layout!.objects.push(door);
  const result = duplicateEntities(data, [door.id]),
    copy = result.data.layout!.objects.find((o) => o.id === result.ids[0])!;
  expect(copy.wallId).toBe(wall.id);
  expect(copy.offset).not.toBe(door.offset);
  expect(copy.id).not.toBe(door.id);
  expect(validate(result.data)).toBe(result.data);
});
