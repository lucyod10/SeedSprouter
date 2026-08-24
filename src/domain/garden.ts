import { AppData, BedCareEvent, BedCycle, BedReminderSchedule, GardenBed, PlantedRow } from '../types';

/**
 * Current logical data-model version. The storage envelope has its own version;
 * keeping these separate lets storage mechanics and garden entities evolve safely.
 */
export const GARDEN_SCHEMA_VERSION = 4;

export function createEntityId(kind: 'bed' | 'cycle' | 'photo' | 'row' | 'care') {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function snapshotRows(rows: PlantedRow[]) {
  return JSON.parse(JSON.stringify(rows)) as PlantedRow[];
}

export function activeCycle(bed?: GardenBed) {
  if (!bed || bed.deletedAt) return undefined;
  return [...bed.cycles].reverse().find((cycle) => !cycle.harvestedAt);
}

export function latestCycle(bed?: GardenBed) {
  return bed?.cycles[bed.cycles.length - 1];
}

export function visibleBeds(data: AppData) {
  return data.beds.filter((bed) => !bed.deletedAt);
}

export function createPlantingCycle(photoUri: string, startedAt = new Date().toISOString()): BedCycle {
  return {
    id: createEntityId('cycle'),
    startedAt,
    coverPhotoUri: photoUri,
    rows: [],
    progress: [{
      id: createEntityId('photo'),
      uri: photoUri,
      takenAt: startedAt,
      note: 'Original bed photo',
      kind: 'original',
      rowsSnapshot: [],
    }],
  };
}

export function createGardenBed(input: {
  name: string;
  photoUri: string;
  reminders: BedReminderSchedule;
  location?: string;
  now?: string;
}): GardenBed {
  const now = input.now ?? new Date().toISOString();
  return {
    id: createEntityId('bed'),
    name: input.name.trim(),
    location: input.location ?? 'Newcastle, NSW',
    createdAt: now,
    updatedAt: now,
    reminders: {
      ...input.reminders,
      weekdays: [...input.reminders.weekdays],
      times: [...input.reminders.times],
    },
    careEvents: [],
    cycles: [createPlantingCycle(input.photoUri, now)],
  };
}

export function updateGardenBed(data: AppData, bedId: string, updater: (bed: GardenBed) => GardenBed): AppData {
  const updatedAt = new Date().toISOString();
  return {
    ...data,
    schemaVersion: GARDEN_SCHEMA_VERSION,
    beds: data.beds.map((bed) => bed.id === bedId ? { ...updater(bed), updatedAt } : bed),
  };
}

export function addGardenBed(data: AppData, bed: GardenBed): AppData {
  return {
    ...data,
    schemaVersion: GARDEN_SCHEMA_VERSION,
    beds: [bed, ...data.beds],
  };
}

export function recordWateringCompleted(data: AppData, bedId: string, scheduledFor?: string, completedAt = new Date().toISOString()) {
  const event: BedCareEvent = {
    id: createEntityId('care'),
    type: 'watering-completed',
    completedAt,
    scheduledFor,
  };
  return updateGardenBed(data, bedId, (bed) => ({ ...bed, careEvents: [...(bed.careEvents ?? []), event] }));
}

export function updatePlantingCycle(
  data: AppData,
  bedId: string,
  cycleId: string,
  updater: (cycle: BedCycle) => BedCycle,
) {
  return updateGardenBed(data, bedId, (bed) => ({
    ...bed,
    cycles: bed.cycles.map((cycle) => cycle.id === cycleId ? updater(cycle) : cycle),
  }));
}

/** Hides a bed without removing any record or media, so it remains recoverable. */
export function softDeleteGardenBed(data: AppData, bedId: string, deletedAt = new Date().toISOString()) {
  return updateGardenBed(data, bedId, (bed) => ({ ...bed, deletedAt }));
}
