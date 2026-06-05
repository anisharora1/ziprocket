import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import HeroCarousel from "@/components/HeroCarousel";
import Categories from "@/components/Categories";
import TopRated from "@/components/TopRated";
import RestaurantList from "@/components/RestaurantList";
import BottomNavBar from "@/components/BottomNavBar";
import FloatingCartButton from "@/components/FloatingCartButton";

export default function Home() {
  return (
    <div className="bg-surface text-on-surface pb-24 min-h-screen w-full">
      <Header />
      
      <main className="mt-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-xl w-full">
        <SearchBar />
        <HeroCarousel />
        <Categories />
        <TopRated />
        <RestaurantList />
      </main>
      
      <BottomNavBar />
      <FloatingCartButton />
    </div>
  );
}
