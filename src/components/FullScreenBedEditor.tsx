import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image as NativeImage,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ROW_COLORS, cropSuggestions, matchCropGuide } from '../data/crops';
import { createEntityId } from '../domain/garden';
import { isoDate } from '../lib/dates';
import { resolveMediaUri } from '../services/media';
import { PlantedRow, Point } from '../types';
import { imageMetrics, imagePointToCanvas, MapSize } from './BedMapOverlay';
import { GardenImage } from './GardenImage';
import { InteractiveMapOverlay } from './map/InteractiveMapOverlay';
import { useMapViewport } from './map/useMapViewport';
import { palette } from './Ui';

type Mode = 'move' | 'draw' | 'erase';
type Size = MapSize;

type Props = {
  visible: boolean;
  photoUri: string;
  rows: PlantedRow[];
  onRowsChange: (rows: PlantedRow[]) => void;
  onEditRow: (rowId: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

const cloneRows = (rows: PlantedRow[]) => JSON.parse(JSON.stringify(rows)) as PlantedRow[];

function pointToSegmentDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function strokeHit(stroke: Point[], point: Point, threshold: number) {
  if (stroke.length === 1) return Math.hypot(point.x - stroke[0].x, point.y - stroke[0].y) <= threshold;
  return stroke.some((entry, index) => index > 0 && pointToSegmentDistance(point, stroke[index - 1], entry) <= threshold);
}

export function FullScreenBedEditor({ visible, photoUri, rows, onRowsChange, onEditRow, onCancel, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('move');
  const [selectedId, setSelectedId] = useState(rows[0]?.id);
  const [selectedColor, setSelectedColor] = useState(ROW_COLORS[0]);
  const [typingLabel, setTypingLabel] = useState(false);
  const [labelText, setLabelText] = useState('');
  const [size, setSize] = useState<Size>({ width: 1, height: 1 });
  const [imageSize, setImageSize] = useState<Size>({ width: 1, height: 1 });
  const [imageLoadError, setImageLoadError] = useState(false);
  const [, setHistoryRevision] = useState(0);
  const { viewport, pinchGesture, panGesture, imageStyle, zoomPercent, reset: resetViewport, zoomBy } = useMapViewport(size, 8);
  const rowsRef = useRef(rows);
  const selectedIdRef = useRef(selectedId);
  const sizeRef = useRef(size);
  const imageSizeRef = useRef(imageSize);
  const activeStrokeRef = useRef<{ rowId: string } | null>(null);
  const activeStrokePointsRef = useRef<Point[]>([]);
  const activeStrokeDRef = useRef('');
  const draftPathRef = useRef<ComponentRef<typeof Path>>(null);
  const eraseChangedRef = useRef(false);
  const eraseRedoRef = useRef<PlantedRow[][]>([]);
  const undoRef = useRef<PlantedRow[][]>([]);
  const redoRef = useRef<PlantedRow[][]>([]);

  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { imageSizeRef.current = imageSize; }, [imageSize]);

  useEffect(() => {
    if (!visible) return;
    setSelectedId((current) => {
      const next = current && rows.some((row) => row.id === current) ? current : rows[0]?.id;
      selectedIdRef.current = next;
      return next;
    });
    setMode('move');
    resetViewport();
    undoRef.current = [];
    redoRef.current = [];
    setHistoryRevision((value) => value + 1);
  }, [visible]);

  useEffect(() => {
    const resolvedUri = resolveMediaUri(photoUri);
    setImageLoadError(false);
    NativeImage.getSize(resolvedUri, (width, height) => setImageSize({ width, height }), () => setImageLoadError(true));
  }, [photoUri]);

  useEffect(() => {
    const selectedRow = rows.find((row) => row.id === selectedId);
    if (selectedRow) setSelectedColor(selectedRow.color);
  }, [selectedId, rows]);

  const emitRows = (next: PlantedRow[]) => {
    rowsRef.current = next;
    onRowsChange(next);
  };

  const pushHistory = () => {
    undoRef.current = [...undoRef.current.slice(-29), cloneRows(rowsRef.current)];
    redoRef.current = [];
    setHistoryRevision((value) => value + 1);
  };

  const undo = () => {
    const previous = undoRef.current.pop();
    if (!previous) return;
    redoRef.current.push(cloneRows(rowsRef.current));
    emitRows(previous);
    setHistoryRevision((value) => value + 1);
    Haptics.selectionAsync();
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(cloneRows(rowsRef.current));
    emitRows(next);
    setHistoryRevision((value) => value + 1);
    Haptics.selectionAsync();
  };

  const toPoint = (localX: number, localY: number): Point => {
    const currentSize = sizeRef.current;
    const contentX = (localX - currentSize.width / 2 - viewport.translateX.value) / viewport.scale.value + currentSize.width / 2;
    const contentY = (localY - currentSize.height / 2 - viewport.translateY.value) / viewport.scale.value + currentSize.height / 2;
    const metrics = imageMetrics(currentSize, imageSizeRef.current, 'contain');
    return {
      x: Math.max(0, Math.min(1, (contentX - metrics.offsetX) / metrics.width)),
      y: Math.max(0, Math.min(1, (contentY - metrics.offsetY) / metrics.height)),
    };
  };

  const replaceRow = (rowId: string, update: (row: PlantedRow) => PlantedRow) => {
    emitRows(rowsRef.current.map((row) => row.id === rowId ? update(row) : row));
  };

  const beginStroke = (point: Point) => {
    const rowId = selectedIdRef.current;
    if (!rowId) return;
    pushHistory();
    activeStrokeRef.current = { rowId };
    activeStrokePointsRef.current = [point];
    const currentSize = sizeRef.current;
    const canvas = imagePointToCanvas(point, currentSize, imageSizeRef.current);
    const x = currentSize.width / 2 + viewport.translateX.value + (canvas.x - currentSize.width / 2) * viewport.scale.value;
    const y = currentSize.height / 2 + viewport.translateY.value + (canvas.y - currentSize.height / 2) * viewport.scale.value;
    activeStrokeDRef.current = `M ${x} ${y}`;
    draftPathRef.current?.setNativeProps({ d: activeStrokeDRef.current });
  };

  const appendStrokePoint = (point: Point) => {
    if (!activeStrokeRef.current) return;
    const points = activeStrokePointsRef.current;
    const previous = points[points.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0025 / viewport.scale.value) return;
    points.push(point);
    const currentSize = sizeRef.current;
    const canvas = imagePointToCanvas(point, currentSize, imageSizeRef.current);
    const x = currentSize.width / 2 + viewport.translateX.value + (canvas.x - currentSize.width / 2) * viewport.scale.value;
    const y = currentSize.height / 2 + viewport.translateY.value + (canvas.y - currentSize.height / 2) * viewport.scale.value;
    activeStrokeDRef.current += ` L ${x} ${y}`;
    draftPathRef.current?.setNativeProps({ d: activeStrokeDRef.current });
  };

  const finishStroke = (commit = true) => {
    const active = activeStrokeRef.current;
    const points = activeStrokePointsRef.current;
    if (commit && active && points.length > 1) {
      replaceRow(active.rowId, (row) => ({ ...row, paths: [...(row.paths ?? []), points] }));
    } else {
      undoRef.current.pop();
      setHistoryRevision((value) => value + 1);
    }
    activeStrokeRef.current = null;
    activeStrokePointsRef.current = [];
    activeStrokeDRef.current = '';
    draftPathRef.current?.setNativeProps({ d: '' });
  };

  const eraseAt = (point: Point) => {
    const threshold = 0.025 / viewport.scale.value;
    let changed = false;
    const next = rowsRef.current.map((row) => {
      const removeLegacy = row.path.length > 0 && strokeHit(row.path, point, threshold);
      const paths = (row.paths ?? []).filter((stroke) => !strokeHit(stroke, point, threshold));
      if (!removeLegacy && paths.length === (row.paths ?? []).length) return row;
      changed = true;
      return { ...row, path: removeLegacy ? [] : row.path, paths };
    });
    if (changed) {
      eraseChangedRef.current = true;
      rowsRef.current = next;
    }
  };

  const selectLabel = (rowId: string) => {
    selectedIdRef.current = rowId;
    setSelectedId(rowId);
    Haptics.selectionAsync();
  };

  const moveLabel = (rowId: string, point: Point) => {
    const row = rowsRef.current.find((entry) => entry.id === rowId);
    const current = row?.labelPosition ?? row?.path[0] ?? row?.paths?.[0]?.[0] ?? { x: 0.5, y: 0.5 };
    if (Math.hypot(point.x - current.x, point.y - current.y) < 0.0005) return;
    pushHistory();
    replaceRow(rowId, (entry) => ({ ...entry, labelPosition: point }));
  };

  const drawGesture = useMemo(() => Gesture.Pan()
    .enabled(mode === 'draw' && Boolean(selectedId))
    .maxPointers(1)
    .minDistance(2)
    .runOnJS(true)
    .onBegin((event) => beginStroke(toPoint(event.x, event.y)))
    .onUpdate((event) => appendStrokePoint(toPoint(event.x, event.y)))
    .onFinalize((_event, success) => finishStroke(success)), [mode, selectedId]);

  const eraseGesture = useMemo(() => Gesture.Pan()
    .enabled(mode === 'erase')
    .maxPointers(1)
    .minDistance(1)
    .runOnJS(true)
    .onBegin((event) => {
      eraseChangedRef.current = false;
      eraseRedoRef.current = redoRef.current;
      pushHistory();
      eraseAt(toPoint(event.x, event.y));
    })
    .onUpdate((event) => eraseAt(toPoint(event.x, event.y)))
    .onFinalize((_event, success) => {
      if (!success) {
        const previous = undoRef.current.pop();
        if (previous) emitRows(previous);
        redoRef.current = eraseRedoRef.current;
      } else if (!eraseChangedRef.current) {
        undoRef.current.pop();
        redoRef.current = eraseRedoRef.current;
      } else {
        emitRows(rowsRef.current);
        Haptics.selectionAsync();
      }
      setHistoryRevision((value) => value + 1);
    }), [mode]);

  const canvasGesture = useMemo(() => Gesture.Simultaneous(
    pinchGesture,
    panGesture.enabled(mode === 'move'),
    drawGesture,
    eraseGesture,
  ), [pinchGesture, panGesture, drawGesture, eraseGesture, mode]);

  const addLabel = () => {
    const name = labelText.trim();
    if (!name) return;
    const guide = matchCropGuide(name);
    const row: PlantedRow = {
      id: createEntityId('row'),
      cropId: guide?.id ?? 'custom',
      cropName: name,
      plantedAt: new Date(`${isoDate()}T12:00:00`).toISOString(),
      germinationDays: guide?.germinationDays ?? [5, 14],
      harvestDays: guide?.harvestDays ?? [45, 90],
      color: selectedColor,
      labelPosition: { x: 0.5, y: 0.5 },
      path: [],
      paths: [],
    };
    pushHistory();
    emitRows([...rowsRef.current, row]);
    selectedIdRef.current = row.id;
    setSelectedId(row.id);
    setTypingLabel(false);
    setLabelText('');
    setMode('move');
    Haptics.selectionAsync();
  };

  const changeMode = (next: Mode) => {
    if (next === 'draw' && !selectedId) {
      Alert.alert('Add a plant first', 'Tap + to name a plant, then draw its outline.');
      return;
    }
    setMode(next);
    Haptics.selectionAsync();
  };

  const openSelectedDetails = () => {
    if (!selectedId) {
      Alert.alert('Select a plant', 'Choose a label below or tap + to add one.');
      return;
    }
    onEditRow(selectedId);
  };

  const toggleZoom = () => {
    if (viewport.scale.value > 1.05) resetViewport();
    else zoomBy(2);
    setMode('move');
    Haptics.selectionAsync();
  };

  const selected = rows.find((row) => row.id === selectedId);
  const labelSuggestions = cropSuggestions(labelText, 5);

  return (
    <Modal visible={visible} animationType="none" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={editorStyles.root}>
        <View
          style={editorStyles.canvas}
          onLayout={(event) => {
            const next = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
            sizeRef.current = next;
            setSize(next);
          }}
        >
          <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
            <GardenImage
              uri={photoUri}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              highQuality
              onLoad={(event) => {
                const source = event.source;
                if (source.width > 0 && source.height > 0) setImageSize({ width: source.width, height: source.height });
                setImageLoadError(false);
              }}
              onError={() => setImageLoadError(true)}
            />
          </Animated.View>
          <GestureDetector gesture={canvasGesture}><Animated.View style={StyleSheet.absoluteFill} /></GestureDetector>
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path ref={draftPathRef} d="" fill="none" stroke={selected?.color ?? selectedColor} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <InteractiveMapOverlay
            rows={rows}
            size={size}
            imageSize={imageSize}
            viewport={viewport}
            selectedId={selectedId}
            labelsEditable
            onSelectLabel={selectLabel}
            onMoveLabel={moveLabel}
          />
        </View>

        <View style={[editorStyles.topLeft, { top: insets.top + 8 }]} pointerEvents="box-none">
          <EditorIcon icon="close" label="Discard changes" onPress={onCancel} />
          <EditorIcon icon="undo" label="Undo" onPress={undo} disabled={!undoRef.current.length} />
          <EditorIcon icon="redo" label="Redo" onPress={redo} disabled={!redoRef.current.length} />
        </View>

        <View style={[editorStyles.topRight, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable accessibilityLabel="Toggle zoom" onPress={toggleZoom} style={editorStyles.zoomPill}>
            <MaterialCommunityIcons name="magnify" size={17} color="#FFFFFF" />
            <Text style={editorStyles.zoomText}>{zoomPercent}%</Text>
          </Pressable>
          <EditorIcon icon="check" label="Save map" onPress={onSave} solid />
        </View>

        <View style={[editorStyles.toolRail, { top: insets.top + 64 }]}>
          <ToolButton icon="information-outline" label="Details" active={false} onPress={openSelectedDetails} />
          <ToolButton icon="draw" label="Draw" active={mode === 'draw'} onPress={() => changeMode('draw')} />
          <ToolButton icon="eraser" label="Erase" active={mode === 'erase'} onPress={() => changeMode('erase')} />
          <ToolButton icon="gesture-swipe" label="Move" active={mode === 'move'} onPress={() => changeMode('move')} />
          <View style={editorStyles.colorRail}>
            {ROW_COLORS.map((color) => (
              <Pressable
                accessibilityLabel={`Use ${color}`}
                key={color}
                onPress={() => {
                  setSelectedColor(color);
                  if (selectedId) {
                    pushHistory();
                    replaceRow(selectedId, (row) => ({ ...row, color }));
                  }
                }}
                style={[editorStyles.colorDot, { backgroundColor: color }, selectedColor === color && editorStyles.colorDotSelected]}
              />
            ))}
          </View>
        </View>

        {imageLoadError ? (
          <View style={editorStyles.emptyHint} pointerEvents="none">
            <Text style={editorStyles.emptyHintTitle}>Photo could not be opened</Text>
            <Text style={editorStyles.emptyHintBody}>Close the editor and try again. Your saved photo and map have not been changed.</Text>
          </View>
        ) : !rows.length ? (
          <View style={editorStyles.emptyHint} pointerEvents="none">
            <Text style={editorStyles.emptyHintTitle}>Pinch to zoom · Move to pan</Text>
            <Text style={editorStyles.emptyHintBody}>Tap + below to name your first planting.</Text>
          </View>
        ) : null}

        <View style={[editorStyles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
          <View style={editorStyles.selectionHeader}>
            <View style={editorStyles.selectionCopy}>
              <Text numberOfLines={1} style={editorStyles.selectionTitle}>{selected ? selected.cropName : 'No plant selected'}</Text>
              {selected ? <Text style={editorStyles.selectionHint}>Drag its label to reposition it</Text> : null}
            </View>
            {selected ? (
              <Pressable accessibilityLabel={`Edit details for ${selected.cropName}`} onPress={openSelectedDetails} style={editorStyles.detailsButton}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color="#000000" />
                <Text style={editorStyles.detailsButtonText}>Edit details</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={editorStyles.labelStrip}>
            {rows.map((row) => (
              <Pressable key={row.id} onPress={() => setSelectedId(row.id)} style={[editorStyles.labelChip, row.id === selectedId && { backgroundColor: row.color, borderColor: '#FFFFFF' }]}>
                <Text style={editorStyles.labelChipText}>{row.cropName}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityLabel="Add plant label" onPress={() => setTypingLabel(true)} style={editorStyles.addChip}>
              <MaterialCommunityIcons name="plus" size={23} color="#000000" />
            </Pressable>
          </ScrollView>
        </View>

        {typingLabel ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={editorStyles.labelEntryWrap}>
            <Pressable style={editorStyles.labelEntryScrim} onPress={() => setTypingLabel(false)} />
            <View style={editorStyles.labelEntry}>
              <Text style={editorStyles.labelEntryTitle}>Add a plant label</Text>
              <TextInput
                autoFocus
                value={labelText}
                onChangeText={setLabelText}
                onSubmitEditing={addLabel}
                returnKeyType="done"
                placeholder="Type the plant or variety"
                placeholderTextColor="#8E8E93"
                style={editorStyles.labelInput}
              />
              {labelSuggestions.length ? (
                <View style={editorStyles.labelSuggestions}>
                  {labelSuggestions.map((crop) => (
                    <Pressable key={crop.id} onPress={() => setLabelText(crop.name)} style={editorStyles.labelSuggestion}>
                      <Text style={editorStyles.labelSuggestionEmoji}>{crop.emoji}</Text>
                      <View style={editorStyles.labelSuggestionCopy}>
                        <Text style={editorStyles.labelSuggestionName}>{crop.name}</Text>
                        <Text style={editorStyles.labelSuggestionMeta}>{crop.category ?? 'Garden plant'} · {crop.germinationDays[0]}–{crop.germinationDays[1]} days to germinate</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={palette.muted} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Text style={editorStyles.labelHint}>Add the label, position it on the photo, then use Draw to mark one or more sections.</Text>
              <Pressable disabled={!labelText.trim()} onPress={addLabel} style={[editorStyles.addLabelButton, !labelText.trim() && { opacity: 0.4 }]}>
                <Text style={editorStyles.addLabelButtonText}>Add label</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </View>
    </Modal>
  );
}

function EditorIcon({ icon, label, onPress, solid, disabled }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; solid?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[editorStyles.editorIcon, solid && editorStyles.editorIconSolid, disabled && editorStyles.disabled]}>
      <MaterialCommunityIcons name={icon} size={23} color="#FFFFFF" />
    </Pressable>
  );
}

function ToolButton({ icon, label, active, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={[editorStyles.toolButton, active && editorStyles.toolButtonActive]}>
      <MaterialCommunityIcons name={icon} size={24} color={active ? '#000000' : '#FFFFFF'} />
      <Text style={[editorStyles.toolText, active && editorStyles.toolTextActive]}>{label}</Text>
    </Pressable>
  );
}

const editorStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  canvas: { flex: 1, overflow: 'hidden', backgroundColor: '#000000' },
  content: { position: 'absolute', left: 0, top: 0 },
  topLeft: { position: 'absolute', left: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  topRight: { position: 'absolute', right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  editorIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  editorIconSolid: { backgroundColor: '#000000', borderColor: '#FFFFFF' },
  disabled: { opacity: 0.35 },
  zoomPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 11, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  zoomText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  toolRail: { position: 'absolute', right: 12, alignItems: 'center', gap: 5 },
  toolButton: { width: 54, minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', gap: 1, backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  toolButtonActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  toolText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  toolTextActive: { color: '#000000' },
  colorRail: { marginTop: 4, gap: 7, padding: 7, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.66)' },
  colorDot: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  colorDotSelected: { borderWidth: 4, borderColor: '#FFFFFF', transform: [{ scale: 1.16 }] },
  emptyHint: { position: 'absolute', left: 30, right: 80, top: '43%', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.68)' },
  emptyHintTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  emptyHintBody: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 4 },
  bottomPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.82)', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)' },
  selectionHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  selectionCopy: { flex: 1 },
  selectionTitle: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  selectionHint: { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '700' },
  detailsButton: { height: 34, borderRadius: 17, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF' },
  detailsButtonText: { color: '#000000', fontSize: 11, fontWeight: '900' },
  labelStrip: { gap: 8, alignItems: 'center', paddingBottom: 2 },
  labelChip: { height: 36, borderRadius: 11, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#161616', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
  labelChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  addChip: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  labelEntryWrap: { ...StyleSheet.absoluteFill, justifyContent: 'center', paddingHorizontal: 24 },
  labelEntryScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.72)' },
  labelEntry: { borderRadius: 24, padding: 20, backgroundColor: '#FFFFFF', gap: 12 },
  labelEntryTitle: { color: palette.ink, fontSize: 21, fontWeight: '900' },
  labelInput: { height: 54, borderRadius: 16, borderWidth: 1, borderColor: '#D7D7D7', paddingHorizontal: 15, color: palette.ink, fontSize: 17 },
  labelSuggestions: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#E2E2E2', backgroundColor: '#FFFFFF' },
  labelSuggestion: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E2E2' },
  labelSuggestionEmoji: { fontSize: 20 },
  labelSuggestionCopy: { flex: 1, paddingVertical: 7 },
  labelSuggestionName: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  labelSuggestionMeta: { color: palette.muted, fontSize: 10, marginTop: 2 },
  labelHint: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  addLabelButton: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
  addLabelButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
