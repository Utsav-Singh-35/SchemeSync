'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { schemesAPI, Scheme } from '@/lib/api';
import Header from '@/components/Header';
import SchemeCard from '@/components/SchemeCard';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SearchPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    ministry: '',
    level: ''
  });
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      performSearch();
    }
  }, [initialQuery]);

  const performSearch = async (resetPagination = true) => {
    setLoading(true);
    try {
      const offset = resetPagination ? 0 : pagination.offset;
      const response = await schemesAPI.search({
        query: query.trim() || undefined,
        ...filters,
        limit: pagination.limit,
        offset
      });

      if (response.success) {
        if (resetPagination) {
          setSchemes(response.data.schemes);
        } else {
          setSchemes(prev => [...prev, ...response.data.schemes]);
        }
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(true);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    performSearch(true);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({ category: '', ministry: '', level: '' });
    performSearch(true);
  };

  const loadMore = () => {
    if (pagination.hasMore && !loading) {
      setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
      performSearch(false);
    }
  };

  const handleSaveScheme = async (schemeId: number) => {
    if (!user) {
      toast.error('Please login to save schemes');
      return;
    }
    try {
      await schemesAPI.saveScheme(schemeId);
      toast.success('Scheme saved successfully');
    } catch (error) {
      toast.error('Failed to save scheme');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Search Government Schemes</h1>
          
          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for schemes, benefits, or keywords..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <MagnifyingGlassIcon className="absolute right-3 top-3 h-6 w-6 text-gray-400" />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 border border-gray-300 px-4 py-3 rounded-lg hover:bg-gray-50"
              >
                <FunnelIcon className="h-5 w-5" />
                Filters
              </button>
            </div>
          </form>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Categories</option>
                    <option value="education">Education</option>
                    <option value="health">Health</option>
                    <option value="agriculture">Agriculture</option>
                    <option value="employment">Employment</option>
                    <option value="housing">Housing</option>
                    <option value="social welfare">Social Welfare</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ministry
                  </label>
                  <input
                    type="text"
                    value={filters.ministry}
                    onChange={(e) => handleFilterChange('ministry', e.target.value)}
                    placeholder="e.g., Ministry of Education"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Level
                  </label>
                  <select
                    value={filters.level}
                    onChange={(e) => handleFilterChange('level', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Levels</option>
                    <option value="central">Central</option>
                    <option value="state">State</option>
                    <option value="district">District</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={applyFilters}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Apply Filters
                </button>
                <button
                  onClick={clearFilters}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Results Summary */}
          {pagination.total > 0 && (
            <div className="text-sm text-gray-600 mb-4">
              Showing {schemes.length} of {pagination.total} schemes
              {query && ` for "${query}"`}
            </div>
          )}
        </div>

        {/* Results */}
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
        ) : schemes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {schemes.map((scheme) => (
                <SchemeCard
                  key={scheme.id}
                  scheme={scheme}
                  onSave={user ? handleSaveScheme : undefined}
                  showEligibility={!!user}
                />
              ))}
            </div>

            {/* Load More Button */}
            {pagination.hasMore && (
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
        ) : (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No schemes found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {query 
                ? `No schemes match your search for "${query}". Try different keywords or clear filters.`
                : 'Try searching for schemes or applying filters to find relevant programs.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}