import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  SlidersHorizontal, 
  UserPlus,
  Shield,
  UserCheck,
  User as UserIcon,
  MoreHorizontal,
  Calendar,
  Mail,
  Building,
  Edit,
  UserX,
  ChevronDown,
  ArrowUpDown,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { AddUserModal } from '../../components/admin/AddUserModal';
import { User } from '../../types';

// Role display mapping
const roleDisplay = {
  'admin': { label: 'Administrator', color: 'bg-purple-100 text-purple-800', icon: <Shield className="h-3.5 w-3.5 mr-1" /> },
  'client_reviewer': { label: 'Client Reviewer', color: 'bg-blue-100 text-blue-800', icon: <UserCheck className="h-3.5 w-3.5 mr-1" /> },
  'bidder': { label: 'Bidder', color: 'bg-green-100 text-green-800', icon: <UserIcon className="h-3.5 w-3.5 mr-1" /> }
};

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  
  const handleUserAdded = (newUser: User) => {
    setUsers([newUser, ...users]);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      
      console.log('Fetching all users...');
      
      // Create a debug log of the current date/time to help with troubleshooting
      console.log('Fetch started at:', new Date().toISOString());
      
      // Try using the list_all_users_for_admin function which bypasses RLS
      const { data: adminListData, error: adminListError } = await supabase
        .rpc('list_all_users_for_admin');
        
      if (!adminListError && adminListData) {
        console.log(`Fetched ${adminListData.length} users via admin function`);
        setUsers(adminListData);
        setLoading(false);
        return;
      }
      
      console.log('Falling back to standard query...');
      
      // Use explicitly qualified select statements to avoid ambiguity with comprehensive joins
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          first_name,
          last_name,
          company,
          role,
          created_at,
          updated_at,
          company_id,
          company_role,
          title,
          phone,
          companies:company_id (
            id,
            name,
            website,
            industry
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching users:', error);
        setDebugInfo(JSON.stringify(error, null, 2));
        throw error;
      }

      console.log(`Fetched ${data?.length || 0} users`);

      // Transform data to match User type and include company name from join
      const transformedUsers = data.map(profile => ({
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        company: profile.companies ? profile.companies.name : profile.company,
        role: profile.role,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        company_id: profile.company_id,
        company_role: profile.company_role,
        title: profile.title,
        phone: profile.phone,
        industry: profile.companies?.industry
      }));

      console.log('Transformed users:', transformedUsers.length);
      setUsers(transformedUsers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(`Failed to load users. Error: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setError(null);
      
      // Update the user's role
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      // Update local state
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, role: newRole as User['role'] }
          : user
      ));

      // Show success message
      alert('User role updated successfully');
    } catch (error: any) {
      console.error('Error updating user role:', error);
      setError('Failed to update user role: ' + error.message);
    }
  };

  // Sort and filter users
  const filteredAndSortedUsers = users
    .filter(user => {
      const matchesSearch = !searchTerm || 
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.company && user.company.toLowerCase().includes(searchTerm.toLowerCase()));
        
      const matchesRole = !roleFilter || user.role === roleFilter;
      
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      // Handle special case for company sorting - put users without company last
      if (sortField === 'company') {
        const companyA = a.company || '';
        const companyB = b.company || '';
        return sortDirection === 'asc' 
          ? companyA.localeCompare(companyB) 
          : companyB.localeCompare(companyA);
      }
      
      const fieldA = String(a[sortField as keyof User] || '');
      const fieldB = String(b[sortField as keyof User] || '');
      
      if (sortDirection === 'asc') {
        return fieldA.localeCompare(fieldB);
      } else {
        return fieldB.localeCompare(fieldA);
      }
    });
  
  // Format date for display
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Handle select all
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUsers(filteredAndSortedUsers.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };
  
  // Handle select one
  const handleSelectOne = (id: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedUsers([...selectedUsers, id]);
    } else {
      setSelectedUsers(selectedUsers.filter(userId => userId !== id));
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            View, add, and manage platform users
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchUsers}
          >
            Refresh
          </Button>
          <Button 
            leftIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => setShowAddUserModal(true)}
          >
            Add User
          </Button>
        </div>
      </div>
      
      {showAddUserModal && (
        <AddUserModal
          onClose={() => setShowAddUserModal(false)}
          onUserAdded={handleUserAdded}
        />
      )}
      
      {/* Search and filters */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4 flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {debugInfo && (
            <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg mb-4">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-gray-700">Debug Information</summary>
                <pre className="mt-2 text-xs overflow-auto max-h-40 p-2 bg-gray-100 rounded">
                  {debugInfo}
                </pre>
              </details>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative sm:max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                leftIcon={<SlidersHorizontal className="h-4 w-4" />}
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-blue-50 text-blue-700 border-blue-300' : ''}
              >
                Filters
              </Button>
              
              {selectedUsers.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />}>
                    Export {selectedUsers.length} selected
                  </Button>
                  <Button variant="outline" size="sm" leftIcon={<UserX className="h-4 w-4" />} className="text-red-600 border-red-200 hover:bg-red-50">
                    Deactivate
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Advanced filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  id="role-filter"
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={roleFilter || ''}
                  onChange={(e) => setRoleFilter(e.target.value || null)}
                >
                  <option value="">All Roles</option>
                  <option value="admin">Administrator</option>
                  <option value="client_reviewer">Client Reviewer</option>
                  <option value="bidder">Bidder</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="date-range" className="block text-sm font-medium text-gray-700 mb-1">
                  Join Date Range
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    id="date-from"
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="date"
                    id="date-to"
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    onChange={handleSelectAll}
                    checked={selectedUsers.length === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('last_name')}
                >
                  <div className="flex items-center">
                    <span>Name</span>
                    {sortField === 'last_name' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center">
                    <span>Email</span>
                    {sortField === 'email' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('company')}
                >
                  <div className="flex items-center">
                    <span>Company</span>
                    {sortField === 'company' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center">
                    <span>Joined</span>
                    {sortField === 'created_at' && (
                      <ArrowUpDown className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    No users found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => handleSelectOne(user.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-medium">
                          {user.first_name.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          {user.title && (
                            <div className="text-xs text-gray-500">
                              {user.title}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-gray-400 mr-1.5" />
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building className="h-4 w-4 text-gray-400 mr-1.5" />
                        <div className="text-sm text-gray-500">
                          {user.company || '-'}
                          {user.company_role && (
                            <span className="ml-1 text-xs">
                              ({user.company_role === 'admin' ? 'Admin' : 'Member'})
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full items-center ${roleDisplay[user.role as keyof typeof roleDisplay].color}`}>
                        {roleDisplay[user.role as keyof typeof roleDisplay].icon}
                        {roleDisplay[user.role as keyof typeof roleDisplay].label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1.5" />
                        {formatDate(user.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="bidder">Bidder</option>
                          <option value="client_reviewer">Client Reviewer</option>
                          <option value="admin">Admin</option>
                        </select>
                        <div className="relative">
                          <button className="text-gray-500 hover:text-gray-700" onClick={() => {}}>
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <nav
          className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6"
          aria-label="Pagination"
        >
          <div className="hidden sm:block">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredAndSortedUsers.length}</span> of{' '}
              <span className="font-medium">{filteredAndSortedUsers.length}</span> results
            </p>
          </div>
          <div className="flex-1 flex justify-between sm:justify-end">
            <button
              disabled
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-400 bg-gray-50 cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-400 bg-gray-50 cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};