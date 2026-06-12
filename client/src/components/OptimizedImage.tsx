"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "width" | "height" | "src"> {
  src: string;
  alt: string;
  preset?: "thumbnail" | "card" | "large" | "avatar";
  width?: number | string;
  height?: number | string;
  priority?: boolean;
}

/**
 * Optimizes a Cloudinary URL by inserting transformation parameters.
 */
export const getOptimizedCloudinaryUrl = (
  url: string,
  preset: "thumbnail" | "card" | "large" | "avatar" = "card"
): string => {
  if (!url || !url.includes("res.cloudinary.com")) return url;

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
  if (!url || !url.includes("images.unsplash.com")) return url;

  try {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set("auto", "format");
    parsedUrl.searchParams.set("q", "80");

    switch (preset) {
      case "thumbnail":
        parsedUrl.searchParams.set("w", "150");
        parsedUrl.searchParams.set("h", "150");
        parsedUrl.searchParams.set("fit", "crop");
        break;
      case "avatar":
        parsedUrl.searchParams.set("w", "100");
        parsedUrl.searchParams.set("h", "100");
        parsedUrl.searchParams.set("fit", "crop");
        break;
      case "card":
        parsedUrl.searchParams.set("w", "400");
        parsedUrl.searchParams.set("h", "300");
        parsedUrl.searchParams.set("fit", "crop");
        break;
      case "large":
        parsedUrl.searchParams.set("w", "1000");
        parsedUrl.searchParams.delete("h");
        parsedUrl.searchParams.delete("fit");
        break;
    }
    return parsedUrl.toString();
  } catch (e) {
    return url;
  }
};

export default function OptimizedImage({
  src,
  alt,
  preset = "card",
  className = "",
  width,
  height,
  priority,
  loading,
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [optimizedSrc, setOptimizedSrc] = useState(src);

  useEffect(() => {
    if (src) {
      if (src.includes("res.cloudinary.com")) {
        setOptimizedSrc(getOptimizedCloudinaryUrl(src, preset));
      } else if (src.includes("images.unsplash.com")) {
        setOptimizedSrc(getOptimizedUnsplashUrl(src, preset));
      } else {
        setOptimizedSrc(src);
      }
    }
  }, [src, preset]);

  const useFill = !width && !height;
  const parsedWidth = width ? Number(width) : undefined;
  const parsedHeight = height ? Number(height) : undefined;

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
        sizes={useFill ? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" : undefined}
        onLoad={() => setLoaded(true)}
        className={`transition-opacity duration-300 ${
          className.includes("object-contain") ? "object-contain" : "object-cover"
        } ${loaded ? "opacity-100" : "opacity-0"}`}
        {...(props as any)}
      />
    </div>
  );
}
