import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  Mail
} from 'lucide-react';
import { Button } from '../ui/Button';
import { format } from 'date-fns';

interface RFPAccessManagerProps {
  rfpId: string;
  rfpTitle: string;
}

interface AccessRecord {
  id: string;
  rfp_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  };
}

export const RFPAccessManager: React.FC<RFPAccessManagerProps> = ({ rfpId, rfpTitle }) => {
  const [accessRecords, setAccessRecords] = useState<AccessRecord[]>([]);
  const [clientReviewers, setClientReviewers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [showAddUsers, setShowAddUsers] = useState(false);
  const [fetchingClientReviewers, setFetchingClientReviewers] = useState(false);

  const fetchAccessRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching access records for RFP:', rfpId);
      
      // Fetch current access records
      const { data: accessData, error: accessError } = await supabase
        .from('rfp_access')
        .select(`
          *,
          user:user_id (
            id,
            email,
            first_name,
            last_name,
            role
          )
        `)
        .eq('rfp_id', rfpId);

      if (accessError) throw accessError;
      
      console.log('Fetched access records:', accessData);
      setAccessRecords(accessData || []);

    } catch (error: any) {
      console.error('Error fetching access records:', error);
      setError('Failed to load access records: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientReviewers = async () => {
    try {
      setFetchingClientReviewers(true);
      setError(null);
      
      // Fetch all users with role = 'client_reviewer'
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, company')
        .eq('role', 'client_reviewer');

      if (error) throw error;
      
      // Filter out users who already have access records
      const existingUserIds = accessRecords.map(record => record.user_id);
      const filteredReviewers = data.filter(user => !existingUserIds.includes(user.id));
      
      setClientReviewers(filteredReviewers);
    } catch (error: any) {
      console.error('Error fetching client reviewers:', error);
      setError('Failed to load client reviewers: ' + error.message);
    } finally {
      setFetchingClientReviewers(false);
    }
  };

  useEffect(() => {
    if (rfpId) {
      fetchAccessRecords();
    }
  }, [rfpId]);

  useEffect(() => {
    if (showAddUsers) {
      fetchClientReviewers();
    }
  }, [showAddUsers, accessRecords]);

  const handleAddAccess = async () => {
    if (selectedUsers.length === 0) return;
    
    try {
      setError(null);
      
      console.log('Adding access for users:', selectedUsers);
      
      // Insert access records for selected users
      const newRecords = selectedUsers.map(userId => ({
        rfp_id: rfpId,
        user_id: userId,
        status: 'pending'
      }));
      
      const { error } = await supabase
        .from('rfp_access')
        .insert(newRecords);
        
      if (error) throw error;
      
      // Refresh the access records
      await fetchAccessRecords();
      setSelectedUsers([]);
      setShowAddUsers(false);
      
    } catch (error: any) {
      console.error('Error adding access records:', error);
      setError('Failed to add users: ' + error.message);
      // Keep the add users panel open if there's an error
    }
  };

  const handleUpdateStatus = async (recordId: string, newStatus: 'approved' | 'rejected') => {
    try {
      setProcessingIds(prev => [...prev, recordId]);
      setError(null);
      
      const { error } = await supabase
        .from('rfp_access')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordId);
        
      if (error) throw error;
      
      // Update local state
      setAccessRecords(prev => 
        prev.map(record => 
          record.id === recordId 
            ? { ...record, status: newStatus, updated_at: new Date().toISOString() } 
            : record
        )
      );

      // If approved, create a notification for the user
      if (newStatus === 'approved') {
        const record = accessRecords.find(r => r.id === recordId);
        if (record && record.user) {
          await supabase
            .from('notifications')
            .insert({
              user_id: record.user_id,
              title: 'RFP Access Granted',
              message: `You have been granted access to review "${rfpTitle}".`,
              type: 'access_granted',
              reference_id: rfpId
            });
        }
      }
      
    } catch (error: any) {
      console.error('Error updating access status:', error);
      setError('Failed to update status: ' + error.message);
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== recordId));
    }
  };

  const handleToggleUserSelection = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    } else {
      setSelectedUsers(prev => [...prev, userId]);
    }
  };

  const filteredReviewers = clientReviewers.filter(reviewer => 
    reviewer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${reviewer.first_name} ${reviewer.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Users className="h-5 w-5 text-gray-400 mr-2" />
          RFP Access Management
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchAccessRecords}
          >
            Refresh
          </Button>
          {!showAddUsers ? (
            <Button
              size="sm"
              leftIcon={<UserPlus className="h-4 w-4" />}
              onClick={() => setShowAddUsers(true)}
            >
              Add Reviewers
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddUsers(false)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Add Users Panel */}
      {showAddUsers && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-3">Add Client Reviewers</h4>
          
          {/* Search Input */}
          <div className="mb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search client reviewers..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          {fetchingClientReviewers ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-blue-600">Loading client reviewers...</p>
            </div>
          ) : filteredReviewers.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              {searchTerm 
                ? "No client reviewers match your search" 
                : "No available client reviewers found"}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
              <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                {filteredReviewers.map(reviewer => (
                  <li key={reviewer.id} className="p-3 hover:bg-gray-50">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(reviewer.id)}
                        onChange={() => handleToggleUserSelection(reviewer.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="ml-3 flex-grow">
                        <p className="text-sm font-medium text-gray-900">
                          {reviewer.first_name} {reviewer.last_name}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {reviewer.email}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Client Reviewer
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex justify-end">
            <Button
              onClick={handleAddAccess}
              disabled={selectedUsers.length === 0}
              size="sm"
            >
              Add {selectedUsers.length} {selectedUsers.length === 1 ? 'User' : 'Users'}
            </Button>
          </div>
        </div>
      )}

      {/* Access Records List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="flex flex-col items-center">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
            <p className="text-sm text-gray-600">Loading access records...</p>
          </div>
        </div>
      ) : accessRecords.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Access Records</h3>
          <p className="text-gray-500 mb-4">
            No client reviewers have been given access to this RFP yet.
          </p>
          <Button
            leftIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => setShowAddUsers(true)}
          >
            Add Client Reviewers
          </Button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {accessRecords.map(record => (
              <li key={record.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="font-medium text-blue-800">
                          {record.user?.first_name?.[0] || '?'}{record.user?.last_name?.[0] || '?'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3 flex-grow">
                      <p className="text-sm font-medium text-gray-900">
                        {record.user?.first_name} {record.user?.last_name}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {record.user?.email || 'Unknown email'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Added on {format(new Date(record.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    {record.status === 'pending' ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          leftIcon={processingIds.includes(record.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          onClick={() => handleUpdateStatus(record.id, 'rejected')}
                          disabled={processingIds.includes(record.id)}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-200 text-green-600 hover:bg-green-50"
                          leftIcon={processingIds.includes(record.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          onClick={() => handleUpdateStatus(record.id, 'approved')}
                          disabled={processingIds.includes(record.id)}
                        >
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full items-center ${
                        record.status === 'approved' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {record.status === 'approved' ? (
                          <>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Approved
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Rejected
                          </>
                        )}
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