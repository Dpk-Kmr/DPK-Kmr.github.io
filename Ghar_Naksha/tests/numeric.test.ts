import { describe, expect, it } from 'vitest';
import {
  formatNumericValue,
  numericConstraint,
  numericPrecision,
  parseNumericDraft,
} from '../src/lib/numeric';

describe('dimension input values', () => {
  it.each([
    '29',
    '29.00',
    '29.017',
    '0.175',
    '0.025',
    '-13.247',
    '.125',
    '1.25e-2',
  ])('accepts decimal value %s without a step grid', (text) => {
    expect(parseNumericDraft(text, { min: -100, max: 100 })).toEqual({
      ok: true,
      value: Number(text),
    });
  });
  it.each([
    '',
    ' ',
    'NaN',
    'Infinity',
    '-Infinity',
    '1e999',
    '0x10',
    '3.4.5',
    '1e',
  ])('rejects malformed or non-finite %s', (text) => {
    expect(parseNumericDraft(text).ok).toBe(false);
  });
  it('rejects out-of-range dimensions without clamping and explains the valid range', () => {
    expect(parseNumericDraft('0.04', { min: 0.05, max: 1, unit: 'm' })).toEqual(
      { ok: false, error: 'Enter a value from 0.05 to 1 m.' },
    );
    expect(parseNumericDraft('101', { min: 0.1, max: 100 }).ok).toBe(false);
    expect(parseNumericDraft('.05', { min: 0.05, max: 1 })).toEqual({
      ok: true,
      value: 0.05,
    });
  });
  it('accepts ordinary feet values independently of a converted minimum', () => {
    const factor = 3.28084;
    expect(
      parseNumericDraft('29', { min: 0.1 * factor, max: 100 * factor }),
    ).toEqual({ ok: true, value: 29 });
    expect(
      parseNumericDraft('3.273', { min: 0.4 * factor, max: 4 * factor }),
    ).toEqual({ ok: true, value: 3.273 });
  });
  it('requires an integer only for true counts', () => {
    expect(
      parseNumericDraft('16.25', { min: 3, max: 64, integer: true }),
    ).toEqual({ ok: false, error: 'Enter a whole number.' });
    expect(parseNumericDraft('16', { min: 3, max: 64, integer: true })).toEqual(
      { ok: true, value: 16 },
    );
    expect(parseNumericDraft('20.5', { min: 1, max: 300 })).toEqual({
      ok: true,
      value: 20.5,
    });
  });
  it('keeps valid converted boundary values inside native min/max after formatting', () => {
    const factor = 3.28084;
    for (const min of [0.02, 0.05, 0.1, 0.2, 0.4, 0.5]) {
      const converted = min * factor;
      const result = formatNumericValue(converted, 2, 2, {
        min: converted,
        max: 100 * factor,
      });
      expect(Number(result)).toBeGreaterThanOrEqual(
        numericConstraint(converted),
      );
      expect(
        parseNumericDraft(result, { min: converted, max: 100 * factor }).ok,
      ).toBe(true);
    }
    const max = 1.2341;
    expect(
      Number(formatNumericValue(max, 2, 2, { min: 1, max })),
    ).toBeLessThanOrEqual(max);
  });
  it('preserves explicitly entered precision while retaining compact formatting', () => {
    expect(numericPrecision('1.237')).toBe(3);
    expect(numericPrecision('1.25e-3')).toBe(5);
    expect(formatNumericValue(1.237, 2, numericPrecision('1.237'))).toBe(
      '1.237',
    );
    expect(formatNumericValue(29, 2, 4)).toBe('29.00');
    expect(formatNumericValue(0.08, 3, 5)).toBe('0.080');
    expect(formatNumericValue(Infinity)).toBe('');
  });
});
