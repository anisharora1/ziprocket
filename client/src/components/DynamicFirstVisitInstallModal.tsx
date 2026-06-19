"use client";
import dynamic from "next/dynamic";

const FirstVisitInstallModal = dynamic(() => import("./FirstVisitInstallModal"), {
  ssr: false,
});

export default FirstVisitInstallModal;
