import { CropGuide, PlantedRow, WaterStage } from '../types';

const DAY = 86_400_000;

export function startOfDay(value: string | Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(value: string | Date, days: number) {
  return new Date(startOfDay(value).getTime() + days * DAY);
}

export function daysSince(value: string | Date, now = new Date()) {
  return Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(value).getTime()) / DAY));
}

export function shortDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(new Date(value));
}

export function longDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

export function isoDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateRange(plantedAt: string, range: [number, number]) {
  return `${shortDate(addDays(plantedAt, range[0]))} – ${shortDate(addDays(plantedAt, range[1]))}`;
}

export function rowStage(row: PlantedRow, now = new Date()): WaterStage {
  const age = daysSince(row.plantedAt, now);
  if (age <= row.germinationDays[1]) return 'germinating';
  if (age <= Math.max(row.germinationDays[1] + 14, Math.round(row.harvestDays[0] * 0.45))) return 'seedling';
  if (age < row.harvestDays[0]) return 'established';
  return 'harvest-ready';
}

export function stageLabel(stage: WaterStage) {
  return ({
    germinating: 'Germinating',
    seedling: 'Seedling',
    established: 'Growing',
    'harvest-ready': 'Harvest window',
  } as const)[stage];
}

export function wateringAdvice(row: PlantedRow, guide?: CropGuide) {
  const stage = rowStage(row);
  if (!guide) return 'Check the soil today and water if the top layer is dry.';
  if (stage === 'germinating') return guide.seedWater;
  if (stage === 'seedling') return guide.seedlingWater;
  return guide.establishedWater;
}

export function weatherIcon(code: number) {
  if (code === 0) return '☀️';
  if (code <= 3) return '🌤️';
  if ([45, 48].includes(code)) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '⛅';
}
