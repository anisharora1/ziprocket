"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "width" | "height" | "src" | "sizes"> {
  src: any;
  alt: string;
  preset?: "thumbnail" | "card" | "large" | "avatar";
  width?: number | string;
  height?: number | string;
  priority?: boolean;
  sizes?: string;
}

/**
 * Optimizes a Cloudinary URL by inserting transformation parameters.
 */
export const getOptimizedCloudinaryUrl = (
  url: string,
  preset: "thumbnail" | "card" | "large" | "avatar" = "card"
): string => {
  if (!url || typeof url !== "string" || !url.includes("res.cloudinary.com")) return url;

  // Split at /upload/
  const parts = url.split("/upload/");
  if (parts.length !== 2) return url;

  let transformations = "f_auto,q_auto";
  switch (preset) {
    case "thumbnail":
      transformations = "w_150,h_150,c_fill,g_auto,f_auto,q_auto";
      break;
    case "avatar":
      transformations = "w_100,h_100,c_fill,g_face,f_auto,q_auto";
      break;
    case "card":
      transformations = "w_400,h_300,c_fill,g_auto,f_auto,q_auto";
      break;
    case "large":
      transformations = "w_1000,c_limit,f_auto,q_auto";
      break;
  }

  return `${parts[0]}/upload/${transformations}/${parts[1]}`;
};

/**
 * Optimizes an Unsplash URL by modifying or adding sizing parameters.
 */
export const getOptimizedUnsplashUrl = (
  url: string,
  preset: "thumbnail" | "card" | "large" | "avatar" = "card"
): string => {
  if (!url || typeof url !== "string" || !url.includes("images.unsplash.com")) return url;

  try {
    const parsedUrl = new URL(url);
    const searchParams = parsedUrl.searchParams;

    // Set default auto-format and quality
    searchParams.set("auto", "format");
    if (!searchParams.has("q")) {
      searchParams.set("q", "80");
    }

    // Apply preset sizing
    switch (preset) {
      case "thumbnail":
        searchParams.set("w", "150");
        searchParams.set("h", "150");
        searchParams.set("fit", "crop");
        break;
      case "avatar":
        searchParams.set("w", "100");
        searchParams.set("h", "100");
        searchParams.set("fit", "crop");
        searchParams.set("facepad", "2");
        break;
      case "card":
        searchParams.set("w", "400");
        searchParams.set("h", "300");
        searchParams.set("fit", "crop");
        break;
      case "large":
        searchParams.set("w", "1000");
        break;
    }

    return parsedUrl.toString();
  } catch (e) {
    return url;
  }
};

export const getOptimizedSrc = (
  src: any,
  preset: "thumbnail" | "card" | "large" | "avatar" = "card"
): string => {
  if (!src) return "";
  
  // Safe extraction if src is an object (e.g. Cloudinary image data or database subdocument)
  let url = src;
  if (typeof src === "object" && src !== null) {
    url = src.url || "";
  }

  if (typeof url !== "string") return "";

  if (url.includes("res.cloudinary.com")) {
    return getOptimizedCloudinaryUrl(url, preset);
  } else if (url.includes("images.unsplash.com")) {
    return getOptimizedUnsplashUrl(url, preset);
  }
  return url;
};

export default function OptimizedImage({
  src,
  alt,
  preset = "card",
  width,
  height,
  className = "",
  priority = false,
  loading,
  sizes,
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(priority); // Priority images start visible (no opacity fade)
  const optimizedSrc = getOptimizedSrc(src, preset);

  const useFill = !width && !height;
  const parsedWidth = width ? Number(width) : undefined;
  const parsedHeight = height ? Number(height) : undefined;

  // Compute smart responsive sizes defaults based on the image preset to save bandwidth
  let computedSizes = undefined;
  if (useFill) {
    if (sizes) {
      computedSizes = sizes;
    } else {
      switch (preset) {
        case "thumbnail":
          computedSizes = "80px";
          break;
        case "avatar":
          computedSizes = "100px";
          break;
        case "card":
          // Standard card width is 160px on mobile, ~220px on desktop (min/max bounds)
          computedSizes = "(max-width: 768px) 160px, (max-width: 1200px) 220px, 300px";
          break;
        case "large":
          computedSizes = "(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1000px";
          break;
      }
    }
  }

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {/* Loading shimmer placeholder */}
      {!loaded && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
          <span className="material-symbols-outlined text-slate-400 text-2xl">image</span>
        </div>
      )}
      
      <Image
        src={optimizedSrc || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4"}
        alt={alt || "Optimized Image"}
        fill={useFill}
        width={useFill ? undefined : parsedWidth}
        height={useFill ? undefined : parsedHeight}
        priority={priority}
        loading={priority ? undefined : (loading || "lazy")}
        sizes={computedSizes}
        onLoad={() => setLoaded(true)}
        className={`transition-opacity duration-300 ${
          className.includes("object-contain") ? "object-contain" : "object-cover"
        } ${loaded ? "opacity-100" : "opacity-0"}`}
        {...(props as any)}
      />
    </div>
  );
}
