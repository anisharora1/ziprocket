import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { apiClient } from '../services/api';
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
  const { user } = useAuth();

  // 1. Load cart on initial mount or when auth user changes
  useEffect(() => {
    const loadCart = async () => {
      if (user) {
        try {
          const res = await apiClient.get('/cart');
          if (res.data?.success && res.data?.cart) {
            const backendCart = res.data.cart;
            const formattedItems = (backendCart.items || []).map((i: any) => ({
              id: i.itemId || i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              img: i.img,
            }));
            setCart({
              items: formattedItems,
              vendorId: backendCart.vendorId || null,
              vendorName: backendCart.vendorName || null,
              orderType: backendCart.orderType || null,
            });
            return;
          }
        } catch (err) {
          console.warn('[Cart] Failed to load synced cart from backend:', err);
        }
      }

      // Guest or offline storage fallback
      try {
        const savedCart = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedCart) {
          const parsed = JSON.parse(savedCart);
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
        console.warn('[Cart] Failed to load local cart from AsyncStorage:', e);
      }
    };

    loadCart().then(() => {
      hasLoadedRef.current = true;
    });
  }, [user]);

  // 2. Persist to AsyncStorage and sync to backend (debounced)
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cart)).catch((e) => {
      console.warn('[Cart] Error saving to AsyncStorage:', e);
    });

    if (!user) return;

    const timeout = setTimeout(async () => {
      try {
        await apiClient.post('/cart', {
          items: cart.items,
          vendorId: cart.vendorId,
          vendorName: cart.vendorName,
          orderType: cart.orderType,
        });
      } catch (err) {
        console.warn('[Cart] Failed to sync cart to backend:', err);
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [cart, user]);

  const addToCart = (payload: AddToCartPayload) => {
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
    setCart((prev) => {
      const nextItems = prev.items.filter((i) => i.id !== itemId);
      if (nextItems.length === 0) {
        return { items: [], vendorId: null, vendorName: null, orderType: null };
      }
      return { ...prev, items: nextItems };
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
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
