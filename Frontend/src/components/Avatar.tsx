import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Sizes } from '../theme';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % Colors.avatarPalette.length;
  return Colors.avatarPalette[index];
}

type Props = {
  name: string;
  size?: 'sm' | 'md' | 'lg';
};

export default function Avatar({ name, size = 'md' }: Props) {
  const dim =
    size === 'sm' ? Sizes.avatarSm :
    size === 'lg' ? Sizes.avatarLg :
    Sizes.avatarMd;

  const fontSize =
    size === 'sm' ? Typography.sm :
    size === 'lg' ? Typography.md :
    Typography.base;

  const color = getAvatarColor(name);

  return (
    <View
      style={[
        styles.avatar,
        { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: color },
      ]}
      accessibilityLabel={`Avatar for ${name}`}
    >
      <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: Colors.textInverse,
    fontWeight: Typography.bold,
    letterSpacing: 0.5,
  },
});
