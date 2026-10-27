import { type Rack, type Slot, type Area } from "./model";
export type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};
export type CameraMode = "overview" | "front" | "side" | "top";
export const baseHeight = (r: Rack) => Math.min(0.16, r.height * 0.08);
export const areaDepth = (r: Rack) => r.depth / r.areas.length;
export const areaZ = (r: Rack, a: Area, spread: boolean) =>
  (r.areas.findIndex((v) => v.id === a.id) - (r.areas.length - 1) / 2) *
  (areaDepth(r) + (spread ? Math.max(0.8, r.depth / 2) : 0));
export function areaOffset(
  r: Rack,
  a: Area,
  spread: boolean,
  offsets: Record<string, number> = {},
): [number, number] {
  const shift = offsets[a.id] || 0;
  return [
    (r.slidingDirection || "x") === "x" ? shift : 0,
    areaZ(r, a, spread) + ((r.slidingDirection || "x") === "z" ? shift : 0),
  ];
}
export function slotPosition(
  r: Rack,
  s: Slot,
  spread: boolean,
  offsets: Record<string, number> = {},
): [number, number, number] {
  const a = r.areas.find((a) => a.id === s.areaId)!,
    offset = areaOffset(r, a, spread, offsets);
  return [
    -r.width / 2 +
      ((((s.number - 1) % a.columns) + 0.5) * r.width) / a.columns +
      offset[0],
    baseHeight(r) +
      ((Math.floor((s.number - 1) / a.columns) + 0.5) *
        (r.height - baseHeight(r))) /
        a.levels,
    offset[1],
  ];
}
export function worldPosition(
  r: Rack,
  p: [number, number, number],
): [number, number, number] {
  const t = (r.rotation * Math.PI) / 180;
  return [
    r.x + p[0] * Math.cos(t) + p[2] * Math.sin(t),
    p[1],
    r.z - p[0] * Math.sin(t) + p[2] * Math.cos(t),
  ];
}
export function boundsFor(
  racks: Rack[],
  spread = false,
  hidden: string[] = [],
  offsets: Record<string, number> = {},
): Bounds {
  const points: [number, number, number][] = [];
  for (const r of racks)
    for (const a of r.areas) {
      if (hidden.includes(a.id)) continue;
      for (const x of [-r.width / 2, r.width / 2])
        for (const z of [-areaDepth(r) / 2, areaDepth(r) / 2])
          for (const y of [0, r.height + 0.5])
            points.push(
              worldPosition(r, [
                x + areaOffset(r, a, spread, offsets)[0],
                y,
                areaOffset(r, a, spread, offsets)[1] + z,
              ]),
            );
    }
  if (!points.length)
    return { minX: -2, maxX: 2, minY: 0, maxY: 3, minZ: -2, maxZ: 2 };
  return {
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minY: 0,
    maxY: Math.max(...points.map((p) => p[1])),
    minZ: Math.min(...points.map((p) => p[2])),
    maxZ: Math.max(...points.map((p) => p[2])),
  };
}
export function fitCamera(
  b: Bounds,
  aspect: number,
  fov = 42,
  mode: CameraMode = "overview",
  direction?: [number, number, number],
) {
  const d =
    direction ||
    (mode === "front"
      ? [0, 0, 1]
      : mode === "side"
        ? [1, 0, 0]
        : mode === "top"
          ? [0, 1, 0.001]
          : b.maxZ - b.minZ > (b.maxX - b.minX) * 0.45
            ? [0.95, 0.65, 1.1]
            : [0.35, 0.5, 1.3]);
  const length = Math.hypot(...d),
    dir = d.map((v) => v / length);
  const right = [dir[2], 0, -dir[0]],
    rl = Math.hypot(...right);
  for (let i = 0; i < 3; i++) right[i] /= rl;
  const up = [
    dir[1] * right[2] - dir[2] * right[1],
    dir[2] * right[0] - dir[0] * right[2],
    dir[0] * right[1] - dir[1] * right[0],
  ];
  const center: [number, number, number] = [
    (b.minX + b.maxX) / 2,
    (b.minY + b.maxY) / 2,
    (b.minZ + b.maxZ) / 2,
  ];
  const tanV = Math.tan((fov * Math.PI) / 360),
    tanH = tanV * Math.max(0.1, aspect);
  let distance = 0.5;
  for (const x of [b.minX, b.maxX])
    for (const y of [b.minY, b.maxY])
      for (const z of [b.minZ, b.maxZ]) {
        const p = [x - center[0], y - center[1], z - center[2]],
          dot = (v: number[]) => p.reduce((n, x, i) => n + x * v[i], 0);
        distance = Math.max(
          distance,
          Math.abs(dot(right)) / tanH + dot(dir),
          Math.abs(dot(up)) / tanV + dot(dir),
        );
      }
  distance *= 1.22;
  return {
    center,
    position: center.map((v, i) => v + dir[i] * distance) as [
      number,
      number,
      number,
    ],
    distance,
  };
}
