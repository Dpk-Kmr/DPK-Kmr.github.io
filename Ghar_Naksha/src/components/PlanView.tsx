import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  ELECTRICAL_KINDS,
  FLOOR_ID,
  isElementVisible,
  STRUCTURAL_KINDS,
} from '../types';
import {
  floorArea,
  floorBounds,
  getFloorPlan,
  roomFitsFloor,
  validateFloorPlan,
} from '../lib/floor';
import { connectionPoints, getConnections } from '../lib/connections';
import { updateRoom } from '../lib/rooms';
import { syncWallAttachments } from '../lib/openings';
import { rebuildPerimeter } from '../lib/design';
import { dragFloorCorner, dragFloorSide } from '../lib/floorEditing';
import {
  moveElement,
  moveRoom,
  resizeElement,
  resizeRoom,
  rotateElement,
} from '../lib/transforms';
import type { PlanPoint, ResizeHandle } from '../lib/transforms';
import { selectionBounds, transformGroup } from '../lib/groupTransforms';
import type { GroupUpdate } from '../lib/groupTransforms';
import { StairsPlanSymbol } from './StairsPlanSymbol';
import type {
  FloorPlan,
  HomeElement,
  Layers,
  Project,
  Room,
  ToolMode,
  UtilityConnection,
} from '../types';
import './PlanView.css';

interface PlanViewProps {
  project: Project;
  selectedId: string | null;
  selectedIds?: string[];
  multiSelect?: boolean;
  onSelect: (id: string | null, additive?: boolean) => void;
  onSelectMany?: (ids: string[]) => void;
  onUpdateElements?: (
    updates: { id: string; patch: Partial<HomeElement> }[],
    connections?: UtilityConnection[],
  ) => void;
  onUpdate: (id: string, patch: Partial<HomeElement>) => void;
  onSelectRoom?: (id: string) => void;
  onUpdateRoom?: (id: string, patch: Partial<Room>) => void;
  onUpdateFloor?: (floor: FloorPlan) => void;
  layers: Layers;
  tool: ToolMode;
  focusRoomId: string | null;
  cameraAction: {
    type: 'reset' | 'zoom-in' | 'zoom-out' | 'focus';
    nonce: number;
  };
  units?: 'm' | 'ft';
  snapToGrid?: boolean;
}

interface Camera {
  x: number;
  z: number;
  span: number;
}
interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
type GestureStart = {
  pointerId: number;
  start: PlanPoint;
  clientStart: PlanPoint;
  moved: boolean;
};
type Drag =
  | (GestureStart & {
      kind: 'group';
      action: 'move' | 'resize' | 'rotate';
      ids: string[];
      handle: ResizeHandle;
    })
  | (GestureStart & { kind: 'marquee'; end: PlanPoint; initialIds: string[] })
  | (GestureStart & {
      kind: 'element';
      action: 'move' | 'resize' | 'rotate';
      element: HomeElement;
      handle: ResizeHandle;
    })
  | (GestureStart & {
      kind: 'room';
      action: 'move' | 'resize';
      room: Room;
      handle: ResizeHandle;
    })
  | (GestureStart & {
      kind: 'floor';
      action: 'corner' | 'side';
      floor: FloorPlan;
      index: number;
      rectangular: boolean;
    })
  | {
      kind: 'pan';
      pointerId: number;
      clientStart: PlanPoint;
      camera: Camera;
      scale: number;
    };
type Preview =
  | ({ kind: 'group' } & GroupUpdate)
  | { kind: 'element'; id: string; patch: Partial<HomeElement> }
  | { kind: 'room'; id: string; patch: Partial<Room> }
  | { kind: 'floor'; floor: FloorPlan }
  | null;
type Pinch = {
  distance: number;
  midpoint: PlanPoint;
  anchor: PlanPoint;
  camera: Camera;
  scale: number;
};
const RESIZE_HANDLES: {
  handle: ResizeHandle;
  label: string;
  cursor: string;
}[] = [
  { handle: [-1, -1], label: 'northwest', cursor: 'nwse-resize' },
  { handle: [0, -1], label: 'north', cursor: 'ns-resize' },
  { handle: [1, -1], label: 'northeast', cursor: 'nesw-resize' },
  { handle: [1, 0], label: 'east', cursor: 'ew-resize' },
  { handle: [1, 1], label: 'southeast', cursor: 'nwse-resize' },
  { handle: [0, 1], label: 'south', cursor: 'ns-resize' },
  { handle: [-1, 1], label: 'southwest', cursor: 'nesw-resize' },
  { handle: [-1, 0], label: 'west', cursor: 'ew-resize' },
];
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const frameBounds = (bounds: Bounds, aspect: number): Camera => ({
  x: (bounds.minX + bounds.maxX) / 2,
  z: (bounds.minZ + bounds.maxZ) / 2 - 0.3,
  span: Math.max(
    bounds.maxX - bounds.minX + 3.6,
    (bounds.maxZ - bounds.minZ + 4.6) * aspect,
    5,
  ),
});

function SketchStairArrows({ elements }: { elements: HomeElement[] }) {
  return <g pointerEvents="none" data-sketch-stair-directions="true">
    {(['low','high'] as const).map(flight=>{
      const first=elements.find(e=>e.id===`stair-${flight}-1` && e.visible);
      const last=elements.find(e=>e.id===`stair-${flight}-9` && e.visible);
      if(!first||!last)return null;
      const [x,,y]=first.position;const [ex,,ey]=last.position;
      const len=Math.hypot(ex-x,ey-y);if(len<.1)return null;
      const dx=(ex-x)/len,dy=(ey-y)/len;
      return <g key={flight} fill="#315c49" stroke="#315c49">
        <line x1={x} y1={y} x2={ex} y2={ey} strokeWidth={.04}/>
        <polygon stroke="none" points={`${ex},${ey} ${ex-dx*.14+dy*.08},${ey-dy*.14-dx*.08} ${ex-dx*.14-dy*.08},${ey-dy*.14+dx*.08}`}/>
        <text x={flight==='low'?x:ex} y={Math.min(y,ey)-.18} fontSize={.14} textAnchor="middle" stroke="none">{flight==='low'?'UP from living':'UP return'}</text>
      </g>;
    })}
  </g>;
}

function FurnitureSymbol({ element }: { element: HomeElement }) {
  if(element.id==='wc-storage-shelf'||element.id==='upper-arrival')return <g>
    <rect x={-element.dimensions.width/2} y={-element.dimensions.depth/2} width={element.dimensions.width} height={element.dimensions.depth} fill="none" stroke="#847154" strokeWidth={.025} strokeDasharray=".08 .06"/>
    <text x={0} y={0} fontSize={.13} fill="#5d6758" textAnchor="middle">{element.id==='wc-storage-shelf'?'Storage above WC':'Upper arrival'}</text>
  </g>;
  const width = Math.max(0.35, element.dimensions.width);
  const depth = Math.max(0.35, element.dimensions.depth);
  const structure = STRUCTURAL_KINDS.includes(element.kind);
  if (
    structure ||
    (width === element.dimensions.width && depth === element.dimensions.depth)
  )
    return <FurnitureGraphic element={element} />;
  return (
    <g
      transform={`scale(${element.dimensions.width / width} ${element.dimensions.depth / depth})`}
    >
      <FurnitureGraphic
        element={{
          ...element,
          dimensions: { ...element.dimensions, width, depth },
        }}
      />
    </g>
  );
}

