import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

const MEDIA_FOLDER = 'garden-media/';
const LEGACY_MEDIA_MARKER = `/${MEDIA_FOLDER}`;

function mediaDirectory() {
  if (!FileSystem.documentDirectory) throw new Error('The app Documents directory is unavailable.');
  return `${FileSystem.documentDirectory}${MEDIA_FOLDER}`;
}

/**
 * iOS may assign a new app-container UUID when a development build is installed.
 * Saved files move with the Documents container, so rebase only our immutable
 * garden-media paths and leave remote, Photos-library and unknown URIs untouched.
 */
export function resolveMediaUri(uri: string) {
  const markerIndex = uri.lastIndexOf(LEGACY_MEDIA_MARKER);
  if (markerIndex < 0 || !FileSystem.documentDirectory) return uri;
  return `${FileSystem.documentDirectory}${MEDIA_FOLDER}${uri.slice(markerIndex + LEGACY_MEDIA_MARKER.length)}`;
}

async function ensureMediaDirectory() {
  const directory = mediaDirectory();
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
}

export async function keepPhoto(uri: string) {
  await ensureMediaDirectory();
  const source = await FileSystem.getInfoAsync(uri);
  if (!source.exists || (typeof source.size === 'number' && source.size <= 0)) throw new Error('The selected photo is empty or unavailable.');
  const candidateExtension = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  const extension = candidateExtension && /^[a-z0-9]{2,5}$/.test(candidateExtension) ? candidateExtension : 'jpg';
  const directory = mediaDirectory();
  let destination = '';
  do {
    destination = `${directory}${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  } while ((await FileSystem.getInfoAsync(destination)).exists);
  await FileSystem.copyAsync({ from: uri, to: destination });
  const copied = await FileSystem.getInfoAsync(destination);
  if (!copied.exists || typeof copied.size !== 'number' || copied.size <= 0) throw new Error('The photo copy could not be verified.');
  if (typeof source.size === 'number' && source.size !== copied.size) throw new Error('The saved photo did not match the original file.');
  return destination;
}

export async function takePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Camera permission is needed to photograph your garden.');
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    cameraType: ImagePicker.CameraType.back,
  });
  if (result.canceled || !result.assets[0]) return undefined;
  return keepPhoto(result.assets[0].uri);
}

export async function choosePhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    shouldDownloadFromNetwork: true,
  });
  if (result.canceled || !result.assets[0]) return undefined;
  return keepPhoto(result.assets[0].uri);
}
