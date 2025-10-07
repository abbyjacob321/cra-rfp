import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { Loader2, AlertCircle, Building2, RefreshCw, User, Calendar, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface RFPInterestListProps {
  rfpId: string;
}

interface CompanyRegistration {
  id: string;
  company_id: string;
  company_name: string;
  user_id: string;
  user_name: string;
  user_email: string;
  registration_date: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  notes?: string;
}

export const RFPInterestList: React.FC<RFPInterestListProps> = ({ rfpId }) => {
  const [registrations, setRegistrations] = useState<CompanyRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const handleApproveRegistration = async (registrationId: string) => {
    try {
      setProcessingId(registrationId);
      setError(null);
      
      const { data, error } = await supabase.rpc('approve_company_registration', {
        p_registration_id: registrationId
      });
      
      if (error) throw error;
      
      // Refresh the list
      await fetchRegistrations();
      
    } catch (error: any) {
      console.error('Error approving registration:', error);
      setError('Failed to approve registration: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };
  
  const handleRejectRegistration = async (registrationId: string) => {
    const reason = prompt('Enter reason for rejection:');
    if (!reason) return;
    
    try {
      setProcessingId(registrationId);
      setError(null);
      
      const { data, error } = await supabase.rpc('reject_company_registration', {
        p_registration_id: registrationId,
        p_rejection_reason: reason
      });
      
      if (error) throw error;
      
      // Refresh the list
      await fetchRegistrations();
      
    } catch (error: any) {
      console.error('Error rejecting registration:', error);
      setError('Failed to reject registration: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };
  
  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('rfp_interest_registrations')
        .select(`
          id,
          company_id,
          user_id,
          registration_date,
          status,
          approved_at,
          rejected_at,
          rejection_reason,
          notes,
          companies:company_id (name),
          users:profiles!rfp_interest_registrations_user_id_fkey (
            email, 
            first_name, 
            last_name
          )
        `)
        .eq('rfp_id', rfpId)
        .order('registration_date', { ascending: false });
        
      if (error) throw error;
      
      // Transform the data
      const transformedData = data.map(item => ({
        id: item.id,
        company_id: item.company_id,
        company_name: item.companies?.name || 'Unknown Company',
        user_id: item.user_id,
        user_name: item.users ? `${item.users.first_name} ${item.users.last_name}` : 'Unknown User',
        user_email: item.users?.email || 'unknown@example.com',
        registration_date: item.registration_date,
        status: item.status || 'pending',
        approved_at: item.approved_at,
        rejected_at: item.rejected_at,
        rejection_reason: item.rejection_reason,
        notes: item.notes
      }));
      
      setRegistrations(transformedData);
    } catch (error: any) {
      console.error('Error fetching registrations:', error);
      setError('Failed to load registrations: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (rfpId) {
      fetchRegistrations();
    }
  }, [rfpId]);
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Registered Companies</h3>
        <Button 
          variant="outline" 
          size="sm" 
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={fetchRegistrations}
        >
          Refresh
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="flex flex-col items-center">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
            <p className="text-sm text-gray-600">Loading registrations...</p>
          </div>
        </div>
      ) : registrations.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Registrations Yet</h3>
          <p className="text-gray-500">
            No companies have registered interest in this RFP yet.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {registrations.map(reg => (
              <li key={reg.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Building2 className="h-8 w-8 text-gray-400" />
                  </div>
                  <div className="ml-4 flex-grow">
                    <div className="text-sm font-medium text-gray-900">{reg.company_name}</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      <User className="h-3.5 w-3.5 mr-1" />
                      Registered by {reg.user_name} ({reg.user_email})
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      {format(new Date(reg.registration_date), 'PPp')}
                    </div>
                    {reg.notes && (
                      <div className="mt-2 text-sm italic text-gray-600">
                        "{reg.notes}"
                      </div>
                    )}
                    {reg.status === 'approved' && reg.approved_at && (
                      <div className="mt-1 text-xs text-green-600">
                        Approved on {format(new Date(reg.approved_at), 'PPp')}
                      </div>
                    )}
                    {reg.status === 'rejected' && reg.rejected_at && (
                      <div className="mt-1 text-xs text-red-600">
                        Rejected on {format(new Date(reg.rejected_at), 'PPp')}
                        {reg.rejection_reason && <div>Reason: {reg.rejection_reason}</div>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {reg.status === 'pending' ? (
                      <>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleApproveRegistration(reg.id)}
                          disabled={processingId === reg.id}
                          leftIcon={<CheckCircle className="h-4 w-4" />}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRegistration(reg.id)}
                          disabled={processingId === reg.id}
                          leftIcon={<XCircle className="h-4 w-4" />}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                      </>
                    ) : reg.status === 'approved' ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approved
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center">
                        <XCircle className="h-3 w-3 mr-1" />
                        Rejected
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};