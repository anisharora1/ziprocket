import Link from 'next/link';

export default function Categories() {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-md">
      <Link href="/restaurants" className="bg-white p-md rounded-2xl flex flex-col items-center justify-center shadow-sm border border-slate-100 transition-all active:scale-95 cursor-pointer">
        <div className="w-16 h-16 bg-[#FFF1E6] rounded-full flex items-center justify-center mb-2">
          <span className="text-3xl">🍔</span>
        </div>
        <span className="font-h2 text-h2">Food</span>
        <span className="text-slate-500 text-label-sm">Hungry?</span>
      </Link>
      <Link href="/grocery" className="bg-white p-md rounded-2xl flex flex-col items-center justify-center shadow-sm border border-slate-100 transition-all active:scale-95 cursor-pointer">
        <div className="w-16 h-16 bg-[#E6F4EA] rounded-full flex items-center justify-center mb-2">
          <span className="text-3xl">🛒</span>
        </div>
        <span className="font-h2 text-h2">Grocery</span>
        <span className="text-slate-500 text-label-sm">Fresh Daily</span>
      </Link>
    </section>
  );
}
