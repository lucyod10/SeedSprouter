import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PlantedRow, Point } from '../types';

export type MapSize = { width: number; height: number };
export type MapResizeMode = 'cover' | 'contain';

export function imageMetrics(container: MapSize, image: MapSize, resizeMode: MapResizeMode) {
  const imageWidth = Math.max(1, image.width);
  const imageHeight = Math.max(1, image.height);
  const scale = resizeMode === 'cover'
    ? Math.max(container.width / imageWidth, container.height / imageHeight)
    : Math.min(container.width / imageWidth, container.height / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    width,
    height,
    offsetX: (container.width - width) / 2,
    offsetY: (container.height - height) / 2,
  };
}

export function imagePointToCanvas(point: Point, container: MapSize, image: MapSize, resizeMode: MapResizeMode = 'contain') {
  const metrics = imageMetrics(container, image, resizeMode);
  return {
    x: metrics.offsetX + point.x * metrics.width,
    y: metrics.offsetY + point.y * metrics.height,
  };
}

export function mapPathData(points: Point[], container: MapSize, image: MapSize, resizeMode: MapResizeMode = 'contain') {
  return points.map((point, index) => {
    const mapped = imagePointToCanvas(point, container, image, resizeMode);
    return `${index ? 'L' : 'M'} ${mapped.x} ${mapped.y}`;
  }).join(' ');
}

export function rowStrokes(row: PlantedRow) {
  return [row.path, ...(row.paths ?? [])].filter((stroke) => stroke.length > 0);
}

type Props = {
  rows: PlantedRow[];
  size: MapSize;
  imageSize: MapSize;
  resizeMode?: MapResizeMode;
  selectedId?: string;
  viewScale?: number;
};

export function BedMapOverlay({ rows, size, imageSize, resizeMode = 'contain', selectedId, viewScale = 1 }: Props) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
        {rows.flatMap((row) => {
          const selected = row.id === selectedId;
          const opacity = selectedId && !selected ? 0.7 : 1;
          return rowStrokes(row).map((stroke, index) => stroke.length > 1 ? (
            <Path
              key={`${row.id}-${index}`}
              d={mapPathData(stroke, size, imageSize, resizeMode)}
              fill="none"
              stroke={row.color}
              strokeWidth={(selected ? 5 : 3) / viewScale}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={opacity}
            />
          ) : null);
        })}
      </Svg>
      {rows.map((row) => {
        const anchor = row.labelPosition ?? row.path[0] ?? row.paths?.[0]?.[0] ?? { x: 0.5, y: 0.5 };
        const mapped = imagePointToCanvas(anchor, size, imageSize, resizeMode);
        const selected = row.id === selectedId;
        const opacity = selectedId && !selected ? 0.7 : 1;
        return (
          <View
            key={row.id}
            style={[
              styles.photoLabel,
              {
                left: mapped.x,
                top: mapped.y,
                backgroundColor: row.color,
                opacity,
                transform: [{ translateX: -42 }, { translateY: -18 }, { scale: 1 / viewScale }],
              },
              selected && styles.photoLabelSelected,
            ]}
          >
            <Text numberOfLines={1} style={styles.photoLabelText}>{row.cropName}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  photoLabel: {
    position: 'absolute',
    minWidth: 84,
    maxWidth: 160,
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  photoLabelSelected: { borderWidth: 3, borderColor: '#FFFFFF' },
  photoLabelText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 2,
  },
});
