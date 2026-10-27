import { describe, it, expect } from "vitest";
import { example } from "./model";
import {
  loadStore,
  STORE_KEY,
  LEGACY_KEY,
  updateWarehouse,
  validateStore,
  warehouse,
  type Store,
} from "./storage";
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}
describe("Lagerverwaltung und Migration", () => {
  it("übernimmt alle bisherigen Daten und IDs unverändert und erhält die Original-Sicherung", () => {
    const legacy = example();
    legacy.stock[0].quantity = 713;
    const raw = JSON.stringify(legacy),
      storage = memory({ [LEGACY_KEY]: raw }),
      result = loadStore(storage);
    expect(result.blocked).toBe(false);
    expect(result.store.warehouses[0].data).toEqual(legacy);
    expect(result.store.warehouses[0].name).toBe("Mein Lager");
    expect(storage.getItem(LEGACY_KEY)).toBe(raw);
    expect(result.store.warehouses).toHaveLength(3);
    expect(result.store.warehouses[1].data.materials[0].number).toBe(
      "TEST-0001",
    );
    expect(JSON.parse(storage.getItem(STORE_KEY)!)).toEqual(result.store);
  });
  it("hält Bestandsänderungen und Gebäude auf das gewählte Lager begrenzt", () => {
    const { store } = loadStore(memory()),
      [first, second] = store.warehouses;
    const next = structuredClone(first.data);
    next.stock[0].quantity = 22;
    next.racks[0].building = "99";
    const updated = updateWarehouse(store, first.id, next);
    expect(updated.warehouses[1]).toEqual(second);
    expect(updated.warehouses[0].buildings).toContain("99");
    expect(store.warehouses[0].data.stock[0].quantity).not.toBe(22);
    expect(updated.warehouses[1].buildings).toEqual(["77"]);
  });
  it("erhält das zuletzt gewählte Lager und fügt bei Neuladen kein weiteres Testlager hinzu", () => {
    const storage = memory(),
      s = loadStore(storage).store;
    s.activeId = s.warehouses[1].id;
    storage.setItem(STORE_KEY, JSON.stringify(s));
    expect(loadStore(storage).store).toEqual(s);
  });
  it("sperrt Änderungen bei beschädigten Daten, ohne diese zu überschreiben", () => {
    const raw = '{"version":2,"broken":true}',
      storage = memory({ [STORE_KEY]: raw, [LEGACY_KEY]: "original" });
    expect(loadStore(storage).blocked).toBe(true);
    expect(storage.getItem(STORE_KEY)).toBe(raw);
    expect(storage.getItem(LEGACY_KEY)).toBe("original");
  });
  it("weist ungültige Lagerreferenzen ab und erlaubt ein neues leeres Lager", () => {
    const w = warehouse("Neues Lager"),
      s: Store = { version: 2, activeId: w.id, warehouses: [w] };
    expect(validateStore(s)).toBe(s);
    expect(() => validateStore({ ...s, activeId: "unbekannt" })).toThrow(
      "ausgewählte Lager",
    );
    expect(() => updateWarehouse(s, "unbekannt", example())).toThrow(
      "nicht gefunden",
    );
  });
});

it("sichert einen vorhandenen Version-2-Bestand vor dem Ergänzen der separaten Beispielhalle", () => {
  const first = warehouse("Bestand", example()),
    old = { version: 2, activeId: first.id, warehouses: [first] },
    raw = JSON.stringify(old),
    storage = memory({ [STORE_KEY]: raw });
  const result = loadStore(storage);
  expect(result.blocked).toBe(false);
  expect(result.store.activeId).toBe(first.id);
  expect(result.store.warehouses[0]).toEqual(first);
  expect(result.store.warehouses).toHaveLength(2);
  expect(storage.getItem("lagerraum-v2-vor-baumodus")).toBe(raw);
  expect(loadStore(storage).store.warehouses).toHaveLength(2);
  expect(storage.getItem("lagerraum-v2-vor-baumodus")).toBe(raw);
});
