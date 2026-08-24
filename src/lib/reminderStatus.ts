import { BedReminderSchedule, GardenBed } from '../types';

export type BedReminderState = {
  kind: 'off' | 'upcoming' | 'complete' | 'overdue';
  latestDue?: Date;
  nextDue?: Date;
  completedAt?: Date;
};

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  return { hour, minute };
}

function scheduledOccurrences(schedule: BedReminderSchedule, now: Date) {
  const occurrences: Date[] = [];
  for (let offset = -8; offset <= 8; offset += 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    if (!schedule.weekdays.includes(day.getDay())) continue;
    schedule.times.forEach((time) => {
      const parsed = parseTime(time);
      if (!parsed) return;
      const occurrence = new Date(day);
      occurrence.setHours(parsed.hour, parsed.minute, 0, 0);
      occurrences.push(occurrence);
    });
  }
  return occurrences.sort((a, b) => a.getTime() - b.getTime());
}

export function bedReminderState(bed: GardenBed, now = new Date()): BedReminderState {
  const schedule = bed.reminders;
  if (!schedule?.enabled || !schedule.weekdays.length || !schedule.times.length) return { kind: 'off' };

  const occurrences = scheduledOccurrences(schedule, now);
  const latestDue = [...occurrences].reverse().find((occurrence) => occurrence.getTime() <= now.getTime());
  const nextDue = occurrences.find((occurrence) => occurrence.getTime() > now.getTime());
  const completedAt = [...(bed.careEvents ?? [])]
    .reverse()
    .find((event) => event.type === 'watering-completed' && !Number.isNaN(new Date(event.completedAt).getTime()));
  const completedDate = completedAt ? new Date(completedAt.completedAt) : undefined;

  if (latestDue && (!completedDate || completedDate.getTime() < latestDue.getTime())) {
    return { kind: 'overdue', latestDue, nextDue, completedAt: completedDate };
  }
  return { kind: latestDue && completedDate ? 'complete' : 'upcoming', latestDue, nextDue, completedAt: completedDate };
}

export function overdueLabel(due: Date, now = new Date()) {
  const minutes = Math.max(1, Math.floor((now.getTime() - due.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m overdue`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h overdue`;
  const days = Math.floor(hours / 24);
  return `${days}d overdue`;
}