function FurnitureGraphic({ element }: { element: HomeElement }) {
  const {
    kind,
    dimensions: { width: w, depth: d },
    color,
  } = element;
  const x = -w / 2;
  const z = -d / 2;
  const outline = '#766e60';
  const base = (
    <rect
      x={x}
      y={z}
      width={w}
      height={d}
      rx={Math.min(w, d) * 0.07}
      fill={color}
      stroke={outline}
      strokeWidth={0.022}
    />
  );
  if (kind === 'stairs') return <StairsPlanSymbol element={element} />;
  if (kind === 'wall')
    return (
      <rect
        x={x}
        y={z}
        width={w}
        height={d}
        fill={color}
        stroke="#726f64"
        strokeWidth={0.025}
      />
    );
  if (kind === 'rug')
    return (
      <g opacity={0.85}>
        <rect
          x={x}
          y={z}
          width={w}
          height={d}
          rx={0.04}
          fill={color}
          stroke="#bfb6a6"
          strokeWidth={0.016}
        />
        <rect
          x={x + 0.12}
          y={z + 0.12}
          width={Math.max(0.01, w - 0.24)}
          height={Math.max(0.01, d - 0.24)}
          rx={0.02}
          fill="url(#plan-rug)"
          stroke="#ded5c4"
          strokeWidth={0.012}
        />
      </g>
    );
  if (element.apertureOnly) return <rect x={x} y={z} width={w} height={d} fill={element.position[1]>0?'none':'#faf9f5'} stroke={element.position[1]>0?'#847154':'none'} strokeWidth={.025} strokeDasharray={element.position[1]>0?'.08 .06':undefined}/>;
  if (kind === 'door' && element.doorSwing) {
    const hinge = element.doorSwing === -1 ? w / 2 : -w / 2;
    const end = -hinge;
    const side = element.doorSide ?? 1;
    const points = Array.from({length: 25}, (_, i) => {
      const a = i / 24 * Math.PI / 2;
      return `${hinge + (end-hinge)*Math.cos(a)},${side*w*Math.sin(a)}`;
    }).join(' ');
    return <g stroke="#928373" strokeWidth={0.026} fill="none">
      <rect x={x} y={z} width={w} height={d} fill="#faf9f5" stroke="none"/>
      <polyline points={points} strokeDasharray=".045 .035"/>
      <path d={`M ${hinge} 0 L ${hinge} ${side*w}`} strokeWidth={0.048}/>
    </g>;
  }
  if (kind === 'door')
    return (
      <g stroke="#928373" strokeWidth={0.026} fill="none">
        <rect x={x} y={z} width={w} height={d} fill="#faf9f5" stroke="none" />
        <path
          d={`M ${x} ${z + d} L ${x} ${z + d - w} A ${w} ${w} 0 0 1 ${x + w} ${z + d}`}
          strokeDasharray=".045 .035"
        />
        <path d={`M ${x} ${z + d} L ${x} ${z + d - w}`} strokeWidth={0.048} />
      </g>
    );
  if (kind === 'window')
    return (
      <g>
        <rect
          x={x}
          y={z}
          width={w}
          height={d}
          fill="#d8e5e8"
          stroke="#7a9da2"
          strokeWidth={0.024}
        />
        <path
          d={`M ${x} 0 H ${w / 2} M 0 ${z} V ${d / 2}`}
          stroke="#94b3b7"
          strokeWidth={0.019}
        />
      </g>
    );
  if (kind === 'plant')
    return (
      <g>
        <circle
          r={Math.min(w, d) * 0.39}
          fill="#ded4c1"
          stroke="#a99c83"
          strokeWidth={0.02}
        />
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse
            key={i}
            cx={0}
            cy={-d * 0.18}
            rx={w * 0.16}
            ry={d * 0.27}
            transform={`rotate(${i * 60})`}
            fill={i % 2 ? '#728461' : '#8b9b74'}
            stroke="#617651"
            strokeWidth={0.015}
          />
        ))}
        <circle r={w * 0.1} fill="#6c7c53" />
      </g>
    );
  if (kind === 'lamp')
    return (
      <g>
        <circle
          r={Math.min(w, d) / 2}
          fill="#f5e9c9"
          stroke="#9b8f6c"
          strokeWidth={0.025}
        />
        <circle r={Math.min(w, d) * 0.16} fill="#d7c9a1" />
        <path
          d={`M ${-w * 0.3} 0 H ${w * 0.3} M 0 ${-d * 0.3} V ${d * 0.3}`}
          stroke="#baae87"
          strokeWidth={0.012}
        />
      </g>
    );
  if (kind === 'sofa' || kind === 'armchair') {
    const seats = kind === 'sofa' ? 3 : 1;
    return (
      <g>
        {base}
        <rect
          x={x + 0.035}
          y={z + 0.035}
          width={w - 0.07}
          height={d * 0.22}
          rx={0.08}
          fill={color}
          stroke={outline}
          strokeWidth={0.018}
        />
        {Array.from({ length: seats }, (_, i) => (
          <rect
            key={i}
            x={x + w * 0.1 + (i * w * 0.8) / seats}
            y={z + d * 0.29}
            width={(w * 0.8) / seats - 0.035}
            height={d * 0.6}
            rx={0.075}
            fill={color}
            stroke={outline}
            strokeWidth={0.018}
          />
        ))}
        <rect
          x={x + 0.035}
          y={z + d * 0.21}
          width={w * 0.075}
          height={d * 0.72}
          rx={0.05}
          fill={color}
          stroke={outline}
          strokeWidth={0.018}
        />
        <rect
          x={w / 2 - w * 0.075 - 0.035}
          y={z + d * 0.21}
          width={w * 0.075}
          height={d * 0.72}
          rx={0.05}
          fill={color}
          stroke={outline}
          strokeWidth={0.018}
        />
      </g>
    );
  }
  if (kind === 'bed')
    return (
      <g>
        {base}
        <rect
          x={x + 0.045}
          y={z + 0.08}
          width={w - 0.09}
          height={d - 0.16}
          rx={0.09}
          fill="#f1eee4"
          stroke="#bdb5a5"
          strokeWidth={0.018}
        />
        <rect
          x={x + 0.12}
          y={z + 0.18}
          width={w * 0.36}
          height={d * 0.18}
          rx={0.055}
          fill="#f9f7f0"
          stroke="#c8c0af"
          strokeWidth={0.012}
        />
        <rect
          x={w * 0.02}
          y={z + 0.18}
          width={w * 0.36}
          height={d * 0.18}
          rx={0.055}
          fill="#f9f7f0"
          stroke="#c8c0af"
          strokeWidth={0.012}
        />
        <rect
          x={x + 0.065}
          y={z + d * 0.45}
          width={w - 0.13}
          height={d * 0.46}
          fill={color}
          opacity={0.8}
        />
        <path
          d={`M ${x + 0.065} ${z + d * 0.53} H ${w / 2 - 0.065}`}
          stroke="#b5ab94"
          strokeWidth={0.015}
        />
      </g>
    );
  if (kind === 'dining-table')
    return (
      <g>
        <ellipse
          rx={w / 2}
          ry={d / 2}
          fill={color}
          stroke={outline}
          strokeWidth={0.022}
        />
        <ellipse
          rx={w * 0.45}
          ry={d * 0.45}
          fill="none"
          stroke="#b8a487"
          strokeWidth={0.014}
        />
        <ellipse
          cx={w * 0.08}
          cy={-d * 0.03}
          rx={w * 0.085}
          ry={d * 0.085}
          fill="#d4c5a8"
          stroke="#b8a487"
          strokeWidth={0.012}
        />
        <ellipse
          cx={w * 0.08}
          cy={-d * 0.03}
          rx={w * 0.045}
          ry={d * 0.045}
          fill="#8b9875"
        />
      </g>
    );
  if (kind === 'coffee-table')
    return (
      <g>
        {base}
        <rect
          x={x + w * 0.055}
          y={z + d * 0.07}
          width={w * 0.89}
          height={d * 0.86}
          rx={Math.min(w, d) * 0.06}
          fill="none"
          stroke="#b8a487"
          strokeWidth={0.014}
        />
        <rect
          x={-w * 0.25}
          y={-d * 0.2}
          width={w * 0.23}
          height={d * 0.38}
          rx={0.025}
          fill="#dedbc9"
          stroke="#b9b59f"
          strokeWidth={0.012}
        />
        <circle
          cx={w * 0.22}
          cy={d * 0.07}
          r={Math.min(w, d) * 0.1}
          fill="#78866a"
        />
      </g>
    );
  if (kind === 'chair')
    return (
      <g>
        {base}
        <path
          d={`M ${x + 0.025} ${z + d * 0.2} H ${w / 2 - 0.025}`}
          stroke={outline}
          strokeWidth={0.03}
        />
        <rect
          x={x + w * 0.1}
          y={z + d * 0.3}
          width={w * 0.8}
          height={d * 0.6}
          rx={0.06}
          fill="none"
          stroke={outline}
          strokeWidth={0.018}
        />
      </g>
    );
  if (kind === 'wardrobe')
    return (
      <g>
        {base}
        <path d={`M 0 ${z} V ${d / 2}`} stroke={outline} strokeWidth={0.018} />
        <path
          d={`M ${-w * 0.06} ${-d * 0.1} V ${d * 0.1} M ${w * 0.06} ${-d * 0.1} V ${d * 0.1}`}
          stroke={outline}
          strokeWidth={0.032}
        />
      </g>
    );
  if (kind === 'kitchen-counter')
    return (
      <g>
        {base}
        <path
          d={`M ${x + 0.055} ${z + 0.055} H ${w / 2 - 0.055} V ${d / 2 - 0.055} H ${x + 0.055} Z`}
          stroke="#c7c3b7"
          strokeWidth={0.014}
          fill="none"
        />
      </g>
    );
  if (kind === 'sink')
    return (
      <g>
        {base}
        <rect
          x={x + w * 0.16}
          y={z + d * 0.22}
          width={w * 0.68}
          height={d * 0.62}
          rx={Math.min(w, d) * 0.13}
          fill="#d6e0dd"
          stroke="#95aaa5"
          strokeWidth={0.022}
        />
        <circle cy={d * 0.09} r={Math.min(w, d) * 0.055} fill="#9aa7a0" />
        <path
          d={`M 0 ${z + d * 0.1} v ${d * 0.2}`}
          stroke="#818a80"
          strokeWidth={0.045}
        />
      </g>
    );
  if (kind === 'toilet')
    return (
      <g>
        <rect
          x={x + w * 0.06}
          y={z}
          width={w * 0.88}
          height={d * 0.28}
          rx={0.055}
          fill="#f8f8f1"
          stroke="#a6ada7"
          strokeWidth={0.024}
        />
        <ellipse
          cy={d * 0.12}
          rx={w * 0.42}
          ry={d * 0.37}
          fill="#f8f8f1"
          stroke="#a6ada7"
          strokeWidth={0.024}
        />
        <ellipse
          cy={d * 0.14}
          rx={w * 0.27}
          ry={d * 0.24}
          fill="#e2eae5"
          stroke="#b7c6bd"
          strokeWidth={0.016}
        />
      </g>
    );
  if (kind === 'shower')
    return (
      <g>
        {base}
        <rect
          x={x + 0.045}
          y={z + 0.045}
          width={Math.max(0.01, w - 0.09)}
          height={Math.max(0.01, d - 0.09)}
          fill="#e5efec"
          stroke="#a5c0b8"
          strokeWidth={0.018}
        />
        <path
          d={`M ${x + 0.045} ${z + 0.045} L ${w / 2 - 0.045} ${d / 2 - 0.045} M ${w / 2 - 0.045} ${z + 0.045} L ${x + 0.045} ${d / 2 - 0.045}`}
          stroke="#c3d6cf"
          strokeWidth={0.012}
        />
        <circle r={0.045} fill="#9aada2" />
      </g>
    );
  if (kind === 'tv')
    return (
      <g>
        {base}
        <rect
          x={x + 0.035}
          y={z + 0.025}
          width={Math.max(0.02, w - 0.07)}
          height={Math.max(0.02, d - 0.05)}
          fill="#4d5451"
          stroke="#363d38"
          strokeWidth={0.012}
        />
      </g>
    );
  return <g>{base}</g>;
}

