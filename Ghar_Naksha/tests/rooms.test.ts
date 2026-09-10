import { describe, expect, it } from 'vitest';
import { makeRoom, updateRoom } from '../src/lib/rooms';
import { validateProject } from '../src/lib/project';
import type { Project } from '../src/types';

describe('room authoring', () => {
  it('creates a valid room with a walkable entrance gap', () => {
    const { room, elements } = makeRoom('Studio', 6, 5);
    const project: Project = {
      version: 1,
      name: 'My home',
      rooms: [room],
      elements,
    };
    expect(validateProject(project)).toMatchObject(project);
    const front = elements.filter((element) =>
      element.name.startsWith('Front'),
    );
    expect(
      front.reduce((sum, element) => sum + element.dimensions.width, 0),
    ).toBeCloseTo(4.9);
  });
  it('resizes the shell while retaining furniture sizes and other rooms', () => {
    const first = makeRoom('Living', 6, 5);
    const second = makeRoom('Study', 4, 4, [6, 0]);
    const furniture = {
      ...first.elements[0],
      id: 'sofa',
      kind: 'sofa' as const,
      position: [1, 0, 1] as [number, number, number],
      dimensions: { width: 2, height: 1, depth: 0.8 },
      locked: false,
    };
    const project: Project = {
      version: 1,
      name: 'Home',
      rooms: [first.room, second.room],
      elements: [...first.elements, ...second.elements, furniture],
    };
    const updated = updateRoom(project, first.room.id, {
      width: 12,
      center: [2, 1],
    });
    expect(
      updated.elements.find((element) => element.id === 'sofa')?.position,
    ).toEqual([4, 0, 2]);
    expect(
      updated.elements.find((element) => element.id === 'sofa')?.dimensions,
    ).toEqual(furniture.dimensions);
    expect(updated.elements[0].dimensions.width).toBe(12);
    expect(updated.elements[5]).toEqual(second.elements[0]);
    expect(project.rooms[0].width).toBe(6);
    expect(validateProject(updated)).toMatchObject(updated);
  });
});
