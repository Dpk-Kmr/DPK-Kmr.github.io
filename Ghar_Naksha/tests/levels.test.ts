import { describe, expect, it } from 'vitest';
import { FLOOR_ID, GROUND_LEVEL_ID } from '../src/types';
import type { HomeElement, Project, UtilityConnection } from '../src/types';
import { validateProject } from '../src/lib/project';
import {
  addLevel,
  cloneLevel,
  deleteLevel,
  fitStairsToLevel,
  getActiveLevel,
  getLevelProject,
  getLevels,
  mergeLevelProject,
  renameLevel,
  setLevelElevation,
} from '../src/lib/levels';

const element = (
  id: string,
  kind: HomeElement['kind'],
  patch: Partial<HomeElement> = {},
): HomeElement => ({
  id,
  kind,
  name: id,
  roomId: 'living',
  position: [0, 0, 0],
  rotation: 0,
  dimensions: { width: 1, height: 1, depth: 1 },
  color: '#aaaaaa',
  material: 'wood',
  visible: true,
  locked: false,
  ...patch,
});
const route = (
  id: string,
  fromId: string,
  toId: string,
): UtilityConnection => ({
  id,
  name: id,
  fromId,
  toId,
  system: 'electrical',
  waypoints: [[1, 0.2, 1]],
  enabled: true,
  size: 20,
  label: 'test cable',
});
const legacy = (): Project => ({
  version: 1,
  name: 'Two storeys',
  floorPlan: {
    outline: [
      [-5, -5],
      [5, -5],
      [5, 5],
      [-5, 5],
    ],
    wallHeight: 2.7,
    wallThickness: 0.15,
  },
  rooms: [
    {
      id: 'living',
      name: 'Living room',
      subtitle: '',
      center: [0, 0],
      width: 6,
      depth: 6,
      color: '#aaaaaa',
    },
  ],
  elements: [
    element('sofa', 'sofa'),
    element('wall', 'wall'),
    element('window', 'window', {
      wallAttachment: { wallId: 'wall', offset: 0.2 },
    }),
    element('panel', 'electrical-panel'),
    element('socket', 'socket'),
    element('stairs', 'stairs'),
  ],
  connections: [route('cable', 'panel', 'socket')],
});
const twoFloors = (): Project => {
  const full = addLevel(legacy(), 'First floor');
  const upper = full.activeLevelId!;
  return validateProject({
    ...full,
    elements: [
      ...full.elements,
      element('upper-socket', 'socket', { roomId: FLOOR_ID, levelId: upper }),
    ],
    connections: [
      ...full.connections!,
      route('riser', 'panel', 'upper-socket'),
    ],
  });
};

describe('building floor migration', () => {
  it('migrates a legacy home without shifting any local coordinates and isolates returned metadata', () => {
    const original = legacy();
    const migrated = validateProject(original);
    expect(migrated.activeLevelId).toBe(GROUND_LEVEL_ID);
    expect(migrated.levels).toEqual([
      {
        id: GROUND_LEVEL_ID,
        name: 'Ground floor',
        elevation: 0,
        floorPlan: original.floorPlan,
      },
    ]);
    expect(
      migrated.rooms.every((room) => room.levelId === GROUND_LEVEL_ID),
    ).toBe(true);
    expect(
      migrated.elements.every((entry) => entry.levelId === GROUND_LEVEL_ID),
    ).toBe(true);
    expect(migrated.elements[0].position).toEqual(
      original.elements[0].position,
    );
    migrated.levels![0].floorPlan.outline[0][0] = -8;
    expect(original.floorPlan!.outline[0][0]).toBe(-5);
    expect(migrated.floorPlan!.outline[0][0]).toBe(-5);
    expect(getLevels(original)[0].id).toBe(GROUND_LEVEL_ID);
    expect(original.levels).toBeUndefined();
  });

  it('accepts an empty multi-floor building without a redundant top-level outline', () => {
    const empty = validateProject({
      ...legacy(),
      floorPlan: undefined,
      rooms: [],
      elements: [],
      connections: [],
      levels: [
        {
          id: 'basement',
          name: 'Basement',
          elevation: -3,
          floorPlan: legacy().floorPlan,
        },
      ],
    });
    expect(empty.activeLevelId).toBe('basement');
    expect(empty.floorPlan).toEqual(empty.levels![0].floorPlan);
    expect(getActiveLevel(empty).elevation).toBe(-3);
  });

  it('uses each room’s own outline even when a different floor is active', () => {
    const full = twoFloors();
    full.levels![0].floorPlan.outline = [
      [-2, -2],
      [2, -2],
      [2, 2],
      [-2, 2],
    ];
    expect(() => validateProject(full)).toThrow(/outside the floor outline/);
  });

  it('rejects missing and cross-floor room, attachment, active-floor, and stair references', () => {
    const full = twoFloors();
    const invalid = (mutate: (input: Project) => void, message: RegExp) => {
      const input = structuredClone(full);
      mutate(input);
      expect(() => validateProject(input)).toThrow(message);
    };
    invalid((input) => {
      input.rooms[0].levelId = 'missing';
    }, /floor that does not exist/);
    invalid((input) => {
      input.elements[0].levelId = input.activeLevelId;
    }, /same floor/);
    invalid((input) => {
      input.elements.find((e) => e.id === 'window')!.wallAttachment!.wallId =
        input.elements.find(
          (e) => e.levelId === input.activeLevelId && e.kind === 'wall',
        )!.id;
    }, /same floor/);
    invalid((input) => {
      input.activeLevelId = 'missing';
    }, /active floor/);
    invalid((input) => {
      input.elements.find((e) => e.id === 'stairs')!.connectsToLevelId =
        'missing';
    }, /destination floor/);
    invalid((input) => {
      input.elements[0].connectsToLevelId = input.activeLevelId;
    }, /not a staircase/);
    invalid((input) => {
      input.levels![1].id = input.levels![0].id;
    }, /floor ID/);
  });

  it('generates legacy default utility networks independently on each floor', () => {
    const full = cloneLevel(legacy(), GROUND_LEVEL_ID);
    full.connections = undefined;
    const result = validateProject(full);
    expect(result.connections).toHaveLength(2);
    for (const connection of result.connections!) {
      expect(
        result.elements.find((e) => e.id === connection.fromId)!.levelId,
      ).toBe(result.elements.find((e) => e.id === connection.toId)!.levelId);
    }
  });
});