function UtilitySymbol({ element }: { element: HomeElement }) {
  const electrical = ELECTRICAL_KINDS.includes(element.kind);
  const color = electrical ? '#c58a28' : '#4b9bab';
  return (
    <g>
      <circle
        r={0.15}
        fill={electrical ? '#fff4d7' : '#e2f4f7'}
        stroke={color}
        strokeWidth={0.028}
      />
      {element.kind === 'socket' ? (
        <g fill={color}>
          <circle cx={-0.045} cy={-0.025} r={0.022} />
          <circle cx={0.045} cy={-0.025} r={0.022} />
          <rect x={-0.017} y={0.025} width={0.034} height={0.043} rx={0.01} />
        </g>
      ) : element.kind === 'light' ? (
        <g stroke={color} strokeWidth={0.025}>
          <path d="M -.07 -.07 L .07 .07 M .07 -.07 L -.07 .07" />
        </g>
      ) : element.kind === 'water-port' ? (
        <path
          d="M 0 -.09 C -.02 -.06 -.075 0 -.065 .038 A .067 .067 0 0 0 .065 .038 C .075 0 .02 -.06 0 -.09"
          fill={color}
        />
      ) : (
        <path
          d="M .018 -.09 L -.06 .012 H .008 L -.022 .09 L .062 -.022 H -.004 Z"
          fill={color}
        />
      )}
    </g>
  );
}

function openingGapDepth(element: HomeElement, elements: HomeElement[]) {
  const wall = elements.find(
    (candidate) => candidate.id === element.wallAttachment?.wallId,
  );
  return wall
    ? Math.min(wall.dimensions.width, wall.dimensions.depth) + 0.06
    : element.dimensions.depth + 0.06;
}

function Measurement({
  x1,
  y1,
  x2,
  y2,
  label,
  vertical = false,
  color = '#7b8476',
  fontSize = 0.145,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  vertical?: boolean;
  color?: string;
  fontSize?: number;
}) {
  return (
    <g
      className="plan-measurement"
      stroke={color}
      strokeWidth={0.014}
      fill="none"
    >
      <path d={`M ${x1} ${y1} L ${x2} ${y2}`} />
      <path
        d={
          vertical
            ? `M ${x1 - 0.07} ${y1} h .14 M ${x2 - 0.07} ${y2} h .14`
            : `M ${x1} ${y1 - 0.07} v .14 M ${x2} ${y2 - 0.07} v .14`
        }
      />
      <text
        x={(x1 + x2) / 2}
        y={(y1 + y2) / 2 - fontSize * 0.55}
        textAnchor="middle"
        fill={color}
        stroke="#f8f8f3"
        strokeWidth={fontSize * 0.5}
        paintOrder="stroke"
        fontSize={fontSize}
        transform={
          vertical ? `rotate(-90 ${(x1 + x2) / 2} ${(y1 + y2) / 2})` : undefined
        }
      >
        {label}
      </text>
    </g>
  );
}

