import { describe, expect, it } from 'vitest';
import type { FloorPlan, Project, Room } from '../src/types';
import { FLOOR_ID } from '../src/types';
import {
  containsPoint,
  findRoomPlacement,
  floorArea,
  floorBounds,
  getFloorPlan,
  resizeFloor,
  roomFitsFloor,
  validateFloorPlan,
} from '../src/lib/floor';
import { validateProject } from '../src/lib/project';

const floor = (
  outline: FloorPlan['outline'] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
): FloorPlan => ({ outline, wallHeight: 2.7, wallThickness: 0.15 });
const room = (patch: Partial<Room> = {}): Room => ({
  id: 'room',
  name: 'Living',
  subtitle: '',
  center: [2.5, 5],
  width: 5,
  depth: 10,
  color: '#eeece6',
  ...patch,
});
const project = (rooms: Room[] = []): Project => ({
  version: 1,
  name: 'Outline first',
  floorPlan: floor(),
  rooms,
  elements: [],
  connections: [],
});

describe('floor perimeter validation', () => {
  it('keeps a floor-only project editable and round-trips it without inventing rooms or connections', () => {
    const original = project();
    const result = validateProject(JSON.parse(JSON.stringify(original)));
    expect(result).toEqual(validateProject(original));
    expect(result.rooms).toHaveLength(0);
    result.floorPlan!.outline[0][0] = -1;
    expect(original.floorPlan!.outline[0][0]).toBe(0);
    expect(() =>
      validateProject({ ...original, floorPlan: undefined }),
    ).toThrow(/without rooms/);
  });

  it('migrates a legacy room project to its bounding perimeter', () => {
    const legacy = {
      ...project([room()]),
      floorPlan: undefined,
      connections: undefined,
    };
    const migrated = validateProject(legacy);
    expect(migrated.floorPlan!.outline).toEqual([
      [0, 0],
      [5, 0],
      [5, 10],
      [0, 10],
    ]);
    expect(floorArea(getFloorPlan(migrated))).toBe(50);
    expect(migrated.connections).toEqual([]);
  });

  it('computes polygon area and extents in either winding direction', () => {
    const triangle = floor([
      [-2, -1],
      [6, -1],
      [2, 5],
    ]);
    expect(floorArea(triangle)).toBe(24);
    expect(
      floorArea({ ...triangle, outline: [...triangle.outline].reverse() }),
    ).toBe(24);
    expect(floorBounds(triangle)).toEqual({
      minX: -2,
      maxX: 6,
      minZ: -1,
      maxZ: 5,
      width: 8,
      depth: 6,
      centerX: 2,
      centerZ: 2,
    });
  });

  it.each(
    [
      [
        [0, 0],
        [4, 4],
        [0, 4],
        [4, 0],
      ],
      [
        [0, 0],
        [5, 0],
        [5, 5],
        [2, 0],
        [0, 5],
      ],
      [
        [0, 0],
        [5, 0],
        [3, 0],
        [5, 5],
        [0, 5],
      ],
      [
        [0, 0],
        [5, 0],
        [5, 5],
        [0, 0],
      ],
    ].map((outline) => [outline]),
  )('rejects crossing, touching or folded polygon %j', (outline) => {
    expect(() =>
      validateFloorPlan(floor(outline as FloorPlan['outline'])),
    ).toThrow(/cross|touch|fold|overlap|side/);
  });

  it('rejects non-finite points, holes, short sides, tiny area and invalid wall sizes', () => {
    expect(() =>
      validateFloorPlan(
        floor([
          [0, 0],
          [Infinity, 0],
          [0, 5],
        ]),
      ),
    ).toThrow(/finite/);
    expect(() =>
      validateFloorPlan(
        floor([
          [0, 0],
          [101, 0],
          [0, 5],
        ]),
      ),
    ).toThrow(/100/);
    expect(() =>
      validateFloorPlan(
        floor([
          [0, 0],
          [0.01, 0],
          [3, 4],
        ]),
      ),
    ).toThrow(/side/);
    expect(() =>
      validateFloorPlan(
        floor([
          [0, 0],
          [1, 0],
          [0, 1],
        ]),
      ),
    ).toThrow(/area/);
    expect(() => validateFloorPlan({ ...floor(), holes: [] })).toThrow(
      /without holes/,
    );
    expect(() => validateFloorPlan({ ...floor(), wallHeight: NaN })).toThrow(
      /height/,
    );
    expect(() => validateFloorPlan({ ...floor(), wallThickness: 0 })).toThrow(
      /thickness/,
    );
  });
});

