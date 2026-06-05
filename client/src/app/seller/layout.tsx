import SellerSidebar from "../../components/seller/SellerSidebar";
import SellerBottomNav from "../../components/seller/SellerBottomNav";
import SellerMobileHeader from "../../components/seller/SellerMobileHeader";
import AuthGuard from "../../components/AuthGuard";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={['seller']}>
      <div className="flex bg-slate-50">
        {/* Desktop Sidebar */}
        <SellerSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 relative">

          <SellerMobileHeader />

          {/* Scrollable Main Content */}
          <div className="flex-1 pb-20 md:pb-0">
            {children}
          </div>

          {/* Mobile Bottom Navigation */}
          <SellerBottomNav />
        </div>
      </div>
    </AuthGuard>
  );
}
