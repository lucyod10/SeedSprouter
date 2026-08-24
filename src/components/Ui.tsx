import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { palette } from '../theme/tokens';

export { palette } from '../theme/tokens';

export function ProgressRing({ progress, icon, color = palette.leaf, trackColor = '#ECEEEA', iconColor = palette.ink, size = 46, strokeWidth = 4 }: {
  progress: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color?: string;
  trackColor?: string;
  iconColor?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0.03, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - value)}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.42)} color={iconColor} />
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  loading,
  tone = 'green',
}: {
  label: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'green' | 'cream' | 'danger';
}) {
  const colors = tone === 'green'
    ? { backgroundColor: palette.leaf, color: '#FFFFFF' }
    : tone === 'danger'
      ? { backgroundColor: '#F8E7E4', color: palette.danger }
      : { backgroundColor: '#EBEFE6', color: palette.ink };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, colors, (pressed || disabled) && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={colors.color} /> : icon ? <MaterialCommunityIcons name={icon} size={20} color={colors.color} /> : null}
      <Text style={[styles.buttonText, { color: colors.color }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <MaterialCommunityIcons name={icon} size={23} color={palette.ink} />
    </Pressable>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.65, transform: [{ scale: 0.99 }] },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: palette.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.25 },
});
