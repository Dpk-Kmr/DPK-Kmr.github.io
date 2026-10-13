import type {
  ElementKind,
  BuildingLevel,
  HomeElement,
  Material,
  Project,
  Room,
  StairConfig,
  UtilityConnection,
} from '../types';
import { FLOOR_ID, GROUND_LEVEL_ID } from '../types';
import { getFloorPlan, roomFitsFloor, validateFloorPlan } from './floor';
import { getConnections, isConnectionEndpoint } from './connections';
import { defaultStairs } from './stairs';

export const STORAGE_KEY = 'ghar-naksha-project-v1';

const KINDS = new Set<ElementKind>([
  'block', 'temple',
  'sofa',
  'armchair',
  'coffee-table',
  'dining-table',
  'chair',
  'bed',
  'nightstand',
  'wardrobe',
  'kitchen-counter',
  'sink',
  'toilet',
  'shower',
  'plant',
  'rug',
  'tv',
  'lamp',
  'wall',
  'door',
  'window',
  'socket',
  'switch',
  'light',
  'water-port',
  'electrical-panel',
  'stairs',
]);
const MATERIALS = new Set<Material>([
  'fabric',
  'wood',
  'stone',
  'ceramic',
  'metal',
  'plaster',
  'glass',
]);
const MAX_ELEMENTS = 2000;
const MAX_ROOMS = 100;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, maxLength = 100): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    throw new Error(`${label} must contain 1–${maxLength} characters.`);
  return value;
}

function number(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(
      `${label} must be a finite number between ${min} and ${max}.`,
    );
  return value;
}

function color(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`${label} must be a six-digit hex color, such as #A7B69F.`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean')
    throw new Error(`${label} must be true or false.`);
  return value;
}

function tuple(value: unknown, length: number, label: string): unknown[] {
  if (!Array.isArray(value) || value.length !== length)
    throw new Error(`${label} must contain exactly ${length} coordinates.`);
  return value;
}

function choice<T extends string>(
  value: unknown,
  options: readonly T[],
  label: string,
): T {
  if (typeof value !== 'string' || !options.includes(value as T))
    throw new Error(`${label} must be one of: ${options.join(', ')}.`);
  return value as T;
}

function stairConfig(value: unknown, label: string): StairConfig {
  const input =
    value === undefined ? {} : record(value, `${label} stair settings`);
  const defaults = defaultStairs();
  const field = <K extends keyof StairConfig>(key: K) =>
    input[key] === undefined ? defaults[key] : input[key];
  const steps = number(field('steps'), `${label} steps`, 3, 64);
  if (!Number.isInteger(steps))
    throw new Error(`${label} steps must be a whole number.`);
  return {
    style: choice(
      field('style'),
      ['straight', 'l-shaped', 'u-shaped', 'spiral', 'floating'] as const,
      `${label} stair style`,
    ),
    steps,
    flightWidth: number(field('flightWidth'), `${label} flight width`, 0.4, 4),
    landingDepth: number(
      field('landingDepth'),
      `${label} landing depth`,
      0.4,
      6,
    ),
    turnDirection: choice(
      field('turnDirection'),
      ['left', 'right'] as const,
      `${label} turn direction`,
    ),
    railing: choice(
      field('railing'),
      ['none', 'left', 'right', 'both'] as const,
      `${label} railing`,
    ),
    railingHeight: number(
      field('railingHeight'),
      `${label} railing height`,
      0.3,
      1.5,
    ),
    treadThickness: number(
      field('treadThickness'),
      `${label} tread thickness`,
      0.02,
      0.25,
    ),
    nosing: number(field('nosing'), `${label} nosing`, 0, 0.1),
    risers: choice(
      field('risers'),
      ['open', 'closed'] as const,
      `${label} risers`,
    ),
    stringer: choice(
      field('stringer'),
      ['solid', 'central', 'none'] as const,
      `${label} stringer`,
    ),
    spiralTurns: number(field('spiralTurns'), `${label} spiral turns`, 0.5, 3),
    innerRadius: number(field('innerRadius'), `${label} inner radius`, 0.06, 2),
  };
}

