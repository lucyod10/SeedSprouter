import * as FileSystem from 'expo-file-system/legacy';
import Storage from 'expo-sqlite/kv-store';
import { GARDEN_SCHEMA_VERSION } from '../domain/garden';
import { AppData } from '../types';

const PRIMARY_KEY = 'seed-sprouter-data-v2';
const LEGACY_KEY = 'seed-sprouter-data-v1';
const STAGING_KEY = 'seed-sprouter-data-v2-staging';
const BACKUP_KEYS = Array.from({ length: 5 }, (_, index) => `seed-sprouter-data-v2-backup-${index}`);
const FILE_BACKUP_DIR = `${FileSystem.documentDirectory}garden-data-backups/`;

type StoredEnvelope = {
  format: 'seed-sprouter-envelope';
  version: 2;
  savedAt: string;
  checksum: string;
  payload: string;
};

export class GardenDataUnavailableError extends Error {
  constructor() {
    super('Saved garden data exists but no verified snapshot could be recovered.');
    this.name = 'GardenDataUnavailableError';
  }
}

export const EMPTY_DATA: AppData = {
  schemaVersion: GARDEN_SCHEMA_VERSION,
  beds: [],
  settings: {
    remindersEnabled: false,
    reminderHour: 7,
    reminderMinute: 0,
  },
};

export const DEFAULT_BED_REMINDERS = {
  enabled: false,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  times: ['07:00'],
};

function checksum(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidData(value: unknown): value is AppData {
  if (!isObject(value) || !Array.isArray(value.beds) || !isObject(value.settings)) return false;
  if (value.schemaVersion !== undefined && (!Number.isInteger(value.schemaVersion) || Number(value.schemaVersion) < 1)) return false;
  return value.beds.every((bed) => {
    if (!isObject(bed) || typeof bed.id !== 'string' || typeof bed.name !== 'string' || !Array.isArray(bed.cycles)) return false;
    return bed.cycles.every((cycle) => {
      if (!isObject(cycle) || typeof cycle.id !== 'string' || typeof cycle.coverPhotoUri !== 'string' || !Array.isArray(cycle.rows) || !Array.isArray(cycle.progress)) return false;
      return cycle.rows.every((row) => isObject(row) && typeof row.id === 'string' && typeof row.cropName === 'string' && Array.isArray(row.path));
    });
  });
}

function normaliseData(saved: AppData): AppData {
  const oldSettings = { ...EMPTY_DATA.settings, ...saved.settings };
  return {
    ...saved,
    schemaVersion: GARDEN_SCHEMA_VERSION,
    beds: saved.beds.map((bed) => ({
      ...bed,
      reminders: bed.reminders ?? {
        ...DEFAULT_BED_REMINDERS,
        weekdays: [...DEFAULT_BED_REMINDERS.weekdays],
        enabled: oldSettings.remindersEnabled,
        times: [`${String(oldSettings.reminderHour).padStart(2, '0')}:${String(oldSettings.reminderMinute).padStart(2, '0')}`],
      },
    })),
    settings: oldSettings,
  };
}

function encode(data: AppData) {
  if (!isValidData(data)) throw new Error('Refusing to save invalid garden data.');
  const payload = JSON.stringify(data);
  const envelope: StoredEnvelope = {
    format: 'seed-sprouter-envelope',
    version: 2,
    savedAt: new Date().toISOString(),
    checksum: checksum(payload),
    payload,
  };
  return JSON.stringify(envelope);
}

function decode(raw: string): AppData {
  const parsed = JSON.parse(raw) as unknown;
  let candidate = parsed;
  if (isObject(parsed) && parsed.format === 'seed-sprouter-envelope') {
    if (parsed.version !== 2 || typeof parsed.payload !== 'string' || typeof parsed.checksum !== 'string') throw new Error('Invalid garden data envelope.');
    if (checksum(parsed.payload) !== parsed.checksum) throw new Error('Garden data checksum mismatch.');
    candidate = JSON.parse(parsed.payload) as unknown;
  }
  if (!isValidData(candidate)) throw new Error('Garden data schema validation failed.');
  return normaliseData(candidate);
}

async function ensureBackupDirectory() {
  const info = await FileSystem.getInfoAsync(FILE_BACKUP_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(FILE_BACKUP_DIR, { intermediates: true });
}

async function writeVerifiedFileSnapshot(raw: string) {
  await ensureBackupDirectory();
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uri = `${FILE_BACKUP_DIR}garden-${safeTimestamp}-${Math.random().toString(36).slice(2, 8)}.json`;
  await FileSystem.writeAsStringAsync(uri, raw, { encoding: FileSystem.EncodingType.UTF8 });
  const written = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
  decode(written);
  if (written !== raw) throw new Error('Garden backup verification did not match the saved data.');
}

async function loadLatestFileSnapshot() {
  try {
    await ensureBackupDirectory();
    const files = (await FileSystem.readDirectoryAsync(FILE_BACKUP_DIR)).filter((name) => name.endsWith('.json')).sort().reverse();
    for (const file of files) {
      try {
        return decode(await FileSystem.readAsStringAsync(`${FILE_BACKUP_DIR}${file}`, { encoding: FileSystem.EncodingType.UTF8 }));
      } catch {
        // Keep searching older immutable snapshots.
      }
    }
  } catch {
    // SQLite recovery candidates are still checked independently.
  }
  return undefined;
}

export async function loadData(): Promise<AppData> {
  const keys = [PRIMARY_KEY, STAGING_KEY, ...BACKUP_KEYS, LEGACY_KEY];
  let foundStoredData = false;
  for (const key of keys) {
    const raw = await Storage.getItem(key);
    if (!raw) continue;
    foundStoredData = true;
    try {
      return decode(raw);
    } catch {
      // Never replace unreadable data with an empty garden; continue through recovery sources.
    }
  }

  const fileSnapshot = await loadLatestFileSnapshot();
  if (fileSnapshot) return fileSnapshot;
  if (foundStoredData) throw new GardenDataUnavailableError();
  return normaliseData(EMPTY_DATA);
}

export async function saveData(data: AppData) {
  const raw = encode(data);

  // Stage and verify the complete new value before touching the current primary snapshot.
  await Storage.setItem(STAGING_KEY, raw);
  const staged = await Storage.getItem(STAGING_KEY);
  if (!staged || staged !== raw) throw new Error('Garden data staging verification failed.');
  decode(staged);

  // Keep an independent immutable Documents snapshot in case the SQLite file is ever damaged.
  await writeVerifiedFileSnapshot(raw);

  // Rotate previous verified SQLite snapshots. No backup key is ever removed.
  for (let index = BACKUP_KEYS.length - 1; index > 0; index -= 1) {
    const previous = await Storage.getItem(BACKUP_KEYS[index - 1]);
    if (previous) await Storage.setItem(BACKUP_KEYS[index], previous);
  }
  const current = await Storage.getItem(PRIMARY_KEY) ?? await Storage.getItem(LEGACY_KEY);
  if (current) {
    try {
      decode(current);
      await Storage.setItem(BACKUP_KEYS[0], current);
    } catch {
      // Never promote corrupt bytes over a known verified backup.
    }
  }

  await Storage.setItem(PRIMARY_KEY, raw);
  const committed = await Storage.getItem(PRIMARY_KEY);
  if (!committed || committed !== raw) throw new Error('Garden data commit verification failed.');
  decode(committed);
}
