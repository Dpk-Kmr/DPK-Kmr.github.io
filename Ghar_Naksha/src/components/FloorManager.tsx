import { useEffect, useRef, useState } from 'react';
import { Copy, Layers3, Plus, Trash2 } from 'lucide-react';
import type { Project } from '../types';
import {
  addLevel,
  cloneLevel,
  deleteLevel,
  getActiveLevel,
  getLevels,
  renameLevel,
  setLevelElevation,
} from '../lib/levels';
import { floorArea } from '../lib/floor';
import { NumberField } from './Fields';
import './FloorManager.css';

export interface FloorManagerProps {
  project: Project;
  onChange: (project: Project) => void;
  activeLevelId: string;
  onSelectLevel: (id: string) => void;
  units?: 'm' | 'ft';
  notify?: (message: string) => void;
}

export default function FloorManager({
  project,
  onChange,
  activeLevelId,
  onSelectLevel,
  units = 'm',
  notify,
}: FloorManagerProps) {
  const levels = getLevels(project);
  const active =
    levels.find((level) => level.id === activeLevelId) ??
    getActiveLevel(project);
  const [name, setName] = useState(active.name);
  const [error, setError] = useState('');
  const cancelName = useRef(false);
  const factor = units === 'ft' ? 3.28084 : 1;
  useEffect(() => {
    setName(active.name);
    setError('');
  }, [active.id, active.name]);

  const change = (operation: () => Project, message?: string): boolean => {
    try {
      const next = operation();
      onChange(next);
      setError('');
      if (message) notify?.(message);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'This floor change could not be applied.',
      );
      return false;
    }
  };
  const rename = () => {
    if (cancelName.current) {
      cancelName.current = false;
      return;
    }
    if (name === active.name) return;
    if (!change(() => renameLevel(project, active.id, name.trim())))
      setName(active.name);
  };

  return (
    <section className="floor-manager" aria-label="Building floors">
      <div className="floor-manager-heading">
        <span className="floor-manager-icon">
          <Layers3 size={18} />
        </span>
        <div>
          <h3>Building floors</h3>
          <p>
            {levels.length} {levels.length === 1 ? 'floor' : 'floors'} · edit
            one, explore all
          </p>
        </div>
      </div>
      <div
        className="floor-manager-list"
        role="group"
        aria-label="Choose a floor"
      >
        {[...levels]
          .sort((a, b) => b.elevation - a.elevation)
          .map((level) => (
            <button
              key={level.id}
              type="button"
              className={level.id === active.id ? 'active' : ''}
              aria-pressed={level.id === active.id}
              aria-label={`Edit floor ${level.name}`}
              onClick={() => onSelectLevel(level.id)}
            >
              <span className="floor-manager-layer">
                <Layers3 size={15} />
              </span>
              <span>
                <strong>{level.name}</strong>
                <small>
                  {(floorArea(level.floorPlan) * factor ** 2).toFixed(1)}{' '}
                  {units}²
                </small>
              </span>
              <em>
                {level.elevation > 0 ? '+' : ''}
                {(level.elevation * factor).toFixed(2)} {units}
              </em>
            </button>
          ))}
      </div>
      <div className="floor-manager-actions">
        <button
          type="button"
          onClick={() =>
            change(
              () => addLevel(project),
              'New floor added above the building.',
            )
          }
          disabled={levels.length >= 32}
        >
          <Plus size={15} /> Add floor
        </button>
        <button
          type="button"
          onClick={() =>
            change(
              () => cloneLevel(project, active.id),
              'Floor copied with its rooms, elements and routes.',
            )
          }
          disabled={levels.length >= 32}
        >
          <Copy size={14} /> Copy floor
        </button>
      </div>
      <label className="floor-manager-name">
        <span>Floor name</span>
        <input
          aria-label="Floor name"
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          onBlur={rename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              cancelName.current = true;
              setName(active.name);
              event.currentTarget.blur();
            }
          }}
        />
      </label>
      <NumberField
        label="Floor elevation"
        value={active.elevation * factor}
        unit={units}
        min={-100 * factor}
        max={100 * factor}
        digits={2}
        onChange={(value) =>
          change(() => setLevelElevation(project, active.id, value / factor))
        }
      />
      <p className="floor-manager-help">
        Elevation is measured from ground level. Use a negative value for a
        basement. Linked stairs adjust their rise when elevations change.
      </p>
      <button
        type="button"
        className="floor-manager-remove"
        disabled={levels.length === 1}
        onClick={() =>
          change(
            () => deleteLevel(project, active.id),
            'Floor removed. Undo restores its contents.',
          )
        }
      >
        <Trash2 size={14} /> Remove this floor
      </button>
      {error && (
        <p className="floor-manager-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
