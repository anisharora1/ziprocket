"use client";
import dynamic from "next/dynamic";

const BottomNavBar = dynamic(() => import("./BottomNavBar"), {
  ssr: false,
});

export default BottomNavBar;
