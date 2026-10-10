import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';

interface CategoryItem {
  name: string;
  icon: string;
  bg: string;
  isGrocery: boolean;
  categoryName?: string;
  searchQuery?: string;
}

const HOME_CATEGORIES: CategoryItem[] = [
  {
    name: 'Fruits & Veggies',
    icon: '🥦',
    bg: '#E6F4EA',
    isGrocery: true,
    categoryName: 'Vegetables & Fruits',
  },
  {
    name: 'Dairy & Bread',
    icon: '🥛',
    bg: '#FDF4E5',
    isGrocery: true,
    categoryName: 'Dairy & Bread',
  },
  {
    name: 'Munchies',
    icon: '🍿',
    bg: '#FFF1E6',
    isGrocery: true,
    categoryName: 'Munchies',
  },
  {
    name: 'Drinks & Juices',
    icon: '🥤',
    bg: '#E8F0FE',
    isGrocery: true,
    categoryName: 'Cold Drinks & Juices',
  },
  {
    name: 'Atta, Rice, Oils',
    icon: '🌾',
    bg: '#FFEBE5',
    isGrocery: true,
    categoryName: 'Atta, Rice & Dals',
  },
  {
    name: 'Biryani',
    icon: '🥘',
    bg: '#FFF2E6',
    isGrocery: false,
    searchQuery: 'Biryani',
  },
  {
    name: 'Pizza & Pasta',
    icon: '🍕',
    bg: '#FCE8E6',
    isGrocery: false,
    searchQuery: 'Pizza',
  },
  {
    name: 'Burgers',
    icon: '🍔',
    bg: '#E6F4EA',
    isGrocery: false,
    searchQuery: 'Burger',
  },
];

export default function Categories() {
  const router = useRouter();

  const handleCategoryPress = (cat: CategoryItem) => {
    if (cat.isGrocery && cat.categoryName) {
      router.push({
        pathname: '/grocery/category/[categoryName]',
        params: { categoryName: cat.categoryName },
      } as any);
    } else {
      router.push('/(tabs)/search' as any);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>What would you like to order?</Text>
        <Text style={styles.badge}>FOOD & GROCERIES</Text>
      </View>

      <View style={styles.grid}>
        {HOME_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.name}
            style={styles.card}
            onPress={() => handleCategoryPress(cat)}
          >
            <View style={[styles.iconCircle, { backgroundColor: cat.bg }]}>
              <Text style={styles.emoji}>{cat.icon}</Text>
            </View>
            <Text style={styles.categoryName} numberOfLines={2}>
              {cat.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  badge: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
    justifyContent: 'space-between',
  },
  card: {
    width: '23%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.xs,
    ...Shadows.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emoji: {
    fontSize: 20,
  },
  categoryName: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 12,
  },
});
