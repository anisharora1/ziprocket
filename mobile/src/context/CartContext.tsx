import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { apiClient, isNetworkError } from '../services/api';
import { getIsOnline, onReconnect } from '../services/network';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  img?: string;
}

export interface CartState {
  items: CartItem[];
  vendorId: string | null;
  vendorName: string | null;
  orderType: 'food' | 'grocery' | null;
}

export interface AddToCartPayload {
  item: CartItem;
  vendorId: string;
  vendorName: string;
  orderType: 'food' | 'grocery';
}

export interface CartContextType {
  cart: CartState;
  addToCart: (payload: AddToCartPayload) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;

  // Replace alert state
  showReplaceAlert: boolean;
  pendingPayload: AddToCartPayload | null;
  confirmReplaceCart: () => void;
  cancelReplaceCart: () => void;
}

const STORAGE_KEY = 'ziprocket_cart';

// Session-level warning throttle for sync failures (at most once per session)
let hasWarnedSyncFailure = false;

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>({
    items: [],
    vendorId: null,
    vendorName: null,
    orderType: null,
  });

  const [showReplaceAlert, setShowReplaceAlert] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<AddToCartPayload | null>(null);

  const hasLoadedRef = useRef(false);
  const cartVersionRef = useRef(0);
  const prevTokenRef = useRef<string | null>(null);
  const { token } = useAuth();

  // Helper to persist to AsyncStorage immediately (source of truth)
  const saveToLocalStorage = useCallback(async (cartState: CartState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cartState));
    } catch (e) {
      if (!hasWarnedSyncFailure) {
        console.warn('[Cart] Failed saving to AsyncStorage:', e);
      }
    }
  }, []);

  // 1. Initial boot: Always load from AsyncStorage first (offline-first source of truth)
  useEffect(() => {
    const initLocalCart = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setCart({
              items: Array.isArray(parsed.items) ? parsed.items : [],
              vendorId: parsed.vendorId || null,
              vendorName: parsed.vendorName || null,
              orderType: parsed.orderType || null,
            });
          }
        }
      } catch (e) {
        if (!hasWarnedSyncFailure) {
          console.warn('[Cart] Local cart read exception:', e);
        }
      } finally {
        hasLoadedRef.current = true;
      }
    };

    initLocalCart();
  }, []);

  // 2. Auth changes: sync with backend on login, clear on logout
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const hadToken = !!prevTokenRef.current;
    const hasToken = !!token;
    prevTokenRef.current = token;

    // Logout: Clear the cart state and storage
    if (hadToken && !hasToken) {
      cartVersionRef.current += 1;
      const emptyState: CartState = {
        items: [],
        vendorId: null,
        vendorName: null,
        orderType: null,
      };
      setCart(emptyState);
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      return;
    }

    // Login: Real token is now available, sync/merge with backend
    if (hasToken) {
      const syncOnLogin = async () => {
        const currentVersion = cartVersionRef.current;
        try {
          const res = await apiClient.get('/cart');
          // Safeguard: Discard response if user mutated cart while in flight
          if (cartVersionRef.current !== currentVersion) return;

          if (res.data?.success && res.data?.cart) {
            const backendCart = res.data.cart;
            const backendItems: CartItem[] = (backendCart.items || []).map((i: any) => ({
              id: i.itemId || i.id,
              name: i.name,
              price: Number(i.price),
              quantity: Number(i.quantity),
              img: i.img,
            }));

            setCart((currentLocalCart) => {
              // Case A: Local cart has items
              if (currentLocalCart.items.length > 0) {
                // If same vendor and orderType, merge items
                if (
                  backendCart.vendorId &&
                  currentLocalCart.vendorId === backendCart.vendorId &&
                  currentLocalCart.orderType === backendCart.orderType
                ) {
                  const mergedMap = new Map<string, CartItem>();
                  backendItems.forEach((item) => mergedMap.set(item.id, item));
                  currentLocalCart.items.forEach((item) => {
                    if (mergedMap.has(item.id)) {
                      const existing = mergedMap.get(item.id)!;
                      mergedMap.set(item.id, {
                        ...item,
                        quantity: Math.max(item.quantity, existing.quantity),
                      });
                    } else {
                      mergedMap.set(item.id, item);
                    }
                  });

                  const mergedState: CartState = {
                    items: Array.from(mergedMap.values()),
                    vendorId: currentLocalCart.vendorId,
                    vendorName: currentLocalCart.vendorName,
                    orderType: currentLocalCart.orderType,
                  };
                  saveToLocalStorage(mergedState);
                  return mergedState;
                }

                // If different vendors or backend is empty, keep current local cart
                saveToLocalStorage(currentLocalCart);
                return currentLocalCart;
              }

              // Case B: Local cart was empty, adopt backend cart if it has items
              if (backendItems.length > 0) {
                const newCartState: CartState = {
                  items: backendItems,
                  vendorId: backendCart.vendorId || null,
                  vendorName: backendCart.vendorName || null,
                  orderType: backendCart.orderType || null,
                };
                saveToLocalStorage(newCartState);
                return newCartState;
              }

              return currentLocalCart;
            });
          }
        } catch (err: any) {
          if (!hasWarnedSyncFailure && !isNetworkError(err)) {
            hasWarnedSyncFailure = true;
            console.warn('[Cart] Sync on login failed (operating in offline fallback):', err?.message);
          }
          // Never clear or overwrite local cart on failure
        }
      };

      syncOnLogin();
    }
  }, [token, saveToLocalStorage]);

  // Resync cart from backend when connection returns
  useEffect(() => {
    if (!token) return;
    const unsub = onReconnect(async () => {
      try {
        const res = await apiClient.get('/cart');
        if (res.data?.success && res.data?.cart) {
          const backendCart = res.data.cart;
          const backendItems: CartItem[] = (backendCart.items || []).map((i: any) => ({
            id: i.itemId || i.id,
            name: i.name,
            price: Number(i.price),
            quantity: Number(i.quantity),
            img: i.img,
          }));
          if (backendItems.length > 0) {
            setCart((currentLocalCart) => {
              if (currentLocalCart.items.length === 0) {
                const newCartState: CartState = {
                  items: backendItems,
                  vendorId: backendCart.vendorId || null,
                  vendorName: backendCart.vendorName || null,
                  orderType: backendCart.orderType || null,
                };
                saveToLocalStorage(newCartState);
                return newCartState;
              }
              return currentLocalCart;
            });
          }
        }
      } catch {}
    });
    return unsub;
  }, [token, saveToLocalStorage]);

  // 3. Debounced backend sync on cart changes (Only when real token exists)
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    // Immediately persist every state update locally
    saveToLocalStorage(cart);

    // If no authenticated token (guest), do NOT make any network calls to /cart
    if (!token) return;

    const currentVersion = cartVersionRef.current;
    const timeout = setTimeout(async () => {
      try {
        await apiClient.post('/cart', {
          items: cart.items,
          vendorId: cart.vendorId,
          vendorName: cart.vendorName,
          orderType: cart.orderType,
        });
      } catch (err: any) {
        if (cartVersionRef.current === currentVersion && !hasWarnedSyncFailure && !isNetworkError(err)) {
          hasWarnedSyncFailure = true;
          console.warn('[Cart] Background sync failed (retaining local state):', err?.message);
        }
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [cart, token, saveToLocalStorage]);

  const addToCart = (payload: AddToCartPayload) => {
    if (!getIsOnline()) {
      Alert.alert('Offline', "You're offline. Connect to the internet to update your cart.");
      return;
    }
    cartVersionRef.current += 1;

    // If cart is empty, simply initialize
    if (cart.items.length === 0) {
      setCart({
        items: [{ ...payload.item, quantity: 1 }],
        vendorId: payload.vendorId,
        vendorName: payload.vendorName,
        orderType: payload.orderType,
      });
      return;
    }

    // Rule: Reject if different vendor or different orderType
    if (cart.vendorId !== payload.vendorId || cart.orderType !== payload.orderType) {
      setPendingPayload(payload);
      setShowReplaceAlert(true);
      return;
    }

    // Same vendor: increment quantity or append item
    setCart((prev) => {
      const existingIndex = prev.items.findIndex((i) => i.id === payload.item.id);
      if (existingIndex >= 0) {
        const nextItems = [...prev.items];
        nextItems[existingIndex] = {
          ...nextItems[existingIndex],
          quantity: nextItems[existingIndex].quantity + 1,
        };
        return { ...prev, items: nextItems };
      }
      return {
        ...prev,
        items: [...prev.items, { ...payload.item, quantity: 1 }],
      };
    });
  };

  const confirmReplaceCart = () => {
    cartVersionRef.current += 1;
    if (pendingPayload) {
      setCart({
        items: [{ ...pendingPayload.item, quantity: 1 }],
        vendorId: pendingPayload.vendorId,
        vendorName: pendingPayload.vendorName,
        orderType: pendingPayload.orderType,
      });
      setPendingPayload(null);
      setShowReplaceAlert(false);
    }
  };

  const cancelReplaceCart = () => {
    setPendingPayload(null);
    setShowReplaceAlert(false);
  };

  const removeFromCart = (itemId: string) => {
    if (!getIsOnline()) {
      Alert.alert('Offline', "You're offline. Connect to the internet to update your cart.");
      return;
    }
    cartVersionRef.current += 1;
    setCart((prev) => {
      const nextItems = prev.items.filter((i) => i.id !== itemId);
      if (nextItems.length === 0) {
        return { items: [], vendorId: null, vendorName: null, orderType: null };
      }
      return { ...prev, items: nextItems };
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (!getIsOnline()) {
      Alert.alert('Offline', "You're offline. Connect to the internet to update your cart.");
      return;
    }
    cartVersionRef.current += 1;
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)),
    }));
  };

  const clearCart = () => {
    cartVersionRef.current += 1;
    setCart({ items: [], vendorId: null, vendorName: null, orderType: null });
  };

  const contextValue = useMemo(
    () => ({
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      showReplaceAlert,
      pendingPayload,
      confirmReplaceCart,
      cancelReplaceCart,
    }),
    [cart, showReplaceAlert, pendingPayload]
  );

  return (
    <CartContext.Provider value={contextValue}>
      {children}

      {/* Global Replace Cart Modal Alert */}
      <Modal
        visible={showReplaceAlert && !!pendingPayload}
        transparent
        animationType="fade"
        onRequestClose={cancelReplaceCart}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="remove-shopping-cart" size={32} color={Colors.error} />
            </View>
            <Text style={styles.modalTitle}>Replace cart item?</Text>
            <Text style={styles.modalBody}>
              Your cart contains items from{' '}
              <Text style={styles.boldText}>{cart.vendorName || 'another store'}</Text>. Do you
              want to discard them and add items from{' '}
              <Text style={styles.boldText}>{pendingPayload?.vendorName || 'this store'}</Text>?
            </Text>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.keepButton]}
                onPress={cancelReplaceCart}
              >
                <Text style={styles.keepButtonText}>No, keep it</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.replaceButton]}
                onPress={confirmReplaceCart}
              >
                <Text style={styles.replaceButtonText}>Yes, replace</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    width: '90%',
    maxWidth: 360,
    alignItems: 'center',
    ...Shadows.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.md,
    marginBottom: Spacing.lg,
  },
  boldText: {
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepButton: {
    backgroundColor: Colors.surfaceMuted,
  },
  keepButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
  },
  replaceButton: {
    backgroundColor: Colors.primary,
  },
  replaceButtonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.white,
  },
});
