import type { FloorPlan, Project, Room } from '../types';

type Point = [number, number];
const EPS = 1e-8;
export interface FloorBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
  centerX: number;
  centerZ: number;
}
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const onSegment = (point: Point, a: Point, b: Point) =>
  Math.abs(cross(a, b, point)) < EPS &&
  point[0] >= Math.min(a[0], b[0]) - EPS &&
  point[0] <= Math.max(a[0], b[0]) + EPS &&
  point[1] >= Math.min(a[1], b[1]) - EPS &&
  point[1] <= Math.max(a[1], b[1]) + EPS;

function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  if (
    ((abC > EPS && abD < -EPS) || (abC < -EPS && abD > EPS)) &&
    ((cdA > EPS && cdB < -EPS) || (cdA < -EPS && cdB > EPS))
  )
    return true;
  return (
    onSegment(c, a, b) ||
    onSegment(d, a, b) ||
    onSegment(a, c, d) ||
    onSegment(b, c, d)
  );
}

export function floorArea(floor: FloorPlan): number {
  return (
    Math.abs(
      floor.outline.reduce((sum, point, index) => {
        const next = floor.outline[(index + 1) % floor.outline.length];
        return sum + point[0] * next[1] - next[0] * point[1];
      }, 0),
    ) / 2
  );
}

/** Validate one simple perimeter. Holes, crossing edges and duplicate closing vertices are rejected. */
export function validateFloorPlan(value: unknown): FloorPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Floor plan must be an object.');
  const input = value as Record<string, unknown>;
  if (input.holes !== undefined)
    throw new Error('Floor plans support one perimeter without holes.');
  if (
    !Array.isArray(input.outline) ||
    input.outline.length < 3 ||
    input.outline.length > 32
  )
    throw new Error('Floor outline must contain 3–32 vertices.');
  const outline: Point[] = input.outline.map((value, index) => {
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      value.some(
        (coordinate) =>
          typeof coordinate !== 'number' ||
          !Number.isFinite(coordinate) ||
          Math.abs(coordinate) > 100,
      )
    )
      throw new Error(
        `Floor vertex ${index + 1} must have two finite coordinates between -100 and 100 metres.`,
      );
    return [value[0] as number, value[1] as number];
  });
  if (
    typeof input.wallHeight !== 'number' ||
    !Number.isFinite(input.wallHeight) ||
    input.wallHeight < 0.5 ||
    input.wallHeight > 10
  )
    throw new Error('Floor wall height must be between 0.5 and 10 metres.');
  if (
    typeof input.wallThickness !== 'number' ||
    !Number.isFinite(input.wallThickness) ||
    input.wallThickness < 0.05 ||
    input.wallThickness > 1
  )
    throw new Error('Floor wall thickness must be between 0.05 and 1 metre.');
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      c = outline[(i + 2) % outline.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.1 - EPS)
      throw new Error(`Floor side ${i + 1} must be at least 0.1 metre long.`);
    if (
      Math.abs(cross(a, b, c)) < EPS &&
      (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0
    )
      throw new Error('Floor edges cannot fold back or overlap.');
    for (let j = i + 1; j < outline.length; j++) {
      if (j === i + 1 || (i === 0 && j === outline.length - 1)) continue;
      if (intersects(a, b, outline[j], outline[(j + 1) % outline.length]))
        throw new Error(
          'Floor outline cannot cross or touch itself. Use one simple perimeter without holes.',
        );
    }
  }
  const floor = {
    outline,
    wallHeight: input.wallHeight,
    wallThickness: input.wallThickness,
  };
  if (floorArea(floor) <= 1)
    throw new Error('Floor area must be greater than 1 square metre.');
  return floor;
}