/** Validate untrusted imports and return a fresh project, without keeping input references. */
export function validateProject(value: unknown): Project {
  const input = record(value, 'Project');
  if (input.version !== 1)
    throw new Error(
      'Unsupported project version. Please import a version 1 Ghar Naksha project.',
    );
  const name = string(input.name, 'Project name', 120);
  if (!Array.isArray(input.rooms) || input.rooms.length > MAX_ROOMS)
    throw new Error(
      `Project must contain an array of no more than ${MAX_ROOMS} rooms.`,
    );
  if (
    !input.rooms.length &&
    input.floorPlan === undefined &&
    input.levels === undefined
  )
    throw new Error('A project without rooms must have a floor plan outline.');
  if (!Array.isArray(input.elements) || input.elements.length > MAX_ELEMENTS)
    throw new Error(
      `Project must contain no more than ${MAX_ELEMENTS} elements.`,
    );

  const ids = new Set<string>();
  const uniqueId = (value: unknown, label: string) => {
    const id = string(value, label, 100);
    if (id === FLOOR_ID)
      throw new Error(
        `The ID "${FLOOR_ID}" is reserved for the overall floor.`,
      );
    if (ids.has(id))
      throw new Error(
        `Duplicate ID "${id}". Every room, element and connection must have a unique ID.`,
      );
    ids.add(id);
    return id;
  };

  let levels: BuildingLevel[] | undefined;
  if (input.levels !== undefined) {
    if (
      !Array.isArray(input.levels) ||
      !input.levels.length ||
      input.levels.length > 32
    )
      throw new Error('A building must contain between 1 and 32 floors.');
    const levelIds = new Set<string>();
    levels = input.levels.map((value, index) => {
      const label = `Floor ${index + 1}`;
      const level = record(value, label);
      const id = string(level.id, `${label} ID`);
      if (id === FLOOR_ID || levelIds.has(id))
        throw new Error(`Duplicate or reserved floor ID "${id}".`);
      levelIds.add(id);
      return {
        id,
        name: string(level.name, `${label} name`),
        elevation: number(level.elevation, `${label} elevation`, -100, 100),
        floorPlan: validateFloorPlan(level.floorPlan),
      };
    });
  }
  const activeLevelId =
    input.activeLevelId === undefined
      ? (levels?.[0].id ?? GROUND_LEVEL_ID)
      : string(input.activeLevelId, 'Active floor ID');
  if (
    levels
      ? !levels.some((level) => level.id === activeLevelId)
      : activeLevelId !== GROUND_LEVEL_ID
  )
    throw new Error('The active floor does not exist.');
  const existingLevelIds = new Set(
    levels?.map((level) => level.id) ?? [GROUND_LEVEL_ID],
  );

  const rooms: Room[] = input.rooms.map((value, index) => {
    const label = `Room ${index + 1}`;
    const room = record(value, label);
    const levelId =
      room.levelId === undefined
        ? activeLevelId
        : string(room.levelId, `${label} floor ID`);
    if (!existingLevelIds.has(levelId))
      throw new Error(`${label} references a floor that does not exist.`);
    const center = tuple(room.center, 2, `${label} center`);
    if (typeof room.subtitle !== 'string' || room.subtitle.length > 200)
      throw new Error(
        `${label} subtitle must be text with at most 200 characters.`,
      );
    return {
      id: uniqueId(room.id, `${label} ID`),
      name: string(room.name, `${label} name`),
      subtitle: room.subtitle,
      center: [
        number(center[0], `${label} X coordinate`, -100, 100),
        number(center[1], `${label} Z coordinate`, -100, 100),
      ],
      width: number(room.width, `${label} width`, 0.05, 100),
      depth: number(room.depth, `${label} depth`, 0.05, 100),
      color: color(room.color, `${label} color`),
      levelId,
    };
  });
  const legacyFloorPlan = levels
    ? undefined
    : validateFloorPlan(
        input.floorPlan === undefined
          ? getFloorPlan({ version: 1, name, rooms, elements: [] })
          : input.floorPlan,
      );
  levels ??= [
    {
      id: GROUND_LEVEL_ID,
      name: 'Ground floor',
      elevation: 0,
      floorPlan: legacyFloorPlan!,
    },
  ];
  const byLevelId = new Map(levels.map((level) => [level.id, level]));
  const floorPlan = structuredClone(byLevelId.get(activeLevelId)!.floorPlan);
  const outside = rooms.find(
    (room) => !roomFitsFloor(byLevelId.get(room.levelId!)!.floorPlan, room),
  );
  if (outside)
    throw new Error(
      `Room "${outside.name}" extends outside the floor outline.`,
    );
  const roomIds = new Set(rooms.map((room) => room.id));
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const elements: HomeElement[] = input.elements.map((value, index) => {
    const label = `Element ${index + 1}`;
    const element = record(value, label);
    const position = tuple(element.position, 3, `${label} position`);
    const dimensions = record(element.dimensions, `${label} dimensions`);
    if (!KINDS.has(element.kind as ElementKind))
      throw new Error(`${label} has an unknown element kind.`);
    if (!MATERIALS.has(element.material as Material))
      throw new Error(`${label} has an unknown material.`);
    const roomId = string(element.roomId, `${label} room ID`);
    if (roomId !== FLOOR_ID && !roomIds.has(roomId))
      throw new Error(`${label} references a room that does not exist.`);
    const levelId =
      element.levelId === undefined
        ? (roomById.get(roomId)?.levelId ?? activeLevelId)
        : string(element.levelId, `${label} floor ID`);
    if (!existingLevelIds.has(levelId))
      throw new Error(`${label} references a floor that does not exist.`);
    if (roomId !== FLOOR_ID && roomById.get(roomId)!.levelId !== levelId)
      throw new Error(`${label} and its room must belong to the same floor.`);
    const connectsToLevelId =
      element.connectsToLevelId === undefined
        ? undefined
        : string(element.connectsToLevelId, `${label} destination floor ID`);
    if (connectsToLevelId !== undefined) {
      if (element.kind !== 'stairs')
        throw new Error(`${label} connects floors but is not a staircase.`);
      if (!byLevelId.has(connectsToLevelId))
        throw new Error(
          `${label} references a destination floor that does not exist.`,
        );
      if (connectsToLevelId === levelId)
        throw new Error(`${label} must connect to a different floor.`);
      if (
        byLevelId.get(connectsToLevelId)!.elevation <=
        byLevelId.get(levelId)!.elevation
      )
        throw new Error(
          `${label} staircase destination must be above its source floor.`,
        );
    }
    if (element.stairs !== undefined && element.kind !== 'stairs')
      throw new Error(`${label} has stair settings but is not a staircase.`);
    const attachment =
      element.wallAttachment === undefined
        ? undefined
        : record(element.wallAttachment, `${label} wall attachment`);
    if (
      element.floorEdge !== undefined &&
      (element.kind !== 'wall' ||
        typeof element.floorEdge !== 'number' ||
        !Number.isInteger(element.floorEdge) ||
        element.floorEdge < 0 ||
        element.floorEdge > 31)
    )
      throw new Error(
        `${label} floor edge must be an integer from 0 to 31 on a wall.`,
      );
    return {
      id: uniqueId(element.id, `${label} ID`),
      kind: element.kind as ElementKind,
      name: string(element.name, `${label} name`),
      roomId,
      levelId,
      ...(connectsToLevelId === undefined ? {} : { connectsToLevelId }),
      position: [
        number(position[0], `${label} X position`, -100, 100),
        number(position[1], `${label} height position`, 0, 100),
        number(position[2], `${label} Z position`, -100, 100),
      ],
      rotation: number(element.rotation, `${label} rotation`, -360, 360),
      dimensions: {
        width: number(dimensions.width, `${label} width`, 0.01, 100),
        height: number(dimensions.height, `${label} height`, 0.01, 100),
        depth: number(dimensions.depth, `${label} depth`, 0.01, 100),
      },
      color: color(element.color, `${label} color`),
      material: element.material as Material,
      visible: boolean(element.visible, `${label} visibility`),
      locked: boolean(element.locked, `${label} lock state`),
      ...(element.apertureOnly === true ? { apertureOnly: true } : {}),
      ...(element.fullHeight === true ? { fullHeight: true } : {}),
      ...(element.doorSwing === -1 || element.doorSwing === 1 ? { doorSwing: element.doorSwing } : {}),
      ...(element.doorSide === -1 || element.doorSide === 1 ? { doorSide: element.doorSide } : {}),
      ...(element.kind === 'stairs'
        ? { stairs: stairConfig(element.stairs, label) }
        : {}),
      ...(attachment
        ? {
            wallAttachment: {
              wallId: string(attachment.wallId, `${label} attached wall ID`),
              offset: number(
                attachment.offset,
                `${label} wall offset`,
                -100,
                100,
              ),
            },
          }
        : {}),
      ...(element.floorEdge !== undefined
        ? { floorEdge: element.floorEdge as number }
        : {}),
    };
  });
  const byId = new Map(elements.map((element) => [element.id, element]));
  for (const element of elements) {
    if (element.connectsToLevelId) {
      const source = byLevelId.get(element.levelId!)!;
      const destination = byLevelId.get(element.connectsToLevelId)!;
      const rise =
        destination.elevation - source.elevation - element.position[1];
      if (rise <= 0)
        throw new Error(
          `Staircase "${element.name}" must start below destination floor "${destination.name}". Lower its base or unlink its destination floor.`,
        );
      if (Math.abs(element.dimensions.height - rise) > 1e-6)
        throw new Error(
          `Staircase "${element.name}" has a rise that does not reach destination floor "${destination.name}". Set its rise to ${Number(rise.toFixed(6))} m or unlink its destination floor before importing.`,
        );
    }
    if (!element.wallAttachment) continue;
    const wall = byId.get(element.wallAttachment.wallId);
    if (!wall || wall.kind !== 'wall')
      throw new Error(
        `Element "${element.name}" must attach to an existing wall.`,
      );
    if (wall.levelId !== element.levelId)
      throw new Error(
        `Element "${element.name}" must attach to a wall on the same floor.`,
      );
    const visited = new Set([element.id]);
    let target: HomeElement | undefined = wall;
    while (target) {
      if (visited.has(target.id))
        throw new Error('Wall attachments cannot contain circular references.');
      visited.add(target.id);
      target = target.wallAttachment
        ? byId.get(target.wallAttachment.wallId)
        : undefined;
    }
  }
  const project: Project = {
    version: 1,
    name,
    rooms,
    elements,
    floorPlan,
    levels,
    activeLevelId,
  };
  const routes =
    input.connections === undefined
      ? getConnections(project)
      : input.connections;
  if (!Array.isArray(routes) || routes.length > 2000)
    throw new Error(
      'Project must contain no more than 2000 utility connections.',
    );
  const connections: UtilityConnection[] = routes.map((value, index) => {
    const label = `Connection ${index + 1}`;
    const route = record(value, label);
    const system = choice(
      route.system,
      ['electrical', 'plumbing'] as const,
      `${label} system`,
    );
    const fromId = string(route.fromId, `${label} source ID`),
      toId = string(route.toId, `${label} destination ID`);
    if (fromId === toId)
      throw new Error(`${label} must connect two different elements.`);
    for (const id of [fromId, toId]) {
      const endpoint = byId.get(id);
      if (!endpoint || !isConnectionEndpoint(endpoint, system))
        throw new Error(
          `${label} references a missing or incompatible ${system} endpoint.`,
        );
    }
    if (!Array.isArray(route.waypoints) || route.waypoints.length > 30)
      throw new Error(`${label} can contain no more than 30 route bends.`);
    if (typeof route.label !== 'string' || route.label.length > 100)
      throw new Error(
        `${label} label must be text with no more than 100 characters.`,
      );
    const waypoints: [number, number, number][] = route.waypoints.map(
      (value, pointIndex) => {
        const point = tuple(value, 3, `${label} bend ${pointIndex + 1}`);
        return [
          number(point[0], `${label} bend X`, -100, 100),
          number(point[1], `${label} bend height`, -100, 100),
          number(point[2], `${label} bend Z`, -100, 100),
        ];
      },
    );
    return {
      id: uniqueId(route.id, `${label} ID`),
      name: string(route.name, `${label} name`),
      system,
      fromId,
      toId,
      waypoints,
      enabled: boolean(route.enabled, `${label} enabled state`),
      size: number(route.size, `${label} size in millimetres`, 1, 300),
      label: route.label,
    };
  });
  return { ...project, connections };
}

