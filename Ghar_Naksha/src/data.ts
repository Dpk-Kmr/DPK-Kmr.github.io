import measuredDefault from '../public/measured-house/project.json';
import { createId } from './lib/id';
import { STAIR_CATALOG } from './lib/stairs';
import type {
  CatalogItem,
  ElementKind,
  HomeElement,
  Project,
  Room,
} from './types';

export const catalog: CatalogItem[] = [
  ...STAIR_CATALOG,
  {
    kind: 'sofa',
    name: 'Linen sofa',
    category: 'Living',
    dimensions: { width: 2.6, height: 0.84, depth: 0.95 },
    color: '#e4dfd1',
    material: 'fabric',
  },
  {
    kind: 'armchair',
    name: 'Lounge chair',
    category: 'Living',
    dimensions: { width: 0.85, height: 0.82, depth: 0.86 },
    color: '#a8754d',
    material: 'fabric',
  },
  {
    kind: 'coffee-table',
    name: 'Oak coffee table',
    category: 'Living',
    dimensions: { width: 1.2, height: 0.38, depth: 0.65 },
    color: '#9b7854',
    material: 'wood',
  },
  {
    kind: 'rug',
    name: 'Woven area rug',
    category: 'Living',
    dimensions: { width: 3.3, height: 0.025, depth: 2.6 },
    color: '#d9d3be',
    material: 'fabric',
  },
  {
    kind: 'tv',
    name: 'Media console',
    category: 'Living',
    dimensions: { width: 1.8, height: 1.15, depth: 0.38 },
    color: '#977753',
    material: 'wood',
  },
  {
    kind: 'plant',
    name: 'Indoor olive tree',
    category: 'Living',
    dimensions: { width: 0.65, height: 1.55, depth: 0.65 },
    color: '#64805b',
    material: 'ceramic',
  },
  {
    kind: 'lamp',
    name: 'Linen floor lamp',
    category: 'Living',
    dimensions: { width: 0.48, height: 1.65, depth: 0.48 },
    color: '#d6c6a7',
    material: 'metal',
  },
  {
    kind: 'bed',
    name: 'King upholstered bed',
    category: 'Bedroom',
    dimensions: { width: 1.9, height: 1.05, depth: 2.2 },
    color: '#d4d6be',
    material: 'fabric',
  },
  {
    kind: 'nightstand',
    name: 'Oak bedside table',
    category: 'Bedroom',
    dimensions: { width: 0.5, height: 0.48, depth: 0.45 },
    color: '#9d7b57',
    material: 'wood',
  },
  {
    kind: 'wardrobe',
    name: 'Built-in wardrobe',
    category: 'Bedroom',
    dimensions: { width: 1.9, height: 2.25, depth: 0.6 },
    color: '#d8d0bc',
    material: 'wood',
  },
  {
    kind: 'dining-table',
    name: 'Round dining table',
    category: 'Kitchen & bath',
    dimensions: { width: 1.45, height: 0.76, depth: 1.45 },
    color: '#a9845b',
    material: 'wood',
  },
  {
    kind: 'chair',
    name: 'Wishbone dining chair',
    category: 'Kitchen & bath',
    dimensions: { width: 0.5, height: 0.8, depth: 0.52 },
    color: '#ac8b62',
    material: 'wood',
  },
  {
    kind: 'kitchen-counter',
    name: 'Kitchen cabinetry',
    category: 'Kitchen & bath',
    dimensions: { width: 3.2, height: 0.92, depth: 0.65 },
    color: '#71806a',
    material: 'wood',
  },
  {
    kind: 'sink',
    name: 'Vanity & basin',
    category: 'Kitchen & bath',
    dimensions: { width: 0.95, height: 0.9, depth: 0.55 },
    color: '#ece9df',
    material: 'ceramic',
  },
  {
    kind: 'toilet',
    name: 'Floor-standing toilet',
    category: 'Kitchen & bath',
    dimensions: { width: 0.4, height: 0.75, depth: 0.65 },
    color: '#f8f7f2',
    material: 'ceramic',
  },
  {
    kind: 'shower',
    name: 'Glass walk-in shower',
    category: 'Kitchen & bath',
    dimensions: { width: 1.3, height: 2.2, depth: 1.3 },
    color: '#bccbc3',
    material: 'glass',
  },
  {
    kind: 'wall',
    name: 'Interior wall',
    category: 'Structure',
    dimensions: { width: 3, height: 2.7, depth: 0.15 },
    color: '#edeae1',
    material: 'plaster',
  },
  {
    kind: 'door',
    name: 'Oak interior door',
    category: 'Structure',
    dimensions: { width: 0.95, height: 2.2, depth: 0.12 },
    color: '#ad906c',
    material: 'wood',
  },
  {
    kind: 'window',
    name: 'Picture window',
    category: 'Structure',
    dimensions: { width: 1.8, height: 1.5, depth: 0.16 },
    color: '#84938b',
    material: 'glass',
  },
  {
    kind: 'socket',
    name: 'Power outlet',
    category: 'Utilities',
    dimensions: { width: 0.12, height: 0.12, depth: 0.045 },
    color: '#f7f4e9',
    material: 'ceramic',
  },
  {
    kind: 'switch',
    name: 'Light switch',
    category: 'Utilities',
    dimensions: { width: 0.1, height: 0.1, depth: 0.035 },
    color: '#f7f4e9',
    material: 'ceramic',
  },
  {
    kind: 'light',
    name: 'Ceiling light point',
    category: 'Utilities',
    dimensions: { width: 0.32, height: 0.1, depth: 0.32 },
    color: '#e8c47a',
    material: 'metal',
  },
  {
    kind: 'water-port',
    name: 'Water supply point',
    category: 'Utilities',
    dimensions: { width: 0.15, height: 0.18, depth: 0.15 },
    color: '#5badd1',
    material: 'metal',
  },
  {
    kind: 'electrical-panel',
    name: 'Distribution board',
    category: 'Utilities',
    dimensions: { width: 0.45, height: 0.65, depth: 0.15 },
    color: '#d1d5ca',
    material: 'metal',
  },
];

