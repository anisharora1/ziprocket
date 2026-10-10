import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';

export default function SearchBar() {
  const router = useRouter();

  return (
    <Pressable
      style={styles.searchBar}
      onPress={() => router.push('/(tabs)/search')}
    >
      <View style={styles.leftGroup}>
        <MaterialIcons name="search" size={22} color={Colors.textMuted} />
        <Text style={styles.placeholderText}>Search for food, grocery...</Text>
      </View>
      <View style={styles.micCircle}>
        <MaterialIcons name="mic" size={20} color={Colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    height: 52,
    marginVertical: Spacing.sm,
    ...Shadows.sm,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  placeholderText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.sm + 1,
    color: Colors.textMuted,
  },
  micCircle: {
    padding: Spacing.xs,
  },
});
