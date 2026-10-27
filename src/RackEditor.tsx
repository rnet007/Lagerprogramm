import {
  useState,
  useMemo,
  Suspense,
  lazy,
  useId,
  type ReactNode,
  isValidElement,
  cloneElement,
  type ReactElement,
} from "react";
import { Plus, Trash2 } from "lucide-react";
import { type Rack, type Stock, type Slot, uid, rebuild, code } from "./model";
const Scene = lazy(() => import("./Scene"));
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}
export default function RackEditor({
  rack,
  onClose,
  onSave,
  stock,
  buildings,
}: {
  rack?: Rack;
  onClose: () => void;
  onSave: (r: Rack) => void;
  stock: Stock[];
  buildings: string[];
}) {
  const [r, setR] = useState<Rack>(() =>
    rack
      ? structuredClone(rack)
      : {
          id: uid(),
          name: "",
          number: "",
          building: buildings[0] || "1",
          width: 4,
          height: 3,
          depth: 1,
          x: 0,
          z: 5,
          rotation: 0,
          areas: [
            { id: uid(), name: "Vorne", prefix: "V", columns: 6, levels: 5 },
          ],
          slots: [],
        },
  );
  const [error, setError] = useState(""),
    [view, setView] = useState("3d"),
    [picked, setPicked] = useState(""),
    [removed, setRemoved] = useState<string[]>([]),
    [spread, setSpread] = useState(false);
  const change = (key: string, value: unknown) => {
    setError("");
    setR({ ...r, [key]: value });
  };
  const preview = useMemo(() => {
    const clamp = (v: number, min: number, max: number) =>
      Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
    const next = rebuild(
      {
        ...r,
        name: r.name || "Neues Regal",
        number: r.number || "?",
        building: r.building || "?",
        width: clamp(r.width, 0.1, 100),
        height: clamp(r.height, 0.1, 100),
        depth: clamp(r.depth, 0.1, 100),
        areas: r.areas.map((a) => ({
          ...a,
          columns: Math.round(clamp(a.columns, 1, 20)),
          levels: Math.round(clamp(a.levels, 1, 20)),
        })),
      },
      [],
      rack,
    );
    return {
      ...next,
      slots: next.slots.filter(
        (s) => !removed.includes(s.areaId + ":" + s.number),
      ),
    };
  }, [r, removed, rack]);
  const slot = preview.slots.find((s) => s.id === picked);
  function remove(s: Slot) {
    if (stock.some((b) => b.slotId === s.id)) {
      setError(
        "Dieses Fach ist belegt. Bitte zuerst die Materialien umlagern.",
      );
      return;
    }
    setRemoved([...removed, s.areaId + ":" + s.number]);
    setR({ ...r, slots: r.slots.filter((v) => v.id !== s.id) });
    setPicked("");
  }
  return (
    <form
      className="rack-editor"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const next = rebuild(r, stock, rack);
          next.slots = next.slots.filter(
            (s) => !removed.includes(s.areaId + ":" + s.number),
          );
          if (
            rack?.slots.some(
              (s) =>
                !next.slots.some((v) => v.id === s.id) &&
                stock.some((b) => b.slotId === s.id),
            )
          )
            throw Error(
              "Die Änderung würde belegte Fächer entfernen. Bitte zuerst umlagern.",
            );
          onSave(next);
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <div className="eyebrow">LAGERSTRUKTUR</div>
      <h2>{rack ? "Regal bearbeiten" : "Regal hinzufügen"}</h2>
      <p>
        Änderungen bleiben in der Vorschau, bis Sie speichern. Maße in Metern.
      </p>
      <div className="editor-columns">
        <div className="editor-fields">
          <div className="form-grid">
            {(["name", "number", "building"] as const).map((k, i) => (
              <Field key={k} label={["Regalname", "Regalnummer", "Gebäude"][i]}>
                <input
                  required
                  list={k === "building" ? "warehouse-buildings" : undefined}
                  value={r[k]}
                  onChange={(e) => change(k, e.target.value)}
                />
              </Field>
            ))}
            <datalist id="warehouse-buildings">
              {buildings.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            {(["width", "height", "depth", "x", "z", "rotation"] as const).map(
              (k, i) => (
                <Field
                  key={k}
                  label={
                    [
                      "Breite (m)",
                      "Höhe (m)",
                      "Tiefe (m)",
                      "Position X (m)",
                      "Position Z (m)",
                      "Drehung (°)",
                    ][i]
                  }
                >
                  <input
                    required
                    type="number"
                    step="any"
                    min={i < 3 ? 0.1 : -1000}
                    max={i < 3 ? 100 : 1000}
                    value={r[k]}
                    onChange={(e) => change(k, Number(e.target.value))}
                  />
                </Field>
              ),
            )}
          </div>
          <h3>Bereiche & Unterteilung</h3>
          {r.areas.map((a, i) => (
            <fieldset className="area-editor" key={a.id}>
              <legend>Bereich {i + 1}</legend>
              <div className="area-form">
                <Field label={`Name Bereich ${i + 1}`}>
                  <input
                    required
                    value={a.name}
                    onChange={(e) =>
                      change(
                        "areas",
                        r.areas.map((v) =>
                          v.id === a.id ? { ...v, name: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label={`Code-Kürzel Bereich ${i + 1}`}>
                  <input
                    required
                    value={a.prefix}
                    onChange={(e) =>
                      change(
                        "areas",
                        r.areas.map((v) =>
                          v.id === a.id ? { ...v, prefix: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                {(["columns", "levels"] as const).map((k, j) => (
                  <Field
                    key={k}
                    label={`${j ? "Ebenen" : "Spalten"} Bereich ${i + 1}`}
                  >
                    <input
                      required
                      type="number"
                      min="1"
                      max="20"
                      value={a[k]}
                      onChange={(e) =>
                        change(
                          "areas",
                          r.areas.map((v) =>
                            v.id === a.id
                              ? { ...v, [k]: Number(e.target.value), ...(k==='columns' && v.segmentNames ? {segmentNames:Array.from({length:Math.max(1,Math.min(20,Math.round(Number(e.target.value)||1)))},(_,i)=>v.segmentNames?.[i] || `Segment ${i+1}`)} : {}) }
                              : v,
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
                <button
                  type="button"
                  title="Bereich entfernen (erst nach Speichern)"
                  aria-label={`Bereich ${i + 1} entfernen`}
                  disabled={r.areas.length === 1}
                  onClick={() =>
                    change(
                      "areas",
                      r.areas.filter((v) => v.id !== a.id),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={r.areas.length >= 10}
            onClick={() =>
              change("areas", [
                ...r.areas,
                {
                  id: uid(),
                  name: "Neuer Bereich",
                  prefix: `B${r.areas.length + 1}`,
                  columns: 5,
                  levels: 5,
                },
              ])
            }
          >
            <Plus size={15} /> Bereich hinzufügen
          </button>
        </div>
        <div className="draft-preview">
          <div className="preview-heading">
            <b>Vorschau · ungespeichert</b>
            <div className="tabs">
              <button
                type="button"
                className={view === "3d" ? "selected" : ""}
                onClick={() => setView("3d")}
              >
                Vorschau 3D
              </button>
              <button
                type="button"
                className={view === "2d" ? "selected" : ""}
                onClick={() => setView("2d")}
              >
                Vorschau 2D
              </button>
            </div>
          </div>
          <div className="preview-summary" data-testid="preview-summary">
            {preview.width} × {preview.height} × {preview.depth} m ·{" "}
            {preview.slots.length} Fächer
          </div>
          <div className="preview-stage">
            {view === "3d" ? (
              <Suspense
                fallback={<div className="empty">Vorschau wird geladen …</div>}
              >
                <Scene
                  data={{
                    version: 1,
                    racks: [{ ...preview, x: 0, z: 0 }],
                    materials: [],
                    stock,
                  }}
                  selected={picked}
                  onSelect={(_, s) => setPicked(s.id)}
                  spread={spread}
                  reset={0}
                  preview
                />
              </Suspense>
            ) : (
              <div className="preview-raster">
                {preview.areas.map((a) => (
                  <section key={a.id}>
                    <b>
                      {a.name} · {a.columns} × {a.levels}
                    </b>
                    <div
                      className="slots-grid"
                      style={{
                        gridTemplateColumns: `repeat(${a.columns},minmax(25px,1fr))`,
                      }}
                    >
                      {Array.from({ length: a.columns * a.levels }, (_, i) => {
                        const n =
                            (a.levels - 1 - Math.floor(i / a.columns)) *
                              a.columns +
                            (i % a.columns) +
                            1,
                          s = preview.slots.find(
                            (s) => s.areaId === a.id && s.number === n,
                          );
                        return s ? (
                          <button
                            type="button"
                            key={n}
                            className={`${picked === s.id ? "chosen" : ""} ${stock.some((b) => b.slotId === s.id) ? "occupied" : ""}`}
                            onClick={() => setPicked(s.id)}
                            title={code(preview, s)}
                          >
                            {s.number}
                          </button>
                        ) : (
                          <span key={n}>—</span>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
          {r.areas.length > 1 && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={spread}
                onChange={(e) => setSpread(e.target.checked)}
              />{" "}
              Vorschau auseinanderziehen
            </label>
          )}
          {slot ? (
            <div className="preview-slot">
              <b>Fach {code(preview, slot)}</b>
              <Field label="Fachcode in der Vorschau">
                <input
                  value={slot.name || code(preview, slot)}
                  onChange={(e) =>
                    setR({
                      ...r,
                      slots: preview.slots.map((s) =>
                        s.id === slot.id ? { ...s, name: e.target.value } : s,
                      ),
                    })
                  }
                />
              </Field>
              <button type="button" onClick={() => remove(slot)}>
                <Trash2 size={14} /> Fach aus Entwurf entfernen
              </button>
            </div>
          ) : (
            <p className="preview-help">
              Ein Fach anklicken, um seinen Code zu bearbeiten. Belegte Fächer
              bleiben geschützt.
            </p>
          )}
          <small className="schematic-note">
            Schematisches Modell · Maße und Konstruktion vor Ort prüfen.
          </small>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions form-actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button className="primary" type="submit">
          Regal speichern
        </button>
      </div>
    </form>
  );
}
