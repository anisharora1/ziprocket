"use client";
import dynamic from "next/dynamic";

const PwaManager = dynamic(() => import("./PwaManager"), {
  ssr: false,
});

export default PwaManager;
