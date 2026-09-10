import type { HomeElement, Room } from '../types';

export type ResizeHandle = [-1 | 0 | 1, -1 | 0 | 1];
export type PlanPoint = [number, number];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const precise = (value: number) => Number(value.toFixed(4));
export const snapLength = (value: number, snap = false) => snap ? Math.round(value * 10) / 10 : precise(value);
export const normalizeRotation = (value: number) => precise(((value % 360) + 360) % 360);

/** Three.js positive Y rotation has the opposite sign to an SVG rotation. */
export function localToWorld(point: PlanPoint, rotation: number): PlanPoint {
  const angle = rotation * Math.PI / 180;
  return [point[0] * Math.cos(angle) + point[1] * Math.sin(angle), -point[0] * Math.sin(angle) + point[1] * Math.cos(angle)];
}

export function moveElement(element: HomeElement, delta: PlanPoint, snap = false): Partial<HomeElement> {
  if (element.locked) return {};
  return { position: [clamp(snapLength(element.position[0] + delta[0], snap), -100, 100), element.position[1], clamp(snapLength(element.position[2] + delta[1], snap), -100, 100)], ...(element.wallAttachment ? { wallAttachment: undefined } : {}) };
}

/** Keep the opposite corner/edge fixed, including for a rotated object. */
export function resizeElement(element: HomeElement, handle: ResizeHandle, worldDelta: PlanPoint, snap = false): Partial<HomeElement> {
  if (element.locked) return {};
  const localDelta = localToWorld(worldDelta, -element.rotation);
  const width = handle[0] && Math.abs(localDelta[0]) > 1e-8 ? clamp(snapLength(element.dimensions.width + handle[0] * localDelta[0], snap), .01, 100) : element.dimensions.width;
  const depth = handle[1] && Math.abs(localDelta[1]) > 1e-8 ? clamp(snapLength(element.dimensions.depth + handle[1] * localDelta[1], snap), .01, 100) : element.dimensions.depth;
  const shift: PlanPoint = [handle[0] * (width - element.dimensions.width) / 2, handle[1] * (depth - element.dimensions.depth) / 2];
  const worldShift = localToWorld(shift, element.rotation);
  return {
    dimensions: { ...element.dimensions, width, depth },
    position: [precise(element.position[0] + worldShift[0]), element.position[1], precise(element.position[2] + worldShift[1])],
    ...(element.wallAttachment ? { wallAttachment: { ...element.wallAttachment, offset: precise(element.wallAttachment.offset + shift[0]) } } : {}),
  };
}

export function rotateElement(element: HomeElement, start: PlanPoint, current: PlanPoint, snap = false): Partial<HomeElement> {
  if (element.locked) return {};
  const x = element.position[0], z = element.position[2];
  if (Math.hypot(current[0] - x, current[1] - z) < .001) return {};
  const delta = (Math.atan2(start[1] - z, start[0] - x) - Math.atan2(current[1] - z, current[0] - x)) * 180 / Math.PI;
  const rotation = normalizeRotation(snap ? Math.round((element.rotation + delta) / 15) * 15 : Number((element.rotation + delta).toFixed(1)));
  return { rotation, ...(element.wallAttachment ? { wallAttachment: undefined } : {}) };
}

export function moveRoom(room: Room, delta: PlanPoint, snap = false): Partial<Room> {
  return { center: [clamp(snapLength(room.center[0] + delta[0], snap), -100, 100), clamp(snapLength(room.center[1] + delta[1], snap), -100, 100)] };
}

export function resizeRoom(room: Room, handle: ResizeHandle, delta: PlanPoint, snap = false): Partial<Room> {
  const width = handle[0] ? clamp(snapLength(room.width + handle[0] * delta[0], snap), .5, 100) : room.width;
  const depth = handle[1] ? clamp(snapLength(room.depth + handle[1] * delta[1], snap), .5, 100) : room.depth;
  return { width, depth, center: [precise(room.center[0] + handle[0] * (width - room.width) / 2), precise(room.center[1] + handle[1] * (depth - room.depth) / 2)] };
}
