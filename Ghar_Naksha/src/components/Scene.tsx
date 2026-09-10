import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Canvas,
  createPortal,
  useFrame,
  useThree,
  type ThreeEvent,
} from '@react-three/fiber';
import {
  Grid,
  Html,
  Line,
  OrbitControls,
  TransformControls,
} from '@react-three/drei';
import * as THREE from 'three';
import { Furniture } from './Furniture';
import { Stairs } from './Stairs';
import { WalkController, type WalkStatus } from './WalkController';
import {
  makeWalkWorld,
  buildingLevels,
  elementLevelId,
  type Point2,
  type WalkthroughSettings,
} from '../lib/walkthrough';
import { surfaceShapes } from '../lib/floorSurfaces';
import { floorBounds, getFloorPlan, type FloorBounds } from '../lib/floor';
import { connectionWorldPoints, getConnections } from '../lib/connections';
import { getWallSegments } from '../lib/openings';
import { moveElement, normalizeRotation, snapLength } from '../lib/transforms';
import './Scene.css';
import {
  ELECTRICAL_KINDS,
  FLOOR_ID,
  type FloorPlan,
  PLUMBING_KINDS,
  isElementVisible,
  type HomeElement,
  type Layers,
  type Project,
  type Room,
  type ToolMode,
  type ViewMode,
} from '../types';

type CameraAction = {
  type: 'reset' | 'zoom-in' | 'zoom-out' | 'focus';
  nonce: number;
};
interface SceneProps {
  project: Project;
  buildingProject?: Project;
  walkthroughSettings?: WalkthroughSettings;
  onActiveLevelChange?: (levelId: string) => void;
  showAllLevels?: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<HomeElement>) => void;
  layers: Layers;
  viewMode: ViewMode;
  tool: ToolMode;
  focusRoomId: string | null;
  cameraAction: CameraAction;
  onReady?: () => void;
  units?: 'm' | 'ft';
  snapToGrid?: boolean;
}

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
function getFloorBounds(rooms: Room[]): FloorBounds {
  const minX = rooms.length
    ? Math.min(...rooms.map((room) => room.center[0] - room.width / 2))
    : -3;
  const maxX = rooms.length
    ? Math.max(...rooms.map((room) => room.center[0] + room.width / 2))
    : 3;
  const minZ = rooms.length
    ? Math.min(...rooms.map((room) => room.center[1] - room.depth / 2))
    : -2.5;
  const maxZ = rooms.length
    ? Math.max(...rooms.map((room) => room.center[1] + room.depth / 2))
    : 2.5;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}
function fittedCamera(
  bounds: FloorBounds,
  aspect: number,
  topView: boolean,
  wallHeight = 2.7,
) {
  const target = new THREE.Vector3(bounds.centerX, 0.1, bounds.centerZ);
  const direction = topView
    ? new THREE.Vector3(0, 1, 0.0001).normalize()
    : new THREE.Vector3(14, 16, 18).normalize();
  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), direction)
    .normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tangent = Math.tan(toRad(38) / 2);
  let distance = 5;
  for (const x of [-bounds.width / 2 - 0.15, bounds.width / 2 + 0.15]) {
    for (const z of [-bounds.depth / 2 - 0.15, bounds.depth / 2 + 0.15]) {
      for (const y of [-0.4, wallHeight]) {
        const point = new THREE.Vector3(x, y, z);
        const alongView = point.dot(direction);
        distance = Math.max(
          distance,
          alongView +
            Math.abs(point.dot(right)) /
              (tangent * Math.max(aspect, 0.2) * 0.72),
          alongView + Math.abs(point.dot(up)) / (tangent * 0.72),
        );
      }
    }
  }
  return {
    position: target.clone().addScaledVector(direction, distance),
    target,
  };
}
const dimensionStyle: React.CSSProperties = {
  background: '#fff',
  padding: '4px 7px',
  border: '1px solid #dce5db',
  borderRadius: 5,
  color: '#236445',
  fontFamily: 'Inter, sans-serif',
  fontSize: 10,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  boxShadow: '0 2px 8px #1f3a2610',
  pointerEvents: 'none',
};

