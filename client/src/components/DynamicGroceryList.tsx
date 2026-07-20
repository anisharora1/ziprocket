"use client";

import React from "react";
import dynamic from "next/dynamic";
import { GroceryListSkeleton } from "./Skeletons";

const GroceryList = dynamic(() => import("./GroceryList"), {
  ssr: false,
  loading: () => <GroceryListSkeleton />,
});

export default function DynamicGroceryList() {
  return <GroceryList />;
}
