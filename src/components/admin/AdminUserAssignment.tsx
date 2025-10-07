import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { User, Company } from '../../types';
import { 
  UserPlus, 
  Building2, 
  Search, 
  Users, 
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';

interface AdminUserAssignmentProps {
  onAssignmentComplete?: () => void;
}

export const AdminUserAssignment: React.FC<AdminUserAssignmentProps> = ({ 
  onAssignmentComplete 
}) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [membershipType, setMembershipType] = useState<'primary' | 'secondary'>('primary');
  const [role, setRole] = useState<'member' | 'admin' | 'collaborator'>('member');
  const [assigning, setAssigning] = useState(false);
  const [autoLinking, setAutoLinking] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch ALL users using the admin function to bypass RLS issues
      const { data: usersData, error: usersError } = await supabase.rpc('list_all_users_for_admin');
      
      if (usersError) {
        console.warn('Admin function failed, trying direct query:', usersError);
        // Fallback to direct query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles')
          .select('*')
          .order('first_name');
        
        if (fallbackError) throw fallbackError;
        setUsers(fallbackData || []);
      } else {
        setUsers(usersData || []);
      }

      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (companiesError) throw companiesError;

      setCompanies(companiesData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError('Failed to load users and companies');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoLinkUsers = async () => {
    try {
      setAutoLinking(true);
      setError(null);
      setSuccess(null);

      console.log('Calling link_existing_users_to_companies function...');
      const { data, error } = await supabase.rpc('link_existing_users_to_companies');
      
      console.log('Function result:', data, 'Error:', error);

      if (error) throw error;

      setSuccess(data.message || `Auto-linking completed. Linked ${data.linked_count || 0} users.`);

      // Refresh data
      await fetchData();

      if (onAssignmentComplete) {
        onAssignmentComplete();
      }

    } catch (error: any) {
      console.error('Error auto-linking users:', error);
      setError('Failed to auto-link users: ' + error.message);
    } finally {
      setAutoLinking(false);
    }
  };

  const handleAssignment = async () => {
    if (!selectedUser || !selectedCompany) {
      setError('Please select both a user and a company');
      return;
    }

    try {
      setAssigning(true);
      setError(null);
      setSuccess(null);

      const finalRole = membershipType === 'primary' ? role : 'collaborator';

      const { data, error } = await supabase.rpc('admin_assign_user_to_company', {
        p_user_id: selectedUser.id,
        p_company_id: selectedCompany.id,
        p_role: finalRole,
        p_membership_type: membershipType
      });

      if (error) throw error;

      setSuccess(`Successfully assigned ${selectedUser.first_name} ${selectedUser.last_name} to ${selectedCompany.name} as ${finalRole}`);

      // Reset form
      setSelectedUser(null);
      setSelectedCompany(null);
      setMembershipType('primary');
      setRole('member');

      // Refresh data
      await fetchData();

      // Call callback if provided
      if (onAssignmentComplete) {
        onAssignmentComplete();
      }

    } catch (error: any) {
      console.error('Error assigning user:', error);
      setError('Failed to assign user: ' + error.message);
    } finally {
      setAssigning(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auto-Link Tool */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-blue-800">Auto-Link Existing Users</h4>
            <p className="text-sm text-blue-700 mt-1">
              Automatically link users to companies based on company name matching
            </p>
          </div>
          <Button
            onClick={handleAutoLinkUsers}
            disabled={autoLinking}
            isLoading={autoLinking}
            size="sm"
          >
            {autoLinking ? 'Linking...' : 'Auto-Link Users'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md flex items-start">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <UserPlus className="h-5 w-5 mr-2 text-blue-500" />
          Assign User to Company
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select User
            </label>
            
            <div className="relative mb-3">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                    selectedUser?.id === user.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                      <span className="text-sm font-medium text-blue-800">
                        {user.first_name[0]}{user.last_name[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      {user.company && (
                        <p className="text-xs text-blue-600">
                          Currently: {user.company}
                          {user.company_role && ` (${user.company_role})`}
                          {user.company_id ? ' ✓ Linked' : ' ⚠ Text Only'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Company Selection and Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Company
            </label>
            
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto mb-4">
              {companies.map(company => (
                <div
                  key={company.id}
                  className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                    selectedCompany?.id === company.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => setSelectedCompany(company)}
                >
                  <div className="flex items-center">
                    <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{company.name}</p>
                      {company.industry && (
                        <p className="text-xs text-gray-500">{company.industry}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Membership Configuration */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Membership Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="membership-type"
                      value="primary"
                      checked={membershipType === 'primary'}
                      onChange={() => setMembershipType('primary')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      <strong>Primary Company</strong> - Main identity, NDAs, admin rights
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="membership-type"
                      value="secondary"
                      checked={membershipType === 'secondary'}
                      onChange={() => setMembershipType('secondary')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      <strong>Secondary Company</strong> - Collaborator access for specific projects
                    </span>
                  </label>
                </div>
              </div>
              
              {membershipType === 'primary' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              )}
              {selectedCompany && (
                <p className="text-xs text-gray-400">
                  ID: {selectedCompany.id.slice(0, 8)}...
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleAssignment}
            disabled={!selectedUser || !selectedCompany || assigning}
            isLoading={assigning}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            {assigning ? 'Assigning...' : 'Assign User to Company'}
          </Button>
        </div>
      </div>
    </div>
  );
};