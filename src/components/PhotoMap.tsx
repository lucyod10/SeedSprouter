import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { PlantedRow, Point } from '../types';

type Props = {
  uri: string;
  rows: PlantedRow[];
  height?: number;
  borderRadius?: number;
  drawing?: boolean;
  color?: string;
  resizeMode?: 'cover' | 'contain';
  onPathChange?: (path: Point[]) => void;
};

function imageMetrics(width: number, height: number, imageWidth: number, imageHeight: number, resizeMode: 'cover' | 'contain') {
  const scale = resizeMode === 'cover' ? Math.max(width / imageWidth, height / imageHeight) : Math.min(width / imageWidth, height / imageHeight);
  const drawnWidth = imageWidth * scale;
  const drawnHeight = imageHeight * scale;
  return { drawnWidth, drawnHeight, cropX: (drawnWidth - width) / 2, cropY: (drawnHeight - height) / 2 };
}

function mapPoint(point: Point, width: number, height: number, imageWidth: number, imageHeight: number, resizeMode: 'cover' | 'contain') {
  const metrics = imageMetrics(width, height, imageWidth, imageHeight, resizeMode);
  return { x: point.x * metrics.drawnWidth - metrics.cropX, y: point.y * metrics.drawnHeight - metrics.cropY };
}

function pathData(points: Point[], width: number, height: number, imageWidth: number, imageHeight: number, resizeMode: 'cover' | 'contain') {
  if (!points.length) return '';
  const path = points.map((point, index) => {
    const mapped = mapPoint(point, width, height, imageWidth, imageHeight, resizeMode);
    return `${index ? 'L' : 'M'} ${mapped.x} ${mapped.y}`;
  }).join(' ');
  return points.length > 2 ? `${path} Z` : path;
}

function allStrokes(row: PlantedRow) {
  return [row.path, ...(row.paths ?? [])].filter((stroke) => stroke.length > 0);
}

export function PhotoMap({ uri, rows, height = 280, borderRadius = 24, drawing = false, color = '#F2C14E', resizeMode = 'cover', onPathChange }: Props) {
  const [width, setWidth] = useState(1);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const draft = useRef<Point[]>([]);
  const [, setRevision] = useState(0);

  useEffect(() => {
    Image.getSize(uri, (imageWidth, imageHeight) => setImageSize({ width: imageWidth, height: imageHeight }), () => setImageSize({ width: 1, height: 1 }));
  }, [uri]);

  const addPoint = (x: number, y: number, reset = false) => {
    const point = {
      x: Math.min(1, Math.max(0, x / width)),
      y: Math.min(1, Math.max(0, y / height)),
    };
    draft.current = reset ? [point] : [...draft.current, point];
    setRevision((value) => value + 1);
    onPathChange?.(draft.current);
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => drawing,
    onMoveShouldSetPanResponder: () => drawing,
    onPanResponderGrant: (event) => addPoint(event.nativeEvent.locationX, event.nativeEvent.locationY, true),
    onPanResponderMove: (event) => addPoint(event.nativeEvent.locationX, event.nativeEvent.locationY),
  }), [drawing, width, height]);

  const overlayRows = drawing
    ? [...rows, { id: 'draft', cropName: 'New row', color, path: draft.current } as PlantedRow]
    : rows;

  return (
    <View
      style={[styles.frame, { height, borderRadius }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={resizeMode} />
      <View style={styles.shade} pointerEvents="none" />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        {overlayRows.map((row) => {
          const strokes = allStrokes(row);
          const anchor = row.labelPosition ?? strokes[0]?.[0];
          if (!anchor) return null;
          const mappedAnchor = mapPoint(anchor, width, height, imageSize.width, imageSize.height, resizeMode);
          return (
              <G key={row.id}>
                {strokes.map((stroke, index) => stroke.length > 1 ? (
                  <G key={`${row.id}-stroke-${index}`}>
                    <Path
                      d={pathData(stroke, width, height, imageSize.width, imageSize.height, resizeMode)}
                      stroke="rgba(0, 0, 0, 0.62)"
                      strokeWidth={9}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <Path
                      d={pathData(stroke, width, height, imageSize.width, imageSize.height, resizeMode)}
                      stroke={row.color}
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </G>
                ) : null)}
                <Circle cx={mappedAnchor.x} cy={mappedAnchor.y} r={12} fill={row.color} />
                <SvgText
                  x={mappedAnchor.x + 17}
                  y={mappedAnchor.y + 5}
                  fill="#FFFFFF"
                  stroke="#183226"
                  strokeWidth={3}
                  fontSize={14}
                  fontWeight="700"
                >
                  {row.cropName}
                </SvgText>
              </G>
          );
        })}
      </Svg>
      {drawing && draft.current.length < 2 ? (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>Drag your finger along the planted row</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  hint: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    alignItems: 'center',
  },
  hintText: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.84)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    fontWeight: '700',
    overflow: 'hidden',
  },
});
