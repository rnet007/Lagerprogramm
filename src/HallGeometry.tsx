import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { type Group, Shape } from "three";
import { type Data } from "./model";
import {
  type Hall,
  type SceneObject,
  isMarking,
  isPath,
  isOpening,
} from "./builderTypes";
import { wallSegments } from "./builder";
import Label from "./Labels";
export function Cuboid({
  p,
  s,
  color = "#70868f",
  ghost = false,
  name,
}: {
  p: [number, number, number];
  s: [number, number, number];
  color?: string;
  ghost?: boolean;
  name?: string;
}) {
  return (
    <mesh name={name} position={p} castShadow={!ghost} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={color}
        roughness={0.8}
        metalness={0.08}
        transparent={ghost}
        opacity={ghost ? 0.45 : 1}
      />
    </mesh>
  );
}
function Wheel({ x, z, r = 0.24 }: { x: number; z: number; r?: number }) {
  return (
    <mesh rotation={[0, 0, Math.PI / 2]} position={[x, r, z]} castShadow>
      <cylinderGeometry args={[r, r, 0.14, 16]} />
      <meshStandardMaterial color="#384c55" roughness={0.95} />
    </mesh>
  );
}
export function PalletModel({
  width = 1.2,
  depth = 0.8,
}: {
  width?: number;
  depth?: number;
}) {
  return (
    <group>
      {[-0.42, 0, 0.42].map((x) => (
        <Cuboid
          key={x}
          p={[x * width, 0.06, 0]}
          s={[width * 0.15, 0.12, depth]}
          color="#b28c5e"
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <Cuboid
          key={i}
          p={[(-0.5 + (i + 0.5) / 6) * width, 0.145, 0]}
          s={[width / 7, 0.06, depth]}
          color="#cfaf7f"
        />
      ))}
    </group>
  );
}
export function ContainerModel({
  width = 1,
  depth = 0.8,
  height = 0.7,
  color = "#b99d78",
  ghost = false,
}: {
  width?: number;
  depth?: number;
  height?: number;
  color?: string;
  ghost?: boolean;
}) {
  const t = Math.min(0.055, width * 0.1, depth * 0.1);
  return (
    <group>
      <Cuboid
        p={[0, t / 2, 0]}
        s={[width, t, depth]}
        color={color}
        ghost={ghost}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Cuboid
            p={[(side * (width - t)) / 2, height / 2, 0]}
            s={[t, height, depth]}
            color={color}
            ghost={ghost}
          />
          <Cuboid
            p={[0, height / 2, (side * (depth - t)) / 2]}
            s={[width, height, t]}
            color={color}
            ghost={ghost}
          />
        </group>
      ))}
    </group>
  );
}
function Table({ o, ghost }: { o: SceneObject; ghost: boolean }) {
  return (
    <group>
      <Cuboid
        p={[0, o.height - 0.05, 0]}
        s={[o.width, 0.1, o.depth]}
        color={o.color}
        ghost={ghost}
      />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Cuboid
            key={`${x}${z}`}
            p={[x * o.width * 0.42, (o.height - 0.1) / 2, z * o.depth * 0.36]}
            s={[0.07, o.height - 0.1, 0.07]}
            color="#70848a"
            ghost={ghost}
          />
        )),
      )}
      {o.kind === "packingTable" && (
        <>
          <Cuboid
            p={[0, o.height + 0.3, -o.depth * 0.4]}
            s={[o.width * 0.9, 0.08, 0.26]}
            color="#a6b2b0"
          />
          <Cuboid
            p={[o.width * 0.3, o.height + 0.1, 0]}
            s={[0.3, 0.16, 0.28]}
            color="#d2b68f"
          />
        </>
      )}
    </group>
  );
}
function Vehicle({ o, ghost }: { o: SceneObject; ghost: boolean }) {
  const forklift = o.kind === "forklift";
  return (
    <group
      scale={[
        o.width / (forklift ? 1.3 : 0.65),
        o.height / (forklift ? 2.3 : 1.2),
        o.depth / (forklift ? 3.1 : 1.6),
      ]}
    >
      {forklift ? (
        <>
          <Cuboid
            p={[0, 0.6, -0.45]}
            s={[1.15, 0.8, 1.35]}
            color={o.color}
            ghost={ghost}
          />
          <Cuboid p={[0, 1.1, -0.6]} s={[0.65, 0.2, 0.6]} color="#3e5360" />
          {[-1, 1].map((side) => (
            <group key={side}>
              <Cuboid
                p={[side * 0.48, 1.55, -0.65]}
                s={[0.055, 1.35, 0.055]}
                color="#536975"
              />
              <Cuboid
                p={[side * 0.48, 1.55, 0.15]}
                s={[0.055, 1.35, 0.055]}
                color="#536975"
              />
              <Cuboid
                p={[side * 0.43, 1.1, 0.45]}
                s={[0.08, 2, 0.1]}
                color="#506b75"
              />
              <Cuboid
                p={[side * 0.32, 0.12, 1.15]}
                s={[0.15, 0.1, 0.95]}
                color="#8c9c9f"
              />
              <Wheel x={side * 0.59} z={-0.85} />
              <Wheel x={side * 0.59} z={0.2} />
            </group>
          ))}
          <Cuboid
            p={[0, 2.25, -0.2]}
            s={[1.25, 0.1, 1.2]}
            color={o.color}
            ghost={ghost}
          />
        </>
      ) : (
        <>
          <Cuboid
            p={[0, 0.19, -0.5]}
            s={[0.6, 0.24, 0.45]}
            color={o.color}
            ghost={ghost}
          />
          {[-1, 1].map((side) => (
            <group key={side}>
              <Cuboid
                p={[side * 0.24, 0.08, 0.15]}
                s={[0.15, 0.12, 1.1]}
                color={o.color}
                ghost={ghost}
              />
              <Wheel x={side * 0.24} z={0.52} r={0.06} />
            </group>
          ))}
          <group rotation={[0.15, 0, 0]}>
            <Cuboid p={[0, 0.7, -0.62]} s={[0.04, 0.9, 0.04]} color="#536976" />
            <Cuboid
              p={[0, 1.15, -0.62]}
              s={[0.35, 0.06, 0.06]}
              color="#536976"
            />
          </group>
        </>
      )}
    </group>
  );
}
export function HallFloor({
  hall: h,
  selected = false,
  onSelect,
}: {
  hall: Hall;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <group
      name={`hall:${h.id}`}
      userData={{
        hallId: h.id,
        width: h.width,
        depth: h.depth,
        height: h.height,
      }}
      position={[h.x, 0, h.z]}
    >
      <mesh
        position={[0, -0.09, 0]}
        receiveShadow
        onClick={
          onSelect
            ? (e) => {
                e.stopPropagation();
                onSelect();
              }
            : undefined
        }
      >
        <boxGeometry args={[h.width, 0.16, h.depth]} />
        <meshStandardMaterial color="#dce2df" roughness={0.95} />
        {selected && <Edges color="#e88532" lineWidth={3} />}
      </mesh>
      <Label
        tier="hall"
        text={`${h.name} · ${h.width} × ${h.depth} m`}
        position={[0, 0.14, 0]}
        width={3.2}
      />
    </group>
  );
}
export function ObjectGeometry({
  object: o,
  objects,
  selected = false,
  onSelect,
  hideWalls = "cutaway",
  hall,
  ghost = false,
}: {
  object: SceneObject;
  objects: SceneObject[];
  selected?: boolean;
  onSelect?: (shift: boolean) => void;
  hideWalls?: "cutaway" | "all" | "none";
  hall?: Hall;
  ghost?: boolean;
}) {
  const ref = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (ref.current && o.kind === "wall")
      ref.current.visible =
        hideWalls !== "none" &&
        !(
          !selected &&
          hideWalls === "cutaway" &&
          o.exterior &&
          hall &&
          (o.x - hall.x) * (camera.position.x - hall.x) +
            (o.z - hall.z) * (camera.position.z - hall.z) >
            0
        );
  });
  const marking = isMarking(o.kind),
    pick = onSelect
      ? (e: any) => {
          e.stopPropagation();
          onSelect(e.shiftKey);
        }
      : undefined;
  const wall = o.kind === "wall";
  return (
    <group
      ref={ref}
      name={`object:${o.id}`}
      userData={{
        objectId: o.id,
        kind: o.kind,
        width: o.width,
        height: o.height,
        depth: o.depth,
        opening: isOpening(o.kind),
      }}
      position={[o.x, 0, o.z]}
      rotation={[0, (o.rotation * Math.PI) / 180, 0]}
      onClick={pick}
    >
      {wall ? (
        wallSegments(o, objects).map((s, i) => (
          <Cuboid
            key={i}
            name="wall-solid"
            p={[s.x, s.bottom + s.height / 2, 0]}
            s={[s.width, s.height, o.depth]}
            color={o.color}
            ghost={ghost}
          />
        ))
      ) : isOpening(o.kind) ? (
        <group name="wall-opening">
          <Cuboid
            p={[-o.width / 2, o.height / 2, 0]}
            s={[0.065, o.height, o.depth + 0.03]}
            color={o.color}
            ghost={ghost}
          />
          <Cuboid
            p={[o.width / 2, o.height / 2, 0]}
            s={[0.065, o.height, o.depth + 0.03]}
            color={o.color}
            ghost={ghost}
          />
          <Cuboid
            p={[0, o.height + 0.04, 0]}
            s={[o.width + 0.12, 0.1, o.depth + 0.04]}
            color={o.color}
            ghost={ghost}
          />
          {o.kind === "gate" ? (
            <>
              <Cuboid
                p={[0, o.height + 0.2, 0]}
                s={[o.width + 0.25, 0.3, 0.35]}
                color="#8b9ca1"
              />
              {Array.from({ length: 6 }, (_, i) => (
                <Cuboid
                  key={i}
                  p={[-o.width / 2 + ((i + 0.5) * o.width) / 6, 0.02, 0.18]}
                  s={[o.width / 12, 0.035, 0.12]}
                  color="#d9b05b"
                />
              ))}
            </>
          ) : (
            <group
              position={[-o.width / 2, 0, 0]}
              rotation={[0, -Math.PI * 0.38, 0]}
            >
              <Cuboid
                p={[o.width / 2, o.height * 0.48, 0]}
                s={[o.width, o.height * 0.94, 0.045]}
                color={o.color}
                ghost={ghost}
              />
              <Cuboid
                p={[o.width * 0.8, o.height * 0.46, 0.05]}
                s={[0.08, 0.05, 0.06]}
                color="#cad4d1"
              />
            </group>
          )}
          {(o.kind === "exit" || o.kind === "emergencyExit") && (
            <Cuboid
              p={[0, o.height + 0.15, 0.01]}
              s={[Math.min(o.width, 0.8), 0.18, 0.05]}
              color="#2f825d"
            />
          )}
        </group>
      ) : marking ? (
        <group>
          {isPath(o.kind) ? (
            (o.points || []).slice(0, -1).map((p, i) => {
              const q = o.points![i + 1],
                length = Math.hypot(q.x - p.x, q.z - p.z);
              return (
                <group
                  key={i}
                  position={[(p.x + q.x) / 2, 0.025, (p.z + q.z) / 2]}
                  rotation={[0, -Math.atan2(q.z - p.z, q.x - p.x), 0]}
                >
                  <Cuboid
                    p={[0, 0, 0]}
                    s={[Math.max(0.02, length), 0.025, o.width]}
                    color={o.color}
                    ghost={ghost}
                  />
                  {[-1, 1].map((side) => (
                    <Cuboid
                      key={side}
                      p={[0, 0.015, side * (o.width / 2 - 0.035)]}
                      s={[length, 0.015, 0.045]}
                      color="#f3f2df"
                    />
                  ))}
                  {o.kind === "forkliftPath" &&
                    Array.from(
                      { length: Math.max(1, Math.floor(length)) },
                      (_, j) => (
                        <Cuboid
                          key={j}
                          p={[
                            -length / 2 +
                              ((j + 0.5) * length) /
                                Math.max(1, Math.floor(length)),
                            0.023,
                            0,
                          ]}
                          s={[0.4, 0.01, 0.045]}
                          color="#fff9d3"
                        />
                      ),
                    )}
                </group>
              );
            })
          ) : o.kind === "arrow" ? (
            <group>
              <Cuboid
                p={[0, 0.03, -o.depth * 0.15]}
                s={[o.width * 0.3, 0.025, o.depth * 0.6]}
                color={o.color}
              />
              <mesh
                position={[0, 0.04, o.depth * 0.25]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <shapeGeometry
                  args={[
                    new Shape()
                      .moveTo(0, o.depth * 0.32)
                      .lineTo(-o.width / 2, -o.depth * 0.15)
                      .lineTo(o.width / 2, -o.depth * 0.15)
                      .lineTo(0, o.depth * 0.32),
                  ]}
                />
                <meshBasicMaterial color={o.color} side={2} />
              </mesh>
            </group>
          ) : (
            <>
              <Cuboid
                p={[0, 0.02, 0]}
                s={[o.width, 0.025, o.depth]}
                color={o.color}
                ghost={ghost}
              />
              {[-1, 1].map((side) => (
                <group key={side}>
                  <Cuboid
                    p={[side * (o.width / 2 - 0.035), 0.04, 0]}
                    s={[0.055, 0.015, o.depth]}
                    color="#f5f3df"
                  />
                  <Cuboid
                    p={[0, 0.04, side * (o.depth / 2 - 0.035)]}
                    s={[o.width, 0.015, 0.055]}
                    color="#f5f3df"
                  />
                </group>
              ))}
              {["crossing", "blocked"].includes(o.kind) &&
                Array.from(
                  { length: Math.max(2, Math.floor(o.depth / 0.4)) },
                  (_, i) => (
                    <Cuboid
                      key={i}
                      p={[
                        0,
                        0.045,
                        -o.depth / 2 +
                          ((i + 0.5) * o.depth) /
                            Math.max(2, Math.floor(o.depth / 0.4)),
                      ]}
                      s={[o.width * 0.88, 0.015, 0.18]}
                      color={o.kind === "crossing" ? "#fffdf1" : "#ad713e"}
                    />
                  ),
                )}
              {o.kind === "charger" && (
                <Cuboid
                  p={[0, 0.06, 0]}
                  s={[o.width * 0.3, 0.03, o.depth * 0.3]}
                  color="#477b59"
                />
              )}
            </>
          )}
        </group>
      ) : o.kind === "workbench" || o.kind === "packingTable" ? (
        <Table o={o} ghost={ghost} />
      ) : o.kind === "pallet" ? (
        <group scale={[1, o.height / 0.175, 1]}>
          <PalletModel width={o.width} depth={o.depth} />
        </group>
      ) : o.kind === "crate" || o.kind === "bin" ? (
        <ContainerModel
          width={o.width}
          depth={o.depth}
          height={o.height}
          color={o.color}
          ghost={ghost}
        />
      ) : o.kind === "forklift" || o.kind === "palletJack" ? (
        <Vehicle o={o} ghost={ghost} />
      ) : null}
      {selected && (
        <mesh
          name="selected-object-outline"
          position={[0, Math.max(o.height, 0.12) / 2, 0]}
        >
          <boxGeometry
            args={[
              o.width + 0.06,
              Math.max(o.height, 0.12) + 0.06,
              o.depth + 0.06,
            ]}
          />
          <meshBasicMaterial visible={false} />
          <Edges color="#e67820" lineWidth={3} />
        </mesh>
      )}
      {!ghost && o.kind !== "wall" && (
        <Label
          text={o.name}
          tier={marking ? "zone" : "rack"}
          forced={selected}
          position={[0, marking ? 0.12 : o.height + 0.3, 0]}
          width={marking ? 2.6 : 2.2}
        />
      )}
    </group>
  );
}
