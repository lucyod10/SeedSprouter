import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Image as NativeImage, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { resolveMediaUri } from '../services/media';
import { PlantedRow } from '../types';
import { BedMapOverlay, MapResizeMode, MapSize } from './BedMapOverlay';
import { GardenImage } from './GardenImage';
import { InteractiveMapOverlay } from './map/InteractiveMapOverlay';
import { useMapViewport } from './map/useMapViewport';

type Props = {
  uri: string;
  rows: PlantedRow[];
  height?: number;
  borderRadius?: number;
  resizeMode?: MapResizeMode;
  interactive?: boolean;
};

export function PhotoMap({ uri, rows, height = 280, borderRadius = 24, resizeMode = 'contain', interactive = false }: Props) {
  const [size, setSize] = useState<MapSize>({ width: 1, height });
  const [imageSize, setImageSize] = useState<MapSize>({ width: 1, height: 1 });
  const [imageLoadError, setImageLoadError] = useState(false);
  const { viewport, pinchGesture, panGesture, imageStyle, zoomPercent, reset, zoomBy } = useMapViewport(size, 8);
  const gesture = useMemo(
    () => Gesture.Simultaneous(pinchGesture, panGesture),
    [panGesture, pinchGesture],
  );

  useEffect(() => {
    const resolvedUri = resolveMediaUri(uri);
    setImageLoadError(false);
    NativeImage.getSize(
      resolvedUri,
      (width, imageHeight) => setImageSize({ width, height: imageHeight }),
      () => setImageLoadError(true),
    );
    reset();
  }, [uri]);

  return (
    <View
      style={[styles.frame, { height, borderRadius }]}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
        <GardenImage
          uri={uri}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          highQuality={interactive}
          onLoad={(event) => {
            if (event.source.width > 0 && event.source.height > 0) setImageSize({ width: event.source.width, height: event.source.height });
            setImageLoadError(false);
          }}
          onError={() => setImageLoadError(true)}
        />
      </Animated.View>

      {interactive ? (
        <InteractiveMapOverlay rows={rows} size={size} imageSize={imageSize} resizeMode={resizeMode} viewport={viewport} />
      ) : (
        <BedMapOverlay rows={rows} size={size} imageSize={imageSize} resizeMode={resizeMode} />
      )}

      {interactive ? <GestureDetector gesture={gesture}><Animated.View style={StyleSheet.absoluteFill} /></GestureDetector> : null}

      {imageLoadError ? (
        <View pointerEvents="none" style={styles.errorMessage}>
          <MaterialCommunityIcons name="image-off-outline" size={25} color="#FFFFFF" />
          <Text style={styles.errorText}>Photo could not be opened</Text>
        </View>
      ) : null}

      {interactive ? (
        <View style={styles.zoomRail}>
          <Pressable accessibilityLabel="Zoom in" onPress={() => zoomBy(1.5)} style={styles.zoomButton}><MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" /></Pressable>
          <Pressable accessibilityLabel="Reset zoom" onPress={reset} style={styles.zoomPercent}><Text style={styles.zoomText}>{zoomPercent}%</Text></Pressable>
          <Pressable accessibilityLabel="Zoom out" onPress={() => zoomBy(1 / 1.5)} style={styles.zoomButton}><MaterialCommunityIcons name="minus" size={22} color="#FFFFFF" /></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden', backgroundColor: '#000000' },
  errorMessage: { position: 'absolute', alignSelf: 'center', top: '45%', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.72)' },
  errorText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  zoomRail: { position: 'absolute', right: 14, top: '42%', alignItems: 'center', overflow: 'hidden', borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  zoomButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  zoomPercent: { minWidth: 42, minHeight: 34, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  zoomText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