function TransformFrame({
  id,
  name,
  position,
  width,
  depth,
  rotation = 0,
  pixel,
  editable,
  room = false,
  metres,
  onResize,
  onRotate,
  onMove,
}: {
  id: string;
  name: string;
  position: PlanPoint;
  width: number;
  depth: number;
  rotation?: number;
  pixel: number;
  editable: boolean;
  room?: boolean;
  metres: (value: number) => string;
  onResize: (
    event: ReactPointerEvent<SVGElement>,
    handle: ResizeHandle,
  ) => void;
  onRotate?: (event: ReactPointerEvent<SVGElement>) => void;
  onMove?: (event: ReactPointerEvent<SVGElement>) => void;
}) {
  const color = '#2475d8';
  const gap = pixel * 27;
  const handles = RESIZE_HANDLES.filter(
    ({ handle }) =>
      room ||
      (width / pixel > 60 && depth / pixel > 42) ||
      (handle[0] && handle[1]),
  );
  return (
    <g
      className={`plan-transform-frame ${room ? 'plan-room-frame' : ''}`}
      data-transform-id={id}
      data-preview-width={width}
      data-preview-depth={depth}
      data-preview-rotation={rotation}
      transform={`translate(${position[0]} ${position[1]}) rotate(${-rotation})`}
      pointerEvents="none"
    >
      <rect
        x={-width / 2}
        y={-depth / 2}
        width={width}
        height={depth}
        fill={color}
        fillOpacity={room ? 0.035 : 0.055}
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeDasharray={room ? '6 3' : undefined}
      />
      <Measurement
        x1={-width / 2}
        y1={depth / 2 + gap}
        x2={width / 2}
        y2={depth / 2 + gap}
        label={metres(width)}
        color={color}
        fontSize={pixel * 11}
      />
      <Measurement
        x1={width / 2 + gap}
        y1={-depth / 2}
        x2={width / 2 + gap}
        y2={depth / 2}
        label={metres(depth)}
        color={color}
        fontSize={pixel * 11}
        vertical
      />
      {editable &&
        handles.map(({ handle, label, cursor }) => (
          <g
            key={label}
            className="plan-resize-handle"
            data-resize-handle={label}
            data-transform-owner={id}
            role="button"
            tabIndex={-1}
            aria-label={`Resize ${room ? 'room ' : ''}${name} ${label}`}
            style={{ cursor }}
            pointerEvents="all"
            transform={`translate(${(handle[0] * Math.max(width, pixel * 60)) / 2} ${(handle[1] * Math.max(depth, pixel * 60)) / 2})`}
            onPointerDown={(event) => onResize(event, handle)}
          >
            <path
              d={`M ${(handle[0] * (width - Math.max(width, pixel * 60))) / 2} ${(handle[1] * (depth - Math.max(depth, pixel * 60))) / 2} L 0 0`}
              stroke={color}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2 2"
              pointerEvents="none"
            />
            <title>Drag to resize {name}</title>
            <circle r={pixel * 17} fill="transparent" />
            {handle[0] && handle[1] ? (
              <rect
                x={-pixel * 5}
                y={-pixel * 5}
                width={pixel * 10}
                height={pixel * 10}
                rx={pixel * 1.5}
                fill="white"
                stroke={color}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <circle
                r={pixel * 4}
                fill="white"
                stroke={color}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        ))}
      {editable && onRotate && (
        <g className="plan-rotation-control">
          <path
            d={`M 0 ${-depth / 2} V ${-depth / 2 - pixel * 36}`}
            stroke={color}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <g
            role="button"
            tabIndex={-1}
            aria-label={`Rotate ${name}`}
            data-rotation-handle={id}
            pointerEvents="all"
            transform={`translate(0 ${-depth / 2 - pixel * 36})`}
            onPointerDown={onRotate}
          >
            <title>Drag to rotate · Shift snaps to 15°</title>
            <circle r={pixel * 19} fill="transparent" />
            <circle
              r={pixel * 9}
              fill="white"
              stroke={color}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={`M ${-pixel * 4} ${pixel} A ${pixel * 4} ${pixel * 4} 0 1 1 ${pixel * 3.2} ${pixel * 2.5} M ${-pixel * 4} ${pixel} l ${-pixel} ${-pixel * 3} M ${-pixel * 4} ${pixel} l ${pixel * 3} ${-pixel}`}
              fill="none"
              stroke={color}
              strokeWidth={1.1}
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <text
            y={-depth / 2 - pixel * 51}
            textAnchor="middle"
            fill={color}
            stroke="#f9fbfd"
            strokeWidth={pixel * 4}
            paintOrder="stroke"
            fontSize={pixel * 10}
          >
            {rotation.toFixed(0)}°
          </text>
        </g>
      )}
      {editable && room && onMove && (
        <g
          className="plan-room-move-handle"
          role="button"
          tabIndex={-1}
          aria-label={`Move room ${name}`}
          data-room-move={id}
          pointerEvents="all"
          onPointerDown={onMove}
        >
          <title>Drag to move room and contents</title>
          <circle r={pixel * 20} fill="transparent" />
          <rect
            x={-pixel * 13}
            y={-pixel * 13}
            width={pixel * 26}
            height={pixel * 26}
            rx={pixel * 5}
            fill="white"
            stroke={color}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`M ${-pixel * 7} 0 H ${pixel * 7} M 0 ${-pixel * 7} V ${pixel * 7} M ${-pixel * 7} 0 l ${pixel * 3} ${-pixel * 3} M ${-pixel * 7} 0 l ${pixel * 3} ${pixel * 3} M ${pixel * 7} 0 l ${-pixel * 3} ${-pixel * 3} M ${pixel * 7} 0 l ${-pixel * 3} ${pixel * 3} M 0 ${-pixel * 7} l ${-pixel * 3} ${pixel * 3} M 0 ${-pixel * 7} l ${pixel * 3} ${pixel * 3} M 0 ${pixel * 7} l ${-pixel * 3} ${-pixel * 3} M 0 ${pixel * 7} l ${pixel * 3} ${-pixel * 3}`}
            fill="none"
            stroke={color}
            strokeWidth={1.1}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </g>
  );
}

export default function PlanView({
  project: committedProject,
  selectedId,
  selectedIds,
  multiSelect = false,
  onSelect,
  onSelectMany,
  onUpdateElements,
  onUpdate,
  onSelectRoom,
  onUpdateRoom,
  onUpdateFloor,
  layers,
  tool,
  focusRoomId,
  cameraAction,
  units = 'm',
  snapToGrid = false,
}: PlanViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, PlanPoint>());
  const pinch = useRef<Pinch | null>(null);
  const previewRef = useRef<Preview>(null);
  const skipNextFit = useRef(false);
  const [preview, setPreview] = useState<Preview>(null);
  const [aspect, setAspect] = useState(1 / 0.78);
  const [viewportWidth, setViewportWidth] = useState(1000);
  const [dragging, setDragging] = useState(false);
  const [gestureHint, setGestureHint] = useState('');
  const [marquee, setMarquee] = useState<{
    start: PlanPoint;
    end: PlanPoint;
  } | null>(null);
  const committedFloor = getFloorPlan(committedProject);
  const floor = preview?.kind === 'floor' ? preview.floor : committedFloor;
  const bounds = floorBounds(floor);
  const cameraBounds = floorBounds(committedFloor);
  const floorPath = `M ${floor.outline.map((point) => point.join(' ')).join(' L ')} Z`;
  const winding =
    floor.outline.reduce((sum, point, index) => {
      const next = floor.outline[(index + 1) % floor.outline.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) >= 0
      ? 1
      : -1;
  const fittedCamera = useMemo(
    () => frameBounds(cameraBounds, aspect),
    [
      cameraBounds.minX,
      cameraBounds.maxX,
      cameraBounds.minZ,
      cameraBounds.maxZ,
      aspect,
    ],
  );
  const [camera, setCamera] = useState<Camera>(() => fittedCamera);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const pixel = camera.span / viewportWidth;
  const factor = units === 'ft' ? 3.28084 : 1;
  const metres = (value: number) => `${(value * factor).toFixed(2)} ${units}`;
  const project = useMemo(() => {
    if (!preview) return committedProject;
    if (preview.kind === 'group') {
      const updates = new Map(
        preview.updates.map((update) => [update.id, update.patch]),
      );
      return syncWallAttachments({
        ...committedProject,
        connections: preview.connections,
        elements: committedProject.elements.map((element) =>
          updates.has(element.id)
            ? { ...element, ...updates.get(element.id) }
            : element,
        ),
      });
    }
    return syncWallAttachments(
      preview.kind === 'floor'
        ? rebuildPerimeter({ ...committedProject, floorPlan: preview.floor })
        : preview.kind === 'room'
          ? updateRoom(committedProject, preview.id, preview.patch)
          : {
              ...committedProject,
              elements: committedProject.elements.map((element) =>
                element.id === preview.id
                  ? { ...element, ...preview.patch }
                  : element,
              ),
            },
    );
  }, [committedProject, preview]);
  const selection = new Set(selectedIds ?? (selectedId ? [selectedId] : []));
  const selectedElements = project.elements.filter(
    (element) => selection.has(element.id) && isElementVisible(element, layers),
  );
  const groupBounds =
    selectedElements.length > 1 ? selectionBounds(selectedElements) : null;
  const groupFrame =
    preview?.kind === 'group'
      ? preview.frame
      : groupBounds
        ? {
            center: groupBounds.center,
            width: groupBounds.width,
            depth: groupBounds.depth,
            rotation: 0,
          }
        : null;
  const selected = project.elements.find(
    (element) => element.id === selectedId,
  );
  const room = project.rooms.find((room) => room.id === focusRoomId);
  const selectedRoom = !selected && selectedId !== FLOOR_ID ? room : undefined;
  const editable = tool !== 'measure';

  const publishPreview = (next: Preview) => {
    previewRef.current = next;
    setPreview(next);
  };
  const release = (pointerId: number) => {
    if (svgRef.current?.hasPointerCapture(pointerId))
      svgRef.current.releasePointerCapture(pointerId);
  };
  const cancelGesture = () => {
    const previous = dragRef.current;
    dragRef.current = null;
    pinch.current = null;
    publishPreview(null);
    setMarquee(null);
    setDragging(false);
    setGestureHint('');
    if (previous) release(previous.pointerId);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const resize = () => {
      const { width, height } = svg.getBoundingClientRect();
      if (width && height) {
        setAspect(width / height);
        setViewportWidth(width);
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  // An edit never moves the camera. Only a changed outline/viewport or explicit camera command does.
  useEffect(() => {
    if (skipNextFit.current) skipNextFit.current = false;
    else setCamera(fittedCamera);
  }, [fittedCamera]);
  useEffect(() => {
    if (cameraAction.type === 'reset') setCamera(fittedCamera);
    else if (cameraAction.type === 'zoom-in')
      setCamera((previous) => ({
        ...previous,
        span: Math.max(1.2, previous.span * 0.8),
      }));
    else if (cameraAction.type === 'zoom-out')
      setCamera((previous) => ({
        ...previous,
        span: Math.min(
          Math.max(45, fittedCamera.span * 3),
          previous.span * 1.25,
        ),
      }));
    else if (groupBounds) setCamera(frameBounds(groupBounds, aspect));
    else if (selected)
      setCamera({
        x: selected.position[0],
        z: selected.position[2],
        span: Math.max(
          selected.dimensions.width * 2.4,
          selected.dimensions.depth * 3 * aspect,
          3,
        ),
      });
    else if (room)
      setCamera({
        x: room.center[0],
        z: room.center[1],
        span: Math.max(room.width + 2.4, (room.depth + 3.2) * aspect, 5),
      });
  }, [cameraAction.nonce, cameraAction.type]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (dragRef.current || pinch.current)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        pointers.current.clear();
        cancelGesture();
      }
    };
    const blur = () => {
      pointers.current.clear();
      cancelGesture();
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    if (dragRef.current) cancelGesture();
  }, [committedProject]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (dragRef.current) return;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      setCamera((previous) => {
        const span = clamp(
          previous.span * Math.exp(event.deltaY * 0.0015),
          1.2,
          Math.max(45, fittedCamera.span * 3),
        );
        const ratio = span / previous.span;
        return {
          span,
          x: point.x + (previous.x - point.x) * ratio,
          z: point.y + (previous.z - point.y) * ratio,
        };
      });
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [fittedCamera.span]);

  const clientToWorld = (point: PlanPoint): PlanPoint | null => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const transformed = new DOMPoint(...point).matrixTransform(
      matrix.inverse(),
    );
    return [transformed.x, transformed.y];
  };
  const getPoint = (event: ReactPointerEvent) =>
    clientToWorld([event.clientX, event.clientY]);
  const capture = (pointerId: number) =>
    svgRef.current?.setPointerCapture(pointerId);

  const trackPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== 'touch') return;
    pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointers.current.size < 2) return;
    event.preventDefault();
    event.stopPropagation();
    const pair = [...pointers.current.values()].slice(0, 2);
    const midpoint: PlanPoint = [
      (pair[0][0] + pair[1][0]) / 2,
      (pair[0][1] + pair[1][1]) / 2,
    ];
    const anchor = clientToWorld(midpoint);
    if (!anchor) return;
    dragRef.current = null;
    publishPreview(null);
    setMarquee(null);
    pinch.current = {
      distance: Math.max(
        1,
        Math.hypot(pair[1][0] - pair[0][0], pair[1][1] - pair[0][1]),
      ),
      midpoint,
      anchor,
      camera: cameraRef.current,
      scale: svgRef.current?.getScreenCTM()?.a || 1,
    };
    for (const id of pointers.current.keys()) capture(id);
    setDragging(true);
    setGestureHint('Pinch to zoom · Move both fingers to pan');
  };

  const beginGroup = (
    event: ReactPointerEvent<SVGElement>,
    action: 'move' | 'resize' | 'rotate' = 'move',
    handle: ResizeHandle = [0, 0],
  ) => {
    if (event.button !== 0 || pinch.current) return;
    event.preventDefault();
    event.stopPropagation();
    if (!editable || !onUpdateElements) return;
    if (selectedElements.some((element) => element.locked)) {
      setGestureHint('Unlock the selected elements before moving the group');
      return;
    }
    const point = getPoint(event);
    if (!point) return;
    capture(event.pointerId);
    dragRef.current = {
      kind: 'group',
      ids: selectedElements.map((element) => element.id),
      action,
      handle,
      pointerId: event.pointerId,
      start: point,
      clientStart: [event.clientX, event.clientY],
      moved: false,
    };
    setGestureHint(
      action === 'resize'
        ? 'Scale the selection proportionally · Escape cancels'
        : action === 'rotate'
          ? 'Rotate the selection · Shift snaps to 15°'
          : 'Move the selection together · Escape cancels',
    );
  };

  const beginMarquee = (event: ReactPointerEvent<SVGElement>) => {
    if (event.button !== 0 || pinch.current) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getPoint(event);
    if (!point) return;
    capture(event.pointerId);
    dragRef.current = {
      kind: 'marquee',
      pointerId: event.pointerId,
      start: point,
      end: point,
      clientStart: [event.clientX, event.clientY],
      moved: false,
      initialIds: event.shiftKey ? [...selection] : [],
    };
    setMarquee({ start: point, end: point });
    setGestureHint('Drag a box around elements to select them');
  };

  const beginElement = (
    event: ReactPointerEvent<SVGElement>,
    element: HomeElement,
    action: 'move' | 'resize' | 'rotate' = 'move',
    handle: ResizeHandle = [0, 0],
  ) => {
    if (event.button !== 0 || pinch.current) return;
    event.stopPropagation();
    if (action === 'move' && (event.shiftKey || multiSelect)) {
      event.preventDefault();
      onSelect(element.id, true);
      return;
    }
    if (
      selection.has(element.id) &&
      selectedElements.length > 1 &&
      onUpdateElements
    ) {
      beginGroup(event, action, handle);
      return;
    }
    onSelect(element.id);
    if (!editable || element.locked) return;
    event.preventDefault();
    const point = getPoint(event);
    if (!point) return;
    capture(event.pointerId);
    dragRef.current = {
      kind: 'element',
      element:
        committedProject.elements.find((item) => item.id === element.id) ??
        element,
      action,
      handle,
      pointerId: event.pointerId,
      start: point,
      clientStart: [event.clientX, event.clientY],
      moved: false,
    };
    setGestureHint(
      action === 'resize'
        ? 'Drag to resize · Opposite edge stays fixed'
        : action === 'rotate'
          ? 'Drag to rotate · Shift snaps to 15°'
          : 'Drag to move · Escape cancels',
    );
  };

  const beginRoom = (
    event: ReactPointerEvent<SVGElement>,
    candidate: Room,
    action: 'move' | 'resize' = 'move',
    handle: ResizeHandle = [0, 0],
  ) => {
    if (event.button !== 0 || pinch.current) return;
    event.stopPropagation();
    if (event.shiftKey || multiSelect) {
      beginMarquee(event);
      return;
    }
    onSelectRoom?.(candidate.id);
    if (!editable || !onUpdateRoom) return;
    event.preventDefault();
    const point = getPoint(event);
    if (!point) return;
    capture(event.pointerId);
    dragRef.current = {
      kind: 'room',
      room:
        committedProject.rooms.find((item) => item.id === candidate.id) ??
        candidate,
      action,
      handle,
      pointerId: event.pointerId,
      start: point,
      clientStart: [event.clientX, event.clientY],
      moved: false,
    };
    setGestureHint(
      action === 'resize'
        ? 'Resize the room · Its walls follow'
        : 'Move the room and its contents',
    );
  };

  const beginFloor = (
    event: ReactPointerEvent<SVGElement>,
    action: 'corner' | 'side',
    index: number,
  ) => {
    if (event.button !== 0 || !editable || !onUpdateFloor || pinch.current)
      return;
    event.preventDefault();
    event.stopPropagation();
    const point = getPoint(event);
    if (!point) return;
    const { minX, maxX, minZ, maxZ } = cameraBounds;
    const rectangle: PlanPoint[] = [
      [minX, minZ],
      [maxX, minZ],
      [maxX, maxZ],
      [minX, maxZ],
    ];
    const rectangular =
      committedFloor.outline.length === 4 &&
      rectangle.every((point, vertex) =>
        point.every(
          (value, axis) =>
            Math.abs(value - committedFloor.outline[vertex][axis]) < 0.0001,
        ),
      );
    capture(event.pointerId);
    dragRef.current = {
      kind: 'floor',
      action,
      floor: committedFloor,
      index,
      rectangular,
      pointerId: event.pointerId,
      start: point,
      clientStart: [event.clientX, event.clientY],
      moved: false,
    };
    setGestureHint(
      action === 'corner'
        ? 'Drag the floor corner · Rooms remain in place'
        : 'Drag to move this floor side',
    );
  };

  const beginPan = (
    event: ReactPointerEvent<SVGElement>,
    clearSelection = true,
  ) => {
    if (
      (event.button !== 0 && event.button !== 1 && event.button !== 2) ||
      pinch.current
    )
      return;
    if (event.button === 0 && (event.shiftKey || multiSelect)) {
      beginMarquee(event);
      return;
    }
    event.preventDefault();
    if (event.button === 0 && clearSelection) onSelect(null);
    capture(event.pointerId);
    dragRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      clientStart: [event.clientX, event.clientY],
      camera: cameraRef.current,
      scale: svgRef.current?.getScreenCTM()?.a || 1,
    };
    setDragging(true);
    setGestureHint('Drag to pan · Scroll or pinch to zoom');
  };

  const movePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(event.pointerId))
      pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
    if (pinch.current && pointers.current.size >= 2) {
      const pair = [...pointers.current.values()].slice(0, 2),
        initial = pinch.current;
      const midpoint: PlanPoint = [
        (pair[0][0] + pair[1][0]) / 2,
        (pair[0][1] + pair[1][1]) / 2,
      ];
      const distance = Math.max(
        1,
        Math.hypot(pair[1][0] - pair[0][0], pair[1][1] - pair[0][1]),
      );
      const span = clamp(
        (initial.camera.span * initial.distance) / distance,
        1.2,
        Math.max(45, fittedCamera.span * 3),
      );
      const ratio = span / initial.camera.span;
      setCamera({
        span,
        x:
          initial.anchor[0] +
          (initial.camera.x - initial.anchor[0]) * ratio -
          ((midpoint[0] - initial.midpoint[0]) / initial.scale) * ratio,
        z:
          initial.anchor[1] +
          (initial.camera.z - initial.anchor[1]) * ratio -
          ((midpoint[1] - initial.midpoint[1]) / initial.scale) * ratio,
      });
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === 'pan') {
      setCamera({
        ...drag.camera,
        x: drag.camera.x - (event.clientX - drag.clientStart[0]) / drag.scale,
        z: drag.camera.z - (event.clientY - drag.clientStart[1]) / drag.scale,
      });
      return;
    }
    if (
      !drag.moved &&
      Math.hypot(
        event.clientX - drag.clientStart[0],
        event.clientY - drag.clientStart[1],
      ) < (event.pointerType === 'touch' ? 5 : 3)
    )
      return;
    drag.moved = true;
    setDragging(true);
    const point = getPoint(event);
    if (!point) return;
    const delta: PlanPoint = [
      point[0] - drag.start[0],
      point[1] - drag.start[1],
    ];
    const snap = snapToGrid || event.shiftKey;
    if (drag.kind === 'marquee') {
      drag.end = point;
      setMarquee({ start: drag.start, end: point });
    } else if (drag.kind === 'group') {
      const transform =
        drag.action === 'rotate'
          ? { kind: 'rotate' as const, start: drag.start, current: point }
          : drag.action === 'resize'
            ? { kind: 'resize' as const, handle: drag.handle, delta }
            : { kind: 'move' as const, delta };
      const update = transformGroup(
        committedProject,
        drag.ids,
        transform,
        snap,
      );
      if (update) publishPreview({ kind: 'group', ...update });
      else setGestureHint('Selection kept within supported dimensions');
    } else if (drag.kind === 'element') {
      const patch =
        drag.action === 'resize'
          ? resizeElement(drag.element, drag.handle, delta, snap)
          : drag.action === 'rotate'
            ? rotateElement(drag.element, drag.start, point, snap)
            : moveElement(drag.element, delta, snap);
      publishPreview({ kind: 'element', id: drag.element.id, patch });
    } else if (drag.kind === 'floor') {
      const transformed = (ratio: number) =>
        (drag.action === 'corner' ? dragFloorCorner : dragFloorSide)(
          drag.floor,
          drag.index,
          [delta[0] * ratio, delta[1] * ratio],
          drag.rectangular,
          snap,
        );
      const valid = (candidate: FloorPlan) => {
        try {
          validateFloorPlan(candidate);
          return committedProject.rooms.every((room) =>
            roomFitsFloor(candidate, room),
          );
        } catch {
          return false;
        }
      };
      let next = transformed(1);
      if (!valid(next)) {
        let low = 0,
          high = 1;
        for (let i = 0; i < 14; i++) {
          const middle = (low + high) / 2;
          if (valid(transformed(middle))) low = middle;
          else high = middle;
        }
        next = transformed(low);
        setGestureHint('Keep the outline clear of existing rooms');
      }
      publishPreview({ kind: 'floor', floor: next });
    } else {
      const transformed = (ratio: number) =>
        drag.action === 'resize'
          ? resizeRoom(
              drag.room,
              drag.handle,
              [delta[0] * ratio, delta[1] * ratio],
              snap,
            )
          : moveRoom(drag.room, [delta[0] * ratio, delta[1] * ratio], snap);
      let patch = transformed(1);
      if (!roomFitsFloor(floor, { ...drag.room, ...patch })) {
        let low = 0,
          high = 1;
        for (let i = 0; i < 14; i++) {
          const mid = (low + high) / 2;
          if (roomFitsFloor(floor, { ...drag.room, ...transformed(mid) }))
            low = mid;
          else high = mid;
        }
        patch = transformed(low);
        setGestureHint('Room kept inside the floor outline');
      }
      publishPreview({ kind: 'room', id: drag.room.id, patch });
    }
  };

  const endPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (pinch.current) {
      release(event.pointerId);
      if (pointers.current.size < 2) {
        pinch.current = null;
        dragRef.current = null;
        setDragging(false);
        setGestureHint('');
      }
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const finalPreview = previewRef.current;
    dragRef.current = null;
    publishPreview(null);
    setMarquee(null);
    setDragging(false);
    setGestureHint('');
    release(event.pointerId);
    if (drag.kind === 'marquee') {
      const minX = Math.min(drag.start[0], drag.end[0]),
        maxX = Math.max(drag.start[0], drag.end[0]);
      const minZ = Math.min(drag.start[1], drag.end[1]),
        maxZ = Math.max(drag.start[1], drag.end[1]);
      const enclosed = drag.moved
        ? committedProject.elements
            .filter((element) => {
              if (!isElementVisible(element, layers)) return false;
              const bounds = selectionBounds([element])!;
              return (
                bounds.minX >= minX &&
                bounds.maxX <= maxX &&
                bounds.minZ >= minZ &&
                bounds.maxZ <= maxZ
              );
            })
            .map((element) => element.id)
        : [];
      const ids = [...new Set([...drag.initialIds, ...enclosed])];
      if (onSelectMany) onSelectMany(ids);
      else {
        onSelect(null);
        ids.forEach((id) => onSelect(id, true));
      }
      return;
    }
    if (drag.kind !== 'pan' && drag.moved && finalPreview) {
      if (finalPreview.kind === 'group')
        onUpdateElements?.(finalPreview.updates, finalPreview.connections);
      else if (finalPreview.kind === 'element')
        onUpdate(finalPreview.id, finalPreview.patch);
      else if (finalPreview.kind === 'room')
        onUpdateRoom?.(finalPreview.id, finalPreview.patch);
      else {
        skipNextFit.current = true;
        onUpdateFloor?.(finalPreview.floor);
      }
    }
  };
  const cancelPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    cancelGesture();
  };
  const visible = project.elements.filter((element) =>
    isElementVisible(element, layers),
  );
  const renderOrder = (element: HomeElement) =>
    element.kind === 'rug'
      ? -2
      : element.kind === 'wall'
        ? 1
        : ['door', 'window'].includes(element.kind)
          ? 2
          : 0;
  const ordered = [...visible].sort((a, b) => renderOrder(a) - renderOrder(b));
  const plumbing = project.elements.filter(
    (element) =>
      element.visible &&
      ['water-port', 'sink', 'toilet', 'shower'].includes(element.kind),
  );
  const connections = getConnections(project)
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
      points: connectionPoints(connection, project.elements),
    }))
    .filter((route) => route.points.length > 1);
  const selectFloor = (event: ReactPointerEvent<SVGElement>) => {
    event.stopPropagation();
    if (event.shiftKey || multiSelect) {
      beginMarquee(event);
      return;
    }
    onSelect(FLOOR_ID);
    beginPan(event, false);
  };

  return (
    <div
      className={`plan-view ${dragging ? 'plan-is-dragging' : ''} plan-tool-${tool} ${multiSelect ? 'plan-multiselect' : ''}`}
    >
      <svg
        ref={svgRef}
        className="plan-canvas"
        xmlns="http://www.w3.org/2000/svg"
        width="1200"
        height={Math.round(1200 / aspect)}
        fontFamily="Inter, Arial, sans-serif"
        role="img"
        aria-label="Interactive floor plan. Drag elements to move, use blue handles to resize or rotate. Shift-click or use multiple selection to select a group. Scroll or pinch to zoom."
        viewBox={`${camera.x - camera.span / 2} ${camera.z - camera.span / aspect / 2} ${camera.span} ${camera.span / aspect}`}
        onPointerDownCapture={trackPointerDown}
        onPointerDown={beginPan}
        onContextMenu={(event) => event.preventDefault()}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={cancelPointer}
        onLostPointerCapture={(event) => {
          if (dragRef.current?.pointerId === event.pointerId)
            cancelPointer(event);
        }}
      >
        <defs>
          <pattern
            id="plan-grid"
            width=".5"
            height=".5"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0" cy="0" r=".01" fill="#d3d7cc" />
          </pattern>
          <pattern
            id="plan-wood"
            width=".55"
            height="2"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0 0 V 2 M 0 .9 H .55"
              stroke="#c6bda9"
              strokeWidth=".008"
              fill="none"
              opacity=".3"
            />
          </pattern>
          <pattern
            id="plan-tile"
            width=".5"
            height=".5"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M .5 0 H 0 V .5"
              fill="none"
              stroke="#cad3c8"
              strokeWidth=".015"
            />
          </pattern>
          <pattern
            id="plan-rug"
            width=".065"
            height=".065"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L .065 .065" stroke="#e8e3d5" strokeWidth=".02" />
          </pattern>
          <filter id="plan-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx=".03"
              dy=".1"
              stdDeviation=".14"
              floodColor="#46513b"
              floodOpacity=".08"
            />
          </filter>
        </defs>
        <rect x="-200" y="-200" width="400" height="400" fill="#eaf1f5" />
        <rect
          x="-200"
          y="-200"
          width="400"
          height="400"
          fill="url(#plan-grid)"
        />
        <g
          className="plan-floor-outline"
          role="button"
          tabIndex={0}
          aria-label="Select overall floor outline"
          aria-pressed={selectedId === FLOOR_ID}
          onPointerDown={selectFloor}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(FLOOR_ID);
            }
          }}
        >
          <path
            d={floorPath}
            fill="#ffffff"
            stroke={selectedId === FLOOR_ID ? '#5e7d4d' : '#b8bead'}
            strokeWidth={selectedId === FLOOR_ID ? 0.06 : 0.035}
            filter="url(#plan-shadow)"
          />
          <path d={floorPath} fill="url(#plan-wood)" stroke="none" />
        </g>
        <g filter="url(#plan-shadow)" pointerEvents="none">
          {project.rooms.map((room) => (
            <rect
              key={room.id}
              x={room.center[0] - room.width / 2}
              y={room.center[1] - room.depth / 2}
              width={room.width}
              height={room.depth}
              fill={room.color}
            />
          ))}
        </g>
        {project.rooms.map((room) => (
          <g
            key={room.id}
            className="plan-room"
            role="button"
            tabIndex={0}
            aria-label={`Select room ${room.name}`}
            data-room-id={room.id}
            onPointerDown={(event) => beginRoom(event, room)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectRoom?.(room.id);
              }
            }}
          >
            <rect
              x={room.center[0] - room.width / 2}
              y={room.center[1] - room.depth / 2}
              width={room.width}
              height={room.depth}
              fill={
                /bath|kitchen|utility/i.test(room.name)
                  ? 'url(#plan-tile)'
                  : 'url(#plan-wood)'
              }
            />
            <rect
              x={room.center[0] - room.width / 2}
              y={room.center[1] - room.depth / 2}
              width={room.width}
              height={room.depth}
              fill={focusRoomId === room.id ? '#2475d8' : 'none'}
              fillOpacity={0.05}
              stroke="#c5c8bb"
              strokeWidth={0.018}
            />
          </g>
        ))}
        {ordered
          .filter(
            (element) =>
              !ELECTRICAL_KINDS.includes(element.kind) &&
              element.kind !== 'water-port',
          )
          .map((element) => (
            <g
              key={element.id}
              className={`plan-element ${editable && !element.locked ? 'plan-element-movable' : ''}`}
              data-element-id={element.id}
              transform={`translate(${element.position[0]} ${element.position[2]}) rotate(${-element.rotation})`}
              onPointerDown={(event) => beginElement(event, element)}
              tabIndex={0}
              role="button"
              aria-label={`${element.name}, ${metres(element.dimensions.width)} wide, ${metres(element.dimensions.depth)} deep, ${metres(element.dimensions.height)} high${element.locked ? ', locked' : ''}`}
              aria-pressed={selection.has(element.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(element.id, event.shiftKey || multiSelect);
                }
              }}
            >
              <title>
                {element.name} ·{' '}
                {(element.dimensions.width * factor).toFixed(2)} ×{' '}
                {(element.dimensions.depth * factor).toFixed(2)} ×{' '}
                {(element.dimensions.height * factor).toFixed(2)} {units}
              </title>
              {element.wallAttachment && !(element.apertureOnly && element.position[1]>0) &&
                ['door', 'window'].includes(element.kind) && (
                  <rect
                    x={-element.dimensions.width / 2}
                    y={-openingGapDepth(element, project.elements) / 2}
                    width={element.dimensions.width}
                    height={openingGapDepth(element, project.elements)}
                    fill="#faf8f1"
                    stroke="none"
                  />
                )}
              <FurnitureSymbol element={element} />
              <rect
                x={-element.dimensions.width / 2 - 0.04}
                y={-element.dimensions.depth / 2 - 0.04}
                width={element.dimensions.width + 0.08}
                height={element.dimensions.depth + 0.08}
                fill="transparent"
                stroke="none"
              />
            </g>
          ))}
        {layers.furniture && <SketchStairArrows elements={project.elements}/> }
        <g pointerEvents="none" fill="none">
          {connections.map(({ connection, points }) => (
            <g key={connection.id}>
              <polyline
                data-connection-id={connection.id}
                points={points
                  .map((point) => `${point[0]},${point[2]}`)
                  .join(' ')}
                stroke={
                  connection.system === 'electrical' ? '#d69d3d' : '#559dad'
                }
                strokeWidth={Math.max(
                  0.025,
                  Math.min(0.09, connection.size / 700),
                )}
                strokeDasharray={
                  connection.system === 'electrical' ? '.1 .06' : undefined
                }
                opacity={0.95}
              >
                <title>
                  {connection.name}
                  {connection.label ? ` · ${connection.label}` : ''} ·{' '}
                  {connection.size} mm
                </title>
              </polyline>
              {connection.label && layers.labels && (
                <text
                  x={points[Math.floor(points.length / 2)][0]}
                  y={points[Math.floor(points.length / 2)][2] - 0.12}
                  fontSize=".14"
                  fill={
                    connection.system === 'electrical' ? '#a4711a' : '#3b7f91'
                  }
                  stroke="#f8f8f3"
                  strokeWidth=".06"
                  paintOrder="stroke"
                  textAnchor="middle"
                >
                  {connection.label}
                </text>
              )}
            </g>
          ))}
        </g>
        {visible
          .filter(
            (element) =>
              ELECTRICAL_KINDS.includes(element.kind) ||
              element.kind === 'water-port',
          )
          .map((element) => (
            <g
              className="plan-element"
              data-element-id={element.id}
              key={element.id}
              transform={`translate(${element.position[0]} ${element.position[2]})`}
              onPointerDown={(event) => beginElement(event, element)}
              role="button"
              tabIndex={0}
              aria-label={element.name}
              aria-pressed={selection.has(element.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(element.id, event.shiftKey || multiSelect);
                }
              }}
            >
              <title>{element.name}</title>
              <UtilitySymbol element={element} />
            </g>
          ))}
        {layers.plumbing &&
          plumbing
            .filter((element) => element.kind !== 'water-port')
            .map((element) => (
              <circle
                key={`port-${element.id}`}
                cx={element.position[0]}
                cy={element.position[2]}
                r={0.065}
                fill="#e4f3f3"
                stroke="#579caa"
                strokeWidth={0.025}
                pointerEvents="none"
              />
            ))}
        {layers.labels &&
          project.rooms.map((room) => (
            <g
              key={`label-${room.id}`}
              className="plan-room-label"
              pointerEvents="none"
              textAnchor="middle"
              transform={`translate(${room.center[0]} ${room.center[1] + room.depth * 0.3})`}
            >
              <text
                y="0"
                fill="#636e5e"
                fontSize=".17"
                fontWeight="600"
                letterSpacing=".025"
                stroke={room.color}
                strokeWidth=".07"
                paintOrder="stroke"
              >
                {room.name.toUpperCase()}
              </text>
              <text
                y=".24"
                fill="#8a9381"
                fontSize=".13"
                stroke={room.color}
                strokeWidth=".07"
                paintOrder="stroke"
              >
                {metres(room.width)} × {metres(room.depth)}
              </text>
            </g>
          ))}
        <g
          className="plan-floor-dimensions"
          aria-label="Overall floor side dimensions"
        >
          {floor.outline.map((point, index) => {
            const next = floor.outline[(index + 1) % floor.outline.length];
            const dx = next[0] - point[0],
              dz = next[1] - point[1],
              length = Math.hypot(dx, dz);
            const nx = (winding * dz) / length,
              nz = (-winding * dx) / length;
            const x1 = point[0] + nx * 0.48,
              z1 = point[1] + nz * 0.48,
              x2 = next[0] + nx * 0.48,
              z2 = next[1] + nz * 0.48;
            const mx = (x1 + x2) / 2,
              mz = (z1 + z2) / 2;
            let angle = (Math.atan2(dz, dx) * 180) / Math.PI;
            if (angle > 90 || angle < -90) angle += 180;
            return (
              <g
                key={index}
                className="plan-floor-side"
                role="button"
                tabIndex={0}
                aria-label={`Floor side ${index + 1}: ${metres(length)}`}
                onPointerDown={selectFloor}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(FLOOR_ID);
                  }
                }}
              >
                <path
                  d={`M ${x1} ${z1} L ${x2} ${z2}`}
                  stroke="transparent"
                  strokeWidth={0.38}
                  fill="none"
                />
                <path
                  d={`M ${x1} ${z1} L ${x2} ${z2} M ${point[0] + nx * 0.16} ${point[1] + nz * 0.16} L ${point[0] + nx * 0.6} ${point[1] + nz * 0.6} M ${next[0] + nx * 0.16} ${next[1] + nz * 0.16} L ${next[0] + nx * 0.6} ${next[1] + nz * 0.6}`}
                  stroke="#87967a"
                  strokeWidth={0.014}
                  fill="none"
                />
                <text
                  x={mx}
                  y={mz - 0.08}
                  transform={`rotate(${angle} ${mx} ${mz})`}
                  textAnchor="middle"
                  fontSize={Math.max(0.14, pixel * 11)}
                  fontWeight="600"
                  fill="#5e7252"
                  stroke="#f4f5f0"
                  strokeWidth={0.08}
                  paintOrder="stroke"
                >
                  {metres(length)}
                </text>
              </g>
            );
          })}
        </g>
        {project.rooms.length === 0 &&
          !visible.some((element) => element.kind !== 'wall') && (
            <g pointerEvents="none" textAnchor="middle" fill="#7b876c">
              <text
                x={bounds.centerX}
                y={bounds.centerZ - 0.15}
                fontSize={0.22}
                fontWeight="600"
              >
                YOUR FLOOR
              </text>
              <text x={bounds.centerX} y={bounds.centerZ + 0.2} fontSize={0.17}>
                {(floorArea(floor) * factor * factor).toFixed(1)} {units}²
              </text>
            </g>
          )}
        {selectedId === FLOOR_ID && editable && onUpdateFloor && (
          <g className="plan-floor-handles" pointerEvents="all">
            {floor.outline.map((point, index) => {
              const next = floor.outline[(index + 1) % floor.outline.length];
              return (
                <g key={index}>
                  <g
                    data-floor-corner={index}
                    role="button"
                    tabIndex={-1}
                    aria-label={`Resize floor corner ${index + 1}`}
                    transform={`translate(${point[0]} ${point[1]})`}
                    onPointerDown={(event) =>
                      beginFloor(event, 'corner', index)
                    }
                  >
                    <circle r={pixel * 18} fill="transparent" />
                    <rect
                      x={-pixel * 5}
                      y={-pixel * 5}
                      width={pixel * 10}
                      height={pixel * 10}
                      rx={pixel * 1.5}
                      fill="white"
                      stroke="#2475d8"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                  <g
                    data-floor-edge={index}
                    role="button"
                    tabIndex={-1}
                    aria-label={`Resize floor side ${index + 1}`}
                    transform={`translate(${(point[0] + next[0]) / 2} ${(point[1] + next[1]) / 2})`}
                    onPointerDown={(event) => beginFloor(event, 'side', index)}
                  >
                    <circle r={pixel * 18} fill="transparent" />
                    <circle
                      r={pixel * 5}
                      fill="white"
                      stroke="#2475d8"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                </g>
              );
            })}
          </g>
        )}
        {selectedRoom && !groupFrame && (
          <TransformFrame
            id={selectedRoom.id}
            name={selectedRoom.name}
            position={selectedRoom.center}
            width={selectedRoom.width}
            depth={selectedRoom.depth}
            pixel={pixel}
            editable={editable && !!onUpdateRoom}
            room
            metres={metres}
            onResize={(event, handle) =>
              beginRoom(event, selectedRoom, 'resize', handle)
            }
            onMove={(event) => beginRoom(event, selectedRoom)}
          />
        )}
        {selected && !groupFrame && isElementVisible(selected, layers) && (
          <TransformFrame
            id={selected.id}
            name={selected.name}
            position={[selected.position[0], selected.position[2]]}
            width={selected.dimensions.width}
            depth={selected.dimensions.depth}
            rotation={selected.rotation}
            pixel={pixel}
            editable={editable && !selected.locked}
            metres={metres}
            onResize={(event, handle) =>
              beginElement(event, selected, 'resize', handle)
            }
            onRotate={(event) => beginElement(event, selected, 'rotate')}
          />
        )}
        {selectedElements.length > 1 &&
          selectedElements.map((element) => (
            <g
              key={`selected-${element.id}`}
              className="plan-group-member"
              data-selected-element={element.id}
              transform={`translate(${element.position[0]} ${element.position[2]}) rotate(${-element.rotation})`}
              pointerEvents="none"
            >
              <rect
                x={-element.dimensions.width / 2}
                y={-element.dimensions.depth / 2}
                width={element.dimensions.width}
                height={element.dimensions.depth}
                fill="#2475d8"
                fillOpacity={0.06}
                stroke="#2475d8"
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
                strokeDasharray="3 2"
              />
            </g>
          ))}
        {groupFrame && (
          <g
            className="plan-group-controls"
            data-selection-count={selectedElements.length}
          >
            <TransformFrame
              id="__selection__"
              name={`${selectedElements.length} selected elements`}
              position={groupFrame.center}
              width={groupFrame.width}
              depth={groupFrame.depth}
              rotation={groupFrame.rotation}
              pixel={pixel}
              editable={
                editable &&
                !!onUpdateElements &&
                !selectedElements.some((element) => element.locked)
              }
              metres={metres}
              onResize={(event, handle) => beginGroup(event, 'resize', handle)}
              onRotate={(event) => beginGroup(event, 'rotate')}
            />
            {editable && onUpdateElements && (
              <g
                className="plan-group-move-handle"
                data-group-move
                role="button"
                tabIndex={-1}
                aria-label={`Move ${selectedElements.length} selected elements`}
                transform={`translate(${groupFrame.center[0]} ${groupFrame.center[1]})`}
                onPointerDown={(event) => beginGroup(event)}
              >
                <title>Drag to move the selected elements together</title>
                <rect
                  x={-pixel * 24}
                  y={-pixel * 20}
                  width={pixel * 48}
                  height={pixel * 40}
                  rx={pixel * 8}
                  fill="white"
                  fillOpacity={0.94}
                  stroke="#2475d8"
                  strokeWidth={1.2}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#2475d8"
                  fontSize={pixel * 16}
                >
                  ✥
                </text>
              </g>
            )}
          </g>
        )}
        {marquee && (
          <rect
            className="plan-selection-marquee"
            x={Math.min(marquee.start[0], marquee.end[0])}
            y={Math.min(marquee.start[1], marquee.end[1])}
            width={Math.abs(marquee.end[0] - marquee.start[0])}
            height={Math.abs(marquee.end[1] - marquee.start[1])}
            fill="#2475d8"
            fillOpacity={0.12}
            stroke="#2475d8"
            strokeWidth={1.3}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="5 3"
            pointerEvents="none"
          />
        )}
      </svg>
      {gestureHint && (
        <div className="plan-gesture-hint" role="status">
          {gestureHint}
        </div>
      )}
    </div>
  );
}
