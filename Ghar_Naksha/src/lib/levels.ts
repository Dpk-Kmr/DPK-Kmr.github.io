import type { BuildingLevel, HomeElement, Project } from '../types';
import { FLOOR_ID, GROUND_LEVEL_ID } from '../types';
import { getFloorPlan } from './floor';
import { getConnections, removeDanglingConnections } from './connections';
import { createId } from './id';
import { validateProject } from './project';
import { defaultStairs, suggestStepCount } from './stairs';
import { perimeterWalls } from './design';

export { GROUND_LEVEL_ID } from '../types';

/** Floor coordinates stay local; elevation is added only when displaying the building. */
export function getLevels(project: Project): BuildingLevel[] {
  return project.levels?.length
    ? project.levels
    : [
        {
          id: GROUND_LEVEL_ID,
          name: 'Ground floor',
          elevation: 0,
          floorPlan: getFloorPlan(project),
        },
      ];
}

export function getActiveLevel(project: Project): BuildingLevel {
  const levels = getLevels(project);
  return (
    levels.find((level) => level.id === project.activeLevelId) ?? levels[0]
  );
}

function requireLevel(project: Project, levelId: string): BuildingLevel {
  const level = getLevels(project).find((entry) => entry.id === levelId);
  if (!level) throw new Error('That floor no longer exists.');
  return level;
}

export function elementLevelId(project: Project, element: HomeElement): string {
  return (
    element.levelId ??
    project.rooms.find((room) => room.id === element.roomId)?.levelId ??
    getActiveLevel(project).id
  );
}

/** Keep destination metadata so a linked stair remains valid in an active-floor editor. */
export function getLevelProject(project: Project, levelId: string): Project {
  const full = validateProject(project);
  const level = requireLevel(full, levelId);
  const elements = full.elements.filter(
    (element) => element.levelId === levelId,
  );
  const ids = new Set(elements.map((element) => element.id));
  return {
    ...full,
    activeLevelId: levelId,
    floorPlan: structuredClone(level.floorPlan),
    rooms: full.rooms.filter((room) => room.levelId === levelId),
    elements,
    connections: getConnections(full).filter(
      (route) => ids.has(route.fromId) && ids.has(route.toId),
    ),
  };
}

/** Replace just the edited floor. Stale metadata from its projection never overwrites another floor. */
export function mergeLevelProject(
  project: Project,
  edited: Project,
  levelId: string,
): Project {
  const full = validateProject(project);
  requireLevel(full, levelId);
  const oldIds = new Set(
    full.elements
      .filter((element) => element.levelId === levelId)
      .map((element) => element.id),
  );
  const merged: Project = {
    ...full,
    name: edited.name,
    activeLevelId: levelId,
    floorPlan: structuredClone(getFloorPlan(edited)),
    levels: full.levels!.map((level) =>
      level.id === levelId
        ? { ...level, floorPlan: structuredClone(getFloorPlan(edited)) }
        : level,
    ),
    rooms: [
      ...full.rooms.filter((room) => room.levelId !== levelId),
      ...edited.rooms.map((room) => ({ ...structuredClone(room), levelId })),
    ],
    elements: [
      ...full.elements.filter((element) => element.levelId !== levelId),
      ...edited.elements.map((element) => ({
        ...structuredClone(element),
        levelId,
      })),
    ],
    connections: [
      ...getConnections(full).filter(
        (route) => !(oldIds.has(route.fromId) && oldIds.has(route.toId)),
      ),
      ...structuredClone(getConnections(edited)),
    ],
  };
  // Deleting an endpoint intentionally removes its cross-floor routes as well.
  return validateProject(removeDanglingConnections(merged));
}

function nextElevation(project: Project): number {
  const highest = [...getLevels(project)].sort(
    (a, b) => b.elevation - a.elevation,
  )[0];
  return (
    Math.round(
      (highest.elevation + highest.floorPlan.wallHeight + 0.3) * 1000,
    ) / 1000
  );
}

export function addLevel(project: Project, name?: string): Project {
  const full = validateProject(project);
  const source = getActiveLevel(full);
  const id = createId();
  const floorPlan = structuredClone(source.floorPlan);
  const level: BuildingLevel = {
    id,
    name: name ?? `Floor ${full.levels!.length}`,
    elevation: nextElevation(full),
    floorPlan,
  };
  return validateProject({
    ...full,
    activeLevelId: id,
    floorPlan,
    levels: [...full.levels!, level],
    elements: [
      ...full.elements,
      ...perimeterWalls(floorPlan).map((wall) => ({ ...wall, levelId: id })),
    ],
  });
}

export function renameLevel(
  project: Project,
  levelId: string,
  name: string,
): Project {
  requireLevel(project, levelId);
  return validateProject({
    ...project,
    levels: getLevels(project).map((level) =>
      level.id === levelId ? { ...level, name } : level,
    ),
  });
}

