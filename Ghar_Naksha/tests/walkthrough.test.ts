import { describe, expect, it } from 'vitest';
import type { HomeElement, Project, StairStyle } from '../src/types';
import { STAIR_CATALOG, buildStairGeometry } from '../src/lib/stairs';
import {
  bodyBlocked,
  cameraObstructionFraction,
  makeWalkWorld,
  moveWalker,
  nearbySeat,
  onLevelSurface,
  personHeight,
  seatPose,
  seatedEyeHeight,
  spawnWalker,
  standingEyeHeight,
  standingFromSeat,
  supportAt,
  worldPoint,
  type WalkPosition,
} from '../src/lib/walkthrough';
import { polygonArea, surfacePolygons } from '../src/lib/floorSurfaces';
const floor = {
  outline: [
    [-5, -5],
    [5, -5],
    [5, 5],
    [-5, 5],
  ] as [number, number][],
  wallHeight: 2.7,
  wallThickness: 0.15,
};
function stair(style: StairStyle = 'straight'): HomeElement {
  const item = STAIR_CATALOG.find((item) => item.stairs?.style === style)!;
  return {
    ...item,
    id: 'stair',
    roomId: '__floor__',
    levelId: 'ground-floor',
    connectsToLevelId: 'upper',
    position: [0, 0, 0],
    rotation: 0,
    visible: true,
    locked: false,
  };
}
function project(elements: HomeElement[] = [stair()]): Project {
  return {
    version: 1,
    name: 'Walk test',
    activeLevelId: 'ground-floor',
    floorPlan: floor,
    levels: [
      {
        id: 'ground-floor',
        name: 'Ground floor',
        elevation: 0,
        floorPlan: floor,
      },
      { id: 'upper', name: 'First floor', elevation: 2.8, floorPlan: floor },
    ],
    rooms: [],
    elements,
    connections: [],
  };
}
function walkTo(
  world: ReturnType<typeof makeWalkWorld>,
  start: WalkPosition,
  x: number,
  z: number,
  height = 1.75,
) {
  let position = start;
  for (let i = 0; i < 300; i++) {
    const dx = x - position.x,
      dz = z - position.z,
      distance = Math.hypot(dx, dz);
    if (distance < 0.002) break;
    position = moveWalker(
      world,
      position,
      (dx / distance) * Math.min(distance, 0.04),
      (dz / distance) * Math.min(distance, 0.04),
      height,
    );
  }
  return position;
}
describe('multi-floor walkthrough', () => {
  it('walks up and down actual straight treads without floor teleportation', () => {
    const world = makeWalkWorld(project());
    let p: WalkPosition = { x: 0, z: 2.55, y: 0, levelId: 'ground-floor' };
    const heights = new Set<number>();
    for (let i = 0; i < 260; i++) {
      p = moveWalker(world, p, 0, -0.02, 1.75);
      heights.add(p.y);
    }
    expect(p.z).toBeLessThan(-2.4);
    expect(p.y).toBeCloseTo(2.8);
    expect(p.levelId).toBe('upper');
    expect(heights.size).toBeGreaterThanOrEqual(16);
    for (let i = 0; i < 260; i++) p = moveWalker(world, p, 0, 0.02, 1.75);
    expect(p.z).toBeGreaterThan(2.4);
    expect(p.y).toBe(0);
    expect(p.levelId).toBe('ground-floor');
  });
  for (const style of [
    'straight',
    'floating',
    'l-shaped',
    'u-shaped',
    'spiral',
  ] as StairStyle[])
    it(`supports every ${style} tread at its actual elevation`, () => {
      const element = stair(style),
        world = makeWalkWorld(project([element]));
      const geometry = buildStairGeometry(element);
      for (const tread of geometry.treads) {
        const center = tread.polygon.reduce(
          ([x, z], p) => [
            x + p[0] / tread.polygon.length,
            z + p[1] / tread.polygon.length,
          ],
          [0, 0],
        );
        const support = supportAt(world, center[0], center[1], tread.top);
        expect(support?.y).toBeCloseTo(tread.top);
        expect(support?.stairId).toBe(element.id);
      }
    });
  for (const style of [
    'straight',
    'floating',
    'l-shaped',
    'u-shaped',
    'spiral',
  ] as StairStyle[])
    it(`walks the complete ${style} route up and back down`, () => {
      const element = stair(style),
        world = makeWalkWorld(project([element]));
      const treads = buildStairGeometry(element).treads;
      const centers = treads.map((tread) =>
        tread.polygon.reduce(
          ([x, z], point) =>
            [
              x + point[0] / tread.polygon.length,
              z + point[1] / tread.polygon.length,
            ] as [number, number],
          [0, 0] as [number, number],
        ),
      );
      const entryDirection = [
        centers[0][0] - centers[1][0],
        centers[0][1] - centers[1][1],
      ];
      const entryLength = Math.hypot(...entryDirection);
      const entry = [
        centers[0][0] + (entryDirection[0] / entryLength) * 0.55,
        centers[0][1] + (entryDirection[1] / entryLength) * 0.55,
      ];
      let position: WalkPosition = {
        x: entry[0],
        z: entry[1],
        y: 0,
        levelId: 'ground-floor',
      };
      for (let i = 0; i < centers.length; i++) {
        position = walkTo(world, position, centers[i][0], centers[i][1]);
        expect(position.y, `${style} up tread ${i + 1}`).toBeCloseTo(
          treads[i].top,
        );
      }
      expect(position.y).toBeCloseTo(2.8);
      const last = centers.at(-1)!,
        previous = centers.at(-2)!;
      const exitDirection =
        style === 'spiral'
          ? last
          : [last[0] - previous[0], last[1] - previous[1]];
      const exitLength = Math.hypot(...exitDirection);
      position = walkTo(
        world,
        position,
        last[0] + (exitDirection[0] / exitLength) * 0.7,
        last[1] + (exitDirection[1] / exitLength) * 0.7,
      );
      expect(position.y).toBeCloseTo(2.8);
      expect(position.stairId).toBeUndefined();
      expect(position.levelId).toBe('upper');
      position = walkTo(world, position, last[0], last[1]);
      for (let i = centers.length - 2; i >= 0; i--) {
        position = walkTo(world, position, centers[i][0], centers[i][1]);
        expect(position.y, `${style} down tread ${i + 1}`).toBeCloseTo(
          treads[i].top,
        );
      }
      position = walkTo(world, position, entry[0], entry[1]);
      expect(position.y).toBe(0);
      expect(position.levelId).toBe('ground-floor');
    });
  it('climbs a rotated staircase with floor-local positions and a nonzero source elevation', () => {
    const element = {
      ...stair(),
      rotation: 90,
      position: [1, 0, -0.5] as [number, number, number],
    };
    const source = project([element]);
    source.levels = source.levels!.map((level) => ({
      ...level,
      elevation: level.elevation + 3,
    }));
    const world = makeWalkWorld(source),
      start = worldPoint(element, [0, 2.6]),
      end = worldPoint(element, [0, -2.6]);
    const result = walkTo(
      world,
      { x: start[0], z: start[1], y: 3, levelId: 'ground-floor' },
      end[0],
      end[1],
    );
    expect(result.y).toBeCloseTo(5.8);
    expect(result.levelId).toBe('upper');
  });
  it('does not walk off an upper floor into a stair void or jump between unrelated levels', () => {
    const world = makeWalkWorld(project());
    expect(onLevelSurface(world, world.levels[1], 0, 0)).toBe(false);
    const p = moveWalker(
      world,
      { x: 1, z: 0, y: 2.8, levelId: 'upper' },
      -0.7,
      0,
      1.75,
    );
    expect(p.x).toBeGreaterThan(0.47);
    expect(p.y).toBe(2.8);
    expect(supportAt(world, 3, 3, 1.4)).toBeNull();
  });
  it('checks full person height against doorway lintels and floor ceilings', () => {
    const wall: HomeElement = {
      ...stair(),
      id: 'wall',
      kind: 'wall',
      dimensions: { width: 5, height: 2.7, depth: 0.2 },
      position: [0, 0, 3],
      stairs: undefined,
      connectsToLevelId: undefined,
    };
    const door: HomeElement = {
      ...wall,
      id: 'door',
      kind: 'door',
      dimensions: { width: 1, height: 2.05, depth: 0.2 },
      wallAttachment: { wallId: 'wall', offset: 0 },
    };
    const world = makeWalkWorld(project([wall, door]));
    expect(bodyBlocked(world, 0, 0, 3, 1.75)).toBe(false);
    expect(bodyBlocked(world, 0, 0, 3, 2.15)).toBe(true);
    expect(bodyBlocked(world, 2, 0, 3, 1.75)).toBe(true);
    expect(bodyBlocked(world, 0, 0.5, 0, 2.3)).toBe(true);
    expect(bodyBlocked(world, 0, 2.8, 3, 2.15)).toBe(false);
  });
  it('finds seats only at the current elevation and stands in clear space', () => {
    const sofa: HomeElement = {
      ...stair(),
      id: 'sofa',
      name: 'Family sofa',
      kind: 'sofa',
      stairs: undefined,
      connectsToLevelId: undefined,
      dimensions: { width: 2.2, height: 0.9, depth: 0.95 },
      position: [2, 0, 1],
      rotation: 90,
      levelId: 'upper',
    };
    const world = makeWalkWorld(project([sofa]));
    expect(
      nearbySeat(world, { x: 3, z: 1, y: 0, levelId: 'ground-floor' }),
    ).toBeNull();
    const nearby = nearbySeat(world, { x: 3, z: 1, y: 2.8, levelId: 'upper' });
    expect(nearby?.name).toBe('Family sofa');
    expect(nearby?.seatY).toBeCloseTo(3.34);
    const seated = seatPose(world.seats[0]);
    expect(seated.yaw).toBeCloseTo(Math.PI * 1.5);
    const standing = standingFromSeat(world, seated, 1.8)!;
    expect(standing.levelId).toBe('upper');
    expect(standing.y).toBe(2.8);
    expect(bodyBlocked(world, standing.x, standing.y, standing.z, 1.8)).toBe(
      false,
    );
  });
  it('sets eye heights from user stature and spawns clear of furniture', () => {
    expect(personHeight(1.9)).toBe(1.9);
    expect(standingEyeHeight(1.9)).toBeCloseTo(1.786);
    expect(seatedEyeHeight(1.9)).toBeCloseTo(0.836);
    const world = makeWalkWorld(project());
    const p = spawnWalker(world, 'upper', 1.9, [0, 0]);
    expect(p.y).toBe(2.8);
    expect(onLevelSurface(world, world.levels[1], p.x, p.z)).toBe(true);
  });
  it('stops the person camera before a wall', () => {
    const wall: HomeElement = {
      ...stair(),
      id: 'wall',
      kind: 'wall',
      stairs: undefined,
      connectsToLevelId: undefined,
      position: [0, 0, 1],
      dimensions: { width: 4, height: 2.7, depth: 0.2 },
    };
    const world = makeWalkWorld(project([wall]));
    expect(
      cameraObstructionFraction(world, [0, 1.5, 0], [0, 1.8, 3]),
    ).toBeLessThan(0.3);
    expect(cameraObstructionFraction(world, [0, 1.5, 0], [0, 1.8, -3])).toBe(1);
  });
});
describe('visible floor stair openings', () => {
  const area = (pieces: [number, number][][]) =>
    pieces.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
  it('subtracts a central opening from a floor', () => {
    expect(
      area(
        surfacePolygons(floor.outline, [
          [
            [-1, -2],
            [1, -2],
            [1, 2],
            [-1, 2],
          ],
        ]),
      ),
    ).toBeCloseTo(92);
  });
  it('subtracts room-crossing and overlapping openings without extra gaps', () => {
    expect(
      area(
        surfacePolygons(floor.outline, [
          [
            [4, -1],
            [6, -1],
            [6, 1],
            [4, 1],
          ],
        ]),
      ),
    ).toBeCloseTo(98);
    expect(
      area(
        surfacePolygons(floor.outline, [
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ],
          [
            [0, -1],
            [2, -1],
            [2, 1],
            [0, 1],
          ],
        ]),
      ),
    ).toBeCloseTo(94);
  });
  it('handles concave floor boundaries and rotated openings', () => {
    const outline: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 2],
      [2, 2],
      [2, 4],
      [0, 4],
    ];
    const hole: [number, number][] = [
      [0.5, 1],
      [1, 0.5],
      [1.5, 1],
      [1, 1.5],
    ];
    expect(area(surfacePolygons(outline, [hole]))).toBeCloseTo(11.5);
  });
});