describe('active-floor editing', () => {
  it('filters entities and local routes, retaining destination metadata for linked stair editors', () => {
    const building = twoFloors();
    const full = fitStairsToLevel(building, 'stairs', building.activeLevelId!);
    const view = getLevelProject(full, GROUND_LEVEL_ID);
    expect(view.levels).toHaveLength(2);
    expect(view.elements.some((entry) => entry.id === 'upper-socket')).toBe(
      false,
    );
    expect(
      validateProject(view).elements.find((entry) => entry.id === 'stairs')!
        .connectsToLevelId,
    ).toBe(building.activeLevelId);
  });

  it('merges only active content and outline, preserving inactive edits and cross-floor routes', () => {
    const full = twoFloors();
    const view = getLevelProject(full, GROUND_LEVEL_ID);
    expect(
      view.elements.every((entry) => entry.levelId === GROUND_LEVEL_ID),
    ).toBe(true);
    expect(view.connections!.map((entry) => entry.id)).toEqual(['cable']);
    view.elements.find((entry) => entry.id === 'sofa')!.dimensions.width = 2.25;
    view.floorPlan!.outline[0][0] = -6;
    view.levels![1].name = 'stale overwrite';
    const merged = mergeLevelProject(full, view, GROUND_LEVEL_ID);
    expect(
      merged.elements.find((entry) => entry.id === 'sofa')!.dimensions.width,
    ).toBe(2.25);
    expect(merged.levels![0].floorPlan.outline[0][0]).toBe(-6);
    expect(merged.levels![1].name).toBe('First floor');
    expect(
      merged.elements.find((entry) => entry.id === 'upper-socket'),
    ).toEqual(full.elements.find((entry) => entry.id === 'upper-socket'));
    expect(merged.connections!.map((entry) => entry.id).sort()).toEqual([
      'cable',
      'riser',
    ]);
    expect(
      full.elements.find((entry) => entry.id === 'sofa')!.dimensions.width,
    ).toBe(1);
  });

  it('stamps newly added rooms and elements to the active floor and removes deleted endpoint routes', () => {
    const full = twoFloors();
    const view = getLevelProject(full, full.activeLevelId!);
    view.rooms.push({ ...legacy().rooms[0], id: 'new-room' });
    view.elements = view.elements.filter(
      (entry) => entry.id !== 'upper-socket',
    );
    view.elements.push(element('new-bed', 'bed', { roomId: 'new-room' }));
    const merged = mergeLevelProject(full, view, full.activeLevelId!);
    expect(merged.rooms.find((room) => room.id === 'new-room')!.levelId).toBe(
      full.activeLevelId,
    );
    expect(
      merged.elements.find((entry) => entry.id === 'new-bed')!.levelId,
    ).toBe(full.activeLevelId);
    expect(merged.connections!.map((entry) => entry.id)).toEqual(['cable']);
  });
});

