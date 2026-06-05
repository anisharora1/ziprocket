"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

export default function SellerFinancePage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [completedOrdersCount, setCompletedOrdersCount] = useState(0);
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
        const ordersRes = await apiClient.get('/orders/my-orders');
        if (ordersRes.data.success) {
          const fetchedOrders = ordersRes.data.orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrders(fetchedOrders);
          
          // Calculate overall metrics
          const completedOrders = fetchedOrders.filter((order: any) => order.status === 'delivered');
          setCompletedOrdersCount(completedOrders.length);
          
          // We calculate total revenue from all orders as per user preference (or just delivered? Let's use all for overall income)
          // "overall income on finance dashboard" - Let's calculate total revenue from all orders.
          setTotalRevenue(fetchedOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0));
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

  const averageOrderValue = orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : "0.00";

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
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download Report
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        
        {/* Total Earnings */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 shadow-lg shadow-emerald-500/20 text-white relative overflow-hidden">
          <span className="material-symbols-outlined absolute right-[-10px] bottom-[-20px] text-[120px] opacity-20 pointer-events-none transform -rotate-12">account_balance</span>
          <div className="flex justify-between items-start relative z-10 mb-6">
            <p className="text-[11px] font-bold tracking-widest uppercase opacity-80">Overall Income</p>
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            </div>
          </div>
          <h2 className="text-[40px] font-black tracking-tight leading-none mb-3 relative z-10">₹{totalRevenue.toLocaleString()}</h2>
          <p className="text-[12px] font-medium flex items-center gap-1 relative z-10 opacity-90">
            <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
            Lifetime earnings
          </p>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100">
          <div className="flex justify-between items-start mb-6">
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Total Orders</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
            </div>
          </div>
          <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">{orders.length}</h2>
          <p className="text-[12px] text-slate-500 flex items-center gap-1 font-medium">
             <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-1"></span>
             {completedOrdersCount} Delivered
          </p>
        </div>

        {/* Average Order Value */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100">
          <div className="flex justify-between items-start mb-6">
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Avg. Order Value</p>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">analytics</span>
            </div>
          </div>
          <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">₹{averageOrderValue}</h2>
          <p className="text-[12px] text-slate-500 flex items-center gap-1 font-medium">
             Revenue per order
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
              <span className="material-symbols-outlined text-[48px] text-slate-300 mb-4">receipt_long</span>
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
                          order.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' :
                          order.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {order.status}
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
