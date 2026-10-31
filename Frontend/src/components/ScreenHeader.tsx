import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Sizes, Shadows } from '../theme';

type Props = {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
};

export default function ScreenHeader({ title, onBack, rightElement }: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <View style={styles.right}>
        {rightElement ?? <View style={styles.placeholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: Sizes.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['4'],
    backgroundColor: Colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: '#FFF9ED',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadows.xs,
  },
  left: {
    width: 72,
    alignItems: 'flex-start',
  },
  right: {
    width: 72,
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 72,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Sizes.touchMin,
    justifyContent: 'flex-start',
  },
  backArrow: {
    fontSize: 26,
    color: Colors.accent,
    lineHeight: 28,
    marginRight: 2,
  },
  backLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.accent,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
});
