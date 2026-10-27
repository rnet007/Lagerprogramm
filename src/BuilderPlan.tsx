import { areaOffset, areaDepth } from "./layout";
import { useRef, useState, useEffect, type PointerEvent } from "react";
import type { Data, Rack } from "./model";
import {
  entities,
  sceneBounds,
  entityPoints,
  wallSegments,
  toWorld,
  type Entity,
} from "./builder";
import { isPath, isOpening, isMarking } from "./builderTypes";
import type { BuildConfig } from "./sceneTypes";
export default function BuilderPlan({
  data,
  build,
  showLabels = true,
  onRackOpen,
  wallMode = "all",
  offsets = {},
  spread = false,
  hidden = [],
}: {
  data: Data;
  build?: BuildConfig;
  showLabels?: boolean;
  onRackOpen?: (r: Rack) => void;
  wallMode?: "all" | "none" | "cutaway";
  offsets?: Record<string, number>;
  spread?: boolean;
  hidden?: string[];
}) {
  const svg = useRef<SVGSVGElement>(null),
    gesture = useRef<{
      ids: string[];
      start: { x: number; z: number };
      center: { x: number; z: number };
      angle: number;
    } | null>(null),
    last = useRef({ dx: 0, dz: 0, angle: 0 }),
    [drag, setDrag] = useState({ ids: [] as string[], dx: 0, dz: 0, angle: 0 }),
    [size, setSize] = useState({ width: 1000, height: 500 }),
    [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!svg.current) return;
    const o = new ResizeObserver(([e]) =>
      setSize({ width: e.contentRect.width, height: e.contentRect.height }),
    );
    o.observe(svg.current);
    return () => o.disconnect();
  }, []);
  const b = sceneBounds(data),
    pad = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.08 + 1,
    w = (b.maxX - b.minX + pad * 2) / zoom,
    h = (b.maxZ - b.minZ + pad * 2) / zoom,
    x = (b.minX + b.maxX - w) / 2,
    z = (b.minZ + b.maxZ - h) / 2,
    fs =
      12 * Math.max(w / Math.max(size.width, 1), h / Math.max(size.height, 1));
  function point(e: { clientX: number; clientY: number }) {
    const t = svg.current?.getScreenCTM();
    if (!t) return { x: 0, z: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(t.inverse());
    return { x: p.x, z: p.y };
  }
  function start(e: PointerEvent, o: Entity) {
    if (!build || build.placing || build.tool === "select" || o.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const ids = build.selectedIds.includes(o.id) ? build.selectedIds : [o.id],
      selected = entities(data).filter((v) => ids.includes(v.id) && !v.locked),
      center = {
        x: selected.reduce((s, v) => s + v.x, 0) / selected.length,
        z: selected.reduce((s, v) => s + v.z, 0) / selected.length,
      },
      p = point(e);
    gesture.current = {
      ids: selected.map((o) => o.id),
      start: p,
      center,
      angle: Math.atan2(p.z - center.z, p.x - center.x),
    };
    last.current = { dx: 0, dz: 0, angle: 0 };
    svg.current?.setPointerCapture(e.pointerId);
    if (!build.selectedIds.includes(o.id)) build.onPick(o.id, e.shiftKey);
  }
  function move(e: PointerEvent) {
    const p = point(e);
    if (build?.placing) {
      build.onFloorMove(p);
      return;
    }
    const g = gesture.current;
    if (!g || !build) return;
    const snap = (n: number) =>
      build.step ? Math.round(n / build.step) * build.step : n;
    const t =
      build.tool === "rotate"
        ? {
            dx: 0,
            dz: 0,
            angle:
              (-(Math.atan2(p.z - g.center.z, p.x - g.center.x) - g.angle) *
                180) /
              Math.PI,
          }
        : { dx: snap(p.x - g.start.x), dz: snap(p.z - g.start.z), angle: 0 };
    last.current = t;
    setDrag({ ...t, ids: g.ids });
  }
  function end(e: PointerEvent, cancel = false) {
    const g = gesture.current;
    if (!g) return;
    if (!cancel)
      build?.onTransform(
        g.ids,
        last.current.dx,
        last.current.dz,
        last.current.angle,
        g.center,
      );
    gesture.current = null;
    setDrag({ ids: [], dx: 0, dz: 0, angle: 0 });
    if (svg.current?.hasPointerCapture(e.pointerId))
      svg.current.releasePointerCapture(e.pointerId);
  }
  function adjusted(o: Entity) {
    if (!drag.ids.includes(o.id) || !gesture.current) return o;
    const c = gesture.current.center,
      p = toWorld(
        { x: c.x, z: c.z, rotation: drag.angle },
        { x: o.x - c.x, z: o.z - c.z },
      );
    return {
      ...o,
      x: p.x + drag.dx,
      z: p.z + drag.dz,
      rotation: o.rotation + drag.angle,
    };
  }
  function item(original: Entity, ghost = false) {
    const o = ghost ? original : adjusted(original),
      rack = "slots" in o,
      chosen = build?.selectedIds.includes(o.id),
      color = ghost ? "#e9a368" : o.color || "#b5ccc4",
      click = (e: any) => {
        e.stopPropagation();
        if (build?.placing) build.onPlace(point(e));
        else if (build) build.onPick(o.id, e.shiftKey);
        else if (rack) onRackOpen?.(o);
      };
    return (
      <g
        key={o.id}
        data-entity-id={o.id}
        data-kind={o.kind || "shelfRack"}
        transform={`translate(${o.x},${o.z}) rotate(${-o.rotation})`}
        opacity={ghost ? 0.55 : 1}
        pointerEvents={ghost ? "none" : undefined}
        role={ghost ? undefined : "button"}
        tabIndex={ghost ? undefined : 0}
        aria-label={`${o.name}${o.locked ? " · gesperrt" : ""}`}
        onClick={click}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (build) build.onPick(o.id, e.shiftKey);
            else if (rack) onRackOpen?.(o);
          }
        }}
        onPointerDown={(e) => start(e, o)}
        style={{
          cursor: build?.tool === "move" && !o.locked ? "grab" : "pointer",
        }}
      >
        {isPath(o.kind || "") && "points" in o ? (
          <polyline
            points={o.points?.map((p) => `${p.x},${p.z}`).join(" ")}
            stroke={color}
            strokeWidth={o.width}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : o.kind === "wall" ? (
          wallSegments(o as any, data.layout?.objects || [])
            .filter((s) => s.bottom < 0.01)
            .map((s, i) => (
              <rect
                key={i}
                x={s.x - s.width / 2}
                y={-o.depth / 2}
                width={s.width}
                height={o.depth}
                fill="#91a6a8"
              />
            ))
        ) : isOpening(o.kind || "") ? (
          <>
            <rect
              x={-o.width / 2}
              y={-o.depth / 2 - 0.03}
              width={o.width}
              height={o.depth + 0.06}
              fill="#fbfaf1"
              stroke={color}
              strokeWidth={fs * 0.1}
            />
            <path
              d={`M ${-o.width / 2} 0 L ${-o.width / 2} ${o.width} A ${o.width} ${o.width} 0 0 0 ${o.width / 2} 0`}
              fill="none"
              stroke={color}
              strokeWidth={fs * 0.07}
            />
          </>
        ) : (
          <>
            {rack ? (
              o.areas
                .filter((a) => !hidden.includes(a.id))
                .map((a) => {
                  const [ax, az] = areaOffset(o, a, spread, offsets);
                  return (
                    <rect
                      key={a.id}
                      x={-o.width / 2 + ax}
                      y={az - areaDepth(o) / 2}
                      width={o.width}
                      height={areaDepth(o)}
                      fill={color}
                      stroke={chosen ? "#c26b24" : "#607f83"}
                      strokeWidth={fs * 0.09}
                    />
                  );
                })
            ) : (
              <rect
                x={-o.width / 2}
                y={-o.depth / 2}
                width={o.width}
                height={o.depth}
                fill={color}
                fillOpacity={isMarking(o.kind || "") ? 0.7 : 1}
                stroke={chosen ? "#c26b24" : "#607f83"}
                strokeWidth={fs * 0.09}
              />
            )}
            {rack &&
              o.areas.map((a, i) => (
                <line
                  key={a.id}
                  x1={-o.width / 2}
                  x2={o.width / 2}
                  y1={-o.depth / 2 + ((i + 1) * o.depth) / o.areas.length}
                  y2={-o.depth / 2 + ((i + 1) * o.depth) / o.areas.length}
                  stroke="#f7faf8"
                  strokeWidth={fs * 0.07}
                />
              ))}
            {o.kind === "crossing" &&
              Array.from({ length: 6 }, (_, i) => (
                <rect
                  key={i}
                  x={-o.width * 0.45}
                  y={-o.depth / 2 + ((i + 0.25) * o.depth) / 6}
                  width={o.width * 0.9}
                  height={o.depth / 12}
                  fill="#fffdf4"
                />
              ))}
            {o.kind === "arrow" && (
              <path
                d={`M 0 ${o.depth * 0.4} L ${-o.width * 0.35} 0 L ${-o.width * 0.12} 0 L ${-o.width * 0.12} ${-o.depth * 0.4} L ${o.width * 0.12} ${-o.depth * 0.4} L ${o.width * 0.12} 0 L ${o.width * 0.35} 0 Z`}
                fill="#fbf9e9"
              />
            )}
            {o.kind === "forklift" && (
              <>
                <rect
                  x={-o.width * 0.3}
                  y={-o.depth * 0.35}
                  width={o.width * 0.6}
                  height={o.depth * 0.35}
                  fill="#566f7a"
                />
                {[-1, 1].map((side) => (
                  <rect
                    key={side}
                    x={side * o.width * 0.25 - 0.06}
                    y="0"
                    width=".12"
                    height={o.depth * 0.5}
                    fill="#627983"
                  />
                ))}
              </>
            )}
          </>
        )}
        {chosen && (
          <rect
            x={-o.width / 2 - fs * 0.2}
            y={-o.depth / 2 - fs * 0.2}
            width={o.width + fs * 0.4}
            height={o.depth + fs * 0.4}
            fill="none"
            stroke="#df7f31"
            strokeWidth={fs * 0.17}
            strokeDasharray={`${fs * 0.4} ${fs * 0.2}`}
          />
        )}
        {showLabels &&
          (chosen || (!rack && isMarking(o.kind || "")) || zoom > 1.2) && (
            <text
              transform={`rotate(${o.rotation})`}
              y={chosen ? -o.depth / 2 - fs : 0}
              textAnchor="middle"
              fontSize={fs}
              fill="#304c59"
              paintOrder="stroke"
              stroke="#f6faf7"
              strokeWidth={fs * 0.2}
            >
              {o.name}
              {o.locked ? " 🔒" : ""}
            </text>
          )}
      </g>
    );
  }
  return (
    <div className="builder-plan">
      <svg
        ref={svg}
        aria-label={build ? "Bauplan bearbeiten" : "Hallen-Grundriss"}
        viewBox={`${x} ${z} ${w} ${h}`}
        onPointerMove={move}
        onPointerUp={(e) => end(e)}
        onPointerCancel={(e) => end(e, true)}
        onClick={(e) => {
          if (build?.placing) build.onPlace(point(e));
        }}
        onWheel={(e) =>
          setZoom((z) =>
            Math.min(3, Math.max(0.5, z * (e.deltaY < 0 ? 1.1 : 0.9))),
          )
        }
      >
        <defs>
          <pattern
            id="builderGrid"
            width={build?.step || 1}
            height={build?.step || 1}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${build?.step || 1} 0 L 0 0 0 ${build?.step || 1}`}
              stroke="#9aafb7"
              strokeWidth={fs * 0.025}
              fill="none"
            />
          </pattern>
        </defs>
        <rect x={x} y={z} width={w} height={h} fill="#edf2f3" />
        {data.layout?.halls.map((hall) => (
          <g
            key={hall.id}
            onClick={(e) => {
              if (build && !build.placing) {
                e.stopPropagation();
                build.onHallPick(hall.id);
              }
            }}
          >
            <rect
              x={hall.x - hall.width / 2}
              y={hall.z - hall.depth / 2}
              width={hall.width}
              height={hall.depth}
              fill="#e0e7e2"
              stroke={
                build?.selectedIds.includes(hall.id) ? "#d78235" : "#9cb0ad"
              }
              strokeWidth={fs * 0.12}
            />
            {showLabels && (
              <text
                x={hall.x}
                y={hall.z - hall.depth / 2 - fs * 0.5}
                fontSize={fs * 1.1}
                textAnchor="middle"
                fill="#324e5b"
              >
                {hall.name} · {hall.width} × {hall.depth} m
              </text>
            )}
          </g>
        ))}
        {build?.step && (
          <rect
            x={x}
            y={z}
            width={w}
            height={h}
            fill="url(#builderGrid)"
            pointerEvents="none"
          />
        )}
        {entities(data)
          .filter((o) => wallMode !== "none" || o.kind !== "wall")
          .sort(
            (a, b) =>
              Number(!isMarking(a.kind || "")) -
              Number(!isMarking(b.kind || "")),
          )
          .map((o) => item(o))}
        {build?.ghost && item(build.ghost, true)}
      </svg>
      <div className="builder-plan-scale">
        <span>
          Meter · {build?.step ? `Raster ${build.step} m` : "Raster aus"} ·
          Mausrad: Zoom
        </span>
        <button onClick={() => setZoom(1)}>Gesamtansicht</button>
      </div>
    </div>
  );
}
