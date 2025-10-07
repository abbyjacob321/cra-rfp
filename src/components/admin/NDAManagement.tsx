import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle, XCircle, Clock, Lock, AlertCircle, FileText, User, Building2, Calendar, RefreshCw, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { format } from 'date-fns';

interface NDAManagementProps {
  rfpId?: string; // Optional - if provided, only show NDAs for this RFP
}

interface NDARecord {
  id: string;
  rfp_id: string;
  user_id: string;
  status: 'pending' | 'signed' | 'approved' | 'rejected';
  signed_at: string;
  created_at: string;
  full_name: string;
  title?: string;
  company?: string;
  rfp_title?: string;
  user_email?: string;
  countersigned_at?: string;
  countersigned_by?: string;
  countersigner_name?: string;
  countersigner_title?: string;
  rejection_reason?: string;
}

export const NDAManagement: React.FC<NDAManagementProps> = ({ rfpId }) => {
  const [ndas, setNDAs] = useState<NDARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionDialog, setShowRejectionDialog] = useState<string | null>(null);
  const [countersigningId, setCountersigningId] = useState<string | null>(null);
  const [counterSignerName, setCounterSignerName] = useState('');
  const [counterSignerTitle, setCounterSignerTitle] = useState('');

  const fetchNDAs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('rfp_nda_access')
        .select(`
          *,
          rfps (
            id,
            title,
            client_name
          ),
          profiles!rfp_nda_access_user_id_fkey (
            id,
            email,
            first_name,
            last_name,
            company
          )
        `);
      
      // If rfpId is provided, filter by it
      if (rfpId) {
        query = query.eq('rfp_id', rfpId);
      }
        
      const { data, error } = await query.order('created_at', { ascending: false });
        
      if (error) throw error;

      // Transform the data to include related info
      const transformedData = data.map(item => ({
        ...item,
        rfp_title: item.rfps?.title,
        user_email: item.profiles?.email,
        user_name: `${item.profiles?.first_name} ${item.profiles?.last_name}`
      }));
      
      setNDAs(transformedData);
    } catch (error: any) {
      console.error('Error fetching NDAs:', error);
      setError(`Failed to load NDAs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNDAs();
  }, [rfpId]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'MMM d, yyyy, h:mm a');
  };

  const handleCountersign = async (nda: NDARecord) => {
    try {
      if (!counterSignerName.trim()) {
        setError('Please enter your name for the countersignature');
        return;
      }

      setOperationInProgress(nda.id);
      setError(null);
      
      // Create a dummy signature object
      const signatureData = {
        countersigned: true,
        timestamp: new Date().toISOString()
      };
      
      // Call countersign_nda function
      const { data, error } = await supabase.rpc('countersign_nda', {
        p_nda_id: nda.id,
        p_countersigner_name: counterSignerName,
        p_countersigner_title: counterSignerTitle || null,
        p_countersignature_data: signatureData
      });
      
      if (error) throw error;
      
      // Refresh NDAs list
      await fetchNDAs();
      
      // Reset state
      setCountersigningId(null);
      setCounterSignerName('');
      setCounterSignerTitle('');
      
    } catch (error: any) {
      console.error('Error countersigning NDA:', error);
      setError(`Failed to countersign NDA: ${error.message}`);
    } finally {
      setOperationInProgress(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      if (!rejectionReason.trim()) {
        setError('Please provide a reason for rejection');
        return;
      }
      
      setOperationInProgress(id);
      setError(null);
      
      const { data, error } = await supabase.rpc('reject_nda', {
        p_nda_id: id,
        p_rejection_reason: rejectionReason
      });
      
      if (error) throw error;
      
      // Refresh NDAs list
      await fetchNDAs();
      
      // Reset state
      setShowRejectionDialog(null);
      setRejectionReason('');
      
    } catch (error: any) {
      console.error('Error rejecting NDA:', error);
      setError(`Failed to reject NDA: ${error.message}`);
    } finally {
      setOperationInProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="flex flex-col items-center">
          <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
          <p className="text-gray-600">Loading NDAs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Lock className="h-5 w-5 text-gray-400 mr-2" />
          {rfpId ? 'RFP Non-Disclosure Agreements' : 'All Non-Disclosure Agreements'}
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={fetchNDAs}
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

      {showRejectionDialog && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Reject NDA</h3>
            <p className="text-gray-600 mb-4">Please provide a reason for rejecting this NDA:</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="rejection-reason">
                Reason
              </label>
              <textarea
                id="rejection-reason"
                rows={3}
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why you are rejecting this NDA..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectionDialog(null);
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                onClick={() => handleReject(showRejectionDialog)}
                disabled={operationInProgress === showRejectionDialog || !rejectionReason.trim()}
                leftIcon={operationInProgress === showRejectionDialog ? 
                  <Loader2 className="h-4 w-4 animate-spin" /> : 
                  <X className="h-4 w-4" />}
              >
                {operationInProgress === showRejectionDialog ? 'Rejecting...' : 'Reject NDA'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {ndas.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No NDAs Found</h3>
          <p className="text-gray-500 mb-4">
            {rfpId ? 
              "No NDAs have been signed for this RFP yet." :
              "No NDAs have been signed on the platform yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bidder
                  </th>
                  {!rfpId && (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      RFP
                    </th>
                  )}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Signed On
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ndas.map((nda) => (
                  <tr key={nda.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{nda.full_name}</div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Building2 className="h-3 w-3 mr-1" />
                            {nda.company || 'Not specified'}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {!rfpId && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{nda.rfp_title}</div>
                        <div className="text-sm text-gray-500">{nda.rfps?.client_name}</div>
                      </td>
                    )}
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1.5 text-gray-400" />
                        {formatDate(nda.signed_at)}
                      </div>
                      {nda.title && (
                        <div className="text-xs text-gray-500 mt-1">
                          Title: {nda.title}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {nda.status === 'approved' && (
                          <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 items-center">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> 
                            Approved
                          </span>
                        )}
                        {nda.status === 'signed' && (
                          <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 items-center">
                            <Clock className="h-3.5 w-3.5 mr-1" />
                            Awaiting Countersignature
                          </span>
                        )}
                        {nda.status === 'rejected' && (
                          <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 items-center">
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Rejected
                          </span>
                        )}
                      </div>
                      
                      {nda.status === 'approved' && nda.countersigned_at && (
                        <div className="text-xs text-gray-500 mt-1">
                          Countersigned: {formatDate(nda.countersigned_at)}
                        </div>
                      )}
                      
                      {nda.status === 'rejected' && nda.rejection_reason && (
                        <div className="text-xs text-red-500 mt-1 max-w-xs truncate">
                          Reason: {nda.rejection_reason}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {nda.status === 'signed' && (
                        <>
                          {countersigningId === nda.id ? (
                            <div className="flex flex-col gap-2 min-w-56">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Your Name
                                </label>
                                <input
                                  type="text"
                                  className="block w-full border-gray-300 rounded-md shadow-sm text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  value={counterSignerName}
                                  onChange={(e) => setCounterSignerName(e.target.value)}
                                  placeholder="Enter your full name"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Your Title
                                </label>
                                <input
                                  type="text"
                                  className="block w-full border-gray-300 rounded-md shadow-sm text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                  value={counterSignerTitle}
                                  onChange={(e) => setCounterSignerTitle(e.target.value)}
                                  placeholder="Your job title (optional)"
                                />
                              </div>
                              <div className="flex justify-end gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setCountersigningId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleCountersign(nda)}
                                  disabled={operationInProgress === nda.id || !counterSignerName.trim()}
                                  leftIcon={operationInProgress === nda.id ? 
                                    <Loader2 className="h-3 w-3 animate-spin" /> : 
                                    <CheckCircle className="h-3 w-3" />}
                                >
                                  {operationInProgress === nda.id ? 'Processing...' : 'Countersign'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 text-red-700 hover:bg-red-50"
                                onClick={() => setShowRejectionDialog(nda.id)}
                                disabled={operationInProgress !== null}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => setCountersigningId(nda.id)}
                                disabled={operationInProgress !== null}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Countersign
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      
                      {nda.status === 'approved' && (
                        <div className="text-green-600 flex items-center justify-end">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          <span>Approved</span>
                        </div>
                      )}
                      
                      {nda.status === 'rejected' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // View rejection details or allow resetting
                            alert(`Rejection reason: ${nda.rejection_reason || 'None provided'}`);
                          }}
                        >
                          View Details
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};