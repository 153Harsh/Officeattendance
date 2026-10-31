import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radii, Shadows } from '../theme';

type Props = {
  label: string;
  value: string | number;
  accentColor: string;
  accentBg?: string;
};

export default function SummaryCard({ label, value, accentColor, accentBg }: Props) {
  return (
    <View style={[styles.card, { borderTopColor: accentColor }]}>
      <View style={[styles.iconDot, { backgroundColor: accentBg ?? accentColor + '22' }]}>
        <View style={[styles.dot, { backgroundColor: accentColor }]} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radii.lg,
    padding: 10,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 3,
    borderBottomColor: '#D8C9AD',
    ...Shadows.sm,
  },
  iconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2'],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  value: {
    fontSize: Typography.lg,
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
    marginBottom: Spacing['1'],
  },
  label: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
    lineHeight: 4,
  },
});