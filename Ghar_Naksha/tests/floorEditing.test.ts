import { describe, expect, it } from 'vitest';
import { dragFloorCorner, dragFloorSide } from '../src/lib/floorEditing';
import { validateFloorPlan } from '../src/lib/floor';
import type { FloorPlan } from '../src/types';

const floor: FloorPlan = {
  outline: [
    [-6, -5],
    [6, -5],
    [6, 5],
    [-6, 5],
  ],
  wallHeight: 2.7,
  wallThickness: 0.15,
};
describe('direct floor editing', () => {
  it('holds the opposite rectangle corner and keeps four right angles', () => {
    const next = dragFloorCorner(floor, 1, [2, 1], true);
    expect(next.outline).toEqual([
      [-6, -4],
      [8, -4],
      [8, 5],
      [-6, 5],
    ]);
    expect(() => validateFloorPlan(next)).not.toThrow();
    expect(floor.outline[1]).toEqual([6, -5]);
  });
  it('moves both endpoints of a side only along its normal', () => {
    expect(dragFloorSide(floor, 0, [3, -2], true).outline).toEqual([
      [-6, -7],
      [6, -7],
      [6, 5],
      [-6, 5],
    ]);
  });
  it('keeps rectangle handles from crossing opposite sides', () => {
    expect(dragFloorCorner(floor, 0, [40, 40], true).outline[0]).toEqual([
      5.9, 4.9,
    ]);
    expect(dragFloorSide(floor, 0, [0, 40], true).outline[0][1]).toBe(4.9);
  });
  it('moves only the requested corner in a custom polygon', () => {
    const next = dragFloorCorner(floor, 2, [1.23, 2.27], false, true);
    expect(next.outline).toEqual([
      [-6, -5],
      [6, -5],
      [7.2, 7.3],
      [-6, 5],
    ]);
  });
  it('preserves angled side direction while translating it', () => {
    const angled = {
      ...floor,
      outline: [
        [-6, -5],
        [5, -5],
        [6, 5],
        [-6, 5],
      ] as [number, number][],
    };
    const next = dragFloorSide(angled, 1, [2, 1], false);
    expect(next.outline[2][0] - next.outline[1][0]).toBeCloseTo(1, 4);
    expect(next.outline[2][1] - next.outline[1][1]).toBeCloseTo(10, 4);
    expect(next.outline[0]).toEqual(angled.outline[0]);
  });
});
