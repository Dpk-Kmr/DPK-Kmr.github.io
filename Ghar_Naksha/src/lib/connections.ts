import { ELECTRICAL_KINDS, GROUND_LEVEL_ID } from '../types';
import type { HomeElement, Project, UtilityConnection } from '../types';

export function isConnectionEndpoint(
  element: HomeElement,
  system: UtilityConnection['system'],
): boolean {
  return system === 'electrical'
    ? ELECTRICAL_KINDS.includes(element.kind)
    : ['water-port', 'sink', 'toilet', 'shower'].includes(element.kind);
}

/** Undefined means a legacy project. An explicit empty array deliberately has no routes. */
export function getConnections(project: Project): UtilityConnection[] {
  if (project.connections !== undefined) return project.connections;
  const connections: UtilityConnection[] = [];
  const ids = new Set([
    ...project.rooms.map((room) => room.id),
    ...project.elements.map((element) => element.id),
  ]);
  let sequence = 0;
  const levelIds = [
    ...new Set(project.elements.map((element) => element.levelId)),
  ];
  for (const levelId of levelIds) {
    for (const system of ['electrical', 'plumbing'] as const) {
      const candidates = project.elements.filter(
        (element) =>
          element.levelId === levelId && isConnectionEndpoint(element, system),
      );
      const source = candidates.find(
        (element) =>
          element.kind ===
          (system === 'electrical' ? 'electrical-panel' : 'water-port'),
      );
      if (!source) continue;
      for (const target of candidates) {
        if (target.id === source.id) continue;
        let id: string;
        do {
          id = `legacy-${system}-${++sequence}`;
        } while (ids.has(id));
        ids.add(id);
        connections.push({
          id,
          name: `${system === 'electrical' ? 'Supply' : 'Water'} · ${target.name}`.slice(
            0,
            100,
          ),
          system,
          fromId: source.id,
          toId: target.id,
          waypoints: [],
          enabled: true,
          size: system === 'electrical' ? 20 : 25,
          label: '',
        });
      }
    }
  }
  return connections;
}

export function connectionPoints(
  connection: UtilityConnection,
  elements: HomeElement[],
): [number, number, number][] {
  const from = elements.find((element) => element.id === connection.fromId),
    to = elements.find((element) => element.id === connection.toId);
  if (
    !from ||
    !to ||
    !isConnectionEndpoint(from, connection.system) ||
    !isConnectionEndpoint(to, connection.system)
  )
    return [];
  const start: [number, number, number] = [
    from.position[0],
    from.position[1] + from.dimensions.height / 2,
    from.position[2],
  ];
  const end: [number, number, number] = [
    to.position[0],
    to.position[1] + to.dimensions.height / 2,
    to.position[2],
  ];
  const level = connection.system === 'electrical' ? 0.16 : 0.11;
  const bends: [number, number, number][] = connection.waypoints.length
    ? connection.waypoints.map((point) => [...point])
    : [
        [start[0], level, start[2]],
        [end[0], level, start[2]],
        [end[0], level, end[2]],
      ];
  return [start, ...bends, end].filter(
    (point, index, points) =>
      index === 0 ||
      point.some(
        (coordinate, axis) =>
          Math.abs(coordinate - points[index - 1][axis]) > 1e-8,
      ),
  );
}

export function connectionLength(
  connection: UtilityConnection,
  elements: HomeElement[],
): number {
  const points = connectionPoints(connection, elements);
  return points.reduce(
    (length, point, index) =>
      index
        ? length +
          Math.hypot(
            ...point.map(
              (coordinate, axis) => coordinate - points[index - 1][axis],
            ),
          )
        : 0,
    0,
  );
}

function endpointElevation(project: Project, element: HomeElement): number {
  const levelId =
    element.levelId ??
    project.rooms.find((room) => room.id === element.roomId)?.levelId ??
    project.activeLevelId ??
    GROUND_LEVEL_ID;
  return project.levels?.find((level) => level.id === levelId)?.elevation ?? 0;
}

/** World-space geometry: manual bends are stored relative to the source floor. */
export function connectionWorldPoints(
  connection: UtilityConnection,
  project: Project,
): [number, number, number][] {
  const from = project.elements.find(
    (element) => element.id === connection.fromId,
  );
  const to = project.elements.find((element) => element.id === connection.toId);
  if (!from || !to) return [];
  const sourceElevation = endpointElevation(project, from);
  // The existing local route builder also gives automatic bends their source floor datum.
  const points = connectionPoints(connection, [
    from,
    {
      ...to,
      position: [
        to.position[0],
        to.position[1] + endpointElevation(project, to) - sourceElevation,
        to.position[2],
      ],
    },
  ]);
  return points.map(([x, y, z]) => [x, y + sourceElevation, z]);
}

export function connectionLocalPoints(
  connection: UtilityConnection,
  project: Project,
): [number, number, number][] {
  const from = project.elements.find(
    (element) => element.id === connection.fromId,
  );
  if (!from) return [];
  const elevation = endpointElevation(project, from);
  return connectionWorldPoints(connection, project).map(([x, y, z]) => [
    x,
    y - elevation,
    z,
  ]);
}

export function connectionWorldLength(
  connection: UtilityConnection,
  project: Project,
): number {
  const points = connectionWorldPoints(connection, project);
  return points.reduce(
    (length, point, index) =>
      index
        ? length +
          Math.hypot(
            ...point.map(
              (coordinate, axis) => coordinate - points[index - 1][axis],
            ),
          )
        : 0,
    0,
  );
}

/** Moving a route's source to another floor preserves the world positions of its manual bends. */
export function changeConnectionEndpoint(
  project: Project,
  connection: UtilityConnection,
  endpoint: 'fromId' | 'toId',
  id: string,
): UtilityConnection {
  const next = project.elements.find((element) => element.id === id);
  if (!next || !isConnectionEndpoint(next, connection.system))
    throw new Error('Choose a compatible connection point.');
  if (id === connection[endpoint === 'fromId' ? 'toId' : 'fromId'])
    throw new Error('A route needs two different connection points.');
  const current = project.elements.find(
    (element) => element.id === connection.fromId,
  );
  const shift =
    endpoint === 'fromId' && current
      ? endpointElevation(project, current) - endpointElevation(project, next)
      : 0;
  return {
    ...connection,
    [endpoint]: id,
    waypoints: connection.waypoints.map(([x, y, z]) => [x, y + shift, z]),
  };
}

/** Use after an intentional element deletion, never to conceal invalid imported references. */
export function removeDanglingConnections(project: Project): Project {
  return {
    ...project,
    connections: getConnections(project).filter(
      (connection) =>
        connection.fromId !== connection.toId &&
        [connection.fromId, connection.toId].every((id) =>
          project.elements.some(
            (element) =>
              element.id === id &&
              isConnectionEndpoint(element, connection.system),
          ),
        ),
    ),
  };
}
