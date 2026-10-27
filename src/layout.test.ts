import { describe, it, expect } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { example } from "./model";
import {
  boundsFor,
  fitCamera,
  slotPosition,
  worldPosition,
  type CameraMode,
} from "./layout";
describe("Gemeinsame Geometrie und Kameraberechnung", () => {
  it("erzeugt passende Fachpositionen und verschiebt Bereiche nur in der Darstellung", () => {
    const r = example().racks[2],
      raw = JSON.stringify(r),
      back = r.slots[0],
      front = r.slots[170];
    expect(slotPosition(r, back, false)[2]).toBeLessThan(
      slotPosition(r, front, false)[2],
    );
    expect(slotPosition(r, back, true)[2]).toBeLessThan(
      slotPosition(r, back, false)[2],
    );
    expect(JSON.stringify(r)).toBe(raw);
    expect(slotPosition(r, r.slots[99], false)[0]).toBeCloseTo(
      r.width / 2 - r.width / 20,
    );
  });
  it("berücksichtigt gedrehte Regale, Positionen, ausgezogene und ausgeblendete Segmente", () => {
    const r = example().racks[2];
    r.rotation = 90;
    r.x = 100;
    r.z = -50;
    const b = boundsFor([r]);
    expect(b.maxX - b.minX).toBeCloseTo(r.depth);
    expect(b.maxZ - b.minZ).toBeCloseTo(r.width);
    const p = worldPosition(r, [r.width / 2, 0, 0]);
    expect(p[0]).toBeCloseTo(100);
    expect(p[2]).toBeCloseTo(-53);
    expect(
      boundsFor([r], true).maxX - boundsFor([r], true).minX,
    ).toBeGreaterThan(r.depth);
    expect(
      boundsFor([r], true, [r.areas[0].id, r.areas[1].id]).maxX -
        boundsFor([r], true, [r.areas[0].id, r.areas[1].id]).minX,
    ).toBeCloseTo(r.depth / 3);
  });
  it("passt alle Regalgrenzen bei vier Kamerarichtungen und unterschiedlichen Ansichtsbreiten ein", () => {
    const racks = example().racks;
    racks[0].rotation = 37;
    racks[0].x = -22;
    racks[1].z = 12;
    const b = boundsFor(racks, true);
    for (const aspect of [0.65, 1.8, 3.5])
      for (const mode of ["overview", "front", "side", "top"] as CameraMode[]) {
        const fit = fitCamera(b, aspect, 42, mode),
          camera = new PerspectiveCamera(42, aspect, 0.01, 100000);
        camera.position.set(...fit.position);
        camera.lookAt(...fit.center);
        camera.updateMatrixWorld();
        for (const x of [b.minX, b.maxX])
          for (const y of [b.minY, b.maxY])
            for (const z of [b.minZ, b.maxZ]) {
              const p = new Vector3(x, y, z).project(camera);
              expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
              expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
              expect(p.z).toBeLessThan(1);
            }
      }
  });
});