export const rooms: Room[] = [
  {
    id: 'living',
    name: 'Living room',
    subtitle: 'A little room to unwind',
    center: [-3, 2.5],
    width: 6,
    depth: 5,
    color: '#e5dccb',
  },
  {
    id: 'kitchen',
    name: 'Kitchen & dining',
    subtitle: 'Made for gathering',
    center: [3, 2.5],
    width: 6,
    depth: 5,
    color: '#e7dfd0',
  },
  {
    id: 'master',
    name: 'Primary bedroom',
    subtitle: 'Your everyday retreat',
    center: [-3.5, -2.5],
    width: 5,
    depth: 5,
    color: '#e4dbcb',
  },
  {
    id: 'bedroom',
    name: 'Guest bedroom',
    subtitle: 'A space for everyone',
    center: [1, -2.5],
    width: 4,
    depth: 5,
    color: '#e7dfd2',
  },
  {
    id: 'bath',
    name: 'Bathroom',
    subtitle: 'The quiet essentials',
    center: [4.5, -2.5],
    width: 3,
    depth: 5,
    color: '#d9dcd4',
  },
];

function item(
  id: string,
  kind: ElementKind,
  roomId: string,
  x: number,
  z: number,
  override: Partial<HomeElement> = {},
): HomeElement {
  const template = catalog.find((entry) => entry.kind === kind)!;
  return {
    ...template,
    dimensions: { ...template.dimensions },
    id,
    roomId,
    position: [x, 0, z],
    rotation: 0,
    visible: true,
    locked: false,
    ...override,
  };
}
const wall = (
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  roomId = 'living',
  height = 2.7,
  y = 0,
) =>
  item(id, 'wall', roomId, x, z, {
    name: id.includes('exterior') ? 'Exterior wall' : 'Partition wall',
    dimensions: { width, height, depth },
    position: [x, y, z],
    locked: true,
  });

