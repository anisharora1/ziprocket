import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';

export default function Categories() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Food category */}
      <Pressable
        style={styles.card}
        onPress={() => router.push('/(tabs)/search')}
      >
        <View style={[styles.iconCircle, { backgroundColor: '#FFF1E6' }]}>
          <Text style={styles.emoji}>🍔</Text>
        </View>
        <Text style={styles.title}>Food</Text>
        <Text style={styles.subtitle}>Hungry?</Text>
      </Pressable>

      {/* Grocery category */}
      <Pressable
        style={styles.card}
        onPress={() => router.push('/grocery' as any)}
      >
        <View style={[styles.iconCircle, { backgroundColor: '#E6F4EA' }]}>
          <Text style={styles.emoji}>🛒</Text>
        </View>
        <Text style={styles.title}>Grocery</Text>
        <Text style={styles.subtitle}>Fresh Daily</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emoji: {
    fontSize: 28,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
