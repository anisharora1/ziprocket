import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useSyncExternalStore,
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
  groceryItems: CartItem[];
  vendorId: string | null;
  vendorName: string | null;
  orderType: 'food' | 'grocery' | null;
  isMixed: boolean;
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
  getItemQuantity: (itemId: string) => number;
}

export interface CartActionsType {
  addToCart: (payload: AddToCartPayload) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  confirmReplaceCart: () => void;
  cancelReplaceCart: () => void;
}

const STORAGE_KEY = 'ziprocket_cart';

// Session-level warning throttle for sync failures (at most once per session)
let hasWarnedSyncFailure = false;

const CartContext = createContext<CartContextType | undefined>(undefined);
const CartActionsContext = createContext<CartActionsType | undefined>(undefined);

// External store for selective item subscriptions without full re-renders
type CartListener = () => void;
const cartStoreListeners = new Set<CartListener>();

let cartStoreSnapshot: CartState = {
  items: [],
  groceryItems: [],
  vendorId: null,
  vendorName: null,
  orderType: null,
  isMixed: false,
};

function subscribeToCartStore(listener: CartListener) {
  cartStoreListeners.add(listener);
  return () => {
    cartStoreListeners.delete(listener);
  };
}

function updateCartStoreSnapshot(newCart: CartState) {
  cartStoreSnapshot = newCart;
  cartStoreListeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

function computeIsMixed(orderType: string | null, items: CartItem[], groceryItems: CartItem[]): boolean {
  return Boolean(orderType === 'food' && items.length > 0 && groceryItems.length > 0);
}

function mergeItemList(localList: CartItem[], backendList: CartItem[]): CartItem[] {
  const mergedMap = new Map<string, CartItem>();
  backendList.forEach((item) => mergedMap.set(item.id, item));
  localList.forEach((item) => {
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
  return Array.from(mergedMap.values());
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>({
    items: [],
    groceryItems: [],
    vendorId: null,
    vendorName: null,
    orderType: null,
    isMixed: false,
  });

  const [showReplaceAlert, setShowReplaceAlert] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<AddToCartPayload | null>(null);

  const hasLoadedRef = useRef(false);
  const cartVersionRef = useRef(0);
  const prevTokenRef = useRef<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    updateCartStoreSnapshot(cart);
  }, [cart]);

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
            const loadedItems: CartItem[] = Array.isArray(parsed.items) ? parsed.items : [];
            const loadedGroceryItems: CartItem[] = Array.isArray(parsed.groceryItems) ? parsed.groceryItems : [];
            const loadedOrderType = parsed.orderType || null;
            const initialState: CartState = {
              items: loadedItems,
              groceryItems: loadedGroceryItems,
              vendorId: parsed.vendorId || null,
              vendorName: parsed.vendorName || null,
              orderType: loadedOrderType,
              isMixed: computeIsMixed(loadedOrderType, loadedItems, loadedGroceryItems),
            };
            setCart(initialState);
            updateCartStoreSnapshot(initialState);
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
        groceryItems: [],
        vendorId: null,
        vendorName: null,
        orderType: null,
        isMixed: false,
      };
      setCart(emptyState);
      updateCartStoreSnapshot(emptyState);
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
            const backendGroceryItems: CartItem[] = (backendCart.groceryItems || []).map((i: any) => ({
              id: i.itemId || i.id,
              name: i.name,
              price: Number(i.price),
              quantity: Number(i.quantity),
              img: i.img,
            }));

            setCart((currentLocalCart) => {
              const localHasItems = currentLocalCart.items.length > 0 || (currentLocalCart.groceryItems || []).length > 0;

              // Case A: Local cart has items
              if (localHasItems) {
                // If both are food from same restaurant, merge food and grocery lists
                if (
                  backendCart.vendorId &&
                  currentLocalCart.vendorId === backendCart.vendorId &&
                  currentLocalCart.orderType === 'food' &&
                  backendCart.orderType === 'food'
                ) {
                  const mergedItems = mergeItemList(currentLocalCart.items, backendItems);
                  const mergedGrocery = mergeItemList(currentLocalCart.groceryItems || [], backendGroceryItems);
                  const mergedState: CartState = {
                    items: mergedItems,
                    groceryItems: mergedGrocery,
                    vendorId: currentLocalCart.vendorId,
                    vendorName: currentLocalCart.vendorName,
                    orderType: 'food',
                    isMixed: computeIsMixed('food', mergedItems, mergedGrocery),
                  };
                  saveToLocalStorage(mergedState);
                  return mergedState;
                }

                // If both are pure grocery carts, merge items
                if (
                  currentLocalCart.orderType === 'grocery' &&
                  backendCart.orderType === 'grocery'
                ) {
                  const mergedItems = mergeItemList(currentLocalCart.items, backendItems);
                  const mergedState: CartState = {
                    items: mergedItems,
                    groceryItems: [],
                    vendorId: currentLocalCart.vendorId,
                    vendorName: currentLocalCart.vendorName,
                    orderType: 'grocery',
                    isMixed: false,
                  };
                  saveToLocalStorage(mergedState);
                  return mergedState;
                }

                // If different vendors or backend is empty, keep current local cart
                saveToLocalStorage(currentLocalCart);
                return currentLocalCart;
              }

              // Case B: Local cart was empty, adopt backend cart if it has items
              if (backendItems.length > 0 || backendGroceryItems.length > 0) {
                const newCartState: CartState = {
                  items: backendItems,
                  groceryItems: backendGroceryItems,
                  vendorId: backendCart.vendorId || null,
                  vendorName: backendCart.vendorName || null,
                  orderType: backendCart.orderType || null,
                  isMixed: computeIsMixed(backendCart.orderType, backendItems, backendGroceryItems),
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
          const backendGroceryItems: CartItem[] = (backendCart.groceryItems || []).map((i: any) => ({
            id: i.itemId || i.id,
            name: i.name,
            price: Number(i.price),
            quantity: Number(i.quantity),
            img: i.img,
          }));

          if (backendItems.length > 0 || backendGroceryItems.length > 0) {
            setCart((currentLocalCart) => {
              const localHasItems = currentLocalCart.items.length > 0 || (currentLocalCart.groceryItems || []).length > 0;
              if (!localHasItems) {
                const newCartState: CartState = {
                  items: backendItems,
                  groceryItems: backendGroceryItems,
                  vendorId: backendCart.vendorId || null,
                  vendorName: backendCart.vendorName || null,
                  orderType: backendCart.orderType || null,
                  isMixed: computeIsMixed(backendCart.orderType, backendItems, backendGroceryItems),
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
          groceryItems: cart.groceryItems || [],
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

  const addToCart = useCallback((payload: AddToCartPayload) => {
    if (!getIsOnline()) {
      Alert.alert('Offline', "You're offline. Connect to the internet to update your cart.");
      return;
    }
    cartVersionRef.current += 1;

    setCart((prev) => {
      // 1. If cart is completely empty, simply add the item
      if (prev.items.length === 0 && (prev.groceryItems?.length || 0) === 0) {
        return {
          items: [{ ...payload.item, quantity: 1 }],
          groceryItems: [],
          vendorId: payload.vendorId,
          vendorName: payload.vendorName,
          orderType: payload.orderType,
          isMixed: false,
        };
      }

      // 2. If current cart is a grocery-only cart
      if (prev.orderType === 'grocery') {
        if (payload.orderType === 'grocery') {
          // Adding more grocery items - keep working exactly as today
          const existingIndex = prev.items.findIndex((i) => i.id === payload.item.id);
          let newItems: CartItem[];
          if (existingIndex >= 0) {
            newItems = [...prev.items];
            newItems[existingIndex] = {
              ...newItems[existingIndex],
              quantity: newItems[existingIndex].quantity + 1,
            };
          } else {
            newItems = [...prev.items, { ...payload.item, quantity: 1 }];
          }
          return { ...prev, items: newItems, groceryItems: [], isMixed: false };
        }

        if (payload.orderType === 'food') {
          // Restaurant item when the cart holds only groceries:
          // -> becomes the restaurant part, groceries move to groceryItems
          const newFoodItems: CartItem[] = [{ ...payload.item, quantity: 1 }];
          const newGroceryItems: CartItem[] = [...prev.items];
          return {
            items: newFoodItems,
            groceryItems: newGroceryItems,
            vendorId: payload.vendorId,
            vendorName: payload.vendorName,
            orderType: 'food',
            isMixed: true,
          };
        }
      }

      // 3. If current cart has a restaurant (orderType === 'food')
      if (prev.orderType === 'food') {
        if (payload.orderType === 'food') {
          // Restaurant item: check if same restaurant or different
          if (prev.vendorId !== payload.vendorId) {
            // Different restaurant -> keep existing "replace cart?" alert (only restaurants conflict)
            setPendingPayload(payload);
            setShowReplaceAlert(true);
            return prev;
          }

          // Same restaurant -> add to items / update quantity
          const existingIndex = prev.items.findIndex((i) => i.id === payload.item.id);
          let newItems: CartItem[];
          if (existingIndex >= 0) {
            newItems = [...prev.items];
            newItems[existingIndex] = {
              ...newItems[existingIndex],
              quantity: newItems[existingIndex].quantity + 1,
            };
          } else {
            newItems = [...prev.items, { ...payload.item, quantity: 1 }];
          }
          return {
            ...prev,
            items: newItems,
            isMixed: computeIsMixed('food', newItems, prev.groceryItems || []),
          };
        }

        if (payload.orderType === 'grocery') {
          // Grocery item when the cart has a restaurant -> add to groceryItems (no alert)
          const existingIndex = (prev.groceryItems || []).findIndex((i) => i.id === payload.item.id);
          let newGroceryItems: CartItem[];
          if (existingIndex >= 0) {
            newGroceryItems = [...(prev.groceryItems || [])];
            newGroceryItems[existingIndex] = {
              ...newGroceryItems[existingIndex],
              quantity: newGroceryItems[existingIndex].quantity + 1,
            };
          } else {
            newGroceryItems = [...(prev.groceryItems || []), { ...payload.item, quantity: 1 }];
          }
          return {
            ...prev,
            groceryItems: newGroceryItems,
            isMixed: computeIsMixed('food', prev.items, newGroceryItems),
          };
        }
      }

      return prev;
    });
  }, []);

  const confirmReplaceCart = useCallback(() => {
    cartVersionRef.current += 1;
    setPendingPayload((pending) => {
      if (pending) {
        setCart((prev) => {
          // Replacing the restaurant: previous restaurant items are replaced,
          // grocery items are preserved as groceryItems.
          const newFoodItems = [{ ...pending.item, quantity: 1 }];
          const existingGroceries = prev.groceryItems || [];
          return {
            items: newFoodItems,
            groceryItems: existingGroceries,
            vendorId: pending.vendorId,
            vendorName: pending.vendorName,
            orderType: 'food',
            isMixed: computeIsMixed('food', newFoodItems, existingGroceries),
          };
        });
      }
      return null;
    });
    setShowReplaceAlert(false);
  }, []);

  const cancelReplaceCart = useCallback(() => {
    setPendingPayload(null);
    setShowReplaceAlert(false);
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    if (!getIsOnline()) {
      Alert.alert('Offline', "You're offline. Connect to the internet to update your cart.");
      return;
    }
    cartVersionRef.current += 1;
    setCart((prev) => {
      const inItems = prev.items.some((i) => i.id === itemId);
      const inGrocery = (prev.groceryItems || []).some((i) => i.id === itemId);

      let newItems = prev.items;
      let newGroceryItems = prev.groceryItems || [];

      if (inItems) {
        newItems = prev.items.filter((i) => i.id !== itemId);
      }
      if (inGrocery) {
        newGroceryItems = (prev.groceryItems || []).filter((i) => i.id !== itemId);
      }

      // If items became empty:
      if (newItems.length === 0) {
        if (newGroceryItems.length > 0) {
          // If grocery items remain, promote them back to a pure grocery cart
          return {
            items: newGroceryItems,
            groceryItems: [],
            vendorId: 'zip-grocery-hub',
            vendorName: 'ZipGrocery Stores',
            orderType: 'grocery',
            isMixed: false,
          };
        }
        // Cart is completely empty
        return {
          items: [],
          groceryItems: [],
          vendorId: null,
          vendorName: null,
          orderType: null,
          isMixed: false,
        };
      }

      // Items still has elements, check groceryItems
      if (newGroceryItems.length === 0 && prev.orderType === 'grocery') {
        return {
          items: [],
          groceryItems: [],
          vendorId: null,
          vendorName: null,
          orderType: null,
          isMixed: false,
        };
      }

      return {
        ...prev,
        items: newItems,
        groceryItems: newGroceryItems,
        isMixed: computeIsMixed(prev.orderType, newItems, newGroceryItems),
      };
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (!getIsOnline()) {
      Alert.alert('Offline', "You're offline. Connect to the internet to update your cart.");
      return;
    }
    cartVersionRef.current += 1;
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart((prev) => {
      const inItems = prev.items.some((i) => i.id === itemId);
      const inGrocery = (prev.groceryItems || []).some((i) => i.id === itemId);

      let newItems = prev.items;
      let newGroceryItems = prev.groceryItems || [];

      if (inItems) {
        newItems = prev.items.map((i) => (i.id === itemId ? { ...i, quantity } : i));
      }
      if (inGrocery) {
        newGroceryItems = (prev.groceryItems || []).map((i) => (i.id === itemId ? { ...i, quantity } : i));
      }

      return {
        ...prev,
        items: newItems,
        groceryItems: newGroceryItems,
        isMixed: computeIsMixed(prev.orderType, newItems, newGroceryItems),
      };
    });
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    cartVersionRef.current += 1;
    setCart({
      items: [],
      groceryItems: [],
      vendorId: null,
      vendorName: null,
      orderType: null,
      isMixed: false,
    });
  }, []);

  const getItemQuantity = useCallback(
    (itemId: string) => {
      const item = [...cart.items, ...(cart.groceryItems || [])].find(
        (i) => i.id === itemId || i.id === `groc-${itemId}` || i.id === `food-${itemId}`
      );
      return item ? item.quantity : 0;
    },
    [cart]
  );

  const actionsValue = useMemo<CartActionsType>(
    () => ({
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      confirmReplaceCart,
      cancelReplaceCart,
    }),
    [
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      confirmReplaceCart,
      cancelReplaceCart,
    ]
  );

  const contextValue = useMemo<CartContextType>(
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
      getItemQuantity,
    }),
    [
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      showReplaceAlert,
      pendingPayload,
      confirmReplaceCart,
      cancelReplaceCart,
      getItemQuantity,
    ]
  );

  return (
    <CartActionsContext.Provider value={actionsValue}>
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
    </CartActionsContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export function useCartActions(): CartActionsType {
  const context = useContext(CartActionsContext);
  if (!context) {
    throw new Error('useCartActions must be used within a CartProvider');
  }
  return context;
}

export function useCartSelector<T>(selector: (state: CartState) => T): T {
  const getSnapshot = useCallback(() => selector(cartStoreSnapshot), [selector]);
  return useSyncExternalStore(subscribeToCartStore, getSnapshot, getSnapshot);
}

export function useCartItemQuantity(itemId: string): number {
  return useCartSelector(
    useCallback(
      (state: CartState) => {
        const item = [...state.items, ...(state.groceryItems || [])].find(
          (i) => i.id === itemId || i.id === `groc-${itemId}` || i.id === `food-${itemId}`
        );
        return item ? item.quantity : 0;
      },
      [itemId]
    )
  );
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
