import { describe, expect, it } from 'vitest';
import { initialProject } from '../src/data';
import { validateProject } from '../src/lib/project';
import { createShareLink, readShareLink } from '../src/lib/share';

describe('self-contained snapshot sharing', () => {
  it('round-trips a complete Unicode design without a server', async () => {
    const project = validateProject({
      ...structuredClone(initialProject),
      name: 'घर • Our home 🏠',
    });
    const link = await createShareLink(
      project,
      'https://example.com/studio/?view=plan#old',
    );
    expect(link).toContain('https://example.com/studio/?view=plan#home=gz.');
    expect(await readShareLink(link)).toEqual(project);
    expect(await readShareLink(new URL(link).hash)).toEqual(project);
  });
  it('keeps the link immutable after its source is edited', async () => {
    const project = validateProject(structuredClone(initialProject));
    const link = await createShareLink(project, 'https://example.com/');
    project.name = 'Changed later';
    project.elements[0].dimensions.width = 20;
    const snapshot = await readShareLink(link);
    expect(snapshot?.name).toBe(initialProject.name);
    expect(snapshot?.elements[0].dimensions.width).not.toBe(20);
  });
  it('rejects corrupted, unknown, and unsafe URL formats', async () => {
    await expect(readShareLink('#home=gz.invalid')).rejects.toThrow(
      'could not be opened',
    );
    await expect(readShareLink('#home=unknown.data')).rejects.toThrow(
      'could not be opened',
    );
    await expect(
      createShareLink(initialProject, 'javascript:alert(1)'),
    ).rejects.toThrow('HTTP');
    expect(await readShareLink('#other')).toBeNull();
  });
  it('validates decoded project content before returning it', async () => {
    const data = btoa(
      JSON.stringify({ version: 1, name: 'Broken', rooms: [], elements: 'no' }),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    await expect(readShareLink(`#home=json.${data}`)).rejects.toThrow(
      'could not be opened',
    );
  });
});
