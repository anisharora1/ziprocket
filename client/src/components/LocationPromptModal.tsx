'use client';
import React, { useState } from 'react';
import { useLocation } from '@/context/LocationContext';
import { MdLocationOn, MdSync, MdMyLocation, MdSearch } from 'react-icons/md';

interface LocationPromptModalProps {
  onManualTrigger?: () => void;
}

export default function LocationPromptModal({ onManualTrigger }: LocationPromptModalProps = {}) {
  const { isFirstTime, fetchLocation, isLoading, error, dismissPrompt } = useLocation();
  const [showToast, setShowToast] = useState(false);

  if (!isFirstTime) return null;

  const handleUseLocation = () => {
    if (onManualTrigger) {
      onManualTrigger();
    }
    fetchLocation();
  };

  const handleManualSearchClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full sm:w-[400px] rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 transform transition-all animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in-0 duration-300">
        
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-[#FF5C00]/10 rounded-full flex items-center justify-center">
            <MdLocationOn className="text-[40px] text-[#FF5C00]" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-center text-slate-900 dark:text-white mb-2">
          Where are you?
        </h2>
        <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
          To deliver as quickly as possible, we would like your current location.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl text-center font-medium">
            {error}
          </div>
        )}

        <div className="space-y-3 relative">
          <button
            onClick={handleUseLocation}
            disabled={isLoading}
            className="w-full py-4 bg-[#FF5C00] text-white font-bold rounded-2xl shadow-lg shadow-[#FF5C00]/20 hover:bg-[#e05200] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <MdSync className="animate-spin text-xl" />
            ) : (
              <MdMyLocation className="text-[20px]" />
            )}
            {isLoading ? 'Detecting...' : 'Use my location (Use my location)'}
          </button>

          <button
            onClick={handleManualSearchClick}
            className="w-full py-4 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <MdSearch className="text-[20px]" />
            Search location manually
          </button>
          
          {showToast && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
              Coming soon with Google Maps API!
            </div>
          )}
        </div>

        {/* Skip button for development/testing flexibility */}
        <button 
          onClick={dismissPrompt}
          className="mt-6 w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

