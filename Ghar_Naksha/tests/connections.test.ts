import { describe, expect, it } from 'vitest';
import type { HomeElement, Project, UtilityConnection } from '../src/types';
import { FLOOR_ID } from '../src/types';
import {
  connectionLength,
  connectionPoints,
  connectionLocalPoints,
  connectionWorldPoints,
  connectionWorldLength,
  changeConnectionEndpoint,
  getConnections,
  removeDanglingConnections,
} from '../src/lib/connections';
import { validateProject } from '../src/lib/project';

const endpoint = (
  id: string,
  kind: HomeElement['kind'],
  position: HomeElement['position'],
): HomeElement => ({
  id,
  kind,
  name: id,
  roomId: FLOOR_ID,
  position,
  rotation: 0,
  dimensions: { width: 0.2, height: 0.2, depth: 0.2 },
  color: '#eeeeee',
  material: 'metal',
  visible: true,
  locked: false,
});
const fixture = (): Project => ({
  version: 1,
  name: 'Services',
  floorPlan: {
    outline: [
      [-1, -1],
      [10, -1],
      [10, 10],
      [-1, 10],
    ],
    wallHeight: 2.7,
    wallThickness: 0.15,
  },
  rooms: [],
  elements: [
    endpoint('panel', 'electrical-panel', [0, 0, 0]),
    endpoint('outlet', 'socket', [3, 0, 4]),
    endpoint('water', 'water-port', [8, 0.3, 1]),
    endpoint('basin', 'sink', [8, 0.9, 8]),
  ],
});
const route = (): UtilityConnection => ({
  id: 'route',
  name: 'Outlet supply',
  system: 'electrical',
  fromId: 'panel',
  toId: 'outlet',
  waypoints: [[3, 0.1, 0]],
  enabled: true,
  size: 20,
  label: 'Kitchen radial',
});

describe('editable utility routes', () => {
  it('migrates legacy defaults once and respects an intentionally empty network', () => {
    const legacy = fixture();
    expect(getConnections(legacy)).toHaveLength(2);
    expect(legacy.connections).toBeUndefined();
    const migrated = validateProject(legacy);
    expect(migrated.connections).toHaveLength(2);
    expect(validateProject(migrated)).toEqual(migrated);
    expect(validateProject({ ...legacy, connections: [] }).connections).toEqual(
      [],
    );
  });

  it('calculates the true polyline length through manual bends and follows moving endpoints', () => {
    const project = fixture();
    expect(connectionPoints(route(), project.elements)).toEqual([
      [0, 0.1, 0],
      [3, 0.1, 0],
      [3, 0.1, 4],
    ]);
    expect(connectionLength(route(), project.elements)).toBe(7);
    project.elements[1].position[2] = 8;
    expect(connectionLength(route(), project.elements)).toBe(11);
    expect(connectionPoints(route(), project.elements)[1]).toEqual([3, 0.1, 0]);
    const auto = connectionPoints(
      { ...route(), waypoints: [] },
      project.elements,
    );
    expect(auto[0]).toEqual([0, 0.1, 0]);
    expect(auto.at(-1)).toEqual([3, 0.1, 8]);
    expect(auto).toContainEqual([3, 0.16, 0]);
  });

  it('preserves enabled state, routing coordinates, size and labels through JSON without aliasing', () => {
    const input = {
      ...fixture(),
      connections: [{ ...route(), enabled: false, size: 32 }],
    };
    const result = validateProject(JSON.parse(JSON.stringify(input)));
    expect(result.connections).toEqual(input.connections);
    result.connections![0].waypoints[0][0] = 9;
    expect(input.connections[0].waypoints[0][0]).toBe(3);
  });

  it.each([
    { toId: 'missing' },
    { toId: 'water' },
    { toId: 'panel' },
    { system: 'gas' },
    { size: 0 },
    { size: Infinity },
    { enabled: 'yes' },
    { name: ' ' },
    { waypoints: [[0, -101, 0]] },
    { waypoints: [[0, 0, NaN]] },
    { waypoints: Array(31).fill([0, 0, 0]) },
    { label: 'x'.repeat(101) },
  ])('rejects malformed imported route %j', (patch) => {
    expect(() =>
      validateProject({
        ...fixture(),
        connections: [{ ...route(), ...patch }],
      }),
    ).toThrow(/Connection|connection/);
  });

  it('rejects duplicate route IDs and excessive connections', () => {
    expect(() =>
      validateProject({
        ...fixture(),
        connections: [{ ...route(), id: 'panel' }],
      }),
    ).toThrow(/Duplicate ID/);
    expect(() =>
      validateProject({ ...fixture(), connections: [route(), route()] }),
    ).toThrow(/Duplicate ID/);
    expect(() =>
      validateProject({ ...fixture(), connections: Array(2001).fill(route()) }),
    ).toThrow(/2000/);
  });

  it('removes dangling routes only when explicitly requested after a deletion', () => {
    const original = validateProject(fixture());
    const deleted = {
      ...original,
      elements: original.elements.filter((element) => element.id !== 'outlet'),
    };
    expect(() => validateProject(deleted)).toThrow(/missing or incompatible/);
    const cleaned = removeDanglingConnections(deleted);
    expect(cleaned.connections).toHaveLength(1);
    expect(cleaned.connections![0].system).toBe('plumbing');
    expect(original.connections).toHaveLength(2);
    expect(connectionPoints(route(), deleted.elements)).toEqual([]);
  });
});

