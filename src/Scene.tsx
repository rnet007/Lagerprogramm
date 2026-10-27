import Label, { Labels } from "./Labels";
import {
  HallFloor,
  ObjectGeometry,
  PalletModel,
  ContainerModel,
  Cuboid,
} from "./HallGeometry";
import { entities, sceneBounds, type Entity } from "./builder";
import type { BuildConfig } from "./sceneTypes";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Edges,
  TransformControls,
} from "@react-three/drei";
import {
  useEffect,
  useRef,
  useMemo,
  useState,
  Component,
  type ReactNode,
} from "react";
import {
  CanvasTexture,
  PerspectiveCamera,
  SRGBColorSpace,
  type Sprite,
} from "three";
import { type Data, type Rack, type Slot, code } from "./model";
import {
  areaDepth,
  areaZ,
  areaOffset,
  baseHeight,
  slotPosition,
  worldPosition,
  boundsFor,
  fitCamera,
  type CameraMode,
} from "./layout";
export type SceneProps = {
  data: Data;
  intro?: boolean;
  selected: string;
  onSelect: (r: Rack, s: Slot, shift?: boolean) => void;
  spread: boolean;
  reset: number;
  focus?: Rack;
  mode?: CameraMode;
  hidden?: string[];
  boxes?: boolean;
  onRackSelect?: (r: Rack, shift?: boolean) => void;
  preview?: boolean;
  showLabels?: boolean;
  wallMode?: "cutaway" | "all" | "none";
  offsets?: Record<string, number>;
  build?: BuildConfig;
};
function Camera({
  data,
  focus,
  selected,
  spread,
  reset,
  mode,
  hidden,
  controls,
  offsets,
}: {
  data: Data;
  focus?: Rack;
  selected: string;
  spread: boolean;
  reset: number;
  mode: CameraMode;
  hidden: string[];
  controls: React.RefObject<any>;
  offsets: Record<string, number>;
}) {
  const { camera, size, scene } = useThree();
  const layoutKey = JSON.stringify(
    data.racks.map((r) => [
      r.id,
      r.x,
      r.z,
      r.rotation,
      r.width,
      r.height,
      r.depth,
      r.areas.map((a) => [a.id, a.columns, a.levels]),
    ]),
  );
  const hiddenKey =
    hidden.join(",") +
    JSON.stringify(offsets) +
    JSON.stringify(data.layout || null);
  useEffect(() => {
    let bounds = focus
      ? boundsFor([focus], spread, hidden, offsets)
      : sceneBounds(data, spread, hidden, offsets);
    const slot = focus?.slots.find(
      (s) => s.id === selected && !hidden.includes(s.areaId),
    );
    if (focus && slot) {
      const p = worldPosition(
          focus,
          slotPosition(focus, slot, spread, offsets),
        ),
        a = focus.areas.find((a) => a.id === slot.areaId)!;
      const w = Math.max((focus.width / a.columns) * 3, 1.2),
        h = Math.max((focus.height / a.levels) * 3, 1.2),
        d = Math.max(areaDepth(focus) * 2, 1);
      bounds = {
        minX: p[0] - w / 2,
        maxX: p[0] + w / 2,
        minY: Math.max(0, p[1] - h / 2),
        maxY: p[1] + h / 2,
        minZ: p[2] - d / 2,
        maxZ: p[2] + d / 2,
      };
    }
    const fit = fitCamera(
      bounds,
      size.width / size.height,
      42,
      mode,
      data.layout && mode === "overview" ? [1, 1, 1] : undefined,
    );
    if (controls.current) {
      controls.current.enableDamping = false;
      controls.current.update();
    }
    const c = camera as PerspectiveCamera;
    c.fov = 42;
    c.near = 0.01;
    c.far = Math.max(200, fit.distance * 8);
    c.position.set(...fit.position);
    c.lookAt(...fit.center);
    c.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.set(...fit.center);
      controls.current.minDistance = 0.15;
      controls.current.maxDistance = Math.max(100, fit.distance * 5);
      controls.current.update();
      controls.current.enableDamping = true;
    }
    // Read-only diagnostics used by the browser acceptance test to verify actual meshes and framing.
    scene.userData.cameraFit = { ...fit, mode, bounds };
    scene.userData.renderCamera = camera;
  }, [
    layoutKey,
    focus?.id,
    selected,
    spread,
    reset,
    mode,
    hiddenKey,
    size.width,
    size.height,
    camera,
    controls,
    scene,
  ]);
  return null;
}
class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty">
        3D konnte nicht geladen werden. Bitte WebGL aktivieren oder die
        2D-Regalansicht verwenden.
      </div>
    ) : (
      this.props.children
    );
  }
}
function Bar({
  position,
  size,
  color = "#6f828b",
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.75} metalness={0.15} />
    </mesh>
  );
}
export function RackGeometry({
  rack: r,
  stock,
  assigned = [],
  selected,
  spread,
  hidden = [],
  boxes = true,
  onSelect,
  onRackSelect,
  onHover,
  labels = true,
  offsets = {},
  forced = false,
  interactive = true,
}: {
  rack: Rack;
  stock: Data["stock"];
  assigned?: string[];
  selected: string;
  spread: boolean;
  hidden?: string[];
  boxes?: boolean;
  onSelect: (r: Rack, s: Slot, shift?: boolean) => void;
  onRackSelect?: (r: Rack, shift?: boolean) => void;
  onHover?: (text: string) => void;
  labels?: boolean;
  offsets?: Record<string, number>;
  forced?: boolean;
  interactive?: boolean;
}) {
  const occupied = useMemo(() => new Set([...stock.map((b) => b.slotId),...assigned]), [stock,assigned]);
  const thickness = Math.min(0.045, r.width / 100, r.height / 80),
    base = baseHeight(r),
    depth = areaDepth(r);
  if (r.kind === "floorSlot") {
    const slot = r.slots[0];
    return (
      <group
        name={`rack:${r.id}`}
        position={[r.x, 0, r.z]}
        rotation={[0, (r.rotation * Math.PI) / 180, 0]}
        userData={{
          rackId: r.id,
          width: r.width,
          height: r.height,
          depth: r.depth,
        }}
      >
        <Cuboid
          p={[0, 0.02, 0]}
          s={[r.width, 0.025, r.depth]}
          color={r.color || "#d3ba7b"}
        />
        <mesh
          name={`slot:${slot?.id}`}
          position={[0, 0.15, 0]}
          userData={{
            slotId: slot?.id,
            code: slot ? code(r, slot) : "",
            width: r.width,
            height: r.height,
            depth: r.depth,
          }}
          onClick={
            interactive && slot
              ? (e) => {
                  e.stopPropagation();
                  onSelect(r, slot, e.shiftKey);
                }
              : undefined
          }
        >
          <boxGeometry args={[r.width, 0.3, r.depth]} />
          <meshBasicMaterial
            transparent
            opacity={selected === slot?.id ? 0.12 : 0}
            color="#e38a39"
            depthWrite={false}
          />
          <Edges color={selected === slot?.id ? "#e67820" : "#e8cf8e"} />
        </mesh>
        {slot && occupied.has(slot.id) && boxes && (
          <ContainerModel
            width={r.width * 0.7}
            depth={r.depth * 0.7}
            height={0.7}
            color="#b7a28a"
          />
        )}
        {labels && (
          <Label text={r.name} position={[0, 0.25, 0]} forced={forced} />
        )}
      </group>
    );
  }
  return (
    <group
      name={`rack:${r.id}`}
      userData={{
        rackId: r.id,
        width: r.width,
        height: r.height,
        depth: r.depth,
      }}
      position={[r.x, 0, r.z]}
      rotation={[0, (r.rotation * Math.PI) / 180, 0]}
    >
      {labels && (
        <Label
          text={`${r.name} · R${r.number}`}
          forced={forced || r.slots.some((s) => s.id === selected)}
          position={[0, r.height + 0.45, 0]}
          width={Math.max(1.8, Math.min(r.width * 0.8, 3.5))}
          onClick={(shift) => onRackSelect?.(r, shift)}
        />
      )}
      {r.kind === "cabinet" && (
        <group>
          <Cuboid
            p={[0, r.height / 2, -r.depth / 2]}
            s={[r.width, r.height, 0.04]}
            color={r.color}
          />
          {[-1, 1].map((side) => (
            <group key={side}>
              <Cuboid
                p={[(side * r.width) / 2, r.height / 2, 0]}
                s={[0.04, r.height, r.depth]}
                color={r.color}
              />
              <group
                position={[(side * r.width) / 2, 0, r.depth / 2]}
                rotation={[0, side * Math.PI * 0.36, 0]}
              >
                <Cuboid
                  p={[(-side * r.width) / 4, r.height / 2, 0]}
                  s={[r.width / 2, r.height, 0.035]}
                  color={r.color}
                />
                <Cuboid
                  p={[-side * r.width * 0.4, r.height * 0.5, 0.04]}
                  s={[0.04, 0.2, 0.04]}
                  color="#465e69"
                />
              </group>
            </group>
          ))}
        </group>
      )}
      {r.areas.length > 1 &&
        ((r.slidingDirection || "x") === "x"
          ? r.areas.flatMap((a) =>
              [-1, 1].map((side) => (
                <Bar
                  key={a.id + side}
                  position={[
                    0,
                    0.025,
                    areaOffset(r, a, spread, offsets)[1] + side * depth * 0.3,
                  ]}
                  size={[
                    r.width +
                      2 *
                        Math.max(
                          0,
                          ...r.areas.map((a) => Math.abs(offsets[a.id] || 0)),
                        ) +
                      0.7,
                    0.035,
                    0.055,
                  ]}
                  color="#9ca9ab"
                />
              )),
            )
          : [-r.width * 0.45, r.width * 0.45].map((x, i) => (
              <Bar
                key={i}
                position={[x, 0.025, 0]}
                size={[
                  0.055,
                  0.035,
                  r.depth +
                    (r.areas.length - 1) *
                      (spread ? Math.max(0.8, r.depth / 2) : 0) +
                    2 *
                      Math.max(
                        0,
                        ...r.areas.map((a) => Math.abs(offsets[a.id] || 0)),
                      ) +
                    0.7,
                ]}
                color="#9ca9ab"
              />
            )))}
      {r.areas
        .filter((a) => !hidden.includes(a.id))
        .map((a) => {
          const [offsetX, z] = areaOffset(r, a, spread, offsets),
            cellW = r.width / a.columns,
            cellH = (r.height - base) / a.levels;
          return (
            <group
              name={`area:${a.id}`}
              key={a.id}
              position={[offsetX, 0, z]}
              userData={{
                areaId: a.id,
                columns: a.columns,
                levels: a.levels,
                depth,
                sliding: r.areas.length > 1,
              }}
            >
              <group
                onClick={
                  interactive
                    ? (e) => {
                        e.stopPropagation();
                        onRackSelect?.(r, e.shiftKey);
                      }
                    : undefined
                }
              >
                {Array.from({ length: a.columns + 1 }, (_, i) =>
                  [-1, 1].map((side) => (
                    <Bar
                      key={`${i}:${side}`}
                      position={[
                        -r.width / 2 + i * cellW,
                        r.height / 2,
                        side * (depth / 2 - thickness),
                      ]}
                      size={[thickness, r.height, thickness]}
                      color={r.color || "#526975"}
                    />
                  )),
                )}
                {Array.from({ length: a.levels + 1 }, (_, i) => {
                  const y = base + i * cellH;
                  return (
                    <group key={i}>
                      <Bar
                        position={[0, y, 0]}
                        size={[
                          r.width,
                          Math.min(0.022, cellH * 0.06),
                          depth * 0.97,
                        ]}
                        color="#bfc7c3"
                      />
                      {[-1, 1].map((side) => (
                        <Bar
                          key={side}
                          position={[0, y - 0.012, side * depth * 0.47]}
                          size={[
                            r.width,
                            Math.min(0.055, cellH * 0.14),
                            thickness,
                          ]}
                          color={
                            r.kind === "palletRack" ? "#c78349" : "#879b9d"
                          }
                        />
                      ))}
                    </group>
                  );
                })}
                {r.areas.length > 1 &&
                  [-1, 1].map((side) => (
                    <group key={side}>
                      <Bar
                        position={[side * r.width * 0.45, 0.09, 0]}
                        size={[
                          Math.min(0.16, r.width * 0.1),
                          0.12,
                          depth * 0.9,
                        ]}
                        color="#687a82"
                      />
                      {[-1, 1].map((end) => (
                        <mesh
                          key={end}
                          rotation={
                            (r.slidingDirection || "x") === "x"
                              ? [Math.PI / 2, 0, 0]
                              : [0, 0, Math.PI / 2]
                          }
                          position={[
                            side * r.width * 0.45,
                            0.065,
                            end * depth * 0.3,
                          ]}
                        >
                          <cylinderGeometry args={[0.06, 0.06, 0.045, 12]} />
                          <meshStandardMaterial color="#465b66" />
                        </mesh>
                      ))}
                    </group>
                  ))}
              </group>
              {labels && r.areas.length > 1 && spread && (
                <Label
                  text={`${a.name} · verschiebbares Segment`}
                  position={[0, 0.12, depth / 2 + 0.07]}
                  width={Math.min(r.width * 0.8, 3)}
                />
              )}
              {r.slots
                .filter((s) => s.areaId === a.id)
                .map((s) => {
                  const p = slotPosition(r, s, spread, offsets);
                  p[0] -= offsetX;
                  p[2] = 0;
                  const chosen = s.id === selected,
                    has = occupied.has(s.id),
                    w = cellW - thickness * 1.5,
                    h = cellH - 0.035;
                  return (
                    <group
                      key={s.id}
                      name={`slot:${s.id}`}
                      position={p}
                      userData={{
                        slotId: s.id,
                        code: code(r, s),
                        width: cellW,
                        height: cellH,
                        depth,
                        occupied: has,
                      }}
                    >
                      {/* Invisible pick volume keeps empty shelves open while every real slot stays clickable. */}
                      <mesh
                        name={`hit:${s.id}`}
                        onClick={
                          interactive
                            ? (e) => {
                                e.stopPropagation();
                                onSelect(r, s, e.shiftKey);
                              }
                            : undefined
                        }
                        onPointerOver={
                          interactive
                            ? (e) => {
                                e.stopPropagation();
                                document.body.style.cursor = "pointer";
                                onHover?.(code(r, s));
                              }
                            : undefined
                        }
                        onPointerOut={() => {
                          document.body.style.cursor = "auto";
                          onHover?.("");
                        }}
                      >
                        <boxGeometry
                          args={[
                            Math.max(0.001, w),
                            Math.max(0.001, h),
                            depth * 0.94,
                          ]}
                        />
                        <meshBasicMaterial
                          transparent
                          opacity={0}
                          depthWrite={false}
                        />
                      </mesh>
                      {has && !boxes && (
                        <Bar
                          position={[0, -cellH * 0.4, depth * 0.45]}
                          size={[
                            Math.max(0.005, w * 0.5),
                            Math.max(0.01, h * 0.06),
                            0.01,
                          ]}
                          color="#508575"
                        />
                      )}
                      {(has || r.kind === "binRack") &&
                        boxes &&
                        (r.kind === "palletRack" ? (
                          <group position={[0, -cellH / 2 + 0.03, 0]}>
                            <PalletModel
                              width={Math.max(0.1, w * 0.85)}
                              depth={depth * 0.85}
                            />
                            <group position={[0, 0.17, 0]}>
                              <ContainerModel
                                width={w * 0.66}
                                depth={depth * 0.65}
                                height={cellH * 0.55}
                                color="#bcaa8b"
                              />
                            </group>
                          </group>
                        ) : (
                          <group position={[0, -cellH / 2 + 0.02, 0]}>
                            <ContainerModel
                              width={Math.max(0.03, w * 0.82)}
                              depth={depth * 0.72}
                              height={Math.max(0.03, h * 0.65)}
                              color={has ? r.color || "#819f98" : "#c3d2ca"}
                            />
                          </group>
                        ))}
                      {chosen && (
                        <mesh name="selected-slot-outline">
                          <boxGeometry
                            args={[
                              Math.max(0.001, w),
                              Math.max(0.001, h),
                              depth * 0.98,
                            ]}
                          />
                          <meshBasicMaterial
                            color="#ef8d37"
                            transparent
                            opacity={0.08}
                            depthWrite={false}
                          />
                          <Edges color="#e7791e" lineWidth={3} />
                        </mesh>
                      )}
                      {chosen && labels && (
                        <Label
                          tier="slot"
                          forced
                          text={code(r, s)}
                          position={[0, cellH * 0.75, depth * 0.55]}
                          width={Math.max(1.4, cellW * 1.8)}
                        />
                      )}
                    </group>
                  );
                })}
            </group>
          );
        })}
    </group>
  );
}
export default function Scene({
  data,
  intro = false,
  selected,
  onSelect,
  spread,
  reset,
  focus,
  mode = "overview",
  hidden = [],
  boxes = true,
  onRackSelect,
  preview = false,
  showLabels = true,
  wallMode = "cutaway",
  offsets = {},
  build,
}: SceneProps) {
  const controls = useRef<any>(null),
    [hover, setHover] = useState("");
  const blockPickUntil = useRef(0);
  const selectedEntities = useMemo(
    () =>
      build
        ? entities(data).filter(
            (o) => build.selectedIds.includes(o.id) && !o.locked,
          )
        : [],
    [data, build?.selectedIds],
  );
  const renderRevision = useMemo(
    () =>
      JSON.stringify([
        data.stock,
        data.layout,
        selected,
        spread,
        hidden,
        offsets,
        boxes,
        focus?.id,
        preview,
      ]),
    [data, selected, spread, hidden, offsets, boxes, focus?.id, preview],
  );
  function renderItem(
    o: Entity,
    relative?: { x: number; z: number },
    ghost = false,
  ) {
    const adjusted = relative
      ? { ...o, x: o.x - relative.x, z: o.z - relative.z }
      : o;
    const pick = (shift: boolean) => {
      if (Date.now() >= blockPickUntil.current) build?.onPick(o.id, shift);
    };
    return "slots" in adjusted ? (
      <group
        key={o.id}
        onUpdate={
          ghost
            ? (g) => {
                g.traverse((n) => {
                  const m = (n as any).material;
                  if (m) {
                    m.transparent = true;
                    m.opacity = 0.45;
                  }
                });
              }
            : undefined
        }
      >
        <RackGeometry
          rack={adjusted}
          stock={ghost ? [] : data.stock}
          assigned={ghost?[]:data.materials.flatMap(m=>m.assignedSlotIds || [])}
          selected={selected}
          spread={spread}
          hidden={hidden}
          offsets={offsets}
          boxes={boxes}
          onSelect={(r, s, shift) => {
            if (Date.now() >= blockPickUntil.current) onSelect(r, s, shift);
          }}
          onRackSelect={
            build && !build.placing ? (_, shift) => pick(!!shift) : onRackSelect
          }
          onHover={setHover}
          labels={!preview && !ghost}
          forced={build?.selectedIds.includes(o.id) || focus?.id === o.id}
          interactive={!ghost && !build?.placing}
        />
        {build?.selectedIds.includes(o.id) && (
          <mesh
            position={[adjusted.x, adjusted.height / 2, adjusted.z]}
            rotation={[0, (adjusted.rotation * Math.PI) / 180, 0]}
          >
            <boxGeometry
              args={[
                adjusted.width + 0.08,
                adjusted.height + 0.08,
                adjusted.depth + 0.08,
              ]}
            />
            <meshBasicMaterial visible={false} />
            <Edges color="#e68028" lineWidth={3} />
          </mesh>
        )}
      </group>
    ) : (
      <ObjectGeometry
        key={o.id}
        object={adjusted}
        objects={data.layout?.objects || []}
        hall={data.layout?.halls.find((h) => h.id === o.hallId)}
        selected={build?.selectedIds.includes(o.id)}
        onSelect={build && !build.placing ? pick : undefined}
        hideWalls={wallMode}
        ghost={ghost}
      />
    );
  }
  const all = entities(data),
    controlled =
      !!build && build.tool !== "select" && selectedEntities.length > 0;
  return (
    <Guard>
      <div className="scene-container" aria-label="Interaktive 3D-Lageransicht">
        <Canvas
          shadows
          camera={{ position: [8, 10, 12], fov: 42, near: 0.01 }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor("#edf1f3");
            gl.domElement.setAttribute("data-scene", "lagerraum");
            (
              gl.domElement as HTMLCanvasElement & { __lagerScene?: unknown }
            ).__lagerScene = scene;
          }}
        >
          <Labels enabled={showLabels && !preview}>
            <ambientLight intensity={0.95} />
            <hemisphereLight args={["#fffaf0", "#b6c7cc", 1.4]} />
            <directionalLight
              position={[8, 18, 10]}
              intensity={2.1}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-bias={-0.0002}
              shadow-normalBias={0.025}
              shadow-radius={5}
              shadow-camera-left={-40}
              shadow-camera-right={40}
              shadow-camera-top={40}
              shadow-camera-bottom={-40}
            />
            {(!build || build.step) && (
              <Grid
                position={[0, 0.002, 0]}
                args={[200, 200]}
                cellSize={build?.step || 1}
                cellColor="#c6d3d7"
                sectionSize={5}
                sectionColor="#adbec5"
                fadeDistance={100}
                infiniteGrid
              />
            )}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, -0.12, 0]}
              receiveShadow
            >
              <planeGeometry args={[3000, 3000]} />
              <shadowMaterial opacity={0.14} />
            </mesh>
            {data.layout?.halls.map((h) => (
              <HallFloor
                key={h.id}
                hall={h}
                onSelect={
                  build && !build.placing
                    ? () => {
                        if (Date.now() >= blockPickUntil.current)
                          build.onHallPick(h.id);
                      }
                    : undefined
                }
              />
            ))}
            {all
              .filter(
                (o) =>
                  !controlled || !build!.selectedIds.includes(o.id) || o.locked,
              )
              .map((o) => renderItem(o))}
            {controlled && (
              <TransformGroup
                key={JSON.stringify(
                  selectedEntities.map((o) => [o.id, o.x, o.z, o.rotation]),
                )}
                config={build!}
                items={selectedEntities}
                render={renderItem}
                renderRevision={renderRevision}
                onDragStart={() => {
                  blockPickUntil.current = Infinity;
                }}
                onDragEnd={() => {
                  blockPickUntil.current = Date.now() + 120;
                }}
              />
            )}
            {build?.ghost && renderItem(build.ghost, undefined, true)}
            {build && (
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.006, 0]}
                onPointerMove={(e) => {
                  if (build.placing) {
                    e.stopPropagation();
                    build.onFloorMove({ x: e.point.x, z: e.point.z });
                  }
                }}
                onClick={(e) => {
                  if (build.placing) {
                    e.stopPropagation();
                    build.onPlace({ x: e.point.x, z: e.point.z });
                  }
                }}
              >
                <planeGeometry args={[2000, 2000]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
            <OrbitControls
              autoRotate={intro}
              autoRotateSpeed={0.65}
              ref={controls}
              makeDefault
              enableDamping
              dampingFactor={0.12}
              maxPolarAngle={Math.PI / 2 - 0.005}
            />
            <Camera
              data={data}
              focus={focus}
              selected={selected}
              spread={spread}
              reset={reset}
              mode={mode}
              hidden={hidden}
              controls={controls}
              offsets={offsets}
            />
          </Labels>
        </Canvas>
        {hover && showLabels && (
          <div className="scene-tooltip" role="tooltip">
            ▦ {hover}
          </div>
        )}
      </div>
    </Guard>
  );
}
function TransformGroup({
  config,
  items,
  render,
  renderRevision,
  onDragStart,
  onDragEnd,
}: {
  config: BuildConfig;
  items: Entity[];
  render: (o: Entity, relative?: { x: number; z: number }) => ReactNode;
  renderRevision: string;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const ref = useRef<any>(null),
    center = {
      x: items.reduce((s, o) => s + o.x, 0) / items.length,
      z: items.reduce((s, o) => s + o.z, 0) / items.length,
    };
  // Drei reattaches when children change. Keep this subtree stable during pointer hover.
  useEffect(() => () => onDragEnd(), []);
  const content = useMemo(
    () => <group>{items.map((o) => render(o, center))}</group>,
    [JSON.stringify(items), renderRevision],
  );
  return (
    <TransformControls
      ref={ref}
      mode={config.tool === "rotate" ? "rotate" : "translate"}
      position={[center.x, 0, center.z]}
      showX={config.tool !== "rotate"}
      showY={config.tool === "rotate"}
      showZ={config.tool !== "rotate"}
      translationSnap={config.step}
      onMouseDown={onDragStart}
      onMouseUp={() => {
        const o = ref.current?.object;
        if (o)
          config.onTransform(
            items.map((i) => i.id),
            o.position.x - center.x,
            o.position.z - center.z,
            (o.rotation.y * 180) / Math.PI,
            center,
          );
        onDragEnd();
      }}
    >
      {content}
    </TransformControls>
  );
}
