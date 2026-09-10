import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentType } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Armchair,
  BedDouble,
  Box,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  ClipboardPaste,
  Scissors,
  Share2,
  Users,
  CheckSquare,
  Droplets,
  Eye,
  EyeOff,
  FileJson,
  FolderOpen,
  Footprints,
  Grid2X2,
  House,
  LampDesk,
  Layers3,
  Leaf,
  LockKeyhole,
  Maximize,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Move,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Ruler,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  UnlockKeyhole,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { catalog, createElement, initialProject } from './data';
import type {
  CatalogItem,
  FloorPlan,
  HomeElement,
  Layers,
  Material,
  Project,
  Room,
  ViewMode,
  UtilityConnection,
  ToolMode,
} from './types';
import {
  ELECTRICAL_KINDS,
  PLUMBING_KINDS,
  STRUCTURAL_KINDS,
  FLOOR_ID,
} from './types';
import {
  downloadProject,
  loadProject,
  saveProject,
  validateProject,
} from './lib/project';
import { makeRoom, updateRoom } from './lib/rooms';
import {
  floorArea,
  getFloorPlan,
  roomFitsFloor,
  findRoomPlacement,
  resizeFloor,
} from './lib/floor';
import { getConnections, removeDanglingConnections } from './lib/connections';
import { attachToNearestWall, syncWallAttachments } from './lib/openings';
import {
  makeFloorProject,
  rebuildPerimeter,
  floorContainer,
  fitElementToSpace,
} from './lib/design';
import FloorEditor, {
  DEFAULT_FLOOR,
  FloorInspector,
} from './components/FloorEditor';
import ConnectionsEditor from './components/ConnectionsEditor';
import { StairInspector } from './components/StairInspector';
import ElementThumbnail from './components/ElementThumbnail';
import PlanView from './components/PlanView';
import { NumberField as NumericField } from './components/Fields';
import FloorManager from './components/FloorManager';
import ShareProject from './components/ShareProject';
import {
  getActiveLevel,
  getLevels,
  getLevelProject,
  mergeLevelProject,
  fitStairsToLevel,
} from './lib/levels';
import {
  copyElements,
  pasteElements,
  type ElementClipboard,
} from './lib/clipboard';
import { readShareLink } from './lib/share';

const Scene = lazy(() => import('./components/Scene'));
type IconType = ComponentType<LucideProps>;
const roomIcons: Record<string, IconType> = {
  living: Sofa,
  kitchen: LampDesk,
  master: BedDouble,
  bedroom: BedDouble,
  bath: Droplets,
};
const materialOptions: Material[] = [
  'fabric',
  'wood',
  'stone',
  'ceramic',
  'metal',
  'plaster',
  'glass',
];
const swatches = [
  '#e4dfd1',
  '#b9bda4',
  '#71806a',
  '#a8754d',
  '#9b7854',
  '#738d9a',
  '#424b46',
  '#f4f2eb',
];
const clone = <T,>(value: T): T => structuredClone(value);

function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  className = '',
}: {
  icon: IconType;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'active' : ''} ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={18} strokeWidth={1.65} />
    </button>
  );
}

function useProject() {
  const [project, setProject] = useState<Project>(() =>
    loadProject(clone(initialProject)),
  );
  const current = useRef(project);
  const history = useRef<{ past: Project[]; future: Project[] }>({
    past: [],
    future: [],
  });
  const commit = useCallback(
    (change: Project | ((previous: Project) => Project)) => {
      const candidate =
        typeof change === 'function' ? change(current.current) : change;
      const next = validateProject(
        removeDanglingConnections(syncWallAttachments(candidate)),
      );
      if (JSON.stringify(next) === JSON.stringify(current.current)) return;
      history.current.past = [
        ...history.current.past.slice(-49),
        current.current,
      ];
      history.current.future = [];
      current.current = next;
      setProject(next);
    },
    [],
  );
  const undo = useCallback(() => {
    const prev = history.current.past.pop();
    if (prev) {
      history.current.future.push(current.current);
      current.current = prev;
      setProject(prev);
    }
  }, []);
  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (next) {
      history.current.past.push(current.current);
      current.current = next;
      setProject(next);
    }
  }, []);
  const changeActiveLevel = useCallback((id: string) => {
    const level = getLevels(current.current).find((item) => item.id === id);
    if (!level || current.current.activeLevelId === id) return;
    const next = {
      ...current.current,
      activeLevelId: id,
      floorPlan: level.floorPlan,
    };
    current.current = next;
    setProject(next);
  }, []);
  return {
    project,
    commit,
    changeActiveLevel,
    undo,
    redo,
    canUndo: history.current.past.length > 0,
    canRedo: history.current.future.length > 0,
  };
}

