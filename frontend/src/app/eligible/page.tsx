'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { schemesAPI, Scheme } from '@/lib/api';
import Header from '@/components/Header';
import SchemeCard from '@/components/SchemeCard';
import Link from 'next/link';
import { 
  ChartBarIcon, 
  UserIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function EligibleSchemesPage() {
  const { user } = useAuth();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savedSchemeIds, setSavedSchemeIds] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState({
    limit: 10,
    offset: 0,
    total: 0,
    hasMore: false
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    status: 'all', // all, eligible, likely_eligible
    minScore: 0
  });

  useEffect(() => {
    if (user) {
      loadEligibleSchemes(1);
      loadSavedSchemes();
    }
  }, [user, filters]);

  const loadSavedSchemes = async () => {
    try {
      const response = await schemesAPI.getSaved({ limit: 1000, offset: 0 });
      if (response.success) {
        const savedIds = new Set(response.data.schemes.map((s: Scheme) => s.id));
        setSavedSchemeIds(savedIds);
      }
    } catch (error) {
      console.error('Failed to load saved schemes:', error);
    }
  };

  const loadEligibleSchemes = async (page = 1) => {
    setLoading(true);
    
    try {
      const offset = (page - 1) * pagination.limit;
      const response = await schemesAPI.getEligible({ 
        limit: pagination.limit, 
        offset 
      });

      if (response.success) {
        const filteredSchemes = response.data.schemes.filter((scheme: Scheme) => {
          if (!scheme.eligibility) return false;
          
          // Filter by status
          if (filters.status !== 'all' && scheme.eligibility.status !== filters.status) {
            return false;
          }
          
          // Filter by minimum score
          if (scheme.eligibility.score < filters.minScore) {
            return false;
          }
          
          return true;
        });

        setSchemes(filteredSchemes);
        setPagination({
          limit: response.data.pagination?.limit || 10,
          offset: offset,
          total: response.data.totalEligible || 0,
          hasMore: response.data.pagination?.hasMore || false
        });
        setCurrentPage(page);

        setStats({
          totalEligible: response.data.totalEligible,
          totalEvaluated: response.data.totalEvaluated
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      console.error('Failed to load eligible schemes:', error);
      toast.error('Failed to load eligible schemes');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages && !loading) {
      loadEligibleSchemes(page);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEligibleSchemes(1);
      toast.success('Eligibility refreshed successfully!');
    } catch (error) {
      toast.error('Failed to refresh eligibility');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveScheme = async (schemeId: number) => {
    try {
      await schemesAPI.saveScheme(schemeId);
      setSavedSchemeIds(prev => new Set(prev).add(schemeId));
      toast.success('Scheme saved successfully');
    } catch (error) {
      toast.error('Failed to save scheme');
    }
  };

  const handleRemoveSaved = async (schemeId: number) => {
    try {
      await schemesAPI.removeSaved(schemeId);
      setSavedSchemeIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(schemeId);
        return newSet;
      });
      toast.success('Scheme removed from saved');
    } catch (error) {
      toast.error('Failed to remove scheme');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Not authenticated</h3>
            <p className="mt-1 text-sm text-gray-500">
              Please log in to view your eligible schemes.
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
              <h1 className="text-3xl font-bold text-gray-900">Eligible Schemes</h1>
              <p className="mt-1 text-gray-600">
                Schemes you qualify for based on your profile
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-yellow-500 text-black rounded-md hover:bg-yellow-400 disabled:opacity-50 font-medium"
            >
              <ArrowPathIcon className={`h-5 w-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Eligible Schemes</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalEligible}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FunnelIcon className="h-8 w-8 text-gray-700" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Evaluated</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalEvaluated}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserIcon className="h-8 w-8 text-gray-900" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Match Rate</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats.totalEvaluated > 0 ? Math.round((stats.totalEligible / stats.totalEvaluated) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content with Sidebar */}
        <div className="flex gap-6">
          {/* Sidebar Filters */}
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-6">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FunnelIcon className="h-5 w-5 mr-2 text-gray-600" />
                  Filters
                </h2>
              </div>

              {/* Status Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Eligibility Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="all">All Eligible</option>
                  <option value="eligible">Fully Eligible</option>
                  <option value="likely_eligible">Likely Eligible</option>
                </select>
              </div>

              {/* Score Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Match Score
                </label>
                <select
                  value={filters.minScore}
                  onChange={(e) => setFilters(prev => ({ ...prev, minScore: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value={0}>Any Score</option>
                  <option value={50}>50% or higher</option>
                  <option value={70}>70% or higher</option>
                  <option value={80}>80% or higher</option>
                  <option value={90}>90% or higher</option>
                </select>
              </div>

              {/* Clear Button */}
              <button
                onClick={() => setFilters({ status: 'all', minScore: 0 })}
                className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm font-medium"
              >
                Clear Filters
              </button>
            </div>
          </aside>

          {/* Results Section */}
          <div className="flex-1">
            {/* Results Header */}
            {pagination.total > 0 && (
              <div className="mb-4">
                <h2 className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{pagination.total}</span> eligible schemes found
                </h2>
              </div>
            )}

            {/* Schemes List */}
            {loading && schemes.length === 0 ? (
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
            ) : schemes.length > 0 ? (
              <>
                <div className="space-y-4 mb-8">
                  {schemes.map((scheme) => (
                    <SchemeCard
                      key={scheme.id}
                      scheme={scheme}
                      onSave={handleSaveScheme}
                      onRemove={handleRemoveSaved}
                      isSaved={savedSchemeIds.has(scheme.id)}
                      showEligibility={true}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-8">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1 || loading}
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
                          disabled={loading}
                          className={`px-4 py-2 rounded-md font-medium ${
                            currentPage === page
                              ? 'bg-yellow-500 text-black'
                              : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                          } disabled:opacity-50`}
                        >
                          {page}
                        </button>
                      )
                    ))}
                    
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages || loading}
                      className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No eligible schemes found</h3>
                <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                  {filters.status !== 'all' || filters.minScore > 0 
                    ? 'Try adjusting your filters to see more schemes.'
                    : 'Complete your profile to get personalized scheme recommendations.'
                  }
                </p>
                <div className="mt-6 space-x-3">
                  {(filters.status !== 'all' || filters.minScore > 0) && (
                    <button
                      onClick={() => setFilters({ status: 'all', minScore: 0 })}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Clear Filters
                    </button>
                  )}
                  <Link
                    href="/profile"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-black bg-yellow-500 hover:bg-yellow-400"
                  >
                    Complete Profile
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}