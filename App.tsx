import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PhotoMap } from './src/components/PhotoMap';
import { FullScreenBedEditor } from './src/components/FullScreenBedEditor';
import { GardenImage } from './src/components/GardenImage';
import { GardenIcon, GardenIconName } from './src/components/GardenIcon';
import { ProgressCamera } from './src/components/ProgressCamera';
import { IconButton, palette, PrimaryButton, ProgressRing, SectionTitle } from './src/components/Ui';
import { CROPS, cropById, cropSuggestions, cropsForMonth, matchCropGuide } from './src/data/crops';
import {
  addGardenBed,
  activeCycle,
  createEntityId,
  createGardenBed,
  createPlantingCycle,
  recordWateringCompleted,
  snapshotRows,
  softDeleteGardenBed,
  updateGardenBed,
  updatePlantingCycle,
  visibleBeds,
} from './src/domain/garden';
import {
  dateRange,
  daysSince,
  isoDate,
  longDate,
  rowStage,
  shortDate,
  stageLabel,
  wateringAdvice,
  weatherIcon,
} from './src/lib/dates';
import { bedReminderState, overdueLabel, type BedReminderState } from './src/lib/reminderStatus';
import { choosePhoto, takePhoto } from './src/services/media';
import { rebuildReminders, requestReminderPermission } from './src/services/reminders';
import { DEFAULT_BED_REMINDERS, EMPTY_DATA, GardenDataUnavailableError, loadData, saveData } from './src/services/storage';
import { getNewcastleWeather, weatherWaterNote } from './src/services/weather';
import { brandAssets } from './src/theme/brand';
import { AppData, BedCycle, BedReminderSchedule, GardenBed, PlantedRow, ProgressPhoto, WeatherDay } from './src/types';

type Tab = 'today' | 'beds' | 'guide';
type PhotoSource = 'camera' | 'library';
type ViewedProgress = { cycleId: string; photo: ProgressPhoto };

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatReminderSummary(schedule?: BedReminderSchedule) {
  if (!schedule?.enabled) return 'Off · tap to configure this bed';
  const days = schedule.weekdays.length === 7 ? 'Every day' : schedule.weekdays.map((day) => DAY_NAMES[day]).join(', ');
  return `${days} · ${schedule.times.map(formatReminderTime).join(', ')}`;
}

