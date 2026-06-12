"use client";
import dynamic from "next/dynamic";

const FloatingCartButton = dynamic(() => import("./FloatingCartButton"), {
  ssr: false,
});

export default FloatingCartButton;
