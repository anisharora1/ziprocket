"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import dynamic from "next/dynamic";
import {
  MdCalendarToday as MdCalendarTodayIcon,
  MdAttachMoney as MdAttachMoneyIcon,
  MdPayments as MdPaymentsIcon,
  MdTrendingUp as MdTrendingUpIcon,
  MdShoppingCart as MdShoppingCartIcon,
  MdStorefront as MdStorefrontIcon,
  MdStore as MdStoreIcon,
} from "react-icons/md";

const SellerLiveOrders = dynamic(() => import("./components/SellerLiveOrders"), {
  ssr: false,
  loading: () => <div className="p-4 text-center text-slate-500">Loading Live Orders...</div>
});

export default function SellerDashboardPage() {
  const [restaurant, setRestaurant] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayOrdersCount, setTodayOrdersCount] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [toggling, setToggling] = useState<boolean>(false);

  const handleToggleAvailability = async () => {
    if (!restaurant || toggling) return;
    try {
      setToggling(true);
      const newStatus = !isActive;
      const res = await apiClient.put(`/restaurants/${restaurant._id}`, { isActive: newStatus });
      if (res.data.success) {
        setIsActive(newStatus);
        setRestaurant((prev: any) => ({ ...prev, isActive: newStatus }));
      }
    } catch (err) {
      console.error("Failed to update availability:", err);
      alert("Failed to toggle availability. Please try again.");
    } finally {
      setToggling(false);
    }
  };
  
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    
    if (!user || user.role !== 'seller') {
      router.push('/auth/login');
      return;
    }

    const fetchData = async () => {
      try {
        const restRes = await apiClient.get('/restaurants/my-restaurant');
        if (restRes.data.success && restRes.data.restaurant) {
          setRestaurant(restRes.data.restaurant);
          setIsActive(restRes.data.restaurant.isActive !== undefined ? restRes.data.restaurant.isActive : true);
          
          const ordersRes = await apiClient.get('/orders/my-orders');
          if (ordersRes.data.success) {
            const fetchedOrders = ordersRes.data.orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setOrders(fetchedOrders);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const todaysOrders = fetchedOrders.filter((order: any) => {
              const orderDate = new Date(order.createdAt);
              return orderDate >= today;
            });
            
            setTodayOrdersCount(todaysOrders.length);
            setTodayRevenue(todaysOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0));
          }
        }
      } catch (error) {
        console.error("Failed to fetch seller dashboard data:", error);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchData();
  }, [user, authLoading, router]);

  const formatTimeAgo = (dateStr: string) => {
     if(!dateStr) return "00:00";
     const diffMs = new Date().getTime() - new Date(dateStr).getTime();
     const diffMins = Math.floor(diffMs / 60000);
     const hours = Math.floor(diffMins / 60);
     const mins = diffMins % 60;
     return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const preparingOrdersCount = orders.filter(o => o.status === 'preparing').length;

  if (authLoading || isDataLoading) {
    return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;
  }

  if (!restaurant) {
    return <div className="p-8 text-center text-rose-500">No restaurant found linked to your account.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 md:mb-8 mt-2 md:mt-0">
        <div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">
            Good Morning, {restaurant.name}
          </h1>
          <p className="text-[13px] md:text-[15px] text-slate-500">Here's what's happening in your kitchen today.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Availability Toggle Switch */}
          <div className="flex items-center gap-2.5 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex flex-col items-start pr-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Status</span>
              <span className={`text-[12px] font-extrabold leading-none transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                {isActive ? 'Online / Available' : 'Offline / Unavailable'}
              </span>
            </div>
            <button 
              onClick={handleToggleAvailability}
              disabled={toggling}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isActive ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
            >
              <span 
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 shadow-sm">
            <MdCalendarTodayIcon className="text-[18px]" />
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex flex-col gap-6 md:gap-8">
        
        {/* Top KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          
          {/* Revenue */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 relative overflow-hidden">
            <MdAttachMoneyIcon className="absolute right-[-10px] bottom-[-20px] text-[140px] text-slate-50 opacity-50 pointer-events-none transform -rotate-12" />
            <div className="flex justify-between items-start relative z-10 mb-6">
              <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Today's Revenue</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <MdPaymentsIcon className="text-[18px]" />
              </div>
            </div>
            <h2 className="text-[40px] font-light text-slate-900 tracking-tight leading-none mb-3 relative z-10">₹{todayRevenue.toLocaleString()}</h2>
            <p className="text-[12px] font-medium text-emerald-600 flex items-center gap-1 relative z-10">
              <MdTrendingUpIcon className="text-[14px]" />
              Income generated today
            </p>
          </div>

          {/* Orders */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10 mb-6">
              <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Today's Orders</p>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <MdShoppingCartIcon className="text-[18px]" />
              </div>
            </div>
            <h2 className="text-[40px] font-light text-slate-900 tracking-tight leading-none mb-3 relative z-10">{todayOrdersCount}</h2>
            <p className="text-[12px] font-medium text-slate-500 relative z-10">
              Orders placed today
            </p>
          </div>

        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          {/* Left/Main Column */}
          <div className="lg:col-span-2 flex flex-col gap-6 md:gap-8">
            {/* Live Orders Component */}
            <SellerLiveOrders initialOrders={orders} restaurantId={restaurant._id} />
          </div>

          {/* Right/Side Column */}
          <div className="flex flex-col gap-6 md:gap-8">
            
            {/* Recent Alerts */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100">
              <h3 className="text-[16px] font-bold text-slate-900 mb-6">Recent Alerts</h3>
              
              <div className="flex flex-col gap-6">
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isActive ? (
                      <MdStorefrontIcon className="text-[20px]" />
                    ) : (
                      <MdStoreIcon className="text-[20px]" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-slate-900 mb-1">
                      {isActive ? 'Restaurant Available' : 'Restaurant Offline'}
                    </h4>
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      {isActive 
                        ? 'Your restaurant is currently visible to customers and accepting new orders.' 
                        : 'Your restaurant is hidden from the user dashboard and not accepting new orders.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

