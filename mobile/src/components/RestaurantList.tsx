import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import RestaurantCardCarousel from './RestaurantCardCarousel';
import { Restaurant } from '../types';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';
import { formatToAMPM, isWithinOperatingHours } from '../utils/restaurantHours';

interface RestaurantListProps {
  restaurants: Restaurant[];
}

function getFallbackImage(restaurant: Restaurant): string {
  if (restaurant.image) {
    if (typeof restaurant.image === 'string' && restaurant.image.trim()) {
      return restaurant.image.trim();
    }
    if (
      typeof restaurant.image === 'object' &&
      restaurant.image?.url &&
      typeof restaurant.image.url === 'string'
    ) {
      return restaurant.image.url.trim();
    }
  }
  return (
    restaurant.popularItems?.[0]?.images?.[0] ||
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836'
  );
}

export default function RestaurantList({ restaurants }: RestaurantListProps) {
  const router = useRouter();

  if (!restaurants || restaurants.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Restaurants</Text>

      <View style={styles.list}>
        {restaurants.map((restaurant, index) => {
          const isCurrentlyOpen =
            restaurant.isCurrentlyOpen !== undefined
              ? restaurant.isCurrentlyOpen
              : (restaurant.isActive !== false &&
                restaurant.availabilityStatus !== 'closed' &&
                isWithinOperatingHours(
                  restaurant.operatingHours?.open,
                  restaurant.operatingHours?.close
                ));

          const fallbackImg = getFallbackImage(restaurant);
          const openTimeFormatted = restaurant.operatingHours?.open
            ? formatToAMPM(restaurant.operatingHours.open)
            : '';

          return (
            <Pressable
              key={restaurant._id}
              style={[
                styles.card,
                !isCurrentlyOpen && styles.closedCard,
              ]}
              onPress={() => router.push(`/restaurants/${restaurant._id}` as any)}
            >
              {/* Image banner with dishes carousel */}
              <View style={styles.imageBox}>
                <RestaurantCardCarousel
                  items={restaurant.popularItems || []}
                  fallbackImage={fallbackImg}
                  restaurantName={restaurant.name}
                  cardIndex={index}
                  onPress={() => router.push(`/restaurants/${restaurant._id}` as any)}
                />

                {/* Delivery Time Badge */}
                <View style={styles.deliveryTimeBadge} pointerEvents="none">
                  <Text style={styles.deliveryTimeText}>25-35 mins</Text>
                </View>
              </View>

              {/* Card info */}
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.restaurantName} numberOfLines={1}>
                    {restaurant.name}
                  </Text>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>
                      {(Number(restaurant.rating) || 0) > 0
                        ? Number(restaurant.rating).toFixed(1)
                        : 'New'}
                    </Text>
                    <MaterialIcons name="star" size={12} color={Colors.primary} />
                  </View>
                </View>

                <Text style={styles.addressText} numberOfLines={1}>
                  {restaurant.location?.address || 'Address not provided'}
                </Text>

                <View style={styles.divider} />

                <View style={styles.ordersRow}>
                  <MaterialIcons name="store" size={14} color={Colors.textMuted} />
                  <Text style={styles.ordersText}>
                    {restaurant.totalOrders || 0} orders completed
                  </Text>
                </View>
              </View>

              {/* Closed overlay covering whole card (image + info area) */}
              {!isCurrentlyOpen && (
                <View style={styles.closedOverlay} pointerEvents="none">
                  <View style={styles.closedPill}>
                    <Text style={styles.closedPillText}>
                      Closed{openTimeFormatted ? ` · Opens at ${openTimeFormatted}` : ''}
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  list: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    position: 'relative',
    ...Shadows.sm,
  },
  closedCard: {
    opacity: 0.75,
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: Colors.surfaceMuted,
    position: 'relative',
    overflow: 'hidden',
  },
  deliveryTimeBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  deliveryTimeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  closedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  closedPill: {
    backgroundColor: Colors.slate900,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    ...Shadows.md,
  },
  closedPillText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
  cardBody: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  restaurantName: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1E6',
    borderWidth: 1,
    borderColor: '#FFE2CC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
    gap: 2,
  },
  ratingText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  addressText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.xs + 2,
  },
  ordersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ordersText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
});

