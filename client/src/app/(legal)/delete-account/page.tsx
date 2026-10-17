import { Metadata } from "next";
import { MdEmail } from "react-icons/md";
import { FaWhatsapp } from "react-icons/fa";

export const metadata: Metadata = {
  title: "Delete Account | ZipRocket",
  description: "Request deletion of your ZipRocket account and associated personal data.",
};

export default function DeleteAccountPage() {
  const mailtoHref =
    "mailto:ziprocket.support@gmail.com?subject=Account%20deletion%20request&body=Hello%20ZipRocket%20Support%2C%0A%0AI%20would%20like%20to%20request%20the%20permanent%20deletion%20of%20my%20ZipRocket%20account%20and%20associated%20data.%0A%0AMy%20registered%20phone%20number%20is%3A%20%2B91%20";
  const whatsappHref =
    "https://wa.me/919117662441?text=Hi%20ZipRocket%2C%20I%20would%20like%20to%20request%20the%20deletion%20of%20my%20account.%20My%20registered%20phone%20number%20is%3A%20";

  return (
    <article className="space-y-6">
      <header className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Delete your ZipRocket account
        </h1>
        <p className="text-sm font-semibold text-[#FF5C00] mt-1">
          Request permanent deletion of your account and personal data
        </p>
      </header>

      <section className="space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed">
        <p>
          At <strong>ZipRocket</strong>, we respect your privacy and give you full control over your personal information. You can request the permanent deletion of your ZipRocket account and associated data at any time through our mobile application or by submitting a request to our customer support team.
        </p>

        <div className="space-y-2">
          <h2 className="text-lg font-black text-[#FF5C00]">Option 1: In the App (Recommended)</h2>
          <p>
            If you have the ZipRocket app installed on your device, you can delete your account directly at any time:
          </p>
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2">
            <p className="font-bold text-slate-900">
              Open ZipRocket &rarr; Profile &rarr; Delete account &rarr; type DELETE to confirm.
            </p>
            <p className="text-xs sm:text-sm text-slate-600">
              Your profile, saved delivery addresses, device push notification tokens, and active sessions will be deleted immediately upon confirmation.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-black text-[#FF5C00]">Option 2: Without the App</h2>
          <p>
            If you have uninstalled the app or cannot log in, you can request account deletion by emailing or messaging our customer support team:
          </p>
          <p>
            Please email our support address at{" "}
            <a
              href={mailtoHref}
              className="text-[#FF5C00] font-semibold underline"
            >
              ziprocket.support@gmail.com
            </a>{" "}
            with the subject line <strong>&quot;Account deletion request&quot;</strong>, sent from or mentioning your registered mobile number.
          </p>
          <p>
            To verify account ownership and prevent unauthorized requests, we verify ownership by sending an OTP to that phone number. Once verified, we complete deletion within 30 days.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <a
              href={mailtoHref}
              className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-[#FF5C00]/40 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF5C00] flex items-center justify-center shrink-0 group-hover:bg-[#FF5C00] group-hover:text-white transition-colors">
                <MdEmail className="text-xl" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Request</p>
                <p className="text-sm font-bold text-slate-900 break-all group-hover:text-[#FF5C00] transition-colors">
                  ziprocket.support@gmail.com
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Pre-filled subject: Account deletion request</p>
              </div>
            </a>

            <a
              href={whatsappHref}
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
                <p className="text-xs text-slate-500 mt-0.5">Message us on WhatsApp</p>
              </div>
            </a>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <h2 className="text-lg font-black text-[#FF5C00]">What Is Deleted</h2>
          <p>
            Upon account deletion, the following personal data is permanently removed:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
            <li>Name and profile details</li>
            <li>Phone number and email address</li>
            <li>Profile photo</li>
            <li>Saved delivery addresses and GPS coordinates</li>
            <li>Notification settings and device tokens</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-black text-[#FF5C00]">What May Be Kept</h2>
          <p>
            Past order and payment records may be kept only for the period required by applicable law, for accounting, tax and fraud prevention. Historical records are retained in compliance with statutory obligations.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 mt-4 space-y-1.5">
          <h2 className="text-sm font-black text-amber-900">Active Orders</h2>
          <p className="text-xs sm:text-sm text-amber-800">
            Active orders must be completed before deletion. If you have an active order in progress, your account can be deleted once that order is delivered or cancelled.
          </p>
        </div>
      </section>
    </article>
  );
}