describe('stair and wall metadata imports', () => {
  it('supplies stair defaults and preserves all edited staircase options', () => {
    const project = fixture();
    project.elements.push(endpoint('stair', 'stairs', [2, 0, 2]));
    const result = validateProject(project);
    expect(result.elements.at(-1)!.stairs).toMatchObject({
      style: 'straight',
      steps: 16,
      turnDirection: 'right',
      railing: 'both',
    });
    const stairs = {
      ...result.elements.at(-1)!.stairs!,
      style: 'spiral' as const,
      steps: 24,
      spiralTurns: 1.5,
      nosing: 0.04,
    };
    result.elements.at(-1)!.stairs = stairs;
    expect(validateProject(result).elements.at(-1)!.stairs).toEqual(stairs);
    result.elements.at(-1)!.stairs!.steps = 3.5;
    expect(() => validateProject(result)).toThrow(/whole number/);
    result.elements.at(-1)!.stairs!.steps = 200;
    expect(() => validateProject(result)).toThrow(/steps/);
  });

  it('preserves floor edge and opening attachment metadata, rejecting invalid references and cycles', () => {
    const project = fixture();
    const wall = { ...endpoint('wall', 'wall', [0, 0, 2]), floorEdge: 3 };
    const door = {
      ...endpoint('door', 'door', [0, 0, 2]),
      wallAttachment: { wallId: 'wall', offset: 0.75 },
    };
    project.elements.push(wall, door);
    const result = validateProject(project);
    expect(result.elements.at(-2)!.floorEdge).toBe(3);
    expect(result.elements.at(-1)!.wallAttachment).toEqual(door.wallAttachment);
    door.wallAttachment.wallId = 'outlet';
    expect(() => validateProject(project)).toThrow(/existing wall/);
    door.wallAttachment.wallId = 'wall';
    wall.floorEdge = 32;
    expect(() => validateProject(project)).toThrow(/floor edge/);
    wall.floorEdge = 3;
    Object.assign(wall, { wallAttachment: { wallId: 'wall', offset: 0 } });
    expect(() => validateProject(project)).toThrow(/circular/);
  });
});

describe('utility routes between building floors', () => {
  const building = (): Project => {
    const original = fixture();
    return validateProject({
      ...original,
      levels: [
        {
          id: 'ground-floor',
          name: 'Ground floor',
          elevation: 0,
          floorPlan: original.floorPlan!,
        },
        {
          id: 'upper',
          name: 'First floor',
          elevation: 3,
          floorPlan: original.floorPlan!,
        },
      ],
      activeLevelId: 'ground-floor',
      elements: [
        ...original.elements.map((element) => ({
          ...element,
          levelId: element.id === 'outlet' ? 'upper' : 'ground-floor',
        })),
        {
          ...endpoint('upper-panel', 'electrical-panel', [1, 0, 1]),
          levelId: 'upper',
        },
      ],
      connections: [route()],
    });
  };

  it('uses world elevations for endpoint geometry and total length while keeping manual bends source-local', () => {
    const project = building();
    expect(connectionWorldPoints(route(), project)).toEqual([
      [0, 0.1, 0],
      [3, 0.1, 0],
      [3, 3.1, 4],
    ]);
    expect(connectionWorldLength(route(), project)).toBe(8);
    const reversed = {
      ...route(),
      fromId: 'outlet',
      toId: 'panel',
      waypoints: [[3, -2.9, 0] as [number, number, number]],
    };
    const points = connectionWorldPoints(reversed, project);
    expect(points[0]).toEqual([3, 3.1, 4]);
    expect(points[1][1]).toBeCloseTo(0.1);
    expect(points.at(-1)![1]).toBeCloseTo(0.1);
    expect(points.at(-1)![0]).toBe(0);
    expect(points.at(-1)![2]).toBe(0);
    expect(connectionLocalPoints(reversed, project).at(-1)![1]).toBeCloseTo(
      -2.9,
    );
    expect(
      validateProject({ ...project, connections: [reversed] }).connections![0]
        .waypoints,
    ).toEqual(reversed.waypoints);
  });

  it('preserves manual bends in world space when changing the source floor, without changing the original route', () => {
    const project = building();
    const original = route();
    const changed = changeConnectionEndpoint(
      project,
      original,
      'fromId',
      'upper-panel',
    );
    expect(changed.waypoints[0][1]).toBeCloseTo(-2.9);
    expect(connectionWorldPoints(changed, project)[1][1]).toBeCloseTo(
      connectionWorldPoints(original, project)[1][1],
    );
    expect(original.waypoints[0][1]).toBe(0.1);
    expect(
      changeConnectionEndpoint(project, original, 'toId', 'upper-panel')
        .waypoints,
    ).toEqual(original.waypoints);
    expect(() =>
      changeConnectionEndpoint(project, original, 'fromId', 'outlet'),
    ).toThrow(/different connection points/);
    expect(() =>
      changeConnectionEndpoint(project, original, 'toId', 'basin'),
    ).toThrow(/compatible/);
  });

  it('automatically routes from the source floor datum and updates when elevations change', () => {
    const project = building();
    const auto = { ...route(), waypoints: [] };
    expect(connectionWorldPoints(auto, project)).toContainEqual([3, 0.16, 4]);
    expect(connectionWorldLength(auto, project)).toBeCloseTo(10);
    project.levels![1].elevation = 4;
    expect(connectionWorldPoints(auto, project).at(-1)![1]).toBeCloseTo(4.1);
    expect(connectionWorldLength(auto, project)).toBeCloseTo(11);
    expect(
      connectionWorldPoints({ ...auto, toId: 'missing' }, project),
    ).toEqual([]);
  });
});
