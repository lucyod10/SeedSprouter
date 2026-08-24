import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ROW_COLORS, cropSuggestions, matchCropGuide } from '../data/crops';
import { createEntityId } from '../domain/garden';
import { isoDate } from '../lib/dates';
import { PlantedRow, Point } from '../types';
import { palette } from './Ui';

type Mode = 'move' | 'draw' | 'erase';
type Size = { width: number; height: number };
type Transform = { scale: number; x: number; y: number };

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

function containMetrics(container: Size, image: Size) {
  const safeWidth = Math.max(1, image.width);
  const safeHeight = Math.max(1, image.height);
  const scale = Math.min(container.width / safeWidth, container.height / safeHeight);
  const width = safeWidth * scale;
  const height = safeHeight * scale;
  return { width, height, offsetX: (container.width - width) / 2, offsetY: (container.height - height) / 2 };
}

function imagePointToCanvas(point: Point, container: Size, image: Size) {
  const metrics = containMetrics(container, image);
  return { x: metrics.offsetX + point.x * metrics.width, y: metrics.offsetY + point.y * metrics.height };
}

function pathData(points: Point[], container: Size, image: Size) {
  return points.map((point, index) => {
    const mapped = imagePointToCanvas(point, container, image);
    return `${index ? 'L' : 'M'} ${mapped.x} ${mapped.y}`;
  }).join(' ');
}

