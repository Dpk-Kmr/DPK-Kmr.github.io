import { useMemo, useState } from 'react';
import { NumberField } from './Fields';
import type { HomeElement, StairConfig, StairStyle } from '../types';
import {
  defaultStairs,
  fitStairFootprint,
  sanitizeStairs,
  stairStats,
  STAIR_STYLES,
  suggestStepCount,
} from '../lib/stairs';
import './StairInspector.css';

interface Props {
  element: HomeElement;
  onChange: (patch: Partial<HomeElement>) => void;
  units: 'm' | 'ft';
}
interface NumberProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
  unit?: string;
  digits?: number;
}
function StairNumber({
  label,
  value,
  min,
  max,
  onCommit,
  disabled,
  unit,
  digits = 3,
}: NumberProps) {
  return (
    <NumberField
      label={label}
      value={value}
      min={min}
      max={max}
      onChange={onCommit}
      disabled={disabled}
      unit={unit ?? ''}
      digits={digits}
      integer={digits === 0}
      className="stair-number"
    />
  );
}

export function StairInspector({ element, onChange, units }: Props) {
  const config = sanitizeStairs(element.stairs);
  const stats = useMemo(
    () => stairStats(element),
    [element.dimensions, element.stairs],
  );
  const [targetRiser, setTargetRiser] = useState(0.175);
  const [targetGoing, setTargetGoing] = useState(0.28);
  const multiplier = units === 'ft' ? 3.280839895 : 1;
  const unit = units === 'ft' ? 'ft' : 'm';
  const turning = config.style === 'l-shaped' || config.style === 'u-shaped';
  const spiral = config.style === 'spiral';
  const change = (patch: Partial<StairConfig>) => {
    if (!element.locked)
      onChange({ stairs: sanitizeStairs({ ...config, ...patch }) });
  };
  const measurement = (
    label: string,
    field:
      | 'flightWidth'
      | 'landingDepth'
      | 'railingHeight'
      | 'treadThickness'
      | 'nosing'
      | 'innerRadius',
    min: number,
    max: number,
  ) => (
    <StairNumber
      key={field}
      label={label}
      value={config[field] * multiplier}
      min={min * multiplier}
      max={max * multiplier}
      unit={unit}
      disabled={element.locked}
      onCommit={(value) => change({ [field]: value / multiplier })}
    />
  );
  const distance = (value: number) =>
    `${(value * multiplier).toFixed(3)} ${unit}`;
  return (
    <section className="stair-inspector" aria-label="Stair design controls">
      <div className="stair-section-heading">
        <h3>Stair design</h3>
        <span>PARAMETRIC</span>
      </div>
      <label className="stair-select">
        <span>Design preset</span>
        <select
          aria-label="Stair design"
          value={config.style}
          disabled={element.locked}
          onChange={(event) => {
            const style = event.target.value as StairStyle;
            const preset = defaultStairs(style);
            change({ style, risers: preset.risers, stringer: preset.stringer });
          }}
        >
          {STAIR_STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </label>
      <div className="stair-fields">
        <StairNumber
          label="Step count"
          value={config.steps}
          min={3}
          max={64}
          digits={0}
          disabled={element.locked}
          onCommit={(steps) => change({ steps })}
        />
        <StairNumber
          label="Floor-to-floor rise"
          value={element.dimensions.height * multiplier}
          min={0.01 * multiplier}
          max={100 * multiplier}
          unit={unit}
          disabled={element.locked}
          onCommit={(height) =>
            onChange({
              dimensions: {
                ...element.dimensions,
                height: height / multiplier,
              },
            })
          }
        />
        <StairNumber
          label="Stair footprint width"
          value={element.dimensions.width * multiplier}
          min={0.01 * multiplier}
          max={100 * multiplier}
          unit={unit}
          disabled={element.locked}
          onCommit={(width) =>
            onChange({
              dimensions: { ...element.dimensions, width: width / multiplier },
            })
          }
        />
        <StairNumber
          label="Stair footprint depth"
          value={element.dimensions.depth * multiplier}
          min={0.01 * multiplier}
          max={100 * multiplier}
          unit={unit}
          disabled={element.locked}
          onCommit={(depth) =>
            onChange({
              dimensions: { ...element.dimensions, depth: depth / multiplier },
            })
          }
        />
        {measurement('Flight width', 'flightWidth', 0.4, 4)}
        {turning && measurement('Landing depth', 'landingDepth', 0.4, 6)}
        {(turning || spiral) && (
          <label className="stair-select">
            <span>Turn direction</span>
            <select
              aria-label="Stair turn direction"
              value={config.turnDirection}
              disabled={element.locked}
              onChange={(event) =>
                change({
                  turnDirection: event.target
                    .value as StairConfig['turnDirection'],
                })
              }
            >
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </label>
        )}
        {spiral && (
          <StairNumber
            label="Spiral turns"
            value={config.spiralTurns}
            min={0.5}
            max={3}
            digits={2}
            disabled={element.locked}
            onCommit={(spiralTurns) => change({ spiralTurns })}
          />
        )}
        {spiral && measurement('Inner radius', 'innerRadius', 0.06, 2)}
      </div>
      <div className="stair-statistics" aria-live="polite">
        <div>
          <span>Riser height</span>
          <strong>{distance(stats.riserHeight)}</strong>
        </div>
        <div>
          <span>{spiral ? 'Walk-line going' : 'Minimum going'}</span>
          <strong>{distance(stats.going)}</strong>
        </div>
        <div>
          <span>Pitch</span>
          <strong>{stats.pitch.toFixed(1)}°</strong>
        </div>
        <div>
          <span>Actual flight width</span>
          <strong>{distance(stats.effectiveWidth)}</strong>
        </div>
      </div>
      <p className="stair-note">
        Rise reaches the upper floor level. Railings extend above it. Geometry
        estimates; headroom, structure and local requirements need a project
        review.
      </p>
      {stats.conflicts.length > 0 && (
        <div className="stair-conflicts" role="status">
          <strong>Review this fit</strong>
          <ul>
            {stats.conflicts.map((conflict) => (
              <li key={conflict}>{conflict}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="stair-options" open>
        <summary>Treads & support</summary>
        <div className="stair-fields">
          {measurement('Tread thickness', 'treadThickness', 0.02, 0.25)}
          {measurement('Nosing', 'nosing', 0, 0.1)}
          <label className="stair-select">
            <span>Risers</span>
            <select
              aria-label="Stair risers"
              value={config.risers}
              disabled={element.locked}
              onChange={(event) =>
                change({ risers: event.target.value as StairConfig['risers'] })
              }
            >
              <option value="closed">Closed</option>
              <option value="open">Open</option>
            </select>
          </label>
          <label className="stair-select">
            <span>Support</span>
            <select
              aria-label="Stair support"
              value={config.stringer}
              disabled={element.locked}
              onChange={(event) =>
                change({
                  stringer: event.target.value as StairConfig['stringer'],
                })
              }
            >
              <option value="solid">Side stringers</option>
              <option value="central">Central spine</option>
              <option value="none">No stringer</option>
            </select>
          </label>
        </div>
      </details>
      <details className="stair-options" open>
        <summary>Handrails</summary>
        <div className="stair-fields">
          <label className="stair-select">
            <span>Railing sides</span>
            <select
              aria-label="Stair railing sides"
              value={config.railing}
              disabled={element.locked}
              onChange={(event) =>
                change({
                  railing: event.target.value as StairConfig['railing'],
                })
              }
            >
              <option value="both">Both sides</option>
              <option value="left">Left side</option>
              <option value="right">Right side</option>
              <option value="none">No railing</option>
            </select>
          </label>
          {config.railing !== 'none' &&
            measurement('Railing height', 'railingHeight', 0.3, 1.5)}
        </div>
      </details>
      <details className="stair-options stair-assistant" open>
        <summary>Design helpers</summary>
        <p>
          Apply a suggestion when you need it. Your dimensions and step count
          remain editable.
        </p>
        <div className="stair-helper-row">
          <StairNumber
            label="Target riser"
            value={targetRiser * multiplier}
            min={0.1 * multiplier}
            max={0.3 * multiplier}
            unit={unit}
            disabled={element.locked}
            onCommit={(value) => setTargetRiser(value / multiplier)}
          />
          <button
            type="button"
            disabled={element.locked}
            onClick={() =>
              change({
                steps: suggestStepCount(element.dimensions.height, targetRiser),
              })
            }
          >
            Suggest step count
          </button>
        </div>
        {!spiral && (
          <StairNumber
            label="Target going"
            value={targetGoing * multiplier}
            min={0.15 * multiplier}
            max={0.5 * multiplier}
            unit={unit}
            disabled={element.locked}
            onCommit={(value) => setTargetGoing(value / multiplier)}
          />
        )}
        <button
          type="button"
          className="stair-fit-button"
          disabled={element.locked}
          onClick={() =>
            onChange({ dimensions: fitStairFootprint(element, targetGoing) })
          }
        >
          Fit footprint
        </button>
        <p className="stair-note">
          {spiral
            ? 'Fits the diameter to the inner radius and flight width.'
            : 'Fits width and depth to the chosen flight width, landing and target going.'}{' '}
          Floor-to-floor rise is preserved.
        </p>
      </details>
    </section>
  );
}

export default StairInspector;
