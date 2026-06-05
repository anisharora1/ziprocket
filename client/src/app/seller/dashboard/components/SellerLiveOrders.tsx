"use client";
import { useState, useEffect } from "react";
import { apiClient } from "../../../../services/api";
import { useRouter } from "next/navigation";

export default function SellerLiveOrders({ initialOrders, restaurantId }: { initialOrders: any[], restaurantId: string }) {
    const [orders, setOrders] = useState(initialOrders);
    const router = useRouter();

    const fetchOrders = async () => {
        try {
            const res = await apiClient.get(`/orders/restaurant/${restaurantId}`, { headers: { "Cache-Control": "no-cache" } });
            if (res.data.success) {
                const sortedOrders = res.data.orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setOrders(sortedOrders);
            }
        } catch (error) {
            console.error("Failed to poll orders:", error);
        }
    };

    // Poll every 5 seconds
    useEffect(() => {
        if (!restaurantId) return;
        const interval = setInterval(fetchOrders, 5000);
        return () => clearInterval(interval);
    }, [restaurantId]);

    const updateStatus = async (orderId: string, newStatus: string) => {
        try {
            await apiClient.patch(`/orders/${orderId}/status`, { orderStatus: newStatus });
            // Optimistic update
            setOrders(prev => prev.map(o => o._id === orderId ? { ...o, orderStatus: newStatus, status: newStatus } : o));
            // Force a router refresh to update server components (like the Revenue KPI)
            router.refresh();
        } catch (error) {
            console.error("Failed to update status:", error);
            alert("Failed to update status");
        }
    };

    const formatTimeAgo = (dateStr: string) => {
        if(!dateStr) return "00:00";
        const diffMs = new Date().getTime() - new Date(dateStr).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    // Filter to only show orders that belong in the kitchen (not delivered/cancelled yet)
    // Actually, maybe show all recent ones, but buttons only appear for actionable states.
    // The backend uses 'orderStatus', but the previous static code used 'status'. Let's normalize it.
    const displayOrders = orders.filter(o => {
        const s = o.orderStatus || o.status;
        return ['placed', 'accepted', 'preparing', 'on_the_way'].includes(s);
    });

    const preparingOrdersCount = displayOrders.filter(o => (o.orderStatus || o.status) === 'preparing').length;

    return (
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                <h3 className="text-[16px] font-bold text-slate-900">Live Orders</h3>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-md tracking-widest uppercase">{preparingOrdersCount} Preparing</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order ID</th>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer / Total</th>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time Elapsed</th>
                            <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {displayOrders.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-slate-500 text-[13px]">No recent orders.</td>
                            </tr>
                        ) : (
                            displayOrders.slice(0, 5).map(order => {
                                const currentStatus = order.orderStatus || order.status;
                                return (
                                    <tr key={order._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6 text-[13px] font-bold text-slate-700">
                                            #{order._id.substring(order._id.length - 4).toUpperCase()}
                                            <span className="block text-[10px] font-normal text-slate-400 mt-0.5">{currentStatus.replace('_', ' ')}</span>
                                        </td>
                                        <td className="py-4 px-6 text-[13px] text-slate-600">
                                            {order.user?.name || order.customer?.name || "Customer"}
                                            <span className="block font-bold text-emerald-600 mt-0.5">₹{order.totalAmount}</span>
                                        </td>
                                        <td className={`py-4 px-6 text-[13px] font-bold ${currentStatus === 'preparing' ? 'text-rose-500' : 'text-slate-700'}`}>
                                            {formatTimeAgo(order.createdAt)}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            {currentStatus === 'placed' && (
                                                <button onClick={() => updateStatus(order._id, 'accepted')} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded text-[11px] font-bold hover:bg-blue-100 transition-colors">
                                                    Accept
                                                </button>
                                            )}
                                            {currentStatus === 'accepted' && (
                                                <button onClick={() => updateStatus(order._id, 'preparing')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded text-[11px] font-bold hover:bg-emerald-100 transition-colors">
                                                    Start Cooking
                                                </button>
                                            )}
                                            {currentStatus === 'preparing' && (
                                                <span className="text-[11px] font-bold text-slate-400">Waiting for Delivery Pick Up</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
