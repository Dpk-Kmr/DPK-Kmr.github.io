import { useEffect, useRef, useState } from 'react';
import { NumberField } from './Fields';
import {
  ChevronDown,
  CircleDot,
  Droplets,
  MousePointer2,
  Plus,
  Route,
  Trash2,
  WandSparkles,
  Zap,
} from 'lucide-react';
import type { Project, UtilityConnection } from '../types';
import {
  changeConnectionEndpoint,
  connectionLocalPoints,
  connectionWorldLength,
  getConnections,
  isConnectionEndpoint,
} from '../lib/connections';
import { createId } from '../lib/id';
import { validateProject } from '../lib/project';
import { getActiveLevel, getLevels } from '../lib/levels';
import './ConnectionsEditor.css';

interface ConnectionsEditorProps {
  project: Project;
  onChange: (project: Project) => void;
  onSelectElement: (id: string) => void;
  notify: (message: string) => void;
  units: 'm' | 'ft';
}

function RouteNumber(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void | boolean;
}) {
  return <NumberField {...props} className="connection-number" />;
}

function RouteText({
  label,
  value,
  onChange,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  useEffect(() => setDraft(value), [value]);
  const apply = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = draft.trim();
    if (!allowEmpty && !next) {
      setDraft(value);
      return;
    }
    if (next !== value) onChange(next);
  };
  return (
    <label className="connection-text">
      <span>{label}</span>
      <input
        value={draft}
        maxLength={100}
        aria-label={label}
        placeholder={allowEmpty ? 'Optional drawing label' : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            cancelled.current = true;
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export default function ConnectionsEditor({
  project,
  onChange,
  onSelectElement,
  notify,
  units,
}: ConnectionsEditorProps) {
  const [system, setSystem] =
    useState<UtilityConnection['system']>('electrical');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState<'all' | 'active' | 'cross'>('all');
  const levels = getLevels(project);
  const activeLevel = getActiveLevel(project);
  const endpointLevel = (id: string) => {
    const element = project.elements.find((entry) => entry.id === id);
    return (
      element?.levelId ??
      project.rooms.find((room) => room.id === element?.roomId)?.levelId ??
      activeLevel.id
    );
  };
  const floorName = (id: string) =>
    levels.find((level) => level.id === endpointLevel(id))?.name ??
    activeLevel.name;
  const routes = getConnections(project);
  const filtered = routes.filter(
    (route) =>
      route.system === system &&
      (scope === 'all' ||
        (scope === 'cross'
          ? endpointLevel(route.fromId) !== endpointLevel(route.toId)
          : endpointLevel(route.fromId) === activeLevel.id ||
            endpointLevel(route.toId) === activeLevel.id)),
  );
  const selected = filtered.find((route) => route.id === selectedId) ?? null;
  const endpoints = project.elements.filter((element) =>
    isConnectionEndpoint(element, system),
  );
  const factor = units === 'ft' ? 3.28084 : 1;
  const length = (route: UtilityConnection) =>
    `${(connectionWorldLength(route, project) * factor).toFixed(2)} ${units}`;
  const commit = (connections: UtilityConnection[]) => {
    try {
      onChange(validateProject({ ...project, connections }));
      return true;
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'This connection could not be updated.',
      );
      return false;
    }
  };
  const update = (id: string, patch: Partial<UtilityConnection>) =>
    commit(
      routes.map((route) => (route.id === id ? { ...route, ...patch } : route)),
    );
  const add = () => {
    if (routes.length >= 2000) {
      notify(
        'The project already has 2,000 connections. Remove a route before adding another.',
      );
      return;
    }
    if (endpoints.length < 2) {
      notify(
        `Add at least two ${system === 'electrical' ? 'electrical ports' : 'water ports or fixtures'} from the library first.`,
      );
      return;
    }
    const source =
      endpoints.find(
        (element) =>
          element.kind ===
          (system === 'electrical' ? 'electrical-panel' : 'water-port'),
      ) ?? endpoints[0];
    const destination = endpoints.find((element) => element.id !== source.id)!;
    const route: UtilityConnection = {
      id: createId(),
      name: `${system === 'electrical' ? 'Electrical' : 'Water'} route ${filtered.length + 1}`,
      fromId: source.id,
      toId: destination.id,
      system,
      waypoints: [],
      enabled: true,
      size: system === 'electrical' ? 20 : 25,
      label: '',
    };
    if (commit([...routes, route])) {
      setScope('all');
      setSelectedId(route.id);
      notify(
        'Connection added. Choose its endpoints and shape the route below.',
      );
    }
  };
  const remove = (id: string) => {
    if (commit(routes.filter((route) => route.id !== id))) {
      setSelectedId(null);
      notify('Connection removed. Undo to restore it.');
    }
  };
  const changeSystem = (next: UtilityConnection['system']) => {
    if (!selected || next === selected.system) return;
    const candidates = project.elements.filter((element) =>
      isConnectionEndpoint(element, next),
    );
    if (candidates.length < 2) {
      notify(
        `Add two compatible ${next} elements to change this route's system.`,
      );
      return;
    }
    const source =
      candidates.find(
        (element) =>
          element.kind ===
          (next === 'electrical' ? 'electrical-panel' : 'water-port'),
      ) ?? candidates[0];
    const destination = candidates.find((element) => element.id !== source.id)!;
    if (
      update(selected.id, {
        system: next,
        fromId: source.id,
        toId: destination.id,
        waypoints: [],
        size: next === 'electrical' ? 20 : 25,
      })
    ) {
      setSystem(next);
      setScope('all');
    }
  };
  const addBend = () => {
    if (!selected || selected.waypoints.length >= 30) return;
    const points = connectionLocalPoints(selected, project);
    if (points.length < 2) return;
    if (!selected.waypoints.length && points.length > 2) {
      update(selected.id, { waypoints: points.slice(1, -1) });
      return;
    }
    const from = selected.waypoints.at(-1) ?? points[0],
      to = points.at(-1)!;
    update(selected.id, {
      waypoints: [
        ...selected.waypoints,
        [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
      ],
    });
  };

  return (
    <section className="connections-editor" aria-label="Connection editor">
      <div className="connections-heading">
        <div>
          <span className="connection-eyebrow">BEHIND THE WALLS</span>
          <h3>Shape the connections.</h3>
        </div>
        <Route size={19} />
      </div>
      <p className="connections-intro">
        {levels.length > 1
          ? `Connect ports across all ${levels.length} floors. Choose the endpoints and edit every bend.`
          : 'Choose where each line goes. Every bend is yours to edit.'}
      </p>
      <div className="connection-system-tabs">
        <button
          type="button"
          className={system === 'electrical' ? 'active electrical' : ''}
          onClick={() => {
            setSystem('electrical');
            setSelectedId(null);
          }}
        >
          <Zap size={14} />
          Electrical
          <span>
            {routes.filter((route) => route.system === 'electrical').length}
          </span>
        </button>
        <button
          type="button"
          className={system === 'plumbing' ? 'active plumbing' : ''}
          onClick={() => {
            setSystem('plumbing');
            setSelectedId(null);
          }}
        >
          <Droplets size={14} />
          Water
          <span>
            {routes.filter((route) => route.system === 'plumbing').length}
          </span>
        </button>
      </div>
      {levels.length > 1 && (
        <label className="connection-select connection-floor-filter">
          <span>Show routes</span>
          <select
            aria-label="Route floor filter"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value as typeof scope);
              setSelectedId(null);
            }}
          >
            <option value="all">All building floors</option>
            <option value="active">Touching {activeLevel.name}</option>
            <option value="cross">Between floors only</option>
          </select>
        </label>
      )}
      <div className="connection-list">
        {filtered.map((route) => (
          <div
            key={route.id}
            className={`connection-row ${selected?.id === route.id ? 'selected' : ''}`}
          >
            <button
              type="button"
              className="connection-row-main"
              onClick={() =>
                setSelectedId(selected?.id === route.id ? null : route.id)
              }
              aria-expanded={selected?.id === route.id}
            >
              <span
                className={`connection-dot ${route.system} ${!route.enabled ? 'muted' : ''}`}
              />
              <span>
                <strong>{route.name}</strong>
                <small>
                  {length(route)} ·{' '}
                  {route.waypoints.length
                    ? `${route.waypoints.length} bends`
                    : 'Automatic route'}
                </small>
                {levels.length > 1 && (
                  <small className="connection-floor-pair">
                    {floorName(route.fromId)}
                    {endpointLevel(route.fromId) !== endpointLevel(route.toId)
                      ? ` → ${floorName(route.toId)}`
                      : ''}
                  </small>
                )}
              </span>
              <ChevronDown size={13} />
            </button>
            <label
              className="connection-enabled"
              title={route.enabled ? 'Hide route' : 'Show route'}
            >
              <input
                type="checkbox"
                checked={route.enabled}
                aria-label={`Enable ${route.name}`}
                onChange={(event) =>
                  update(route.id, { enabled: event.target.checked })
                }
              />
              <span />
            </label>
          </div>
        ))}
      </div>
      {!filtered.length && (
        <div className="connections-empty">
          <Route size={23} />
          <strong>Your next connection starts here.</strong>
          <span>
            {endpoints.length < 2
              ? `Add ${system === 'electrical' ? 'outlets, switches or a panel' : 'water ports or fixtures'} from the library, then connect them.`
              : 'Connect two elements and trace the route between them.'}
          </span>
        </div>
      )}
      <button type="button" className="connection-add" onClick={add}>
        <Plus size={14} />
        Add {system === 'electrical' ? 'electrical' : 'water'} connection
      </button>
      {selected && (
        <div className="connection-detail" key={selected.id}>
          <div className="connection-detail-heading">
            <span>ROUTE DETAILS</span>
            <button
              type="button"
              onClick={() => remove(selected.id)}
              aria-label="Delete connection"
              title="Delete connection"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <RouteText
            label="Connection name"
            value={selected.name}
            onChange={(name) => update(selected.id, { name })}
          />
          <label className="connection-select">
            <span>System</span>
            <select
              aria-label="Connection system"
              value={selected.system}
              onChange={(event) =>
                changeSystem(event.target.value as UtilityConnection['system'])
              }
            >
              <option value="electrical">Electrical</option>
              <option value="plumbing">Water supply</option>
            </select>
          </label>
          {(['fromId', 'toId'] as const).map((key, index) => (
            <div className="connection-endpoint" key={key}>
              <label className="connection-select">
                <span>
                  <CircleDot size={11} />
                  {index === 0 ? 'From' : 'To'}
                </span>
                <select
                  aria-label={
                    index === 0 ? 'Connection source' : 'Connection destination'
                  }
                  value={selected[key]}
                  onChange={(event) => {
                    try {
                      update(
                        selected.id,
                        changeConnectionEndpoint(
                          project,
                          selected,
                          key,
                          event.target.value,
                        ),
                      );
                    } catch (error) {
                      notify(
                        error instanceof Error
                          ? error.message
                          : 'This endpoint could not be changed.',
                      );
                    }
                  }}
                >
                  {endpoints
                    .filter(
                      (element) =>
                        element.id !==
                        selected[key === 'fromId' ? 'toId' : 'fromId'],
                    )
                    .map((element) => (
                      <option key={element.id} value={element.id}>
                        {element.name}
                        {levels.length > 1 ? ` · ${floorName(element.id)}` : ''}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                aria-label={
                  index === 0
                    ? 'Inspect source element'
                    : 'Inspect destination element'
                }
                title="Inspect this element"
                onClick={() => onSelectElement(selected[key])}
              >
                <MousePointer2 size={14} />
              </button>
            </div>
          ))}
          <div className="connection-size">
            <RouteNumber
              label={
                selected.system === 'electrical'
                  ? 'Conduit diameter'
                  : 'Pipe diameter'
              }
              value={selected.size}
              min={1}
              max={300}
              unit="mm"
              onChange={(size) => update(selected.id, { size })}
            />
            <div>
              <span>Route length</span>
              <strong>{length(selected)}</strong>
            </div>
          </div>
          <RouteText
            label="Drawing label"
            value={selected.label}
            allowEmpty
            onChange={(label) => update(selected.id, { label })}
          />
          <div className="connection-bends-heading">
            <strong>Route bends</strong>
            <button
              type="button"
              onClick={() => update(selected.id, { waypoints: [] })}
              disabled={!selected.waypoints.length}
            >
              <WandSparkles size={12} />
              Automatic
            </button>
          </div>
          {levels.length > 1 && (
            <p className="connection-coordinate-note">
              Bend Y is relative to{' '}
              <strong>{floorName(selected.fromId)}</strong>. Negative Y runs
              below that floor. Changing the source floor preserves existing
              bends in the building.
            </p>
          )}
          {!selected.waypoints.length && (
            <p className="connection-auto-note">
              The automatic route follows the endpoints. Add bends to choose its
              path.
            </p>
          )}
          {selected.waypoints.map((point, index) => (
            <div className="connection-bend" key={`${selected.id}-${index}`}>
              <div className="connection-bend-title">
                <span>
                  <i>{index + 1}</i>Bend {index + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Remove bend ${index + 1}`}
                  onClick={() =>
                    update(selected.id, {
                      waypoints: selected.waypoints.filter(
                        (_, bendIndex) => bendIndex !== index,
                      ),
                    })
                  }
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="connection-bend-coordinates">
                {(['X', 'Y', 'Z'] as const).map((axis, axisIndex) => (
                  <RouteNumber
                    key={axis}
                    label={`Bend ${index + 1} ${axis}`}
                    value={point[axisIndex] * factor}
                    min={-100 * factor}
                    max={100 * factor}
                    unit={units}
                    onChange={(value) => {
                      const waypoints = selected.waypoints.map(
                        (bend) => [...bend] as [number, number, number],
                      );
                      waypoints[index][axisIndex] = value / factor;
                      return update(selected.id, { waypoints });
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="connection-add-bend"
            disabled={selected.waypoints.length >= 30}
            onClick={addBend}
          >
            <Plus size={13} />
            Add bend<span>{selected.waypoints.length}/30</span>
          </button>
          <p className="connection-footnote">
            Bends stay at their coordinates. Endpoints follow their elements.
            Routes are schematic design guides.
          </p>
        </div>
      )}
    </section>
  );
}
