"use client";

import Header from "@/components/Header";
import BottomNavBar from "@/components/BottomNavBar";
import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/services/api";
import { useOrderSocket } from "@/hooks/useOrderSocket";
import { useCustomerOrders } from "@/hooks/useOrders";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
    MdReceiptLong,
    MdRestaurant,
    MdTwoWheeler,
    MdCheckCircle,
    MdAccountCircle,
    MdInfo,
    MdAccessTime,
    MdError,
    MdCreditCard,
    MdHistory,
    MdCancel,
    MdRefresh,
    MdHourglassTop,
    MdStore,
    MdShoppingBag,
} from "react-icons/md";

interface GroupedOrderDisplay {
    id: string;
    isGroup: boolean;
    checkoutGroupId?: string;
    foodOrder?: any;
    groceryOrder?: any;
    primaryOrder: any;
    allOrders: any[];
    isActive: boolean;
    totalAmount: number;
    multiVendorFee: number;
    createdAt: string;
}

function groupCustomerOrders(rawOrders: any[]): GroupedOrderDisplay[] {
    const groupsMap = new Map<string, any[]>();
    const singles: any[] = [];

    for (const order of rawOrders) {
        if (order.checkoutGroupId) {
            const list = groupsMap.get(order.checkoutGroupId) || [];
            list.push(order);
            groupsMap.set(order.checkoutGroupId, list);
        } else {
            singles.push(order);
        }
    }

    const result: GroupedOrderDisplay[] = [];

    // Process grouped orders
    for (const [groupId, groupOrders] of groupsMap.entries()) {
        const food = groupOrders.find(o => o.groupRole === 'food' || o.orderType === 'food');
        const grocery = groupOrders.find(o => o.groupRole === 'grocery' || o.orderType === 'grocery');
        const primary = food || groupOrders[0];

        const isActive = groupOrders.some(o =>
            ["pending", "placed", "accepted", "preparing", "accepted_by_delivery", "on_the_way"].includes(o.orderStatus || o.status)
        );

        const totalAmount = groupOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
        const multiVendorFee = food?.multiVendorFee || primary.multiVendorFee || 0;

        result.push({
            id: groupId,
            isGroup: groupOrders.length > 1 || Boolean(food && grocery),
            checkoutGroupId: groupId,
            foodOrder: food,
            groceryOrder: grocery,
            primaryOrder: primary,
            allOrders: groupOrders,
            isActive,
            totalAmount,
            multiVendorFee,
            createdAt: primary.createdAt
        });
    }

    // Process single orders
    for (const order of singles) {
        const isActive = ["pending", "placed", "accepted", "preparing", "accepted_by_delivery", "on_the_way"].includes(order.orderStatus || order.status);
        result.push({
            id: order._id,
            isGroup: false,
            primaryOrder: order,
            allOrders: [order],
            isActive,
            totalAmount: Number(order.totalAmount) || 0,
            multiVendorFee: 0,
            createdAt: order.createdAt
        });
    }

    // Sort by createdAt descending
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export default function OrdersPage() {
    const { user, isLoading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState("Galti se order ho gaya");
    const [otherReasonText, setOtherReasonText] = useState("");
    const [cancellingLoader, setCancellingLoader] = useState(false);

    // TanStack Query — single source of truth for order data
    const { data: orders = [], isLoading: ordersLoading } = useCustomerOrders(user?._id);
    const loading = authLoading || ordersLoading;

    // Convenience: invalidate customer orders cache (triggers background refetch)
    const invalidateOrders = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['orders', 'customer', user?._id] });
    }, [queryClient, user?._id]);

    const handleOpenCancelModal = (orderId: string) => {
        setCancellingOrderId(orderId);
        setCancelReason("Galti se order ho gaya");
        setOtherReasonText("");
        setIsCancelModalOpen(true);
    };

    const handleCancelOrderSubmit = async () => {
        if (!cancellingOrderId) return;
        setCancellingLoader(true);
        try {
            const finalReason = cancelReason === "Anya wajah (Other)" ? otherReasonText : cancelReason;
            const res = await apiClient.patch(`/orders/${cancellingOrderId}/cancel`, {
                reason: finalReason
            });
            if (res.data.success) {
                alert("Order safalta-purvak cancel ho gaya!");
                setIsCancelModalOpen(false);
                setCancellingOrderId(null);
                // Optimistic local update + background refresh
                queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
                    prev.map(o => o._id === cancellingOrderId ? { ...o, orderStatus: 'cancelled' } : o)
                );
                invalidateOrders();
            }
        } catch (err: any) {
            console.error("Cancellation failed:", err);
            alert(err.response?.data?.message || "Order cancel karne me samasya aayi.");
        } finally {
            setCancellingLoader(false);
        }
    };

    // Live real-time socket tracking for customer orders
    useOrderSocket({
        onNewOrder: () => {
            invalidateOrders();
        },
        onOrderStatusUpdated: (data) => {
            if (data?.orderId && data?.orderStatus) {
                queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
                    prev.map(o => o._id === data.orderId ? { ...o, orderStatus: data.orderStatus } : o)
                );
                invalidateOrders();
            }
        },
        onDeliveryStatusUpdated: (data) => {
            if (data?.orderId && data?.status) {
                queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
                    prev.map(o => o._id === data.orderId ? { ...o, orderStatus: data.status } : o)
                );
                invalidateOrders();
            }
        },
        onDeliveryAccepted: (data) => {
            if (data?.orderId) {
                queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
                    prev.map(o => o._id === data.orderId ? { ...o, orderStatus: 'accepted_by_delivery' } : o)
                );
                invalidateOrders();
            }
        },
        onOrderDelivered: (data) => {
            if (data?.orderId) {
                queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
                    prev.map(o => o._id === data.orderId ? { ...o, orderStatus: 'delivered' } : o)
                );
                invalidateOrders();
            }
        },
        onOrderCancelled: (data) => {
            if (data?.orderId) {
                queryClient.setQueryData(['orders', 'customer', user?._id], (prev: any[] = []) =>
                    prev.map(o => o._id === data.orderId ? { ...o, orderStatus: 'cancelled' } : o)
                );
                invalidateOrders();
            }
        },
        onReconnect: () => {
            invalidateOrders();
        },
    });

    // Parse status to stepper step
    const getStatusStep = (status: string) => {
        switch (status) {
            case "pending": return 0;
            case "placed": return 1;
            case "accepted":
            case "preparing": return 2;
            case "accepted_by_delivery":
            case "on_the_way": return 3;
            case "delivered": return 4;
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
                alert("Payment SDK load nahi ho paya. Kripya internet check karein.");
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
                            alert("Payment safal raha! Aapka order confirm ho gaya hai.");
                            invalidateOrders();
                        } else {
                            alert("Payment verify nahi ho paya! Kripya support se sampark karein.");
                        }
                    } catch (err: any) {
                        console.error("Signature verification error:", err);
                        alert("Verification samasya: " + (err.response?.data?.message || err.message));
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
                        alert("Payment cancel kar diya gaya.");
                        setRetryingOrderId(null);
                        invalidateOrders();
                    }
                }
            };

            const paymentObject = new (window as any).Razorpay(options);
            paymentObject.on("payment.failed", async function (response: any) {
                try {
                    await apiClient.post("/payments/failure", {
                        orderId: order._id,
                        errorDetails: {
                            description: response.error.description
                        }
                    });
                } catch (e) {
                    console.error("Failure logging failed:", e);
                }
                alert(`Payment asafal raha: ${response.error.description}`);
                setRetryingOrderId(null);
                invalidateOrders();
            });

            paymentObject.open();
        } catch (error: any) {
            console.error("Retry payment failed:", error);
            alert("Payment samasya: " + (error.response?.data?.message || error.message));
            setRetryingOrderId(null);
        }
    };

    const groupedOrders = useMemo(() => groupCustomerOrders(orders), [orders]);
    const activeGroups = groupedOrders.filter(g => g.isActive);
    const pastGroups = groupedOrders.filter(g => !g.isActive);

    const trackingSteps = [
        { id: 0, title: "Confirming Order", description: "Verifying your order details...", iconComp: MdHourglassTop },
        { id: 1, title: "Order Placed", description: "We have received your order", iconComp: MdReceiptLong },
        { id: 2, title: "Preparing Order", description: "Your order is being prepared", iconComp: MdRestaurant },
        { id: 3, title: "Out for Delivery", description: "Delivery partner is on the way to you", iconComp: MdTwoWheeler },
        { id: 4, title: "Delivered", description: "Enjoy your items!", iconComp: MdCheckCircle },
    ];

    if (loading) {
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
                        <MdAccountCircle className="text-4xl text-[#FF5C00]" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 mb-2 leading-none">Access Order History</h2>
                    <p className="text-slate-400 text-xs font-semibold max-w-xs leading-relaxed mb-6 mt-1">
                        Apne live orders aur purane sabhi orders dekhne ke liye account me login karein.
                    </p>
                    <Link href="/auth/login" className="inline-block px-8 py-3 bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95">
                        Log In
                    </Link>
                </div>
                <BottomNavBar activeTab="orders" />
            </div>
        );
    }

    const currentActiveGroup = activeGroups[0];
    const primaryActiveOrder = currentActiveGroup?.primaryOrder;
    const activeStep = primaryActiveOrder ? getStatusStep(primaryActiveOrder.orderStatus || primaryActiveOrder.status) : 0;

    return (
        <div className="bg-surface text-on-surface pb-28 min-h-screen w-full font-sans">
            <Header />

            <main className="mt-[70px] px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full pt-6">

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-6">Your Orders</h1>

                {/* Multiple Active Orders Notification Alert */}
                {activeGroups.length > 1 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 mb-6 shadow-sm">
                        <MdInfo className="text-amber-600 text-[20px] shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-amber-800 leading-relaxed">
                            Aapke abhi {activeGroups.length} active orders hain. Niche sabse naye order ka live status hai.
                        </p>
                    </div>
                )}

                {/* Active Order Section */}
                {currentActiveGroup ? (
                    <section className="mb-10 animate-in fade-in duration-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <MdAccessTime className="text-[#FF5C00] animate-spin" />
                            Active Order
                        </h2>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100/80 p-5 sm:p-6">
                            <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            ID: #ORD-{currentActiveGroup.id.substring(currentActiveGroup.id.length - 6).toUpperCase()}
                                        </p>
                                        {currentActiveGroup.isGroup && (
                                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-black rounded-lg uppercase">
                                                Mixed Order
                                            </span>
                                        )}
                                    </div>

                                    {currentActiveGroup.isGroup ? (
                                        <div className="space-y-2 mt-2">
                                            {/* Part 1: Food from restaurant */}
                                            {currentActiveGroup.foodOrder && (
                                                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                                            <MdRestaurant className="text-orange-500" />
                                                            Food from {currentActiveGroup.foodOrder.restaurant?.name || "Restaurant"}
                                                        </span>
                                                        <span className="text-[10px] font-black px-2 py-0.5 bg-orange-100 text-[#FF5C00] rounded-md uppercase">
                                                            {currentActiveGroup.foodOrder.orderStatus}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1 font-medium">
                                                        {getItemsSummary(currentActiveGroup.foodOrder.items, "food")}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Part 2: Groceries */}
                                            {currentActiveGroup.groceryOrder && (
                                                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                                            <MdStore className="text-emerald-600" />
                                                            Groceries
                                                        </span>
                                                        <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md uppercase">
                                                            {currentActiveGroup.groceryOrder.orderStatus}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1 font-medium">
                                                        {getItemsSummary(currentActiveGroup.groceryOrder.items, "grocery")}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <h3 className="text-lg font-black text-slate-800">
                                                {primaryActiveOrder.orderType === 'food'
                                                    ? (primaryActiveOrder.restaurant?.name || "Restaurant Partner")
                                                    : "ZipGrocery Delivery"}
                                            </h3>
                                            <p className="text-xs font-semibold text-slate-500 mt-1 max-w-md leading-relaxed">
                                                {getItemsSummary(primaryActiveOrder.items, primaryActiveOrder.orderType)}
                                            </p>
                                        </>
                                    )}

                                    {currentActiveGroup.multiVendorFee > 0 && (
                                        <p className="text-[10px] font-bold text-slate-400 mt-2">
                                            Includes ₹{currentActiveGroup.multiVendorFee} one-time multi-vendor fee
                                        </p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-black text-[#FF5C00]">₹{currentActiveGroup.totalAmount.toLocaleString()}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-wider">
                                        {new Date(currentActiveGroup.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>

                            {/* Warning Banner for Unpaid Online Order */}
                            {primaryActiveOrder?.paymentMethod === "ONLINE" && primaryActiveOrder?.paymentStatus !== "paid" && (
                                <div className="bg-[#fff5f0] border border-[#fdeadd] rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 animate-in slide-in-from-top duration-300">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#FF5C00]/10 flex items-center justify-center text-[#FF5C00] shrink-0">
                                            <MdError className="text-[20px]" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800 leading-tight">Online Payment Baki Hai</h4>
                                            <p className="text-[10px] font-semibold text-slate-550 mt-0.5">Order taiyar karne ke liye kripya online payment poori karein.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRetryPayment(primaryActiveOrder)}
                                        disabled={retryingOrderId === primaryActiveOrder._id}
                                        className="w-full sm:w-auto px-5 py-2.5 bg-[#FF5C00] hover:bg-[#e05200] text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        {retryingOrderId === primaryActiveOrder._id ? (
                                            <>
                                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <MdCreditCard className="text-[14px]" />
                                                Pay Now
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Delivery Confirmation OTP for Prepaid (ONLINE) Orders */}
                            {primaryActiveOrder?.paymentMethod === "ONLINE" && (primaryActiveOrder?.orderStatus === "on_the_way" || primaryActiveOrder?.orderStatus === "accepted_by_delivery") && primaryActiveOrder?.deliveryOtp && (
                                <div className="bg-orange-50 border-2 border-dashed border-[#FF5C00] rounded-2xl p-4 text-center mb-6">
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Yeh OTP delivery partner ko delivery ke samay batayein</p>
                                    <p className="text-3xl font-black tracking-[0.3em] text-[#FF5C00]">{primaryActiveOrder.deliveryOtp}</p>
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
                                        const StepIcon = step.iconComp;

                                        return (
                                            <div key={step.id} className="relative flex gap-5 items-start">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10 transition-colors duration-300 ${isCompleted
                                                    ? 'bg-emerald-500 text-white shadow-sm'
                                                    : isActiveStep
                                                        ? 'bg-[#FF5C00] text-white shadow-[0_0_0_4px_rgba(255,92,0,0.25)] animate-pulse'
                                                        : 'bg-slate-100 text-slate-350'
                                                    }`}>
                                                    <StepIcon className="text-[15px]" />

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
                                    href={`tel:${primaryActiveOrder?.restaurant?.phone || '9117662441'}`}
                                    className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-center text-slate-700 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200"
                                >
                                    Contact Support
                                </a>

                                {currentActiveGroup.isGroup ? (
                                    <>
                                        {currentActiveGroup.foodOrder && ["pending", "placed"].includes(currentActiveGroup.foodOrder.orderStatus) && (
                                            <button
                                                onClick={() => handleOpenCancelModal(currentActiveGroup.foodOrder._id)}
                                                className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-center text-rose-600 bg-rose-50 border border-rose-100 rounded-xl hover:bg-rose-100/50 transition-colors"
                                            >
                                                Cancel Food
                                            </button>
                                        )}
                                        {currentActiveGroup.groceryOrder && ["pending", "placed"].includes(currentActiveGroup.groceryOrder.orderStatus) && (
                                            <button
                                                onClick={() => handleOpenCancelModal(currentActiveGroup.groceryOrder._id)}
                                                className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-center text-rose-600 bg-rose-50 border border-rose-100 rounded-xl hover:bg-rose-100/50 transition-colors"
                                            >
                                                Cancel Grocery
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    ["pending", "placed"].includes(primaryActiveOrder.orderStatus) && primaryActiveOrder.paymentMethod === "COD" && (
                                        <button
                                            onClick={() => handleOpenCancelModal(primaryActiveOrder._id)}
                                            className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-center text-rose-600 bg-rose-50 border border-rose-100 rounded-xl hover:bg-rose-100/50 transition-colors"
                                        >
                                            Cancel Order
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    </section>
                ) : null}

                {/* Empty State when no orders are found */}
                {groupedOrders.length === 0 ? (
                    <div
                        style={{ width: '90%', minWidth: '300px', maxWidth: '440px' }}
                        className="mx-auto my-6 text-center py-16 px-6 bg-white rounded-3xl border border-slate-100 shadow-sm animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center justify-center"
                    >
                        <div className="w-20 h-20 bg-[#FFF1E6] rounded-full flex items-center justify-center mb-5 border border-[#FFE2CC]/40 shadow-inner">
                            <MdReceiptLong className="text-4xl text-[#FF5C00]" />
                        </div>
                        <h3 className="font-black text-slate-800 text-lg mb-2 leading-none">Koi Order Nahi Mila</h3>
                        <p className="text-slate-400 text-xs font-semibold leading-relaxed mb-6 mt-1">
                            Aapne abhi tak koi grocery ya food order nahi kiya hai. Apni pasand ka samaan order karein!
                        </p>
                        <Link href="/" className="inline-block px-8 py-3 bg-[#FF5C00] hover:bg-[#e05200] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95">
                            Order Now
                        </Link>
                    </div>
                ) : (
                    /* Past Orders Section */
                    <section className="animate-in fade-in duration-200">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <MdHistory className="text-slate-400" />
                            Purane Orders
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {pastGroups.map((group) => {
                                const primary = group.primaryOrder;
                                const isCancelled = group.allOrders.every(o => o.orderStatus === "cancelled");

                                return (
                                    <div key={group.id} className="bg-white rounded-2xl p-5 border border-slate-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:shadow-md transition-shadow flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-55">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${isCancelled
                                                    ? 'bg-rose-50 text-rose-700'
                                                    : 'bg-emerald-50 text-emerald-700'
                                                    }`}>
                                                    {isCancelled ? <MdCancel className="text-[12px]" /> : <MdCheckCircle className="text-[12px]" />}
                                                    {group.isGroup ? (isCancelled ? "Cancelled" : "Completed") : (primary.orderStatus || primary.status)}
                                                </span>
                                                <span className="text-[11px] font-semibold text-slate-400">
                                                    {new Date(group.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            </div>

                                            {group.isGroup ? (
                                                <div className="space-y-3">
                                                    {group.foodOrder && (
                                                        <div className="p-2.5 bg-slate-50 rounded-xl">
                                                            <div className="flex justify-between items-center">
                                                                <h4 className="font-bold text-[13px] text-slate-800 truncate">
                                                                    Food from {group.foodOrder.restaurant?.name || "Restaurant"}
                                                                </h4>
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded uppercase">
                                                                    {group.foodOrder.orderStatus}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                                                                {getItemsSummary(group.foodOrder.items, "food")}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {group.groceryOrder && (
                                                        <div className="p-2.5 bg-slate-50 rounded-xl">
                                                            <div className="flex justify-between items-center">
                                                                <h4 className="font-bold text-[13px] text-slate-800 truncate">
                                                                    Groceries
                                                                </h4>
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded uppercase">
                                                                    {group.groceryOrder.orderStatus}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                                                                {getItemsSummary(group.groceryOrder.items, "grocery")}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {group.multiVendorFee > 0 && (
                                                        <span className="text-[10px] text-slate-400 font-bold block">
                                                            Includes ₹{group.multiVendorFee} multi-vendor fee
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <h3 className="font-bold text-[15px] text-slate-800 truncate leading-snug">
                                                        {primary.orderType === 'food'
                                                            ? (primary.restaurant?.name || "Restaurant Partner")
                                                            : "ZipGrocery Basket"}
                                                    </h3>
                                                    <p className="text-[12px] text-slate-400 font-semibold truncate mt-1">
                                                        {getItemsSummary(primary.items, primary.orderType)}
                                                    </p>
                                                </>
                                            )}
                                        </div>

                                        <div className="mt-5 pt-3.5 border-t border-slate-50 flex items-center justify-between">
                                            <span className="font-black text-slate-850 text-sm font-sans flex flex-col">
                                                <span>₹{group.totalAmount.toLocaleString()}</span>
                                                {primary.paymentMethod === "ONLINE" && (
                                                    <span className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${primary.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {primary.paymentStatus === 'paid' ? 'Paid' : 'Baki (Unpaid)'}
                                                    </span>
                                                )}
                                            </span>
                                            <div className="flex gap-2">
                                                <Link
                                                    href={group.foodOrder?.restaurant ? `/restaurants/${group.foodOrder.restaurant._id}` : '/grocery'}
                                                    className="text-[11px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1"
                                                >
                                                    <MdRefresh className="text-[13px]" />
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
                        className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200"
                    >
                        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <MdCancel className="text-[28px]" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mb-1">Order Cancel Karna Chahte Hain?</h3>
                        <p className="text-xs font-semibold text-slate-400 mb-4 leading-relaxed">
                            Kripya cancel karne ki wajah batayein taaki hum apni service behtar kar sakein.
                        </p>

                        <div className="space-y-2 mb-5 text-left">
                            {[
                                "Galti se order ho gaya",
                                "Delivery time jyada hai",
                                "Galat address select ho gaya",
                                "Samaan change karna hai",
                                "Anya wajah (Other)"
                            ].map((reasonOption) => (
                                <label
                                    key={reasonOption}
                                    onClick={() => setCancelReason(reasonOption)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${cancelReason === reasonOption
                                        ? "border-[#FF5C00] bg-orange-50/50 text-slate-800"
                                        : "border-slate-100 hover:bg-slate-50 text-slate-600"
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="cancelReason"
                                        checked={cancelReason === reasonOption}
                                        onChange={() => setCancelReason(reasonOption)}
                                        className="accent-[#FF5C00] w-3.5 h-3.5"
                                    />
                                    <span>{reasonOption}</span>
                                </label>
                            ))}

                            {cancelReason === "Anya wajah (Other)" && (
                                <textarea
                                    value={otherReasonText}
                                    onChange={(e) => setOtherReasonText(e.target.value)}
                                    placeholder="Apni wajah yahan likhein..."
                                    rows={2}
                                    className="w-full text-xs font-semibold p-3 border border-slate-200 rounded-xl focus:outline-none focus:border-[#FF5C00] transition-colors mt-2"
                                />
                            )}
                        </div>

                        <div className="flex gap-2.5">
                            <button
                                disabled={cancellingLoader}
                                onClick={() => {
                                    setIsCancelModalOpen(false);
                                    setCancellingOrderId(null);
                                }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
                            >
                                Back
                            </button>
                            <button
                                disabled={cancellingLoader}
                                onClick={handleCancelOrderSubmit}
                                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                            >
                                {cancellingLoader ? "Cancelling..." : "Confirm Cancel"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
