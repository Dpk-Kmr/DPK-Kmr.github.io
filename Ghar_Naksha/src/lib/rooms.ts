import { createId } from './id';
import type { HomeElement, Project, Room } from '../types';
import { STRUCTURAL_KINDS } from '../types';

/** Create a room shell with a 1.1 m entrance gap along its front edge. */
export function makeRoom(
  name: string,
  width: number,
  depth: number,
  center: [number, number] = [0, 0],
): { room: Room; elements: HomeElement[] } {
  const room: Room = {
    id: createId(),
    name: name.trim() || 'New room',
    subtitle: 'A space to make your own',
    center,
    width,
    depth,
    color: '#e6ddcd',
  };
  const [x, z] = center;
  const entrance = Math.min(1.1, width / 2);
  const segment = (width - entrance) / 2;
  const element = (
    name: string,
    position: [number, number, number],
    width: number,
    height: number,
    depth: number,
  ): HomeElement => ({
    id: createId(),
    kind: 'wall',
    name,
    roomId: room.id,
    position,
    rotation: 0,
    dimensions: { width, height, depth },
    color: '#edeae1',
    material: 'plaster',
    visible: true,
    locked: false,
  });
  const elements = [
    element('Back wall', [x, 0, z - depth / 2], width, 2.7, 0.15),
    element('Left wall', [x - width / 2, 0, z], 0.15, 2.7, depth),
    element('Right wall', [x + width / 2, 0, z], 0.15, 2.7, depth),
    element(
      'Front wall · left',
      [x - entrance / 2 - segment / 2, 0, z + depth / 2],
      segment,
      2.7,
      0.15,
    ),
    element(
      'Front wall · right',
      [x + entrance / 2 + segment / 2, 0, z + depth / 2],
      segment,
      2.7,
      0.15,
    ),
  ];
  return { room, elements };
}

/** Move/resize the room shell and reposition its contents while preserving furniture sizes. */
export function updateRoom(
  project: Project,
  id: string,
  patch: Partial<Room>,
): Project {
  const previous = project.rooms.find((room) => room.id === id);
  if (!previous) return project;
  const next = { ...previous, ...patch };
  const sx = next.width / previous.width;
  const sz = next.depth / previous.depth;
  return {
    ...project,
    rooms: project.rooms.map((room) => (room.id === id ? next : room)),
    elements: project.elements.map((element) => {
      if (element.roomId !== id) return element;
      const rotation = (element.rotation * Math.PI) / 180;
      const alongWidth = Math.hypot(
        sx * Math.cos(rotation),
        sz * Math.sin(rotation),
      );
      const alongDepth = Math.hypot(
        sx * Math.sin(rotation),
        sz * Math.cos(rotation),
      );
      const attachedWall = element.wallAttachment
        ? project.elements.find(
            (wall) =>
              wall.id === element.wallAttachment!.wallId && wall.roomId === id,
          )
        : undefined;
      const wallAngle = ((attachedWall?.rotation ?? 0) * Math.PI) / 180;
      const attachmentScale =
        attachedWall &&
        attachedWall.dimensions.depth > attachedWall.dimensions.width
          ? Math.hypot(sx * Math.sin(wallAngle), sz * Math.cos(wallAngle))
          : Math.hypot(sx * Math.cos(wallAngle), sz * Math.sin(wallAngle));
      return {
        ...element,
        ...(element.wallAttachment && attachedWall
          ? {
              wallAttachment: {
                ...element.wallAttachment,
                offset: element.wallAttachment.offset * attachmentScale,
              },
            }
          : {}),
        position: [
          next.center[0] + (element.position[0] - previous.center[0]) * sx,
          element.position[1],
          next.center[1] + (element.position[2] - previous.center[1]) * sz,
        ],
        dimensions:
          STRUCTURAL_KINDS.includes(element.kind) && element.kind !== 'stairs'
            ? {
                ...element.dimensions,
                width: element.dimensions.width * alongWidth,
                depth: element.dimensions.depth * alongDepth,
              }
            : element.dimensions,
      };
    }),
  };
}