describe('floor management and stair destinations', () => {
  it('adds above the highest floor, keeps IDs stable, and permits basement elevations', () => {
    const added = addLevel(legacy());
    expect(getActiveLevel(added).elevation).toBe(3);
    expect(
      added.elements.filter((entry) => entry.levelId === added.activeLevelId),
    ).toHaveLength(4);
    const basement = setLevelElevation(added, added.activeLevelId!, -3.2);
    expect(getActiveLevel(basement).elevation).toBe(-3.2);
    const renamed = renameLevel(basement, GROUND_LEVEL_ID, 'Entry');
    expect(renamed.levels![0].id).toBe(GROUND_LEVEL_ID);
    expect(renamed.levels![0].name).toBe('Entry');
  });

  it('clones independent rooms, elements, attachments, and local routes with remapped IDs', () => {
    const original = validateProject(legacy());
    const cloned = cloneLevel(original, GROUND_LEVEL_ID);
    const view = getLevelProject(cloned, cloned.activeLevelId!);
    expect(view.rooms).toHaveLength(1);
    expect(view.elements).toHaveLength(original.elements.length);
    expect(view.rooms[0].id).not.toBe('living');
    expect(
      view.elements.every((entry) => entry.roomId === view.rooms[0].id),
    ).toBe(true);
    const wall = view.elements.find((entry) => entry.kind === 'wall')!;
    expect(
      view.elements.find((entry) => entry.kind === 'window')!.wallAttachment!
        .wallId,
    ).toBe(wall.id);
    expect(view.connections![0].fromId).toBe(
      view.elements.find((entry) => entry.kind === 'electrical-panel')!.id,
    );
    expect(view.connections![0].id).not.toBe('cable');
    view.elements[0].position[0] = 99;
    view.connections![0].waypoints[0][0] = 99;
    expect(original.elements[0].position[0]).toBe(0);
    expect(original.connections![0].waypoints[0][0]).toBe(1);
    expect(validateProject(JSON.parse(JSON.stringify(cloned)))).toEqual(cloned);
  });

  it('fits connected stairs and updates their rise when a floor elevation changes', () => {
    const full = twoFloors();
    const linked = fitStairsToLevel(full, 'stairs', full.activeLevelId!);
    const stair = linked.elements.find((entry) => entry.id === 'stairs')!;
    expect(stair.dimensions.height).toBe(3);
    expect(stair.connectsToLevelId).toBe(full.activeLevelId);
    const view = getLevelProject(linked, GROUND_LEVEL_ID);
    expect(
      validateProject(view).elements.find((entry) => entry.id === 'stairs')!
        .connectsToLevelId,
    ).toBe(full.activeLevelId);
    expect(
      setLevelElevation(linked, full.activeLevelId!, 3.6).elements.find(
        (entry) => entry.id === 'stairs',
      )!.dimensions.height,
    ).toBe(3.6);
    expect(() => setLevelElevation(linked, full.activeLevelId!, -1)).toThrow(
      /destination below/,
    );
    expect(() => fitStairsToLevel(full, 'stairs', GROUND_LEVEL_ID)).toThrow(
      /destination above/,
    );
  });

  it('removes a floor with its contents and incident routes, disconnects stairs, and retains one floor', () => {
    const full = twoFloors();
    const linked = fitStairsToLevel(full, 'stairs', full.activeLevelId!);
    const removed = deleteLevel(linked, full.activeLevelId!);
    expect(removed.levels).toHaveLength(1);
    expect(removed.activeLevelId).toBe(GROUND_LEVEL_ID);
    expect(removed.elements.some((entry) => entry.id === 'upper-socket')).toBe(
      false,
    );
    expect(removed.connections!.map((entry) => entry.id)).toEqual(['cable']);
    expect(
      removed.elements.find((entry) => entry.id === 'stairs'),
    ).not.toHaveProperty('connectsToLevelId');
    expect(() => deleteLevel(removed, GROUND_LEVEL_ID)).toThrow(
      /at least one floor/,
    );
  });
});

describe('linked stair import integrity', () => {
  it('rejects a linked rise that misses its destination and a base at or above the destination', () => {
    const full = twoFloors();
    const linked = fitStairsToLevel(full, 'stairs', full.activeLevelId!);
    const mismatched = structuredClone(linked);
    mismatched.elements.find(
      (element) => element.id === 'stairs',
    )!.dimensions.height = 2.9;
    expect(() => validateProject(mismatched)).toThrow(
      /rise.*does not reach.*Set its rise to 3 m or unlink/,
    );
    for (const base of [3, 3.2]) {
      const elevated = structuredClone(linked);
      elevated.elements.find(
        (element) => element.id === 'stairs',
      )!.position[1] = base;
      expect(() => validateProject(elevated)).toThrow(
        /must start below.*Lower its base or unlink/,
      );
    }
  });

  it('preserves arbitrary manual rise and base height when a stair is unlinked', () => {
    const full = twoFloors();
    const manual = full.elements.find((element) => element.id === 'stairs')!;
    manual.dimensions.height = 8.125;
    manual.position[1] = 4.625;
    const imported = validateProject(JSON.parse(JSON.stringify(full)));
    expect(
      imported.elements.find((element) => element.id === 'stairs'),
    ).toEqual(manual);
  });

  it('allows floating-point roundoff without silently changing imported stair dimensions', () => {
    const full = twoFloors();
    const linked = fitStairsToLevel(full, 'stairs', full.activeLevelId!);
    const stair = linked.elements.find((element) => element.id === 'stairs')!;
    stair.position[1] = 0.35;
    stair.dimensions.height = 2.65 + 0.0000005;
    expect(
      validateProject(linked).elements.find(
        (element) => element.id === 'stairs',
      )!.dimensions.height,
    ).toBe(stair.dimensions.height);
    stair.dimensions.height = 2.65 + 0.000002;
    expect(() => validateProject(linked)).toThrow(/rise.*does not reach/);
  });
});
