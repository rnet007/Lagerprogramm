import { describe, it, expect } from "vitest";
import { example, validate, code, rebuild, transfer, uid } from "./model";
describe("Lagerdaten", () => {
  it("erzeugt die Testaufteilung und erhält führende Nullen", () => {
    const d = example();
    expect(validate(d)).toBe(d);
    const r = d.racks[2];
    expect(r.slots).toHaveLength(240);
    expect(
      r.areas.map((a) => r.slots.filter((s) => s.areaId === a.id).length),
    ).toEqual([100, 70, 70]);
    expect(code(r, r.slots[41])).toBe("55R3H42");
    expect(d.materials[0].number).toBe("0087050842");
    expect(
      d.stock.some((b) => d.racks[1].slots.some((s) => s.id === b.slotId)),
    ).toBe(false);
  });
  it("erhält IDs bei Umbenennung und verhindert das Entfernen belegter Fächer", () => {
    const d = example(),
      r = d.racks[0];
    expect(
      rebuild({ ...r, name: "Umbenannt" }, d.stock, r).slots.map((s) => s.id),
    ).toEqual(r.slots.map((s) => s.id));
    expect(() =>
      rebuild(
        { ...r, areas: r.areas.map((a) => ({ ...a, columns: 1, levels: 1 })) },
        d.stock,
        r,
      ),
    ).toThrow("belegte Fächer");
  });
  it("erhält bewusst entfernte leere Fächer bei einer Bearbeitung", () => {
    const d = example(),
      r = d.racks[1];
    r.slots = r.slots.slice(1);
    expect(rebuild({ ...r, name: "Neu" }, d.stock, r).slots).toHaveLength(29);
  });
  it("lagert Teilmengen ohne Bestandsverlust um", () => {
    const d = example(),
      b = d.stock[0],
      target = d.racks[1].slots[0].id,
      n = transfer(d, b.id, target, 3);
    expect(n.stock.find((s) => s.id === b.id)?.quantity).toBe(b.quantity - 3);
    expect(n.stock.find((s) => s.slotId === target)?.quantity).toBe(3);
    expect(n.stock.reduce((n, b) => n + b.quantity, 0)).toBe(
      d.stock.reduce((n, b) => n + b.quantity, 0),
    );
    expect(() => transfer(d, b.id, target, -2)).toThrow();
    expect(() => transfer(d, b.id, target, b.quantity + 1)).toThrow();
  });
  it("prüft JSON-Roundtrip und ungültige Bestandsverweise", () => {
    const d = example();
    expect(validate(JSON.parse(JSON.stringify(d)))).toEqual(d);
    d.stock[0].slotId = uid();
    expect(() => validate(d)).toThrow("unbekannte Daten");
  });
  it("akzeptiert leere Lager und verhindert doppelte Lagerplatzcodes", () => {
    const d = example();
    const r = rebuild(
      {
        ...d.racks[0],
        id: uid(),
        areas: d.racks[0].areas.map((a) => ({ ...a, id: uid() })),
        slots: [],
      },
      [],
    );
    expect(() => validate({ ...d, racks: [...d.racks, r] })).toThrow(
      "eindeutig",
    );
    expect(
      validate({ version: 1, racks: [], materials: [], stock: [] }),
    ).toBeTruthy();
  });
});
