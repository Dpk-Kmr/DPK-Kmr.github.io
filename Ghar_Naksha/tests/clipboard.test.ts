import { describe, expect, it } from 'vitest';
import type { HomeElement, Project, UtilityConnection } from '../src/types';
import { FLOOR_ID } from '../src/types';
import { copyElements, pasteElements } from '../src/lib/clipboard';
import { selectionBounds, transformGroup } from '../src/lib/groupTransforms';
import { syncWallAttachments } from '../src/lib/openings';
import { defaultStairs } from '../src/lib/stairs';

const element = (
  id: string,
  patch: Partial<HomeElement> = {},
): HomeElement => ({
  id,
  kind: 'sofa',
  name: id,
  roomId: 'living',
  position: [0, 0, 0],
  rotation: 0,
  dimensions: { width: 2, depth: 1, height: 0.8 },
  color: '#cccccc',
  material: 'fabric',
  visible: true,
  locked: false,
  ...patch,
});
const route: UtilityConnection = {
  id: 'route',
  name: 'Outlet supply',
  system: 'electrical',
  fromId: 'panel',
  toId: 'outlet',
  waypoints: [
    [0, 0.2, 0],
    [1, 0.2, 0],
  ],
  enabled: true,
  size: 20,
  label: 'Living circuit',
};
const fixture = (): Project => ({
  version: 1,
  name: 'Copy test',
  floorPlan: {
    outline: [
      [-8, -6],
      [8, -6],
      [8, 6],
      [-8, 6],
    ],
    wallHeight: 2.7,
    wallThickness: 0.15,
  },
  rooms: [
    {
      id: 'living',
      name: 'Living',
      subtitle: '',
      center: [0, 0],
      width: 8,
      depth: 6,
      color: '#cccccc',
    },
  ],
  elements: [
    element('wall', {
      kind: 'wall',
      floorEdge: 0,
      dimensions: { width: 6, depth: 0.15, height: 2.7 },
    }),
    element('door', {
      kind: 'door',
      position: [1, 0, 0],
      dimensions: { width: 1, depth: 0.15, height: 2.1 },
      wallAttachment: { wallId: 'wall', offset: 1 },
    }),
    element('panel', { kind: 'electrical-panel', position: [0, 1, 1] }),
    element('outlet', { kind: 'socket', position: [1, 1, 1] }),
    element('sofa', { position: [-2, 0, 2] }),
  ],
  connections: [structuredClone(route)],
});
const applied = (
  project: Project,
  result: NonNullable<ReturnType<typeof transformGroup>>,
) =>
  syncWallAttachments({
    ...project,
    connections: result.connections,
    elements: project.elements.map((element) => ({
      ...element,
      ...result.updates.find((update) => update.id === element.id)?.patch,
    })),
  });

