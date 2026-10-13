import type { FloorPlan, HomeElement, Project } from '../types';
import { containsPoint, floorBounds, getFloorPlan } from './floor';
import { getWallSegments } from './openings';
import { buildStairGeometry } from './stairs';
import type { StairTread } from './stairs';

export type WalkCamera = 'first' | 'follow' | 'front';
export interface WalkthroughSettings {
  height: number;
  camera: WalkCamera;
}
export interface WalkLevel {
  id: string;
  name: string;
  elevation: number;
  floorPlan: FloorPlan;
}
export type Point2 = [number, number];
export type Point3 = [number, number, number];
type LeveledElement = HomeElement & {
  levelId?: string;
  connectsToLevelId?: string;
};
type BuildingProject = Project & {
  levels?: WalkLevel[];
  activeLevelId?: string;
};
export interface WalkSupport {
  y: number;
  levelId: string;
  stairId?: string;
}
export interface WalkPosition extends WalkSupport {
  x: number;
  z: number;
}
export interface WalkStair {
  element: LeveledElement;
  elevation: number;
  levelId: string;
  treads: StairTread[];
  footprint: Point2[];
}
export interface WalkWorld {
  levels: WalkLevel[];
  stairs: WalkStair[];
  walls: {
    element: HomeElement;
    elevation: number;
    segments: ReturnType<typeof getWallSegments>;
  }[];
  furniture: { element: HomeElement; elevation: number }[];
  seats: { element: HomeElement; elevation: number; levelId: string }[];
  holes: Record<string, Point2[][]>;
}
export const DEFAULT_WALK_SETTINGS: WalkthroughSettings = {
  height: 1.75,
  camera: 'follow',
};
export const personHeight = (height: number) =>
  Math.max(0.6, Math.min(2.5, Number.isFinite(height) ? height : 1.75));
export const standingEyeHeight = (height: number) =>
  personHeight(height) * 0.94;
