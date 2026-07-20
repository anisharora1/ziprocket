"use client";

import Header from "@/components/Header";
import BottomNavBar from "@/components/BottomNavBar";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/services/api";
import Link from "next/link";

export default function OrdersPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState("Ordered by mistake");
    const [otherReasonText, setOtherReasonText] = useState("");
    const [cancellingLoader, setCancellingLoader] = useState(false);

    const handleOpenCancelModal = (orderId: string) => {
        setCancellingOrderId(orderId);
        setCancelReason("Ordered by mistake");
        setOtherReasonText("");
        setIsCancelModalOpen(true);
    };

    const handleCancelOrderSubmit = async () => {
        if (!cancellingOrderId) return;
        setCancellingLoader(true);
        try {
            const finalReason = cancelReason === "Other" ? otherReasonText : cancelReason;
            const res = await apiClient.patch(`/orders/${cancellingOrderId}/cancel`, {
                reason: finalReason
            });
            if (res.data.success) {
                alert("Order cancelled successfully!");
                setIsCancelModalOpen(false);
                setCancellingOrderId(null);
                fetchOrders();
            }
        } catch (err: any) {
            console.error("Cancellation failed:", err);
            alert(err.response?.data?.message || "Failed to cancel order.");
        } finally {
            setCancellingLoader(false);
        }
    };

    const fetchOrders = async () => {
        if (!user) return;
        try {
            const res = await apiClient.get(`/orders/user/${user._id}`);
            if (res.data.success) {
                setOrders(res.data.orders || []);
            }
        } catch (err) {
            console.error("Failed to fetch user orders:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && user) {
            fetchOrders();
        } else if (!authLoading && !user) {
            setLoading(false);
        }
    }, [user, authLoading]);

    // Parse status to stepper step
    const getStatusStep = (status: string) => {
        switch (status) {
            case "placed": return 0;
            case "accepted":
            case "preparing": return 1;
            case "on_the_way": return 2;
            case "delivered": return 3;
            default: return 0;
        }
    };

    // Helper to format item names list
    const getItemsSummary = (items: any[], orderType: string) => {
        if (!items || items.length === 0) return "Items loaded";
        return items.map(item => {
            const name = orderType === 'food'
                ? item.menuItem?.name
                : item.groceryItem?.name;
            return `${item.quantity}x ${name || 'Item'}`;
        }).join(', ');
    };

    // Dynamically inject Razorpay Checkout SDK Script
    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if ((window as any).Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    // Re-trigger Razorpay modal checkout for unpaid orders
    const handleRetryPayment = async (order: any) => {
        setRetryingOrderId(order._id);
        try {
            const sdkLoaded = await loadRazorpayScript();
            if (!sdkLoaded) {
                alert("Failed to load Razorpay SDK. Please check your network connection.");
                setRetryingOrderId(null);
                return;
            }

            // Generate Razorpay order session for the existing order
            const rzpSessionRes = await apiClient.post("/payments/create", {
                orderId: order._id
            });

            if (!rzpSessionRes.data.success) {
                throw new Error("Unable to create Razorpay payment order session");
            }

            const { order: rzpOrder, key } = rzpSessionRes.data;

            const options = {
                key: key,
                amount: rzpOrder.amount,
                currency: rzpOrder.currency,
                name: "ZipRocket",
                description: order.orderType === 'food' ? "Food Delivery Order" : "Grocery Basket Order",
                image: "https://cdn-icons-png.flaticon.com/512/857/857681.png",
                order_id: rzpOrder.id,
                handler: async function (response: any) {
                    try {
                        setRetryingOrderId(order._id);

                        // Verification API
                        const verifyRes = await apiClient.post("/payments/verify", {
                            orderId: order._id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpayOrderId: response.razorpay_order_id,
                            razorpaySignature: response.razorpay_signature
                        });

                        if (verifyRes.data.success) {
                            alert("Payment Successful! Your order has been placed.");
                            fetchOrders(); // Refresh order details
                        } else {
                            alert("Payment verification failed! Please contact support.");
                        }
                    } catch (err: any) {
                        console.error("Signature verification error:", err);
                        alert("Verification Error: " + (err.response?.data?.message || err.message));
                    } finally {
                        setRetryingOrderId(null);
                    }
                },
                prefill: {
                    name: user?.name || "",
                    email: user?.email || "",
                    contact: user?.phone || ""
                },
                theme: {
                    color: "#FF5C00"
                },
                modal: {
                    ondismiss: async function () {
                        try {
                            await apiClient.post("/payments/failure", {
                                orderId: order._id,
                                errorDetails: { message: "Retry payment cancelled by user" }
                            });
                        } catch (e) {
                            console.error("Cancellation logging failed:", e);
                        }
                        alert("Payment cancelled.");
                        setRetryingOrderId(null);
                        fetchOrders();
                    }
                }
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.on("payment.failed", async function (response: any) {
                try {
                    await apiClient.post("/payments/failure", {
                        orderId: order._id,
                        errorDetails: {
                            payment_id: response.error.metadata.payment_id,
                            code: response.error.code,
                            description: response.error.description
                        }
                    });
                } catch (e) {
                    console.error("Failure logging failed:", e);
                }
                alert(`Payment Failed: ${response.error.description}`);
                setRetryingOrderId(null);
                fetchOrders();
            });

            paymentObject.open();
        } catch (error: any) {
            console.error("Retry payment failed:", error);
            alert("Retry Payment Failure: " + (error.response?.data?.message || error.message));
            setRetryingOrderId(null);
        }
    };

    // Separate active and past orders
    const activeOrders = orders.filter(o =>
        ["placed", "accepted", "preparing", "on_the_way"].includes(o.orderStatus || o.status)
    );
    const pastOrders = orders.filter(o =>
        ["delivered", "cancelled"].includes(o.orderStatus || o.status)
    );

    // Active order polling every 5 seconds if tab is active
    useEffect(() => {
        if (activeOrders.length === 0) return;
        const interval = setInterval(() => {
            if (typeof document !== "undefined" && !document.hidden) {
                fetchOrders();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [activeOrders.length]);

    const trackingSteps = [
        { id: 0, title: "Order Placed", description: "We have received your order", icon: "receipt_long" },
        { id: 1, title: "Preparing Order", description: "Your order is being prepared in the kitchen", icon: "restaurant" },
        { id: 2, title: "Out for Delivery", description: "Delivery partner is on the way to you", icon: "two_wheeler" },
        { id: 3, title: "Delivered", description: "Enjoy your items!", icon: "check_circle" },
    ];

    if (authLoading || loading) {
        return (
            <div className="bg-surface text-on-surface pb-28 min-h-screen w-full font-sans">
                <Header />
                <main className="mt-[70px] px-4 max-w-lg mx-auto pt-8 space-y-6">
                    <div className="h-8 w-44 bg-slate-100 rounded-lg animate-pulse" />
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4 shadow-sm animate-pulse h-96">
                        <div className="h-6 w-1/3 bg-slate-100 rounded" />
                        <div className="h-4 w-2/3 bg-slate-100 rounded" />
                        <div className="h-1 bg-slate-100 rounded my-6" />
                        <div className="space-y-6 pt-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-slate-100" />
                                    <div className="space-y-2 flex-1 pt-1">
                                        <div className="h-3 w-1/4 bg-slate-100 rounded" />
                                        <div className="h-2 w-1/2 bg-slate-100 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
                <BottomNavBar activeTab="orders" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="bg-surface text-on-surface pb-28 min-h-screen w-full flex flex-col justify-center items-center font-sans p-6 text-center">
                <Header />
                <div
                    style={{ width: '90%', minWidth: '300px', maxWidth: '440px' }}
                    className="mx-auto bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center text-center py-16 animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="w-20 h-20 bg-[#FFF1E6] rounded-full flex items-center justify-center mb-5 border border-[#FFE2CC]/40 shadow-inner">
                        <span className="material-symbols-outlined text-4xl text-[#FF5C00]">account_circle</span>
                    </div>
                    <h2 className="text-xl font-black text-slate-800 mb-2 leading-none">Access Order History</h2>
                    <p className="text-slate-400 text-xs font-semibold max-w-xs leading-relaxed mb-6 mt-1">
                        Please log in to your account to review active orders, status updates, and historical settlements.
                    </p>
                    <Link href="/auth/login" className="inline-block px-8 py-3 bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95">
                        Log In
                    </Link>
                </div>
                <BottomNavBar activeTab="orders" />
            </div>
        );
    }

    const currentActiveOrder = activeOrders[0];
    const activeStep = currentActiveOrder ? getStatusStep(currentActiveOrder.orderStatus || currentActiveOrder.status) : 0;

    return (
        <div className="bg-surface text-on-surface pb-28 min-h-screen w-full font-sans">
            <Header />

            <main className="mt-[70px] px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full pt-6">

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-6">Your Orders</h1>

                {/* Multiple Active Orders Notification Alert */}
                {activeOrders.length > 1 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 mb-6 shadow-sm">
                        <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0 mt-0.5">info</span>
                        <p className="text-xs font-bold text-amber-800 leading-relaxed">
                            You currently have {activeOrders.length} active orders. Tracking the most recent order below.
                        </p>
                    </div>
                )}

                {/* Active Order Section */}
                {currentActiveOrder ? (
                    <section className="mb-10 animate-in fade-in duration-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#FF5C00] animate-spin" style={{ animationDuration: '3s' }}>clock_loader_40</span>
                            Active Order
                        </h2>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100/80 p-5 sm:p-6">
                            <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">
                                        ID: #ORD-{currentActiveOrder._id.substring(currentActiveOrder._id.length - 6).toUpperCase()}
                                    </p>
                                    <h3 className="text-lg font-black text-slate-800">
                                        {currentActiveOrder.orderType === 'food'
                                            ? (currentActiveOrder.restaurant?.name || "Premium Restaurant Partner")
                                            : "ZipGrocery Delivery"}
                                    </h3>
                                    <p className="text-xs font-semibold text-slate-500 mt-1 max-w-md leading-relaxed">
                                        {getItemsSummary(currentActiveOrder.items, currentActiveOrder.orderType)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-black text-[#FF5C00]">₹{currentActiveOrder.totalAmount.toLocaleString()}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-wider">
                                        {new Date(currentActiveOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>

                            {/* Warning Banner for Unpaid Online Order */}
                            {currentActiveOrder.paymentMethod === "ONLINE" && currentActiveOrder.paymentStatus !== "paid" && (
                                <div className="bg-[#fff5f0] border border-[#fdeadd] rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 animate-in slide-in-from-top duration-300">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#FF5C00]/10 flex items-center justify-center text-[#FF5C00] shrink-0">
                                            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800 leading-tight">Unpaid Online Order</h4>
                                            <p className="text-[10px] font-semibold text-slate-550 mt-0.5">Please complete payment for the restaurant to start preparation.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRetryPayment(currentActiveOrder)}
                                        disabled={retryingOrderId === currentActiveOrder._id}
                                        className="w-full sm:w-auto px-5 py-2.5 bg-[#FF5C00] hover:bg-[#e05200] text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        {retryingOrderId === currentActiveOrder._id ? (
                                            <>
                                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-[14px]">credit_card</span>
                                                Pay Now
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Vertical Tracking Line */}
                            <div className="relative pl-4 py-2">
                                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-slate-100"></div>

                                <div className="space-y-6">
                                    {trackingSteps.map((step, index) => {
                                        const isActiveStep = activeStep === step.id;
                                        const isCompleted = activeStep > step.id;
                                        const isPending = activeStep < step.id;

                                        return (
                                            <div key={step.id} className="relative flex gap-5 items-start">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10 transition-colors duration-300 ${isCompleted
                                                    ? 'bg-emerald-500 text-white shadow-sm'
                                                    : isActiveStep
                                                        ? 'bg-[#FF5C00] text-white shadow-[0_0_0_4px_rgba(255,92,0,0.25)] animate-pulse'
                                                        : 'bg-slate-100 text-slate-350'
                                                    }`}>
                                                    <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                        {step.icon}
                                                    </span>

                                                    {/* Connecting Line Fill (Dynamic) */}
                                                    {index < trackingSteps.length - 1 && isCompleted && (
                                                        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-emerald-500"></div>
                                                    )}
                                                </div>

                                                <div className={`pt-1 transition-opacity ${isPending ? 'opacity-40' : 'opacity-100'}`}>
                                                    <h4 className={`text-[13px] font-bold ${isActiveStep ? 'text-[#FF5C00]' : 'text-slate-800'}`}>
                                                        {step.title}
                                                    </h4>
                                                    <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{step.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-slate-100 flex gap-3">
                                <a
                                    href={`tel:${currentActiveOrder.restaurant?.phone || '9117662441'}`}
                                    className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-center text-slate-700 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200"
                                >
                                    Contact Support
                                </a>
                                {currentActiveOrder.orderStatus === "placed" && currentActiveOrder.paymentMethod === "COD" && (
                                    <button
                                        onClick={() => handleOpenCancelModal(currentActiveOrder._id)}
                                        className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-center text-rose-600 bg-rose-50 border border-rose-100 rounded-xl hover:bg-rose-100/50 transition-colors"
                                    >
                                        Cancel Order
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                ) : null}

                {/* Empty State when no orders are found */}
                {orders.length === 0 ? (
                    <div
                        style={{ width: '90%', minWidth: '300px', maxWidth: '440px' }}
                        className="mx-auto my-6 text-center py-16 px-6 bg-white rounded-3xl border border-slate-100 shadow-sm animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center justify-center"
                    >
                        <div className="w-20 h-20 bg-[#FFF1E6] rounded-full flex items-center justify-center mb-5 border border-[#FFE2CC]/40 shadow-inner">
                            <span className="material-symbols-outlined text-4xl text-[#FF5C00]">receipt_long</span>
                        </div>
                        <h3 className="font-black text-slate-800 text-lg mb-2 leading-none">No Orders Found</h3>
                        <p className="text-slate-400 text-xs font-semibold leading-relaxed mb-6 mt-1">
                            You haven't placed any grocery or restaurant orders yet! Let's get something delicious.
                        </p>
                        <Link href="/" className="inline-block px-8 py-3 bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95">
                            Order Now
                        </Link>
                    </div>
                ) : (
                    /* Past Orders Section */
                    <section className="animate-in fade-in duration-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">history</span>
                            Past Orders
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {pastOrders.map((order) => {
                                const isCancelled = order.orderStatus === "cancelled";
                                const summary = getItemsSummary(order.items, order.orderType);
                                return (
                                    <div key={order._id} className="bg-white rounded-2xl p-5 border border-slate-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:shadow-md transition-shadow flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-55">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${isCancelled
                                                    ? 'bg-rose-50 text-rose-700'
                                                    : 'bg-emerald-50 text-emerald-700'
                                                    }`}>
                                                    <span className="material-symbols-outlined text-[12px]">
                                                        {isCancelled ? 'cancel' : 'check_circle'}
                                                    </span>
                                                    {order.orderStatus || order.status}
                                                </span>
                                                <span className="text-[11px] font-semibold text-slate-400">
                                                    {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>

                                            <h3 className="font-bold text-[15px] text-slate-800 truncate leading-snug">
                                                {order.orderType === 'food'
                                                    ? (order.restaurant?.name || "Restaurant Partner")
                                                    : "ZipGrocery Basket"}
                                            </h3>
                                            <p className="text-[12px] text-slate-400 font-semibold truncate mt-1">{summary}</p>
                                        </div>

                                        <div className="mt-5 pt-3.5 border-t border-slate-50 flex items-center justify-between">
                                            <span className="font-black text-slate-850 text-sm font-sans flex flex-col">
                                                <span>₹{order.totalAmount.toLocaleString()}</span>
                                                {order.paymentMethod === "ONLINE" && (
                                                    <span className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${order.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                                                    </span>
                                                )}
                                            </span>
                                            <div className="flex gap-2">
                                                {order.paymentMethod === "ONLINE" && order.paymentStatus !== "paid" && (
                                                    <button
                                                        onClick={() => handleRetryPayment(order)}
                                                        disabled={retryingOrderId === order._id}
                                                        className="text-[11px] font-black uppercase tracking-widest text-[#FF5C00] bg-[#FF5C00]/10 px-3.5 py-2 rounded-lg hover:bg-[#FF5C00]/15 transition-colors flex items-center gap-1"
                                                    >
                                                        {retryingOrderId === order._id ? '...' : 'Pay Now'}
                                                    </button>
                                                )}
                                                <Link
                                                    href={order.orderType === 'food' && order.restaurant ? `/restaurants/${order.restaurant._id}` : '/grocery'}
                                                    className="text-[11px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-[13px]">refresh</span>
                                                    Reorder
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

            </main>

            <BottomNavBar activeTab="orders" />

            {/* CANCELLATION DIALOG MODAL */}
            {isCancelModalOpen && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        zIndex: 99999,
                    }}
                    className="flex items-center justify-center p-4 backdrop-blur-sm"
                >
                    <div
                        style={{ width: "90%", maxWidth: "440px" }}
                        className="bg-white rounded-3xl shadow-2xl p-6 flex flex-col justify-between overflow-hidden relative z-10 animate-in zoom-in-95 duration-200"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shrink-0">
                                <span className="material-symbols-outlined text-[24px]">cancel</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-[17px] font-black text-slate-800 leading-none mb-1.5">Cancel Order</h3>
                                <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                                    Are you sure you want to cancel this order? This action cannot be undone once confirmed.
                                </p>
                            </div>
                        </div>

                        <div className="my-6 space-y-3">
                            <label className="block text-[10px] font-black text-slate-655 uppercase tracking-wider">Select Cancellation Reason</label>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    "Ordered by mistake",
                                    "Wrong address",
                                    "Changed mind",
                                    "Found cheaper option",
                                    "Other"
                                ].map((reason) => (
                                    <button
                                        key={reason}
                                        type="button"
                                        onClick={() => setCancelReason(reason)}
                                        className={`px-4 py-3 rounded-xl text-left text-xs font-bold transition-all border flex items-center justify-between ${cancelReason === reason
                                                ? 'border-[#FF5C00] bg-[#FF5C00]/5 text-[#FF5C00]'
                                                : 'border-slate-100 hover:border-slate-200 text-slate-650'
                                            }`}
                                    >
                                        <span>{reason}</span>
                                        {cancelReason === reason && (
                                            <span className="material-symbols-outlined text-[16px] text-[#FF5C00]">check_circle</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {cancelReason === "Other" && (
                                <textarea
                                    value={otherReasonText}
                                    onChange={(e) => setOtherReasonText(e.target.value)}
                                    placeholder="Tell us more about your reason..."
                                    rows={2}
                                    className="w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5C00]/10 focus:border-[#FF5C00] transition-all text-xs font-semibold"
                                />
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCancelModalOpen(false);
                                    setCancellingOrderId(null);
                                }}
                                className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95"
                            >
                                No, Keep
                            </button>
                            <button
                                onClick={handleCancelOrderSubmit}
                                disabled={cancellingLoader || (cancelReason === "Other" && !otherReasonText.trim())}
                                className="py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/25 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                            >
                                {cancellingLoader ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Cancelling...
                                    </>
                                ) : (
                                    "Yes, Cancel"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
