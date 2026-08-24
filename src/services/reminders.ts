import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { CROPS } from '../data/crops';
import { addDays, rowStage } from '../lib/dates';
import { AppData, PlantedRow } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function stagePrompt(row: PlantedRow, date: Date) {
  const guide = CROPS.find((crop) => crop.id === row.cropId);
  const stage = rowStage(row, date);
  if (stage === 'germinating') return `Keep ${row.cropName} seed rows gently and evenly moist.`;
  if (stage === 'seedling') return `Check ${row.cropName} seedlings and water at soil level if dry.`;
  if (stage === 'harvest-ready') return `Check ${row.cropName} moisture and look for harvest-ready produce.`;
  return guide?.establishedWater ?? `Check ${row.cropName} soil moisture before watering.`;
}

export async function requestReminderPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('garden-care', {
      name: 'Garden care',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function rebuildReminders(data: AppData) {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const gardenReminderIds = existing
    .filter((notification) => {
      const notificationData = notification.content.data;
      return notificationData?.kind === 'garden-watering'
        || (notificationData?.kind === undefined && notificationData?.screen === 'bed' && typeof notificationData?.bedId === 'string');
    })
    .map((notification) => notification.identifier);
  await Promise.all(gardenReminderIds.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));

  const candidates: { when: Date; bedName: string; body: string; bedId: string }[] = [];
  for (const bed of data.beds) {
    if (bed.deletedAt) continue;
    const schedule = bed.reminders;
    const cycle = [...bed.cycles].reverse().find((item) => !item.harvestedAt);
    if (!schedule?.enabled || !cycle || !schedule.weekdays.length || !schedule.times.length) continue;

    for (let dayOffset = 0; dayOffset <= 45; dayOffset += 1) {
      const day = addDays(new Date(), dayOffset);
      if (!schedule.weekdays.includes(day.getDay())) continue;
      for (const time of schedule.times) {
        const [hour, minute] = time.split(':').map(Number);
        const when = new Date(day);
        when.setHours(hour, minute, 0, 0);
        if (when.getTime() <= Date.now() + 30_000) continue;
        const firstRow = cycle.rows[0];
        candidates.push({
          when,
          bedName: bed.name,
          bedId: bed.id,
          body: firstRow ? stagePrompt(firstRow, when) : 'Check the soil moisture and water this bed if it feels dry.',
        });
      }
    }
  }

  candidates.sort((a, b) => a.when.getTime() - b.when.getTime());
  // iOS limits pending local notifications. Keep a rolling window and rebuild whenever data changes.
  for (const candidate of candidates.slice(0, 60)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💧 ${candidate.bedName}`,
        body: candidate.body,
        data: { kind: 'garden-watering', screen: 'bed', bedId: candidate.bedId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: candidate.when,
        ...(Platform.OS === 'android' ? { channelId: 'garden-care' } : {}),
      },
    });
  }
}
