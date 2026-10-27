import SegmentControls from "./SegmentControls";
import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import {
  MousePointer2,
  Move,
  RotateCw,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Lock,
  Unlock,
  Plus,
  Boxes,
  X,
  Eye,
  Grid2X2,
  Layers3,
} from "lucide-react";
import {
  type Data,
  type Rack,
  type Slot,
  code,
  validate,
  rebuild,
} from "./model";
import {
  type Hall,
  type SceneObject,
  type PartKind,
  type Point,
  isOpening,
  isPath,
  isMarking,
} from "./builderTypes";
import {
  PARTS,
  part,
  rackKind,
  ensureLayout,
  makeHall,
  wallsFor,
  makeRack,
  makeObject,
  entities,
  nearestWall,
  attachOpening,
  syncOpenings,
  duplicateEntities,
  removeEntities,
  transformEntities,
  warnings,
  toWorld,
  type Entity,
} from "./builder";
import type { BuildTool, BuildConfig } from "./sceneTypes";
import BuilderPlan from "./BuilderPlan";
import RackEditor from "./RackEditor";
const Scene = lazy(() => import("./Scene"));
type Props = {
  data: Data;
  onChange: (d: Data) => boolean;
  onOpenSlot: (r: Rack, s: Slot) => void;
};
export default function Builder({ data, onChange, onOpenSlot }: Props) {
  const initial = useMemo(() => ensureLayout(data), []),
    doc = data.layout ? data : initial,
    layout = doc.layout!;
  const [selected, setSelected] = useState<string[]>([]),
    [hallId, setHallId] = useState(layout.halls[0]?.id || ""),
    [kind, setKind] = useState<PartKind>(),
    [ghost, setGhost] = useState<Entity>(),
    [tool, setTool] = useState<BuildTool>("select"),
    [view, setView] = useState("3d"),
    [snap, setSnap] = useState(true),
    [step, setStep] = useState(0.5),
    [labels, setLabels] = useState(true),
    [wallMode, setWallMode] = useState<"cutaway" | "all" | "none">("cutaway"),
    [spread, setSpread] = useState(false),
    [hidden, setHidden] = useState<string[]>([]),
    [offsets, setOffsets] = useState<Record<string, number>>({}),
    [past, setPast] = useState<Data[]>([]),
    [future, setFuture] = useState<Data[]>([]),
    [message, setMessage] = useState(""),
    [modal, setModal] = useState<"hall" | "delete" | "rack" | null>(null),
    [pickedSlot, setPickedSlot] = useState(""),
    [reset, setReset] = useState(0);
  useEffect(() => {
    if (!data.layout) onChange(initial);
  }, []);
  const currentHall =
      layout.halls.find((h) => h.id === hallId) || layout.halls[0],
    selection = entities(doc).filter((o) => selected.includes(o.id)),
    hallSelection = layout.halls.find((h) => selected.includes(h.id)),
    single = selection.length === 1 ? selection[0] : undefined;
  const shown = useMemo(
    () => ({
      ...doc,
      racks: doc.racks.filter(
        (r) =>
          r.hallId === currentHall?.id ||
          (!r.hallId && r.building === currentHall?.building),
      ),
      layout: {
        ...layout,
        halls: layout.halls.filter((h) => h.id === currentHall?.id),
        objects: layout.objects.filter((o) => o.hallId === currentHall?.id),
      },
    }),
    [doc, currentHall?.id],
  );
  const notices = useMemo(() => warnings(doc), [doc]);
  function commit(next: Data, label = "Änderung gespeichert") {
    try {
      validate(next);
      if (JSON.stringify(next) === JSON.stringify(doc)) {
        setMessage("Keine Änderungen");
        return true;
      }
      if (onChange(next)) {
        setPast((p) => [...p.slice(-49), structuredClone(doc)]);
        setFuture([]);
        setMessage(label);
        return true;
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
    return false;
  }
  function undo() {
    const previous = past.at(-1);
    if (previous && onChange(previous)) {
      setPast((p) => p.slice(0, -1));
      setFuture((f) => [structuredClone(doc), ...f]);
      setSelected([]);
      setGhost(undefined);
      setKind(undefined);
      setPickedSlot("");
      setMessage("Rückgängig gemacht");
    }
  }
  function redo() {
    const next = future[0];
    if (next && onChange(next)) {
      setPast((p) => [...p, structuredClone(doc)]);
      setFuture((f) => f.slice(1));
      setSelected([]);
      setMessage("Wiederholt");
    }
  }
  function pick(id: string, shift = false) {
    if (kind) return;
    setPickedSlot("");
    setSelected((s) => {
      const current = s.filter((id) => entities(doc).some((o) => o.id === id));
      return shift
        ? current.includes(id)
          ? current.filter((v) => v !== id)
          : [...current, id]
        : [id];
    });
  }
  function snapped(p: Point) {
    return snap
      ? { x: Math.round(p.x / step) * step, z: Math.round(p.z / step) * step }
      : p;
  }
  const template = useRef<Entity | undefined>(undefined);
  function startPlacement(k: PartKind) {
    if (!currentHall) {
      setMessage("Bitte zuerst eine Halle anlegen.");
      setModal("hall");
      return;
    }
    setKind(k);
    setTool("select");
    setSelected([]);
    setPickedSlot("");
    const e = rackKind(k)
      ? makeRack(
          k as Rack["kind"] & string,
          currentHall,
          doc,
          currentHall.x,
          currentHall.z,
        )
      : makeObject(
          k as SceneObject["kind"],
          currentHall,
          currentHall.x,
          currentHall.z,
        );
    template.current = e;
    setGhost(isOpening(k) ? undefined : e);
    setMessage(`${part(k).name}: Boden anklicken, Escape bricht ab.`);
  }
  function candidate(p: Point) {
    const base = template.current;
    if (!base || !currentHall) return;
    const q = snapped(p);
    let e = { ...base, x: q.x, z: q.z };
    if ("kind" in e && isOpening(e.kind || "")) {
      const nearest = nearestWall(layout, currentHall.id, q);
      if (!nearest || nearest.d > 3) {
        return;
      }
      e = attachOpening(e as SceneObject, nearest.w, q);
    }
    return e;
  }
  function place(p: Point) {
    const e = candidate(p);
    if (!e) {
      setMessage(
        "Für Türen und Tore zuerst eine passende Wand setzen und in deren Nähe klicken.",
      );
      return;
    }
    const next =
      "slots" in e
        ? { ...doc, racks: [...doc.racks, e] }
        : { ...doc, layout: { ...layout, objects: [...layout.objects, e] } };
    if (commit(next, `${e.name} platziert`)) {
      setSelected([e.id]);
      setKind(undefined);
      setGhost(undefined);
      template.current = undefined;
    }
  }
  function duplicate() {
    try {
      const result = duplicateEntities(doc, selected);
      if (result.ids.length && commit(result.data, "Ohne Bestände dupliziert"))
        setSelected(result.ids);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function remove() {
    try {
      if (hallSelection) {
        if (entities(doc).some((o) => o.hallId === hallSelection.id))
          throw Error(
            "Zuerst Bauteile dieser Halle entfernen oder einer anderen Halle zuordnen.",
          );
        if (hallSelection.locked) throw Error("Halle zuerst entsperren.");
        const next = {
          ...doc,
          layout: {
            ...layout,
            halls: layout.halls.filter((h) => h.id !== hallSelection.id),
          },
        };
        if (commit(next)) {
          setHallId(next.layout.halls[0]?.id || "");
          setSelected([]);
        }
      } else if (commit(removeEntities(doc, selected), "Auswahl gelöscht"))
        setSelected([]);
    } catch (e) {
      setMessage((e as Error).message);
    }
    setModal(null);
  }
  function transform(
    ids: string[],
    dx: number,
    dz: number,
    angle: number,
    center?: Point,
  ) {
    try {
      if (commit(transformEntities(doc, ids, dx, dz, angle, center)))
        setPickedSlot("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function lock() {
    const all = hallSelection ? [hallSelection] : selection,
      value = !all.every((o) => o.locked),
      edit = <T extends { id: string; locked?: boolean }>(o: T) =>
        selected.includes(o.id) ? { ...o, locked: value } : o;
    commit(
      {
        ...doc,
        racks: doc.racks.map(edit),
        layout: {
          ...layout,
          halls: layout.halls.map(edit),
          objects: layout.objects.map(edit),
        },
      },
      value ? "Auswahl gesperrt" : "Auswahl entsperrt",
    );
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setKind(undefined);
        setGhost(undefined);
        template.current = undefined;
        setTool("select");
        setModal(null);
        setMessage("Platzierung abgebrochen");
        return;
      }
      if ((e.target as HTMLElement)?.closest("input,textarea,select") || modal)
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      } else if (e.key === "Delete" && selected.length) setModal("delete");
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [doc, past, future, selected, modal]);
  function applyEntity(next: Entity) {
    const original = entities(doc).find((o) => o.id === next.id);
    if (original?.locked) {
      setMessage("Objekt zuerst entsperren.");
      return;
    }
    try {
      const hall = layout.halls.find((h) => h.id === next.hallId);
      if (!hall) throw Error("Bitte eine Halle zuordnen.");
      next = { ...next, building: hall.building };
      let result: Data;
      if ("slots" in next) {
        result = {
          ...doc,
          racks: doc.racks.map((r) =>
            r.id === next.id ? rebuild(next as Rack, doc.stock, r) : r,
          ),
        };
      } else {
        const o = next as SceneObject;
        const wall = layout.objects.find((w) => w.id === o.wallId);
        if (isOpening(o.kind) && wall)
          next = attachOpening(
            o,
            wall,
            toWorld(wall, { x: o.offset || 0, z: 0 }),
          );
        result = {
          ...doc,
          layout: syncOpenings({
            ...layout,
            objects: layout.objects.map((o) =>
              o.id === next.id ? (next as SceneObject) : o,
            ),
          }),
        };
      }
      commit(result);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function applyHall(next: Hall) {
    const old = layout.halls.find((h) => h.id === next.id);
    if (old?.locked) {
      setMessage("Halle zuerst entsperren.");
      return;
    }
    if (!old) return;
    const dx = next.x - old.x,
      dz = next.z - old.z;
    const objects = layout.objects.map((o) => {
      if (o.hallId !== old.id) return o;
      const n = { ...o, x: o.x + dx, z: o.z + dz, building: next.building };
      if (n.kind === "wall" && n.exterior) {
        if (Math.abs(Math.sin((n.rotation * Math.PI) / 180)) < 0.5) {
          n.width = next.width;
          n.x = next.x;
          n.z = next.z + (Math.sign(o.z - old.z) * next.depth) / 2;
        } else {
          n.width = next.depth;
          n.z = next.z;
          n.x = next.x + (Math.sign(o.x - old.x) * next.width) / 2;
        }
        n.height = next.height;
      }
      return n;
    });
    commit({
      ...doc,
      racks: doc.racks.map((r) =>
        r.hallId === old.id
          ? { ...r, x: r.x + dx, z: r.z + dz, building: next.building }
          : r,
      ),
      layout: syncOpenings({
        ...layout,
        halls: layout.halls.map((h) => (h.id === old.id ? next : h)),
        objects,
      }),
    });
  }
  const config: BuildConfig = {
    selectedIds: selected,
    placing: !!kind,
    tool,
    step: snap ? step : undefined,
    ghost,
    onPick: pick,
    onTransform: transform,
    onPlace: place,
    onFloorMove: (p) => {
      if (kind) setGhost(candidate(p));
    },
    onHallPick: (id) => {
      if (!kind) {
        setHallId(id);
        setSelected([id]);
        setPickedSlot("");
      }
    },
  };
  const selectedRack = single && "slots" in single ? single : undefined,
    selectedSlot = doc.racks
      .flatMap((r) => r.slots.map((s) => ({ r, s })))
      .find((x) => x.s.id === pickedSlot);
  return (
    <div className="builder">
      <div className="builder-heading">
        <div>
          <h1>Lager bauen</h1>
          <span>Schematisches Hallenmodell · alle Maße in Metern</span>
        </div>
        <div className="builder-heading-actions">
          <select
            aria-label="Bauhalle auswählen"
            value={currentHall?.id || ""}
            onChange={(e) => {
              setHallId(e.target.value);
              setSelected([]);
              setKind(undefined);
              setGhost(undefined);
              setReset((n) => n + 1);
            }}
          >
            {layout.halls.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} · {h.building}
              </option>
            ))}
          </select>
          <button onClick={() => setModal("hall")}>
            <Plus size={15} /> Halle hinzufügen
          </button>
        </div>
      </div>
      <div className="build-toolbar" aria-label="Bauwerkzeuge">
        {(
          [
            ["select", "Auswahl", MousePointer2],
            ["move", "Verschieben", Move],
            ["rotate", "Drehen", RotateCw],
          ] as const
        ).map(([t, label, I]) => (
          <button
            key={t}
            aria-label={label}
            aria-pressed={tool === t && !kind}
            className={tool === t && !kind ? "selected" : ""}
            onClick={() => {
              setTool(t);
              setKind(undefined);
              setGhost(undefined);
            }}
          >
            <I size={16} />
            <span>{label}</span>
          </button>
        ))}
        <i />
        <button
          aria-label="Auswahl um 90 Grad drehen"
          disabled={
            !selection.some((o) => !o.locked && !isOpening(o.kind || ""))
          }
          onClick={() => transform(selected, 0, 0, 90)}
        >
          <RotateCw size={16} /> 90°
        </button>
        <button
          aria-label="Auswahl duplizieren"
          disabled={!selection.length}
          onClick={duplicate}
        >
          <Copy size={16} />
        </button>
        <button
          aria-label="Auswahl löschen"
          disabled={!selected.length}
          onClick={() => setModal("delete")}
        >
          <Trash2 size={16} />
        </button>
        <button
          aria-label="Auswahl sperren oder entsperren"
          disabled={!selected.length}
          onClick={lock}
        >
          {selection.every((o) => o.locked) && !hallSelection ? (
            <Unlock size={16} />
          ) : (
            <Lock size={16} />
          )}
        </button>
        <i />
        <button aria-label="Rückgängig" disabled={!past.length} onClick={undo}>
          <Undo2 size={17} />
        </button>
        <button
          aria-label="Wiederholen"
          disabled={!future.length}
          onClick={redo}
        >
          <Redo2 size={17} />
        </button>
        <div className="builder-view-tabs">
          <button aria-pressed={view === "2d"} onClick={() => setView("2d")}>
            <Grid2X2 size={15} /> Grundriss
          </button>
          <button aria-pressed={view === "3d"} onClick={() => setView("3d")}>
            <Layers3 size={15} /> 3D bauen
          </button>
        </div>
      </div>
      <div className="build-grid">
        <aside className="part-library">
          <h2>Bauteilbibliothek</h2>
          <p>Auswählen, dann auf den Boden klicken.</p>
          {(
            [
              "Halle & Öffnungen",
              "Lagersysteme",
              "Ausstattung",
              "Wege & Flächen",
            ] as const
          ).map((category) => (
            <details key={category} open>
              <summary>{category}</summary>
              {PARTS.filter((p) => p.category === category).map((p) => (
                <button
                  key={p.kind}
                  className={kind === p.kind ? "active" : ""}
                  aria-pressed={kind === p.kind}
                  onClick={() => startPlacement(p.kind)}
                >
                  <span
                    className="part-swatch"
                    style={{ background: p.color }}
                  />
                  <span>{p.name}</span>
                  <Plus size={12} />
                </button>
              ))}
            </details>
          ))}
        </aside>
        <section className="build-stage">
          <div className="build-options">
            <label>
              <input
                type="checkbox"
                checked={snap}
                onChange={(e) => setSnap(e.target.checked)}
              />{" "}
              Raster
            </label>
            <label>
              Schritt{" "}
              <input
                aria-label="Rasterschritt in Metern"
                type="number"
                min=".05"
                max="5"
                step=".05"
                value={step}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 0.05 && n <= 5) setStep(n);
                }}
              />{" "}
              m
            </label>
            <label>
              <input
                type="checkbox"
                checked={labels}
                onChange={(e) => setLabels(e.target.checked)}
              />{" "}
              Beschriftungen
            </label>
            <select
              aria-label="Wanddarstellung"
              value={wallMode}
              onChange={(e) => setWallMode(e.target.value as typeof wallMode)}
            >
              <option value="cutaway">Wände: offene Ansicht</option>
              <option value="all">Alle Wände</option>
              <option value="none">Wände ausblenden</option>
            </select>
            <button
              title="Kamera zurücksetzen"
              aria-label="Bauansicht zurücksetzen"
              onClick={() => setReset((n) => n + 1)}
            >
              <Eye size={15} />
            </button>
          </div>
          <div className="build-canvas">
            {currentHall ? (
              view === "2d" ? (
                <BuilderPlan
                  data={shown}
                  build={config}
                  showLabels={labels}
                  wallMode={wallMode}
                />
              ) : (
                <Suspense
                  fallback={<div className="empty">Halle wird aufgebaut …</div>}
                >
                  <Scene
                    data={shown}
                    selected={pickedSlot}
                    onSelect={(r, s, shift) => {
                      if (!kind) {
                        setSelected((old) =>
                          shift
                            ? old.includes(r.id)
                              ? old.filter((id) => id !== r.id)
                              : [...old, r.id]
                            : [r.id],
                        );
                        setPickedSlot(s.id);
                      }
                    }}
                    onRackSelect={(r) => pick(r.id)}
                    spread={spread}
                    hidden={hidden}
                    offsets={offsets}
                    reset={reset}
                    showLabels={labels}
                    wallMode={wallMode}
                    build={config}
                  />
                </Suspense>
              )
            ) : (
              <div className="empty">
                <Boxes size={45} />
                <h3>Ein neuer Grundriss.</h3>
                <p>
                  Legen Sie eine Halle an und platzieren Sie Ihre ersten
                  Bauteile.
                </p>
                <button className="primary" onClick={() => setModal("hall")}>
                  Halle erstellen
                </button>
              </div>
            )}
          </div>
          <div className="build-status" role="status">
            {kind
              ? `${part(kind).name} platzieren · Escape: abbrechen`
              : message ||
                `${shown.racks.length} Lagersysteme · ${shown.layout?.objects.length || 0} weitere Bauteile · Shift-Klick: Mehrfachauswahl`}
          </div>
        </section>
        <aside className="build-properties">
          <h2>Eigenschaften</h2>
          {selected.length > 1 ? (
            <>
              <h3>{selected.length} Objekte ausgewählt</h3>
              <p>Verschieben, drehen, duplizieren oder gemeinsam sperren.</p>
              <button onClick={lock}>
                <Lock size={14} /> Auswahl sperren / entsperren
              </button>
            </>
          ) : hallSelection ? (
            <HallProperties
              key={JSON.stringify(hallSelection)}
              hall={hallSelection}
              onApply={applyHall}
              onUnlock={lock}
            />
          ) : single ? (
            <>
              <ObjectProperties
                key={JSON.stringify(single)}
                entity={single}
                halls={layout.halls}
                walls={layout.objects.filter((o) => o.kind === "wall")}
                onApply={applyEntity}
                onUnlock={lock}
              />
              {selectedRack && (
                <>
                  <button className="full" onClick={() => setModal("rack")}>
                    Fächer & Struktur bearbeiten
                  </button>
                  {selectedRack.areas.length > 1 && (
                    <SegmentControls
                      rack={selectedRack}
                      spread={spread}
                      setSpread={setSpread}
                      offsets={offsets}
                      setOffsets={setOffsets}
                      hidden={hidden}
                      setHidden={setHidden}
                    />
                  )}
                </>
              )}
              {selectedSlot && (
                <div className="builder-slot-info">
                  <b>Fach {code(selectedSlot.r, selectedSlot.s)}</b>
                  <p>
                    {doc.stock
                      .filter((b) => b.slotId === pickedSlot)
                      .map(
                        (b) =>
                          `${doc.materials.find((m) => m.id === b.materialId)?.name}: ${b.quantity} Stk.`,
                      )
                      .join(" · ") || "Freies Fach"}
                  </p>
                  <button
                    onClick={() => onOpenSlot(selectedSlot.r, selectedSlot.s)}
                  >
                    Materialien am Lagerplatz öffnen
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="builder-empty-properties">
              <MousePointer2 size={30} />
              <p>
                Ein Objekt auswählen, um Maße, Position und Gestaltung zu
                ändern.
              </p>
              <button
                onClick={() => {
                  if (currentHall) setSelected([currentHall.id]);
                }}
              >
                Halleneigenschaften öffnen
              </button>
            </div>
          )}
          <details className="builder-object-list">
            <summary>Objekte dieser Halle ({entities(shown).length})</summary>
            {entities(shown).map((o) => (
              <label key={o.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(o.id)}
                  onChange={() => pick(o.id, true)}
                />
                <span>
                  {o.name}
                  {o.locked ? " 🔒" : ""}
                </span>
              </label>
            ))}
          </details>
          <div className="layout-warnings">
            <b>Planungshinweise ({notices.length})</b>
            {notices.length ? (
              notices.slice(0, 12).map((n, i) => (
                <button key={i} onClick={() => setSelected(n.ids)}>
                  {n.text}
                </button>
              ))
            ) : (
              <p>Keine erkannten Überschneidungen fester Objekte.</p>
            )}
            <small>Schematisches Modell, keine bauliche Prüfung.</small>
          </div>
        </aside>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <section
            className={"modal " + (modal === "rack" ? "wide-modal" : "")}
            role="dialog"
            aria-modal="true"
            aria-label="Baumodus bearbeiten"
          >
            <button
              className="modal-close"
              aria-label="Baudialog schließen"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "delete" ? (
              <>
                <h2>Auswahl löschen?</h2>
                <p>
                  Verknüpfte Öffnungen einer gelöschten Wand werden mit
                  entfernt. Belegte Lagerplätze bleiben geschützt.
                </p>
                <div className="actions form-actions">
                  <button onClick={() => setModal(null)}>Abbrechen</button>
                  <button className="danger" onClick={remove}>
                    Löschen bestätigen
                  </button>
                </div>
              </>
            ) : modal === "hall" ? (
              <HallCreate
                onClose={() => setModal(null)}
                onCreate={(h, outer) => {
                  const next = {
                    ...doc,
                    racks: doc.racks.map((r) =>
                      !r.hallId && r.building === h.building
                        ? { ...r, hallId: h.id }
                        : r,
                    ),
                    layout: {
                      ...layout,
                      halls: [...layout.halls, h],
                      objects: [
                        ...layout.objects,
                        ...(outer ? wallsFor(h) : []),
                      ],
                    },
                  };
                  if (commit(next, "Halle angelegt")) {
                    setHallId(h.id);
                    setSelected([h.id]);
                    setModal(null);
                    setReset((n) => n + 1);
                  }
                }}
              />
            ) : selectedRack ? (
              <RackEditor
                rack={selectedRack}
                stock={doc.stock}
                buildings={[selectedRack.building]}
                onClose={() => setModal(null)}
                onSave={(r) => {
                  if (
                    commit({
                      ...doc,
                      racks: doc.racks.map((v) => (v.id === r.id ? r : v)),
                    })
                  )
                    setModal(null);
                }}
              />
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type={type}
        required
        step={type === "number" ? "any" : undefined}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function HallCreate({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (h: Hall, outer: boolean) => void;
}) {
  const [hall, setHall] = useState(() => makeHall()),
    [outer, setOuter] = useState(true);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(hall, outer);
      }}
    >
      <h2>Halle erstellen</h2>
      <Input
        label="Hallenname"
        value={hall.name}
        onChange={(name) => setHall({ ...hall, name })}
      />
      <Input
        label="Gebäude der Halle"
        value={hall.building}
        onChange={(building) => setHall({ ...hall, building })}
      />
      <div className="form-grid">
        {(["width", "depth", "height"] as const).map((k, i) => (
          <Input
            key={k}
            label={["Hallenbreite (m)", "Hallentiefe (m)", "Hallenhöhe (m)"][i]}
            type="number"
            min={1}
            max={k === "height" ? 30 : 200}
            value={hall[k]}
            onChange={(v) => setHall({ ...hall, [k]: Number(v) })}
          />
        ))}
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={outer}
          onChange={(e) => setOuter(e.target.checked)}
        />{" "}
        Außenwände mit anlegen
      </label>
      <div className="actions form-actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button className="primary">Halle anlegen</button>
      </div>
    </form>
  );
}
function HallProperties({
  hall,
  onApply,
  onUnlock,
}: {
  hall: Hall;
  onApply: (h: Hall) => void;
  onUnlock: () => void;
}) {
  const [h, setH] = useState(hall);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(h);
      }}
    >
      <h3>Halle</h3>
      {h.locked && (
        <button type="button" onClick={onUnlock}>
          <Unlock size={14} /> Halle entsperren
        </button>
      )}
      <fieldset disabled={h.locked}>
        <Input
          label="Hallenname"
          value={h.name}
          onChange={(name) => setH({ ...h, name })}
        />
        <Input
          label="Gebäude"
          value={h.building}
          onChange={(building) => setH({ ...h, building })}
        />
        {(["width", "depth", "height", "x", "z"] as const).map((k, i) => (
          <Input
            key={k}
            label={["Breite (m)", "Tiefe (m)", "Höhe (m)", "X (m)", "Z (m)"][i]}
            value={h[k]}
            type="number"
            min={i < 3 ? 1 : -1000}
            max={k === "height" ? 30 : i < 3 ? 200 : 1000}
            onChange={(v) => setH({ ...h, [k]: Number(v) })}
          />
        ))}
        <button className="primary full">Halle übernehmen</button>
      </fieldset>
    </form>
  );
}
function ObjectProperties({
  entity,
  halls,
  walls,
  onApply,
  onUnlock,
}: {
  entity: Entity;
  halls: Hall[];
  walls: SceneObject[];
  onApply: (o: Entity) => void;
  onUnlock: () => void;
}) {
  const [o, setO] = useState<Entity>(structuredClone(entity)),
    rack = "slots" in o,
    opening = isOpening(o.kind || ""),
    path = isPath(o.kind || "");
  const set = (k: string, v: unknown) => setO({ ...o, [k]: v });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(o);
      }}
    >
      <h3>{rack ? part(o.kind || "shelfRack").name : part(o.kind!).name}</h3>
      <small className="entity-id">ID {o.id.slice(0, 8)}</small>
      {o.locked && (
        <button type="button" onClick={onUnlock}>
          <Unlock size={14} /> Objekt entsperren
        </button>
      )}
      <fieldset disabled={o.locked}>
        <Input
          label="Objektname"
          value={o.name}
          onChange={(v) => set("name", v)}
        />
        {rack && (
          <Input
            label="Regalnummer"
            value={o.number}
            onChange={(v) => set("number", v)}
          />
        )}
        <label className="field">
          <span>Halle zuordnen</span>
          <select
            aria-label="Halle zuordnen"
            required
            value={o.hallId || ""}
            onChange={(e) => set("hallId", e.target.value)}
          >
            {halls.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        {!opening && (
          <div className="builder-field-pair">
            <Input
              label="X (m)"
              value={o.x}
              type="number"
              min={-1000}
              max={1000}
              onChange={(v) => set("x", Number(v))}
            />
            <Input
              label="Z (m)"
              value={o.z}
              type="number"
              min={-1000}
              max={1000}
              onChange={(v) => set("z", Number(v))}
            />
            <Input
              label="Drehung (°)"
              value={o.rotation}
              type="number"
              min={-1000}
              max={1000}
              onChange={(v) => set("rotation", Number(v))}
            />
          </div>
        )}
        <div className="builder-field-pair">
          <Input
            label={path ? "Wegbreite (m)" : "Breite (m)"}
            value={o.width}
            type="number"
            min={rack ? 0.1 : 0.02}
            max={100}
            onChange={(v) => set("width", Number(v))}
          />
          {!path && !opening && (
            <Input
              label="Tiefe (m)"
              value={o.depth}
              type="number"
              min={rack ? 0.1 : 0.02}
              max={100}
              onChange={(v) => set("depth", Number(v))}
            />
          )}
          {!isMarking(o.kind || "") && (
            <Input
              label="Höhe (m)"
              value={o.height}
              type="number"
              min={rack ? 0.1 : 0.005}
              max={30}
              onChange={(v) => set("height", Number(v))}
            />
          )}
        </div>
        <label className="field">
          <span>Farbe</span>
          <input
            aria-label="Bauteilfarbe"
            type="color"
            value={o.color || "#6e8990"}
            onChange={(e) => set("color", e.target.value)}
          />
        </label>
        {opening && "offset" in o && (
          <>
            <label className="field">
              <span>Zugehörige Wand</span>
              <select
                aria-label="Zugehörige Wand"
                value={o.wallId || ""}
                required
                onChange={(e) => set("wallId", e.target.value)}
              >
                {walls
                  .filter((w) => w.hallId === o.hallId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </label>
            <Input
              label="Versatz in der Wand (m)"
              value={o.offset || 0}
              type="number"
              onChange={(v) => set("offset", Number(v))}
            />
            <p>
              Position und Drehung folgen der Wand. X {o.x.toFixed(2)} m · Z{" "}
              {o.z.toFixed(2)} m.
            </p>
          </>
        )}
        {path && "points" in o && (
          <div className="path-points">
            <b>Stützpunkte · lokal (m)</b>
            {o.points?.map((p, i) => (
              <div className="builder-field-pair" key={i}>
                <Input
                  label={`Punkt ${i + 1} X`}
                  value={p.x}
                  type="number"
                  min={-200}
                  max={200}
                  onChange={(v) =>
                    set(
                      "points",
                      o.points?.map((q, j) =>
                        j === i ? { ...q, x: Number(v) } : q,
                      ),
                    )
                  }
                />
                <Input
                  label={`Punkt ${i + 1} Z`}
                  value={p.z}
                  type="number"
                  min={-200}
                  max={200}
                  onChange={(v) =>
                    set(
                      "points",
                      o.points?.map((q, j) =>
                        j === i ? { ...q, z: Number(v) } : q,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label={`Punkt ${i + 1} entfernen`}
                  disabled={(o.points?.length || 0) <= 2}
                  onClick={() =>
                    set(
                      "points",
                      o.points?.filter((_, j) => j !== i),
                    )
                  }
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={(o.points?.length || 0) >= 100}
              onClick={() =>
                set("points", [
                  ...(o.points || []),
                  {
                    x: (o.points?.at(-1)?.x || 0) + 2,
                    z: o.points?.at(-1)?.z || 0,
                  },
                ])
              }
            >
              Stützpunkt hinzufügen
            </button>
          </div>
        )}
        {rack && o.areas.length > 1 && (
          <label className="field">
            <span>Bewegungsrichtung der Segmente</span>
            <select
              aria-label="Bewegungsrichtung"
              value={o.slidingDirection || "x"}
              onChange={(e) => set("slidingDirection", e.target.value)}
            >
              <option value="x">Seitlich · X-Achse</option>
              <option value="z">In der Tiefe · Z-Achse</option>
            </select>
          </label>
        )}
        <button className="primary full">Eigenschaften übernehmen</button>
      </fieldset>
    </form>
  );
}
