"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/services/api";
import ModeratorHeader from "@/components/moderator/ModeratorHeader";
import {
  MdSearch,
  MdGroups,
  MdCalendarToday,
  MdCall,
  MdLocationOn,
} from "react-icons/md";

interface UserAddress {
  fullAddress: string;
  city: string;
  location: {
    lat: number;
    lng: number;
  };
}

interface Customer {
  _id: string;
  name: string;
  phone: string;
  createdAt: string;
  addresses?: UserAddress[];
}

export default function ModeratorUsersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCustomers = async () => {
    try {
      const res = await apiClient.get("/orders/grocery/users");
      if (res.data.success) {
        setCustomers(res.data.users || []);
      }
    } catch (err) {
      console.error("Failed to load zone customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = customer.name?.toLowerCase().includes(query);
    const phoneMatch = customer.phone?.includes(query);
    return nameMatch || phoneMatch;
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <ModeratorHeader title="Zone Customers Hub" />

      <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto">
        {/* Controls Panel */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800">Zone Customers</h3>
            <p className="text-[11px] font-semibold text-slate-400">Audience pool residing or ordering within your assigned zones</p>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]" />
            <input
              type="text"
              placeholder="Search customers by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-5 py-3 text-xs bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:outline-none rounded-2xl font-semibold transition-all text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4 shadow-sm animate-pulse h-48" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-100 rounded-3xl p-10 sm:p-16 flex flex-col items-center justify-center text-center max-w-lg mx-auto shadow-sm">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-5 border border-emerald-100">
              <MdGroups className="text-[36px] text-emerald-600" />
            </div>
            <h3 className="text-lg font-black text-slate-800 leading-none">No Customers Found</h3>
            <p className="text-slate-400 text-xs font-semibold leading-relaxed mt-2.5 max-w-xs">
              No customer users have placed grocery orders in your assigned delivery zones yet. 
            </p>
          </div>
        ) : (
          /* Customers Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredCustomers.map((customer) => (
              <div 
                key={customer._id} 
                className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 flex items-center justify-center font-black text-sm shrink-0 border border-emerald-100/50">
                      {customer.name?.charAt(0).toUpperCase() || "C"}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800 leading-none">{customer.name || "Customer"}</h4>
                      <p className="text-[10px] font-semibold text-slate-400 mt-1 flex items-center gap-0.5">
                        <MdCalendarToday className="text-[12px]" />
                        Joined {new Date(customer.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 my-3.5" />

                  {/* Customer Contact */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <MdCall className="text-[16px] text-slate-400" />
                      <span className="text-slate-750">+91 {customer.phone}</span>
                    </div>

                    {/* Customer Addresses */}
                    {customer.addresses && customer.addresses.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mt-2">Saved Delivery Places</p>
                        <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                          {customer.addresses.map((addr, idx) => (
                            <div key={idx} className="flex gap-1.5 items-start text-[11px] leading-relaxed text-slate-650 bg-slate-50/50 p-2 rounded-xl border border-slate-100/60 font-semibold">
                              <MdLocationOn className="text-[13px] text-slate-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{addr.fullAddress}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-rose-500 mt-2">No saved delivery addresses resolved.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
