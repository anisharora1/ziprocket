import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  RefreshControl,
  StyleSheet,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../src/context/AuthContext';
import { apiClient, isNetworkError } from '../../src/services/api';
import { useIsOnline, getIsOnline } from '../../src/services/network';
import OfflineState from '../../src/components/OfflineState';
import { useCustomerOrders } from '../../src/hooks/useOrders';
import { useOrderSocket } from '../../src/hooks/useOrderSocket';
import { useKeyboardHeight } from '../../src/hooks';
import Header from '../../src/components/Header';
import {
  Colors,
  Spacing,
  BorderRadius,
  Typography,
  Shadows,
  FontFamily,
} from '../../src/constants/theme';

const TRACKING_STEPS = [
  { id: 0, title: 'Confirming Order', description: 'Verifying your order details...', icon: 'hourglass-top' as const },
  { id: 1, title: 'Order Placed', description: 'We have received your order', icon: 'receipt-long' as const },
  { id: 2, title: 'Preparing Order', description: 'Your order is being prepared in the kitchen', icon: 'restaurant' as const },
  { id: 3, title: 'Out for Delivery', description: 'Delivery partner is on the way to you', icon: 'two-wheeler' as const },
  { id: 4, title: 'Delivered', description: 'Enjoy your items!', icon: 'check-circle' as const },
];

const CANCEL_REASONS = [
  'Ordered by mistake',
  'Wrong address',
  'Changed mind',
  'Found cheaper option',
  'Other',
];

