import { FLOOR_ID } from '../types';
import type { HomeElement, Project, UtilityConnection } from '../types';
import { getConnections } from './connections';
import { createId } from './id';
import { localToWorld } from './transforms';
import { syncWallAttachments } from './openings';

export interface ElementClipboard {
  version: 1;
  elements: HomeElement[];
  connections: UtilityConnection[];
}

/** Take an independent snapshot. Only routes entirely within the selection travel with it. */
export function copyElements(
  project: Project,
  ids: readonly string[],
): ElementClipboard | null {
  const selected = new Set(ids);
  const elements = project.elements.filter((element) =>
    selected.has(element.id),
  );
  if (!elements.length) return null;
  const copiedIds = new Set(elements.map((element) => element.id));
  return structuredClone({
    version: 1,
    elements,
    connections: getConnections(project).filter(
      (connection) =>
        copiedIds.has(connection.fromId) && copiedIds.has(connection.toId),
    ),
  });
}

/** Paste into the active storey, keeping internal relationships and relative positions intact. */
export function pasteElements(
  project: Project,
  clipboard: ElementClipboard,
  offset: [number, number] = [0.5, 0.5],
): { project: Project; selectedIds: string[] } {
  if (!clipboard.elements.length) return { project, selectedIds: [] };
  if (!offset.every(Number.isFinite))
    throw new Error('Paste offset must contain valid distances.');
  const source = structuredClone(clipboard);
  const usedIds = new Set([
    ...project.rooms.map((room) => room.id),
    ...project.elements.map((element) => element.id),
    ...getConnections(project).map((connection) => connection.id),
  ]);
  const freshId = () => {
    let id = createId();
    while (usedIds.has(id)) id = createId();
    usedIds.add(id);
    return id;
  };
  const idMap = new Map(
    source.elements.map((element) => [element.id, freshId()]),
  );
  // Clamp the shared displacement, never individual objects, to preserve the copied layout.
  const points = [
    ...source.elements.map((element) => element.position),
    ...source.connections.flatMap((connection) => connection.waypoints),
  ];
  const dx = Math.max(
    -100 - Math.min(...points.map((point) => point[0])),
    Math.min(100 - Math.max(...points.map((point) => point[0])), offset[0]),
  );
  const dz = Math.max(
    -100 - Math.min(...points.map((point) => point[2])),
    Math.min(100 - Math.max(...points.map((point) => point[2])), offset[1]),
  );
  const levelId = project.activeLevelId;
  const destinationRooms = project.rooms.filter(
    (room) => !levelId || room.levelId === levelId,
  );
  const pasted = source.elements.map((element) => {
    const x = element.position[0] + dx,
      z = element.position[2] + dz;
    const extent = localToWorld(
      [element.dimensions.width / 2, element.dimensions.depth / 2],
      element.rotation,
    );
    const other = localToWorld(
      [element.dimensions.width / 2, -element.dimensions.depth / 2],
      element.rotation,
    );
    const halfWidth = Math.max(Math.abs(extent[0]), Math.abs(other[0]));
    const halfDepth = Math.max(Math.abs(extent[1]), Math.abs(other[1]));
    const fits = (room: Project['rooms'][number]) =>
      Math.abs(x - room.center[0]) + halfWidth <= room.width / 2 + 0.001 &&
      Math.abs(z - room.center[1]) + halfDepth <= room.depth / 2 + 0.001;
    const destinationRoom =
      destinationRooms.find(
        (room) => room.id === element.roomId && fits(room),
      ) ?? destinationRooms.find(fits);
    const next: HomeElement = {
      ...element,
      id: idMap.get(element.id)!,
      name: `${element.name.replace(/ copy(?: \d+)?$/, '')} copy`.slice(0, 100),
      roomId: destinationRoom?.id ?? FLOOR_ID,
      position: [x, element.position[1], z],
      locked: false,
      ...(levelId ? { levelId } : {}),
    };
    if (!levelId) delete next.levelId;
    if (element.kind === 'stairs' && levelId && element.levelId !== levelId) {
      const elevation = project.levels?.find(
        (level) => level.id === levelId,
      )?.elevation;
      const upperLevel =
        elevation === undefined
          ? undefined
          : project.levels
              ?.filter((level) => level.elevation > elevation)
              .sort((a, b) => a.elevation - b.elevation)[0];
      if (
        upperLevel &&
        upperLevel.elevation - elevation! - next.position[1] >= 0.01
      ) {
        next.connectsToLevelId = upperLevel.id;
        next.dimensions.height =
          upperLevel.elevation - elevation! - next.position[1];
      } else delete next.connectsToLevelId;
    }
    delete next.floorEdge;
    if (element.wallAttachment && idMap.has(element.wallAttachment.wallId)) {
      next.wallAttachment = {
        wallId: idMap.get(element.wallAttachment.wallId)!,
        offset: element.wallAttachment.offset,
      };
    } else delete next.wallAttachment;
    return next;
  });
  const routes = source.connections
    .filter(
      (connection) =>
        idMap.has(connection.fromId) && idMap.has(connection.toId),
    )
    .map((connection) => ({
      ...connection,
      id: freshId(),
      name: `${connection.name} copy`.slice(0, 100),
      fromId: idMap.get(connection.fromId)!,
      toId: idMap.get(connection.toId)!,
      waypoints: connection.waypoints.map(
        ([x, y, z]) => [x + dx, y, z + dz] as [number, number, number],
      ),
    }));
  return {
    project: syncWallAttachments({
      ...project,
      elements: [...project.elements, ...pasted],
      connections: [...getConnections(project), ...routes],
    }),
    selectedIds: pasted.map((element) => element.id),
  };
}
