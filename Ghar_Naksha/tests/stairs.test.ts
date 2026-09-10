import { describe, expect, it } from 'vitest';
import {
  buildStairGeometry,
  defaultStairs,
  fitStairFootprint,
  sanitizeStairs,
  stairStats,
  STAIR_CATALOG,
  suggestStepCount,
} from '../src/lib/stairs';
import type { HomeElement, StairConfig, StairStyle } from '../src/types';

function fixture(
  style: StairStyle = 'straight',
  patch: Partial<StairConfig> = {},
): HomeElement {
  const preset = STAIR_CATALOG.find((item) => item.stairs?.style === style)!;
  return {
    ...preset,
    dimensions: { ...preset.dimensions },
    id: 'stairs-test',
    roomId: 'living',
    position: [0, 0, 0],
    rotation: 0,
    visible: true,
    locked: false,
    stairs: { ...defaultStairs(style), ...patch },
  };
}
describe('parametric stairs', () => {
  it.each<StairStyle>([
    'straight',
    'l-shaped',
    'u-shaped',
    'spiral',
    'floating',
  ])(
    '%s reaches floor rise with the chosen step count and stays inside footprint',
    (style) => {
      const element = fixture(style);
      const geometry = buildStairGeometry(element);
      expect(geometry.treads.filter((t) => !t.landing)).toHaveLength(16);
      expect(Math.max(...geometry.treads.map((t) => t.top))).toBeCloseTo(
        element.dimensions.height,
        8,
      );
      expect(geometry.conflicts).toEqual([]);
      [...geometry.treads, ...geometry.risers].forEach((tread) => {
        expect(tread.thickness).toBeGreaterThan(0);
        expect(tread.top - tread.thickness).toBeGreaterThanOrEqual(-1e-9);
        tread.polygon.forEach(([x, z]) => {
          expect(Math.abs(x)).toBeLessThanOrEqual(
            element.dimensions.width / 2 + 1e-8,
          );
          expect(Math.abs(z)).toBeLessThanOrEqual(
            element.dimensions.depth / 2 + 1e-8,
          );
        });
      });
    },
  );
  it('derives riser height, minimum going and pitch from actual geometry', () => {
    const stats = stairStats(fixture());
    expect(stats.riserHeight).toBeCloseTo(0.175);
    expect(stats.going).toBeCloseTo(0.28);
    expect(stats.pitch).toBeCloseTo((Math.atan2(0.175, 0.28) * 180) / Math.PI);
    const denser = stairStats(fixture('straight', { steps: 20 }));
    expect(denser.riserHeight).toBeCloseTo(0.14);
    expect(denser.going).toBeCloseTo(0.224);
  });
  it.each<StairStyle>(['l-shaped', 'u-shaped'])(
    '%s has a level landing between two distinct flights and mirrors turn direction',
    (style) => {
      const right = buildStairGeometry(fixture(style, { steps: 17 }));
      const left = buildStairGeometry(
        fixture(style, { steps: 17, turnDirection: 'left' }),
      );
      expect(right.treads.filter((t) => t.landing)).toHaveLength(1);
      expect(right.treads.find((t) => t.landing)?.top).toBeCloseTo(
        (2.8 * 8) / 17,
      );
      right.treads.forEach((t, i) =>
        t.polygon.forEach((p, j) => {
          expect(left.treads[i].polygon[j][0]).toBeCloseTo(-p[0]);
          expect(left.treads[i].polygon[j][1]).toBeCloseTo(p[1]);
        }),
      );
      const direction = right.path
        .at(-1)!
        .map((v, i) => v - right.path.at(-2)![i]);
      expect(
        style === 'u-shaped' ? direction[1] : direction[0],
      ).toBeGreaterThan(0);
    },
  );
  it('preserves manual rise when fitting even and odd turning stairs', () => {
    const element = fixture('u-shaped', {
      steps: 17,
      flightWidth: 1.1,
      landingDepth: 1.2,
    });
    const dimensions = fitStairFootprint(element, 0.29);
    expect(dimensions).toEqual({ width: 2.35, height: 2.8, depth: 3.81 });
    expect(stairStats({ ...element, dimensions }).going).toBeCloseTo(0.29);
    const l = fixture('l-shaped', { steps: 17 });
    expect(
      stairStats({ ...l, dimensions: fitStairFootprint(l, 0.3) }).going,
    ).toBeCloseTo(0.3);
    expect(element.dimensions).toEqual({
      width: 2.1,
      height: 2.8,
      depth: 3.35,
    });
  });
  it('supports independent risers, nosing, thickness, width, stringers and handrail sides', () => {
    const base = buildStairGeometry(fixture());
    expect(base.risers).toHaveLength(16);
    expect(
      buildStairGeometry(fixture('straight', { risers: 'open' })).risers,
    ).toHaveLength(0);
    expect(
      buildStairGeometry(fixture('straight', { treadThickness: 0.08 }))
        .treads[0].thickness,
    ).toBe(0.08);
    expect(
      buildStairGeometry(fixture('straight', { nosing: 0.06 })).treads[2]
        .polygon,
    ).not.toEqual(base.treads[2].polygon);
    expect(
      buildStairGeometry(fixture('straight', { flightWidth: 0.7 }))
        .effectiveWidth,
    ).toBe(0.7);
    expect(base.stringers).toHaveLength(2);
    expect(
      buildStairGeometry(fixture('straight', { stringer: 'central' }))
        .stringers,
    ).toHaveLength(1);
    expect(
      buildStairGeometry(fixture('straight', { stringer: 'none' })).stringers,
    ).toHaveLength(0);
    expect(base.rails).toHaveLength(2);
    expect(
      buildStairGeometry(fixture('straight', { railing: 'none' })).rails,
    ).toHaveLength(0);
    const left = buildStairGeometry(
      fixture('straight', { railing: 'left', railingHeight: 1.1 }),
    );
    expect(left.rails).toHaveLength(1);
    expect(left.rails[0].points[0][0]).toBeLessThan(0);
    expect(left.rails[0].points[0][1] - left.rails[0].bases[0]).toBeCloseTo(
      1.1,
    );
  });
  it('changes spiral angle, walking line and radial footprint from spiral parameters', () => {
    const base = buildStairGeometry(fixture('spiral'));
    const more = buildStairGeometry(fixture('spiral', { spiralTurns: 1.5 }));
    expect(more.going).toBeCloseTo(base.going * 1.5);
    expect(more.path[3]).not.toEqual(base.path[3]);
    expect(
      buildStairGeometry(fixture('spiral', { innerRadius: 0.1 })).poleRadius,
    ).not.toBe(base.poleRadius);
    const narrow = fixture('spiral', { flightWidth: 0.7, innerRadius: 0.15 });
    expect(fitStairFootprint(narrow)).toEqual({
      width: 1.7,
      depth: 1.7,
      height: 2.8,
    });
    expect(buildStairGeometry(narrow).effectiveWidth).toBeCloseTo(0.7);
  });
  it('reports cramped fits and constrains geometry without negative boxes or nonfinite values', () => {
    const element = fixture('u-shaped', {
      steps: 64,
      flightWidth: 2,
      landingDepth: 5,
      treadThickness: 0.25,
    });
    element.dimensions = { width: 0.8, height: 1, depth: 0.5 };
    const result = buildStairGeometry(element);
    expect(result.conflicts.length).toBeGreaterThan(2);
    result.treads.forEach((t) => {
      expect(t.thickness).toBeGreaterThan(0);
      t.polygon.flat().forEach((v) => expect(Number.isFinite(v)).toBe(true));
    });
    expect(
      Math.max(
        ...result.treads.flatMap((t) => t.polygon.map((p) => Math.abs(p[1]))),
      ),
    ).toBeLessThanOrEqual(0.25 + 1e-8);
  });
  it('sanitizes finite numeric bounds and keeps semi-automatic count suggestions separate from manual values', () => {
    const cleaned = sanitizeStairs({
      steps: NaN,
      flightWidth: Infinity,
      innerRadius: -1,
      nosing: 8,
      spiralTurns: 0,
      treadThickness: -0.5,
    });
    expect(cleaned.steps).toBe(16);
    expect(cleaned.flightWidth).toBe(0.95);
    expect(cleaned.innerRadius).toBe(0.06);
    expect(cleaned.nosing).toBe(0.1);
    expect(cleaned.spiralTurns).toBe(0.5);
    expect(cleaned.treadThickness).toBe(0.02);
    expect(suggestStepCount(2.8, 0.175)).toBe(16);
    expect(suggestStepCount(2.8, 0.14)).toBe(20);
    expect(suggestStepCount(Infinity)).toBe(16);
    const element = fixture('floating', { steps: 13 });
    fitStairFootprint(element);
    expect(element.stairs?.steps).toBe(13);
  });
});
