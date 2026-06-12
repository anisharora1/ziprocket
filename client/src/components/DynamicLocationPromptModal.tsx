"use client";
import dynamic from "next/dynamic";

const LocationPromptModal = dynamic(() => import("./LocationPromptModal"), {
  ssr: false,
});

export default LocationPromptModal;
