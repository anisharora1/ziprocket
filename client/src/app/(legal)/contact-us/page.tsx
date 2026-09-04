import { Metadata } from "next";
import { MdEmail, MdLocationOn, MdAccessTime } from "react-icons/md";
import { FaWhatsapp } from "react-icons/fa";

export const metadata: Metadata = {
  title: "Contact Us | ZipRocket",
  description: "Get in touch with ZipRocket customer support for order issues, refunds, and partner inquiries.",
};

export default function ContactUsPage() {
  return (
    <article className="space-y-6">
      <header className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Contact Us
        </h1>
        <p className="text-sm font-semibold text-[#FF5C00] mt-1">
          We&apos;re here to help you
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-black text-[#FF5C00]">Support Details</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <a
            href="mailto:ziprocket.support@gmail.com"
            className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-[#FF5C00]/40 transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF5C00] flex items-center justify-center shrink-0 group-hover:bg-[#FF5C00] group-hover:text-white transition-colors">
              <MdEmail className="text-xl" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</p>
              <p className="text-sm font-bold text-slate-900 break-all group-hover:text-[#FF5C00] transition-colors">
                ziprocket.support@gmail.com
              </p>
            </div>
          </a>

          <a
            href="https://wa.me/919117662441?text=Hi%20ZipRocket%2C%20I%20need%20support"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-emerald-500/40 transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <FaWhatsapp className="text-xl" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">WhatsApp Support</p>
              <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                +91 9117662441
              </p>
            </div>
          </a>

          <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
              <MdLocationOn className="text-xl" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operating Address</p>
              <p className="text-sm font-bold text-slate-900">
                Madhubani, Bihar
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
              <MdAccessTime className="text-xl" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Support Hours</p>
              <p className="text-sm font-bold text-slate-900">
                9:00 AM – 9:00 PM, all days
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 pt-2 text-slate-600 text-sm sm:text-base leading-relaxed">
        <h2 className="text-lg font-black text-[#FF5C00]">How to Reach Us</h2>
        <p>
          For order issues, refunds, or partnership queries (restaurant/grocery/delivery partner onboarding), please reach out via WhatsApp for the fastest response, or email us and we&apos;ll get back within 24 hours.
        </p>
      </section>
    </article>
  );
}