describe('group clipboard', () => {
  it('takes an independent snapshot and excludes partially selected routes', () => {
    const project = fixture();
    expect(copyElements(project, ['missing'])).toBeNull();
    const copied = copyElements(project, ['panel'])!;
    expect(copied.connections).toEqual([]);
    copied.elements[0].dimensions.width = 30;
    expect(project.elements[2].dimensions.width).toBe(2);
    expect(
      copyElements(project, ['panel', 'outlet'])!.connections,
    ).toHaveLength(1);
  });

  it('remaps internal walls and routes, offsets bends, and never reuses IDs across pastes', () => {
    const project = fixture(),
      before = structuredClone(project);
    const bundle = copyElements(project, ['wall', 'door', 'panel', 'outlet'])!;
    const first = pasteElements(project, bundle, [2, -1]);
    const clones = first.project.elements.filter((element) =>
      first.selectedIds.includes(element.id),
    );
    const wall = clones.find((element) => element.kind === 'wall')!,
      door = clones.find((element) => element.kind === 'door')!;
    expect(wall.floorEdge).toBeUndefined();
    expect(door.wallAttachment).toEqual({ wallId: wall.id, offset: 1 });
    expect(door.position).toEqual([3, 0, -1]);
    const copiedRoute = first.project.connections![1];
    expect(copiedRoute.fromId).toBe(
      clones.find((element) => element.kind === 'electrical-panel')!.id,
    );
    expect(copiedRoute.toId).toBe(
      clones.find((element) => element.kind === 'socket')!.id,
    );
    expect(copiedRoute.waypoints).toEqual([
      [2, 0.2, -1],
      [3, 0.2, -1],
    ]);
    const second = pasteElements(first.project, bundle);
    expect(new Set([...first.selectedIds, ...second.selectedIds]).size).toBe(8);
    expect(project).toEqual(before);
    expect(bundle.elements[0].id).toBe('wall');
  });

  it('detaches an opening copied alone and makes copied locked objects editable', () => {
    const project = fixture();
    project.elements[1].locked = true;
    const result = pasteElements(
      project,
      copyElements(project, ['door'])!,
      [1, 2],
    );
    const copied = result.project.elements.at(-1)!;
    expect(copied.wallAttachment).toBeUndefined();
    expect(copied.position).toEqual([2, 0, 2]);
    expect(copied.locked).toBe(false);
  });

  it('pastes into the destination storey and assigns only rooms that contain the object', () => {
    const project = fixture();
    project.activeLevelId = 'first';
    project.rooms[0].levelId = 'ground';
    project.rooms.push({
      ...project.rooms[0],
      id: 'upper-room',
      levelId: 'first',
    });
    for (const item of project.elements) item.levelId = 'ground';
    const result = pasteElements(
      project,
      copyElements(project, ['sofa'])!,
      [0, 0],
    );
    expect(result.project.elements.at(-1)!.levelId).toBe('first');
    expect(result.project.elements.at(-1)!.roomId).toBe('upper-room');
    const outside = pasteElements(
      project,
      copyElements(project, ['sofa'])!,
      [20, 20],
    );
    expect(outside.project.elements.at(-1)!.roomId).toBe(FLOOR_ID);
  });

  it('reconnects a pasted stair only to a storey above its destination', () => {
    const project = fixture();
    project.activeLevelId = 'first';
    project.levels = [
      {
        id: 'ground',
        name: 'Ground',
        elevation: 0,
        floorPlan: project.floorPlan!,
      },
      {
        id: 'first',
        name: 'First',
        elevation: 3,
        floorPlan: project.floorPlan!,
      },
      {
        id: 'second',
        name: 'Second',
        elevation: 6.2,
        floorPlan: project.floorPlan!,
      },
    ];
    project.elements.push(
      element('stairs', {
        kind: 'stairs',
        levelId: 'ground',
        connectsToLevelId: 'first',
        stairs: defaultStairs('straight'),
        position: [0, 0.2, 0],
      }),
    );
    const bundle = copyElements(project, ['stairs'])!;
    const middle = pasteElements(project, bundle, [0, 0]).project.elements.at(
      -1,
    )!;
    expect(middle.levelId).toBe('first');
    expect(middle.connectsToLevelId).toBe('second');
    expect(middle.dimensions.height).toBeCloseTo(3);
    project.activeLevelId = 'second';
    const top = pasteElements(project, bundle, [0, 0]).project.elements.at(-1)!;
    expect(top.connectsToLevelId).toBeUndefined();
    expect(bundle.elements[0].connectsToLevelId).toBe('first');
  });

  it('clamps the whole pasted layout together including manual bends', () => {
    const project = fixture();
    project.connections![0].waypoints = [[99.8, 0.2, 0]];
    const result = pasteElements(
      project,
      copyElements(project, ['panel', 'outlet'])!,
      [10, 2],
    );
    const clones = result.project.elements.slice(-2);
    expect(clones[1].position[0] - clones[0].position[0]).toBeCloseTo(1);
    expect(result.project.connections!.at(-1)!.waypoints[0][0]).toBe(100);
    expect(clones[0].position[0]).toBeCloseTo(0.2);
  });
});

