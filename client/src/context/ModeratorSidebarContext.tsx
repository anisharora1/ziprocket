"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

interface ModeratorSidebarContextType {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleDesktopSidebar: () => void;
  toggleMobileSidebar: () => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleSidebar: () => void;
}

const ModeratorSidebarContext = createContext<ModeratorSidebarContextType | undefined>(undefined);

export function ModeratorSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const pathname = usePathname();

  // Load saved desktop preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("moderator_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const toggleDesktopSidebar = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("moderator_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const openMobileSidebar = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsMobileOpen((prev) => !prev);
    } else {
      toggleDesktopSidebar();
    }
  }, [toggleDesktopSidebar]);

  return (
    <ModeratorSidebarContext.Provider
      value={{
        isCollapsed,
        isMobileOpen,
        toggleDesktopSidebar,
        toggleMobileSidebar,
        openMobileSidebar,
        closeMobileSidebar,
        toggleSidebar,
      }}
    >
      {children}
    </ModeratorSidebarContext.Provider>
  );
}

export function useModeratorSidebar() {
  const context = useContext(ModeratorSidebarContext);
  if (!context) {
    throw new Error("useModeratorSidebar must be used within a ModeratorSidebarProvider");
  }
  return context;
}
