'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { schemesAPI, Scheme } from '@/lib/api';
import Header from '@/components/Header';
import SchemeCard from '@/components/SchemeCard';
import { MagnifyingGlassIcon, ChartBarIcon, UserGroupIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredSchemes, setFeaturedSchemes] = useState<Scheme[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [schemesResponse, statsResponse] = await Promise.all([
        schemesAPI.search({ limit: 6 }),
        schemesAPI.getStats()
      ]);

      if (schemesResponse.success) {
        setFeaturedSchemes(schemesResponse.data.schemes);
      }
      if (statsResponse.success) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-black text-white min-h-[85vh] flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="text-center">
            {/* Small label */}
            <div className="mb-6">
              <span className="text-yellow-500 text-sm md:text-base font-medium tracking-wider uppercase">
                Discover Your Benefits
              </span>
            </div>
            
            {/* Large Hero Text */}
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold mb-8 leading-none">
              <span className="text-white">Government</span>
              <br />
              <span className="text-white">Schemes</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-lg md:text-xl mb-12 text-gray-400 max-w-3xl mx-auto">
              Know your schemes. Know your benefits.
            </p>
            
            <p className="text-sm md:text-base mb-12 text-gray-500 max-w-2xl mx-auto">
              Navigate through thousands of government schemes and find the benefits you're eligible for
            </p>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              {user ? (
                <Link
                  href="/dashboard"
                  className="bg-white text-black px-10 py-4 rounded-md font-semibold hover:bg-gray-100 transition-colors inline-flex items-center text-lg group"
                >
                  View My Dashboard
                  <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </Link>
              ) : (
                <Link
                  href="/auth/register"
                  className="bg-white text-black px-10 py-4 rounded-md font-semibold hover:bg-gray-100 transition-colors inline-flex items-center text-lg group"
                >
                  Explore Your Schemes
                  <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </Link>
              )}
            </div>
            
            {/* Secondary link */}
            <div className="text-sm text-gray-500">
              <Link href="/search" className="border-b border-gray-700 hover:border-gray-400 transition-colors pb-1">
                BROWSE ALL SCHEMES
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {stats && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <DocumentTextIcon className="h-12 w-12 text-gray-900" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.totalSchemes?.toLocaleString()}</div>
                <div className="text-gray-600">Active Schemes</div>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <ChartBarIcon className="h-12 w-12 text-gray-700" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.byMinistry?.length || 0}</div>
                <div className="text-gray-600">Ministries</div>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <UserGroupIcon className="h-12 w-12 text-gray-700" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.byLevel?.length || 0}</div>
                <div className="text-gray-600">Government Levels</div>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <MagnifyingGlassIcon className="h-12 w-12 text-yellow-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.recentlyUpdated || 0}</div>
                <div className="text-gray-600">Recently Updated</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Schemes */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Schemes</h2>
            <p className="text-xl text-gray-600">Popular government programs and benefits</p>
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredSchemes.map((scheme) => (
                <SchemeCard
                  key={scheme.id}
                  scheme={scheme}
                  showEligibility={false}
                />
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Link
              href="/search"
              className="bg-yellow-500 text-black px-8 py-3 rounded-lg font-semibold hover:bg-yellow-400 transition-colors"
            >
              View All Schemes
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How SchemeSync Works</h2>
            <p className="text-xl text-gray-600">Simple steps to find your benefits</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border-2 border-yellow-500">
                <span className="text-2xl font-bold text-black">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Profile</h3>
              <p className="text-gray-600">Tell us about yourself, your family, and your situation</p>
            </div>
            <div className="text-center">
              <div className="bg-gray-200 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border-2 border-gray-400">
                <span className="text-2xl font-bold text-black">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Matched</h3>
              <p className="text-gray-600">Our AI finds schemes you're eligible for based on your profile</p>
            </div>
            <div className="text-center">
              <div className="bg-gray-900 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border-2 border-black">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Apply & Track</h3>
              <p className="text-gray-600">Get step-by-step guidance and track your applications</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