describe('group geometry', () => {
  it('computes true bounds for rotated elements', () => {
    const result = selectionBounds([
      element('chair', { rotation: 90, position: [3, 0, 2] }),
    ])!;
    expect(result.width).toBeCloseTo(1);
    expect(result.depth).toBeCloseTo(2);
    expect(result.center).toEqual([3, 2]);
  });

  it('moves a group once while preserving openings and the relative routes', () => {
    const project = fixture();
    const ids = ['wall', 'door', 'panel', 'outlet'];
    const result = transformGroup(project, ids, {
      kind: 'move',
      delta: [2, 3],
    })!;
    const next = applied(project, result);
    expect(next.elements[0].position).toEqual([2, 0, 3]);
    expect(next.elements[1].position).toEqual([3, 0, 3]);
    expect(next.elements[1].wallAttachment!.wallId).toBe('wall');
    expect(next.connections![0].waypoints).toEqual([
      [2, 0.2, 3],
      [3, 0.2, 3],
    ]);
    expect(next.elements[4]).toEqual(project.elements[4]);
  });

  it('keeps every manually routed bend inside supported coordinates when moving a group', () => {
    const project = fixture();
    project.connections![0].waypoints = [[99.8, 0.2, 0]];
    const result = transformGroup(project, ['panel', 'outlet'], {
      kind: 'move',
      delta: [20, 2],
    })!;
    expect(result.connections[0].waypoints[0][0]).toBe(100);
    expect(
      result.updates[1].patch.position![0] -
        result.updates[0].patch.position![0],
    ).toBe(1);
    expect(result.updates[0].patch.position![0]).toBeCloseTo(0.2);
  });

  it('rotates around the selection center without changing dimensions or attachment offset', () => {
    const project = fixture();
    const result = transformGroup(project, ['wall', 'door'], {
      kind: 'rotate',
      start: [0, -3],
      current: [3, 0],
    })!;
    const next = applied(project, result);
    expect(next.elements[0].rotation).toBe(270);
    expect(next.elements[1].rotation).toBe(270);
    expect(next.elements[1].position[0]).toBeCloseTo(0);
    expect(next.elements[1].position[2]).toBeCloseTo(1);
    expect(next.elements[0].dimensions).toEqual(project.elements[0].dimensions);
  });

  it('scales proportionally with the opposite edge anchored and opening offsets scaled', () => {
    const project = fixture();
    const result = transformGroup(project, ['wall', 'door'], {
      kind: 'resize',
      handle: [1, 0],
      delta: [3, 0],
    })!;
    const next = applied(project, result);
    expect(next.elements[0].dimensions.width).toBe(9);
    expect(next.elements[0].dimensions.depth).toBe(0.225);
    expect(
      next.elements[0].position[0] - next.elements[0].dimensions.width / 2,
    ).toBe(-3);
    expect(next.elements[1].wallAttachment!.offset).toBe(1.5);
    expect(next.elements[1].position[0]).toBe(3);
    expect(next.elements[1].dimensions.height).toBe(2.1);
  });

  it('respects locks and detaches external attachments only on the transformed opening', () => {
    const project = fixture();
    expect(
      transformGroup(project, ['door'], { kind: 'move', delta: [1, 1] })!
        .updates[0].patch.wallAttachment,
    ).toBeUndefined();
    project.elements[0].locked = true;
    expect(
      transformGroup(project, ['wall', 'door'], {
        kind: 'move',
        delta: [1, 1],
      }),
    ).toBeNull();
  });

  it('keeps advanced stair settings within editable limits through extreme scaling', () => {
    const project = fixture();
    project.elements = [
      element('stairs', { kind: 'stairs', stairs: defaultStairs('straight') }),
      element('sofa'),
    ];
    const result = transformGroup(project, ['stairs', 'sofa'], {
      kind: 'resize',
      handle: [1, 1],
      delta: [-100, -100],
    })!;
    const stairs = result.updates[0].patch.stairs!;
    expect(stairs.flightWidth).toBeGreaterThanOrEqual(0.4);
    expect(stairs.innerRadius).toBeGreaterThanOrEqual(0.06);
    expect(stairs.landingDepth).toBeGreaterThanOrEqual(0.4);
  });
});
