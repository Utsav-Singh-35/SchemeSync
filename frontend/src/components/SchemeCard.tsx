'use client';

import Link from 'next/link';
import { Scheme } from '@/lib/api';
import { BookmarkIcon as BookmarkOutline } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';

interface SchemeCardProps {
  scheme: Scheme;
  onSave?: (id: number) => void;
  onRemove?: (id: number) => void;
  isSaved?: boolean;
  showEligibility?: boolean;
}

export default function SchemeCard({ 
  scheme, 
  onSave, 
  onRemove, 
  isSaved = false,
  showEligibility = true 
}: SchemeCardProps) {
  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSaved && onRemove) {
      onRemove(scheme.id);
    } else if (!isSaved && onSave) {
      onSave(scheme.id);
    }
  };

  const getEligibilityBadge = () => {
    if (!scheme.eligibility || !showEligibility) return null;
    
    const { status, score } = scheme.eligibility;
    let bgColor = 'bg-gray-100 text-gray-800';
    let text = 'Unknown';
    
    switch (status) {
      case 'eligible':
        bgColor = 'bg-green-100 text-green-800';
        text = `${Math.round(score)}% Match`;
        break;
      case 'likely_eligible':
        bgColor = 'bg-yellow-100 text-yellow-800';
        text = `${Math.round(score)}% Likely`;
        break;
      case 'not_eligible':
        bgColor = 'bg-red-100 text-red-800';
        text = 'Not Eligible';
        break;
      case 'insufficient_data':
        bgColor = 'bg-blue-100 text-blue-800';
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
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Link href={`/schemes/${scheme.slug}`}>
            <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 cursor-pointer">
              {scheme.title}
            </h3>
          </Link>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-sm text-gray-500">{scheme.ministry}</span>
            <span className="text-gray-300">•</span>
            <span className="text-sm text-gray-500 capitalize">{scheme.level}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {getEligibilityBadge()}
          {(onSave || onRemove) && (
            <button
              onClick={handleBookmark}
              className="text-gray-400 hover:text-blue-600 transition-colors"
            >
              {isSaved ? (
                <BookmarkSolid className="h-5 w-5" />
              ) : (
                <BookmarkOutline className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
        {scheme.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {scheme.tags.slice(0, 3).map((tag: any, index: number) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700"
          >
            {typeof tag === 'string' ? tag : tag.label || tag.value || 'Unknown'}
          </span>
        ))}
        {scheme.tags.length > 3 && (
          <span className="text-xs text-gray-500">+{scheme.tags.length - 3} more</span>
        )}
      </div>

      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500">
          Updated: {new Date(scheme.last_updated).toLocaleDateString()}
        </div>
        <Link
          href={`/schemes/${scheme.slug}`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}