/** Fit rise while preserving the chosen stair form, footprint, and other manual settings. */
export function fitStairsToLevel(
  project: Project,
  stairId: string,
  targetLevelId: string,
): Project {
  const full = validateProject(project);
  const stair = full.elements.find((element) => element.id === stairId);
  if (!stair || stair.kind !== 'stairs')
    throw new Error('Select a staircase to connect floors.');
  const source = requireLevel(full, elementLevelId(full, stair));
  const target = requireLevel(full, targetLevelId);
  const rise = target.elevation - source.elevation - stair.position[1];
  if (target.id === source.id || rise < 0.1)
    throw new Error('Choose a destination above the staircase base.');
  if (rise > 100) throw new Error('The staircase rise cannot exceed 100 m.');
  return validateProject({
    ...full,
    elements: full.elements.map((element) =>
      element.id === stairId
        ? {
            ...element,
            connectsToLevelId: targetLevelId,
            dimensions: { ...element.dimensions, height: rise },
            stairs: {
              ...(element.stairs ?? defaultStairs()),
              steps: suggestStepCount(rise),
            },
          }
        : element,
    ),
  });
}

export function setLevelElevation(
  project: Project,
  levelId: string,
  elevation: number,
): Project {
  const full = validateProject(project);
  requireLevel(full, levelId);
  const levels = full.levels!.map((level) =>
    level.id === levelId ? { ...level, elevation } : level,
  );
  const elements = full.elements.map((element) => {
    if (!element.connectsToLevelId) return element;
    const source = levels.find((level) => level.id === element.levelId)!;
    const target = levels.find(
      (level) => level.id === element.connectsToLevelId,
    )!;
    const height = target.elevation - source.elevation - element.position[1];
    if (height < 0.1)
      throw new Error(
        `This elevation would put the destination below staircase "${element.name}". Disconnect it first.`,
      );
    return { ...element, dimensions: { ...element.dimensions, height } };
  });
  return validateProject({ ...full, levels, elements });
}

export function deleteLevel(project: Project, levelId: string): Project {
  const full = validateProject(project);
  requireLevel(full, levelId);
  if (full.levels!.length === 1)
    throw new Error('Keep at least one floor in the building.');
  const levels = full.levels!.filter((level) => level.id !== levelId);
  const active =
    levels.find((level) => level.id === full.activeLevelId) ?? levels[0];
  const next: Project = {
    ...full,
    levels,
    activeLevelId: active.id,
    floorPlan: structuredClone(active.floorPlan),
    rooms: full.rooms.filter((room) => room.levelId !== levelId),
    elements: full.elements
      .filter((element) => element.levelId !== levelId)
      .map((element) => {
        if (element.connectsToLevelId !== levelId) return element;
        const disconnected = { ...element };
        delete disconnected.connectsToLevelId;
        return disconnected;
      }),
  };
  return validateProject(removeDanglingConnections(next));
}

export function cloneLevel(
  project: Project,
  sourceLevelId: string,
  name?: string,
): Project {
  const full = validateProject(project);
  const source = requireLevel(full, sourceLevelId);
  const id = createId();
  const floorPlan = structuredClone(source.floorPlan);
  const rooms = full.rooms.filter((room) => room.levelId === sourceLevelId);
  const elements = full.elements.filter(
    (element) => element.levelId === sourceLevelId,
  );
  const ids = new Map(
    [...rooms, ...elements].map((entity) => [entity.id, createId()]),
  );
  const clonedElements = elements.map((element) => {
    const copy = structuredClone(element);
    // A copy has its own vertical access; retaining the original destination can point downwards.
    delete copy.connectsToLevelId;
    return {
      ...copy,
      id: ids.get(element.id)!,
      levelId: id,
      roomId: element.roomId === FLOOR_ID ? FLOOR_ID : ids.get(element.roomId)!,
      ...(element.wallAttachment
        ? {
            wallAttachment: {
              ...element.wallAttachment,
              wallId: ids.get(element.wallAttachment.wallId)!,
            },
          }
        : {}),
    };
  });
  const routes = getConnections(full)
    .filter((route) => ids.has(route.fromId) && ids.has(route.toId))
    .map((route) => ({
      ...structuredClone(route),
      id: createId(),
      fromId: ids.get(route.fromId)!,
      toId: ids.get(route.toId)!,
    }));
  return validateProject({
    ...full,
    activeLevelId: id,
    floorPlan,
    levels: [
      ...full.levels!,
      {
        id,
        name: name ?? `${source.name} copy`,
        elevation: nextElevation(full),
        floorPlan,
      },
    ],
    rooms: [
      ...full.rooms,
      ...rooms.map((room) => ({
        ...structuredClone(room),
        id: ids.get(room.id)!,
        levelId: id,
      })),
    ],
    elements: [...full.elements, ...clonedElements],
    connections: [...getConnections(full), ...routes],
  });
}
