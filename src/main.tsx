import AuthShell from './AuthShell';
import {roleLabels,type RemoteAccess} from './accounts';
import React, {
  useState,
  useEffect,
  Suspense,
  lazy,
  useId,
  useMemo,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Boxes,
  LayoutDashboard,
  Package,
  Settings2,
  Search,
  Plus,
  Download,
  Upload,
  RotateCcw,
  Box,
  Layers3,
  Map,
  Grid2X2,
  X,
  ChevronRight,
  Pencil,
  Trash2,
  Copy,
  ArrowUpRight,
} from "lucide-react";
import {
  type Data,
  type Rack,
  type Slot,
  type Material,
  example,
  uid,
  rebuild,
  code,
  validate,
  transfer,
} from "./model";
import "./style.css";
import {
  loadStore,
  STORE_KEY,
  LEGACY_KEY,
  type Store,
  type Warehouse,
  warehouse,
  validateStore,
  updateWarehouse,
} from "./storage";
import type { CameraMode } from "./layout";
import WarehousePlan from "./WarehousePlan";
import RackEditor from "./RackEditor";
import { materialMatches } from './materialImport';
const ChecklistImport = lazy(() => import('./ChecklistImport'));
const StructureImport = lazy(() => import('./StructureImport'));
const MaterialImport = lazy(() => import('./MaterialImport'));
const Scene = lazy(() => import("./Scene"));
import {reconcileSap} from './sap';
const Sap = lazy(() => import('./Sap'));
const Putaway = lazy(() => import('./Putaway'));
const Builder = lazy(() => import("./Builder"));
import BuilderPlan from "./BuilderPlan";
import SegmentControls from "./SegmentControls";
const initial = loadStore(localStorage);
function App({remote}:{remote?:RemoteAccess}) {
  const canManage=!remote||remote.user.permissions.includes('warehouse.manage'),canAssign=!remote||remote.user.permissions.includes('stock.assign'),canSap=!remote||remote.user.permissions.includes('sap.manage');
  const [store, setStore] = useState<Store>(remote?.store||initial.store),
    [blocked, setBlocked] = useState(remote?false:initial.blocked),
    [page, setPage] = useState("overview"),
    [view, setView] = useState("3d"),
    [selected, setSelected] = useState(""),
    [rackFilter, setRackFilter] = useState("all"),
    [building, setBuilding] = useState("all"),
    [query, setQuery] = useState(""),
    [toast, setToast] = useState(remote?'':initial.error),
    [modal, setModal] = useState<React.ReactNode>(null),
    [spread, setSpread] = useState(false),
    [reset, setReset] = useState(0),
    [focus, setFocus] = useState<Rack>();
  const active = store.warehouses.find((w) => w.id === store.activeId)!,
    data = active.data;
  const [cameraMode, setCameraMode] = useState<CameraMode>("overview"),
    [hidden, setHidden] = useState<string[]>([]),
    [showBoxes, setShowBoxes] = useState(true),
    [showLabels, setShowLabels] = useState(true),
    [wallMode, setWallMode] = useState<"cutaway" | "all" | "none">("cutaway"),
    [offsets, setOffsets] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  // A fresh server snapshot also updates an already open independent session.
  // Own saves update both states together. Never discard an open edit dialog.
  useEffect(() => {
    if (remote && JSON.stringify(remote.store) !== JSON.stringify(store)) {
      if (modal) { setToast('Zentrale Änderung vorhanden. Ihre Eingabe bleibt erhalten; bitte Bearbeitung abschließen oder abbrechen.'); return; }
      setStore(remote.store);
      clearView();
      setToast('Zentrale Änderungen geladen');
    }
  }, [remote?.store, modal]);
  function persist(next: Store, repair = false) {
    try {
      if (blocked && !repair)
        throw Error(
          "Änderungen sind zum Schutz der vorhandenen Daten gesperrt. Zuerst Originaldaten sichern und eine gültige Gesamtsicherung importieren.",
        );
      validateStore(next);
      if(remote){const committed=remote.persist(next);setStore(committed);setToast('Zentral gespeichert');return true;}
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
      setStore(next);
      if (repair) setBlocked(false);
      setToast("Änderungen gespeichert");
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    }
  }
  function save(next: Data, restore = false) {
    try {
      if(remote&&!canManage&&!canAssign&&!canSap)throw Error('Keine Schreibberechtigung.');
      return persist(updateWarehouse(store, active.id, restore?next:reconcileSap(data,next)));
    } catch (e) {
      setToast((e as Error).message);
      return false;
    }
  }
  function clearView() {
    setSelected("");
    setFocus(undefined);
    setQuery("");
    setModal(null);
    setRackFilter("all");
    setBuilding("all");
    setSpread(false);
    setHidden([]);
    setOffsets({});
    setCameraMode("overview");
    setReset((n) => n + 1);
  }
  function switchWarehouse(id: string) {
    if (persist({ ...store, activeId: id })) {
      clearView();
      setPage(page==='putaway'||page==='sap'?page:'overview');
      setToast("Lager gewechselt");
    }
  }
  function warehouseManager() {
    setModal(
      <WarehouseManager
        warehouses={store.warehouses}
        activeId={active.id}
        canCreate={!remote||remote.user.permissions.includes('warehouse.create')}
        canRename={canManage}
        onSwitch={switchWarehouse}
        onCreate={(name) => {
          const w = warehouse(name);
          if (
            persist({
              ...store,
              activeId: w.id,
              warehouses: [...store.warehouses, w],
            })
          ) {
            clearView();
            setPage("overview");
          }
        }}
        onRename={(w) =>
          setModal(
            <NameForm
              title="Lager umbenennen"
              label="Lagername"
              initial={w.name}
              onClose={() => setModal(null)}
              onSave={(name) => {
                if (
                  persist({
                    ...store,
                    warehouses: store.warehouses.map((v) =>
                      v.id === w.id ? { ...v, name: name.trim() } : v,
                    ),
                  })
                )
                  setModal(null);
              }}
            />,
          )
        }
      />,
    );
  }
  function buildingManager() {
    setModal(
      <NameForm
        title="Gebäude hinzufügen"
        label="Gebäudecode"
        initial=""
        onClose={() => setModal(null)}
        onSave={(name) => {
          name = name.trim();
          if (active.buildings.includes(name)) {
            setToast("Dieses Gebäude existiert bereits.");
            return;
          }
          if (
            persist({
              ...store,
              warehouses: store.warehouses.map((w) =>
                w.id === active.id
                  ? { ...w, buildings: [...w.buildings, name] }
                  : w,
              ),
            })
          )
            setModal(null);
        }}
      />,
    );
  }
  const slots = data.racks.flatMap((r) =>
      r.slots.map((s) => ({ r, s, c: code(r, s) })),
    ),
    sel = slots.find((x) => x.s.id === selected),
    occupied = new Set([...data.stock.map((b) => b.slotId),...data.materials.flatMap(m=>m.assignedSlotIds||[])]);
  const visible = useMemo(
    () =>
      data.racks.filter(
        (r) =>
          (rackFilter === "all" || r.id === rackFilter) &&
          (building === "all" || r.building === building),
      ),
    [data, rackFilter, building],
  );
  const sceneData: Data = {
    ...data,
    racks: visible,
    layout: data.layout
      ? {
          ...data.layout,
          halls: data.layout.halls.filter(
            (h) => building === "all" || h.building === building,
          ),
          objects: data.layout.objects.filter(
            (o) => building === "all" || o.building === building,
          ),
        }
      : undefined,
  };
  const materialHits = query.trim() ? data.materials.filter(m => materialMatches(m, query)) : [];
  const matches = query.trim()
    ? slots.filter(
        (x) =>
          x.c.toLowerCase().includes(query.trim().toLowerCase()) ||
          data.materials.some(m => materialHits.includes(m) && (m.assignedSlotIds?.includes(x.s.id) || data.stock.some(b => b.slotId===x.s.id && b.materialId===m.id))),
      )
    : [];
  function select(r: Rack, s: Slot) {
    setSelected(s.id);
    setFocus(r);
  }
  function show(r: Rack, s: Slot) {
    select(r, s);
    setRackFilter("all");
    setBuilding("all");
    setPage("overview");
    setView("3d");
    setQuery("");
    setHidden(r.areas.filter((a) => a.id !== s.areaId).map((a) => a.id));
    setSpread(r.areas.length > 1);
    setCameraMode("front");
    if (r.areas.length > 1)
      setToast(
        "Suchtreffer sichtbar: Andere Bereiche dieses Regals sind vorübergehend ausgeblendet. Unter Bereiche können Sie sie wieder einblenden.",
      );
    setReset((n) => n + 1);
  }
  function confirm(title: string, action: () => void) {
    setModal(
      <>
        <h2>{title}</h2>
        <p>
          Diese Aktion kann nicht rückgängig gemacht werden. Mit einem
          JSON-Export sichern Sie den aktuellen Stand.
        </p>
        <div className="actions form-actions">
          <button onClick={() => setModal(null)}>Abbrechen</button>
          <button
            className="danger"
            onClick={() => {
              action();
              setModal(null);
            }}
          >
            Bestätigen
          </button>
        </div>
      </>,
    );
  }
  function rackForm(r?: Rack) {
    if(!canManage){setToast('Keine Berechtigung für die Regalverwaltung.');return;}
    setModal(
      <RackEditor
        rack={r}
        stock={data.stock}
        buildings={active.buildings}
        onClose={() => setModal(null)}
        onSave={(n) => {
          if (
            data.layout &&
            !data.layout.halls.some(
              (h) => h.id === n.hallId && h.building === n.building,
            )
          )
            n = {
              ...n,
              hallId: data.layout.halls.find((h) => h.building === n.building)
                ?.id,
            };

          if (
            save({
              ...data,
              racks: r
                ? data.racks.map((v) => (v.id === r.id ? n : v))
                : [...data.racks, n],
            })
          )
            setModal(null);
        }}
      />,
    );
  }
  function materialForm(m?: Material) {
    if(!canManage){setToast('Keine Berechtigung für Materialstammdaten.');return;}
    setModal(
      <MaterialForm
        material={m}
        onClose={() => setModal(null)}
        onSave={(n) => {
          if (
            save({
              ...data,
              materials: m
                ? data.materials.map((v) => (v.id === m.id ? n : v))
                : [...data.materials, n],
            })
          )
            setModal(null);
        }}
      />,
    );
  }
  function assign(slotId = selected) {
    if(!canAssign){setToast('Keine Zuordnungsberechtigung.');return;}
    setModal(
      <StockForm
        data={data}
        slotId={slotId}
        onClose={() => setModal(null)}
        onSave={(materialId, target, quantity) => {
          const stock = data.stock.map((b) => ({ ...b })),
            b = stock.find(
              (b) => b.slotId === target && b.materialId === materialId,
            );
          if (b) b.quantity += quantity;
          else stock.push({ id: uid(), materialId, slotId: target, quantity });
          if (save({ ...data, stock })) setModal(null);
        }}
      />,
    );
  }
  function removeRack(r: Rack) {
    if (r.slots.some((s) => occupied.has(s.id))) {
      setToast(
        "Dieses Regal enthält Materialien. Bitte zuerst alle Bestände umlagern.",
      );
      return;
    }
    confirm(`Regal ${r.number} löschen?`, () =>
      save({ ...data, racks: data.racks.filter((v) => v.id !== r.id) }),
    );
  }
  function duplicate(r: Rack) {
    const n = structuredClone(r);
    n.id = uid();
    n.number = String(
      Math.max(
        0,
        ...data.racks
          .filter((v) => /^\d+$/.test(v.number))
          .map((v) => Number(v.number)),
      ) + 1,
    );
    n.name += " (Kopie)";
    n.x += 5;
    n.areas = n.areas.map((a) => {
      const old = a.id,
        id = uid();
      n.slots = n.slots.map((s) =>
        s.areaId === old ? { ...s, id: uid(), areaId: id, name: undefined } : s,
      );
      return { ...a, id };
    });
    save({ ...data, racks: [...data.racks, n] });
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(store, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "lagerraum-alle-lager.json";
    a.click();
    URL.revokeObjectURL(url);
    setToast("JSON-Export erstellt");
  }
  async function importData(file?: File) {
    if(remote){remote.migrate();return;}
    if (!file) return;
    try {
      if (file.size > 10e6)
        throw Error("Die Datei darf höchstens 10 MB groß sein.");
      const parsed = JSON.parse(await file.text());
      if (parsed.version === 2) {
        const next = validateStore(parsed);
        confirm(
          `Alle Lager durch ${next.warehouses.length} importierte Lager ersetzen?`,
          () => {
            if (persist(next, true)) clearView();
          },
        );
      } else {
        const next = validate(parsed);
        confirm(
          `Daten im Lager „${active.name}“ ersetzen? Andere Lager bleiben erhalten.`,
          () => {
            if (save(next,true)) clearView();
          },
        );
      }
    } catch (e) {
      setToast("Import fehlgeschlagen: " + (e as Error).message);
    }
  }
  function backupOriginal() {
    const raw =
      localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_KEY) || "";
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "lagerraum-originaldaten.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const pageTitle =
    page === "overview"
      ? "Lagerübersicht"
      : page === "materials"
        ? "Materialien"
        : page === "sap" ? "SAP-Abgleich" : page === "putaway" ? "Einräum-Modus" : page === "build"
          ? "Bauen"
          : "Lager bearbeiten";
  return (
    <div
      className={
        "app " +(remote?'remote-app ':'')+(!canManage?'cannot-manage ':'')+(!canAssign?'cannot-assign ':'')+
        (page === "overview"
          ? "overview-page"
          : page === "sap" ? "sap-page" : page === "putaway" ? "putaway-page" : page === "build"
            ? "builder-page"
            : "scroll-page")
      }
    >
      <aside className="sidebar">
        <div className="brand">
          <Boxes size={28} />{" "}
          <span>
            lagerraum<span className="orange">.</span>
          </span>
        </div>
        <div className="workspace-label">ARBEITSBEREICH</div>
        <button
          className="workspace"
          aria-label={`Lagerverwaltung: ${active.name}`}
          onClick={warehouseManager}
        >
          <span className="avatar">
            {active.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="workspace-name">
            {active.name}
            <small>{store.warehouses.length} Lager · auswählen</small>
          </span>
          <ChevronRight size={15} />
        </button>
        {remote&&<div className="remote-user-tools"><small>{remote.user.name} · {roleLabels[remote.user.role]}</small><button onClick={remote.profile}>Mein Profil</button><button onClick={remote.favorite}>{remote.user.favorite===active.id?'★ Favorit entfernen':'☆ Lager als Favorit'}</button>{remote.user.role==='admin'&&<button onClick={remote.dashboard}>Administration</button>}<button onClick={remote.logout}>Abmelden</button></div>}
        <div className="nav-label">VERWALTUNG</div>
        <nav>
          {[
            ["overview", "Lagerübersicht", LayoutDashboard],
            ["materials", "Materialien", Package],
            ["edit", "Lager bearbeiten", Settings2],
            ["build", "Bauen", Boxes],
            ["putaway", "Einräum-Modus", Package],
            ["sap", "SAP-Abgleich", Copy],
          ].filter(([p])=>p!=='edit'&&p!=='build'||canManage).filter(([p])=>p!=='putaway'||canAssign).filter(([p])=>p!=='sap'||canSap).map(([p, t, I]) => (
            <button
              className={page === p ? "active" : ""}
              key={String(p)}
              onClick={() => setPage(String(p))}
            >
              {React.createElement(I, { size: 18 })}
              <span>{String(t)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <i /> {remote?'Zentral gespeichert':'Lokal gespeichert'}
          </div>
          <p>{remote?'Freigegebene Lagerdaten · Benutzerrechte aktiv.':'Ihre Daten bleiben in diesem Browser.'}</p>
          <button onClick={exportData}>
            <Download size={16} />
            <span>JSON exportieren</span>
          </button>
          <label className="import-btn" onClick={e=>{if(remote){e.preventDefault();remote.migrate();}}}>
            <Upload size={16} />
            <span>JSON importieren</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                importData(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() =>
              confirm("Beispieldaten wiederherstellen?", () => {
                if (save(example())) clearView();
              })
            }
          >
            <RotateCcw size={16} />
            <span>Beispieldaten laden</span>
          </button>
          <div className="profile">
            <span className="avatar">LA</span>
            <div>
              {remote?'Zentral angemeldet':'Lokaler Modus'}<small>{remote?roleLabels[remote.user.role]:'Prototyp · Version 0.1'}</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Arbeitsbereich <ChevronRight size={13} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="search-wrap">
            <Search size={17} />
            <input
              aria-label="Zentrale Suche"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Material oder Lagerplatz suchen …"
            />
            {query && (
              <button aria-label="Suche schließen" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            )}
            {query && (
              <div className="search-results">
                <strong>{matches.length} Lagerplätze gefunden</strong>
                {matches.slice(0, 40).map(({ r, s, c }) => (
                  <button key={s.id} onClick={() => show(r, s)}>
                    <div>
                      <b>{c}</b>
                      <small>
                        {data.stock
                          .filter((b) => b.slotId === s.id)
                          .map(
                            (b) =>
                              data.materials.find((m) => m.id === b.materialId)
                                ?.name,
                          )
                          .join(", ") || data.materials.filter(m=>m.assignedSlotIds?.includes(s.id)).map(m=>m.name).join(', ') || "Freies Fach"}
                      </small>
                    </div>
                    <span>Im Lager anzeigen ↗</span>
                  </button>
                ))}
                {materialHits.slice(0,40).map(m => <button key={m.id} onClick={()=>{setPage('materials');setQuery(m.number);}}><div><b>{m.number} · {m.name}</b><small>{m.oldLocations?.length ? `Alte Plätze: ${m.oldLocations.join(', ')}` : 'Material öffnen'}</small></div></button>)}
                {!matches.length && !materialHits.length && (
                  <p>
                    Keine Treffer. Materialnummer, Bezeichnung oder
                    Lagerplatzcode eingeben.
                  </p>
                )}
              </div>
            )}
          </div>
          <span className="header-badge">{active.name}</span>
        </header>
        <div className="content">
          {blocked && (
            <div className="storage-warning">
              {initial.error}
              <button onClick={backupOriginal}>Originaldaten sichern</button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">ALLES AN SEINEM PLATZ</div>
              <h1>
                {page === "overview"
                  ? "Ihr Lager. Auf einen Blick."
                  : page === "materials"
                    ? "Materialien"
                    : "Lager gestalten."}
              </h1>
              <p>
                {page === "overview"
                  ? "Bestände verstehen, Lagerplätze finden und Ihr Lager im Raum erkunden."
                  : page === "materials"
                    ? "Alle Materialien und ihre Lagerplätze zentral verwalten."
                    : "Regale, Bereiche und Fächer passend zu Ihrem Lager konfigurieren."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() =>
                page === "materials" ? materialForm() : rackForm()
              }
            >
              <Plus size={17} />
              {page === "materials"
                ? "Material hinzufügen"
                : "Regal hinzufügen"}
            </button>
          </div>
          <div className="stats">
            <Stat
              icon={<Boxes />}
              label="Regale"
              value={data.racks.length}
              note={`${active.buildings.length} Gebäude`}
            />
            <Stat
              icon={<Grid2X2 />}
              label="Lagerplätze"
              value={slots.length}
              note="über alle Bereiche"
            />
            <Stat
              icon={<Package />}
              label="Belegte Fächer"
              value={occupied.size}
              note={`${slots.length ? Math.round((occupied.size / slots.length) * 100) : 0} % Auslastung`}
            />
            <Stat
              icon={<Box />}
              label="Materialien"
              value={data.materials.length}
              note="verschiedene Materialien"
            />
          </div>
          {page === "sap" && <Suspense fallback={<p>Arbeitsliste wird geladen …</p>}><Sap key={active.id} data={data} name={active.name} onSave={save}/></Suspense>}
          {page === "putaway" && <Suspense fallback={<div className="empty">Einräum-Modus wird geladen …</div>}><Putaway key={active.id} data={data} name={active.name} warehouseId={active.id} onSave={save} onWarehouse={warehouseManager}/></Suspense>}
          {page === "build" && (
            <Suspense
              fallback={<div className="empty">Baumodus wird geladen …</div>}
            >
              <Builder
                key={active.id}
                data={data}
                onChange={save}
                onOpenSlot={show}
              />
            </Suspense>
          )}
          {page === "overview" && (
            <>
              <div className="warehouse-toolbar">
                {canAssign&&<button className="primary" onClick={()=>setPage('putaway')}>Einräum-Modus öffnen</button>}
                <div className="tabs">
                  {[
                    ["plan", "Lagerplan", Map],
                    ["3d", "3D-Ansicht", Layers3],
                    ["2d", "2D-Regalansicht", Grid2X2],
                  ].map(([v, t, I]) => (
                    <button
                      className={view === v ? "selected" : ""}
                      key={String(v)}
                      onClick={() => setView(String(v))}
                    >
                      {React.createElement(I, { size: 16 })}
                      {String(t)}
                    </button>
                  ))}
                </div>
                <div className="filters">
                  <select
                    aria-label="Gebäude filtern"
                    value={building}
                    onChange={(e) => {
                      setBuilding(e.target.value);
                      setSelected("");
                      setFocus(undefined);
                      setRackFilter("all");
                    }}
                  >
                    <option value="all">Alle Gebäude</option>
                    {active.buildings.map((b) => (
                      <option key={b} value={b}>
                        Gebäude {b}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Regal filtern"
                    value={rackFilter}
                    onChange={(e) => {
                      setRackFilter(e.target.value);
                      setSelected("");
                      setFocus(data.racks.find((r) => r.id === e.target.value));
                    }}
                  >
                    <option value="all">Alle Regale</option>
                    {data.racks.map((r) => (
                      <option key={r.id} value={r.id}>
                        Regal {r.number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {view === "3d" && (
                <div className="scene-tools">
                  <div className="camera-presets" aria-label="Kameraansichten">
                    {(
                      [
                        ["overview", "Gesamtübersicht"],
                        ["front", "Vorne"],
                        ["side", "Seitlich"],
                        ["top", "Oben"],
                      ] as const
                    ).map(([m, t]) => (
                      <button
                        key={m}
                        className={cameraMode === m ? "selected" : ""}
                        aria-pressed={cameraMode === m}
                        onClick={() => {
                          setCameraMode(m);
                          if (m === "overview") setFocus(undefined);
                          setReset((n) => n + 1);
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <label className="check-label">
                    <input
                      aria-label="Alle Beschriftungen anzeigen"
                      type="checkbox"
                      checked={showLabels}
                      onChange={(e) => setShowLabels(e.target.checked)}
                    />{" "}
                    Beschriftungen
                  </label>
                  {data.layout && (
                    <select
                      aria-label="Wände in Lageransicht"
                      value={wallMode}
                      onChange={(e) =>
                        setWallMode(e.target.value as typeof wallMode)
                      }
                    >
                      <option value="cutaway">Offene Halle</option>
                      <option value="all">Alle Wände</option>
                      <option value="none">Wände aus</option>
                    </select>
                  )}
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={showBoxes}
                      onChange={(e) => setShowBoxes(e.target.checked)}
                    />{" "}
                    Lagerkästen
                  </label>
                  <details className="area-visibility">
                    <summary>Bereiche ein-/ausblenden</summary>
                    <div className="area-menu">
                      {visible.map((r) => (
                        <fieldset key={r.id}>
                          <legend>Regal {r.number}</legend>
                          {r.areas.map((a) => (
                            <label className="check-label" key={a.id}>
                              <input
                                aria-label={`Bereich ${r.number} ${a.name} anzeigen`}
                                type="checkbox"
                                checked={!hidden.includes(a.id)}
                                onChange={(e) =>
                                  setHidden(
                                    e.target.checked
                                      ? hidden.filter((id) => id !== a.id)
                                      : [...hidden, a.id],
                                  )
                                }
                              />
                              {a.name}
                            </label>
                          ))}
                        </fieldset>
                      ))}
                    </div>
                  </details>
                </div>
              )}
              <div className={"warehouse-layout " + (sel ? "has-details" : "")}>
                <section className="viewport">
                  <div className="viewport-title">
                    <div>
                      <i className="live-dot" />{" "}
                      {building === "all"
                        ? "Lagerübersicht"
                        : `Gebäude ${building}`}{" "}
                      <span className="muted">
                        / {visible.length} Regale · Schematisches Modell
                      </span>
                    </div>
                    {view === "3d" && (
                      <button
                        onClick={() => {
                          setFocus(undefined);
                          setCameraMode("overview");
                          setReset((n) => n + 1);
                        }}
                      >
                        <RotateCcw size={14} /> Ansicht zurücksetzen
                      </button>
                    )}
                  </div>
                  <div
                    className={"canvas-area " + (view !== "3d" ? "scroll" : "")}
                  >
                    {!visible.length && !sceneData.layout?.halls.length ? (
                      <div className="empty">
                        <Boxes size={40} />
                        <h3>Noch kein Regal vorhanden</h3>
                        <p>
                          Legen Sie ein Regal an oder ändern Sie den Filter.
                        </p>
                        <button onClick={() => rackForm()}>
                          Regal hinzufügen
                        </button>
                      </div>
                    ) : view === "3d" ? (
                      <Suspense
                        fallback={
                          <div className="empty">3D-Ansicht wird geladen …</div>
                        }
                      >
                        <Scene
                          key={active.id}
                          data={sceneData}
                          showLabels={showLabels}
                          wallMode={wallMode}
                          offsets={offsets}
                          selected={selected}
                          onSelect={select}
                          spread={spread}
                          reset={reset}
                          focus={visible.find((r) => r.id === focus?.id)}
                          mode={cameraMode}
                          hidden={hidden}
                          boxes={showBoxes}
                          onRackSelect={(r) => {
                            setFocus(r);
                            setSelected("");
                          }}
                        />
                      </Suspense>
                    ) : view === "plan" ? (
                      sceneData.layout ? (
                        <BuilderPlan
                          data={sceneData}
                          showLabels={showLabels}
                          onRackOpen={(r) => {
                            setFocus(r);
                            setView("2d");
                            setRackFilter(r.id);
                          }}
                        />
                      ) : (
                        <WarehousePlan
                          racks={visible}
                          selected={focus?.id}
                          onSelect={(r) => {
                            setFocus(r);
                            setView("2d");
                            setRackFilter(r.id);
                          }}
                        />
                      )
                    ) : (
                      <div className="rack-grids">
                        {visible.map((r) => (
                          <div key={r.id}>
                            <h3>
                              Regal {r.number}{" "}
                              <small>
                                {r.name} · Gebäude {r.building}
                              </small>
                            </h3>
                            {r.areas
                              .filter((a) => !hidden.includes(a.id))
                              .map((a) => (
                                <div className="area-grid" key={a.id}>
                                  <div className="area-heading">
                                    <b>{a.name}</b>
                                    <small>
                                      {a.columns} Spalten × {a.levels} Ebenen
                                    </small>
                                  </div>
                                  <div
                                    className="slots-grid"
                                    style={{
                                      gridTemplateColumns: `repeat(${a.columns},minmax(36px,1fr))`,
                                    }}
                                  >
                                    {Array.from(
                                      { length: a.columns * a.levels },
                                      (_, i) => {
                                        const n =
                                            (a.levels -
                                              1 -
                                              Math.floor(i / a.columns)) *
                                              a.columns +
                                            (i % a.columns) +
                                            1,
                                          s = r.slots.find(
                                            (s) =>
                                              s.areaId === a.id &&
                                              s.number === n,
                                          );
                                        return s ? (
                                          <button
                                            title={code(r, s)}
                                            aria-label={code(r, s)}
                                            key={n}
                                            className={`${occupied.has(s.id) ? "occupied" : ""} ${selected === s.id ? "chosen" : ""}`}
                                            onClick={() => select(r, s)}
                                          >
                                            {s.name ||
                                              String(n).padStart(2, "0")}
                                          </button>
                                        ) : (
                                          <span
                                            key={n}
                                            className="missing-slot"
                                          >
                                            —
                                          </span>
                                        );
                                      },
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="viewport-footer">
                    <div className="legend">
                      <span>
                        <i /> Frei
                      </span>
                      <span>
                        <i className="occupied" /> Belegt
                      </span>
                      <span>
                        <i className="chosen" /> Ausgewählt
                      </span>
                    </div>
                    {view === "3d" ? (
                      <label>
                        <input
                          type="checkbox"
                          checked={spread}
                          onChange={(e) => setSpread(e.target.checked)}
                        />{" "}
                        Bereiche auseinanderziehen
                      </label>
                    ) : (
                      <small>Alle Ansichten sind synchronisiert</small>
                    )}
                  </div>
                  {view === "3d" && (
                    <div className="mouse-help">
                      Ziehen: drehen · Scrollen: zoomen · Rechts ziehen:
                      verschieben
                    </div>
                  )}
                </section>
                {sel && (
                  <aside className="details">
                    <div className="details-title">
                      <h3>Fachdetails</h3>
                      {sel && (
                        <button
                          aria-label="Auswahl schließen"
                          onClick={() => setSelected("")}
                        >
                          <X size={17} />
                        </button>
                      )}
                    </div>
                    {sel ? (
                      <>
                        <span
                          className={
                            "status " + (occupied.has(selected) ? "filled" : "")
                          }
                        >
                          {occupied.has(selected) ? "Belegt" : "Frei"}
                        </span>
                        <h2 className="slot-code">{sel.c}</h2>
                        <p className="slot-location">
                          Gebäude {sel.r.building} › Regal {sel.r.number}
                          <br />
                          {
                            sel.r.areas.find((a) => a.id === sel.s.areaId)?.name
                          }{" "}
                          · Fach {sel.s.number}
                        </p>
                        <div className="divider" />
                        <div className="section-title">
                          <b>Materialien</b>
                          <span>
                            {
                              data.stock.filter((b) => b.slotId === selected)
                                .length
                            }
                          </span>
                        </div>
                        {data.stock
                          .filter((b) => b.slotId === selected)
                          .map((b) => {
                            const m = data.materials.find(
                              (m) => m.id === b.materialId,
                            )!;
                            return (
                              <div className="stock-card" key={b.id}>
                                <small>{m.number}</small>
                                <b>{m.name}</b>
                                <div>
                                  <strong>
                                    {b.quantity.toLocaleString("de-DE")}{" "}
                                    <small>Stk.</small>
                                  </strong>
                                  <button
                                    onClick={() =>
                                      setModal(
                                        <MoveForm
                                          data={data}
                                          stockId={b.id}
                                          onClose={() => setModal(null)}
                                          onSave={(target, amount) => {
                                            try {
                                              if (
                                                save(
                                                  transfer(
                                                    data,
                                                    b.id,
                                                    target,
                                                    amount,
                                                  ),
                                                )
                                              )
                                                setModal(null);
                                            } catch (e) {
                                              setToast((e as Error).message);
                                            }
                                          }}
                                        />,
                                      )
                                    }
                                  >
                                    Umlagern <ArrowUpRight size={13} />
                                  </button>
                                </div>
                                <button
                                  className="text-danger"
                                  onClick={() =>
                                    confirm("Bestand ausbuchen?", () =>
                                      save({
                                        ...data,
                                        stock: data.stock.filter(
                                          (v) => v.id !== b.id,
                                        ),
                                      }),
                                    )
                                  }
                                >
                                  Bestand ausbuchen
                                </button>
                              </div>
                            );
                          })}
                        {data.materials.filter(m=>m.assignedSlotIds?.includes(selected) && !data.stock.some(b=>b.materialId===m.id && b.slotId===selected)).map(m=><div className="stock-card" key={m.id}><small>{m.number}</small><b>{m.name}</b><p>Zugeordnet · keine Bestandsmenge erfasst</p><button onClick={()=>materialForm(m)}>Material bearbeiten</button></div>)}
                        {!occupied.has(selected) && !data.materials.some(m=>m.assignedSlotIds?.includes(selected)) && (
                          <p className="empty-small">
                            Dieses Fach ist frei. Ordnen Sie ein Material zu.
                          </p>
                        )}
                        {data.checklist?.filter(e=>e.slotId===selected&&(e.status||e.note)).map(e=><div className="stock-card" key={e.id}><b>Prüfung: {e.status||'offen (leer)'}</b><p>{e.note}</p><small>Alter Platz: {e.oldLocation||'–'}</small></div>)}
                        <button
                          className="primary full"
                          onClick={() => assign()}
                        >
                          <Plus size={15} /> Material zuordnen
                        </button>
                        {sel.r.areas.length > 1 && (
                          <SegmentControls
                            rack={sel.r}
                            spread={spread}
                            setSpread={setSpread}
                            offsets={offsets}
                            setOffsets={setOffsets}
                            hidden={hidden}
                            setHidden={setHidden}
                          />
                        )}
                        <div className="slot-actions">
                          <button
                            onClick={() =>
                              setModal(
                                <RenameForm
                                  value={sel.c}
                                  onClose={() => setModal(null)}
                                  onSave={(name) => {
                                    if (
                                      save({
                                        ...data,
                                        racks: data.racks.map((r) =>
                                          r.id === sel.r.id
                                            ? {
                                                ...r,
                                                slots: r.slots.map((s) =>
                                                  s.id === selected
                                                    ? { ...s, name }
                                                    : s,
                                                ),
                                              }
                                            : r,
                                        ),
                                      })
                                    )
                                      setModal(null);
                                  }}
                                />,
                              )
                            }
                          >
                            <Pencil size={14} /> Umbenennen
                          </button>
                          <button
                            className="text-danger"
                            onClick={() => {
                              if (occupied.has(selected)) {
                                setToast(
                                  "Belegtes Fach kann nicht entfernt werden. Bitte zuerst umlagern.",
                                );
                                return;
                              }
                              confirm("Fach entfernen?", () => {
                                save({
                                  ...data,
                                  racks: data.racks.map((r) =>
                                    r.id === sel.r.id
                                      ? {
                                          ...r,
                                          slots: r.slots.filter(
                                            (s) => s.id !== selected,
                                          ),
                                        }
                                      : r,
                                  ),
                                });
                                setSelected("");
                              });
                            }}
                          >
                            <Trash2 size={14} /> Entfernen
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="details-empty">
                        <span>
                          <Box size={38} strokeWidth={1} />
                        </span>
                        <h3>Ein Platz für Details.</h3>
                        <p>
                          Wählen Sie ein Fach im Lager, um Materialien und
                          Belegung anzuzeigen.
                        </p>
                        <div className="tip">
                          <b>Gut zu wissen</b>
                          <p>
                            Mit der Suche finden Sie Materialien und springen
                            direkt zum richtigen Lagerplatz.
                          </p>
                        </div>
                      </div>
                    )}
                  </aside>
                )}
              </div>
              <div className="demo-note">
                <span>i</span>
                <p>
                  <b>Ihr Lager, Ihre Struktur.</b> Schematisches Modell · Maße
                  vor Ort prüfen. Verschiebesegmente werden vereinfacht
                  dargestellt.
                </p>
                <button onClick={() => setPage("edit")}>
                  Lager bearbeiten <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          )}
          {page === "materials" && (
            <section className="panel">
              <div className="panel-heading">
                <h3>
                  Materialverzeichnis{" "}
                  <span className="count">{data.materials.length}</span>
                </h3>
                {!!data.importReview?.length && <button onClick={()=>setModal(<Suspense fallback={<p>Prüfung wird geladen …</p>}><MaterialImport data={data} warehouse={active.name} initialRows={data.importReview} onClose={()=>setModal(null)} onSave={save}/></Suspense>)}>Importprüfung öffnen ({data.importReview.length})</button>}
                <button onClick={()=>setModal(<Suspense fallback={<p>Import wird geladen …</p>}><MaterialImport data={data} warehouse={active.name} onClose={()=>setModal(null)} onSave={save}/></Suspense>)} disabled={blocked}><Upload size={15}/> Excel importieren</button>
                <button
                  onClick={() => assign("")}
                  disabled={!slots.length || !data.materials.length}
                >
                  <Plus size={15} /> Bestand zuordnen
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Materialnummer</th>
                      <th>Bezeichnung</th>
                      <th>Gesamtbestand</th>
                      <th>Lagerplätze</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.materials.filter(m=>!query.trim() || materialMatches(m,query)).map((m) => {
                      const bs = data.stock.filter(
                        (b) => b.materialId === m.id,
                      );
                      return (
                        <tr key={m.id}>
                          <td className="mono">{m.number}</td>
                          <td>
                            <b>{m.name}</b>
                            <small>{m.description}</small>
                            {!!m.alternativeNames?.length && <small>Alternativen: {m.alternativeNames.join(' · ')}</small>}
                            {!!m.oldLocations?.length && <small>Alte Plätze: {m.oldLocations.join(', ')}</small>}
                            {data.checklist?.filter(e=>e.materialId===m.id&&(e.status||e.note)).map(e=><small key={e.id}>Prüfung: {e.status||'offen (leer)'}{e.note?` · ${e.note}`:''}</small>)}
                            {!!m.pendingLocations?.length && <small className="error">Plätze zur Prüfung: {m.pendingLocations.join(', ')}</small>}
                          </td>
                          <td>
                            {bs
                              .reduce((n, b) => n + b.quantity, 0)
                              .toLocaleString("de-DE")}{" "}
                            Stk.
                          </td>
                          <td>
                            {bs.map((b) => {
                              const x = slots.find((s) => s.s.id === b.slotId)!;
                              return (
                                <button
                                  className="place-link"
                                  key={b.id}
                                  onClick={() => show(x.r, x.s)}
                                  title="Im Lager anzeigen"
                                >
                                  {x.c} ↗
                                </button>
                              );
                            })}
                            {m.assignedSlotIds?.filter(id=>!bs.some(b=>b.slotId===id)).map(id=>{const x=slots.find(s=>s.s.id===id)!;return <button className="place-link" key={id} onClick={()=>show(x.r,x.s)}>{x.c} ↗ <small>ohne Bestandsmenge</small></button>;})}
                            {!bs.length && !m.assignedSlotIds?.length && (
                              <span className="muted">
                                Noch nicht zugeordnet
                              </span>
                            )}
                          </td>
                          <td>
                            <button onClick={()=>setModal(<MaterialLocationForm data={data} material={m} onClose={()=>setModal(null)} onSave={next=>{if(save({...data,materials:data.materials.map(v=>v.id===m.id?next:v)}))setModal(null);}}/>)}>Fach zuordnen</button>
                            <button
                              aria-label={`${m.number} bearbeiten`}
                              onClick={() => materialForm(m)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              aria-label={`${m.number} löschen`}
                              onClick={() => {
                                if (bs.length) {
                                  setToast(
                                    "Material hat noch Bestand. Bitte zuerst ausbuchen.",
                                  );
                                  return;
                                }
                                confirm("Material löschen?", () =>
                                  save({
                                    ...data,
                                    materials: data.materials.filter(
                                      (v) => v.id !== m.id,
                                    ),
                                  }),
                                );
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!data.materials.length && (
                  <div className="empty">
                    Noch keine Materialien. Legen Sie Ihr erstes Material an.
                  </div>
                )}
              </div>
            </section>
          )}
          {page === "edit" && (
            <>
              <section className="panel structure-actions"><b>Excel · {active.name}</b><button onClick={async()=>{try{const {downloadStructure}=await import('./structureExcel');await downloadStructure(data,active.name,false,true);}catch(e){setToast((e as Error).message);}}}><Download size={15}/> Kontrollliste exportieren</button><button disabled={blocked} onClick={()=>setModal(<Suspense fallback={<p>Kontrollliste wird geladen …</p>}><ChecklistImport data={data} name={active.name} onSave={save} onClose={()=>setModal(null)}/></Suspense>)}><Upload size={15}/> Kontrollliste importieren</button><button onClick={async()=>{try{const {downloadStructure}=await import('./structureExcel');await downloadStructure(data,active.name);}catch(e){setToast((e as Error).message);}}}><Download size={15}/> Lagerstruktur exportieren</button><button onClick={async()=>{try{const {downloadStructure}=await import('./structureExcel');await downloadStructure(data,active.name,true);}catch(e){setToast((e as Error).message);}}}>Vorlage für neue Regale herunterladen</button><button onClick={()=>setModal(<Suspense fallback={<p>Strukturimport wird geladen …</p>}><StructureImport data={data} name={active.name} onSave={save} onClose={()=>setModal(null)}/></Suspense>)} disabled={blocked}><Upload size={15}/> Regalstruktur importieren</button></section>
              <section className="panel edit-plan-panel">
                <div className="panel-heading">
                  <h3>Lagerplan bearbeiten</h3>
                  <button onClick={buildingManager}>
                    <Plus size={14} /> Gebäude hinzufügen
                  </button>
                </div>
                <div className="edit-plan-stage">
                  <WarehousePlan
                    racks={data.racks}
                    selected={focus?.id}
                    onSelect={setFocus}
                    editing
                    onChange={(r) => {
                      save({
                        ...data,
                        racks: data.racks.map((v) => (v.id === r.id ? r : v)),
                      });
                    }}
                  />
                </div>
                <div className="building-list">
                  Gebäude in {active.name}:{" "}
                  {active.buildings.join(", ") || "noch keine"}
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h3>Regale & Struktur</h3>
                  <span className="muted">Maße und Positionen in Metern</span>
                </div>
                <div className="rack-list">
                  {data.racks.map((r) => (
                    <article className="rack-card" key={r.id}>
                      <div className="rack-illustration">
                        <Boxes size={40} strokeWidth={1.2} />
                      </div>
                      <div className="rack-card-content">
                        <small>GEBÄUDE {r.building}</small>
                        <h3>
                          Regal {r.number} · {r.name}
                        </h3>
                        <p>
                          {r.width} × {r.height} × {r.depth} m ·{" "}
                          {r.slots.length} Fächer · {r.areas.length} Bereiche
                        </p>
                        <p>
                          Position {r.x} / {r.z} m · Drehung {r.rotation}°
                        </p>
                        <div className="area-tags">
                          {r.areas.map((a) => (
                            <span key={a.id}>
                              {a.name}: {a.columns} × {a.levels}
                            </span>
                          ))}
                        </div>
                        <div className="actions">
                          <button onClick={() => rackForm(r)}>
                            <Pencil size={14} /> Bearbeiten
                          </button>
                          <button onClick={() => duplicate(r)}>
                            <Copy size={14} /> Duplizieren
                          </button>
                          <button
                            onClick={() =>
                              setModal(
                                <AddSlotForm
                                  rack={r}
                                  onClose={() => setModal(null)}
                                  onSave={(next) => {
                                    if (
                                      save({
                                        ...data,
                                        racks: data.racks.map((v) =>
                                          v.id === r.id ? next : v,
                                        ),
                                      })
                                    )
                                      setModal(null);
                                  }}
                                />,
                              )
                            }
                          >
                            <Plus size={14} /> Fach hinzufügen
                          </button>
                          <button
                            className="text-danger"
                            onClick={() => removeRack(r)}
                          >
                            <Trash2 size={14} /> Löschen
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {!data.racks.length && (
                    <div className="empty">
                      Noch keine Regale. Mit „Regal hinzufügen“ beginnen.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
          <footer>
            LAGERRAUM <span>Ein guter Platz für alles.</span>
            <span>{remote?'Zentrale Lagerdaten · Benutzerrechte aktiv':'Browser-Speicher · Keine Cloud-Synchronisierung'}</span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Meldung schließen" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className={
              "modal " +
              (React.isValidElement(modal) && (modal.type === RackEditor || modal.type === Suspense)
                ? "wide-modal"
                : "")
            }
            role="dialog"
            aria-modal="true"
            aria-label="Bearbeiten"
          >
            <button
              className="modal-close"
              aria-label="Dialog schließen"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal}
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value.toLocaleString("de-DE")}</div>
      <small>{note}</small>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string }>, {
            id,
          })
        : children}
    </div>
  );
}
function MaterialForm({
  material,
  onClose,
  onSave,
}: {
  material?: Material;
  onClose: () => void;
  onSave: (m: Material) => void;
}) {
  const [m, setM] = useState<Material>(
    material || { id: uid(), number: "", name: "", description: "" },
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({...m,alternativeNames:[...new Set((m.alternativeNames || []).filter(v=>v.trim()))],oldLocations:[...new Set((m.oldLocations || []).filter(v=>v.trim()))]});
      }}
    >
      <h2>{material ? "Material bearbeiten" : "Material hinzufügen"}</h2>
      <Field label="Materialnummer (Text)">
        <input
          required
          value={m.number}
          onChange={(e) => setM({ ...m, number: e.target.value })}
        />
      </Field>
      <Field label="Materialbezeichnung">
        <input
          required
          value={m.name}
          onChange={(e) => setM({ ...m, name: e.target.value })}
        />
      </Field>
      <Field label="Beschreibung (optional)">
        <textarea
          value={m.description}
          onChange={(e) => setM({ ...m, description: e.target.value })}
        />
      </Field>
      <Field label="Alternative Bezeichnungen (eine pro Zeile)"><textarea value={(m.alternativeNames || []).join('\n')} onChange={e=>setM({...m,alternativeNames:e.target.value.split('\n')})}/></Field>
      <Field label="Alte Lagerplätze (einer pro Zeile)"><textarea value={(m.oldLocations || []).join('\n')} onChange={e=>setM({...m,oldLocations:e.target.value.split('\n')})}/></Field>
      {!!m.pendingLocations?.length && <p>Offene Platzangaben: {m.pendingLocations.join(', ')}</p>}
      <div className="actions form-actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button className="primary">Material speichern</button>
      </div>
    </form>
  );
}
function SlotSelect({
  data,
  value,
  onChange,
  exclude,
  id,
  required = true,
}: {
  data: Data;
  value: string;
  onChange: (s: string) => void;
  exclude?: string;
  id?: string;
  required?: boolean;
}) {
  return (
    <select
      id={id}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Lagerplatz wählen</option>
      {data.racks.map((r) => (
        <optgroup
          key={r.id}
          label={`Gebäude ${r.building} · Regal ${r.number}`}
        >
          {r.slots
            .filter((s) => s.id !== exclude)
            .map((s) => (
              <option value={s.id} key={s.id}>
                {code(r, s)}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
function StockForm({
  data,
  slotId,
  onClose,
  onSave,
}: {
  data: Data;
  slotId: string;
  onClose: () => void;
  onSave: (m: string, s: string, n: number) => void;
}) {
  const [m, setM] = useState(""),
    [s, setS] = useState(slotId),
    [n, setN] = useState(1);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(m, s, n);
      }}
    >
      <h2>Material zuordnen</h2>
      <Field label="Material">
        <select required value={m} onChange={(e) => setM(e.target.value)}>
          <option value="">Material wählen</option>
          {data.materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.number} · {m.name}
            </option>
          ))}
        </select>
      </Field>
      {!data.materials.length && (
        <p className="error">
          Bitte zuerst unter „Materialien“ ein Material erstellen.
        </p>
      )}
      <Field label="Lagerplatz">
        <SlotSelect data={data} value={s} onChange={setS} />
      </Field>
      <Field label="Menge (Stück)">
        <input
          type="number"
          required
          min="1"
          max="1000000000000"
          step="1"
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
        />
      </Field>
      <div className="actions form-actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button className="primary" disabled={!data.materials.length}>
          Zuordnen
        </button>
      </div>
    </form>
  );
}
function MoveForm({
  data,
  stockId,
  onClose,
  onSave,
}: {
  data: Data;
  stockId: string;
  onClose: () => void;
  onSave: (s: string, n: number) => void;
}) {
  const b = data.stock.find((b) => b.id === stockId)!;
  const [s, setS] = useState(""),
    [n, setN] = useState(b.quantity);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(s, n);
      }}
    >
      <h2>Material umlagern</h2>
      <p>
        {data.materials.find((m) => m.id === b.materialId)?.name} · {b.quantity}{" "}
        Stück verfügbar
      </p>
      <Field label="Zielfach">
        <SlotSelect data={data} value={s} onChange={setS} exclude={b.slotId} />
      </Field>
      <Field label="Menge (Stück)">
        <input
          type="number"
          required
          min="1"
          max={b.quantity}
          step="1"
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
        />
      </Field>
      <div className="actions form-actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button className="primary">Umlagern</button>
      </div>
    </form>
  );
}
function RenameForm({
  value,
  onClose,
  onSave,
}: {
  value: string;
  onClose: () => void;
  onSave: (s: string) => void;
}) {
  const [s, setS] = useState(value);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(s);
      }}
    >
      <h2>Fach umbenennen</h2>
      <p>
        Der neue Name ersetzt den angezeigten Lagerplatzcode.
        Materialzuordnungen bleiben erhalten.
      </p>
      <Field label="Lagerplatzcode / Name">
        <input value={s} required onChange={(e) => setS(e.target.value)} />
      </Field>
      <div className="actions form-actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button className="primary">Speichern</button>
      </div>
    </form>
  );
}
function AddSlotForm({
  rack,
  onClose,
  onSave,
}: {
  rack: Rack;
  onClose: () => void;
  onSave: (r: Rack) => void;
}) {
  const [areaId, setAreaId] = useState(rack.areas[0].id),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const a = rack.areas.find((a) => a.id === areaId)!;
        let number = 1;
        while (rack.slots.some((s) => s.areaId === a.id && s.number === number))
          number++;
        const levels = Math.max(a.levels, Math.ceil(number / a.columns));
        if (levels > 20) {
          setError(
            "Dieser Bereich ist voll. Bitte zuerst einen weiteren Bereich anlegen.",
          );
          return;
        }
        onSave({
          ...rack,
          areas: rack.areas.map((v) => (v.id === a.id ? { ...v, levels } : v)),
          slots: [
            ...rack.slots,
            {
              id: uid(),
              areaId,
              number,
              ...(name.trim() ? { name: name.trim() } : {}),
            },
          ],
        });
      }}
    >
      <h2>Einzelnes Fach hinzufügen</h2>
      <p>
        Ein freier Rasterplatz wird genutzt. Bei Bedarf wird eine neue Ebene
        begonnen.
      </p>
      <Field label="Bereich">
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          {rack.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Eigener Fachcode (optional)">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Automatisch erzeugen"
        />
      </Field>
      {error && <p className="error">{error}</p>}
      <div className="actions form-actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button className="primary">Fach hinzufügen</button>
      </div>
    </form>
  );
}
createRoot(document.getElementById("root")!).render(<AuthShell render={remote=><App key={remote?.user.id||'offline'} remote={remote}/>}/>);

function NameForm({
  title,
  label,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  label: string;
  initial: string;
  onClose: () => void;
  onSave: (s: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
    >
      <h2>{title}</h2>
      <Field label={label}>
        <input
          required
          maxLength={80}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="actions form-actions">
        <button type="button" onClick={onClose}>
          Abbrechen
        </button>
        <button className="primary">Speichern</button>
      </div>
    </form>
  );
}
function WarehouseManager({
  warehouses,
  activeId,
  onSwitch,
  onCreate,
  onRename,
  canCreate=true,
  canRename=true,
}: {
  canCreate?: boolean;
  canRename?: boolean;
  warehouses: Warehouse[];
  activeId: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (w: Warehouse) => void;
}) {
  const [name, setName] = useState("");
  return (
    <>
      <div className="eyebrow">ARBEITSBEREICHE</div>
      <h2>Lagerverwaltung</h2>
      <p>Jedes Lager hat eigene Gebäude, Materialien und Bestände.</p>
      <div className="warehouse-options">
        {warehouses.map((w) => (
          <div key={w.id} className={w.id === activeId ? "current" : ""}>
            <button
              aria-label={`Lager ${w.name} auswählen`}
              onClick={() => onSwitch(w.id)}
            >
              <Boxes size={20} />
              <span>
                <b>{w.name}</b>
                <small>
                  {w.data.racks.length} Regale · {w.data.materials.length}{" "}
                  Materialien {w.id === activeId ? "· Aktuell" : ""}
                </small>
              </span>
            </button>
            {canRename&&<button
              aria-label={`Lager ${w.name} umbenennen`}
              title="Lager umbenennen"
              onClick={() => onRename(w)}
            >
              <Pencil size={16} />
            </button>}
          </div>
        ))}
      </div>
      {canCreate&&<form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim());
        }}
      >
        <Field label="Name des neuen Lagers">
          <input
            required
            maxLength={80}
            placeholder="z. B. Werkstattlager"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <button className="primary" disabled={warehouses.length >= 50}>
          <Plus size={16} /> Lager hinzufügen
        </button>
      </form>}
    </>
  );
}

function MaterialLocationForm({data,material,onClose,onSave}:{data:Data;material:Material;onClose:()=>void;onSave:(m:Material)=>void}) {
  const [ids,setIds]=useState(material.assignedSlotIds || []),[target,setTarget]=useState('');
  return <form onSubmit={e=>{e.preventDefault();const selected=[...new Set([...ids,...(target?[target]:[])])];onSave({...material,assignedSlotIds:selected,pendingLocations:material.pendingLocations?.filter(v=>!data.racks.some(r=>r.slots.some(s=>selected.includes(s.id) && code(r,s)===v)))})}}><h2>Fach zuordnen</h2><p>{material.number} · {material.name}</p><p>Zuordnung ohne Bestandsmenge. Mengen werden separat über „Bestand zuordnen“ erfasst.</p>{ids.map(id=><label className="field" key={id}><input type="checkbox" checked onChange={()=>setIds(ids.filter(v=>v!==id))}/>{data.racks.flatMap(r=>r.slots.filter(s=>s.id===id).map(s=>code(r,s))).join('')}</label>)}<Field label="Weiteres Fach"><SlotSelect data={data} value={target} onChange={setTarget} required={false}/></Field><div className="actions form-actions"><button type="button" onClick={onClose}>Abbrechen</button><button className="primary">Zuordnung speichern</button></div></form>;
}