export function floorBounds(floor: FloorPlan): FloorBounds {
  const xs = floor.outline.map((point) => point[0]),
    zs = floor.outline.map((point) => point[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
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

export function getFloorPlan(project: Project): FloorPlan {
  if (project.floorPlan) return project.floorPlan;
  if (!project.rooms.length)
    return {
      outline: [
        [-6, -5],
        [6, -5],
        [6, 5],
        [-6, 5],
      ],
      wallHeight: 2.7,
      wallThickness: 0.15,
    };
  const minX = Math.min(
    ...project.rooms.map((room) => room.center[0] - room.width / 2),
  );
  const maxX = Math.max(
    ...project.rooms.map((room) => room.center[0] + room.width / 2),
  );
  const minZ = Math.min(
    ...project.rooms.map((room) => room.center[1] - room.depth / 2),
  );
  const maxZ = Math.max(
    ...project.rooms.map((room) => room.center[1] + room.depth / 2),
  );
  return {
    outline: [
      [minX, minZ],
      [maxX, minZ],
      [maxX, maxZ],
      [minX, maxZ],
    ],
    wallHeight: 2.7,
    wallThickness: 0.15,
  };
}

export function containsPoint(floor: FloorPlan, point: Point): boolean {
  let inside = false;
  for (
    let i = 0, j = floor.outline.length - 1;
    i < floor.outline.length;
    j = i++
  ) {
    const a = floor.outline[j],
      b = floor.outline[i];
    if (onSegment(point, a, b)) return true;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

// Split an edge wherever it meets the floor boundary; testing each interval also catches
// concave notches whose tips happen to land exactly on the room boundary.
function intersectionParameters(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): number[] {
  const rx = b[0] - a[0],
    rz = b[1] - a[1],
    sx = d[0] - c[0],
    sz = d[1] - c[1];
  const determinant = rx * sz - rz * sx;
  const qx = c[0] - a[0],
    qz = c[1] - a[1];
  if (Math.abs(determinant) > EPS) {
    const t = (qx * sz - qz * sx) / determinant,
      u = (qx * rz - qz * rx) / determinant;
    return t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS
      ? [Math.max(0, Math.min(1, t))]
      : [];
  }
  if (Math.abs(qx * rz - qz * rx) > EPS) return [];
  const squared = rx * rx + rz * rz;
  return [
    ((c[0] - a[0]) * rx + (c[1] - a[1]) * rz) / squared,
    ((d[0] - a[0]) * rx + (d[1] - a[1]) * rz) / squared,
  ].filter((t) => t > 0 && t < 1);
}

export function roomFitsFloor(
  floor: FloorPlan,
  room: Pick<Room, 'center' | 'width' | 'depth'>,
): boolean {
  if (
    !Number.isFinite(room.width) ||
    !Number.isFinite(room.depth) ||
    room.width <= 0 ||
    room.depth <= 0
  )
    return false;
  const [x, z] = room.center,
    w = room.width / 2,
    d = room.depth / 2;
  const corners: Point[] = [
    [x - w, z - d],
    [x + w, z - d],
    [x + w, z + d],
    [x - w, z + d],
  ];
  if (corners.some((point) => !containsPoint(floor, point))) return false;
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4];
    const parameters = [0, 1];
    for (let j = 0; j < floor.outline.length; j++)
      parameters.push(
        ...intersectionParameters(
          a,
          b,
          floor.outline[j],
          floor.outline[(j + 1) % floor.outline.length],
        ),
      );
    parameters.sort((a, b) => a - b);
    for (let j = 1; j < parameters.length; j++) {
      const t = (parameters[j - 1] + parameters[j]) / 2;
      if (
        !containsPoint(floor, [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t,
        ])
      )
        return false;
    }
  }
  return true;
}

export function findRoomPlacement(
  project: Project,
  width: number,
  depth: number,
): Point | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(depth) ||
    width <= 0 ||
    depth <= 0
  )
    return null;
  const floor = getFloorPlan(project),
    bounds = floorBounds(floor);
  if (width > bounds.width + EPS || depth > bounds.depth + EPS) return null;
  const fits = (x: number, z: number) =>
    !project.rooms.some(
      (room) =>
        Math.abs(x - room.center[0]) < (width + room.width) / 2 - EPS &&
        Math.abs(z - room.center[1]) < (depth + room.depth) / 2 - EPS,
    ) && roomFitsFloor(floor, { center: [x, z], width, depth });
  const xs = new Set([
    bounds.minX + width / 2,
    bounds.maxX - width / 2,
    bounds.centerX,
  ]);
  const zs = new Set([
    bounds.minZ + depth / 2,
    bounds.maxZ - depth / 2,
    bounds.centerZ,
  ]);
  for (const room of project.rooms) {
    xs.add(room.center[0] + (room.width + width) / 2);
    xs.add(room.center[0] - (room.width + width) / 2);
    zs.add(room.center[1] + (room.depth + depth) / 2);
    zs.add(room.center[1] - (room.depth + depth) / 2);
  }
  for (const z of zs)
    for (const x of xs)
      if (
        x >= bounds.minX + width / 2 - EPS &&
        x <= bounds.maxX - width / 2 + EPS &&
        z >= bounds.minZ + depth / 2 - EPS &&
        z <= bounds.maxZ - depth / 2 + EPS &&
        fits(x, z)
      )
        return [x, z];
  for (
    let z = Math.ceil((bounds.minZ + depth / 2) * 4) / 4;
    z <= bounds.maxZ - depth / 2 + EPS;
    z += 0.25
  ) {
    for (
      let x = Math.ceil((bounds.minX + width / 2) * 4) / 4;
      x <= bounds.maxX - width / 2 + EPS;
      x += 0.25
    )
      if (fits(x, z)) return [x, z];
  }
  return null;
}

export function resizeFloor(
  project: Project,
  newFloor: FloorPlan,
  mode: 'keep' | 'scale',
): Project {
  const floorPlan = validateFloorPlan(newFloor);
  const oldBounds = floorBounds(getFloorPlan(project)),
    nextBounds = floorBounds(floorPlan);
  const result = structuredClone(project);
  result.floorPlan = floorPlan;
  if (mode === 'scale') {
    const sx = nextBounds.width / oldBounds.width,
      sz = nextBounds.depth / oldBounds.depth;
    const transform = (x: number, z: number): Point => [
      nextBounds.minX + (x - oldBounds.minX) * sx,
      nextBounds.minZ + (z - oldBounds.minZ) * sz,
    ];
    const originalElements = new Map(
      project.elements.map((element) => [element.id, element]),
    );
    result.rooms = result.rooms.map((room) => ({
      ...room,
      center: transform(...room.center),
      width: room.width * sx,
      depth: room.depth * sz,
    }));
    result.elements = result.elements.map((element) => {
      const [x, z] = transform(element.position[0], element.position[2]);
      const angle = (element.rotation * Math.PI) / 180;
      const alongWidth = Math.hypot(sx * Math.cos(angle), sz * Math.sin(angle)),
        alongDepth = Math.hypot(sx * Math.sin(angle), sz * Math.cos(angle));
      const parentWall = element.wallAttachment
        ? originalElements.get(element.wallAttachment.wallId)
        : undefined;
      const wallAngle = parentWall
        ? (parentWall.rotation * Math.PI) / 180
        : angle;
      const offsetScale =
        parentWall && parentWall.dimensions.depth > parentWall.dimensions.width
          ? Math.hypot(sx * Math.sin(wallAngle), sz * Math.cos(wallAngle))
          : Math.hypot(sx * Math.cos(wallAngle), sz * Math.sin(wallAngle));
      return {
        ...element,
        position: [x, element.position[1], z],
        dimensions: {
          ...element.dimensions,
          width: element.dimensions.width * alongWidth,
          depth: element.dimensions.depth * alongDepth,
        },
        ...(element.stairs
          ? {
              stairs: {
                ...element.stairs,
                flightWidth: element.stairs.flightWidth * alongWidth,
                landingDepth: element.stairs.landingDepth * alongDepth,
                innerRadius: element.stairs.innerRadius * Math.min(sx, sz),
                nosing: element.stairs.nosing * alongDepth,
              },
            }
          : {}),
        ...(element.wallAttachment
          ? {
              wallAttachment: {
                ...element.wallAttachment,
                offset: element.wallAttachment.offset * offsetScale,
              },
            }
          : {}),
      };
    });
    if (result.connections)
      result.connections = result.connections.map((connection) => ({
        ...connection,
        waypoints: connection.waypoints.map(([x, y, z]) => {
          const point = transform(x, z);
          return [point[0], y, point[1]];
        }),
      }));
  }
  const clipped = result.rooms.find((room) => !roomFitsFloor(floorPlan, room));
  if (clipped)
    throw new Error(
      `The new floor would cut through "${clipped.name}". Enlarge the outline or move/resize that room first.`,
    );
  return result;
}
