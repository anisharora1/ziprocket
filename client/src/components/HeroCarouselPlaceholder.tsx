// Static Server Component: renders the first hero banner directly in SSR HTML for optimal LCP.
// Uses a direct <img> tag with fetchpriority="high" to guarantee the LCP image is immediately
// discoverable and prioritized — Next.js Image component doesn't always pass fetchpriority through.
import Link from "next/link";
import Image from "next/image";

const FIRST_BANNER = {
  title: "Delicious Meals Delivered Fast",
  description: "Get up to 50% off on your first order!",
  // Use the Next.js image optimization endpoint so we serve a smaller, properly sized image
  image: "/_next/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1504674900247-0877df9cc836%3Fauto%3Dformat%26fit%3Dcrop%26q%3D80%26w%3D1200&w=1080&q=75",
  href: "/restaurants",
  badge: "Mega Deal",
};

/**
 * HeroCarouselPlaceholder: Server-side rendered first banner.
 * - Uses raw <img> with fetchpriority="high" for guaranteed LCP prioritization
 * - Renders in initial HTML so Lighthouse sees a real, visible LCP element immediately
 * - The interactive HeroCarouselClient overlays this after React hydrates
 */
export default function HeroCarouselPlaceholder() {
  return (
    <section>
      <Link href={FIRST_BANNER.href} className="w-full block">
        <div
          style={{ position: "relative", height: "160px", borderRadius: "16px", overflow: "hidden" }}
          className="md:h-56 shadow-md hover:shadow-lg transition-shadow duration-300"
        >
          <Image
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&q=80&w=1000"
            alt={FIRST_BANNER.title}
            priority={true}
            fetchPriority="high"
            fill={true}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 50%, transparent 100%)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <span
              style={{
                background: "#FF5C00",
                color: "#fff",
                fontSize: "9px",
                fontWeight: 900,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: "4px",
                display: "inline-block",
                marginBottom: "8px",
                width: "fit-content",
              }}
            >
              {FIRST_BANNER.badge}
            </span>
            <h2
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: "20px",
                lineHeight: "1.25",
                maxWidth: "240px",
                margin: 0,
              }}
            >
              {FIRST_BANNER.title}
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: "12px",
                fontWeight: 700,
                marginTop: "4px",
              }}
            >
              {FIRST_BANNER.description}
            </p>
          </div>
        </div>
      </Link>
    </section>
  );
}