function makeFloorTexture(tiled: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = tiled ? '#e7e6e0' : '#e8d9bf';
  ctx.fillRect(0, 0, 512, 512);
  if (tiled) {
    for (let x = 0; x < 4; x++)
      for (let y = 0; y < 4; y++) {
        ctx.fillStyle = (x + y) % 3 === 0 ? '#e8e8e2' : '#eeede7';
        ctx.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
      }
  } else {
    let seed = 19;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let plank = 0; plank < 8; plank++) {
      ctx.fillStyle = ['#e7d6b9', '#e9d9bf', '#e5d3b7', '#eddfc7'][plank % 4];
      ctx.fillRect(plank * 64, 0, 64, 512);
      ctx.strokeStyle = '#bba88b50';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plank * 64, 0);
      ctx.lineTo(plank * 64, 512);
      ctx.stroke();
      const seam = plank % 2 ? 150 : 360;
      ctx.beginPath();
      ctx.moveTo(plank * 64, seam);
      ctx.lineTo((plank + 1) * 64, seam);
      ctx.stroke();
      for (let j = 0; j < 35; j++) {
        const x = plank * 64 + random() * 64;
        const y = random() * 512;
        ctx.strokeStyle = '#9e87631a';
        ctx.lineWidth = random() * 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 2, y + 20, x - 2, y + 50, x, y + 90);
        ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function FloorFoundation({
  floor,
  units,
  selected,
  onSelect,
  showDimensions,
  holes = [],
}: {
  holes?: Point2[][];
  floor: FloorPlan;
  units: 'm' | 'ft';
  selected: boolean;
  onSelect: SceneProps['onSelect'];
  showDimensions: boolean;
}) {
  const { size } = useThree();
  const signature = JSON.stringify([floor.outline, holes]);
  const shape = useMemo(() => surfaceShapes(floor.outline, holes), [signature]);
  const texture = useMemo(() => {
    const map = makeFloorTexture(false);
    map.repeat.set(1 / 3, 1 / 5);
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const perimeter = [...floor.outline, floor.outline[0]].map(
    ([x, z]) => [x, -0.024, z] as [number, number, number],
  );
  const winding =
    floor.outline.reduce((sum, point, index) => {
      const next = floor.outline[(index + 1) % floor.outline.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) >= 0
      ? 1
      : -1;
  const labelStyle = {
    ...dimensionStyle,
    fontSize: size.width < 600 ? 8 : 10,
    padding: size.width < 600 ? '3px 5px' : '4px 7px',
    color: '#536f49',
  };
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(FLOOR_ID);
      }}
    >
      <mesh
        position={[0, -0.3, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        castShadow
      >
        <extrudeGeometry args={[shape, { depth: 0.25, bevelEnabled: false }]} />
        <meshStandardMaterial
          color={selected ? '#e4ead9' : '#faf9f2'}
          roughness={0.85}
        />
      </mesh>
      <mesh
        position={[0, -0.032, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.84}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Line
        points={perimeter}
        color={selected ? '#5a7f4b' : '#b4bea8'}
        lineWidth={selected ? 2 : 1}
      />
      {showDimensions &&
        floor.outline.map((point, index) => {
          const next = floor.outline[(index + 1) % floor.outline.length];
          const dx = next[0] - point[0],
            dz = next[1] - point[1],
            length = Math.hypot(dx, dz);
          const nx = (winding * dz) / length,
            nz = (-winding * dx) / length;
          const offset = 0.46;
          const start: [number, number, number] = [
            point[0] + nx * offset,
            0.025,
            point[1] + nz * offset,
          ];
          const end: [number, number, number] = [
            next[0] + nx * offset,
            0.025,
            next[1] + nz * offset,
          ];
          return (
            <group key={index}>
              <Line points={[start, end]} color="#8fa184" lineWidth={0.85} />
              <Line
                points={[
                  [point[0] + nx * 0.18, 0.025, point[1] + nz * 0.18],
                  [point[0] + nx * 0.57, 0.025, point[1] + nz * 0.57],
                ]}
                color="#8fa184"
                lineWidth={0.85}
              />
              <Html
                position={[
                  (start[0] + end[0]) / 2,
                  0.07,
                  (start[2] + end[2]) / 2,
                ]}
                center
                zIndexRange={[8, 0]}
                style={labelStyle}
              >
                {(length * (units === 'ft' ? 3.28084 : 1)).toFixed(2)} {units}
              </Html>
            </group>
          );
        })}
    </group>
  );
}

function RoomFloor({ room, holes = [] }: { room: Room; holes?: Point2[][] }) {
  const tiled = /bath|wash|utility/i.test(room.name);
  const texture = useMemo(() => {
    const map = makeFloorTexture(tiled);
    map.repeat.set(1 / (tiled ? 2.4 : 3), 1 / (tiled ? 2.4 : 5));
    return map;
  }, [tiled]);
  useEffect(() => () => texture.dispose(), [texture]);
  const signature = JSON.stringify([
    room.center,
    room.width,
    room.depth,
    holes,
  ]);
  const shapes = useMemo(() => {
    const [x, z] = room.center,
      w = room.width / 2,
      d = room.depth / 2;
    return surfaceShapes(
      [
        [x - w, z - d],
        [x + w, z - d],
        [x + w, z + d],
        [x - w, z + d],
      ],
      holes,
    );
  }, [signature]);
  return (
    <mesh
      receiveShadow
      position={[0, -0.07, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      name={`room-floor-${room.id}`}
    >
      <extrudeGeometry args={[shapes, { depth: 0.07, bevelEnabled: false }]} />
      <meshStandardMaterial map={texture} roughness={0.84} />
    </mesh>
  );
}

function Box({
  size,
  position = [0, 0, 0],
  color,
  roughness = 0.7,
  metalness = 0,
  transparent = false,
  opacity = 1,
}: {
  size: [number, number, number];
  position?: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
}) {
  return (
    <mesh position={position} castShadow={!transparent} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        transparent={transparent}
        opacity={opacity}
      />
    </mesh>
  );
}

const surfaceFor = (element: HomeElement) => ({
  roughness:
    element.material === 'metal'
      ? 0.24
      : element.material === 'glass'
        ? 0.1
        : element.material === 'wood'
          ? 0.58
          : 0.75,
  metalness: element.material === 'metal' ? 0.7 : 0,
  transparent: element.material === 'glass',
  opacity: element.material === 'glass' ? 0.45 : 1,
});

function Structure({
  element,
  viewMode,
  bounds,
  elements,
}: {
  element: HomeElement;
  viewMode: ViewMode;
  bounds: FloorBounds;
  elements: HomeElement[];
}) {
  const { width: w, height: h, depth: d } = element.dimensions;
  const surface = surfaceFor(element);
  if (element.kind === 'wall') {
    const outerFront =
      element.position[2] > bounds.maxZ - 0.35 ||
      element.position[0] > bounds.maxX - 0.3;
    const inner =
      element.position[2] > bounds.minZ + 0.35 &&
      element.position[2] < bounds.maxZ - 0.35 &&
      element.position[0] > bounds.minX + 0.3 &&
      element.position[0] < bounds.maxX - 0.3;
    const height =
      viewMode === '3d' ? Math.min(h, outerFront ? 0.45 : inner ? 1.35 : h) : h;
    const segments = getWallSegments(element, elements, height);
    return (
      <group>
        {segments.map((segment, index) => {
          const dims = segment.dimensions;
          const top = segment.position[1] + dims.height / 2;
          const bottom = segment.position[1] - dims.height / 2;
          return (
            <group key={index}>
              <Box
                size={[dims.width, dims.height, dims.depth]}
                position={segment.position}
                color={element.color || '#e9e8e0'}
                {...surface}
              />
              {Math.abs(top - height) < 0.001 && (
                <Box
                  size={[dims.width + 0.004, 0.022, dims.depth + 0.004]}
                  position={[
                    segment.position[0],
                    top + 0.008,
                    segment.position[2],
                  ]}
                  color="#c7c8bc"
                />
              )}
              {bottom < 0.001 && (
                <Box
                  size={[
                    dims.width + 0.008,
                    Math.min(0.09, dims.height),
                    dims.depth + 0.008,
                  ]}
                  position={[
                    segment.position[0],
                    Math.min(0.09, dims.height) / 2,
                    segment.position[2],
                  ]}
                  color="#f7f5ed"
                />
              )}
            </group>
          );
        })}
      </group>
    );
  }
  if (element.kind === 'door') {
    return (
      <group>
        <Box
          size={[0.07, h, d]}
          position={[-w / 2 + 0.035, h / 2, 0]}
          color="#f6f2e8"
        />
        <Box
          size={[0.07, h, d]}
          position={[w / 2 - 0.035, h / 2, 0]}
          color="#f6f2e8"
        />
        {viewMode !== '3d' && (
          <Box
            size={[w, 0.08, d]}
            position={[0, h - 0.04, 0]}
            color="#f6f2e8"
          />
        )}
        <group
          position={[-w / 2 + 0.07, 0, 0]}
          rotation={[0, -Math.PI / 2.7, 0]}
        >
          <Box
            size={[
              Math.max(w - 0.14, 0.005),
              viewMode === '3d' ? Math.min(h, 0.75) : Math.max(h - 0.08, 0.005),
              0.05,
            ]}
            position={[
              (w - 0.14) / 2,
              (viewMode === '3d' ? Math.min(h, 0.75) : h - 0.08) / 2,
              0,
            ]}
            color={element.color || '#bda686'}
            {...surface}
          />
          {viewMode !== '3d' && (
            <Box
              size={[0.1, 0.04, 0.09]}
              position={[w - 0.24, 1, 0.07]}
              color="#817b62"
            />
          )}
        </group>
        <Line
          points={[
            [-w / 2, 0.018, 0],
            [w / 2, 0.018, 0],
          ]}
          color="#ae9c7f"
          lineWidth={1}
        />
      </group>
    );
  }
  const color = element.color || '#c9cfc8';
  return (
    <group>
      <Box size={[w, 0.07, d + 0.09]} position={[0, 0, 0]} color="#f9f8f3" />
      <Box
        size={[w, 0.055, d]}
        position={[0, h, 0]}
        color={color}
        {...surface}
      />
      <Box
        size={[0.055, h, d]}
        position={[-w / 2 + 0.028, h / 2, 0]}
        color={color}
        {...surface}
      />
      <Box
        size={[0.055, h, d]}
        position={[w / 2 - 0.028, h / 2, 0]}
        color={color}
        {...surface}
      />
      <Box
        size={[0.04, h, d]}
        position={[0, h / 2, 0]}
        color={color}
        {...surface}
      />
      <Box
        size={[Math.max(w - 0.09, 0.005), Math.max(h - 0.055, 0.005), 0.022]}
        position={[0, h / 2, 0]}
        color="#c3d7da"
        transparent
        opacity={0.26}
        roughness={0.1}
      />
    </group>
  );
}

function Utility({ element }: { element: HomeElement }) {
  const { width: w, height: h, depth: d } = element.dimensions;
  const surface = surfaceFor(element);
  const plumbing = element.kind === 'water-port';
  const color = plumbing ? '#4196c8' : '#e6aa37';
  if (element.kind === 'light')
    return (
      <group>
        <mesh position={[0, h / 2, 0]}>
          <cylinderGeometry args={[w / 2, w / 2, h, 32]} />
          <meshStandardMaterial
            color={element.color}
            {...surface}
            emissive="#ffdb7e"
            emissiveIntensity={0.4}
          />
        </mesh>
        <mesh position={[0, h / 2, 0]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>
    );
  return (
    <group>
      <Box
        size={[w, h, d]}
        position={[0, h / 2, 0]}
        color={element.color}
        {...surface}
      />
      <Box
        size={[w * 0.76, h * 0.76, d * 0.12]}
        position={[0, h / 2, d * 0.54]}
        color={color}
      />
      {element.kind === 'socket' ? (
        <>
          <Box
            size={[0.015, 0.025, 0.01]}
            position={[-w * 0.15, h / 2, d * 0.63]}
            color="#694d20"
          />
          <Box
            size={[0.015, 0.025, 0.01]}
            position={[w * 0.15, h / 2, d * 0.63]}
            color="#694d20"
          />
        </>
      ) : (
        <mesh position={[0, h / 2, d * 0.65]}>
          <sphereGeometry args={[Math.min(w, h) * 0.2, 16, 16]} />
          <meshStandardMaterial color={plumbing ? '#d6eff9' : '#fff1c7'} />
        </mesh>
      )}
      <mesh position={[0, h / 2, 0]}>
        <sphereGeometry args={[Math.max(w, h) * 0.85, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.09}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Dimensions({
  element,
  full = true,
  units = 'm',
}: {
  element: HomeElement;
  full?: boolean;
  units?: 'm' | 'ft';
}) {
  const { size } = useThree();
  const labelStyle =
    size.width < 600
      ? { ...dimensionStyle, fontSize: 8, padding: '3px 5px' }
      : dimensionStyle;
  const measure = (value: number) =>
    `${(units === 'ft' ? value * 3.28084 : value).toFixed(2)} ${units}`;
  const { width: w, depth: d, height: h } = element.dimensions;
  const gap = 0.2;
  const color = '#3e7955';
  return (
    <group>
      <Line
        points={[
          [-w / 2 - 0.04, 0.025, -d / 2 - 0.04],
          [w / 2 + 0.04, 0.025, -d / 2 - 0.04],
          [w / 2 + 0.04, 0.025, d / 2 + 0.04],
          [-w / 2 - 0.04, 0.025, d / 2 + 0.04],
          [-w / 2 - 0.04, 0.025, -d / 2 - 0.04],
        ]}
        color={color}
        lineWidth={1.5}
      />
      <Line
        points={[
          [-w / 2, 0.035, d / 2 + gap],
          [w / 2, 0.035, d / 2 + gap],
        ]}
        color={color}
        lineWidth={1}
      />
      {[-w / 2, w / 2].map((x) => (
        <Line
          key={x}
          points={[
            [x, 0.035, d / 2 + gap - 0.075],
            [x, 0.035, d / 2 + gap + 0.075],
          ]}
          color={color}
          lineWidth={1}
        />
      ))}
      <Html
        position={[0, 0.08, d / 2 + gap + 0.02]}
        center
        style={labelStyle}
        zIndexRange={[12, 0]}
      >
        {measure(w)}
      </Html>
      {full && (
        <>
          <Line
            points={[
              [w / 2 + gap, 0.035, -d / 2],
              [w / 2 + gap, 0.035, d / 2],
            ]}
            color={color}
            lineWidth={1}
          />
          <Html
            position={[w / 2 + gap + 0.08, 0.08, 0]}
            center
            style={labelStyle}
            zIndexRange={[12, 0]}
          >
            {measure(d)}
          </Html>
          <Line
            points={[
              [-w / 2 - gap, 0.025, -d / 2],
              [-w / 2 - gap, h, -d / 2],
            ]}
            color={color}
            lineWidth={1}
            dashed
            dashSize={0.07}
            gapSize={0.05}
          />
          <Html
            position={[-w / 2 - gap, Math.max(h / 2, 0.2), -d / 2]}
            center
            style={labelStyle}
            zIndexRange={[12, 0]}
          >
            {measure(h)}
          </Html>
        </>
      )}
    </group>
  );
}

interface SceneInteraction {
  active: boolean;
  suppressUntil: number;
  cancelCamera: boolean;
}
type Gizmo = React.ComponentRef<typeof TransformControls>;
interface TransformGesture {
  original: HomeElement;
  mode: 'translate' | 'scale' | 'rotate';
  patch: Partial<HomeElement>;
  control: Gizmo;
  pointerId: number | null;
  orbit: { enabled: boolean } | undefined;
  orbitWasEnabled: boolean;
}

function ElementView({
  element,
  selected,
  layers,
  tool,
  viewMode,
  onSelect,
  onUpdate,
  units,
  bounds,
  elements,
  snapToGrid,
  interaction,
}: {
  bounds: FloorBounds;
  elements: HomeElement[];
  snapToGrid?: boolean;
  element: HomeElement;
  selected: boolean;
  layers: Layers;
  tool: ToolMode;
  viewMode: ViewMode;
  units?: 'm' | 'ft';
  onSelect: SceneProps['onSelect'];
  onUpdate: SceneProps['onUpdate'];
  interaction: SceneInteraction;
}) {
  const { gl, controls, size, scene } = useThree();
  const group = useRef<THREE.Group>(null);
  const anchor = useRef<THREE.Group>(null);
  const gizmo = useRef<Gizmo>(null);
  const gesture = useRef<TransformGesture | null>(null);
  const sourcePointer = useRef<{ id: number; orbitWasEnabled: boolean } | null>(
    null,
  );
  const finishRef = useRef<(commit: boolean) => void>(() => {});
  const [preview, setPreview] = useState<HomeElement | null>(null);
  const editable =
    selected && !element.locked && viewMode !== 'walk' && tool !== 'measure';
  const mode =
    tool === 'resize' ? 'scale' : tool === 'rotate' ? 'rotate' : 'translate';
  const rendered = preview ?? element;
  const restoreAnchor = (source: HomeElement) => {
    if (!anchor.current) return;
    anchor.current.position.fromArray(source.position);
    anchor.current.rotation.set(0, toRad(source.rotation), 0);
    anchor.current.scale.set(1, 1, 1);
    anchor.current.updateMatrixWorld();
  };
  const patchFromAnchor = (active: TransformGesture): Partial<HomeElement> => {
    const object = anchor.current;
    if (!object) return {};
    if (active.mode === 'translate') {
      const patch = moveElement(
        active.original,
        [
          object.position.x - active.original.position[0],
          object.position.z - active.original.position[2],
        ],
        snapToGrid,
      );
      object.position.fromArray(patch.position!);
      return patch;
    }
    if (active.mode === 'rotate') {
      // Extract heading from the quaternion: Euler Y folds beyond 90 degrees.
      const heading = new THREE.Vector3(0, 0, 1).applyQuaternion(
        object.quaternion,
      );
      let rotation = normalizeRotation(
        THREE.MathUtils.radToDeg(Math.atan2(heading.x, heading.z)),
      );
      if (snapToGrid)
        rotation = normalizeRotation(Math.round(rotation / 15) * 15);
      return { rotation };
    }
    const dimensions = { ...active.original.dimensions };
    for (const [field, axis] of [
      ['width', 'x'],
      ['height', 'y'],
      ['depth', 'z'],
    ] as const) {
      if (Math.abs(object.scale[axis] - 1) < 0.00001) continue;
      dimensions[field] = Math.max(
        0.01,
        Math.min(
          100,
          snapLength(
            active.original.dimensions[field] * object.scale[axis],
            snapToGrid,
          ),
        ),
      );
      object.scale[axis] =
        dimensions[field] / active.original.dimensions[field];
    }
    return { dimensions };
  };
  const changed = (active: TransformGesture, patch: Partial<HomeElement>) => {
    if (patch.position)
      return patch.position.some(
        (value, index) =>
          Math.abs(value - active.original.position[index]) > 0.00001,
      );
    if (patch.rotation !== undefined)
      return (
        Math.abs(normalizeRotation(patch.rotation - active.original.rotation)) >
        0.00001
      );
    if (patch.dimensions)
      return (['width', 'height', 'depth'] as const).some(
        (key) =>
          Math.abs(patch.dimensions![key] - active.original.dimensions[key]) >
          0.00001,
      );
    return false;
  };
  finishRef.current = (commit: boolean) => {
    const active = gesture.current;
    if (!active) return;
    const patch =
      commit && Object.keys(active.patch).length ? patchFromAnchor(active) : {};
    gesture.current = null;
    interaction.active = false;
    interaction.suppressUntil = performance.now() + 250;
    // Drei exposes these reactive flags as props, although three-stdlib types them private.
    const controlState = active.control as unknown as {
      dragging: boolean;
      axis: string | null;
    };
    controlState.dragging = false;
    controlState.axis = null;
    if (active.orbit) active.orbit.enabled = active.orbitWasEnabled;
    restoreAnchor(active.original);
    setPreview(null);
    if (commit && changed(active, patch)) onUpdate(active.original.id, patch);
  };
  useEffect(() => {
    if (gesture.current) finishRef.current(false);
    restoreAnchor(element);
    // A changed source or editing mode cancels its unfinished local preview.
  }, [element, tool, editable]);
  useEffect(() => {
    if (!editable) return;
    const canvas = gl.domElement;
    const orbit = controls as unknown as { enabled: boolean } | undefined;
    const down = (event: PointerEvent) => {
      if (gesture.current && event.pointerId !== gesture.current.pointerId) {
        event.stopImmediatePropagation();
        return;
      }
      if (event.button === 0)
        sourcePointer.current = {
          id: event.pointerId,
          orbitWasEnabled: orbit?.enabled !== false,
        };
    };
    const filterOtherPointer = (event: PointerEvent) => {
      if (gesture.current && event.pointerId !== gesture.current.pointerId)
        event.stopImmediatePropagation();
    };
    const cancel = (event?: PointerEvent) => {
      if (
        gesture.current &&
        (!event || event.pointerId === gesture.current.pointerId)
      )
        finishRef.current(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        finishRef.current(false);
      }
    };
    const blur = () => cancel();
    canvas.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', filterOtherPointer, true);
    window.addEventListener('pointerup', filterOtherPointer, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('keydown', escape, true);
    window.addEventListener('blur', blur);
    return () => {
      finishRef.current(false);
      canvas.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', filterOtherPointer, true);
      window.removeEventListener('pointerup', filterOtherPointer, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('blur', blur);
    };
  }, [gl, controls, editable]);
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(element.id);
  };
  const structure = ['wall', 'door', 'window'].includes(element.kind);
  const utility =
    ELECTRICAL_KINDS.includes(element.kind) ||
    PLUMBING_KINDS.includes(element.kind);
  return (
    <>
      <group
        ref={group}
        name={element.id}
        userData={{ elementId: element.id, kind: element.kind }}
        position={rendered.position}
        rotation={[0, toRad(rendered.rotation), 0]}
        onClick={click}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        {structure ? (
          <Structure
            element={rendered}
            viewMode={viewMode}
            bounds={bounds}
            elements={elements}
          />
        ) : element.kind === 'stairs' ? (
          <Stairs element={rendered} />
        ) : utility ? (
          <Utility element={rendered} />
        ) : (
          <Furniture element={rendered} />
        )}
        {((selected && viewMode !== 'walk') || layers.dimensions) && (
          <Dimensions element={rendered} full={selected} units={units} />
        )}
        {selected && viewMode !== 'walk' && (
          <mesh position={[0, 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry
              args={[
                rendered.dimensions.width + 0.1,
                rendered.dimensions.depth + 0.1,
              ]}
            />
            <meshBasicMaterial
              color="#487d57"
              transparent
              opacity={0.12}
              depthWrite={false}
            />
          </mesh>
        )}
        {editable && (
          <Html
            position={[0, rendered.dimensions.height + 0.4, 0]}
            center
            zIndexRange={[15, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="scene-transform-hint" data-mode={mode}>
              <strong>
                {mode === 'scale'
                  ? 'Resize'
                  : mode === 'rotate'
                    ? 'Rotate'
                    : 'Move'}
              </strong>
              <span>
                {mode === 'scale'
                  ? 'Drag a cube · width, height, depth'
                  : mode === 'rotate'
                    ? 'Drag the green ring'
                    : 'Drag an arrow or the center square'}
              </span>
              <small>
                {preview
                  ? 'Release to apply · Esc to cancel'
                  : snapToGrid
                    ? mode === 'rotate'
                      ? '15° snapping'
                      : '10 cm snapping'
                    : 'Free adjustment'}
              </small>
            </div>
          </Html>
        )}
      </group>
      {editable && (
        <>
          <group
            ref={anchor}
            name={`transform-anchor-${element.id}`}
            position={element.position}
            rotation={[0, toRad(element.rotation), 0]}
          />
          {createPortal(
            <TransformControls
              ref={gizmo}
              object={anchor as React.RefObject<THREE.Group>}
              mode={mode}
              showX={mode !== 'rotate'}
              showY={mode !== 'translate'}
              showZ={mode !== 'rotate'}
              size={size.width < 600 ? 1.15 : 0.95}
              space={mode === 'scale' ? 'local' : 'world'}
              translationSnap={snapToGrid ? 0.1 : null}
              rotationSnap={snapToGrid ? Math.PI / 12 : null}
              onMouseDown={() => {
                if (!gizmo.current || gesture.current) return;
                interaction.active = true;
                interaction.cancelCamera = true;
                gesture.current = {
                  original: element,
                  mode,
                  patch: {},
                  control: gizmo.current,
                  pointerId: sourcePointer.current?.id ?? null,
                  orbit: controls as unknown as
                    | { enabled: boolean }
                    | undefined,
                  orbitWasEnabled:
                    sourcePointer.current?.orbitWasEnabled ?? true,
                };
              }}
              onObjectChange={() => {
                const active = gesture.current;
                if (!active) return;
                active.patch = patchFromAnchor(active);
                setPreview({ ...active.original, ...active.patch });
              }}
              onMouseUp={() => finishRef.current(true)}
            />,
            scene,
          )}
        </>
      )}
    </>
  );
}

function UtilityRoutes({
  project,
  layers,
}: {
  project: Project;
  layers: Layers;
}) {
  const routes = useMemo(
    () =>
      getConnections(project)
        .filter(
          (connection) =>
            connection.enabled &&
            layers[connection.system] &&
            [connection.fromId, connection.toId].every((id) =>
              project.elements.some(
                (element) => element.id === id && element.visible,
              ),
            ),
        )
        .map((connection) => ({
          connection,
          points: connectionWorldPoints(connection, project),
        }))
        .filter((route) => route.points.length > 1),
    [
      project.elements,
      project.connections,
      layers.electrical,
      layers.plumbing,
      project.levels,
    ],
  );
  return (
    <group>
      {routes.map(({ connection, points }) => (
        <group key={connection.id}>
          <Line
            points={points}
            color={connection.system === 'electrical' ? '#dfa739' : '#4d9bc9'}
            lineWidth={Math.max(1.5, Math.min(5, connection.size / 10))}
          />
          {connection.label && layers.labels && (
            <Html
              position={points[Math.floor(points.length / 2)]}
              center
              style={dimensionStyle}
              zIndexRange={[9, 0]}
            >
              {connection.label}
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}

function CameraController({
  viewMode,
  focusRoomId,
  cameraAction,
  project,
  selectedId,
  interaction,
  buildingProject,
  showAllLevels,
}: Pick<
  SceneProps,
  | 'viewMode'
  | 'focusRoomId'
  | 'cameraAction'
  | 'project'
  | 'selectedId'
  | 'buildingProject'
  | 'showAllLevels'
> & { interaction: SceneInteraction }) {
  const { camera, controls, size } = useThree();
  const lastCameraCommand = useRef(cameraAction.nonce);
  const transition = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);
  const controlsTyped = controls as unknown as
    | { target: THREE.Vector3; update: () => void }
    | undefined;
  const room = project.rooms.find((item) => item.id === focusRoomId);
  const selected = project.elements.find((item) => item.id === selectedId);
  const floor = getFloorPlan(project);
  const levels = buildingLevels(buildingProject ?? project);
  const activeLevel =
    levels.find((level) => level.id === project.activeLevelId) ?? levels[0];
  const displayedLevels = showAllLevels ? levels : [activeLevel];
  const elevation = showAllLevels
    ? Math.min(...levels.map((level) => level.elevation))
    : activeLevel.elevation;
  const buildingHeight =
    Math.max(
      ...displayedLevels.map(
        (level) => level.elevation + level.floorPlan.wallHeight,
      ),
    ) - elevation;
  const bounds = floorBounds({
    ...floor,
    outline: displayedLevels.flatMap((level) => level.floorPlan.outline),
  });
  const fit = (frameBounds: FloorBounds) => {
    const frame = fittedCamera(
      frameBounds,
      size.width / size.height,
      viewMode === '2d',
      buildingHeight,
    );
    frame.position.y += elevation;
    frame.target.y += elevation;
    return frame;
  };
  const focusedBounds = room ? getFloorBounds([room]) : bounds;
  const maxDistance = Math.max(65, Math.hypot(bounds.width, bounds.depth) * 8);
  const layoutSignature = JSON.stringify([
    floor.outline,
    floor.wallHeight,
    displayedLevels,
    room?.center,
    room?.width,
    room?.depth,
  ]);
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = viewMode === 'walk' ? 72 : 38;
    perspective.far = Math.max(500, maxDistance * 3);
    perspective.updateProjectionMatrix();
    if (viewMode === 'walk') {
      transition.current = null;
      return;
    }
    transition.current = fit(focusedBounds);
    // Room geometry determines framing. Ordinary element edits do not reset an orbit.
  }, [viewMode, focusRoomId, layoutSignature, camera, size.width, size.height]);
  useEffect(() => {
    if (cameraAction.nonce === lastCameraCommand.current) return;
    lastCameraCommand.current = cameraAction.nonce;
    if (viewMode === 'walk') return;
    const target =
      controlsTyped?.target.clone() ??
      new THREE.Vector3(bounds.centerX, 0, bounds.centerZ);
    if (cameraAction.type === 'zoom-in' || cameraAction.type === 'zoom-out') {
      const factor = cameraAction.type === 'zoom-in' ? 0.8 : 1.25;
      const offset = camera.position.clone().sub(target).multiplyScalar(factor);
      offset.clampLength(3, maxDistance);
      transition.current = { position: target.clone().add(offset), target };
    } else if (cameraAction.type === 'focus' && selected) {
      const focus = new THREE.Vector3(
        selected.position[0],
        activeLevel.elevation +
          selected.position[1] +
          selected.dimensions.height / 2,
        selected.position[2],
      );
      const distance =
        Math.max(selected.dimensions.width, selected.dimensions.depth, 2.2) *
        2.4;
      const direction =
        viewMode === '2d'
          ? new THREE.Vector3(0, 1, 0.0001)
          : new THREE.Vector3(1, 1.1, 1.25).normalize();
      transition.current = {
        position: focus.clone().add(direction.multiplyScalar(distance)),
        target: focus,
      };
    } else if (cameraAction.type === 'reset' || cameraAction.type === 'focus') {
      transition.current = fit(
        cameraAction.type === 'focus' ? focusedBounds : bounds,
      );
    }
    // The nonce represents a user command; selecting an element should not move the camera.
  }, [cameraAction.nonce, viewMode]);
  useFrame((_, delta) => {
    if (interaction.cancelCamera || interaction.active) {
      transition.current = null;
      interaction.cancelCamera = false;
      return;
    }
    const next = transition.current;
    if (!next || viewMode === 'walk' || !controlsTyped) return;
    const amount = 1 - Math.exp(-delta * 7);
    camera.position.lerp(next.position, amount);
    controlsTyped.target.lerp(next.target, amount);
    controlsTyped.update();
    if (camera.position.distanceTo(next.position) < 0.015) {
      camera.position.copy(next.position);
      controlsTyped.target.copy(next.target);
      transition.current = null;
    }
  });
  return null;
}

function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}

function LevelContents({
  project,
  floor,
  elevation,
  holes,
  active,
  props,
  compact,
}: {
  project: Project;
  floor: FloorPlan;
  elevation: number;
  holes: Point2[][];
  active: boolean;
  props: SceneProps & { interaction: SceneInteraction };
  compact: boolean;
}) {
  const {
    layers,
    selectedId,
    onSelect,
    onUpdate,
    viewMode,
    tool,
    units = 'm',
  } = props;
  const bounds = floorBounds(floor);
  const levelId = project.activeLevelId;
  const select = (id: string | null) => {
    if (!active && levelId) props.onActiveLevelChange?.(levelId);
    onSelect(id);
  };
  return (
    <group
      position={[0, elevation, 0]}
      name={`building-level-${levelId}`}
      userData={{ levelId, elevation }}
    >
      <FloorFoundation
        floor={floor}
        units={units}
        selected={active && selectedId === FLOOR_ID}
        onSelect={select}
        showDimensions={viewMode !== 'walk' && active}
        holes={holes}
      />
      {project.rooms.map((room) => (
        <RoomFloor room={room} holes={holes} key={room.id} />
      ))}
      {project.elements
        .filter((element) => isElementVisible(element, layers))
        .map((element) => (
          <ElementView
            key={element.id}
            element={element}
            selected={active && element.id === selectedId}
            layers={layers}
            tool={tool}
            viewMode={viewMode}
            onSelect={select}
            onUpdate={onUpdate}
            units={units}
            bounds={bounds}
            elements={project.elements}
            snapToGrid={props.snapToGrid}
            interaction={props.interaction}
          />
        ))}
      {layers.labels &&
        viewMode !== 'walk' &&
        active &&
        project.rooms.map((room) => (
          <Html
            key={room.id}
            position={[room.center[0], 0.12, room.center[1]]}
            center
            zIndexRange={[5, 0]}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: compact ? 7 : 10,
                fontWeight: 650,
                letterSpacing: '.015em',
                color: '#56604d',
                padding: compact ? '3px 5px' : '5px 8px',
                borderRadius: 5,
                background: '#fffef8c9',
              }}
            >
              {room.name}
              <span
                style={{
                  display: 'block',
                  marginTop: 3,
                  fontSize: compact ? 6 : 8,
                  color: '#8a9180',
                  fontWeight: 450,
                }}
              >
                {(
                  room.width *
                  room.depth *
                  (units === 'ft' ? 10.7639 : 1)
                ).toFixed(1)}{' '}
                {units}²
              </span>
            </div>
          </Html>
        ))}
    </group>
  );
}
function World(
  props: SceneProps & {
    interaction: SceneInteraction;
    onWalkStatus: (status: WalkStatus) => void;
  },
) {
  const { project, layers, viewMode } = props;
  const { size } = useThree();
  const full = props.buildingProject ?? project;
  const world = useMemo(() => makeWalkWorld(full), [full]);
  const activeLevel =
    world.levels.find((level) => level.id === project.activeLevelId) ??
    world.levels[0];
  const allLevels = viewMode === 'walk' || props.showAllLevels;
  const displayedLevels = allLevels ? world.levels : [activeLevel];
  const outline = displayedLevels.flatMap((level) => level.floorPlan.outline);
  const bounds = floorBounds({ ...activeLevel.floorPlan, outline });
  const baseElevation = Math.min(
    ...world.levels.map((level) => level.elevation),
  );
  const topElevation = Math.max(
    ...displayedLevels.map(
      (level) => level.elevation + level.floorPlan.wallHeight,
    ),
  );
  const span = Math.max(
    bounds.width,
    bounds.depth,
    topElevation - baseElevation,
    8,
  );
  const levelProjects = useMemo(
    () =>
      world.levels.map((level) => ({
        level,
        project: {
          ...full,
          activeLevelId: level.id,
          floorPlan: level.floorPlan,
          rooms: full.rooms.filter(
            (room) => (room.levelId ?? world.levels[0].id) === level.id,
          ),
          elements: full.elements.filter(
            (element) => elementLevelId(element, world.levels) === level.id,
          ),
        },
      })),
    [full, world],
  );
  const routesProject = allLevels ? full : project;
  const lightTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(
      bounds.centerX,
      (baseElevation + topElevation) / 2,
      bounds.centerZ,
    );
    target.updateMatrixWorld();
    return target;
  }, [bounds.centerX, bounds.centerZ, baseElevation, topElevation]);
  return (
    <>
      <color attach="background" args={['#eeefe8']} />
      <ambientLight intensity={1.55} />
      <hemisphereLight args={['#fffdfa', '#aab5a0', 1.15]} />
      <directionalLight
        position={[
          bounds.centerX - span * 0.42,
          topElevation + span * 1.34,
          bounds.centerZ + span * 0.67,
        ]}
        target={lightTarget}
        intensity={2.8}
        color="#fff6e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-camera-far={span * 8}
        shadow-normalBias={0.035}
        shadow-bias={-0.0002}
      />
      <directionalLight
        position={[bounds.centerX + 9, topElevation + 8, bounds.centerZ - 6]}
        target={lightTarget}
        intensity={0.5}
        color="#edf2fa"
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[bounds.centerX, baseElevation - 0.31, bounds.centerZ]}
        receiveShadow
      >
        <planeGeometry
          args={[Math.max(200, span * 8), Math.max(200, span * 8)]}
        />
        <meshStandardMaterial color="#eceee6" roughness={1} />
      </mesh>
      <Grid
        position={[bounds.centerX, baseElevation - 0.3, bounds.centerZ]}
        args={[80, 80]}
        cellSize={0.5}
        cellThickness={0.35}
        cellColor="#d9dfd2"
        sectionSize={2.5}
        sectionThickness={0.55}
        sectionColor="#d0d8c8"
        fadeDistance={Math.max(34, span * 3)}
        fadeStrength={1.5}
        infiniteGrid
      />
      {levelProjects
        .filter(({ level }) => allLevels || level.id === activeLevel.id)
        .map(({ level, project: levelProject }) => (
          <LevelContents
            key={level.id}
            project={levelProject}
            floor={level.floorPlan}
            elevation={level.elevation}
            holes={world.holes[level.id] ?? []}
            active={level.id === activeLevel.id}
            props={props}
            compact={size.width < 600}
          />
        ))}
      <UtilityRoutes project={routesProject} layers={layers} />
      {viewMode !== 'walk' && (
        <OrbitControls
          makeDefault
          onStart={() => {
            props.interaction.cancelCamera = true;
          }}
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={Math.max(
            65,
            Math.hypot(
              bounds.width,
              bounds.depth,
              topElevation - baseElevation,
            ) * 8,
          )}
          maxPolarAngle={viewMode === '2d' ? 0.0001 : Math.PI / 2.03}
          minPolarAngle={viewMode === '2d' ? 0.0001 : 0.08}
          enableRotate={viewMode !== '2d'}
          target={[bounds.centerX, activeLevel.elevation + 0.1, bounds.centerZ]}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />
      )}
      {viewMode === 'walk' && (
        <WalkController
          world={world}
          project={full}
          focusRoomId={props.focusRoomId}
          interaction={props.interaction}
          settings={props.walkthroughSettings}
          onActiveLevelChange={props.onActiveLevelChange}
          onStatus={props.onWalkStatus}
        />
      )}
      <CameraController {...props} />
      <Ready onReady={props.onReady} />
    </>
  );
}

class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? <SceneFallback /> : this.props.children;
  }
}
function SceneFallback() {
  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeContent: 'center',
        textAlign: 'center',
        padding: 40,
        background: '#eeefe8',
        color: '#53654e',
      }}
    >
      <strong style={{ fontSize: 18 }}>Your home is ready to explore</strong>
      <p style={{ maxWidth: 310, fontSize: 13, lineHeight: 1.7 }}>
        The 3D canvas needs WebGL. Enable hardware acceleration in your browser,
        then reload. You can still edit your home using the element library and
        properties panel.
      </p>
    </div>
  );
}

export default function Scene(props: SceneProps) {
  const interaction = useRef<SceneInteraction>({
    active: false,
    suppressUntil: 0,
    cancelCamera: false,
  });
  const select = (id: string | null) => {
    if (
      !interaction.current.active &&
      performance.now() >= interaction.current.suppressUntil
    )
      props.onSelect(id);
  };
  const [supportsWebGL] = useState(() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  });
  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );
  const [walkStatus, setWalkStatus] = useState<WalkStatus | null>(null);
  if (!supportsWebGL) return <SceneFallback />;
  return (
    <SceneErrorBoundary>
      <div className="scene-view">
        <Canvas
          className="scene-canvas"
          shadows
          camera={{ position: [14, 16, 18], fov: 38, near: 0.05, far: 2000 }}
          dpr={[1, 1.75]}
          gl={{
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
          }}
          onPointerMissed={(event) => {
            if (event.type === 'click') select(null);
          }}
          style={{ width: '100%', height: '100%', touchAction: 'none' }}
          aria-label="Interactive 3D home model"
        >
          <Suspense fallback={null}>
            <World
              {...props}
              onSelect={select}
              interaction={interaction.current}
              onWalkStatus={setWalkStatus}
            />
          </Suspense>
        </Canvas>
        {props.viewMode === 'walk' && walkStatus && (
          <aside
            className="walk-person-status"
            aria-label="Walkthrough person"
            data-walk-x={walkStatus.position.x.toFixed(3)}
            data-walk-y={walkStatus.position.y.toFixed(3)}
            data-walk-z={walkStatus.position.z.toFixed(3)}
            data-walk-level={walkStatus.position.levelId}
            data-walk-height={walkStatus.height}
            data-walk-camera={walkStatus.camera}
            data-walk-seated={walkStatus.seated}
          >
            <div className="walk-person-location">
              <span className="walk-person-dot" />
              <strong>{walkStatus.levelName}</strong>
              <span>
                {walkStatus.seated
                  ? 'Seated'
                  : walkStatus.position.stairId
                    ? 'On stairs'
                    : 'Standing'}
              </span>
            </div>
            <p>
              Eye level{' '}
              {(
                walkStatus.eyeElevation * (props.units === 'ft' ? 3.28084 : 1)
              ).toFixed(2)}{' '}
              {props.units ?? 'm'} <span>above project zero</span>
            </p>
            <button
              className="walk-seat-action"
              disabled={!walkStatus.seated && !walkStatus.canSit}
              onClick={() =>
                window.dispatchEvent(new CustomEvent('ghar-interact'))
              }
            >
              {walkStatus.seated
                ? 'Stand up'
                : walkStatus.canSit
                  ? `Sit on ${walkStatus.seatName}`
                  : 'Approach a sofa or chair to sit'}
              <kbd>E</kbd>
            </button>
            {walkStatus.message && (
              <small role="status">{walkStatus.message}</small>
            )}
          </aside>
        )}
      </div>
    </SceneErrorBoundary>
  );
}
