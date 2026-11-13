import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import DiscountBadge from './DiscountBadge';
import { usePlatform } from '../context/PlatformContext';
import { useCartActions, useCartItemQuantity } from '../context/CartContext';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';

export interface Product {
  _id: string;
  name: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  price: number;
  discountedPrice?: number;
  stockQuantity: number;
  unit?: string;
  images?: string[];
  weightSize?: string;
  isAvailable?: boolean;
  offerBadge?: string;
}

export interface ProductCardProps {
  prod: Product;
  qty?: number;
  addToCart?: any;
  updateQuantity?: any;
}

function ProductCard({
  prod,
  qty: propQty,
  addToCart: propAddToCart,
  updateQuantity: propUpdateQuantity,
}: ProductCardProps) {
  const actions = useCartActions();
  const hookQty = useCartItemQuantity(`groc-${prod._id}`);
  const qty = propQty !== undefined ? propQty : hookQty;
  const addToCart = propAddToCart || actions.addToCart;
  const updateQuantity = propUpdateQuantity || actions.updateQuantity;

  const hasValidDiscount =
    prod.discountedPrice !== undefined &&
    prod.discountedPrice !== null &&
    Number(prod.discountedPrice) > 0 &&
    Number(prod.discountedPrice) < Number(prod.price);
  const currentPrice = hasValidDiscount ? Number(prod.discountedPrice) : Number(prod.price);
  const { isGroceryCurrentlyOpen } = usePlatform();
  const isGroceryOpen = isGroceryCurrentlyOpen();

  const isAvailable = prod.isAvailable !== false && prod.stockQuantity > 0 && isGroceryOpen;
  const imgUri = prod.images?.[0] || '';

  const handleDecrease = useCallback(() => {
    if (!isGroceryOpen) return;
    updateQuantity(`groc-${prod._id}`, qty - 1);
  }, [isGroceryOpen, updateQuantity, prod._id, qty]);

  const handleIncrease = useCallback(() => {
    if (!isGroceryOpen) return;
    if (qty >= prod.stockQuantity) {
      Alert.alert('Stock Limit', `Sorry! Only ${prod.stockQuantity} units available.`);
      return;
    }
    updateQuantity(`groc-${prod._id}`, qty + 1);
  }, [isGroceryOpen, qty, prod.stockQuantity, updateQuantity, prod._id]);

  const handleAdd = useCallback(() => {
    if (!isAvailable) return;
    addToCart({
      item: {
        id: `groc-${prod._id}`,
        name: prod.name,
        price: currentPrice,
        quantity: 1,
        img: imgUri,
      },
      vendorId: 'zip-grocery-hub',
      vendorName: 'ZipGrocery Stores',
      orderType: 'grocery',
    });
  }, [isAvailable, addToCart, prod._id, prod.name, currentPrice, imgUri]);

  return (
    <View style={styles.card}>
      {/* Optional offer badge */}
      {prod.offerBadge ? (
        <View style={styles.offerBadge}>
          <Text style={styles.offerBadgeText}>{prod.offerBadge}</Text>
        </View>
      ) : null}

      {/* Product Image Box */}
      <View style={styles.imageBox}>
        {imgUri ? (
          <OptimizedImage
            src={imgUri}
            alt={prod.name}
            preset="thumbnail"
            style={styles.productImage}
            contentFit="contain"
          />
        ) : (
          <MaterialIcons name="image" size={32} color={Colors.textMuted} />
        )}

        {/* Add / Qty controls overlay at bottom-right of image */}
        <View style={styles.cartControlOverlay}>
          {qty > 0 ? (
            <View style={styles.qtyControlBox}>
              <Pressable
                style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.85 }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={handleDecrease}
                disabled={!isGroceryOpen}
              >
                <MaterialIcons name="remove" size={14} color={Colors.primary} />
              </Pressable>
              <Text style={styles.qtyText}>{qty}</Text>
              <Pressable
                style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.85 }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={handleIncrease}
                disabled={!isGroceryOpen}
              >
                <MaterialIcons name="add" size={14} color={Colors.primary} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              disabled={!isAvailable}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.addBtn,
                !isAvailable && styles.disabledAddBtn,
                pressed && isAvailable && { opacity: 0.85 },
              ]}
              onPress={handleAdd}
            >
              <Text
                style={[
                  styles.addBtnText,
                  !isAvailable && styles.disabledAddBtnText,
                ]}
              >
                {!isGroceryOpen
                  ? 'Closed'
                  : !prod.isAvailable
                  ? 'Unavailable'
                  : prod.stockQuantity === 0
                  ? 'Out of Stock'
                  : 'Add'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Details Box */}
      <View style={styles.infoBox}>
        <Text style={styles.brandText} numberOfLines={1}>
          {prod.brand || 'Local Brand'}
        </Text>
        <Text style={styles.nameText} numberOfLines={2}>
          {prod.name}
        </Text>
        {prod.weightSize ? (
          <Text style={styles.weightText}>{prod.weightSize}</Text>
        ) : null}

        <View style={styles.priceRow}>
          <View style={styles.priceValues}>
            <Text style={styles.priceText}>₹{currentPrice}</Text>
            {hasValidDiscount ? (
              <Text style={styles.originalPriceText}>₹{prod.price}</Text>
            ) : null}
          </View>
          <DiscountBadge
            price={prod.price}
            discountedPrice={prod.discountedPrice}
            style={styles.discountBadge}
          />
        </View>
      </View>
    </View>
  );
}

const MemoizedProductCard = React.memo(ProductCard, (prevProps, nextProps) => {
  const prevPrice =
    prevProps.prod.discountedPrice !== undefined &&
    prevProps.prod.discountedPrice !== null &&
    Number(prevProps.prod.discountedPrice) > 0 &&
    Number(prevProps.prod.discountedPrice) < Number(prevProps.prod.price)
      ? Number(prevProps.prod.discountedPrice)
      : Number(prevProps.prod.price);

  const nextPrice =
    nextProps.prod.discountedPrice !== undefined &&
    nextProps.prod.discountedPrice !== null &&
    Number(nextProps.prod.discountedPrice) > 0 &&
    Number(nextProps.prod.discountedPrice) < Number(nextProps.prod.price)
      ? Number(nextProps.prod.discountedPrice)
      : Number(nextProps.prod.price);

  const prevAvail =
    prevProps.prod.isAvailable !== false && prevProps.prod.stockQuantity > 0;
  const nextAvail =
    nextProps.prod.isAvailable !== false && nextProps.prod.stockQuantity > 0;

  return (
    prevProps.prod._id === nextProps.prod._id &&
    prevPrice === nextPrice &&
    prevProps.qty === nextProps.qty &&
    prevAvail === nextAvail
  );
});

export default MemoizedProductCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    position: 'relative',
    ...Shadows.sm,
  },
  offerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: Colors.error,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  offerBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  imageBox: {
    height: 120,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    padding: Spacing.sm,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  cartControlOverlay: {
    position: 'absolute',
    bottom: -12,
    right: 8,
    zIndex: 20,
  },
  qtyControlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    paddingHorizontal: 4,
  },
  addBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  addBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  disabledAddBtn: {
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
  },
  disabledAddBtnText: {
    color: Colors.textMuted,
  },
  infoBox: {
    padding: Spacing.sm,
    paddingTop: Spacing.md,
  },
  brandText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  nameText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 18,
    minHeight: 36,
  },
  weightText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 'auto',
  },
  priceValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  priceText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  originalPriceText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    marginLeft: 'auto',
    alignSelf: 'flex-end',
  },
});