export const courtyardProject: Project = {
  version: 1,
  name: 'The Courtyard House',
  rooms,
  elements: [
    wall('exterior-back-left', -5.55, -5, 0.9, 0.18, 'master'),
    wall('exterior-back-middle', -1.9, -5, 2.4, 0.18, 'master'),
    wall('exterior-back-right', 3.75, -5, 4.5, 0.18, 'bath'),
    wall('exterior-master-sill', -4.1, -5, 2, 0.18, 'master', 0.8),
    wall('exterior-master-header', -4.1, -5, 2, 0.18, 'master', 0.4, 2.3),
    wall('exterior-guest-sill', 0.4, -5, 2.2, 0.18, 'bedroom', 0.8),
    wall('exterior-guest-header', 0.4, -5, 2.2, 0.18, 'bedroom', 0.4, 2.3),
    wall('exterior-left', -6, 0, 0.18, 10, 'living'),
    wall('exterior-right', 6, 0, 0.18, 10, 'kitchen'),
    wall('exterior-front-left', -3.7, 5, 4.6, 0.18, 'living'),
    wall('exterior-front-right', 2.9, 5, 6.2, 0.18, 'kitchen'),
    wall('master-bedroom-partition', -1, -2.5, 0.14, 5, 'master'),
    wall('bathroom-partition', 3, -2.5, 0.14, 5, 'bath'),
    wall('master-front-partition', -4.25, 0, 3.5, 0.14, 'master'),
    wall('bedroom-front-partition', 0.1, 0, 2.8, 0.14, 'bedroom'),
    wall('bath-front-partition-left', 3, 0, 0.8, 0.14, 'bath'),
    wall('bath-front-partition-right', 5.25, 0, 1.5, 0.14, 'bath'),
    item('window-master', 'window', 'master', -4.1, -5, {
      position: [-4.1, 0.8, -5],
      dimensions: { width: 2, height: 1.5, depth: 0.18 },
    }),
    item('window-guest', 'window', 'bedroom', 0.4, -5, {
      position: [0.4, 0.8, -5],
      dimensions: { width: 2.2, height: 1.5, depth: 0.18 },
    }),
    item('door-master', 'door', 'master', -2.45, -0.48, { rotation: 75 }),
    item('door-guest', 'door', 'bedroom', 1.62, -0.47, { rotation: 75 }),
    item('door-bath', 'door', 'bath', 3.55, -0.47, { rotation: 75 }),
    item('entry-door', 'door', 'living', -0.8, 5, {
      name: 'Main entrance',
      dimensions: { width: 1.2, height: 2.3, depth: 0.15 },
    }),
    item('living-rug', 'rug', 'living', -3.55, 2.7),
    item('living-sofa', 'sofa', 'living', -4, 1.05),
    item('living-coffee', 'coffee-table', 'living', -3.55, 2.65),
    item('living-chair', 'armchair', 'living', -1.65, 3.1, { rotation: -65 }),
    item('living-tv', 'tv', 'living', -3.95, 4.55, { rotation: 180 }),
    item('living-plant', 'plant', 'living', -5.45, 4.35),
    item('living-lamp', 'lamp', 'living', -5.6, 1.15),
    item('kitchen-back', 'kitchen-counter', 'kitchen', 3.9, 0.57, {
      dimensions: { width: 3.55, height: 0.96, depth: 0.65 },
    }),
    item('kitchen-side-a', 'kitchen-counter', 'kitchen', 5.5, 1.375, {
      name: 'Storage cabinetry',
      rotation: -90,
      dimensions: { width: 0.9, height: 0.92, depth: 0.65 },
    }),
    item('kitchen-side-b', 'kitchen-counter', 'kitchen', 5.5, 3.425, {
      name: 'Storage cabinetry',
      rotation: -90,
      dimensions: { width: 1.3, height: 0.92, depth: 0.65 },
    }),
    item('kitchen-sink', 'sink', 'kitchen', 5.5, 2.3, {
      rotation: -90,
      dimensions: { width: 0.95, height: 1.14, depth: 0.6 },
    }),
    item('dining-table', 'dining-table', 'kitchen', 2.05, 2.9),
    item('dining-chair-1', 'chair', 'kitchen', 2.05, 1.87),
    item('dining-chair-2', 'chair', 'kitchen', 2.05, 3.95, { rotation: 180 }),
    item('dining-chair-3', 'chair', 'kitchen', 1.03, 2.9, { rotation: 90 }),
    item('dining-chair-4', 'chair', 'kitchen', 3.1, 2.9, { rotation: 270 }),
    item('kitchen-plant', 'plant', 'kitchen', 5.35, 4.4, {
      dimensions: { width: 0.6, height: 1.25, depth: 0.6 },
    }),
    item('master-rug', 'rug', 'master', -3.7, -2.8, {
      dimensions: { width: 3.1, height: 0.02, depth: 3.1 },
      color: '#ded8ca',
    }),
    item('master-bed', 'bed', 'master', -3.7, -3.4),
    item('master-nightstand-l', 'nightstand', 'master', -5.05, -3.95),
    item('master-nightstand-r', 'nightstand', 'master', -2.35, -3.95),
    item('master-wardrobe', 'wardrobe', 'master', -5.5, -1.25, {
      rotation: 90,
      dimensions: { width: 1.6, height: 2.25, depth: 0.6 },
    }),
    item('master-plant', 'plant', 'master', -1.55, -4.35, {
      dimensions: { width: 0.55, height: 1.3, depth: 0.55 },
    }),
    item('guest-bed', 'bed', 'bedroom', 0.75, -3.4, {
      name: 'Queen upholstered bed',
      dimensions: { width: 1.6, height: 1, depth: 2.1 },
      color: '#c8b6a0',
    }),
    item('guest-nightstand', 'nightstand', 'bedroom', -0.45, -3.8),
    item('guest-wardrobe', 'wardrobe', 'bedroom', 0.3, -0.6, {
      dimensions: { width: 1.7, height: 2.15, depth: 0.55 },
      rotation: 180,
    }),
    item('bath-shower', 'shower', 'bath', 5.13, -4.1),
    item('bath-toilet', 'toilet', 'bath', 3.7, -4.5),
    item('bath-sink', 'sink', 'bath', 5.5, -1.7, {
      rotation: -90,
      color: '#c6b599',
    }),
    item('bath-rug', 'rug', 'bath', 4.6, -2.6, {
      name: 'Bath mat',
      dimensions: { width: 0.65, height: 0.025, depth: 0.9 },
      color: '#d1caba',
    }),
    item('electrical-main', 'electrical-panel', 'living', -1.6, 4.86, {
      position: [-1.6, 1.15, 4.86],
      rotation: 180,
      name: 'Main distribution board',
    }),
    item('socket-living', 'socket', 'living', -5.88, 1.3, {
      position: [-5.88, 0.35, 1.3],
      rotation: 90,
      name: 'Living room outlet',
    }),
    item('socket-tv', 'socket', 'living', -3.8, 4.86, {
      position: [-3.8, 0.35, 4.86],
      rotation: 180,
      name: 'TV & media outlet',
    }),
    item('socket-kitchen', 'socket', 'kitchen', 5.86, 1.7, {
      position: [5.86, 1.15, 1.7],
      rotation: -90,
      name: 'Kitchen appliance outlet',
    }),
    item('socket-master', 'socket', 'master', -2.35, -4.86, {
      position: [-2.35, 0.45, -4.86],
      name: 'Bedside power outlet',
    }),
    item('socket-guest', 'socket', 'bedroom', -0.45, -4.86, {
      position: [-0.45, 0.45, -4.86],
      name: 'Guest bedroom outlet',
    }),
    item('switch-living', 'switch', 'living', -1.5, 4.86, {
      position: [-1.5, 1.2, 4.86],
      rotation: 180,
    }),
    item('switch-master', 'switch', 'master', -2.65, -0.1, {
      position: [-2.65, 1.2, -0.1],
      rotation: 180,
    }),
    item('light-living', 'light', 'living', -3, 2.5, {
      position: [-3, 2.6, 2.5],
      name: 'Living ceiling point',
    }),
    item('light-kitchen', 'light', 'kitchen', 2.05, 2.9, {
      position: [2.05, 2.6, 2.9],
      name: 'Dining pendant point',
    }),
    item('light-master', 'light', 'master', -3.5, -2.5, {
      position: [-3.5, 2.6, -2.5],
      name: 'Bedroom ceiling point',
    }),
    item('water-main', 'water-port', 'bath', 5.85, -4.7, {
      position: [5.85, 0.3, -4.7],
      name: 'Main water supply',
    }),
    item('water-shower', 'water-port', 'bath', 5.8, -4, {
      position: [5.8, 1.15, -4],
      name: 'Shower connection',
    }),
    item('water-toilet', 'water-port', 'bath', 3.7, -4.75, {
      position: [3.7, 0.3, -4.75],
      name: 'Toilet connection',
    }),
    item('water-vanity', 'water-port', 'bath', 5.82, -1.7, {
      position: [5.82, 0.55, -1.7],
      name: 'Vanity connection',
    }),
    item('water-kitchen', 'water-port', 'kitchen', 5.82, 2.3, {
      position: [5.82, 0.55, 2.3],
      name: 'Kitchen sink connection',
    }),
  ],
};

export function createElement(
  template: CatalogItem,
  room: Room,
  index = 0,
): HomeElement {
  const offset = (index % 4) * 0.3;
  const elevation =
    template.kind === 'window'
      ? 0.8
      : template.kind === 'light'
        ? 2.6
        : template.kind === 'socket'
          ? 0.35
          : template.kind === 'switch'
            ? 1.2
            : 0;
  return {
    id: createId(),
    kind: template.kind,
    name: template.name,
    roomId: room.id,
    position: [room.center[0] + offset, elevation, room.center[1] + offset],
    rotation: 0,
    dimensions: { ...template.dimensions },
    color: template.color,
    material: template.material,
    visible: true,
    locked: false,
    ...(template.stairs ? { stairs: structuredClone(template.stairs) } : {}),
  };
}

// The generated measured house is the fresh-workspace and reset default.
export const initialProject = measuredDefault as unknown as Project;
