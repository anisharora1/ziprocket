import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions | ZipRocket",
  description: "Terms and Conditions governing the use of ZipRocket web and mobile platforms.",
};

export default function TermsAndConditionsPage() {
  return (
    <article className="space-y-6">
      <header className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Terms and Conditions
        </h1>
        <p className="text-sm font-semibold text-[#FF5C00] mt-1">
          User Agreement &amp; Operating Policies
        </p>
      </header>

      <section className="space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed">
        <p className="font-semibold text-slate-800">
          By using ZipRocket (ziprocket.in and its mobile app), you agree to the following terms.
        </p>

        <h2 className="text-lg font-black text-[#FF5C00] pt-2">General Terms</h2>
        <ul className="space-y-3.5 list-disc pl-5 text-slate-700">
          <li>
            <strong>Platform Role:</strong> ZipRocket is a platform connecting customers with independent restaurants, grocery stores, and delivery partners. We are not the manufacturer or preparer of food/grocery items sold through the platform.
          </li>
          <li>
            <strong>Order Acceptance:</strong> Orders are subject to acceptance by the restaurant/store. An order is not confirmed until the seller has accepted it.
          </li>
          <li>
            <strong>Payment Modes:</strong> Payment can be made via UPI (processed securely through Razorpay) or Cash on Delivery, depending on availability in your area.
          </li>
          <li>
            <strong>Delivery Estimates:</strong> Delivery times shown are estimates based on distance and preparation time, and may vary due to traffic, weather, or high demand.
          </li>
          <li>
            <strong>User Responsibilities:</strong> Users must provide accurate delivery addresses and contact details. ZipRocket is not responsible for delivery failures due to incorrect information provided by the customer.
          </li>
          <li>
            <strong>Platform Misuse:</strong> Misuse of the platform, including placing fraudulent orders, abusive behavior toward delivery partners or restaurant staff, or providing false information during registration (as a customer, restaurant, or delivery partner), may result in account suspension.
          </li>
          <li>
            <strong>Modifications:</strong> ZipRocket reserves the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.
          </li>
          <li>
            <strong>Governing Law &amp; Jurisdiction:</strong> These terms are governed by the laws of India, with courts in Madhubani Bihar having jurisdiction.
          </li>
        </ul>
      </section>
    </article>
  );
}
