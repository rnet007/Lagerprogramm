import type { Entity } from "./builder";
import type { Point } from "./builderTypes";
export type BuildTool = "select" | "move" | "rotate";
export type BuildConfig = {
  selectedIds: string[];
  tool: BuildTool;
  step?: number;
  ghost?: Entity;
  placing: boolean;
  onPick: (id: string, shift: boolean) => void;
  onTransform: (
    ids: string[],
    dx: number,
    dz: number,
    angle: number,
    center: Point,
  ) => void;
  onPlace: (p: Point) => void;
  onFloorMove: (p: Point) => void;
  onHallPick: (id: string) => void;
};