function formatReminderTime(time: string) {
  const [hourText, minute = '00'] = time.split(':');
  const hour24 = Number(hourText);
  if (!Number.isInteger(hour24) || hour24 < 0 || hour24 > 23) return time;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour24 % 12 || 12}:${minute} ${period}`;
}

function photoError(error: unknown) {
  Alert.alert('Couldn’t add that photo', error instanceof Error ? error.message : 'Please try again.');
}

function AppContent() {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [storageWritable, setStorageWritable] = useState(true);
  const [tab, setTab] = useState<Tab>('today');
  const [selectedBedId, setSelectedBedId] = useState<string>();
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [addBedOpen, setAddBedOpen] = useState(false);
  const [newBedName, setNewBedName] = useState('');
  const [newBedPhoto, setNewBedPhoto] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorRows, setEditorRows] = useState<PlantedRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<string>();
  const [rowFormOpen, setRowFormOpen] = useState(false);
  const [plantName, setPlantName] = useState('');
  const [plantedAt, setPlantedAt] = useState(isoDate());
  const [rowNotes, setRowNotes] = useState('');
  const [packetFrontPhoto, setPacketFrontPhoto] = useState<string>();
  const [packetBackPhoto, setPacketBackPhoto] = useState<string>();
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressCameraOpen, setProgressCameraOpen] = useState(false);
  const [progressPhoto, setProgressPhoto] = useState<string>();
  const [progressNote, setProgressNote] = useState('');
  const [replaceBedPhoto, setReplaceBedPhoto] = useState(true);
  const [viewedProgress, setViewedProgress] = useState<ViewedProgress>();
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderForm, setReminderForm] = useState<BedReminderSchedule>(DEFAULT_BED_REMINDERS);
  const [restartOpen, setRestartOpen] = useState(false);
  const [restartPhoto, setRestartPhoto] = useState<string>();

  const selectedBed = data.beds.find((bed) => bed.id === selectedBedId);
  const selectedCycle = activeCycle(selectedBed);
  const viewedCycle = viewedProgress ? selectedBed?.cycles.find((cycle) => cycle.id === viewedProgress.cycleId) : undefined;

  useEffect(() => {
    loadData()
      .then(setData)
      .catch((error) => {
        setStorageWritable(false);
        Alert.alert(
          error instanceof GardenDataUnavailableError ? 'Garden data protected' : 'Storage unavailable',
          'Saved data could not be safely verified. Seed Sprouter is now read-only and will not overwrite it. Keep the app installed and restore from a verified backup before making changes.',
        );
      })
      .finally(() => setReady(true));
    refreshWeather();
  }, []);

  const updateData = async (next: AppData) => {
    if (!storageWritable) {
      Alert.alert('Protected read-only mode', 'Changes are blocked so existing garden data cannot be overwritten.');
      return false;
    }
    try {
      await saveData(next);
      setData(next);
    } catch {
      Alert.alert('Change not saved', 'The previous verified garden snapshot is still intact. Please try again before closing the app.');
      return false;
    }
    try {
      await rebuildReminders(next);
    } catch {
      Alert.alert('Reminder update delayed', 'Your garden data is safely saved, but notifications could not be rescheduled right now.');
    }
    return true;
  };

  const refreshWeather = async () => {
    setWeatherLoading(true);
    try {
      setWeather(await getNewcastleWeather());
    } catch {
      // The dashboard keeps working offline; an inline fallback is shown.
    } finally {
      setWeatherLoading(false);
    }
  };

  const getPhoto = async (source: PhotoSource, setter: (uri?: string) => void) => {
    try {
      const uri = source === 'camera' ? await takePhoto() : await choosePhoto();
      if (uri) setter(uri);
    } catch (error) {
      photoError(error);
    }
  };

  const createBed = async () => {
    if (!newBedName.trim() || !newBedPhoto) return;
    const bed = createGardenBed({ name: newBedName, photoUri: newBedPhoto, reminders: DEFAULT_BED_REMINDERS });
    await updateData(addGardenBed(data, bed));
    setAddBedOpen(false);
    setNewBedName('');
    setNewBedPhoto(undefined);
    setSelectedBedId(bed.id);
    setEditorRows([]);
    setEditorOpen(true);
    setTab('beds');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const updateSelectedCycle = async (updater: (cycle: BedCycle) => BedCycle) => {
    if (!selectedBed || !selectedCycle) return;
    await updateData(updatePlantingCycle(data, selectedBed.id, selectedCycle.id, updater));
  };

  const openEditor = () => {
    if (!selectedCycle) return;
    setEditorRows(selectedCycle.rows);
    setEditorOpen(true);
  };

  const editRowDetails = (rowId: string) => {
    const row = editorRows.find((item) => item.id === rowId);
    if (!row) return;
    setEditingRowId(rowId);
    setPlantName(row.cropName);
    setPlantedAt(isoDate(new Date(row.plantedAt)));
    setRowNotes(row.notes ?? '');
    setPacketFrontPhoto(row.packetFrontPhotoUri ?? row.packetPhotoUri);
    setPacketBackPhoto(row.packetBackPhotoUri);
    setEditorOpen(false);
    setRowFormOpen(true);
  };

  const saveRowDetails = () => {
    if (!editingRowId || !plantName.trim()) return;
    const guide = matchCropGuide(plantName);
    setEditorRows((current) => current.map((row) => row.id !== editingRowId ? row : {
      ...row,
      cropId: guide?.id ?? 'custom',
      cropName: plantName.trim(),
      plantedAt: new Date(`${plantedAt}T12:00:00`).toISOString(),
      germinationDays: guide?.germinationDays ?? row.germinationDays,
      harvestDays: guide?.harvestDays ?? row.harvestDays,
      packetFrontPhotoUri: packetFrontPhoto,
      packetBackPhotoUri: packetBackPhoto,
      packetPhotoUri: undefined,
      notes: rowNotes.trim() || undefined,
    }));
    setRowFormOpen(false);
    setEditorOpen(true);
    setEditingRowId(undefined);
    setPacketFrontPhoto(undefined);
    setPacketBackPhoto(undefined);
    setRowNotes('');
    Haptics.selectionAsync();
  };

  const saveEditor = async () => {
    await updateSelectedCycle((cycle) => {
      const rows = snapshotRows(editorRows);
      const hasCurrentPhoto = cycle.progress.some((photo) => photo.uri === cycle.coverPhotoUri);
      const progress = cycle.progress.map((photo) => photo.uri === cycle.coverPhotoUri ? { ...photo, rowsSnapshot: rows } : photo);
      if (!hasCurrentPhoto) progress.push({ id: createEntityId('photo'), uri: cycle.coverPhotoUri, takenAt: cycle.startedAt, note: 'Original bed photo', kind: 'original', rowsSnapshot: rows });
      return { ...cycle, rows, progress };
    });
    setEditorOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const saveProgress = async () => {
    if (!progressPhoto) return;
    await updateSelectedCycle((cycle) => {
      const rows = snapshotRows(cycle.rows);
      const photo: ProgressPhoto = { id: createEntityId('photo'), uri: progressPhoto, takenAt: new Date().toISOString(), note: progressNote.trim() || undefined, kind: 'progress', rowsSnapshot: rows };
      const hasCurrentPhoto = cycle.progress.some((entry) => entry.uri === cycle.coverPhotoUri);
      const existingProgress = cycle.progress.map((entry) => entry.uri === cycle.coverPhotoUri ? { ...entry, rowsSnapshot: rows } : entry);
      if (!hasCurrentPhoto) existingProgress.push({ id: createEntityId('photo'), uri: cycle.coverPhotoUri, takenAt: cycle.startedAt, note: 'Original bed photo', kind: 'original', rowsSnapshot: rows });
      return { ...cycle, coverPhotoUri: replaceBedPhoto ? progressPhoto : cycle.coverPhotoUri, progress: [photo, ...existingProgress] };
    });
    setProgressOpen(false);
    setProgressPhoto(undefined);
    setProgressNote('');
    setReplaceBedPhoto(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const harvestBed = () => {
    if (!selectedCycle) return;
    Alert.alert(
      'Finish this planting cycle?',
      'Its map, rows and progress photos will stay in the bed history.',
      [
        { text: 'Keep growing', style: 'cancel' },
        {
          text: 'Mark harvested',
          onPress: async () => {
            await updateSelectedCycle((cycle) => ({ ...cycle, harvestedAt: new Date().toISOString() }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    );
  };

  const deleteSelectedBed = () => {
    if (!selectedBed) return;
    Alert.alert(
      `Delete ${selectedBed.name}?`,
      'It will disappear from your garden and its reminders will stop. Its photos, maps and planting history will remain safely stored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete bed',
          style: 'destructive',
          onPress: async () => {
            const next = softDeleteGardenBed(data, selectedBed.id);
            if (await updateData(next)) {
              setSelectedBedId(undefined);
              setTab('beds');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
          },
        },
      ],
    );
  };

  const openBedActions = () => {
    if (!selectedBed) return;
    if (Platform.OS === 'ios') {
      const options = selectedCycle ? ['Cancel', 'Mark harvested', 'Delete bed'] : ['Cancel', 'Delete bed'];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: options.length - 1,
          title: selectedBed.name,
        },
        (buttonIndex) => {
          if (options[buttonIndex] === 'Mark harvested') harvestBed();
          if (options[buttonIndex] === 'Delete bed') deleteSelectedBed();
        },
      );
      return;
    }
    Alert.alert(selectedBed.name, undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...(selectedCycle ? [{ text: 'Mark harvested', onPress: harvestBed }] : []),
      { text: 'Delete bed', style: 'destructive', onPress: deleteSelectedBed },
    ]);
  };

  const restartBed = async () => {
    if (!selectedBed || !restartPhoto) return;
    const cycle = createPlantingCycle(restartPhoto);
    await updateData(updateGardenBed(data, selectedBed.id, (bed) => ({ ...bed, cycles: [...bed.cycles, cycle] })));
    setRestartOpen(false);
    setRestartPhoto(undefined);
    setEditorRows([]);
    setEditorOpen(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const useProgressAsMainPhoto = async () => {
    if (!selectedBed || !viewedProgress) return;
    const next = updatePlantingCycle(data, selectedBed.id, viewedProgress.cycleId, (cycle) => {
      const rows = snapshotRows(cycle.rows);
      const hasCurrentPhoto = cycle.progress.some((photo) => photo.uri === cycle.coverPhotoUri);
      const progress = cycle.progress.map((photo) => photo.uri === cycle.coverPhotoUri ? { ...photo, rowsSnapshot: rows } : photo);
      if (!hasCurrentPhoto) progress.push({ id: createEntityId('photo'), uri: cycle.coverPhotoUri, takenAt: cycle.startedAt, note: 'Saved bed photo', kind: 'progress', rowsSnapshot: rows });
      return { ...cycle, coverPhotoUri: viewedProgress.photo.uri, progress };
    });
    if (await updateData(next)) {
      setViewedProgress(undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const openReminderSettings = () => {
    if (!selectedBed) return;
    const schedule = selectedBed.reminders ?? DEFAULT_BED_REMINDERS;
    setReminderForm({ ...schedule, weekdays: [...schedule.weekdays], times: [...schedule.times] });
    setReminderOpen(true);
  };

  const saveReminderSettings = async () => {
    if (!selectedBed) return;
    if (reminderForm.enabled) {
      const granted = await requestReminderPermission();
      if (!granted) {
        Alert.alert('Notifications are off', 'Enable notifications in iPhone Settings to receive watering reminders.');
        return;
      }
    }
    const next = updateGardenBed(data, selectedBed.id, (bed) => ({ ...bed, reminders: reminderForm }));
    await updateData(next);
    setReminderOpen(false);
  };

  const markBedWatered = async (bedId: string, scheduledFor?: string) => {
    const next = recordWateringCompleted(data, bedId, scheduledFor);
    if (await updateData(next)) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (!ready) {
    return <View style={styles.loading}><Image source={brandAssets.primaryMark} resizeMode="contain" style={styles.loadingBrandMark} /><Text style={styles.brand}>Seed Sprouter</Text></View>;
  }

  if (selectedBed) {
    return (
      <View style={styles.app}>
        <BedScreen
          bed={selectedBed}
          cycle={selectedCycle}
          onBack={() => setSelectedBedId(undefined)}
          onEditMap={openEditor}
          onProgress={() => { setProgressPhoto(undefined); setProgressNote(''); setReplaceBedPhoto(true); setProgressCameraOpen(true); }}
          onReminders={openReminderSettings}
          onMenu={openBedActions}
          onRestart={() => setRestartOpen(true)}
          onViewProgress={(cycleId, photo) => setViewedProgress({ cycleId, photo })}
        />
        <RowModal
          visible={rowFormOpen}
          plantName={plantName}
          plantedAt={plantedAt}
          notes={rowNotes}
          packetFrontPhoto={packetFrontPhoto}
          packetBackPhoto={packetBackPhoto}
          onPlantName={setPlantName}
          onPlantedAt={setPlantedAt}
          onNotes={setRowNotes}
          onPacketFrontPhoto={(source) => getPhoto(source, setPacketFrontPhoto)}
          onPacketBackPhoto={(source) => getPhoto(source, setPacketBackPhoto)}
          onClose={() => { setRowFormOpen(false); setEditorOpen(true); }}
          onSave={saveRowDetails}
        />
        <FullScreenBedEditor
          visible={editorOpen}
          photoUri={selectedCycle?.coverPhotoUri ?? selectedBed.cycles[selectedBed.cycles.length - 1].coverPhotoUri}
          rows={editorRows}
          onRowsChange={setEditorRows}
          onEditRow={editRowDetails}
          onCancel={() => setEditorOpen(false)}
          onSave={saveEditor}
        />
        {selectedCycle ? <ProgressCamera
          visible={progressCameraOpen}
          referenceUri={selectedCycle.coverPhotoUri}
          rows={selectedCycle.rows}
          onClose={() => { setProgressCameraOpen(false); if (progressPhoto) setProgressOpen(true); }}
          onUsePhoto={(uri) => { setProgressPhoto(uri); setProgressCameraOpen(false); setProgressOpen(true); }}
          onChoosePhoto={() => getPhoto('library', (uri) => { if (uri) { setProgressPhoto(uri); setProgressCameraOpen(false); setProgressOpen(true); } })}
        /> : null}
        <PhotoNoteModal
          visible={progressOpen}
          title="Add progress photo"
          photo={progressPhoto}
          note={progressNote}
          replaceBedPhoto={replaceBedPhoto}
          onReplaceBedPhoto={setReplaceBedPhoto}
          onPhoto={(source) => { if (source === 'camera') { setProgressOpen(false); setProgressCameraOpen(true); } else { getPhoto(source, setProgressPhoto); } }}
          onNote={setProgressNote}
          onClose={() => { setProgressOpen(false); setProgressPhoto(undefined); setProgressNote(''); }}
          onSave={saveProgress}
        />
        <ReminderModal
          visible={reminderOpen}
          schedule={reminderForm}
          onChange={setReminderForm}
          onClose={() => setReminderOpen(false)}
          onSave={saveReminderSettings}
        />
        <RestartModal
          visible={restartOpen}
          photo={restartPhoto}
          onPhoto={(source) => getPhoto(source, setRestartPhoto)}
          onClose={() => setRestartOpen(false)}
          onSave={restartBed}
        />
        <ProgressPhotoViewer
          visible={Boolean(viewedProgress && viewedCycle)}
          photo={viewedProgress?.photo}
          cycle={viewedCycle}
          onClose={() => setViewedProgress(undefined)}
          onUseAsMain={useProgressAsMainPhoto}
        />
      </View>
    );
  }

  return (
    <View style={styles.app}>
      <View style={styles.screen}>
        {tab === 'today' ? (
          <TodayScreen
            data={data}
            weather={weather}
            refreshing={weatherLoading}
            onRefresh={refreshWeather}
            onAddBed={() => setAddBedOpen(true)}
            onOpenBed={setSelectedBedId}
            onMarkWatered={markBedWatered}
          />
        ) : tab === 'beds' ? (
          <BedsScreen beds={visibleBeds(data)} onAdd={() => setAddBedOpen(true)} onOpen={setSelectedBedId} />
        ) : (
          <GuideScreen />
        )}
      </View>
      <BottomTabs tab={tab} onChange={setTab} />
      <AddBedModal
        visible={addBedOpen}
        name={newBedName}
        photo={newBedPhoto}
        onName={setNewBedName}
        onPhoto={(source) => getPhoto(source, setNewBedPhoto)}
        onClose={() => setAddBedOpen(false)}
        onSave={createBed}
      />

      <StatusBar style="dark" />
    </View>
  );

}

function TodayScreen({ data, weather, refreshing, onRefresh, onAddBed, onOpenBed, onMarkWatered }: {
  data: AppData;
  weather: WeatherDay[];
  refreshing: boolean;
  onRefresh: () => void;
  onAddBed: () => void;
  onOpenBed: (id: string) => void;
  onMarkWatered: (bedId: string, scheduledFor?: string) => void;
}) {
  const bedSummaries = visibleBeds(data).map((bed) => ({ bed, cycle: activeCycle(bed) ?? bed.cycles[bed.cycles.length - 1], active: Boolean(activeCycle(bed)) }));
  const activeBeds = bedSummaries.filter((item) => item.active);
  const activeRows = activeBeds.flatMap(({ bed, cycle }) => cycle.rows.map((row) => ({ bed, row })));
  const today = weather[0];
  const reminderBeds = activeBeds.filter(({ bed }) => bed.reminders?.enabled);
  const reminderStates = new Map(activeBeds.map(({ bed }) => [bed.id, bedReminderState(bed)]));
  const overdueBeds = reminderBeds.filter(({ bed }) => reminderStates.get(bed.id)?.kind === 'overdue');
  const harvestSoon = activeRows.filter(({ row }) => daysSince(row.plantedAt) >= row.harvestDays[0] - 7);
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.leaf} />}
    >
      <View style={styles.todayHeader}>
        <View><Text style={styles.eyebrow}>SEED SPROUTER</Text><Text style={styles.todayTitle}>Today</Text><Text style={styles.todayDate}>{longDate(new Date().toISOString())}</Text></View>
        <Image source={brandAssets.compactMark} resizeMode="contain" style={styles.todayBrandMark} />
      </View>

      <View style={styles.weatherCard}>
        <View style={styles.weatherLocation}><MaterialCommunityIcons name="map-marker-outline" size={16} color="#000000" /><Text style={styles.weatherLocationText}>NEWCASTLE, NSW</Text></View>
        <View style={styles.todayWeather}>
        <Text style={styles.todayWeatherEmoji}>{today ? weatherIcon(today.weatherCode) : '🌤️'}</Text>
        <View style={styles.flex}><Text style={styles.todayWeatherTemp}>{today ? `${today.max}°` : 'Weather offline'}</Text><Text numberOfLines={1} style={styles.todayWeatherMeta}>{today ? `${today.min}° low · ${today.rainChance}% rain` : 'Pull down to refresh'}</Text></View>
        {today ? <ProgressRing progress={today.rainChance / 100} icon="water-outline" color="#00B7FF" size={46} strokeWidth={4} /> : null}
        </View>
        <View style={styles.weatherDivider} />
        <Text numberOfLines={2} style={styles.todayWeatherAdvice}>{weatherWaterNote(today)}</Text>
      </View>

      <View style={styles.todayMetrics}>
        <TodayMetric icon="water" color={overdueBeds.length ? '#FF5D73' : '#00DFA2'} value={String(overdueBeds.length || reminderBeds.length)} label={overdueBeds.length ? 'watering overdue' : reminderBeds.length === 1 ? 'bed scheduled' : 'beds scheduled'} />
        <View style={styles.todayMetricDivider} />
        <TodayMetric icon="harvest" color="#FFD400" value={String(harvestSoon.length)} label="near harvest" />
      </View>

      <View style={styles.todaySectionHeader}>
        <View style={styles.todaySectionHeading}><Text style={styles.todaySectionTitle}>Your beds</Text><Text style={styles.todaySectionCount}>{bedSummaries.length}</Text></View>
        <Pressable accessibilityLabel="Add garden bed" onPress={onAddBed} style={styles.todaySectionAdd}><GardenIcon name="add" size={21} color="#FFFFFF" /></Pressable>
      </View>
      {bedSummaries.length ? bedSummaries.map(({ bed, cycle, active }) => (
        <TodayBedCard key={bed.id} bed={bed} cycle={cycle} active={active} reminderState={reminderStates.get(bed.id)} onPress={() => onOpenBed(bed.id)} onMarkWatered={(scheduledFor) => onMarkWatered(bed.id, scheduledFor)} />
      )) : (
        <EmptyCard title="Your garden starts with a photo" body="Add a bed, then trace each planted row with your finger." action="Add my first bed" onPress={onAddBed} />
      )}
    </ScrollView>
  );
}

function TodayMetric({ icon, color, value, label }: { icon: GardenIconName; color: string; value: string; label: string }) {
  return <View style={styles.todayMetric}><View style={[styles.todayMetricRing, { borderColor: color }]}><GardenIcon name={icon} size={20} color="#000000" /></View><View><Text style={styles.todayMetricValue}>{value}</Text><Text style={styles.todayMetricLabel}>{label}</Text></View></View>;
}

function TodayBedCard({ bed, cycle, active, reminderState, onPress, onMarkWatered }: {
  bed: GardenBed;
  cycle: BedCycle;
  active: boolean;
  reminderState?: BedReminderState;
  onPress: () => void;
  onMarkWatered: (scheduledFor?: string) => void;
}) {
  const latest = cycle.progress[0];
  const updateDays = daysSince(latest?.takenAt ?? cycle.startedAt);
  const updateText = updateDays <= 0 ? 'Updated today' : updateDays === 1 ? 'Updated yesterday' : `Updated ${updateDays} days ago`;
  const averageProgress = cycle.rows.length ? cycle.rows.reduce((total, row) => total + Math.min(1, daysSince(row.plantedAt) / row.harvestDays[1]), 0) / cycle.rows.length : 0;
  const plantNames = cycle.rows.slice(0, 3).map((row) => row.cropName).join(' · ');
  const firstHarvest = cycle.rows.length ? Math.min(...cycle.rows.map((row) => row.harvestDays[0] - daysSince(row.plantedAt))) : undefined;
  const harvestText = firstHarvest === undefined ? 'No harvest estimate' : firstHarvest <= 0 ? 'Harvest window open' : `${firstHarvest}d to first harvest`;
  const hasReminder = active && bed.reminders?.enabled && reminderState && reminderState.kind !== 'off';
  const reminderTime = reminderState?.nextDue
    ? formatReminderTime(`${String(reminderState.nextDue.getHours()).padStart(2, '0')}:${String(reminderState.nextDue.getMinutes()).padStart(2, '0')}`)
    : undefined;
  const reminderTitle = reminderState?.kind === 'overdue'
    ? 'Water overdue'
    : reminderState?.kind === 'complete'
      ? 'Watered'
      : 'Water scheduled';
  const reminderDetail = reminderState?.kind === 'overdue' && reminderState.latestDue
    ? `${overdueLabel(reminderState.latestDue)} · tap to mark done`
    : reminderTime ? `Next ${reminderTime}` : 'Reminder is on';
  return (
    <View style={styles.todayBedCard}>
      <Pressable accessibilityLabel={`Open ${bed.name}`} onPress={onPress} style={({ pressed }) => [styles.todayBedPhoto, pressed && styles.cardPressed]}>
        <PhotoMap uri={cycle.coverPhotoUri} rows={cycle.rows} height={218} borderRadius={18} resizeMode="contain" />
        <View pointerEvents="none" style={styles.todayBedPhotoStatus}><View style={[styles.todayBedStatusDot, { backgroundColor: active ? '#00DFA2' : '#B6B6B6' }]} /><Text style={styles.todayBedPhotoStatusText}>{active ? 'Growing' : 'Harvested'}</Text></View>
      </Pressable>
      <View style={styles.todayBedInfo}>
        <Pressable accessibilityLabel={`Open details for ${bed.name}`} onPress={onPress} style={({ pressed }) => [styles.todayBedInfoMain, pressed && { opacity: 0.65 }]}>
          <View style={styles.todayBedNameRow}><Text numberOfLines={2} style={styles.todayBedName}>{bed.name}</Text><MaterialCommunityIcons name="chevron-right" size={22} color={palette.muted} /></View>
          <Text numberOfLines={2} style={styles.todayBedPlants}>{plantNames || 'Ready to map'}</Text>
          <View style={styles.todayBedGlanceRow}><MaterialCommunityIcons name="image-multiple-outline" size={15} color="#000000" /><Text style={styles.todayBedGlanceText}>{updateText}</Text></View>
          <View style={styles.todayBedGlanceRow}><MaterialCommunityIcons name="basket-outline" size={15} color="#000000" /><Text numberOfLines={1} style={styles.todayBedGlanceText}>{harvestText}</Text></View>
          <View style={styles.todayBedProgressRow}><ProgressRing progress={averageProgress} icon="sprout-outline" color="#7B61FF" size={38} strokeWidth={3} /><Text style={styles.todayBedProgressText}>{cycle.rows.length} plant{cycle.rows.length === 1 ? '' : 's'} · {cycle.progress.length} photo{cycle.progress.length === 1 ? '' : 's'}</Text></View>
        </Pressable>
        {hasReminder ? (
          <Pressable
            accessibilityLabel={reminderState.kind === 'overdue' ? `Mark ${bed.name} watered` : `Open ${bed.name} reminder`}
            onPress={reminderState.kind === 'overdue' ? () => onMarkWatered(reminderState.latestDue?.toISOString()) : onPress}
            style={({ pressed }) => [styles.todayBedAlarm, reminderState.kind === 'overdue' ? styles.todayBedAlarmOverdue : reminderState.kind === 'complete' ? styles.todayBedAlarmComplete : styles.todayBedAlarmUpcoming, pressed && { opacity: 0.68 }]}
          >
            <View style={styles.todayBedAlarmIcon}><MaterialCommunityIcons name={reminderState.kind === 'overdue' ? 'alarm-light-outline' : reminderState.kind === 'complete' ? 'check' : 'alarm'} size={18} color="#000000" /></View>
            <View style={styles.flex}><Text style={styles.todayBedAlarmTitle}>{reminderTitle}</Text><Text numberOfLines={1} style={styles.todayBedAlarmDetail}>{reminderDetail}</Text></View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function BedsScreen({ beds, onAdd, onOpen }: { beds: GardenBed[]; onAdd: () => void; onOpen: (id: string) => void }) {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
      <View style={styles.pageHeader}><View><Text style={styles.eyebrow}>YOUR GARDEN</Text><Text style={styles.heroTitle}>Garden beds</Text></View><IconButton icon="plus" label="Add garden bed" onPress={onAdd} /></View>
      {beds.length ? beds.map((bed) => {
        const cycle = activeCycle(bed) ?? bed.cycles[bed.cycles.length - 1];
        const isActive = Boolean(activeCycle(bed));
        return (
          <Pressable key={bed.id} onPress={() => onOpen(bed.id)} style={({ pressed }) => [styles.bedCard, pressed && styles.cardPressed]}>
            <PhotoMap uri={cycle.coverPhotoUri} rows={cycle.rows} height={205} borderRadius={16} resizeMode="contain" />
            <View style={styles.bedOverlay} />
            <View style={styles.bedStatus}><View style={[styles.statusDot, !isActive && { backgroundColor: '#B1B4AD' }]} /><Text style={styles.bedStatusText}>{isActive ? 'Growing' : 'Harvested'}</Text></View>
            <View style={styles.bedCardText}><Text style={styles.bedCardTitle}>{bed.name}</Text><Text style={styles.bedCardMeta}>{cycle.rows.length} row{cycle.rows.length === 1 ? '' : 's'} · cycle {bed.cycles.length}</Text></View>
          </Pressable>
        );
      }) : <EmptyCard title="No garden beds yet" body="Photograph a bed to start its planting map and history." action="Add a garden bed" onPress={onAdd} />}
    </ScrollView>
  );
}

function GuideScreen() {
  const suggested = useMemo(() => cropsForMonth(new Date().getMonth()), []);
  const [query, setQuery] = useState('');
  const visible = CROPS.filter((crop) => [crop.name, ...(crop.aliases ?? [])].some((name) => name.toLowerCase().includes(query.toLowerCase())));
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.eyebrow}>NEWCASTLE PLANTING GUIDE</Text><Text style={styles.heroTitle}>What to grow</Text>
      <View style={styles.guideIntro}><ProgressRing progress={0.78} icon="lightbulb-outline" color="#7B61FF" size={48} /><View style={styles.flex}><Text style={styles.cardTitle}>Good to sow this month</Text><Text style={styles.cardMeta}>{suggested.map((crop) => crop.name).join(', ')}</Text></View></View>
      <View style={styles.search}><MaterialCommunityIcons name="magnify" size={21} color={palette.muted} /><TextInput placeholder="Search crops" placeholderTextColor="#89938D" value={query} onChangeText={setQuery} style={styles.searchInput} /></View>
      {visible.map((crop) => (
        <View key={crop.id} style={styles.guideCard}>
          <View style={styles.guideHeading}><ProgressRing progress={suggested.includes(crop) ? 0.86 : 0.32} icon="sprout-outline" color={suggested.includes(crop) ? '#39B98A' : '#AEB5AE'} size={46} /><View style={styles.flex}><Text style={styles.guideName}>{crop.name}</Text><Text style={styles.cardMeta}>{crop.sun} · {crop.spacingCm} cm spacing</Text></View>{suggested.includes(crop) ? <Text style={styles.nowPill}>SOW NOW</Text> : null}</View>
          <View style={styles.statsRow}><Stat icon="timer-outline" label="GERMINATES" value={`${crop.germinationDays[0]}–${crop.germinationDays[1]} days`} /><Stat icon="basket-outline" label="HARVEST" value={`${crop.harvestDays[0]}–${crop.harvestDays[1]} days`} /></View>
          <Text style={styles.guideTip}>{crop.tip}</Text>
        </View>
      ))}
      <Text style={styles.disclaimer}>Growing estimates are a starting point for Newcastle’s temperate coastal climate. Variety, microclimate and weather matter; your seed packet takes priority.</Text>
    </ScrollView>
  );
}

function BedScreen({ bed, cycle, onBack, onEditMap, onProgress, onReminders, onMenu, onRestart, onViewProgress }: {
  bed: GardenBed;
  cycle?: BedCycle;
  onBack: () => void;
  onEditMap: () => void;
  onProgress: () => void;
  onReminders: () => void;
  onMenu: () => void;
  onRestart: () => void;
  onViewProgress: (cycleId: string, photo: ProgressPhoto) => void;
}) {
  const [inspectingMap, setInspectingMap] = useState(false);
  const shownCycle = cycle ?? bed.cycles[bed.cycles.length - 1];
  const mainPhoto: ProgressPhoto = {
    id: `main-${shownCycle.id}`,
    uri: shownCycle.coverPhotoUri,
    takenAt: shownCycle.startedAt,
    note: `${bed.name} planting map`,
    kind: 'original',
    rowsSnapshot: shownCycle.rows,
  };
  const timelinePhotos: ProgressPhoto[] = shownCycle.progress.length ? shownCycle.progress : [{
    id: `cover-${shownCycle.id}`,
    uri: shownCycle.coverPhotoUri,
    takenAt: shownCycle.startedAt,
    note: 'Original bed photo',
    kind: 'original',
    rowsSnapshot: shownCycle.rows,
  }];
  return (
    <SafeAreaView style={styles.app} edges={['top']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.bedDetailContent}>
        <View style={styles.detailHeader}><IconButton icon="arrow-left" label="Back" onPress={onBack} /><View style={styles.detailTitleWrap}><Text style={styles.detailTitle}>{bed.name}</Text><Text style={styles.cardMeta}>{bed.location} · cycle {bed.cycles.length}</Text></View><IconButton icon="dots-horizontal" label="Bed actions" onPress={onMenu} /></View>
        <Pressable accessibilityLabel="Open garden map full screen" onPress={() => setInspectingMap(true)} style={({ pressed }) => [styles.mapPreview, pressed && styles.cardPressed]}>
          <PhotoMap uri={shownCycle.coverPhotoUri} rows={shownCycle.rows} height={300} borderRadius={14} resizeMode="contain" />
          <View pointerEvents="none" style={styles.inspectPill}><MaterialCommunityIcons name="arrow-expand" size={16} color="#FFFFFF" /><Text style={styles.inspectPillText}>Inspect</Text></View>
        </Pressable>
        {cycle ? (
          <>
            <View style={styles.quickActions}>
              <Pressable onPress={onEditMap} style={styles.quickAction}><View style={styles.actionRing}><GardenIcon name="editMap" size={21} color={palette.ink} /></View><Text style={styles.quickActionText}>Edit map</Text></Pressable>
              <Pressable onPress={onProgress} style={styles.quickAction}><View style={styles.actionRing}><GardenIcon name="camera" size={21} color={palette.ink} /></View><Text style={styles.quickActionText}>Progress</Text></Pressable>
            </View>
            <Pressable onPress={onReminders} style={({ pressed }) => [styles.bedReminderCard, pressed && styles.cardPressed]}>
              <ProgressRing progress={bed.reminders?.enabled ? Math.max(0.15, (bed.reminders.weekdays.length / 7)) : 0} icon="bell-outline" color="#00DFA2" size={46} />
              <View style={styles.flex}><Text style={styles.cardTitle}>Watering reminders</Text><Text style={styles.cardMeta}>{formatReminderSummary(bed.reminders)}</Text></View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={palette.muted} />
            </Pressable>
            <SectionTitle title="Planted rows" action={<Text style={styles.sectionMeta}>{shownCycle.rows.length} mapped</Text>} />
            {shownCycle.rows.length ? shownCycle.rows.map((row) => <RowCard key={row.id} row={row} />) : <EmptyCard title="Map your first planted row" body="Open the full-screen editor, type a label, zoom in and draw around the planting." action="Open photo editor" onPress={onEditMap} />}
            <SectionTitle title="Progress timeline" />
            {timelinePhotos.map((photo) => (
              <Pressable key={photo.id} accessibilityLabel={`View photo from ${shortDate(photo.takenAt)}`} onPress={() => onViewProgress(shownCycle.id, photo)} style={({ pressed }) => [styles.progressCard, pressed && styles.cardPressed]}>
                <GardenImage uri={photo.uri} style={styles.progressImage} />
                <View style={styles.progressText}><View style={styles.progressTitleRow}><Text style={styles.cardTitle}>{shortDate(photo.takenAt)}</Text>{photo.uri === shownCycle.coverPhotoUri ? <Text style={styles.mainPhotoPill}>MAIN</Text> : null}</View><Text style={styles.cardMeta}>{photo.note || `Day ${daysSince(shownCycle.startedAt, new Date(photo.takenAt)) + 1}`}</Text><Text style={styles.tapPhotoHint}>Tap to view map</Text></View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={palette.muted} />
              </Pressable>
            ))}
          </>
        ) : (
          <View style={styles.harvestedCard}><Text style={styles.harvestedEmoji}>🧺</Text><Text style={styles.harvestedTitle}>This cycle was harvested</Text><Text style={styles.harvestedBody}>Its rows and photos are safely kept. Start again with a fresh photo of the bed.</Text><PrimaryButton label="Start a new planting cycle" icon="sprout" onPress={onRestart} /></View>
        )}

        {!cycle && bed.cycles.length > 0 ? (
          <View style={styles.historyBlock}><SectionTitle title="Previous cycles" />{[...bed.cycles].reverse().map((past, index) => <Text key={past.id} style={styles.historyLine}>Cycle {bed.cycles.length - index} · {longDate(past.startedAt)} · {past.rows.length} rows</Text>)}</View>
        ) : null}
      </ScrollView>
      <ProgressPhotoViewer visible={inspectingMap} photo={mainPhoto} cycle={shownCycle} onClose={() => setInspectingMap(false)} onUseAsMain={() => {}} inspectionOnly />
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

function ProgressPhotoViewer({ visible, photo, cycle, onClose, onUseAsMain, inspectionOnly }: {
  visible: boolean;
  photo?: ProgressPhoto;
  cycle?: BedCycle;
  onClose: () => void;
  onUseAsMain: () => void;
  inspectionOnly?: boolean;
}) {
  const [viewerHeight, setViewerHeight] = useState(1);
  const isMain = Boolean(photo && cycle && photo.uri === cycle.coverPhotoUri);
  return (
    <Modal visible={visible} animationType="none" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.photoViewer} onLayout={(event) => setViewerHeight(event.nativeEvent.layout.height)}>
        {photo && cycle ? <PhotoMap uri={photo.uri} rows={photo.rowsSnapshot ?? cycle.rows} height={viewerHeight} borderRadius={0} resizeMode="contain" interactive /> : null}
        <SafeAreaView edges={['top']} style={styles.photoViewerTop} pointerEvents="box-none">
          <Pressable accessibilityLabel="Close photo" onPress={onClose} style={styles.photoViewerClose}><MaterialCommunityIcons name="close" size={25} color="#FFFFFF" /></Pressable>
          <View style={styles.photoViewerTitlePill}><MaterialCommunityIcons name="map-marker-path" size={17} color="#FFFFFF" /><Text style={styles.photoViewerTitle}>Saved map</Text></View>
          <View style={{ width: 44 }} />
        </SafeAreaView>
        {photo && cycle ? (
          <SafeAreaView edges={['bottom']} style={styles.photoViewerBottom}>
            <View style={styles.photoViewerCopy}>
              <Text style={styles.photoViewerDate}>{longDate(photo.takenAt)}</Text>
              <Text style={styles.photoViewerNote}>{photo.note || `Day ${daysSince(cycle.startedAt, new Date(photo.takenAt)) + 1}`}</Text>
              <Text style={styles.photoViewerMapNote}>{(photo.rowsSnapshot ?? cycle.rows).length} mapped plant labels shown</Text>
            </View>
            {inspectionOnly ? null : isMain ? (
              <View style={styles.currentMainButton}><MaterialCommunityIcons name="check-circle" size={20} color="#000000" /><Text style={styles.currentMainText}>Current main photo</Text></View>
            ) : (
              <Pressable onPress={onUseAsMain} style={styles.restoreMainButton}><MaterialCommunityIcons name="image-sync-outline" size={20} color="#000000" /><Text style={styles.restoreMainText}>Make main photo</Text></Pressable>
            )}
          </SafeAreaView>
        ) : null}
        <StatusBar style="light" />
      </View>
    </Modal>
  );
}

function RowCard({ row }: { row: PlantedRow }) {
  const guide = cropById(row.cropId);
  const stage = rowStage(row);
  const age = daysSince(row.plantedAt);
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowCardTop}><View style={[styles.rowColor, { backgroundColor: row.color }]} /><View style={styles.rowPlantIcon}><MaterialCommunityIcons name="sprout-outline" size={20} color={palette.ink} /></View><View style={styles.flex}><Text style={styles.rowName}>{row.cropName}</Text><Text style={styles.cardMeta}>Planted {longDate(row.plantedAt)} · day {daysSince(row.plantedAt) + 1}</Text></View><Text style={styles.stagePill}>{stageLabel(stage)}</Text></View>
      <View style={styles.ringTimeline}>
        <View style={styles.ringMetric}><ProgressRing progress={age / row.germinationDays[1]} icon="sprout-outline" color="#00DFA2" size={44} /><View><Text style={styles.timelineLabel}>GERMINATION</Text><Text style={styles.timelineValue}>{dateRange(row.plantedAt, row.germinationDays)}</Text></View></View>
        <View style={styles.ringMetric}><ProgressRing progress={age / row.harvestDays[1]} icon="basket-outline" color="#FFD400" size={44} /><View><Text style={styles.timelineLabel}>HARVEST</Text><Text style={styles.timelineValue}>{dateRange(row.plantedAt, row.harvestDays)}</Text></View></View>
      </View>
      <View style={styles.rowAdvice}><MaterialCommunityIcons name="water-outline" size={20} color={palette.leaf} /><Text style={styles.rowAdviceText}>{wateringAdvice(row, guide)}</Text></View>
      {(row.packetFrontPhotoUri || row.packetBackPhotoUri || row.packetPhotoUri) ? (
        <View style={styles.packetThumbs}>
          {(row.packetFrontPhotoUri || row.packetPhotoUri) ? <View><GardenImage uri={(row.packetFrontPhotoUri || row.packetPhotoUri)!} style={styles.packetThumb} /><Text style={styles.packetCaption}>FRONT</Text></View> : null}
          {row.packetBackPhotoUri ? <View><GardenImage uri={row.packetBackPhotoUri} style={styles.packetThumb} /><Text style={styles.packetCaption}>BACK</Text></View> : null}
        </View>
      ) : null}
      {row.notes ? <Text style={styles.rowNotes}>{row.notes}</Text> : null}
    </View>
  );
}

function AddBedModal({ visible, name, photo, onName, onPhoto, onClose, onSave }: { visible: boolean; name: string; photo?: string; onName: (name: string) => void; onPhoto: (source: PhotoSource) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Sheet visible={visible} title="Add a garden bed" onClose={onClose}>
      <Text style={styles.inputLabel}>BED NAME</Text><TextInput value={name} onChangeText={onName} placeholder="e.g. Back fence bed" placeholderTextColor="#98A099" style={styles.input} autoFocus />
      <Text style={styles.inputLabel}>STARTING PHOTO</Text>
      {photo ? <GardenImage uri={photo} style={styles.formPhoto} /> : <View style={styles.photoPlaceholder}><MaterialCommunityIcons name="image-outline" size={38} color={palette.muted} /><Text style={styles.cardMeta}>Photograph the whole bed from above if you can</Text></View>}
      <View style={styles.twoButtons}><View style={styles.flex}><PrimaryButton label="Take photo" icon="camera-outline" tone="cream" onPress={() => onPhoto('camera')} /></View><View style={styles.flex}><PrimaryButton label="Choose photo" icon="image-outline" tone="cream" onPress={() => onPhoto('library')} /></View></View>
      <PrimaryButton label="Create garden bed" icon="sprout" disabled={!name.trim() || !photo} onPress={onSave} />
    </Sheet>
  );
}

function RowModal({ visible, plantName, plantedAt, notes, packetFrontPhoto, packetBackPhoto, onPlantName, onPlantedAt, onNotes, onPacketFrontPhoto, onPacketBackPhoto, onClose, onSave }: {
  visible: boolean;
  plantName: string;
  plantedAt: string;
  notes: string;
  packetFrontPhoto?: string;
  packetBackPhoto?: string;
  onPlantName: (name: string) => void;
  onPlantedAt: (date: string) => void;
  onNotes: (notes: string) => void;
  onPacketFrontPhoto: (source: PhotoSource) => void;
  onPacketBackPhoto: (source: PhotoSource) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const guide = matchCropGuide(plantName);
  const suggestions = cropSuggestions(plantName, 6);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(plantedAt) && !Number.isNaN(new Date(`${plantedAt}T12:00:00`).getTime());
  return (
    <Sheet visible={visible} title="Plant details" onClose={onClose}>
      <Text style={styles.inputLabel}>PLANT OR VARIETY</Text>
      <TextInput value={plantName} onChangeText={onPlantName} placeholder="e.g. Tommy Toe tomato" placeholderTextColor="#98A099" style={styles.input} autoCapitalize="words" />
      {suggestions.length ? <View style={styles.suggestions}>{suggestions.map((crop) => <Pressable key={crop.id} onPress={() => onPlantName(crop.name)} style={styles.suggestion}><Text style={styles.suggestionEmoji}>{crop.emoji}</Text><View style={styles.flex}><Text style={styles.suggestionText}>{crop.name}</Text><Text style={styles.suggestionMeta}>{crop.category ?? 'Garden plant'} · use growing guide</Text></View></Pressable>)}</View> : null}
      <Text style={styles.guideMatchText}>{guide ? `Matched to the ${guide.name} growing guide.` : 'Custom plant name. You can keep the default estimates or record packet advice in notes.'}</Text>
      <Text style={styles.inputLabel}>DATE PLANTED</Text>
      <TextInput value={plantedAt} onChangeText={onPlantedAt} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" style={[styles.input, !validDate && styles.inputError]} />
      <View style={styles.estimateCard}>
        <View><Text style={styles.timelineLabel}>ESTIMATED GERMINATION</Text><Text style={styles.timelineValue}>{validDate ? dateRange(`${plantedAt}T12:00:00`, guide?.germinationDays ?? [5, 14]) : '—'}</Text></View>
        <View><Text style={styles.timelineLabel}>ESTIMATED HARVEST</Text><Text style={styles.timelineValue}>{validDate ? dateRange(`${plantedAt}T12:00:00`, guide?.harvestDays ?? [45, 90]) : '—'}</Text></View>
      </View>
      {guide ? (
        <View style={styles.plantGuideCard}>
          <View style={styles.plantGuideHeading}>
            <MaterialCommunityIcons name="sprout-outline" size={21} color="#000000" />
            <View style={styles.flex}><Text style={styles.plantGuideTitle}>Auto-filled growing guide</Text><Text style={styles.plantGuideSource}>{guide.name} · Newcastle estimates</Text></View>
          </View>
          <View style={styles.plantGuideMetrics}>
            <View style={styles.plantGuideMetric}><Text style={styles.timelineLabel}>GERMINATION</Text><Text style={styles.timelineValue}>{guide.germinationDays[0]}–{guide.germinationDays[1]} days</Text></View>
            <View style={styles.plantGuideMetric}><Text style={styles.timelineLabel}>HARVEST</Text><Text style={styles.timelineValue}>{guide.harvestDays[0]}–{guide.harvestDays[1]} days</Text></View>
            <View style={styles.plantGuideMetric}><Text style={styles.timelineLabel}>SPACING</Text><Text style={styles.timelineValue}>{guide.spacingCm} cm</Text></View>
            <View style={styles.plantGuideMetric}><Text style={styles.timelineLabel}>LIGHT</Text><Text style={styles.timelineValue}>{guide.sun}</Text></View>
          </View>
          <View style={styles.plantGuideAdvice}><MaterialCommunityIcons name="water-outline" size={18} color="#000000" /><Text style={styles.plantGuideAdviceText}>{guide.seedWater}</Text></View>
          <Text style={styles.plantGuideTip}>{guide.tip}</Text>
        </View>
      ) : null}
      <Text style={styles.inputLabel}>SEED PACKET (OPTIONAL)</Text>
      <View style={styles.packetFields}>
        <PacketPhotoField side="Front" photo={packetFrontPhoto} onPhoto={onPacketFrontPhoto} />
        <PacketPhotoField side="Back" photo={packetBackPhoto} onPhoto={onPacketBackPhoto} />
      </View>
      <Text style={styles.inputLabel}>NOTES (OPTIONAL)</Text>
      <TextInput value={notes} onChangeText={onNotes} placeholder="Variety, spacing, packet advice…" placeholderTextColor="#98A099" style={[styles.input, styles.notesInput]} multiline />
      <PrimaryButton label="Save plant details" icon="check" disabled={!validDate || !plantName.trim()} onPress={onSave} />
    </Sheet>
  );
}

function PacketPhotoField({ side, photo, onPhoto }: { side: string; photo?: string; onPhoto: (source: PhotoSource) => void }) {
  return (
    <View style={styles.packetField}>
      {photo ? <GardenImage uri={photo} style={styles.packetFieldImage} /> : <View style={styles.packetFieldPlaceholder}><MaterialCommunityIcons name="seed-outline" size={27} color={palette.muted} /></View>}
      <Text style={styles.packetFieldTitle}>{side}</Text>
      <View style={styles.packetFieldActions}>
        <Pressable onPress={() => onPhoto('camera')} style={styles.packetMiniButton}><MaterialCommunityIcons name="camera-outline" size={18} color={palette.ink} /></Pressable>
        <Pressable onPress={() => onPhoto('library')} style={styles.packetMiniButton}><MaterialCommunityIcons name="image-outline" size={18} color={palette.ink} /></Pressable>
      </View>
    </View>
  );
}

function ReminderModal({ visible, schedule, onChange, onClose, onSave }: {
  visible: boolean;
  schedule: BedReminderSchedule;
  onChange: (schedule: BedReminderSchedule) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [newHour, setNewHour] = useState(7);
  const [newMinute, setNewMinute] = useState(0);
  const [newPeriod, setNewPeriod] = useState<'AM' | 'PM'>('AM');
  const hour24 = newPeriod === 'AM' ? newHour % 12 : (newHour % 12) + 12;
  const newTime = `${String(hour24).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
  const toggleDay = (day: number) => onChange({
    ...schedule,
    weekdays: schedule.weekdays.includes(day) ? schedule.weekdays.filter((item) => item !== day) : [...schedule.weekdays, day].sort(),
  });
  const addTime = () => {
    if (schedule.times.includes(newTime)) return;
    onChange({ ...schedule, times: [...schedule.times, newTime].sort() });
  };
  const canSave = !schedule.enabled || (schedule.weekdays.length > 0 && schedule.times.length > 0);
  return (
    <Sheet visible={visible} title="Bed reminders" onClose={onClose}>
      <View style={styles.reminderToggleRow}>
        <View style={styles.flex}><Text style={styles.cardTitle}>Remind me to check this bed</Text><Text style={styles.cardMeta}>Notifications use the current growth stage for their advice.</Text></View>
        <Switch value={schedule.enabled} onValueChange={(enabled) => onChange({ ...schedule, enabled })} trackColor={{ false: '#D5D5D5', true: '#00DFA2' }} thumbColor="#FFFFFF" />
      </View>
      <Text style={styles.inputLabel}>DAYS</Text>
      <View style={styles.weekdayRow}>
        {DAY_NAMES.map((name, day) => <Pressable key={name} onPress={() => toggleDay(day)} style={[styles.weekday, schedule.weekdays.includes(day) && styles.weekdayActive]}><Text style={[styles.weekdayText, schedule.weekdays.includes(day) && styles.weekdayTextActive]}>{name.slice(0, 1)}</Text></Pressable>)}
      </View>
      <View style={styles.reminderPresets}>
        <Pressable onPress={() => onChange({ ...schedule, weekdays: [0, 1, 2, 3, 4, 5, 6] })}><Text style={styles.textAction}>Every day</Text></Pressable>
        <Pressable onPress={() => onChange({ ...schedule, weekdays: [1, 2, 3, 4, 5] })}><Text style={styles.textAction}>Weekdays</Text></Pressable>
        <Pressable onPress={() => onChange({ ...schedule, weekdays: [0, 6] })}><Text style={styles.textAction}>Weekends</Text></Pressable>
      </View>
      <Text style={styles.inputLabel}>TIMES</Text>
      <View style={styles.timeList}>
        {schedule.times.map((time) => <View key={time} style={styles.timeChip}><MaterialCommunityIcons name="clock-outline" size={18} color={palette.leafDark} /><Text style={styles.timeText}>{formatReminderTime(time)}</Text><Pressable accessibilityLabel={`Remove ${formatReminderTime(time)}`} onPress={() => onChange({ ...schedule, times: schedule.times.filter((item) => item !== time) })}><MaterialCommunityIcons name="close-circle" size={20} color={palette.muted} /></Pressable></View>)}
      </View>
      <View style={styles.timePickerCard}>
        <View style={styles.timeNumbers}>
          <TimeNumberControl label="Hour" value={String(newHour)} onUp={() => setNewHour(newHour === 12 ? 1 : newHour + 1)} onDown={() => setNewHour(newHour === 1 ? 12 : newHour - 1)} />
          <Text style={styles.timeColon}>:</Text>
          <TimeNumberControl label="Minute" value={String(newMinute).padStart(2, '0')} onUp={() => setNewMinute((newMinute + 5) % 60)} onDown={() => setNewMinute((newMinute + 55) % 60)} />
          <View style={styles.periodPicker}>
            {(['AM', 'PM'] as const).map((period) => <Pressable key={period} onPress={() => setNewPeriod(period)} style={[styles.periodOption, newPeriod === period && styles.periodOptionActive]}><Text style={[styles.periodText, newPeriod === period && styles.periodTextActive]}>{period}</Text></Pressable>)}
          </View>
        </View>
        <Pressable disabled={schedule.times.includes(newTime)} onPress={addTime} style={[styles.addTimeButton, schedule.times.includes(newTime) && { opacity: 0.4 }]}><MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" /><Text style={styles.addTimeText}>{schedule.times.includes(newTime) ? 'Already added' : `Add ${formatReminderTime(newTime)}`}</Text></Pressable>
      </View>
      {!canSave ? <Text style={styles.scheduleError}>Choose at least one day and one time, or turn reminders off.</Text> : null}
      <PrimaryButton label="Save reminder schedule" icon="bell-check-outline" disabled={!canSave} onPress={onSave} />
    </Sheet>
  );
}

