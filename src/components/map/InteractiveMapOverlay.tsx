import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { PlantedRow, Point } from '../../types';
import { imageMetrics, imagePointToCanvas, MapResizeMode, MapSize, rowStrokes } from '../BedMapOverlay';
import { MapViewport } from './useMapViewport';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  rows: PlantedRow[];
  size: MapSize;
  imageSize: MapSize;
  viewport: MapViewport;
  resizeMode?: MapResizeMode;
  selectedId?: string;
  labelsEditable?: boolean;
  onSelectLabel?: (rowId: string) => void;
  onMoveLabel?: (rowId: string, point: Point) => void;
};

function AnimatedStroke({ points, color, width, opacity, size, imageSize, resizeMode, viewport }: {
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  size: MapSize;
  imageSize: MapSize;
  resizeMode: MapResizeMode;
  viewport: MapViewport;
}) {
  const canvasPoints = points.map((point) => imagePointToCanvas(point, size, imageSize, resizeMode));
  const animatedProps = useAnimatedProps(() => ({
    d: canvasPoints.map((point, index) => {
      const x = size.width / 2 + viewport.translateX.value + (point.x - size.width / 2) * viewport.scale.value;
      const y = size.height / 2 + viewport.translateY.value + (point.y - size.height / 2) * viewport.scale.value;
      return `${index ? 'L' : 'M'} ${x} ${y}`;
    }).join(' '),
  }));
  return <AnimatedPath animatedProps={animatedProps} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />;
}

function MapLabel({ row, selected, opacity, editable, size, imageSize, resizeMode, viewport, onSelect, onMove }: {
  row: PlantedRow;
  selected: boolean;
  opacity: number;
  editable: boolean;
  size: MapSize;
  imageSize: MapSize;
  resizeMode: MapResizeMode;
  viewport: MapViewport;
  onSelect?: (rowId: string) => void;
  onMove?: (rowId: string, point: Point) => void;
}) {
  const anchor = row.labelPosition ?? row.path[0] ?? row.paths?.[0]?.[0] ?? { x: 0.5, y: 0.5 };
  const pointX = useSharedValue(anchor.x);
  const pointY = useSharedValue(anchor.y);
  const startPointX = useSharedValue(anchor.x);
  const startPointY = useSharedValue(anchor.y);
  const metrics = imageMetrics(size, imageSize, resizeMode);

  useEffect(() => {
    pointX.value = anchor.x;
    pointY.value = anchor.y;
  }, [anchor.x, anchor.y]);

  const labelStyle = useAnimatedStyle(() => {
    const canvasX = metrics.offsetX + pointX.value * metrics.width;
    const canvasY = metrics.offsetY + pointY.value * metrics.height;
    const x = size.width / 2 + viewport.translateX.value + (canvasX - size.width / 2) * viewport.scale.value;
    const y = size.height / 2 + viewport.translateY.value + (canvasY - size.height / 2) * viewport.scale.value;
    return { transform: [{ translateX: x - 42 }, { translateY: y - 18 }] };
  });

  const dragGesture = useMemo(() => Gesture.Pan()
    .enabled(editable)
    .maxPointers(1)
    .minDistance(1)
    .onBegin(() => {
      startPointX.value = pointX.value;
      startPointY.value = pointY.value;
      if (onSelect) runOnJS(onSelect)(row.id);
    })
    .onUpdate((event) => {
      const startCanvasX = metrics.offsetX + startPointX.value * metrics.width;
      const startCanvasY = metrics.offsetY + startPointY.value * metrics.height;
      const startScreenX = size.width / 2 + viewport.translateX.value + (startCanvasX - size.width / 2) * viewport.scale.value;
      const startScreenY = size.height / 2 + viewport.translateY.value + (startCanvasY - size.height / 2) * viewport.scale.value;
      const contentX = size.width / 2 + (startScreenX + event.translationX - size.width / 2 - viewport.translateX.value) / viewport.scale.value;
      const contentY = size.height / 2 + (startScreenY + event.translationY - size.height / 2 - viewport.translateY.value) / viewport.scale.value;
      pointX.value = Math.max(0, Math.min(1, (contentX - metrics.offsetX) / metrics.width));
      pointY.value = Math.max(0, Math.min(1, (contentY - metrics.offsetY) / metrics.height));
    })
    .onFinalize(() => {
      if (onMove) runOnJS(onMove)(row.id, { x: pointX.value, y: pointY.value });
    }), [editable, row.id, size.width, size.height, imageSize.width, imageSize.height, resizeMode]);
  const tapGesture = useMemo(() => Gesture.Tap().enabled(editable).onEnd(() => {
    if (onSelect) runOnJS(onSelect)(row.id);
  }), [editable, row.id]);
  const labelGesture = useMemo(() => Gesture.Exclusive(dragGesture, tapGesture), [dragGesture, tapGesture]);

  const content = (
    <Animated.View pointerEvents={editable ? 'auto' : 'none'} style={[styles.photoLabelPosition, labelStyle]}>
      <View style={[styles.photoLabel, { backgroundColor: row.color, opacity }, selected && styles.photoLabelSelected]}>
        <Text numberOfLines={1} style={styles.photoLabelText}>{row.cropName}</Text>
      </View>
    </Animated.View>
  );
  return editable ? <GestureDetector gesture={labelGesture}>{content}</GestureDetector> : content;
}

export function InteractiveMapOverlay({ rows, size, imageSize, viewport, resizeMode = 'contain', selectedId, labelsEditable = false, onSelectLabel, onMoveLabel }: Props) {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {rows.flatMap((row) => {
          const selected = row.id === selectedId;
          const opacity = selectedId && !selected ? 0.7 : 1;
          return rowStrokes(row).map((stroke, index) => stroke.length > 1 ? (
            <AnimatedStroke
              key={`${row.id}-${index}`}
              points={stroke}
              color={row.color}
              width={selected ? 5 : 3}
              opacity={opacity}
              size={size}
              imageSize={imageSize}
              resizeMode={resizeMode}
              viewport={viewport}
            />
          ) : null);
        })}
      </Svg>
      {rows.map((row) => {
        const selected = row.id === selectedId;
        return (
          <MapLabel
            key={row.id}
            row={row}
            selected={selected}
            opacity={selectedId && !selected ? 0.7 : 1}
            editable={labelsEditable}
            size={size}
            imageSize={imageSize}
            resizeMode={resizeMode}
            viewport={viewport}
            onSelect={onSelectLabel}
            onMove={onMoveLabel}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  photoLabelPosition: { position: 'absolute', left: 0, top: 0 },
  photoLabel: { minWidth: 84, maxWidth: 160, height: 36, borderRadius: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  photoLabelSelected: { borderWidth: 3, borderColor: '#FFFFFF' },
  photoLabelText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 2 },
});
