import React from "react";
import LegalNav from "@/components/LegalNav";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800">
      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12 pb-24">
        <LegalNav />
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100">
          {children}
        </div>
      </main>
    </div>
  );
}
