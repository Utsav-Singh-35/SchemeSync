'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Scheme, automationAPI, extensionAPI } from '@/lib/api';
import { BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid, CpuChipIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

interface SchemeCardProps {
  scheme: Scheme;
  onSave?: (id: number) => void;
  onRemove?: (id: number) => void;
  isSaved?: boolean;
  showEligibility?: boolean;
  showApplyButton?: boolean;
}

export default function SchemeCard({ 
  scheme, 
  onSave, 
  onRemove, 
  isSaved = false,
  showEligibility = true,
  showApplyButton = true
}: SchemeCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(isSaved);

  // Sync with prop changes
  useEffect(() => {
    setIsBookmarked(isSaved);
  }, [isSaved]);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (isBookmarked && onRemove) {
      await onRemove(scheme.id);
      setIsBookmarked(false);
    } else if (!isBookmarked && onSave) {
      await onSave(scheme.id);
      setIsBookmarked(true);
    }
  };

  const handleAutoFill = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Use actual application URL from scheme data or construct one
    const applicationUrl = scheme.application_url || 
                          scheme.reference_links_array?.find((link: any) => 
                            link.url.includes('apply') || 
                            link.url.includes('application') ||
                            link.url.includes('form')
                          )?.url ||
                          `https://www.myscheme.gov.in/schemes/${scheme.slug}`;
    
    try {
      toast.loading('Checking SchemeSync Extension...', { id: 'autofill' });
      
      // Check if extension is available
      const extensionStatus = await extensionAPI.getExtensionStatus();
      
      if (!extensionStatus.available) {
        toast.error(
          'SchemeSync Extension not found. Please install the extension to use auto-fill.', 
          { id: 'autofill', duration: 5000 }
        );
        
        // Open application URL manually
        setTimeout(() => {
          window.open(applicationUrl, '_blank', 'noopener,noreferrer');
        }, 1000);
        return;
      }

      toast.loading('Opening application with extension support...', { id: 'autofill' });
      
      // Use extension to open and handle the application
      const result = await extensionAPI.triggerAutofill(scheme.id.toString(), applicationUrl);
      
      toast.success(
        `✅ Application opened! The SchemeSync extension will automatically assist with form filling.`, 
        { 
          id: 'autofill',
          duration: 4000
        }
      );
      
    } catch (error: any) {
      console.error('Auto-fill error:', error);
      toast.error('Extension unavailable. Opening manual form...', { id: 'autofill' });
      
      // Fallback to manual application
      setTimeout(() => {
        window.open(applicationUrl, '_blank', 'noopener,noreferrer');
      }, 1500);
    }
  };

  const getEligibilityBadge = () => {
    if (!scheme.eligibility || !showEligibility) return null;
    
    const { status, score } = scheme.eligibility;
    let bgColor = 'bg-gray-100 text-gray-800';
    let text = 'Unknown';
    
    switch (status) {
      case 'eligible':
        bgColor = 'bg-yellow-100 text-yellow-900 border border-yellow-300';
        text = `${Math.round(score)}% Match`;
        break;
      case 'likely_eligible':
        bgColor = 'bg-gray-200 text-gray-800 border border-gray-300';
        text = `${Math.round(score)}% Likely`;
        break;
      case 'not_eligible':
        bgColor = 'bg-gray-300 text-gray-900 border border-gray-400';
        text = 'Not Eligible';
        break;
      case 'insufficient_data':
        bgColor = 'bg-gray-100 text-gray-700 border border-gray-300';
        text = 'Need More Info';
        break;
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor}`}>
        {text}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="flex-1 min-w-0">
          <Link href={`/schemes/${scheme.slug}`}>
            <h3 className="text-base font-semibold text-gray-900 hover:text-yellow-600 cursor-pointer line-clamp-2 leading-snug">
              {scheme.title}
            </h3>
          </Link>
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-xs text-gray-500 truncate">{scheme.ministry}</span>
            <span className="text-gray-300">•</span>
            <span className="text-xs text-gray-500 capitalize flex-shrink-0">{scheme.level}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 flex-shrink-0">
          {getEligibilityBadge()}
          {(onSave || onRemove) && (
            <button
              onClick={handleBookmark}
              className="text-gray-400 hover:text-yellow-500 transition-colors"
            >
              {isBookmarked ? (
                <BookmarkSolid className="h-5 w-5 text-yellow-500" />
              ) : (
                <BookmarkOutline className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-600 text-sm mb-4 line-clamp-2 flex-grow">
        {scheme.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-4 min-h-[28px]">
        {scheme.tags.slice(0, 3).map((tag: any, index: number) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300"
          >
            {typeof tag === 'string' ? tag : tag.label || tag.value || 'Unknown'}
          </span>
        ))}
        {scheme.tags.length > 3 && (
          <span className="text-xs text-gray-500 self-center">+{scheme.tags.length - 3} more</span>
        )}
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-auto">
        <div className="text-xs text-gray-500">
          {new Date(scheme.last_updated).toLocaleDateString()}
        </div>
        <div className="flex items-center space-x-2">
          {showApplyButton && (
            <button
              onClick={handleAutoFill}
              className="flex items-center px-3 py-1.5 bg-yellow-500 text-black text-xs font-medium rounded-md hover:bg-yellow-400 transition-colors"
            >
              <CpuChipIcon className="h-3 w-3 mr-1" />
              Auto-Fill
            </button>
          )}
          <Link
            href={`/schemes/${scheme.slug}`}
            className="text-gray-900 hover:text-yellow-600 text-xs font-medium whitespace-nowrap"
          >
            View Details →
          </Link>
        </div>
      </div>
    </div>
  );
}