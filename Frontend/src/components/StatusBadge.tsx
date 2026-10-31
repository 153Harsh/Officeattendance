import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radii } from '../theme';

type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';
type EmployeeStatus = 'ACTIVE' | 'INACTIVE';
type StatusBadgeVariant = AttendanceStatus | EmployeeStatus | 'ONLINE' | 'OFFLINE';

const CONFIG: Record<StatusBadgeVariant, { label: string; color: string; bg: string }> = {
  PRESENT:  { label: 'Present',  color: Colors.present,  bg: Colors.presentBg },
  LATE:     { label: 'Late',     color: Colors.late,     bg: Colors.lateBg },
  ABSENT:   { label: 'Absent',   color: Colors.absent,   bg: Colors.absentBg },
  ACTIVE:   { label: 'Active',   color: Colors.success,  bg: Colors.successBg },
  INACTIVE: { label: 'Inactive', color: Colors.error,    bg: Colors.errorBg },
  ONLINE:   { label: 'Online',   color: Colors.success,  bg: Colors.successBg },
  OFFLINE:  { label: 'Offline',  color: Colors.warning,  bg: Colors.warningBg },
};

type Props = {
  status: StatusBadgeVariant;
  size?: 'sm' | 'md';
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.ABSENT;
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: cfg.bg },
        isSmall && styles.badgeSm,
      ]}
      accessibilityLabel={cfg.label}
    >
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.label, { color: cfg.color }, isSmall && styles.labelSm]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['3'],
    paddingVertical: Spacing['1.5'],
    borderRadius: Radii.full,
    alignSelf: 'center',
  },
  badgeSm: {
    paddingHorizontal: Spacing['2'],
    paddingVertical: Spacing['1'],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing['1.5'],
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  labelSm: {
    fontSize: Typography.xs,
  },
});