function TimeNumberControl({ label, value, onUp, onDown }: { label: string; value: string; onUp: () => void; onDown: () => void }) {
  return (
    <View style={styles.timeNumberControl}>
      <Text style={styles.timeNumberLabel}>{label}</Text>
      <Pressable accessibilityLabel={`Increase ${label.toLowerCase()}`} onPress={onUp} style={styles.timeStepButton}><MaterialCommunityIcons name="chevron-up" size={24} color={palette.ink} /></Pressable>
      <Text style={styles.timeNumberValue}>{value}</Text>
      <Pressable accessibilityLabel={`Decrease ${label.toLowerCase()}`} onPress={onDown} style={styles.timeStepButton}><MaterialCommunityIcons name="chevron-down" size={24} color={palette.ink} /></Pressable>
    </View>
  );
}

function PhotoNoteModal({ visible, title, photo, note, replaceBedPhoto, onReplaceBedPhoto, onPhoto, onNote, onClose, onSave }: {
  visible: boolean;
  title: string;
  photo?: string;
  note: string;
  replaceBedPhoto: boolean;
  onReplaceBedPhoto: (replace: boolean) => void;
  onPhoto: (source: PhotoSource) => void;
  onNote: (note: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {photo ? <GardenImage uri={photo} style={styles.formPhoto} /> : <View style={styles.photoPlaceholder}><MaterialCommunityIcons name="camera-plus-outline" size={38} color={palette.muted} /><Text style={styles.cardMeta}>Capture the same angle to make growth easy to compare</Text></View>}
      <View style={styles.twoButtons}><View style={styles.flex}><PrimaryButton label="Take photo" icon="camera-outline" tone="cream" onPress={() => onPhoto('camera')} /></View><View style={styles.flex}><PrimaryButton label="Choose photo" icon="image-outline" tone="cream" onPress={() => onPhoto('library')} /></View></View>
      <Text style={styles.inputLabel}>WHAT CHANGED? (OPTIONAL)</Text>
      <TextInput value={note} onChangeText={onNote} placeholder="First shoots, thinned seedlings…" placeholderTextColor="#98A099" style={[styles.input, styles.notesInput]} multiline />
      <View style={styles.replacePhotoRow}>
        <View style={styles.flex}><Text style={styles.cardTitle}>Use as current bed photo</Text><Text style={styles.cardMeta}>Your existing labels and outlines will be reused over this photo.</Text></View>
        <Switch value={replaceBedPhoto} onValueChange={onReplaceBedPhoto} trackColor={{ false: '#D5D5D5', true: '#00DFA2' }} thumbColor="#FFFFFF" />
      </View>
      <PrimaryButton label="Save to timeline" icon="check" disabled={!photo} onPress={onSave} />
    </Sheet>
  );
}

function RestartModal({ visible, photo, onPhoto, onClose, onSave }: { visible: boolean; photo?: string; onPhoto: (source: PhotoSource) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Sheet visible={visible} title="Start a new cycle" onClose={onClose}>
      <Text style={styles.mutedParagraph}>Take a fresh photo after clearing and preparing the bed. The previous cycle will remain in its history.</Text>
      {photo ? <GardenImage uri={photo} style={styles.formPhoto} /> : <View style={styles.photoPlaceholder}><MaterialCommunityIcons name="sprout-outline" size={38} color={palette.muted} /><Text style={styles.cardMeta}>Fresh bed, fresh planting map</Text></View>}
      <View style={styles.twoButtons}><View style={styles.flex}><PrimaryButton label="Take photo" icon="camera-outline" tone="cream" onPress={() => onPhoto('camera')} /></View><View style={styles.flex}><PrimaryButton label="Choose photo" icon="image-outline" tone="cream" onPress={() => onPhoto('library')} /></View></View>
      <PrimaryButton label="Begin new cycle" icon="sprout" disabled={!photo} onPress={onSave} />
    </Sheet>
  );
}

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.sheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{title}</Text><IconButton icon="close" label="Close" onPress={onClose} /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>{children}</ScrollView></View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function BottomTabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: GardenIconName }[] = [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'beds', label: 'Beds', icon: 'beds' },
    { id: 'guide', label: 'Grow guide', icon: 'growGuide' },
  ];
  return <SafeAreaView edges={['bottom']} style={styles.tabBar}>{tabs.map((item) => <Pressable accessibilityRole="tab" key={item.id} onPress={() => onChange(item.id)} style={styles.tab}><GardenIcon name={item.icon} size={24} color={tab === item.id ? palette.leaf : '#8B948E'} /><Text style={[styles.tabLabel, tab === item.id && styles.tabLabelActive]}>{item.label}</Text></Pressable>)}</SafeAreaView>;
}

