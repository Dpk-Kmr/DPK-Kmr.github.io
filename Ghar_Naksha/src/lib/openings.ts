import type { HomeElement, Project } from '../types';

export interface WallSegment {
  /** Mesh center in the wall's local coordinates; wall origins sit at floor level. */
  position: [number, number, number];
  dimensions: { width: number; height: number; depth: number };
}
const radians = (degrees: number) => (degrees * Math.PI) / 180;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const isOpening = (element: HomeElement) =>
  element.kind === 'door' || element.kind === 'window';

function wallAxis(wall: HomeElement) {
  const alongDepth = wall.dimensions.depth > wall.dimensions.width;
  const angle = radians(wall.rotation);
  return {
    alongDepth,
    length: alongDepth ? wall.dimensions.depth : wall.dimensions.width,
    thickness: alongDepth ? wall.dimensions.width : wall.dimensions.depth,
    direction: (alongDepth
      ? [Math.sin(angle), Math.cos(angle)]
      : [Math.cos(angle), -Math.sin(angle)]) as [number, number],
    rotation: (((wall.rotation + (alongDepth ? -90 : 0)) % 360) + 360) % 360,
  };
}
function placeOpening(
  wall: HomeElement,
  element: HomeElement,
  offset: number,
): HomeElement {
  const axis = wallAxis(wall);
  const width = Math.min(
    element.dimensions.width,
    Math.max(0.005, axis.length - 0.02),
  );
  const limit = Math.max(0, (axis.length - width) / 2);
  const fittedOffset = clamp(offset, -limit, limit);
  return {
    ...element,
    position: [
      wall.position[0] + axis.direction[0] * fittedOffset,
      element.position[1],
      wall.position[2] + axis.direction[1] * fittedOffset,
    ],
    rotation: axis.rotation,
    dimensions: { ...element.dimensions, width },
    wallAttachment: { wallId: wall.id, offset: fittedOffset },
  };
}

/** Project an opening onto the nearest wall's centerline and fit it within the wall. */
export function attachToNearestWall(
  project: Project,
  element: HomeElement,
): HomeElement | null {
  if (!isOpening(element)) return null;
  let nearest: HomeElement | null = null;
  let nearestDistance = Infinity;
  for (const wall of project.elements) {
    if (wall.kind !== 'wall' || !wall.visible) continue;
    const axis = wallAxis(wall);
    const dx = element.position[0] - wall.position[0];
    const dz = element.position[2] - wall.position[2];
    const offset = dx * axis.direction[0] + dz * axis.direction[1];
    const candidate = placeOpening(wall, element, offset);
    const distance = Math.hypot(
      element.position[0] - candidate.position[0],
      element.position[2] - candidate.position[2],
    );
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** Keep attached openings aligned after wall transforms, or detach if their wall was removed. */
export function syncWallAttachments(project: Project): Project {
  const walls = new Map(
    project.elements
      .filter((element) => element.kind === 'wall')
      .map((wall) => [wall.id, wall]),
  );
  let changed = false;
  const elements = project.elements.map((element) => {
    if (!isOpening(element) || !element.wallAttachment) return element;
    const wall = walls.get(element.wallAttachment.wallId);
    if (!wall) {
      const detached = { ...element };
      delete detached.wallAttachment;
      changed = true;
      return detached;
    }
    const updated = placeOpening(wall, element, element.wallAttachment.offset);
    if (JSON.stringify(updated) === JSON.stringify(element)) return element;
    changed = true;
    return updated;
  });
  return changed ? { ...project, elements } : project;
}

/** Subdivide a wall around the union of attached opening apertures without negative boxes. */
export function getWallSegments(
  wall: HomeElement,
  elements: HomeElement[],
  displayHeight = wall.dimensions.height,
): WallSegment[] {
  const axis = wallAxis(wall);
  const height = Math.max(0, Math.min(displayHeight, wall.dimensions.height));
  if (height <= 0.00001 || axis.length <= 0.00001 || axis.thickness <= 0.00001)
    return [];
  const holes = elements
    .filter(
      (element) =>
        isOpening(element) &&
        element.visible &&
        element.wallAttachment?.wallId === wall.id,
    )
    .map((element) => {
      const offset = clamp(
        element.wallAttachment!.offset,
        -axis.length / 2,
        axis.length / 2,
      );
      const bottom = element.position[1] - wall.position[1];
      return {
        left: Math.max(-axis.length / 2, offset - element.dimensions.width / 2),
        right: Math.min(axis.length / 2, offset + element.dimensions.width / 2),
        bottom: clamp(bottom, 0, height),
        top: clamp(bottom + element.dimensions.height, 0, height),
      };
    })
    .filter(
      (hole) =>
        hole.right - hole.left > 0.00001 && hole.top - hole.bottom > 0.00001,
    );
  const xs = [
    ...new Set([
      -axis.length / 2,
      axis.length / 2,
      ...holes.flatMap((hole) => [hole.left, hole.right]),
    ]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([
      0,
      height,
      ...holes.flatMap((hole) => [hole.bottom, hole.top]),
    ]),
  ].sort((a, b) => a - b);
  const segments: WallSegment[] = [];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const length = xs[i + 1] - xs[i],
        segmentHeight = ys[j + 1] - ys[j];
      if (length <= 0.00001 || segmentHeight <= 0.00001) continue;
      const middle = (xs[i] + xs[i + 1]) / 2,
        y = (ys[j] + ys[j + 1]) / 2;
      if (
        holes.some(
          (hole) =>
            middle > hole.left &&
            middle < hole.right &&
            y > hole.bottom &&
            y < hole.top,
        )
      )
        continue;
      segments.push({
        position: axis.alongDepth ? [0, y, middle] : [middle, y, 0],
        dimensions: {
          width: axis.alongDepth ? axis.thickness : length,
          height: segmentHeight,
          depth: axis.alongDepth ? length : axis.thickness,
        },
      });
    }
  return segments;
}
