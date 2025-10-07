import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Building2, Users, CheckCircle, AlertCircle, Loader2, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface JoinRequestDetails {
  id: string;
  company_id: string;
  company_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  message?: string;
  response_message?: string;
  member_count: number;
  industry?: string;
}

export const CompanyJoinRequestPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [requestId] = useState<string>(searchParams.get('id') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestDetails, setRequestDetails] = useState<JoinRequestDetails | null>(null);
  
  useEffect(() => {
    if (!requestId) {
      setError('Invalid request ID');
      setLoading(false);
      return;
    }
    
    if (!user) {
      navigate('/login', { state: { returnUrl: `/company-request?id=${requestId}` } });
      return;
    }
    
    const fetchRequestDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch join request details
        const { data, error } = await supabase
          .from('company_join_requests')
          .select(`
            id,
            company_id,
            status,
            created_at,
            message,
            response_message,
            companies:company_id (
              name,
              industry,
              members:profiles(count)
            )
          `)
          .eq('id', requestId)
          .single();
        
        if (error) throw error;
        
        if (!data) {
          throw new Error('Request not found');
        }
        
        // Check if user is authorized to view this request
        if (data.user_id !== user.id && !user.company_id === data.company_id) {
          throw new Error('You are not authorized to view this request');
        }
        
        // Transform data to a more convenient structure
        const details: JoinRequestDetails = {
          id: data.id,
          company_id: data.company_id,
          company_name: data.companies.name,
          status: data.status,
          created_at: data.created_at,
          message: data.message,
          response_message: data.response_message,
          member_count: data.companies.members?.length || 0,
          industry: data.companies.industry
        };
        
        setRequestDetails(details);
      } catch (error: any) {
        console.error('Error fetching request details:', error);
        setError(error.message || 'An error occurred while loading request details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRequestDetails();
  }, [requestId, user, navigate]);
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-600">Loading request details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-red-50 p-6">
            <div className="flex justify-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-red-800">Error</h3>
              <p className="mt-2 text-sm text-red-700">{error}</p>
            </div>
          </div>
          <div className="p-6">
            <Link to="/">
              <Button fullWidth>
                Return to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  if (!requestDetails) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-yellow-50 p-6">
            <div className="flex justify-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-yellow-800">Request Not Found</h3>
              <p className="mt-2 text-sm text-yellow-700">
                The join request you're looking for doesn't exist or has been removed.
              </p>
            </div>
          </div>
          <div className="p-6">
            <Link to="/profile">
              <Button fullWidth>
                Go to Profile
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4">
        <Link to="/profile" className="text-gray-500 hover:text-gray-700 flex items-center">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Profile
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className={`p-6 ${
          requestDetails.status === 'approved' ? 'bg-green-50' :
          requestDetails.status === 'rejected' ? 'bg-red-50' :
          'bg-blue-50'
        }`}>
          <div className="flex justify-center">
            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
              requestDetails.status === 'approved' ? 'bg-green-100' :
              requestDetails.status === 'rejected' ? 'bg-red-100' :
              'bg-blue-100'
            }`}>
              {requestDetails.status === 'approved' ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : requestDetails.status === 'rejected' ? (
                <AlertCircle className="h-6 w-6 text-red-600" />
              ) : (
                <Clock className="h-6 w-6 text-blue-600" />
              )}
            </div>
          </div>
          
          <div className="mt-3 text-center">
            <h3 className={`text-lg font-medium ${
              requestDetails.status === 'approved' ? 'text-green-800' :
              requestDetails.status === 'rejected' ? 'text-red-800' :
              'text-blue-800'
            }`}>
              {requestDetails.status === 'approved' ? 'Request Approved' :
               requestDetails.status === 'rejected' ? 'Request Rejected' :
               'Request Pending'}
            </h3>
            <p className={`mt-2 text-sm ${
              requestDetails.status === 'approved' ? 'text-green-600' :
              requestDetails.status === 'rejected' ? 'text-red-600' :
              'text-blue-600'
            }`}>
              {requestDetails.status === 'approved' ? 
                `You are now a member of ${requestDetails.company_name}` :
                requestDetails.status === 'rejected' ? 
                `Your request to join ${requestDetails.company_name} was rejected` :
                `Your request to join ${requestDetails.company_name} is pending approval`
              }
            </p>
          </div>
        </div>
        
        <div className="p-6">
          <div className="border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Building2 className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <h4 className="text-base font-medium text-gray-900">{requestDetails.company_name}</h4>
                <div className="flex items-center text-sm text-gray-500 mt-1">
                  {requestDetails.industry && (
                    <span className="mr-3">{requestDetails.industry}</span>
                  )}
                  <Users className="h-4 w-4 mr-1" />
                  <span>{requestDetails.member_count} members</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-1">Request Details</h4>
            <p className="text-sm text-gray-500 mb-2">
              Requested on {formatDate(requestDetails.created_at)}
            </p>
            
            {requestDetails.message && (
              <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-sm text-gray-700 mb-4">
                <p className="text-xs text-gray-500 mb-1">Your message:</p>
                <p>"{requestDetails.message}"</p>
              </div>
            )}
            
            {requestDetails.status === 'rejected' && requestDetails.response_message && (
              <div className="bg-red-50 p-3 rounded-md border border-red-200 text-sm text-red-700">
                <p className="text-xs text-red-500 mb-1">Rejection reason:</p>
                <p>"{requestDetails.response_message}"</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-center">
            {requestDetails.status === 'approved' ? (
              <Link to="/profile?tab=company">
                <Button>
                  Go to Company Profile
                </Button>
              </Link>
            ) : requestDetails.status === 'rejected' ? (
              <div className="space-y-3">
                <Link to="/profile?tab=company">
                  <Button>
                    Find Another Company
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center">
                <Button variant="outline" disabled>
                  <Clock className="h-4 w-4 mr-2" />
                  Awaiting Response
                </Button>
                <p className="mt-3 text-sm text-gray-500">
                  You'll receive a notification when the company responds to your request.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};