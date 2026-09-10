import type { FloorPlan } from '../types';

const coordinate = (value: number, snap: boolean) =>
  Number(
    Math.max(
      -100,
      Math.min(100, snap ? Math.round(value * 10) / 10 : value),
    ).toFixed(4),
  );

/** Resize a rectangle around its opposite corner, or move one polygon vertex. */
export function dragFloorCorner(
  floor: FloorPlan,
  index: number,
  delta: [number, number],
  rectangular: boolean,
  snap = false,
): FloorPlan {
  const outline = floor.outline.map((point) => [...point] as [number, number]);
  const point: [number, number] = [
    coordinate(outline[index][0] + delta[0], snap),
    coordinate(outline[index][1] + delta[1], snap),
  ];
  if (rectangular && outline.length === 4) {
    const opposite = outline[(index + 2) % 4];
    const left = index === 0 || index === 3,
      top = index < 2;
    const x = left
      ? Math.min(point[0], opposite[0] - 0.1)
      : Math.max(point[0], opposite[0] + 0.1);
    const z = top
      ? Math.min(point[1], opposite[1] - 0.1)
      : Math.max(point[1], opposite[1] + 0.1);
    const minX = left ? x : opposite[0],
      maxX = left ? opposite[0] : x;
    const minZ = top ? z : opposite[1],
      maxZ = top ? opposite[1] : z;
    return {
      ...floor,
      outline: [
        [minX, minZ],
        [maxX, minZ],
        [maxX, maxZ],
        [minX, maxZ],
      ],
    };
  }
  outline[index] = point;
  return { ...floor, outline };
}

/** Drag a whole side perpendicular to itself, preserving its direction. */
export function dragFloorSide(
  floor: FloorPlan,
  index: number,
  delta: [number, number],
  rectangular: boolean,
  snap = false,
): FloorPlan {
  const outline = floor.outline.map((point) => [...point] as [number, number]);
  const next = (index + 1) % outline.length,
    a = outline[index],
    b = outline[next];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 0.0001) return floor;
  const normal: [number, number] = [
    -(b[1] - a[1]) / length,
    (b[0] - a[0]) / length,
  ];
  let distance = delta[0] * normal[0] + delta[1] * normal[1];
  if (rectangular && outline.length === 4) {
    const opposite = outline[(index + 2) % 4];
    const available =
      (opposite[0] - a[0]) * normal[0] + (opposite[1] - a[1]) * normal[1];
    distance = Math.min(distance, available - 0.1);
  }
  for (const vertex of [index, next])
    outline[vertex] = [
      coordinate(outline[vertex][0] + normal[0] * distance, snap),
      coordinate(outline[vertex][1] + normal[1] * distance, snap),
    ];
  return { ...floor, outline };
}
