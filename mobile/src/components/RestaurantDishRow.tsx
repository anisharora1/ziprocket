import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import DiscountBadge from './DiscountBadge';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  FontFamily,
  Shadows,
} from '../constants/theme';

export interface MenuItemType {
  _id: string;
  name: string;
  description?: string;
  price: number;
  discountedPrice?: number;
  isFeatured?: boolean;
  prepTimeMinutes?: number;
  spiceLevel?: 'none' | 'mild' | 'medium' | 'hot';
  category?: string;
  images?: string[];
  isAvailable?: boolean;
  isVeg?: boolean;
}

export interface RestaurantDishRowProps {
  item: MenuItemType;
  qty: number;
  effectivePrice: number;
  isItemDisabled: boolean;
  isLastItem?: boolean;
  onSelect: (item: MenuItemType) => void;
  onAddItem: (item: MenuItemType) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
}

function RestaurantDishRowComponent({
  item,
  qty,
  effectivePrice,
  isItemDisabled,
  isLastItem = false,
  onSelect,
  onAddItem,
  onUpdateQuantity,
}: RestaurantDishRowProps) {
  const handlePress = useCallback(() => {
    onSelect(item);
  }, [onSelect, item]);

  const handleMinus = useCallback(
    (e: any) => {
      e.stopPropagation?.();
      onUpdateQuantity(`food-${item._id}`, qty - 1);
    },
    [onUpdateQuantity, item._id, qty]
  );

  const handlePlus = useCallback(
    (e: any) => {
      e.stopPropagation?.();
      onUpdateQuantity(`food-${item._id}`, qty + 1);
    },
    [onUpdateQuantity, item._id, qty]
  );

  const handleAdd = useCallback(
    (e: any) => {
      e.stopPropagation?.();
      onAddItem(item);
    },
    [onAddItem, item]
  );

  return (
    <Pressable
      style={[
        styles.dishCard,
        isLastItem && styles.dishCardLast,
        !item.isAvailable && { opacity: 0.65 },
      ]}
      onPress={handlePress}
    >
      <View style={styles.dishInfoCol}>
        {/* Veg indicator & Category */}
        <View style={styles.vegIndicatorRow}>
          <View
            style={[
              styles.vegIndicatorBox,
              { borderColor: item.isVeg ? '#16A34A' : '#DC2626' },
            ]}
          >
            <View
              style={[
                styles.vegIndicatorCircle,
                { backgroundColor: item.isVeg ? '#16A34A' : '#DC2626' },
              ]}
            />
          </View>
          {item.isFeatured ? (
            <View style={styles.bestsellerChip}>
              <Text style={styles.bestsellerChipText}>🔥 BESTSELLER</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.dishName} numberOfLines={2}>
          {item.name}
        </Text>

        {item.description ? (
          <Text style={styles.dishDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Meta Tags: prep time & spice */}
        <View style={styles.dishMetaRow}>
          <Text style={styles.dishMetaTag}>⏱️ ~{item.prepTimeMinutes || 15}m</Text>
          {item.spiceLevel && item.spiceLevel !== 'none' ? (
            <Text style={styles.dishMetaTag}>
              🌶️ {item.spiceLevel.toUpperCase()}
            </Text>
          ) : null}
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <View style={styles.priceValues}>
            <Text style={styles.dishPrice}>₹{effectivePrice}</Text>
            {item.discountedPrice &&
            Number(item.discountedPrice) > 0 &&
            item.price > item.discountedPrice ? (
              <Text style={styles.dishOriginalPrice}>₹{item.price}</Text>
            ) : null}
          </View>
          <DiscountBadge
            price={item.price}
            discountedPrice={item.discountedPrice}
            style={styles.dishDiscountBadge}
          />
        </View>
      </View>

      {/* Right side: Image & Add button overlay */}
      <View style={styles.dishImageCol}>
        {item.images && item.images[0] ? (
          <OptimizedImage
            src={item.images[0]}
            alt={item.name}
            preset="card"
            style={styles.dishImage}
            contentFit="cover"
          />
        ) : (
          <View style={styles.dishImagePlaceholder}>
            <MaterialIcons name="image" size={36} color={Colors.textMuted} />
          </View>
        )}

        <View style={styles.dishAddBtnContainer}>
          {qty > 0 ? (
            <View style={styles.stepperBox}>
              <Pressable style={styles.stepperBtn} onPress={handleMinus}>
                <MaterialIcons name="remove" size={15} color={Colors.primary} />
              </Pressable>
              <Text style={styles.stepperQtyText}>{qty}</Text>
              <Pressable style={styles.stepperBtn} onPress={handlePlus}>
                <MaterialIcons name="add" size={15} color={Colors.primary} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[
                styles.addBtn,
                isItemDisabled && styles.addBtnDisabled,
              ]}
              disabled={isItemDisabled}
              onPress={handleAdd}
            >
              <Text
                style={[
                  styles.addBtnText,
                  isItemDisabled && styles.addBtnTextDisabled,
                ]}
              >
                {!item.isAvailable ? 'OOS' : 'ADD'}
              </Text>
              {!isItemDisabled ? (
                <MaterialIcons
                  name="add"
                  size={14}
                  color={Colors.primary}
                  style={styles.addBtnPlusIcon}
                />
              ) : null}
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export const RestaurantDishRow = React.memo(
  RestaurantDishRowComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.item._id === nextProps.item._id &&
      prevProps.effectivePrice === nextProps.effectivePrice &&
      prevProps.qty === nextProps.qty &&
      prevProps.isItemDisabled === nextProps.isItemDisabled &&
      prevProps.isLastItem === nextProps.isLastItem
    );
  }
);

export default RestaurantDishRow;

const styles = StyleSheet.create({
  dishCard: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
  },
  dishCardLast: {
    borderBottomWidth: 0,
  },
  dishInfoCol: {
    flex: 1,
  },
  vegIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  vegIndicatorBox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegIndicatorCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bestsellerChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bestsellerChipText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    color: '#B45309',
  },
  dishName: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  dishDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  dishMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dishMetaTag: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.xs,
  },
  priceValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  dishDiscountBadge: {
    marginLeft: 'auto',
    alignSelf: 'flex-end',
  },
  dishPrice: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  dishOriginalPrice: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  dishImageCol: {
    width: 136,
    alignItems: 'center',
    paddingBottom: 4,
  },
  dishImage: {
    width: 136,
    height: 136,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceMuted,
  },
  dishImagePlaceholder: {
    width: 136,
    height: 136,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dishAddBtnContainer: {
    marginTop: -20,
    zIndex: 10,
    elevation: 4,
    alignItems: 'center',
  },
  addBtn: {
    width: 100,
    height: 38,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Shadows.sm,
    elevation: 3,
  },
  addBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
    elevation: 0,
  },
  addBtnText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  addBtnTextDisabled: {
    color: Colors.textMuted,
  },
  addBtnPlusIcon: {
    position: 'absolute',
    top: 2,
    right: 4,
  },
  stepperBox: {
    width: 100,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 4,
    ...Shadows.sm,
    elevation: 3,
  },
  stepperBtn: {
    width: 28,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQtyText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    paddingHorizontal: 2,
  },
});
