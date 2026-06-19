import Header from "@/components/Header";
import DynamicSearchBar from "@/components/DynamicSearchBar";
import HeroCarouselPlaceholder from "@/components/HeroCarouselPlaceholder";
import HeroCarouselClient from "@/components/DynamicHeroCarousel";
import Categories from "@/components/Categories";
import TopRated from "@/components/TopRated";
import RestaurantList from "@/components/DynamicRestaurantList";
import FloatingCartButton from "@/components/DynamicFloatingCartButton";
import BottomNavBar from "@/components/DynamicBottomNavBar";
import FirstVisitInstallModal from "@/components/DynamicFirstVisitInstallModal";

export default function Home() {
  return (
    <div className="bg-surface text-on-surface pb-24 min-h-screen w-full">
      <Header />
      
      <main className="pt-20 mt-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-xl w-full">
        <DynamicSearchBar />
        {/* Hero Carousel: SSR placeholder ensures LCP image is in initial HTML.
            Client carousel mounts on top after hydration for interactivity.
            min-h prevents CLS when the absolute-positioned client carousel mounts. */}
        <div className="relative" style={{ minHeight: "160px" }}>
          <HeroCarouselPlaceholder />
          <HeroCarouselClient />
        </div>
        <Categories />
        <TopRated />
        <RestaurantList />
      </main>
      
      <BottomNavBar />
      <FloatingCartButton />
      <FirstVisitInstallModal />
    </div>
  );
}

