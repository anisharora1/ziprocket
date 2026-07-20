"use client";

import React from "react";
import dynamic from "next/dynamic";
import { HomeCategoriesSkeleton } from "./Skeletons";

const HomeCategories = dynamic(() => import("./HomeCategories"), {
  ssr: false,
  loading: () => <HomeCategoriesSkeleton />,
});

export default function DynamicHomeCategories() {
  return <HomeCategories />;
}
