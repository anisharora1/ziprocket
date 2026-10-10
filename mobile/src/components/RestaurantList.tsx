import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import { Restaurant } from '../types';
import { Colors, Spacing, BorderRadius, Typography, FontFamily, Shadows } from '../constants/theme';

interface RestaurantListProps {
  restaurants: Restaurant[];
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
        {restaurants.map((restaurant) => {
          const isCurrentlyOpen = restaurant.isCurrentlyOpen !== false && restaurant.availabilityStatus !== 'closed';
          const bannerImg =
            restaurant.popularItems?.[0]?.images?.[0] ||
            'https://images.unsplash.com/photo-1504674900247-0877df9cc836';

          return (
            <Pressable
              key={restaurant._id}
              style={[
                styles.card,
                !isCurrentlyOpen && styles.closedCard,
              ]}
              onPress={() => router.push(`/restaurants/${restaurant._id}` as any)}
            >
              {/* Image banner */}
              <View style={styles.imageBox}>
                <OptimizedImage
                  src={bannerImg}
                  alt={restaurant.name}
                  preset="card"
                  style={styles.cardImage}
                  contentFit="cover"
                />

                {/* Status Badge */}
                <View
                  style={[
                    styles.statusBadge,
                    isCurrentlyOpen ? styles.openBadge : styles.closedBadge,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {isCurrentlyOpen ? 'OPEN NOW' : 'CLOSED'}
                  </Text>
                </View>

                {/* Delivery Time Badge */}
                <View style={styles.deliveryTimeBadge}>
                  <Text style={styles.deliveryTimeText}>25-35 mins</Text>
                </View>

                {/* Closed dark overlay if not currently open */}
                {!isCurrentlyOpen && (
                  <View style={styles.closedOverlay}>
                    <View style={styles.closedPill}>
                      <Text style={styles.closedPillText}>Closed</Text>
                    </View>
                  </View>
                )}
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
    ...Shadows.sm,
  },
  closedCard: {
    opacity: 0.8,
  },
  imageBox: {
    height: 160,
    backgroundColor: Colors.surfaceMuted,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.md,
  },
  openBadge: {
    backgroundColor: Colors.primary,
  },
  closedBadge: {
    backgroundColor: Colors.error,
  },
  statusBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deliveryTimeBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    zIndex: 10,
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  closedPill: {
    backgroundColor: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  closedPillText: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
  },
  cardBody: {
    padding: Spacing.md,
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
    marginVertical: Spacing.sm,
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