export function loadProject(fallback: Project): Project {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored) return validateProject(JSON.parse(stored));
  } catch {
    // A damaged or unavailable browser cache must never prevent opening the studio.
  }
  return validateProject(fallback);
}

export function saveProject(project: Project): void {
  const validated = validateProject(project);
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
}

export function downloadProject(project: Project): void {
  const validated = validateProject(project);
  const data = new Blob([JSON.stringify(validated, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${
    validated.name
      .trim()
      .replace(/[^a-z0-9_-]+/gi, '-')
      .toLowerCase() || 'ghar-naksha'
  }.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function matchesStarter(candidate: Project, starter: Project): boolean {
  return JSON.stringify(validateProject(candidate)) === JSON.stringify(validateProject(starter));
}

/** Upgrade the named measured default saved by earlier app versions. */
export function migrateMeasuredDefault(saved: Project, latest: Project): Project {
  const blankStarterName=saved.name==='My new home';
  if (saved.name !== latest.name && !blankStarterName) return saved;
  const living=saved.rooms.find(r=>r.id==='living');
  const temple=saved.elements.find(e=>e.id==='temple');
  const upper=saved.elements.find(e=>e.id==='stair-high-9');
  const fridge=saved.elements.find(e=>e.id==='refrigerator');
  const currentFridge=latest.elements.find(e=>e.id==='refrigerator');
  const emptyDefault=!saved.rooms.length || !saved.elements.some(e=>e.visible);
  const outdated=blankStarterName || emptyDefault || (!!living && !!temple && (
    Math.abs(living.depth-180*.0254)>1e-8 ||
    Math.abs(temple.dimensions.width-24*.0254)>1e-8 ||
    !saved.elements.some(e=>e.id==='temple-kitchen-storage') ||
    (!!upper && upper.position[1]<.01) ||
    (!!fridge && !!currentFridge && Math.abs(fridge.position[2]-currentFridge.position[2])>1e-8)
  ));
  if (!outdated) return saved;
  // A backup is required before replacing any saved model; failure keeps it intact.
  try {
    globalThis.localStorage.setItem('ghar-naksha-before-default-upgrade-v2',JSON.stringify(saved));
  } catch { return saved; }
  return validateProject(structuredClone(latest));
}