describe('containment and room placement', () => {
  const notched = floor([
    [0, 0],
    [6, 0],
    [6, 6],
    [4, 6],
    [4, 2],
    [2, 2],
    [2, 6],
    [0, 6],
  ]);
  it('includes boundary points while excluding the concave cutout', () => {
    expect(containsPoint(notched, [1, 4])).toBe(true);
    expect(containsPoint(notched, [2, 4])).toBe(true);
    expect(containsPoint(notched, [3, 4])).toBe(false);
    expect(containsPoint(notched, [7, 4])).toBe(false);
  });

  it('rejects a room crossing a notch even when all four corners lie inside the outline', () => {
    const candidate = room({ center: [3, 4], width: 6, depth: 4 });
    for (const corner of [
      [0, 2],
      [6, 2],
      [6, 6],
      [0, 6],
    ] as [number, number][])
      expect(containsPoint(notched, corner)).toBe(true);
    expect(roomFitsFloor(notched, candidate)).toBe(false);
    expect(
      roomFitsFloor(notched, room({ center: [1, 3], width: 2, depth: 6 })),
    ).toBe(true);
    expect(() =>
      validateProject({ ...project([candidate]), floorPlan: notched }),
    ).toThrow(/outside the floor/);
  });

  it('finds available floor space without overlapping an existing room', () => {
    const layout = project([room()]);
    expect(findRoomPlacement(layout, 5, 10)).toEqual([7.5, 5]);
    expect(findRoomPlacement(layout, 6, 10)).toBeNull();
    expect(findRoomPlacement(layout, NaN, 4)).toBeNull();
    expect(findRoomPlacement(project(), 10, 10)).toEqual([5, 5]);
  });

  it('never places a room in a polygon cutout', () => {
    const layout = { ...project(), floorPlan: notched };
    const center = findRoomPlacement(layout, 2, 4);
    expect(center).not.toBeNull();
    expect(
      roomFitsFloor(notched, { center: center!, width: 2, depth: 4 }),
    ).toBe(true);
    expect(findRoomPlacement(layout, 3, 4)).toBeNull();
  });
});

describe('floor changes preserve the design', () => {
  it('rejects clipping in keep mode without mutating the existing project', () => {
    const original = project([room()]);
    const before = structuredClone(original);
    expect(() =>
      resizeFloor(
        original,
        floor([
          [0, 0],
          [3, 0],
          [3, 10],
          [0, 10],
        ]),
        'keep',
      ),
    ).toThrow(/cut through/);
    expect(original).toEqual(before);
    const result = resizeFloor(
      original,
      floor([
        [-1, -1],
        [11, -1],
        [11, 11],
        [-1, 11],
      ]),
      'keep',
    );
    expect(result.rooms).toEqual(original.rooms);
    expect(result.rooms).not.toBe(original.rooms);
  });

  it('scales rooms, editable elements and bends together while keeping heights and IDs', () => {
    const original = project([room()]);
    original.elements = [
      {
        id: 'item',
        kind: 'sofa',
        name: 'Sofa',
        roomId: 'room',
        position: [2, 0.5, 3],
        rotation: 0,
        dimensions: { width: 2, height: 0.8, depth: 1 },
        color: '#e4dfd1',
        material: 'fabric',
        visible: true,
        locked: false,
      },
    ];
    original.connections = [
      {
        id: 'route',
        name: 'Draft route',
        system: 'electrical',
        fromId: 'a',
        toId: 'b',
        enabled: true,
        waypoints: [[2, 1, 3]],
        size: 20,
        label: 'Keep me',
      },
    ];
    const scaled = resizeFloor(
      original,
      floor([
        [0, 0],
        [20, 0],
        [20, 20],
        [0, 20],
      ]),
      'scale',
    );
    expect(scaled.rooms[0].center).toEqual([5, 10]);
    expect(scaled.elements[0]).toMatchObject({
      id: 'item',
      position: [4, 0.5, 6],
      dimensions: { width: 4, height: 0.8, depth: 2 },
    });
    expect(scaled.connections![0]).toMatchObject({
      label: 'Keep me',
      waypoints: [[4, 1, 6]],
    });
    expect(original.elements[0].position).toEqual([2, 0.5, 3]);
  });

  it('supports elements on the overall floor without a room', () => {
    const empty = project();
    empty.elements = [
      {
        id: 'loose',
        kind: 'plant',
        name: 'Tree',
        roomId: FLOOR_ID,
        position: [2, 0, 2],
        rotation: 0,
        dimensions: { width: 1, height: 2, depth: 1 },
        color: '#80946c',
        material: 'ceramic',
        visible: true,
        locked: false,
      },
    ];
    expect(validateProject(empty).elements[0].roomId).toBe(FLOOR_ID);
  });

  it('scales an opening offset along the parent wall axis even when the opening has a different rotation', () => {
    const original = project();
    const wall = {
      id: 'wall',
      kind: 'wall' as const,
      name: 'Wall',
      roomId: FLOOR_ID,
      position: [2, 0, 3] as [number, number, number],
      rotation: 0,
      dimensions: { width: 0.15, height: 2.7, depth: 6 },
      color: '#eeeeee',
      material: 'plaster' as const,
      visible: true,
      locked: true,
    };
    original.elements = [
      wall,
      {
        ...wall,
        id: 'door',
        kind: 'door',
        dimensions: { width: 0.9, height: 2.1, depth: 0.15 },
        locked: false,
        wallAttachment: { wallId: 'wall', offset: 1 },
      },
    ];
    const scaled = resizeFloor(
      original,
      floor([
        [0, 0],
        [20, 0],
        [20, 30],
        [0, 30],
      ]),
      'scale',
    );
    expect(scaled.elements[1].wallAttachment!.offset).toBe(3);
  });
});
