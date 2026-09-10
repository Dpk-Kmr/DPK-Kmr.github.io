import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Check,
  ChevronDown,
  CornerDownRight,
  Grid2X2,
  Plus,
  Ruler,
  Trash2,
} from 'lucide-react';
import type { FloorPlan, Project } from '../types';
import {
  floorArea,
  floorBounds,
  getFloorPlan,
  validateFloorPlan,
} from '../lib/floor';
import { NumberField } from './Fields';
import { dragFloorCorner, dragFloorSide } from '../lib/floorEditing';
import './FloorEditor.css';

export const DEFAULT_FLOOR: FloorPlan = {
  outline: [
    [-6, -5],
    [6, -5],
    [6, 5],
    [-6, 5],
  ],
  wallHeight: 2.7,
  wallThickness: 0.15,
};
const letter = (index: number) =>
  index < 26 ? String.fromCharCode(65 + index) : `P${index + 1}`;
const round = (value: number) => Number(value.toFixed(8));
function rectangle(
  width: number,
  depth: number,
  x = 0,
  z = 0,
): FloorPlan['outline'] {
  return [
    [x - width / 2, z - depth / 2],
    [x + width / 2, z - depth / 2],
    [x + width / 2, z + depth / 2],
    [x - width / 2, z + depth / 2],
  ];
}

