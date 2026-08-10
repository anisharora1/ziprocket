"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { MdError } from "react-icons/md";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[React ErrorBoundary caught error]:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-4 text-rose-600">
            <MdError className="text-4xl" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-slate-500 mb-6 max-w-sm text-sm">
            We encountered an unexpected interface error. Please refresh the page or try again.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="px-6 py-2.5 bg-[#FF5C00] text-white font-bold rounded-xl shadow-sm hover:bg-[#e05100] transition-colors text-sm"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

