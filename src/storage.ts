import { exampleHallData } from "./builder";
import { type Data, example, uid, validate, rebuild } from "./model";
export const STORE_KEY = "lagerraum-v2";
export const LEGACY_KEY = "lagerraum-v1";
export type Warehouse = {
  revision?: number;
  id: string;
  name: string;
  buildings: string[];
  data: Data;
};
export type Store = {
  version: 2;
  activeId: string;
  warehouses: Warehouse[];
  builderExampleAdded?: boolean;
};
export const BUILDER_BACKUP_KEY = "lagerraum-v2-vor-baumodus";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export const emptyData = (): Data => ({
  version: 1,
  racks: [],
  materials: [],
  stock: [],
});
export function warehouse(name: string, data = emptyData()): Warehouse {
  return {
    id: uid(),
    name: name.trim(),
    buildings: [
      ...new Set([
        ...data.racks.map((r) => r.building),
        ...(data.layout?.halls.map((h) => h.building) || []),
      ]),
    ],
    data,
  };
}
export function testWarehouse(): Warehouse {
  const data = emptyData();
  const area = { id: uid(), name: "Vorne", prefix: "V", columns: 4, levels: 3 };
  const rack = rebuild(
    {
      id: uid(),
      name: "Testregal A",
      number: "1",
      building: "77",
      width: 3,
      height: 2.4,
      depth: 1,
      x: 0,
      z: 0,
      rotation: 0,
      areas: [area],
      slots: [],
    },
    [],
  );
  const material = {
    id: uid(),
    number: "TEST-0001",
    name: "Testmaterial · Zweites Lager",
    description: "Separates Testlager zum Ausprobieren des Lagerwechsels.",
  };
  data.racks.push(rack);
  data.materials.push(material);
  data.stock.push({
    id: uid(),
    materialId: material.id,
    slotId: rack.slots[0].id,
    quantity: 12,
  });
  return warehouse("Testlager · Beispiel", data);
}
export function validateStore(value: unknown): Store {
  const s = value as Store;
  if (
    !s ||
    s.version !== 2 ||
    !Array.isArray(s.warehouses) ||
    s.warehouses.length < 1 ||
    s.warehouses.length > 100
  )
    throw Error("Ungültige Lagerverwaltung (Version 2 erwartet).");
  if (
    s.builderExampleAdded !== undefined &&
    typeof s.builderExampleAdded !== "boolean"
  )
    throw Error("Ungültiger Migrationsstatus.");
  const ids = new Set<string>();
  for (const w of s.warehouses) {
    if (
      !w ||
      typeof w.id !== "string" ||
      !w.id ||
      ids.has(w.id) ||
      typeof w.name !== "string" ||
      !w.name.trim()
    )
      throw Error("Lagernamen oder Lager-IDs sind ungültig.");
    ids.add(w.id);
    validate(w.data);
    if (
      !Array.isArray(w.buildings) ||
      w.buildings.some((b) => typeof b !== "string" || !b.trim()) ||
      new Set(w.buildings).size !== w.buildings.length ||
      w.data.racks.some((r) => !w.buildings.includes(r.building)) ||
      w.data.layout?.halls.some((h) => !w.buildings.includes(h.building))
    )
      throw Error("Gebäudezuordnung ist ungültig.");
  }
  if (!ids.has(s.activeId)) throw Error("Das ausgewählte Lager fehlt.");
  return s;
}
export function loadStore(storage: StorageLike): {
  store: Store;
  error: string;
  blocked: boolean;
} {
  let fallback: Store | undefined;
  try {
    const raw = storage.getItem(STORE_KEY);
    if (raw !== null) {
      const original = validateStore(JSON.parse(raw));
      fallback = original;
      if (original.builderExampleAdded)
        return { store: original, error: "", blocked: false };
      const next = validateStore({
        ...original,
        builderExampleAdded: true,
        warehouses: [
          ...original.warehouses,
          warehouse("Beispielhalle · Bauen", exampleHallData()),
        ],
      });
      if (storage.getItem(BUILDER_BACKUP_KEY) === null)
        storage.setItem(BUILDER_BACKUP_KEY, raw);
      storage.setItem(STORE_KEY, JSON.stringify(next));
      return { store: next, error: "", blocked: false };
    }
    const legacy = storage.getItem(LEGACY_KEY);
    const first = warehouse(
      "Mein Lager",
      legacy !== null ? validate(JSON.parse(legacy)) : example(),
    );
    const store: Store = {
      version: 2,
      activeId: first.id,
      warehouses: [
        first,
        testWarehouse(),
        warehouse("Beispielhalle · Bauen", exampleHallData()),
      ],
      builderExampleAdded: true,
    };
    fallback = store;
    // Never overwrite or remove the legacy key: it remains a complete migration backup.
    storage.setItem(STORE_KEY, JSON.stringify(store));
    return { store, error: "", blocked: false };
  } catch {
    const first = warehouse("Wiederherstellung · nicht gespeichert");
    return {
      store: fallback || {
        version: 2,
        activeId: first.id,
        warehouses: [first],
      },
      error:
        "Browserdaten konnten nicht sicher gelesen oder gespeichert werden. Sie bleiben unverändert. Änderungen sind gesperrt; bitte zuerst die Originaldaten sichern und eine gültige Sicherung importieren.",
      blocked: true,
    };
  }
}
export function updateWarehouse(store: Store, id: string, data: Data): Store {
  validate(data);
  if (!store.warehouses.some((w) => w.id === id))
    throw Error("Das Lager wurde nicht gefunden.");
  return validateStore({
    ...store,
    warehouses: store.warehouses.map((w) =>
      w.id === id
        ? {
            ...w,
            data,
            buildings: [
              ...new Set([
                ...w.buildings,
                ...data.racks.map((r) => r.building),
                ...(data.layout?.halls.map((h) => h.building) || []),
              ]),
            ],
          }
        : w,
    ),
  });
}
