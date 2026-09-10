export interface NumericLimits {
  min?: number;
  max?: number;
  integer?: boolean;
  unit?: string;
}

/** Remove binary floating-point tails from HTML number constraints. */
export const numericConstraint = (value: number): number =>
  Number.isFinite(value) ? Number(value.toPrecision(15)) : value;

export function numericPrecision(draft: string, minimum = 2): number {
  const [coefficient, exponent = '0'] = draft.trim().toLowerCase().split('e');
  return Math.min(
    12,
    Math.max(
      minimum,
      (coefficient.split('.')[1]?.length ?? 0) - Number(exponent),
    ),
  );
}

export function formatNumericValue(
  value: number,
  digits = 2,
  precision = digits,
  limits: NumericLimits = {},
): string {
  if (!Number.isFinite(value)) return '';
  let places = Math.min(12, Math.max(digits, precision));
  let formatted = value.toFixed(places);
  // A valid converted minimum must not round down into an invalid form value.
  const min = numericConstraint(limits.min ?? -Infinity),
    max = numericConstraint(limits.max ?? Infinity);
  while (
    places < 12 &&
    ((value >= min && Number(formatted) < min) ||
      (value <= max && Number(formatted) > max))
  ) {
    formatted = value.toFixed(++places);
  }
  while (places > digits && formatted.endsWith('0')) {
    formatted = formatted.slice(0, -1);
    places--;
  }
  return formatted.endsWith('.') ? formatted.slice(0, -1) : formatted;
}

export function parseNumericDraft(
  draft: string,
  {
    min = -Infinity,
    max = Infinity,
    integer = false,
    unit = '',
  }: NumericLimits = {},
): { ok: true; value: number } | { ok: false; error: string } {
  const text = draft.trim();
  if (
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ||
    !Number.isFinite(Number(text))
  )
    return { ok: false, error: 'Enter a finite number.' };
  let value = Number(text);
  // Converted boundary values can differ by one floating-point bit; preserve
  // the exact stored constraint rather than rejecting or drifting across it.
  if (
    Number.isFinite(min) &&
    Math.abs(value - min) <= Number.EPSILON * Math.max(1, Math.abs(min)) * 4
  )
    value = min;
  if (
    Number.isFinite(max) &&
    Math.abs(value - max) <= Number.EPSILON * Math.max(1, Math.abs(max)) * 4
  )
    value = max;
  if (integer && !Number.isInteger(value))
    return { ok: false, error: 'Enter a whole number.' };
  if (value < min || value > max) {
    const suffix = unit ? ` ${unit}` : '';
    const lower = formatNumericValue(min, 0, 8),
      upper = formatNumericValue(max, 0, 8);
    return {
      ok: false,
      error:
        Number.isFinite(min) && Number.isFinite(max)
          ? `Enter a value from ${lower} to ${upper}${suffix}.`
          : Number.isFinite(min)
            ? `Enter ${lower}${suffix} or greater.`
            : `Enter ${upper}${suffix} or less.`,
    };
  }
  return { ok: true, value };
}
