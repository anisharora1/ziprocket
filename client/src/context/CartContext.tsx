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
  vendorId: string | null;
  vendorName: string | null;
  orderType: 'food' | 'grocery' | null;
}

interface AddToCartPayload {
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

  // Load from backend if logged in, otherwise load from local storage
  useEffect(() => {
    const loadCart = async () => {
      if (user) {
        try {
          const res = await apiClient.get("/cart");
          if (res.data.success && res.data.cart) {
            const backendCart = res.data.cart;
            const formattedItems = (backendCart.items || []).map((i: any) => ({
              id: i.itemId,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              img: i.img
            }));
            setCart({
              items: formattedItems,
              vendorId: backendCart.vendorId,
              vendorName: backendCart.vendorName,
              orderType: backendCart.orderType
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
            setCart({
              items: Array.isArray(parsed.items) ? parsed.items : [],
              vendorId: parsed.vendorId || null,
              vendorName: parsed.vendorName || null,
              orderType: parsed.orderType || null
            });
          }
        } catch (e) {
          console.error("Failed to parse local cart", e);
        }
      }
    };

    loadCart().then(() => {
      // Mark as loaded after initial cart load completes to prevent redundant sync
      hasLoadedRef.current = true;
    });
  }, [user]);

  // Sync to database if logged in (debounced), otherwise write to local storage
  // Guard: skip writes during initial hydration to avoid a no-op write-back
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    localStorage.setItem('ziprocket_cart', JSON.stringify(cart));

    if (!user) return;

    const syncWithBackend = setTimeout(async () => {
      try {
        await apiClient.post("/cart", {
          items: cart.items,
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
    // If cart is empty, simply add
    if (cart.items.length === 0) {
      setCart({
        items: [{ ...payload.item, quantity: 1 }],
        vendorId: payload.vendorId,
        vendorName: payload.vendorName,
        orderType: payload.orderType,
      });
      return;
    }

    // Rule: Reject if different vendor or different type
    if (cart.vendorId !== payload.vendorId || cart.orderType !== payload.orderType) {
      setPendingPayload(payload);
      setShowReplaceAlert(true);
      return;
    }

    // Same vendor, update quantity or add new item
    setCart((prev) => {
      const existingItemIndex = prev.items.findIndex(i => i.id === payload.item.id);
      if (existingItemIndex >= 0) {
        const newItems = [...prev.items];
        newItems[existingItemIndex].quantity += 1;
        return { ...prev, items: newItems };
      }
      return { ...prev, items: [...prev.items, { ...payload.item, quantity: 1 }] };
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
      const newItems = prev.items.filter(i => i.id !== itemId);
      if (newItems.length === 0) {
        return { items: [], vendorId: null, vendorName: null, orderType: null };
      }
      return { ...prev, items: newItems };
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) => ({
      ...prev,
      items: prev.items.map(i => i.id === itemId ? { ...i, quantity } : i)
    }));
  };

  const clearCart = () => {
    setCart({ items: [], vendorId: null, vendorName: null, orderType: null });
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
