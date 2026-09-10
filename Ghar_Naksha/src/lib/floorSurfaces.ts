import { Shape, ShapeUtils, Vector2 } from 'three';
import type { Point2 } from './walkthrough';

const cross = (a: Point2, b: Point2, p: Point2) =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
export const polygonArea = (polygon: Point2[]) =>
  Math.abs(
    polygon.reduce((sum, p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0),
  ) / 2;
function halfPlane(
  polygon: Point2[],
  a: Point2,
  b: Point2,
  side: number,
): Point2[] {
  const result: Point2[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i],
      q = polygon[(i + 1) % polygon.length];
    const cp = cross(a, b, p) * side,
      cq = cross(a, b, q) * side;
    if (cp >= -1e-9) result.push(p);
    if (cp >= 0 !== cq >= 0) {
      const t = cp / (cp - cq);
      result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return result.filter(
    (p, i) =>
      i === 0 ||
      Math.hypot(p[0] - result[i - 1][0], p[1] - result[i - 1][1]) > 1e-8,
  );
}
/** Subtract convex stair voids even when they touch or cross the room boundary. */
export function surfacePolygons(
  outline: Point2[],
  holes: Point2[][],
): Point2[][] {
  const vertices = outline.map(([x, z]) => new Vector2(x, z));
  let pieces: Point2[][] = ShapeUtils.triangulateShape(vertices, []).map(
    (triangle) => triangle.map((i) => outline[i]),
  );
  for (const hole of holes) {
    const signedArea = hole.reduce((sum, p, i) => {
      const q = hole[(i + 1) % hole.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
    const inside = signedArea >= 0 ? 1 : -1;
    pieces = pieces.flatMap((polygon) => {
      const outside: Point2[][] = [];
      let remaining = polygon;
      for (let i = 0; i < hole.length && remaining.length >= 3; i++) {
        const a = hole[i],
          b = hole[(i + 1) % hole.length];
        const piece = halfPlane(remaining, a, b, -inside);
        if (piece.length >= 3 && polygonArea(piece) > 1e-9) outside.push(piece);
        remaining = halfPlane(remaining, a, b, inside);
      }
      return outside;
    });
  }
  return pieces;
}
export function surfaceShapes(outline: Point2[], holes: Point2[][]): Shape[] {
  return surfacePolygons(outline, holes).map((polygon) => {
    const shape = new Shape();
    polygon.forEach(([x, z], i) =>
      i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
    );
    shape.closePath();
    return shape;
  });
}
