'use client';

import BottomNavBar from "@/components/BottomNavBar";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient } from "@/services/api";

export default function CartPage() {
    const { cart, updateQuantity, clearCart, addToCart } = useCart();
    const router = useRouter();
    
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [loadingRecs, setLoadingRecs] = useState(false);

    // Fetch recommendations dynamically whenever cart items change
    useEffect(() => {
        const fetchRecommendations = async () => {
            if (cart.items.length === 0) {
                setRecommendations([]);
                return;
            }
            try {
                setLoadingRecs(true);
                const res = await apiClient.post("/recommendations", {
                    orderType: cart.orderType,
                    vendorId: cart.orderType === 'food' ? cart.vendorId : 'grocery',
                    cartItemIds: cart.items.map(i => i.id)
                });
                if (res.data.success) {
                    setRecommendations(res.data.recommendations || []);
                }
            } catch (err) {
                console.error("Failed to load recommendations:", err);
            } finally {
                setLoadingRecs(false);
            }
        };

        fetchRecommendations();
    }, [cart.items, cart.orderType, cart.vendorId]);

    const handleAddRecommendedItem = (item: any) => {
        const isGrocery = cart.orderType === 'grocery';
        const itemId = isGrocery ? `groc-${item._id}` : `food-${item._id}`;
        
        addToCart({
            item: {
                id: itemId,
                name: item.name,
                price: item.price,
                quantity: 1,
                img: item.images?.[0] || ""
            },
            vendorId: cart.orderType === 'food' ? cart.vendorId! : 'grocery',
            vendorName: cart.orderType === 'food' ? cart.vendorName! : 'Grocery Store',
            orderType: cart.orderType!
        });
    };

    const itemTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <div className="bg-[#fcfcfc] text-slate-900 pb-32 min-h-screen w-full font-sans">
            
            {/* Header */}
            <header className="bg-white sticky top-0 z-40 pt-4 pb-3 px-4 flex items-center justify-between border-b border-slate-100">
                <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center transition-transform active:scale-95">
                    <span className="material-symbols-outlined text-slate-700">arrow_back</span>
                </button>
                <h1 className="font-bold text-[16px] text-slate-800 tracking-tight">Shopping Cart</h1>
                {cart.items.length > 0 ? (
                    <button
                        onClick={clearCart}
                        className="text-[12px] font-black text-rose-500 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg uppercase tracking-wider transition-colors"
                    >
                        Clear All
                    </button>
                ) : (
                    <div className="w-8" />
                )}
            </header>

            <main className="w-full max-w-md mx-auto px-4 pt-4 pb-20 space-y-5">
                
                {cart.items.length === 0 ? (
                    /* Blinkit Style Empty State */
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 flex flex-col items-center justify-center text-center shadow-sm py-16">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 border border-slate-100">
                            <span className="material-symbols-outlined text-[36px] text-slate-300">shopping_basket</span>
                        </div>
                        <h2 className="text-[17px] font-extrabold text-slate-800 mb-1">Your cart is empty</h2>
                        <p className="text-[12px] text-slate-400 mb-6 max-w-[240px] leading-relaxed">
                            No items in your basket. Fill it up with delicious food or fresh groceries!
                        </p>
                        <div className="flex gap-2 w-full">
                            <Link href="/restaurants" className="flex-1 py-3 bg-[#FF5C00] hover:bg-[#e05200] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm">
                                Order Food
                            </Link>
                            <Link href="/grocery" className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all">
                                Shop Groceries
                            </Link>
                        </div>
                    </div>
                ) : (
                    /* Lightweight Cart Contents */
                    <div className="space-y-5">
                        
                        {/* Ordering From Banner */}
                        <div className="bg-white rounded-xl border border-slate-100 p-3.5 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#FF5C00] flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {cart.orderType === 'grocery' ? 'store' : 'restaurant'}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-450 uppercase tracking-widest leading-none">Ordering From</p>
                                    <h2 className="text-[13px] font-black text-slate-800 leading-tight mt-1">{cart.vendorName}</h2>
                                </div>
                            </div>
                        </div>

                        {/* Cart Items List */}
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            <div className="divide-y divide-slate-50">
                                {cart.items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3 p-3.5">
                                        {item.img ? (
                                            <div className="w-12 h-12 rounded-lg bg-slate-50 overflow-hidden shrink-0 border border-slate-100/50">
                                                <img src={item.img} alt={item.name} className="w-full h-full object-cover mix-blend-multiply" />
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100/50 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-slate-300">
                                                    {cart.orderType === 'grocery' ? 'local_mall' : 'fastfood'}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex-1">
                                            <h3 className="text-[13px] font-extrabold text-slate-800 leading-tight line-clamp-1">{item.name}</h3>
                                            <p className="text-[13px] font-black text-slate-900 mt-1">₹{item.price}</p>
                                        </div>

                                        {/* Quantity Selector */}
                                        <div className="flex items-center bg-[#FF5C00]/10 border border-[#FF5C00]/20 rounded-xl overflow-hidden shrink-0">
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                className="w-8 h-8 flex items-center justify-center text-[#FF5C00] hover:bg-[#FF5C00]/20 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[15px] font-black">remove</span>
                                            </button>
                                            <span className="w-6 text-center text-[12px] font-black text-[#FF5C00]">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className="w-8 h-8 flex items-center justify-center text-[#FF5C00] hover:bg-[#FF5C00]/20 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[15px] font-black">add</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Link 
                                href={cart.orderType === 'grocery' ? '/grocery' : `/restaurants/${cart.vendorId}`} 
                                className="block text-center text-[11px] font-black text-[#FF5C00] hover:bg-[#FF5C00]/5 py-3 border-t border-slate-50 transition-colors uppercase tracking-wider"
                            >
                                + Add more items
                            </Link>
                        </div>

                        {/* Smart Recommendations Section */}
                        {recommendations.length > 0 && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between px-1">
                                    <div>
                                        <h3 className="text-[13px] font-black text-slate-850">Tasted Best With / You Might Need</h3>
                                        <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider mt-0.5">Recommendations based on your basket</p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-[#FF5C00]/10 text-[#FF5C00] text-[8px] font-black uppercase rounded-full">Smart Recs</span>
                                </div>

                                <div className="flex overflow-x-auto gap-3.5 pb-2.5 scrollbar-thin select-none snap-x -mx-4 px-4">
                                    {recommendations.map((item) => (
                                        <div 
                                            key={item._id}
                                            className="w-[140px] bg-white border border-slate-100 rounded-2xl p-3 flex flex-col justify-between shrink-0 shadow-sm snap-start hover:border-slate-200 transition-colors"
                                        >
                                            <div>
                                                {/* Image */}
                                                <div className="w-full h-24 rounded-lg bg-slate-50 overflow-hidden mb-2 border border-slate-100/50 flex items-center justify-center">
                                                    {item.images?.[0] ? (
                                                        <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover mix-blend-multiply" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-slate-300 text-[24px]">
                                                            {cart.orderType === 'grocery' ? 'local_mall' : 'fastfood'}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {/* Name */}
                                                <h4 className="text-[11px] font-extrabold text-slate-800 line-clamp-2 leading-snug min-h-[32px]">{item.name}</h4>
                                                
                                                {/* Size (Grocery Only) */}
                                                {cart.orderType === 'grocery' && item.weightSize && (
                                                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">{item.weightSize}</p>
                                                )}
                                            </div>

                                            {/* Footer Price & Add button */}
                                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                                                <span className="text-[11px] font-black text-slate-900">₹{item.price}</span>
                                                <button
                                                    onClick={() => handleAddRecommendedItem(item)}
                                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm shadow-emerald-100 flex items-center gap-0.5"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </main>

            {/* Fixed Floating Checkout bar */}
            {cart.items.length > 0 && (
                <div className="fixed bottom-0 left-0 w-full z-50 bg-white/90 backdrop-blur-md border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] p-4 pb-safe-bottom">
                    <div className="max-w-lg mx-auto flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black text-slate-450 uppercase tracking-widest leading-none">Basket Subtotal</p>
                            <p className="text-lg font-black text-slate-900 mt-1 leading-none">
                                ₹{itemTotal.toFixed(2)}
                                <span className="text-[10px] text-slate-400 font-extrabold ml-1.5 uppercase tracking-wide">
                                    ({cart.items.reduce((sum, item) => sum + item.quantity, 0)} {cart.items.length === 1 ? 'item' : 'items'})
                                </span>
                            </p>
                        </div>
                        <Link
                            href="/checkout"
                            className="bg-[#FF5C00] hover:bg-[#e05200] active:scale-[0.98] text-white px-7 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5"
                        >
                            Next: Checkout
                            <span className="material-symbols-outlined text-[16px] font-black">arrow_forward</span>
                        </Link>
                    </div>
                </div>
            )}

            {/* Bottom Nav fallback */}
            {cart.items.length === 0 && <BottomNavBar activeTab="orders" />}

        </div>
    );
}
