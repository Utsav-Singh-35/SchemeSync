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
  const [savedSchemeIds, setSavedSchemeIds] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState({
    category: '',
    ministry: '',
    level: '',
    beneficiary: '',
    state: ''
  });
  const [pagination, setPagination] = useState({
    limit: 10,
    offset: 0,
    total: 0,
    hasMore: false
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    performSearch();
    if (user) {
      loadSavedSchemes();
    }
  }, [initialQuery]);

  // Listen for voice commands from VoiceAgent (only fires when already on this page)
  useEffect(() => {
    const onSearch = (e: CustomEvent) => {
      const { entities } = e.detail;
      if (entities.query) setQuery(entities.query);
      setFilters(prev => ({
        ...prev,
        category: entities.category || prev.category,
        level: entities.level || prev.level,
        state: entities.state || prev.state,
        beneficiary: entities.beneficiary || prev.beneficiary,
      }));
      setTimeout(() => performSearch(1), 50);
    };

    const onFilter = (e: CustomEvent) => {
      const { entities } = e.detail;
      setFilters(prev => ({
        ...prev,
        category: entities.category || prev.category,
        level: entities.level || prev.level,
        state: entities.state || prev.state,
        beneficiary: entities.beneficiary || prev.beneficiary,
      }));
      setTimeout(() => performSearch(1), 50);
    };

    const onClear = () => {
      setFilters({ category: '', ministry: '', level: '', beneficiary: '', state: '' });
      setQuery('');
      setTimeout(() => performSearch(1), 50);
    };

    window.addEventListener('voice-search', onSearch as EventListener);
    window.addEventListener('voice-filter', onFilter as EventListener);
    window.addEventListener('voice-clear', onClear);
    return () => {
      window.removeEventListener('voice-search', onSearch as EventListener);
      window.removeEventListener('voice-filter', onFilter as EventListener);
      window.removeEventListener('voice-clear', onClear);
    };
  }, []);

  const loadSavedSchemes = async () => {
    try {
      const response = await schemesAPI.getSaved({ limit: 1000, offset: 0 });
      if (response.success) {
        const savedIds = new Set<number>(response.data.schemes.map((s: Scheme) => s.id));
        setSavedSchemeIds(savedIds);
      }
    } catch (error) {
      console.error('Failed to load saved schemes:', error);
    }
  };

  const performSearch = async (page = 1) => {
    setLoading(true);
    try {
      const offset = (page - 1) * pagination.limit;
      
      // Build params object with only valid parameters
      const params: any = {
        limit: pagination.limit,
        offset
      };
      
      // Only add query if it has a value
      if (query.trim()) {
        params.query = query.trim();
      }
      
      // Add all filters if they have values
      if (filters.category) params.category = filters.category;
      if (filters.ministry) params.ministry = filters.ministry;
      if (filters.level) params.level = filters.level;
      if (filters.beneficiary) params.beneficiary = filters.beneficiary;
      if (filters.state) params.state = filters.state;
      
      const response = await schemesAPI.search(params);

      if (response.success) {
        setSchemes(response.data.schemes);
        setPagination({
          ...pagination,
          offset,
          total: response.data.pagination.total || response.data.schemes.length,
          hasMore: response.data.pagination.hasMore
        });
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    performSearch(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    performSearch(1);
  };

  const clearFilters = () => {
    setFilters({ category: '', ministry: '', level: '', beneficiary: '', state: '' });
    setQuery('');
    performSearch(1);
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages && !loading) {
      performSearch(page);
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

  const handleSaveScheme = async (schemeId: number) => {
    if (!user) {
      toast.error('Please login to save schemes');
      return;
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Search Schemes</h1>
          <p className="text-gray-600 mt-1">Find government schemes and benefits</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for schemes, benefits, or keywords..."
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-2 bg-yellow-500 text-black p-2 rounded-md hover:bg-yellow-400 disabled:opacity-50"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
          </div>
        </form>

        {/* Main Content with Sidebar */}
        <div className="flex gap-6">
          {/* Sidebar Filters */}
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FunnelIcon className="h-5 w-5 mr-2 text-gray-600" />
                  Filters
                </h2>
              </div>

              {/* Category Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">All Categories</option>
                  <option value="education">Education</option>
                  <option value="health">Health</option>
                  <option value="agriculture">Agriculture</option>
                  <option value="employment">Employment</option>
                  <option value="housing">Housing</option>
                  <option value="social welfare">Social Welfare</option>
                  <option value="women">Women</option>
                  <option value="children">Children</option>
                  <option value="senior citizen">Senior Citizen</option>
                  <option value="disability">Disability</option>
                  <option value="financial">Financial Assistance</option>
                  <option value="skill development">Skill Development</option>
                </select>
              </div>

              {/* Government Level Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Government Level
                </label>
                <select
                  value={filters.level}
                  onChange={(e) => handleFilterChange('level', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">All Levels</option>
                  <option value="central">Central</option>
                  <option value="state">State</option>
                  <option value="district">District</option>
                  <option value="local">Local</option>
                </select>
              </div>

              {/* Ministry Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ministry
                </label>
                <input
                  type="text"
                  value={filters.ministry}
                  onChange={(e) => handleFilterChange('ministry', e.target.value)}
                  placeholder="e.g., Education, Health"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              {/* Beneficiary Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Beneficiary
                </label>
                <select
                  value={filters.beneficiary}
                  onChange={(e) => handleFilterChange('beneficiary', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">All Beneficiaries</option>
                  <option value="student">Students</option>
                  <option value="farmer">Farmers</option>
                  <option value="women">Women</option>
                  <option value="children">Children</option>
                  <option value="senior citizen">Senior Citizens</option>
                  <option value="disabled">Persons with Disabilities</option>
                  <option value="entrepreneur">Entrepreneurs</option>
                  <option value="youth">Youth</option>
                  <option value="bpl">Below Poverty Line</option>
                  <option value="minority">Minorities</option>
                  <option value="sc/st">SC/ST</option>
                  <option value="obc">OBC</option>
                </select>
              </div>

              {/* State Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <select
                  value={filters.state}
                  onChange={(e) => handleFilterChange('state', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="">All States</option>
                  <option value="Andhra Pradesh">Andhra Pradesh</option>
                  <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                  <option value="Assam">Assam</option>
                  <option value="Bihar">Bihar</option>
                  <option value="Chhattisgarh">Chhattisgarh</option>
                  <option value="Goa">Goa</option>
                  <option value="Gujarat">Gujarat</option>
                  <option value="Haryana">Haryana</option>
                  <option value="Himachal Pradesh">Himachal Pradesh</option>
                  <option value="Jharkhand">Jharkhand</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Kerala">Kerala</option>
                  <option value="Madhya Pradesh">Madhya Pradesh</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Manipur">Manipur</option>
                  <option value="Meghalaya">Meghalaya</option>
                  <option value="Mizoram">Mizoram</option>
                  <option value="Nagaland">Nagaland</option>
                  <option value="Odisha">Odisha</option>
                  <option value="Punjab">Punjab</option>
                  <option value="Rajasthan">Rajasthan</option>
                  <option value="Sikkim">Sikkim</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Telangana">Telangana</option>
                  <option value="Tripura">Tripura</option>
                  <option value="Uttar Pradesh">Uttar Pradesh</option>
                  <option value="Uttarakhand">Uttarakhand</option>
                  <option value="West Bengal">West Bengal</option>
                  <option value="Delhi">Delhi</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={applyFilters}
                  className="w-full bg-yellow-500 text-black px-4 py-2 rounded-md hover:bg-yellow-400 text-sm font-medium"
                >
                  Apply Filters
                </button>
                <button
                  onClick={clearFilters}
                  className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  Clear All
                </button>
              </div>
            </div>
          </aside>

          {/* Results Section */}
          <div className="flex-1">
            {/* Results Header */}
            {pagination.total > 0 && (
              <div className="mb-4">
                <h2 className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{pagination.total}</span> schemes found
                  {query && <span> for "{query}"</span>}
                </h2>
              </div>
            )}

            {/* Results Grid */}
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
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
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
                      onSave={user ? handleSaveScheme : undefined}
                      onRemove={user ? handleRemoveSaved : undefined}
                      isSaved={savedSchemeIds.has(scheme.id)}
                      showEligibility={!!user}
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
                <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No schemes found</h3>
                <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                  {query 
                    ? `No schemes match your search for "${query}". Try different keywords or adjust filters.`
                    : 'Try searching for schemes or applying filters to find relevant programs.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}