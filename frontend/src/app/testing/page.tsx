'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { schemesAPI, automationAPI, extensionAPI } from '@/lib/api';
import Header from '@/components/Header';
import Link from 'next/link';
import {
  BookmarkIcon as BookmarkOutline,
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid, CpuChipIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface SchemeDetail {
  id: number;
  title: string;
  slug: string;
  description?: string;
  brief_description?: string;
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
  application_url?: string;
  last_updated: string;
  eligibility?: {
    status: 'eligible' | 'not_eligible' | 'likely_eligible' | 'insufficient_data';
    score: number;
    reasons: string[];
    missing_criteria: string[];
  };
}

export default function TestingPage() {
  const { user } = useAuth();
  const [scheme, setScheme] = useState<SchemeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadScheme();
  }, []);

  const loadScheme = async () => {
    try {
      const response = await api.get('/testing');
      if (response.data.success) {
        setScheme(response.data.data.scheme);
      }
    } catch (error) {
      toast.error('Failed to load test scheme');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToggle = async () => {
    if (!user || !scheme) { toast.error('Please login to save schemes'); return; }
    setSaving(true);
    try {
      if (isSaved) {
        await schemesAPI.removeSaved(scheme.id);
        setIsSaved(false);
        toast.success('Removed from saved');
      } else {
        await schemesAPI.saveScheme(scheme.id);
        setIsSaved(true);
        toast.success('Scheme saved');
      }
    } catch { toast.error('Failed to update saved status'); }
    finally { setSaving(false); }
  };

  const handleAutoFill = async () => {
    if (!user || !scheme) { toast.error('Please login to use auto-fill'); return; }
    const applicationUrl = scheme.application_url || `https://www.myscheme.gov.in/schemes/${scheme.slug}`;
    try {
      toast.loading('Checking SchemeSync Extension...', { id: 'autofill' });
      const status = await extensionAPI.getExtensionStatus();
      if (!status.available) {
        toast.error('SchemeSync Extension not found. Install it to use auto-fill.', { id: 'autofill', duration: 5000 });
        setTimeout(() => window.open(applicationUrl, '_blank', 'noopener,noreferrer'), 1000);
        return;
      }
      toast.loading('Opening application with extension...', { id: 'autofill' });
      await extensionAPI.triggerAutofill(scheme.id.toString(), applicationUrl);
      toast.success('Application opened! Extension will assist with form filling.', { id: 'autofill', duration: 4000 });
    } catch (error: any) {
      toast.error('Extension unavailable. Opening manual form...', { id: 'autofill' });
      setTimeout(() => window.open(applicationUrl, '_blank', 'noopener,noreferrer'), 1500);
    }
  };

  const requiredDocuments = scheme?.required_documents
    ? scheme.required_documents.split('\n').filter(d => d.trim())
    : [];

  const referenceLinks = scheme?.reference_links
    ? scheme.reference_links.split('\n').map(line => {
        const [title, url] = line.split(': ');
        return { title: title?.trim(), url: url?.trim() };
      }).filter(r => r.title && r.url)
    : [];

  const EligibilityBadge = () => {
    if (!scheme?.eligibility || !user) return null;
    const { status, score, reasons = [], missing_criteria = [] } = scheme.eligibility;

    if (status === 'eligible') return (
      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="h-6 w-6 text-yellow-600" />
          <div>
            <p className="font-semibold text-gray-900">You're Eligible!</p>
            <p className="text-sm text-gray-700">Match Score: {Math.round(score)}%</p>
          </div>
        </div>
        {reasons.length > 0 && (
          <ul className="mt-3 text-sm text-gray-700 list-disc list-inside space-y-1">
            {reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </div>
    );

    if (status === 'likely_eligible') return (
      <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="h-6 w-6 text-gray-700" />
          <div>
            <p className="font-semibold text-gray-900">Likely Eligible</p>
            <p className="text-sm text-gray-700">Match Score: {Math.round(score)}%</p>
          </div>
        </div>
        {missing_criteria.length > 0 && (
          <ul className="mt-3 text-sm text-gray-700 list-disc list-inside space-y-1">
            {missing_criteria.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        )}
      </div>
    );

    if (status === 'not_eligible') return (
      <div className="bg-gray-200 border border-gray-400 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <XCircleIcon className="h-6 w-6 text-gray-900" />
          <div>
            <p className="font-semibold text-gray-900">Not Eligible</p>
            <p className="text-sm text-gray-700">Based on your current profile</p>
          </div>
        </div>
        {reasons.length > 0 && (
          <ul className="mt-3 text-sm text-gray-700 list-disc list-inside space-y-1">
            {reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </div>
    );

    return (
      <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-6 w-6 text-gray-700" />
          <div>
            <p className="font-semibold text-gray-900">Need More Information</p>
            <p className="text-sm text-gray-700">Complete your profile to check eligibility</p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4 w-3/4" />
          <div className="h-4 bg-gray-200 rounded mb-2 w-1/2" />
          <div className="h-4 bg-gray-200 rounded mb-8 w-1/3" />
          {[...Array(4)].map((_, i) => <div key={i} className="h-4 bg-gray-200 rounded mb-3" />)}
        </div>
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Scheme Not Found</h1>
          <Link href="/search" className="bg-yellow-500 text-black px-6 py-3 rounded-md hover:bg-yellow-400 font-medium inline-block">
            Browse All Schemes
          </Link>
        </div>
      </div>
    );
  }

  const description = scheme.brief_description || scheme.description || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Link href="/search" className="inline-flex items-center text-gray-900 hover:text-yellow-600 mb-6 font-medium">
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Back to Search
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200 mb-2">
                🧪 Testing Page
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{scheme.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span>{scheme.ministry}</span>
                <span>•</span>
                <span className="capitalize">{scheme.level} Level</span>
                <span>•</span>
                <span>Updated: {new Date(scheme.last_updated).toLocaleDateString()}</span>
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <button
                  onClick={handleAutoFill}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-md hover:bg-yellow-400 font-medium text-sm"
                >
                  <CpuChipIcon className="h-5 w-5" />
                  Auto-Fill Form
                </button>
                <button
                  onClick={handleSaveToggle}
                  disabled={saving}
                  className="flex items-center gap-1 text-gray-600 hover:text-yellow-500 transition-colors"
                >
                  {isSaved
                    ? <BookmarkSolid className="h-6 w-6 text-yellow-500" />
                    : <BookmarkOutline className="h-6 w-6" />}
                  <span className="text-sm font-medium">{isSaved ? 'Saved' : 'Save'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Category tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {scheme.scheme_category.map((cat, i) => (
              <span key={i} className="px-3 py-1 rounded-md text-sm font-medium bg-gray-100 text-gray-800 border border-gray-300">
                {cat}
              </span>
            ))}
          </div>

          <EligibilityBadge />
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {description && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
                <p className="text-gray-700 leading-relaxed">{description}</p>
              </div>
            )}

            {scheme.benefits && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Benefits</h2>
                <div className="space-y-2">
                  {scheme.benefits.split('\n').filter(b => b.trim()).map((b, i) => (
                    <p key={i} className="text-gray-700 text-sm">{b.trim()}</p>
                  ))}
                </div>
              </div>
            )}

            {scheme.application_process && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">How to Apply</h2>
                <div className="space-y-2">
                  {scheme.application_process.split('\n').filter(s => s.trim()).map((step, i) => (
                    <p key={i} className="text-gray-700 text-sm">{step.trim()}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {scheme.eligibility_criteria && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Eligibility Criteria</h3>
                <div className="space-y-2">
                  {scheme.eligibility_criteria.split('\n').filter(c => c.trim()).map((c, i) => (
                    <p key={i} className="text-sm text-gray-700">{c.trim()}</p>
                  ))}
                </div>
              </div>
            )}

            {requiredDocuments.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Required Documents</h3>
                <ul className="space-y-2">
                  {requiredDocuments.map((doc, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {scheme.contact_information && Object.keys(scheme.contact_information).length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(scheme.contact_information).map(([key, val]) => (
                    <div key={key}>
                      <span className="font-medium text-gray-900 capitalize">{key.replace('_', ' ')}: </span>
                      <span className="text-gray-700">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {referenceLinks.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Useful Links</h3>
                <div className="space-y-2">
                  {referenceLinks.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-gray-900 hover:text-yellow-600 text-sm">
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      {link.title}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {scheme.target_beneficiaries?.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Target Beneficiaries</h3>
                <div className="flex flex-wrap gap-2">
                  {scheme.target_beneficiaries.map((b, i) => (
                    <span key={i} className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300">
                      {b}
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
