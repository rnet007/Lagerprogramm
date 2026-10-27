import {
  createContext,
  useContext,
  useRef,
  useId,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  SRGBColorSpace,
  Vector3,
  Raycaster,
  type Sprite,
  type SpriteMaterial,
  type Object3D,
} from "three";
type Tier = "hall" | "zone" | "rack" | "slot";
type Entry = {
  sprite: Sprite;
  tier: Tier;
  forced: boolean;
  pixels: number;
  visible: boolean;
  baseY: number;
};
const Context = createContext<React.MutableRefObject<
  Map<string, Entry>
> | null>(null);
export function Labels({
  enabled = true,
  children,
}: {
  enabled?: boolean;
  children: ReactNode;
}) {
  const entries = useRef(new Map<string, Entry>());
  return (
    <Context.Provider value={entries}>
      <Manager enabled={enabled} />
      {children}
    </Context.Provider>
  );
}
function Manager({ enabled }: { enabled: boolean }) {
  const entries = useContext(Context)!;
  const { camera, size, scene } = useThree();
  const v = useMemo(() => new Vector3(), []),
    ray = useMemo(() => new Raycaster(), []);
  useFrame((_, dt) => {
    const used: { x: number; y: number; w: number; h: number }[] = [];
    const walls: Object3D[] = [];
    scene.traverse((o) => {
      if (o.name === "wall-solid") {
        let visible = true;
        for (let p: Object3D | null = o; p; p = p.parent)
          if (!p.visible) visible = false;
        if (visible) walls.push(o);
      }
    });
    const sorted = [...entries.current.values()].sort(
      (a, b) =>
        (b.forced ? 100 : 0) +
        (b.tier === "slot"
          ? 4
          : b.tier === "hall"
            ? 3
            : b.tier === "zone"
              ? 2
              : 1) -
        ((a.forced ? 100 : 0) +
          (a.tier === "slot"
            ? 4
            : a.tier === "hall"
              ? 3
              : a.tier === "zone"
                ? 2
                : 1)),
    );
    for (const e of sorted) {
      const p = e.sprite.getWorldPosition(v),
        distance = camera.position.distanceTo(p),
        enter = e.tier === "rack" ? 16 : e.tier === "slot" ? 4 : Infinity,
        exit = e.tier === "rack" ? 19 : e.tier === "slot" ? 5.5 : Infinity;
      if (distance < enter || e.forced) e.visible = true;
      else if (distance > exit) e.visible = false;
      const worldWidth =
        (2 * Math.tan((42 * Math.PI) / 360) * distance * e.pixels) /
        Math.max(size.height, 1);
      e.sprite.scale.set(worldWidth, (worldWidth * 96) / 512, 1);
      if (e.tier === "hall" || e.tier === "zone")
        e.sprite.position.y = e.baseY + ((worldWidth * 96) / 512) * 0.6;
      e.sprite.getWorldPosition(p);
      const projected = p.clone().project(camera),
        depth = -p.clone().applyMatrix4(camera.matrixWorldInverse).z,
        w =
          (worldWidth * size.height) /
          (2 * Math.tan((42 * Math.PI) / 360) * Math.max(0.01, depth)),
        h = (w * 96) / 512,
        rect = {
          x: ((projected.x + 1) * size.width) / 2 - w / 2,
          y: ((1 - projected.y) * size.height) / 2 - h / 2,
          w,
          h,
        };
      let show =
        enabled &&
        (e.visible || e.forced) &&
        projected.z < 1 &&
        projected.z > -1 &&
        Math.abs(projected.x) < 1.1 &&
        Math.abs(projected.y) < 1.1;
      if (show && walls.length) {
        ray.set(camera.position, p.clone().sub(camera.position).normalize());
        show = !ray
          .intersectObjects(walls, false)
          .some((hit) => hit.distance < camera.position.distanceTo(p) - 0.08);
      }
      if (
        show &&
        used.some(
          (r) =>
            r.x < rect.x + rect.w + 5 &&
            r.x + r.w + 5 > rect.x &&
            r.y < rect.y + rect.h + 5 &&
            r.y + r.h + 5 > rect.y,
        )
      )
        show = false;
      if (show) used.push(rect);
      const material = e.sprite.material as SpriteMaterial;
      material.opacity +=
        (Number(show) - material.opacity) * Math.min(1, dt * 12);
      e.sprite.visible = material.opacity > 0.01;
      e.sprite.userData.labelVisible = material.opacity > 0.5;
      e.sprite.userData.distance = distance;
    }
  });
  return null;
}
export default function Label({
  text,
  position,
  width = 2.3,
  onClick,
  tier = "rack",
  forced = false,
}: {
  text: string;
  position: [number, number, number];
  width?: number;
  onClick?: (shift?: boolean) => void;
  tier?: Tier;
  forced?: boolean;
}) {
  const id = useId(),
    ref = useRef<Sprite>(null),
    entries = useContext(Context);
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = tier === "hall" ? "#e9f1f1" : "#ffffff";
    ctx.beginPath();
    ctx.roundRect(2, 2, 508, 92, 10);
    ctx.fill();
    ctx.strokeStyle = "#8ea5b0";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#243d4b";
    ctx.font = `${tier === "hall" ? "600" : "500"} 32px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.slice(0, 60), 256, 48, 480);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [text, tier]);
  useEffect(() => {
    if (!ref.current || !entries) return;
    entries.current.set(id, {
      sprite: ref.current,
      tier,
      forced,
      pixels: Math.max(120, Math.min(tier === "hall" ? 210 : 175, width * 65)),
      visible: tier === "hall" || tier === "zone",
      baseY: position[1],
    });
    return () => {
      entries.current.delete(id);
    };
  }, [id, entries, tier, forced, width, text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite
      ref={ref}
      name="label"
      position={position}
      userData={{ label: text, tier, forced, labelVisible: false }}
      renderOrder={20}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick(e.shiftKey);
            }
          : undefined
      }
    >
      <spriteMaterial
        map={texture}
        depthTest
        depthWrite={false}
        transparent
        opacity={0}
        toneMapped={false}
      />
    </sprite>
  );
}