function allStrokes(row: PlantedRow) {
  return [row.path, ...(row.paths ?? [])].filter((stroke) => stroke.length > 0);
}

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
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const [, setHistoryRevision] = useState(0);
  const rowsRef = useRef(rows);
  const selectedIdRef = useRef(selectedId);
  const transformRef = useRef(transform);
  const sizeRef = useRef(size);
  const imageSizeRef = useRef(imageSize);
  const interactionRef = useRef<{ kind: 'label' | 'canvas'; rowId?: string; startX: number; startY: number; moved: boolean }>({ kind: 'canvas', startX: 0, startY: 0, moved: false });
  const panStartRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const pinchStartRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const activeStrokeRef = useRef<{ rowId: string; index: number } | null>(null);
  const eraseChangedRef = useRef(false);
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
    setViewTransform({ scale: 1, x: 0, y: 0 });
    undoRef.current = [];
    redoRef.current = [];
    setHistoryRevision((value) => value + 1);
  }, [visible]);

  useEffect(() => {
    Image.getSize(photoUri, (width, height) => setImageSize({ width, height }), () => setImageSize({ width: 1, height: 1 }));
  }, [photoUri]);

  useEffect(() => {
    const selectedRow = rows.find((row) => row.id === selectedId);
    if (selectedRow) setSelectedColor(selectedRow.color);
  }, [selectedId, rows]);

  const setViewTransform = (next: Transform) => {
    transformRef.current = next;
    setTransform(next);
  };

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
    const current = transformRef.current;
    const currentSize = sizeRef.current;
    const contentX = (localX - currentSize.width / 2 - current.x) / current.scale + currentSize.width / 2;
    const contentY = (localY - currentSize.height / 2 - current.y) / current.scale + currentSize.height / 2;
    const metrics = containMetrics(currentSize, imageSizeRef.current);
    return {
      x: Math.max(0, Math.min(1, (contentX - metrics.offsetX) / metrics.width)),
      y: Math.max(0, Math.min(1, (contentY - metrics.offsetY) / metrics.height)),
    };
  };

  const clampTransform = (next: Transform): Transform => {
    const currentSize = sizeRef.current;
    const scale = Math.max(1, Math.min(6, next.scale));
    const maxX = currentSize.width * (scale - 1) / 2;
    const maxY = currentSize.height * (scale - 1) / 2;
    return {
      scale,
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  };

  const labelAt = (localX: number, localY: number) => {
    const currentSize = sizeRef.current;
    const current = transformRef.current;
    return [...rowsRef.current].reverse().find((row) => {
      const anchor = row.labelPosition ?? row.path[0] ?? row.paths?.[0]?.[0];
      if (!anchor) return false;
      const mapped = imagePointToCanvas(anchor, currentSize, imageSizeRef.current);
      const screenX = currentSize.width / 2 + current.x + (mapped.x - currentSize.width / 2) * current.scale;
      const screenY = currentSize.height / 2 + current.y + (mapped.y - currentSize.height / 2) * current.scale;
      return Math.abs(localX - screenX) <= 76 && Math.abs(localY - screenY) <= 28;
    });
  };

  const replaceRow = (rowId: string, update: (row: PlantedRow) => PlantedRow) => {
    emitRows(rowsRef.current.map((row) => row.id === rowId ? update(row) : row));
  };

  const beginStroke = (point: Point) => {
    const rowId = selectedIdRef.current;
    if (!rowId) return;
    pushHistory();
    const row = rowsRef.current.find((entry) => entry.id === rowId);
    const index = row?.paths?.length ?? 0;
    activeStrokeRef.current = { rowId, index };
    replaceRow(rowId, (entry) => ({ ...entry, paths: [...(entry.paths ?? []), [point]] }));
  };

  const appendStrokePoint = (point: Point) => {
    const active = activeStrokeRef.current;
    if (!active) return;
    replaceRow(active.rowId, (row) => {
      const paths = [...(row.paths ?? [])];
      const stroke = paths[active.index] ?? [];
      const previous = stroke[stroke.length - 1];
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0025 / transformRef.current.scale) return row;
      paths[active.index] = [...stroke, point];
      return { ...row, paths };
    });
  };

  const eraseAt = (point: Point) => {
    const threshold = 0.025 / transformRef.current.scale;
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
      emitRows(next);
      Haptics.selectionAsync();
    }
  };

  const canvasGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .minDistance(3)
      .maxPointers(1)
      .onStart((event) => {
        const label = labelAt(event.x, event.y);
        interactionRef.current = { kind: label ? 'label' : 'canvas', rowId: label?.id, startX: event.x, startY: event.y, moved: false };
        panStartRef.current = { ...transformRef.current };
        activeStrokeRef.current = null;
        eraseChangedRef.current = false;

        if (label) {
          selectedIdRef.current = label.id;
          setSelectedId(label.id);
          pushHistory();
        } else if (mode === 'draw' && selectedIdRef.current) {
          beginStroke(toPoint(event.x, event.y));
        } else if (mode === 'erase') {
          pushHistory();
          eraseAt(toPoint(event.x, event.y));
        }
      })
      .onUpdate((event) => {
        const interaction = interactionRef.current;
        interaction.moved = true;
        if (interaction.kind === 'label' && interaction.rowId) {
          replaceRow(interaction.rowId, (row) => ({ ...row, labelPosition: toPoint(event.x, event.y) }));
        } else if (mode === 'draw' && selectedIdRef.current) {
          appendStrokePoint(toPoint(event.x, event.y));
        } else if (mode === 'erase') {
          eraseAt(toPoint(event.x, event.y));
        } else if (mode === 'move') {
          const initial = panStartRef.current;
          setViewTransform(clampTransform({ scale: initial.scale, x: initial.x + event.translationX, y: initial.y + event.translationY }));
        }
      })
      .onFinalize(() => {
        activeStrokeRef.current = null;
        if (mode === 'erase' && !eraseChangedRef.current) {
          undoRef.current.pop();
          setHistoryRevision((value) => value + 1);
        }
      });

    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDistance(8)
      .onEnd((event, success) => {
        if (!success) return;
        const label = labelAt(event.x, event.y);
        if (label) {
          selectedIdRef.current = label.id;
          setSelectedId(label.id);
          Haptics.selectionAsync();
        }
      });

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => { pinchStartRef.current = { ...transformRef.current }; })
      .onUpdate((event) => {
        const initial = pinchStartRef.current;
        const nextScale = Math.max(1, Math.min(6, initial.scale * event.scale));
        const ratio = nextScale / initial.scale;
        setViewTransform(clampTransform({ scale: nextScale, x: initial.x * ratio, y: initial.y * ratio }));
      })
      .onEnd(() => {
        if (transformRef.current.scale < 1.03) setViewTransform({ scale: 1, x: 0, y: 0 });
      });

    return Gesture.Simultaneous(pinch, Gesture.Race(pan, tap));
  }, [mode]);

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

  const editSelectedText = () => {
    if (!selectedId) {
      Alert.alert('Select a plant', 'Choose a label below or tap + to add one.');
      return;
    }
    onEditRow(selectedId);
  };

  const toggleZoom = () => {
    const zoomed = transformRef.current.scale > 1.05;
    setViewTransform(zoomed ? { scale: 1, x: 0, y: 0 } : { scale: 2, x: 0, y: 0 });
    setMode('move');
    Haptics.selectionAsync();
  };

  const selected = rows.find((row) => row.id === selectedId);
  const metrics = containMetrics(size, imageSize);
  const labelSuggestions = cropSuggestions(labelText, 5);

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <GestureHandlerRootView style={editorStyles.root}>
        <GestureDetector gesture={canvasGesture}>
          <View
            style={editorStyles.canvas}
            onLayout={(event) => {
              const next = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
              sizeRef.current = next;
              setSize(next);
            }}
          >
          <View style={[editorStyles.content, { width: size.width, height: size.height, transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }]}>
            <Image
              source={{ uri: photoUri, cache: 'reload' }}
              style={{ position: 'absolute', left: metrics.offsetX, top: metrics.offsetY, width: metrics.width, height: metrics.height }}
              resizeMode="contain"
              fadeDuration={0}
            />
            <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
              {rows.flatMap((row) => allStrokes(row).map((stroke, index) => stroke.length > 1 ? (
                <Path
                  key={`${row.id}-${index}`}
                  d={pathData(stroke, size, imageSize)}
                  fill="none"
                  stroke={row.color}
                  strokeWidth={(row.id === selectedId ? 5 : 3) / transform.scale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={row.id === selectedId ? 1 : 0.72}
                />
              ) : null))}
            </Svg>
            {rows.map((row) => (
              <PhotoLabel
                key={row.id}
                row={row}
                selected={row.id === selectedId}
                scale={transform.scale}
                size={size}
                imageSize={imageSize}
              />
            ))}
          </View>
          </View>
        </GestureDetector>

        <View style={[editorStyles.topLeft, { top: insets.top + 8 }]} pointerEvents="box-none">
          <EditorIcon icon="close" label="Discard changes" onPress={onCancel} />
          <EditorIcon icon="undo" label="Undo" onPress={undo} disabled={!undoRef.current.length} />
          <EditorIcon icon="redo" label="Redo" onPress={redo} disabled={!redoRef.current.length} />
        </View>

        <View style={[editorStyles.topRight, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable accessibilityLabel="Toggle zoom" onPress={toggleZoom} style={editorStyles.zoomPill}>
            <MaterialCommunityIcons name="magnify" size={17} color="#FFFFFF" />
            <Text style={editorStyles.zoomText}>{Math.round(transform.scale * 100)}%</Text>
          </Pressable>
          <EditorIcon icon="check" label="Save map" onPress={onSave} solid />
        </View>

        <View style={[editorStyles.toolRail, { top: insets.top + 64 }]}>
          <ToolButton icon="format-text" label="Text" active={false} onPress={editSelectedText} />
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

        {!rows.length ? (
          <View style={editorStyles.emptyHint} pointerEvents="none">
            <Text style={editorStyles.emptyHintTitle}>Pinch to zoom · Move to pan</Text>
            <Text style={editorStyles.emptyHintBody}>Tap + below to name your first planting.</Text>
          </View>
        ) : null}

        <View style={[editorStyles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
          <View style={editorStyles.selectionHeader}>
            <Text numberOfLines={1} style={editorStyles.selectionTitle}>{selected ? selected.cropName : 'No plant selected'}</Text>
            {selected ? <Text style={editorStyles.selectionHint}>Drag label to move</Text> : null}
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
      </GestureHandlerRootView>
    </Modal>
  );
}

function PhotoLabel({ row, selected, scale, size, imageSize }: {
  row: PlantedRow;
  selected: boolean;
  scale: number;
  size: Size;
  imageSize: Size;
}) {
  const start = row.labelPosition ?? row.path[0] ?? row.paths?.[0]?.[0] ?? { x: 0.5, y: 0.5 };
  const mapped = imagePointToCanvas(start, size, imageSize);
  return (
    <View
      pointerEvents="none"
      style={[
        editorStyles.photoLabel,
        { left: mapped.x, top: mapped.y, backgroundColor: row.color, transform: [{ translateX: -42 }, { translateY: -18 }, { scale: 1 / scale }] },
        selected && editorStyles.photoLabelSelected,
      ]}
    >
      <Text numberOfLines={1} style={editorStyles.photoLabelText}>{row.cropName}</Text>
    </View>
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
  selectionHeader: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectionTitle: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  selectionHint: { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '700' },
  labelStrip: { gap: 8, alignItems: 'center', paddingBottom: 2 },
  labelChip: { height: 36, borderRadius: 11, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#161616', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
  labelChipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  addChip: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  photoLabel: { position: 'absolute', minWidth: 84, maxWidth: 160, height: 36, borderRadius: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  photoLabelSelected: { borderWidth: 3, borderColor: '#FFFFFF' },
  photoLabelText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 2 },
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
