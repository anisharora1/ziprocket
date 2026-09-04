"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MdArrowBack } from "react-icons/md";

const LEGAL_LINKS = [
  { href: "/about-us", label: "About Us" },
  { href: "/contact-us", label: "Contact Us" },
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/shipping-policy", label: "Shipping Policy" },
];

export default function LegalNav() {
  const pathname = usePathname();

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#FF5C00] transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-100 -ml-2.5"
        >
          <MdArrowBack className="text-base" />
          <span>Back to Home</span>
        </Link>
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#FF5C00] bg-[#FF5C00]/10 px-2.5 py-1 rounded-full">
          Legal & Compliance
        </span>
      </div>

      <nav className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {LEGAL_LINKS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                isActive
                  ? "bg-[#FF5C00] text-white shadow-sm shadow-[#FF5C00]/25"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
