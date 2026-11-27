"use client";

import React, { useState } from "react";
import { apiClient } from "@/services/api";
import { getDiscountPercent } from "@/utils/discount";
import {
  MdAdd,
  MdArrowDownward,
  MdArrowUpward,
  MdDelete,
  MdSearch,
} from "react-icons/md";
import {
  GroceryProductOption,
  ThemeHomeSection,
  getProductImageUrl,
} from "./themeCampaignUtils";

interface ProductStripEditorProps {
  idPrefix: string;
  sections: ThemeHomeSection[];
  onChange: (next: ThemeHomeSection[]) => void;
  productLookup: Record<string, GroceryProductOption>;
  onProductsLoaded: (products: GroceryProductOption[]) => void;
  errors?: string[];
}

export default function ProductStripEditor({
  idPrefix,
  sections,
  onChange,
  productLookup,
  onProductsLoaded,
  errors = [],
}: ProductStripEditorProps) {
  const [searchByIdx, setSearchByIdx] = useState<Record<number, string>>({});
  const [resultsByIdx, setResultsByIdx] = useState<Record<number, GroceryProductOption[]>>({});
  const [searchingIdx, setSearchingIdx] = useState<number | null>(null);

  const handleAddSection = () => {
    if (sections.length >= 3) return;
    onChange([
      ...sections,
      { type: "product_strip", title: `Festive Picks ${sections.length + 1}`, productIds: [] },
    ]);
  };

  const handleTitleChange = (idx: number, title: string) => {
    onChange(sections.map((sec, i) => (i === idx ? { ...sec, title } : sec)));
  };

  const handleRemoveSection = (idx: number) => {
    onChange(sections.filter((_, i) => i !== idx));
  };

  const handleSearchProducts = async (secIdx: number) => {
    const query = (searchByIdx[secIdx] || "").trim();
    try {
      setSearchingIdx(secIdx);
      const url = query
        ? `/grocery?search=${encodeURIComponent(query)}&limit=15`
        : `/grocery?limit=15`;
      const res = await apiClient.get(url);
      if (res.data.success) {
        const list: GroceryProductOption[] = res.data.products || [];
        setResultsByIdx((prev) => ({ ...prev, [secIdx]: list }));
        onProductsLoaded(list);
      }
    } catch {
      // Ignore transient search error
    } finally {
      setSearchingIdx(null);
    }
  };

  const handleAddProduct = (secIdx: number, product: GroceryProductOption) => {
    onProductsLoaded([product]);
    onChange(
      sections.map((sec, i) => {
        if (i !== secIdx) return sec;
        if (sec.productIds.includes(product._id) || sec.productIds.length >= 12) return sec;
        return { ...sec, productIds: [...sec.productIds, product._id] };
      })
    );
  };

  const handleRemoveProduct = (secIdx: number, productId: string) => {
    onChange(
      sections.map((sec, i) =>
        i === secIdx
          ? { ...sec, productIds: sec.productIds.filter((id) => id !== productId) }
          : sec
      )
    );
  };

  const handleMoveProduct = (secIdx: number, prodIdx: number, direction: -1 | 1) => {
    onChange(
      sections.map((sec, i) => {
        if (i !== secIdx) return sec;
        const target = prodIdx + direction;
        if (target < 0 || target >= sec.productIds.length) return sec;
        const nextIds = [...sec.productIds];
        const [moved] = nextIds.splice(prodIdx, 1);
        nextIds.splice(target, 0, moved);
        return { ...sec, productIds: nextIds };
      })
    );
  };

  return (
    <div className="space-y-4 pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
          Product Strip Sections ({sections.length}/3)
        </h3>
        <button
          type="button"
          disabled={sections.length >= 3}
          onClick={handleAddSection}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 disabled:opacity-50"
        >
          <MdAdd />
          Add Product Strip
        </button>
      </div>

      {sections.map((sec, secIdx) => (
        <div
          key={secIdx}
          className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label
                htmlFor={`${idPrefix}-sec-title-${secIdx}`}
                className="block text-[11px] font-bold text-slate-600 mb-1"
              >
                Section {secIdx + 1} Title *
              </label>
              <input
                id={`${idPrefix}-sec-title-${secIdx}`}
                type="text"
                required
                value={sec.title}
                onChange={(e) => handleTitleChange(secIdx, e.target.value)}
                placeholder="e.g. Festive Sweets & Snacks"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
              />
            </div>
            <button
              type="button"
              onClick={() => handleRemoveSection(secIdx)}
              aria-label={`Remove section ${secIdx + 1}`}
              className="mt-5 p-2 rounded-lg text-rose-600 hover:bg-rose-50"
            >
              <MdDelete className="text-base" />
            </button>
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-sec-search-${secIdx}`}
              className="block text-[11px] font-bold text-slate-600 mb-1"
            >
              Search Grocery Products ({sec.productIds.length}/12 selected)
            </label>
            <div className="flex gap-2">
              <input
                id={`${idPrefix}-sec-search-${secIdx}`}
                type="text"
                value={searchByIdx[secIdx] || ""}
                onChange={(e) =>
                  setSearchByIdx((prev) => ({ ...prev, [secIdx]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchProducts(secIdx);
                  }
                }}
                placeholder="Search by product name..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
              />
              <button
                type="button"
                onClick={() => handleSearchProducts(secIdx)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-900"
              >
                <MdSearch />
                {searchingIdx === secIdx ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          {(resultsByIdx[secIdx] || []).length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
              {(resultsByIdx[secIdx] || []).map((p) => {
                const alreadyAdded = sec.productIds.includes(p._id);
                const pct = getDiscountPercent(p.price, p.discountedPrice);
                const img = getProductImageUrl(p);
                return (
                  <div
                    key={p._id}
                    className="flex items-center justify-between px-3 py-2 text-xs gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {img ? (
                        <img
                          src={img}
                          alt={p.name}
                          className="w-8 h-8 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-100 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-500">
                          ₹{pct > 0 && p.discountedPrice ? p.discountedPrice : p.price}
                          {pct > 0 && (
                            <span className="ml-1.5 text-emerald-700 font-bold">
                              ({pct}% OFF)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={alreadyAdded || sec.productIds.length >= 12}
                      onClick={() => handleAddProduct(secIdx, p)}
                      className="px-2.5 py-1 rounded-lg bg-[#FF5C00] text-white text-[11px] font-bold disabled:opacity-40 shrink-0"
                    >
                      {alreadyAdded ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {sec.productIds.length > 0 && (
            <div className="space-y-1.5">
              {sec.productIds.map((pid, pIdx) => {
                const p = productLookup[pid];
                const pct = p ? getDiscountPercent(p.price, p.discountedPrice) : 0;
                const img = p ? getProductImageUrl(p) : null;
                return (
                  <div
                    key={pid}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold text-slate-400 w-4">
                        {pIdx + 1}.
                      </span>
                      {img ? (
                        <img
                          src={img}
                          alt={p?.name || pid}
                          className="w-8 h-8 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-100 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">
                          {p ? p.name : pid}
                        </p>
                        {p && (
                          <p className="text-[11px] text-slate-500">
                            ₹{pct > 0 && p.discountedPrice ? p.discountedPrice : p.price}
                            {pct > 0 && (
                              <span className="ml-1.5 text-emerald-700 font-bold">
                                {pct}% OFF
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={pIdx === 0}
                        onClick={() => handleMoveProduct(secIdx, pIdx, -1)}
                        aria-label="Move product up"
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <MdArrowUpward />
                      </button>
                      <button
                        type="button"
                        disabled={pIdx === sec.productIds.length - 1}
                        onClick={() => handleMoveProduct(secIdx, pIdx, 1)}
                        aria-label="Move product down"
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <MdArrowDownward />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(secIdx, pid)}
                        aria-label="Remove product"
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                      >
                        <MdDelete />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      {errors.map((err, i) => (
        <p key={i} className="text-xs font-semibold text-rose-600">
          {err}
        </p>
      ))}
    </div>
  );
}
