import { createId } from './id';
import { FLOOR_ID } from '../types';
import type { FloorPlan, HomeElement, Project } from '../types';
import {
  floorBounds,
  getFloorPlan,
  containsPoint,
  roomFitsFloor,
} from './floor';

export function perimeterWalls(
  floor: FloorPlan,
  previous: HomeElement[] = [],
): HomeElement[] {
  return floor.outline.map((from, index) => {
    const to = floor.outline[(index + 1) % floor.outline.length];
    const existing = previous.find((element) => element.floorEdge === index);
    return {
      id: existing?.id ?? createId(),
      kind: 'wall',
      roomId: FLOOR_ID,
      name: `Perimeter wall ${index + 1}`,
      position: [(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2],
      rotation: (-Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI,
      dimensions: {
        width: Math.hypot(to[0] - from[0], to[1] - from[1]),
        height: floor.wallHeight,
        depth: floor.wallThickness,
      },
      color: existing?.color ?? '#edeae1',
      material: existing?.material ?? 'plaster',
      visible: existing?.visible ?? true,
      locked: existing?.locked ?? false,
      floorEdge: index,
    };
  });
}

export function makeFloorProject(
  name: string,
  floor: FloorPlan,
  withWalls = true,
): Project {
  return {
    version: 1,
    name: name.trim() || 'My new home',
    floorPlan: structuredClone(floor),
    rooms: [],
    elements: withWalls ? perimeterWalls(floor) : [],
    connections: [],
  };
}

export function rebuildPerimeter(project: Project): Project {
  const old = project.elements.filter(
    (element) => element.floorEdge !== undefined,
  );
  return {
    ...project,
    elements: [
      ...project.elements.filter((element) => element.floorEdge === undefined),
      ...perimeterWalls(getFloorPlan(project), old),
    ],
  };
}

export function floorContainer(project: Project) {
  const floor = getFloorPlan(project),
    bounds = floorBounds(floor);
  return {
    id: FLOOR_ID,
    name: 'Total floor plan',
    subtitle: 'The full home footprint',
    center: [bounds.centerX, bounds.centerZ] as [number, number],
    width: bounds.width,
    depth: bounds.depth,
    color: '#e5dccb',
  };
}

export function fitElementToSpace(
  project: Project,
  element: HomeElement,
): HomeElement {
  const floor = getFloorPlan(project),
    room = project.rooms.find((room) => room.id === element.roomId),
    container = room ?? floorContainer(project);
  const angle = (element.rotation * Math.PI) / 180,
    cos = Math.abs(Math.cos(angle)),
    sin = Math.abs(Math.sin(angle));
  const { width, height, depth } = element.dimensions;
  const extentX = width * cos + depth * sin,
    extentZ = width * sin + depth * cos;
  const ratio = Math.min(
    1,
    (container.width - 0.2) / Math.max(0.01, extentX),
    (container.depth - 0.2) / Math.max(0.01, extentZ),
  );
  const next = {
    ...element,
    dimensions: {
      width: Math.max(0.02, width * ratio),
      height,
      depth: Math.max(0.02, depth * ratio),
    },
    position: [
      container.center[0],
      element.position[1],
      container.center[1],
    ] as HomeElement['position'],
  };
  if (!room) {
    const bounds = floorBounds(floor);
    const footprint = {
      ...container,
      width: extentX * ratio + 0.1,
      depth: extentZ * ratio + 0.1,
    };
    if (!roomFitsFloor(floor, footprint)) {
      for (let z = bounds.minZ; z <= bounds.maxZ; z += 0.25)
        for (let x = bounds.minX; x <= bounds.maxX; x += 0.25) {
          if (
            containsPoint(floor, [x, z]) &&
            roomFitsFloor(floor, { ...footprint, center: [x, z] })
          ) {
            next.position = [x, element.position[1], z];
            return next;
          }
        }
      throw new Error(
        'This element does not fit inside the outline. Reduce its size or choose a room.',
      );
    }
  }
  return next;
}
