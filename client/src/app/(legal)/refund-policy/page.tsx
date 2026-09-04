import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy | ZipRocket",
  description: "Cancellation and Refund Policy for ZipRocket orders.",
};

export default function RefundPolicyPage() {
  return (
    <article className="space-y-6">
      <header className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Refund Policy
        </h1>
        <p className="text-sm font-semibold text-[#FF5C00] mt-1">
          Cancellations, returns, and refund processing terms
        </p>
      </header>

      <section className="space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed">
        <h2 className="text-lg font-black text-[#FF5C00]">Cancellation &amp; Refund Guidelines</h2>

        <ul className="space-y-3.5 list-disc pl-5 text-slate-700">
          <li>
            <strong>Cancellation Before Acceptance:</strong> If an order is cancelled before the restaurant/store accepts it, a full refund is processed automatically for online payments.
          </li>
          <li>
            <strong>Post-Acceptance Policy:</strong> Once a restaurant/store has accepted an order, it generally cannot be cancelled, since preparation begins immediately.
          </li>
          <li>
            <strong>Damaged or Incorrect Items:</strong> If you receive a missing, incorrect, or damaged item, please contact us via WhatsApp (
            <a
              href="https://wa.me/919117662441?text=Hi%20ZipRocket%2C%20I%20have%20an%20issue%20with%20my%20order"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 font-bold underline"
            >
              +91 9117662441
            </a>
            ) within 2 hours of delivery with details/photos, and we will investigate and issue a refund or replacement where applicable.
          </li>
          <li>
            <strong>Refund Timelines:</strong> Approved refunds for online (UPI) payments are processed back to your original payment method within 24-48 hours. Actual credit to your account may take a few additional business days depending on your bank/UPI provider.
          </li>
          <li>
            <strong>Cash on Delivery:</strong> Cash on Delivery orders that are cancelled or undelivered do not require a refund, since no payment was collected upfront.
          </li>
        </ul>
      </section>
    </article>
  );
}
