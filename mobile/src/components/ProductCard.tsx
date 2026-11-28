import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import DiscountBadge from './DiscountBadge';
import { getDiscountPercent } from '../utils/discount';
import { usePlatform } from '../context/PlatformContext';
import { useCartActions, useCartItemQuantity } from '../context/CartContext';
import { Colors, Spacing, BorderRadius, Typography, FontFamily } from '../constants/theme';

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

const STEPPER_HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };
const ADD_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

function formatWeightLabel(weightSize?: string, unit?: string): string | null {
  const trimmedWeight = weightSize?.trim();
  const trimmedUnit = unit?.trim();

  if (trimmedWeight) {
    if (/^\d+(\.\d+)?$/.test(trimmedWeight) && trimmedUnit) {
      return `${trimmedWeight} ${trimmedUnit}`;
    }
    return trimmedWeight;
  }

  if (trimmedUnit) {
    return trimmedUnit;
  }

  return null;
}

const getQtyBtnStyle = ({ pressed }: { pressed: boolean }) =>
  pressed ? [styles.qtyBtn, styles.qtyBtnPressed] : styles.qtyBtn;

const getAddBtnStyle = ({ pressed }: { pressed: boolean }) =>
  pressed ? [styles.addBtn, styles.addBtnPressed] : styles.addBtn;

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

  const isOutOfStock = prod.isAvailable === false || prod.stockQuantity <= 0;
  const isAvailable = !isOutOfStock && isGroceryOpen;
  const statusCaption = isOutOfStock
    ? 'Out of stock'
    : !isGroceryOpen
    ? 'Closed now'
    : null;
  const weightLabel = formatWeightLabel(prod.weightSize, prod.unit);
  const discountPercent = getDiscountPercent(prod.price, prod.discountedPrice);
  const cardAccessibilityLabel = [
    prod.name,
    weightLabel,
    `${currentPrice} rupees`,
    discountPercent > 0 ? `${discountPercent} percent off` : null,
    statusCaption,
  ]
    .filter(Boolean)
    .join(', ');
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
    <View style={styles.card} accessibilityLabel={cardAccessibilityLabel}>
      {/* Product Image Box */}
      <View style={styles.imageBox}>
        {/* Top-left discount ribbon and optional offer badge */}
        <View style={styles.topLeftBadges}>
          <DiscountBadge
            price={prod.price}
            discountedPrice={prod.discountedPrice}
            variant="ribbon"
          />
          {prod.offerBadge ? (
            <View style={styles.offerBadge}>
              <Text style={styles.offerBadgeText}>{prod.offerBadge}</Text>
            </View>
          ) : null}
        </View>

        {imgUri ? (
          <OptimizedImage
            src={imgUri}
            alt={prod.name}
            preset="product"
            style={[styles.productImage, isOutOfStock && styles.unavailableImage]}
            contentFit="contain"
          />
        ) : (
          <MaterialIcons
            name="image"
            size={32}
            color={Colors.textMuted}
            style={isOutOfStock ? styles.unavailableImage : undefined}
          />
        )}

        {/* Add / Qty controls inside image area at bottom-right */}
        {!isOutOfStock && isGroceryOpen && qty > 0 ? (
          <View style={styles.cartControlOverlay}>
            <View style={styles.qtyControlBox}>
              <Pressable
                style={getQtyBtnStyle}
                hitSlop={STEPPER_HIT_SLOP}
                onPress={handleDecrease}
                accessibilityRole="button"
                accessibilityLabel={`Decrease quantity of ${prod.name}`}
                accessibilityValue={{ now: qty, min: 0, max: prod.stockQuantity }}
              >
                <MaterialIcons name="remove" size={20} color={Colors.white} />
              </Pressable>
              <Text
                style={styles.qtyText}
                accessibilityValue={{ now: qty, min: 0, max: prod.stockQuantity }}
              >
                {qty}
              </Text>
              <Pressable
                style={getQtyBtnStyle}
                hitSlop={STEPPER_HIT_SLOP}
                onPress={handleIncrease}
                accessibilityRole="button"
                accessibilityLabel={`Increase quantity of ${prod.name}`}
                accessibilityValue={{ now: qty, min: 0, max: prod.stockQuantity }}
              >
                <MaterialIcons
                  name="add"
                  size={20}
                  color={Colors.white}
                  style={qty >= prod.stockQuantity ? styles.dimmedIcon : undefined}
                />
              </Pressable>
            </View>
          </View>
        ) : !isOutOfStock ? (
          <View style={styles.cartControlOverlay}>
            <Pressable
              disabled={!isAvailable}
              hitSlop={ADD_HIT_SLOP}
              style={isAvailable ? getAddBtnStyle : styles.disabledAddBtn}
              onPress={handleAdd}
              accessibilityRole="button"
              accessibilityLabel={`Add ${prod.name}`}
              accessibilityState={{ disabled: !isAvailable }}
            >
              <Text
                style={[
                  styles.addBtnText,
                  !isAvailable && styles.disabledAddBtnText,
                ]}
              >
                ADD
              </Text>
              <MaterialIcons
                name="add"
                size={18}
                color={isAvailable ? Colors.primary : Colors.textMuted}
              />
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Details Box */}
      <View style={styles.infoBox}>
        {prod.brand ? (
          <Text style={styles.brandText} numberOfLines={1}>
            {prod.brand}
          </Text>
        ) : null}
        <Text style={styles.nameText} numberOfLines={2}>
          {prod.name}
        </Text>
        {weightLabel ? (
          <Text style={styles.weightText} numberOfLines={1}>
            {weightLabel}
          </Text>
        ) : null}
        {statusCaption ? (
          <Text style={styles.statusCaption} numberOfLines={1}>
            {statusCaption}
          </Text>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={styles.priceText}>₹{currentPrice}</Text>
          {hasValidDiscount ? (
            <Text style={styles.originalPriceText}>₹{prod.price}</Text>
          ) : null}
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
    prevProps.prod.name === nextProps.prod.name &&
    prevProps.prod.unit === nextProps.prod.unit &&
    prevProps.prod.weightSize === nextProps.prod.weightSize &&
    prevPrice === nextPrice &&
    prevProps.qty === nextProps.qty &&
    prevAvail === nextAvail
  );
});

export default MemoizedProductCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    position: 'relative',
  },
  topLeftBadges: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  offerBadge: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.xs + 1,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  offerBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xs,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  unavailableImage: {
    opacity: 0.45,
  },
  cartControlOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    zIndex: 20,
  },
  qtyBtnPressed: {
    opacity: 0.75,
  },
  addBtnPressed: {
    backgroundColor: Colors.primaryAlpha10,
    opacity: 0.9,
  },
  dimmedIcon: {
    opacity: 0.5,
  },
  qtyControlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
    width: 88,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 32,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.md + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    textAlign: 'center',
    minWidth: 24,
  },
  addBtn: {
    flexDirection: 'row',
    height: 36,
    minWidth: 76,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  disabledAddBtn: {
    flexDirection: 'row',
    height: 36,
    minWidth: 76,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  disabledAddBtnText: {
    color: Colors.textMuted,
  },
  infoBox: {
    padding: Spacing.sm,
  },
  brandText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  nameText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 17,
    minHeight: 34,
  },
  weightText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusCaption: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textMuted,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  priceText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.md + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  originalPriceText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
