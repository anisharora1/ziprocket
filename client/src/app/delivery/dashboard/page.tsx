"use client";

import { useState, useEffect } from "react";
import { apiClient } from "../../../services/api";

interface OrderItem {
  _id: string;
  menuItem?: { name: string };
  groceryItem?: { name: string };
  quantity: number;
  price: number;
}

interface Order {
  _id: string;
  user: {
    name: string;
    phone: string;
  };
  restaurant?: {
    name: string;
    address: string;
    location?: { lat: number; lng: number };
  };
  deliveryZone?: {
    name: string;
    center: { lat: number; lng: number };
  };
  orderType: "food" | "grocery";
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: "COD" | "ONLINE";
  paymentStatus: "pending" | "paid" | "failed";
  orderStatus: string;
  address: {
    fullAddress: string;
    lat?: number;
    lng?: number;
  };
  createdAt: string;
}

interface DeliveryRecord {
  _id: string;
  order: Order;
  status: string;
  earnings: number;
  createdAt: string;
}

export default function DeliveryDashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [toggling, setToggling] = useState<boolean>(false);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(true);
  
  // Tab states
  const [activeTab, setActiveTab] = useState<"pending" | "accepted" | "history" | "rejected">("pending");
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryRecord[]>([]);
  const [completedDeliveries, setCompletedDeliveries] = useState<DeliveryRecord[]>([]);
  const [rejectedOrders, setRejectedOrders] = useState<Order[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const handleCopyAddress = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Address copied to clipboard! / पता कॉपी हो गया!");
  };

  // Fetch Delivery Boy profile
  const fetchProfile = async () => {
    try {
      setIsProfileLoading(true);
      const res = await apiClient.get("/delivery/profile/my-profile");
      if (res.data.success && res.data.profile) {
        setProfile(res.data.profile);
        setIsActive(res.data.profile.isActive !== undefined ? res.data.profile.isActive : true);
      }
    } catch (err) {
      console.error("Failed to fetch courier profile:", err);
    } finally {
      setIsProfileLoading(false);
    }
  };

  // Fetch all categories of orders for the dashboard
  const fetchDashboardData = async () => {
    if (!isActive) return;
    try {
      const [pendingRes, myDeliveriesRes, completedRes, rejectedRes] = await Promise.all([
        apiClient.get("/delivery/pending"),
        apiClient.get("/delivery/my-deliveries"),
        apiClient.get("/delivery/my-deliveries?type=completed"),
        apiClient.get("/delivery/rejected")
      ]);

      if (pendingRes.data.success) {
        setPendingOrders(pendingRes.data.orders || []);
      }
      if (myDeliveriesRes.data.success) {
        setActiveDeliveries(myDeliveriesRes.data.deliveries || []);
      }
      if (completedRes.data.success) {
        setCompletedDeliveries(completedRes.data.deliveries || []);
      }
      if (rejectedRes.data.success) {
        setRejectedOrders(rejectedRes.data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load delivery orders data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchDashboardData();
      // Poll orders status every 5 seconds to ensure instant real-time sync
      const interval = setInterval(fetchDashboardData, 5000);
      return () => clearInterval(interval);
    } else {
      setPendingOrders([]);
      setActiveDeliveries([]);
      setCompletedDeliveries([]);
      setRejectedOrders([]);
      setLoading(false);
    }
  }, [isActive]);

  const handleToggleAvailability = async () => {
    if (toggling || isProfileLoading) return;
    try {
      setToggling(true);
      const newStatus = !isActive;
      const res = await apiClient.put("/delivery/profile/availability", { isActive: newStatus });
      if (res.data.success) {
        setIsActive(newStatus);
        setProfile((prev: any) => ({ ...prev, isActive: newStatus }));
      }
    } catch (err) {
      console.error("Failed to update availability:", err);
      alert("Failed to toggle availability status. Please try again.");
    } finally {
      setToggling(false);
    }
  };

  // Accept a pending delivery order
  const handleAcceptOrder = async (orderId: string) => {
    setActioningId(orderId);
    try {
      const res = await apiClient.post("/delivery/accept", { orderId });
      if (res.data.success) {
        alert("Delivery task accepted successfully!");
        setActiveTab("accepted"); // Direct to accepted tab instantly
        fetchDashboardData();
      }
    } catch (err: any) {
      console.error("Failed to accept order:", err);
      alert(err.response?.data?.message || "Failed to accept order");
    } finally {
      setActioningId(null);
    }
  };

  // Reject a pending delivery order
  const handleRejectOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to reject this delivery request?")) return;
    setActioningId(orderId);
    try {
      const res = await apiClient.post("/delivery/reject", { orderId });
      if (res.data.success) {
        alert("Order rejected successfully.");
        fetchDashboardData();
      }
    } catch (err: any) {
      console.error("Failed to reject order:", err);
      alert(err.response?.data?.message || "Failed to reject order");
    } finally {
      setActioningId(null);
    }
  };

  // Deliver an active delivery task with camera/gallery proof photo
  const handleDeliverOrder = async (orderId: string) => {
    // Create a dynamic file input to capture camera/gallery image
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setActioningId(orderId);
      try {
        const formData = new FormData();
        formData.append("orderId", orderId);
        formData.append("proof", file);

        const res = await apiClient.post("/delivery/deliver", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        if (res.data.success) {
          alert("Delivery completed with proof! Great job.");
          setActiveTab("history"); // Move to history tab
          fetchDashboardData();
        }
      } catch (err: any) {
        console.error("Failed to complete delivery:", err);
        alert(err.response?.data?.message || "Failed to mark as delivered");
      } finally {
        setActioningId(null);
      }
    };

    input.click();
  };

  // Helper to format item description list
  const getItemsSummary = (items: any[], orderType: string) => {
    if (!items || items.length === 0) return "Items loaded";
    return items.map(item => {
      const name = orderType === 'food'
        ? item.menuItem?.name
        : item.groceryItem?.name;
      return `${item.quantity}x ${name || 'Item'}`;
    }).join(', ');
  };

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6 pt-6 relative">
      
      {/* Header Profile Panel */}
      {profile && (
        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-extrabold text-lg select-none">
              {profile.fullName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-extrabold text-[16px] text-slate-800 leading-tight">{profile.fullName}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <span className="text-[11px] font-bold text-slate-500">{profile.rating || 5.0} Rating</span>
                <span className="text-slate-300">•</span>
                <span className="text-[11px] font-bold text-slate-500 uppercase">{profile.vehicleType}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Today's Settlements</span>
            <span className="text-[18px] font-black text-emerald-600">₹{(completedDeliveries.length * 45).toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Availability Toggle Switch */}
      <div className="bg-white rounded-[20px] p-4 sm:p-5 shadow-sm border border-slate-100/80 flex items-center justify-between transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            isActive ? 'bg-emerald-50 text-emerald-600 animate-pulse' : 'bg-slate-100 text-slate-400'
          }`}>
            <span className="material-symbols-outlined text-[22px]">
              {isActive ? 'sports_motorsports' : 'pedal_bike'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">Duty Status</span>
            <span className={`text-[14px] font-black leading-none transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
              {isActive ? 'Online / Available' : 'Offline / Off-Duty'}
            </span>
          </div>
        </div>

        <button 
          onClick={handleToggleAvailability}
          disabled={toggling || isProfileLoading}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isActive ? 'bg-emerald-500' : 'bg-slate-200'
          }`}
        >
          <span 
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isActive ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Main Content Conditional on availability */}
      {!isActive ? (
        <div className="bg-white rounded-[24px] p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center py-16 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 border border-slate-100 shadow-inner">
            <span className="material-symbols-outlined text-[42px] text-slate-400">directions_bike</span>
          </div>
          <h3 className="font-black text-slate-800 text-[20px] mb-2 leading-none">You are Off Duty</h3>
          <p className="text-slate-400 text-xs font-semibold max-w-xs leading-relaxed mb-6 mt-1">
            Toggle your duty switch above to online to begin receiving grocery and restaurant delivery requests.
          </p>
          <button 
            onClick={handleToggleAvailability}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
            Start Duty
          </button>
        </div>
      ) : (
        <>
          {/* Tabs Navigation Selector */}
          <div className="flex bg-white border border-slate-200 p-1 rounded-2xl shadow-sm overflow-x-auto shrink-0 scrollbar-none">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "pending"
                  ? "bg-[#FF5C00] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-850"
              }`}
            >
              Queue ({pendingOrders.length})
            </button>
            <button
              onClick={() => setActiveTab("accepted")}
              className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "accepted"
                  ? "bg-[#FF5C00] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-850"
              }`}
            >
              Tasks ({activeDeliveries.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "history"
                  ? "bg-[#FF5C00] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-850"
              }`}
            >
              Delivered ({completedDeliveries.length})
            </button>
            <button
              onClick={() => setActiveTab("rejected")}
              className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === "rejected"
                  ? "bg-[#FF5C00] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-850"
              }`}
            >
              Rejected ({rejectedOrders.length})
            </button>
          </div>

          {/* Active alerts inside Pending Queue */}
          {activeTab === "pending" && pendingOrders.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 shadow-sm animate-in slide-in-from-top-4 duration-200">
              <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0 mt-0.5 animate-bounce">info</span>
              <p className="text-xs font-bold text-amber-800 leading-relaxed">
                {pendingOrders.length} unclaimed deliveries are waiting in your local queue! Claim them now.
              </p>
            </div>
          )}

          {/* Empty States */}
          {activeTab === "pending" && pendingOrders.length === 0 && (
            <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center py-16 border border-slate-100 shadow-sm animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-[48px] text-slate-300 mb-3 animate-pulse">explore</span>
              <h3 className="font-extrabold text-slate-700 text-[16px] leading-none">Scanning for requests...</h3>
              <p className="text-slate-400 text-xs font-semibold max-w-[240px] leading-relaxed mt-2">No new deliveries found. We will alert you instantly when a shop updates orders!</p>
            </div>
          )}

          {activeTab === "accepted" && activeDeliveries.length === 0 && (
            <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center py-16 border border-slate-100 shadow-sm animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-[48px] text-slate-300 mb-3">task_alt</span>
              <h3 className="font-extrabold text-slate-700 text-[16px] leading-none">No Active Tasks</h3>
              <p className="text-slate-400 text-xs font-semibold max-w-[240px] leading-relaxed mt-2">Go to the Pending Queue tab to accept active deliveries.</p>
            </div>
          )}

          {activeTab === "history" && completedDeliveries.length === 0 && (
            <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center py-16 border border-slate-100 shadow-sm animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-[48px] text-slate-300 mb-3">history</span>
              <h3 className="font-extrabold text-slate-700 text-[16px] leading-none">No History Found</h3>
              <p className="text-slate-400 text-xs font-semibold max-w-[240px] leading-relaxed mt-2">Completed settlements will be logged here chronologically.</p>
            </div>
          )}

          {activeTab === "rejected" && rejectedOrders.length === 0 && (
            <div className="bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center py-16 border border-slate-100 shadow-sm animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-[48px] text-slate-300 mb-3">do_not_disturb_on</span>
              <h3 className="font-extrabold text-slate-700 text-[16px] leading-none">No Rejected Requests</h3>
              <p className="text-slate-400 text-xs font-semibold max-w-[240px] leading-relaxed mt-2">Orders rejected during duty hours are saved here.</p>
            </div>
          )}

          {/* Tab lists */}
          {/* 1. PENDING QUEUE */}
          {activeTab === "pending" && pendingOrders.map((order) => {
            const customerName = order.user?.name || "Premium customer";
            const summary = getItemsSummary(order.items, order.orderType);
            const orderId = `#ORD-${order._id.substring(order._id.length - 6).toUpperCase()}`;
            
            return (
              <div key={order._id} className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-700 text-[9px] font-bold rounded-lg uppercase tracking-wider mb-2">
                      New Request • {order.orderType === 'food' ? 'Food Delivery' : 'Grocery Basket'}
                    </span>
                    <h3 className="text-lg font-black text-slate-800 leading-tight">{orderId}</h3>
                    <p className="text-slate-400 text-xs font-semibold mt-1">{summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-[#FF5C00]">₹{order.totalAmount.toLocaleString()}</p>
                    <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider mt-1.5 ${
                      order.paymentMethod === 'ONLINE'
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                        : 'text-amber-700 bg-amber-50 border border-amber-100'
                    }`}>
                      {order.paymentMethod === 'ONLINE' ? 'ONLINE' : 'COD'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-50 pt-3 space-y-2">
                  <div className="flex gap-2.5 items-start text-xs font-semibold w-full justify-between">
                    <div className="flex gap-2.5 items-start">
                      <span className="material-symbols-outlined text-slate-400 text-[16px] mt-0.5">store</span>
                      <div>
                        <p className="text-slate-800 font-bold">Pick Up Location</p>
                        <p className="text-slate-500 font-medium">{order.restaurant?.name || "ZipGrocery Hyperlocal Hub"}</p>
                        <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mt-0.5">{order.restaurant?.address || "Hyperlocal Depot"}</p>
                      </div>
                    </div>
                    {(order.restaurant?.location?.lat !== undefined || order.deliveryZone?.center?.lat !== undefined) && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${order.orderType === 'food' ? order.restaurant?.location?.lat : order.deliveryZone?.center?.lat},${order.orderType === 'food' ? order.restaurant?.location?.lng : order.deliveryZone?.center?.lng}&travelmode=driving`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors shadow-sm ml-2 shrink-0 self-center"
                        title="Navigate to Pick Up"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="material-symbols-outlined text-[16px]">navigation</span>
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2.5 items-start text-xs font-semibold w-full justify-between">
                    <div className="flex gap-2.5 items-start">
                      <span className="material-symbols-outlined text-slate-400 text-[16px] mt-0.5">location_on</span>
                      <div>
                        <p className="text-slate-800 font-bold">Delivery Destination</p>
                        <p className="text-slate-500 font-medium leading-relaxed">{order.address?.fullAddress || "Customer address details hidden"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyAddress(order.address?.fullAddress || "");
                        }}
                        className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors shadow-sm ml-1"
                        title="Copy Customer Address"
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      </button>
                      {order.address?.lat !== undefined && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${order.address.lat},${order.address.lng}&travelmode=driving`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors shadow-sm ml-1"
                          title="Navigate to Destination"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="material-symbols-outlined text-[16px]">navigation</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    onClick={() => handleRejectOrder(order._id)}
                    disabled={actioningId === order._id}
                    className="flex items-center justify-center gap-1.5 py-3 border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    Reject
                  </button>
                  <button
                    onClick={() => handleAcceptOrder(order._id)}
                    disabled={actioningId === order._id}
                    className="flex items-center justify-center gap-1.5 py-3 bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    Accept Order
                  </button>
                </div>
              </div>
            );
          })}

          {/* 2. ACCEPTED ACTIVE TASPS */}
          {activeTab === "accepted" && activeDeliveries.map((delivery) => {
            const order = delivery.order;
            if (!order) return null;
            const customerName = order.user?.name || "Valued Customer";
            const summary = getItemsSummary(order.items, order.orderType);
            const orderId = `#ORD-${order._id.substring(order._id.length - 6).toUpperCase()}`;

            return (
              <div key={delivery._id} className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded-lg uppercase tracking-wider mb-2">
                      Fulfilling Task • Assigned
                    </span>
                    <h3 className="text-lg font-black text-slate-800 leading-tight">{orderId}</h3>
                    <p className="text-slate-400 text-xs font-semibold mt-1">{summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black text-[#FF5C00]">₹{order.totalAmount.toLocaleString()}</p>
                    <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider mt-1.5 ${
                      order.paymentMethod === 'ONLINE'
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                        : 'text-amber-700 bg-amber-50 border border-amber-100'
                    }`}>
                      {order.paymentMethod === 'ONLINE' ? 'ONLINE' : 'COD'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-50 pt-3 space-y-3">
                  <div className="flex gap-2.5 items-start text-xs font-semibold w-full justify-between">
                    <div className="flex gap-2.5 items-start">
                      <span className="material-symbols-outlined text-slate-400 text-[18px] mt-0.5">store</span>
                      <div>
                        <p className="text-slate-855 font-bold">1. Pick Up Vendor</p>
                        <p className="text-slate-650 font-bold">{order.restaurant?.name || "ZipGrocery Hyperlocal Hub"}</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 font-medium">{order.restaurant?.address || "Hyperlocal Depot"}</p>
                      </div>
                    </div>
                    {(order.restaurant?.location?.lat !== undefined || order.deliveryZone?.center?.lat !== undefined) && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${order.orderType === 'food' ? order.restaurant?.location?.lat : order.deliveryZone?.center?.lat},${order.orderType === 'food' ? order.restaurant?.location?.lng : order.deliveryZone?.center?.lng}&travelmode=driving`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors shadow-sm ml-2 shrink-0 self-center"
                        title="Navigate to Pick Up"
                      >
                        <span className="material-symbols-outlined text-[16px]">navigation</span>
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2.5 items-start text-xs font-semibold w-full justify-between">
                    <div className="flex gap-2.5 items-start">
                      <span className="material-symbols-outlined text-slate-400 text-[18px] mt-0.5">location_on</span>
                      <div>
                        <p className="text-slate-855 font-bold">2. Customer Drop-off</p>
                        <p className="text-slate-700 font-bold">{customerName}</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-medium mt-0.5">{order.address?.fullAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyAddress(order.address?.fullAddress || "");
                        }}
                        className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors shadow-sm ml-1"
                        title="Copy Customer Address"
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      </button>
                      {order.address?.lat !== undefined && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${order.address.lat},${order.address.lng}&travelmode=driving`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors shadow-sm ml-1"
                          title="Navigate to Destination"
                        >
                          <span className="material-symbols-outlined text-[16px]">navigation</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-1">
                  <a
                    href={`tel:${order.user?.phone || '9999999999'}`}
                    className="flex items-center justify-center gap-1.5 py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 text-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">call</span>
                    Call Client
                  </a>
                  <button
                    onClick={() => handleDeliverOrder(order._id)}
                    disabled={actioningId === order._id}
                    className="flex items-center justify-center gap-1.5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Delivered
                  </button>
                </div>
              </div>
            );
          })}

          {/* 3. DELIVERED HISTORY */}
          {activeTab === "history" && completedDeliveries.map((delivery) => {
            const order = delivery.order;
            if (!order) return null;
            const summary = getItemsSummary(order.items, order.orderType);
            const orderId = `#ORD-${order._id.substring(order._id.length - 6).toUpperCase()}`;

            return (
              <div key={delivery._id} className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col justify-between animate-in fade-in duration-200">
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-50">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                    Delivered
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {new Date(delivery.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-[14px] text-slate-800 leading-tight">
                    {orderId} - {order.restaurant?.name || "Grocery Fulfillment"}
                  </h3>
                  <p className="text-[12px] text-slate-400 font-semibold truncate">{summary}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Earnings</span>
                    <span className="font-extrabold text-emerald-600 text-sm">₹{delivery.earnings || 45}</span>
                  </div>
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    order.paymentMethod === 'ONLINE'
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                      : 'text-amber-700 bg-amber-50 border border-amber-100'
                  }`}>
                    {order.paymentMethod === 'ONLINE' ? 'ONLINE • PAID' : 'COD • PAID'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* 4. REJECTED ORDERS */}
          {activeTab === "rejected" && rejectedOrders.map((order) => {
            const summary = getItemsSummary(order.items, order.orderType);
            const orderId = `#ORD-${order._id.substring(order._id.length - 6).toUpperCase()}`;

            return (
              <div key={order._id} className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col justify-between animate-in fade-in duration-200">
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-50">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">do_not_disturb_on</span>
                    Rejected
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {new Date(order.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-[14px] text-slate-800 leading-tight">
                    {orderId} - {order.restaurant?.name || "Grocery Depot"}
                  </h3>
                  <p className="text-[12px] text-slate-400 font-semibold truncate">{summary}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Returned to pending pool</span>
                  <span className="text-slate-450 font-bold uppercase text-[10px] bg-slate-50 px-2 py-0.5 rounded">
                    {order.paymentMethod}
                  </span>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Floating Map Button (Only active when online) */}
      {isActive && (
        <button className="absolute bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl border-[3px] border-white hover:bg-emerald-700 transition-all z-40 active:scale-95">
          <span className="material-symbols-outlined text-[24px]">map</span>
        </button>
      )}

    </div>
  );
}