export default function FloorEditor({
  floor,
  units,
  onChange,
}: {
  floor: FloorPlan;
  units: 'm' | 'ft';
  onChange: (floor: FloorPlan) => void;
}) {
  const [shape, setShape] = useState<'rectangle' | 'l' | 'custom'>(() => {
    const { width, depth, centerX, centerZ } = floorBounds(floor);
    const corners = rectangle(width, depth, centerX, centerZ);
    const isRectangle =
      floor.outline.length === 4 &&
      floor.outline.every((point, index) =>
        point.every(
          (value, axis) => Math.abs(value - corners[index][axis]) < 0.00001,
        ),
      );
    return isRectangle ? 'rectangle' : 'custom';
  });
  const [verticesOpen, setVerticesOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<{
    pointerId: number;
    kind: 'corner' | 'side';
    index: number;
    start: [number, number];
    floor: FloorPlan;
    rectangular: boolean;
  } | null>(null);
  const [gestureBounds, setGestureBounds] = useState<ReturnType<
    typeof floorBounds
  > | null>(null);
  const [snap, setSnap] = useState(false);
  const factor = units === 'ft' ? 3.28084 : 1;
  const bounds = gestureBounds ?? floorBounds(floor);
  const span = Math.max(bounds.width, bounds.depth, 1);
  const margin = span * 0.15;
  const fontSize = span * 0.065;
  const changeOutline = (outline: FloorPlan['outline']) =>
    onChange({ ...floor, outline });
  const localPoint = (
    event: ReactPointerEvent<SVGElement>,
  ): [number, number] | null => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    return [point.x, point.y];
  };
  const startGesture = (
    event: ReactPointerEvent<SVGElement>,
    kind: 'corner' | 'side',
    index: number,
  ) => {
    if (event.button !== 0 || gesture.current) return;
    const start = localPoint(event);
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    svgRef.current?.setPointerCapture(event.pointerId);
    gesture.current = {
      pointerId: event.pointerId,
      kind,
      index,
      start,
      floor,
      rectangular: shape === 'rectangle',
    };
    setGestureBounds(floorBounds(floor));
  };
  const endGesture = (cancel = false) => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    if (cancel) onChange(active.floor);
    if (svgRef.current?.hasPointerCapture(active.pointerId))
      svgRef.current.releasePointerCapture(active.pointerId);
    setGestureBounds(null);
  };
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        endGesture(true);
      }
    };
    window.addEventListener('keydown', cancel, true);
    return () => window.removeEventListener('keydown', cancel, true);
  });
  const setShapeOutline = (next: typeof shape) => {
    setShape(next);
    const { width: w, depth: d, centerX: x, centerZ: z } = bounds;
    if (next === 'rectangle') changeOutline(rectangle(w, d, x, z));
    if (next === 'l')
      changeOutline([
        [x - w / 2, z - d / 2],
        [x + w / 2, z - d / 2],
        [x + w / 2, z + d * 0.1],
        [x + w * 0.1, z + d * 0.1],
        [x + w * 0.1, z + d / 2],
        [x - w / 2, z + d / 2],
      ]);
  };
  const changeSide = (index: number, length: number) => {
    if (shape === 'rectangle' && floor.outline.length === 4) {
      changeOutline(
        rectangle(
          index % 2 === 0 ? length : bounds.width,
          index % 2 === 1 ? length : bounds.depth,
          bounds.centerX,
          bounds.centerZ,
        ),
      );
      return;
    }
    const outline = floor.outline.map(
      (point) => [...point] as [number, number],
    );
    const from = outline[index],
      nextIndex = (index + 1) % outline.length,
      to = outline[nextIndex];
    const current = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    outline[nextIndex] = [
      round(from[0] + ((to[0] - from[0]) * length) / current),
      round(from[1] + ((to[1] - from[1]) * length) / current),
    ];
    setShape('custom');
    changeOutline(outline);
  };
  let error = '';
  try {
    validateFloorPlan(floor);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Check the floor outline.';
  }
  return (
    <div className="floor-editor">
      <div className="floor-shapes">
        {(
          [
            { key: 'rectangle', name: 'Rectangle', icon: Grid2X2 },
            { key: 'l', name: 'L-shaped', icon: CornerDownRight },
            { key: 'custom', name: 'Custom', icon: Ruler },
          ] as const
        ).map(({ key, name, icon: Icon }) => (
          <button
            type="button"
            key={key}
            className={shape === key ? 'active' : ''}
            onClick={() => setShapeOutline(key)}
          >
            <Icon size={14} />
            {name}
          </button>
        ))}
      </div>
      <div className="floor-preview">
        <svg
          ref={svgRef}
          role="group"
          aria-label="Floor outline with every side length"
          viewBox={`${bounds.minX - margin} ${bounds.minZ - margin} ${bounds.width + margin * 2} ${bounds.depth + margin * 2}`}
          onPointerMove={(event) => {
            const active = gesture.current;
            if (!active || active.pointerId !== event.pointerId) return;
            const point = localPoint(event);
            if (!point) return;
            event.preventDefault();
            const delta: [number, number] = [
              point[0] - active.start[0],
              point[1] - active.start[1],
            ];
            onChange(
              (active.kind === 'corner' ? dragFloorCorner : dragFloorSide)(
                active.floor,
                active.index,
                delta,
                active.rectangular,
                snap,
              ),
            );
          }}
          onPointerUp={(event) => {
            if (gesture.current?.pointerId === event.pointerId) endGesture();
          }}
          onPointerCancel={() => endGesture(true)}
          onLostPointerCapture={() => {
            if (gesture.current) endGesture(true);
          }}
        >
          <defs>
            <pattern
              id="floor-preview-grid"
              width={span / 12}
              height={span / 12}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${span / 12} 0 H 0 V ${span / 12}`}
                fill="none"
                stroke="#d1dbc5"
                strokeWidth={span * 0.001}
              />
            </pattern>
          </defs>
          <polygon
            points={floor.outline.map((point) => point.join(',')).join(' ')}
            fill="#e4edf5"
            stroke="#517a98"
            strokeWidth={span * 0.009}
          />
          <polygon
            points={floor.outline.map((point) => point.join(',')).join(' ')}
            fill="url(#floor-preview-grid)"
          />
          {floor.outline.map((from, index) => {
            const to = floor.outline[(index + 1) % floor.outline.length],
              length = Math.hypot(to[0] - from[0], to[1] - from[1]);
            const x = (from[0] + to[0]) / 2,
              z = (from[1] + to[1]) / 2;
            return (
              <g key={index}>
                <g
                  className="floor-drag-side"
                  role="button"
                  tabIndex={0}
                  aria-label={`Drag side ${letter(index)}–${letter((index + 1) % floor.outline.length)}`}
                  onPointerDown={(event) => startGesture(event, 'side', index)}
                >
                  <title>Drag this edge to resize the floor</title>
                  <circle cx={x} cy={z} r={span * 0.055} fill="transparent" />
                  <rect
                    x={x - span * 0.018}
                    y={z - span * 0.018}
                    width={span * 0.036}
                    height={span * 0.036}
                    rx={span * 0.005}
                    fill="#fff"
                    stroke="#287eb9"
                    strokeWidth={span * 0.009}
                  />
                </g>
                <g
                  className="floor-drag-corner"
                  role="button"
                  tabIndex={0}
                  aria-label={`Drag corner ${letter(index)}`}
                  onPointerDown={(event) =>
                    startGesture(event, 'corner', index)
                  }
                >
                  <title>Drag this corner to change the outline</title>
                  <circle
                    cx={from[0]}
                    cy={from[1]}
                    r={span * 0.055}
                    fill="transparent"
                  />
                  <circle
                    cx={from[0]}
                    cy={from[1]}
                    r={span * 0.023}
                    fill="#fff"
                    stroke="#287eb9"
                    strokeWidth={span * 0.012}
                  />
                </g>
                <text
                  x={from[0] + span * 0.025}
                  y={from[1] - span * 0.025}
                  fontSize={fontSize}
                  fill="#56713f"
                >
                  {letter(index)}
                </text>
                <text
                  x={x}
                  y={z - fontSize * 0.5}
                  fontSize={fontSize}
                  textAnchor="middle"
                  fill="#425b32"
                  stroke="#f5f7ee"
                  strokeWidth={fontSize * 0.35}
                  paintOrder="stroke"
                >
                  {(length * factor).toFixed(2)} {units}
                </text>
              </g>
            );
          })}
        </svg>
        <span className="floor-area-label">
          {(floorArea(floor) * factor * factor).toFixed(1)} {units}²{' '}
          <small>TOTAL FOOTPRINT</small>
        </span>
      </div>
      <div className="floor-gesture-hint">
        <span>Drag a corner or side handle to resize.</span>
        <label>
          <input
            type="checkbox"
            checked={snap}
            onChange={(event) => setSnap(event.target.checked)}
          />
          10 cm snap
        </label>
      </div>
      <div className="section-title">
        <h3>Length of every side</h3>
        <span>{floor.outline.length} SIDES</span>
      </div>
      <div className="floor-sides">
        {floor.outline.map((from, index) => {
          const to = floor.outline[(index + 1) % floor.outline.length];
          return (
            <div className="floor-side" key={index}>
              <NumberField
                label={`Side ${letter(index)}–${letter((index + 1) % floor.outline.length)}`}
                value={Math.hypot(to[0] - from[0], to[1] - from[1]) * factor}
                unit={units}
                min={0.1 * factor}
                max={100 * factor}
                onChange={(value) => changeSide(index, value / factor)}
              />
              {shape === 'custom' && floor.outline.length < 32 && (
                <button
                  type="button"
                  title={`Split side ${letter(index)}`}
                  aria-label={`Split side ${letter(index)}`}
                  onClick={() => {
                    const outline = [...floor.outline];
                    outline.splice(index + 1, 0, [
                      (from[0] + to[0]) / 2,
                      (from[1] + to[1]) / 2,
                    ]);
                    changeOutline(outline);
                  }}
                >
                  <Plus size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="floor-hint">
        {shape === 'rectangle'
          ? 'Opposite sides stay equal. Switch to Custom to edit corners independently.'
          : 'A side edit moves its end corner. Adjoining side lengths update to keep the outline closed.'}
      </p>
      <button
        type="button"
        className="floor-corners-toggle"
        onClick={() => setVerticesOpen(!verticesOpen)}
      >
        Edit corner coordinates
        <ChevronDown size={13} className={verticesOpen ? 'rotated' : ''} />
      </button>
      {verticesOpen && (
        <div className="floor-corners">
          {floor.outline.map((point, index) => (
            <div className="floor-corner" key={index}>
              <span>{letter(index)}</span>
              {([0, 1] as const).map((axis) => (
                <NumberField
                  key={axis}
                  label={`Corner ${letter(index)} ${axis === 0 ? 'X' : 'Z'}`}
                  value={point[axis] * factor}
                  unit={units}
                  min={-100 * factor}
                  max={100 * factor}
                  onChange={(value) => {
                    const outline = floor.outline.map(
                      (p) => [...p] as [number, number],
                    );
                    outline[index][axis] = round(value / factor);
                    setShape('custom');
                    changeOutline(outline);
                  }}
                />
              ))}
              <button
                type="button"
                disabled={floor.outline.length <= 3}
                aria-label={`Remove corner ${letter(index)}`}
                onClick={() => {
                  setShape('custom');
                  changeOutline(floor.outline.filter((_, i) => i !== index));
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="floor-wall-fields">
        <NumberField
          label="Wall height"
          value={floor.wallHeight * factor}
          unit={units}
          min={0.5 * factor}
          max={10 * factor}
          onChange={(value) =>
            onChange({ ...floor, wallHeight: round(value / factor) })
          }
        />
        <NumberField
          label="Wall thickness"
          value={floor.wallThickness * factor}
          unit={units}
          min={0.05 * factor}
          max={1 * factor}
          onChange={(value) =>
            onChange({ ...floor, wallThickness: round(value / factor) })
          }
        />
      </div>
      {error && (
        <p role="alert" className="floor-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function FloorInspector({
  project,
  units,
  onApply,
  onAddRoom,
}: {
  project: Project;
  units: 'm' | 'ft';
  onApply: (
    floor: FloorPlan,
    mode: 'keep' | 'scale',
    rebuild: boolean,
  ) => boolean;
  onAddRoom: () => void;
}) {
  const floor = getFloorPlan(project);
  const [draft, setDraft] = useState(floor);
  const [mode, setMode] = useState<'keep' | 'scale'>('keep');
  const [rebuild, setRebuild] = useState(true);
  const [saved, setSaved] = useState(false);
  const signature = JSON.stringify(floor);
  useEffect(() => {
    setDraft(floor);
    setSaved(false);
  }, [signature]);
  const changeDraft = (next: FloorPlan) => {
    setDraft(next);
    setSaved(false);
  };
  return (
    <div className="floor-inspector">
      <span className="eyebrow">START WITH THE BIG PICTURE</span>
      <h2>Total floor plan</h2>
      <p>
        Define the boundary first. Add and edit rooms, stairs, openings, and
        connections inside it.
      </p>
      <FloorEditor
        key={signature}
        floor={draft}
        units={units}
        onChange={changeDraft}
      />
      <label className="studio-select-label">
        When the outline changes
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as 'keep' | 'scale')}
        >
          <option value="keep">Keep existing sizes & positions</option>
          <option value="scale">Scale the layout to the new outline</option>
        </select>
      </label>
      <label className="floor-check">
        <input
          type="checkbox"
          checked={rebuild}
          onChange={(event) => setRebuild(event.target.checked)}
        />
        Update generated perimeter walls
      </label>
      <button
        className="button button-primary"
        onClick={() => {
          if (onApply(draft, mode, rebuild)) setSaved(true);
        }}
      >
        <Check size={14} />
        {saved ? 'Floor plan updated' : 'Apply floor changes'}
      </button>
      <button className="button button-outline" onClick={onAddRoom}>
        <Plus size={14} />
        Add a room inside this floor
      </button>
    </div>
  );
}
