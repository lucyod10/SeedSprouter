import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

const MEDIA_DIR = `${FileSystem.documentDirectory}garden-media/`;

async function ensureMediaDirectory() {
  const info = await FileSystem.getInfoAsync(MEDIA_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
}

export async function keepPhoto(uri: string) {
  await ensureMediaDirectory();
  const source = await FileSystem.getInfoAsync(uri);
  if (!source.exists || (typeof source.size === 'number' && source.size <= 0)) throw new Error('The selected photo is empty or unavailable.');
  const candidateExtension = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  const extension = candidateExtension && /^[a-z0-9]{2,5}$/.test(candidateExtension) ? candidateExtension : 'jpg';
  let destination = '';
  do {
    destination = `${MEDIA_DIR}${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
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
    quality: 0.82,
    cameraType: ImagePicker.CameraType.back,
  });
  if (result.canceled || !result.assets[0]) return undefined;
  return keepPhoto(result.assets[0].uri);
}

export async function choosePhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.82,
  });
  if (result.canceled || !result.assets[0]) return undefined;
  return keepPhoto(result.assets[0].uri);
}
