"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import {
  MdDownload,
  MdAccountBalance,
  MdAccountBalanceWallet,
  MdAllInclusive,
  MdShoppingBag,
  MdAnalytics,
  MdReceiptLong,
  MdCancel,
} from "react-icons/md";

export default function SellerFinancePage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [completedOrdersCount, setCompletedOrdersCount] = useState(0);
  const [cancelledOrdersCount, setCancelledOrdersCount] = useState(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [averageOrderValue, setAverageOrderValue] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    
    if (!user || user.role !== 'seller') {
      router.push('/auth/login');
      return;
    }

    const fetchFinanceData = async () => {
      try {
        const [ordersRes, statsRes] = await Promise.all([
          apiClient.get('/orders/my-orders'),
          apiClient.get('/orders/seller/stats')
        ]);

        if (ordersRes.data.success) {
          const fetchedOrders = (ordersRes.data.orders || []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrders(fetchedOrders);
        }

        if (statsRes.data.success) {
          setTotalRevenue(statsRes.data.totalRevenue || 0);
          setCompletedOrdersCount(statsRes.data.completedOrdersCount || 0);
          setCancelledOrdersCount(statsRes.data.cancelledOrdersCount || 0);
          setTotalOrdersCount(statsRes.data.totalOrdersCount || 0);
          setAverageOrderValue(statsRes.data.averageOrderValue || 0);
        }
      } catch (error) {
        console.error("Failed to fetch seller finance data:", error);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchFinanceData();
  }, [user, authLoading, router]);

  if (authLoading || isDataLoading) {
    return <div className="p-8 text-center text-slate-500">Loading Finance Data...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">
            Financial Overview
          </h1>
          <p className="text-[13px] md:text-[15px] text-slate-500">Track your overall income and performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
            <MdDownload className="text-[18px]" />
            Download Report
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Total Earnings */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 shadow-lg shadow-emerald-500/20 text-white relative overflow-hidden">
          <MdAccountBalance className="absolute right-[-10px] bottom-[-20px] text-[120px] opacity-20 pointer-events-none transform -rotate-12" />
          <div className="flex justify-between items-start relative z-10 mb-6">
            <p className="text-[11px] font-bold tracking-widest uppercase opacity-80">Overall Income</p>
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <MdAccountBalanceWallet className="text-[18px]" />
            </div>
          </div>
          <h2 className="text-[36px] font-black tracking-tight leading-none mb-3 relative z-10">₹{totalRevenue.toLocaleString()}</h2>
          <p className="text-[12px] font-medium flex items-center gap-1 relative z-10 opacity-90">
            <MdAllInclusive className="text-[14px]" />
            Delivered orders only
          </p>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100">
          <div className="flex justify-between items-start mb-6">
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Total Orders</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <MdShoppingBag className="text-[18px]" />
            </div>
          </div>
          <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">{totalOrdersCount}</h2>
          <p className="text-[12px] text-slate-500 flex items-center gap-1 font-medium">
             <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1"></span>
             {completedOrdersCount} Delivered
          </p>
        </div>

        {/* Average Order Value */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100">
          <div className="flex justify-between items-start mb-6">
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Avg. Order Value</p>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <MdAnalytics className="text-[18px]" />
            </div>
          </div>
          <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">₹{averageOrderValue.toLocaleString()}</h2>
          <p className="text-[12px] text-slate-500 flex items-center gap-1 font-medium">
             Revenue ÷ completed
          </p>
        </div>

        {/* Cancelled Orders */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100">
          <div className="flex justify-between items-start mb-6">
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Cancelled Orders</p>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <MdCancel className="text-[18px]" />
            </div>
          </div>
          <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">{cancelledOrdersCount}</h2>
          <p className="text-[12px] text-rose-500 flex items-center gap-1 font-medium">
             <span className="w-2 h-2 rounded-full bg-rose-500 inline-block mr-1"></span>
             Orders cancelled
          </p>
        </div>

      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <h3 className="text-[16px] font-bold text-slate-900">Recent Transactions</h3>
           <button className="text-[13px] font-bold text-[#FF5C00] hover:text-[#e05200] transition-colors">
              View All
           </button>
        </div>
        
        {orders.length === 0 ? (
           <div className="p-12 text-center text-slate-500">
              <MdReceiptLong className="text-[48px] text-slate-300 mb-4 mx-auto" />
              <p>No transactions found.</p>
           </div>
        ) : (
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                   <th className="px-6 py-4">Order ID</th>
                   <th className="px-6 py-4">Date & Time</th>
                   <th className="px-6 py-4">Status</th>
                   <th className="px-6 py-4 text-right">Amount</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {orders.slice(0, 10).map((order) => (
                   <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-6 py-4">
                       <span className="text-[13px] font-bold text-slate-700">#{order._id.slice(-6).toUpperCase()}</span>
                     </td>
                     <td className="px-6 py-4">
                       <div className="text-[13px] text-slate-600 font-medium">
                         {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                       </div>
                       <div className="text-[11px] text-slate-400">
                         {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                       </div>
                     </td>
                     <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          (order.orderStatus || order.status) === 'delivered' ? 'bg-emerald-50 text-emerald-600' :
                          (order.orderStatus || order.status) === 'cancelled' ? 'bg-red-50 text-red-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {order.orderStatus || order.status}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                       <span className="text-[14px] font-black text-slate-900">₹{order.totalAmount}</span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        )}
      </div>

    </div>
  );
}
