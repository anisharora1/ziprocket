import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | ZipRocket",
  description: "Learn about ZipRocket - hyperlocal food and grocery delivery platform for Tier-3 and Tier-4 towns in India.",
};

export default function AboutUsPage() {
  return (
    <article className="space-y-6">
      <header className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          About Us
        </h1>
        <p className="text-sm font-semibold text-[#FF5C00] mt-1">
          Hyperlocal Delivery for Bharat
        </p>
      </header>

      <section className="space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed">
        <h2 className="text-lg font-black text-[#FF5C00]">Our Mission</h2>
        <p>
          ZipRocket is a hyperlocal food and grocery delivery platform built for Tier-3 and Tier-4 towns in India — starting with Phagwara, Punjab. We connect local restaurants and grocery stores with customers in their own neighborhood, delivered by local delivery partners, usually within minutes rather than hours.
        </p>
        <p>
          ZipRocket is currently operated by Anish Arora, as an individual proprietor, based in Madhubani, Bihar.
        </p>
      </section>

      <section className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 sm:p-5 mt-6">
        <h2 className="text-sm font-black text-slate-900 mb-2">Key Highlights</h2>
        <ul className="space-y-2 text-xs sm:text-sm text-slate-700 list-disc list-inside">
          <li><strong>Hyperlocal Focus:</strong> Tailored specifically for the needs and dynamics of Tier-3 &amp; Tier-4 towns.</li>
          <li><strong>Empowering Local Sellers:</strong> Connecting neighborhood restaurants and grocery shops directly to local consumers.</li>
          <li><strong>Fast &amp; Reliable:</strong> Neighborhood deliveries powered by local delivery partners.</li>
        </ul>
      </section>
    </article>
  );
}
