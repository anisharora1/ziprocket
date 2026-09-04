import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ZipRocket",
  description: "Privacy Policy and data protection standards for ZipRocket.",
};

export default function PrivacyPolicyPage() {
  return (
    <article className="space-y-6">
      <header className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-sm font-semibold text-[#FF5C00] mt-1">
          How we handle and protect your personal information
        </p>
      </header>

      <section className="space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed">
        <div className="space-y-2">
          <h2 className="text-lg font-black text-[#FF5C00]">Information We Collect</h2>
          <p>
            We collect the following information to operate ZipRocket: your name, phone number (verified via OTP), delivery address, and precise location (GPS) when you use the app, in order to show you nearby restaurants/stores and calculate accurate delivery times and fees.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-black text-[#FF5C00]">Payment Information</h2>
          <p>
            ZipRocket does not store your card, UPI, or banking details. All payments are processed directly and securely by Razorpay, our payment partner, in compliance with RBI and PCI-DSS standards.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-black text-[#FF5C00]">How We Use Your Data</h2>
          <p>
            To process and deliver your orders, communicate order updates, provide customer support, and improve our service. We do not sell your personal data to third parties.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-black text-[#FF5C00]">Data Sharing</h2>
          <p>
            Your name, phone number, and delivery address are shared only with the restaurant/store fulfilling your order and the delivery partner assigned to it, solely for order fulfillment.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-black text-[#FF5C00]">Your Rights</h2>
          <p>
            You can request access to, correction of, or deletion of your personal data by contacting{" "}
            <a
              href="mailto:ziprocket.support@gmail.com"
              className="text-[#FF5C00] font-semibold underline"
            >
              ziprocket.support@gmail.com
            </a>.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 mt-4 space-y-1.5">
          <h2 className="text-sm font-black text-slate-900">Grievance Officer</h2>
          <p className="text-xs sm:text-sm text-slate-700">
            <strong>Anish Arora</strong>, reachable at{" "}
            <a
              href="mailto:ziprocket.support@gmail.com"
              className="text-[#FF5C00] font-semibold underline"
            >
              ziprocket.support@gmail.com
            </a>
            , for any privacy-related concerns or complaints under applicable Indian data protection law.
          </p>
        </div>
      </section>
    </article>
  );
}
