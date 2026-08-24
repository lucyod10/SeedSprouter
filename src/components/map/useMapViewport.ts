import { useCallback, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { MapSize } from '../BedMapOverlay';

export type MapViewport = {
  scale: ReturnType<typeof useSharedValue<number>>;
  translateX: ReturnType<typeof useSharedValue<number>>;
  translateY: ReturnType<typeof useSharedValue<number>>;
};

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.max(minimum, Math.min(maximum, value));
}

function clampTranslation(value: number, viewportLength: number, scale: number) {
  'worklet';
  const maximum = viewportLength * (scale - 1) / 2;
  return clamp(value, -maximum, maximum);
}

export function useMapViewport(size: MapSize, maximumScale = 8) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const anchorX = useSharedValue(0);
  const anchorY = useSharedValue(0);
  const [zoomPercent, setZoomPercent] = useState(100);

  const reportZoom = useCallback((value: number) => setZoomPercent(Math.round(value * 100)), []);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .onBegin((event) => {
      startScale.value = scale.value;
      startX.value = translateX.value;
      startY.value = translateY.value;
      anchorX.value = size.width / 2 + (event.focalX - size.width / 2 - translateX.value) / scale.value;
      anchorY.value = size.height / 2 + (event.focalY - size.height / 2 - translateY.value) / scale.value;
    })
    .onUpdate((event) => {
      const nextScale = clamp(startScale.value * event.scale, 1, maximumScale);
      scale.value = nextScale;
      translateX.value = clampTranslation(
        event.focalX - size.width / 2 - (anchorX.value - size.width / 2) * nextScale,
        size.width,
        nextScale,
      );
      translateY.value = clampTranslation(
        event.focalY - size.height / 2 - (anchorY.value - size.height / 2) * nextScale,
        size.height,
        nextScale,
      );
    })
    .onFinalize(() => {
      if (scale.value < 1.02) {
        scale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
      }
      runOnJS(reportZoom)(scale.value);
    }), [size.width, size.height, maximumScale, reportZoom]);

  const panGesture = useMemo(() => Gesture.Pan()
    .maxPointers(1)
    .minDistance(1)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = clampTranslation(startX.value + event.translationX, size.width, scale.value);
      translateY.value = clampTranslation(startY.value + event.translationY, size.height, scale.value);
    }), [size.width, size.height]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const reset = () => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    setZoomPercent(100);
  };

  const zoomBy = (factor: number) => {
    const nextScale = Math.max(1, Math.min(maximumScale, scale.value * factor));
    const ratio = nextScale / scale.value;
    scale.value = nextScale;
    translateX.value = clampTranslation(translateX.value * ratio, size.width, nextScale);
    translateY.value = clampTranslation(translateY.value * ratio, size.height, nextScale);
    setZoomPercent(Math.round(nextScale * 100));
  };

  return {
    viewport: { scale, translateX, translateY } satisfies MapViewport,
    pinchGesture,
    panGesture,
    imageStyle,
    zoomPercent,
    reset,
    zoomBy,
  };
}
