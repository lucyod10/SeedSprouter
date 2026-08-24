export type Point = { x: number; y: number };

export type WaterStage = 'germinating' | 'seedling' | 'established' | 'harvest-ready';

export type CropGuide = {
  id: string;
  name: string;
  emoji: string;
  category?: 'Herb' | 'Leafy green' | 'Root' | 'Brassica' | 'Legume' | 'Fruiting vegetable' | 'Allium' | 'Companion';
  aliases?: string[];
  germinationDays: [number, number];
  harvestDays: [number, number];
  sowMonths: number[];
  spacingCm: number;
  sun: string;
  seedWater: string;
  seedlingWater: string;
  establishedWater: string;
  tip: string;
};

export type PlantedRow = {
  id: string;
  cropId: string;
  cropName: string;
  plantedAt: string;
  germinationDays: [number, number];
  harvestDays: [number, number];
  labelPosition?: Point;
  packetFrontPhotoUri?: string;
  packetBackPhotoUri?: string;
  /** Kept for gardens saved by earlier builds. */
  packetPhotoUri?: string;
  notes?: string;
  color: string;
  /** Original single outline retained for backward compatibility with existing gardens. */
  path: Point[];
  /** Additional independently editable pen strokes added by newer builds. */
  paths?: Point[][];
};

export type ProgressPhoto = {
  id: string;
  uri: string;
  takenAt: string;
  note?: string;
  /** Historical copy of the labels and landmarks shown with this image. */
  rowsSnapshot?: PlantedRow[];
  /** Optional provenance for newer records; older progress photos remain valid. */
  kind?: 'original' | 'progress';
};

export type BedReminderSchedule = {
  enabled: boolean;
  /** JavaScript weekday numbers: Sunday = 0 through Saturday = 6. */
  weekdays: number[];
  /** Local times in 24-hour HH:mm format. */
  times: string[];
};

export type BedCareEvent = {
  id: string;
  type: 'watering-completed';
  completedAt: string;
  /** The reminder occurrence this check-off satisfied, when one was overdue. */
  scheduledFor?: string;
};

export type BedCycle = {
  id: string;
  startedAt: string;
  harvestedAt?: string;
  coverPhotoUri: string;
  rows: PlantedRow[];
  progress: ProgressPhoto[];
};

export type GardenBed = {
  id: string;
  name: string;
  location: string;
  createdAt: string;
  /** Added by schema v3; absent on gardens created by older builds. */
  updatedAt?: string;
  /** Recoverable soft deletion. Cycles, maps and photos remain in protected storage. */
  deletedAt?: string;
  reminders?: BedReminderSchedule;
  /** Append-only care history. Optional so every previously saved bed remains valid. */
  careEvents?: BedCareEvent[];
  cycles: BedCycle[];
};

export type AppSettings = {
  remindersEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
};

export type AppData = {
  /** Logical model version; absent means a pre-versioned garden and remains supported. */
  schemaVersion?: number;
  beds: GardenBed[];
  settings: AppSettings;
};

export type WeatherDay = {
  date: string;
  min: number;
  max: number;
  rainMm: number;
  rainChance: number;
  weatherCode: number;
};
