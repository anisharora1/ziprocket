'use client';
import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function FloatingCartButton() {
  const { cart } = useCart();

  if (cart.items.length === 0) return null;

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="fixed bottom-[90px] left-4 right-4 md:left-auto md:right-4 md:w-96 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <Link 
        href="/cart"
        className="bg-[#FF5C00] text-white p-3 rounded-xl shadow-2xl flex items-center justify-between cursor-pointer hover:bg-[#e05200] transition-colors border border-[#FF5C00]/20"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/20 px-3 py-1.5 rounded-lg flex flex-col items-center justify-center">
            <span className="text-[14px] font-black leading-tight">{totalItems}</span>
            <span className="text-[8px] font-bold uppercase tracking-widest opacity-90 leading-tight">
              {totalItems === 1 ? 'Item' : 'Items'}
            </span>
          </div>
          <div>
            <p className="text-[14px] font-black">₹{totalPrice.toFixed(2)}</p>
            <p className="text-[11px] text-[#FF5C00]-100 font-medium opacity-80">Plus taxes & delivery</p>
          </div>
        </div>
        <div className="flex items-center gap-1 font-bold text-[14px]">
          View Cart
          <span className="material-symbols-outlined text-[20px]">play_arrow</span>
        </div>
      </Link>
    </div>
  );
}
