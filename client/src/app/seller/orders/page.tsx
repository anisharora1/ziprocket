"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { useOrderSocket } from "../../../hooks/useOrderSocket";
import { useSellerOrders } from "../../../hooks/useOrders";
import { useQueryClient } from "@tanstack/react-query";
import { MdClose, MdCheck } from "react-icons/md";

export default function SellerOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // TanStack Query — single source of truth for seller orders
  const { data: orders = [], isLoading: ordersLoading } = useSellerOrders();
  const isDataLoading = authLoading || ordersLoading;

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'seller') {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Real-time socket events
  useOrderSocket({
    onNewOrder: (data) => {
      if (data?.order) {
        // Prepend the new order optimistically, deduplicate
        queryClient.setQueryData(['orders', 'seller'], (prev: any[] = []) => {
          if (prev.some(o => o._id === data.order._id)) return prev;
          return [data.order, ...prev];
        });
      }
      queryClient.invalidateQueries({ queryKey: ['orders', 'seller'] });
    },
    onOrderStatusUpdated: (data) => {
      if (data?.orderId && data?.orderStatus) {
        queryClient.setQueryData(['orders', 'seller'], (prev: any[] = []) =>
          prev.map(o => o._id === data.orderId ? { ...o, orderStatus: data.orderStatus } : o)
        );
        queryClient.invalidateQueries({ queryKey: ['orders', 'seller'] });
      }
    },
    onOrderCancelled: (data) => {
      if (data?.orderId) {
        queryClient.setQueryData(['orders', 'seller'], (prev: any[] = []) =>
          prev.map(o => o._id === data.orderId ? { ...o, orderStatus: 'cancelled' } : o)
        );
        queryClient.invalidateQueries({ queryKey: ['orders', 'seller'] });
      }
    },
    onDeliveryAccepted: (data) => {
      if (data?.orderId) {
        queryClient.setQueryData(['orders', 'seller'], (prev: any[] = []) =>
          prev.map(o => o._id === data.orderId ? { ...o, orderStatus: 'accepted_by_delivery' } : o)
        );
        queryClient.invalidateQueries({ queryKey: ['orders', 'seller'] });
      }
    },
    onDeliveryStatusUpdated: (data) => {
      if (data?.orderId && data?.status) {
        queryClient.setQueryData(['orders', 'seller'], (prev: any[] = []) =>
          prev.map(o => o._id === data.orderId ? { ...o, orderStatus: data.status } : o)
        );
        queryClient.invalidateQueries({ queryKey: ['orders', 'seller'] });
      }
    },
    onOrderDelivered: (data) => {
      if (data?.orderId) {
        queryClient.setQueryData(['orders', 'seller'], (prev: any[] = []) =>
          prev.map(o => o._id === data.orderId ? { ...o, orderStatus: 'delivered' } : o)
        );
        queryClient.invalidateQueries({ queryKey: ['orders', 'seller'] });
      }
    },
    onReconnect: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'seller'] });
    },
  });

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await apiClient.patch(`/orders/${orderId}/status`, { orderStatus: status });
      if (res.data.success) {
        // Immediate optimistic update
        queryClient.setQueryData(['orders', 'seller'], (prev: any[] = []) =>
          prev.map(o => o._id === orderId ? { ...o, orderStatus: status } : o)
        );
        // Background sync
        queryClient.invalidateQueries({ queryKey: ['orders', 'seller'] });
      }
    } catch (err) {
      console.error("Failed to update order status", err);
    }
  };

  const incomingOrders = orders.filter(o => o.orderStatus === "placed");
  // Show food orders through their full lifecycle so seller can track dispatch
  const activeOrders = orders.filter(o =>
    ["accepted", "preparing", "accepted_by_delivery", "on_the_way"].includes(o.orderStatus)
  );

  if (isDataLoading) {
    return <div className="p-8 text-center text-slate-500">Loading Orders...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col h-full">

      {/* Desktop Header */}
      <div className="hidden md:flex justify-between items-end mb-8">
        <div>
          <h1 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none mb-2">Order Management</h1>
          <p className="text-[15px] text-slate-500">Manage incoming requests and active kitchen tickets.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 items-start">

        {/* Left Column: Incoming Orders */}
        <div className="xl:col-span-1 flex flex-col gap-4">

          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-[20px] font-bold text-slate-900">Incoming</h2>
            <span className="px-2.5 py-1 bg-amber-500 text-white text-[11px] font-bold rounded-full">{incomingOrders.length} New</span>
          </div>

          {incomingOrders.length === 0 && (
            <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-slate-500 font-medium">No incoming orders right now.</p>
            </div>
          )}

          {incomingOrders.map(order => (
            <div key={order._id} className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border-l-[4px] border-l-amber-400 border-y border-r border-slate-100 p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">#{order._id.slice(-6).toUpperCase()}</p>
                  <h3 className="text-[18px] font-bold text-slate-900 leading-none">{order.user?.name || "Guest"}</h3>
                </div>
              </div>

              <div className="flex flex-col gap-2 mb-5">
                {order.items?.map((item: any, i: number) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 flex items-start gap-3">
                    <span className="text-[13px] font-bold text-emerald-600">{item.quantity}x</span>
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-slate-900">{item.menuItem?.name || "Item"}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mb-5">
                <p className="text-[13px] text-slate-500 font-medium">Total Price</p>
                <p className="text-[15px] font-bold text-slate-900">₹{order.totalAmount}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateOrderStatus(order._id, 'cancelled')}
                  className="flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <MdClose className="text-[18px]" />
                  Reject
                </button>
                <button
                  onClick={() => updateOrderStatus(order._id, 'accepted')}
                  className="flex items-center justify-center gap-2 py-3 bg-emerald-700 text-white rounded-xl text-[14px] font-bold hover:bg-emerald-800 transition-colors shadow-sm"
                >
                  <MdCheck className="text-[18px]" />
                  Accept
                </button>
              </div>
            </div>
          ))}

        </div>

        {/* Right Column: Current Kitchen Queue */}
        <div className="xl:col-span-2 flex flex-col gap-4 mt-8 xl:mt-0">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <h2 className="text-[18px] md:text-[20px] font-bold text-slate-900">Current Orders</h2>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-5 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-1/4">Order ID</th>
                    <th className="py-5 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-1/2">Items</th>
                    <th className="py-5 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
                    <th className="py-5 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {activeOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-500 font-medium">No active kitchen orders.</td>
                    </tr>
                  ) : (
                    activeOrders.map(order => (
                      <tr key={order._id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-5 px-6">
                          <p className="text-[14px] font-bold text-slate-900 mb-1">#{order._id.slice(-6).toUpperCase()}</p>
                          <p className="text-[12px] text-slate-500">{order.user?.name}</p>
                        </td>
                        <td className="py-5 px-6">
                          <p className="text-[13px] text-slate-600 leading-relaxed">
                            {order.items?.map((item: any) => `${item.quantity}x ${item.menuItem?.name}`).join(', ')}
                          </p>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <span className={`px-2 py-1 text-[11px] font-bold rounded-md ${
                            order.orderStatus === 'preparing'    ? 'bg-amber-100 text-amber-700' :
                            order.orderStatus === 'accepted'     ? 'bg-blue-100 text-blue-700'  :
                            order.orderStatus === 'accepted_by_delivery' ? 'bg-indigo-100 text-indigo-700' :
                            order.orderStatus === 'on_the_way'  ? 'bg-indigo-100 text-indigo-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {order.orderStatus === 'accepted_by_delivery' ? 'PICKED UP' : order.orderStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-5 px-6 text-right">
                          {order.orderStatus === 'accepted' && (
                            <button
                              onClick={() => updateOrderStatus(order._id, 'preparing')}
                              className="px-3 py-1 bg-amber-600 text-white text-[12px] font-bold rounded hover:bg-amber-700"
                            >
                              Start Cooking
                            </button>
                          )}
                          {order.orderStatus === 'preparing' && (
                            <button
                              onClick={() => updateOrderStatus(order._id, 'on_the_way')}
                              className="px-3 py-1 bg-emerald-600 text-white text-[12px] font-bold rounded hover:bg-emerald-700"
                            >
                              Ready for Delivery
                            </button>
                          )}
                          {/* accepted_by_delivery / on_the_way: delivery boy owns it — no seller action */}
                          {['accepted_by_delivery', 'on_the_way'].includes(order.orderStatus) && (
                            <span className="text-[11px] text-slate-400 font-semibold">En route ⭐</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
