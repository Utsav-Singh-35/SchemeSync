'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { schemesAPI, Scheme } from '@/lib/api';
import Header from '@/components/Header';
import SchemeCard from '@/components/SchemeCard';
import Link from 'next/link';
import { 
  BookmarkIcon, 
  MagnifyingGlassIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SavedSchemesPage() {
  const { user } = useAuth();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (user) {
      loadSavedSchemes();
    }
  }, [user]);

  const loadSavedSchemes = async () => {
    setLoading(true);
    
    try {
      const response = await schemesAPI.getSaved({ 
        limit: 1000, 
        offset: 0 
      });

      if (response.success) {
        setSchemes(response.data.schemes);
      }
    } catch (error) {
      console.error('Failed to load saved schemes:', error);
      toast.error('Failed to load saved schemes');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSaved = async (schemeId: number) => {
    try {
      await schemesAPI.removeSaved(schemeId);
      setSchemes(prev => prev.filter(scheme => scheme.id !== schemeId));
      toast.success('Scheme removed from saved list');
    } catch (error) {
      toast.error('Failed to remove scheme');
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to remove all saved schemes?')) {
      try {
        for (const scheme of schemes) {
          await schemesAPI.removeSaved(scheme.id);
        }
        setSchemes([]);
        toast.success('All saved schemes removed');
      } catch (error) {
        toast.error('Failed to clear saved schemes');
      }
    }
  };

  // Filter schemes by search query
  const filteredSchemes = schemes.filter(scheme => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      scheme.title?.toLowerCase().includes(query) ||
      scheme.description?.toLowerCase().includes(query) ||
      scheme.ministry?.toLowerCase().includes(query)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredSchemes.length / itemsPerPage);
  const paginatedSchemes = filteredSchemes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <BookmarkIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Not authenticated</h3>
            <p className="mt-1 text-sm text-gray-500">
              Please log in to view your saved schemes.
            </p>
            <div className="mt-6">
              <Link
                href="/auth/login"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-black bg-yellow-500 hover:bg-yellow-400"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Saved Schemes</h1>
              <p className="mt-1 text-gray-600">
                Schemes you've bookmarked for future reference
              </p>
            </div>
            {schemes.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
              >
                <TrashIcon className="h-5 w-5 mr-2" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        {schemes.length > 0 && (
          <div className="mb-8">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search saved schemes..."
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
              <MagnifyingGlassIcon className="absolute right-4 top-3.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
        )}

        {/* Results Count */}
        {schemes.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{filteredSchemes.length}</span> saved schemes
              {searchQuery && ` matching "${searchQuery}"`}
            </h2>
          </div>
        )}

        {/* Schemes List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-48">
                <div className="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded mb-4 w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                <div className="flex space-x-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : paginatedSchemes.length > 0 ? (
          <>
            <div className="space-y-4 mb-8">
              {paginatedSchemes.map((scheme) => (
                <SchemeCard
                  key={scheme.id}
                  scheme={scheme}
                  onRemove={handleRemoveSaved}
                  isSaved={true}
                  showEligibility={false}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ←
                </button>
                
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-gray-500">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => goToPage(page as number)}
                      className={`px-4 py-2 rounded-md font-medium ${
                        currentPage === page
                          ? 'bg-yellow-500 text-black'
                          : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  →
                </button>
              </div>
            )}
          </>
        ) : schemes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <BookmarkIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No saved schemes</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              Save schemes you're interested in to access them quickly later.
            </p>
            <div className="mt-6">
              <Link
                href="/search"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-black bg-yellow-500 hover:bg-yellow-400"
              >
                Browse Schemes
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No schemes match your search</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              Try different keywords or browse all your saved schemes.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear Search
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
