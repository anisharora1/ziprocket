import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ListRenderItemInfo } from 'react-native';
import {
  useGroceryThemeSections,
  useThemeSections,
} from '../context/ThemeCampaignProvider';
import { ThemeCampaignProduct } from '../utils/themeCampaign';
import ProductCard, { Product } from './ProductCard';
import { Colors, Spacing, Typography, FontFamily } from '../constants/theme';

function mapCampaignProduct(p: ThemeCampaignProduct): Product {
  return {
    _id: p.id,
    name: p.name,
    price: p.price,
    discountedPrice: p.discountedPrice ?? undefined,
    stockQuantity: p.inStock ? 99 : 0,
    unit: p.unit,
    images: p.image ? [p.image] : [],
    isAvailable: p.inStock,
  };
}

interface ThemeProductStripsProps {
  surface?: 'home' | 'grocery';
  getCartQuantity?: (productId: string) => number;
  addToCart?: any;
  updateQuantity?: any;
}

function ThemeProductStrips({
  surface = 'home',
  getCartQuantity,
  addToCart,
  updateQuantity,
}: ThemeProductStripsProps) {
  const homeSections = useThemeSections();
  const grocerySections = useGroceryThemeSections();
  const sections = surface === 'grocery' ? grocerySections : homeSections;

  const keyExtractor = useCallback((item: ThemeCampaignProduct) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ThemeCampaignProduct>) => {
      const mapped = mapCampaignProduct(item);
      return (
        <View style={styles.cardWrapper}>
          <ProductCard
            prod={mapped}
            qty={getCartQuantity ? getCartQuantity(item.id) : undefined}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
          />
        </View>
      );
    },
    [getCartQuantity, addToCart, updateQuantity]
  );

  const nonEmptySections = sections.filter(
    (sec) => Array.isArray(sec.products) && sec.products.length > 0
  );

  if (nonEmptySections.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {nonEmptySections.map((sec, idx) => (
        <View key={`${sec.title}-${idx}`} style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{sec.title}</Text>
          <FlatList
            data={sec.products}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        </View>
      ))}
    </View>
  );
}

export default React.memo(ThemeProductStrips);

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
    marginVertical: Spacing.xs,
  },
  sectionBlock: {
    gap: Spacing.xs + 2,
  },
  sectionTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.textPrimary,
  },
  listContent: {
    gap: Spacing.sm + 2,
    paddingVertical: 2,
  },
  cardWrapper: {
    width: 152,
  },
});
