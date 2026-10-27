import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { type Rack } from "./model";
import { boundsFor } from "./layout";
type Gesture = {
  id: string;
  mode: "move" | "rotate";
  start: { x: number; z: number };
  rack: Rack;
  bounds: { x: number; y: number; w: number; h: number };
};
export default function WarehousePlan({
  racks,
  selected,
  onSelect,
  onChange,
  editing = false,
}: {
  racks: Rack[];
  selected?: string;
  onSelect: (r: Rack) => void;
  onChange?: (r: Rack) => void;
  editing?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null),
    gesture = useRef<Gesture | null>(null),
    latest = useRef<Rack | null>(null),
    [draft, setDraft] = useState<Rack | null>(null),
    [active, setActive] = useState(false);
  const [size, setSize] = useState({ width: 1000, height: 350 });
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const b = useMemo(() => boundsFor(racks), [racks]);
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 3),
    pad = span * 0.13 + 1;
  const bounds =
    active && gesture.current
      ? gesture.current.bounds
      : {
          x: b.minX - pad,
          y: b.minZ - pad,
          w: b.maxX - b.minX + pad * 2,
          h: b.maxZ - b.minZ + pad * 2,
        };
  const fs =
      12 *
      Math.max(
        bounds.w / Math.max(1, size.width),
        bounds.h / Math.max(1, size.height),
      ),
    step = span > 80 ? 10 : span > 30 ? 5 : span > 10 ? 2 : 1;
  function point(e: PointerEvent) {
    const p = new DOMPoint(e.clientX, e.clientY);
    const t = svg.current?.getScreenCTM();
    if (!t) return { x: 0, z: 0 };
    const q = p.matrixTransform(t.inverse());
    return { x: q.x, z: q.y };
  }
  function begin(e: PointerEvent, r: Rack, mode: "move" | "rotate") {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(r);
    svg.current?.setPointerCapture(e.pointerId);
    gesture.current = { id: r.id, mode, start: point(e), rack: r, bounds };
    latest.current = r;
    setDraft(r);
    setActive(true);
  }
  function move(e: PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const p = point(e),
      round = (v: number) =>
        Math.round(Math.max(-1000, Math.min(1000, v)) * 10) / 10;
    const next =
      g.mode === "move"
        ? {
            ...g.rack,
            x: round(g.rack.x + p.x - g.start.x),
            z: round(g.rack.z + p.z - g.start.z),
          }
        : {
            ...g.rack,
            rotation: Math.round(
              ((-(
                (Math.atan2(p.z - g.rack.z, p.x - g.rack.x) * 180) / Math.PI +
                90
              ) +
                540) %
                360) -
                180,
            ),
          };
    latest.current = next;
    setDraft(next);
  }
  function finish(e: PointerEvent, cancel = false) {
    if (!gesture.current) return;
    if (!cancel && latest.current) onChange?.(latest.current);
    gesture.current = null;
    latest.current = null;
    setDraft(null);
    setActive(false);
    if (svg.current?.hasPointerCapture(e.pointerId))
      svg.current.releasePointerCapture(e.pointerId);
  }
  const shown = racks.map((r) => (draft?.id === r.id ? draft : r));
  return (
    <div className={"warehouse-plan " + (editing ? "editing" : "")}>
      <svg
        ref={svg}
        role="img"
        aria-label={editing ? "Lagerplan bearbeiten" : "Lagerplan von oben"}
        viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
        onPointerMove={move}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
      >
        <defs>
          <pattern
            id={editing ? "edit-grid" : "overview-grid"}
            width={step}
            height={step}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${step} 0 L 0 0 0 ${step}`}
              fill="none"
              stroke="#c4d0d5"
              strokeWidth={fs * 0.04}
            />
          </pattern>
        </defs>
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.w}
          height={bounds.h}
          fill={`url(#${editing ? "edit-grid" : "overview-grid"})`}
        />
        {shown.map((r) => (
          <g
            key={r.id}
            data-rack-id={r.id}
            transform={`translate(${r.x},${r.z}) rotate(${-r.rotation})`}
            role="button"
            tabIndex={0}
            aria-label={`Regal ${r.number}${editing ? " positionieren" : " öffnen"}`}
            onClick={() => onSelect(r)}
            onPointerDown={(e) => begin(e, r, "move")}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect(r);
              if (editing && onChange) {
                const delta = e.shiftKey ? 1 : 0.1;
                if (
                  [
                    "ArrowLeft",
                    "ArrowRight",
                    "ArrowUp",
                    "ArrowDown",
                    "[",
                    "]",
                  ].includes(e.key)
                ) {
                  e.preventDefault();
                  onChange({
                    ...r,
                    x:
                      r.x +
                      (e.key === "ArrowLeft"
                        ? -delta
                        : e.key === "ArrowRight"
                          ? delta
                          : 0),
                    z:
                      r.z +
                      (e.key === "ArrowUp"
                        ? -delta
                        : e.key === "ArrowDown"
                          ? delta
                          : 0),
                    rotation:
                      r.rotation +
                      (e.key === "[" ? -15 : e.key === "]" ? 15 : 0),
                  });
                }
              }
            }}
            style={{ cursor: editing ? "grab" : "pointer" }}
          >
            <rect
              x={-r.width / 2}
              y={-r.depth / 2}
              width={r.width}
              height={r.depth}
              rx={Math.min(0.08, r.depth * 0.1)}
              fill={selected === r.id ? "#fff0dd" : "#d8e6e1"}
              stroke={selected === r.id ? "#df7b2c" : "#62867d"}
              strokeWidth={fs * 0.12}
            />
            {r.areas.map((a, i) => (
              <line
                key={a.id}
                x1={-r.width / 2}
                x2={r.width / 2}
                y1={-r.depth / 2 + ((i + 1) * r.depth) / r.areas.length}
                y2={-r.depth / 2 + ((i + 1) * r.depth) / r.areas.length}
                stroke="#94afa6"
                strokeWidth={fs * 0.05}
              />
            ))}
            <text
              y={-r.depth / 2 - fs * 0.5}
              transform={`rotate(${r.rotation} 0 ${-r.depth / 2 - fs * 0.5})`}
              paintOrder="stroke"
              stroke="#f8fbfc"
              strokeWidth={fs * 0.25}
              textAnchor="middle"
              fontSize={fs}
              fill="#24424c"
              fontWeight="600"
            >
              Regal {r.number} · {r.building}
            </text>
            <text
              y={fs * 0.2}
              transform={`rotate(${r.rotation} 0 ${fs * 0.2})`}
              paintOrder="stroke"
              stroke="#f1f7f5"
              strokeWidth={fs * 0.2}
              textAnchor="middle"
              fontSize={Math.min(fs * 0.9, r.depth * 0.5)}
              fill="#365a60"
            >
              {r.width.toLocaleString("de-DE")} ×{" "}
              {r.depth.toLocaleString("de-DE")} m
            </text>
            {editing && selected === r.id && (
              <g className="rotation-handle">
                <line
                  x1="0"
                  y1={-r.depth / 2}
                  x2="0"
                  y2={-r.depth / 2 - fs * 2}
                  stroke="#d9792d"
                  strokeWidth={fs * 0.1}
                />
                <circle
                  aria-label={`Regal ${r.number} drehen`}
                  role="button"
                  cx="0"
                  cy={-r.depth / 2 - fs * 2}
                  r={fs * 0.65}
                  fill="#fff"
                  stroke="#d9792d"
                  strokeWidth={fs * 0.12}
                  onPointerDown={(e) => begin(e, r, "rotate")}
                  style={{ cursor: "crosshair" }}
                />
                <text
                  x="0"
                  y={-r.depth / 2 - fs * 1.8}
                  textAnchor="middle"
                  fontSize={fs * 0.6}
                  fill="#aa571d"
                  pointerEvents="none"
                >
                  ↻
                </text>
              </g>
            )}
            {editing && selected === r.id && (
              <text
                y={r.depth / 2 + fs * 1.2}
                transform={`rotate(${r.rotation} 0 ${r.depth / 2 + fs * 1.2})`}
                paintOrder="stroke"
                stroke="#f8fbfc"
                strokeWidth={fs * 0.25}
                textAnchor="middle"
                fontSize={fs * 0.85}
                fill="#9c521d"
              >
                X {r.x.toFixed(1)} m · Z {r.z.toFixed(1)} m · {r.rotation}°
              </text>
            )}
          </g>
        ))}
        <g
          transform={`translate(${bounds.x + fs},${bounds.y + bounds.h - fs * 1.3})`}
        >
          <line
            x1="0"
            y1="0"
            x2={step}
            y2="0"
            stroke="#435e69"
            strokeWidth={fs * 0.13}
          />
          <line
            x1="0"
            y1={-fs * 0.2}
            x2="0"
            y2={fs * 0.2}
            stroke="#435e69"
            strokeWidth={fs * 0.09}
          />
          <line
            x1={step}
            y1={-fs * 0.2}
            x2={step}
            y2={fs * 0.2}
            stroke="#435e69"
            strokeWidth={fs * 0.09}
          />
          <text
            x={step / 2}
            y={-fs * 0.45}
            fontSize={fs * 0.85}
            fill="#435e69"
            textAnchor="middle"
          >
            {step} m
          </text>
        </g>
      </svg>
      <div className="plan-caption">
        {editing
          ? "Regal ziehen · am orangefarbenen Griff drehen · Pfeiltasten: 0,1 m · [ / ]: 15°"
          : "Regal anklicken, um seine Fächer zu öffnen"}
        <span>Raster {step} m · X → · Z ↓</span>
      </div>
    </div>
  );
}
