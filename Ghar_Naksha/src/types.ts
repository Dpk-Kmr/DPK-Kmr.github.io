export type ElementKind =
  | 'block'
  | 'temple'
  | 'sofa'
  | 'armchair'
  | 'coffee-table'
  | 'dining-table'
  | 'chair'
  | 'bed'
  | 'nightstand'
  | 'wardrobe'
  | 'kitchen-counter'
  | 'sink'
  | 'toilet'
  | 'shower'
  | 'plant'
  | 'rug'
  | 'tv'
  | 'lamp'
  | 'wall'
  | 'door'
  | 'window'
  | 'socket'
  | 'switch'
  | 'light'
  | 'water-port'
  | 'electrical-panel'
  | 'stairs';
export type Material =
  | 'fabric'
  | 'wood'
  | 'stone'
  | 'ceramic'
  | 'metal'
  | 'plaster'
  | 'glass';
export type ViewMode = '3d' | '2d' | 'walk';
export type ToolMode = 'select' | 'move' | 'resize' | 'rotate' | 'measure';
export const FLOOR_ID = '__floor__';
export const GROUND_LEVEL_ID = 'ground-floor';
export interface FloorPlan {
  outline: [number, number][];
  wallHeight: number;
  wallThickness: number;
}
export interface BuildingLevel {
  id: string;
  name: string;
  elevation: number;
  floorPlan: FloorPlan;
}
export type StairStyle =
  | 'straight'
  | 'l-shaped'
  | 'u-shaped'
  | 'spiral'
  | 'floating';
export interface StairConfig {
  style: StairStyle;
  steps: number;
  flightWidth: number;
  landingDepth: number;
  turnDirection: 'left' | 'right';
  railing: 'none' | 'left' | 'right' | 'both';
  railingHeight: number;
  treadThickness: number;
  nosing: number;
  risers: 'open' | 'closed';
  stringer: 'solid' | 'central' | 'none';
  spiralTurns: number;
  innerRadius: number;
}
export interface UtilityConnection {
  id: string;
  name: string;
  system: 'electrical' | 'plumbing';
  fromId: string;
  toId: string;
  waypoints: [number, number, number][];
  enabled: boolean;
  size: number;
  label: string;
}
export interface HomeElement {
  id: string;
  kind: ElementKind;
  name: string;
  roomId: string;
  position: [number, number, number];
  rotation: number;
  dimensions: { width: number; height: number; depth: number };
  color: string;
  material: Material;
  visible: boolean;
  locked: boolean;
  apertureOnly?: boolean;
  fullHeight?: boolean;
  doorSwing?: number;
  doorSide?: number;
  stairs?: StairConfig;
  wallAttachment?: { wallId: string; offset: number };
  floorEdge?: number;
  levelId?: string;
  /** Destination of an ascending staircase; positions remain local to its source level. */
  connectsToLevelId?: string;
}
export interface Room {
  id: string;
  name: string;
  subtitle: string;
  center: [number, number];
  width: number;
  depth: number;
  color: string;
  levelId?: string;
}
export interface Project {
  version: 1;
  name: string;
  elements: HomeElement[];
  rooms: Room[];
  floorPlan?: FloorPlan;
  connections?: UtilityConnection[];
  levels?: BuildingLevel[];
  activeLevelId?: string;
}
export interface Layers {
  furniture: boolean;
  electrical: boolean;
  plumbing: boolean;
  dimensions: boolean;
  labels: boolean;
  walls: boolean;
}
export interface CatalogItem {
  kind: ElementKind;
  name: string;
  category:
    | 'Living'
    | 'Bedroom'
    | 'Kitchen & bath'
    | 'Structure'
    | 'Utilities'
    | 'Stairs';
  dimensions: HomeElement['dimensions'];
  color: string;
  material: Material;
  stairs?: StairConfig;
}
export const ELECTRICAL_KINDS: ElementKind[] = [
  'socket',
  'switch',
  'light',
  'electrical-panel',
];
export const PLUMBING_KINDS: ElementKind[] = ['water-port'];
export const STRUCTURAL_KINDS: ElementKind[] = [
  'wall',
  'door',
  'window',
  'stairs',
];
export const isElementVisible = (element: HomeElement, layers: Layers) => {
  if (!element.visible) return false;
  if (ELECTRICAL_KINDS.includes(element.kind)) return layers.electrical;
  if (PLUMBING_KINDS.includes(element.kind)) return layers.plumbing;
  if (STRUCTURAL_KINDS.includes(element.kind)) return layers.walls;
  return layers.furniture;
};
