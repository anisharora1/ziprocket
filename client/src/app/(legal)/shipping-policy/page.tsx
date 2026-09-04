import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | ZipRocket",
  description: "Shipping and Delivery Policy for ZipRocket hyperlocal delivery services.",
};

export default function ShippingPolicyPage() {
  return (
    <article className="space-y-6">
      <header className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Shipping &amp; Delivery Policy
        </h1>
        <p className="text-sm font-semibold text-[#FF5C00] mt-1">
          Hyperlocal fulfillment and delivery information
        </p>
      </header>

      <section className="space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed">
        <p className="font-semibold text-slate-800">
          ZipRocket delivers food and grocery orders within defined hyperlocal delivery zones, currently centered around Benipatti, Madhubani, Bihar. Delivery availability, distance limits, and fees are shown at checkout before you place an order, and vary based on your exact location.
        </p>

        <h2 className="text-lg font-black text-[#FF5C00] pt-2">Delivery Terms</h2>
        <ul className="space-y-3.5 list-disc pl-5 text-slate-700">
          <li>
            <strong>Delivery Estimates:</strong> Estimated delivery time is shown at checkout and includes both preparation time and travel time.
          </li>
          <li>
            <strong>Delivery Charges:</strong> Delivery fees are calculated based on distance from the restaurant/store to your address, and may include a small platform and packaging fee, shown transparently in your bill before payment.
          </li>
          <li>
            <strong>Free Delivery:</strong> Orders above a certain value (shown at checkout, varies by zone) qualify for free delivery.
          </li>
          <li>
            <strong>Service Zones:</strong> We currently only deliver within our active service zones; addresses outside these zones cannot be served, and this will be indicated at checkout.
          </li>
        </ul>
      </section>
    </article>
  );
}