export default function App() {
  const {
    project: buildingProject,
    commit: commitBuilding,
    changeActiveLevel,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useProject();
  const activeLevel = getActiveLevel(buildingProject);
  const activeLevelId = activeLevel.id;
  const project = useMemo(
    () => getLevelProject(buildingProject, activeLevelId),
    [buildingProject, activeLevelId],
  );
  const commit = useCallback(
    (change: Project | ((previous: Project) => Project)) => {
      commitBuilding((previous) => {
        const id = getActiveLevel(previous).id;
        const view = getLevelProject(previous, id);
        return mergeLevelProject(
          previous,
          typeof change === 'function' ? change(view) : change,
          id,
        );
      });
    },
    [commitBuilding],
  );
  const [selectedId, setSelectedId] = useState<string | null>('living-sofa');
  const [selectedIds, setSelectedIds] = useState<string[]>(['living-sofa']);
  const [multiSelect, setMultiSelect] = useState(false);
  const [elementClipboard, setElementClipboard] =
    useState<ElementClipboard | null>(null);
  const [showAllLevels, setShowAllLevels] = useState(false);
  const [walkthroughSettings, setWalkthroughSettings] = useState<{
    height: number;
    camera: 'first' | 'follow' | 'front';
  }>({ height: 1.75, camera: 'follow' });
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [tool, setTool] = useState<ToolMode>('select');
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null);
  const [cameraAction, setCameraAction] = useState<{
    type: 'reset' | 'zoom-in' | 'zoom-out' | 'focus';
    nonce: number;
  }>({ type: 'reset', nonce: 0 });
  const [sidebarTab, setSidebarTab] = useState<'rooms' | 'library'>('rooms');
  const [category, setCategory] = useState('All');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [systemsEditing, setSystemsEditing] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [search, setSearch] = useState('');
  const [inspectorTab, setInspectorTab] = useState<
    'properties' | 'materials' | 'stairs'
  >('properties');
  const [layers, setLayers] = useState<Layers>({
    furniture: true,
    electrical: false,
    plumbing: false,
    dimensions: false,
    labels: true,
    walls: true,
  });
  const [layersOpen, setLayersOpen] = useState(false);
  const [units, setUnits] = useState<'m' | 'ft'>(() => {
    try {
      return localStorage.getItem('ghar-naksha-units') === 'ft' ? 'ft' : 'm';
    } catch {
      return 'm';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('ghar-naksha-units', units);
    } catch {
      /* Editing still works when storage is unavailable. */
    }
  }, [units]);
  const [dialog, setDialog] = useState<
    'help' | 'project' | 'export' | 'new' | 'room' | 'floors' | 'share' | null
  >(null);
  const [projectName, setProjectName] = useState(project.name);
  const [newProjectName, setNewProjectName] = useState('My new home');
  const [newRoomName, setNewRoomName] = useState('Living room');
  const [newRoomWidth, setNewRoomWidth] = useState(6);
  const [newRoomDepth, setNewRoomDepth] = useState(5);
  const [newFloor, setNewFloor] = useState<FloorPlan>(
    structuredClone(DEFAULT_FLOOR),
  );
  const [withPerimeterWalls, setWithPerimeterWalls] = useState(true);
  const [roomPlacement, setRoomPlacement] = useState<'auto' | 'manual'>('auto');
  const [newRoomX, setNewRoomX] = useState(0);
  const [newRoomZ, setNewRoomZ] = useState(0);
  const [toast, setToast] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>(
    'saving',
  );
  const [savedProject, setSavedProject] = useState<Project | null>(null);
  const effectiveSaveStatus =
    saveStatus === 'error'
      ? 'error'
      : savedProject === buildingProject
        ? 'saved'
        : 'saving';
  const [objectsOpen, setObjectsOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<
    'spaces' | 'properties' | null
  >(null);
  const importRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const selected = project.elements.find(
    (element) => element.id === selectedId,
  );
  const focusedRoom = project.rooms.find((room) => room.id === focusRoomId);
  const selectedRoom = project.rooms.find(
    (room) => room.id === selected?.roomId,
  );
  useEffect(() => {
    if (selected?.kind === 'stairs') setInspectorTab('stairs');
    else
      setInspectorTab((previous) =>
        previous === 'stairs' ? 'properties' : previous,
      );
  }, [selected?.id, selected?.kind]);
  const factor = units === 'ft' ? 3.28084 : 1;
  const totalFloor = getFloorPlan(project);
  const totalArea = floorArea(totalFloor);
  const proposedRoomPosition =
    dialog === 'room'
      ? roomPlacement === 'auto'
        ? findRoomPlacement(project, newRoomWidth, newRoomDepth)
        : ([newRoomX, newRoomZ] as [number, number])
      : null;
  const area = (value: number) =>
    `${(value * factor * factor).toFixed(units === 'm' ? 0 : 1)} ${units}²`;
  const objectCount = project.elements.filter(
    (element) =>
      (!STRUCTURAL_KINDS.includes(element.kind) || element.kind === 'stairs') &&
      !ELECTRICAL_KINDS.includes(element.kind) &&
      !PLUMBING_KINDS.includes(element.kind),
  ).length;

  const notify = useCallback((message: string) => setToast(message), []);
  const selectionIds = useMemo(
    () =>
      selectedIds.filter((id) =>
        project.elements.some((element) => element.id === id),
      ),
    [selectedIds, project.elements],
  );
  const selectedElements = useMemo(
    () =>
      project.elements.filter((element) => selectionIds.includes(element.id)),
    [project.elements, selectionIds],
  );
  const previousLevelId = useRef(activeLevelId);
  const pasteCount = useRef(0);
  useEffect(() => {
    if (previousLevelId.current === activeLevelId) return;
    previousLevelId.current = activeLevelId;
    setSelectedId((previous) =>
      project.elements.some((element) => element.id === previous)
        ? previous
        : null,
    );
    setSelectedIds((previous) =>
      previous.filter((id) =>
        project.elements.some((element) => element.id === id),
      ),
    );
    setFocusRoomId(null);
    setSystemsEditing(false);
    if (viewMode !== 'walk')
      setCameraAction((previous) => ({
        type: 'reset',
        nonce: previous.nonce + 1,
      }));
  }, [activeLevelId, project.elements, viewMode]);
  useEffect(() => {
    let current = true;
    let generation = 0;
    const openSnapshot = () => {
      const request = ++generation;
      if (!location.hash.startsWith('#home=')) return;
      readShareLink(location.href)
        .then((snapshot) => {
          if (!current || request !== generation || !snapshot) return;
          commitBuilding(snapshot);
          setSelectedId(null);
          setSelectedIds([]);
          setFocusRoomId(null);
          setSystemsEditing(false);
          setPaletteOpen(false);
          setDialog(null);
          setViewMode('2d');
          setCameraAction((previous) => ({
            type: 'reset',
            nonce: previous.nonce + 1,
          }));
          window.history.replaceState(
            null,
            '',
            `${location.pathname}${location.search}`,
          );
          notify('Shared snapshot opened. Your edits save on this device.');
        })
        .catch((error) => {
          if (current && request === generation)
            notify(
              error instanceof Error
                ? error.message
                : 'This snapshot could not be opened.',
            );
        });
    };
    openSnapshot();
    window.addEventListener('hashchange', openSnapshot);
    return () => {
      current = false;
      window.removeEventListener('hashchange', openSnapshot);
    };
  }, [commitBuilding, notify]);
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(''), 3600);
      return () => clearTimeout(timeout);
    }
  }, [toast]);
  useEffect(() => {
    setSaveStatus('saving');
    const timeout = setTimeout(() => {
      try {
        saveProject(buildingProject);
        setSavedProject(buildingProject);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [buildingProject]);
  useEffect(() => {
    setProjectName(project.name);
  }, [project.name]);
  useEffect(() => {
    const flush = () => {
      try {
        saveProject(buildingProject);
      } catch {
        /* Export remains available if browser storage is full. */
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [buildingProject]);

  const updateElement = useCallback(
    (id: string, patch: Partial<HomeElement>) => {
      if (patch.rotation !== undefined && !patch.wallAttachment)
        patch = { ...patch, wallAttachment: undefined };
      if (patch.position)
        patch = {
          ...patch,
          position: patch.position.map((value, index) =>
            Math.min(
              100,
              Math.max(
                index === 1 ? 0 : -100,
                Number.isFinite(value) ? value : 0,
              ),
            ),
          ) as HomeElement['position'],
          ...(patch.wallAttachment ? {} : { wallAttachment: undefined }),
        };
      try {
        let disconnectedStair = false;
        commit((previous) => ({
          ...previous,
          elements: previous.elements.map((element) => {
            if (element.id !== id) return element;
            const next = { ...element, ...patch };
            if (next.kind === 'stairs' && next.connectsToLevelId) {
              if (
                patch.dimensions &&
                Math.abs(patch.dimensions.height - element.dimensions.height) >
                  1e-7
              ) {
                delete next.connectsToLevelId;
                disconnectedStair = true;
              } else if (
                patch.position &&
                patch.position[1] !== element.position[1]
              ) {
                const target = getLevels(previous).find(
                  (level) => level.id === next.connectsToLevelId,
                )!;
                const rise =
                  target.elevation -
                  getActiveLevel(previous).elevation -
                  next.position[1];
                if (rise < 0.1)
                  throw new Error(
                    'The staircase base must stay below its destination. Unlink it to set a manual rise.',
                  );
                next.dimensions = { ...next.dimensions, height: rise };
              }
            }
            return next;
          }),
        }));
        if (disconnectedStair)
          notify(
            'Manual stair rise applied. Choose a destination floor again to fit its rise for walking between floors.',
          );
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : 'This change could not be applied.',
        );
      }
    },
    [commit, notify],
  );
  const selectElement = useCallback(
    (id: string | null, additive = false) => {
      const target = buildingProject.elements.find(
        (element) => element.id === id,
      );
      const anotherLevel = target?.levelId && target.levelId !== activeLevelId;
      if (anotherLevel) changeActiveLevel(target.levelId!);
      if (!id || id === FLOOR_ID) {
        setSelectedId(id);
        setSelectedIds([]);
      } else if ((additive || multiSelect) && !anotherLevel) {
        const next = selectedIds.includes(id)
          ? selectedIds.filter((item) => item !== id)
          : [...selectedIds, id];
        setSelectedId(next.at(-1) ?? null);
        setSelectedIds(next);
      } else {
        setSelectedId(id);
        setSelectedIds([id]);
      }
      setSystemsEditing(false);
      if (id) setPaletteOpen(false);
      if (id === null || id === FLOOR_ID) setFocusRoomId(null);
    },
    [
      multiSelect,
      selectedIds,
      buildingProject.elements,
      activeLevelId,
      changeActiveLevel,
    ],
  );
  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    setSelectedId(ids.at(-1) ?? null);
    setFocusRoomId(null);
    setSystemsEditing(false);
    if (ids.length) setPaletteOpen(false);
  }, []);
  const updateElements = useCallback(
    (
      updates: { id: string; patch: Partial<HomeElement> }[],
      connections?: UtilityConnection[],
    ) => {
      try {
        const byId = new Map(
          updates.map((update) => [update.id, update.patch]),
        );
        commit((previous) => ({
          ...previous,
          elements: previous.elements.map((element) =>
            byId.has(element.id) && !element.locked
              ? { ...element, ...byId.get(element.id) }
              : element,
          ),
          ...(connections ? { connections } : {}),
        }));
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : 'The group edit could not be applied.',
        );
      }
    },
    [commit, notify],
  );
  const editConnections = () => {
    setPaletteOpen(false);
    const routes = getConnections(project);
    setLayers((previous) => ({
      ...previous,
      electrical:
        previous.electrical ||
        routes.some((r) => r.system === 'electrical' && r.enabled),
      plumbing:
        previous.plumbing ||
        routes.some((r) => r.system === 'plumbing' && r.enabled),
    }));
    setSystemsEditing(true);
    setSelectedId(null);
    setSelectedIds([]);
    setFocusRoomId(null);
    setMobilePanel('properties');
  };
  const camera = (type: typeof cameraAction.type) =>
    setCameraAction((previous) => ({ type, nonce: previous.nonce + 1 }));
  const selectRoom = (id: string | null, focus = true) => {
    setPaletteOpen(false);
    setSystemsEditing(false);
    setFocusRoomId(id);
    setSelectedId(null);
    setSelectedIds([]);
    if (focus) camera(id ? 'focus' : 'reset');
    setMobilePanel(null);
  };
  const deleteSelected = useCallback(() => {
    const ids = new Set(
      selectedElements
        .filter((element) => !element.locked)
        .map((element) => element.id),
    );
    if (!ids.size) return;
    try {
      commit((previous) => ({
        ...previous,
        elements: previous.elements.filter((element) => !ids.has(element.id)),
      }));
      selectMany([]);
      notify(
        `${ids.size} ${ids.size === 1 ? 'element' : 'elements'} removed. You can undo this.`,
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'The selection could not be removed.',
      );
    }
  }, [selectedElements, commit, notify, selectMany]);
  const copySelection = useCallback(
    (cut = false) => {
      const ids = cut
        ? selectedElements
            .filter((element) => !element.locked)
            .map((element) => element.id)
        : selectionIds;
      const bundle = copyElements(project, ids);
      if (!bundle) return;
      setElementClipboard(bundle);
      pasteCount.current = 0;
      if (cut) deleteSelected();
      notify(
        `${bundle.elements.length} ${bundle.elements.length === 1 ? 'element' : 'elements'} ${cut ? 'cut' : 'copied'}. Paste onto any floor.`,
      );
    },
    [project, selectedElements, selectionIds, deleteSelected, notify],
  );
  const pasteSelection = useCallback(
    (bundle = elementClipboard, duplicate = false) => {
      if (!bundle) return;
      if (buildingProject.elements.length + bundle.elements.length > 2000) {
        notify('Project limit reached. Remove elements before pasting.');
        return;
      }
      try {
        const distance = duplicate ? 0.4 : 0.5 * (pasteCount.current + 1);
        const pasted = pasteElements(project, bundle, [distance, distance]);
        commit(pasted.project);
        selectMany(pasted.selectedIds);
        if (!duplicate) pasteCount.current += 1;
        notify(
          `${pasted.selectedIds.length} ${pasted.selectedIds.length === 1 ? 'element' : 'elements'} ${duplicate ? 'duplicated' : 'pasted'} on ${activeLevel.name}.`,
        );
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : 'The selection could not be pasted.',
        );
      }
    },
    [
      elementClipboard,
      buildingProject.elements.length,
      project,
      commit,
      selectMany,
      notify,
      activeLevel.name,
    ],
  );
  const duplicateSelected = useCallback(
    () => pasteSelection(copyElements(project, selectionIds), true),
    [project, selectionIds, pasteSelection],
  );
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          'input, textarea, select, [contenteditable="true"]',
        )
      )
        return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
      if (mod && !dialog && viewMode !== 'walk') {
        const key = event.key.toLowerCase();
        if (key === 'c' && selectionIds.length) {
          event.preventDefault();
          copySelection();
        }
        if (key === 'x' && selectionIds.length) {
          event.preventDefault();
          copySelection(true);
        }
        if (key === 'v' && elementClipboard) {
          event.preventDefault();
          pasteSelection();
        }
        if (key === 'a') {
          event.preventDefault();
          selectMany(
            project.elements
              .filter((element) => element.visible)
              .map((element) => element.id),
          );
        }
      }
      if (mod && !dialog && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !dialog) {
        event.preventDefault();
        deleteSelected();
      }
      if (event.key === 'Escape') {
        setDialog(null);
        setLayersOpen(false);
        if (viewMode === 'walk') setViewMode('3d');
        else {
          setSelectedId(null);
          setSelectedIds([]);
        }
      }
      if (!mod && !dialog && viewMode !== 'walk') {
        if (event.key.toLowerCase() === 'v') setTool('select');
        if (event.key.toLowerCase() === 'g') setTool('move');
        if (event.key.toLowerCase() === 'm') setTool('measure');
        if (event.key.toLowerCase() === 'r') setTool('resize');
        if (event.key.toLowerCase() === 'e') setTool('rotate');
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [
    undo,
    redo,
    deleteSelected,
    duplicateSelected,
    copySelection,
    pasteSelection,
    selectionIds,
    elementClipboard,
    project.elements,
    selectMany,
    dialog,
    viewMode,
  ]);

  const addElement = (entry: CatalogItem) => {
    if (buildingProject.elements.length >= 2000) {
      notify('Project limit reached. Remove an element before adding more.');
      return;
    }
    const room =
      project.rooms.find((room) => room.id === focusRoomId) ??
      selectedRoom ??
      floorContainer(project);
    let element = createElement(
      entry,
      room,
      project.elements.filter((item) => item.kind === entry.kind).length,
    );
    if (entry.kind === 'door' || entry.kind === 'window')
      element = attachToNearestWall(project, element) ?? element;
    else {
      try {
        element = fitElementToSpace(project, element);
      } catch {
        /* Manual positioning remains available. */
      }
    }
    commit((previous) => ({
      ...previous,
      elements: [...previous.elements, element],
    }));
    setSystemsEditing(false);
    setSelectedId(element.id);
    setSelectedIds([element.id]);
    setPaletteOpen(false);
    setMobilePanel(null);
    if (ELECTRICAL_KINDS.includes(entry.kind))
      setLayers((previous) => ({ ...previous, electrical: true }));
    else if (PLUMBING_KINDS.includes(entry.kind))
      setLayers((previous) => ({ ...previous, plumbing: true }));
    else if (STRUCTURAL_KINDS.includes(entry.kind))
      setLayers((previous) => ({ ...previous, walls: true }));
    else setLayers((previous) => ({ ...previous, furniture: true }));
    setTool('move');
    notify(`${entry.name} added to ${room.name.toLowerCase()}`);
  };
  const openRoomDialog = () => {
    setNewRoomName('New room');
    setNewRoomWidth(4);
    setNewRoomDepth(4);
    setRoomPlacement('auto');
    setDialog('room');
  };
  const openNewProject = () => {
    setNewFloor(structuredClone(DEFAULT_FLOOR));
    setWithPerimeterWalls(true);
    setDialog('new');
  };
  const suggestRoom = () => {
    let result = findRoomPlacement(project, newRoomWidth, newRoomDepth);
    if (result) {
      setNewRoomX(result[0]);
      setNewRoomZ(result[1]);
      setRoomPlacement('manual');
      return;
    }
    for (let scale = 0.9; scale >= 0.25; scale -= 0.1) {
      const w = Number((newRoomWidth * scale).toFixed(2)),
        d = Number((newRoomDepth * scale).toFixed(2));
      if (w < 1 || d < 1) continue;
      result = findRoomPlacement(project, w, d);
      if (result) {
        setNewRoomWidth(w);
        setNewRoomDepth(d);
        setNewRoomX(result[0]);
        setNewRoomZ(result[1]);
        setRoomPlacement('manual');
        notify('Room size and position fitted to available floor space.');
        return;
      }
    }
    notify(
      'No clear space is available. Resize or remove a room, or expand the total floor plan.',
    );
  };
  const createRoomProject = () => {
    try {
      if (dialog === 'new') {
        commitBuilding(
          makeFloorProject(newProjectName, newFloor, withPerimeterWalls),
        );
        setSelectedId(null);
        setSelectedIds([]);
        setFocusRoomId(null);
        setSystemsEditing(false);
        setSidebarTab('rooms');
        setMobilePanel(null);
        setDialog(null);
        setViewMode('2d');
        setPaletteOpen(false);
        camera('reset');
        notify(
          'Your floor plan is ready. Add rooms, openings, stairs and connections inside it.',
        );
        return;
      }
      if (
        buildingProject.rooms.length >= 100 ||
        buildingProject.elements.length + 5 > 2000
      )
        throw new Error(
          'Project limit reached. Remove a room or element first.',
        );
      if (!proposedRoomPosition)
        throw new Error(
          'The room does not fit in the available space. Use Find available space or set a manual position.',
        );
      const { room, elements } = makeRoom(
        newRoomName,
        newRoomWidth,
        newRoomDepth,
        proposedRoomPosition,
      );
      if (!roomFitsFloor(totalFloor, room))
        throw new Error(
          'Keep the room inside the total floor outline, or edit the outline first.',
        );
      for (const element of elements) {
        element.dimensions.height = totalFloor.wallHeight;
        if (element.dimensions.width < 0.3)
          element.dimensions.width = totalFloor.wallThickness;
        else element.dimensions.depth = totalFloor.wallThickness;
      }
      commit({
        ...project,
        rooms: [...project.rooms, room],
        elements: [...project.elements, ...elements],
      });
      setSelectedId(null);
      setSelectedIds([]);
      setFocusRoomId(room.id);
      setPaletteOpen(false);
      setSystemsEditing(false);
      setSidebarTab('rooms');
      setMobilePanel(null);
      setDialog(null);
      camera('focus');
      notify(
        `${room.name} added inside the floor plan. All dimensions remain editable.`,
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'The design could not be created.',
      );
    }
  };
  const applyFloor = (
    floor: FloorPlan,
    mode: 'keep' | 'scale',
    rebuild: boolean,
    reframe = true,
  ) => {
    try {
      let next = resizeFloor(project, floor, mode);
      if (rebuild) next = rebuildPerimeter(next);
      commit(next);
      if (reframe) camera('reset');
      notify('Total floor plan updated.');
      return true;
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'The floor outline could not be updated.',
      );
      return false;
    }
  };
  const assistSelected = (action: 'fit' | 'wall' | 'center') => {
    if (!selected || selected.locked) return;
    try {
      if (action === 'wall') {
        const attached = attachToNearestWall(project, selected);
        if (!attached)
          throw new Error('Add a wall before attaching this opening.');
        updateElement(selected.id, attached);
        notify('Opening attached to the wall. The wall now has an opening.');
      } else if (action === 'fit') {
        updateElement(selected.id, {
          ...fitElementToSpace(project, selected),
          wallAttachment: undefined,
        });
        notify(
          'Element fitted inside its space. You can still edit every dimension.',
        );
      } else {
        const room = selectedRoom ?? floorContainer(project);
        updateElement(selected.id, {
          position: [room.center[0], selected.position[1], room.center[1]],
        });
      }
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'This element could not be fitted.',
      );
    }
  };
  const changeRoom = (id: string, patch: Partial<Room>) => {
    try {
      const next = updateRoom(project, id, patch);
      const changed = next.rooms.find((room) => room.id === id)!;
      if (!roomFitsFloor(totalFloor, changed))
        throw new Error(
          'The room must stay inside the total floor plan. Edit the floor outline to create more space.',
        );
      commit(next);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'This room could not be updated.',
      );
    }
  };
  const deleteRoom = () => {
    if (!focusedRoom) return;
    commit((previous) => ({
      ...previous,
      rooms: previous.rooms.filter((room) => room.id !== focusedRoom.id),
      elements: previous.elements.filter(
        (element) => element.roomId !== focusedRoom.id,
      ),
    }));
    setFocusRoomId(null);
    setSelectedId(null);
    setSelectedIds([]);
    camera('reset');
    notify('Room and its elements removed. Undo to restore them.');
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error('Project files must be smaller than 5 MB.');
      const imported = validateProject(JSON.parse(await file.text()));
      commitBuilding(imported);
      setSelectedId(null);
      setSelectedIds([]);
      setFocusRoomId(null);
      camera('reset');
      setDialog(null);
      notify(`Opened ${imported.name}`);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'This project file could not be opened.',
      );
    }
    if (importRef.current) importRef.current.value = '';
  };
  const exportImage = () => {
    const canvas = viewportRef.current?.querySelector('canvas');
    const svg = viewportRef.current?.querySelector(
      'svg.plan-svg, svg[data-plan], .plan-view svg',
    );
    const link = document.createElement('a');
    try {
      if (viewMode === '2d' && svg) {
        const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
          type: 'image/svg+xml',
        });
        link.href = URL.createObjectURL(blob);
        link.download = `${project.name}-floor-plan.svg`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      } else if (canvas) {
        link.href = canvas.toDataURL('image/png');
        link.download = `${project.name}-3d.png`;
        link.click();
      } else {
        notify('The view is still loading. Please try again.');
        return;
      }
      setDialog(null);
      notify('Your design image is ready');
    } catch {
      notify(
        'Image export is unavailable. You can still export the full project.',
      );
    }
  };
  const toggleLayer = (key: keyof Layers) =>
    setLayers((previous) => ({ ...previous, [key]: !previous[key] }));
  const filteredCatalog = catalog.filter(
    (entry) =>
      (category === 'All' || entry.category === category) &&
      `${entry.name} ${entry.category} ${entry.kind}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const sceneProps = {
    project,
    buildingProject,
    selectedId,
    selectedIds: selectionIds,
    multiSelect,
    onSelectMany: selectMany,
    onUpdateElements: updateElements,
    walkthroughSettings,
    onActiveLevelChange: changeActiveLevel,
    showAllLevels,
    onSelect: selectElement,
    onUpdate: updateElement,
    onSelectRoom: (id: string) => selectRoom(id, false),
    onUpdateRoom: changeRoom,
    onUpdateFloor: (floor: FloorPlan) => applyFloor(floor, 'keep', true, false),
    layers,
    viewMode,
    tool,
    focusRoomId,
    cameraAction,
    units,
    snapToGrid,
  };
  const categoryName = selected
    ? (catalog.find((entry) => entry.kind === selected.kind)?.category ??
      'Element')
    : '';

  return (
    <div
      className={`app-shell drafting-app ${paletteOpen ? 'palette-open' : ''}`}
    >
      <header className="app-header">
        {import.meta.env.BASE_URL === '/ghar-naksha/' && (
          <a
            className="site-home-link"
            href="../pages/products.html"
            aria-label="Back to Atriksha products"
            title="Back to Atriksha products"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Atriksha</span>
          </a>
        )}
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="Ghar Naksha home"
        >
          <span className="brand-mark">
            <House size={23} strokeWidth={1.55} />
            <span />
          </span>
          <span>
            ghar<span className="brand-light">naksha</span>
            <small>DESIGN STUDIO</small>
          </span>
        </a>
        <div className="header-divider" />
        <button
          className="project-switcher"
          onClick={() => setDialog('project')}
        >
          <span className="project-icon">
            <FolderOpen size={18} />
          </span>
          <span>
            {project.name}
            <small>Personal workspace</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="header-spacer" />
        <span className={`save-indicator ${effectiveSaveStatus}`}>
          <span />
          {effectiveSaveStatus === 'saved'
            ? 'All changes saved'
            : effectiveSaveStatus === 'saving'
              ? 'Saving changes…'
              : 'Could not save — export a backup'}
        </span>
        <IconButton
          icon={CircleHelp}
          label="Help & keyboard shortcuts"
          onClick={() => setDialog('help')}
        />
        <button
          className="button button-outline header-import"
          onClick={() => importRef.current?.click()}
        >
          <Upload size={15} />
          Import
        </button>
        <button
          className="button button-outline header-share"
          aria-label="Share project"
          onClick={() => setDialog('share')}
        >
          <Share2 size={15} />
          <span>Share</span>
        </button>
        <button
          className="button button-primary"
          aria-label="Export project"
          onClick={() => setDialog('export')}
        >
          <ArrowDownToLine size={15} />
          <span>
            Export<span className="header-export-detail"> project</span>
          </span>
          <ChevronDown size={13} />
        </button>
        <button
          className="avatar"
          title="Personal workspace"
          onClick={() => setDialog('project')}
        >
          DK
        </button>
        <input
          ref={importRef}
          hidden
          type="file"
          accept=".json,application/json"
          aria-label="Import project file"
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
      </header>

      <nav className="workspace-nav" aria-label="Workspace navigation">
        <div className="breadcrumbs">
          <button onClick={() => setDialog('project')}>
            <ArrowLeft size={14} />
            My workspace
          </button>
          <ChevronRight size={13} />
          <span>{project.name}</span>
          <span className="draft-badge">Draft</span>
        </div>
        <div className="active-floor-controls">
          <Layers3 size={14} />
          <select
            aria-label="Active floor"
            value={activeLevelId}
            onChange={(event) => changeActiveLevel(event.target.value)}
          >
            {getLevels(buildingProject).map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
          <button
            aria-label="Manage floors"
            title="Add, copy and edit floors"
            onClick={() => setDialog('floors')}
          >
            <Plus size={14} />
            <span>Floors</span>
          </button>
        </div>
        <div className="workspace-tabs">
          <button className="current">
            <Box size={14} />
            Design studio
          </button>
          <button onClick={() => setDialog('project')}>
            <Grid2X2 size={14} />
            Project overview
          </button>
        </div>
        <button
          className="mobile-panel-button"
          onClick={() => {
            const open = !paletteOpen || sidebarTab !== 'rooms';
            setPaletteOpen(open);
            setSidebarTab('rooms');
            setSystemsEditing(false);
            setMobilePanel(open ? 'spaces' : null);
          }}
        >
          <Layers3 size={16} />
          Spaces
        </button>
      </nav>

      <main className="workspace">
        <nav className="editor-rail" aria-label="Drawing tools">
          <button
            onClick={openNewProject}
            title="New project"
            aria-label="Create new project"
          >
            <Plus size={21} />
            <span>New</span>
          </button>
          <button
            onClick={() => {
              setPaletteOpen(true);
              setSidebarTab('rooms');
              setSystemsEditing(false);
              setMobilePanel('spaces');
            }}
            title="Rooms & floor"
          >
            <Layers3 size={21} />
            <span>Rooms</span>
          </button>
          <button
            onClick={() => {
              setPaletteOpen(true);
              setSidebarTab('library');
              setSystemsEditing(false);
              setMobilePanel('spaces');
            }}
            title="Element library"
            aria-label="Open element library"
          >
            <Armchair size={21} />
            <span>Elements</span>
          </button>
          <button
            onClick={editConnections}
            title="Edit utility connections"
            aria-label="Open utility connections"
          >
            <Zap size={21} />
            <span>Systems</span>
          </button>
          <span className="rail-divider" />
          <button
            className={tool === 'select' ? 'active' : ''}
            onClick={() => setTool('select')}
            title="Select and drag (V)"
          >
            <MousePointer2 size={20} />
            <span>Select</span>
          </button>
          <button
            className={tool === 'move' ? 'active' : ''}
            onClick={() => setTool('move')}
            title="Move (G)"
          >
            <Move size={20} />
            <span>Move</span>
          </button>
          <button
            className={tool === 'resize' ? 'active' : ''}
            onClick={() => setTool('resize')}
            title="Resize (R)"
            aria-label="Resize element (R)"
          >
            <Maximize size={20} />
            <span>Resize</span>
          </button>
          <button
            className={tool === 'rotate' ? 'active' : ''}
            onClick={() => setTool('rotate')}
            title="Rotate (E)"
            aria-label="Rotate element (E)"
          >
            <RotateCw size={20} />
            <span>Rotate</span>
          </button>
          <span className="rail-divider" />
          <button onClick={undo} disabled={!canUndo} title="Undo">
            <Undo2 size={20} />
            <span>Undo</span>
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo">
            <Redo2 size={20} />
            <span>Redo</span>
          </button>
        </nav>
        <aside
          className={`sidebar ${paletteOpen && mobilePanel === 'spaces' ? 'mobile-open' : ''}`}
        >
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">YOUR PROJECT</span>
              <h2>{sidebarTab === 'library' ? 'Elements' : 'Rooms & floor'}</h2>
            </div>
            <button
              className="palette-close"
              aria-label="Close element palette"
              onClick={() => {
                setPaletteOpen(false);
                setMobilePanel(null);
              }}
            >
              <X size={18} />
            </button>
            <button
              className="mobile-close"
              onClick={() => setMobilePanel(null)}
              aria-label="Close spaces"
            >
              <X size={18} />
            </button>
          </div>
          <div className="sidebar-tabs">
            <button
              onClick={() => {
                setSidebarTab('rooms');
                setSystemsEditing(false);
              }}
              className={
                sidebarTab === 'rooms' && !systemsEditing ? 'active' : ''
              }
            >
              <Grid2X2 size={15} />
              Spaces
            </button>
            <button
              onClick={() => {
                setSidebarTab('library');
                setPaletteOpen(true);
                setSystemsEditing(false);
              }}
              className={
                sidebarTab === 'library' && !systemsEditing ? 'active' : ''
              }
            >
              <Armchair size={16} />
              Library
              <span className="tiny-dot" />
            </button>
            <button
              onClick={editConnections}
              className={systemsEditing ? 'active' : ''}
            >
              <Zap size={14} />
              Systems
            </button>
          </div>
          {sidebarTab === 'rooms' ? (
            <>
              <div className="rooms-intro-actions">
                <button
                  className="button button-outline"
                  onClick={openNewProject}
                >
                  <Plus size={13} />
                  New project
                </button>
                <button
                  className="button button-outline"
                  onClick={() => {
                    selectRoom(null);
                    setViewMode('2d');
                    setMobilePanel('properties');
                  }}
                >
                  <Ruler size={13} />
                  Floor outline
                </button>
              </div>
              <div className="floor-heading">
                <span>
                  <Layers3 size={15} />
                  {activeLevel.name}
                </span>
                <div className="floor-heading-actions">
                  <span className="floor-number">
                    {getLevels(buildingProject).findIndex(
                      (level) => level.id === activeLevelId,
                    ) + 1}
                  </span>
                  <IconButton
                    icon={Plus}
                    label="Add room"
                    onClick={openRoomDialog}
                  />
                </div>
              </div>
              <div className="room-list">
                <button
                  className={`room-row overview-row ${!focusRoomId ? 'active' : ''}`}
                  onClick={() => selectRoom(null)}
                >
                  <span className="room-icon">
                    <House size={19} />
                  </span>
                  <span className="room-info">
                    <strong>Total floor plan</strong>
                    <small>
                      {area(totalArea)} · {project.rooms.length} spaces
                    </small>
                  </span>
                  <ChevronRight size={14} />
                </button>
                {project.rooms.length === 0 && (
                  <div className="empty-spaces">
                    <Grid2X2 size={24} />
                    <p>Your boundary is set. Now create the rooms inside it.</p>
                    <button onClick={openRoomDialog}>
                      <Plus size={12} />
                      Add your first room
                    </button>
                  </div>
                )}
                <div className="room-tree">
                  {project.rooms.map((room) => {
                    const Icon = roomIcons[room.id] ?? Square;
                    return (
                      <button
                        key={room.id}
                        className={`room-row ${focusRoomId === room.id ? 'active' : ''}`}
                        onClick={() => selectRoom(room.id)}
                      >
                        <span className="room-icon">
                          <Icon size={18} />
                        </span>
                        <span className="room-info">
                          <strong>{room.name}</strong>
                          <small>{area(room.width * room.depth)}</small>
                        </span>
                        <span
                          className="room-color"
                          style={{ backgroundColor: room.color }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                className="add-element-button"
                onClick={() => {
                  setSidebarTab('library');
                  setPaletteOpen(true);
                  setCategory('All');
                }}
              >
                <Plus size={16} />
                Add an element<span>{catalog.length}</span>
              </button>
              <div className="objects-section">
                <button
                  className="objects-heading"
                  onClick={() => setObjectsOpen(!objectsOpen)}
                >
                  <span>
                    <Box size={15} />
                    Scene objects <small>{project.elements.length}</small>
                  </span>
                  <ChevronDown
                    size={14}
                    className={objectsOpen ? 'rotated' : ''}
                  />
                </button>
                {objectsOpen && (
                  <div className="object-list">
                    {project.elements
                      .filter(
                        (element) =>
                          !focusRoomId || element.roomId === focusRoomId,
                      )
                      .map((element) => (
                        <button
                          key={element.id}
                          className={
                            element.id === selectedId ? 'selected' : ''
                          }
                          onClick={() => selectElement(element.id)}
                        >
                          <span
                            className="object-dot"
                            style={{ background: element.color }}
                          />
                          <span>{element.name}</span>
                          {element.locked ? (
                            <LockKeyhole size={11} />
                          ) : !element.visible ? (
                            <EyeOff size={11} />
                          ) : (
                            <ChevronRight size={11} />
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="sidebar-bottom">
                <div className="idea-card">
                  <span className="idea-icon">
                    <Sparkles size={17} />
                  </span>
                  <strong>A home. A hundred possibilities.</strong>
                  <p>
                    Explore your space, try something new, and make it yours.
                  </p>
                  <button
                    onClick={() => {
                      setViewMode('walk');
                      setMobilePanel(null);
                    }}
                  >
                    Take a walkthrough
                    <ArrowRight size={14} />
                  </button>
                  <div className="idea-decoration">
                    <House size={72} strokeWidth={0.5} />
                  </div>
                </div>
                <div className="local-note">
                  <ShieldCheck size={13} />
                  Your designs stay on this device
                </div>
              </div>
            </>
          ) : (
            <div className="library-content">
              <label className="search-field">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find something for your home"
                  aria-label="Search element library"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </label>
              <div className="category-list">
                {[
                  'All',
                  'Living',
                  'Bedroom',
                  'Kitchen & bath',
                  'Structure',
                  'Stairs',
                  'Utilities',
                ].map((name) => (
                  <button
                    key={name}
                    className={category === name ? 'active' : ''}
                    onClick={() => setCategory(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {(category === 'All' || category === 'Structure') && (
                <button
                  className="button button-outline library-room-shortcut"
                  onClick={openRoomDialog}
                >
                  <Plus size={13} />
                  Add a room
                </button>
              )}
              <div className="library-count">
                <span>{category === 'All' ? 'The essentials' : category}</span>
                <small>{filteredCatalog.length} elements</small>
              </div>
              <div className="catalog-grid">
                {filteredCatalog.map((entry) => (
                  <button
                    className="catalog-item"
                    key={`${entry.kind}-${entry.name}`}
                    onClick={() => addElement(entry)}
                    title={`Add ${entry.name}`}
                  >
                    <div className="catalog-preview">
                      <ElementThumbnail kind={entry.kind} color={entry.color} />
                      <span>
                        <Plus size={13} />
                      </span>
                    </div>
                    <strong>{entry.name}</strong>
                    <small>
                      {(entry.dimensions.width * factor).toFixed(2)} ×{' '}
                      {(entry.dimensions.depth * factor).toFixed(2)} {units}
                    </small>
                  </button>
                ))}
              </div>
              {filteredCatalog.length === 0 && (
                <div className="empty-search">
                  <Search size={25} />
                  <strong>No elements found</strong>
                  <p>Try a different name or category.</p>
                </div>
              )}
              <p className="library-tip">
                <MousePointer2 size={14} />
                Click an element to add it to{' '}
                {focusRoomId
                  ? project.rooms
                      .find((room) => room.id === focusRoomId)
                      ?.name.toLowerCase()
                  : 'the floor plan'}
                .
              </p>
            </div>
          )}
        </aside>

        <section className="studio" aria-label="Home design editor">
          <div className="studio-toolbar">
            <div className="view-tabs">
              {(
                [
                  { id: '3d', name: '3D view', icon: Box },
                  { id: '2d', name: 'Floor plan', icon: Grid2X2 },
                  { id: 'walk', name: 'Walkthrough', icon: Footprints },
                ] as const
              ).map(({ id, name, icon: Icon }) => (
                <button
                  key={id}
                  aria-label={name}
                  className={viewMode === id ? 'active' : ''}
                  onClick={() => {
                    if (id === 'walk')
                      setLayers((previous) => ({
                        ...previous,
                        walls: true,
                        furniture: true,
                      }));
                    setViewMode(id);
                  }}
                >
                  <Icon size={15} />
                  <span>{name}</span>
                  {id === 'walk' && <span className="new-badge">LIVE</span>}
                </button>
              ))}
            </div>
            <div className="toolbar-actions">
              <button
                className="quick-add-room"
                onClick={openRoomDialog}
                aria-label="Add room to floor"
              >
                <Plus size={15} />
                <span>Room</span>
              </button>
              <button
                className="quick-floor"
                onClick={() => {
                  selectRoom(null);
                  setViewMode('2d');
                  setMobilePanel('properties');
                }}
                aria-label="Edit total floor outline"
              >
                <Ruler size={15} />
                <span>Outline</span>
              </button>
              <IconButton
                icon={Grid2X2}
                label="Snap movement to 10 cm grid"
                active={snapToGrid}
                onClick={() => setSnapToGrid(!snapToGrid)}
              />
              <IconButton
                icon={Ruler}
                label="Toggle all dimensions"
                active={layers.dimensions}
                onClick={() => toggleLayer('dimensions')}
              />
              <span className="small-divider" />
              <IconButton
                icon={Maximize}
                label="Toggle editor fullscreen"
                onClick={() => {
                  if (document.fullscreenElement)
                    void document.exitFullscreen();
                  else
                    void viewportRef.current
                      ?.requestFullscreen()
                      .catch(() =>
                        notify('Fullscreen is unavailable in this browser.'),
                      );
                }}
              />
              <button
                className="mobile-panel-button"
                onClick={() => {
                  setPaletteOpen(false);
                  setMobilePanel(
                    mobilePanel === 'properties' ? null : 'properties',
                  );
                }}
                aria-label="Open properties"
              >
                <SlidersHorizontal size={17} />
              </button>
            </div>
          </div>
          <div className="editing-strip">
            {viewMode === 'walk' ? (
              <>
                <Users size={16} />
                <NumericField
                  label="Person height"
                  value={walkthroughSettings.height * factor}
                  min={0.6 * factor}
                  max={2.5 * factor}
                  unit={units}
                  onChange={(value) =>
                    setWalkthroughSettings((previous) => ({
                      ...previous,
                      height: value / factor,
                    }))
                  }
                />
                <label className="walk-camera-label">
                  Camera
                  <select
                    aria-label="Walkthrough camera"
                    value={walkthroughSettings.camera}
                    onChange={(event) =>
                      setWalkthroughSettings((previous) => ({
                        ...previous,
                        camera: event.target.value as typeof previous.camera,
                      }))
                    }
                  >
                    <option value="follow">Behind person</option>
                    <option value="front">In front of person</option>
                    <option value="first">First person</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <button
                  aria-label="Select multiple elements"
                  aria-pressed={multiSelect}
                  className={multiSelect ? 'active' : ''}
                  onClick={() => {
                    setMultiSelect(!multiSelect);
                    setTool('select');
                  }}
                  title="Select multiple elements · Shift-click or Shift-drag"
                >
                  <CheckSquare size={16} />
                  <span>Multi-select</span>
                </button>
                <span className="small-divider" />
                <IconButton
                  icon={Copy}
                  label="Copy selection"
                  disabled={!selectionIds.length}
                  onClick={() => copySelection()}
                />
                <IconButton
                  icon={Scissors}
                  label="Cut selection"
                  disabled={
                    !selectedElements.some((element) => !element.locked)
                  }
                  onClick={() => copySelection(true)}
                />
                <IconButton
                  icon={ClipboardPaste}
                  label="Paste selection"
                  disabled={!elementClipboard}
                  onClick={() => pasteSelection()}
                />
                <IconButton
                  icon={Plus}
                  label="Duplicate selection"
                  disabled={!selectionIds.length}
                  onClick={duplicateSelected}
                />
                <span className="selection-count">
                  {selectionIds.length
                    ? `${selectionIds.length} selected`
                    : 'Select an element'}
                </span>
                {viewMode === '3d' && (
                  <button
                    className={`entire-building ${showAllLevels ? 'active' : ''}`}
                    aria-pressed={showAllLevels}
                    onClick={() => setShowAllLevels(!showAllLevels)}
                  >
                    <Layers3 size={15} />
                    <span>Entire building</span>
                  </button>
                )}
              </>
            )}
          </div>
          <div
            className={`viewport ${viewMode === 'walk' ? 'walk-mode' : ''}`}
            ref={viewportRef}
          >
            <div className="canvas-title">
              <span className="eyebrow">
                {viewMode === 'walk'
                  ? 'STEP INSIDE'
                  : activeLevel.name.toUpperCase()}
              </span>
              <h1>
                {viewMode === 'walk'
                  ? 'Welcome home.'
                  : focusRoomId
                    ? project.rooms.find((room) => room.id === focusRoomId)
                        ?.name
                    : activeLevel.name}
              </h1>
              <span>
                {viewMode === 'walk'
                  ? 'Experience the space you’re creating.'
                  : `${area(totalArea)} · ${project.rooms.length} rooms`}
              </span>
            </div>
            <div className="canvas-view-badge">
              <span />
              {viewMode === '2d'
                ? 'Top view'
                : viewMode === 'walk'
                  ? `${(walkthroughSettings.height * factor).toFixed(2)} ${units} tall`
                  : 'Perspective view'}
            </div>
            <div className="scene-container">
              {viewMode === '2d' ? (
                <PlanView {...sceneProps} />
              ) : (
                <Suspense
                  fallback={
                    <div className="scene-loading">
                      <span className="loading-house">
                        <House size={34} />
                      </span>
                      <strong>Making room for your ideas…</strong>
                      <span>Preparing your 3D home</span>
                    </div>
                  }
                >
                  <Scene {...sceneProps} />
                </Suspense>
              )}
            </div>
            {viewMode === 'walk' && (
              <div className="walk-guide">
                <Footprints size={18} />
                <div>
                  <strong>Make yourself at home</strong>
                  <span>
                    W A S D to move · Drag to look · Shift to move faster
                  </span>
                </div>
                <button onClick={() => setViewMode('3d')}>
                  Exit<small>Esc</small>
                </button>
              </div>
            )}
            {viewMode === 'walk' && (
              <div className="walk-pad" aria-label="Walk controls">
                {(['forward', 'left', 'backward', 'right'] as const).map(
                  (direction) => (
                    <button
                      key={direction}
                      aria-label={`Walk ${direction}`}
                      className={`walk-${direction}`}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        window.dispatchEvent(
                          new CustomEvent('ghar-walk', {
                            detail: { direction, active: true },
                          }),
                        );
                      }}
                      onPointerUp={() =>
                        window.dispatchEvent(
                          new CustomEvent('ghar-walk', {
                            detail: { direction, active: false },
                          }),
                        )
                      }
                      onPointerCancel={() =>
                        window.dispatchEvent(
                          new CustomEvent('ghar-walk', {
                            detail: { direction, active: false },
                          }),
                        )
                      }
                    >
                      <ArrowRight size={19} />
                    </button>
                  ),
                )}
              </div>
            )}
            <div className="compass" aria-hidden="true">
              <span>N</span>
              <svg viewBox="0 0 42 42">
                <circle
                  cx="21"
                  cy="21"
                  r="17"
                  fill="none"
                  stroke="currentColor"
                  opacity=".3"
                />
                <path d="m21 8-5 18 5-4 5 4Z" fill="#405448" />
                <path d="m21 34 5-18-5 4-5-4Z" fill="#c4c8ba" />
              </svg>
            </div>
            <div className="canvas-bottom-left">
              <button
                className={`layers-button ${layersOpen ? 'active' : ''}`}
                onClick={() => setLayersOpen(!layersOpen)}
              >
                <Layers3 size={16} />
                Layers
                <span>{Object.values(layers).filter(Boolean).length}</span>
                <ChevronDown size={12} />
              </button>
              {layersOpen && (
                <div className="layers-popover">
                  <div className="popover-heading">
                    Visible layers
                    <IconButton
                      icon={X}
                      label="Close layers"
                      onClick={() => setLayersOpen(false)}
                    />
                  </div>
                  {(
                    [
                      { key: 'walls', label: 'Walls & openings', icon: House },
                      {
                        key: 'furniture',
                        label: 'Furniture & decor',
                        icon: Armchair,
                      },
                      {
                        key: 'electrical',
                        label: 'Electrical connections',
                        icon: Zap,
                      },
                      {
                        key: 'plumbing',
                        label: 'Water connections',
                        icon: Droplets,
                      },
                      { key: 'dimensions', label: 'Dimensions', icon: Ruler },
                      { key: 'labels', label: 'Room labels', icon: Grid2X2 },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      className="layer-option"
                      key={key}
                      onClick={() => toggleLayer(key)}
                    >
                      <Icon size={15} />
                      <span>{label}</span>
                      <span
                        className={`checkbox ${layers[key] ? 'checked' : ''}`}
                      >
                        {layers[key] && <Check size={11} />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <span className="canvas-hint">
                {viewMode === '2d'
                  ? 'Drag to move · Handles resize & rotate · Pinch or scroll to zoom'
                  : viewMode === 'walk'
                    ? 'Explore at your own pace'
                    : 'Drag to orbit · Scroll to zoom'}
              </span>
            </div>
            {viewMode !== 'walk' && (
              <div className="tool-dock">
                <IconButton
                  icon={MousePointer2}
                  label="Select element (V)"
                  active={tool === 'select'}
                  onClick={() => setTool('select')}
                />
                <IconButton
                  icon={Move}
                  label="Move element (G)"
                  active={tool === 'move'}
                  onClick={() => setTool('move')}
                />
                <IconButton
                  icon={Ruler}
                  label="Measure element (M)"
                  active={tool === 'measure'}
                  onClick={() => {
                    setTool('measure');
                    notify('Select any element to see its dimensions.');
                  }}
                />
                <span className="small-divider" />
                <IconButton
                  icon={Maximize}
                  label="Resize with handles"
                  active={tool === 'resize'}
                  onClick={() => setTool('resize')}
                />
                <IconButton
                  icon={RotateCw}
                  label="Rotate with handle"
                  active={tool === 'rotate'}
                  onClick={() => setTool('rotate')}
                />
                <IconButton
                  icon={RotateCw}
                  label="Rotate selected element 90°"
                  disabled={!selected || selected.locked}
                  onClick={() =>
                    selected &&
                    updateElement(selected.id, {
                      rotation: (selected.rotation + 90) % 360,
                    })
                  }
                />
                <span className="small-divider" />
                <IconButton
                  icon={Undo2}
                  label="Undo (⌘/Ctrl Z)"
                  disabled={!canUndo}
                  onClick={undo}
                />
                <IconButton
                  icon={Redo2}
                  label="Redo (⌘/Ctrl Shift Z)"
                  disabled={!canRedo}
                  onClick={redo}
                />
              </div>
            )}
            <div className="zoom-controls">
              <IconButton
                icon={Plus}
                label="Zoom in"
                onClick={() => camera('zoom-in')}
              />
              <IconButton
                icon={Minus}
                label="Zoom out"
                onClick={() => camera('zoom-out')}
              />
              <span />
              <IconButton
                icon={Maximize}
                label="Fit entire home"
                onClick={() => {
                  setFocusRoomId(null);
                  camera('reset');
                }}
              />
            </div>
            {(layers.electrical || layers.plumbing) && (
              <div className="utility-legend">
                {layers.electrical && (
                  <span>
                    <i className="electric-line" />
                    Electrical circuit
                  </span>
                )}
                {layers.plumbing && (
                  <span>
                    <i className="water-line" />
                    Water supply
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="studio-footer">
            <span className="live-dot" />
            <span>
              {tool === 'resize'
                ? 'Resize handles'
                : tool === 'rotate'
                  ? 'Rotate handles'
                  : tool === 'move'
                    ? 'Move mode'
                    : tool === 'measure'
                      ? 'Measurement mode'
                      : 'Ready to create'}
            </span>
            <span className="footer-separator" />
            <span>
              {getLevels(buildingProject).length}{' '}
              {getLevels(buildingProject).length === 1 ? 'floor' : 'floors'}
            </span>
            <span>·</span>
            <span>{project.rooms.length} rooms</span>
            <span>·</span>
            <span>{objectCount} objects</span>
            <div className="footer-spacer" />
            <button onClick={() => setUnits(units === 'm' ? 'ft' : 'm')}>
              Units: <strong>{units === 'm' ? 'Meters' : 'Feet'}</strong>
              <ChevronDown size={11} />
            </button>
            <span className="footer-separator" />
            <span className="scale-note">Design view</span>
          </div>
        </section>

        <aside
          className={`inspector ${!paletteOpen && mobilePanel === 'properties' ? 'mobile-open' : ''}`}
        >
          <div className="inspector-heading">
            <h2>
              {systemsEditing
                ? 'Utility connections'
                : selected
                  ? 'Element details'
                  : focusedRoom
                    ? 'Room details'
                    : 'Floor plan details'}
            </h2>
            <div>
              <span className="live-chip">LIVE</span>
              <IconButton
                icon={selected ? X : MoreHorizontal}
                label={selected ? 'Deselect element' : 'Project settings'}
                onClick={() =>
                  selected ? selectMany([]) : setDialog('project')
                }
              />
              <button
                className="mobile-close"
                onClick={() => setMobilePanel(null)}
                aria-label="Close properties"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="inspector-scroll">
            {systemsEditing ? (
              <ConnectionsEditor
                project={buildingProject}
                units={units}
                onChange={(next) => {
                  commitBuilding(next);
                  const connections = getConnections(next);
                  setLayers((previous) => ({
                    ...previous,
                    electrical:
                      previous.electrical ||
                      connections.some(
                        (c) => c.system === 'electrical' && c.enabled,
                      ),
                    plumbing:
                      previous.plumbing ||
                      connections.some(
                        (c) => c.system === 'plumbing' && c.enabled,
                      ),
                  }));
                }}
                onSelectElement={selectElement}
                notify={notify}
              />
            ) : selectedElements.length > 1 ? (
              <div className="group-inspector">
                <span className="eyebrow">GROUP SELECTION</span>
                <h2>{selectedElements.length} elements selected</h2>
                <p>
                  Drag the group frame to move, its corners to resize
                  proportionally, or the round handle to rotate. Copy this
                  selection onto any floor.
                </p>
                <div className="group-inspector-actions">
                  <button onClick={() => copySelection()}>
                    <Copy size={14} />
                    Copy
                  </button>
                  <button onClick={duplicateSelected}>
                    <Plus size={14} />
                    Duplicate
                  </button>
                  <button
                    onClick={deleteSelected}
                    disabled={
                      !selectedElements.some((element) => !element.locked)
                    }
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
                <div className="group-element-list">
                  {selectedElements.map((element) => (
                    <button
                      key={element.id}
                      onClick={() => {
                        selectMany([element.id]);
                        setMultiSelect(false);
                      }}
                    >
                      <span>{element.name}</span>
                      {element.locked ? (
                        <LockKeyhole size={14} />
                      ) : (
                        <SlidersHorizontal size={14} />
                      )}
                    </button>
                  ))}
                </div>
                <p>
                  Select a name above to edit its exact dimensions. Locked
                  elements stay fixed.
                </p>
              </div>
            ) : selected ? (
              <>
                {selected.locked && (
                  <div className="locked-element-note">
                    <LockKeyhole size={14} />
                    <span>
                      This element is locked. Unlock it to edit any dimension or
                      position.
                    </span>
                    <button
                      onClick={() =>
                        updateElement(selected.id, { locked: false })
                      }
                    >
                      Unlock
                    </button>
                  </div>
                )}
                <div className="selected-element">
                  <div className="selected-preview">
                    <ElementThumbnail
                      kind={selected.kind}
                      color={selected.color}
                      large
                    />
                    <span className="preview-grid" />
                    <span className="preview-label">
                      {selected.kind === 'wall'
                        ? 'STRUCTURE'
                        : ELECTRICAL_KINDS.includes(selected.kind) ||
                            PLUMBING_KINDS.includes(selected.kind)
                          ? 'UTILITY'
                          : '3D ELEMENT'}
                    </span>
                  </div>
                  <span className="eyebrow">{categoryName}</span>
                  <EditableName
                    label="Element name"
                    value={selected.name}
                    onChange={(name) => updateElement(selected.id, { name })}
                  />
                  <span className="element-room">
                    <Grid2X2 size={12} />
                    {selectedRoom?.name ?? 'Total floor plan'}
                    <span>·</span>
                    <span>
                      {selected.locked ? 'Locked' : 'Editable element'}
                    </span>
                  </span>
                </div>
                <div className="inspector-tabs">
                  <button
                    className={inspectorTab === 'properties' ? 'active' : ''}
                    onClick={() => setInspectorTab('properties')}
                  >
                    <SlidersHorizontal size={13} />
                    Properties
                  </button>
                  <button
                    className={inspectorTab === 'materials' ? 'active' : ''}
                    onClick={() => setInspectorTab('materials')}
                  >
                    <Layers3 size={13} />
                    Materials
                  </button>
                  {selected.kind === 'stairs' && (
                    <button
                      className={inspectorTab === 'stairs' ? 'active' : ''}
                      onClick={() => setInspectorTab('stairs')}
                    >
                      <Ruler size={13} />
                      Stair design
                    </button>
                  )}
                </div>
                {selected.kind === 'stairs' && (
                  <div className="stair-floor-link">
                    <label className="studio-select-label">
                      Destination floor
                      <select
                        aria-label="Stair destination floor"
                        value={selected.connectsToLevelId ?? ''}
                        disabled={selected.locked}
                        onChange={(event) => {
                          try {
                            if (event.target.value)
                              commitBuilding(
                                fitStairsToLevel(
                                  buildingProject,
                                  selected.id,
                                  event.target.value,
                                ),
                              );
                            else
                              updateElement(selected.id, {
                                connectsToLevelId: undefined,
                              });
                          } catch (error) {
                            notify(
                              error instanceof Error
                                ? error.message
                                : 'The staircase could not be connected.',
                            );
                          }
                        }}
                      >
                        <option value="">Unlinked · manual rise</option>
                        {getLevels(buildingProject)
                          .filter(
                            (level) =>
                              level.elevation >
                              activeLevel.elevation + selected.position[1],
                          )
                          .map((level) => (
                            <option key={level.id} value={level.id}>
                              {level.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <p>
                      {selected.connectsToLevelId
                        ? 'Rise fitted to destination. Position the upper landing inside its floor outline, with clear access at both ends. A manual rise edit unlinks the stair.'
                        : 'Link to a higher floor to fit the rise and open its floor for walkable access.'}
                    </p>
                    <button onClick={() => setDialog('floors')}>
                      <Layers3 size={13} />
                      Manage floors
                    </button>
                  </div>
                )}
                {inspectorTab === 'stairs' && selected.kind === 'stairs' ? (
                  <StairInspector
                    key={selected.id}
                    element={selected}
                    units={units}
                    onChange={(patch) => updateElement(selected.id, patch)}
                  />
                ) : inspectorTab === 'properties' ? (
                  <>
                    <div className="property-section">
                      <div className="section-title">
                        <h3>Dimensions</h3>
                        <span>{units === 'm' ? 'METERS' : 'FEET'}</span>
                      </div>
                      <div className="dimension-fields">
                        {(['width', 'depth', 'height'] as const).map((key) => (
                          <NumericField
                            key={`${selected.id}-${key}`}
                            label={
                              selected.kind === 'stairs' && key === 'height'
                                ? 'Floor rise'
                                : key[0].toUpperCase() + key.slice(1)
                            }
                            value={selected.dimensions[key] * factor}
                            unit={units}
                            min={0.01 * factor}
                            max={100 * factor}
                            disabled={selected.locked}
                            onChange={(value) =>
                              updateElement(selected.id, {
                                dimensions: {
                                  ...selected.dimensions,
                                  [key]: value / factor,
                                },
                              })
                            }
                          />
                        ))}
                      </div>
                      <span className="subtle-hint">
                        <Ruler size={12} />
                        Enter or tap outside a field to apply
                      </span>
                    </div>
                    <div className="property-section">
                      <div className="section-title">
                        <h3>Position & rotation</h3>
                        <Move size={13} />
                      </div>
                      <div className="position-fields">
                        {(['X', 'Y', 'Z'] as const).map((label, index) => (
                          <NumericField
                            key={`${selected.id}-${label}`}
                            label={`${label} position`}
                            value={selected.position[index] * factor}
                            unit={units}
                            min={index === 1 ? 0 : -100 * factor}
                            max={100 * factor}
                            disabled={selected.locked}
                            onChange={(value) => {
                              const position = [
                                ...selected.position,
                              ] as HomeElement['position'];
                              position[index] = value / factor;
                              updateElement(selected.id, { position });
                            }}
                          />
                        ))}
                      </div>
                      <div className="rotation-row">
                        <NumericField
                          key={`${selected.id}-rotation`}
                          label="Rotation"
                          value={selected.rotation}
                          unit="°"
                          min={-360}
                          max={360}
                          disabled={selected.locked}
                          onChange={(rotation) =>
                            updateElement(selected.id, { rotation })
                          }
                        />
                        <button
                          title="Rotate 90 degrees"
                          disabled={selected.locked}
                          onClick={() =>
                            updateElement(selected.id, {
                              rotation: (selected.rotation + 90) % 360,
                            })
                          }
                        >
                          <RotateCw size={15} />
                          90°
                        </button>
                      </div>
                    </div>
                    <div className="element-assistance">
                      <h3>Placement & fitting</h3>
                      <label className="studio-select-label">
                        Assigned space
                        <select
                          aria-label="Assigned space"
                          value={selected.roomId}
                          disabled={selected.locked}
                          onChange={(event) =>
                            updateElement(selected.id, {
                              roomId: event.target.value,
                            })
                          }
                        >
                          <option value={FLOOR_ID}>Total floor plan</option>
                          {project.rooms.map((room) => (
                            <option value={room.id} key={room.id}>
                              {room.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="assist-buttons">
                        <button
                          disabled={selected.locked}
                          onClick={() => assistSelected('center')}
                        >
                          <Move size={12} />
                          Center
                        </button>
                        <button
                          disabled={selected.locked}
                          onClick={() => assistSelected('fit')}
                        >
                          <Maximize size={12} />
                          Fit to space
                        </button>
                        {(selected.kind === 'door' ||
                          selected.kind === 'window') && (
                          <button
                            disabled={selected.locked}
                            onClick={() => assistSelected('wall')}
                          >
                            <House size={12} />
                            Attach to wall
                          </button>
                        )}
                      </div>
                      {selected.wallAttachment && (
                        <p className="attachment-note">
                          Attached to{' '}
                          {
                            project.elements.find(
                              (e) => e.id === selected.wallAttachment?.wallId,
                            )?.name
                          }
                          . The opening follows wall edits. Moving it manually
                          detaches it.{' '}
                          <button
                            disabled={selected.locked}
                            onClick={() =>
                              updateElement(selected.id, {
                                wallAttachment: undefined,
                              })
                            }
                          >
                            Detach from wall
                          </button>
                        </p>
                      )}
                      <p className="assist-note">
                        Use assisted fitting, then fine-tune any measurement
                        manually.
                      </p>
                    </div>
                    <div className="property-section finish-section">
                      <div className="section-title">
                        <h3>Finish</h3>
                        <button onClick={() => setInspectorTab('materials')}>
                          Edit material
                          <ChevronRight size={12} />
                        </button>
                      </div>
                      <div className="finish-summary">
                        <span
                          style={{ backgroundColor: selected.color }}
                          className={`material-texture ${selected.material}`}
                        />
                        <span>
                          <strong>
                            {selected.material[0].toUpperCase() +
                              selected.material.slice(1)}
                          </strong>
                          <small>{selected.color.toUpperCase()}</small>
                        </span>
                        <Leaf size={16} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="property-section">
                      <div className="section-title">
                        <h3>Surface material</h3>
                        <Layers3 size={14} />
                      </div>
                      <div className="material-options">
                        {materialOptions.map((material) => (
                          <button
                            key={material}
                            disabled={selected.locked}
                            className={
                              selected.material === material ? 'selected' : ''
                            }
                            onClick={() =>
                              updateElement(selected.id, { material })
                            }
                          >
                            <span className={`material-texture ${material}`} />
                            {material[0].toUpperCase() + material.slice(1)}
                            {selected.material === material && (
                              <Check size={12} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="property-section">
                      <div className="section-title">
                        <h3>Color palette</h3>
                        <span>CURATED</span>
                      </div>
                      <div className="color-swatches">
                        {swatches.map((color) => (
                          <button
                            key={color}
                            title={`Apply color ${color}`}
                            aria-label={`Apply color ${color}`}
                            disabled={selected.locked}
                            className={
                              selected.color === color ? 'selected' : ''
                            }
                            style={{ backgroundColor: color }}
                            onClick={() =>
                              updateElement(selected.id, { color })
                            }
                          >
                            {selected.color === color && <Check size={15} />}
                          </button>
                        ))}
                      </div>
                      <label className="custom-color">
                        <span>Custom color</span>
                        <input
                          type="color"
                          aria-label="Custom element color"
                          value={selected.color}
                          disabled={selected.locked}
                          onChange={(e) =>
                            updateElement(selected.id, {
                              color: e.target.value,
                            })
                          }
                        />
                        <small>{selected.color.toUpperCase()}</small>
                      </label>
                    </div>
                  </>
                )}
                <div className="element-actions">
                  <button onClick={duplicateSelected}>
                    <Copy size={14} />
                    Duplicate
                  </button>
                  <IconButton
                    icon={selected.visible ? Eye : EyeOff}
                    label={selected.visible ? 'Hide element' : 'Show element'}
                    onClick={() =>
                      updateElement(selected.id, { visible: !selected.visible })
                    }
                  />
                  <IconButton
                    icon={selected.locked ? LockKeyhole : UnlockKeyhole}
                    label={selected.locked ? 'Unlock element' : 'Lock element'}
                    active={selected.locked}
                    onClick={() =>
                      updateElement(selected.id, { locked: !selected.locked })
                    }
                  />
                  <IconButton
                    className="delete-button"
                    icon={Trash2}
                    label="Delete selected element"
                    disabled={selected.locked}
                    onClick={deleteSelected}
                  />
                </div>
              </>
            ) : focusedRoom ? (
              <RoomInspector
                key={focusedRoom.id}
                room={focusedRoom}
                units={units}
                onChange={(patch) => changeRoom(focusedRoom.id, patch)}
                onDelete={deleteRoom}
                canDelete={true}
                onAdd={() => {
                  setSidebarTab('library');
                  setPaletteOpen(true);
                  setMobilePanel('spaces');
                }}
              />
            ) : (
              <FloorInspector
                project={project}
                units={units}
                onApply={applyFloor}
                onAddRoom={openRoomDialog}
              />
            )}
          </div>
          <div className="systems-section">
            <div className="section-title">
              <h3>Behind the walls</h3>
              <span>SYSTEMS</span>
            </div>
            <p>The connections that bring a home to life.</p>
            <button
              className={`system-toggle electrical ${layers.electrical ? 'enabled' : ''}`}
              onClick={() => toggleLayer('electrical')}
              role="switch"
              aria-checked={layers.electrical}
              aria-label="Electrical connections"
            >
              <span className="system-icon">
                <Zap size={17} />
              </span>
              <span>
                <strong>Electrical</strong>
                <small>Circuits, outlets & switches</small>
              </span>
              <span className="toggle-track">
                <span />
              </span>
            </button>
            <button
              className={`system-toggle plumbing ${layers.plumbing ? 'enabled' : ''}`}
              onClick={() => toggleLayer('plumbing')}
              role="switch"
              aria-checked={layers.plumbing}
              aria-label="Water connections"
            >
              <span className="system-icon">
                <Droplets size={17} />
              </span>
              <span>
                <strong>Plumbing</strong>
                <small>Water lines & connection points</small>
              </span>
              <span className="toggle-track">
                <span />
              </span>
            </button>
            <button className="systems-editor-link" onClick={editConnections}>
              Edit routes & connection points
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="inspector-footer">
            <span className="tiny-dot" />A little detail. A big difference.
          </div>
        </aside>
      </main>

      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={17} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {dialog && (
        <Modal
          title={
            dialog === 'floors'
              ? 'Design every storey.'
              : dialog === 'share'
                ? 'Share a building snapshot.'
                : dialog === 'help'
                  ? 'A little guidance, a lot of possibility.'
                  : dialog === 'export'
                    ? 'Take your design with you.'
                    : dialog === 'new'
                      ? 'First, define your total floor plan.'
                      : dialog === 'room'
                        ? 'Make room for something new.'
                        : 'Your project, at a glance.'
          }
          onClose={() => setDialog(null)}
        >
          {dialog === 'floors' ? (
            <FloorManager
              project={buildingProject}
              activeLevelId={activeLevelId}
              onChange={commitBuilding}
              onSelectLevel={changeActiveLevel}
              units={units}
              notify={notify}
            />
          ) : dialog === 'share' ? (
            <ShareProject project={buildingProject} />
          ) : dialog === 'help' ? (
            <div className="help-content">
              <p>
                Build a home you can explore. Your project saves automatically
                in this browser.
              </p>
              <div className="help-grid">
                <div>
                  <Grid2X2 size={22} />
                  <strong>Draw in 2D</strong>
                  <span>
                    Drag objects to move. Use corner and edge handles to resize,
                    and the round handle to rotate. Pinch or scroll to zoom.
                    Rooms and the floor outline have resize handles too.
                  </span>
                </div>
                <div>
                  <Box size={22} />
                  <strong>Explore in 3D</strong>
                  <span>
                    Drag empty space to orbit. Right-drag to pan. Scroll to
                    zoom. Select an unlocked element, then choose Move, Resize,
                    or Rotate to use its handles.
                  </span>
                </div>
                <div>
                  <SlidersHorizontal size={22} />
                  <strong>Make it yours</strong>
                  <span>
                    Enter decimal dimensions and positions in metres or feet.
                    Enter or leaving a field applies the edit; Escape restores
                    it. Materials and colors stay editable.
                  </span>
                </div>
                <div>
                  <Footprints size={22} />
                  <strong>Step inside</strong>
                  <span>
                    Open Walkthrough. Use W A S D to walk and drag to look
                    around. Hold Shift to walk faster. On touchscreens, use the
                    direction pad. Climb stairs linked to another floor, and use
                    Sit or E near a sofa or chair. Set your height and camera
                    above the view.
                  </span>
                </div>
                <div>
                  <Zap size={22} />
                  <strong>See the systems</strong>
                  <span>
                    Enable electrical or plumbing layers to inspect connections.
                    Add and reposition ports from the library.
                  </span>
                </div>
              </div>
              <div className="shortcut-list">
                <span>
                  Select<kbd>V</kbd>
                </span>
                <span>
                  Move<kbd>G</kbd>
                </span>
                <span>
                  Resize<kbd>R</kbd>
                </span>
                <span>
                  Rotate<kbd>E</kbd>
                </span>
                <span>
                  Measure<kbd>M</kbd>
                </span>
                <span>
                  Undo<kbd>⌘ / Ctrl Z</kbd>
                </span>
                <span>
                  Duplicate<kbd>⌘ / Ctrl D</kbd>
                </span>
                <span>
                  Cancel edit / exit walkthrough<kbd>Esc</kbd>
                </span>
              </div>
              <p className="help-note">
                Use Shift-click or Select multiple elements to build a
                selection; Shift-drag selects an area. Copy, cut and paste
                groups between floors. Share creates a fixed snapshot link.
                Utility routes are schematic design guides.
              </p>
            </div>
          ) : dialog === 'export' ? (
            <div className="export-content">
              <p>
                Keep a backup, pick up where you left off, or capture a new
                perspective.
              </p>
              <button
                className="export-option"
                onClick={() => {
                  try {
                    downloadProject(buildingProject);
                    setDialog(null);
                    notify(
                      'Project exported. Import this file to keep designing.',
                    );
                  } catch (error) {
                    notify(
                      error instanceof Error
                        ? error.message
                        : 'Project export failed.',
                    );
                  }
                }}
              >
                <span>
                  <FileJson size={24} />
                </span>
                <div>
                  <strong>Editable project</strong>
                  <small>
                    Complete design with all elements, materials and utility
                    ports
                  </small>
                  <em>JSON FILE</em>
                </div>
                <ArrowDownToLine size={18} />
              </button>
              <button className="export-option" onClick={exportImage}>
                <span>
                  <Grid2X2 size={24} />
                </span>
                <div>
                  <strong>
                    {viewMode === '2d'
                      ? 'Floor plan drawing'
                      : 'Current 3D view'}
                  </strong>
                  <small>
                    {viewMode === '2d'
                      ? 'A scalable vector drawing of your floor plan'
                      : 'A snapshot of the home from your current camera'}
                  </small>
                  <em>{viewMode === '2d' ? 'SVG IMAGE' : 'PNG IMAGE'}</em>
                </div>
                <ArrowDownToLine size={18} />
              </button>
              <div className="export-note">
                <ShieldCheck size={16} />
                Your project stays private. Files download directly to your
                device.
              </div>
            </div>
          ) : dialog === 'new' ? (
            <form
              className="floor-new-form"
              onSubmit={(event) => {
                event.preventDefault();
                createRoomProject();
              }}
            >
              <p>
                Set the overall boundary and the length of every side. Then
                build your layout with rooms, doors, windows, stairs, and
                utility connections.
              </p>
              <label className="project-name-field">
                Project name
                <input
                  value={newProjectName}
                  maxLength={100}
                  required
                  onChange={(event) => setNewProjectName(event.target.value)}
                />
              </label>
              <label className="form-units">
                Drawing units
                <select
                  aria-label="New project units"
                  value={units}
                  onChange={(event) =>
                    setUnits(event.target.value as 'm' | 'ft')
                  }
                >
                  <option value="m">Metres (m)</option>
                  <option value="ft">Feet (ft)</option>
                </select>
              </label>
              <p className="floor-step-label">01 · TOTAL FLOOR OUTLINE</p>
              <FloorEditor
                floor={newFloor}
                units={units}
                onChange={setNewFloor}
              />
              <label className="floor-check">
                <input
                  type="checkbox"
                  checked={withPerimeterWalls}
                  onChange={(event) =>
                    setWithPerimeterWalls(event.target.checked)
                  }
                />
                Create editable perimeter walls
              </label>
              <button
                type="submit"
                className="button button-primary"
                disabled={!newProjectName.trim()}
              >
                <Plus size={15} />
                Create floor plan
              </button>
            </form>
          ) : dialog === 'room' ? (
            <form
              className="new-room-form"
              onSubmit={(event) => {
                event.preventDefault();
                createRoomProject();
              }}
            >
              <p>
                Add a room inside the total floor outline. Set every measurement
                manually or use assisted placement to find available space.
              </p>
              <label className="project-name-field">
                Room name
                <input
                  value={newRoomName}
                  maxLength={100}
                  required
                  onChange={(event) => setNewRoomName(event.target.value)}
                />
              </label>
              <div className="new-room-dimensions">
                <NumericField
                  label="Room width"
                  value={newRoomWidth * factor}
                  unit={units}
                  min={0.05 * factor}
                  max={100 * factor}
                  onChange={(value) => setNewRoomWidth(value / factor)}
                />
                <NumericField
                  label="Room depth"
                  value={newRoomDepth * factor}
                  unit={units}
                  min={0.05 * factor}
                  max={100 * factor}
                  onChange={(value) => setNewRoomDepth(value / factor)}
                />
              </div>
              <label className="studio-select-label">
                Placement mode
                <select
                  aria-label="Room placement mode"
                  value={roomPlacement}
                  onChange={(event) => {
                    const next = event.target.value as 'auto' | 'manual';
                    if (next === 'manual' && proposedRoomPosition) {
                      setNewRoomX(proposedRoomPosition[0]);
                      setNewRoomZ(proposedRoomPosition[1]);
                    }
                    setRoomPlacement(next);
                  }}
                >
                  <option value="auto">
                    Find a free position automatically
                  </option>
                  <option value="manual">Set position manually</option>
                </select>
              </label>
              {roomPlacement === 'manual' && (
                <div className="new-room-dimensions">
                  <NumericField
                    label="Room X position"
                    value={newRoomX * factor}
                    unit={units}
                    min={-100 * factor}
                    max={100 * factor}
                    onChange={(value) => setNewRoomX(value / factor)}
                  />
                  <NumericField
                    label="Room Z position"
                    value={newRoomZ * factor}
                    unit={units}
                    min={-100 * factor}
                    max={100 * factor}
                    onChange={(value) => setNewRoomZ(value / factor)}
                  />
                </div>
              )}
              <div className="room-placement-preview">
                {proposedRoomPosition
                  ? `Position: X ${(proposedRoomPosition[0] * factor).toFixed(2)}, Z ${(proposedRoomPosition[1] * factor).toFixed(2)} ${units} · ${area(newRoomWidth * newRoomDepth)}`
                  : 'No free position at this size. Try a smaller room or use assisted fitting.'}
              </div>
              <div className="placement-actions">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={suggestRoom}
                >
                  <Sparkles size={14} />
                  Find available space
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={!newRoomName.trim()}
                >
                  <Plus size={14} />
                  Add room
                </button>
              </div>
            </form>
          ) : (
            <div className="project-dialog">
              <span className="eyebrow">PERSONAL WORKSPACE</span>
              <label className="project-name-field">
                Project name
                <input
                  value={projectName}
                  maxLength={100}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </label>
              <div className="dialog-stats">
                <div>
                  <House size={20} />
                  <strong>
                    {area(
                      getLevels(buildingProject).reduce(
                        (sum, level) => sum + floorArea(level.floorPlan),
                        0,
                      ),
                    )}
                  </strong>
                  <span>Total floor area</span>
                </div>
                <div>
                  <Grid2X2 size={20} />
                  <strong>{buildingProject.rooms.length}</strong>
                  <span>Spaces</span>
                </div>
                <div>
                  <Armchair size={20} />
                  <strong>{buildingProject.elements.length}</strong>
                  <span>Elements</span>
                </div>
              </div>
              <div className="project-room-summary">
                {buildingProject.rooms.map((room) => (
                  <div key={room.id}>
                    <span style={{ background: room.color }} />
                    <strong>
                      {room.name}
                      <small>
                        {' '}
                        ·{' '}
                        {
                          getLevels(buildingProject).find(
                            (level) => level.id === room.levelId,
                          )?.name
                        }
                      </small>
                    </strong>
                    <small>{area(room.width * room.depth)}</small>
                  </div>
                ))}
              </div>
              <div className="project-dialog-actions">
                <button
                  className="button button-outline"
                  onClick={openNewProject}
                >
                  <Plus size={15} />
                  New project
                </button>
                <button
                  className="button button-outline"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={15} />
                  Open project
                </button>
                <button
                  className="button button-primary"
                  disabled={!projectName.trim()}
                  onClick={() => {
                    commit((previous) => ({
                      ...previous,
                      name: projectName.trim(),
                    }));
                    setDialog(null);
                    notify('Project details updated');
                  }}
                >
                  Save details
                  <Check size={15} />
                </button>
              </div>
              <button
                className="reset-project"
                onClick={() => {
                  commitBuilding(clone(initialProject));
                  setSelectedId('living-sofa');
                  setSelectedIds(['living-sofa']);
                  setFocusRoomId(null);
                  camera('reset');
                  setDialog(null);
                  notify(
                    'Sample home restored. Undo to return to your previous design.',
                  );
                }}
              >
                <RotateCcw size={12} />
                Restore the sample home
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function EditableName({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      className="element-name"
      aria-label={label}
      value={draft}
      maxLength={100}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (cancelled.current) {
          cancelled.current = false;
          setDraft(value);
          return;
        }
        const next = draft.trim() || value;
        setDraft(next);
        if (next !== value) onChange(next);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelled.current = true;
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function RoomInspector({
  room,
  units,
  onChange,
  onDelete,
  canDelete,
  onAdd,
}: {
  room: Room;
  units: 'm' | 'ft';
  onChange: (patch: Partial<Room>) => void;
  onDelete: () => void;
  canDelete: boolean;
  onAdd: () => void;
}) {
  const factor = units === 'ft' ? 3.28084 : 1;
  return (
    <div className="room-inspector">
      <div className="selected-element">
        <div className="room-diagram">
          <div style={{ aspectRatio: `${room.width} / ${room.depth}` }}>
            <span>
              {(room.width * factor).toFixed(2)} {units}
            </span>
            <span>
              {(room.depth * factor).toFixed(2)} {units}
            </span>
            <Grid2X2 size={28} strokeWidth={1} />
          </div>
        </div>
        <span className="eyebrow">YOUR SPACE</span>
        <EditableName
          label="Room name"
          value={room.name}
          onChange={(name) => onChange({ name })}
        />
        <span className="element-room">
          <Grid2X2 size={12} />
          {(room.width * room.depth * factor * factor).toFixed(1)} {units}²
          <span>·</span>Editable room
        </span>
      </div>
      <div className="property-section">
        <div className="section-title">
          <h3>Floor & shell dimensions</h3>
          <Ruler size={13} />
        </div>
        <div className="room-size-fields">
          <NumericField
            label="Room width"
            value={room.width * factor}
            unit={units}
            min={0.05 * factor}
            max={100 * factor}
            onChange={(value) => onChange({ width: value / factor })}
          />
          <NumericField
            label="Room depth"
            value={room.depth * factor}
            unit={units}
            min={0.05 * factor}
            max={100 * factor}
            onChange={(value) => onChange({ depth: value / factor })}
          />
        </div>
        <p className="room-edit-hint">
          Walls resize with the room. Furniture keeps its dimensions.
        </p>
      </div>
      <div className="property-section">
        <div className="section-title">
          <h3>Room position</h3>
          <Move size={13} />
        </div>
        <div className="room-size-fields">
          <NumericField
            label="Room X position"
            value={room.center[0] * factor}
            unit={units}
            min={-100 * factor}
            max={100 * factor}
            onChange={(value) =>
              onChange({
                center: [value / factor, room.center[1]],
              })
            }
          />
          <NumericField
            label="Room Z position"
            value={room.center[1] * factor}
            unit={units}
            min={-100 * factor}
            max={100 * factor}
            onChange={(value) =>
              onChange({
                center: [room.center[0], value / factor],
              })
            }
          />
        </div>
        <p className="room-edit-hint">
          Move the room together with its walls and elements. Check adjoining
          rooms in floor plan view.
        </p>
      </div>
      <div className="room-inspector-actions">
        <button className="button button-outline" onClick={onAdd}>
          <Plus size={14} />
          Furnish this space
        </button>
        <button
          className="remove-room"
          onClick={onDelete}
          disabled={!canDelete}
        >
          <Trash2 size={12} />
          Remove room & elements
        </button>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first =
      dialogRef.current?.querySelector<HTMLElement>('button, input');
    first?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) ?? []),
      ];
      const start = items[0],
        end = items[items.length - 1];
      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault();
        end?.focus();
      }
      if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        start?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <span className="modal-brand">
            <House size={19} />
          </span>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </div>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