export const seatedEyeHeight = (height: number) => personHeight(height) * 0.44;
export function buildingLevels(project: Project): WalkLevel[] {
  const building = project as BuildingProject;
  return building.levels?.length
    ? building.levels
    : [
        {
          id: building.activeLevelId ?? 'ground-floor',
          name: 'Ground floor',
          elevation: 0,
          floorPlan: getFloorPlan(project),
        },
      ];
}
export function elementLevelId(element: HomeElement, levels: WalkLevel[]) {
  return (element as LeveledElement).levelId ?? levels[0].id;
}
export function localPoint(element: HomeElement, x: number, z: number): Point2 {
  const a = (element.rotation * Math.PI) / 180,
    dx = x - element.position[0],
    dz = z - element.position[2];
  return [
    dx * Math.cos(a) - dz * Math.sin(a),
    dx * Math.sin(a) + dz * Math.cos(a),
  ];
}
export function worldPoint(element: HomeElement, [x, z]: Point2): Point2 {
  const a = (element.rotation * Math.PI) / 180;
  return [
    element.position[0] + x * Math.cos(a) + z * Math.sin(a),
    element.position[2] - x * Math.sin(a) + z * Math.cos(a),
  ];
}
export function pointInPolygon(points: Point2[], [x, z]: Point2): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j],
      b = points[i];
    const cross = (x - a[0]) * (b[1] - a[1]) - (z - a[1]) * (b[0] - a[0]);
    if (
      Math.abs(cross) < 0.000001 &&
      x >= Math.min(a[0], b[0]) - 1e-7 &&
      x <= Math.max(a[0], b[0]) + 1e-7 &&
      z >= Math.min(a[1], b[1]) - 1e-7 &&
      z <= Math.max(a[1], b[1]) + 1e-7
    )
      return true;
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function convexHull(points: Point2[]): Point2[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (a: Point2, b: Point2, c: Point2) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const lower: Point2[] = [],
    upper: Point2[] = [];
  for (const point of sorted) {
    while (
      lower.length > 1 &&
      turn(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    )
      lower.pop();
    lower.push(point);
  }
  for (const point of [...sorted].reverse()) {
    while (
      upper.length > 1 &&
      turn(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    )
      upper.pop();
    upper.push(point);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
export function makeWalkWorld(project: Project): WalkWorld {
  const levels = buildingLevels(project);
  const elevation = (element: HomeElement) =>
    levels.find((level) => level.id === elementLevelId(element, levels))
      ?.elevation ?? 0;
  const visible = project.elements.filter((element) => element.visible);
  const stairs = visible
    .filter((element) => element.kind === 'stairs')
    .map((element) => {
      const { width: w, depth: d } = element.dimensions;
      const treads = buildStairGeometry(element).treads;
      const footprint =
        element.stairs?.style === 'spiral'
          ? convexHull(treads.flatMap((tread) => tread.polygon))
          : ([
              [-w / 2, -d / 2],
              [w / 2, -d / 2],
              [w / 2, d / 2],
              [-w / 2, d / 2],
            ] as Point2[]);
      return {
        element,
        elevation: elevation(element),
        levelId: elementLevelId(element, levels),
        treads,
        footprint: footprint.map((point) => worldPoint(element, point)),
      };
    });
  // The measured house uses exact editable cuboids rather than a refitted stair asset.
  const measured=visible.filter(e=>/^stair-(low|high)-[0-9]+$/.test(e.id)||e.id==='stair-landing'||e.id==='upper-arrival');
  if(measured.length && measured.some(e=>e.id==='stair-low-1')) {
    const minX=Math.min(...measured.map(e=>e.position[0]-e.dimensions.width/2));
    const maxX=Math.max(...measured.map(e=>e.position[0]+e.dimensions.width/2));
    const minZ=Math.min(...measured.map(e=>e.position[2]-e.dimensions.depth/2));
    const maxZ=Math.max(...measured.map(e=>e.position[2]+e.dimensions.depth/2));
    const origin:Point3=[(minX+maxX)/2,0,(minZ+maxZ)/2];
    const element:LeveledElement={...measured[0],id:'measured-stair',kind:'stairs',position:origin,rotation:0,dimensions:{width:maxX-minX,depth:maxZ-minZ,height:Math.max(...measured.map(e=>e.position[1]+e.dimensions.height))}};
    const treads=measured.map(e=>{
      const x=e.position[0]-origin[0],z=e.position[2]-origin[2],w=e.dimensions.width/2,d=e.dimensions.depth/2;
      return {polygon:[[x-w,z-d],[x+w,z-d],[x+w,z+d],[x-w,z+d]] as Point2[],top:e.position[1]+e.dimensions.height,thickness:e.id==='stair-landing'||e.id==='upper-arrival'?e.dimensions.height:e.dimensions.height,landing:e.id==='stair-landing'||e.id==='upper-arrival'};
    });
    stairs.push({element,elevation:elevation(element),levelId:elementLevelId(element,levels),treads,footprint:[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]]});
  }
  const holes: WalkWorld['holes'] = {};
  levels.forEach((level) => {
    holes[level.id] = stairs
      .filter((stair) => {
        const target = (stair.element as LeveledElement).connectsToLevelId;
        return target === level.id && level.elevation > stair.elevation + 0.1;
      })
      .map((stair) => stair.footprint);
  });
  return {
    levels,
    stairs,
    holes,
    walls: visible
      .filter((element) => element.kind === 'wall')
      .map((element) => ({
        element,
        elevation: elevation(element),
        segments: getWallSegments(element, visible),
      })),
    furniture: visible
      .filter((element) =>
        [
          'sofa',
          'armchair',
          'chair',
          'bed',
          'wardrobe',
          'kitchen-counter',
          'sink',
          'toilet',
          'shower',
          'coffee-table',
          'dining-table',
          'nightstand',
          'block',
          'temple',
        ].includes(element.kind),
      )
      .filter(element=>!/^stair-(low|high)-[0-9]+$/.test(element.id)&&element.id!=='stair-landing'&&element.id!=='upper-arrival')
      .map((element) => ({ element, elevation: elevation(element) })),
    seats: visible
      .filter((element) => ['sofa', 'armchair', 'chair'].includes(element.kind))
      .map((element) => ({
        element,
        elevation: elevation(element),
        levelId: elementLevelId(element, levels),
      })),
  };
}
export function onLevelSurface(
  world: WalkWorld,
  level: WalkLevel,
  x: number,
  z: number,
  radius = 0,
): boolean {
  return (
    [
      [x, z],
      [x - radius, z],
      [x + radius, z],
      [x, z - radius],
      [x, z + radius],
    ].every(([px, pz]) => containsPoint(level.floorPlan, [px, pz])) &&
    !(world.holes[level.id] ?? []).some((hole) => pointInPolygon(hole, [x, z]))
  );
}
/** Treads are the same polygons used by the visible stair model. No ramp or floor teleport is used. */
export function supportAt(
  world: WalkWorld,
  x: number,
  z: number,
  currentY: number,
  maxStep = 0.34,
): WalkSupport | null {
  const candidates: WalkSupport[] = [];
  for (const level of world.levels) {
    if (
      Math.abs(level.elevation - currentY) <= maxStep + 0.0001 &&
      onLevelSurface(world, level, x, z, 0.14)
    )
      candidates.push({ y: level.elevation, levelId: level.id });
  }
  for (const stair of world.stairs) {
    const point = localPoint(stair.element, x, z);
    for (const tread of stair.treads) {
      const y = stair.elevation + stair.element.position[1] + tread.top;
      if (
        y > currentY + maxStep + 0.0001 ||
        y < currentY - maxStep - 0.0001 ||
        !pointInPolygon(tread.polygon, point)
      )
        continue;
      const target = world.levels.find(
        (level) => level.id === stair.element.connectsToLevelId,
      );
      candidates.push({
        y,
        levelId:
          target && Math.abs(target.elevation - y) < 0.03
            ? target.id
            : stair.levelId,
        stairId: stair.element.id,
      });
    }
  }
  // Prefer the highest reachable tread; this handles the small overlap created by nosing.
  return candidates.sort((a, b) => b.y - a.y)[0] ?? null;
}
function overlapsBox(
  element: HomeElement,
  x: number,
  z: number,
  radius: number,
  offset: Point3 = [0, 0, 0],
  dimensions = element.dimensions,
) {
  const point = localPoint(element, x, z);
  return (
    Math.abs(point[0] - offset[0]) < dimensions.width / 2 + radius &&
    Math.abs(point[1] - offset[2]) < dimensions.depth / 2 + radius
  );
}
export function bodyBlocked(
  world: WalkWorld,
  x: number,
  y: number,
  z: number,
  height: number,
  ignoredElementId?: string,
): boolean {
  const radius = Math.min(0.2, personHeight(height) * 0.09);
  const top = y + personHeight(height);
  if (
    world.walls.some(({ element, elevation, segments }) =>
      segments.some((segment) => {
        const bottom =
          elevation +
          element.position[1] +
          segment.position[1] -
          segment.dimensions.height / 2;
        const segmentTop = bottom + segment.dimensions.height;
        return (
          bottom < top - 0.015 &&
          segmentTop > y + 0.1 &&
          overlapsBox(
            element,
            x,
            z,
            radius,
            segment.position,
            segment.dimensions,
          )
        );
      }),
    )
  )
    return true;
  if (
    world.furniture.some(
      ({ element, elevation }) =>
        element.id !== ignoredElementId &&
        elevation + element.position[1] < top &&
        elevation + element.position[1] + element.dimensions.height >
          y + 0.15 &&
        overlapsBox(element, x, z, radius),
    )
  )
    return true;
  if (
    world.stairs.some((stair) => {
      const point = localPoint(stair.element, x, z);

      return stair.treads.some((tread) => {
        const bottom =
          stair.elevation +
          stair.element.position[1] +
          tread.top -
          tread.thickness;
        return (
          bottom > y + 0.07 &&
          bottom < top - 0.02 &&
          pointInPolygon(tread.polygon, point)
        );
      });
    })
  )
    return true;
  return world.levels.some(
    (level) =>
      level.elevation - 0.08 > y + 0.08 &&
      level.elevation - 0.08 < top &&
      onLevelSurface(world, level, x, z),
  );
}
export function moveWalker(
  world: WalkWorld,
  position: WalkPosition,
  dx: number,
  dz: number,
  height: number,
): WalkPosition {
  let next = { ...position };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.065));
  const attempt = (x: number, z: number) => {
    const support = supportAt(world, x, z, next.y);
    if (support && !bodyBlocked(world, x, support.y, z, height)) {
      next = { ...support, x, z };
      return true;
    }
    return false;
  };
  for (let i = 0; i < steps; i++) {
    if (!attempt(next.x + dx / steps, next.z + dz / steps)) {
      attempt(next.x + dx / steps, next.z);
      attempt(next.x, next.z + dz / steps);
    }
  }
  return next;
}
export function spawnWalker(
  world: WalkWorld,
  levelId: string,
  height: number,
  preferred?: Point2,
): WalkPosition {
  const level =
    world.levels.find((item) => item.id === levelId) ?? world.levels[0];
  const bounds = floorBounds(level.floorPlan);
  const candidates: Point2[] = preferred ? [preferred] : [];
  candidates.push([bounds.centerX, bounds.centerZ]);
  for (let iz = 1; iz < 24; iz++)
    for (let ix = 1; ix < 24; ix++)
      candidates.push([
        bounds.minX + (bounds.width * ix) / 24,
        bounds.minZ + (bounds.depth * iz) / 24,
      ]);
  const point = candidates.find(
    ([x, z]) =>
      onLevelSurface(world, level, x, z, 0.16) &&
      !bodyBlocked(world, x, level.elevation, z, height),
  ) ??
    candidates.find(([x, z]) => onLevelSurface(world, level, x, z)) ?? [
      bounds.centerX,
      bounds.centerZ,
    ];
  return { x: point[0], z: point[1], y: level.elevation, levelId: level.id };
}
export interface SeatPose {
  elementId: string;
  name: string;
  x: number;
  z: number;
  seatY: number;
  yaw: number;
  levelId: string;
}
export function seatPose(seat: WalkWorld['seats'][number]): SeatPose {
  const { element, elevation, levelId } = seat;
  const [x, z] = worldPoint(element, [0, element.dimensions.depth * 0.08]);
  return {
    elementId: element.id,
    name: element.name,
    x,
    z,
    seatY:
      elevation +
      element.position[1] +
      element.dimensions.height * (element.kind === 'chair' ? 0.59 : 0.6),
    yaw: (element.rotation * Math.PI) / 180 + Math.PI,
    levelId,
  };
}
export function nearbySeat(
  world: WalkWorld,
  position: WalkPosition,
): SeatPose | null {
  const candidates = world.seats
    .filter(
      (seat) =>
        Math.abs(seat.elevation + seat.element.position[1] - position.y) < 0.45,
    )
    .map((seat) => {
      const pose = seatPose(seat),
        [x, z] = localPoint(seat.element, position.x, position.z);
      const distance = Math.hypot(
        Math.max(0, Math.abs(x) - seat.element.dimensions.width / 2),
        Math.max(0, Math.abs(z) - seat.element.dimensions.depth / 2),
      );
      return { pose, distance };
    })
    .filter((candidate) => candidate.distance < 1.05)
    .sort((a, b) => a.distance - b.distance);
  return candidates[0]?.pose ?? null;
}
export function standingFromSeat(
  world: WalkWorld,
  seat: SeatPose,
  height: number,
): WalkPosition | null {
  const object = world.seats.find((item) => item.element.id === seat.elementId);
  if (!object) return spawnWalker(world, seat.levelId, height);
  const { element } = object;
  const d = element.dimensions.depth / 2 + 0.3,
    w = element.dimensions.width / 2 + 0.3;
  const points: Point2[] = [
    [0, d],
    [w, 0],
    [-w, 0],
    [0, -d],
    [w, d],
    [-w, d],
  ];
  for (const point of points) {
    const [x, z] = worldPoint(element, point);
    const y = object.elevation + element.position[1];
    const support = supportAt(world, x, z, y);
    if (support && !bodyBlocked(world, x, support.y, z, height))
      return { ...support, x, z };
  }
  return null;
}
/** Keep the orbiting person camera in front of walls and floor slabs. */
export function cameraObstructionFraction(
  world: WalkWorld,
  start: Point3,
  end: Point3,
): number {
  let closest = 1;
  for (const { element, elevation, segments } of world.walls) {
    const a = localPoint(element, start[0], start[2]),
      b = localPoint(element, end[0], end[2]);
    const origin = [a[0], start[1] - elevation - element.position[1], a[1]];
    const target = [b[0], end[1] - elevation - element.position[1], b[1]];
    for (const segment of segments) {
      const sizes = [
        segment.dimensions.width,
        segment.dimensions.height,
        segment.dimensions.depth,
      ];
      let enter = 0,
        leave = 1;
      for (let axis = 0; axis < 3; axis++) {
        const low = segment.position[axis] - sizes[axis] / 2 - 0.06,
          high = segment.position[axis] + sizes[axis] / 2 + 0.06;
        const delta = target[axis] - origin[axis];
        if (Math.abs(delta) < 1e-9) {
          if (origin[axis] < low || origin[axis] > high) {
            enter = 2;
            break;
          }
        } else {
          const t0 = (low - origin[axis]) / delta,
            t1 = (high - origin[axis]) / delta;
          enter = Math.max(enter, Math.min(t0, t1));
          leave = Math.min(leave, Math.max(t0, t1));
        }
      }
      if (enter <= leave && enter >= 0)
        closest = Math.min(closest, Math.max(0.04, enter - 0.015));
    }
  }
  if (Math.abs(end[1] - start[1]) > 1e-8)
    for (const level of world.levels) {
      const t = (level.elevation - 0.06 - start[1]) / (end[1] - start[1]);
      if (
        t > 0 &&
        t < closest &&
        onLevelSurface(
          world,
          level,
          start[0] + (end[0] - start[0]) * t,
          start[2] + (end[2] - start[2]) * t,
        )
      )
        closest = Math.max(0.04, t - 0.02);
    }
  return closest;
}
