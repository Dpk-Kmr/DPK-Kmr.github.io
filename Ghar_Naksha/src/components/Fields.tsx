import { useId, useLayoutEffect, useRef, useState } from 'react';
import {
  formatNumericValue,
  numericConstraint,
  numericPrecision,
  parseNumericDraft,
} from '../lib/numeric';
import './Fields.css';

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void | boolean;
  unit?: string;
  min?: number;
  max?: number;
  /** Display precision, not an allowed-value increment. */
  digits?: number;
  integer?: boolean;
  disabled?: boolean;
  className?: string;
}

export function NumberField({
  label,
  value,
  onChange,
  unit = 'm',
  min = -100,
  max = 100,
  digits = 2,
  integer = false,
  disabled = false,
  className = 'numeric-field',
}: NumberFieldProps) {
  const initial = () => formatNumericValue(value, digits, digits, { min, max });
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);
  const precision = useRef(digits);
  const previousUnit = useRef(unit);
  const pending = useRef<{
    before: number;
    requested: number;
    rejected: boolean;
  } | null>(null);
  const errorId = useId();

  useLayoutEffect(() => {
    if (previousUnit.current !== unit) {
      precision.current = digits;
      previousUnit.current = unit;
    }
    setDraft(
      formatNumericValue(value, digits, precision.current, { min, max }),
    );
    dirty.current = false;
    setError('');
    input.current?.setCustomValidity('');
  }, [value, min, max, digits, unit]);

  // Parent editors may reject a valid number for geometric reasons. Show the
  // actual accepted value after their synchronous update, never a pretend save.
  useLayoutEffect(() => {
    const attempt = pending.current;
    if (!attempt) return;
    pending.current = null;
    setDraft(
      formatNumericValue(value, digits, precision.current, { min, max }),
    );
    if (
      attempt.rejected ||
      (value === attempt.before && attempt.requested !== value)
    ) {
      setError(
        `This change was not applied. Current value: ${formatNumericValue(value, digits, precision.current, { min, max })}${unit ? ` ${unit}` : ''}.`,
      );
    }
  });

  const cancel = () => {
    dirty.current = false;
    pending.current = null;
    setDraft(
      formatNumericValue(value, digits, precision.current, { min, max }),
    );
    setError('');
    input.current?.setCustomValidity('');
  };
  const apply = () => {
    if (!dirty.current || disabled) return;
    const parsed = parseNumericDraft(draft, { min, max, integer, unit });
    if (!parsed.ok) {
      setError(parsed.error);
      input.current?.setCustomValidity(parsed.error);
      return;
    }
    dirty.current = false;
    precision.current = integer ? 0 : numericPrecision(draft, digits);
    setError('');
    input.current?.setCustomValidity('');
    setDraft(
      formatNumericValue(value, digits, precision.current, { min, max }),
    );
    if (parsed.value === value) return;
    pending.current = {
      before: value,
      requested: parsed.value,
      rejected: false,
    };
    const accepted = onChange(parsed.value);
    if (pending.current) pending.current.rejected = accepted === false;
  };

  return (
    <label className={className}>
      <span>{label}</span>
      <div>
        <input
          ref={input}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          type="number"
          inputMode={integer ? 'numeric' : 'decimal'}
          step={integer ? 1 : 'any'}
          min={numericConstraint(min)}
          max={numericConstraint(max)}
          required
          disabled={disabled}
          value={draft}
          onChange={(event) => {
            dirty.current = true;
            setDraft(event.target.value);
            setError('');
            event.currentTarget.setCustomValidity('');
          }}
          onBlur={apply}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              cancel();
              event.currentTarget.blur();
            }
          }}
        />
        <small>{unit}</small>
      </div>
      {error && (
        <span id={errorId} className="numeric-field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
