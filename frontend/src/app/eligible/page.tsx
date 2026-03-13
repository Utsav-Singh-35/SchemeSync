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
  const [stats, setStats] = useState<any>(null);
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    hasMore: false
  });
  const [filters, setFilters] = useState({
    status: 'all', // all, eligible, likely_eligible
    minScore: 0
  });

  useEffect(() => {
    if (user) {
      loadEligibleSchemes();
    }
  }, [user, filters]);

  const loadEligibleSchemes = async (loadMore = false) => {
    if (!loadMore) setLoading(true);
    
    try {
      const offset = loadMore ? pagination.offset + pagination.limit : 0;
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

        if (loadMore) {
          setSchemes(prev => [...prev, ...filteredSchemes]);
        } else {
          setSchemes(filteredSchemes);
        }

        setPagination({
          limit: response.data.pagination?.limit || 20,
          offset: offset,
          hasMore: response.data.pagination?.hasMore || false
        });

        setStats({
          totalEligible: response.data.totalEligible,
          totalEvaluated: response.data.totalEvaluated
        });
      }
    } catch (error) {
      console.error('Failed to load eligible schemes:', error);
      toast.error('Failed to load eligible schemes');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEligibleSchemes();
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
      toast.success('Scheme saved successfully');
    } catch (error) {
      toast.error('Failed to save scheme');
    }
  };

  const loadMore = () => {
    if (pagination.hasMore && !loading) {
      loadEligibleSchemes(true);
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
            <h1 className="text-3xl font-bold text-gray-900">Your Eligible Schemes</h1>
            <p className="mt-2 text-gray-600">
              Government schemes you qualify for based on your profile
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Eligibility'}
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Eligible Schemes</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalEligible}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FunnelIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Evaluated</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalEvaluated}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserIcon className="h-8 w-8 text-purple-600" />
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

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Schemes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Eligibility Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Eligible</option>
                <option value="eligible">Fully Eligible</option>
                <option value="likely_eligible">Likely Eligible</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Match Score
              </label>
              <select
                value={filters.minScore}
                onChange={(e) => setFilters(prev => ({ ...prev, minScore: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Any Score</option>
                <option value={50}>50% or higher</option>
                <option value={70}>70% or higher</option>
                <option value={80}>80% or higher</option>
                <option value={90}>90% or higher</option>
              </select>
            </div>
          </div>
        </div>

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
        ) : schemes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {schemes.map((scheme) => (
                <SchemeCard
                  key={scheme.id}
                  scheme={scheme}
                  onSave={handleSaveScheme}
                  showEligibility={true}
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
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No eligible schemes found</h3>
            <p className="mt-1 text-sm text-gray-500">
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
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Complete Profile
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}