export default function OrdersScreen() {
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('Ordered by mistake');
  const [otherReasonText, setOtherReasonText] = useState('');
  const [cancellingLoader, setCancellingLoader] = useState(false);

  const isOnline = useIsOnline();

  // TanStack Query
  const {
    data: orders = [],
    isLoading: ordersLoading,
    isError: ordersError,
    fetchStatus: ordersFetchStatus,
    refetch,
    isRefetching,
  } = useCustomerOrders(user?._id);

  const loading = authLoading || ordersLoading;

  const invalidateOrders = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orders', 'customer', user?._id] });
  }, [queryClient, user?._id]);

  // Live real-time socket tracking for customer orders
  useOrderSocket({
    onNewOrder: () => {
      invalidateOrders();
    },
    onOrderStatusUpdated: (data) => {
      if (data?.orderId && data?.orderStatus) {
        queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
          prev.map((o) => (o._id === data.orderId ? { ...o, orderStatus: data.orderStatus } : o))
        );
        invalidateOrders();
      }
    },
    onDeliveryStatusUpdated: (data) => {
      if (data?.orderId && data?.status) {
        queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
          prev.map((o) => (o._id === data.orderId ? { ...o, orderStatus: data.status } : o))
        );
        invalidateOrders();
      }
    },
    onDeliveryAccepted: (data) => {
      if (data?.orderId) {
        queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
          prev.map((o) => (o._id === data.orderId ? { ...o, orderStatus: 'accepted_by_delivery' } : o))
        );
        invalidateOrders();
      }
    },
    onOrderDelivered: (data) => {
      if (data?.orderId) {
        queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
          prev.map((o) => (o._id === data.orderId ? { ...o, orderStatus: 'delivered' } : o))
        );
        invalidateOrders();
      }
    },
    onOrderCancelled: (data) => {
      if (data?.orderId) {
        queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
          prev.map((o) => (o._id === data.orderId ? { ...o, orderStatus: 'cancelled' } : o))
        );
        invalidateOrders();
      }
    },
    onPaymentStatusUpdated: (data) => {
      if (data?.orderId && data?.paymentStatus) {
        queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
          prev.map((o) => (o._id === data.orderId ? { ...o, paymentStatus: data.paymentStatus } : o))
        );
        invalidateOrders();
      }
    },
    onReconnect: () => {
      invalidateOrders();
    },
  });

  const getStatusStep = (status: string) => {
    switch (status) {
      case 'pending':
        return 0;
      case 'placed':
        return 1;
      case 'accepted':
      case 'preparing':
        return 2;
      case 'accepted_by_delivery':
      case 'on_the_way':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 0;
    }
  };

  const getItemsSummary = (items: any[], orderType: string) => {
    if (!items || items.length === 0) return 'Items loaded';
    return items
      .map((item) => {
        const name = orderType === 'food' ? item.menuItem?.name : item.groceryItem?.name;
        return `${item.quantity}x ${name || 'Item'}`;
      })
      .join(', ');
  };

  const handleOpenCancelModal = (orderId: string) => {
    setCancellingOrderId(orderId);
    setCancelReason('Ordered by mistake');
    setOtherReasonText('');
    setIsCancelModalOpen(true);
  };

  const handleCancelOrderSubmit = async () => {
    if (!cancellingOrderId) return;
    if (!getIsOnline()) {
      Alert.alert('Offline', "You're offline. Connect to the internet to cancel your order.");
      return;
    }
    setCancellingLoader(true);
    try {
      const finalReason = cancelReason === 'Other' ? otherReasonText : cancelReason;
      const res = await apiClient.patch(`/orders/${cancellingOrderId}/cancel`, {
        reason: finalReason,
      });
      if (res.data.success) {
        Alert.alert('Order Cancelled', 'Order safalta-purvak cancel ho gaya!');
        setIsCancelModalOpen(false);
        setCancellingOrderId(null);
        queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
          prev.map((o) => (o._id === cancellingOrderId ? { ...o, orderStatus: 'cancelled' } : o))
        );
        invalidateOrders();
      }
    } catch (err: any) {
      if (!isNetworkError(err)) {
        console.warn('Failed to cancel order:', err);
      }
      Alert.alert(
        'Error',
        isNetworkError(err)
          ? "You're offline. Connect to the internet to cancel your order."
          : err.response?.data?.message || 'Order cancel karne me samasya aayi.'
      );
    } finally {
      setCancellingLoader(false);
    }
  };

  const handleRateOrder = async (orderId: string, star: number) => {
    if (!getIsOnline()) {
      Alert.alert('Offline', "You're offline. Connect to the internet to rate your order.");
      return;
    }
    try {
      const res = await apiClient.patch(`/orders/${orderId}/rate`, { rating: star });
      if (res.data.success) {
        queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
          prev.map((o: any) => (o._id === orderId ? { ...o, rating: star } : o))
        );
        invalidateOrders();
      }
    } catch (err: any) {
      if (!isNetworkError(err)) {
        console.warn('Failed to rate order:', err);
      }
      Alert.alert(
        'Error',
        isNetworkError(err)
          ? "You're offline. Connect to the internet to rate your order."
          : err.response?.data?.message || 'Rating submit nahi ho payi.'
      );
    }
  };

  // Active vs Past
  const activeOrders = orders.filter((o) =>
    ['pending', 'placed', 'accepted', 'preparing', 'accepted_by_delivery', 'on_the_way'].includes(
      o.orderStatus || o.status
    )
  );
  const pastOrders = orders.filter((o) =>
    ['delivered', 'cancelled'].includes(o.orderStatus || o.status)
  );

  const currentActiveOrder = activeOrders[0];
  const activeStep = currentActiveOrder
    ? getStatusStep(currentActiveOrder.orderStatus || currentActiveOrder.status)
    : 0;

  if (user && orders.length === 0 && (!isOnline || ordersFetchStatus === 'paused' || ordersError)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <OfflineState onRetry={refetch} />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.guestContainer}>
          <View style={styles.guestCard}>
            <View style={styles.guestIconCircle}>
              <MaterialIcons name="account-circle" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.guestTitle}>Access Order History</Text>
            <Text style={styles.guestSubtitle}>
              Apne live orders aur purane sabhi orders dekhne ke liye account me login karein.
            </Text>
            <Pressable
              style={styles.guestLoginButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.guestLoginButtonText}>LOG IN</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />

      <FlatList
        data={pastOrders}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Your Orders</Text>

            {/* Multiple Active Orders Notification Alert */}
            {activeOrders.length > 1 && (
              <View style={styles.alertBanner}>
                <MaterialIcons name="info" size={20} color={Colors.warning} />
                <Text style={styles.alertText}>
                  Aapke abhi {activeOrders.length} active orders hain. Niche sabse naye order ka live status hai.
                </Text>
              </View>
            )}

            {/* Active Order Section */}
            {currentActiveOrder && (
              <View style={styles.activeSection}>
                <View style={styles.sectionTitleRow}>
                  <MaterialIcons name="access-time" size={20} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Active Order</Text>
                </View>

                <View style={styles.activeCard}>
                  {/* Active Header */}
                  <View style={styles.activeCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderIdText}>
                        ID: #ORD-{currentActiveOrder._id.substring(currentActiveOrder._id.length - 6).toUpperCase()}
                      </Text>
                      <Text style={styles.activeRestaurantName}>
                        {currentActiveOrder.orderType === 'food'
                          ? currentActiveOrder.restaurant?.name || 'Restaurant Partner'
                          : 'ZipGrocery Delivery'}
                      </Text>
                      <Text style={styles.itemsSummary}>
                        {getItemsSummary(currentActiveOrder.items, currentActiveOrder.orderType)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.activeAmount}>
                        ₹{currentActiveOrder.totalAmount?.toLocaleString()}
                      </Text>
                      <Text style={styles.orderTimeText}>
                        {new Date(currentActiveOrder.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* Delivery Confirmation OTP for Prepaid (ONLINE) Orders */}
                  {currentActiveOrder.paymentMethod === 'ONLINE' &&
                    (currentActiveOrder.orderStatus === 'on_the_way' ||
                      currentActiveOrder.orderStatus === 'accepted_by_delivery') &&
                    currentActiveOrder.deliveryOtp && (
                      <View style={styles.otpBanner}>
                        <Text style={styles.otpBannerLabel}>
                          Yeh OTP delivery partner ko delivery ke samay batayein
                        </Text>
                        <Text style={styles.otpCode}>{currentActiveOrder.deliveryOtp}</Text>
                      </View>
                    )}

                  {/* Vertical Tracking Stepper */}
                  <View style={styles.trackingContainer}>
                    {TRACKING_STEPS.map((step, index) => {
                      const isActiveStep = activeStep === step.id;
                      const isCompleted = activeStep > step.id;
                      const isPending = activeStep < step.id;

                      return (
                        <View key={step.id} style={styles.stepRow}>
                          <View style={styles.stepIndicatorCol}>
                            <View
                              style={[
                                styles.stepCircle,
                                isCompleted && styles.stepCircleCompleted,
                                isActiveStep && styles.stepCircleActive,
                                isPending && styles.stepCirclePending,
                              ]}
                            >
                              <MaterialIcons
                                name={step.icon}
                                size={14}
                                color={isPending ? Colors.textMuted : Colors.white}
                              />
                            </View>
                            {index < TRACKING_STEPS.length - 1 && (
                              <View
                                style={[
                                  styles.stepConnector,
                                  isCompleted && styles.stepConnectorCompleted,
                                ]}
                              />
                            )}
                          </View>

                          <View style={[styles.stepTextContainer, isPending && { opacity: 0.4 }]}>
                            <Text
                              style={[
                                styles.stepTitle,
                                isActiveStep && { color: Colors.primary },
                              ]}
                            >
                              {step.title}
                            </Text>
                            <Text style={styles.stepDescription}>{step.description}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.activeActionsRow}>
                    <Pressable
                      style={styles.supportButton}
                      onPress={() =>
                        Linking.openURL(
                          `tel:${currentActiveOrder.restaurant?.phone || '9117662441'}`
                        )
                      }
                    >
                      <Text style={styles.supportButtonText}>CONTACT SUPPORT</Text>
                    </Pressable>

                    {['pending', 'placed'].includes(currentActiveOrder.orderStatus) &&
                      currentActiveOrder.paymentMethod === 'COD' && (
                        <Pressable
                          style={styles.cancelButton}
                          onPress={() => handleOpenCancelModal(currentActiveOrder._id)}
                        >
                          <Text style={styles.cancelButtonText}>CANCEL ORDER</Text>
                        </Pressable>
                      )}
                  </View>
                </View>
              </View>
            )}

            {/* Empty State when no orders exist at all */}
            {orders.length === 0 && (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <MaterialIcons name="receipt-long" size={40} color={Colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>Koi Order Nahi Mila</Text>
                <Text style={styles.emptySubtitle}>
                  Aapne abhi tak koi grocery ya food order nahi kiya hai. Apni pasand ka samaan order karein!
                </Text>
                <Pressable
                  style={styles.orderNowButton}
                  onPress={() => router.push('/(tabs)/home')}
                >
                  <Text style={styles.orderNowButtonText}>ORDER NOW</Text>
                </Pressable>
              </View>
            )}

            {/* Past Orders Heading */}
            {pastOrders.length > 0 && (
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="history" size={20} color={Colors.textMuted} />
                <Text style={styles.sectionTitle}>Purane Orders</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item: order }) => {
          const isCancelled = order.orderStatus === 'cancelled';
          const summary = getItemsSummary(order.items, order.orderType);

          return (
            <View style={styles.pastOrderCard}>
              <View style={styles.pastCardHeader}>
                <View
                  style={[
                    styles.statusPill,
                    isCancelled ? styles.statusPillCancelled : styles.statusPillDelivered,
                  ]}
                >
                  <MaterialIcons
                    name={isCancelled ? 'cancel' : 'check-circle'}
                    size={12}
                    color={isCancelled ? Colors.error : Colors.success}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isCancelled ? Colors.error : Colors.success },
                    ]}
                  >
                    {order.orderStatus || order.status}
                  </Text>
                </View>

                <Text style={styles.pastDateText}>
                  {new Date(order.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              <Text style={styles.pastRestaurantName}>
                {order.orderType === 'food'
                  ? order.restaurant?.name || 'Restaurant Partner'
                  : 'ZipGrocery Basket'}
              </Text>
              <Text style={styles.pastSummaryText}>{summary}</Text>

              {/* Rating Section */}
              {!isCancelled && order.orderType === 'food' && !order.rating && (
                <View style={styles.ratingRow}>
                  <Text style={styles.ratingPromptText}>Order ko star dein:</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Pressable key={star} onPress={() => handleRateOrder(order._id, star)}>
                        <Text style={styles.starIcon}>★</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {!isCancelled && order.rating && (
                <View style={styles.ratingRow}>
                  <Text style={styles.ratedText}>
                    Aapki rating: {'★'.repeat(order.rating)}
                    {'☆'.repeat(5 - order.rating)}
                  </Text>
                </View>
              )}

              <View style={styles.pastFooter}>
                <View>
                  <Text style={styles.pastAmount}>₹{order.totalAmount?.toLocaleString()}</Text>
                  {order.paymentMethod === 'ONLINE' && (
                    <Text
                      style={[
                        styles.paymentStatusText,
                        {
                          color:
                            order.paymentStatus === 'paid' ? Colors.success : Colors.error,
                        },
                      ]}
                    >
                      {order.paymentStatus === 'paid' ? 'PAID' : 'BAKI (UNPAID)'}
                    </Text>
                  )}
                </View>

                <Pressable
                  style={styles.reorderButton}
                  onPress={() => {
                    if (order.orderType === 'food' && order.restaurant?._id) {
                      router.push(`/restaurants/${order.restaurant._id}` as any);
                    } else {
                      router.push('/grocery' as any);
                    }
                  }}
                >
                  <MaterialIcons name="refresh" size={14} color={Colors.textSecondary} />
                  <Text style={styles.reorderButtonText}>REORDER</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {/* Cancellation Dialog Modal */}
      <Modal
        visible={isCancelModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsCancelModalOpen(false)}
      >
        <View style={[styles.modalOverlay, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (keyboardHeight > 0) {
                Keyboard.dismiss();
              } else {
                setIsCancelModalOpen(false);
              }
            }}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconCircle}>
                <MaterialIcons name="cancel" size={24} color={Colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Order Cancel Karein</Text>
                <Text style={styles.modalSubtitle}>
                  Kya aap sach me is order ko cancel karna chahte hain? Confirm hone ke baad ise wapas nahi kiya ja sakta.
                </Text>
              </View>
            </View>

            <Text style={styles.reasonLabel}>CANCEL KARNE KI WAJAH CHUNEIN</Text>
            {CANCEL_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={[
                  styles.reasonOption,
                  cancelReason === reason && styles.reasonOptionSelected,
                ]}
                onPress={() => setCancelReason(reason)}
              >
                <Text
                  style={[
                    styles.reasonOptionText,
                    cancelReason === reason && styles.reasonOptionTextSelected,
                  ]}
                >
                  {reason}
                </Text>
                {cancelReason === reason && (
                  <MaterialIcons name="check-circle" size={16} color={Colors.primary} />
                )}
              </Pressable>
            ))}

            {cancelReason === 'Other' && (
              <TextInput
                value={otherReasonText}
                onChangeText={setOtherReasonText}
                placeholder="Apni wajah yahan likhein..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={2}
                style={styles.otherTextInput}
              />
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.keepButton}
                onPress={() => {
                  setIsCancelModalOpen(false);
                  setCancellingOrderId(null);
                }}
              >
                <Text style={styles.keepButtonText}>NO, KEEP</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmCancelButton,
                  cancellingLoader && { opacity: 0.6 },
                ]}
                onPress={handleCancelOrderSubmit}
                disabled={cancellingLoader || (cancelReason === 'Other' && !otherReasonText.trim())}
              >
                {cancellingLoader ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmCancelButtonText}>YES, CANCEL</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl * 2,
    paddingTop: Spacing.sm,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  pageTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xxl,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  alertText: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: '#92400E',
    lineHeight: 18,
  },
  activeSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  activeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  orderIdText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  activeRestaurantName: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
  },
  itemsSummary: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  activeAmount: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.base,
    color: Colors.primary,
  },
  orderTimeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  otpBanner: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  otpBannerLabel: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  otpCode: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    color: Colors.primary,
    letterSpacing: 8,
  },
  trackingContainer: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 28,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCompleted: {
    backgroundColor: Colors.success,
  },
  stepCircleActive: {
    backgroundColor: Colors.primary,
  },
  stepCirclePending: {
    backgroundColor: Colors.borderLight,
  },
  stepConnector: {
    width: 2,
    height: 32,
    backgroundColor: Colors.borderLight,
  },
  stepConnectorCompleted: {
    backgroundColor: Colors.success,
  },
  stepTextContainer: {
    flex: 1,
    paddingBottom: Spacing.sm,
  },
  stepTitle: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
  },
  stepDescription: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  activeActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  supportButton: {
    flex: 1,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  supportButtonText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    letterSpacing: 0.5,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  guestCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    ...Shadows.sm,
  },
  guestIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  guestTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  guestSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  guestLoginButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  guestLoginButtonText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    letterSpacing: 1,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.xl,
    alignItems: 'center',
    marginVertical: Spacing.lg,
    ...Shadows.sm,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  orderNowButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  orderNowButtonText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    letterSpacing: 1,
  },
  pastOrderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  pastCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: Spacing.xs + 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusPillDelivered: {
    backgroundColor: '#ECFDF5',
  },
  statusPillCancelled: {
    backgroundColor: '#FEF2F2',
  },
  statusPillText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pastDateText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.textMuted,
  },
  pastRestaurantName: {
    fontFamily: FontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  pastSummaryText: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: Spacing.xs,
  },
  ratingPromptText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  starIcon: {
    fontSize: 18,
    color: Colors.warning,
  },
  ratedText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  pastFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  pastAmount: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  paymentStatusText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
  },
  reorderButtonText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  modalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  reasonLabel: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  reasonOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
  },
  reasonOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  reasonOptionText: {
    fontFamily: FontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  reasonOptionTextSelected: {
    color: Colors.primary,
  },
  otherTextInput: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  keepButton: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.lg,
  },
  keepButtonText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  confirmCancelButton: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.lg,
  },
  confirmCancelButtonText: {
    fontFamily: FontFamily.extraBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    letterSpacing: 0.5,
  },
});
