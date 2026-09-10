import { describe, expect, it } from 'vitest';
import type { HomeElement, Room } from '../src/types';
import { localToWorld, moveElement, moveRoom, normalizeRotation, resizeElement, resizeRoom, rotateElement } from '../src/lib/transforms';

const element = (rotation = 0): HomeElement => ({ id: 'sofa', kind: 'sofa', name: 'Sofa', roomId: 'living', position: [2, .1, 3], rotation, dimensions: { width: 2, depth: 1, height: .8 }, color: '#cccccc', material: 'fabric', visible: true, locked: false });
const room: Room = { id: 'living', name: 'Living', subtitle: '', center: [2, 3], width: 4, depth: 3, color: '#eeeeee' };

describe('direct manipulation geometry', () => {
  it('resizes an edge without moving its opposite edge or changing the other dimensions', () => {
    const result = resizeElement(element(), [1, 0], [1.5, .8]);
    expect(result.dimensions).toEqual({ width: 3.5, depth: 1, height: .8 });
    expect(result.position).toEqual([2.75, .1, 3]);
    expect(result.position![0] - result.dimensions!.width / 2).toBe(1);
  });

  it.each([0, 35, 90, 180, 270])('keeps the diagonally opposite corner anchored at rotation %s', angle => {
    const original = element(angle);
    const delta = localToWorld([1, 2], angle);
    const result = resizeElement(original, [1, -1], delta);
    const before = localToWorld([-original.dimensions.width / 2, original.dimensions.depth / 2], angle);
    const after = localToWorld([-result.dimensions!.width / 2, result.dimensions!.depth / 2], angle);
    expect(result.position![0] + after[0]).toBeCloseTo(original.position[0] + before[0], 3);
    expect(result.position![2] + after[1]).toBeCloseTo(original.position[2] + before[1], 3);
  });

  it('does not inflate thin utility elements when resizing only their width', () => {
    const outlet = { ...element(), dimensions: { width: .12, depth: .035, height: .12 } };
    expect(resizeElement(outlet, [1, 0], [.3, 2]).dimensions!.depth).toBe(.035);
    expect(resizeElement(outlet, [-1, -1], [10, 10]).dimensions!.depth).toBe(.01);
  });

  it('converts rotation direction, wraps across north and snaps only when requested', () => {
    expect(rotateElement(element(), [2, 1], [4, 3]).rotation).toBe(270);
    expect(rotateElement(element(350), [2, 1], [0, 3]).rotation).toBe(80);
    const angle = 37 * Math.PI / 180;
    const point: [number, number] = [2 + 2 * Math.sin(angle), 3 - 2 * Math.cos(angle)];
    expect(rotateElement(element(), [2, 1], point).rotation).toBe(323);
    expect(rotateElement(element(), [2, 1], point, true).rotation).toBe(330);
    expect(normalizeRotation(-450)).toBe(270);
  });

  it('moves in metres without changing height, detaches moved openings, and respects locks', () => {
    const opening = { ...element(), wallAttachment: { wallId: 'wall', offset: 1 } };
    expect(moveElement(opening, [.137, -.153], true)).toEqual({ position: [2.1, .1, 2.8], wallAttachment: undefined });
    expect(moveElement({ ...element(), locked: true }, [1, 1])).toEqual({});
    expect(resizeElement({ ...element(), locked: true }, [1, 1], [1, 1])).toEqual({});
  });

  it('preserves the opposite room corner through resize and supports independent room movement', () => {
    const resized = resizeRoom(room, [-1, 1], [-2, 1]);
    expect(resized).toEqual({ width: 6, depth: 4, center: [1, 3.5] });
    expect(moveRoom(room, [.34, -1], true)).toEqual({ center: [2.3, 2] });
  });
});