function EmptyCard({ title, body, action, onPress }: { title: string; body: string; action: string; onPress: () => void }) {
  return <View style={styles.emptyCard}><Image source={brandAssets.compactMark} resizeMode="contain" style={styles.emptyBrandMark} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text><PrimaryButton label={action} icon="plus" onPress={onPress} /></View>;
}

function Stat({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return <View style={styles.stat}><MaterialCommunityIcons name={icon} size={18} color={palette.muted} /><View><Text style={styles.timelineLabel}>{label}</Text><Text style={styles.timelineValue}>{value}</Text></View></View>;
}

export default function App() {
  return <GestureHandlerRootView style={styles.flex}><SafeAreaProvider><AppContent /></SafeAreaProvider></GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  app: { flex: 1, backgroundColor: palette.paper },
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.paper, gap: 10 },
  loadingBrandMark: { width: 68, height: 68 },
  brand: { fontSize: 24, fontWeight: '900', color: palette.ink },
  scrollContent: { paddingHorizontal: 18, paddingTop: 58, paddingBottom: 32, gap: 16 },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  eyebrow: { fontSize: 12, letterSpacing: 1.4, fontWeight: '800', color: palette.leaf },
  heroTitle: { color: palette.ink, fontSize: 29, fontWeight: '800', letterSpacing: -0.8, marginTop: 3 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '900', color: palette.leafDark },
  todayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  todayTitle: { color: '#000000', fontSize: 38, lineHeight: 42, fontWeight: '900', letterSpacing: -1.3, marginTop: 4 },
  todayDate: { color: palette.muted, fontSize: 12, marginTop: 3 },
  todayBrandMark: { width: 54, height: 54 },
  weatherCard: { padding: 15, borderRadius: 22, gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line },
  weatherLocation: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  weatherLocationText: { color: '#000000', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.1 },
  todayWeather: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 13 },
  todayWeatherEmoji: { fontSize: 35 },
  todayWeatherTemp: { color: '#000000', fontSize: 25, fontWeight: '900' },
  todayWeatherMeta: { color: palette.muted, fontSize: 12, marginTop: 1 },
  weatherDivider: { height: 1, backgroundColor: palette.line },
  todayWeatherAdvice: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  todayMetrics: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line },
  todayMetric: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  todayMetricRing: { width: 42, height: 42, borderRadius: 21, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  todayMetricValue: { color: '#000000', fontSize: 19, lineHeight: 21, fontWeight: '900' },
  todayMetricLabel: { color: palette.muted, fontSize: 10, marginTop: 2 },
  todayMetricDivider: { width: 1, height: 36, backgroundColor: palette.line },
  todaySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  todaySectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todaySectionAdd: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
  todaySectionTitle: { color: '#000000', fontSize: 21, fontWeight: '900', letterSpacing: -0.4 },
  todaySectionCount: { minWidth: 23, height: 23, borderRadius: 12, textAlign: 'center', textAlignVertical: 'center', paddingTop: Platform.OS === 'ios' ? 4 : 1, color: '#000000', backgroundColor: '#E9FFB7', fontSize: 11, fontWeight: '900', overflow: 'hidden' },
  todayBedCard: { minHeight: 220, flexDirection: 'row', overflow: 'hidden', borderRadius: 20, padding: 7, gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line },
  todayBedPhoto: { width: '41%', height: 218, overflow: 'hidden', borderRadius: 18, backgroundColor: '#000000' },
  todayBedPhotoStatus: { position: 'absolute', left: 9, top: 9, height: 27, paddingHorizontal: 9, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  todayBedStatusDot: { width: 8, height: 8, borderRadius: 4 },
  todayBedPhotoStatusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  todayBedInfo: { flex: 1, minWidth: 0, paddingVertical: 4, paddingRight: 3 },
  todayBedInfoMain: { flex: 1 },
  todayBedNameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3 },
  todayBedName: { flex: 1, color: '#000000', fontSize: 20, lineHeight: 23, fontWeight: '900', letterSpacing: -0.45 },
  todayBedPlants: { color: palette.muted, fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 3, marginBottom: 9 },
  todayBedGlanceRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 7 },
  todayBedGlanceText: { flex: 1, color: '#000000', fontSize: 10, fontWeight: '700' },
  todayBedProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  todayBedProgressText: { flex: 1, color: palette.muted, fontSize: 9, lineHeight: 13, fontWeight: '800' },
  todayBedAlarm: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 14 },
  todayBedAlarmUpcoming: { backgroundColor: '#CDEEFF' },
  todayBedAlarmComplete: { backgroundColor: '#BDF6D9' },
  todayBedAlarmOverdue: { backgroundColor: '#FF9BAD', borderWidth: 1, borderColor: '#FF5D73' },
  todayBedAlarmIcon: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)' },
  todayBedAlarmTitle: { color: '#000000', fontSize: 11, fontWeight: '900' },
  todayBedAlarmDetail: { color: 'rgba(0,0,0,0.64)', fontSize: 8.5, lineHeight: 12, fontWeight: '800', marginTop: 1 },
  reminderCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', padding: 15, borderRadius: 22, borderWidth: 1, borderColor: palette.line },
  reminderIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  cardMeta: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  cardPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line },
  cropIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cropEmoji: { fontSize: 25 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stagePill: { color: palette.leafDark, backgroundColor: '#EFF3EA', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  taskAdvice: { marginTop: 8, color: palette.ink, fontSize: 13, lineHeight: 18 },
  bedCard: { height: 205, overflow: 'hidden', borderRadius: 16, backgroundColor: '#CAD3C8' },
  bedCardImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  bedOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 36, 24, 0.28)' },
  bedStatus: { position: 'absolute', left: 14, top: 14, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.91)' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#50A16D' },
  bedStatusText: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  bedCardText: { position: 'absolute', left: 20, right: 20, bottom: 18 },
  bedCardTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  bedCardMeta: { color: '#E3EAE5', fontSize: 13, marginTop: 3 },
  guideIntro: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line },
  search: { height: 48, flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line },
  searchInput: { flex: 1, color: palette.ink, fontSize: 16 },
  guideCard: { padding: 15, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line, gap: 13 },
  guideHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  guideEmoji: { fontSize: 32 },
  guideName: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  nowPill: { color: palette.leafDark, fontSize: 9, fontWeight: '900', backgroundColor: '#EEF4E5', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, overflow: 'hidden' },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F7F7F4', padding: 10, borderRadius: 10 },
  guideTip: { color: palette.ink, lineHeight: 20, fontSize: 14 },
  disclaimer: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', padding: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 7 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 54 },
  tabLabel: { color: '#8B948E', fontSize: 11, fontWeight: '700' },
  tabLabelActive: { color: palette.leaf },
  bedDetailContent: { padding: 20, paddingBottom: 60, gap: 20 },
  mapPreview: { position: 'relative', overflow: 'hidden', borderRadius: 14, backgroundColor: '#000000' },
  inspectPill: { position: 'absolute', right: 12, bottom: 12, height: 34, paddingHorizontal: 12, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  inspectPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailTitleWrap: { alignItems: 'center' },
  detailTitle: { color: palette.ink, fontSize: 20, fontWeight: '900' },
  quickActions: { flexDirection: 'row', gap: 10 },
  quickAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 76, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line },
  actionRing: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#D8DDD7' },
  quickActionText: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  bedReminderCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line },
  sectionMeta: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  rowCard: { padding: 15, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line, gap: 13, overflow: 'hidden' },
  rowCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowColor: { position: 'absolute', left: -17, width: 5, height: 42, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  rowEmoji: { fontSize: 28 },
  rowPlantIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line },
  rowName: { color: palette.ink, fontWeight: '900', fontSize: 18 },
  timeline: { flexDirection: 'row', backgroundColor: '#F5F5F0', borderRadius: 16, padding: 12 },
  timelineItem: { flex: 1 },
  timelineDivider: { width: 1, backgroundColor: '#DADDD5', marginHorizontal: 12 },
  ringTimeline: { gap: 10 },
  ringMetric: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 2 },
  timelineLabel: { color: palette.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  timelineValue: { color: palette.ink, fontSize: 13, fontWeight: '800', marginTop: 4 },
  rowAdvice: { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  rowAdviceText: { flex: 1, color: palette.ink, fontSize: 13, lineHeight: 19 },
  packetThumb: { width: 72, height: 90, borderRadius: 10 },
  packetThumbs: { flexDirection: 'row', gap: 10 },
  packetCaption: { color: palette.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 4, textAlign: 'center' },
  rowNotes: { color: palette.muted, fontSize: 13, fontStyle: 'italic' },
  progressCard: { flexDirection: 'row', gap: 13, padding: 9, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line, alignItems: 'center' },
  progressImage: { width: 86, height: 72, borderRadius: 13 },
  progressText: { flex: 1, gap: 3 },
  progressTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mainPhotoPill: { color: '#000000', backgroundColor: '#E9FFB7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, fontSize: 9, fontWeight: '900', overflow: 'hidden' },
  tapPhotoHint: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  photoViewer: { flex: 1, backgroundColor: '#000000' },
  photoViewerTop: { position: 'absolute', top: 0, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoViewerClose: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.68)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  photoViewerTitlePill: { height: 36, borderRadius: 18, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.68)' },
  photoViewerTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  photoViewerBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 14, gap: 12, backgroundColor: 'rgba(0,0,0,0.82)' },
  photoViewerCopy: { gap: 3 },
  photoViewerDate: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  photoViewerNote: { color: 'rgba(255,255,255,0.78)', fontSize: 13 },
  photoViewerMapNote: { color: 'rgba(255,255,255,0.58)', fontSize: 10, fontWeight: '700', marginTop: 2 },
  restoreMainButton: { minHeight: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF' },
  restoreMainText: { color: '#000000', fontSize: 14, fontWeight: '900' },
  currentMainButton: { minHeight: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E9FFB7' },
  currentMainText: { color: '#000000', fontSize: 14, fontWeight: '900' },
  mutedParagraph: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  harvestedCard: { padding: 24, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line, alignItems: 'center', gap: 10 },
  harvestedEmoji: { fontSize: 38 },
  harvestedTitle: { color: palette.ink, fontSize: 21, fontWeight: '900' },
  harvestedBody: { color: palette.muted, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  historyBlock: { gap: 10 },
  historyLine: { color: palette.muted, padding: 12, borderRadius: 12, backgroundColor: '#ECEDE7' },
  emptyCard: { padding: 24, alignItems: 'center', gap: 9, borderRadius: 24, borderWidth: 1, borderColor: palette.line, borderStyle: 'dashed', backgroundColor: '#FCFCF9' },
  emptyBrandMark: { width: 48, height: 48 },
  emptyTitle: { color: palette.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: palette.muted, textAlign: 'center', lineHeight: 20, marginBottom: 5 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(16, 30, 22, 0.48)' },
  sheet: { maxHeight: '91%', backgroundColor: palette.paper, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 8 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: '#C9CDC5', marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  sheetTitle: { color: palette.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  sheetContent: { padding: 20, paddingTop: 10, gap: 14, paddingBottom: 38 },
  inputLabel: { color: palette.leaf, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  input: { height: 52, borderRadius: 17, paddingHorizontal: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line, color: palette.ink, fontSize: 16 },
  photoPlaceholder: { height: 180, borderRadius: 20, borderWidth: 1, borderColor: '#C9CEC6', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 20 },
  formPhoto: { height: 190, width: '100%', borderRadius: 20 },
  twoButtons: { flexDirection: 'row', gap: 10 },
  inputError: { borderColor: '#D6786E' },
  estimateCard: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 14, borderRadius: 16, backgroundColor: palette.lime },
  plantGuideCard: { gap: 12, padding: 15, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line },
  plantGuideHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plantGuideTitle: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  plantGuideSource: { color: palette.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  plantGuideMetrics: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  plantGuideMetric: { width: '50%' },
  plantGuideAdvice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 13, backgroundColor: '#E9FFB7' },
  plantGuideAdviceText: { flex: 1, color: palette.ink, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  plantGuideTip: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  notesInput: { minHeight: 88, height: 88, paddingTop: 14, textAlignVertical: 'top' },
  suggestions: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: '#FFFFFF' },
  suggestion: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  suggestionEmoji: { fontSize: 19 },
  suggestionText: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  suggestionMeta: { color: palette.muted, fontSize: 10, marginTop: 2 },
  guideMatchText: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: -5 },
  packetFields: { flexDirection: 'row', gap: 12 },
  packetField: { flex: 1, borderRadius: 17, padding: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line, gap: 8 },
  packetFieldImage: { width: '100%', height: 125, borderRadius: 11 },
  packetFieldPlaceholder: { width: '100%', height: 125, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF1EB', borderWidth: 1, borderStyle: 'dashed', borderColor: '#C8CEC5' },
  packetFieldTitle: { color: palette.ink, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  packetFieldActions: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  packetMiniButton: { width: 38, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF1EB' },
  replacePhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 17, backgroundColor: '#E9EEE4' },
  reminderToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  weekday: { flex: 1, aspectRatio: 1, maxWidth: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line },
  weekdayActive: { backgroundColor: palette.leaf, borderColor: palette.leaf },
  weekdayText: { color: palette.muted, fontSize: 13, fontWeight: '900' },
  weekdayTextActive: { color: '#FFFFFF' },
  reminderPresets: { flexDirection: 'row', gap: 18 },
  textAction: { color: palette.leaf, fontSize: 13, fontWeight: '800' },
  timeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, height: 40, borderRadius: 13, backgroundColor: palette.lime },
  timeText: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  timePickerCard: { gap: 12, padding: 14, borderRadius: 20, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: palette.line },
  timeNumbers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timeNumberControl: { width: 76, alignItems: 'center' },
  timeNumberLabel: { color: palette.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  timeStepButton: { width: 48, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  timeNumberValue: { color: palette.ink, fontSize: 32, lineHeight: 38, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timeColon: { color: palette.ink, fontSize: 30, fontWeight: '900', marginTop: 9 },
  periodPicker: { marginLeft: 3, padding: 3, gap: 3, borderRadius: 13, backgroundColor: '#E7E7E7' },
  periodOption: { width: 50, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  periodOptionActive: { backgroundColor: '#000000' },
  periodText: { color: palette.muted, fontSize: 13, fontWeight: '900' },
  periodTextActive: { color: '#FFFFFF' },
  addTimeButton: { minHeight: 50, borderRadius: 16, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.leaf },
  addTimeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  scheduleError: { color: palette.danger, fontSize: 12, fontWeight: '700' },
});
