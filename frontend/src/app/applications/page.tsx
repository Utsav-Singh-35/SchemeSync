'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Link from 'next/link';
import { 
  DocumentTextIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Application {
  id: number;
  scheme_id: string;
  scheme_name: string;
  application_date: string;
  acknowledgment_number?: string;
  application_status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'pending_documents';
  portal_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newApplication, setNewApplication] = useState({
    scheme_id: '',
    application_date: '',
    acknowledgment_number: '',
    portal_url: '',
    notes: ''
  });

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  const loadApplications = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockApplications: Application[] = [
        {
          id: 1,
          scheme_id: 'pmkisan',
          scheme_name: 'PM-KISAN Samman Nidhi Yojana',
          application_date: '2024-03-01',
          acknowledgment_number: 'PMK2024030112345',
          application_status: 'approved',
          portal_url: 'https://pmkisan.gov.in',
          notes: 'Application approved, first installment received',
          created_at: '2024-03-01T10:00:00Z',
          updated_at: '2024-03-10T15:30:00Z'
        },
        {
          id: 2,
          scheme_id: 'ayushman',
          scheme_name: 'Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana',
          application_date: '2024-02-15',
          acknowledgment_number: 'AB2024021567890',
          application_status: 'under_review',
          portal_url: 'https://pmjay.gov.in',
          notes: 'Documents verification in progress',
          created_at: '2024-02-15T14:20:00Z',
          updated_at: '2024-02-20T09:15:00Z'
        },
        {
          id: 3,
          scheme_id: 'scholarship',
          scheme_name: 'National Scholarship Portal',
          application_date: '2024-01-20',
          acknowledgment_number: 'NSP2024012098765',
          application_status: 'pending_documents',
          portal_url: 'https://scholarships.gov.in',
          notes: 'Income certificate required',
          created_at: '2024-01-20T11:45:00Z',
          updated_at: '2024-01-25T16:00:00Z'
        }
      ];
      setApplications(mockApplications);
    } catch (error) {
      console.error('Failed to load applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: Application['application_status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      case 'under_review':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      case 'pending_documents':
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />;
      default:
        return <DocumentTextIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: Application['application_status']) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending_documents':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: Application['application_status']) => {
    switch (status) {
      case 'submitted':
        return 'Submitted';
      case 'under_review':
        return 'Under Review';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'pending_documents':
        return 'Pending Documents';
      default:
        return 'Unknown';
    }
  };

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    // Mock implementation - replace with actual API call
    toast.success('Application tracking added successfully!');
    setShowAddForm(false);
    setNewApplication({
      scheme_id: '',
      application_date: '',
      acknowledgment_number: '',
      portal_url: '',
      notes: ''
    });
    loadApplications();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Not authenticated</h3>
            <p className="mt-1 text-sm text-gray-500">Please log in to track your applications.</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Application Tracking</h1>
            <p className="mt-2 text-gray-600">
              Monitor the status of your scheme applications
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Application
          </button>
        </div>

        {/* Add Application Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Application</h2>
            <form onSubmit={handleAddApplication} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheme Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newApplication.scheme_id}
                    onChange={(e) => setNewApplication(prev => ({ ...prev, scheme_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter scheme name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Application Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newApplication.application_date}
                    onChange={(e) => setNewApplication(prev => ({ ...prev, application_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Acknowledgment Number
                  </label>
                  <input
                    type="text"
                    value={newApplication.acknowledgment_number}
                    onChange={(e) => setNewApplication(prev => ({ ...prev, acknowledgment_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter acknowledgment number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Portal URL
                  </label>
                  <input
                    type="url"
                    value={newApplication.portal_url}
                    onChange={(e) => setNewApplication(prev => ({ ...prev, portal_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.gov.in"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={newApplication.notes}
                  onChange={(e) => setNewApplication(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any notes about this application"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Application
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Applications List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded mb-4 w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : applications.length > 0 ? (
          <div className="space-y-4">
            {applications.map((application) => (
              <div key={application.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {application.scheme_name}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>Applied: {new Date(application.application_date).toLocaleDateString()}</span>
                      {application.acknowledgment_number && (
                        <span>Ref: {application.acknowledgment_number}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center">
                      {getStatusIcon(application.application_status)}
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(application.application_status)}`}>
                        {getStatusText(application.application_status)}
                      </span>
                    </div>
                    
                    {application.portal_url && (
                      <a
                        href={application.portal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                </div>

                {application.notes && (
                  <div className="bg-gray-50 rounded-md p-3 mb-4">
                    <p className="text-sm text-gray-700">{application.notes}</p>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  Last updated: {new Date(application.updated_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No applications tracked</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start tracking your scheme applications to monitor their progress.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add First Application
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}