'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { schemesAPI, Scheme } from '@/lib/api';
import Header from '@/components/Header';
import SchemeCard from '@/components/SchemeCard';
import Link from 'next/link';
import { 
  ChartBarIcon, 
  BookmarkIcon, 
  UserIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user } = useAuth();
  const [eligibleSchemes, setEligibleSchemes] = useState<Scheme[]>([]);
  const [savedSchemes, setSavedSchemes] = useState<Scheme[]>([]);
  const [savedSchemeIds, setSavedSchemeIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const [eligibleResponse, savedResponse] = await Promise.all([
        schemesAPI.getEligible({ limit: 6 }),
        schemesAPI.getSaved({ limit: 4 })
      ]);

      if (eligibleResponse.success) {
        setEligibleSchemes(eligibleResponse.data.schemes);
        setStats({
          totalEligible: eligibleResponse.data.totalEligible,
          totalEvaluated: eligibleResponse.data.totalEvaluated
        });
      }

      if (savedResponse.success) {
        setSavedSchemes(savedResponse.data.schemes);
        const savedIds = new Set(savedResponse.data.schemes.map((s: Scheme) => s.id));
        setSavedSchemeIds(savedIds);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScheme = async (schemeId: number) => {
    try {
      await schemesAPI.saveScheme(schemeId);
      setSavedSchemeIds(prev => new Set(prev).add(schemeId));
      toast.success('Scheme saved successfully');
      loadDashboardData(); // Refresh data
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
      toast.success('Scheme removed from saved list');
      loadDashboardData(); // Refresh data
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
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Not authenticated</h3>
            <p className="mt-1 text-sm text-gray-500">
              Please log in to view your dashboard.
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.name}!
          </h1>
          <p className="mt-2 text-gray-600">
            Here's your personalized scheme dashboard
          </p>
        </div>

        {/* Stats Cards */}
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
                  <DocumentTextIcon className="h-8 w-8 text-gray-700" />
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
                  <BookmarkIcon className="h-8 w-8 text-gray-900" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Saved Schemes</p>
                  <p className="text-2xl font-semibold text-gray-900">{savedSchemes.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Eligible Schemes Section */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Eligible Schemes</h2>
            <Link
              href="/eligible"
              className="text-gray-900 hover:text-yellow-600 font-medium"
            >
              View All →
            </Link>
          </div>

          {loading ? (
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
          ) : eligibleSchemes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {eligibleSchemes.map((scheme) => (
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
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No eligible schemes found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Complete your profile to get better scheme recommendations.
              </p>
              <div className="mt-6">
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

        {/* Saved Schemes Section */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Saved Schemes</h2>
            <Link
              href="/saved"
              className="text-gray-900 hover:text-yellow-600 font-medium"
            >
              View All →
            </Link>
          </div>

          {savedSchemes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savedSchemes.map((scheme) => (
                <SchemeCard
                  key={scheme.id}
                  scheme={scheme}
                  onRemove={handleRemoveSaved}
                  isSaved={true}
                  showEligibility={false}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <BookmarkIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No saved schemes</h3>
              <p className="mt-1 text-sm text-gray-500">
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
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/search"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-yellow-500 transition-colors"
            >
              <DocumentTextIcon className="h-8 w-8 text-gray-900 mr-3" />
              <div>
                <p className="font-medium text-gray-900">Search Schemes</p>
                <p className="text-sm text-gray-500">Find new government programs</p>
              </div>
            </Link>
            
            <Link
              href="/profile"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-yellow-500 transition-colors"
            >
              <UserIcon className="h-8 w-8 text-gray-700 mr-3" />
              <div>
                <p className="font-medium text-gray-900">Update Profile</p>
                <p className="text-sm text-gray-500">Improve scheme matching</p>
              </div>
            </Link>
            
            <Link
              href="/applications"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-yellow-500 transition-colors"
            >
              <ChartBarIcon className="h-8 w-8 text-yellow-500 mr-3" />
              <div>
                <p className="font-medium text-gray-900">Track Applications</p>
                <p className="text-sm text-gray-500">Monitor your progress</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}