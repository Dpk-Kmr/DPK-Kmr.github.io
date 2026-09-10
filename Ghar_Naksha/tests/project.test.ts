import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadProject,
  saveProject,
  STORAGE_KEY,
  validateProject,
} from '../src/lib/project';
import type { Project } from '../src/types';
import { initialProject } from '../src/data';

const fixture = (): Project => ({
  version: 1,
  name: 'Courtyard home',
  rooms: [
    {
      id: 'living',
      name: 'Living',
      subtitle: 'A place to gather',
      center: [0, 0],
      width: 6,
      depth: 5,
      color: '#eeece6',
    },
  ],
  elements: [
    {
      id: 'sofa-1',
      kind: 'sofa',
      name: 'Linen sofa',
      roomId: 'living',
      position: [1, 0, 1],
      rotation: 90,
      dimensions: { width: 2.4, height: 0.8, depth: 1 },
      color: '#b6baaa',
      material: 'fabric',
      visible: true,
      locked: false,
    },
  ],
});

afterEach(() => vi.unstubAllGlobals());

describe('project imports', () => {
  it('can round-trip the furnished demonstration home without losing its connections', () => {
    const project = validateProject(JSON.parse(JSON.stringify(initialProject)));
    expect(project.elements).toHaveLength(initialProject.elements.length);
    expect(
      project.elements.filter((element) => element.kind === 'water-port'),
    ).toHaveLength(5);
    expect(
      project.elements.find((element) => element.kind === 'electrical-panel')
        ?.roomId,
    ).toBe('living');
  });

  it('returns an independent validated project and strips unknown fields', () => {
    const original = { ...fixture(), unexpected: 'untrusted' };
    const result = validateProject(original);
    result.elements[0].position[0] = 8;
    result.elements[0].dimensions.width = 3;
    result.rooms[0].center[0] = 2;
    expect(original.elements[0].position[0]).toBe(1);
    expect(original.elements[0].dimensions.width).toBe(2.4);
    expect(original.rooms[0].center[0]).toBe(0);
    expect(result).not.toHaveProperty('unexpected');
  });

  it.each([NaN, Infinity, -Infinity, '2', 101])(
    'rejects malformed or excessive coordinates: %s',
    (coordinate) => {
      const project = fixture();
      (project.elements[0].position as unknown[])[0] = coordinate;
      expect(() => validateProject(project)).toThrow(/X position/);
    },
  );

  it('rejects duplicate entity IDs and dangling room references', () => {
    const duplicate = fixture();
    duplicate.elements[0].id = 'living';
    expect(() => validateProject(duplicate)).toThrow(/Duplicate ID/);
    const orphan = fixture();
    orphan.elements[0].roomId = 'missing';
    expect(() => validateProject(orphan)).toThrow(/room that does not exist/);
  });

  it.each([
    ['kind', 'script', /unknown element kind/],
    ['material', 'unsafe', /unknown material/],
    ['color', 'url(javascript:alert(1))', /hex color/],
    ['visible', 'true', /visibility/],
    ['name', ' ', /name/],
    ['rotation', 361, /rotation/],
  ])('rejects invalid %s', (key, value, message) => {
    const project = fixture();
    Object.assign(project.elements[0], { [key as string]: value });
    expect(() => validateProject(project)).toThrow(message as RegExp);
  });

  it('rejects missing required fields, bad dimensions, oversized projects, and unknown versions', () => {
    expect(() => validateProject({})).toThrow(/version/);
    expect(() => validateProject({ ...fixture(), version: 2 })).toThrow(
      /version/,
    );
    const project = fixture();
    project.elements[0].dimensions.width = 0;
    expect(() => validateProject(project)).toThrow(/width/);
    expect(() =>
      validateProject({ ...fixture(), elements: Array(2001).fill({}) }),
    ).toThrow(/2000/);
    expect(() => validateProject({ ...fixture(), rooms: [] })).toThrow(/rooms/);
    expect(() =>
      validateProject({ ...fixture(), name: 'x'.repeat(121) }),
    ).toThrow(/Project name/);
  });
});

describe('browser persistence', () => {
  it('loads and validates a persisted project', () => {
    const stored = fixture();
    stored.name = 'Saved villa';
    const getItem = vi.fn(() => JSON.stringify(stored));
    vi.stubGlobal('localStorage', { getItem });
    expect(loadProject(fixture()).name).toBe('Saved villa');
    expect(getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it.each(['{invalid json', '{"version":2}', null])(
    'recovers from absent or corrupt cache %s without aliasing the fallback',
    (stored) => {
      vi.stubGlobal('localStorage', { getItem: () => stored });
      const fallback = fixture();
      const result = loadProject(fallback);
      expect(result).toEqual(validateProject(fallback));
      result.elements[0].position[0] = 9;
      expect(fallback.elements[0].position[0]).toBe(1);
    },
  );

  it('opens with browser storage disabled and surfaces write errors to the caller', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('Access denied');
      },
      setItem() {
        throw new Error('Quota exceeded');
      },
    });
    expect(loadProject(fixture())).toEqual(validateProject(fixture()));
    expect(() => saveProject(fixture())).toThrow('Quota exceeded');
  });

  it('saves validated JSON and rejects invalid data before writing', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    saveProject(fixture());
    expect(setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(validateProject(fixture())),
    );
    const invalid = fixture();
    invalid.elements[0].dimensions.height = -2;
    expect(() => saveProject(invalid)).toThrow(/height/);
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});
