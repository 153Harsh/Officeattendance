import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radii } from '../theme';

// ─── Loading ────────────────────────────────────────────────────────────────

type LoadingProps = { message?: string };

export function LoadingState({ message = 'Loading...' }: LoadingProps) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

// ─── Empty ──────────────────────────────────────────────────────────────────

type EmptyProps = {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ title, subtitle, action }: EmptyProps) {
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>📋</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
      {action ? (
        <TouchableOpacity style={styles.actionBtn} onPress={action.onPress}>
          <Text style={styles.actionBtnText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Error ──────────────────────────────────────────────────────────────────

type ErrorProps = {
  message: string;
  onRetry?: () => void;
  onBack?: () => void;
};

export function ErrorState({ message, onRetry, onBack }: ErrorProps) {
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, styles.errorIcon]}>
        <Text style={styles.emptyIconText}>⚠️</Text>
      </View>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <View style={styles.errorActions}>
        {onRetry ? (
          <TouchableOpacity style={styles.actionBtn} onPress={onRetry}>
            <Text style={styles.actionBtnText}>Try Again</Text>
          </TouchableOpacity>
        ) : null}
        {onBack ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
            <Text style={styles.secondaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ─── Offline ─────────────────────────────────────────────────────────────────

type OfflineProps = { onBack?: () => void };

export function OfflineState({ onBack }: OfflineProps) {
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, styles.offlineIcon]}>
        <Text style={styles.emptyIconText}>📡</Text>
      </View>
      <Text style={styles.emptyTitle}>No Internet Connection</Text>
      <Text style={styles.emptySubtitle}>
        This feature requires an active internet connection.
      </Text>
      {onBack ? (
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
          <Text style={styles.secondaryBtnText}>Go Back</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Inline alert banner ─────────────────────────────────────────────────────

type AlertBannerProps = {
  type: 'error' | 'success' | 'info' | 'warning';
  message: string;
};

export function AlertBanner({ type, message }: AlertBannerProps) {
  const cfg = {
    error:   { bg: Colors.errorBg,   border: Colors.errorBorder,   text: Colors.error,   icon: '⚠' },
    success: { bg: Colors.successBg, border: Colors.successBorder, text: Colors.success, icon: '✓' },
    info:    { bg: Colors.infoBg,    border: Colors.infoBorder,    text: Colors.info,    icon: 'ℹ' },
    warning: { bg: Colors.warningBg, border: Colors.warningBorder, text: Colors.warning, icon: '!' },
  }[type];

  return (
    <View style={[styles.banner, { backgroundColor: cfg.bg, borderLeftColor: cfg.border }]}>
      <Text style={[styles.bannerText, { color: cfg.text }]}>
        {cfg.icon}  {message}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['10'],
  },
  loadingText: {
    marginTop: Spacing['4'],
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['5'],
  },
  errorIcon: {
    backgroundColor: Colors.errorBg,
  },
  offlineIcon: {
    backgroundColor: Colors.warningBg,
  },
  emptyIconText: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing['2'],
  },
  emptySubtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing['6'],
  },
  errorTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing['2'],
  },
  errorMessage: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing['6'],
  },
  errorActions: {
    gap: Spacing['3'],
    alignItems: 'center',
  },
  actionBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing['6'],
    paddingVertical: Spacing['3'],
    borderRadius: Radii.md,
    minWidth: 120,
    alignItems: 'center',
  },
  actionBtnText: {
    color: Colors.textInverse,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  secondaryBtn: {
    paddingHorizontal: Spacing['6'],
    paddingVertical: Spacing['3'],
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 120,
    alignItems: 'center',
    marginTop: Spacing['2'],
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    fontWeight: Typography.medium,
  },
  banner: {
    borderLeftWidth: 4,
    borderRadius: Radii.sm,
    padding: Spacing['3'],
    marginBottom: Spacing['4'],
  },
  bannerText: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    lineHeight: 20,
  },
});
