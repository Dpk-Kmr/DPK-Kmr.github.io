import { describe, expect, it } from 'vitest';
import {
  attachToNearestWall,
  getWallSegments,
  syncWallAttachments,
} from '../src/lib/openings';
import type { HomeElement, Project } from '../src/types';

const wall: HomeElement = {
  id: 'wall',
  name: 'Wall',
  kind: 'wall',
  roomId: '__floor__',
  position: [0, 0, 0],
  rotation: 0,
  dimensions: { width: 6, height: 3, depth: 0.2 },
  color: '#eee',
  material: 'plaster',
  visible: true,
  locked: false,
};
const door: HomeElement = {
  ...wall,
  id: 'door',
  kind: 'door',
  name: 'Door',
  position: [1, 0, 2],
  dimensions: { width: 1, height: 2.2, depth: 0.15 },
};
const project = (elements: HomeElement[]): Project => ({
  version: 1,
  name: 'Home',
  rooms: [],
  elements,
});
const area = (
  segments: ReturnType<typeof getWallSegments>,
  alongDepth = false,
) =>
  segments.reduce(
    (sum, segment) =>
      sum +
      (alongDepth ? segment.dimensions.depth : segment.dimensions.width) *
        segment.dimensions.height,
    0,
  );

describe('wall opening attachments', () => {
  it('projects to the nearest wall and preserves opening elevation', () => {
    const window = {
      ...door,
      kind: 'window' as const,
      position: [1, 0.9, 2] as [number, number, number],
    };
    const attached = attachToNearestWall(
      project([wall, { ...wall, id: 'far', position: [0, 0, 9] }]),
      window,
    )!;
    expect(attached.position).toEqual([1, 0.9, 0]);
    expect(attached.wallAttachment).toEqual({ wallId: 'wall', offset: 1 });
    expect(attachToNearestWall(project([]), door)).toBeNull();
  });
  it('aligns depth-oriented and rotated walls using the wall major axis', () => {
    const vertical = {
      ...wall,
      dimensions: { width: 0.2, height: 3, depth: 6 },
    };
    const attached = attachToNearestWall(project([vertical]), door)!;
    expect(attached.position).toEqual([0, 0, 2]);
    expect(attached.rotation).toBe(270);
    const rotated = {
      ...wall,
      rotation: 90,
      position: [2, 0, 3] as [number, number, number],
    };
    const result = attachToNearestWall(project([rotated]), {
      ...door,
      position: [4, 0, 2],
    })!;
    expect(result.position[0]).toBeCloseTo(2);
    expect(result.position[2]).toBeCloseTo(2);
    expect(result.rotation).toBe(90);
  });
  it('tracks wall movement/rotation and clamps after resizing without mutating the input', () => {
    const attached = attachToNearestWall(project([wall]), door)!;
    const moved = {
      ...wall,
      position: [5, 0, 4] as [number, number, number],
      rotation: 90,
      dimensions: { ...wall.dimensions, width: 1.4 },
    };
    const source = project([moved, attached]);
    const updated = syncWallAttachments(source).elements[1];
    expect(updated.position[0]).toBeCloseTo(5);
    expect(updated.position[2]).toBeCloseTo(3.8);
    expect(updated.wallAttachment?.offset).toBeCloseTo(0.2);
    expect(source.elements[1].position).toEqual([1, 0, 0]);
    const tiny = syncWallAttachments(
      project([
        { ...moved, dimensions: { ...moved.dimensions, width: 0.6 } },
        attached,
      ]),
    ).elements[1];
    expect(tiny.dimensions.width).toBeCloseTo(0.58);
  });
  it('detaches an opening after its supporting wall is deleted', () => {
    const attached = attachToNearestWall(project([wall]), door)!;
    const detached = syncWallAttachments(project([attached])).elements[0];
    expect(detached.wallAttachment).toBeUndefined();
    expect(detached.position).toEqual(attached.position);
  });
  it('cuts a doorway and elevated window with the correct remaining wall area', () => {
    const attached = {
      ...door,
      position: [-1.5, 0, 0] as [number, number, number],
      wallAttachment: { wallId: wall.id, offset: -1.5 },
    };
    const window = {
      ...door,
      id: 'window',
      kind: 'window' as const,
      position: [1, 0.8, 0] as [number, number, number],
      dimensions: { width: 1.6, height: 1.4, depth: 0.15 },
      wallAttachment: { wallId: wall.id, offset: 1 },
    };
    expect(area(getWallSegments(wall, [attached, window]))).toBeCloseTo(
      18 - 2.2 - 1.6 * 1.4,
    );
    expect(area(getWallSegments(wall, [attached, window], 1))).toBeCloseTo(
      6 - 1 - 1.6 * 0.2,
    );
    expect(
      getWallSegments(wall, [attached, window]).every((segment) =>
        Object.values(segment.dimensions).every((value) => value > 0),
      ),
    ).toBe(true);
  });
  it('unions overlapping holes and preserves a sill in a depth-oriented wall', () => {
    const vertical = {
      ...wall,
      dimensions: { width: 0.2, height: 3, depth: 6 },
    };
    const opening = {
      ...door,
      kind: 'window' as const,
      position: [0, 1, 0] as [number, number, number],
      dimensions: { width: 2, height: 1, depth: 0.15 },
      wallAttachment: { wallId: wall.id, offset: 0 },
    };
    const segments = getWallSegments(vertical, [
      opening,
      { ...opening, id: 'overlap' },
    ]);
    expect(area(segments, true)).toBeCloseTo(16);
    expect(
      segments.some(
        (segment) =>
          segment.position[1] === 0.5 && segment.dimensions.depth === 2,
      ),
    ).toBe(true);
  });
});
