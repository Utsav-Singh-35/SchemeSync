'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { schemesAPI } from '@/lib/api';
import Header from '@/components/Header';
import Link from 'next/link';
import { 
  BookmarkIcon as BookmarkOutline,
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

interface EligibilityResult {
  status: 'eligible' | 'not_eligible' | 'likely_eligible' | 'insufficient_data';
  score: number;
  reasons: string[];
  missing_criteria: string[];
}

interface SchemeDetail {
  id: number;
  title: string;
  slug: string;
  description: string;
  ministry: string;
  level: string;
  scheme_category: string[];
  tags: string[];
  target_beneficiaries: string[];
  eligibility_criteria: string;
  benefits: string;
  application_process: string;
  required_documents: string;
  contact_information: Record<string, any>;
  reference_links: string;
  last_updated: string;
  eligibility?: EligibilityResult;
  required_documents_array?: string[];
  reference_links_array?: Array<{ title: string; url: string }>;
}

export default function SchemeDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const slug = params.slug as string;

  const [scheme, setScheme] = useState<SchemeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [savingScheme, setSavingScheme] = useState(false);

  useEffect(() => {
    if (slug) {
      loadScheme();
    }
  }, [slug]);

  const loadScheme = async () => {
    try {
      const response = await schemesAPI.getById(slug);
      if (response.success) {
        setScheme(response.data);
      } else {
        toast.error('Scheme not found');
      }
    } catch (error) {
      console.error('Failed to load scheme:', error);
      toast.error('Failed to load scheme details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!user || !scheme) {
      toast.error('Please login to save schemes');
      return;
    }

    setSavingScheme(true);
    try {
      if (isSaved) {
        await schemesAPI.removeSaved(scheme.id);
        setIsSaved(false);
        toast.success('Scheme removed from saved list');
      } else {
        await schemesAPI.saveScheme(scheme.id);
        setIsSaved(true);
        toast.success('Scheme saved successfully');
      }
    } catch (error) {
      toast.error('Failed to update saved status');
    } finally {
      setSavingScheme(false);
    }
  };

  const getEligibilityStatus = () => {
    if (!scheme?.eligibility || !user) return null;

    const { status, score, reasons = [], missing_criteria = [] } = scheme.eligibility;
    
    switch (status) {
      case 'eligible':
        return (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircleIcon className="h-6 w-6 text-green-600 mr-2" />
              <div>
                <h3 className="text-lg font-semibold text-green-800">You're Eligible!</h3>
                <p className="text-green-700">Match Score: {Math.round(score)}%</p>
              </div>
            </div>
            {reasons && reasons.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-green-800 mb-1">Why you qualify:</p>
                <ul className="text-sm text-green-700 list-disc list-inside">
                  {reasons.map((reason: string, index: number) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      
      case 'likely_eligible':
        return (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mr-2" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800">Likely Eligible</h3>
                <p className="text-yellow-700">Match Score: {Math.round(score)}%</p>
              </div>
            </div>
            {missing_criteria && missing_criteria.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-yellow-800 mb-1">Complete your profile for better matching:</p>
                <ul className="text-sm text-yellow-700 list-disc list-inside">
                  {missing_criteria.map((criteria: string, index: number) => (
                    <li key={index}>{criteria}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      
      case 'not_eligible':
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <XCircleIcon className="h-6 w-6 text-red-600 mr-2" />
              <div>
                <h3 className="text-lg font-semibold text-red-800">Not Eligible</h3>
                <p className="text-red-700">Based on current profile information</p>
              </div>
            </div>
            {reasons && reasons.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-red-800 mb-1">Reasons:</p>
                <ul className="text-sm text-red-700 list-disc list-inside">
                  {reasons.map((reason: string, index: number) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <DocumentTextIcon className="h-6 w-6 text-blue-600 mr-2" />
              <div>
                <h3 className="text-lg font-semibold text-blue-800">Need More Information</h3>
                <p className="text-blue-700">Complete your profile to check eligibility</p>
              </div>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4 w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2 w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded mb-8 w-1/3"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Scheme Not Found</h1>
            <p className="text-gray-600 mb-8">The scheme you're looking for doesn't exist or has been removed.</p>
            <Link href="/search" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
              Browse All Schemes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link href="/search" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6">
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back to Search
        </Link>

        {/* Scheme Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{scheme.title}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>{scheme.ministry}</span>
                <span>•</span>
                <span className="capitalize">{scheme.level} Level</span>
                <span>•</span>
                <span>Updated: {new Date(scheme.last_updated).toLocaleDateString()}</span>
              </div>
            </div>
            
            {user && (
              <button
                onClick={handleSaveToggle}
                disabled={savingScheme}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                {isSaved ? (
                  <BookmarkSolid className="h-6 w-6" />
                ) : (
                  <BookmarkOutline className="h-6 w-6" />
                )}
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {scheme.scheme_category.map((category: any, index: number) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
              >
                {typeof category === 'string' ? category : category.label || category.value || 'Unknown'}
              </span>
            ))}
          </div>

          {/* Eligibility Status */}
          {getEligibilityStatus()}
        </div>

        {/* Scheme Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
              <p className="text-gray-700 leading-relaxed">{scheme.description}</p>
            </div>

            {/* Benefits */}
            {scheme.benefits && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Benefits</h2>
                <div className="prose prose-sm max-w-none text-gray-700">
                  {scheme.benefits.split('\n').map((benefit: string, index: number) => (
                    benefit.trim() && (
                      <p key={index} className="mb-2">{benefit.trim()}</p>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Eligibility Criteria */}
            {scheme.eligibility_criteria && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Eligibility Criteria</h2>
                <div className="prose prose-sm max-w-none text-gray-700">
                  {scheme.eligibility_criteria.split('\n').map((criteria: string, index: number) => (
                    criteria.trim() && (
                      <p key={index} className="mb-2">{criteria.trim()}</p>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Application Process */}
            {scheme.application_process && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">How to Apply</h2>
                <div className="prose prose-sm max-w-none text-gray-700">
                  {scheme.application_process.split('\n').map((step: string, index: number) => (
                    step.trim() && (
                      <p key={index} className="mb-2">{step.trim()}</p>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Required Documents */}
            {scheme.required_documents_array && scheme.required_documents_array.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Documents</h3>
                <ul className="space-y-2">
                  {scheme.required_documents_array.map((doc: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contact Information */}
            {scheme.contact_information && Object.keys(scheme.contact_information).length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(scheme.contact_information).map(([key, value]: [string, any]) => (
                    <div key={key}>
                      <span className="font-medium text-gray-900 capitalize">{key.replace('_', ' ')}: </span>
                      <span className="text-gray-700">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reference Links */}
            {scheme.reference_links_array && scheme.reference_links_array.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Useful Links</h3>
                <div className="space-y-2">
                  {scheme.reference_links_array.map((link: any, index: number) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-1" />
                      {link.title}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Target Beneficiaries */}
            {scheme.target_beneficiaries && scheme.target_beneficiaries.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Target Beneficiaries</h3>
                <div className="flex flex-wrap gap-2">
                  {scheme.target_beneficiaries.map((beneficiary: any, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {typeof beneficiary === 'string' ? beneficiary : beneficiary.label || beneficiary.value || 'Unknown'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}