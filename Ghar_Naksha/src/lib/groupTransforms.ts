import type { HomeElement, Project, UtilityConnection } from '../types';
import { getConnections } from './connections';
import { localToWorld, normalizeRotation, snapLength } from './transforms';
import type { PlanPoint, ResizeHandle } from './transforms';

export interface SelectionBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  center: PlanPoint;
  width: number;
  depth: number;
}
export interface GroupFrame {
  center: PlanPoint;
  width: number;
  depth: number;
  rotation: number;
}
export interface GroupUpdate {
  updates: { id: string; patch: Partial<HomeElement> }[];
  connections: UtilityConnection[];
  frame: GroupFrame;
}
export type GroupTransform =
  | { kind: 'move'; delta: PlanPoint }
  | { kind: 'resize'; handle: ResizeHandle; delta: PlanPoint }
  | { kind: 'rotate'; start: PlanPoint; current: PlanPoint };
const precise = (value: number) => Number(value.toFixed(5));

export function selectionBounds(
  elements: readonly HomeElement[],
): SelectionBounds | null {
  if (!elements.length) return null;
  const points = elements.flatMap((element) =>
    [-1, 1].flatMap((x) =>
      [-1, 1].map((z) => {
        const local = localToWorld(
          [
            (x * element.dimensions.width) / 2,
            (z * element.dimensions.depth) / 2,
          ],
          element.rotation,
        );
        return [element.position[0] + local[0], element.position[2] + local[1]];
      }),
    ),
  );
  const minX = Math.min(...points.map((point) => point[0])),
    maxX = Math.max(...points.map((point) => point[0]));
  const minZ = Math.min(...points.map((point) => point[1])),
    maxZ = Math.max(...points.map((point) => point[1]));
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    center: [(minX + maxX) / 2, (minZ + maxZ) / 2],
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

/** Group resizing is proportional, preserving rotated objects and openings without introducing shear. */
export function transformGroup(
  project: Project,
  ids: readonly string[],
  transform: GroupTransform,
  snap = false,
): GroupUpdate | null {
  const selected = new Set(ids),
    elements = project.elements.filter((element) => selected.has(element.id));
  const bounds = selectionBounds(elements);
  if (!bounds || elements.some((element) => element.locked)) return null;
  let center = bounds.center,
    scale = 1,
    rotation = 0;
  if (transform.kind === 'move') {
    const movePoints = [
      ...elements.map((element) => element.position),
      ...getConnections(project)
        .filter(
          (connection) =>
            selected.has(connection.fromId) && selected.has(connection.toId),
        )
        .flatMap((connection) => connection.waypoints),
    ];
    let dx =
      snapLength(bounds.center[0] + transform.delta[0], snap) -
      bounds.center[0];
    let dz =
      snapLength(bounds.center[1] + transform.delta[1], snap) -
      bounds.center[1];
    dx = Math.max(
      -100 - Math.min(...movePoints.map((point) => point[0])),
      Math.min(100 - Math.max(...movePoints.map((point) => point[0])), dx),
    );
    dz = Math.max(
      -100 - Math.min(...movePoints.map((point) => point[2])),
      Math.min(100 - Math.max(...movePoints.map((point) => point[2])), dz),
    );
    center = [bounds.center[0] + dx, bounds.center[1] + dz];
  } else if (transform.kind === 'resize') {
    const [hx, hz] = transform.handle;
    const original: PlanPoint = [hx * bounds.width, hz * bounds.depth];
    const denominator = original[0] ** 2 + original[1] ** 2;
    if (denominator < 1e-8) return null;
    scale =
      1 +
      (transform.delta[0] * original[0] + transform.delta[1] * original[1]) /
        denominator;
    if (snap) scale = snapLength(bounds.width * scale, true) / bounds.width;
    const minimum = Math.max(
      ...elements.flatMap((element) => [
        0.01 / element.dimensions.width,
        0.01 / element.dimensions.depth,
        ...(element.stairs
          ? [
              0.4 / element.stairs.flightWidth,
              0.4 / element.stairs.landingDepth,
              0.06 / element.stairs.innerRadius,
            ]
          : []),
      ]),
    );
    const maximum = Math.min(
      ...elements.flatMap((element) => [
        100 / element.dimensions.width,
        100 / element.dimensions.depth,
        ...(element.stairs
          ? [
              4 / element.stairs.flightWidth,
              6 / element.stairs.landingDepth,
              2 / element.stairs.innerRadius,
              element.stairs.nosing ? 0.1 / element.stairs.nosing : Infinity,
            ]
          : []),
      ]),
    );
    scale = Math.max(minimum, Math.min(maximum, scale));
    center = [
      bounds.center[0] + (hx * bounds.width * (scale - 1)) / 2,
      bounds.center[1] + (hz * bounds.depth * (scale - 1)) / 2,
    ];
  } else {
    if (
      Math.hypot(
        transform.current[0] - center[0],
        transform.current[1] - center[1],
      ) < 0.001
    )
      return null;
    const degrees =
      ((Math.atan2(
        transform.start[1] - center[1],
        transform.start[0] - center[0],
      ) -
        Math.atan2(
          transform.current[1] - center[1],
          transform.current[0] - center[0],
        )) *
        180) /
      Math.PI;
    rotation = snap
      ? Math.round(degrees / 15) * 15
      : Number(degrees.toFixed(1));
  }
  const point = (x: number, z: number): PlanPoint => {
    const relative = localToWorld(
      [(x - bounds.center[0]) * scale, (z - bounds.center[1]) * scale],
      rotation,
    );
    return [precise(center[0] + relative[0]), precise(center[1] + relative[1])];
  };
  const updates = elements.map((element) => {
    const [x, z] = point(element.position[0], element.position[2]);
    const patch: Partial<HomeElement> = {
      position: [x, element.position[1], z],
      rotation: normalizeRotation(element.rotation + rotation),
      dimensions: {
        ...element.dimensions,
        width: precise(element.dimensions.width * scale),
        depth: precise(element.dimensions.depth * scale),
      },
    };
    if (element.wallAttachment)
      patch.wallAttachment = selected.has(element.wallAttachment.wallId)
        ? {
            ...element.wallAttachment,
            offset: precise(element.wallAttachment.offset * scale),
          }
        : undefined;
    if (element.stairs && scale !== 1)
      patch.stairs = {
        ...element.stairs,
        flightWidth: Math.max(
          0.4,
          Math.min(4, precise(element.stairs.flightWidth * scale)),
        ),
        landingDepth: Math.max(
          0.4,
          Math.min(6, precise(element.stairs.landingDepth * scale)),
        ),
        innerRadius: Math.max(
          0.06,
          Math.min(2, precise(element.stairs.innerRadius * scale)),
        ),
        nosing: Math.min(0.1, element.stairs.nosing * scale),
      };
    return { id: element.id, patch };
  });
  if (
    updates.some(({ patch }) =>
      patch.position!.some((value) => Math.abs(value) > 100),
    )
  )
    return null;
  const connections = getConnections(project).map((connection) =>
    selected.has(connection.fromId) && selected.has(connection.toId)
      ? {
          ...connection,
          waypoints: connection.waypoints.map(([x, y, z]) => {
            const next = point(x, z);
            return [next[0], y, next[1]] as [number, number, number];
          }),
        }
      : connection,
  );
  if (
    connections.some((connection) =>
      connection.waypoints.some((waypoint) =>
        waypoint.some((value) => Math.abs(value) > 100),
      ),
    )
  )
    return null;
  return {
    updates,
    connections,
    frame: {
      center,
      width: bounds.width * scale,
      depth: bounds.depth * scale,
      rotation: normalizeRotation(rotation),
    },
  };
}
