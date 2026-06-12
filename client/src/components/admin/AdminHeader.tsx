import Image from "next/image";

export default function AdminHeader() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button className="text-slate-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
        <h1 className="font-semibold text-slate-800 text-[14px]">Platform Overview</h1>
      </div>
      <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:ring-2 hover:ring-primary-container transition-all relative">
            <Image 
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100" 
              alt="Admin" 
              width={32}
              height={32}
              className="w-full h-full object-cover" 
            />
          </div>
      </div>
    </header>
  );
}
