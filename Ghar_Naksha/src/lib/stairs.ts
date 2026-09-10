import type {
  CatalogItem,
  HomeElement,
  StairConfig,
  StairStyle,
} from '../types';

export type StairPoint = [number, number];
export type StairPoint3 = [number, number, number];
export interface StairTread {
  polygon: StairPoint[];
  top: number;
  thickness: number;
  landing: boolean;
}
export interface StairRail {
  points: StairPoint3[];
  bases: number[];
}
export interface StairGeometry {
  treads: StairTread[];
  risers: StairTread[];
  rails: StairRail[];
  stringers: StairPoint3[][];
  path: StairPoint[];
  going: number;
  effectiveWidth: number;
  conflicts: string[];
  poleRadius: number;
}
const clamp = (value: number, min: number, max: number, fallback: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
export const STAIR_STYLES: { value: StairStyle; label: string }[] = [
  { value: 'straight', label: 'Straight flight' },
  { value: 'l-shaped', label: 'Quarter turn · L' },
  { value: 'u-shaped', label: 'Half turn · U' },
  { value: 'spiral', label: 'Spiral stair' },
  { value: 'floating', label: 'Floating treads' },
];
export function defaultStairs(style: StairStyle = 'straight'): StairConfig {
  return {
    style,
    steps: 16,
    flightWidth: 0.95,
    landingDepth: 1,
    turnDirection: 'right',
    railing: 'both',
    railingHeight: 0.9,
    treadThickness: 0.05,
    nosing: 0.025,
    risers: style === 'floating' || style === 'spiral' ? 'open' : 'closed',
    stringer:
      style === 'floating' ? 'central' : style === 'spiral' ? 'none' : 'solid',
    spiralTurns: 1,
    innerRadius: 0.18,
  };
}
export function sanitizeStairs(input: Partial<StairConfig> = {}): StairConfig {
  const d = defaultStairs(
    STAIR_STYLES.some((s) => s.value === input.style)
      ? input.style
      : 'straight',
  );
  return {
    style: d.style,
    steps: Math.round(clamp(input.steps ?? d.steps, 3, 64, d.steps)),
    flightWidth: clamp(
      input.flightWidth ?? d.flightWidth,
      0.4,
      4,
      d.flightWidth,
    ),
    landingDepth: clamp(
      input.landingDepth ?? d.landingDepth,
      0.4,
      6,
      d.landingDepth,
    ),
    turnDirection: input.turnDirection === 'left' ? 'left' : 'right',
    railing: ['none', 'left', 'right', 'both'].includes(input.railing ?? '')
      ? input.railing!
      : d.railing,
    railingHeight: clamp(
      input.railingHeight ?? d.railingHeight,
      0.3,
      1.5,
      d.railingHeight,
    ),
    treadThickness: clamp(
      input.treadThickness ?? d.treadThickness,
      0.02,
      0.25,
      d.treadThickness,
    ),
    nosing: clamp(input.nosing ?? d.nosing, 0, 0.1, d.nosing),
    risers:
      input.risers === 'open' || input.risers === 'closed'
        ? input.risers
        : d.risers,
    stringer: ['solid', 'central', 'none'].includes(input.stringer ?? '')
      ? input.stringer!
      : d.stringer,
    spiralTurns: clamp(
      input.spiralTurns ?? d.spiralTurns,
      0.5,
      3,
      d.spiralTurns,
    ),
    innerRadius: clamp(
      input.innerRadius ?? d.innerRadius,
      0.06,
      2,
      d.innerRadius,
    ),
  };
}
export const STAIR_CATALOG: CatalogItem[] = STAIR_STYLES.map(
  ({ value, label }) => ({
    kind: 'stairs',
    name: label,
    category: 'Stairs',
    dimensions: {
      width:
        value === 'l-shaped'
          ? 3.35
          : value === 'u-shaped'
            ? 2.1
            : value === 'spiral'
              ? 2.3
              : 0.95,
      height: 2.8,
      depth:
        value === 'l-shaped' || value === 'u-shaped'
          ? 3.35
          : value === 'spiral'
            ? 2.3
            : 4.48,
    },
    color: value === 'floating' ? '#ad875e' : '#bfa17a',
    material: 'wood',
    stairs: defaultStairs(value),
  }),
);

export function suggestStepCount(height: number, targetRiser = 0.175): number {
  return Math.round(
    clamp(height / clamp(targetRiser, 0.1, 0.3, 0.175), 3, 64, 16),
  );
}
export function fitStairFootprint(
  element: HomeElement,
  targetGoing = 0.28,
): HomeElement['dimensions'] {
  const s = sanitizeStairs(element.stairs);
  const going = clamp(targetGoing, 0.15, 0.5, 0.28);
  const landing = Math.max(s.flightWidth, s.landingDepth);
  let width = s.flightWidth;
  let depth = s.steps * going;
  if (s.style === 'l-shaped') {
    width = Math.ceil(s.steps / 2) * going + landing;
    depth = Math.floor(s.steps / 2) * going + landing;
  }
  if (s.style === 'u-shaped') {
    width = s.flightWidth * 2 + 0.15;
    depth = Math.ceil(s.steps / 2) * going + landing;
  }
  if (s.style === 'spiral') {
    width = depth = (s.innerRadius + s.flightWidth) * 2;
  }
  return {
    width: Math.round(width * 1000) / 1000,
    height: element.dimensions.height,
    depth: Math.round(depth * 1000) / 1000,
  };
}

export function buildStairGeometry(element: HomeElement): StairGeometry {
  const s = sanitizeStairs(element.stairs);
  const w = Math.max(0.1, element.dimensions.width);
  const d = Math.max(0.1, element.dimensions.depth);
  const h = Math.max(0.1, element.dimensions.height);
  const rise = h / s.steps;
  const result: StairGeometry = {
    treads: [],
    risers: [],
    rails: [],
    stringers: [],
    path: [],
    going: 0,
    effectiveWidth: s.flightWidth,
    conflicts: [],
    poleRadius: 0,
  };
  const mirror = s.turnDirection === 'left' ? -1 : 1;
  const thickness = Math.min(s.treadThickness, rise * 0.9);
  if (s.treadThickness >= rise)
    result.conflicts.push(
      'Tread thickness reaches the riser height; visible treads are limited to 90% of the rise.',
    );
  const addFlight = (
    start: StairPoint,
    direction: StairPoint,
    count: number,
    run: number,
    startStep: number,
    fw: number,
  ) => {
    const going = Math.max(0.000001, run / count);
    result.going = result.going ? Math.min(result.going, going) : going;
    const normal: StairPoint = [direction[1], -direction[0]];
    const point = (along: number, across: number): StairPoint => [
      start[0] + direction[0] * along + normal[0] * across,
      start[1] + direction[1] * along + normal[1] * across,
    ];
    const centers: StairPoint3[] = [];
    for (let i = 0; i < count; i++) {
      const low = Math.max(0, i * going - s.nosing);
      const high = (i + 1) * going;
      const y = (startStep + i + 1) * rise;
      result.treads.push({
        polygon: [
          point(low, -fw / 2),
          point(high, -fw / 2),
          point(high, fw / 2),
          point(low, fw / 2),
        ],
        top: y,
        thickness,
        landing: false,
      });
      if (s.risers === 'closed')
        result.risers.push({
          polygon: [
            point(i * going, -fw / 2),
            point(Math.min(high, i * going + 0.025), -fw / 2),
            point(Math.min(high, i * going + 0.025), fw / 2),
            point(i * going, fw / 2),
          ],
          top: y - thickness,
          thickness: rise - thickness,
          landing: false,
        });
      const p = point((i + 0.5) * going, 0);
      centers.push([p[0], y, p[1]]);
    }
    result.path.push(point(going * 0.25, 0), point(run - going * 0.15, 0));
    const railMirror =
      s.style === 'l-shaped' || s.style === 'u-shaped' ? mirror : 1;
    const railSides =
      s.railing === 'both'
        ? [-1, 1]
        : s.railing === 'left'
          ? [railMirror]
          : s.railing === 'right'
            ? [-railMirror]
            : [];
    railSides.forEach((side) => {
      const pts = centers.map(
        (p) =>
          [
            p[0] + normal[0] * side * (fw / 2 - 0.028),
            p[1] + s.railingHeight,
            p[2] + normal[1] * side * (fw / 2 - 0.028),
          ] as StairPoint3,
      );
      result.rails.push({ points: pts, bases: centers.map((p) => p[1]) });
    });
    const supports =
      s.stringer === 'solid'
        ? [-0.42, 0.42]
        : s.stringer === 'central'
          ? [0]
          : [];
    supports.forEach((offset) => {
      const bottom = point(going * 0.35, offset * fw);
      const top = point(run - going * 0.35, offset * fw);
      result.stringers.push([
        [bottom[0], Math.max(0.055, startStep * rise), bottom[1]],
        [top[0], (startStep + count) * rise - thickness - 0.035, top[1]],
      ]);
    });
  };
  const addLanding = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    top: number,
  ) => {
    result.treads.push({
      polygon: [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ],
      top,
      thickness: Math.max(thickness, 0.075),
      landing: true,
    });
  };
  if (s.style === 'spiral') {
    const maxRadius = Math.min(w, d) / 2;
    const inner = Math.min(s.innerRadius, maxRadius * 0.55);
    const fw = Math.max(0.02, Math.min(s.flightWidth, maxRadius - inner));
    const outer = inner + fw;
    result.effectiveWidth = fw;
    result.poleRadius = Math.max(0.025, inner * 0.22);
    if (s.innerRadius + s.flightWidth > maxRadius + 0.001)
      result.conflicts.push(
        'Inner radius and flight width exceed the footprint; fit the footprint or reduce their values.',
      );
    const sign = s.turnDirection === 'right' ? -1 : 1;
    const angle = (Math.PI * 2 * s.spiralTurns) / s.steps;
    result.going = angle * (inner + (fw * 2) / 3);
    const innerRail: StairRail = { points: [], bases: [] };
    const outerRail: StairRail = { points: [], bases: [] };
    for (let i = 0; i < s.steps; i++) {
      const a0 = Math.PI / 2 + sign * i * angle;
      const a1 = a0 + sign * angle;
      const segments = Math.max(3, Math.ceil(angle * 10));
      const polygon: StairPoint[] = [];
      const noseAngle = Math.min(
        s.nosing / Math.max(inner, 0.06),
        angle * 0.15,
      );
      for (let j = 0; j <= segments; j++) {
        const a =
          a0 - sign * noseAngle + ((a1 - a0 + sign * noseAngle) * j) / segments;
        polygon.push([Math.cos(a) * outer, Math.sin(a) * outer]);
      }
      for (let j = segments; j >= 0; j--) {
        const a =
          a0 - sign * noseAngle + ((a1 - a0 + sign * noseAngle) * j) / segments;
        polygon.push([Math.cos(a) * inner, Math.sin(a) * inner]);
      }
      const y = (i + 1) * rise;
      result.treads.push({ polygon, top: y, thickness, landing: false });
      if (s.risers === 'closed') {
        const edge = a0 + sign * Math.min(0.02 / outer, angle * 0.15);
        result.risers.push({
          polygon: [
            [Math.cos(a0) * inner, Math.sin(a0) * inner],
            [Math.cos(a0) * outer, Math.sin(a0) * outer],
            [Math.cos(edge) * outer, Math.sin(edge) * outer],
            [Math.cos(edge) * inner, Math.sin(edge) * inner],
          ],
          top: y - thickness,
          thickness: rise - thickness,
          landing: false,
        });
      }
      const a = (a0 + a1) / 2;
      result.path.push([
        Math.cos(a) * (inner + fw * 0.55),
        Math.sin(a) * (inner + fw * 0.55),
      ]);
      [innerRail, outerRail].forEach((rail, index) => {
        const radius = index ? outer - 0.026 : inner + 0.026;
        rail.points.push([
          Math.cos(a) * radius,
          y + s.railingHeight,
          Math.sin(a) * radius,
        ]);
        rail.bases.push(y);
      });
    }
    if (s.railing === 'both' || s.railing === 'left')
      result.rails.push(s.turnDirection === 'right' ? outerRail : innerRail);
    if (s.railing === 'both' || s.railing === 'right')
      result.rails.push(s.turnDirection === 'right' ? innerRail : outerRail);
    if (s.stringer !== 'none') {
      const radii =
        s.stringer === 'central'
          ? [inner + fw / 2]
          : [inner + fw * 0.12, outer - fw * 0.12];
      radii.forEach((radius) =>
        result.stringers.push(
          result.path.map((_, i) => {
            const a = Math.PI / 2 + sign * (i + 0.5) * angle;
            return [
              Math.cos(a) * radius,
              Math.max(0.04, (i + 1) * rise - thickness - 0.05),
              Math.sin(a) * radius,
            ];
          }),
        ),
      );
    }
  } else if (s.style === 'l-shaped' || s.style === 'u-shaped') {
    const isU = s.style === 'u-shaped';
    const fw = Math.min(s.flightWidth, isU ? w / 2 : w, d * 0.7);
    const landing = Math.min(
      Math.max(fw, s.landingDepth),
      d * 0.8,
      isU ? d : w * 0.8,
    );
    result.effectiveWidth = fw;
    if (fw + 0.001 < s.flightWidth)
      result.conflicts.push(
        'Requested flight width does not fit this turning footprint.',
      );
    if (landing + 0.001 < s.landingDepth || landing + 0.001 < fw)
      result.conflicts.push('Landing is constrained by the footprint.');
    const n1 = Math.floor(s.steps / 2),
      n2 = s.steps - n1;
    addFlight([-w / 2 + fw / 2, d / 2], [0, -1], n1, d - landing, 0, fw);
    if (isU) {
      addLanding(-w / 2, w / 2, -d / 2, -d / 2 + landing, n1 * rise);
      result.path.push([w / 2 - fw / 2, -d / 2 + landing / 2]);
      addFlight(
        [w / 2 - fw / 2, -d / 2 + landing],
        [0, 1],
        n2,
        d - landing,
        n1,
        fw,
      );
    } else {
      addLanding(-w / 2, -w / 2 + landing, -d / 2, -d / 2 + landing, n1 * rise);
      result.path.push([-w / 2 + landing / 2, -d / 2 + fw / 2]);
      addFlight(
        [-w / 2 + landing, -d / 2 + fw / 2],
        [1, 0],
        n2,
        w - landing,
        n1,
        fw,
      );
    }
    if (s.railing !== 'none') {
      const y = n1 * rise;
      const points: StairPoint3[] = isU
        ? [
            [-w / 2 + 0.028, y + s.railingHeight, -d / 2 + landing],
            [-w / 2 + 0.028, y + s.railingHeight, -d / 2 + 0.028],
            [w / 2 - 0.028, y + s.railingHeight, -d / 2 + 0.028],
            [w / 2 - 0.028, y + s.railingHeight, -d / 2 + landing],
          ]
        : [
            [-w / 2 + 0.028, y + s.railingHeight, -d / 2 + landing],
            [-w / 2 + 0.028, y + s.railingHeight, -d / 2 + 0.028],
            [-w / 2 + landing, y + s.railingHeight, -d / 2 + 0.028],
          ];
      result.rails.push({ points, bases: points.map(() => y) });
    }
    if (mirror < 0) {
      result.treads.forEach((t) => t.polygon.forEach((p) => (p[0] *= -1)));
      result.risers.forEach((t) => t.polygon.forEach((p) => (p[0] *= -1)));
      result.rails.forEach((r) => r.points.forEach((p) => (p[0] *= -1)));
      result.stringers.forEach((line) => line.forEach((p) => (p[0] *= -1)));
      result.path.forEach((p) => (p[0] *= -1));
    }
  } else {
    const fw = Math.min(s.flightWidth, w);
    result.effectiveWidth = fw;
    if (s.flightWidth > w + 0.001)
      result.conflicts.push(
        'Flight width exceeds the footprint width; fit the footprint or reduce flight width.',
      );
    addFlight([0, d / 2], [0, -1], s.steps, d, 0, fw);
  }
  if (result.going < 0.18)
    result.conflicts.push(
      'Available going is under 0.18 m; increase the run or use fewer steps.',
    );
  if (rise > 0.22)
    result.conflicts.push(
      'Risers exceed 0.22 m in this design; consider more steps.',
    );
  if (rise < 0.12)
    result.conflicts.push('Risers are below 0.12 m; consider fewer steps.');
  if (s.style === 'spiral' && h / s.spiralTurns < 2)
    result.conflicts.push(
      'Rise per revolution is under 2 m; the spiral may overlap usable headroom.',
    );
  return result;
}
export function stairStats(element: HomeElement) {
  const s = sanitizeStairs(element.stairs);
  const geometry = buildStairGeometry(element);
  const riserHeight = element.dimensions.height / s.steps;
  return {
    steps: s.steps,
    riserHeight,
    going: geometry.going,
    pitch: (Math.atan2(riserHeight, geometry.going) * 180) / Math.PI,
    effectiveWidth: geometry.effectiveWidth,
    risePerTurn: element.dimensions.height / s.spiralTurns,
    conflicts: geometry.conflicts,
  };
}
