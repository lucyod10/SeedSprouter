import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { keepPhoto } from '../services/media';
import { PlantedRow } from '../types';
import { PhotoMap } from './PhotoMap';
import { palette } from './Ui';

type Props = {
  visible: boolean;
  referenceUri: string;
  rows: PlantedRow[];
  onClose: () => void;
  onUsePhoto: (uri: string) => void;
  onChoosePhoto: () => void;
};

export function ProgressCamera({ visible, referenceUri, rows, onClose, onUsePhoto, onChoosePhoto }: Props) {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string>();
  const [onionOpacity, setOnionOpacity] = useState(0.32);
  const [alignmentVisible, setAlignmentVisible] = useState(true);
  const [height, setHeight] = useState(1);

  const close = () => {
    setCapturedUri(undefined);
    setReady(false);
    setAlignmentVisible(true);
    onClose();
  };

  const takePicture = async () => {
    if (!camera.current || !ready || capturing) return;
    setCapturing(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.86 });
      const permanentUri = await keepPhoto(photo.uri);
      setCapturedUri(permanentUri);
      setAlignmentVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Couldn’t take the photo', 'Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const usePhoto = () => {
    if (!capturedUri) return;
    onUsePhoto(capturedUri);
    setCapturedUri(undefined);
    setReady(false);
    setAlignmentVisible(true);
  };

  const toggleAlignment = () => {
    setAlignmentVisible((current) => !current);
    Haptics.selectionAsync();
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={cameraStyles.root} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        {!permission ? <View style={cameraStyles.center}><ActivityIndicator color="#FFFFFF" /></View> : !permission.granted ? (
          <View style={cameraStyles.permission}>
            <MaterialCommunityIcons name="camera-outline" size={42} color="#FFFFFF" />
            <Text style={cameraStyles.permissionTitle}>Camera access is needed</Text>
            <Text style={cameraStyles.permissionBody}>The alignment camera keeps your previous bed photo on screen while you take the next one.</Text>
            <Pressable onPress={requestPermission} style={cameraStyles.permissionButton}><Text style={cameraStyles.permissionButtonText}>Allow camera</Text></Pressable>
          </View>
        ) : capturedUri ? (
          <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" onCameraReady={() => setReady(true)} />
        )}

        {permission?.granted && alignmentVisible ? (
          <View style={[StyleSheet.absoluteFill, { opacity: onionOpacity }]} pointerEvents="none">
            <PhotoMap uri={referenceUri} rows={rows} height={height} borderRadius={0} />
          </View>
        ) : null}

        <SafeAreaView edges={['top']} style={cameraStyles.topBar} pointerEvents="box-none">
          <Pressable onPress={close} style={cameraStyles.roundButton}><MaterialCommunityIcons name="close" size={25} color="#FFFFFF" /></Pressable>
          {permission?.granted ? (
            <Pressable accessibilityRole="button" accessibilityLabel={alignmentVisible ? 'Hide alignment overlay' : 'Show alignment overlay'} onPress={toggleAlignment} style={[cameraStyles.titlePill, alignmentVisible && cameraStyles.titlePillActive]}>
              <MaterialCommunityIcons name={alignmentVisible ? 'layers-triple' : 'layers-triple-outline'} size={18} color={alignmentVisible ? '#000000' : '#FFFFFF'} />
              <Text style={[cameraStyles.titleText, alignmentVisible && cameraStyles.titleTextActive]}>{alignmentVisible ? 'Hide alignment' : 'Check alignment'}</Text>
            </Pressable>
          ) : <View />}
          <View style={{ width: 44 }} />
        </SafeAreaView>

        {permission?.granted && alignmentVisible ? (
          <View style={cameraStyles.opacityRail}>
            <Pressable onPress={() => setOnionOpacity((value) => Math.min(0.7, value + 0.1))} style={cameraStyles.opacityButton}><MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" /></Pressable>
            <Text style={cameraStyles.opacityLabel}>ONION{`\n`}SKIN{`\n`}{Math.round(onionOpacity * 100)}%</Text>
            <View style={cameraStyles.opacityTrack}><View style={[cameraStyles.opacityFill, { height: `${Math.round(onionOpacity / 0.7 * 100)}%` }]} /></View>
            <Pressable onPress={() => setOnionOpacity((value) => Math.max(0, value - 0.1))} style={cameraStyles.opacityButton}><MaterialCommunityIcons name="minus" size={20} color="#FFFFFF" /></Pressable>
          </View>
        ) : null}

        {permission?.granted ? (
          <SafeAreaView edges={['bottom']} style={cameraStyles.bottomBar}>
            {capturedUri ? (
              <View style={cameraStyles.reviewActions}>
                <Pressable onPress={() => { setCapturedUri(undefined); setAlignmentVisible(true); }} style={cameraStyles.textButton}><MaterialCommunityIcons name="camera-retake-outline" size={22} color="#FFFFFF" /><Text style={cameraStyles.textButtonLabel}>Retake</Text></Pressable>
                <Pressable onPress={usePhoto} style={cameraStyles.useButton}><Text style={cameraStyles.useButtonText}>Use photo</Text><MaterialCommunityIcons name="arrow-right" size={21} color="#FFFFFF" /></Pressable>
              </View>
            ) : (
              <View style={cameraStyles.captureRow}>
                <Pressable onPress={onChoosePhoto} style={cameraStyles.libraryButton}><MaterialCommunityIcons name="image-outline" size={22} color="#FFFFFF" /><Text style={cameraStyles.libraryText}>Library</Text></Pressable>
                <Pressable disabled={!ready || capturing} onPress={takePicture} style={[cameraStyles.shutterOuter, (!ready || capturing) && { opacity: 0.5 }]}><View style={cameraStyles.shutterInner}>{capturing ? <ActivityIndicator color={palette.ink} /> : null}</View></Pressable>
                <View style={{ width: 104 }} />
              </View>
            )}
          </SafeAreaView>
        ) : null}
      </View>
    </Modal>
  );
}

const cameraStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  permissionTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  permissionBody: { color: 'rgba(255,255,255,0.72)', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  permissionButton: { marginTop: 8, minHeight: 50, paddingHorizontal: 22, borderRadius: 16, backgroundColor: palette.leaf, alignItems: 'center', justifyContent: 'center' },
  permissionButtonText: { color: '#FFFFFF', fontWeight: '900' },
  topBar: { position: 'absolute', top: 0, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.48)' },
  titlePill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.48)' },
  titlePillActive: { backgroundColor: '#FFFFFF' },
  titleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  titleTextActive: { color: '#000000' },
  opacityRail: { position: 'absolute', right: 14, top: '29%', alignItems: 'center', gap: 7, padding: 8, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.48)' },
  opacityButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  opacityLabel: { color: '#FFFFFF', fontSize: 8, lineHeight: 10, fontWeight: '900', textAlign: 'center' },
  opacityTrack: { width: 5, height: 78, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'flex-end', overflow: 'hidden' },
  opacityFill: { width: 5, borderRadius: 3, backgroundColor: '#FFFFFF' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.58)', paddingTop: 14, paddingHorizontal: 20 },
  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  libraryButton: { width: 104, alignItems: 'center', justifyContent: 'center', gap: 3 },
  libraryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', padding: 5 },
  shutterInner: { flex: 1, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  reviewActions: { flexDirection: 'row', gap: 12, paddingBottom: 8 },
  textButton: { flex: 1, minHeight: 52, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.16)' },
  textButtonLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  useButton: { flex: 1.4, minHeight: 52, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: palette.leaf },
  useButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
