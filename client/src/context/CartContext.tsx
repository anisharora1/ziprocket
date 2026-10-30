'use client';

import { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import { MdRemoveShoppingCart } from 'react-icons/md';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/services/api';

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

interface CartContextType {
  cart: CartState;
  addToCart: (payload: AddToCartPayload) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;

  // Alert UI State
  showReplaceAlert: boolean;
  pendingPayload: AddToCartPayload | null;
  confirmReplaceCart: () => void;
  cancelReplaceCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function computeIsMixed(orderType: string | null, items: CartItem[], groceryItems: CartItem[]): boolean {
  return Boolean(orderType === 'food' && items.length > 0 && groceryItems.length > 0);
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
  const { user } = useAuth();

  // Load from backend if logged in, otherwise load from local storage
  useEffect(() => {
    const loadCart = async () => {
      if (user) {
        try {
          const res = await apiClient.get("/cart");
          if (res.data.success && res.data.cart) {
            const backendCart = res.data.cart;
            const formattedItems: CartItem[] = (backendCart.items || []).map((i: any) => ({
              id: i.itemId,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              img: i.img
            }));
            const formattedGroceryItems: CartItem[] = (backendCart.groceryItems || []).map((i: any) => ({
              id: i.itemId,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              img: i.img
            }));

            setCart({
              items: formattedItems,
              groceryItems: formattedGroceryItems,
              vendorId: backendCart.vendorId || null,
              vendorName: backendCart.vendorName || null,
              orderType: backendCart.orderType || null,
              isMixed: computeIsMixed(backendCart.orderType, formattedItems, formattedGroceryItems)
            });
            return;
          }
        } catch (err) {
          console.error("Failed to load synced cart from backend:", err);
        }
      }

      // Offline/Guest fallback
      const savedCart = localStorage.getItem('ziprocket_cart');
      if (savedCart) {
        try {
          const parsed = JSON.parse(savedCart);
          if (parsed && typeof parsed === 'object') {
            const loadedItems: CartItem[] = Array.isArray(parsed.items) ? parsed.items : [];
            const loadedGroceryItems: CartItem[] = Array.isArray(parsed.groceryItems) ? parsed.groceryItems : [];
            const loadedOrderType = parsed.orderType || null;

            setCart({
              items: loadedItems,
              groceryItems: loadedGroceryItems,
              vendorId: parsed.vendorId || null,
              vendorName: parsed.vendorName || null,
              orderType: loadedOrderType,
              isMixed: computeIsMixed(loadedOrderType, loadedItems, loadedGroceryItems)
            });
          }
        } catch (e) {
          console.error("Failed to parse local cart", e);
        }
      }
    };

    loadCart().then(() => {
      hasLoadedRef.current = true;
    });
  }, [user]);

  // Sync to database if logged in (debounced), otherwise write to local storage
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    localStorage.setItem('ziprocket_cart', JSON.stringify(cart));

    if (!user) return;

    const syncWithBackend = setTimeout(async () => {
      try {
        await apiClient.post("/cart", {
          items: cart.items,
          groceryItems: cart.groceryItems || [],
          vendorId: cart.vendorId,
          vendorName: cart.vendorName,
          orderType: cart.orderType
        });
      } catch (err) {
        console.error("Failed to sync cart to backend:", err);
      }
    }, 800);

    return () => clearTimeout(syncWithBackend);
  }, [cart, user]);

  const addToCart = (payload: AddToCartPayload) => {
    // 1. If cart is completely empty, simply add the item
    if (cart.items.length === 0 && cart.groceryItems.length === 0) {
      setCart({
        items: [{ ...payload.item, quantity: 1 }],
        groceryItems: [],
        vendorId: payload.vendorId,
        vendorName: payload.vendorName,
        orderType: payload.orderType,
        isMixed: false
      });
      return;
    }

    // 2. If current cart is a grocery-only cart
    if (cart.orderType === 'grocery') {
      if (payload.orderType === 'grocery') {
        // Adding more grocery items - keep working exactly as today
        setCart((prev) => {
          const existingIndex = prev.items.findIndex(i => i.id === payload.item.id);
          let newItems: CartItem[];
          if (existingIndex >= 0) {
            newItems = [...prev.items];
            newItems[existingIndex].quantity += 1;
          } else {
            newItems = [...prev.items, { ...payload.item, quantity: 1 }];
          }
          return { ...prev, items: newItems, isMixed: false };
        });
        return;
      }

      if (payload.orderType === 'food') {
        // Restaurant item when the cart holds only groceries:
        // -> becomes the restaurant part, groceries move to groceryItems
        setCart((prev) => {
          const newFoodItems: CartItem[] = [{ ...payload.item, quantity: 1 }];
          const newGroceryItems: CartItem[] = [...prev.items];
          return {
            items: newFoodItems,
            groceryItems: newGroceryItems,
            vendorId: payload.vendorId,
            vendorName: payload.vendorName,
            orderType: 'food',
            isMixed: true
          };
        });
        return;
      }
    }

    // 3. If current cart has a restaurant (orderType === 'food')
    if (cart.orderType === 'food') {
      if (payload.orderType === 'food') {
        // Restaurant item: check if same restaurant or different
        if (cart.vendorId !== payload.vendorId) {
          // Different restaurant -> keep existing "replace cart?" alert (only restaurants conflict)
          setPendingPayload(payload);
          setShowReplaceAlert(true);
          return;
        }

        // Same restaurant -> add to items / update quantity
        setCart((prev) => {
          const existingIndex = prev.items.findIndex(i => i.id === payload.item.id);
          let newItems: CartItem[];
          if (existingIndex >= 0) {
            newItems = [...prev.items];
            newItems[existingIndex].quantity += 1;
          } else {
            newItems = [...prev.items, { ...payload.item, quantity: 1 }];
          }
          return {
            ...prev,
            items: newItems,
            isMixed: computeIsMixed('food', newItems, prev.groceryItems)
          };
        });
        return;
      }

      if (payload.orderType === 'grocery') {
        // Grocery item when the cart has a restaurant -> add to groceryItems (no alert)
        setCart((prev) => {
          const existingIndex = prev.groceryItems.findIndex(i => i.id === payload.item.id);
          let newGroceryItems: CartItem[];
          if (existingIndex >= 0) {
            newGroceryItems = [...prev.groceryItems];
            newGroceryItems[existingIndex].quantity += 1;
          } else {
            newGroceryItems = [...prev.groceryItems, { ...payload.item, quantity: 1 }];
          }
          return {
            ...prev,
            groceryItems: newGroceryItems,
            isMixed: computeIsMixed('food', prev.items, newGroceryItems)
          };
        });
        return;
      }
    }
  };

  const confirmReplaceCart = () => {
    if (pendingPayload) {
      setCart((prev) => {
        // Replacing the restaurant: previous restaurant items are replaced,
        // grocery items are preserved as groceryItems.
        const newFoodItems = [{ ...pendingPayload.item, quantity: 1 }];
        const existingGroceries = prev.groceryItems || [];
        return {
          items: newFoodItems,
          groceryItems: existingGroceries,
          vendorId: pendingPayload.vendorId,
          vendorName: pendingPayload.vendorName,
          orderType: 'food',
          isMixed: computeIsMixed('food', newFoodItems, existingGroceries)
        };
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
      const inItems = prev.items.some(i => i.id === itemId);
      const inGrocery = prev.groceryItems.some(i => i.id === itemId);

      let newItems = prev.items;
      let newGroceryItems = prev.groceryItems;

      if (inItems) {
        newItems = prev.items.filter(i => i.id !== itemId);
      }
      if (inGrocery) {
        newGroceryItems = prev.groceryItems.filter(i => i.id !== itemId);
      }

      // If items became empty:
      if (newItems.length === 0) {
        if (newGroceryItems.length > 0) {
          // If grocery items remain, promote them back to a pure grocery cart
          return {
            items: newGroceryItems,
            groceryItems: [],
            vendorId: 'grocery',
            vendorName: 'Grocery Store',
            orderType: 'grocery',
            isMixed: false
          };
        }
        // Cart is completely empty
        return {
          items: [],
          groceryItems: [],
          vendorId: null,
          vendorName: null,
          orderType: null,
          isMixed: false
        };
      }

      // Items still has elements, check groceryItems
      if (newGroceryItems.length === 0 && prev.orderType === 'grocery') {
        // Grocery cart whose items are completely gone
        return {
          items: [],
          groceryItems: [],
          vendorId: null,
          vendorName: null,
          orderType: null,
          isMixed: false
        };
      }

      return {
        ...prev,
        items: newItems,
        groceryItems: newGroceryItems,
        isMixed: computeIsMixed(prev.orderType, newItems, newGroceryItems)
      };
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart((prev) => {
      const inItems = prev.items.some(i => i.id === itemId);
      const inGrocery = prev.groceryItems.some(i => i.id === itemId);

      let newItems = prev.items;
      let newGroceryItems = prev.groceryItems;

      if (inItems) {
        newItems = prev.items.map(i => i.id === itemId ? { ...i, quantity } : i);
      }
      if (inGrocery) {
        newGroceryItems = prev.groceryItems.map(i => i.id === itemId ? { ...i, quantity } : i);
      }

      return {
        ...prev,
        items: newItems,
        groceryItems: newGroceryItems,
        isMixed: computeIsMixed(prev.orderType, newItems, newGroceryItems)
      };
    });
  };

  const clearCart = () => {
    setCart({
      items: [],
      groceryItems: [],
      vendorId: null,
      vendorName: null,
      orderType: null,
      isMixed: false
    });
  };

  const contextValue = useMemo(() => ({
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    showReplaceAlert,
    pendingPayload,
    confirmReplaceCart,
    cancelReplaceCart
  }), [cart, showReplaceAlert, pendingPayload]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}

      {/* Global Replace Alert Modal */}
      {showReplaceAlert && pendingPayload && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cancelReplaceCart}></div>
          <div className="relative bg-white rounded-3xl w-[90%] min-w-[300px] max-w-sm shrink-0 overflow-hidden shadow-2xl z-10">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <MdRemoveShoppingCart className="text-[32px]" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Replace cart item?</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">
                Your cart contains items from <span className="text-slate-900 font-bold">{cart.vendorName}</span>. Do you want to discard the selection and add items from <span className="text-slate-900 font-bold">{pendingPayload.vendorName}</span>?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={cancelReplaceCart}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  No, keep it
                </button>
                <button
                  onClick={confirmReplaceCart}
                  className="flex-1 py-3 px-4 bg-[#FF5C00] hover:bg-[#e05200] text-white font-bold rounded-xl shadow-sm transition-colors"
                >
                  Yes, replace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
