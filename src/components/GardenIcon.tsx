import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * App-wide semantic icon vocabulary.
 *
 * UI code asks for meaning rather than a vendor glyph. This keeps the selected
 * playful Material style consistent and makes a future icon-library migration a
 * single-file change.
 */
export const gardenIconNames = {
  today: 'home-outline',
  beds: 'flower-tulip-outline',
  growGuide: 'sprout-outline',
  plant: 'sprout-outline',
  flower: 'flower-outline',
  tree: 'tree-outline',
  leaf: 'leaf',
  water: 'water-outline',
  harvest: 'silverware-fork-knife',
  reminder: 'bell-outline',
  weather: 'weather-partly-cloudy',
  add: 'plus',
  confirm: 'check',
  close: 'close',
  back: 'chevron-left',
  forward: 'chevron-right',
  up: 'chevron-up',
  down: 'chevron-down',
  search: 'magnify',
  settings: 'cog-outline',
  delete: 'delete-outline',
  calendar: 'calendar-month-outline',
  menu: 'menu',
  more: 'dots-horizontal',
  location: 'map-marker-outline',
  profile: 'account-circle-outline',
  favourite: 'heart-outline',
  star: 'star-outline',
  camera: 'camera-outline',
  photo: 'image-outline',
  editMap: 'image-edit-outline',
  label: 'tag-outline',
  draw: 'draw',
  erase: 'eraser',
  move: 'gesture-swipe',
  onionSkin: 'layers-triple-outline',
  history: 'history',
  undo: 'undo',
  redo: 'redo',
  refresh: 'folder-sync-outline',
} as const satisfies Record<string, MaterialCommunityIconName>;

export type GardenIconName = keyof typeof gardenIconNames;

export function GardenIcon({ name, ...props }: Omit<ComponentProps<typeof MaterialCommunityIcons>, 'name'> & { name: GardenIconName }) {
  return <MaterialCommunityIcons name={gardenIconNames[name]} {...props} />;
}
