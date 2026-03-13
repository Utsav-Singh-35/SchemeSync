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
  FunnelIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SavedSchemesPage() {
  const { user } = useAuth();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [filteredSchemes, setFilteredSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMinistry, setSelectedMinistry] = useState('');
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    hasMore: false
  });

  useEffect(() => {
    if (user) {
      loadSavedSchemes();
    }
  }, [user]);

  useEffect(() => {
    filterSchemes();
  }, [schemes, searchQuery, selectedCategory, selectedMinistry]);

  const loadSavedSchemes = async (loadMore = false) => {
    if (!loadMore) setLoading(true);
    
    try {
      const offset = loadMore ? pagination.offset + pagination.limit : 0;
      const response = await schemesAPI.getSaved({ 
        limit: pagination.limit, 
        offset 
      });

      if (response.success) {
        if (loadMore) {
          setSchemes(prev => [...prev, ...response.data.schemes]);
        } else {
          setSchemes(response.data.schemes);
        }

        setPagination({
          limit: response.data.pagination?.limit || 20,
          offset: offset,
          hasMore: response.data.pagination?.hasMore || false
        });
      }
    } catch (error) {
      console.error('Failed to load saved schemes:', error);
      toast.error('Failed to load saved schemes');
    } finally {
      setLoading(false);
    }
  };

  const filterSchemes = () => {
    let filtered = [...schemes];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(scheme => 
        scheme.title?.toLowerCase().includes(query) ||
        scheme.description?.toLowerCase().includes(query) ||
        scheme.ministry?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(scheme => 
        scheme.scheme_category?.some((cat: any) => 
          (typeof cat === 'string' ? cat : cat.label || cat.value)?.toLowerCase().includes(selectedCategory.toLowerCase())
        )
      );
    }

    // Ministry filter
    if (selectedMinistry) {
      filtered = filtered.filter(scheme => 
        scheme.ministry?.toLowerCase().includes(selectedMinistry.toLowerCase())
      );
    }

    setFilteredSchemes(filtered);
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
        // Remove all schemes one by one (in a real app, you'd have a bulk delete API)
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

  const loadMore = () => {
    if (pagination.hasMore && !loading) {
      loadSavedSchemes(true);
    }
  };

  // Get unique categories and ministries for filters
  const categories = [...new Set(
    schemes.flatMap(scheme => 
      scheme.scheme_category?.map((cat: any) => 
        typeof cat === 'string' ? cat : cat.label || cat.value
      ) || []
    )
  )].filter(Boolean);

  const ministries = [...new Set(
    schemes.map(scheme => scheme.ministry).filter(Boolean)
  )];

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
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Saved Schemes</h1>
            <p className="mt-2 text-gray-600">
              Schemes you've bookmarked for future reference
            </p>
          </div>
          {schemes.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
            >
              <TrashIcon className="h-5 w-5 mr-2" />
              Clear All
            </button>
          )}
        </div>

        {/* Search and Filters */}
        {schemes.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search saved schemes..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ministry Filter */}
              <div>
                <select
                  value={selectedMinistry}
                  onChange={(e) => setSelectedMinistry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Ministries</option>
                  {ministries.map((ministry) => (
                    <option key={ministry} value={ministry}>
                      {ministry}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Filters */}
            {(searchQuery || selectedCategory || selectedMinistry) && (
              <div className="mt-4 flex items-center space-x-2">
                <span className="text-sm text-gray-500">Active filters:</span>
                {searchQuery && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Search: "{searchQuery}"
                    <button
                      onClick={() => setSearchQuery('')}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {selectedCategory && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Category: {selectedCategory}
                    <button
                      onClick={() => setSelectedCategory('')}
                      className="ml-1 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {selectedMinistry && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Ministry: {selectedMinistry}
                    <button
                      onClick={() => setSelectedMinistry('')}
                      className="ml-1 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('');
                    setSelectedMinistry('');
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results Count */}
        {schemes.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Showing {filteredSchemes.length} of {schemes.length} saved schemes
            </p>
          </div>
        )}

        {/* Schemes Grid */}
        {loading && schemes.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-4 w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-4 w-1/2"></div>
                <div className="flex space-x-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredSchemes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredSchemes.map((scheme) => (
                <SchemeCard
                  key={scheme.id}
                  scheme={scheme}
                  onRemove={handleRemoveSaved}
                  isSaved={true}
                  showEligibility={false}
                />
              ))}
            </div>

            {/* Load More Button */}
            {pagination.hasMore && filteredSchemes.length === schemes.length && (
              <div className="text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : 'Load More Schemes'}
                </button>
              </div>
            )}
          </>
        ) : schemes.length === 0 ? (
          <div className="text-center py-12">
            <BookmarkIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No saved schemes</h3>
            <p className="mt-1 text-sm text-gray-500">
              Save schemes you're interested in to access them quickly later.
            </p>
            <div className="mt-6">
              <Link
                href="/search"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Browse Schemes
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <FunnelIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No schemes match your filters</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search or filter criteria.
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                  setSelectedMinistry('');
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}